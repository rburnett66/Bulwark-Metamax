// src/render3d/units/air/bomber.js — AIR-HeavyBomber: Flying-wing bomber (owner concept tools/unit-models/ref/air/air-bomber.png)
// [MM-story_mvh8woji_1]. A navy flying wing about 1.6× a hull wide in game: glazed cockpit at the nose apex, four engine
// pods along the trailing edge, an open bomb bay in the centre, white edge trim, a white roundel with a pink sakura emblem on the
// right wing, a red kill-mark row by the nose, a scatter of sakura petals. Flies like the jet (hover, no turret).
import { AIR_COLORS } from './palette.js';

// wing plan (x forward, z right): nose apex → swept leading edge → tip → sawtooth trailing edge
const WING = [[1.55, 0], [-1.05, 2.5], [-1.16, 2.44], [-0.8, 1.3], [-1.05, 0.8], [-0.85, 0.35], [-1.15, 0]];
const wingHalf = WING;   // one side; mirrored
// a centre-body cross-section (z, y)
const body = (w, yb, yt) => [[0, yb], [w * 0.75, yb + 0.02], [w, (yb + yt) / 2], [w * 0.7, yt - 0.02], [0, yt], [-w * 0.7, yt - 0.02], [-w, (yb + yt) / 2], [-w * 0.75, yb + 0.02]];
const can = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.7, yb + 0.7 * (yt - yb)], [0, yt], [-w * 0.7, yb + 0.7 * (yt - yb)]];
const PODS = [[0.62, -0.38], [1.08, -0.62]];   // engine pods [z, centre x] (mirrored) — staggered back with the sweep

const parts = [
  // the wing slab (thin) and the thick centre body blended over it
  { t: 'ext', ax: 'y', poly: wingHalf, d: [0.38, 0.46], m: 'navy', mir: true },
  { t: 'loft', ax: 'x', secs: [
    [1.5, body(0.08, 0.4, 0.46)], [1.0, body(0.42, 0.33, 0.6)], [0.3, body(0.8, 0.3, 0.64)], [-0.5, body(0.9, 0.31, 0.6)], [-1.1, body(0.7, 0.35, 0.5)]], m: 'navy' },
  // white edge trim along the leading edges
  { t: 'ext', ax: 'y', poly: [[1.55, 0], [-1.05, 2.5], [-1.09, 2.44], [1.45, 0]], d: [0.455, 0.47], m: 'paint', mir: true },
  // light trailing-edge trim
  { t: 'ext', ax: 'y', poly: [[-1.16, 2.44], [-0.8, 1.3], [-0.86, 1.3], [-1.2, 2.4]], d: [0.455, 0.468], m: 'paint2', mir: true },
  { t: 'ext', ax: 'y', poly: [[-0.8, 1.3], [-1.05, 0.8], [-1.1, 0.82], [-0.86, 1.32]], d: [0.455, 0.468], m: 'paint2', mir: true },
  // glazed cockpit at the apex: a framed canopy
  { t: 'loft', ax: 'x', secs: [[1.32, can(0.52, 0.54, 0.05)], [1.15, can(0.53, 0.68, 0.2)], [0.9, can(0.56, 0.72, 0.24)], [0.68, can(0.58, 0.66, 0.16)]], m: 'glass' },
  { t: 'box', s: [0.02, 0.17, 0.42], p: [1.0, 0.63, 0], m: 'paint2', d: 1 },
  { t: 'box', s: [0.5, 0.02, 0.02], p: [0.98, 0.72, 0], m: 'paint2', d: 1 },
  // open bomb bay in the centre: dark well with grey slats
  { t: 'box', s: [0.75, 0.03, 0.42], p: [0.05, 0.635, 0], m: 'black' },
  ...[-0.24, -0.08, 0.08, 0.24].map((x) => ({ t: 'box', s: [0.05, 0.035, 0.42], p: [0.05 + x, 0.64, 0], m: 'paint2', d: 1 })),
  { t: 'box', s: [0.8, 0.04, 0.03], p: [0.05, 0.64, 0.23], m: 'paint2', mir: true },
  // four engine pods along the trailing edge: navy nacelle, dark intake, metal nozzle with a glow
  ...PODS.flatMap(([z, x]) => [
    { t: 'cyl', ax: 'x', r: [0.12, 0.15], l: 0.25, seg: 10, p: [x + 0.4, 0.55, z], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.15, l: 0.6, seg: 10, p: [x - 0.02, 0.55, z], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [x + 0.53, 0.55, z], m: 'black', mir: true },
    { t: 'cyl', ax: 'x', r: [0.14, 0.11], l: 0.16, seg: 10, p: [x - 0.4, 0.55, z], m: 'metal', mir: true },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.02, seg: 10, p: [x - 0.49, 0.55, z], m: 'glowB', mir: true },
    { t: 'box', s: [0.5, 0.08, 0.06], p: [x, 0.47, z], m: 'navy', mir: true },
  ]),
  // white roundel with a navy ring and a pink sakura emblem on the right wing; "02" panel on the left (white blocks)
  { t: 'cyl', ax: 'y', r: 0.26, l: 0.02, seg: 14, p: [-0.35, 0.475, 1.55], m: 'paint' },
  { t: 'cyl', ax: 'y', r: 0.18, l: 0.025, seg: 14, p: [-0.35, 0.477, 1.55], m: 'navy' },
  { t: 'cyl', ax: 'y', r: 0.1, l: 0.03, seg: 8, p: [-0.35, 0.48, 1.55], m: 'pink' },
  { t: 'box', s: [0.18, 0.02, 0.06], p: [0.05, 0.47, -1.35], m: 'paint' },
  { t: 'box', s: [0.18, 0.02, 0.06], p: [0.05, 0.47, -1.55], m: 'paint' },
  // red kill-mark row by the nose (left side)
  ...[0, 1, 2, 3, 4].map((i) => ({ t: 'box', s: [0.05, 0.02, 0.05], p: [0.62 - i * 0.1, 0.62, -0.48 - i * 0.07], m: 'red', d: 1 })),
  // a scatter of sakura petals
  ...[[0.6, 1.0], [0.2, 1.9], [-0.6, 2.0], [0.4, -1.1], [-0.2, -2.0], [-0.5, -1.0], [0.9, 0.55], [-0.1, 0.95]].map(([x, z]) =>
    ({ t: 'box', s: [0.06, 0.015, 0.05], p: [x, 0.47, z], r3: [0, 30, 0], m: 'pink', d: 1 })),
];

export const AIR_BOMBER = { name: 'Flying-wing bomber', unit: 'AIR-HeavyBomber', ref: 'air_bomber', colors: AIR_COLORS,
  parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
