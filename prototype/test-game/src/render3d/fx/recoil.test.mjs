// [MM-story_mvee15ja_b] cannon-only recoil: cannon tower, tank / Tiger main guns and the base shell gun slide back on
// each shot and run out again; flak, the buggy's energy gun, rockets, missiles and the railgun never move.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { recoilFrac, createRecoil, RECOIL } from './recoil.js';
import { createCombatFx } from './combatFxModel.js';
import { SYSTEM_MODELS } from '../structures/systemModels.js';
import { createSystemStructures } from '../structures/system3d.js';
import { UNIT_MODELS } from '../units/models.js';
import { createUnitBarrels } from '../units/unitBarrels.js';
import { LANDING_CRAFT } from '../craft/models.js';
import { createCraft3D } from '../craft/craft3d.js';

test('profile: snaps back within the kick, runs out over the return, then rests', () => {
  assert.equal(recoilFrac(-0.1), 0);
  assert.ok(Math.abs(recoilFrac(RECOIL.kick) - 1) < 1e-9, 'fully back at the end of the kick');
  assert.ok(recoilFrac(RECOIL.kick * 0.5) > 0.6, 'fast');
  const mid = recoilFrac(RECOIL.kick + RECOIL.ret * 0.5);
  assert.ok(mid > 0.3 && mid < 0.7, 'easing forward');
  assert.equal(recoilFrac(RECOIL.kick + RECOIL.ret + 0.01), 0);
  const r = createRecoil(); r.kick('a', 0); r.step(RECOIL.kick);
  assert.ok(Math.abs(r.offset('a', 0, 0.5) - 0.5) < 1e-9 && r.offset('a', 1, 0.5) === 0 && r.offset('b', 0, 0.5) === 0);
});

test('data: only cannon-type barrels opt in', () => {
  assert.ok(SYSTEM_MODELS.sys_cannon.recoil > 0);
  for (const k of ['sys_flak', 'sys_rockets', 'sys_missile']) assert.ok(!SYSTEM_MODELS[k].recoil, `${k} never recoils`);
  assert.ok(UNIT_MODELS.tank.recoil > 0 && UNIT_MODELS.tiger.recoil > 0);
  assert.ok(!UNIT_MODELS.buggy.recoil, 'the buggy energy gun never recoils');
  assert.ok(LANDING_CRAFT.lc_neutral.recoil > 0, 'base shell gun');
  assert.ok(!LANDING_CRAFT.lc_space.recoil, 'the railgun never recoils');
});

test('fx: every round off a modelled barrel calls opts.kick with the shooter key and barrel number', () => {
  const fx = createCombatFx();
  const st = {
    time: 0,
    units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 10, y: 4 }, targetId: null }]]),
    structures: new Map([[100, { id: 100, structId: 'STR-Flak', kind: 'antiAir', lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
    base: { pos: { x: 16, y: 16 } },
  };
  const kicks = [];
  const opts = { getDef: () => null, muzzle: () => ({ x: 4.9, y: 0.5, z: 4.5, dx: 1, dy: 0, dz: 0, bx: 4.6, by: 0.5, bz: 4.5 }), kick: (key, n) => kicks.push([key, n]) };
  for (let i = 0; i < 90; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  assert.ok(kicks.length >= 2 && kicks.length === fx.launched, `one kick per round (${kicks.length}/${fx.launched})`);
  assert.ok(kicks.every(([k]) => k === 's100'));
  assert.deepEqual(kicks.slice(0, 3).map(([, n]) => n), [0, 1, 2], 'barrel numbers advance');
});

test('cannon tower: the drawn barrel slides back along its axis, the firing point does not', () => {
  const scene = new THREE.Scene(), sys = createSystemStructures(THREE, scene);
  sys.setBase({ x: 6, y: 5 });
  sys.setStructures([{ id: 1, kind: 'antiGround', structId: 'STR-Cannon', cell: { x: 10, y: 5 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: null }]);
  sys.update(1 / 60, {});
  const B = sys.kinds.sys_cannon.meshes.barrel, a = new THREE.Matrix4(), b = new THREE.Matrix4();
  B.getMatrixAt(0, a); const m0 = sys.muzzle(1, 0);
  sys.kick(1, 0); sys.update(RECOIL.kick, {});
  B.getMatrixAt(0, b); const m1 = sys.muzzle(1, 0);
  const pa = new THREE.Vector3().setFromMatrixPosition(a), pb = new THREE.Vector3().setFromMatrixPosition(b);
  const ax = new THREE.Vector3(1, 0, 0).transformDirection(a);
  const moved = pb.clone().sub(pa);
  assert.ok(moved.length() > 0.05, `slid ${moved.length().toFixed(3)}`);
  assert.ok(moved.normalize().dot(ax) < -0.99, 'straight back along the barrel');
  assert.ok(Math.abs(m0.x - m1.x) < 1e-9 && Math.abs(m0.y - m1.y) < 1e-9, 'firing point unchanged');
  sys.update(RECOIL.ret + 0.05, {});
  assert.equal(sys.recoilOf(1), 0, 'run out');
  sys.dispose();
});

test('tank: only the gun that fired kicks; the buggy never does', () => {
  const b = createUnitBarrels();
  const state = { units: new Map([[1, { id: 1, pos: { x: 4, y: 4 }, hp: 5, targetId: null }], [2, { id: 2, pos: { x: 8, y: 4 }, hp: 5, targetId: null }]]) };
  const views = [{ id: 1, model: 'tank', scale: 1, x: 4.5, y: 0, z: 4.5, heading: 0, aim: 0 }, { id: 2, model: 'buggy', scale: 1, x: 8.5, y: 0, z: 4.5, heading: 0, aim: 0 }];
  b.update(views, state, {}, null, 1 / 60);
  b.kick(1, 1); b.kick(2, 0);
  b.update(views, state, {}, null, RECOIL.kick);
  assert.ok(views[0].recoil && views[0].recoil.barrel2 > 0 && !views[0].recoil.barrel, JSON.stringify(views[0].recoil));
  assert.ok(!views[1].recoil, 'buggy still');
});

test('base craft: the shell gun slides back on its slide; the muzzle stays at the tip', () => {
  const scene = new THREE.Scene(), c = createCraft3D(THREE, scene, 'lc_neutral');
  c.place({ x: 10, y: 10 }); c.aim(0, 1); c.elevate(null, 1 / 60);
  const m0 = c.muzzleWorld();
  c.kick(); c.elevate(null, RECOIL.kick);
  assert.ok(c.recoilBack > 0.3, `back ${c.recoilBack.toFixed(2)}`);
  const m1 = c.muzzleWorld();
  assert.ok(Math.abs(m0.x - m1.x) < 1e-9, 'firing point unchanged');
  c.elevate(null, RECOIL.ret + 0.05);
  assert.equal(c.recoilBack, 0);
  c.dispose();
  const r = createCraft3D(THREE, new THREE.Scene(), 'lc_space');
  r.place({ x: 10, y: 10 }); r.kick(); r.elevate(null, RECOIL.kick);
  assert.equal(r.recoilBack, 0, 'railgun: no recoil');
  r.dispose();
});
