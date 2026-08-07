// src/sim/baseReach.test.mjs — EEE-3: "is this attacker in reach of the base?"
// had two answers in the same tick. stepMovement measured to the nearest base
// FOOTPRINT cell with a 1.4-cell floor (so the mob can spread AROUND the keep
// and short-range units don't stall); acquireTarget measured to the base CENTRE
// with no floor. A unit at the footprint edge was damaging the base while
// acquireTarget returned null, leaving targetId null mid-attack. node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP, UNITS } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { acquireTarget, inBaseReach, BASE_TARGET_ID } from './combat.js';

/** Empty-wave sim on the standard board, with one attacker parked at `pos`. */
function parkAttacker(unitId, pos) {
  const state = createSim(31337, { waves: [], map: MAP });
  const u = createUnit(state, unitId, 1, pos, 'ground', 'attacker');
  state.units.set(u.id, u);
  u.path = [];            // parked: no march, so the geometry under test holds still
  u.pathIdx = 0;
  return { state, unit: u };
}

/** Distance from a point to the nearest base footprint cell. */
function footprintDist(state, pos) {
  const cells = (state.base.cells && state.base.cells.length) ? state.base.cells : [state.base.pos];
  let best = Infinity;
  for (const c of cells) best = Math.min(best, Math.hypot(pos.x - c.x, pos.y - c.y));
  return best;
}

/* ------------------------------------------------------------------ */
/* 1. The divergence itself                                            */
/* ------------------------------------------------------------------ */

test('EEE-3: a unit damaging the base from the footprint edge also TARGETS it', () => {
  // GND-Troops range 2.5. Park it so the base CENTRE is out of weapon range but
  // the nearest footprint cell is inside it — the exact gap between the two
  // definitions. stepMovement damaged the base here; acquireTarget said null.
  const range = UNITS['GND-Troops'].range;
  const pos = { x: MAP.base.x - range - 0.4, y: MAP.base.y };
  const { state, unit } = parkAttacker('GND-Troops', pos);

  const centreDist = Math.hypot(pos.x - state.base.pos.x, pos.y - state.base.pos.y);
  assert.ok(centreDist > range, `fixture: base centre must be OUT of range (${centreDist.toFixed(2)} > ${range})`);
  assert.ok(footprintDist(state, pos) <= range, 'fixture: base footprint must be IN range');

  const hpBefore = state.base.hp;
  stepSim(state, FIXED_DT);

  assert.ok(state.base.hp < hpBefore, 'the unit is damaging the base');
  assert.equal(unit.state, 'attacking', 'the unit is in the attacking state');
  assert.equal(unit.targetId, BASE_TARGET_ID, 'and its target is the base, not null');
});

test('EEE-3: acquireTarget and inBaseReach agree at the footprint edge', () => {
  const range = UNITS['GND-Troops'].range;
  const { state, unit } = parkAttacker('GND-Troops', { x: MAP.base.x - range - 0.4, y: MAP.base.y });

  assert.equal(inBaseReach(state, unit), true);
  assert.equal(acquireTarget(state, unit), BASE_TARGET_ID);
});

/* ------------------------------------------------------------------ */
/* 2. The floor survives the reconciliation                            */
/* ------------------------------------------------------------------ */

test('EEE-3: the reach FLOOR still lets a sub-1.4-range unit engage', () => {
  // WTR-Trucks range 1.225 — below the floor. Parked 1.35 cells from the nearest
  // footprint cell it is outside its own weapon range but inside the floor, which
  // is exactly what the floor exists for (short-range units must not stall).
  const id = 'WTR-Trucks';
  const range = UNITS[id].range;
  assert.ok(range < 1.4, `fixture: ${id} range ${range} must be below the floor`);

  const pos = { x: MAP.base.x - 1 - 1.35, y: MAP.base.y };   // (57,16) is a footprint cell
  const { state, unit } = parkAttacker(id, pos);
  const fd = footprintDist(state, pos);
  assert.ok(fd > range && fd < 1.4, `fixture: footprint dist ${fd.toFixed(3)} must sit between range and the floor`);

  assert.equal(inBaseReach(state, unit), true, 'the floor puts it in reach');
  assert.equal(acquireTarget(state, unit), BASE_TARGET_ID, 'and acquisition agrees');
});

/* ------------------------------------------------------------------ */
/* 3. Out of reach is still out of reach                               */
/* ------------------------------------------------------------------ */

test('EEE-3: a unit well clear of the base is in reach of nothing', () => {
  const { state, unit } = parkAttacker('GND-Troops', { x: MAP.base.x - 12, y: MAP.base.y });
  assert.equal(inBaseReach(state, unit), false);
  assert.equal(acquireTarget(state, unit), null);

  const hpBefore = state.base.hp;
  stepSim(state, FIXED_DT);
  assert.equal(state.base.hp, hpBefore, 'and it deals no base damage');
});

/* ------------------------------------------------------------------ */
/* 4. Reach is measured to the FOOTPRINT, so the mob can ring the keep  */
/* ------------------------------------------------------------------ */

test('EEE-3: reach is footprint-based on every side of the keep', () => {
  const range = UNITS['GND-Troops'].range;
  const offsets = [
    { x: -range - 0.4, y: 0 }, { x: range + 0.4, y: 0 },
    { x: 0, y: -range - 0.4 }, { x: 0, y: range + 0.4 },
  ];
  for (const o of offsets) {
    const pos = { x: MAP.base.x + o.x, y: MAP.base.y + o.y };
    const { state, unit } = parkAttacker('GND-Troops', pos);
    assert.equal(inBaseReach(state, unit), true, `in reach from offset ${o.x},${o.y}`);
    assert.equal(acquireTarget(state, unit), BASE_TARGET_ID, `acquires the base from offset ${o.x},${o.y}`);
  }
});

/* ------------------------------------------------------------------ */
/* 4b. The base sentinel is not mistaken for a structure target        */
/* ------------------------------------------------------------------ */

test('EEE-3: a structure hunter with nothing left to siege still hits the base', () => {
  // acquireTarget hands a Targets:Structures unit BASE_TARGET_ID when no
  // structure is in reach. stepMovement treated any non-null targetId as "has a
  // structure target" and skipped its base-damage branch — and stepCombat skips
  // the base too, because stepMovement owns that damage. Net: the unit parked at
  // the keep and dealt nothing. Latent before the reach reconciliation; live the
  // moment acquireTarget started answering with the same footprint rule.
  const id = 'WTR-Artillery';
  assert.equal(UNITS[id].targets, 'Structures', 'fixture: must be a structure hunter');

  const { state, unit } = parkAttacker(id, { x: MAP.base.x - 3, y: MAP.base.y });
  assert.equal(state.structures.size, 0, 'fixture: no structures on the board');

  const hpBefore = state.base.hp;
  for (let t = 0; t < 5; t++) stepSim(state, FIXED_DT);

  assert.equal(unit.targetId, BASE_TARGET_ID, 'it falls back to the base sentinel');
  assert.ok(state.base.hp < hpBefore, 'and it actually damages the base');
});

/* ------------------------------------------------------------------ */
/* 5. Base damage is still applied EXACTLY ONCE per tick               */
/*    (stepMovement owns it; stepCombat must keep skipping the base)   */
/* ------------------------------------------------------------------ */

test('EEE-3: the base takes one unit-tick of damage, not two', () => {
  const range = UNITS['GND-Troops'].range;
  const { state, unit } = parkAttacker('GND-Troops', { x: MAP.base.x - range - 0.4, y: MAP.base.y });

  const hpBefore = state.base.hp;
  stepSim(state, FIXED_DT);
  const dealt = hpBefore - state.base.hp;

  const expected = unit.dps * FIXED_DT;   // Structure armor vs this damage type is 1.0x on this fixture
  assert.ok(dealt > 0, 'base took damage');
  assert.ok(
    Math.abs(dealt - expected) < expected * 0.5,
    `base took ~one unit-tick (${dealt.toFixed(3)}), not double (${(expected * 2).toFixed(3)})`
  );
});
