import { ASSUMPTIONS, getUnitDef, getStructureDef } from '../data/tables.js';

/**
 * Deterministic monotonically increasing entity id counter.
 * Stored on the SimState so replays produce identical ids.
 * @param {object} state SimState
 * @returns {number} fresh unique entity id
 */
export function nextEntityId(state) {
  if (typeof state._nextEntityId !== 'number' || !isFinite(state._nextEntityId)) {
    state._nextEntityId = 1;
  }
  const id = state._nextEntityId;
  state._nextEntityId = id + 1;
  return id;
}

/**
 * Instantiate a runtime unit record from the data tables.
 * No balance numbers are hardcoded here: everything comes from UNITS via getUnitDef.
 * @param {object} state SimState
 * @param {string} unitId table key, e.g. 'GND-Troops'
 * @param {1|2|3} tier upgrade tier (indexes hp/dps arrays)
 * @param {{x:number,y:number}} pos spawn position (board coordinates)
 * @param {'ground'|'water'|'air'} lane spawn lane
 * @param {'attacker'|'defender'} side owning side
 * @returns {object} Unit
 */
// Physical footprint per shape (cell units; a tile = 1). COLLISION = 75% OF THE SPRITE: the render
// draws units at radius × SPRITE_OVER_COLLISION (harness/parts.js, 4/3), so these radii are the
// collision half-widths — 25% inside the art, since frames carry padding and a touch of visual
// overlap before bodies collide reads natural. Separation/spawn spacing use these numbers.
// Owner 2026-07-20: HALVED from the old (~0.9–1.1) values — units render ~1 tile on the board, so the
// old radii drew a ~2-tile collision circle and jammed units in the 1-tile gaps between cliff/rock
// blocks (stuck + facing oscillation). These give a ~1-tile collision that fits single-file passages.
export function unitRadius(def) {
  switch (def && def.shape) {
    case 'Troops': return 0.38;
    case 'Trucks': return 0.42;
    case 'Artillery': return 0.42;
    case 'Tanks': return 0.46;
    case 'Heavy Tanks': return 0.50;
    case 'Copters': case 'Planes': case 'Missiles': return 0.42;
    default: return 0.42;
  }
}

export function createUnit(state, unitId, tier, pos, lane, side) {
  const def = getUnitDef(unitId);
  const t = Math.min(3, Math.max(1, tier | 0));
  const idx = t - 1;

  const hp = def.hp[idx];
  const dps = def.dps[idx];

  const unit = {
    id: nextEntityId(state),
    unitId: unitId,
    kind: def.shape,
    role: def.role,
    faction: def.faction,
    domain: def.domain, // 'Walker' | 'Floater' | 'Flyer'
    side: side,
    lane: lane,
    tier: t,
    pos: { x: pos.x, y: pos.y },
    altitude: def.domain === 'Flyer' ? 1 : 0,
    hp: hp,
    maxHp: hp,
    dps: dps,
    range: def.range,
    speed: def.speed,
    // physical footprint (cell units) — units can't overlap. Prefer the voxel-pack-derived radius (matches
    // the tank on screen); fall back to the shape table for non-voxel / headless units.
    radius: (state.voxelRadii && state.voxelRadii[def.artKey || unitId]) || unitRadius(def),
    vision: def.vision,
    damageType: def.damageType,
    armorClass: def.armorClass,
    canTarget: def.canTarget, // 'Ground' | 'Air' | 'Both'
    targetsBase: def.targets === 'Base',
    targetsStructures: def.targets === 'Structures',
    aoeRadius: def.aoeRadius || 0,
    radarDetect: !!def.radarDetect,
    seesGround: !!def.seesGround,
    costT1: def.cost[0],
    path: [],
    pathIdx: 0,
    targetId: null,
    cooldown: 0,
    slowUntil: 0,
    state: 'moving', // 'moving' | 'attacking' | 'idle' | 'dead' | 'repairing'
    alive: true,
  };
  return unit;
}

/**
 * Instantiate a runtime structure record from the data tables.
 * Starts in the 'Placing' lifecycle state; structures.js drives
 * Placing -> Building -> Complete -> Damaged -> Destroyed plus Upgrading/Selling.
 * @param {object} state SimState
 * @param {string} structId table key into STRUCTURES
 * @param {{x:number,y:number}} slot placement slot or cell
 * @returns {object} Structure
 */
export function createStructure(state, structId, slot) {
  const def = getStructureDef(structId);

  const hp = def.hp[0];

  const structure = {
    id: nextEntityId(state),
    structId: structId,
    name: def.name,
    kind: def.kind, // 'antiGround' | 'antiAir' | 'wall' | 'moat'
    pos: { x: slot.x, y: slot.y },
    footprint: { w: def.footprint.w, h: def.footprint.h },
    tier: 1,
    hp: hp,
    maxHp: hp,
    dps: def.dps[0],
    range: def.range,
    armorClass: def.armorClass,
    damageType: def.damageType,
    canTargetDomains: def.canTargetDomains.slice(),
    lifecycle: 'Placing', // 'Placing'|'Building'|'Complete'|'Damaged'|'Upgrading'|'Selling'|'Destroyed'
    progress: 0, // seconds accumulated toward current timed lifecycle phase
    buildTime: def.buildTime,
    upgradeTime: def.upgradeTime,
    sellTime: def.sellTime,
    targetId: null,
    cooldown: 0,
    invested: def.cost[0],
    repairPending: false,
    alive: true,
  };
  return structure;
}

/**
 * Instantiate the player base record from the map geometry.
 * Base HP comes from the map data (no hardcoded balance).
 * @param {object} map MAP table
 * @returns {object} Base
 */
export function createBase(map) {
  return {
    pos: { x: map.base.x, y: map.base.y },
    hp: map.base.hp,
    maxHp: map.base.hp,
    footprint: map.base.footprint || { w: 1, h: 1 },   // s10: 3x3 keep
    cells: (map.base.cells ? map.base.cells.map((c) => ({ x: c.x, y: c.y })) : null),
    lastDamageTick: -Infinity,                          // s10: for passive base repair
    armorClass: 'Structure',
    // Long-range SUPER CANNON: slow to aim + a slow arcing shell, so it only lands on a target that STAYS PUT
    // (the enemy's stationary siege/long-range units) — massive AOE. phase: idle → aim → flight → cooldown.
    cannon: { phase: 'idle', timer: 0, aimPos: null, shotFrom: null, shotDur: 0 },
  };
}

// Expose on the global namespace for the no-bundler build.
if (typeof window !== 'undefined') {
  window.Bulwark = window.Bulwark || {};
  window.Bulwark.sim = window.Bulwark.sim || {};
  window.Bulwark.sim.entities = {
    createUnit,
    createStructure,
    createBase,
    nextEntityId,
  };
}