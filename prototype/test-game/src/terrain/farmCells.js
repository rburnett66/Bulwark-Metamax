/**
 * src/terrain/farmCells.js — the outpost map's farmable-cell layer (story A6 [MM-story_mwabgjcm_c]; Farming-Design
 * §2.1, tech plan docs/tech-plan/Farming.md §5 A6).
 *
 * One map, two modes: the outpost owns the mesa and its pads; the farm owns the land round it that is not a raid lane.
 * Every cell of an outpost map is tagged with what it supports — flat soil, slope, water, grove, collection field —
 * from the terrain data the Forge already has (height level, water, obstruction families, decor groves, resource
 * fields) plus the cart tracks stampOutpost wears for the raid lanes. The Terrain Forge derives it on export and writes
 * it to the map as `farmCells` (one code per cell, row-major, like `terrain`); src/outpost/outpostMap.js passes it
 * through and src/farm/cells.js reads it. Pure; no DOM.
 */
import { TERRAIN, BLOCKING } from './terrainGen.js';
import { HEIGHT } from './outpostPads.js';

/** Cell codes, as stored in `farmCells`. NONE: the outpost's (mesa top, pads and their yards) or bare stone. */
export const FARM_CELL = Object.freeze({ NONE: 0, SOIL: 1, SLOPE: 2, WATER: 3, GROVE: 4, COLLECTION: 5, LANE: 6 });
/** Code → tag name. */
export const FARM_CELL_NAME = Object.freeze(['none', 'soil', 'slope', 'water', 'grove', 'collection', 'lane']);
/** Review colours (the Forge overlay and tools/farming/cells.html). */
export const FARM_CELL_COLOR = Object.freeze(['rgba(0,0,0,0)', '#8fd16a', '#d6a35a', '#3f8fe0', '#1f6b3a', '#e0c24a', '#ff9a3d']);

/**
 * Derive the layer. map: { cols, rows, terrain, blocking, heights, pads, decor, resources }; lanes: the cart-track
 * mask stampOutpost leaves on its grid (g.lanes; 1 = raid lane). Priority, first match wins:
 *   mesa top → none · ramp → slope · a pad or its 1-cell yard → none · raid lane → lane · water → water ·
 *   a resource field → collection · trees, tree border or a decor prop → grove · other blocking or stone → none ·
 *   lowland at the cliff's foot (touching the mesa) → slope · grass, dirt, brush → soil.
 * → Array of FARM_CELL codes (length cols × rows).
 */
export function deriveFarmCells(map, lanes = null) {
  const cols = map.cols ?? map.width, rows = map.rows ?? map.height, n = cols * rows;
  const T = map.terrain, B = map.blocking, H = map.heights;
  const out = new Array(n).fill(FARM_CELL.NONE);
  if (!T) return out;
  const mark = (list) => { const s = new Set(); for (const p of list || []) s.add(p.y * cols + p.x); return s; };
  const decor = mark(map.decor), fields = mark(map.resources);
  const nearPad = (x, y) => (map.pads || []).some((p) => x >= p.x - 1 && x < p.x + p.w + 1 && y >= p.y - 1 && y < p.y + p.h + 1);
  const top = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && H && H[y * cols + x] === HEIGHT.TOP;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x, t = T[i], h = H ? H[i] : HEIGHT.LOW;
    let c;
    if (h === HEIGHT.TOP) c = FARM_CELL.NONE;
    else if (h === HEIGHT.RAMP) c = FARM_CELL.SLOPE;
    else if (nearPad(x, y)) c = FARM_CELL.NONE;
    else if (lanes && lanes[i]) c = FARM_CELL.LANE;
    else if (t === TERRAIN.WATER) c = FARM_CELL.WATER;
    else if (fields.has(i)) c = FARM_CELL.COLLECTION;
    else if (t === TERRAIN.TREES || t === TERRAIN.TREE_BORDER || decor.has(i)) c = FARM_CELL.GROVE;
    else if (BLOCKING.has(t) || (B && B[i]) || t === TERRAIN.ROCK_BORDER || t === TERRAIN.CLIFF_BORDER) c = FARM_CELL.NONE;
    else {
      let foot = false;
      for (let dy = -1; dy <= 1 && !foot; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && top(x + dx, y + dy)) { foot = true; break; }
      c = foot ? FARM_CELL.SLOPE : FARM_CELL.SOIL;
    }
    out[i] = c;
  }
  return out;
}

/** Per-tag counts of a layer: { soil, slope, water, grove, collection, lane, none }. */
export function farmCellCounts(cells) {
  const out = Object.fromEntries(FARM_CELL_NAME.map((k) => [k, 0]));
  for (const c of cells || []) out[FARM_CELL_NAME[c] || 'none']++;
  return out;
}
