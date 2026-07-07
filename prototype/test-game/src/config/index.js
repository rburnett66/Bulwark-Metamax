src/config/index.js

```javascript
// src/config/index.js
// Aggregates all data tables into config.data.tables
// This is the canonical, data-driven stat source. No hardcoded balance in game code.

import { assumptions } from './assumptions.js';
import { archetypes } from './archetypes.js';
import { factions } from './factions.js';
import { factionMods } from './factionMods.js';
import { damageTypes } from './damageTypes.js';
import { effectiveness } from './effectiveness.js';
import { units } from './units.js';
import { structures } from './structures.js';
import { verticalSlice } from './verticalSlice.js';
import { waves } from './waves.js';

// ---------------------------------------------------------------------------
// Derived helpers over the tables (used by statMath / sim / hud)
// ---------------------------------------------------------------------------

function indexBy(arr, key) {
  const map = Object.create(null);
  for (const row of arr) {
    if (row && row[key] != null) map[row[key]] = row;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Aggregate tables
// ---------------------------------------------------------------------------

const tables = {
  assumptions,
  archetypes,
  factions,
  factionMods,
  damageTypes,
  effectiveness,
  units,
  structures,
  verticalSlice,
  waves,
};

// ---------------------------------------------------------------------------
// Fast-lookup indices
// ---------------------------------------------------------------------------

const indices = {
  archetypesByShape: indexBy(archetypes, 'shape'),
  factionsByName: indexBy(factions, 'name'),
  factionModsByFaction: indexBy(factionMods, 'faction'),
  damageTypesByName: indexBy(damageTypes, 'type'),
  effectivenessByType: indexBy(effectiveness, 'type'),
  unitsById: indexBy(units, 'id'),
  structuresById: indexBy(structures, 'id'),
};

// ---------------------------------------------------------------------------
// Lookup accessors — the sim reads balance ONLY through these
// ---------------------------------------------------------------------------

const lookup = {
  assumption(name) {
    const v = assumptions[name];
    if (v == null) throw new Error(`config: unknown assumption "${name}"`);
    return v;
  },

  unit(id) {
    const u = indices.unitsById[id];
    if (!u) throw new Error(`config: unknown unit "${id}"`);
    return u;
  },

  structure(id) {
    const s = indices.structuresById[id];
    if (!s) throw new Error(`config: unknown structure "${id}"`);
    return s;
  },

  faction(name) {
    return indices.factionsByName[name] || null;
  },

  factionMod(name) {
    return indices.factionModsByFaction[name] || null;
  },

  archetype(shape) {
    return indices.archetypesByShape[shape] || null;
  },

  damageType(name) {
    return indices.damageTypesByName[name] || null;
  },

  // damage-type x armor-class multiplier
  effectivenessMult(damageType, armorClass) {
    const row = indices.effectivenessByType[damageType];
    if (!row) return 1;
    const v = row[armorClass];
    return typeof v === 'number' ? v : 1;
  },
};

// ---------------------------------------------------------------------------
// Config object
// ---------------------------------------------------------------------------

export const config = {
  data: {
    tables,
    indices,
  },
  lookup,
};

export default config;
export { tables, indices, lookup };