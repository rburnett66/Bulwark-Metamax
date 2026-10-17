// [MM-story_mvbyf8gq_10] the 3 s unload reads: a ring fills over the unload, flashes on delivery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnloads } from './unloadFx.js';

test('unloadStart starts a ring that fills over dur, follows the harvester, flashes on deposit, clears', () => {
  const u = createUnloads();
  const state = { units: new Map([[5, { pos: { x: 3, y: 4 } }]]) };
  u.feed([{ type: 'unloadStart', id: 5, pos: { x: 3, y: 4 }, dur: 3, color: 'yellow', gold: 120 }], state);
  assert.equal(u.live.length, 1);
  for (let t = 0; t < 1.5; t += 0.1) u.step(0.1, state);
  assert.ok(Math.abs(u.live[0].t / u.live[0].dur - 0.5) < 0.05, 'half full at half time');
  u.feed([{ type: 'deposit', id: 5, gold: 120 }], state);
  assert.ok(u.live[0].done > 0, 'delivery flash');
  for (let t = 0; t < 0.6; t += 0.1) u.step(0.1, state);
  assert.equal(u.live.length, 0);
});

test('a harvester that dies mid-unload drops its ring (nothing delivered)', () => {
  const u = createUnloads();
  const state = { units: new Map([[5, { pos: { x: 3, y: 4 } }]]) };
  u.feed([{ type: 'unloadStart', id: 5, pos: { x: 3, y: 4 }, dur: 3 }], state);
  state.units.delete(5);
  u.step(0.1, state);
  assert.equal(u.live.length, 0);
});
