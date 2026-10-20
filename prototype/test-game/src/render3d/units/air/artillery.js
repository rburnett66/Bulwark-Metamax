// src/render3d/units/air/artillery.js — AIR-Artillery: finned field gun (owner concept tools/unit-models/ref/air/air-artillery.png)
// [MM-story_mvh8woji_1]. A light tracked mount with a navy lower hull and white armour, a turret carrying a very long,
// slender gun with stabilizer fins near the muzzle, and two folding outrigger legs that brace the rear when it fires
// (they plant; the unit drives on its tracks). Big sakura petal on the side, squadron number plate, gold wing emblem.
//
// The barrel is AUTHORED LEVEL along +X from its trunnion (the unitBarrels.js convention: muzzles at pitch 0); the game
// raises it to `barrel.rest` when idle and clamps the aim to [min, max], so it always reads as a lobbing gun.
import { AIR_COLORS } from './palette.js';
import { track } from '../prims.js';

const LOOK_PITCH = 0;   // preview only (look.py shows the authored pose): tilt the barrel group this many degrees. Ships 0.
const TRUN = [0.05, 1.85, 0];          // barrel trunnion
const TPIV = [-0.35, 1.3, 0];          // turret ring
const D2R = Math.PI / 180;

/** A box from a to b (centre line), `t` thick, `w` wide — struts, legs, pistons. */
function strut(a, b, t, w, m, extra = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) / D2R, pitch = Math.atan2(dy, Math.hypot(dx, dz)) / D2R;
  return { t: 'box', s: [L, t, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m, ...extra };
}
/** Barrel part: tilted about the trunnion by LOOK_PITCH for previews (0 in the game). */
function bar(pt) {
  if (!LOOK_PITCH) return { ...pt, g: 'barrel' };
  const c = Math.cos(LOOK_PITCH * D2R), s = Math.sin(LOOK_PITCH * D2R), px = pt.p[0] - TRUN[0], py = pt.p[1] - TRUN[1];
  const r = pt.r3 || [0, 0, 0];
  return { ...pt, g: 'barrel', p: [TRUN[0] + px * c - py * s, TRUN[1] + px * s + py * c, pt.p[2]], r3: [r[0], r[1], r[2] + LOOK_PITCH], ...(pt.ax === 'x' ? {} : {}) };
}
const sideSec = (x, yb, yt, z0, z1) => [x, [[z0, yb], [z1, yb], [z1, yt - 0.06], [z1 - 0.08, yt], [z0, yt]]];

const parts = [
  // ── running gear ──
  ...track({ x0: -1.7, x1: 1.4, h: 0.6, z: 0.86, w: 0.44, wheels: 5, wr: 0.18 }),
  // ── lower hull (navy): tall, with a sloped navy glacis ──
  { t: 'ext', ax: 'z', poly: [[-1.75, 0.3], [-1.75, 1.0], [1.05, 1.0], [1.68, 0.62], [1.55, 0.3]], d: [-0.64, 0.64], m: 'navy' },
  // ── upper armour (white): bulky fender pods over the tracks, chamfered, navy-trimmed nose ──
  { t: 'loft', ax: 'x', m: 'paint', mir: true, secs: [
    [-1.8, [[0.6, 0.74], [1.12, 0.74], [1.12, 1.12], [1.0, 1.26], [0.6, 1.3]]],
    [0.9, [[0.6, 0.74], [1.12, 0.74], [1.12, 1.12], [1.0, 1.26], [0.6, 1.3]]],
    [1.5, [[0.6, 0.7], [1.06, 0.7], [1.06, 0.92], [0.96, 1.0], [0.6, 1.02]]]] },
  { t: 'ext', ax: 'z', poly: [[-1.8, 0.98], [-1.8, 1.3], [0.75, 1.3], [1.35, 1.02], [1.0, 0.98]], d: [-0.62, 0.62], m: 'paint' },
  { t: 'box', s: [0.06, 0.3, 2.22], p: [1.53, 0.84, 0], r3: [0, 0, 34], m: 'navy' },
  // navy rear deck, engine grille, rear plate
  { t: 'box', s: [0.6, 0.05, 1.0], p: [-1.45, 1.32, 0], m: 'navy' },
  { t: 'box', s: [0.42, 0.02, 0.7], p: [-1.45, 1.355, 0], m: 'dark', d: 1 },
  { t: 'box', s: [0.06, 0.5, 1.2], p: [-1.8, 0.9, 0], m: 'navy' },
  // side livery: big sakura (five petals), navy "27", gold wing emblem, red stripe
  ...[0, 72, 144, 216, 288].map((a) => ({ t: 'ell', s: [0.26, 0.15, 0.02], seg: 8, p: [0.5 + Math.cos(a * D2R) * 0.21, 1.0 + Math.sin(a * D2R) * 0.21, 1.125], r3: [0, 0, a], m: 'pink', mir: true })),
  { t: 'ell', s: [0.08, 0.08, 0.025], seg: 8, p: [0.5, 1.0, 1.13], m: 'red', mir: true, d: 1 },
  { t: 'box', s: [0.11, 0.17, 0.02], p: [-0.42, 0.9, 1.125], m: 'navy', mir: true },
  { t: 'box', s: [0.11, 0.17, 0.02], p: [-0.26, 0.9, 1.125], m: 'navy', mir: true },
  { t: 'ext', ax: 'z', poly: [[0, 0.06], [0.22, 0.14], [0.36, 0.1], [0.2, 0.02], [0.36, -0.02], [0.2, -0.04], [0, 0]], d: [1.12, 1.14], p: [-0.5, 1.05, 0], m: 'navy', mir: true },
  { t: 'box', s: [0.1, 0.1, 0.02], p: [-0.5, 1.1, 1.135], m: 'gold', mir: true },
  { t: 'box', s: [3.0, 0.035, 0.02], p: [-0.35, 1.2, 1.125], m: 'red', mir: true },
  { t: 'box', s: [2.7, 0.14, 0.03], p: [-0.45, 0.81, 1.12], m: 'navy', mir: true },
  { t: 'loft', ax: 'x', m: 'navy', mir: true, secs: [
    [0.9, [[0.6, 0.73], [1.13, 0.73], [1.13, 1.13], [1.0, 1.27], [0.6, 1.31]]],
    [1.52, [[0.6, 0.69], [1.07, 0.69], [1.07, 0.93], [0.96, 1.01], [0.6, 1.03]]]] },
  { t: 'box', s: [0.02, 0.4, 0.02], p: [-0.95, 1.0, 1.125], m: 'paint2', mir: true, d: 1 },
  { t: 'box', s: [0.02, 0.4, 0.02], p: [0.05, 1.0, 1.125], m: 'paint2', mir: true, d: 1 },
  // headlights
  { t: 'box', s: [0.05, 0.08, 0.2], p: [1.56, 0.82, 0.42], r3: [0, 0, 34], m: 'glowB', mir: true },

  // ── rear outrigger legs (they brace; it drives on its tracks): hinge pod → knee → foot pad, with a ram ──
  { t: 'box', s: [0.32, 0.26, 0.24], p: [-1.5, 0.92, 1.12], m: 'navy', mir: true },
  strut([-1.5, 0.95, 1.18], [-2.0, 1.2, 1.55], 0.2, 0.2, 'paint', { mir: true }),
  strut([-2.0, 1.2, 1.55], [-2.28, 0.1, 1.78], 0.18, 0.18, 'paint', { mir: true }),
  strut([-1.35, 0.7, 1.12], [-2.1, 0.62, 1.62], 0.08, 0.08, 'metal', { mir: true }),
  { t: 'cyl', ax: 'z', r: 0.13, l: 0.24, seg: 8, p: [-2.0, 1.2, 1.55], m: 'navy', mir: true },
  { t: 'box', s: [0.06, 0.2, 0.2], p: [-2.15, 0.62, 1.68], r3: [0, 0, 76], m: 'red', mir: true, d: 1 },
  { t: 'cyl', ax: 'y', r: [0.16, 0.24], l: 0.1, seg: 8, p: [-2.3, 0.05, 1.8], m: 'navy', mir: true },

  // ── turret (yaws): navy pedestal, tall rounded white housing, navy shoulders, trunnion housings, sensor ──
  { t: 'cyl', ax: 'y', r: [0.5, 0.6], l: 0.24, seg: 12, p: [-0.35, 1.42, 0], m: 'navy', g: 'turret' },
  { t: 'loft', ax: 'y', g: 'turret', m: 'paint', secs: [
    [1.52, [[0.32, -0.46], [0.44, -0.26], [0.44, 0.26], [0.32, 0.46], [-0.6, 0.52], [-0.8, 0.34], [-0.8, -0.34], [-0.6, -0.52]].map(([x, z]) => [x * 1.12 - 0.35, z * 1.12])],
    [1.95, [[0.3, -0.44], [0.42, -0.24], [0.42, 0.24], [0.3, 0.44], [-0.58, 0.5], [-0.78, 0.32], [-0.78, -0.32], [-0.58, -0.5]].map(([x, z]) => [x * 1.12 - 0.35, z * 1.12])],
    [2.15, [[0.12, -0.3], [0.22, -0.16], [0.22, 0.16], [0.12, 0.3], [-0.48, 0.34], [-0.62, 0.2], [-0.62, -0.2], [-0.48, -0.34]].map(([x, z]) => [x * 1.12 - 0.35, z * 1.12])]] },
  { t: 'box', s: [0.9, 0.16, 0.08], p: [-0.65, 1.62, 0.5], m: 'navy', g: 'turret', mir: true },
  { t: 'box', s: [0.32, 0.08, 0.66], p: [-1.08, 2.0, 0], m: 'navy', g: 'turret' },
  { t: 'box', s: [0.24, 0.14, 0.2], p: [-0.85, 2.22, 0.18], m: 'navy', g: 'turret' },
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.04, seg: 8, p: [-0.72, 2.22, 0.18], m: 'glowB', g: 'turret' },
  { t: 'box', s: [0.02, 0.32, 0.02], p: [-1.0, 2.3, -0.25], m: 'dark', g: 'turret', d: 1 },
  // trunnion housings: big white drums with navy caps either side of the gun
  { t: 'cyl', ax: 'z', r: 0.26, l: 0.2, seg: 10, p: [0.05, 1.85, 0.36], m: 'paint', g: 'turret', mir: true },
  { t: 'cyl', ax: 'z', r: 0.15, l: 0.04, seg: 10, p: [0.05, 1.85, 0.48], m: 'navy', g: 'turret', mir: true },
  { t: 'box', s: [0.55, 0.3, 0.6], p: [-0.1, 1.68, 0], m: 'navy', g: 'turret' },

  // ── barrel (pitches about TRUN): navy cradle, white recoil sleeve, long slender tube, red band, finned muzzle ──
  bar({ t: 'cyl', ax: 'z', r: 0.17, l: 0.5, seg: 10, p: [0.05, 1.85, 0], m: 'navy' }),
  bar({ t: 'cyl', ax: 'x', r: [0.13, 0.17], l: 0.8, seg: 8, p: [0.5, 1.85, 0], m: 'paint' }),
  bar({ t: 'cyl', ax: 'x', r: [0.11, 0.13], l: 0.5, seg: 8, p: [1.1, 1.85, 0], m: 'navy' }),
  bar({ t: 'cyl', ax: 'x', r: [0.075, 0.1], l: 1.9, seg: 8, p: [2.03, 1.85, 0], m: 'paint' }),
  bar({ t: 'cyl', ax: 'x', r: 0.115, l: 0.06, seg: 8, p: [1.38, 1.85, 0], m: 'red' }),
  bar({ t: 'cyl', ax: 'x', r: 0.08, l: 0.07, seg: 8, p: [2.55, 1.85, 0], m: 'red' }),
  bar({ t: 'box', s: [0.42, 0.36, 0.03], p: [2.82, 1.85, 0], r3: [45, 0, 0], m: 'navy' }),
  bar({ t: 'box', s: [0.42, 0.36, 0.03], p: [2.82, 1.85, 0], r3: [-45, 0, 0], m: 'navy' }),
  bar({ t: 'cyl', ax: 'x', r: [0.06, 0.09], l: 0.3, seg: 8, p: [3.12, 1.85, 0], m: 'paint' }),
  bar({ t: 'cyl', ax: 'x', r: 0.045, l: 0.04, seg: 8, p: [3.29, 1.85, 0], m: 'dark' }),
];

export const AIR_ARTILLERY = { name: 'Finned field gun', unit: 'AIR-Artillery', ref: 'air_artillery', colors: AIR_COLORS, parts,
  pivots: { turret: TPIV, barrel: TRUN },
  // lobs: idles high, never aims flatter than 18°
  barrel: { rest: 38, min: 18, max: 62, rate: 0.9 },
  muzzles: [{ p: [3.31, 1.85, 0], d: [1, 0, 0], back: 1.2 }],
  views: { side: 'left', top: 'down' } };
