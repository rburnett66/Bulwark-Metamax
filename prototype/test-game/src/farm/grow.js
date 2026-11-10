/**
 * src/farm/grow.js — how a farm's plants grow between two moments [MM-story_mwabgeyj_a].
 *
 * The farm is a layer ON the outpost (owner rule 7, 2026-11-10: "the farm is a new system on top of the outpost"): it
 * has no clock of its own. The outpost's advance() (src/outpost/model.js) cuts time at its events (a build finishing, a
 * raid) and, for every stretch between them, calls growFarm() here with the power state of that stretch. So a Pump that
 * loses power at a raid slows its Irrigated plots from that moment, and advancing once over 72 hours equals advancing
 * in one-minute steps.
 *
 * A plant's progress is a share 0 → 1 of its grow time, gained at the plot's speed (the method's, when it has water).
 * At 1 it is Fruited (ripeAt records when); it stays Fruited for its window (Fruited_Window × its own grow time) and is
 * Dead after. Nothing here stops growth: a full Silo blocks HARVEST, never growth (owner, 2026-11-10).
 *
 * Pure: no DOM, no storage, no clock. Mutates the outpost it is given (advance() works on its own clone).
 */
import { FARM, cropOf, methodOf, growSec, farmBuildingOf } from '../data/farm.js';
import { TERRAIN } from '../terrain/terrainGen.js';

const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A farm building is finished once its build time is over at time t. */
export const finished = (b, t) => b.done <= t;

/**
 * Whether a plot has water within reach at time t: a natural water cell of the map within the method's reach of the
 * plot's centre, or a finished, powered Pump whose own reach covers it. `powered` is the Set from powerGrids().
 */
export function hasWater(o, map, plot, t, powered) {
  const m = methodOf(plot.method);
  if (!m || !m.waterReach) return false;
  const c = centre(plot);
  for (const [id, b] of Object.entries(o.farm.buildings || {})) {
    if (b.kind !== 'pump' || !finished(b, t) || (powered && !powered.has(id))) continue;
    if (dist(c, centre(b)) <= farmBuildingOf('pump').waterReach) return true;
  }
  const T = map && map.terrain;
  if (!T) return false;
  const W = map.width, R = m.waterReach;
  for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++) {
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
      if (x < 0 || y < 0 || x >= W || y >= map.height) continue;
      if (T[y * W + x] === TERRAIN.WATER && dist(c, [x + 0.5, y + 0.5]) <= R) return true;
    }
  }
  return false;
}

/** A plot's growth speed at time t: its method's speed with water, else Traditional speed (1). */
export function plotSpeed(o, map, plot, t, powered) {
  const m = methodOf(plot.method);
  if (!m) return 1;
  if (!m.waterReach) return m.speed;
  return hasWater(o, map, plot, t, powered) ? m.speed : 1;
}

/** Seconds the plot's crop stays Fruited before it dies: Fruited_Window × its grow time with the plot's method. */
export const windowSec = (plot) => growSec(plot.crop, plot.method) * FARM.Fruited_Window;

/**
 * Grow every planted plot from `from` to `to` (ms) at the speeds of that stretch. Records each plant that ripens or
 * dies inside it in report.farm ({ ripened: [{ plot, crop, at }], died: [...] }). Mutates o.
 */
export function growFarm(o, map, from, to, powered, report) {
  if (!o.farm || !(to > from)) return;
  const R = report && (report.farm ||= { ripened: [], died: [] });
  for (const p of Object.values(o.farm.plots || {})) {
    if (!p.crop) continue;
    const c = cropOf(p.crop);
    if (!c) continue;
    if (p.progress < 1) {
      const start = Math.max(from, p.plantedAt);
      if (to <= start) continue;
      const perMs = plotSpeed(o, map, p, start, powered) / (c.growHours * 3600 * 1000);
      const need = (1 - p.progress) / perMs;
      if (to - start >= need) {
        p.progress = 1;
        p.ripeAt = start + need;
        if (R) R.ripened.push({ plot: p.id, crop: p.crop, at: p.ripeAt });
      } else p.progress += (to - start) * perMs;
    }
    if (p.progress >= 1 && p.ripeAt != null) {
      const dies = p.ripeAt + windowSec(p) * 1000;
      if (dies > from && dies <= to && R) R.died.push({ plot: p.id, crop: p.crop, at: dies });
    }
  }
}

/** The moments inside (from, to] when a farm building finishes (they change power and water). */
export function farmBuildEvents(o, from, to) {
  if (!o.farm) return [];
  return Object.entries(o.farm.buildings || {}).filter(([, b]) => b.done > from && b.done <= to).map(([id, b]) => ({ at: b.done, farmBuilt: id }));
}
