// src/sim/grid.js
// Board geometry for BULWARK vertical slice.
// Tile grid with a single ground lane beside a single water lane, both ending
// at the player base in a clearing. Fixed hard-point slots scale with base
// level. Pure deterministic state — no rendering, no randomness.
//
// Terrain is immutable after creation; dynamic blocking (walls, moats, the
// base footprint, towers) lives in the occupancy layer so pathing can query
// "passable for domain X" cheaply and structures can be placed/sold without
// mutating terrain.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 12;

export const TERRAIN = Object.freeze({
  BLOCKED: 0, // impassable rock / board edge (walkers & floaters blocked; flyers ignore)
  GROUND: 1,  // ground lane tile
  WATER: 2,   // water lane tile
  CLEARING: 3 // base clearing: ground-type, buildable
});

export const DOMAIN = Object.freeze({
  WALKER: 'walker',
  FLOATER: 'floater',
  FLYER: 'flyer'
});

// Lane bands (tile-row extents) — exported so renderer can tint bands and
// waves.js can pick spawn rows deterministically.
export const GROUND_LANE = Object.freeze({ x0: 0, x1: 17, y0: 1, y1: 5 });
export const WATER_LANE = Object.freeze({ x0: 0, x1: 17, y0: 7, y1: 9 });
// Water inlet extends the water lane into the clearing so floaters can reach
// attack range of the base.
export const WATER_INLET = Object.freeze({ x0: 18, x1: 22, y0: 6, y1: 8 });
export const CLEARING_RECT = Object.freeze({ x0: 18, x1: 23, y0: 1, y1: 9 });

// Base footprint (2x2) inside the clearing, adjacent to the water inlet.
export const BASE_RECT = Object.freeze({ x: 21, y: 4, w: 2, h: 2 });

// Ordered hard-point slot positions. Base level N unlocks the first
// SLOTS_PER_LEVEL[N] entries. All slots sit on GROUND/CLEARING tiles.
export const SLOT_POSITIONS = Object.freeze([
  Object.freeze({ x: 19, y: 4 }), // front door of the base
  Object.freeze({ x: 19, y: 2 }), // upper approach
  Object.freeze({ x: 19, y: 9 }), // south bank of the water inlet
  Object.freeze({ x: 23, y: 6 }), // east of the inlet, covers water + base flank
  Object.freeze({ x: 16, y: 3 }), // ground-lane mouth (north)
  Object.freeze({ x: 16, y: 5 }), // ground-lane mouth (south)
  Object.freeze({ x: 20, y: 9 }), // deep inlet coverage
  Object.freeze({ x: 13, y: 2 }), // forward ground-lane pick
  Object.freeze({ x: 23, y: 2 }), // rear corner
  Object.freeze({ x: 12, y: 4 })  // far forward hard-point
]);

export const SLOTS_PER_LEVEL = Object.freeze([0, 4, 7, 10]);

export const BASE_OCCUPANT_ID = 'base';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function key(x, y) {
  return x + ',' + y;
}

export function inBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function idx(grid, x, y) {
  return y * grid.width + x;
}

export function tileCenter(x, y) {
  return { x: x + 0.5, y: y + 0.5 };
}

export function neighbors4(grid, x, y, out) {
  const res = out || [];
  res.length = 0;
  if (inBounds(grid, x + 1, y)) res.push({ x: x + 1, y: y });
  if (inBounds(grid, x - 1, y)) res.push({ x: x - 1, y: y });
  if (inBounds(grid, x, y + 1)) res.push({ x: x, y: y + 1 });
  if (inBounds(grid, x, y - 1)) res.push({ x: x, y: y - 1 });
  return res;
}

function rectContains(r, x, y) {
  if (r.w !== undefined) {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

export function createGrid() {
  const width = GRID_WIDTH;
  const height = GRID_HEIGHT;
  const tiles = new Uint8Array(width * height); // TERRAIN.BLOCKED default

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = TERRAIN.BLOCKED;
      if (rectContains(GROUND_LANE, x, y)) t = TERRAIN.GROUND;
      if (rectContains(WATER_LANE, x, y)) t = TERRAIN.WATER;
      if (rectContains(CLEARING_RECT, x, y)) t = TERRAIN.CLEARING;
      if (rectContains(WATER_INLET, x, y)) t = TERRAIN.WATER;
      tiles[y * width + x] = t;
    }
  }

  const baseTiles = [];
  for (let by = BASE_RECT.y; by < BASE_RECT.y + BASE_RECT.h; by++) {
    for (let bx = BASE_RECT.x; bx < BASE_RECT.x + BASE_RECT.w; bx++) {
      baseTiles.push({ x: bx, y: by });
    }
  }

  const grid = {
    width: width,
    height: height,
    tiles: tiles,
    // occupancy: key "x,y" -> { id, blocksWalker, blocksBuild }
    occupancy: new Map(),
    base: {
      x: BASE_RECT.x,
      y: BASE_RECT.y,
      w: BASE_RECT.w,
      h: BASE_RECT.h,
      tiles: baseTiles,
      center: {
        x: BASE_RECT.x + BASE_RECT.w / 2,
        y: BASE_RECT.y + BASE_RECT.h / 2
      }
    },
    // Spawn points per lane/domain (left edge of the board).
    spawns: {
      ground: { x: 0, y: 3 },
      water: { x: 0, y: 8 },
      air: { x: 0, y: 4 }
    },
    groundLane: GROUND_LANE,
    waterLane: WATER_LANE,
    waterInlet: WATER_INLET,
    clearing: CLEARING_RECT,
    slots: SLOT_POSITIONS
  };

  // Base blocks walking and building on its footprint.
  for (let i = 0; i < baseTiles.length; i++) {
    occupy(grid, baseTiles[i].x, baseTiles[i].y, BASE_OCCUPANT_ID, {
      blocksWalker: true,
      blocksBuild: true
    });
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Terrain queries
// ---------------------------------------------------------------------------

export function terrainAt(grid, x, y) {
  if (!inBounds(grid, x, y)) return TERRAIN.BLOCKED;
  return grid.tiles[idx(grid, x, y)];
}

export function isWaterTile(grid, x, y) {
  return terrainAt(grid, x, y) === TERRAIN.WATER;
}

export function isGroundTile(grid, x, y) {
  const t = terrainAt(grid, x, y);
  return t === TERRAIN.GROUND || t === TERRAIN.CLEARING;
}

export function isBaseTile(grid, x, y) {
  return rectContains(BASE_RECT, x, y);
}

// ---------------------------------------------------------------------------
// Occupancy layer (walls, moats, towers, base)
// ---------------------------------------------------------------------------

export function occupy(grid, x, y, id, flags) {
  grid.occupancy.set(key(x, y), {
    id: id,
    blocksWalker: !!(flags && flags.blocksWalker),
    blocksBuild: !flags || flags.blocksBuild !== false
  });
}

export function vacate(grid, x, y) {
  grid.occupancy.delete(key(x, y));
}

export function vacateById(grid, id) {
  const dead = [];
  grid.occupancy.forEach(function (occ, k) {
    if (occ.id === id) dead.push(k);
  });
  for (let i = 0; i < dead.length; i++) grid.occupancy.delete(dead[i]);
}

export function occupantAt(grid, x, y) {
  return grid.occupancy.get(key(x, y)) || null;
}

export function isOccupied(grid, x, y) {
  return grid.occupancy.has(key(x, y));
}

// Deterministically ordered occupancy entries (for hashing / serialization).
export function occupancyEntries(grid) {
  const out = [];
  grid.occupancy.forEach(function (occ, k) {
    out.push({
      key: k,
      id: occ.id,
      blocksWalker: occ.blocksWalker,
      blocksBuild: occ.blocksBuild
    });
  });
  out.sort(function (a, b) {
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return out;
}

export function serializeGrid(grid) {
  return { occupancy: occupancyEntries(grid) };
}

export function restoreGrid(grid, data) {
  grid.occupancy.clear();
  const list = (data && data.occupancy) || [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    grid.occupancy.set(e.key, {
      id: e.id,
      blocksWalker: !!e.blocksWalker,
      blocksBuild: !!e.blocksBuild
    });
  }
}

// ---------------------------------------------------------------------------
// Passability per movement domain
// ---------------------------------------------------------------------------

// walker: GROUND/CLEARING terrain, not blocked by walls/moats/base.
// floater: WATER terrain only.
// flyer: anywhere in bounds (ignores terrain and structures).
export function isPassable(grid, x, y, domain) {
  if (!inBounds(grid, x, y)) return false;
  if (domain === DOMAIN.FLYER) return true;
  const t = grid.tiles[idx(grid, x, y)];
  if (domain === DOMAIN.FLOATER) return t === TERRAIN.WATER;
  // walker
  if (t !== TERRAIN.GROUND && t !== TERRAIN.CLEARING) return false;
  const occ = grid.occupancy.get(key(x, y));
  if (occ && occ.blocksWalker) return false;
  return true;
}

// Walkable tiles orthogonally adjacent to the base footprint — walker attack
// positions / pathfinding goals.
export function baseApproachTiles(grid, domain) {
  const d = domain || DOMAIN.WALKER;
  const seen = {};
  const out = [];
  const bt = grid.base.tiles;
  for (let i = 0; i < bt.length; i++) {
    const nbs = neighbors4(grid, bt[i].x, bt[i].y);
    for (let j = 0; j < nbs.length; j++) {
      const n = nbs[j];
      const k = key(n.x, n.y);
      if (seen[k]) continue;
      seen[k] = true;
      if (isBaseTile(grid, n.x, n.y)) continue;
      if (isPassable(grid, n.x, n.y, d)) out.push({ x: n.x, y: n.y });
    }
  }
  out.sort(function (a, b) {
    return a.y - b.y || a.x - b.x;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Hard-point slots (scale with base level)
// ---------------------------------------------------------------------------

export function slotCountForBaseLevel(baseLevel) {
  const lvl = Math.max(0, Math.min(SLOTS_PER_LEVEL.length - 1, baseLevel | 0));
  return SLOTS_PER_LEVEL[lvl];
}

// All slots with unlocked/occupied status for the given base level.
export function slotsForBaseLevel(grid, baseLevel) {
  const count = slotCountForBaseLevel(baseLevel);
  const out = [];
  for (let i = 0; i < SLOT_POSITIONS.length; i++) {
    const s = SLOT_POSITIONS[i];
    const occ = occupantAt(grid, s.x, s.y);
    out.push({
      index: i,
      x: s.x,
      y: s.y,
      unlocked: i < count,
      occupied: !!occ,
      occupantId: occ ? occ.id : null
    });
  }
  return out;
}

export function slotAt(grid, x, y, baseLevel) {
  const count = slotCountForBaseLevel(baseLevel);
  for (let i = 0; i < count; i++) {
    const s = SLOT_POSITIONS[i];
    if (s.x === x && s.y === y) {
      const occ = occupantAt(grid, x, y);
      return {
        index: i,
        x: s.x,
        y: s.y,
        unlocked: true,
        occupied: !!occ,
        occupantId: occ ? occ.id : null
      };
    }
  }
  return null;
}

export function freeSlots(grid, baseLevel) {
  return slotsForBaseLevel(grid, baseLevel).filter(function (s) {
    return s.unlocked && !s.occupied;
  });
}

// ---------------------------------------------------------------------------
// Placement validity (space + terrain; cost is checked by economy/structures)
// ---------------------------------------------------------------------------

// def: {
//   footprint: { w, h }        (default 1x1)
//   requiresSlot: boolean      (towers snap to hard-point slots)
//   placeOn: 'ground'|'water'|'any'   (walls/towers ground, moats ground, etc.)
// }
// Returns { ok, reason } — reason is a stable string for logging/HUD.
export function canPlaceStructure(grid, def, x, y, baseLevel) {
  const fw = (def && def.footprint && def.footprint.w) || 1;
  const fh = (def && def.footprint && def.footprint.h) || 1;
  const placeOn = (def && def.placeOn) || 'ground';

  if (def && def.requiresSlot) {
    if (fw !== 1 || fh !== 1) return { ok: false, reason: 'slot-footprint' };
    const slot = slotAt(grid, x, y, baseLevel);
    if (!slot) return { ok: false, reason: 'not-a-slot' };
    if (slot.occupied) return { ok: false, reason: 'slot-occupied' };
    return { ok: true, reason: 'ok' };
  }

  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(grid, tx, ty)) return { ok: false, reason: 'out-of-bounds' };
      const t = grid.tiles[idx(grid, tx, ty)];
      if (placeOn === 'ground') {
        if (t !== TERRAIN.GROUND && t !== TERRAIN.CLEARING) {
          return { ok: false, reason: 'bad-terrain' };
        }
      } else if (placeOn === 'water') {
        if (t !== TERRAIN.WATER) return { ok: false, reason: 'bad-terrain' };
      } else {
        if (t === TERRAIN.BLOCKED) return { ok: false, reason: 'bad-terrain' };
      }
      if (isBaseTile(grid, tx, ty)) return { ok: false, reason: 'on-base' };
      const occ = grid.occupancy.get(key(tx, ty));
      if (occ && occ.blocksBuild) return { ok: false, reason: 'occupied' };
    }
  }
  return { ok: true, reason: 'ok' };
}

// Footprint tiles for a structure def placed at (x,y).
export function footprintTiles(def, x, y) {
  const fw = (def && def.footprint && def.footprint.w) || 1;
  const fh = (def && def.footprint && def.footprint.h) || 1;
  const out = [];
  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
}

// Deploy-order validity: a troop drop destination must be a passable tile for
// the troop's movement domain.
export function isValidDropTile(grid, x, y, domain) {
  return isPassable(grid, x, y, domain || DOMAIN.WALKER);
}

// ---------------------------------------------------------------------------
// Misc geometry
// ---------------------------------------------------------------------------

export function distTiles(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from a point (tile-center coords) to the nearest point of the base
// footprint — used for "in range of base" checks.
export function distToBase(grid, px, py) {
  const b = grid.base;
  const cx = Math.max(b.x, Math.min(px, b.x + b.w));
  const cy = Math.max(b.y, Math.min(py, b.y + b.h));
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function spawnFor(grid, domain) {
  if (domain === DOMAIN.FLOATER) return grid.spawns.water;
  if (domain === DOMAIN.FLYER) return grid.spawns.air;
  return grid.spawns.ground;
}