// src/render3d/units/dark/scout.js — DRK-Trucks: Cult runner (owner concept tools/unit-models/ref/dark/dark-truck.png)
// [MM-story_mvifm4xj_1]. An armoured 4x4 in void black: slab-sided body, heavy grille and bumper, slit windscreen, a
// violet diamond sigil on its doors, a caged violet beacon on the roof, an exhaust stack, and a lantern on a jointed
// post off the front corner — the lantern post yaws (`turret`), the lantern swings (`barrel`).
import { DARK_COLORS, veins } from './palette.js';
import { strut } from '../arcane/palette.js';

const TPIV = [1.35, 1.45, -0.62], TRUN = [1.75, 1.9, -0.62];
const tyre = (x) => [
  { t: 'cyl', ax: 'z', r: 0.48, l: 0.36, seg: 12, p: [x, 0.48, 0.82], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: 0.25, l: 0.4, seg: 8, p: [x, 0.48, 0.82], m: 'obsid', mir: true },
  { t: 'cyl', ax: 'z', r: 0.08, l: 0.44, seg: 6, p: [x, 0.48, 0.82], m: 'ash', mir: true, d: 1 },
];

export const DARK_SCOUT = { name: 'Cult runner', unit: 'DRK-Trucks', ref: 'dark_scout', colors: DARK_COLORS,
  parts: [
    ...tyre(1.15), ...tyre(-1.1),
    // body: a long armoured box, hood stepping down at the front, fender flares
    { t: 'ext', ax: 'z', poly: [[-1.85, 0.6], [-1.85, 1.95], [0.35, 1.95], [0.55, 1.45], [1.75, 1.4], [1.9, 1.2], [1.9, 0.6]], d: [-0.7, 0.7], m: 'void' },
    ...[1.15, -1.1].map((x) => ({ t: 'ext', ax: 'z', poly: [[x - 0.66, 0.85], [x - 0.5, 1.12], [x + 0.5, 1.12], [x + 0.66, 0.85]], d: [0.7, 0.86], m: 'obsid', mir: true })),
    { t: 'box', s: [3.6, 0.16, 0.06], p: [0, 0.68, 0.72], m: 'obsid', mir: true },
    // slit windscreen + side windows
    { t: 'box', s: [0.05, 0.2, 1.1], p: [0.46, 1.72, 0], r3: [0, 0, 22], m: 'glass' },
    ...[-0.2, -0.85].map((x) => ({ t: 'box', s: [0.45, 0.16, 0.02], p: [x, 1.7, 0.71], m: 'glass', mir: true })),
    // grille, bumper, headlights
    { t: 'box', s: [0.06, 0.5, 1.0], p: [1.92, 0.98, 0], m: 'obsid' },
    ...[-0.32, -0.16, 0, 0.16, 0.32].map((z) => ({ t: 'box', s: [0.02, 0.42, 0.05], p: [1.96, 0.98, z], m: 'black', d: 1 })),
    { t: 'box', s: [0.22, 0.2, 1.5], p: [2.0, 0.66, 0], m: 'obsid' },
    { t: 'box', s: [0.04, 0.1, 0.16], p: [1.93, 1.3, 0.55], m: 'glowB', mir: true },
    // door sigil (a violet diamond) and cracks
    { t: 'ext', ax: 'z', poly: [[0, -0.2], [0.18, 0], [0, 0.2], [-0.18, 0]], d: [0, 0.02], p: [-0.45, 1.2, 0.705], m: 'glowV', mir: true },
    { t: 'ext', ax: 'z', poly: [[0, -0.11], [0.1, 0], [0, 0.11], [-0.1, 0]], d: [0, 0.03], p: [-0.45, 1.2, 0.71], m: 'void', mir: true },
    ...veins('z', 0.705, [[-1.6, 0.8], [-1.3, 1.05], [-1.4, 1.35]], 0.03, { mir: true }),
    // roof: caged violet beacon, rails, exhaust stack
    { t: 'box', s: [1.9, 0.06, 1.2], p: [-0.75, 1.98, 0], m: 'obsid' },
    { t: 'cyl', ax: 'y', r: 0.22, l: 0.1, seg: 8, p: [-0.45, 2.05, 0], m: 'ash' },
    { t: 'cyl', ax: 'y', r: 0.15, l: 0.32, seg: 8, p: [-0.45, 2.26, 0], m: 'glowV' },
    ...[0, 60, 120].map((a) => ({ t: 'box', s: [0.36, 0.36, 0.03], p: [-0.45, 2.26, 0], r3: [0, a, 0], m: 'ash', d: 1 })),
    { t: 'cyl', ax: 'y', r: [0.12, 0.19], l: 0.12, seg: 8, p: [-0.45, 2.48, 0], m: 'ash' },
    { t: 'cyl', ax: 'y', r: 0.06, l: 0.8, seg: 6, p: [-1.65, 2.3, 0.6], m: 'ash' },
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.2, seg: 6, p: [-1.57, 2.7, 0.6], m: 'ash' },
    // ── lantern post (turret yaws) off the front-left corner; the lantern (barrel) hangs from it ──
    { t: 'cyl', ax: 'y', r: 0.08, l: 0.14, seg: 6, p: [1.35, 1.45, -0.62], m: 'ash', g: 'turret' },
    strut([1.35, 1.48, -0.62], [1.45, 2.0, -0.62], 0.07, 0.07, 'obsid', { g: 'turret' }),
    strut([1.45, 2.0, -0.62], [1.78, 2.04, -0.62], 0.06, 0.06, 'obsid', { g: 'turret' }),
    { t: 'cyl', ax: 'y', r: 0.015, l: 0.18, seg: 4, p: [1.75, 1.9, -0.62], m: 'black', g: 'barrel' },
    { t: 'cyl', ax: 'y', r: [0.05, 0.13], l: 0.08, seg: 6, p: [1.75, 1.78, -0.62], m: 'ash', g: 'barrel' },
    { t: 'cyl', ax: 'y', r: 0.11, l: 0.24, seg: 6, p: [1.75, 1.62, -0.62], m: 'glowV', g: 'barrel' },
    { t: 'cyl', ax: 'y', r: [0.13, 0.05], l: 0.08, seg: 6, p: [1.75, 1.46, -0.62], m: 'ash', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -10, max: 20, rate: 1.6 },
  muzzles: [{ p: [1.88, 1.62, -0.62], d: [1, 0, 0], back: 0.2, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
