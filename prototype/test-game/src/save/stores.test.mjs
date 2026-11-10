// [MM-story_mwaf80xq_19] The OUTPOST & FARM inventory: s.stores.farm banded by planet, apart from the battle INVENTORY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from './save.js';
import { STORES, addToStore, takeFromStore, storeHeld, storeFresh, storeTotal, visitStore, storeBands, planetKeyOf } from './stores.js';
import { inventoryBands } from './inventory.js';
import { CROPS } from '../data/farm.js';
import { inventoryListHtml, inventoryDetailHtml, BATTLE_INVENTORY } from '../menu/inventoryScreen.js';
import { storeListHtml, storeDetailHtml, storeSource, STORE_TABS, FARM_STORE } from '../menu/storeScreen.js';
import { inventoryChip } from '../menu/badges.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const all = () => true;

test('a new save and an old save both start with an empty farm store', () => {
  const s = defaultSave();
  assert.deepEqual(s.stores, { farm: {} });
  assert.deepEqual(s.storesNew, { farm: {} });
  const old = defaultSave(); delete old.stores; delete old.storesNew;
  const m = migrate(old);
  assert.deepEqual(m.stores, { farm: {} });
  assert.deepEqual(m.storesNew, { farm: {} });
});

test('add, hold and take: keyed by planet key, the planet name works too', () => {
  const s = defaultSave();
  assert.equal(addToStore(s, 'farm', 'Verdance', 'loam-grain', 16), 16);
  assert.equal(addToStore(s, 'farm', 'ground', 'loam-grain', 4), 20);
  assert.deepEqual(s.stores.farm, { ground: { 'loam-grain': 20 } });
  assert.equal(storeHeld(s, 'farm', 'Verdance', 'loam-grain'), 20);
  assert.equal(storeHeld(s, 'farm', 'ground', 'elder-bloom'), 0);
  assert.equal(takeFromStore(s, 'farm', 'Verdance', 'loam-grain', 5), true);
  assert.equal(storeHeld(s, 'farm', 'ground', 'loam-grain'), 15);
  assert.equal(storeTotal(s, 'farm'), 15);
  assert.equal(planetKeyOf('Lumen'), 'space');
});

test('taking more than is held is refused and changes nothing', () => {
  const s = defaultSave();
  addToStore(s, 'farm', 'Lumen', 'helium-4', 3);
  const before = JSON.stringify(s);
  assert.equal(takeFromStore(s, 'farm', 'Lumen', 'helium-4', 4), false);
  assert.equal(takeFromStore(s, 'farm', 'Lumen', 'regolith', 1), false, 'none held');
  assert.equal(takeFromStore(s, 'farm', 'Lumen', 'helium-4', 0), false);
  assert.equal(JSON.stringify(s), before);
  assert.equal(takeFromStore(s, 'farm', 'Lumen', 'helium-4', 3), true);
  assert.deepEqual(s.stores.farm.space, {}, 'an emptied slot is removed');
  assert.equal(storeFresh(s, 'farm'), 0, 'new never counts more than is held');
});

test('an item the store does not list on that planet, an unknown planet or store, is a data defect', () => {
  const s = defaultSave();
  assert.throws(() => addToStore(s, 'farm', 'Verdance', 'helium-4', 1), /helium-4/);
  assert.throws(() => addToStore(s, 'farm', 'Lumen', 'helium-3', 1), /helium-3/, 'Helium-3 is a battle resource, not a crop');
  assert.throws(() => addToStore(s, 'farm', 'Nowhere', 'loam-grain', 1), /Nowhere/);
  assert.throws(() => addToStore(s, 'mining', 'Verdance', 'loam-grain', 1), /mining/);
  assert.equal(addToStore(s, 'farm', 'Verdance', 'loam-grain', -2), 0, 'nothing negative is banked');
});

test('the battle inventory is never read or written by the store', () => {
  const s = defaultSave();
  s.inventory['loam-grain'] = 7; s.inventoryNew['loam-grain'] = 7;
  addToStore(s, 'farm', 'Verdance', 'loam-grain', 50);
  takeFromStore(s, 'farm', 'Verdance', 'loam-grain', 10);
  visitStore(s, 'farm');
  assert.deepEqual(s.inventory, { 'loam-grain': 7 });
  assert.deepEqual(s.inventoryNew, { 'loam-grain': 7 });
  const b = storeBands(s, 'farm', all);
  assert.equal(b[0].resources[0].have, 40, 'the store reads its own count, not the battle one');
  const code = readFileSync(new URL('./stores.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\.inventory/.test(code), 'stores.js code never names the battle inventory');
});

test('new since the last visit: counted for the chip, cleared by a visit, kept for the open screen', () => {
  const s = defaultSave();
  addToStore(s, 'farm', 'Verdance', 'loam-grain', 9);
  addToStore(s, 'farm', 'Lumen', 'helium-4', 2);
  assert.equal(storeFresh(s, 'farm'), 11);
  const shown = visitStore(s, 'farm');
  assert.deepEqual(shown, { ground: { 'loam-grain': 9 }, space: { 'helium-4': 2 } });
  assert.equal(storeFresh(s, 'farm'), 0);
  const bands = storeBands(s, 'farm', all, shown);
  assert.equal(bands[0].fresh, 9);
  assert.equal(bands[0].held, 9);
  assert.deepEqual(inventoryChip(storeFresh(s, 'farm'), STORES.farm.items.length, STORES.farm.noun), { count: 0, text: '', tone: null, sub: [null, '36 crops'] });
});

test('the bands: nine planets in campaign order, the 36 crops, Helium-4 in Lumen\'s uncommon slot', () => {
  const s = defaultSave();
  const bands = storeBands(s, 'farm', (p) => p === 'Verdance');
  const battle = inventoryBands(defaultSave(), CATALOG, all);
  assert.equal(bands.length, 9);
  assert.deepEqual(bands.map((b) => b.planet), battle.map((b) => b.planet), 'the battle inventory\'s planet order');
  assert.deepEqual(bands.map((b) => b.faction), battle.map((b) => b.faction));
  assert.equal(bands.reduce((a, b) => a + b.resources.length, 0), 36);
  assert.equal(STORES.farm.items, CROPS);
  for (const b of bands) assert.deepEqual(b.resources.map((r) => r.tier), ['common', 'uncommon', 'rare', 'epic'], b.planet);
  const lumen = bands.find((b) => b.planet === 'Lumen');
  assert.equal(lumen.resources[1].id, 'helium-4');
  assert.equal(lumen.resources[1].newMaterial, true);
  assert.ok(bands[0].open && !bands[1].open);
});

// ── the screen: the INVENTORY screen on the store (one markup, menu/inventoryScreen.js)
test('the store screen: 36 tiles, 9 bands, Helium-4 listed, the Crops tab, the detail panel', () => {
  const s = defaultSave();
  addToStore(s, 'farm', 'Verdance', 'loam-grain', 184);
  addToStore(s, 'farm', 'Lumen', 'helium-4', 6);
  const bands = storeBands(s, 'farm', (p) => p === 'Verdance' || p === 'Lumen');
  const html = storeListHtml(bands, 'crops', 'helium-4');
  assert.equal((html.match(/class="rt[ "]/g) || []).length, 36);
  assert.equal((html.match(/class="pband/g) || []).length, 9);
  assert.ok(html.includes('Helium-4') && html.includes('data-inv-id="helium-4" aria-selected="true"'));
  assert.ok(html.includes('>184<') && html.includes('Portal: Florael not owned'));
  assert.deepEqual(STORE_TABS.farm.map((t) => t[0]), ['crops']);
  assert.deepEqual(FARM_STORE.tabs, [['crops', 'Crops']]);
  assert.equal(FARM_STORE.title, 'OUTPOST & FARM');
  assert.equal(FARM_STORE.icon, 'i-store');
  const det = storeDetailHtml(bands, 'helium-4');
  assert.ok(det.includes('Helium-4') && det.includes('New material') && det.includes('Lumen outpost farm'));
  assert.ok(det.includes('All crops'), 'the phone back link');
  assert.ok(storeDetailHtml(bands, 'loam-grain').includes('The same material as the battle resource'));
  assert.throws(() => storeSource('parts'), /parts/, 'a store joins by data, here and in STORES');
});

test('the store screen never uses an attribute the 3D menu draws into', () => {
  const s = defaultSave();
  const bands = storeBands(s, 'farm', all);
  const html = storeListHtml(bands, 'crops', 'loam-grain') + storeDetailHtml(bands, 'loam-grain');
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!new RegExp(attr + '[=\\s>]').test(html), attr);
  const src = readFileSync(new URL('../menu/storeScreen.js', import.meta.url), 'utf8') + readFileSync(new URL('../menu/inventoryScreen.js', import.meta.url), 'utf8');
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!src.includes(attr), attr + ' in the screen code');
});

test('the battle INVENTORY markup is the same screen as before: its source, its tabs, its detail', () => {
  const s = defaultSave();
  s.inventory['loam-grain'] = 184;
  addToStore(s, 'farm', 'Verdance', 'loam-grain', 999);
  const bands = inventoryBands(s, CATALOG, all);
  const html = inventoryListHtml(bands, 'all', 'loam-grain');
  assert.ok(html.includes('>184<') && !html.includes('>999<'), 'the battle screen shows the battle count');
  assert.equal(BATTLE_INVENTORY.title, 'INVENTORY');
  assert.deepEqual(BATTLE_INVENTORY.tabs.map((t) => t[0]), ['all', 'kept', 'quest']);
  const det = inventoryDetailHtml(bands, 'loam-grain', CATALOG);
  assert.ok(det.includes('All resources') && det.includes('<dt>Role</dt><dd>Kept · worth 1 gold each</dd>\n    <dt>From</dt><dd>Verdance harvests</dd>'));
});

test('the STORES chip sits right of INVENTORY, uses an icon the sprite has, and opens as an overlay', () => {
  const src = readFileSync(new URL('../menu/progressWidget.js', import.meta.url), 'utf8');
  const markup = src.slice(src.indexOf('el.innerHTML'));
  assert.ok(markup.indexOf("chip('inventory'") < markup.indexOf("chip('stores'") && markup.indexOf("chip('stores'") < markup.indexOf('pw-rank'));
  const sprite = readFileSync(new URL('../../content/missions/mission-icons.svg', import.meta.url), 'utf8');
  assert.ok(sprite.includes('<symbol id="i-store"'));
  const menu = readFileSync(new URL('../menu/menu.js', import.meta.url), 'utf8');
  assert.ok(/OVERLAYS = new Set\(\[[^\]]*'stores'/.test(menu));
  assert.ok(menu.includes("if (screen === 'stores') stores.open(); else stores.close();"));
});
