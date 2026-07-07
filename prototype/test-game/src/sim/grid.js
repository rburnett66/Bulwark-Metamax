Looking at the plan, `src/sim/grid.js` handles the tile grid and terrain occupancy for walls/moats. Let me implement a deterministic grid system that integrates with geometry, pathfinding, and structures.

```javascript
// src/sim/grid.js
// Tile grid + terrain occupancy for walls/moats.
// Deterministic, strict-state friendly. Rendering reads this; sim mutates via helpers.
//
// Terrain codes (occupancy semantics):
//   OPEN     0  -> walkable ground
//   WATER    1  -> water lane (floaters only; blocks walkers)
//   WALL     2  -> wall structure footprint (blocks walkers, reroutes)
//   MOAT     3  -> moat structure footprint (blocks walkers)
//   BASE     4  -> base clearing / hard-point region (not walkable through)
//   SLOT     5  -> occupied hard-point slot (tower footprint; blocks walkers)
//
// Flyers ignore ALL terrain. Floaters only traverse WATER. Walkers traverse OPEN
// (and treat BASE as their goal-adjacent target).

export const TERRAIN = Object.freeze({
  OPEN: 0,
  WATER: 1,
  WALL: 2,
  MOAT: 3,
  BASE: 4,
  SLOT: 5,
});

// Which terrain codes block a walking ground unit.
const WALKER_BLOCKED = new Set([
  TERRAIN.WATER,
  TERRAIN.WALL,
  TERRAIN.MOAT,
  TERRAIN.SLOT,
]);

// Which terrain codes a floater may occupy.
const FLOATER_ALLOWED = new Set([TERRAIN.WATER]);

export class Grid {
  /**
   * @param {number} cols number of tile columns
   * @param {number} rows number of tile rows
   * @param {number} tileSize world units per tile (from geometry)
   * @param {number} originX world x of tile (0,0) top-left corner
   * @param {number} originY world y of tile (0,0) top-left corner
   */
  constructor(cols, rows, tileSize, originX = 0, originY = 0) {
    this.cols = cols | 0;
    this.rows = rows | 0;
    this.tileSize = tileSize;
    this.originX = originX;
    this.originY = originY;
    // Flat terrain array (row-major).
    this.cells = new Uint8Array(this.cols * this.rows);
    // Structure id occupying each cell (0 = none). Uint32 for ids.
    this.occupants = new Int32Array(this.cols * this.rows).fill(-1);
    // Base terrain snapshot so we can clear a structure back to its natural
    // ground/water without losing lane info. Filled by resetBaseTerrain.
    this.baseCells = new Uint8Array(this.cols * this.rows);
  }

  // ---------- indexing helpers ----------

  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }

  idx(cx, cy) {
    return cy * this.cols + cx;
  }

  // ---------- terrain access ----------

  get(cx, cy) {
    if (!this.inBounds(cx, cy)) return TERRAIN.WALL; // out-of-bounds treated as solid
    return this.cells[this.idx(cx, cy)];
  }

  set(cx, cy, code) {
    if (!this.inBounds(cx, cy)) return;
    this.cells[this.idx(cx, cy)] = code;
  }

  getOccupant(cx, cy) {
    if (!this.inBounds(cx, cy)) return -1;
    return this.occupants[this.idx(cx, cy)];
  }

  // ---------- base terrain memory ----------

  // Record the "natural" (no-structure) terrain so structures can be removed
  // cleanly. Call after seeding water/ground/base from geometry.
  snapshotBaseTerrain() {
    this.baseCells.set(this.cells);
  }

  baseTerrainAt(cx, cy) {
    if (!this.inBounds(cx, cy)) return TERRAIN.WALL;
    return this.baseCells[this.idx(cx, cy)];
  }

  // ---------- world <-> tile conversion ----------

  worldToTile(wx, wy) {
    const cx = Math.floor((wx - this.originX) / this.tileSize);
    const cy = Math.floor((wy - this.originY) / this.tileSize);
    return { cx, cy };
  }

  // Center of a tile in world coords.
  tileToWorld(cx, cy) {
    return {
      x: this.originX + (cx + 0.5) * this.tileSize,
      y: this.originY + (cy + 0.5) * this.tileSize,
    };
  }

  // Corner (top-left) of a tile in world coords.
  tileCorner(cx, cy) {
    return {
      x: this.originX + cx * this.tileSize,
      y: this.originY + cy * this.tileSize,
    };
  }

  // ---------- domain-aware walkability ----------

  isWalkerBlocked(cx, cy) {
    if (!this.inBounds(cx, cy)) return true;
    return WALKER_BLOCKED.has(this.cells[this.idx(cx, cy)]);
  }

  isWalkerOpen(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    const c = this.cells[this.idx(cx, cy)];
    // walkers may walk OPEN and stand on BASE (their goal region)
    return c === TERRAIN.OPEN || c === TERRAIN.BASE;
  }

  isFloaterOpen(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    return FLOATER_ALLOWED.has(this.cells[this.idx(cx, cy)]);
  }

  // Generic per-domain passability used by pathfinding.
  // domain: 'walker' | 'floater' | 'flyer'
  passable(cx, cy, domain) {
    if (domain === 'flyer') return this.inBounds(cx, cy);
    if (domain === 'floater') return this.isFloaterOpen(cx, cy);
    // walker
    return this.isWalkerOpen(cx, cy);
  }

  // ---------- footprint queries ----------

  // Iterate all tiles inside a footprint rectangle (in tile coords).
  *footprintTiles(cx, cy, w = 1, h = 1) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        yield { cx: cx + dx, cy: cy + dy };
      }
    }
  }

  // True if every tile of a footprint is free to build on (natural OPEN or WATER
  // for moats, OPEN for walls/towers) AND unoccupied.
  // buildKind: 'wall' | 'moat' | 'tower'
  canPlace(cx, cy, w, h, buildKind) {
    for (const t of this.footprintTiles(cx, cy, w, h)) {
      if (!this.inBounds(t.cx, t.cy)) return false;
      const i = this.idx(t.cx, t.cy);
      if (this.occupants[i] !== -1) return false;
      const cur = this.cells[i];
      if (buildKind === 'moat') {
        // Moats can be dug on open ground (and stay blocking) but not on base.
        if (cur !== TERRAIN.OPEN) return false;
      } else if (buildKind === 'wall') {
        if (cur !== TERRAIN.OPEN) return false;
      } else {
        // towers/structures require open ground slots
        if (cur !== TERRAIN.OPEN) return false;
      }
    }
    return true;
  }

  // ---------- occupancy mutation ----------

  // Stamp a structure into the grid. Marks terrain code + occupant id.
  // Returns true on success.
  place(structureId, cx, cy, w, h, buildKind) {
    if (!this.canPlace(cx, cy, w, h, buildKind)) return false;
    let code = TERRAIN.SLOT;
    if (buildKind === 'wall') code = TERRAIN.WALL;
    else if (buildKind === 'moat') code = TERRAIN.MOAT;
    for (const t of this.footprintTiles(cx, cy, w, h)) {
      const i = this.idx(t.cx, t.cy);
      this.cells[i] = code;
      this.occupants[i] = structureId;
    }
    return true;
  }

  // Remove a structure's footprint, restoring natural terrain.
  remove(structureId, cx, cy, w, h) {
    for (const t of this.footprintTiles(cx, cy, w, h)) {
      if (!this.inBounds(t.cx, t.cy)) continue;
      const i = this.idx(t.cx, t.cy);
      if (this.occupants[i] === structureId) {
        this.occupants[i] = -1;
        this.cells[i] = this.baseCells[i];
      }
    }
  }

  // Remove by scanning (used when footprint unknown) — clears every cell that
  // references the id.
  removeById(structureId) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.occupants[i] === structureId) {
        this.occupants[i] = -1;
        this.cells[i] = this.baseCells[i];
      }
    }
  }

  // ---------- seeding from geometry ----------

  // Seed the grid terrain from a geometry description.
  // geo shape (see src/sim/geometry.js):
  //   { groundBand:{x,y,w,h}, waterBand:{x,y,w,h}, base:{x,y,w,h} }
  // All in world coords. This paints WATER / BASE over the default OPEN grid.
  seedFromGeometry(geo) {
    this.cells.fill(TERRAIN.OPEN);
    this.occupants.fill(-1);
    const paint = (rect, code) => {
      if (!rect) return;
      const a = this.worldToTile(rect.x, rect.y);
      const b = this.worldToTile(rect.x + rect.w, rect.y + rect.h);
      const x0 = Math.max(0, Math.min(a.cx, b.cx));
      const y0 = Math.max(0, Math.min(a.cy, b.cy));
      const x1 = Math.min(this.cols - 1, Math.max(a.cx, b.cx));
      const y1 = Math.min(this.rows - 1, Math.max(a.cy, b.cy));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          this.cells[this.idx(cx, cy)] = code;
        }
      }
    };
    paint(geo.waterBand, TERRAIN.WATER);
    paint(geo.base, TERRAIN.BASE);
    this.snapshotBaseTerrain();
  }

  // ---------- serialization for replay/determinism ----------

  serialize() {
    return {
      cols: this.cols,
      rows: this.rows,
      tileSize: this.tileSize,
      originX: this.originX,
      originY: this.originY,
      cells: Array.from(this.cells),
      occupants: Array.from(this.occupants),
      baseCells: Array.from(this.baseCells),
    };
  }

  static deserialize(data) {
    const g = new Grid(
      data.cols,
      data.rows,
      data.tileSize,
      data.originX,
      data.originY
    );
    g.cells = Uint8Array.from(data.cells);
    g.occupants = Int32Array.from(data.occupants);
    g.baseCells = Uint8Array.from(data.baseCells);
    return g;
  }

  // Simple deterministic hash of terrain state (for replay assertions).
  terrainHash() {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < this.cells.length; i++) {
      h ^= this.cells[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    for (let i = 0; i < this.occupants.length; i++) {
      h ^= this.occupants[i] & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
}

// Convenience factory that builds a grid sized to a geometry board.
export function createGridFromGeometry(geo, tileSize) {
  const width = geo.board ? geo.board.w : geo.width;
  const height = geo.board ? geo.board.h : geo.height;
  const originX = geo.board ? geo.board.x : 0;
  const originY = geo.board ? geo.board.y : 0;
  const cols = Math.max(1, Math.ceil(width / tileSize));
  const rows = Math.max(1, Math.ceil(height / tileSize));
  const grid = new Grid(cols, rows, tileSize, originX, originY);
  grid.seedFromGeometry(geo);
  return grid;
}

export default Grid;