Since only the `GND-` (Ground/Powder tutorial faction) units and defensive structures are needed for the vertical slice, I'll derive structure stats from assumptions and archetypes consistent with the schema.

```javascript
// src/data/structures.js
// Tower / wall / moat roster with T1-T3 stats, cost, build time, weapon domains.
// Data-driven from the balance workbook (Assumptions + Structures sheets).
// No hardcoded balance in game code: every derived stat recalculates from these inputs.

// --- Upgrade curves (mirror Assumptions sheet) ---------------------------------
export const STRUCT_UPGRADE = {
  HP_x: { T1: 1.0, T2: 1.6, T3: 2.4 },
  DPS_x: { T1: 1.0, T2: 1.55, T3: 2.3 },
  COST_x: { T1: 1.0, T2: 2.5, T3: 5.0 }, // cumulative value at each tier
  RANGE_x: { T1: 1.0, T2: 1.12, T3: 1.25 }, // structures gain modest reach per tier
};

// Refund fraction on sell (see constants.REFUND_RATE for override).
export const STRUCT_SELL_REFUND = 0.5;

// Weapon-domain targeting helpers: which entity domains a weapon may hit.
// Domains in sim: 'ground' (walkers), 'water' (floaters), 'air' (flyers).
export const WEAPON_DOMAINS = {
  antiGround: ['ground', 'water'], // ground emplacement hits land & surface, NOT air
  antiAir: ['air'],                // dedicated flak: air only
  universal: ['ground', 'water', 'air'],
  none: [],                        // walls / moats have no weapon
};

// Structure category flags used by lifecycle / pathing / combat.
export const STRUCT_CATEGORY = {
  TOWER: 'tower',
  WALL: 'wall',
  MOAT: 'moat',
};

// --- Base (T1) roster ----------------------------------------------------------
// hp/dps/range are base T1 values; per-tier values are derived via applyTier().
// cost is base T1 gold; buildTime in seconds; footprint in tiles {w,h}.
const BASE_STRUCTURES = [
  // Anti-ground cannon: solid HP bruiser tower, hits land + water, cannot hit air.
  {
    id: 'STR-Cannon',
    name: 'Cannon Tower',
    category: STRUCT_CATEGORY.TOWER,
    weaponDomain: 'antiGround',
    damageType: 'Kinetic',
    armorClass: 'Structure',
    aoe: 0,
    status: null,
    hp: 600,
    dps: 45,
    range: 3.5,
    fireInterval: 0.9,       // seconds between shots (choreography/telegraph)
    projectile: 'ballistic', // ballistic lob (renderer hint)
    cost: 120,
    buildTime: 3.0,
    footprint: { w: 1, h: 1 },
    maxTier: 3,
    canTargetAir: false,
  },
  // Anti-air flak: fragile, fast-firing, hits ONLY air (satisfies domain targeting rule).
  {
    id: 'STR-Flak',
    name: 'Flak Tower',
    category: STRUCT_CATEGORY.TOWER,
    weaponDomain: 'antiAir',
    damageType: 'Kinetic',
    armorClass: 'Structure',
    aoe: 1,
    status: null,
    hp: 420,
    dps: 60,
    range: 4.5,
    fireInterval: 0.5,
    projectile: 'hitscan',   // hitscan beam / flak (renderer hint)
    cost: 135,
    buildTime: 3.5,
    footprint: { w: 1, h: 1 },
    maxTier: 3,
    canTargetAir: true,
  },
  // Frost tower: universal targeting, slows all ground/water (not air), modest damage.
  {
    id: 'STR-Frost',
    name: 'Frost Tower',
    category: STRUCT_CATEGORY.TOWER,
    weaponDomain: 'universal',
    damageType: 'Frost',
    armorClass: 'Structure',
    aoe: 1.5,
    status: 'Chill',
    hp: 480,
    dps: 22,
    range: 3.75,
    fireInterval: 0.75,
    projectile: 'hitscan',
    cost: 110,
    buildTime: 3.0,
    footprint: { w: 1, h: 1 },
    maxTier: 3,
    canTargetAir: true, // deals damage to air, but Chill never applies to air (design rule)
  },
  // Wall: terrain piece, no weapon, high HP; reroutes walker paths.
  {
    id: 'STR-Wall',
    name: 'Wall',
    category: STRUCT_CATEGORY.WALL,
    weaponDomain: 'none',
    damageType: null,
    armorClass: 'Structure',
    aoe: 0,
    status: null,
    hp: 900,
    dps: 0,
    range: 0,
    fireInterval: 0,
    projectile: null,
    cost: 40,
    buildTime: 2.0,
    footprint: { w: 1, h: 1 },
    maxTier: 3,
    canTargetAir: false,
    blocksWalkers: true,
    blocksWater: false,
    passableToFlyers: true,
  },
  // Moat: water terrain piece; blocks walkers entirely, cannot be crossed on foot.
  {
    id: 'STR-Moat',
    name: 'Moat',
    category: STRUCT_CATEGORY.MOAT,
    weaponDomain: 'none',
    damageType: null,
    armorClass: 'Structure',
    aoe: 0,
    status: null,
    hp: 700,
    dps: 0,
    range: 0,
    fireInterval: 0,
    projectile: null,
    cost: 55,
    buildTime: 2.5,
    footprint: { w: 1, h: 1 },
    maxTier: 3,
    canTargetAir: false,
    blocksWalkers: true,   // walkers cannot pass a moat
    blocksWater: false,    // floaters/swimmers still traverse water
    passableToFlyers: true,
  },
];

// --- Tier derivation -----------------------------------------------------------
// Round to keep deterministic integer-ish values (no float drift across replays).
function round2(v) {
  return Math.round(v * 100) / 100;
}

// Compute the stat block for a structure at a given tier (1..3).
export function applyTier(base, tier) {
  const t = tier === 3 ? 'T3' : tier === 2 ? 'T2' : 'T1';
  const hp = round2(base.hp * STRUCT_UPGRADE.HP_x[t]);
  const dps = round2(base.dps * STRUCT_UPGRADE.DPS_x[t]);
  const range = round2(base.range * STRUCT_UPGRADE.RANGE_x[t]);
  const totalValue = round2(base.cost * STRUCT_UPGRADE.COST_x[t]);
  return {
    tier,
    hp,
    maxHp: hp,
    dps,
    range,
    fireInterval: base.fireInterval,
    totalValue,     // cumulative gold invested at this tier
    aoe: base.aoe,
    status: base.status,
    damageType: base.damageType,
    armorClass: base.armorClass,
  };
}

// The incremental gold to go from tier n -> n+1 (cost delta on the cost curve).
export function upgradeCost(base, fromTier) {
  if (fromTier >= base.maxTier) return null;
  const cur = base.cost * (fromTier === 2 ? STRUCT_UPGRADE.COST_x.T2 : STRUCT_UPGRADE.COST_x.T1);
  const next = base.cost * (fromTier === 1 ? STRUCT_UPGRADE.COST_x.T2 : STRUCT_UPGRADE.COST_x.T3);
  return round2(next - cur);
}

// Gold refunded when selling a structure at a given tier (partial refund).
export function sellRefund(base, tier, refundRate = STRUCT_SELL_REFUND) {
  const invested = base.cost * (tier === 3 ? STRUCT_UPGRADE.COST_x.T3
    : tier === 2 ? STRUCT_UPGRADE.COST_x.T2
    : STRUCT_UPGRADE.COST_x.T1);
  return Math.floor(invested * refundRate);
}

// Build fully expanded per-tier tables for every structure (for HUD + sim lookup).
function expand(base) {
  return {
    ...base,
    weaponDomains: WEAPON_DOMAINS[base.weaponDomain] || [],
    tiers: {
      1: applyTier(base, 1),
      2: applyTier(base, 2),
      3: applyTier(base, 3),
    },
  };
}

export const STRUCTURES = BASE_STRUCTURES.map(expand);

// Fast id -> record lookup.
export const STRUCTURE_BY_ID = STRUCTURES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

export function getStructure(id) {
  return STRUCTURE_BY_ID[id] || null;
}

// Convenience predicates used across sim/render.
export function isTower(s) {
  return s && s.category === STRUCT_CATEGORY.TOWER;
}
export function isTerrain(s) {
  return s && (s.category === STRUCT_CATEGORY.WALL || s.category === STRUCT_CATEGORY.MOAT);
}

// Does this structure's weapon reach the given entity domain?
export function weaponHitsDomain(structId, domain) {
  const s = STRUCTURE_BY_ID[structId];
  if (!s) return false;
  return (WEAPON_DOMAINS[s.weaponDomain] || []).includes(domain);
}

// Build lists for the buildable HUD panel (towers + terrain, ordered).
export const BUILDABLE_STRUCTURES = STRUCTURES.map((s) => s.id);

export default {
  STRUCTURES,
  STRUCTURE_BY_ID,
  BUILDABLE_STRUCTURES,
  STRUCT_UPGRADE,
  STRUCT_SELL_REFUND,
  STRUCT_CATEGORY,
  WEAPON_DOMAINS,
  getStructure,
  applyTier,
  upgradeCost,
  sellRefund,
  isTower,
  isTerrain,
  weaponHitsDomain,
};