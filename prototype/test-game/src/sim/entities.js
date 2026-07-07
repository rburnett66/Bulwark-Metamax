window.__BULWARK_ENTITIES__ = window.__BULWARK_ENTITIES__ || {};

import { TABLES } from '../data/tables.js';

// ---------------------------------------------------------------------------
// Entity factories — all stats are read from src/data/tables.js (no hardcoded
// balance). Factories return plain serializable state objects for the sim.
// ---------------------------------------------------------------------------

let nextEntityId = 1;

export function resetEntityIds() {
  nextEntityId = 1;
}

export function allocId() {
  return nextEntityId++;
}

// Allow the sim core to restore id counter when deserializing / replaying.
export function setNextEntityId(n) {
  nextEntityId = n | 0;
}

export function getNextEntityId() {
  return nextEntityId;
}

// ---------------------------------------------------------------------------
// Table lookups
// ---------------------------------------------------------------------------

export function getUnitDef(unitId) {
  const def = TABLES.units.find((u) => u.id === unitId);
  if (!def) throw new Error('Unknown unit id: ' + unitId);
  return def;
}

export function getStructureDef(structId) {
  const def = TABLES.structures.find((s) => s.id === structId);
  if (!def) throw new Error('Unknown structure id: ' + structId);
  return def;
}

export function listUnitDefs() {
  return TABLES.units;
}

export function listStructureDefs() {
  return TABLES.structures;
}

// ---------------------------------------------------------------------------
// Tier stat helpers (data-driven from Assumptions upgrade multipliers or
// explicit per-tier columns when present in the tables)
// ---------------------------------------------------------------------------

export function tierStat(def, key, tier) {
  // Prefer explicit per-tier values from the tables (e.g. hp: [t1,t2,t3])
  const val = def[key];
  if (Array.isArray(val)) {
    const idx = Math.max(0, Math.min(val.length - 1, (tier | 0) - 1));
    return val[idx];
  }
  // Fall back to base value scaled by assumption multipliers
  const a = TABLES.assumptions;
  if (tier <= 1) return val;
  if (key === 'hp') return val * (tier === 2 ? a.Upgrade_HP_x_T2 : a.Upgrade_HP_x_T3);
  if (key === 'dps') return val * (tier === 2 ? a.Upgrade_DPS_x_T2 : a.Upgrade_DPS_x_T3);
  return val;
}

export function tierCost(def, tier) {
  if (Array.isArray(def.cost)) {
    const idx = Math.max(0, Math.min(def.cost.length - 1, (tier | 0) - 1));
    return def.cost[idx];
  }
  const a = TABLES.assumptions;
  const base = def.cost;
  if (tier <= 1) return base;
  return base * (tier === 2 ? a.Upgrade_Cost_x_T2 : a.Upgrade_Cost_x_T3);
}

// Incremental price to upgrade from tier -> tier+1 (cumulative value delta).
export function upgradePrice(def, fromTier) {
  return Math.max(0, Math.round(tierCost(def, fromTier + 1) - tierCost(def, fromTier)));
}

// Partial refund on sell (fraction from assumptions, default 50%).
export function sellRefund(def, tier) {
  const frac =
    TABLES.assumptions.Sell_refund_fraction != null
      ? TABLES.assumptions.Sell_refund_fraction
      : 0.5;
  return Math.round(tierCost(def, tier) * frac);
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export function createBase(x, y) {
  const b = TABLES.base;
  return {
    id: allocId(),
    kind: 'base',
    x,
    y,
    hp: b.hp,
    maxHp: b.hp,
    level: b.level != null ? b.level : 1,
    armorClass: b.armorClass || 'Structure',
    alive: true,
  };
}

// ---------------------------------------------------------------------------
// Units (walker / floater / flyer) — attackers and deployed troops
// ---------------------------------------------------------------------------

export function createUnit(unitId, x, y, opts) {
  opts = opts || {};
  const def = getUnitDef(unitId);
  const tier = opts.tier || 1;
  const hp = tierStat(def, 'hp', tier);
  const dps = tierStat(def, 'dps', tier);
  return {
    id: allocId(),
    kind: 'unit',
    unitId: def.id,
    name: def.name || def.id,
    faction: def.faction,
    shape: def.shape,
    role: def.role,
    domain: def.domain, // 'walker' | 'floater' | 'flyer'
    armorClass: def.armorClass, // 'Organic' | 'Machinery' | 'Aircraft' | ...
    damageType: def.damageType, // 'Kinetic' | 'Concussion' | ...
    canTarget: def.canTarget, // 'Ground' | 'Air' | 'Both'
    targetsBase: def.targets === 'Base', // false => flagged to target structures
    targetsStructures: def.targets === 'Structures',
    aoeRadius: def.aoe || 0,
    status: def.status || null,
    radarDetect: !!def.radarDetect, // detected by radar (air)
    seesGround: !!def.seesGround, // air units see ground at range
    tier,
    hp,
    maxHp: hp,
    dps,
    range: def.range,
    speed: def.speed,
    vision: def.vision,
    cost: tierCost(def, tier),
    power: def.power,
    // Positional / motion state
    x,
    y,
    altitude: def.domain === 'flyer' ? (def.altitude != null ? def.altitude : 1) : 0,
    // Team: 'attacker' (waves) or 'defender' (deployed troops)
    team: opts.team || 'attacker',
    lane: opts.lane || (def.domain === 'floater' ? 'water' : 'ground'),
    // Path state (filled by pathing)
    path: null,
    pathIndex: 0,
    destX: opts.destX != null ? opts.destX : null,
    destY: opts.destY != null ? opts.destY : null,
    // Combat state
    targetId: null,
    cooldown: 0,
    fireInterval: def.fireInterval != null ? def.fireInterval : 1,
    // Vision flags (maintained by vision.js)
    visible: true,
    detected: def.domain !== 'flyer',
    // Repair-job flag: deployed troop assigned to travel + repair a structure
    repairJobId: null,
    alive: true,
    state: 'moving', // 'moving' | 'attacking' | 'idle' | 'dead'
  };
}

export function createWalker(unitId, x, y, opts) {
  const u = createUnit(unitId, x, y, opts);
  if (u.domain !== 'walker') throw new Error(unitId + ' is not a walker');
  return u;
}

export function createFloater(unitId, x, y, opts) {
  const u = createUnit(unitId, x, y, opts);
  if (u.domain !== 'floater') throw new Error(unitId + ' is not a floater');
  return u;
}

export function createFlyer(unitId, x, y, opts) {
  const u = createUnit(unitId, x, y, opts);
  if (u.domain !== 'flyer') throw new Error(unitId + ' is not a flyer');
  return u;
}

// ---------------------------------------------------------------------------
// Structures (towers / walls / moats)
// ---------------------------------------------------------------------------

export function createStructure(structId, x, y, opts) {
  opts = opts || {};
  const def = getStructureDef(structId);
  const tier = opts.tier || 1;
  const hp = tierStat(def, 'hp', tier);
  const dps = tierStat(def, 'dps', tier);
  const isWeapon = def.type === 'tower' || (dps || 0) > 0;
  return {
    id: allocId(),
    kind: 'structure',
    structId: def.id,
    name: def.name || def.id,
    type: def.type, // 'tower' | 'wall' | 'moat' | 'radar'
    armorClass: def.armorClass || 'Structure',
    damageType: def.damageType || null,
    canTarget: def.canTarget || null, // 'Ground' | 'Air' | 'Both' | null
    canTargetAir: def.canTarget === 'Air' || def.canTarget === 'Both',
    canTargetGround: def.canTarget === 'Ground' || def.canTarget === 'Both',
    isWeapon,
    blocksWalkers: def.type === 'wall' || def.type === 'moat',
    hasRadar: !!def.radar, // radar detects air, not ground
    tier,
    maxTier: def.maxTier != null ? def.maxTier : (Array.isArray(def.hp) ? def.hp.length : 3),
    hp,
    maxHp: hp,
    dps,
    range: tierStat(def, 'range', tier) || 0,
    fireInterval: def.fireInterval != null ? def.fireInterval : 1,
    vision: def.vision != null ? def.vision : TABLES.assumptions.Vision_base,
    cost: tierCost(def, tier),
    buildTime: def.buildTime != null ? def.buildTime : 3,
    footprint: def.footprint || { w: 1, h: 1 },
    x,
    y,
    slotIndex: opts.slotIndex != null ? opts.slotIndex : null,
    // Lifecycle: Placing -> Building -> Complete -> Damaged -> Destroyed,
    // plus Upgrading and Selling (managed by structures.js)
    state: opts.state || 'Placing',
    buildTimer: 0,
    upgradeTimer: 0,
    sellTimer: 0,
    repairTimer: 0,
    repairUnitId: null, // troop en route / repairing (repairs free, need troop travel)
    // Combat state
    targetId: null,
    cooldown: 0,
    alive: true,
  };
}

export function createTower(structId, x, y, opts) {
  const s = createStructure(structId, x, y, opts);
  if (s.type !== 'tower') throw new Error(structId + ' is not a tower');
  return s;
}

export function createWall(structId, x, y, opts) {
  const s = createStructure(structId, x, y, opts);
  if (!s.blocksWalkers) throw new Error(structId + ' is not a wall/moat');
  return s;
}

// Apply upgraded tier stats in place (called by structures.js when an upgrade
// completes). Preserves damage fraction so upgrades do not fully heal.
export function applyTierStats(structure, newTier) {
  const def = getStructureDef(structure.structId);
  const hpFrac = structure.maxHp > 0 ? structure.hp / structure.maxHp : 1;
  const newMaxHp = tierStat(def, 'hp', newTier);
  structure.tier = newTier;
  structure.maxHp = newMaxHp;
  structure.hp = Math.round(newMaxHp * hpFrac);
  structure.dps = tierStat(def, 'dps', newTier);
  structure.range = tierStat(def, 'range', newTier) || structure.range;
  structure.cost = tierCost(def, newTier);
}

// Same for units (deployed troops upgraded via base level, future-proof).
export function applyUnitTierStats(unit, newTier) {
  const def = getUnitDef(unit.unitId);
  const hpFrac = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
  const newMaxHp = tierStat(def, 'hp', newTier);
  unit.tier = newTier;
  unit.maxHp = newMaxHp;
  unit.hp = Math.round(newMaxHp * hpFrac);
  unit.dps = tierStat(def, 'dps', newTier);
  unit.cost = tierCost(def, newTier);
}

// ---------------------------------------------------------------------------
// Convenience: deploy price for HUD / economy (spawn-at-base troop cost)
// ---------------------------------------------------------------------------

export function unitDeployCost(unitId, tier) {
  return Math.round(tierCost(getUnitDef(unitId), tier || 1));
}

export function structureBuildCost(structId, tier) {
  return Math.round(tierCost(getStructureDef(structId), tier || 1));
}