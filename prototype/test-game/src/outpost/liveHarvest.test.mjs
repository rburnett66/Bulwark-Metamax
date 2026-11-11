// The outpost's harvest on a visit IS the battle harvester (One Battle UX S4 [MM-story_mwc9pzyd_2l]): the live state's
// trucks are sim/harvest.js harvesters on the outpost's surface fields, and the away closed form (model.advance) reads
// the same rates — a sim run and the closed form agree within the tolerances stated below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0, MIN } from './view/fixtures.mjs';
import { referenceOutpost, confirmOnline, advance, harvestPlan, surfaceFieldGroups, buildingRect, outsideLive, hopperCap, hopperUnits as hopperUnitsOf, harvesterCap } from './model.js';
import { OUTPOST, harvestRates, harvesterDef } from '../data/outpost.js';
import { harvesterTile } from './view/hudModel.js';
import { harvesterStats } from '../sim/harvestStats.js';
import { toLiveSim, fromLiveSim, syncHarvestPower } from './liveSim.js';
import { stepSim, applyCommand, FIXED_DT } from '../sim/core.js';
import { HARVESTER_UNLOAD_TIME } from '../data/tables.js';

const QUIET = { ...OUTPOST, Raid_Mean_Hours: 1e12 };
const strip = (o) => JSON.parse(JSON.stringify(o));
/** Run the live state for `sec` seconds; → the deposit events, stamped with the sim time. */
function run(state, sec) {
  const deposits = [];
  for (let i = 0; i < Math.round(sec / FIXED_DT); i++) {
    for (const e of stepSim(state, FIXED_DT) || []) if (e.type === 'deposit') deposits.push({ ...e, t: state.time });
  }
  return deposits;
}
/** The reference outpost, online, Power Station II, a Resource Bay on b1 with `n` harvesters (as bays.test.mjs). */
function withBay(m = map, n = 2) {
  let o = referenceOutpost('ground', { seed: 5, map: m, now: T0 });
  o = confirmOnline(o, m, T0).outpost;
  o.firstRaidAt = null;
  o.pads.p1.tier = 2;
  o.pads.b1 = { kind: 'resourceBay', tier: 1 };
  o.harvesters = n;
  return o;
}
const hopper = (o, t) => (o.hopper && o.hopper[t]) || 0;
const stockOf = (o, m, id) => { const f = surfaceFieldGroups(m).find((g) => g.id === id); return (o.fields || {})[id] ?? f.cap; };
/** The map with every planned field grown to a 5 × 5 patch, so the trucks run whole 40-unit loads (the full-rate phase). */
function bigFields(o) {
  const extra = [];
  for (const h of harvestPlan(o, map)) {
    const role = h.tier === 'common' ? 'primary' : 'premium';
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) extra.push({ x: h.field[0] + dx, y: h.field[1] + dy, role });
  }
  return { ...map, resources: [...map.resources, ...extra] };
}

test('the rates the away closed form reads are the battle harvester\'s own (sim/harvestStats.js)', () => {
  const st = harvesterStats(null), r = harvestRates();
  assert.equal(r.capacity, st.capacity);
  assert.equal(r.speed, st.speed);
  assert.equal(r.unload, HARVESTER_UNLOAD_TIME);
});

test('a visit with harvesters and no time saves back exactly what was loaded', () => {
  const o = withBay();
  o.fields = { [harvestPlan(o, map)[0].fieldId]: 7.25 };   // a part-stripped field
  o.hopper = { common: 3.5 };
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 100 });
  assert.equal(state.harvesterIds.length, 2);
  const back = fromLiveSim(state, link, T0);
  assert.deepEqual(strip(back.outpost), strip(o));
});

test('the bought harvesters are battle harvesters: docked by the Resource Bay, locked to their planned field, driving', () => {
  const o = withBay();
  const plan = harvestPlan(o, map), bay = buildingRect(o, map, 'b1');
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const trucks = state.harvesterIds.map((id) => state.units.get(id));
  assert.deepEqual(trucks.map((u) => u.fieldId), plan.map((h) => h.fieldId));
  for (const u of trucks) {
    assert.equal(u.isHarvester, true);
    assert.equal(u.artKey, 'SYS-Harvester');
    assert.equal(u.fieldLock, true);
    const nextToBay = u.homePos.x >= bay.x - 1 && u.homePos.x <= bay.x + bay.w && u.homePos.y >= bay.y - 1 && u.homePos.y <= bay.y + bay.h;
    assert.ok(nextToBay, `docks beside the bay (${u.homePos.x},${u.homePos.y})`);
  }
  assert.equal(state.resourceNodes.length, surfaceFieldGroups(map).reduce((a, f) => a + f.cells.length, 0), 'every surface cell is a node');
  run(state, 3);
  assert.ok(trucks.every((u) => u.state === 'harvestGo' && (u.pos.x !== u.homePos.x || u.pos.y !== u.homePos.y)), 'they drive out');
  assert.equal(state.economy.money, 0, 'an outpost load is kept for the hopper, never sold for gold');
});

test('the battle tap-the-base purchase is refused: outpost harvesters are bought for the Resource Bay', () => {
  const { state } = toLiveSim(withBay(map, 1), { map, now: T0, gold: 100000 });
  const res = applyCommand(state, { type: 'buyHarvester' });
  assert.equal(res.ok, false);
  assert.match(res.reason, /Resource Bay/);
  assert.equal(state.harvesterIds.length, 1);
  assert.equal(state.economy.money, 100000);
});

test('no harvesters without a finished Resource Bay; an unpowered bay parks them (no power, no operation)', () => {
  const none = toLiveSim(withBay(map, 0), { map, now: T0, gold: 0 }).state;
  assert.equal(none.harvesterIds.length, 0);
  assert.ok(none.resourceNodes.length > 0, 'the fields are still on the board');
  const o = withBay();
  delete o.pads.p1;                                       // no Power Station
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  assert.ok(state.harvesterIds.every((id) => state.units.get(id).parked === true));
  run(state, 60);
  const back = fromLiveSim(state, link, T0 + MIN).outpost;
  assert.equal(hopper(back, 'common') + hopper(back, 'uncommon'), 0);
});

// The full-rate phase (a field with stock for whole loads): the closed form's trip is harvesterRate's
// 2·d·Harvest_Route_Mult / speed + capacity / pull + unload from the bay's centre; the truck drives its real path from
// its dock beside the bay. Measured on the Verdance map (mean of the first whole loads): common 20.20 s a load vs the
// closed form's 21.29 s (5.1 % faster), uncommon 105.25 s vs 107.68 s (2.3 % faster; its pull time dominates).
// Owner 2026-11-11: the battle trucks are EXPECTED to run ~5 % faster than the closed form until Harvest_Route_Mult is
// retuned in the workbook (Outpost_Params, after PR #281): the measured drive matches Harvest_Route_Mult ≈ 1.16 (common
// 1.14, uncommon 1.17) against today's 1.3 (single loads vary: the nearest cells go first). So the live mean may be up to 10 % faster than the closed form and no slower
// than it by more than 2 %; each single load stays within 15 %.
test('full-rate loads: the battle truck runs ~5 % faster than the closed form\'s trip (until the route retune)', () => {
  const o0 = withBay(), m = bigFields(o0), o = withBay(m);
  const plan = harvestPlan(o, m);
  const { state } = toLiveSim(o, { map: m, now: T0, gold: 0 });
  const deps = run(state, 700);
  for (const h of plan) {
    // the first whole loads (a big field still has stock for them): 10 common, 6 uncommon — the measurement above
    const n = h.tier === 'common' ? 10 : 6;
    const mine = deps.filter((d) => d.color === (h.tier === 'common' ? 'blue' : 'yellow')).slice(0, n);
    assert.equal(mine.length, n, `${h.tier}: ${mine.length} loads`);
    assert.ok(mine.every((d) => d.units === harvestRates().capacity), 'whole 40-unit loads credit 40: ' + mine.map((d) => d.units));
    const trip = harvestRates().capacity / (h.rate * 1000);
    for (let i = 1; i < mine.length; i++) {
      const gap = mine[i].t - mine[i - 1].t;
      assert.ok(Math.abs(gap - trip) <= 0.15 * trip, `${h.tier} load ${i}: ${gap.toFixed(1)} s vs closed form ${trip.toFixed(1)} s`);
    }
    const mean = (mine[mine.length - 1].t - mine[0].t) / (mine.length - 1), faster = 1 - mean / trip;
    assert.ok(faster >= -0.02 && faster <= 0.10, `${h.tier}: live ${mean.toFixed(2)} s vs closed form ${trip.toFixed(2)} s (${(faster * 100).toFixed(1)} % faster)`);
  }
});

// ── owner answers, 2026-11-11 ──────────────────────────────────────────────────────────────────────────────────
test('outpost trucks take no field orders; the battle\'s retask still works for unlocked trucks', () => {
  const o = withBay();
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const other = state.resourceNodes.find((n) => !state.harvesterIds.some((id) => state.units.get(id).fieldId === n.fieldId));
  const [first] = state.harvesterIds;
  for (const cmd of [{ type: 'harvest', nodeId: other.id, harvesterId: first }, { type: 'harvest', nodeId: other.id }]) {
    const res = applyCommand(state, cmd);
    assert.equal(res.ok, false);
    assert.match(res.reason, /stay on their own fields/);
  }
  assert.equal(state.units.get(first).fieldId, harvestPlan(o, map)[0].fieldId, 'still on its planned field');
  state.units.get(first).fieldLock = false;                  // a battle truck (no lock) is retasked as before
  assert.equal(applyCommand(state, { type: 'harvest', nodeId: other.id, harvesterId: first }).ok, true);
  assert.equal(state.units.get(first).fieldId, other.fieldId);
});

test('a full hopper stops the harvest during a visit too: nothing overflows, the rest stays in the field', () => {
  const o = withBay();
  const cap = hopperCap(o, map);
  o.hopper = { common: cap - 12 };                         // room for 12 units
  const plan = harvestPlan(o, map);
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, 10 * 60);
  const back = fromLiveSim(state, link, T0 + 10 * MIN).outpost;
  const total = hopper(back, 'common') + hopper(back, 'uncommon');
  assert.ok(total <= cap + 1e-9, `hopper ${total} within its ${cap}`);
  assert.ok(total >= cap - 1, `filled up to the cap (${total} of ${cap})`);
  const left = plan.reduce((a, h) => a + stockOf(back, map, h.fieldId), 0);
  const before = plan.reduce((a, h) => a + stockOf(o, map, h.fieldId), 0);
  assert.ok(left >= before - 12 - 1e-9, `the fields keep what did not fit (${left} of ${before})`);
  assert.ok(state.harvesterIds.every((id) => state.units.get(id).state === 'harvestIdle'), 'the trucks hold their docks');
  // and a full hopper at arrival: the trucks never leave
  o.hopper = { common: cap };
  const full = toLiveSim(o, { map, now: T0, gold: 0 });
  run(full.state, 60);
  assert.equal(hopperUnitsOf(fromLiveSim(full.state, full.link, T0 + MIN).outpost), cap);
});

test('power changes during a visit start and park the trucks (syncHarvestPower reads the live state)', () => {
  const o = withBay();
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  const trucks = () => state.harvesterIds.map((id) => state.units.get(id));
  assert.equal(syncHarvestPower(state, link), true);
  run(state, 2);
  assert.ok(trucks().every((u) => !u.parked && u.state === 'harvestGo'), 'powered: out they go');
  // the Power Station is lost (sold, destroyed): the bay goes dark and the trucks come home and hold
  const station = [...state.structures.values()].find((s) => s.structId === 'OUT-power');
  state.structures.delete(station.id);
  assert.equal(syncHarvestPower(state, link), false);
  run(state, 60);
  assert.ok(trucks().every((u) => u.parked && u.state === 'harvestIdle'), 'parked at the dock: ' + trucks().map((u) => u.state));
  const at = hopperUnitsOf(fromLiveSim(state, link, T0 + MIN).outpost);
  run(state, 60);
  assert.equal(hopperUnitsOf(fromLiveSim(state, link, T0 + 2 * MIN).outpost), at, 'no power, no operation');
  // power back: they start again
  state.structures.set(station.id, station);
  assert.equal(syncHarvestPower(state, link), true);
  run(state, 2);
  assert.ok(trucks().some((u) => u.state === 'harvestGo' || u.state === 'harvestPull'), 'running again');
});

test('the battle rail\'s HARVESTER tile on an outpost: the outpost price and refusals', () => {
  const cost = harvesterDef().cost;
  const noBay = withBay(map, 0);
  delete noBay.pads.b1;
  assert.deepEqual(harvesterTile(noBay, {}, 1e6), { cost: `${cost}g`, poor: true, title: 'Harvester: build the Resource Bay first' });
  const ok = harvesterTile(withBay(map, 0), {}, 1e6);
  assert.deepEqual(ok, { cost: `${cost}g`, poor: false, title: `Harvester for the Resource Bay (${cost}g)` });
  assert.equal(harvesterTile(withBay(map, 0), {}, cost - 1).poor, true, 'short of gold');
  const full = harvesterTile(withBay(map, harvesterCap(withBay(map, 0))), {}, 1e6);
  assert.equal(full.cost, 'MAX');
  assert.match(full.title, /holds \d+ harvesters/);
});

// The Verdance map's real fields (one cell each: 25 common, 10 uncommon) with K = 2 harvesters for N minutes. Both sides
// strip the stock, then take only what regrows (5 % of the battle rate); a truck brings regrowth home a whole unit at a
// time, so the hopper agrees within 1 unit per harvester, and stock is conserved (hopper + field) within 0.1 unit.
// Measured: 10 min live 26 / 10 vs closed 26.25 / 10.5; 30 min live 28 / 11 vs closed 28.75 / 11.5 (common / uncommon).
test('a live visit and the closed form agree: K = 2 harvesters for 10 and 30 minutes', () => {
  for (const minutes of [10, 30]) {
    const o = withBay();
    const plan = harvestPlan(o, map);
    const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
    run(state, minutes * 60);
    const end = T0 + minutes * MIN;
    const live = fromLiveSim(state, link, end).outpost;
    const closed = advance(o, end, { map, params: QUIET }).outpost;
    for (const h of plan) {
      const a = hopper(live, h.tier), b = hopper(closed, h.tier);
      assert.ok(a > 0, `${h.tier} gathered`);
      assert.ok(Math.abs(a - b) <= 1, `${minutes} min ${h.tier}: live ${a} vs closed form ${b}`);
      const ca = a + stockOf(live, map, h.fieldId), cb = b + stockOf(closed, map, h.fieldId);
      assert.ok(Math.abs(ca - cb) <= 0.1, `${minutes} min ${h.tier} conserved: live ${ca} vs closed form ${cb}`);
      assert.ok(Math.abs((live.lifetime.harvested[h.tier] || 0) - a) < 1e-9, 'the lifetime ledger counts the visit');
    }
  }
});

test('the visit\'s stretch is not counted twice: the away closed form picks up where the trucks stopped', () => {
  const o = withBay();
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, 10 * 60);
  const left = T0 + 10 * MIN;
  const saved = fromLiveSim(state, link, left).outpost;
  assert.deepEqual(saved.liveHarvest, { from: T0, to: left });
  // the next open advances from the arrival time (o.t) over the visit: the hopper must not grow over that stretch
  const reopened = advance(saved, left, { map, params: QUIET }).outpost;
  assert.equal(hopper(reopened, 'common'), hopper(saved, 'common'));
  assert.equal(hopper(reopened, 'uncommon'), hopper(saved, 'uncommon'));
  assert.equal(reopened.liveHarvest, undefined, 'the mark is dropped once the clock is past it');
  // visit + 2 h away ≈ 2 h 10 min all away (within one unit per harvester)
  const later = left + 120 * MIN;
  const mixed = advance(saved, later, { map, params: QUIET }).outpost, away = advance(o, later, { map, params: QUIET }).outpost;
  for (const t of ['common', 'uncommon']) assert.ok(Math.abs(hopper(mixed, t) - hopper(away, t)) <= 1, `${t}: ${hopper(mixed, t)} vs ${hopper(away, t)}`);
});

test('outsideLive: the parts of a stretch outside the visit', () => {
  assert.deepEqual(outsideLive(null, 0, 10), [[0, 10]]);
  assert.deepEqual(outsideLive({ from: 2, to: 5 }, 0, 10), [[0, 2], [5, 10]]);
  assert.deepEqual(outsideLive({ from: 0, to: 10 }, 2, 8), []);
  assert.deepEqual(outsideLive({ from: 20, to: 30 }, 0, 10), [[0, 10]]);
});
