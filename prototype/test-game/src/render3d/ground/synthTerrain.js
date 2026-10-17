/**
 * src/render3d/ground/synthTerrain.js — terrain codes for maps that have none. [MM-story_mvbr0oo5_n]
 *
 * Only Terrain Forge maps carry `map.terrain` (one code per cell, terrainGen TERRAIN). The workbook-generated
 * campaign maps (every map without a forge file — maps 2–9 and other factions' maps today) and the classic board
 * do not, and the low-poly ground, obstructions and planet resources all key off those codes — without them the
 * 3D view had no ground at all. This derives codes from what the map DOES carry, so the 3D view draws the same
 * board the sim plays: water cells → water, blocked cells → rocks, the non-buildable approach border → brush,
 * everything else → grass. Pure, presentation only: it returns a render copy and never touches the sim's map.
 */
import { TERRAIN } from '../../terrain/terrainGen.js';

/** The terrain codes for `map` (its own when it has them). */
export function terrainFor(map) {
  if (map && Array.isArray(map.terrain) && map.terrain.length === map.cols * map.rows) return map.terrain;
  const { cols, rows } = map;
  const T = new Array(cols * rows).fill(TERRAIN.GRASS);
  const at = (c) => (c && c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows ? c.y * cols + c.x : -1);
  const pa = map.playArea;
  if (pa) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (x < pa.x0 || x > pa.x1 || y < pa.y0 || y > pa.y1) T[y * cols + x] = TERRAIN.BRUSH;
  for (const c of map.blockedCells || []) { const i = at(c); if (i >= 0) T[i] = TERRAIN.ROCKS; }
  for (const c of map.waterCells || []) { const i = at(c); if (i >= 0) T[i] = TERRAIN.WATER; }
  return T;
}

/** A render copy of `map` with terrain codes — the sim's own object is returned untouched when it has them. */
export function renderMapFor(map) {
  if (!map) return map;
  const T = terrainFor(map);
  return T === map.terrain ? map : Object.assign({}, map, { terrain: T, synthTerrain: true });
}
