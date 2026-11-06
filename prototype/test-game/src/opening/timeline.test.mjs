// [MM-story_mw47lhgr_4] The opening as a pure function of time: beats in order, the camera ends on a level side view
// with the bow on the right, the ship never pops into frame, reduced motion holds still poses, skip lands on the bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BEATS, BUILT_UNTIL, SHIP_UNTIL, ROOMS, OPEN, beatAt, skipTarget, openingAt, roomsAt } from './timeline.js';
import { lensFov } from '../render3d/ships/shots.js';

const BOX = { min: [-10.5, -1.2, -1.6], max: [11, 3.6, 1.6] };   // the Collective GLB's rough box
const L = 21.5;

// project a world point for a camera {position, target, fov} at an aspect → [x, y] in NDC, z>0 = in front
function project(cam, p, aspect) {
  const f = norm(sub(cam.target, cam.position)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const d = sub(p, cam.position), z = dot(d, f);
  const ty = Math.tan((cam.fov * Math.PI) / 360), tx = ty * aspect;
  return [dot(d, r) / (z * tx), dot(d, u) / (z * ty), z];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

test('beats are contiguous and in the design order; beatAt finds each', () => {
  assert.deepEqual(BEATS.map((b) => b.id), ['cold', 'star', 'flyby', 'flank', 'open', 'life', 'patron', 'bar', 'talk']);
  for (let i = 1; i < BEATS.length; i++) assert.equal(BEATS[i].start, BEATS[i - 1].end, BEATS[i].id + ' follows on');
  for (const b of BEATS) assert.equal(beatAt(b.start + 0.01).beat, b.id);
  assert.equal(SHIP_UNTIL, 40);
  assert.equal(BUILT_UNTIL, BEATS.find((b) => b.id === 'talk').start);
});

test('the opening is deterministic and smooth: no camera jump bigger than the ship moves', () => {
  let prev = null;
  for (let t = 0; t <= BUILT_UNTIL; t += 1 / 30) {
    const a = openingAt(t, { box: BOX }), b = openingAt(t, { box: BOX });
    assert.deepEqual(a, b, 'same t → same frame');
    if (prev) {
      const jump = Math.hypot(...sub(a.camera.position, prev.camera.position));
      assert.ok(jump < L * 0.05, `camera moves smoothly at ${t.toFixed(2)} s (${jump.toFixed(3)})`);
      assert.ok(Math.abs(a.camera.fov - prev.camera.fov) < 0.2, 'lens changes smoothly');
    }
    prev = a;
  }
});

test('the ship never pops in: while hidden it is out of frame, and it crosses the star\'s face', () => {
  const A = 16 / 9;
  for (let t = 13.9; t <= 16; t += 0.05) {
    const o = openingAt(t, { box: BOX, aspect: A });
    const bow = [BOX.max[0] + o.ship.x, 0, 0];
    const [x] = project(o.camera, bow, A);
    if (t < 14) assert.ok(x < -1, 'off the left edge before it is shown');
    if (t < 14.5) assert.ok(x < -0.95, 'enters from the left, not mid-frame');
  }
  const o = openingAt(24, { box: BOX, aspect: A });
  const sx = project(o.camera, [o.ship.x, 0, 0], A), st = project(o.camera, o.star.position, A);
  const starNdcR = (o.star.radius / st[2]) / Math.tan((o.camera.fov * Math.PI) / 360);
  assert.ok(Math.hypot((sx[0] - st[0]) * A, sx[1] - st[1]) < starNdcR, 'mid fly-by the ship is in front of the star\'s disc');
});

test('the flank: level, side-on from starboard, bow on the right, the ship filling ~85 % of the width', () => {
  const A = 16 / 9, o = openingAt(SHIP_UNTIL, { box: BOX, aspect: A });
  assert.equal(o.beat, 'open');
  const c = o.camera;
  assert.ok(Math.abs(c.position[1] - c.target[1]) < L * 0.02, 'level');
  assert.ok(Math.abs(c.position[0] - c.target[0]) < 1e-6 && c.position[2] > BOX.max[2], 'abeam on the starboard side');
  assert.ok(Math.abs(c.fov - lensFov(OPEN.lensFlank, A)) < 1e-6, 'the flank lens');
  const bow = project(c, [BOX.max[0] + o.ship.x, 0, 0], A), stern = project(c, [BOX.min[0] + o.ship.x, 0, 0], A);
  assert.ok(bow[0] > stern[0], 'bow on the right');
  const span = (bow[0] - stern[0]) / 2;
  assert.ok(span > 0.78 && span < 0.92, `ship spans ${(span * 100).toFixed(0)} % of the width`);
  const P = openingAt(SHIP_UNTIL, { box: BOX, aspect: 9 / 19.5 }).camera;
  assert.ok(P.position[2] < c.position[2], 'portrait frames closer (the bar\'s side of the ship)');
});

test('the cold open: black, the caption, then the star fades up; engines idle until the ship appears', () => {
  const o0 = openingAt(0.5, { box: BOX });
  assert.equal(o0.beat, 'cold'); assert.equal(o0.fade, 0); assert.ok(o0.caption.alpha > 0);
  assert.equal(openingAt(5, { box: BOX }).fade, 1);
  assert.equal(openingAt(5, { box: BOX }).ship.visible, false);
  assert.equal(openingAt(15, { box: BOX }).engine, 1);
  assert.ok(openingAt(15, { box: BOX }).tugs);
});

test('reduced motion: one still pose per beat, with a dip at each beat boundary instead of camera moves', () => {
  const a = openingAt(16, { box: BOX, reduced: true }), b = openingAt(28, { box: BOX, reduced: true });
  assert.deepEqual(a.camera, b.camera, 'the camera holds within a beat');
  assert.ok(openingAt(30.05, { box: BOX, reduced: true }).fade < 0.5, 'beats meet through a dip');
});

test('skip: from the flank on, a first-run skip lands on the highlighted bar', () => {
  assert.equal(skipTarget(10), null);
  assert.equal(skipTarget(31), BEATS.find((b) => b.id === 'bar').start);
});

// [MM-story_mw4d1bsw_q] Beats 4–8 over the room view drawn from primitives.
test('the hull opens: the scan wipe runs left to right in beat 4, then the 3D shot stops', () => {
  assert.equal(roomsAt(40.5).scan, 0);
  const mid = roomsAt((ROOMS.scan[0] + ROOMS.scan[1]) / 2).scan;
  assert.ok(mid > 0.3 && mid < 0.7);
  assert.equal(roomsAt(46).scan, 1);
  assert.equal(roomsAt(46).show3d, false);
  assert.deepEqual(openingAt(50, { box: BOX }).camera, openingAt(SHIP_UNTIL, { box: BOX }).camera, 'the 3D camera holds the flank');
  assert.equal(openingAt(50, { box: BOX }).beat, 'life');
});

test('the patron flashes twice at no more than 3 Hz, then the bar is highlighted and the rest dim', () => {
  let rises = 0, prev = 0, peak = 0;
  for (let t = 55; t < 60; t += 1 / 120) {
    const f = roomsAt(t).flash;
    if (f > 0.95 && prev <= 0.95) rises++;
    prev = f; peak = Math.max(peak, f);
  }
  assert.equal(rises, 2, 'two gold pulses');
  assert.ok(ROOMS.pulses[1] - ROOMS.pulses[0] >= 1 / 3, 'pulses at most 3 a second');
  assert.equal(roomsAt(55).flash, 0);
  assert.deepEqual(roomsAt(57.5).focus, { room: 'bar', fill: ROOMS.patronFill });
  assert.equal(roomsAt(59).dim, 0);
  assert.equal(roomsAt(61).dim, 1); assert.equal(roomsAt(61).highlight, 1);
  assert.equal(roomsAt(60.3).prompt, 'name'); assert.equal(roomsAt(61.5).prompt, 'tap');
  assert.equal(roomsAt(65).enter, false); assert.equal(roomsAt(ROOMS.autoEnter).enter, true);
  assert.equal(openingAt(70, { box: BOX }).beat, 'talk');
});

test('reduced motion in the room view: a cut instead of the wipe, a steady glow instead of pulses', () => {
  const s = [];
  for (let t = 40; t < 47; t += 0.1) s.push(roomsAt(t, true).scan);
  assert.ok(s.every((v) => v === 0 || v === 1), 'no partial wipe');
  for (let t = 56.5; t < 60; t += 0.05) assert.equal(roomsAt(t, true).flash, 1);
});
