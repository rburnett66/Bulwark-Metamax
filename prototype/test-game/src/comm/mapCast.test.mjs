// [MM-story_mwohmm89_2x] One character per map, a secondary from another faction at wave 3, short lines.
// Owner 2026-11-19: "instead of meeting a new character on each wave, interact with 1 character per map with the
// secondary character from another faction appearing at wave 3. We need to simplify the dialog".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapCast, openingCall, secondaryCall, closingCall, firstSentence, aboardSecretCalls, SECONDARY_AFTER_WAVE, contractOfferScene, spokenFleet } from './mapCast.js';
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
  assert.match(main, /if \(idx === SECONDARY_AFTER_WAVE && !\(offer && offer\.bySecondary\) && secondaryCall\(matchCast\(\), voicePacks\)\)/,
    'the secondary speaks alone only when they make no offer');
  assert.match(main, /closingCall\(matchCast\(\), characterFiles, voicePacks, S\.result\)/);
  assert.doesNotMatch(main, /noteSecretTold/, 'no secret is told in battle any more');
  assert.match(main, /const offer = idx === SECONDARY_AFTER_WAVE \? prepareRareOffer\(\(matchCast\(\) \|\| \{\}\)\.secondary \|\| null\) : null;/, 'one voice at wave 3: the secondary offers the contract');
  assert.match(main, /if \(offer\) await playRareOffer\(offer\);/);
  const ship = readFileSync(new URL('../reveal/shipReveal.js', import.meta.url), 'utf8');
  assert.match(ship, /aboardScene\(buildModel\(\{ packs: pk, files, threads \}\), files, pk, ship\.key, loadSave\(\), factionNameOf\(ship\.key\)\)/, 'secrets and rumours are told aboard');
  assert.match(ship, /updateSave\(\(sv\) => scene\.commit\(sv\)\)/, 'and recorded once');
});

// [MM-story_mwpzbj5c_45] owner 2026-11-21: "The contract offers on Wave should be presented as character dialogs since
// they are often introductions of new characters." · "I hear you are resource gathering on Florael" · "I'm Chelsea from
// (faction) and if you can deliver some elder root we will pay, it's always good to have friends in high places."
test('the wave-3 offer is a dialog: an introduction, the offer in their voice, an answer to the choice, their line last', () => {
  const sc = contractOfferScene(PACKS, { factionKey: 'ground', name: 'Quartermaster Ines Roth', factionName: 'Ground / Powder',
    planetName: 'Florael', rareName: 'Dawnpollen', quota: 40, price: 12, personality: 'open-hearted', flavour: 'Tell Sora the powder\'s dry. And nothing else.' });
  assert.deepEqual(sc.calls.map((c) => c.line), [
    'I hear you\'re gathering resources on Florael.',
    'I\'m Ines, from the Ground fleet. If you can deliver some Dawnpollen, we will pay: 12 gold each, up to 40. It\'s always good to have friends in high places.',
  ]);
  for (const c of [...sc.calls, sc.replies.accept, sc.replies.decline, ...sc.after]) {
    assert.equal(c.name, 'Quartermaster Ines Roth'); assert.equal(c.factionKey, 'ground'); assert.match(c.sub, /CONTRACT OFFER$/);
  }
  assert.ok(sc.replies.accept.line && sc.replies.decline.line && sc.replies.accept.line !== sc.replies.decline.line);
  assert.deepEqual(sc.after.map((c) => c.line), ['Tell Sora the powder\'s dry. And nothing else.']);
  const cruel = contractOfferScene(PACKS, { factionKey: 'ground', name: 'Quartermaster Ines Roth', factionName: 'Ground / Powder',
    planetName: 'Kessra', rareName: 'Ghost Brass', quota: 10, price: 30, personality: 'cruel', flavour: null });
  assert.match(cruel.calls[1].line, /Don't make me regret asking\.$/, 'the close follows their personality');
  assert.deepEqual(cruel.after, []);
  assert.equal(spokenFleet('Greenies (Chem)'), 'the Greenies fleet');
  assert.equal(spokenFleet('High Tech'), 'the High Tech fleet');
});

test('an offer declined before comes back with its own opening, and a decline promises to ask again', () => {
  const sc = contractOfferScene(PACKS, { factionKey: 'ground', name: 'Quartermaster Ines Roth', factionName: 'Ground / Powder',
    planetName: 'Florael', rareName: 'Dawnpollen', quota: 40, price: 12, personality: 'wary', flavour: null, again: true });
  assert.equal(sc.calls[0].line, 'Back on Florael? My offer still stands.');
  assert.match(sc.replies.decline.line, /ask again|be around|ask once more/);
});
