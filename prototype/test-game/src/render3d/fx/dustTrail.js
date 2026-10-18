/**
 * src/render3d/fx/dustTrail.js — moving ground vehicles leave a light dust trail. [MM-task_mvd2loid_i]
 *
 * Owner 2026-10-17: "moving tanks should have a light dust trail … stops emitting when they don't move".
 * Each frame every ground vehicle (tank, tiger, buggy, beetle — never a flyer or a hovering unit) is compared with
 * where it was last frame; while it moves, soft dusty puffs rise from behind its two tracks, more of them the faster
 * it goes, drifting back and up and settling over a second or so. Standing still emits nothing at all.
 *
 * Pure: no three.js — it emits into the world-impact particles (fx/impacts.js); its own seeded PRNG.
 */
export const DUST = Object.freeze({
  models: Object.freeze(['tank', 'tiger', 'buggy', 'beetle']),
  minSpeed: 0.12,   // cells / s — below this the vehicle counts as stopped
  fullSpeed: 1.2,   // cells / s for the full rate
  rate: 9,          // puffs / s per track at full speed
  back: 0.34, side: 0.2,   // track rear offsets, × the model's scale
  life: [1.1, 1.7], size: 0.034,
});

export function createDustTrails({ seed = 23 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const last = new Map();   // unit id → { x, z, acc }
  return {
    /** views: this frame's unit views (x, z, y, heading, model, scale, id). Returns puffs emitted. */
    step(dt, views, emit, K) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      let n = 0;
      const seen = new Set();
      if (views) for (const v of views) {
        if (!DUST.models.includes(v.model) || (v.y || 0) > 0.01) continue;
        seen.add(v.id);
        const L = last.get(v.id);
        if (!L) { last.set(v.id, { x: v.x, z: v.z, acc: 0 }); continue; }
        const moved = Math.hypot(v.x - L.x, v.z - L.z), speed = d > 0 ? moved / d : 0;
        L.x = v.x; L.z = v.z;
        if (speed < DUST.minSpeed || moved > 1.5) { L.acc = 0; continue; }   // stopped (or teleported) — no dust
        L.acc += 2 * DUST.rate * Math.min(1, speed / DUST.fullSpeed) * d;
        const k = v.scale || 1, fx = Math.cos(v.heading || 0), fz = Math.sin(v.heading || 0);
        while (L.acc >= 1) {
          L.acc -= 1;
          const sd = rnd() < 0.5 ? -1 : 1;
          const x = v.x - fx * DUST.back * k - fz * DUST.side * k * sd, z = v.z - fz * DUST.back * k + fx * DUST.side * k * sd;
          emit(K.SMOKE, x + (rnd() - 0.5) * 0.06, 0.04, z + (rnd() - 0.5) * 0.06,
            -fx * 0.25 + (rnd() - 0.5) * 0.2, 0.1 + rnd() * 0.12, -fz * 0.25 + (rnd() - 0.5) * 0.2,
            DUST.life[0] + rnd() * (DUST.life[1] - DUST.life[0]), DUST.size * k, 0.85, 0.62, 1, 1.4);
          n++;
        }
      }
      for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);
      return n;
    },
    clear() { last.clear(); },
  };
}
