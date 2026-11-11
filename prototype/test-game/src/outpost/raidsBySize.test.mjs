// Raids come more often at a bigger outpost [MM-story_mwcfrtu4_2w]. Owner 2026-11-11: "The bigger the base the more
// frequent attacks." The chance per window is the workbook's base (Raid_Min_Gap_Hours / Raid_Mean_Hours) grown by
// Raid_Chance_Per_Size per finished building or defense (the hub not counted), capped at Raid_Chance_Max; the draws come
// from the seed and the window only, so a bigger base turns more of the SAME draws into raids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  referenceOutpost, confirmOnline, advance, raidSchedule, raidChance, outpostSize, nextRaidAt, windowMs, createOutpost,
} from './model.js';
import { DRAFT_LAYOUT as map } from './draftLayout.js';
import { OUTPOST } from '../data/outpost.js';
import { createRng } from '../sim/rng.js';

const HOUR = 3_600_000, DAY = 24 * HOUR, MIN = 60_000;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const held = () => ({ result: 'held', defenses: [] });
const W = windowMs();

// The schedule as it was before raids grew with the base (model.js at origin/main ee1e59e), kept as the reference.
function mix(a, b) {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function oldSchedule(seed, fromWindow, toWindow, params = OUTPOST) {
  const w = params.Raid_Min_Gap_Hours * HOUR, chance = params.Raid_Min_Gap_Hours / params.Raid_Mean_Hours, out = [];
  for (let i = fromWindow; i <= toWindow; i++) {
    const rng = createRng(mix(seed, i));
    if (rng.next() < chance) out.push({ window: i, at: i * w + Math.floor(rng.next() * (w / MIN)) * MIN });
  }
  return out;
}

/** An outpost online at T0 with the scripted first raid off, and `extra` more finished walls than the reference set. */
function outpost(seed, extra = 0) {
  let o = referenceOutpost('ground', { seed, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;
  o.firstRaidAt = null;
  for (let i = 0; i < extra; i++) o.defenses.push({ id: `x${i}`, kind: 'wall', tier: 1, cell: [i, 0], hp: 1000 });
  return o;
}
const raidsOver = (o, ms) => advance(o, o.t + ms, { map, raid: held }).report.raids.length;

test('the dials are workbook numbers: Raid_Chance_Per_Size >= 0, Raid_Chance_Max in (0, 1]', () => {
  assert.equal(typeof OUTPOST.Raid_Chance_Per_Size, 'number');
  assert.equal(typeof OUTPOST.Raid_Chance_Max, 'number');
  assert.ok(OUTPOST.Raid_Chance_Per_Size > 0, 'the rule is on');
  assert.ok(OUTPOST.Raid_Chance_Max > 0 && OUTPOST.Raid_Chance_Max <= 1);
});

test('size 0 is the old schedule exactly; the chance grows with size and stops at the cap', () => {
  const base = OUTPOST.Raid_Min_Gap_Hours / OUTPOST.Raid_Mean_Hours;
  assert.equal(raidChance(0), base);
  for (const seed of [1, 7, 4242, 0xdeadbeef]) assert.deepEqual(raidSchedule(seed, 0, 2000), oldSchedule(seed, 0, 2000));
  assert.deepEqual(raidSchedule(4242, 0, 2000, OUTPOST, 0), oldSchedule(4242, 0, 2000));
  let prev = 0;
  for (let s = 0; s <= 100; s++) {
    const c = raidChance(s);
    assert.ok(c >= prev && c <= OUTPOST.Raid_Chance_Max, `size ${s}: ${c}`);
    prev = c;
  }
  assert.equal(raidChance(1e6), OUTPOST.Raid_Chance_Max);
  assert.ok(raidChance(1e6, { ...OUTPOST, Raid_Chance_Max: 5 }) <= 1, 'never above one raid per window');
  assert.equal(raidChance(10, { ...OUTPOST, Raid_Chance_Per_Size: 0 }), base, 'dial 0: the old rule');
});

test('same seed, bigger base: the smaller base\'s raids are a subset (never fewer raids, same minutes)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    let prev = null;
    for (const size of [0, 1, 3, 6, 10, 20, 40]) {
      const s = raidSchedule(seed, 0, 23, OUTPOST, size);
      for (const r of s) assert.equal(Math.floor(r.at / W), r.window, 'at most one raid per window');
      if (prev) {
        const ats = new Set(s.map((r) => r.at));
        assert.ok(prev.every((r) => ats.has(r.at)), `seed ${seed} size ${size}: kept every smaller-base raid`);
        assert.ok(s.length >= prev.length);
      }
      prev = s;
    }
  }
});

test('strictly more raids on average over many seeds, at the dial\'s rate', () => {
  const seeds = 400, windows = 24;   // 3 days of 3-hour windows
  const mean = (size) => {
    let n = 0;
    for (let seed = 1; seed <= seeds; seed++) n += raidSchedule(seed * 2654435761 >>> 0, 0, windows - 1, OUTPOST, size).length;
    return n / seeds;
  };
  const m0 = mean(0), m6 = mean(6), m12 = mean(12);
  assert.ok(m0 < m6 && m6 < m12, `${m0} < ${m6} < ${m12}`);
  for (const [m, size] of [[m0, 0], [m6, 6], [m12, 12]]) {
    const want = raidChance(size) * windows;
    assert.ok(Math.abs(m - want) < 0.06 * windows, `size ${size}: ${m} raids vs ${want} expected`);
  }
});

test('outpostSize counts finished buildings and defenses (not the hub); a build counts once it is done', () => {
  const fresh = createOutpost('ground', { seed: 1, map, now: T0 });
  assert.equal(outpostSize(fresh), 0, 'the granted hub alone is size 0');
  const o = outpost(1);
  const ref = 3 + (map.kitDefenses || []).length;   // power, rig, storage + the kit defenses
  assert.equal(outpostSize(o), ref);
  o.building.push({ pad: 'rb1', kind: 'resourceBay', tier: 1, done: T0 + HOUR });
  o.defenses.push({ id: 'b1', kind: 'mg', tier: 1, cell: [0, 1], hp: 1, building: { done: T0 + 2 * HOUR } });
  o.defenses[0].selling = { done: T0 + 3 * HOUR };
  assert.equal(outpostSize(o, T0), ref, 'the defense being sold still stands; nothing under way is done');
  assert.equal(outpostSize(o, T0 + HOUR), ref + 1, 'the Resource Bay is finished');
  assert.equal(outpostSize(o, T0 + 2 * HOUR), ref + 2, 'the new gun is finished');
  assert.equal(outpostSize(o, T0 + 3 * HOUR), ref + 1, 'the sold defense is gone');
});

test('advance: a bigger base is raided at least as often over the same away time, and more over many seeds', () => {
  let small = 0, big = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = raidsOver(outpost(seed), 3 * DAY), b = raidsOver(outpost(seed, 12), 3 * DAY);
    assert.ok(b >= s, `seed ${seed}: big ${b} >= small ${s}`);
    small += s; big += b;
  }
  assert.ok(big > small, `big ${big} > small ${small}`);
});

test('a size-0 outpost is raided on the old schedule', () => {
  const o = outpost(4242);
  o.pads = { hub: o.pads.hub };
  o.defenses = [];
  const got = advance(o, T0 + 3 * DAY, { map, raid: held }).report.raids.map((r) => r.at);
  // the window the outpost came online in is settled by confirmOnline: the schedule starts at the next
  const want = oldSchedule(4242, o.raids.window + 1, Math.floor((T0 + 3 * DAY) / W)).map((r) => r.at).filter((at) => at > T0 && at <= T0 + 3 * DAY);
  assert.deepEqual(got, want);
});

test('a defense finished mid-away raises the chance from its minute on; advance stays split-invariant', () => {
  for (const seed of [3, 11, 4242]) {
    const o = outpost(seed);
    for (let i = 0; i < 20; i++) o.defenses.push({ id: `w${i}`, kind: 'wall', tier: 1, cell: [i, 2], hp: 1000, building: { done: T0 + DAY } });
    const once = advance(o, T0 + 3 * DAY, { map, raid: held });
    let s = o;
    const log = [];
    for (let t = T0 + W / 2; t < T0 + 3 * DAY; t += W / 2) { const r = advance(s, t, { map, raid: held }); s = r.outpost; log.push(...r.report.raids); }
    log.push(...advance(s, T0 + 3 * DAY, { map, raid: held }).report.raids);
    assert.deepEqual(log.map((r) => r.at), once.report.raids.map((r) => r.at), `seed ${seed}: split-invariant`);
    // before the walls finish: the reference size's schedule; after: the bigger size's
    const ats = once.report.raids.map((r) => r.at);
    const w0 = o.raids.window + 1, w1 =Math.floor((T0 + 3 * DAY) / W);
    const before = raidSchedule(seed, w0, w1, OUTPOST, outpostSize(o, T0)).map((r) => r.at).filter((at) => at > T0 && at < T0 + DAY);
    const after = raidSchedule(seed, w0, w1, OUTPOST, outpostSize(o, T0 + DAY)).map((r) => r.at).filter((at) => at >= T0 + DAY && at <= T0 + 3 * DAY);
    assert.deepEqual(ats, [...before, ...after]);
  }
});

test('the Sensor Spire\'s forecast reads the same rule: nextRaidAt is the raid advance() fights', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const o = outpost(seed, 15);
    const first = advance(o, T0 + DAY, { map, raid: held }).report.raids[0];
    const at = nextRaidAt(o, T0);
    assert.equal(at, first ? first.at : null, `seed ${seed}`);
  }
});
