assumptions.js

```javascript
// src/config/assumptions.js
// Global tuning constants (Assumptions sheet from the BULWARK balance workbook).
// These are the canonical conversion rates and upgrade/cost curves used by
// statMath.js to derive HP/DPS/range/speed/cost from archetype power budgets.
// No hardcoded balance elsewhere — everything reads from this table.

export const assumptions = {
  // Conversion rates: power points -> concrete stats
  HP_per_point: 10,          // 1 HP budget point = 10 hit points
  DPS_per_point: 1.5,        // 1 DPS point = 1.5 damage/sec (raw, pre-type)
  Range_per_point: 0.25,     // 1 range point = 0.25 tiles
  Speed_per_point: 0.08,     // 1 speed point = 0.08 tiles/sec
  Vision_base: 4,            // baseline vision in tiles
  Vision_per_util_point: 0.1,// each utility point adds 0.1 tiles vision

  // Economy: cost derived from power (even baseline: equal power = equal cost)
  Cost_per_power_gold: 3,    // gold cost = power x this

  // Upgrade curves (tier multipliers vs T1 base)
  Upgrade_HP_x_T2: 1.6,      // HP multiplier at tier 2
  Upgrade_HP_x_T3: 2.4,      // HP multiplier at tier 3
  Upgrade_DPS_x_T2: 1.55,    // DPS multiplier at tier 2
  Upgrade_DPS_x_T3: 2.3,     // DPS multiplier at tier 3
  Upgrade_Cost_x_T2: 2.5,    // cumulative unit value at tier 2
  Upgrade_Cost_x_T3: 5,      // cumulative unit value at tier 3

  // Derived helper tables keyed by tier index (1,2,3)
  hpTierMult:   { 1: 1, 2: 1.6, 3: 2.4 },
  dpsTierMult:  { 1: 1, 2: 1.55, 3: 2.3 },
  costTierMult: { 1: 1, 2: 2.5, 3: 5 },

  // ---- Simulation-level tuning constants (not in the workbook Assumptions
  // sheet but required by the deterministic sim; kept here as the single
  // source of global tuning knobs). ----

  // Economy runtime
  startingGold: 800,          // gold at battle start
  incomePerSecond: 12,        // passive money accrual (gold/sec)
  killIncomeFraction: 0.35,   // fraction of a unit's Cost T1 granted on kill
  sellRefundFraction: 0.5,    // partial refund when selling a structure

  // Base
  baseHP: 5000,               // player base hit points
  baseSlotsPerLevel: 6,       // hard-point slots per base level
  baseLevel: 1,

  // Structure lifecycle timings (seconds)
  buildTimePerCostUnit: 0.004, // build time = cost * this (min clamped)
  buildTimeMin: 1.5,
  buildTimeMax: 8,
  upgradeTimePerCostUnit: 0.005,
  upgradeTimeMin: 2,
  upgradeTimeMax: 10,
  sellTime: 0.6,

  // Damaged threshold (fraction of maxHP below which state = Damaged)
  damagedThreshold: 0.6,

  // Repair (free but consumes troops + travel time)
  repairTroopCount: 1,        // troops consumed per repair
  repairTravelSpeed: 4.0,     // tiles/sec a repair troop moves to the site
  repairRatePerSecond: 0.25,  // fraction of maxHP restored per second while repairing
  maxTroops: 8,               // available repair troop pool
  troopRegenPerSecond: 0.05,  // troop regeneration rate

  // Deploy (attacker-side troop marches for the deploy loop)
  deployMarchSpeed: 2.0,      // tiles/sec troops march from base to drop point

  // Combat
  projectileSpeed: 12.0,      // tiles/sec for ballistic/traveling projectiles
  hitscanThreshold: 999,      // ranges above this treated as hitscan (unused default)
  lockOnWindupFactor: 1.0,    // wind-up time = time-to-fire * this (telegraph)
  minFireInterval: 0.05,      // clamp for fastest weapon cadence
  statusDuration: 3.0,        // default status effect duration (seconds)
  dotTickInterval: 0.5,       // DoT tick cadence (seconds)
  slowMultiplier: 0.5,        // Frost chill slow factor applied to speed
  chainRange: 2.0,            // Electric chain jump radius (tiles)
  chainFalloff: 0.6,          // damage multiplier per chain jump

  // Waves
  wavesToWin: 5,              // survive N waves = win
  waveInterval: 4.0,          // seconds between auto-spawns within a wave burst
  interWaveDelay: 8.0,        // seconds between waves (if auto)

  // Vision (minimal stub)
  radarSeesAirOnly: true,
  airSeesGroundRange: 4.0,

  // Fixed-timestep sim
  tickRate: 30,               // sim ticks per second
  get dt() { return 1 / this.tickRate; }
};

// Convenience derived accessors used by statMath.js
export function hpMultForTier(tier) {
  return assumptions.hpTierMult[tier] || 1;
}
export function dpsMultForTier(tier) {
  return assumptions.dpsTierMult[tier] || 1;
}
export function costMultForTier(tier) {
  return assumptions.costTierMult[tier] || 1;
}

export function buildTimeForCost(cost) {
  const t = cost * assumptions.buildTimePerCostUnit;
  return Math.min(assumptions.buildTimeMax, Math.max(assumptions.buildTimeMin, t));
}

export function upgradeTimeForCost(cost) {
  const t = cost * assumptions.upgradeTimePerCostUnit;
  return Math.min(assumptions.upgradeTimeMax, Math.max(assumptions.upgradeTimeMin, t));
}

export default assumptions;