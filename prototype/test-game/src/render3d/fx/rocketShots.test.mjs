// [MM-task_mvf0kzw4_l] The rocket tower's round is the rack's rocket of the tower's tier — accent tip, fin size — drawn
// nose first along its flight, one InstancedMesh per tier.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { rocketShotModel, TIER_ACCENT, SYSTEM_MODELS } from '../structures/systemModels.js';
import { createRocketShots, rocketMatrix, ROCKET_SHOT_SCALE } from './rocketShots.js';
import { createCombatFx } from './combatFxModel.js';
import { mergeSystemModel } from '../structures/system3d.js';

test('rocketShotModel: one rocket, nose at the origin, body down −x, the tier\'s accent and fins', () => {
  for (const t of [1, 2, 3]) {
    const def = rocketShotModel(t), g = mergeSystemModel(THREE, def).body.geo, P = g.attributes.position.array;
    let minX = Infinity, maxX = -Infinity, maxYZ = 0;
    for (let i = 0; i < P.length; i += 3) { minX = Math.min(minX, P[i]); maxX = Math.max(maxX, P[i]); maxYZ = Math.max(maxYZ, Math.hypot(P[i + 1], P[i + 2])); }
    assert.ok(Math.abs(maxX) < 0.03, `t${t}: nose tip at x≈0 (${maxX.toFixed(3)})`);
    assert.ok(minX < -3 && minX > -4.2, `t${t}: the body runs ~3.5 model units back (${minX.toFixed(2)})`);
    assert.equal(def.accent, TIER_ACCENT[t]);
    assert.equal(def.parts.filter((q) => q.fin).length, 2, 'two cross fins');
    const fin = def.parts.find((q) => q.fin), rack = SYSTEM_MODELS[`sys_rockets_t${t}`].parts.find((q) => q.fin);
    assert.equal(fin.s[0], rack.s[0], `t${t}: the rack\'s fin size`);
    assert.ok(maxYZ < 0.2 * 2 + rack.s[2], 'no stray parts off the axis');
  }
  assert.ok(rocketShotModel(3).parts.find((q) => q.fin).s[0] > rocketShotModel(1).parts.find((q) => q.fin).s[0], 'level 3 fins larger');
});

test('rocketMatrix: +x maps to the flight direction, the origin to the nose, scale k', () => {
  const d = { x: 0.6, y: 0.48, z: -0.64 }, l = Math.hypot(d.x, d.y, d.z); d.x /= l; d.y /= l; d.z /= l;
  const M = new THREE.Matrix4().fromArray(rocketMatrix({ x: 3, y: 1, z: 2 }, d, 0.3));
  const o = new THREE.Vector3(0, 0, 0).applyMatrix4(M), a = new THREE.Vector3(1, 0, 0).applyMatrix4(M).sub(o);
  assert.ok(o.distanceTo(new THREE.Vector3(3, 1, 2)) < 1e-9);
  assert.ok(Math.abs(a.length() - 0.3) < 1e-9 && a.normalize().dot(new THREE.Vector3(d.x, d.y, d.z)) > 0.999999);
  assert.ok(Math.abs(new THREE.Matrix4().fromArray(rocketMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 1)).determinant() - 1) < 1e-9, 'straight up stays a rotation');
});

test('a rocket tower\'s rounds carry its tier and draw in that tier\'s mesh', () => {
  const view = createRocketShots(THREE, new THREE.Scene());
  const st = (tier) => ({
    time: 0,
    units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 12, y: 4 }, targetId: null }]]),
    structures: new Map([[100, { id: 100, structId: 'STR-Rockets', kind: 'antiGround', tier, lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
    base: { pos: { x: 16, y: 16 } },
  });
  for (const tier of [1, 2, 3]) {
    const f = createCombatFx(), s = st(tier);
    for (let i = 0; i < 9; i++) { s.time += 1 / 30; f.update(s, {}, [], 1 / 30, { getDef: () => null }); }   // the first rocket is aloft
    const rockets = f.shots.filter((x) => x.kind === 'rocket');
    assert.ok(rockets.length > 0 && rockets.every((x) => x.tier === tier), `tier ${tier} rounds`);
    view.sync(f);
    for (const t of [1, 2, 3]) assert.equal(view.tiers[t].mesh.count > 0, t === tier, `tier ${tier}: only mesh t${t === tier ? t : t + ' empty'}`);
  }
  assert.ok(Math.abs(view.tail - SYSTEM_MODELS.sys_rockets.muzzles[0].back * ROCKET_SHOT_SCALE) < 1e-12, 'the flame starts a rocket length behind the nose');
  view.dispose();
});
