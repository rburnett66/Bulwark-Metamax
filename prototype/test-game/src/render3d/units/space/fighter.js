// src/render3d/units/space/fighter.js — SPC-Planes: Federation shuttle-fighter (owner concept tools/unit-models/ref/space/space-fighter.png)
// [MM-story_mvho2d6s_5]. A white lifting-body shuttle: a thick, broad nose that breaks out into long strakes and blends
// into double-delta wings (owner 2026-10-20: "a wing that blends into the body and a thick nose that break out to the
// wing"), a black leading edge along every wing ("the shuttle fighter wing should have a black leading edge"), a tall
// federation-blue fin, magenta wing stripes and a blue roundel, and a four-tube missile pod under each wing ("4 missile
// pods on each wing"), noses forward.
import { SPACE_COLORS, dish } from './palette.js';

const fus = (rz, ry, cy) => [[0, cy - ry], [rz * 0.9, cy - ry * 0.55], [rz, cy - ry * 0.05], [rz * 0.75, cy + ry * 0.7], [0, cy + ry], [-rz * 0.75, cy + ry * 0.7], [-rz, cy - ry * 0.05], [-rz * 0.9, cy - ry * 0.55]];

// ── the blended wing: spanwise sections (z) of a thick-rooted airfoil; the strake runs up the nose ──
// xl / xt = leading / trailing edge, t = thickness, yc = chord line height
const WING = [
  { z: 0.22, xl: 2.05, xt: -1.8, t: 0.34, yc: 0.58 },   // root, buried in the body
  { z: 0.5, xl: 1.55, xt: -1.8, t: 0.26, yc: 0.57 },    // strake: the nose breaking out
  { z: 0.85, xl: 0.6, xt: -1.78, t: 0.18, yc: 0.56 },   // strake meets the wing
  { z: 2.05, xl: -0.95, xt: -1.55, t: 0.05, yc: 0.55 }, // tip
];
const LE = 0.16;   // black leading-edge band, measured along the chord
const up = (s, u) => s.yc + s.t * (u <= 0.2 ? 0.5 * u / 0.2 : u <= 0.7 ? 0.5 - 0.05 * (u - 0.2) / 0.5 : 0.45 - 0.43 * (u - 0.7) / 0.3);
const lo = (s, u) => s.yc - s.t * (u <= 0.2 ? 0.35 * u / 0.2 : u <= 0.7 ? 0.35 - 0.05 * (u - 0.2) / 0.5 : 0.3 - 0.3 * (u - 0.7) / 0.3);
const xAt = (s, u) => s.xl - (s.xl - s.xt) * u;
const uLE = (s) => Math.min(0.3, LE / (s.xl - s.xt));
const P = (s, u, f) => [xAt(s, u), f(s, u)];
const wingWhite = WING.map((s) => { const e = uLE(s); return [s.z, [P(s, e, up), P(s, 0.2, up), P(s, 0.7, up), [s.xt, s.yc + s.t * 0.02], P(s, 0.7, lo), P(s, 0.2, lo), P(s, e, lo)]]; });
const wingEdge = WING.map((s) => { const e = uLE(s); return [s.z, [[s.xl, s.yc], P(s, e, up), P(s, e, lo)].map(([x, y], i) => (i ? [x, y + (y > s.yc ? 0.004 : -0.004)] : [x + 0.005, y]))]; });
// a point on the wing's top surface at (x, z) — for parts laid on it
function topAt(x, z) {
  let i = 0; while (i < WING.length - 2 && z > WING[i + 1].z) i++;
  const a = WING[i], b = WING[i + 1], k = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  const s = { xl: a.xl + (b.xl - a.xl) * k, xt: a.xt + (b.xt - a.xt) * k, t: a.t + (b.t - a.t) * k, yc: a.yc + (b.yc - a.yc) * k };
  return up(s, Math.max(0, Math.min(1, (s.xl - x) / (s.xl - s.xt))));
}
// magenta stripe across each wing, from the body aft-outboard to the trailing edge (a thin strip laid on the skin)
const STRIPE = [[0.15, 0.62], [-0.55, 1.15], [-1.2, 1.62]];
const stripe = { t: 'loft', ax: 'z', m: 'glowM', mir: true, secs: STRIPE.map(([x, z]) => [z, [[x + 0.07, topAt(x + 0.07, z) + 0.006], [x + 0.07, topAt(x + 0.07, z) + 0.012], [x - 0.07, topAt(x - 0.07, z) + 0.012], [x - 0.07, topAt(x - 0.07, z) + 0.006]]]) };

// ── four-tube missile pod on each wing, riding the skin near the trailing edge and jutting aft past it, noses forward ──
const POD = { x0: -2.0, x1: -0.95, y: 0.0, z: 1.3 };
POD.y = topAt(-1.2, POD.z) + 0.17;
const TUBES = [[0.085, 0.09], [0.085, -0.09], [-0.085, 0.09], [-0.085, -0.09]];
const pod = [
  { t: 'box', s: [0.7, 0.1, 0.3], p: [-1.3, POD.y - 0.15, POD.z], m: 'gun', mir: true },   // saddle on the wing
  { t: 'box', s: [POD.x1 - POD.x0 - 0.1, 0.36, 0.4], p: [(POD.x0 + POD.x1) / 2 - 0.05, POD.y, POD.z], m: 'lunar2', mir: true },
  { t: 'box', s: [0.5, 0.37, 0.41], p: [POD.x0 + 0.3, POD.y, POD.z], m: 'fed', mir: true },
  ...TUBES.flatMap(([dy, dz]) => [
    { t: 'cyl', ax: 'x', r: 0.075, l: POD.x1 - POD.x0, seg: 8, p: [(POD.x0 + POD.x1) / 2, POD.y + dy, POD.z + dz], m: 'gun', mir: true },
    { t: 'cyl', ax: 'x', r: [0, 0.06], l: 0.16, seg: 8, p: [POD.x1 + 0.08, POD.y + dy, POD.z + dz], m: 'lunar', mir: true },            // missile nose
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 8, p: [POD.x0 - 0.005, POD.y + dy, POD.z + dz], m: 'black', mir: true },              // tube mouth aft
  ]),
];

export const SPACE_FIGHTER = { name: 'Shuttle fighter', unit: 'SPC-Planes', ref: 'space_fighter', colors: SPACE_COLORS,
  parts: [
    // thick lifting-body fuselage: broad, rounded nose → cockpit hump → spine
    { t: 'loft', ax: 'x', m: 'lunar', secs: [
      [2.5, fus(0.04, 0.03, 0.58)], [2.25, fus(0.24, 0.15, 0.6)], [1.8, fus(0.38, 0.24, 0.62)], [1.1, fus(0.42, 0.32, 0.66)],
      [0.2, fus(0.4, 0.34, 0.68)], [-1.0, fus(0.38, 0.3, 0.68)], [-1.8, fus(0.32, 0.26, 0.68)]] },
    // black nose cap and black anti-glare panel ahead of the cockpit
    { t: 'loft', ax: 'x', m: 'black', secs: [[2.53, fus(0.035, 0.025, 0.58)], [2.3, fus(0.215, 0.135, 0.6)]] },
    { t: 'loft', ax: 'x', m: 'black', secs: [[2.28, [[0.12, 0.72], [0.0, 0.755], [-0.12, 0.72]]], [1.72, [[0.2, 0.83], [0.0, 0.865], [-0.2, 0.83]]]] },
    { t: 'loft', ax: 'x', m: 'glass', secs: [[1.75, fus(0.1, 0.03, 0.84)], [1.45, fus(0.22, 0.09, 0.88)], [1.05, fus(0.22, 0.09, 0.92)], [0.8, fus(0.08, 0.03, 0.93)]] },
    // the blended double-delta wings: white skin + black leading edge
    { t: 'loft', ax: 'z', m: 'lunar', mir: true, secs: wingWhite },
    { t: 'loft', ax: 'z', m: 'black', mir: true, secs: wingEdge },
    stripe,
    { t: 'cyl', ax: 'y', r: 0.2, l: 0.012, seg: 12, p: [-0.75, topAt(-0.75, 1.0) + 0.006, 1.0], m: 'fed', mir: true },
    { t: 'cyl', ax: 'y', r: 0.1, l: 0.014, seg: 10, p: [-0.75, topAt(-0.75, 1.0) + 0.008, 1.0], m: 'lunar', mir: true },
    // tall blue fin with a white root
    { t: 'ext', ax: 'z', poly: [[-0.6, 0.9], [-1.35, 2.25], [-1.7, 2.25], [-1.75, 0.9]], d: [-0.035, 0.035], m: 'fed' },
    { t: 'ext', ax: 'z', poly: [[-0.6, 0.9], [-0.75, 1.15], [-1.75, 1.15], [-1.75, 0.9]], d: [-0.04, 0.04], m: 'lunar' },
    ...pod,
    // main engine and two small side nozzles
    { t: 'cyl', ax: 'x', r: [0.24, 0.28], l: 0.2, seg: 10, p: [-1.9, 0.68, 0], m: 'gun' },
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.02, seg: 10, p: [-2.01, 0.68, 0], m: 'glowB' },
    { t: 'cyl', ax: 'x', r: [0.1, 0.12], l: 0.16, seg: 8, p: [-1.88, 0.5, 0.3], m: 'gun', mir: true },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.02, seg: 8, p: [-1.97, 0.5, 0.3], m: 'glowB', mir: true },
    ...dish(0.2, 0.98, 0.15, 0.16, { tilt: 30, yaw: 160, mast: 0.12 }),
  ],
  pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
