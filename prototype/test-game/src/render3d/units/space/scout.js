// src/render3d/units/space/scout.js — SPC-Trucks: 6x6 lunar reconnaissance rover (owner concept
// tools/unit-models/ref/space/space-scout.png — the owner's sheet: "open frame, 6-wheel drive, front coil emitter gun,
// sensor dish") [MM-story_mvho2d6s_5]. Six big tyres on an open gunmetal frame, a white cab with federation-blue panels,
// a gold-foil power box, a tall sensor dish with a magenta beacon, and a coil emitter gun on the nose (turret yaw, barrel pitch).
import { SPACE_COLORS, dish, beacon, whip, coilBarrel } from './palette.js';

const TPIV = [1.5, 0.95, 0], TRUN = [1.55, 0.98, 0];
const tyre = (x) => [
  { t: 'cyl', ax: 'z', r: 0.45, l: 0.36, seg: 12, p: [x, 0.45, 0.95], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: 0.24, l: 0.4, seg: 8, p: [x, 0.45, 0.95], m: 'lunar2', mir: true },
  { t: 'cyl', ax: 'z', r: 0.08, l: 0.44, seg: 6, p: [x, 0.45, 0.95], m: 'gun', mir: true, d: 1 },
];

export const SPACE_SCOUT = { name: 'Lunar rover', unit: 'SPC-Trucks', ref: 'space_scout', colors: SPACE_COLORS,
  parts: [
    ...tyre(1.15), ...tyre(0.0), ...tyre(-1.15),
    // open frame: side rails, cross members, suspension arms
    { t: 'box', s: [3.1, 0.12, 0.12], p: [0, 0.72, 0.62], m: 'gun', mir: true },
    { t: 'box', s: [3.1, 0.08, 0.08], p: [0, 1.0, 0.62], m: 'gun', mir: true },
    ...[1.15, 0.0, -1.15].flatMap((x) => [
      { t: 'box', s: [0.12, 0.1, 1.3], p: [x, 0.72, 0], m: 'gun' },
      { t: 'box', s: [0.08, 0.3, 0.08], p: [x, 0.86, 0.62], m: 'metal', mir: true },
    ]),
    { t: 'box', s: [3.0, 0.08, 1.2], p: [-0.05, 0.8, 0], m: 'dark' },
    // cab: white body, blue panels, windscreen
    { t: 'ext', ax: 'z', poly: [[-0.2, 0.84], [-0.2, 1.75], [0.55, 1.75], [1.05, 1.35], [1.55, 1.25], [1.6, 0.84]], d: [-0.55, 0.55], m: 'lunar' },
    { t: 'box', s: [0.6, 0.5, 0.02], p: [0.35, 1.2, 0.56], m: 'fed', mir: true },
    { t: 'box', s: [0.04, 0.38, 0.9], p: [0.8, 1.55, 0], r3: [0, 0, 38], m: 'glass' },
    { t: 'box', s: [0.4, 0.28, 0.02], p: [1.2, 1.05, 0.56], m: 'fed', mir: true },
    // rear: gold foil power box, gunmetal cargo rack
    { t: 'box', s: [0.7, 0.6, 0.8], p: [-0.7, 1.15, 0.1], m: 'foil' },
    { t: 'box', s: [0.5, 0.35, 1.0], p: [-1.3, 1.0, 0], m: 'gun' },
    ...[-1.45, -1.15].map((x) => ({ t: 'box', s: [0.04, 0.3, 1.02], p: [x, 1.0, 0], m: 'dark', d: 1 })),
    // big sensor dish on a mast, beacon, antennas
    ...dish(0.15, 1.75, -0.25, 0.5, { tilt: 30, yaw: 150, mast: 0.55 }),
    ...beacon(0.4, 1.75, 0.35, 1.2), whip(-0.1, 1.75, 0.4, 1.2), whip(-1.4, 1.18, -0.4, 0.9),
    // ── coil emitter gun on the nose ──
    { t: 'cyl', ax: 'y', r: 0.14, l: 0.12, seg: 8, p: [1.5, 0.9, 0], m: 'gun', g: 'turret' },
    { t: 'box', s: [0.26, 0.18, 0.24], p: [1.55, 0.98, 0], m: 'lunar2', g: 'turret' },
    ...coilBarrel(1.6, 2.35, 0.98, 0, 0.05, { coils: 5, c0: 0.2, c1: 0.7, extra: { g: 'barrel' } }),
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.8 },
  muzzles: [{ p: [2.36, 0.98, 0], d: [1, 0, 0], back: 0.3, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
