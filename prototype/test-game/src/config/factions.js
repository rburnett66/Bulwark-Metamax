// src/config/factions.js
// Faction list + counter graph data.
// Data-driven from the BULWARK balance workbook "Factions" sheet.
// No hardcoded balance elsewhere — game code reads from these tables.

/**
 * Each faction:
 *  - id: numeric index (matches workbook #)
 *  - key: stable string key used to join with factionMods / units tables
 *  - name: display name
 *  - trope: flavor tag
 *  - beats: key of the faction this one counters (counter graph edge)
 *  - signatureDamage: primary damage type id (joins to damageTypes)
 *  - identity: battlefield identity blurb
 */
export const FACTIONS = [
  {
    id: 1,
    key: 'GND',
    name: 'Ground / Powder',
    trope: 'Nationalistic',
    beats: 'GRN',
    signatureDamage: 'Kinetic',
    identity: 'Infantry & armor; flags & honor',
    tutorial: true,
  },
  {
    id: 2,
    key: 'AIR',
    name: 'Air',
    trope: 'Manga (ace pilots)',
    beats: 'GND',
    signatureDamage: 'Kinetic',
    identity: 'Air superiority; weak on the ground',
    tutorial: false,
  },
  {
    id: 3,
    key: 'HTC',
    name: 'High Tech',
    trope: 'Capitalist (mega-corp)',
    beats: 'AIR',
    signatureDamage: 'Electric',
    identity: 'Precision, shields, expensive',
    tutorial: false,
  },
  {
    id: 4,
    key: 'ART',
    name: 'Artillery',
    trope: 'Military (siege)',
    beats: 'HTC',
    signatureDamage: 'Concussion',
    identity: 'Range & arc; poor up close',
    tutorial: false,
  },
  {
    id: 5,
    key: 'WTR',
    name: 'Water',
    trope: 'Fantasy RPG (sea tribes)',
    beats: 'ART',
    signatureDamage: 'Frost',
    identity: 'Swimmers/floaters; coastal',
    tutorial: false,
  },
  {
    id: 6,
    key: 'ARC',
    name: 'Arcane / Energy',
    trope: 'Fantasy theocracy / religion',
    beats: 'WTR',
    signatureDamage: 'Fire',
    identity: 'Energy weapons, shields, no ammo economy',
    tutorial: false,
  },
  {
    id: 7,
    key: 'SPC',
    name: 'Space Tech',
    trope: 'Sci-Fi (federation)',
    beats: 'ARC',
    signatureDamage: 'Electric',
    identity: 'Orbital tech; strong vision; ignores some fog',
    tutorial: false,
  },
  {
    id: 8,
    key: 'DRK',
    name: 'Dark Energy',
    trope: 'Social realignment (cult)',
    beats: 'SPC',
    signatureDamage: 'Poison',
    identity: 'DoT, corruption, night-strong',
    tutorial: false,
  },
  {
    id: 9,
    key: 'GRN',
    name: 'Greenies (Chem)',
    trope: 'Socialist (hive collective)',
    beats: 'DRK',
    signatureDamage: 'Poison',
    identity: 'Swarms, chem clouds, area denial',
    tutorial: false,
  },
];

// Quick lookup by key.
export const FACTIONS_BY_KEY = FACTIONS.reduce((acc, f) => {
  acc[f.key] = f;
  return acc;
}, {});

// Quick lookup by full display name (used to join workbook Units "Faction" column).
export const FACTIONS_BY_NAME = FACTIONS.reduce((acc, f) => {
  acc[f.name] = f;
  return acc;
}, {});

// Counter graph as an adjacency list: attackerKey -> defenderKey it beats.
export const COUNTER_GRAPH = FACTIONS.reduce((acc, f) => {
  acc[f.key] = f.beats;
  return acc;
}, {});

/**
 * Returns true if faction A (key) counters faction B (key).
 */
export function beats(aKey, bKey) {
  return COUNTER_GRAPH[aKey] === bKey;
}

/**
 * Resolve a faction record by id, key, or full name.
 */
export function getFaction(idOrKeyOrName) {
  if (idOrKeyOrName == null) return undefined;
  if (typeof idOrKeyOrName === 'number') {
    return FACTIONS.find((f) => f.id === idOrKeyOrName);
  }
  return FACTIONS_BY_KEY[idOrKeyOrName] || FACTIONS_BY_NAME[idOrKeyOrName];
}

// The tutorial / vertical-slice attacker faction.
export const TUTORIAL_FACTION = FACTIONS.find((f) => f.tutorial) || FACTIONS[0];

export default FACTIONS;