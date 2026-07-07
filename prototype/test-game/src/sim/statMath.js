const A = {
  HP_per_point: 10,
  DPS_per_point: 1.5,
  Range_per_point: 0.25,
  Speed_per_point: 0.08,
  Vision_base: 4,
  Vision_per_util_point: 0.1,
  Cost_per_power_gold: 3,
  Upgrade_HP_x: { 1: 1.0, 2: 1.6, 3: 2.4 },
  Upgrade_DPS_x: { 1: 1.0, 2: 1.55, 3: 2.3 },
  Upgrade_Cost_x: { 1: 1.0, 2: 2.5, 3: 5.0 }
};

// Effectiveness matrix: damageType x armorClass -> multiplier
const EFF = {
  Kinetic:    { Organic: 1.0, Machinery: 1.0, Aircraft: 1.0, Structure: 1.0, Energy: 1.1 },
  Fire:       { Organic: 1.3, Machinery: 0.8, Aircraft: 0.8, Structure: 1.1, Energy: 0.8 },
  Poison:     { Organic: 1.8, Machinery: 0.1, Aircraft: 0.1, Structure: 0.0, Energy: 0.0 },
  Concussion: { Organic: 0.4, Machinery: 1.7, Aircraft: 0.9, Structure: 1.0, Energy: 0.4 },
  Electric:   { Organic: 0.5, Machinery: 1.8, Aircraft: 1.2, Structure: 0.5, Energy: 0.6 },
  Frost:      { Organic: 0.6, Machinery: 0.6, Aircraft: 0.5, Structure: 0.5, Energy: 0.9 }
};

/**
 * StatMath — pure functions deriving stats from data tables.
 * No hardcoded balance beyond the Assumptions constants above,
 * which mirror config/assumptions.js. Callers should pass tables
 * (config.data.tables) where possible; sensible fallbacks are used.
 */

function pick(tables, name) {
  if (!tables) return null;
  return tables[name] || (tables.data && tables.data[name]) || null;
}

// Resolve assumptions from tables, falling back to embedded copy.
function assumptions(tables) {
  const t = pick(tables, 'assumptions');
  if (!t) return A;
  // t may be a keyed object already
  const get = (k, d) => (t[k] !== undefined ? t[k] : d);
  return {
    HP_per_point: get('HP_per_point', A.HP_per_point),
    DPS_per_point: get('DPS_per_point', A.DPS_per_point),
    Range_per_point: get('Range_per_point', A.Range_per_point),
    Speed_per_point: get('Speed_per_point', A.Speed_per_point),
    Vision_base: get('Vision_base', A.Vision_base),
    Vision_per_util_point: get('Vision_per_util_point', A.Vision_per_util_point),
    Cost_per_power_gold: get('Cost_per_power_gold', A.Cost_per_power_gold),
    Upgrade_HP_x: {
      1: 1.0,
      2: get('Upgrade_HP_x_T2', A.Upgrade_HP_x[2]),
      3: get('Upgrade_HP_x_T3', A.Upgrade_HP_x[3])
    },
    Upgrade_DPS_x: {
      1: 1.0,
      2: get('Upgrade_DPS_x_T2', A.Upgrade_DPS_x[2]),
      3: get('Upgrade_DPS_x_T3', A.Upgrade_DPS_x[3])
    },
    Upgrade_Cost_x: {
      1: 1.0,
      2: get('Upgrade_Cost_x_T2', A.Upgrade_Cost_x[2]),
      3: get('Upgrade_Cost_x_T3', A.Upgrade_Cost_x[3])
    }
  };
}

function effectivenessMatrix(tables) {
  const t = pick(tables, 'effectiveness');
  if (t && t.matrix) return t.matrix;
  if (t && typeof t === 'object' && t.Kinetic) return t;
  return EFF;
}

// ---- Point-budget → base stat derivation (Archetypes sheet math) ----

function hpFromPoints(pts, ass) { return pts * ass.HP_per_point; }
function dpsFromPoints(pts, ass) { return pts * ass.DPS_per_point; }
function rangeFromPoints(pts, ass) { return pts * ass.Range_per_point; }
function speedFromPoints(pts, ass) { return pts * ass.Speed_per_point; }
function visionFromPoints(utilPts, ass) { return ass.Vision_base + utilPts * ass.Vision_per_util_point; }

/**
 * Derive base stats for an archetype (pre-faction-mod).
 * archetype: { HP_pts, DPS_pts, Range_pts, Speed_pts, Util_pts }
 */
function deriveArchetypeBase(archetype, tables) {
  const ass = assumptions(tables);
  return {
    hp: hpFromPoints(archetype.HP_pts, ass),
    dps: dpsFromPoints(archetype.DPS_pts, ass),
    range: rangeFromPoints(archetype.Range_pts, ass),
    speed: speedFromPoints(archetype.Speed_pts, ass),
    vision: visionFromPoints(archetype.Util_pts, ass),
    power: (archetype.HP_pts + archetype.DPS_pts + archetype.Range_pts +
            archetype.Speed_pts + archetype.Util_pts)
  };
}

/**
 * Apply faction modifiers to a base stat block.
 * mods: { HP_x, DPS_x, Range_x, Speed_x }
 */
function applyFactionMods(base, mods) {
  if (!mods) return { ...base };
  return {
    hp: base.hp * (mods.HP_x != null ? mods.HP_x : 1),
    dps: base.dps * (mods.DPS_x != null ? mods.DPS_x : 1),
    range: base.range * (mods.Range_x != null ? mods.Range_x : 1),
    speed: base.speed * (mods.Speed_x != null ? mods.Speed_x : 1),
    vision: base.vision,
    power: base.power
  };
}

// ---- Tier scaling ----

function tierHP(hpT1, tier, tables) {
  const ass = assumptions(tables);
  return hpT1 * (ass.Upgrade_HP_x[tier] || 1);
}
function tierDPS(dpsT1, tier, tables) {
  const ass = assumptions(tables);
  return dpsT1 * (ass.Upgrade_DPS_x[tier] || 1);
}

/**
 * Cost derived from power (even-baseline: equal power = equal cost),
 * scaled by cumulative tier cost multiplier.
 */
function costFromPower(power, tier, tables) {
  const ass = assumptions(tables);
  const base = power * ass.Cost_per_power_gold;
  return Math.round(base * (ass.Upgrade_Cost_x[tier] || 1));
}

/**
 * Full stat block for a given tier from a T1 stat descriptor.
 * statT1: { hp, dps, range, speed, vision, power }
 */
function statsForTier(statT1, tier, tables) {
  return {
    tier,
    hp: tierHP(statT1.hp, tier, tables),
    dps: tierDPS(statT1.dps, tier, tables),
    range: statT1.range,
    speed: statT1.speed,
    vision: statT1.vision,
    power: statT1.power,
    cost: costFromPower(statT1.power, tier, tables)
  };
}

// ---- Effective DPS (damage-type vs armor-class) ----

function typeMultiplier(damageType, armorClass, tables) {
  const m = effectivenessMatrix(tables);
  const row = m[damageType];
  if (!row) return 1;
  const v = row[armorClass];
  return v == null ? 1 : v;
}

/**
 * Effective DPS of an attacker's damageType against a target armorClass.
 */
function effDPS(rawDPS, damageType, targetArmorClass, tables) {
  return rawDPS * typeMultiplier(damageType, targetArmorClass, tables);
}

/**
 * Convenience: effective DPS vs the three canonical armor buckets.
 */
function effDPSProfile(rawDPS, damageType, tables) {
  return {
    vsOrganic: effDPS(rawDPS, damageType, 'Organic', tables),
    vsMachinery: effDPS(rawDPS, damageType, 'Machinery', tables),
    vsAircraft: effDPS(rawDPS, damageType, 'Aircraft', tables),
    vsStructure: effDPS(rawDPS, damageType, 'Structure', tables),
    vsEnergy: effDPS(rawDPS, damageType, 'Energy', tables)
  };
}

/**
 * Compute damage dealt over a time delta (seconds), applying type effectiveness.
 * Returns raw hit-point damage number.
 */
function damageOver(rawDPS, damageType, targetArmorClass, dtSeconds, tables) {
  return effDPS(rawDPS, damageType, targetArmorClass, tables) * dtSeconds;
}

/**
 * Sell refund: partial refund of cumulative invested cost.
 * refundFraction defaults to 0.5.
 */
function sellRefund(power, tier, tables, refundFraction) {
  const f = refundFraction == null ? 0.5 : refundFraction;
  return Math.round(costFromPower(power, tier, tables) * f);
}

/**
 * Upgrade cost to go from currentTier -> currentTier+1.
 * Difference between cumulative costs.
 */
function upgradeCost(power, currentTier, tables) {
  if (currentTier >= 3) return Infinity;
  const next = currentTier + 1;
  return costFromPower(power, next, tables) - costFromPower(power, currentTier, tables);
}

/**
 * Frost applies no slow to Aircraft (design rule). Helper for status logic.
 */
function statusApplies(damageType, targetArmorClass) {
  if (damageType === 'Frost' && targetArmorClass === 'Aircraft') return false;
  if (damageType === 'Poison' && (targetArmorClass === 'Machinery' ||
      targetArmorClass === 'Aircraft' || targetArmorClass === 'Energy')) return false;
  return true;
}

export const StatMath = {
  assumptions,
  effectivenessMatrix,
  deriveArchetypeBase,
  applyFactionMods,
  hpFromPoints,
  dpsFromPoints,
  rangeFromPoints,
  speedFromPoints,
  visionFromPoints,
  tierHP,
  tierDPS,
  costFromPower,
  statsForTier,
  typeMultiplier,
  effDPS,
  effDPSProfile,
  damageOver,
  sellRefund,
  upgradeCost,
  statusApplies
};

export default StatMath;