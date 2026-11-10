// [MM-story_mwabgh3x_b] Seed pods: the stock, the pod bench, Rare pods from battles, the F1 Pod Crate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from '../save/save.js';
import { settleBattle, flowCtx } from '../save/missionFlow.js';
import { battleResult } from '../save/missions.js';
import { createBattleTally, finishTally } from '../save/battleTally.js';
import { FARM, POD_LEVELS, farmContractOf } from '../data/farm.js';
import { BATTLE_POD_LEVEL, podCount, podsOfCrop, addPods, spendPods, benchUpgrade, unitsPerPod, battlePods, grantPodCrate } from './pods.js';

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
  const kept = migrate({ ...defaultSave(), pods: { 'loam-grain': { 1: 4 } }, podCarry: { 'loam-grain': 50 } });
  assert.equal(podCount(kept, 'loam-grain', 1), 4, 'a save that has pods keeps them');
  assert.equal(kept.podCarry['loam-grain'], 50);
});

test('add, count and spend pods; a short spend refuses and changes nothing', () => {
  const s = defaultSave();
  assert.equal(podCount(s, 'loam-grain', 1), 0);
  assert.equal(addPods(s, 'loam-grain', 1, 5), 5);
  assert.equal(addPods(s, 'loam-grain', 2, 1), 1);
  assert.equal(podCount(s, 'loam-grain', 1), 5);
  assert.equal(podsOfCrop(s, 'loam-grain'), 6);
  const snap = JSON.stringify(s);
  assert.equal(spendPods(s, 'loam-grain', 1, 6), false);
  assert.equal(spendPods(s, 'skyhoney', 3, 1), false);
  assert.equal(JSON.stringify(s), snap, 'a refusal changes nothing');
  assert.equal(spendPods(s, 'loam-grain', 1, 5), true);
  assert.equal(podCount(s, 'loam-grain', 1), 0);
  assert.deepEqual(s.pods, { 'loam-grain': { 2: 1 } }, 'an emptied level is dropped');
  assert.throws(() => addPods(s, 'no-such-crop', 1, 1), /unknown crop/);
  assert.throws(() => addPods(s, 'loam-grain', 6, 1), /pod level/);
  assert.throws(() => addPods(s, 'loam-grain', 1, -1), /count/);
  assert.deepEqual(s.inventory, {}, 'pods never touch the battle inventory (owner rule 5)');
});

test('the pod bench: 3 pods of a crop and level make 1 of the next, for that level\'s gold', () => {
  assert.equal(FARM.Bench_In, 3);
  const s = withGold(1000);
  addPods(s, 'loam-grain', 1, 7);
  const r = benchUpgrade(s, 'loam-grain', 1);
  assert.deepEqual(r, { ok: true, crop: 'loam-grain', from: 1, to: 2, gold: 50 });
  assert.equal(podCount(s, 'loam-grain', 1), 4);
  assert.equal(podCount(s, 'loam-grain', 2), 1);
  assert.equal(s.carry.gold, 950);
  assert.equal(s.goldBank, 950, 'the bank mirror follows, as in save.js');
  // every level's price is the Pod_Levels sheet's
  for (const L of POD_LEVELS.slice(0, 4)) {
    const t = withGold(5000);
    addPods(t, 'elder-bloom', L.level, 3);
    assert.equal(benchUpgrade(t, 'elder-bloom', L.level).gold, L.benchGold);
    assert.equal(t.carry.gold, 5000 - L.benchGold);
    assert.equal(podCount(t, 'elder-bloom', L.level + 1), 1);
  }
  assert.deepEqual(s.inventory, {});
});

test('the pod bench refuses at Legendary, short of pods and short of gold, and changes nothing', () => {
  const top = withGold(99999); addPods(top, 'loam-grain', 5, 9);
  let snap = JSON.stringify(top);
  assert.deepEqual(benchUpgrade(top, 'loam-grain', 5), { ok: false, reason: 'top', need: 0, have: 0 });
  assert.equal(JSON.stringify(top), snap);

  const few = withGold(1000); addPods(few, 'loam-grain', 2, 2);
  snap = JSON.stringify(few);
  assert.deepEqual(benchUpgrade(few, 'loam-grain', 2), { ok: false, reason: 'pods', need: 3, have: 2 });
  assert.equal(JSON.stringify(few), snap);

  const poor = withGold(399); addPods(poor, 'loam-grain', 3, 3);
  snap = JSON.stringify(poor);
  assert.deepEqual(benchUpgrade(poor, 'loam-grain', 3), { ok: false, reason: 'gold', need: 400, have: 399 });
  assert.equal(JSON.stringify(poor), snap);

  const broke = defaultSave(); addPods(broke, 'loam-grain', 1, 3);   // no campaign carry at all: no gold
  assert.equal(benchUpgrade(broke, 'loam-grain', 1).reason, 'gold');
  assert.equal(podCount(broke, 'loam-grain', 1), 3);
});

test('battles bank Rare pods: one per 200 units, epic fields one per 100', () => {
  assert.equal(BATTLE_POD_LEVEL, 3, 'battle quality is Rare (owner)');
  assert.equal(unitsPerPod('common'), FARM.Battle_Pod_Units);
  assert.equal(unitsPerPod('epic'), FARM.Battle_Pod_Units_Epic);
  const s = defaultSave();
  const out = battlePods(s, 'Verdance', tiers({ common: 450, uncommon: 199, rare: 200, epic: 250 }));
  assert.deepEqual(out, { 'loam-grain': 2, 'rootsong-seeds': 1, 'elder-bloom': 2 });
  assert.equal(podCount(s, 'loam-grain', 3), 2);
  assert.equal(podCount(s, 'elder-bloom', 3), 2);
  assert.equal(podCount(s, 'heartwood-amber', 3), 0);
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
  assert.equal(podCount(s, 'loam-grain', 3), 2);
});

test('Lumen\'s uncommon battle resource is Helium-3, not a crop: it yields no pods and no carry', () => {
  const s = defaultSave();
  const out = battlePods(s, 'Lumen', tiers({ common: 200, uncommon: 5000, rare: 0, epic: 100 }));
  assert.deepEqual(out, { regolith: 1, 'void-lens': 1 });
  assert.equal(podCount(s, 'helium-4', 3), 0, 'Helium-4 is farm-only');
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

test('settleBattle banks Rare pods beside the harvest; a battle without a tally banks none', () => {
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
  assert.equal(podCount(s, 'loam-grain', 3), 1);
  // pods count every unit carried home, not only the surplus over the Collective's quota (Farming-Design §9.1)
  const quota = finishTally(createBattleTally());
  quota.harvested = tiers({ common: 400 }); quota.kept = tiers({ common: 0 });
  assert.deepEqual(settleBattle(defaultSave(), { ...r, tally: quota }, CATALOG, ctx).pods, { 'loam-grain': 2 });
  assert.equal(s.podCarry['loam-grain'], 50);
});

test('the F1 Pod Crate: 12 Common pods of Loam Grain', () => {
  const f1 = farmContractOf('ground', 'F1');
  const s = defaultSave();
  assert.deepEqual(grantPodCrate(s, f1), { crop: 'loam-grain', level: 1, n: FARM.Pod_Crate });
  assert.equal(podCount(s, 'loam-grain', 1), 12);
  grantPodCrate(s, { crop: 'loam-grain', podCrate: 2, podCrateLevel: 2 });
  assert.equal(podCount(s, 'loam-grain', 2), 2);
  assert.deepEqual(grantPodCrate(s, { crop: 'loam-grain', podCrate: 0 }), { crop: 'loam-grain', level: 1, n: 0 });
  assert.deepEqual(s.inventory, {});
});
