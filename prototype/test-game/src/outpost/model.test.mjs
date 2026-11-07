// The outpost model against the tech plan's tests (docs/tech-plan/Outpost.md §4.4) and the design's numbers
// (Outpost-Design §4–§6) [MM-story_mw5oe696_j]. Raids use stand-in outcomes here; the battle sim's runRaid (story O7)
// is passed through the same ctx.raid hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOutpost, confirmOnline, advance, sell, loadsReady, place, upgrade, repair, repairCost, setDeep,
  raidSchedule, raidOutcome, powerGrids, bayCapacity, onlineProblems, status, windowMs, outpostSeed,
  referenceOutpost, defaultPads, buyHarvester, harvesterRefusal, warnings, migrateOutpost, PAD_KINDS,
} from './model.js';
import { DRAFT_LAYOUT as map } from './draftLayout.js';
import { OUTPOST } from '../data/outpost.js';
import { defaultSave, migrate } from '../save/save.js';

const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const held = () => ({ result: 'held', defenses: [] });
const ctx = (extra = {}) => ({ map, raid: held, ...extra });

/** A Verdance outpost (the reference set), online at T0, with no raids unless asked. */
function online(seed = 7, { noRaids = true } = {}) {
  let o = referenceOutpost('ground', { seed, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;
  if (noRaids) o.firstRaidAt = null;   // tests that want raids say so
  return o;
}
/** Advance with raids switched off (no schedule): extraction alone. */
const quiet = (o, to, extra) => advance({ ...o, online: true }, to, { ...ctx(extra), params: { ...OUTPOST, Raid_Mean_Hours: 1e12 } });

test('the contract grants only the hub (owner 2026-11-07); the rest is bought', () => {
  const o = createOutpost('ground', { seed: 1, map, now: T0 });
  assert.equal(o.online, false);
  assert.deepEqual(o.pads, { hub: { kind: 'hub', tier: 1 } });
  assert.deepEqual([o.defenses, o.building, o.storage, o.harvesters], [[], [], {}, 0]);
  assert.deepEqual(onlineProblems(o, map), ['no power station', 'no mining rig on the iron', 'no storage tower', 'hub unpowered (reach)']);
  assert.ok(confirmOnline(o, map, T0).error);
  assert.deepEqual(defaultPads(map), { hub: 'hub', power: 'p1', rig: 'r1', storage: 's1' });
  assert.deepEqual([...PAD_KINDS], ['power', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'habitat']);   // the Habitat: story O15
});

test('the reference set (the former kit: the map\'s kitDefenses) is on the default pads and powered', () => {
  const o = referenceOutpost('ground', { seed: 1, map, now: T0 });
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
  let o = referenceOutpost('ground', { seed: 3, map, now: T0 });
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
  assert.match(place(o, { pad: 'r2', kind: 'rig' }, { ...c, gold: 599 }).error, /costs 600/);
  assert.match(place(o, { pad: 'r2', kind: 'rig' }, c).error, /not unlocked/);
  assert.match(place(o, { pad: 'b1', kind: 'rig' }, c).error, /cannot go on a bay pad/);
  assert.match(place(o, { pad: 'p1', kind: 'power' }, c).error, /taken/);
  assert.match(upgrade(o, 'r1', { now: T0 }).error, /not unlocked/);
  const ok = place(o, { pad: 'b1', kind: 'resourceBay' }, { ...c, gold: 2500 });
  assert.equal(ok.cost, 2500);
  assert.equal(ok.outpost.building[0].done, T0 + 300_000, 'a 5-minute build');
  assert.equal(place(o, { pad: 'b1', kind: 'harvesterBay' }, c).outpost.building[0].kind, 'resourceBay', 'the old name builds a Resource Bay');
  // defenses: only the Wall, the Machine Gun and the Cannon Tower (owner 2026-11-07)
  for (const kind of ['flak', 'missile', 'rocket', 'STR-Flak']) assert.match(place(o, { kind, cell: [5, 5] }, c).error, /unknown building/);
  for (const kind of ['wall', 'mg', 'cannon']) assert.equal(place(o, { kind, cell: [5, 5] }, c).outpost.defenses.at(-1).kind, kind);
  assert.match(place(o, { kind: 'harvester', pad: 'b2' }, c).error, /buyHarvester/);
  assert.match(place(createOutpost('ground', { seed: 1, map, now: T0 }), { kind: 'hub', pad: 'hub' }, c).error, /contract/);
});

test('the first setup is bought with gold: power, a mining station, storage, then online (owner 2026-11-07)', () => {
  let o = createOutpost('ground', { seed: 5, map, now: T0 });
  let gold = 1500;
  const buy = (what, now) => {
    const r = place(o, what, { map, now, gold, unlockedTiers: ['common'] });
    assert.ok(!r.error, r.error);
    o = r.outpost; gold -= r.cost;
    return r.cost;
  };
  assert.deepEqual([buy({ pad: 'p1', kind: 'power' }, T0), buy({ pad: 'r1', kind: 'rig' }, T0), buy({ pad: 's1', kind: 'storage' }, T0)], [600, 600, 300]);
  assert.equal(gold, 0);
  assert.match(place(o, { kind: 'mg', cell: [5, 5] }, { map, now: T0, gold }).error, /costs 600/);
  assert.equal(onlineProblems(o, map).length, 4, 'nothing counts while it is still building (the hub has no power yet)');
  o = advance(o, T0 + 2 * MIN, { map }).outpost;
  assert.deepEqual(Object.keys(o.pads).sort(), ['hub', 'p1', 'r1', 's1']);
  assert.deepEqual(onlineProblems(o, map), []);
  assert.ok(confirmOnline(o, map, o.t).outpost.online);
});

test('going online needs the four, all powered: a rig off the iron or out of power does not count', () => {
  const base = referenceOutpost('ground', { seed: 1, map, now: T0 });
  const noStorage = { ...base, pads: { ...base.pads } };
  delete noStorage.pads.s1;
  assert.deepEqual(onlineProblems(noStorage, map), ['no storage tower']);
  const offIron = { ...base, pads: { ...base.pads, r2: { kind: 'rig', tier: 1, deposit: 'uncommon', deep: false } } };
  delete offIron.pads.r1;
  assert.ok(onlineProblems(offIron, map).includes('no mining rig on the iron'));
  const noPower = { ...base, pads: { ...base.pads } };
  delete noPower.pads.p1;
  const p = onlineProblems(noPower, map);
  assert.ok(p.includes('no power station') && p.includes('r1 unpowered (reach)') && p.includes('s1 unpowered (reach)'), p.join('; '));
});

test('harvesters: refused before the Resource Bay is finished, bought after, capped at Harvester_Cap', () => {
  let o = online();
  assert.equal(buyHarvester(o, { gold: 1e9 }).error, 'build the Resource Bay first');
  o = place(o, { pad: 'b1', kind: 'resourceBay' }, { map, now: T0 }).outpost;
  assert.equal(buyHarvester(o, { gold: 1e9 }).error, 'build the Resource Bay first', 'still under construction');
  o = quiet(o, T0 + 5 * MIN).outpost;
  assert.equal(o.pads.b1.kind, 'resourceBay');
  assert.equal(buyHarvester(o, { gold: 1999 }).error, 'costs 2000 gold');
  const one = buyHarvester(o, { gold: 2000 });
  assert.equal(one.cost, 2000);
  assert.equal(one.outpost.harvesters, 1);
  assert.equal(o.harvesters, 0, 'the outpost passed in is unchanged');
  const two = buyHarvester(one.outpost, { gold: 2000 }).outpost;
  assert.equal(two.harvesters, OUTPOST.Harvester_Cap);
  assert.equal(buyHarvester(two, { gold: 1e9 }).error, 'the Resource Bay holds 2 harvesters');
  assert.equal(harvesterRefusal(two, { gold: 1e9 }), 'the Resource Bay holds 2 harvesters');
  assert.equal(buyHarvester(two, { gold: 1e9, params: { ...OUTPOST, Harvester_Cap: 4 } }).outpost.harvesters, 3, 'the cap is data');
});

test('a save with the old Harvester Bay is migrated to the Resource Bay', () => {
  const old = { pads: { hub: { kind: 'hub', tier: 1 }, b1: { kind: 'harvesterBay', tier: 1 } }, building: [{ pad: 'b2', kind: 'harvesterBay', tier: 1, done: 1 }] };
  const m = migrateOutpost(JSON.parse(JSON.stringify(old)));
  assert.deepEqual([m.pads.b1.kind, m.building[0].kind, m.harvesters], ['resourceBay', 'resourceBay', 0]);
  const s = migrate({ v: 1, outposts: { ground: JSON.parse(JSON.stringify(old)) } });
  assert.deepEqual([s.outposts.ground.pads.b1.kind, s.outposts.ground.building[0].kind, s.outposts.ground.harvesters], ['resourceBay', 'resourceBay', 0]);
});

test('owner 2026-11-07: a rig with no Storage Tower still mines, into its own small bay (Rig_Bay_Min)', () => {
  const o = online();
  delete o.pads.s1;
  assert.equal(bayCapacity(o, 'r1', map), 45, '15 minutes of iron: three loads');
  const a = quiet(o, T0 + HOUR).outpost;
  assert.ok(Math.abs(a.storage.r1.iron - 45) < 1e-9, 'it stops when its own bay is full');
  assert.deepEqual(warnings(a, map).r1, ['storage_full']);
  // a tower raises the cap: the rig starts again
  const t = { ...a, pads: { ...a.pads, s1: { kind: 'storage', tier: 1 } } };
  assert.equal(bayCapacity(t, 'r1', map), 720);
  assert.ok(Math.abs(quiet(t, a.t + HOUR).outpost.storage.r1.iron - 225) < 1e-9, '45 + an hour of iron');
  // it mines before the outpost goes online too: power is all it needs
  let pre = createOutpost('ground', { seed: 5, map, now: T0 });
  pre = place(pre, { pad: 'p1', kind: 'power' }, { map, now: T0 }).outpost;
  pre = place(pre, { pad: 'r1', kind: 'rig' }, { map, now: T0, unlockedTiers: ['common'] }).outpost;
  pre = advance(pre, T0 + 12 * MIN, { map }).outpost;
  assert.equal(pre.online, false);
  assert.ok(Math.abs(pre.storage.r1.iron - 30) < 1e-9, '10 minutes after the 2-minute builds');
});

test('owner 2026-11-07: no electricity, no operation; stored ore is kept; an unpowered tower closes its door', () => {
  const o = quiet(online(), T0 + HOUR).outpost;   // 180 iron in the tower-raised bay
  // the station goes: nothing runs, nothing is lost, and the hub can still ship what is stored
  const dark = { ...o, pads: { ...o.pads } };
  delete dark.pads.p1;
  const d = quiet(dark, o.t + HOUR).outpost;
  assert.ok(Math.abs(d.storage.r1.iron - 180) < 1e-9);
  assert.deepEqual(warnings(d, map), {
    hub: ['no_power'], s1: ['no_power', 'door_closed'], r1: ['no_power', 'storage_full'], d1: ['no_power'], d2: ['no_power'],
  });
  assert.equal(sell(d, ctx()).gold, 720, 'stored ore still sells: 12 loads');
  // only the tower loses power (the rig on a station of its own): its door closes, the rig falls back to its own bay
  const map2 = { ...map, pads: [...map.pads, { id: 'p9', x: 8, y: 18, w: 2, h: 2, role: 'power' }] };
  const towerOff = { ...o, pads: { ...o.pads, p9: { kind: 'power', tier: 1 } } };
  delete towerOff.pads.p1;
  const g = powerGrids(towerOff, map2);
  assert.ok(g.powered.has('r1') && !g.powered.has('s1'), JSON.stringify(g.off));
  assert.equal(bayCapacity(towerOff, 'r1', map2), 45);
  const t = quiet(towerOff, o.t + HOUR, { map: map2 }).outpost;
  assert.ok(Math.abs(t.storage.r1.iron - 180) < 1e-9, 'over the own bay already: no intake, and nothing lost');
  assert.ok(warnings(t, map2).s1.includes('door_closed'));
  assert.ok(warnings(t, map2).r1.includes('storage_full'));
  // a powered tower full on every rig shows storage_full
  const full = quiet(online(), T0 + 5 * HOUR).outpost;
  assert.deepEqual(warnings(full, map), { r1: ['storage_full'], s1: ['storage_full'] });
  assert.deepEqual(warnings(online(), map), {});
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

test('going online needs every establishing building powered; status feeds the menu button', () => {
  const o = referenceOutpost('ground', { seed: 1, map, now: T0 });
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
