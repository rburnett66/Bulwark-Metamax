// src/render3d/units/space/fighter.js — SPC-Planes: Federation shuttle-fighter (owner concept tools/unit-models/ref/space/space-fighter.png)
// [MM-story_mvho2d6s_5]. A white delta-winged shuttle: black-tipped nose and cockpit glazing, a tall federation-blue fin, a
// magenta stripe across each wing, a blue roundel, quad engine pods at the wing trailing edges, and a small dorsal dish.
import { SPACE_COLORS, dish } from './palette.js';

const fus = (rz, ry, cy) => [[0, cy - ry], [rz * 0.85, cy - ry * 0.6], [rz, cy], [rz * 0.7, cy + ry * 0.75], [0, cy + ry], [-rz * 0.7, cy + ry * 0.75], [-rz, cy], [-rz * 0.85, cy - ry * 0.6]];

export const SPACE_FIGHTER = { name: 'Shuttle fighter', unit: 'SPC-Planes', ref: 'space_fighter', colors: SPACE_COLORS,
  parts: [
    { t: 'loft', ax: 'x', m: 'lunar', secs: [
      [2.4, fus(0.02, 0.02, 0.62)], [2.0, fus(0.16, 0.13, 0.62)], [1.3, fus(0.3, 0.26, 0.64)], [0.2, fus(0.36, 0.3, 0.66)],
      [-1.2, fus(0.36, 0.3, 0.66)], [-1.75, fus(0.3, 0.26, 0.66)]] },
    { t: 'loft', ax: 'x', m: 'black', secs: [[2.43, fus(0.01, 0.01, 0.62)], [2.05, fus(0.15, 0.12, 0.62)]] },
    { t: 'loft', ax: 'x', m: 'glass', secs: [[1.75, fus(0.06, 0.03, 0.82)], [1.45, fus(0.2, 0.08, 0.86)], [1.05, fus(0.2, 0.08, 0.9)], [0.85, fus(0.06, 0.02, 0.9)]] },
    // delta wings: white, magenta stripe, black leading edge
    { t: 'ext', ax: 'y', poly: [[1.2, 0.3], [-1.1, 2.0], [-1.65, 2.0], [-1.7, 0.3]], d: [0.5, 0.58], m: 'lunar', mir: true },
    { t: 'ext', ax: 'y', poly: [[1.2, 0.3], [-1.1, 2.0], [-1.18, 2.0], [1.05, 0.3]], d: [0.505, 0.585], m: 'lunar2', mir: true },
    { t: 'ext', ax: 'y', poly: [[0.1, 0.4], [-0.9, 1.75], [-1.02, 1.75], [-0.05, 0.4]], d: [0.58, 0.59], m: 'glowM', mir: true },
    { t: 'cyl', ax: 'y', r: 0.2, l: 0.015, seg: 12, p: [-0.75, 0.59, 1.0], m: 'fed', mir: true },
    // tall blue fin with a white root
    { t: 'ext', ax: 'z', poly: [[-0.6, 0.9], [-1.35, 2.25], [-1.7, 2.25], [-1.75, 0.9]], d: [-0.035, 0.035], m: 'fed' },
    { t: 'ext', ax: 'z', poly: [[-0.6, 0.9], [-0.75, 1.15], [-1.75, 1.15], [-1.75, 0.9]], d: [-0.04, 0.04], m: 'lunar' },
    // quad engine pods at the wing trailing edges
    ...[1.2].flatMap((z) => [
      { t: 'box', s: [0.7, 0.4, 0.42], p: [-1.4, 0.55, z], m: 'gun', mir: true },
      ...[[0.45, 0.1], [0.65, 0.1], [0.45, -0.1], [0.65, -0.1]].map(([y, dz]) => ({ t: 'cyl', ax: 'x', r: [0.09, 0.08], l: 0.25, seg: 8, p: [-1.85, y, z + dz], m: 'metal', mir: true })),
      ...[[0.45, 0.1], [0.65, 0.1], [0.45, -0.1], [0.65, -0.1]].map(([y, dz]) => ({ t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 8, p: [-1.98, y, z + dz], m: 'glowB', mir: true })),
    ]),
    // main nozzle and dorsal dish
    { t: 'cyl', ax: 'x', r: [0.24, 0.28], l: 0.2, seg: 10, p: [-1.85, 0.66, 0], m: 'gun' },
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.02, seg: 10, p: [-1.96, 0.66, 0], m: 'glowB' },
    ...dish(0.2, 0.94, 0.15, 0.16, { tilt: 30, yaw: 160, mast: 0.12 }),
  ],
  pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
