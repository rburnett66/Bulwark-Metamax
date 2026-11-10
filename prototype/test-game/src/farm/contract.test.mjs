// [MM-story_mwabgpsa_e] The farming gate (Rig Mk II) and Verdance F1, run through the Mission Log like the outpost contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../save/save.js';
import { syncMissions, flowCtx, collect } from '../save/missionFlow.js';
import { refreshSaveObjectives } from '../save/missions.js';
import { referenceOutpost, advance } from '../outpost/model.js';
import { DRAFT_LAYOUT as map } from '../outpost/draftLayout.js';
import { FARM, growSec } from '../data/farm.js';
import { podCount } from './pods.js';
import { placePlot, plant, harvest, plotState, occupied } from './model.js';
import {
  farmingOpen, farmOffer, acceptFarmContract, declineFarmContract, hasFarm, farmUnlocks, measureFarmPlanted,
  measureCropDelivered, measureMethodsGrowing, recordDelivery, farmCard, farmMissionId, farmQuestLine,
} from './contract.js';
import { farmButtonModel } from '../menu/farmButton.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const T0 = Date.UTC(2026, 10, 10, 9, 0, 0), MIN = 60_000;
/** A save with the Verdance outpost (reference kit), its ship in orbit, and the rig at `rigTier`. */
function verdance(rigTier = 2) {
  const s = defaultSave();
  s.carry = { gold: 50_000, structures: [] }; s.goldBank = 50_000;
  s.capitalShips = { Verdance: { arrived: true } };
  const o = referenceOutpost('ground', { seed: 5, map, now: T0 });
  for (const b of Object.values(o.pads)) if (b.kind === 'rig') b.tier = rigTier;
  s.outposts = { ground: o };
  s.outpostContracts = { ground: { step: 3, state: 'complete', since: T0 } };
  return s;
}
const ctx = (s) => flowCtx(s, { allOpen: true, now: T0 });
const free = (o, n) => {
  const t = occupied(o, map), out = [];
  for (let y = 0; y + 2 <= map.height && out.length < n; y += 2) for (let x = 0; x + 2 <= map.width && out.length < n; x += 2) {
    const r = { x, y, w: 2, h: 2 }, g = { x: x - 1, y: y - 1, w: 4, h: 4 };   // the 1-cell walkway between plots
    if (!t.some((q) => g.x < q.x + q.w && q.x < g.x + g.w && g.y < q.y + q.h && q.y < g.y + g.h)) { out.push(r); t.push(r); }
  }
  return out;
};

test('the gate: farming opens on a planet when its outpost has a finished Rig Mk II (owner, D41)', () => {
  assert.equal(farmingOpen(verdance(1), 'ground'), false);
  assert.equal(farmingOpen(verdance(2), 'ground'), true);
  assert.equal(farmingOpen(defaultSave(), 'ground'), false, 'no outpost, no farming');
  const s = verdance(2); s.capitalShips = {};
  assert.equal(farmOffer(s, 'ground'), null, 'the offer waits for the ship in orbit');
  assert.equal(farmOffer(verdance(1), 'ground'), null);
  assert.equal(farmOffer(verdance(2), 'ground').title, 'Bread for the Regiments');
});

test('F1 is a Mission Log mission like the outpost contracts: logged aboard Verdance\'s ship once the gate opens', () => {
  const def = CATALOG.missions.find((m) => m.id === farmMissionId('ground', 1));
  assert.equal(def.type, 'farm');
  assert.equal(def.questLine, farmQuestLine('ground'));
  assert.equal(def.collectAt, CATALOG.capitalShips.Verdance.ship);
  assert.deepEqual(def.complete.map((c) => c.cond), ['farm_plots_planted', 'crop_delivered', 'farm_methods_growing']);
  const shut = verdance(1);
  assert.ok(!syncMissions(shut, CATALOG, ctx(shut)).some((m) => m.id === 'FC-VER-1'), 'no Rig Mk II: not logged');
  const s = verdance(2);
  assert.ok(syncMissions(s, CATALOG, ctx(s)).some((m) => m.id === 'FC-VER-1'));
});

test('ACCEPT grants the Farmhouse beside the hub and the Pod Crate; twice changes nothing; LATER keeps the offer', () => {
  const s = verdance(2);
  const later = verdance(2);
  declineFarmContract(later, 'ground', { now: T0 });
  assert.ok(farmOffer(later, 'ground'), 'declined: still on offer');
  const r = acceptFarmContract(s, 'ground', { map, now: T0 });
  assert.ok(r.farmhouse, r.error);
  const fh = s.outposts.ground.farm.buildings[r.farmhouse];
  assert.equal(fh.kind, 'farmhouse');
  assert.equal(podCount(s, 'loam-grain', 1), FARM.Pod_Crate, '12 Common Loam Grain pods');
  assert.ok(hasFarm(s, 'ground'));
  assert.equal(farmOffer(s, 'ground'), null);
  assert.match(acceptFarmContract(s, 'ground', { map, now: T0 }).error, /already/);
  assert.equal(podCount(s, 'loam-grain', 1), FARM.Pod_Crate, 'no second crate');
  assert.match(acceptFarmContract(verdance(1), 'ground', { map, now: T0 }).error, /Rig Mk II/);
});

test('F1\'s unlocks apply on ACCEPT: Irrigated (its step 3 needs two methods), SEED PODS, Sprinklers', () => {
  const s = verdance(2);
  assert.deepEqual(farmUnlocks(s, 'ground').methods, ['traditional']);
  acceptFarmContract(s, 'ground', { map, now: T0 });
  const u = farmUnlocks(s, 'ground');
  assert.deepEqual(u.methods, ['traditional', 'irrigated']);
  assert.ok(u.seedPods);
  assert.ok(u.techs.has('sprinklers'));
});

test('the three steps measure the farm: plots planted, crop delivered, methods growing at once', () => {
  const s = verdance(2);
  acceptFarmContract(s, 'ground', { map, now: T0 });
  let o = s.outposts.ground;
  const spots = free(o, 4);
  for (const [i, r] of spots.entries()) o = placePlot(o, { ...r, method: i < 3 ? 'traditional' : 'irrigated' }, { map, now: T0, methods: farmUnlocks(s, 'ground').methods }).outpost;
  o = advance(o, T0 + FARM.Prep_Sec * 1000, { map }).outpost;
  assert.equal(measureFarmPlanted({ outposts: { ground: o } }, 'ground'), 0, 'prepped is not planted');
  for (const id of Object.keys(o.farm.plots)) o = plant(o, id, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 4 }).outpost;
  s.outposts.ground = o;
  assert.equal(measureFarmPlanted(s, 'ground'), 3, 'three Traditional plots (the Irrigated one is not counted)');
  assert.equal(measureMethodsGrowing(s, 'ground'), 2);
  assert.equal(measureCropDelivered(s, 'loam-grain'), 0);
  recordDelivery(s, 'ground', 'loam-grain', 16); recordDelivery(s, 'ground', 'loam-grain', 24);
  assert.equal(measureCropDelivered(s, 'loam-grain'), 40);
  assert.equal(recordDelivery(s, 'ground', 'nope', 5), 0);
});

test('F1 runs end to end through the Mission Log: logged, complete, collected for its gold and loyalty', () => {
  const s = verdance(2);
  syncMissions(s, CATALOG, ctx(s));
  acceptFarmContract(s, 'ground', { map, now: T0 });
  let o = s.outposts.ground;
  const spots = free(o, 4);
  for (const [i, r] of spots.entries()) o = placePlot(o, { ...r, method: i < 3 ? 'traditional' : 'irrigated' }, { map, now: T0, methods: ['traditional', 'irrigated'] }).outpost;
  o = advance(o, T0 + FARM.Prep_Sec * 1000, { map }).outpost;
  for (const id of Object.keys(o.farm.plots)) o = plant(o, id, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 4 }).outpost;
  s.outposts.ground = o;
  refreshSaveObjectives(s, ctx(s));   // as the outpost view does after each change: methods growing latches while true
  o = advance(o, o.t + growSec('loam-grain') * 1000 + MIN, { map }).outpost;
  const h = harvest(o, Object.keys(o.farm.plots)[0], { map, held: 0 });
  assert.equal(h.kind, 'crop');
  s.outposts.ground = h.outpost;
  recordDelivery(s, 'ground', 'loam-grain', 40);
  refreshSaveObjectives(s, ctx(s));
  const m = s.missions.find((x) => x.id === 'FC-VER-1');
  assert.ok(m, 'logged');
  const gold = s.carry.gold;
  assert.ok(collect(s, 'FC-VER-1', CATALOG, ctx(s)), 'collected');
  assert.equal(s.carry.gold, gold + 1500);
  assert.equal(s.farmContracts.ground.state, 'complete');
});

test('the FARM button: locked until a farming contract is accepted; then its status line reads the farm', () => {
  const s = verdance(2);
  const locked = farmButtonModel(s, 'ground', T0, map);
  assert.ok(locked.locked);
  assert.match(locked.hint, /Rig to Mk II/);
  acceptFarmContract(s, 'ground', { map, now: T0 });
  const m = farmButtonModel(s, 'ground', T0, map);
  assert.equal(m.locked, false);
  assert.equal(m.planet, 'ground');
  assert.equal(m.hint, 'ready to plant');
  let o = s.outposts.ground;
  const [r] = free(o, 1);
  o = placePlot(o, r, { map, now: T0 }).outpost;
  o = advance(o, T0 + FARM.Prep_Sec * 1000, { map }).outpost;
  o = plant(o, Object.keys(o.farm.plots)[0], { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 4 }).outpost;
  s.outposts.ground = o;
  const ripe = farmButtonModel(s, 'ground', o.t + growSec('loam-grain') * 1000 + MIN, map);
  assert.match(ripe.hint, /1 plot fruited/);
  assert.ok(ripe.dot);
  const dead = farmButtonModel(s, 'ground', o.t + 3 * growSec('loam-grain') * 1000, map);
  assert.match(dead.hint, /1 plant dead/);
  assert.equal(plotState(o, Object.values(o.farm.plots)[0]), 'planted', 'the button reads a copy; the save is unchanged');
});

test('the contract card names the grants, the three steps and the pay', () => {
  const c = farmCard('ground', "Halbrecht's Oath");
  assert.match(c.kicker, /FARMING CONTRACT/);
  assert.match(c.task, /Farmhouse/);
  assert.match(c.terms, /3 Traditional plots[\s\S]*40 Loam Grain[\s\S]*2 methods[\s\S]*1,500 gold/);
});
