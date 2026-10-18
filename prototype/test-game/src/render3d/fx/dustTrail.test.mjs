// [MM-task_mvd2loid_i] dust trails: moving ground vehicles kick up dust from behind; stopped ones and flyers don't.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDustTrails, DUST } from './dustTrail.js';
import { K } from './impacts.js';

test('a moving tank kicks up dust behind it; a stopped tank and a jet emit nothing', () => {
  const dust = createDustTrails(), out = [];
  const emit = (kind, x, y, z) => out.push({ kind, x, z });
  let x = 5.5;
  for (let i = 0; i < 60; i++) {
    x += 1.2 / 60;   // full speed, heading +x
    dust.step(1 / 60, [{ id: 1, model: 'tank', scale: 1, x, z: 3.5, y: 0, heading: 0 }, { id: 2, model: 'jet', scale: 1, x, z: 6.5, y: 0.9, heading: 0 }], emit, K);
  }
  assert.ok(Math.abs(out.length - 2 * DUST.rate) <= 2, `~${2 * DUST.rate}/s (${out.length})`);
  assert.ok(out.every((p) => p.kind === K.SMOKE && Math.abs(p.z - 3.5) < 0.35), 'only the tank, around its tracks');
  const last = out[out.length - 1];
  assert.ok(last.x < x, 'from behind the hull');
  out.length = 0;
  for (let i = 0; i < 60; i++) dust.step(1 / 60, [{ id: 1, model: 'tank', scale: 1, x, z: 3.5, y: 0, heading: 0 }], emit, K);
  assert.equal(out.length, 0, 'stopped: no dust');
});

test('flash lights: bigger flashes light brighter and wider; a pool reuses its dimmest light [MM-task_mvd2lrig_k]', async () => {
  const { lightFor, createFlashLights } = await import('./flashLights.js');
  const THREE = await import('../../../vendor/three.module.js');
  const a = lightFor(0.5, 0.08), b = lightFor(4.4, 0.5);
  assert.ok(b.intensity > a.intensity && b.distance > a.distance && b.life > a.life);
  const scene = new THREE.Scene(), fl = createFlashLights(THREE, scene, 2);
  fl.fromFlashes([{ age: 0, size0: 4.4, ttl: 0.5, x: 1, y: 0.3, z: 1, color: 0xffc070 }, { age: 0, size0: 0.5, ttl: 0.08, x: 2, y: 0.3, z: 2, color: 0xfff0b0 }, { age: 0.1, size0: 2, ttl: 0.2, x: 0, y: 0, z: 0, color: 0 }]);
  const lit = scene.children.filter((o) => o.isPointLight && o.intensity > 0);
  assert.equal(lit.length, 2, 'both new flashes lit, the old one ignored');
  fl.update(1); assert.ok(scene.children.every((o) => !o.isPointLight || o.intensity === 0), 'decayed out');
});
