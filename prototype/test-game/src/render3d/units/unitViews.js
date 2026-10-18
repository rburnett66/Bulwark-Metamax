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
import { resolveUnitModel } from './modelKeys.js';
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
    const r = resolve(u.unitId);
    const goal = headings.update(u.id, u.pos.x, u.pos.y);
    // a plane on an attack run is aimed at where it is DRAWN (flightPath.js), so turrets track the drawn plane
    const dp = drawn && u.targetId != null ? drawn.get(u.targetId) : null;
    const tp = dp ? { x: dp.x - 0.5, y: dp.z - 0.5 } : targetPos(state, map, u.targetId);
    const { heading, aim } = headings.turn(u.id, goal, tp ? Math.atan2(tp.y - u.pos.y, tp.x - u.pos.x) : goal, dt);
    out.push({
      id: u.id, model: r.model, scale: r.scale,
      x: cellToWorld(u.pos.x), z: cellToWorld(u.pos.y), y: u.altitude > 0 ? HOVER_HEIGHT : 0,
      heading, aim,
    });
  }
  headings.sweep(live);
  return out;
}
