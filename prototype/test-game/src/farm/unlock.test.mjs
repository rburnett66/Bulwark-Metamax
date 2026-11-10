// [MM-story_mwatmukb_1j] owner rule 10: a crop's seed pods unlock at 500 delivered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockUnits, cropDelivered, podsUnlocked, recordDelivered, unlockPods, unlockProgress } from './unlock.js';
import { buyPods, battlePods, grantPodCrate, podCount } from './pods.js';
import { defaultSave, migrate } from '../save/save.js';

const rich = () => { const s = defaultSave(); s.carry = { gold: 10000, structures: [] }; s.goldBank = 10000; return s; };

test('the unlock is 500 units, from the workbook', () => {
  assert.equal(unlockUnits(), 500);
});

test('deliveries add up across maps and unlock at 500, once', () => {
  const s = defaultSave();
  assert.equal(podsUnlocked(s, 'heartwood-amber'), false);
  assert.deepEqual(recordDelivered(s, { 'heartwood-amber': 300 }), []);
  assert.equal(cropDelivered(s, 'heartwood-amber'), 300);
  assert.deepEqual(recordDelivered(s, { 'heartwood-amber': 250, 'loam-grain': 10 }), ['heartwood-amber']);
  assert.equal(podsUnlocked(s, 'heartwood-amber'), true);
  assert.equal(podsUnlocked(s, 'loam-grain'), false);
  assert.deepEqual(recordDelivered(s, { 'heartwood-amber': 600 }), [], 'unlocks only once');
  assert.deepEqual(unlockProgress(s, 'loam-grain'), { delivered: 10, need: 500, open: false });
});

test('non-crops and junk are not counted', () => {
  const s = defaultSave();
  assert.deepEqual(recordDelivered(s, { 'not-a-crop': 900, 'loam-grain': -5, 'heartwood-amber': NaN }), []);
  assert.deepEqual(s.cropDelivered, {});
});

test('a locked crop cannot be bought; unlocked it can', () => {
  const s = rich();
  assert.deepEqual(buyPods(s, 'heartwood-amber', 4), { ok: false, reason: 'locked' });
  assert.equal(s.carry.gold, 10000, 'a refusal spends nothing');
  recordDelivered(s, { 'heartwood-amber': 500 });
  assert.equal(buyPods(s, 'heartwood-amber', 4).ok, true);
  assert.equal(podCount(s, 'heartwood-amber'), 4);
});

test('battles drop no pods of a locked crop', () => {
  const s = defaultSave();
  assert.deepEqual(battlePods(s, 'Verdance', { uncommon: 400 }), {});
  unlockPods(s, 'heartwood-amber');
  assert.deepEqual(battlePods(s, 'Verdance', { uncommon: 400 }), { 'heartwood-amber': 2 });
});

test('the F1 Pod Crate unlocks its crop so its pods can be planted', () => {
  const s = defaultSave();
  grantPodCrate(s, { crop: 'loam-grain', podCrate: 12 });
  assert.equal(podsUnlocked(s, 'loam-grain'), true);
  assert.equal(podCount(s, 'loam-grain'), 12);
});

test('an older save keeps every crop it already holds pods of or has planted', () => {
  const s = defaultSave();
  delete s.cropDelivered; delete s.podUnlocks;
  s.pods = { 'loam-grain': 3 };
  s.outposts = { ground: { farm: { plots: { p1: { crop: 'heartwood-amber' }, p2: { crop: null } } } } };
  migrate(s);
  assert.deepEqual(s.podUnlocks, { 'loam-grain': true, 'heartwood-amber': true });
  assert.deepEqual(s.cropDelivered, {});
});

test('a new save starts with nothing unlocked', () => {
  const s = migrate(defaultSave());
  assert.deepEqual(s.podUnlocks, {});
});

test('a battle delivers every unit carried home, quota and surplus alike; Helium-3 is not Helium-4', async () => {
  const { battleDelivery } = await import('./unlock.js');
  assert.deepEqual(battleDelivery('Verdance', { common: 120, uncommon: 0, rare: 7, epic: 0 }), { 'loam-grain': 120, 'rootsong-seeds': 7 });
  assert.deepEqual(battleDelivery('Lumen', { uncommon: 300 }), {}, "Lumen's uncommon battle resource is Helium-3, not the Helium-4 crop");
  assert.deepEqual(battleDelivery(null, { common: 5 }), {});
});

test('settleBattle counts the whole harvest toward the unlock, not only the surplus', async () => {
  const { readFileSync } = await import('node:fs');
  const { settleBattle, flowCtx } = await import('../save/missionFlow.js');
  const { battleResult } = await import('../save/missions.js');
  const { createBattleTally, finishTally } = await import('../save/battleTally.js');
  const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
  const stars = Array.from({ length: 8 }, (_, i) => ({ wave: i + 1, stars: 3, flags: [true, true, true, false, false] }));
  const r = battleResult({ mapId: 1, planet: 'Verdance', faction: 'x', result: 'win', totalWaves: 8, waveStars: stars,
    finalScore: { kills: 400, goldSpent: 3000, totalSeconds: 300 }, mapScore: { goldFromPrimary: 2000, goldFromPremium: 2000, questRed: 30, questGreen: 30 } });
  const s = defaultSave(), ctx = flowCtx(s, { allOpen: true, now: 1 });
  const t1 = finishTally(createBattleTally());
  t1.harvested = { common: 300, uncommon: 0, rare: 0, epic: 0 }; t1.kept = { common: 0, uncommon: 0, rare: 0, epic: 0 };
  assert.deepEqual(settleBattle(s, { ...r, tally: t1 }, CATALOG, ctx).podsUnlocked, []);
  assert.equal(cropDelivered(s, 'loam-grain'), 300, 'the quota counts');
  assert.deepEqual(battlePods(s, 'Verdance', { common: 400 }), {}, 'still locked: no pods');
  const t2 = finishTally(createBattleTally());
  t2.harvested = { common: 200, uncommon: 0, rare: 0, epic: 0 }; t2.kept = { common: 50, uncommon: 0, rare: 0, epic: 0 };
  assert.deepEqual(settleBattle(s, { ...r, tally: t2 }, CATALOG, ctx).podsUnlocked, ['loam-grain'], '300 + 200 = 500 unlocks');
  assert.equal(podsUnlocked(s, 'loam-grain'), true);
  assert.deepEqual(settleBattle(s, { ...r, tally: undefined }, CATALOG, ctx).podsUnlocked, []);
});
