const factionMods = [
  { faction: 'Ground / Powder', HP_x: 1.10, DPS_x: 1.00, Range_x: 1.00, Speed_x: 0.92, signatureDamage: 'Kinetic',    armorTheme: 'Machinery', domainTheme: 'Ground',       avgX: 1.005,  notes: 'Tanky, deliberate' },
  { faction: 'Air',            HP_x: 0.85, DPS_x: 1.05, Range_x: 0.98, Speed_x: 1.20, signatureDamage: 'Kinetic',    armorTheme: 'Aircraft',  domainTheme: 'Air',          avgX: 1.02,   notes: 'Fast, fragile' },
  { faction: 'High Tech',      HP_x: 0.95, DPS_x: 1.05, Range_x: 1.12, Speed_x: 0.90, signatureDamage: 'Electric',   armorTheme: 'Machinery', domainTheme: 'Ground',       avgX: 1.005,  notes: 'Long-range, precise' },
  { faction: 'Artillery',      HP_x: 0.92, DPS_x: 1.10, Range_x: 1.25, Speed_x: 0.78, signatureDamage: 'Concussion', armorTheme: 'Machinery', domainTheme: 'Ground',       avgX: 1.0125, notes: 'Siege reach, slow' },
  { faction: 'Water',          HP_x: 1.12, DPS_x: 0.95, Range_x: 0.98, Speed_x: 0.98, signatureDamage: 'Frost',      armorTheme: 'Organic',   domainTheme: 'Water',        avgX: 1.0075, notes: 'Durable sea life' },
  { faction: 'Arcane / Energy',HP_x: 1.00, DPS_x: 1.08, Range_x: 1.02, Speed_x: 0.92, signatureDamage: 'Fire',       armorTheme: 'Energy',    domainTheme: 'Ground',       avgX: 1.005,  notes: 'Shielded casters' },
  { faction: 'Space Tech',     HP_x: 0.96, DPS_x: 0.98, Range_x: 1.10, Speed_x: 1.00, signatureDamage: 'Electric',   armorTheme: 'Machinery', domainTheme: 'Ground / Air', avgX: 1.01,   notes: 'High vision & range' },
  { faction: 'Dark Energy',    HP_x: 0.90, DPS_x: 1.12, Range_x: 1.00, Speed_x: 1.02, signatureDamage: 'Poison',     armorTheme: 'Energy',    domainTheme: 'Ground',       avgX: 1.01,   notes: 'Corrosive DoT' },
  { faction: 'Greenies (Chem)',HP_x: 0.82, DPS_x: 0.98, Range_x: 0.95, Speed_x: 1.05, signatureDamage: 'Poison',     armorTheme: 'Organic',   domainTheme: 'Ground',       avgX: 0.95,   notes: 'Swarm; cheap, many' },
];

// Fast lookup by faction name
const factionModsById = factionMods.reduce((acc, m) => {
  acc[m.faction] = m;
  return acc;
}, {});

export function getFactionMod(faction) {
  return factionModsById[faction] || {
    faction,
    HP_x: 1, DPS_x: 1, Range_x: 1, Speed_x: 1,
    signatureDamage: 'Kinetic', armorTheme: 'Machinery', domainTheme: 'Ground',
    avgX: 1.0, notes: 'default',
  };
}

export { factionMods, factionModsById };
export default factionMods;