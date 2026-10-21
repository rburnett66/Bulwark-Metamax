// src/render3d/units/space/tank.js — SPC-Tanks: Federation coil tank (owner concept tools/unit-models/ref/space/space-tank.png)
// [MM-story_mvho2d6s_5]. A lunar-white tank on full tracks: chamfered hull with gunmetal grille panels on the flanks, a
// federation-blue turret with a sensor dish and magenta beacons, and a long gun wound in copper coils.
import { SPACE_COLORS, dish, beacon, whip, coilBarrel } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.35, 1.12, 0], BPIV = [0.65, 1.38, 0];

export const SPACE_TANK = { name: 'Federation coil tank', unit: 'SPC-Tanks', ref: 'space_tank', colors: SPACE_COLORS,
  parts: [
    ...track({ x0: -1.9, x1: 1.8, h: 0.6, z: 0.92, w: 0.44, wheels: 6, wr: 0.19 }),
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.38], [-1.95, 1.05], [1.15, 1.08], [1.9, 0.8], [1.85, 0.44], [1.45, 0.38]], d: [-0.7, 0.7], m: 'lunar' },
    { t: 'ext', ax: 'z', poly: [[-1.96, 0.38], [-1.96, 0.6], [1.86, 0.6], [1.85, 0.44], [1.45, 0.38]], d: [-0.71, 0.71], m: 'lunar2' },
    // side skirts with gunmetal grilles, blue band
    { t: 'loft', ax: 'x', m: 'lunar', mir: true, secs: [
      [-1.98, [[0.7, 0.62], [1.18, 0.62], [1.18, 0.96], [1.05, 1.06], [0.7, 1.06]]],
      [1.3, [[0.7, 0.62], [1.18, 0.62], [1.18, 0.96], [1.05, 1.06], [0.7, 1.06]]],
      [1.85, [[0.7, 0.62], [1.12, 0.62], [1.12, 0.76], [1.0, 0.84], [0.7, 0.84]]]] },
    ...[0.75, -0.25].map((x) => ({ t: 'box', s: [0.8, 0.3, 0.03], p: [x, 0.84, 1.19], m: 'gun', mir: true })),
    ...[0.45, 0.6, 0.75, 0.9, 1.05, -0.55, -0.4, -0.25, -0.1, 0.05].map((x) => ({ t: 'box', s: [0.03, 0.28, 0.02], p: [x, 0.84, 1.215], m: 'dark', mir: true, d: 1 })),
    { t: 'box', s: [0.7, 0.12, 0.03], p: [-1.35, 0.9, 1.19], m: 'fed', mir: true },
    { t: 'box', s: [0.5, 0.2, 0.4], p: [1.35, 0.98, -0.42], m: 'foil' },
    ...beacon(1.45, 1.06, 0.55), ...beacon(-1.8, 1.05, -0.55),
    // ── turret (yaws): blue wedge housing, white cheeks, dish, beacon, antenna ──
    { t: 'cyl', ax: 'y', r: 0.62, l: 0.1, seg: 12, p: [-0.35, 1.12, 0], m: 'gun', g: 'turret' },
    { t: 'loft', ax: 'y', m: 'fed', g: 'turret', secs: [
      [1.14, [[0.75, -0.55], [0.95, -0.25], [0.95, 0.25], [0.75, 0.55], [-1.1, 0.62], [-1.3, 0.4], [-1.3, -0.4], [-1.1, -0.62]].map(([x, z]) => [x - 0.35, z])],
      [1.62, [[0.55, -0.45], [0.75, -0.2], [0.75, 0.2], [0.55, 0.45], [-1.05, 0.55], [-1.2, 0.35], [-1.2, -0.35], [-1.05, -0.55]].map(([x, z]) => [x - 0.35, z])]] },
    { t: 'box', s: [0.9, 0.2, 0.02], p: [-0.6, 1.38, 0.58], m: 'lunar', g: 'turret', mir: true },
    { t: 'box', s: [1.4, 0.04, 0.9], p: [-0.5, 1.63, 0], m: 'lunar2', g: 'turret' },
    ...dish(-1.1, 1.64, 0.3, 0.26, { tilt: 30, yaw: 140, extra: { g: 'turret' } }),
    ...beacon(-0.2, 1.64, -0.35, 1, { g: 'turret' }),
    whip(-1.35, 1.64, -0.3, 0.9, { g: 'turret' }),
    { t: 'box', s: [0.3, 0.36, 0.5], p: [0.48, 1.38, 0], m: 'gun', g: 'turret' },
    // ── barrel (pitches, recoils): coil gun ──
    ...coilBarrel(0.6, 2.75, 1.38, 0, 0.085, { coils: 9, c0: 0.3, c1: 0.78, extra: { g: 'barrel' } }),
  ],
  pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.2 },
  recoil: 0.3,
  muzzles: [{ p: [2.76, 1.38, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
