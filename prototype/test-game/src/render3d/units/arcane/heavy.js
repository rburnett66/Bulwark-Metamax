// src/render3d/units/arcane/heavy.js — ARC-HeavyTanks: Cathedral juggernaut (owner concept
// tools/unit-models/ref/arcane/arcane-heavy-tank.png) [MM-story_mvhnbx8n_4]. A cathedral on tracks: a rounded iron nose with
// two glowing rose windows, a tall nave walled with red lancet windows and bronze buttresses, a tracery spire rising at the
// rear among pinnacles, a fire bowl on the front corner, and a ribbed dome turret carrying twin red-tipped energy cannons.
import { ARCANE_COLORS, archWindow, roseWindow, ring, ellRing, pinnacle } from './palette.js';
import { track } from '../prims.js';

const TPIV = [0.35, 2.45, 0], BPIV = [0.75, 2.78, 0];
const NAVE = { x0: -1.75, x1: 0.95, y0: 1.2, y1: 2.45, z: 0.82 };

const parts = [
  ...track({ x0: -2.15, x1: 2.0, h: 0.75, z: 1.12, w: 0.6, wheels: 7, wr: 0.22, hub: 'bronze' }),
  // lower hull: rounded nose, flat sides
  { t: 'ext', ax: 'z', poly: [[-2.15, 0.42], [-2.15, 1.3], [1.2, 1.3], [1.9, 1.3], [1.98, 1.15], [2.0, 0.5], [1.7, 0.42]], d: [-0.84, 0.84], m: 'iron' },
  // heavy track guards with arched cut-outs and bronze edging
  { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
    [-2.2, [[0.82, 0.7], [1.48, 0.7], [1.48, 1.1], [1.28, 1.26], [0.82, 1.26]]],
    [1.45, [[0.82, 0.7], [1.48, 0.7], [1.48, 1.1], [1.28, 1.26], [0.82, 1.26]]],
    [2.05, [[0.82, 0.7], [1.42, 0.7], [1.42, 0.86], [1.24, 0.96], [0.82, 0.96]]]] },
  ...[-1.5, -0.7, 0.1, 0.9].map((x) => ({ t: 'box', s: [0.46, 0.3, 0.03], p: [x, 0.92, 1.48], m: 'dark', mir: true })),
  { t: 'box', s: [3.7, 0.05, 0.05], p: [-0.3, 1.26, 1.5], m: 'bronze', mir: true },
  // the nose: two rose windows on the front face, a fire bowl on the left corner
  { t: 'box', s: [0.06, 0.66, 1.56], p: [2.0, 0.92, 0], m: 'iron2' },
  ...[-0.42, 0.42].flatMap((z) => roseWindow('x', [2.03, 0.94, z], 0.25, { spokes: 8 })),
  { t: 'cyl', ax: 'y', r: [0.22, 0.12], l: 0.2, seg: 8, p: [1.6, 1.42, -0.62], m: 'bronze' },
  { t: 'cyl', ax: 'y', r: 0.06, l: 0.12, seg: 6, p: [1.6, 1.28, -0.62], m: 'bronze2' },
  { t: 'cyl', ax: 'y', r: [0, 0.16], l: 0.42, seg: 6, p: [1.6, 1.72, -0.62], m: 'glowF' },

  // ── the nave: walls of lancet windows between buttresses, a pitched roof with a cresting ──
  { t: 'box', s: [NAVE.x1 - NAVE.x0, NAVE.y1 - NAVE.y0, NAVE.z * 2], p: [(NAVE.x0 + NAVE.x1) / 2, (NAVE.y0 + NAVE.y1) / 2, 0], m: 'iron' },
  { t: 'ext', ax: 'x', poly: [[-NAVE.z - 0.05, 0], [NAVE.z + 0.05, 0], [0, 0.55]], d: [NAVE.x0, -0.3], p: [0, NAVE.y1, 0], m: 'iron2' },   // stops short of the turret
  { t: 'box', s: [-0.3 - NAVE.x0, 0.06, 0.08], p: [(NAVE.x0 - 0.3) / 2, NAVE.y1 + 0.56, 0], m: 'bronze' },
  ...[-1.45, -0.95, -0.45, 0.05, 0.55].flatMap((x) => archWindow('z', [x, NAVE.y0 + 0.18, NAVE.z], 0.15, 0.48, { k: 1.8, extra: { mir: true } })),
  ...[-1.72, -1.2, -0.7, -0.2, 0.3, 0.8].flatMap((x, i) => [
    { t: 'box', s: [0.12, NAVE.y1 - NAVE.y0, 0.14], p: [x, (NAVE.y0 + NAVE.y1) / 2, NAVE.z + 0.05], m: 'bronze2', mir: true },
    ...(i % 2 ? [] : pinnacle(x, NAVE.y1, NAVE.z + 0.05, 0.4, 0.06, 'bronze', { mir: true })),
  ]),
  // a big rose window on each flank, forward
  ...roseWindow('z', [0.62, 1.95, NAVE.z + 0.02], 0.3, { spokes: 8, extra: { mir: true } }),
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
  { t: 'cyl', ax: 'y', r: 0.62, l: 0.3, seg: 12, p: [0.35, 2.55, 0], m: 'iron2', g: 'turret' },
  ring('y', [0.35, 2.7, 0], 0.66, 0.08, 0.06, 'bronze', { g: 'turret' }, 14),
  { t: 'ell', s: [0.6, 0.48, 0.6], seg: 12, p: [0.35, 2.7, 0], m: 'iron', g: 'turret' },
  ...[0, 45, 90, 135].map((a) => ellRing('z', [0.35, 2.7, 0], 0.62, 0.5, 0.05, 0.05, 'bronze', { g: 'turret', r3: [0, a, 0] }, true, 12)),
  { t: 'cyl', ax: 'y', r: 0.14, l: 0.2, seg: 8, p: [0.35, 3.25, 0], m: 'bronze2', g: 'turret' },
  { t: 'cyl', ax: 'y', r: [0, 0.12], l: 0.25, seg: 8, p: [0.35, 3.47, 0], m: 'bronze', g: 'turret' },

  // ── barrels (pitch, recoil): twin energy cannons with bronze collars and red-glowing tips ──
  ...[-0.22, 0.22].flatMap((z) => [
    { t: 'cyl', ax: 'x', r: [0.14, 0.17], l: 0.45, seg: 10, p: [0.95, 2.78, z], m: 'bronze2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.09, 0.1], l: 1.3, seg: 10, p: [1.8, 2.78, z], m: 'iron', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.125, l: 0.07, seg: 10, p: [1.5, 2.78, z], m: 'bronze', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.13, 0.11], l: 0.22, seg: 10, p: [2.55, 2.78, z], m: 'glowR', g: 'barrel' },
  ]),
  { t: 'box', s: [0.2, 0.1, 0.5], p: [1.15, 2.78, 0], m: 'bronze2', g: 'barrel' },
];

export const ARCANE_HEAVY = { name: 'Cathedral juggernaut', unit: 'ARC-HeavyTanks', ref: 'arcane_heavy', colors: ARCANE_COLORS,
  parts, pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -6, max: 20, rate: 0.8 },
  recoil: 0.45,
  muzzles: [{ p: [2.67, 2.78, -0.22], d: [1, 0, 0], back: 1.0, g: 'barrel' }, { p: [2.67, 2.78, 0.22], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
