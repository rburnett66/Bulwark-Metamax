// [MM-task_mvfjbh78_7] Rocket salvos fire 1 / 2 / 4 rounds by tower tier, and each salvo leaves the ground burning over
// exactly the sim's splash circle (aoeRadius) until the next salvo — visual only (owner's choice).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatFx, STRUCT_RECIPES } from './combatFxModel.js';
import { createImpacts, D } from './impacts.js';
import { STRUCTURES } from '../../data/tables.js';

const world = (tier) => ({
  time: 0, tick: 0,
  units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 10, y: 4 }, targetId: null }]]),
  structures: new Map([[100, { id: 100, structId: 'STR-Rockets', kind: 'antiGround', tier, lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
  base: { pos: { x: 16, y: 16 } },
});

function salvo(tier) {
  const fx = createCombatFx(), st = world(tier), fires = [];
  const opts = { getDef: () => null, groundFire: (x, z, r, secs) => fires.push({ x, z, r, secs }) };
  // well inside one cadence: every round of the first salvo is launched and lands
  for (let i = 0; i < 30 * 6; i++) { st.time += 1 / 30; st.tick++; fx.update(st, {}, [], 1 / 30, opts); }
  return { fx, fires };
}

test('salvo size by tier: 1 / 2 / 4 rockets (render hint data on the recipe)', () => {
  assert.deepEqual([...STRUCT_RECIPES['STR-Rockets'].burstByTier], [1, 2, 4]);
  for (const [tier, n] of [[1, 1], [2, 2], [3, 4]]) {
    const fx = createCombatFx(), st = world(tier);
    let fired = 0;   // shot objects are pooled, so count launches (opts.fire runs once per round)
    for (let i = 0; i < 30 * 3; i++) { st.time += 1 / 30; fx.update(st, {}, [], 1 / 30, { getDef: () => null, fire: (k) => { if (k === 'rocket') fired++; } }); }
    assert.equal(fired, n, `tier ${tier}: ${n} rockets in the first salvo`);
  }
});

test('each salvo lights ONE ground fire at the target, with the sim splash radius, until the next salvo', () => {
  for (const tier of [1, 2, 3]) {
    const { fires } = salvo(tier);
    assert.equal(fires.length, 1, `tier ${tier}: one field per salvo`);
    const f = fires[0];
    assert.ok(Math.abs(f.x - 10.5) < 1e-9 && Math.abs(f.z - 4.5) < 1e-9, 'centred on the target');
    assert.equal(f.r, STRUCTURES['STR-Rockets'].aoeRadius, 'radius = the sim aoeRadius');
    assert.ok(f.secs >= STRUCTURES['STR-Rockets'].cadence, 'burns until the next salvo');
  }
});

test('impacts.groundFire: flames fill the circle and ring its edge; scorch + glow the size of the circle; dies out', () => {
  const im = createImpacts(), r = 1.2;
  const f = im.groundFire(5, 5, r, 3);
  const d = f.flames.map((q) => Math.hypot(q.x - 5, q.z - 5));
  assert.ok(Math.max(...d) <= r + 1e-9 && Math.max(...d) > 0.85 * r, 'the outer ring sits at the edge of the damage circle');
  assert.ok(d.some((v) => v < 1e-9), 'a fire at the centre');
  assert.ok(f.flames.length >= 12, `${f.flames.length} flames`);
  const sc = im.scorches.find((q) => q.kind === D.SCORCH && q.r === r), gl = im.glows.find((q) => q.kind === D.POOL && q.r === r);
  assert.ok(sc && gl, 'scorch + warm glow of radius r');
  const st = { time: 0, units: new Map(), structures: new Map() };
  st.time = 0.5; im.update(st, {}, [], 0.5, []);
  assert.ok(im.particles.some((p) => p.kind !== undefined), 'burning');
  for (let i = 0; i < 40; i++) { st.time += 0.1; im.update(st, {}, [], 0.1, []); }   // frames clamp at 0.1 s
  assert.equal(im.fields.length, 0, 'out after its time');
});
