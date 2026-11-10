// [MM-story_mwb10lqu_1x] owner 2026-11-10: the error UX is hidden from players; ?debug=1 shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { debugOn, mountReportChip } from './reportPanel.js';

const docAt = (search) => ({ defaultView: { location: { search } } });

test('?debug=1 turns the error UX on; anything else leaves it off', () => {
  assert.equal(debugOn(docAt('')), false);
  assert.equal(debugOn(docAt('?seed=4')), false);
  assert.equal(debugOn(docAt('?debug=0')), false);
  assert.equal(debugOn(docAt('?debug=10')), false);
  assert.equal(debugOn(docAt('?debug=1')), true);
  assert.equal(debugOn(docAt('?seed=4&debug=1')), true);
  assert.equal(debugOn(null), false);
});

test('the report chip is not mounted for a player (no ?debug=1)', () => {
  assert.equal(mountReportChip(docAt('')), null);
});
