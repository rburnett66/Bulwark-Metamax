// A harvester working a resource field must stay selectable [MM-task_mw6prs97_7].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harvesterTapTarget } from './input.js';

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
