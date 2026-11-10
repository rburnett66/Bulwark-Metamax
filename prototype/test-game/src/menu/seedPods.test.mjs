// [MM-story_mwabgu9v_g] The SEED PODS tab of the OUTPOST & FARM inventory: crops by planet, five level slots each, the
// detail panel, UPGRADE (the A4 pod bench) and PLANT (a callback). The battle INVENTORY is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { storeBands } from '../save/stores.js';
import { inventoryBands } from '../save/inventory.js';
import { POD_LEVELS } from '../data/farm.js';
import { addPods, podCount } from '../farm/pods.js';
import { storeSource, FARM_STORE, STORE_TABS } from './storeScreen.js';
import { BATTLE_INVENTORY, inventoryListHtml } from './inventoryScreen.js';
import { seedPodsListHtml, seedPodsDetailHtml, seedPodsView, defaultLevel, podValue, hoursText } from './seedPods.js';
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

test('the list: 9 planet bands, 36 crops, 5 level slots each in the level colours, empty slots dimmed, locked planets dimmed', () => {
  const s = defaultSave();
  addPods(s, 'loam-grain', 1, 7); addPods(s, 'loam-grain', 3, 2); addPods(s, 'helium-4', 5, 1);
  const bands = storeBands(s, 'farm', (p) => p === 'Verdance' || p === 'Lumen');
  const html = seedPodsListHtml(bands, s, 'loam-grain', 3);
  assert.equal(count(html, /class="pband/g), 9);
  assert.equal(count(html, /class="pband locked/g), 7);
  assert.equal(count(html, /class="pcrop"/g), 36);
  assert.equal(count(html, /class="pslot[ "]/g), 180, '36 crops × 5 levels');
  assert.equal(count(html, /class="pslot"/g), 3, 'three slots hold pods');
  assert.equal(count(html, /class="pslot nil"/g), 177);
  for (const l of POD_LEVELS) assert.equal(count(html, new RegExp(`class="pslot[^"]*" data-inv-id="[^"]+" data-pod-lv="${l.level}"[^>]*style="--lc:${l.colour}"`, 'g')), 36, l.name);
  assert.ok(html.includes('data-inv-id="loam-grain" data-pod-lv="3" aria-selected="true"'));
  assert.equal(count(html, /aria-selected="true"/g), 2, 'the crop and its picked slot');
  assert.ok(html.includes('aria-label="Loam Grain, Common pods: 7"') && html.includes('<b class="num">7</b>'));
  assert.ok(html.includes('aria-label="Helium-4, Legendary pods: 1"'), 'Helium-4 in Lumen');
  assert.ok(html.includes('Portal: Florael not owned') && html.includes('aria-label="Petal Silk, Common pods: locked"'));
  const order = [...html.matchAll(/data-pod-lv="(\d)"/g)].slice(0, 5).map((m) => m[1]);
  assert.deepEqual(order, ['1', '2', '3', '4', '5'], 'Common → Legendary');
  assert.ok(html.includes('<b class="num">9</b> held'), 'Verdance band counts its pods');
  assert.ok(html.includes('Common tier') && !/<small>Common<\/small>/.test(html), 'the tier is named as a tier beside its ring');
});

test('the tab never uses an attribute the 3D menu draws into', () => {
  const s = defaultSave();
  const bands = storeBands(s, 'farm', all);
  const html = seedPodsListHtml(bands, s, 'loam-grain', 1) + seedPodsDetailHtml(bands, s, 'loam-grain', 1, { canPlant: true });
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!new RegExp(attr + '[=\\s>]').test(html), attr);
  const src = readFileSync(new URL('./seedPods.js', import.meta.url), 'utf8');
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!src.includes(attr), attr + ' in seedPods.js');
});

test('the detail panel: pods per level, grow time and yield per level, worth per level, where pods come from', () => {
  const s = withGold(500);
  addPods(s, 'loam-grain', 1, 4); addPods(s, 'loam-grain', 2, 1);
  const bands = storeBands(s, 'farm', all);
  const det = seedPodsDetailHtml(bands, s, 'loam-grain', 1);
  assert.ok(det.includes('<h2>Loam Grain</h2>') && det.includes('<div class="rdn num">5</div>'), 'the big number is pods held');
  assert.ok(det.includes('Common tier · pods held'));
  assert.ok(det.includes('<dt>Grows in</dt><dd>2 h · Traditional plot, every level</dd>'));
  assert.equal(count(det, /<tr class="[^"]*"><td><span class="plvn">/g), 5, 'a row per level');
  assert.ok(det.includes('Common</span></td><td class="num">4</td><td class="num">16</td><td class="num">×0.5 · 0.5 g</td>'));
  assert.ok(det.includes('Legendary</span></td><td class="num">0</td><td class="num">19</td><td class="num">×1.75 · 1.75 g</td>'), 'yield +20 %, worth 1.75× the battle price');
  assert.ok(det.includes('Battles on Verdance:') && det.includes('one per 200 units carried home'));
  assert.ok(det.includes('Verdance F1 contract: a Pod Crate of 12') && det.includes('The pod bench: 3 pods'));
  assert.ok(det.includes('<b class="num">50</b> gold'), 'the price of Common → Uncommon');
  assert.ok(det.includes('data-pod-up="loam-grain" data-up-lv="1"'));
  assert.ok(!det.includes('data-pod-plant'), 'PLANT hidden when nothing is wired');
  assert.ok(det.includes('All crops'), 'the phone back link');

  const he = seedPodsDetailHtml(bands, s, 'helium-4', 2);
  assert.ok(he.includes('Battles: none') && he.includes('no battle price'), 'Helium-4: no battle pods, no battle price');
  assert.ok(he.includes('<td class="num">×0.75</td>'), 'worth as a multiple only');
  const rare = cropOf('rootsong-seeds');
  assert.equal(podValue(rare, 3), null, 'rare-tier crops have no known battle price');
  assert.equal(podValue(cropOf('heartwood-amber'), 4), 2.6);
  assert.ok(seedPodsDetailHtml(bands, s, 'elder-bloom', 5).includes('is the top level.'));
  assert.equal(hoursText(7.5 * 3600), '7 h 30 min');
  assert.equal(defaultLevel(s, 'loam-grain'), 1);
  assert.equal(defaultLevel(s, 'elder-bloom'), 1);
});

test('UPGRADE through the screen\'s handler: 3 pods → 1 of the next level for its gold, saved, the menu told', () => {
  const s = withGold(1000);
  addPods(s, 'loam-grain', 1, 7);
  const v = seedPodsView(), api = fakeApi(s);
  assert.equal(v.click(btn({ invId: 'loam-grain', podLv: '1' }), api), false, 'a slot picks; the screen selects the crop');
  assert.equal(v.click(btn({ podUp: 'loam-grain', upLv: '1' }), api), true);
  assert.equal(podCount(s, 'loam-grain', 1), 4);
  assert.equal(podCount(s, 'loam-grain', 2), 1);
  assert.equal(s.carry.gold, 950);
  assert.deepEqual(api.calls, { render: 1, changed: 1, close: 0 });
  const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
  assert.ok(det.includes('class="pbmsg ok"') && det.includes('Upgraded: 3') && det.includes('for 50 gold'));
  assert.deepEqual(s.inventory, {}, 'the battle INVENTORY is untouched');
});

test('UPGRADE refusals: too few pods, too little gold, Legendary is the top — each said clearly, nothing changes', () => {
  const cases = [
    ['pods', () => { const s = withGold(1000); addPods(s, 'loam-grain', 2, 2); return s; }, 2, /Too few pods: the bench takes 3 .*and you hold 2\./],
    ['gold', () => { const s = withGold(120); addPods(s, 'loam-grain', 3, 3); return s; }, 3, /Too little gold: this upgrade costs 400 gold and the bank holds 120\./],
    ['top', () => { const s = withGold(9999); addPods(s, 'loam-grain', 5, 9); return s; }, 5, /is the top level: a Legendary pod cannot be upgraded\./],
  ];
  for (const [why, make, L, said] of cases) {
    const s = make(), before = JSON.stringify(s), v = seedPodsView(), api = fakeApi(s);
    assert.equal(v.click(btn({ podUp: 'loam-grain', upLv: String(L) }), api), true, why);
    assert.equal(JSON.stringify(s), before, why + ': a refusal changes nothing');
    assert.equal(api.calls.changed, 0, why);
    assert.equal(api.calls.render, 1, why);
    const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
    assert.ok(det.includes('class="pbmsg no"'), why);
    assert.match(det, said, why);
  }
});

test('PLANT: shown only when the menu wires onPlant, and hands it the crop and level', () => {
  const planted = [];
  const src = storeSource('farm', { onPlant: (c, l) => planted.push([c, l]) });
  const v = src.view('pods'), s = defaultSave();
  addPods(s, 'loam-grain', 1, 4);
  const det = v.detail(storeBands(s, 'farm', all), 'loam-grain', s);
  assert.ok(det.includes('data-pod-plant="loam-grain" data-plant-lv="1">Plant'));
  assert.equal(v.click(btn({ podPlant: 'loam-grain', plantLv: '1' }), fakeApi(s)), true);
  assert.deepEqual(planted, [['loam-grain', 1]]);
  const none = v.detail(storeBands(s, 'farm', all), 'elder-bloom', s);
  assert.ok(none.includes('data-plant-lv="1" disabled'), 'no pods, nothing to plant');
  assert.ok(!FARM_STORE.view('pods').detail(storeBands(s, 'farm', all), 'loam-grain', s).includes('data-pod-plant'));
});

test('the battle INVENTORY markup is unchanged by pods', () => {
  const s = defaultSave();
  s.inventory['loam-grain'] = 184;
  addPods(s, 'loam-grain', 3, 50);
  const html = inventoryListHtml(inventoryBands(s, CATALOG, all), 'all', 'loam-grain');
  assert.equal(count(html, /class="rt[ "]/g), 36);
  assert.ok(html.includes('>184<') && !html.includes('pslot') && !html.includes('Seed pods'));
});
