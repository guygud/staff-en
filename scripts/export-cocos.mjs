/**
 * Export levels to cocos-export/ folder.
 *
 * Output:
 *   cocos-export/json/cards.json     — full card catalog (all cards used across exported levels)
 *   cocos-export/levels/level_N.json — one file per level; matrices.cards = array of card IDs
 *
 * Usage:  node scripts/export-cocos.mjs [levelNumbers...]
 * Example: node scripts/export-cocos.mjs 1 2 3 4
 *          node scripts/export-cocos.mjs          (exports all levels)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');
const data  = JSON.parse(readFileSync(join(root, 'game-data.json'), 'utf8'));

// ── helpers ──────────────────────────────────────────────────────────────────

const SLOT_TYPE_MAP = {
  OBS_LOGS:         'logs',
  OBS_FILTERS:      'filters',
  ST_RETENTION:     'retention',
  ST_QUOTA:         'quota',
  NET_DNS:          'dns',
  NET_TLS:          'tls',
  NET_AUTH:         'auth',
  NET_ROUTING:      'routing',
  NET_DISCOVERY:    'discovery',
  CD_PIPELINE:      'cicd',
  CD_GATES:         'gates',
  CD_ROLLBACK:      'rollback',
  CD_TESTING:       'testing',
  DELIVERY_CICD:    'cicd',
  DELIVERY_CANARY:  'canary',
  RITUAL_OBS:       'ritual',
  RITUAL_ST:        'ritual',
  RITUAL_NET:       'ritual',
  RITUAL_CD:        'ritual',
  RITUAL_DELIVERY:  'ritual',
};

const STATUS_DEBUFF_MAP = {
  F1_OVERFLOW:    'slow',
  F4_BLINDNESS:   'blind',
  F3_COMPROMISE:  'stun',
  F5_FRAGILITY:   'stun',
  F7_CONFUSION:   'slow',
  F6_NONDELIVERY: 'slow',
  F8_AUDIT_GAP:   'blind',
  F9_UNREVIEWED_RELEASE: 'stun',
  F10_CONTRACT_DRIFT: 'slow',
  F11_HOTSPOT: 'slow',
  F12_SPLIT_BRAIN: 'stun',
  F13_DARK_SHARD: 'blind',
  F15_FAILOVER_LOOP: 'slow',
  F16_CAPACITY_GAP: 'slow',
  F2_CONTRADICTION: 'stun',
};

const statusById = Object.fromEntries(data.statusCatalog.map(s => [s.id, s]));
const allCards   = [...(data.spellCatalog ?? []), ...(data.obryadCatalog ?? [])];
const cardById   = Object.fromEntries(allCards.map(c => [c.id, c]));

// Build debtId → statusId map from all addsDebts sources (cards + level defaultInstalled)
const debtStatusMap = {};
for (const card of allCards) {
  for (const debt of (card.addsDebts ?? [])) {
    debtStatusMap[debt.id] = debt.statusIfUnresolved;
  }
}
for (const level of (data.levelCatalog ?? [])) {
  for (const di of (level.defaultInstalled ?? [])) {
    for (const debt of (di.addsDebts ?? [])) {
      debtStatusMap[debt.id] = debt.statusIfUnresolved;
    }
  }
}

function slotTypeToCocos(slotType) {
  return SLOT_TYPE_MAP[slotType] ?? 'connectivity';
}

function cardToCocos(card) {
  const states = [];

  // treatment tags (legacy buffs) this card gives
  const tagNames = [...new Set([...(card.treatmentTags ?? []), ...(card.buffs ?? [])])];
  for (const buffName of tagNames) {
    states.push({ name: buffName, type: 'buff', icon: `images/icons/${buffName.toLowerCase()}` });
  }

  // debuffs this card adds via cascade
  for (const debt of (card.addsDebts ?? [])) {
    const status = statusById[debt.statusIfUnresolved];
    if (status) {
      states.push({
        name: status.name,
        type: 'debuff',
        icon: `images/icons/${debt.statusIfUnresolved.toLowerCase()}`,
      });
    }
  }

  // statuses this card resolves (removes) — deduplicated by statusId
  const resolves = [];
  const seenStatusIds = new Set();
  for (const debtId of (card.resolvesDebts ?? [])) {
    const statusId = debtStatusMap[debtId];
    const status   = statusId ? statusById[statusId] : null;
    if (status && !seenStatusIds.has(statusId)) {
      seenStatusIds.add(statusId);
      resolves.push({ name: status.name, icon: `images/icons/${statusId.toLowerCase()}` });
    }
  }

  // deduplicated slot types, e.g. R_AI_BUFF → ["ritual"]
  const types = [...new Set(
    (card.allowedSlotTypes ?? []).map(slotTypeToCocos).filter(Boolean)
  )];

  return {
    name:        card.name,
    description: card.description,
    currencies:  { gold: card.currencies?.gold ?? 0, aura: card.currencies?.aura ?? 0 },
    states,
    resolves,
    types,
  };
}

// Infer the main visual debuff for a level from its defaultInstalled debts
function levelDebuff(levelDef) {
  for (const di of (levelDef.defaultInstalled ?? [])) {
    for (const debt of (di.addsDebts ?? [])) {
      const mapped = STATUS_DEBUFF_MAP[debt.statusIfUnresolved];
      if (mapped) return mapped;
    }
  }
  return '';
}

// Map a level's availableMatrices to Cocos format
// cards are now at the level root — matrices only describe their slots and cost
function matricesToCocos(levelDef) {
  const matCatalog = Object.fromEntries((data.matrixCatalog ?? []).map(m => [m.id, m]));
  return (levelDef.availableMatrices ?? []).map(m => {
    const isRequired = m.preInstalled !== false; // undefined → true
    const catalogDef = matCatalog[m.matrixId] ?? {};
    const entry = {
      name:        m.name        ?? catalogDef.name        ?? m.instanceId,
      description: m.description ?? catalogDef.description ?? '',
      isRequired,
      slots: m.slots.map(s => slotTypeToCocos(s.slotType)),
    };
    if (!isRequired && m.installCostGold > 0) {
      entry.currencies = { gold: m.installCostGold };
    }
    return entry;
  });
}

const LEVEL_ORDER = ['L1_MILLER_BARN','L2_KESHA_CACHE','L3_GENNADY_LIGHTHOUSE',
                     'L4_ANASTASIA_GOLDEN','L5_KIRA_API','L6_MARK_SHARDING','L7_EDWARD_MULTIDC'];

// Which level numbers to export (CLI args or all)
const requestedNums = process.argv.slice(2).map(Number).filter(Boolean);
const levelIds = requestedNums.length
  ? requestedNums.map(n => LEVEL_ORDER[n - 1]).filter(Boolean)
  : LEVEL_ORDER;

// ── export ───────────────────────────────────────────────────────────────────

const jsonDir   = join(root, 'cocos-export', 'json');
const levelsDir = join(root, 'cocos-export', 'levels');
mkdirSync(jsonDir,   { recursive: true });
mkdirSync(levelsDir, { recursive: true });

// Remove the old per-card folder if it still exists
const oldCardsDir = join(jsonDir, 'cards');
if (existsSync(oldCardsDir)) {
  rmSync(oldCardsDir, { recursive: true, force: true });
  console.log('Removed legacy cocos-export/json/cards/');
}

const cardCatalog = {}; // { [cardId]: cocosCardObject }

for (const levelId of levelIds) {
  const lv = data.levelCatalog.find(l => l.id === levelId);
  if (!lv) { console.warn(`Level ${levelId} not found`); continue; }

  const levelNum = LEVEL_ORDER.indexOf(levelId) + 1;
  const cardIds  = [...(lv.availableSpells ?? []), ...(lv.availableObryads ?? [])];

  // Collect cards into shared catalog
  for (const cardId of cardIds) {
    if (cardCatalog[cardId]) continue;
    const card = cardById[cardId];
    if (!card) { console.warn(`Card ${cardId} not found`); continue; }
    cardCatalog[cardId] = cardToCocos(card);
  }

  // Write level file
  const levelJson = {
    id: levelNum,
    customer: {
      name:        lv.clientName ?? lv.name ?? lv.id,
      avatar:      `images/avatars/level-${levelNum}.png`,
      description: lv.description ?? '',
      budget:      { gold: lv.budget?.gold ?? 0, aura: lv.budget?.aura ?? 0 },
      debuff:      levelDebuff(lv),
    },
    cards:    cardIds,           // all cards available on this level (IDs from cards.json)
    matrices: matricesToCocos(lv),
  };

  writeFileSync(join(levelsDir, `level_${levelNum}.json`), JSON.stringify(levelJson, null, 2));
  console.log(`✓ level_${levelNum}.json  (${cardIds.length} cards, ${lv.availableMatrices?.length ?? 0} matrices)`);
}

// Write single cards catalog
writeFileSync(join(jsonDir, 'cards.json'), JSON.stringify(cardCatalog, null, 2));
console.log(`\n✓ cards.json  (${Object.keys(cardCatalog).length} cards)  →  cocos-export/json/cards.json`);
