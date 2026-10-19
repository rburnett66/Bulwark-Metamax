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

test('sand / dirt detail: tileable ripples + pebbles; a mask on dirt and sand only; wired into the ground material [MM-task_mvfn5gxu_d]', async () => {
  const { SAND, sandDetailTextures, createGrassGroundMaterial } = await import('./grassDetail.js');
  const t = sandDetailTextures({ ...SAND, size: 64 }), t2 = sandDetailTextures({ ...SAND, size: 64 });
  assert.deepEqual(t.normal, t2.normal, 'deterministic');
  const N = 64; let seam = 0, inner = 0, tilt = 0;
  for (let y = 0; y < N; y++) {
    seam += Math.abs(t.height[y * N] - t.height[y * N + N - 1]);          // across the wrap
    inner += Math.abs(t.height[y * N + 31] - t.height[y * N + 32]);       // an ordinary neighbour pair
  }
  for (let i = 0; i < N * N; i++) tilt = Math.max(tilt, Math.abs(t.normal[i * 4] - 128));
  assert.ok(seam < inner * 2 + 1, `tiles left-right: wrap step ${(seam / N).toFixed(2)} vs neighbour ${(inner / N).toFixed(2)}`);
  assert.ok(tilt > 30, 'the normal map has real relief');
  // the mask: high on the dirt / sand field, zero on open grass
  const map = { cols: 40, rows: 30, seed: 7, terrain: new Array(1200).fill(0), blockedCells: [], waterCells: [], buildableCells: [] };
  const G = buildGroundArrays(map, LOWPAL.meadow, () => 0, 1, { grass: true });
  assert.ok(G.aSand && G.aSand.length === G.aGrass.length, 'a sand value per vertex');
  let both = 0;
  for (let i = 0; i < G.aSand.length; i++) if (G.aSand[i] > 0.5 && G.aGrass[i] > 0.5) both++;
  assert.ok(both / G.aSand.length < 0.02, 'sand and grass detail do not stack');
  const m = createGrassGroundMaterial(THREE);
  const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>' };
  m.onBeforeCompile(sh);
  assert.ok(sh.uniforms.uSandNrm && sh.uniforms.uSandAlb, 'sand textures bound');
  assert.ok(sh.vertexShader.includes('attribute float aSand') && sh.fragmentShader.includes('uSandNrm'), 'sand in the shader');
});

// [MM-task_mvfq860y_2] owner 2026-10-19: "the bump map or normal map shader is not oriented to the correct light source
// angle". The textures are NOT flipped (DataTexture flipY false): texel row = v = +world Z (lowpoly aGUv = z / tile), so a
// normal must lean DOWN-slope on both axes — n.x ∝ −∂h/∂u and n.y ∝ −∂h/∂v — or relief lights from the mirrored sun.
test('grass and sand normals lean down-slope on BOTH texture axes (lit from the real sun, not its mirror)', async () => {
  const { sandDetailTextures } = await import('./grassDetail.js');
  for (const [name, t] of [['grass', grassDetailTextures()], ['sand', sandDetailTextures()]]) {
    const N = t.size, H = t.height, w = (v) => ((v % N) + N) % N, at = (x, y) => H[w(y) * N + w(x)];
    let cu = 0, cv = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      cu += (t.normal[i] - 127.5) * (at(x - 1, y) - at(x + 1, y));       // −∂h/∂u
      cv += (t.normal[i + 1] - 127.5) * (at(x, y - 1) - at(x, y + 1));   // −∂h/∂v
    }
    assert.ok(cu > 0, `${name}: x leans down-slope`);
    assert.ok(cv > 0, `${name}: y leans down-slope (was flipped)`);
  }
});
