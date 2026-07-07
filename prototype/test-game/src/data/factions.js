factions.js does not need the full unit roster — that lives in units.js. This file provides faction metadata, tropes, the counter graph, and signature damage.

```javascript
```

Let me write the actual file content:

```javascript
// src/data/factions.js
// Faction list, tropes, counter graph, signature damage.
// Data-driven per BULWARK balance workbook (Sheet: Factions).
// No hardcoded balance in game logic — this is the canonical faction table.

// Each faction: id, name, trope, beats (the faction it counters),
// signatureDamage (its thematic damage type), identity blurb,
// and armor/domain themes (mirrored from Faction_Mods for convenience).

export const FACTIONS = [
  {
    id: 1,
    key: 'ground',
    name: 'Ground / Powder',
    trope: 'Nationalistic',
    beats: 'greenies',
    signatureDamage: 'Kinetic',
    identity: 'Infantry & armor; flags & honor',
    armorTheme: 'Machinery',
    domainTheme: 'Ground',
    tutorial: true,
  },
  {
    id: 2,
    key: 'air',
    name: 'Air',
    trope: 'Manga (ace pilots)',
    beats: 'ground',
    signatureDamage: 'Kinetic',
    identity: 'Air superiority; weak on the ground',
    armorTheme: 'Aircraft',
    domainTheme: 'Air',
    tutorial: false,
  },
  {
    id: 3,
    key: 'hightech',
    name: 'High Tech',
    trope: 'Capitalist (mega-corp)',
    beats: 'air',
    signatureDamage: 'Electric',
    identity: 'Precision, shields, expensive',
    armorTheme: 'Machinery',
    domainTheme: 'Ground',
    tutorial: false,
  },
  {
    id: 4,
    key: 'artillery',
    name: 'Artillery',
    trope: 'Military (siege)',
    beats: 'hightech',
    signatureDamage: 'Concussion',
    identity: 'Range & arc; poor up close',
    armorTheme: 'Machinery',
    domainTheme: 'Ground',
    tutorial: false,
  },
  {
    id: 5,
    key: 'water',
    name: 'Water',
    trope: 'Fantasy RPG (sea tribes)',
    beats: 'artillery',
    signatureDamage: 'Frost',
    identity: 'Swimmers/floaters; coastal',
    armorTheme: 'Organic',
    domainTheme: 'Water',
    tutorial: false,
  },
  {
    id: 6,
    key: 'arcane',
    name: 'Arcane / Energy',
    trope: 'Fantasy theocracy / religion',
    beats: 'water',
    signatureDamage: 'Fire',
    identity: 'Energy weapons, shields, no ammo economy',
    armorTheme: 'Energy',
    domainTheme: 'Ground',
    tutorial: false,
  },
  {
    id: 7,
    key: 'spacetech',
    name: 'Space Tech',
    trope: 'Sci-Fi (federation)',
    beats: 'arcane',
    signatureDamage: 'Electric',
    identity: 'Orbital tech; strong vision; ignores some fog',
    armorTheme: 'Machinery',
    domainTheme: 'Ground / Air',
    tutorial: false,
  },
  {
    id: 8,
    key: 'darkenergy',
    name: 'Dark Energy',
    trope: 'Social realignment (cult)',
    beats: 'spacetech',
    signatureDamage: 'Poison',
    identity: 'DoT, corruption, night-strong',
    armorTheme: 'Energy',
    domainTheme: 'Ground',
    tutorial: false,
  },
  {
    id: 9,
    key: 'greenies',
    name: 'Greenies (Chem)',
    trope: 'Socialist (hive collective)',
    beats: 'darkenergy',
    signatureDamage: 'Poison',
    identity: 'Swarms, chem clouds, area denial',
    armorTheme: 'Organic',
    domainTheme: 'Ground',
    tutorial: false,
  },
];

// Fast lookup maps
export const FACTIONS_BY_KEY = FACTIONS.reduce((acc, f) => {
  acc[f.key] = f;
  return acc;
}, {});

export const FACTIONS_BY_ID = FACTIONS.reduce((acc, f) => {
  acc[f.id] = f;
  return acc;
}, {});

// Map the workbook's full display name to a faction record (Units sheet uses these)
export const FACTIONS_BY_NAME = FACTIONS.reduce((acc, f) => {
  acc[f.name] = f;
  return acc;
}, {});

// Counter graph: directed edges "attacker key -> the key it beats".
// Also builds the reverse (who beats me) for quick queries.
export const COUNTER_GRAPH = FACTIONS.reduce((acc, f) => {
  acc[f.key] = f.beats;
  return acc;
}, {});

export const COUNTERED_BY = FACTIONS.reduce((acc, f) => {
  // f beats f.beats  =>  f.beats is countered by f
  acc[f.beats] = f.key;
  return acc;
}, {});

// Signature damage lookup by faction key
export const SIGNATURE_DAMAGE = FACTIONS.reduce((acc, f) => {
  acc[f.key] = f.signatureDamage;
  return acc;
}, {});

// Query helpers ------------------------------------------------------------

export function getFaction(keyOrId) {
  if (typeof keyOrId === 'number') return FACTIONS_BY_ID[keyOrId] || null;
  return FACTIONS_BY_KEY[keyOrId] || FACTIONS_BY_NAME[keyOrId] || null;
}

// Returns true if attacker faction beats defender faction (single-step edge).
export function beats(attackerKey, defenderKey) {
  return COUNTER_GRAPH[attackerKey] === defenderKey;
}

// The faction key that the given faction counters (i.e. is strong against).
export function whoIBeat(key) {
  return COUNTER_GRAPH[key] || null;
}

// The faction key that counters the given faction (i.e. is strong against me).
export function whoBeatsMe(key) {
  return COUNTERED_BY[key] || null;
}

export function signatureDamageFor(key) {
  const f = getFaction(key);
  return f ? f.signatureDamage : null;
}

// The tutorial / vertical-slice attacker faction.
export const TUTORIAL_FACTION = FACTIONS.find((f) => f.tutorial) || FACTIONS[0];

export default {
  FACTIONS,
  FACTIONS_BY_KEY,
  FACTIONS_BY_ID,
  FACTIONS_BY_NAME,
  COUNTER_GRAPH,
  COUNTERED_BY,
  SIGNATURE_DAMAGE,
  TUTORIAL_FACTION,
  getFaction,
  beats,
  whoIBeat,
  whoBeatsMe,
  signatureDamageFor,
};