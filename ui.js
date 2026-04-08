// TechnoMage Platform — UI Layer
// Handles all DOM rendering and user interaction.

import { Engine } from './engine.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const engine = new Engine();

engine.init().then(() => {
  renderPhase();
}).catch(err => {
  document.body.innerHTML = `<div class="fatal-error">Ошибка загрузки данных: ${err.message}</div>`;
});

// ─── Phase dispatcher ─────────────────────────────────────────────────────────

function renderPhase() {
  const { phase } = engine.state;
  hide('screen-briefing');
  hide('screen-assembly');
  hide('screen-result');

  if (phase === 'BRIEFING') renderBriefing();
  else if (phase === 'ASSEMBLY') renderAssembly();
  else if (phase === 'RESULT') renderResult();
}

// ─── Screen: Briefing ─────────────────────────────────────────────────────────

function renderBriefing() {
  show('screen-briefing');
  const level = engine.currentLevel;
  const data = engine.data;

  qs('#briefing-level-num').textContent = `Уровень ${level.order}`;
  qs('#briefing-level-name').textContent = level.name;
  qs('#briefing-client').textContent = `Заказчик: ${level.clientName}`;
  qs('#briefing-description').textContent = level.description;

  // Requirements
  const reqList = qs('#briefing-requirements');
  reqList.innerHTML = '';
  for (const req of level.requirements) {
    const li = el('li');
    li.innerHTML = `<span class="req-icon">◆</span> ${req.label}`;
    reqList.appendChild(li);
  }

  // Budget & risk
  qs('#briefing-budget').textContent = `${level.budgetGold} ⚗ золота`;
  qs('#briefing-risk').textContent = `до ${level.riskLimit} ☠ риска`;

  // "Князь не простит"
  const kpContainer = qs('#briefing-critical');
  kpContainer.innerHTML = '';
  for (const statusId of level.criticalStatuses) {
    const status = engine.statusById(statusId);
    if (!status) continue;
    const badge = el('div', 'critical-badge');
    badge.setAttribute('title', status.name);
    badge.innerHTML = `<span class="status-icon">${status.icon}</span><span class="status-label">${status.name}</span>`;
    kpContainer.appendChild(badge);
  }

  // Hints
  const hintBox = qs('#briefing-hints');
  hintBox.innerHTML = '';
  for (const hint of level.hints ?? []) {
    const p = el('p', 'hint-line');
    p.textContent = `💡 ${hint}`;
    hintBox.appendChild(p);
  }

  qs('#btn-start-assembly').onclick = () => {
    engine.startAssembly();
    renderPhase();
  };
}

// ─── Screen: Assembly ─────────────────────────────────────────────────────────

let selectedSpellId = null; // for click-to-place

function renderAssembly() {
  show('screen-assembly');
  selectedSpellId = null;

  renderSidebar();
  renderHUD();
  renderMatrices();
  renderSpellPanel();

  qs('#btn-launch').onclick = () => {
    engine.evaluate();
    renderPhase();
  };
}

function renderSidebar() {
  const level = engine.currentLevel;

  qs('#sidebar-level-num').textContent = `Уровень ${level.order}`;
  qs('#sidebar-level-name').textContent = level.name;
  qs('#sidebar-client').textContent = level.clientName;
  qs('#sidebar-description').textContent = level.description;

  // Requirements
  const reqList = qs('#sidebar-requirements');
  reqList.innerHTML = '';
  for (const req of level.requirements) {
    const li = el('li', 'sidebar-req-item');
    li.innerHTML = `<span class="req-icon">◆</span> ${req.label}`;
    reqList.appendChild(li);
  }

  // Critical statuses
  const kpContainer = qs('#sidebar-critical');
  kpContainer.innerHTML = '';
  for (const statusId of level.criticalStatuses) {
    const status = engine.statusById(statusId);
    if (!status) continue;
    const badge = el('div', 'sidebar-critical-badge');
    badge.innerHTML = `<span>${status.icon}</span><span>${status.name}</span>`;
    kpContainer.appendChild(badge);
  }

  // Hints
  const hintBox = qs('#sidebar-hints');
  hintBox.innerHTML = '';
  for (const hint of level.hints ?? []) {
    const p = el('p', 'sidebar-hint-line');
    p.textContent = `💡 ${hint}`;
    hintBox.appendChild(p);
  }
}

function renderHUD() {
  const level = engine.currentLevel;
  const live = engine.computeLiveState();

  qs('#hud-level-name').textContent = level.name;

  // Gold
  const goldEl = qs('#hud-gold');
  goldEl.textContent = `⚗ ${live.goldRemaining} / ${live.budgetGold}`;
  goldEl.className = 'hud-resource' + (live.goldRemaining < 0 ? ' danger' : live.goldRemaining <= 2 ? ' warn' : '');

  // Risk
  const riskEl = qs('#hud-risk');
  riskEl.textContent = `☠ ${live.riskTotal} / ${live.riskLimit}`;
  riskEl.className = 'hud-resource' + (live.riskTotal > live.riskLimit ? ' danger' : live.riskTotal >= live.riskLimit ? ' warn' : '');

  // Active statuses
  const statusBar = qs('#hud-statuses');
  statusBar.innerHTML = '';
  if (live.activeStatuses.length === 0) {
    statusBar.innerHTML = '<span class="status-clear">Долгов нет</span>';
  } else {
    for (const sid of live.activeStatuses) {
      const status = engine.statusById(sid);
      if (!status) continue;
      const isFatal = live.fatalStatuses.includes(sid);
      const badge = el('span', `status-badge${isFatal ? ' status-fatal' : ' status-warn'}`);
      badge.setAttribute('title', `${status.name}${isFatal ? ' — КРИТИЧНО!' : ' — добавляет риск'}`);
      badge.textContent = status.icon;
      statusBar.appendChild(badge);
    }
  }

  // "Князь не простит" reminder
  const kpBar = qs('#hud-critical');
  kpBar.innerHTML = '';
  for (const sid of live.criticalStatuses) {
    const status = engine.statusById(sid);
    if (!status) continue;
    const isFired = live.activeStatuses.includes(sid);
    const badge = el('span', `critical-mini${isFired ? ' fired' : ''}`);
    badge.setAttribute('title', status.name);
    badge.textContent = status.icon;
    kpBar.appendChild(badge);
  }
}

function renderMatrices() {
  const level = engine.currentLevel;
  const container = qs('#assembly-matrices');
  container.innerHTML = '';

  for (const matInst of level.availableMatrices) {
    const matDef = engine.matrixById(matInst.matrixId);
    if (!matDef) continue;

    const block = el('div', 'matrix-block');
    block.dataset.matrixId = matInst.instanceId;

    const header = el('div', 'matrix-header');
    header.innerHTML = `<span class="matrix-icon">${matDef.icon}</span>
      <span class="matrix-name">${matDef.name}</span>
      <span class="matrix-desc">${matDef.description}</span>`;
    block.appendChild(header);

    const slotsRow = el('div', 'matrix-slots');
    for (const slot of matInst.slots) {
      slotsRow.appendChild(buildSlotEl(slot));
    }
    block.appendChild(slotsRow);
    container.appendChild(block);
  }
}

function buildSlotEl(slot) {
  const placedId = engine.state.placements[slot.slotId];
  const spell = placedId ? engine.spellById(placedId) : null;

  const slotEl = el('div', `slot${spell ? ' slot-filled' : ' slot-empty'}`);
  slotEl.dataset.slotId = slot.slotId;
  slotEl.dataset.slotType = slot.slotType;

  if (spell) {
    slotEl.innerHTML = `
      <div class="slot-spell-name">${spell.name}</div>
      <div class="slot-spell-cost">⚗${spell.costGold} ☠+${spell.riskDelta}</div>
    `;
    slotEl.title = spell.description;
    slotEl.onclick = () => {
      engine.removeSpell(slot.slotId);
      refreshAssembly();
    };
  } else {
    slotEl.innerHTML = `<div class="slot-type-label">${slotTypeLabel(slot.slotType)}</div>`;
    slotEl.title = `Слот: ${slot.slotType}`;

    // Drag-and-drop: drop target
    slotEl.addEventListener('dragover', e => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('spellId');
      const spell = engine.spellById(dragId);
      if (spell && spell.allowedSlotTypes.includes(slot.slotType)) {
        slotEl.classList.add('slot-drag-over');
      }
    });
    slotEl.addEventListener('dragleave', () => {
      slotEl.classList.remove('slot-drag-over');
    });
    slotEl.addEventListener('drop', e => {
      e.preventDefault();
      slotEl.classList.remove('slot-drag-over');
      const dragId = e.dataTransfer.getData('spellId');
      engine.placeSpell(slot.slotId, dragId);
      refreshAssembly();
    });

    // Click-to-place
    slotEl.onclick = () => {
      if (!selectedSpellId) return;
      engine.placeSpell(slot.slotId, selectedSpellId);
      selectedSpellId = null;
      refreshAssembly();
    };
  }

  return slotEl;
}

function renderSpellPanel() {
  const level = engine.currentLevel;
  const container = qs('#assembly-spells');
  container.innerHTML = '';

  const placed = new Set(engine.placedSpellIds());

  for (const spellId of level.availableSpells) {
    const spell = engine.spellById(spellId);
    if (!spell) continue;
    const isPlaced = placed.has(spellId);
    const isSelected = selectedSpellId === spellId;

    const card = el('div', `spell-card${isPlaced ? ' spell-placed' : ''}${isSelected ? ' spell-selected' : ''}`);
    card.dataset.spellId = spellId;
    card.draggable = !isPlaced;

    const debtHints = (spell.addsDebts ?? []).map(d => {
      const st = engine.statusById(d.statusIfUnresolved);
      return st ? `${st.icon} ${st.name}` : d.statusIfUnresolved;
    }).join(', ');

    card.innerHTML = `
      <div class="spell-name">${spell.name}</div>
      <div class="spell-desc">${spell.description}</div>
      <div class="spell-meta">
        <span class="spell-cost">⚗ ${spell.costGold}</span>
        <span class="spell-risk ${spell.riskDelta > 0 ? 'has-risk' : ''}">☠ +${spell.riskDelta}</span>
        ${debtHints ? `<span class="spell-debt" title="Добавляет долг">${debtHints}</span>` : ''}
      </div>
      <div class="spell-slots">${spell.allowedSlotTypes.map(slotTypeLabel).join(' · ')}</div>
    `;

    if (!isPlaced) {
      // Drag start
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('spellId', spellId);
        card.classList.add('spell-dragging');
        highlightValidSlots(spell.allowedSlotTypes);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('spell-dragging');
        clearSlotHighlights();
      });

      // Click to select
      card.onclick = () => {
        if (selectedSpellId === spellId) {
          selectedSpellId = null;
        } else {
          selectedSpellId = spellId;
          highlightValidSlots(spell.allowedSlotTypes);
        }
        renderSpellPanel();
      };
    }

    container.appendChild(card);
  }
}

function highlightValidSlots(allowedTypes) {
  qsAll('.slot-empty').forEach(slotEl => {
    const type = slotEl.dataset.slotType;
    if (allowedTypes.includes(type)) {
      slotEl.classList.add('slot-valid');
    } else {
      slotEl.classList.add('slot-invalid');
    }
  });
}

function clearSlotHighlights() {
  qsAll('.slot-valid, .slot-invalid, .slot-drag-over').forEach(el => {
    el.classList.remove('slot-valid', 'slot-invalid', 'slot-drag-over');
  });
}

function refreshAssembly() {
  clearSlotHighlights();
  renderHUD();
  renderMatrices();
  renderSpellPanel();
}

// ─── Screen: Result ───────────────────────────────────────────────────────────

function renderResult() {
  show('screen-result');
  const result = engine.state.lastResult;
  const level = engine.currentLevel;

  const banner = qs('#result-banner');
  const title = qs('#result-title');

  if (result.success) {
    banner.className = 'result-banner success';
    title.textContent = '✦ Задача выполнена ✦';

    qs('#result-success-block').style.display = '';
    qs('#result-fail-block').style.display = 'none';

    qs('#result-client-report').textContent = result.successReport ?? '';
    qs('#result-success-stats').innerHTML =
      `Золото: ${result.goldSpent} / ${level.budgetGold} ⚗ &nbsp;·&nbsp; Риск: ${result.riskTotal} / ${level.riskLimit} ☠`;

    qs('#result-all-done').style.display = 'none';
    const btnNext = qs('#btn-next-level');
    if (engine.hasNextLevel) {
      btnNext.style.display = '';
      btnNext.onclick = () => {
        engine.nextLevel();
        renderPhase();
      };
    } else {
      btnNext.style.display = 'none';
      qs('#result-all-done').style.display = '';
    }
  } else {
    banner.className = 'result-banner fail';
    title.textContent = '✗ Провал';

    qs('#result-success-block').style.display = 'none';
    qs('#result-fail-block').style.display = '';
    qs('#result-all-done').style.display = 'none';

    renderFailReport(result, level);
  }

  qs('#btn-retry').onclick = () => {
    engine.retry();
    renderPhase();
  };
}

function renderFailReport(result, level) {
  // Block 1: missing requirements
  const reqBlock = qs('#result-req-block');
  const reqList = qs('#result-req-list');
  reqList.innerHTML = '';
  const reqReasons = result.failReasons.filter(r => r.type === 'REQ_MISSING');
  if (reqReasons.length > 0) {
    reqBlock.style.display = '';
    for (const r of reqReasons) {
      const req = level.requirements.find(req => req.id === r.reqId);
      const li = el('li', 'fail-item');
      li.innerHTML = `<span class="fail-icon">◆</span> Не выполнено: <strong>${req?.label ?? r.reqId}</strong>`;
      reqList.appendChild(li);
    }
  } else {
    reqBlock.style.display = 'none';
  }

  // Block 2: fatal statuses
  const statusBlock = qs('#result-status-block');
  const statusList = qs('#result-status-list');
  statusList.innerHTML = '';
  const statusReasons = result.failReasons.filter(r => r.type === 'FATAL_STATUS');

  // Also show non-fatal active statuses as warnings
  const fatalIds = new Set(statusReasons.map(r => r.statusId));
  const warnStatuses = result.activeStatuses.filter(s => !fatalIds.has(s));

  if (statusReasons.length > 0 || warnStatuses.length > 0) {
    statusBlock.style.display = '';
    for (const r of statusReasons) {
      const status = engine.statusById(r.statusId);
      const li = el('li', 'fail-item fail-fatal');
      li.innerHTML = `
        <span class="fail-icon">${status?.icon ?? '⚠'}</span>
        <div>
          <strong>${r.title}</strong> — <em>${r.failText}</em>
          <div class="fail-advice">${r.advice}</div>
        </div>`;
      statusList.appendChild(li);
    }
    for (const sid of warnStatuses) {
      const status = engine.statusById(sid);
      const tpl = engine.data.reportTemplates?.[sid] ?? {};
      const li = el('li', 'fail-item fail-warn');
      li.innerHTML = `
        <span class="fail-icon">${status?.icon ?? '⚠'}</span>
        <div>
          <strong>${tpl.title ?? sid}</strong> — добавил риск, но не был критичным.
          <div class="fail-advice">${tpl.advice ?? ''}</div>
        </div>`;
      statusList.appendChild(li);
    }
  } else {
    statusBlock.style.display = 'none';
  }

  // Block 3: resources
  const resBlock = qs('#result-res-block');
  const resList = qs('#result-res-list');
  resList.innerHTML = '';
  const budgetReason = result.failReasons.find(r => r.type === 'BUDGET_EXCEEDED');
  const riskReason = result.failReasons.find(r => r.type === 'RISK_EXCEEDED');

  if (budgetReason || riskReason) {
    resBlock.style.display = '';
    if (budgetReason) {
      const li = el('li', 'fail-item fail-fatal');
      li.innerHTML = `<span class="fail-icon">⚗</span> Бюджет превышен: потрачено <strong>${budgetReason.goldSpent}</strong> из <strong>${budgetReason.budgetGold}</strong> золота`;
      resList.appendChild(li);
    }
    if (riskReason) {
      const li = el('li', 'fail-item fail-fatal');
      li.innerHTML = `<span class="fail-icon">☠</span> Риск превышен: <strong>${riskReason.riskTotal}</strong> из <strong>${riskReason.riskLimit}</strong>`;
      resList.appendChild(li);
    }
  } else {
    // Show as info even on non-resource failures
    resBlock.style.display = '';
    resList.innerHTML = `<li class="fail-item fail-info">
      <span class="fail-icon">ℹ</span> Золото: ${result.goldSpent} / ${level.budgetGold} ⚗ &nbsp;·&nbsp; Риск: ${result.riskTotal} / ${level.riskLimit} ☠
    </li>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qs(sel) { return document.querySelector(sel); }
function qsAll(sel) { return document.querySelectorAll(sel); }
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

const SLOT_TYPE_LABELS = {
  OBS_LOGS:      'Логи',
  OBS_FILTERS:   'Фильтры',
  OBS_ALERTS:    'Алерты',
  OBS_TRACING:   'Трейсинг',
  ST_RETENTION:  'Хранение',
  ST_INDEX:      'Индекс',
  ST_QUOTA:      'Квоты',
  ST_SECRETS:    'Секреты',
  NET_AUTH:      'Доступ',
  NET_ROUTING:   'Маршруты',
  NET_DISCOVERY: 'Discovery',
  NET_DNS:       'DNS',
  NET_TLS:       'TLS',
  CD_PIPELINE:   'Pipeline',
  CD_GATES:      'Гейты',
  CD_ROLLBACK:   'Откат',
  CD_TESTING:    'Тесты',
};

function slotTypeLabel(type) {
  return SLOT_TYPE_LABELS[type] ?? type;
}
