// [MM-story_mvedxq1v_5] the elevation solver: one launch angle for the flight path and the barrel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pitchFor, apexFor, lobPoint, LOB } from './elevation.js';
import { createCombatFx, STRUCT_RECIPES } from './combatFxModel.js';

const deg = (r) => r * 180 / Math.PI;

test('straight shots: a small angle — down to lower ground, up at aircraft', () => {
  assert.ok(Math.abs(pitchFor({ x: 0, y: 0.6, z: 0 }, { x: 5, y: 0.6, z: 0 })) < 1e-9, 'level');
  assert.ok(pitchFor({ x: 0, y: 0.6, z: 0 }, { x: 5, y: 0.3, z: 0 }) < 0, 'depresses');
  assert.ok(pitchFor({ x: 0, y: 0.6, z: 0 }, { x: 5, y: 2.5, z: 0 }) > 0, 'elevates at a plane');
});

test('lobbed shots: the barrel rises with range and matches the arc\'s launch slope exactly', () => {
  const from = { x: 0, y: 0.6, z: 0 };
  let prev = -Infinity;
  for (const d of [1.5, 2.5, 3.5, 4.5]) {
    const to = { x: d, y: 0.3, z: 0 }, apex = apexFor('shell', d);
    const p = pitchFor(from, to, apex);
    assert.ok(p > prev, `higher at ${d} cells (${deg(p).toFixed(1)}°)`); prev = p;
    const a = lobPoint(from, to, apex, 0), b = lobPoint(from, to, apex, 1e-4);   // numerical tangent at launch
    assert.ok(Math.abs(Math.atan2(b.y - a.y, b.x - a.x) - p) < 1e-3, 'flight path and pitch agree');
  }
  assert.ok(apexFor('shell', 4.5) < 1.6 + 0.32 * 4.5, 'the cannon tower lobs below the base super-cannon');
  const near = pitchFor(from, { x: 1.5, y: 0.3, z: 0 }, apexFor('shell', 1.5)), far = pitchFor(from, { x: 4.5, y: 0.3, z: 0 }, apexFor('shell', 4.5));
  assert.ok(deg(near) < 8 && deg(far) > 20, `near ${deg(near).toFixed(1)}° flat, far ${deg(far).toFixed(1)}° raised`);
  assert.equal(apexFor('tracer', 9), 0); assert.equal(apexFor('rocket', 0), LOB.rocket.base);
});

test('the cannon tower lobs its shells and they land on the target', () => {
  assert.equal(STRUCT_RECIPES['STR-Cannon'].lob, 1);
  const fx = createCombatFx();
  const st = { time: 0, units: new Map([[1, { id: 1, unitId: 'tank', side: 'attacker', hp: 9, maxHp: 9, domain: 'Ground', pos: { x: 8, y: 4 } }]]),
    structures: new Map([[100, { id: 100, structId: 'STR-Cannon', kind: 'antiGround', pos: { x: 4, y: 4 }, targetId: 1, lifecycle: 'Complete', footprint: { w: 1, h: 1 } }]]), base: { pos: { x: 16, y: 16 } } };
  let peak = 0, hit = null;
  for (let i = 0; i < 120; i++) {
    fx.update(st, { cols: 32, rows: 32 }, [], 1 / 60, { getDef: () => ({ projectileFx: 'shell' }) });
    st.time += 1 / 60;
    for (const s of fx.shots) peak = Math.max(peak, s.y);
    for (const f of fx.flashes) if (Math.abs(f.x - 8.5) < 0.4 && f.y < 0.6) hit = f;
  }
  assert.ok(fx.launched > 0);
  assert.ok(peak > 0.75, `arcs above the straight line (${peak.toFixed(2)})`);
  assert.ok(hit, 'lands with a hit flash at the target');
});
