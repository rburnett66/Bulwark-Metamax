// Build spacing in the shared placement [MM-story_mwc9p8ee_2f] (TECH_PLAN::One-Battle-UX.md §5.1).
// Owner 2026-11-11: one free cell between buildings, the simplest implementation; battle structures keep none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, getStructureDef } from '../data/tables.js';
import { spacingConflict } from './structures.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';

// a 2×2 building that asks for a one-cell lane, and a 1×1 tower that asks for none
const DEFS = { BLD: { spacing: 1, footprint: { w: 2, h: 2 } }, TWR: { footprint: { w: 1, h: 1 } } };
const getDef = (id) => DEFS[id];
const at = (structId, x, y) => ({ structId, pos: { x, y }, footprint: DEFS[structId].footprint });

test('two buildings keep one free cell between them, diagonals included', () => {
  const placed = [at('BLD', 10, 10)];                       // covers x 10-11, y 10-11
  const bld = DEFS.BLD;
  assert.equal(spacingConflict(placed, bld, { x: 12, y: 10 }, getDef), true, 'touching on the right');
  assert.equal(spacingConflict(placed, bld, { x: 13, y: 10 }, getDef), false, 'one free column between');
  assert.equal(spacingConflict(placed, bld, { x: 10, y: 12 }, getDef), true, 'touching below');
  assert.equal(spacingConflict(placed, bld, { x: 10, y: 13 }, getDef), false, 'one free row between');
  assert.equal(spacingConflict(placed, bld, { x: 12, y: 12 }, getDef), true, 'touching corner to corner');
  assert.equal(spacingConflict(placed, bld, { x: 13, y: 13 }, getDef), false, 'one free cell diagonally');
  assert.equal(spacingConflict(placed, bld, { x: 7, y: 10 }, getDef), false, 'one free column on the left');
  assert.equal(spacingConflict(placed, bld, { x: 8, y: 10 }, getDef), true, 'touching on the left');
});

test('the larger spacing of the pair wins: a tower keeps a building\'s lane, two towers may touch', () => {
  assert.equal(spacingConflict([at('BLD', 10, 10)], DEFS.TWR, { x: 12, y: 10 }, getDef), true, 'tower against a building');
  assert.equal(spacingConflict([at('BLD', 10, 10)], DEFS.TWR, { x: 13, y: 10 }, getDef), false);
  assert.equal(spacingConflict([at('TWR', 10, 10)], DEFS.TWR, { x: 11, y: 10 }, getDef), false, 'towers pack tight as before');
  assert.equal(spacingConflict([at('TWR', 10, 10)], DEFS.BLD, { x: 11, y: 10 }, getDef), true, 'a building against a tower');
});

test('every battle structure declares no spacing, so the battle places exactly as before', () => {
  for (const id of Object.keys(STRUCTURES)) {
    assert.ok(!getStructureDef(id).spacing, `${id} keeps spacing 0`);
  }
});

test('the one-cell lane is open ground a harvester drives through', () => {
  const map = { cols: 12, rows: 8 };
  // a wall of buildings across the board with one-cell lanes: x 0-1, lane 2, x 3-4, lane 5, x 6-7, lane 8, x 9-10
  const placed = [];
  for (const x of [0, 3, 6, 9]) for (const y of [0, 2, 4, 6]) placed.push({ ...at('BLD', x, y), footprint: { w: 2, h: 2 } });
  // (stacked rows touch each other here on purpose — only the vertical lanes stay open)
  const nav = buildNavGrid(map, placed.map((s) => ({ ...s, lifecycle: 'Active', hp: 1, maxHp: 1 })));
  const path = findWalkerPath(nav, { x: 2, y: 0 }, { x: 2, y: 7 });
  // the path comes back as waypoints (straight runs collapsed), so check it reaches the far end and never leaves the lane
  assert.ok(path && path.length > 0, 'a harvester finds a way down the lane between the buildings');
  const end = path[path.length - 1];
  assert.deepEqual({ x: end.x, y: end.y }, { x: 2, y: 7 }, 'it reaches the far end');
  assert.ok(path.every((c) => c.x === 2), 'it stays in the lane');
  // and with the lane closed there is no way through: the lane is what lets it pass
  const shut = buildNavGrid(map, placed.concat([{ ...at('TWR', 2, 3), lifecycle: 'Active', hp: 1, maxHp: 1 }]));
  assert.equal(findWalkerPath(shut, { x: 2, y: 0 }, { x: 2, y: 7 }), null, 'a closed lane blocks it');
});
