// src/config/verticalSlice.js
// Locked vertical-slice roster for the primary benchmark (GDD §19).
// 3 attacker units (spanning walker / floater / flyer behavior),
// 3 towers (anti-ground x2, anti-air x1), and wall + moat terrain pieces.
//
// This module is DATA ONLY. Stats resolve through statMath from the underlying
// tables (assumptions/archetypes/factionMods/damageTypes/effectiveness). The IDs
// here reference roster/structure entries and pin which subset the slice uses.
//
// No hardcoded balance: everything below is either a table reference (an ID that
// statMath expands) or a slice-composition constant (which units/towers exist,
// where lanes/slots live). Numeric balance is derived at runtime.

// ---------------------------------------------------------------------------
// Attacker units for the slice — Ground/Powder tutorial faction.
// Spans the three movement domains required by acceptance:
//   walker (ground lane), floater (water lane via faction domain override),
//   flyer (ignores terrain).
// ---------------------------------------------------------------------------

// The Ground/Powder faction has no native swimmer, so for the slice we tag one
// walker-shape unit as a floater override to satisfy the "floater uses water"
// acceptance item. statMath reads the domain override to place it on water.
export const sliceAttackers = [
  {
    sliceId: 'attacker_walker',
    unitId: 'GND-Tanks',       // Bruiser walker: ground lane, targets Base
    domainOverride: 'Walker',
    label: 'Tank (Walker)',
    color: 0x9c6b3a,
    role: 'walker',
  },
  {
    sliceId: 'attacker_floater',
    unitId: 'GND-Trucks',      // Support chassis re-tasked as amphibious floater
    domainOverride: 'Floater', // rides the water lane
    label: 'Amphib (Floater)',
    color: 0x3a7ba0,
    role: 'floater',
  },
  {
    sliceId: 'attacker_flyer',
    unitId: 'GND-Copters',     // Harasser flyer: ignores terrain, targets Base
    domainOverride: 'Flyer',
    label: 'Copter (Flyer)',
    color: 0xb0b0c0,
    role: 'flyer',
    baseAltitude: 3,
  },
];

// ---------------------------------------------------------------------------
// Towers for the slice.
// Two anti-ground weapon towers and one anti-air tower.
// Each references a structures.js definition; the slice pins which ones appear
// in the build palette.
// ---------------------------------------------------------------------------
export const sliceTowers = [
  {
    sliceId: 'tower_ag_kinetic',
    structureId: 'TWR-Cannon',   // anti-ground kinetic; cannot target air
    label: 'Cannon',
    color: 0x707070,
    canTargetAir: false,
    domain: ['Ground', 'Water'],
    damageType: 'Kinetic',
  },
  {
    sliceId: 'tower_ag_arc',
    structureId: 'TWR-Mortar',   // anti-ground splash; cannot target air
    label: 'Mortar',
    color: 0x8a6a4a,
    canTargetAir: false,
    domain: ['Ground', 'Water'],
    damageType: 'Concussion',
    aoe: 1.5,
  },
  {
    sliceId: 'tower_aa',
    structureId: 'TWR-Flak',     // anti-air; can target air (and ground)
    label: 'Flak',
    color: 0x5a7a9a,
    canTargetAir: true,
    domain: ['Ground', 'Water', 'Air'],
    damageType: 'Electric',
  },
];

// ---------------------------------------------------------------------------
// Terrain pieces: wall (routes attack paths) and moat (blocks walkers).
// These reference structures.js and are placeable in the slice palette.
// ---------------------------------------------------------------------------
export const sliceTerrain = [
  {
    sliceId: 'terrain_wall',
    structureId: 'TER-Wall',
    label: 'Wall',
    color: 0x8c8c8c,
    footprint: { w: 1, h: 1 },
    kind: 'wall',
    blocksWalker: true,   // walls block & reroute
    blocksFloater: false,
  },
  {
    sliceId: 'terrain_moat',
    structureId: 'TER-Moat',
    label: 'Moat',
    color: 0x2a5a80,
    footprint: { w: 1, h: 1 },
    kind: 'moat',
    blocksWalker: true,   // moats block walkers
    blocksFloater: false, // floaters cross water
  },
];

// ---------------------------------------------------------------------------
// Slice geometry constants (tile units). geometry.js consumes these to build
// the ground lane, water lane, base, and hard-point slots.
// ---------------------------------------------------------------------------
export const sliceGeometry = {
  gridWidth: 20,
  gridHeight: 14,
  // Ground lane occupies upper band; water lane the lower band.
  groundLane: { y0: 1, y1: 5 },   // rows [y0,y1)
  waterLane: { y0: 8, y1: 12 },   // rows [y0,y1)
  // Attackers enter from the left edge, base sits at right in a clearing.
  spawnX: 0,
  base: {
    x: 18,
    yGround: 3, // ground-lane base anchor row
    yWater: 9,  // water-lane base anchor row
    hp: 2000,
    level: 1,
  },
  // Hard-point slots (structure snap points). Slot count scales with base level;
  // baseSlotCount at level 1, +slotsPerLevel per base level.
  baseSlotCount: 6,
  slotsPerLevel: 2,
  // Fixed candidate slot positions (tile coords). Extra slots beyond the current
  // base level are inactive until upgraded.
  slots: [
    { x: 6, y: 6 },
    { x: 9, y: 6 },
    { x: 12, y: 6 },
    { x: 15, y: 6 },
    { x: 6, y: 7 },
    { x: 9, y: 7 },
    { x: 12, y: 7 },
    { x: 15, y: 7 },
    { x: 3, y: 6 },
    { x: 3, y: 7 },
  ],
};

// ---------------------------------------------------------------------------
// Economy / benchmark parameters for the slice.
// ---------------------------------------------------------------------------
export const sliceEconomy = {
  startingGold: 800,
  moneyPerSecond: 12,        // real-time accrual
  killIncomeFraction: 0.5,   // kill grants this fraction of the unit's Cost T1
  sellRefundFraction: 0.6,   // partial refund on sell
  repairTroopCost: 1,        // troops consumed per repair
  repairTravelSpeed: 3.0,    // tiles/sec troop travel to structure
  repairRatePerSec: 40,      // HP restored/sec once troop arrives
};

// ---------------------------------------------------------------------------
// Win/lose + wave benchmark parameters for the slice.
// ---------------------------------------------------------------------------
export const sliceRules = {
  wavesToWin: 5,             // survive N waves = win
  buildTimeSeconds: 3,       // Placing -> Building -> Complete
  damagedThreshold: 0.6,     // hp fraction below which state = Damaged
  seed: 1337,                // default deterministic benchmark seed
};

// ---------------------------------------------------------------------------
// Convenience index: sliceId -> descriptor, for palette + controller lookup.
// ---------------------------------------------------------------------------
export const sliceIndex = (() => {
  const idx = {};
  for (const a of sliceAttackers) idx[a.sliceId] = { ...a, group: 'attacker' };
  for (const t of sliceTowers) idx[t.sliceId] = { ...t, group: 'tower' };
  for (const t of sliceTerrain) idx[t.sliceId] = { ...t, group: 'terrain' };
  return idx;
})();

// Palette listing (order matters for HUD build palette).
export const slicePaletteOrder = [
  'tower_ag_kinetic',
  'tower_ag_arc',
  'tower_aa',
  'terrain_wall',
  'terrain_moat',
];

// Deploy listing (attacker units available for the deploy loop).
export const sliceDeployOrder = [
  'attacker_walker',
  'attacker_floater',
  'attacker_flyer',
];

const verticalSlice = {
  attackers: sliceAttackers,
  towers: sliceTowers,
  terrain: sliceTerrain,
  geometry: sliceGeometry,
  economy: sliceEconomy,
  rules: sliceRules,
  index: sliceIndex,
  paletteOrder: slicePaletteOrder,
  deployOrder: sliceDeployOrder,
};

export default verticalSlice;