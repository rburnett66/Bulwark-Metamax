data-driven; the file exposes the DamageTypes table plus armor-class enum and status flags.

```javascript
// src/config/damageTypes.js
// The 6 damage types + status effect flags (from the balance workbook: DamageTypes sheet).
// Data-driven: no hardcoded balance elsewhere reads directly from these definitions.

// Armor classes that damage types are resolved against (see effectiveness.js).
export const ARMOR_CLASSES = ['Organic', 'Machinery', 'Aircraft', 'Structure', 'Energy'];

// Status effect identifiers applied on hit by certain damage types.
export const STATUS = {
  NONE: '—',
  BURN: 'Burn',
  TOXIN: 'Toxin',
  STAGGER: 'Stagger',
  OVERLOAD: 'Overload',
  CHILL: 'Chill',
};

// Canonical damage type ids.
export const DAMAGE_TYPES = {
  Kinetic: {
    id: 'Kinetic',
    status: STATUS.NONE,
    dot: false,          // damage-over-time
    dotDps: 0,           // fraction of hit DPS applied per second while active
    dotDuration: 0,      // seconds
    slow: false,
    slowFactor: 1,       // movement multiplier while chilled (1 = none)
    slowDuration: 0,
    slowAffectsAir: false,
    chain: false,        // Electric-style chaining to nearby
    chainRange: 0,       // tiles
    chainTargets: 0,
    chainFalloff: 1,     // damage multiplier per chain jump
    splash: false,       // AoE splash (also driven by unit AoE r)
    disablesMachines: false,
    machineStagger: false,
    staggerDuration: 0,  // seconds machine is disabled/staggered
    note: 'Baseline physical; even vs everything.',
  },
  Fire: {
    id: 'Fire',
    status: STATUS.BURN,
    dot: true,
    dotDps: 0.35,
    dotDuration: 3,
    slow: false,
    slowFactor: 1,
    slowDuration: 0,
    slowAffectsAir: false,
    chain: false,
    chainRange: 0,
    chainTargets: 0,
    chainFalloff: 1,
    splash: false,
    disablesMachines: false,
    machineStagger: false,
    staggerDuration: 0,
    note: 'Damage-over-time; strong vs organics & structures.',
  },
  Poison: {
    id: 'Poison',
    status: STATUS.TOXIN,
    dot: true,
    dotDps: 0.6,
    dotDuration: 4,
    slow: false,
    slowFactor: 1,
    slowDuration: 0,
    slowAffectsAir: false,
    chain: false,
    chainRange: 0,
    chainTargets: 0,
    chainFalloff: 1,
    splash: false,
    disablesMachines: false,
    machineStagger: false,
    staggerDuration: 0,
    note: 'Heavy DoT vs organics; machines/energy immune.',
  },
  Concussion: {
    id: 'Concussion',
    status: STATUS.STAGGER,
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: false,
    slowFactor: 1,
    slowDuration: 0,
    slowAffectsAir: false,
    chain: false,
    chainRange: 0,
    chainTargets: 0,
    chainFalloff: 1,
    splash: true,
    disablesMachines: false,
    machineStagger: true,
    staggerDuration: 0.75,
    note: 'Hurts machinery, not troops; brief machine stagger.',
  },
  Electric: {
    id: 'Electric',
    status: STATUS.OVERLOAD,
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: false,
    slowFactor: 1,
    slowDuration: 0,
    slowAffectsAir: false,
    chain: true,
    chainRange: 2.5,
    chainTargets: 3,
    chainFalloff: 0.6,
    splash: false,
    disablesMachines: true,
    machineStagger: true,
    staggerDuration: 1.0,
    note: 'Wrecks machinery; chains to nearby; disables machines.',
  },
  Frost: {
    id: 'Frost',
    status: STATUS.CHILL,
    dot: false,
    dotDps: 0,
    dotDuration: 0,
    slow: true,
    slowFactor: 0.5,     // halves movement while chilled
    slowDuration: 2.5,
    slowAffectsAir: false, // design rule: no slow to air units
    chain: false,
    chainRange: 0,
    chainTargets: 0,
    chainFalloff: 1,
    splash: false,
    disablesMachines: false,
    machineStagger: false,
    staggerDuration: 0,
    note: 'Slows ALL except air units; modest direct damage.',
  },
};

// Ordered list form (matches sheet ordering).
export const DAMAGE_TYPE_LIST = [
  DAMAGE_TYPES.Kinetic,
  DAMAGE_TYPES.Fire,
  DAMAGE_TYPES.Poison,
  DAMAGE_TYPES.Concussion,
  DAMAGE_TYPES.Electric,
  DAMAGE_TYPES.Frost,
];

export function getDamageType(id) {
  return DAMAGE_TYPES[id] || DAMAGE_TYPES.Kinetic;
}

export function hasStatus(id) {
  const dt = getDamageType(id);
  return !!dt && dt.status !== STATUS.NONE;
}

export default {
  ARMOR_CLASSES,
  STATUS,
  DAMAGE_TYPES,
  DAMAGE_TYPE_LIST,
  getDamageType,
  hasStatus,
};