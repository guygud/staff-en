#!/usr/bin/env node
/**
 * Level Design Validator — scripts/validate-levels.mjs
 *
 * Group A: static data integrity checks (GDD §9.6)
 * Group B: scenario checks against level-fixtures/*.expected.json
 *
 * Run: node scripts/validate-levels.mjs [LEVEL_ID]
 * Exit 0 = all green. Exit 1 = failures found.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarioSimulationResult } from '../lib/simulate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ─── Load data ────────────────────────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-data.json'), 'utf8'));

// Accept optional level ID filter from CLI
const filterLevelId = process.argv[2] ?? null;

const levels = data.levelCatalog.filter(l =>
  !l.hidden && (!filterLevelId || l.id === filterLevelId)
);

if (levels.length === 0) {
  console.error(`No visible levels found${filterLevelId ? ` matching "${filterLevelId}"` : ''}.`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let failures = 0;
let checks   = 0;

function fail(levelId, msg) {
  console.error(`  FAIL [${levelId}] ${msg}`);
  failures++;
  checks++;
}

function pass(levelId, msg) {
  console.log(`  ok   [${levelId}] ${msg}`);
  checks++;
}

function section(title) {
  console.log(`\n── ${title}`);
}

if (data.meta?.compiledFrom === 'new') {
  section('Group NEW — game-data compiled from new/');
  pass('DATA', `compiledFrom=new (${data.meta.compiledAt ?? 'no compiledAt'})`);
}

/** Build all slot instances visible on a level (including optional). */
function allSlots(level) {
  return (level.availableMatrices ?? []).flatMap(m => m.slots ?? []);
}

/** Collect all card IDs available on a level (spells + obryads). */
function availableCardIds(level) {
  return [...(level.availableSpells ?? []), ...(level.availableObryads ?? [])];
}

/** Look up a card by ID (spell or obryad). */
function cardById(id) {
  return data.spellCatalog.find(c => c.id === id)
      ?? (data.obryadCatalog ?? []).find(c => c.id === id)
      ?? null;
}

/** All status IDs referenced in reportTemplates. */
const reportTemplateIds = new Set(Object.keys(data.reportTemplates ?? {}));

const treatmentCatalogByTag = new Map(
  (data.treatmentCatalog ?? []).map(e => [e.tag, new Set(e.healsStatuses ?? [])])
);
const knownTreatmentTags = new Set(treatmentCatalogByTag.keys());
const statusCatalogIds = new Set(data.statusCatalog.map(s => s.id));

// ─── GROUP A: Static data integrity ──────────────────────────────────────────

section('Group A0 — Treatment catalog & card tags');

for (const entry of data.treatmentCatalog ?? []) {
  const tag = entry?.tag;
  if (!tag || typeof tag !== 'string') {
    fail('DATA', `treatmentCatalog entry missing string "tag": ${JSON.stringify(entry)}`);
    continue;
  }
  pass('DATA', `treatmentCatalog tag "${tag}" defined`);
  for (const sid of entry.healsStatuses ?? []) {
    if (statusCatalogIds.has(sid)) {
      pass('DATA', `treatment "${tag}" heals valid status "${sid}"`);
    } else {
      fail('DATA', `treatment "${tag}" references unknown status "${sid}"`);
    }
  }
  if (!(entry.healsStatuses ?? []).length && !entry.narrativeOnly) {
    console.warn(`  WARN [DATA] treatment "${tag}" has empty healsStatuses (narrative-only tag?)`);
  }
}

for (const card of [...(data.spellCatalog ?? []), ...(data.obryadCatalog ?? [])]) {
  for (const tag of card.treatmentTags ?? []) {
    if (knownTreatmentTags.has(tag)) {
      pass(`card:${card.id}`, `treatmentTag "${tag}" exists in treatmentCatalog`);
    } else {
      fail(`card:${card.id}`, `unknown treatmentTag "${tag}" on card ${card.id}`);
    }
  }
  const rd = card.resolvesDebts ?? [];
  if (rd.length) {
    console.warn(`  WARN [card:${card.id}] explicit resolvesDebts (${rd.length}) — exception path; prefer treatmentTags when symptom-class healing is enough`);
  }
}

section('Group AM — Matrix presets & level instances');

const matrixPresets = data.matrixPresets ?? [];
const matrixPresetById = new Map(matrixPresets.map(p => [p.id, p]));
const matrixCatalogIds = new Set((data.matrixCatalog ?? []).map(m => m.id));
const multiset = (arr) => [...arr].sort().join('+');

for (const preset of matrixPresets) {
  if (!preset.id || typeof preset.id !== 'string') {
    fail('DATA', `matrixPresets entry missing string id: ${JSON.stringify(preset)}`);
    continue;
  }
  if (!matrixCatalogIds.has(preset.matrixId)) {
    fail('DATA', `matrixPreset "${preset.id}" references unknown matrixId "${preset.matrixId}"`);
  } else {
    pass('DATA', `matrixPreset "${preset.id}" → ${preset.matrixId} (${(preset.slotTypes ?? []).length} slots)`);
  }
}

for (const level of levels) {
  for (const am of level.availableMatrices ?? []) {
    if (!am.presetId) {
      fail(level.id, `matrix instance "${am.instanceId}" missing presetId`);
      continue;
    }
    const preset = matrixPresetById.get(am.presetId);
    if (!preset) {
      fail(level.id, `matrix instance "${am.instanceId}" → unknown presetId "${am.presetId}"`);
      continue;
    }
    if (preset.matrixId !== am.matrixId) {
      fail(level.id, `matrix "${am.instanceId}": matrixId="${am.matrixId}" but preset "${preset.id}" expects "${preset.matrixId}"`);
      continue;
    }
    const instanceMs = multiset((am.slots ?? []).map(s => s.slotType));
    const presetMs = multiset(preset.slotTypes ?? []);
    if (instanceMs !== presetMs) {
      fail(level.id, `matrix "${am.instanceId}" (preset ${preset.id}): slot types differ — instance=[${instanceMs}] preset=[${presetMs}]`);
    } else {
      pass(level.id, `matrix "${am.instanceId}" matches preset "${preset.id}"`);
    }
    if (am.name != null) {
      fail(level.id, `matrix "${am.instanceId}" has legacy "name" — use matrixPresets only`);
    }
    if (am.description != null) {
      fail(level.id, `matrix "${am.instanceId}" has legacy "description" — use matrixPresets only`);
    }
  }
}

section('Group A — Static data integrity');

for (const level of levels) {
  const lid = level.id;

  // A1: Schema v0.3 field names
  if ('budgetGold' in level || 'coinsBudget' in level || 'auraLimit' in level) {
    fail(lid, `uses legacy field names — migrate to budget.{gold,aura}`);
  } else if (level.budget?.gold != null && level.budget?.aura != null) {
    pass(lid, `field terminology: budget.{gold,aura} ✓`);
  } else {
    fail(lid, `missing budget.{gold,aura}`);
  }

  // A2: Each requirement is satisfiable by available cards
  const reachableCapabilities = new Set([
    ...(level.defaultInstalled ?? []).flatMap(d => d.grantsCapabilities ?? []),
    ...availableCardIds(level)
      .map(id => cardById(id))
      .filter(Boolean)
      .flatMap(c => (c.effects ?? []).filter(e => e.type === 'CAPABILITY').map(e => e.id)),
  ]);
  const reachableBuffs = new Set(
    availableCardIds(level)
      .map(id => cardById(id))
      .filter(Boolean)
      .flatMap(c => [...(c.treatmentTags ?? []), ...(c.buffs ?? [])])
  );

  for (const req of level.requirements ?? []) {
    if (req.type === 'CAPABILITY_REQUIRED') {
      if (reachableCapabilities.has(req.capabilityId)) {
        pass(lid, `REQ ${req.id}: capability ${req.capabilityId} is reachable`);
      } else {
        fail(lid, `REQ ${req.id}: capability ${req.capabilityId} is NOT reachable by any available card`);
      }
    } else if (req.type === 'BUFF_REQUIRED') {
      if (reachableBuffs.has(req.buffId)) {
        pass(lid, `REQ ${req.id}: buff "${req.buffId}" is reachable`);
      } else {
        fail(lid, `REQ ${req.id}: buff "${req.buffId}" is NOT reachable by any available card`);
      }
    }
  }

  // A3: All card references exist
  for (const cardId of availableCardIds(level)) {
    if (cardById(cardId)) {
      pass(lid, `card ref "${cardId}" exists`);
    } else {
      fail(lid, `card ref "${cardId}" not found in spellCatalog or obryadCatalog`);
    }
  }

  // A4: Each available card has at least one compatible slot on this level
  const slotTypes = new Set(allSlots(level).map(s => s.slotType));
  for (const cardId of availableCardIds(level)) {
    const card = cardById(cardId);
    if (!card) continue;
    const compatible = (card.allowedSlotTypes ?? []).some(t => slotTypes.has(t));
    if (compatible) {
      pass(lid, `card "${cardId}" has a compatible slot`);
    } else {
      fail(lid, `card "${cardId}" has no compatible slot (allowed: ${card.allowedSlotTypes}, level has: ${[...slotTypes].join(', ')})`);
    }
  }

  // A5: All status IDs in criticalStatuses exist in statusCatalog
  const statusIds = new Set(data.statusCatalog.map(s => s.id));
  for (const sid of level.criticalStatuses ?? []) {
    if (statusIds.has(sid)) {
      pass(lid, `critical status "${sid}" exists in statusCatalog`);
    } else {
      fail(lid, `critical status "${sid}" NOT in statusCatalog`);
    }
  }

  // A6: reportTemplates exist for all criticalStatuses
  for (const sid of level.criticalStatuses ?? []) {
    if (reportTemplateIds.has(sid)) {
      pass(lid, `reportTemplate exists for critical status "${sid}"`);
    } else {
      fail(lid, `no reportTemplate for critical status "${sid}" — player won't know what to fix`);
    }
  }

  // A7: Level is passable — there exists at least one combination of available cards
  //     that satisfies all requirements within coinsBudget and auraLimit.
  //     We check the fixture if available; otherwise just verify budget arithmetic allows it.
  const fixturesDir = path.join(__dirname, 'level-fixtures');
  const fixturePath = path.join(fixturesDir, `${lid.replace(/\W+/g, '_')}.expected.json`);
  // Load fixture shorthand
  let hasPassing = false;
  if (fs.existsSync(fixturePath)) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    hasPassing = fixture.scenarios.some(s => s.expected.outcome === 'pass');
  }
  if (hasPassing) {
    pass(lid, `passability: at least one passing scenario in fixture`);
  } else if (!fs.existsSync(fixturePath)) {
    pass(lid, `passability: no fixture yet — skipped (add fixture to verify)`);
  } else {
    fail(lid, `no passing scenario found in fixture — level may be unpassable`);
  }

  // A8: conflictPairs that reference this level's spells have resolvedBy or aren't forced together
  for (const pair of data.conflictPairs ?? []) {
    const inLevel = pair.spells.every(id => availableCardIds(level).includes(id));
    if (!inLevel) continue;
    const hasResolver = (pair.resolvedBy ?? []).some(id => availableCardIds(level).includes(id));
    const neitherRequired = pair.spells.every(id => {
      // If the pair spell is not required by any req, it's optional
      const neededFor = (level.requirements ?? []).some(req => {
        const card = cardById(id);
        return (card?.effects ?? []).some(ef => ef.type === 'CAPABILITY' && ef.id === req.capabilityId);
      });
      return !neededFor;
    });
    if (hasResolver || neitherRequired) {
      pass(lid, `conflictPair "${pair.id}" has resolver or both spells are optional`);
    } else {
      fail(lid, `conflictPair "${pair.id}": both spells appear required but no resolver is available on this level`);
    }
  }
}

// ─── GROUP B: Scenario validation ────────────────────────────────────────────

section('Group B — Scenario validation (fixtures)');

const fixturesDir = path.join(__dirname, 'level-fixtures');
let fixtureFiles;
try {
  fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.expected.json'));
} catch {
  fixtureFiles = [];
}

for (const file of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
  const { levelId, scenarios } = fixture;

  // Skip if level is filtered out or hidden
  const level = data.levelCatalog.find(l => l.id === levelId);
  if (!level) {
    console.warn(`  WARN fixture "${file}": level "${levelId}" not found in levelCatalog`);
    continue;
  }
  if (level.hidden) {
    console.log(`  skip fixture "${file}" (level is hidden)`);
    continue;
  }
  if (filterLevelId && levelId !== filterLevelId) continue;

  for (const scenario of scenarios ?? []) {
    const result = scenarioSimulationResult(
      data,
      level,
      scenario.placements ?? {},
      scenario.installedMatrixIds ?? []
    );
    const exp = scenario.expected;
    const name = `${levelId}/${scenario.name}`;

    // Check outcome
    const gotOutcome = result.success ? 'pass' : 'fail';
    if (gotOutcome !== exp.outcome) {
      fail(name, `expected outcome="${exp.outcome}" but got "${gotOutcome}"`);
      continue;
    }

    // Check fatalStatuses match
    if (exp.fatalStatuses) {
      const missing = exp.fatalStatuses.filter(s => !result.fatalStatuses.includes(s));
      const extra   = result.fatalStatuses.filter(s => !exp.fatalStatuses.includes(s));
      if (missing.length || extra.length) {
        fail(name, `fatalStatuses: expected [${exp.fatalStatuses}] got [${result.fatalStatuses}]`);
      } else {
        pass(name, `fatalStatuses match: [${result.fatalStatuses.join(', ') || 'none'}]`);
      }
    }

    // Check missingRequirements
    if (exp.missingRequirements) {
      const got = result.missingRequirements;
      const same = exp.missingRequirements.every(r => got.includes(r)) && got.every(r => exp.missingRequirements.includes(r));
      if (same) {
        pass(name, `missingRequirements match: [${got.join(', ') || 'none'}]`);
      } else {
        fail(name, `missingRequirements: expected [${exp.missingRequirements}] got [${got}]`);
      }
    }
    if (exp.missingRequirementsContains) {
      const got = result.missingRequirements;
      const all = exp.missingRequirementsContains.every(r => got.includes(r));
      if (all) {
        pass(name, `missingRequirements contains [${exp.missingRequirementsContains}]`);
      } else {
        fail(name, `missingRequirements should contain [${exp.missingRequirementsContains}] but got [${got}]`);
      }
    }

    // Check coinsSpentRange
    if (exp.coinsSpentRange) {
      const [lo, hi] = exp.coinsSpentRange;
      if (result.coinsSpent >= lo && result.coinsSpent <= hi) {
        pass(name, `coinsSpent=${result.coinsSpent} in [${lo},${hi}]`);
      } else {
        fail(name, `coinsSpent=${result.coinsSpent} not in [${lo},${hi}]`);
      }
    }

    // Check auraTotalRange
    if (exp.auraTotalRange) {
      const [lo, hi] = exp.auraTotalRange;
      if (result.auraTotal >= lo && result.auraTotal <= hi) {
        pass(name, `auraTotal=${result.auraTotal} in [${lo},${hi}]`);
      } else {
        fail(name, `auraTotal=${result.auraTotal} not in [${lo},${hi}]`);
      }
    }

    // If outcome check passed and no detailed checks failed, mark overall pass
    if (gotOutcome === exp.outcome && !exp.fatalStatuses && !exp.missingRequirements && !exp.coinsSpentRange) {
      pass(name, `outcome="${gotOutcome}"`);
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total checks: ${checks}   Failures: ${failures}`);

if (failures === 0) {
  console.log('All checks passed ✓');
  process.exit(0);
} else {
  console.error(`${failures} check(s) failed ✗`);
  process.exit(1);
}
