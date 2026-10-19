// [MM-task_mvfpbbtp_1] fire kick: cannon towers and tanks are shoved back off their gun with the front up, the front
// drops back to the ground, then the body slides forward to rest — and every shot is ONE round.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { bodyKick, kickMatrix, BODY_KICK } from './recoil.js';
import { createCombatFx, STRUCT_RECIPES } from './combatFxModel.js';
import { STRUCTURES } from '../../data/tables.js';
import { createSystemStructures } from '../structures/system3d.js';
import { createUnitBarrels } from '../units/unitBarrels.js';

const DEG = Math.PI / 180;

test('profile: shove + rear up, the front drops to the ground first, then the body slides back to rest', () => {
  assert.deepEqual(bodyKick(-0.01), { back: 0, lift: 0 });
  const up = bodyKick(BODY_KICK.up);
  assert.ok(up.back > 0.99 && up.lift > 0.99, 'fully shoved and reared at the end of the kick');
  const landed = bodyKick(BODY_KICK.drop);
  assert.ok(landed.lift < 1e-6 && landed.back > 0.99, 'front back on the ground while the body is still shoved back');
  const bounce = bodyKick(BODY_KICK.drop + (BODY_KICK.drop - BODY_KICK.up) / 2);
  assert.ok(bounce.lift > 0 && bounce.lift <= BODY_KICK.bounce + 1e-9, 'one small bounce');
  const mid = bodyKick((BODY_KICK.drop + BODY_KICK.settle) / 2);
  assert.ok(mid.back > 0.2 && mid.back < 0.8, 'sliding forward');
  assert.deepEqual(bodyKick(BODY_KICK.settle), { back: 0, lift: 0 }, 'at rest');
  assert.ok(BODY_KICK.back > 0.03 && BODY_KICK.back < 0.15, 'a few pixels, not a hop');
  assert.ok(BODY_KICK.lift >= 2 && BODY_KICK.lift <= 10, 'a few degrees');
});

test('matrix: the rear edge stays planted, the front rises, the body moves against the gun', () => {
  const M = new THREE.Matrix4().fromArray(kickMatrix(5, 0, 7, 0, 1, 0, 6 * DEG, 0.4));   // gun along +z, lift only
  const rear = new THREE.Vector3(5, 0, 6.6).applyMatrix4(M), front = new THREE.Vector3(5, 0, 7.4).applyMatrix4(M);
  assert.ok(rear.distanceTo(new THREE.Vector3(5, 0, 6.6)) < 1e-9, 'rear edge fixed');
  assert.ok(front.y > 0.07, `front up ${front.y.toFixed(3)}`);
  assert.ok(Math.abs(front.x - 5) < 1e-9, 'no sideways roll');
  const S = new THREE.Matrix4().fromArray(kickMatrix(5, 0, 7, 1, 0, 0.07, 0, 0.4));   // gun along +x, shove only
  const c = new THREE.Vector3(5, 0, 7).applyMatrix4(S);
  assert.ok(Math.abs(c.x - 4.93) < 1e-9 && Math.abs(c.z - 7) < 1e-9, 'shoved straight back off the gun');
  const I = kickMatrix(1, 0, 1, 1, 0, 0, 0, 0.4);
  assert.deepEqual(I.map((v) => Math.round(v * 1e9) / 1e9 + 0), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'identity at rest');
});

test('cannon tower: the whole body rocks back on a shot and settles exactly where it stood', () => {
  const scene = new THREE.Scene(), sys = createSystemStructures(THREE, scene);
  sys.setBase({ x: 6, y: 5 });
  sys.setStructures([{ id: 1, kind: 'antiGround', structId: 'STR-Cannon', cell: { x: 10, y: 5 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: null }]);
  sys.update(1 / 60, {});
  const body = sys.kinds.sys_cannon_t1.meshes.body, a = new THREE.Matrix4(), b = new THREE.Matrix4(), c = new THREE.Matrix4();
  body.getMatrixAt(0, a);
  sys.kick(1, 0); sys.update(BODY_KICK.up, {});
  body.getMatrixAt(0, b);
  const pa = new THREE.Vector3().setFromMatrixPosition(a), pb = new THREE.Vector3().setFromMatrixPosition(b);
  const fwd = new THREE.Vector3(1, 0, 0).transformDirection(a);        // the turret starts facing its rest yaw
  const shove = pb.clone().sub(pa); shove.y = 0;
  assert.ok(shove.length() > 0.02, `body moved ${shove.length().toFixed(3)}`);
  assert.ok(shove.normalize().dot(fwd) < -0.95, 'pushed back, away from the gun');
  const tilt = new THREE.Vector3(1, 0, 0).transformDirection(b);
  assert.ok(tilt.y > 0.03, 'front lifted');
  assert.ok(sys.kickOf(1).lift > 0.9);
  sys.update(BODY_KICK.settle, {});
  body.getMatrixAt(0, c);
  assert.ok(a.elements.every((v, i) => Math.abs(v - c.elements[i]) < 1e-9), 'back at rest, exactly');
  sys.dispose();
});

test('flak towers never rock', () => {
  const sys = createSystemStructures(THREE, new THREE.Scene());
  sys.setBase({ x: 6, y: 5 });
  sys.setStructures([{ id: 2, kind: 'antiAir', structId: 'STR-Flak', cell: { x: 10, y: 5 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: null }]);
  sys.update(1 / 60, {});
  sys.kick(2, 0); sys.update(BODY_KICK.up, {});
  assert.deepEqual(sys.kickOf(2), { back: 0, lift: 0 });
  sys.dispose();
});

test('tank: the shot sets a body kick on its view that settles; the buggy never kicks', () => {
  const b = createUnitBarrels();
  const state = { units: new Map([[1, { id: 1, pos: { x: 4, y: 4 }, hp: 5, targetId: null }], [2, { id: 2, pos: { x: 8, y: 4 }, hp: 5, targetId: null }]]) };
  const views = [{ id: 1, model: 'tank', scale: 1, x: 4.5, y: 0, z: 4.5, heading: 0, aim: 0 }, { id: 2, model: 'buggy', scale: 1, x: 8.5, y: 0, z: 4.5, heading: 0, aim: 0 }];
  b.update(views, state, {}, null, 1 / 60);
  assert.ok(!views[0].kick);
  b.kick(1, 0); b.kick(2, 0);
  b.update(views, state, {}, null, BODY_KICK.up);
  assert.ok(views[0].kick && views[0].kick.back > 0.99 && views[0].kick.lift > 0.99, JSON.stringify(views[0].kick));
  assert.ok(!views[1].kick, 'buggy still');
  assert.ok(b.heavy(1) && !b.heavy(2), 'the tank is a heavy single-round shooter, the buggy is not');
  b.update(views, state, {}, null, BODY_KICK.settle);
  assert.equal(views[0].kick, null, 'settled');
});

test('tank drawing: a kicked tank is drawn shoved back with its nose up', async () => {
  const { createUnits3D } = await import('../units/models3d.js');
  const scene = new THREE.Scene(), u3 = createUnits3D(THREE, scene, { cap: 4, sunDir: new THREE.Vector3(-0.5, 0.7, -0.5).normalize() });
  const base = { id: 1, model: 'tank', scale: 1, x: 4, y: 0, z: 4, heading: 0, aim: 0 };
  const meshes = [];
  scene.traverse((m) => { if (m.isInstancedMesh) meshes.push(m); });
  u3.setUnits([base], 5, false);
  const drawn = meshes.filter((m) => m.count > 0);
  assert.ok(drawn.length > 0, 'the tank drew');
  const before = drawn.map((m) => { const a = new THREE.Matrix4(); m.getMatrixAt(0, a); return a; });
  u3.setUnits([{ ...base, kick: { back: 1, lift: 1 } }], 5, false);
  drawn.forEach((m, i) => {
    const b = new THREE.Matrix4(); m.getMatrixAt(0, b);
    const pa = new THREE.Vector3().setFromMatrixPosition(before[i]), pb = new THREE.Vector3().setFromMatrixPosition(b);
    assert.ok(pb.x < pa.x, `${m.name || i}: shoved back off the gun (gun faces +x)`);
  });
  const hull = drawn[0], h = new THREE.Matrix4(); hull.getMatrixAt(0, h);
  assert.ok(new THREE.Vector3(1, 0, 0).transformDirection(h).y > 0.03, 'nose up');
  u3.dispose();
});

test('one shot, not multiple: the cannon tower fires single rounds; tanks fire single heavy rounds', () => {
  assert.equal(STRUCTURES['STR-Cannon'].burst, 1);
  assert.equal(STRUCT_RECIPES['STR-Cannon'].burst, 1);
  const fx = createCombatFx();
  const st = {
    time: 0,
    units: new Map([
      [1, { id: 1, unitId: 'GND-Tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Walker', pos: { x: 10, y: 4 }, targetId: 100 }],
    ]),
    structures: new Map([[100, { id: 100, structId: 'STR-Cannon', kind: 'antiGround', lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1, tier: 1 }]]),
    base: { pos: { x: 16, y: 16 } },
  };
  const kicks = [];
  const opts = {
    getDef: () => ({ id: 'GND-Tank', projectileFx: 'shell' }),
    muzzle: () => ({ x: 4.9, y: 0.5, z: 4.5, dx: 1, dy: 0, dz: 0, bx: 4.6, by: 0.5, bz: 4.5 }),
    unitMuzzle: () => ({ x: 10, y: 0.4, z: 4.5, dx: -1, dy: 0, dz: 0, bx: 10.3, by: 0.4, bz: 4.5 }),
    unitHeavy: (id) => id === 1,
    kick: (key, n) => kicks.push([key, n, st.time]),
  };
  for (let i = 0; i < 60 * 4; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  const by = (k) => kicks.filter(([key]) => key === k).map(([, , t]) => t);
  const tower = by('s100'), tank = by('u1');
  assert.ok(tower.length >= 2, `tower shots ${tower.length}`);
  for (let i = 1; i < tower.length; i++) assert.ok(tower[i] - tower[i - 1] > 1, 'tower: separate single shots, no volley');
  assert.ok(tank.length >= 2, `tank shots ${tank.length}`);
  for (let i = 1; i < tank.length; i++) assert.ok(tank[i] - tank[i - 1] > 1, 'tank: separate single heavy shots');
});
