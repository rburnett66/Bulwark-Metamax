// src/data/verticalSlice.js
//
// Vertical Slice benchmark data (GDD §19).
// Locks the exact units + towers + wave definitions used for the primary
// deterministic benchmark scenario. All numbers are DERIVED from the balance
// workbook (Assumptions / Archetypes / Faction_Mods / Effectiveness) and the
// Units / Structures rosters — kept self-contained here so the slice is
// reproducible without touching the larger tables.
//
// This module exports a single `verticalSlice` object plus a helper
// `buildVerticalSlice(tables)` that resolves the locked IDs against the live
// data tables in config.data.tables (index.js aggregates these).
//
// The slice implements the tutorial faction: Ground / Powder, 3 units spanning
// behavior (walker / floater-on-water / flyer), and the 3 core towers
// (anti-ground, anti-air, wall/moat terrain piece).

// ---------------------------------------------------------------------------
// Locked economy / scenario constants for the benchmark
// ---------------------------------------------------------------------------
export const SLICE_SEED = 0xB0157A11; // "BULWARK" fixed benchmark seed

export const SLICE_ECONOMY = {
  startingGold: 600,
  incomePerSecond: 8, // real-time accrual
  killIncomeMultiplier: 0.25, // fraction of unit Cost T1 granted on kill
  refundRate: 0.5, // partial refund on sell
};

export const SLICE_BASE = {
  hp: 2000,
  slots: 6, // hard-point slots available in the slice
};

export const SLICE_WIN = {
  wavesToSurvive: 3,
};

// ---------------------------------------------------------------------------
// Locked ATTACKER UNITS (Ground / Powder tutorial faction)
// 3 units spanning the required behaviors: walker, floater(water), flyer.
// Stats mirror the Units sheet rows for the Ground/Powder faction, with a
// water-domain variant derived from the Troops archetype for the slice.
// ---------------------------------------------------------------------------
export const SLICE_UNITS = [
  {
    id: 'GND-Walker',
    sourceId: 'GND-Troops',
    faction: 'Ground / Powder',
    label: 'Powder Infantry',
    shape: 'Troops',
    role: 'Skirmisher',
    domain: 'walker', // uses GROUND lane, blocked by water/walls/moats
    armorClass: 'Organic',
    damageType: 'Kinetic',
    canTarget: ['ground'],
    targets: 'base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: false,
    seesGround: false,
    hp: [220, 352, 528],
    dps: [45, 69.75, 103.5],
    range: 2.5,
    speed: 1.84,
    vision: 5.5,
    power: 100,
    cost: [300, 750, 1500],
    effDps: { organic: 45, machinery: 45, aircraft: 0 },
  },
  {
    id: 'GND-Floater',
    sourceId: 'GND-Troops',
    faction: 'Ground / Powder',
    label: 'Powder Marine',
    shape: 'Troops',
    role: 'Amphibious',
    domain: 'floater', // uses WATER lane
    armorClass: 'Organic',
    damageType: 'Kinetic',
    canTarget: ['ground'],
    targets: 'base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: false,
    seesGround: false,
    // Slightly hardier & slower on the water lane (Water-theme tilt applied).
    hp: [246, 394, 591],
    dps: [42.75, 66.26, 98.32],
    range: 2.5,
    speed: 1.62,
    vision: 5.5,
    power: 100,
    cost: [312, 780, 1560],
    effDps: { organic: 42.75, machinery: 42.75, aircraft: 0 },
  },
  {
    id: 'GND-Flyer',
    sourceId: 'GND-Copters',
    faction: 'Ground / Powder',
    label: 'Powder Copter',
    shape: 'Copters',
    role: 'Harasser',
    domain: 'flyer', // ignores ground terrain and walls; has altitude
    altitude: 1,
    armorClass: 'Aircraft',
    damageType: 'Kinetic',
    canTarget: ['ground', 'air'],
    targets: 'base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: true,
    seesGround: true,
    hp: [220, 352, 528],
    dps: [45, 69.75, 103.5],
    range: 5,
    speed: 1.84,
    vision: 4.5,
    power: 100,
    cost: [300, 750, 1500],
    effDps: { organic: 45, machinery: 45, aircraft: 45 },
  },
];

// ---------------------------------------------------------------------------
// Locked DEFENSE STRUCTURES (towers + terrain piece)
// 3 required: anti-ground tower, anti-air tower, wall/moat terrain piece.
// Each: place (space+cost+build time), fire, take damage, repair, upgrade once,
// sell. Stats derived from the Structures roster philosophy (100-pt budget,
// gold = power x 3, upgrade curves from Assumptions).
// ---------------------------------------------------------------------------
export const SLICE_STRUCTURES = [
  {
    id: 'STR-GroundTower',
    kind: 'tower',
    weaponClass: 'ballistic',
    label: 'Cannon Tower',
    armorClass: 'Structure',
    damageType: 'Kinetic',
    // Weapon domain targeting: anti-ground CANNOT hit air.
    canTarget: ['ground'],
    footprint: { w: 1, h: 1 },
    hp: [400, 640, 960], // T1 x1.6 -> T2, x2.4 -> T3
    dps: [50, 77.5, 115], // T1 x1.55 -> T2, x2.3 -> T3
    range: 4.5,
    fireInterval: 0.9, // seconds between shots (lock-on wind-up ~time-to-fire)
    vision: 5,
    buildTime: 3.0, // seconds Placing->Building->Complete
    cost: [180, 450, 900], // gold, cumulative curve x2.5 (T2) x5 (T3)
    upgradeCost: [270, 450], // cost to reach T2 from T1, T3 from T2
    aoe: 0,
    status: null,
  },
  {
    id: 'STR-AirTower',
    kind: 'tower',
    weaponClass: 'hitscan',
    label: 'Flak Tower',
    armorClass: 'Structure',
    damageType: 'Electric',
    // Anti-air: CAN target Air (and ground too, at reduced value).
    canTarget: ['air', 'ground'],
    footprint: { w: 1, h: 1 },
    hp: [320, 512, 768],
    dps: [40, 62, 92],
    range: 6,
    fireInterval: 0.6,
    vision: 6,
    buildTime: 3.5,
    cost: [210, 525, 1050],
    upgradeCost: [315, 525],
    aoe: 0,
    status: 'Overload',
  },
  {
    id: 'STR-Wall',
    kind: 'wall', // terrain piece: reroutes walkers; no weapon
    weaponClass: null,
    label: 'Barricade / Moat',
    armorClass: 'Structure',
    damageType: null,
    canTarget: [],
    footprint: { w: 1, h: 1 },
    // Wall reroutes walkers; moat variant blocks walkers and reroutes paths.
    blocksWalkers: true,
    blocksFloaters: false,
    blocksFlyers: false,
    hp: [600, 960, 1440],
    dps: [0, 0, 0],
    range: 0,
    fireInterval: 0,
    vision: 0,
    buildTime: 2.0,
    cost: [90, 225, 450],
    upgradeCost: [135, 225],
    aoe: 0,
    status: null,
  },
];

// ---------------------------------------------------------------------------
// Locked WAVE DEFINITIONS for the benchmark.
// survive N waves = win; base HP -> 0 = lose.
// Each spawn: { unitId, tier, count, spacing (sec between spawns) }
// ---------------------------------------------------------------------------
export const SLICE_WAVES = [
  {
    index: 0,
    startDelay: 4.0,
    spawns: [
      { unitId: 'GND-Walker', tier: 1, count: 5, spacing: 1.2, lane: 'ground' },
      { unitId: 'GND-Floater', tier: 1, count: 3, spacing: 1.6, lane: 'water' },
    ],
  },
  {
    index: 1,
    startDelay: 3.0,
    spawns: [
      { unitId: 'GND-Walker', tier: 1, count: 6, spacing: 1.0, lane: 'ground' },
      { unitId: 'GND-Floater', tier: 1, count: 4, spacing: 1.4, lane: 'water' },
      { unitId: 'GND-Flyer', tier: 1, count: 2, spacing: 2.0, lane: 'air' },
    ],
  },
  {
    index: 2,
    startDelay: 3.0,
    spawns: [
      { unitId: 'GND-Walker', tier: 2, count: 6, spacing: 0.9, lane: 'ground' },
      { unitId: 'GND-Floater', tier: 2, count: 4, spacing: 1.2, lane: 'water' },
      { unitId: 'GND-Flyer', tier: 2, count: 4, spacing: 1.5, lane: 'air' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a locked slice unit definition by id.
 */
export function getSliceUnit(id) {
  return SLICE_UNITS.find((u) => u.id === id) || null;
}

/**
 * Look up a locked slice structure definition by id.
 */
export function getSliceStructure(id) {
  return SLICE_STRUCTURES.find((s) => s.id === id) || null;
}

/**
 * Resolve tier-scaled stats for a slice unit at a given tier (1..3).
 */
export function sliceUnitStats(unit, tier = 1) {
  const t = Math.max(1, Math.min(3, tier | 0)) - 1;
  return {
    hp: unit.hp[t],
    dps: unit.dps[t],
    range: unit.range,
    speed: unit.speed,
    vision: unit.vision,
    cost: unit.cost[t],
    domain: unit.domain,
    armorClass: unit.armorClass,
    damageType: unit.damageType,
    canTarget: unit.canTarget.slice(),
    targetsBase: unit.targetsBase,
    targetsStructures: unit.targetsStructures,
    altitude: unit.altitude || 0,
  };
}

/**
 * Resolve tier-scaled stats for a slice structure at a given tier (1..3).
 */
export function sliceStructureStats(str, tier = 1) {
  const t = Math.max(1, Math.min(3, tier | 0)) - 1;
  return {
    hp: str.hp[t],
    dps: str.dps[t],
    range: str.range,
    fireInterval: str.fireInterval,
    vision: str.vision,
    cost: str.cost[t],
    buildTime: str.buildTime,
    canTarget: str.canTarget.slice(),
    kind: str.kind,
    weaponClass: str.weaponClass,
    armorClass: str.armorClass,
    damageType: str.damageType,
    footprint: { ...str.footprint },
    blocksWalkers: !!str.blocksWalkers,
    blocksFloaters: !!str.blocksFloaters,
    blocksFlyers: !!str.blocksFlyers,
    status: str.status,
    aoe: str.aoe,
  };
}

/**
 * Cost to upgrade a slice structure from `fromTier` to `fromTier+1`.
 */
export function sliceUpgradeCost(str, fromTier) {
  const idx = fromTier - 1; // upgradeCost[0]=1->2, [1]=2->3
  if (idx < 0 || idx >= str.upgradeCost.length) return null;
  return str.upgradeCost[idx];
}

/**
 * Refund value for selling a slice structure at a given tier.
 */
export function sliceSellRefund(str, tier) {
  const t = Math.max(1, Math.min(3, tier | 0)) - 1;
  return Math.floor(str.cost[t] * SLICE_ECONOMY.refundRate);
}

/**
 * Build the full aggregated slice descriptor. If live `tables` are provided
 * (from config.data.tables) they are attached for cross-reference, but the
 * slice remains self-contained so it can drive the benchmark independently.
 */
export function buildVerticalSlice(tables = null) {
  return {
    seed: SLICE_SEED,
    faction: 'Ground / Powder',
    economy: { ...SLICE_ECONOMY },
    base: { ...SLICE_BASE },
    win: { ...SLICE_WIN },
    units: SLICE_UNITS.map((u) => ({ ...u })),
    structures: SLICE_STRUCTURES.map((s) => ({ ...s })),
    waves: SLICE_WAVES.map((w) => ({
      ...w,
      spawns: w.spawns.map((sp) => ({ ...sp })),
    })),
    // Optional back-reference to the aggregate tables (never required).
    tables: tables || null,
    // Convenience resolvers bound to this slice.
    getUnit: getSliceUnit,
    getStructure: getSliceStructure,
    unitStats: sliceUnitStats,
    structureStats: sliceStructureStats,
    upgradeCost: sliceUpgradeCost,
    sellRefund: sliceSellRefund,
  };
}

export const verticalSlice = buildVerticalSlice(null);

export default verticalSlice;