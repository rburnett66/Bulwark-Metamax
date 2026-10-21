// src/render3d/units/arcane/index.js — the ARCANE / ENERGY faction's own models, one file each [MM-story_mvhnbx8n_4].
// Owner 2026-10-20: the Arcane Army concepts (grok armies/Arcane Army, copied to tools/unit-models/ref/arcane). models.js
// merges these into UNIT_MODELS; modelKeys.js maps the ARC-* unit ids to them.
import { ARCANE_TROOPS } from './troops.js';
import { ARCANE_SCOUT } from './scout.js';
import { ARCANE_TANK } from './tank.js';
import { ARCANE_ARTILLERY } from './artillery.js';
import { ARCANE_HEAVY } from './heavy.js';
import { ARCANE_GUNSHIP } from './gunship.js';
import { ARCANE_FIGHTER } from './fighter.js';
import { ARCANE_MISSILE } from './missile.js';

export const ARCANE_MODELS = Object.freeze({
  arcane_troops: ARCANE_TROOPS,
  arcane_scout: ARCANE_SCOUT,
  arcane_tank: ARCANE_TANK,
  arcane_artillery: ARCANE_ARTILLERY,
  arcane_heavy: ARCANE_HEAVY,
  arcane_gunship: ARCANE_GUNSHIP,
  arcane_fighter: ARCANE_FIGHTER,
  arcane_missile: ARCANE_MISSILE,
});
