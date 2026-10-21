// src/render3d/units/siege/index.js — the ARTILLERY (Siege) faction's own models, one file each [MM-story_mvhb6qd2_2].
// Owner 2026-10-20: the Siege Army concepts (grok armies/Siege Army, copied to tools/unit-models/ref/siege). models.js merges
// these into UNIT_MODELS; modelKeys.js maps the ART-* unit ids to them.
import { SIEGE_TROOPS } from './troops.js';
import { SIEGE_SCOUT } from './scout.js';
import { SIEGE_TANK } from './tank.js';
import { SIEGE_ARTILLERY } from './artillery.js';
import { SIEGE_HEAVY } from './heavy.js';
import { SIEGE_GUNSHIP } from './gunship.js';
import { SIEGE_FIGHTER } from './fighter.js';
import { SIEGE_MISSILE } from './missile.js';

export const SIEGE_MODELS = Object.freeze({
  siege_troops: SIEGE_TROOPS,
  siege_scout: SIEGE_SCOUT,
  siege_tank: SIEGE_TANK,
  siege_artillery: SIEGE_ARTILLERY,
  siege_heavy: SIEGE_HEAVY,
  siege_gunship: SIEGE_GUNSHIP,
  siege_fighter: SIEGE_FIGHTER,
  siege_missile: SIEGE_MISSILE,
});
