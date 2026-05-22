#!/usr/bin/env node
/**
 * Compile game-data.json from designer CSVs in new/
 * Run from repo root: node scripts/build-game-data.mjs
 *
 * Reads current game-data.json as baseline (IDs, levels wiring, conflictPairs),
 * overlays: treatmentCatalog, status icons/names, spells/obryads, matrix presets,
 * level narrative/budget/success, criticalStatuses + defaultInstalled from heritage CSV.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEW = path.join(ROOT, 'new');

const F = {
  debuffs: 'Алхимия систем - Дебафы.csv',
  buffs: 'Алхимия систем - Бафы.csv',
  spells: 'Алхимия систем - Заклинания.csv',
  obryads: 'Алхимия систем - Обряды.csv',
  matrices: 'Алхимия систем - Матрицы.csv',
  narrative: 'Алхимия систем - Уровни - нарратив.csv',
  heritage: 'Алхимия систем - Наследственные дебафы.csv',
  levelMatrices: 'Алхимия систем - Уровни - матрицы.csv',
};

function readCsv(name) {
  const p = path.join(NEW, name);
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
  return fs.readFileSync(p, 'utf8');
}

/** Minimal RFC-style CSV row parser (handles "quoted, fields"). */
function parseCsv(text) {
  const lines = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim()) lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur);

  if (lines.length === 0) return [];

  function splitRow(line) {
    const cells = [];
    let cell = '';
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        q = !q;
      } else if (!q && c === ',') {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  }

  const headers = splitRow(lines[0]).map(h => h.replace(/^\ufeff/, '').trim());
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitRow(lines[li]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function splitPipe(s) {
  if (!s || !String(s).trim()) return [];
  return String(s).split(/\s*\|\s*/).map(x => x.trim()).filter(Boolean);
}

/** Strip leading emoji / punctuation before symptom name (e.g. "🙈 Слепота" → "Слепота"). */
function stripSymptomLabel(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/[А-Яа-яЁёA-Za-z0-9].*$/);
  return m ? m[0].trim() : s;
}

function loadBaseline() {
  const p = path.join(ROOT, 'game-data.json');
  const base = JSON.parse(fs.readFileSync(p, 'utf8'));
  delete base.meta?.compiledFrom;
  delete base.meta?.compiledAt;
  delete base.meta?.compileNote;
  augmentStatusCatalogFromSymptomsExport(base);
  restoreCriticalStatusesFromLevelsExport(base);
  restoreMatrixInstallCostsFromInstancesExport(base);
  restoreDefaultInstalledFromExport11(base);
  return base;
}

/** Rebuild level.defaultInstalled from exports/csv/11_level_default_installed.csv + inheritedDebtCatalog */
function restoreDefaultInstalledFromExport11(base) {
  const csvPath = path.join(ROOT, 'exports/csv/11_level_default_installed.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[build] no exports/csv/11_level_default_installed.csv — defaultInstalled not restored');
    return;
  }
  const debtById = new Map(
    (base.inheritedDebtCatalog ?? []).map(d => [
      d.id,
      { id: d.id, statusIfUnresolved: d.statusIfUnresolved },
    ])
  );
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const byLevel = new Map();
  for (const row of rows) {
    const lid = (row.level_id ?? '').trim();
    const bi = Number(row.block_index);
    if (!lid || !Number.isFinite(bi)) continue;
    const debtIds = splitPipe(row.adds_debt_ids ?? '').map(s => s.trim()).filter(Boolean);
    const grants = splitPipe(row.grants_capabilities ?? '').map(s => s.trim()).filter(Boolean);
    const addsDebts = [];
    for (const did of debtIds) {
      const o = debtById.get(did);
      if (!o) throw new Error(`[build] export 11: unknown debt id "${did}" for ${lid}`);
      addsDebts.push({ ...o });
    }
    const block = {
      ...(row.note ? { note: row.note } : {}),
      ...(grants.length ? { grantsCapabilities: grants } : {}),
      addsDebts,
    };
    if (!byLevel.has(lid)) byLevel.set(lid, new Map());
    byLevel.get(lid).set(bi, block);
  }
  for (const lvl of base.levelCatalog ?? []) {
    const m = byLevel.get(lvl.id);
    if (!m || m.size === 0) continue;
    const indices = [...m.keys()].sort((a, b) => a - b);
    lvl.defaultInstalled = indices.map(i => m.get(i));
  }
}

/** Restore optional-matrix install prices from exports/csv/09_level_matrix_instances.csv */
function restoreMatrixInstallCostsFromInstancesExport(base) {
  const csvPath = path.join(ROOT, 'exports/csv/09_level_matrix_instances.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[build] no exports/csv/09_level_matrix_instances.csv — matrix install costs not restored');
    return;
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  for (const row of rows) {
    const lid = (row.level_id ?? '').trim();
    const iid = (row.instance_id ?? '').trim();
    const lvl = (base.levelCatalog ?? []).find(l => l.id === lid);
    const inst = lvl?.availableMatrices?.find(m => m.instanceId === iid);
    if (!inst) continue;
    const c = Number(row.install_cost_gold);
    if (Number.isFinite(c)) inst.installCostGold = c;
  }
}

/** Merge missing statuses from exports/csv/02_statuses_symptoms.csv (full F1–F16 names). */
function augmentStatusCatalogFromSymptomsExport(base) {
  const csvPath = path.join(ROOT, 'exports/csv/02_statuses_symptoms.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[build] no exports/csv/02_statuses_symptoms.csv — status catalog not augmented');
    return;
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const byId = new Map((base.statusCatalog ?? []).map(s => [s.id, { ...s }]));
  for (const row of rows) {
    const id = (row.status_id ?? '').trim();
    if (!id) continue;
    const hints = splitPipe(row.report_hints ?? '').filter(Boolean);
    const cur = byId.get(id) ?? { id };
    if (row.name) cur.name = row.name.trim();
    if (row.icon) cur.icon = row.icon.trim();
    if (hints.length) cur.reportHints = hints;
    byId.set(id, cur);
  }
  base.statusCatalog = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Restore campaign criticalStatuses from exports/csv/07_levels.csv (machine IDs). */
function restoreCriticalStatusesFromLevelsExport(base) {
  const csvPath = path.join(ROOT, 'exports/csv/07_levels.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[build] no exports/csv/07_levels.csv — criticalStatuses not restored from export');
    return;
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const byLevel = new Map(rows.map(r => [(r.level_id ?? '').trim(), r]).filter(([k]) => k));
  for (const lvl of base.levelCatalog ?? []) {
    const row = byLevel.get(lvl.id);
    if (!row?.critical_status_ids) continue;
    const ids = splitPipe(row.critical_status_ids);
    if (ids.length) lvl.criticalStatuses = ids;
  }
}

function buildStatusNameToId(baseline) {
  const m = new Map();
  for (const s of baseline.statusCatalog ?? []) {
    m.set(s.name.trim(), s.id);
  }
  return m;
}

function applyDebuffsCsv(data, rows, nameToId) {
  const byId = new Map((data.statusCatalog ?? []).map(s => [s.id, { ...s }]));
  for (const row of rows) {
    const nm = (row.name ?? '').trim();
    const id = nameToId.get(nm);
    if (!id) {
      console.warn(`[build] debuffs: unknown status name "${nm}" — skip`);
      continue;
    }
    const cur = byId.get(id) ?? { id, name: nm };
    if (row.icon) cur.icon = row.icon.trim();
    cur.name = nm;
    byId.set(id, cur);
  }
  return [...byId.values()];
}

function applyBuffsCsv(data, rows, nameToId) {
  const byTag = new Map(
    (data.treatmentCatalog ?? []).map(e => [e.tag, { ...e }])
  );
  for (const row of rows) {
    const tag = (row.treatment_tag ?? '').trim();
    if (!tag) continue;
    const healsNames = splitPipe(row.heals_status_names ?? '');
    const healsStatuses = [];
    for (const hn of healsNames) {
      const sid = nameToId.get(hn);
      if (!sid) {
        throw new Error(`[build] бафы: unknown symptom name "${hn}" for tag "${tag}"`);
      }
      healsStatuses.push(sid);
    }
    const prev = byTag.get(tag) ?? { tag };
    byTag.set(tag, {
      ...prev,
      tag,
      healsStatuses,
    });
  }
  const order = [...(data.treatmentCatalog ?? []).map(e => e.tag)];
  const seen = new Set();
  const out = [];
  for (const tag of order) {
    if (byTag.has(tag)) {
      out.push(byTag.get(tag));
      seen.add(tag);
    }
  }
  for (const [tag, v] of byTag) {
    if (!seen.has(tag)) out.push(v);
  }
  return out;
}

function mergeCardFromDesignerRow(card, row, nameToId) {
  const gold = Number(row.gold);
  const aura = Number(row.aura);
  if (Number.isFinite(gold)) {
    card.currencies = { ...(card.currencies ?? {}), gold, aura: Number.isFinite(aura) ? aura : card.currencies?.aura ?? 0 };
  }
  const slots = splitPipe(row.allowed_slot_types ?? '');
  if (slots.length) card.allowedSlotTypes = slots;

  const tags = splitPipe(row.cell_treatment_tags ?? '');
  card.treatmentTags = tags.length ? tags : (card.treatmentTags ?? []);

  if (row.aura_limit_delta != null && row.aura_limit_delta !== '') {
    const d = Number(row.aura_limit_delta);
    if (Number.isFinite(d)) card.auraLimitDelta = d;
  }

  if (row.description) card.description = row.description.trim();

  const d1 = stripSymptomLabel(row.cell_debuff_1);
  const d2 = stripSymptomLabel(row.cell_debuff_2);
  const debuffNames = [d1, d2].filter(Boolean);
  const baselineDebts = [...(card.addsDebts ?? [])];

  if (debuffNames.length === 0) {
    return card;
  }

  const newDebts = [];
  for (let i = 0; i < debuffNames.length; i++) {
    const nm = debuffNames[i];
    const sid = nameToId.get(nm);
    if (!sid) throw new Error(`[build] card "${card.name}": unknown debuff symptom "${nm}"`);
    const same = baselineDebts.find(d => d.statusIfUnresolved === sid);
    if (same) {
      newDebts.push({ ...same });
    } else {
      newDebts.push({
        id: `D_${card.id}_${i}_${sid}`,
        statusIfUnresolved: sid,
      });
    }
  }
  card.addsDebts = newDebts;
  return card;
}

function applySpellsCsv(data, rows, nameToId) {
  const byName = new Map((data.spellCatalog ?? []).map(c => [c.name.trim(), c]));
  for (const row of rows) {
    const nm = (row.name ?? '').trim();
    if (!nm) continue;
    const card = byName.get(nm);
    if (!card) {
      console.warn(`[build] заклинания: no baseline card named "${nm}" — skip`);
      continue;
    }
    mergeCardFromDesignerRow(card, row, nameToId);
  }
}

function applyObryadsCsv(data, rows, nameToId) {
  const byName = new Map((data.obryadCatalog ?? []).map(c => [c.name.trim(), c]));
  for (const row of rows) {
    const nm = (row.name ?? '').trim();
    if (!nm) continue;
    const card = byName.get(nm);
    if (!card) {
      console.warn(`[build] обряды: no baseline card named "${nm}" — skip`);
      continue;
    }
    mergeCardFromDesignerRow(card, row, nameToId);
  }
}

/**
 * Уровни - матрицы.csv → maxOptionalMatrices и preInstalled у инстансов.
 * preset=yes: preset_matrix — список preset_id, всегда на поле; остальные инстансы — опциональны.
 * preset=no: все инстансы опциональны; max_matrix = лимит одновременно на поле.
 */
function applyLevelMatricesCsv(levelsById, rows) {
  function parsePresetList(cell) {
    if (!cell || !String(cell).trim()) return [];
    let s = String(cell).trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
    return s.split(',').map(x => x.trim()).filter(Boolean);
  }

  for (const row of rows) {
    const lid = (row['Уровень'] ?? row.level_id ?? '').trim();
    if (!lid) continue;
    const lvl = levelsById.get(lid);
    if (!lvl) {
      console.warn(`[build] level-matrices: unknown level "${lid}"`);
      continue;
    }
    const maxMRaw = parseInt(String(row.max_matrix ?? '').trim(), 10);
    const maxM = Number.isFinite(maxMRaw) && maxMRaw > 0 ? maxMRaw : 0;
    const presetRaw = String(row.preset ?? '').trim().toLowerCase();
    const presetYes = presetRaw === 'yes' || presetRaw === 'да';
    const fixedPresets = new Set(parsePresetList(row.preset_matrix));
    const mats = [...(lvl.availableMatrices ?? [])];
    let preCount = 0;
    for (const m of mats) {
      const pid = (m.presetId ?? '').trim();
      if (presetYes && fixedPresets.has(pid)) {
        m.preInstalled = true;
        preCount++;
      } else {
        m.preInstalled = false;
      }
    }
    if (presetYes && fixedPresets.size > 0) {
      for (const pid of fixedPresets) {
        if (!mats.some(m => (m.presetId ?? '').trim() === pid)) {
          console.warn(`[build] level-matrices ${lid}: preset "${pid}" not found on level`);
        }
      }
    }
    const maxOpt = Math.max(0, maxM - preCount);
    lvl.maxOptionalMatrices = maxOpt;
    if (maxM > 0 && maxM < preCount) {
      console.warn(`[build] level-matrices ${lid}: max_matrix (${maxM}) < preinstalled (${preCount}) — maxOptionalMatrices=0`);
    }
  }
}

function applyMatricesCsv(data, rows) {
  const presets = data.matrixPresets ?? [];
  const byId = new Map(presets.map(p => [p.id, { ...p }]));
  for (const row of rows) {
    const id = (row.preset_id ?? '').trim();
    if (!id) continue;
    const cur = byId.get(id);
    if (!cur) {
      console.warn(`[build] matrices: unknown preset "${id}" — skip`);
      continue;
    }
    if (row.preset_name) cur.name = row.preset_name.trim();
    if (row.description) cur.description = row.description.trim();
    const st = [];
    for (let k = 1; k <= 5; k++) {
      const v = (row[`slot_type_${k}`] ?? '').trim();
      if (v) st.push(v);
    }
    if (st.length) cur.slotTypes = st;
    byId.set(id, cur);
  }
  data.matrixPresets = [...byId.values()];
}

function applyNarrativeCsv(levelsById, rows) {
  for (const row of rows) {
    const lid = (row.level_id ?? '').trim();
    const lvl = levelsById.get(lid);
    if (!lvl) continue;
    if (row.name) lvl.name = row.name.trim();
    if (row.client_name) lvl.clientName = row.client_name.trim();
    if (row.intro_description) lvl.description = row.intro_description.trim();
    const g = Number(row.budget_gold);
    const a = Number(row.budget_aura);
    if (Number.isFinite(g) && Number.isFinite(a)) {
      lvl.budget = { gold: g, aura: a };
    }
    const s1 = (row.success_text_1 ?? '').trim();
    const s2 = (row.success_text_2 ?? '').trim();
    if (s1 || s2) {
      lvl.successReports = [s1, s2].filter(Boolean);
    }
  }
}

/**
 * Heritage CSV → union extra symptoms into criticalStatuses (designer intent).
 * Does not mutate defaultInstalled — mechanical debts stay from baseline/export.
 */
/**
 * Только то, что есть в new/*.csv — для UI плейтеста (брифинг / сайдбар).
 * Не влияет на симуляцию: движок по-прежнему читает level.* из JSON.
 */
function buildPlaytestBrief(narrativeRows, heritageRows) {
  const byLevel = new Map();
  for (const row of narrativeRows) {
    const lid = (row.level_id ?? '').trim();
    if (!lid) continue;
    const g = Number(row.budget_gold);
    const a = Number(row.budget_aura);
    const itemRaw = row.Item ?? row.item ?? '';
    byLevel.set(lid, {
      order: Number(row.order) || 0,
      name: (row.name ?? '').trim(),
      clientName: (row.client_name ?? '').trim(),
      item: String(itemRaw).trim(),
      description: (row.intro_description ?? '').trim(),
      budget: {
        gold: Number.isFinite(g) ? g : 0,
        aura: Number.isFinite(a) ? a : 0,
      },
      successReports: [row.success_text_1, row.success_text_2]
        .map(s => (s ?? '').trim())
        .filter(Boolean),
      requirementsDisplay: [],
      hintsDisplay: [],
      inheritedDebuffLabels: [],
    });
  }
  for (const row of heritageRows) {
    const lid = (row.level_id ?? '').trim();
    const entry = byLevel.get(lid);
    if (!entry) continue;
    entry.inheritedDebuffLabels = [row.debuff_1, row.debuff_2, row.debuff_3]
      .map(s => (s ?? '').trim())
      .filter(Boolean);
  }
  return Object.fromEntries(byLevel);
}

function applyHeritageCsv(baselineLevelsById, levelsById, rows, nameToId) {
  for (const row of rows) {
    const lid = (row.level_id ?? '').trim();
    const lvl = levelsById.get(lid);
    const baseLvl = baselineLevelsById.get(lid);
    if (!lvl || !baseLvl) {
      console.warn(`[build] heritage: unknown level "${lid}"`);
      continue;
    }
    const symptoms = [row.debuff_1, row.debuff_2, row.debuff_3]
      .map(stripSymptomLabel)
      .filter(Boolean);
    const statusIds = [];
    for (const sym of symptoms) {
      const sid = nameToId.get(sym);
      if (!sid) throw new Error(`[build] heritage ${lid}: unknown symptom "${sym}"`);
      statusIds.push(sid);
    }
    lvl.criticalStatuses = [...new Set([...(baseLvl.criticalStatuses ?? []), ...statusIds])];
  }
}

function main() {
  const baseline = loadBaseline();
  const nameToId = buildStatusNameToId(baseline);
  const mapPath = path.join(ROOT, 'scripts', 'new-mappings.json');
  if (fs.existsSync(mapPath)) {
    const alias = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    for (const [nm, id] of Object.entries(alias.statusNameAliases ?? {})) {
      nameToId.set(nm.trim(), id);
    }
  }

  const debuffRows = parseCsv(readCsv(F.debuffs));
  const buffRows = parseCsv(readCsv(F.buffs));
  const spellRows = parseCsv(readCsv(F.spells));
  const obryadRows = parseCsv(readCsv(F.obryads));
  const matrixRows = parseCsv(readCsv(F.matrices));
  const narrativeRows = parseCsv(readCsv(F.narrative));
  const heritageRows = parseCsv(readCsv(F.heritage));
  const levelMatRows = parseCsv(readCsv(F.levelMatrices));

  const out = JSON.parse(JSON.stringify(baseline));

  out.statusCatalog = applyDebuffsCsv(out, debuffRows, nameToId);
  out.treatmentCatalog = applyBuffsCsv(out, buffRows, nameToId);
  applySpellsCsv(out, spellRows, nameToId);
  applyObryadsCsv(out, obryadRows, nameToId);
  applyMatricesCsv(out, matrixRows);

  const levelsById = new Map((out.levelCatalog ?? []).map(l => [l.id, l]));
  const baselineLevelsById = new Map((baseline.levelCatalog ?? []).map(l => [l.id, l]));

  applyNarrativeCsv(levelsById, narrativeRows);
  applyHeritageCsv(baselineLevelsById, levelsById, heritageRows, nameToId);
  applyLevelMatricesCsv(levelsById, levelMatRows);

  out.meta = {
    ...(out.meta ?? {}),
    compiledFrom: 'new',
    compiledAt: new Date().toISOString(),
    compileNote: 'Built by scripts/build-game-data.mjs from new/*.csv; IDs and wiring from previous game-data baseline.',
    playtestBrief: buildPlaytestBrief(narrativeRows, heritageRows),
  };

  const outPath = path.join(ROOT, 'game-data.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
