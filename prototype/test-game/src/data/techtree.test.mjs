// The Tech Tree's data and rules [MM-story_mvkhed1f_h] — Tech-Tree-Design v1.1 (57 upgrades, four divisions), + the
// 7 Outpost nodes of story O10 [MM-story_mw5oem5o_r].
import test from 'node:test';
import assert from 'node:assert/strict';
import { TECH_NODES, TECH_BY_ID, BUYABLE, TECH_TOTAL, DIVISIONS, TREES, TREE_ORDER, TREE_TOTAL, treeOf, startingOwned, techStatus, techPrice, techGates, readyIds,
  settleFree, refundBlock, portalsOwned, countOwned } from './techtree.js';

const ctx = (owned, bank = 0, extra = {}) => ({ owned: settleFree(new Set([...startingOwned(), ...owned])), bank, paid: {}, ...extra });

test('67 upgrades: Units 25, Bases 21 (+ capstone), Map 10, Outpost 7 (story O10), Machinery 3 (owner 2026-11-21)', () => {
  assert.equal(BUYABLE.length, TECH_TOTAL);
  assert.equal(TECH_TOTAL, 67);
  const by = (d) => BUYABLE.filter((id) => TECH_BY_ID[id].div === d && TECH_BY_ID[id].kind !== 'ult').length;
  assert.equal(by('units'), DIVISIONS.units.total);
  assert.equal(by('bases'), DIVISIONS.bases.total);
  assert.equal(by('map'), DIVISIONS.map.total);
  assert.equal(by('structures') + by('mining'), 7);
  assert.equal(DIVISIONS.structures.total, by('structures'));
  assert.equal(DIVISIONS.mining.total, by('mining'));
  assert.equal(by('seedpods'), 0, 'seed pods shows progress; nothing to buy');
  assert.equal(by('machinery'), 3);
  assert.equal(DIVISIONS.machinery.total, by('machinery'));
  assert.ok(BUYABLE.includes('apocalypse'));
});

test('two trees (owner 2026-11-09): the battle tree has no Outpost section; the outpost & farm tree has four', () => {
  assert.deepEqual(TREE_ORDER, ['battle', 'outpost']);
  assert.deepEqual([...TREES.battle.divs], ['units', 'bases', 'map', 'ships']);
  assert.deepEqual([...TREES.outpost.divs], ['seedpods', 'machinery', 'structures', 'mining']);
  assert.ok(!('outpost' in DIVISIONS), 'Outpost is no longer a division of the battle tree');
  for (const k of TREE_ORDER) {
    const divs = TREES[k].divs;
    assert.equal(DIVISIONS[divs[0]].a0, 0, k + ' starts at 0°');
    assert.equal(DIVISIONS[divs.at(-1)].a1, 360, k + ' closes the circle');
    for (let i = 1; i < divs.length; i++) assert.equal(DIVISIONS[divs[i]].a0, DIVISIONS[divs[i - 1]].a1, divs[i] + ' follows ' + divs[i - 1]);
    for (const d of divs) assert.equal(DIVISIONS[d].tree, k);
    assert.equal(TECH_BY_ID[TREES[k].core].kind, 'core');
    assert.equal(BUYABLE.filter((id) => treeOf(TECH_BY_ID[id]) === k).length, TREE_TOTAL[k]);
  }
  assert.equal(TREE_TOTAL.battle + TREE_TOTAL.outpost, TECH_TOTAL);
  for (const n of TECH_NODES) for (const r of n.req) assert.equal(treeOf(TECH_BY_ID[r]), treeOf(n), n.id + ' and its prerequisite ' + r + ' are in one tree');
  assert.ok(!DIVISIONS.seedpods.soon && !DIVISIONS.machinery.soon && DIVISIONS.seedpods.progress, 'seed pods shows progress; machinery is bought');
  assert.deepEqual(TREE_TOTAL, { battle: 57, outpost: 10 });
  assert.ok(startingOwned().has('outpost_hub'), 'the outpost tree\'s centre is owned from the start');
});

test('the Outpost nodes: every contract tech exists, priced from the workbook, and no ghost is left (story O10)', async () => {
  const { MAPDATA } = await import('../../content/maps/mapdata.js');
  const named = new Set();
  for (const c of MAPDATA.outpostContracts) for (const t of String(c.Unlocks).split(/\s+/)) if (t.startsWith('tech:')) named.add(t.slice(5));
  for (const r of MAPDATA.outpostStructures) if (String(r.Unlock).startsWith('tech:')) named.add(r.Unlock.slice(5));
  assert.deepEqual([...named].sort(), ['cargo_shuttle_2', 'deep_drilling_1', 'power_grid_2', 'reinforced_walls', 'rig_mk2', 'sensor_spire', 'supply_depot']);
  for (const id of named) {
    const n = TECH_BY_ID[id], row = MAPDATA.outpostTech.find((r) => r.Node === id);
    assert.ok(n && n.outpost && treeOf(n) === 'outpost' && !n.soon, id + ' is a buyable node of the outpost tree');
    assert.ok(row && row.Price > 0 && n.price === row.Price, id + ' is priced from the workbook');
    assert.equal(techStatus(n, ctx([], 0)) !== 'soon', true);
  }
  assert.ok(!TECH_NODES.some((n) => n.kind === 'ghost' || /^op\d$/.test(n.id)), 'the five ghosts are gone');
  assert.deepEqual(TECH_BY_ID.rig_mk2.req, ['deep_drilling_1']);
});

test('an Outpost node is gated by its contract, then bought like any mission node (tech plan D7)', () => {
  const c = ctx([], 99999, { unlocked: new Set(), unlockedBy: () => null });
  assert.equal(techStatus(TECH_BY_ID.deep_drilling_1, c), 'locked');
  assert.match(techGates(TECH_BY_ID.deep_drilling_1, c)[0].txt, /Outpost contract 1/);
  const u = ctx([], 99999, { unlocked: new Set(['deep_drilling_1']) });
  assert.equal(techStatus(TECH_BY_ID.deep_drilling_1, u), 'ready');
  assert.equal(techPrice(TECH_BY_ID.deep_drilling_1, u), TECH_BY_ID.deep_drilling_1.price);
  assert.equal(techStatus(TECH_BY_ID.rig_mk2, ctx([], 99999, { unlocked: new Set(['rig_mk2']) })), 'locked', 'needs Deep Drilling I');
});

// ── owner 2026-11-21 [MM-story_mwatmww5_1l] [MM-story_mwatmy2u_1m]: no tree for crop levels, only the farm equipment ──
test('SEED PODS: one progress node per planet, its four crops; never bought, priced or refunded', () => {
  const planets = TECH_NODES.filter((n) => n.div === 'seedpods' && n.progress);
  assert.equal(planets.length, 9);
  assert.equal(planets.reduce((k, n) => k + n.crops.length, 0), 36, '9 × 4');
  assert.equal(DIVISIONS.seedpods.total, 36);
  assert.ok(!TECH_NODES.some((n) => /^crop_/.test(n.id)), 'the crop level nodes are gone');
  assert.ok(TECH_BY_ID.pod_store && TECH_BY_ID.pod_store.soon, 'Faction Pod Stores stays a ghost');
  const v = TECH_BY_ID.pods_ground;
  assert.deepEqual(v.crops, ['loam-grain', 'heartwood-amber', 'rootsong-seeds', 'elder-bloom']);
  assert.ok(!BUYABLE.includes(v.id));
  assert.equal(techStatus(v, ctx([], 0)), 'locked', 'nothing unlocked: dim');
  assert.equal(techStatus(v, ctx([], 0, { cropsUnlocked: new Set(['loam-grain']) })), 'owned', 'one crop unlocked: lit');
  assert.deepEqual(techGates(v, ctx([], 0, { unlocked: new Set() })), [], 'no mission gate');
  assert.equal(refundBlock(v, ctx([v.id], 0)), 'Not refundable.');
  const lanes = planets.map((n) => n.lane);
  assert.deepEqual(lanes, [...lanes].sort((x, y) => x - y), 'planets left to right');
  for (let i = 2; i < planets.length; i++) assert.ok(planets[i].lane - planets[i - 2].lane >= 0.4, 'staggered rows keep space between nodes');
});

test('MACHINERY: Fertilizer Machine, Agrobots, Irrigation, one per crop level 3-5, each needing the one before', () => {
  const m = ['mc_fertilizer', 'mc_agrobots', 'mc_irrigation'].map((id) => TECH_BY_ID[id]);
  assert.deepEqual(m.map((n) => [n.name, n.cropLevel, n.req]), [['Fertilizer Machine', 3, []], ['Agrobots', 4, ['mc_fertilizer']], ['Irrigation', 5, ['mc_agrobots']]]);
  for (const n of m) { assert.ok(BUYABLE.includes(n.id) && n.price > 0 && n.div === 'machinery' && treeOf(n) === 'outpost'); }
  assert.ok(!TECH_BY_ID.mc_grobots, 'Agrobots replaced the Gro-bots ghost');
  assert.ok(TECH_BY_ID.mc_engineering.soon, 'Machine Engineering stays coming soon');
  const shut = ctx([], 99999, { unlocked: new Set() });
  assert.equal(techStatus(m[0], shut), 'locked');
  assert.equal(techGates(m[0], shut)[0].txt, 'A crop mastered to level 3');
  assert.equal(techStatus(m[0], ctx([], 99999, { unlocked: new Set(['mc_fertilizer']) })), 'ready');
});

test('every requirement names a real node and the graph has no cycles', () => {
  for (const n of TECH_NODES) for (const r of n.req) assert.ok(TECH_BY_ID[r], n.id + ' needs unknown ' + r);
  const seen = new Set(), stack = new Set();
  const visit = (id) => { if (stack.has(id)) throw new Error('cycle at ' + id); if (seen.has(id)) return; stack.add(id); TECH_BY_ID[id].req.forEach(visit); stack.delete(id); seen.add(id); };
  TECH_NODES.forEach((n) => visit(n.id));
});

test('base models: +50 / −10 budget, all 7 stats, starter all zeros', () => {
  const crafts = TECH_NODES.filter((n) => n.kind === 'craft');
  assert.equal(crafts.length, 9);
  for (const c of crafts) {
    assert.equal(c.stats.length, 7);
    assert.equal(c.stats.filter((v) => v > 0).reduce((a, b) => a + b, 0), 50, c.id);
    assert.equal(c.stats.filter((v) => v < 0).reduce((a, b) => a + b, 0), -10, c.id);
  }
  assert.deepEqual(TECH_BY_ID.pathfinder.stats, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(TECH_BY_ID.ironhoard.req, [], 'Verdance is home — no portal');
});

test('statuses: starter kit owned, roots ready, chains locked, gold short', () => {
  const c = ctx([], 1000);
  assert.equal(techStatus(TECH_BY_ID.cannon1, c), 'owned');
  assert.equal(techStatus(TECH_BY_ID.cannon2, c), 'ready');
  assert.equal(techStatus(TECH_BY_ID.cannon3, c), 'locked');
  assert.equal(techStatus(TECH_BY_ID.mk3, c), 'locked');
  assert.equal(techStatus(TECH_BY_ID.pod2, ctx(['pod1'], 1000)), 'short');
  assert.equal(techStatus(TECH_BY_ID.shp_hold, c), 'soon');
  assert.ok(readyIds(c).includes('cannon2') && !readyIds(c).includes('pod2'));
});

test('portal codes cost more the more you hold, and gate T3 / pods', () => {
  const c0 = ctx(['map3'], 99999);
  assert.equal(techPrice(TECH_BY_ID.portal_rime, c0), 1000);
  const c2 = ctx(['map3', 'portal_ochre', 'portal_kessra'], 99999);
  assert.equal(portalsOwned(c2.owned), 2);
  assert.equal(techPrice(TECH_BY_ID.portal_rime, c2), 2000);
  assert.equal(techStatus(TECH_BY_ID.portal_rime, ctx([], 99999)), 'locked', 'needs Map 3');
  assert.equal(techStatus(TECH_BY_ID.cannon3, ctx(['cannon2'], 99999)), 'locked', 'T3 needs a portal');
  assert.equal(techStatus(TECH_BY_ID.cannon3, ctx(['cannon2', 'map3', 'portal_ochre'], 99999)), 'ready');
  assert.equal(techGates(TECH_BY_ID.pod4, c2)[0].ok, false);
});

test('a planet win gates its base model when the game says so', () => {
  const c = ctx(['map3', 'portal_florael'], 99999, { hasWin: (p) => p === 'Verdance' });
  assert.equal(techStatus(TECH_BY_ID.ironhoard, c), 'ready');
  assert.equal(techStatus(TECH_BY_ID.skylark, c), 'locked');
});

test('the Gun Pod comes and goes with Pod 1; refunds respect dependents', () => {
  const owned = settleFree(new Set([...startingOwned(), 'pod1']));
  assert.ok(owned.has('gunpod'));
  owned.add('pod2');
  assert.match(refundBlock(TECH_BY_ID.pod1, { owned }), /Pod 2/);
  assert.equal(refundBlock(TECH_BY_ID.pod2, { owned }), '');
  owned.delete('pod2'); owned.delete('pod1'); settleFree(owned);
  assert.ok(!owned.has('gunpod'));
  assert.match(refundBlock(TECH_BY_ID.cannon1, { owned }), /Not refundable/);
  const p = new Set([...startingOwned(), 'map3', 'portal_ochre', 'cannon2', 'cannon3']);
  assert.match(refundBlock(TECH_BY_ID.portal_ochre, { owned: p }), /portal codes/);
  assert.equal(countOwned(p), 3);
});
