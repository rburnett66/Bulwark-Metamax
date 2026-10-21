// src/render3d/units/space/palette.js — the SPACE TECH faction livery and shared parts for its 3D models [MM-story_mvho2d6s_5].
// Sampled from the owner's concepts (tools/unit-models/ref/space/*.png; the scout sheet names the set: lunar hull white,
// federation blue, gunmetal, beacon magenta), plus the gold thermal foil and navy solar cells they carry. Shared keys
// (dark, black, track, metal, glass, glow) keep their usual meaning. Values sit a shade under the concepts: the game
// lights top faces brightly, so the white reads as white instead of blowing out.
//
// Shared builders (sensor dish, beacon, coil barrel, landing jack) live here; classic.mjs loads palette.js first.
import { strut } from '../arcane/palette.js';

export const SPACE_COLORS = Object.freeze({
  lunar: 0xc8cbc8,   // lunar hull white (the main body colour)
  lunar2: 0xa9adae,  // shaded white: under-plates, panel insets
  fed: 0x1f4688,     // federation blue bands and panels
  gun: 0x3b3e43,     // gunmetal: frames, tracks guards, barrels
  foil: 0xc79b3c,    // gold thermal foil
  solar: 0x1b2b58,   // navy solar cells
  copper: 0xb2683a,  // copper coil windings
  glowM: 0xff3cc8,   // magenta beacons and stripes (unlit)
  hull: 0xc8cbc8, hull2: 0xa9adae, panel: 0xb8bbb9,   // aliases so shared helpers stay on palette
  dark: 0x2a2c30, black: 0x141518, track: 0x2b2c2f, metal: 0x8a8d91, glass: 0x1d2a38,
  glow: 0x46f2ff, glowB: 0x4aa8ff, amber: 0xffb340,
});

const S_D2R = Math.PI / 180;

/** A sensor dish on a short mast: (x, y, z) = mast foot; r = dish radius; tilt = degrees back from straight up; yaw deg. */
export function dish(x, y, z, r = 0.3, opts = {}) {
  const { tilt = 35, yaw = 0, mast = 0.25, extra = {} } = opts;
  const top = [x, y + mast, z];
  return [
    { t: 'cyl', ax: 'y', r: 0.035, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'gun', ...extra },
    { t: 'cyl', ax: 'y', r: [r, r * 0.25], l: r * 0.35, seg: 12, p: [top[0], top[1] + r * 0.3, top[2]], r3: [0, yaw, -tilt], m: 'lunar', ...extra },
    { t: 'cyl', ax: 'y', r: 0.02, l: r * 0.8, seg: 4, p: [top[0], top[1] + r * 0.6, top[2]], r3: [0, yaw, -tilt], m: 'gun', d: 1, ...extra },
  ];
}

/** A magenta beacon: a small housing with a glowing dome. */
export const beacon = (x, y, z, s = 1, extra = {}) => [
  { t: 'cyl', ax: 'y', r: 0.05 * s, l: 0.05 * s, seg: 6, p: [x, y + 0.025 * s, z], m: 'gun', ...extra },
  { t: 'ell', s: [0.05 * s, 0.05 * s, 0.05 * s], seg: 6, p: [x, y + 0.06 * s, z], m: 'glowM', ...extra },
];

/** A whip antenna. */
export const whip = (x, y, z, l = 0.8, extra = {}) => ({ t: 'cyl', ax: 'y', r: 0.012, l, seg: 4, p: [x, y + l / 2, z], m: 'black', ...extra });

/** A coil-gun barrel along +X from x0 to x1 at (y, z): gunmetal tube, copper windings over the middle, muzzle ring. */
export function coilBarrel(x0, x1, y, z, r = 0.08, opts = {}) {
  const { coils = 8, c0 = 0.35, c1 = 0.8, extra = {} } = opts, L = x1 - x0, out = [
    { t: 'cyl', ax: 'x', r, l: L, seg: 8, p: [x0 + L / 2, y, z], m: 'gun', ...extra },
    { t: 'cyl', ax: 'x', r: r * 1.35, l: L * 0.06, seg: 8, p: [x1 - L * 0.03, y, z], m: 'gun', ...extra },
    { t: 'cyl', ax: 'x', r: r * 0.6, l: 0.02, seg: 8, p: [x1 + 0.005, y, z], m: 'black', ...extra },
  ];
  for (let i = 0; i < coils; i++) out.push({ t: 'cyl', ax: 'x', r: r * 1.5, l: L * (c1 - c0) / coils * 0.55, seg: 8, p: [x0 + L * (c0 + (c1 - c0) * (i + 0.5) / coils), y, z], m: 'copper', ...extra });
  return out;
}

/** Landing-jack swing: the rotation that folds a planted leg (hinge → foot) to lie along `stow`. */
export function jackSwing(J) {
  const a = [J.foot[0] - J.hinge[0], J.foot[1] - J.hinge[1], J.foot[2] - J.hinge[2]], la = Math.hypot(...a), A = a.map((v) => v / la), B = J.stow;
  const ax = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]], ln = Math.hypot(...ax);
  return { axis: ax.map((v) => v / ln), angle: Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) / S_D2R };
}
/** A landing jack (group g), authored planted: hinge mount, two-part leg, round foot pad. */
export function landingJack(g, J) {
  const h = J.hinge, f = J.foot, sz = Math.sign(h[2]);
  const k = [h[0] + (f[0] - h[0]) * 0.5, h[1] + (f[1] - h[1]) * 0.5 + 0.1, h[2] + (f[2] - h[2]) * 0.5];
  return [
    { t: 'box', s: [0.3, 0.26, 0.1], p: [h[0], h[1], h[2] - sz * 0.05], m: 'gun' },
    { t: 'cyl', ax: 'z', r: 0.08, l: 0.14, seg: 8, p: h, m: 'dark', g },
    strut(h, k, 0.13, 0.13, 'lunar', { g }),
    strut(k, f, 0.1, 0.1, 'metal', { g }),
    { t: 'cyl', ax: 'z', r: 0.07, l: 0.16, seg: 8, p: k, m: 'fed', g },
    { t: 'cyl', ax: 'y', r: [0.14, 0.2], l: 0.06, seg: 10, p: [f[0], 0.03, f[2]], m: 'gun', g },
  ];
}
