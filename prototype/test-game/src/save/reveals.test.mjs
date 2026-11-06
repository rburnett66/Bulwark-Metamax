// Surveyed planets and due reveals [MM-story_mw56v5hu_2]. Tech plan: Content-Reveal §4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_ORDER, ensureReveals, revealsDue, markSurveyed, markShipSeen, isSurveyed, newlyDue, revealLine } from './reveals.js';

const blank = () => ({ planetMaps: {}, capitalShips: {}, collective: { introSeen: true, launched: true } });

test('campaign order is Verdance → Vexmire', () => {
  assert.deepEqual(PLANET_ORDER, ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies']);
});

test('leaving the Long Ledger owes the Verdance survey; before that nothing is due', () => {
  const s = ensureReveals(blank());
  assert.deepEqual(revealsDue(s), [{ kind: 'planet', planet: 'ground' }]);
  assert.deepEqual(revealsDue({ collective: { introSeen: true } }), [], 'not launched yet');
  markSurveyed(s, 'ground');
  assert.equal(isSurveyed(s, 'air'), false);
  assert.deepEqual(revealsDue(s), []);
});

test('a save that has fought on Verdance owes no survey of it', () => {
  const s = blank(); s.planetMaps.ground = { 1: { beaten: true } };
  assert.deepEqual(revealsDue(ensureReveals(s)), []);
});

test('Verdance map 3 beaten at 3★: Florael is due, then the Ground ship; marking clears them', () => {
  const s = markSurveyed(ensureReveals(blank()), 'ground');
  s.planetMaps.Verdance = { 1: { beaten: true }, 2: { beaten: true }, 3: { beaten: true, bestAvg: 3.3 } };   // the save keys by name
  s.capitalShips.Verdance = { arrived: true };
  ensureReveals(s);
  assert.deepEqual(revealsDue(s), [{ kind: 'planet', planet: 'air' }, { kind: 'ship', planet: 'ground' }]);
  markSurveyed(s, 'air');
  assert.deepEqual(revealsDue(s), [{ kind: 'ship', planet: 'ground' }]);
  markShipSeen(s, 'ground');
  assert.deepEqual(revealsDue(s), []);
});

test('an old save keeps every planet it has played as surveyed (no reveal for a known planet)', () => {
  const s = blank();
  s.planetMaps.ground = { 3: { beaten: true } };
  s.planetMaps.Florael = { 1: { beaten: false, runs: 1 } };
  ensureReveals(s);
  assert.equal(isSurveyed(s, 'air'), true);
  assert.deepEqual(revealsDue(s).filter((r) => r.kind === 'planet'), []);
});

test('newlyDue and the results line', () => {
  const before = markSurveyed(ensureReveals(blank()), 'ground'), after = JSON.parse(JSON.stringify(before));
  after.planetMaps.ground = { 3: { beaten: true } };
  assert.deepEqual(newlyDue(before, after), [{ kind: 'planet', planet: 'air' }]);
  assert.match(revealLine({ kind: 'planet', planet: 'air' }), /Florael discovered/);
  assert.match(revealLine({ kind: 'ship', planet: 'ground' }, 'The Ironhoard'), /The Ironhoard is inbound to Verdance/);
});
