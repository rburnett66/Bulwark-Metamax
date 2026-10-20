// src/render3d/units/siege/gunship.js — ART-Copters: heavy-lift gunship (owner concept tools/unit-models/ref/siege/siege-gunship.png)
// [MM-story_mvhb6qd2_2]. A boxy heavy-lift helicopter in dusty tan camo with olive blotches, camouflage netting over the
// cabin roof, a glazed cockpit, open side doors with a heavy door gun, two fuel/shell pods slung under each side, a
// hazard-striped tail boom and fin. The five-blade main rotor (group `spin`) and the tail rotor (`spin2`) turn.
import { SIEGE_COLORS } from './palette.js';

const HUB = [0.05, 1.62, 0], TR = [-2.15, 1.55, -0.16];
const D2R = Math.PI / 180;

// fuselage cross-section (z, y): a boxy hull with chamfered shoulders
const box = (yb, yt, w, c = 0.12) => [[-w + c, yb], [w - c, yb], [w, yb + c], [w, yt - c * 1.4], [w - c * 1.4, yt], [-w + c * 1.4, yt], [-w, yt - c * 1.4], [-w, yb + c]];
// a rotor blade along yaw a (degrees) from the hub, flat in XZ
const blade = (c, len, a, w, t, m, g, r0 = 0.1) => {
  const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R), mid = r0 + len / 2;
  return { t: 'box', s: [len, t, w], p: [c[0] + ca * mid, c[1], c[2] - sa * mid], r3: [0, a, 0], m, g };
};

const NET = [[0.75, 1.36, 0.0, 0.3], [0.35, 1.58, 0.28, 0.3], [0.1, 1.6, -0.3, 0.32], [-0.4, 1.58, 0.3, 0.32], [-0.55, 1.58, -0.28, 0.28],
  [-0.95, 1.38, 0.0, 0.3], [0.45, 1.33, -0.45, 0.22], [-0.2, 1.36, 0.52, 0.2]];

const parts = [
  // ── fuselage: blunt nose → boxy cabin → tapering tail boom ──
  { t: 'loft', ax: 'x', m: 'camo', secs: [
    [1.85, box(0.42, 0.78, 0.18, 0.06)], [1.62, box(0.32, 0.98, 0.36, 0.1)], [1.2, box(0.26, 1.2, 0.5)], [0.6, box(0.24, 1.32, 0.56)],
    [-0.8, box(0.24, 1.32, 0.56)], [-1.25, box(0.42, 1.28, 0.42)], [-1.6, box(0.82, 1.22, 0.2, 0.06)], [-2.05, box(0.98, 1.2, 0.12, 0.04)]] },
  // olive camo blotches + a darker belly
  { t: 'box', s: [3.0, 0.08, 1.06], p: [-0.1, 0.27, 0], m: 'olive' },
  { t: 'box', s: [0.55, 0.3, 0.02], p: [0.95, 0.85, 0.555], r3: [0, 0, 12], m: 'olive', mir: true },
  { t: 'box', s: [0.45, 0.24, 0.02], p: [-1.05, 0.95, 0.535], r3: [0, 0, -8], m: 'olive', mir: true },
  { t: 'box', s: [0.6, 0.02, 0.3], p: [-0.25, 1.325, -0.25], r3: [0, 20, 0], m: 'olive', d: 1 },
  // cockpit glazing: windscreen + side windows
  { t: 'ext', ax: 'x', poly: [[-0.32, 0.8], [0.32, 0.8], [0.3, 0.97], [-0.3, 0.97]], d: [1.63, 1.66], m: 'glass' },
  { t: 'box', s: [0.46, 0.03, 0.3], p: [1.43, 1.1, 0.19], r3: [0, 0, -28], m: 'glass', mir: true },          // sloped windscreens
  { t: 'box', s: [0.46, 0.035, 0.04], p: [1.43, 1.105, 0], r3: [0, 0, -28], m: 'olive' },
  { t: 'box', s: [0.5, 0.32, 0.02], p: [1.3, 0.94, 0.51], r3: [0, 6, 0], m: 'glass', mir: true },
  { t: 'box', s: [0.03, 0.32, 0.025], p: [1.3, 0.94, 0.52], m: 'olive', mir: true, d: 1 },
  { t: 'box', s: [0.32, 0.02, 0.4], p: [1.72, 0.84, 0], r3: [0, 0, -40], m: 'olive' },                     // dusty olive nose patch
  // nose sensor + chin
  { t: 'box', s: [0.16, 0.14, 0.2], p: [1.86, 0.5, 0], m: 'dark' },
  { t: 'cyl', ax: 'x', r: 0.04, l: 0.25, seg: 6, p: [1.98, 0.62, 0.12], m: 'black', d: 1 },
  // open side doors (dark recess) with door guns on pintles
  { t: 'box', s: [0.62, 0.62, 0.03], p: [0.25, 0.75, 0.56], m: 'black', mir: true },
  { t: 'box', s: [0.64, 0.04, 0.04], p: [0.25, 1.07, 0.575], m: 'hazard', mir: true },
  { t: 'box', s: [0.32, 0.18, 0.2], p: [0.32, 0.72, 0.66], m: 'dark', mir: true },
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.75, seg: 8, p: [0.78, 0.74, 0.7], m: 'dark', mir: true },
  { t: 'cyl', ax: 'x', r: 0.075, l: 0.18, seg: 8, p: [1.12, 0.74, 0.7], m: 'black', mir: true },
  { t: 'box', s: [0.18, 0.16, 0.08], p: [0.25, 0.62, 0.78], m: 'rust', mir: true, d: 1 },
  // cabin side windows + hazard panel
  { t: 'box', s: [0.18, 0.16, 0.02], p: [-0.35, 1.05, 0.565], m: 'glass', mir: true },
  { t: 'box', s: [0.4, 0.22, 0.02], p: [-0.85, 0.72, 0.565], m: 'hazard', mir: true },
  ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.06, 0.26, 0.02], p: [-1.0 + i * 0.13, 0.72, 0.575], r3: [0, 0, 30], m: 'black', mir: true, d: 1 })),
  // engine housings on the roof + exhausts
  { t: 'box', s: [0.9, 0.24, 0.36], p: [-0.1, 1.44, 0.3], m: 'camo', mir: true },
  { t: 'cyl', ax: 'x', r: 0.1, l: 0.14, seg: 8, p: [-0.62, 1.44, 0.3], m: 'dark', mir: true },
  { t: 'box', s: [0.3, 0.02, 0.26], p: [0.15, 1.565, 0.3], m: 'dark', mir: true, d: 1 },
  // camouflage netting over the cabin roof
  ...NET.map(([x, y, z, r], i) => ({ t: 'ell', s: [r * 1.25, r * 0.5, r * 0.95], seg: 7, p: [x, y, z], r3: [0, i * 37, 0], m: 'net' })),
  // rotor mast
  { t: 'cyl', ax: 'y', r: 0.12, l: 0.24, seg: 10, p: [HUB[0], 1.5, 0], m: 'dark' },
  // stub pylons + fuel / shell pods (two a side)
  { t: 'box', s: [0.16, 0.1, 0.3], p: [0.55, 0.3, 0.66], m: 'olive', mir: true },
  { t: 'box', s: [0.16, 0.1, 0.3], p: [-0.9, 0.3, 0.66], m: 'olive', mir: true },
  ...[0.55, -0.9].flatMap((x) => [
    { t: 'cyl', ax: 'x', r: 0.15, l: 0.85, seg: 10, p: [x, 0.18, 0.8], m: 'olive', mir: true },
    { t: 'cyl', ax: 'x', r: [0.0, 0.15], l: 0.14, seg: 10, p: [x + 0.49, 0.18, 0.8], m: 'olive', mir: true },
    { t: 'cyl', ax: 'x', r: [0.15, 0.06], l: 0.12, seg: 10, p: [x - 0.48, 0.18, 0.8], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.155, l: 0.05, seg: 10, p: [x + 0.15, 0.18, 0.8], m: 'hazard', mir: true, d: 1 },
  ]),
  // landing wheels
  { t: 'cyl', ax: 'z', r: 0.11, l: 0.08, seg: 8, p: [1.35, 0.11, 0.3], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: 0.13, l: 0.1, seg: 8, p: [-0.4, 0.13, 0.48], m: 'black', mir: true },
  { t: 'box', s: [0.05, 0.22, 0.05], p: [1.35, 0.25, 0.3], m: 'dark', mir: true, d: 1 },
  // tail: hazard-striped fin, small tailplanes
  { t: 'ext', ax: 'z', poly: [[-1.8, 1.1], [-2.18, 1.95], [-2.42, 1.95], [-2.3, 1.1]], d: [-0.05, 0.05], m: 'camo' },
  ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.08, 0.5, 0.11], p: [-2.0 - i * 0.13, 1.5, 0], r3: [0, 0, -24], m: i % 2 ? 'black' : 'hazard' })),
  { t: 'box', s: [0.32, 0.03, 0.75], p: [-1.95, 1.12, 0], m: 'camo' },
  { t: 'box', s: [0.08, 0.04, 0.12], p: [-1.85, 1.12, 0.32], m: 'hazard', mir: true, d: 1 },
  { t: 'cyl', ax: 'z', r: 0.05, l: 0.1, seg: 6, p: [TR[0], TR[1], -0.1], m: 'dark' },

  // ── MAIN ROTOR (spins): hub + five long blades with hazard tips ──
  { t: 'cyl', ax: 'y', r: 0.17, l: 0.1, seg: 10, p: HUB, m: 'dark', g: 'spin' },
  ...[0, 72, 144, 216, 288].flatMap((a) => [blade(HUB, 1.65, a, 0.14, 0.03, 'dark', 'spin', 0.12), blade(HUB, 0.25, a, 0.145, 0.032, 'hazard', 'spin', 1.55)]),
  // ── TAIL ROTOR (spins about Z), on the left of the fin ──
  ...[0, 90].map((a) => ({ t: 'box', s: [0.5, 0.05, 0.02], p: TR, r3: [0, 0, a], m: 'dark', g: 'spin2' })),
  { t: 'cyl', ax: 'z', r: 0.05, l: 0.05, seg: 6, p: TR, m: 'hazard', g: 'spin2' },
];

export const SIEGE_GUNSHIP = { name: 'Heavy-lift gunship', unit: 'ART-Copters', ref: 'siege_gunship', colors: SIEGE_COLORS, parts,
  pivots: { spin: HUB, spin2: TR }, hover: 1,
  spin: { spin: { axis: 'y', speed: 20 }, spin2: { axis: 'z', speed: 40 } },
  views: { side: 'left', top: 'up' } };
