// Owner 2026-11-12 [MM-story_mwelxcb8_2]: "in the farm the fully grown fruit looks placeholder, but our game already has
// full detail models". A Fruited plant is its crop's battle resource model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CROPS } from '../../data/farm.js';
import { cropModelDef, CROP_MODEL_SCALE } from './farmLayer.js';
import { resourceModel } from '../../render3d/resources/models.js';

test('every crop has its battle model (planet + tier), so no Fruited plot falls back to the drawn head', () => {
  assert.equal(CROPS.length, 36);
  for (const c of CROPS) {
    const def = cropModelDef(c.id);
    assert.ok(def, c.id + ' has a model');
    assert.equal(def, resourceModel(c.planetKey, c.tier), c.id + ' is the battle\'s own model, not a copy');
  }
  assert.equal(cropModelDef('no-such-crop'), null);
});

test('the model fits a plot spot (half a cell) and the layer draws it with the battle resources\' merge', () => {
  assert.ok(CROP_MODEL_SCALE > 0.4 && CROP_MODEL_SCALE < 0.7);
  const src = readFileSync(new URL('./farmLayer.js', import.meta.url), 'utf8');
  assert.match(src, /mergeResourceModel\(THREE, def, prims\)/);
  assert.match(src, /st === 'fruited' && cropGeometry\(c\.id\)/);
});
