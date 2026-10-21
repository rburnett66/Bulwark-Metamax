// src/render3d/units/arcane/fighter.js — ARC-Planes: Seraph raven (owner concept tools/unit-models/ref/arcane/arcane-fighter.png)
// [MM-story_mvhnbx8n_4]. A black raven of a jet: a long needle beak of a nose, a slim black fuselage, great raised angel's
// wings — black coverts over a fan of long bronze primaries — a fanned black tail, two engines burning red, and a small
// bronze halo floating over the cockpit. Flies like the jet (hover, no turret).
import { ARCANE_COLORS, ring } from './palette.js';

const fus = (rz, ry, cy) => [[0, cy - ry], [rz * 0.8, cy - ry * 0.55], [rz, cy], [rz * 0.6, cy + ry * 0.8], [0, cy + ry], [-rz * 0.6, cy + ry * 0.8], [-rz, cy], [-rz * 0.8, cy - ry * 0.55]];
const DIH = -30;            // wing dihedral (raised, like the concept's lifted wings)
const ROOT = [0.15, 0.68, 0.22];
// one feather in the wing's local (x, z) plane: from base b along direction angle a (deg; 180 = aft, 90 = outboard),
// length L, half-width w, tapering to a point
const feather = (b, a, L, w) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180), nx = -s, nz = c;
  return [[b[0] + nx * w, b[1] + nz * w], [b[0] + c * L * 0.8 + nx * w * 0.8, b[1] + s * L * 0.8 + nz * w * 0.8], [b[0] + c * L, b[1] + s * L],
    [b[0] + c * L * 0.8 - nx * w * 0.8, b[1] + s * L * 0.8 - nz * w * 0.8], [b[0] - nx * w, b[1] - nz * w]]; };

const parts = [
  // fuselage: needle beak → cockpit → body → tail
  { t: 'loft', ax: 'x', m: 'robe', secs: [
    [2.75, fus(0.01, 0.01, 0.66)], [2.0, fus(0.08, 0.07, 0.65)], [1.2, fus(0.2, 0.18, 0.66)], [0.4, fus(0.3, 0.26, 0.68)],
    [-0.6, fus(0.28, 0.24, 0.7)], [-1.4, fus(0.16, 0.14, 0.72)], [-1.7, fus(0.08, 0.07, 0.74)]] },
  { t: 'loft', ax: 'x', m: 'bronze', secs: [[2.78, fus(0.006, 0.006, 0.66)], [2.5, fus(0.03, 0.03, 0.66)]] },
  // cockpit: dark glass under a bronze spine
  { t: 'loft', ax: 'x', m: 'glass', secs: [[1.5, fus(0.05, 0.03, 0.8)], [1.15, fus(0.14, 0.1, 0.86)], [0.75, fus(0.14, 0.1, 0.88)], [0.5, fus(0.06, 0.04, 0.88)]] },
  { t: 'box', s: [1.9, 0.03, 0.05], p: [-0.35, 0.95, 0], m: 'bronze' },
  // the halo over the cockpit
  ring('y', [0.95, 1.32, 0], 0.22, 0.04, 0.03, 'bronze', {}, 16),
  { t: 'cyl', ax: 'y', r: 0.012, l: 0.32, seg: 4, p: [0.95, 1.12, 0], m: 'bronze2' },
  // wings (raised): bronze covert panel, dark bronze leading edge, a fan of eight long primaries sweeping aft and out
  { t: 'ext', ax: 'y', poly: [[0.35, 0.0], [-0.2, 1.5], [-0.95, 2.55], [-1.3, 2.4], [-1.05, 1.2], [-0.75, 0.0]], d: [-0.03, 0.03], p: ROOT, r3: [DIH, 0, 0], m: 'bronze2', mir: true },
  { t: 'ext', ax: 'y', poly: [[0.35, 0.0], [-0.2, 1.5], [-0.95, 2.55], [-0.9, 2.66], [-0.1, 1.55], [0.44, 0.05]], d: [-0.035, 0.035], p: ROOT, r3: [DIH, 0, 0], m: 'robe', mir: true },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ t: 'ext', ax: 'y', poly: feather([-0.75 - i * 0.07, 0.2 + i * 0.3], 172 - i * 8, 0.9 + i * 0.1, 0.11),
    d: [-0.02 - i * 0.003, 0.02 + i * 0.003], p: ROOT, r3: [DIH, 0, 0], m: i % 2 ? 'bronze' : 'metal', mir: true })),
  // fanned black tail feathers
  ...[-30, -15, 0].map((a, i) => ({ t: 'ext', ax: 'y', poly: feather([0, 0.02], 180 + a, 0.85 - i * 0.05, 0.1), d: [-0.02, 0.02], p: [-1.3, 0.74, 0], m: i === 2 ? 'bronze2' : 'robe', mir: i !== 2 })),
  // engines under the wing roots, red exhaust
  ...[0.32].flatMap((z) => [
    { t: 'cyl', ax: 'x', r: [0.12, 0.14], l: 1.1, seg: 10, p: [-0.75, 0.5, z], m: 'iron', mir: true },
    { t: 'cyl', ax: 'x', r: 0.15, l: 0.08, seg: 10, p: [-0.25, 0.5, z], m: 'bronze', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [-1.31, 0.5, z], m: 'glowR', mir: true },
    { t: 'cyl', ax: 'x', r: [0.09, 0.0], l: 0.5, seg: 8, p: [-1.57, 0.5, z], m: 'glowF', mir: true },
  ]),
];

export const ARCANE_FIGHTER = { name: 'Seraph raven', unit: 'ARC-Planes', ref: 'arcane_fighter', colors: ARCANE_COLORS,
  parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
