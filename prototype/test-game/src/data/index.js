config.data.tables namespace aggregator. Let me write the index.js that imports all data modules and aggregates them.

```javascript
```

Let me create the file:

import { CONSTANTS } from '../config/constants.js';
import { assumptions } from './assumptions.js';
import { archetypes } from './archetypes.js';
import { factions } from './factions.js';
import { factionMods } from './factionMods.js';
import { damageTypes } from './damageTypes.js';
import { effectiveness } from './effectiveness.js';
import { units } from './units.js';
import { structures } from './structures.js';
import { verticalSlice } from './verticalSlice.js';

// ---------------------------------------------------------------------------
// BULWARK — Data aggregator
// Assembles every balance data table into a single, read-only tables object
// exposed as config.data.tables (the design forbids hardcoded balance).
// ---------------------------------------------------------------------------

// Helper: index an array of records by a key field for O(1) lookup.
function indexBy(arr, key) {
  const map = Object.create(null);
  if (Array.isArray(arr)) {
    for (const rec of arr) {
      if (rec && rec[key] != null) map[rec[key]] = rec;
    }
  }
  return map;
}

// Build the effectiveness lookup: matrix[damageType][armorClass] = multiplier.
function buildEffMatrix(effRows) {
  const m = Object.create(null);
  if (Array.isArray(effRows)) {
    for (const row of effRows) {
      const dt = row.damageType || row.DamageType || row.type;
      if (!dt) continue;
      m[dt] = {
        Organic: num(row.Organic ?? row.organic, 1),
        Machinery: num(row.Machinery ?? row.machinery, 1),
        Aircraft: num(row.Aircraft ?? row.aircraft, 1),
        Structure: num(row.Structure ?? row.structure, 1),
        Energy: num(row.Energy ?? row.energy, 1),
      };
    }
  }
  return m;
}

function num(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Assemble the tables namespace.
// ---------------------------------------------------------------------------
const tables = {
  // Raw table data (as authored in each data module).
  constants: CONSTANTS,
  assumptions,
  archetypes,
  factions,
  factionMods,
  damageTypes,
  effectiveness,
  units,
  structures,
  verticalSlice,

  // Indexed lookups for fast, deterministic access during sim.
  index: {
    factionsByName: indexBy(factions, 'name'),
    factionModsByName: indexBy(factionMods, 'faction'),
    archetypesByShape: indexBy(archetypes, 'shape'),
    damageTypesByName: indexBy(damageTypes, 'type'),
    unitsById: indexBy(units, 'id'),
    structuresById: indexBy(structures, 'id'),
  },

  // Damage-type x armor-class effectiveness matrix.
  effMatrix: buildEffMatrix(effectiveness),
};

// ---------------------------------------------------------------------------
// Derived helper API: pure functions the sim/combat core call headlessly.
// These NEVER mutate state — deterministic given identical inputs.
// ---------------------------------------------------------------------------
const api = {
  // Effectiveness multiplier of a damage type against an armor class.
  effectiveness(damageType, armorClass) {
    const row = tables.effMatrix[damageType];
    if (!row) return 1;
    const v = row[armorClass];
    return typeof v === 'number' ? v : 1;
  },

  // Look up a unit record by id.
  unit(id) {
    return tables.index.unitsById[id] || null;
  },

  // Look up a structure record by id.
  structure(id) {
    return tables.index.structuresById[id] || null;
  },

  // Damage-type metadata (status flags: DoT / slow / chain).
  damageType(name) {
    return tables.index.damageTypesByName[name] || null;
  },

  // Faction record + its mild stat tilt mods.
  faction(name) {
    return tables.index.factionsByName[name] || null;
  },
  factionMod(name) {
    return tables.index.factionModsByName[name] || null;
  },

  // Assumptions accessor (global tuning constants).
  assumption(key) {
    return tables.assumptions[key];
  },

  // Tier-scaled HP for a base value using assumption multipliers.
  tierHP(baseHP, tier) {
    const a = tables.assumptions;
    if (tier === 3) return baseHP * (a.Upgrade_HP_x_T3 ?? 2.4);
    if (tier === 2) return baseHP * (a.Upgrade_HP_x_T2 ?? 1.6);
    return baseHP;
  },

  // Tier-scaled DPS.
  tierDPS(baseDPS, tier) {
    const a = tables.assumptions;
    if (tier === 3) return baseDPS * (a.Upgrade_DPS_x_T3 ?? 2.3);
    if (tier === 2) return baseDPS * (a.Upgrade_DPS_x_T2 ?? 1.55);
    return baseDPS;
  },

  // Cumulative cost of a structure/unit at a tier (used for upgrade pricing).
  tierCost(baseCost, tier) {
    const a = tables.assumptions;
    if (tier === 3) return baseCost * (a.Upgrade_Cost_x_T3 ?? 5);
    if (tier === 2) return baseCost * (a.Upgrade_Cost_x_T2 ?? 2.5);
    return baseCost;
  },

  // Refund gold when selling a structure (partial refund of invested value).
  sellRefund(investedValue) {
    const rate =
      (tables.constants && tables.constants.REFUND_RATE) != null
        ? tables.constants.REFUND_RATE
        : 0.5;
    return Math.floor(investedValue * rate);
  },

  // Effective DPS of an attacker's damage type vs a defender armor class.
  effDPS(rawDPS, damageType, armorClass) {
    return rawDPS * this.effectiveness(damageType, armorClass);
  },
};

// The exported data facade. main.js does: config.data = data;
// so config.data.tables and config.data.api become globally available.
export const data = {
  tables,
  api,
};

// Convenience named exports for direct import if desired.
export { tables };
export default data;