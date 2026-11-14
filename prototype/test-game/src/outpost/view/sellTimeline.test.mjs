// The SELL timeline (restored after S6 deleted it with the old farm view) [MM-story_mwefm2or_j] [MM-story_mw5oeer7_n]:
// from sell()'s per-load entries — the beats, the "$N" pops per load in the ore colour, the gold count-up, the shuttle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sellTimeline, SELL, MAX_POPS, popColour, FLIGHT, RETURN, flightPath } from './sellTimeline.js';
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
  assert.ok(tl.shuttleAt(1.0).y > 0 && tl.shuttleAt(1.0).fwd === 0 && tl.shuttleAt(1.0).spin === 0, 'lifting, facing the player');
  assert.ok(tl.shuttleAt(3.6).fwd > 0 && tl.shuttleAt(3.6).y > tl.shuttleAt(2.6).y, 'climbing away');
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

// Owner 2026-11-13 [MM-story_mwf8j7jg_6]: "the transport ship on the outpost should face towards the player when it takes
// off, then spin in the air and ascend. Then the transport should return on the exact same path moments later." · "when
// the transport spins it should slightly tilt in the direction it is spinning. if it turns left it should lean left"
test('the transport: lifts facing the player, spins banked into the turn, climbs away, and returns down the same path', () => {
  const tl = sellTimeline([{ pad: 'r1', item: 'iron', units: 15, gold: 100 }]);
  const at = (t) => tl.shuttleAt(t);
  // lift: straight up, facing the player (spin 0), no bank
  const lift = at((SELL.lift + FLIGHT.spin[0]) / 2);
  assert.ok(lift.on && lift.y > 0 && lift.spin === 0 && lift.bank === 0 && lift.fwd === 0);
  // the spin: in the air, rising, turning left (spin rising), leaning left (negative bank), most at the fastest turn
  const mid = at((FLIGHT.spin[0] + FLIGHT.spin[1]) / 2), early = at(FLIGHT.spin[0] + 0.15);
  assert.ok(mid.spin > 0.4 && mid.spin < 0.6 && mid.y > lift.y && mid.fwd === 0);
  assert.ok(mid.bank < 0 && Math.abs(mid.bank - -FLIGHT.bank) < 1e-9, 'leans left at the fastest left turn: ' + mid.bank);
  assert.ok(early.bank < 0 && early.bank > mid.bank, 'a slighter lean as the turn starts');
  assert.equal(at(FLIGHT.spin[1] + 0.05).bank, 0, 'level again once the turn is done');
  // gone, then back
  assert.equal(at(SELL.arc[1] + FLIGHT.away / 2).on, false, 'out of sight for a moment');
  assert.ok(RETURN[0] > SELL.arc[1] && Math.abs((RETURN[1] - RETURN[0]) - (SELL.arc[1] - SELL.lift)) < 1e-9);
  // the exact same path down, but facing the player all the way: no turn, no lean (owner 2026-11-14 [MM-task_mwftv457_1d])
  for (let k = 0.02; k < 1; k += 0.07) {
    const out = at(SELL.lift + k * (SELL.arc[1] - SELL.lift)), back = at(RETURN[1] - k * (RETURN[1] - RETURN[0]));
    for (const f of ['y', 'fwd', 'pitch']) assert.ok(Math.abs(out[f] - back[f]) < 1e-9, f + ' at ' + k.toFixed(2));
    assert.ok(back.on && back.back && back.spin === 0 && back.turn === 0 && back.bank === 0, 'comes back facing the player, no spin');
  }
  assert.equal(at(RETURN[1] + 0.01).on, false, 'landed: the parked shuttle is back');
  assert.ok(tl.duration >= RETURN[1], 'the sale lasts until it has landed');
  assert.deepEqual(flightPath(SELL.lift), { y: 0, fwd: 0, spin: 0, turn: 0, pitch: 0 }, 'it starts and ends on the pad, as parked');
});

// Owner 2026-11-14 [MM-task_mwftv457_1d]: "it should only spin 180 slowly, right now it seems to spin 540" · "The ship is
// facing me at take off, it should turn 180 and fly away. When it comes back it is already facing and will just land."
test('the transport turns 180° once, from the parked heading, and never on the way back', () => {
  const tl = sellTimeline([{ pad: 'r1', item: 'iron', units: 15, gold: 100 }]);
  assert.equal(FLIGHT.spinBy, Math.PI);
  let total = 0, prev = null;
  const times = Array.from({ length: 171 }, (_, i) => SELL.lift + (SELL.arc[1] - SELL.lift) * i / 170);   // lift-off to out of sight
  for (const t of times) { const y = tl.shuttleAt(t).spin * FLIGHT.spinBy; if (prev != null) total += Math.abs(y - prev); prev = y; }
  assert.ok(Math.abs(total - Math.PI) < 1e-6, 'turns 180° leaving, not ' + (total * 180 / Math.PI).toFixed(0) + '°');
  assert.equal(tl.shuttleAt(SELL.lift + 0.3).spin, 0, 'takes off facing the player, as parked');
  assert.equal(tl.shuttleAt(SELL.arc[1]).spin, 1, 'flies away turned 180°');
  for (let t = RETURN[0] + 0.01; t < RETURN[1]; t += 0.1) assert.equal(tl.shuttleAt(t).spin, 0, 'comes back facing the player at ' + t.toFixed(2));
  const scene = readFileSync(new URL('./outpostScene.js', import.meta.url), 'utf8');
  assert.match(scene, /rotation\.set\(-f\.pitch, B\.park \+ f\.spin \* FLIGHT\.spinBy,/, 'yaw = the parked heading + the 180° turn');
  assert.match(scene, /transformDirection\(parked\[0\]\.matrixWorld\)/, "the parked shuttle's own heading: no snap at lift-off or landing");
});
