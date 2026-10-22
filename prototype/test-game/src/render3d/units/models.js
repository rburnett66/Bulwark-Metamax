// src/render3d/units/models.js — the four owner-approved unit models as part lists (owner 2026-10-13: "All of
// them are perfect"). Data + the track() helper only; geometry is built by prims.js createPrims(THREE).
// [MM-story_mv77hv5d_7]
// Unit models built from primitives. X forward, Y up, Z right; hull ≈ 4 units long; ground at Y = 0.
import { track } from './prims.js';
import { SYSTEM_MODELS, SYSTEM_COLORS } from '../structures/systemModels.js';
import { AIR_MODELS } from './air/index.js';
import { SIEGE_MODELS } from './siege/index.js';
import { ARCANE_MODELS } from './arcane/index.js';
import { SPACE_MODELS } from './space/index.js';
import { DARK_MODELS } from './dark/index.js';

const sec = (P, sx, sz, dx = 0, dz = 0) => P.map(([x, z]) => [x * sx + dx, z * sz + dz]);
const M = {};

// ── TANK "Twin-barrel MBT" ────────────────────────────────────────────────────────────────────────────
{
  const TUR = [[-1.62, -0.85], [-1.2, -1.05], [0.15, -1.15], [0.75, -0.68], [0.95, -0.45], [0.95, 0.45], [0.75, 0.68], [0.15, 1.15], [-1.2, 1.05], [-1.62, 0.85]];
  const TUR_TOP = TUR.map(([x, z]) => [x < 0.2 ? x : 0.2 + (x - 0.2) * 0.4, z * 0.8]);
  const parts = [
    ...track({ x0: -1.95, x1: 1.85, h: 0.64, z: 1.12, w: 0.52, wheels: 6, wr: 0.2 }),
    // hull centre + side skirts (side profiles extruded across Z)
    { t: 'ext', ax: 'z', poly: [[-1.95, 0.35], [-1.95, 1.22], [1.3, 1.22], [2.0, 0.78], [1.85, 0.6], [1.4, 0.35]], d: [-0.86, 0.86], m: 'hull' },
    // side skirts: lofted along X so the upper outer edge is chamfered and the nose tapers
    { t: 'loft', ax: 'x', secs: [
      [-1.98, [[0.86, 0.5], [1.46, 0.5], [1.46, 1.0], [1.28, 1.22], [0.86, 1.22]]],
      [1.42, [[0.86, 0.5], [1.46, 0.5], [1.46, 1.0], [1.28, 1.22], [0.86, 1.22]]],
      [1.94, [[0.86, 0.78], [1.42, 0.78], [1.42, 0.88], [1.3, 0.94], [0.86, 0.94]]]], m: 'hull', mir: true },
    // front glacis V + lower plate
    { t: 'ext', ax: 'z', poly: [[1.5, 1.1], [1.9, 0.83], [1.96, 0.78], [1.62, 1.05]], d: [-0.3, 0.3], m: 'dark' },
    { t: 'box', s: [0.05, 0.3, 0.9], p: [1.62, 0.5, 0], m: 'hull2' },
    { t: 'box', s: [0.04, 0.09, 0.26], p: [1.86, 0.72, 0.46], r3: [0, 0, 0], m: 'dark', mir: true },
    { t: 'box', s: [0.04, 0.05, 0.36], p: [1.71, 0.92, 0], m: 'dark' },
    { t: 'cyl', ax: 'x', r: 0.09, l: 0.06, seg: 10, p: [1.84, 0.58, 0.5], m: 'dark', mir: true },
    { t: 'box', s: [0.04, 0.045, 0.34], p: [1.93, 0.86, 1.18], m: 'glow', mir: true },
    { t: 'box', s: [0.04, 0.035, 0.18], p: [1.75, 0.98, 0.62], m: 'glow', mir: true },
    // hull side greebles + glow strips
    { t: 'box', s: [0.55, 0.03, 0.02], p: [0.55, 0.72, 1.465], m: 'glow', mir: true },
    { t: 'box', s: [0.7, 0.03, 0.02], p: [-0.5, 0.98, 1.465], m: 'glow', mir: true },
    { t: 'box', s: [0.25, 0.12, 0.03], p: [-1.2, 0.92, 1.47], m: 'dark', mir: true },
    { t: 'box', s: [0.3, 0.09, 0.03], p: [-0.2, 1.08, 1.47], m: 'dark', mir: true },
    { t: 'box', s: [0.18, 0.1, 0.03], p: [1.1, 0.98, 1.47], m: 'dark', mir: true },
    // rear plate
    { t: 'box', s: [0.05, 0.42, 0.62], p: [-1.97, 0.86, 0], m: 'hull2' },
    { t: 'box', s: [0.04, 0.16, 0.36], p: [-2.0, 0.98, 1.16], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.07, l: 0.05, seg: 10, p: [-1.99, 0.52, 0.5], m: 'glow', mir: true },
    { t: 'box', s: [0.5, 0.025, 0.5], p: [-1.65, 1.23, 0], m: 'dark' },
    // turret (lofted hex body, three horizontal sections)
    { t: 'cyl', ax: 'y', r: 0.85, l: 0.1, seg: 12, p: [-0.35, 1.26, 0], m: 'dark', g: 'turret' },
    { t: 'loft', ax: 'y', secs: [[1.28, sec(TUR, 0.95, 0.82, -0.03)], [1.52, TUR], [1.86, TUR_TOP]], m: 'hull', g: 'turret' },
    { t: 'box', s: [0.36, 0.06, 0.3], p: [-0.55, 1.88, 0], m: 'hull2', g: 'turret' },
    { t: 'box', s: [0.24, 0.05, 0.2], p: [-1.25, 1.88, 0], m: 'dark', g: 'turret' },
    { t: 'box', s: [0.65, 0.03, 0.02], p: [0.1, 1.56, 1.155], m: 'glow', g: 'turret', mir: true },
    { t: 'box', s: [0.3, 0.12, 0.03], p: [-0.9, 1.6, 1.07], m: 'dark', g: 'turret', mir: true },
    { t: 'box', s: [0.5, 0.17, 0.03], p: [0.47, 1.58, 0.93], r3: [0, 38, 0], m: 'dark', g: 'turret', mir: true },
    { t: 'box', s: [0.03, 0.14, 0.32], p: [-1.63, 1.58, 0.55], m: 'dark', g: 'turret', mir: true },
    // twin guns: hex mantlets with glowing rings, barrels with muzzle sleeves
    { t: 'cyl', ax: 'x', r: 0.21, l: 0.32, seg: 6, p: [0.98, 1.47, 0.34], m: 'hull2', g: 'barrel', mir: true },
    { t: 'cyl', ax: 'x', r: 0.14, l: 0.03, seg: 12, p: [1.15, 1.47, 0.34], m: 'glow', g: 'barrel', mir: true },
    { t: 'cyl', ax: 'x', r: 0.07, l: 0.78, seg: 8, p: [1.52, 1.47, 0.34], m: 'metal', g: 'barrel', mir: true },
    { t: 'cyl', ax: 'x', r: 0.095, l: 0.34, seg: 8, p: [1.73, 1.47, 0.34], m: 'dark', g: 'barrel', mir: true },
    { t: 'cyl', ax: 'x', r: 0.055, l: 0.02, seg: 10, p: [1.905, 1.47, 0.34], m: 'glow', g: 'barrel', mir: true },
    // sensor pods with three lenses, small guns, antennas
    { t: 'cyl', ax: 'y', r: 0.08, l: 0.14, seg: 8, p: [-0.95, 1.9, 0.56], m: 'dark', g: 'turret', mir: true },
    { t: 'box', s: [0.42, 0.24, 0.4], p: [-0.95, 2.06, 0.56], m: 'hull', g: 'turret', mir: true },
    { t: 'box', s: [0.03, 0.16, 0.34], p: [-0.73, 2.06, 0.56], m: 'dark', g: 'turret', mir: true },
    ...[-0.11, 0, 0.11].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 10, p: [-0.71, 2.06, 0.56 + dz], m: 'glow', g: 'turret', mir: true })),
    { t: 'cyl', ax: 'x', r: 0.035, l: 0.42, seg: 6, p: [-0.5, 2.0, 0.78], m: 'dark', g: 'turret', mir: true },
    { t: 'cyl', ax: 'y', r: 0.012, l: 0.32, seg: 4, p: [-1.05, 2.34, 0.64], m: 'dark', g: 'turret', mir: true },
  ];
  // each gun is its own group (barrel / barrel2) so only the one that fired recoils [MM-story_mvee15ja_b]
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    if (q.g !== 'barrel' || !q.mir) continue;
    const a = Object.assign({}, q); delete a.mir;
    parts.splice(i, 1, a, Object.assign({}, a, { p: [a.p[0], a.p[1], -a.p[2]], g: 'barrel2' }));
  }
  M.tank = { name: 'Twin-barrel MBT', ref: 'tank', parts, pivots: { turret: [-0.35, 1.22, 0], barrel: [0.85, 1.47, 0], barrel2: [0.85, 1.47, 0] },
    // the twin guns pitch about the mantlet trunnion; shots leave the muzzle sleeves, alternately [MM-story_mvedy16u_9]
    barrel: { rest: 0, min: -8, max: 25, rate: 1.2 },
    recoil: 0.2,   // model units each main gun slides back when it fires — cannons only [MM-story_mvee15ja_b]
    muzzles: [[0.34, 'barrel'], [-0.34, 'barrel2']].map(([z, g]) => ({ p: [1.915, 1.47, z], d: [1, 0, 0], back: 0.95, g })),
    views: { side: 'right', top: 'down' } };
}


// segment helper: a box from a to b (x,y,z), width w (z-ish), height h
const seg = (a, b, w, h, m, extra = {}) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) * 180 / Math.PI, pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
  return Object.assign({ t: 'box', s: [L + w * 0.3, h, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m }, extra);
};
const oct = (yb, ym, ys, yt, wb, wm, ws, wt) => [[-wb, yb], [wb, yb], [wm, ym], [ws, ys], [wt, yt], [-wt, yt], [-ws, ys], [-wm, ym]];

// ── BUGGY "SR-07 scout" ──────────────────────────────────────────────────────────────────────────────
{
  const pod = (cx) => ({ t: 'ext', ax: 'z', poly: [[cx - 0.5, 0.6], [cx - 0.36, 0.9], [cx + 0.36, 0.9], [cx + 0.52, 0.62], [cx + 0.38, 0.46], [cx - 0.38, 0.46]], d: [0.92, 1.4], m: 'hull2', mir: true });
  const wheel = (x) => [
    { t: 'cyl', ax: 'z', r: 0.31, l: 0.4, seg: 12, p: [x, 0.31, 1.16], m: 'black', mir: true },
    { t: 'cyl', ax: 'z', r: 0.15, l: 0.42, seg: 8, p: [x, 0.31, 1.16], m: 'metal', mir: true },
    seg([x, 0.36, 0.45], [x, 0.4, 0.98], 0.07, 0.06, 'dark', { mir: true }),
    seg([x - 0.15, 0.55, 0.5], [x, 0.36, 0.98], 0.06, 0.06, 'dark', { mir: true }),
  ];
  const parts = [
    { t: 'loft', ax: 'x', secs: [
      [-1.97, oct(0.52, 0.8, 1.1, 1.27, 0.48, 0.85, 0.95, 0.5)],
      [-1.63, oct(0.43, 0.85, 1.3, 1.69, 0.52, 0.95, 1.15, 0.62)],
      [0.28, oct(0.43, 0.8, 1.32, 1.69, 0.52, 0.95, 1.18, 0.62)],
      [1.2, oct(0.48, 0.78, 1.2, 1.45, 0.52, 0.9, 1.1, 0.58)],
      [1.885, oct(0.7, 0.85, 1.1, 1.24, 0.48, 0.72, 0.82, 0.48)],
      [2.0, oct(0.85, 0.92, 1.0, 1.08, 0.42, 0.56, 0.58, 0.38)]], m: 'hull' },
    // windshield on the front roof slope, door seam, side vents
    { t: 'box', s: [1.0, 0.03, 0.82], p: [1.02, 1.505, 0], r3: [0, 0, -15.7], m: 'glass' },
    { t: 'box', s: [0.05, 0.62, 0.03], p: [-0.32, 1.0, 1.185], r3: [0, 0, 8], m: 'dark', mir: true },
    { t: 'box', s: [0.45, 0.05, 0.03], p: [0.6, 0.95, 1.135], m: 'dark', mir: true },
    pod(-1.4), pod(1.12), ...wheel(-1.4), ...wheel(1.13),
    // front face: dark grille, sensor lenses, light bar
    { t: 'box', s: [0.05, 0.26, 1.05], p: [1.93, 0.96, 0], m: 'dark' },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.05, seg: 10, p: [1.96, 0.98, 0], m: 'black' },
    { t: 'cyl', ax: 'x', r: 0.055, l: 0.02, seg: 10, p: [1.99, 0.98, 0], m: 'glow' },
    ...[0.22, 0.42].map((z) => ({ t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 8, p: [1.96, 1.02, z], m: 'glow', mir: true })),
    { t: 'cyl', ax: 'x', r: 0.04, l: 0.03, seg: 8, p: [1.96, 0.9, 0.3], m: 'amber' },
    { t: 'box', s: [0.03, 0.035, 0.26], p: [1.85, 0.76, 0], m: 'glow' },
    // rear vents
    { t: 'box', s: [0.04, 0.32, 0.34], p: [-1.95, 0.96, 0.42], m: 'dark', mir: true },
    { t: 'box', s: [0.04, 0.12, 0.3], p: [-1.95, 0.68, 0], m: 'dark' },
    // turret: ring, head with side lobes, big lens, glowing energy barrel
    { t: 'cyl', ax: 'y', r: 0.26, l: 0.16, seg: 10, p: [-0.85, 1.76, 0], m: 'dark', g: 'turret' },
    { t: 'box', s: [0.52, 0.24, 0.5], p: [-0.82, 1.95, 0], m: 'hull', g: 'turret' },
    { t: 'cyl', ax: 'z', r: 0.15, l: 0.16, seg: 8, p: [-0.84, 1.95, 0.32], m: 'hull2', g: 'turret', mir: true },
    { t: 'box', s: [0.2, 0.1, 0.2], p: [-0.88, 2.11, 0], m: 'dark', g: 'turret' },
    { t: 'cyl', ax: 'x', r: 0.12, l: 0.06, seg: 12, p: [-0.54, 1.97, 0], m: 'black', g: 'turret' },
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 10, p: [-0.505, 1.97, 0], m: 'glowB', g: 'turret' },
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.2, seg: 8, p: [-0.42, 1.9, 0], m: 'metal', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.04, l: 0.34, seg: 8, p: [-0.15, 1.9, 0], m: 'glow', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.055, l: 0.1, seg: 8, p: [0.06, 1.9, 0], m: 'metal', g: 'barrel' },
  ];
  M.buggy = { name: 'SR-07 scout', ref: 'buggy', parts, pivots: { turret: [-0.85, 1.69, 0], barrel: [-0.55, 1.9, 0] },
    barrel: { rest: 0, min: -8, max: 35, rate: 1.6 },   // [MM-story_mvedy16u_9]
    muzzles: [{ p: [0.115, 1.9, 0], d: [1, 0, 0], back: 0.65 }], views: { side: 'right', top: 'down' } };
}

// ── BEETLE "Stag tracker" ─────────────────────────────────────────────────────────────────────────────
{
  const ely = (yb, w, h) => [[0.08, yb], [w, yb], [w * 1.02, yb + 0.35 * h], [w * 0.82, yb + 0.8 * h], [w * 0.42, yb + h], [0.08, yb + 0.94 * h]];
  const claw = (pts, w0, w1) => pts.slice(0, -1).map((a, i) => seg(a, pts[i + 1], w0 + (w1 - w0) * i / (pts.length - 2), (w0 + (w1 - w0) * i / (pts.length - 2)) * 0.8, 'hull', { mir: true }));
  const parts = [
    ...track({ x0: -1.7, x1: 0.78, h: 0.58, z: 0.97, w: 0.56, wheels: 6, wr: 0.15, glowHub: true }),
    { t: 'box', s: [2.4, 0.45, 1.3], p: [-0.45, 0.78, 0], m: 'dark' },
    { t: 'box', s: [1.9, 0.5, 0.2], p: [-0.65, 1.42, 0], m: 'dark' },
    ...[-1.5, -1.0, -0.5].map((x) => ({ t: 'cyl', ax: 'z', r: 0.05, l: 1.6, seg: 6, p: [x, 0.98, 0], m: 'metal' })),
    // elytra (one half lofted, mirrored), pronotum, head
    { t: 'loft', ax: 'x', secs: [
      [-2.0, ely(1.3, 0.22, 0.1)], [-1.7, ely(1.15, 0.72, 0.5)], [-1.45, ely(1.1, 0.95, 0.65)], [-1.1, ely(1.07, 1.12, 0.8)],
      [-0.3, ely(1.06, 1.22, 0.87)], [0.35, ely(1.1, 1.16, 0.72)], [0.75, ely(1.14, 1.0, 0.52)], [0.95, ely(1.18, 0.8, 0.36)], [1.1, ely(1.22, 0.45, 0.2)]], m: 'hull', mir: true },
    { t: 'box', s: [2.0, 0.3, 0.8], p: [-0.3, 1.1, 0], m: 'dark' },
    ...[-1.3, -0.7, -0.1].map((x) => ({ t: 'cyl', ax: 'x', r: 0.06, l: 0.5, seg: 6, p: [x, 1.0, 0.62], m: 'metal', mir: true })),
    { t: 'loft', ax: 'x', secs: [
      [0.55, oct(0.85, 1.0, 1.22, 1.42, 0.35, 0.62, 0.66, 0.4)],
      [0.95, oct(0.82, 1.0, 1.22, 1.42, 0.32, 0.6, 0.64, 0.38)],
      [1.28, oct(0.78, 0.9, 1.04, 1.16, 0.25, 0.42, 0.45, 0.25)]], m: 'hull2' },
    { t: 'loft', ax: 'x', secs: [
      [1.25, oct(0.62, 0.72, 0.86, 0.98, 0.18, 0.3, 0.32, 0.18)],
      [1.55, oct(0.6, 0.68, 0.78, 0.86, 0.12, 0.2, 0.22, 0.12)]], m: 'dark' },
    { t: 'box', s: [0.08, 0.06, 0.06], p: [1.5, 0.82, 0.16], m: 'glow', mir: true },
    // mandibles: arcs of tapering segments, with inner teeth
    ...claw([[1.3, 0.72, 0.32], [1.5, 0.68, 0.62], [1.72, 0.6, 0.88], [1.95, 0.52, 0.86], [2.12, 0.45, 0.6], [2.18, 0.4, 0.32]], 0.17, 0.05),
    seg([1.9, 0.53, 0.82], [1.95, 0.52, 0.6], 0.05, 0.05, 'hull2', { mir: true }),
    seg([1.62, 0.64, 0.75], [1.72, 0.62, 0.55], 0.05, 0.05, 'hull2', { mir: true }),
    // side cannons: arm, housing, twin glowing rails, hex muzzle
    { t: 'cyl', ax: 'z', r: 0.07, l: 0.75, seg: 8, p: [0.1, 1.0, 0.98], m: 'dark', mir: true },
    { t: 'box', s: [0.6, 0.28, 0.3], p: [-0.2, 1.0, 1.38], m: 'hull', mir: true },
    { t: 'cyl', ax: 'x', r: 0.045, l: 0.95, seg: 8, p: [0.57, 1.06, 1.38], m: 'glow', mir: true },
    { t: 'cyl', ax: 'x', r: 0.045, l: 0.95, seg: 8, p: [0.57, 0.94, 1.38], m: 'glow', mir: true },
    { t: 'box', s: [0.95, 0.04, 0.12], p: [0.57, 1.0, 1.38], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.2, seg: 6, p: [1.12, 1.0, 1.38], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [1.23, 1.0, 1.38], m: 'glow', mir: true },
  ];
  M.beetle = { name: 'Stag tracker', ref: 'beetle', parts, pivots: {}, views: { side: 'left', top: 'right' } };
}

// ── JET "FS-217 striker" ──────────────────────────────────────────────────────────────────────────────
{
  const fus = (yb, yt, w) => { const h = yt - yb, ym = yb + 0.45 * h; return [[0, yb], [w * 0.7, yb + 0.15 * h], [w, ym], [w * 0.6, yt - 0.1 * h], [0, yt], [-w * 0.6, yt - 0.1 * h], [-w, ym], [-w * 0.7, yb + 0.15 * h]]; };
  const can = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.7, yb + 0.7 * (yt - yb)], [0, yt], [-w * 0.7, yb + 0.7 * (yt - yb)]];
  const parts = [
    { t: 'loft', ax: 'x', secs: [
      [2.0, fus(0.52, 0.56, 0.02)], [1.6, fus(0.38, 0.72, 0.16)], [1.2, fus(0.3, 0.8, 0.25)], [0.8, fus(0.22, 0.82, 0.38)],
      [0.3, fus(0.2, 0.8, 0.6)], [-0.4, fus(0.18, 0.78, 0.8)], [-1.1, fus(0.18, 0.76, 0.76)], [-1.6, fus(0.22, 0.72, 0.64)], [-1.85, fus(0.26, 0.66, 0.56)]], m: 'hull' },
    { t: 'loft', ax: 'x', secs: [[1.42, can(0.76, 0.8, 0.04)], [1.1, can(0.77, 0.93, 0.16)], [0.7, can(0.79, 0.98, 0.18)], [0.35, can(0.78, 0.87, 0.12)], [0.2, can(0.77, 0.8, 0.05)]], m: 'glass' },
    // wings, chines, tailplanes (top-view polygons extruded in Y)
    { t: 'ext', ax: 'y', poly: [[-0.16, 0.6], [-1.01, 2.19], [-1.43, 2.19], [-1.54, 0.7]], d: [0.46, 0.52], m: 'hull', mir: true },
    { t: 'ext', ax: 'y', poly: [[1.25, 0.2], [-0.1, 0.62], [-0.5, 0.55], [0.4, 0.3]], d: [0.47, 0.52], m: 'hull2', mir: true },
    { t: 'ext', ax: 'y', poly: [[-1.45, 0.45], [-1.95, 1.0], [-2.12, 1.0], [-2.02, 0.42]], d: [0.47, 0.51], m: 'hull2', mir: true },
    { t: 'box', s: [0.5, 0.02, 0.03], p: [-1.15, 0.5, 2.0], r3: [0, -64, 0], m: 'glow', mir: true },
    // canted fins (built at the root, rotated outward 22°)
    { t: 'ext', ax: 'z', poly: [[-0.95, 0], [-1.42, 0.78], [-1.68, 0.78], [-1.88, 0]], d: [-0.025, 0.025], p: [0, 0.72, 0.48], r3: [26, 0, 0], m: 'hull2', mir: true },
    // intakes
    // caret intakes: a lofted duct per side whose raked lip (per-point offsets) blends back into the engine;
    // the opening is an inset dark plate on the same rake, framed by a bezel
    { t: 'loft', ax: 'x', secs: [
      [1.0, [[0.37, 0.65, 0], [0.71, 0.65, -0.06], [0.83, 0.53, -0.1], [0.83, 0.21, -0.14], [0.29, 0.21, -0.06]]],
      [0.5, [[0.3, 0.68], [0.72, 0.68], [0.84, 0.56], [0.84, 0.2], [0.26, 0.2]]],
      [-0.3, [[0.28, 0.7], [0.7, 0.69], [0.8, 0.58], [0.78, 0.22], [0.24, 0.2]]],
      [-1.0, [[0.24, 0.62], [0.48, 0.62], [0.56, 0.54], [0.56, 0.26], [0.24, 0.24]]]], m: 'hull2', mir: true },
    { t: 'loft', ax: 'x', secs: [
      [1.006, [[0.42, 0.6, 0], [0.69, 0.6, -0.055], [0.77, 0.51, -0.09], [0.77, 0.26, -0.13], [0.34, 0.26, -0.057]]],
      [0.8, [[0.42, 0.6, 0], [0.69, 0.6, -0.055], [0.77, 0.51, -0.09], [0.77, 0.26, -0.13], [0.34, 0.26, -0.057]]]], m: 'black', mir: true },
    { t: 'box', s: [0.04, 0.1, 0.03], p: [0.86, 0.42, 0.85], m: 'glow', mir: true },
    { t: 'box', s: [0.02, 0.03, 0.12], p: [1.02, 0.66, 0.5], m: 'dark', mir: true },
    // engines + nozzles
    { t: 'cyl', ax: 'x', r: 0.21, l: 0.9, seg: 10, p: [-1.45, 0.44, 0.36], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: [0.2, 0.24], l: 0.18, seg: 12, p: [-1.98, 0.44, 0.36], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.02, seg: 12, p: [-2.08, 0.44, 0.36], m: 'glowB', mir: true },
    // weapon pods under the wings, glowing fronts, pylons
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.8, seg: 8, p: [-0.5, 0.24, 1.32], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.07, l: 0.02, seg: 10, p: [-0.09, 0.24, 1.32], m: 'glowB', mir: true },
    { t: 'box', s: [0.4, 0.2, 0.04], p: [-0.55, 0.38, 1.32], m: 'dark', mir: true },
    ...[0, 90].map((a) => ({ t: 'box', s: [0.3, 0.04, 0.38], p: [-0.75, 0.24, 1.32], r3: [a, 0, 0], m: 'dark', mir: true })),
    // details
    { t: 'box', s: [0.3, 0.025, 0.02], p: [0.9, 0.55, 0.3], m: 'glow', mir: true },
    { t: 'box', s: [0.2, 0.03, 0.02], p: [-0.2, 0.62, 0.62], m: 'glow', mir: true },
  ];
  M.jet = { name: 'FS-217 striker', ref: 'jet', parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
}


// ══ KING TIGER (GND-HeavyTanks) — ported from the unit-model prototype (tools/unit-models/next, branch
// feat/unit-art-refs) [MM-story_mvbqugeo_l]. The prototype's three layers (base / weapon / head) fold into the game's
// two (body / turret): the radar head rides the turret as part of it until models3d.js learns a head group.
{
  // ── HEAD kits: sensor heads that ride on the weapon and scan (all parts in group 'head'; pivot = mast foot)
  function radarDish({ x, y, z, mast = 0.2, r = 0.26, tilt = 22 }) {
    const top = y + mast;
    return [
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.05, seg: 8, p: [x, y + 0.025, z], m: 'dark', g: 'head' },              // turntable
      { t: 'cyl', ax: 'y', r: 0.03, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal', g: 'head' },            // mast
      { t: 'box', s: [0.08, 0.06, 0.16], p: [x, top, z], m: 'dark', g: 'head' },                                   // yoke
      { t: 'cyl', ax: 'x', r: [r, r * 0.3], l: r * 0.42, seg: 12, p: [x + 0.06, top + 0.04, z], r3: [0, 0, tilt], m: 'hull2', g: 'head' },   // dish
      { t: 'cyl', ax: 'x', r: r * 0.86, l: 0.012, seg: 12, p: [x + 0.06 + r * 0.21 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 0.21 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'dark', g: 'head' },   // dish face
      { t: 'cyl', ax: 'x', r: 0.016, l: r * 0.9, seg: 5, p: [x + 0.06 + r * 0.55 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 0.55 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'metal', g: 'head' },   // feed arm
      { t: 'cyl', ax: 'x', r: 0.03, l: 0.03, seg: 8, p: [x + 0.06 + r * 1.0 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 1.0 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'glow', g: 'head' },  // feed horn
      { t: 'box', s: [0.1, 0.08, 0.1], p: [x - 0.1, top - 0.02, z], m: 'hull', g: 'head' },                          // counterweight
    ];
  }
  function barRadar({ x, y, z, mast = 0.16, w = 0.56 }) {
    const top = y + mast;
    return [
      { t: 'cyl', ax: 'y', r: 0.06, l: 0.04, seg: 8, p: [x, y + 0.02, z], m: 'dark', g: 'head' },
      { t: 'cyl', ax: 'y', r: 0.025, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal', g: 'head' },
      { t: 'box', s: [0.07, 0.11, w], p: [x, top + 0.04, z], r3: [0, 0, -12], m: 'hull2', g: 'head' },              // antenna bar, tipped up
      { t: 'box', s: [0.01, 0.06, w * 0.9], p: [x + 0.04, top + 0.05, z], r3: [0, 0, -12], m: 'glowB', g: 'head' },  // emitter strip
    ];
  }

  // ── HEAVY TANK "King Tiger" (GND-HeavyTanks) — from the repo's tiger-*.png ortho set (side, top, front, rear; base and turret split).
  // Side view: hull 620 px = 4.7 units → 0.0076 u/px; deck 1.21, turret roof 1.82, fender line 0.61; gun tip 4.9.
  {
    const TUR = [[-1.42, -0.6], [-1.2, -0.68], [-0.3, -0.75], [0.72, -0.6], [0.98, -0.38], [0.98, 0.38], [0.72, 0.6], [-0.3, 0.75], [-1.2, 0.68], [-1.42, 0.6]];
    const TUR_TOP = TUR.map(([x, z]) => [x > 0.35 ? 0.35 + (x - 0.35) * 0.55 : x, z * 0.84]);
    const HS = (x, zb, zt, yb, yt) => [x, [[-zb, yb], [zb, yb], [zt, yt], [-zt, yt]]];
    const parts = [
      ...track({ x0: -2.22, x1: 2.2, h: 0.64, z: 0.97, w: 0.52, wheels: 9, wr: 0.27, rr: 0.32 }),
      // lower hull between the tracks
      { t: 'ext', ax: 'z', poly: [[-2.2, 0.32], [-2.28, 0.62], [2.32, 0.62], [2.12, 0.32]], d: [-0.72, 0.72], m: 'hull2' },
      // upper hull: lofted along X — sloped sides, flat deck, long glacis down to the nose
      { t: 'loft', ax: 'x', secs: [HS(-2.34, 1.2, 1.04, 0.6, 1.17), HS(-2.24, 1.24, 1.1, 0.6, 1.21), HS(1.58, 1.24, 1.1, 0.6, 1.21), HS(2.36, 1.2, 1.12, 0.6, 0.68)], m: 'hull' },
      // fenders front + rear
      { t: 'box', s: [0.32, 0.03, 0.5], p: [2.28, 0.64, 0.98], r3: [0, 0, -18], m: 'hull2', mir: true },
      // deck: engine grilles, twin fans, hatches, tools
      { t: 'box', s: [0.75, 0.025, 0.38], p: [-1.55, 1.215, 0], m: 'dark' },
      { t: 'cyl', ax: 'y', r: 0.21, l: 0.03, seg: 12, p: [-1.7, 1.215, 0.62], m: 'dark', mir: true },
      { t: 'cyl', ax: 'y', r: 0.12, l: 0.035, seg: 10, p: [-1.7, 1.22, 0.62], m: 'black', mir: true },
      { t: 'cyl', ax: 'y', r: 0.16, l: 0.04, seg: 10, p: [1.2, 1.2, 0.52], r3: [0, 0, -18], m: 'hull2', mir: true },
      { t: 'box', s: [1.6, 0.03, 0.05], p: [-0.2, 1.17, 1.12], m: 'metal', mir: true },
      { t: 'box', s: [0.05, 0.08, 0.2], p: [2.3, 0.73, 0.82], m: 'dark', mir: true },                             // tow lugs
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.06, seg: 8, p: [2.03, 0.98, -0.78], r3: [0, 0, -40], m: 'glowB' },        // headlight
      { t: 'cyl', ax: 'x', r: 0.04, l: 0.04, seg: 8, p: [2.07, 0.96, 0.32], r3: [0, 0, -40], m: 'dark' },         // hull MG
      // rear plate: exhaust stacks + stowage box
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.32, seg: 8, p: [-2.37, 0.98, 0.36], m: 'dark', mir: true },
      { t: 'cyl', ax: 'y', r: 0.05, l: 0.04, seg: 8, p: [-2.37, 1.15, 0.36], m: 'amber', mir: true },
      { t: 'box', s: [0.12, 0.2, 0.34], p: [-2.38, 0.78, -0.72], m: 'hull2' },
      // ── WEAPON: long hexagonal turret, bell mantlet, 8.8 cm gun with muzzle brake
      { t: 'loft', ax: 'y', secs: [[1.21, TUR], [1.82, TUR_TOP]], m: 'hull', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: [0.17, 0.28], l: 0.4, seg: 12, p: [1.14, 1.48, 0], m: 'hull2', g: 'barrel' },
      { t: 'cyl', ax: 'x', r: 0.115, l: 0.55, seg: 10, p: [1.6, 1.48, 0], m: 'hull', g: 'barrel' },
      { t: 'cyl', ax: 'x', r: 0.075, l: 3.0, seg: 8, p: [3.3, 1.48, 0], m: 'metal', g: 'barrel' },
      { t: 'cyl', ax: 'x', r: 0.115, l: 0.3, seg: 10, p: [4.74, 1.48, 0], m: 'dark', g: 'barrel' },
      { t: 'box', s: [0.12, 0.05, 0.25], p: [4.74, 1.48, 0], m: 'black', g: 'barrel' },
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 8, p: [4.9, 1.48, 0], m: 'glow', g: 'barrel' },
      // cupola + loader hatch + periscope
      { t: 'cyl', ax: 'y', r: 0.21, l: 0.13, seg: 12, p: [-0.62, 1.88, -0.36], m: 'hull2', g: 'weapon' },
      { t: 'cyl', ax: 'y', r: 0.16, l: 0.04, seg: 12, p: [-0.62, 1.96, -0.36], m: 'dark', g: 'weapon' },
      { t: 'cyl', ax: 'y', r: 0.15, l: 0.04, seg: 10, p: [-0.2, 1.83, 0.3], m: 'hull2', g: 'weapon' },
      { t: 'box', s: [0.1, 0.06, 0.06], p: [0.3, 1.84, -0.18], m: 'dark', g: 'weapon' },
      // spare track links hung on the turret sides (the reference's signature detail)
      ...[-0.75, -0.42, 0.25].map((x) => ({ t: 'box', s: [0.28, 0.17, 0.04], p: [x, 1.5, 0.705 - (x > 0 ? 0.04 : 0)], r3: [0, x > 0 ? -12 : 0, -10], m: 'track', g: 'weapon', mir: true })),
      { t: 'box', s: [0.04, 0.08, 0.5], p: [-1.43, 1.52, 0], m: 'dark', g: 'weapon' },                          // rear hatch
    ];
    parts.push(...radarDish({ x: -1.1, y: 1.82, z: 0.32, mast: 0.22, r: 0.27 }));
    M.tiger = { name: 'King Tiger heavy tank', unit: 'GND-HeavyTanks', ref: 'tiger', parts, pivots: { weapon: [-0.17, 1.21, 0], head: [-1.1, 1.82, 0.32], barrel: [0.95, 1.48, 0] }, head: { mode: 'sweep' },
      // the 8.8 cm gun pitches about the mantlet; shots leave the muzzle brake [MM-story_mvedy16u_9]
      barrel: { rest: 0, min: -8, max: 20, rate: 0.9 },
      recoil: 0.65,   // the 8.8 cm gun's slide-back [MM-story_mvee15ja_b]
      muzzles: [{ p: [4.91, 1.48, 0], d: [1, 0, 0], back: 1.9 }],
      views: { side: 'right', top: 'left' } };
  }

  const toGame = (def) => Object.assign({}, def, {
    parts: def.parts.map((q) => (q.g === 'weapon' || q.g === 'head' ? Object.assign({}, q, { g: 'turret' }) : q)),
    pivots: def.pivots.barrel ? { turret: def.pivots.weapon, barrel: def.pivots.barrel } : { turret: def.pivots.weapon },
  });
  M.tiger = toGame(M.tiger);
}
// ── shared bits for the rotorcraft: a ring of short boxes (a duct or rotor rim) about a vertical axis ────────────
const D_R = Math.PI / 180;
const ringY = (c, r, n, w, h, m, g, extra = {}) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2;
  return Object.assign({ t: 'box', s: [2 * Math.PI * r / n * 1.08, h, w], p: [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r], r3: [0, -(a / D_R + 90), 0], m }, g ? { g } : {}, extra);
});
// a flat blade from the hub at c, length L, at yaw a (degrees) about Y
const bladeY = (c, L, a, w, h, m, g) => ({ t: 'box', s: [L, h, w], p: [c[0] + Math.cos(a * D_R) * L / 2, c[1], c[2] - Math.sin(a * D_R) * L / 2], r3: [0, a, 0], m, g });

// ── COPTER "RAH-66X" stealth attack helicopter (owner sheet 2026-10-18) [MM-story_mvehe3sy_j] ─────────────────────
//    13.6 m long → 4 model units. Faceted fuselage with a tandem canopy, twin engine fairings, stub wings carrying two
//    missile pods a side, chin sensor turret + cannon, swept fin with a fenestron. The enclosed 4-blade main rotor
//    (rim + blades, group `spin`) and the fenestron fan (`spin2`) turn in the battle view.
{
  const oct = (yb, yt, w) => { const h = yt - yb; return [[w * 0.55, yb], [w, yb + 0.3 * h], [w * 0.8, yt - 0.18 * h], [w * 0.35, yt], [-w * 0.35, yt], [-w * 0.8, yt - 0.18 * h], [-w, yb + 0.3 * h], [-w * 0.55, yb]]; };
  const can = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.75, yb + 0.75 * (yt - yb)], [w * 0.3, yt], [-w * 0.3, yt], [-w * 0.75, yb + 0.75 * (yt - yb)]];
  const HUB = [0.05, 1.04, 0], FAN = [-1.78, 0.74, 0];
  const parts = [
    // fuselage: chisel nose → cockpit → engine bay → thin boom
    { t: 'loft', ax: 'x', secs: [
      [2.0, oct(0.4, 0.44, 0.02)], [1.75, oct(0.28, 0.58, 0.14)], [1.35, oct(0.2, 0.72, 0.26)], [0.8, oct(0.18, 0.8, 0.32)],
      [0.1, oct(0.2, 0.84, 0.34)], [-0.45, oct(0.3, 0.76, 0.24)], [-0.9, oct(0.44, 0.66, 0.1)], [-1.6, oct(0.5, 0.62, 0.07)], [-1.98, oct(0.52, 0.6, 0.04)]], m: 'hull' },
    // tandem canopy: gunner forward, pilot aft (raised)
    { t: 'loft', ax: 'x', secs: [[1.62, can(0.55, 0.58, 0.05)], [1.4, can(0.62, 0.74, 0.18)], [1.05, can(0.68, 0.8, 0.2)], [0.95, can(0.7, 0.78, 0.15)]], m: 'glass' },
    { t: 'loft', ax: 'x', secs: [[0.98, can(0.74, 0.78, 0.08)], [0.8, can(0.76, 0.9, 0.2)], [0.45, can(0.8, 0.92, 0.2)], [0.3, can(0.8, 0.84, 0.1)]], m: 'glass' },
    { t: 'box', s: [0.04, 0.12, 0.38], p: [0.97, 0.78, 0], m: 'dark' },                                   // canopy frame
    // spine fairing to the mast, panel lines
    { t: 'loft', ax: 'x', secs: [[0.35, oct(0.8, 0.84, 0.14)], [0.1, oct(0.82, 0.96, 0.2)], [-0.3, oct(0.8, 0.92, 0.16)], [-0.6, oct(0.74, 0.78, 0.06)]], m: 'hull2' },
    { t: 'box', s: [1.6, 0.012, 0.012], p: [0.3, 0.52, 0.335], m: 'dark', mir: true, d: 1 },
    // engine fairings either side of the spine, dark intakes, exhausts
    { t: 'cyl', ax: 'x', r: [0.11, 0.13], l: 0.7, seg: 8, p: [-0.1, 0.74, 0.3], m: 'hull2', mir: true },
    { t: 'cyl', ax: 'x', r: 0.09, l: 0.03, seg: 8, p: [0.26, 0.74, 0.3], m: 'black', mir: true },
    { t: 'box', s: [0.1, 0.08, 0.12], p: [-0.5, 0.74, 0.3], m: 'dark', mir: true },
    // stub wings + missile pods (two a side), amber seeker tips
    { t: 'ext', ax: 'y', poly: [[0.25, 0.3], [0.12, 1.02], [-0.18, 1.02], [-0.32, 0.3]], d: [0.44, 0.48], m: 'hull2', mir: true },
    ...[0.62, 0.9].flatMap((z) => [
      { t: 'box', s: [0.06, 0.08, 0.05], p: [-0.04, 0.39, z], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.075, l: 0.62, seg: 8, p: [-0.02, 0.29, z], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.08, l: 0.04, seg: 8, p: [0.3, 0.29, z], m: 'hull2', mir: true },
      { t: 'cyl', ax: 'x', r: [0.02, 0.06], l: 0.06, seg: 8, p: [0.35, 0.29, z], m: 'amber', mir: true },
    ]),
    // chin: multi-spectral sensor ball + 3-barrel cannon
    { t: 'ell', s: [0.12, 0.1, 0.12], seg: 10, p: [1.5, 0.2, 0], m: 'dark' },
    { t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 8, p: [1.61, 0.2, 0], m: 'glowB' },
    { t: 'box', s: [0.16, 0.08, 0.1], p: [1.15, 0.17, 0], m: 'dark' },
    { t: 'cyl', ax: 'x', r: 0.025, l: 0.62, seg: 6, p: [1.5, 0.15, 0], m: 'metal' },
    // tail: swept fin with the fenestron shroud, small tailplanes, tail light
    { t: 'ext', ax: 'z', poly: [[-1.55, 0.58], [-1.95, 0.58], [-2.12, 1.22], [-1.98, 1.22]], d: [-0.035, 0.035], m: 'hull2' },
    { t: 'cyl', ax: 'z', r: 0.2, l: 0.09, seg: 14, p: FAN, m: 'dark' },
    { t: 'ext', ax: 'y', poly: [[-1.42, 0.04], [-1.58, 0.42], [-1.72, 0.42], [-1.66, 0.04]], d: [0.55, 0.58], m: 'hull2', mir: true },
    { t: 'box', s: [0.04, 0.04, 0.04], p: [-2.0, 1.2, 0], m: 'amber' },
    // rotor mast + hub (fixed)
    { t: 'cyl', ax: 'y', r: 0.07, l: 0.12, seg: 8, p: [HUB[0], 0.98, 0], m: 'dark' },
    // MAIN ROTOR (spins): 4 blades to an enclosing rim, hub cap
    { t: 'cyl', ax: 'y', r: 0.12, l: 0.07, seg: 10, p: HUB, m: 'hull2', g: 'spin' },
    ...[0, 90, 180, 270].map((a) => bladeY(HUB, 1.62, a, 0.11, 0.02, 'dark', 'spin')),
    ...ringY(HUB, 1.62, 28, 0.06, 0.045, 'hull2', 'spin'),
    // FENESTRON FAN (spins about the tail axis)
    ...[0, 45, 90, 135].map((a) => ({ t: 'box', s: [0.34, 0.03, 0.11], p: FAN, r3: [0, 0, a], m: 'metal', g: 'spin2' })),
    { t: 'cyl', ax: 'z', r: 0.045, l: 0.13, seg: 8, p: FAN, m: 'hull', g: 'spin2' },
  ];
  M.copter = { name: 'RAH-66X stealth attack helicopter', ref: 'copter', parts, pivots: { spin: HUB, spin2: FAN }, hover: 1,
    spin: { spin: { axis: 'y', speed: 22 }, spin2: { axis: 'z', speed: 40 } },
    views: { side: 'right', top: 'up' } };
}

// ── DRONE "MX-4" compact recon drone (owner sheet 2026-10-18) [MM-story_mvehe3sy_j] ─────────────────────────────
//    Faceted low-observable body, four composite arms to ducted 2-blade fans (`spin`…`spin4`, they turn), a gimbal
//    EO/IR camera under the nose, four skids.
{
  const hex = (yb, yt, w) => { const h = yt - yb; return [[w * 0.6, yb], [w, yb + 0.35 * h], [w * 0.85, yt - 0.15 * h], [w * 0.45, yt], [-w * 0.45, yt], [-w * 0.85, yt - 0.15 * h], [-w, yb + 0.35 * h], [-w * 0.6, yb]]; };
  const F = 1.2, FY = 0.95, R = 0.5;
  const fans = [[F, F], [F, -F], [-F, F], [-F, -F]];
  const parts = [
    { t: 'loft', ax: 'x', secs: [[1.1, hex(0.66, 0.92, 0.28)], [0.85, hex(0.56, 1.06, 0.62)], [-0.75, hex(0.56, 1.06, 0.62)], [-1.05, hex(0.64, 0.96, 0.34)]], m: 'hull' },
    { t: 'ext', ax: 'y', poly: [[0.3, 0], [0.18, 0.22], [-0.18, 0.22], [-0.3, 0], [-0.18, -0.22], [0.18, -0.22]], d: [1.055, 1.075], m: 'hull2' },   // payload hatch
    { t: 'box', s: [0.3, 0.015, 0.22], p: [0, 1.075, 0], m: 'dark', d: 1 },
    { t: 'box', s: [0.03, 0.06, 0.16], p: [1.08, 0.8, 0], m: 'glowB' },                                 // nose sensor strip
    { t: 'box', s: [0.12, 0.08, 0.02], p: [0.2, 0.86, 0.62], m: 'dark', mir: true, d: 1 },               // side vents
    // gimbal camera under the nose
    { t: 'box', s: [0.3, 0.1, 0.3], p: [0.55, 0.52, 0], m: 'dark' },
    { t: 'ell', s: [0.2, 0.2, 0.2], seg: 12, p: [0.6, 0.34, 0], m: 'hull2' },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.06, seg: 12, p: [0.78, 0.34, 0], m: 'black' },
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 10, p: [0.81, 0.34, 0], m: 'glass' },
    ...fans.flatMap(([x, z], i) => {
      const c = [x, FY, z], g = i ? 'spin' + (i + 1) : 'spin', ax0 = Math.sign(x) * 0.45, az0 = Math.sign(z) * 0.4;
      const L = Math.hypot(x - ax0, z - az0) - R + 0.05, yaw = -Math.atan2(z - az0, x - ax0) / D_R;
      const mx = ax0 + (x - ax0) * (L / 2) / Math.hypot(x - ax0, z - az0), mz = az0 + (z - az0) * (L / 2) / Math.hypot(x - ax0, z - az0);
      return [
        { t: 'box', s: [L, 0.1, 0.14], p: [mx, FY - 0.02, mz], r3: [0, yaw, 0], m: 'hull2' },          // composite arm
        ...ringY(c, R, 18, 0.07, 0.16, 'hull'),                                                        // duct
        { t: 'cyl', ax: 'y', r: 0.08, l: 0.22, seg: 8, p: [x, FY - 0.12, z], m: 'dark' },               // motor pod
        { t: 'box', s: [0.08, 0.26, 0.08], p: [x, FY - 0.32, z], m: 'dark' },                          // skid leg
        { t: 'box', s: [0.3, 0.04, 0.12], p: [x, FY - 0.46, z], m: 'dark' },                           // skid foot
        // fan (spins): two blades + spinner
        { t: 'cyl', ax: 'y', r: 0.06, l: 0.06, seg: 8, p: [x, FY + 0.02, z], m: 'hull2', g },
        bladeY([x, FY + 0.02, z], R - 0.06, 15, 0.12, 0.015, 'dark', g),
        bladeY([x, FY + 0.02, z], R - 0.06, 195, 0.12, 0.015, 'dark', g),
      ];
    }),
  ];
  const pivots = {}, spin = {};
  fans.forEach(([x, z], i) => { const g = i ? 'spin' + (i + 1) : 'spin'; pivots[g] = [x, FY + 0.02, z]; spin[g] = { axis: 'y', speed: (i === 0 || i === 3 ? 1 : -1) * 45 }; });
  M.drone = { name: 'MX-4 recon drone', ref: 'drone', parts, pivots, hover: 1, spin, views: { side: 'right', top: 'up' } };
}

// ── the HARVESTER: the System resource miner (structures/systemModels.js sys_harvester) — the wide tracked miner with
//    the spinning drill the landing craft's hatches were sized for; it replaces the buggy stand-in (owner 2026-10-19:
//    "We should swap that harvester model into the game") [MM-story_mvg3xsca_1x]. Same geometry; its drill ('head' in
//    the System model) becomes a units3d spin group, and it keeps the System palette (def.colors).
{
  const S = SYSTEM_MODELS.sys_harvester;
  M.miner = { name: S.name, unit: 'SYS-Harvester', ref: 'miner', parts: S.parts.map((p) => (p.g === 'head' ? { ...p, g: 'spin' } : p)),
    pivots: { spin: S.pivots.head }, spin: { spin: { axis: 'x', speed: S.head.speed || 7 } }, colors: SYSTEM_COLORS, cargo: S.cargo, views: S.views };
}

// the AIR faction's own models (air/*.js) [MM-story_mvh8woji_1]
Object.assign(M, AIR_MODELS);
// the ARTILLERY (Siege) faction's own models (siege/*.js) [MM-story_mvhb6qd2_2]
Object.assign(M, SIEGE_MODELS);
// the ARCANE / ENERGY faction's own models (arcane/*.js) [MM-story_mvhnbx8n_4]
Object.assign(M, ARCANE_MODELS);
// the SPACE TECH faction's own models (space/*.js) [MM-story_mvho2d6s_5]
Object.assign(M, SPACE_MODELS);
// the DARK ENERGY faction's own models (dark/*.js) [MM-story_mvifm4xj_1]
Object.assign(M, DARK_MODELS);

export const UNIT_MODELS = M;
