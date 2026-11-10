/**
 * src/menu/storeScreen.js — the OUTPOST & FARM inventory screen [MM-story_mwaf80xq_19]. Owner rule 5 (2026-11-10): a
 * clone of the INVENTORY screen dedicated to outposts and farming. It is not a copy: it is the INVENTORY screen
 * (menu/inventoryScreen.js) given a store as its source, so both share one markup, one stylesheet and one behaviour.
 * Tech plan docs/tech-plan/Farming.md §3.1, story A13.
 *
 * Tabs are data (STORE_TABS): the farm store ships "Crops". The SEED PODS tab (story A10) and later the Mining and
 * Parts stores are new rows here and in save/stores.js STORES, not new screens.
 */
import { createInventoryScreen, bandListHtml, bandDetailHtml } from './inventoryScreen.js';
import { esc } from './missionView.js';
import { STORES, storeBands, visitStore } from '../save/stores.js';

const titleCase = (w) => String(w).replace(/(^|[-\s])(\w)/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase());

/** Each store's tabs: [key, name, inTab(item)]. A tab with its own view (A10's seed pods) adds a row here. */
export const STORE_TABS = Object.freeze({
  farm: Object.freeze([['crops', 'Crops', () => true]]),
});

/** The detail lines for a farm crop. */
function cropDetail(band, r) {
  return {
    rows: [
      ['Material', r.newMaterial ? 'New material · grown only on farms' : 'The same material as the battle resource'],
      ['Category', esc(r.category || '—')], ['Grows as', esc(titleCase(r.growsAs || '—'))],
      ['Best grown', r.best && r.best.length ? r.best.map((m) => esc(titleCase(m))).join(', ') : '—'],
      ['From', esc(band.planet) + ' outpost farm'],
    ],
    note: r.newMaterial
      ? esc(r.name) + ' is a new material, made only by farming. It is not the battle resource of a similar name.'
      : 'Crops harvested on outpost farms are kept here, apart from the battle INVENTORY.',
  };
}
const DETAIL = { farm: cropDetail };

/** A store as an inventory-screen source (see BATTLE_INVENTORY in menu/inventoryScreen.js). */
export function storeSource(kind) {
  const st = STORES[kind], tabs = STORE_TABS[kind];
  if (!st || !tabs || !DETAIL[kind]) throw new Error('storeScreen: no store "' + kind + '"');
  return Object.freeze({
    key: 'stores-' + kind, title: st.name.toUpperCase(), label: st.name, icon: 'i-store', back: 'All ' + st.noun,
    tabs: Object.freeze(tabs.map(([k, n]) => [k, n])),
    inTab: (tab, r) => { const t = tabs.find((x) => x[0] === tab) || tabs[0]; return t[2](r); },
    load: () => null, loadFailed: 'Store failed to load',
    bands: (s, ctx, planetOpen, fresh) => storeBands(s, kind, planetOpen, fresh),
    visit: (s) => visitStore(s, kind),
    first: () => st.items[0].id,
    detail: (band, r) => DETAIL[kind](band, r),
  });
}
export const FARM_STORE = storeSource('farm');

export const storeListHtml = (bands, tab, selected, kind = 'farm') => bandListHtml(bands, storeSource(kind), tab, selected);
export const storeDetailHtml = (bands, selected, kind = 'farm') => bandDetailHtml(bands, selected, storeSource(kind), null);

/** The OUTPOST & FARM screen: the inventory screen on the farm store. Same options as createInventoryScreen. */
export const createStoreScreen = (opts, kind = 'farm') => createInventoryScreen({ ...opts, source: kind === 'farm' ? FARM_STORE : storeSource(kind) });
