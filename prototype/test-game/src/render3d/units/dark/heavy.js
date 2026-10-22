// src/render3d/units/dark/heavy.js — DRK-HeavyTanks: Overgrown dreadnought (owner concept tools/unit-models/ref/dark/dark-heavy-tank.png)
// [MM-story_mvifm4xj_1]. A big slab-armoured tank swallowed by the cult's growth: purple tendrils drape its hull and
// skirts and drip over the edges, violet pustules glow along its sides, a glowing violet orb sits caged on the turret
// roof behind two antennas, and a long thick gun points from a heavy mantlet.
import { DARK_COLORS, veins, fungus, tendril } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.45, 1.42, 0], BPIV = [0.75, 1.8, 0];
const pustule = (x, y, z, s = 1, extra = {}) => [
  { t: 'ell', s: [0.1 * s, 0.1 * s, 0.05 * s], seg: 6, p: [x, y, z], m: 'tendril', ...extra },
  { t: 'ell', s: [0.06 * s, 0.06 * s, 0.04 * s], seg: 6, p: [x, y, z + 0.03 * s], m: 'glowV', ...extra },
];

export const DARK_HEAVY = { name: 'Overgrown dreadnought', unit: 'DRK-HeavyTanks', ref: 'dark_heavy', colors: DARK_COLORS,
  parts: [
    ...track({ x0: -2.05, x1: 1.95, h: 0.72, z: 1.08, w: 0.62, wheels: 7, wr: 0.21, hub: 'ash' }),
    { t: 'ext', ax: 'z', poly: [[-2.1, 0.4], [-2.1, 1.35], [0.9, 1.38], [2.05, 0.85], [1.95, 0.46], [1.5, 0.4]], d: [-0.84, 0.84], m: 'void' },
    { t: 'loft', ax: 'x', m: 'obsid', mir: true, secs: [
      [-2.12, [[0.84, 0.66], [1.45, 0.66], [1.45, 1.1], [1.25, 1.3], [0.84, 1.3]]],
      [1.4, [[0.84, 0.66], [1.45, 0.66], [1.45, 1.1], [1.25, 1.3], [0.84, 1.3]]],
      [2.0, [[0.84, 0.68], [1.38, 0.68], [1.38, 0.86], [1.2, 0.98], [0.84, 0.98]]]] },
    // tendrils draped over the skirts, dripping down the sides; glowing pustules
    ...[-1.7, -1.05, -0.35, 0.4, 1.1].flatMap((x, i) => tendril(x, 1.25, 1.47, 0.42 + (i % 2) * 0.15, 8 + i * 4, { mir: true })),
    ...[[-1.4, 0.95, 1.46], [-0.6, 1.1, 1.46], [0.75, 0.9, 1.46], [1.3, 1.05, 1.44]].flatMap(([x, y, z]) => pustule(x, y, z, 1, { mir: true })),
    ...veins('z', 1.455, [[-1.9, 0.8], [-1.5, 1.15], [-1.0, 0.85], [-0.5, 1.15], [0.1, 0.8], [0.6, 1.1]], 0.04, { mir: true }),
    { t: 'loft', ax: 'x', m: 'tendril', mir: true, secs: [[-2.0, [[0.9, 1.3], [1.4, 1.3], [1.4, 1.36], [0.9, 1.36]]], [1.3, [[0.95, 1.3], [1.35, 1.3], [1.35, 1.36], [0.95, 1.36]]]] },
    ...fungus(1.45, 1.1, 0.5, 3, 1.1, { mir: true }), ...fungus(-1.8, 1.35, 0.6, 3, 1),
    // ── turret (yaws): broad slab turret, tendrils over it, the caged violet orb, antennas ──
    { t: 'cyl', ax: 'y', r: 0.88, l: 0.12, seg: 12, p: [-0.45, 1.4, 0], m: 'ash', g: 'turret' },
    { t: 'loft', ax: 'y', m: 'obsid', g: 'turret', secs: [
      [1.42, [[0.85, -0.7], [1.1, -0.35], [1.1, 0.35], [0.85, 0.7], [-1.35, 0.8], [-1.6, 0.5], [-1.6, -0.5], [-1.35, -0.8]].map(([x, z]) => [x - 0.45, z])],
      [2.02, [[0.65, -0.6], [0.9, -0.3], [0.9, 0.3], [0.65, 0.6], [-1.25, 0.7], [-1.5, 0.42], [-1.5, -0.42], [-1.25, -0.7]].map(([x, z]) => [x - 0.45, z])]] },
    ...[-1.45, -0.8, -0.2].flatMap((x, i) => tendril(x, 1.95, 0.72, 0.35 + i * 0.05, 10, { g: 'turret', mir: true })),
    ...veins('y', 2.03, [[-1.7, -0.3], [-1.2, 0.0], [-0.6, -0.35], [-0.1, 0.1]], 0.04, { g: 'turret' }),
    ...pustule(-0.4, 1.7, 0.72, 1.2, { g: 'turret', mir: true }),
    { t: 'cyl', ax: 'y', r: 0.24, l: 0.12, seg: 10, p: [-0.75, 2.08, 0], m: 'ash', g: 'turret' },
    { t: 'ell', s: [0.22, 0.22, 0.22], seg: 10, p: [-0.75, 2.3, 0], m: 'glowV', g: 'turret' },
    ...[0, 60, 120].map((a) => ({ t: 'box', s: [0.5, 0.42, 0.03], p: [-0.75, 2.3, 0], r3: [0, a, 0], m: 'tendril', g: 'turret', d: 1 })),
    ...[[-1.5, 0.45, 1.1], [-1.35, -0.5, 0.85]].map(([x, z, l]) => ({ t: 'cyl', ax: 'y', r: 0.015, l, seg: 4, p: [x, 2.02 + l / 2, z], m: 'black', g: 'turret' })),
    { t: 'box', s: [0.42, 0.55, 0.72], p: [0.6, 1.8, 0], m: 'void', g: 'turret' },
    // ── barrel (pitches, recoils) ──
    { t: 'cyl', ax: 'x', r: [0.15, 0.18], l: 2.1, seg: 10, p: [1.85, 1.8, 0], m: 'void', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.12, seg: 10, p: [1.2, 1.8, 0], m: 'ash', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.22, 0.2], l: 0.36, seg: 10, p: [3.05, 1.8, 0], m: 'obsid', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.11, l: 0.02, seg: 10, p: [3.235, 1.8, 0], m: 'glowV', g: 'barrel' },
    ...tendril(1.5, 1.98, 0.1, 0.3, 5, { g: 'barrel' }),
  ],
  pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -6, max: 20, rate: 0.8 },
  recoil: 0.45,
  muzzles: [{ p: [3.25, 1.8, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
