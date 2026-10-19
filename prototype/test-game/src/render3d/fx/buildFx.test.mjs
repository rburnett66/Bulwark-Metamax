// [MM-story_mvedxrmi_6] build-site dirt puffs: around the footprint while Building, a ring + burst on start,
// a settling burst on complete, nothing once Complete, scaled by quality tier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildFx, BUILD_FX, BUILD_TIER } from './buildFx.js';
import { K } from './impacts.js';

const world = (lifecycle = 'Building', progress = 0, fp = { w: 1, h: 1 }) => ({
  tick: 10,
  structures: new Map([[3, { id: 3, pos: { x: 4, y: 4 }, footprint: fp, lifecycle, progress }]]),
});
const capture = () => {
  const out = [];
  const emit = (kind, x, y, z, vx, vy, vz, life, size, grow, shade, dusty, drag) => out.push({ kind, x, y, z, vx, vy, vz, life, size, dusty, drag });
  return { out, emit };
};

test('while Building: dusty puffs on the footprint edge, low and drifting outward, at the set rate', () => {
  const fx = createBuildFx(), { out, emit } = capture();
  for (let i = 0; i < 60; i++) fx.step(1 / 60, world('Building', 0), [], emit, K);
  assert.ok(Math.abs(out.length - BUILD_FX.rate) <= 1, `~${BUILD_FX.rate}/s (${out.length})`);
  for (const p of out) {
    assert.equal(p.kind, K.SMOKE); assert.equal(p.dusty, 1); assert.ok(p.drag > 0);
    const dx = p.x - 4.5, dz = p.z - 4.5;
    assert.ok(Math.abs(Math.max(Math.abs(dx), Math.abs(dz)) - 0.5) < 1e-9, 'on the footprint edge');
    assert.ok(p.y < 0.2, 'at ground level');
    assert.ok(dx * p.vx + dz * p.vz > 0, 'drifting outward');
  }
});

test('the rate eases off as construction nears completion', () => {
  const early = capture(), late = capture();
  const a = createBuildFx(), b = createBuildFx();
  for (let i = 0; i < 120; i++) { a.step(1 / 60, world('Building', 0.05), [], early.emit, K); b.step(1 / 60, world('Building', 0.95), [], late.emit, K); }
  assert.ok(late.out.length < early.out.length * 0.5, `${late.out.length} vs ${early.out.length}`);
});

test('break ground: a dust ring and a burst on build/start — consumed once; settle burst on complete', () => {
  const fx = createBuildFx(), { out, emit } = capture(), rings = [];
  const ring = (...args) => rings.push(args);
  const st = world('Complete');
  const ev = [{ type: 'build', phase: 'start', id: 3, tick: 10, pos: { x: 4, y: 4 } }];
  fx.step(0.016, st, ev, emit, K, ring);
  fx.step(0.016, st, ev, emit, K, ring);   // the same event seen again on the next frame
  assert.equal(rings.length, 1);
  assert.equal(out.length, BUILD_FX.start);
  fx.step(0.016, st, [{ type: 'build', phase: 'complete', id: 3, tick: 40 }], emit, K, ring);
  assert.equal(out.length, BUILD_FX.start + BUILD_FX.settle);
});

test('nothing once Complete; nothing for repairs or upgrades', () => {
  const fx = createBuildFx(), { out, emit } = capture();
  for (let i = 0; i < 60; i++) fx.step(1 / 60, world('Complete', 1), [{ type: 'build', phase: 'repaired', id: 3, tick: 5 }], emit, K);
  assert.equal(out.length, 0);
});

test('quality tiers scale the dust; a 2×2 footprint puffs more than a 1×1', () => {
  const hi = capture(), lo = capture(), big = capture();
  const a = createBuildFx(), b = createBuildFx(), c = createBuildFx();
  for (let i = 0; i < 120; i++) {
    a.step(1 / 60, world(), [], hi.emit, K, null, 'high');
    b.step(1 / 60, world(), [], lo.emit, K, null, 'low');
    c.step(1 / 60, world('Building', 0, { w: 2, h: 2 }), [], big.emit, K, null, 'high');
  }
  assert.ok(Math.abs(lo.out.length - hi.out.length * BUILD_TIER.low) <= 2, `${lo.out.length} vs ${hi.out.length}`);
  assert.ok(big.out.length > hi.out.length * 1.5);
});

test('dust is twice as obvious, and upgrades raise it too [MM-task_mvfjymwc_a]', () => {
  assert.ok(BUILD_FX.rate >= 24 && BUILD_FX.start >= 28 && BUILD_FX.settle >= 20, 'twice the puffs');
  assert.ok(BUILD_FX.size[0] >= 0.1 && BUILD_FX.ring.a >= 0.6, 'bigger puffs, a stronger ring');
  const fx = createBuildFx(), out = [];
  const emit = (...a) => out.push(a), K = { SMOKE: 1 };
  const s = { id: 7, lifecycle: 'Upgrading', progress: 0, pos: { x: 3, y: 3 }, footprint: { w: 1, h: 1 } };
  const st = { tick: 1, structures: new Map([[7, s]]) };
  for (let i = 0; i < 10; i++) fx.step(0.1, st, [], emit, K);
  assert.ok(out.length >= BUILD_FX.rate * 0.8, `upgrading puffs (${out.length})`);
  out.length = 0;
  fx.step(0, st, [{ type: 'build', tick: 2, id: 7, phase: 'upgradeStart' }], emit, K);
  assert.equal(out.length, BUILD_FX.start, 'upgrade start bursts');
  out.length = 0;
  fx.step(0, st, [{ type: 'build', tick: 3, id: 7, phase: 'upgradeComplete' }], emit, K);
  assert.equal(out.length, BUILD_FX.settle, 'upgrade complete settles');
});
