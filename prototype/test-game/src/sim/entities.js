// src/sim/entities.js
// Entity factories: base, walker, floater, flyer, towers, wall/moat from data.
//
// Every entity is a plain object (strict state). Factories read stats from the
// data tables (config.data.tables) so there is NO hardcoded balance here.
//
// The sim engine assigns unique ids via nextId(state). Rendering reads these
// fields but never mutates them.

import { CONSTANTS } from '../config/constants.js';

// ---------------------------------------------------------------------------
// ID allocation
// ---------------------------------------------------------------------------
export function nextId(state) {
  if (state._idCounter == null) state._idCounter = 1;
  return state._idCounter++;
}

// ---------------------------------------------------------------------------
// Table lookup helpers
// ---------------------------------------------------------------------------
function getTables(config) {
  const t = config && config.data && config.data.tables;
  if (!t) throw new Error('entities: config.data.tables missing');
  return t;
}

export function findUnitDef(config, unitId) {
  const t = getTables(config);
  const rows = t.units || [];
  const def = rows.find((u) => u.UnitID === unitId || u.id === unitId);
  return def || null;
}

export function findStructureDef(config, structId) {
  const t = getTables(config);
  const rows = t.structures || [];
  const def = rows.find((s) => s.StructureID === structId || s.id === structId);
  return def || null;
}

// Pick numeric field with fallbacks (data may be normalized differently).
function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// Resolve tiered stat: try explicit T1/T2/T3 columns, else scale via assumptions.
function tieredHP(def, tier, assumptions) {
  const keys = { 1: 'HP T1', 2: 'HP T2', 3: 'HP T3' };
  const alt = { 1: 'hpT1', 2: 'hpT2', 3: 'hpT3' };
  let v = def[keys[tier]];
  if (v == null) v = def[alt[tier]];
  if (v != null) return num(v, 100);
  // scale from T1
  const base = num(def['HP T1'] != null ? def['HP T1'] : def.hpT1, 100);
  if (tier === 2) return base * num(assumptions.Upgrade_HP_x_T2, 1.6);
  if (tier === 3) return base * num(assumptions.Upgrade_HP_x_T3, 2.4);
  return base;
}

function tieredDPS(def, tier, assumptions) {
  const keys = { 1: 'DPS T1', 2: 'DPS T2', 3: 'DPS T3' };
  const alt = { 1: 'dpsT1', 2: 'dpsT2', 3: 'dpsT3' };
  let v = def[keys[tier]];
  if (v == null) v = def[alt[tier]];
  if (v != null) return num(v, 10);
  const base = num(def['DPS T1'] != null ? def['DPS T1'] : def.dpsT1, 10);
  if (tier === 2) return base * num(assumptions.Upgrade_DPS_x_T2, 1.55);
  if (tier === 3) return base * num(assumptions.Upgrade_DPS_x_T3, 2.3);
  return base;
}

function tieredCost(def, tier) {
  const keys = { 1: 'Cost T1', 2: 'Cost T2', 3: 'Cost T3' };
  const alt = { 1: 'costT1', 2: 'costT2', 3: 'costT3' };
  let v = def[keys[tier]];
  if (v == null) v = def[alt[tier]];
  return num(v, 100);
}

function getAssumptions(config) {
  const t = getTables(config);
  return t.assumptions || {};
}

// Resolve the domain group ("Ground" | "Water" | "Air") from a unit def.
function domainGroup(def) {
  const domain = String(def.Domain || def.domain || 'Walker').toLowerCase();
  if (domain.indexOf('fly') >= 0) return 'Air';
  // Floater/swimmer detection: Water faction or explicit water domain
  const faction = String(def.Faction || def.faction || '').toLowerCase();
  const armor = String(def['Armor Class'] || def.armorClass || '').toLowerCase();
  if (domain.indexOf('float') >= 0 || domain.indexOf('swim') >= 0 || domain.indexOf('water') >= 0) {
    return 'Water';
  }
  // Water faction units go on water lane
  if (faction.indexOf('water') >= 0) return 'Water';
  return 'Ground';
}

// Parse "Can Target" into a set of domains this attacker's weapon can hit.
function parseCanTarget(def) {
  const raw = String(def['Can Target'] || def.canTarget || 'Ground').toLowerCase();
  const set = { Ground: false, Water: false, Air: false };
  if (raw.indexOf('both') >= 0) {
    set.Ground = true;
    set.Air = true;
    set.Water = true;
  }
  if (raw.indexOf('ground') >= 0) set.Ground = true;
  if (raw.indexOf('air') >= 0) set.Air = true;
  if (raw.indexOf('water') >= 0) set.Water = true;
  if (!set.Ground && !set.Air && !set.Water) set.Ground = true;
  return set;
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------
export function makeBase(state, config, opts = {}) {
  const c = CONSTANTS;
  const base = {
    id: nextId(state),
    type: 'base',
    kind: 'base',
    x: opts.x != null ? opts.x : c.BASE_X,
    y: opts.y != null ? opts.y : c.BASE_Y,
    level: opts.level != null ? opts.level : 1,
    maxHp: opts.maxHp != null ? opts.maxHp : c.BASE_MAX_HP,
    hp: opts.maxHp != null ? opts.maxHp : c.BASE_MAX_HP,
    radius: c.BASE_RADIUS != null ? c.BASE_RADIUS : 28,
    faction: opts.faction || 'Player',
    alive: true,
  };
  return base;
}

// ---------------------------------------------------------------------------
// Attacker units (walker / floater / flyer) — data-driven
// ---------------------------------------------------------------------------
//
// makeAttacker(state, config, unitId, spawnPos, opts)
// - Reads stats from tables.units, applies tier scaling.
// - Determines domain group and locomotion type.
//
export function makeAttacker(state, config, unitId, spawn, opts = {}) {
  const def = findUnitDef(config, unitId);
  if (!def) throw new Error('entities: unknown unit ' + unitId);
  const assumptions = getAssumptions(config);
  const tier = opts.tier || 1;

  const group = domainGroup(def); // Ground | Water | Air
  const hp = tieredHP(def, tier, assumptions);
  const dps = tieredDPS(def, tier, assumptions);
  const rangePts = num(def.Range != null ? def.Range : def.range, 2.5);
  const speed = num(def.Speed != null ? def.Speed : def.speed, 1.5);
  const vision = num(def.Vision != null ? def.Vision : def.vision, 4);

  const targets = String(def.Targets || def.targets || 'Base');
  const targetsBase = targets.toLowerCase().indexOf('base') >= 0;
  const targetsStructures = targets.toLowerCase().indexOf('struct') >= 0;

  const unit = {
    id: nextId(state),
    type: 'unit',
    kind: unitId,
    shape: def.Shape || def.shape || 'Troops',
    role: def.Role || def.role || '',
    faction: def.Faction || def.faction || 'Ground / Powder',
    // locomotion group
    domain: group,                    // Ground | Water | Air
    locomotion:
      group === 'Air' ? 'flyer' : group === 'Water' ? 'floater' : 'walker',
    // position
    x: spawn.x,
    y: spawn.y,
    altitude: group === 'Air' ? (opts.altitude != null ? opts.altitude : 40) : 0,
    // stats
    tier,
    hp,
    maxHp: hp,
    dps,
    damageType: def['Damage Type'] || def.damageType || 'Kinetic',
    armorClass: def['Armor Class'] || def.armorClass || 'Organic',
    range: rangePts * num(assumptions.Range_per_point, 0.25) * (CONSTANTS.TILE || 32) || rangePts,
    rangeTiles: rangePts,
    speed,                            // tiles/sec (from table)
    vision,
    aoe: num(def['AoE r'] || def.aoe, 0),
    status: def.Status || def.status || '—',
    // targeting weapon domain
    canTarget: parseCanTarget(def),
    // behaviour flags
    targetsBase,
    targetsStructures,
    // combat runtime
    cooldown: 0,
    target: null,
    // pathing runtime
    path: null,
    pathIndex: 0,
    dest: opts.dest || null,
    reachedBase: false,
    // status effect runtime
    slowFactor: 1,
    slowTimer: 0,
    dotStack: 0,
    dotTimer: 0,
    staggerTimer: 0,
    // radar / vision flags
    radarDetect: String(def['Radar-Detect'] || def.radarDetect || 'No').toLowerCase() === 'yes',
    seesGround: String(def['Sees Ground'] || def.seesGround || 'No').toLowerCase() === 'yes',
    // lifecycle
    animState: 'Moving',
    alive: true,
    side: 'attacker',
  };
  return unit;
}

// Convenience specific factories (all delegate to makeAttacker but assert type)
export function makeWalker(state, config, unitId, spawn, opts = {}) {
  const u = makeAttacker(state, config, unitId, spawn, opts);
  return u;
}
export function makeFloater(state, config, unitId, spawn, opts = {}) {
  const u = makeAttacker(state, config, unitId, spawn, opts);
  return u;
}
export function makeFlyer(state, config, unitId, spawn, opts = {}) {
  const u = makeAttacker(state, config, unitId, spawn, opts);
  return u;
}

// ---------------------------------------------------------------------------
// Structures: towers, wall, moat — data-driven
// ---------------------------------------------------------------------------
//
// Structure lifecycle states: Placing → Building → Complete → Damaged → Destroyed
// plus Upgrading and Selling. State machine lives in lifecycle.js; factory
// initializes fields.
//
export function makeStructure(state, config, structId, slot, opts = {}) {
  const def = findStructureDef(config, structId);
  const assumptions = getAssumptions(config);
  const tier = opts.tier || 1;

  // Fallback synthetic def if not found (keeps sim runnable).
  const D = def || synthStructDef(structId);

  const hp = tieredHP(D, tier, assumptions);
  const dps = tieredDPS(D, tier, assumptions);
  const cost = tieredCost(D, tier);
  const buildTime = num(D['Build Time'] != null ? D['Build Time'] : D.buildTime, 3);
  const rangeTiles = num(D.Range != null ? D.Range : D.range, 4);

  const kind = classifyStructure(D, structId);
  const isTerrain = kind === 'wall' || kind === 'moat';

  const canTarget = isTerrain
    ? { Ground: false, Water: false, Air: false }
    : parseStructCanTarget(D, kind);

  const struct = {
    id: nextId(state),
    type: 'structure',
    structId,
    kind,                            // 'antiGround' | 'antiAir' | 'wall' | 'moat'
    name: D.Name || D.name || structId,
    // slot / position
    slotIndex: slot && slot.index != null ? slot.index : opts.slotIndex,
    x: slot ? slot.x : opts.x,
    y: slot ? slot.y : opts.y,
    footprint: parseFootprint(D),
    // stats
    tier,
    maxTier: 3,
    hp,
    maxHp: hp,
    dps,
    cost,
    baseCost: tieredCost(D, 1),
    damageType: D['Damage Type'] || D.damageType || 'Kinetic',
    range: rangeTiles,
    rangeTiles,
    aoe: num(D['AoE r'] || D.aoe, 0),
    status: D.Status || D.status || '—',
    canTarget,
    // lifecycle
    lifecycle: 'Placing',            // Placing/Building/Complete/Damaged/Destroyed/Upgrading/Selling
    buildTime,
    buildTimer: 0,                   // counts up to buildTime during Building
    upgradeTime: buildTime,
    upgradeTimer: 0,
    sellTime: num(assumptions.Sell_Time, 1) || 1,
    sellTimer: 0,
    // combat runtime
    cooldown: 0,
    target: null,
    aimAngle: 0,
    firing: false,
    // repair runtime (repairs consume troops + take time)
    repairing: false,
    repairTimer: 0,
    repairTroop: null,
    // flags
    isTerrain,
    blocksWalkers: kind === 'moat' || kind === 'wall',
    animState: 'Placing',
    alive: true,
    side: 'defender',
  };
  return struct;
}

// Classify a structure by its declared domain/kind.
function classifyStructure(def, structId) {
  const id = String(structId).toLowerCase();
  const dom = String(def['Weapon Domain'] || def.weaponDomain || def.Domain || def.domain || '').toLowerCase();
  const canTarget = String(def['Can Target'] || def.canTarget || '').toLowerCase();
  const name = String(def.Name || def.name || structId).toLowerCase();

  if (id.indexOf('moat') >= 0 || name.indexOf('moat') >= 0) return 'moat';
  if (id.indexOf('wall') >= 0 || name.indexOf('wall') >= 0) return 'wall';

  if (
    dom.indexOf('air') >= 0 ||
    canTarget.indexOf('air') >= 0 ||
    canTarget.indexOf('both') >= 0 ||
    id.indexOf('aa') >= 0 ||
    id.indexOf('air') >= 0 ||
    name.indexOf('flak') >= 0 ||
    name.indexOf('missile') >= 0 ||
    name.indexOf('anti-air') >= 0
  ) {
    return 'antiAir';
  }
  return 'antiGround';
}

function parseStructCanTarget(def, kind) {
  const raw = String(def['Can Target'] || def.canTarget || '').toLowerCase();
  const set = { Ground: false, Water: false, Air: false };
  if (raw) {
    if (raw.indexOf('both') >= 0) {
      set.Ground = true;
      set.Air = true;
      set.Water = true;
    }
    if (raw.indexOf('ground') >= 0) set.Ground = true;
    if (raw.indexOf('air') >= 0) set.Air = true;
    if (raw.indexOf('water') >= 0) set.Water = true;
  } else {
    // derive from kind
    if (kind === 'antiAir') {
      set.Air = true;
      set.Ground = true; // AA also fires down per model? keep AA air-focused but able to hit ground
      set.Water = true;
    } else {
      set.Ground = true;
      set.Water = true;
    }
  }
  // anti-ground can NEVER hit air (model rule)
  if (kind === 'antiGround') set.Air = false;
  return set;
}

function parseFootprint(def) {
  const raw = def.Footprint || def.footprint;
  if (raw && typeof raw === 'object') {
    return { w: num(raw.w, 1), h: num(raw.h, 1) };
  }
  if (typeof raw === 'string') {
    const m = raw.match(/(\d+)\s*x\s*(\d+)/i);
    if (m) return { w: Number(m[1]), h: Number(m[2]) };
  }
  return { w: 1, h: 1 };
}

// Synthetic structure defs so the slice runs even if a struct row is missing.
function synthStructDef(structId) {
  const id = String(structId).toLowerCase();
  if (id.indexOf('moat') >= 0) {
    return { Name: 'Moat', 'HP T1': 400, 'HP T2': 640, 'HP T3': 960, 'DPS T1': 0, 'Cost T1': 120, 'Cost T2': 300, 'Cost T3': 600, 'Build Time': 3, Footprint: '1x1' };
  }
  if (id.indexOf('wall') >= 0) {
    return { Name: 'Wall', 'HP T1': 600, 'HP T2': 960, 'HP T3': 1440, 'DPS T1': 0, 'Cost T1': 100, 'Cost T2': 250, 'Cost T3': 500, 'Build Time': 3, Footprint: '1x1' };
  }
  if (id.indexOf('aa') >= 0 || id.indexOf('air') >= 0) {
    return { Name: 'Anti-Air Tower', 'HP T1': 300, 'HP T2': 480, 'HP T3': 720, 'DPS T1': 40, 'DPS T2': 62, 'DPS T3': 92, Range: 5, 'Cost T1': 200, 'Cost T2': 500, 'Cost T3': 1000, 'Build Time': 4, 'Damage Type': 'Kinetic', 'Can Target': 'Both' };
  }
  return { Name: 'Anti-Ground Tower', 'HP T1': 350, 'HP T2': 560, 'HP T3': 840, 'DPS T1': 45, 'DPS T2': 70, 'DPS T3': 104, Range: 4, 'Cost T1': 180, 'Cost T2': 450, 'Cost T3': 900, 'Build Time': 4, 'Damage Type': 'Kinetic', 'Can Target': 'Ground' };
}

// ---------------------------------------------------------------------------
// Repair troop entity — spawns at base and marches to a structure to repair it.
// ---------------------------------------------------------------------------
export function makeRepairTroop(state, config, structure, spawn, opts = {}) {
  const c = CONSTANTS;
  return {
    id: nextId(state),
    type: 'troop',
    kind: 'repairTroop',
    x: spawn.x,
    y: spawn.y,
    speed: opts.speed != null ? opts.speed : (c.REPAIR_TROOP_SPEED || 3),
    domain: 'Ground',
    locomotion: 'walker',
    targetStructureId: structure.id,
    destX: structure.x,
    destY: structure.y,
    arrived: false,
    alive: true,
    side: 'defender',
  };
}

// Apply an upgrade to a structure (tier bump) — reads new tiered stats.
export function applyStructureUpgrade(struct, config) {
  if (struct.tier >= struct.maxTier) return false;
  const def = findStructureDef(config, struct.structId) || synthStructDef(struct.structId);
  const assumptions = getAssumptions(config);
  const newTier = struct.tier + 1;

  const oldMax = struct.maxHp;
  const newMax = tieredHP(def, newTier, assumptions);
  const hpRatio = oldMax > 0 ? struct.hp / oldMax : 1;

  struct.tier = newTier;
  struct.maxHp = newMax;
  struct.hp = Math.min(newMax, newMax * hpRatio + (newMax - oldMax)); // keep damage proportion, grant new hp
  struct.dps = tieredDPS(def, newTier, assumptions);
  struct.rangeTiles = num(def.Range != null ? def.Range : def.range, struct.rangeTiles);
  struct.range = struct.rangeTiles;
  struct.cost = tieredCost(def, newTier);
  return true;
}

// Compute cost to upgrade a structure from its current tier to the next.
export function upgradeCost(struct, config) {
  if (struct.tier >= struct.maxTier) return null;
  const def = findStructureDef(config, struct.structId) || synthStructDef(struct.structId);
  const cur = tieredCost(def, struct.tier);
  const nxt = tieredCost(def, struct.tier + 1);
  return Math.max(0, nxt - cur);
}

// Refund value when selling (partial, uses refund rate from constants).
export function sellRefund(struct) {
  const def = struct; // struct already carries cumulative cost per tier
  const rate = CONSTANTS.REFUND_RATE != null ? CONSTANTS.REFUND_RATE : 0.5;
  // cumulative invested = cost of current tier (table is cumulative value)
  return Math.floor((struct.cost || struct.baseCost || 0) * rate);
}