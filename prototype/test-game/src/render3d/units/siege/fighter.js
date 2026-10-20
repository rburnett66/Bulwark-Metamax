// src/render3d/units/siege/fighter.js — ART-Planes: Cannon striker (owner concept tools/unit-models/ref/siege/siege-fighter.png)
// [MM-story_mvhb6qd2_2]. A weathered swept-wing ground-attack jet in rust and dust-tan camo, built around a very long, fat
// gun barrel that runs out of the nose and ends in a brass muzzle band — the gun dominates the front. Dark canopy, side
// intakes, swept wings with tan camo patches, twin canted tails. Flies like the jet (hover, no turret).
import { SIEGE_COLORS } from './palette.js';

const sf = (yb, yt, w) => { const h = yt - yb, ym = yb + 0.45 * h; return [[0, yb], [w * 0.75, yb + 0.15 * h], [w, ym], [w * 0.65, yt - 0.1 * h], [0, yt], [-w * 0.65, yt - 0.1 * h], [-w, ym], [-w * 0.75, yb + 0.15 * h]]; };
const scan = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.7, yb + 0.7 * (yt - yb)], [0, yt], [-w * 0.7, yb + 0.7 * (yt - yb)]];
const S_FIN = { r3: [16, 0, 0] };

const sParts = [
  // fuselage: blunt gun housing at the front → cockpit → spine → tail
  { t: 'loft', ax: 'x', secs: [
    [1.25, sf(0.4, 0.66, 0.18)], [0.9, sf(0.3, 0.8, 0.3)], [0.3, sf(0.26, 0.9, 0.4)], [-0.6, sf(0.26, 0.88, 0.4)],
    [-1.5, sf(0.3, 0.76, 0.3)], [-1.95, sf(0.36, 0.64, 0.18)]], m: 'rust' },
  // tan camo patches along the spine and flanks
  { t: 'box', s: [0.55, 0.03, 0.34], p: [-0.2, 0.9, 0.05], r3: [0, 12, 0], m: 'camo' },
  { t: 'box', s: [0.45, 0.03, 0.26], p: [-1.1, 0.82, -0.06], r3: [0, -18, 0], m: 'camo' },
  { t: 'box', s: [0.5, 0.2, 0.02], p: [0.45, 0.62, 0.4], m: 'camo', mir: true },
  // THE GUN: a fat dark barrel out of the nose, tapering, brass muzzle band
  { t: 'cyl', ax: 'x', r: [0.15, 0.24], l: 1.1, seg: 10, p: [1.75, 0.53, 0], m: 'dark' },
  { t: 'cyl', ax: 'x', r: [0.14, 0.15], l: 0.3, seg: 10, p: [2.45, 0.53, 0], m: 'metal' },
  { t: 'cyl', ax: 'x', r: 0.16, l: 0.16, seg: 10, p: [2.68, 0.53, 0], m: 'hazard' },
  { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [2.77, 0.53, 0], m: 'black' },
  { t: 'cyl', ax: 'x', r: 0.26, l: 0.08, seg: 10, p: [1.24, 0.53, 0], m: 'metal' },        // gun collar where it leaves the nose
  // dark canopy
  { t: 'loft', ax: 'x', secs: [[1.05, scan(0.74, 0.76, 0.04)], [0.85, scan(0.75, 0.92, 0.15)], [0.45, scan(0.78, 0.98, 0.17)], [0.15, scan(0.82, 0.88, 0.08)]], m: 'glass' },
  // side intakes
  { t: 'ext', ax: 'x', poly: [[0.36, 0.3], [0.62, 0.3], [0.62, 0.62], [0.36, 0.66]], d: [-0.45, 0.6], m: 'olive', mir: true },
  { t: 'box', s: [0.02, 0.26, 0.22], p: [0.61, 0.47, 0.49], m: 'black', mir: true },
  // swept main wings: tan camo, rust patches, olive leading edge
  { t: 'ext', ax: 'y', poly: [[0.25, 0.3], [-0.95, 1.95], [-1.3, 1.95], [-1.45, 0.3]], d: [0.44, 0.5], m: 'net', mir: true },
  { t: 'ext', ax: 'y', poly: [[0.25, 0.3], [-0.95, 1.95], [-1.02, 1.95], [0.12, 0.3]], d: [0.445, 0.51], m: 'olive', mir: true },
  { t: 'ext', ax: 'y', poly: [[-0.55, 0.9], [-0.95, 1.45], [-1.2, 1.4], [-0.95, 0.85]], d: [0.5, 0.512], m: 'rust', mir: true },
  { t: 'box', s: [0.25, 0.012, 0.25], p: [-0.5, 0.505, 0.65], r3: [0, 25, 0], m: 'camo', mir: true, d: 1 },
  { t: 'ext', ax: 'y', poly: [[-0.1, 0.45], [-0.45, 0.95], [-0.7, 0.9], [-0.4, 0.42]], d: [0.5, 0.512], m: 'camo', mir: true },
  // underwing bombs
  { t: 'cyl', ax: 'x', r: 0.07, l: 0.55, seg: 6, p: [-0.65, 0.33, 1.1], m: 'olive', mir: true, d: 1 },
  { t: 'cyl', ax: 'x', r: [0, 0.07], l: 0.12, seg: 6, p: [-0.32, 0.33, 1.1], m: 'hazard', mir: true, d: 1 },
  // tailplanes
  { t: 'ext', ax: 'y', poly: [[-1.4, 0.25], [-1.85, 0.95], [-2.05, 0.95], [-1.98, 0.25]], d: [0.44, 0.48], m: 'net', mir: true },
  // twin canted fins
  { t: 'ext', ax: 'z', poly: [[-1.05, 0], [-1.55, 0.95], [-1.8, 0.95], [-1.98, 0]], d: [-0.03, 0.03], p: [0, 0.72, 0.32], ...S_FIN, m: 'net', mir: true },
  { t: 'ext', ax: 'z', poly: [[-1.45, 0.4], [-1.65, 0.75], [-1.8, 0.72], [-1.68, 0.38]], d: [-0.035, 0.035], p: [0, 0.72, 0.32], ...S_FIN, m: 'rust', mir: true },
  // twin nozzles
  { t: 'cyl', ax: 'x', r: [0.13, 0.16], l: 0.18, seg: 10, p: [-2.02, 0.47, 0.17], m: 'metal', mir: true },
  { t: 'cyl', ax: 'x', r: 0.11, l: 0.02, seg: 10, p: [-2.12, 0.47, 0.17], m: 'black', mir: true },
];

export const SIEGE_FIGHTER = { name: 'Cannon striker', unit: 'ART-Planes', ref: 'siege_fighter', colors: SIEGE_COLORS,
  parts: sParts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
