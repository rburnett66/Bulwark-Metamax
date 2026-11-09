// A harvester working a resource field must stay selectable [MM-task_mw6prs97_7].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harvesterTapTarget, nextHarvesterId } from './input.js';

const unit = (id, x, y, extra = {}) => [id, { id, hp: 100, radius: 0.4, pos: { x, y }, ...extra }];
const state = (...us) => ({ units: new Map(us) });

test('a tap on a truck standing on a field picks the truck', () => {
  const s = state(unit(7, 10, 5, { isHarvester: true }));
  assert.equal(harvesterTapTarget(s, { x: 10, y: 5 }), 7);
});

test('a tap a cell away from the truck still reaches the field', () => {
  const s = state(unit(7, 10, 5, { isHarvester: true }));
  assert.equal(harvesterTapTarget(s, { x: 11, y: 5 }), null);
});

test('the selected truck falls through, so tapping the field it stands on still orders it', () => {
  const s = state(unit(7, 10, 5, { isHarvester: true }));
  assert.equal(harvesterTapTarget(s, { x: 10, y: 5 }, 7), null);
});

test('a second truck on the field is picked even while another truck is selected', () => {
  const s = state(unit(7, 3, 3, { isHarvester: true }), unit(8, 10, 5, { isHarvester: true }));
  assert.equal(harvesterTapTarget(s, { x: 10, y: 5 }, 7), 8);
});

test('only live harvesters count; the nearest wins', () => {
  const s = state(unit(1, 10, 5), unit(2, 10, 5, { isHarvester: true, hp: 0 }), unit(3, 10.5, 5, { isHarvester: true }), unit(4, 10.1, 5, { isHarvester: true }));
  assert.equal(harvesterTapTarget(s, { x: 10, y: 5 }), 4);
});

// NEXT on the harvester panel (owner 2026-11-09) [MM-task_mw9uxqwx_6]
test('NEXT cycles through the live harvesters in fleet order and wraps round', () => {
  const units = new Map([[1, { id: 1, isHarvester: true, hp: 10 }], [2, { id: 2, isHarvester: false, hp: 10 }], [3, { id: 3, isHarvester: true, hp: 0 }], [4, { id: 4, isHarvester: true, hp: 5 }], [5, { id: 5, isHarvester: true, hp: 5 }]]);
  const state = { units, harvesterIds: [1, 3, 4, 5] };
  assert.equal(nextHarvesterId(state, 1), 4, 'skips the dead one');
  assert.equal(nextHarvesterId(state, 4), 5);
  assert.equal(nextHarvesterId(state, 5), 1, 'wraps round');
  assert.equal(nextHarvesterId(state, null), 1, 'nothing selected: the first');
  assert.equal(nextHarvesterId({ units: new Map([[1, units.get(1)]]), harvesterIds: [1] }, 1), null, 'only one: nothing to go to');
});
