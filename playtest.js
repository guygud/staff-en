/**
 * CSV-only playtest: loads new/*.csv, builds data for lib/simulate.mjs, minimal UI.
 */
import { computePlacement, isSuccessfulPlacement } from './lib/simulate.mjs';

const CSV_FILES = [
  'Алхимия систем - Уровни - нарратив.csv',
  'Алхимия систем - Дебафы.csv',
  'Алхимия систем - Бафы.csv',
  'Алхимия систем - Заклинания.csv',
  'Алхимия систем - Обряды.csv',
  'Алхимия систем - Наследственные дебафы.csv',
  'Алхимия систем - Матрицы.csv',
  'Алхимия систем - Уровни - матрицы.csv',
  'Алхимия систем - Решения.csv',
  'Алхимия систем - Ответы на дебафы.csv',
];

/** @param {string} text */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    if (row.length === 1 && row[0] === '') return;
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        field += text[i];
        i++;
      }
      continue;
    }
    if (c === ',') {
      pushField();
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      pushField();
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  pushField();
  if (field.length || row.length) pushRow();
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().replace(/^\ufeff/, '').trim());
  return rows.slice(1).map((cells) => {
    const o = {};
    header.forEach((key, j) => {
      o[key] = (cells[j] ?? '').trim();
    });
    return o;
  });
}

async function loadAllCsv() {
  const base = 'new/';
  const texts = await Promise.all(
    CSV_FILES.map((f) =>
      fetch(`${base}${encodeURIComponent(f)}`).then((r) => {
        if (!r.ok) throw new Error(`Не удалось загрузить ${f}: ${r.status}`);
        return r.text();
      })
    )
  );
  return {
    narrative: parseCsv(texts[0]),
    debuffs: parseCsv(texts[1]),
    buffs: parseCsv(texts[2]),
    spells: parseCsv(texts[3]),
    obryads: parseCsv(texts[4]),
    heritage: parseCsv(texts[5]),
    matrices: parseCsv(texts[6]),
    levelMatrices: parseCsv(texts[7]),
    solutions: parseCsv(texts[8]),
    answers: parseCsv(texts[9]),
  };
}

/** Первая колонка в «Ответы на дебафы.csv» без заголовка — level_id */
function buildAnswersByLevel(answerRows) {
  /** @type {Record<string, Record<string, string>>} */
  const byLevel = {};
  for (const row of answerRows) {
    const levelId = row['']?.trim() || row.level_id?.trim();
    if (!levelId || !/^L\d+_/.test(levelId)) continue;
    byLevel[levelId] = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === '' || k === 'level_id') continue;
      if (!v || !String(v).trim()) continue;
      byLevel[levelId][k.trim()] = String(v).trim();
    }
  }
  return byLevel;
}

/** «Решения.csv» → справочные проходы по уровню (инструкция + что даёт решение). */
function buildSolutionsByLevel(solutionRows) {
  /** @type {Record<string, Array<{ order: number, scenarioName: string, why: string, budgetGold: string, budgetAura: string, matrices: string, assembly: string }>>} */
  const by = {};
  for (const row of solutionRows ?? []) {
    const lid = (row.level_id ?? '').trim();
    if (!lid) continue;
    if (!by[lid]) by[lid] = [];
    by[lid].push({
      order: Number(row.order) || 0,
      scenarioName: (row.scenario_name ?? '').trim(),
      why: (row.why ?? '').trim(),
      budgetGold: (row.budget_gold ?? '').trim(),
      budgetAura: (row.budget_aura ?? '').trim(),
      matrices: (row.matrices ?? '').trim(),
      assembly: (row.assembly ?? '').trim(),
    });
  }
  for (const arr of Object.values(by)) {
    arr.sort((a, b) => a.order - b.order || a.scenarioName.localeCompare(b.scenarioName));
  }
  return by;
}

/** @param {string} cell @param {string[]} debuffNames */
function resolveDebuffName(cell, debuffNames) {
  const t = (cell || '').trim();
  if (!t) return '';
  const sorted = [...debuffNames].sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    if (t.includes(n)) return n;
  }
  return t.replace(/^\S+\s+/, '').trim() || t;
}

function splitPipe(s) {
  if (!s) return [];
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** "L1_X:obs0 | L2_Y:st" -> [{ level_id, instance_id }] */
function parseUsedByInstances(cell) {
  const out = [];
  if (!cell) return out;
  for (const part of cell.split('|')) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf(':');
    if (idx === -1) continue;
    out.push({
      level_id: p.slice(0, idx).trim(),
      instance_id: p.slice(idx + 1).trim(),
    });
  }
  return out;
}

/** Список preset_id из ячейки «preset_matrix» */
function parsePresetMatrixList(cell) {
  if (cell == null || !String(cell).trim()) return [];
  let s = String(cell).trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function levelMatrixRowFor(levelId, levelMatrixRows) {
  for (const r of levelMatrixRows ?? []) {
    const id = (r['Уровень'] ?? r.level_id ?? '').trim();
    if (id === levelId) return r;
  }
  return null;
}

/** Инстансы матриц по уровню (порядок строк CSV «Матрицы»). */
function buildMatrixInstancesByLevel(matrixRows) {
  /** @type {Map<string, Array<{ instance_id: string, preset_id: string, preset_name: string, slotTypes: string[], installCostGold: number }>>} */
  const byLevel = new Map();
  for (const row of matrixRows) {
    const instances = parseUsedByInstances(row.used_by_level_instances);
    const nSlots = Math.min(5, Math.max(0, parseInt(row.slot_count, 10) || 0));
    const types = [];
    for (let k = 1; k <= nSlots; k++) {
      const t = row[`slot_type_${k}`]?.trim();
      if (t) types.push(t);
    }
    const preset_id = (row.preset_id ?? '').trim();
    const installCostGold = Number(row.default_install_cost_gold) || 0;
    const preset_name = (row.preset_name || row.preset_id || '').trim();
    for (const { level_id, instance_id } of instances) {
      if (!byLevel.has(level_id)) byLevel.set(level_id, []);
      byLevel.get(level_id).push({
        instance_id,
        preset_id,
        preset_name,
        slotTypes: types,
        installCostGold,
      });
    }
  }
  return byLevel;
}

/**
 * @param {Awaited<ReturnType<typeof loadAllCsv>>} csv
 */
function buildGameData(csv) {
  const debuffNames = csv.debuffs.map((r) => r.name).filter(Boolean);
  const statusByName = new Map(
    csv.debuffs.map((r) => [r.name, { name: r.name, icon: r.icon || '⚠' }])
  );

  const treatmentCatalog = csv.buffs.map((r) => ({
    tag: r.treatment_tag,
    healsStatuses: splitPipe(r.heals_status_names),
  }));

  const spellCatalog = [];
  const obryadCatalog = [];
  const seenSpell = new Set();
  const seenObryad = new Set();

  csv.spells.forEach((r, idx) => {
    const name = r.name?.trim();
    if (!name) return;
    let id = `S:${name}`;
    if (seenSpell.has(id)) id = `S:${name}#${idx}`;
    seenSpell.add(id);
    const tags = splitPipe((r.cell_treatment_tags || '').replace(/\s*\|\s*/g, ' | '));
    const d1 = r.cell_debuff_1?.trim();
    const d2 = r.cell_debuff_2?.trim();
    const addsDebts = [];
    let di = 0;
    for (const raw of [d1, d2]) {
      if (!raw) continue;
      const st = resolveDebuffName(raw, debuffNames);
      if (!st) continue;
      addsDebts.push({ id: `${id}_d${di++}`, statusIfUnresolved: st });
    }
    const allowedSlotTypes = splitPipe(
      (r.allowed_slot_types || '').replace(/\s*\|\s*/g, ' | ')
    );
    spellCatalog.push({
      id,
      name,
      introduced_at_level: (r.introduced_at_level || '').trim(),
      currencies: {
        gold: Number(r.gold) || 0,
        aura: Number(r.aura) || 0,
      },
      treatmentTags: tags,
      addsDebts,
      allowedSlotTypes,
      description: r.description || '',
    });
  });

  csv.obryads.forEach((r, idx) => {
    const name = r.name?.trim();
    if (!name) return;
    let id = `R:${name}`;
    if (seenObryad.has(id)) id = `R:${name}#${idx}`;
    seenObryad.add(id);
    const tags = splitPipe((r.cell_treatment_tags || '').replace(/\s*\|\s*/g, ' | '));
    const allowedSlotTypes = splitPipe(
      (r.allowed_slot_types || '').replace(/\s*\|\s*/g, ' | ')
    );
    obryadCatalog.push({
      id,
      name,
      introduced_at_level: (r.introduced_at_level || '').trim(),
      currencies: {
        gold: Number(r.gold) || 0,
        aura: Number(r.aura) || 0,
      },
      auraLimitDelta: Number(r.aura_limit_delta) || 0,
      treatmentTags: tags,
      addsDebts: [],
      allowedSlotTypes,
      description: r.description || '',
    });
  });

  const orderMap = Object.fromEntries(
    csv.narrative.map((n) => [n.level_id, Number(n.order) || 0])
  );

  const heritageByLevel = Object.fromEntries(
    csv.heritage.map((h) => {
      const names = [h.debuff_1, h.debuff_2, h.debuff_3]
        .map((c) => resolveDebuffName(c, debuffNames))
        .filter(Boolean);
      return [h.level_id, names];
    })
  );

  const matrixInstancesByLevel = buildMatrixInstancesByLevel(csv.matrices);

  /** Все симптомы из справочника критичны: любой активный дебаф = поражение. */
  const allDebuffIds = debuffNames.slice();

  const answersByLevel = buildAnswersByLevel(csv.answers ?? []);
  const solutionsByLevel = buildSolutionsByLevel(csv.solutions ?? []);

  const levels = csv.narrative.map((n) => {
    const levelId = n.level_id;
    const inheritedDebuffNames = heritageByLevel[levelId] || [];
    const addsDebts = inheritedDebuffNames.map((name, i) => ({
      id: `h${levelId}_${i}`,
      statusIfUnresolved: name,
    }));

    const blocks = matrixInstancesByLevel.get(levelId) || [];
    const lmRow = levelMatrixRowFor(levelId, csv.levelMatrices);
    const presetRaw = (lmRow?.preset ?? '').trim().toLowerCase();
    const presetYes = presetRaw === 'yes' || presetRaw === 'да';
    const fixedPresets = new Set(parsePresetMatrixList(lmRow?.preset_matrix));
    const maxMRaw = lmRow != null ? parseInt(String(lmRow.max_matrix ?? '').trim(), 10) : NaN;
    const maxMatrix =
      Number.isFinite(maxMRaw) && maxMRaw > 0 ? maxMRaw : Math.max(blocks.length, presetYes ? fixedPresets.size : 0);

    const instances = blocks.map((b) => ({
      ...b,
      isPreinstalled: presetYes && fixedPresets.has(b.preset_id),
    }));
    const matrixInstancesPre = instances.filter((i) => i.isPreinstalled);
    const matrixInstancesOptional = instances.filter((i) => !i.isPreinstalled);
    const preCount = matrixInstancesPre.length;
    let maxOptionalMatrices = Math.max(0, maxMatrix - preCount);
    if (maxMatrix < preCount) maxOptionalMatrices = 0;

    const allSlotDefs = [];
    for (const inst of instances) {
      inst.slotTypes.forEach((slotType, j) => {
        allSlotDefs.push({
          slotId: `${inst.instance_id}_${j + 1}`,
          slotType,
          matrixLabel: inst.preset_name,
          instanceId: inst.instance_id,
          presetId: inst.preset_id,
          isPreinstalled: inst.isPreinstalled,
        });
      });
    }

    const availableMatrices = instances.map((i) => ({
      instanceId: i.instance_id,
      presetId: i.preset_id,
      preInstalled: i.isPreinstalled,
      installCostGold: i.installCostGold,
    }));

    return {
      id: levelId,
      order: Number(n.order) || 0,
      name: n.name,
      client_name: n.client_name,
      Item: n.Item,
      intro_description: n.intro_description,
      budget: {
        gold: Number(n.budget_gold) || 0,
        aura: Number(n.budget_aura) || 0,
      },
      success_text_1: n.success_text_1,
      success_text_2: n.success_text_2,
      inheritedDebuffNames,
      criticalStatuses: allDebuffIds,
      defaultInstalled: addsDebts.length ? [{ addsDebts }] : [],
      requirements: [],
      maxMatrix,
      maxOptionalMatrices,
      matrixInstancesPre,
      matrixInstancesOptional,
      allSlotDefs,
      availableMatrices,
    };
  });

  const data = {
    spellCatalog,
    obryadCatalog,
    treatmentCatalog,
    conflictPairs: [],
    statusByName,
    orderMap,
    levels,
    answersByLevel,
    solutionsByLevel,
  };
  return data;
}

/**
 * Текст провала — только ячейка «Алхимия систем - Ответы на дебафы.csv» (уровень × симптом).
 * @param {string} levelId
 * @param {string} statusName — имя колонки = имя из «Дебафы.csv»
 */
function resolveFailNarrative(levelId, statusName) {
  const answersRow = game.answersByLevel?.[levelId] ?? {};
  const answerText = (answersRow[statusName] || '').trim();
  const st = game.statusByName.get(statusName);
  const ic = st?.icon ? `${st.icon} ` : '';
  const title = `${ic}${statusName}`.trim();
  if (answerText) {
    return `<h3 class="fail-h3">${escapeHtml(title)}</h3><p class="fail-answer">${escapeHtml(answerText)}</p>`;
  }
  return `<h3 class="fail-h3">${escapeHtml(title)}</h3><p class="fail-answer">В «Ответы на дебафы.csv» для уровня <code>${escapeHtml(
    levelId
  )}</code> в колонке «${escapeHtml(statusName)}» ячейка пуста — добавьте ответ (например <code>L1_MILLER_BARN-Путаница</code>).</p>`;
}

function cardAvailableOnLevel(card, level, orderMap) {
  if (!card.introduced_at_level) return true;
  const introOrder = orderMap[card.introduced_at_level];
  if (introOrder == null) return true;
  return (orderMap[level.id] ?? 0) >= introOrder;
}

function cardFitsSlot(card, slotType) {
  const types = card.allowedSlotTypes || [];
  return types.includes(slotType);
}

// --- UI state ---
/** @type {ReturnType<typeof buildGameData> | null} */
let game = null;
/** @type {typeof game.levels[0] | null} */
let currentLevel = null;
/** @type {Record<string, string>} */
let placements = {};
let selectedSlotId = null;
let lastCompute = null;

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function showScreen(id) {
  for (const s of ['screen-lobby', 'screen-briefing', 'screen-assembly', 'screen-result', 'load-error']) {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('active', s === id);
  }
}

function renderLobby() {
  const ul = $('lobby-list');
  ul.innerHTML = '';
  for (const lv of game.levels) {
    const li = document.createElement('li');
    li.textContent = `${lv.order}. ${lv.name}`;
    li.addEventListener('click', () => openBriefing(lv));
    ul.appendChild(li);
  }
  showScreen('screen-lobby');
}

function statusSlotsHtml(names, { filledClass } = {}) {
  const three = [...names, '', '', ''].slice(0, 3);
  return three
    .map((name) => {
      if (!name) {
        return `<div class="status-slot muted"><span>⬡</span><span>???</span></div>`;
      }
      const st = game.statusByName.get(name);
      const ic = st?.icon || '⚠';
      return `<div class="status-slot ${filledClass || 'filled'}"><span class="ic">${escapeHtml(
        ic
      )}</span><span>${escapeHtml(name)}</span></div>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openBriefing(lv) {
  currentLevel = lv;
  const hero = $('brief-hero');
  hero.innerHTML = `
    <div class="tag">Уровень ${lv.order}</div>
    <h2>${escapeHtml(lv.name)}</h2>
    <div class="brief-meta">Заказчик: ${escapeHtml(lv.client_name || '—')}</div>
    <div class="budget-pills">
      <span class="pill">● ${lv.budget.gold} золота</span>
      <span class="pill">◆ ${lv.budget.aura} ауры</span>
    </div>
  `;
  $('brief-desc').textContent = lv.intro_description || '';
  $('brief-status-slots').innerHTML = statusSlotsHtml(lv.inheritedDebuffNames || [], {
    filledClass: 'filled',
  });
  showScreen('screen-briefing');
}

function openAssembly() {
  if (!currentLevel) return;
  optionalMatrixSlots = initOptionalMatrixSlots(currentLevel);
  selectedSlotId = null;
  selectedMatrixSlotIndex = null;
  initPlacementsFromVisibleSlots();
  $('asm-title').textContent = currentLevel.name;
  renderAssembly();
  showScreen('screen-assembly');
}

function allCards() {
  return [...game.spellCatalog, ...game.obryadCatalog];
}

function findCard(id) {
  return allCards().find((c) => c.id === id) || null;
}

/** Слоты доп. матриц: длина = maxOptionalMatrices, значение = instance_id или null */
let optionalMatrixSlots = [];
/** @type {number | null} */
let selectedMatrixSlotIndex = null;

function installedOptionalMatrixIdsFromSlots() {
  return optionalMatrixSlots.filter(Boolean);
}

/** Старт: все доп. на поле, если помещаются; иначе пустые слоты — выбор через попап. */
function initOptionalMatrixSlots(level) {
  const opt = level.matrixInstancesOptional ?? [];
  const n = Math.max(0, level.maxOptionalMatrices ?? 0);
  const slots = Array(n).fill(null);
  if (n === 0 || opt.length === 0) return slots;
  if (opt.length <= n) {
    for (let i = 0; i < opt.length; i++) slots[i] = opt[i].instance_id;
  }
  return slots;
}

function matrixInstallGold(level, instanceId) {
  const m = (level.availableMatrices ?? []).find((x) => x.instanceId === instanceId);
  return m?.installCostGold ?? 0;
}

function visibleSlotDefs(level) {
  const pre = new Set((level.matrixInstancesPre ?? []).map((i) => i.instance_id));
  const allowed = new Set([...pre, ...installedOptionalMatrixIdsFromSlots()]);
  return (level.allSlotDefs ?? []).filter((s) => allowed.has(s.instanceId));
}

function initPlacementsFromVisibleSlots() {
  placements = {};
  for (const s of visibleSlotDefs(currentLevel)) placements[s.slotId] = null;
}

function syncPlacementsAfterMatrixChange() {
  const vis = new Set(visibleSlotDefs(currentLevel).map((s) => s.slotId));
  for (const k of Object.keys(placements)) {
    if (!vis.has(k)) delete placements[k];
  }
  for (const s of visibleSlotDefs(currentLevel)) {
    if (!(s.slotId in placements)) placements[s.slotId] = null;
  }
}

/**
 * Только свободные места под доп. матрицы (пустые индексы в optionalMatrixSlots).
 * Уже выбранная матрица показывается один раз — заголовком блока слотов ниже.
 */
function appendOptionalMatrixRack(slotEl, level) {
  const opts = level.matrixInstancesOptional ?? [];
  const n = level.maxOptionalMatrices ?? 0;
  if (n <= 0 || opts.length === 0) return;

  const hasEmpty = optionalMatrixSlots.some((id) => !id);
  if (opts.length > n && hasEmpty) {
    const hint = document.createElement('div');
    hint.className = 'matrix-inline-hint';
    hint.textContent = `Выберите ${n} из ${opts.length}: пустой слот открывает тот же список, что и для карт.`;
    slotEl.appendChild(hint);
  }

  const row = document.createElement('div');
  row.className = 'matrix-rack-row';

  for (let i = 0; i < n; i++) {
    if (optionalMatrixSlots[i]) continue;

    const sel = selectedMatrixSlotIndex === i;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'matrix-slot-btn' + (sel ? ' selected' : '');
    btn.dataset.msi = String(i);
    btn.innerHTML = `<span class="st">слот ${i + 1}/${n}</span><span class="cn">— пусто —</span><span class="matrix-slot-sub muted">нажмите, чтобы выбрать</span>`;
    btn.addEventListener('click', () => {
      selectedMatrixSlotIndex = i;
      selectedSlotId = null;
      renderAssembly();
      openMatrixPicker(i);
    });
    row.appendChild(btn);
  }

  if (row.childNodes.length) slotEl.appendChild(row);
}

function renderAssembly() {
  const level = currentLevel;
  const c = computePlacement(game, level, placements, installedOptionalMatrixIdsFromSlots());
  lastCompute = c;

  const preN = (level.matrixInstancesPre ?? []).length;
  const activeN = preN + installedOptionalMatrixIdsFromSlots().length;
  $('asm-gold').innerHTML = `Золото <strong>${c.coinsSpent}</strong> / ${level.budget.gold}<span class="gold-meta"> · На поле матриц <strong>${activeN}</strong> / ${level.maxMatrix}</span>`;
  $('asm-aura').textContent = `${c.auraTotal} / ${c.auraLimitFinal}`;

  const fired = [...c.allFiredStatuses];
  const three = [...fired, '', '', ''].slice(0, 3);
  $('asm-status-slots').innerHTML = three
    .map((name) => {
      if (!name) {
        return `<div class="status-slot muted" style="min-height:3rem;"><span>⬡</span><span>—</span></div>`;
      }
      const st = game.statusByName.get(name);
      const ic = st?.icon || '⚠';
      const fatal = level.criticalStatuses.includes(name);
      return `<div class="status-slot ${fatal ? 'filled' : ''}" style="min-height:3rem;border-color:${
        fatal ? 'var(--pink)' : 'var(--border)'
      }"><span class="ic">${escapeHtml(ic)}</span><span>${escapeHtml(name)}</span></div>`;
    })
    .join('');

  const slotEl = $('asm-slots');
  slotEl.innerHTML = '';
  appendOptionalMatrixRack(slotEl, level);
  let lastMatrix = '';
  const vSlots = visibleSlotDefs(level);
  for (const sl of vSlots) {
    if (sl.matrixLabel !== lastMatrix) {
      lastMatrix = sl.matrixLabel;
      const headRow = document.createElement('div');
      headRow.className = 'matrix-block-head';

      const titleCol = document.createElement('div');
      titleCol.className = 'matrix-block-title-col';
      const title = document.createElement('div');
      title.className = 'section-title matrix-block-title';
      title.style.marginTop = '0';
      title.style.color = 'var(--dim)';
      title.textContent = sl.matrixLabel;
      titleCol.appendChild(title);

      const slotIdx =
        !sl.isPreinstalled ? optionalMatrixSlots.findIndex((id) => id === sl.instanceId) : -1;

      if (!sl.isPreinstalled && slotIdx >= 0) {
        const g = matrixInstallGold(level, sl.instanceId);
        const costRow = document.createElement('div');
        costRow.className = 'matrix-block-cost-row';
        costRow.textContent = `● ${g} зол. за вход`;
        titleCol.appendChild(costRow);

        const actions = document.createElement('div');
        actions.className = 'matrix-slot-actions matrix-block-actions';
        const swapBtn = document.createElement('button');
        swapBtn.type = 'button';
        swapBtn.className = 'matrix-slot-action';
        swapBtn.textContent = 'Сменить';
        swapBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectedMatrixSlotIndex = slotIdx;
          selectedSlotId = null;
          renderAssembly();
          openMatrixPicker(slotIdx);
        });
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'matrix-slot-action danger';
        clearBtn.textContent = 'Снять';
        clearBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          optionalMatrixSlots[slotIdx] = null;
          selectedMatrixSlotIndex = null;
          selectedSlotId = null;
          syncPlacementsAfterMatrixChange();
          renderAssembly();
        });
        actions.appendChild(swapBtn);
        actions.appendChild(clearBtn);
        headRow.appendChild(titleCol);
        headRow.appendChild(actions);
      } else {
        headRow.appendChild(titleCol);
      }

      slotEl.appendChild(headRow);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn' + (selectedSlotId === sl.slotId ? ' selected' : '');
    const pid = placements[sl.slotId];
    const card = pid ? findCard(pid) : null;
    const healLine =
      card && (card.treatmentTags || []).length
        ? `<div class="heal-mini">💊 ${escapeHtml((card.treatmentTags || []).join(' · '))}</div>`
        : '';
    btn.innerHTML = `<div class="st">${escapeHtml(sl.slotType)}</div><div class="cn">${
      card ? escapeHtml(card.name) : '— пусто —'
    }</div>${healLine}`;
    btn.addEventListener('click', () => {
      if (pid) {
        placements[sl.slotId] = null;
        selectedSlotId = null;
        renderAssembly();
        return;
      }
      selectedSlotId = sl.slotId;
      renderAssembly();
      openPicker(sl);
    });
    slotEl.appendChild(btn);
  }
}

function openMatrixPicker(slotIndex) {
  selectedMatrixSlotIndex = slotIndex;
  selectedSlotId = null;
  const level = currentLevel;
  if (!level) return;
  const opts = level.matrixInstancesOptional ?? [];
  const slots = optionalMatrixSlots;
  const taken = new Set();
  for (let i = 0; i < slots.length; i++) {
    if (i !== slotIndex && slots[i]) taken.add(slots[i]);
  }
  const candidates = opts.filter((o) => !taken.has(o.instance_id));

  $('picker-title').textContent = `Матрица · слот ${slotIndex + 1} / ${slots.length}`;
  const list = $('picker-list');
  list.innerHTML = '';

  if (!candidates.length) {
    const p = document.createElement('p');
    p.style.color = 'var(--dim)';
    p.textContent = 'Нет доступных матриц (все уже в других слотах или список пуст).';
    list.appendChild(p);
  }

  for (const o of candidates) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'picker-card';
    const g = matrixInstallGold(level, o.instance_id);
    b.innerHTML = `<div class="nm">${escapeHtml(o.preset_name)}</div>
      <div class="cost">● ${g} зол. за установку</div>
      <div class="heal-tags" style="color:var(--dim);font-weight:400;font-size:0.74rem">${escapeHtml(
      o.instance_id
    )} · ${escapeHtml(o.preset_id)}</div>`;
    b.addEventListener('click', () => {
      optionalMatrixSlots[slotIndex] = o.instance_id;
      $('picker-overlay').classList.remove('open');
      selectedMatrixSlotIndex = null;
      syncPlacementsAfterMatrixChange();
      renderAssembly();
    });
    list.appendChild(b);
  }

  $('picker-overlay').classList.add('open');
}

function openPicker(slot) {
  selectedMatrixSlotIndex = null;
  selectedSlotId = slot.slotId;
  $('picker-title').textContent = `Слот ${slot.slotType}`;
  const list = $('picker-list');
  list.innerHTML = '';

  const placed = new Set(Object.values(placements).filter(Boolean));
  const candidates = allCards().filter((card) => {
    if (!cardAvailableOnLevel(card, currentLevel, game.orderMap)) return false;
    if (!cardFitsSlot(card, slot.slotType)) return false;
    if (placed.has(card.id) && placements[slot.slotId] !== card.id) return false;
    return true;
  });

  if (!candidates.length) {
    const p = document.createElement('p');
    p.style.color = 'var(--dim)';
    p.textContent = 'Нет доступных карт для этого слота.';
    list.appendChild(p);
  }

  for (const card of candidates) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'picker-card';
    const debuffs = (card.addsDebts || []).map((d) => d.statusIfUnresolved).filter(Boolean);
    const debStr = debuffs.length ? debuffs.join(', ') : '—';
    const healTags = (card.treatmentTags || []).filter(Boolean);
    const healStr = healTags.length ? healTags.join(' · ') : '—';
    b.innerHTML = `<div class="nm">${escapeHtml(card.name)}</div>
      <div class="cost">● ${card.currencies.gold} &nbsp; ◆ ${card.currencies.aura}${
      card.auraLimitDelta ? ` &nbsp; лимит ауры ${card.auraLimitDelta >= 0 ? '+' : ''}${card.auraLimitDelta}` : ''
    }</div>
      <div class="heal-tags">Лекарства (теги с клетки): ${escapeHtml(healStr)}</div>
      <div class="cost" style="font-size:0.72rem">Дебафы клетки: ${escapeHtml(debStr)}</div>
      <div class="desc">${escapeHtml(card.description || '')}</div>`;
    b.addEventListener('click', () => {
      placements[slot.slotId] = card.id;
      $('picker-overlay').classList.remove('open');
      renderAssembly();
    });
    list.appendChild(b);
  }

  $('picker-overlay').classList.add('open');
}

/** Справочник проходов из «Алхимия систем - Решения.csv» (инструкция + эффект решения). */
function appendBulletedBlock(container, titleText, pipeText) {
  const wrap = document.createElement('div');
  wrap.className = 'sol-subblock';
  const lab = document.createElement('div');
  lab.className = 'sol-label';
  lab.textContent = titleText;
  wrap.appendChild(lab);
  const ul = document.createElement('ul');
  ul.className = 'sol-ul';
  const parts = splitPipe(pipeText);
  if (!parts.length) {
    const li = document.createElement('li');
    li.textContent = '—';
    ul.appendChild(li);
  } else {
    for (const p of parts) {
      const li = document.createElement('li');
      li.textContent = p;
      ul.appendChild(li);
    }
  }
  wrap.appendChild(ul);
  container.appendChild(wrap);
}

function openSolutionsGuide() {
  selectedMatrixSlotIndex = null;
  selectedSlotId = null;
  const level = currentLevel;
  if (!level || !game) return;

  $('picker-title').textContent = 'Как пройти';
  const list = $('picker-list');
  list.innerHTML = '';

  const intro = document.createElement('p');
  intro.className = 'sol-intro';
  intro.textContent =
    'Текст из таблицы «Решения»: цепочка причин, бюджет из строки, матрицы и пошаговая сборка карт по слотам.';
  list.appendChild(intro);

  const rows = game.solutionsByLevel[level.id] ?? [];
  if (!rows.length) {
    const p = document.createElement('p');
    p.style.color = 'var(--dim)';
    p.textContent = `В «Алхимия систем - Решения.csv» нет строк с level_id = ${level.id}.`;
    list.appendChild(p);
  } else {
    for (const sol of rows) {
      const block = document.createElement('div');
      block.className = 'sol-block';

      const name = document.createElement('div');
      name.className = 'sol-name';
      name.textContent = sol.scenarioName || 'Сценарий';
      block.appendChild(name);

      if (sol.why) {
        const why = document.createElement('p');
        why.className = 'sol-why';
        why.textContent = sol.why;
        block.appendChild(why);
      }

      const budget = document.createElement('div');
      budget.className = 'sol-budget';
      budget.innerHTML = `<strong>Бюджет</strong> (из таблицы): ${escapeHtml(sol.budgetGold || '—')} зол. · ${escapeHtml(
        sol.budgetAura || '—'
      )} ауры`;
      block.appendChild(budget);

      appendBulletedBlock(block, 'Матрицы', sol.matrices);
      appendBulletedBlock(block, 'Сборка (слот ← карта)', sol.assembly);

      list.appendChild(block);
    }
  }

  $('picker-overlay').classList.add('open');
}

function commitAssembly() {
  const level = currentLevel;
  const c = computePlacement(game, level, placements, installedOptionalMatrixIdsFromSlots());
  lastCompute = c;
  const ok = isSuccessfulPlacement(level, c);

  $('result-tags').textContent = `Уровень ${level.order}`;
  const title = $('result-title');
  const body = $('result-body');
  if (ok) {
    title.textContent = 'ПОБЕДА';
    title.className = 'result-title win';
    body.textContent = level.success_text_1 || 'Уровень пройден.';
  } else {
    title.textContent = 'НЕУДАЧА';
    title.className = 'result-title lose';
    const parts = [];
    const fatals = [...new Set(c.fatalStatuses)];
    if (fatals.length) {
      parts.push('<div class="fail-blocks">');
      for (const sid of fatals) {
        parts.push(`<div class="fail-block">${resolveFailNarrative(level.id, sid)}</div>`);
      }
      parts.push('</div>');
    }
    if (c.coinsSpent > level.budget.gold) {
      parts.push(`<p>Потрачено золота: ${c.coinsSpent} / ${level.budget.gold}</p>`);
    }
    if (c.auraTotal > c.auraLimitFinal) {
      parts.push(`<p>Аура: ${c.auraTotal} / ${c.auraLimitFinal}</p>`);
    }
    if (c.missingRequirements.length) {
      parts.push('<p>Не выполнены требования (в CSV их нет — сообщите автору).</p>');
    }
    body.innerHTML = parts.join('') || '<p>Сборка не прошла проверку.</p>';
  }

  const nextBtn = $('result-next');
  const nextLv = game.levels.find((l) => l.order === level.order + 1);
  if (ok && nextLv) {
    nextBtn.textContent = `К уровню ${nextLv.order}`;
    nextBtn.onclick = () => {
      currentLevel = nextLv;
      optionalMatrixSlots = initOptionalMatrixSlots(currentLevel);
      selectedSlotId = null;
      selectedMatrixSlotIndex = null;
      initPlacementsFromVisibleSlots();
      openBriefing(currentLevel);
      showScreen('screen-briefing');
    };
  } else {
    nextBtn.textContent = 'Ещё раз';
    nextBtn.onclick = () => openAssembly();
  }

  showScreen('screen-result');
}

function wire() {
  $('brief-back').addEventListener('click', renderLobby);
  $('brief-play').addEventListener('click', openAssembly);
  $('asm-menu').addEventListener('click', renderLobby);
  $('asm-clear').addEventListener('click', () => {
    if (selectedSlotId && placements[selectedSlotId]) {
      placements[selectedSlotId] = null;
    }
    renderAssembly();
  });
  $('asm-commit').addEventListener('click', commitAssembly);
  $('asm-solutions-btn').addEventListener('click', openSolutionsGuide);
  $('result-lobby').addEventListener('click', renderLobby);
  $('picker-close').addEventListener('click', () => {
    $('picker-overlay').classList.remove('open');
    selectedMatrixSlotIndex = null;
    renderAssembly();
  });
  $('picker-overlay').addEventListener('click', (e) => {
    if (e.target === $('picker-overlay')) {
      $('picker-overlay').classList.remove('open');
      selectedMatrixSlotIndex = null;
      renderAssembly();
    }
  });
}

async function main() {
  wire();
  try {
    const csv = await loadAllCsv();
    game = buildGameData(csv);
    const boot = document.getElementById('boot-msg');
    if (boot) boot.remove();
    renderLobby();
  } catch (e) {
    console.error(e);
    const boot = document.getElementById('boot-msg');
    if (boot) boot.remove();
    $('load-error-text').textContent =
      (e && e.message) || String(e) + ' — откройте через локальный сервер (например python3 -m http.server).';
    showScreen('load-error');
  }
}

main();
