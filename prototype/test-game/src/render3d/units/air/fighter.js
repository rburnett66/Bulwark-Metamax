// src/render3d/units/air/fighter.js — AIR-Planes: Ace interceptor (owner concept tools/unit-models/ref/air/air-fighter.png)
// [MM-story_mvh8woji_1]. A white interceptor: long needle nose, navy bubble canopy, big side intakes with navy lips, twin
// engine nacelles, canards, swept wings with cherry-red stripes and navy leading edges, twin tall tails with red caps and a
// roundel. Flies like the jet (hover, no turret).
import { AIR_COLORS } from './palette.js';

const fus = (yb, yt, w) => { const h = yt - yb, ym = yb + 0.45 * h; return [[0, yb], [w * 0.7, yb + 0.15 * h], [w, ym], [w * 0.6, yt - 0.1 * h], [0, yt], [-w * 0.6, yt - 0.1 * h], [-w, ym], [-w * 0.7, yb + 0.15 * h]]; };
const can = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.7, yb + 0.7 * (yt - yb)], [0, yt], [-w * 0.7, yb + 0.7 * (yt - yb)]];
// intake / nacelle cross-section (z, y), outboard of the spine
const nac = (zi, zo, yb, yt) => [[zi, yb], [zo - 0.04, yb], [zo, yb + 0.06], [zo, yt - 0.06], [zo - 0.06, yt], [zi, yt]];
// the intake mouth at fraction k of the full nacelle (owner 2026-10-20: "front inlets smaller by 50%"): it keeps its inner
// edge on the fuselage and shrinks about its vertical centre; `belly` = the navy band's top as a fraction of the height
const NAC = { zi: 0.2, zo: 0.6, yb: 0.28, yt: 0.66 }, BELLY = (0.4 - 0.28) / (0.66 - 0.28);
const inlet = (k, grow = 0) => { const zo = NAC.zi + (NAC.zo - NAC.zi) * k + grow, yc = (NAC.yb + NAC.yt) / 2, h = (NAC.yt - NAC.yb) * k / 2; return [NAC.zi, zo, yc - h, yc + h]; };
const nacK = (k, grow = 0, band = 1) => { const [zi, zo, yb, yt] = inlet(k, grow); return nac(zi, zo, yb, band < 1 ? yb + (yt - yb) * band : yt); };
// fin built at its root then rotated outward
const FIN = { p: [0, 0.74, 0.34], r3: [12, 0, 0] };
// a point on the fin's plane (local x along the root, y up the fin) → model space, for parts placed on the fin
const finAt = (x, y) => ({ p: [x, FIN.p[1] + y * Math.cos(12 * Math.PI / 180), FIN.p[2] + y * Math.sin(12 * Math.PI / 180)], r3: FIN.r3 });

const parts = [
  // fuselage spine: needle nose → cockpit → dorsal
  { t: 'loft', ax: 'x', secs: [
    [2.3, fus(0.53, 0.56, 0.015)], [1.95, fus(0.46, 0.64, 0.08)], [1.5, fus(0.38, 0.76, 0.16)], [1.0, fus(0.32, 0.84, 0.22)],
    [0.4, fus(0.3, 0.86, 0.26)], [-0.6, fus(0.3, 0.84, 0.26)], [-1.5, fus(0.32, 0.76, 0.22)], [-1.9, fus(0.36, 0.68, 0.16)]], m: 'paint' },
  { t: 'loft', ax: 'x', secs: [[2.32, fus(0.535, 0.555, 0.01)], [2.1, fus(0.5, 0.6, 0.05)]], m: 'red' },
  // navy bubble canopy + navy dorsal stripe
  { t: 'loft', ax: 'x', secs: [[1.62, can(0.72, 0.74, 0.04)], [1.35, can(0.73, 0.92, 0.15)], [0.95, can(0.76, 0.98, 0.17)], [0.6, can(0.79, 0.9, 0.11)], [0.42, can(0.8, 0.83, 0.04)]], m: 'glass' },
  { t: 'box', s: [1.7, 0.03, 0.16], p: [-0.6, 0.855, 0], m: 'navy' },
  { t: 'box', s: [1.7, 0.035, 0.03], p: [-0.6, 0.86, 0], m: 'red', d: 1 },
  // side intakes → engine nacelles (white top, navy belly), navy intake lips
  // the mouth is half size at the front and swells back to the full nacelle by mid-fuselage
  { t: 'loft', ax: 'x', secs: [
    [1.05, nacK(0.5)], [0.55, nacK(0.72)], [-0.2, nac(0.2, 0.66, 0.26, 0.7)], [-1.2, nac(0.18, 0.62, 0.28, 0.68)], [-1.85, nac(0.16, 0.52, 0.32, 0.62)]], m: 'paint', mir: true },
  { t: 'loft', ax: 'x', secs: [
    [1.0, nacK(0.5, 0.01, BELLY + 0.04)], [0.55, nacK(0.72, 0.01, BELLY + 0.02)], [-0.2, nac(0.2, 0.67, 0.25, 0.4)], [-1.2, nac(0.18, 0.63, 0.27, 0.4)], [-1.82, nac(0.16, 0.53, 0.31, 0.42)]], m: 'navy', mir: true },
  { t: 'loft', ax: 'x', secs: [[1.1, nacK(0.56, 0.02)], [1.02, nacK(0.56, 0.02)]], m: 'navy', mir: true },
  { t: 'box', s: [0.02, 0.15, 0.15], p: [1.11, 0.47, 0.31], m: 'black', mir: true },
  // canards
  { t: 'ext', ax: 'y', poly: [[1.0, 0.6], [0.7, 1.05], [0.55, 1.05], [0.6, 0.62]], d: [0.6, 0.63], m: 'paint', mir: true },
  // main wings: swept, white, navy leading edge, red stripe, red tip
  { t: 'ext', ax: 'y', poly: [[0.45, 0.6], [-0.95, 2.05], [-1.35, 2.05], [-1.55, 0.6]], d: [0.46, 0.52], m: 'paint', mir: true },
  { t: 'ext', ax: 'y', poly: [[0.45, 0.6], [-0.95, 2.05], [-1.02, 2.05], [0.32, 0.6]], d: [0.465, 0.53], m: 'navy', mir: true },
  { t: 'ext', ax: 'y', poly: [[-0.05, 0.62], [-1.12, 1.82], [-1.24, 1.82], [-0.2, 0.62]], d: [0.52, 0.532], m: 'red', mir: true },
  { t: 'box', s: [0.4, 0.07, 0.05], p: [-1.16, 0.49, 2.06], m: 'red', mir: true },
  // tailplanes
  { t: 'ext', ax: 'y', poly: [[-1.45, 0.6], [-1.9, 1.15], [-2.1, 1.15], [-2.02, 0.58]], d: [0.46, 0.5], m: 'paint2', mir: true },
  // twin tall fins: white, navy root band, red cap, red roundel with a white core
  { t: 'ext', ax: 'z', poly: [[-0.95, 0], [-1.45, 1.05], [-1.72, 1.05], [-1.92, 0]], d: [-0.03, 0.03], ...FIN, m: 'paint', mir: true },
  { t: 'ext', ax: 'z', poly: [[-1.0, 0], [-1.07, 0.15], [-1.86, 0.15], [-1.92, 0]], d: [-0.035, 0.035], ...FIN, m: 'navy', mir: true },
  { t: 'ext', ax: 'z', poly: [[-1.4, 0.94], [-1.45, 1.06], [-1.72, 1.06], [-1.7, 0.94]], d: [-0.035, 0.035], ...FIN, m: 'red', mir: true },
  { t: 'cyl', ax: 'z', r: 0.13, l: 0.075, seg: 10, ...finAt(-1.5, 0.58), m: 'red', mir: true },
  { t: 'cyl', ax: 'z', r: 0.07, l: 0.085, seg: 10, ...finAt(-1.5, 0.58), m: 'paint', mir: true },
  // nozzles
  { t: 'cyl', ax: 'x', r: [0.17, 0.2], l: 0.2, seg: 12, p: [-1.98, 0.47, 0.36], m: 'metal', mir: true },
  { t: 'cyl', ax: 'x', r: 0.14, l: 0.02, seg: 12, p: [-2.09, 0.47, 0.36], m: 'glowB', mir: true },
  // underwing missiles
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.7, seg: 6, p: [-0.7, 0.38, 1.3], m: 'paint2', mir: true, d: 1 },
  { t: 'cyl', ax: 'x', r: [0.0, 0.05], l: 0.12, seg: 6, p: [-0.29, 0.38, 1.3], m: 'red', mir: true, d: 1 },
];

export const AIR_FIGHTER = { name: 'Ace interceptor', unit: 'AIR-Planes', ref: 'air_fighter', colors: AIR_COLORS,
  parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
