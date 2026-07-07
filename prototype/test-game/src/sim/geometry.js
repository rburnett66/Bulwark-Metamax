sim/geometry.js — I'll implement board geometry with lanes, base, and hard-point slots.

```javascript
// src/sim/geometry.js
// Board geometry: ground lane, water lane, base, hard-point slots.
// Pure data + helpers. Deterministic, no rendering, reads config only.

// Board is defined in TILE units. Renderer maps tiles→pixels.
// Layout (top→down): attackers spawn at top (low y), base at bottom (high y).
// Two vertical lanes side by side: ground lane (left), water lane (right).

export const TILE = 32; // px per tile (renderer reference; sim uses tiles)

// Default board dimensions in tiles
const BOARD_W = 24;
const BOARD_H = 30;

// Lane definitions (in tile coordinates)
// Ground lane occupies left band; water lane the right band.
const GROUND_LANE = { x0: 2, x1: 10 };   // inclusive tile columns
const WATER_LANE = { x0: 13, x1: 21 };

// Spawn edge (top) and base clearing (bottom)
const SPAWN_Y = 1;
const BASE_Y = 27;

// Base position: sits in the clearing, straddling near both lanes' end.
const BASE = {
  // tile-space center
  cx: 12,
  cy: 27.5,
  // footprint half-extents (tiles)
  hw: 3,
  hh: 2,
};

// Slot count scales with base level.
const SLOTS_BY_LEVEL = [4, 6, 9, 12];

function laneCenterX(lane) {
  return (lane.x0 + lane.x1) / 2;
}

// Build the fixed hard-point slots. Slots are arranged in an arc /
// rings around the base clearing. Deterministic ordering.
function buildSlots() {
  // Master list; first N used based on base level.
  // Positioned in the clearing area between lanes and around base.
  const slots = [];
  // Row 1 (closest to base front, y ~ 24) — 4 slots
  const row1Y = 23.5;
  const row1X = [5, 9, 15, 19];
  for (const x of row1X) slots.push({ cx: x, cy: row1Y });
  // Row 2 (y ~ 21) — 2 more (total 6)
  const row2Y = 20.5;
  const row2X = [7, 17];
  for (const x of row2X) slots.push({ cx: x, cy: row2Y });
  // Row 3 flanks (total 9)
  const row3Y = 25.5;
  const row3X = [3, 12, 21];
  for (const x of row3X) slots.push({ cx: x, cy: row3Y });
  // Row 4 forward (total 12)
  const row4Y = 18;
  const row4X = [4, 12, 20];
  for (const x of row4X) slots.push({ cx: x, cy: row4Y });

  return slots.map((s, i) => ({
    id: i,
    cx: s.cx,
    cy: s.cy,
    occupied: false,   // set by world when a structure placed
    structureId: null,
  }));
}

export function createGeometry(opts = {}) {
  const width = opts.width || BOARD_W;
  const height = opts.height || BOARD_H;

  const geom = {
    width,
    height,
    tile: TILE,
    groundLane: { ...GROUND_LANE },
    waterLane: { ...WATER_LANE },
    spawnY: SPAWN_Y,
    baseY: BASE_Y,
    base: { ...BASE },
    slots: buildSlots(),
    slotsByLevel: SLOTS_BY_LEVEL.slice(),
  };

  return geom;
}

// ---- Query helpers (pure) ----

// Return number of active slots for a given base level (1-indexed level).
export function slotCountForLevel(geom, level) {
  const idx = Math.max(0, Math.min(geom.slotsByLevel.length - 1, (level | 0) - 1));
  return geom.slotsByLevel[idx];
}

// Active slots (subset) available at base level.
export function activeSlots(geom, level) {
  const n = slotCountForLevel(geom, level);
  return geom.slots.slice(0, n);
}

// Ground lane center-path waypoints (spawn → base front), left lane.
export function groundPath(geom) {
  const cx = laneCenterX(geom.groundLane);
  return [
    { x: cx, y: geom.spawnY },
    { x: cx, y: geom.baseY - 3 },
    { x: geom.base.cx, y: geom.base.cy }, // converge to base
  ];
}

// Water lane center-path waypoints (spawn → base front), right lane.
export function waterPath(geom) {
  const cx = laneCenterX(geom.waterLane);
  return [
    { x: cx, y: geom.spawnY },
    { x: cx, y: geom.baseY - 3 },
    { x: geom.base.cx, y: geom.base.cy },
  ];
}

// Flyer path: straight down from a chosen spawn x directly to base.
export function flyerPath(geom, spawnX) {
  const x = spawnX == null ? geom.base.cx : spawnX;
  return [
    { x, y: geom.spawnY },
    { x: geom.base.cx, y: geom.base.cy },
  ];
}

// Spawn point for a domain. Slight lateral spread handled by caller.
export function spawnPoint(geom, domain) {
  if (domain === 'water') {
    return { x: laneCenterX(geom.waterLane), y: geom.spawnY };
  }
  if (domain === 'air') {
    // flyers may spawn anywhere across the top; default center
    return { x: geom.base.cx, y: geom.spawnY };
  }
  // walker / default: ground lane
  return { x: laneCenterX(geom.groundLane), y: geom.spawnY };
}

// Base center in tile-space.
export function baseCenter(geom) {
  return { x: geom.base.cx, y: geom.base.cy };
}

// Is a tile column within the ground lane band?
export function inGroundLane(geom, tx) {
  return tx >= geom.groundLane.x0 && tx <= geom.groundLane.x1;
}

// Is a tile column within the water lane band?
export function inWaterLane(geom, tx) {
  return tx >= geom.waterLane.x0 && tx <= geom.waterLane.x1;
}

// Terrain classification for a tile (before structures/walls applied).
// 'ground' | 'water' | 'clearing' | 'oob'
export function terrainAt(geom, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= geom.width || ty >= geom.height) return 'oob';
  // Base clearing overrides both lanes near the bottom.
  if (ty >= geom.baseY - 4) return 'clearing';
  if (inWaterLane(geom, tx)) return 'water';
  if (inGroundLane(geom, tx)) return 'ground';
  return 'clearing';
}

// Whether a walker may occupy a tile (blocked by water & oob).
export function walkableForWalker(geom, tx, ty) {
  const t = terrainAt(geom, tx, ty);
  return t === 'ground' || t === 'clearing';
}

// Whether a floater may occupy a tile.
export function walkableForFloater(geom, tx, ty) {
  const t = terrainAt(geom, tx, ty);
  return t === 'water' || t === 'clearing';
}

// Distance helper (Euclidean, tile-space).
export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Find the nearest free active slot to a tile position; returns slot or null.
export function nearestFreeSlot(geom, level, tx, ty) {
  const slots = activeSlots(geom, level);
  let best = null;
  let bestD = Infinity;
  for (const s of slots) {
    if (s.occupied) continue;
    const d = dist({ x: s.cx, y: s.cy }, { x: tx, y: ty });
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Find slot within snapRadius of a tile position (for placement snapping).
export function slotAt(geom, level, tx, ty, snapRadius = 1.5) {
  const slots = activeSlots(geom, level);
  let best = null;
  let bestD = snapRadius;
  for (const s of slots) {
    const d = dist({ x: s.cx, y: s.cy }, { x: tx, y: ty });
    if (d <= bestD) { bestD = d; best = s; }
  }
  return best;
}

// Whether a placement location (tile) is a valid structure spot:
// must snap to an active, unoccupied slot.
export function canPlaceStructure(geom, level, tx, ty) {
  const slot = slotAt(geom, level, tx, ty);
  if (!slot) return { ok: false, reason: 'no-slot', slot: null };
  if (slot.occupied) return { ok: false, reason: 'occupied', slot };
  return { ok: true, reason: null, slot };
}

// Whether a deploy drop location is valid for a given domain.
// Ground drop must be walkable ground/clearing; water drop water/clearing.
export function canDeployAt(geom, domain, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= geom.width || ty >= geom.height) {
    return { ok: false, reason: 'oob' };
  }
  if (domain === 'air') return { ok: true, reason: null };
  if (domain === 'water') {
    return walkableForFloater(geom, tx, ty)
      ? { ok: true, reason: null }
      : { ok: false, reason: 'terrain' };
  }
  return walkableForWalker(geom, tx, ty)
    ? { ok: true, reason: null }
    : { ok: false, reason: 'terrain' };
}

// Convert tile-space to pixel-space (renderer convenience).
export function tileToPx(geom, tx, ty) {
  return { x: tx * geom.tile, y: ty * geom.tile };
}
export function pxToTile(geom, px, py) {
  return { x: px / geom.tile, y: py / geom.tile };
}

// Board pixel dimensions.
export function boardPixelSize(geom) {
  return { w: geom.width * geom.tile, h: geom.height * geom.tile };
}

export default {
  TILE,
  createGeometry,
  slotCountForLevel,
  activeSlots,
  groundPath,
  waterPath,
  flyerPath,
  spawnPoint,
  baseCenter,
  inGroundLane,
  inWaterLane,
  terrainAt,
  walkableForWalker,
  walkableForFloater,
  dist,
  nearestFreeSlot,
  slotAt,
  canPlaceStructure,
  canDeployAt,
  tileToPx,
  pxToTile,
  boardPixelSize,
};