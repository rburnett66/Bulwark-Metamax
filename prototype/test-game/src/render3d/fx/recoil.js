/**
 * src/render3d/fx/recoil.js — the slide-back of a cannon barrel when it fires. [MM-story_mvee15ja_b]
 * docs/tech-plan/3D-Combat-Polish.md §5 (CP-8, decision D2).
 *
 * Owner 2026-10-18: recoil "Yes but no recoil on guns, missiles or rockets." So only cannon-type barrels kick: the
 * cannon tower, the tank and King Tiger main guns and the base super-cannon — each model opts in with a `recoil`
 * distance (model units, about 18% of the barrel; absent = none). Flak, the buggy's energy gun, rocket racks and
 * missile pods never move.
 *
 * The barrel slides back along its own (pitched) axis in KICK seconds, then eases forward over RETURN seconds. The
 * firing point is read before the offset, so the flash stays at the tip. Render-only: frame time, never the tick.
 */
export const RECOIL = Object.freeze({ kick: 0.06, ret: 0.35 });

/** Fraction (0..1) of the full recoil distance `t` seconds after a shot; 0 before it and once settled. */
export function recoilFrac(t, R = RECOIL) {
  if (!(t >= 0)) return 0;
  if (t < R.kick) { const u = t / R.kick; return 1 - (1 - u) * (1 - u); }   // fast ease-out back
  const u = (t - R.kick) / R.ret;
  if (u >= 1) return 0;
  return 1 - u * u * (3 - 2 * u);                                              // smooth run-out forward
}

/**
 * createRecoil() → { kick(key, slot), offset(key, slot, dist), step(dt) }: shot times per (shooter key, barrel slot),
 * on a frame clock. offset() is how far (same units as dist) that barrel is back right now.
 */
export function createRecoil(R = RECOIL) {
  const at = new Map();
  let clock = 0;
  const id = (key, slot) => key + '#' + (slot || 0);
  return {
    kick(key, slot = 0) { at.set(id(key, slot), clock); },
    offset(key, slot, dist) {
      if (!dist) return 0;
      const t0 = at.get(id(key, slot));
      return t0 === undefined ? 0 : recoilFrac(clock - t0, R) * dist;
    },
    step(dt) {
      clock += Math.max(0, dt || 0);
      if (at.size > 256) for (const [k, t] of at) if (clock - t > R.kick + R.ret) at.delete(k);
    },
    get clock() { return clock; },
  };
}
