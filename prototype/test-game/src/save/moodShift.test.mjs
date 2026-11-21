// [MM-story_mwpni0v4_3m] Relationship portraits: antagonistic / neutral / friendly by rating, and a mood shift that
// softens or hardens the portrait for the character's next calls without moving the rating. Owner 2026-11-20: "Even an
// angry character could appear neutral if given the right info or gift."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moodFor, standingOf, shiftMood, moodShiftOf, spendMoodCall, noteRapport, MOOD_SHIFTS, MOOD_ORDER } from './standings.js';
import { withMood } from '../comm/mapCast.js';

const wary = () => ({ rapport: { X: { score: -30, kept: 0, broken: 1 } } });

test('the three relationship portraits, cold to warm, and a shift moves one step, clamped', () => {
  assert.deepEqual([...MOOD_ORDER], ['antagonistic', 'neutral', 'friendly']);
  assert.equal(moodFor('wary', 1), 'neutral');
  assert.equal(moodFor('neutral', 1), 'friendly');
  assert.equal(moodFor('trusted', 1), 'friendly');
  assert.equal(moodFor('friendly', -1), 'neutral');
  assert.equal(moodFor('hostile', -1), 'antagonistic');
});

test('an angry character looks neutral after the right gift, for its calls, and the rating does not move', () => {
  const s = wary();
  assert.equal(standingOf(s, 'X').mood, 'antagonistic');
  shiftMood(s, 'X', 'gift');
  assert.equal(standingOf(s, 'X').mood, 'neutral');
  assert.equal(s.rapport.X.score, -30);
  for (let i = 0; i < MOOD_SHIFTS.gift.calls; i++) { assert.equal(moodShiftOf(s, 'X'), 1); spendMoodCall(s, 'X'); }
  assert.equal(moodShiftOf(s, 'X'), 0);
  assert.equal(standingOf(s, 'X').mood, 'antagonistic', 'the shift wears off');
  assert.equal(shiftMood(s, 'X', 'nonsense'), null);
});

test('a kept promise softens the giver; a broken one hardens', () => {
  const s = { rapport: {} };
  noteRapport(s, { giver: { name: 'Y', faction: 'ground' }, impact: {} }, 'done');
  assert.equal(moodShiftOf(s, 'Y'), 1);
  noteRapport(s, { giver: { name: 'Y', faction: 'ground' }, impact: {} }, 'failed', 'expired');
  assert.equal(moodShiftOf(s, 'Y'), -1);
});

test('map dialogs carry the speaker\'s portrait; main.js spends a shift only in play', () => {
  const s = wary(); shiftMood(s, 'X', 'info');
  assert.equal(withMood({ name: 'X', line: 'Hm.' }, s).mood, 'neutral');
  assert.equal(withMood(null, s), null);
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(main, /withMood\(open\.spec, loadSave\(\)\)/);
  assert.match(main, /withMood\(secondaryCall\(matchCast\(\), voicePacks\), loadSave\(\)\)/);
  assert.match(main, /withMood\(closing, loadSave\(\)\)/);
  assert.match(main, /if \(closing && mode === 'play'\) moodShown\(closing\.name\)/);
});
