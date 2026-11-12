// The outpost view's open / advance / report flow and its actions, against a save (story O6) [MM-story_mw5oeer7_n].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, repairAllCost, onlineIssues } from './session.js';
import { raidHookFor } from './raidSeam.js';
import { awayReportModel, awayFor } from './awayReport.js';
import { acceptOutpostContract } from '../contract.js';
import { referenceOutpost } from '../model.js';
import { defaultSave } from '../../save/save.js';
import { missionStatus } from '../../save/missions.js';
import { map, catalog, memoryStore, T0, MIN, HOUR, freeSpot } from './fixtures.mjs';

function fresh(gold = 10_000) {
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  s.carry = { gold, structures: [] }; s.goldBank = gold;
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'test' });
  s.outposts.ground = referenceOutpost('ground', { seed: s.outposts.ground.seed, map, now: T0 });   // O16: the contract grants only the hub; these tests start from the former kit
  return s;
}
const flowOpts = { allOpen: true };

test('the raid seam runs raids on the battle sim (O7): a hook for a map, none without one', () => {
  assert.equal(typeof raidHookFor(map, 1), 'function');
  assert.equal(raidHookFor(null, 1), undefined);
});

test('opening a fresh kit advances nothing, shows no report, and the outpost waits to go online', () => {
  const store = memoryStore(fresh());
  const v = createSession({ store, planet: 'ground', map, catalog, flowOpts });
  const r = v.open(T0);   // O16: a powered rig now mines before the outpost is online, so a later open would report it
  assert.equal(r.outpost.online, false);
  assert.equal(r.away.show, false);
  assert.deepEqual(onlineIssues(r.outpost, map), []);
});

test('GO ONLINE, time away, open: the save is advanced to now, the report lists the extraction, the mission sees online', () => {
  const store = memoryStore(fresh());
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null, flowOpts });
  v.open(T0);
  assert.equal(v.act({ type: 'online' }, T0).ok, true);
  assert.equal(store.load().outposts.ground.online, true);
  // two hours away (no raid hook passed: the first raid is scripted at +10 min and counts as held)
  const r = v.open(T0 + 2 * HOUR);
  assert.equal(r.report.to, T0 + 2 * HOUR);
  assert.equal(store.load().outposts.ground.t, T0 + 2 * HOUR, 'the advance is saved');
  assert.equal(r.away.show, true);
  assert.deepEqual(r.away.extracted.map((x) => [x.id, x.units]), [['iron', 360]]);
  assert.equal(r.away.raids.length >= 1, true, 'the scripted first raid came');
  assert.equal(r.away.raids[0].result, 'held');
  const m = () => store.load().missions.find((x) => x.id === 'OC-VER-1');
  assert.ok(m(), 'contract 1 is in the Mission Log');
  assert.equal(m().objectives[0].have, 1, 'online: settleOutpost ran');
  assert.ok(m().objectives[2].have >= 1, 'the raid held is counted');
  // selling the 360 iron delivers contract 1's 300: the mission is ready to collect aboard
  assert.equal(v.act({ type: 'sell' }, T0 + 2 * HOUR).ok, true);
  assert.ok(m().objectives[1].have >= 300);
  assert.equal(missionStatus(m(), store.load()), 'ready');
});

test('SELL banks the gold, empties whole loads, records the ore sold, and returns one entry per load', () => {
  const store = memoryStore(fresh(1000));
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null, flowOpts });
  v.act({ type: 'online' }, T0);
  const res = v.act({ type: 'sell' }, T0 + 20 * MIN);   // 60 iron = 4 loads of 15 at 4 gold
  assert.equal(res.ok, true);
  assert.equal(res.loads.length, 4);
  assert.equal(res.earned, 4 * 15 * 4);
  assert.equal(res.gold, 1000 + 240);
  const s = store.load();
  assert.equal(s.carry.gold, 1240);
  assert.equal(s.goldBank, 1240);
  assert.equal(Math.round(s.outposts.ground.sold.iron), 60);
  assert.equal(v.act({ type: 'sell' }, T0 + 20 * MIN).ok, false, 'nothing left to sell');
});

test('building costs gold through the model; a refusal changes nothing and says why', () => {
  const store = memoryStore(fresh(5000));
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null, flowOpts });
  v.act({ type: 'online' }, T0);
  const empty = { id: 'f1', at: freeSpot(store.load().outposts.ground, 'resourceBay') };   // S2c.2: a free spot, no map pads
  const ok = v.act({ type: 'place', pad: empty.id, at: empty.at, kind: 'harvesterBay' }, T0 + MIN);
  assert.equal(ok.ok, true);
  assert.equal(store.load().carry.gold, 2500);
  assert.equal(store.load().outposts.ground.building.length, 1);
  const no = v.act({ type: 'place', pad: empty.id, at: empty.at, kind: 'harvesterBay' }, T0 + MIN);
  assert.equal(no.ok, false);
  assert.match(no.error, /taken|costs/);
  assert.equal(store.load().carry.gold, 2500);
  // the deep seam needs Deep Drilling I (contract 1's unlock)
  const rig = Object.keys(store.load().outposts.ground.pads).find((id) => store.load().outposts.ground.pads[id].kind === 'rig');
  assert.match(v.act({ type: 'deep', pad: rig, on: true }, T0 + MIN).error, /Deep Drilling/);
});

test('a raid hook (the O7 seam) decides each raid; worn defenses show REPAIR, and repairing them all costs gold', () => {
  const store = memoryStore(fresh(20_000));
  const wear = (o) => ({ result: 'held', defenses: o.defenses.map((d) => ({ id: d.id, hp: d.hp * 0.5 })) });
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: wear, flowOpts });
  v.act({ type: 'online' }, T0);
  const r = v.open(T0 + 30 * MIN);   // the scripted first raid at +10 min
  assert.equal(r.away.raids.length, 1);
  assert.ok(r.away.wear > 0);
  const cost = repairAllCost(store.load().outposts.ground);
  assert.ok(cost > 0);
  const res = v.act({ type: 'repairAll' }, T0 + 31 * MIN);
  assert.equal(res.ok, true);
  assert.equal(res.cost, cost);
  assert.equal(repairAllCost(store.load().outposts.ground), 0);
});

test('the live tick saves only when a raid or a build lands; otherwise it advances a copy', () => {
  const store = memoryStore(fresh());
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null, flowOpts });
  v.act({ type: 'online' }, T0);
  const a = v.live(T0 + 5 * MIN);
  assert.equal(a.saved, false);
  assert.equal(store.load().outposts.ground.t, T0);
  assert.ok(a.outpost.storage[Object.keys(a.outpost.storage)[0]].iron > 14);
  const b = v.live(T0 + 11 * MIN);   // past the first raid
  assert.equal(b.saved, true);
  assert.equal(store.load().outposts.ground.raids.log.length, 1);
});

test('the away report: words for the time, breach losses, nothing to show for a short quiet gap', () => {
  assert.equal(awayFor(45 * MIN), '45 min');
  assert.equal(awayFor(3 * HOUR + 12 * MIN), '3 h 12 min');
  assert.equal(awayFor(50 * HOUR), '2 days 2 h');
  const m = awayReportModel({ from: T0, to: T0 + HOUR, extracted: { iron: 179.6, iron_deep: 0.4 }, full: [], built: [{ pad: 'r2', kind: 'rig', tier: 1 }],
    raids: [{ at: T0 + 30 * MIN, result: 'breach', lost: { iron: 40.2 }, damage: 120.4 }] }, 'ground', map);
  assert.equal(m.show, true);
  assert.deepEqual(m.extracted.map((x) => [x.name, x.units]), [['Iron', 179]]);
  assert.equal(m.raids[0].label, 'Raid broke through');
  assert.equal(m.raids[0].lostText, 'lost 40 Iron');
  assert.equal(m.breached, 1);
  assert.deepEqual(m.built, ['Mining Station finished']);
  assert.equal(awayReportModel({ from: T0, to: T0 + 1000, extracted: { iron: 0.05 }, full: [], built: [], raids: [] }).show, false);
});

test('the chunked catch-up (one raid window per step) equals the one-shot open, report and save alike', async () => {
  const mk = () => {
    const store = memoryStore(fresh());
    const wear = (o) => ({ result: 'held', defenses: o.defenses.map((d) => ({ id: d.id, hp: d.hp * 0.9 })) });
    const v = createSession({ store, planet: 'ground', map, catalog, raidHook: wear, flowOpts });
    v.act({ type: 'online' }, T0);
    return { store, v };
  };
  const a = mk(), b = mk();
  const one = a.v.open(T0 + 30 * HOUR);
  let pauses = 0;
  const many = await b.v.openChunked(T0 + 30 * HOUR, async () => { pauses++; });
  assert.ok(pauses >= 9, 'one pause per 3-hour window');
  const strip = (s) => JSON.stringify(s.outposts.ground);
  assert.equal(strip(b.store.load()), strip(a.store.load()));
  assert.equal(many.away.raids.length, one.away.raids.length);
  assert.deepEqual(many.away.extracted.map((x) => [x.id, x.units]), one.away.extracted.map((x) => [x.id, x.units]));
  assert.equal(many.report.from, T0);
  assert.equal(many.report.to, T0 + 30 * HOUR);
});
