// Commander XP and ranks [MM-story_mvkhef1t_i] — Menu-Progression-Design §2.1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, xpForBattle, rankTitle, xpToNext } from './progression.js';

test('level curve: 300 to reach level 2, +150 more each level', () => {
  assert.equal(xpToNext(1), 300); assert.equal(xpToNext(2), 450); assert.equal(xpToNext(5), 900);
  assert.deepEqual([levelFromXp(0).level, levelFromXp(299).level, levelFromXp(300).level, levelFromXp(749).level, levelFromXp(750).level], [1, 1, 2, 2, 3]);
  const L = levelFromXp(400);
  assert.equal(L.into, 100); assert.equal(L.need, 450); assert.ok(Math.abs(L.frac - 100 / 450) < 1e-9);
});

test('ranks: Recruit first, General from 12, Marshal from 15', () => {
  assert.equal(rankTitle(1), 'Recruit'); assert.equal(rankTitle(3), 'Corporal'); assert.equal(rankTitle(11), 'Brigadier');
  assert.equal(rankTitle(12), 'General'); assert.equal(rankTitle(14), 'General'); assert.equal(rankTitle(15), 'Marshal');
});

test('battle XP: wins pay by map and stars, losses a little, the classic board nothing', () => {
  assert.equal(xpForBattle({ mapId: 2, result: 'win', avgStars: 4, kills: 40 }), 100 + 50 + 80 + 10);
  assert.equal(xpForBattle({ mapId: 2, result: 'lose', kills: 40 }), 25 + 20 + 5);
  assert.equal(xpForBattle({ mapId: 0, result: 'win', avgStars: 5, kills: 99 }), 0);
});
