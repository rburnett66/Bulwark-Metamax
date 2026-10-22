// src/render3d/fx/trackMarks.test.mjs — [MM-task_mvj0wz2d_1] wheel / tread marks: who leaves them, how far back they
// reach (≈ 5 of the vehicle's lengths) and how fast they fade (5 s). node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { UNIT_MODELS } from '../units/models.js';
import { UNIT_SCALE } from '../units/modelKeys.js';
import { TRACKS, trackSpecFor, trackSpecs, createTrackMarks } from './trackMarks.js';
import { createTrackMarksView } from './trackMarksView.js';

const specs = trackSpecs(UNIT_MODELS);

test('every model is classified from its parts: tracked vehicles tread, wheeled scouts wheel, flyers and hover none', () => {
  for (const k of ['tank', 'tiger', 'air_tank', 'siege_heavy', 'arcane_tank', 'space_heavy', 'dark_artillery']) assert.equal(specs[k] && specs[k].kind, 'tread', k);
  for (const k of ['buggy', 'air_scout', 'siege_scout', 'arcane_scout', 'space_scout', 'dark_scout']) assert.equal(specs[k] && specs[k].kind, 'wheel', k);
  for (const [k, def] of Object.entries(UNIT_MODELS)) if (def.hover) assert.equal(specs[k], null, `${k} hovers — no marks`);
  for (const [k, s] of Object.entries(specs)) if (s) {
    assert.ok(s.gauge > 0.3 && s.gauge < 2, `${k} gauge ${s.gauge}`);
    assert.ok(s.width > 0.05 && s.width < 1, `${k} width ${s.width}`);
    assert.ok(s.length > 2 && s.length < 9, `${k} length ${s.length}`);
  }
  assert.equal(trackSpecFor({ parts: [{ t: 'box', s: [1, 1, 1] }] }), null, 'a plain box leaves nothing');
});

/** Drive one vehicle in a straight line along +x at `speed` cells/s for `secs`, at 30 fps. */
function drive(marks, { model = 'tank', speed = 1, secs = 1, x0 = 0, id = 1, y = 0 } = {}) {
  const dt = 1 / 30;
  let x = x0;
  for (let t = 0; t < secs; t += dt) { x += speed * dt; marks.step(dt, [{ id, model, x, z: 5, y, heading: 0, scale: 1 }]); }
  return x;
}

test('a moving tank lays two parallel strips at its track gauge, behind it', () => {
  const m = createTrackMarks(specs);
  const x = drive(m, { secs: 1 });
  const list = m.instances();
  assert.ok(list.length >= 10, `marks laid: ${list.length}`);
  const g = specs.tank.gauge * UNIT_SCALE;
  const zs = [...new Set(list.map((q) => q.z.toFixed(4)))].map(Number).sort();
  assert.deepEqual(zs.map((z) => +(z - 5).toFixed(3)), [-g, g].map((v) => +v.toFixed(3)), 'two strips, one per track');
  assert.ok(list.every((q) => q.x <= x + 1e-9 && q.kind === 'tread'), 'all behind it, all tread');
});

test('marks fade away within 5 seconds once the vehicle stops', () => {
  const m = createTrackMarks(specs);
  drive(m, { secs: 1 });
  const fresh = m.instances();
  const a0 = Math.max(...fresh.map((q) => q.alpha));
  drive(m, { speed: 0, secs: 2.5 });                              // parked: no new marks, old ones fading
  const mid = m.instances();
  assert.ok(mid.length > 0 && Math.max(...mid.map((q) => q.alpha)) < a0 * 0.75, 'half-faded after 2.5 s');
  drive(m, { speed: 0, secs: 2.6 });
  assert.equal(m.instances().length, 0, 'gone after 5 s');
  assert.equal(m.count, 0);
});

test('a trail reaches back about 5 of the vehicle\'s own lengths, the tail fading out', () => {
  const m = createTrackMarks(specs);
  const x = drive(m, { speed: 2.5, secs: 4 });                    // 10 cells: well past the reach
  const reach = specs.tank.length * UNIT_SCALE * TRACKS.lengths;
  const list = m.instances();
  const back = x - Math.min(...list.map((q) => q.x));
  assert.ok(back <= reach + TRACKS.spacing * 2 && back > reach * 0.8, `trail ${back.toFixed(2)} cells vs reach ${reach.toFixed(2)}`);
  const tail = list.reduce((a, q) => (q.x < a.x ? q : a)), head = list.reduce((a, q) => (q.x > a.x ? q : a));
  assert.ok(tail.alpha < head.alpha * 0.5, 'the far end has faded');
  // a longer vehicle reaches further
  const m2 = createTrackMarks(specs);
  const x2 = drive(m2, { model: 'tiger', speed: 2.5, secs: 4 });
  assert.ok(x2 - Math.min(...m2.instances().map((q) => q.x)) > back, 'the long tiger leaves a longer trail');
});

test('no marks while standing still, in the air, from a flyer, or on water', () => {
  const still = createTrackMarks(specs); drive(still, { speed: 0, secs: 2 });
  assert.equal(still.count, 0, 'standing still');
  const air = createTrackMarks(specs); drive(air, { y: 1.2, secs: 2 });
  assert.equal(air.count, 0, 'airborne');
  const jet = createTrackMarks(specs); drive(jet, { model: 'jet', secs: 2 });
  assert.equal(jet.count, 0, 'a jet');
  const wet = createTrackMarks(specs, { isWater: (x) => x > 0.5 && x < 1.5 });
  drive(wet, { secs: 2 });
  assert.ok(wet.count > 0 && wet.instances().every((q) => q.x <= 0.5 || q.x >= 1.5), 'nothing laid over water');
});

test('the cap holds the oldest marks out, and the view draws exactly what the planner gives it', () => {
  const m = createTrackMarks(specs, { cap: 40 });
  for (let id = 1; id <= 6; id++) drive(m, { id, secs: 1, x0: id * 3 });
  assert.ok(m.count <= 40, `count ${m.count}`);
  const scene = new THREE.Scene(), view = createTrackMarksView(THREE, scene, { cap: 40 });
  const list = m.instances();
  assert.equal(view.sync(list), list.length);
  assert.equal(view.mesh.count, list.length);
  const M = new THREE.Matrix4(), P = new THREE.Vector3();
  view.mesh.getMatrixAt(0, M); P.setFromMatrixPosition(M);
  assert.ok(Math.abs(P.x - list[0].x) < 1e-6 && Math.abs(P.z - list[0].z) < 1e-6 && P.y > 0 && P.y < 0.05, 'placed on the ground at the mark');
  view.sync([]); assert.equal(view.mesh.visible, false);
  view.dispose();
});
