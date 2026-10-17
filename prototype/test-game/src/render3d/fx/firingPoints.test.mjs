// [MM-task_mvbz1121_11] firing points: rounds leave the modelled barrel / rail tips, turrets hold fire until on
// target, barrels cycle, and every launch hands its firing point to the launch-effects hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatFx } from './combatFxModel.js';
import { muzzlePoint } from '../structures/system3d.js';
import { SYSTEM_MODELS, SYSTEM_SCALE } from '../structures/systemModels.js';
import { yawToward } from '../structures/models.js';

const MAP = { base: { x: 16, y: 16 } };
const getDef = () => null;
const world = (structId, kind) => ({
  time: 0,
  units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 10, y: 4 }, targetId: null }]]),
  structures: new Map([[100, { id: 100, structId, kind, lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
  base: { pos: { x: 16, y: 16 } },
});

test('every armed System tower declares firing points; the cannon\'s sits at its barrel tip', () => {
  for (const k of ['sys_cannon', 'sys_flak', 'sys_rockets', 'sys_missile']) assert.ok(SYSTEM_MODELS[k].muzzles.length >= 1, k);
  assert.equal(SYSTEM_MODELS.sys_flak.muzzles.length, 2);
  assert.equal(SYSTEM_MODELS.sys_rockets.muzzles.length, 4);
  assert.equal(SYSTEM_MODELS.sys_missile.muzzles.length, 8);
  const it = { model: 'sys_cannon', x: 4.5, z: 4.5, ry: 0, sy: 1 };
  const m = muzzlePoint(it, 0, 0);
  const k = SYSTEM_SCALE.sys_cannon;
  assert.ok(Math.abs(m.x - (4.5 + 3.78 * k)) < 0.02 && Math.abs(m.y - 2.47 * k) < 0.02 && Math.abs(m.z - 4.5) < 1e-6, JSON.stringify(m));
  assert.ok(m.dx > 0.95 && m.dy > 0.1, 'points out along the elevated barrel');
});

test('the firing point turns with the turret: aimed at a target, it lies between tower and target', () => {
  for (const ry of [0, 1.3, -2.2]) {
    const it = { model: 'sys_cannon', x: 4.5, z: 4.5, ry, sy: 1 };
    for (const [tx, tz] of [[10.5, 4.5], [4.5, 12.5], [0.5, 0.5]]) {
      const wy = yawToward(tx - it.x, tz - it.z), m = muzzlePoint(it, wy, 0);
      const hx = tx - it.x, hz = tz - it.z, hl = Math.hypot(hx, hz);
      const along = ((m.x - it.x) * hx + (m.z - it.z) * hz) / hl, off = Math.abs((m.x - it.x) * hz - (m.z - it.z) * hx) / hl;
      assert.ok(along > 1.0 && off < 0.02, `ry ${ry} → (${tx},${tz}): along ${along.toFixed(2)} off ${off.toFixed(3)}`);
      assert.ok((m.dx * hx + m.dz * hz) / hl > 0.95, 'barrel axis toward the target');
    }
  }
  const r = muzzlePoint({ model: 'sys_rockets', x: 0.5, z: 0.5, ry: 0, sy: 1 }, 0, 0);
  assert.ok(r.bx < r.x && r.by < r.y, 'the rocket nozzle end is behind and below the nose');
  assert.equal(muzzlePoint({ model: 'sys_wall', x: 0, z: 0, ry: 0 }, 0, 0), null);
});

test('rounds leave from the supplied firing point, cycle the barrels, and fire the launch hook', () => {
  const fx = createCombatFx();
  const st = world('STR-Flak', 'antiAir');
  const asked = [], fired = [];
  const tips = [{ x: 5.3, y: 0.45, z: 4.55 }, { x: 5.3, y: 0.45, z: 4.45 }];
  const opts = {
    getDef, trail: () => {},
    muzzle: (id, n) => { asked.push(n); const t = tips[n % 2]; return { ...t, dx: 1, dy: 0, dz: 0, bx: t.x - 0.3, by: t.y, bz: t.z, brake: 0 }; },
    fire: (kind, m) => fired.push({ kind, x: m.x, z: m.z }),
  };
  for (let i = 0; i < 90; i++) { st.time += 1 / 60; fx.update(st, MAP, [], 1 / 60, opts); }
  assert.ok(fired.length >= 3, `several launches (${fired.length})`);
  for (const f of fired) assert.ok(tips.some((t) => Math.abs(t.x - f.x) < 1e-9 && Math.abs(t.z - f.z) < 1e-9), 'each from a barrel tip');
  assert.ok(new Set(fired.map((f) => f.z)).size === 2, 'both barrels fire');
  assert.ok(fx.launched === fired.length, 'one hook call per round');
});

test('a turret still slewing holds fire; once its barrel is on target it fires', () => {
  const fx = createCombatFx();
  const st = world('STR-Tower', 'antiGround');
  let dir = { dx: 0, dz: 1 };   // pointing away (south) from the target (east)
  const fired = [];
  const opts = { getDef, muzzle: () => ({ x: 4.9, y: 0.7, z: 4.5, ...dir, dy: 0, bx: 4.6, by: 0.7, bz: 4.5 }), fire: (k) => fired.push(k) };
  for (let i = 0; i < 60; i++) { st.time += 1 / 60; fx.update(st, MAP, [], 1 / 60, opts); }
  assert.equal(fired.length, 0, 'off target: no rounds');
  dir = { dx: 1, dz: 0 };
  for (let i = 0; i < 30; i++) { st.time += 1 / 60; fx.update(st, MAP, [], 1 / 60, opts); }
  assert.ok(fired.length >= 1 && fired[0] === 'shell', `on target: fires (${fired.length})`);
});

test('missiles leave along the tube axis; rockets report their flight fraction to the trail', () => {
  const fx = createCombatFx();
  const st = world('STR-Rockets', 'antiGround');
  const fr = [];
  const opts = { getDef, trail: (kind, x, y, z, k, dx, dy, dz, t) => { if (kind === 'rocket') fr.push(t); } };
  for (let i = 0; i < 120; i++) { st.time += 1 / 60; fx.update(st, MAP, [], 1 / 60, opts); }
  assert.ok(fr.length > 10 && fr.every((t) => t >= 0 && t <= 1) && Math.max(...fr) === 1, 'fraction 0..1');
  const fm = createCombatFx(), sm = world('STR-Missile', 'antiAir');
  const tube = { x: 4.8, y: 0.62, z: 4.5, dx: 0.95, dy: 0.31, dz: 0, bx: 4.45, by: 0.5, bz: 4.5 };
  fm.update(sm, MAP, [], 1 / 60, { getDef, muzzle: () => tube });
  const s = fm.shots.find((q) => q.kind === 'missile');
  assert.ok(s && s.x === tube.x && s.vx > 2.5 && Math.abs(s.vz) < 1.2, 'off the rail, forward');
});
