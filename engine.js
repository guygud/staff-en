// TechnoMage Platform — Game Engine
// Pure data-driven engine. No DOM dependencies.

export class Engine {
  constructor() {
    this.data = null;
    this.state = null;
  }

  async init() {
    const resp = await fetch('./game-data.json');
    this.data = await resp.json();
    this.state = {
      currentLevelIndex: 0,
      phase: 'BRIEFING', // BRIEFING | ASSEMBLY | RESULT
      placements: {},    // { slotId: spellId }
      lastResult: null,
    };
    return this;
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  get currentLevel() {
    return this.data.levelCatalog[this.state.currentLevelIndex];
  }

  get hasNextLevel() {
    return this.state.currentLevelIndex < this.data.levelCatalog.length - 1;
  }

  spellById(id) {
    return this.data.spellCatalog.find(s => s.id === id) ?? null;
  }

  statusById(id) {
    return this.data.statusCatalog.find(s => s.id === id) ?? null;
  }

  matrixById(id) {
    return this.data.matrixCatalog.find(m => m.id === id) ?? null;
  }

  // ─── Placement helpers ────────────────────────────────────────────────────

  /** Returns all slots for the current level (flat list). */
  allSlots() {
    return this.currentLevel.availableMatrices.flatMap(m => m.slots);
  }

  /** Returns spell IDs of all currently placed spells. */
  placedSpellIds() {
    return Object.values(this.state.placements).filter(Boolean);
  }

  /**
   * Attempt to place a spell into a slot.
   * Returns { ok: true } or { ok: false, reason: string }.
   */
  placeSpell(slotId, spellId) {
    const level = this.currentLevel;
    const slot = this.allSlots().find(s => s.slotId === slotId);
    if (!slot) return { ok: false, reason: 'Слот не найден.' };

    const spell = this.spellById(spellId);
    if (!spell) return { ok: false, reason: 'Заклинание не найдено.' };

    if (!level.availableSpells.includes(spellId))
      return { ok: false, reason: 'Заклинание недоступно на этом уровне.' };

    if (!spell.allowedSlotTypes.includes(slot.slotType))
      return { ok: false, reason: `Это заклинание нельзя установить в слот типа ${slot.slotType}.` };

    // Unique check
    if (spell.unique !== false) {
      const alreadyPlaced = Object.entries(this.state.placements).some(
        ([sid, sp]) => sp === spellId && sid !== slotId
      );
      if (alreadyPlaced) return { ok: false, reason: 'Это заклинание уже используется.' };
    }

    this.state.placements = { ...this.state.placements, [slotId]: spellId };
    return { ok: true };
  }

  /** Remove spell from a slot. */
  removeSpell(slotId) {
    const next = { ...this.state.placements };
    delete next[slotId];
    this.state.placements = next;
  }

  // ─── Core computation (shared by evaluate + computeLiveState) ─────────────

  _compute(level, placements) {
    const spells = Object.values(placements)
      .filter(Boolean)
      .map(id => this.spellById(id))
      .filter(Boolean);

    // 1. Capabilities
    const capabilities = new Set(
      (level.defaultInstalled ?? []).flatMap(d => d.grantsCapabilities ?? [])
    );
    for (const sp of spells) {
      for (const ef of sp.effects ?? []) {
        if (ef.type === 'CAPABILITY') capabilities.add(ef.id);
      }
    }

    // 2. Debts
    const debtMap = new Map(); // debtId -> debt object
    for (const sp of spells) {
      for (const d of sp.addsDebts ?? []) {
        debtMap.set(d.id, d);
      }
    }

    // 3. Resolve debts
    for (const sp of spells) {
      for (const rid of sp.resolvesDebts ?? []) {
        debtMap.delete(rid);
      }
    }

    // 4. Conflicts (F2)
    const placedIds = new Set(Object.values(placements).filter(Boolean));
    const firedConflicts = []; // { pair, statusId }
    for (const pair of this.data.conflictPairs ?? []) {
      const bothPresent = pair.spells.every(id => placedIds.has(id));
      if (!bothPresent) continue;
      const resolved = (pair.resolvedBy ?? []).some(id => placedIds.has(id));
      if (!resolved) firedConflicts.push({ pair, statusId: pair.statusIfUnresolved });
    }

    // 5. All fired status IDs
    const allFiredStatuses = new Set([
      ...[...debtMap.values()].map(d => d.statusIfUnresolved),
      ...firedConflicts.map(c => c.statusId),
    ]);

    // 6. Split into critical / non-critical
    const criticalSet = new Set(level.criticalStatuses ?? []);
    const fatalStatuses = [...allFiredStatuses].filter(s => criticalSet.has(s));
    const nonCriticalStatuses = [...allFiredStatuses].filter(s => !criticalSet.has(s));

    // 7. Risk
    let riskTotal = spells.reduce((sum, sp) => sum + (sp.riskDelta ?? 0), 0);
    riskTotal += nonCriticalStatuses.length * (level.nonCriticalDebtRisk ?? 2);

    // 8. Gold (goldDelta on a spell reduces the total, e.g. AI buff rebate)
    const goldSpent = spells.reduce((sum, sp) => sum + (sp.costGold ?? 0) + (sp.goldDelta ?? 0), 0)
      + (level.availableMatrices ?? []).reduce((sum, m) => sum + (m.installCostGold ?? 0), 0);

    // 9. Missing requirements
    const missingRequirements = (level.requirements ?? []).filter(
      req => req.type === 'CAPABILITY_REQUIRED' && !capabilities.has(req.capabilityId)
    );

    return {
      capabilities,
      activeDebts: [...debtMap.values()],
      firedConflicts,
      allFiredStatuses: [...allFiredStatuses],
      fatalStatuses,
      nonCriticalStatuses,
      riskTotal,
      goldSpent,
      goldRemaining: level.budgetGold - goldSpent,
      missingRequirements,
    };
  }

  // ─── evaluate() ──────────────────────────────────────────────────────────

  evaluate() {
    const level = this.currentLevel;
    const c = this._compute(level, this.state.placements);
    const failReasons = [];

    // Category 1: missing requirements
    for (const req of c.missingRequirements) {
      failReasons.push({ type: 'REQ_MISSING', reqId: req.id, label: req.label });
    }

    // Category 2: fatal statuses
    for (const statusId of c.fatalStatuses) {
      const tpl = this.data.reportTemplates?.[statusId] ?? {};
      failReasons.push({
        type: 'FATAL_STATUS',
        statusId,
        title: tpl.title ?? statusId,
        failText: tpl.failText ?? '',
        advice: tpl.advice ?? '',
      });
    }

    // Category 3: budget / risk
    if (c.goldSpent > level.budgetGold) {
      failReasons.push({ type: 'BUDGET_EXCEEDED', goldSpent: c.goldSpent, budgetGold: level.budgetGold });
    }
    if (c.riskTotal > level.riskLimit) {
      failReasons.push({ type: 'RISK_EXCEEDED', riskTotal: c.riskTotal, riskLimit: level.riskLimit });
    }

    const success = failReasons.length === 0;

    const successReport = success
      ? this._pickRandom(level.successReports ?? ['Отлично! Задача выполнена.'])
      : null;

    const result = {
      success,
      goldSpent: c.goldSpent,
      riskTotal: c.riskTotal,
      failReasons,
      activeStatuses: c.allFiredStatuses,
      unresolvedDebts: c.activeDebts,
      successReport,
    };

    this.state.lastResult = result;
    this.state.phase = 'RESULT';
    return result;
  }

  // ─── computeLiveState() ───────────────────────────────────────────────────

  computeLiveState() {
    const level = this.currentLevel;
    const c = this._compute(level, this.state.placements);
    return {
      goldSpent: c.goldSpent,
      goldRemaining: c.goldRemaining,
      budgetGold: level.budgetGold,
      riskTotal: c.riskTotal,
      riskLimit: level.riskLimit,
      activeStatuses: c.allFiredStatuses,
      fatalStatuses: c.fatalStatuses,
      unresolvedDebts: c.activeDebts,
      missingRequirements: c.missingRequirements,
      criticalStatuses: level.criticalStatuses ?? [],
    };
  }

  // ─── Phase transitions ────────────────────────────────────────────────────

  startAssembly() {
    this.state.phase = 'ASSEMBLY';
  }

  retry() {
    this.state.phase = 'ASSEMBLY';
    this.state.lastResult = null;
  }

  nextLevel() {
    if (!this.hasNextLevel) return false;
    this.state.currentLevelIndex++;
    this.state.placements = {};
    this.state.lastResult = null;
    this.state.phase = 'BRIEFING';
    return true;
  }

  // ─── Utils ────────────────────────────────────────────────────────────────

  _pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
