// MAT [MM-story_mv87jwol_6] — metal unit material: data coverage, per-vertex metal/rough, the shader
// injection really lands in three's Phong shader, uMetalK 0 = the flat look, geometry unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import { UMETAL, metalFor, isGlowKey, DEFAULT_MR, ENV_MEADOW } from './metal.js';
import { createUnitMaterial } from './material.js';
import { mergeModelGroups, createUnits3D } from './models3d.js';
import { UNIT_MODELS } from './models.js';
import { MODEL_KEYS } from './modelKeys.js';

test('every material key a model uses has metal data (no part falls back to the neutral default)', () => {
  const used = new Set();
  for (const def of Object.values(UNIT_MODELS)) for (const p of def.parts) used.add(p.m || 'hull');
  const missing = [...used].filter((k) => !isGlowKey(k) && !UMETAL[k]);
  assert.deepEqual(missing, []);
  for (const k of used) assert.notEqual(metalFor(k), DEFAULT_MR, `${k} resolved from the table`);
});

test('values are the approved prototype numbers; glow parts carry no metal', () => {
  assert.deepEqual(UMETAL.hull, [0.55, 0.45]);
  assert.deepEqual(UMETAL.metal, [0.95, 0.2]);
  assert.deepEqual(UMETAL.glass, [1.0, 0.05]);
  assert.deepEqual(metalFor('glow'), [0, 1]);
  assert.deepEqual(metalFor('amber'), [0, 1]);
  for (const [m, r] of Object.values(UMETAL)) assert.ok(m >= 0 && m <= 1 && r >= 0 && r <= 1);
});

test('merged unit geometry carries aMR per vertex, matching each part\'s material key', () => {
  for (const key of MODEL_KEYS) {
    for (const G of Object.values(mergeModelGroups(THREE, UNIT_MODELS[key], undefined, key))) {
      const mr = G.geo.getAttribute('aMR'), emit = G.geo.getAttribute('aEmit');
      assert.ok(mr, `${key} has aMR`);
      assert.equal(mr.itemSize, 2);
      assert.equal(mr.count, G.geo.getAttribute('position').count);
      for (let i = 0; i < mr.count; i++) {
        if (emit.array[i] === 1) { assert.equal(mr.array[i * 2], 0, 'glow vertices are not metal'); continue; }
        assert.ok(mr.array[i * 2] > 0, `${key} vertex ${i} has metalness`);
      }
    }
  }
});

test('the metal injection really lands in three r128\'s Phong shader (no silent no-op)', () => {
  const { material } = createUnitMaterial(THREE);
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.phong.vertexShader, fragmentShader: THREE.ShaderLib.phong.fragmentShader };
  material.onBeforeCompile(sh);
  for (const needle of ['attribute vec2 aMR', 'vMR = aMR']) assert.ok(sh.vertexShader.includes(needle), `vertex: ${needle}`);
  for (const needle of ['vec3 baseCol = diffuseColor.rgb', 'float mtl = vMR.x * uMetalK', 'material.specularShininess', 'outgoingLight += refl', 'mix(outgoingLight, baseCol, vEmit)']) {
    assert.ok(sh.fragmentShader.includes(needle), `fragment: ${needle}`);
  }
  for (const u of ['uMetalK', 'uEnvSky', 'uEnvGround']) assert.ok(sh.uniforms[u], `uniform ${u}`);
});

test('uMetalK: 1 by default, 0 restores the flat look; the environment follows the style', () => {
  const m = createUnitMaterial(THREE);
  assert.equal(m.uniforms.uMetalK.value, 1);
  m.setMetal(0);
  assert.equal(m.uniforms.uMetalK.value, 0);
  m.setMetal(7);
  assert.equal(m.uniforms.uMetalK.value, 1, 'clamped');
  assert.equal(m.uniforms.uEnvSky.value.getHex(), ENV_MEADOW.sky);
  m.setEnv({ sky: 0xff8a5a, ground: 0x24345a });
  assert.equal(m.uniforms.uEnvSky.value.getHex(), 0xff8a5a);
  assert.equal(m.uniforms.uEnvGround.value.getHex(), 0x24345a);
});

test('live units use the metal material (per-pixel Phong), still receive shadows, and expose setMetal', () => {
  const scene = new THREE.Scene();
  const units = createUnits3D(THREE, scene, { sunDir: { x: -0.5, y: 0.7, z: -0.5 } });
  const lit = scene.children.filter((o) => o.isInstancedMesh && !(o.material instanceof THREE.ShaderMaterial));
  assert.ok(lit.length >= 8);
  for (const o of lit) { assert.ok(o.material.isMeshPhongMaterial); assert.ok(o.receiveShadow); }
  units.setMetal(0);
  assert.equal(units.material.uniforms.uMetalK.value, 0);
  assert.deepEqual(units.tris, { tank: { full: 3362, lod: 1534 }, buggy: { full: 1260, lod: 760 }, beetle: { full: 2748, lod: 1724 }, jet: { full: 994, lod: 698 }, tiger: { full: 3660, lod: 1520 }, copter: { full: 1720, lod: 1000 }, drone: { full: 1708, lod: 1496 }, miner: { full: 4524, lod: 1320 }, air_troops: { full: 1436, lod: 1020 }, air_scout: { full: 1192, lod: 912 }, air_tank: { full: 2580, lod: 1128 }, air_artillery: { full: 3520, lod: 2048 }, air_heavy: { full: 3470, lod: 1338 }, air_gunship: { full: 1788, lod: 1492 }, air_fighter: { full: 1158, lod: 878 }, air_missile: { full: 2084, lod: 1756 }, air_bomber: { full: 1512, lod: 796 }, siege_troops: { full: 2552, lod: 1136 }, siege_scout: { full: 1432, lod: 820 }, siege_tank: { full: 3376, lod: 1876 }, siege_artillery: { full: 3804, lod: 2024 }, siege_heavy: { full: 4000, lod: 2092 }, siege_gunship: { full: 2290, lod: 1558 }, siege_fighter: { full: 884, lod: 632 }, siege_missile: { full: 2360, lod: 988 }, arcane_troops: { full: 3415, lod: 2100 }, arcane_scout: { full: 3413, lod: 2702 }, arcane_tank: { full: 4612, lod: 2164 }, arcane_artillery: { full: 4528, lod: 2600 }, arcane_heavy: { full: 5783, lod: 3690 }, arcane_gunship: { full: 1511, lod: 1378 }, arcane_fighter: { full: 1056, lod: 920 }, arcane_missile: { full: 1556, lod: 716 }, space_troops: { full: 2360, lod: 1116 }, space_scout: { full: 1388, lod: 716 }, space_tank: { full: 2992, lod: 1248 }, space_artillery: { full: 3344, lod: 1472 }, space_heavy: { full: 3220, lod: 1460 }, space_gunship: { full: 1656, lod: 1072 }, space_fighter: { full: 1696, lod: 1088 }, space_missile: { full: 1364, lod: 818 } },
    'geometry unchanged by the material swap');
});
