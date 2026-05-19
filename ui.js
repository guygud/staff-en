// TechnoMage Platform — UI Layer
// Handles all DOM rendering and user interaction.

import { Engine } from './engine.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const engine = new Engine();

engine.init().then(() => {
  debtStatusMap = buildDebtStatusMap();
  renderDevNav();
  renderPhase();
}).catch(err => {
  document.body.innerHTML = `<div class="fatal-error">Ошибка загрузки данных: ${err.message}</div>`;
});

function renderDevNav() {
  const container = qs('#dev-nav-levels');
  if (!container) return;
  container.innerHTML = '';
  engine.data.levelCatalog.forEach((lvl, idx) => {
    const btn = el('button', 'dev-nav-btn');
    btn.textContent = `${lvl.order}`;
    btn.title = lvl.name;
    btn.onclick = () => {
      engine.state.currentLevelIndex = idx;
      engine.state.placements = {};
      engine.state.installedMatrixIds = [];
      engine.state.lastResult = null;
      engine.state.phase = 'BRIEFING';
      updateDevNav();
      renderPhase();
    };
    container.appendChild(btn);
  });
  updateDevNav();
}

function updateDevNav() {
  qsAll('.dev-nav-btn').forEach((btn, idx) => {
    btn.classList.toggle('dev-nav-active', idx === engine.state.currentLevelIndex);
  });
}

// ─── Phase dispatcher ─────────────────────────────────────────────────────────

function renderPhase() {
  const { phase } = engine.state;
  hide('screen-briefing');
  hide('screen-assembly');
  hide('screen-result');
  updateDevNav();

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
  qs('#briefing-budget').textContent = `${level.budget?.gold} ⚗ монет`;
  qs('#briefing-risk').textContent = `до ${level.budget?.aura} ☠ ауры`;

  // Стартовые дебафы (из defaultInstalled.addsDebts)
  const debuffsContainer = qs('#briefing-debuffs');
  debuffsContainer.innerHTML = '';
  const inheritedDebts = (level.defaultInstalled ?? []).flatMap(d => d.addsDebts ?? []);
  if (inheritedDebts.length === 0) {
    debuffsContainer.innerHTML = '<span class="no-debuffs">нет</span>';
  } else {
    for (const debt of inheritedDebts) {
      const status = engine.statusById(debt.statusIfUnresolved);
      const badge = el('div', 'critical-badge');
      badge.setAttribute('title', status ? status.name : debt.statusIfUnresolved);
      badge.innerHTML = `<span class="status-icon">${status ? status.icon : '⚠'}</span><span class="status-label">${status ? status.name : debt.statusIfUnresolved}</span>`;
      debuffsContainer.appendChild(badge);
    }
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

let selectedSpellId = null;   // for click-to-place
let selectedMatrixId = null;  // instanceId of a matrix card selected for click-to-install
let focusedSlotType = null;   // slot type clicked by user — filters the card panel

// debtId → statusId — built once from all addsDebts in catalogs + defaultInstalled
function capabilityLabel(capId) {
  return engine.data.capabilityLabels?.[capId] ?? capId;
}

function buildDebtStatusMap() {
  const map = {};
  const all = [...(engine.data.spellCatalog ?? []), ...(engine.data.obryadCatalog ?? [])];
  for (const c of all) {
    for (const d of c.addsDebts ?? []) map[d.id] = d.statusIfUnresolved;
  }
  for (const l of engine.data.levelCatalog ?? []) {
    for (const inst of l.defaultInstalled ?? []) {
      for (const d of inst.addsDebts ?? []) map[d.id] = d.statusIfUnresolved;
    }
  }
  return map;
}
let debtStatusMap = null;

function renderAssembly() {
  show('screen-assembly');
  selectedSpellId = null;
  selectedMatrixId = null;

  renderSidebar();
  renderHUD();
  renderMatrices();
  renderMatrixPanel();
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

  // Стартовые дебафы (сайдбар)
  const sidebarDebuffs = qs('#sidebar-debuffs');
  sidebarDebuffs.innerHTML = '';
  const sidebarDebts = (level.defaultInstalled ?? []).flatMap(d => d.addsDebts ?? []);
  if (sidebarDebts.length === 0) {
    sidebarDebuffs.innerHTML = '<span class="no-debuffs">нет</span>';
  } else {
    for (const debt of sidebarDebts) {
      const status = engine.statusById(debt.statusIfUnresolved);
      const badge = el('div', 'sidebar-critical-badge');
      badge.innerHTML = `<span>${status ? status.icon : '⚠'}</span><span>${status ? status.name : debt.statusIfUnresolved}</span>`;
      sidebarDebuffs.appendChild(badge);
    }
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

  // Coins: show spent / budget
  const goldEl = qs('#hud-gold');
  const coinsOver = live.coinsSpent > live.coinsBudget;
  goldEl.textContent = `⚗ ${live.coinsSpent} / ${live.coinsBudget}`;
  goldEl.className = 'hud-resource' + (coinsOver ? ' danger' : live.coinsRemaining <= 2 ? ' warn' : '');

  // Aura: show accumulated / limit
  const riskEl = qs('#hud-risk');
  const auraOver = live.auraTotal > live.auraLimit;
  const auraWarn = live.auraTotal >= live.auraLimit;
  riskEl.textContent = `☠ ${live.auraTotal} / ${live.auraLimit}`;
  riskEl.className = 'hud-resource' + (auraOver ? ' danger' : auraWarn ? ' warn' : live.auraTotal < 0 ? ' good' : '');

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

  // hud-critical removed
}

function renderMatrices() {
  const container = qs('#assembly-matrices');
  container.innerHTML = '';

  // Make the board a drop target for matrix cards
  container.ondragover = e => {
    if (e.dataTransfer.types.includes('matrixinstanceid')) {
      e.preventDefault();
      container.classList.add('board-drag-over');
    }
  };
  container.ondragleave = () => container.classList.remove('board-drag-over');
  container.ondrop = e => {
    container.classList.remove('board-drag-over');
    const instanceId = e.dataTransfer.getData('matrixInstanceId');
    if (instanceId) {
      e.preventDefault();
      engine.installMatrix(instanceId);
      refreshAssembly();
    }
  };

  // Show empty-board hint on L3 when nothing is installed yet
  const board = engine.boardMatrices();
  if (board.length === 0) {
    const hint = el('div', 'matrices-empty-hint');
    hint.textContent = 'Выбери матрицы из панели справа и установи их на доску.';
    container.appendChild(hint);
    return;
  }

  for (const matInst of board) {
    const matDef = engine.matrixById(matInst.matrixId);
    if (!matDef) continue;

    const isLocked = matInst.preInstalled !== false;
    const block = el('div', `matrix-block${isLocked ? ' matrix-locked' : ''}`);
    block.dataset.matrixId = matInst.instanceId;

    const header = el('div', 'matrix-header');

    // Remove button — only for optional, installed, empty matrices
    let removeBtnHtml = '';
    if (!isLocked) {
      const hasSpells = matInst.slots.some(s => engine.state.placements[s.slotId]);
      removeBtnHtml = `<button class="matrix-remove-btn${hasSpells ? ' disabled' : ''}"
        data-instance="${matInst.instanceId}"
        title="${hasSpells ? 'Сначала убери заклинания' : 'Убрать матрицу'}">×</button>`;
    } else {
      removeBtnHtml = `<span class="matrix-lock-icon" title="Предустановлено">🔒</span>`;
    }

    header.innerHTML = `<span class="matrix-icon">${matDef.icon}</span>
      <span class="matrix-name">${matDef.name}</span>
      <span class="matrix-desc">${matDef.description}</span>
      ${removeBtnHtml}`;

    if (!isLocked) {
      const btn = header.querySelector('.matrix-remove-btn');
      if (btn && !btn.classList.contains('disabled')) {
        btn.onclick = e => {
          e.stopPropagation();
          engine.uninstallMatrix(matInst.instanceId);
          refreshAssembly();
        };
      }
    }

    block.appendChild(header);

    const slotsRow = el('div', 'matrix-slots');
    for (const slot of matInst.slots) {
      slotsRow.appendChild(buildSlotEl(slot));
    }
    block.appendChild(slotsRow);
    container.appendChild(block);
  }
}

function renderMatrixPanel() {
  const toInstall = engine.availableToInstall();
  const panel = qs('#assembly-matrix-panel');

  if (!panel) return;

  if (toInstall.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  const list = qs('#assembly-matrix-cards');
  list.innerHTML = '';

  for (const matInst of toInstall) {
    const matDef = engine.matrixById(matInst.matrixId);
    if (!matDef) continue;

    const isSelected = selectedMatrixId === matInst.instanceId;
    const card = el('div', `matrix-card${isSelected ? ' matrix-card-selected' : ''}`);
    card.dataset.instanceId = matInst.instanceId;
    card.draggable = true;

    card.innerHTML = `
      <div class="matrix-card-header">
        <span class="matrix-card-icon">${matDef.icon}</span>
        <span class="matrix-card-name">${matDef.name}</span>
        <span class="matrix-card-cost">⚗ ${matInst.installCostGold ?? 0}</span>
      </div>
      <div class="matrix-card-desc">${matDef.description}</div>
      <div class="matrix-card-slots">${matInst.slots.map(s => slotTypeLabel(s.slotType)).join(' · ')}</div>
    `;

    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('matrixInstanceId', matInst.instanceId);
      card.classList.add('matrix-card-dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('matrix-card-dragging');
    });

    card.onclick = () => {
      if (selectedMatrixId === matInst.instanceId) {
        selectedMatrixId = null;
      } else {
        selectedSpellId = null;
        selectedMatrixId = matInst.instanceId;
        engine.installMatrix(matInst.instanceId);
        selectedMatrixId = null;
        refreshAssembly();
        return;
      }
      renderMatrixPanel();
    };

    list.appendChild(card);
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
      <div class="slot-spell-cost">⚗${spell.currencies?.gold ?? 0} ☠+${spell.currencies?.aura ?? 0}</div>
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

    // Click-to-place or focus slot to filter card panel
    slotEl.onclick = () => {
      if (selectedSpellId) {
        engine.placeSpell(slot.slotId, selectedSpellId);
        selectedSpellId = null;
        focusedSlotType = null;
        refreshAssembly();
      } else {
        // Toggle slot focus for card filtering
        focusedSlotType = focusedSlotType === slot.slotType ? null : slot.slotType;
        refreshAssembly();
      }
    };
  }

  return slotEl;
}

function renderSpellPanel() {
  const level = engine.currentLevel;
  const container = qs('#assembly-spells');
  container.innerHTML = '';

  // Slot filter label
  const filterLabel = qs('#spell-slot-filter-label');
  if (focusedSlotType) {
    filterLabel.textContent = `→ ${slotTypeLabel(focusedSlotType)}`;
    filterLabel.style.display = '';
  } else {
    filterLabel.style.display = 'none';
  }

  const placed = new Set(engine.placedSpellIds());

  for (const spellId of level.availableSpells) {
    const spell = engine.spellById(spellId);
    if (!spell) continue;
    // Filter: hide cards incompatible with focused slot
    if (focusedSlotType && !spell.allowedSlotTypes.includes(focusedSlotType)) continue;
    const isPlaced = placed.has(spellId);
    const isSelected = selectedSpellId === spellId;

    const card = el('div', `spell-card${isPlaced ? ' spell-placed' : ''}${isSelected ? ' spell-selected' : ''}`);
    card.dataset.spellId = spellId;
    card.draggable = !isPlaced;

    const debtHints = (spell.addsDebts ?? []).map(d => {
      const st = engine.statusById(d.statusIfUnresolved);
      return st ? `${st.icon} ${st.name}` : d.statusIfUnresolved;
    }).join(', ');

    const resolveHints = [...new Set(
      (spell.resolvesDebts ?? [])
        .map(did => debtStatusMap?.[did])
        .filter(Boolean)
    )].map(sid => {
      const st = engine.statusById(sid);
      return st ? `${st.icon} ${st.name}` : sid;
    }).join(', ');

    const buffHints = (spell.buffs ?? []).map(b => `<span class="spell-buff">✨ ${b}</span>`).join('');

    card.innerHTML = `
      <div class="spell-name">${spell.name}</div>
      <div class="spell-desc">${spell.description}</div>
      <div class="spell-effects">
        ${buffHints}
      </div>
      <div class="spell-meta">
        <span class="spell-cost">⚗ ${spell.currencies?.gold ?? 0}</span>
        <span class="spell-risk ${(spell.currencies?.aura ?? 0) > 0 ? 'has-risk' : ''}">☠ +${spell.currencies?.aura ?? 0}</span>
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

  // ── Обряды ──────────────────────────────────────────────────────────────────
  const obryadSection = qs('#assembly-obryads-section');
  const obryadContainer = qs('#assembly-obryads');
  const availableObryads = level.availableObryads ?? [];

  if (availableObryads.length === 0) {
    obryadSection.style.display = 'none';
  } else {
    obryadSection.style.display = '';
    obryadContainer.innerHTML = '';

    for (const obryadId of availableObryads) {
      const obryad = engine.cardById(obryadId);
      if (!obryad) continue;
      // Filter by focused slot
      if (focusedSlotType && !obryad.allowedSlotTypes.includes(focusedSlotType)) continue;
      const isPlaced = placed.has(obryadId);
      const isSelected = selectedSpellId === obryadId;

      const card = el('div', `spell-card obryad-card${isPlaced ? ' spell-placed' : ''}${isSelected ? ' spell-selected' : ''}`);
      card.dataset.spellId = obryadId;
      card.draggable = !isPlaced;

      const effectParts = [];
      const oGold = obryad.currencies?.gold ?? 0;
      const oAura = obryad.currencies?.aura ?? 0;
      if (oGold !== 0) effectParts.push(`<span class="spell-cap obryad-coins">✨ ${oGold > 0 ? '+' : ''}${oGold} монет</span>`);
      if (oAura !== 0) effectParts.push(`<span class="spell-cap ${oAura > 0 ? 'obryad-aura-neg' : 'obryad-aura-pos'}">✨ ${oAura > 0 ? '+' : ''}${oAura} ауры</span>`);
      if (obryad.auraLimitDelta)  effectParts.push(`<span class="spell-cap obryad-coins">✨ лимит ауры +${obryad.auraLimitDelta}</span>`);
      const obryadBuffHints = (obryad.buffs ?? []).map(b => `<span class="spell-buff">✨ ${b}</span>`).join('');

      const obryadDebtHints = (obryad.addsDebts ?? []).map(d => {
        const st = engine.statusById(d.statusIfUnresolved);
        return st ? `${st.icon} ${st.name}` : d.statusIfUnresolved;
      }).join(', ');

      card.innerHTML = `
        <div class="spell-name">${obryad.name}</div>
        <div class="spell-desc">${obryad.description ?? ''}</div>
        <div class="spell-effects">
          ${effectParts.join('')}${obryadBuffHints}
        </div>
        <div class="spell-meta">
          <span class="spell-cost">⚗ ${obryad.currencies?.gold ?? 0}</span>
          ${obryadDebtHints ? `<span class="spell-debt">${obryadDebtHints}</span>` : ''}
        </div>
        <div class="spell-slots">${(obryad.allowedSlotTypes ?? []).map(slotTypeLabel).join(' · ')}</div>
      `;

      if (!isPlaced) {
        card.addEventListener('dragstart', e => {
          e.dataTransfer.setData('spellId', obryadId);
          card.classList.add('spell-dragging');
          highlightValidSlots(obryad.allowedSlotTypes);
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('spell-dragging');
          clearSlotHighlights();
        });

        card.onclick = () => {
          if (selectedSpellId === obryadId) {
            selectedSpellId = null;
          } else {
            selectedSpellId = obryadId;
            highlightValidSlots(obryad.allowedSlotTypes);
          }
          renderSpellPanel();
        };
      }

      obryadContainer.appendChild(card);
    }

    // If filter hid all obryads, hide section
    if (obryadContainer.children.length === 0) {
      obryadSection.style.display = 'none';
    }
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
  // Highlight focused slot type if still active
  if (focusedSlotType) highlightValidSlots([focusedSlotType]);
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
      `Монеты: ${result.coinsSpent} / ${level.budget?.gold} ⚗ &nbsp;·&nbsp; Аура: ${result.auraTotal} / ${result.auraLimitFinal} ☠`;

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

  renderAssemblySummary();

  qs('#btn-retry').onclick = () => {
    engine.retry();
    renderPhase();
  };
}

function renderAssemblySummary() {
  const list = qs('#result-assembly-list');
  list.innerHTML = '';
  const level = engine.currentLevel;
  const placements = engine.state.placements ?? {};
  const installedIds = new Set(engine.state.installedMatrixIds ?? []);

  // Installed optional matrices
  for (const matInst of level.availableMatrices ?? []) {
    if (matInst.preInstalled) continue;
    if (!installedIds.has(matInst.instanceId)) continue;
    const matDef = engine.matrixById(matInst.matrixId);
    const li = el('li', 'assembly-item assembly-item-matrix');
    li.innerHTML = `<span class="assembly-icon">${matDef?.icon ?? '🔷'}</span> <span class="assembly-name">${matDef?.name ?? matInst.matrixId}</span> <span class="assembly-cost">⚗ ${matInst.installCostGold ?? 0}</span>`;
    list.appendChild(li);
  }

  // Placed spells and obryads
  for (const [slotId, cardId] of Object.entries(placements)) {
    const spell = engine.spellById(cardId);
    if (!spell) continue;
    const li = el('li', 'assembly-item');
    const buffBadges = (spell.buffs ?? []).map(b => `<span class="assembly-buff">✨ ${b}</span>`).join('');
    li.innerHTML = `<span class="assembly-name">${spell.name}</span>${buffBadges}`;
    list.appendChild(li);
  }

  if (list.children.length === 0) {
    const li = el('li', 'assembly-item assembly-empty');
    li.textContent = 'Сборка пуста';
    list.appendChild(li);
  }
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
  const auraReason   = result.failReasons.find(r => r.type === 'AURA_EXCEEDED');

  if (budgetReason || auraReason) {
    resBlock.style.display = '';
    if (budgetReason) {
      const li = el('li', 'fail-item fail-fatal');
      li.innerHTML = `<span class="fail-icon">⚗</span> Бюджет превышен: потрачено <strong>${budgetReason.coinsSpent}</strong> из <strong>${budgetReason.coinsBudget}</strong> монет`;
      resList.appendChild(li);
    }
    if (auraReason) {
      const li = el('li', 'fail-item fail-fatal');
      li.innerHTML = `<span class="fail-icon">☠</span> Аура превышена: <strong>${auraReason.auraTotal}</strong> из <strong>${auraReason.auraLimit}</strong>`;
      resList.appendChild(li);
    }
  } else {
    resBlock.style.display = '';
    resList.innerHTML = `<li class="fail-item fail-info">
      <span class="fail-icon">ℹ</span> Монеты: ${result.coinsSpent} / ${level.budget?.gold} ⚗ &nbsp;·&nbsp; Аура: ${result.auraTotal} / ${result.auraLimitFinal} ☠
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
