/**
 * addunit-id.test.mjs — "+ Add unit" must never propose or accept an id that already exists.
 *
 * WHY THIS EXISTS. The proposal used to be `${prefix}-U${roster.length + 1}`, which is only free while
 * ids are a dense 1..N run. Remove-a-unit (DDD-5, PR #21) means they routinely are not: delete GND-U3
 * from GND-U1..GND-U5 and the length drops to 4, so the next add proposed GND-U5 — an existing unit.
 * The guard then read `if (!roster.some(...)) roster.push(...)` and called selectUnit(id) regardless, so
 * a collision silently OPENED that unit; the work that followed was autosaved back over the original.
 * Owner-reported as "+ Add unit is corrupting an existing unit in some cases".
 *
 * stack-forge.js is a classic browser script, not a module — there is nothing to import. So this reads
 * the shipped file and evaluates the two helpers out of it. That is deliberate: a copy of the logic here
 * would drift from the file the browser actually loads, and this is exactly the kind of bug that hides
 * in that gap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'stack-forge.js'), 'utf8');

/** pull a top-level `function name(...) { ... }` out of the source by brace matching */
function extract(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start > -1, `${name} not found in stack-forge.js — was it renamed?`);
  let depth = 0, i = SRC.indexOf('{', start);
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return SRC.slice(start, i);
}

/** `roster` is a module-scope binding in the real file; inject it as a parameter here. */
const load = (name) => new Function('roster', `${extract(name)}; return ${name};`);

test('THE REGRESSION: after deleting U3 from U1..U5, the proposal is not the existing U5', () => {
  const roster = [{ id: 'GND-U1' }, { id: 'GND-U2' }, { id: 'GND-U4' }, { id: 'GND-U5' }];
  const proposed = load('freeUnitId')(roster)('GND');
  assert.notEqual(proposed, 'GND-U5', 'roster.length + 1 lands on an existing unit here');
  assert.ok(!roster.some((u) => u.id === proposed), 'a proposal must never already exist');
});

test('freeUnitId fills the hole a delete left', () => {
  const roster = [{ id: 'GND-U1' }, { id: 'GND-U2' }, { id: 'GND-U4' }, { id: 'GND-U5' }];
  assert.equal(load('freeUnitId')(roster)('GND'), 'GND-U3');
});

test('freeUnitId copes with non-sequential ids', () => {
  assert.equal(load('freeUnitId')([{ id: 'GND-abrams' }, { id: 'GND-U1' }])('GND'), 'GND-U2');
});

test('freeUnitId starts at U1 on an empty roster', () => {
  assert.equal(load('freeUnitId')([])('GND'), 'GND-U1');
});

test('another faction does not consume this one\'s ids', () => {
  assert.equal(load('freeUnitId')([{ id: 'SPC-U1' }, { id: 'SPC-U2' }])('GND'), 'GND-U1');
});

test('a full 1..N run rolls to N+1', () => {
  const roster = Array.from({ length: 6 }, (_, i) => ({ id: `GND-U${i + 1}` }));
  assert.equal(load('freeUnitId')(roster)('GND'), 'GND-U7');
});

test('freeDecorId skips taken decor ids', () => {
  assert.equal(load('freeDecorId')([{ id: 'decor-1' }, { id: 'decor-2' }, { id: 'decor-4' }])(), 'decor-3');
});

test('the collision guard rejects rather than falling through to selectUnit', () => {
  // Structural: both add paths must REFUSE a duplicate. The old shape pushed conditionally and then
  // called selectUnit unconditionally, which is what opened someone else's unit.
  const addUnit = SRC.slice(SRC.indexOf("$('addUnit').onclick"), SRC.indexOf('function clearSourceArt'));
  assert.ok(/already exists/.test(addUnit), 'no duplicate-id refusal found in the add-unit handler');
  assert.ok(!/if \(!roster\.some\(\(u\) => u\.id === id\)\) roster\.push/.test(addUnit),
    'the silent conditional-push shape is back — a collision would fall through to selectUnit again');
});
