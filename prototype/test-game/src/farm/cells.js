/**
 * src/farm/cells.js — the farm's reading of the outpost map (story A6 [MM-story_mwabgjcm_c]; Farming-Design §2.1,
 * §4.4; tech plan docs/tech-plan/Farming.md §5 A6).
 *
 * The farm is a mode on the outpost map, not a map of its own: it reads the map outpostMapFromForge already shaped
 * (src/outpost/outpostMap.js) — its farmCells layer (src/terrain/farmCells.js, authored by the Terrain Forge), heights,
 * terrain, blocking and pads — and never recomputes them. Pure; no DOM, no clock.
 */
import { FARM_CELL, FARM_CELL_NAME } from '../terrain/farmCells.js';
import { BLOCKING } from '../terrain/terrainGen.js';
import { HEIGHT } from '../terrain/outpostPads.js';

export { FARM_CELL, FARM_CELL_NAME };

/** A Traditional plot's footprint (Farming-Design §4.4): 2 × 2 battle cells, an outpost pad's size. */
export const PLOT_SIZE = Object.freeze({ w: 2, h: 2 });

/** Does the shaped map carry a farm-cell layer? (The draft layout and older maps do not.) */
export const hasFarmLayer = (map) => !!(map && map.farmCells && map.farmCells.length === map.width * map.height);

/** The farm tag of a cell: 'soil' | 'slope' | 'water' | 'grove' | 'collection' | 'lane' | 'none'; null off the map
 *  or on a map without the layer. */
export function farmCellAt(map, x, y) {
  if (!hasFarmLayer(map) || x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return FARM_CELL_NAME[map.farmCells[y * map.width + x]] || 'none';
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * May a farm thing of w × h cells stand with its top-left at (x, y)? → true, or the first refusal:
 *   'no farm layer' · 'off the map' · 'on the mesa' · 'on a pad' (a pad or its 1-cell yard, as surfaceFields keeps) ·
 *   'on a raid lane' · 'on blocking terrain' · 'on a defense' · 'overlaps another farm thing' · 'not soil'.
 * outpost: the outpost save (its defenses' cells are refused), or null. occupied: the farm's own rects
 * [{ x, y, w, h }] (plots, the Farmhouse, the Silo; the farm model passes them).
 */
export function canPlacePlot(map, outpost, x, y, w = PLOT_SIZE.w, h = PLOT_SIZE.h, occupied = []) {
  if (!hasFarmLayer(map)) return 'no farm layer';
  const cols = map.width, rows = map.height;
  if (!(Number.isInteger(x) && Number.isInteger(y)) || x < 0 || y < 0 || x + w > cols || y + h > rows) return 'off the map';
  const cells = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy, (y + dy) * cols + x + dx]);
  const H = map.heights, T = map.terrain, B = map.blocking, F = map.farmCells;
  if (H && cells.some(([, , i]) => H[i] === HEIGHT.TOP || H[i] === HEIGHT.RAMP)) return 'on the mesa';
  if ((map.pads || []).some((p) => cells.some(([cx, cy]) => cx >= p.x - 1 && cx < p.x + p.w + 1 && cy >= p.y - 1 && cy < p.y + p.h + 1))) return 'on a pad';
  if (cells.some(([, , i]) => F[i] === FARM_CELL.LANE)) return 'on a raid lane';
  if (cells.some(([, , i]) => (T && BLOCKING.has(T[i])) || (B && B[i]))) return 'on blocking terrain';
  const defenses = (outpost && outpost.defenses) || [];
  if (defenses.some((d) => cells.some(([cx, cy]) => d.cell[0] === cx && d.cell[1] === cy))) return 'on a defense';
  const me = { x, y, w, h };
  if ((occupied || []).some((r) => overlaps(me, r))) return 'overlaps another farm thing';
  if (cells.some(([, , i]) => F[i] !== FARM_CELL.SOIL)) return 'not soil';
  return true;
}

/** Every top-left where a w × h plot may stand (they overlap one another): [[x, y]]. */
export function plotSpots(map, outpost = null, w = PLOT_SIZE.w, h = PLOT_SIZE.h, occupied = []) {
  const out = [];
  if (!hasFarmLayer(map)) return out;
  for (let y = 0; y + h <= map.height; y++) for (let x = 0; x + w <= map.width; x++) {
    if (canPlacePlot(map, outpost, x, y, w, h, occupied) === true) out.push([x, y]);
  }
  return out;
}

/** How many w × h plots fit side by side, packed row by row from the top-left (a lower bound on the farm's room):
 *  → [{ x, y, w, h }]. */
export function packPlots(map, outpost = null, w = PLOT_SIZE.w, h = PLOT_SIZE.h) {
  const placed = [];
  for (const [x, y] of plotSpots(map, outpost, w, h)) {
    const r = { x, y, w, h };
    if (!placed.some((q) => overlaps(q, r))) placed.push(r);
  }
  return placed;
}
