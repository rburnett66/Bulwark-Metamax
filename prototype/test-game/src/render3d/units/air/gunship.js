// src/render3d/units/air/gunship.js — AIR-Copters: the shark-mouth attack gunship (owner concept
// tools/unit-models/ref/air/air-gunship.png) [MM-story_mvh8woji_1].
// A slim white attack helicopter: stepped tandem canopy, chin cannon, red shark mouth on the nose, engine pods with a
// navy "07" panel, stub wings carrying a navy rocket pod and gun pod a side, a thin boom with navy bands, a white fin
// with a navy cap and a pink blossom. The four-blade main rotor (group `spin`, pink tips) and the tail rotor (`spin2`)
// turn in the battle view. X forward, Y up, Z right; ≈ 4 units nose to tail.
import { AIR_COLORS } from './palette.js';

const GD = Math.PI / 180;
// a flat blade from the hub at c, length L, at yaw a (degrees) about Y
const gBlade = (c, L, a, w, h, m, g, from = 0) => ({ t: 'box', s: [L, h, w], p: [c[0] + Math.cos(a * GD) * (from + L / 2), c[1], c[2] - Math.sin(a * GD) * (from + L / 2)], r3: [0, a, 0], m, g });
// fuselage cross-section (z, y): an octagon between yb and yt, half-width w
const gOct = (yb, yt, w) => { const h = yt - yb; return [[w * 0.5, yb], [w, yb + 0.3 * h], [w * 0.85, yt - 0.2 * h], [w * 0.4, yt], [-w * 0.4, yt], [-w * 0.85, yt - 0.2 * h], [-w, yb + 0.3 * h], [-w * 0.5, yb]]; };
const G_HUB = [0.15, 1.2, 0], G_TR = [-2.05, 1.3, 0.1];

export const AIR_GUNSHIP = { name: 'Shark gunship', unit: 'AIR-Copters', ref: 'air_gunship', colors: AIR_COLORS,
  parts: [
    // fuselage: pointed nose → cockpit → engine bay → thin boom
    { t: 'loft', ax: 'x', secs: [
      [2.0, gOct(0.3, 0.38, 0.04)], [1.75, gOct(0.16, 0.56, 0.2)], [1.3, gOct(0.08, 0.66, 0.29)], [0.6, gOct(0.06, 0.74, 0.34)],
      [-0.3, gOct(0.1, 0.9, 0.35)], [-0.8, gOct(0.32, 0.84, 0.22)], [-1.95, gOct(0.6, 0.78, 0.08)]], m: 'paint' },
    // stepped tandem canopy (navy frame, dark glass) — gunner front, pilot higher behind
    { t: 'loft', ax: 'x', secs: [[1.5, gOct(0.55, 0.58, 0.14)], [1.2, gOct(0.55, 0.86, 0.25)], [0.9, gOct(0.62, 0.92, 0.25)], [0.6, gOct(0.66, 1.06, 0.25)], [0.2, gOct(0.8, 1.06, 0.22)]], m: 'glass' },
    { t: 'box', s: [0.06, 0.34, 0.52], p: [0.9, 0.84, 0], m: 'navy' },
    { t: 'box', s: [0.06, 0.3, 0.48], p: [0.42, 0.96, 0], m: 'navy' },
    { t: 'box', s: [1.3, 0.05, 0.04], p: [0.85, 0.86, 0.255], r3: [0, 0, 12], m: 'navy', mir: true },
    // shark mouth: red jaw band with white teeth, a red eye — both sides of the nose
    { t: 'ext', ax: 'z', poly: [[1.95, 0.3], [1.62, 0.12], [1.22, 0.1], [1.26, 0.3], [1.62, 0.34]], d: [0.0, 0.27], m: 'red', mir: true },
    ...[1.32, 1.44, 1.56, 1.68, 1.8].map((x) => ({ t: 'ext', ax: 'z', poly: [[x - 0.045, 0.31], [x + 0.045, 0.31], [x, 0.21]], d: [0.25, 0.28], m: 'paint', mir: true })),
    ...[1.38, 1.5, 1.62, 1.74].map((x) => ({ t: 'ext', ax: 'z', poly: [[x - 0.045, 0.11], [x + 0.045, 0.11], [x, 0.19]], d: [0.25, 0.28], m: 'paint', mir: true })),
    { t: 'box', s: [0.09, 0.06, 0.02], p: [1.48, 0.44, 0.26], m: 'red', mir: true },
    // chin turret + cannon
    { t: 'cyl', ax: 'y', r: 0.1, l: 0.12, seg: 8, p: [1.45, 0.14, 0], m: 'navy' },
    { t: 'cyl', ax: 'x', r: 0.03, l: 0.55, seg: 6, p: [1.75, 0.12, 0], m: 'dark' },
    // engine pods either side of the spine, with the navy "07" panel and dark intakes/exhausts
    { t: 'box', s: [0.85, 0.3, 0.22], p: [-0.15, 0.86, 0.3], m: 'paint', mir: true },
    { t: 'box', s: [0.42, 0.26, 0.02], p: [-0.3, 0.86, 0.415], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.11, l: 0.04, seg: 8, p: [0.28, 0.86, 0.3], m: 'black', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.08, seg: 8, p: [-0.6, 0.88, 0.3], m: 'dark', mir: true },
    { t: 'box', s: [0.5, 0.1, 0.24], p: [0.1, 1.02, 0], m: 'paint2' },
    // stub wings, each with a rocket pod (outboard) and a gun pod (inboard)
    { t: 'ext', ax: 'y', poly: [[0.2, 0.3], [-0.25, 0.3], [-0.35, 1.0], [0.0, 1.0]], d: [0.5, 0.56], m: 'paint', mir: true },
    { t: 'box', s: [0.3, 0.02, 0.05], p: [-0.15, 0.565, 0.97], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.66, seg: 8, p: [-0.05, 0.3, 0.86], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.12, l: 0.03, seg: 8, p: [0.29, 0.3, 0.86], m: 'black', mir: true },
    { t: 'box', s: [0.08, 0.1, 0.06], p: [-0.05, 0.47, 0.86], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.58, seg: 8, p: [0.0, 0.3, 0.55], m: 'navy', mir: true },
    { t: 'cyl', ax: 'x', r: 0.09, l: 0.03, seg: 8, p: [0.3, 0.3, 0.55], m: 'black', mir: true },
    { t: 'box', s: [0.08, 0.1, 0.06], p: [0.0, 0.45, 0.55], m: 'dark', mir: true },
    // sakura petals scattered over the airframe (detail: dropped by LOD)
    ...[[0.95, 0.42, 0.33], [0.55, 0.3, 0.355], [0.25, 0.55, 0.36], [-0.1, 0.32, 0.36], [-0.55, 0.6, 0.27], [1.2, 0.55, 0.29]].map((p) => ({ t: 'ell', s: [0.05, 0.05, 0.012], seg: 6, p, m: 'pink', mir: true, d: 1 })),
    // boom: navy bands; tailplane; fin with navy cap and a pink blossom
    ...[-1.0, -1.15].map((x) => ({ t: 'box', s: [0.06, 0.24, 0.2], p: [x, 0.7, 0], m: 'navy' })),
    { t: 'ext', ax: 'y', poly: [[-1.55, 0.06], [-1.72, 0.38], [-1.84, 0.38], [-1.78, 0.06]], d: [0.66, 0.69], m: 'paint', mir: true },
    { t: 'ext', ax: 'z', poly: [[-1.5, 0.72], [-2.0, 0.66], [-2.2, 1.55], [-1.92, 1.55]], d: [-0.04, 0.04], m: 'paint' },
    { t: 'ext', ax: 'z', poly: [[-2.15, 1.34], [-2.2, 1.55], [-1.92, 1.55], [-1.87, 1.34]], d: [-0.045, 0.045], m: 'navy' },
    { t: 'ell', s: [0.17, 0.17, 0.02], seg: 10, p: [-1.94, 1.08, 0.04], m: 'pink', mir: true },
    // tail-rotor hub (fixed) on the right of the fin
    { t: 'cyl', ax: 'z', r: 0.04, l: 0.08, seg: 6, p: [G_TR[0], G_TR[1], 0.06], m: 'dark' },
    // main rotor mast (fixed)
    { t: 'cyl', ax: 'y', r: 0.07, l: 0.3, seg: 8, p: [G_HUB[0], 1.05, 0], m: 'dark' },
    // MAIN ROTOR (spins): navy hub, four light blades with pink tips
    { t: 'cyl', ax: 'y', r: 0.14, l: 0.08, seg: 10, p: G_HUB, m: 'navy', g: 'spin' },
    ...[45, 135, 225, 315].flatMap((a) => [gBlade(G_HUB, 1.1, a, 0.13, 0.02, 'paint2', 'spin', 0.1), gBlade(G_HUB, 0.4, a, 0.135, 0.022, 'pink', 'spin', 1.2)]),
    // TAIL ROTOR (spins about Z)
    ...[0, 90].map((a) => ({ t: 'box', s: [0.42, 0.04, 0.02], p: G_TR, r3: [0, 0, a], m: 'dark', g: 'spin2' })),
    { t: 'cyl', ax: 'z', r: 0.04, l: 0.05, seg: 6, p: G_TR, m: 'navy', g: 'spin2' },
  ],
  pivots: { spin: G_HUB, spin2: G_TR }, hover: 1,
  spin: { spin: { axis: 'y', speed: 22 }, spin2: { axis: 'z', speed: 40 } },
  views: { side: 'right', top: 'up' } };
