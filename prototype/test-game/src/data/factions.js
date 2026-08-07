/**
 * factions.js — the ONE place a faction is defined.
 *
 * WHY THIS EXISTS. The same nine factions were spelled five different ways, and the list was declared
 * four times independently (tables.js implicitly, menu.js, voice.js, and the Stack Forge). Nothing kept
 * them in step, and three confirmed bugs came out of that:
 *
 *   - Stack Forge computed an id prefix as name.slice(0,3).toUpperCase(). That disagreed with the real
 *     prefixes in tables.js SIX times out of nine: GRO/GND, HIG/HTC, WAT/WTR, SPA/SPC, DAR/DRK, GRE/GRN.
 *     It is why the orphan `SPA-U3` voxel pack exists — a Space Tech unit authored as SPA-* while every
 *     Space Tech unit is SPC-*, so it can never resolve to a unit def.
 *   - fileForFaction matched a 5-character prefix and took the first hit, making system-flak and
 *     system-base unreachable from the tool entirely.
 *   - artillery.units.json declares faction "Ground / Powder" and holds GND-* ids, so the tool shows
 *     Ground/Powder units under Artillery.
 *
 * THE PREFIX IS DECLARED, NOT DERIVED, and that is the whole point. No function turns "Ground / Powder"
 * into GND, "High Tech" into HTC, or "Dark Energy" into DRK. Anything that tries is guessing, and the
 * guess was wrong two thirds of the time. If you add a faction, write its prefix down here.
 *
 * ORDER IS LOAD-BEARING. menu.js indexes its faction list by a numeric id from the workbook data
 * (`FACTION_NAMES[fid - 1]`), so ORDER below must match the old FACTION_NAMES array exactly. `ordinal`
 * makes that explicit rather than implicit in array position — read it, don't count.
 *
 * MODULE FORMAT. stack-forge.js is a CLASSIC script and cannot import an ES module, while tables.js is
 * one. So this file works as both, following the carve.js / select.js precedent.
 *
 * IT EXPORTS ONE NAMED OBJECT, DELIBERATELY. palette.js did `Object.assign(globalThis, api)` and its
 * `medianCut` and `rgb2hsv` were silently overwritten by stack-forge.js's own hoisted top-level function
 * declarations — a real bug that needed `*Core` aliases to work around. A single namespace has no
 * surface to shadow.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (factions.test.mjs)
  root.BulwarkFactions = api;                                                  // browser: ONE name, namespaced
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /**
   * A playable faction. Every form it is ever spelled, declared together.
   *   key      stable machine id — safe in filenames, URLs and object keys
   *   prefix   the id prefix its units actually use in tables.js (GND-Tanks, SPC-Planes…)
   *   name     display name, and the value in each unit def's `faction` field
   *   file     content/units/<file>.units.json — null when no art file has been authored yet
   *   voice    key into content/dialog/voicepacks.json and voice.js FACTIONS
   *   ordinal  1-based, matching the workbook faction id menu.js indexes by
   */
  const FACTIONS = Object.freeze([
    { key: 'ground',   prefix: 'GND', name: 'Ground / Powder', file: 'ground-powder',  voice: 'ground',    ordinal: 1 },
    { key: 'air',      prefix: 'AIR', name: 'Air',             file: null,             voice: 'air',       ordinal: 2 },
    { key: 'hightech', prefix: 'HTC', name: 'High Tech',       file: null,             voice: 'hightech',  ordinal: 3 },
    { key: 'artillery',prefix: 'ART', name: 'Artillery',       file: null,             voice: 'artillery', ordinal: 4 },
    { key: 'water',    prefix: 'WTR', name: 'Water',           file: null,             voice: 'water',     ordinal: 5 },
    { key: 'arcane',   prefix: 'ARC', name: 'Arcane / Energy', file: null,             voice: 'arcane',    ordinal: 6 },
    { key: 'space',    prefix: 'SPC', name: 'Space Tech',      file: null,             voice: 'space',     ordinal: 7 },
    { key: 'dark',     prefix: 'DRK', name: 'Dark Energy',     file: null,             voice: 'dark',      ordinal: 8 },
    { key: 'greenies', prefix: 'GRN', name: 'Greenies (Chem)', file: 'greenies-chem-', voice: 'greenies',  ordinal: 9 },
  ].map(Object.freeze));

  // ARTILLERY HAS NO FILE ON PURPOSE. content/units/artillery.units.json exists but declares
  // faction "Ground / Powder" and contains only GND-* ids — its NAME contradicts its CONTENTS, and
  // unitArt.js merges by id last-wins so ground-powder.units.json overwrites it anyway. Pointing
  // Artillery at it is what makes the tool show Ground/Powder units under Artillery. Left null until
  // that file is re-idded or deleted (GGG-4); the tool must report "no art" rather than load a lie.

  /**
   * SYSTEM is not a playable faction. Its defs live in SYSTEM_UNITS, not UNITS, and it carries no voice
   * pack or ordinal — it is the base, harvester, walls and towers. Kept separate rather than bolted into
   * the list above so `FACTIONS` can be trusted to mean "the nine the player picks between".
   */
  const SYSTEM = Object.freeze({ key: 'system', prefix: 'SYS', name: 'System', file: 'system', voice: null, ordinal: null });

  const ALL = Object.freeze([...FACTIONS, SYSTEM]);

  const by = (field) => {
    const m = new Map();
    for (const f of ALL) if (f[field] != null) m.set(f[field], f);
    return m;
  };
  const BY_KEY = by('key'), BY_PREFIX = by('prefix'), BY_NAME = by('name'), BY_VOICE = by('voice');

  /** The faction a unit id belongs to, from its prefix. `GND-Tanks` -> ground. null if unrecognised. */
  function factionOfUnitId(unitId) {
    if (typeof unitId !== 'string') return null;
    const i = unitId.indexOf('-');
    return i < 0 ? null : (BY_PREFIX.get(unitId.slice(0, i)) || null);
  }

  /** content/units/<file>.units.json for a faction, or null when none is authored. */
  function fileOf(faction) {
    const f = typeof faction === 'string' ? (BY_NAME.get(faction) || BY_KEY.get(faction)) : faction;
    return f && f.file ? `${f.file}.units.json` : null;
  }

  /** Lookup by any spelling — display name, key or prefix. The one entry point callers should need. */
  function find(anything) {
    if (!anything) return null;
    if (typeof anything === 'object') return anything;
    return BY_NAME.get(anything) || BY_KEY.get(anything) || BY_PREFIX.get(anything) || null;
  }

  return {
    FACTIONS, SYSTEM, ALL,
    BY_KEY, BY_PREFIX, BY_NAME, BY_VOICE,
    find, fileOf, factionOfUnitId,
    NAMES: Object.freeze(FACTIONS.map((f) => f.name)),   // drop-in for the old FACTION_NAMES, same order
  };
});
