/**
 * src/render3d/fx/trackMarks.js — wheeled and treaded ground vehicles leave track marks [MM-task_mvj0wz2d_1].
 *
 * Owner 2026-10-21: "add vehicles track for wheeled and treaded units? The only need to extend about 5 unit lengths and
 * fade away after 5 seconds." While a vehicle drives, it stamps a pair of marks on the ground under its two wheel /
 * tread lines every few hundredths of a cell travelled. A trail reaches back at most TRACKS.lengths of the vehicle's
 * OWN length (the tail fades out over the last stretch) and every mark fades away over TRACKS.life seconds.
 *
 * WHAT leaves marks is read from each model's part list (trackSpecFor), so a new unit model is covered without a table:
 *   - tread: it has a track loop (prims.track → material 'track'); gauge = the loop's lateral centre, width = its depth
 *   - wheel: no tracks, but z-axis wheels whose bottoms touch the ground; gauge = the outermost wheel, width = its tyre
 *   - none:  flyers / hover models, legged walkers, anything with neither (infantry, the miner…)
 * Never on water, never while stopped, never in the air.
 *
 * Pure: no three.js. The view (trackMarksView.js) draws `instances()` as one InstancedMesh.
 */
import { partBox } from '../units/shadow.js';
import { UNIT_SCALE } from '../units/modelKeys.js';

export const TRACKS = Object.freeze({
  life: 5,           // seconds for a mark to fade away
  lengths: 5,        // a trail reaches back this many of the vehicle's own lengths
  tailFade: 0.35,    // … the last 35% of that fades out
  spacing: 0.14,     // cells travelled between stamps (each stamp is a little longer, so the strip is continuous)
  minSpeed: 0.05,    // cells / s — slower than this is standing still
  minWidth: 0.06,    // cells — the thinnest mark (a carriage's narrow rim still reads)
  cap: 2400,         // marks alive at once (2 per stamp); the oldest go first
  opacity: { tread: 0.36, wheel: 0.3 },
});


/** Track spec of one model def, in MODEL units: { kind: 'tread'|'wheel', gauge, width, length } or null. */
export function trackSpecFor(def) {
  if (!def || !Array.isArray(def.parts) || def.hover || (def.deploy && def.deploy.legs)) return null;
  const boxes = def.parts.filter((p) => !/^glow/.test(p.m || '')).map((p) => partBox(p));
  if (!boxes.length) return null;
  const length = Math.max(...boxes.map((b) => b[1][0])) - Math.min(...boxes.map((b) => b[0][0]));
  const treads = def.parts.filter((p) => p.t === 'ext' && p.m === 'track' && Array.isArray(p.d));
  if (treads.length) {
    const t = treads.reduce((a, p) => (Math.abs((p.d[0] + p.d[1]) / 2) > Math.abs((a.d[0] + a.d[1]) / 2) ? p : a));
    const gauge = Math.abs((t.d[0] + t.d[1]) / 2), width = Math.abs(t.d[1] - t.d[0]);
    if (gauge > 0.05) return { kind: 'tread', gauge, width, length };
  }
  // ground-touching wheels: round z-axis parts — a cylinder, or a ring / tyre extrusion (spoked carriage wheels) — at
  // least 0.2 tall, bottom within a hair of the ground, off the centre line, not in a moving group
  const wheels = [];
  for (const p of def.parts) {
    if (p.ax !== 'z' || p.g || p.r3 || p.m === 'track') continue;
    const round = (p.t === 'cyl' && typeof p.r === 'number') || (p.t === 'ext' && Array.isArray(p.holes) && p.holes.length);
    if (!round) continue;
    const [mn, mx] = partBox(p), z = (mn[2] + mx[2]) / 2;
    if (mn[1] > 0.06 || mx[1] - mn[1] < 0.2 || (!p.mir && Math.abs(z) < 0.05)) continue;
    wheels.push({ gauge: Math.abs(z), width: mx[2] - mn[2], mir: !!p.mir });
  }
  if (wheels.length >= 2 || wheels.some((w) => w.mir)) {
    const w = wheels.reduce((a, q) => (q.gauge > a.gauge ? q : a));
    if (w.gauge > 0.05) return { kind: 'wheel', gauge: w.gauge, width: Math.max(0.08, w.width), length };
  }
  return null;
}

/** Specs for a whole model table: { [modelKey]: spec | null }. */
export function trackSpecs(models) {
  const out = {};
  for (const [k, def] of Object.entries(models || {})) out[k] = trackSpecFor(def);
  return out;
}

/**
 * The planner. specs: trackSpecs(UNIT_MODELS); isWater(x, z) → true over water (world coords, optional);
 * opts.cap overrides TRACKS.cap (quality tier).
 */
export function createTrackMarks(specs, { isWater = null, cap = TRACKS.cap } = {}) {
  const marks = [];               // { x, z, a, len, w, kind, born, unit, odo, reach }
  const units = new Map();        // unit id → { x, z, odo, acc }
  let now = 0;
  const api = {
    /** views: this frame's unit views { id, model, x, z, y, heading, scale }. */
    step(dt, views) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      now += d;
      const seen = new Set();
      if (views) for (const v of views) {
        const spec = specs[v.model];
        if (!spec || (v.y || 0) > 0.02) continue;
        seen.add(v.id);
        let U = units.get(v.id);
        if (!U) { units.set(v.id, { x: v.x, z: v.z, odo: 0, acc: 0 }); continue; }
        const moved = Math.hypot(v.x - U.x, v.z - U.z);
        if (moved > 1.5) { U.x = v.x; U.z = v.z; U.acc = 0; continue; }                  // teleported (respawn, pool reuse)
        if (d > 0 && moved / d < TRACKS.minSpeed) { U.x = v.x; U.z = v.z; continue; }    // standing still
        U.odo += moved; U.acc += moved; U.x = v.x; U.z = v.z;
        const k = UNIT_SCALE * (v.scale || 1);
        const reach = spec.length * k * TRACKS.lengths;
        while (U.acc >= TRACKS.spacing) {
          U.acc -= TRACKS.spacing;
          const h = v.heading || 0, fx = Math.cos(h), fz = Math.sin(h), g = spec.gauge * k;
          for (const sd of [-1, 1]) {
            const x = v.x - fz * g * sd, z = v.z + fx * g * sd;
            if (isWater && isWater(x, z)) continue;
            marks.push({ x, z, a: h, len: TRACKS.spacing * 1.25, w: Math.max(TRACKS.minWidth, spec.width * k), kind: spec.kind, born: now, unit: v.id, odo: U.odo, reach });
          }
        }
      }
      for (const id of [...units.keys()]) if (!seen.has(id)) units.delete(id);   // gone / airborne: its marks fade by time alone
      // retire: too old, or beyond its vehicle's reach; then the cap (oldest first — marks are in birth order)
      let w = 0;
      for (const m of marks) {
        if (now - m.born >= TRACKS.life) continue;
        const U = units.get(m.unit);
        if (U && U.odo - m.odo >= m.reach) continue;
        marks[w++] = m;
      }
      marks.length = w;
      if (marks.length > cap) marks.splice(0, marks.length - cap);
      return marks.length;
    },
    /** The marks to draw now: [{ x, z, a, len, w, kind, alpha }] — alpha folds the time fade and the tail fade. */
    instances() {
      const out = [];
      for (const m of marks) {
        const tAge = (now - m.born) / TRACKS.life;
        const U = units.get(m.unit);
        const along = U ? (U.odo - m.odo) / m.reach : 0;
        const tail = along <= 1 - TRACKS.tailFade ? 1 : Math.max(0, (1 - along) / TRACKS.tailFade);
        const alpha = TRACKS.opacity[m.kind] * Math.max(0, 1 - tAge) * tail;
        if (alpha > 0.003) out.push({ x: m.x, z: m.z, a: m.a, len: m.len, w: m.w, kind: m.kind, alpha });
      }
      return out;
    },
    get count() { return marks.length; },
    clear() { marks.length = 0; units.clear(); },
  };
  return api;
}
