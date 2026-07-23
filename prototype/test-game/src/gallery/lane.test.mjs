// src/gallery/lane.test.mjs — the GAUNTLET must be deterministic and agree with
// the game's combat rules (it literally runs createSim/stepSim). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { EFFECTIVENESS, UNITS } from '../data/tables.js';
import { runGauntlet, runGauntletMatrix, runFactionSweep, runFiringLine, GAUNTLET_DEFENSES, FIRING_LINE, MINE_SPEC } from './lane.js';

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

test('mine (rev 2 spec): one-shots the tank on trigger, ignores flyers', () => {
  const tank = runGauntlet({ unitId: 'GND-Tanks', tier: 1, defense: D.mine });
  assert.ok(tank.mine.triggered, 'mine fired on the tank');
  const rawBurst = MINE_SPEC.damage * EFFECTIVENESS[MINE_SPEC.damageType][UNITS['GND-Tanks'].armorClass];
  const expected = Math.min(UNITS['GND-Tanks'].hp[0], rawBurst);   // applyDamage caps dealt at remaining hp
  assert.ok(Math.abs(tank.mine.dealt - expected) < 0.5, `burst ${tank.mine.dealt} ≈ ${expected}`);
  assert.equal(tank.outcome, 'died', 'rev 2: the mine eliminates any tank');
  const air = runGauntlet({ unitId: 'AIR-Copters', tier: 1, defense: D.mine });
  assert.equal(air.mine.triggered, false, 'air units never trigger mines');
  assert.equal(air.damageTaken, 0);
});

test('tuning overrides ride the real sim (hp saves, speed hastens, deterministic)', () => {
  const dead = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon3 });
  assert.equal(dead.outcome, 'died', 'baseline troops die to cannon T3');
  const tanky = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon3, edits: { hp: 100000 } });
  assert.equal(tanky.outcome, 'reached', 'hp override survives the same gauntlet');
  assert.ok(tanky.damageTaken > 0, 'still took the cannon fire');
  const slow = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.none });
  const fast = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.none, edits: { speed: 4 } });
  assert.ok(fast.time < slow.time, `speed 4 (${fast.time}s) beats table (${slow.time}s)`);
  const a = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon1, edits: { hp: 500, dps: 60 } });
  const b = runGauntlet({ unitId: 'GND-Troops', tier: 1, defense: D.cannon1, edits: { hp: 500, dps: 60 } });
  assert.deepEqual(a, b, 'edited runs stay deterministic');
});

test('faction sweep: every unit x every defense, no-defense column always reaches', () => {
  const sweep = runFactionSweep('Ground / Powder', 1);
  assert.equal(sweep.length, 8, 'Ground / Powder fields 8 units');
  for (const u of sweep) {
    assert.equal(u.runs.length, GAUNTLET_DEFENSES.length, u.unitId + ' covers all defenses');
    assert.equal(u.runs[0].outcome, 'reached', u.unitId + ' reaches with no defense');
  }
});

test('firing line: ground runner — cannons deal, flaks read 0, mine fires, attribution sums', () => {
  const r = runFiringLine({ unitId: 'GND-Tanks', tier: 1 });   // immortal probe by default
  assert.equal(r.outcome, 'reached', 'immortal probe crosses the whole line');
  assert.equal(r.towers.length, 6);
  for (const t of r.towers.slice(0, 3)) {
    assert.ok(t.damage > 0, t.label + ' dealt damage');
    assert.ok(t.tAcquire > 0 && t.lockTime > 0, t.label + ' locked the runner');
  }
  for (const t of r.towers.slice(3)) {
    assert.equal(t.damage, 0, t.label + ' cannot touch a walker');
    assert.equal(t.tAcquire, null);
  }
  assert.ok(r.mine.triggered, 'mine fired on the tank');
  const split = r.towers.reduce((s, t) => s + t.damage, 0) + r.mine.dealt;
  assert.ok(Math.abs(split - r.totalDamage) < 2, `per-tower split ${split} ≈ total ${r.totalDamage}`);
  assert.ok(r.wouldDieAt, 'a T1 tank would not survive three cannons: ' + JSON.stringify(r.wouldDieAt));
  const again = runFiringLine({ unitId: 'GND-Tanks', tier: 1 });
  assert.deepEqual(again, r, 'deterministic');
});

test('firing line: air runner — flaks deal, cannons read 0, mine ignores it', () => {
  const r = runFiringLine({ unitId: 'AIR-Copters', tier: 1 });
  for (const t of r.towers.slice(0, 3)) assert.equal(t.damage, 0, t.label + ' cannot touch a flyer');
  assert.ok(r.towers.slice(3).some((t) => t.damage > 0), 'at least one flak engaged the flyer');
  assert.equal(r.mine.triggered, false, 'mines never trigger on air');
});

test('firing line mortal mode: fragile runner dies inside the line', () => {
  const r = runFiringLine({ unitId: 'GND-Troops', tier: 1, immortal: false });
  assert.equal(r.outcome, 'died');
  assert.ok(r.hpLeft === 0, 'dead means 0 hp');
  assert.ok(r.traveled > 0 && r.traveled < 70, 'died mid-lane at ' + r.traveled + ' tiles');
});

test('matrix covers the owner set: none + cannon x3 + flak x3 + mine', () => {
  const rows = runGauntletMatrix('GND-Troops', 1);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.defense),
    ['none', 'cannon1', 'cannon2', 'cannon3', 'flak1', 'flak2', 'flak3', 'mine']);
  for (const r of rows) assert.ok(r.outcome === 'reached' || r.outcome === 'died', r.defense + ': ' + r.outcome);
});
