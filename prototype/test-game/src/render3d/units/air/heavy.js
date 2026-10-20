// src/render3d/units/air/heavy.js — AIR-HeavyTanks: ace heavy tank (owner concept tools/unit-models/ref/air/air-heavy-tank.png)
// [MM-story_mvh8woji_1]. A big wedge hull with a pointed bow, armoured skirts with navy side intakes over wide tracks, a
// large blocky turret carrying a long gun, the ace's navy shield emblem on the turret and a row of red kill marks.
import { AIR_COLORS } from './palette.js';
import { track } from '../prims.js';

const sixA = (w, yb, yt, c = 0.12) => [[-w, yb], [w, yb], [w, yt - c], [w - c, yt], [-(w - c), yt], [-w, yt - c]];
// kill marks: a 4 x 2 grid of red crosses on each turret cheek, behind the emblem
const kills = Array.from({ length: 8 }, (_, i) => ({ t: 'box', s: [0.08, 0.08, 0.02], p: [0.15 + (i % 4) * 0.15, 1.98 - Math.floor(i / 4) * 0.13, 0.905], m: 'red', g: 'turret', mir: true, d: 1 }));

export const AIR_HEAVY = { name: 'Ace heavy tank', unit: 'AIR-HeavyTanks', ref: 'air_heavy', colors: AIR_COLORS,
  parts: [
    ...track({ x0: -2.15, x1: 1.95, h: 0.7, z: 1.08, w: 0.56, wheels: 7, wr: 0.24 }),
    // hull: high flat deck, a pointed wedge bow
    { t: 'loft', ax: 'x', secs: [
      [-2.25, sixA(0.92, 0.5, 1.36, 0.28)],
      [1.3, sixA(0.95, 0.46, 1.36, 0.3)],
      [2.0, sixA(0.7, 0.5, 1.0, 0.22)],
      [2.5, sixA(0.22, 0.56, 0.72, 0.06)]], m: 'paint' },
    // armoured side skirts: thick, chamfered, nosed in at the front
    { t: 'loft', ax: 'x', secs: [
      [-2.25, [[0.85, 0.5], [1.44, 0.5], [1.44, 1.12], [1.26, 1.3], [0.85, 1.3]]],
      [1.35, [[0.85, 0.46], [1.44, 0.46], [1.44, 1.1], [1.26, 1.28], [0.85, 1.28]]],
      [2.15, [[0.85, 0.5], [1.12, 0.5], [1.12, 0.8], [1.0, 0.92], [0.85, 0.92]]]], m: 'paint', mir: true },
    // navy side intake panel with dark slats
    { t: 'box', s: [1.0, 0.36, 0.02], p: [-0.5, 0.86, 1.45], m: 'navy', mir: true },
    ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.06, 0.28, 0.025], p: [-0.86 + i * 0.24, 0.86, 1.46], m: 'dark', mir: true, d: 1 })),
    // red stripes along the skirt + pink petals
    { t: 'box', s: [3.2, 0.04, 0.02], p: [0.1, 1.15, 1.448], m: 'red', mir: true },
    { t: 'box', s: [1.4, 0.035, 0.02], p: [0.6, 0.62, 1.448], m: 'red', mir: true },
    { t: 'cyl', ax: 'z', r: 0.15, l: 0.02, seg: 5, p: [0.75, 0.88, 1.45], m: 'pink', mir: true },
    { t: 'cyl', ax: 'z', r: 0.12, l: 0.02, seg: 5, p: [-1.65, 0.9, 1.45], m: 'pink', mir: true },
    // bow: navy chevron, gold crest, red edge stripes on the glacis
    { t: 'box', s: [0.4, 0.035, 0.36], p: [1.62, 1.2, 0], r3: [0, 0, -27], m: 'navy' },
    { t: 'box', s: [0.14, 0.045, 0.14], p: [1.63, 1.21, 0], r3: [0, 0, -27], m: 'gold', d: 1 },
    // navy front fenders over the track noses
    { t: 'loft', ax: 'x', secs: [[1.55, [[0.9, 0.74], [1.46, 0.74], [1.46, 1.04], [0.9, 1.04]]], [2.3, [[0.95, 0.62], [1.36, 0.62], [1.36, 0.82], [0.95, 0.82]]]], m: 'navy', mir: true },
    // raised intake boxes on the deck either side of the turret: navy frames, dark slats
    { t: 'box', s: [0.75, 0.3, 0.42], p: [0.75, 1.48, 0.95], r3: [0, 0, -6], m: 'navy', mir: true },
    { t: 'box', s: [0.6, 0.2, 0.36], p: [0.8, 1.52, 0.96], r3: [0, 0, -6], m: 'dark', mir: true },
    ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.04, 0.22, 0.38], p: [0.6 + i * 0.18, 1.53, 0.96], m: 'paint2', mir: true, d: 1 })),
    { t: 'box', s: [1.0, 0.035, 0.04], p: [1.75, 1.18, 0.55], r3: [0, 28, -26], m: 'red', mir: true },
    // engine deck: dark grille block + rear plate + tail lights
    { t: 'box', s: [0.9, 0.12, 1.1], p: [-1.65, 1.4, 0], m: 'paint2' },
    ...[0, 1, 2, 3, 4].map((i) => ({ t: 'box', s: [0.06, 0.03, 0.95], p: [-2.0 + i * 0.17, 1.47, 0], m: 'dark', d: 1 })),
    { t: 'box', s: [0.05, 0.6, 1.4], p: [-2.27, 0.92, 0], m: 'paint2' },
    { t: 'box', s: [0.04, 0.08, 0.24], p: [-2.3, 1.1, 0.5], m: 'red', mir: true },
    // turret ring
    { t: 'cyl', ax: 'y', r: 1.12, l: 0.16, seg: 14, p: [-0.35, 1.44, 0], m: 'navy', g: 'turret' },
    // turret: big, blocky, chamfered, tapering to the mantlet
    { t: 'loft', ax: 'x', secs: [
      [-1.45, sixA(0.72, 1.48, 2.06, 0.22)],
      [-0.9, sixA(0.9, 1.48, 2.22, 0.3)],
      [0.4, sixA(0.9, 1.48, 2.22, 0.3)],
      [1.0, sixA(0.74, 1.5, 2.16, 0.24)]], m: 'paint', g: 'turret' },
    // the ace emblem on the turret front: navy shield, gold rim, red star
    { t: 'box', s: [0.03, 0.3, 0.46], p: [1.015, 1.95, 0], m: 'navy', g: 'turret' },
    { t: 'box', s: [0.035, 0.045, 0.48], p: [1.02, 2.1, 0], m: 'gold', g: 'turret', d: 1 },
    { t: 'box', s: [0.04, 0.13, 0.13], p: [1.025, 1.95, 0], r3: [45, 0, 0], m: 'red', g: 'turret', d: 1 },
    // navy roof plate with the ace emblem (navy shield, red cross, gold rim) up front
    { t: 'box', s: [0.9, 0.03, 0.06], p: [-0.3, 2.225, 0.5], m: 'navy', g: 'turret', mir: true },
    // turret side: kill marks, pink petal, a red stripe
    ...kills,
    { t: 'cyl', ax: 'z', r: 0.13, l: 0.02, seg: 5, p: [-0.55, 1.88, 0.905], m: 'pink', g: 'turret', mir: true },
    { t: 'box', s: [1.6, 0.035, 0.02], p: [-0.3, 1.62, 0.905], m: 'red', g: 'turret', mir: true },
    // commander cupola + antenna + rear bustle rack
    { t: 'cyl', ax: 'y', r: 0.3, l: 0.18, seg: 10, p: [-0.75, 2.3, -0.1], m: 'paint', g: 'turret' },
    { t: 'ell', s: [0.26, 0.12, 0.26], seg: 10, half: true, p: [-0.75, 2.39, -0.1], m: 'paint2', g: 'turret' },
    { t: 'box', s: [0.05, 0.05, 0.3], p: [-0.5, 2.36, -0.1], m: 'glass', g: 'turret' },
    { t: 'cyl', ax: 'y', r: 0.015, l: 0.75, seg: 4, p: [-1.2, 2.55, 0.6], m: 'dark', g: 'turret', d: 1 },
    { t: 'box', s: [0.2, 0.35, 1.2], p: [-1.55, 1.76, 0], m: 'paint2', g: 'turret' },
    // mantlet + long heavy gun with a muzzle brake
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.34, seg: 10, p: [1.12, 1.66, 0], m: 'navy', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.12, l: 2.1, seg: 10, p: [2.3, 1.66, 0], m: 'paint', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.145, l: 0.1, seg: 10, p: [3.1, 1.66, 0], m: 'red', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.36, seg: 10, p: [3.4, 1.66, 0], m: 'paint', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.04, seg: 10, p: [3.6, 1.66, 0], m: 'black', g: 'barrel' },
  ],
  pivots: { turret: [-0.35, 1.4, 0], barrel: [1.0, 1.66, 0] },
  barrel: { rest: 0, min: -8, max: 20, rate: 0.9 },
  recoil: 0.45,   // single heavy rounds with a body kick (unitBarrels.heavy)
  muzzles: [{ p: [3.62, 1.66, 0], d: [1, 0, 0], back: 1.4, g: 'barrel' }],
  views: { side: 'right', top: 'down' } };
