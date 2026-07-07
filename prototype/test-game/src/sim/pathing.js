import { TILE, isWaterTile, isBlockedForWalker, isBlockedForFloater } from './grid.js';

// ---------------------------------------------------------------------------
// Deterministic BFS pathfinding per movement domain.
//
// Domains:
//   walker  : ground movement; blocked by water tiles, walls, moats,
//             and structure footprints (structures are hazards / obstacles).
//   floater : water-only movement; must stay on water tiles; blocked by
//             structures placed on water (walls do not exist on water in the
//             vertical slice but we honor blockers anyway).
//   flyer   : ignores terrain and structures entirely; travels a straight
//             line from start to goal.
//
// All iteration orders are fixed (N, E, S, W neighbor order, FIFO queue) so
// results are bit-identical for identical inputs -> deterministic replay.
//
// The Pathfinder caches per-domain flow fields toward the base goal and
// bumps a `version` whenever terrain-affecting structures change (wall /
// moat placement or removal). Units compare their cached path version to
// pathfinder.version and recompute when stale.
// ---------------------------------------------------------------------------

const NEIGHBORS = [
  [0, -1], // N
  [1, 0],  // E
  [0, 1],  // S
  [-1, 0], // W
];

export const DOMAIN_WALKER = 'Walker';
export const DOMAIN_FLOATER = 'Floater';
export const DOMAIN_FLYER = 'Flyer';

function keyOf(x, y, w) {
  return y * w + x;
}

// ---------------------------------------------------------------------------
// Passability predicates. `blockers` is a Set of tile keys occupied by
// path-blocking structures (walls, moats, towers with footprints). It is
// maintained by the Pathfinder from structure add/remove notifications.
// ---------------------------------------------------------------------------
export function isPassable(grid, domain, x, y, blockers) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  if (domain === DOMAIN_FLYER) return true;
  const k = keyOf(x, y, grid.width);
  if (domain === DOMAIN_WALKER) {
    if (isWaterTile(grid, x, y)) return false;
    if (isBlockedForWalker(grid, x, y)) return false;
    if (blockers && blockers.has(k)) return false;
    return true;
  }
  if (domain === DOMAIN_FLOATER) {
    if (!isWaterTile(grid, x, y)) return false;
    if (isBlockedForFloater(grid, x, y)) return false;
    if (blockers && blockers.has(k)) return false;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Plain BFS from (sx,sy) to (gx,gy). Returns array of {x,y} tile steps
// including start and goal, or null if unreachable.
// ---------------------------------------------------------------------------
export function bfsPath(grid, domain, sx, sy, gx, gy, blockers) {
  if (domain === DOMAIN_FLYER) {
    return straightLinePath(sx, sy, gx, gy);
  }
  const w = grid.width;
  const h = grid.height;
  if (sx === gx && sy === gy) return [{ x: sx, y: sy }];
  if (!isPassable(grid, domain, gx, gy, blockers)) return null;

  const startKey = keyOf(sx, sy, w);
  const goalKey = keyOf(gx, gy, w);
  const cameFrom = new Int32Array(w * h).fill(-2); // -2 unvisited, -1 start
  cameFrom[startKey] = -1;

  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  queue[tail++] = startKey;

  let found = false;
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goalKey) { found = true; break; }
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (let i = 0; i < NEIGHBORS.length; i++) {
      const nx = cx + NEIGHBORS[i][0];
      const ny = cy + NEIGHBORS[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = keyOf(nx, ny, w);
      if (cameFrom[nk] !== -2) continue;
      if (!isPassable(grid, domain, nx, ny, blockers)) continue;
      cameFrom[nk] = cur;
      queue[tail++] = nk;
    }
  }
  if (!found && cameFrom[goalKey] === -2) return null;

  // Reconstruct.
  const path = [];
  let cur = goalKey;
  while (cur !== -1) {
    const cx = cur % w;
    path.push({ x: cx, y: (cur - cx) / w });
    cur = cameFrom[cur];
  }
  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// Straight-line (Bresenham) tile path for flyers. Deterministic integer walk.
// ---------------------------------------------------------------------------
export function straightLinePath(sx, sy, gx, gy) {
  const path = [];
  let x0 = sx | 0, y0 = sy | 0;
  const x1 = gx | 0, y1 = gy | 0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    path.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += stepX; }
    else if (e2 < dx) { err += dx; y0 += stepY; }
  }
  return path;
}

// ---------------------------------------------------------------------------
// Flow field: BFS outward from the goal, storing distance for every
// reachable tile. Units can then descend the gradient. Cheaper than
// per-unit BFS when many units share the same goal (the base).
// ---------------------------------------------------------------------------
export function buildFlowField(grid, domain, gx, gy, blockers) {
  const w = grid.width;
  const h = grid.height;
  const dist = new Int32Array(w * h).fill(-1);
  const goalKey = keyOf(gx, gy, w);
  // Seed even if the goal tile itself is a base/clearing tile that may be
  // marked specially — the goal is always reachable-onto by definition.
  dist[goalKey] = 0;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  queue[tail++] = goalKey;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const d = dist[cur];
    for (let i = 0; i < NEIGHBORS.length; i++) {
      const nx = cx + NEIGHBORS[i][0];
      const ny = cy + NEIGHBORS[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = keyOf(nx, ny, w);
      if (dist[nk] !== -1) continue;
      if (!isPassable(grid, domain, nx, ny, blockers)) continue;
      dist[nk] = d + 1;
      queue[tail++] = nk;
    }
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Pathfinder — stateful facade owned by the sim core.
// ---------------------------------------------------------------------------
export class Pathfinder {
  constructor(grid) {
    this.grid = grid;
    // Tiles blocked by structures, per domain-agnostic set (walls, moats,
    // towers). Moats block walkers only; walls block walkers only; both are
    // recorded per-domain below.
    this.walkerBlockers = new Set();
    this.floaterBlockers = new Set();
    // Reference counts so overlapping footprints unblock correctly.
    this._walkerRef = new Map();
    this._floaterRef = new Map();
    // Version bumps whenever passability changes -> units recompute paths.
    this.version = 0;
    // Cached flow fields toward the base goal keyed by domain.
    this._fields = new Map(); // domain -> { version, gx, gy, dist }
  }

  // ---- structure notifications --------------------------------------------

  // structure: { footprintTiles: [{x,y}...], blocksWalkers, blocksFloaters }
  addStructureBlocker(footprintTiles, blocksWalkers, blocksFloaters) {
    let changed = false;
    for (let i = 0; i < footprintTiles.length; i++) {
      const t = footprintTiles[i];
      const k = keyOf(t.x, t.y, this.grid.width);
      if (blocksWalkers) {
        const c = (this._walkerRef.get(k) || 0) + 1;
        this._walkerRef.set(k, c);
        if (c === 1) { this.walkerBlockers.add(k); changed = true; }
      }
      if (blocksFloaters) {
        const c = (this._floaterRef.get(k) || 0) + 1;
        this._floaterRef.set(k, c);
        if (c === 1) { this.floaterBlockers.add(k); changed = true; }
      }
    }
    if (changed) this._invalidate();
    return changed;
  }

  removeStructureBlocker(footprintTiles, blocksWalkers, blocksFloaters) {
    let changed = false;
    for (let i = 0; i < footprintTiles.length; i++) {
      const t = footprintTiles[i];
      const k = keyOf(t.x, t.y, this.grid.width);
      if (blocksWalkers) {
        const c = (this._walkerRef.get(k) || 0) - 1;
        if (c <= 0) {
          this._walkerRef.delete(k);
          if (this.walkerBlockers.delete(k)) changed = true;
        } else {
          this._walkerRef.set(k, c);
        }
      }
      if (blocksFloaters) {
        const c = (this._floaterRef.get(k) || 0) - 1;
        if (c <= 0) {
          this._floaterRef.delete(k);
          if (this.floaterBlockers.delete(k)) changed = true;
        } else {
          this._floaterRef.set(k, c);
        }
      }
    }
    if (changed) this._invalidate();
    return changed;
  }

  _invalidate() {
    this.version++;
    this._fields.clear();
  }

  _blockersFor(domain) {
    if (domain === DOMAIN_WALKER) return this.walkerBlockers;
    if (domain === DOMAIN_FLOATER) return this.floaterBlockers;
    return null;
  }

  // ---- queries -------------------------------------------------------------

  isTilePassable(domain, x, y) {
    return isPassable(this.grid, domain, x, y, this._blockersFor(domain));
  }

  // Would blocking these tiles for walkers still leave a walker path from
  // every ground spawn to the base? Used by structures.js placement validity
  // so a wall/moat can never fully seal the ground lane.
  wouldBlockAllWalkerPaths(footprintTiles, spawns, goal) {
    const temp = new Set(this.walkerBlockers);
    for (let i = 0; i < footprintTiles.length; i++) {
      temp.add(keyOf(footprintTiles[i].x, footprintTiles[i].y, this.grid.width));
    }
    for (let s = 0; s < spawns.length; s++) {
      const p = bfsPath(
        this.grid, DOMAIN_WALKER,
        spawns[s].x, spawns[s].y, goal.x, goal.y, temp
      );
      if (p === null) return true;
    }
    return false;
  }

  // Full explicit path from a tile to a goal tile for the given domain.
  findPath(domain, sx, sy, gx, gy) {
    return bfsPath(this.grid, domain, sx, sy, gx, gy, this._blockersFor(domain));
  }

  // Flow-field-backed path toward a shared goal (the base). Returns an
  // explicit tile path descending the gradient; deterministic tie-break by
  // fixed neighbor order.
  findPathToGoal(domain, sx, sy, gx, gy) {
    if (domain === DOMAIN_FLYER) return straightLinePath(sx, sy, gx, gy);
    const field = this._getField(domain, gx, gy);
    const w = this.grid.width;
    const startKey = keyOf(sx, sy, w);
    if (field[startKey] === -1) {
      // Unit stands on a tile disconnected from the goal (e.g. wall placed
      // around it or unit on the goal-blocking edge) — fall back to plain BFS
      // (may still be null -> caller decides, e.g. attack nearest blocker).
      return bfsPath(this.grid, domain, sx, sy, gx, gy, this._blockersFor(domain));
    }
    const path = [{ x: sx, y: sy }];
    let cx = sx;
    let cy = sy;
    let guard = w * this.grid.height + 4;
    while (!(cx === gx && cy === gy) && guard-- > 0) {
      const curD = field[keyOf(cx, cy, w)];
      let bestX = cx;
      let bestY = cy;
      let bestD = curD;
      for (let i = 0; i < NEIGHBORS.length; i++) {
        const nx = cx + NEIGHBORS[i][0];
        const ny = cy + NEIGHBORS[i][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.grid.height) continue;
        const nd = field[keyOf(nx, ny, w)];
        if (nd !== -1 && nd < bestD) {
          bestD = nd;
          bestX = nx;
          bestY = ny;
        }
      }
      if (bestX === cx && bestY === cy) break; // stuck (shouldn't happen)
      cx = bestX;
      cy = bestY;
      path.push({ x: cx, y: cy });
    }
    return path;
  }

  // Distance in tiles to the goal via flow field; -1 if unreachable.
  distanceToGoal(domain, x, y, gx, gy) {
    if (domain === DOMAIN_FLYER) {
      return Math.abs(gx - x) + Math.abs(gy - y);
    }
    const field = this._getField(domain, gx, gy);
    return field[keyOf(x, y, this.grid.width)];
  }

  _getField(domain, gx, gy) {
    const cached = this._fields.get(domain);
    if (cached && cached.version === this.version &&
        cached.gx === gx && cached.gy === gy) {
      return cached.dist;
    }
    const dist = buildFlowField(
      this.grid, domain, gx, gy, this._blockersFor(domain)
    );
    this._fields.set(domain, { version: this.version, gx, gy, dist });
    return dist;
  }

  // ---- unit path maintenance ------------------------------------------------

  // Ensure a unit's cached path is valid for the current terrain version;
  // recompute if stale or missing. Unit needs: { domain, tileX, tileY,
  // goalX, goalY, path, pathIndex, pathVersion }.
  ensurePath(unit) {
    if (unit.domain === DOMAIN_FLYER) {
      if (!unit.path || unit.path.length === 0) {
        unit.path = straightLinePath(unit.tileX, unit.tileY, unit.goalX, unit.goalY);
        unit.pathIndex = 0;
        unit.pathVersion = this.version;
      }
      return unit.path;
    }
    if (!unit.path || unit.pathVersion !== this.version) {
      unit.path = this.findPathToGoal(
        unit.domain, unit.tileX, unit.tileY, unit.goalX, unit.goalY
      );
      unit.pathIndex = 0;
      unit.pathVersion = this.version;
    }
    return unit.path;
  }

  // World-space helpers for movement code (tile centers).
  static tileCenter(t) {
    return { x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE };
  }

  // Serialize minimal deterministic state (blocker sets) for state hashing.
  serialize() {
    return {
      version: this.version,
      walkerBlockers: Array.from(this.walkerBlockers).sort((a, b) => a - b),
      floaterBlockers: Array.from(this.floaterBlockers).sort((a, b) => a - b),
    };
  }
}

export default Pathfinder;