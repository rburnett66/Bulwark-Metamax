// src/render3d/units/air/scout.js — AIR-Trucks: Fuselage buggy (owner concept tools/unit-models/ref/air/air-scout.png)
// [MM-story_mvh8woji_1]. A grounded jet fuselage on three wheels: a red needle nose with a single nose wheel under it,
// a bubble canopy, a swept navy stripe with the squadron number, intakes on the flanks, a pink-badged tail fin and
// two rear wheels in faired pods. A small chin gun under the nose is the `turret` (yaw) + `barrel` (pitch).
import { AIR_COLORS } from './palette.js';

// fuselage section: a rounded diamond-ish octagon, width w, from y0 to y1
const sec = (w, y0, y1) => { const h = y1 - y0; return [[-w * 0.55, y0], [w * 0.55, y0], [w, y0 + h * 0.4], [w * 0.8, y0 + h * 0.8], [w * 0.35, y1], [-w * 0.35, y1], [-w * 0.8, y0 + h * 0.8], [-w, y0 + h * 0.4]]; };
// fuselage half-width along X (matches the loft below), so flank stripes sit on the skin
const HW = [[2.15, 0.06], [1.6, 0.3], [0.7, 0.5], [-0.4, 0.62], [-1.4, 0.6], [-1.95, 0.46]];
const hw = (x) => { for (let i = 0; i < HW.length - 1; i++) { const [a, wa] = HW[i], [b, wb] = HW[i + 1]; if (x <= a && x >= b) return wa + (wb - wa) * (a - x) / (a - b); } return 0.46; };
const seg = (a, b, w, h, m, extra = {}) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) * 180 / Math.PI, pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  return Object.assign({ t: 'box', s: [L + 0.04, h, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m }, extra);
};
const STRIPE = [[1.75, 0.6], [1.0, 0.66], [0.2, 0.75], [-0.6, 0.86], [-1.4, 0.98], [-1.9, 1.04]].map(([x, y]) => [x, y, hw(x) * 0.97 + 0.02]);
const STRIPE2 = [[0.9, 0.85], [0.1, 0.98], [-0.7, 1.08], [-1.5, 1.12]].map(([x, y]) => [x, y, hw(x) * 0.84 + 0.02]);
const wheel = (x, z, r, w, mir) => [
  { t: 'cyl', ax: 'z', r, l: w, seg: 12, p: [x, r, z], m: 'black', mir },
  { t: 'cyl', ax: 'z', r: r * 0.55, l: w + 0.04, seg: 10, p: [x, r, z], m: 'metal', mir },
];

const parts = [
  // fuselage: needle nose → canopy hump → wide aft body with intakes
  { t: 'loft', ax: 'x', secs: [
    [2.15, sec(0.06, 0.62, 0.7)],
    [1.6, sec(0.3, 0.5, 0.92)],
    [0.7, sec(0.5, 0.42, 1.18)],
    [-0.4, sec(0.62, 0.42, 1.25)],
    [-1.4, sec(0.6, 0.45, 1.2)],
    [-1.95, sec(0.46, 0.52, 1.1)]], m: 'paint' },
  // red nose cone
  { t: 'loft', ax: 'x', secs: [[2.45, sec(0.01, 0.65, 0.67)], [2.12, sec(0.08, 0.6, 0.72)], [1.9, sec(0.17, 0.56, 0.8)]], m: 'red' },
  // bubble canopy + frame
  { t: 'ell', s: [0.72, 0.3, 0.32], seg: 12, half: true, p: [0.55, 1.1, 0], m: 'glass' },
  { t: 'box', s: [0.05, 0.3, 0.44], p: [0.95, 1.2, 0], r3: [0, 0, 35], m: 'navy' },
  // swept navy stripe down each flank + number plate
  ...STRIPE.slice(1).map((b, i) => seg(STRIPE[i], b, 0.04, 0.17, 'navy', { mir: true })),
  ...STRIPE2.slice(1).map((b, i) => seg(STRIPE2[i], b, 0.04, 0.07, 'navy', { mir: true, d: 1 })),
  { t: 'box', s: [0.42, 0.22, 0.04], p: [0.35, 0.58, hw(0.35) * 0.96], r3: [0, -10, 0], m: 'navy', mir: true },
  { t: 'box', s: [0.26, 0.1, 0.04], p: [0.35, 0.58, hw(0.35) * 0.96 + 0.015], r3: [0, -10, 0], m: 'paint', mir: true, d: 1 },
  { t: 'cyl', ax: 'z', r: 0.12, l: 0.04, seg: 8, p: [-0.8, 1.06, hw(-0.8) * 0.9], m: 'pink', mir: true },
  // flank intakes + rear exhaust
  { t: 'box', s: [0.6, 0.28, 0.2], p: [-0.65, 0.66, 0.6], m: 'paint2', mir: true },
  { t: 'box', s: [0.04, 0.2, 0.14], p: [-0.34, 0.66, 0.62], m: 'black', mir: true },
  { t: 'cyl', ax: 'x', r: 0.24, l: 0.12, seg: 10, p: [-2.0, 0.8, 0], m: 'dark' },
  // tail fin (pink badge, navy root) + small tailplanes
  { t: 'ext', ax: 'z', poly: [[-1.0, 1.15], [-1.95, 1.15], [-2.1, 2.0], [-1.75, 2.0]], d: [-0.05, 0.05], m: 'paint' },
  { t: 'ext', ax: 'z', poly: [[-1.0, 1.15], [-1.95, 1.15], [-1.98, 1.3], [-1.1, 1.3]], d: [-0.06, 0.06], m: 'navy' },
  { t: 'cyl', ax: 'z', r: 0.12, l: 0.12, seg: 8, p: [-1.72, 1.7, 0], m: 'pink' },
  { t: 'ext', ax: 'y', poly: [[-1.3, 0.3], [-1.8, 0.3], [-2.05, 1.0], [-1.85, 1.0]], d: [1.0, 1.05], m: 'paint', mir: true },
  // nose wheel on a fork under the needle nose
  { t: 'box', s: [0.1, 0.4, 0.22], p: [1.45, 0.45, 0], r3: [0, 0, -12], m: 'dark' },
  ...wheel(1.5, 0, 0.27, 0.2, false),
  // rear wheels in faired pods (white, navy trim) on struts
  { t: 'box', s: [0.25, 0.1, 0.5], p: [-1.25, 0.55, 0.75], m: 'dark', mir: true },
  ...wheel(-1.25, 1.02, 0.32, 0.26, true),
  { t: 'loft', ax: 'x', secs: [[-0.75, [[0.86, 0.45], [1.2, 0.45], [1.2, 0.62], [0.86, 0.62]]], [-1.1, [[0.86, 0.5], [1.2, 0.5], [1.2, 0.8], [0.86, 0.8]]],
    [-1.6, [[0.86, 0.5], [1.2, 0.5], [1.2, 0.78], [0.86, 0.78]]], [-1.75, [[0.86, 0.4], [1.2, 0.4], [1.2, 0.6], [0.86, 0.6]]]], m: 'paint', mir: true },
  { t: 'box', s: [0.95, 0.06, 0.36], p: [-1.25, 0.43, 1.03], m: 'navy', mir: true },
  // chin gun under the nose: mount (yaws) + barrel (pitch)
  { t: 'box', s: [0.28, 0.14, 0.24], p: [1.05, 0.44, 0], m: 'dark', g: 'turret' },
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.6, seg: 6, p: [1.48, 0.44, 0], m: 'metal', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.065, l: 0.08, seg: 6, p: [1.76, 0.44, 0], m: 'black', g: 'barrel' },
];

export const AIR_SCOUT = { name: 'Fuselage buggy', unit: 'AIR-Trucks', ref: 'air_scout', colors: AIR_COLORS,
  parts, pivots: { turret: [1.05, 0.4, 0], barrel: [1.15, 0.44, 0] },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.6 },
  muzzles: [{ p: [1.8, 0.44, 0], d: [1, 0, 0], back: 0.6 }], views: { side: 'right', top: 'down' } };
