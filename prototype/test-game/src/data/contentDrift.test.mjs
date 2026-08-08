// Fields the art pipeline COPIES out of tables.js, checked for drift.
//
// WHY THIS EXISTS NOW. DDD-7/DDD-9 made `shape` and `role` inert in the sim and the renderer — every
// behaviour they carried became a typed field, and renaming them changes nothing. That was proven by
// renaming every shape and role to nonsense and watching the suite stay green with battle hashes
// bit-identical.
//
// But `bench.js:266` WRITES `shape` and `role` into the saved art JSON, and `unitArt.js:33` reads them
// back out of `content/units/*.units.json`. Nothing dispatches on them — `buildUnitSprite` never touches
// `def.shape` — so they are labels. They are also COPIES, taken at authoring time, of values that live
// in tables.js. Rename a shape there and every art file on disk keeps saying the old one, with nothing
// to notice.
//
// EEE-5 (the unit-type model) is unblocked precisely BECAUSE renaming is now safe, and the first thing
// it does is rename shapes to readable generic type names. This gate is what makes that rename visible
// instead of silent.
//
// WHY A GATE RATHER THAN DELETING THE FIELDS. Measured across the real content: of 35 entries carrying
// `shape`, the 24 real units agree with tables.js EXACTLY, and all 11 disagreements are SYS-* — where
// SYSTEM_UNITS carries no `shape` at all and the art file supplies its own category ("Structure").
// So it is a copy for units and art-authored for structures. Deleting it would throw away a real
// art-side field to fix a problem that only exists on the copied half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { UNITS, SYSTEM_UNITS } from './tables.js';

const CONTENT = new URL('../../content/units/', import.meta.url);
const defOf = (id) => UNITS[id] || SYSTEM_UNITS[id] || null;

function eachAuthoredUnit(fn) {
  for (const file of readdirSync(CONTENT).filter((f) => f.endsWith('.units.json'))) {
    const doc = JSON.parse(readFileSync(new URL(file, CONTENT), 'utf8'));
    for (const [id, entry] of Object.entries(doc.units || {})) fn(file, id, entry, defOf(id));
  }
}

test('a copied `shape` still matches tables.js — this is what a rename will trip', () => {
  // Scoped to units whose def HAS a shape. SYS-* deliberately excluded below, with its own assertion,
  // rather than loosening this one until it catches nothing.
  const drift = [];
  eachAuthoredUnit((file, id, entry, def) => {
    if (!entry.shape || !def || !def.shape) return;
    if (def.shape !== entry.shape) {
      drift.push(`${file} ${id}: art says ${JSON.stringify(entry.shape)}, tables.js says ${JSON.stringify(def.shape)}`);
    }
  });
  assert.deepEqual(drift, [],
    `art JSON has drifted from tables.js. If you just renamed a shape, the art files need the same edit:\n  ${drift.join('\n  ')}`);
});

test('a copied `role` still matches tables.js', () => {
  const drift = [];
  eachAuthoredUnit((file, id, entry, def) => {
    if (!entry.role || !def || !def.role) return;
    if (def.role !== entry.role) {
      drift.push(`${file} ${id}: art says ${JSON.stringify(entry.role)}, tables.js says ${JSON.stringify(def.role)}`);
    }
  });
  assert.deepEqual(drift, [], `art JSON role has drifted from tables.js:\n  ${drift.join('\n  ')}`);
});

test('SYS-* art supplies its OWN category, and that is deliberate', () => {
  // 11 SYS-* entries say "Structure" or "Trucks" while SYSTEM_UNITS carries no `shape` field at all.
  // That is not drift — there is nothing to drift FROM. Pinning it here so the exclusion above reads as
  // a decision rather than a hole, and so that if SYSTEM_UNITS ever GAINS a shape the mismatch becomes
  // a real failure in the first test instead of staying quietly excluded.
  let artAuthored = 0;
  eachAuthoredUnit((file, id, entry, def) => {
    if (!id.startsWith('SYS-')) return;
    if (entry.shape && def && !def.shape) artAuthored++;
  });
  assert.ok(artAuthored > 0, 'expected SYS-* art to carry categories tables.js does not define');
  for (const id of Object.keys(SYSTEM_UNITS)) {
    assert.equal(SYSTEM_UNITS[id].shape, undefined,
      `${id} now has a shape in tables.js — the SYS exclusion above is no longer safe, tighten it`);
  }
});

test('every authored unit resolves to a def — art for a unit that does not exist is dead weight', () => {
  const orphans = [];
  eachAuthoredUnit((file, id, entry, def) => { if (!def) orphans.push(`${file} ${id}`); });
  assert.deepEqual(orphans, [],
    `content/units/ has art for ids with no unit def:\n  ${orphans.join('\n  ')}`);
});

test('nothing in the RENDER path reads the copied fields — they are labels, and must stay labels', () => {
  // The reason a drift gate is sufficient rather than a migration. If buildUnitSprite ever starts
  // reading `shape`, a stale copy stops being cosmetic and this test should fail loudly first.
  const src = readFileSync(new URL('../render/unitArt.js', import.meta.url), 'utf8');
  const body = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const reads = body.match(/def\.shape|def\.role/g) || [];
  assert.deepEqual(reads, [],
    'unitArt.js now reads a copied field for behaviour — a drift gate is no longer enough, migrate instead');
});
