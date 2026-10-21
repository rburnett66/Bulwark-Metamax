// src/render3d/units/siege/artillery.js — ART-Artillery: siege mortar (owner concept tools/unit-models/ref/siege/siege-artillery.png)
// [MM-story_mvhb6qd2_2]. A super-heavy siege mortar: a long tracked chassis in dark olive camo with dusty tan plates, a huge
// fat mortar tube on a turret ring near the front, a small loading crane and a rack of giant shells at the back, camouflage
// netting over the rear deck, hazard-yellow stencils, and FOUR stabilizer jacks at the corners that plant before it fires.
//
// The barrel is AUTHORED LEVEL along +X from its trunnion (unitBarrels.js convention); the game raises it to `barrel.rest`
// (near vertical) and never lets it aim flatter than `barrel.min`, so it always reads as a mortar.
import { SIEGE_COLORS } from './palette.js';
import { track } from '../prims.js';

const LOOK_PITCH = 0;   // preview only (look.py shows the authored pose): tilt the barrel group this many degrees. Ships 0.
const TRUN = [0.45, 1.62, 0];          // barrel trunnion
const TPIV = [0.45, 1.18, 0];          // turret ring
const D2R = Math.PI / 180;

/** A box from a to b (centre line), `t` thick, `w` wide — struts, legs, rams. */
function strut(a, b, t, w, m, extra = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) / D2R, pitch = Math.atan2(dy, Math.hypot(dx, dz)) / D2R;
  return { t: 'box', s: [L, t, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m, ...extra };
}
/** Barrel part: tilted about the trunnion by LOOK_PITCH for previews (0 in the game). */
function bar(pt) {
  if (!LOOK_PITCH) return { ...pt, g: 'barrel' };
  const c = Math.cos(LOOK_PITCH * D2R), s = Math.sin(LOOK_PITCH * D2R), px = pt.p[0] - TRUN[0], py = pt.p[1] - TRUN[1];
  const r = pt.r3 || [0, 0, 0];
  return { ...pt, g: 'barrel', p: [TRUN[0] + px * c - py * s, TRUN[1] + px * s + py * c, pt.p[2]], r3: [r[0], r[1], r[2] + LOOK_PITCH] };
}

// ── STABILIZER JACKS (owner 2026-10-20: legs "deploy to stabilize the unit before firing") ──────────────────────────────
// Four corner jacks, each authored PLANTED: from a hinge on the hull side, out and down to a foot plate in the dust. Stowed,
// each swings up to lie flat along the hull side (front jacks point aft, rear jacks point forward). One rotation about the
// hinge per jack (axis = planted × stowed direction), driven by units3d from view.deploy (0 stowed … 1 planted).
const JACKS = {
  deployFR: { hinge: [1.25, 0.86, 1.1], foot: [1.62, 0.06, 1.62], stow: [-1, 0, 0] },
  deployRR: { hinge: [-1.5, 0.86, 1.1], foot: [-1.88, 0.06, 1.62], stow: [1, 0, 0] },
};
const mirJ = (J) => ({ hinge: [J.hinge[0], J.hinge[1], -J.hinge[2]], foot: [J.foot[0], J.foot[1], -J.foot[2]], stow: J.stow });
JACKS.deployFL = mirJ(JACKS.deployFR);
JACKS.deployRL = mirJ(JACKS.deployRR);

function swing(J) {
  const a = [J.foot[0] - J.hinge[0], J.foot[1] - J.hinge[1], J.foot[2] - J.hinge[2]], la = Math.hypot(...a), A = a.map((x) => x / la);
  const B = J.stow;
  const ax = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]], ln = Math.hypot(...ax);
  return { axis: ax.map((x) => x / ln), angle: Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))) / D2R };
}
function jack(g) {
  const J = JACKS[g], h = J.hinge, f = J.foot, sz = Math.sign(h[2]);
  const k = [h[0] + (f[0] - h[0]) * 0.5, h[1] + (f[1] - h[1]) * 0.5 + 0.12, h[2] + (f[2] - h[2]) * 0.5];   // knee
  return [
    { t: 'box', s: [0.36, 0.3, 0.1], p: [h[0], h[1], h[2] - sz * 0.05], m: 'olive' },                       // hinge mount (body)
    { t: 'cyl', ax: 'z', r: 0.1, l: 0.16, seg: 8, p: h, m: 'dark', g },
    strut(h, k, 0.18, 0.18, 'olive', { g }),
    strut(k, f, 0.15, 0.15, 'olive', { g }),
    { t: 'cyl', ax: 'z', r: 0.09, l: 0.2, seg: 8, p: k, m: 'dark', g },
    strut([h[0], h[1] - 0.16, h[2]], [k[0] + (f[0] - k[0]) * 0.3, k[1] + (f[1] - k[1]) * 0.3, k[2] + (f[2] - k[2]) * 0.3], 0.06, 0.06, 'metal', { g }),
    { t: 'box', s: [0.04, 0.14, 0.16], p: [k[0] + (f[0] - k[0]) * 0.55, k[1] + (f[1] - k[1]) * 0.55, k[2] + (f[2] - k[2]) * 0.55], m: 'hazard', g, d: 1 },
    { t: 'box', s: [0.36, 0.06, 0.36], p: [f[0], 0.04, f[2]], m: 'olive', g },                              // foot plate
  ];
}

// netting lumps over the rear deck
const NET = [[-0.35, 1.26, 0.5, 0.3], [-0.85, 1.25, -0.45, 0.28], [-0.2, 1.24, -0.5, 0.24], [-1.1, 1.25, 0.4, 0.26], [-0.6, 1.24, 0.0, 0.22],
  [0.95, 1.14, 0.78, 0.22], [-0.6, 1.2, 0.95, 0.24], [-0.9, 1.2, -0.95, 0.22]];

const parts = [
  // ── running gear: long tracks, big road wheels ──
  ...track({ x0: -1.95, x1: 1.75, h: 0.66, z: 0.86, w: 0.46, wheels: 6, wr: 0.2 }),
  // ── lower hull (olive): long, with a sloped glacis ──
  { t: 'ext', ax: 'z', poly: [[-2.0, 0.32], [-2.0, 0.98], [1.25, 0.98], [1.85, 0.62], [1.7, 0.32]], d: [-0.64, 0.64], m: 'olive' },
  // ── upper armour: dusty tan fender plates over the tracks, chamfered, olive camo blotches ──
  { t: 'loft', ax: 'x', m: 'olive', mir: true, secs: [
    [-2.02, [[0.6, 0.78], [1.12, 0.78], [1.12, 1.04], [1.0, 1.14], [0.6, 1.16]]],
    [1.2, [[0.6, 0.78], [1.12, 0.78], [1.12, 1.04], [1.0, 1.14], [0.6, 1.16]]],
    [1.75, [[0.6, 0.72], [1.06, 0.72], [1.06, 0.88], [0.96, 0.95], [0.6, 0.96]]]] },
  { t: 'ext', ax: 'z', poly: [[-2.0, 0.96], [-2.0, 1.2], [1.0, 1.2], [1.55, 0.98], [1.2, 0.96]], d: [-0.62, 0.62], m: 'olive' },
  // dusty tan camo blotches on the fenders and deck
  { t: 'box', s: [0.6, 0.02, 0.3], p: [0.65, 1.155, 0.82], r3: [0, 18, 0], m: 'net', mir: true },
  { t: 'box', s: [0.45, 0.02, 0.26], p: [-1.35, 1.155, 0.84], r3: [0, -12, 0], m: 'net', mir: true },
  { t: 'box', s: [0.5, 0.02, 0.4], p: [1.1, 1.205, -0.2], r3: [0, 25, 0], m: 'net' },
  { t: 'box', s: [0.02, 0.16, 0.5], p: [1.075, 0.96, 0.84], m: 'camo', mir: true, d: 1 },
  // front glacis plate, hazard stencils, headlights
  { t: 'box', s: [0.06, 0.34, 1.3], p: [1.72, 0.84, 0], r3: [0, 0, 32], m: 'camo' },
  { t: 'box', s: [0.04, 0.12, 0.22], p: [1.66, 0.96, 0.4], r3: [0, 0, 32], m: 'hazard', mir: true },
  { t: 'box', s: [0.04, 0.03, 0.22], p: [1.67, 0.97, 0.4], r3: [0, 0, 32], m: 'black', mir: true, d: 1 },
  { t: 'box', s: [0.05, 0.08, 0.16], p: [1.82, 0.66, 0.5], m: 'amber', mir: true },
  // side skirts: panel lines, hazard number plate
  { t: 'box', s: [3.4, 0.12, 0.03], p: [-0.2, 0.86, 1.13], m: 'olive', mir: true },
  { t: 'box', s: [0.02, 0.26, 0.02], p: [-0.6, 0.96, 1.13], m: 'dark', mir: true, d: 1 },
  { t: 'box', s: [0.02, 0.26, 0.02], p: [0.3, 0.96, 1.13], m: 'dark', mir: true, d: 1 },
  { t: 'box', s: [0.22, 0.12, 0.02], p: [-0.15, 1.0, 1.13], m: 'hazard', mir: true },
  // rear plate + engine grille
  { t: 'box', s: [0.06, 0.6, 1.2], p: [-2.02, 0.86, 0], m: 'olive' },
  { t: 'box', s: [0.5, 0.03, 0.7], p: [-1.65, 1.215, 0], m: 'dark', d: 1 },

  // ── rear deck: loading crane and a rack of giant shells ──
  { t: 'box', s: [0.7, 0.16, 0.9], p: [-1.4, 1.28, -0.08], m: 'olive' },                                      // rack base
  ...[0, 1, 2, 3].flatMap((i) => {
    const z = -0.42 + i * 0.22;
    return [
      { t: 'cyl', ax: 'y', r: 0.095, l: 0.62, seg: 6, p: [-1.45, 1.66, z], r3: [0, 0, 12], m: 'rust' },        // shell body
      { t: 'cyl', ax: 'y', r: [0.0, 0.095], l: 0.22, seg: 6, p: [-1.38, 2.07, z], r3: [0, 0, 12], m: 'metal' }, // ogive nose
    ];
  }),
  { t: 'box', s: [0.08, 0.5, 1.0], p: [-1.68, 1.55, -0.08], m: 'dark' },                                      // rack backboard
  // crane: post, boom, hook
  { t: 'cyl', ax: 'y', r: 0.07, l: 0.85, seg: 8, p: [-1.05, 1.68, 0.62], m: 'dark' },
  strut([-1.05, 2.08, 0.62], [-0.55, 2.12, 0.62], 0.08, 0.08, 'dark'),
  strut([-1.05, 1.82, 0.62], [-0.7, 2.08, 0.62], 0.04, 0.04, 'metal'),
  { t: 'box', s: [0.02, 0.32, 0.02], p: [-0.57, 1.95, 0.62], m: 'black' },
  { t: 'box', s: [0.08, 0.1, 0.06], p: [-0.57, 1.76, 0.62], m: 'metal' },
  // camouflage netting draped over the rear deck and fenders
  ...NET.map(([x, y, z, r]) => ({ t: 'ell', s: [r * 1.4, r * 0.32, r], seg: 5, p: [x, y, z], m: 'net' })),

  // ── stabilizer jacks (groups deploy*) ──
  ...jack('deployFR'), ...jack('deployFL'), ...jack('deployRR'), ...jack('deployRL'),

  // ── turret (yaws): wide ring, cradle with side brackets and recoil cylinders ──
  { t: 'cyl', ax: 'y', r: [0.66, 0.74], l: 0.14, seg: 12, p: [TPIV[0], 1.25, 0], m: 'dark', g: 'turret' },
  { t: 'ext', ax: 'z', poly: [[-0.5, 0], [0.55, 0], [0.4, 0.34], [-0.42, 0.34]], d: [-0.5, 0.5], p: [TPIV[0], 1.3, 0], m: 'olive', g: 'turret' },
  { t: 'box', s: [0.7, 0.62, 0.14], p: [TPIV[0], 1.62, 0.5], m: 'camo', g: 'turret', mir: true },            // cheek brackets
  { t: 'box', s: [0.5, 0.14, 0.16], p: [TPIV[0] - 0.05, 1.93, 0.5], m: 'olive', g: 'turret', mir: true },
  { t: 'cyl', ax: 'z', r: 0.2, l: 0.08, seg: 10, p: [TRUN[0], TRUN[1], 0.6], m: 'dark', g: 'turret', mir: true },
  { t: 'cyl', ax: 'x', r: 0.07, l: 0.6, seg: 8, p: [TPIV[0] - 0.05, 1.4, 0.36], m: 'metal', g: 'turret', mir: true },   // recoil cylinders
  { t: 'box', s: [0.18, 0.04, 0.12], p: [TPIV[0] - 0.3, 1.66, 0.58], m: 'hazard', g: 'turret', mir: true, d: 1 },
  { t: 'box', s: [0.2, 0.16, 0.2], p: [TPIV[0] - 0.4, 1.72, -0.28], m: 'dark', g: 'turret' },               // sight box
  { t: 'box', s: [0.02, 0.36, 0.02], p: [TPIV[0] - 0.45, 1.98, -0.3], m: 'black', g: 'turret', d: 1 },

  // ── barrel (pitches about TRUN): breech drum, huge fat tube with reinforcing rings, flared muzzle ──
  bar({ t: 'cyl', ax: 'z', r: 0.3, l: 0.98, seg: 10, p: TRUN, m: 'dark' }),
  bar({ t: 'cyl', ax: 'x', r: [0.3, 0.36], l: 0.55, seg: 10, p: [TRUN[0] + 0.15, TRUN[1], 0], m: 'olive' }),
  bar({ t: 'cyl', ax: 'x', r: [0.24, 0.28], l: 2.0, seg: 10, p: [TRUN[0] + 1.4, TRUN[1], 0], m: 'dark' }),
  bar({ t: 'cyl', ax: 'x', r: 0.31, l: 0.1, seg: 10, p: [TRUN[0] + 0.62, TRUN[1], 0], m: 'olive' }),
  bar({ t: 'cyl', ax: 'x', r: 0.29, l: 0.08, seg: 10, p: [TRUN[0] + 1.25, TRUN[1], 0], m: 'olive' }),
  bar({ t: 'cyl', ax: 'x', r: 0.27, l: 0.07, seg: 10, p: [TRUN[0] + 1.9, TRUN[1], 0], m: 'olive' }),
  bar({ t: 'box', s: [0.5, 0.03, 0.03], p: [TRUN[0] + 1.0, TRUN[1] + 0.27, 0.12], m: 'hazard', d: 1 }),
  bar({ t: 'cyl', ax: 'x', r: [0.33, 0.27], l: 0.28, seg: 10, p: [TRUN[0] + 2.5, TRUN[1], 0], m: 'dark' }),
  bar({ t: 'cyl', ax: 'x', r: 0.2, l: 0.03, seg: 10, p: [TRUN[0] + 2.65, TRUN[1], 0], m: 'black' }),
];

export const SIEGE_ARTILLERY = { name: 'Siege mortar', unit: 'ART-Artillery', ref: 'siege_artillery', colors: SIEGE_COLORS, parts,
  pivots: { turret: TPIV, barrel: TRUN, ...Object.fromEntries(Object.entries(JACKS).map(([g, J]) => [g, J.hinge])) },
  // a near-vertical mortar: idles high, never aims flatter than 50°
  barrel: { rest: 70, min: 50, max: 82, rate: 0.7 },
  muzzles: [{ p: [TRUN[0] + 2.66, TRUN[1], 0], d: [1, 0, 0], back: 1.4 }],
  // the four jacks plant before it fires and stow to drive (units3d poses them, unitBarrels.js drives view.deploy)
  deploy: { groups: Object.fromEntries(Object.entries(JACKS).map(([g, J]) => [g, swing(J)])), rate: 1.4 },
  views: { side: 'left', top: 'down' } };
