// src/gallery/lane.test.mjs — the GAUNTLET must be deterministic and agree with
// the game's combat rules (it literally runs createSim/stepSim). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { EFFECTIVENESS, UNITS } from '../data/tables.js';
import { runGauntlet, runGauntletMatrix, GAUNTLET_DEFENSES, MINE_SPEC } from './lane.js';

const D = Object.fromEntries(GAUNTLET_DEFENSES.map((d) => [d.key, d]));

test('deterministic: two identical runs return identical metrics', () => {
  const a = runGauntlet({ unitId: 'GND-Tanks', tier: 1, defense: D.cannon1, seed: 7 });
  const b = runGauntlet({ unitId: 'GND-Tanks', tier: 1, defense: D.cannon1, seed: 7 });
  assert.deepEqual(a, b);
});

test('no defense: every domain reaches the base untouched', () => {
  for (const id of ['GND-Tanks', 'AIR-Copters', 'WTR-Trucks']) {
    const r = runGauntlet({ unitId: id, tier: 1, defense: D.none });
    assert.equal(r.outcome, 'reached', id + ': ' + r.outcome);
    assert.equal(r.damageTaken, 0, id + ' took damage with no defense');
    assert.equal(r.hpFrac, 1);
  }
});

test('domain rules: flak never touches a walker; cannon never touches a flyer', () => {
  const walker = runGauntlet({ unitId: 'GND-Tanks', tier: 1, defense: D.flak3 });
  assert.equal(walker.outcome, 'reached');
  assert.equal(walker.damageTaken, 0);
  assert.equal(walker.tAcquire, null);
  const flyer = runGauntlet({ unitId: 'AIR-Copters', tier: 1, defense: D.cannon3 });
  assert.equal(flyer.outcome, 'reached');
  assert.equal(flyer.damageTaken, 0);
});

test('cannon acquires a walker and higher tiers hurt more (or kill sooner)', () => {
  const t1 = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon1 });
  const t3 = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon3 });
  assert.ok(t1.tAcquire > 0, 'cannon locked the troops');
  assert.ok(t1.damageTaken > 0, 'cannon dealt damage');
  assert.ok(t1.acquireDist <= 4.5 + 0.01, 'locked inside cannon range');
  // T3 = 2.3x dps: either kills what T1 let through, or strictly more dps received
  const t1Score = t1.outcome === 'died' ? 0 : t1.hpFrac;
  const t3Score = t3.outcome === 'died' ? 0 : t3.hpFrac;
  assert.ok(t3Score <= t1Score, `T3 (${t3Score}) should never leave MORE hp than T1 (${t1Score})`);
  assert.ok(t3.dpsReceived > t1.dpsReceived, 'T3 dps received > T1');
});

test('flak shreds flyers by tier', () => {
  const t1 = runGauntlet({ unitId: 'AIR-Copters', tier: 1, defense: D.flak1 });
  const t3 = runGauntlet({ unitId: 'AIR-Copters', tier: 1, defense: D.flak3 });
  assert.ok(t1.damageTaken > 0, 'flak hit the copter');
  const s1 = t1.outcome === 'died' ? 0 : t1.hpFrac;
  const s3 = t3.outcome === 'died' ? 0 : t3.hpFrac;
  assert.ok(s3 <= s1, 'higher flak tier is never kinder to the flyer');
});

test('mine (M0 spec): triggers on a walker with an effectiveness-honest burst, ignores flyers', () => {
  const tank = runGauntlet({ unitId: 'GND-Tanks', tier: 1, defense: D.mine });
  assert.ok(tank.mine.triggered, 'mine fired on the tank');
  const expected = MINE_SPEC.damage * EFFECTIVENESS[MINE_SPEC.damageType][UNITS['GND-Tanks'].armorClass];
  assert.ok(Math.abs(tank.mine.dealt - expected) < 0.5, `burst ${tank.mine.dealt} ≈ ${expected}`);
  assert.ok(tank.damageTaken >= expected - 0.5, 'the tank actually took the burst');
  const air = runGauntlet({ unitId: 'AIR-Copters', tier: 1, defense: D.mine });
  assert.equal(air.mine.triggered, false, 'air units never trigger mines');
  assert.equal(air.damageTaken, 0);
});

test('matrix covers the owner set: none + cannon x3 + flak x3 + mine', () => {
  const rows = runGauntletMatrix('GND-Troops', 1);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.defense),
    ['none', 'cannon1', 'cannon2', 'cannon3', 'flak1', 'flak2', 'flak3', 'mine']);
  for (const r of rows) assert.ok(r.outcome === 'reached' || r.outcome === 'died', r.defense + ': ' + r.outcome);
});
