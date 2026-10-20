// src/render3d/units/air/index.js — the AIR faction's own models, one file each [MM-story_mvh8woji_1].
// Owner 2026-10-20: "build the models" from the concept renders in grok armies/Air Flyers (copied to
// tools/unit-models/ref/air). models.js merges these into UNIT_MODELS; modelKeys.js maps the AIR-* unit ids to them.
import { AIR_TROOPS } from './troops.js';
import { AIR_SCOUT } from './scout.js';
import { AIR_TANK } from './tank.js';
import { AIR_ARTILLERY } from './artillery.js';
import { AIR_HEAVY } from './heavy.js';
import { AIR_GUNSHIP } from './gunship.js';
import { AIR_FIGHTER } from './fighter.js';
import { AIR_MISSILE } from './missile.js';
import { AIR_BOMBER } from './bomber.js';

export const AIR_MODELS = Object.freeze({
  air_troops: AIR_TROOPS,
  air_scout: AIR_SCOUT,
  air_tank: AIR_TANK,
  air_artillery: AIR_ARTILLERY,
  air_heavy: AIR_HEAVY,
  air_gunship: AIR_GUNSHIP,
  air_fighter: AIR_FIGHTER,
  air_missile: AIR_MISSILE,
  air_bomber: AIR_BOMBER,
});
