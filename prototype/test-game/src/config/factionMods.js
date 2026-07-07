[Truncated balance data — implementing config.data.tables Faction_Mods sheet]

```
export const FACTION_MODS = {
```

I'll write the file now.

export const factionMods = {
  'Ground / Powder': {
    hpX: 1.10, dpsX: 1.00, rangeX: 1.00, speedX: 0.92,
    signatureDamage: 'Kinetic', armorTheme: 'Machinery', domainTheme: 'Ground',
    avgX: 1.005, notes: 'Tanky, deliberate'
  },
  'Air': {
    hpX: 0.85, dpsX: 1.05, rangeX: 0.98, speedX: 1.20,
    signatureDamage: 'Kinetic', armorTheme: 'Aircraft', domainTheme: 'Air',
    avgX: 1.02, notes: 'Fast, fragile'
  },
  'High Tech': {
    hpX: 0.95, dpsX: 1.05, rangeX: 1.12, speedX: 0.90,
    signatureDamage: 'Electric', armorTheme: 'Machinery', domainTheme: 'Ground',
    avgX: 1.005, notes: 'Long-range, precise'
  },
  'Artillery': {
    hpX: 0.92, dpsX: 1.10, rangeX: 1.25, speedX: 0.78,
    signatureDamage: 'Concussion', armorTheme: 'Machinery', domainTheme: 'Ground',
    avgX: 1.0125, notes: 'Siege reach, slow'
  },
  'Water': {
    hpX: 1.12, dpsX: 0.95, rangeX: 0.98, speedX: 0.98,
    signatureDamage: 'Frost', armorTheme: 'Organic', domainTheme: 'Water',
    avgX: 1.0075, notes: 'Durable sea life'
  },
  'Arcane / Energy': {
    hpX: 1.00, dpsX: 1.08, rangeX: 1.02, speedX: 0.92,
    signatureDamage: 'Fire', armorTheme: 'Energy', domainTheme: 'Ground',
    avgX: 1.005, notes: 'Shielded casters'
  },
  'Space Tech': {
    hpX: 0.96, dpsX: 0.98, rangeX: 1.10, speedX: 1.00,
    signatureDamage: 'Electric', armorTheme: 'Machinery', domainTheme: 'Ground / Air',
    avgX: 1.01, notes: 'High vision & range'
  },
  'Dark Energy': {
    hpX: 0.90, dpsX: 1.12, rangeX: 1.00, speedX: 1.02,
    signatureDamage: 'Poison', armorTheme: 'Energy', domainTheme: 'Ground',
    avgX: 1.01, notes: 'Corrosive DoT'
  },
  'Greenies (Chem)': {
    hpX: 0.82, dpsX: 0.98, rangeX: 0.95, speedX: 1.05,
    signatureDamage: 'Poison', armorTheme: 'Organic', domainTheme: 'Ground',
    avgX: 0.95, notes: 'Swarm; cheap, many'
  }
};

// Default (net-neutral) modifier used when a faction is unknown or unmodded.
export const NEUTRAL_MOD = {
  hpX: 1.0, dpsX: 1.0, rangeX: 1.0, speedX: 1.0,
  signatureDamage: 'Kinetic', armorTheme: 'Machinery', domainTheme: 'Ground',
  avgX: 1.0, notes: 'Neutral baseline'
};

export function getFactionMod(faction) {
  return factionMods[faction] || NEUTRAL_MOD;
}

export default factionMods;