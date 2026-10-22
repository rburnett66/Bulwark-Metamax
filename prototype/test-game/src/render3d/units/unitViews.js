/**
 * src/render3d/units/unitViews.js — sim units → what the 3D view draws (plan v2.2.1 §6.3). READ-ONLY on the sim.
 *
 * For each live unit: which model (modelKeys.js), where (world = cell + 0.5), how high (flyers hover), which
 * way the hull faces (motion-derived heading, heading.js) and where the turret points (at the unit's current
 * target when it has one — another unit, a structure, or the base — else along the hull).
 *
 * Pure: no three.js, no DOM. [MM-story_mv77hv5d_7]
 */
import { cellToWorld } from '../camera.js';
import { resolveUnitModel, modelIdOf } from './modelKeys.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';
import { getUnitDef } from '../../data/tables.js';

export const HOVER_HEIGHT = 1.1;   // cells (code design §4.11)

/** Cache of unitId → resolved model; an unknown id resolves through the domain default, never throws. */
export function createModelResolver(lookup = getUnitDef) {
  const cache = new Map();
  return (unitId) => {
    let r = cache.get(unitId);
    if (!r) {
      let def = null;
      try { def = lookup(unitId); } catch (e) { def = null; }
      r = resolveUnitModel(unitId, def);
      cache.set(unitId, r);
    }
    return r;
  };
}

/** Position the turret should face, or null to face along the hull. */
export function targetPos(state, map, targetId) {
  if (targetId === null || targetId === undefined) return null;
  if (targetId === BASE_TARGET_ID) return map && map.base ? { x: map.base.x, y: map.base.y } : null;
  const t = (state.units && state.units.get(targetId)) || (state.structures && state.structures.get(targetId));
  return t && t.pos ? t.pos : null;
}

/**
 * Build the draw list. `headings` is a heading.js tracker (presentation state, swept of dead ids here).
 * `dt` (seconds since the last frame) eases hull + turret toward their goals at capped turn rates; omit it
 * to snap. Returns [{ id, model, scale, x, y, z, heading, aim }] in world units — DRAWN angles.
 */
export function buildUnitViews(state, map, headings, resolve, dt, drawn = null) {
  const out = [];
  if (!state || !state.units) return out;
  const live = new Set();
  for (const u of state.units.values()) {
    if (!u || !u.pos) continue;
    live.add(u.id);
    const r = resolve(modelIdOf(u));   // artKey first: harvesters are GND-Trucks drawn as the System miner
    // ground units DRIVE: the drawn unit chases the sim one along its hull — steers through moderate bends, pivots on
    // the spot for sharp ones, never slides sideways (heading.js drive) [MM-story_mvekcu8r_n]. Flyers keep the sim spot.
    const ground = !(u.altitude > 0) && u.domain !== 'Flyer' && headings.drive;
    const d = ground ? headings.drive(u.id, u.pos.x, u.pos.y, dt) : null;
    const px = d ? d.x : u.pos.x, py = d ? d.y : u.pos.y;
    const goal = d ? d.heading : headings.update(u.id, u.pos.x, u.pos.y);
    // a plane on an attack run (or a driven ground unit) is aimed at where it is DRAWN, so turrets track the drawn unit
    const dp = drawn && u.targetId != null ? drawn.get(u.targetId) : null;
    const tp = dp ? { x: dp.x - 0.5, y: dp.z - 0.5 } : targetPos(state, map, u.targetId);
    const { heading, aim } = headings.turn(u.id, goal, tp ? Math.atan2(tp.y - py, tp.x - px) : goal, dt, !!d);
    out.push({
      id: u.id, unitId: u.unitId, model: r.model, scale: r.scale,   // unitId: its faction colours its impact fx [MM-story_mviqruvd_2]
      x: cellToWorld(px), z: cellToWorld(py), y: u.altitude > 0 ? HOVER_HEIGHT : 0,
      heading, aim,
    });
  }
  headings.sweep(live);
  return out;
}
