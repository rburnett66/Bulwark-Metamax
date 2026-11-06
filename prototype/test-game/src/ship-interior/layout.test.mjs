// The Long Ledger's layout, validated and derived [MM-story_mw47laf1_2]. Capital-Ship-Interior.md §3.1–3.2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prepareLayout, validateLayout, isLocked, toWorld } from './layout.js';

const JSON_ = JSON.parse(readFileSync(new URL('../../content/ships/collective/ship-layout.json', import.meta.url), 'utf8'));
const REG = createRequire(import.meta.url)('../data/factions.js');
const FACS = new Set(REG.ALL.map((f) => f.key));

test('the committed Collective layout is valid: the prototype\'s seven rooms on three decks', () => {
  const v = validateLayout(JSON_, { factions: FACS });
  assert.deepEqual(v.errors, []);
  const L = prepareLayout(JSON_, { factions: FACS });
  assert.deepEqual(L.rooms.map((r) => r.id), ['helm', 'chapel', 'armory', 'bar', 'trade', 'loading', 'eng']);
  assert.deepEqual(L.rooms.map((r) => r.floor), [0, 0, 1, 1, 2, 2, 2]);
  for (const r of L.rooms) assert.equal(r.fy, JSON_.floors[r.floor]);
  assert.ok(L.rooms.every((r) => r.props), 'every room names a prop preset');
});

test('lanes span each deck and doors sit between same-deck neighbours', () => {
  const L = prepareLayout(JSON_);
  assert.equal(L.lanes.length, 3);
  for (const lane of L.lanes) assert.ok(lane.x1 > lane.x0 + 20, `deck ${lane.floor + 1} lane`);
  const pairs = L.doors.map((d) => `${d.left}|${d.right}`).sort();
  assert.deepEqual(pairs, ['armory|bar', 'helm|chapel', 'loading|eng', 'trade|loading'].sort());
});

test('validation catches overlaps, stray stand spots, unknown factions and bad locks', () => {
  const bad = structuredClone(JSON_);
  bad.rooms[3].x = 40;                         // the bar slides into the armory
  bad.rooms[0].fx = 90;                        // the helm's stand spot leaves the helm
  bad.rooms[1].unlock = { fac: 'nobody', need: 'Adored' };
  bad.rooms.push({ ...bad.rooms[2] });         // duplicate id
  const v = validateLayout(bad, { factions: FACS });
  assert.equal(v.ok, false);
  const all = v.errors.join('\n');
  for (const s of ['armory and bar overlap', 'stand spot', 'unknown unlock faction nobody', 'unknown standing Adored', 'duplicate id']) {
    assert.ok(all.includes(s), `expected "${s}" in:\n${all}`);
  }
});

test('locks read standing; the world maps % to the 100 × 56.25 stage', () => {
  const L = prepareLayout(JSON_);
  const chapel = L.rooms.find((r) => r.id === 'chapel');
  assert.equal(isLocked(chapel, {}), true, 'Neutral is below Trusted');
  assert.equal(isLocked(chapel, { arcane: 'Trusted' }), false);
  assert.equal(isLocked(L.rooms.find((r) => r.id === 'bar'), {}), false);
  assert.deepEqual(toWorld(50, 50), [0, 0]);
  assert.deepEqual(toWorld(0, 0), [-50, 28.125]);
});
