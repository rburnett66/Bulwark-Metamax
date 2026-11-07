// The outpost model against the tech plan's tests (docs/tech-plan/Outpost.md §4.4) and the design's numbers
// (Outpost-Design §4–§6) [MM-story_mw5oe696_j]. Raids use stand-in outcomes here; the battle sim's runRaid (story O7)
// is passed through the same ctx.raid hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOutpost, confirmOnline, advance, sell, loadsReady, place, upgrade, repair, repairCost, setDeep,
  raidSchedule, raidOutcome, powerGrids, bayCapacity, onlineProblems, status, windowMs, outpostSeed,
} from './model.js';
import { DRAFT_LAYOUT as map } from './draftLayout.js';
import { OUTPOST } from '../data/outpost.js';
import { defaultSave, migrate } from '../save/save.js';

const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const held = () => ({ result: 'held', defenses: [] });
const ctx = (extra = {}) => ({ map, raid: held, ...extra });

/** A Verdance outpost, online at T0, with no raids (the schedule's seed is picked so the first hours are quiet). */
function online(seed = 7, { noRaids = true } = {}) {
  let o = createOutpost('ground', { seed, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;
  if (noRaids) o.firstRaidAt = null;   // tests that want raids say so
  return o;
}
/** Advance with raids switched off (no schedule): extraction alone. */
const quiet = (o, to, extra) => advance({ ...o, online: true }, to, { ...ctx(extra), params: { ...OUTPOST, Raid_Mean_Hours: 1e12 } });

test('the contract kit (design §2.3) is placed on the default pads and powered', () => {
  const o = createOutpost('ground', { seed: 1, map, now: T0 });
  assert.equal(o.online, false);
  assert.deepEqual(Object.values(o.pads).map((b) => b.kind).sort(), ['hub', 'power', 'rig', 'storage']);
  assert.deepEqual(o.defenses.map((d) => d.kind).sort(), ['cannon', 'mg', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall']);
  assert.deepEqual(onlineProblems(o, map), []);
  const g = powerGrids(o, map);
  assert.equal(g.grids.length, 1);
  assert.deepEqual([g.grids[0].supply, g.grids[0].draw], [10, 9], 'the kit draws 9 of 10');
});

test('4 hours fill the 720-iron bay; a load is 15 units; nothing is sold while time passes', () => {
  const { outpost: o, report } = quiet(online(), T0 + 4 * HOUR);
  assert.ok(Math.abs(o.storage.r1.iron - 720) < 1e-9);
  assert.equal(loadsReady(o, ctx()), 48);
  assert.equal(report.full.length, 1);
  assert.ok(Math.abs(report.full[0].at - (T0 + 4 * HOUR)) < 1);
  const later = quiet(o, T0 + 6 * HOUR).outpost;
  assert.ok(Math.abs(later.storage.r1.iron - 720) < 1e-9, 'a full bay stops its rig');
  assert.deepEqual(later.sold, {}, 'advance never sells');
  const five = quiet(online(), T0 + 5 * MIN).outpost;
  assert.equal(loadsReady(five, ctx()), 1);
  assert.ok(Math.abs(five.storage.r1.iron - 15) < 1e-9);
});

test('deep drilling: needs Deep Drilling I, 1/4 the speed, fills its bay in 16 hours, worth 1.25x per hour', () => {
  assert.ok(setDeep(online(), 'r1', true, {}).error);
  const o = setDeep(online(), 'r1', true, { unlocks: ['deep_drilling_1'] }).outpost;
  const at16 = quiet(o, T0 + 16 * HOUR).outpost;
  assert.ok(Math.abs(at16.storage.r1.iron_deep - 720) < 1e-9);
  const at4 = quiet(o, T0 + 4 * HOUR).outpost;
  const s = sell(at4, ctx());
  assert.equal(s.gold, 3600, '4 h of deep iron sells for 4 x 900');
});

test('advancing once over 10 hours equals 600 one-minute steps (closed form is exact), raids included', () => {
  const breachOdd = (o, r) => ({ result: r.window % 2 ? 'breach' : 'held', defenses: o.defenses.map((d) => ({ id: d.id, hp: d.hp - 1 })) });
  const start = online(99, { noRaids: false });
  const once = advance(start, T0 + 10 * HOUR, ctx({ raid: breachOdd })).outpost;
  let step = start;
  for (let i = 1; i <= 600; i++) step = advance(step, T0 + i * MIN, ctx({ raid: breachOdd })).outpost;
  assert.ok(Math.abs(once.storage.r1.iron - step.storage.r1.iron) < 1e-9, `${once.storage.r1.iron} vs ${step.storage.r1.iron}`);
  assert.equal(once.raids.log.length, 3, 'the scripted first raid plus a breach and a held raid');
  assert.deepEqual(once.raids.log, step.raids.log);
  assert.deepEqual(once.defenses, step.defenses);
});

test('the raid schedule is the same however often the game is opened', () => {
  const start = online(4242, { noRaids: false });
  const once = advance(start, T0 + 3 * DAY, ctx()).outpost;
  let o = start;
  for (let t = T0 + 7 * MIN; t <= T0 + 3 * DAY; t += 7 * MIN + 13_000) o = advance(o, t, ctx()).outpost;
  o = advance(o, T0 + 3 * DAY, ctx()).outpost;
  assert.ok(once.raids.log.length >= 8, `about 12 raids in 3 days: ${once.raids.log.length}`);
  assert.deepEqual(once.raids.log.map((r) => r.at), o.raids.log.map((r) => r.at));
  const n = raidSchedule(4242, 0, 10_000).length / 10_001;
  assert.ok(Math.abs(n - 0.5) < 0.03, `one raid per 6 h on average: ${n} per 3-hour window`);
  for (const r of raidSchedule(4242, 0, 500)) assert.equal(Math.floor(r.at / windowMs()), r.window, 'at most one raid per window');
});

test('the scripted first raid comes First_Raid_Sec after going online, even while away', () => {
  let o = createOutpost('ground', { seed: 3, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;
  assert.equal(o.firstRaidAt, T0 + OUTPOST.First_Raid_Sec * 1000);
  const seen = [];
  const r = advance(o, T0 + HOUR, ctx({ raid: (x, raid) => { seen.push(raid); return held(); } }));
  assert.equal(seen[0].first, true);
  assert.equal(seen[0].at, T0 + 600_000);
  assert.equal(r.report.raids[0].result, 'held');
});

test('clock guards: a clock that goes back advances nothing; a 10-day gap is capped at 72 hours', () => {
  const o = quiet(online(), T0 + HOUR).outpost;
  const back = advance(o, T0, ctx());
  assert.equal(back.outpost.t, o.t);
  assert.deepEqual(back.outpost.storage, o.storage);
  const far = advance(o, o.t + 10 * DAY, ctx()).outpost;
  assert.equal(far.t, o.t + 72 * HOUR);
});

test('a breach loses exactly 25% of every bay and changes no building; damage carries over', () => {
  const o = quiet(online(), T0 + 2 * HOUR).outpost;
  const mg = o.defenses.find((d) => d.kind === 'mg');
  const { outpost: b, entry } = raidOutcome(o, { result: 'breach', at: o.t, defenses: [{ id: mg.id, hp: 100 }] });
  assert.ok(Math.abs(b.storage.r1.iron - o.storage.r1.iron * 0.75) < 1e-9);
  assert.ok(Math.abs(entry.lost.iron - o.storage.r1.iron * 0.25) < 1e-9);
  assert.deepEqual(b.pads, o.pads);
  assert.equal(b.defenses.find((d) => d.id === mg.id).hp, 100);
  assert.equal(entry.damage, 140);
  assert.equal(status(b, ctx()).worn, true);
});

test('only repair restores HP, priced from the defense value (10% per 10%); placing does not', () => {
  let o = raidOutcome(online(), { result: 'held', at: T0, defenses: [{ id: 'd1', hp: 200 }] }).outpost;   // the cannon, 400 HP
  assert.equal(repairCost(o, 'd1'), 600, 'half its HP on a 1,200-gold cannon');
  o = place(o, { kind: 'mg', cell: [5, 5] }, { map, now: T0 }).outpost;
  assert.equal(o.defenses.find((d) => d.id === 'd1').hp, 200, 'building something else does not repair');
  assert.ok(repair(o, 'd1', { gold: 599 }).error);
  const r = repair(o, 'd1', { gold: 600 });
  assert.equal(r.cost, 600);
  assert.equal(r.outpost.defenses.find((d) => d.id === 'd1').hp, 400);
});

test('selling: one entry per full load, the partial load stays, contract tally counts', () => {
  const o = quiet(online(), T0 + 37 * MIN).outpost;   // 111 iron: 7 loads + 6 units
  const s = sell(o, ctx());
  assert.equal(s.loads.length, 7);
  assert.ok(s.loads.every((l) => l.units === 15 && l.gold === 60));
  assert.equal(s.gold, 420);
  assert.ok(Math.abs(s.outpost.storage.r1.iron - 6) < 1e-9);
  assert.equal(s.outpost.sold.iron, 105);
  assert.equal(sell(o, ctx({ shuttleTier: 2 })).gold, 462, 'Cargo Shuttle II adds 10%');
});

test('the far buyer (design §8.5): refused until found, pays 2x, costs home loyalty per load', () => {
  let o = online();
  o.pads.r1.deposit = 'rare';   // a lithium rig, for the test
  o = quiet(o, T0 + HOUR).outpost;   // 48 lithium: 12 loads of 4
  assert.ok(sell(o, ctx(), { buyer: 'air' }).error, 'not yet discovered');
  assert.ok(sell(o, ctx({ farDiscovered: true }), { buyer: 'space' }).error, 'Lumen does not want lithium');
  const s = sell(o, ctx({ farDiscovered: true }), { buyer: 'air' });
  assert.equal(s.loads.length, 12);
  assert.equal(s.loads[0].gold, 240, '4 lithium at 30 x 2');
  assert.equal(s.loyalty.home, -12);
});

test('power: supply, reach, pooling, and a remote rig with its own station (design §4.5)', () => {
  const unlocks = ['power_grid_2'];
  let o = online();
  // a second rig on the uncommon deposit: 13 draw on a 10 supply grid, so it stays off for supply
  o = place(o, { pad: 'r2', kind: 'rig' }, { map, now: T0, unlockedTiers: ['common', 'uncommon'] }).outpost;
  o = quiet(o, T0 + 10 * MIN).outpost;
  let g = powerGrids(o, map);
  assert.equal(g.off.r2, 'supply');
  assert.ok(g.powered.has('r1'), 'the kit keeps running first');
  // upgrade the station to Power Station II: 20 supply powers both
  o = upgrade(o, 'p1', { now: o.t, unlocks }).outpost;
  o = quiet(o, o.t + 20 * MIN).outpost;
  g = powerGrids(o, map);
  assert.equal(g.off.r2, undefined);
  // the remote rare rig is out of the main station's reach until it has its own
  o = place(o, { pad: 'r3', kind: 'rig' }, { map, now: o.t, unlockedTiers: ['common', 'uncommon', 'rare'] }).outpost;
  o = quiet(o, o.t + 10 * MIN).outpost;
  assert.equal(powerGrids(o, map).off.r3, 'reach');
  o = place(o, { pad: 'p2', kind: 'power' }, { map, now: o.t }).outpost;
  o = quiet(o, o.t + 15 * MIN).outpost;
  g = powerGrids(o, map);
  assert.ok(g.powered.has('r3'));
  assert.equal(g.grids.length, 2, 'the remote station is its own grid');
  // two stations within reach of each other pool their supply
  const pooled = { ...o, pads: { ...o.pads, x1: { kind: 'power', tier: 1 } } };
  assert.equal(powerGrids(pooled, map).grids.find((x) => x.stations.includes('p1')).supply, 30);
});

test('building refuses what cannot be paid, the wrong pad, a taken pad and a locked ore', () => {
  const o = online();
  const c = { map, now: T0, unlockedTiers: ['common'] };
  assert.match(place(o, { pad: 'r2', kind: 'rig' }, { ...c, gold: 2999 }).error, /costs 3000/);
  assert.match(place(o, { pad: 'r2', kind: 'rig' }, c).error, /not unlocked/);
  assert.match(place(o, { pad: 'b1', kind: 'rig' }, c).error, /cannot go on a bay pad/);
  assert.match(place(o, { pad: 'p1', kind: 'power' }, c).error, /taken/);
  assert.match(upgrade(o, 'r1', { now: T0 }).error, /not unlocked/);
  const ok = place(o, { pad: 'b1', kind: 'harvesterBay' }, { ...c, gold: 2500 });
  assert.equal(ok.cost, 2500);
  assert.equal(ok.outpost.building[0].done, T0 + 300_000, 'a 5-minute build');
});

test('Rig Mk II doubles extraction and its bay; one full bay stops only its own rig (design §4.2)', () => {
  let o = online();
  o = upgrade(o, 'r1', { now: T0, unlocks: ['rig_mk2'] }).outpost;
  o = quiet(o, T0 + 20 * MIN).outpost;   // the upgrade finishes at 20 minutes
  assert.equal(o.pads.r1.tier, 2);
  assert.equal(bayCapacity(o, 'r1'), 1440);
  const before = o.storage.r1.iron;
  const after = quiet(o, o.t + HOUR).outpost.storage.r1.iron;
  assert.ok(Math.abs(after - before - 360) < 1e-9, 'Mk II mines 6 iron a minute');
  // two rigs: fill the iron bay; the aluminum rig keeps going
  let two = place(online(), { pad: 'r2', kind: 'rig' }, { map, now: T0, unlockedTiers: ['common', 'uncommon'] }).outpost;
  two = upgrade(two, 'p1', { now: T0, unlocks: ['power_grid_2'] }).outpost;
  two = quiet(two, T0 + 6 * HOUR).outpost;
  assert.ok(Math.abs(two.storage.r1.iron - 720) < 1e-9);
  assert.ok(two.storage.r2.aluminum > 300 && two.storage.r2.aluminum <= 360);
});

test('going online needs every kit building powered; status feeds the menu button', () => {
  const o = createOutpost('ground', { seed: 1, map, now: T0 });
  const bad = { ...o, pads: { ...o.pads } };
  delete bad.pads.p1;
  assert.ok(confirmOnline(bad, map, T0).error);
  const s = status(quiet(online(), T0 + 30 * MIN).outpost, ctx());
  assert.deepEqual([s.loads, s.full, s.worn, s.dot], [6, false, false, true]);
});

test('seeds are stable per save and planet; the save gains empty outposts', () => {
  assert.equal(outpostSeed('abc', 'ground'), outpostSeed('abc', 'ground'));
  assert.notEqual(outpostSeed('abc', 'ground'), outpostSeed('abc', 'air'));
  const old = { v: 1 };
  const s = migrate(old);
  assert.deepEqual(s.outposts, {});
  assert.deepEqual(s.outpostContracts, {});
  assert.deepEqual(s.outpostTrade, { discovered: {}, farSoldToday: null });
  assert.deepEqual(defaultSave().outposts, {});
});
