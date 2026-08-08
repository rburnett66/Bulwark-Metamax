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
// Physical footprint (cell units; a tile = 1). COLLISION = 75% OF THE SPRITE: the render draws units
// at radius × SPRITE_OVER_COLLISION (harness/parts.js, 4/3), so these radii are the collision
// half-widths — 25% inside the art, since frames carry padding and a touch of visual overlap before
// bodies collide reads natural. Separation/spawn spacing use these numbers.
// Owner 2026-07-20: HALVED from the old (~0.9–1.1) values — units render ~1 tile on the board, so the
// old radii drew a ~2-tile collision circle and jammed units in the 1-tile gaps between cliff/rock
// blocks (stuck + facing oscillation). These give a ~1-tile collision that fits single-file passages.
export const DEFAULT_UNIT_RADIUS = 0.42;

/**
 * Collision half-width for a unit def, in cell units.
 *
 * DDD-7: this used to `switch (def.shape)` — a DISPLAY string. Renaming a shape in tables.js silently
 * dropped every unit of that shape to the `default: 0.42` arm, which is a different collision circle,
 * a different separation field and a different path through a 1-tile gap. Radius is now an explicit
 * field on every unit def (see the capability block in tables.js) and this function only reads it.
 *
 * DEFAULT_UNIT_RADIUS is the floor for a def that declares nothing — never reached by shipped content:
 * data/unitCapabilities.test.mjs fails the build if any unit omits `radius`, so a new unit cannot
 * silently collapse to it the way a renamed one used to.
 *
 * @param {object} def unit def from tables.UNITS / SYSTEM_UNITS
 * @returns {number} collision half-width in cells
 */
export function unitRadius(def) {
  const r = def && def.radius;
  return (typeof r === 'number' && isFinite(r) && r > 0) ? r : DEFAULT_UNIT_RADIUS;
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
    // DISPLAY ONLY — the HUD's unit label. These two used to be load-bearing: `shape` was copied into
    // a field called `kind` (which on a STRUCTURE means 'antiGround'/'antiAir' — a completely different
    // namespace), and bonuses.js then tested that laundered value for the string 'Troops'. Grepping
    // `.shape` could not find it. Nothing may branch on either of these; every behaviour that used to
    // is now one of the capability fields below. See src/sim/nameIndependence.test.mjs.
    shape: def.shape,
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
    // Physical footprint in cell units — units cannot overlap, and this drives separation, pathfinding,
    // spawn spacing and contact. It is SIM DATA and it is read from the unit def.
    //
    // It used to be read from state.voxelRadii, which main.js built from the loaded VOXEL PACKS: the
    // pack's baked `collision` if present, otherwise an ESTIMATE of footprint x 0.5 x 0.4. That made an
    // art tool the author of a simulation input — a cosmetic re-bake in a browser changed separation and
    // pathing — and four of the five units with packs were running the estimate, diverging from this
    // table by -55% to +24%. Worse, serializeLog never carried voxelRadii, so a replay rebuilt with
    // DIFFERENT radii than the battle it was replaying and silently diverged.
    // Values were seeded from what that path produced, so ownership moved without balance moving.
    // Collision is intentionally COARSE at this stage (owner) — art is sized to match the radius, not
    // the other way round, so these are tuned in tables.js and never inferred from a pack again.
    radius: unitRadius(def),
    vision: def.vision,
    damageType: def.damageType,
    armorClass: def.armorClass,
    canTarget: def.canTarget, // 'Ground' | 'Air' | 'Both'
    targetsBase: def.targets === 'Base',
    targetsStructures: def.targets === 'Structures',
    aoeRadius: def.aoeRadius || 0,
    radarDetect: !!def.radarDetect,
    seesGround: !!def.seesGround,
    // ---- CAPABILITIES (DDD-7/9) — copied straight off the def, never inferred from a name.
    // May this attacker opportunistically fire on soft defenders (repair troops, harvesters)
    // already inside its weapon range? (combat.acquireSoftDefender)
    engagesSoftDefenders: def.engagesSoftDefenders === true,
    // The juggernaut rule: shoot the defences you pass, and keep marching while you do.
    // (combat.acquireTarget; the renderer also relaxes the turret's base-lock on it.)
    engagesStructuresWhileAdvancing: def.engagesStructuresWhileAdvancing === true,
    // The class the '+10% damage vs troops' wave bonus buffs. (bonuses.bonusDamageMult)
    isInfantry: def.isInfantry === true,
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