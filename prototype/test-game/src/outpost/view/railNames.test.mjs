// Owner 2026-11-11: "Building names can be shortened" — the full outpost names overlapped on the phone-width battle rail.
// One short-name table (data/outpostStructures.js RAIL_SHORT_NAME) feeds every rail [MM-subtask_mwcp7vk0_3b].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RAIL_SHORT_NAME, OUTPOST_BUILDING_KINDS, outpostStructId } from '../../data/outpostStructures.js';
import { getStructureDef } from '../../data/tables.js';

test('every buildable outpost building carries a short rail label from the one table', () => {
  for (const kind of OUTPOST_BUILDING_KINDS.filter((k) => k !== 'hub')) {
    const def = getStructureDef(outpostStructId(kind));
    assert.ok(def, kind);
    assert.equal(def.label, RAIL_SHORT_NAME[kind], kind);
    assert.ok(def.label.length <= 9, `${kind}: "${def.label}" fits a phone-width rail tile`);
    assert.notEqual(def.name, def.label, `${kind} keeps its full name for the tooltip`);
  }
});

test('the shared rail shows a def label; the FARM tab reads the same table (no second copy; the old view went in S6)', () => {
  const hud = readFileSync(new URL('../../render/hud.js', import.meta.url), 'utf8');
  assert.match(hud, /\|\| def\.label \|\|/);
  const farm = readFileSync(new URL('../../data/farmStructures.js', import.meta.url), 'utf8');
  assert.match(farm, /RAIL_SHORT_NAME\[m\.id\]/);
  assert.match(farm, /RAIL_SHORT_NAME\[b\.kind\]/);
  assert.doesNotMatch(farm, /'IRRIGATED'/, 'no second short-name table');
});
