// The opening conversation's state and script [MM-story_mw47llqj_6]. Collective-Opening-Design §6.2–6.4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createConversationState, validateScript, slideTrack } from './conversationState.js';
import { HOLO_SLIDES } from './holoSlide.js';
import { speakerOf } from '../comm/voice.js';

const S = JSON.parse(readFileSync(new URL('../../content/dialog/opening.json', import.meta.url), 'utf8'));

test('the opening script is valid: 12–16 lines, 4–6 slides in the owner\'s order, ends on the handshake', () => {
  assert.deepEqual(validateScript(S), []);
  assert.ok(S.lines.length >= 12 && S.lines.length <= 16, `${S.lines.length} lines`);
  const order = [...new Set(S.lines.map((l) => l.slide).filter(Boolean))];
  assert.deepEqual(order, ['ledger', 'seal', 'frontier', 'verdance', 'transport', 'terms']);
  assert.equal(S.lines.at(-1).handshake, true);
  for (const id of Object.keys(S.slides)) assert.ok(HOLO_SLIDES[id], `a drawing for slide ${id}`);
  for (const sp of Object.values(S.speakers)) assert.ok(speakerOf(sp.voice), `a voice for ${sp.name}`);
  assert.ok(/rare/i.test(S.lines.find((l) => l.slide === 'terms' || /quota/.test(l.text)).text + S.lines.map((l) => l.text).join(' ')),
    'the terms say rare is kept (owner Q1)');
});

test('typing, a press to finish, a press to move on, and the end', () => {
  const c = createConversationState(S, { cps: 10 });
  let st = c.tick(0.5);
  assert.equal(st.shown, 5); assert.equal(st.full, false); assert.equal(st.slide, 'ledger'); assert.equal(st.newSlide, true);
  assert.equal(c.press(), 'finish'); assert.equal(c.state.full, true);
  assert.equal(c.press(), 'next'); assert.equal(c.state.index, 1); assert.equal(c.state.shown, 0);
  assert.equal(c.state.slide, 'ledger', 'a line without a slide keeps the last one'); assert.equal(c.state.newSlide, false);
  for (let i = 0; i < 100 && !c.state.done; i++) c.press();
  assert.equal(c.state.done, true); assert.equal(c.state.index, S.lines.length - 1);
  assert.equal(c.press(), 'end');
});

test('reduced motion shows whole lines; skip jumps to the end; bad scripts are named', () => {
  const c = createConversationState(S, { reduce: true });
  assert.equal(c.tick(0).full, true);
  assert.equal(c.press(), 'next'); assert.equal(c.state.full, true);
  assert.equal(c.skip().done, true);
  assert.deepEqual(slideTrack({ lines: [{}, { slide: 'a' }, {}] }), [null, 'a', 'a']);
  const errs = validateScript({ speakers: {}, slides: {}, lines: [{ speaker: 'x', text: '', slide: 'y', intent: 'yell' }] });
  assert.equal(errs.length, 4);
});
