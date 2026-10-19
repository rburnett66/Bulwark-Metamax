// [MM-story_mvehe3sy_j] the RAH-66X copter and MX-4 drone (owner sheets 2026-10-18) draw for their classes and spin.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { UNIT_MODELS } from './models.js';
import { resolveUnitModel } from './modelKeys.js';
import { createUnits3D } from './models3d.js';

test('copter and Missiles (drone) classes resolve to their own models', () => {
  assert.equal(resolveUnitModel('AIR-Copters', { artClass: 'copter', domain: 'Flyer' }).model, 'copter');
  assert.equal(resolveUnitModel('AIR-Missiles', { artClass: 'missile', domain: 'Flyer' }).model, 'drone');
  assert.equal(Object.keys(UNIT_MODELS.drone.spin).length, 4, 'four ducted fans');
  assert.deepEqual(Object.keys(UNIT_MODELS.copter.spin).sort(), ['spin', 'spin2'], 'main rotor + fenestron');
});

test('rotors turn with the render clock; the body does not', () => {
  const scene = new THREE.Scene(), u3 = createUnits3D(THREE, scene, { cap: 2, sunDir: new THREE.Vector3(-0.5, 0.7, -0.5).normalize() });
  const view = [{ id: 3, model: 'copter', scale: 1, x: 2, y: 1.1, z: 2, heading: 0, aim: 0 }];
  const read = () => scene.children.filter((m) => m.isInstancedMesh && m.count === 1).map((m) => { const M = new THREE.Matrix4(); m.getMatrixAt(0, M); return M.elements.slice(); });
  u3.setUnits(view, 5, false, 0); const a = read();
  u3.setUnits(view, 5, false, 0.05); const b = read();
  const changed = a.filter((e, i) => e.some((v, j) => Math.abs(v - b[i][j]) > 1e-6)).length;
  assert.ok(changed >= 2 && changed < a.length, `rotor groups moved, body still (${changed}/${a.length})`);
  u3.dispose();
});
