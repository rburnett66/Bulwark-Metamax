// [MM-story_mw1bw933_e] The audio control: saved volumes and the master mute reach the engine, persist, and notify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mem = new Map([['bw.volumes', JSON.stringify({ master: 0.5, music: 0.3 })], ['bulwark:commMuted', '1']]);
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
const V = await import('./voice.js');

test('saved volumes and the old comm mute are read at load', () => {
  assert.equal(V.getChannelVolume('master'), 0.5);
  assert.equal(V.getChannelVolume('music'), 0.3);
  assert.equal(V.getChannelVolume('dialog'), 1, 'unsaved channels keep their defaults');
  assert.equal(V.isMuted(), true, 'a player who muted the comm voice before stays muted');
});

test('mute and volume persist and tell listeners', () => {
  const seen = [];
  const off = V.onAudioChange((e) => seen.push(e));
  V.setMuted(false);
  V.setChannelVolume('master', 0.25);
  V.setChannelVolume('music', 2);
  off();
  V.setMuted(true);
  assert.equal(seen.length, 3, 'unsubscribed listeners hear nothing');
  assert.deepEqual(seen[1], { muted: false, volumes: { master: 0.25, dialog: 1, game: 1, music: 0.3 } });
  assert.equal(V.getChannelVolume('music'), 1, 'clamped to 0..1');
  assert.equal(mem.get('bw.muted'), '1');
  assert.equal(JSON.parse(mem.get('bw.volumes')).master, 0.25);
});

test('the in-game control mutes everything and carries a volume slider; Settings has a music slider', () => {
  const CARD = readFileSync(new URL('./commCard.js', import.meta.url), 'utf8');
  assert.match(CARD, /class="bw-audio-vol" min="0" max="100"/);
  assert.match(CARD, /setMuted\(!isMuted\(\)\)/);
  assert.ok(!/bulwark:commMuted/.test(CARD), 'no private comm-only mute left');
  const MENU = readFileSync(new URL('../menu/menu.js', import.meta.url), 'utf8');
  assert.match(MENU, /\['music', 'MUSIC'\]/);
  assert.match(MENU, /onAudioChange\(/);
});
