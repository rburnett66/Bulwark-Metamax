// src/render3d/units/dark/fighter.js — DRK-Planes: Twilight striker (owner concept tools/unit-models/ref/dark/dark-fighter.png:
// "fast ground striker with light splash") [MM-story_mvifm4xj_1]. A black stealth arrowhead: a long blade-thin nose, a
// faceted fuselage, sharply swept cranked wings, violet energy lines along its spine and wing roots, and twin engines
// burning violet. Flies like the jet (hover, no turret).
import { DARK_COLORS, veins } from './palette.js';

const fus = (rz, ry, cy) => [[0, cy - ry], [rz, cy - ry * 0.2], [rz * 0.55, cy + ry * 0.7], [0, cy + ry], [-rz * 0.55, cy + ry * 0.7], [-rz, cy - ry * 0.2]];

export const DARK_FIGHTER = { name: 'Twilight striker', unit: 'DRK-Planes', ref: 'dark_fighter', colors: DARK_COLORS,
  parts: [
    { t: 'loft', ax: 'x', m: 'void', secs: [
      [2.6, fus(0.01, 0.01, 0.6)], [1.9, fus(0.14, 0.08, 0.62)], [1.0, fus(0.32, 0.18, 0.65)], [0.0, fus(0.42, 0.24, 0.68)],
      [-1.1, fus(0.44, 0.22, 0.68)], [-1.7, fus(0.38, 0.18, 0.66)]] },
    { t: 'loft', ax: 'x', m: 'glass', secs: [[1.45, fus(0.04, 0.02, 0.74)], [1.1, fus(0.14, 0.08, 0.8)], [0.7, fus(0.12, 0.07, 0.82)], [0.45, fus(0.03, 0.02, 0.8)]] },
    // cranked, sharply swept wings with a violet root line; small canted tails
    { t: 'ext', ax: 'y', poly: [[0.9, 0.3], [-0.6, 1.25], [-1.25, 2.05], [-1.55, 2.0], [-1.45, 1.1], [-1.75, 0.35]], d: [0.6, 0.66], m: 'obsid', mir: true },
    { t: 'ext', ax: 'y', poly: [[0.9, 0.3], [-0.6, 1.25], [-1.25, 2.05], [-1.2, 2.1], [-0.5, 1.3], [1.0, 0.32]], d: [0.605, 0.665], m: 'black', mir: true },
    ...veins('y', 0.665, [[0.6, 0.38], [-0.4, 1.0], [-1.1, 1.75]], 0.03, { mir: true }),
    ...veins('y', 0.9, [[1.0, 0.0], [0.0, 0.0], [-1.0, 0.0]], 0.03),
    { t: 'ext', ax: 'z', poly: [[0, 0], [-0.3, 0.5], [-0.5, 0.5], [-0.45, 0]], d: [-0.025, 0.025], p: [-1.2, 0.82, 0.3], r3: [20, 0, 0], m: 'obsid', mir: true },
    // twin engines burning violet
    ...[0.24].flatMap((z) => [
      { t: 'cyl', ax: 'x', r: [0.14, 0.16], l: 0.25, seg: 8, p: [-1.8, 0.64, z], m: 'ash', mir: true },
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.02, seg: 8, p: [-1.93, 0.64, z], m: 'glowV', mir: true },
      { t: 'cyl', ax: 'x', r: [0.11, 0.0], l: 0.5, seg: 6, p: [-2.2, 0.64, z], m: 'glowB', mir: true },
    ]),
  ],
  pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
