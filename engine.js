// TechnoMage Platform — Game Engine (v0.3)
// Pure data-driven engine. No DOM dependencies.
// Schema v0.3: cards use currencies.{gold,aura}; levels use budget.{gold,aura}.

export class Engine {
  constructor() {
    this.data = null;
    this.state = null;
  }

  async init() {
    const resp = await fetch('./game-data.json');
    this.data = await resp.json();
    // Filter out levels marked as hidden (work-in-progress)
    this.data.levelCatalog = this.data.levelCatalog.filter(l => !l.hidden);
    this.state = {
      currentLevelIndex: 0,
      phase: 'BRIEFING',       // BRIEFING | ASSEMBLY | RESULT
      placements: {},          // { slotId: cardId }
      installedMatrixIds: [],  // instanceId[] — optional matrices the player placed
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

  /** Look up a card by ID from spellCatalog or obryadCatalog. */
  cardById(id) {
    return this.data.spellCatalog.find(s => s.id === id)
        ?? (this.data.obryadCatalog ?? []).find(r => r.id === id)
        ?? null;
  }

  /** @deprecated Use cardById. Kept for backward compatibility with any old callers. */
  spellById(id) { return this.cardById(id); }

  statusById(id) {
    return this.data.statusCatalog.find(s => s.id === id) ?? null;
  }

  matrixById(id) {
    return this.data.matrixCatalog.find(m => m.id === id) ?? null;
  }

  // ─── Matrix helpers ───────────────────────────────────────────────────────

  /**
   * Matrix instances currently on the board:
   * - preInstalled (absent field defaults to true) always present
   * - optional ones only if the player has installed them
   */
  boardMatrices() {
    return (this.currentLevel.availableMatrices ?? []).filter(m =>
      (m.preInstalled !== false) || this.state.installedMatrixIds.includes(m.instanceId)
    );
  }

  optionalMatrices() {
    return (this.currentLevel.availableMatrices ?? []).filter(m => m.preInstalled === false);
  }

  availableToInstall() {
    return this.optionalMatrices().filter(
      m => !this.state.installedMatrixIds.includes(m.instanceId)
    );
  }

  installMatrix(instanceId) {
    const level = this.currentLevel;
    const matrix = this.optionalMatrices().find(m => m.instanceId === instanceId);
    if (!matrix) return { ok: false, reason: 'Матрица не найдена или уже установлена.' };
    if (this.state.installedMatrixIds.includes(instanceId))
      return { ok: false, reason: 'Матрица уже на доске.' };
    const limit = level.maxOptionalMatrices ?? Infinity;
    if (this.state.installedMatrixIds.length >= limit)
      return { ok: false, reason: `На этом уровне можно установить не более ${limit} матриц.` };
    this.state.installedMatrixIds = [...this.state.installedMatrixIds, instanceId];
    return { ok: true };
  }

  uninstallMatrix(instanceId) {
    const matrix = this.optionalMatrices().find(m => m.instanceId === instanceId);
    if (!matrix) return { ok: false, reason: 'Матрица не найдена.' };
    if (!this.state.installedMatrixIds.includes(instanceId))
      return { ok: false, reason: 'Матрица не установлена.' };
    const occupiedSlot = matrix.slots.find(s => this.state.placements[s.slotId]);
    if (occupiedSlot)
      return { ok: false, reason: 'Сначала убери все заклинания из матрицы.' };
    this.state.installedMatrixIds = this.state.installedMatrixIds.filter(id => id !== instanceId);
    return { ok: true };
  }

  // ─── Placement helpers ────────────────────────────────────────────────────

  allSlots() {
    return this.boardMatrices().flatMap(m => m.slots);
  }

  placedCardIds() {
    return Object.values(this.state.placements).filter(Boolean);
  }

  /** @deprecated Use placedCardIds. */
  placedSpellIds() { return this.placedCardIds(); }

  placeSpell(slotId, cardId) {
    const level = this.currentLevel;
    const slot = this.allSlots().find(s => s.slotId === slotId);
    if (!slot) return { ok: false, reason: 'Слот не найден.' };

    const card = this.cardById(cardId);
    if (!card) return { ok: false, reason: 'Заклинание не найдено.' };

    const isSpell  = (level.availableSpells  ?? []).includes(cardId);
    const isObryad = (level.availableObryads ?? []).includes(cardId);
    if (!isSpell && !isObryad)
      return { ok: false, reason: 'Заклинание недоступно на этом уровне.' };

    if (!card.allowedSlotTypes.includes(slot.slotType))
      return { ok: false, reason: `Это заклинание нельзя установить в слот типа ${slot.slotType}.` };

    if (card.unique !== false) {
      const alreadyPlaced = Object.entries(this.state.placements).some(
        ([sid, sp]) => sp === cardId && sid !== slotId
      );
      if (alreadyPlaced) return { ok: false, reason: 'Это заклинание уже используется.' };
    }

    this.state.placements = { ...this.state.placements, [slotId]: cardId };
    return { ok: true };
  }

  removeSpell(slotId) {
    const next = { ...this.state.placements };
    delete next[slotId];
    this.state.placements = next;
  }

  // ─── Core computation (shared by evaluate + computeLiveState) ─────────────

  _compute(level, placements, installedMatrixIds) {
    const cards = Object.values(placements)
      .filter(Boolean)
      .map(id => this.cardById(id))
      .filter(Boolean);

    // 1. Capabilities — from defaultInstalled + placed cards
    const capabilities = new Set(
      (level.defaultInstalled ?? []).flatMap(d => d.grantsCapabilities ?? [])
    );
    for (const card of cards) {
      for (const ef of card.effects ?? []) {
        if (ef.type === 'CAPABILITY') capabilities.add(ef.id);
      }
    }

    // 2. Debts — from defaultInstalled (inherited) and placed cards
    const debtMap = new Map();
    for (const inst of level.defaultInstalled ?? []) {
      for (const d of inst.addsDebts ?? []) debtMap.set(d.id, d);
    }
    for (const card of cards) {
      for (const d of card.addsDebts ?? []) debtMap.set(d.id, d);
    }

    // 3. Resolve debts
    for (const card of cards) {
      for (const rid of card.resolvesDebts ?? []) debtMap.delete(rid);
    }

    // 4. Conflicts (F2)
    const placedIds = new Set(Object.values(placements).filter(Boolean));
    const firedConflicts = [];
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
    const fatalStatuses    = [...allFiredStatuses].filter(s => criticalSet.has(s));
    const nonCriticalStatuses = [...allFiredStatuses].filter(s => !criticalSet.has(s));

    // 7. Aura = sum of currencies.aura from all cards + penalty per non-critical status
    //    auraLimit can be raised by obryad auraLimitDelta
    const auraLimitModifier = cards.reduce((sum, c) => sum + (c.auraLimitDelta ?? 0), 0);
    const auraLimitFinal = (level.budget?.aura ?? 0) + auraLimitModifier;
    let auraTotal = cards.reduce((sum, c) => sum + (c.currencies?.aura ?? 0), 0);
    auraTotal += nonCriticalStatuses.length * (level.nonCriticalStatusAuraPenalty ?? 2);

    // 8. Coins = sum of currencies.gold for all cards + installed optional matrix costs
    const matrixInstallCost = (level.availableMatrices ?? [])
      .filter(m => m.preInstalled === false && installedMatrixIds.includes(m.instanceId))
      .reduce((sum, m) => sum + (m.installCostGold ?? 0), 0);

    const coinsSpent = cards.reduce(
      (sum, c) => sum + (c.currencies?.gold ?? 0), 0
    ) + matrixInstallCost;

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
      auraTotal,
      auraLimitFinal,
      coinsSpent,
      coinsRemaining: (level.budget?.gold ?? 0) - coinsSpent,
      missingRequirements,
    };
  }

  // ─── evaluate() ──────────────────────────────────────────────────────────

  evaluate() {
    const level = this.currentLevel;
    const c = this._compute(level, this.state.placements, this.state.installedMatrixIds);
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

    // Category 3: budget / aura
    if (c.coinsSpent > (level.budget?.gold ?? 0)) {
      failReasons.push({ type: 'BUDGET_EXCEEDED', coinsSpent: c.coinsSpent, coinsBudget: level.budget?.gold });
    }
    if (c.auraTotal > c.auraLimitFinal) {
      failReasons.push({ type: 'AURA_EXCEEDED', auraTotal: c.auraTotal, auraLimit: c.auraLimitFinal });
    }

    const success = failReasons.length === 0;
    const successReport = success
      ? this._pickRandom(level.successReports ?? ['Отлично! Задача выполнена.'])
      : null;

    const result = {
      success,
      coinsSpent: c.coinsSpent,
      auraTotal: c.auraTotal,
      auraLimitFinal: c.auraLimitFinal,
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
    const c = this._compute(level, this.state.placements, this.state.installedMatrixIds);
    return {
      coinsSpent:    c.coinsSpent,
      coinsRemaining: c.coinsRemaining,
      coinsBudget:   level.budget?.gold ?? 0,
      auraTotal:     c.auraTotal,
      auraLimit:     c.auraLimitFinal,
      activeStatuses:     c.allFiredStatuses,
      fatalStatuses:      c.fatalStatuses,
      unresolvedDebts:    c.activeDebts,
      missingRequirements: c.missingRequirements,
      criticalStatuses:   level.criticalStatuses ?? [],
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
    this.state.installedMatrixIds = [];
    this.state.lastResult = null;
    this.state.phase = 'BRIEFING';
    return true;
  }

  // ─── Utils ────────────────────────────────────────────────────────────────

  _pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
