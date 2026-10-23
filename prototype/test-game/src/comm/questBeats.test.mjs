// [MM-story_mvk8gz1k_r] — the secondary-resource quest speaks twice per map: its offer in the interlude before wave 2,
// and the giver's closing verdict after the last wave is won. Nothing at map start, nothing in the other interludes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../data/factions.js';
import { QUEST_BEATS, questOfferDue, questClosingDue } from './questBeats.js';
import { tipsCall } from './dialog.js';

const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const packs = JSON.parse(readFileSync(new URL('../../content/dialog/voicepacks.json', import.meta.url), 'utf8'));
const REG = globalThis.BulwarkFactions;

test('the offer is due only in the interlude before wave 2', () => {
  assert.equal(QUEST_BEATS.offerBeforeWave, 2);
  const due = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => questOfferDue(i));
  assert.deepEqual(due, [1], 'next wave index 1 = wave 2');
  assert.equal(questOfferDue(undefined), false);
});

test('the closing plays only for an accepted contract on a win', () => {
  const c = { giver: 'Air' };
  assert.equal(questClosingDue(c, 'win'), true);
  assert.equal(questClosingDue(c, 'lose'), false);
  assert.equal(questClosingDue(null, 'win'), false);
});

test('main.js: no contract at map start, no per-wave field tip, the offer gated by questOfferDue, the closing by questClosingDue', () => {
  assert.ok(!/playOptionalTip/.test(MAIN), 'the per-wave FIELD TIP is gone');
  const intro = MAIN.slice(MAIN.indexOf('const runIntro'), MAIN.indexOf('const runIntro') + 200);
  assert.ok(!/showContractModal/.test(intro), 'the map-start intro opens no contract');
  assert.equal((MAIN.match(/showContractModal\(/g) || []).length, 1, 'one place opens the contract');
  assert.ok(/if \(questOfferDue\(idx\)\) await offerContract\(\)/.test(MAIN));
  assert.ok(/questClosingDue\(runContract, sim\.result\)/.test(MAIN));
});

test('every faction can close a contract, with a different line for fulfilled and broken', () => {
  for (const f of REG.FACTIONS) {
    const a = tipsCall(packs, f.name, 9, 'closing', 'FULFILLED'), b = tipsCall(packs, f.name, 9, 'closing', 'BROKEN');
    assert.ok(a && b, f.name);
    assert.equal(a.label, 'CONTRACT CLOSED');
    assert.notEqual(a.line, b.line);
  }
});
