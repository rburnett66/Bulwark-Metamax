/** machineGun.test.mjs — the Machine Gun tower [MM-story_mvk3kwu2_m]. Owner 2026-10-22: "one more low level tower. A
 *  machine gun which can damage troops, light tanks, and aircraft." Run: node --test src/sim/machineGun.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, UNITS, MAP } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { placeCompletedStructure } from './balanceSim.js';
import { structCanHit, structShapeMult } from './combat.js';

const MG = STRUCTURES['STR-MG'];

test('the def: a cheap, short-range, low-tier tower that takes the next hotkey', () => {
  assert.equal(MG.name, 'Machine Gun');
  for (const k of ['hp', 'dps', 'cost']) { assert.equal(MG[k].length, 3); for (let t = 1; t < 3; t++) assert.ok(MG[k][t] > MG[k][t - 1]); }
  for (const id of ['STR-Cannon', 'STR-Flak', 'STR-Rockets', 'STR-Missile']) assert.ok(MG.cost[0] < STRUCTURES[id].cost[0], `cheaper than ${id}`);
  assert.ok(MG.range <= STRUCTURES['STR-Cannon'].range + 1 && MG.range < STRUCTURES['STR-Flak'].range, 'short range');
  const order = Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay');
  assert.deepEqual(order.slice(0, 7), ['STR-Cannon', 'STR-Flak', 'STR-Wall', 'STR-Mine', 'STR-Rockets', 'STR-Missile', 'STR-MG']);
});

test('lightGround marks exactly the troops and the (assault) light tanks of every faction', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    const light = /-(Troops|Tanks)$/.test(id);
    assert.equal(u.lightGround === true, light, id);
  }
});

test('it may hit troops, light tanks, artillery and every aircraft — not heavy tanks or trucks', () => {
  const can = (id) => structCanHit(MG, { domain: UNITS[id].domain, lightGround: UNITS[id].lightGround === true, shape: UNITS[id].shape });
  for (const f of ['GND', 'AIR', 'HTC', 'ART', 'WTR', 'ARC', 'SPC', 'DRK', 'GRN']) {
    assert.ok(can(`${f}-Troops`), `${f}-Troops`); assert.ok(can(`${f}-Tanks`), `${f}-Tanks`);
    for (const air of ['Copters', 'Planes', 'Missiles']) assert.ok(can(`${f}-${air}`), `${f}-${air}`);
    assert.ok(can(`${f}-Artillery`), `${f}-Artillery (owner 2026-10-23: very effective against artillery)`);
    for (const no of ['HeavyTanks', 'Trucks']) assert.ok(!can(`${f}-${no}`), `${f}-${no} shrugs it off`);
  }
  assert.ok(can('AIR-HeavyBomber'));
  // other towers are unchanged by the light filter
  assert.ok(structCanHit(STRUCTURES['STR-Cannon'], { domain: 'Walker', lightGround: false }));
});

function dummy(st, unitId, x, y, lane) {
  const u = createUnit(st, unitId, 1, { x, y }, lane, 'attacker');
  if (!st.units.has(u.id)) st.units.set(u.id, u);
  u.speed = 0; u.dps = 0; u.hp = u.maxHp = 1e6; u.path = []; u.targetsBase = false;
  return u;
}

test('in the sim: it shoots the troop and the plane in range and leaves the heavy tank alone', () => {
  const st = createSim(11, { waves: [], map: MAP });
  if (st.base) st.base.cannon = null;
  const slot = MAP.slots[6];
  const tw = placeCompletedStructure(st, 'STR-MG', slot);
  const heavy = dummy(st, 'GND-HeavyTanks', slot.x + 1, slot.y, 'ground');
  const troop = dummy(st, 'GND-Troops', slot.x + 2, slot.y, 'ground');
  const plane = dummy(st, 'GND-Planes', slot.x, slot.y + 2, 'air');
  const by = new Map();
  for (let t = 0; t < 900; t++) for (const e of stepSim(st, FIXED_DT)) if (e.type === 'damage' && e.sourceId === tw.id) by.set(e.targetId, (by.get(e.targetId) || 0) + e.amount);
  assert.ok(!by.has(heavy.id), 'the nearer heavy tank is never shot');
  assert.ok((by.get(troop.id) || 0) > 0 || (by.get(plane.id) || 0) > 0, 'it fires at a legal target');
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - MG.dps[0] * 30) < MG.dps[0] * 1.5, `sustains its dps (${total.toFixed(0)} in 30 s)`);
});

test('artillery in range: the MG switches to it and shreds it at ×3 damage (owner 2026-10-23)', () => {
  const st = createSim(11, { waves: [], map: MAP });
  if (st.base) st.base.cannon = null;
  const slot = MAP.slots[6];
  const tw = placeCompletedStructure(st, 'STR-MG', slot);
  const troop = dummy(st, 'GND-Troops', slot.x + 1, slot.y, 'ground');          // nearer
  const art = dummy(st, 'GND-Artillery', slot.x + 3, slot.y, 'ground');         // farther, still in range 5
  const by = new Map();
  for (let t = 0; t < 300; t++) for (const e of stepSim(st, FIXED_DT)) if (e.type === 'damage' && e.sourceId === tw.id) by.set(e.targetId, (by.get(e.targetId) || 0) + e.amount);
  assert.ok((by.get(art.id) || 0) > 0, 'the artillery is shot');
  assert.ok(!by.has(troop.id), 'the nearer troop waits while artillery is in range');
  // ×3 vs artillery: the damage over 300 ticks is three times the tower's dps × the armour multiplier
  const secs = 300 * FIXED_DT, expect = MG.dps[0] * 3 * secs;
  assert.ok(Math.abs(by.get(art.id) - expect) / expect < 0.05, `artillery took ${by.get(art.id).toFixed(1)}, expected ≈ ${expect.toFixed(1)}`);
  // once the artillery is gone, back to the troop
  art.hp = 0; st.units.delete(art.id);
  const after = new Map();
  for (let t = 0; t < 60; t++) for (const e of stepSim(st, FIXED_DT)) if (e.type === 'damage' && e.sourceId === tw.id) after.set(e.targetId, (after.get(e.targetId) || 0) + e.amount);
  assert.ok((after.get(troop.id) || 0) > 0, 'then it takes the troop');
});

test('other towers ignore the MG-only artillery rules', () => {
  const art = { domain: 'Walker', lightGround: false, shape: 'Artillery' };
  assert.equal(structShapeMult(STRUCTURES['STR-Cannon'], art), 1);
  assert.equal(structShapeMult(MG, art), 3);
  assert.equal(structShapeMult(MG, { shape: 'Troops' }), 1);
});
