// [MM-story_mven9dp1_r] normal-mapped grass in patches of open ground.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { GRASS, grassDetailTextures } from './grassDetail.js';
import { buildGroundArrays, buildLowPolyGround } from './lowpoly.js';
import { LOWPAL } from '../styles/lowpoly-palettes.js';
import { TIERS } from '../quality.js';

test('the blade textures: deterministic, tileable, normals point up on average, albedo centred near ×1', () => {
  const a = grassDetailTextures(), b = grassDetailTextures();
  assert.deepEqual(a.normal.slice(0, 4096), b.normal.slice(0, 4096), 'same seed → same texture');
  const N = a.size;
  let seam = 0, inner = 0;
  for (let y = 0; y < N; y++) { seam += Math.abs(a.height[y * N] - a.height[y * N + N - 1]); inner += Math.abs(a.height[y * N + 100] - a.height[y * N + 101]); }
  assert.ok(seam < inner * 1.5, `the wrap seam is no rougher than the inside (${seam.toFixed(1)} vs ${inner.toFixed(1)})`);
  let nz = 0, alb = 0;
  for (let i = 0; i < N * N; i++) { nz += a.normal[i * 4 + 2]; alb += a.albedo[i * 4 + 1]; }
  assert.ok(nz / (N * N) > 200, 'mostly facing up');
  const m = alb / (N * N) / 128;
  assert.ok(m > 0.75 && m < 1.15, `albedo multiplier ≈ 1 (${m.toFixed(2)})`);
});

const cols = 24, rows = 16;
const terrain = new Array(cols * rows).fill(0);
for (let x = 0; x < cols; x++) { terrain[8 * cols + x] = 1; terrain[9 * cols + x] = 1; }     // a dirt strip
for (let z = 0; z < 4; z++) for (let x = 18; x < 24; x++) terrain[z * cols + x] = 6;         // a pond
const MAP = { cols, rows, terrain, blockedCells: [], base: { x: 2, y: 2 } };

test('the mask: patches on open grass only — never on dirt or water', () => {
  const G = buildGroundArrays(MAP, LOWPAL.meadow, () => 0, 0.5, { grass: true });
  const at = G.colAt.grassAt;
  let onGrass = 0, n = 0;
  for (let z = 1; z < 7; z += 0.25) for (let x = 0.5; x < 17; x += 0.25) { onGrass += at(x, z); n++; }
  assert.ok(onGrass / n > 0.15 && onGrass / n < 0.85, `patches, not everywhere (${(onGrass / n).toFixed(2)})`);
  for (let x = 0.5; x < 24; x += 0.5) assert.equal(at(x, 9), 0, 'no grass on the dirt strip');
  assert.equal(at(21, 1.5), 0, 'none on the pond');
  assert.ok(G.aGrass.length === G.triangles * 3 && G.aGUv.length === G.triangles * 6);
  assert.equal(buildGroundArrays(MAP, LOWPAL.meadow).aGrass, null, 'off: no extra attributes');
});

test('High / Standard draw it with the patched Phong material; Low keeps the Lambert ground', () => {
  assert.equal(TIERS.high.grassDetail, true); assert.equal(TIERS.standard.grassDetail, true); assert.equal(TIERS.low.grassDetail, false);
  const on = buildLowPolyGround(THREE, MAP, LOWPAL.meadow, { grassDetail: true });
  const g = on.group.getObjectByName('ground-lowpoly');
  assert.ok(g.material.isMeshPhongMaterial && g.geometry.getAttribute('aGrass') && g.geometry.getAttribute('aGUv'));
  assert.ok(on.stats.grassCover > 0.05, 'some cover');
  const sh = { vertexShader: THREE.ShaderLib.phong.vertexShader, fragmentShader: THREE.ShaderLib.phong.fragmentShader, uniforms: {} };
  g.material.onBeforeCompile(sh);
  assert.ok(sh.vertexShader.includes('vGrass = aGrass;') && sh.fragmentShader.includes('texture2D(uGrassNrm, vGUv)') && sh.fragmentShader.includes('texture2D(uGrassAlb, vGUv)'), 'shader patched');
  assert.ok(sh.uniforms.uGrassAlb.value.isDataTexture && sh.uniforms.uGrassNrm.value.isDataTexture);
  const off = buildLowPolyGround(THREE, MAP, LOWPAL.meadow, { grassDetail: false });
  assert.ok(off.group.getObjectByName('ground-lowpoly').material.isMeshLambertMaterial);
  assert.equal(GRASS.size & (GRASS.size - 1), 0, 'power-of-two texture (mipmaps)');
});
