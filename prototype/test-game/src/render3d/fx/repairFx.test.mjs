// [MM-task_mvcrs0q1_14] repair sparks: blue-tinted, from the weld point, at a steady rate, a shower on completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepairFx, REPAIR_FX, SPARK_TINT } from './repairFx.js';
import { K } from './impacts.js';

const world = (troopState = 'repairing') => ({
  units: new Map([[7, { id: 7, hp: 10, isRepairTroop: true, state: troopState, repairTargetId: 3, pos: { x: 6, y: 4 } }]]),
  structures: new Map([[3, { id: 3, pos: { x: 4, y: 4 }, footprint: { w: 1, h: 1 } }]]),
});

test('a troop at work sprays repair-tinted sparks from the structure face toward it, at the set rate', () => {
  const fx = createRepairFx(), out = [];
  const emit = (kind, x, y, z, vx, vy, vz, life, size, grow, shade) => out.push({ kind, x, y, z, vx, vy, vz, life, shade });
  for (let i = 0; i < 60; i++) fx.step(1 / 60, world(), [], emit, K);
  const sparks = out.filter((p) => p.kind === K.SPARK);
  assert.ok(Math.abs(sparks.length - REPAIR_FX.rate) <= 1, `~${REPAIR_FX.rate}/s (${sparks.length})`);
  for (const p of sparks) {
    assert.equal(p.shade, SPARK_TINT.repair);
    assert.ok(p.x > 4.5 && p.x < 5.2 && Math.abs(p.z - 4.5) < 1e-9, 'on the face toward the troop');
    assert.ok(p.vy > 0 && p.vx > -0.5, 'up and out');
  }
  assert.ok(out.some((p) => p.kind === K.FLASH && p.shade === SPARK_TINT.repair), 'the blue arc flicker');
});

test('no sparks while marching; a bright shower when the repair completes', () => {
  const fx = createRepairFx(), out = [];
  const emit = (kind) => out.push(kind);
  fx.step(0.1, world('repairMarch'), [], emit, K);
  assert.equal(out.length, 0);
  const st = world('repairMarch');
  fx.step(0.016, st, [{ type: 'build', phase: 'repaired', id: 3 }], emit, K);
  assert.equal(out.filter((k) => k === K.SPARK).length, REPAIR_FX.finish);
});
