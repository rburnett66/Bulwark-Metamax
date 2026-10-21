// src/render3d/units/arcane/artillery.js — ARC-Artillery: Organ battery (owner concept tools/unit-models/ref/arcane/arcane-artillery.png)
// [MM-story_mvhnbx8n_4]. A carved gothic chassis on tracks carrying a towering bank of bronze-banded organ pipes (the
// launcher) raised steeply skyward, with a great bronze bell hung from a crane arm on its flank. The pipe housing yaws
// (`turret`) and the pipe bank pitches (`barrel`, authored level, resting raised).
import { ARCANE_COLORS, archWindow, strut, pinnacle, ring } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.3, 1.25, 0], TRUN = [-0.3, 1.7, 0];
// pipe bank, authored lying forward along +X from the trunnion: 3 rows × 5 pipes, staggered lengths
const PIPES = [];
[-0.24, 0, 0.24].forEach((y, row) => [-0.44, -0.22, 0, 0.22, 0.44].forEach((z, i) => {
  const L = 2.4 + (2 - Math.abs(i - 2)) * 0.4 - row * 0.15, r = 0.09 - Math.abs(i - 2) * 0.007;
  PIPES.push({ y: 1.7 + y + 0.05, z, L, r });
}));

const parts = [
  ...track({ x0: -1.9, x1: 1.75, h: 0.62, z: 0.95, w: 0.46, wheels: 6, wr: 0.2, hub: 'bronze' }),
  // carved chassis: hull with a raked nose, gothic arcading on the sides
  { t: 'ext', ax: 'z', poly: [[-1.95, 0.42], [-1.95, 1.2], [1.2, 1.2], [1.8, 0.8], [1.75, 0.46], [1.5, 0.42]], d: [-0.72, 0.72], m: 'iron' },
  { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
    [-1.98, [[0.7, 0.64], [1.2, 0.64], [1.2, 0.9], [1.05, 1.0], [0.7, 1.0]]],
    [1.25, [[0.7, 0.64], [1.2, 0.64], [1.2, 0.9], [1.05, 1.0], [0.7, 1.0]]],
    [1.8, [[0.7, 0.6], [1.15, 0.6], [1.15, 0.72], [1.02, 0.8], [0.7, 0.8]]]] },
  ...[-1.5, -0.95, -0.4, 0.15, 0.7].flatMap((x) => archWindow('z', [x, 0.66, 1.2], 0.18, 0.12, { k: 1.6, bars: false, m: 'dark', fm: 'bronze2', extra: { mir: true } })),
  { t: 'box', s: [3.3, 0.04, 0.04], p: [-0.3, 1.0, 1.21], m: 'bronze', mir: true },
  ...[-1.75, 1.1].flatMap((x) => pinnacle(x, 1.2, 0.62, 0.38, 0.06, 'bronze', { mir: true })),
  { t: 'box', s: [3.1, 0.06, 1.5], p: [-0.35, 1.22, 0], m: 'iron2' },
  // a glowing arched port on the nose
  ...archWindow('x', [1.62, 0.55, 0], 0.22, 0.12, { k: 1.6, bars: false }),

  // ── turret (yaws): carved housing and the trunnion cheeks ──
  { t: 'cyl', ax: 'y', r: 0.72, l: 0.14, seg: 12, p: [-0.3, 1.3, 0], m: 'bronze2', g: 'turret' },
  { t: 'box', s: [1.4, 0.32, 1.3], p: [-0.35, 1.5, 0], m: 'iron', g: 'turret' },
  ...[-0.75, -0.3, 0.15].flatMap((x) => archWindow('z', [x, 1.38, 0.65], 0.1, 0.1, { k: 1.6, bars: false, extra: { g: 'turret', mir: true } })),
  { t: 'ext', ax: 'z', poly: [[-0.6, 1.62], [0.0, 1.62], [-0.1, 2.0], [-0.5, 2.0]], d: [0.66, 0.8], m: 'iron2', g: 'turret', mir: true },
  { t: 'cyl', ax: 'z', r: 0.15, l: 1.7, seg: 10, p: TRUN, m: 'bronze', g: 'turret' },
  // crane arm on the right flank with the hanging bell (the bell swings with the turret)
  strut([-0.75, 1.62, 0.7], [-0.45, 2.55, 1.0], 0.08, 0.08, 'bronze2', { g: 'turret' }),
  strut([-0.45, 2.55, 1.0], [0.05, 2.5, 1.3], 0.07, 0.07, 'bronze2', { g: 'turret' }),
  { t: 'cyl', ax: 'y', r: 0.015, l: 0.3, seg: 4, p: [0.05, 2.35, 1.3], m: 'dark', g: 'turret' },
  { t: 'ell', s: [0.4, 0.4, 0.4], seg: 10, p: [0.05, 1.8, 1.3], m: 'bronze2', g: 'turret' },
  { t: 'cyl', ax: 'y', r: [0.36, 0.42], l: 0.12, seg: 10, p: [0.05, 1.55, 1.3], m: 'bronze', g: 'turret' },
  ring('y', [0.05, 1.86, 1.3], 0.42, 0.05, 0.06, 'bronze', { g: 'turret' }, 12),
  { t: 'ell', s: [0.1, 0.1, 0.1], seg: 6, p: [0.05, 2.22, 1.3], m: 'bronze', g: 'turret' },

  // ── barrel (pitches): the organ-pipe bank, banded in bronze ──
  { t: 'box', s: [0.5, 0.86, 1.18], p: [-0.05, 1.75, 0], m: 'iron2', g: 'barrel' },
  ...PIPES.flatMap((q) => [
    { t: 'cyl', ax: 'x', r: q.r, l: q.L, seg: 8, p: [-0.2 + q.L / 2, q.y, q.z], m: 'bronze', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: q.r * 0.65, l: 0.02, seg: 8, p: [-0.2 + q.L + 0.005, q.y, q.z], m: 'black', g: 'barrel' },
  ]),
  ...[0.8, 1.7, 2.45].map((x) => ({ t: 'box', s: [0.06, 0.72, 1.14], p: [x, 1.75, 0], m: 'bronze2', g: 'barrel' })),
];

export const ARCANE_ARTILLERY = { name: 'Organ battery', unit: 'ARC-Artillery', ref: 'arcane_artillery', colors: ARCANE_COLORS,
  parts, pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 65, min: 40, max: 80, rate: 0.7 },
  muzzles: PIPES.filter((_, i) => i % 3 === 1).map((q) => ({ p: [-0.2 + q.L + 0.01, q.y, q.z], d: [1, 0, 0], back: 0.3, g: 'barrel' })),
  // shadow proxy: the pipe bank casts as one slab (shadow.js) — fifteen pipes would cost more than the whole hull
  shadow: { barrel: [{ t: 'box', s: [3.05, 0.62, 1.12], p: [1.32, 1.75, 0] }] },
  views: { side: 'left', top: 'down' } };
