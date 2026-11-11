// Owner 2026-11-10 [MM-story_mwbdaa9o_29]: the selected harvester's cargo reads in whole numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargoText } from './hud.js';

test('cargo: whole units held over a whole capacity', () => {
  assert.equal(cargoText({ cargo: 7.999999, capacity: 13.200000000000001 }), '7 / 13');
  assert.equal(cargoText({ cargo: 0, capacity: 16.5 }), '0 / 17');
  assert.equal(cargoText({}), '0 / 0');
});
