// [MM-story_mvzkdvrl_1l] Inventory: harvest and rewards add to it; tech nodes are unlocked by missions, then bought.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from './save.js';
import { logMission, battleResult, applyBattle } from './missions.js';
import { settleBattle, syncMissions, flowCtx, collect } from './missionFlow.js';
import { bankHarvest, resourceOf, inventoryBands, inventoryFresh, visitInventory, wantedBy } from './inventory.js';
import { createBattleTally, tallyEvents, finishTally } from './battleTally.js';
import { BUYABLE, TECH_BY_ID, techStatus, techGates, readyIds, techPrice } from '../data/techtree.js';
import { techCtxFromSave, createGameTechAdapter } from '../menu/techSave.js';
import { inventoryListHtml, inventoryDetailHtml, INV_TABS } from '../menu/inventoryScreen.js';
import { missionChip, inventoryChip } from '../menu/badges.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const def = (id) => CATALOG.missions.find((m) => m.id === id);
const ctx = (s) => flowCtx(s, { allOpen: false, now: 1 });
const harvest = (colors) => {
  const t = createBattleTally();
  tallyEvents(t, Object.entries(colors).map(([color, units]) => ({ type: 'deposit', units, color })));
  return finishTally(t);
};
const battle = (planet, map, tally, over = {}) => battleResult({ mapId: map, planet, faction: 'x', result: 'win', totalWaves: 8, waveStars: [], tally, ...over });

test('the catalogue lists 36 resources: nine planets with one of each tier', () => {
  assert.equal(CATALOG.resources.length, 36);
  const planets = new Set(CATALOG.resources.map((r) => r.planet));
  assert.equal(planets.size, 9);
  for (const p of planets) for (const t of ['common', 'uncommon', 'rare', 'epic']) assert.ok(resourceOf(CATALOG, p, t), p + ' ' + t);
  assert.throws(() => resourceOf(CATALOG, 'Nowhere', 'common'), /Nowhere/);
});

test('a battle\'s harvest goes to that planet\'s resources, all four tiers', () => {
  const s = defaultSave();
  const out = bankHarvest(s, battle('Florael', 1, harvest({ blue: 40, yellow: 12, red: 3, green: 1 })), CATALOG);
  const id = (t) => resourceOf(CATALOG, 'Florael', t).id;
  assert.equal(s.inventory[id('common')], 40);
  assert.equal(s.inventory[id('uncommon')], 12);
  assert.equal(s.inventory[id('rare')], 3);
  assert.equal(s.inventory[id('epic')], 1);
  assert.equal(out[id('common')], 40);
  assert.equal(inventoryFresh(s), 56);
  bankHarvest(s, battle('Florael', 1, harvest({ blue: 10 })), CATALOG);
  assert.equal(s.inventory[id('common')], 50, 'adds up');
});

test('settling a battle banks the harvest, and gold still comes from the battle as before', () => {
  const s = defaultSave();
  s.carry = { gold: 77, structures: [] };
  settleBattle(s, battle('Verdance', 1, harvest({ blue: 5 })), CATALOG, ctx(s));
  assert.equal(s.inventory['loam-grain'], 5);
  assert.equal(s.carry.gold, 77, 'the inventory takes nothing from the bank');
});

test('no tally, no planet: nothing is invented', () => {
  const s = defaultSave();
  assert.deepEqual(bankHarvest(s, battle('Verdance', 1, null), CATALOG), {});
  assert.deepEqual(s.inventory, {});
});

test('mission rewards add to the inventory when collected, and count as new', () => {
  const s = defaultSave();
  s.capitalShips.Verdance = { arrived: true };
  const m = logMission(s, def('P-VER-01'), { now: 1 });
  applyBattle(s, battle('Verdance', 1, null), { now: 1 });
  assert.ok(collect(s, m.id, CATALOG, ctx(s)));
  assert.equal(s.inventory['loam-grain'], 5);
  assert.equal(inventoryFresh(s), 5);
});

test('a visit clears the new counts, and the screen keeps what it showed', () => {
  const s = defaultSave();
  bankHarvest(s, battle('Verdance', 1, harvest({ blue: 9 })), CATALOG);
  const shown = visitInventory(s);
  assert.equal(shown['loam-grain'], 9);
  assert.equal(inventoryFresh(s), 0);
  const bands = inventoryBands(s, CATALOG, () => true, shown);
  assert.equal(bands[0].fresh, 9);
  assert.equal(bands[0].held, 9);
});

test('every resource is listed, banded by planet in campaign order, whether held or not', () => {
  const s = defaultSave();
  const bands = inventoryBands(s, CATALOG, () => true);
  assert.equal(bands.length, 9);
  assert.equal(bands[0].planet, 'Verdance');
  assert.equal(bands[8].planet, 'Vexmire');
  assert.equal(bands.reduce((a, b) => a + b.resources.length, 0), 36);
  for (const b of bands) assert.deepEqual(b.resources.map((r) => r.tier), ['common', 'uncommon', 'rare', 'epic'], b.planet);
});

test('the screen: all 36 tiles with counts and tier, tabs filter, a locked planet stays listed and dimmed', () => {
  const s = defaultSave();
  s.inventory['loam-grain'] = 184;
  const bands = inventoryBands(s, CATALOG, (p) => p === 'Verdance');
  const html = inventoryListHtml(bands, 'all', 'loam-grain');
  assert.equal((html.match(/class="rt[ "]/g) || []).length, 36);
  assert.equal((html.match(/class="pband/g) || []).length, 9);
  assert.ok(html.includes('Loam Grain') && html.includes('>184<') && html.includes('Common'));
  assert.ok(html.includes('Portal: Florael not owned') && html.includes('pband locked'));
  assert.ok(html.includes('--rc:var(--r-common)') && html.includes('--rc:var(--r-epic)'));
  assert.equal((inventoryListHtml(bands, 'kept', null).match(/class="rt[ "]/g) || []).length, 18);
  assert.equal((inventoryListHtml(bands, 'quest', null).match(/class="rt[ "]/g) || []).length, 18);
  assert.deepEqual(INV_TABS.map((t) => t[0]), ['all', 'kept', 'quest']);
  const det = inventoryDetailHtml(bands, 'loam-grain', CATALOG);
  assert.ok(det.includes('Kept · worth 1 gold each') && det.includes('Wanted by'));
  assert.ok(wantedBy(CATALOG, 'Loam Grain').length > 0);
});

test('the screen never uses an attribute the 3D menu draws into: a closed screen stays laid out, so the stage would paint over the menu', () => {
  const s = defaultSave();
  const bands = inventoryBands(s, CATALOG, () => true);
  const html = inventoryListHtml(bands, 'all', 'loam-grain') + inventoryDetailHtml(bands, 'loam-grain', CATALOG);
  assert.ok(html.includes('data-inv-id="loam-grain"'), 'the tiles still say which resource they are');
  for (const attr of ['data-res', 'data-globe', 'data-craft', 'data-galaxy']) assert.ok(!new RegExp(attr + '[=\\s>]').test(html), attr);
});

test('the INVENTORY chip sits right of MISSIONS and shows what is new', () => {
  const src = readFileSync(new URL('../menu/progressWidget.js', import.meta.url), 'utf8');
  const markup = src.slice(src.indexOf('el.innerHTML'));
  assert.ok(markup.indexOf("chip('missions'") < markup.indexOf("chip('inventory'") && markup.indexOf("chip('inventory'") < markup.indexOf('pw-rank'));
  assert.deepEqual(inventoryChip(24, 36), { count: 24, text: '+24', tone: 'new', sub: [null, '36 resources'] });
  assert.equal(inventoryChip(0, 36).tone, null);
  assert.equal(inventoryChip(1046, 36).text, '+999', 'a long count must not cover the chip');
  assert.equal(missionChip({ ready: 0 }).tone, null);
});

// ── tech nodes unlock through missions, then are bought (D7)
test('every buyable node is unlocked by exactly one mission, at the game\'s own price', () => {
  for (const id of BUYABLE) {
    const t = CATALOG.techUnlocks[id];
    assert.ok(t && t.by, id + ' has a mission');
    assert.ok(def(t.by), id + ' mission exists');
    if (!TECH_BY_ID[id].portal) assert.equal(t.price, TECH_BY_ID[id].price || 0, id + ' price');
  }
});

test('resource costs are not implemented yet: filling them in on the workbook must fail here, not be ignored', () => {
  const costed = Object.entries(CATALOG.techUnlocks).filter(([, t]) => t.cost.length).map(([id]) => id);
  assert.deepEqual(costed, [], 'gold only until the Tech_Unlocks resource columns are filled in; then charge them in the Tech Net');
});

test('with the mission gate on, a node is locked until a mission unlocks it, then buyable for its price', () => {
  const s = defaultSave();
  s.carry = { gold: 10000, structures: [] };
  const on = () => techCtxFromSave(s, undefined, { missionGate: true, unlockedBy: () => 'Landfall at Verdance' });
  const cannon2 = TECH_BY_ID.cannon2;
  assert.equal(techStatus(cannon2, on()), 'locked');
  assert.ok(techGates(cannon2, on()).some((g) => !g.ok && g.txt.includes('Landfall at Verdance')));
  assert.ok(!readyIds(on()).includes('cannon2'));
  s.tech.unlocked.cannon2 = true;
  assert.equal(techStatus(cannon2, on()), 'ready');
  const save = { loadSave: () => s, buyTech: (id, price) => { s.carry.gold -= price; s.tech.owned[id] = true; s.tech.paid[id] = price; return true; }, refundTech: () => {} };
  const adapter = createGameTechAdapter({ save, ctxOpts: { missionGate: true } });
  assert.equal(adapter.buy('wall2'), false, 'not unlocked');
  assert.equal(adapter.buy('cannon2'), true);
  assert.equal(s.carry.gold, 10000 - techPrice(cannon2, on()), 'still charged');
  assert.equal(s.tech.paid.cannon2, 600);
});

test('starting-kit and free nodes stay owned; a node already bought stays owned; the sandbox has no mission gate', () => {
  const s = defaultSave();
  s.tech.owned.mk2 = true;
  const on = techCtxFromSave(s, undefined, { missionGate: true });
  assert.equal(techStatus(TECH_BY_ID.cannon1, on), 'owned');
  assert.equal(techStatus(TECH_BY_ID.mk2, on), 'owned', 'an old save keeps what it bought');
  const off = techCtxFromSave(s);
  assert.equal(off.unlocked, undefined);
  assert.ok(!techGates(TECH_BY_ID.cannon2, off).some((g) => /mission/i.test(g.txt)));
});

test('the loop closes: complete, collect, unlock, pay, and the next primary is granted', () => {
  const s = defaultSave();
  s.progress.xp = 100000;
  s.carry = { gold: 1000, structures: [] };
  syncMissions(s, CATALOG, ctx(s));
  settleBattle(s, battleResult({ mapId: 1, planet: 'Verdance', faction: 'x', result: 'win', totalWaves: 8, waveStars: Array.from({ length: 8 }, () => ({ stars: 4, flags: [] })) }), CATALOG, ctx(s));
  collect(s, 'P-VER-01', CATALOG, ctx(s));
  assert.equal(s.tech.unlocked.cannon2, true);
  assert.ok(!s.missions.some((m) => m.id === 'P-VER-02'), 'unlocked is not owned');
  s.tech.owned.cannon2 = true; s.carry.gold -= 600;
  assert.ok(syncMissions(s, CATALOG, ctx(s)).some((m) => m.id === 'P-VER-02'));
});
