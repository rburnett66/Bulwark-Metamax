// src/render3d/units/shadow.test.mjs — the shadow proxies stay cheap, complete and attached [MM-story_mvibvqd2_7].
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { UNIT_MODELS } from './models.js';
import { MODEL_KEYS } from './modelKeys.js';
import { lodDef } from './lod.js';
import { shadowDef, partBox, SHADOW_MAX_TRIS } from './shadow.js';
import { mergeModelGroups, createUnits3D } from './models3d.js';

const sum = (G) => Object.values(G).reduce((a, g) => a + g.tris, 0);

test('every model casts a shadow proxy under the triangle cap', () => {
  for (const key of MODEL_KEYS) {
    const tris = sum(mergeModelGroups(THREE, shadowDef(UNIT_MODELS[key])));
    assert.ok(tris > 0, `${key} casts no shadow`);
    assert.ok(tris <= SHADOW_MAX_TRIS, `${key} shadow proxy is ${tris} tris (cap ${SHADOW_MAX_TRIS})`);
  }
});

test('the proxies cost a small fraction of the LOD meshes they replace', () => {
  let lod = 0, shadow = 0;
  for (const key of MODEL_KEYS) { lod += sum(mergeModelGroups(THREE, lodDef(UNIT_MODELS[key]))); shadow += sum(mergeModelGroups(THREE, shadowDef(UNIT_MODELS[key]))); }
  assert.ok(shadow < lod * 0.35, `shadow proxies ${shadow} vs LOD ${lod}`);
});

test('every moving group keeps its own shadow; rotors and glow parts cast none', () => {
  for (const key of MODEL_KEYS) {
    const def = UNIT_MODELS[key], S = shadowDef(def);
    const groups = new Set(def.parts.filter((p) => !/^glow|amber/.test(p.m || '')).map((p) => p.g || 'body'));
    const cast = new Set(S.parts.map((p) => p.g || 'body'));
    for (const g of groups) {
      if (g.startsWith('spin')) assert.ok(!cast.has(g), `${key}: rotor ${g} casts a shadow`);
      else assert.ok(cast.has(g), `${key}: group ${g} lost its shadow`);
    }
    assert.ok(S.parts.every((p) => !/^glow|amber/.test(p.m || '')), `${key}: a glow part casts`);
  }
});

test('an authored shadow replaces just its groups (the organ battery casts its pipe bank as one slab)', () => {
  const S = shadowDef(UNIT_MODELS.arcane_artillery);
  const barrel = S.parts.filter((p) => p.g === 'barrel');
  assert.equal(barrel.length, 1);
  assert.equal(barrel[0].t, 'box');
  assert.ok(S.parts.some((p) => !p.g), 'the hull is still derived');
});

test('partBox places a part: offset, extent and rotation', () => {
  const [mn, mx] = partBox({ t: 'box', s: [2, 1, 4], p: [1, 0.5, 0], r3: [0, 90, 0] });
  assert.deepEqual(mn.map((v) => Math.round(v * 100) / 100), [-1, 0, -1]);
  assert.deepEqual(mx.map((v) => Math.round(v * 100) / 100), [3, 1, 1]);
});

test('live units and wrecks draw the proxy, not the LOD mesh', () => {
  const scene = new THREE.Scene();
  const units = createUnits3D(THREE, scene, { sunDir: { x: -0.5, y: 0.7, z: -0.5 } });
  for (const key of MODEL_KEYS) assert.equal(units.shadowTris[key], sum(mergeModelGroups(THREE, shadowDef(UNIT_MODELS[key]))), key);
  const wrecks = units.lodGroups();
  for (const [key, groups] of Object.entries(wrecks)) {
    const L = Object.values(groups), n = (g) => (g ? g.attributes.position.count : 0);
    assert.ok(L.some((x) => x.shGeo), `${key}: its wreck casts no shadow`);
    assert.ok(L.reduce((a, x) => a + n(x.shGeo), 0) < L.reduce((a, x) => a + n(x.geo), 0), `${key}: wreck shadow is no cheaper than its mesh`);
  }
});
