// src/render3d/units/arcane/tank.js — ARC-Tanks: Reliquary assault tank (owner concept tools/unit-models/ref/arcane/arcane-tank.png)
// [MM-story_mvhnbx8n_4]. A long gothic hull on full tracks: a tall pointed-arch facade of glowing red stained glass on the
// nose, a row of red lancet windows between bronze buttresses down each flank, bronze rosette wheels on the track guards,
// and a small spired turret carrying a long ringed energy cannon in front of a spiked bronze halo.
import { ARCANE_COLORS, archPoly, archWindow, ring, pinnacle } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.35, 1.62, 0], BPIV = [-0.05, 2.02, 0];
const HZ = 0.74;   // hull half-width

const parts = [
  ...track({ x0: -1.95, x1: 1.85, h: 0.62, z: 0.98, w: 0.46, wheels: 6, wr: 0.2, hub: 'bronze' }),
  // hull: side profile — leaning arch facade at the front, gently pitched roof
  { t: 'ext', ax: 'z', poly: [[-1.98, 0.42], [-2.02, 1.28], [-1.4, 1.5], [0.95, 1.58], [1.62, 1.42], [1.88, 0.5], [1.6, 0.42]], d: [-HZ, HZ], m: 'iron' },
  // ridge cap along the roof
  { t: 'box', s: [2.4, 0.06, 0.18], p: [-0.25, 1.6, 0], r3: [0, 0, 1.5], m: 'bronze' },
  // track guards with bronze edging, chamfered nose
  { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
    [-2.02, [[0.72, 0.64], [1.24, 0.64], [1.24, 0.9], [1.08, 1.02], [0.72, 1.02]]],
    [1.3, [[0.72, 0.64], [1.24, 0.64], [1.24, 0.9], [1.08, 1.02], [0.72, 1.02]]],
    [1.9, [[0.72, 0.6], [1.2, 0.6], [1.2, 0.72], [1.06, 0.8], [0.72, 0.8]]]] },
  { t: 'box', s: [3.3, 0.04, 0.04], p: [-0.35, 1.02, 1.1], m: 'bronze', mir: true },
  // bronze rosette wheels on the guards (fore and aft)
  ...[0.95, -1.35].flatMap((x) => [
    { t: 'cyl', ax: 'z', r: 0.3, l: 0.08, seg: 12, p: [x, 0.92, 1.25], m: 'bronze', mir: true },
    { t: 'cyl', ax: 'z', r: 0.12, l: 0.12, seg: 8, p: [x, 0.92, 1.25], m: 'bronze2', mir: true },
    ...[0, 45, 90, 135].map((a) => ({ t: 'box', s: [0.04, 0.5, 0.03], p: [x, 0.92, 1.3], r3: [0, 0, a], m: 'bronze2', mir: true, d: 1 })),
  ]),
  // flank: four lancet windows between bronze buttresses
  ...[-1.45, -0.8, -0.15, 0.5].flatMap((x) => archWindow('z', [x, 1.04, HZ], 0.17, 0.2, { k: 1.8, extra: { mir: true } })),
  ...[-1.78, -1.12, -0.47, 0.18, 0.83].map((x) => ({ t: 'box', s: [0.1, 0.52, 0.08], p: [x, 1.24, HZ + 0.02], m: 'bronze', mir: true })),
  ...[-1.78, -1.12, -0.47, 0.18, 0.83].flatMap((x) => pinnacle(x, 1.5, HZ - 0.02, 0.3, 0.05, 'bronze', { mir: true, d: 1 })),
  // the nose: a tall leaning pointed-arch facade — iron gable, bronze frame, glowing glass, tracery
  { t: 'ext', ax: 'x', poly: archPoly(0.66, 0.46, 1.4), d: [-0.08, 0.04], p: [1.72, 0.48, 0], r3: [0, 0, 18], m: 'iron2' },
  { t: 'ext', ax: 'x', poly: archPoly(0.6, 0.42, 1.4), d: [0.04, 0.08], p: [1.72, 0.5, 0], r3: [0, 0, 18], m: 'bronze' },
  { t: 'ext', ax: 'x', poly: archPoly(0.5, 0.36, 1.4), d: [0.08, 0.1], p: [1.72, 0.56, 0], r3: [0, 0, 18], m: 'glowR' },
  ...[-0.25, 0, 0.25].map((z) => ({ t: 'box', s: [0.02, 0.9, 0.03], p: [1.72 + 0.11 - 0.45 * Math.sin(18 * Math.PI / 180), 0.56 + 0.45 * Math.cos(18 * Math.PI / 180), z], r3: [0, 0, 18], m: 'bronze', d: 1 })),
  ...[0.3, 0.62].map((h) => ({ t: 'box', s: [0.02, 0.025, 1.0], p: [1.72 + 0.11 - h * Math.sin(18 * Math.PI / 180), 0.56 + h * Math.cos(18 * Math.PI / 180), 0], r3: [0, 0, 18], m: 'bronze', d: 1 })),
  { t: 'cyl', ax: 'y', r: [0, 0.06], l: 0.3, seg: 4, p: [1.38, 1.72, 0], m: 'bronze' },
  // rear: a small arched hatch
  ...archWindow('x', [-2.0, 0.6, 0], 0.26, 0.3, { out: -1, bars: false, m: 'iron2' }),

  // ── turret (yaws): ring, gothic housing, pinnacles, spiked halo ──
  { t: 'cyl', ax: 'y', r: 0.55, l: 0.12, seg: 12, p: [-0.35, 1.62, 0], m: 'bronze2', g: 'turret' },
  { t: 'ext', ax: 'z', poly: [[-0.85, 1.66], [-0.85, 2.05], [-0.55, 2.3], [0.15, 2.3], [0.3, 2.1], [0.3, 1.66]], d: [-0.42, 0.42], m: 'iron', g: 'turret' },
  { t: 'box', s: [1.2, 0.05, 0.88], p: [-0.28, 1.7, 0], m: 'bronze', g: 'turret' },
  ...archWindow('z', [-0.35, 1.76, 0.42], 0.12, 0.16, { k: 1.8, bars: false, extra: { g: 'turret', mir: true } }),
  ...[[-0.8, 0.38], [0.25, 0.38]].flatMap(([x, z]) => pinnacle(x, 2.05, z, 0.42, 0.06, 'bronze', { g: 'turret', mir: true })),
  ring('x', [-0.62, 2.62, 0], 0.46, 0.08, 0.07, 'bronze', { g: 'turret' }),
  ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2;
    return { t: 'box', s: [0.05, 0.22, 0.07], p: [-0.62, 2.62 + Math.sin(a) * 0.55, Math.cos(a) * 0.55], r3: [-(a * 180 / Math.PI) + 90, 0, 0], m: 'bronze', g: 'turret' }; }),
  { t: 'box', s: [0.08, 0.36, 0.08], p: [-0.62, 2.2, 0], m: 'bronze2', g: 'turret' },

  // ── barrel (pitches, recoils): long ringed energy cannon with a flared red-glowing muzzle ──
  { t: 'cyl', ax: 'x', r: [0.15, 0.19], l: 0.5, seg: 10, p: [0.2, 2.02, 0], m: 'bronze2', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: [0.09, 0.11], l: 1.85, seg: 10, p: [1.35, 2.02, 0], m: 'iron', g: 'barrel' },
  ...[0.55, 1.0, 1.55, 2.05].map((x) => ({ t: 'cyl', ax: 'x', r: 0.135, l: 0.08, seg: 10, p: [x, 2.02, 0], m: 'bronze', g: 'barrel' })),
  { t: 'cyl', ax: 'x', r: [0.18, 0.11], l: 0.24, seg: 10, p: [2.36, 2.02, 0], m: 'bronze', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.13, l: 0.02, seg: 10, p: [2.485, 2.02, 0], m: 'glowR', g: 'barrel' },
];

export const ARCANE_TANK = { name: 'Reliquary assault tank', unit: 'ARC-Tanks', ref: 'arcane_tank', colors: ARCANE_COLORS,
  parts, pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.2 },
  recoil: 0.3,
  muzzles: [{ p: [2.5, 2.02, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
