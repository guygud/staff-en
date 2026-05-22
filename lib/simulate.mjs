/**
 * Shared placement simulation — single source of truth for engine + validate-levels.
 * Pure functions: no DOM, no fetch.
 */

/** @param {object} data game-data root */
export function cardById(data, id) {
  return data.spellCatalog.find(c => c.id === id)
      ?? (data.obryadCatalog ?? []).find(c => c.id === id)
      ?? null;
}

/**
 * Core computation: capabilities, debts, treatments, conflicts, budgets.
 * @returns {object} compute result (same shape as legacy Engine._compute)
 */
export function computePlacement(data, level, placements, installedMatrixIds = []) {
  const cards = Object.values(placements)
    .filter(Boolean)
    .map(id => cardById(data, id))
    .filter(Boolean);

  const capabilities = new Set(
    (level.defaultInstalled ?? []).flatMap(d => d.grantsCapabilities ?? [])
  );
  for (const card of cards) {
    for (const ef of card.effects ?? []) {
      if (ef.type === 'CAPABILITY') capabilities.add(ef.id);
    }
  }

  const debtMap = new Map();
  for (const inst of level.defaultInstalled ?? []) {
    for (const d of inst.addsDebts ?? []) debtMap.set(d.id, d);
  }
  for (const card of cards) {
    for (const d of card.addsDebts ?? []) debtMap.set(d.id, d);
  }

  for (const card of cards) {
    for (const rid of card.resolvesDebts ?? []) debtMap.delete(rid);
  }

  const treatmentByTag = new Map(
    (data.treatmentCatalog ?? []).map(e => [e.tag, new Set(e.healsStatuses ?? [])])
  );
  const activeTreatments = [];
  for (const card of cards) {
    const skipIds = new Set((card.addsDebts ?? []).map(d => d.id));
    const tagList = [...new Set([
      ...(card.treatmentTags ?? []),
      ...(card.buffs ?? []),
    ])];
    const healsForCard = [];
    for (const tag of tagList) {
      const heals = treatmentByTag.get(tag);
      if (!heals || heals.size === 0) continue;
      const healedStatusIds = new Set();
      for (const [id, debt] of [...debtMap]) {
        if (skipIds.has(id)) continue;
        if (heals.has(debt.statusIfUnresolved)) {
          debtMap.delete(id);
          healedStatusIds.add(debt.statusIfUnresolved);
        }
      }
      if (healedStatusIds.size) {
        healsForCard.push({ tag, healedStatusIds: [...healedStatusIds] });
      }
    }
    if (healsForCard.length) {
      activeTreatments.push({
        cardId: card.id,
        cardName: card.name,
        heals: healsForCard,
      });
    }
  }

  const placedIds = new Set(Object.values(placements).filter(Boolean));
  const firedConflicts = [];
  for (const pair of data.conflictPairs ?? []) {
    const bothPresent = pair.spells.every(id => placedIds.has(id));
    if (!bothPresent) continue;
    const resolved = (pair.resolvedBy ?? []).some(id => placedIds.has(id));
    if (!resolved) firedConflicts.push({ pair, statusId: pair.statusIfUnresolved });
  }

  const allFiredStatuses = new Set([
    ...[...debtMap.values()].map(d => d.statusIfUnresolved),
    ...firedConflicts.map(c => c.statusId),
  ]);

  const criticalSet = new Set(level.criticalStatuses ?? []);
  const fatalStatuses = [...allFiredStatuses].filter(s => criticalSet.has(s));
  const nonCriticalStatuses = [...allFiredStatuses].filter(s => !criticalSet.has(s));

  const auraLimitModifier = cards.reduce((sum, c) => sum + (c.auraLimitDelta ?? 0), 0);
  const auraLimitFinal = (level.budget?.aura ?? 0) + auraLimitModifier;
  let auraTotal = cards.reduce((sum, c) => sum + (c.currencies?.aura ?? 0), 0);
  auraTotal += nonCriticalStatuses.length * (level.nonCriticalStatusAuraPenalty ?? 2);

  const matrixInstallCost = (level.availableMatrices ?? [])
    .filter(m => m.preInstalled === false && installedMatrixIds.includes(m.instanceId))
    .reduce((sum, m) => sum + (m.installCostGold ?? 0), 0);

  const coinsSpent = cards.reduce(
    (sum, c) => sum + (c.currencies?.gold ?? 0), 0
  ) + matrixInstallCost;

  const allBuffs = new Set(
    cards.flatMap(c => [...(c.treatmentTags ?? []), ...(c.buffs ?? [])])
  );
  const missingRequirements = (level.requirements ?? []).filter(req => {
    if (req.type === 'CAPABILITY_REQUIRED') return !capabilities.has(req.capabilityId);
    if (req.type === 'BUFF_REQUIRED') return !allBuffs.has(req.buffId);
    return false;
  });

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
    activeTreatments,
  };
}

/** Win / lose from compute snapshot (matches engine.evaluate success rule). */
export function isSuccessfulPlacement(level, c) {
  if (c.missingRequirements.length) return false;
  if (c.fatalStatuses.length) return false;
  if (c.coinsSpent > (level.budget?.gold ?? 0)) return false;
  if (c.auraTotal > c.auraLimitFinal) return false;
  return true;
}

/**
 * Validator-friendly bundle (Group B fixtures).
 * @returns {{ success: boolean, coinsSpent: number, auraTotal: number, auraLimitFinal: number, fatalStatuses: string[], missingRequirements: string[], allFiredStatuses: string[] }}
 */
export function scenarioSimulationResult(data, level, placements, installedMatrixIds = []) {
  const c = computePlacement(data, level, placements, installedMatrixIds);
  return {
    success: isSuccessfulPlacement(level, c),
    coinsSpent: c.coinsSpent,
    auraTotal: c.auraTotal,
    auraLimitFinal: c.auraLimitFinal,
    fatalStatuses: c.fatalStatuses,
    missingRequirements: c.missingRequirements.map(r => r.id),
    allFiredStatuses: c.allFiredStatuses,
  };
}
