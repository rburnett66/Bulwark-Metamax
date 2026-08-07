// src/sim/softDefenders.test.mjs — EEE-2: some attackers may engage SOFT
// defenders (repair troops, harvesters) they are already in weapon range of.
// acquireTarget's attacker branch returned only the base or a structure and
// never scanned state.units, so no defender unit was targetable — yet splash
// already damaged them. Same entity, two answers.
//
// OPPORTUNISTIC ONLY: pathing is unchanged, no pursuit, no diversion. Base and
// structures outrank soft defenders. node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP, UNITS, SOFT_DEFENDER_HUNTERS } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { acquireTarget, BASE_TARGET_ID } from './combat.js';

/** Far from the base and from anything else on the board. */
const FAR = { x: 12, y: 30 };

function mkSim() {
  const s = createSim(20260807, { waves: [], map: MAP });
  // The standard board spawns a starting harvester at the keep; drop it so each
  // test controls exactly which soft defenders exist.
  for (const [id, u] of [...s.units.entries()]) if (u.isHarvester) s.units.delete(id);
  s.harvesterIds = [];
  return s;
}
function addAttacker(state, unitId, pos) {
  const u = createUnit(state, unitId, 1, pos, 'ground', 'attacker');
  state.units.set(u.id, u);
  u.path = []; u.pathIdx = 0;
  return u;
}
function addHarvester(state, pos) {
  const u = createUnit(state, 'GND-Trucks', 1, pos, 'ground', 'defender');
  state.units.set(u.id, u);
  u.isHarvester = true; u.dps = 0; u.targetsBase = false; u.state = 'harvestIdle';
  return u;
}
function addRepairTroop(state, pos, repairTargetId) {
  const u = createUnit(state, 'GND-Troops', 1, pos, 'ground', 'defender');
  state.units.set(u.id, u);
  u.isRepairTroop = true; u.dps = 0; u.targetsBase = false;
  u.repairTargetId = repairTargetId; u.state = 'repairMarch'; u.path = [];
  return u;
}

/* ------------------------------------------------------------------ */
/* 0. The allowlist is data, and it is typed                           */
/* ------------------------------------------------------------------ */

test('EEE-2: the hunter allowlist is keyed on the typed shape field', () => {
  const shapes = new Set(Object.values(UNITS).map((d) => d.shape));
  for (const k of Object.keys(SOFT_DEFENDER_HUNTERS)) {
    assert.ok(shapes.has(k), `allowlist key "${k}" must be a real unit shape`);
  }
  assert.ok(Object.keys(SOFT_DEFENDER_HUNTERS).length > 0, 'at least one shape may engage');
});

test('EEE-2: createUnit stamps the capability onto the entity as a boolean', () => {
  const s = mkSim();
  for (const id of Object.keys(UNITS)) {
    const u = createUnit(s, id, 1, FAR, 'ground', 'attacker');
    assert.equal(typeof u.engagesSoftDefenders, 'boolean', `${id} must carry the flag`);
    assert.equal(u.engagesSoftDefenders, !!SOFT_DEFENDER_HUNTERS[UNITS[id].shape], id);
  }
});

/** A unit id of an allowlisted shape, and one of a non-allowlisted shape. */
const HUNTER = Object.keys(UNITS).find((k) => SOFT_DEFENDER_HUNTERS[UNITS[k].shape] && UNITS[k].canTarget !== 'Air');
const NON_HUNTER = Object.keys(UNITS).find((k) => !SOFT_DEFENDER_HUNTERS[UNITS[k].shape] && UNITS[k].targets === 'Base');

/* ------------------------------------------------------------------ */
/* 1. An allowlisted attacker engages a soft defender in range         */
/* ------------------------------------------------------------------ */

test('EEE-2: an allowlisted attacker acquires a harvester already in weapon range', () => {
  const s = mkSim();
  const a = addAttacker(s, HUNTER, FAR);
  const h = addHarvester(s, { x: FAR.x + UNITS[HUNTER].range - 0.2, y: FAR.y });

  assert.equal(acquireTarget(s, a), h.id);
});

test('EEE-2: an allowlisted attacker acquires a repair troop already in weapon range', () => {
  const s = mkSim();
  const a = addAttacker(s, HUNTER, FAR);
  const r = addRepairTroop(s, { x: FAR.x + UNITS[HUNTER].range - 0.2, y: FAR.y }, null);

  assert.equal(acquireTarget(s, a), r.id);
});

test('EEE-2: it actually deals damage, not just acquires', () => {
  const s = mkSim();
  addAttacker(s, HUNTER, FAR);
  const h = addHarvester(s, { x: FAR.x + UNITS[HUNTER].range - 0.2, y: FAR.y });
  const hp0 = h.hp;

  for (let t = 0; t < 3; t++) stepSim(s, FIXED_DT);
  const live = s.units.get(h.id);
  assert.ok(live && live.hp < hp0, `harvester took damage (${hp0} -> ${live && live.hp})`);
});

/* ------------------------------------------------------------------ */
/* 2. Only allowlisted attackers, only soft defenders                  */
/* ------------------------------------------------------------------ */

test('EEE-2: a NON-allowlisted attacker ignores a harvester in range', () => {
  const s = mkSim();
  const a = addAttacker(s, NON_HUNTER, FAR);
  addHarvester(s, { x: FAR.x + UNITS[NON_HUNTER].range - 0.2, y: FAR.y });

  assert.equal(acquireTarget(s, a), null);
});

test('EEE-2: a plain defender troop is NOT a soft defender', () => {
  // Scope limit: only repair troops and harvesters. An ordinary deployed
  // defender is out of scope and must stay untargetable.
  const s = mkSim();
  const a = addAttacker(s, HUNTER, FAR);
  const d = createUnit(s, 'GND-Troops', 1, { x: FAR.x + 1, y: FAR.y }, 'ground', 'defender');
  s.units.set(d.id, d);

  assert.equal(acquireTarget(s, a), null);
});

test('EEE-2: a soft defender OUT of weapon range is not acquired', () => {
  const s = mkSim();
  const a = addAttacker(s, HUNTER, FAR);
  addHarvester(s, { x: FAR.x + UNITS[HUNTER].range + 1.5, y: FAR.y });

  assert.equal(acquireTarget(s, a), null);
});

/* ------------------------------------------------------------------ */
/* 3. Priority: base and structures first                              */
/* ------------------------------------------------------------------ */

test('EEE-2: the base outranks a soft defender in range', () => {
  const s = mkSim();
  const a = addAttacker(s, HUNTER, { x: MAP.base.x - 1.2, y: MAP.base.y });
  addHarvester(s, { x: MAP.base.x - 1.2 + 0.3, y: MAP.base.y + 0.3 });

  assert.equal(acquireTarget(s, a), BASE_TARGET_ID);
});

test('EEE-2: a structure outranks a soft defender for a structure hunter', () => {
  const siege = Object.keys(UNITS).find((k) => UNITS[k].targets === 'Structures' && UNITS[k].domain === 'Walker');
  const s = mkSim();
  const a = addAttacker(s, siege, FAR);
  a.engagesSoftDefenders = true;   // force the capability on: priority, not eligibility, is under test
  const st = { id: 8001, structId: 'STR-Cannon', hp: 400, lifecycle: 'Complete', pos: { x: FAR.x + 3, y: FAR.y } };
  s.structures.set(st.id, st);
  addHarvester(s, { x: FAR.x + 1, y: FAR.y });   // MUCH closer than the structure

  assert.equal(acquireTarget(s, a), st.id, 'nearer soft defender must not outrank a structure');
});

/* ------------------------------------------------------------------ */
/* 4. OPPORTUNISTIC: pathing is unchanged                              */
/* ------------------------------------------------------------------ */

test('EEE-2: a harvester in range does not divert the attacker', () => {
  // Two identical sims, one with a harvester parked beside the attacker's route.
  // The attacker's trajectory must be bit-identical: no pursuit, no diversion.
  const trace = (withHarvester) => {
    const s = mkSim();
    const a = addAttacker(s, HUNTER, { x: 6, y: MAP.base.y });
    a.path = [{ x: 20, y: MAP.base.y }, { x: 30, y: MAP.base.y }];
    a.pathIdx = 0;
    if (withHarvester) addHarvester(s, { x: 7, y: MAP.base.y + 1 });
    const pts = [];
    for (let t = 0; t < 60; t++) { stepSim(s, FIXED_DT); pts.push(`${a.pos.x},${a.pos.y}`); }
    return pts.join(' ');
  };
  assert.equal(trace(true), trace(false), 'the attacker walks the same path either way');
});

/* ------------------------------------------------------------------ */
/* 5. Killing a repair troop must not latch its structure              */
/* ------------------------------------------------------------------ */

test('EEE-2: a killed repair troop releases its structure repairPending flag', () => {
  const s = mkSim();
  const st = { id: 8002, structId: 'STR-Cannon', hp: 200, maxHp: 400, lifecycle: 'Damaged',
               pos: { x: FAR.x + 6, y: FAR.y }, footprint: { w: 1, h: 1 }, repairPending: true,
               tier: 1, progress: 0, targetId: null, alive: true };
  s.structures.set(st.id, st);
  const r = addRepairTroop(s, { x: FAR.x, y: FAR.y }, st.id);
  r.hp = 1;   // dies to the first tick of fire
  addAttacker(s, HUNTER, { x: FAR.x - 0.5, y: FAR.y });

  for (let t = 0; t < 10; t++) stepSim(s, FIXED_DT);

  assert.equal(s.units.has(r.id), false, 'the repair troop was killed');
  assert.equal(st.repairPending, false, 'its structure can be repaired again');
});
