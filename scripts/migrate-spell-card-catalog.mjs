#!/usr/bin/env node
/**
 * Build spellCardCatalog + inheritedDebtCatalog from legacy spellCatalog.
 * Does not modify spellCatalog (engine / validator keep reading it).
 *
 * Run: node scripts/migrate-spell-card-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'game-data.json');

const INHERITED_NARRATIVE = {
  D_AUDIT_NEEDED: 'Наследственный долг уровня: нужен аудит доступа, не путать с переполнением от объёма логов карты.',
  D_NO_OBSERVABILITY: 'Наследственный долг уровня: система слепа до появления наблюдаемости.',
  D_HIDDEN_NODES: 'Наследственный долг уровня: узлы не обнаружены; лечится явной привязкой, не симптом-классом.',
  D_NEEDS_HEALTHCHECK: 'Долг от соседней карты (Discovery) или уровня: нужен healthcheck, не путать с перегрузкой от Traffic Split.',
  D_SPLIT_OVERLOAD: 'Долг от Traffic Split: перегрузка после разделения потоков.',
  D_REBALANCE_WINDOW: 'Долг от Rebalancer: окно перераспределения без проверки миграции.',
  D_BACKFILL_UNVERIFIED: 'Долг от Schema Guard: backfill не проверен dry-run.',
  D_COLD_SHARD: 'Долг от Shard Fence: замороженный шард; лечится Зондом, не общим «Живостью».',
  D_NEEDS_MIGRATION: 'Долг от Schema Guard: требуется миграция перед пайплайном.',
  D_NEEDS_ROLLBACK: 'Долг от CI/CD без отката: релиз без пути назад.',
  D_FAILOVER_LOOP: 'Наследственный долг уровня: петля failover между DC.',
  D_UNTESTED_FAILOVER: 'Долг от Global Healthcheck: failover не обкатан DR-учением.',
};

/** Pairs where inherited debt must stay narratively distinct from this card's own debuff. */
const DISTINCT_FROM = {
  D_AUDIT_NEEDED: ['D_ACCESS_LOG_VOLUME'],
  D_NEEDS_HEALTHCHECK: ['D_SPLIT_OVERLOAD'],
};

function firstIntroducedLevel(data, cardId, pool = 'spells') {
  let best = null;
  let bestOrder = Infinity;
  for (const lvl of data.levelCatalog ?? []) {
    const list = pool === 'obryads' ? (lvl.availableObryads ?? []) : (lvl.availableSpells ?? []);
    if (!list.includes(cardId)) continue;
    const o = lvl.order ?? 9999;
    if (o < bestOrder) {
      bestOrder = o;
      best = lvl.id;
    }
  }
  return best;
}

function debtSource(data, debtId) {
  const levelSources = [];
  for (const lvl of data.levelCatalog ?? []) {
    for (const inst of lvl.defaultInstalled ?? []) {
      if ((inst.addsDebts ?? []).some((d) => d.id === debtId)) {
        levelSources.push(lvl.id);
      }
    }
  }
  if (levelSources.length) {
    return { origin: 'level', levels: levelSources };
  }
  for (const card of data.spellCatalog ?? []) {
    if ((card.addsDebts ?? []).some((d) => d.id === debtId)) {
      return { origin: 'card', sourceCardId: card.id };
    }
  }
  return { origin: 'unknown', levels: [] };
}

function statusForDebt(data, debtId) {
  for (const c of data.spellCatalog ?? []) {
    const d = (c.addsDebts ?? []).find((x) => x.id === debtId);
    if (d) return d.statusIfUnresolved;
  }
  for (const lvl of data.levelCatalog ?? []) {
    for (const inst of lvl.defaultInstalled ?? []) {
      const d = (inst.addsDebts ?? []).find((x) => x.id === debtId);
      if (d) return d.statusIfUnresolved;
    }
  }
  return null;
}

function buildInheritedDebtCatalog(data) {
  const seen = new Set();
  const entries = [];

  const add = (debtId, extra = {}) => {
    if (seen.has(debtId)) return;
    seen.add(debtId);
    const src = debtSource(data, debtId);
    const status = statusForDebt(data, debtId);
    const row = {
      id: debtId,
      statusIfUnresolved: status,
      origin: src.origin,
      ...(src.levels?.length ? { introducedAtLevels: src.levels } : {}),
      ...(src.sourceCardId ? { sourceCardId: src.sourceCardId } : {}),
      narrative: INHERITED_NARRATIVE[debtId] ?? extra.narrative ?? '',
      ...extra,
    };
    if (DISTINCT_FROM[debtId]) row.distinctFromCardDebts = DISTINCT_FROM[debtId];
    entries.push(row);
  };

  for (const lvl of data.levelCatalog ?? []) {
    for (const inst of lvl.defaultInstalled ?? []) {
      for (const d of inst.addsDebts ?? []) add(d.id);
    }
  }

  for (const card of data.spellCatalog ?? []) {
    const selfAdds = new Set((card.addsDebts ?? []).map((d) => d.id));
    for (const debtId of card.resolvesDebts ?? []) {
      if (!selfAdds.has(debtId)) add(debtId);
    }
  }

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function cardToPropertyCells(card) {
  const tags = [...(card.treatmentTags ?? []), ...(card.buffs ?? [])];
  const selfAdds = card.addsDebts ?? [];
  const selfAddIds = new Set(selfAdds.map((d) => d.id));

  const healsInherited = (card.resolvesDebts ?? [])
    .filter((id) => !selfAddIds.has(id))
    .map((debtId) => ({ debtId }));

  const treatmentCell = {
    kind: 'treatment',
    treatmentTags: tags,
    healsInherited,
  };

  const debuffCells = selfAdds.map((d) => ({
    kind: 'debuff',
    origin: 'card',
    debtId: d.id,
    statusIfUnresolved: d.statusIfUnresolved,
  }));

  while (debuffCells.length < 2) debuffCells.push(null);

  return [treatmentCell, debuffCells[0], debuffCells[1]];
}

function buildSpellCardCatalog(data) {
  return (data.spellCatalog ?? []).map((card) => ({
    id: card.id,
    introducedAtLevel: firstIntroducedLevel(data, card.id, 'spells'),
    name: card.name,
    description: card.description ?? '',
    allowedSlotTypes: card.allowedSlotTypes ?? [],
    unique: card.unique !== false,
    effects: card.effects ?? [],
    currencies: card.currencies ?? { gold: 0, aura: 0 },
    propertyCells: cardToPropertyCells(card),
  }));
}

function buildObryadCardCatalog(data) {
  return (data.obryadCatalog ?? []).map((card) => ({
    id: card.id,
    introducedAtLevel: firstIntroducedLevel(data, card.id, 'obryads'),
    name: card.name,
    description: card.description ?? '',
    allowedSlotTypes: card.allowedSlotTypes ?? [],
    unique: card.unique !== false,
    effects: card.effects ?? [],
    ...(card.auraLimitDelta != null ? { auraLimitDelta: card.auraLimitDelta } : {}),
    currencies: card.currencies ?? { gold: 0, aura: 0 },
    propertyCells: cardToPropertyCells(card),
  }));
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  data.meta = {
    ...data.meta,
    cardCatalogSchema: 'v1-three-cells',
    cardCatalogNote:
      'spellCardCatalog / obryadCardCatalog — дизайн (3 ячейки: лечение + до 2 дебафов). spellCatalog / obryadCatalog — legacy для движка.',
  };

  const inheritedDebtCatalog = buildInheritedDebtCatalog(data);
  const spellCardCatalog = buildSpellCardCatalog(data);
  const obryadCardCatalog = buildObryadCardCatalog(data);

  delete data.inheritedDebtCatalog;
  delete data.spellCardCatalog;
  delete data.obryadCardCatalog;

  const ordered = {};
  for (const key of Object.keys(data)) {
    ordered[key] = data[key];
    if (key === 'matrixPresets') {
      ordered.inheritedDebtCatalog = inheritedDebtCatalog;
      ordered.spellCardCatalog = spellCardCatalog;
      ordered.obryadCardCatalog = obryadCardCatalog;
    }
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(ordered, null, 2) + '\n', 'utf8');

  const spellIntro = spellCardCatalog.filter((c) => c.introducedAtLevel).length;
  const obryadIntro = obryadCardCatalog.filter((c) => c.introducedAtLevel).length;
  console.log(`spellCardCatalog: ${spellCardCatalog.length} (${spellIntro} with level)`);
  console.log(`obryadCardCatalog: ${obryadCardCatalog.length} (${obryadIntro} with level)`);
  console.log(`inheritedDebtCatalog: ${inheritedDebtCatalog.length} entries`);
}

main();
