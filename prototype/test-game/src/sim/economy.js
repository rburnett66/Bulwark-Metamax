// src/sim/economy.js
// BULWARK — Real-time economy system.
// Money accrual over time, kill income, spend/refund for build/upgrade/repair,
// and bankruptcy detection. Reads sim state; mutates only the economy fields.
//
// Deterministic: all math derives from fixed-timestep dt and integer-ish gold
// tracked as a float but rounded at readouts. No RNG here.
//
// This module is intentionally framework-free so the headless combat/sim core
// (simCore.js) uses the exact same code path as the balance harness.

// -----------------------------------------------------------------------------
// Economy tuning constants (data-driven defaults; overridable via config)
// -----------------------------------------------------------------------------
const ECON_DEFAULTS = {
  startingGold: 1500,       // seed float for the vertical slice
  passiveIncomePerSec: 12,  // live money accrual (real-time economy)
  killBaseReward: 8,        // flat reward per attacker kill
  killPowerFactor: 0.35,    // + reward scaled by unit power budget (100 pts)
  sellRefundFraction: 0.5,  // partial refund on sell
  repairGoldPerSec: 0,      // repairs are FREE (troop-based) per model
  bankruptcyGold: 0,        // gold floor; below-cost purchases blocked
};

// -----------------------------------------------------------------------------
// Economy factory / init
// -----------------------------------------------------------------------------

/**
 * Create the economy sub-state. Attach to world.economy.
 * @param {object} opts - overrides for ECON_DEFAULTS (typically from config tables)
 */
export function createEconomy(opts = {}) {
  const cfg = { ...ECON_DEFAULTS, ...opts };
  return {
    cfg,
    gold: cfg.startingGold,
    // running totals (for HUD deltas + audits)
    totalEarned: cfg.startingGold,
    totalSpent: 0,
    totalKillIncome: 0,
    totalPassive: 0,
    totalRefunds: 0,
    bankrupt: false,
    // transient delta for the HUD to animate; drained each render pull
    lastDelta: 0,
    // accumulator so passive income is smooth under fixed dt
    _accrue: 0,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function econOf(world) {
  // Tolerate either world.economy or a bare economy object being passed in.
  if (world && world.economy) return world.economy;
  return world;
}

function pushDelta(econ, amount) {
  econ.lastDelta += amount;
}

/** Read + clear the animated HUD delta. */
export function drainDelta(world) {
  const econ = econOf(world);
  const d = econ.lastDelta;
  econ.lastDelta = 0;
  return d;
}

/** Current gold (rounded for display). */
export function getGold(world) {
  return Math.round(econOf(world).gold);
}

/** Can the player afford `cost`? */
export function canAfford(world, cost) {
  return econOf(world).gold + 1e-6 >= (cost || 0);
}

// -----------------------------------------------------------------------------
// Per-tick accrual (called by step.js each fixed step)
// -----------------------------------------------------------------------------

/**
 * Accrue passive income for one fixed timestep.
 * @param {object} world
 * @param {number} dt - seconds for this step (fixed)
 */
export function tickEconomy(world, dt) {
  const econ = econOf(world);
  if (dt <= 0) return;

  const gain = econ.cfg.passiveIncomePerSec * dt;
  econ._accrue += gain;

  // Bank whole/partial gold smoothly.
  econ.gold += gain;
  econ.totalEarned += gain;
  econ.totalPassive += gain;
  pushDelta(econ, gain);

  // Recompute bankruptcy flag (informational — spend calls enforce it).
  econ.bankrupt = econ.gold <= econ.cfg.bankruptcyGold + 1e-6;
}

// -----------------------------------------------------------------------------
// Kill income
// -----------------------------------------------------------------------------

/**
 * Compute the reward for killing a unit.
 * Reward scales with the unit's power budget (100-pt baseline) so tougher
 * units pay out more — derived, not hardcoded per unit.
 * @param {object} econ
 * @param {object} unit - killed attacker entity (may carry .power / .stats.power)
 */
function killReward(econ, unit) {
  let power = 100;
  if (unit) {
    if (typeof unit.power === 'number') power = unit.power;
    else if (unit.stats && typeof unit.stats.power === 'number') power = unit.stats.power;
    else if (unit.def && typeof unit.def.power === 'number') power = unit.def.power;
  }
  return econ.cfg.killBaseReward + econ.cfg.killPowerFactor * power;
}

/**
 * Grant income for a killed attacker. Called from combat.js on death.
 * Returns the reward granted (for battle-log events).
 * @param {object} world
 * @param {object} unit - the killed enemy unit
 */
export function grantKillIncome(world, unit) {
  const econ = econOf(world);
  const reward = killReward(econ, unit);
  econ.gold += reward;
  econ.totalEarned += reward;
  econ.totalKillIncome += reward;
  pushDelta(econ, reward);

  // Emit a HUD/FX event if the world supports an event queue.
  emitEvent(world, {
    type: 'kill_income',
    amount: reward,
    unitId: unit && unit.id,
    x: unit && unit.x,
    y: unit && unit.y,
  });

  econ.bankrupt = econ.gold <= econ.cfg.bankruptcyGold + 1e-6;
  return reward;
}

// -----------------------------------------------------------------------------
// Spend / refund
// -----------------------------------------------------------------------------

/**
 * Attempt to spend `cost` gold for a purpose (build/upgrade/repair).
 * Enforces bankruptcy: if it can't afford, returns false and spends nothing.
 * @returns {boolean} success
 */
export function spend(world, cost, reason = 'spend', meta = {}) {
  const econ = econOf(world);
  cost = cost || 0;
  if (cost < 0) cost = 0;

  if (econ.gold + 1e-6 < cost) {
    // Insufficient funds — bankruptcy blocks the transaction.
    emitEvent(world, { type: 'spend_denied', reason, cost, gold: econ.gold, ...meta });
    return false;
  }

  econ.gold -= cost;
  econ.totalSpent += cost;
  pushDelta(econ, -cost);
  emitEvent(world, { type: 'spend', reason, amount: cost, ...meta });

  econ.bankrupt = econ.gold <= econ.cfg.bankruptcyGold + 1e-6;
  return true;
}

/**
 * Refund gold (e.g. selling a structure for partial value).
 * @param {number} baseValue - the full invested value to refund a fraction of
 * @param {number} [fraction] - override refund fraction (defaults to cfg)
 * @returns {number} amount refunded
 */
export function refund(world, baseValue, fraction, reason = 'sell', meta = {}) {
  const econ = econOf(world);
  const frac = (typeof fraction === 'number') ? fraction : econ.cfg.sellRefundFraction;
  const amount = Math.max(0, (baseValue || 0) * frac);

  econ.gold += amount;
  econ.totalEarned += amount;
  econ.totalRefunds += amount;
  pushDelta(econ, amount);
  emitEvent(world, { type: 'refund', reason, amount, ...meta });

  econ.bankrupt = econ.gold <= econ.cfg.bankruptcyGold + 1e-6;
  return amount;
}

/** Compute the sell refund value for a structure without applying it. */
export function sellValue(world, structure) {
  const econ = econOf(world);
  const invested = structureInvested(structure);
  return Math.floor(invested * econ.cfg.sellRefundFraction);
}

/**
 * Sum the gold invested into a structure across build + upgrades.
 * Reads structure.buildCost + structure.upgradeSpent, or falls back to .cost.
 */
export function structureInvested(structure) {
  if (!structure) return 0;
  if (typeof structure.investedGold === 'number') return structure.investedGold;
  let total = 0;
  if (typeof structure.buildCost === 'number') total += structure.buildCost;
  else if (typeof structure.cost === 'number') total += structure.cost;
  if (typeof structure.upgradeSpent === 'number') total += structure.upgradeSpent;
  return total;
}

// -----------------------------------------------------------------------------
// High-level transaction helpers used by commands / lifecycle
// -----------------------------------------------------------------------------

/**
 * Try to pay for placing a structure. On success, records invested gold on the
 * structure so sell refunds are accurate.
 */
export function payBuild(world, structure, cost) {
  if (!spend(world, cost, 'build', { structureId: structure && structure.id })) {
    return false;
  }
  if (structure) {
    structure.buildCost = cost;
    structure.investedGold = (structure.investedGold || 0) + cost;
  }
  return true;
}

/**
 * Try to pay for upgrading a structure one tier.
 */
export function payUpgrade(world, structure, cost) {
  if (!spend(world, cost, 'upgrade', { structureId: structure && structure.id })) {
    return false;
  }
  if (structure) {
    structure.upgradeSpent = (structure.upgradeSpent || 0) + cost;
    structure.investedGold = (structure.investedGold || 0) + cost;
  }
  return true;
}

/**
 * Sell a structure: refund partial value based on total invested gold.
 * Returns the refunded amount.
 */
export function paySell(world, structure) {
  const invested = structureInvested(structure);
  return refund(world, invested, undefined, 'sell', {
    structureId: structure && structure.id,
  });
}

/**
 * Repairs are FREE in this model (troop-based), but this hook exists so the
 * cost curve can be toggled via cfg.repairGoldPerSec without touching callers.
 * Returns true if the (possibly zero) cost was paid.
 */
export function payRepairTick(world, dt) {
  const econ = econOf(world);
  const rate = econ.cfg.repairGoldPerSec;
  if (rate <= 0) return true; // free
  const cost = rate * dt;
  return spend(world, cost, 'repair');
}

// -----------------------------------------------------------------------------
// Bankruptcy
// -----------------------------------------------------------------------------

export function isBankrupt(world) {
  return econOf(world).bankrupt === true;
}

// -----------------------------------------------------------------------------
// Event emission (deterministic — appended to world.events if present)
// -----------------------------------------------------------------------------

function emitEvent(world, ev) {
  if (world && Array.isArray(world.events)) {
    world.events.push(ev);
  }
}

// -----------------------------------------------------------------------------
// Snapshot for HUD / battle-log audits
// -----------------------------------------------------------------------------

export function economySnapshot(world) {
  const econ = econOf(world);
  return {
    gold: Math.round(econ.gold),
    goldRaw: econ.gold,
    totalEarned: econ.totalEarned,
    totalSpent: econ.totalSpent,
    totalKillIncome: econ.totalKillIncome,
    totalPassive: econ.totalPassive,
    totalRefunds: econ.totalRefunds,
    bankrupt: econ.bankrupt,
  };
}

export const ECONOMY_DEFAULTS = ECON_DEFAULTS;

export default {
  createEconomy,
  tickEconomy,
  grantKillIncome,
  spend,
  refund,
  sellValue,
  structureInvested,
  payBuild,
  payUpgrade,
  paySell,
  payRepairTick,
  canAfford,
  getGold,
  drainDelta,
  isBankrupt,
  economySnapshot,
  ECONOMY_DEFAULTS,
};