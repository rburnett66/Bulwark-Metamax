// src/render3d/units/siege/troops.js — ART-Troops: Mortar carrier (owner concept tools/unit-models/ref/siege/siege-mortar.png)
// [MM-story_mvhb6qd2_2]. A small tracked carrier: boxy dusty-tan hull with bolted side skirts and yellow stencils, camo
// netting draped over the front half, a row of sandbags across the deck, ammo crates stacked at the rear, a helmeted
// crewman sitting beside a big short mortar tube on a rotating base. The mount is the `turret` (yaw) and the tube the
// `barrel` (authored level along +X from its trunnion; it rests steeply raised, unitBarrels.js applies the pitch).
import { SIEGE_COLORS } from './palette.js';
import { track } from '../prims.js';

const TPIV = [-0.45, 1.05, 0];   // mortar base ring
const TRUN = [-0.45, 1.42, 0];   // tube trunnion

// netting section across the hull (z, y): a lumpy cap that sags down the sides
const netSec = (w, top, sag, bump = 0) => [[-w, sag], [-w * 0.8, top - 0.12 + bump], [-w * 0.35, top + bump * 0.6], [0, top - 0.04], [w * 0.4, top + bump], [w * 0.82, top - 0.1], [w, sag], [w * 0.5, sag + 0.05], [-w * 0.5, sag + 0.05]];

const parts = [
  // ── running gear ──
  ...track({ x0: -1.85, x1: 1.75, h: 0.62, z: 0.8, w: 0.42, wheels: 5, wr: 0.2 }),
  // ── hull: boxy, sloped glacis at the front, flat deck ──
  { t: 'ext', ax: 'z', poly: [[-1.9, 0.32], [-1.9, 1.0], [1.15, 1.0], [1.85, 0.66], [1.75, 0.32]], d: [-0.62, 0.62], m: 'olive' },
  { t: 'box', s: [0.06, 0.3, 1.26], p: [1.79, 0.55, 0], r3: [0, 0, 28], m: 'olive' },
  // bolted side skirts over the tracks (olive patches, yellow stencils)
  { t: 'ext', ax: 'z', poly: [[-1.85, 0.5], [-1.85, 0.98], [1.2, 0.98], [1.6, 0.72], [1.6, 0.5]], d: [1.0, 1.08], m: 'olive', mir: true },
  ...[-1.35, -0.55, 0.25].map((x) => ({ t: 'box', s: [0.5, 0.3, 0.02], p: [x, 0.74, 1.09], m: 'dark', mir: true, d: 1 })),
  ...[-1.1, -0.3].map((x) => ({ t: 'box', s: [0.22, 0.05, 0.02], p: [x, 0.84, 1.095], m: 'hazard', mir: true })),
  { t: 'box', s: [1.9, 0.04, 0.03], p: [-0.35, 0.99, 1.08], m: 'olive', mir: true },
  // rear plate + stowage boxes
  { t: 'box', s: [0.06, 0.5, 1.1], p: [-1.92, 0.75, 0], m: 'olive' },
  { t: 'box', s: [0.3, 0.26, 0.36], p: [-1.7, 1.13, -0.42], m: 'net' },
  // ── camo netting draped over the front half ──
  { t: 'loft', ax: 'x', m: 'net', secs: [
    [1.8, netSec(0.82, 0.86, 0.52, 0.02)], [1.35, netSec(1.1, 1.12, 0.48, 0.08)], [0.75, netSec(1.14, 1.2, 0.5, 0.12)],
    [0.2, netSec(1.12, 1.16, 0.55, 0.05)], [-0.05, netSec(1.0, 1.06, 0.8, 0.02)]] },
  { t: 'ell', s: [0.32, 0.12, 0.26], seg: 6, p: [1.0, 1.24, -0.5], m: 'net', d: 1 },
  { t: 'ell', s: [0.28, 0.1, 0.24], seg: 6, p: [0.45, 1.24, 0.55], m: 'net', d: 1 },
  // ── sandbags across the deck behind the net ──
  ...[-0.55, -0.25, 0.05, 0.35].map((z, i) => ({ t: 'ell', s: [0.16, 0.1, 0.13], seg: 5, p: [-0.2, 1.08, z * 1.6], r3: [0, 8 * i, 0], m: 'net' })),
  // ── ammo crates stacked at the rear right ──
  { t: 'box', s: [0.5, 0.3, 0.42], p: [-1.35, 1.15, 0.32], m: 'olive' },
  { t: 'box', s: [0.42, 0.26, 0.36], p: [-1.3, 1.43, 0.3], r3: [0, 12, 0], m: 'olive' },
  { t: 'box', s: [0.06, 0.04, 0.3], p: [-1.1, 1.3, 0.32], m: 'hazard', d: 1 },
  // ── crewman sitting beside the mortar (near side) ──
  { t: 'box', s: [0.34, 0.12, 0.3], p: [0.12, 1.1, -0.42], m: 'dark' },                     // seat / legs
  { t: 'box', s: [0.24, 0.34, 0.28], p: [0.05, 1.32, -0.42], r3: [0, 0, -8], m: 'olive' },   // torso
  { t: 'ell', s: [0.1, 0.11, 0.1], seg: 6, p: [0.06, 1.58, -0.42], m: 'camo' },             // face
  { t: 'ell', s: [0.15, 0.09, 0.15], seg: 6, half: true, p: [0.05, 1.62, -0.42], m: 'olive' }, // helmet
  { t: 'box', s: [0.28, 0.08, 0.08], p: [-0.1, 1.33, -0.26], r3: [0, -20, -30], m: 'olive' },  // arm toward the tube

  // ── mortar mount (yaws): base ring, bipod yoke ──
  { t: 'cyl', ax: 'y', r: [0.36, 0.42], l: 0.12, seg: 10, p: [-0.45, 1.06, 0], m: 'olive', g: 'turret' },
  { t: 'box', s: [0.24, 0.36, 0.08], p: [-0.45, 1.28, 0.24], m: 'dark', g: 'turret', mir: true },
  { t: 'box', s: [0.08, 0.4, 0.08], p: [-0.2, 1.24, 0.18], r3: [0, 0, 25], m: 'metal', g: 'turret', mir: true, d: 1 },

  // ── mortar tube (pitches about TRUN): fat short tube, muzzle ring, breech ball ──
  { t: 'cyl', ax: 'z', r: 0.12, l: 0.42, seg: 8, p: TRUN, m: 'dark', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: [0.2, 0.18], l: 1.35, seg: 10, p: [0.15, 1.42, 0], m: 'dark', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.25, l: 0.14, seg: 10, p: [0.82, 1.42, 0], m: 'metal', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.15, l: 0.02, seg: 10, p: [0.9, 1.42, 0], m: 'black', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: 0.22, l: 0.08, seg: 10, p: [-0.05, 1.42, 0], m: 'metal', g: 'barrel', d: 1 },
  { t: 'ell', s: [0.2, 0.2, 0.2], seg: 6, p: [-0.5, 1.42, 0], m: 'dark', g: 'barrel' },
];

export const SIEGE_TROOPS = { name: 'Mortar carrier', unit: 'ART-Troops', ref: 'siege_troops', colors: SIEGE_COLORS,
  parts, pivots: { turret: TPIV, barrel: TRUN },
  // a mortar lobs: it idles steeply raised and never fires flat
  barrel: { rest: 55, min: 40, max: 75, rate: 1.0 },
  muzzles: [{ p: [0.92, 1.42, 0], d: [1, 0, 0], back: 0.9 }], views: { side: 'right', top: 'down' } };
