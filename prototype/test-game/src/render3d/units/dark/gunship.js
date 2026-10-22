// src/render3d/units/dark/gunship.js — DRK-Copters: Bat-wing gunship (owner concept tools/unit-models/ref/dark/dark-copter.png)
// [MM-story_mvifm4xj_1]. A heavy assault copter in purple-black scales: a bulbous armoured cockpit, stub wings carrying
// glowing violet rocket pods, a long tail boom with a three-blade tail rotor, and a main rotor of five bat-wing membranes
// — ribbed, scalloped blades (group `spin`, they turn).
import { DARK_COLORS, veins } from './palette.js';

const HUB = [0.15, 2.0, 0], TR = [-2.55, 1.55, -0.12];
const oct = (rz, ry, cy) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) / 8 * Math.PI * 2; return [Math.cos(a) * rz, cy + Math.sin(a) * ry]; });
// one bat-wing blade in the rotor plane (x, z): a spar out to the tip, the membrane scalloped back to the root
const blade = (a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  const P = (r, w) => [HUB[0] + c * r - s * w, -(HUB[2] + s * r + c * w)];
  return [P(0.15, 0.05), P(2.3, 0.0), P(2.0, -0.32), P(1.55, -0.18), P(1.15, -0.4), P(0.7, -0.22), P(0.25, -0.2)]; };

export const DARK_GUNSHIP = { name: 'Bat-wing gunship', unit: 'DRK-Copters', ref: 'dark_gunship', colors: DARK_COLORS,
  parts: [
    // fuselage: bulbous nose → cabin → tapering tail boom
    { t: 'loft', ax: 'x', m: 'obsid', secs: [
      [1.75, oct(0.12, 0.12, 1.15)], [1.45, oct(0.4, 0.38, 1.2)], [0.9, oct(0.55, 0.52, 1.28)], [0.0, oct(0.6, 0.58, 1.32)],
      [-0.8, oct(0.5, 0.5, 1.35)], [-1.3, oct(0.22, 0.22, 1.45)], [-2.4, oct(0.12, 0.12, 1.5)]] },
    { t: 'loft', ax: 'x', m: 'glass', secs: [[1.6, oct(0.18, 0.1, 1.38)], [1.25, oct(0.36, 0.2, 1.5)], [0.8, oct(0.4, 0.24, 1.6)]] },
    { t: 'box', s: [0.08, 0.3, 1.0], p: [1.2, 1.5, 0], r3: [0, 0, -30], m: 'void' },
    ...veins('z', 0.6, [[-0.7, 1.1], [-0.3, 1.4], [0.2, 1.2], [0.6, 1.45]], 0.03, { mir: true }),
    { t: 'box', s: [0.8, 0.5, 0.03], p: [-0.2, 1.25, 0.6], m: 'void', mir: true },
    // stub wings with violet-glowing rocket pods beneath
    { t: 'ext', ax: 'y', poly: [[0.45, 0.45], [0.1, 1.5], [-0.3, 1.5], [-0.35, 0.45]], d: [1.0, 1.08], m: 'void', mir: true },
    ...[0.85, 1.35].flatMap((z) => [
      { t: 'cyl', ax: 'x', r: 0.14, l: 0.7, seg: 8, p: [0.0, 0.85, z], m: 'obsid', mir: true },
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.02, seg: 8, p: [0.36, 0.85, z], m: 'glowV', mir: true },
      { t: 'cyl', ax: 'x', r: [0.14, 0.0], l: 0.3, seg: 6, p: [-0.5, 0.85, z], m: 'glowB', mir: true },
    ]),
    // chin gun, skids-free belly, tail fin
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.5, seg: 6, p: [1.7, 0.85, 0], m: 'ash' },
    { t: 'ext', ax: 'z', poly: [[0, 0], [-0.25, 0.65], [-0.5, 0.65], [-0.35, 0]], d: [-0.04, 0.04], p: [-2.3, 1.5, 0], m: 'void' },
    { t: 'cyl', ax: 'y', r: 0.1, l: 0.3, seg: 8, p: [0.15, 1.85, 0], m: 'ash' },
    // ── main rotor (spins): hub + five bat-wing membranes on dark spars ──
    { t: 'cyl', ax: 'y', r: 0.2, l: 0.12, seg: 10, p: HUB, m: 'ash', g: 'spin' },
    ...[0, 72, 144, 216, 288].flatMap((a) => [
      { t: 'ext', ax: 'y', poly: blade(a), d: [HUB[1] - 0.012, HUB[1] + 0.012], m: 'tendril', g: 'spin' },
      { t: 'box', s: [2.25, 0.05, 0.05], p: [HUB[0] + Math.cos(a * Math.PI / 180) * 1.22, HUB[1] + 0.02, HUB[2] + Math.sin(a * Math.PI / 180) * 1.22], r3: [0, -a, 0], m: 'void', g: 'spin' },
    ]),
    // ── tail rotor (spins about Z) ──
    ...[0, 120, 240].map((a) => ({ t: 'box', s: [0.5, 0.07, 0.02], p: TR, r3: [0, 0, a], m: 'void', g: 'spin2' })),
    { t: 'cyl', ax: 'z', r: 0.06, l: 0.05, seg: 6, p: TR, m: 'glowV', g: 'spin2' },
  ],
  pivots: { spin: HUB, spin2: TR }, hover: 1,
  spin: { spin: { axis: 'y', speed: 18 }, spin2: { axis: 'z', speed: 40 } },
  muzzles: [{ p: [0.38, 0.85, 0.85], d: [1, 0, 0], back: 0.2 }, { p: [0.38, 0.85, -0.85], d: [1, 0, 0], back: 0.2 }],
  views: { side: 'left', top: 'down' } };
