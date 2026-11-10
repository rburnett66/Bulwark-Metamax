// [MM-story_mwabgw7m_h] Raids and the farm (Farming-Design §10; tech plan Farming §2.3 F5): the outpost's raids report
// the cells their raiders stood on; those cells trample the growing plots at the raid's moment; a breach costs the
// farm store Breach_Silo_Loss. The battle sim (src/sim/) is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { referenceOutpost, confirmOnline, advance, powerGrids } from '../outpost/model.js';
import { outpostMapFromForge } from '../outpost/outpostMap.js';
import { DRAFT_LAYOUT as draft } from '../outpost/draftLayout.js';
import { runRaid, createRaid, makeRaidHook, RAID_DT } from '../outpost/raid.js';
import { startProbe, probeCells } from '../outpost/view/visitProbe.js';
import { FARM, yieldOf } from '../data/farm.js';
import { windowSec } from './grow.js';
import { trample, applyFarmLoss, plotState, harvest } from './model.js';
import '../data/factions.js';

const T0 = Date.UTC(2026, 10, 10, 8, 0, 0), MIN = 60_000, HOUR = 3_600_000;
const forgeMap = outpostMapFromForge(JSON.parse(fs.readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');

/** A plot straight into the outpost's farm (placement rules are model.test's): Loam Grain at `progress`, or Fruited
 *  since `ripeAt`. */
function withPlot(o, id, x, y, { progress = 0, ripeAt = null, yieldShare = 1, crop = 'loam-grain' } = {}) {
  const out = structuredClone(o);
  out.farm ||= { plots: {}, buildings: {}, next: 1 };
  out.farm.plots[id] = { id, x, y, w: 2, h: 2, method: 'traditional', prepDone: o.t, crop, level: 1, plantedAt: o.t,
    progress: ripeAt != null ? 1 : progress, ripeAt, cycle: 1, yieldShare };
  out.farm.next = Math.max(out.farm.next, +id.slice(1) + 1);
  return out;
}
const base = () => referenceOutpost('ground', { seed: 7, map: draft, now: T0 });
const st = (o, id, t = o.t) => plotState(o, o.farm.plots[id], t);

test('a raider sets a growing plot back one stage; Planted stays Planted', () => {
  let o = base();
  o = withPlot(o, 'p1', 0, 0, { progress: (FARM.Plant_At + 1) / 2 });           // plant
  o = withPlot(o, 'p2', 4, 0, { progress: (FARM.Sprout_At + FARM.Plant_At) / 2 }); // sprout
  o = withPlot(o, 'p3', 8, 0, { progress: FARM.Sprout_At / 2 });                 // planted
  assert.deepEqual(['p1', 'p2', 'p3'].map((id) => st(o, id)), ['plant', 'sprout', 'planted']);
  const r = trample(o, [[1, 1], [4, 0], [9, 1]]);
  assert.deepEqual(r.trampled, [{ plot: 'p1', from: 'plant', to: 'sprout' }, { plot: 'p2', from: 'sprout', to: 'planted' }]);
  assert.equal(r.outpost.farm.plots.p1.progress, FARM.Sprout_At, 'to the start of the Sprout band');
  assert.equal(r.outpost.farm.plots.p2.progress, 0, 'to the start of the Planted band');
  assert.equal(r.outpost.farm.plots.p3.progress, o.farm.plots.p3.progress, 'Planted has no stage to lose');
  assert.equal(o.farm.plots.p1.progress, (FARM.Plant_At + 1) / 2, 'the outpost passed in is unchanged');
  // one set-back per plot per raid, however many of its cells were crossed
  const many = trample(o, [[0, 0], [1, 0], [0, 1], [1, 1]]);
  assert.equal(many.outpost.farm.plots.p1.progress, FARM.Sprout_At);
  // nothing is killed: a trampled plant still ripens
  assert.ok(r.outpost.farm.plots.p1.crop && r.outpost.farm.plots.p2.crop);
});

test('a trampled Fruited plot keeps Trample_Fruited_Yield of its yield, once', () => {
  let o = withPlot(base(), 'p1', 0, 0, { ripeAt: T0 - MIN });
  assert.equal(st(o, 'p1'), 'fruited');
  const once = trample(o, [[0, 0]]);
  assert.deepEqual(once.trampled, [{ plot: 'p1', from: 'fruited', to: 'fruited', yieldShare: FARM.Trample_Fruited_Yield }]);
  assert.equal(once.outpost.farm.plots.p1.yieldShare, FARM.Trample_Fruited_Yield);
  const twice = trample(once.outpost, [[1, 1]]);
  assert.deepEqual(twice.trampled, [], 'trampling twice takes nothing more');
  assert.equal(twice.outpost.farm.plots.p1.yieldShare, FARM.Trample_Fruited_Yield);
  // the harvest pays the kept share, and the planted pods are never lost
  const full = harvest(o, 'p1', { map: draft, held: 0 }), half = harvest(twice.outpost, 'p1', { map: draft, held: 0 });
  assert.equal(full.units, yieldOf('loam-grain', 'traditional', 1));
  assert.equal(half.units, Math.max(1, Math.floor(full.units * FARM.Trample_Fruited_Yield)));
  assert.deepEqual(half.pods, full.pods);
});

test('Dead, prepping, prepped and harvested plots are untouched; cells off every plot do nothing', () => {
  let o = withPlot(base(), 'p1', 0, 0, { ripeAt: T0 - windowSec({ crop: 'loam-grain', method: 'traditional' }) * 1000 - MIN });
  assert.equal(st(o, 'p1'), 'dead');
  o = withPlot(o, 'p2', 4, 0, { progress: 0.5 });
  Object.assign(o.farm.plots.p2, { crop: null, prepDone: null });                   // harvested
  o = withPlot(o, 'p3', 8, 0, { progress: 0.5 });
  Object.assign(o.farm.plots.p3, { crop: null, prepDone: T0 + HOUR });              // prepping
  o = withPlot(o, 'p4', 12, 0, { progress: 0.5 });
  Object.assign(o.farm.plots.p4, { crop: null, prepDone: T0 - 1 });                 // prepped
  assert.deepEqual(['p1', 'p2', 'p3', 'p4'].map((id) => st(o, id)), ['dead', 'harvested', 'prepping', 'prepped']);
  const r = trample(o, [[0, 0], [4, 0], [8, 0], [12, 0]]);
  assert.deepEqual(r.trampled, []);
  assert.equal(r.outpost, o, 'nothing changed: the same outpost back');
  const g = withPlot(base(), 'p1', 6, 6, { progress: 0.5 });
  assert.deepEqual(trample(g, [[5, 5], [8, 6], [6, 8], [20, 20]]).trampled, [], 'cells beside the plot miss it');
  assert.deepEqual(trample(g, []).trampled, []);
  assert.deepEqual(trample(base(), [[6, 6]]).trampled, [], 'an outpost without a farm');
});

test('trampling reads the stage at the raid moment, not the outpost clock', () => {
  // ripe at T0 + 1 h: at T0 it is still a plant (set back), an hour later it is Fruited (yield kept at the share)
  const o = withPlot(base(), 'p1', 0, 0, { ripeAt: T0 + HOUR });
  o.farm.plots.p1.progress = (FARM.Plant_At + 1) / 2; o.farm.plots.p1.ripeAt = null;
  assert.equal(trample(o, [[0, 0]], T0).trampled[0].to, 'sprout');
  const ripe = withPlot(base(), 'p1', 0, 0, { ripeAt: T0 + HOUR });
  assert.equal(trample(ripe, [[0, 0]], T0 + 2 * HOUR).trampled[0].yieldShare, FARM.Trample_Fruited_Yield);
});

test('the advance report\'s raid entry carries trampled and farmLoss: a breach vs a held raid', () => {
  let o = confirmOnline(referenceOutpost('ground', { seed: 7, map: draft, now: T0 }), draft, T0).outpost;
  o = withPlot(o, 'p1', 0, 0, { progress: (FARM.Plant_At + 1) / 2 });
  o = withPlot(o, 'p2', 4, 0, { ripeAt: T0 - MIN });
  const raidAt = o.firstRaidAt;
  const hook = (result) => (x, raid) => {
    assert.equal(raid.at, raidAt);
    return { result, defenses: [], cells: [[0, 0], [5, 1], [30, 30]] };
  };
  const breach = advance(o, raidAt + MIN, { map: draft, raid: hook('breach') });
  const e = breach.report.raids[0];
  assert.equal(e.result, 'breach');
  assert.equal(e.farmLoss, FARM.Breach_Silo_Loss);
  assert.equal(e.farmLoss, 0.25);
  assert.deepEqual(e.trampled, [{ plot: 'p1', from: 'plant', to: 'sprout' },
    { plot: 'p2', from: 'fruited', to: 'fruited', yieldShare: FARM.Trample_Fruited_Yield }]);
  assert.equal(breach.outpost.farm.plots.p2.yieldShare, FARM.Trample_Fruited_Yield);
  assert.deepEqual(breach.outpost.raids.log.at(-1).trampled, e.trampled, 'the raid log keeps it');
  // set back at the raid's moment, and growing again from there on the one clock
  const p1 = breach.outpost.farm.plots.p1;
  assert.ok(p1.progress > FARM.Sprout_At && p1.progress < FARM.Plant_At, 'regrew a minute from the Sprout band start');
  const held = advance(o, raidAt + MIN, { map: draft, raid: hook('held') }).report.raids[0];
  assert.equal(held.farmLoss, 0, 'a held raid takes nothing from the store');
  assert.equal(held.trampled.length, 2, 'raiders trample whether the raid holds or not');
  // an outpost without a farm: the entry is as before
  const plain = confirmOnline(referenceOutpost('ground', { seed: 7, map: draft, now: T0 }), draft, T0).outpost;
  const pe = advance(plain, raidAt + MIN, { map: draft, raid: hook('breach') }).report.raids[0];
  assert.equal(pe.trampled, undefined);
  assert.equal(pe.farmLoss, undefined);
});

test('applyFarmLoss: the caller cuts what the farm store holds by the entry\'s share', () => {
  assert.deepEqual(applyFarmLoss(40), { held: 30, lost: 10 });
  assert.deepEqual(applyFarmLoss(40, 0), { held: 40, lost: 0 });
  assert.deepEqual(applyFarmLoss({ 'loam-grain': 20, 'helium-4': 8 }, 0.25), { held: { 'loam-grain': 15, 'helium-4': 6 }, lost: { 'loam-grain': 5, 'helium-4': 2 } });
  assert.deepEqual(applyFarmLoss(undefined), { held: 0, lost: 0 });
});

test('a raid on the battle sim reports its raider cells, the same every run (same seed → same cells)', () => {
  const o = referenceOutpost('ground', { seed: 11, map: forgeMap, now: T0 });
  const raid = { window: 3, at: T0, powered: powerGrids(o, forgeMap).powered };
  const opts = { map: forgeMap, units: ['GND-Troops', 'GND-Tanks'] };
  const a = runRaid(o, raid, opts), b = runRaid(o, raid, opts);
  assert.ok(a.cells.length > 5, 'the raiders walked');
  assert.deepEqual(b.cells, a.cells);
  const keys = a.cells.map(([x, y]) => y * forgeMap.width + x);
  assert.deepEqual(keys, [...new Set(keys)].sort((p, q) => p - q), 'each cell once, in row order');
  for (const [x, y] of a.cells) assert.ok(x >= 0 && y >= 0 && x < forgeMap.width && y < forgeMap.height);
  // stepped live then finished headless: the same cells; cells() mid-raid is a prefix set of the end's
  const live = createRaid(o, raid, opts);
  for (let i = 0; i < 300; i++) live.step(RAID_DT);
  const mid = live.cells();
  const end = live.finish();
  assert.deepEqual(end.cells, a.cells);
  const all = new Set(end.cells.map(String));
  assert.ok(mid.every((c) => all.has(String(c))));
});

test('a plot on the raiders\' way is trampled by the real raid through advance(); one off it is not', () => {
  let o = confirmOnline(referenceOutpost('ground', { seed: 11, map: forgeMap, now: T0 }), forgeMap, T0).outpost;
  const at = o.firstRaidAt;
  // where the scripted first raid will walk (the farm is not on the raid's board: plots never block paths)
  const seen = runRaid(o, { at, first: true, powered: powerGrids(o, forgeMap).powered }, { map: forgeMap });
  const on = seen.cells[Math.floor(seen.cells.length / 2)];
  const stood = new Set(seen.cells.map(String));
  let off = null;
  for (let y = 0; y + 1 < forgeMap.height && !off; y++) for (let x = 0; x + 1 < forgeMap.width && !off; x++) {
    if (![[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].some((c) => stood.has(String(c)))) off = [x, y];
  }
  o = withPlot(o, 'p1', on[0], on[1], { progress: (FARM.Plant_At + 1) / 2 });
  o = withPlot(o, 'p2', off[0], off[1], { progress: (FARM.Plant_At + 1) / 2 });
  const r = advance(o, at + MIN, { map: forgeMap, raid: makeRaidHook({ map: forgeMap, step: 1 }) });
  const e = r.report.raids[0];
  assert.deepEqual(e.trampled.map((t) => t.plot), ['p1']);
  assert.equal(st(r.outpost, 'p1', at + MIN), 'sprout');
  assert.equal(st(r.outpost, 'p2', at + MIN), 'plant');
  assert.equal(e.farmLoss, e.result === 'breach' ? 0.25 : 0);
});

test('a visit probe reports its raider cells the same way', () => {
  const o = confirmOnline(referenceOutpost('ground', { seed: 11, map: forgeMap, now: T0 }), forgeMap, T0).outpost;
  const mk = () => startProbe(o, 0, { map: forgeMap, powered: [...powerGrids(o, forgeMap).powered] });
  const a = mk(), b = mk();
  assert.deepEqual(probeCells(a), []);
  const end = a.finish();
  b.finish();
  assert.ok(probeCells(a).length > 0);
  assert.deepEqual(probeCells(a), end.cells);
  assert.deepEqual(probeCells(b), probeCells(a), 'same seed, same cells');
  assert.deepEqual(probeCells(null), []);
});

test('the battle sim is untouched by this story (src/sim/ unchanged against feat/farm-model)', (t) => {
  const root = new URL('../../../../', import.meta.url);
  let out;
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'feat/farm-model'], { cwd: root, stdio: 'pipe' });
    out = execFileSync('git', ['diff', '--stat', 'feat/farm-model', '--', 'prototype/test-game/src/sim'], { cwd: root, encoding: 'utf8' });
  } catch { t.skip('no feat/farm-model ref in this clone'); return; }
  assert.equal(out.trim(), '');
  // and the farm's raid code never reaches into the sim or a clock
  const src = fs.readFileSync(new URL('./model.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/from '\.\.\/sim\//.test(src) && !/Date\.now|Math\.random/.test(src));
});
