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
 * createRecoil() → { kick(key, slot), offset(key, slot, dist), since(key, slot), step(dt) }: shot times per (shooter key, barrel slot),
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
      if (at.size > 256) for (const [k, t] of at) if (clock - t > Math.max(R.kick + R.ret, BODY_KICK.settle)) at.delete(k);
    },
    /** Seconds since (key, slot) last fired, or Infinity if it never has (or that shot is long settled). */
    since(key, slot = 0) { const t0 = at.get(id(key, slot)); return t0 === undefined ? Infinity : clock - t0; },
    get clock() { return clock; },
  };
}

/**
 * The whole-body FIRE KICK of a cannon tower or tank. [MM-task_mvfpbbtp_1]
 *
 * Owner 2026-10-19: "when cannon towers and tanks fire, pushing them backwards a few pixels and lift the front, then
 * drop to ground and slide back." On each shot the body is shoved away from its gun (`back` cells — a few pixels at
 * play zoom) while its front rears up (`lift` degrees, pivoting on the rear edge); the front then DROPS back onto the
 * ground (gravity-like, with a small bounce) and only then does the body SLIDE forward to rest.
 *   up     s — shove + rear-up, fast ease-out
 *   drop   s — the front falls back to the ground (accelerating), then a tiny bounce of `bounce` × lift
 *   settle s — after the drop, the slide forward back to the firing position
 */
export const BODY_KICK = Object.freeze({ back: 0.07, lift: 5, up: 0.06, drop: 0.16, bounce: 0.18, settle: 0.5 });

/** { back, lift } fractions (0..1) of the body kick `t` seconds after a shot; both 0 before it and once settled. */
export function bodyKick(t, K = BODY_KICK) {
  if (!(t >= 0) || t >= K.settle) return { back: 0, lift: 0 };
  const eo = (u) => 1 - (1 - u) * (1 - u);
  let lift = 0;
  if (t < K.up) lift = eo(t / K.up);
  else if (t < K.drop) { const u = (t - K.up) / (K.drop - K.up); lift = 1 - u * u; }      // falls back, accelerating
  else { const u = (t - K.drop) / (K.drop - K.up); if (u < 1) lift = K.bounce * Math.sin(Math.PI * u); }   // one small bounce
  let back;
  if (t < K.up) back = eo(t / K.up);
  else if (t < K.drop) back = 1;                                                              // holds while the front drops
  else { const u = (t - K.drop) / (K.settle - K.drop); back = 1 - u * u * (3 - 2 * u); }    // then slides forward to rest
  return { back, lift };
}

/**
 * The world-space kick transform (column-major 4×4, THREE Matrix4.fromArray order) for a body standing at (x, y, z)
 * whose gun points along the horizontal direction (dx, dz): shoved back `back` cells against the gun and rotated
 * `liftRad` front-up about the horizontal axis through its rear edge, `rear` cells behind its centre at height y.
 * Premultiply an instance matrix by it. Identity when nothing moves.
 */
export function kickMatrix(x, y, z, dx, dz, back, liftRad, rear) {
  const l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l;
  const ax = -fz, az = fx;                         // axis = forward × up: a positive turn raises the front
  const c = Math.cos(liftRad), s = Math.sin(liftRad), t = 1 - c;
  const R = [   // Rodrigues about (ax, 0, az)
    [c + t * ax * ax, -s * az, t * ax * az],
    [s * az, c, -s * ax],
    [t * ax * az, s * ax, c + t * az * az],
  ];
  const px = x - fx * rear, py = y, pz = z - fz * rear;   // the rear edge stays planted
  const tx = px - (R[0][0] * px + R[0][1] * py + R[0][2] * pz) - fx * back;
  const ty = py - (R[1][0] * px + R[1][1] * py + R[1][2] * pz);
  const tz = pz - (R[2][0] * px + R[2][1] * py + R[2][2] * pz) - fz * back;
  return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, tx, ty, tz, 1];
}
