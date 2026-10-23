// src/render3d/resources/pulseRing.test.mjs — resource fields pulse a thin expanding ring [MM-task_mvk37bu6_k].
import test from 'node:test';
import assert from 'node:assert/strict';
import { RING, pulseAt, phaseOf, RING_FRAG } from './pulseRing.js';
import { planResources } from './models.js';

test('the ring is thin — a fraction of the old 0.09 band', () => {
  assert.ok(RING.width <= 0.035, `${RING.width}`);
  assert.ok(RING.width < 0.09 / 2);
});

test('it expands from r0 to r1, fading out, then cycles', () => {
  let last = -1;
  for (let t = 0.01; t < RING.period - 0.01; t += 0.05) { const p = pulseAt(t); assert.ok(p.radius > last); last = p.radius; }
  assert.ok(Math.abs(pulseAt(0).radius - RING.r0) < 1e-9);
  assert.ok(pulseAt(RING.period * 0.999).radius > RING.r1 - 0.01);
  assert.ok(pulseAt(RING.period * 0.999).alpha < 0.01, 'gone by the end of the cycle');
  assert.equal(pulseAt(0).alpha, 0, 'fades in from nothing (no pop at the restart)');
  assert.ok(pulseAt(RING.period * 0.15).alpha > 0.5, 'clearly visible early on');
  for (const t of [0.3, 0.9, 1.4]) assert.ok(Math.abs(pulseAt(t).radius - pulseAt(t + RING.period).radius) < 1e-9, 'repeats every period');
});

test('fields get different phases, stably', () => {
  const ph = ['a', 'b', 'c', 'd', 'e', 'f'].map(phaseOf);
  assert.ok(new Set(ph).size >= 5);
  for (const p of ph) assert.ok(p >= 0 && p < 1);
  assert.equal(phaseOf('t1-p3-4-5'), phaseOf('t1-p3-4-5'));
});

test('rings carry the field id (for its phase) and the shader mirrors the constants', () => {
  const plan = planResources([{ id: 'n1', x: 3, y: 4, role: 'primary', color: 'blue', remaining: 5, units: 10, wave: 1 }], 8);
  assert.equal(plan.rings.length, 1);
  assert.equal(plan.rings[0].id, 'n1');
  assert.ok(RING_FRAG.includes(RING.period.toFixed(3)));
  assert.ok(RING_FRAG.includes('uTime'));
});
