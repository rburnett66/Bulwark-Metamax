effectiveness.js content:

```javascript
// src/data/effectiveness.js
// Damage-type x armor-class multiplier matrix (from Balance workbook: Effectiveness sheet)
// 1.0 = normal. Frost deals its listed damage to Aircraft but applies NO slow to air (design rule).
// Poison/Frost trade raw multiplier for status utility.

export const ARMOR_CLASSES = ['Organic', 'Machinery', 'Aircraft', 'Structure', 'Energy'];

export const DAMAGE_TYPES = ['Kinetic', 'Fire', 'Poison', 'Concussion', 'Electric', 'Frost'];

// matrix[DamageType][ArmorClass] = multiplier
export const effectiveness = {
  Kinetic:    { Organic: 1.0, Machinery: 1.0, Aircraft: 1.0, Structure: 1.0, Energy: 1.1 },
  Fire:       { Organic: 1.3, Machinery: 0.8, Aircraft: 0.8, Structure: 1.1, Energy: 0.8 },
  Poison:     { Organic: 1.8, Machinery: 0.1, Aircraft: 0.1, Structure: 0.0, Energy: 0.0 },
  Concussion: { Organic: 0.4, Machinery: 1.7, Aircraft: 0.9, Structure: 1.0, Energy: 0.4 },
  Electric:   { Organic: 0.5, Machinery: 1.8, Aircraft: 1.2, Structure: 0.5, Energy: 0.6 },
  Frost:      { Organic: 0.6, Machinery: 0.6, Aircraft: 0.5, Structure: 0.5, Energy: 0.9 },
};

/**
 * Look up the damage multiplier for a given damage type vs a given armor class.
 * Falls back to 1.0 (neutral) for unknown combinations so the sim never breaks.
 * @param {string} damageType
 * @param {string} armorClass
 * @returns {number}
 */
export function getEffectiveness(damageType, armorClass) {
  const row = effectiveness[damageType];
  if (!row) return 1.0;
  const mult = row[armorClass];
  return (typeof mult === 'number') ? mult : 1.0;
}

export default {
  ARMOR_CLASSES,
  DAMAGE_TYPES,
  effectiveness,
  getEffectiveness,
};