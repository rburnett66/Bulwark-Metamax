// Relationship portraits [MM-story_mwpni0v4_3m] (was MM-task_mw9odkf0_4): a character's antagonistic / friendly portrait is
// asked for only when its files exist (data/portraitMoods.js); neutral is the base. Placeholders (byte copies of the base)
// carry the status printed over them; a change since last seen draws hearts or bolts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitImg, relationLabel, doobersHTML, pagesOf, paginate } from './commCard.js';
import { MOOD_PORTRAITS, PLACEHOLDER_PORTRAITS } from '../data/portraitMoods.js';

test('no relationship files: the base portrait, with no request for a missing file', () => {
  const h = portraitImg('Nobody Unlisted', 'antagonistic', 'p/');
  assert.match(h, /src="p\/nobody-unlisted\.png"/);
  assert.doesNotMatch(h, /-antagonistic/);
});

test('with relationship files: the mood portrait first, then the base portrait if it fails to load', () => {
  assert.ok(MOOD_PORTRAITS.has('colonel-aldric-vane'), 'the tool switched Aldric on with his placeholders');
  const h = portraitImg('Colonel Aldric Vane', 'friendly', 'p/');
  assert.match(h, /src="p\/colonel-aldric-vane-friendly\.png"/);
  assert.match(h, /data-base="p\/colonel-aldric-vane\.png"/);
  assert.match(portraitImg('Colonel Aldric Vane', 'smug', 'p/'), /src="p\/colonel-aldric-vane\.png"/, 'an unknown mood is ignored');
  assert.match(portraitImg('Colonel Aldric Vane', 'neutral', 'p/'), /src="p\/colonel-aldric-vane\.png"/, 'neutral is the base portrait');
  assert.doesNotMatch(portraitImg('Colonel Aldric Vane', 'neutral', 'p/'), /-neutral/);
});

test('a placeholder portrait has its relationship status printed over it; final art has none', () => {
  assert.ok(PLACEHOLDER_PORTRAITS.has('colonel-aldric-vane'));
  assert.match(relationLabel('Colonel Aldric Vane', 'friendly'), /class="bw-rel bw-rel-friendly">FRIENDLY</);
  assert.match(relationLabel('Colonel Aldric Vane', 'neutral'), />NEUTRAL</);
  assert.match(relationLabel('Colonel Aldric Vane', 'antagonistic'), />ANTAGONISTIC</);
  assert.equal(relationLabel('Colonel Aldric Vane', null), '');
  PLACEHOLDER_PORTRAITS.delete('colonel-aldric-vane');
  try { assert.equal(relationLabel('Colonel Aldric Vane', 'friendly'), '', 'final art: no label'); }
  finally { PLACEHOLDER_PORTRAITS.add('colonel-aldric-vane'); }
});

test('a relationship change draws hearts (better) or lightning bolts (worse); no change draws nothing', () => {
  const up = doobersHTML('up'), down = doobersHTML('down');
  assert.match(up, /bw-doobers-up/); assert.equal((up.match(/<i /g) || []).length, 7);
  assert.match(up, /M12 21s/, 'a heart'); assert.match(down, /M13\.5 1\.5/, 'a bolt');
  assert.equal(doobersHTML(null), ''); assert.equal(doobersHTML('sideways'), '');
  assert.equal(doobersHTML('up'), up, 'the same every time: no chance in it');
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

// [MM-story_mwpzbj5c_45] owner 2026-11-21: "Consider mobile with no more than two sentences per screen with bread crumbs
// swipe left and right to continue or back."
test('pages: at most two sentences a screen; a tell\'s ".." is a pause, not a sentence end', () => {
  assert.deepEqual(pagesOf("I'm Ines, from the Ground fleet. If you can deliver some Choir Lily, we will pay: 12 gold each, up to 40. It's always good to have friends in high places."),
    ["I'm Ines, from the Ground fleet. If you can deliver some Choir Lily, we will pay: 12 gold each, up to 40.", "It's always good to have friends in high places."]);
  assert.deepEqual(pagesOf('One. Two.'), ['One. Two.'], 'two sentences: one page');
  assert.deepEqual(pagesOf('I, uh .. About .. Otto: he loves Rei. Or so I heard. No. I know.'), ['I, uh .. About .. Otto: he loves Rei. Or so I heard.', 'No. I know.']);
  assert.deepEqual(pagesOf('Wait... what? No! "Fine," she said.'), ['Wait... what? No!', '"Fine," she said.']);
  assert.deepEqual(pagesOf(''), []);
  assert.deepEqual(pagesOf('no full stop'), ['no full stop']);
  const calls = paginate([{ name: 'A', factionKey: 'ground', line: 'One. Two. Three.' }, null, { name: 'B', factionKey: 'air', line: 'Hi.' }]);
  assert.deepEqual(calls.map((c) => [c.name, c.line]), [['A', 'One. Two.'], ['A', 'Three.'], ['B', 'Hi.']], 'one call a page, same speaker');
});
