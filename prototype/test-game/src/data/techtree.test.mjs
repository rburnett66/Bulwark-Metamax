// The Tech Tree's data and rules [MM-story_mvkhed1f_h] — Tech-Tree-Design v1.1 (57 upgrades, four divisions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TECH_NODES, TECH_BY_ID, BUYABLE, TECH_TOTAL, DIVISIONS, startingOwned, techStatus, techPrice, techGates, readyIds,
  settleFree, refundBlock, portalsOwned, countOwned } from './techtree.js';

const ctx = (owned, bank = 0, extra = {}) => ({ owned: settleFree(new Set([...startingOwned(), ...owned])), bank, paid: {}, ...extra });

test('57 upgrades: Units 25, Bases 21 (+ capstone), Map 10, Outpost none', () => {
  assert.equal(BUYABLE.length, TECH_TOTAL);
  const by = (d) => BUYABLE.filter((id) => TECH_BY_ID[id].div === d && TECH_BY_ID[id].kind !== 'ult').length;
  assert.equal(by('units'), DIVISIONS.units.total);
  assert.equal(by('bases'), DIVISIONS.bases.total);
  assert.equal(by('map'), DIVISIONS.map.total);
  assert.equal(by('outpost'), 0);
  assert.ok(BUYABLE.includes('apocalypse'));
});

test('every requirement names a real node and the graph has no cycles', () => {
  for (const n of TECH_NODES) for (const r of n.req) assert.ok(TECH_BY_ID[r], n.id + ' needs unknown ' + r);
  const seen = new Set(), stack = new Set();
  const visit = (id) => { if (stack.has(id)) throw new Error('cycle at ' + id); if (seen.has(id)) return; stack.add(id); TECH_BY_ID[id].req.forEach(visit); stack.delete(id); seen.add(id); };
  TECH_NODES.forEach((n) => visit(n.id));
});

test('base models: +50 / −10 budget, all 7 stats, starter all zeros', () => {
  const crafts = TECH_NODES.filter((n) => n.kind === 'craft');
  assert.equal(crafts.length, 9);
  for (const c of crafts) {
    assert.equal(c.stats.length, 7);
    assert.equal(c.stats.filter((v) => v > 0).reduce((a, b) => a + b, 0), 50, c.id);
    assert.equal(c.stats.filter((v) => v < 0).reduce((a, b) => a + b, 0), -10, c.id);
  }
  assert.deepEqual(TECH_BY_ID.pathfinder.stats, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(TECH_BY_ID.ironhoard.req, [], 'Verdance is home — no portal');
});

test('statuses: starter kit owned, roots ready, chains locked, gold short', () => {
  const c = ctx([], 1000);
  assert.equal(techStatus(TECH_BY_ID.cannon1, c), 'owned');
  assert.equal(techStatus(TECH_BY_ID.cannon2, c), 'ready');
  assert.equal(techStatus(TECH_BY_ID.cannon3, c), 'locked');
  assert.equal(techStatus(TECH_BY_ID.mk3, c), 'locked');
  assert.equal(techStatus(TECH_BY_ID.pod2, ctx(['pod1'], 1000)), 'short');
  assert.equal(techStatus(TECH_BY_ID.op0, c), 'soon');
  assert.ok(readyIds(c).includes('cannon2') && !readyIds(c).includes('pod2'));
});

test('portal codes cost more the more you hold, and gate T3 / pods', () => {
  const c0 = ctx(['map3'], 99999);
  assert.equal(techPrice(TECH_BY_ID.portal_rime, c0), 1000);
  const c2 = ctx(['map3', 'portal_ochre', 'portal_kessra'], 99999);
  assert.equal(portalsOwned(c2.owned), 2);
  assert.equal(techPrice(TECH_BY_ID.portal_rime, c2), 2000);
  assert.equal(techStatus(TECH_BY_ID.portal_rime, ctx([], 99999)), 'locked', 'needs Map 3');
  assert.equal(techStatus(TECH_BY_ID.cannon3, ctx(['cannon2'], 99999)), 'locked', 'T3 needs a portal');
  assert.equal(techStatus(TECH_BY_ID.cannon3, ctx(['cannon2', 'map3', 'portal_ochre'], 99999)), 'ready');
  assert.equal(techGates(TECH_BY_ID.pod4, c2)[0].ok, false);
});

test('a planet win gates its base model when the game says so', () => {
  const c = ctx(['map3', 'portal_florael'], 99999, { hasWin: (p) => p === 'Verdance' });
  assert.equal(techStatus(TECH_BY_ID.ironhoard, c), 'ready');
  assert.equal(techStatus(TECH_BY_ID.skylark, c), 'locked');
});

test('the Gun Pod comes and goes with Pod 1; refunds respect dependents', () => {
  const owned = settleFree(new Set([...startingOwned(), 'pod1']));
  assert.ok(owned.has('gunpod'));
  owned.add('pod2');
  assert.match(refundBlock(TECH_BY_ID.pod1, { owned }), /Pod 2/);
  assert.equal(refundBlock(TECH_BY_ID.pod2, { owned }), '');
  owned.delete('pod2'); owned.delete('pod1'); settleFree(owned);
  assert.ok(!owned.has('gunpod'));
  assert.match(refundBlock(TECH_BY_ID.cannon1, { owned }), /Not refundable/);
  const p = new Set([...startingOwned(), 'map3', 'portal_ochre', 'cannon2', 'cannon3']);
  assert.match(refundBlock(TECH_BY_ID.portal_ochre, { owned: p }), /portal codes/);
  assert.equal(countOwned(p), 3);
});
