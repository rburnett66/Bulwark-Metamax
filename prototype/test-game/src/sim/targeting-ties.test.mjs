// src/sim/targeting-ties.test.mjs — EEE-4: acquireTarget's documented rule is
// "nearest, ties broken by the LOWEST entity id". It was comparing `Math.sqrt`
// results with `===`, so the id tie-break never fired and float noise picked the
// winner. Ranking now happens in SQUARED space with an explicit tie window.
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { acquireTarget } from './combat.js';
import { STRUCTURES } from '../data/tables.js';

/** Minimal SimState for acquireTarget: it only reads units/structures/base. */
function mkState() {
  return { units: new Map(), structures: new Map(), base: null };
}
/** A plain attacker-side unit record (no structId => not a tower). */
function mkAttacker(id, x, y, domain = 'Walker') {
  return { id, side: 'attacker', hp: 100, domain, pos: { x, y } };
}
/** A defender-side troop shooter (acquireTarget's third branch). */
function mkDefenderShooter(range, canTarget = 'Ground') {
  return { id: 999, side: 'defender', hp: 100, pos: { x: 0, y: 0 }, range, canTarget };
}

/* ------------------------------------------------------------------ */
/* 1. The tie-break actually fires                                     */
/* ------------------------------------------------------------------ */

test('EEE-4: equidistant-within-noise candidates resolve to the LOWEST id, not the float-nearest', () => {
  // id 1 sits at exactly 5.0; id 2 sits 1e-9 cells closer — a nanometre if a
  // cell is a metre. By the documented rule these are the same distance and id 1
  // must win. Before the fix `d < bestD` handed it to id 2.
  const state = mkState();
  state.units.set(1, mkAttacker(1, 5, 0));
  state.units.set(2, mkAttacker(2, 5 - 1e-9, 0));

  assert.equal(acquireTarget(state, mkDefenderShooter(6)), 1);
});

test('EEE-4: the id rule wins independent of Map iteration order', () => {
  // Same geometry, but the NEARER (by float noise) lower-id... here the higher id
  // is inserted FIRST, so insertion order alone would hand it the win. Only a
  // live id tie-break returns 1. This is the case the old `d === bestD` could
  // never reach.
  const state = mkState();
  state.units.set(2, mkAttacker(2, 5 - 1e-9, 0));
  state.units.set(1, mkAttacker(1, 5, 0));

  assert.equal(acquireTarget(state, mkDefenderShooter(6)), 1);
});

test('EEE-4: exactly-equal distances still resolve to the lowest id', () => {
  // (3,4) and (5,0) are both exactly 5 from the origin in float64.
  const state = mkState();
  state.units.set(7, mkAttacker(7, 3, 4));
  state.units.set(3, mkAttacker(3, 5, 0));

  assert.equal(acquireTarget(state, mkDefenderShooter(6)), 3);
});

/* ------------------------------------------------------------------ */
/* 2. A genuine distance difference still beats a lower id             */
/* ------------------------------------------------------------------ */

test('EEE-4: a genuinely nearer target wins even with a higher id', () => {
  const state = mkState();
  state.units.set(1, mkAttacker(1, 5, 0));
  state.units.set(2, mkAttacker(2, 3, 0));

  assert.equal(acquireTarget(state, mkDefenderShooter(6)), 2);
});

test('EEE-4: the tie window is far narrower than any real positional difference', () => {
  // 0.01 cells apart — two orders of magnitude above the tie window, and still
  // well below one tick of the slowest unit's movement. Distance must decide.
  const state = mkState();
  state.units.set(1, mkAttacker(1, 5, 0));
  state.units.set(2, mkAttacker(2, 4.99, 0));

  assert.equal(acquireTarget(state, mkDefenderShooter(6)), 2);
});

/* ------------------------------------------------------------------ */
/* 3. Squared-range conversion must not move the range boundary        */
/* ------------------------------------------------------------------ */

test('EEE-4: a target exactly AT weapon range is still in range', () => {
  const state = mkState();
  state.units.set(1, mkAttacker(1, 3, 4)); // d == 5.0 exactly
  assert.equal(acquireTarget(state, mkDefenderShooter(5)), 1);
});

test('EEE-4: a target just beyond weapon range is still out of range', () => {
  const state = mkState();
  state.units.set(1, mkAttacker(1, 5.0001, 0));
  assert.equal(acquireTarget(state, mkDefenderShooter(5)), null);
});

test('EEE-4: the tie window never drags an out-of-range target in', () => {
  // id 1 is out of range, id 2 is in range. The nearest-in-range answer is 2 —
  // the tie window must not let the out-of-range candidate participate at all.
  const state = mkState();
  state.units.set(1, mkAttacker(1, 5.0001, 0));
  state.units.set(2, mkAttacker(2, 4.9, 0));
  assert.equal(acquireTarget(state, mkDefenderShooter(5)), 2);
});

/* ------------------------------------------------------------------ */
/* 4. The same rule on the OTHER two acquisition branches              */
/* ------------------------------------------------------------------ */

test('EEE-4: tower acquisition breaks near-ties by lowest id too', () => {
  const def = STRUCTURES['STR-Cannon'];
  const state = mkState();
  state.units.set(5, mkAttacker(5, 4 - 1e-9, 0));
  state.units.set(4, mkAttacker(4, 4, 0));

  const tower = { id: 50, structId: 'STR-Cannon', pos: { x: 0, y: 0 }, lifecycle: 'Complete' };
  assert.ok(def.range > 4, 'STR-Cannon must out-range the fixture geometry');
  assert.equal(acquireTarget(state, tower), 4);
});

test('EEE-4: attacker structure-hunting breaks near-ties by lowest id too', () => {
  const state = mkState();
  const mkStruct = (id, x) => ({ id, structId: 'STR-Wall', hp: 100, lifecycle: 'Complete', pos: { x, y: 0 } });
  state.structures.set(9, mkStruct(9, 5 - 1e-9));
  state.structures.set(8, mkStruct(8, 5));

  const siege = { id: 77, side: 'attacker', hp: 100, pos: { x: 0, y: 0 }, range: 6, targetsBase: false, role: 'Siege' };
  assert.equal(acquireTarget(state, siege), 8);
});

/* ------------------------------------------------------------------ */
/* 5. Determinism is unchanged                                         */
/* ------------------------------------------------------------------ */

test('EEE-4: acquisition is repeatable for identical inputs', () => {
  const build = () => {
    const s = mkState();
    for (let i = 1; i <= 12; i++) s.units.set(i, mkAttacker(i, 1 + i * 0.31, (i % 3) * 0.7));
    return s;
  };
  const a = acquireTarget(build(), mkDefenderShooter(9));
  const b = acquireTarget(build(), mkDefenderShooter(9));
  assert.equal(a, b);
  assert.notEqual(a, null);
});
