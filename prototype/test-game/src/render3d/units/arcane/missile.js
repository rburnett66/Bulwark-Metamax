// src/render3d/units/arcane/missile.js — ARC-Missiles: Ascendant shrine (owner concept
// tools/unit-models/ref/arcane/arcane-missile-launcher.png) [MM-story_mvhnbx8n_4]. The concept is the Troops' domed shrine
// with its brazier crest as the launcher (no flame cannon). The Missile Flyer flies, so the shrine rides a levitation
// cradle instead of tracks: a bronze ring keel with a red energy disc beneath and four short vanes. Its fire leaves the
// brazier, so the muzzle sits in the flame.
import { ARCANE_COLORS, shrineBody, ring, circlePoly, SHRINE } from './palette.js';

const Y0 = 0.55, CX = SHRINE.cx;

export const ARCANE_MISSILE = { name: 'Ascendant shrine', unit: 'ARC-Missiles', ref: 'arcane_missile', colors: ARCANE_COLORS,
  parts: [
    ...shrineBody(Y0),
    // levitation cradle: keel ring, red energy disc, four vanes
    { t: 'cyl', ax: 'y', r: [0.95, 0.7], l: 0.3, seg: 14, p: [CX, Y0 - 0.12, 0], m: 'iron2' },
    ring('y', [CX, Y0 - 0.1, 0], 1.0, 0.1, 0.12, 'bronze'),
    ring('y', [CX, Y0 - 0.3, 0], 0.7, 0.08, 0.08, 'bronze2'),
    { t: 'ext', ax: 'y', poly: circlePoly(0.6, 14), d: [-0.02, 0.0], p: [CX, Y0 - 0.3, 0], m: 'glowR' },
    { t: 'ext', ax: 'y', poly: circlePoly(0.3, 10), d: [-0.03, -0.02], p: [CX, Y0 - 0.3, 0], m: 'glowF' },
    ...[0, 90, 180, 270].map((a) => ({ t: 'ext', ax: 'z', poly: [[0.55, 0.05], [1.15, 0.0], [1.0, -0.35], [0.6, -0.3]], d: [-0.03, 0.03], p: [CX, Y0, 0], r3: [0, a + 45, 0], m: 'bronze' })),
  ],
  pivots: {}, hover: 1,
  muzzles: [{ p: [CX + 0.15, Y0 + 2.2, 0], d: [0.5, 0.87, 0], back: 0 }],
  views: { side: 'left', top: 'down' } };
