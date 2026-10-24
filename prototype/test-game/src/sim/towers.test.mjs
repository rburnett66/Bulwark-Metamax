/** towers.test.mjs — STR-Rockets (ground AOE) + STR-Missile (long-range AA), owner 2026-10-16:
 *  table defs, palette placement, and the STRUCTURE SPLASH path in combat.js.
 *  Run: node --test src/sim/towers.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, MAP } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { placeCompletedStructure } from './balanceSim.js';

test('new tower defs: kinds, tiers, footprint, cost parity, distinguishing stats', () => {
  const R = STRUCTURES['STR-Rockets'], M = STRUCTURES['STR-Missile'];
  const C = STRUCTURES['STR-Cannon'], F = STRUCTURES['STR-Flak'];
  assert.equal(R.name, 'Rocket Tower'); assert.equal(R.kind, 'antiGround');
  assert.equal(M.name, 'Missile Tower'); assert.equal(M.kind, 'antiAir');
  for (const d of [R, M]) {
    for (const k of ['hp', 'dps', 'cost']) assert.equal(d[k].length, 3, k + ' has 3 tiers');
    assert.deepEqual({ ...d.footprint }, { w: 1, h: 1 });
    assert.ok(d.cadence > 0, 'render cadence present');
    for (let t = 1; t < 3; t++) assert.ok(d.hp[t] > d.hp[t - 1] && d.dps[t] > d.dps[t - 1] && d.cost[t] > d.cost[t - 1]);
  }
  assert.deepEqual(R.cost, C.cost, 'rockets cost the same as the cannon');
  assert.deepEqual(M.cost, F.cost, 'missile costs the same as flak');
  assert.ok(R.aoeRadius >= 1 && R.aoeRadius <= 1.5, 'rockets splash ~1.2 cells');
  assert.ok(!C.aoeRadius && !F.aoeRadius && !M.aoeRadius, 'only the rocket tower splashes');
  assert.ok(R.dps[0] * R.cadence > C.dps[0] * 0.55, 'rockets hit harder per volley than the cannon');
  assert.ok(R.dps[0] < C.dps[0], 'but sustain less single-target dps (the splash pays for it)');
  assert.ok(M.range > F.range && M.range >= 7.5, 'missile out-ranges flak');
  assert.ok(M.dps[0] * M.cadence > F.dps[0] * 0.35 && M.cadence > 0.35, 'missile: bigger burst, slower cadence');
  assert.deepEqual([...R.canTargetDomains], [...C.canTargetDomains]);
  assert.deepEqual([...M.canTargetDomains], [...F.canTargetDomains]);
});

test('palette order: existing hotkeys unchanged, new towers take 5 and 6', () => {
  const order = Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay');
  assert.deepEqual(order.slice(0, 6), ['STR-Cannon', 'STR-Flak', 'STR-Wall', 'STR-Mine', 'STR-Rockets', 'STR-Missile']);
});

// a frozen, unarmed, tanky dummy at (x,y)
function dummy(st, unitId, x, y, lane) {
  const u = createUnit(st, unitId, 1, { x, y }, lane, 'attacker');
  if (!st.units.has(u.id)) st.units.set(u.id, u);
  u.speed = 0; u.dps = 0; u.hp = u.maxHp = 1e6; u.path = []; u.targetsBase = false;
  u.ability = null;   // a plain dummy — GND-Tanks carries the Shield Tank aura (sim/abilities.js)
  return u;
}
function arena(structId) {
  const st = createSim(11, { waves: [], map: MAP });
  if (st.base) st.base.cannon = null;
  const slot = MAP.slots[6];
  const tw = placeCompletedStructure(st, structId, slot);
  return { st, tw, slot };
}
function damageBy(st, srcId, ticks) {
  const by = new Map();
  for (let t = 0; t < ticks; t++) {
    for (const e of stepSim(st, FIXED_DT)) {
      if (e.type === 'damage' && e.sourceId === srcId) by.set(e.targetId, (by.get(e.targetId) || 0) + e.amount);
    }
  }
  return by;
}

test('STR-Rockets splash: damages ground enemies near the target, not distant ones, not flyers', () => {
  const { st, tw, slot } = arena('STR-Rockets');
  const R = STRUCTURES['STR-Rockets'];
  const primary = dummy(st, 'GND-Tanks', slot.x + 3, slot.y, 'ground');
  const near = dummy(st, 'GND-Tanks', slot.x + 3.6, slot.y, 'ground');                 // 0.6 from target
  const far = dummy(st, 'GND-Tanks', slot.x - 3, slot.y, 'ground');                    // in range, 6 away from target
  const flyer = dummy(st, 'AIR-Planes', slot.x + 3.3, slot.y, 'air');                  // inside splash, but air
  const by = damageBy(st, tw.id, 30);
  assert.ok(by.get(primary.id) > 0, 'primary target hit');
  assert.ok(by.get(near.id) > 0, 'neighbour inside aoeRadius takes splash');
  assert.ok(Math.abs(by.get(near.id) - by.get(primary.id)) < 1e-6 * by.get(primary.id) + 1e-9, 'splash = same dps as the primary hit');
  assert.ok(!by.has(far.id), 'unit outside aoeRadius of the target is untouched');
  assert.ok(!by.has(flyer.id), 'anti-ground splash never touches air');
  // 1 s of fire at T1 (Kinetic vs Machinery multiplier read off the primary)
  assert.ok(by.get(primary.id) > 0.9 * R.dps[0] * 30 * FIXED_DT * 0.5, 'damage in the right ballpark');
});

test('STR-Cannon has no splash (structure splash is data-driven)', () => {
  const { st, tw, slot } = arena('STR-Cannon');
  const primary = dummy(st, 'GND-Tanks', slot.x + 3, slot.y, 'ground');
  const near = dummy(st, 'GND-Tanks', slot.x + 3.6, slot.y, 'ground');
  const by = damageBy(st, tw.id, 30);
  assert.ok(by.get(primary.id) > 0);
  assert.ok(!by.has(near.id), 'no aoeRadius -> single target');
});

test('splash kills resolve like primary kills (kill event + income)', () => {
  const { st, tw, slot } = arena('STR-Rockets');
  dummy(st, 'GND-Tanks', slot.x + 3, slot.y, 'ground');
  const near = dummy(st, 'GND-Tanks', slot.x + 3.5, slot.y, 'ground');
  near.hp = 1;   // one splash tick finishes it
  let killed = false;
  for (let t = 0; t < 10 && !killed; t++) for (const e of stepSim(st, FIXED_DT)) if (e.type === 'kill' && e.entityId === near.id) killed = true;
  assert.ok(killed && !st.units.has(near.id), 'splash victim killed and removed');
  assert.ok(tw.hp > 0);
});

test('STR-Missile: hits flyers beyond flak range, single target, never ground', () => {
  const { st, tw, slot } = arena('STR-Missile');
  const flakRange = STRUCTURES['STR-Flak'].range;
  const lone = dummy(st, 'AIR-Planes', slot.x + flakRange + 1, slot.y, 'air');          // 7.5: flak can't reach
  const wing = dummy(st, 'AIR-Planes', slot.x + flakRange + 1.4, slot.y, 'air');        // 0.4 from it
  const tank = dummy(st, 'GND-Tanks', slot.x + 2, slot.y, 'ground');
  const by = damageBy(st, tw.id, 30);
  assert.ok(by.get(lone.id) > 0, 'missile engages a flyer at 7.5 cells');
  assert.ok(!by.has(wing.id), 'single target — no splash');
  assert.ok(!by.has(tank.id), 'anti-air never hits ground');
  // the same geometry with flak: out of range
  const f = arena('STR-Flak');
  const fl = dummy(f.st, 'AIR-Planes', f.slot.x + flakRange + 1, f.slot.y, 'air');
  assert.ok(!damageBy(f.st, f.tw.id, 30).has(fl.id), 'flak cannot reach that flyer');
});

test('deterministic: identical rocket fights hash the same damage', () => {
  const run = () => {
    const { st, tw, slot } = arena('STR-Rockets');
    for (let i = 0; i < 5; i++) dummy(st, 'GND-Tanks', slot.x + 3 + (i % 3) * 0.4, slot.y + Math.floor(i / 3) * 0.4, 'ground');
    return [...damageBy(st, tw.id, 60).entries()];
  };
  assert.deepEqual(run(), run());
});
