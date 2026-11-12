// [MM-story_mwb8zcgz_25] owner 2026-11-10 (tower parity): the defense on the Upgrade Bay looks like the battle's upgrading
// tower — the warm Upgrading tint, with build dust and welding sparks — until its new tier is installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defenseStructures } from './conduits.js';
import { constructionSites } from './constructionFx.js';
import { lifecycleLook } from '../../render3d/structures/models.js';

const T = 1_000_000;
const map = { pads: [{ id: 'p7', x: 10, y: 4, w: 4, h: 4 }] };
// the bay stands at its own spot (S2c.2: model.buildingRect reads `at`); constructionFx.js still reads map.pads (lane K moves it)
const outpost = (upgrading) => ({ pads: { p7: { kind: 'upgradeBay', tier: 1, at: { x: 10, y: 4, w: 4, h: 4 } } }, building: [],
  defenses: [{ id: 'd1', kind: 'cannon', tier: 1, cell: [5, 5], hp: 400 }], upgrading });

test('the defense on the bay is the battle\'s Upgrading tower (the warm tint)', () => {
  const s = defenseStructures(outpost({ id: 'd1', kind: 'cannon', tier: 2, since: T, done: T + 60000 }), map).find((x) => x.outpostId === 'd1');
  assert.equal(s.lifecycle, 'Upgrading');
  assert.equal(lifecycleLook(s).key, 'U');
});

test('the bay throws build dust while the upgrade runs, and stops when it is done', () => {
  const o = outpost({ id: 'd1', kind: 'cannon', tier: 2, since: T, done: T + 60000 });
  const [site] = constructionSites(o, map, T + 15000);
  assert.deepEqual(site.pos, { x: 13, y: 6 });
  assert.equal(site.lifecycle, 'Building');
  assert.ok(Math.abs(site.progress - 0.25) < 1e-9);
  assert.deepEqual(constructionSites(o, map, T + 60000), []);
  assert.deepEqual(constructionSites(outpost(null), map, T), []);
});
