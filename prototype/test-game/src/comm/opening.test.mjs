// [MM-story_mw548j4g_v] The Collective opening's bar conversation runs on the game's dialog system: lines authored in
// the design doc, generated into content/dialog/opening.json, played as comm transmissions by the collective contact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CONTACTS, speakerOf } from './voice.js';
import { openingCalls } from './dialog.js';
import { portraitSlug } from './commCard.js';
import { HOLO_SLIDES } from './holoSlide.js';

const opening = JSON.parse(readFileSync(new URL('../../content/dialog/opening.json', import.meta.url), 'utf8'));
const DOC = new URL('../../../../docs/16 Bulwark MM/design/Collective-Opening-Dialog.md', import.meta.url);

test('opening.json is what the design doc says (re-run tools/extract_opening.py after editing the doc)', () => {
  const text = readFileSync(DOC, 'utf8');
  const doc = [];
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) { section = line; continue; }
    const m = section === '## Lines' && line.match(/^- (?:\*(\w+):\* )?"(.+)"$/);
    if (m) doc.push({ line: m[2], slide: m[1] || null });
  }
  assert.deepEqual(opening.lines.map((l) => ({ line: l.line, slide: l.slide || null })), doc);
  assert.equal(opening.speaker.name, (text.match(/^\*\*Speaker:\*\* (.+)$/m) || [])[1]);
});

test('every line is a comm call by the collective contact; the slides exist; the speaker has a portrait', () => {
  const calls = openingCalls(opening);
  assert.equal(calls.length, opening.lines.length);
  assert.ok(CONTACTS.collective && speakerOf('collective'), 'the collective contact speaks');
  for (const c of calls) {
    assert.equal(c.factionKey, 'collective');
    assert.ok(c.line && c.name && c.voiceSeed);
    if (c.slide) assert.ok(HOLO_SLIDES[c.slide] && opening.slides[c.slide], `slide ${c.slide}`);
  }
  assert.equal(calls.at(-1).chip, '◇ CONTRACT OFFER');
  assert.deepEqual([...new Set(calls.map((c) => c.slide).filter(Boolean))], ['ledger', 'seal', 'frontier', 'verdance', 'transport', 'terms']);
  assert.ok(/rare/i.test(opening.lines.map((l) => l.line).join(' ')), 'the terms say rare is kept (owner Q1)');
  assert.ok(existsSync(new URL(`../../content/dialog/portraits/${portraitSlug(opening.speaker.name)}.png`, import.meta.url)), 'portrait');
});
