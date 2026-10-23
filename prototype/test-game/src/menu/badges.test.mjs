// Red-dot badges [MM-story_mvkhei9q_k] and the Tech Net's game-save adapter [MM-story_mvkhed1f_h].
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBadges, seenFor, SETTINGS_NEWS } from './badges.js';
import { techCtxFromSave, createGameTechAdapter, map3Won } from './techSave.js';
import { readyIds } from '../data/techtree.js';

test('each dot fires on something new and clears once its screen is opened', () => {
  const s = { unlockedThrough: 3, seen: {} };
  const ctx = { readyTech: ['cannon2', 'pod1'], harvesterNext: { level: 2, cost: 600 }, bank: 900 };
  assert.deepEqual(computeBadges(s, ctx), { play: true, techtree: true, harvester: true, settings: true });
  for (const scr of ['survey', 'techtree', 'harvester', 'settings']) { const [k, v] = seenFor(scr, s, ctx); s.seen[k] = v; }
  assert.deepEqual(computeBadges(s, ctx), { play: false, techtree: false, harvester: false, settings: false });
  assert.equal(computeBadges(s, { ...ctx, readyTech: ['cannon2', 'pod1', 'mk2'] }).techtree, true, 'a newly available upgrade');
  assert.equal(computeBadges({ ...s, unlockedThrough: 4 }, ctx).play, true, 'a new map');
  assert.equal(computeBadges(s, { ...ctx, harvesterNext: { level: 3, cost: 1500 }, bank: 900 }).harvester, false, 'not affordable');
  assert.equal(seenFor('main', s, ctx), null);
  assert.ok(SETTINGS_NEWS.includes('fxlab'));
});

test('the game adapter reads the save and moves the gold through the save functions', () => {
  let save = { carry: { gold: 1000 }, maps: {}, tech: { owned: {}, paid: {} }, factionRecords: {} };
  const calls = [];
  const fake = {
    loadSave: () => save,
    buyTech: (id, price) => { calls.push(['buy', id, price]); save = { ...save, carry: { gold: save.carry.gold - price }, tech: { owned: { ...save.tech.owned, [id]: true }, paid: { ...save.tech.paid, [id]: price } } }; return true; },
    refundTech: (id) => { calls.push(['refund', id]); return true; },
  };
  let changed = 0;
  const a = createGameTechAdapter({ save: fake, factionOfPlanet: (p) => p, onChange: () => { changed++; } });
  assert.equal(a.buy('pod2'), false, 'locked');
  assert.equal(a.buy('pod1'), true);
  assert.deepEqual(calls, [['buy', 'pod1', 800]]);
  assert.ok(a.ctx().owned.has('gunpod'), 'free with Pod 1');
  assert.equal(a.refund('cannon1'), 'Not refundable.');
  assert.equal(a.refund('pod1'), '');
  assert.equal(changed, 2);
});

test('Map 3 and planet wins come from the campaign record', () => {
  const s = { carry: { gold: 0 }, maps: { 3: { beaten: true } }, tech: { owned: {} }, factionRecords: { Powder: { mapsWon: { 1: true } } } };
  assert.ok(map3Won(s));
  const c = techCtxFromSave(s, (p) => (p === 'Verdance' ? 'Powder' : p));
  assert.ok(c.owned.has('map3'));
  assert.equal(c.hasWin('Verdance'), true); assert.equal(c.hasWin('Florael'), false);
  assert.ok(readyIds({ ...c, bank: 99999 }).includes('ironhoard'));
});
