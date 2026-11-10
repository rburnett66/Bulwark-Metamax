// [MM-story_mwb420z3_21] owner 2026-11-10: the outpost's harvesters (seen beyond LOD_DISTANCE) had lost their rotating
// nose cones: a model with lodKeepSpin (the harvester) keeps its spinning parts in the far model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_MODELS } from './models.js';
import { lodDef, isSpin } from './lod.js';

test('the harvester keeps its whole drill in the far model', () => {
  const m = UNIT_MODELS.miner;
  const spin = m.parts.filter(isSpin).length;
  assert.ok(spin > 0, 'the harvester has a drill');
  assert.equal(m.lodKeepSpin, true);
  assert.equal(lodDef(m).parts.filter(isSpin).length, spin);
  assert.ok(lodDef(m).parts.length < m.parts.length, 'other small detail is still dropped');
});

test('only models that opt in keep small spinning parts (rotor units in a wave stay light)', () => {
  for (const [key, def] of Object.entries(UNIT_MODELS)) {
    if (def.lodKeepSpin) continue;
    assert.ok(lodDef(def).parts.length <= def.parts.length, key);
  }
});
