import { ASSUMPTIONS, getUnitDef } from '../data/tables.js';
import { emitEvent } from './core.js';

/**
 * Create the economy sub-state using values from the Assumptions sheet.
 * @param {object} assumptions ASSUMPTIONS table
 * @returns {{money:number, incomePerSec:number, totalEarned:number, totalSpent:number}}
 */
export function initEconomy(assumptions) {
  const a = assumptions || ASSUMPTIONS;
  const startingMoney = Number.isFinite(a.startingMoney) ? a.startingMoney : 0;
  const incomePerSec = Number.isFinite(a.incomePerSec) ? a.incomePerSec : 0;
  return {
    money: startingMoney,
    incomePerSec: incomePerSec,
    totalEarned: startingMoney,
    totalSpent: 0
  };
}

/**
 * Accrue passive income for one fixed tick. Deterministic: pure arithmetic,
 * no rounding drift beyond IEEE754 which is identical across replays.
 * @param {object} state SimState
 * @param {number} dt seconds
 */
export function stepEconomy(state, dt) {
  const eco = state.economy;
  if (!eco || dt <= 0) return;
  const gain = eco.incomePerSec * dt;
  if (gain > 0) {
    eco.money += gain;
    eco.totalEarned += gain;
  }
}

/**
 * True if the player can pay `cost` right now.
 * @param {object} state SimState
 * @param {number} cost gold
 * @returns {boolean}
 */
export function canAfford(state, cost) {
  const eco = state.economy;
  if (!eco) return false;
  const c = Number.isFinite(cost) ? cost : Infinity;
  return eco.money >= c;
}

/**
 * Deduct money if affordable; logs a coin event; returns success.
 * Bankruptcy is simply money hitting 0 blocking further purchases.
 * @param {object} state SimState
 * @param {number} cost gold
 * @param {string} reason e.g. 'build:AG-Tower', 'upgrade', 'deployTroop'
 * @returns {boolean}
 */
export function spend(state, cost, reason) {
  const eco = state.economy;
  if (!eco) return false;
  const c = Number.isFinite(cost) ? cost : Infinity;
  if (c < 0) return false;
  if (eco.money < c) {
    emitEvent(state, {
      type: 'coin',
      tick: state.tick,
      op: 'spendRejected',
      amount: c,
      reason: reason || '',
      money: eco.money
    });
    return false;
  }
  eco.money -= c;
  eco.totalSpent += c;
  if (eco.money < 0) eco.money = 0;
  emitEvent(state, {
    type: 'coin',
    tick: state.tick,
    op: 'spend',
    amount: c,
    reason: reason || '',
    money: eco.money
  });
  return true;
}

/**
 * Award kill bounty: killIncomeFrac x the unit's T1 table cost.
 * Logs a coin event (renderer plays the coin FX from it). Returns amount granted.
 * @param {object} state SimState
 * @param {object} unit killed Unit (has .unitId)
 * @returns {number}
 */
export function grantKillIncome(state, unit) {
  const eco = state.economy;
  if (!eco || !unit) return 0;
  let baseCost = 0;
  try {
    const def = getUnitDef(unit.unitId);
    baseCost = (def && def.cost && Number.isFinite(def.cost[0])) ? def.cost[0] : 0;
  } catch (e) {
    baseCost = 0;
  }
  const frac = Number.isFinite(ASSUMPTIONS.killIncomeFrac) ? ASSUMPTIONS.killIncomeFrac : 0;
  const amount = Math.round(baseCost * frac * 100) / 100;
  if (amount > 0) {
    eco.money += amount;
    eco.totalEarned += amount;
  }
  emitEvent(state, {
    type: 'coin',
    tick: state.tick,
    op: 'kill',
    amount: amount,
    unitId: unit.unitId,
    entityId: unit.id,
    pos: unit.pos ? { x: unit.pos.x, y: unit.pos.y } : null,
    money: eco.money
  });
  return amount;
}

/**
 * Add money back (e.g. sell refunds); logs a coin event.
 * @param {object} state SimState
 * @param {number} amount gold
 * @param {string} reason e.g. 'sell:AG-Tower'
 */
export function refund(state, amount, reason) {
  const eco = state.economy;
  if (!eco) return;
  const amt = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  eco.money += amt;
  eco.totalEarned += amt;
  emitEvent(state, {
    type: 'coin',
    tick: state.tick,
    op: 'refund',
    amount: amt,
    reason: reason || '',
    money: eco.money
  });
}

/**
 * Partial refund value for selling a structure at its current tier:
 * sellRefundFrac x total invested value (cumulative table cost at the tier,
 * or the tracked `invested` amount if present — they agree when built normally).
 * @param {object} structure Structure {structId, tier, invested?}
 * @param {object} tables STRUCTURES table
 * @param {object} assumptions ASSUMPTIONS table
 * @returns {number}
 */
export function getSellValue(structure, tables, assumptions) {
  if (!structure) return 0;
  const a = assumptions || ASSUMPTIONS;
  const frac = Number.isFinite(a.sellRefundFrac) ? a.sellRefundFrac : 0.5;
  let invested = 0;
  if (Number.isFinite(structure.invested) && structure.invested > 0) {
    invested = structure.invested;
  } else {
    const def = tables ? tables[structure.structId] : null;
    if (def && def.cost) {
      const tier = Math.min(Math.max(structure.tier || 1, 1), def.cost.length);
      const c = def.cost[tier - 1];
      invested = Number.isFinite(c) ? c : 0;
    }
  }
  return Math.round(invested * frac * 100) / 100;
}