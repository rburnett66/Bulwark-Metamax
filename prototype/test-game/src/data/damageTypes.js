damageTypes.js

```javascript
// src/data/damageTypes.js
// Damage types and their status effect flags (DoT / slow / chain / splash).
// Data-driven from the BULWARK balance workbook (Sheet: DamageTypes).
// No hardcoded balance in game code — these are canonical table rows.

export const DAMAGE_TYPES = {
  Kinetic: {
    id: 'Kinetic',
    status: null,       // status effect name applied on hit, or null
    dot: false,         // damage over time
    dotDps: 0,          // dps fraction of hit applied per second while active
    dotDuration: 0,     // seconds the DoT lasts
    slow: false,        // applies movement slow
    slowFactor: 1.0,    // speed multiplier while slowed (1 = no slow)
    slowDuration: 0,    // seconds slow lasts
    slowExcludesAir: false,
    chain: false,       // chains to nearby targets
    chainCount: 0,      // additional targets hit
    chainRange: 0,      // tiles to search for chain targets
    splash: false,      // area splash on impact
    stagger: false,     // brief target stun (machines)
    staggerDuration: 0,
    designNote: 'Baseline physical; even vs everything.',
  },

  Fire: {
    id: 'Fire',
    status: 'Burn',
    dot: true,
    dotDps: 0.35,
    dotDuration: 3.0,
    slow: false,
    slowFactor: 1.0,
    slowDuration: 0,
    slowExcludesAir: false,
    chain: false,
    chainCount: 0,
    chainRange: 0,
    splash: false,
    stagger: false,
    staggerDuration: 0,
    designNote: 'Damage-over-time; strong vs organics & structures.',
  },

  Poison: {
    id: 'Poison',
    status: 'Toxin',
    dot: true,
    dotDps: 0.5,
    dotDuration: 4.0,
    slow: false,
    slowFactor: 1.0,
    slowDuration: 0,
    slowExcludesAir: false,
    chain: false,
    chainCount: 0,
    chainRange: 0,
    splash: false,
    stagger: false,
    staggerDuration: 0,
    designNote: 'Heavy DoT vs organics; machines/energy immune.',
  },

  Concussion: {
    id: 'Concussion',
    status: 'Stagger',
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: false,
    slowFactor: 1.0,
    slowDuration: 0,
    slowExcludesAir: false,
    chain: false,
    chainCount: 0,
    chainRange: 0,
    splash: false,
    stagger: true,
    staggerDuration: 0.75,   // brief machine stagger
    designNote: 'Hurts machinery, not troops; brief machine stagger.',
  },

  Electric: {
    id: 'Electric',
    status: 'Overload',
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: false,
    slowFactor: 1.0,
    slowDuration: 0,
    slowExcludesAir: false,
    chain: true,
    chainCount: 2,
    chainRange: 2.0,
    splash: false,
    stagger: true,           // disables/staggers machines briefly
    staggerDuration: 0.5,
    designNote: 'Wrecks machinery; chains to nearby; disables machines.',
  },

  Frost: {
    id: 'Frost',
    status: 'Chill',
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: true,
    slowFactor: 0.5,         // 50% movement while chilled
    slowDuration: 2.5,
    slowExcludesAir: true,   // design rule: NO slow to air units
    chain: false,
    chainCount: 0,
    chainRange: 0,
    splash: false,
    stagger: false,
    staggerDuration: 0,
    designNote: 'Slows ALL except air; modest direct damage.',
  },
};

// Ordered id list matching the workbook.
export const DAMAGE_TYPE_IDS = [
  'Kinetic',
  'Fire',
  'Poison',
  'Concussion',
  'Electric',
  'Frost',
];

// Lookup helper — always returns a valid record (falls back to Kinetic).
export function getDamageType(id) {
  return DAMAGE_TYPES[id] || DAMAGE_TYPES.Kinetic;
}

// Does this damage type apply a movement slow to a unit of the given domain?
// Domain is one of: 'ground' (walker/floater) or 'air' (flyer).
export function appliesSlow(id, domain) {
  const dt = getDamageType(id);
  if (!dt.slow) return false;
  if (dt.slowExcludesAir && domain === 'air') return false;
  return true;
}

export default DAMAGE_TYPES;