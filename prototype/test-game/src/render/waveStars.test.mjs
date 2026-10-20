// src/render/waveStars.test.mjs — the result card's per-wave stars read as waves, not one number [MM-task_mvgyb74q_2].
import test from 'node:test';
import assert from 'node:assert/strict';
import { waveStarsHtml } from './hud.js';

test('result stars: every wave labelled W1..Wn with its own stars, and the average says out of 5', () => {
  const html = waveStarsHtml([2, 2, 1, 2, 4, 4, 3, 3]);
  for (let i = 1; i <= 8; i++) assert.match(html, new RegExp('>W' + i + '<'));
  assert.equal((html.match(/★</g) || []).length, 8, 'one star cell per wave');
  assert.match(html, /avg 2\.6 \/ 5/);
  assert.match(html, /OUT OF 5/);
  assert.doesNotMatch(html, /2 2 1 2 4 4 3 3/, 'no run-together digit string');
});
