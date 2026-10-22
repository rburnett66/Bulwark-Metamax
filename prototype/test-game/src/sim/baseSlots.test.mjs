// src/sim/baseSlots.test.mjs — [MM-task_mvivnkw1_a] a unit's base ring slot survives the ring SHRINKING.
// Owner 2026-10-21 (Pages build, campaign 2): "Cannot read properties of undefined (reading 'x') at stepMovement".
// baseTargetFor() takes `unit.id % slots.length` once; recomputeUnitPaths() rebuilds the ring when structures
// change, and a tower beside the base removes ring cells — the stored index then pointed past the end. node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';

/** A walker 4.5 cells from the base (inside the 5-cell final-approach radius), with its ring slot already taken. */
function walkerNearBase() {
  const state = createSim(4242, { waves: [], map: MAP });
  const u = createUnit(state, 'GND-Troops', 1, { x: MAP.base.x - 4.5, y: MAP.base.y }, 'ground', 'attacker');
  state.units.set(u.id, u);
  stepSim(state, FIXED_DT);                       // assigns the slot against the full ring
  return { state, unit: u };
}

test('a ring slot index taken on a longer ring still resolves after the ring shrinks', () => {
  const { state, unit } = walkerNearBase();
  const ring = state.base._attackSlots;
  assert.ok(ring && ring.length > 2, `fixture: the base has a ring of slots (${ring && ring.length})`);
  unit._baseSlotIdx = ring.length - 1;            // the LAST slot of the full ring
  state.base._attackSlots = ring.slice(0, 2);     // ring rebuilt after a tower went up beside the base: 2 slots left
  assert.doesNotThrow(() => { for (let i = 0; i < 30; i++) stepSim(state, FIXED_DT); });
  const last = unit.path[unit.path.length - 1];
  assert.ok(state.base._attackSlots.some((s) => s.x === last.x && s.y === last.y) || unit.state === 'attacking',
    'the walker heads for a slot that exists on the new ring');
});

test('the shrunk-ring wrap is deterministic: two identical runs end in the same place', () => {
  const run = () => {
    const { state, unit } = walkerNearBase();
    unit._baseSlotIdx = state.base._attackSlots.length - 1;
    state.base._attackSlots = state.base._attackSlots.slice(0, 2);
    for (let i = 0; i < 60; i++) stepSim(state, FIXED_DT);
    return [unit.pos.x, unit.pos.y];
  };
  assert.deepEqual(run(), run());
});
