// src/gallery/calc.test.mjs — the SHOOTING GALLERY math must agree with the
// shipping combat path (it literally runs it). node --test, no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';

import { EFFECTIVENESS, UNITS, STRUCTURES, ASSUMPTIONS } from '../data/tables.js';
import {
  makeUnitTarget, makeStructureTarget, makeArmorTarget,
  unitShooter, towerShooter, legalHit, measure, splashHits, retuneDiff,
} from './calc.js';

test('unit target comes from the real factory with table stats at tier', () => {
  const t2 = makeUnitTarget('GND-Tanks', 2);
  assert.equal(t2.hp, UNITS['GND-Tanks'].hp[1]);
  assert.equal(t2.armorClass, 'Machinery');
  assert.equal(t2.domain, 'Walker');
});

test('structure target is completed and tiered', () => {
  const s = makeStructureTarget('STR-Cannon', 3);
  assert.equal(s.hp, STRUCTURES['STR-Cannon'].hp[2]);
  assert.equal(s.lifecycle, 'Complete');
});

test('measured multiplier matches the EFFECTIVENESS matrix', () => {
  const cases = [
    ['ARC-Troops', 'Organic', 'Fire'],        // 1.3
    ['HTC-Tanks', 'Machinery', 'Electric'],   // 1.8
    ['GND-Troops', 'Energy', 'Kinetic'],      // 1.1
  ];
  for (const [shooterId, armor, dtype] of cases) {
    const sh = unitShooter(shooterId, 1);
    assert.equal(sh.damageType, dtype, `${shooterId} table damageType`);
    const m = measure(sh, makeArmorTarget(armor));
    assert.ok(Math.abs(m.mult - EFFECTIVENESS[dtype][armor]) < 1e-9,
      `${dtype} vs ${armor}: got ${m.mult}`);
  }
});

test('TTK agrees with hp / effective dps (tick-quantised)', () => {
  const sh = unitShooter('GND-Tanks', 1);           // 45 Kinetic
  const tgt = makeUnitTarget('AIR-Troops', 1);      // 170 Organic, x1
  const m = measure(sh, tgt);
  const analytic = tgt.hp / m.effDps;
  assert.ok(m.ttk >= analytic - 1e-9 && m.ttk <= analytic + 1 / 30 + 1e-9,
    `ttk ${m.ttk} vs analytic ${analytic}`);
});

test('Poison never kills a Structure (x0): infinite TTK, zero eff dps', () => {
  const sh = unitShooter('DRK-Troops', 1);          // Poison
  const m = measure(sh, makeStructureTarget('STR-Wall', 1));
  assert.equal(m.effDps, 0);
  assert.equal(m.ttk, Infinity);
});

test('domain legality: anti-ground never hits Flyer, flak never hits ground/structures', () => {
  assert.equal(legalHit(unitShooter('GND-Troops', 1), makeUnitTarget('AIR-Copters', 1)), false);
  const flak = towerShooter('STR-Flak', 1);
  assert.equal(flak.canTarget, 'Air');
  assert.equal(legalHit(flak, makeUnitTarget('GND-Tanks', 1)), false);
  assert.equal(legalHit(flak, makeStructureTarget('STR-Wall', 1)), false);
  assert.equal(legalHit(flak, makeUnitTarget('AIR-Copters', 1)), true);
  const m = measure(flak, makeUnitTarget('GND-Tanks', 1));
  assert.equal(m.ttk, Infinity);
});

test('splash: zero without aoe, several packed neighbours for artillery', () => {
  const tgt = makeUnitTarget('GND-Troops', 1);
  assert.equal(splashHits(unitShooter('GND-Tanks', 1), tgt), 0);          // aoe 0
  const arty = unitShooter('GND-Artillery', 1);                            // aoe 2
  assert.ok(splashHits(arty, tgt, 0.8) >= 6, 'aoe 2 over 0.8 spacing should catch a cluster');
  assert.equal(splashHits(arty, makeUnitTarget('AIR-Copters', 1)), 0);     // anti-ground splash can't catch flyers
});

test('retuneDiff: only changed fields, T2/T3 re-derived, empty when clean', () => {
  assert.equal(retuneDiff('GND-Tanks', { dps: UNITS['GND-Tanks'].dps[0] }), '');
  const d = retuneDiff('GND-Tanks', { dps: 50, damageType: 'Fire' });
  assert.match(d, /'GND-Tanks'/);
  assert.match(d, /dps: \[50, 77.5, 115\]/);                 // 50 x 1.55 / x 2.3
  assert.match(d, /was \[45, 69.75, 103.5\]/);
  assert.match(d, /damageType: 'Fire',\s+\/\/ was 'Kinetic'/);
  assert.doesNotMatch(d, /aoeRadius/);
  assert.equal(ASSUMPTIONS.upgradeDpsX.t2, 1.55);            // diff derivation depends on these
});
