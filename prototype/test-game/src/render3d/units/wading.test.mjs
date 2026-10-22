import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_MODELS } from './models.js';
import { UNIT_SCALE } from './modelKeys.js';
import { WADE, gearHeightFor, gearHeights, createWading } from './wading.js';

// a 2-cell pond at cells (5..6, 5)
const isWater = (x, z) => Math.floor(z) === 5 && (Math.floor(x) === 5 || Math.floor(x) === 6);
const gear = gearHeights(UNIT_MODELS);
const view = (o) => ({ id: 1, model: 'tank', x: 5.5, z: 5.5, y: 0, heading: 0, scale: 1, ...o });
const step = (w, v, dt = 1 / 60) => { const c = { ...v }; w.apply(dt, [c]); return c; };

test('running gear is read from parts: treads and wheels yes, flyers / walkers / hover no', () => {
  assert.ok(gear.tank > 0.3, 'treaded tank');
  assert.ok(gear.buggy > 0.3, 'wheeled buggy');
  for (const k of ['jet', 'copter', 'drone']) assert.equal(gear[k], 0, k);
  assert.equal(gearHeightFor(null), 0);
  assert.equal(gearHeightFor({ hover: true, parts: UNIT_MODELS.tank.parts }), 0);
});

test('a vehicle on water sinks to most of its wheel / tread height; on land it stays at the surface', () => {
  const w = createWading({ gear, isWater });
  const wet = step(w, view());
  const depth = WADE.submerge * gear.tank * UNIT_SCALE;
  assert.ok(Math.abs(wet.y + depth) < 1e-9, `sunk ${wet.y} vs ${-depth}`);
  assert.ok(WADE.submerge >= 0.6 && WADE.submerge < 1, 'mostly, not wholly, submerged');
  assert.equal(wet.wading, true);
  const w2 = createWading({ gear, isWater });
  const dry = step(w2, view({ x: 2.5 }));
  assert.equal(dry.y, 0); assert.ok(!dry.wading);
});

test('it eases down rolling in and back up climbing out — no pop', () => {
  const w = createWading({ gear, isWater });
  step(w, view({ x: 4.5 }));                       // first seen on land
  const depth = WADE.submerge * gear.tank * UNIT_SCALE;
  const first = step(w, view({ x: 5.2 }));
  assert.ok(first.y < 0 && first.y > -depth * 0.3, `first frame in the water only starts to sink (${first.y})`);
  let v; for (let i = 0; i < 90; i++) v = step(w, view({ x: 5.5 }));
  assert.ok(Math.abs(v.y + depth) < 1e-3, 'settled after ~1.5 s');
  const out = step(w, view({ x: 7.2 }));
  assert.ok(out.y < 0 && out.y > -depth, 'still rising out');
  assert.ok(!out.wading, 'not wading once on land (dust may resume)');
  for (let i = 0; i < 120; i++) v = step(w, view({ x: 7.5 }));
  assert.equal(v.y, 0, 'back on the surface');
});

test('never sinks water units, flyers, airborne views, or models without running gear', () => {
  const w = createWading({ gear, isWater, isWaterUnit: (v) => v.id === 9 });
  assert.equal(step(w, view({ id: 9 })).y, 0, 'swimmer floats');
  assert.equal(step(w, view({ id: 2, model: 'copter' })).y, 0, 'no gear');
  assert.equal(step(w, view({ id: 3, y: 0.5 })).y, 0.5, 'in the air');
});

test('scale carries through, and units that leave are forgotten', () => {
  const w = createWading({ gear, isWater });
  const big = step(w, view({ scale: 2 }));
  assert.ok(Math.abs(big.y + 2 * WADE.submerge * gear.tank * UNIT_SCALE) < 1e-9);
  assert.equal(w.apply(1 / 60, []), 0);
  assert.equal(w.depth(1), 0);
});
