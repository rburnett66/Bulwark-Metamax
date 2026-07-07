structures.js — I'll build a data-driven structures table consistent with the balance schema (archetype power budget, faction mods, upgrade curves, cost-per-power).

```javascript
// src/config/structures.js
// Tower / wall / moat definitions with T1-T3 stats and costs.
// Data-driven per BULWARK balance model: base stats from a 100-pt power budget,
// tiers scaled by Assumptions upgrade curves, cost derived from power (Cost_per_power_gold).
// No hardcoded balance in game code beyond this canonical table.

import { ASSUMPTIONS } from './assumptions.js';

// ---- Local mirrors of the tuning constants (safe fallbacks if assumptions import shape differs) ----
const A = (typeof ASSUMPTIONS === 'object' && ASSUMPTIONS) ? ASSUMPTIONS : {};
const K = {
  HP_per_point:        A.HP_per_point        ?? 10,
  DPS_per_point:       A.DPS_per_point        ?? 1.5,
  Range_per_point:     A.Range_per_point      ?? 0.25,
  Speed_per_point:     A.Speed_per_point      ?? 0.08,
  Vision_base:         A.Vision_base          ?? 4,
  Vision_per_util:     A.Vision_per_util_point ?? 0.1,
  Cost_per_power_gold: A.Cost_per_power_gold  ?? 3,
  UP_HP_T2:            A.Upgrade_HP_x_T2       ?? 1.6,
  UP_HP_T3:            A.Upgrade_HP_x_T3       ?? 2.4,
  UP_DPS_T2:           A.Upgrade_DPS_x_T2      ?? 1.55,
  UP_DPS_T3:           A.Upgrade_DPS_x_T3      ?? 2.3,
  UP_COST_T2:          A.Upgrade_Cost_x_T2     ?? 2.5,
  UP_COST_T3:          A.Upgrade_Cost_x_T3     ?? 5,
};

// ---- helpers ----
const round1 = (n) => Math.round(n * 10) / 10;
const round0 = (n) => Math.round(n);

// Derive base combat stats from a 100-pt power budget spread.
function deriveBase(pts) {
  const hp = round0((pts.hp || 0) * K.HP_per_point);
  const dps = round1((pts.dps || 0) * K.DPS_per_point);
  const range = round1((pts.range || 0) * K.Range_per_point);
  const vision = round1(K.Vision_base + (pts.util || 0) * K.Vision_per_util);
  const power = (pts.hp || 0) + (pts.dps || 0) + (pts.range || 0) + (pts.speed || 0) + (pts.util || 0);
  return { hp, dps, range, vision, power };
}

// Build the full tiered structure record from a definition.
function makeStructure(def) {
  const base = deriveBase(def.pts);

  // Tier HP / DPS
  const hpT1 = base.hp;
  const hpT2 = round0(base.hp * K.UP_HP_T2);
  const hpT3 = round0(base.hp * K.UP_HP_T3);

  const dpsT1 = base.dps;
  const dpsT2 = round1(base.dps * K.UP_DPS_T2);
  const dpsT3 = round1(base.dps * K.UP_DPS_T3);

  // Range grows mildly per tier for combat towers
  const rangeMul = def.rangePerTier ?? 0.15; // +15% per tier default
  const rangeT1 = base.range;
  const rangeT2 = round1(base.range * (1 + rangeMul));
  const rangeT3 = round1(base.range * (1 + rangeMul * 2));

  // Cost = power * gold-per-power (cumulative value at higher tiers)
  const costT1 = round0(base.power * K.Cost_per_power_gold);
  const costT2Total = round0(costT1 * K.UP_COST_T2);
  const costT3Total = round0(costT1 * K.UP_COST_T3);

  // Upgrade cost = incremental spend to reach the next tier
  const upgradeCostT2 = round0(costT2Total - costT1);
  const upgradeCostT3 = round0(costT3Total - costT2Total);

  // Sell refund = fraction of cumulative invested value
  const refundFrac = def.refundFrac ?? 0.5;
  const sellT1 = round0(costT1 * refundFrac);
  const sellT2 = round0(costT2Total * refundFrac);
  const sellT3 = round0(costT3Total * refundFrac);

  // Repair cost is free (troop-consuming) per model; keep a nominal 0 gold cost field.
  return {
    id: def.id,
    name: def.name,
    category: def.category,          // 'tower' | 'wall' | 'moat'
    domain: def.domain ?? 'ground',  // which lane/terrain it sits on
    armorClass: def.armorClass ?? 'Structure',
    damageType: def.damageType ?? null,
    canTarget: def.canTarget ?? [],  // e.g. ['ground'] or ['ground','air']
    targetsAir: (def.canTarget || []).includes('air'),
    isWeapon: (def.category === 'tower'),
    isTerrain: (def.category === 'wall' || def.category === 'moat'),
    blocksWalkers: def.blocksWalkers ?? (def.category === 'wall' || def.category === 'moat'),
    footprint: def.footprint ?? { w: 1, h: 1 },
    buildTime: def.buildTime ?? 3.0,        // seconds
    upgradeTime: def.upgradeTime ?? 2.5,    // seconds
    sellTime: def.sellTime ?? 0.6,          // seconds
    repairTroops: def.repairTroops ?? 1,    // troops consumed to repair
    repairTime: def.repairTime ?? 4.0,      // seconds
    projectileClass: def.projectileClass ?? 'ballistic', // 'ballistic' | 'hitscan'
    aoeRadius: def.aoeRadius ?? 0,
    status: def.status ?? null,
    slowFactor: def.slowFactor ?? 1,        // applied by moats to walkers standing/adjacent
    color: def.color,                       // primitive render tint
    power: base.power,
    vision: base.vision,
    tiers: {
      1: { hp: hpT1, dps: dpsT1, range: rangeT1, cost: costT1,       sell: sellT1, upgradeCost: upgradeCostT2 },
      2: { hp: hpT2, dps: dpsT2, range: rangeT2, cost: costT2Total,  sell: sellT2, upgradeCost: upgradeCostT3 },
      3: { hp: hpT3, dps: dpsT3, range: rangeT3, cost: costT3Total,  sell: sellT3, upgradeCost: 0 },
    },
    maxTier: 3,
  };
}

// ---- Definitions ----
// Three deployable towers span the required behavior:
//  - anti-ground direct-fire (cannon)
//  - anti-air missile turret
//  - long-range artillery/support (splash, anti-ground)
// Plus wall (blocks/reroutes walkers) and moat (blocks walkers, sits in water lane).

const DEFS = [
  // ---- Anti-ground cannon tower (bruiser-ish budget: HP + DPS) ----
  {
    id: 'TWR-Cannon',
    name: 'Cannon Tower',
    category: 'tower',
    domain: 'ground',
    armorClass: 'Structure',
    damageType: 'Kinetic',
    canTarget: ['ground'],
    projectileClass: 'ballistic',
    buildTime: 3.5,
    footprint: { w: 1, h: 1 },
    color: 0x4a90d9,
    // 100-pt budget: tanky direct-fire ground turret
    pts: { hp: 40, dps: 35, range: 18, speed: 0, util: 7 },
    rangePerTier: 0.12,
  },

  // ---- Anti-air missile tower (can target air; high DPS, splash) ----
  {
    id: 'TWR-Flak',
    name: 'Flak / AA Tower',
    category: 'tower',
    domain: 'ground',
    armorClass: 'Structure',
    damageType: 'Kinetic',
    canTarget: ['ground', 'air'],
    projectileClass: 'ballistic',
    aoeRadius: 1,
    buildTime: 4.0,
    footprint: { w: 1, h: 1 },
    color: 0xd94a6b,
    // 100-pt budget: lower HP, high DPS + range to hit fast flyers
    pts: { hp: 28, dps: 42, range: 25, speed: 0, util: 5 },
    rangePerTier: 0.15,
  },

  // ---- Long-range artillery emplacement (siege, splash, anti-ground) ----
  {
    id: 'TWR-Artillery',
    name: 'Artillery Emplacement',
    category: 'tower',
    domain: 'ground',
    armorClass: 'Structure',
    damageType: 'Concussion',
    canTarget: ['ground'],
    projectileClass: 'ballistic',
    aoeRadius: 2,
    status: 'Stagger',
    buildTime: 5.0,
    footprint: { w: 1, h: 1 },
    color: 0xd9a24a,
    // 100-pt budget: siege reach, big splash, slower cadence baked into dps
    pts: { hp: 20, dps: 40, range: 38, speed: 0, util: 2 },
    rangePerTier: 0.10,
  },

  // ---- Wall (blocks & reroutes walkers; no weapon) ----
  {
    id: 'STR-Wall',
    name: 'Wall',
    category: 'wall',
    domain: 'ground',
    armorClass: 'Structure',
    canTarget: [],
    blocksWalkers: true,
    buildTime: 2.0,
    footprint: { w: 1, h: 1 },
    color: 0x8a8f99,
    refundFrac: 0.5,
    // All budget into HP/util (defensive terrain)
    pts: { hp: 60, dps: 0, range: 0, speed: 0, util: 40 },
    rangePerTier: 0,
  },

  // ---- Moat (blocks walkers, sits in water lane; slows adjacent) ----
  {
    id: 'STR-Moat',
    name: 'Moat',
    category: 'moat',
    domain: 'water',
    armorClass: 'Structure',
    canTarget: [],
    blocksWalkers: true,
    slowFactor: 0.5,
    buildTime: 2.5,
    footprint: { w: 1, h: 1 },
    color: 0x2f6f8f,
    refundFrac: 0.4,
    // Cheap terrain denial: high HP-ish (excavated), high util
    pts: { hp: 50, dps: 0, range: 0, speed: 0, util: 50 },
    rangePerTier: 0,
  },
];

// ---- Materialize ----
export const STRUCTURES = DEFS.map(makeStructure);

// Keyed lookup
export const STRUCTURES_BY_ID = STRUCTURES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

// Convenience groupings used by build palette / harness
export const TOWERS = STRUCTURES.filter((s) => s.category === 'tower');
export const TERRAIN_PIECES = STRUCTURES.filter((s) => s.isTerrain);

// Accessor: current-tier stat block for a placed structure instance.
export function structureTierStats(id, tier) {
  const def = STRUCTURES_BY_ID[id];
  if (!def) return null;
  const t = Math.max(1, Math.min(def.maxTier, tier | 0));
  return { def, tier: t, ...def.tiers[t] };
}

// Accessor: build cost (tier 1 placement) for a structure id.
export function structureBuildCost(id) {
  const def = STRUCTURES_BY_ID[id];
  return def ? def.tiers[1].cost : 0;
}

// Accessor: upgrade cost to go from `tier` to `tier+1`.
export function structureUpgradeCost(id, tier) {
  const def = STRUCTURES_BY_ID[id];
  if (!def) return 0;
  const t = Math.max(1, Math.min(def.maxTier, tier | 0));
  return def.tiers[t].upgradeCost || 0;
}

// Accessor: sell refund at a given tier.
export function structureSellValue(id, tier) {
  const def = STRUCTURES_BY_ID[id];
  if (!def) return 0;
  const t = Math.max(1, Math.min(def.maxTier, tier | 0));
  return def.tiers[t].sell || 0;
}

export default {
  STRUCTURES,
  STRUCTURES_BY_ID,
  TOWERS,
  TERRAIN_PIECES,
  structureTierStats,
  structureBuildCost,
  structureUpgradeCost,
  structureSellValue,
};