// src/render3d/units/siege/gunship.js — ART-Copters: heavy-lift gunship (owner concept tools/unit-models/ref/siege/siege-gunship.png)
// [MM-story_mvhb6qd2_2]. Second take (owner 2026-10-20: "take another take on the gunship"): a big, rugged transport/attack
// helicopter. The tall rounded cabin is the main mass, with a deep bulbous nose and a low multi-pane cockpit. Camouflage
// netting is draped over the roof and engine humps. A big open side door carries a heavy door gun. Two long fuel/shell
// pods hang low on each side. A thick tail boom steps up to a hazard-striped fin. The large five-blade main rotor
// (group `spin`) and the tail rotor (`spin2`) turn.
import { SIEGE_COLORS } from './palette.js';

const HUB = [0.1, 2.02, 0], TR = [-2.42, 1.78, -0.17];
const D2R = Math.PI / 180;

// rounded fuselage cross-section (z, y): an octagon with soft shoulders and a flatter belly
const oct = (yb, yt, w, belly = 0.75) => { const h = yt - yb; return [[-w * belly, yb], [w * belly, yb], [w, yb + 0.28 * h], [w, yb + 0.66 * h], [w * 0.7, yt], [-w * 0.7, yt], [-w, yb + 0.66 * h], [-w, yb + 0.28 * h]]; };
// a rotor blade along yaw a (degrees) from the hub, flat in XZ
const blade = (c, len, a, w, t, m, g, r0 = 0.1) => {
  const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R), mid = r0 + len / 2;
  return { t: 'box', s: [len, t, w], p: [c[0] + ca * mid, c[1], c[2] - sa * mid], r3: [0, a, 0], m, g };
};
// the netting blanket: a low arch over the roof, lumpy, wider than the hull so it sags over the shoulders
const net = (yc, w, l) => [[-w, yc - 0.46], [-w * 0.88, yc - 0.08 + l], [-w * 0.42, yc + 0.12], [0, yc + 0.17 + l], [w * 0.42, yc + 0.1 + l * 0.5], [w * 0.88, yc - 0.1], [w, yc - 0.46], [w * 0.78, yc - 0.42], [-w * 0.78, yc - 0.42]];

const parts = [
  // ── fuselage: bulbous nose → tall cabin → thick tapering boom ──
  { t: 'loft', ax: 'x', m: 'camo', secs: [
    [2.08, oct(0.46, 0.84, 0.24, 0.6)], [1.95, oct(0.36, 1.0, 0.42)], [1.65, oct(0.3, 1.24, 0.55)], [1.15, oct(0.26, 1.58, 0.6)],
    [0.5, oct(0.24, 1.66, 0.64)], [-0.6, oct(0.24, 1.66, 0.64)], [-1.05, oct(0.42, 1.6, 0.52)], [-1.5, oct(0.92, 1.52, 0.26)],
    [-2.25, oct(1.08, 1.46, 0.17)], [-2.45, oct(1.14, 1.44, 0.13)]] },
  // darker belly + olive camo blotches on the sides
  { t: 'box', s: [2.8, 0.06, 0.92], p: [0.1, 0.25, 0], m: 'olive' },
  { t: 'box', s: [0.6, 0.38, 0.03], p: [1.05, 1.18, 0.6], r3: [0, 0, 18], m: 'olive', mir: true },
  { t: 'box', s: [0.5, 0.3, 0.03], p: [-0.85, 1.25, 0.63], r3: [0, 0, -10], m: 'olive', mir: true },
  { t: 'box', s: [0.42, 0.26, 0.03], p: [-0.3, 0.45, 0.635], r3: [0, 0, 14], m: 'olive', mir: true },
  { t: 'box', s: [0.5, 0.2, 0.03], p: [-1.6, 1.25, 0.25], r3: [0, 8, 0], m: 'olive', mir: true },
  // ── cockpit: low multi-pane glazing on the bulbous nose ──
  { t: 'box', s: [0.42, 0.03, 0.34], p: [1.8, 1.17, 0.2], r3: [0, 0, -40], m: 'glass', mir: true },       // upper windscreens
  { t: 'box', s: [0.3, 0.03, 0.26], p: [2.02, 0.84, 0.17], r3: [0, 0, -68], m: 'glass', mir: true },      // chin windows
  { t: 'box', s: [0.34, 0.035, 0.035], p: [1.81, 1.175, 0], r3: [0, 0, -40], m: 'olive' },                // centre frame
  { t: 'box', s: [0.6, 0.42, 0.03], p: [1.45, 1.0, 0.61], r3: [0, 9, 0], m: 'glass', mir: true },         // side windows
  { t: 'box', s: [0.035, 0.38, 0.035], p: [1.45, 1.0, 0.625], m: 'olive', mir: true, d: 1 },
  { t: 'box', s: [0.14, 0.12, 0.18], p: [2.06, 0.6, 0], m: 'dark' },                                      // nose sensor
  // ── open side door (dark recess) + heavy door gun pointing out ──
  { t: 'box', s: [0.72, 0.82, 0.04], p: [0.2, 0.86, 0.63], m: 'black', mir: true },
  { t: 'box', s: [0.74, 0.05, 0.05], p: [0.2, 1.3, 0.64], m: 'hazard', mir: true, d: 1 },
  { t: 'box', s: [0.06, 0.4, 0.06], p: [0.35, 0.72, 0.72], m: 'dark', mir: true },                        // pintle post
  { t: 'box', s: [0.42, 0.24, 0.24], p: [0.45, 0.94, 0.8], m: 'dark', mir: true },                        // receiver
  { t: 'cyl', ax: 'x', r: 0.06, l: 0.7, seg: 8, p: [0.95, 0.96, 0.8], m: 'dark', mir: true },             // barrel
  { t: 'cyl', ax: 'x', r: 0.09, l: 0.16, seg: 8, p: [1.3, 0.96, 0.8], m: 'black', mir: true },            // muzzle
  { t: 'box', s: [0.2, 0.2, 0.1], p: [0.4, 0.78, 0.9], m: 'rust', mir: true, d: 1 },                      // ammo can
  // cabin side windows behind the door, hazard panel on the tail root
  { t: 'box', s: [0.2, 0.2, 0.03], p: [-0.45, 1.22, 0.645], m: 'glass', mir: true },
  { t: 'box', s: [0.42, 0.3, 0.03], p: [-1.15, 1.2, 0.5], r3: [0, -16, 0], m: 'hazard', mir: true },
  ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.06, 0.34, 0.03], p: [-1.27 + i * 0.12, 1.2, 0.515 + i * 0.035], r3: [0, -16, 28], m: 'black', mir: true, d: 1 })),
  // ── engine humps on the roof, under the netting ──
  { t: 'loft', ax: 'x', m: 'camo', mir: true, secs: [[0.7, [[0.1, 1.6], [0.5, 1.6], [0.48, 1.8], [0.12, 1.8]]], [-0.7, [[0.1, 1.6], [0.5, 1.6], [0.48, 1.82], [0.12, 1.82]]], [-1.0, [[0.16, 1.6], [0.42, 1.6], [0.4, 1.72], [0.18, 1.72]]]] },
  { t: 'cyl', ax: 'x', r: 0.1, l: 0.12, seg: 8, p: [-1.05, 1.68, 0.3], m: 'dark', mir: true },
  // ── camouflage netting draped over the roof and humps ──
  { t: 'loft', ax: 'x', m: 'olive', secs: [[1.15, net(1.5, 0.56, 0.02)], [0.75, net(1.72, 0.7, 0.07)], [0.1, net(1.76, 0.72, 0.02)], [-0.5, net(1.74, 0.7, 0.08)], [-1.1, net(1.56, 0.56, 0.02)]] },
  ...[[0.6, 1.86, 0.3, 0.22], [-0.15, 1.9, -0.32, 0.24], [-0.65, 1.84, 0.28, 0.2], [0.2, 1.9, 0.08, 0.2], [0.75, 1.82, -0.28, 0.18], [-0.45, 1.86, -0.05, 0.18]].map(([x, y, z, r], i) =>
    ({ t: 'ell', s: [r * 1.4, r * 0.42, r], seg: 7, p: [x, y, z], r3: [0, i * 41, 0], m: 'net', d: i > 3 ? 1 : 0 })),
  // rotor mast
  { t: 'cyl', ax: 'y', r: [0.1, 0.16], l: 0.3, seg: 10, p: [HUB[0], 1.86, 0], m: 'dark' },
  // ── stub pylons + two long fuel / shell pods a side, slung low ──
  ...[0.55, -0.75].flatMap((x) => [
    { t: 'box', s: [0.14, 0.14, 0.26], p: [x, 0.36, 0.72], m: 'olive', mir: true },
    { t: 'cyl', ax: 'x', r: 0.17, l: 0.95, seg: 10, p: [x, 0.2, 0.86], m: 'olive', mir: true },
    { t: 'cyl', ax: 'x', r: [0.0, 0.17], l: 0.16, seg: 10, p: [x + 0.555, 0.2, 0.86], m: 'olive', mir: true },
    { t: 'cyl', ax: 'x', r: [0.17, 0.06], l: 0.14, seg: 10, p: [x - 0.545, 0.2, 0.86], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.175, l: 0.05, seg: 10, p: [x + 0.2, 0.2, 0.86], m: 'hazard', mir: true, d: 1 },
  ]),
  // ── wheeled landing gear ──
  { t: 'cyl', ax: 'z', r: 0.11, l: 0.1, seg: 8, p: [1.55, 0.11, 0.18], m: 'black', mir: true },
  { t: 'box', s: [0.06, 0.24, 0.06], p: [1.55, 0.26, 0.18], m: 'dark', mir: true, d: 1 },
  { t: 'cyl', ax: 'z', r: 0.15, l: 0.12, seg: 8, p: [-0.15, 0.15, 0.5], m: 'black', mir: true },
  { t: 'box', s: [0.08, 0.2, 0.2], p: [-0.15, 0.3, 0.46], m: 'dark', mir: true, d: 1 },
  // ── tail: fin stepping up from the boom, hazard stripes, small tailplanes ──
  { t: 'ext', ax: 'z', poly: [[-2.0, 1.3], [-2.38, 2.15], [-2.62, 2.15], [-2.55, 1.2]], d: [-0.07, 0.07], m: 'camo' },
  ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.09, 0.62, 0.16], p: [-2.18 - i * 0.12, 1.66, 0], r3: [0, 0, -24], m: i % 2 ? 'black' : 'hazard' })),
  { t: 'box', s: [0.34, 0.04, 0.9], p: [-2.15, 1.32, 0], m: 'camo' },
  { t: 'box', s: [0.12, 0.05, 0.14], p: [-2.08, 1.32, 0.4], m: 'hazard', mir: true, d: 1 },
  { t: 'cyl', ax: 'z', r: 0.06, l: 0.12, seg: 6, p: [TR[0], TR[1], -0.1], m: 'dark' },

  // ── MAIN ROTOR (spins): big hub + five long dark blades ──
  { t: 'cyl', ax: 'y', r: 0.2, l: 0.12, seg: 10, p: HUB, m: 'dark', g: 'spin' },
  { t: 'cyl', ax: 'y', r: 0.08, l: 0.12, seg: 8, p: [HUB[0], HUB[1] + 0.1, 0], m: 'black', g: 'spin' },
  ...[0, 72, 144, 216, 288].map((a) => blade(HUB, 2.25, a, 0.17, 0.035, 'olive', 'spin', 0.15)),
  // ── TAIL ROTOR (spins about Z), on the left of the fin ──
  ...[0, 90].map((a) => ({ t: 'box', s: [0.62, 0.06, 0.02], p: TR, r3: [0, 0, a], m: 'dark', g: 'spin2' })),
  { t: 'cyl', ax: 'z', r: 0.06, l: 0.05, seg: 6, p: TR, m: 'hazard', g: 'spin2' },
];

export const SIEGE_GUNSHIP = { name: 'Heavy-lift gunship', unit: 'ART-Copters', ref: 'siege_gunship', colors: SIEGE_COLORS, parts,
  pivots: { spin: HUB, spin2: TR }, hover: 1,
  spin: { spin: { axis: 'y', speed: 20 }, spin2: { axis: 'z', speed: 40 } },
  views: { side: 'left', top: 'up' } };
