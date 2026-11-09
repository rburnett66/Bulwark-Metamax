// Portrait expressions (owner 2026-11-09) [MM-task_mw9odkf0_4]: a character's mood portrait is asked for only when its
// art has landed (data/portraitMoods.js); otherwise the one portrait it has.
import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitImg } from './commCard.js';
import { MOOD_PORTRAITS } from '../data/portraitMoods.js';

test('no expression art yet: the base portrait, with no request for a missing file', () => {
  const h = portraitImg('Colonel Aldric Vane', 'angry', 'p/');
  assert.match(h, /src="p\/colonel-aldric-vane\.png"/);
  assert.doesNotMatch(h, /-angry/);
});

test('with expression art: the mood portrait first, then the base portrait if it fails to load', () => {
  MOOD_PORTRAITS.add('colonel-aldric-vane');
  try {
    const h = portraitImg('Colonel Aldric Vane', 'happy', 'p/');
    assert.match(h, /src="p\/colonel-aldric-vane-happy\.png"/);
    assert.match(h, /data-base="p\/colonel-aldric-vane\.png"/);
    assert.match(portraitImg('Colonel Aldric Vane', 'smug', 'p/'), /src="p\/colonel-aldric-vane\.png"/, 'an unknown mood is ignored');
  } finally { MOOD_PORTRAITS.delete('colonel-aldric-vane'); }
});
