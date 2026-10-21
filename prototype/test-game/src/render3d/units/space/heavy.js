// src/render3d/units/space/heavy.js — SPC-HeavyTanks: Lunar juggernaut (owner concept tools/unit-models/ref/space/space-heavy.png)
// [MM-story_mvho2d6s_5]. A massive white hull striped in federation blue on four track pods, a broad armoured turret with
// three sensor dishes and antennas on its roof, and a long heavy gun with a magenta band.
import { SPACE_COLORS, dish, beacon, whip } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.4, 1.5, 0], BPIV = [0.7, 1.85, 0];
const pod = (x0, x1) => track({ x0, x1, h: 0.8, z: 1.18, w: 0.62, wheels: 3, wr: 0.22 });

export const SPACE_HEAVY = { name: 'Lunar juggernaut', unit: 'SPC-HeavyTanks', ref: 'space_heavy', colors: SPACE_COLORS,
  parts: [
    ...pod(0.25, 2.1), ...pod(-2.15, -0.3),
    // pod housings: white boxes over each track pod with a blue band
    ...[[1.18, 1.85], [-1.22, 1.85]].flatMap(([x, l]) => [
      { t: 'box', s: [l, 0.3, 0.72], p: [x, 0.95, 1.18], m: 'lunar', mir: true },
      { t: 'box', s: [l * 0.8, 0.1, 0.02], p: [x, 0.95, 1.545], m: 'fed', mir: true },
    ]),
    // hull: tall, slab-sided, sloped glacis
    { t: 'ext', ax: 'z', poly: [[-2.1, 0.45], [-2.1, 1.45], [0.9, 1.5], [2.0, 1.05], [2.0, 0.55], [1.7, 0.45]], d: [-0.86, 0.86], m: 'lunar' },
    { t: 'box', s: [3.8, 0.14, 0.02], p: [-0.1, 1.2, 0.87], m: 'fed', mir: true },
    { t: 'box', s: [0.9, 0.14, 0.02], p: [1.45, 0.95, 0.87], r3: [0, 0, -20], m: 'fed', mir: true },
    { t: 'box', s: [0.5, 0.3, 0.02], p: [-1.4, 0.85, 0.87], m: 'lunar2', mir: true },
    { t: 'box', s: [0.02, 0.4, 1.0], p: [1.85, 1.05, 0], r3: [0, 0, 22], m: 'fed' },
    ...beacon(1.75, 1.18, 0.7), ...beacon(-2.0, 1.46, -0.7),
    // ── turret (yaws): broad armoured box, blue cheeks, three dishes, antennas ──
    { t: 'cyl', ax: 'y', r: 0.8, l: 0.12, seg: 12, p: [-0.4, 1.52, 0], m: 'gun', g: 'turret' },
    { t: 'loft', ax: 'y', m: 'lunar', g: 'turret', secs: [
      [1.55, [[0.9, -0.7], [1.15, -0.35], [1.15, 0.35], [0.9, 0.7], [-1.45, 0.78], [-1.65, 0.5], [-1.65, -0.5], [-1.45, -0.78]].map(([x, z]) => [x - 0.4, z])],
      [2.2, [[0.7, -0.6], [0.95, -0.3], [0.95, 0.3], [0.7, 0.6], [-1.35, 0.7], [-1.55, 0.45], [-1.55, -0.45], [-1.35, -0.7]].map(([x, z]) => [x - 0.4, z])]] },
    { t: 'box', s: [1.6, 0.22, 0.02], p: [-0.7, 1.85, 0.74], m: 'fed', g: 'turret', mir: true },
    { t: 'box', s: [1.8, 0.05, 1.2], p: [-0.65, 2.22, 0], m: 'lunar2', g: 'turret' },
    ...[[-1.4, -0.35], [-0.85, 0.0], [-0.3, 0.35]].flatMap(([x, z]) => dish(x, 2.24, z, 0.28, { tilt: 35, yaw: 150, mast: 0.2, extra: { g: 'turret' } })),
    whip(-1.7, 2.24, 0.5, 1.0, { g: 'turret' }), whip(-1.75, 2.24, -0.5, 0.8, { g: 'turret' }),
    ...beacon(0.2, 2.24, -0.4, 1, { g: 'turret' }),
    { t: 'box', s: [0.36, 0.5, 0.62], p: [0.55, 1.85, 0], m: 'gun', g: 'turret' },
    // ── barrel (pitches, recoils): long heavy gun with a magenta band ──
    { t: 'cyl', ax: 'x', r: [0.16, 0.2], l: 0.6, seg: 10, p: [1.0, 1.85, 0], m: 'lunar', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.11, 0.13], l: 1.8, seg: 10, p: [2.2, 1.85, 0], m: 'lunar', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.14, l: 0.32, seg: 10, p: [1.75, 1.85, 0], m: 'glowM', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.17, 0.15], l: 0.3, seg: 10, p: [3.2, 1.85, 0], m: 'gun', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.09, l: 0.02, seg: 10, p: [3.355, 1.85, 0], m: 'black', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: BPIV },
  barrel: { rest: 0, min: -6, max: 20, rate: 0.8 },
  recoil: 0.45,
  muzzles: [{ p: [3.36, 1.85, 0], d: [1, 0, 0], back: 1.0, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
