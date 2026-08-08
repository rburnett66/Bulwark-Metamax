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
   *   files    EVERY content/units/<f>.units.json holding this faction's art. Empty when none is authored.
   *   voice    key into content/dialog/voicepacks.json and voice.js FACTIONS
   *   ordinal  1-based, matching the workbook faction id menu.js indexes by
   *
   * `files` IS A LIST BECAUSE THE CONTENT IS A LIST (GGG-6). This was a single `file`, and System has
   * three — system.units.json (6 units), system-flak (3), system-base (2). One-file-per-faction was an
   * assumption the content already contradicted, so the tool reached the first and SYS-Flak*, SYS-Base
   * and SYS-Harvester — five units — were unauthorable. The game has always loaded all three, via
   * content/units/index.json. Reality was right and the model was wrong; the model moved.
   */
  const FACTIONS = Object.freeze([
    { key: 'ground',   prefix: 'GND', name: 'Ground / Powder', files: ['ground-powder'],  voice: 'ground',    ordinal: 1 },
    { key: 'air',      prefix: 'AIR', name: 'Air',             files: [],                 voice: 'air',       ordinal: 2 },
    { key: 'hightech', prefix: 'HTC', name: 'High Tech',       files: [],                 voice: 'hightech',  ordinal: 3 },
    { key: 'artillery',prefix: 'ART', name: 'Artillery',       files: [],                 voice: 'artillery', ordinal: 4 },
    { key: 'water',    prefix: 'WTR', name: 'Water',           files: [],                 voice: 'water',     ordinal: 5 },
    { key: 'arcane',   prefix: 'ARC', name: 'Arcane / Energy', files: [],                 voice: 'arcane',    ordinal: 6 },
    { key: 'space',    prefix: 'SPC', name: 'Space Tech',      files: [],                 voice: 'space',     ordinal: 7 },
    { key: 'dark',     prefix: 'DRK', name: 'Dark Energy',     files: [],                 voice: 'dark',      ordinal: 8 },
    { key: 'greenies', prefix: 'GRN', name: 'Greenies (Chem)', files: ['greenies-chem-'], voice: 'greenies',  ordinal: 9 },
  ].map((f) => Object.freeze({ ...f, files: Object.freeze(f.files) })));

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
  const SYSTEM = Object.freeze({
    key: 'system', prefix: 'SYS', name: 'System', voice: null, ordinal: null,
    // ALL THREE. content/units/index.json has always listed all three and the game loads all three;
    // only the tool was reading one. Order matches index.json, and unitArt.js merges by id last-wins,
    // so keep it — the ids are disjoint today but the order is the tie-break if they ever are not.
    files: Object.freeze(['system', 'system-flak', 'system-base']),
  });

  const ALL = Object.freeze([...FACTIONS, SYSTEM]);

  const by = (field) => {
    const m = new Map();
    for (const f of ALL) if (f[field] != null) m.set(f[field], f);
    return m;
  };
  const BY_KEY = by('key'), BY_PREFIX = by('prefix'), BY_NAME = by('name'), BY_VOICE = by('voice');
  const BY_ORDINAL = by('ordinal');

  /**
   * The faction a workbook Faction_ID refers to. NOT an index into this list.
   *
   * MAPDATA's own Faction_Name column is the placeholder 'Faction_01'...'Faction_09', so array
   * POSITION was the only thing binding a workbook row to a real faction — and it was also the
   * fallback that would have rendered "FACTION_03" on a card. Two consumers had grown an identical
   * three-line copy of this; it belongs here.
   *
   * Returns null for an unknown id rather than undefined, so `Rival_Faction: 'none'` — a truthy
   * STRING that used to reach an array as ['none' - 1] and yield undefined — resolves cleanly.
   */
  function factionOfOrdinal(fid) {
    return BY_ORDINAL.get(fid) || null;
  }

  /** The faction a unit id belongs to, from its prefix. `GND-Tanks` -> ground. null if unrecognised. */
  function factionOfUnitId(unitId) {
    if (typeof unitId !== 'string') return null;
    const i = unitId.indexOf('-');
    return i < 0 ? null : (BY_PREFIX.get(unitId.slice(0, i)) || null);
  }

  /**
   * EVERY content/units/*.units.json holding this faction's art, in declaration order. `[]` when the
   * faction has no authored art, and `[]` for anything unrecognised.
   *
   * THIS RETURNS A LIST, NOT A FILE, and that is the fix for GGG-6. Its predecessor `fileOf` returned
   * one string, which forced every caller to believe a faction has at most one file — the same belief
   * that made system-flak and system-base unreachable. A caller that takes [0] has reintroduced the bug.
   */
  function filesOf(faction) {
    const f = find(faction);
    return f && f.files ? f.files.map((n) => `${n}.units.json`) : [];
  }

  /** Lookup by any spelling — display name, key or prefix. The one entry point callers should need. */
  function find(anything) {
    if (!anything) return null;
    if (typeof anything === 'object') return anything;
    return BY_NAME.get(anything) || BY_KEY.get(anything) || BY_PREFIX.get(anything) || null;
  }

  return {
    FACTIONS, SYSTEM, ALL,
    BY_KEY, BY_PREFIX, BY_NAME, BY_VOICE, BY_ORDINAL,
    factionOfOrdinal,
    find, filesOf, factionOfUnitId,
    NAMES: Object.freeze(FACTIONS.map((f) => f.name)),   // drop-in for the old FACTION_NAMES, same order
  };
});
