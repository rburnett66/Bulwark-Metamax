package com.bulwark;

Sorry, let me focus on the actual file requested.

```
```

Here is `src/sim/entities.js`:

import { statMath } from './statMath.js';

let __eidCounter = 0;
function nextId(prefix) {
  __eidCounter += 1;
  return `${prefix}_${__eidCounter}`;
}

export function resetEntityIds() {
  __eidCounter = 0;
}

// ---------------------------------------------------------------------------
// PLAYER BASE
// ---------------------------------------------------------------------------
export function createBase(config, geometry) {
  const g = geometry || {};
  const pos = g.base ? { x: g.base.x, y: g.base.y } : { x: 0, y: 0 };
  const level = 1;
  const maxHp = (config && config.data && config.data.tables && config.data.tables.baseHp) || 5000;
  return {
    id: nextId('base'),
    type: 'base',
    kind: 'base',
    x: pos.x,
    y: pos.y,
    level,
    hp: maxHp,
    maxHp,
    alive: true,
  };
}

// ---------------------------------------------------------------------------
// UNIT FACTORIES (walker / floater / flyer)
// ---------------------------------------------------------------------------

function lookupUnitDef(config, unitId) {
  const tables = config && config.data && config.data.tables;
  if (!tables) return null;
  const units = tables.units || [];
  return units.find((u) => u.UnitID === unitId || u.id === unitId) || null;
}

// Derive full runtime stats for a unit at a given tier from the data tables,
// using statMath (no hardcoded balance).
function deriveUnitStats(config, def, tier) {
  return statMath.deriveUnit(config, def, tier);
}

// Domain classification helpers
function domainOf(def) {
  const d = (def.Domain || def.domain || 'Walker').toLowerCase();
  if (d.indexOf('fly') >= 0 || d === 'flyer' || d === 'air') return 'flyer';
  if (d.indexOf('water') >= 0 || d === 'floater' || d === 'swimmer') return 'floater';
  return 'walker';
}

// Base unit shell shared by all attacker units.
function baseUnit(config, def, tier, opts) {
  const stats = deriveUnitStats(config, def, tier);
  const domain = domainOf(def);
  const targetsBase = (def.Targets || def.targets || 'Base').toLowerCase().indexOf('struct') < 0;
  const canTargetRaw = (def['Can Target'] || def.canTarget || 'Ground');
  const ct = String(canTargetRaw).toLowerCase();
  const canHitAir = ct.indexOf('both') >= 0 || ct.indexOf('air') >= 0;
  const canHitGround = ct.indexOf('both') >= 0 || ct.indexOf('ground') >= 0;

  return {
    id: nextId(domain),
    type: 'unit',
    unitId: def.UnitID || def.id,
    kind: def.Shape || def.shape || 'unit',
    faction: def.Faction || def.faction || 'Ground / Powder',
    domain,
    armorClass: def['Armor Class'] || def.armorClass || 'Organic',
    damageType: def['Damage Type'] || def.damageType || 'Kinetic',
    tier: tier || 1,

    x: opts && opts.x != null ? opts.x : 0,
    y: opts && opts.y != null ? opts.y : 0,
    altitude: 0,

    hp: stats.hp,
    maxHp: stats.hp,
    dps: stats.dps,
    range: stats.range,
    speed: stats.speed,
    vision: stats.vision,
    aoe: Number(def['AoE r'] || def.aoe || 0),
    status: def.Status && def.Status !== '—' ? def.Status : null,

    // targeting flags
    targetsBase,
    targetsStructures: !targetsBase,
    canHitAir,
    canHitGround,
    radarDetect: String(def['Radar-Detect'] || def.radarDetect || 'No').toLowerCase() === 'yes',
    seesGround: String(def['Sees Ground'] || def.seesGround || 'No').toLowerCase() === 'yes',

    // movement / path state
    path: null,
    pathIndex: 0,
    waypoint: null,

    // combat state
    target: null,
    cooldown: 0,
    fireInterval: stats.fireInterval || 1,

    animState: 'moving',
    alive: true,
  };
}

export function createWalker(config, geometry, unitId, tier, opts) {
  const def = lookupUnitDef(config, unitId);
  if (!def) throw new Error(`Unknown unit id: ${unitId}`);
  const g = geometry || {};
  const spawn = g.groundSpawn || { x: 0, y: 0 };
  const u = baseUnit(config, def, tier, {
    x: opts && opts.x != null ? opts.x : spawn.x,
    y: opts && opts.y != null ? opts.y : spawn.y,
  });
  u.domain = 'walker';
  u.altitude = 0;
  return u;
}

export function createFloater(config, geometry, unitId, tier, opts) {
  const def = lookupUnitDef(config, unitId);
  if (!def) throw new Error(`Unknown unit id: ${unitId}`);
  const g = geometry || {};
  const spawn = g.waterSpawn || { x: 0, y: 0 };
  const u = baseUnit(config, def, tier, {
    x: opts && opts.x != null ? opts.x : spawn.x,
    y: opts && opts.y != null ? opts.y : spawn.y,
  });
  u.domain = 'floater';
  u.altitude = 0;
  u.submerged = String((def.Role || '')).toLowerCase().indexOf('sub') >= 0;
  return u;
}

export function createFlyer(config, geometry, unitId, tier, opts) {
  const def = lookupUnitDef(config, unitId);
  if (!def) throw new Error(`Unknown unit id: ${unitId}`);
  const g = geometry || {};
  const spawn = g.groundSpawn || { x: 0, y: 0 };
  const u = baseUnit(config, def, tier, {
    x: opts && opts.x != null ? opts.x : spawn.x,
    y: opts && opts.y != null ? opts.y : spawn.y,
  });
  u.domain = 'flyer';
  u.altitude = (opts && opts.altitude != null) ? opts.altitude : 3;
  return u;
}

// Generic dispatcher based on the unit's domain in the data table.
export function createUnit(config, geometry, unitId, tier, opts) {
  const def = lookupUnitDef(config, unitId);
  if (!def) throw new Error(`Unknown unit id: ${unitId}`);
  const domain = domainOf(def);
  if (domain === 'flyer') return createFlyer(config, geometry, unitId, tier, opts);
  if (domain === 'floater') return createFloater(config, geometry, unitId, tier, opts);
  return createWalker(config, geometry, unitId, tier, opts);
}

// Deployed troop (player-controlled march). Spawns at base, marches to drop.
export function createTroop(config, geometry, unitId, tier, dropPoint) {
  const u = createUnit(config, geometry, unitId, tier, {
    x: geometry && geometry.base ? geometry.base.x : 0,
    y: geometry && geometry.base ? geometry.base.y : 0,
  });
  u.type = 'troop';
  u.owner = 'player';
  u.dropPoint = dropPoint ? { x: dropPoint.x, y: dropPoint.y } : null;
  u.marching = true;
  u.deployed = false;
  return u;
}

// ---------------------------------------------------------------------------
// STRUCTURE FACTORIES (towers / wall / moat)
// ---------------------------------------------------------------------------

function lookupStructureDef(config, structId) {
  const tables = config && config.data && config.data.tables;
  if (!tables) return null;
  const structs = tables.structures || [];
  return structs.find((s) => s.StructID === structId || s.id === structId) || null;
}

function deriveStructureStats(config, def, tier) {
  return statMath.deriveStructure(config, def, tier);
}

function structureCanTarget(def) {
  const ct = String(def['Can Target'] || def.canTarget || 'Ground').toLowerCase();
  const domainTheme = String(def.Domain || def.domain || '').toLowerCase();
  const isAntiAir =
    ct.indexOf('air') >= 0 ||
    ct.indexOf('both') >= 0 ||
    domainTheme.indexOf('air') >= 0 ||
    String(def.Role || def.role || '').toLowerCase().indexOf('anti-air') >= 0 ||
    String(def.Role || def.role || '').toLowerCase().indexOf('aa') >= 0;
  const isAntiGround =
    ct.indexOf('ground') >= 0 ||
    ct.indexOf('both') >= 0 ||
    (!isAntiAir);
  return { canHitAir: !!isAntiAir, canHitGround: !!isAntiGround };
}

export function createTower(config, geometry, structId, tier, slot) {
  const def = lookupStructureDef(config, structId);
  if (!def) throw new Error(`Unknown structure id: ${structId}`);
  const stats = deriveStructureStats(config, def, tier || 1);
  const tt = structureCanTarget(def);
  const pos = slot
    ? { x: slot.x, y: slot.y }
    : { x: 0, y: 0 };

  return {
    id: nextId('tower'),
    type: 'structure',
    structClass: 'tower',
    structId: def.StructID || def.id,
    kind: def.Name || def.name || structId,
    x: pos.x,
    y: pos.y,
    slotId: slot ? slot.id : null,
    footprint: { w: 1, h: 1 },

    tier: tier || 1,
    hp: stats.hp,
    maxHp: stats.hp,
    dps: stats.dps,
    range: stats.range,
    fireInterval: stats.fireInterval || 1,
    damageType: def['Damage Type'] || def.damageType || 'Kinetic',
    armorClass: def['Armor Class'] || def.armorClass || 'Structure',
    aoe: Number(def['AoE r'] || def.aoe || 0),

    canHitAir: tt.canHitAir,
    canHitGround: tt.canHitGround,

    cost: stats.cost,
    upgradeCost: stats.upgradeCost || null,
    sellRefund: stats.sellRefund,
    buildTime: stats.buildTime || 1,

    // lifecycle FSM
    lifecycle: 'Placing',
    buildTimer: 0,
    upgradeTimer: 0,
    sellTimer: 0,

    // combat
    target: null,
    cooldown: 0,
    aimAngle: 0,
    animState: 'placing',

    // repair
    repairing: false,
    repairTimer: 0,
    assignedTroop: null,

    alive: true,
  };
}

export function createWall(config, geometry, structId, tier, cell) {
  const def = lookupStructureDef(config, structId) || {
    StructID: structId,
    Name: 'Wall',
  };
  const stats = deriveStructureStats(config, def, tier || 1);
  return {
    id: nextId('wall'),
    type: 'structure',
    structClass: 'wall',
    structId: def.StructID || def.id || structId,
    kind: def.Name || def.name || 'Wall',
    x: cell ? cell.x : 0,
    y: cell ? cell.y : 0,
    cell: cell ? { col: cell.col, row: cell.row } : null,
    footprint: { w: 1, h: 1 },

    tier: tier || 1,
    hp: stats.hp,
    maxHp: stats.hp,
    dps: 0,
    range: 0,
    canHitAir: false,
    canHitGround: false,

    cost: stats.cost,
    upgradeCost: stats.upgradeCost || null,
    sellRefund: stats.sellRefund,
    buildTime: stats.buildTime || 1,

    blocksWalkers: true,
    terrain: 'wall',

    lifecycle: 'Placing',
    buildTimer: 0,
    upgradeTimer: 0,
    sellTimer: 0,

    repairing: false,
    repairTimer: 0,
    assignedTroop: null,

    animState: 'placing',
    alive: true,
  };
}

export function createMoat(config, geometry, structId, tier, cell) {
  const def = lookupStructureDef(config, structId) || {
    StructID: structId,
    Name: 'Moat',
  };
  const stats = deriveStructureStats(config, def, tier || 1);
  const m = {
    id: nextId('moat'),
    type: 'structure',
    structClass: 'moat',
    structId: def.StructID || def.id || structId,
    kind: def.Name || def.name || 'Moat',
    x: cell ? cell.x : 0,
    y: cell ? cell.y : 0,
    cell: cell ? { col: cell.col, row: cell.row } : null,
    footprint: { w: 1, h: 1 },

    tier: tier || 1,
    hp: stats.hp || 99999,
    maxHp: stats.hp || 99999,
    dps: 0,
    range: 0,
    canHitAir: false,
    canHitGround: false,

    cost: stats.cost,
    upgradeCost: stats.upgradeCost || null,
    sellRefund: stats.sellRefund,
    buildTime: stats.buildTime || 1,

    blocksWalkers: true,
    terrain: 'moat',

    lifecycle: 'Placing',
    buildTimer: 0,
    upgradeTimer: 0,
    sellTimer: 0,

    repairing: false,
    repairTimer: 0,
    assignedTroop: null,

    animState: 'placing',
    alive: true,
  };
  return m;
}

// Generic structure dispatcher — reads structClass from the data table.
export function createStructure(config, geometry, structId, tier, placement) {
  const def = lookupStructureDef(config, structId);
  const cls = def
    ? String(def.Class || def.class || def.structClass || '').toLowerCase()
    : (structId.toLowerCase().indexOf('moat') >= 0
        ? 'moat'
        : structId.toLowerCase().indexOf('wall') >= 0
          ? 'wall'
          : 'tower');

  if (cls === 'wall') return createWall(config, geometry, structId, tier, placement);
  if (cls === 'moat') return createMoat(config, geometry, structId, tier, placement);
  return createTower(config, geometry, structId, tier, placement);
}

export function isStructure(e) {
  return e && e.type === 'structure';
}
export function isTower(e) {
  return e && e.structClass === 'tower';
}
export function isTerrain(e) {
  return e && (e.structClass === 'wall' || e.structClass === 'moat');
}
export function isUnit(e) {
  return e && (e.type === 'unit' || e.type === 'troop');
}

export const entities = {
  resetEntityIds,
  createBase,
  createUnit,
  createWalker,
  createFloater,
  createFlyer,
  createTroop,
  createStructure,
  createTower,
  createWall,
  createMoat,
  isStructure,
  isTower,
  isTerrain,
  isUnit,
};

export default entities;