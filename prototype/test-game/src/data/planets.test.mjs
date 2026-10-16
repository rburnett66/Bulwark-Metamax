// [MM-story_mva7wn9l_t] — every faction has exactly one homeworld, and its baked image ships with the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANETS, planetImage } from './planets.js';
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEYS = REG.FACTIONS.map((f) => f.key);

test('one planet per faction, keyed by the registry key, and no strays', () => {
  assert.equal(KEYS.length, 9);
  assert.deepEqual(Object.keys(PLANETS).sort(), [...KEYS].sort());
  const names = Object.values(PLANETS).map((p) => p.name);
  assert.equal(new Set(names).size, 9, 'planet names are unique');
});

test('each globe is complete enough to bake', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const [k, p] of Object.entries(PLANETS)) {
    assert.ok(p.name && p.type && p.blurb, k);
    assert.match(p.haze, hex, k);
    assert.equal(p.globe.land.length, 4, k);
    assert.equal(p.globe.ocean.length, 2, k);
    for (const c of [...p.globe.land, ...p.globe.ocean, p.globe.dry]) assert.match(c, hex, k);
    assert.ok(p.globe.water >= 0 && p.globe.water <= 1 && p.globe.polar >= 0 && p.globe.polar <= 1, k);
  }
});

test('every planet image is committed: a 256² PNG with transparency', () => {
  for (const k of KEYS) {
    const rel = planetImage(k);
    const buf = fs.readFileSync(path.join(GAME, rel));
    assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', rel);
    assert.equal(buf.readUInt32BE(16), 256, `${rel} width`);
    assert.equal(buf.readUInt32BE(20), 256, `${rel} height`);
    assert.equal(buf[25], 6, `${rel} is RGBA`);
  }
  assert.equal(planetImage('nope'), null);
});
