// Outpost buildings, contracts and tuning read from the workbook match the design [MM-story_mw5oe4ap_i].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTPOST, KIT, DEFENSE_KINDS, structureDef, maxTier, contractFor, powerBudget, bayUnits, loadUnits, allStructures } from './outpost.js';
import { oresOf, ORE_TIERS } from './ores.js';
import { STRUCTURES } from './tables.js';

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];

test("the owner's fixed numbers (design §4.1)", () => {
  assert.equal(OUTPOST.Load_Sec, 300, 'a load every 5 minutes');
  assert.equal(OUTPOST.Store_Hours, 4);
  assert.equal(OUTPOST.Deep_Rate_Mult, 0.25);
  assert.equal(OUTPOST.Deep_Price_Mult, 5);
  assert.equal(OUTPOST.Breach_Storage_Loss, 0.25);
  assert.equal(OUTPOST.Far_Buyer_Mult, 2);
});

test('the kit draws 9 of the first station\'s 10 power (design §4.5)', () => {
  const kit = KIT.map((kind) => ({ kind, tier: 1 }));
  assert.deepEqual(powerBudget(kit), { supply: 10, draw: 9, spare: 1 });
  assert.equal(structureDef('power', 2).supply, 20);
  assert.equal(structureDef('power', 1).reach, 10);
  assert.equal(structureDef('power', 2).reach, 14);
});

test('storage bays hold 4 hours per rig; Mk II and Storage Tower II double them (design §4.2)', () => {
  const [iron, alu, li] = oresOf('ground');
  assert.deepEqual([iron, alu, li].map((o) => bayUnits(o)), [720, 360, 192]);
  assert.deepEqual([iron, alu, li].map((o) => bayUnits(o, { rigTier: 2 })), [1440, 720, 384]);
  assert.equal(bayUnits(iron, { storageTier: 2 }), 1440);
  assert.equal(bayUnits(iron) / (iron.rate * iron.deepRate * 60), 16, 'a deep iron bay fills in 16 hours');
});

test('a shuttle load is 5 minutes of a rig (design §4.2: 15 / 7.5 / 4 units)', () => {
  assert.deepEqual(oresOf('ground').map((o) => loadUnits(o.rate)), [15, 7.5, 4]);
});

test('costs follow design §6.1; defenses cost their battle price × 4 at every tier (§5.2)', () => {
  assert.equal(structureDef('rig', 1).cost, 3000);
  assert.equal(structureDef('rig', 2).cost, 8000);
  assert.equal(structureDef('power', 1).cost, 4000);
  assert.equal(structureDef('storage', 2).cost, 5000);
  for (const kind of DEFENSE_KINDS) {
    for (let t = 1; t <= maxTier(kind); t++) {
      const d = structureDef(kind, t);
      assert.equal(d.cost, STRUCTURES[d.battleStruct].cost[t - 1] * OUTPOST.Defense_Price_Mult, `${kind} ${t}`);
    }
  }
});

test('outpost defenses: no anti-air and no long range (owner); battle stats come from STRUCTURES', () => {
  for (const s of allStructures().filter((x) => x.battleStruct)) {
    const b = STRUCTURES[s.battleStruct];
    assert.ok(b, s.battleStruct);
    assert.ok(b.range <= 5, `${s.battleStruct} range ${b.range}`);
    const t = b.canTargetDomains || [];
    assert.ok(!(t.length && t.every((d) => d === 'Flyer')), `${s.battleStruct} is an anti-air tower`);
  }
  assert.deepEqual(structureDef('mg', 1).battle.hp, 240);
  assert.deepEqual(structureDef('cannon', 2).battle.hp, 640);
  assert.equal(structureDef('mg', 1).battle.groundTargets, 'light');
});

test("Verdance's contract 1 is the design's (§2.3)", () => {
  const c = contractFor('ground', 1);
  assert.equal(c.title, 'Iron for the Oath');
  assert.equal(c.oreTier, 'common');
  assert.equal(c.deliver, 300);
  assert.equal(c.raidsHeld, 1);
  assert.deepEqual([c.gold, c.loyalty, c.xp], [2000, 20, 300]);
  assert.deepEqual(c.unlocks.ores, ['uncommon']);
  assert.ok(c.unlocks.techs.includes('deep_drilling_1'));
});

test('every planet has a three-step ladder that never asks for an ore before it is unlocked (§2.4)', () => {
  for (const p of PLANETS) {
    const unlocked = new Set(['common']);
    for (const step of [1, 2, 3]) {
      const c = contractFor(p, step);
      assert.ok(c, `${p} step ${step}`);
      assert.ok(unlocked.has(c.oreTier), `${p} step ${step} delivers ${c.oreTier}`);
      for (const o of c.unlocks.ores) unlocked.add(o);
    }
    assert.deepEqual([...unlocked].sort(), [...ORE_TIERS].sort(), `${p} unlocks all three ores`);
    assert.ok(contractFor(p, 3).unlocks.farBuyer, `${p} contract 3 opens the far buyer`);
  }
  assert.equal(contractFor('ground', 4), null);
});
