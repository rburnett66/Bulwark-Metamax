// src/render3d/units/arcane/heavy.js — ARC-HeavyTanks: Cathedral juggernaut (owner concept
// tools/unit-models/ref/arcane/arcane-heavy-tank.png) [MM-story_mvhnbx8n_4]. A cathedral on tracks: a rounded iron nose with
// two glowing rose windows, a tall nave walled with red lancet windows and bronze buttresses, a tracery spire rising at the
// rear among pinnacles, a fire bowl on the front corner, and a ribbed dome turret carrying twin red-tipped energy cannons.
import { ARCANE_COLORS, archWindow, roseWindow, ring, ellRing, pinnacle, circlePoly } from './palette.js';
import { track } from '../prims.js';

// owner 2026-10-20: "the heavy tank cathedral front is buried in the chassis" + "the Heavy Tank front is supposed to
// resemble a face so blend the front into the body and properly place the big round windows with the fire below and
// middle". The cathedral runs right up to the nose as a sloped brow that blends down into the hull; two big rose windows
// are its eyes and a fire bowl burns below them on the centre line; the dome turret rides forward over it (TX).
const TX = 0.6;   // how far the dome turret moved forward
const TPIV = [0.35 + TX, 2.45, 0], BPIV = [0.75 + TX, 2.78, 0];
const NAVE = { x0: -1.75, x1: 1.35, y0: 1.2, y1: 2.45, z: 0.82 };
// the face, in side profile: hull nose → leaning face → rounded brow → nave roof
const FACE = [[2.03, 1.12], [1.76, 2.06], [1.58, 2.33], [1.35, 2.45]];
const LEAN = Math.atan2(FACE[0][0] - FACE[1][0], FACE[1][1] - FACE[0][1]);   // how far the face leans back (rad)
const faceX = (y) => FACE[0][0] - (y - FACE[0][1]) * Math.tan(LEAN);
/** A rose window laid on the leaning face: (y, z) centre, radius r. Offsets run along the face normal. */
function faceRose(y, z, r) {
  const n = [Math.cos(LEAN), Math.sin(LEAN)], c = [faceX(y), y], deg = LEAN * 180 / Math.PI;
  const at = (v) => [c[0] + n[0] * v, c[1] + n[1] * v, z];
  const out = [
    { t: 'ext', ax: 'x', poly: circlePoly(r, 14), d: [-0.012, 0.012], p: at(0.014), r3: [0, 0, deg], m: 'glowR' },
    { t: 'ext', ax: 'x', poly: circlePoly(r + 0.07, 14), holes: [circlePoly(r - 0.02, 14).reverse()], d: [-0.03, 0.03], p: at(0.03), r3: [0, 0, deg], m: 'bronze' },
    { t: 'ext', ax: 'x', poly: circlePoly(r * 0.32, 8), holes: [circlePoly(r * 0.22, 8).reverse()], d: [-0.015, 0.015], p: at(0.035), r3: [0, 0, deg], m: 'bronze' },
  ];
  for (let i = 0; i < 6; i++) out.push({ t: 'box', s: [0.02, r * 2, 0.025], p: at(0.04), r3: [i * 30, 0, deg], m: 'bronze', d: 1 });
  return out;
}

const parts = [
  ...track({ x0: -2.15, x1: 2.0, h: 0.75, z: 1.12, w: 0.6, wheels: 7, wr: 0.22, hub: 'bronze' }),
  // lower hull: rounded nose, flat sides
  { t: 'ext', ax: 'z', poly: [[-2.15, 0.42], [-2.15, 1.3], [1.95, 1.3], [2.03, 1.12], [2.0, 0.5], [1.7, 0.42]], d: [-0.84, 0.84], m: 'iron' },
  // heavy track guards with arched cut-outs and bronze edging
  { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
    [-2.2, [[0.82, 0.7], [1.48, 0.7], [1.48, 1.1], [1.28, 1.26], [0.82, 1.26]]],
    [1.45, [[0.82, 0.7], [1.48, 0.7], [1.48, 1.1], [1.28, 1.26], [0.82, 1.26]]],
    [2.05, [[0.82, 0.7], [1.42, 0.7], [1.42, 0.86], [1.24, 0.96], [0.82, 0.96]]]] },
  ...[-1.5, -0.7, 0.1, 0.9].map((x) => ({ t: 'box', s: [0.46, 0.3, 0.03], p: [x, 0.92, 1.48], m: 'dark', mir: true })),
  { t: 'box', s: [3.7, 0.05, 0.05], p: [-0.3, 1.26, 1.5], m: 'bronze', mir: true },
  // the face: a fire bowl on the centre line below the eyes, on a bronze bracket at the nose
  { t: 'box', s: [0.2, 0.08, 0.3], p: [2.08, 1.18, 0], m: 'bronze2' },
  { t: 'cyl', ax: 'y', r: [0.24, 0.13], l: 0.22, seg: 10, p: [2.14, 1.33, 0], m: 'bronze' },
  ring('y', [2.14, 1.44, 0], 0.25, 0.05, 0.04, 'bronze2', {}, 10),
  { t: 'cyl', ax: 'y', r: [0, 0.18], l: 0.38, seg: 7, p: [2.14, 1.63, 0], m: 'glowF' },
  { t: 'cyl', ax: 'y', r: [0, 0.1], l: 0.28, seg: 6, p: [2.15, 1.59, 0], r3: [0, 25, 0], m: 'glowR' },

  // ── the nave: walls of lancet windows between buttresses, a pitched roof with a cresting ──
  { t: 'box', s: [NAVE.x1 - NAVE.x0, NAVE.y1 - NAVE.y0, NAVE.z * 2], p: [(NAVE.x0 + NAVE.x1) / 2, (NAVE.y0 + NAVE.y1) / 2, 0], m: 'iron' },
  { t: 'ext', ax: 'x', poly: [[-NAVE.z - 0.05, 0], [NAVE.z + 0.05, 0], [0, 0.55]], d: [NAVE.x0, 0.25], p: [0, NAVE.y1, 0], m: 'iron2' },   // stops short of the turret
  { t: 'box', s: [0.25 - NAVE.x0, 0.06, 0.08], p: [(NAVE.x0 + 0.25) / 2, NAVE.y1 + 0.56, 0], m: 'bronze' },
  // the face: the leaning brow (side profile extruded across), bronze brow ridge, two rose-window eyes
  { t: 'ext', ax: 'z', poly: [[NAVE.x1 - 0.2, 1.12], ...FACE, [NAVE.x1 - 0.2, 2.45]], d: [-NAVE.z, NAVE.z], m: 'iron' },
  { t: 'ext', ax: 'z', poly: [[1.72, 2.08], [1.58, 2.3], [1.62, 2.33], [1.79, 2.1]], d: [-NAVE.z - 0.02, NAVE.z + 0.02], m: 'bronze' },
  ...faceRose(1.76, -0.4, 0.33), ...faceRose(1.76, 0.4, 0.33),
  { t: 'box', s: [0.05, 0.5, 0.1], p: [faceX(1.42) + 0.02, 1.42, 0], r3: [0, 0, LEAN * 180 / Math.PI], m: 'bronze2' },
  ...[-1.45, -0.95, -0.45, 0.05, 0.55, 1.05].flatMap((x) => archWindow('z', [x, NAVE.y0 + 0.18, NAVE.z], 0.15, 0.48, { k: 1.8, extra: { mir: true } })),
  ...[-1.72, -1.2, -0.7, -0.2, 0.3, 0.8, 1.3].flatMap((x, i) => [
    { t: 'box', s: [0.12, NAVE.y1 - NAVE.y0, 0.14], p: [x, (NAVE.y0 + NAVE.y1) / 2, NAVE.z + 0.05], m: 'bronze2', mir: true },
    ...(i % 2 ? [] : pinnacle(x, NAVE.y1, NAVE.z + 0.05, 0.4, 0.06, 'bronze', { mir: true })),
  ]),
  // a big rose window on each flank, forward
    { t: 'box', s: [NAVE.x1 - NAVE.x0 + 0.1, 0.08, NAVE.z * 2 + 0.12], p: [(NAVE.x0 + NAVE.x1) / 2, NAVE.y1, 0], m: 'bronze' },

  // ── the spire at the rear: square tower, octagonal drum, tracery needle among pinnacles ──
  { t: 'box', s: [0.8, 0.8, 0.8], p: [-1.35, NAVE.y1 + 0.4, 0], m: 'iron' },
  ...archWindow('z', [-1.35, NAVE.y1 + 0.18, 0.4], 0.12, 0.3, { k: 1.8, bars: false, extra: { mir: true } }),
  ...archWindow('x', [-0.95, NAVE.y1 + 0.18, 0], 0.12, 0.3, { k: 1.8, bars: false }),
  ...[[-1.72, 0.37], [-0.98, 0.37]].flatMap(([x, z]) => pinnacle(x, NAVE.y1 + 0.8, z, 0.55, 0.07, 'bronze', { mir: true })),
  { t: 'cyl', ax: 'y', r: [0.3, 0.36], l: 0.4, seg: 8, p: [-1.35, NAVE.y1 + 1.0, 0], m: 'iron2' },
  { t: 'cyl', ax: 'y', r: [0.03, 0.3], l: 1.7, seg: 8, p: [-1.35, NAVE.y1 + 2.05, 0], m: 'iron' },
  ...[0, 90].map((a) => ({ t: 'box', s: [0.62, 1.5, 0.03], p: [-1.35, NAVE.y1 + 1.95, 0], r3: [0, a, 0], m: 'bronze2', d: 1 })),
  { t: 'cyl', ax: 'y', r: [0, 0.04], l: 0.3, seg: 4, p: [-1.35, NAVE.y1 + 3.05, 0], m: 'bronze' },

  // ── turret (yaws): drum and ribbed dome with a lantern ──
  { t: 'cyl', ax: 'y', r: 0.62, l: 0.3, seg: 12, p: [0.35 + TX, 2.55, 0], m: 'iron2', g: 'turret' },
  ring('y', [0.35 + TX, 2.7, 0], 0.66, 0.08, 0.06, 'bronze', { g: 'turret' }, 14),
  { t: 'ell', s: [0.6, 0.48, 0.6], seg: 12, p: [0.35 + TX, 2.7, 0], m: 'iron', g: 'turret' },
  ...[0, 45, 90, 135].map((a) => ellRing('z', [0.35 + TX, 2.7, 0], 0.62, 0.5, 0.05, 0.05, 'bronze', { g: 'turret', r3: [0, a, 0] }, true, 12)),
  { t: 'cyl', ax: 'y', r: 0.14, l: 0.2, seg: 8, p: [0.35 + TX, 3.25, 0], m: 'bronze2', g: 'turret' },
  { t: 'cyl', ax: 'y', r: [0, 0.12], l: 0.25, seg: 8, p: [0.35 + TX, 3.47, 0], m: 'bronze', g: 'turret' },

  // ── barrels (pitch, recoil): twin energy cannons with bronze collars and red-glowing tips ──
  ...[-0.22, 0.22].flatMap((z) => [
    { t: 'cyl', ax: 'x', r: [0.14, 0.17], l: 0.45, seg: 10, p: [0.95 + TX, 2.78, z], m: 'bronze2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.09, 0.1], l: 1.3, seg: 10, p: [1.8 + TX, 2.78, z], m: 'iron', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.125, l: 0.07, seg: 10, p: [1.5 + TX, 2.78, z], m: 'bronze', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.13, 0.11], l: 0.22, seg: 10, p: [2.55 + TX, 2.78, z], m: 'glowR', g: 'barrel' },
  ]),
  { t: 'box', s: [0.2, 0.1, 0.5], p: [1.15 + TX, 2.78, 0], m: 'bronze2', g: 'barrel' },
];

export const ARCANE_HEAVY = { name: 'Cathedral juggernaut', unit: 'ARC-HeavyTanks', ref: 'arcane_heavy', colors: ARCANE_COLORS,
  parts, pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -6, max: 20, rate: 0.8 },
  recoil: 0.45,
  muzzles: [{ p: [2.67 + TX, 2.78, -0.22], d: [1, 0, 0], back: 1.0, g: 'barrel' }, { p: [2.67 + TX, 2.78, 0.22], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
