// src/render3d/units/arcane/scout.js — ARC-Trucks: Reliquary carriage (owner concept tools/unit-models/ref/arcane/arcane-truck.png)
// [MM-story_mvhnbx8n_4]. A gothic shrine-cabin on four spoked carriage wheels (bigger at the back): iron walls framed in
// bronze with glowing red arched windows, an onion dome under a wheel-cross finial, corner pinnacles, crimson banners
// streaming from the roof, and a curled bronze crook out front from which a fire censer hangs. The crook yaws (`turret`)
// and the censer pitches (`barrel`) — it is the weapon.
import { ARCANE_COLORS, archWindow, spokedWheel, ring, strut, pinnacle } from './palette.js';

const CAB = { x0: -1.25, x1: 0.55, y0: 0.95, y1: 2.15, z: 0.62 };
const TPIV = [0.62, 1.95, 0], TRUN = [1.75, 2.05, 0];

const parts = [
  // ── carriage: wheels, axles, frame ──
  ...spokedWheel([-0.85, 0.62, 0.86], 0.62, { n: 10 }),
  ...spokedWheel([1.05, 0.5, 0.86], 0.5, { n: 8 }),
  { t: 'cyl', ax: 'z', r: 0.05, l: 1.6, seg: 6, p: [-0.85, 0.62, 0], m: 'bronze2' },
  { t: 'cyl', ax: 'z', r: 0.05, l: 1.6, seg: 6, p: [1.05, 0.5, 0], m: 'bronze2' },
  { t: 'box', s: [2.6, 0.12, 0.14], p: [0.0, 0.78, 0.42], m: 'iron2', mir: true },
  { t: 'box', s: [2.0, 0.1, 1.0], p: [-0.25, 0.86, 0], m: 'iron' },
  // curled bronze leaf springs over the axles
  ...[-0.85, 1.05].map((x) => ({ t: 'ext', ax: 'z', poly: [[-0.35, 0], [0.35, 0], [0.25, 0.08], [-0.25, 0.08]], d: [0.36, 0.48], p: [x, 0.74, 0], m: 'bronze', mir: true })),

  // ── the shrine cabin ──
  { t: 'box', s: [CAB.x1 - CAB.x0, CAB.y1 - CAB.y0, CAB.z * 2], p: [(CAB.x0 + CAB.x1) / 2, (CAB.y0 + CAB.y1) / 2, 0], m: 'iron' },
  // base plinth + cornice
  { t: 'box', s: [CAB.x1 - CAB.x0 + 0.16, 0.14, CAB.z * 2 + 0.16], p: [(CAB.x0 + CAB.x1) / 2, CAB.y0 + 0.02, 0], m: 'iron2' },
  { t: 'box', s: [CAB.x1 - CAB.x0 + 0.14, 0.1, CAB.z * 2 + 0.14], p: [(CAB.x0 + CAB.x1) / 2, CAB.y1 + 0.02, 0], m: 'bronze' },
  // bronze corner pillars and a middle pillar on each side
  ...[CAB.x0, CAB.x1].map((x) => ({ t: 'box', s: [0.1, CAB.y1 - CAB.y0, 0.1], p: [x, (CAB.y0 + CAB.y1) / 2, CAB.z], m: 'bronze', mir: true })),
  { t: 'box', s: [0.08, CAB.y1 - CAB.y0 - 0.1, 0.06], p: [(CAB.x0 + CAB.x1) / 2, (CAB.y0 + CAB.y1) / 2, CAB.z + 0.01], m: 'bronze2', mir: true },
  // two glowing arched windows per side, one front, one back
  ...[-0.82, -0.08].flatMap((x) => archWindow('z', [x, CAB.y0 + 0.2, CAB.z], 0.25, 0.42, { extra: { mir: true } })),
  ...archWindow('x', [CAB.x1, CAB.y0 + 0.22, 0], 0.3, 0.38),
  ...archWindow('x', [CAB.x0, CAB.y0 + 0.22, 0], 0.3, 0.38, { out: -1, bars: false }),
  // gabled arch crests over each side window
  ...[-0.82, -0.08].map((x) => ({ t: 'ext', ax: 'z', poly: [[-0.32, 0], [0.32, 0], [0, 0.26]], d: [0, 0.05], p: [x, CAB.y1 + 0.06, CAB.z - 0.04], m: 'iron2', mir: true })),
  // ── roof: drum, onion dome, wheel-cross finial, corner pinnacles ──
  { t: 'box', s: [CAB.x1 - CAB.x0 - 0.1, 0.12, CAB.z * 2 - 0.1], p: [(CAB.x0 + CAB.x1) / 2, CAB.y1 + 0.12, 0], m: 'iron2' },
  { t: 'cyl', ax: 'y', r: 0.48, l: 0.22, seg: 10, p: [-0.35, CAB.y1 + 0.28, 0], m: 'iron' },
  { t: 'ell', s: [0.52, 0.42, 0.52], seg: 10, p: [-0.35, CAB.y1 + 0.42, 0], m: 'iron' },
  ...[0, 60, 120].map((a) => ({ t: 'ell', s: [0.535, 0.43, 0.04], seg: 10, p: [-0.35, CAB.y1 + 0.42, 0], r3: [0, a, 0], m: 'bronze', d: 1 })),
  { t: 'cyl', ax: 'y', r: [0.02, 0.14], l: 0.32, seg: 8, p: [-0.35, CAB.y1 + 0.95, 0], m: 'bronze' },
  ...spokedWheel([-0.35, CAB.y1 + 1.33, 0], 0.24, { n: 8, w: 0.05, rim: 'bronze', spoke: 'bronze', hub: 'bronze2', mir: false }),
  { t: 'cyl', ax: 'y', r: [0, 0.04], l: 0.22, seg: 4, p: [-0.35, CAB.y1 + 1.66, 0], m: 'bronze' },
  ...[[CAB.x0, CAB.z], [CAB.x1, CAB.z]].flatMap(([x, z]) => pinnacle(x, CAB.y1 + 0.06, z, 0.45, 0.07, 'bronze', { mir: true })),
  // ── crimson banners streaming back from the roof (three per side, tattered tips) ──
  ...[0, 1, 2].flatMap((i) => [
    { t: 'ext', ax: 'z', poly: [[0, 0], [-1.1 - i * 0.25, -0.25 - i * 0.18], [-1.25 - i * 0.25, -0.45 - i * 0.18], [-1.0 - i * 0.25, -0.38 - i * 0.18], [0, -0.22]],
      d: [-0.012, 0.012], p: [CAB.x0 + 0.05, CAB.y1 + 0.05 - i * 0.18, CAB.z + 0.05 + i * 0.04], r3: [0, -8 - i * 6, 0], m: 'cloth', mir: true },
  ]),
  { t: 'cyl', ax: 'z', r: 0.03, l: 1.5, seg: 6, p: [CAB.x0 + 0.02, CAB.y1 + 0.08, 0], m: 'bronze2' },

  // ── crook + censer: the crook yaws (turret), the censer swings (barrel) ──
  { t: 'cyl', ax: 'y', r: 0.08, l: 0.12, seg: 8, p: [0.62, 1.9, 0], m: 'bronze2', g: 'turret' },
  strut([0.62, 1.92, 0], [1.25, 2.3, 0], 0.07, 0.07, 'bronze', { g: 'turret' }),
  strut([1.25, 2.3, 0], [1.68, 2.36, 0], 0.07, 0.07, 'bronze', { g: 'turret' }),
  ring('z', [1.78, 2.24, 0], 0.13, 0.05, 0.06, 'bronze', { g: 'turret' }, 10),
  { t: 'cyl', ax: 'y', r: 0.015, l: 0.35, seg: 4, p: [1.75, 2.1, 0], m: 'dark', g: 'barrel' },
  { t: 'cyl', ax: 'y', r: [0.06, 0.17], l: 0.14, seg: 8, p: [1.75, 1.86, 0], m: 'bronze', g: 'barrel' },
  { t: 'cyl', ax: 'y', r: 0.17, l: 0.22, seg: 8, p: [1.75, 1.68, 0], m: 'bronze2', g: 'barrel' },
  { t: 'cyl', ax: 'y', r: 0.175, l: 0.12, seg: 8, p: [1.75, 1.66, 0], m: 'glowR', g: 'barrel' },
  { t: 'cyl', ax: 'y', r: [0.17, 0.04], l: 0.18, seg: 8, p: [1.75, 1.48, 0], m: 'bronze', g: 'barrel' },
  { t: 'cyl', ax: 'x', r: [0.0, 0.12], l: 0.35, seg: 7, p: [1.98, 1.66, 0], m: 'glowF', g: 'barrel' },
];

export const ARCANE_SCOUT = { name: 'Reliquary carriage', unit: 'ARC-Trucks', ref: 'arcane_scout', colors: ARCANE_COLORS,
  parts, pivots: { turret: TPIV, barrel: TRUN },
  barrel: { rest: 0, min: -10, max: 20, rate: 1.6 },
  muzzles: [{ p: [2.16, 1.66, 0], d: [1, 0, 0], back: 0.3, g: 'barrel' }],
  views: { side: 'left', top: 'down' } };
