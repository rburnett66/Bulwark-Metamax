// src/render3d/units/air/missile.js — AIR-Missiles: the quad-fan missile pod (owner concept
// tools/unit-models/ref/air/missile-flyer.png) [MM-story_mvh8woji_1].
// A compact faceted white body on four clear ducted fans (groups `spin`…`spin4`, they turn), carrying a big navy
// launcher box on top with a 3 × 4 grid of red missile caps and a pink stripe, and a navy sensor ball under the nose.
// The launcher box is the dominant read from above. X forward, Y up, Z right.
import { AIR_COLORS } from './palette.js';

const MD = Math.PI / 180;
const mRing = (c, r, n, w, h, m, g) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2;
  return Object.assign({ t: 'box', s: [2 * Math.PI * r / n * 1.08, h, w], p: [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r], r3: [0, -(a / MD + 90), 0], m }, g ? { g } : {});
});
const mBlade = (c, L, a, w, h, m, g) => ({ t: 'box', s: [L, h, w], p: [c[0] + Math.cos(a * MD) * L / 2, c[1], c[2] - Math.sin(a * MD) * L / 2], r3: [0, a, 0], m, g });
// body cross-section (z, y): a faceted hexagon
const mHex = (yb, yt, w) => { const h = yt - yb; return [[w * 0.62, yb], [w, yb + 0.35 * h], [w * 0.88, yt - 0.12 * h], [w * 0.5, yt], [-w * 0.5, yt], [-w * 0.88, yt - 0.12 * h], [-w, yb + 0.35 * h], [-w * 0.62, yb]]; };
const M_FX = 0.95, M_FZ = 1.12, M_FY = 0.74, M_R = 0.5;
const M_FANS = [[M_FX, M_FZ], [M_FX, -M_FZ], [-M_FX, M_FZ], [-M_FX, -M_FZ]];

const mParts = [
  // body: chisel nose → wide middle → squared tail
  { t: 'loft', ax: 'x', secs: [[1.4, mHex(0.28, 0.62, 0.36)], [1.05, mHex(0.18, 0.98, 0.6)], [-0.85, mHex(0.18, 1.02, 0.64)], [-1.2, mHex(0.3, 0.9, 0.48)]], m: 'paint' },
  { t: 'box', s: [0.06, 0.1, 0.22], p: [1.4, 0.45, 0], m: 'navy' },
  { t: 'ext', ax: 'z', poly: [[1.3, 0.48], [1.22, 0.6], [1.36, 0.54]], d: [0.33, 0.36], m: 'red', mir: true },   // nose chevrons
  { t: 'box', s: [0.55, 0.3, 0.04], p: [0.05, 0.55, 0.62], m: 'paint2', mir: true },                         // side bay
  { t: 'box', s: [0.3, 0.2, 0.03], p: [0.05, 0.55, 0.645], m: 'navy', mir: true },
  { t: 'box', s: [0.12, 0.08, 0.02], p: [0.6, 0.78, 0.6], m: 'dark', mir: true, d: 1 },
  ...[[0.7, 0.42], [-0.6, 0.4]].map(([x, y]) => ({ t: 'ell', s: [0.06, 0.06, 0.012], seg: 6, p: [x, y, 0.62], m: 'pink', mir: true, d: 1 })),
  // the launcher box: navy, 3 × 4 red missile caps, pink stripe, gold latches, white blossom emblem
  { t: 'box', s: [1.75, 0.55, 1.45], p: [-0.12, 1.33, 0], m: 'navy' },
  { t: 'box', s: [1.65, 0.06, 1.35], p: [-0.12, 1.63, 0], m: 'navy' },
  { t: 'box', s: [1.76, 0.04, 0.02], p: [-0.12, 1.22, 0.73], m: 'pink', mir: true },
  { t: 'box', s: [0.02, 0.04, 1.46], p: [0.76, 1.22, 0], m: 'pink' },
  ...[[0.76, 0.55], [0.76, -0.55], [-1.0, 0.55], [-1.0, -0.55]].map(([x, z]) => ({ t: 'box', s: [0.05, 0.08, 0.1], p: [x, 1.45, z], m: 'gold', d: 1 })),
  { t: 'ell', s: [0.15, 0.15, 0.015], seg: 8, p: [-0.5, 1.36, 0.73], m: 'paint', mir: true },
  ...[0.48, 0.12, -0.24, -0.6].flatMap((x) => [-0.42, 0, 0.42].map((z) => ({ t: 'cyl', ax: 'y', r: 0.1, l: 0.12, seg: 6, p: [x, 1.71, z], m: 'red' }))),
  // pod saddle
  { t: 'box', s: [1.2, 0.06, 1.0], p: [-0.12, 1.03, 0], m: 'paint2' },
  // navy sensor ball under the nose with a pink lens
  { t: 'box', s: [0.24, 0.1, 0.24], p: [1.05, 0.16, 0], m: 'navy' },
  { t: 'ell', s: [0.24, 0.24, 0.24], seg: 12, p: [1.15, 0.02, 0], m: 'navy' },
  { t: 'cyl', ax: 'x', r: 0.1, l: 0.04, seg: 10, p: [1.38, 0.02, 0], m: 'pink' },
  { t: 'cyl', ax: 'x', r: 0.045, l: 0.02, seg: 8, p: [1.405, 0.02, 0], m: 'glass' },
  ...M_FANS.flatMap(([x, z], i) => {
    const c = [x, M_FY, z], g = i ? 'spin' + (i + 1) : 'spin';
    const ax0 = Math.sign(x) * 0.55, az0 = Math.sign(z) * 0.55, L = Math.hypot(x - ax0, z - az0) - M_R + 0.08;
    const yaw = -Math.atan2(z - az0, x - ax0) / MD, k = (L / 2) / Math.hypot(x - ax0, z - az0);
    return [
      { t: 'box', s: [L, 0.12, 0.16], p: [ax0 + (x - ax0) * k, M_FY - 0.02, az0 + (z - az0) * k], r3: [0, yaw, 0], m: 'paint' },   // arm
      ...mRing(c, M_R, 12, 0.06, 0.16, 'paint2'),                                                    // clear duct
      { t: 'cyl', ax: 'y', r: M_R + 0.035, l: 0.03, seg: 12, open: true, p: [x, M_FY - 0.06, z], m: 'pink', d: 1 },   // pink duct band
      { t: 'cyl', ax: 'y', r: 0.1, l: 0.2, seg: 8, p: [x, M_FY - 0.08, z], m: 'navy' },                                              // motor pod
      // fan (spins): three pink blades + navy spinner
      { t: 'cyl', ax: 'y', r: 0.08, l: 0.06, seg: 8, p: [x, M_FY + 0.03, z], m: 'navy', g },
      ...[20, 140, 260].map((a) => mBlade([x, M_FY + 0.03, z], M_R - 0.06, a, 0.14, 0.015, 'pink', g)),
    ];
  }),
];
const mPivots = {}, mSpin = {};
M_FANS.forEach(([x, z], i) => { const g = i ? 'spin' + (i + 1) : 'spin'; mPivots[g] = [x, M_FY + 0.03, z]; mSpin[g] = { axis: 'y', speed: (i === 0 || i === 3 ? 1 : -1) * 45 }; });

export const AIR_MISSILE = { name: 'Quad-fan missile pod', unit: 'AIR-Missiles', ref: 'air_missile', colors: AIR_COLORS,
  parts: mParts, pivots: mPivots, hover: 1, spin: mSpin, views: { side: 'right', top: 'down' } };
