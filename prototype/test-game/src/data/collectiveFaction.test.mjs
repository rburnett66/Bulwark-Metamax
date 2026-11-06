// The Collective in the faction registry [MM-story_mw4a1kcg_l] — a tenth faction you trade with, never fight or play.
// Tech plan: docs/tech-plan/Collective-Faction.md §3.1. Every check reads the callers' own data (tables, planets,
// workbook, voice, rivals) so adding the Collective is proven to change no battle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { UNITS, factionsInRoster } from './tables.js';
import { PLANETS } from './planets.js';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { ORDER, FACTIONS as VOICES } from '../comm/voice.js';
import { rivalOf } from '../save/contracts.js';

const F = createRequire(import.meta.url)('./factions.js');
const C = F.COLLECTIVE;

test('the Collective is in the registry: ordinal 10, no planet, not playable, not combat', () => {
  assert.equal(C.key, 'collective');
  assert.equal(C.prefix, 'COL');
  assert.equal(C.name, 'The Collective');
  assert.equal(C.ordinal, 10);
  assert.equal(C.planet, null);
  assert.equal(C.playable, false);
  assert.equal(C.combat, false);
  assert.deepEqual([...C.files], []);
  for (const k of ['collective', 'COL', 'The Collective']) assert.equal(F.find(k), C, `find(${k})`);
  assert.equal(F.factionOfOrdinal(10), C);
  assert.ok(F.ALL.includes(C));
});

test('COMBAT_FACTIONS is the nine, and the Collective is in none of the combat lists', () => {
  assert.equal(F.COMBAT_FACTIONS.length, 9);
  assert.deepEqual(F.COMBAT_FACTIONS.map((f) => f.ordinal), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(!F.COMBAT_FACTIONS.includes(C));
  assert.ok(!F.FACTIONS.includes(C));
  assert.ok(!F.NAMES.includes(C.name), 'the faction picker / menu names');
});

test('no battle can field it: no planet, no units, no wave faction, no rival, no voice timbre yet', () => {
  assert.equal(PLANETS[C.key], undefined, 'no homeworld');
  assert.ok(!Object.keys(UNITS).some((id) => id.startsWith(C.prefix + '-')), 'no units');
  assert.ok(!factionsInRoster().includes(C.name), 'never a wave faction');
  assert.ok(!MAPDATA.factions.some((r) => r.Faction_ID === C.ordinal), 'no workbook Factions row (no harvester profile, no rival)');
  assert.equal(rivalOf(C.name), null, 'no rival');
  for (const f of F.COMBAT_FACTIONS) assert.notEqual(rivalOf(f.name), C.name, `${f.name}'s rival is not the Collective`);
  assert.ok(!ORDER.includes(C.voice), 'voice timbres are the nine until its cast lands (C4)');
  assert.equal(VOICES[C.voice], undefined);
});
