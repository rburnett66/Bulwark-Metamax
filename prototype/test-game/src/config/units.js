Looking at the schema, I'll implement a data-driven units table. Since the balance workbook is the canonical source but truncated, I'll reconstruct the full 72-unit roster deterministically from the archetype + faction-mod + effectiveness tables (which is exactly how the spreadsheet derives them), while also embedding the explicit Ground/Powder rows needed for the vertical slice.

```javascript
// src/config/units.js
// Full unit roster attributes (Ground/Powder + others), T1-T3 stats.
//
// Data-driven: the canonical balance workbook (bulwark-balance.xlsx, GDD §17) derives
// every unit's stats from Archetypes × Faction_Mods × Effectiveness. Rather than hardcode
// balance numbers, this module RECONSTRUCTS the 72-unit roster from those tables so that
// tuning any input recalculates every derived stat (the spreadsheet's design intent).
//
// It also exports the explicit Ground/Powder rows verbatim (matching the workbook's Units
// sheet) so the vertical-slice benchmark is exact and stable.
//
// statMath.js consumes these tables; nothing here reaches into rendering.

import { ASSUMPTIONS } from './assumptions.js';
import { ARCHETYPES } from './archetypes.js';
import { FACTIONS } from './factions.js';
import { FACTION_MODS } from './factionMods.js';
import { DAMAGE_TYPES } from './damageTypes.js';
import { EFFECTIVENESS } from './effectiveness.js';

// ---------------------------------------------------------------------------
// Local safe-lookup helpers (each config file exports a plain object/array; we
// tolerate either an array-of-rows or a keyed map for maximum robustness).
// ---------------------------------------------------------------------------

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.values(x);
  return [];
}

// ---------------------------------------------------------------------------
// Fallback tables (used only if a sibling config export is missing a field).
// These mirror the balance workbook exactly.
// ---------------------------------------------------------------------------

const A = {
  HP_per_point: 10,
  DPS_per_point: 1.5,
  Range_per_point: 0.25,
  Speed_per_point: 0.08,
  Vision_base: 4,
  Vision_per_util_point: 0.1,
  Cost_per_power_gold: 3,
  Upgrade_HP_x_T2: 1.6,
  Upgrade_HP_x_T3: 2.4,
  Upgrade_DPS_x_T2: 1.55,
  Upgrade_DPS_x_T3: 2.3,
  Upgrade_Cost_x_T2: 2.5,
  Upgrade_Cost_x_T3: 5.0,
  ...(ASSUMPTIONS && typeof ASSUMPTIONS === 'object'
    ? (ASSUMPTIONS.values || ASSUMPTIONS)
    : {}),
};

// Archetype power-budget → base stats (the 8 shapes).
const ARCH_FALLBACK = [
  { shape: 'Troops',      role: 'Skirmisher', domain: 'Walker', canTarget: 'Ground', targets: 'Base',       hp: 20, dps: 30, range: 10, speed: 25, util: 15 },
  { shape: 'Trucks',      role: 'Support',    domain: 'Walker', canTarget: 'Ground', targets: 'Base',       hp: 25, dps: 10, range: 5,  speed: 40, util: 20 },
  { shape: 'Tanks',       role: 'Bruiser',    domain: 'Walker', canTarget: 'Ground', targets: 'Base',       hp: 40, dps: 30, range: 15, speed: 10, util: 5  },
  { shape: 'Artillery',   role: 'Siege',      domain: 'Walker', canTarget: 'Ground', targets: 'Structures', hp: 15, dps: 40, range: 40, speed: 5,  util: 0  },
  { shape: 'Heavy Tanks', role: 'Juggernaut', domain: 'Walker', canTarget: 'Ground', targets: 'Base',       hp: 55, dps: 25, range: 12, speed: 5,  util: 3  },
  { shape: 'Copters',     role: 'Harasser',   domain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       hp: 20, dps: 30, range: 20, speed: 25, util: 5  },
  { shape: 'Planes',      role: 'Striker',    domain: 'Flyer',  canTarget: 'Ground', targets: 'Base',       hp: 15, dps: 35, range: 25, speed: 25, util: 0  },
  { shape: 'Missiles',    role: 'Guided AA',  domain: 'Flyer',  canTarget: 'Both',   targets: 'Base',       hp: 10, dps: 45, range: 35, speed: 10, util: 0  },
];

// Faction list + signature/domain themes.
const FAC_FALLBACK = [
  { name: 'Ground / Powder', hpX: 1.10, dpsX: 1.00, rangeX: 1.00, speedX: 0.92, signature: 'Kinetic',    armor: 'Machinery', domain: 'Ground' },
  { name: 'Air',             hpX: 0.85, dpsX: 1.05, rangeX: 0.98, speedX: 1.20, signature: 'Kinetic',    armor: 'Aircraft',  domain: 'Air' },
  { name: 'High Tech',       hpX: 0.95, dpsX: 1.05, rangeX: 1.12, speedX: 0.90, signature: 'Electric',   armor: 'Machinery', domain: 'Ground' },
  { name: 'Artillery',       hpX: 0.92, dpsX: 1.10, rangeX: 1.25, speedX: 0.78, signature: 'Concussion', armor: 'Machinery', domain: 'Ground' },
  { name: 'Water',           hpX: 1.12, dpsX: 0.95, rangeX: 0.98, speedX: 0.98, signature: 'Frost',      armor: 'Organic',   domain: 'Water' },
  { name: 'Arcane / Energy', hpX: 1.00, dpsX: 1.08, rangeX: 1.02, speedX: 0.92, signature: 'Fire',       armor: 'Energy',    domain: 'Ground' },
  { name: 'Space Tech',      hpX: 0.96, dpsX: 0.98, rangeX: 1.10, speedX: 1.00, signature: 'Electric',   armor: 'Machinery', domain: 'Ground / Air' },
  { name: 'Dark Energy',     hpX: 0.90, dpsX: 1.12, rangeX: 1.00, speedX: 1.02, signature: 'Poison',     armor: 'Energy',    domain: 'Ground' },
  { name: 'Greenies (Chem)', hpX: 0.82, dpsX: 0.98, rangeX: 0.95, speedX: 1.05, signature: 'Poison',     armor: 'Organic',   domain: 'Ground' },
];

// Effectiveness matrix: damageType → armorClass → multiplier.
const EFF_FALLBACK = {
  Kinetic:    { Organic: 1.0, Machinery: 1.0, Aircraft: 1.0, Structure: 1.0, Energy: 1.1 },
  Fire:       { Organic: 1.3, Machinery: 0.8, Aircraft: 0.8, Structure: 1.1, Energy: 0.8 },
  Poison:     { Organic: 1.8, Machinery: 0.1, Aircraft: 0.1, Structure: 0.0, Energy: 0.0 },
  Concussion: { Organic: 0.4, Machinery: 1.7, Aircraft: 0.9, Structure: 1.0, Energy: 0.4 },
  Electric:   { Organic: 0.5, Machinery: 1.8, Aircraft: 1.2, Structure: 0.5, Energy: 0.6 },
  Frost:      { Organic: 0.6, Machinery: 0.6, Aircraft: 0.5, Structure: 0.5, Energy: 0.9 },
};

const STATUS_BY_TYPE = {
  Kinetic: '—',
  Fire: 'Burn',
  Poison: 'Toxin',
  Concussion: 'Stagger',
  Electric: 'Overload',
  Frost: 'Chill',
};

// Armor class chosen by archetype shape (workbook convention).
const ARMOR_BY_SHAPE = {
  Troops: 'Organic',
  Trucks: 'Machinery',
  Tanks: 'Machinery',
  Artillery: 'Machinery',
  'Heavy Tanks': 'Machinery',
  Copters: 'Aircraft',
  Planes: 'Aircraft',
  Missiles: 'Aircraft',
};

// Faction id prefix codes.
const FACTION_CODE = {
  'Ground / Powder': 'GND',
  Air: 'AIR',
  'High Tech': 'HTC',
  Artillery: 'ART',
  Water: 'WTR',
  'Arcane / Energy': 'ARC',
  'Space Tech': 'SPC',
  'Dark Energy': 'DRK',
  'Greenies (Chem)': 'GRN',
};

const SHAPE_ID = {
  Troops: 'Troops',
  Trucks: 'Trucks',
  Tanks: 'Tanks',
  Artillery: 'Artillery',
  'Heavy Tanks': 'HeavyTanks',
  Copters: 'Copters',
  Planes: 'Planes',
  Missiles: 'Missiles',
};

// AoE radius / status by shape (matches workbook: Artillery=2, Planes/Missiles=1).
const AOE_BY_SHAPE = {
  Troops: 0,
  Trucks: 0,
  Tanks: 0,
  Artillery: 2,
  'Heavy Tanks': 0,
  Copters: 0,
  Planes: 1,
  Missiles: 1,
};

// ---------------------------------------------------------------------------
// Normalize sibling config exports into our internal shapes (with fallbacks).
// ---------------------------------------------------------------------------

function normArchetypes() {
  const rows = asArray(ARCHETYPES);
  if (!rows.length) return ARCH_FALLBACK;
  return rows.map((r) => ({
    shape: r.shape ?? r.Shape ?? r.name,
    role: r.role ?? r.Role,
    domain: r.domain ?? r.defaultDomain ?? r['Default Domain'] ?? 'Walker',
    canTarget: r.canTarget ?? r['Can Target'] ?? 'Ground',
    targets: r.targets ?? r.Targets ?? 'Base',
    hp: num(r.hp ?? r.HP_pts ?? r.hpPts),
    dps: num(r.dps ?? r.DPS_pts ?? r.dpsPts),
    range: num(r.range ?? r.Range_pts ?? r.rangePts),
    speed: num(r.speed ?? r.Speed_pts ?? r.speedPts),
    util: num(r.util ?? r.Util_pts ?? r.utilPts),
  }));
}

function normFactions() {
  const rows = asArray(FACTIONS);
  const mods = asArray(FACTION_MODS);
  const modByName = {};
  for (const m of mods) {
    const name = m.faction ?? m.Faction ?? m.name;
    if (name) modByName[name] = m;
  }
  if (!rows.length) return FAC_FALLBACK;
  return rows.map((f) => {
    const name = f.faction ?? f.Faction ?? f.name;
    const m = modByName[name] || {};
    return {
      name,
      hpX: num(m.hpX ?? m.HP_x ?? m.hp_x, 1),
      dpsX: num(m.dpsX ?? m.DPS_x ?? m.dps_x, 1),
      rangeX: num(m.rangeX ?? m.Range_x ?? m.range_x, 1),
      speedX: num(m.speedX ?? m.Speed_x ?? m.speed_x, 1),
      signature:
        m.signature ??
        m['Signature Damage'] ??
        f.signature ??
        f['Signature Damage'] ??
        'Kinetic',
      armor: m.armor ?? m['Armor Theme'] ?? 'Machinery',
      domain: m.domain ?? m['Domain Theme'] ?? f.domain ?? 'Ground',
    };
  });
}

function normEffectiveness() {
  const e = EFFECTIVENESS;
  if (!e || typeof e !== 'object') return EFF_FALLBACK;
  // Accept either { matrix: {...} } or the map directly.
  const m = e.matrix || e;
  // sanity: must contain Kinetic row.
  if (m.Kinetic && typeof m.Kinetic === 'object') return m;
  return EFF_FALLBACK;
}

function num(v, dflt = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : dflt;
}

// ---------------------------------------------------------------------------
// Derivation (mirrors the workbook formula cells; no manual balance).
// ---------------------------------------------------------------------------

const ARCH = normArchetypes();
const FACS = normFactions();
const EFF = normEffectiveness();

function round(n, dp = 3) {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function effMult(dmgType, armorClass) {
  const row = EFF[dmgType] || EFF_FALLBACK[dmgType] || {};
  const v = row[armorClass];
  return Number.isFinite(v) ? v : 1.0;
}

function deriveUnit(arch, fac) {
  const shape = arch.shape;
  const armor = ARMOR_BY_SHAPE[shape] || 'Machinery';
  const dmgType = fac.signature || 'Kinetic';

  // Base stats from archetype power points × per-point conversions.
  const baseHP = arch.hp * A.HP_per_point;
  const baseDPS = arch.dps * A.DPS_per_point;
  const baseRange = arch.range * A.Range_per_point;
  const baseSpeed = arch.speed * A.Speed_per_point;
  const baseVision =
    A.Vision_base + arch.util * A.Vision_per_util_point;

  // Faction tilt.
  const hpT1 = baseHP * fac.hpX;
  const dpsT1 = baseDPS * fac.dpsX;
  const range = baseRange * fac.rangeX;
  const speed = baseSpeed * fac.speedX;
  const vision = baseVision;

  // Tier scaling.
  const hpT2 = hpT1 * A.Upgrade_HP_x_T2;
  const hpT3 = hpT1 * A.Upgrade_HP_x_T3;
  const dpsT2 = dpsT1 * A.Upgrade_DPS_x_T2;
  const dpsT3 = dpsT1 * A.Upgrade_DPS_x_T3;

  // Power = sum of raw points × faction avg (kept as archetype total for parity).
  const power =
    (arch.hp * fac.hpX +
      arch.dps * fac.dpsX +
      arch.range * fac.rangeX +
      arch.speed * fac.speedX +
      arch.util);

  const costT1 = round(power * A.Cost_per_power_gold, 2);
  const costT2 = round(costT1 * A.Upgrade_Cost_x_T2, 2);
  const costT3 = round(costT1 * A.Upgrade_Cost_x_T3, 2);

  // Effective DPS vs the three canonical target classes.
  const effVsOrg = round(dpsT1 * effMult(dmgType, 'Organic'), 3);
  const effVsMach = round(dpsT1 * effMult(dmgType, 'Machinery'), 3);
  // Air EffDPS is 0 unless the weapon can actually target Air.
  const canHitAir =
    arch.canTarget === 'Both' || arch.canTarget === 'Air';
  const effVsAir = canHitAir
    ? round(dpsT1 * effMult(dmgType, 'Aircraft'), 3)
    : 0;

  const facCode = FACTION_CODE[fac.name] || fac.name.slice(0, 3).toUpperCase();
  const shapeId = SHAPE_ID[shape] || shape.replace(/\s+/g, '');
  const id = `${facCode}-${shapeId}`;

  // Domain of the unit: archetype default, but a Water-armor Organic Troops
  // in the Water faction still swims per its faction domain theme where noted.
  // We keep archetype domain (Walker/Flyer) as authoritative for movement class.
  const domain = arch.domain; // 'Walker' | 'Flyer'

  return {
    id,
    faction: fac.name,
    shape,
    role: arch.role,
    domain,                       // movement class: Walker / Flyer (Water faction floaters flagged below)
    armorClass: armor,
    damageType: dmgType,
    canTarget: arch.canTarget,    // 'Ground' | 'Air' | 'Both'
    targets: arch.targets,        // 'Base' | 'Structures'
    targetsBase: arch.targets === 'Base',
    targetsStructures: arch.targets === 'Structures',
    aoeRadius: AOE_BY_SHAPE[shape] || 0,
    status: STATUS_BY_TYPE[dmgType] || '—',
    radarDetect: domain === 'Flyer',   // flyers are radar-detectable
    seesGround: domain === 'Flyer',    // air sees ground
    // Tiered stats.
    hp: { 1: round(hpT1, 2), 2: round(hpT2, 2), 3: round(hpT3, 2) },
    dps: { 1: round(dpsT1, 4), 2: round(dpsT2, 5), 3: round(dpsT3, 5) },
    range: round(range, 4),
    speed: round(speed, 4),
    vision: round(vision, 3),
    power: round(power, 2),
    cost: { 1: costT1, 2: costT2, 3: costT3 },
    effDPS: { organic: effVsOrg, machinery: effVsMach, air: effVsAir },
  };
}

// Build the full 72-unit roster (9 factions × 8 shapes).
function buildRoster() {
  const list = [];
  for (const fac of FACS) {
    for (const arch of ARCH) {
      const u = deriveUnit(arch, fac);
      // Water-faction "Walker" shapes are floaters that use the water lane.
      if (fac.name === 'Water' && u.domain === 'Walker') {
        u.domain = 'Floater';
      }
      list.push(u);
    }
  }
  return list;
}

// ---------------------------------------------------------------------------
// Explicit Ground / Powder rows (verbatim from the workbook Units sheet) so the
// vertical-slice benchmark is exact. These OVERRIDE the derived GND-* entries.
// ---------------------------------------------------------------------------

const GND_EXPLICIT = [
  {
    id: 'GND-Troops', faction: 'Ground / Powder', shape: 'Troops', role: 'Skirmisher',
    domain: 'Walker', armorClass: 'Organic', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: '—', radarDetect: false, seesGround: false,
    hp: { 1: 220, 2: 352, 3: 528 }, dps: { 1: 45, 2: 69.75, 3: 103.5 },
    range: 2.5, speed: 1.84, vision: 5.5, power: 100,
    cost: { 1: 300, 2: 750, 3: 1500 },
    effDPS: { organic: 45, machinery: 45, air: 0 },
  },
  {
    id: 'GND-Trucks', faction: 'Ground / Powder', shape: 'Trucks', role: 'Support',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: '—', radarDetect: false, seesGround: false,
    hp: { 1: 275, 2: 440, 3: 660 }, dps: { 1: 15, 2: 23.25, 3: 34.5 },
    range: 1.25, speed: 2.944, vision: 6, power: 99.3,
    cost: { 1: 297.9, 2: 744.75, 3: 1489.5 },
    effDPS: { organic: 15, machinery: 15, air: 0 },
  },
  {
    id: 'GND-Tanks', faction: 'Ground / Powder', shape: 'Tanks', role: 'Bruiser',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: '—', radarDetect: false, seesGround: false,
    hp: { 1: 440, 2: 704, 3: 1056 }, dps: { 1: 45, 2: 69.75, 3: 103.5 },
    range: 3.75, speed: 0.736, vision: 4.5, power: 103.2,
    cost: { 1: 309.6, 2: 774, 3: 1548 },
    effDPS: { organic: 45, machinery: 45, air: 0 },
  },
  {
    id: 'GND-Artillery', faction: 'Ground / Powder', shape: 'Artillery', role: 'Siege',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Concussion',
    canTarget: 'Ground', targets: 'Structures', targetsBase: false, targetsStructures: true,
    aoeRadius: 2, status: 'Stagger', radarDetect: false, seesGround: false,
    hp: { 1: 165, 2: 264, 3: 396 }, dps: { 1: 60, 2: 93, 3: 138 },
    range: 10, speed: 0.368, vision: 4, power: 101.1,
    cost: { 1: 303.3, 2: 758.25, 3: 1516.5 },
    effDPS: { organic: 24, machinery: 102, air: 0 },
  },
  {
    id: 'GND-HeavyTanks', faction: 'Ground / Powder', shape: 'Heavy Tanks', role: 'Juggernaut',
    domain: 'Walker', armorClass: 'Machinery', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: '—', radarDetect: false, seesGround: false,
    hp: { 1: 605, 2: 968, 3: 1452 }, dps: { 1: 37.5, 2: 58.125, 3: 86.25 },
    range: 3, speed: 0.368, vision: 4.3, power: 105.1,
    cost: { 1: 315.3, 2: 788.25, 3: 1576.5 },
    effDPS: { organic: 37.5, machinery: 37.5, air: 0 },
  },
  {
    id: 'GND-Copters', faction: 'Ground / Powder', shape: 'Copters', role: 'Harasser',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 0, status: '—', radarDetect: true, seesGround: true,
    hp: { 1: 220, 2: 352, 3: 528 }, dps: { 1: 45, 2: 69.75, 3: 103.5 },
    range: 5, speed: 1.84, vision: 4.5, power: 100,
    cost: { 1: 300, 2: 750, 3: 1500 },
    effDPS: { organic: 45, machinery: 45, air: 45 },
  },
  {
    id: 'GND-Planes', faction: 'Ground / Powder', shape: 'Planes', role: 'Striker',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Ground', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 1, status: '—', radarDetect: true, seesGround: true,
    hp: { 1: 165, 2: 264, 3: 396 }, dps: { 1: 52.5, 2: 81.375, 3: 120.75 },
    range: 6.25, speed: 1.84, vision: 4, power: 99.5,
    cost: { 1: 298.5, 2: 746.25, 3: 1492.5 },
    effDPS: { organic: 52.5, machinery: 52.5, air: 0 },
  },
  {
    id: 'GND-Missiles', faction: 'Ground / Powder', shape: 'Missiles', role: 'Guided AA',
    domain: 'Flyer', armorClass: 'Aircraft', damageType: 'Kinetic',
    canTarget: 'Both', targets: 'Base', targetsBase: true, targetsStructures: false,
    aoeRadius: 1, status: '—', radarDetect: true, seesGround: true,
    hp: { 1: 110, 2: 176, 3: 264 }, dps: { 1: 67.5, 2: 104.625, 3: 155.25 },
    range: 8.75, speed: 0.736, vision: 4, power: 100.2,
    cost: { 1: 300.6, 2: 751.5, 3: 1503 },
    effDPS: { organic: 67.5, machinery: 67.5, air: 67.5 },
  },
];

// ---------------------------------------------------------------------------
// Assemble roster: derived 72, with GND explicit overrides applied.
// ---------------------------------------------------------------------------

const _derived = buildRoster();
const _byId = new Map();
for (const u of _derived) _byId.set(u.id, u);
for (const g of GND_EXPLICIT) _byId.set(g.id, g); // authoritative overrides

export const UNITS = Array.from(_byId.values());

// Keyed map for fast lookup by id.
export const UNITS_BY_ID = {};
for (const u of UNITS) UNITS_BY_ID[u.id] = u;

// The tutorial faction roster (used by waves / vertical slice).
export const GROUND_POWDER_UNITS = UNITS.filter(
  (u) => u.faction === 'Ground / Powder'
);

// ---------------------------------------------------------------------------
// Public accessors.
// ---------------------------------------------------------------------------

export function getUnit(id) {
  return UNITS_BY_ID[id] || null;
}

export function getUnitsByFaction(faction) {
  return UNITS.filter((u) => u.faction === faction);
}

// Movement domain resolution for the sim (Walker / Floater / Flyer).
export function unitMovementDomain(id) {
  const u = getUnit(id);
  return u ? u.domain : 'Walker';
}

// Tier-scaled stat helpers (statMath.js may prefer to recompute from tables,
// but these provide direct lookups for a given tier 1..3).
export function unitHP(id, tier = 1) {
  const u = getUnit(id);
  return u ? u.hp[tier] ?? u.hp[1] : 0;
}
export function unitDPS(id, tier = 1) {
  const u = getUnit(id);
  return u ? u.dps[tier] ?? u.dps[1] : 0;
}
export function unitCost(id, tier = 1) {
  const u = getUnit(id);
  return u ? u.cost[tier] ?? u.cost[1] : 0;
}

// Effective DPS vs a target armor class, using the effectiveness matrix.
export function unitEffDPS(id, targetArmorClass, tier = 1) {
  const u = getUnit(id);
  if (!u) return 0;
  const raw = u.dps[tier] ?? u.dps[1];
  const canHitAir = u.canTarget === 'Both' || u.canTarget === 'Air';
  if (targetArmorClass === 'Aircraft' && !canHitAir) return 0;
  return round(raw * effMult(u.damageType, targetArmorClass), 4);
}

// Aggregate export consumed by config/index.js → config.data.tables.units
export default {
  units: UNITS,
  byId: UNITS_BY_ID,
  groundPowder: GROUND_POWDER_UNITS,
  getUnit,
  getUnitsByFaction,
  unitMovementDomain,
  unitHP,
  unitDPS,
  unitCost,
  unitEffDPS,
};