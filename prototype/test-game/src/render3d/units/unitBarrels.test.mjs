// [MM-story_mvedy16u_9] tank, buggy and King Tiger guns pitch to the shot, and their shots leave the modelled tips.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { UNIT_MODELS } from './models.js';
import { UNIT_SCALE } from './modelKeys.js';
import { mergeModelGroups, createUnits3D } from './models3d.js';
import { unitMuzzle, createUnitBarrels } from './unitBarrels.js';

const D = Math.PI / 180;
const GUNS = ['tank', 'buggy', 'tiger'];

test('tank, buggy and Tiger carry a barrel group, a trunnion pivot, limits and muzzles; beetle and jet do not', () => {
  for (const k of GUNS) {
    const def = UNIT_MODELS[k], g = mergeModelGroups(THREE, def);
    assert.ok(g.barrel && g.barrel.tris > 10 && g.turret, `${k}: barrel + turret`);
    assert.ok(def.pivots.barrel && def.barrel && def.muzzles.length >= 1, `${k}: rig`);
  }
  assert.equal(UNIT_MODELS.tank.muzzles.length, 2, 'twin guns');
  for (const k of ['beetle', 'jet']) assert.ok(!UNIT_MODELS[k].barrel, `${k}: no gun`);
});

test('unitMuzzle: the tip lies ahead along the turret aim (not the hull), and pitch lifts tip and axis', () => {
  const v = { model: 'tiger', scale: 1, x: 5.5, y: 0, z: 5.5, heading: 0, aim: Math.PI / 2 };   // hull east, turret south
  const m = unitMuzzle(v, 0, 0), k = UNIT_SCALE;
  assert.ok(m.dz > 0.99 && Math.abs(m.dy) < 1e-9, 'axis along the turret');
  assert.ok(m.z - v.z > 3.5 * k, `tip well forward (${((m.z - v.z) / k).toFixed(2)} model units)`);
  assert.ok(Math.abs(m.y - 1.48 * k) < 1e-6, 'at the gun height');
  const up = unitMuzzle(v, 0, 10 * D);
  assert.ok(up.y > m.y && Math.abs(Math.asin(up.dy) - 10 * D) < 1e-9, 'pitched');
  const t0 = unitMuzzle({ model: 'tank', x: 0, z: 0, heading: 0, aim: 0 }, 0), t1 = unitMuzzle({ model: 'tank', x: 0, z: 0, heading: 0, aim: 0 }, 1);
  assert.ok(Math.abs(t0.z + t1.z) < 1e-9 && t0.z !== 0, 'the twin guns alternate sides');
  assert.equal(unitMuzzle({ model: 'jet', x: 0, z: 0 }, 0), null);
});

test('barrels: a tank looks up at a hovering target and settles level when idle; muzzle follows', () => {
  const b = createUnitBarrels();
  const state = { units: new Map([
    [1, { id: 1, pos: { x: 4, y: 4 }, hp: 5, targetId: 2 }],
    [2, { id: 2, pos: { x: 6, y: 4 }, hp: 5, domain: 'Flyer', altitude: 1 }],
  ]) };
  const views = [{ id: 1, model: 'tank', scale: 1, x: 4.5, y: 0, z: 4.5, heading: 0, aim: 0 }];
  for (let i = 0; i < 60; i++) b.update(views, state, {}, null, 1 / 30);
  const p = b.pitch(1);
  assert.ok(p > 10 * D && p <= UNIT_MODELS.tank.barrel.max * D + 1e-9, `up at the flyer (${(p / D).toFixed(1)}°)`);
  assert.equal(views[0].pitch, p);
  assert.ok(Math.abs(Math.asin(b.muzzle(1, 0).dy) - p) < 1e-9, 'firing point at the barrel pitch');
  state.units.get(1).targetId = null;
  for (let i = 0; i < 120; i++) b.update(views, state, {}, null, 1 / 30);
  assert.ok(Math.abs(b.pitch(1)) < 1e-9, 'idle: level');
  b.update([], state, {}, null, 1 / 30);
  assert.equal(b.muzzle(1, 0), null, 'gone units drop out');
});

test('units3d: the drawn barrel pitches with view.pitch; a wreck turret still carries its gun', () => {
  const scene = new THREE.Scene(), u3 = createUnits3D(THREE, scene, { cap: 4, sunDir: new THREE.Vector3(-0.5, 0.7, -0.5).normalize() });
  u3.setUnits([{ id: 1, model: 'tank', scale: 1, x: 0, z: 0, heading: 0, aim: 0, pitch: 12 * D }], 5, false);
  const lods = u3.lodGroups();
  assert.ok(!lods.tank.barrel, 'no separate barrel wreck');
  const full = mergeModelGroups(THREE, UNIT_MODELS.tank);
  assert.ok(lods.tank.turret.geo.attributes.position.count > 0 && lods.tank.turret.geo.attributes.position.count >= full.barrel.geo.attributes.position.count, 'turret wreck includes the barrels');
  // find the barrel instanced mesh by its vertex count and read its matrix
  const bm = scene.children.filter((m) => m.isInstancedMesh && m.count === 1);
  let found = false;
  for (const m of bm) {
    const M = new THREE.Matrix4(); m.getMatrixAt(0, M);
    const ax = new THREE.Vector3(1, 0, 0).transformDirection(M);
    if (Math.abs(Math.asin(ax.y) - 12 * D) < 1e-3) found = true;
  }
  assert.ok(found, 'one group is drawn pitched 12°');
  u3.dispose();
});
