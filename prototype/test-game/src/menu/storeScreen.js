/**
 * src/menu/storeScreen.js — the OUTPOST & FARM inventory screen [MM-story_mwaf80xq_19]. Owner rule 5 (2026-11-10): a
 * clone of the INVENTORY screen dedicated to outposts and farming. It is not a copy: it is the INVENTORY screen
 * (menu/inventoryScreen.js) given a store as its source, so both share one markup, one stylesheet and one behaviour.
 * Tech plan docs/tech-plan/Farming.md §3.1, story A13.
 *
 * Tabs are data (STORE_TABS): the farm store ships "Crops" and "Seed pods" (story A10, menu/seedPods.js). The Mining
 * and Parts stores are new rows here and in save/stores.js STORES, not new screens.
 */
import { createInventoryScreen, bandListHtml, bandDetailHtml } from './inventoryScreen.js';
import { esc } from './missionView.js';
import { STORES, storeBands, visitStore } from '../save/stores.js';
import { seedPodsView } from './seedPods.js';

const titleCase = (w) => String(w).replace(/(^|[-\s])(\w)/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase());

/**
 * Each store's tabs: [key, name, inTab(item), view?]. view(opts) makes a tab that draws its own list and detail on this
 * screen (see `view` in menu/inventoryScreen.js): the farm's Seed pods (story A10, menu/seedPods.js).
 */
export const STORE_TABS = Object.freeze({
  farm: Object.freeze([['crops', 'Crops', () => true], ['pods', 'Seed pods', () => true, seedPodsView]]),
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

/**
 * A store as an inventory-screen source (see BATTLE_INVENTORY in menu/inventoryScreen.js). opts go to the tabs' views:
 * onPlant(cropId, level) wires the Seed pods tab's PLANT (hidden when absent).
 */
export function storeSource(kind, opts = {}) {
  const st = STORES[kind], tabs = STORE_TABS[kind];
  if (!st || !tabs || !DETAIL[kind]) throw new Error('storeScreen: no store "' + kind + '"');
  const back = 'All ' + st.noun;
  const views = new Map(tabs.filter((t) => t[3]).map((t) => [t[0], t[3]({ back, onPlant: opts.onPlant || null })]));
  return Object.freeze({
    key: 'stores-' + kind, title: st.name.toUpperCase(), label: st.name, icon: 'i-store', back,
    tabs: Object.freeze(tabs.map(([k, n]) => [k, n])),
    inTab: (tab, r) => { const t = tabs.find((x) => x[0] === tab) || tabs[0]; return t[2](r); },
    load: () => null, loadFailed: 'Store failed to load',
    bands: (s, ctx, planetOpen, fresh) => storeBands(s, kind, planetOpen, fresh),
    visit: (s) => visitStore(s, kind),
    first: () => st.items[0].id,
    detail: (band, r) => DETAIL[kind](band, r),
    view: (tab) => views.get(tab) || null,
  });
}
export const FARM_STORE = storeSource('farm');

export const storeListHtml = (bands, tab, selected, kind = 'farm') => bandListHtml(bands, storeSource(kind), tab, selected);
export const storeDetailHtml = (bands, selected, kind = 'farm') => bandDetailHtml(bands, selected, storeSource(kind), null);

/**
 * The OUTPOST & FARM screen: the inventory screen on the farm store. Same options as createInventoryScreen, plus
 * onPlant(cropId, level) for the Seed pods tab's PLANT (the FARM view, story A7, wires it; unwired, PLANT is hidden).
 */
export const createStoreScreen = ({ onPlant, ...opts }, kind = 'farm') => createInventoryScreen({ ...opts, source: storeSource(kind, { onPlant }) });
