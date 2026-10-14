// ROSTER GUARD — owner, 2026-10-14: "I just want to make sure we do not remove any factions or characters."
// [MM-story_mv8gxhut_c]
//
// roster-guard.snapshot.json pins every faction, voice-pack character, combat unit and character portrait
// that existed on 2026-10-14. This test fails if any of them is missing NOW, naming each one. Adding new
// factions, characters, units or portraits never fails. A removal or rename is a design decision only the
// owner makes: with their explicit approval for that item, edit the snapshot in the same commit. Never edit
// it just to make this test pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import REG from './factions.js';
import { UNITS } from './tables.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '../..');
const SNAP = JSON.parse(fs.readFileSync(path.join(HERE, 'roster-guard.snapshot.json'), 'utf8'));
const RULE = 'owner rule 2026-10-14: no faction or character is removed — restore it, or get the owner\'s approval and edit roster-guard.snapshot.json';

const missing = (pinned, now) => { const have = new Set(now); return pinned.filter((x) => !have.has(x)); };

test('the snapshot itself is intact (9 factions, 81 characters, 73 units, 25 portraits pinned)', () => {
  assert.equal(SNAP.factions.length, 9);
  assert.equal(Object.values(SNAP.characters).flat().length, 81);
  assert.equal(SNAP.units.length, 73);
  assert.equal(SNAP.portraits.length, 25);
});

test('no faction has been removed or renamed', () => {
  assert.deepEqual(missing(SNAP.factions, REG.NAMES), [], RULE);
});

test('no voice-pack character has been removed or renamed', () => {
  const packs = JSON.parse(fs.readFileSync(path.join(GAME, 'content/dialog/voicepacks.json'), 'utf8')).factions;
  const gone = [];
  for (const [fk, names] of Object.entries(SNAP.characters)) {
    const now = packs[fk] ? packs[fk].characters.map((c) => c.name) : [];
    if (!packs[fk]) gone.push(`faction pack "${fk}" (all ${names.length} characters)`);
    else for (const n of missing(names, now)) gone.push(`${fk}: ${n}`);
  }
  assert.deepEqual(gone, [], RULE);
});

test('no combat unit has been removed or renamed', () => {
  assert.deepEqual(missing(SNAP.units, Object.keys(UNITS)), [], RULE);
});

test('no character portrait has been removed or renamed', () => {
  const now = fs.readdirSync(path.join(GAME, 'content/dialog/portraits'));
  assert.deepEqual(missing(SNAP.portraits, now), [], RULE);
});

test('the guard really fails on a removal (control: it can measure)', () => {
  assert.deepEqual(missing(['A', 'B', 'C'], ['A', 'C', 'D']), ['B']);
});
