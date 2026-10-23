// Battle rewards ledger + tech purchases on the save [MM-story_mvkhegop_j] [MM-story_mvkhed1f_h] — Menu-Progression-Design §2.2–3.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const S = await import('./save.js');
const { xpForBattle } = await import('../data/progression.js');

const fresh = () => { store.clear(); return S.resetSave(); };
const stars = (n) => Array.from({ length: 8 }, () => ({ stars: n }));

test('a campaign win banks the leftover gold, adds stars and XP, and leaves a pending ledger', () => {
  fresh();
  S.updateSave((s) => { s.carry = { gold: 700, structures: [] }; });
  const before = S.loadSave();
  S.recordResult(1, 'win', { score: 900, kills: 20, goldRemaining: 1840 }, stars(4), 8, 'Powder');
  const led = S.grantBattleRewards(before, { mapId: 1, result: 'win', finalScore: { kills: 20, goldRemaining: 1840 }, waveStars: stars(4), totalWaves: 8, xpFor: xpForBattle });
  const s = S.loadSave();
  assert.equal(s.carry.gold, 1840);
  assert.deepEqual(led.gold, { earned: 1840, from: 700, to: 1840 });
  assert.deepEqual(led.stars, { from: 0, to: 32 });
  assert.equal(led.xp.earned, 100 + 25 + 80 + 5);
  assert.equal(s.progress.xp, led.xp.to);
  assert.deepEqual(s.pendingRewards, led);
});

test('a loss keeps the bank, still earns XP; two battles merge before the menu sees them', () => {
  fresh();
  S.updateSave((s) => { s.carry = { gold: 500, structures: [] }; });
  const b1 = S.loadSave();
  S.recordResult(2, 'lose', { kills: 16 }, [], 8, 'Powder');
  S.grantBattleRewards(b1, { mapId: 2, result: 'lose', finalScore: { kills: 16, goldRemaining: 90 }, waveStars: [], totalWaves: 8, xpFor: xpForBattle });
  assert.equal(S.loadSave().carry.gold, 500);
  const b2 = S.loadSave();
  S.recordResult(2, 'win', { kills: 30, goldRemaining: 1200 }, stars(3), 8, 'Powder');
  S.grantBattleRewards(b2, { mapId: 2, result: 'win', finalScore: { kills: 30, goldRemaining: 1200 }, waveStars: stars(3), totalWaves: 8, xpFor: xpForBattle });
  const r = S.takePendingRewards();
  assert.equal(r.battles, 2);
  assert.deepEqual(r.gold, { earned: 1200, from: 500, to: 1200 });
  assert.equal(r.xp.from, 0);
  assert.equal(r.xp.earned, (25 + 20 + 2) + (100 + 50 + 60 + 7));
  assert.equal(S.takePendingRewards(), null, 'taken once');
});

test('the classic board earns nothing and leaves the save alone', () => {
  fresh();
  const before = S.loadSave();
  const led = S.grantBattleRewards(before, { mapId: 0, result: 'win', finalScore: { kills: 99, goldRemaining: 5000 }, waveStars: stars(5), totalWaves: 8, xpFor: xpForBattle });
  assert.equal(led.gold.earned, 0); assert.equal(led.xp.earned, 0);
  assert.equal(S.loadSave().pendingRewards, null);
});

test('tech purchases spend and refund banked gold', () => {
  fresh();
  S.updateSave((s) => { s.carry = { gold: 1000, structures: [] }; });
  assert.equal(S.buyTech('pod1', 800), true);
  assert.equal(S.buyTech('pod1', 800), false, 'already owned');
  assert.equal(S.buyTech('cannon2', 600), false, 'not enough gold');
  let s = S.loadSave();
  assert.equal(s.carry.gold, 200); assert.equal(s.tech.paid.pod1, 800);
  assert.equal(S.refundTech('pod1'), true);
  s = S.loadSave();
  assert.equal(s.carry.gold, 1000); assert.ok(!s.tech.owned.pod1);
});

test('old saves gain the new fields', () => {
  store.clear();
  store.set('bulwark:save', JSON.stringify({ v: 1, maps: {}, carry: { gold: 5 } }));
  const s = S.loadSave();
  assert.deepEqual(s.progress, { xp: 0 }); assert.deepEqual(s.tech, { owned: {}, paid: {} }); assert.deepEqual(s.seen, {});
  assert.equal(s.pendingRewards, null);
});
