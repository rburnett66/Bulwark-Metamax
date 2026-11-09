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

// Scenes (owner 2026-11-09: "When a character has multiple lines of dialog use bread crumbs and cycle the dialog, but do
// not redraw the whole dialog window"): the breadcrumbs a run of lines shows.
import { crumbsHTML } from './commCard.js';
test('a run of lines shows one breadcrumb per line, the current one lit; a single line shows none', () => {
  assert.equal(crumbsHTML(null), '');
  assert.equal(crumbsHTML({ at: 0, n: 1 }), '');
  const h = crumbsHTML({ at: 1, n: 3 });
  assert.equal((h.match(/<i/g) || []).length, 3);
  assert.match(h, /<i class="read"><\/i><i class="on"><\/i><i><\/i>/);
  assert.match(h, /line 2 of 3/);
});
