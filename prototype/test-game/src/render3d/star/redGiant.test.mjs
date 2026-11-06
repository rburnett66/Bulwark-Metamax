// [MM-story_mw47l791_1] Vesper up close: two draws, boils with dt only, faces the camera, fades with intensity.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createRedGiant } from './redGiant.js';

test('the red giant is two draws (surface + corona card), deterministic in dt, and disposes cleanly', () => {
  for (const tier of ['high', 'standard', 'low']) {
    const s = createRedGiant(THREE, { radius: 50, tier });
    const meshes = []; s.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    assert.equal(meshes.length, 2, tier + ': surface + corona');
    assert.equal(s.card.scale.x, 50, 'the corona card is in radius units');
    assert.ok(s.card.material.depthTest && !s.card.material.depthWrite, 'the sphere hides the card\'s inner half');
    s.dispose();
  }
  const a = createRedGiant(THREE), b = createRedGiant(THREE);
  for (let i = 0; i < 10; i++) { a.update(0.1); b.update(0.1); }
  assert.equal(a.time, b.time); assert.ok(Math.abs(a.time - 1) < 1e-9, 'boils on accumulated dt, no clock');
});

test('the corona card turns to the camera; intensity scales the heat, the glare and the prominences', () => {
  const s = createRedGiant(THREE, { radius: 10 });
  const cam = new THREE.PerspectiveCamera(); cam.position.set(30, 5, 40); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  s.update(0.016, cam);
  assert.ok(s.card.quaternion.angleTo(cam.quaternion) < 1e-6);
  s.setIntensity(0);
  assert.equal(s.surface.material.uniforms.uHeat.value, 0);
  assert.equal(s.card.material.uniforms.uGlare.value, 0);
  s.setIntensity(1);
  assert.ok(s.surface.material.uniforms.uHeat.value > 1, 'HDR: the hot centre blooms');
});
