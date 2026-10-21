// src/render3d/units/arcane/troops.js — ARC-Troops: Pyre shrine (owner concept tools/unit-models/ref/arcane/arcane-troop.png,
// updated 2026-10-20) [MM-story_mvhnbx8n_4]. A small tracked shrine: a blackened iron dome ribbed in bronze, sitting straight
// down between its tracks, a glowing red stained-glass arch on its nose, a brazier crest under a dripping halo, a hooded
// rider in a high bronze seat, and a heavy ringed flame cannon low on the front, off to the left under the arch. The cannon
// mount is the `turret` (yaw) and its barrel the `barrel` (pitch).
import { ARCANE_COLORS, shrineBody } from './palette.js';
import { track } from '../prims.js';

const Y0 = 0.55, GZ = -0.34, GY = 0.6;   // flame cannon: left of centre, low
const TPIV = [0.9, GY, GZ], TRUN = [1.0, GY, GZ];

export const ARCANE_TROOPS = { name: 'Pyre shrine', unit: 'ARC-Troops', ref: 'arcane_troops', colors: ARCANE_COLORS,
  parts: [
    ...track({ x0: -1.25, x1: 1.2, h: 0.6, z: 0.74, w: 0.44, wheels: 4, wr: 0.2, hub: 'bronze' }),
    // bronze-edged track guards
    { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
      [-1.3, [[0.52, 0.54], [0.98, 0.54], [0.98, 0.66], [0.52, 0.7]]],
      [1.15, [[0.52, 0.54], [0.98, 0.54], [0.98, 0.66], [0.52, 0.7]]],
      [1.3, [[0.52, 0.42], [0.98, 0.42], [0.98, 0.54], [0.52, 0.56]]]] },
    { t: 'box', s: [2.5, 0.04, 0.04], p: [0, 0.66, 0.99], m: 'bronze', mir: true },
    ...shrineBody(Y0),

    // ── flame cannon (turret yaws on a low mount; barrel pitches): a thick ringed tube with a flared muzzle ──
    { t: 'cyl', ax: 'y', r: 0.24, l: 0.16, seg: 8, p: [0.9, GY - 0.12, GZ], m: 'bronze2', g: 'turret' },
    { t: 'box', s: [0.4, 0.34, 0.44], p: [0.95, GY, GZ], m: 'iron2', g: 'turret' },
    { t: 'cyl', ax: 'x', r: [0.17, 0.2], l: 0.7, seg: 10, p: [1.4, GY, GZ], m: 'iron', g: 'barrel' },
    ...[1.15, 1.32, 1.5, 1.68].map((x) => ({ t: 'cyl', ax: 'x', r: 0.22, l: 0.07, seg: 10, p: [x, GY, GZ], m: 'bronze', g: 'barrel' })),
    { t: 'cyl', ax: 'x', r: [0.24, 0.17], l: 0.3, seg: 10, p: [1.9, GY, GZ], m: 'bronze2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.02, seg: 10, p: [2.055, GY, GZ], m: 'glowR', g: 'barrel' },
    { t: 'cyl', ax: 'z', r: 0.08, l: 0.5, seg: 6, p: [1.25, GY, GZ], m: 'bronze2', g: 'barrel', d: 1 },
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -8, max: 20, rate: 1.6 },
  muzzles: [{ p: [2.07, GY, GZ], d: [1, 0, 0], back: 0.5, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
