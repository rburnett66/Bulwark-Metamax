// [MM-task_mvbvpyer_x] the base super-cannon in 3D: reticle, arcing shell from the muzzle, touchdown blast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCannonFx, CANNON_FX } from './cannonFx.js';

test('aim shows a reticle at the blast radius; the shell arcs from the muzzle and detonates on touchdown', () => {
  const fx = createCannonFx({ seed: 2 });
  const calls = { boom: [], burn: 0, emit: 0 };
  const impacts = { boom: (x, z, k, f) => calls.boom.push({ x, z, k, f }), burn: () => calls.burn++, emit: () => calls.emit++ };
  fx.onEvents([{ type: 'cannonAim', pos: { x: 20, y: 8 }, dur: 3, radius: 2.5 }], null);
  assert.equal(fx.reticles.length, 1);
  assert.deepEqual([fx.reticles[0].x, fx.reticles[0].z, fx.reticles[0].r], [20.5, 8.5, 2.5]);
  for (let i = 0; i < 90; i++) fx.step(1 / 30, impacts);
  assert.equal(fx.reticles.length, 1, 'held through the aim');
  fx.onEvents([{ type: 'cannonShot', from: { x: 10, y: 8 }, to: { x: 20, y: 8 }, dur: 1.6, radius: 2.5 }], () => ({ x: 10.9, y: 1.4, z: 8.5 }));
  const s = fx.shells[0];
  assert.deepEqual([s.fx, s.fy, s.fz], [10.9, 1.4, 8.5], 'leaves the roof gun\'s muzzle');
  let peak = 0;
  for (let i = 0; i < 24; i++) { fx.step(1 / 30, impacts); if (fx.shells[0]) peak = Math.max(peak, fx.shells[0].y); }
  assert.ok(peak > CANNON_FX.apex, `arcs high (${peak.toFixed(2)})`);
  assert.equal(calls.boom.length, 0, 'not before touchdown');
  for (let i = 0; i < 30; i++) fx.step(1 / 30, impacts);
  assert.equal(fx.shells.length, 0);
  assert.equal(calls.boom.length, 1, 'one detonation');
  assert.deepEqual([calls.boom[0].x, calls.boom[0].z, calls.boom[0].f], [20.5, 8.5, true]);
  assert.ok(calls.burn >= CANNON_FX.fires[0] && calls.burn <= CANNON_FX.fires[1], `fires over the blast disk (${calls.burn})`);
  assert.ok(calls.emit > 10, 'a fire-and-smoke trail');
  assert.equal(fx.reticles.length, 0, 'the reticle goes with the shell');
  assert.ok(fx.shake > 0, 'a camera thump');
});

test('each base fires its own weapon look; the main round always lands at the sim impact time', async () => {
  const { baseStyleFor, BASE_STYLES } = await import('./cannonFx.js');
  assert.equal(baseStyleFor('rocket launcher'), 'rockets');
  assert.equal(baseStyleFor('anti-aircraft missiles'), 'missiles');
  assert.equal(baseStyleFor('mortar'), 'mortar');
  assert.equal(baseStyleFor('cannon (railgun)'), 'rail');
  assert.equal(baseStyleFor('anti-troop gun'), 'gatling');
  assert.equal(baseStyleFor('shield'), 'energy');
  assert.equal(baseStyleFor('cannon'), 'shell');
  for (const style of Object.keys(BASE_STYLES)) {
    const fx = createCannonFx({ seed: 3, style });
    const booms = [];
    const impacts = { boom: (x, z, k, f) => booms.push({ k, f, t }), burn: () => {}, emit: () => {}, fxGround: () => {} };
    fx.onEvents([{ type: 'cannonShot', from: { x: 10, y: 8 }, to: { x: 20, y: 8 }, dur: 1.6, radius: 2.5 }], null);
    assert.equal(fx.shells.length, BASE_STYLES[style].n, `${style}: rounds`);
    var t = 0, mainAt = null;
    for (; t < 2.4; t += 1 / 60) { fx.step(1 / 60, impacts); if (mainAt === null && booms.some((b) => b.f)) mainAt = t; }
    assert.ok(mainAt !== null && Math.abs(mainAt - 1.6) < 0.05, `${style}: main blast at the sim impact (${mainAt && mainAt.toFixed(2)})`);
    assert.equal(fx.shells.length, 0, `${style}: all rounds landed`);
  }
});
