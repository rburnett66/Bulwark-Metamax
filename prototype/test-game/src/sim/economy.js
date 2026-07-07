package com.bulwark.economy;

/**
 * Economy System - Real-time money accrual, kill income, spend on build/upgrade/repair, bankruptcy checks.
 * Wait — that's Java. Emitting JS below.
 */

// (ignore the above header — actual file content follows)

export const ECONOMY_DEFAULTS = {
  startingGold: 1500,
  accrualPerSecond: 12,        // passive income
  killIncomeFraction: 0.35,    // fraction of unit Cost T1 granted on kill
  repairGoldPerHp: 0.0,        // repairs are free (troop-consuming), gold cost 0
  bankruptThreshold: 0,
};

/**
 * Economy manages the player's gold as a strict sim-state field.
 * All mutations go through this module so replays stay deterministic.
 *
 * It reads config (constants) and data tables via the passed-in refs;
 * no hidden globals, no Math.random.
 */
export class Economy {
  /**
   * @param {object} opts
   * @param {number} [opts.startingGold]
   * @param {number} [opts.accrualPerSecond]
   * @param {number} [opts.killIncomeFraction]
   * @param {number} [opts.refundRate]   fraction of spent gold returned on sell
   */
  constructor(opts = {}) {
    this.startingGold = opts.startingGold ?? ECONOMY_DEFAULTS.startingGold;
    this.accrualPerSecond = opts.accrualPerSecond ?? ECONOMY_DEFAULTS.accrualPerSecond;
    this.killIncomeFraction = opts.killIncomeFraction ?? ECONOMY_DEFAULTS.killIncomeFraction;
    this.refundRate = opts.refundRate ?? 0.5;

    // Live state (deterministic; kept in whole gold via fractional carry)
    this.gold = this.startingGold;
    this._fracCarry = 0; // sub-integer accrual accumulator
    this.totalEarned = 0;
    this.totalSpent = 0;
    this.killIncome = 0;
    this.bankrupt = false;

    // Transient deltas for HUD animated readouts (view reads, never writes).
    this.lastDelta = 0;
    this.deltaEvents = []; // {amount, reason, x, y, t} — cleared by renderer each frame
  }

  /** Serialize economy substate for save / replay hashing. */
  serialize() {
    return {
      gold: this.gold,
      fracCarry: this._fracCarry,
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent,
      killIncome: this.killIncome,
      bankrupt: this.bankrupt,
    };
  }

  /** Restore economy substate (replay). */
  deserialize(s) {
    if (!s) return;
    this.gold = s.gold ?? this.gold;
    this._fracCarry = s.fracCarry ?? 0;
    this.totalEarned = s.totalEarned ?? 0;
    this.totalSpent = s.totalSpent ?? 0;
    this.killIncome = s.killIncome ?? 0;
    this.bankrupt = !!s.bankrupt;
  }

  /** Contribute to a deterministic state hash. */
  hashInto(mix) {
    // mix is a function(number) accumulating into a running hash
    mix(this.gold);
    mix(Math.round(this._fracCarry * 1000));
    mix(this.totalEarned);
    mix(this.totalSpent);
    mix(this.killIncome);
    mix(this.bankrupt ? 1 : 0);
  }

  /** Can the player afford `amount` gold? */
  canAfford(amount) {
    return this.gold >= Math.ceil(amount);
  }

  /**
   * Attempt to spend gold. Returns true on success.
   * @param {number} amount
   * @param {string} reason  e.g. 'build','upgrade','repair'
   */
  spend(amount, reason = 'spend') {
    const cost = Math.ceil(amount);
    if (cost <= 0) return true;
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.totalSpent += cost;
    this._pushDelta(-cost, reason);
    this._checkBankruptcy();
    return true;
  }

  /**
   * Grant gold (kill income, refunds, cheats).
   * @param {number} amount
   * @param {string} reason
   * @param {object} [pos]  {x,y} world position for HUD coin FX
   */
  grant(amount, reason = 'income', pos = null) {
    const inc = Math.max(0, Math.round(amount));
    if (inc <= 0) return;
    this.gold += inc;
    this.totalEarned += inc;
    this._pushDelta(inc, reason, pos);
    // Gaining gold can lift bankruptcy flag (informational only).
    if (this.gold > ECONOMY_DEFAULTS.bankruptThreshold) this.bankrupt = false;
  }

  /**
   * Passive real-time accrual. Called once per fixed sim step with dt seconds.
   * Deterministic: integer gold with fractional carry, no float drift in gold.
   * @param {number} dt seconds
   */
  accrue(dt) {
    if (dt <= 0) return;
    this._fracCarry += this.accrualPerSecond * dt;
    if (this._fracCarry >= 1) {
      const whole = Math.floor(this._fracCarry);
      this._fracCarry -= whole;
      this.gold += whole;
      this.totalEarned += whole;
      // Passive income is silent to the coin-FX stream (no per-tick popups),
      // but still recorded in lastDelta for HUD tween smoothing.
      this.lastDelta += whole;
    }
  }

  /**
   * Grant kill income for a slain attacker.
   * Income is a fraction of the unit's T1 cost, read from data tables — no
   * hardcoded balance. Falls back gracefully if cost missing.
   * @param {object} unit   sim entity (must have .unitData or .costT1)
   * @param {object} [pos]  world position for HUD coin FX
   */
  grantKill(unit, pos = null) {
    let baseCost = 0;
    if (unit) {
      if (typeof unit.killReward === 'number') {
        baseCost = unit.killReward;
      } else if (typeof unit.costT1 === 'number') {
        baseCost = unit.costT1;
      } else if (unit.unitData && typeof unit.unitData.costT1 === 'number') {
        baseCost = unit.unitData.costT1;
      } else if (unit.data && typeof unit.data.costT1 === 'number') {
        baseCost = unit.data.costT1;
      }
    }
    const reward = Math.round(baseCost * this.killIncomeFraction);
    if (reward > 0) {
      this.killIncome += reward;
      const p = pos || (unit ? { x: unit.x, y: unit.y } : null);
      this.grant(reward, 'kill', p);
    }
    return reward;
  }

  /**
   * Compute the refund for selling a structure.
   * Refund = refundRate * gold invested so far (build + any upgrades).
   * @param {object} structure  sim entity with .investedGold (preferred)
   *                            or .costPaid
   */
  sellRefund(structure) {
    let invested = 0;
    if (structure) {
      if (typeof structure.investedGold === 'number') invested = structure.investedGold;
      else if (typeof structure.costPaid === 'number') invested = structure.costPaid;
    }
    return Math.floor(invested * this.refundRate);
  }

  /**
   * Execute a sell: grant the refund, mark spend accounting.
   * @param {object} structure
   * @param {object} [pos]
   * @returns {number} refunded gold
   */
  sell(structure, pos = null) {
    const refund = this.sellRefund(structure);
    if (refund > 0) {
      const p = pos || (structure ? { x: structure.x, y: structure.y } : null);
      this.grant(refund, 'sell', p);
    }
    return refund;
  }

  /**
   * Cost check + spend helper for building a structure.
   * @param {number} cost
   * @returns {boolean} whether the build was affordable and charged
   */
  tryBuild(cost) {
    return this.spend(cost, 'build');
  }

  /** Cost check + spend for upgrading a tier. */
  tryUpgrade(cost) {
    return this.spend(cost, 'upgrade');
  }

  /**
   * Repairs are FREE (they consume troops + time, not gold — per model).
   * This exists so callers have one economy entry point; it always succeeds
   * on the gold side. Configurable gold-per-hp defaults to 0.
   * @param {number} hpToRestore
   */
  tryRepair(hpToRestore = 0) {
    const cost = Math.ceil(hpToRestore * ECONOMY_DEFAULTS.repairGoldPerHp);
    if (cost <= 0) return true;
    return this.spend(cost, 'repair');
  }

  _checkBankruptcy() {
    if (this.gold <= ECONOMY_DEFAULTS.bankruptThreshold) {
      this.bankrupt = true;
    }
  }

  _pushDelta(amount, reason, pos = null) {
    this.lastDelta += amount;
    this.deltaEvents.push({
      amount,
      reason,
      x: pos ? pos.x : null,
      y: pos ? pos.y : null,
    });
    // Cap the FX queue so a long headless run doesn't grow unbounded.
    if (this.deltaEvents.length > 256) {
      this.deltaEvents.splice(0, this.deltaEvents.length - 256);
    }
  }

  /**
   * Renderer/HUD calls this each frame to drain queued coin FX + delta tween.
   * Draining does not affect gold or replay state (view-only).
   */
  drainDeltas() {
    const events = this.deltaEvents;
    const delta = this.lastDelta;
    this.deltaEvents = [];
    this.lastDelta = 0;
    return { events, delta };
  }
}

/**
 * Factory used by state.js to attach an economy substate.
 * Reads refund rate + starting gold from constants when provided.
 */
export function createEconomy(constants = {}) {
  return new Economy({
    startingGold: constants.STARTING_GOLD,
    accrualPerSecond: constants.INCOME_PER_SECOND,
    killIncomeFraction: constants.KILL_INCOME_FRACTION,
    refundRate: constants.REFUND_RATE,
  });
}

export default Economy;