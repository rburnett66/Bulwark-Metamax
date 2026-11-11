// Owner 2026-11-11 playtest of ?outpost=session: "the items were all low detail, and the placement object was 1x1 even
// though structures were 2x2". Free-placed buildings get their model and the ghost covers the footprint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './fixtures.mjs';
import { referenceOutpost } from '../model.js';
import { planBuildings } from './conduits.js';
import { ghostFootprint } from '../../render3d/overlays/placement.js';

test('the placement ghost covers the structure footprint: 2×2 outpost buildings, 3×3 hub, 1×1 battle towers', () => {
  assert.deepEqual(ghostFootprint('OUT-power'), { w: 2, h: 2 });
  assert.deepEqual(ghostFootprint('OUT-storage'), { w: 2, h: 2 });
  assert.deepEqual(ghostFootprint('OUT-hub'), { w: 3, h: 3 });
  assert.deepEqual(ghostFootprint('STR-Cannon'), { w: 1, h: 1 });
  assert.deepEqual(ghostFootprint('no-such-thing'), { w: 1, h: 1 });
});

test('a building placed off the pads is planned with its own rectangle, so the scene draws its model there', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.pads.f1 = { kind: 'storage', tier: 1, at: { x: 5, y: 5, w: 2, h: 2 } };
  o.building.push({ pad: 'f2', kind: 'power', tier: 1, done: T0 + 60_000, at: { x: 9, y: 5, w: 2, h: 2 } });
  const plan = planBuildings(o, map, T0);
  const f1 = plan.find((i) => i.pad === 'f1'), f2 = plan.find((i) => i.pad === 'f2');
  assert.ok(f1 && f1.kind === 'storage', 'a finished free building is drawn');
  assert.deepEqual(f1.rect, { id: 'f1', x: 5, y: 5, w: 2, h: 2 });
  assert.ok(f2 && f2.building, 'a free building under construction is drawn rising');
  const padItems = plan.filter((i) => map.pads.some((p) => p.id === i.pad));
  assert.ok(padItems.length >= 3, 'pad buildings are still drawn');
});

test('the battle placeholder block skips outpost buildings (their model is the outpost scene) and sizes others by footprint', () => {
  const idx = readFileSync(new URL('../../render3d/index.js', import.meta.url), 'utf8');
  assert.match(idx, /s\.kind !== 'building'/);
  const markers = readFileSync(new URL('../../render3d/markers.js', import.meta.url), 'utf8');
  assert.match(markers, /tmp\.scale\.set\(fw, 1, fh\)/);
});
