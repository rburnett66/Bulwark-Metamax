// src/sim/movement.js
// Domain pathing: walker ground, floater water, flyer ignores terrain.
// Pure functions operating on strict sim state (mutating entity kinematics only).
// READ terrain from grid/pathfinding; produce per-tick movement toward destination.
//
// Determinism: no Math.random here; all motion is computed from state + dt.
// Rendering is NOT touched. This module only advances positions along the
// domain-appropriate route toward the base (or a deploy destination for troops).

/**
 * Domain constants (mirror config archetype domains).
 */
export const DOMAIN = {
  WALKER: 'Walker',
  FLOATER: 'Floater',
  FLYER: 'Flyer',
};

/**
 * Squared distance helper.
 */
function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/**
 * Move an entity a step of length `step` toward (tx,ty). Returns true if it
 * reached (or overshoots) the target this tick.
 */
function stepToward(ent, tx, ty, step) {
  const dx = tx - ent.x;
  const dy = ty - ent.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1e-9) {
    ent.x = tx;
    ent.y = ty;
    return true;
  }
  if (d <= step) {
    ent.x = tx;
    ent.y = ty;
    // preserve facing
    ent.heading = Math.atan2(dy, dx);
    return true;
  }
  const inv = step / d;
  ent.x += dx * inv;
  ent.y += dy * inv;
  ent.heading = Math.atan2(dy, dx);
  return false;
}

/**
 * Resolve the current active waypoint list for a unit given its domain and
 * destination. Walkers use the recomputed path (around walls/moats). Floaters
 * use the water lane centerline. Flyers use a straight line (ignore terrain).
 *
 * Expects:
 *   world.geometry: { groundLane:[{x,y}...], waterLane:[{x,y}...], base:{x,y}, ... }
 *   world.paths: { walkerPath:[{x,y}...] } (from pathfinding.js, recomputed on wall/moat change)
 *
 * Returns an array of {x,y} waypoints ending at the destination.
 */
export function resolveRoute(world, ent) {
  const geo = world.geometry || {};
  const base = geo.base || { x: 0, y: 0 };

  // Deploy destination override (troops marching to a drop order).
  const dest = ent.destination || base;

  switch (ent.domain) {
    case DOMAIN.FLYER: {
      // Flyers ignore terrain entirely: straight line to destination.
      return [{ x: dest.x, y: dest.y }];
    }
    case DOMAIN.FLOATER: {
      // Floaters follow the water lane centerline toward the base.
      const lane = geo.waterLane && geo.waterLane.length
        ? geo.waterLane
        : [{ x: ent.x, y: ent.y }, { x: dest.x, y: dest.y }];
      return laneRouteFrom(lane, ent, dest);
    }
    case DOMAIN.WALKER:
    default: {
      // Walkers use the recomputed navigation path (routes around walls/moats).
      // Prefer a per-entity cached path if valid; otherwise the shared walker path.
      const shared = (world.paths && world.paths.walkerPath) || null;
      if (shared && shared.length) {
        return sliceLaneAtEntity(shared, ent, dest);
      }
      const lane = geo.groundLane && geo.groundLane.length
        ? geo.groundLane
        : [{ x: ent.x, y: ent.y }, { x: dest.x, y: dest.y }];
      return laneRouteFrom(lane, ent, dest);
    }
  }
}

/**
 * Build a route from a lane polyline: find the nearest forward lane segment to
 * the entity, then continue along the lane to its end, then to the destination.
 */
function laneRouteFrom(lane, ent, dest) {
  const idx = nearestForwardIndex(lane, ent);
  const wps = [];
  for (let i = idx; i < lane.length; i++) {
    wps.push({ x: lane[i].x, y: lane[i].y });
  }
  // Ensure we finish at the destination (base or deploy point).
  const last = wps[wps.length - 1];
  if (!last || last.x !== dest.x || last.y !== dest.y) {
    wps.push({ x: dest.x, y: dest.y });
  }
  return wps;
}

/**
 * Same as laneRouteFrom but for the shared walker path (which already ends near
 * the base). Snaps entity onto the closest forward node.
 */
function sliceLaneAtEntity(path, ent, dest) {
  const idx = nearestForwardIndex(path, ent);
  const wps = [];
  for (let i = idx; i < path.length; i++) {
    wps.push({ x: path[i].x, y: path[i].y });
  }
  const last = wps[wps.length - 1];
  if (!last || last.x !== dest.x || last.y !== dest.y) {
    wps.push({ x: dest.x, y: dest.y });
  }
  return wps.length ? wps : [{ x: dest.x, y: dest.y }];
}

/**
 * Find the index of the lane node the entity should aim for next. We choose the
 * node closest to the entity, but never go backward: bias toward later nodes.
 */
function nearestForwardIndex(lane, ent) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < lane.length; i++) {
    const d = dist2(ent.x, ent.y, lane[i].x, lane[i].y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // If we're essentially on the closest node, target the next one so we keep
  // making forward progress along the lane.
  if (best < lane.length - 1 && bestD < 0.25 * 0.25) {
    best += 1;
  }
  return best;
}

/**
 * Advance a single mobile unit one fixed tick.
 *
 * @param {object} world  strict sim state (read-only geometry/paths)
 * @param {object} ent    a unit entity (walker/floater/flyer)
 * @param {number} dt     fixed timestep in seconds
 */
export function moveUnit(world, ent, dt) {
  if (!ent || ent.dead) return;
  if (ent.hp !== undefined && ent.hp <= 0) return;

  // Staggered / disabled units cannot move this tick.
  if (ent.staggerTimer && ent.staggerTimer > 0) {
    ent.moveState = 'Idle';
    return;
  }

  const geo = world.geometry || {};
  const base = geo.base || { x: 0, y: 0 };
  const dest = ent.destination || base;

  // Frost / chill slow modifier (applies to all EXCEPT air units per design).
  let speed = ent.speed || 0;
  if (ent.chillTimer && ent.chillTimer > 0 && ent.domain !== DOMAIN.FLYER) {
    speed *= ent.chillFactor != null ? ent.chillFactor : 0.5;
  }

  // If the unit is within its attack range of its target destination, it stops
  // to attack rather than piling into the base position.
  const reach = (ent.range != null ? ent.range : 0) + (ent.stopPadding || 0);
  const arriveR = Math.max(reach, ent.arriveRadius || 0.1);

  const dToDest = Math.hypot(dest.x - ent.x, dest.y - ent.y);
  if (dToDest <= arriveR) {
    ent.arrived = true;
    ent.moveState = 'Attacking';
    // Face the destination while stationary.
    ent.heading = Math.atan2(dest.y - ent.y, dest.x - ent.x);
    return;
  }
  ent.arrived = false;

  // Build/refresh route. Cache is invalidated when the path version changes
  // (pathfinding bumps world.paths.version when walls/moats move).
  const pathVersion = (world.paths && world.paths.version) || 0;
  if (
    !ent._route ||
    ent._routeVersion !== pathVersion ||
    ent._routeDomain !== ent.domain ||
    ent._routeDestX !== dest.x ||
    ent._routeDestY !== dest.y
  ) {
    ent._route = resolveRoute(world, ent);
    ent._routeIndex = 0;
    ent._routeVersion = pathVersion;
    ent._routeDomain = ent.domain;
    ent._routeDestX = dest.x;
    ent._routeDestY = dest.y;
  }

  const route = ent._route;
  if (!route || !route.length) {
    // Fallback: straight to destination.
    stepToward(ent, dest.x, dest.y, speed * dt);
    ent.moveState = speed > 0 ? 'Moving' : 'Idle';
    return;
  }

  let budget = speed * dt;
  ent.moveState = budget > 0 ? 'Moving' : 'Idle';

  // Consume the movement budget across waypoints this tick.
  let guard = 0;
  while (budget > 1e-9 && ent._routeIndex < route.length) {
    const wp = route[ent._routeIndex];
    const dx = wp.x - ent.x;
    const dy = wp.y - ent.y;
    const d = Math.hypot(dx, dy);

    if (d <= 1e-9) {
      ent._routeIndex++;
    } else if (d <= budget) {
      ent.x = wp.x;
      ent.y = wp.y;
      ent.heading = Math.atan2(dy, dx);
      budget -= d;
      ent._routeIndex++;
    } else {
      const inv = budget / d;
      ent.x += dx * inv;
      ent.y += dy * inv;
      ent.heading = Math.atan2(dy, dx);
      budget = 0;
    }

    if (++guard > 4096) break; // safety against degenerate routes
  }

  // Altitude handling for flyers (kinematic settle toward cruise altitude).
  if (ent.domain === DOMAIN.FLYER) {
    const cruise = ent.cruiseAltitude != null ? ent.cruiseAltitude : 3;
    if (ent.altitude == null) ent.altitude = cruise;
    const climb = (ent.climbRate != null ? ent.climbRate : 4) * dt;
    if (ent.altitude < cruise) {
      ent.altitude = Math.min(cruise, ent.altitude + climb);
    } else if (ent.altitude > cruise) {
      ent.altitude = Math.max(cruise, ent.altitude - climb);
    }
  } else {
    ent.altitude = 0;
  }

  // Submersion flag for floaters/swimmers (read-only presentation hint).
  if (ent.domain === DOMAIN.FLOATER) {
    ent.submerged = !!ent.swimmer;
  }
}

/**
 * Advance all mobile attacker units for one tick.
 * Called from step.js after targeting/combat resolution.
 *
 * @param {object} world  strict sim state
 * @param {number} dt     fixed timestep in seconds
 */
export function stepMovement(world, dt) {
  const units = world.units || [];
  for (let i = 0; i < units.length; i++) {
    const ent = units[i];
    if (!ent) continue;
    // Only mobile attacker entities move; structures/base do not.
    if (ent.kind === 'structure' || ent.kind === 'base') continue;
    if (ent.dead || (ent.hp !== undefined && ent.hp <= 0)) continue;
    moveUnit(world, ent, dt);
  }
}

/**
 * Invalidate cached routes across all units (call when the walker path is
 * recomputed due to wall/moat placement so the change is visible immediately).
 */
export function invalidateRoutes(world) {
  const units = world.units || [];
  for (let i = 0; i < units.length; i++) {
    const ent = units[i];
    if (ent) ent._route = null;
  }
  if (world.paths) {
    world.paths.version = (world.paths.version || 0) + 1;
  }
}

export default {
  DOMAIN,
  resolveRoute,
  moveUnit,
  stepMovement,
  invalidateRoutes,
};