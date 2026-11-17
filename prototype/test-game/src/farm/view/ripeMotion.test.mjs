// Owner 2026-11-16 [MM-task_mwjs94o2_23]: "I want to enhance the crops that are ready to harvest with a small animation."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createFarmLayer, ripePose, RIPE_MOTION } from './farmLayer.js';

const NOW = 1e9;
function farm() {
  const plot = (id, x, extra) => ({ id, x, y: 10, w: 3, h: 3, method: 'traditional', prepDone: 0, crop: 'loam-grain', level: 2, plantedAt: 0, cycle: 2, yieldShare: 1, ...extra });
  return { seed: 77, t: NOW, farm: { plots: {
    p1: plot('p1', 4, { progress: 1, ripeAt: NOW - 1000 }),    // Fruited
    p3: plot('p3', 14, { progress: 0.5, ripeAt: null }),        // growing
  }, buildings: {} } };
}
const layer = (opts = {}) => createFarmLayer(THREE, { scene: new THREE.Scene() }, { map: { width: 40, height: 40 }, ...opts });
const matrices = (L) => {
  const out = new Map();
  L.group.traverse((m) => { if (m.isInstancedMesh) out.set(m.name, Array.from(m.instanceMatrix.array)); });
  return out;
};

test('ripe pose: a small sway that ripples across the field, a bob, a glow pulse — all bounded', () => {
  const M = RIPE_MOTION;
  for (let t = 0; t < 6; t += 0.07) {
    const p = ripePose(t, 3, 7);
    assert.ok(Math.abs(p.rz) <= M.tilt + 1e-9 && Math.abs(p.rx) <= M.tilt);
    assert.ok(p.s >= 1 && p.s <= 1 + M.bob + 1e-9);
    assert.ok(p.glow >= 1 - M.pulse - 1e-9 && p.glow <= 1 + M.pulse + 1e-9);
  }
  assert.notEqual(ripePose(1, 0, 0).rz.toFixed(4), ripePose(1, 2, 0).rz.toFixed(4), 'neighbours are out of step: a ripple, not a lockstep');
});

test('only Fruited plants move; a growing plot stands still; reduced motion keeps every plant still', () => {
  const L = layer();
  L.sync(farm(), NOW);
  assert.ok(L.ripeMoving > 0, 'the Fruited plot moves');
  const a = matrices(L);
  L.update(0.4);
  const b = matrices(L);
  const moved = [...a.keys()].filter((k) => a.get(k).some((v, i) => Math.abs(v - b.get(k)[i]) > 1e-6));
  assert.ok(moved.length > 0);
  assert.ok(moved.every((k) => /ripe|head|crop:/.test(k)), 'only ripe meshes move: ' + moved.join(','));
  const R = layer({ reduced: true });
  R.sync(farm(), NOW);
  const c = matrices(R); R.update(0.4); const d = matrices(R);
  assert.equal(R.ripeMoving, 0);
  for (const k of c.keys()) assert.deepEqual(c.get(k), d.get(k));
});
