// The outpost STATUS screen (owner 2026-11-07): total collection and current collection per hour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceOutpost, advance, sell, collectionRates, rigRatePerMin, defaultPads, migrateOutpost, confirmOnline } from '../model.js';
import { DRAFT_LAYOUT as map } from '../draftLayout.js';
import { statusModel, fmtPerHour } from './statusReport.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const ctx = { map, raid: () => ({ result: 'held', defenses: [] }) };
const fresh = () => { const o = referenceOutpost('ground', { seed: 7, map, now: T0 }); o.firstRaidAt = null; return o; };

test('a running rig reports its rate per hour; a full bay reads 0 with its reason', () => {
  const o = fresh(), rig = defaultPads(map).rig;
  const r = collectionRates(o, map);
  assert.equal(r.ore.length, 1);
  assert.equal(r.ore[0].stopped, null);
  assert.ok(Math.abs(r.ore[0].perHour - rigRatePerMin(o, rig) * 60) < 1e-9);
  const later = advance(o, T0 + 72 * HOUR, ctx).outpost;
  const full = collectionRates(later, map);
  assert.equal(full.ore[0].stopped, 'full');
  assert.equal(full.ore[0].perHour, 0);
});

test('the lifetime ledger adds up extraction across advances and the gold from sales', () => {
  let o = fresh();
  const a = advance(o, T0 + 2 * HOUR, ctx); o = a.outpost;
  const b = advance(o, T0 + 5 * HOUR, ctx); o = b.outpost;
  const item = Object.keys(a.report.extracted)[0];
  assert.ok(Math.abs(o.lifetime.extracted[item] - (a.report.extracted[item] + b.report.extracted[item])) < 1e-6);
  o = advance(o, T0 + 48 * HOUR, ctx).outpost;
  const s = sell(o, {});
  assert.ok(s.gold > 0);
  assert.equal(s.outpost.lifetime.gold, s.gold);
  assert.equal(s.outpost.lifetime.loads, s.loads.length);
});

test('an outpost saved before the ledger starts its totals from what it sold', () => {
  const o = fresh();
  const item = collectionRates(o, map).ore[0].item;
  delete o.lifetime; o.sold = { [item]: 120 };
  migrateOutpost(o);
  assert.equal(o.lifetime.extracted[item], 120);
  assert.equal(o.lifetime.gold, 0);
});

test('the status model: rates per hour, totals and how long the outpost has run', () => {
  let o = confirmOnline(fresh(), map, T0).outpost; o.firstRaidAt = null;
  o = advance(o, T0 + 3 * HOUR, ctx).outpost;
  const m = statusModel(o, map, { planet: 'ground', now: T0 + 3 * HOUR });
  assert.equal(m.online, true);
  assert.equal(m.since, '3 h');
  assert.equal(m.rates.ore.length, 1);
  assert.ok(m.rates.ore[0].perHour > 0 && !m.rates.ore[0].stopped);
  assert.equal(m.totals.ore.length, 1);
  assert.ok(m.totals.ore[0].units > 0);
  assert.equal(m.totals.gold, 0);
  assert.equal(fmtPerHour(12.4), '12');
  assert.equal(fmtPerHour(2.46), '2.5');
});
