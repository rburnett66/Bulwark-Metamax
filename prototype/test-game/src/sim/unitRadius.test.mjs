// Collision radius is SIM DATA. This gate exists because it wasn't.
//
// It used to be built in main.js from the loaded voxel packs — the pack's baked `collision` if present,
// otherwise an estimate of footprint x 0.5 x 0.4 — and handed to the sim as `state.voxelRadii`. Two
// things were wrong with that, and only the second was loud:
//
//   1. An art tool authored a simulation input. Radius drives separation, pathfinding, spawn spacing and
//      contact, so a cosmetic re-bake in a browser changed simulation outcomes. Four of the five units
//      with packs were running the ESTIMATE, diverging from the stats table by -55% to +24%.
//   2. serializeLog never carried voxelRadii, so a replay reconstructed with radii the original battle
//      never used. Positions diverged and the hash mismatched — a silent break of the determinism
//      contract the project treats as load-bearing.
//
// Radius now lives on the unit def. These tests pin the properties that made the old design wrong, so a
// future change cannot quietly reintroduce either half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../data/tables.js';
import { createUnit, unitRadius } from './entities.js';

// The five units that carried a voxel pack, with the radius the OLD art-derived path produced. Seeded
// deliberately so ownership moved without balance moving — the four marked ESTIMATE in tables.js are
// still guesses and want a deliberate pass, but they are the guesses that were already live.
const SEEDED = {
  'GND-Tanks': 0.572,          // the one genuinely baked from a measured body extent
  'GND-Artillery': 0.5,        // estimate
  'GND-HeavyTanks': 0.4,       // estimate
  'GRN-Trucks': 0.188,         // estimate — 55% under what the shape table would have said
  'GRN-Tanks': 0.388,          // estimate
};

test('the units that had art-derived radii keep exactly the radius they had', () => {
  for (const [id, r] of Object.entries(SEEDED)) {
    assert.equal(UNITS[id].radius, r,
      `${id} radius moved — ownership was supposed to change, balance was not`);
  }
});

test('a unit with an explicit radius uses it; one without falls back to the shape table', () => {
  const withR = createUnit({}, 'GND-Tanks', 1, { x: 0, y: 0 }, 0, 'attacker');
  assert.equal(withR.radius, 0.572);

  const id = Object.keys(UNITS).find((k) => UNITS[k].radius == null);
  assert.ok(id, 'expected at least one unit without an explicit radius');
  const withoutR = createUnit({}, id, 1, { x: 0, y: 0 }, 0, 'attacker');
  assert.equal(withoutR.radius, unitRadius(UNITS[id]));
});

test('NOTHING outside the unit def can set a radius — the art pipeline is cut out', () => {
  // The old shape was createUnit reading state.voxelRadii[artKey]. Passing a state that carries one must
  // now change nothing at all; if this starts failing, an art-authored override has crept back in.
  const clean = createUnit({}, 'GND-Tanks', 1, { x: 0, y: 0 }, 0, 'attacker');
  const spiked = createUnit({ voxelRadii: { 'GND-Tanks': 9.99 } }, 'GND-Tanks', 1, { x: 0, y: 0 }, 0, 'attacker');
  assert.equal(spiked.radius, clean.radius, 'a state-supplied radius must be ignored');
  assert.equal(spiked.radius, 0.572);
});

test('radius is reproducible from the unit id alone — which is what makes a replay reproduce it', () => {
  // The determinism half of the original bug: the log carries the unit id, so if radius is a pure
  // function of the def, a replay cannot disagree with the battle. This asserts that purity rather than
  // asserting a hash, because a hash fixture would pass for the wrong reason if the value were seeded
  // from ambient state again.
  for (const id of Object.keys(UNITS)) {
    const a = createUnit({}, id, 1, { x: 0, y: 0 }, 0, 'attacker');
    const b = createUnit({}, id, 3, { x: 5, y: 5 }, 1, 'attacker');
    assert.equal(a.radius, b.radius, `${id} radius varied with something other than its def`);
    assert.ok(a.radius > 0, `${id} radius must be positive`);
  }
});
