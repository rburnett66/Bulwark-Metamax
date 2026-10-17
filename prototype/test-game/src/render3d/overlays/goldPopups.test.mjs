// [MM-task_mvbyf6t8_z] "$N" per kill with the real bounty, choreographed after the blast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoldPopups, POP } from './goldPopups.js';

test('a kill pops "$N" with its exact income after the blast flash, overshoots, rises and fades', () => {
  const g = createGoldPopups();
  g.feed([{ type: 'kill', income: 500, pos: { x: 4, y: 6 } }, { type: 'kill', income: 0, pos: { x: 1, y: 1 } }]);
  assert.equal(g.live.length, 1, 'defender deaths (no income) pop nothing');
  assert.equal(g.live[0].text, '$500');
  g.step(POP.delay * 0.5); assert.equal(g.live[0].alpha, 0, 'waits for the blast');
  let peak = 0, y0 = null;
  for (let t = 0; t < 0.35; t += 1 / 60) { g.step(1 / 60); peak = Math.max(peak, g.live[0].scale); if (y0 === null && g.live[0].alpha > 0) y0 = g.live[0].y; }
  assert.ok(peak > 1.2, `pops with overshoot (${peak.toFixed(2)})`);
  assert.ok(Math.abs(g.live[0].scale - 1.18) < 1e-6 || Math.abs(g.live[0].scale - 1) < 1e-6, 'settles');
  for (let t = 0; t < 0.8; t += 1 / 60) g.step(1 / 60);
  assert.ok(g.live[0].y > y0 + 0.5, 'rises');
  for (let t = 0; t < 1; t += 1 / 60) g.step(1 / 60);
  assert.equal(g.live.length, 0, 'gone after its life');
});

test('kills in one spot stack instead of overprinting; deliveries pop at the base in the crystal colour', () => {
  const g = createGoldPopups();
  g.feed([{ type: 'kill', income: 120, pos: { x: 4, y: 6 } }, { type: 'kill', income: 1500, pos: { x: 4.2, y: 6 } }]);
  assert.ok(g.live[1].y0 > g.live[0].y0, 'stacked');
  assert.equal(g.live[1].text, '$1,500');
  g.feed([{ type: 'deposit', gold: 80, color: 'blue' }], { base: { x: 10, y: 10 } });
  assert.deepEqual([g.live[2].x, g.live[2].z, g.live[2].text], [10.5, 10.5, '$80']);
  assert.ok(g.live[2].color);
});
