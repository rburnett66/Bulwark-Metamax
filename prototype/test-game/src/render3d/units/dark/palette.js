// src/render3d/units/dark/palette.js — the DARK ENERGY (Twilight Cult) faction livery and shared parts for its 3D models
// [MM-story_mvifm4xj_1]. Sampled from the owner's concepts (tools/unit-models/ref/dark/*.png; the fighter sheet names the
// set: void black, shadow purple, twilight ash, dark-energy violet): cracked obsidian hulls split by glowing violet veins,
// pale bone shields carrying an eye sigil, clusters of lilac fungus, dripping purple tendrils. Shared keys (dark, black,
// track, metal, glass, glow) keep their usual meaning; glowV is the violet energy (unlit). Values sit a shade above the
// concepts' near-black so the hulls still read on a dark battlefield.
//
// Shared builders (veins, fungus clusters, eye sigils, tendrils) live here; classic.mjs loads palette.js first.
import { circlePoly } from '../arcane/palette.js';

export const DARK_COLORS = Object.freeze({
  // owner 2026-10-21: "the dark energy units should be purple but the metallic finish makes them look silver" — the
  // stone is a real deep purple now, and its finish matte (metal.js), so the sky no longer silvers it
  void: 0x2c1a3c,    // void-purple obsidian (the main body colour)
  obsid: 0x3c2454,   // shadow-purple stone: turrets, plates
  ash: 0x5e4878,     // twilight ash-violet: worn edges, frames
  bone: 0xbcaec8,    // pale lilac bone shields and masks
  fungus: 0xa88cc4,  // lilac fungus caps
  tendril: 0x5c2c8c, // purple tendrils and vines
  glowV: 0xa65cff,   // dark-energy violet (unlit)
  hull: 0x2c1a3c, hull2: 0x3c2454, panel: 0x341f48,   // aliases so shared helpers stay on palette
  dark: 0x1f1429, black: 0x110b17, track: 0x241a2e, metal: 0x5f5070, glass: 0x1a1226,
  glow: 0xa65cff, glowB: 0xc58bff, amber: 0xffb340,
});

/** Glowing violet cracks laid on a wall: a zig-zag of thin strips. ax 'z' = a side wall (outward +z; mir it),
 *  'y' = a top face, 'x' = a front face. pts: [[u, v], ...] in the wall's plane; at = the wall's offset. */
export function veins(ax, at, pts, w = 0.035, extra = {}) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [u0, v0] = pts[i], [u1, v1] = pts[i + 1], L = Math.hypot(u1 - u0, v1 - v0), a = Math.atan2(v1 - v0, u1 - u0) * 180 / Math.PI;
    const c = [(u0 + u1) / 2, (v0 + v1) / 2];
    if (ax === 'z') out.push({ t: 'box', s: [L + w, w, 0.02], p: [c[0], c[1], at], r3: [0, 0, a], m: 'glowV', ...extra });
    else if (ax === 'y') out.push({ t: 'box', s: [L + w, 0.02, w], p: [c[0], at, c[1]], r3: [0, -a, 0], m: 'glowV', ...extra });
    else out.push({ t: 'box', s: [0.02, w, L + w], p: [at, c[1], c[0]], r3: [-a, 0, 0], m: 'glowV', ...extra });
  }
  return out;
}

/** A cluster of lilac fungus: n caps on short stems around (x, y, z), sizes fixed by index (no randomness). */
export function fungus(x, y, z, n = 3, s0 = 1, extra = {}) {
  const s = s0 * 1.6;   // caps sized to read at battle zoom
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 0.07 * s * (i ? 1 : 0), k = s * (1 - i * 0.18), cx = x + Math.cos(a) * r * 1.6, cz = z + Math.sin(a) * r * 1.6;
    out.push({ t: 'cyl', ax: 'y', r: 0.02 * k, l: 0.09 * k, seg: 4, p: [cx, y + 0.045 * k, cz], m: 'bone', d: 1, ...extra });
    out.push({ t: 'ell', s: [0.07 * k, 0.04 * k, 0.07 * k], seg: 6, p: [cx, y + 0.1 * k, cz], m: 'fungus', ...extra });
  }
  return out;
}

/** An eye sigil facing along `ax` ('x' front, 'z' side): a bone almond, a violet iris ring, a dark pupil. */
export function eye(ax, p, s = 1, extra = {}) {
  const almond = [[-0.3, 0], [-0.15, 0.12], [0, 0.16], [0.15, 0.12], [0.3, 0], [0.15, -0.12], [0, -0.16], [-0.15, -0.12]].map(([u, v]) => [u * s, v * s]);
  const o = (k) => (ax === 'x' ? [p[0] + k, p[1], p[2]] : [p[0], p[1], p[2] + k]);
  return [
    { t: 'ext', ax, poly: ax === 'x' ? almond.map(([u, v]) => [u, v]) : almond, d: [0, 0.02], p: o(0), m: 'glowV', ...extra },
    { t: 'ext', ax, poly: circlePoly(0.1 * s, 10), d: [0, 0.03], p: o(0.005), m: 'bone', ...extra },
    { t: 'ext', ax, poly: circlePoly(0.05 * s, 8), d: [0, 0.04], p: o(0.008), m: 'black', ...extra },
  ];
}

/** A tendril hanging from (x, y, z): three tapering segments drooping down and out, a violet bead at the tip. */
export function tendril(x, y, z, L = 0.5, lean = 15, extra = {}) {
  const seg = L / 3, out = [];
  let cx = x, cy = y;
  for (let i = 0; i < 3; i++) {
    const a = (lean + i * 10) * Math.PI / 180, dx = Math.sin(a) * seg, dy = -Math.cos(a) * seg;
    out.push({ t: 'cyl', ax: 'y', r: [0.04 - i * 0.01, 0.03 - i * 0.008], l: seg, seg: 5, p: [cx + dx / 2, cy + dy / 2, z], r3: [0, 0, lean + i * 10], m: 'tendril', ...extra });
    cx += dx; cy += dy;
  }
  out.push({ t: 'ell', s: [0.03, 0.035, 0.03], seg: 5, p: [cx, cy, z], m: 'glowV', d: 1, ...extra });
  return out;
}
