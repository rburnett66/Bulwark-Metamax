// [MM-story_mvbr0qfb_o] the player's towers and walls draw as the System models.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { SYSTEM_MODELS, SYSTEM_COLORS } from './systemModels.js';
import { mergeSystemModel, planSystem, createSystemStructures, SYSTEM_KINDS } from './system3d.js';
import { UMETAL, isGlowKey } from '../units/metal.js';

test('System models: every model builds, every material key has a colour and a metal value', () => {
  for (const [k, def] of Object.entries(SYSTEM_MODELS)) {
    const g = mergeSystemModel(THREE, def);
    assert.ok(g.body && g.body.tris > 40, `${k}: a base`);
    for (const p of def.parts) {
      assert.ok(SYSTEM_COLORS[p.m || 'hull'] != null, `${k}: colour for ${p.m}`);
      if (!isGlowKey(p.m)) assert.ok(UMETAL[p.m || 'hull'], `${k}: metal for ${p.m}`);
    }
  }
  assert.ok(mergeSystemModel(THREE, SYSTEM_MODELS.sys_cannon).weapon, 'the cannon turret turns');
  assert.ok(mergeSystemModel(THREE, SYSTEM_MODELS.sys_flak).head, 'the flak radar sweeps');
});

test('plan: cannon / anti-air / wall become System instances; walls join along their neighbours', () => {
  const S = (id, kind, x, y, extra = {}) => ({ id, kind, cell: { x, y }, lifecycle: 'Complete', hp: 10, maxHp: 10, ...extra });
  const list = [S(1, 'antiGround', 10, 5), S(2, 'antiAir', 2, 5), S(3, 'wall', 4, 4), S(4, 'wall', 5, 4), S(5, 'wall', 5, 5), S(6, 'harvestorBay', 7, 7), S(7, 'wall', 20, 20, { lifecycle: 'Destroyed' })];
  const { items } = planSystem(list, { x: 6, y: 5 });
  assert.equal(items.filter((i) => i.model === 'sys_cannon').length, 1);
  assert.equal(items.filter((i) => i.model === 'sys_flak').length, 1);
  assert.ok(!items.some((i) => i.id === 6), 'bays stay with the low-poly set');
  assert.ok(!items.some((i) => i.id === 7), 'destroyed walls vanish');
  const w4 = items.filter((i) => i.id === 4);
  assert.equal(w4.length, 2, 'the corner wall runs both ways');
  assert.deepEqual(items.filter((i) => i.id === 3).map((i) => i.ry), [Math.PI / 2], 'an east–west wall turns');
  const cannon = items.find((i) => i.id === 1);
  assert.ok(Math.abs(cannon.ry) < 1e-9, 'a tower east of the base faces east (outward)');
  for (const k of Object.keys(SYSTEM_KINDS)) assert.ok(SYSTEM_MODELS[SYSTEM_KINDS[k]], k);
});

test('binder: instances placed, turret turns toward its target, shadow-map signal only on change', () => {
  const scene = new THREE.Scene();
  const sys = createSystemStructures(THREE, scene);
  sys.setBase({ x: 6, y: 5 });
  const tower = { id: 1, kind: 'antiGround', cell: { x: 10, y: 5 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: 9 };
  assert.equal(sys.setStructures([tower]), true);
  assert.equal(sys.setStructures([tower]), false, 'same set → no shadow re-render');
  const K = sys.kinds.sys_cannon;
  assert.equal(K.meshes.body.count, 1);
  const state = { units: new Map([[9, { pos: { x: 10.5, y: 12 } }]]) };   // target due south
  const before = new THREE.Matrix4(); K.meshes.weapon.getMatrixAt(0, before);
  for (let i = 0; i < 60; i++) sys.update(1 / 30, state);
  const after = new THREE.Matrix4(); K.meshes.weapon.getMatrixAt(0, after);
  const fwd = new THREE.Vector3(1, 0, 0).transformDirection(after);
  assert.ok(fwd.z > 0.9, `turret swings to face its target (fwd z ${fwd.z.toFixed(2)})`);
  assert.notDeepEqual(before.elements, after.elements);
  sys.dispose();
});
