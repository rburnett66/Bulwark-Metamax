// src/render3d/units/arcane/missile.js — ARC-Missiles: Lantern of spears (owner concept
// tools/unit-models/ref/arcane/arcane-missile-launcher.png — the corrected image, 2026-10-20) [MM-story_mvhnbx8n_4].
// A flying gothic lantern: a hexagonal iron cage glazed with glowing red glass, a peaked roof and a hanging pendant
// finial, small feathered wings on bronze bosses at its sides, and a crown of ten red-tipped missiles fanned out above
// it. Its fire leaves the fan, so the muzzles sit at the spear tips.
import { ARCANE_COLORS, ring } from './palette.js';

const D = Math.PI / 180;
const Y0 = 0.7, Y1 = 1.8, R = 0.55;          // the lantern cage: base, top, hex radius
const FAN = { o: [0, Y1 + 0.3, 0], n: 10, spread: 72, lean: -12, L: 1.35, start: 0.25 };
const hex = (r) => Array.from({ length: 6 }, (_, i) => [Math.cos((i * 60 + 30) * D) * r, Math.sin((i * 60 + 30) * D) * r]);

// spear i of the fan: unit direction after r3 [a, 0, lean] (X first, then Z)
const spear = (i) => {
  const a = -FAN.spread + 2 * FAN.spread * i / (FAN.n - 1), b = FAN.lean;
  const dir = [-Math.sin(b * D) * Math.cos(a * D), Math.cos(b * D) * Math.cos(a * D), Math.sin(a * D)];
  const at = (t) => [FAN.o[0] + dir[0] * t, FAN.o[1] + dir[1] * t, FAN.o[2] + dir[2] * t];
  return { a, b, dir, at };
};

// a small feathered wing on the +z side, in the (z, y) plane: five tapered feathers drooping outward
const feather = (ang, L, w) => { const c = Math.cos(ang * D), s = Math.sin(ang * D), nz = -s, ny = c;
  return [[nz * w, ny * w], [c * L * 0.8 + nz * w * 0.7, s * L * 0.8 + ny * w * 0.7], [c * L, s * L], [c * L * 0.8 - nz * w * 0.7, s * L * 0.8 - ny * w * 0.7], [-nz * w, -ny * w]]; };

export const ARCANE_MISSILE = { name: 'Lantern of spears', unit: 'ARC-Missiles', ref: 'arcane_missile', colors: ARCANE_COLORS,
  parts: [
    // the cage: glowing red glass hexagon inside an iron frame with corner mullions and bronze bands
    { t: 'cyl', ax: 'y', r: R - 0.04, l: Y1 - Y0, seg: 6, p: [0, (Y0 + Y1) / 2, 0], m: 'glowR' },
    ...hex(R).map(([x, z]) => ({ t: 'box', s: [0.08, Y1 - Y0, 0.08], p: [x, (Y0 + Y1) / 2, z], m: 'iron' })),
    ...[Y0, Y1].map((y) => ({ t: 'cyl', ax: 'y', r: R + 0.06, l: 0.12, seg: 6, p: [0, y, 0], m: 'bronze2' })),
    { t: 'cyl', ax: 'y', r: R + 0.02, l: 0.05, seg: 6, p: [0, (Y0 + Y1) / 2 - 0.12, 0], m: 'iron', d: 1 },
    // pointed-arch tracery on each glass face (a dark arch frame per face)
    ...hex(R - 0.01).map(([x, z], i) => { const a = (i * 60 + 60) * D, cx = Math.cos(a) * (R * 0.866), cz = Math.sin(a) * (R * 0.866);
      return { t: 'box', s: [0.025, (Y1 - Y0) * 0.8, 0.025], p: [cx, (Y0 + Y1) / 2, cz], m: 'iron', d: 1 }; }),
    // roof: hex pyramid with a cornice and a finial knob
    { t: 'cyl', ax: 'y', r: [0.12, R + 0.1], l: 0.32, seg: 6, p: [0, Y1 + 0.22, 0], m: 'iron' },
    { t: 'cyl', ax: 'y', r: 0.15, l: 0.14, seg: 8, p: [0, Y1 + 0.42, 0], m: 'bronze' },
    { t: 'cyl', ax: 'y', r: [0, 0.05], l: 0.22, seg: 4, p: [0, Y1 + 0.6, 0], m: 'bronze' },
    // bottom: inverted pyramid and a hanging pendant finial
    { t: 'cyl', ax: 'y', r: [R + 0.08, 0.14], l: 0.3, seg: 6, p: [0, Y0 - 0.2, 0], m: 'iron' },
    { t: 'ell', s: [0.1, 0.12, 0.1], seg: 8, p: [0, Y0 - 0.42, 0], m: 'bronze' },
    { t: 'cyl', ax: 'y', r: [0.05, 0], l: 0.25, seg: 4, p: [0, Y0 - 0.64, 0], m: 'bronze' },
    ring('y', [0, Y0 - 0.06, 0], R + 0.12, 0.05, 0.04, 'bronze'),
    // side wings on bronze bosses
    { t: 'cyl', ax: 'z', r: 0.12, l: 0.1, seg: 10, p: [0, 1.35, R + 0.05], m: 'bronze', mir: true },
    ...[10, -5, -20, -35, -50].map((ang, i) => ({ t: 'ext', ax: 'x', poly: feather(ang, 0.6 - i * 0.05, 0.06), d: [-0.015, 0.015], p: [-0.04 * i, 1.35, R + 0.1], m: i % 2 ? 'bronze2' : 'bronze', mir: true })),
    // the crown of spears: dark shafts, bronze collars and fins, glowing red tips
    { t: 'cyl', ax: 'z', r: 0.09, l: 0.5, seg: 8, p: FAN.o, m: 'bronze2' },
    ...Array.from({ length: FAN.n }, (_, i) => { const S = spear(i), r3 = [S.a, 0, S.b];
      return [
        { t: 'cyl', ax: 'y', r: 0.04, l: FAN.L, seg: 6, p: S.at(FAN.start + FAN.L / 2), r3, m: 'dark' },
        { t: 'cyl', ax: 'y', r: 0.055, l: 0.08, seg: 6, p: S.at(FAN.start + 0.15), r3, m: 'bronze' },
        { t: 'box', s: [0.16, 0.14, 0.02], p: S.at(FAN.start + 0.12), r3, m: 'bronze2', d: 1 },
        { t: 'cyl', ax: 'y', r: [0, 0.075], l: 0.24, seg: 6, p: S.at(FAN.start + FAN.L + 0.12), r3, m: 'glowR' },
      ];
    }).flat(),
  ],
  pivots: {}, hover: 1,
  muzzles: [1, 4, 5, 8].map((i) => { const S = spear(i); return { p: S.at(FAN.start + FAN.L + 0.25), d: S.dir, back: 0 }; }),
  views: { side: 'left', top: 'down' } };
