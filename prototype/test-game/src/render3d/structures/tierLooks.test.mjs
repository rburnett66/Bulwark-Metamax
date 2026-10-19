// [MM-story_mvey3eah_j] Tower tiers read at a glance — owner 2026-10-19: accent green / blue / gold for tiers 1 / 2 / 3;
// the gun barrels 50% / 75% / full length; the rocket launcher carries 2 / 3 / 4 rockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { SYSTEM_MODELS, TIER_ACCENT, TIER_BARREL, TIERED_MODELS, tierModelKey } from './systemModels.js';
import { mergeSystemModel, createSystemStructures, muzzlePoint } from './system3d.js';

const D = Math.PI / 180;
const hasColour = (geo, hex) => {
  const c = new THREE.Color(hex), a = geo.attributes.color.array;
  for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - c.r) < 1e-6 && Math.abs(a[i + 1] - c.g) < 1e-6 && Math.abs(a[i + 2] - c.b) < 1e-6) return true;
  return false;
};

test('every upgradable weapon tower has three tier models, each with its accent colour and no other tier\'s', () => {
  assert.deepEqual([...TIERED_MODELS], ['sys_cannon', 'sys_flak', 'sys_rockets', 'sys_missile']);
  for (const m of TIERED_MODELS) for (const t of [1, 2, 3]) {
    const key = tierModelKey(m, t), def = SYSTEM_MODELS[key];
    assert.ok(def && def.tier === t && def.accent === TIER_ACCENT[t], key);
    const parts = mergeSystemModel(THREE, def), geos = Object.values(parts).map((p) => p.geo);
    assert.ok(geos.some((g) => hasColour(g, TIER_ACCENT[t])), `${key}: accent drawn in the tier colour`);
    for (const o of [1, 2, 3]) if (o !== t) assert.ok(!geos.some((g) => hasColour(g, TIER_ACCENT[o])), `${key}: no tier-${o} colour`);
    assert.ok(!geos.some((g) => hasColour(g, 0xd0462c)), `${key}: the old red-orange accent is gone`);
  }
  assert.equal(tierModelKey('sys_wall', 2), 'sys_wall', 'walls are not weapon tiers');
  assert.equal(tierModelKey('sys_cannon', undefined), 'sys_cannon_t1');
  assert.equal(tierModelKey('sys_cannon', 9), 'sys_cannon_t3');
});

test('cannon + flak: the barrel past the cradle is 50% / 75% / 100% long; firing points and recoil follow', () => {
  for (const m of ['sys_cannon', 'sys_flak']) {
    const base = SYSTEM_MODELS[m], P = base.pivots.barrel, a = base.barrel.authored * D, root = base.tiers.tube;
    const along = (p) => (p[0] - P[0]) * Math.cos(a) + (p[1] - P[1]) * Math.sin(a);
    const full = along(base.muzzles[0].p);
    for (const t of [1, 2, 3]) {
      const def = SYSTEM_MODELS[tierModelKey(m, t)], got = along(def.muzzles[0].p);
      assert.ok(Math.abs((got - root) / (full - root) - TIER_BARREL[t]) < 1e-9, `${m} t${t}: tube ${((got - root) / (full - root)).toFixed(2)}`);
      // the drawn barrel ends where the firing point is: its furthest vertex along the axis
      const g = mergeSystemModel(THREE, def).barrel, pos = g.geo.attributes.position.array;
      let far = -Infinity;
      for (let i = 0; i < pos.length; i += 3) far = Math.max(far, pos[i] * Math.cos(a) + pos[i + 1] * Math.sin(a));   // geometry is relative to the pivot
      assert.ok(Math.abs(far - got) < 0.12, `${m} t${t}: barrel tip ${far.toFixed(2)} vs firing point ${got.toFixed(2)}`);
      if (base.recoil) assert.ok(Math.abs(def.recoil - base.recoil * TIER_BARREL[t]) < 1e-12, 'recoil scales with the barrel');
    }
    assert.ok(SYSTEM_MODELS[tierModelKey(m, 3)].muzzles[0].p.every((v, i) => v === base.muzzles[0].p[i]), `${m} t3: unchanged`);
  }
});

test('rocket launcher: 2 / 3 / 4 rockets — parts and firing points together', () => {
  const rockets = (def) => new Set(def.parts.filter((q) => q.rk).map((q) => q.rk)).size;
  for (const [t, n] of [[1, 2], [2, 3], [3, 4]]) {
    const def = SYSTEM_MODELS[tierModelKey('sys_rockets', t)];
    assert.equal(rockets(def), n, `t${t}: ${n} rockets drawn`);
    assert.equal(def.muzzles.length, n, `t${t}: ${n} firing points`);
    const drawn = new Set(def.parts.filter((q) => q.rk).map((q) => q.rk));
    assert.ok(def.muzzles.every((mz) => drawn.has(mz.rk)), 'every firing point is on a rocket that is there');
  }
  const t1 = SYSTEM_MODELS.sys_rockets_t1, it = { model: 'sys_rockets_t1', x: 0, z: 0, ry: 0, sy: 1 };
  assert.ok(muzzlePoint(it, 0, 0) && muzzlePoint(it, 0, 0).n === t1.muzzles.length, 'muzzlePoint cycles the tier\'s rockets');
});

test('binder: a tower draws as its tier model and an upgrade swaps it (and re-renders the shadow map)', () => {
  const sys = createSystemStructures(THREE, new THREE.Scene());
  const t = { id: 1, kind: 'antiGround', structId: 'STR-Cannon', cell: { x: 4, y: 4 }, lifecycle: 'Complete', hp: 10, maxHp: 10, tier: 1 };
  assert.equal(sys.setStructures([t]), true);
  assert.equal(sys.kinds.sys_cannon_t1.meshes.body.count, 1);
  assert.equal(sys.kinds.sys_cannon_t2.meshes.body.count, 0);
  assert.equal(sys.setStructures([{ ...t, tier: 2 }]), true, 'the upgrade changes the static set');
  assert.equal(sys.kinds.sys_cannon_t1.meshes.body.count, 0);
  assert.equal(sys.kinds.sys_cannon_t2.meshes.body.count, 1);
  sys.setStructures([{ ...t, tier: 3 }]);
  assert.equal(sys.kinds.sys_cannon_t3.meshes.body.count, 1);
  assert.equal(sys.muzzle(1, 0).n, 1);
  sys.dispose();
});

test('rocket fins: level 2 twice and level 3 three times level 1 (chord and span), trailing edge in place [MM-task_mveyuv9m_k]', () => {
  const A = SYSTEM_MODELS.sys_rockets.barrel.authored * D, u = [Math.cos(A), Math.sin(A)];
  const fins = (t) => SYSTEM_MODELS[tierModelKey('sys_rockets', t)].parts.filter((q) => q.fin);
  const f1 = fins(1);
  assert.ok(f1.length === 4, 'two cross fins on each of 2 rockets');
  for (const [t, k] of [[2, 2], [3, 3]]) {
    for (const q of fins(t)) {
      const b = SYSTEM_MODELS.sys_rockets.parts.find((p) => p.fin && p.rk === q.rk && p.r3[0] === q.r3[0]);
      assert.ok(Math.abs(q.s[0] - b.s[0] * k) < 1e-12 && Math.abs(q.s[2] - b.s[2] * k) < 1e-12 && q.s[1] === b.s[1], `t${t}: ${k}× chord + span, same thickness`);
      const tail = (f) => (f.p[0] * u[0] + f.p[1] * u[1]) - f.s[0] / 2;
      assert.ok(Math.abs(tail(q) - tail(b)) < 1e-9, `t${t}: trailing edge fixed`);
    }
  }
  assert.ok(f1.every((q) => { const b = SYSTEM_MODELS.sys_rockets.parts.find((p) => p.fin && p.rk === q.rk && p.r3[0] === q.r3[0]); return q.s[0] === b.s[0]; }), 'level 1 = the authored fins');
});
