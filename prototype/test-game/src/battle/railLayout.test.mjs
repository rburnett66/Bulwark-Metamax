// [MM-task_mwd2upbd_5] The shared rail's COLUMN layout and the outpost's always-present FARM tab.
// Owner 2026-11-12: "Even if farming is disabled the Farm menu should be active to confirm my seed pod inventory. The seed
// pod inventory may need to be up to 3 tiles wide and scroll vertically … Maybe the machinery is the far left and the
// seeds are adjacent and scroll."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalogue, battleCatalogueIds, normaliseLayout, lockRule } from './catalogue.js';
import { railColumnsFit, railFit } from '../render/buildPalette.js';
import { farmRailTab, farmGateReason, farmRailLabel, farmRailIds } from '../farm/farmRail.js';
import { CROPS, cropsOf, METHODS } from '../data/farm.js';
import { FARM_RAIL_BUILDINGS, cropStructId } from '../data/farmStructures.js';
import { defaultSave } from '../save/save.js';
import { createSim, applyCommand } from '../sim/core.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('a catalogue tab may declare a column layout: its items are the groups\' ids in order, the keys follow them', () => {
  const cat = createCatalogue([
    { id: 'build', label: 'BUILD', ids: ['a', 'b'] },
    { id: 'farm', label: 'FARM', layout: { type: 'columns', groups: [{ id: 'machinery', ids: ['m1', 'm2'] }, { id: 'seeds', ids: ['s1', 's2', 's3'], scroll: true, maxCols: 2 }] } },
  ]);
  assert.equal(cat.layoutOf('build'), null, 'a tab without a layout is the plain rail');
  const lay = cat.layoutOf('farm');
  assert.equal(lay.type, 'columns');
  assert.deepEqual(lay.groups.map((g) => [g.id, [...g.ids], g.scroll, g.maxCols]), [['machinery', ['m1', 'm2'], false, 1], ['seeds', ['s1', 's2', 's3'], true, 2]]);
  assert.deepEqual([...cat.ids], ['a', 'b', 'm1', 'm2', 's1', 's2', 's3']);
  cat.setTab('farm');
  assert.deepEqual([...cat.shown()], ['m1', 'm2', 's1', 's2', 's3'], 'keys 1, 2 … pick the left column first, then the seeds');
  assert.equal(cat.layoutOf(), lay, 'the visible tab by default');
  assert.equal(normaliseLayout({ type: 'grid' }), null, 'an unknown layout falls back to the plain rail');
});

test('every battle (a plain id list) has one tab and no layout: the rail is drawn as before', () => {
  const cat = createCatalogue();
  assert.deepEqual([...cat.ids], [...battleCatalogueIds()]);
  assert.equal(cat.tabs.length, 1);
  assert.equal(cat.layoutOf(), null);
  // the HUD adds the column block only for a tab with a layout, and the plain row path is the one before
  const hud = src('../render/hud.js');
  assert.match(hud, /for \(const t of tabs\) \{\s*if \(!t\.layout\) continue;/, 'no layout, no column element');
  assert.match(hud, /if \(!on && !Object\.keys\(railCols\)\.length\) return;/, 'showCols leaves a rail without layouts alone');
  assert.match(hud, /applyRailFit\(palette, railFit\(avail, btns, chrome, view\.innerWidth\)\);/, 'the plain rail still sizes with railFit');
});

test('railColumnsFit: machinery fills the left column at the plain rail\'s size; the seeds widen to 2 columns, then scroll', () => {
  // 844 × 390 landscape: ~328 px under the top bar, ~35 px of chrome (padding + tabs)
  const f4 = railColumnsFit(328, [{ n: 4 }, { n: 4, scroll: true, maxCols: 2 }], 35, 844);
  assert.equal(f4.h, railFit(328, 4, 35, 844).h, 'the machinery column is sized as a 4-item plain rail');
  assert.deepEqual(f4.groups.map((g) => [g.cols, g.overflow]), [[1, false], [1, false]], '4 seeds fit one column');
  const f7 = railColumnsFit(328, [{ n: 4 }, { n: 7, scroll: true, maxCols: 2 }], 35, 844);
  assert.deepEqual(f7.groups.map((g) => [g.cols, g.overflow]), [[1, false], [2, false]], '7 seeds: two columns, the rail 3 tiles wide');
  const f20 = railColumnsFit(328, [{ n: 4 }, { n: 20, scroll: true, maxCols: 2 }], 35, 844);
  assert.equal(f20.groups[1].cols, 2, 'never wider than maxCols');
  assert.equal(f20.groups[1].overflow, true, 'and it scrolls');
  assert.ok(f20.groups[1].height <= 328 - 35, 'its viewport stays inside the rail\'s height');
  // 1280 × 720: the big buttons, every seed of a planet in one column
  const big = railColumnsFit(658, [{ n: 4 }, { n: 4, scroll: true, maxCols: 2 }], 35, 1280);
  assert.equal(big.h, 80);
  assert.deepEqual(big.groups.map((g) => g.cols), [1, 1]);
});

test('the FARM tab: machinery (methods + bought farm buildings) far left, every crop of the planet + held crops scrolling beside it', () => {
  const s = defaultSave();
  s.pods = { 'sunsalt': 6 };   // a crop of another planet the player holds pods of
  const tab = farmRailTab(s, 'ground');
  const [mach, seeds] = tab.layout.groups;
  assert.equal(mach.id, 'machinery');
  assert.deepEqual(mach.ids, [...METHODS.map((m) => 'FARM-' + m.id), ...FARM_RAIL_BUILDINGS.map((k) => 'FARM-' + k)]);
  assert.deepEqual(seeds, { id: 'seeds', ids: [...cropsOf('ground').map((c) => cropStructId(c.id)), cropStructId('sunsalt')], scroll: true, maxCols: 2 });
  assert.deepEqual([...mach.ids, ...seeds.ids], farmRailIds(s, 'ground'), 'the same items, in the same order, as before');
  // every planet: its own crops (the data's crop list, src/data/farm.js CROPS) are all on its FARM tab
  for (const key of new Set(CROPS.map((c) => c.planetKey))) {
    const ids = farmRailTab(defaultSave(), key).layout.groups[1].ids;
    assert.deepEqual(ids, cropsOf(key).map((c) => cropStructId(c.id)), key);
  }
});

test('before farming opens: every FARM item is padlocked with how farming opens, the placement refused, the pods still counted', () => {
  const s = defaultSave();
  s.outposts = { ground: { pads: { r1: { kind: 'rig', tier: 1 } } } };
  s.pods = { 'loam-grain': 8 };
  const ship = 'The Iron Harvest';
  assert.match(farmGateReason(s, 'ground', ship), /^Farming opens with a Mining Rig Mk II \(its tech comes with outpost contract 2\) — then see the Factor at the Trade Station aboard The Iron Harvest$/);
  s.outposts.ground.pads.r1.tier = 2;   // the gate opens: the contract waits at the Factor's desk
  assert.match(farmGateReason(s, 'ground', ship), /accept the farming contract from the Factor at the Trade Station aboard The Iron Harvest/);
  assert.match(farmGateReason(s, 'ground'), /aboard the Verdance capital ship/, 'no catalogue: a generic ship');
  s.farmContracts = { ground: { step: 1, state: 'active' } };
  assert.equal(farmGateReason(s, 'ground', ship), null, 'the farm is the player\'s: no gate');
  assert.match(farmGateReason(defaultSave(), 'water'), /^Farming is not open on/, 'a planet without a farming contract yet');
  // the lock is a catalogue lock: shown by the rail, refused by the sim (lockRule)
  const tab = farmRailTab(defaultSave(), 'ground'), ids = tab.layout.groups.flatMap((g) => g.ids), why = farmGateReason(defaultSave(), 'ground');
  const cat = createCatalogue([{ id: 'build', label: 'BUILD', ids: ['OUT-power'] }, tab], Object.fromEntries(ids.map((id) => [id, why])));
  assert.ok(ids.every((id) => cat.isLocked(id) === why));
  const sim = createSim(7, {});
  sim.economy.money = 1e6; sim.placementRules = [lockRule(cat)];
  assert.equal(applyCommand(sim, { type: 'place', structId: 'FARM-traditional', cell: { x: 20, y: 6 } }).reason, why);
  // the pods held show on a crop with no farm (railLabel is not gated on the farm)
  assert.equal(farmRailLabel(cropStructId('loam-grain'), { 'loam-grain': 8 }).text, '8 pods');
});
