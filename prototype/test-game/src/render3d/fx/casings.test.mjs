// src/render3d/fx/casings.test.mjs — Machine Gun brass [MM-story_mvk3kwu2_m]: "spray brass bullet casings up and to
// the right from the gun base".
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASINGS, createCasings } from './casings.js';
import { SYSTEM_MODELS } from '../structures/systemModels.js';
import { ejectPoint, muzzlePoint } from '../structures/system3d.js';

test('a casing flies up and out along the eject direction, falls, bounces, lies still, then fades away', () => {
  const c = createCasings({ seed: 3 });
  c.emit({ x: 5, y: 0.6, z: 5, dx: 0, dy: 0.8, dz: 0.6 });
  let maxY = 0, landedAt = null;
  for (let t = 0; t < 1.5; t += 1 / 60) {
    c.step(1 / 60);
    const p = c.instances()[0];
    maxY = Math.max(maxY, p.y);
    if (landedAt == null && p.y <= CASINGS.radius + 1e-9 && t > 0.1) landedAt = { ...p };
  }
  assert.ok(maxY > 0.65, 'rises first');
  assert.ok(landedAt && landedAt.z > 5.2, 'lands out on the eject side');
  const rest = c.instances()[0];
  c.step(0.05); assert.deepEqual([c.instances()[0].x, c.instances()[0].z], [rest.x, rest.z], 'then lies still');
  for (let t = 0; t < CASINGS.life + 1; t += 0.05) c.step(0.05);
  assert.equal(c.count, 0, 'gone after its life');
});

test('the cap holds (oldest go first) and the scatter is repeatable', () => {
  const c = createCasings({ cap: 10 });
  for (let i = 0; i < 25; i++) c.emit({ x: i, y: 1, z: 0, dx: 0, dy: 1, dz: 1 });
  assert.equal(c.count, 10);
  assert.equal(c.instances()[0].x, 15);
  const a = createCasings({ seed: 9 }), b = createCasings({ seed: 9 });
  for (const q of [a, b]) { q.emit({ x: 0, y: 1, z: 0, dx: 0, dy: 1, dz: 1 }); q.step(0.2); }
  assert.deepEqual(a.instances(), b.instances());
});

test('the ejection port is on the gun\'s RIGHT and points up-and-right, following the turret', () => {
  const def = SYSTEM_MODELS.sys_mg;
  assert.ok(def.eject && def.muzzles && def.muzzles.length === 1, 'the MG has a firing point and an ejection port');
  for (const wy of [0, Math.PI / 2, 2.3]) {
    const it = { model: 'sys_mg', x: 10.5, z: 10.5, ry: 0 };
    const e = ejectPoint(it, wy), m = muzzlePoint(it, wy, 0);
    const fx = m.dx, fz = m.dz, rx = -fz, rz = fx;   // right of forward (fx, fz) with y up = (−fz, fx)… check against the port offset
    // forward × up = right: (fx,0,fz) × (0,1,0) = (−fz, 0, fx)
    const ox = e.x - it.x, oz = e.z - it.z;
    assert.ok(ox * rx + oz * rz > 0, `port on the right at yaw ${wy}`);
    assert.ok(e.dy > 0.6, 'brass goes up');
    assert.ok(e.dx * rx + e.dz * rz > 0.3, 'and out to the right');
  }
});
