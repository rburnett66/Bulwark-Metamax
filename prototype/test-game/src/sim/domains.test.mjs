// src/sim/domains.test.mjs — EEE-1: targeting has exactly TWO categories, Air
// and Ground. `domain` is a MOVEMENT concept; Swimmer and Floater are ground
// units that move over water. Units and towers used to enumerate the ground
// domains separately and the enumerations drifted — Swimmer was hittable by
// ground UNITS but immune to ground TOWERS. node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { acquireTarget, canHitDomain } from './combat.js';
import { UNITS, STRUCTURES } from '../data/tables.js';

const GROUND_DOMAINS = ['Walker', 'Floater', 'Swimmer'];
const ALL_DOMAINS = GROUND_DOMAINS.concat(['Flyer']);

function mkState() {
  return { units: new Map(), structures: new Map(), base: null };
}
function addAttacker(state, id, domain, x) {
  state.units.set(id, { id, side: 'attacker', hp: 100, domain, pos: { x, y: 0 } });
}
/** Would a completed tower of `structId` acquire a lone attacker of `domain`? */
function towerCanHit(structId, domain) {
  const state = mkState();
  addAttacker(state, 1, domain, 1);
  const tower = { id: 90, structId, pos: { x: 0, y: 0 }, lifecycle: 'Complete' };
  return acquireTarget(state, tower) === 1;
}
/** Would a defender troop with weapon category `canTarget` acquire that attacker? */
function unitCanHit(canTarget, domain) {
  const state = mkState();
  addAttacker(state, 1, domain, 1);
  const troop = { id: 90, side: 'defender', hp: 100, pos: { x: 0, y: 0 }, range: 5, canTarget };
  return acquireTarget(state, troop) === 1;
}

/* ------------------------------------------------------------------ */
/* 1. The concrete bug: swimmers were immune to ground towers          */
/* ------------------------------------------------------------------ */

test('EEE-1: a ground tower can hit a Swimmer', () => {
  assert.equal(towerCanHit('STR-Cannon', 'Swimmer'), true);
});

test('EEE-1: the Swimmer roster is reachable by ground defences', () => {
  const swimmers = Object.keys(UNITS).filter((k) => UNITS[k].domain === 'Swimmer');
  assert.ok(swimmers.length > 0, 'roster still has Swimmer units');
  for (const id of swimmers) {
    assert.equal(towerCanHit('STR-Cannon', UNITS[id].domain), true, `${id} must be hittable by a cannon`);
  }
});

/* ------------------------------------------------------------------ */
/* 2. The invariant: units and towers must never disagree              */
/* ------------------------------------------------------------------ */

test('EEE-1: tower and unit targeting agree on every domain (ground weapons)', () => {
  for (const d of ALL_DOMAINS) {
    assert.equal(
      towerCanHit('STR-Cannon', d), unitCanHit('Ground', d),
      `ground tower vs ground unit disagree on ${d}`
    );
  }
});

test('EEE-1: tower and unit targeting agree on every domain (air weapons)', () => {
  for (const d of ALL_DOMAINS) {
    assert.equal(
      towerCanHit('STR-Flak', d), unitCanHit('Air', d),
      `flak tower vs AA unit disagree on ${d}`
    );
  }
});

/* ------------------------------------------------------------------ */
/* 3. Two categories, and only two                                     */
/* ------------------------------------------------------------------ */

test('EEE-1: every non-Flyer domain is Ground for targeting', () => {
  for (const d of GROUND_DOMAINS) {
    assert.equal(canHitDomain('Ground', d), true, `${d} must be Ground`);
    assert.equal(canHitDomain('Both', d), true, `${d} must be hit by Both`);
    assert.equal(canHitDomain('Air', d), false, `${d} must NOT be hit by an AA-only weapon`);
    assert.equal(towerCanHit('STR-Cannon', d), true, `${d} must be hit by a cannon`);
    assert.equal(towerCanHit('STR-Flak', d), false, `${d} must NOT be hit by flak`);
  }
});

test('EEE-1: Flyer is Air for targeting, and only Air', () => {
  assert.equal(canHitDomain('Air', 'Flyer'), true);
  assert.equal(canHitDomain('Both', 'Flyer'), true);
  assert.equal(canHitDomain('Ground', 'Flyer'), false);
  assert.equal(towerCanHit('STR-Flak', 'Flyer'), true);
  assert.equal(towerCanHit('STR-Cannon', 'Flyer'), false);
});

test('EEE-1: a weaponless structure (empty canTargetDomains) hits nothing', () => {
  assert.deepEqual(STRUCTURES['STR-Wall'].canTargetDomains, []);
  for (const d of ALL_DOMAINS) {
    assert.equal(towerCanHit('STR-Wall', d), false, `a wall must not target ${d}`);
  }
});

/* ------------------------------------------------------------------ */
/* 3b. End-to-end: a live cannon actually SHOOTS a swimmer             */
/*     (balanceSim's harness board cannot see this — its tower row     */
/*     sits ~16 cells from the water lane, well outside cannon range)  */
/* ------------------------------------------------------------------ */

test('EEE-1: a completed cannon damages an adjacent Swimmer through stepCombat', async () => {
  const { MAP } = await import('../data/tables.js');
  const { createSim, stepSim, FIXED_DT } = await import('./core.js');
  const { placeCompletedStructure } = await import('./balanceSim.js');
  const { createUnit } = await import('./entities.js');

  const state = createSim(4242, { waves: [], map: MAP });
  const slot = MAP.slots[0];
  const tower = placeCompletedStructure(state, 'STR-Cannon', slot);

  // Park a Swimmer one cell from the cannon — well inside its 4.5 range.
  const swimmer = createUnit(state, 'WTR-Troops', 1, { x: slot.x + 1, y: slot.y }, 'water', 'attacker');
  state.units.set(swimmer.id, swimmer);
  const startHp = swimmer.hp;

  for (let t = 0; t < 5; t++) stepSim(state, FIXED_DT);

  const live = state.units.get(swimmer.id);
  assert.ok(live, 'swimmer survived five ticks of cannon fire');
  assert.ok(live.hp < startHp, `cannon must damage the swimmer (hp ${startHp} -> ${live.hp})`);
  assert.equal(tower.targetId, swimmer.id, 'the cannon actually acquired the swimmer');
});

/* ------------------------------------------------------------------ */
/* 4. Movement still treats Floater/Swimmer as water                   */
/*    (targeting unification must NOT have leaked into movement)       */
/* ------------------------------------------------------------------ */

test('EEE-1: Floater and Swimmer still spawn down the WATER lane', async () => {
  // Targeting is unified; movement is not. The generated wave table is the
  // observable proof that the lane still follows the movement domain.
  const { WAVES } = await import('../data/tables.js');
  const expected = { Flyer: 'air', Floater: 'water', Swimmer: 'water', Walker: 'ground' };
  let sawSwimmer = false;
  for (const w of WAVES) {
    for (const sp of w.spawns || []) {
      const def = UNITS[sp.unitId];
      if (!def) continue;
      assert.equal(sp.lane, expected[def.domain], `${sp.unitId} (${def.domain}) spawned in lane ${sp.lane}`);
      if (def.domain === 'Swimmer') sawSwimmer = true;
    }
  }
  assert.ok(sawSwimmer, 'the wave table still fields Swimmer units');
});
