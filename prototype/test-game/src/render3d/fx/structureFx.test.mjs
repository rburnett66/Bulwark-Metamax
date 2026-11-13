// [MM-story_mwcrfnyf_3c] owner playtest 2026-11-11: "building is supposed to present the blue sparks from random
// locations, red sparks when damaged with grey smoke" — for every structure (battle and outpost), off the SimState.
// Moved here with the code from outpost/view/constructionFx.test.mjs (the old pad view's copy).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStructureFx, damageOf, WELD_CYCLE, DAMAGE_RATE, DAMAGE_SMOKE } from './structureFx.js';
import { REPAIR_FX, SPARK_TINT } from './repairFx.js';
import { BUILD_TIER } from './buildFx.js';
import { K } from './impacts.js';

const tower = (o = {}) => ({ id: 3, pos: { x: 4, y: 4 }, footprint: { w: 1, h: 1 }, lifecycle: 'Complete', hp: 400, maxHp: 400, ...o });
const world = (...list) => ({ structures: new Map(list.map((s) => [s.id, s])) });
/** Run `secs` of frames at 30 fps; collect every emit. */
function run(st, secs, { seed = 3, tier = 'high', fx = createStructureFx({ seed }) } = {}) {
  const out = [];
  const emit = (kind, x, y, z, vx, vy, vz, life, size, grow, shade, dusty) => out.push({ kind, x, y, z, vy, shade, dusty });
  for (let i = 0; i < Math.round(secs * 30); i++) fx.step(1 / 30, st, emit, K, tier);
  const of = (kind, shade) => out.filter((p) => p.kind === kind && (shade === undefined || p.shade === shade));
  return { out, of, fx };
}

test('a structure being built throws blue welding sparks (the repair welder) at its rate, from one point per cycle', () => {
  const st = world(tower({ lifecycle: 'Building', progress: 0.2, footprint: { w: 2, h: 2 } }));
  const { of } = run(st, 1);
  const blue = of(K.SPARK);
  assert.ok(Math.abs(blue.length - REPAIR_FX.rate) <= 1, `~${REPAIR_FX.rate}/s (${blue.length})`);
  assert.ok(blue.every((p) => p.shade === SPARK_TINT.repair), 'blue: the repair tint');
  assert.ok(of(K.FLASH, SPARK_TINT.repair).length > 0, 'the blue arc flicker');
  assert.ok(blue.every((p) => p.x === blue[0].x && p.z === blue[0].z && p.y === blue[0].y), 'one weld point inside the cycle');
  assert.equal(of(K.SMOKE).length, 0, 'no smoke (the dust is buildFx.js)');
});

test('the weld point moves to a new random spot every WELD_CYCLE seconds (and upgrades weld too)', () => {
  for (const lifecycle of ['Building', 'Upgrading']) {
    const fx = createStructureFx({ seed: 9 }), st = world(tower({ lifecycle, footprint: { w: 2, h: 2 } }));
    const spots = [];
    for (let c = 0; c < 4; c++) {
      const { of } = run(st, WELD_CYCLE, { fx });
      spots.push([...new Set(of(K.SPARK).map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`))]);
    }
    for (const s of spots) assert.ok(s.length <= 2, `${lifecycle}: at most one move inside a ${WELD_CYCLE} s window (${s.length})`);
    assert.ok(new Set(spots.flat()).size >= 4, `${lifecycle}: a new spot each cycle (${new Set(spots.flat()).size})`);
    // the point sits on the structure's side, up off the ground
    const { of } = run(st, 0.5, { fx });
    for (const p of of(K.SPARK)) {
      const dx = p.x - 5, dz = p.z - 5;   // a 2×2 at (4,4): centre 5,5 (camera cellToWorld: cell + 0.5)
      assert.ok(Math.hypot(dx, dz) <= 0.32 * 2 * Math.SQRT2 + 1e-9 && p.y >= 0.3 && p.y <= 1.3);
    }
  }
});

test('the same seed gives the same sparks (seeded, never Math.random)', () => {
  const st = () => world(tower({ lifecycle: 'Building' }), tower({ id: 4, pos: { x: 9, y: 2 }, hp: 120 }));
  const a = run(st(), 3, { seed: 17 }).out, b = run(st(), 3, { seed: 17 }).out;
  assert.deepEqual(a, b);
});

test('a damaged structure throws red sparks and grey smoke, more the more HP it is missing; a wreck the most', () => {
  const at = (hp, lifecycle = hp > 0 ? 'Damaged' : 'Wrecked') => {
    const { of } = run(world(tower({ hp, lifecycle })), 2);
    return { red: of(K.SPARK, SPARK_TINT.damage).length, other: of(K.SPARK).length - of(K.SPARK, SPARK_TINT.damage).length,
      smoke: of(K.SMOKE), flicker: of(K.FLASH, SPARK_TINT.damage).length };
  };
  const scratch = at(360), half = at(200), wreck = at(0);
  assert.ok(scratch.red > 0 && scratch.smoke.length > 0, 'a scratch: a few');
  assert.ok(half.red > scratch.red * 1.8 && half.smoke.length > scratch.smoke.length, `more at half HP (${half.red} vs ${scratch.red})`);
  assert.ok(wreck.red > half.red && wreck.smoke.length > half.smoke.length, 'a wreck the most');
  assert.ok(Math.abs(wreck.red - DAMAGE_RATE.heavy * 2) <= 2, `a wreck ~DAMAGE_RATE.heavy a second (${wreck.red})`);
  assert.ok(Math.abs(wreck.smoke.length - DAMAGE_SMOKE.rate.heavy * 2) <= 2, `a wreck ~DAMAGE_SMOKE.rate.heavy puffs a second (${wreck.smoke.length})`);
  assert.ok(wreck.flicker > 0 && wreck.other === 0, 'red flicker; no other spark tints');
  for (const p of wreck.smoke) {
    assert.equal(p.shade, DAMAGE_SMOKE.shade, 'grey');
    assert.equal(p.dusty, 0, 'smoke, not dust');
    assert.ok(p.vy > 0, 'rising');
  }
});

test('nothing off a healthy finished structure, or one whose repair is under way; it stops once repaired (a sale: its sparklers only)', () => {
  // a sale throws its four red sparklers (owner 2026-11-13 [MM-story_mwf950rz_7]) but no damage smoke
  assert.equal(run(world(tower({ lifecycle: 'Selling', hp: 100 })), 1).of(K.SMOKE).length, 0, 'a sale: no smoke');
  for (const s of [tower(), tower({ lifecycle: 'Active' }), tower({ hp: 100, lifecycle: 'Damaged', repairPending: true }),
    tower({ lifecycle: 'Destroyed', hp: 0 }), tower({ lifecycle: 'Placing' })]) {
    assert.equal(run(world(s), 1).out.length, 0, `${s.lifecycle}${s.repairPending ? ' (repairing)' : ''}`);
  }
  const s = tower({ hp: 100, lifecycle: 'Damaged' }), fx = createStructureFx({ seed: 1 });
  assert.ok(run(world(s), 1, { fx }).out.length > 0);
  s.hp = s.maxHp; s.lifecycle = 'Complete';
  assert.equal(run(world(s), 1, { fx }).out.length, 0, 'repaired: it stops');
  assert.equal(damageOf(tower({ hp: 100, lifecycle: 'Building' })), 0, 'a site welds, it does not throw damage FX');
});

test('the quality tier scales the counts like the build dust (Low ≈ a quarter of High)', () => {
  const st = () => world(tower({ lifecycle: 'Building' }), tower({ id: 4, pos: { x: 9, y: 2 }, hp: 0, lifecycle: 'Wrecked' }));
  const hi = run(st(), 4, { tier: 'high' }), lo = run(st(), 4, { tier: 'low' });
  for (const [kind, shade] of [[K.SPARK, SPARK_TINT.repair], [K.SPARK, SPARK_TINT.damage], [K.SMOKE]]) {
    const h = hi.of(kind, shade).length, l = lo.of(kind, shade).length;
    assert.ok(Math.abs(l - h * BUILD_TIER.low) <= 3, `${kind}/${shade}: ${l} vs ${h} × ${BUILD_TIER.low}`);
  }
});

// Owner 2026-11-13 [MM-story_mwf950rz_7]: "when we sell a tower then should be four red sparklers at the same time as the
// workers tear down the structure"
test('a structure being sold throws four red sparklers at once, one at each corner, for the whole teardown', async () => {
  const { SELL_SPARKLERS } = await import('./structureFx.js');
  const { cellToWorld } = await import('../camera.js');
  const c = cellToWorld(10);
  assert.equal(SELL_SPARKLERS, 4);
  const fx = createStructureFx({ seed: 9 });
  const s = { id: 7, pos: { x: 10, y: 10 }, footprint: { w: 1, h: 1 }, lifecycle: 'Selling', progress: 0.3, hp: 100, maxHp: 100 };
  const state = { structures: new Map([[7, s]]) };
  const K = new Proxy({}, { get: (_, k) => k });
  const sparks = [];
  const emit = (kind, x, y, z, vx, vy, vz, life, size, g, tint) => { if (kind !== 'FLASH') sparks.push({ x, z, tint }); };
  let lit = 0, n = 0;
  for (let i = 0; i < 30; i++) { const o = fx.step(1 / 30, state, emit, K, 'high'); lit = Math.max(lit, o.sparklers); n += o.sell; }
  assert.equal(lit, 4, 'four at the same time');
  assert.ok(n >= 4 * 10, 'each one sparks steadily: ' + n);
  assert.ok(sparks.every((p) => p.tint === SPARK_TINT.damage), 'red');
  const quadrants = new Set(sparks.map((p) => (p.x > c ? 'E' : 'W') + (p.z > c ? 'S' : 'N')));
  assert.ok(quadrants.size >= 4, 'from all four corners: ' + [...quadrants]);
  assert.equal(fx.step(1 / 30, { structures: new Map([[7, { ...s, lifecycle: 'Complete' }]]) }, emit, K).sparklers, 0, 'none once it is not being sold');
});
