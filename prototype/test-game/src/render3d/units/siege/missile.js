// src/render3d/units/siege/missile.js — ART-Missiles: Rocket-box drone (owner concept tools/unit-models/ref/siege/siege-mortar-drone.png)
// [MM-story_mvhb6qd2_2]. A flying rocket-artillery box: a heavy riveted launcher box whose front face carries a 3 × 3 grid
// of tube openings (pointing forward, +X), held up by four rotors on long outrigger arms (groups `spin`…`spin4`, they
// turn), with a camera ball hanging underneath and short landing struts. Olive-drab box, dusty tan side plates.
import { SIEGE_COLORS } from './palette.js';

const QD = Math.PI / 180;
const qRing = (c, r, n, w, h, m, g) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2;
  return Object.assign({ t: 'box', s: [2 * Math.PI * r / n * 1.08, h, w], p: [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r], r3: [0, -(a / QD + 90), 0], m }, g ? { g } : {});
});
const qBlade = (c, L, a, w, h, m, g) => ({ t: 'box', s: [L, h, w], p: [c[0] + Math.cos(a * QD) * L / 2, c[1], c[2] - Math.sin(a * QD) * L / 2], r3: [0, a, 0], m, g });
const Q_FX = 1.25, Q_FZ = 1.45, Q_FY = 1.75, Q_R = 0.42;
const Q_FANS = [[Q_FX, Q_FZ], [Q_FX, -Q_FZ], [-Q_FX, Q_FZ], [-Q_FX, -Q_FZ]];
const BOX = { x0: -0.8, x1: 0.8, y0: 0.55, y1: 1.85, z: 0.7 };

const qParts = [
  // the launcher box (olive), chamfered side profile, riveted frame edges
  { t: 'ext', ax: 'z', poly: [[BOX.x0, BOX.y0 + 0.1], [BOX.x0 + 0.1, BOX.y0], [BOX.x1, BOX.y0], [BOX.x1, BOX.y1], [BOX.x0 + 0.12, BOX.y1], [BOX.x0, BOX.y1 - 0.12]], d: [-BOX.z, BOX.z], m: 'olive' },
  // front face frame + the 3 × 3 tube grid (dark tubes, black bores, pointing +X)
  { t: 'box', s: [0.06, BOX.y1 - BOX.y0 + 0.06, BOX.z * 2 + 0.06], p: [BOX.x1 + 0.02, (BOX.y0 + BOX.y1) / 2, 0], m: 'dark' },
  ...[1.6, 1.2, 0.8].flatMap((y) => [-0.42, 0, 0.42].flatMap((z) => [
    { t: 'cyl', ax: 'x', r: 0.17, l: 0.14, seg: 10, p: [BOX.x1 + 0.1, y, z], m: 'metal' },
    { t: 'cyl', ax: 'x', r: 0.12, l: 0.02, seg: 10, p: [BOX.x1 + 0.175, y, z], m: 'black' },
    { t: 'cyl', ax: 'x', r: 0.07, l: 0.02, seg: 8, p: [BOX.x1 + 0.18, y, z], m: 'rust', d: 1 },
  ])),
  // dusty tan side plates with a hazard stencil, rear access panel
  { t: 'box', s: [1.0, 0.8, 0.04], p: [-0.05, 1.2, BOX.z + 0.02], m: 'camo', mir: true },
  { t: 'box', s: [0.3, 0.06, 0.02], p: [0.2, 1.48, BOX.z + 0.05], m: 'hazard', mir: true },
  { t: 'box', s: [0.12, 0.12, 0.02], p: [-0.35, 0.95, BOX.z + 0.05], m: 'rust', mir: true, d: 1 },
  { t: 'box', s: [0.04, 0.9, 1.0], p: [BOX.x0 - 0.02, 1.2, 0], m: 'camo2' },
  // top deck: net-covered hump and the arm mounts
  { t: 'box', s: [1.5, 0.08, 1.3], p: [0, BOX.y1 + 0.04, 0], m: 'olive' },
  { t: 'box', s: [0.6, 0.06, 0.5], p: [-0.3, BOX.y1 + 0.1, 0.1], r3: [0, 15, 0], m: 'net', d: 1 },
  // dark riveted frame along the box's vertical and top edges
  ...[[BOX.x1, BOX.z], [BOX.x0 + 0.06, BOX.z]].map(([x, z]) => ({ t: 'box', s: [0.08, BOX.y1 - BOX.y0, 0.08], p: [x, (BOX.y0 + BOX.y1) / 2, z], m: 'dark', mir: true })),
  { t: 'box', s: [BOX.x1 - BOX.x0, 0.08, 0.08], p: [0, BOX.y0 + 0.04, BOX.z], m: 'dark', mir: true },
  { t: 'box', s: [1.7, 0.1, 0.24], p: [0, BOX.y1 - 0.05, 0.62], m: 'dark', mir: true },
  // camera ball under the box
  { t: 'box', s: [0.3, 0.16, 0.3], p: [0.35, BOX.y0 - 0.06, 0], m: 'dark' },
  { t: 'ell', s: [0.24, 0.24, 0.24], seg: 10, p: [0.4, BOX.y0 - 0.3, 0], m: 'olive' },
  { t: 'cyl', ax: 'x', r: 0.1, l: 0.05, seg: 10, p: [0.63, BOX.y0 - 0.3, 0], m: 'black' },
  { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 8, p: [0.665, BOX.y0 - 0.3, 0], m: 'glass' },
  // landing struts
  ...[[0.55, 0.5], [-0.55, 0.5]].map(([x, z]) => ({ t: 'box', s: [0.08, 0.35, 0.08], p: [x, BOX.y0 - 0.17, z], m: 'dark', mir: true })),
  ...[0.5].map((z) => ({ t: 'box', s: [1.3, 0.05, 0.08], p: [0, BOX.y0 - 0.36, z], m: 'dark', mir: true })),
  // four outrigger arms → motor pods → small ducted 2-blade rotors (they spin)
  ...Q_FANS.flatMap(([x, z], i) => {
    const c = [x, Q_FY, z], g = i ? 'spin' + (i + 1) : 'spin';
    const ax0 = Math.sign(x) * 0.6, az0 = Math.sign(z) * 0.62, ay0 = BOX.y1 - 0.08;
    const dx = x - ax0, dz = z - az0, L = Math.hypot(dx, dz) - 0.08;
    const yaw = -Math.atan2(dz, dx) / QD;
    return [
      { t: 'box', s: [L, 0.11, 0.13], p: [ax0 + dx / 2, (ay0 + Q_FY - 0.15) / 2, az0 + dz / 2], r3: [0, yaw, 4], m: 'dark' },   // arm
      { t: 'cyl', ax: 'y', r: 0.12, l: 0.3, seg: 8, p: [x, Q_FY - 0.15, z], m: 'olive' },                                      // motor pod
      ...qRing([x, Q_FY - 0.06, z], Q_R, 10, 0.05, 0.1, 'dark'),                                                             // duct ring
      // rotor (spins): two blades + spinner
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.06, seg: 8, p: [x, Q_FY + 0.02, z], m: 'metal', g },
      ...[0, 180].map((a) => qBlade([x, Q_FY + 0.02, z], Q_R - 0.05, a + i * 30, 0.12, 0.015, 'black', g)),
    ];
  }),
];
const qPivots = {}, qSpin = {};
Q_FANS.forEach(([x, z], i) => { const g = i ? 'spin' + (i + 1) : 'spin'; qPivots[g] = [x, Q_FY + 0.02, z]; qSpin[g] = { axis: 'y', speed: (i === 0 || i === 3 ? 1 : -1) * 45 }; });

export const SIEGE_MISSILE = { name: 'Rocket-box drone', unit: 'ART-Missiles', ref: 'siege_missile', colors: SIEGE_COLORS,
  parts: qParts, pivots: qPivots, hover: 1, spin: qSpin, views: { side: 'right', top: 'down' } };
