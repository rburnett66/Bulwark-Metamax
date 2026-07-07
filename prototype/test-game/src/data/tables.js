/**
 * BULWARK — Balance Data Tables (transcribed from bulwark-balance workbook)
 *
 * Canonical, data-driven stat source. No balance is hardcoded anywhere else in
 * the codebase — sim/entities.js, sim/waves.js, sim/economy.js, and the
 * balance harness all read exclusively from these tables.
 *
 * Sheets transcribed:
 *   Assumptions, Factions, Archetypes, Faction_Mods, DamageTypes,
 *   Effectiveness, Units (Ground/Powder vertical-slice roster),
 *   Structures (anti-ground tower, anti-air tower, wall/moat),
 *   Waves (vertical-slice wave definitions), Board (fixed harness geometry).
 */

// ---------------------------------------------------------------------------
// Sheet: Assumptions — global tuning constants
// ---------------------------------------------------------------------------
export const Assumptions = {
  HP_per_point: 10,            // 1 HP budget point = 10 hit points
  DPS_per_point: 1.5,          // 1 DPS point = 1.5 damage/sec (raw, pre-type)
  Range_per_point: 0.25,       // 1 range point = 0.25 tiles
  Speed_per_point: 0.08,       // 1 speed point = 0.08 tiles/sec
  Vision_base: 4,              // baseline vision in tiles
  Vision_per_util_point: 0.1,  // each utility point adds 0.1 tiles vision
  Cost_per_power_gold: 3,      // gold cost = power x this
  Upgrade_HP_x_T2: 1.6,
  Upgrade_HP_x_T3: 2.4,
  Upgrade_DPS_x_T2: 1.55,
  Upgrade_DPS_x_T3: 2.3,
  Upgrade_Cost_x_T2: 2.5,      // cumulative unit value at tier 2
  Upgrade_Cost_x_T3: 5,        // cumulative unit value at tier 3

  // Economy / lifecycle constants (workbook GDD-derived tuning inputs)
  Starting_money: 900,
  Income_per_second: 12,       // real-time money accrual
  Kill_income_fraction: 0.5,   // income on kill = unit cost * this
  Sell_refund_fraction: 0.5,   // partial refund fraction of invested value
  Build_time_per_100_gold: 2,  // build seconds per 100 gold of cost
  Upgrade_time_seconds: 4,     // one-tier upgrade duration
  Repair_hp_per_second: 40,    // repair rate once troop arrives (repairs free)
  Repair_troop_speed: 2.0,     // tiles/sec travel of repair troop
  Base_HP: 2000,
  Base_slots_per_level: 6,     // hard-point slot count scales with base level
  Base_level: 1,
  Deploy_troop_cost_fraction: 1.0, // deploy cost = unit T1 cost * fraction
};

// ---------------------------------------------------------------------------
// Sheet: Factions
// ---------------------------------------------------------------------------
export const Factions = [
  { id: 1, name: 'Ground / Powder', trope: 'Nationalistic', beats: 'Greenies (Chem)', signatureDamage: 'Kinetic', identity: 'Infantry & armor; flags & honor' },
  { id: 2, name: 'Air', trope: 'Manga (ace pilots)', beats: 'Ground / Powder', signatureDamage: 'Kinetic', identity: 'Air superiority; weak on the ground' },
  { id: 3, name: 'High Tech', trope: 'Capitalist (mega-corp)', beats: 'Air', signatureDamage: 'Electric', identity: 'Precision, shields, expensive' },
  { id: 4, name: 'Artillery', trope: 'Military (siege)', beats: 'High Tech', signatureDamage: 'Concussion', identity: 'Range & arc; poor up close' },
  { id: 5, name: 'Water', trope: 'Fantasy RPG (sea tribes)', beats: 'Artillery', signatureDamage: 'Frost', identity: 'Swimmers/floaters; coastal' },
  { id: 6, name: 'Arcane / Energy', trope: 'Fantasy theocracy / religion', beats: 'Water', signatureDamage: 'Fire', identity: 'Energy weapons, shields, no ammo economy' },
  { id: 7, name: 'Space Tech', trope: 'Sci-Fi (federation)', beats: 'Arcane / Energy', signatureDamage: 'Electric', identity: 'Orbital tech; strong vision; ignores some fog' },
  { id: 8, name: 'Dark Energy', trope: 'Social realignment (cult)', beats: 'Space Tech', signatureDamage: 'Poison', identity: 'DoT, corruption, night-strong' },
  { id: 9, name: 'Greenies (Chem)', trope: 'Socialist (hive collective)', beats: 'Dark Energy', signatureDamage: 'Poison', identity: 'Swarms, chem clouds, area denial' },
];

// ---------------------------------------------------------------------------
// Sheet: Archetypes — 8 unit shapes and their 100-pt power budgets
// ---------------------------------------------------------------------------
export const Archetypes = [
  { shape: 'Troops',      role: 'Skirmisher', domain: 'Walker', canTarget: 'Ground', targets: 'Base',       HP_pts: 20, DPS_pts: 30, Range_pts: 10, Speed_pts: 25, Util_pts: 15, Total_pts: 100, Base_HP: 200, Base_DPS: 45,   Base_Range: 2.5,  Base_Speed: 2,   Base_Vision: 5.5 },
  { shape: 'Trucks',      role: 'Support',    domain: 'Walker', canTarget: 'Ground', targets: 'Base',       HP_pts: 25, DPS_pts: 10, Range_pts: 5,  Speed_pts: 40, Util_pts: 20, Total_pts: 100, Base_HP: 250, Base_DPS: 15,   Base_Range: 1.25, Base_Speed: 3.2, Base_Vision: 6 },
  { shape: 'Tanks',       role: 'Bruiser',    domain: 'Walker', canTarget: 'Ground', targets: 'Base',       HP_pts: 40, DPS_pts: 30, Range_pts: 15, Speed_pts: 10, Util_pts: 5,  Total_pts: 100, Base_HP: 400, Base_DPS: 45,   Base_Range: 3.75, Base_Speed: 0.8, Base_Vision: 4.5 },
  { shape: 'Artillery',   role: 'Siege',      domain: 'Walker', canTarget: 'Ground', targets: 'Structures', HP_pts: 15, DPS_pts: 40, Range_pts: 40, Speed_pts: 5,  Util_pts: 0,  Total_pts: 100, Base_HP: 150, Base_DPS: 60,   Base_Range: 10,   Base_Speed: 0.4, Base_Vision: 4 },
  { shape: 'Heavy Tanks', role: 'Juggernaut', domain: 'Walker', canTarget: 'Ground', targets: 'Base',       HP_pts: 55, DPS_pts: 25, Range_pts: 12, Speed_pts: 5,  Util_pts: 3,  Total_pts: 100, Base_HP: 550, Base_DPS: 37.5, Base_Range: 3,    Base_Speed: 0.4, Base_Vision: 4.3 },
  { shape: 'Copters',     role: 'Harasser',   domain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       HP_pts: 20, DPS_pts: 30, Range_pts: 20, Speed_pts: 25, Util_pts: 5,  Total_pts: 100, Base_HP: 200, Base_DPS: 45,   Base_Range: 5,    Base_Speed: 2,   Base_Vision: 4.5 },
  { shape: 'Planes',      role: 'Striker',    domain: 'Flyer',  canTarget: 'Ground', targets: 'Base',       HP_pts: 15, DPS_pts: 35, Range_pts: 25, Speed_pts: 25, Util_pts: 0,  Total_pts: 100, Base_HP: 150, Base_DPS: 52.5, Base_Range: 6.25, Base_Speed: 2,   Base_Vision: 4 },
  { shape: 'Missiles',    role: 'Guided AA',  domain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       HP_pts: 10, DPS_pts: 45, Range_pts: 35, Speed_pts: 10, Util_pts: 0,  Total_pts: 100, Base_HP: 100, Base_DPS: 67.5, Base_Range: 8.75, Base_Speed: 0.8, Base_Vision: 4 },
];

// ---------------------------------------------------------------------------
// Sheet: Faction_Mods — per-faction stat tilts (net-neutral, avg ~1.00)
// ---------------------------------------------------------------------------
export const FactionMods = [
  { faction: 'Ground / Powder', HP_x: 1.1,  DPS_x: 1,    Range_x: 1,    Speed_x: 0.92, signatureDamage: 'Kinetic',    armorTheme: 'Machinery', domainTheme: 'Ground',       Avg_x: 1.005,  notes: 'Tanky, deliberate' },
  { faction: 'Air',             HP_x: 0.85, DPS_x: 1.05, Range_x: 0.98, Speed_x: 1.2,  signatureDamage: 'Kinetic',    armorTheme: 'Aircraft',  domainTheme: 'Air',          Avg_x: 1.02,   notes: 'Fast, fragile' },
  { faction: 'High Tech',       HP_x: 0.95, DPS_x: 1.05, Range_x: 1.12, Speed_x: 0.9,  signatureDamage: 'Electric',   armorTheme: 'Machinery', domainTheme: 'Ground',       Avg_x: 1.005,  notes: 'Long-range, precise' },
  { faction: 'Artillery',       HP_x: 0.92, DPS_x: 1.1,  Range_x: 1.25, Speed_x: 0.78, signatureDamage: 'Concussion', armorTheme: 'Machinery', domainTheme: 'Ground',       Avg_x: 1.0125, notes: 'Siege reach, slow' },
  { faction: 'Water',           HP_x: 1.12, DPS_x: 0.95, Range_x: 0.98, Speed_x: 0.98, signatureDamage: 'Frost',      armorTheme: 'Organic',   domainTheme: 'Water',        Avg_x: 1.0075, notes: 'Durable sea life' },
  { faction: 'Arcane / Energy', HP_x: 1,    DPS_x: 1.08, Range_x: 1.02, Speed_x: 0.92, signatureDamage: 'Fire',       armorTheme: 'Energy',    domainTheme: 'Ground',       Avg_x: 1.005,  notes: 'Shielded casters' },
  { faction: 'Space Tech',      HP_x: 0.96, DPS_x: 0.98, Range_x: 1.1,  Speed_x: 1,    signatureDamage: 'Electric',   armorTheme: 'Machinery', domainTheme: 'Ground / Air', Avg_x: 1.01,   notes: 'High vision & range' },
  { faction: 'Dark Energy',     HP_x: 0.9,  DPS_x: 1.12, Range_x: 1,    Speed_x: 1.02, signatureDamage: 'Poison',     armorTheme: 'Energy',    domainTheme: 'Ground',       Avg_x: 1.01,   notes: 'Corrosive DoT' },
  { faction: 'Greenies (Chem)', HP_x: 0.82, DPS_x: 0.98, Range_x: 0.95, Speed_x: 1.05, signatureDamage: 'Poison',     armorTheme: 'Organic',   domainTheme: 'Ground',       Avg_x: 0.95,   notes: 'Swarm; cheap, many' },
];

// ---------------------------------------------------------------------------
// Sheet: DamageTypes — 6 damage types and their status effects
// ---------------------------------------------------------------------------
export const DamageTypes = [
  { type: 'Kinetic',    status: null,       dot: false, slow: false, chainOrSplash: false, note: 'Baseline physical; even vs everything.' },
  { type: 'Fire',       status: 'Burn',     dot: true,  slow: false, chainOrSplash: false, note: 'Damage-over-time; strong vs organics & structures.' },
  { type: 'Poison',     status: 'Toxin',    dot: true,  slow: false, chainOrSplash: false, note: 'Heavy DoT vs organics; machines/energy immune.' },
  { type: 'Concussion', status: 'Stagger',  dot: false, slow: false, chainOrSplash: false, note: 'Hurts machinery, not troops; brief machine stagger.' },
  { type: 'Electric',   status: 'Overload', dot: false, slow: false, chainOrSplash: true,  note: 'Wrecks machinery; chains to nearby; disables machines.' },
  { type: 'Frost',      status: 'Chill',    dot: false, slow: true,  chainOrSplash: false, note: 'Slows ALL except air units; modest direct damage.' },
];

// ---------------------------------------------------------------------------
// Sheet: Effectiveness — damage type x armor class multiplier matrix
// Frost deals its listed damage to Aircraft but applies NO slow to air.
// ---------------------------------------------------------------------------
export const Effectiveness = {
  Kinetic:    { Organic: 1,   Machinery: 1,   Aircraft: 1,   Structure: 1,   Energy: 1.1 },
  Fire:       { Organic: 1.3, Machinery: 0.8, Aircraft: 0.8, Structure: 1.1, Energy: 0.8 },
  Poison:     { Organic: 1.8, Machinery: 0.1, Aircraft: 0.1, Structure: 0,   Energy: 0 },
  Concussion: { Organic: 0.4, Machinery: 1.7, Aircraft: 0.9, Structure: 1,   Energy: 0.4 },
  Electric:   { Organic: 0.5, Machinery: 1.8, Aircraft: 1.2, Structure: 0.5, Energy: 0.6 },
  Frost:      { Organic: 0.6, Machinery: 0.6, Aircraft: 0.5, Structure: 0.5, Energy: 0.9 },
};

export function effectivenessMultiplier(damageType, armorClass) {
  const row = Effectiveness[damageType];
  if (!row) return 1;
  const m = row[armorClass];
  return (m === undefined || m === null) ? 1 : m;
}

// ---------------------------------------------------------------------------
// Sheet: Units — Ground/Powder vertical-slice roster (tutorial faction),
// plus the vertical-slice Floater/Swimmer for the water lane.
//
// domain: 'Walker' | 'Floater' | 'Flyer'
// canTarget: which weapon domains this unit can hit
// targets: 'Base' (ignore structures) | 'Structures' (flagged to attack structures)
// ---------------------------------------------------------------------------
export const Units = [
  {
    id: 'GND-Troops', faction: 'Ground / Powder', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: null, radarDetect: false, seesGround: false,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 2.5, speed: 1.84, vision: 5.5,
    power: 100, cost: [300, 750, 1500],
    effDPS: { Organic: 45, Machinery: 45, Aircraft: 0 },
    deployable: true,
  },
  {
    id: 'GND-Trucks', faction: 'Ground / Powder', shape: 'Trucks', role: 'Support',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: null, radarDetect: false, seesGround: false,
    hp: [275, 440, 660], dps: [15, 23.25, 34.5],
    range: 1.25, speed: 2.944, vision: 6,
    power: 99.3, cost: [297.9, 744.75, 1489.5],
    effDPS: { Organic: 15, Machinery: 15, Aircraft: 0 },
    deployable: false,
  },
  {
    id: 'GND-Tanks', faction: 'Ground / Powder', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: null, radarDetect: false, seesGround: false,
    hp: [440, 704, 1056], dps: [45, 69.75, 103.5],
    range: 3.75, speed: 0.736, vision: 4.5,
    power: 103.2, cost: [309.6, 774, 1548],
    effDPS: { Organic: 45, Machinery: 45, Aircraft: 0 },
    deployable: false,
  },
  {
    id: 'GND-Artillery', faction: 'Ground / Powder', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', targetsBase: false, targetsStructures: true,
    aoeRadius: 2, status: 'Stagger', radarDetect: false, seesGround: false,
    hp: [165, 264, 396], dps: [60, 93, 138],
    range: 10, speed: 0.368, vision: 4,
    power: 101.1, cost: [303.3, 758.25, 1516.5],
    effDPS: { Organic: 24, Machinery: 102, Aircraft: 0 },
    deployable: false,
  },
  {
    id: 'GND-HeavyTanks', faction: 'Ground / Powder', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: null, radarDetect: false, seesGround: false,
    hp: [605, 968, 1452], dps: [37.5, 58.125, 86.25],
    range: 3, speed: 0.368, vision: 4.3,
    power: 105.1, cost: [315.3, 788.25, 1576.5],
    effDPS: { Organic: 37.5, Machinery: 37.5, Aircraft: 0 },
    deployable: false,
  },
  {
    id: 'GND-Copters', faction: 'Ground / Powder', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: null, radarDetect: true, seesGround: true,
    hp: [220, 352, 528], dps: [45, 69.75, 103.5],
    range: 5, speed: 1.84, vision: 4.5,
    power: 100, cost: [300, 750, 1500],
    effDPS: { Organic: 45, Machinery: 45, Aircraft: 45 },
    deployable: false,
  },
  {
    id: 'GND-Planes', faction: 'Ground / Powder', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 1, status: null, radarDetect: true, seesGround: true,
    hp: [165, 264, 396], dps: [52.5, 81.375, 120.75],
    range: 6.25, speed: 1.84, vision: 4,
    power: 99.5, cost: [298.5, 746.25, 1492.5],
    effDPS: { Organic: 52.5, Machinery: 52.5, Aircraft: 0 },
    deployable: false,
  },
  {
    id: 'GND-Missiles', faction: 'Ground / Powder', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 1, status: null, radarDetect: true, seesGround: true,
    hp: [110, 176, 264], dps: [67.5, 104.625, 155.25],
    range: 8.75, speed: 0.736, vision: 4,
    power: 100.2, cost: [300.6, 751.5, 1503],
    effDPS: { Organic: 67.5, Machinery: 67.5, Aircraft: 67.5 },
    deployable: false,
  },
  // Vertical-slice water-lane unit (Water faction Floater/Swimmer, Faction_Mods applied:
  // HP 1.12x, DPS 0.95x, Range 0.98x, Speed 0.98x on the Tanks archetype budget).
  {
    id: 'WTR-Floater', faction: 'Water', shape: 'Tanks', role: 'Floater',
    domain: 'Floater', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: 'Chill', radarDetect: false, seesGround: false,
    hp: [448, 716.8, 1075.2], dps: [42.75, 66.2625, 98.325],
    range: 3.675, speed: 0.784, vision: 4.5,
    power: 100.75, cost: [302.25, 755.625, 1511.25],
    effDPS: { Organic: 25.65, Machinery: 25.65, Aircraft: 21.375 },
    deployable: false,
  },
  // Fast light swimmer variant for wave texture (Water Troops archetype, mods applied).
  {
    id: 'WTR-Swimmer', faction: 'Water', shape: 'Troops', role: 'Swimmer',
    domain: 'Floater', armorClass: 'Organic', damageType: 'Frost',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: 'Chill', radarDetect: false, seesGround: false,
    hp: [224, 358.4, 537.6], dps: [42.75, 66.2625, 98.325],
    range: 2.45, speed: 1.96, vision: 5.5,
    power: 100.75, cost: [302.25, 755.625, 1511.25],
    effDPS: { Organic: 25.65, Machinery: 25.65, Aircraft: 21.375 },
    deployable: false,
  },
];

export function getUnit(id) {
  for (let i = 0; i < Units.length; i++) {
    if (Units[i].id === id) return Units[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sheet: Structures — vertical-slice defensive emplacements
// (anti-ground tower, anti-air tower, wall, moat)
//
// canTargetDomains: which unit domains the structure weapon may hit.
// Anti-ground CANNOT hit air. Anti-air CAN hit air (and floaters via radar).
// hp/dps/cost arrays are T1..T3 (Upgrade_x factors from Assumptions applied).
// buildTime derived: cost[0] / 100 * Build_time_per_100_gold.
// ---------------------------------------------------------------------------
export const Structures = [
  {
    id: 'STR-AntiGround', name: 'Anti-Ground Tower', kind: 'tower',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: ['Walker', 'Floater'],
    canTargetAir: false, radar: false,
    aoeRadius: 0, status: null,
    footprint: { w: 1, h: 1 },
    hp: [400, 640, 960],
    dps: [40, 62, 92],
    range: [4.5, 5, 5.5],
    fireCooldown: 0.8,          // seconds between shots (damage per shot = dps * cooldown)
    projectileSpeed: 10,        // tiles/sec (ballistic)
    cost: [250, 625, 1250],     // cumulative value T1..T3 (Upgrade_Cost_x)
    buildTime: 5,               // seconds
    upgradeTime: 4,
    sellRefundFraction: 0.5,
    blocksWalkers: false,
    slotOnly: true,             // must be placed on a base hard-point slot
    tiers: 3,
  },
  {
    id: 'STR-AntiAir', name: 'Anti-Air Tower', kind: 'tower',
    armorClass: 'Structure', damageType: 'Kinetic',
    canTargetDomains: ['Flyer'],
    canTargetAir: true, radar: true, // radar detects air, not ground
    aoeRadius: 0, status: null,
    footprint: { w: 1, h: 1 },
    hp: [320, 512, 768],
    dps: [55, 85.25, 126.5],
    range: [6, 6.5, 7],
    fireCooldown: 0.6,
    projectileSpeed: 14,        // guided missile
    cost: [280, 700, 1400],
    buildTime: 5.6,
    upgradeTime: 4,
    sellRefundFraction: 0.5,
    blocksWalkers: false,
    slotOnly: true,
    tiers: 3,
  },
  {
    id: 'STR-Wall', name: 'Wall', kind: 'wall',
    armorClass: 'Structure', damageType: null,
    canTargetDomains: [],
    canTargetAir: false, radar: false,
    aoeRadius: 0, status: null,
    footprint: { w: 1, h: 1 },
    hp: [600, 960, 1440],
    dps: [0, 0, 0],
    range: [0, 0, 0],
    fireCooldown: 0,
    projectileSpeed: 0,
    cost: [60, 150, 300],
    buildTime: 1.2,
    upgradeTime: 2,
    sellRefundFraction: 0.5,
    blocksWalkers: true,        // terrain piece — reroutes walker paths
    slotOnly: false,            // free placement on ground lane tiles
    tiers: 3,
  },
  {
    id: 'STR-Moat', name: 'Moat', kind: 'moat',
    armorClass: 'Structure', damageType: null,
    canTargetDomains: [],
    canTargetAir: false, radar: false,
    aoeRadius: 0, status: null,
    footprint: { w: 1, h: 1 },
    hp: [300, 480, 720],
    dps: [0, 0, 0],
    range: [0, 0, 0],
    fireCooldown: 0,
    projectileSpeed: 0,
    cost: [45, 112.5, 225],
    buildTime: 0.9,
    upgradeTime: 2,
    sellRefundFraction: 0.5,
    blocksWalkers: true,        // moats block walkers (does not block floaters/flyers)
    slotOnly: false,
    tiers: 3,
  },
];

export function getStructure(id) {
  for (let i = 0; i < Structures.length; i++) {
    if (Structures[i].id === id) return Structures[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Structure lifecycle states (canonical enum used by sim/structures.js)
// ---------------------------------------------------------------------------
export const StructureStates = {
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling',
  DESTROYED: 'Destroyed',
};

// ---------------------------------------------------------------------------
// Board geometry — fixed harness board (same geometry game + balance sim)
// One ground lane beside one water lane, both ending at the base clearing.
// ---------------------------------------------------------------------------
export const Board = {
  cols: 24,
  rows: 12,
  tileSize: 48,                 // render pixels per tile (view hint only)
  groundLane: { rowStart: 1, rowEnd: 7 },   // rows [1..7] inclusive = ground
  waterLane: { rowStart: 8, rowEnd: 10 },   // rows [8..10] inclusive = water
  spawnCol: 0,                  // attackers spawn at left edge
  base: { col: 21, row: 4, w: 2, h: 2 },    // base clearing in ground lane
  clearing: { colStart: 19, colEnd: 23, rowStart: 1, rowEnd: 10 },
  flyerAltitude: 1,             // abstract altitude units for flyers
  // Fixed hard-point slots; count exposed scales with base level:
  // available slots = Assumptions.Base_slots_per_level * base level.
  slots: [
    { col: 18, row: 2 },
    { col: 18, row: 5 },
    { col: 18, row: 8 },
    { col: 20, row: 1 },
    { col: 20, row: 7 },
    { col: 22, row: 7 },
    { col: 16, row: 2 },
    { col: 16, row: 5 },
    { col: 16, row: 8 },
    { col: 22, row: 1 },
    { col: 14, row: 3 },
    { col: 14, row: 7 },
  ],
};

export function activeSlotCount(baseLevel) {
  const lvl = baseLevel || Assumptions.Base_level;
  return Math.min(Board.slots.length, Assumptions.Base_slots_per_level * lvl);
}

// ---------------------------------------------------------------------------
// Wave definitions — vertical-slice benchmark: survive all waves = win.
// Each spawn: unitId, count, lane ('ground'|'water'|'air'), tier (1-based),
// delay (seconds after wave start), interval (seconds between spawned units).
// ---------------------------------------------------------------------------
export const Waves = [
  {
    id: 1, name: 'Probe',
    spawns: [
      { unitId: 'GND-Troops', count: 4, lane: 'ground', tier: 1, delay: 0, interval: 1.5 },
    ],
  },
  {
    id: 2, name: 'Skirmish',
    spawns: [
      { unitId: 'GND-Troops', count: 5, lane: 'ground', tier: 1, delay: 0, interval: 1.2 },
      { unitId: 'GND-Trucks', count: 2, lane: 'ground', tier: 1, delay: 3, interval: 2 },
    ],
  },
  {
    id: 3, name: 'Tide',
    spawns: [
      { unitId: 'WTR-Swimmer', count: 4, lane: 'water', tier: 1, delay: 0, interval: 1.5 },
      { unitId: 'GND-Troops', count: 4, lane: 'ground', tier: 1, delay: 2, interval: 1.5 },
    ],
  },
  {
    id: 4, name: 'Overwatch',
    spawns: [
      { unitId: 'GND-Copters', count: 3, lane: 'air', tier: 1, delay: 0, interval: 2 },
      { unitId: 'GND-Troops', count: 4, lane: 'ground', tier: 1, delay: 1, interval: 1.5 },
    ],
  },
  {
    id: 5, name: 'Armor Push',
    spawns: [
      { unitId: 'GND-Tanks', count: 3, lane: 'ground', tier: 1, delay: 0, interval: 2.5 },
      { unitId: 'GND-Troops', count: 5, lane: 'ground', tier: 1, delay: 2, interval: 1 },
      { unitId: 'WTR-Floater', count: 2, lane: 'water', tier: 1, delay: 4, interval: 3 },
    ],
  },
  {
    id: 6, name: 'Siege Line',
    spawns: [
      { unitId: 'GND-Artillery', count: 2, lane: 'ground', tier: 1, delay: 0, interval: 4 },
      { unitId: 'GND-Tanks', count: 2, lane: 'ground', tier: 1, delay: 2, interval: 2.5 },
      { unitId: 'GND-Copters', count: 2, lane: 'air', tier: 1, delay: 3, interval: 2 },
    ],
  },
  {
    id: 7, name: 'Air Raid',
    spawns: [
      { unitId: 'GND-Planes', count: 3, lane: 'air', tier: 1, delay: 0, interval: 1.8 },
      { unitId: 'GND-Copters', count: 3, lane: 'air', tier: 1, delay: 2, interval: 2 },
      { unitId: 'WTR-Swimmer', count: 3, lane: 'water', tier: 1, delay: 1, interval: 1.5 },
    ],
  },
  {
    id: 8, name: 'Combined Arms',
    spawns: [
      { unitId: 'GND-HeavyTanks', count: 2, lane: 'ground', tier: 1, delay: 0, interval: 4 },
      { unitId: 'GND-Troops', count: 6, lane: 'ground', tier: 2, delay: 1, interval: 1 },
      { unitId: 'GND-Missiles', count: 2, lane: 'air', tier: 1, delay: 3, interval: 3 },
      { unitId: 'WTR-Floater', count: 3, lane: 'water', tier: 1, delay: 2, interval: 2.5 },
    ],
  },
];

export const WaveConfig = {
  totalWaves: Waves.length,     // survive all = win
  interWaveDelay: 8,            // seconds of build time between auto waves
  autoStart: false,             // waves begin on player start-wave input
  firstWaveGrace: 5,            // minimum seconds before wave 1 may be started
};

// ---------------------------------------------------------------------------
// Balance harness config (GDD §17 — unit price = average DPS over 100 battles)
// ---------------------------------------------------------------------------
export const HarnessConfig = {
  battles: 100,
  maxBattleSeconds: 120,
  tickRate: 20,                 // sim ticks per second (fixed timestep, same as game)
  baseSeed: 0xB01D,
  priceStabilizationTolerance: 0.05, // prices considered stable within ±5% across seeds
};

// ---------------------------------------------------------------------------
// Sim constants shared by core/log (fixed timestep — determinism contract)
// ---------------------------------------------------------------------------
export const SimConfig = {
  tickRate: 20,                 // ticks per second
  dt: 1 / 20,                   // seconds per tick
};

// ---------------------------------------------------------------------------
// Palette (view hint only — read by renderer, never by sim)
// ---------------------------------------------------------------------------
export const Palette = {
  sky: 0x1b2430,
  groundLow: 0x3a4d2f,
  groundMid: 0x46603a,
  groundHigh: 0x527047,
  waterSurface: 0x2a5f8f,
  waterSub: 0x1d4468,
  base: 0xd9b23a,
  baseDamaged: 0xa8641f,
  slot: 0x8a8f66,
  walker: 0xc0563c,
  floater: 0x4fb0c6,
  flyer: 0xd9d9d9,
  flyerShadow: 0x000000,
  towerAntiGround: 0x7fa650,
  towerAntiAir: 0x6f8fd0,
  wall: 0x9a9a9a,
  moat: 0x3f6f9f,
  projectile: 0xffe08a,
  hpBack: 0x3a3a3a,
  hpFill: 0x62d962,
  ghostValid: 0x62d962,
  ghostInvalid: 0xd95050,
  rangeCircle: 0xffffff,
  pathLine: 0xffd24d,
  text: 0xf0f0f0,
};

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------
export const Tables = {
  Assumptions,
  Factions,
  Archetypes,
  FactionMods,
  DamageTypes,
  Effectiveness,
  Units,
  Structures,
  StructureStates,
  Board,
  Waves,
  WaveConfig,
  HarnessConfig,
  SimConfig,
  Palette,
  getUnit,
  getStructure,
  effectivenessMultiplier,
  activeSlotCount,
};

export default Tables;