/**
 * src/render3d/fx/buildFx.js — dirt puffs around a structure while it is being built. [MM-story_mvedxrmi_6]
 *
 * Owner 2026-10-18: "when build up a unit there should be dirt puffs around the base during construction."
 *   · BREAK GROUND — the sim's `build` event (phase 'start'): a low dust ring snaps out from the footprint and a
 *     burst of puffs lifts off the ground;
 *   · WHILE BUILDING — a structure with lifecycle 'Building' kicks up dusty puffs at random points on its footprint
 *     edge, low and drifting outward; the rate eases off as `progress` approaches 1;
 *   · SETTLE — phase 'complete': one last soft burst as the dust settles.
 * Counts scale with the quality tier (Low ≈ a quarter of High).
 *
 * Read-only on the sim; its own seeded PRNG (never Math.random); render-only. Pure: no three.js — it emits into the
 * world-impact particles (fx/impacts.js) like repairFx.js. Events are consumed once (keyed tick:id:phase).
 */
import { cellToWorld } from '../camera.js';

export const BUILD_FX = Object.freeze({
  rate: 12,             // puffs / s around a 1×1 footprint at progress 0 (× perimeter for bigger footprints)
  ease: 0.75,           // the rate falls by this share as progress → 1
  size: [0.07, 0.12],   // birth size, world units
  grow: 1.0,
  life: [1.0, 1.7],
  out: [0.25, 0.6],     // outward drift speed
  up: [0.12, 0.32],     // lift
  drag: 1.8,
  shade: 0.55,          // with dusty = 1 → earthy brown
  start: 14,            // puffs in the break-ground burst
  settle: 10,           // puffs in the settling burst
  ring: Object.freeze({ grow: 0.9, life: 0.4, col: Object.freeze([0.78, 0.66, 0.5]), a: 0.35 }),
});

/** Puff-count multiplier per quality tier key. */
export const BUILD_TIER = Object.freeze({ high: 1, standard: 0.7, low: 0.25 });

export function createBuildFx({ seed = 23 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (r) => r[0] + (r[1] - r[0]) * rnd();
  const acc = new Map();    // structure id → fractional puff carry
  const seen = new Map();   // event key → tick it was consumed

  /** Footprint centre and half-extents in world units (1 cell = 1 unit). */
  function box(s) {
    const fp = s.footprint || {}, w = fp.w || 1, h = fp.h || 1;
    return { cx: cellToWorld(s.pos.x + (w - 1) / 2), cz: cellToWorld(s.pos.y + (h - 1) / 2), hw: w / 2, hh: h / 2 };
  }

  /** A random point on the footprint's edge and the outward direction there. */
  function edgePoint(b) {
    const per = 4 * (b.hw + b.hh);
    let t = rnd() * per;
    if (t < 2 * b.hw) return { x: b.cx - b.hw + t, z: b.cz - b.hh, nx: 0, nz: -1 };
    t -= 2 * b.hw;
    if (t < 2 * b.hh) return { x: b.cx + b.hw, z: b.cz - b.hh + t, nx: 1, nz: 0 };
    t -= 2 * b.hh;
    if (t < 2 * b.hw) return { x: b.cx + b.hw - t, z: b.cz + b.hh, nx: 0, nz: 1 };
    t -= 2 * b.hw;
    return { x: b.cx - b.hw, z: b.cz + b.hh - t, nx: -1, nz: 0 };
  }

  function puff(emit, K, p, k = 1) {
    const out = lerp(BUILD_FX.out) * k, side = (rnd() - 0.5) * 0.6;
    emit(K.SMOKE, p.x, 0.06, p.z,
      (p.nx - p.nz * side) * out, lerp(BUILD_FX.up), (p.nz + p.nx * side) * out,
      lerp(BUILD_FX.life), lerp(BUILD_FX.size), BUILD_FX.grow, BUILD_FX.shade, 1, BUILD_FX.drag);
  }

  function burst(emit, K, b, n, k) {
    for (let i = 0; i < n; i++) puff(emit, K, edgePoint(b), k);
  }

  return {
    /**
     * Emit this frame's build dust. emit = impacts.emit, K = impacts' kinds, ring = impacts.ring (optional),
     * tierKey = 'high' | 'standard' | 'low'. Returns puffs emitted.
     */
    step(dt, state, events, emit, K, ring, tierKey = 'high') {
      if (!state || !emit) return 0;
      const q = BUILD_TIER[tierKey] ?? 1;
      let n = 0;
      const live = new Set();
      if (state.structures) for (const s of state.structures.values()) {
        if (s.lifecycle !== 'Building' || !s.pos) continue;
        live.add(s.id);
        const b = box(s), perim = (b.hw + b.hh) / 1;   // 1 for a 1×1
        const prog = Math.max(0, Math.min(1, s.progress || 0));
        const rate = BUILD_FX.rate * q * perim * (1 - BUILD_FX.ease * prog);
        let c = (acc.get(s.id) || 0) + rate * Math.max(0, Math.min(0.1, dt || 0));
        while (c >= 1) { c -= 1; puff(emit, K, edgePoint(b)); n++; }
        acc.set(s.id, c);
      }
      for (const id of [...acc.keys()]) if (!live.has(id)) acc.delete(id);
      if (events && state.structures) for (const ev of events) {
        if (ev.type !== 'build' || (ev.phase !== 'start' && ev.phase !== 'complete')) continue;
        const key = `${ev.tick}:${ev.id}:${ev.phase}`;
        if (seen.has(key)) continue;
        seen.set(key, ev.tick || 0);
        const s = state.structures.get(ev.id) || (ev.pos ? { pos: ev.pos, footprint: null } : null);
        if (!s || !s.pos) continue;
        const b = box(s);
        if (ev.phase === 'start') {
          if (ring) ring(b.cx, b.cz, Math.max(b.hw, b.hh) * 0.8, Math.max(b.hw, b.hh) + BUILD_FX.ring.grow, BUILD_FX.ring.life, BUILD_FX.ring.col, BUILD_FX.ring.a);
          const c = Math.max(2, Math.round(BUILD_FX.start * q)); burst(emit, K, b, c, 1.6); n += c;
        } else {
          const c = Math.max(1, Math.round(BUILD_FX.settle * q)); burst(emit, K, b, c, 0.8); n += c;
        }
      }
      if (seen.size > 256) { const cut = (state.tick || 0) - 600; for (const [k, t] of seen) if (t < cut) seen.delete(k); }
      return n;
    },
    clear() { acc.clear(); seen.clear(); },
  };
}
