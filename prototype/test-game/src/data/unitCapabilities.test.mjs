// src/data/unitCapabilities.test.mjs — DDD-7 / DDD-9.
//
// THE GATE. Nine sites used to answer a behavioural question by matching a DISPLAY string — `shape`,
// `role`, or `kind` (which createUnit quietly filled with `shape`, so grepping `.shape` did not even
// find the worst of them). Renaming a unit changed how it fought, how big it was, and whether it drew
// a shot, silently and with no error anywhere.
//
// Each of those behaviours is now an explicit field on the unit def. That only holds if EVERY unit
// declares EVERY field: the moment one is left off, whatever reads it falls back to a default, and a
// silent default is exactly the failure mode this ticket removed. So this file fails the build for a
// def that omits one, or that declares one with the wrong type or an unknown value.
//
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { UNITS, SYSTEM_UNITS } from './tables.js';
import { SHOT_KINDS } from '../render/unitFx.js';

/** Every def that can become a live sim entity via entities.createUnit. */
const SIM_DEFS = { ...UNITS, 'SYS-Harvester': SYSTEM_UNITS['SYS-Harvester'] };

const BOOLEAN_CAPABILITIES = [
  'burnsWhenDamaged',
  'engagesStructuresWhileAdvancing',
  'engagesSoftDefenders',
  'isInfantry',
];

test('every unit declares an explicit, positive collision radius', () => {
  for (const [id, def] of Object.entries(SIM_DEFS)) {
    assert.equal(typeof def.radius, 'number', `${id}: radius must be a number, got ${typeof def.radius}`);
    assert.ok(isFinite(def.radius) && def.radius > 0, `${id}: radius must be finite and positive`);
    // Sanity band — a unit is roughly a tile. Catches a stray 42 or a 0.042 typo, not a retune.
    assert.ok(def.radius >= 0.05 && def.radius <= 2, `${id}: radius ${def.radius} is outside any sane band`);
  }
});

test('every unit declares every boolean capability — no field may be left to a default', () => {
  for (const [id, def] of Object.entries(SIM_DEFS)) {
    for (const field of BOOLEAN_CAPABILITIES) {
      assert.equal(typeof def[field], 'boolean',
        `${id}: ${field} must be declared as a boolean (found ${JSON.stringify(def[field])})`);
    }
  }
});

test('every unit declares projectileFx, and it is a kind the renderer can draw (or null)', () => {
  for (const [id, def] of Object.entries(SIM_DEFS)) {
    assert.ok('projectileFx' in def, `${id}: projectileFx must be declared, even when it is null`);
    const fx = def.projectileFx;
    assert.ok(fx === null || SHOT_KINDS.includes(fx),
      `${id}: projectileFx ${JSON.stringify(fx)} is not null and not one of ${SHOT_KINDS.join('/')}`);
  }
});

test('every unit declares an artClass, and it is a stable lowercase key, not a display name', () => {
  const displayNames = new Set();
  for (const def of Object.values(UNITS)) { displayNames.add(def.shape); displayNames.add(def.role); }

  for (const [id, def] of Object.entries(SIM_DEFS)) {
    assert.equal(typeof def.artClass, 'string', `${id}: artClass must be a string`);
    assert.ok(def.artClass.length > 0, `${id}: artClass must not be empty`);
    // The point of artClass is that it is NOT the label. If someone sets it to the display name the
    // cosmetic tables are keyed on a display string again, one indirection further away.
    assert.ok(!displayNames.has(def.artClass),
      `${id}: artClass "${def.artClass}" is a display name — it must be a stable key of its own`);
    assert.match(def.artClass, /^[a-z][A-Za-z]*$/, `${id}: artClass "${def.artClass}" should be a lowerCamel key`);
  }
});

test('the capabilities actually vary — a table of all-false would pass the checks above and mean nothing', () => {
  const defs = Object.values(UNITS);
  for (const field of BOOLEAN_CAPABILITIES) {
    assert.ok(defs.some((d) => d[field] === true), `no unit has ${field} — the capability is dead`);
    assert.ok(defs.some((d) => d[field] === false), `every unit has ${field} — it is not a capability`);
  }
  const fx = new Set(defs.map((d) => d.projectileFx));
  assert.ok(fx.size > 1, 'every unit draws the same projectile — the field carries no information');
  assert.ok(fx.has(null), 'no unit is silent — the "draws nothing" case is unrepresented');
});

test('shape and role are still there — this ticket demotes them to labels, it does not delete them', () => {
  for (const [id, def] of Object.entries(UNITS)) {
    assert.equal(typeof def.shape, 'string', `${id} lost its display shape`);
    assert.equal(typeof def.role, 'string', `${id} lost its display role`);
  }
});
