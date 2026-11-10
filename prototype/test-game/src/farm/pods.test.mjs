// [MM-story_mwabgh3x_b] [MM-story_mwai5f8t_1g] Seed pods: a plain count per crop (owner rule 9: pods have no level),
// bought at one fixed price, from battles, the F1 Pod Crate; an old save's per-level rows summed on load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from '../save/save.js';
import { settleBattle, flowCtx } from '../save/missionFlow.js';
import { battleResult } from '../save/missions.js';
import { createBattleTally, finishTally } from '../save/battleTally.js';
import { FARM, farmContractOf } from '../data/farm.js';
import * as PODS from './pods.js';
import { podCount, podsHeld, addPods, spendPods, buyPods, podPrice, unitsPerPod, battlePods, grantPodCrate } from './pods.js';

const withGold = (gold) => { const s = defaultSave(); s.carry = { gold, structures: [] }; s.goldBank = gold; return s; };
const tiers = (o) => ({ common: 0, uncommon: 0, rare: 0, epic: 0, ...o });

test('a new save holds no pods; an old save without them loads unchanged otherwise', () => {
  const s = defaultSave();
  assert.deepEqual(s.pods, {});
  assert.deepEqual(s.podCarry, {});
  const old = defaultSave(); delete old.pods; delete old.podCarry;
  old.inventory = { 'loam-grain': 7 };
  const m = migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(m.pods, {});
  assert.deepEqual(m.podCarry, {});
  delete m.pods; delete m.podCarry;
  assert.deepEqual(Object.keys(m).sort(), Object.keys(old).concat('factionRecords').sort(), 'no other field is added');
  assert.deepEqual(m.inventory, { 'loam-grain': 7 }, 'the rest of the save is untouched');
  const kept = migrate({ ...defaultSave(), pods: { 'loam-grain': 4 }, podCarry: { 'loam-grain': 50 } });
  assert.equal(podCount(kept, 'loam-grain'), 4, 'a save that has pods keeps them');
  assert.equal(kept.podCarry['loam-grain'], 50);
});

test('an old save\'s per-level pods ({ [level]: count }) load as a plain count per crop; planted plots keep their level', () => {
  const old = { ...defaultSave(), pods: { 'loam-grain': { 1: 4, 3: 2 }, 'elder-bloom': { 5: 1 }, 'rootsong-seeds': {}, 'heartwood-amber': 3 } };
  old.outposts = { ground: { farm: { plots: { p1: { id: 'p1', crop: 'loam-grain', level: 2, progress: 0.4 } }, buildings: {}, next: 2 } } };
  const m = migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(m.pods, { 'loam-grain': 6, 'elder-bloom': 1, 'heartwood-amber': 3 }, 'levels summed; an empty row dropped');
  assert.equal(m.outposts.ground.farm.plots.p1.level, 2, 'a plot already planted keeps the level it grows at');
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(m))).pods, m.pods, 'migrating twice changes nothing');
  assert.equal(podCount({ pods: { 'loam-grain': { 1: 2, 2: 2 } } }, 'loam-grain'), 4, 'a row read before the migration is still counted');
});

test('add, count and spend pods: one plain count per crop; a short spend refuses and changes nothing', () => {
  const s = defaultSave();
  assert.equal(podCount(s, 'loam-grain'), 0);
  assert.equal(addPods(s, 'loam-grain', 5), 5);
  assert.equal(addPods(s, 'loam-grain', 1), 6);
  assert.equal(addPods(s, 'skyhoney', 2), 2);
  assert.equal(podsHeld(s), 8);
  assert.deepEqual(s.pods, { 'loam-grain': 6, skyhoney: 2 });
  const snap = JSON.stringify(s);
  assert.equal(spendPods(s, 'loam-grain', 7), false);
  assert.equal(spendPods(s, 'elder-bloom', 1), false);
  assert.equal(JSON.stringify(s), snap, 'a refusal changes nothing');
  assert.equal(spendPods(s, 'loam-grain', 6), true);
  assert.equal(podCount(s, 'loam-grain'), 0);
  assert.deepEqual(s.pods, { skyhoney: 2 }, 'an emptied crop is dropped');
  assert.throws(() => addPods(s, 'no-such-crop', 1), /unknown crop/);
  assert.throws(() => addPods(s, 'loam-grain', -1), /count/);
  assert.deepEqual(s.inventory, {}, 'pods never touch the battle inventory (owner rule 5)');
});

test('the pod bench and the lucky roll are gone (owner rule 9)', () => {
  assert.equal(PODS.benchUpgrade, undefined);
  assert.equal(PODS.podsOfCrop, undefined);
});

test('BUY: pods at one fixed price, every crop alike — spends the bank, adds the pods', () => {
  assert.equal(podPrice(1), FARM.Pod_Price);
  assert.equal(podPrice(4), 4 * FARM.Pod_Price);
  for (const crop of ['loam-grain', 'elder-bloom', 'helium-4']) {
    const s = withGold(1000);
    const r = buyPods(s, crop, 4);
    assert.deepEqual(r, { ok: true, crop, n: 4, gold: 100 }, crop + ': the same price');
    assert.equal(podCount(s, crop), 4);
    assert.equal(s.carry.gold, 900);
    assert.equal(s.goldBank, 900, 'the mirrored bank follows');
  }
  const d = withGold(1000);
  assert.equal(buyPods(d, 'loam-grain').n, FARM.Pods_Per_Plot, 'the default buy is one plot\'s worth');
  const poor = withGold(99), snap = JSON.stringify(poor);
  assert.deepEqual(buyPods(poor, 'loam-grain', 4), { ok: false, reason: 'gold', need: 100, have: 99 });
  assert.equal(JSON.stringify(poor), snap, 'a refusal changes nothing');
  assert.throws(() => buyPods(withGold(1000), 'nope', 4), /unknown crop/);
});

test('battles bank plain pods: one per 200 units, epic fields one per 100', () => {
  assert.ok(!('BATTLE_POD_LEVEL' in PODS), 'battle pods have no level (owner rule 9)');
  assert.equal(unitsPerPod('common'), FARM.Battle_Pod_Units);
  assert.equal(unitsPerPod('epic'), FARM.Battle_Pod_Units_Epic);
  const s = defaultSave();
  const out = battlePods(s, 'Verdance', tiers({ common: 450, uncommon: 199, rare: 200, epic: 250 }));
  assert.deepEqual(out, { 'loam-grain': 2, 'rootsong-seeds': 1, 'elder-bloom': 2 });
  assert.equal(podCount(s, 'loam-grain'), 2);
  assert.equal(podCount(s, 'elder-bloom'), 2);
  assert.equal(podCount(s, 'heartwood-amber'), 0);
  assert.deepEqual(s.podCarry, { 'loam-grain': 50, 'heartwood-amber': 199, 'elder-bloom': 50 });
  assert.deepEqual(battlePods(s, 'ground', tiers({ common: 150 })), { 'loam-grain': 1 }, 'the planet key works too');
  assert.deepEqual(s.inventory, {}, 'pods never land in the battle inventory');
});

test('the remainder carries across battles, so nothing is lost', () => {
  const s = defaultSave();
  assert.deepEqual(battlePods(s, 'Verdance', tiers({ common: 120 })), {});
  assert.equal(s.podCarry['loam-grain'], 120);
  assert.deepEqual(battlePods(s, 'Verdance', tiers({ common: 130 })), { 'loam-grain': 1 });
  assert.equal(s.podCarry['loam-grain'], 50);
  assert.deepEqual(battlePods(s, 'Verdance', tiers({ common: 150 })), { 'loam-grain': 1 });
  assert.equal(s.podCarry['loam-grain'], undefined, 'an exact pod leaves no carry');
  assert.equal(podCount(s, 'loam-grain'), 2);
});

test('Lumen\'s uncommon battle resource is Helium-3, not a crop: it yields no pods and no carry', () => {
  const s = defaultSave();
  const out = battlePods(s, 'Lumen', tiers({ common: 200, uncommon: 5000, rare: 0, epic: 100 }));
  assert.deepEqual(out, { regolith: 1, 'void-lens': 1 });
  assert.equal(podCount(s, 'helium-4'), 0, 'Helium-4 is farm-only');
  assert.equal(s.podCarry['helium-4'], undefined);
  assert.equal(s.podCarry['helium-3'], undefined);
});

test('battlePods takes nothing it cannot use and is plain arithmetic', () => {
  const s = defaultSave();
  assert.deepEqual(battlePods(s, null, tiers({ common: 999 })), {});
  assert.deepEqual(battlePods(s, 'Verdance', null), {});
  assert.deepEqual(battlePods(s, 'Verdance', tiers({ common: -5, rare: NaN })), {});
  assert.deepEqual(s.pods, {});
  const a = defaultSave(), b = defaultSave(), t = tiers({ common: 777, epic: 333 });
  battlePods(a, 'Verdance', t); battlePods(b, 'Verdance', t);
  assert.deepEqual(a, b, 'same tally, same pods');
});

test('settleBattle banks pods beside the harvest; a battle without a tally banks none', () => {
  const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
  const stars = Array.from({ length: 8 }, (_, i) => ({ wave: i + 1, stars: 3, flags: [true, true, true, false, false] }));
  const r = battleResult({ mapId: 1, planet: 'Verdance', faction: 'x', result: 'win', totalWaves: 8, waveStars: stars,
    finalScore: { kills: 400, goldSpent: 3000, totalSeconds: 300 }, mapScore: { goldFromPrimary: 2000, goldFromPremium: 2000, questRed: 30, questGreen: 30 } });
  const s = defaultSave(), ctx = flowCtx(s, { allOpen: true, now: 1 });
  const bare = settleBattle(s, { ...r, tally: undefined }, CATALOG, ctx);
  assert.deepEqual(bare.pods, {});
  const tally = finishTally(createBattleTally());
  tally.harvested = tiers({ common: 250, epic: 100 }); tally.kept = tiers({ common: 250, epic: 100 });
  const out = settleBattle(s, { ...r, tally }, CATALOG, ctx);
  assert.deepEqual(out.pods, { 'loam-grain': 1, 'elder-bloom': 1 });
  assert.equal(s.inventory['loam-grain'], 250, 'the harvest still banks into the inventory as before');
  assert.equal(podCount(s, 'loam-grain'), 1);
  // pods count every unit carried home, not only the surplus over the Collective's quota (Farming-Design §9.1)
  const quota = finishTally(createBattleTally());
  quota.harvested = tiers({ common: 400 }); quota.kept = tiers({ common: 0 });
  assert.deepEqual(settleBattle(defaultSave(), { ...r, tally: quota }, CATALOG, ctx).pods, { 'loam-grain': 2 });
  assert.equal(s.podCarry['loam-grain'], 50);
});

test('the F1 Pod Crate: 12 Loam Grain pods, no level', () => {
  const f1 = farmContractOf('ground', 'F1');
  const s = defaultSave();
  assert.deepEqual(grantPodCrate(s, f1), { crop: 'loam-grain', n: FARM.Pod_Crate });
  assert.equal(podCount(s, 'loam-grain'), 12);
  grantPodCrate(s, { crop: 'loam-grain', podCrate: 2 });
  assert.equal(podCount(s, 'loam-grain'), 14);
  assert.deepEqual(grantPodCrate(s, { crop: 'loam-grain', podCrate: 0 }), { crop: 'loam-grain', n: 0 });
  assert.deepEqual(s.pods, { 'loam-grain': 14 });
  assert.deepEqual(s.inventory, {});
});
