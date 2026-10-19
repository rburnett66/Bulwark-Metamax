// [MM-task_mvfqb2gm_4] flak: small black balls, straight and fast (no tracking), bursting in black puffs.
// [MM-task_mvfqb454_5] missiles: half-size rockets (the tower's tier) with an orange flame out of the nozzle.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createCombatFx, STRUCT_RECIPES, RECIPES, FLASH } from './combatFxModel.js';
import { createCombatFxView } from './combatFx.js';
import { createFlakShots, FLAK_BALL } from './flakShots.js';
import { createRocketShots, ROCKET_SHOT_SCALE, MISSILE_SHOT_SCALE } from './rocketShots.js';

const plane = (o) => ({ id: 1, unitId: 'jet', hp: 10, maxHp: 10, side: 'attacker', domain: 'Flyer', altitude: 1, pos: { x: 10, y: 4 }, targetId: null, ...o });
const world = (structId, kind, tier = 1) => ({
  time: 0,
  units: new Map([[1, plane()]]),
  structures: new Map([[100, { id: 100, structId, kind, tier, lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
  base: { pos: { x: 16, y: 16 } },
});

test('flak tower: fast unguided flak rounds, not homing missiles', () => {
  const R = STRUCT_RECIPES['STR-Flak'];
  assert.equal(R.kind, 'flak');
  assert.ok(R.speed > RECIPES.antiAir.speed * 2, 'goes fast');
  const fx = createCombatFx(), st = world('STR-Flak', 'antiAir');
  let first = null;
  for (let i = 0; i < 6 && !first; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, { getDef: () => null }); first = fx.shots.find((s) => s.kind === 'flak'); }
  assert.ok(first, 'fires flak');
  assert.ok(!fx.shots.some((s) => s.kind === 'missile'), 'no missiles');
  const d0 = { x: first.dx, y: first.dy, z: first.dz }, aim = { x: first.tx, y: first.ty, z: first.tz };
  st.units.get(1).pos = { x: 4, y: 12 };   // the plane jinks away: an unguided round does not follow
  for (let i = 0; i < 3; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, { getDef: () => null }); }
  if (fx.shots.includes(first)) {
    assert.deepEqual({ x: first.dx, y: first.dy, z: first.dz }, d0, 'straight line');
    assert.deepEqual({ x: first.tx, y: first.ty, z: first.tz }, aim, 'bursts where it was aimed');
  }
});

test('flak burst: a small orange pop and a black-puff trail at the burst point', () => {
  assert.ok(FLASH.flak.size < 0.8 && FLASH.flak.ttl <= 0.12, 'a small quick pop');
  const fx = createCombatFx(), st = world('STR-Flak', 'antiAir'), puffs = [];
  const opts = { getDef: () => null, trail: (kind, x, y, z) => { if (kind === 'flak') puffs.push({ x, y, z }); } };
  for (let i = 0; i < 90; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  assert.ok(puffs.length >= 1, `${puffs.length} black puffs`);
  assert.ok(puffs.every((p) => p.y > 0.5), 'up in the air by the plane');
});

test('flak rounds draw as small black balls; the glow view skips them', () => {
  const fx = createCombatFx(), st = world('STR-Flak', 'antiAir');
  for (let i = 0; i < 4; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, { getDef: () => null }); }
  const n = fx.shots.filter((s) => s.kind === 'flak').length;
  assert.ok(n > 0);
  const scene = new THREE.Scene(), balls = createFlakShots(THREE, scene);
  assert.equal(balls.sync(fx), n);
  assert.ok(balls.mesh.visible && balls.mesh.count === n);
  const c = balls.mesh.material.color;
  assert.ok(c.r < 0.1 && c.g < 0.1 && c.b < 0.1, 'black');
  assert.ok(FLAK_BALL.radius < 0.12, 'small');
  const glow = createCombatFxView(THREE, scene, 64);
  const all = glow.sync(fx); glow.skipFlak = true; const without = glow.sync(fx);
  assert.equal(all - without, n, 'not drawn as glow dots');
  balls.dispose();
});

test('missile tower: rounds draw as that tier\'s rocket at half the rack scale; the glow view skips them', () => {
  assert.ok(Math.abs(MISSILE_SHOT_SCALE - ROCKET_SHOT_SCALE * 0.5) < 1e-12);
  const view = createRocketShots(THREE, new THREE.Scene());
  assert.ok(Math.abs(view.missileTail - view.tail * 0.5) < 1e-12, 'the flame starts at the half-size nozzle');
  for (const tier of [1, 3]) {
    const fx = createCombatFx(), st = world('STR-Missile', 'antiAir', tier);
    for (let i = 0; i < 6; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, { getDef: () => null }); }
    const m = fx.shots.filter((s) => s.kind === 'missile');
    assert.ok(m.length > 0 && m.every((s) => s.tier === tier), `tier ${tier} missiles aloft`);
    view.sync(fx);
    const mesh = view.tiers[tier].mesh, M = new THREE.Matrix4(); mesh.getMatrixAt(0, M);
    const sc = new THREE.Vector3().setFromMatrixScale(M);
    assert.ok(Math.abs(sc.x - MISSILE_SHOT_SCALE) < 1e-6, `half-size rocket (${sc.x.toFixed(4)})`);
    const glow = createCombatFxView(THREE, new THREE.Scene(), 64);
    const all = glow.sync(fx); glow.skipMissiles = true;
    assert.equal(all - glow.sync(fx), m.length, 'not drawn as glow dots');
  }
  view.dispose();
});

test('missile flame trail leaves from the half-size nozzle', () => {
  const fx = createCombatFx(), st = world('STR-Missile', 'antiAir'), trails = [];
  const opts = { getDef: () => null, missileTail: 0.05, trail: (kind, x, y, z) => { if (kind === 'missile') trails.push({ x, y, z }); } };
  for (let i = 0; i < 12; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  const s = fx.shots.find((q) => q.kind === 'missile'), t = trails[trails.length - 1];
  assert.ok(s && t, 'a missile in flight with a trail');
  const back = Math.hypot(s.x - t.x, s.y - t.y, s.z - t.z);
  assert.ok(Math.abs(back - 0.05) < 1e-6, `flame ${back.toFixed(3)} behind the nose`);
});
