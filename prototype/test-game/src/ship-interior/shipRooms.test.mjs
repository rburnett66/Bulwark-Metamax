// Every capital ship has every neutral room plus its own faction's room (owner 2026-11-09). Capital-Ship-Interior.md §5.5.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validateLayout, isLocked } from './layout.js';
import { factionShipLayout, FACTION_ROOMS, NEUTRAL_ROOMS, FACTION_SLOT } from './shipRooms.js';

const BASE = JSON.parse(readFileSync(new URL('../../content/ships/collective/ship-layout.json', import.meta.url), 'utf8'));
const REG = createRequire(import.meta.url)('../data/factions.js');
const FACS = new Set(REG.ALL.map((f) => f.key));
const PRESET_SRC = readFileSync(new URL('./primitiveRooms.js', import.meta.url), 'utf8');

test('every faction has its own room with a prop preset, and the Long Ledger has every neutral room', () => {
  assert.deepEqual(Object.keys(FACTION_ROOMS).sort(), REG.COMBAT_FACTIONS.map((f) => f.key).sort());
  for (const [k, r] of Object.entries(FACTION_ROOMS)) assert.match(PRESET_SRC, new RegExp(`\\n  ${r.props}\\(B, R\\)`), `${k}: preset ${r.props}`);
  for (const id of [...NEUTRAL_ROOMS, FACTION_SLOT]) assert.ok(BASE.rooms.some((r) => r.id === id), id);
});

for (const f of REG.COMBAT_FACTIONS) {
  test(`${f.name}'s ship: all neutral rooms, its own room, no other faction's room, nothing sealed`, () => {
    const L = factionShipLayout(BASE, f.key, f.name);
    assert.deepEqual(validateLayout(L, { factions: FACS }).errors, []);
    const ids = L.rooms.map((r) => r.id);
    for (const id of NEUTRAL_ROOMS) assert.ok(ids.includes(id), `${id} missing`);
    assert.ok(ids.includes(FACTION_ROOMS[f.key].id), 'its own room');
    for (const [k, r] of Object.entries(FACTION_ROOMS)) if (k !== f.key) assert.ok(!ids.includes(r.id), `${r.name} belongs on the ${k} ship`);
    assert.equal(ids.length, NEUTRAL_ROOMS.length + 1);
    assert.ok(L.rooms.every((r) => r.fac === f.key), 'crewed by the host');
    assert.ok(L.rooms.every((r) => !isLocked(r, {})), 'nothing sealed');
    assert.ok(L.rooms.every((r) => r.who.endsWith(f.name)), 'labels name the host faction');
  });
}

test('the Chapel is aboard the Arcane ship only; the base layout is not changed', () => {
  const before = JSON.stringify(BASE);
  assert.ok(factionShipLayout(BASE, 'arcane', 'Arcane / Energy').rooms.some((r) => r.id === 'chapel'));
  assert.ok(!factionShipLayout(BASE, 'ground', 'Ground / Powder').rooms.some((r) => r.id === 'chapel'));
  assert.equal(JSON.stringify(BASE), before);
});
