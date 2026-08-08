// The comm layer, checked against the CONTENT it has to speak (GGG-3).
//
// Same principle as factions.test.mjs: nothing here asserts a list against itself. Every check reads
// content/dialog/voicepacks.json, content/dialog/portraits/ or the registry, and compares them to
// what src/comm actually does. voice.js used to declare its own faction names and its own
// display-name -> voice-key map; those are gone, and these are the checks that keep them gone by
// proving the comm layer can still resolve every faction from the registry alone.
//
// The bug that motivated the tipsCall checks below: tipsCall read `packs.factions[factionName]`,
// indexing a pack keyed by voice key ('ground') with a display name ('Ground / Powder'). It matched
// nothing, so it returned null for every caller, and the FIELD TIP and STAR BONUS transmissions
// never played. Nothing caught it because every OTHER call in dialog.js went through the mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FACTIONS, ORDER, ICONS, VGAIN, STATIC, voiceKeyOf } from './voice.js';
import { tipsCall, challengeCall, winCall, defeatCall } from './dialog.js';
import { portraitSlug } from './commCard.js';
import '../data/factions.js';

const REG = globalThis.BulwarkFactions;
const CONTENT = new URL('../../content/', import.meta.url);
const packs = JSON.parse(readFileSync(new URL('dialog/voicepacks.json', CONTENT), 'utf8'));

test('every faction the registry declares has a voice pack to speak from', () => {
  for (const f of REG.FACTIONS) {
    const key = voiceKeyOf(f.name);
    assert.equal(key, f.voice, `voiceKeyOf("${f.name}") should resolve to its declared voice key`);
    const pack = packs.factions[key];
    assert.ok(pack, `"${f.name}" -> voice key "${key}", which voicepacks.json does not have`);
    assert.ok(pack.characters && pack.characters.length, `voice pack "${key}" has no characters`);
  }
});

test('voiceKeyOf refuses anything that is not a speaking faction', () => {
  // 'Combined forces' is the finale's pseudo-faction and System is not playable — neither has a
  // voice, and dialog.js depends on getting null rather than a wrong faction's cast.
  assert.equal(voiceKeyOf('Combined forces'), null, 'the finale has no single-faction voice');
  assert.equal(voiceKeyOf(REG.SYSTEM.name), null, 'System is not a speaking faction');
  assert.equal(voiceKeyOf(''), null);
  assert.equal(voiceKeyOf(undefined), null);
});

test('EVERY comm call resolves the faction the same way — the display name the game passes around', () => {
  // main.js only ever holds DISPLAY names (wave defs, runContract.giver, lastWaveFaction). If one of
  // these four entry points disagrees about how its faction argument is spelled, that call silently
  // goes quiet in-game while the others keep working. That is exactly how tipsCall broke.
  for (const name of REG.NAMES) {
    assert.ok(challengeCall(packs, name, 1, 7, 1), `challengeCall went silent for "${name}"`);
    assert.ok(winCall(packs, name, 1, 7, 'efficient', false), `winCall went silent for "${name}"`);
    assert.ok(defeatCall(packs, name, 7), `defeatCall went silent for "${name}"`);
    assert.ok(tipsCall(packs, name, 7, 'tip'), `tipsCall went silent for "${name}"`);
    assert.ok(tipsCall(packs, name, 7, 'reward'), `tipsCall (reward) went silent for "${name}"`);
  }
});

test('a tip is spoken by someone from THAT faction, with a real authored line', () => {
  for (const f of REG.FACTIONS) {
    const cast = packs.factions[f.voice].characters.map((c) => c.name);
    for (const kind of ['tip', 'reward']) {
      const call = tipsCall(packs, f.name, 11, kind);
      assert.ok(call, `no ${kind} call for "${f.name}"`);
      assert.ok(cast.includes(call.name),
        `${kind} for "${f.name}" is spoken by ${call.name}, who is not in that faction's cast`);
      assert.ok(call.line && call.line.length > 20, `${kind} line for "${f.name}" is empty`);
    }
  }
});

test('the comm screen has a timbre, icon, gain and static bed for every registry faction', () => {
  // voice.js no longer decides WHICH factions exist — it is keyed off the registry. So the failure
  // mode is a faction added to the registry with no acoustic profile here, which would make it
  // unspeakable on the comm screen. Walk the registry, not voice.js's own table.
  assert.deepEqual([...ORDER], REG.FACTIONS.map((f) => f.voice), 'ORDER must be the registry roster');
  for (const f of REG.FACTIONS) {
    const p = FACTIONS[f.voice];
    assert.ok(p, `no voice profile for "${f.name}"`);
    assert.equal(p.name, f.name, `voice profile for "${f.voice}" disagrees with the registry name`);
    for (const k of ['pitchM', 'pitchF', 'wave', 'f1', 'f2', 'rate']) {
      assert.ok(p[k] != null, `"${f.name}" voice profile is missing ${k} — it has no timbre`);
    }
    assert.ok(ICONS[f.voice], `no comm icon for "${f.name}"`);
    assert.ok(VGAIN[f.voice] > 0, `no loudness normalization for "${f.name}"`);
    assert.ok(STATIC[f.voice], `no channel-static bed for "${f.name}"`);
  }
});

test('no authored portrait ships unreachable', () => {
  // commCard resolves portraits as content/dialog/portraits/<slug(character name)>.png and silently
  // drops the <img> on 404. That fallback means a MISNAMED portrait file is invisible: the art ships,
  // costs bytes, and never draws. Check the real directory against the real cast.
  const reachable = new Set();
  for (const pack of Object.values(packs.factions)) {
    for (const c of pack.characters) reachable.add(portraitSlug(c.name));
  }
  const files = readdirSync(new URL('dialog/portraits/', CONTENT)).filter((f) => f.endsWith('.png'));
  assert.ok(files.length, 'no portraits found at all — the directory moved');
  for (const file of files) {
    assert.ok(reachable.has(file.replace(/\.png$/, '')),
      `${file} matches no character's slug — it can never be displayed`);
  }
});
