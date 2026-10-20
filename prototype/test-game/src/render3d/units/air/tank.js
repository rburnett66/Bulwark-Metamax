// src/render3d/units/air/tank.js — AIR-Tanks: sleek assault tank (owner concept tools/unit-models/ref/air/air-tank.png)
// [MM-story_mvh8woji_1]. A long, low wedge hull over narrow tracks, a teardrop turret with two swept fins at its tail and
// a long slim cannon. White airframe paint, navy panels, a cherry-red stripe down the skirts, a pink petal decal.
import { AIR_COLORS } from './palette.js';
import { track } from '../prims.js';

const sixA = (w, yb, yt, c = 0.12) => [[-w, yb], [w, yb], [w, yt - c], [w - c, yt], [-(w - c), yt], [-w, yt - c]];

export const AIR_TANK = { name: 'Sleek assault tank', unit: 'AIR-Tanks', ref: 'air_tank', colors: AIR_COLORS,
  parts: [
    ...track({ x0: -1.95, x1: 1.75, h: 0.56, z: 0.9, w: 0.4, wheels: 6, wr: 0.19 }),
    // hull: long wedge — flat deck, a long sloped glacis to a thin nose
    { t: 'loft', ax: 'x', secs: [
      [-2.05, sixA(0.74, 0.42, 1.04, 0.26)],
      [-1.2, sixA(0.8, 0.38, 1.12, 0.3)],
      [0.55, sixA(0.8, 0.38, 1.1, 0.3)],
      [1.55, sixA(0.74, 0.4, 0.86, 0.16)],
      [2.2, sixA(0.6, 0.44, 0.6, 0.06)]], m: 'paint' },
    // side skirts over the upper track run, chamfered, tapering at the nose
    { t: 'loft', ax: 'x', secs: [
      [-2.05, [[0.7, 0.42], [1.16, 0.42], [1.16, 0.9], [1.0, 1.04], [0.7, 1.04]]],
      [1.1, [[0.7, 0.38], [1.16, 0.38], [1.16, 0.88], [1.0, 1.02], [0.7, 1.02]]],
      [1.75, [[0.7, 0.42], [1.1, 0.42], [1.1, 0.7], [0.98, 0.8], [0.7, 0.8]]]], m: 'paint', mir: true },
    // navy rear quarter panel (where the "07" sits) + red stripe running forward
    { t: 'box', s: [0.8, 0.3, 0.02], p: [-1.45, 0.72, 1.17], m: 'navy', mir: true },
    { t: 'box', s: [0.12, 0.13, 0.025], p: [-1.6, 0.74, 1.18], m: 'paint', mir: true, d: 1 },
    { t: 'box', s: [0.12, 0.13, 0.025], p: [-1.4, 0.74, 1.18], m: 'paint', mir: true, d: 1 },
    { t: 'box', s: [2.5, 0.035, 0.02], p: [0.0, 0.86, 1.168], r3: [0, 0, -2], m: 'red', mir: true },
    // pink petal decal on the skirt
    { t: 'cyl', ax: 'z', r: 0.15, l: 0.02, seg: 5, p: [-0.65, 0.68, 1.17], m: 'pink', mir: true },
    // navy chin plate + glacis stripe + gold crest on the nose
    { t: 'box', s: [0.4, 0.04, 0.5], p: [1.85, 0.6, 0], r3: [0, 0, -8], m: 'navy' },
    { t: 'box', s: [0.12, 0.05, 0.16], p: [1.86, 0.63, 0], r3: [0, 0, -8], m: 'gold', d: 1 },
    { t: 'box', s: [1.4, 0.03, 0.035], p: [1.35, 0.94, 0.42], r3: [0, 0, -14], m: 'red', mir: true },
    // engine deck grille + rear plate
    { t: 'box', s: [0.7, 0.03, 0.9], p: [-1.55, 1.05, 0], m: 'dark' },
    { t: 'box', s: [0.04, 0.4, 1.1], p: [-2.06, 0.7, 0], m: 'paint2' },
    { t: 'box', s: [0.04, 0.06, 0.2], p: [-2.08, 0.82, 0.42], m: 'red', mir: true },
    // turret ring
    { t: 'cyl', ax: 'y', r: 0.66, l: 0.08, seg: 12, p: [-0.35, 1.12, 0], m: 'dark', g: 'turret' },
    // turret: elongated teardrop, low and swept back
    { t: 'loft', ax: 'x', secs: [
      [-1.5, sixA(0.36, 1.12, 1.46, 0.08)],
      [-0.9, sixA(0.7, 1.08, 1.66, 0.18)],
      [0.2, sixA(0.68, 1.08, 1.64, 0.2)],
      [0.85, sixA(0.4, 1.12, 1.46, 0.1)]], m: 'paint', g: 'turret' },
    // navy front cheeks either side of the mantlet
    { t: 'box', s: [0.42, 0.26, 0.04], p: [0.55, 1.3, 0.5], r3: [0, -33, 0], m: 'navy', g: 'turret', mir: true },
    // navy cheek panels + roof hatch + gold emblem
    { t: 'box', s: [0.75, 0.24, 0.02], p: [-0.4, 1.36, 0.695], r3: [0, 4, 0], m: 'navy', g: 'turret', mir: true },
    { t: 'box', s: [0.12, 0.12, 0.025], p: [-0.4, 1.38, 0.71], r3: [0, 4, 0], m: 'gold', g: 'turret', mir: true, d: 1 },
    { t: 'cyl', ax: 'y', r: 0.17, l: 0.06, seg: 8, p: [-0.6, 1.68, -0.22], m: 'paint2', g: 'turret' },
    { t: 'box', s: [0.35, 0.05, 0.22], p: [0.15, 1.66, 0.2], m: 'navy', g: 'turret' },
    // twin swept fins rising off the turret tail
    // twin swept stabilizer fins off the turret tail, splayed outward like a jet's tailplanes
    { t: 'ext', ax: 'z', poly: [[-0.7, 0], [-1.25, 0], [-2.0, 0.3], [-1.78, 0.36], [-1.0, 0.16]], d: [0, 0.06], p: [0, 1.5, 0.3], r3: [32, 0, 0], m: 'paint', g: 'turret', mir: true },
    { t: 'ext', ax: 'z', poly: [[-1.55, 0.21], [-2.0, 0.3], [-1.78, 0.36], [-1.45, 0.26]], d: [-0.005, 0.065], p: [0, 1.5, 0.3], r3: [32, 0, 0], m: 'navy', g: 'turret', mir: true },
    { t: 'box', s: [0.14, 0.1, 0.02], p: [-1.3, 1.6, 0.42], r3: [32, 0, 25], m: 'gold', g: 'turret', mir: true, d: 1 },
    // mantlet + long slim cannon with a dark muzzle sleeve
    { t: 'cyl', ax: 'x', r: [0.14, 0.2], l: 0.3, seg: 8, p: [0.92, 1.32, 0], m: 'paint2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.065, l: 1.8, seg: 8, p: [1.85, 1.32, 0], m: 'paint', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.08, l: 0.12, seg: 8, p: [1.6, 1.32, 0], m: 'paint2', g: 'barrel' },
    { t: 'cyl', ax: 'x', r: 0.09, l: 0.32, seg: 8, p: [2.8, 1.32, 0], m: 'dark', g: 'barrel' },
  ],
  pivots: { turret: [-0.35, 1.12, 0], barrel: [0.85, 1.32, 0] },
  barrel: { rest: 0, min: -8, max: 25, rate: 1.2 },
  recoil: 0.3,   // single heavy rounds with a body kick (unitBarrels.heavy)
  muzzles: [{ p: [2.97, 1.32, 0], d: [1, 0, 0], back: 1.1, g: 'barrel' }],
  views: { side: 'right', top: 'down' } };
