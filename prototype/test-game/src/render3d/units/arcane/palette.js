// src/render3d/units/arcane/palette.js — the ARCANE / ENERGY faction livery and shared gothic parts for its 3D models
// [MM-story_mvhnbx8n_4]. Sampled from the owner's concepts (tools/unit-models/ref/arcane/*.png): blackened wrought iron,
// worn bronze filigree, glowing red stained glass, braziers of orange flame, crimson banners. Shared keys (dark, black,
// track, metal, glass, glow) keep their usual meaning. The glass is drawn unlit (glowR) so it reads as lit from within.
//
// This file also holds the faction's shared builders (pointed arches, rose windows, rings, spoked wheels, the domed shrine
// body the Troops and Missile Flyer share). classic.mjs loads palette.js first, so every unit file may use them.
export const ARCANE_COLORS = Object.freeze({
  iron: 0x2f2d31,    // blackened wrought iron (the main body colour)
  iron2: 0x403c3a,   // lighter iron: roofs, plates, track guards
  bronze: 0x9c7743,  // worn bronze filigree, frames, trim
  bronze2: 0x62492a, // dark bronze: hubs, straps, shadowed trim
  wood: 0x4d3624,    // carriage wheels
  cloth: 0x7c1d17,   // crimson banners
  robe: 0x1d1b1e,    // the hooded rider's robe
  glowR: 0xff3b1f,   // red stained glass, energy tips (unlit)
  glowF: 0xffa23a,   // brazier flame (unlit)
  hull: 0x2f2d31, hull2: 0x403c3a, panel: 0x383533,   // aliases so shared helpers stay on palette
  dark: 0x252120, black: 0x121011, track: 0x2b2623, metal: 0x6a6258, glass: 0x1a1a22,
  glow: 0xff3b1f, glowB: 0xff6a3a, amber: 0xffb340,
});

const A_D2R = Math.PI / 180;

/** A circle outline of radius r, n points, in the (u, v) plane. */
export function circlePoly(r, n = 16, cu = 0, cv = 0) {
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cu + Math.cos(a) * r, cv + Math.sin(a) * r]; });
}

/** A pointed (gothic) arch outline, u across [-w, w], v up from 0: straight jambs to the springing height s, then two arcs
 *  of radius k·w meeting at the apex. */
export function archPoly(w, s, k = 1.7, n = 3) {
  const R = k * w, cx = w - R, th = Math.acos(-cx / R), right = [];
  for (let i = 0; i <= n; i++) { const a = th * i / n; right.push([cx + R * Math.cos(a), s + R * Math.sin(a)]); }
  const left = right.slice(0, -1).reverse().map(([u, v]) => [-u, v]);
  return [[w, 0], ...right, ...left, [-w, 0]];
}
/** The apex height of archPoly(w, s, k). */
export const archTop = (w, s, k = 1.7) => { const R = k * w, cx = w - R; return s + Math.sqrt(R * R - cx * cx); };

/** A flat ring (annulus) facing along `ax`, centred at p: outer radius r, band t, thickness d. */
// (an extrusion's `d` is its depth range, so the LOD detail flag `d: 1` can't ride on one — extE drops it)
const extE = (extra) => { const { d: _detail, ...rest } = extra; return rest; };

export function ring(ax, p, r, t, d, m, extra = {}, n = 14) {
  return { t: 'ext', ax, poly: circlePoly(r, n), holes: [circlePoly(r - t, n).reverse()], ...extE(extra), d: [-d / 2, d / 2], p, m };
}

/** An elliptical ring (half or full) facing along `ax`: radii ra (u) × rb (v), band t, thickness d. */
export function ellRing(ax, p, ra, rb, t, d, m, extra = {}, half = false, n = 18) {
  const a1 = half ? Math.PI : Math.PI * 2, N = half ? n / 2 : n;
  const pts = (A, B) => Array.from({ length: N + (half ? 1 : 0) }, (_, i) => { const a = a1 * i / N; return [Math.cos(a) * A, Math.sin(a) * B]; });
  if (half) return { t: 'ext', ax, poly: [...pts(ra, rb), ...pts(ra - t, rb - t).reverse()], ...extE(extra), d: [-d / 2, d / 2], p, m };
  return { t: 'ext', ax, poly: pts(ra, rb), holes: [pts(ra - t, rb - t).reverse()], ...extE(extra), d: [-d / 2, d / 2], p, m };
}

/** A glowing pointed-arch window with a bronze frame and one mullion. `ax` 'z' = on a side wall (outward +z; use mir),
 *  'x' = on a front/back face (outward +x, or -x with out = -1). p is the sill centre on the wall surface. */
export function archWindow(ax, p, w, s, opts = {}) {
  const { k = 1.7, out = 1, frame = 0.05, m = 'glowR', fm = 'bronze', bars = true, extra = {} } = opts;
  const top = archTop(w, s, k), d0 = out > 0 ? [0.0, 0.025] : [-0.025, 0.0], f0 = out > 0 ? [-0.01, 0.018] : [-0.018, 0.01];
  const parts = [
    { t: 'ext', ax, poly: archPoly(w + frame, s + frame * 0.4, k), ...extE(extra), d: f0, p: [p[0], p[1] - frame, p[2]], m: fm },
    { t: 'ext', ax, poly: archPoly(w, s, k), ...extE(extra), d: d0, p, m },
  ];
  if (bars) {
    const bx = out > 0 ? 0.03 : -0.03;
    parts.push(ax === 'z'
      ? { t: 'box', s: [0.025, top * 0.92, 0.02], p: [p[0], p[1] + top * 0.46, p[2] + bx], m: fm, d: 1, ...extra }
      : { t: 'box', s: [0.02, top * 0.92, 0.025], p: [p[0] + bx, p[1] + top * 0.46, p[2]], m: fm, d: 1, ...extra });
    parts.push(ax === 'z'
      ? { t: 'box', s: [w * 2, 0.025, 0.02], p: [p[0], p[1] + s * 0.75, p[2] + bx], m: fm, d: 1, ...extra }
      : { t: 'box', s: [0.02, 0.025, w * 2], p: [p[0] + bx, p[1] + s * 0.75, p[2]], m: fm, d: 1, ...extra });
  }
  return parts;
}

/** A glowing rose window: red glass disc, bronze ring, radial tracery. ax 'x' faces +x (out = -1: -x); 'z' faces +z. */
export function roseWindow(ax, p, r, opts = {}) {
  const { out = 1, spokes = 8, extra = {} } = opts;
  const o = (v) => (ax === 'x' ? [p[0] + v * out, p[1], p[2]] : [p[0], p[1], p[2] + v * out]);
  const parts = [
    { t: 'ext', ax, poly: circlePoly(r, 12), ...extE(extra), d: [-0.012, 0.012], p: o(0.012), m: 'glowR' },
    ring(ax, o(0.02), r + 0.05, 0.08, 0.05, 'bronze', extra, 12),
    ring(ax, o(0.03), r * 0.35, 0.04, 0.03, 'bronze', { d: 1, ...extra }, 8),
  ];
  for (let i = 0; i < spokes / 2; i++) {
    const a = i * 360 / spokes;
    parts.push(ax === 'x'
      ? { t: 'box', s: [0.02, r * 2, 0.025], p: o(0.035), r3: [a, 0, 0], m: 'bronze', d: 1, ...extra }
      : { t: 'box', s: [0.025, r * 2, 0.02], p: o(0.035), r3: [0, 0, a], m: 'bronze', d: 1, ...extra });
  }
  return parts;
}

/** A spoked wheel turning about Z (rim, hub, n spokes), mirrored to both sides unless mir: false. */
export function spokedWheel(p, r, opts = {}) {
  const { n = 8, w = 0.12, rim = 'wood', hub = 'bronze2', spoke = 'wood', mir = true, extra = {} } = opts;
  const parts = [
    ring('z', p, r, r * 0.16, w, rim, { mir, ...extra }, 16),
    { t: 'cyl', ax: 'z', r: r * 0.2, l: w * 1.6, seg: 8, p, m: hub, mir, ...extra },
    ring('z', p, r + 0.02, 0.04, w * 0.6, 'bronze', { mir, d: 1, ...extra }, 16),
  ];
  for (let i = 0; i < n / 2; i++) parts.push({ t: 'box', s: [0.05, r * 1.9, w * 0.55], p, r3: [0, 0, i * 360 / n], m: spoke, mir, ...extra });
  return parts;
}

/** A box from a to b (centre line), `t` thick, `w` wide. */
export function strut(a, b, t, w, m, extra = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) / A_D2R, pitch = Math.atan2(dy, Math.hypot(dx, dz)) / A_D2R;
  return { t: 'box', s: [L, t, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m, ...extra };
}

/** A small spire / pinnacle: square base + tapered point. */
export const pinnacle = (x, y, z, h = 0.4, r = 0.07, m = 'iron2', extra = {}) => [
  { t: 'box', s: [r * 2, h * 0.3, r * 2], p: [x, y + h * 0.15, z], m, ...extra },
  { t: 'cyl', ax: 'y', r: [0, r * 1.1], l: h * 0.7, seg: 4, p: [x, y + h * 0.65, z], m, ...extra },
];

/** Brazier with flame and a dripping halo above it — the Troops' and Missile Flyer's crest. y = cup base. */
export function brazier(x, y, z, s = 1, extra = {}) {
  const parts = [
    { t: 'cyl', ax: 'y', r: [0.1 * s, 0.14 * s], l: 0.18 * s, seg: 8, p: [x, y - 0.09 * s, z], m: 'bronze2', ...extra },
    { t: 'cyl', ax: 'y', r: [0.3 * s, 0.2 * s], l: 0.3 * s, seg: 10, p: [x, y + 0.15 * s, z], m: 'bronze', ...extra },
    ring('y', [x, y + 0.31 * s, z], 0.32 * s, 0.05 * s, 0.04 * s, 'bronze2', extra, 12),
    { t: 'cyl', ax: 'y', r: [0, 0.24 * s], l: 0.75 * s, seg: 7, p: [x, y + 0.66 * s, z], m: 'glowF', ...extra },
    { t: 'cyl', ax: 'y', r: [0, 0.15 * s], l: 0.55 * s, seg: 6, p: [x + 0.02, y + 0.58 * s, z], r3: [0, 25, 0], m: 'glowR', ...extra },
    ring('y', [x, y + 1.2 * s, z], 0.5 * s, 0.06 * s, 0.05 * s, 'bronze', extra, 16),
  ];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2;
    parts.push({ t: 'box', s: [0.05 * s, 0.14 * s, 0.05 * s], p: [x + Math.cos(a) * 0.3 * s, y + 0.36 * s, z + Math.sin(a) * 0.3 * s], m: 'bronze', d: 1, ...extra });
  }
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2;
    parts.push({ t: 'cyl', ax: 'y', r: [0.025 * s, 0], l: 0.14 * s, seg: 4, p: [x + Math.cos(a) * 0.5 * s, y + 1.11 * s, z + Math.sin(a) * 0.5 * s], m: 'bronze', d: 1, ...extra });
  }
  return parts;
}

/** The hooded rider in a high-backed bronze seat (Troops / Missile Flyer). (x, y, z) = seat base. */
export const rider = (x, y, z) => [
  { t: 'box', s: [0.12, 0.7, 0.5], p: [x - 0.24, y + 0.35, z], r3: [0, 0, -8], m: 'bronze' },
  { t: 'box', s: [0.42, 0.08, 0.46], p: [x, y + 0.04, z], m: 'bronze2' },
  { t: 'cyl', ax: 'y', r: [0.14, 0.26], l: 0.5, seg: 7, p: [x, y + 0.3, z], m: 'robe' },
  { t: 'ell', s: [0.17, 0.2, 0.16], seg: 8, p: [x, y + 0.64, z], m: 'robe' },
  { t: 'box', s: [0.04, 0.13, 0.1], p: [x + 0.13, y + 0.62, z], m: 'bronze' },
  { t: 'box', s: [0.02, 0.025, 0.08], p: [x + 0.155, y + 0.64, z], m: 'black', d: 1 },
  { t: 'box', s: [0.06, 0.4, 0.12], p: [x - 0.05, y + 0.25, z + 0.24], r3: [-15, 0, 0], m: 'bronze2', d: 1 },
];

/** The domed shrine body the Troops and Missile Flyer share: an iron egg on a base deck, bronze ribs and belt, a glowing
 *  pointed-arch window on the front, a red sigil on each flank, a brazier crest and the hooded rider behind it. */
export function shrineBody(y0 = 0.55) {
  const C = [0.05, y0 + 0.62, 0], RX = 1.05, RY = 1.0, RZ = 0.84;
  return [
    // (owner's updated Troops concept 2026-10-20: the dome sits straight down between the tracks — no flat deck) a dark
    // skirt closes its underside
    { t: 'cyl', ax: 'y', r: [RX * 0.92, RX * 0.8], l: 0.3, seg: 12, p: [C[0], y0 + 0.05, 0], m: 'dark' },
    // the dome (a squashed ellipsoid, flat underside hidden in the deck)
    { t: 'ell', s: [RX, RY, RZ], seg: 14, p: C, m: 'iron' },
    // bronze ribs: fore-aft meridian, cross meridian, belt
    ellRing('z', C, RX + 0.02, RY + 0.02, 0.07, 0.08, 'bronze', {}, true),
    ellRing('x', C, RZ + 0.02, RY + 0.02, 0.07, 0.08, 'bronze', {}, true),
    ellRing('y', [C[0], C[1] + 0.05, 0], RX + 0.02, RZ + 0.02, 0.06, 0.08, 'bronze'),
    ellRing('x', [C[0] - 0.55, C[1], 0], RZ * 0.85, RY * 0.86, 0.05, 0.06, 'bronze2', { d: 1 }, true),
    // front: a pointed-arch gable bulging out of the dome's nose, holding the glowing window in a bronze frame
    { t: 'ext', ax: 'x', poly: archPoly(0.56, 0.5, 1.5), d: [C[0] + 0.2, C[0] + RX + 0.04], p: [0, y0 + 0.2, 0], m: 'iron' },
    { t: 'ext', ax: 'x', poly: archPoly(0.6, 0.52, 1.5), d: [C[0] + RX - 0.02, C[0] + RX + 0.06], p: [0, y0 + 0.18, 0], m: 'bronze' },
    ...archWindow('x', [C[0] + RX + 0.06, y0 + 0.28, 0], 0.44, 0.44, { k: 1.5, frame: 0.0 }),
    // red sigil on each flank, bronze-rimmed
    { t: 'ext', ax: 'z', poly: [[0, -0.18], [0.12, 0], [0, 0.22], [-0.12, 0]], d: [0, 0.02], p: [C[0] - 0.05, C[1] + 0.05, RZ - 0.06], m: 'glowR', mir: true },
    ring('z', [C[0] - 0.05, C[1] + 0.05, RZ - 0.07], 0.25, 0.04, 0.03, 'bronze', { mir: true, d: 1 }, 12),
    // brazier crest on top, rider seat behind it
    { t: 'cyl', ax: 'y', r: 0.22, l: 0.12, seg: 10, p: [C[0] + 0.15, C[1] + RY - 0.04, 0], m: 'bronze2' },
    ...brazier(C[0] + 0.15, C[1] + RY + 0.1, 0, 0.9),
    ...rider(C[0] - 0.55, C[1] + RY * 0.72, 0.28),
  ];
}
export const SHRINE = Object.freeze({ cx: 0.05, rx: 1.05, ry: 1.0, rz: 0.84 });
