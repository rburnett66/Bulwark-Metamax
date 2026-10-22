// src/render3d/fx/wakes.test.mjs — [MM-task_mvj9o97b_7] water units crossing water leave a simple wake. node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { WAKE, createWakes } from './wakes.js';
import { createWakesView } from './wakesView.js';

const pond = (x) => x >= 2 && x < 6;                       // a pond spanning x ∈ [2, 6)
const mk = (opts = {}) => createWakes({ isWater: (x) => pond(x), isWaterUnit: (v) => v.domain === 'Swimmer', ...opts });
/** Move a unit along +x at `speed` cells/s for `secs` at 30 fps. */
function sail(w, { x0 = 0, speed = 1, secs = 1, domain = 'Swimmer', id = 1, y = 0 } = {}) {
  let x = x0;
  for (let t = 0; t < secs - 1e-9; t += 1 / 30) { x += speed / 30; w.step(1 / 30, [{ id, x, z: 5, y, heading: 0, scale: 1, domain }]); }
  return x;
}

test('a water unit moving over water sheds a V of ripples plus a stern patch, behind it', () => {
  const w = mk();
  const x = sail(w, { x0: 2.2, speed: 1, secs: 2 });          // stays inside the pond
  const list = w.instances();
  assert.ok(list.length > 20, `ripples: ${list.length}`);
  assert.ok(list.some((r) => r.kind === 'arm') && list.some((r) => r.kind === 'patch'));
  assert.ok(list.every((r) => r.x < x), 'all behind the unit');
  const arms = list.filter((r) => r.kind === 'arm');
  assert.ok(arms.some((r) => r.z < 5) && arms.some((r) => r.z > 5), 'two arms, one each side');
  // older arm ripples have spread further from the track and grown
  const old = arms.reduce((a, r) => (r.alpha < a.alpha ? r : a)), young = arms.reduce((a, r) => (r.alpha > a.alpha ? r : a));
  assert.ok(Math.abs(old.z - 5) > Math.abs(young.z - 5) && old.size > young.size, 'arms spread and grow as they fade');
});

test('no wake on land, standing still, in the air, or from a ground unit', () => {
  const land = mk(); sail(land, { x0: 7, secs: 2 }); assert.equal(land.count, 0, 'on land');
  const still = mk(); sail(still, { x0: 3, speed: 0, secs: 2 }); assert.equal(still.count, 0, 'standing still');
  const air = mk(); sail(air, { x0: 2.2, secs: 2, y: 1.2 }); assert.equal(air.count, 0, 'airborne');
  const walker = mk(); sail(walker, { x0: 2.2, secs: 2, domain: 'Walker' }); assert.equal(walker.count, 0, 'ground units only wade');
});

test('the wake starts at the shore and stops at the far shore', () => {
  const w = mk();
  sail(w, { x0: 0, speed: 2, secs: 4 });                    // land → pond → land
  const xs = w.instances().map((r) => r.x);
  assert.ok(xs.length > 0, 'it crossed the pond');
  assert.ok(Math.min(...xs) > 2 - 0.6 && Math.max(...xs) < 6 + 0.6, `wake stays on the pond (x ${Math.min(...xs).toFixed(2)}..${Math.max(...xs).toFixed(2)})`);
});

test('ripples fade out within their life, and the cap holds', () => {
  const w = mk();
  sail(w, { x0: 2.2, secs: 1 });
  sail(w, { x0: 3.2, speed: 0, secs: WAKE.life + 0.1 });
  assert.equal(w.count, 0, 'all faded');
  const capped = mk({ cap: 30 });
  for (let id = 1; id <= 5; id++) sail(capped, { id, x0: 2.1, secs: 1.5 });
  assert.ok(capped.count <= 30, `count ${capped.count}`);
});

test('the view draws exactly what the planner gives it', () => {
  const w = mk(); sail(w, { x0: 2.2, secs: 1 });
  const list = w.instances();
  const view = createWakesView(THREE, new THREE.Scene(), { cap: 400 });
  assert.equal(view.sync(list), list.length);
  const M = new THREE.Matrix4(), P = new THREE.Vector3(); view.mesh.getMatrixAt(0, M); P.setFromMatrixPosition(M);
  assert.ok(Math.abs(P.x - list[0].x) < 1e-6 && P.y > 0 && P.y < 0.05);
  view.sync([]); assert.equal(view.mesh.visible, false);
  view.dispose();
});
