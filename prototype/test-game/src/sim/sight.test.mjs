// Terrain line of sight for the waves (owner 2026-11-07): tree lines and mountains block an attacker's sight; game
// structures never do; flyers see over everything; a board without terrain is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TERRAIN } from '../terrain/terrainGen.js';
import { buildSightGrid, lineClear, attackerSees } from './sight.js';
import { acquireTarget } from './combat.js';
import { buildTerrainMap } from './mapgen.js';
import { createSim } from './core.js';

const COLS = 20, ROWS = 9;
function board(wall) {   // grass, with a vertical strip of `wall` terrain at x = 10
  const terrain = new Array(COLS * ROWS).fill(TERRAIN.GRASS);
  if (wall != null) for (let y = 0; y < ROWS; y++) terrain[y * COLS + 10] = wall;
  return { cols: COLS, rows: ROWS, terrain };
}
const artillery = (x, y, domain = 'Walker') => ({ id: 1, side: 'attacker', domain, pos: { x, y }, range: 9.5, targetsBase: false, hp: 10 });
const tower = (x, y) => ({ id: 50, structId: 'STR-Cannon', hp: 100, lifecycle: 'Complete', pos: { x, y } });
const stateOf = (map, shooter, s) => ({ map, sightGrid: buildSightGrid(map), units: new Map([[shooter.id, shooter]]), structures: new Map([[s.id, s]]), base: null });

test('trees and cliffs block sight; rocks, brush and water do not', () => {
  for (const t of [TERRAIN.TREES, TERRAIN.TREE_BORDER, TERRAIN.CLIFF, TERRAIN.CLIFF_BORDER])
    assert.equal(lineClear(buildSightGrid(board(t)), { x: 5, y: 4 }, { x: 14, y: 4 }), false, 'terrain ' + t);
  for (const t of [TERRAIN.ROCKS, TERRAIN.BRUSH, TERRAIN.WATER, TERRAIN.DIRT])
    assert.equal(buildSightGrid(board(t)), null, 'terrain ' + t + ' makes no sight map');
});

test('an artillery piece cannot target a tower behind a tree line, and can in the open', () => {
  const a = artillery(5, 4), s = tower(14, 4);
  assert.equal(acquireTarget(stateOf(board(TERRAIN.TREES), a, s), a), null);
  assert.equal(acquireTarget(stateOf(board(null), a, s), a), 50);
});

test('the shooter and target cells never block their own line, and a line beside the wall is clear', () => {
  const g = buildSightGrid(board(TERRAIN.TREES));
  assert.equal(lineClear(g, { x: 10, y: 4 }, { x: 15, y: 4 }), true, 'standing in the trees');
  assert.equal(lineClear(g, { x: 3, y: 2 }, { x: 8, y: 7 }), true, 'line stays left of the wall');
});

test('flyers see over the trees; defenders and the base are not limited', () => {
  const st = stateOf(board(TERRAIN.TREES), artillery(5, 4), tower(14, 4));
  assert.equal(attackerSees(st, artillery(5, 4, 'Flyer'), tower(14, 4)), true);
  assert.equal(attackerSees(st, artillery(5, 4), { pos: { x: 14, y: 4 }, domain: 'Flyer' }), true);
  assert.equal(attackerSees(st, { side: 'defender', pos: { x: 5, y: 4 }, domain: 'Walker' }, artillery(14, 4)), true);
  st.base = { pos: { x: 14, y: 4 } };
  assert.equal(attackerSees(st, artillery(5, 4), st.base), true);
});

test('structures never change the sight map', () => {
  const forge = JSON.parse(readFileSync(new URL('../../content/maps/forge/artillery-map-3.json', import.meta.url)));
  const map = buildTerrainMap(forge, 3, { seed: 0 });
  const s = createSim(1, { map, waves: [] });
  assert.ok(s.sightGrid && s.sightGrid.cells.some((c) => c === 1), 'the map has blocking terrain');
  const before = Buffer.from(s.sightGrid.cells).toString('hex');
  s.structures.set(999, tower(map.base.x + 3, map.base.y));
  assert.equal(Buffer.from(buildSightGrid(s.map).cells).toString('hex'), before);
});
