// src/sim/pathfinding.js
// Deterministic path recompute for walkers around walls/moats.
//
// This module computes deterministic tile-based paths for ground walkers
// from a spawn side toward the player base, routing around blocked terrain
// (moats block walkers; walls act as hazards/blockers on the walker path).
//
// It reads the terrain occupancy from the grid (src/sim/grid.js) and the
// board geometry (src/sim/geometry.js). It never mutates world state; it
// returns arrays of waypoint {x, y} world coordinates so movement.js can
// consume them.
//
// Determinism: BFS with a fixed neighbor ordering + integer keys. No RNG,
// no Object key-order dependence beyond fixed enumeration. Identical inputs
// yield identical outputs.

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

// Fixed neighbor order — MUST NOT change (determinism contract).
// Order: up, right, down, left (4-connected, no diagonals for stability).
const NEIGHBORS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

function keyOf(cx, cy, cols) {
  return cy * cols + cx;
}

/**
 * Determine whether a grid cell is passable for a ground walker.
 * Walkers are blocked by:
 *   - out-of-bounds
 *   - water tiles
 *   - moat terrain
 *   - wall terrain / wall structures
 *   - completed blocking structures (towers occupy slots off-lane, but if a
 *     structure marks a cell blocked we honor it)
 *
 * The grid module is expected to expose these accessors. We defensively
 * probe several possible shapes so this integrates whether grid uses
 * numeric terrain codes or an object per cell.
 */
function cellPassableForWalker(grid, cx, cy) {
  const cols = grid.cols;
  const rows = grid.rows;
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;

  // Preferred explicit API.
  if (typeof grid.isWalkable === 'function') {
    return !!grid.isWalkable(cx, cy);
  }
  if (typeof grid.isBlocked === 'function') {
    return !grid.isBlocked(cx, cy);
  }

  // Terrain code lookup.
  let terrain = null;
  if (typeof grid.terrainAt === 'function') {
    terrain = grid.terrainAt(cx, cy);
  } else if (grid.cells) {
    const c = grid.cells[keyOf(cx, cy, cols)];
    if (c == null) return true;
    if (typeof c === 'number') terrain = c;
    else if (typeof c === 'object') {
      if (c.blocked) return false;
      if (c.walkable === false) return false;
      terrain = c.terrain != null ? c.terrain : c.type;
    }
  }

  if (terrain == null) return true;

  // Normalize terrain to a string tag if numeric codes are used.
  const TERRAIN_TAGS = grid.TERRAIN || {
    GROUND: 0,
    WATER: 1,
    MOAT: 2,
    WALL: 3,
    BASE: 4,
  };

  if (typeof terrain === 'string') {
    const t = terrain.toLowerCase();
    if (t === 'water' || t === 'moat' || t === 'wall') return false;
    return true;
  }

  if (terrain === TERRAIN_TAGS.WATER) return false;
  if (terrain === TERRAIN_TAGS.MOAT) return false;
  if (terrain === TERRAIN_TAGS.WALL) return false;
  return true;
}

/**
 * Convert world coordinates to grid cell (defensive against grid API shape).
 */
function worldToCell(grid, wx, wy) {
  if (typeof grid.worldToCell === 'function') {
    return grid.worldToCell(wx, wy);
  }
  const ts = grid.tileSize || grid.tile || 32;
  const ox = grid.originX || 0;
  const oy = grid.originY || 0;
  return {
    cx: Math.floor((wx - ox) / ts),
    cy: Math.floor((wy - oy) / ts),
  };
}

/**
 * Convert grid cell center to world coordinates.
 */
function cellToWorld(grid, cx, cy) {
  if (typeof grid.cellToWorld === 'function') {
    return grid.cellToWorld(cx, cy);
  }
  const ts = grid.tileSize || grid.tile || 32;
  const ox = grid.originX || 0;
  const oy = grid.originY || 0;
  return {
    x: ox + cx * ts + ts / 2,
    y: oy + cy * ts + ts / 2,
  };
}

/**
 * Clamp a cell to the nearest passable cell using a deterministic
 * outward ring search. Used when a start/goal cell falls on blocked terrain.
 */
function nearestPassable(grid, cx, cy) {
  if (cellPassableForWalker(grid, cx, cy)) return { cx, cy };
  const maxR = Math.max(grid.cols, grid.rows);
  for (let r = 1; r <= maxR; r++) {
    // Deterministic scan: top row, bottom row, left col, right col.
    for (let dx = -r; dx <= r; dx++) {
      const t = { cx: cx + dx, cy: cy - r };
      if (cellPassableForWalker(grid, t.cx, t.cy)) return t;
      const b = { cx: cx + dx, cy: cy + r };
      if (cellPassableForWalker(grid, b.cx, b.cy)) return b;
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      const l = { cx: cx - r, cy: cy + dy };
      if (cellPassableForWalker(grid, l.cx, l.cy)) return l;
      const ri = { cx: cx + r, cy: cy + dy };
      if (cellPassableForWalker(grid, ri.cx, ri.cy)) return ri;
    }
  }
  return { cx, cy };
}

// -----------------------------------------------------------------------------
// Core BFS pathfinder (deterministic, unweighted 4-connected grid)
// -----------------------------------------------------------------------------

/**
 * Compute a cell path from (sx,sy) to (gx,gy) using breadth-first search.
 * Returns an array of {cx, cy} cells inclusive of start and goal, or null
 * if unreachable.
 */
function bfsCells(grid, sx, sy, gx, gy) {
  const cols = grid.cols;
  const rows = grid.rows;
  const startK = keyOf(sx, sy, cols);
  const goalK = keyOf(gx, gy, cols);

  if (startK === goalK) return [{ cx: sx, cy: sy }];

  // came[k] = previous key, -1 = unvisited, -2 = start
  const total = cols * rows;
  const came = new Int32Array(total).fill(-1);
  came[startK] = -2;

  // Simple FIFO queue backed by array + head index (deterministic order).
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = startK;

  let found = false;
  while (head < tail) {
    const cur = queue[head++];
    const ccx = cur % cols;
    const ccy = (cur - ccx) / cols;

    if (cur === goalK) {
      found = true;
      break;
    }

    for (let i = 0; i < NEIGHBORS.length; i++) {
      const nx = ccx + NEIGHBORS[i].dx;
      const ny = ccy + NEIGHBORS[i].dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nk = keyOf(nx, ny, cols);
      if (came[nk] !== -1) continue;
      // Allow stepping into the goal even if it evaluates blocked
      // (goal was clamped already, but be safe).
      if (nk !== goalK && !cellPassableForWalker(grid, nx, ny)) {
        came[nk] = -3; // mark as visited-blocked so we don't retry
        continue;
      }
      came[nk] = cur;
      queue[tail++] = nk;
    }
  }

  if (!found) return null;

  // Reconstruct.
  const cells = [];
  let k = goalK;
  while (k !== -2 && k !== -1 && k !== -3) {
    const cx = k % cols;
    const cy = (k - cx) / cols;
    cells.push({ cx, cy });
    const prev = came[k];
    if (prev === -2) break;
    if (prev < 0) return null;
    k = prev;
  }
  cells.reverse();
  return cells;
}

// -----------------------------------------------------------------------------
// Path simplification (collinear waypoint pruning) — deterministic.
// -----------------------------------------------------------------------------

function simplifyCells(cells) {
  if (!cells || cells.length <= 2) return cells ? cells.slice() : cells;
  const out = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = out[out.length - 1];
    const b = cells[i];
    const c = cells[i + 1];
    const dax = b.cx - a.cx;
    const day = b.cy - a.cy;
    const dbx = c.cx - b.cx;
    const dby = c.cy - b.cy;
    // Keep b only if direction changes (cross product != 0).
    if (dax * dby - day * dbx !== 0) out.push(b);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Compute a walker path (world-space waypoints) from a start world position
 * to a goal world position, routing around walls/moats/water.
 *
 * @param {Object} grid   - grid module instance (terrain occupancy)
 * @param {Object} geom   - board geometry (optional; used for lane hints)
 * @param {number} startX
 * @param {number} startY
 * @param {number} goalX
 * @param {number} goalY
 * @returns {Array<{x:number,y:number}>} waypoints incl. goal. Empty if none.
 */
export function computeWalkerPath(grid, geom, startX, startY, goalX, goalY) {
  if (!grid || !grid.cols || !grid.rows) {
    // No grid — return a straight line as a graceful fallback.
    return [{ x: goalX, y: goalY }];
  }

  const s = worldToCell(grid, startX, startY);
  const g = worldToCell(grid, goalX, goalY);

  const start = nearestPassable(grid, s.cx, s.cy);
  const goal = nearestPassable(grid, g.cx, g.cy);

  const cells = bfsCells(grid, start.cx, start.cy, goal.cx, goal.cy);

  if (!cells) {
    // Unreachable: give a direct fallback so walkers still act deterministically.
    return [{ x: goalX, y: goalY }];
  }

  const simplified = simplifyCells(cells);
  const waypoints = simplified.map((c) => cellToWorld(grid, c.cx, c.cy));

  // Ensure final waypoint is the exact goal world position (base center).
  if (waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { x: goalX, y: goalY };
  } else {
    waypoints.push({ x: goalX, y: goalY });
  }
  return waypoints;
}

/**
 * Recompute paths for a set of walker entities toward the base.
 * Mutates each walker's `path` (array of waypoints) and resets its
 * `pathIndex`. Returns the number of walkers repathed.
 *
 * The caller (movement.js / world reducer) invokes this after any terrain
 * change (wall/moat placed, sold, or destroyed).
 *
 * @param {Object} world  - strict world state
 * @param {Object} grid   - grid module
 * @param {Object} geom   - geometry module
 * @returns {number}
 */
export function recomputeWalkerPaths(world, grid, geom) {
  if (!world || !Array.isArray(world.units)) return 0;

  const base = world.base;
  if (!base) return 0;
  const goalX = base.x;
  const goalY = base.y;

  let count = 0;
  // Deterministic iteration: units array is order-stable.
  for (let i = 0; i < world.units.length; i++) {
    const u = world.units[i];
    if (!u || u.dead) continue;
    if (u.domain !== 'Walker' && u.domain !== 'walker') continue;

    const dest = pickWalkerDestination(u, base);
    const path = computeWalkerPath(grid, geom, u.x, u.y, dest.x, dest.y);
    u.path = path;
    u.pathIndex = 0;
    u.pathGoalX = dest.x;
    u.pathGoalY = dest.y;
    count++;
  }
  return count;
}

/**
 * Choose a walker's destination. Most walkers target the base; siege
 * (Targets === 'Structures') may target a structure if one is provided on
 * the entity as `structureTarget`. Falls back to base.
 */
function pickWalkerDestination(unit, base) {
  if (
    unit.targets === 'Structures' &&
    unit.structureTarget &&
    typeof unit.structureTarget.x === 'number'
  ) {
    return { x: unit.structureTarget.x, y: unit.structureTarget.y };
  }
  return { x: base.x, y: base.y };
}

/**
 * Convenience: compute (and assign) a path for a single walker entity.
 * Used when spawning a new walker or issuing a deploy march order.
 *
 * @param {Object} unit
 * @param {Object} grid
 * @param {Object} geom
 * @param {number} goalX
 * @param {number} goalY
 */
export function assignWalkerPath(unit, grid, geom, goalX, goalY) {
  const path = computeWalkerPath(grid, geom, unit.x, unit.y, goalX, goalY);
  unit.path = path;
  unit.pathIndex = 0;
  unit.pathGoalX = goalX;
  unit.pathGoalY = goalY;
  return path;
}

/**
 * Check whether a straight path currently exists (used for validity /
 * blocked-lane detection). Returns true if a walker route to goal exists.
 */
export function pathExists(grid, startX, startY, goalX, goalY) {
  if (!grid || !grid.cols || !grid.rows) return true;
  const s = worldToCell(grid, startX, startY);
  const g = worldToCell(grid, goalX, goalY);
  const start = nearestPassable(grid, s.cx, s.cy);
  const goal = nearestPassable(grid, g.cx, g.cy);
  const cells = bfsCells(grid, start.cx, start.cy, goal.cx, goal.cy);
  return !!cells;
}

export default {
  computeWalkerPath,
  recomputeWalkerPaths,
  assignWalkerPath,
  pathExists,
};