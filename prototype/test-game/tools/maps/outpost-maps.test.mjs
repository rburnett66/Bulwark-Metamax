// tools/maps/outpost-maps.test.mjs — every shipped outpost map is its planet's authored layout on its planet's recipe,
// and the Forge's export agrees with the node stamp [MM-story_mw5oeatc_l]. Tech plan docs/tech-plan/Outpost.md §6.6.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPOST_LAYOUTS, layoutFor, stampFor } from './outpost-maps.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (planet) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/maps/forge', `${planet}-outpost.json`), 'utf8'));

test('each authored outpost layout ships as content/maps/forge/<planet>-outpost.json, on its planet recipe', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const m = read(planet), L = layoutFor(planet);
    assert.equal(m._tool, 'terrain-forge');
    assert.equal(m.planet, planet);
    assert.deepEqual(m.types, L.recipe.types, `${planet}: the ${L.name} recipe`);
    assert.deepEqual(m.water, L.recipe.water);
    assert.deepEqual(m.pads, L.pads);
    assert.deepEqual(m.deposits, L.deposits);
    assert.deepEqual(m.conduits, L.conduits);
    assert.deepEqual(m.kitDefenses, L.kitDefenses);
    assert.deepEqual(m.mesa, L.mesa);
    assert.deepEqual(m.spawns, L.lanes);
    assert.ok(m.decor.length > 0 && m.resources.length > 0, 'decor and surface resource fields from the Forge');
  }
});

test('the Forge export and the node stamp agree cell for cell (terrain and heights)', () => {
  for (const planet of Object.keys(OUTPOST_LAYOUTS)) {
    const m = read(planet), { g, problems } = stampFor(planet, m.seed);
    assert.deepEqual(problems, []);
    assert.deepEqual(m.terrain, Array.from(g.terrain));
    assert.deepEqual(m.heights, Array.from(g.heights));
    // the Forge only ADDS blocking (blocking decor) — never on the mesa top, ramps, tracks or clearings
    for (let i = 0; i < m.blocking.length; i++) {
      if (g.blocking[i]) assert.equal(m.blocking[i], 1);
      if (g.clear[i]) assert.equal(m.blocking[i], 0, `cell ${i} is kept clear`);
    }
  }
});
