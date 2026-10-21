// src/render3d/units/siege/heavy.js — ART-HeavyTanks: fortress heavy tank (owner concept tools/unit-models/ref/siege/siege-heavy-tank.png)
// [MM-story_mvhb6qd2_2]. A rolling fortress: very wide tracks under thick sloped camo plates, sandbagged decks wrapped in
// camouflage netting, a compact turret carrying a big heavy gun, shell racks on the rear deck, yellow stencils.
import { SIEGE_COLORS } from './palette.js';
import { track } from '../prims.js';

const net = (x, y, z, sx, sy, sz, extra = {}) => ({ t: 'ell', s: [sx, sy, sz], seg: 6, p: [x, y, z], m: 'net', ...extra });
const bag = (x, y, z, r = 0, extra = {}) => ({ t: 'ell', s: [0.18, 0.085, 0.12], seg: 6, p: [x, y, z], r3: [0, r, 0], m: 'camo2', d: 1, ...extra });
const TPIV = [-0.45, 1.42, 0];
// owner 2026-10-20: "the heavy tank turret a little smaller to emphasize the body and gun" — every turret part is scaled
// by TK about the turret ring (TC); the gun keeps its size and its trunnion sits on the smaller mantlet's front.
const TK = 0.78, TC = [-0.45, 1.36, 0];
const BY = TC[1] + (1.74 - TC[1]) * TK, BX = TC[0] + (0.79 - TC[0]) * TK;   // the old mantlet front, scaled
const BPIV = [BX, BY, 0];
function turretScale(pt) {
  if (pt.g !== 'turret') return pt;
  const sx = (x) => TC[0] + (x - TC[0]) * TK, sy = (y) => TC[1] + (y - TC[1]) * TK, sz = (z) => z * TK;
  const q = { ...pt };
  if (q.p) q.p = [sx(q.p[0]), sy(q.p[1]), sz(q.p[2])];
  if (q.s) q.s = q.s.map((v) => v * TK);
  if (q.r != null) q.r = Array.isArray(q.r) ? q.r.map((v) => v * TK) : q.r * TK;
  if (q.l != null) q.l *= TK;
  if (q.secs) q.secs = q.secs.map(([at, pts]) => [sy(at), pts.map(([x, z]) => [sx(x), sz(z)])]);   // loft along Y: (x, z)
  return q;
}

export const SIEGE_HEAVY = { name: 'Fortress heavy tank', unit: 'ART-HeavyTanks', ref: 'siege_heavy', colors: SIEGE_COLORS,
  parts: [
    ...track({ x0: -2.0, x1: 1.9, h: 0.72, z: 1.08, w: 0.62, wheels: 7, wr: 0.21 }),
    // hull core: side profile, thick sloped glacis
    { t: 'ext', ax: 'z', poly: [[-2.05, 0.4], [-2.05, 1.3], [0.9, 1.3], [2.05, 0.82], [1.95, 0.46], [1.5, 0.4]], d: [-0.82, 0.82], m: 'olive' },
    { t: 'ext', ax: 'z', poly: [[-2.06, 0.4], [-2.06, 0.72], [1.98, 0.72], [1.95, 0.46], [1.5, 0.4]], d: [-0.83, 0.83], m: 'camo' },
    // thick sloped side plates over the tracks (chamfered top, tapered nose)
    { t: 'loft', ax: 'x', m: 'olive', mir: true, secs: [
      [-2.1, [[0.82, 0.62], [1.44, 0.62], [1.44, 1.06], [1.2, 1.3], [0.82, 1.3]]],
      [1.35, [[0.82, 0.62], [1.44, 0.62], [1.44, 1.06], [1.2, 1.3], [0.82, 1.3]]],
      [1.95, [[0.82, 0.66], [1.36, 0.66], [1.36, 0.84], [1.18, 0.96], [0.82, 0.96]]]] },
    // armour-panel seams + olive patches + yellow stencils on the side plates
    ...[-1.3, -0.4, 0.5].map((x) => ({ t: 'box', s: [0.03, 0.4, 0.02], p: [x, 0.92, 1.445], m: 'dark', mir: true, d: 1 })),
    { t: 'box', s: [0.8, 0.26, 0.02], p: [-0.85, 0.95, 1.445], r3: [0, 0, 7], m: 'camo', mir: true },
    { t: 'box', s: [0.55, 0.2, 0.02], p: [0.9, 0.9, 1.445], r3: [0, 0, -9], m: 'camo', mir: true },
    { t: 'box', s: [0.06, 0.18, 0.02], p: [0.05, 1.0, 1.45], m: 'hazard', mir: true },
    { t: 'box', s: [0.06, 0.18, 0.02], p: [0.17, 1.0, 1.45], m: 'hazard', mir: true },
    // segmented armour boxes bolted along the sides, each with a yellow marking
    ...[-1.55, -0.92, -0.29, 0.34, 0.97].flatMap((x) => [
      { t: 'box', s: [0.56, 0.42, 0.1], p: [x, 0.98, 1.48], m: 'olive', mir: true },
      { t: 'box', s: [0.1, 0.1, 0.02], p: [x + 0.12, 1.08, 1.54], m: 'hazard', mir: true, d: 1 },
    ]),
    // glacis stencil + headlights
    { t: 'box', s: [0.02, 0.1, 0.3], p: [1.62, 1.08, 0.45], r3: [0, 0, 22], m: 'hazard', mir: true, d: 1 },
    { t: 'box', s: [0.06, 0.08, 0.14], p: [2.0, 0.76, 0.6], m: 'amber', mir: true },
    // rear plate + stowage box on the rear deck
    { t: 'box', s: [0.1, 0.55, 1.4], p: [-2.08, 1.0, 0], m: 'camo' },
    { t: 'box', s: [0.55, 0.3, 1.25], p: [-1.65, 1.42, 0], m: 'dark' },
    // sandbagged front deck and side decks, netting over everything
    ...[-0.55, -0.2, 0.15, 0.5].map((z) => bag(1.25, 1.12, z, 6)),
    ...[-0.4, -0.05, 0.3].map((z) => bag(1.1, 1.26, z, -5)),
    ...[-1.2, -0.75, -0.3, 0.15, 0.6].map((x) => bag(x, 1.36, 1.15, 90, { mir: true })),
    net(0.95, 1.3, 0.0, 0.65, 0.15, 0.75), net(-1.1, 1.36, 0.0, 0.5, 0.12, 0.5), net(-0.1, 1.38, 1.1, 0.9, 0.12, 0.26, { mir: true }),
    net(-1.6, 1.34, 1.1, 0.4, 0.12, 0.25, { mir: true }), net(0.4, 1.0, 1.45, 0.6, 0.18, 0.06, { mir: true, d: 1 }),

    // ── turret (yaws): big boxy fortress turret, sandbag ring, netting, cupola ──
    { t: 'cyl', ax: 'y', r: 0.92, l: 0.12, seg: 12, p: [-0.45, 1.36, 0], m: 'dark', g: 'turret' },
    { t: 'loft', ax: 'y', g: 'turret', m: 'olive', secs: [
      [1.4, [[0.7, -0.78], [0.95, -0.5], [0.95, 0.5], [0.7, 0.78], [-1.2, 0.84], [-1.45, 0.62], [-1.45, -0.62], [-1.2, -0.84]].map(([x, z]) => [x - 0.4, z])],
      [1.98, [[0.62, -0.72], [0.86, -0.46], [0.86, 0.46], [0.62, 0.72], [-1.16, 0.8], [-1.4, 0.58], [-1.4, -0.58], [-1.16, -0.8]].map(([x, z]) => [x - 0.4, z])],
      [2.12, [[0.4, -0.56], [0.6, -0.34], [0.6, 0.34], [0.4, 0.56], [-1.02, 0.64], [-1.24, 0.46], [-1.24, -0.46], [-1.02, -0.64]].map(([x, z]) => [x - 0.4, z])]] },
    { t: 'box', s: [0.7, 0.26, 0.02], p: [-0.8, 1.72, 0.81], r3: [0, -3, 0], m: 'camo', g: 'turret', mir: true },
    { t: 'box', s: [0.06, 0.16, 0.02], p: [-1.2, 1.72, 0.83], m: 'hazard', g: 'turret', mir: true, d: 1 },
    ...[-1.45, -1.0, -0.55, -0.1].map((x) => bag(x, 2.18, 0.5, 90, { g: 'turret', mir: true })),
    net(-0.8, 2.16, 0.0, 0.7, 0.14, 0.5, { g: 'turret' }), net(-1.3, 2.0, 0.75, 0.5, 0.16, 0.14, { g: 'turret', mir: true }),
    { t: 'cyl', ax: 'y', r: [0.2, 0.24], l: 0.22, seg: 8, p: [-1.2, 2.26, -0.35], m: 'camo', g: 'turret' },
    { t: 'box', s: [0.02, 0.4, 0.02], p: [-1.55, 2.35, 0.4], m: 'dark', g: 'turret', d: 1 },
    { t: 'box', s: [0.38, 0.5, 0.7], p: [0.6, 1.74, 0], m: 'camo', g: 'turret' },               // mantlet block
    // shell rack standing on the turret's rear corner (rust casings, hazard tips)
    { t: 'box', s: [0.5, 0.12, 0.42], p: [-1.6, 2.14, 0.5], m: 'dark', g: 'turret' },
    ...[0.34, 0.46, 0.58, 0.7].flatMap((z) => [
      { t: 'cyl', ax: 'y', r: 0.06, l: 0.36, seg: 6, p: [-1.62, 2.38, z], r3: [0, 0, -12], m: 'rust', g: 'turret' },
      { t: 'cyl', ax: 'y', r: [0.0, 0.06], l: 0.12, seg: 6, p: [-1.67, 2.62, z], r3: [0, 0, -12], m: 'hazard', g: 'turret', d: 1 },
    ]),

    // ── barrel (pitches, recoils): heavy short gun with a fat muzzle — full size on the smaller turret, its tube
    //    lengthened so the muzzle stays where it was ──
    { t: 'cyl', ax: 'x', r: [0.18, 0.22], l: 0.4, seg: 10, p: [BX + 0.23, BY, 0], m: 'olive', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.14, 0.16], l: 2.28 - (BX + 0.4), seg: 10, p: [(BX + 0.4 + 2.28) / 2, BY, 0], m: 'olive', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.17, l: 0.08, seg: 10, p: [BX + 0.62, BY, 0], m: 'camo', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.2, 0.18], l: 0.34, seg: 10, p: [2.45, BY, 0], m: 'dark', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.11, l: 0.03, seg: 10, p: [2.63, BY, 0], m: 'black', g: 'barrel' },
  ].map(turretScale),
  pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -6, max: 20, rate: 0.8 },
  recoil: 0.45,   // single heavy rounds with a body kick (unitBarrels.heavy)
  muzzles: [{ p: [2.64, BY, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'right', top: 'down' } };
