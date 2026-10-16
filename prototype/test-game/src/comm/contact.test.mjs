// [MM-story_mvajkyq5_z] — the Unknown Contact: a comm speaker who is not a faction, whose lines are
// authored in the design doc and generated into content/dialog/contact.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONTACTS, FACTIONS, ORDER, ICONS, VGAIN, STATIC, speakerOf, paramsFor, voiceKeyOf, utterDuration,
} from './voice.js';
import { contactCall, contactReply } from './dialog.js';
import { PLANETS } from '../data/planets.js';

const contact = JSON.parse(readFileSync(new URL('../../content/dialog/contact.json', import.meta.url), 'utf8'));
const DOC = new URL('../../../../docs/16 Bulwark MM/design/Unknown-Contact-Dialog.md', import.meta.url);

test('contact.json is what the design doc says (re-run tools/extract_contact.py after editing the doc)', () => {
  const text = readFileSync(DOC, 'utf8');
  const lines = { favour: {}, replies: {} };
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) { section = { '## Favour lines': 'favour', '## Replies': 'replies' }[line] || null; continue; }
    const m = line.match(/^- \*(\w+):\*\s*"(.+)"$/);
    if (m && section) lines[section][m[1]] = m[2];
  }
  for (const sec of ['favour', 'replies']) {
    assert.deepEqual(Object.keys(contact[sec]).sort(), Object.keys(lines[sec]).sort(), `${sec} keys`);
    for (const [k, l] of Object.entries(lines[sec])) assert.equal(contact[sec][k].line, l, `${sec}.${k} drifted from the doc`);
  }
  assert.equal(contact.speaker.name, text.match(/^\*\*Speaker:\*\* (.+)$/m)[1].trim());
});

test('one favour per homeworld, naming that world\'s rare and epic resource', () => {
  assert.deepEqual(Object.keys(contact.favour).sort(), Object.keys(PLANETS).sort());
  for (const [k, p] of Object.entries(PLANETS)) {
    const line = contact.favour[k].line;
    assert.ok(line.includes(p.resources.rare.name), `${k}: favour must name ${p.resources.rare.name}`);
    assert.ok(line.includes(p.resources.epic.name), `${k}: favour must name ${p.resources.epic.name}`);
    assert.ok(!line.includes(p.resources.common.name), `${k}: the contact never asks for the charter's common haul`);
  }
});

test('the contact is a speakable voice, but not a faction', () => {
  const c = CONTACTS.unknown;
  for (const k of ['pitchM', 'pitchF', 'wave', 'f1', 'f2', 'rate', 'color']) assert.ok(c[k] != null, `missing ${k}`);
  assert.ok(ICONS.unknown && VGAIN.unknown > 0 && STATIC.unknown, 'icon, gain and static bed');
  assert.ok(c.portrait.startsWith('<svg'), 'hooded silhouette portrait');
  assert.equal(speakerOf('unknown'), c);
  assert.equal(speakerOf('ground'), FACTIONS.ground);
  assert.equal(speakerOf('nope'), null);
  // never leaks into the roster: no faction, no wave builder, no voice-key lookup by name
  assert.ok(!ORDER.includes('unknown') && !FACTIONS.unknown);
  assert.equal(voiceKeyOf(c.name), null);
  const p = paramsFor('unknown', { rateMult: 2 });
  assert.equal(p.rate, c.rate * 2);
  assert.equal(p.vgain, VGAIN.unknown);
});

test('contactCall gives the comm card a favour it can voice, on every homeworld', () => {
  for (const k of Object.keys(PLANETS)) {
    const call = contactCall(contact, k);
    assert.ok(speakerOf(call.factionKey), `${k}: comm card would drop this call`);
    assert.equal(call.name, 'Unknown Contact');
    assert.equal(call.chip, '◇ FAVOUR ASKED');
    assert.equal(call.line, contact.favour[k].line);
    assert.ok(utterDuration(call.line, paramsFor(call.factionKey), call.intent) > 2, `${k}: line has length`);
  }
  assert.equal(contactCall(contact, 'nope'), null);
  assert.equal(contactCall(null, 'ground'), null);
});

test('the contact answers both ways', () => {
  for (const kind of ['accept', 'decline']) {
    const r = contactReply(contact, kind);
    assert.ok(r && speakerOf(r.factionKey) && r.line.length > 10, kind);
    assert.equal(r.chip, null);
  }
});
