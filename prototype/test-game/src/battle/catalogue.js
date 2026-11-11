/**
 * src/battle/catalogue.js — what a mode can build, in order, and what is locked [MM-task_mwcdvlf8_2t]
 * (S2.3 of One Battle UX, TECH_PLAN::One-Battle-UX.md §4).
 *
 * The battle's build rail (render/hud.js) and its number-key shortcuts (input/input.js) used to list
 * Object.keys(STRUCTURES) each on their own. A mode now hands the battle session ONE catalogue and both read it, so the
 * outpost's rail is the battle's rail with the outpost's items — not a second rail. A locked item shows its padlock and
 * reason on the rail, and the sim refuses it too (lockRule → state.placementRules), so a lock never depends on the UI.
 *
 *   createCatalogue(ids?, locks?) → { ids, locks, isLocked(id), setLocks(locks) }
 *   battleCatalogueIds()          → the campaign's list (unchanged: every STRUCTURES entry but the harvester bay)
 */
import { STRUCTURES } from '../data/tables.js';

/** The campaign's build list, in the palette's order (number keys 1, 2, 3 … follow it). */
export function battleCatalogueIds() {
  return Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay');
}

/** A catalogue: ids (ordered) and locks { [id]: reason }. setLocks replaces the locks in place (the HUD and input hold it). */
export function createCatalogue(ids = battleCatalogueIds(), locks = {}) {
  const cat = {
    ids: Object.freeze(ids.slice()),
    locks: { ...locks },
    isLocked(id) { return cat.locks[id] || null; },
    setLocks(next) { for (const k of Object.keys(cat.locks)) delete cat.locks[k]; Object.assign(cat.locks, next || {}); },
  };
  return cat;
}

/** A placement rule (sim/structures.js state.placementRules) that refuses a locked item with its reason. */
export function lockRule(cat) {
  return (state, def, cell, structId) => (cat ? cat.isLocked(structId) : null);
}
