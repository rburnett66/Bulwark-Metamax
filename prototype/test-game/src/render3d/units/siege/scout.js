// src/render3d/units/siege/scout.js — ART-Trucks: Observer jeep (owner concept tools/unit-models/ref/siege/siege-jeep.png)
// [MM-story_mvhb6qd2_2]. An open-topped 4x4 in dusty tan with olive patches: chunky tyres under flared fenders, a heavy
// grille and bumper, sandbags piled on the hood, a roll frame, yellow door stencils, camo netting over the rear bed, a
// tall periscope rangefinder mast and two whip antennas. A small grenade-launcher mount on the rear bed is the `turret`
// (yaw) and its gun the `barrel` (pitch).
import { SIEGE_COLORS } from './palette.js';

const TPIV = [-1.1, 1.68, 0.12];
const TRUN = [-0.95, 1.9, 0.12];

const wheel = (x, z) => [
  { t: 'cyl', ax: 'z', r: 0.44, l: 0.34, seg: 12, p: [x, 0.44, z], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: 0.22, l: 0.38, seg: 8, p: [x, 0.44, z], m: 'olive', mir: true },
  { t: 'cyl', ax: 'z', r: 0.08, l: 0.42, seg: 6, p: [x, 0.44, z], m: 'dark', mir: true, d: 1 },
];
const netSec = (w, top, sag) => [[-w, sag], [-w * 0.85, top - 0.08], [-w * 0.3, top + 0.05], [w * 0.2, top - 0.03], [w * 0.75, top + 0.04], [w, sag]];

const parts = [
  ...wheel(1.25, 0.86), ...wheel(-1.2, 0.86),
  // chassis + lower body
  { t: 'ext', ax: 'z', poly: [[-1.95, 0.5], [-1.95, 1.05], [0.55, 1.05], [0.75, 1.18], [1.95, 1.12], [2.05, 0.9], [2.0, 0.5]], d: [-0.72, 0.72], m: 'camo' },
  // flared fenders (olive) over the wheels
  ...[1.25, -1.2].map((x) => ({ t: 'ext', ax: 'z', poly: [[x - 0.6, 0.85], [x - 0.45, 1.02], [x + 0.45, 1.02], [x + 0.6, 0.85], [x + 0.5, 0.82], [x - 0.5, 0.82]], d: [0.7, 1.08], m: 'olive', mir: true })),
  // grille, bumper, headlights
  { t: 'box', s: [0.06, 0.32, 1.0], p: [2.04, 0.82, 0], m: 'dark' },
  ...[-0.3, -0.15, 0, 0.15, 0.3].map((z) => ({ t: 'box', s: [0.02, 0.26, 0.05], p: [2.08, 0.82, z], m: 'black', d: 1 })),
  { t: 'box', s: [0.16, 0.14, 1.5], p: [2.12, 0.55, 0], m: 'olive' },
  { t: 'box', s: [0.04, 0.12, 0.16], p: [2.06, 1.0, 0.5], m: 'metal', mir: true },
  // sandbags piled on the hood
  ...[[1.55, -0.32], [1.55, 0.05], [1.55, 0.4], [1.15, -0.2], [1.15, 0.2]].map(([x, z]) => ({ t: 'ell', s: [0.2, 0.11, 0.17], seg: 6, p: [x, 1.25, z], m: 'net' })),
  // windscreen frame + roll bar (open top)
  { t: 'box', s: [0.06, 0.5, 1.3], p: [0.62, 1.4, 0], r3: [0, 0, -12], m: 'olive' },
  { t: 'box', s: [0.04, 0.38, 1.1], p: [0.64, 1.4, 0], r3: [0, 0, -12], m: 'glass', d: 1 },
  { t: 'box', s: [0.06, 0.62, 0.06], p: [-0.45, 1.36, 0.66], m: 'olive', mir: true },
  { t: 'box', s: [1.1, 0.06, 0.06], p: [0.1, 1.66, 0.66], m: 'olive', mir: true },
  { t: 'box', s: [0.06, 0.06, 1.38], p: [-0.45, 1.66, 0], m: 'olive' },
  // seats in the open cab
  { t: 'box', s: [0.32, 0.3, 0.34], p: [0.0, 1.2, 0.33], m: 'dark', mir: true },
  // olive camo patches on the hood sides and rear quarters
  { t: 'box', s: [0.7, 0.2, 0.02], p: [1.35, 0.95, 0.73], m: 'olive', mir: true, d: 1 },
  { t: 'box', s: [0.6, 0.25, 0.02], p: [-1.45, 0.8, 0.73], m: 'olive', mir: true, d: 1 },
  // doors with yellow stencils, olive camo patch
  { t: 'box', s: [0.9, 0.36, 0.03], p: [0.05, 0.86, 0.73], m: 'olive', mir: true },
  ...[-0.05, 0.12].map((x) => ({ t: 'box', s: [0.06, 0.22, 0.02], p: [x, 0.88, 0.75], m: 'hazard', mir: true })),
  // rear bed under camo netting
  { t: 'loft', ax: 'x', m: 'net', secs: [[-0.42, netSec(0.74, 1.6, 1.0)], [-0.9, netSec(0.8, 1.68, 0.86)], [-1.55, netSec(0.8, 1.62, 0.84)], [-2.02, netSec(0.72, 1.3, 0.9)]] },
  ...[[-0.8, -0.45], [-1.3, 0.4], [-1.75, -0.2], [-1.1, -0.1]].map(([x, z]) => ({ t: 'ell', s: [0.26, 0.1, 0.2], seg: 6, p: [x, 1.66, z], m: 'olive', d: 1 })),
  
  { t: 'box', s: [0.06, 0.34, 0.5], p: [-1.98, 0.8, 0.0], m: 'olive' },
  // periscope rangefinder mast + two whip antennas
  { t: 'cyl', ax: 'y', r: 0.07, l: 1.1, seg: 8, p: [0.25, 1.6, -0.18], m: 'dark' },
  { t: 'box', s: [0.26, 0.2, 0.22], p: [0.27, 2.2, -0.18], m: 'dark' },
  { t: 'box', s: [0.02, 0.1, 0.1], p: [0.41, 2.2, -0.18], m: 'glass' },
  { t: 'cyl', ax: 'y', r: 0.015, l: 1.5, seg: 4, p: [-0.6, 1.8, -0.5], m: 'black' },
  { t: 'cyl', ax: 'y', r: 0.015, l: 1.2, seg: 4, p: [-0.75, 1.65, -0.62], m: 'black' },
  // spare tyre on the back
  { t: 'cyl', ax: 'x', r: 0.3, l: 0.18, seg: 10, p: [-2.08, 0.95, 0.35], m: 'black', d: 1 },

  // grenade-launcher mount (yaws) on the rear bed
  { t: 'cyl', ax: 'y', r: 0.14, l: 0.2, seg: 8, p: [-1.1, 1.78, 0.12], m: 'dark', g: 'turret' },
  { t: 'box', s: [0.3, 0.18, 0.24], p: [-1.05, 1.92, 0.12], m: 'olive', g: 'turret' },
  { t: 'box', s: [0.04, 0.2, 0.2], p: [-1.2, 2.02, 0.12], m: 'dark', g: 'turret', d: 1 },
  // the launcher (pitches)
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.55, seg: 6, p: [-0.68, 1.9, 0.12], m: 'dark', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.075, l: 0.12, seg: 6, p: [-0.42, 1.9, 0.12], m: 'black', g: 'barrel' },
  { t: 'box', s: [0.18, 0.12, 0.12], p: [-0.9, 1.82, 0.12], m: 'olive', g: 'barrel' },
];

export const SIEGE_SCOUT = { name: 'Observer jeep', unit: 'ART-Trucks', ref: 'siege_scout', colors: SIEGE_COLORS,
  parts, pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 5, min: -5, max: 35, rate: 1.6 },
  muzzles: [{ p: [-0.36, 1.9, 0.12], d: [1, 0, 0], back: 0.55 }], views: { side: 'right', top: 'down' } };
