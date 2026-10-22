// src/render3d/units/dark/artillery.js — DRK-Artillery: Rune cannon (owner concept tools/unit-models/ref/dark/dark-artillery.png)
// [MM-story_mvifm4xj_1]. A low tracked obsidian chassis with a violet rune on its flank, a turret carrying a long, thick
// siege barrel raised high, and a great banded energy cylinder glowing with violet runes on its breech. The barrel is
// authored level and rests raised.
import { DARK_COLORS, veins, fungus, eye } from './palette.js';
import { ring } from '../arcane/palette.js';
import { track } from '../prims.js';

const TPIV = [-0.2, 1.1, 0], TRUN = [0.1, 1.55, 0];

export const DARK_ARTILLERY = { name: 'Rune cannon', unit: 'DRK-Artillery', ref: 'dark_artillery', colors: DARK_COLORS,
  parts: [
    ...track({ x0: -1.9, x1: 1.75, h: 0.6, z: 0.92, w: 0.46, wheels: 6, wr: 0.19, hub: 'ash' }),
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.38], [-1.95, 1.05], [1.2, 1.05], [1.8, 0.75], [1.75, 0.42], [1.4, 0.38]], d: [-0.72, 0.72], m: 'void' },
    { t: 'loft', ax: 'x', m: 'obsid', mir: true, secs: [
      [-1.98, [[0.72, 0.62], [1.2, 0.62], [1.2, 0.94], [0.72, 1.04]]], [1.25, [[0.72, 0.62], [1.2, 0.62], [1.2, 0.94], [0.72, 1.04]]],
      [1.8, [[0.72, 0.6], [1.14, 0.6], [1.14, 0.74], [0.72, 0.8]]]] },
    // the flank rune: a bone teardrop with a violet eye
    { t: 'ext', ax: 'z', poly: [[0, 0.22], [0.16, 0.08], [0.12, -0.12], [0, -0.2], [-0.12, -0.12], [-0.16, 0.08]], d: [0, 0.02], p: [0.75, 0.82, 1.2], m: 'bone', mir: true },
    ...eye('z', [0.75, 0.8, 1.205], 0.55, { mir: true }),
    ...veins('z', 1.2, [[-1.6, 0.7], [-1.2, 0.92], [-0.8, 0.72], [-0.3, 0.9]], 0.03, { mir: true }),
    ...fungus(-1.7, 1.05, 0.5, 2, 0.9, { mir: true }),
    // ── turret (yaws): stone housing, trunnion cheeks, the rune cylinder on the breech side ──
    { t: 'cyl', ax: 'y', r: 0.62, l: 0.12, seg: 12, p: [-0.2, 1.12, 0], m: 'ash', g: 'turret' },
    { t: 'ext', ax: 'z', poly: [[-1.3, 1.12], [-1.3, 1.55], [-0.9, 1.75], [0.35, 1.75], [0.55, 1.12]], d: [-0.52, 0.52], m: 'obsid', g: 'turret' },
    { t: 'cyl', ax: 'z', r: 0.24, l: 1.24, seg: 10, p: TRUN, m: 'ash', g: 'turret' },
    { t: 'cyl', ax: 'x', r: 0.42, l: 0.9, seg: 12, p: [-0.95, 1.85, 0], m: 'void', g: 'turret' },
    ...[-1.32, -0.95, -0.58].map((x) => ring('x', [x, 1.85, 0], 0.45, 0.06, 0.06, 'ash', { g: 'turret' }, 12)),
    ...[-1.12, -0.77].map((x) => ({ t: 'cyl', ax: 'x', r: 0.425, l: 0.06, seg: 12, p: [x, 1.85, 0], m: 'glowV', g: 'turret' })),
    { t: 'cyl', ax: 'x', r: 0.3, l: 0.04, seg: 10, p: [-1.42, 1.85, 0], m: 'glowV', g: 'turret' },
    // ── barrel (pitches): long thick siege barrel, banded, a heavy muzzle ring ──
    { t: 'cyl', ax: 'x', r: [0.24, 0.28], l: 0.8, seg: 10, p: [0.45, 1.55, 0], m: 'obsid', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.2, 0.22], l: 2.3, seg: 10, p: [1.95, 1.55, 0], m: 'void', g: 'barrel' },
    ...[1.1, 2.0, 2.8].map((x) => ({ t: 'cyl', ax: 'x', r: 0.24, l: 0.08, seg: 10, p: [x, 1.55, 0], m: 'ash', g: 'barrel' })),
    { t: 'cyl', ax: 'x', r: 0.27, l: 0.28, seg: 10, p: [3.2, 1.55, 0], m: 'obsid', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.02, seg: 10, p: [3.345, 1.55, 0], m: 'black', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 45, min: 25, max: 70, rate: 0.7 },
  muzzles: [{ p: [3.36, 1.55, 0], d: [1, 0, 0], back: 0.8, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
