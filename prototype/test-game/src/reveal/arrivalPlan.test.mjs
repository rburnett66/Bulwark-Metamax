// A capital ship's first-sight arrival [MM-story_mw56ve9g_6]. Capital-Ship-Arrival-Design §3; Content-Reveal §5.2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVAL_BEATS, FIRST_SIGHT_S, FLANK_S, arrivalAt, beatOf } from './arrivalPlan.js';

const box = { min: [-10, -2, -3], max: [10, 3, 3] };
const dist = (o) => Math.hypot(...o.camera.position.map((v, i) => v - o.camera.target[i]));

test('the beat sheet: 22 s of arrival, then the flank pan', () => {
  assert.equal(FIRST_SIGHT_S, 22); assert.equal(FLANK_S, 28);
  assert.deepEqual(ARRIVAL_BEATS.map((b) => b.id), ['contact', 'arrive', 'approach', 'pass', 'brake', 'orbit', 'title', 'flank']);
  for (let i = 1; i < ARRIVAL_BEATS.length; i++) assert.equal(ARRIVAL_BEATS[i].start, ARRIVAL_BEATS[i - 1].end);
  assert.equal(beatOf(9).id, 'pass'); assert.equal(beatOf(99).id, 'flank');
});

test('the approach closes on the ship; the flash peaks at 2 s; engines settle to idle', () => {
  assert.ok(dist(arrivalAt(2, { box })) > dist(arrivalAt(7.9, { box })) * 4, 'far at the flash, close at the end of the approach');
  assert.ok(arrivalAt(2, { box }).flash > 0.95); assert.equal(arrivalAt(6, { box }).flash, 0);
  assert.equal(arrivalAt(5, { box }).engine, 2);
  assert.ok(Math.abs(arrivalAt(20, { box }).engine - 0.35) < 1e-6);
});

test('the plate during the braking burn, the title card and commit at 18 s', () => {
  assert.ok(arrivalAt(13, { box }).plate > 0.9);
  assert.ok(arrivalAt(20, { box }).title > 0.9);
  assert.equal(arrivalAt(17.9, { box }).commit, false); assert.equal(arrivalAt(18, { box }).commit, true);
});

test('the flank: abeam the starboard side, level, the camera on +Z', () => {
  const o = arrivalAt(28, { box });
  assert.ok(o.camera.position[2] > box.max[2]);
  assert.ok(Math.abs(o.camera.position[1] - o.camera.target[1]) < 0.2, 'level');
  for (const v of o.camera.position.concat(o.camera.target)) assert.ok(Number.isFinite(v));
});

test('reduced motion holds each beat at its settled pose and never flashes', () => {
  const a = arrivalAt(4, { box, reduced: true }), b = arrivalAt(7, { box, reduced: true });
  assert.deepEqual(a.camera, b.camera);
  assert.equal(arrivalAt(2, { box, reduced: true }).flash, 0);
});
