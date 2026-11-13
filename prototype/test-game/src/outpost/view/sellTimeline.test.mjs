// The SELL timeline (restored after S6 deleted it with the old farm view) [MM-story_mwefm2or_j] [MM-story_mw5oeer7_n]:
// from sell()'s per-load entries — the beats, the "$N" pops per load in the ore colour, the gold count-up, the shuttle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellTimeline, SELL, MAX_POPS, popColour } from './sellTimeline.js';
import { referenceOutpost, confirmOnline, advance, sell } from '../model.js';
import { map, T0, MIN } from './fixtures.mjs';

const kit = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
const online = () => confirmOnline(kit(), map, T0).outpost;
const quiet = { map, raid: null };

test('the SELL timeline follows the §6.5 table, from sell()\'s per-load entries', () => {
  const o = advance(online(), T0 + 20 * MIN, quiet).outpost;
  const s = sell(o, {});
  assert.equal(s.loads.length, 4);
  const tl = sellTimeline(s.loads, { goldFrom: 1000 });
  const at = (type) => tl.beats.find((b) => b.type === type).t;
  assert.equal(at('drain'), 0); assert.equal(at('crates'), 0);
  assert.equal(at('engines'), 0.6); assert.equal(at('lift'), 0.6); assert.equal(at('shake'), 0.6);
  assert.equal(at('splatter'), 0.8);
  assert.equal(at('arc'), SELL.arc[0]);
  assert.deepEqual(tl.pops.map((p) => +p.t.toFixed(2)), [0.9, 1.02, 1.14, 1.26], 'one "$N" per load, staggered 0.12 s');
  assert.deepEqual(tl.pops.map((p) => p.gold), s.loads.map((l) => l.gold));
  assert.equal(tl.pops[0].colour, '#8a4b32', 'in the ore colour');
  assert.equal(tl.total, s.gold);
  assert.equal(tl.countAt(0), 1000);
  assert.equal(tl.countAt(1.4), 1000);
  assert.equal(tl.countAt(tl.duration), 1000 + s.gold);
  let prev = 0;
  for (let t = 0; t <= tl.duration; t += 0.05) { const g = tl.countAt(t); assert.ok(g >= prev); prev = g; }
  assert.equal(tl.shuttleAt(0.5).on, false);
  assert.ok(tl.shuttleAt(1.0).lift > 0 && tl.shuttleAt(1.0).arc === 0);
  assert.ok(tl.shuttleAt(2.5).arc > 0.3 && tl.shuttleAt(3.0).arc === 1);
  assert.equal(tl.drainAt(0), 1);
  assert.equal(tl.drainAt(SELL.drainFor), 0);
});

test('reduced motion keeps the pops and the count-up only; a big sale shares pops but pays every load', () => {
  const loads = Array.from({ length: 30 }, (_, i) => ({ pad: 'r1', item: i % 2 ? 'iron' : 'iron_deep', units: 15, gold: 60 + i }));
  const tl = sellTimeline(loads, { reduced: true });
  assert.deepEqual([...new Set(tl.beats.map((b) => b.type))].sort(), ['count', 'pop']);
  assert.equal(tl.shuttleAt(1.5).on, false);
  assert.ok(tl.pops.length <= MAX_POPS);
  assert.equal(tl.pops.reduce((a, p) => a + p.gold, 0), loads.reduce((a, l) => a + l.gold, 0));
  assert.equal(tl.pops.reduce((a, p) => a + p.loads, 0), 30);
  assert.ok(tl.pops[tl.pops.length - 1].t < SELL.arc[1], 'the stagger ends while the shuttle is still in view');
});

test('pop colours: a dark ore is lifted bright, keeping its hue', () => {
  const c = popColour('#8a4b32');
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  assert.ok(r > 200 && r > g && g > b, `${c} is a light rust`);
  assert.equal(popColour('nope'), '#ffd76a');
});
