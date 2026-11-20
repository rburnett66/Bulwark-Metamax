// [MM-story_mwohmk85_2v] Faction RELATIONS (owner 2026-11-19): Allied · Friendly · Neutral · Wary · Hostile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTION_KEYS, FACTION_RELATIONS, RELATION_STEPS, relationOf, factionRelationRow, characterRelations } from './factionRelations.js';
import './factions.js';
import { rivalOf } from '../save/contracts.js';

const REG = globalThis.BulwarkFactions;

test('the nine factions, symmetric, each allied with itself, every value on the scale', () => {
  assert.deepEqual([...FACTION_KEYS].sort(), REG.COMBAT_FACTIONS.map((f) => f.key).sort());
  for (const a of FACTION_KEYS) for (const b of FACTION_KEYS) {
    assert.ok(RELATION_STEPS.includes(FACTION_RELATIONS[a][b]));
    assert.equal(relationOf(a, b), relationOf(b, a), `${a}/${b}`);
  }
  for (const a of FACTION_KEYS) assert.equal(relationOf(a, a), 'allied');
  assert.equal(relationOf('ground', 'nope'), null);
});

test('every workbook rival pair is Hostile', () => {
  for (const f of REG.COMBAT_FACTIONS) {
    const r = rivalOf(f.name);
    if (r) assert.equal(relationOf(f.key, REG.find(r).key), 'hostile', `${f.name} ↔ ${r}`);
  }
});

test('a faction row lists the other eight; a character bends it, and says why', () => {
  assert.equal(factionRelationRow('ground').length, 8);
  const rows = characterRelations('ground', { relations: { air: { to: 'wary', why: 'love' } } });
  const air = rows.find((r) => r.key === 'air');
  assert.deepEqual([air.relation, air.label, air.bent, air.from, air.why], ['wary', 'Wary', true, 'hostile', 'love']);
  assert.equal(rows.find((r) => r.key === 'artillery').bent, false);
});
