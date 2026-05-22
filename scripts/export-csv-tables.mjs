#!/usr/bin/env node
/**
 * Экспорт полных таблиц из game-data.json → UTF-8 CSV (с BOM для Excel).
 * Запуск: node scripts/export-csv-tables.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'game-data.json');
const OUT_DIR = path.join(ROOT, 'exports', 'csv');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells) {
  return cells.map(csvEscape).join(',') + '\n';
}

function writeCsv(name, header, rows) {
  const bom = '\uFEFF';
  const body = [row(header), ...rows.map((r) => row(r))].join('');
  fs.writeFileSync(path.join(OUT_DIR, name), bom + body, 'utf8');
}

function main() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const statusById = Object.fromEntries((data.statusCatalog ?? []).map((s) => [s.id, s]));
  const templates = data.reportTemplates ?? {};
  const capLabels = data.capabilityLabels ?? {};

  /** @type {Map<string, Set<string>>} */
  const statusToTreatments = new Map();
  for (const t of data.treatmentCatalog ?? []) {
    const tag = t.tag;
    for (const sid of t.healsStatuses ?? []) {
      if (!statusToTreatments.has(sid)) statusToTreatments.set(sid, new Set());
      statusToTreatments.get(sid).add(tag);
    }
  }

  // ── 01 matrices ──────────────────────────────────────────────────────────
  const maxMatrixSlots = Math.max(
    0,
    ...(data.matrixCatalog ?? []).map((m) => (m.slotTypes ?? []).length),
  );
  const matrixHeader = [
    'matrix_id',
    'name',
    'icon',
    'description',
    'technical_meaning',
    'slot_count',
    ...Array.from({ length: maxMatrixSlots }, (_, i) => `slot_type_${i + 1}`),
  ];
  const matrixRows = (data.matrixCatalog ?? []).map((m) => {
    const slots = m.slotTypes ?? [];
    const pad = Array.from({ length: maxMatrixSlots }, (_, i) => slots[i] ?? '');
    return [
      m.id,
      m.name,
      m.icon ?? '',
      m.description ?? '',
      m.description ?? '',
      slots.length,
      ...pad,
    ];
  });
  writeCsv('01_matrices.csv', matrixHeader, matrixRows);

  // ── 02 statuses (symptoms / debuffs) ────────────────────────────────────
  const statusHeader = [
    'status_id',
    'icon',
    'name',
    'removed_by_treatment_tags',
    'report_hints',
    'fail_text',
    'advice',
  ];
  const statusRows = (data.statusCatalog ?? []).map((s) => {
    const tags = [...(statusToTreatments.get(s.id) ?? [])].sort().join(' | ');
    const hints = (s.reportHints ?? []).join(' | ');
    const tpl = templates[s.id] ?? {};
    return [s.id, s.icon ?? '', s.name, tags, hints, tpl.failText ?? '', tpl.advice ?? ''];
  });
  writeCsv('02_statuses_symptoms.csv', statusHeader, statusRows);

  // ── 03 treatments ───────────────────────────────────────────────────────
  const treatHeader = [
    'treatment_tag',
    'narrative_only',
    'heals_status_ids',
    'heals_status_names',
    'design_note',
  ];
  const treatRows = (data.treatmentCatalog ?? []).map((t) => {
    const ids = (t.healsStatuses ?? []).join(' | ');
    const names = (t.healsStatuses ?? [])
      .map((id) => statusById[id]?.name ?? id)
      .join(' | ');
    const note = t.narrativeOnly ? 'narrative-only (не лечит симптомы по каталогу)' : '';
    return [t.tag, t.narrativeOnly ? 'yes' : 'no', ids, names, note];
  });
  writeCsv('03_treatments.csv', treatHeader, treatRows);

  // ── 04 debts (all D_* occurrences) ─────────────────────────────────────
  const debtMap = new Map();
  function ingestDebt(d, source) {
    if (!d?.id) return;
    const prev = debtMap.get(d.id);
    if (prev && prev.statusIfUnresolved !== d.statusIfUnresolved) {
      prev._conflict = true;
    }
    if (!prev) debtMap.set(d.id, { ...d, _sources: new Set([source]) });
    else prev._sources.add(source);
  }
  for (const c of [...(data.spellCatalog ?? []), ...(data.obryadCatalog ?? [])]) {
    for (const d of c.addsDebts ?? []) ingestDebt(d, `card:${c.id}`);
  }
  for (const lvl of data.levelCatalog ?? []) {
    for (const inst of lvl.defaultInstalled ?? []) {
      for (const d of inst.addsDebts ?? []) ingestDebt(d, `level:${lvl.id}:default`);
    }
  }
  const debtHeader = ['debt_id', 'symptom_status_id', 'symptom_name', 'sources'];
  const debtRows = [...debtMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, d]) => [
      id,
      d.statusIfUnresolved,
      statusById[d.statusIfUnresolved]?.name ?? '',
      [...d._sources].sort().join(' | '),
    ]);
  writeCsv('04_debts.csv', debtHeader, debtRows);

  // ── 05 cards (spells + obryads) ──────────────────────────────────────────
  const cardHeader = [
    'kind',
    'id',
    'name',
    'allowed_slot_types',
    'gold',
    'aura',
    'aura_limit_delta',
    'unique',
    'treatment_tags',
    'legacy_buffs',
    'adds_debt_ids',
    'adds_symptoms',
    'resolves_debt_ids',
    'capabilities_granted',
    'description',
  ];
  function cardRowsFrom(catalog, kind) {
    return (catalog ?? []).map((c) => {
      const caps = (c.effects ?? [])
        .filter((e) => e.type === 'CAPABILITY')
        .map((e) => `${e.id} (${capLabels[e.id] ?? e.id})`)
        .join(' | ');
      const addsIds = (c.addsDebts ?? []).map((d) => d.id).join(' | ');
      const addsSym = (c.addsDebts ?? [])
        .map((d) => {
          const st = statusById[d.statusIfUnresolved];
          return st ? `${st.icon} ${st.name}` : d.statusIfUnresolved;
        })
        .join(' | ');
      const resolves = (c.resolvesDebts ?? []).join(' | ');
      const tags = (c.treatmentTags ?? []).join(' | ');
      const buffs = (c.buffs ?? []).join(' | ');
      return [
        kind,
        c.id,
        c.name,
        (c.allowedSlotTypes ?? []).join(' | '),
        c.currencies?.gold ?? '',
        c.currencies?.aura ?? '',
        c.auraLimitDelta ?? '',
        c.unique === false ? 'no' : 'yes',
        tags,
        buffs,
        addsIds,
        addsSym,
        resolves,
        caps,
        c.description ?? '',
      ];
    });
  }
  const allCardRows = [
    ...cardRowsFrom(data.spellCatalog, 'spell'),
    ...cardRowsFrom(data.obryadCatalog, 'obryad'),
  ];
  writeCsv('05_cards_spells_and_obryads.csv', cardHeader, allCardRows);

  // ── 13 spell cards (design catalog, 3 property cells) ───────────────────
  const formatDebuffCell = (cell) => {
    if (!cell || cell.kind !== 'debuff') return '';
    const st = statusById[cell.statusIfUnresolved];
    return st?.name ?? cell.statusIfUnresolved ?? '';
  };
  const formatTreatmentCell = (cell) => {
    if (!cell || cell.kind !== 'treatment') return '';
    return (cell.treatmentTags ?? []).join(' | ');
  };
  const formatHealsInherited = (cell) => {
    if (!cell || cell.kind !== 'treatment') return '';
    return (cell.healsInherited ?? []).map((h) => h.debtId).join(' | ');
  };
  const spellCardHeader = [
    'introduced_at_level',
    'card_id',
    'name',
    'gold',
    'aura',
    'allowed_slot_types',
    'cell_treatment_tags',
    'cell_treatment_heals_inherited',
    'cell_debuff_1',
    'cell_debuff_2',
    'capabilities',
    'description',
  ];
  const spellCardRows = (data.spellCardCatalog ?? []).map((c) => {
    const cells = c.propertyCells ?? [];
    const treatment = cells[0];
    const caps = (c.effects ?? [])
      .filter((e) => e.type === 'CAPABILITY')
      .map((e) => `${e.id} (${capLabels[e.id] ?? e.id})`)
      .join(' | ');
    return [
      c.introducedAtLevel ?? '',
      c.id,
      c.name,
      c.currencies?.gold ?? '',
      c.currencies?.aura ?? '',
      (c.allowedSlotTypes ?? []).join(' | '),
      formatTreatmentCell(treatment),
      formatHealsInherited(treatment),
      formatDebuffCell(cells[1]),
      formatDebuffCell(cells[2]),
      caps,
      c.description ?? '',
    ];
  });
  writeCsv('13_spell_cards.csv', spellCardHeader, spellCardRows);

  // ── 15 obryads (design catalog, 3 property cells) ─────────────────────────
  const obryadCardHeader = [
    'introduced_at_level',
    'obryad_id',
    'name',
    'gold',
    'aura',
    'aura_limit_delta',
    'allowed_slot_types',
    'cell_treatment_tags',
    'cell_treatment_heals_inherited',
    'cell_debuff_1',
    'cell_debuff_2',
    'capabilities',
    'description',
  ];
  const obryadCardRows = (data.obryadCardCatalog ?? []).map((c) => {
    const cells = c.propertyCells ?? [];
    const treatment = cells[0];
    const caps = (c.effects ?? [])
      .filter((e) => e.type === 'CAPABILITY')
      .map((e) => `${e.id} (${capLabels[e.id] ?? e.id})`)
      .join(' | ');
    return [
      c.introducedAtLevel ?? '',
      c.id,
      c.name,
      c.currencies?.gold ?? '',
      c.currencies?.aura ?? '',
      c.auraLimitDelta ?? '',
      (c.allowedSlotTypes ?? []).join(' | '),
      formatTreatmentCell(treatment),
      formatHealsInherited(treatment),
      formatDebuffCell(cells[1]),
      formatDebuffCell(cells[2]),
      caps,
      c.description ?? '',
    ];
  });
  writeCsv('15_obryads.csv', obryadCardHeader, obryadCardRows);

  // ── 14 inherited debts (level / peer, not this card's debuff slots) ─────
  const inhHeader = [
    'debt_id',
    'status_id',
    'status_name',
    'origin',
    'introduced_at_levels',
    'source_card_id',
    'distinct_from_card_debts',
    'narrative',
  ];
  const inhRows = (data.inheritedDebtCatalog ?? []).map((row) => [
    row.id,
    row.statusIfUnresolved ?? '',
    statusById[row.statusIfUnresolved]?.name ?? '',
    row.origin ?? '',
    (row.introducedAtLevels ?? []).join(' | '),
    row.sourceCardId ?? '',
    (row.distinctFromCardDebts ?? []).join(' | '),
    row.narrative ?? '',
  ]);
  writeCsv('14_inherited_debts.csv', inhHeader, inhRows);

  // ── 06 capabilities reference ──────────────────────────────────────────
  const capHeader = ['capability_id', 'label'];
  const capRows = Object.entries(capLabels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, label]) => [id, label]);
  writeCsv('06_capabilities.csv', capHeader, capRows);

  // ── 07 levels (summary) ──────────────────────────────────────────────────
  const maxSuccess = Math.max(
    0,
    ...(data.levelCatalog ?? []).map((l) => (l.successReports ?? []).length),
  );
  const levelHeader = [
    'level_id',
    'order',
    'name',
    'client_name',
    'intro_description',
    'budget_gold',
    'budget_aura',
    'non_critical_aura_penalty',
    'critical_status_ids',
    'critical_status_names',
    ...Array.from({ length: maxSuccess }, (_, i) => `success_text_${i + 1}`),
    'hints_joined',
    'requirements_summary',
  ];
  const levelRows = (data.levelCatalog ?? []).map((l) => {
    const critIds = (l.criticalStatuses ?? []).join(' | ');
    const critNames = (l.criticalStatuses ?? [])
      .map((id) => statusById[id]?.name ?? id)
      .join(' | ');
    const sr = l.successReports ?? [];
    const srPad = Array.from({ length: maxSuccess }, (_, i) => sr[i] ?? '');
    const reqs = (l.requirements ?? [])
      .map((r) => `${r.id}: ${r.label ?? ''} (${r.capabilityId ?? r.type})`)
      .join(' || ');
    return [
      l.id,
      l.order ?? '',
      l.name,
      l.clientName ?? '',
      l.description ?? '',
      l.budget?.gold ?? '',
      l.budget?.aura ?? '',
      l.nonCriticalStatusAuraPenalty ?? '',
      critIds,
      critNames,
      ...srPad,
      (l.hints ?? []).join(' || '),
      reqs,
    ];
  });
  writeCsv('07_levels.csv', levelHeader, levelRows);

  // ── 08 level × critical status → report template ─────────────────────────
  const lcsHeader = ['level_id', 'level_name', 'status_id', 'status_name', 'fail_text', 'advice'];
  const lcsRows = [];
  for (const l of data.levelCatalog ?? []) {
    for (const sid of l.criticalStatuses ?? []) {
      const tpl = templates[sid] ?? {};
      lcsRows.push([
        l.id,
        l.name,
        sid,
        statusById[sid]?.name ?? sid,
        tpl.failText ?? '',
        tpl.advice ?? '',
      ]);
    }
  }
  writeCsv('08_level_critical_status_texts.csv', lcsHeader, lcsRows);

  // ── 09 level matrix instances (compact: расстановка плиток) ──────────────
  const presetById = new Map((data.matrixPresets ?? []).map((p) => [p.id, p]));
  const instHeader = [
    'level_id',
    'instance_id',
    'preset_id',
    'preset_name',
    'install_cost_gold',
    'preset_default_cost',
    'cost_override',
    'pre_installed',
  ];
  const instRows = [];
  for (const l of data.levelCatalog ?? []) {
    for (const am of l.availableMatrices ?? []) {
      const preset = presetById.get(am.presetId);
      const cost = am.installCostGold;
      const def = preset?.installCostGold;
      const override = cost != null && def != null && cost !== def ? `${def}→${cost}` : '';
      instRows.push([
        l.id,
        am.instanceId,
        am.presetId ?? '',
        preset?.name ?? '',
        cost ?? '',
        def ?? '',
        override,
        am.preInstalled ? 'yes' : 'no',
      ]);
    }
  }
  writeCsv('09_level_matrix_instances.csv', instHeader, instRows);

  // ── 12 matrix presets ─────────────────────────────────────────────────────
  const maxPresetSlots = Math.max(
    0,
    ...(data.matrixPresets ?? []).map((p) => (p.slotTypes ?? []).length),
  );
  const presetHeader = [
    'preset_id',
    'matrix_id',
    'matrix_name',
    'preset_name',
    'description',
    'default_install_cost_gold',
    'slot_count',
    ...Array.from({ length: maxPresetSlots }, (_, i) => `slot_type_${i + 1}`),
    'used_by_level_instances',
  ];
  const usageByPreset = new Map();
  for (const l of data.levelCatalog ?? []) {
    for (const am of l.availableMatrices ?? []) {
      if (!am.presetId) continue;
      if (!usageByPreset.has(am.presetId)) usageByPreset.set(am.presetId, []);
      usageByPreset.get(am.presetId).push(`${l.id}:${am.instanceId}`);
    }
  }
  const presetRows = (data.matrixPresets ?? []).map((p) => {
    const mdef = (data.matrixCatalog ?? []).find((x) => x.id === p.matrixId);
    const slots = p.slotTypes ?? [];
    const pad = Array.from({ length: maxPresetSlots }, (_, i) => slots[i] ?? '');
    return [
      p.id,
      p.matrixId,
      mdef?.name ?? '',
      p.name ?? '',
      p.description ?? '',
      p.installCostGold ?? '',
      slots.length,
      ...pad,
      (usageByPreset.get(p.id) ?? []).join(' | '),
    ];
  });
  writeCsv('12_matrix_presets.csv', presetHeader, presetRows);

  // ── 10 conflict pairs ────────────────────────────────────────────────────
  const cpHeader = [
    'pair_id',
    'spell_a',
    'spell_b',
    'symptom_if_unresolved',
    'symptom_name',
    'resolved_by_spell_ids',
    'description',
  ];
  const cpRows = (data.conflictPairs ?? []).map((p) => [
    p.id,
    p.spells?.[0] ?? '',
    p.spells?.[1] ?? '',
    p.statusIfUnresolved ?? '',
    statusById[p.statusIfUnresolved]?.name ?? '',
    (p.resolvedBy ?? []).join(' | '),
    p.description ?? '',
  ]);
  writeCsv('10_conflict_pairs.csv', cpHeader, cpRows);

  // ── 11 level default installed (starting state) ───────────────────────────
  const diHeader = [
    'level_id',
    'block_index',
    'note',
    'grants_capabilities',
    'adds_debt_ids',
    'adds_symptoms',
  ];
  const diRows = [];
  for (const l of data.levelCatalog ?? []) {
    (l.defaultInstalled ?? []).forEach((inst, idx) => {
      const caps = (inst.grantsCapabilities ?? []).join(' | ');
      const debts = inst.addsDebts ?? [];
      diRows.push([
        l.id,
        idx + 1,
        inst.note ?? '',
        caps,
        debts.map((d) => d.id).join(' | '),
        debts
          .map((d) => {
            const st = statusById[d.statusIfUnresolved];
            return st ? `${st.icon} ${st.name}` : d.statusIfUnresolved;
          })
          .join(' | '),
      ]);
    });
  }
  writeCsv('11_level_default_installed.csv', diHeader, diRows);

  // ── 16 level solutions (human-readable, fixtures + design notes) ─────────
  const FIXTURES_DIR = path.join(ROOT, 'scripts', 'level-fixtures');
  const SLOT_TYPE_LABELS = {
    OBS_LOGS: 'Логи',
    OBS_FILTERS: 'Фильтры',
    OBS_ALERTS: 'Алерты',
    OBS_TRACING: 'Трейсинг',
    ST_RETENTION: 'Хранение',
    ST_INDEX: 'Индекс',
    ST_QUOTA: 'Квоты',
    ST_SECRETS: 'Секреты',
    NET_AUTH: 'Доступ',
    NET_ROUTING: 'Маршруты',
    NET_DISCOVERY: 'Discovery',
    NET_DNS: 'DNS',
    NET_TLS: 'TLS',
    CD_PIPELINE: 'Pipeline',
    CD_GATES: 'Гейты',
    CD_ROLLBACK: 'Откат',
    CD_TESTING: 'Тесты',
    RITUAL_OBS: 'Обряд (наблюдение)',
    RITUAL_ST: 'Обряд (хранение)',
    RITUAL_NET: 'Обряд (связь)',
    RITUAL_CD: 'Обряд (доставка)',
  };
  const slotLabel = (t) => SLOT_TYPE_LABELS[t] ?? t;

  const matrixNameById = Object.fromEntries((data.matrixCatalog ?? []).map((m) => [m.id, m.name]));

  /** @type {Map<string, { name: string, gold: number, aura: number, kind: string }>} */
  const cardById = new Map();
  for (const c of [...(data.spellCardCatalog ?? []), ...(data.spellCatalog ?? [])]) {
    cardById.set(c.id, {
      name: c.name,
      gold: c.currencies?.gold ?? c.costCoins ?? 0,
      aura: c.currencies?.aura ?? 0,
      kind: 'заклинание',
    });
  }
  for (const c of [...(data.obryadCardCatalog ?? []), ...(data.obryadCatalog ?? [])]) {
    cardById.set(c.id, {
      name: c.name,
      gold: c.currencies?.gold ?? c.costCoins ?? 0,
      aura: c.currencies?.aura ?? 0,
      kind: 'обряд',
    });
  }

  function placementsKey(placements) {
    const sorted = Object.keys(placements ?? {})
      .sort()
      .map((k) => [k, placements[k]]);
    return JSON.stringify(sorted);
  }

  function buildSlotIndex(level) {
    /** @type {Map<string, { slotType: string, matrixLabel: string }>} */
    const slotMap = new Map();
    for (const am of level.availableMatrices ?? []) {
      const preset = presetById.get(am.presetId);
      const matLabel =
        am.overrideName ??
        preset?.name ??
        matrixNameById[am.matrixId] ??
        am.matrixId;
      for (const sl of am.slots ?? []) {
        slotMap.set(sl.slotId, { slotType: sl.slotType, matrixLabel: matLabel });
      }
    }
    return slotMap;
  }

  function findDesignNote(level, scenario) {
    const key = placementsKey(scenario.placements);
    const matsKey = [...(scenario.installedMatrixIds ?? [])].sort().join(',');
    for (const sol of level.solutions ?? []) {
      if (placementsKey(sol.placements) !== key) continue;
      const solMats = [...(sol.matrices ?? [])].sort().join(',');
      if (solMats && solMats !== matsKey) continue;
      return (sol.note ?? '').trim();
    }
    const pathTag = scenario.name.match(/(?:Путь|Вариант)\s*([AB])/i);
    if (pathTag) {
      const letter = pathTag[1].toUpperCase();
      for (const sol of level.solutions ?? []) {
        if (new RegExp(`(?:Путь|Вариант)\\s*${letter}`, 'i').test(sol.name)) {
          return (sol.note ?? '').trim();
        }
      }
    }
    return '';
  }

  function matricesReadable(level, installedIds) {
    const opt = new Set(installedIds ?? []);
    const lines = [];
    for (const am of level.availableMatrices ?? []) {
      const pre = am.preInstalled !== false;
      const chosen = pre || opt.has(am.instanceId);
      if (!chosen) continue;
      const preset = presetById.get(am.presetId);
      const label = preset?.name ?? am.instanceId;
      const cost = am.installCostGold ?? 0;
      const tag = pre ? 'уже на поле' : `установить (${cost}⚗)`;
      lines.push(`${label} — ${tag}`);
    }
    return lines.join(' | ') || '—';
  }

  function assemblyReadable(level, placements) {
    const slotIdx = buildSlotIndex(level);
    return Object.entries(placements ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slotId, cardId]) => {
        const slot = slotIdx.get(slotId);
        const card = cardById.get(cardId);
        const st = slot ? slotLabel(slot.slotType) : 'слот';
        const mat = slot?.matrixLabel ?? '';
        const title = card?.name ?? cardId;
        const kind = card?.kind ?? 'карта';
        const aura =
          card && card.aura !== 0
            ? ` ${card.aura > 0 ? '+' : ''}${card.aura}✨`
            : '';
        const costs = card ? `${card.gold}⚗${aura}` : '';
        const where = mat ? `${mat} · ${st}` : st;
        return `${where} ← «${title}» (${kind}, ${costs})`;
      })
      .join(' | ');
  }

  function scenarioType(scenario) {
    if (scenario.expected?.outcome === 'pass') return 'Успешный путь';
    if (/ловушка/i.test(scenario.name)) return 'Ловушка';
    return 'Учебный сценарий';
  }

  function buildWhy(level, scenario, designNote) {
    const parts = [];
    const exp = scenario.expected ?? {};
    if (designNote) parts.push(designNote);

    if (exp.outcome === 'pass') {
      if (!designNote) {
        const reqs = (level.requirements ?? []).map((r) => r.label).filter(Boolean);
        if (reqs.length) {
          parts.push(`Закрывает требования уровня: ${reqs.join('; ')}.`);
        } else {
          parts.push(
            'Сборка снимает критические долги, выполняет DoD и укладывается в бюджет монет и ауры.',
          );
        }
      }
      return parts.join(' ');
    }

    if (exp.fatalStatuses?.length) {
      for (const sid of exp.fatalStatuses) {
        const st = statusById[sid];
        parts.push(`Остаётся критический симптом: ${st?.icon ?? ''} ${st?.name ?? sid}.`);
        const tpl = templates[sid] ?? {};
        if (tpl.failText) parts.push(tpl.failText);
        if (tpl.advice) parts.push(`Совет: ${tpl.advice}`);
      }
    }
    if (exp.missingRequirementsContains?.length) {
      for (const rid of exp.missingRequirementsContains) {
        const req = (level.requirements ?? []).find((r) => r.id === rid);
        parts.push(`Не выполнено требование: ${req?.label ?? rid}.`);
      }
    }
    if (exp.auraTotalRange) {
      const [lo, hi] = exp.auraTotalRange;
      const lim = level.budget?.aura;
      const val = lo === hi ? String(lo) : `${lo}–${hi}`;
      if (lim != null && lo > lim) {
        parts.push(`Итоговая аура ${val} при лимите ${lim} — превышение (провал по ауре).`);
      }
    }
    if (exp.coinsSpentRange) {
      const [lo, hi] = exp.coinsSpentRange;
      const lim = level.budget?.gold;
      const val = lo === hi ? String(lo) : `${lo}–${hi}`;
      if (lim != null && lo > lim) {
        parts.push(`Потрачено монет ${val} при бюджете ${lim} — превышение (провал по бюджету).`);
      }
    }
    if (!parts.length) {
      const tail = scenario.name.replace(/^Ловушка\s*\d+\s*[—–-]\s*/i, '').trim();
      if (tail && tail !== scenario.name) parts.push(tail);
      else parts.push('Сборка не проходит валидатор: бюджет, симптомы или требования.');
    }
    return parts.join(' ');
  }

  function expectedSummary(exp) {
    const bits = [];
    bits.push(exp.outcome === 'pass' ? 'ПОБЕДА' : 'ПРОВАЛ');
    if (exp.coinsSpentRange) bits.push(`монеты ${exp.coinsSpentRange.join('–')}`);
    if (exp.auraTotalRange) bits.push(`аура ${exp.auraTotalRange.join('–')}`);
    if (exp.fatalStatuses?.length) {
      const names = exp.fatalStatuses.map((id) => statusById[id]?.name ?? id);
      bits.push(`симптомы: ${names.join(', ')}`);
    }
    if (exp.missingRequirementsContains?.length) {
      bits.push(`не хватает: ${exp.missingRequirementsContains.join(', ')}`);
    }
    return bits.join('; ');
  }

  const solHeader = [
    'order',
    'level_id',
    'level_title',
    'client',
    'scenario_type',
    'scenario_name',
    'outcome',
    'why',
    'budget_gold',
    'budget_aura',
    'matrices',
    'assembly',
    'validator_expectation',
  ];
  const solRows = [];
  const levelById = Object.fromEntries((data.levelCatalog ?? []).map((l) => [l.id, l]));
  const fixtureFiles = fs.existsSync(FIXTURES_DIR)
    ? fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.expected.json'))
    : [];

  for (const file of fixtureFiles.sort()) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8'));
    const level = levelById[fixture.levelId];
    if (!level) continue;
    for (const scenario of fixture.scenarios ?? []) {
      if (scenario.expected?.outcome !== 'pass') continue;
      const designNote = findDesignNote(level, scenario);
      solRows.push([
        level.order ?? '',
        level.id,
        level.name ?? '',
        level.clientName ?? '',
        scenarioType(scenario),
        scenario.name ?? '',
        scenario.expected?.outcome === 'pass' ? 'Победа' : 'Провал',
        buildWhy(level, scenario, designNote),
        level.budget?.gold ?? '',
        level.budget?.aura ?? '',
        matricesReadable(level, scenario.installedMatrixIds),
        assemblyReadable(level, scenario.placements),
        expectedSummary(scenario.expected ?? {}),
      ]);
    }
  }
  solRows.sort((a, b) => {
    const oa = Number(a[0]) || 0;
    const ob = Number(b[0]) || 0;
    if (oa !== ob) return oa - ob;
    return String(a[5]).localeCompare(String(b[5]), 'ru');
  });
  writeCsv('16_level_solutions.csv', solHeader, solRows);

  // ── README ────────────────────────────────────────────────────────────────
  const readme = `# CSV export (game-data)

Сгенерировано: \`node scripts/export-csv-tables.mjs\`

| Файл | Содержание |
|------|------------|
| 01_matrices.csv | Шаблоны матриц из matrixCatalog |
| 02_statuses_symptoms.csv | Симптомы F* + чем лечат теги + тексты из reportTemplates |
| 03_treatments.csv | treatmentCatalog |
| 04_debts.csv | Все долги D_* из карт и defaultInstalled |
| 05_cards_spells_and_obryads.csv | Заклинания и обряды |
| 06_capabilities.csv | HAS_* → подпись |
| 07_levels.csv | Уровни: вступление, победы, подсказки, требования |
| 08_level_critical_status_texts.csv | Для каждого крит. статуса уровня — fail/advice |
| 09_level_matrix_instances.csv | Расстановка плиток на уровне: preset_id, цена, override имени |
| 10_conflict_pairs.csv | Пары конфликтующих карт |
| 11_level_default_installed.csv | Стартовые блоки уровня (долги и capabilities) |
| 12_matrix_presets.csv | Каталог конфигураций матриц (matrixPresets) |
| 13_spell_cards.csv | Заклинания: 3 ячейки свойств + introducedAtLevel (spellCardCatalog) |
| 14_inherited_debts.csv | Наследственные/чужие долги, отдельно от дебафов карты |
| 15_obryads.csv | Обряды: 3 ячейки свойств + introducedAtLevel (obryadCardCatalog) |
| 16_level_solutions.csv | Успешные пути по уровням (без ловушек) + «почему» из game-data |

Кодировка: UTF-8 с BOM (Excel на Windows открывает кириллицу корректно).
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf8');

  console.log(`Wrote CSV tables + README to ${OUT_DIR}`);
}

main();
