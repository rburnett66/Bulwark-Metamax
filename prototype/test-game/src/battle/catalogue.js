/**
 * src/battle/catalogue.js — what a mode can build, in order, and what is locked [MM-task_mwcdvlf8_2t]
 * (S2.3 of One Battle UX, TECH_PLAN::One-Battle-UX.md §4).
 *
 * The battle's build rail (render/hud.js) and its number-key shortcuts (input/input.js) used to list
 * Object.keys(STRUCTURES) each on their own. A mode now hands the battle session ONE catalogue and both read it, so the
 * outpost's rail is the battle's rail with the outpost's items — not a second rail. A locked item shows its padlock and
 * reason on the rail, and the sim refuses it too (lockRule → state.placementRules), so a lock never depends on the UI.
 *
 *   createCatalogue(ids?, locks?) → { ids, locks, isLocked(id), setLocks(locks), tabs, tab, shown(), setTab(id) }
 *   battleCatalogueIds()          → the campaign's list (unchanged: every STRUCTURES entry but the harvester bay)
 *
 * TABS [MM-story_mwcgbd9q_2y] (owner 2026-11-11: "the Build menu should have build and Farm toggles so crops and
 * machinery appear in the build UI window"): a mode may hand SEVERAL named lists instead of one —
 *   createCatalogue([{ id: 'build', label: 'BUILD', ids: […] }, { id: 'farm', label: 'FARM', ids: […] }], locks)
 * The rail shows a toggle per tab and the items of the visible one; the number keys follow the visible tab (shown()).
 * With a plain id list (every battle) there is one tab, no toggle shows, and shown() is `ids` — the rail as before.
 */
import { STRUCTURES } from '../data/tables.js';

/** The campaign's build list, in the palette's order (number keys 1, 2, 3 … follow it). */
export function battleCatalogueIds() {
  return Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay');
}

const isTabList = (list) => Array.isArray(list) && list.length > 0 && typeof list[0] === 'object' && list[0] !== null && Array.isArray(list[0].ids);

/**
 * A catalogue: ids (ordered: every tab's, in tab order) and locks { [id]: reason }. setLocks replaces the locks in place
 * (the HUD and input hold it). `list` is an id array (one tab) or an array of tabs { id, label, ids }.
 */
export function createCatalogue(list = battleCatalogueIds(), locks = {}) {
  const tabs = Object.freeze((isTabList(list) ? list : [{ id: 'build', label: 'BUILD', ids: list }])
    .map((t) => Object.freeze({ id: String(t.id), label: String(t.label || t.id).toUpperCase(), ids: Object.freeze(t.ids.slice()) })));
  const listeners = [];
  const cat = {
    ids: Object.freeze(tabs.flatMap((t) => t.ids)),
    locks: { ...locks },
    tabs,
    /** The visible tab's id (the first until setTab). */
    tab: tabs[0].id,
    isLocked(id) { return cat.locks[id] || null; },
    setLocks(next) { for (const k of Object.keys(cat.locks)) delete cat.locks[k]; Object.assign(cat.locks, next || {}); },
    /** The visible tab's items, in order: what the rail shows and what keys 1, 2, 3 … pick. */
    shown() { return (tabs.find((t) => t.id === cat.tab) || tabs[0]).ids; },
    /** The tab an item is on, or null. */
    tabOf(id) { const t = tabs.find((x) => x.ids.includes(id)); return t ? t.id : null; },
    /** Show another tab (an unknown id is ignored). → whether it changed. Listeners (the HUD rail) hear it. */
    setTab(id) {
      if (!tabs.some((t) => t.id === id) || id === cat.tab) return false;
      cat.tab = id;
      for (const fn of listeners) fn(id);
      return true;
    },
    onTab(fn) { listeners.push(fn); },
  };
  return cat;
}

/** A placement rule (sim/structures.js state.placementRules) that refuses a locked item with its reason. */
export function lockRule(cat) {
  return (state, def, cell, structId) => (cat ? cat.isLocked(structId) : null);
}
