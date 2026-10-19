// [MM-task_mveuiyia_f] Shadows sit on their casters: a depth bias small enough that a rock's shadow meets its foot (the
// old -0.0006 pushed it ~0.13 world units off — a lit sliver at every rock base), plus a normal bias against acne.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import { createLights, SHADOW_BIAS, SHADOW_NORMAL_BIAS } from './lighting.js';

test('the sun shadow: depth bias under 0.02 world units of the shadow camera range, normal bias about one texel', () => {
  const renderer = { shadowMap: {}, setClearColor() {} };
  const L = createLights(THREE, renderer, new THREE.Scene(), 48, 32, 2048);
  const cam = L.sun.shadow.camera, range = cam.far - cam.near;
  assert.equal(L.sun.shadow.bias, SHADOW_BIAS);
  assert.equal(L.sun.shadow.normalBias, SHADOW_NORMAL_BIAS);
  assert.ok(Math.abs(SHADOW_BIAS) * range < 0.02, `depth offset ${(Math.abs(SHADOW_BIAS) * range).toFixed(3)} wu`);
  const texel = (cam.right - cam.left) / 2048;
  assert.ok(SHADOW_NORMAL_BIAS > texel * 0.4 && SHADOW_NORMAL_BIAS < texel * 2, `normal bias ${SHADOW_NORMAL_BIAS} vs texel ${texel.toFixed(3)}`);
});
