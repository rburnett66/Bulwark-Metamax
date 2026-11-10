/**
 * src/save/stores.js — the OUTPOST & FARM inventory and the stores that join it later [MM-story_mwaf80xq_19].
 * Owner rule 5 (2026-11-10): "all farming inventory goes into the new inventory system … eventually we will also have a
 * mining inventory and a parts inventory." Tech plan docs/tech-plan/Farming.md §3.1, §3.3, story A13.
 *
 *   s.stores    = { [kind]: { [planetKey]: { [itemId]: units } } }   kind: 'farm' (later 'mining', 'parts')
 *   s.storesNew = the same shape, what was added since the store screen was last opened
 *
 * Planets are keyed by the planet key ('ground'), as s.outposts is; every function also takes the planet's name
 * ('Verdance'). A store is DATA: STORES lists each kind's items, and a new kind is a new entry there, not new code.
 * The battle's s.inventory is never read or written here: a crop harvested on a farm never lands in it.
 * Pure: no DOM, no clock.
 */
import { CROPS } from '../data/farm.js';
import { PLANETS } from '../data/planets.js';
import { FACTIONS as VOICES } from '../comm/voice.js';

/**
 * The stores, by kind. items: every item the store can hold, in campaign order (planet order, then tier), each
 * { id, name, planet, planetKey, tier, … }. Mining and parts join here (Farming.md §3.1).
 */
export const STORES = Object.freeze({
  farm: Object.freeze({ kind: 'farm', name: 'Outpost & Farm', noun: 'crops', items: CROPS }),
});

const storeOf = (kind) => {
  const st = STORES[kind];
  if (!st) throw new Error('stores: no store "' + kind + '"');
  return st;
};
const KEY_BY_NAME = new Map(Object.entries(PLANETS).map(([k, p]) => [p.name, k]));
/** 'Verdance' or 'ground' → 'ground'. An unknown planet is a data defect, so it throws. */
export function planetKeyOf(planet) {
  if (PLANETS[planet]) return planet;
  const k = KEY_BY_NAME.get(planet);
  if (!k) throw new Error('stores: no planet "' + planet + '"');
  return k;
}
/** The store item `id` on `planet`; an item the store does not list there is a data defect, so it throws. */
function itemOf(kind, planet, id) {
  const key = planetKeyOf(planet), it = storeOf(kind).items.find((x) => x.id === id && x.planetKey === key);
  if (!it) throw new Error('stores: ' + kind + ' holds no "' + id + '" on ' + planet);
  return it;
}

const slot = (root, kind, key) => ((root[kind] || (root[kind] = {}))[key] || (root[kind][key] = {}));
const ensure = (s) => {
  if (!s.stores || typeof s.stores !== 'object') s.stores = {};
  if (!s.storesNew || typeof s.storesNew !== 'object') s.storesNew = {};
  for (const kind of Object.keys(STORES)) {
    if (!s.stores[kind] || typeof s.stores[kind] !== 'object') s.stores[kind] = {};
    if (!s.storesNew[kind] || typeof s.storesNew[kind] !== 'object') s.storesNew[kind] = {};
  }
  return s;
};
/** The empty stores a new save starts with (and an old save gains on load). */
export const emptyStores = () => ensure({}).stores;
export const emptyStoresNew = () => ensure({}).storesNew;
/** Fill in any store a save lacks (save.js migrate). */
export const migrateStores = (s) => { ensure(s); return s; };

/** Units of `id` held in `kind`'s store on `planet`. */
export function storeHeld(s, kind, planet, id) {
  storeOf(kind);
  const p = ((s.stores || {})[kind] || {})[planetKeyOf(planet)] || {};
  return p[id] || 0;
}

/** Add n whole units (counted as new until the next visit). → units now held. n ≤ 0 adds nothing. */
export function addToStore(s, kind, planet, id, n) {
  const it = itemOf(kind, planet, id);
  ensure(s);
  if (!(n > 0)) return storeHeld(s, kind, planet, id);
  const p = slot(s.stores, kind, it.planetKey), nw = slot(s.storesNew, kind, it.planetKey);
  p[id] = (p[id] || 0) + n;
  nw[id] = (nw[id] || 0) + n;
  return p[id];
}

/** Take n units out. Refuses (→ false, nothing changes) when the store holds fewer than n. → true when taken. */
export function takeFromStore(s, kind, planet, id, n) {
  const it = itemOf(kind, planet, id);
  if (!(n > 0)) return false;
  if (storeHeld(s, kind, planet, id) < n) return false;
  ensure(s);
  const p = slot(s.stores, kind, it.planetKey), nw = slot(s.storesNew, kind, it.planetKey);
  p[id] -= n;
  if (!p[id]) delete p[id];
  if (nw[id] > (p[id] || 0)) { if (p[id]) nw[id] = p[id]; else delete nw[id]; }   // "new" never counts more than is held
  return true;
}

const sumNested = (byPlanet) => Object.values(byPlanet || {}).reduce((a, p) => a + Object.values(p || {}).reduce((b, n) => b + n, 0), 0);
/** Units added to `kind`'s store since its last visit (the header chip's count). */
export const storeFresh = (s, kind) => sumNested((s.storesNew || {})[kind]);
/** Units held in `kind`'s store, every planet. */
export const storeTotal = (s, kind) => sumNested((s.stores || {})[kind]);

/** Opening the screen counts as the visit. → what was new ({ [planetKey]: { [id]: n } }), for the screen to show. */
export function visitStore(s, kind) {
  storeOf(kind);
  ensure(s);
  const shown = s.storesNew[kind];
  s.storesNew[kind] = {};
  return shown;
}

/**
 * Every item the store can hold, banded by planet in campaign order, held or not — the same band shape as
 * inventoryBands (save/inventory.js) so one screen draws both: { planet, planetKey, faction, open, resources, held, fresh }.
 * isOpen(planetName) → whether the player owns that planet; fresh = what visitStore returned.
 */
export function storeBands(s, kind, isOpen, fresh = (s.storesNew || {})[kind] || {}) {
  const held = (s.stores || {})[kind] || {}, bands = new Map();
  for (const it of storeOf(kind).items) {
    if (!bands.has(it.planetKey)) {
      const v = VOICES[it.planetKey];
      bands.set(it.planetKey, { planet: it.planet, planetKey: it.planetKey, faction: v ? v.name : it.planet, open: !!isOpen(it.planet), resources: [], held: 0, fresh: 0 });
    }
    const b = bands.get(it.planetKey), have = (held[it.planetKey] || {})[it.id] || 0, nw = (fresh[it.planetKey] || {})[it.id] || 0;
    b.resources.push({ ...it, have, fresh: nw });
    b.held += have; b.fresh += nw;
  }
  return [...bands.values()];
}
