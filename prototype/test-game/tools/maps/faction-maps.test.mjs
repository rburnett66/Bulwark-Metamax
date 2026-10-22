// tools/maps/faction-maps.test.mjs — every faction's map 1 is its own planet's map and passes the fairness guardrails
// [MM-story_mvjw67lo_f]. Spec: Faction-Terrain-Design §1 (guardrails), §2.3 (recipes). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES, evaluate, passes } from './faction-maps.mjs';
import { checkLevelAgainstMap } from '../../src/render3d/level.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = path.join(ROOT, 'content/maps/forge'), BAKED = path.join(ROOT, 'content/maps/baked');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('all eight non-Powder factions ship their OWN map 1, built from their planet recipe (no Powder copies left)', () => {
  const powder = read(path.join(FORGE, 'powder-map-1.json'));
  assert.equal(Object.keys(RECIPES).length, 8);
  for (const [slug, rc] of Object.entries(RECIPES)) {
    const m = read(path.join(FORGE, `${slug}-map-1.json`));
    assert.equal(m._copiedFrom, undefined, `${slug}: still a playtest copy`);
    assert.equal(m._tool, 'terrain-forge');
    assert.deepEqual(m.types, rc.types, `${slug}: types = the ${rc.planet} recipe`);
    assert.deepEqual(m.water, rc.water, `${slug}: water = the ${rc.planet} recipe`);
    assert.equal(m.water.mode, 'patches', 'ponds, never rivers (§2.1)');
    assert.notDeepEqual(m.terrain, powder.terrain, `${slug}: a different layout from Powder`);
    assert.deepEqual(m.base, powder.base, 'base at world centre, same gap');
    assert.deepEqual(m.waveWindows, powder.waveWindows, 'same wave windows');
    assert.ok(m.resources.length >= 40, `${slug}: resource fields`);
  }
});

test('every map 1 (Powder included) passes the §1 fairness guardrails on the map the game builds', () => {
  for (const slug of ['powder', ...Object.keys(RECIPES)]) {
    const m = read(path.join(FORGE, `${slug}-map-1.json`));
    const e = evaluate(m);
    const fails = passes(slug in RECIPES ? slug : 'air', e);   // powder: the general rules (no pond rule)
    assert.deepEqual(fails, [], `${slug}: ${fails.join('; ')}`);
    assert.ok(e.impPct >= 12 && e.impPct <= 24);
  }
});

test('Rime (the Water map) gives water units a real pond shortcut that ground units must walk round', () => {
  const e = evaluate(read(path.join(FORGE, 'water-map-1.json')));
  assert.ok(e.shortcutGain >= 0.5, `${(100 * e.shortcutGain).toFixed(0)}% of ground spawns gain by swimming`);
  assert.ok(e.shortcutMean <= 0.88, `water route / ground route = ${e.shortcutMean.toFixed(2)}`);
  assert.ok(e.ponds >= 6, `${e.ponds} ponds`);
});

test('every new map has a committed baked 3D level that matches what the sim builds', () => {
  for (const slug of Object.keys(RECIPES)) {
    const dir = path.join(BAKED, `${slug}-map-1`);
    for (const f of ['level.json', 'road_mask.png', 'routes.json']) assert.ok(fs.existsSync(path.join(dir, f)), `${slug}: ${f}`);
    const { map } = evaluate(read(path.join(FORGE, `${slug}-map-1.json`)));
    const check = checkLevelAgainstMap(read(path.join(dir, 'level.json')), map);
    assert.ok(check.ok, `${slug}: ${check.problems.join('; ')}`);
  }
});
