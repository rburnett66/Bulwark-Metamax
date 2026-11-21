// [MM-story_mwohmm89_2x] One character per map, a secondary from another faction at wave 3, short lines.
// Owner 2026-11-19: "instead of meeting a new character on each wave, interact with 1 character per map with the
// secondary character from another faction appearing at wave 3. We need to simplify the dialog".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapCast, openingCall, secondaryCall, closingCall, firstSentence, aboardSecretCalls, SECONDARY_AFTER_WAVE } from './mapCast.js';
import { noteSecretTold } from '../save/secrets.js';
import { tipsCall } from './dialog.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const PACKS = read('../../content/dialog/voicepacks.json');
const FILES = { ground: read('../../content/characters/ground.json') };
const words = (l) => String(l).trim().split(/\s+/).length;

test('a Verdance map has its authored cast: its own Powder character, and the secondary from another faction', () => {
  const c = mapCast(FILES, PACKS, 'ground', 3, 'air');
  assert.equal(c.primary.name, 'Captain Otto von Halbrecht');
  assert.deepEqual([c.secondary.name, c.secondary.faction], ['Rei "Skylark" Tanaka', 'air']);
  const sp = secondaryCall(c, PACKS);
  assert.equal(sp.factionKey, 'air');
  assert.equal(sp.line, FILES.ground.maps['3'].secondary.line);
  assert.equal(SECONDARY_AFTER_WAVE, 3);
});

test('the opening is the start line; secrets are told aboard the capital ship (owner 2026-11-21)', () => {
  const c = mapCast(FILES, PACKS, 'ground', 3, 'air');
  for (const save of [{}, { rapport: { 'Captain Otto von Halbrecht': { score: 30, kept: 1, broken: 0 } } }]) {
    const o = openingCall(c, FILES, PACKS, save);
    assert.equal(o.spec.line, 'I carry the name, not its sins. Show me yours.');
    assert.equal(o.secret, null);
  }
});

test('aboard the Powder ship: characters with a newly unlocked secret tell it, three at most, once each', () => {
  const met = (score) => ({ score, kept: 1, broken: 0 });
  const s = { rapport: { 'Captain Otto von Halbrecht': met(0), 'Colonel Aldric Vane': met(0), 'Quartermaster Ines Roth': met(0), 'Sergeant "Bricks" Malloy': met(0) } };
  const told = aboardSecretCalls(FILES, PACKS, 'ground', s, 'Ground / Powder');
  assert.equal(told.length, 3, 'three per visit');
  assert.ok(told.every((t) => /SECRET/.test(t.spec.sub) && t.spec.line === t.secret.line));
  for (const t of told) noteSecretTold(s, t.name, t.secret);
  const next = aboardSecretCalls(FILES, PACKS, 'ground', s, 'Ground / Powder');
  assert.ok(next.every((t) => !told.some((u) => u.name === t.name && u.secret.key === t.secret.key)), 'a secret is told once');
  assert.deepEqual(aboardSecretCalls(FILES, PACKS, 'ground', {}, 'Ground / Powder'), [], 'unmet characters tell nothing');
  assert.deepEqual(aboardSecretCalls(FILES, PACKS, 'nowhere', s), []);
});

test('the last word is the map character\'s: win or lose', () => {
  const c = mapCast(FILES, PACKS, 'ground', 9, 'air');
  assert.equal(closingCall(c, FILES, PACKS, 'win').line, 'The fire banks. It does not go out.');
  assert.equal(closingCall(c, FILES, PACKS, 'lose').line, 'Feed them. Feed them all.');
});

test('a faction with no characters file yet: its cast rotated by map, its rival\'s champion as secondary, first sentences only', () => {
  const c = mapCast(FILES, PACKS, 'air', 2, 'ground');
  assert.equal(c.primary.name, PACKS.factions.air.characters[1].name);
  assert.equal(c.secondary.faction, 'ground');
  assert.equal(c.secondary.name, 'Chancellor Wilhelmina Graf');
  const o = openingCall(c, FILES, PACKS, {});
  assert.equal(o.spec.line, firstSentence(PACKS.factions.air.characters[1].lines.m0.line));
  assert.ok(o.spec.line.length < PACKS.factions.air.characters[1].lines.m0.line.length);
  assert.equal(firstSentence('One. Two! Three?'), 'One.');
  assert.equal(firstSentence('No stop'), 'No stop');
});

test('the contract tip, star bonus and closing are one short line each', () => {
  for (const [kind, outcome] of [['tip'], ['reward'], ['closing', 'FULFILLED'], ['closing', 'FAILED']]) {
    const c = tipsCall(PACKS, 'Ground / Powder', 7, kind, outcome || null);
    assert.ok(words(c.line) <= 10, `${kind}: ${c.line}`);
  }
});

test('main.js: only the map\'s first wave has a character; the secondary after wave 3; the map character closes', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(main, /if \(wave !== 1\) return Promise\.resolve\(\);/);
  assert.match(main, /if \(idx === SECONDARY_AFTER_WAVE && secondaryCall\(matchCast\(\), voicePacks\)\)/);
  assert.match(main, /closingCall\(matchCast\(\), characterFiles, voicePacks, S\.result\)/);
  assert.doesNotMatch(main, /noteSecretTold/, 'no secret is told in battle any more');
  assert.match(main, /if \(idx === SECONDARY_AFTER_WAVE\) await offerRareContract\(\(matchCast\(\) \|\| \{\}\)\.secondary \|\| null\);/, 'one voice at wave 3: the secondary offers the contract');
  assert.match(main, /const call = !own && contact && characterCall/, 'the secondary is not announced twice');
  const ship = readFileSync(new URL('../reveal/shipReveal.js', import.meta.url), 'utf8');
  assert.match(ship, /aboardScene\(buildModel\(\{ packs: pk, files, threads \}\), files, pk, ship\.key, loadSave\(\), factionNameOf\(ship\.key\)\)/, 'secrets and rumours are told aboard');
  assert.match(ship, /updateSave\(\(sv\) => scene\.commit\(sv\)\)/, 'and recorded once');
});
