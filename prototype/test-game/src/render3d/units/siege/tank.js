// src/render3d/units/siege/tank.js — ART-Tanks: braced assault tank (owner concept tools/unit-models/ref/siege/siege-tank.png)
// [MM-story_mvhb6qd2_2]. A dusty camo tank under lumps of camouflage netting: chamfered hull over full tracks, sandbags on the
// glacis, a boxy turret with two rangefinder "ears" and a long thick gun with a muzzle brake. Two stabilizer legs at the
// rear corners plant before it fires and fold along the hull sides to drive (deployL / deployR, like air/artillery.js).
import { SIEGE_COLORS } from './palette.js';
import { track } from '../prims.js';

const D2R = Math.PI / 180;
const TPIV = [-0.3, 1.12, 0], BPIV = [0.62, 1.42, 0];

/** A box from a to b (centre line), `t` thick, `w` wide. */
function strut(a, b, t, w, m, extra = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) / D2R, pitch = Math.atan2(dy, Math.hypot(dx, dz)) / D2R;
  return { t: 'box', s: [L, t, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m, ...extra };
}

// ── STABILIZER LEGS: authored PLANTED (rear-corner hinge → foot pad on the ground); stowed they swing to lie along the
// hull side pointing forward. One rotation about the hinge: axis = deployed × stowed direction. ──
const LEG = { hinge: [-1.92, 0.9, 0.95], foot: [-2.55, 0.06, 1.3] };
function legSwing(side) {
  const a = [LEG.foot[0] - LEG.hinge[0], LEG.foot[1] - LEG.hinge[1], (LEG.foot[2] - LEG.hinge[2]) * side], la = Math.hypot(...a), A = a.map((x) => x / la);
  const B = [1, 0, 0];
  const ax = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]], ln = Math.hypot(...ax);
  return { axis: ax.map((x) => x / ln), angle: Math.acos(Math.max(-1, Math.min(1, A[0]))) / D2R };
}
function leg(side) {
  const g = side > 0 ? 'deployR' : 'deployL', z = (v) => v * side;
  const h = [LEG.hinge[0], LEG.hinge[1], z(LEG.hinge[2])], f = [LEG.foot[0], LEG.foot[1], z(LEG.foot[2])];
  const k = [h[0] + (f[0] - h[0]) * 0.45, h[1] + (f[1] - h[1]) * 0.45 + 0.1, h[2] + (f[2] - h[2]) * 0.45];
  return [
    { t: 'box', s: [0.26, 0.26, 0.22], p: [h[0] + 0.08, h[1], z(LEG.hinge[2] - 0.06)], m: 'camo' },           // hinge bracket (body)
    { t: 'cyl', ax: 'z', r: 0.1, l: 0.2, seg: 8, p: h, m: 'dark', g },
    strut(h, k, 0.16, 0.16, 'olive', { g }),
    strut(k, f, 0.13, 0.13, 'olive', { g }),
    { t: 'cyl', ax: 'z', r: 0.09, l: 0.2, seg: 8, p: k, m: 'dark', g },
    strut([h[0] + 0.1, h[1] - 0.18, h[2]], [k[0] + 0.06, k[1] - 0.1, k[2]], 0.06, 0.06, 'metal', { g }),     // ram
    { t: 'box', s: [0.05, 0.14, 0.15], p: [(k[0] + f[0]) / 2, (k[1] + f[1]) / 2, (k[2] + f[2]) / 2], m: 'hazard', g, d: 1 },
    { t: 'cyl', ax: 'y', r: [0.14, 0.22], l: 0.1, seg: 8, p: [f[0], 0.05, f[2]], m: 'camo', g },             // foot pad
  ];
}

// lumpy camouflage netting: a few squashed low-poly blobs
const net = (x, y, z, sx, sy, sz, extra = {}) => ({ t: 'ell', s: [sx, sy, sz], seg: 6, p: [x, y, z], m: 'net', ...extra });
const bag = (x, y, z, r = 0, extra = {}) => ({ t: 'ell', s: [0.17, 0.08, 0.11], seg: 6, p: [x, y, z], r3: [0, r, 0], m: 'camo2', d: 1, ...extra });

export const SIEGE_TANK = { name: 'Braced assault tank', unit: 'ART-Tanks', ref: 'siege_tank', colors: SIEGE_COLORS,
  parts: [
    ...track({ x0: -1.9, x1: 1.8, h: 0.6, z: 0.92, w: 0.44, wheels: 6, wr: 0.19 }),
    // hull: side profile extruded across, sloped glacis, olive lower
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.36], [-1.95, 1.06], [1.2, 1.06], [1.95, 0.76], [1.85, 0.42], [1.4, 0.36]], d: [-0.72, 0.72], m: 'olive' },
    { t: 'ext', ax: 'z', poly: [[-1.96, 0.36], [-1.96, 0.62], [1.86, 0.62], [1.85, 0.42], [1.4, 0.36]], d: [-0.73, 0.73], m: 'camo' },
    // skirts over the upper track run, chamfered
    { t: 'loft', ax: 'x', m: 'olive', mir: true, secs: [
      [-1.98, [[0.72, 0.62], [1.18, 0.62], [1.18, 0.94], [1.04, 1.06], [0.72, 1.06]]],
      [1.25, [[0.72, 0.62], [1.18, 0.62], [1.18, 0.94], [1.04, 1.06], [0.72, 1.06]]],
      [1.8, [[0.72, 0.62], [1.12, 0.62], [1.12, 0.76], [1.0, 0.84], [0.72, 0.84]]]] },
    // olive camo patches + yellow stencil on the skirt
    { t: 'box', s: [0.7, 0.22, 0.02], p: [-0.9, 0.84, 1.185], r3: [0, 0, 8], m: 'camo', mir: true },
    { t: 'box', s: [0.5, 0.18, 0.02], p: [0.55, 0.88, 1.185], r3: [0, 0, -10], m: 'camo', mir: true },
    { t: 'box', s: [0.06, 0.16, 0.02], p: [-0.2, 0.84, 1.19], m: 'hazard', mir: true, d: 1 },
    { t: 'box', s: [0.06, 0.16, 0.02], p: [-0.1, 0.84, 1.19], m: 'hazard', mir: true, d: 1 },
    // rear plate, exhaust, tool box
    { t: 'box', s: [0.08, 0.4, 1.2], p: [-1.97, 0.86, 0], m: 'camo' },
    { t: 'cyl', ax: 'x', r: 0.07, l: 0.12, seg: 8, p: [-2.03, 0.95, 0.35], m: 'rust' },
    { t: 'box', s: [0.5, 0.16, 0.5], p: [-1.55, 1.14, -0.3], m: 'camo' },
    // sandbags across the glacis
    ...[-0.45, -0.15, 0.15, 0.45].map((z) => bag(1.45, 0.98, z, 8)),
    ...[-0.3, 0, 0.3].map((z) => bag(1.38, 1.1, z, -6)),
    // netting heaped on the rear deck and draped over the skirts
    net(-1.3, 1.14, 0.35, 0.45, 0.12, 0.35), net(-0.8, 1.12, -0.55, 0.4, 0.1, 0.3), net(0.7, 1.08, 0.6, 0.35, 0.1, 0.32),
    net(-0.3, 1.04, 1.05, 0.55, 0.1, 0.18, { mir: true }), net(-1.5, 1.04, 1.05, 0.35, 0.1, 0.16, { mir: true, d: 1 }),
    // more netting: heaped over the hull top and hanging off the skirts
    net(0.2, 1.1, -0.1, 0.6, 0.12, 0.45), net(1.05, 1.06, -0.45, 0.35, 0.1, 0.3), net(-1.7, 1.1, -0.4, 0.3, 0.12, 0.35),
    net(0.9, 1.0, 1.1, 0.45, 0.14, 0.14, { mir: true }), net(-1.0, 0.95, 1.18, 0.4, 0.16, 0.06, { mir: true, d: 1 }),
    // headlight cages
    { t: 'box', s: [0.06, 0.08, 0.14], p: [1.9, 0.8, 0.5], m: 'amber', mir: true },

    // ── stabilizer legs (rear corners, deploy) ──
    ...leg(1), ...leg(-1),

    // ── turret (yaws): boxy, chamfered, netting on top, two rangefinder ears ──
    { t: 'cyl', ax: 'y', r: 0.72, l: 0.1, seg: 12, p: [-0.3, 1.11, 0], m: 'dark', g: 'turret' },
    { t: 'loft', ax: 'y', g: 'turret', m: 'olive', secs: [
      [1.14, [[0.55, -0.62], [0.75, -0.42], [0.75, 0.42], [0.55, 0.62], [-1.1, 0.68], [-1.3, 0.5], [-1.3, -0.5], [-1.1, -0.68]].map(([x, z]) => [x - 0.2, z])],
      [1.62, [[0.48, -0.58], [0.68, -0.38], [0.68, 0.38], [0.48, 0.58], [-1.06, 0.64], [-1.26, 0.46], [-1.26, -0.46], [-1.06, -0.64]].map(([x, z]) => [x - 0.2, z])],
      [1.74, [[0.3, -0.44], [0.45, -0.28], [0.45, 0.28], [0.3, 0.44], [-0.95, 0.5], [-1.12, 0.36], [-1.12, -0.36], [-0.95, -0.5]].map(([x, z]) => [x - 0.2, z])]] },
    { t: 'box', s: [0.55, 0.22, 0.02], p: [-0.7, 1.4, 0.665], r3: [0, -3, 0], m: 'camo', g: 'turret', mir: true },
    net(-0.75, 1.78, 0.1, 0.6, 0.13, 0.45, { g: 'turret' }), net(-0.15, 1.76, -0.25, 0.35, 0.1, 0.28, { g: 'turret' }), net(-1.1, 1.62, 0.6, 0.45, 0.14, 0.12, { g: 'turret', mir: true }),
    // rangefinder ears: masts + sensor heads with lenses
    { t: 'box', s: [0.08, 0.32, 0.08], p: [-1.0, 1.92, 0.5], m: 'dark', g: 'turret', mir: true },
    { t: 'box', s: [0.22, 0.2, 0.16], p: [-0.98, 2.12, 0.5], m: 'camo', g: 'turret', mir: true },
    { t: 'box', s: [0.02, 0.1, 0.1], p: [-0.86, 2.13, 0.5], m: 'glass', g: 'turret', mir: true },
    { t: 'box', s: [0.02, 0.36, 0.02], p: [-1.25, 2.0, -0.3], m: 'dark', g: 'turret', d: 1 },
    // mantlet (turret side)
    { t: 'box', s: [0.3, 0.4, 0.56], p: [0.5, 1.42, 0], m: 'camo', g: 'turret' },

    // ── barrel (pitches about BPIV, recoils): long thick gun with a muzzle brake ──
    { t: 'cyl', ax: 'x', r: [0.13, 0.16], l: 0.4, seg: 8, p: [0.82, 1.42, 0], m: 'olive', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.11, 0.13], l: 1.8, seg: 8, p: [1.9, 1.42, 0], m: 'olive', g: 'barrel' },
    { t: 'box', s: [0.7, 0.06, 0.02], p: [1.7, 1.42, 0.125], m: 'hazard', g: 'barrel', mir: true, d: 1 },
    { t: 'cyl', ax: 'x', r: 0.12, l: 0.08, seg: 8, p: [1.6, 1.42, 0], m: 'camo', g: 'barrel' },
    { t: 'box', s: [0.28, 0.17, 0.22], p: [2.9, 1.42, 0], m: 'dark', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.03, seg: 8, p: [3.05, 1.42, 0], m: 'black', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: BPIV, deployR: [LEG.hinge[0], LEG.hinge[1], LEG.hinge[2]], deployL: [LEG.hinge[0], LEG.hinge[1], -LEG.hinge[2]] },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.1 },
  recoil: 0.35,   // single heavy rounds with a body kick (unitBarrels.heavy)
  muzzles: [{ p: [3.06, 1.42, 0], d: [1, 0, 0], back: 1.2, g: 'barrel' }],
  // the rear legs plant before it fires and fold along the sides to drive (units3d poses them; unitBarrels drives deploy)
  deploy: { groups: { deployR: legSwing(1), deployL: legSwing(-1) }, rate: 1.8 },
  views: { side: 'right', top: 'down' } };
