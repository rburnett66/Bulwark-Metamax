/**
 * src/render3d/fx/wakes.js — a simple wake behind water units crossing water [MM-task_mvj9o97b_7].
 *
 * Owner 2026-10-22: "When water units cross water there should be a simple wake effect." While a swimmer or floater
 * moves over a water cell it sheds, every few hundredths of a cell travelled, a pair of foam ripples off its stern
 * that drift outward (the two arms of a V) and grow as they fade, plus a small foam patch on its track. A unit on
 * land, standing still or airborne sheds nothing; ground units, which only ever wade (owner 2026-10-22: "Other units
 * can also path water but so slowly it always makes sense to path around it"), leave none.
 *
 * Pure: no three.js. Its clock is its own (summed dt), so nothing here touches Date.now() or the sim's tick path.
 * The view (wakesView.js) draws `instances()` as one InstancedMesh.
 */

export const WAKE = Object.freeze({
  life: 1.6,          // seconds for an arm ripple to fade
  patchLife: 0.9,     // seconds for the stern foam patch
  spacing: 0.1,       // cells travelled between emissions (close, so the ripples merge into a band)
  minSpeed: 0.05,     // cells / s — slower than this is drifting, not making a wake
  back: 0.28,         // cells behind the unit's centre the wake starts (× unit scale)
  side: 0.12,         // cells either side of the stern the arms start
  spread: 0.45,       // cells / s the arms drift outward
  trail: 0.08,        // cells / s they drift back along the track
  size: [0.16, 0.62], // ripple diameter, cells: born → faded
  patch: [0.2, 0.34],
  opacity: { arm: 0.42, patch: 0.4 },
  cap: 900,
});

/**
 * isWater(x, z) → true over water (world coords); isWaterUnit(view) → true for swimmers / floaters.
 * opts.cap overrides WAKE.cap (quality tier).
 */
export function createWakes({ isWater, isWaterUnit, cap = WAKE.cap } = {}) {
  const ripples = [];            // { x, z, vx, vz, born, life, s0, s1, a0, kind }
  const units = new Map();       // unit id → { x, z, acc }
  let now = 0;
  return {
    /** views: this frame's unit views { id, x, z, y, heading, scale }. */
    step(dt, views) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      now += d;
      const seen = new Set();
      if (views) for (const v of views) {
        if (!isWaterUnit || !isWaterUnit(v) || (v.y || 0) > 0.3) continue;
        seen.add(v.id);
        const U = units.get(v.id);
        if (!U) { units.set(v.id, { x: v.x, z: v.z, acc: 0 }); continue; }
        const moved = Math.hypot(v.x - U.x, v.z - U.z);
        U.x = v.x; U.z = v.z;
        if (moved > 1.5 || (d > 0 && moved / d < WAKE.minSpeed)) { U.acc = 0; continue; }   // teleport / drifting
        if (!isWater || !isWater(v.x, v.z)) { U.acc = 0; continue; }                         // on land: no wake
        U.acc += moved;
        const k = v.scale || 1, h = v.heading || 0, fx = Math.cos(h), fz = Math.sin(h);
        const sx = v.x - fx * WAKE.back * k, sz = v.z - fz * WAKE.back * k;               // the stern
        while (U.acc >= WAKE.spacing) {
          U.acc -= WAKE.spacing;
          for (const sd of [-1, 1]) {
            const px = -fz * sd, pz = fx * sd;                                              // outward, perpendicular
            ripples.push({ x: sx + px * WAKE.side * k, z: sz + pz * WAKE.side * k,
              vx: px * WAKE.spread - fx * WAKE.trail, vz: pz * WAKE.spread - fz * WAKE.trail,
              born: now, life: WAKE.life, s0: WAKE.size[0] * k, s1: WAKE.size[1] * k, a0: WAKE.opacity.arm, kind: 'arm' });
          }
          ripples.push({ x: sx, z: sz, vx: -fx * WAKE.trail, vz: -fz * WAKE.trail, born: now, life: WAKE.patchLife,
            s0: WAKE.patch[0] * k, s1: WAKE.patch[1] * k, a0: WAKE.opacity.patch, kind: 'patch' });
        }
      }
      for (const id of [...units.keys()]) if (!seen.has(id)) units.delete(id);
      let w = 0;
      for (const r of ripples) if (now - r.born < r.life) ripples[w++] = r;
      ripples.length = w;
      if (ripples.length > cap) ripples.splice(0, ripples.length - cap);   // oldest first
      return ripples.length;
    },
    /** [{ x, z, size, alpha, kind }] now — positions drift, sizes grow, alpha fades (ease-out). */
    instances() {
      const out = [];
      for (const r of ripples) {
        const t = (now - r.born) / r.life, age = now - r.born;
        if (t >= 1) continue;
        out.push({ x: r.x + r.vx * age, z: r.z + r.vz * age, size: r.s0 + (r.s1 - r.s0) * Math.sqrt(t),
          alpha: r.a0 * (1 - t) * (1 - t), kind: r.kind });
      }
      return out;
    },
    get count() { return ripples.length; },
    clear() { ripples.length = 0; units.clear(); },
  };
}
