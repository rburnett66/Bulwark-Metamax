// [MM-story_mvedxxo7_7] System tower barrels pitch to the launch slope; [MM-story_mvedxzco_8] towers aim at structures
// and the base as well as units. docs/tech-plan/3D-Combat-Polish.md §3.2.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { SYSTEM_MODELS } from './systemModels.js';
import { mergeSystemModel, muzzlePoint, createSystemStructures, towerTarget, barrelPitchFor } from './system3d.js';
import { createCombatFx, wantPitch } from '../fx/combatFxModel.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';

const D = Math.PI / 180;
const ARMED = ['sys_cannon', 'sys_flak', 'sys_rockets', 'sys_missile'];

test('every armed tower has a barrel group about a trunnion pivot, with sane limits', () => {
  for (const k of ARMED) {
    const def = SYSTEM_MODELS[k], g = mergeSystemModel(THREE, def);
    assert.ok(g.barrel && g.barrel.tris > 10, `${k}: barrel geometry`);
    assert.ok(def.pivots.barrel, `${k}: trunnion pivot`);
    const b = def.barrel;
    assert.ok(b.min < b.max && b.rest >= b.min && b.rest <= b.max && b.rate > 0, `${k}: limits`);
  }
});

test('muzzlePoint: at rest it is the authored tip; pitched up, the tip rises and the axis follows', () => {
  for (const k of ARMED) {
    const it = { model: k, x: 4.5, z: 4.5, ry: 0, sy: 1 }, b = SYSTEM_MODELS[k].barrel;
    const rest = muzzlePoint(it, 0, 0), same = muzzlePoint(it, 0, 0, b.rest * D);
    assert.ok(Math.abs(rest.y - same.y) < 1e-9 && Math.abs(rest.x - same.x) < 1e-9, `${k}: default = rest`);
    const up = muzzlePoint(it, 0, 0, Math.min(b.max, b.rest + 20) * D);
    assert.ok(up.y > rest.y && up.dy > rest.dy, `${k}: raised`);
    assert.ok(Math.abs(Math.asin(up.dy) - Math.min(b.max, b.rest + 20) * D) < 1e-6, `${k}: the axis IS the pitch`);
    assert.ok(up.pmin === b.min * D && up.pmax === b.max * D && up.aim === b.aim, `${k}: reports limits`);
  }
});

test('the cannon barrel wants a higher pitch for a farther target (the shell lob)', () => {
  const bar = SYSTEM_MODELS.sys_cannon.barrel, m = { x: 0, y: 0.6, z: 0 };
  const near = barrelPitchFor(bar, m, { x: 1.5, y: 0.3, z: 0 }), far = barrelPitchFor(bar, m, { x: 4.5, y: 0.3, z: 0 });
  assert.ok(far > near + 10 * D, `near ${(near / D).toFixed(1)}° far ${(far / D).toFixed(1)}°`);
  assert.ok(barrelPitchFor(SYSTEM_MODELS.sys_flak.barrel, m, { x: 1, y: 2.5, z: 0 }) > 45 * D, 'flak looks up at a close plane');
  assert.ok(barrelPitchFor(bar, m, { x: 0.4, y: -3, z: 0 }) >= bar.min * D, 'clamped at the depression limit');
});

test('towerTarget resolves units, drawn flyers, structures and the base', () => {
  const state = {
    units: new Map([[9, { pos: { x: 3, y: 4 }, hp: 5 }], [10, { pos: { x: 1, y: 1 }, hp: 0 }]]),
    structures: new Map([[50, { pos: { x: 8, y: 2 }, footprint: { w: 2, h: 2 }, lifecycle: 'Complete' }]]),
    base: { pos: { x: 16, y: 16 } },
  };
  assert.deepEqual(towerTarget(state, { targetId: 9 }).x, 3.5);
  assert.equal(towerTarget(state, { targetId: 10 }), null, 'dead unit');
  const st = towerTarget(state, { targetId: 50 });
  assert.ok(st.x === 9 && st.z === 3, 'structure footprint centre');
  const b = towerTarget(state, { targetId: BASE_TARGET_ID });
  assert.ok(b.x === 16.5 && b.z === 16.5, 'base');
  const dp = towerTarget(state, { targetId: 9 }, new Map([[9, { x: 1, y: 2, z: 3 }]]));
  assert.ok(dp.x === 1 && dp.y === 2, 'drawn pose wins');
});

test('binder: a tower turns to a STRUCTURE target and its barrel climbs for a far one, then eases back idle', () => {
  const scene = new THREE.Scene(), sys = createSystemStructures(THREE, scene);
  sys.setBase({ x: 6, y: 5 });
  const tower = { id: 1, kind: 'antiGround', structId: 'STR-Cannon', cell: { x: 10, y: 5 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: 77 };
  sys.setStructures([tower]);
  const state = { units: new Map(), structures: new Map([[77, { pos: { x: 10, y: 9 }, lifecycle: 'Complete' }]]) };   // 4 cells south
  const rest = sys.pitch(1);
  for (let i = 0; i < 90; i++) sys.update(1 / 30, state);
  const m = sys.muzzle(1, 0);
  assert.ok(m.dz > 0.75, `turned south to the structure (dz ${m.dz.toFixed(2)})`);
  const p = sys.pitch(1);
  assert.ok(p > rest + 5 * D, `barrel up for the lob (${(p / D).toFixed(1)}°)`);
  assert.ok(Math.abs(Math.asin(m.dy) - p) < 1e-6, 'firing point follows the pitch');
  assert.ok(Math.abs(p - wantPitch(m, { x: 10.5, y: 0.5, z: 9.5 })) < 0.12, 'on the launch slope the fx gate wants');
  const B = sys.kinds.sys_cannon.meshes.barrel, mat = new THREE.Matrix4(); B.getMatrixAt(0, mat);
  const ax = new THREE.Vector3(1, 0, 0).transformDirection(mat);
  assert.ok(Math.abs(Math.asin(ax.y) - (p - SYSTEM_MODELS.sys_cannon.barrel.authored * D)) < 0.02, 'the drawn barrel pitches by the same amount');
  tower.targetId = null; sys.setStructures([{ ...tower }]);
  for (let i = 0; i < 120; i++) sys.update(1 / 30, state);
  assert.ok(Math.abs(sys.pitch(1) - rest) < 1e-6, 'idle: back to rest');
  sys.dispose();
});

test('fx gate: a pitching barrel holds fire until its elevation is on the launch slope', () => {
  const fx = createCombatFx();
  const st = {
    time: 0,
    units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 8, y: 4 }, targetId: null }]]),
    structures: new Map([[100, { id: 100, structId: 'STR-Cannon', kind: 'antiGround', lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
    base: { pos: { x: 16, y: 16 } },
  };
  const tip = { x: 4.9, y: 0.6, z: 4.5 }, to = { x: 8.5, y: 0.3, z: 4.5 };
  let el = 0;
  const muzzle = () => ({ ...tip, dx: Math.cos(el), dy: Math.sin(el), dz: 0, bx: 4.6, by: 0.55, bz: 4.5, pmin: -5 * D, pmax: 45 * D, aim: 'shell' });
  const fired = [];
  const opts = { getDef: () => null, muzzle, fire: (k) => fired.push(k) };
  for (let i = 0; i < 60; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  assert.equal(fired.length, 0, 'flat barrel, lobbed shot: holds');
  el = wantPitch(muzzle(), to);
  for (let i = 0; i < 120; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  assert.ok(fired.length >= 1, 'elevated: fires');
});

test('rocket rack: stays under 50° at every range, so its turn toward the target reads [MM-task_mvejw9k0_m]', () => {
  for (const [dx, dz] of [[1.5, 0], [0, 3], [-5, 0], [0, -8], [7, 7]]) {
    const sys = createSystemStructures(THREE, new THREE.Scene());
    sys.setBase({ x: 0, y: 0 });
    sys.setStructures([{ id: 1, kind: 'antiGround', structId: 'STR-Rockets', cell: { x: 20, y: 20 }, lifecycle: 'Complete', hp: 10, maxHp: 10, targetId: 9 }]);
    const st = { units: new Map([[9, { pos: { x: 20 + dx, y: 20 + dz }, hp: 5 }]]) };
    for (let i = 0; i < 90; i++) sys.update(1 / 30, st);
    const p = sys.pitch(1);
    assert.ok(p <= 50 * D + 1e-9 && p >= 30 * D, `pitch ${(p / D).toFixed(1)}° at (${dx},${dz})`);
    const M = new THREE.Matrix4(); sys.kinds.sys_rockets.meshes.barrel.getMatrixAt(0, M);
    const ax = new THREE.Vector3(1, 0, 0).transformDirection(M), h = Math.hypot(ax.x, ax.z);
    assert.ok(h > 0.6 && (ax.x * dx + ax.z * dz) / (h * Math.hypot(dx, dz)) > 0.97, `the rack points at the target (${dx},${dz})`);
    sys.dispose();
  }
});
