// Owner 2026-11-12 [MM-story_mwelnbfc_1]: "when I plant a plot with seed pods but I only have 7 pods I should only see
// 7 plants" — 1 pod = 1 plant; the plot draws only the spots it planted, filling row by row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plantSpots } from './farmLayer.js';
import { plotPlants } from '../model.js';

test('a 7-pod plot draws its first 7 spots: one full row of 4, then 3 of the next', () => {
  const p = { x: 0, y: 0, w: 2, h: 2, method: 'traditional', plants: 7 };
  const spots = plantSpots(p).slice(0, plotPlants(p));
  assert.equal(spots.length, 7);
  assert.equal(new Set(spots.slice(0, 4).map(([x]) => x)).size, 1, 'the first four share a row');
  assert.notEqual(spots[4][0], spots[0][0], 'the fifth starts the next row');
});

test('the layer stops at the planted count (stubble after a harvest still covers the plot)', () => {
  const src = readFileSync(new URL('./farmLayer.js', import.meta.url), 'utf8');
  assert.match(src, /const shown = st === 'harvested' \? Infinity : plotPlants\(p\);/);
  assert.match(src, /if \(i >= shown\) break;/);
});
