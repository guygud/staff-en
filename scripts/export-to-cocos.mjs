#!/usr/bin/env node
/**
 * export-to-cocos.mjs
 *
 * Generates Cocos-ready JSON files from game-data.json.
 * Output mirrors the structure of assets/resources/ in the Cocos repo.
 *
 * Produces:
 *   cocos-export/
 *     levels/level_1.json … level_N.json   (scheme.json format)
 *     json/cards/card-{id}.json            (card-scheme.json format)
 *
 * Engine-only fields (effects, addsDebts, resolvesDebts, allowedSlotTypes,
 * buffs, auraLimitDelta, _sim_*) are stripped from the output.
 *
 * Usage: node scripts/export-to-cocos.mjs [--out ./cocos-export]
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir  = process.argv[2]?.startsWith('--out=')
  ? process.argv[2].slice(6)
  : path.join(ROOT, 'cocos-export');

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-data.json'), 'utf8'));

// ─── Slot category mapping ────────────────────────────────────────────────────
// Maps our granular slot types to Cocos 4-category schema
const SLOT_CATEGORY = {
  OBS_LOGS:      'observability',
  OBS_FILTERS:   'observability',
  OBS_ALERTS:    'observability',
  OBS_TRACING:   'observability',
  RITUAL_OBS:    'observability',
  ST_RETENTION:  'storage',
  ST_INDEX:      'storage',
  ST_QUOTA:      'storage',
  ST_SECRETS:    'storage',
  RITUAL_ST:     'storage',
  NET_AUTH:      'connectivity',
  NET_ROUTING:   'connectivity',
  NET_DISCOVERY: 'connectivity',
  NET_DNS:       'connectivity',
  NET_TLS:       'connectivity',
  RITUAL_NET:    'connectivity',
  CD_PIPELINE:   'delivery',
  CD_GATES:      'delivery',
  CD_ROLLBACK:   'delivery',
  CD_TESTING:    'delivery',
  RITUAL_CD:     'delivery',
};

function slotCategory(allowedSlotTypes = []) {
  for (const t of allowedSlotTypes) {
    if (SLOT_CATEGORY[t]) return SLOT_CATEGORY[t];
  }
  return 'observability';
}

// ─── Debuff category mapping ──────────────────────────────────────────────────
// Maps our F* status IDs to Cocos debuff enum
const DEBUFF_MAP = {
  F4_BLINDNESS:    'blind',
  F5_FRAGILITY:    'slow',
  F2_CONTRADICTION:'stun',
  F1_OVERFLOW:     'slow',
  F3_COMPROMISE:   'stun',
  F6_NONDELIVERY:  'slow',
  F7_CONFUSION:    'blind',
  F8_AUDIT_GAP:    'blind',
  F9_UNREVIEWED_RELEASE: 'stun',
  F10_CONTRACT_DRIFT: 'slow',
  F11_HOTSPOT:     'slow',
  F12_SPLIT_BRAIN: 'stun',
  F13_DARK_SHARD:  'blind',
  F15_FAILOVER_LOOP:'slow',
  F16_CAPACITY_GAP:'slow',
};

function levelDebuff(level) {
  const debts = (level.defaultInstalled ?? []).flatMap(d => d.addsDebts ?? []);
  for (const d of debts) {
    const mapped = DEBUFF_MAP[d.statusIfUnresolved];
    if (mapped) return mapped;
  }
  return '';
}

// ─── Card export ──────────────────────────────────────────────────────────────
function exportCard(card) {
  const states = [];

  // treatmentTags (legacy buffs) → type:"buff"
  const tagNames = [...new Set([...(card.treatmentTags ?? []), ...(card.buffs ?? [])])];
  for (const b of tagNames) {
    states.push({ name: b, type: 'buff', icon: `images/icons/${b.toLowerCase()}` });
  }

  // addsDebts → type:"debuff"
  for (const d of card.addsDebts ?? []) {
    const statusId = d.statusIfUnresolved;
    const statusDef = data.statusCatalog?.find(s => s.id === statusId);
    states.push({
      name: statusDef?.name ?? statusId,
      type: 'debuff',
      icon: `images/icons/${statusId.toLowerCase()}`,
    });
  }

  return {
    name:        card.name,
    description: card.description ?? '',
    currencies:  card.currencies ?? { gold: 0, aura: 0 },
    states,
    type:        slotCategory(card.allowedSlotTypes),
  };
}

// ─── Level export ─────────────────────────────────────────────────────────────
function exportLevel(level, index) {
  const cardRefs = [
    ...(level.availableSpells  ?? []),
    ...(level.availableObryads ?? []),
  ].map(id => `json/cards/card-${id.toLowerCase().replace(/_/g, '-')}`);

  const matrices = (level.availableMatrices ?? []).map(mat => ({
    isRequired: mat.preInstalled !== false,
    ...(mat.installCostGold ? { currencies: { gold: mat.installCostGold } } : {}),
    slots: mat.slots.map(s => SLOT_CATEGORY[s.slotType] ?? s.slotType),
    cards: cardRefs,
  }));

  return {
    id: index + 1,
    customer: {
      name:        level.clientName ?? level.name,
      avatar:      `images/avatars/level-${index + 1}.png`,
      description: level.description ?? '',
      budget:      level.budget ?? { gold: 0, aura: 0 },
      debuff:      levelDebuff(level),
    },
    matrices,
  };
}

// ─── Write files ─────────────────────────────────────────────────────────────
const levelsDir = path.join(outDir, 'levels');
const cardsDir  = path.join(outDir, 'json', 'cards');
fs.mkdirSync(levelsDir, { recursive: true });
fs.mkdirSync(cardsDir,  { recursive: true });

// Cards
const allCards = [...(data.spellCatalog ?? []), ...(data.obryadCatalog ?? [])];
for (const card of allCards) {
  const filename = `card-${card.id.toLowerCase().replace(/_/g, '-')}.json`;
  fs.writeFileSync(
    path.join(cardsDir, filename),
    JSON.stringify(exportCard(card), null, 2) + '\n',
    'utf8'
  );
}

// Levels (only non-hidden)
const visibleLevels = (data.levelCatalog ?? []).filter(l => !l.hidden);
visibleLevels.forEach((level, idx) => {
  const filename = `level_${idx + 1}.json`;
  fs.writeFileSync(
    path.join(levelsDir, filename),
    JSON.stringify(exportLevel(level, idx), null, 2) + '\n',
    'utf8'
  );
});

console.log(`✅ Cocos export complete → ${outDir}`);
console.log(`   ${allCards.length} cards  →  ${cardsDir}`);
console.log(`   ${visibleLevels.length} levels →  ${levelsDir}`);
console.log('');
console.log('Copy to Cocos repo:');
console.log(`   cp -r ${outDir}/levels/* assets/resources/levels/`);
console.log(`   cp -r ${outDir}/json/cards/* assets/resources/json/cards/`);
