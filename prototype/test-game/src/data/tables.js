// src/data/tables.js
// -----------------------------------------------------------------------------
// BULWARK — single source of ALL balance data (vertical slice).
// Transcribed from the bulwark-balance workbook (v1, even-baseline).
// No balance numbers exist anywhere else in the codebase.
// -----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Assumptions sheet + slice economy constants
// ---------------------------------------------------------------------------
export const ASSUMPTIONS = Object.freeze({
  hpPerPoint: 10,          // 1 HP budget point = 10 hit points
  dpsPerPoint: 1.5,        // 1 DPS point = 1.5 damage/sec (raw, pre-type)
  rangePerPoint: 0.25,     // 1 range point = 0.25 tiles
  speedPerPoint: 0.08,     // 1 speed point = 0.08 tiles/sec
  visionBase: 4,           // baseline vision in tiles
  visionPerUtil: 0.1,      // each utility point adds 0.1 tiles vision
  costPerPowerGold: 3,     // gold cost = power x this
  upgradeHpX: Object.freeze({ t2: 1.6, t3: 2.4 }),
  upgradeDpsX: Object.freeze({ t2: 1.55, t3: 2.3 }),
  upgradeCostX: Object.freeze({ t2: 2.5, t3: 5 }),
  // slice economy constants
  sellRefundFrac: 0.5,     // fraction of total invested value refunded on sell
  incomePerSec: 8,         // passive gold accrual
  startingMoney: 900,      // opening bankroll
  killIncomeFrac: 0.25     // kill reward = frac x unit T1 cost
});

// ---------------------------------------------------------------------------
// Effectiveness sheet: damage type x armor class multiplier matrix
// ---------------------------------------------------------------------------
export const EFFECTIVENESS = Object.freeze({
  Kinetic:    Object.freeze({ Organic: 1,   Machinery: 1,   Aircraft: 1,   Structure: 1,   Energy: 1.1 }),
  Fire:       Object.freeze({ Organic: 1.3, Machinery: 0.8, Aircraft: 0.8, Structure: 1.1, Energy: 0.8 }),
  Poison:     Object.freeze({ Organic: 1.8, Machinery: 0.1, Aircraft: 0.1, Structure: 0,   Energy: 0 }),
  Concussion: Object.freeze({ Organic: 0.4, Machinery: 1.7, Aircraft: 0.9, Structure: 1,   Energy: 0.4 }),
  Electric:   Object.freeze({ Organic: 0.5, Machinery: 1.8, Aircraft: 1.2, Structure: 0.5, Energy: 0.6 }),
  Frost:      Object.freeze({ Organic: 0.6, Machinery: 0.6, Aircraft: 0.5, Structure: 0.5, Energy: 0.9 })
});

// ---------------------------------------------------------------------------
// DamageTypes sheet: status-effect flags. Frost NEVER slows air (design rule).
// ---------------------------------------------------------------------------
export const DAMAGE_TYPES = Object.freeze({
  Kinetic:    Object.freeze({ status: null,       dot: false, slow: false, chain: false, slowsAir: false }),
  Fire:       Object.freeze({ status: 'Burn',     dot: true,  slow: false, chain: false, slowsAir: false }),
  Poison:     Object.freeze({ status: 'Toxin',    dot: true,  slow: false, chain: false, slowsAir: false }),
  Concussion: Object.freeze({ status: 'Stagger',  dot: false, slow: false, chain: false, slowsAir: false }),
  Electric:   Object.freeze({ status: 'Overload', dot: false, slow: false, chain: true,  slowsAir: false }),
  Frost:      Object.freeze({ status: 'Chill',    dot: false, slow: true,  chain: false, slowsAir: false })
});

// ---------------------------------------------------------------------------
// Units sheet — Ground/Powder slice roster (workbook rows verbatim) plus the
// GND-Floaters row derived per the model rules:
//   Troops archetype budget (HP20/DPS30/Rng10/Spd25/Util15) x Ground faction
//   mods (HPx1.1, Speedx0.92) re-domained onto the water lane as a Floater.
//   hp = 20*10*1.1 = 220 ; dps = 30*1.5 = 45 ; range = 10*0.25 = 2.5 ;
//   speed = 25*0.08*0.92 = 1.84 ; vision = 4 + 15*0.1 = 5.5 ; power 100 ;
//   cost = 100*3 = 300 (T2 x2.5, T3 x5).
// ---------------------------------------------------------------------------
export const UNITS = Object.freeze({
  'GND-Troops': Object.freeze({
    faction: 'Ground / Powder', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 2.5, speed: 1.84, vision: 5.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'GND-Trucks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Trucks', role: 'Support',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [275, 440, 660], dps: [15, 23.25, 34.5],
    range: 1.25, speed: 2.944, vision: 6,
    power: 99.3, cost: [297.9, 744.75, 1489.5]
  }),
  'GND-Tanks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [440, 704, 1056], dps: [45, 69.75, 103.5],
    range: 3.75, speed: 0.736, vision: 4.5,
    power: 103.2, cost: [309.6, 774, 1548]
  }),
  'GND-Artillery': Object.freeze({
    faction: 'Ground / Powder', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [165, 264, 396], dps: [60, 93, 138],
    range: 10, speed: 0.368, vision: 4,
    power: 101.1, cost: [303.3, 758.25, 1516.5]
  }),
  'GND-HeavyTanks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [605, 968, 1452], dps: [37.5, 58.125, 86.25],
    range: 3, speed: 0.368, vision: 4.3,
    power: 105.1, cost: [315.3, 788.25, 1576.5]
  }),
  'GND-Floaters': Object.freeze({
    // Derived slice row (see header note): the Ground/Powder water-lane raider.
    faction: 'Ground / Powder', shape: 'Floaters', role: 'Raider',
    domain: 'Floater', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 2.5, speed: 1.84, vision: 5.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'GND-Copters': Object.freeze({
    faction: 'Ground / Powder', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 5, speed: 1.84, vision: 4.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'GND-Planes': Object.freeze({
    faction: 'Ground / Powder', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [165, 264, 396], dps: [52.5, 81.375, 120.75],
    range: 6.25, speed: 1.84, vision: 4,
    power: 99.5, cost: [298.5, 746.25, 1492.5]
  }),
  'GND-Missiles': Object.freeze({
    faction: 'Ground / Powder', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [110, 176, 264], dps: [67.5, 104.625, 155.25],
    range: 8.75, speed: 0.736, vision: 4,
    power: 100.2, cost: [300.6, 751.5, 1503]
  })
});

// ---------------------------------------------------------------------------
// Structures sheet — slice defenses. T2/T3 follow the assumption multipliers:
// HP x1.6/x2.4 · DPS x1.55/x2.3 · cumulative value x2.5/x5.
// canTargetDomains encodes the weapon-domain rule (anti-ground never hits
// Flyer; Floater counts as Ground; anti-air hits Flyer only).
// ---------------------------------------------------------------------------
export const STRUCTURES = Object.freeze({
  'STR-Cannon': Object.freeze({
    name: 'Cannon Tower', kind: 'antiGround',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: ['Walker', 'Floater'],
    hp: [400, 640, 960], dps: [45, 69.75, 103.5],
    range: 4.5, cost: [300, 750, 1500],
    buildTime: 3, upgradeTime: 4, sellTime: 1.5,
    footprint: Object.freeze({ w: 1, h: 1 })
  }),
  'STR-Flak': Object.freeze({
    name: 'Flak Tower', kind: 'antiAir',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: ['Flyer'],
    hp: [300, 480, 720], dps: [40, 62, 92],
    range: 6.5, cost: [300, 750, 1500],
    buildTime: 3, upgradeTime: 4, sellTime: 1.5,
    footprint: Object.freeze({ w: 1, h: 1 })
  }),
  'STR-Wall': Object.freeze({
    name: 'Wall', kind: 'wall',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: [],
    hp: [600, 960, 1440], dps: [0, 0, 0],
    range: 0, cost: [100, 250, 500],
    buildTime: 2, upgradeTime: 3, sellTime: 1,
    footprint: Object.freeze({ w: 1, h: 1 })
  }),
  'STR-Moat': Object.freeze({
    name: 'Moat', kind: 'moat',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: [],
    hp: [400, 640, 960], dps: [0, 0, 0],
    range: 0, cost: [80, 200, 400],
    buildTime: 2, upgradeTime: 3, sellTime: 1,
    footprint: Object.freeze({ w: 1, h: 1 })
  })
});

// ---------------------------------------------------------------------------
// Waves — survive every entry to win. delay = seconds after wave start for
// the first spawn of the group; interval = seconds between spawns in group.
// ---------------------------------------------------------------------------
export const WAVES = Object.freeze([
  {
    wave: 1,
    spawns: [
      { unitId: 'GND-Troops', count: 5, lane: 'ground', delay: 0, interval: 1.4 }
    ]
  },
  {
    wave: 2,
    spawns: [
      { unitId: 'GND-Troops', count: 6, lane: 'ground', delay: 0, interval: 1.2 },
      { unitId: 'GND-Trucks', count: 2, lane: 'ground', delay: 3, interval: 2.0 }
    ]
  },
  {
    wave: 3,
    spawns: [
      { unitId: 'GND-Troops',   count: 4, lane: 'ground', delay: 0,   interval: 1.2 },
      { unitId: 'GND-Floaters', count: 3, lane: 'water',  delay: 1.5, interval: 2.0 }
    ]
  },
  {
    wave: 4,
    spawns: [
      { unitId: 'GND-Tanks',     count: 3, lane: 'ground', delay: 0, interval: 2.5 },
      { unitId: 'GND-Artillery', count: 2, lane: 'ground', delay: 4, interval: 3.0 },
      { unitId: 'GND-Copters',   count: 3, lane: 'air',    delay: 2, interval: 2.0 }
    ]
  },
  {
    wave: 5,
    spawns: [
      { unitId: 'GND-HeavyTanks', count: 2, lane: 'ground', delay: 0, interval: 4.0 },
      { unitId: 'GND-Troops',     count: 5, lane: 'ground', delay: 2, interval: 1.0 },
      { unitId: 'GND-Floaters',   count: 4, lane: 'water',  delay: 1, interval: 1.8 },
      { unitId: 'GND-Planes',     count: 2, lane: 'air',    delay: 3, interval: 2.5 },
      { unitId: 'GND-Missiles',   count: 2, lane: 'air',    delay: 8, interval: 3.0 }
    ]
  }
]);

// ---------------------------------------------------------------------------
// Map — the fixed slice/harness board.
//   Ground lane: row 5 left→right, then column 18 down to row 8, ending in
//   the base clearing. Water lane: river along row 11 turning north at
//   column 19 toward the clearing. Both lanes end at the base at (21,8).
// ---------------------------------------------------------------------------
const MAP_COLS = 24;
const MAP_ROWS = 16;
const MAP_TILE = 32;

const groundLane = [
  { x: 0, y: 5 }, { x: 18, y: 5 }, { x: 18, y: 8 }, { x: 20, y: 8 }
];

const waterLane = [
  { x: 0, y: 11 }, { x: 19, y: 11 }, { x: 19, y: 9 }
];

// River: row 11 from x0..19, plus the northward channel at x19, y9..10.
const waterCells = (() => {
  const cells = [];
  for (let x = 0; x <= 19; x++) cells.push({ x, y: 11 });
  cells.push({ x: 19, y: 10 });
  cells.push({ x: 19, y: 9 });
  return cells;
})();

const baseDef = { x: 21, y: 8, hp: 2000 };

// Hard-point tower slots (fixed; count scales with base level in full game).
const slots = [
  { x: 4,  y: 3 }, { x: 8,  y: 3 }, { x: 12, y: 3 }, { x: 16, y: 3 },
  { x: 4,  y: 7 }, { x: 8,  y: 7 }, { x: 12, y: 7 }, { x: 15, y: 9 },
  { x: 17, y: 10 }, { x: 20, y: 5 }, { x: 20, y: 10 }, { x: 14, y: 9 }
];

// Buildable region for walls / moats: the central band around the ground
// lane, excluding water, the base clearing, and hard-point slots.
const buildableCells = (() => {
  const isWater = (x, y) => waterCells.some(c => c.x === x && c.y === y);
  const isSlot = (x, y) => slots.some(s => s.x === x && s.y === y);
  const cells = [];
  for (let y = 3; y <= 10; y++) {
    for (let x = 2; x <= 20; x++) {
      if (isWater(x, y)) continue;
      if (isSlot(x, y)) continue;
      if (x === baseDef.x && y === baseDef.y) continue;
      // keep the tile directly in front of the base clear so the lane can
      // never be sealed by a single placement footprint
      if (x === 20 && y === 8) continue;
      cells.push({ x, y });
    }
  }
  return cells;
})();

export const MAP = Object.freeze({
  cols: MAP_COLS,
  rows: MAP_ROWS,
  tile: MAP_TILE,
  groundLane,
  waterLane,
  waterCells,
  spawnGround: { x: 0, y: 5 },
  spawnWater: { x: 0, y: 11 },
  spawnAir: { x: 0, y: 2 },
  base: baseDef,
  slots,
  buildableCells
});

// ---------------------------------------------------------------------------
// Lookups (throw on missing — a bad id is always a programming error)
// ---------------------------------------------------------------------------
export function getUnitDef(unitId) {
  const def = UNITS[unitId];
  if (!def) throw new Error('tables.getUnitDef: unknown unitId "' + unitId + '"');
  return def;
}

export function getStructureDef(structId) {
  const def = STRUCTURES[structId];
  if (!def) throw new Error('tables.getStructureDef: unknown structId "' + structId + '"');
  return def;
}

// ---------------------------------------------------------------------------
// Attach to the global namespace for the no-bundler build (index.html).
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.Bulwark = window.Bulwark || {};
  window.Bulwark.data = window.Bulwark.data || {};
  window.Bulwark.data.tables = {
    ASSUMPTIONS,
    EFFECTIVENESS,
    DAMAGE_TYPES,
    UNITS,
    STRUCTURES,
    WAVES,
    MAP,
    getUnitDef,
    getStructureDef
  };
}