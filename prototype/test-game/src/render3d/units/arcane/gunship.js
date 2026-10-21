// src/render3d/units/arcane/gunship.js — ARC-Copters: Halo gunship (owner concept tools/unit-models/ref/arcane/arcane-copter.png)
// [MM-story_mvhnbx8n_4]. A bronze teardrop hull with a dark glass canopy in a pointed bronze frame, swept stub wings and
// tail vanes, three rocket nozzles trailing orange flame, lifted by a great spoked ring rotor on a short mast (group
// `spin` — the whole ring turns). Twin cannons sit under the wing roots.
import { ARCANE_COLORS, ring, archPoly } from './palette.js';

const HUB = [0.1, 2.38, 0];
const oct = (rz, ry, cy) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) / 8 * Math.PI * 2; return [Math.cos(a) * rz, cy + Math.sin(a) * ry]; });

const parts = [
  // teardrop hull: pointed nose → bulbous cabin → tapering tail
  { t: 'loft', ax: 'x', m: 'bronze', secs: [
    [1.85, oct(0.04, 0.04, 1.2)], [1.45, oct(0.3, 0.32, 1.2)], [0.9, oct(0.52, 0.55, 1.22)], [0.2, oct(0.6, 0.62, 1.24)],
    [-0.5, oct(0.52, 0.52, 1.26)], [-1.2, oct(0.32, 0.3, 1.3)], [-1.75, oct(0.16, 0.14, 1.34)]] },
  // dark iron belly band and spine strake
  { t: 'loft', ax: 'x', m: 'iron', secs: [
    [1.3, oct(0.27, 0.12, 0.92)], [0.6, oct(0.56, 0.16, 0.7)], [-0.4, oct(0.52, 0.14, 0.76)], [-1.1, oct(0.3, 0.08, 1.04)]] },
  { t: 'box', s: [2.2, 0.06, 0.08], p: [-0.35, 1.86, 0], m: 'bronze2' },
  // canopy: dark glass in a pointed bronze frame, both sides
  { t: 'ext', ax: 'z', poly: archPoly(0.32, 0.12, 1.6).map(([u, v]) => [v * 0.95, u]), d: [0.0, 0.03], p: [0.95, 1.3, 0.47], r3: [0, 18, 0], m: 'bronze', mir: true },
  { t: 'ext', ax: 'z', poly: archPoly(0.26, 0.1, 1.6).map(([u, v]) => [v * 0.95, u]), d: [0.03, 0.05], p: [1.0, 1.3, 0.47], r3: [0, 18, 0], m: 'glass', mir: true },
  { t: 'loft', ax: 'x', m: 'glass', secs: [[1.55, oct(0.1, 0.06, 1.42)], [1.2, oct(0.28, 0.2, 1.48)], [0.75, oct(0.3, 0.24, 1.56)]] },
  // bronze filigree bands around the hull
  ...[0.55, -0.25, -0.95].map((x, i) => ({ t: 'loft', ax: 'x', m: 'bronze2', secs: [[x + 0.04, oct([0.6, 0.55, 0.36][i] + 0.025, [0.61, 0.55, 0.34][i] + 0.025, 1.24 + i * 0.03)], [x - 0.04, oct([0.6, 0.55, 0.36][i] + 0.025, [0.61, 0.55, 0.34][i] + 0.025, 1.24 + i * 0.03)]] })),
  // swept stub wings with dark trailing edges
  { t: 'ext', ax: 'y', poly: [[0.6, 0.45], [-0.3, 1.25], [-0.62, 1.25], [-0.45, 0.45]], d: [1.02, 1.1], m: 'bronze', mir: true },
  { t: 'ext', ax: 'y', poly: [[-0.3, 1.25], [-0.62, 1.25], [-0.48, 0.6], [-0.36, 0.6]], d: [1.1, 1.12], m: 'iron', mir: true },
  // tail vanes: two canted down, one up
  { t: 'ext', ax: 'z', poly: [[0, 0], [-0.45, -0.55], [-0.62, -0.55], [-0.4, 0]], d: [-0.025, 0.025], p: [-1.3, 1.2, 0.18], r3: [-30, 0, 0], m: 'bronze', mir: true },
  { t: 'ext', ax: 'z', poly: [[0, 0], [-0.4, 0.5], [-0.55, 0.5], [-0.38, 0]], d: [-0.025, 0.025], p: [-1.35, 1.42, 0], m: 'bronze' },
  // three rocket nozzles at the tail, trailing flame
  ...[[0, 1.34], [0.14, 1.2], [-0.14, 1.2]].flatMap(([z, y]) => [
    { t: 'cyl', ax: 'x', r: [0.07, 0.1], l: 0.22, seg: 8, p: [-1.82, y, z], m: 'bronze2' },
    { t: 'cyl', ax: 'x', r: [0.08, 0.0], l: 0.55, seg: 7, p: [-2.2, y, z], m: 'glowF' },
    { t: 'cyl', ax: 'x', r: [0.05, 0.0], l: 0.35, seg: 6, p: [-2.08, y, z], m: 'glowR' },
  ]),
  // twin cannons under the wing roots
  ...[0.5].flatMap((z) => [
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.9, seg: 8, p: [0.55, 0.92, z], m: 'iron', mir: true },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.1, seg: 8, p: [0.3, 0.92, z], m: 'bronze', mir: true },
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 8, p: [1.01, 0.92, z], m: 'glowR', mir: true },
  ]),
  // mast + bearing
  { t: 'cyl', ax: 'y', r: [0.1, 0.16], l: 0.55, seg: 8, p: [0.1, 2.05, 0], m: 'bronze2' },
  { t: 'cyl', ax: 'y', r: 0.2, l: 0.08, seg: 10, p: [0.1, 2.3, 0], m: 'bronze' },

  // ── ring rotor (spins): rim, six spokes, hub with a finial ──
  ring('y', HUB, 1.7, 0.12, 0.09, 'bronze', { g: 'spin' }, 24),
  ring('y', [HUB[0], HUB[1] + 0.06, 0], 1.62, 0.04, 0.03, 'bronze2', { g: 'spin' }, 24),
  ...[0, 30, 60, 90, 120, 150].map((a) => ({ t: 'box', s: [3.3, 0.03, 0.12], p: HUB, r3: [0, a, 6], m: 'bronze2', g: 'spin' })),
  { t: 'cyl', ax: 'y', r: 0.2, l: 0.14, seg: 10, p: HUB, m: 'bronze2', g: 'spin' },
  { t: 'cyl', ax: 'y', r: [0, 0.08], l: 0.22, seg: 6, p: [HUB[0], HUB[1] + 0.18, 0], m: 'bronze', g: 'spin' },
];

export const ARCANE_GUNSHIP = { name: 'Halo gunship', unit: 'ARC-Copters', ref: 'arcane_gunship', colors: ARCANE_COLORS, parts,
  pivots: { spin: HUB }, hover: 1,
  spin: { spin: { axis: 'y', speed: 14 } },
  muzzles: [{ p: [1.02, 0.92, 0.5], d: [1, 0, 0], back: 0.2 }, { p: [1.02, 0.92, -0.5], d: [1, 0, 0], back: 0.2 }],
  views: { side: 'left', top: 'down' } };
