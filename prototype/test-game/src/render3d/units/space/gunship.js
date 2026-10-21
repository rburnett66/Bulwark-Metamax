// src/render3d/units/space/gunship.js — SPC-Copters: Ring lander (owner concept tools/unit-models/ref/space/space-copter.png)
// [MM-story_mvho2d6s_5]. A lunar-white domed lander cabin with a federation-blue band and a cockpit glazed across its nose,
// circled by a gunmetal thruster ring carrying four gold-capped thruster pods, standing on four landing legs, with a sensor
// dish and a magenta beacon on top. No rotor: the ring's thrusters carry it.
import { SPACE_COLORS, dish, beacon } from './palette.js';
import { ring, strut } from '../arcane/palette.js';

const C = [0, 1.2, 0];

export const SPACE_GUNSHIP = { name: 'Ring lander', unit: 'SPC-Copters', ref: 'space_gunship', colors: SPACE_COLORS,
  parts: [
    // cabin: blue band drum, white dome, white skirt below
    { t: 'cyl', ax: 'y', r: [1.0, 1.05], l: 0.3, seg: 16, p: [C[0], C[1], 0], m: 'fed' },
    { t: 'ell', s: [1.0, 0.75, 1.0], seg: 14, p: [C[0], C[1] + 0.15, 0], m: 'lunar' },
    { t: 'cyl', ax: 'y', r: [1.05, 0.7], l: 0.35, seg: 16, p: [C[0], C[1] - 0.32, 0], m: 'lunar2' },
    // cockpit glazing across the nose
    ...[-36, -12, 12, 36].map((a) => ({ t: 'box', s: [0.05, 0.22, 0.28], p: [Math.cos(a * Math.PI / 180) * 0.86, C[1] + 0.48, Math.sin(a * Math.PI / 180) * 0.86], r3: [0, -a, 28], m: 'glass' })),
    { t: 'cyl', ax: 'z', r: 0.15, l: 0.02, seg: 10, p: [0.1, C[1], 1.04], r3: [0, 0, 0], m: 'lunar', mir: true },
    // thruster ring + four gold-capped pods
    ring('y', C, 1.6, 0.26, 0.26, 'gun', {}, 20),
    ...[45, 135, 225, 315].flatMap((a) => { const x = Math.cos(a * Math.PI / 180) * 1.62, z = Math.sin(a * Math.PI / 180) * 1.62; return [
      { t: 'cyl', ax: 'y', r: 0.2, l: 0.42, seg: 10, p: [x, C[1], z], m: 'gun' },
      { t: 'cyl', ax: 'y', r: 0.21, l: 0.12, seg: 10, p: [x, C[1] + 0.14, z], m: 'foil' },
      { t: 'cyl', ax: 'y', r: [0.12, 0.17], l: 0.14, seg: 10, p: [x, C[1] - 0.27, z], m: 'foil' },
      { t: 'cyl', ax: 'y', r: 0.11, l: 0.02, seg: 10, p: [x, C[1] - 0.35, z], m: 'glowB' },
      strut([x * 0.62, C[1], z * 0.62], [x * 0.95, C[1], z * 0.95], 0.08, 0.08, 'gun'),
    ]; }),
    // landing legs
    ...[0, 90, 180, 270].map((a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
      return strut([c * 0.65, C[1] - 0.42, s * 0.65], [c * 1.05, 0.08, s * 1.05], 0.08, 0.08, 'metal'); }),
    ...[0, 90, 180, 270].map((a) => ({ t: 'cyl', ax: 'y', r: 0.14, l: 0.05, seg: 8, p: [Math.cos(a * Math.PI / 180) * 1.08, 0.04, Math.sin(a * Math.PI / 180) * 1.08], m: 'gun' })),
    // top: hatch ring, dish, beacon
    { t: 'cyl', ax: 'y', r: 0.24, l: 0.08, seg: 10, p: [-0.15, C[1] + 0.88, 0], m: 'gun' },
    ...dish(-0.15, C[1] + 0.9, 0, 0.26, { tilt: 30, yaw: 150, mast: 0.3 }),
    ...beacon(0.35, C[1] + 0.78, 0, 1.5),
    // chin cannon
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.6, seg: 8, p: [1.05, C[1] - 0.45, 0], m: 'gun' },
  ],
  pivots: {}, hover: 1,
  muzzles: [{ p: [1.36, C[1] - 0.45, 0], d: [1, 0, 0], back: 0.2 }],
  views: { side: 'left', top: 'down' } };
