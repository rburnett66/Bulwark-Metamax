// tools/maps/outpost-maps.test.mjs — every shipped outpost map is made like the large tower-defense maps (owner
// 2026-11-07): 64 × 32 world mode on its planet's recipe, inside the §1 guardrails, the Forge's export, in step with its
// baked 3D level — with the authored outpost layer on top [MM-story_mw5oeatc_l]. Same shape as faction-maps.test.mjs.
// O11 [MM-story_mw5oeob4_s]: all nine planets ship one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPOST_LAYOUTS, layoutFor, outpostForgeFor, outpostChecks } from './outpost-maps.mjs';
import { checkLevelAgainstMap } from '../../src/render3d/level.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = path.join(ROOT, 'content/maps/forge'), BAKED = path.join(ROOT, 'content/maps/baked');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const POWDER = read(path.join(FORGE, 'powder-map-1.json'));

test('every planet has an outpost layout and a shipped outpost map', async () => {
  const { PLANETS } = await import('../../src/data/planets.js');
  assert.deepEqual(Object.keys(OUTPOST_LAYOUTS).sort(), Object.keys(PLANETS).sort());
  for (const planet of Object.keys(PLANETS)) assert.ok(fs.existsSync(path.join(FORGE, `${planet}-outpost.json`)), planet);
});

test('each outpost map is a large map on its planet recipe: 64 × 32, world mode, the same base and wave windows', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const m = read(path.join(FORGE, `${planet}-outpost.json`)), L = layoutFor(planet);
    assert.equal(m._tool, 'terrain-forge');
    assert.equal(m.planet, planet);
    assert.equal(m.cols, 64); assert.equal(m.rows, 32); assert.equal(m.worldMode, true);
    assert.deepEqual(m.types, L.recipe.types, `${planet}: the ${L.recipe.planet} recipe`);
    assert.deepEqual(m.water, L.recipe.water);
    assert.equal(m.water.mode, 'patches', 'ponds, never rivers (§2.1)');
    assert.deepEqual(m.base, POWDER.base, 'the large maps\' base, which is the hub');
    assert.deepEqual(m.waveWindows, POWDER.waveWindows);
    assert.ok(m.resources.length >= 40, `${planet}: resource fields (${m.resources.length})`);
    // decor like the planet's own battle maps: the recipe decides how much (Kessra's dust has next to none)
    const battle = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => read(path.join(FORGE, `${L.slug}-map-${n}.json`)).decor.length).sort((a, b) => a - b);
    assert.ok(m.decor.length >= Math.floor(battle[4] / 2), `${planet}: decor groves (${m.decor.length}; its battle maps' median ${battle[4]})`);
    // the authored outpost layer, unchanged by the Forge
    for (const k of ['pads', 'deposits', 'conduits', 'kitDefenses', 'mesa']) assert.deepEqual(m[k], L[k], `${planet}: ${k}`);
    assert.deepEqual(m.spawns, L.lanes, 'the raid lanes are the spawns');
  }
});

test('each outpost map passes the §1 guardrails (where they apply) and validateOutpostLayout', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const { e, fails } = outpostChecks(read(path.join(FORGE, `${planet}-outpost.json`)));
    assert.deepEqual(fails, [], planet);
    assert.ok(e.impPct >= 12 && e.impPct <= 24, `${planet}: ${e.impPct.toFixed(1)}% impassable`);
    assert.equal(e.unreachable, 0);
  }
});

test('the Forge export and the node generator agree cell for cell (the mesa is in the terrain)', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const m = read(path.join(FORGE, `${planet}-outpost.json`)), { forge, g } = outpostForgeFor(planet, m.seed);
    assert.deepEqual(m.terrain, forge.terrain);
    assert.deepEqual(m.heights, forge.heights);
    // the Forge only ADDS blocking (blocking decor) — never on the mesa top, ramps, tracks or clearings
    for (let i = 0; i < m.blocking.length; i++) {
      if (g.blocking[i]) assert.equal(m.blocking[i], 1);
      if (g.clear[i]) assert.equal(m.blocking[i], 0, `cell ${i} is kept clear`);
    }
  }
});

test('each outpost map has a committed baked 3D level that matches what the sim builds', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const name = `${planet}-outpost`, dir = path.join(BAKED, name);
    for (const f of ['level.json', 'road_mask.png', 'routes.json']) assert.ok(fs.existsSync(path.join(dir, f)), `${name}: ${f}`);
    const { e } = outpostChecks(read(path.join(FORGE, `${name}.json`)));
    const level = read(path.join(dir, 'level.json'));
    const check = checkLevelAgainstMap(level, e.map);
    assert.ok(check.ok, `${name}: ${check.problems.join('; ')}`);
    assert.deepEqual(level.terrain, read(path.join(FORGE, `${name}.json`)).terrain, 'the bake draws the stamped mesa');
  }
});
