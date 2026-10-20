// src/render3d/units/air/troops.js — AIR-Troops: Skimmer trike (owner concept tools/unit-models/ref/air/air-troops.png)
// [MM-story_mvh8woji_1]. A plane-fuselage kart on four wheels: round nose intake with twin guns under it, swept stub
// wings with red tips, a pink-badged tail fin, and the ace in an open cockpit — goggles, navy hair, a long pink scarf
// streaming back. The twin nose guns are the `turret` (yaw) + `barrel` (pitch) groups.
import { AIR_COLORS } from './palette.js';

const ring = (r, y0, cz = 0, n = 8, sy = 1) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + Math.PI / n;
  return [cz + Math.cos(a) * r, y0 + Math.sin(a) * r * sy];
});
// a box from a to b (a scarf ribbon segment), width w across, thickness h
const seg = (a, b, w, h, m, extra = {}) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) * 180 / Math.PI, pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  return Object.assign({ t: 'box', s: [L + 0.06, h, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m }, extra);
};
const SCARF = [[-0.32, 1.92, 0.14], [-0.8, 2.02, 0.32], [-1.25, 2.12, 0.18], [-1.7, 2.3, 0.42], [-2.1, 2.46, 0.26]];   // zig-zag: it flutters
const wheel = (x, z, r, w) => [
  { t: 'cyl', ax: 'z', r, l: w, seg: 12, p: [x, r, z], m: 'black', mir: true },
  { t: 'cyl', ax: 'z', r: r * 0.55, l: w + 0.04, seg: 10, p: [x, r, z], m: 'metal', mir: true },
  { t: 'cyl', ax: 'z', r: r * 0.2, l: w + 0.07, seg: 6, p: [x, r, z], m: 'dark', mir: true },
];

const parts = [
  // fuselage: round intake nose → fat cockpit bay → tapering tail cone
  { t: 'loft', ax: 'x', secs: [
    [1.95, ring(0.32, 0.72, 0, 8, 0.95)],
    [1.6, ring(0.42, 0.74, 0, 8, 0.95)],
    [0.8, ring(0.5, 0.78, 0, 8, 0.9)],
    [-0.4, ring(0.52, 0.8, 0, 8, 0.85)],
    [-1.3, ring(0.36, 0.86, 0, 8, 0.85)],
    [-1.95, ring(0.18, 0.95, 0, 8, 0.9)]], m: 'paint' },
  // intake mouth + fan
  { t: 'cyl', ax: 'x', r: 0.28, l: 0.06, seg: 12, p: [1.97, 0.72, 0], m: 'dark' },
  { t: 'cyl', ax: 'x', r: 0.2, l: 0.04, seg: 10, p: [2.0, 0.72, 0], m: 'black' },
  // red cheek flash + navy belly stripe
  { t: 'box', s: [0.7, 0.05, 0.02], p: [1.05, 0.66, 0.47], r3: [0, 0, -8], m: 'red', mir: true },
  { t: 'box', s: [2.4, 0.12, 0.04], p: [-0.1, 0.52, 0.47], r3: [0, 0, 2], m: 'navy', mir: true },
  { t: 'box', s: [2.6, 0.1, 0.8], p: [-0.2, 0.34, 0], m: 'navy' },
  // cockpit cut: dark tub, seat back, roundel
  { t: 'box', s: [0.95, 0.12, 0.62], p: [-0.15, 1.36, 0], m: 'black' },
  { t: 'box', s: [0.14, 0.62, 0.5], p: [-0.68, 1.55, 0], r3: [0, 0, 12], m: 'navy' },
  { t: 'cyl', ax: 'z', r: 0.09, l: 0.02, seg: 10, p: [1.0, 0.95, 0.42], m: 'red', mir: true, d: 1 },
  // swept stub wings (red tips) at mid body
  { t: 'ext', ax: 'y', poly: [[0.55, 0.4], [-0.35, 0.4], [-0.7, 1.75], [-0.35, 1.75]], d: [0.9, 0.97], m: 'paint', mir: true },
  { t: 'ext', ax: 'y', poly: [[-0.35, 1.62], [-0.68, 1.62], [-0.7, 1.75], [-0.35, 1.75]], d: [0.885, 0.985], m: 'red', mir: true },
  // tailplanes + fin with pink badge and red cap
  { t: 'ext', ax: 'y', poly: [[-1.25, 0.15], [-1.75, 0.15], [-1.95, 0.85], [-1.7, 0.85]], d: [0.95, 1.0], m: 'paint', mir: true },
  { t: 'ext', ax: 'z', poly: [[-1.05, 1.1], [-1.95, 1.1], [-1.98, 1.95], [-1.72, 1.95]], d: [-0.05, 0.05], m: 'paint' },
  { t: 'ext', ax: 'z', poly: [[-1.68, 1.82], [-1.98, 1.82], [-1.98, 1.95], [-1.72, 1.95]], d: [-0.06, 0.06], m: 'red' },
  { t: 'cyl', ax: 'z', r: 0.11, l: 0.13, seg: 8, p: [-1.62, 1.5, 0], m: 'pink' },
  // axles + four wheels
  { t: 'box', s: [0.12, 0.1, 2.0], p: [1.25, 0.36, 0], m: 'dark' },
  { t: 'box', s: [0.12, 0.1, 2.1], p: [-1.15, 0.38, 0], m: 'dark' },
  ...wheel(1.25, 0.95, 0.36, 0.3), ...wheel(-1.15, 1.05, 0.38, 0.32),
  // the pilot: white suit torso, arms to the wheel, navy hair, goggles
  { t: 'box', s: [0.42, 0.55, 0.5], p: [-0.3, 1.62, 0], m: 'paint' },
  { t: 'box', s: [0.12, 0.2, 0.5], p: [-0.12, 1.66, 0], m: 'navy', d: 1 },
  { t: 'box', s: [0.5, 0.13, 0.13], p: [0.0, 1.6, 0.26], r3: [0, 0, -18], m: 'paint', mir: true },
  { t: 'cyl', ax: 'z', r: 0.16, l: 0.04, seg: 10, p: [0.32, 1.56, 0], r3: [0, 0, 0], m: 'black' },
  { t: 'ell', s: [0.22, 0.24, 0.22], seg: 10, p: [-0.3, 2.08, 0], m: 'paint2' },
  { t: 'ell', s: [0.25, 0.18, 0.25], seg: 10, p: [-0.34, 2.2, 0], m: 'navy' },
  { t: 'box', s: [0.06, 0.09, 0.36], p: [-0.1, 2.12, 0], m: 'black' },
  { t: 'cyl', ax: 'x', r: 0.06, l: 0.04, seg: 8, p: [-0.07, 2.12, 0.1], m: 'glass', mir: true },
  // the long pink scarf streaming back and up
  { t: 'box', s: [0.3, 0.12, 0.5], p: [-0.35, 1.88, 0], m: 'pink' },
  ...SCARF.slice(1).map((b, i) => seg(SCARF[i], b, 0.1, 0.26 - i * 0.03, 'pink')),
  // twin nose guns under the intake: mount (yaws) + barrels (pitch)
  { t: 'box', s: [0.3, 0.16, 0.36], p: [1.62, 0.36, 0], m: 'dark', g: 'turret' },
  { t: 'cyl', ax: 'x', r: 0.045, l: 0.55, seg: 6, p: [2.0, 0.36, 0.1], m: 'metal', g: 'barrel', mir: true },
  { t: 'cyl', ax: 'x', r: 0.06, l: 0.08, seg: 6, p: [2.26, 0.36, 0.1], m: 'black', g: 'barrel', mir: true },
];

export const AIR_TROOPS = { name: 'Skimmer trike', unit: 'AIR-Troops', ref: 'air_troops', colors: AIR_COLORS,
  parts, pivots: { turret: [1.62, 0.3, 0], barrel: [1.72, 0.36, 0] },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.6 },
  muzzles: [0.1, -0.1].map((z) => ({ p: [2.3, 0.36, z], d: [1, 0, 0], back: 0.6 })), views: { side: 'right', top: 'down' } };
