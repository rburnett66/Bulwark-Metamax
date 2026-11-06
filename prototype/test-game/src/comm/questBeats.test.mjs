// [MM-story_mvk8gz1k_r] [MM-story_mvzkd2t8_1k] — no contract interrupts a battle any more: the secondary is offered aboard
// the capital ship. The giver's closing verdict after the last wave is won is the one beat left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../data/factions.js';
import { questClosingDue } from './questBeats.js';
import { tipsCall } from './dialog.js';

const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const packs = JSON.parse(readFileSync(new URL('../../content/dialog/voicepacks.json', import.meta.url), 'utf8'));
const REG = globalThis.BulwarkFactions;

test('the closing plays only for an accepted contract on a win', () => {
  const c = { giver: 'Air' };
  assert.equal(questClosingDue(c, 'win'), true);
  assert.equal(questClosingDue(c, 'lose'), false);
  assert.equal(questClosingDue(null, 'win'), false);
});

test('main.js: no contract at map start or between waves, no per-wave field tip, the closing by questClosingDue', () => {
  assert.ok(!/playOptionalTip/.test(MAIN), 'the per-wave FIELD TIP is gone');
  assert.ok(!/offerContract\(|questOfferDue|runContract/.test(MAIN), 'no quest contract during a battle');
  // the one exception (owner 2026-11-06): the optional RARE contract after wave 3 at 3★ [MM-story_mw5eozsn_c]
  const uses = MAIN.match(/showContractModal\(/g) || [];
  assert.equal(uses.length, 1, 'one contract card in battle');
  assert.ok(MAIN.indexOf('showContractModal(') > MAIN.indexOf('async function offerRareContract'), 'and it is the rare offer');
  assert.ok(/questClosingDue\(resolvedFavour, sim\.result\)/.test(MAIN));
});

test('every faction can close a contract, with a different line for fulfilled and broken', () => {
  for (const f of REG.FACTIONS) {
    const a = tipsCall(packs, f.name, 9, 'closing', 'FULFILLED'), b = tipsCall(packs, f.name, 9, 'closing', 'BROKEN');
    assert.ok(a && b, f.name);
    assert.equal(a.label, 'CONTRACT CLOSED');
    assert.notEqual(a.line, b.line);
  }
});
