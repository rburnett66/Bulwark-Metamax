// src/render3d/units/space/artillery.js — SPC-Artillery: Mass-driver battery (owner concept tools/unit-models/ref/space/space-artillery.png)
// [MM-story_mvho2d6s_5]. A white tracked chassis that plants FOUR landing jacks at its corners before firing (deployFR/FL/
// RR/RL, like siege/artillery.js), a turret carrying a very long white mass-driver barrel lit with a row of magenta
// lights, a sensor dish, and a fan of solar fins behind. The barrel is authored level and rests raised.
import { SPACE_COLORS, dish, beacon, whip, landingJack, jackSwing } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.25, 1.1, 0], TRUN = [0.2, 1.55, 0];
const JACKS = {
  deployFR: { hinge: [1.3, 0.8, 1.15], foot: [1.75, 0.04, 1.7], stow: [-1, 0, 0] },
  deployRR: { hinge: [-1.55, 0.8, 1.15], foot: [-2.0, 0.04, 1.7], stow: [1, 0, 0] },
};
const mirJ = (J) => ({ hinge: [J.hinge[0], J.hinge[1], -J.hinge[2]], foot: [J.foot[0], J.foot[1], -J.foot[2]], stow: J.stow });
JACKS.deployFL = mirJ(JACKS.deployFR);
JACKS.deployRL = mirJ(JACKS.deployRR);

export const SPACE_ARTILLERY = { name: 'Mass-driver battery', unit: 'SPC-Artillery', ref: 'space_artillery', colors: SPACE_COLORS,
  parts: [
    ...track({ x0: -1.9, x1: 1.75, h: 0.58, z: 0.92, w: 0.44, wheels: 6, wr: 0.18 }),
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.38], [-1.95, 1.05], [1.2, 1.05], [1.8, 0.75], [1.75, 0.42], [1.4, 0.38]], d: [-0.72, 0.72], m: 'lunar' },
    { t: 'loft', ax: 'x', m: 'lunar', mir: true, secs: [
      [-1.98, [[0.7, 0.6], [1.18, 0.6], [1.18, 0.92], [0.7, 1.0]]], [1.3, [[0.7, 0.6], [1.18, 0.6], [1.18, 0.92], [0.7, 1.0]]],
      [1.8, [[0.7, 0.58], [1.12, 0.58], [1.12, 0.72], [0.7, 0.78]]]] },
    { t: 'box', s: [1.0, 0.16, 0.02], p: [0.3, 0.8, 1.19], m: 'fed', mir: true },
    { t: 'cyl', ax: 'z', r: 0.13, l: 0.02, seg: 10, p: [-0.6, 0.8, 1.19], m: 'fed', mir: true },
    ...beacon(1.3, 1.05, 0.5), ...beacon(-1.8, 1.05, -0.5),
    ...landingJack('deployFR', JACKS.deployFR), ...landingJack('deployFL', JACKS.deployFL),
    ...landingJack('deployRR', JACKS.deployRR), ...landingJack('deployRL', JACKS.deployRL),
    // ── turret (yaws): white housing, blue roundel, trunnion cheeks, dish, solar fin fan ──
    { t: 'cyl', ax: 'y', r: 0.62, l: 0.1, seg: 12, p: [-0.25, 1.1, 0], m: 'gun', g: 'turret' },
    { t: 'ext', ax: 'z', poly: [[-1.2, 1.12], [-1.2, 1.6], [-0.7, 1.82], [0.35, 1.82], [0.55, 1.12]], d: [-0.5, 0.5], m: 'lunar', g: 'turret' },
    { t: 'cyl', ax: 'z', r: 0.2, l: 0.02, seg: 10, p: [-0.35, 1.45, 0.51], m: 'fed', g: 'turret', mir: true },
    { t: 'cyl', ax: 'z', r: 0.22, l: 1.2, seg: 10, p: TRUN, m: 'gun', g: 'turret' },
    ...dish(-0.75, 1.82, 0.25, 0.24, { tilt: 30, yaw: 160, extra: { g: 'turret' } }),
    whip(-1.0, 1.82, -0.3, 0.8, { g: 'turret' }),
    ...[-35, -12, 12, 35].map((a) => ({ t: 'box', s: [0.05, 0.75, 0.42], p: [-1.45, 1.75, Math.sin(a * Math.PI / 180) * 0.55], r3: [a, 0, 15], m: 'solar', g: 'turret' })),
    ...[-35, -12, 12, 35].map((a) => ({ t: 'box', s: [0.06, 0.78, 0.04], p: [-1.45, 1.75, Math.sin(a * Math.PI / 180) * 0.55], r3: [a, 0, 15], m: 'gun', g: 'turret', d: 1 })),
    { t: 'box', s: [0.3, 0.2, 0.9], p: [-1.35, 1.3, 0], m: 'gun', g: 'turret' },
    // ── barrel (pitches): long mass-driver tube with a row of magenta lights ──
    { t: 'cyl', ax: 'x', r: [0.2, 0.24], l: 0.7, seg: 10, p: [0.4, 1.55, 0], m: 'lunar', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.12, 0.14], l: 2.6, seg: 10, p: [2.0, 1.55, 0], m: 'lunar', g: 'barrel' },
    ...[0.95, 1.3, 1.65, 2.0, 2.35, 2.7].map((x) => ({ t: 'box', s: [0.08, 0.04, 0.04], p: [x, 1.55 + 0.13, 0.04], m: 'glowM', g: 'barrel', mir: true })),
    { t: 'cyl', ax: 'x', r: 0.17, l: 0.2, seg: 10, p: [3.25, 1.55, 0], m: 'lunar2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [3.36, 1.55, 0], m: 'black', g: 'barrel' },
  ],
  pivots: { turret: TPIV, barrel: TRUN, ...Object.fromEntries(Object.entries(JACKS).map(([g, J]) => [g, J.hinge])) },
  barrel: { rest: 40, min: 20, max: 65, rate: 0.7 },
  muzzles: [{ p: [3.37, 1.55, 0], d: [1, 0, 0], back: 0.8, g: 'barrel' }],
  deploy: { groups: Object.fromEntries(Object.entries(JACKS).map(([g, J]) => [g, jackSwing(J)])), rate: 1.4 },
  views: { side: 'left', top: 'down' } };
