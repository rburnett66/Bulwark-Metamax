// src/render3d/units/siege/scout.js — ART-Trucks: Observer jeep (owner concept tools/unit-models/ref/siege/siege-jeep.png)
// [MM-story_mvhb6qd2_2]. An up-armoured open-topped 4x4 in dusty tan with olive patches (owner 2026-10-20: "jeep body
// should be bulkier, slightly bigger wheels"): big tyres under thick flared fenders, a tall boxy hood, rocker armour, a heavy
// grille and bumper, sandbags piled on the hood, a roll frame, yellow door stencils, camo netting over the rear bed, a
// tall periscope rangefinder mast and two whip antennas. A small grenade-launcher mount on the rear bed is the `turret`
// (yaw) and its gun the `barrel` (pitch).
import { SIEGE_COLORS } from './palette.js';

const TPIV = [-1.1, 1.92, 0.12];
const TRUN = [-0.95, 2.14, 0.12];

// wheels ~18% bigger than the first cut (r 0.44 → 0.52); the body rides higher to clear them
const wheel = (x, z) => [
  { t: 'cyl', ax: 'z', r: 0.52, l: 0.38, seg: 12, p: [x, 0.52, z], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: 0.26, l: 0.42, seg: 8, p: [x, 0.52, z], m: 'olive', mir: true },
  { t: 'cyl', ax: 'z', r: 0.09, l: 0.46, seg: 6, p: [x, 0.52, z], m: 'dark', mir: true, d: 1 },
];
const netSec = (w, top, sag) => [[-w, sag], [-w * 0.85, top - 0.08], [-w * 0.3, top + 0.05], [w * 0.2, top - 0.03], [w * 0.75, top + 0.04], [w, sag]];

const parts = [
  ...wheel(1.3, 0.9), ...wheel(-1.25, 0.9),
  // chassis + lower body: taller and wider, a tall boxy hood
  { t: 'ext', ax: 'z', poly: [[-1.98, 0.62], [-1.98, 1.3], [0.5, 1.3], [0.72, 1.48], [1.98, 1.44], [2.12, 1.14], [2.06, 0.62]], d: [-0.84, 0.84], m: 'camo' },
  // thick flared fenders (olive) over the wheels
  ...[1.3, -1.25].map((x) => ({ t: 'ext', ax: 'z', poly: [[x - 0.74, 1.0], [x - 0.58, 1.3], [x + 0.58, 1.3], [x + 0.74, 1.0], [x + 0.64, 0.95], [x - 0.64, 0.95]], d: [0.78, 1.22], m: 'olive', mir: true })),
  // rocker armour along the sills
  { t: 'box', s: [1.4, 0.24, 0.1], p: [0.02, 0.74, 0.86], m: 'olive', mir: true },
  // grille, heavy bumper, headlights
  { t: 'box', s: [0.08, 0.46, 1.2], p: [2.12, 0.98, 0], m: 'dark' },
  ...[-0.36, -0.18, 0, 0.18, 0.36].map((z) => ({ t: 'box', s: [0.02, 0.36, 0.06], p: [2.17, 0.98, z], m: 'black', d: 1 })),
  { t: 'box', s: [0.26, 0.24, 1.84], p: [2.2, 0.68, 0], m: 'olive' },
  { t: 'box', s: [0.05, 0.14, 0.2], p: [2.14, 1.24, 0.58], m: 'metal', mir: true },
  // olive hood panel (breaks up the big flat top so it doesn't wash out under the top light)
  { t: 'box', s: [1.2, 0.025, 1.36], p: [1.34, 1.475, 0], r3: [0, 0, -1.8], m: 'olive' },
  // sandbags piled on the hood
  ...[[1.6, -0.36], [1.6, 0.04], [1.6, 0.44], [1.18, -0.22], [1.18, 0.22]].map(([x, z]) => ({ t: 'ell', s: [0.22, 0.12, 0.19], seg: 6, p: [x, 1.55, z], m: 'net' })),
  // windscreen frame + roll bar (open top)
  { t: 'box', s: [0.07, 0.52, 1.5], p: [0.62, 1.72, 0], r3: [0, 0, -12], m: 'olive' },
  { t: 'box', s: [0.04, 0.4, 1.28], p: [0.64, 1.72, 0], r3: [0, 0, -12], m: 'glass', d: 1 },
  { t: 'box', s: [0.07, 0.64, 0.07], p: [-0.45, 1.62, 0.78], m: 'olive', mir: true },
  { t: 'box', s: [1.1, 0.07, 0.07], p: [0.1, 1.94, 0.78], m: 'olive', mir: true },
  { t: 'box', s: [0.07, 0.07, 1.62], p: [-0.45, 1.94, 0], m: 'olive' },
  // seats in the open cab
  { t: 'box', s: [0.34, 0.32, 0.36], p: [0.0, 1.46, 0.38], m: 'dark', mir: true },
  // olive camo patches on the hood sides and rear quarters
  { t: 'box', s: [0.75, 0.24, 0.02], p: [1.38, 1.16, 0.85], m: 'olive', mir: true, d: 1 },
  { t: 'box', s: [0.65, 0.28, 0.02], p: [-1.45, 1.0, 0.85], m: 'olive', mir: true, d: 1 },
  // doors with yellow stencils, olive camo patch
  { t: 'box', s: [0.95, 0.42, 0.03], p: [0.05, 1.08, 0.85], m: 'olive', mir: true },
  ...[-0.05, 0.12].map((x) => ({ t: 'box', s: [0.06, 0.24, 0.02], p: [x, 1.1, 0.87], m: 'hazard', mir: true })),
  // rear bed under camo netting
  { t: 'loft', ax: 'x', m: 'net', secs: [[-0.42, netSec(0.86, 1.84, 1.24)], [-0.9, netSec(0.92, 1.92, 1.1)], [-1.55, netSec(0.92, 1.86, 1.08)], [-2.02, netSec(0.84, 1.54, 1.14)]] },
  ...[[-0.8, -0.5], [-1.3, 0.45], [-1.75, -0.22], [-1.1, -0.1]].map(([x, z]) => ({ t: 'ell', s: [0.28, 0.11, 0.22], seg: 6, p: [x, 1.9, z], m: 'olive', d: 1 })),
  { t: 'box', s: [0.07, 0.44, 0.7], p: [-1.99, 1.0, 0.0], m: 'olive' },
  // periscope rangefinder mast + two whip antennas
  { t: 'cyl', ax: 'y', r: 0.075, l: 1.1, seg: 8, p: [0.25, 1.86, -0.2], m: 'dark' },
  { t: 'box', s: [0.28, 0.22, 0.24], p: [0.27, 2.46, -0.2], m: 'dark' },
  { t: 'box', s: [0.02, 0.11, 0.11], p: [0.42, 2.46, -0.2], m: 'glass' },
  { t: 'cyl', ax: 'y', r: 0.015, l: 1.5, seg: 4, p: [-0.6, 2.06, -0.58], m: 'black' },
  { t: 'cyl', ax: 'y', r: 0.015, l: 1.2, seg: 4, p: [-0.75, 1.91, -0.7], m: 'black' },
  // spare tyre on the back
  { t: 'cyl', ax: 'x', r: 0.34, l: 0.2, seg: 10, p: [-2.1, 1.12, 0.4], m: 'black', d: 1 },

  // grenade-launcher mount (yaws) on the rear bed
  { t: 'cyl', ax: 'y', r: 0.15, l: 0.2, seg: 8, p: [-1.1, 2.02, 0.12], m: 'dark', g: 'turret' },
  { t: 'box', s: [0.32, 0.19, 0.26], p: [-1.05, 2.16, 0.12], m: 'olive', g: 'turret' },
  { t: 'box', s: [0.04, 0.2, 0.2], p: [-1.2, 2.26, 0.12], m: 'dark', g: 'turret', d: 1 },
  // the launcher (pitches)
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.55, seg: 6, p: [-0.68, 2.14, 0.12], m: 'dark', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.075, l: 0.12, seg: 6, p: [-0.42, 2.14, 0.12], m: 'black', g: 'barrel' },
  { t: 'box', s: [0.18, 0.12, 0.12], p: [-0.9, 2.06, 0.12], m: 'olive', g: 'barrel' },
];

export const SIEGE_SCOUT = { name: 'Observer jeep', unit: 'ART-Trucks', ref: 'siege_scout', colors: SIEGE_COLORS,
  parts, pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 5, min: -5, max: 35, rate: 1.6 },
  muzzles: [{ p: [-0.36, 2.14, 0.12], d: [1, 0, 0], back: 0.55 }], views: { side: 'right', top: 'down' } };
