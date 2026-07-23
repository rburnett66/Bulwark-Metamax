// src/data/tables.js
// -----------------------------------------------------------------------------
// BULWARK — single source of ALL balance data (vertical slice).
// Transcribed from the bulwark-balance workbook (v1, even-baseline).
// No balance numbers exist anywhere else in the codebase.
// -----------------------------------------------------------------------------
import { validateRenderTiers } from './renderTiers.js';

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
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 2.5, speed: 1.84, vision: 5.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'GND-Trucks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [275, 440, 660], dps: [15, 23.25, 34.5],
    range: 1.25, speed: 2.944, vision: 6,
    power: 99.3, cost: [297.9, 744.75, 1489.5]
  }),
  'GND-Tanks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [440, 704, 1056], dps: [45, 69.75, 103.5],
    range: 3.75, speed: 0.736, vision: 4.5,
    power: 103.2, cost: [309.6, 774, 1548]
  }),
  'GND-Artillery': Object.freeze({
    faction: 'Ground / Powder', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [165, 264, 396], dps: [60, 93, 138],
    range: 10, speed: 0.368, vision: 4,
    power: 101.1, cost: [303.3, 758.25, 1516.5]
  }),
  'GND-HeavyTanks': Object.freeze({
    faction: 'Ground / Powder', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [605, 968, 1452], dps: [37.5, 58.125, 86.25],
    range: 3, speed: 0.368, vision: 4.3,
    power: 105.1, cost: [315.3, 788.25, 1576.5]
  }),
  'GND-Copters': Object.freeze({
    faction: 'Ground / Powder', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 5, speed: 1.84, vision: 4.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'GND-Planes': Object.freeze({
    faction: 'Ground / Powder', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [165, 264, 396], dps: [52.5, 81.375, 120.75],
    range: 6.25, speed: 1.84, vision: 4,
    power: 99.5, cost: [298.5, 746.25, 1492.5]
  }),
  'GND-Missiles': Object.freeze({
    faction: 'Ground / Powder', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [110, 176, 264], dps: [67.5, 104.625, 155.25],
    range: 8.75, speed: 0.736, vision: 4,
    power: 100.2, cost: [300.6, 751.5, 1503]
  }),
  'AIR-Troops': Object.freeze({
    faction: 'Air', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [170, 272, 408], dps: [47.25, 73.2375, 108.675],
    range: 2.45, speed: 2.4, vision: 5.5,
    power: 103.3, cost: [309.9, 774.75, 1549.5]
  }),
  'AIR-Trucks': Object.freeze({
    faction: 'Air', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [212.5, 340, 510], dps: [15.75, 24.4125, 36.225],
    range: 1.225, speed: 3.84, vision: 6,
    power: 104.65, cost: [313.95, 784.875, 1569.75]
  }),
  'AIR-Tanks': Object.freeze({
    faction: 'Air', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [340, 544, 816], dps: [47.25, 73.2375, 108.675],
    range: 3.675, speed: 0.96, vision: 4.5,
    power: 97.2, cost: [291.6, 729, 1458]
  }),
  'AIR-Artillery': Object.freeze({
    faction: 'Air', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [127.5, 204, 306], dps: [63, 97.65, 144.9],
    range: 9.8, speed: 0.48, vision: 4,
    power: 99.95, cost: [299.85, 749.625, 1499.25]
  }),
  'AIR-HeavyTanks': Object.freeze({
    faction: 'Air', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [467.5, 748, 1122], dps: [39.375, 61.0312, 90.5625],
    range: 2.94, speed: 0.48, vision: 4.3,
    power: 93.76, cost: [281.28, 703.2, 1406.4]
  }),
  'AIR-Copters': Object.freeze({
    faction: 'Air', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [170, 272, 408], dps: [47.25, 73.2375, 108.675],
    range: 4.9, speed: 2.4, vision: 4.5,
    power: 103.1, cost: [309.3, 773.25, 1546.5]
  }),
  'AIR-Planes': Object.freeze({
    faction: 'Air', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [127.5, 204, 306], dps: [55.125, 85.4437, 126.787],
    range: 6.125, speed: 2.4, vision: 4,
    power: 104, cost: [312, 780, 1560]
  }),
  'AIR-Missiles': Object.freeze({
    faction: 'Air', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [85, 136, 204], dps: [70.875, 109.856, 163.012],
    range: 8.575, speed: 0.96, vision: 4,
    power: 102.05, cost: [306.15, 765.375, 1530.75]
  }),
  // Tier C set-piece (Voxel-Rendering-Tiers spec §3): the heavy bomber renders as a LIVE 3D voxel model
  // with real pitch/roll. Sparse by design — the bulk wave builder skips render_tier 'C' types, and
  // spawn + data validation hard-cap simultaneous instances at MAX_LIVE_3D. Big, slow, event-tier.
  'AIR-HeavyBomber': Object.freeze({
    faction: 'Air', shape: 'Heavy Bomber', role: 'Siege',
    domain: 'Flyer', render_tier: 'C', armorClass: 'Aircraft', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2.5,
    radarDetect: true, seesGround: true,
    hp: [1210, 1936, 2904], dps: [90, 139.5, 207],
    range: 4, speed: 0.55, vision: 6,
    power: 210, cost: [630, 1575, 3150]
  }),
  'HTC-Troops': Object.freeze({
    faction: 'High Tech', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [190, 304, 456], dps: [47.25, 73.2375, 108.675],
    range: 2.8, speed: 1.8, vision: 5.5,
    power: 99.2, cost: [297.6, 744, 1488]
  }),
  'HTC-Trucks': Object.freeze({
    faction: 'High Tech', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [237.5, 380, 570], dps: [15.75, 24.4125, 36.225],
    range: 1.4, speed: 2.88, vision: 6,
    power: 95.85, cost: [287.55, 718.875, 1437.75]
  }),
  'HTC-Tanks': Object.freeze({
    faction: 'High Tech', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [380, 608, 912], dps: [47.25, 73.2375, 108.675],
    range: 4.2, speed: 0.72, vision: 4.5,
    power: 100.3, cost: [300.9, 752.25, 1504.5]
  }),
  'HTC-Artillery': Object.freeze({
    faction: 'High Tech', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [142.5, 228, 342], dps: [63, 97.65, 144.9],
    range: 11.2, speed: 0.36, vision: 4,
    power: 105.55, cost: [316.65, 791.625, 1583.25]
  }),
  'HTC-HeavyTanks': Object.freeze({
    faction: 'High Tech', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [522.5, 836, 1254], dps: [39.375, 61.0312, 90.5625],
    range: 3.36, speed: 0.36, vision: 4.3,
    power: 99.44, cost: [298.32, 745.8, 1491.6]
  }),
  'HTC-Copters': Object.freeze({
    faction: 'High Tech', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [190, 304, 456], dps: [47.25, 73.2375, 108.675],
    range: 5.6, speed: 1.8, vision: 4.5,
    power: 100.4, cost: [301.2, 753, 1506]
  }),
  'HTC-Planes': Object.freeze({
    faction: 'High Tech', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [142.5, 228, 342], dps: [55.125, 85.4437, 126.787],
    range: 7, speed: 1.8, vision: 4,
    power: 101.5, cost: [304.5, 761.25, 1522.5]
  }),
  'HTC-Missiles': Object.freeze({
    faction: 'High Tech', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [95, 152, 228], dps: [70.875, 109.856, 163.012],
    range: 9.8, speed: 0.72, vision: 4,
    power: 104.95, cost: [314.85, 787.125, 1574.25]
  }),
  'ART-Troops': Object.freeze({
    faction: 'Artillery', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [184, 294.4, 441.6], dps: [49.5, 76.725, 113.85],
    range: 3.125, speed: 1.56, vision: 5.5,
    power: 98.4, cost: [295.2, 738, 1476]
  }),
  'ART-Trucks': Object.freeze({
    faction: 'Artillery', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [230, 368, 552], dps: [16.5, 25.575, 37.95],
    range: 1.5625, speed: 2.496, vision: 6,
    power: 91.45, cost: [274.35, 685.875, 1371.75]
  }),
  'ART-Tanks': Object.freeze({
    faction: 'Artillery', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [368, 588.8, 883.2], dps: [49.5, 76.725, 113.85],
    range: 4.6875, speed: 0.624, vision: 4.5,
    power: 101.35, cost: [304.05, 760.125, 1520.25]
  }),
  'ART-Artillery': Object.freeze({
    faction: 'Artillery', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [138, 220.8, 331.2], dps: [66, 102.3, 151.8],
    range: 12.5, speed: 0.312, vision: 4,
    power: 111.7, cost: [335.1, 837.75, 1675.5]
  }),
  'ART-HeavyTanks': Object.freeze({
    faction: 'Artillery', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [506, 809.6, 1214.4], dps: [41.25, 63.9375, 94.875],
    range: 3.75, speed: 0.312, vision: 4.3,
    power: 100, cost: [300, 750, 1500]
  }),
  'ART-Copters': Object.freeze({
    faction: 'Artillery', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Concussion',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [184, 294.4, 441.6], dps: [49.5, 76.725, 113.85],
    range: 6.25, speed: 1.56, vision: 4.5,
    power: 100.9, cost: [302.7, 756.75, 1513.5]
  }),
  'ART-Planes': Object.freeze({
    faction: 'Artillery', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [138, 220.8, 331.2], dps: [57.75, 89.5125, 132.825],
    range: 7.8125, speed: 1.56, vision: 4,
    power: 103.05, cost: [309.15, 772.875, 1545.75]
  }),
  'ART-Missiles': Object.freeze({
    faction: 'Artillery', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Concussion',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [92, 147.2, 220.8], dps: [74.25, 115.088, 170.775],
    range: 10.9375, speed: 0.624, vision: 4,
    power: 110.25, cost: [330.75, 826.875, 1653.75]
  }),
  'WTR-Troops': Object.freeze({
    faction: 'Water', shape: 'Troops', role: 'Skirmisher',
    domain: 'Swimmer', render_tier: 'A', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [224, 358.4, 537.6], dps: [42.75, 66.2625, 98.325],
    range: 2.45, speed: 1.96, vision: 5.5,
    power: 100.2, cost: [300.6, 751.5, 1503]
  }),
  'WTR-Trucks': Object.freeze({
    faction: 'Water', shape: 'Trucks', role: 'Support',
    domain: 'Floater', render_tier: 'A', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [280, 448, 672], dps: [14.25, 22.0875, 32.775],
    range: 1.225, speed: 3.136, vision: 6,
    power: 101.6, cost: [304.8, 762, 1524]
  }),
  'WTR-Tanks': Object.freeze({
    faction: 'Water', shape: 'Tanks', role: 'Bruiser',
    domain: 'Swimmer', render_tier: 'A', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [448, 716.8, 1075.2], dps: [42.75, 66.2625, 98.325],
    range: 3.675, speed: 0.784, vision: 4.5,
    power: 102.8, cost: [308.4, 771, 1542]
  }),
  'WTR-Artillery': Object.freeze({
    faction: 'Water', shape: 'Artillery', role: 'Siege',
    domain: 'Floater', render_tier: 'A', armorClass: 'Organic', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [168, 268.8, 403.2], dps: [57, 88.35, 131.1],
    range: 9.8, speed: 0.392, vision: 4,
    power: 98.9, cost: [296.7, 741.75, 1483.5]
  }),
  'WTR-HeavyTanks': Object.freeze({
    faction: 'Water', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Swimmer', render_tier: 'A', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [616, 985.6, 1478.4], dps: [35.625, 55.2188, 81.9375],
    range: 2.94, speed: 0.392, vision: 4.3,
    power: 105.01, cost: [315.03, 787.575, 1575.15]
  }),
  'WTR-Copters': Object.freeze({
    faction: 'Water', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Frost',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [224, 358.4, 537.6], dps: [42.75, 66.2625, 98.325],
    range: 4.9, speed: 1.96, vision: 4.5,
    power: 100, cost: [300, 750, 1500]
  }),
  'WTR-Planes': Object.freeze({
    faction: 'Water', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [168, 268.8, 403.2], dps: [49.875, 77.3063, 114.713],
    range: 6.125, speed: 1.96, vision: 4,
    power: 99.05, cost: [297.15, 742.875, 1485.75]
  }),
  'WTR-Missiles': Object.freeze({
    faction: 'Water', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Frost',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [112, 179.2, 268.8], dps: [64.125, 99.3937, 147.488],
    range: 8.575, speed: 0.784, vision: 4,
    power: 98.05, cost: [294.15, 735.375, 1470.75]
  }),
  'ARC-Troops': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Fire',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [200, 320, 480], dps: [48.6, 75.33, 111.78],
    range: 2.55, speed: 1.84, vision: 5.5,
    power: 100.6, cost: [301.8, 754.5, 1509]
  }),
  'ARC-Trucks': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Fire',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [250, 400, 600], dps: [16.2, 25.11, 37.26],
    range: 1.275, speed: 2.944, vision: 6,
    power: 97.7, cost: [293.1, 732.75, 1465.5]
  }),
  'ARC-Tanks': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Fire',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [400, 640, 960], dps: [48.6, 75.33, 111.78],
    range: 3.825, speed: 0.736, vision: 4.5,
    power: 101.9, cost: [305.7, 764.25, 1528.5]
  }),
  'ARC-Artillery': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [150, 240, 360], dps: [64.8, 100.44, 149.04],
    range: 10.2, speed: 0.368, vision: 4,
    power: 103.6, cost: [310.8, 777, 1554]
  }),
  'ARC-HeavyTanks': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Fire',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [550, 880, 1320], dps: [40.5, 62.775, 93.15],
    range: 3.06, speed: 0.368, vision: 4.3,
    power: 101.84, cost: [305.52, 763.8, 1527.6]
  }),
  'ARC-Copters': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Fire',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [200, 320, 480], dps: [48.6, 75.33, 111.78],
    range: 5.1, speed: 1.84, vision: 4.5,
    power: 100.8, cost: [302.4, 756, 1512]
  }),
  'ARC-Planes': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Fire',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [150, 240, 360], dps: [56.7, 87.885, 130.41],
    range: 6.375, speed: 1.84, vision: 4,
    power: 101.3, cost: [303.9, 759.75, 1519.5]
  }),
  'ARC-Missiles': Object.freeze({
    faction: 'Arcane / Energy', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Fire',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [100, 160, 240], dps: [72.9, 112.995, 167.67],
    range: 8.925, speed: 0.736, vision: 4,
    power: 103.5, cost: [310.5, 776.25, 1552.5]
  }),
  'SPC-Troops': Object.freeze({
    faction: 'Space Tech', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [192, 307.2, 460.8], dps: [44.1, 68.355, 101.43],
    range: 2.75, speed: 2, vision: 5.5,
    power: 99.6, cost: [298.8, 747, 1494]
  }),
  'SPC-Trucks': Object.freeze({
    faction: 'Space Tech', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [240, 384, 576], dps: [14.7, 22.785, 33.81],
    range: 1.375, speed: 3.2, vision: 6,
    power: 99.3, cost: [297.9, 744.75, 1489.5]
  }),
  'SPC-Tanks': Object.freeze({
    faction: 'Space Tech', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [384, 614.4, 921.6], dps: [44.1, 68.355, 101.43],
    range: 4.125, speed: 0.8, vision: 4.5,
    power: 99.3, cost: [297.9, 744.75, 1489.5]
  }),
  'SPC-Artillery': Object.freeze({
    faction: 'Space Tech', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [144, 230.4, 345.6], dps: [58.8, 91.14, 135.24],
    range: 11, speed: 0.4, vision: 4,
    power: 102.6, cost: [307.8, 769.5, 1539]
  }),
  'SPC-HeavyTanks': Object.freeze({
    faction: 'Space Tech', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Machinery', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [528, 844.8, 1267.2], dps: [36.75, 56.9625, 84.525],
    range: 3.3, speed: 0.4, vision: 4.3,
    power: 98.5, cost: [295.5, 738.75, 1477.5]
  }),
  'SPC-Copters': Object.freeze({
    faction: 'Space Tech', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [192, 307.2, 460.8], dps: [44.1, 68.355, 101.43],
    range: 5.5, speed: 2, vision: 4.5,
    power: 100.6, cost: [301.8, 754.5, 1509]
  }),
  'SPC-Planes': Object.freeze({
    faction: 'Space Tech', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [144, 230.4, 345.6], dps: [51.45, 79.7475, 118.335],
    range: 6.875, speed: 2, vision: 4,
    power: 101.2, cost: [303.6, 759, 1518]
  }),
  'SPC-Missiles': Object.freeze({
    faction: 'Space Tech', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Electric',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [96, 153.6, 230.4], dps: [66.15, 102.532, 152.145],
    range: 9.625, speed: 0.8, vision: 4,
    power: 102.2, cost: [306.6, 766.5, 1533]
  }),
  'DRK-Troops': Object.freeze({
    faction: 'Dark Energy', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [180, 288, 432], dps: [50.4, 78.12, 115.92],
    range: 2.5, speed: 2.04, vision: 5.5,
    power: 102.1, cost: [306.3, 765.75, 1531.5]
  }),
  'DRK-Trucks': Object.freeze({
    faction: 'Dark Energy', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [225, 360, 540], dps: [16.8, 26.04, 38.64],
    range: 1.25, speed: 3.264, vision: 6,
    power: 99.5, cost: [298.5, 746.25, 1492.5]
  }),
  'DRK-Tanks': Object.freeze({
    faction: 'Dark Energy', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [360, 576, 864], dps: [50.4, 78.12, 115.92],
    range: 3.75, speed: 0.816, vision: 4.5,
    power: 99.8, cost: [299.4, 748.5, 1497]
  }),
  'DRK-Artillery': Object.freeze({
    faction: 'Dark Energy', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [135, 216, 324], dps: [67.2, 104.16, 154.56],
    range: 10, speed: 0.408, vision: 4,
    power: 103.4, cost: [310.2, 775.5, 1551]
  }),
  'DRK-HeavyTanks': Object.freeze({
    faction: 'Dark Energy', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Energy', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 0,
    radarDetect: false, seesGround: false,
    hp: [495, 792, 1188], dps: [42, 65.1, 96.6],
    range: 3, speed: 0.408, vision: 4.3,
    power: 97.6, cost: [292.8, 732, 1464]
  }),
  'DRK-Copters': Object.freeze({
    faction: 'Dark Energy', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Both', targets: 'Base', aoeRadius: 0,
    radarDetect: true, seesGround: true,
    hp: [180, 288, 432], dps: [50.4, 78.12, 115.92],
    range: 5, speed: 2.04, vision: 4.5,
    power: 102.1, cost: [306.3, 765.75, 1531.5]
  }),
  'DRK-Planes': Object.freeze({
    faction: 'Dark Energy', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [135, 216, 324], dps: [58.8, 91.14, 135.24],
    range: 6.25, speed: 2.04, vision: 4,
    power: 103.2, cost: [309.6, 774, 1548]
  }),
  'DRK-Missiles': Object.freeze({
    faction: 'Dark Energy', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [90, 144, 216], dps: [75.6, 117.18, 173.88],
    range: 8.75, speed: 0.816, vision: 4,
    power: 104.6, cost: [313.8, 784.5, 1569]
  }),
  'GRN-Troops': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: false, seesGround: false,
    hp: [164, 262.4, 393.6], dps: [44.1, 68.355, 101.43],
    range: 2.375, speed: 2.1, vision: 5.5,
    power: 96.55, cost: [289.65, 724.125, 1448.25]
  }),
  'GRN-Trucks': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Trucks', role: 'Support',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: false, seesGround: false,
    hp: [205, 328, 492], dps: [14.7, 22.785, 33.81],
    range: 1.1875, speed: 3.36, vision: 6,
    power: 97.05, cost: [291.15, 727.875, 1455.75]
  }),
  'GRN-Tanks': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: false, seesGround: false,
    hp: [328, 524.8, 787.2], dps: [44.1, 68.355, 101.43],
    range: 3.5625, speed: 0.84, vision: 4.5,
    power: 91.95, cost: [275.85, 689.625, 1379.25]
  }),
  'GRN-Artillery': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', aoeRadius: 2,
    radarDetect: false, seesGround: false,
    hp: [123, 196.8, 295.2], dps: [58.8, 91.14, 135.24],
    range: 9.5, speed: 0.42, vision: 4,
    power: 94.75, cost: [284.25, 710.625, 1421.25]
  }),
  'GRN-HeavyTanks': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', render_tier: 'A', armorClass: 'Organic', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: false, seesGround: false,
    hp: [451, 721.6, 1082.4], dps: [36.75, 56.9625, 84.525],
    range: 2.85, speed: 0.42, vision: 4.3,
    power: 89.25, cost: [267.75, 669.375, 1338.75]
  }),
  'GRN-Copters': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [164, 262.4, 393.6], dps: [44.1, 68.355, 101.43],
    range: 4.75, speed: 2.1, vision: 4.5,
    power: 96.05, cost: [288.15, 720.375, 1440.75]
  }),
  'GRN-Planes': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Ground', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [123, 196.8, 295.2], dps: [51.45, 79.7475, 118.335],
    range: 5.9375, speed: 2.1, vision: 4,
    power: 96.6, cost: [289.8, 724.5, 1449]
  }),
  'GRN-Missiles': Object.freeze({
    faction: 'Greenies (Chem)', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', render_tier: 'B', armorClass: 'Aircraft', damageType: 'Poison',
    canTarget: 'Both', targets: 'Base', aoeRadius: 1,
    radarDetect: true, seesGround: true,
    hp: [82, 131.2, 196.8], dps: [66.15, 102.532, 152.145],
    range: 8.3125, speed: 0.84, vision: 4,
    power: 96.05, cost: [288.15, 720.375, 1440.75]
  }),
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
  'STR-Mine': Object.freeze({
    // MINE DRONE (Land-Mine-Design rev 2, replaces the Moat in this build slot): a drone flies from
    // the base, buries at the target cell as a red flashing dot, and the first enemy GROUND unit to
    // touch it eats ONE burst — sized to eliminate any tank in the roster (max walker: GND-HeavyTanks
    // T3 @ 1452 hp; Energy-armor heavies need 1200 effective at Kinetic ×1.1). Single use, small
    // blast. Mines are NOT structures at runtime — they live in state.mines (walkable, untargetable).
    name: 'Mine Drone', kind: 'mine',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: Object.freeze([]),
    hp: [1, 1, 1], dps: [1500, 1500, 1500],   // dps[0] = the one-shot burst
    range: 0, cost: [150, 150, 150],          // initial price — M4 tunes via gallery/balanceSim
    buildTime: 0, upgradeTime: 0, sellTime: 0,
    footprint: Object.freeze({ w: 1, h: 1 }),
    triggerRadius: 0.45, blastRadius: 0.5, droneSpeed: 6, cap: 8
  }),
  'STR-Harvestor': Object.freeze({
    // A PURCHASE, not a defense: place it on open ground and after the build time it converts into
    // a new harvester unit (harvest.js) and frees the cell — the way to recover a dead harvester or
    // run a second field. Campaign maps only (placement rejects boards with no resources).
    name: 'Harvestor', kind: 'harvestorBay',
    armorClass: 'Structure', damageType: 'None',
    canTargetDomains: Object.freeze([]),
    hp: [200, 200, 200], dps: [0, 0, 0],
    range: 0, cost: [500, 500, 500],
    buildTime: 4, upgradeTime: 0, sellTime: 1,
    footprint: Object.freeze({ w: 1, h: 1 })
  })
});

// ---------------------------------------------------------------------------
// Waves — the enemy attack schedule, GENERATED from the roster so EVERY faction
// attacks. An escalating campaign introduces each of the 9 factions in turn
// (tutorial Ground / Powder first), then a mixed-faction finale. Each spawn's
// lane follows the unit's domain (Flyer=air, Floater/Swimmer=water, else=ground).
// Fully deterministic (no RNG) so replays/scores stay reproducible.
// ---------------------------------------------------------------------------
function _laneFor(domain) {
  if (domain === 'Flyer') return 'air';
  if (domain === 'Floater' || domain === 'Swimmer') return 'water';
  return 'ground';
}
function _buildWaves(units, onlyFaction) {
  const byFaction = {};
  for (const id in units) {
    if (units[id].render_tier === 'C') continue;   // Tier C never enters the BULK wave rosters (spec §2/§5)
    const f = units[id].faction; (byFaction[f] = byFaction[f] || []).push(id);
  }

  // SINGLE-FACTION TEST: 8 escalating waves drawn only from the chosen faction (for testing that faction).
  if (onlyFaction) {
    const ids = byFaction[onlyFaction] || [];
    const waves = [];
    for (let n = 1; n <= 8 && ids.length; n++) {
      const spawns = [];
      const kinds = Math.min(ids.length, 2 + Math.floor(n / 2));
      for (let k = 0; k < kinds; k++) {
        const unitId = ids[(n + k) % ids.length];
        spawns.push(Object.freeze({
          unitId, count: 2 + Math.floor(n / 2) + k, lane: _laneFor(units[unitId].domain),
          delay: k * 1.3, interval: Math.max(0.6, 1.4 - n * 0.06),
        }));
      }
      waves.push(Object.freeze({ wave: n, faction: onlyFaction, spawns: Object.freeze(spawns) }));
    }
    return waves;
  }

  const order = ['Ground / Powder', 'Air', 'Water', 'Artillery', 'High Tech',
                 'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)'];
  const waves = [];
  order.forEach((fac, i) => {
    const ids = byFaction[fac] || [];
    if (!ids.length) return;
    const n = i + 1;
    const spawns = [];
    for (let k = 0; k < 3 && k < ids.length; k++) {
      const unitId = ids[(i + k) % ids.length];
      spawns.push(Object.freeze({
        unitId,
        count: 3 + Math.floor(n / 2) + k,
        lane: _laneFor(units[unitId].domain),
        delay: k * 1.4,
        interval: Math.max(0.6, 1.4 - n * 0.05),
      }));
    }
    waves.push(Object.freeze({ wave: n, faction: fac, spawns: Object.freeze(spawns) }));
  });
  // Finale — a mixed-faction assault: one unit from each non-tutorial faction, across all lanes.
  const finale = [];
  order.slice(1).forEach((fac, k) => {
    const ids = byFaction[fac] || [];
    if (!ids.length) return;
    const unitId = ids[k % ids.length];
    finale.push(Object.freeze({ unitId, count: 4, lane: _laneFor(units[unitId].domain), delay: (k % 4) * 1.2, interval: 0.8 }));
  });
  waves.push(Object.freeze({ wave: order.length + 1, faction: 'Combined forces', spawns: Object.freeze(finale) }));
  return waves;
}
export const WAVES = Object.freeze(_buildWaves(UNITS));

// DATA-LOAD GATE (rendering-tiers spec §5): the tier contract is enforced the moment the tables load,
// not just in CI — a Tier C type whose wave data can exceed MAX_LIVE_3D, or a unit without an explicit
// render_tier, is a data bug that must fail loudly before a frame renders.
{
  const _v = validateRenderTiers(UNITS, [WAVES]);
  if (!_v.ok) {
    for (const err of _v.errors) console.error('[renderTiers]', err);
    throw new Error('render-tier contract violated: ' + _v.errors[0]);
  }
}
// Waves for a specific faction (test mode), or the mixed campaign when faction is falsy.
export function makeWaves(faction) { return Object.freeze(_buildWaves(UNITS, faction || null)); }
// The distinct factions in the roster (for the game's faction test-picker).
export function factionsInRoster() {
  const out = [];
  for (const id in UNITS) { const f = UNITS[id].faction; if (f && out.indexOf(f) < 0) out.push(f); }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Map — the fixed slice/harness board.
//   Ground lane: row 12 left→right, then column 50 down to row 16, ending in
//   the base clearing. Water lane: river along row 22 turning north at
//   column 56 toward the clearing. Both lanes end at the base at (58,16). [s9: 64x32]
// ---------------------------------------------------------------------------
const MAP_COLS = 64;
const MAP_ROWS = 32;
const MAP_TILE = 64;   // 64px/tile (owner test 2026-07-13; was 32) — sharper board, esp. mobile

const groundLane = [
  { x: 0, y: 12 }, { x: 50, y: 12 }, { x: 50, y: 16 }, { x: 56, y: 16 }
];

const waterLane = [
  { x: 0, y: 22 }, { x: 56, y: 22 }, { x: 56, y: 17 }
];

// River: row 22 from x0..56, plus the northward channel at x56, y17..21 (ends beside the base).
const waterCells = (() => {
  const cells = [];
  for (let x = 0; x <= 56; x++) cells.push({ x, y: 22 });
  for (let y = 21; y >= 17; y--) cells.push({ x: 56, y });
  return cells;
})();

const baseDef = { x: 58, y: 16, hp: 3000, footprint: { w: 3, h: 3 } };

// s10: the base is a 3x3 keep centred on (x,y). Its four CORNERS are buildable tower hard-points; the
// five-cell plus in the middle is the base BODY (occupied — nothing can be placed there). baseDef.cells is
// the body; baseDef.cornerSlots the four corners.
const baseCornerSlots = [];
const baseBodyCells = [];
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    const c = { x: baseDef.x + dx, y: baseDef.y + dy };
    (Math.abs(dx) === 1 && Math.abs(dy) === 1 ? baseCornerSlots : baseBodyCells).push(c);
  }
}
baseDef.cells = baseBodyCells;
baseDef.cornerSlots = baseCornerSlots;

// Hard-point tower slots (fixed; count scales with base level in full game) + the base's 4 corner slots.
const slots = [
  { x: 10, y: 6 },  { x: 20, y: 6 },  { x: 30, y: 6 },  { x: 40, y: 6 },
  { x: 10, y: 14 }, { x: 20, y: 14 }, { x: 30, y: 14 }, { x: 40, y: 14 },
  { x: 46, y: 10 }, { x: 46, y: 19 }, { x: 52, y: 12 }, { x: 52, y: 20 },
  { x: 24, y: 20 }, { x: 34, y: 20 }, { x: 16, y: 24 }, { x: 30, y: 24 },
  ...baseCornerSlots
];

// Buildable region for walls / moats: the central band around the ground
// lane, excluding water, the base body, and hard-point slots.
const buildableCells = (() => {
  const isWater = (x, y) => waterCells.some(c => c.x === x && c.y === y);
  const isSlot = (x, y) => slots.some(s => s.x === x && s.y === y);
  const isBaseBody = (x, y) => baseBodyCells.some(c => c.x === x && c.y === y);
  const cells = [];
  for (let y = 5; y <= 26; y++) {
    for (let x = 3; x <= 55; x++) {
      if (isWater(x, y)) continue;
      if (isSlot(x, y)) continue;
      if (isBaseBody(x, y)) continue;
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
  spawnGround: { x: 0, y: 12 },
  spawnWater: { x: 0, y: 22 },
  spawnAir: { x: 0, y: 3 },
  base: baseDef,
  slots,
  buildableCells
});

// ---------------------------------------------------------------------------
// Lookups (throw on missing — a bad id is always a programming error)
// ---------------------------------------------------------------------------
// SYSTEM units — authorable in the State Bench like any faction, but NEVER part of the enemy
// roster/waves/balance (they live outside UNITS): the player's Harvester + the four structures.
// Author their art in the tool under faction "System"; the game consumes it via artKey (harvester)
// and structId mapping (structures).
export const SYSTEM_UNITS = Object.freeze({
  'SYS-Harvester': Object.freeze({
    name: 'Harvester', kind: 'harvester', faction: 'System', domain: 'Walker', render_tier: 'A', role: 'Harvester',
    armorClass: 'Vehicle', damageType: 'None', targets: 'None',
    hp: [120, 120, 120], dps: [0, 0, 0], range: 0.5, speed: 3, power: 0, cost: [500, 500, 500]
  }),
  'SYS-Base': Object.freeze({
    // the 3x3 BASE SHIP — author its art as one square image (it renders across the full 3x3
    // footprint in-game; the keep outline + HP bar + super-cannon turret stay on top)
    name: 'Base Ship', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Base Ship',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [3000, 3000, 3000], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  // TIER ART SLOTS — author how each defense LOOKS at upgrade tiers 2/3 (stats live in STRUCTURES)
  'SYS-Cannon-2': Object.freeze({
    name: 'Cannon Tower (Tier 2)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Cannon Tower T2',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Cannon-3': Object.freeze({
    name: 'Cannon Tower (Tier 3)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Cannon Tower T3',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Flak-2': Object.freeze({
    name: 'Flak Tower (Tier 2)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Flak Tower T2',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Flak-3': Object.freeze({
    name: 'Flak Tower (Tier 3)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Flak Tower T3',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Wall-2': Object.freeze({
    name: 'Wall (Tier 2)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Wall T2',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Wall-3': Object.freeze({
    name: 'Wall (Tier 3)', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Wall T3',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [0, 0, 0]
  }),
  'SYS-Cannon': Object.freeze({
    name: 'Cannon Tower', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Cannon Tower',
    armorClass: 'Structure', damageType: 'Kinetic', targets: 'Ground',
    hp: [400, 640, 960], dps: [45, 70, 104], range: 4.5, speed: 0, power: 0, cost: [300, 750, 1500]
  }),
  'SYS-Flak': Object.freeze({
    name: 'Flak Tower', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Flak Tower',
    armorClass: 'Structure', damageType: 'Kinetic', targets: 'Air',
    hp: [360, 576, 864], dps: [40, 62, 92], range: 5.5, speed: 0, power: 0, cost: [300, 750, 1500]
  }),
  'SYS-Wall': Object.freeze({
    name: 'Wall', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Wall',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [600, 960, 1440], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [60, 150, 300]
  }),
  'SYS-Moat': Object.freeze({
    name: 'Moat', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Moat',
    armorClass: 'Structure', damageType: 'None', targets: 'None',
    hp: [400, 640, 960], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [80, 200, 400]
  }),
  'SYS-Mine': Object.freeze({
    // art hook for the Mine Drone (STR-Mine): authored/voxel art may land here later; the game
    // renders a primitive red dot until it does.
    name: 'Mine Drone', kind: 'structure', faction: 'System', domain: 'Structure', render_tier: 'A', role: 'Mine',
    armorClass: 'Structure', damageType: 'Kinetic', targets: 'None',
    hp: [1, 1, 1], dps: [0, 0, 0], range: 0, speed: 0, power: 0, cost: [150, 150, 150]
  }),
});

// ---------------------------------------------------------------------------
// FX scale tiers (owner 2026-07-22): battle EFFECTS — explosions, fire clumps,
// wreck flames, glows, smoke — read bigger on the early maps. PROJECTILES are
// deliberately excluded (renderer fire() ignores this; owner: "not too much
// sizing on projectiles"), and gameplay-derived radii (super-cannon blast,
// aim reticle) stay 1:1 so visuals never lie about damage footprints.
// The map-5 boundary is an owner-review knob (tickets mm-37d6e930c3c2/…5566).
// ---------------------------------------------------------------------------
// OWNER LIVE VERDICT (2026-07-22, map 1): with the 3x tier the explosions read "10x too big" —
// the tier STACKED on the growth camera's ~2.6x wave-1 zoom (see updateCamera). Tiers are OFF
// (empty = 1x everywhere); the open fix is zoom-NORMALIZATION (divide by cam.s), not multipliers.
export const FX_SCALE_TIERS = Object.freeze([]);
// PROJECTILE tiers run the OTHER way (owner: "level 1 is at least 2x too big"): the SHOT_SIZE
// constants carry a 2026-07-16 phone-visibility bump (flak 4x, shells 2x) that oversizes shots on
// the zoomed early maps. Numbers at tile 64 before damping: shell dot ≈22.5px + 68px streak,
// flak ≈31px + 92px, tracer ≈7.7px. Damping halves maps 1-3.
export const PROJ_SCALE_TIERS = Object.freeze([
  Object.freeze({ maxMap: 3, scale: 0.5 }),
  Object.freeze({ maxMap: 5, scale: 0.75 }),
]);
function tierLookup(tiers, mapId) {
  const id = Number(mapId);
  if (!Number.isFinite(id) || id <= 0) return 1;   // classic/unknown boards → neutral
  for (let i = 0; i < tiers.length; i++) {
    if (id <= tiers[i].maxMap) return tiers[i].scale;
  }
  return 1;
}
export function fxScaleForMap(mapId) { return tierLookup(FX_SCALE_TIERS, mapId); }
export function projScaleForMap(mapId) { return tierLookup(PROJ_SCALE_TIERS, mapId); }

// ---------------------------------------------------------------------------
// WAVE BONUSES (Wave-Bonuses-Design rev 1): pick 1 of 3 at each wave end. Pure
// data — the sim reads these, never a literal. `kind` drives applyBonus():
//   dmgMod (persistent, additive) · heal (structures by kind, instant to full)
//   healBase (+mag of max) · harvMod (persistent) · healHarv · mineCredit
//   cannonMod (persistent) · unlockTier (raise the tier cap for a group)
// PRE-NERFS ship WITH the feature so these bonuses have room to matter.
// ---------------------------------------------------------------------------
export const BONUS_NERFS = Object.freeze({
  harvesterSpeedMult: 0.65,     // starting harvester speed −35% (bonus 8 buys back)
  baseCannonRangeMult: 0.70,    // base super-cannon range −30% (bonus 13)
  baseCannonPowerMult: 0.50,    // base super-cannon damage −50% (bonus 14)
  startTierCap: 2,              // turrets AND walls start capped at T2 (bonuses 15/16 unlock T3)
});
export const BONUSES = Object.freeze([
  Object.freeze({ id: 'dmg_air',      label: '+10% damage vs air',      kind: 'dmgMod',    target: 'air',    mag: 0.10 }),
  Object.freeze({ id: 'dmg_ground',   label: '+10% damage vs ground',   kind: 'dmgMod',    target: 'ground', mag: 0.10 }),
  Object.freeze({ id: 'dmg_troops',   label: '+10% damage vs troops',   kind: 'dmgMod',    target: 'troops', mag: 0.10 }),
  Object.freeze({ id: 'heal_walls',   label: 'Heal all walls',          kind: 'heal',      target: 'wall' }),
  Object.freeze({ id: 'heal_cannons', label: 'Heal all cannons',        kind: 'heal',      target: 'antiGround' }),
  Object.freeze({ id: 'heal_base',    label: 'Heal base 10%',           kind: 'healBase',  mag: 0.10 }),
  Object.freeze({ id: 'heal_aa',      label: 'Heal all anti-air',       kind: 'heal',      target: 'antiAir' }),
  Object.freeze({ id: 'harv_speed',   label: '+20% harvester speed',    kind: 'harvMod',   field: 'speed',    mag: 0.20 }),
  Object.freeze({ id: 'harv_cap',     label: '+20% harvester capacity', kind: 'harvMod',   field: 'capacity', mag: 0.20 }),
  Object.freeze({ id: 'harv_hp',      label: '+20% harvester hp',       kind: 'harvMod',   field: 'hp',       mag: 0.20 }),
  Object.freeze({ id: 'heal_harv',    label: 'Heal all harvesters',     kind: 'healHarv' }),
  Object.freeze({ id: 'mine_drones',  label: 'Add mine-layer drones',   kind: 'mineCredit', mag: 3 }),
  Object.freeze({ id: 'cannon_range', label: 'Base cannon +10% range',  kind: 'cannonMod', field: 'range',  mag: 0.10 }),
  Object.freeze({ id: 'cannon_dmg',   label: 'Base cannon +10% damage', kind: 'cannonMod', field: 'damage', mag: 0.10 }),
  Object.freeze({ id: 'tier3_turret', label: 'Enable Tier-3 turrets',   kind: 'unlockTier', groups: Object.freeze(['cannon', 'flak']) }),
  Object.freeze({ id: 'tier3_wall',   label: 'Enable Tier-3 walls',     kind: 'unlockTier', groups: Object.freeze(['wall']) }),
]);
export function getBonusDef(id) { return BONUSES.find((b) => b.id === id) || null; }

export function getUnitDef(unitId) {
  const def = UNITS[unitId] || SYSTEM_UNITS[unitId];
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
