// src/render3d/units/dark/troops.js — DRK-Troops: Eye-shield crawler (owner concept tools/unit-models/ref/dark/dark-scout.png —
// the small tracked pod, so it carries the Troops slot; the armoured 4x4 "truck" is the Scout) [MM-story_mvifm4xj_1].
// A squat tracked pod of cracked obsidian split by violet veins, a big pale bone shield on its front bearing an eye
// sigil, fungus on the track guards, and a jointed hose-arm arching over its back to a nozzle that spits violet energy:
// the arm's base yaws (`turret`), the nozzle pitches (`barrel`).
import { DARK_COLORS, veins, fungus, eye } from './palette.js';
import { strut } from '../arcane/palette.js';
import { track } from '../prims.js';

const TPIV = [-0.7, 1.5, 0], TRUN = [0.65, 2.45, 0];

export const DARK_TROOPS = { name: 'Eye-shield crawler', unit: 'DRK-Troops', ref: 'dark_troops', colors: DARK_COLORS,
  parts: [
    ...track({ x0: -1.25, x1: 1.2, h: 0.6, z: 0.72, w: 0.46, wheels: 4, wr: 0.2, hub: 'ash' }),
    { t: 'loft', ax: 'x', m: 'obsid', mir: true, secs: [
      [-1.3, [[0.5, 0.56], [0.98, 0.56], [0.98, 0.7], [0.5, 0.74]]], [1.12, [[0.5, 0.56], [0.98, 0.56], [0.98, 0.7], [0.5, 0.74]]],
      [1.3, [[0.5, 0.42], [0.98, 0.42], [0.98, 0.54], [0.5, 0.58]]]] },
    ...fungus(-0.7, 0.72, 0.85, 3, 1.1, { mir: true }), ...fungus(0.5, 0.72, 0.8, 2, 0.9, { mir: true }),
    // the pod: a rounded obsidian hull rising toward the back
    { t: 'loft', ax: 'x', m: 'void', secs: [
      [-1.25, [[0.6, 0.6], [0.6, 1.2], [0.4, 1.45], [-0.4, 1.45], [-0.6, 1.2], [-0.6, 0.6]]],
      [-0.4, [[0.66, 0.6], [0.66, 1.35], [0.45, 1.66], [-0.45, 1.66], [-0.66, 1.35], [-0.66, 0.6]]],
      [0.6, [[0.64, 0.6], [0.64, 1.3], [0.42, 1.55], [-0.42, 1.55], [-0.64, 1.3], [-0.64, 0.6]]],
      [1.0, [[0.55, 0.6], [0.55, 1.05], [0.36, 1.25], [-0.36, 1.25], [-0.55, 1.05], [-0.55, 0.6]]]] },
    ...veins('z', 0.65, [[-1.0, 0.7], [-0.7, 1.0], [-0.75, 1.25], [-0.45, 1.5]], 0.035, { mir: true }),
    ...veins('z', 0.66, [[0.1, 0.65], [0.25, 0.95], [0.1, 1.2], [0.3, 1.45]], 0.03, { mir: true }),
    ...veins('y', 1.665, [[-1.0, -0.2], [-0.5, 0.1], [0.0, -0.05], [0.4, 0.2]]),
    // the bone shield on the front, tilted back, with the eye
    { t: 'ell', s: [0.07, 0.6, 0.5], seg: 12, p: [1.0, 1.05, 0], r3: [0, 0, 22], m: 'bone' },
    { t: 'ell', s: [0.06, 0.64, 0.54], seg: 12, p: [0.97, 1.05, 0], r3: [0, 0, 22], m: 'ash' },
    ...veins('x', 1.06, [[-0.35, 0.65], [-0.2, 0.85], [-0.3, 1.1]], 0.025),
    ...eye('x', [1.06, 1.05, 0], 1.0),
    { t: 'box', s: [0.06, 0.1, 0.9], p: [1.0, 0.58, 0], m: 'ash' },
    // ── the hose-arm (turret yaws): a socket at the back, a jointed arch over the top ──
    { t: 'cyl', ax: 'y', r: 0.2, l: 0.18, seg: 8, p: [-0.7, 1.55, 0], m: 'ash', g: 'turret' },
    strut([-0.7, 1.6, 0], [-0.55, 2.35, 0], 0.13, 0.13, 'obsid', { g: 'turret' }),
    { t: 'cyl', ax: 'z', r: 0.1, l: 0.18, seg: 8, p: [-0.55, 2.38, 0], m: 'ash', g: 'turret' },
    strut([-0.55, 2.38, 0], [0.1, 2.62, 0], 0.11, 0.11, 'obsid', { g: 'turret' }),
    { t: 'cyl', ax: 'z', r: 0.09, l: 0.16, seg: 8, p: [0.12, 2.62, 0], m: 'ash', g: 'turret' },
    strut([0.12, 2.62, 0], [0.62, 2.47, 0], 0.1, 0.1, 'obsid', { g: 'turret' }),
    ...[[-0.62, 1.95], [-0.25, 2.5], [0.38, 2.55]].map(([x, y]) => ({ t: 'box', s: [0.06, 0.16, 0.16], p: [x, y, 0], m: 'ash', g: 'turret', d: 1 })),
    // ── the nozzle (barrel pitches): a flared head with a violet throat ──
    { t: 'cyl', ax: 'x', r: [0.12, 0.08], l: 0.3, seg: 8, p: [0.8, 2.45, 0], m: 'ash', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.02, seg: 8, p: [0.955, 2.45, 0], m: 'glowV', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.0, 0.07], l: 0.3, seg: 6, p: [1.12, 2.45, 0], m: 'glowB', g: 'barrel', d: 1 },
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: -10, min: -30, max: 20, rate: 1.6 },
  muzzles: [{ p: [0.97, 2.45, 0], d: [1, 0, 0], back: 0.2, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
