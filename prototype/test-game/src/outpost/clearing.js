/**
 * src/outpost/clearing.js — building on trees and rocks clears them (owner 2026-11-17 [MM-story_mwlcxqzo_8]):
 * "As long as the terrain is flat, player should be able to place structures and see the terrain cleared."
 *
 * A CLEARABLE cell is a blocking tree or rock cell on level ground (the Forge's TREES / ROCKS terrain, not a ramp).
 * Water, cliffs and cliff borders never clear. The live sim lets a placement stand on clearable cells
 * (state.clearable → sim/structures.js validatePlacement), and once something stands there the cell is cleared for
 * good: the save keeps it in o.cleared (sorted cell indices y × width + x), the raid board and the live board treat it
 * as open ground (outpost/raid.js raidSimMap), and the 3D view draws no tree or rock on it (outpostScene syncCleared).
 * Sold or moved away, the ground stays clear: the trees were cut down.
 *
 * Pure: no DOM, no clock.
 */
import { TERRAIN } from '../terrain/terrainGen.js';
import { HEIGHT } from '../terrain/outpostPads.js';
import { occupied } from '../farm/model.js';

const CLEARS = new Set([TERRAIN.TREES, TERRAIN.ROCKS]);

/** Is cell index i a tree or rock cell on level ground (it may be built on, clearing it)? */
export function clearableIndex(map, i) {
  if (!map || !map.terrain || !CLEARS.has(map.terrain[i])) return false;
  return !(map.heights && map.heights[i] === HEIGHT.RAMP);
}

/** Every clearable cell on the map, as the sim's cell keys ('x,y') → a Set (the live sim's state.clearable). */
export function clearableKeys(map) {
  const out = new Set(), w = map && map.width;
  if (!w || !map.terrain) return out;
  for (let i = 0; i < map.terrain.length; i++) if (clearableIndex(map, i)) out.add((i % w) + ',' + Math.floor(i / w));
  return out;
}

/**
 * The cells cleared now: what was cleared before (o.cleared) and every clearable cell under something standing
 * (buildings and build sites, defenses, plots, farm buildings: farm/model.js occupied). → sorted indices.
 */
export function clearedCells(o, map) {
  const w = map.width, out = new Set((o && o.cleared) || []);
  for (const q of occupied(o, map)) {
    for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= map.height) continue;
      const i = y * w + x;
      if (clearableIndex(map, i)) out.add(i);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** The outpost with o.cleared brought up to date (a copy when it changed; `o` itself when nothing new was cleared). */
export function withClearing(o, map) {
  if (!o || !map || !map.terrain) return o;
  const now = clearedCells(o, map), was = o.cleared || [];
  if (now.length === was.length && now.every((v, k) => v === was[k])) return o;
  return { ...o, cleared: now };
}
