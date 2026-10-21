// src/render3d/units/arcane/troops.js — ARC-Troops: Pyre shrine (owner concept tools/unit-models/ref/arcane/arcane-troop.png)
// [MM-story_mvhnbx8n_4]. A small tracked shrine: a blackened iron dome ribbed in bronze with a glowing red stained-glass arch
// on its nose, a brazier crest under a dripping halo, a hooded rider in a high bronze seat, and a heavy segmented flame
// cannon low on the front. The cannon mount is the `turret` (yaw) and its barrel the `barrel` (pitch).
import { ARCANE_COLORS, shrineBody } from './palette.js';
import { track } from '../prims.js';

const Y0 = 0.55, TPIV = [1.0, 0.62, 0], TRUN = [1.08, 0.62, 0];

export const ARCANE_TROOPS = { name: 'Pyre shrine', unit: 'ARC-Troops', ref: 'arcane_troops', colors: ARCANE_COLORS,
  parts: [
    ...track({ x0: -1.25, x1: 1.2, h: 0.55, z: 0.68, w: 0.4, wheels: 4, wr: 0.18, hub: 'bronze' }),
    // bronze track guards with a filigree edge
    { t: 'loft', ax: 'x', m: 'iron2', mir: true, secs: [
      [-1.3, [[0.48, 0.5], [0.9, 0.5], [0.9, 0.62], [0.48, 0.66]]],
      [1.15, [[0.48, 0.5], [0.9, 0.5], [0.9, 0.62], [0.48, 0.66]]],
      [1.3, [[0.48, 0.38], [0.9, 0.38], [0.9, 0.5], [0.48, 0.52]]]] },
    { t: 'box', s: [2.5, 0.04, 0.04], p: [0, 0.62, 0.91], m: 'bronze', mir: true },
    ...shrineBody(Y0),

    // ── flame cannon (turret yaws on a low mount under the window; barrel pitches) ──
    { t: 'cyl', ax: 'y', r: 0.2, l: 0.14, seg: 8, p: [1.0, 0.5, 0], m: 'bronze2', g: 'turret' },
    { t: 'box', s: [0.3, 0.26, 0.4], p: [1.05, 0.62, 0], m: 'iron2', g: 'turret' },
    { t: 'cyl', ax: 'x', r: [0.15, 0.17], l: 0.5, seg: 10, p: [1.38, 0.62, 0], m: 'iron', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.19, l: 0.08, seg: 10, p: [1.2, 0.62, 0], m: 'bronze', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.18, l: 0.08, seg: 10, p: [1.48, 0.62, 0], m: 'bronze', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: [0.21, 0.15], l: 0.28, seg: 10, p: [1.76, 0.62, 0], m: 'bronze2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.02, seg: 10, p: [1.905, 0.62, 0], m: 'glowR', g: 'barrel' },
    { t: 'cyl', ax: 'z', r: 0.07, l: 0.46, seg: 6, p: [1.3, 0.62, 0], m: 'bronze2', g: 'barrel', d: 1 },
  ],
  pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -8, max: 20, rate: 1.6 },
  muzzles: [{ p: [1.92, 0.62, 0], d: [1, 0, 0], back: 0.5, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
