import { MAP } from '../data/tables.js';

function clampInt(v, min, max) {
  const n = Math.round(v);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Rasterize water cells plus wall/moat footprints into a walker-blocking grid.
 * Towers are hazards but do NOT block walker movement; only walls and moats do.
 */
export function buildNavGrid(map, structures) {
  const cols = map.cols;
  const rows = map.rows;
  const passable = new Uint8Array(cols * rows);
  passable.fill(1);

  // Water blocks walkers.
  if (map.waterCells) {
    for (let i = 0; i < map.waterCells.length; i++) {
      const c = map.waterCells[i];
      if (c.x >= 0 && c.x < cols && c.y >= 0 && c.y < rows) {
        passable[c.y * cols + c.x] = 0;
      }
    }
  }

  // Wall / moat footprints block walkers (any live lifecycle phase blocks;
  // a destroyed or removed structure no longer exists in the list, but guard anyway).
  if (structures) {
    for (let i = 0; i < structures.length; i++) {
      const s = structures[i];
      if (!s) continue;
      if (s.kind !== 'wall' && s.kind !== 'moat') continue;
      if (s.lifecycle === 'Destroyed') continue;
      const fp = s.footprint || { w: 1, h: 1 };
      const bx = Math.round(s.pos.x);
      const by = Math.round(s.pos.y);
      for (let dy = 0; dy < (fp.h || 1); dy++) {
        for (let dx = 0; dx < (fp.w || 1); dx++) {
          const x = bx + dx;
          const y = by + dy;
          if (x >= 0 && x < cols && y >= 0 && y < rows) {
            passable[y * cols + x] = 0;
          }
        }
      }
    }
  }

  return { passable, cols, rows };
}

/**
 * Deterministic BFS shortest path on the nav grid.
 * Fixed neighbor order: North, East, South, West.
 * Returns an array of cells (excluding start, including goal), or null if unreachable.
 * The goal cell itself is always treated as enterable (e.g. the base clearing).
 */
export function findWalkerPath(navGrid, from, to) {
  const passable = navGrid.passable;
  const cols = navGrid.cols;
  const rows = navGrid.rows;

  const sx = clampInt(from.x, 0, cols - 1);
  const sy = clampInt(from.y, 0, rows - 1);
  const gx = clampInt(to.x, 0, cols - 1);
  const gy = clampInt(to.y, 0, rows - 1);

  const start = sy * cols + sx;
  const goal = gy * cols + gx;
  if (start === goal) return [];

  const total = cols * rows;
  const prev = new Int32Array(total);
  prev.fill(-1);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  visited[start] = 1;
  queue[tail++] = start;

  const DX = [0, 1, 0, -1]; // N, E, S, W — fixed order for determinism
  const DY = [-1, 0, 1, 0];

  let found = false;
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) {
      found = true;
      break;
    }
    const cx = cur % cols;
    const cy = (cur - cx) / cols;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (visited[ni]) continue;
      if (ni !== goal && !passable[ni]) continue;
      visited[ni] = 1;
      prev[ni] = cur;
      queue[tail++] = ni;
    }
  }

  if (!found && !visited[goal]) return null;

  // Reconstruct goal -> start, then reverse.
  const path = [];
  let node = goal;
  while (node !== start) {
    const x = node % cols;
    const y = (node - x) / cols;
    path.push({ x, y });
    node = prev[node];
    if (node === -1) return null; // safety: broken chain
  }
  path.reverse();
  return path;
}

/**
 * Fixed water-lane waypoint path to the base. Floaters never reroute.
 */
export function getWaterPath(map) {
  const path = [];
  const lane = map.waterLane || [];
  for (let i = 0; i < lane.length; i++) {
    path.push({ x: lane[i].x, y: lane[i].y });
  }
  const last = path.length > 0 ? path[path.length - 1] : null;
  if (!last || last.x !== map.base.x || last.y !== map.base.y) {
    path.push({ x: map.base.x, y: map.base.y });
  }
  return path;
}

/**
 * Direct-line path ignoring all terrain and walls (flyers).
 * Bresenham cell walk from `from` to `to`; excludes start, includes end.
 */
export function getFlyerPath(from, to) {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);

  const path = [];
  if (x0 === x1 && y0 === y1) {
    path.push({ x: x1, y: y1 });
    return path;
  }

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const maxSteps = dx + dy + 2;

  for (let step = 0; step < maxSteps; step++) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    path.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
  }
  return path;
}

/**
 * Rebuild the nav grid and reroute every live walker (attackers marching on the
 * base, plus defender repair/deploy troops marching to a destination) after any
 * wall/moat placement, sale, or destruction.
 *
 * Each walker keeps its current destination:
 *   - explicit `unit.dest` if present (repair troops / deployed troops),
 *   - else the final waypoint of its existing path,
 *   - else the base (attackers).
 * If the new grid fully blocks the route the unit's path is cleared and it
 * holds position until terrain changes again.
 */
export function recomputeUnitPaths(state) {
  const map = (state && state.map) || MAP;
  const structures = state && state.structures
    ? Array.from(state.structures.values())
    : [];

  const navGrid = buildNavGrid(map, structures);
  state.navGrid = navGrid;

  if (!state.units) return;

  for (const unit of state.units.values()) {
    if (!unit) continue;
    if (unit.hp <= 0) continue;
    if (unit.state === 'dead' || unit.state === 'dying') continue;
    if (unit.domain !== 'Walker') continue;

    // Determine the unit's current destination.
    let dest = null;
    if (unit.dest && typeof unit.dest.x === 'number' && typeof unit.dest.y === 'number') {
      dest = unit.dest;
    } else if (unit.path && unit.path.length > 0) {
      dest = unit.path[unit.path.length - 1];
    } else if (unit.side === 'attacker' || unit.targetsBase) {
      dest = map.base;
    }

    if (!dest) continue;

    const newPath = findWalkerPath(navGrid, unit.pos, dest);
    if (newPath) {
      unit.path = newPath;
      unit.pathIdx = 0;
    } else {
      // Fully blocked: hold position; a later recompute (structure destroyed
      // or sold) will restore the route. Placement validation prevents the
      // ground lane from being permanently sealed by the player.
      unit.path = [];
      unit.pathIdx = 0;
    }
  }
}