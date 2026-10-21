// src/render3d/units/space/troops.js — SPC-Troops: Bubble trooper (owner concept tools/unit-models/ref/space/space-troop.png)
// [MM-story_mvho2d6s_5]. A small tracked crew carrier: white hull with blue pinstripes, a big glass bubble canopy over the
// seat, a gold-foil stores box, antennas and a beacon, and a short coil gun on a front mount (turret yaw, barrel pitch).
import { SPACE_COLORS, beacon, whip, coilBarrel } from './palette.js';
import { track } from '../prims.js';

const TPIV = [1.0, 0.85, 0.2], TRUN = [1.1, 0.85, 0.2];

export const SPACE_TROOPS = { name: 'Bubble trooper', unit: 'SPC-Troops', ref: 'space_troops', colors: SPACE_COLORS,
  parts: [
    ...track({ x0: -1.3, x1: 1.2, h: 0.55, z: 0.7, w: 0.42, wheels: 4, wr: 0.18 }),
    { t: 'ext', ax: 'z', poly: [[-1.35, 0.35], [-1.4, 1.2], [-0.6, 1.35], [0.6, 1.3], [1.25, 0.95], [1.25, 0.45], [1.0, 0.35]], d: [-0.6, 0.6], m: 'lunar' },
    { t: 'loft', ax: 'x', m: 'lunar', mir: true, secs: [
      [-1.35, [[0.5, 0.56], [0.94, 0.56], [0.94, 0.72], [0.5, 0.78]]], [1.1, [[0.5, 0.56], [0.94, 0.56], [0.94, 0.72], [0.5, 0.78]]],
      [1.3, [[0.5, 0.44], [0.94, 0.44], [0.94, 0.56], [0.5, 0.6]]]] },
    ...[0.92, 1.02].map((y) => ({ t: 'box', s: [2.0, 0.025, 0.02], p: [-0.15, y, 0.61], m: 'fed', mir: true })),
    { t: 'cyl', ax: 'z', r: 0.18, l: 0.02, seg: 12, p: [-0.65, 0.95, 0.61], m: 'fed', mir: true },
    // glass bubble canopy over the seat, gunmetal ring
    { t: 'cyl', ax: 'y', r: 0.5, l: 0.08, seg: 14, p: [-0.15, 1.34, 0], m: 'gun' },
    { t: 'ell', s: [0.5, 0.5, 0.48], seg: 12, p: [-0.15, 1.36, 0], m: 'glass' },
    { t: 'box', s: [0.3, 0.32, 0.3], p: [-0.2, 1.5, 0], m: 'dark', d: 1 },
    // gold foil stores box on the right flank, antennas, beacons
    { t: 'box', s: [0.5, 0.4, 0.22], p: [-0.85, 1.05, 0.68], m: 'foil' },
    whip(-1.2, 1.25, -0.4, 1.1), whip(-1.3, 1.22, 0.35, 0.8),
    ...beacon(-0.95, 1.28, -0.2), ...beacon(1.0, 1.08, -0.4),
    // ── coil gun on the front mount ──
    { t: 'cyl', ax: 'y', r: 0.16, l: 0.14, seg: 8, p: [1.0, 0.76, 0.2], m: 'gun', g: 'turret' },
    { t: 'box', s: [0.3, 0.22, 0.26], p: [1.05, 0.85, 0.2], m: 'lunar2', g: 'turret' },
    ...coilBarrel(1.1, 2.1, 0.85, 0.2, 0.06, { coils: 6, c0: 0.25, c1: 0.75, extra: { g: 'barrel' } }),
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.6 },
  muzzles: [{ p: [2.11, 0.85, 0.2], d: [1, 0, 0], back: 0.4, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
