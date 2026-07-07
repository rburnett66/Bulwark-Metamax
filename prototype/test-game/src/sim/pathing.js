// src/sim/pathing.js
// Walker path recompute around walls/moats; floater/flyer domain routing.
//
// This module is responsible for producing movement paths for attacker units
// based on their domain:
//   - Walker  : follows the ground lane, must route around wall/moat footprints
//   - Floater : follows the water lane (submerged/surface swimmers)
//   - Flyer   : ignores terrain entirely, straight to destination
//
// The pathing is deterministic: given identical board + blocker state it always
// produces identical waypoint lists. All math uses stable ordering so replays
// hash identically.
//
// State access is read-only against terrain/board; it returns waypoint arrays.

// -----------------------------------------------------------------------------
// Small deterministic helpers
// -----------------------------------------------------------------------------

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// -----------------------------------------------------------------------------
// Blocker collection
// -----------------------------------------------------------------------------
//
// Walls and moats present rectangular footprints on the ground lane that block
// walker travel. We collect them into AABB rectangles (in world/tile coords).
// A structure counts as a blocker if:
//   - it is a wall or moat (terrain piece), OR
//   - it is any other completed/building structure with a footprint that a
//     walker would treat as a hazard (walkers path *around* structures).
//
// The blocker's footprint is expanded slightly by the walker radius so the
// path clears it visibly.

function collectWalkerBlockers(state, walkerRadius) {
  const blockers = [];
  const ents = state.entities || [];
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (!e || !e.alive) continue;
    const t = e.type;
    const isTerrain = t === 'wall' || t === 'moat';
    const isStructure =
      t === 'towerGround' || t === 'towerAir' || t === 'tower' ||
      t === 'structure';
    if (!isTerrain && !isStructure) continue;
    if (e.lifecycle === 'Destroyed' || e.lifecycle === 'Selling') {
      // being removed; only skip fully destroyed
      if (e.lifecycle === 'Destroyed') continue;
    }
    const fw = (e.footprint && e.footprint.w) || e.w || 1;
    const fh = (e.footprint && e.footprint.h) || e.h || 1;
    const r = walkerRadius + 0.15;
    blockers.push({
      minX: e.x - fw / 2 - r,
      maxX: e.x + fw / 2 + r,
      minY: e.y - fh / 2 - r,
      maxY: e.y + fh / 2 + r,
      cx: e.x,
      cy: e.y,
      id: e.id,
    });
  }
  // deterministic ordering by id
  blockers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return blockers;
}

// -----------------------------------------------------------------------------
// Segment / rectangle intersection
// -----------------------------------------------------------------------------

function segIntersectsAABB(p0, p1, box) {
  // Liang–Barsky clipping against AABB. Returns true if segment intersects box.
  let t0 = 0;
  let t1 = 1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  const edges = [
    { p: -dx, q: p0.x - box.minX },
    { p: dx, q: box.maxX - p0.x },
    { p: -dy, q: p0.y - box.minY },
    { p: dy, q: box.maxY - p0.y },
  ];

  for (let i = 0; i < edges.length; i++) {
    const { p, q } = edges[i];
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false; // parallel and outside
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function segmentBlocked(p0, p1, blockers) {
  for (let i = 0; i < blockers.length; i++) {
    if (segIntersectsAABB(p0, p1, blockers[i])) return true;
  }
  return false;
}

function pointInBlockers(p, blockers) {
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    if (p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY) {
      return true;
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// Waypoint graph pathing (deterministic A* on candidate corner nodes)
// -----------------------------------------------------------------------------
//
// We build a node set: start, goal, and the four (expanded) corners of each
// blocker. We connect any two nodes whose straight segment is unobstructed,
// then run A* for the shortest visible path. This gives a visible reroute
// around walls/moats while staying fully deterministic.

function blockerCorners(box) {
  const pad = 0.05;
  return [
    { x: box.minX - pad, y: box.minY - pad },
    { x: box.maxX + pad, y: box.minY - pad },
    { x: box.minX - pad, y: box.maxY + pad },
    { x: box.maxX + pad, y: box.maxY + pad },
  ];
}

function buildNodes(start, goal, blockers, bounds) {
  const nodes = [{ x: start.x, y: start.y }];
  for (let i = 0; i < blockers.length; i++) {
    const corners = blockerCorners(blockers[i]);
    for (let c = 0; c < corners.length; c++) {
      let n = corners[c];
      // clamp to bounds
      n = {
        x: clamp(n.x, bounds.minX, bounds.maxX),
        y: clamp(n.y, bounds.minY, bounds.maxY),
      };
      // skip corner nodes that lie inside another blocker
      if (!pointInBlockers(n, blockers)) {
        nodes.push(n);
      }
    }
  }
  nodes.push({ x: goal.x, y: goal.y });
  return nodes;
}

function astar(nodes, blockers) {
  const n = nodes.length;
  const startIdx = 0;
  const goalIdx = n - 1;

  const g = new Array(n).fill(Infinity);
  const f = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const closed = new Array(n).fill(false);

  g[startIdx] = 0;
  f[startIdx] = dist(nodes[startIdx], nodes[goalIdx]);

  const open = [startIdx];

  while (open.length > 0) {
    // pick lowest f (linear scan; small node counts) — deterministic tie-break by index
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (
        f[open[i]] < f[open[best]] - 1e-9 ||
        (Math.abs(f[open[i]] - f[open[best]]) < 1e-9 && open[i] < open[best])
      ) {
        best = i;
      }
    }
    const current = open[best];
    open.splice(best, 1);

    if (current === goalIdx) break;
    if (closed[current]) continue;
    closed[current] = true;

    for (let j = 0; j < n; j++) {
      if (j === current || closed[j]) continue;
      if (segmentBlocked(nodes[current], nodes[j], blockers)) continue;
      const tentative = g[current] + dist(nodes[current], nodes[j]);
      if (tentative < g[j] - 1e-9) {
        prev[j] = current;
        g[j] = tentative;
        f[j] = tentative + dist(nodes[j], nodes[goalIdx]);
        if (!open.includes(j)) open.push(j);
      }
    }
  }

  if (prev[goalIdx] === -1 && goalIdx !== startIdx) {
    // no visible path found; fall back to direct
    return null;
  }

  // reconstruct
  const path = [];
  let cur = goalIdx;
  while (cur !== -1) {
    path.push({ x: nodes[cur].x, y: nodes[cur].y });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

// Compute a walker path from `from` to `to`, routing around wall/moat blockers.
// Returns an array of waypoints (world coords), starting near `from` and ending
// at `to`. Always at least [to].
export function computeWalkerPath(state, from, to, opts) {
  opts = opts || {};
  const walkerRadius = opts.radius != null ? opts.radius : 0.4;
  const board = state.board || {};
  const bounds = board.bounds || {
    minX: -1e6,
    maxX: 1e6,
    minY: -1e6,
    maxY: 1e6,
  };

  const start = { x: from.x, y: from.y };
  const goal = { x: to.x, y: to.y };

  const blockers = collectWalkerBlockers(state, walkerRadius);

  // Direct line-of-sight shortcut
  if (blockers.length === 0 || !segmentBlocked(start, goal, blockers)) {
    return [{ x: goal.x, y: goal.y }];
  }

  const nodes = buildNodes(start, goal, blockers, bounds);
  const path = astar(nodes, blockers);

  if (!path) {
    // No route (fully walled off) — best effort: head toward goal anyway.
    return [{ x: goal.x, y: goal.y }];
  }

  // Drop the start node; movement code already starts at `from`.
  const waypoints = path.slice(1);
  if (waypoints.length === 0) waypoints.push({ x: goal.x, y: goal.y });
  return waypoints;
}

// Floater path: follow the water lane spine toward the destination.
// The water lane is a polyline (board.waterLane.points) leading to the base.
// We project the destination onto the lane and return lane waypoints up to it.
export function computeFloaterPath(state, from, to) {
  const board = state.board || {};
  const lane = board.waterLane;
  const goal = { x: to.x, y: to.y };

  if (!lane || !lane.points || lane.points.length < 2) {
    return [{ x: goal.x, y: goal.y }];
  }

  const pts = lane.points;

  // Find the lane segment closest to `from` to determine entry index.
  let startSeg = 0;
  let bestFrom = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegDist(from, pts[i], pts[i + 1]);
    if (d < bestFrom - 1e-9) {
      bestFrom = d;
      startSeg = i;
    }
  }

  // Find lane segment closest to `to` (destination) to determine exit index.
  let endSeg = pts.length - 2;
  let bestTo = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegDist(goal, pts[i], pts[i + 1]);
    if (d < bestTo - 1e-9) {
      bestTo = d;
      endSeg = i;
    }
  }

  const waypoints = [];
  if (endSeg >= startSeg) {
    for (let i = startSeg + 1; i <= endSeg; i++) {
      waypoints.push({ x: pts[i].x, y: pts[i].y });
    }
  } else {
    for (let i = startSeg; i > endSeg; i--) {
      waypoints.push({ x: pts[i].x, y: pts[i].y });
    }
  }
  waypoints.push({ x: goal.x, y: goal.y });
  return waypoints;
}

// Flyer path: ignores all terrain — straight line to destination.
export function computeFlyerPath(state, from, to) {
  return [{ x: to.x, y: to.y }];
}

// Distance from point p to segment ab.
function pointSegDist(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-9 ? (apx * abx + apy * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

// -----------------------------------------------------------------------------
// Unified entry point keyed by entity domain.
// -----------------------------------------------------------------------------

export function computePath(state, entity, to, opts) {
  const from = { x: entity.x, y: entity.y };
  const domain = entity.domain || 'Walker';
  switch (domain) {
    case 'Flyer':
      return computeFlyerPath(state, from, to);
    case 'Floater':
    case 'Swimmer':
      return computeFloaterPath(state, from, to);
    case 'Walker':
    default:
      return computeWalkerPath(state, from, to, opts);
  }
}

// Recompute paths for all live attacker walkers — used when a wall/moat is
// placed or destroyed so the routes visibly change. Floaters/flyers are only
// recomputed if they lack a path.
export function recomputeAttackerPaths(state) {
  const ents = state.entities || [];
  const base = state.base;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (!e || !e.alive) continue;
    if (e.side !== 'attacker') continue;

    // Determine destination: structure-targeters may keep their current
    // destination order; base-targeters aim at the base.
    let dest;
    if (e.destination) {
      dest = e.destination;
    } else if (base) {
      dest = { x: base.x, y: base.y };
    } else {
      continue;
    }

    if (e.domain === 'Walker') {
      e.path = computeWalkerPath(state, { x: e.x, y: e.y }, dest, {
        radius: e.radius || 0.4,
      });
      e.pathIndex = 0;
    } else if (!e.path || e.path.length === 0) {
      e.path = computePath(state, e, dest);
      e.pathIndex = 0;
    }
  }
}

// Recompute path for a single deployed troop marching to a drop location.
export function recomputeTroopPath(state, troop) {
  const dest = troop.destination || (state.base
    ? { x: state.base.x, y: state.base.y }
    : { x: troop.x, y: troop.y });
  troop.path = computePath(state, troop, dest, { radius: troop.radius || 0.4 });
  troop.pathIndex = 0;
  return troop.path;
}

export default {
  computePath,
  computeWalkerPath,
  computeFloaterPath,
  computeFlyerPath,
  recomputeAttackerPaths,
  recomputeTroopPath,
};