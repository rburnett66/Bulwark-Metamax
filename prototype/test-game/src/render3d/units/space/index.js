// src/render3d/units/space/index.js — the SPACE TECH faction's own models, one file each [MM-story_mvho2d6s_5].
// Owner 2026-10-20: the Space concepts (grok armies/Space, copied to tools/unit-models/ref/space). models.js merges these
// into UNIT_MODELS; modelKeys.js maps the SPC-* unit ids to them.
import { SPACE_TROOPS } from './troops.js';
import { SPACE_SCOUT } from './scout.js';
import { SPACE_TANK } from './tank.js';
import { SPACE_ARTILLERY } from './artillery.js';
import { SPACE_HEAVY } from './heavy.js';
import { SPACE_GUNSHIP } from './gunship.js';
import { SPACE_FIGHTER } from './fighter.js';
import { SPACE_MISSILE } from './missile.js';

export const SPACE_MODELS = Object.freeze({
  space_troops: SPACE_TROOPS,
  space_scout: SPACE_SCOUT,
  space_tank: SPACE_TANK,
  space_artillery: SPACE_ARTILLERY,
  space_heavy: SPACE_HEAVY,
  space_gunship: SPACE_GUNSHIP,
  space_fighter: SPACE_FIGHTER,
  space_missile: SPACE_MISSILE,
});
