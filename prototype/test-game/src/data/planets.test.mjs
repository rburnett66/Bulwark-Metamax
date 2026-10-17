// [MM-story_mva7wn9l_t] — every faction has exactly one homeworld, and its baked image ships with the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANETS, RESOURCE_TIERS, planetImage } from './planets.js';
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

test('every planet has four named resources: common and uncommon for the player, rare and epic for the associate', () => {
  const tiers = ['common', 'uncommon', 'rare', 'epic'];
  assert.deepEqual(Object.keys(RESOURCE_TIERS), tiers);
  assert.equal(RESOURCE_TIERS.uncommon.value, RESOURCE_TIERS.common.value * 2, 'uncommon is worth double');
  assert.deepEqual(tiers.map((t) => RESOURCE_TIERS[t].forAssociate), [false, false, true, true]);
  const all = [];
  for (const [k, p] of Object.entries(PLANETS)) {
    assert.deepEqual(Object.keys(p.resources), tiers, k);
    for (const t of tiers) { assert.ok(p.resources[t].name && p.resources[t].note, `${k}.${t}`); all.push(p.resources[t].name); }
  }
  assert.equal(new Set(all).size, 36, 'all 36 resource names are unique');
});

test('every homeworld names a 3D world palette that exists [MM-task_mvbzgc9n_12]', async () => {
  const { LOWPAL } = await import('../render3d/styles/lowpoly-palettes.js');
  for (const [k, p] of Object.entries(PLANETS)) assert.ok(LOWPAL[p.palette], `${k}: ${p.palette}`);
});

test('every homeworld carries its survey: ui colour, sunlight, terrain notes, faction lore with a real rival [MM-story_mvcnxgt8_13]', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const [k, p] of Object.entries(PLANETS)) {
    assert.match(p.ui, hex, k); assert.match(p.sun, hex, k);
    for (const f of ['trees', 'ground', 'rocks', 'airborne']) assert.ok(p.survey && p.survey[f], `${k}: survey.${f}`);
    for (const f of ['trope', 'identity', 'dmg']) assert.ok(p.faction && p.faction[f], `${k}: faction.${f}`);
    assert.ok(PLANETS[p.faction.beats] && p.faction.beats !== k, `${k}: beats a real other faction`);
  }
});

test('the live globe builds for every homeworld (shared with the PNG bake) [MM-story_mvcnxgt8_13]', async () => {
  const THREE = await import('../../vendor/three.module.js');
  const { makeGlobe, GLOBE_KEYS } = await import('../render3d/planet/globe.js');
  assert.deepEqual(GLOBE_KEYS, Object.keys(PLANETS));
  const geo = new THREE.SphereGeometry(1, 8, 6);
  for (const k of GLOBE_KEYS) {
    const g = makeGlobe(THREE, k, { geo });
    assert.equal(g.root.children.length, 2, k);
    const y0 = g.planet.rotation.y; g.spin(1, 0.5);
    assert.ok(Math.abs(g.planet.rotation.y - y0 - 0.5) < 1e-9, `${k} spins`);
    g.dispose();
  }
});
