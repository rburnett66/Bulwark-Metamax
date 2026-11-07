import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outpostButtonModel, outpostPlanet } from './outpostButton.js';
import { createOutpost, confirmOnline } from '../outpost/model.js';
import { DRAFT_LAYOUT as map } from '../outpost/draftLayout.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const online = (planet, t = T0) => { const o = confirmOnline(createOutpost(planet, { seed: 7, map, now: t }), map, t).outpost; o.firstRaidAt = null; return o; };

test('locked until a contract makes an outpost', () => {
  const m = outpostButtonModel({ outposts: {} }, 'ground', T0);
  assert.equal(m.locked, true);
  assert.equal(m.dot, false);
});

test('opens the targeted planet, else the newest outpost', () => {
  const save = { outposts: { ground: online('ground', T0), fire: online('fire', T0 + HOUR) } };
  assert.equal(outpostPlanet(save, 'ground'), 'ground');
  assert.equal(outpostPlanet(save, 'water'), 'fire');
});

test('status comes from a copy advanced to now; the save is untouched', () => {
  const o = online('ground');
  const save = { outposts: { ground: o } };
  const before = JSON.stringify(o);
  const fresh = outpostButtonModel(save, 'ground', T0);
  assert.equal(fresh.locked, false);
  assert.equal(fresh.dot, false);
  assert.equal(fresh.hint, 'all quiet');
  const later = outpostButtonModel(save, 'ground', T0 + 3 * 24 * HOUR);
  assert.ok(later.loads > 0);
  assert.equal(later.full, true);
  assert.equal(later.dot, true);
  assert.match(later.hint, /loads ready/);
  assert.match(later.hint, /storage full/);
  assert.match(later.hint, /raids? while away/);
  assert.equal(JSON.stringify(o), before);
});

test('a clock behind the save shows the outpost as saved', () => {
  const save = { outposts: { ground: online('ground') } };
  const m = outpostButtonModel(save, 'ground', T0 - HOUR);
  assert.equal(m.locked, false);
});
