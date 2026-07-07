vendored pixi, so the board is deterministic. Here's the board module.

```javascript
```

Let me write the actual file content.

import { TILE, LANE, SLOTS } from '../config/constants.js';

// Terrain cell type flags
export const TERRAIN = {
  GROUND: 0,
  WATER: 1,
  BASE: 2,
  BLOCKED: 3, // wall/moat occupied (dynamic)
};

/**
 * Board: fixed geometry container.
 * - Ground lane (walkers) beside a water lane (floaters/swimmers).
 * - Both lanes end at the player base clearing.
 * - Hard-point slots snap structures; count scales with base level.
 * - Terrain grid tracks passability for walker pathing recompute.
 *
 * Pure geometry/data. Deterministic. No rendering, no PIXI.
 */
export class Board {
  constructor(opts = {}) {
    this.tile = opts.tile || TILE || 32;
    this.cols = opts.cols || (LANE && LANE.cols) || 20;
    this.rows = opts.rows || (LANE && LANE.rows) || 24;

    // Pixel dimensions
    this.width = this.cols * this.tile;
    this.height = this.rows * this.tile;

    // Lane column ranges (in tile columns)
    // Water lane on the left band, ground lane on the right band.
    const wSpec = (LANE && LANE.water) || { col0: 1, col1: 6 };
    const gSpec = (LANE && LANE.ground) || { col0: 8, col1: 18 };
    this.waterLane = { col0: wSpec.col0, col1: wSpec.col1 };
    this.groundLane = { col0: gSpec.col0, col1: gSpec.col1 };

    // Base clearing: at the bottom rows (attackers march from top row 0).
    this.baseRows = (LANE && LANE.baseRows) || 3;
    this.spawnRow = 0;
    this.baseRow = this.rows - Math.ceil(this.baseRows / 2) - 1;

    // Base position (pixel center) in the ground clearing.
    const bx = Math.floor((this.groundLane.col0 + this.groundLane.col1) / 2);
    this.basePos = this.tileCenter(bx, this.baseRow);

    // Water end target (floaters march here, adjacent to base).
    const wx = Math.floor((this.waterLane.col0 + this.waterLane.col1) / 2);
    this.waterEnd = this.tileCenter(wx, this.baseRow);

    // Terrain grid
    this.grid = new Array(this.cols * this.rows).fill(TERRAIN.BLOCKED);
    this._buildTerrain();

    // Structure occupancy (footprint blocking for pathing). Keyed cell -> structureId
    this.blocked = new Map();

    // Hard-point slots
    this.baseLevel = 1;
    this.slots = [];
    this._buildSlots();
  }

  idx(cx, cy) { return cy * this.cols + cx; }

  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }

  tileCenter(cx, cy) {
    return {
      x: cx * this.tile + this.tile / 2,
      y: cy * this.tile + this.tile / 2,
    };
  }

  worldToTile(x, y) {
    return {
      cx: Math.floor(x / this.tile),
      cy: Math.floor(y / this.tile),
    };
  }

  _buildTerrain() {
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        let t = TERRAIN.BLOCKED;
        if (cx >= this.waterLane.col0 && cx <= this.waterLane.col1) {
          t = TERRAIN.WATER;
        } else if (cx >= this.groundLane.col0 && cx <= this.groundLane.col1) {
          t = TERRAIN.GROUND;
        }
        // Base clearing occupies bottom band across ground lane
        if (cy >= this.rows - this.baseRows) {
          if (cx >= this.groundLane.col0 && cx <= this.groundLane.col1) {
            t = TERRAIN.GROUND;
          }
        }
        this.grid[this.idx(cx, cy)] = t;
      }
    }
    // Mark the base tile
    const bt = this.worldToTile(this.basePos.x, this.basePos.y);
    this.grid[this.idx(bt.cx, bt.cy)] = TERRAIN.BASE;
  }

  _buildSlots() {
    // Slot count scales with base level.
    const perLevel = (SLOTS && SLOTS.perLevel) || 4;
    const base = (SLOTS && SLOTS.base) || 6;
    const count = base + (this.baseLevel - 1) * perLevel;

    this.slots = [];
    // Place slots along the ground lane on both edge columns and a middle
    // column, spread vertically between spawn and base clearing.
    const g = this.groundLane;
    const cols = [g.col0, Math.floor((g.col0 + g.col1) / 2), g.col1];
    // Rows from just below spawn to just above base clearing.
    const topRow = 2;
    const bottomRow = this.rows - this.baseRows - 1;
    let id = 0;
    const rowsSpan = bottomRow - topRow;
    let placed = 0;
    // Distribute count across a grid of candidate slots.
    outer:
    for (let r = 0; r <= rowsSpan; r += 2) {
      const cy = topRow + r;
      for (let ci = 0; ci < cols.length; ci++) {
        if (placed >= count) break outer;
        const cx = cols[ci];
        if (!this.inBounds(cx, cy)) continue;
        // Slots sit adjacent to lane on ground tiles
        if (this.grid[this.idx(cx, cy)] !== TERRAIN.GROUND) continue;
        const c = this.tileCenter(cx, cy);
        this.slots.push({
          id: id++,
          cx, cy,
          x: c.x, y: c.y,
          occupiedBy: null,
        });
        placed++;
      }
    }
  }

  setBaseLevel(level) {
    if (level === this.baseLevel) return;
    // Preserve existing occupancy where possible.
    const prev = this.slots.map(s => ({ x: s.x, y: s.y, occupiedBy: s.occupiedBy }));
    this.baseLevel = level;
    this._buildSlots();
    // Re-map occupancy onto matching positions.
    for (const p of prev) {
      if (!p.occupiedBy) continue;
      const s = this.slots.find(s => s.x === p.x && s.y === p.y);
      if (s) s.occupiedBy = p.occupiedBy;
    }
  }

  getSlot(id) {
    return this.slots.find(s => s.id === id) || null;
  }

  slotAt(x, y) {
    // Nearest free-or-any slot to a world point within one tile.
    let best = null, bestD = Infinity;
    for (const s of this.slots) {
      const dx = s.x - x, dy = s.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD <= (this.tile * this.tile)) return best;
    return null;
  }

  occupySlot(slotId, structureId) {
    const s = this.getSlot(slotId);
    if (!s || s.occupiedBy) return false;
    s.occupiedBy = structureId;
    return true;
  }

  freeSlot(slotId) {
    const s = this.getSlot(slotId);
    if (s) s.occupiedBy = null;
  }

  freeSlotByStructure(structureId) {
    for (const s of this.slots) {
      if (s.occupiedBy === structureId) s.occupiedBy = null;
    }
  }

  // ---- Terrain queries ----

  terrainAt(cx, cy) {
    if (!this.inBounds(cx, cy)) return TERRAIN.BLOCKED;
    return this.grid[this.idx(cx, cy)];
  }

  isGround(cx, cy) {
    const t = this.terrainAt(cx, cy);
    return t === TERRAIN.GROUND || t === TERRAIN.BASE;
  }

  isWater(cx, cy) {
    return this.terrainAt(cx, cy) === TERRAIN.WATER;
  }

  // Walker passability accounting for dynamic wall/moat blocks.
  isWalkable(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    if (this.blocked.has(this.idx(cx, cy))) return false;
    return this.isGround(cx, cy);
  }

  // Water passability (floaters), moats can block water too if placed there.
  isSwimmable(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    if (this.blocked.has(this.idx(cx, cy))) return false;
    return this.isWater(cx, cy);
  }

  // ---- Wall/moat footprint occupancy (reroutes walkers) ----

  canPlaceFootprint(cx, cy, w = 1, h = 1) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.inBounds(x, y)) return false;
        const t = this.terrainAt(x, y);
        if (t === TERRAIN.BASE || t === TERRAIN.BLOCKED) return false;
        if (this.blocked.has(this.idx(x, y))) return false;
      }
    }
    return true;
  }

  addBlocker(structureId, cx, cy, w = 1, h = 1) {
    const cells = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.inBounds(x, y)) continue;
        this.blocked.set(this.idx(x, y), structureId);
        cells.push({ cx: x, cy: y });
      }
    }
    return cells;
  }

  removeBlocker(structureId) {
    for (const [k, v] of Array.from(this.blocked.entries())) {
      if (v === structureId) this.blocked.delete(k);
    }
  }

  // ---- Path endpoints for pathing.js ----

  groundStart() {
    // Spawn column at top of ground lane.
    const cx = Math.floor((this.groundLane.col0 + this.groundLane.col1) / 2);
    return { cx, cy: this.spawnRow, ...this.tileCenter(cx, this.spawnRow) };
  }

  groundGoal() {
    const t = this.worldToTile(this.basePos.x, this.basePos.y);
    return { cx: t.cx, cy: t.cy, x: this.basePos.x, y: this.basePos.y };
  }

  waterStart() {
    const cx = Math.floor((this.waterLane.col0 + this.waterLane.col1) / 2);
    return { cx, cy: this.spawnRow, ...this.tileCenter(cx, this.spawnRow) };
  }

  waterGoal() {
    const t = this.worldToTile(this.waterEnd.x, this.waterEnd.y);
    return { cx: t.cx, cy: t.cy, x: this.waterEnd.x, y: this.waterEnd.y };
  }

  // Serializable snapshot (geometry is fixed; blocks + slots are dynamic)
  snapshot() {
    return {
      baseLevel: this.baseLevel,
      blocked: Array.from(this.blocked.entries()),
      slots: this.slots.map(s => ({ id: s.id, occupiedBy: s.occupiedBy })),
    };
  }

  restore(snap) {
    if (!snap) return;
    this.setBaseLevel(snap.baseLevel || 1);
    this.blocked = new Map(snap.blocked || []);
    if (snap.slots) {
      for (const ss of snap.slots) {
        const s = this.getSlot(ss.id);
        if (s) s.occupiedBy = ss.occupiedBy;
      }
    }
  }
}

export function createBoard(opts) {
  return new Board(opts);
}