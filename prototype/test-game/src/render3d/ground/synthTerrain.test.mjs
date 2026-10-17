// [MM-story_mvbr0oo5_n] every map gets 3D ground: workbook maps (no terrain codes) derive theirs from their layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainFor, renderMapFor } from './synthTerrain.js';
import { TERRAIN } from '../../terrain/terrainGen.js';
import { buildCampaignMap } from '../../sim/mapgen.js';
import { planObstructions } from '../obstructions/placement.js';

test('workbook campaign maps get terrain codes from their own layout; the sim map is untouched', () => {
  for (const id of [2, 5, 9]) {
    const map = buildCampaignMap(id, { seed: 0 });
    assert.equal(map.terrain, undefined, `map ${id}: the workbook generator carries no terrain codes`);
    const rm = renderMapFor(map);
    assert.notEqual(rm, map, 'a render copy');
    assert.equal(map.terrain, undefined, 'the sim map is not mutated');
    assert.equal(rm.terrain.length, map.cols * map.rows);
    for (const c of map.waterCells) assert.equal(rm.terrain[c.y * map.cols + c.x], TERRAIN.WATER, `map ${id}: water stays water`);
    const pa = map.playArea;
    assert.equal(rm.terrain[0], TERRAIN.BRUSH, 'the approach border reads as brush');
    const b = map.base;
    assert.equal(rm.terrain[b.y * map.cols + b.x], TERRAIN.GRASS, 'open ground at the base');
    assert.ok(pa.x0 > 0);
    planObstructions(rm);   // the obstruction planner runs on it
  }
});

test('forge maps keep their own codes (same array, same object)', () => {
  const map = { cols: 2, rows: 1, terrain: [TERRAIN.TREES, TERRAIN.GRASS] };
  assert.equal(terrainFor(map), map.terrain);
  assert.equal(renderMapFor(map), map);
});
