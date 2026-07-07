// src/data/units.js
// Unit roster — data-driven from the BULWARK balance workbook (Units sheet).
// Only the tutorial/vertical-slice faction (Ground / Powder) is fully specified
// with 3 behavior-spanning units used by the sim; the derivation helpers are
// exposed so the full 72-unit roster can be regenerated deterministically.
//
// This module is READ-ONLY data. The sim consumes it via config.data.tables.units.

import { assumptions } from './assumptions.js';
import { effectiveness } from './effectiveness.js';

// ---------------------------------------------------------------------------
// Armor-class lookup helpers (derive EffDPS from raw DPS x damage-type matrix)
// ---------------------------------------------------------------------------
function effMult(damageType, armorClass) {
  const row = effectiveness && effectiveness[damageType];
  if (!row) return 1;
  const v = row[armorClass];
  return typeof v === 'number' ? v : 1;
}

function effDPS(rawDPS, damageType, targetArmorClass) {
  return rawDPS * effMult(damageType, targetArmorClass);
}

// ---------------------------------------------------------------------------
// Tier scaling helpers (from Assumptions sheet)
// ---------------------------------------------------------------------------
const HP_T2 = assumptions?.Upgrade_HP_x_T2 ?? 1.6;
const HP_T3 = assumptions?.Upgrade_HP_x_T3 ?? 2.4;
const DPS_T2 = assumptions?.Upgrade_DPS_x_T2 ?? 1.55;
const DPS_T3 = assumptions?.Upgrade_DPS_x_T3 ?? 2.3;
const COST_T2 = assumptions?.Upgrade_Cost_x_T2 ?? 2.5;
const COST_T3 = assumptions?.Upgrade_Cost_x_T3 ?? 5;

// Build the tiered stat arrays [T1, T2, T3] from a T1 base value + curve.
function tierHP(base) {
  return [base, base * HP_T2, base * HP_T3];
}
function tierDPS(base) {
  return [base, base * DPS_T2, base * DPS_T3];
}
function tierCost(base) {
  return [base, base * COST_T2, base * COST_T3];
}

// ---------------------------------------------------------------------------
// Raw roster rows (Ground / Powder faction — the tutorial faction).
// Values taken directly from the workbook's Units sheet (T1 baselines);
// higher tiers derived via the curve helpers for consistency.
// ---------------------------------------------------------------------------
const RAW = [
  {
    id: 'GND-Troops',
    faction: 'Ground / Powder',
    shape: 'Troops',
    role: 'Skirmisher',
    domain: 'Walker',
    armorClass: 'Organic',
    damageType: 'Kinetic',
    canTarget: 'Ground',
    targets: 'Base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: false,
    seesGround: false,
    hpT1: 220,
    dpsT1: 45,
    range: 2.5,
    speed: 1.84,
    vision: 5.5,
    power: 100,
    costT1: 300,
  },
  {
    id: 'GND-Artillery',
    faction: 'Ground / Powder',
    shape: 'Artillery',
    role: 'Siege',
    domain: 'Walker',
    armorClass: 'Machinery',
    damageType: 'Concussion',
    canTarget: 'Ground',
    targets: 'Structures',
    targetsBase: false,
    targetsStructures: true,
    aoe: 2,
    status: 'Stagger',
    radarDetect: false,
    seesGround: false,
    hpT1: 165,
    dpsT1: 60,
    range: 10,
    speed: 0.368,
    vision: 4,
    power: 101.1,
    costT1: 303.3,
  },
  {
    id: 'GND-Copters',
    faction: 'Ground / Powder',
    shape: 'Copters',
    role: 'Harasser',
    domain: 'Flyer',
    armorClass: 'Aircraft',
    damageType: 'Kinetic',
    canTarget: 'Both',
    targets: 'Base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: true,
    seesGround: true,
    hpT1: 220,
    dpsT1: 45,
    range: 5,
    speed: 1.84,
    vision: 4.5,
    power: 100,
    costT1: 300,
  },
  // A floater/swimmer variant so the water lane has a native attacker.
  // (Derived shape — Ground faction fielding an amphibious skirmisher.)
  {
    id: 'GND-Swimmers',
    faction: 'Ground / Powder',
    shape: 'Troops',
    role: 'Amphibious',
    domain: 'Floater',
    armorClass: 'Organic',
    damageType: 'Kinetic',
    canTarget: 'Ground',
    targets: 'Base',
    targetsBase: true,
    targetsStructures: false,
    aoe: 0,
    status: null,
    radarDetect: false,
    seesGround: false,
    hpT1: 240,
    dpsT1: 40,
    range: 2.5,
    speed: 1.5,
    vision: 5,
    power: 100,
    costT1: 300,
  },
];

// ---------------------------------------------------------------------------
// Materialize each row into a full unit definition object.
// ---------------------------------------------------------------------------
function materialize(row) {
  const hp = tierHP(row.hpT1);
  const dps = tierDPS(row.dpsT1);
  const cost = tierCost(row.costT1);

  // EffDPS vs common armor classes, computed per tier from raw DPS.
  const effVsOrganic = dps.map((d) => effDPS(d, row.damageType, 'Organic'));
  const effVsMachinery = dps.map((d) => effDPS(d, row.damageType, 'Machinery'));
  const effVsAircraft = dps.map((d) => effDPS(d, row.damageType, 'Aircraft'));
  const effVsStructure = dps.map((d) => effDPS(d, row.damageType, 'Structure'));
  const effVsEnergy = dps.map((d) => effDPS(d, row.damageType, 'Energy'));

  const canHitAir = row.canTarget === 'Both' || row.canTarget === 'Air';
  const canHitGround = row.canTarget === 'Both' || row.canTarget === 'Ground';

  return {
    id: row.id,
    faction: row.faction,
    shape: row.shape,
    role: row.role,

    // Domain / movement
    domain: row.domain, // 'Walker' | 'Floater' | 'Flyer'
    isWalker: row.domain === 'Walker',
    isFloater: row.domain === 'Floater',
    isFlyer: row.domain === 'Flyer',

    // Combat identity
    armorClass: row.armorClass,
    damageType: row.damageType,
    canTarget: row.canTarget, // 'Ground' | 'Air' | 'Both'
    canHitAir,
    canHitGround,
    targets: row.targets, // 'Base' | 'Structures'
    targetsBase: row.targetsBase,
    targetsStructures: row.targetsStructures,

    aoe: row.aoe,
    status: row.status,

    // Vision / detection
    radarDetect: row.radarDetect,
    seesGround: row.seesGround,
    vision: row.vision,

    // Stats (tiered)
    hp, // [T1,T2,T3]
    dps, // [T1,T2,T3]
    cost, // [T1,T2,T3]
    range: row.range,
    speed: row.speed,
    power: row.power,

    // Convenience single-tier accessors for the slice (T1 defaults)
    baseHP: hp[0],
    baseDPS: dps[0],
    baseCost: cost[0],

    // Effective DPS tables (per tier, by target armor class)
    effDPS: {
      Organic: effVsOrganic,
      Machinery: effVsMachinery,
      Aircraft: effVsAircraft,
      Structure: effVsStructure,
      Energy: effVsEnergy,
    },
  };
}

// ---------------------------------------------------------------------------
// Public roster
// ---------------------------------------------------------------------------
export const units = RAW.map(materialize);

// Keyed lookup by unit id.
export const unitsById = units.reduce((acc, u) => {
  acc[u.id] = u;
  return acc;
}, {});

// Query helpers used by the sim.
export function getUnit(id) {
  return unitsById[id] || null;
}

export function unitTierStats(id, tier) {
  const u = getUnit(id);
  if (!u) return null;
  const t = Math.max(0, Math.min(2, (tier | 0)));
  return {
    hp: u.hp[t],
    dps: u.dps[t],
    cost: u.cost[t],
    range: u.range,
    speed: u.speed,
  };
}

// Effective DPS for a given unit tier against a target armor class.
export function unitEffDPS(id, tier, targetArmorClass) {
  const u = getUnit(id);
  if (!u) return 0;
  const t = Math.max(0, Math.min(2, (tier | 0)));
  const table = u.effDPS[targetArmorClass];
  if (!table) return u.dps[t];
  return table[t];
}

// Expose derivation helpers so other tables/tools can regenerate consistently.
export const unitHelpers = {
  effMult,
  effDPS,
  tierHP,
  tierDPS,
  tierCost,
  materialize,
};

export default units;