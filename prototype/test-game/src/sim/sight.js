/**
 * sight.js — terrain line of sight for the attacking waves [MM-task_mw7609dp_1].
 *
 * Owner 2026-11-07: waves can't see behind tree lines and mountain obstructions; the sight map is built from the
 * terrain map only — game structures never affect it.
 *
 * The sight grid is one byte per map cell (1 = blocks sight), built once from map.terrain when the sim is created,
 * so it is deterministic and replay-safe. A ground attacker sees a target when the straight line between them crosses
 * no blocking cell (the shooter's and the target's own cells don't count). Flyers see over everything and are seen
 * over everything. The base is exempt: it is reached, not sighted (combat.js inBaseReach is the one rule for it).
 * A board without terrain (the classic board, the harness) has no grid, so everything stays visible.
 */
import { TERRAIN } from '../terrain/terrainGen.js';

/** Terrain that blocks sight: tree lines and mountains (cliffs). Rocks, brush, dirt, grass and water do not. */
export const SIGHT_BLOCKING = Object.freeze(new Set([TERRAIN.TREES, TERRAIN.TREE_BORDER, TERRAIN.CLIFF, TERRAIN.CLIFF_BORDER]));

/** Sample spacing along a sight line, in cells. Small enough that a line can't skip a corner cell it clips. */
const STEP = 0.25;

/** The sight grid for a map, or null when the map has no terrain. → { cols, rows, cells: Uint8Array } */
export function buildSightGrid(map) {
  const T = map && map.terrain;
  const cols = map && map.cols, rows = map && map.rows;
  if (!T || !T.length || !cols || !rows) return null;
  const cells = new Uint8Array(cols * rows);
  let any = false;
  for (let i = 0; i < cols * rows; i++) if (SIGHT_BLOCKING.has(T[i])) { cells[i] = 1; any = true; }
  return any ? { cols, rows, cells } : null;
}

/** Does the straight line from a to b (cell coordinates) cross a sight-blocking cell? */
export function lineClear(grid, a, b) {
  if (!grid) return true;
  const ax = Math.round(a.x), ay = Math.round(a.y), bx = Math.round(b.x), by = Math.round(b.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const n = Math.ceil(Math.hypot(dx, dy) / STEP);
  for (let k = 1; k < n; k++) {
    const x = Math.round(a.x + (dx * k) / n), y = Math.round(a.y + (dy * k) / n);
    if ((x === ax && y === ay) || (x === bx && y === by)) continue;
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
    if (grid.cells[y * grid.cols + x]) return false;
  }
  return true;
}

/** Can this attacker see that target? Only ground-to-ground sight of the attacking side is limited. */
export function attackerSees(state, shooter, target) {
  if (!state || !state.sightGrid || !shooter || !target) return true;
  if (shooter.side !== 'attacker') return true;
  if (shooter.domain === 'Flyer' || target.domain === 'Flyer') return true;
  if (target === state.base) return true;
  return lineClear(state.sightGrid, shooter.pos, target.pos);
}
