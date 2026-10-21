// src/render3d/units/space/troops.js — SPC-Troops: Bubble trooper (owner concept tools/unit-models/ref/space/space-troop.png)
// [MM-story_mvho2d6s_5]. A small tracked crew carrier in two steps: a low front deck carrying a glass bubble cockpit, set
// in front of a taller rear body (owner 2026-10-20: "the cockpit should sit in front of the rear body, not on top of it",
// and lower), which carries the blue roundel and pinstripes, a gold-foil stores box, antennas and a beacon. A short coil
// gun sits on a small dark base on the deck just ahead of the cockpit ("a small dark base just in front of the cockpit")
// — the base yaws (turret), the gun pitches (barrel).
import { SPACE_COLORS, beacon, whip, coilBarrel } from './palette.js';
import { track } from '../prims.js';

const DECK = 0.8;                                   // front deck height
const TPIV = [0.92, DECK, 0.12], TRUN = [0.98, DECK + 0.2, 0.12];
const CK = [0.22, DECK + 0.04, 0];                  // cockpit bubble centre (its lower half sits in the collar)

export const SPACE_TROOPS = { name: 'Bubble trooper', unit: 'SPC-Troops', ref: 'space_troops', colors: SPACE_COLORS,
  parts: [
    ...track({ x0: -1.3, x1: 1.2, h: 0.55, z: 0.7, w: 0.42, wheels: 4, wr: 0.18 }),
    // lower hull with a chamfered nose — its top is the low front deck
    { t: 'ext', ax: 'z', poly: [[-1.35, 0.35], [-1.35, DECK], [1.05, DECK], [1.32, 0.62], [1.28, 0.45], [1.0, 0.35]], d: [-0.6, 0.6], m: 'lunar' },
    { t: 'loft', ax: 'x', m: 'lunar', mir: true, secs: [
      [-1.35, [[0.5, 0.56], [0.94, 0.56], [0.94, 0.72], [0.5, 0.78]]], [1.1, [[0.5, 0.56], [0.94, 0.56], [0.94, 0.72], [0.5, 0.78]]],
      [1.3, [[0.5, 0.44], [0.94, 0.44], [0.94, 0.56], [0.5, 0.6]]]] },
    { t: 'box', s: [1.6, 0.03, 0.02], p: [-0.3, 0.66, 0.95], m: 'fed', mir: true },
    { t: 'box', s: [0.3, 0.12, 0.02], p: [1.05, 0.66, 0.61], m: 'dark', mir: true, d: 1 },
    // the taller rear body, its front face raked back behind the cockpit
    { t: 'ext', ax: 'z', poly: [[-1.4, DECK - 0.02], [-1.4, 1.4], [-0.6, 1.46], [-0.3, 1.36], [-0.12, 1.08], [-0.1, DECK - 0.02]], d: [-0.56, 0.56], m: 'lunar' },
    { t: 'box', s: [1.0, 0.06, 0.9], p: [-0.95, 1.46, 0], m: 'lunar2' },
    ...[1.06, 1.14].map((y) => ({ t: 'box', s: [1.1, 0.025, 0.02], p: [-0.75, y, 0.565], m: 'fed', mir: true })),
    { t: 'cyl', ax: 'z', r: 0.17, l: 0.02, seg: 12, p: [-0.4, 1.0, 0.565], m: 'fed', mir: true },
    { t: 'cyl', ax: 'z', r: 0.08, l: 0.025, seg: 10, p: [-0.4, 1.0, 0.565], m: 'lunar', mir: true },
    // glass bubble cockpit on the deck, in front of the rear body: gunmetal collar, seat inside
    { t: 'cyl', ax: 'y', r: [0.46, 0.5], l: 0.12, seg: 14, p: [CK[0], DECK + 0.04, 0], m: 'gun' },
    { t: 'ell', s: [0.48, 0.42, 0.44], seg: 12, p: CK, m: 'glass' },
    { t: 'box', s: [0.22, 0.34, 0.3], p: [CK[0] - 0.15, DECK + 0.2, 0], m: 'dark', d: 1 },
    // gold foil stores box on the rear body's right flank, antennas, beacons
    { t: 'box', s: [0.45, 0.36, 0.14], p: [-0.95, 1.1, 0.62], m: 'foil' },
    whip(-1.15, 1.48, -0.35, 1.0), whip(-1.3, 1.48, 0.3, 0.7), whip(-1.25, 1.48, 0.15, 0.55),
    ...beacon(-0.45, 1.42, -0.15, 1.3),
    // ── coil gun on its small dark base, on the deck ahead of the cockpit ──
    { t: 'cyl', ax: 'y', r: 0.14, l: 0.1, seg: 8, p: [0.92, DECK + 0.05, 0.12], m: 'dark', g: 'turret' },
    { t: 'box', s: [0.22, 0.14, 0.18], p: [0.95, DECK + 0.16, 0.12], m: 'dark', g: 'turret' },
    ...coilBarrel(0.98, 1.95, DECK + 0.2, 0.12, 0.055, { coils: 6, c0: 0.25, c1: 0.75, extra: { g: 'barrel' } }),
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.6 },
  muzzles: [{ p: [1.96, DECK + 0.2, 0.12], d: [1, 0, 0], back: 0.4, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
