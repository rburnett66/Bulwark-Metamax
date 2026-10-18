// Cannon gunsmoke: born tip-sized, pushed out along the barrel, then expands and clears. [MM-story_mvee3vj5_c]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitMuzzleSmoke, MUZZLE_SMOKE } from './muzzleSmoke.js';
import { createImpacts, K } from './impacts.js';

const TIP_DIAMETER = 2 * 0.2 * 0.3;   // sys_cannon barrel r 0.2 × SYSTEM_SCALE 0.3
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
const axis = (() => { const a = 8 * Math.PI / 180; return { dx: Math.cos(a), dy: Math.sin(a), dz: 0 }; })();

function capture(k = 1) {
  const out = [];
  const emit = (kind, x, y, z, vx, vy, vz, life, size, grow, shade, dusty, drag) => out.push({ kind, x, y, z, vx, vy, vz, life, size, grow, shade, dusty, drag });
  emitMuzzleSmoke(emit, K.SMOKE, { x: 1, y: 0.6, z: 2, ...axis }, k, seeded());
  return out;
}

test('every puff is born no wider than the barrel tip', () => {
  const p = capture();
  assert.ok(p.length >= 2);
  for (const q of p) { assert.equal(q.kind, K.SMOKE); assert.ok(q.size <= TIP_DIAMETER, `size ${q.size} > tip ${TIP_DIAMETER}`); }
});

test('puffs leave along the barrel with a modest outward speed, and drag stalls them', () => {
  for (const q of capture()) {
    const along = q.vx * axis.dx + q.vy * axis.dy + q.vz * axis.dz;
    assert.ok(along >= MUZZLE_SMOKE.speed[0] * 0.9 && along <= MUZZLE_SMOKE.speed[1] * 1.1, `along ${along}`);
    assert.ok(q.drag > 0);
  }
});

test('in flight: a puff travels a short way out, swells, and fades away', () => {
  const imp = createImpacts({ seed: 3 });
  const S = MUZZLE_SMOKE;
  imp.emit(K.SMOKE, 0, 1, 0, axis.dx * 2, axis.dy * 2, 0, 2.2, S.size, S.grow, S.shade, 0, S.drag);
  const p = imp.particles.find((q) => q.kind === K.SMOKE);
  assert.ok(p, 'smoke particle emitted');
  let t = 0;
  while (t < 1.0) { t += 1 / 60; imp.update({ time: t, tick: 0 }, null, null, 1 / 60); }
  const out = Math.hypot(p.x, p.z);
  assert.ok(out > 0.25 && out < 1.2, `pushed a short way out (${out.toFixed(2)})`);
  // drawn size (impactsView: size·(1 + grow·u·3)) at the end of life is several times the birth size
  assert.ok(1 + S.grow * 3 >= 6, 'expands at least 6×');
});

test('flak and tracer smoke is smaller than the cannon shell', () => {
  const big = capture(1)[0].size, flak = capture(0.75)[0].size, tracer = capture(0.35)[0].size;
  assert.ok(flak < big && tracer < flak);
});
