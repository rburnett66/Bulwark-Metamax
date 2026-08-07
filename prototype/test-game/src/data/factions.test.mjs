// The faction registry, checked against the code and content that already exist.
//
// The registry is only worth having if it is TRUE. A wrong prefix here would be worse than the guessing
// it replaces, because it would look authoritative. So nothing below asserts the registry against itself
// — every check reads tables.js, content/units/ or voicepacks.json and compares.
//
// This is the check that would have caught all three of the bugs that motivated the registry:
//   - Stack Forge's prefixFor disagreeing with tables.js on six of nine factions (origin of SPA-U3)
//   - fileForFaction's 5-char first-match hiding system-flak and system-base
//   - artillery.units.json declaring one faction and containing another's ids
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { UNITS, SYSTEM_UNITS } from './tables.js';

const F = createRequire(import.meta.url)('./factions.js');
const CONTENT = new URL('../../content/', import.meta.url);

test('every prefix matches the ids that faction ACTUALLY uses in tables.js', () => {
  // The check that matters most. prefixFor got six of nine wrong and nothing noticed for months.
  const seen = new Map();
  for (const [id, def] of Object.entries(UNITS)) {
    const prefix = id.slice(0, id.indexOf('-'));
    const prev = seen.get(def.faction);
    assert.ok(prev === undefined || prev === prefix,
      `faction "${def.faction}" uses more than one id prefix: ${prev} and ${prefix}`);
    seen.set(def.faction, prefix);
  }
  for (const [name, prefix] of seen) {
    const f = F.BY_NAME.get(name);
    assert.ok(f, `tables.js has faction "${name}" but the registry does not`);
    assert.equal(f.prefix, prefix,
      `registry says ${name} -> ${f.prefix}, but its units are ${prefix}-*`);
  }
});

test('the registry and tables.js agree on WHICH factions exist — in both directions', () => {
  const inTables = new Set(Object.values(UNITS).map((u) => u.faction));
  for (const f of F.FACTIONS) {
    assert.ok(inTables.has(f.name), `registry has "${f.name}" but no unit in tables.js uses it`);
  }
  for (const name of inTables) {
    assert.ok(F.BY_NAME.has(name), `tables.js uses "${name}" but the registry omits it`);
  }
  assert.equal(F.FACTIONS.length, inTables.size);
});

test('SYSTEM is separate, and is the prefix SYSTEM_UNITS actually uses', () => {
  // System is not a playable faction — its defs live in SYSTEM_UNITS. Asserting this pins the decision
  // rather than letting the list quietly grow a tenth member.
  assert.ok(!F.FACTIONS.some((f) => f.key === 'system'), 'System must not be in the playable list');
  for (const id of Object.keys(SYSTEM_UNITS)) {
    assert.equal(id.slice(0, id.indexOf('-')), F.SYSTEM.prefix,
      `${id} does not carry the System prefix ${F.SYSTEM.prefix}`);
  }
});

test('keys, prefixes, names and ordinals are unique — nothing silently shadows another', () => {
  for (const field of ['key', 'prefix', 'name']) {
    const vals = F.ALL.map((f) => f[field]);
    assert.equal(new Set(vals).size, vals.length, `duplicate ${field} in the registry: ${vals.join(', ')}`);
  }
  const ords = F.FACTIONS.map((f) => f.ordinal);
  assert.deepEqual(ords, [...ords].sort((a, b) => a - b), 'ordinals must be ascending');
  assert.deepEqual(ords, ords.map((_, i) => i + 1), 'ordinals must be 1..n with no gaps');
});

test('ORDER is preserved — menu.js indexes this list by a numeric workbook id', () => {
  // menu.js:223 does FACTION_NAMES[fid - 1]. Reorder the registry and it silently returns the WRONG
  // faction, with no error anywhere. This pins the order that shipped.
  assert.deepEqual(F.NAMES, [
    'Ground / Powder', 'Air', 'High Tech', 'Artillery', 'Water',
    'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)',
  ]);
  for (const f of F.FACTIONS) assert.equal(F.NAMES[f.ordinal - 1], f.name, `${f.name} ordinal is wrong`);
});

test('every declared content file exists on disk', () => {
  for (const f of F.ALL) {
    if (!f.file) continue;
    const rel = `units/${f.file}.units.json`;
    assert.ok(existsSync(new URL(rel, CONTENT)), `${f.name} declares ${rel}, which does not exist`);
  }
});

test('a declared content file agrees with the faction that claims it', () => {
  // artillery.units.json declares faction "Ground / Powder" and holds GND-* ids. This is the check that
  // catches that class — a file whose name says one thing and whose contents say another.
  for (const f of F.ALL) {
    if (!f.file) continue;
    const doc = JSON.parse(readFileSync(new URL(`units/${f.file}.units.json`, CONTENT), 'utf8'));
    assert.equal(doc.faction, f.name,
      `${f.file}.units.json declares faction "${doc.faction}" but the registry assigns it to "${f.name}"`);
    for (const id of Object.keys(doc.units || {})) {
      assert.equal(id.slice(0, id.indexOf('-')), f.prefix,
        `${f.file}.units.json contains ${id}, which is not a ${f.prefix}-* unit`);
    }
  }
});

test('every voice key resolves in voicepacks.json', () => {
  const packs = JSON.parse(readFileSync(new URL('dialog/voicepacks.json', CONTENT), 'utf8'));
  for (const f of F.FACTIONS) {
    assert.ok(packs.factions && packs.factions[f.voice],
      `${f.name} declares voice key "${f.voice}", absent from voicepacks.json`);
  }
});

test('lookup works by every spelling, and factionOfUnitId reads a real id', () => {
  const g = F.BY_KEY.get('ground');
  assert.equal(F.find('Ground / Powder'), g);
  assert.equal(F.find('ground'), g);
  assert.equal(F.find('GND'), g);
  assert.equal(F.find('nonsense'), null);

  assert.equal(F.factionOfUnitId('GND-Tanks'), g);
  assert.equal(F.factionOfUnitId('SPC-Planes'), F.BY_KEY.get('space'));
  // the orphan that started all this: authored SPA-*, but Space Tech is SPC-*
  assert.equal(F.factionOfUnitId('SPA-U3'), null, 'SPA is not a real prefix — that is the bug');
  assert.equal(F.factionOfUnitId('abrams'), null, 'no prefix at all');

  assert.equal(F.fileOf('Ground / Powder'), 'ground-powder.units.json');
  assert.equal(F.fileOf('Artillery'), null, 'Artillery has no valid art file yet — see GGG-4');
});

test('every unit id in tables.js resolves to a faction', () => {
  for (const id of Object.keys(UNITS)) {
    assert.ok(F.factionOfUnitId(id), `${id} has no recognised faction prefix`);
  }
  for (const id of Object.keys(SYSTEM_UNITS)) {
    assert.ok(F.factionOfUnitId(id), `${id} has no recognised faction prefix`);
  }
});
