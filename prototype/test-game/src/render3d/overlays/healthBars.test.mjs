// [MM-task_mvbry87f_q] health bars: units once hit, towers while damaged, the base once attacked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planBars, BARS } from './healthBars.js';

const run = (state, views, mem, secs, opts) => { let b = []; for (let t = 0; t < secs; t += 1 / 60) b = planBars(state, views, mem, 1 / 60, opts); return b; };

test('a unit shows no bar at full health, fades in on its first hit, and the damage chunk lingers then drains', () => {
  const u = { id: 1, hp: 100, maxHp: 100 };
  const state = { units: new Map([[1, u]]) }, views = [{ id: 1, x: 3, y: 0, z: 4, scale: 1 }], mem = new Map();
  assert.equal(run(state, views, mem, 0.5).length, 0, 'untouched: no bar');
  u.hp = 60;
  let b = planBars(state, views, mem, 1 / 60)[0];
  assert.ok(b && b.alpha < 0.5 && b.flash > 0.5, 'fades in (never pops) with a hit flash');
  b = run(state, views, mem, 0.2)[0];
  assert.ok(Math.abs(b.frac - 0.6) < 0.02, 'fill eases to the new value quickly');
  assert.ok(b.chunk > 0.95, 'the bite holds');
  b = run(state, views, mem, 0.8)[0];
  assert.ok(b.chunk < 0.62, 'then drains to the fill');
  assert.ok(b.alpha > 0.99);
  state.units.delete(1);
  assert.equal(run(state, [], mem, 0.6).length, 0, 'gone with the unit');
});

test('towers show bars only while damaged; the base keeps its bar once hit', () => {
  const s = { id: 7, kind: 'antiGround', pos: { x: 5, y: 5 }, hp: 400, maxHp: 400, lifecycle: 'Complete' };
  const state = { structures: new Map([[7, s]]), base: { hp: 3000, maxHp: 3000 } }, mem = new Map(), opts = { baseCell: { x: 10, y: 10 } };
  assert.equal(run(state, null, mem, 0.3, opts).length, 0);
  s.hp = 200; state.base.hp = 2900;
  let bars = run(state, null, mem, 0.5, opts);
  assert.deepEqual(bars.map((b) => b.kind).sort(), [1, 2]);
  const base = bars.find((b) => b.kind === 2);
  assert.equal(base.w > BARS.structW, true, 'the base bar is wider');
  s.hp = 400; state.base.hp = 3000;
  bars = run(state, null, mem, 2, opts);
  assert.deepEqual(bars.map((b) => b.kind), [2], 'repaired tower drops its bar; the base keeps its bar');
});

test('colours: lime-green fill on a charcoal-grey track, no amber/red ramp [MM-task_mvempq5t_p]', async () => {
  const { BAR_COLORS, createHealthBarView } = await import('./healthBars.js');
  const THREE = await import('../../../vendor/three.module.js');
  const [r, g, b] = BAR_COLORS.fill;
  assert.ok(g > 0.85 && r > 0.4 && r < 0.7 && b < 0.3, 'lime green');
  const t = BAR_COLORS.track;
  assert.ok(Math.max(...t) - Math.min(...t) < 0.05 && t[0] > 0.12 && t[0] < 0.3, 'charcoal grey');
  const v = createHealthBarView(THREE, new THREE.Scene());
  const fs = v.mesh.material.fragmentShader;
  assert.ok(fs.includes('vec3(0.550, 0.950, 0.180)') && fs.includes('vec3(0.200, 0.210, 0.230)'), 'shader uses the palette');
  assert.ok(!fs.includes('0.95, 0.78, 0.2') && !fs.includes('0.92, 0.22, 0.16'), 'no amber / red');
});
