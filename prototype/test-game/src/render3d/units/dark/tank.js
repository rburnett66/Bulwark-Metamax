// src/render3d/units/dark/tank.js — DRK-Tanks: Sigil tank (owner concept tools/unit-models/ref/dark/dark-tank.png)
// [MM-story_mvifm4xj_1]. A tank carved from cracked obsidian: violet veins running through its plates, a glowing eye sigil
// on the turret and on each skirt, clumps of lilac fungus along the decks, and a long plain gun with a heavy muzzle.
import { DARK_COLORS, veins, fungus, eye } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.3, 1.12, 0], BPIV = [0.6, 1.42, 0];

export const DARK_TANK = { name: 'Sigil tank', unit: 'DRK-Tanks', ref: 'dark_tank', colors: DARK_COLORS,
  parts: [
    ...track({ x0: -1.9, x1: 1.8, h: 0.6, z: 0.92, w: 0.44, wheels: 6, wr: 0.19, hub: 'ash' }),
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.38], [-1.95, 1.08], [1.15, 1.1], [1.9, 0.78], [1.85, 0.44], [1.45, 0.38]], d: [-0.72, 0.72], m: 'void' },
    { t: 'loft', ax: 'x', m: 'obsid', mir: true, secs: [
      [-1.98, [[0.72, 0.62], [1.18, 0.62], [1.18, 0.96], [1.04, 1.06], [0.72, 1.06]]],
      [1.25, [[0.72, 0.62], [1.18, 0.62], [1.18, 0.96], [1.04, 1.06], [0.72, 1.06]]],
      [1.8, [[0.72, 0.62], [1.12, 0.62], [1.12, 0.76], [1.0, 0.84], [0.72, 0.84]]]] },
    ...eye('z', [0.55, 0.84, 1.185], 0.75, { mir: true }),
    ...veins('z', 1.185, [[-1.7, 0.7], [-1.3, 0.95], [-0.9, 0.75], [-0.5, 0.98], [-0.1, 0.72]], 0.03, { mir: true }),
    ...veins('y', 1.1, [[1.1, -0.4], [0.6, -0.1], [0.1, -0.3]]),
    ...veins('x', 1.88, [[-0.5, 0.5], [-0.2, 0.7], [0.2, 0.55]], 0.03),
    ...fungus(-1.6, 1.06, 0.95, 3, 1, { mir: true }), ...fungus(-0.5, 1.06, 1.0, 2, 0.8, { mir: true }), ...fungus(1.1, 1.0, 0.95, 3, 0.9, { mir: true }),
    ...fungus(-1.65, 1.08, -0.2, 3, 1.1),
    // ── turret (yaws): a faceted stone dome with the eye ──
    { t: 'cyl', ax: 'y', r: 0.58, l: 0.1, seg: 12, p: [-0.3, 1.12, 0], m: 'ash', g: 'turret' },
    { t: 'loft', ax: 'y', m: 'obsid', g: 'turret', secs: [
      [1.14, [[0.75, -0.5], [0.95, -0.2], [0.95, 0.2], [0.75, 0.5], [-1.05, 0.62], [-1.3, 0.38], [-1.3, -0.38], [-1.05, -0.62]].map(([x, z]) => [x - 0.3, z])],
      [1.6, [[0.5, -0.4], [0.7, -0.15], [0.7, 0.15], [0.5, 0.4], [-0.95, 0.5], [-1.15, 0.3], [-1.15, -0.3], [-0.95, -0.5]].map(([x, z]) => [x - 0.3, z])],
      [1.72, [[0.25, -0.26], [0.4, -0.08], [0.4, 0.08], [0.25, 0.26], [-0.8, 0.32], [-0.95, 0.18], [-0.95, -0.18], [-0.8, -0.32]].map(([x, z]) => [x - 0.3, z])]] },
    ...eye('z', [-0.35, 1.4, 0.585], 0.85, { g: 'turret', mir: true }),
    ...veins('y', 1.72, [[-1.0, -0.15], [-0.7, 0.1], [-0.4, -0.05]], 0.03, { g: 'turret' }),
    ...fungus(-1.2, 1.6, 0.3, 3, 0.9, { g: 'turret' }),
    { t: 'box', s: [0.3, 0.32, 0.42], p: [0.5, 1.4, 0], m: 'obsid', g: 'turret' },
    // ── barrel (pitches, recoils) ──
    { t: 'cyl', ax: 'x', r: [0.1, 0.12], l: 1.9, seg: 10, p: [1.6, 1.42, 0], m: 'void', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.1, seg: 10, p: [0.85, 1.42, 0], m: 'ash', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.17, 0.15], l: 0.3, seg: 10, p: [2.68, 1.42, 0], m: 'obsid', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.02, seg: 10, p: [2.835, 1.42, 0], m: 'glowV', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.2 },
  recoil: 0.3,
  muzzles: [{ p: [2.85, 1.42, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
