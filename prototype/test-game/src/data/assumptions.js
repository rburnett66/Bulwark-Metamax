assumptions.js — implementing the Assumptions sheet as a data table with derived conversion helpers.

```javascript
// src/data/assumptions.js
// Global tuning constants (Assumptions sheet). Blue inputs from the balance workbook.
// Conversion rates, upgrade curves, and cost curves. No hardcoded balance elsewhere —
// derived tables (archetypes, units, structures) read from these values.

export const assumptions = {
  // --- Point -> stat conversions ---
  HP_per_point: 10,        // 1 HP budget point = 10 hit points
  DPS_per_point: 1.5,      // 1 DPS point = 1.5 damage/sec (raw, pre-type)
  Range_per_point: 0.25,   // 1 range point = 0.25 tiles
  Speed_per_point: 0.08,   // 1 speed point = 0.08 tiles/sec
  Vision_base: 4,          // baseline vision in tiles
  Vision_per_util_point: 0.1, // each utility point adds 0.1 tiles vision

  // --- Economy ---
  Cost_per_power_gold: 3,  // gold cost = power x this (even: equal power = equal cost)

  // --- Upgrade multipliers ---
  Upgrade_HP_x_T2: 1.6,    // HP multiplier at tier 2
  Upgrade_HP_x_T3: 2.4,    // HP multiplier at tier 3
  Upgrade_DPS_x_T2: 1.55,  // DPS multiplier at tier 2
  Upgrade_DPS_x_T3: 2.3,   // DPS multiplier at tier 3
  Upgrade_Cost_x_T2: 2.5,  // cumulative unit value at tier 2
  Upgrade_Cost_x_T3: 5,    // cumulative unit value at tier 3
};

// --- Derived conversion helpers (pure functions of the table above) ---

// Convert a raw HP budget-point value into hit points.
export function hpFromPoints(pts) {
  return pts * assumptions.HP_per_point;
}

// Convert DPS budget points into raw damage/sec (pre damage-type multiplier).
export function dpsFromPoints(pts) {
  return pts * assumptions.DPS_per_point;
}

// Convert range points into tiles.
export function rangeFromPoints(pts) {
  return pts * assumptions.Range_per_point;
}

// Convert speed points into tiles/sec.
export function speedFromPoints(pts) {
  return pts * assumptions.Speed_per_point;
}

// Vision in tiles from utility points (baseline + per-util contribution).
export function visionFromUtil(utilPts) {
  return assumptions.Vision_base + utilPts * assumptions.Vision_per_util_point;
}

// Gold cost for a given power budget at tier 1 (flat gold-per-power).
export function costFromPower(power) {
  return power * assumptions.Cost_per_power_gold;
}

// --- Tier curve accessors ---

// HP multiplier for a given tier (1, 2, or 3).
export function hpTierMult(tier) {
  switch (tier) {
    case 2: return assumptions.Upgrade_HP_x_T2;
    case 3: return assumptions.Upgrade_HP_x_T3;
    default: return 1;
  }
}

// DPS multiplier for a given tier (1, 2, or 3).
export function dpsTierMult(tier) {
  switch (tier) {
    case 2: return assumptions.Upgrade_DPS_x_T2;
    case 3: return assumptions.Upgrade_DPS_x_T3;
    default: return 1;
  }
}

// Cumulative value multiplier for a given tier (used for cost curves).
export function costTierMult(tier) {
  switch (tier) {
    case 2: return assumptions.Upgrade_Cost_x_T2;
    case 3: return assumptions.Upgrade_Cost_x_T3;
    default: return 1;
  }
}

// Total (cumulative) gold cost to own a structure/unit AT the given tier,
// starting from its base cost. Tier 1 = base cost, Tier 2/3 use cost curve.
export function cumulativeCost(baseCost, tier) {
  return baseCost * costTierMult(tier);
}

// The incremental gold required to UPGRADE from (tier-1) to tier.
// e.g. upgrade to T2 costs (2.5 - 1) * base; T3 costs (5 - 2.5) * base.
export function upgradeCost(baseCost, targetTier) {
  const to = costTierMult(targetTier);
  const from = costTierMult(targetTier - 1);
  return baseCost * (to - from);
}

// Refund value for selling a structure at a given tier, using a refund rate
// applied to its cumulative invested value.
export function refundValue(baseCost, tier, refundRate) {
  return cumulativeCost(baseCost, tier) * refundRate;
}

export default assumptions;