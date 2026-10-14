/**
 * src/render3d/overlays/pathLinesModel.js — WHICH expected-path lines exist, where they run, how visible they
 * are (plan v2.2.2 §6.7; code design §4.12). T3b [MM-story_mv79mi1o_d]. Pure: no three.js, no DOM.
 *
 * Owner goal 10: "the line from spawn to the base will only be on while units from that spawn are alive. Each
 * wave lines should be drawn will a slightly different color."
 *
 * A line is keyed by a unit ORIGIN (T0b): `${wave}:${lane}:${point}`. It runs from that wave's painted spawn
 * point to the base along the SIM's current nav grid (`state.navGrid`, which includes walls and towers), using
 * the sim's own `findRoute` — never a copy. When the sim replaces its nav grid (a structure was built, sold or
 * destroyed) every live line re-routes. Lines ramp in over FADE seconds while any live unit carries the origin
 * and ramp out FADE seconds after the last one dies, then disappear.
 *
 * Only GROUND origins get a line: air and water units travel straight (getFlyerPath / the fixed water lane),
 * not along the walker grid. Origins with `point: null` (workbook maps — no painted points) get none.
 * READ-ONLY on the sim.
 */
import { findRoute } from '../../sim/pathfinding.js';

export const FADE = 0.3;                                   // seconds in / out
export const WAVE_HUES = [186, 198, 174, 210, 162, 222, 150, 234];

export const lineKey = (o) => `${o.wave}:${o.lane}:${o.point}`;

/** Per-wave colour as HSL (h 0..360, s, l) — the prototype's palette; alternate waves differ in lightness. */
export function waveHsl(wave) {
  const w = Math.max(1, wave | 0);
  return { h: WAVE_HUES[(w - 1) % WAVE_HUES.length], s: 0.62, l: (w % 2) ? 0.62 : 0.52 };
}

/** The painted spawn cell an origin names, or null. */
export function spawnCell(map, origin) {
  if (!origin || origin.point === null || origin.point === undefined || !map || !map.rings) return null;
  const ring = map.rings[Math.max(1, Math.min(origin.wave, map.rings.length)) - 1];
  const list = ring && ring.spawnList && ring.spawnList[origin.lane];
  const p = list && list[origin.point];
  return p ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
}

/** Route cells from the spawn to the base on `nav` (start included), or null when there is no route. */
export function routeFor(nav, from, base) {
  if (!nav || !from || !base) return null;
  const r = findRoute(nav, from, { x: base.x, y: base.y });
  return r && r.length ? [from, ...r] : null;
}

const pathLength = (pts) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
};

/**
 * The line set. update(state, map, dt) advances it one frame and returns { geometryDirty } — true when lines
 * were added, removed or re-routed (the renderer rebuilds the mesh); otherwise only alpha / progress moved.
 */
export function createPathLines() {
  const lines = new Map();   // key -> { key, wave, lane, spawn, pts, len, alpha, prog, nav }
  return {
    lines,
    update(state, map, dt) {
      let dirty = false;
      const nav = state && state.navGrid;
      const base = (state && state.base && state.base.pos) || (map && map.base) || null;
      // census of live origins this frame
      const live = new Map();
      if (state && state.units) {
        for (const u of state.units.values()) {
          const o = u && u.hp > 0 && u.origin;
          if (!o || o.lane !== 'ground' || o.point === null || o.point === undefined) continue;
          const k = lineKey(o);
          if (!live.has(k)) live.set(k, o);
        }
      }
      // new lines
      for (const [k, o] of live) {
        if (lines.has(k)) continue;
        const spawn = spawnCell(map, o);
        if (!spawn) continue;
        const pts = routeFor(nav, spawn, base);
        lines.set(k, { key: k, wave: o.wave, lane: o.lane, spawn, pts, len: pts ? pathLength(pts) : 0, alpha: 0, prog: 0, nav });
        dirty = true;
      }
      // fade, re-route on a new nav grid, remove when gone
      const step = Math.max(0, dt || 0) / FADE;
      for (const [k, L] of lines) {
        if (L.nav !== nav) {   // the sim rebuilt its walkable grid (structure change) — follow it
          L.nav = nav;
          L.pts = routeFor(nav, L.spawn, base);
          L.len = L.pts ? pathLength(L.pts) : 0;
          dirty = true;
        }
        if (live.has(k)) {
          L.alpha = Math.min(1, L.alpha + step);
          L.prog = Math.min(1, L.prog + step);
        } else {
          L.alpha -= step;
          if (L.alpha <= 0) { lines.delete(k); dirty = true; }
        }
      }
      return { geometryDirty: dirty };
    },
    clear() { lines.clear(); },
  };
}
