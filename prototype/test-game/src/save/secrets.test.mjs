// [MM-story_mwohmk85_2v] Secrets reveal as rapport rises, in the character's own order; guards hold some back; lies
// give way to the truth. Owner 2026-11-19: "shame, fear, loyalty, control, love".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealSecrets, untoldSecret, noteSecretTold, SECRET_STEPS, SHAME_EXTRA, CONTROL_AT } from './secrets.js';

const sec = (key, extra = {}) => ({ key, text: `${key} truth`, line: `${key} said`, ...extra });
const CH = { name: 'Test Hero', secrets: [
  sec('want', { item: 'loam-grain' }), sec('love', { guard: 'love', who: 'Their Beloved' }), sec('hate'),
  sec('share', { lie: { text: 'share lie', line: 'lie said', until: 50 } }), sec('desire', { guard: 'shame' }),
  sec('sorrow', { guard: 'fear' }), sec('treasure', { guard: 'control' }), sec('magic', { guard: 'loyalty' }), sec('sense'),
] };
const save = (score, more = {}) => ({ rapport: { 'Test Hero': { score, kept: 0, broken: 0, greets: 1, ...(more.r || {}) }, ...(more.book || {}) }, loyalty: more.loyalty || {} });
const states = (v) => v.secrets.map((x) => x.state[0]).join('');

test('an unmet character tells nothing; met, the first secret is out at once', () => {
  assert.equal(states(revealSecrets(CH, {})), 'lllllllll');
  assert.equal(revealSecrets(CH, {}).met, false);
  assert.equal(states(revealSecrets(CH, save(0))), 'olllllllll'.slice(0, 9));
});

test('each step of rapport opens the next secret in the character\'s own order', () => {
  assert.deepEqual(SECRET_STEPS, [0, 5, 12, 20, 30, 42, 60, 80, 100]);
  const v = revealSecrets(CH, save(12));
  assert.equal(v.secrets[0].state, 'out');
  assert.equal(v.secrets[2].state, 'out', 'hate at 12');
  assert.equal(v.secrets[3].state, 'locked', 'share needs 20');
});

test('love: held back until the player has met the one they love; later secrets still come out', () => {
  let v = revealSecrets(CH, save(12));
  assert.equal(v.secrets[1].state, 'held');
  assert.equal(v.secrets[1].hint, 'Protecting someone');
  assert.equal(v.secrets[2].state, 'out', 'a held secret does not block the next');
  v = revealSecrets(CH, save(12, { book: { 'Their Beloved': { score: 0, kept: 1, broken: 0 } } }));
  assert.equal(v.secrets[1].state, 'out');
});

test('a lie is told first, and the truth replaces it once rapport passes its mark', () => {
  let x = revealSecrets(CH, save(20)).secrets[3];
  assert.deepEqual([x.state, x.text, x.line, x.lie, x.wasLie], ['out', 'share lie', 'lie said', true, false]);
  x = revealSecrets(CH, save(50)).secrets[3];
  assert.deepEqual([x.text, x.line, x.lie, x.wasLie], ['share truth', 'share said', false, true]);
});

test('shame needs more rapport; fear a kept promise; control Trusted; loyalty a faction not turned against', () => {
  assert.equal(revealSecrets(CH, save(30)).secrets[4].state, 'held', 'shame at its step');
  assert.equal(revealSecrets(CH, save(30 + SHAME_EXTRA)).secrets[4].state, 'out');
  assert.equal(revealSecrets(CH, save(42)).secrets[5].state, 'held', 'fear: no mission kept');
  assert.equal(revealSecrets(CH, save(42, { r: { kept: 1 } })).secrets[5].state, 'out');
  assert.equal(CONTROL_AT, 60);
  assert.equal(revealSecrets(CH, save(60)).secrets[6].state, 'out', 'control: Trusted');
  assert.equal(revealSecrets(CH, save(80, { loyalty: { Powder: -5 } }), 'Powder').secrets[7].state, 'held', 'loyalty: faction turned');
  assert.equal(revealSecrets(CH, save(80, { loyalty: { Powder: 5 } }), 'Powder').secrets[7].state, 'out');
});

test('told in person once: the next untold secret, then the one after; an uncovered lie is news again', () => {
  const s = save(20);
  let t = untoldSecret(CH, s);
  assert.equal(t.key, 'want');
  noteSecretTold(s, CH.name, t);
  assert.equal(untoldSecret(CH, s).key, 'hate', 'love is held, so hate is next');
  noteSecretTold(s, CH.name, untoldSecret(CH, s));
  t = untoldSecret(CH, s);
  assert.deepEqual([t.key, t.line], ['share', 'lie said']);
  noteSecretTold(s, CH.name, t);
  assert.equal(untoldSecret(CH, s), null);
  s.rapport[CH.name].score = 50;
  assert.deepEqual([untoldSecret(CH, s).key, untoldSecret(CH, s).line], ['share', 'share said'], 'the truth comes out in person');
});
