// [MM-story_mwabgu9v_g] [MM-story_mwai5f8t_1g] The SEED PODS tab of the OUTPOST & FARM inventory: crops by planet, each
// with its pods held (a plain count), its crop level (the tech tree's) and the next level's node and price; the detail
// panel; BUY (a fixed price per pod) and PLANT (a callback). No UPGRADE: the tech tree buys levels. The battle INVENTORY
// is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { storeBands } from '../save/stores.js';
import { inventoryBands } from '../save/inventory.js';
import { POD_LEVELS, FARM } from '../data/farm.js';
import { addPods, podCount } from '../farm/pods.js';
import { storeSource, FARM_STORE, STORE_TABS } from './storeScreen.js';
import { BATTLE_INVENTORY, inventoryListHtml } from './inventoryScreen.js';
import { seedPodsListHtml, seedPodsDetailHtml, seedPodsView, podValue, hoursText, BUY_PODS } from './seedPods.js';
import { cropOf } from '../data/farm.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const all = () => true;
const withGold = (gold) => { const s = defaultSave(); s.carry = { gold, structures: [] }; s.goldBank = gold; return s; };
const count = (html, re) => (html.match(re) || []).length;
/** A fake button: what the screen's click handler hands the view. */
const btn = (dataset) => ({ dataset });
/** The screen's api over a plain save: update writes it, render and changed are counted. */
function fakeApi(s) {
  const calls = { render: 0, changed: 0, close: 0 };
  return { calls, update: (fn) => fn(s), render: () => { calls.render++; }, changed: () => { calls.changed++; }, close: () => { calls.close++; } };
}

test('the Seed pods tab is a row of the farm store, drawn by its own view on the same screen', () => {
  assert.deepEqual(STORE_TABS.farm.map((t) => t[1]), ['Crops', 'Seed pods']);
  const v = FARM_STORE.view('pods');
  assert.ok(v && typeof v.list === 'function' && typeof v.detail === 'function' && typeof v.click === 'function');
  assert.equal(BATTLE_INVENTORY.view, undefined, 'the battle INVENTORY has no pods tab (owner rule 5)');
  assert.deepEqual(BATTLE_INVENTORY.tabs.map((t) => t[0]), ['all', 'kept', 'quest']);
});

test('the list: 9 planet bands, 36 crops; each row its pods, its crop level in the level colour, the next level and price', () => {
  const s = defaultSave();
  addPods(s, 'loam-grain', 7); addPods(s, 'helium-4', 1);
  s.tech.owned.crop_loam_grain_2 = true; s.tech.owned.crop_loam_grain_3 = true;
  const bands = storeBands(s, 'farm', (p) => p === 'Verdance' || p === 'Lumen');
  const html = seedPodsListHtml(bands, s, 'loam-grain');
  assert.equal(count(html, /class="pband/g), 9);
  assert.equal(count(html, /class="pband locked/g), 7);
  assert.equal(count(html, /class="pcrop"/g), 36);
  assert.equal(count(html, /class="pslot pheld/g), 36, 'a pods cell per crop');
  assert.equal(count(html, /class="pslot plevel"/g), 36, 'a level cell per crop');
  assert.equal(count(html, /class="pslot pnextc/g), 36, 'a next-level cell per crop');
  assert.equal(count(html, /data-pod-lv=/g), 0, 'no per-level pod slots: pods have no level');
  assert.ok(html.includes('aria-label="Loam Grain: 7 pods"') && html.includes('<b class="num">7</b>'));
  assert.ok(html.includes('style="--lc:#4da6ff" aria-label="Loam Grain: level 3, Rare"'),
    'Loam Grain at level 3, in Rare\'s colour');
  assert.ok(html.includes('aria-label="Loam Grain: next level Loam Grain IV, 2,500 gold"') && html.includes('<b class="num">2,500</b>g'));
  assert.ok(html.includes('style="--lc:#ffffff" aria-label="Elder Bloom: level 1, Common"'), 'no levels bought: level 1');
  assert.ok(html.includes('aria-label="Elder Bloom: next level Elder Bloom II, 1,500 gold"'));
  assert.ok(html.includes('aria-label="Petal Silk: next level none"') && html.includes('More levels later'), 'other planets\' chains come later');
  assert.ok(html.includes('aria-label="Helium-4: 1 pods"'), 'Helium-4 in Lumen');
  assert.ok(html.includes('Portal: Florael not owned') && html.includes('aria-label="Petal Silk: locked pods"'));
  assert.ok(html.includes('<b class="num">7</b> held'), 'Verdance band counts its pods');
  assert.ok(html.includes('Common tier') && !/<small>Common<\/small>/.test(html), 'the tier is named as a tier beside its ring');
  for (const l of POD_LEVELS) assert.ok(html.includes(`style="--lc:${l.colour}"`), 'the legend shows ' + l.name);
});

test('the tab never uses an attribute the 3D menu draws into', () => {
  const s = defaultSave();
  const bands = storeBands(s, 'farm', all);
  const html = seedPodsListHtml(bands, s, 'loam-grain') + seedPodsDetailHtml(bands, s, 'loam-grain', { canPlant: true });
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!new RegExp(attr + '[=\\s>]').test(html), attr);
  const src = readFileSync(new URL('./seedPods.js', import.meta.url), 'utf8');
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!src.includes(attr), attr + ' in seedPods.js');
});

test('the detail panel: pods held, the crop level and the next node, yield and worth per level, map crops at 3, sources', () => {
  const s = withGold(500);
  addPods(s, 'loam-grain', 5);
  s.tech.owned.crop_loam_grain_2 = true;
  const bands = storeBands(s, 'farm', all);
  const det = seedPodsDetailHtml(bands, s, 'loam-grain');
  assert.ok(det.includes('<h2>Loam Grain</h2>') && det.includes('<div class="rdn num">5</div>'), 'the big number is pods held');
  assert.ok(det.includes('Common tier · pods held'));
  assert.ok(det.includes('<dt>Grows in</dt><dd>2 h · Traditional plot, every level</dd>'));
  assert.ok(det.includes('Crop level · <span class="plvn">') && det.includes('L2 Uncommon'));
  assert.ok(det.includes('New Loam Grain plantings grow at level 2; plots already growing keep the level they were planted at.'));
  assert.ok(det.includes('<b>Loam Grain III</b> · <b class="num">1,200</b> gold in the Tech Tree'));
  assert.ok(det.includes('Unlocked by Farming F1 on Verdance complete.'), 'III–V wait for F1 complete');
  assert.equal(count(det, /<tr class="[^"]*"><td><span class="plvn">/g), 5, 'a row per level');
  assert.ok(det.includes(' on"><td>') && det.includes('L2 Uncommon</span></td><td class="num">16</td>'), 'the level now is marked');
  assert.ok(det.includes('Legendary</span></td><td class="num">19</td><td class="num">×1.75 · 1.75 g</td>'), 'yield +20 %, worth 1.75× the battle price');
  assert.ok(det.includes('L3 Rare</span> <small>= battle maps</small>'), 'battle-map crops count as level 3');
  assert.ok(det.includes('Crops from battle maps count as level 3 (Rare).'));
  assert.ok(det.includes('Battles on Verdance:') && det.includes('one pod per 200 units carried home'));
  assert.ok(det.includes('Verdance F1 contract: a Pod Crate of 12 pods.') && !det.includes('pod bench'));
  assert.ok(det.includes(`<b class="num">${FARM.Pod_Price}</b> gold a pod, every crop alike`));
  assert.ok(det.includes(`data-pod-buy="loam-grain" data-buy-n="${BUY_PODS}">Buy 4 · 100g`));
  assert.ok(!det.includes('data-pod-up'), 'no UPGRADE: the tech tree buys levels');
  assert.ok(!det.includes('data-pod-plant'), 'PLANT hidden when nothing is wired');
  assert.ok(det.includes('All crops'), 'the phone back link');

  const he = seedPodsDetailHtml(bands, s, 'helium-4');
  assert.ok(he.includes('Battles: none') && he.includes('no battle price'), 'Helium-4: no battle pods, no battle price');
  assert.ok(he.includes('<td class="num">×0.75</td>'), 'worth as a multiple only');
  assert.ok(he.includes('More levels come with this planet'), 'no chain yet');
  assert.equal(podValue(cropOf('rootsong-seeds'), 3), null, 'rare-tier crops have no known battle price');
  assert.equal(podValue(cropOf('heartwood-amber'), 4), 2.6);
  const top = withGold(0);
  for (const L of [2, 3, 4, 5]) top.tech.owned['crop_elder_bloom_' + L] = true;
  assert.ok(seedPodsDetailHtml(storeBands(top, 'farm', all), top, 'elder-bloom').includes('is the top level.'));
  assert.ok(seedPodsDetailHtml(storeBands(top, 'farm', all), top, 'elder-bloom').includes('Level 5 needs a trick'));
  const f1 = withGold(0);
  f1.farmContracts = { ground: { step: 1, state: 'active' } };
  assert.ok(seedPodsDetailHtml(storeBands(f1, 'farm', all), f1, 'loam-grain').includes('Unlocked: buy it in the Tech Tree.'), 'II opens with F1 accepted');
  assert.equal(hoursText(7.5 * 3600), '7 h 30 min');
});

test('BUY through the screen\'s handler: 4 pods at the fixed price, saved, the menu told', () => {
  const s = withGold(1000);
  const v = seedPodsView(), api = fakeApi(s);
  assert.equal(v.click(btn({ invId: 'loam-grain' }), api), false, 'a cell lets the screen select the crop');
  assert.equal(v.click(btn({ podBuy: 'loam-grain', buyN: '4' }), api), true);
  assert.equal(podCount(s, 'loam-grain'), 4);
  assert.equal(s.carry.gold, 1000 - 4 * FARM.Pod_Price);
  assert.deepEqual(api.calls, { render: 1, changed: 1, close: 0 });
  const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
  assert.ok(det.includes('class="pbmsg ok"') && det.includes('Bought 4 Loam Grain pods for 100 gold.'));
  assert.equal(v.click(btn({ podBuy: 'elder-bloom', buyN: '4' }), api), true);
  assert.equal(podCount(s, 'elder-bloom'), 4, 'every crop at the same price');
  assert.equal(s.carry.gold, 800);
  assert.deepEqual(s.inventory, {}, 'the battle INVENTORY is untouched');
});

test('BUY with too little gold: said clearly, nothing changes; the button is disabled', () => {
  const s = withGold(99), before = JSON.stringify(s), v = seedPodsView(), api = fakeApi(s);
  assert.ok(v.detail(storeBands(s, 'farm', all), 'loam-grain', s).includes('data-buy-n="4" disabled'));
  assert.equal(v.click(btn({ podBuy: 'loam-grain', buyN: '4' }), api), true);
  assert.equal(JSON.stringify(s), before, 'a refusal changes nothing');
  assert.equal(api.calls.changed, 0);
  const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
  assert.match(det, /class="pbmsg no"[^>]*>Too little gold: 4 pods cost 100 gold and the bank holds 99\./);
});

test('PLANT: shown only when the menu wires onPlant, and hands it the crop', () => {
  const planted = [];
  const src = storeSource('farm', { onPlant: (c) => planted.push(c) });
  const v = src.view('pods'), s = defaultSave();
  addPods(s, 'loam-grain', 4);
  const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
  assert.ok(det.includes('data-pod-plant="loam-grain">Plant'));
  assert.equal(v.click(btn({ podPlant: 'loam-grain' }), fakeApi(s)), true);
  assert.deepEqual(planted, ['loam-grain']);
  const none = v.detail(storeBands(s, 'farm', all), 'elder-bloom', s);
  assert.ok(none.includes('data-pod-plant="elder-bloom" disabled'), 'no pods, nothing to plant');
  assert.ok(!FARM_STORE.view('pods').detail(storeBands(s, 'farm', all), 'loam-grain', s).includes('data-pod-plant'));
});

test('the battle INVENTORY markup is unchanged by pods', () => {
  const s = defaultSave();
  s.inventory['loam-grain'] = 184;
  addPods(s, 'loam-grain', 50);
  const html = inventoryListHtml(inventoryBands(s, CATALOG, all), 'all', 'loam-grain');
  assert.equal(count(html, /class="rt[ "]/g), 36);
  assert.ok(html.includes('>184<') && !html.includes('pslot') && !html.includes('Seed pods'));
});
