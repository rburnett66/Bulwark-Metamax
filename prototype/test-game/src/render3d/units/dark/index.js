// src/render3d/units/dark/index.js — the DARK ENERGY faction's own models, one file each [MM-story_mvifm4xj_1].
// Owner 2026-10-21: the Dark Energy concepts (grok armies/Dark Energy, copied to tools/unit-models/ref/dark). models.js
// merges these into UNIT_MODELS; modelKeys.js maps the DRK-* unit ids to them. The concept named "scout" (a small
// tracked pod) is the Troops unit; the one named "truck" (an armoured 4x4) is the Scout.
import { DARK_TROOPS } from './troops.js';
import { DARK_SCOUT } from './scout.js';
import { DARK_TANK } from './tank.js';
import { DARK_ARTILLERY } from './artillery.js';
import { DARK_HEAVY } from './heavy.js';
import { DARK_GUNSHIP } from './gunship.js';
import { DARK_FIGHTER } from './fighter.js';
import { DARK_MISSILE } from './missile.js';

export const DARK_MODELS = Object.freeze({
  dark_troops: DARK_TROOPS,
  dark_scout: DARK_SCOUT,
  dark_tank: DARK_TANK,
  dark_artillery: DARK_ARTILLERY,
  dark_heavy: DARK_HEAVY,
  dark_gunship: DARK_GUNSHIP,
  dark_fighter: DARK_FIGHTER,
  dark_missile: DARK_MISSILE,
});
