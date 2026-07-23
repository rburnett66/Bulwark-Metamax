// src/data/fxScale.test.mjs — map FX tier lookup (owner spec 2026-07-22):
// 3x maps 1-3, 2x maps 4-5, 1x maps 6+; classic/unknown boards neutral. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { fxScaleForMap, projScaleForMap, FX_SCALE_TIERS, PROJ_SCALE_TIERS } from './tables.js';

test('projectile damping runs INVERSE to the FX tiers: 0.5x (1-3), 0.75x (4-5), 1x (6+)', () => {
  assert.equal(projScaleForMap(1), 0.5);
  assert.equal(projScaleForMap(3), 0.5);
  assert.equal(projScaleForMap(4), 0.75);
  assert.equal(projScaleForMap(5), 0.75);
  assert.equal(projScaleForMap(6), 1);
  assert.equal(projScaleForMap(0), 1);
  assert.equal(projScaleForMap(undefined), 1);
  assert.ok(Array.isArray(PROJ_SCALE_TIERS) && PROJ_SCALE_TIERS.length >= 1);
});

test('FX tiers are OFF (owner live verdict: 3x read as 10x under the wave-1 camera zoom)', () => {
  for (const id of [1, 2, 3, 4, 5, 6, 8, 99]) assert.equal(fxScaleForMap(id), 1, 'map ' + id);
});

test('classic board / unknown ids are neutral', () => {
  assert.equal(fxScaleForMap(0), 1);      // classic
  assert.equal(fxScaleForMap(null), 1);
  assert.equal(fxScaleForMap(undefined), 1);
  assert.equal(fxScaleForMap('nope'), 1);
});

test('tier tables are the single tuning point and stay ordered', () => {
  assert.ok(Array.isArray(FX_SCALE_TIERS), 'FX tiers is an array (empty = all 1x)');
  for (let i = 1; i < FX_SCALE_TIERS.length; i++) {
    assert.ok(FX_SCALE_TIERS[i].maxMap > FX_SCALE_TIERS[i - 1].maxMap, 'ascending maxMap');
  }
  for (let i = 1; i < PROJ_SCALE_TIERS.length; i++) {
    assert.ok(PROJ_SCALE_TIERS[i].maxMap > PROJ_SCALE_TIERS[i - 1].maxMap, 'ascending maxMap (proj)');
  }
});
