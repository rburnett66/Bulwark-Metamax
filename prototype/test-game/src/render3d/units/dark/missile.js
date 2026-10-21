// src/render3d/units/dark/missile.js — DRK-Missiles: Spore bladder (owner concept tools/unit-models/ref/dark/dark-missiles.png:
// "slow flying launcher · floating spore bladder") [MM-story_mvifm4xj_1]. A squat stone bladder that drifts: a crown of
// ten spiked warheads ringing its top, a cluster of violet eye-orbs on its face, a hanging fringe of ribbed tubes like
// tentacles, and two violet thrusters underneath. Its warheads leave from the crown.
import { DARK_COLORS } from './palette.js';
import { ring } from '../arcane/palette.js';

const C = [0, 1.25, 0];

export const DARK_MISSILE = { name: 'Spore bladder', unit: 'DRK-Missiles', ref: 'dark_missile', colors: DARK_COLORS,
  parts: [
    // the bladder: a squashed stone onion, a ledge around its crown
    { t: 'ell', s: [0.95, 0.62, 0.95], seg: 12, p: C, m: 'obsid' },
    { t: 'cyl', ax: 'y', r: [0.78, 0.95], l: 0.25, seg: 12, p: [0, C[1] + 0.5, 0], m: 'void' },
    ring('y', [0, C[1] + 0.64, 0], 0.82, 0.14, 0.08, 'ash', {}, 12),
    // the crown of ten spiked warheads
    ...Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, x = Math.cos(a) * 0.72, z = Math.sin(a) * 0.72; return [
      { t: 'cyl', ax: 'y', r: [0.07, 0.1], l: 0.3, seg: 6, p: [x, C[1] + 0.82, z], m: 'void' },
      { t: 'cyl', ax: 'y', r: [0.0, 0.07], l: 0.2, seg: 6, p: [x, C[1] + 1.07, z], m: 'ash' },
    ]; }).flat(),
    // the eye-cluster on the face (+x): a dark socket, seven violet orbs
    { t: 'cyl', ax: 'x', r: 0.3, l: 0.12, seg: 8, p: [0.88, C[1], 0], m: 'black' },
    ...[[0, 0], [0.15, 0.08], [-0.15, 0.08], [0.15, -0.09], [-0.15, -0.09], [0, 0.17], [0, -0.17]].map(([z, y]) => ({ t: 'ell', s: [0.06, 0.07, 0.07], seg: 6, p: [0.95, C[1] + y, z], m: 'glowV' })),
    // the hanging fringe of ribbed tubes, and two violet thrusters below
    ...Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) / 8 * Math.PI * 2, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62, L = 0.75 + (i % 2) * 0.2; return [
      { t: 'cyl', ax: 'y', r: [0.08, 0.06], l: L, seg: 6, p: [x * 1.05, C[1] - 0.35 - L / 2, z * 1.05], m: 'void' },
      { t: 'cyl', ax: 'y', r: 0.085, l: 0.06, seg: 6, p: [x * 1.05, C[1] - 0.5 - L * 0.4, z * 1.05], m: 'ash', d: 1 },
    ]; }).flat(),
    ...[0.22, -0.22].flatMap((z) => [
      { t: 'cyl', ax: 'y', r: [0.12, 0.16], l: 0.3, seg: 8, p: [0, C[1] - 0.72, z], m: 'ash' },
      { t: 'cyl', ax: 'y', r: 0.12, l: 0.02, seg: 8, p: [0, C[1] - 0.88, z], m: 'glowV' },
      { t: 'cyl', ax: 'y', r: [0.12, 0.0], l: 0.4, seg: 6, p: [0, C[1] - 1.08, z], r3: [180, 0, 0], m: 'glowB' },
    ]),
  ],
  pivots: {}, hover: 1,
  muzzles: [0, 3, 5, 8].map((i) => { const a = i / 10 * Math.PI * 2; return { p: [Math.cos(a) * 0.72, C[1] + 1.18, Math.sin(a) * 0.72], d: [0.3, 1, 0], back: 0 }; }),
  views: { side: 'left', top: 'down' } };
