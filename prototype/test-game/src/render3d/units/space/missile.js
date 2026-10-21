// src/render3d/units/space/missile.js — SPC-Missiles: Missile satellite (owner concept tools/unit-models/ref/space/space-missile-launcher.png)
// [MM-story_mvho2d6s_5]. A flying satellite bus: a white faceted body banded in federation blue under a gold-foil deck that
// carries five upright missiles, long navy solar-panel wings on gunmetal booms, a sensor dish on the nose, four foil
// thruster bells underneath and magenta running lights. The missiles leave from the deck.
import { SPACE_COLORS, dish, beacon } from './palette.js';

const oct = (rz, ry, cy) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) / 8 * Math.PI * 2; return [Math.cos(a) * rz, cy + Math.sin(a) * ry]; });
const MX = [-0.6, -0.3, 0.0, 0.3, 0.6];

export const SPACE_MISSILE = { name: 'Missile satellite', unit: 'SPC-Missiles', ref: 'space_missile', colors: SPACE_COLORS,
  parts: [
    { t: 'loft', ax: 'x', m: 'lunar', secs: [[1.3, oct(0.35, 0.3, 1.0)], [0.9, oct(0.6, 0.45, 1.0)], [-0.9, oct(0.6, 0.45, 1.0)], [-1.3, oct(0.35, 0.3, 1.0)]] },
    { t: 'loft', ax: 'x', m: 'fed', secs: [[1.0, oct(0.58, 0.44, 1.0)], [0.8, oct(0.62, 0.47, 1.0)]] },
    { t: 'loft', ax: 'x', m: 'fed', secs: [[-0.8, oct(0.62, 0.47, 1.0)], [-1.0, oct(0.58, 0.44, 1.0)]] },
    { t: 'ext', ax: 'z', poly: [[-0.95, 1.42], [0.95, 1.42], [0.85, 1.5], [-0.85, 1.5]], d: [-0.43, 0.43], m: 'foil' },   // chamfered foil deck
    { t: 'box', s: [0.8, 0.4, 0.02], p: [0, 0.95, 0.615], m: 'foil', mir: true },
    // five upright missiles in launch collars
    ...MX.flatMap((x) => [
      { t: 'cyl', ax: 'y', r: 0.09, l: 0.12, seg: 8, p: [x, 1.55, 0], m: 'gun' },
      { t: 'cyl', ax: 'y', r: 0.065, l: 0.6, seg: 8, p: [x, 1.85, 0], m: 'lunar' },
      { t: 'cyl', ax: 'y', r: [0, 0.065], l: 0.18, seg: 8, p: [x, 2.24, 0], m: 'metal' },
      { t: 'box', s: [0.02, 0.12, 0.2], p: [x, 1.62, 0], m: 'gun', d: 1 },
    ]),
    // solar wings: booms + two navy panels each side with gunmetal frames
    { t: 'cyl', ax: 'z', r: 0.05, l: 3.0, seg: 6, p: [0, 1.0, 0], m: 'gun' },
    ...[[1.25, 2.05]].flatMap(([z0, z1]) => [
      { t: 'box', s: [0.95, 0.04, (z1 - z0)], p: [0, 1.0, (z0 + z1) / 2], m: 'solar', mir: true },
      { t: 'box', s: [0.95, 0.04, (z1 - z0)], p: [0, 1.0, (z0 + z1) / 2 + (z1 - z0) + 0.06], m: 'solar', mir: true },
      { t: 'box', s: [1.0, 0.05, 0.04], p: [0, 1.0, z0], m: 'gun', mir: true },
      { t: 'box', s: [1.0, 0.05, 0.04], p: [0, 1.0, z1 + 0.03], m: 'gun', mir: true },
      { t: 'box', s: [1.0, 0.05, 0.04], p: [0, 1.0, z1 * 2 - z0 + 0.06], m: 'gun', mir: true },
      { t: 'box', s: [0.03, 0.05, (z1 - z0) * 2 + 0.06], p: [0, 1.0, z1 + 0.03], m: 'gun', mir: true, d: 1 },
    ]),
    // nose dish, thruster bells, running lights
    ...dish(1.1, 1.3, -0.2, 0.3, { tilt: 55, yaw: 0, mast: 0.2 }),
    ...[[0.6, 0.3], [-0.6, 0.3]].flatMap(([x, z]) => [
      { t: 'cyl', ax: 'y', r: [0.08, 0.14], l: 0.2, seg: 10, p: [x, 0.5, z], m: 'foil', mir: true },
      { t: 'cyl', ax: 'y', r: 0.1, l: 0.02, seg: 10, p: [x, 0.39, z], m: 'glowB', mir: true },
    ]),
    { t: 'cyl', ax: 'x', r: 0.12, l: 0.12, seg: 10, p: [-1.36, 1.0, 0], m: 'foil' },
    ...beacon(1.2, 1.25, 0.3), ...beacon(-1.25, 1.25, -0.3),
  ],
  pivots: {}, hover: 1,
  muzzles: MX.filter((_, i) => i % 2 === 0).map((x) => ({ p: [x, 2.34, 0], d: [0.2, 1, 0], back: 0 })),
  views: { side: 'left', top: 'down' } };
