// Owner 2026-11-17 [MM-story_mwlcxqzo_8]: "As long as the terrain is flat, player should be able to place structures
// and see the terrain cleared." Trees and rocks on level ground take a building and are cleared by it, for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost } from './model.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { raidSimMap } from './raid.js';
import { clearableIndex, clearedCells, withClearing } from './clearing.js';
import { validatePlacement } from '../sim/structures.js';
import { applyCommand } from '../sim/core.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { outpostBattleMap } from './view/outpostBoard.js';
import { renderMapFor } from '../render3d/ground/synthTerrain.js';
import { planObstructions } from '../render3d/obstructions/placement.js';

const W = map.width;
const cellsOf = (code) => map.terrain.map((t, i) => (t === code ? i : -1)).filter((i) => i >= 0);
const footprint = (c, w = 2, h = 2) => { const out = []; for (let y = c.y; y < c.y + h; y++) for (let x = c.x; x < c.x + w; x++) out.push(y * W + x); return out; };

test('clearable: trees and rocks on level ground; never water or a cliff', () => {
  const trees = cellsOf(TERRAIN.TREES);
  assert.ok(trees.length > 10, 'the outpost map has trees');
  assert.ok(trees.every((i) => clearableIndex(map, i)));
  for (const code of [TERRAIN.WATER, TERRAIN.CLIFF, TERRAIN.CLIFF_BORDER, TERRAIN.GRASS]) {
    assert.ok(cellsOf(code).every((i) => !clearableIndex(map, i)), 'code ' + code);
  }
});

/** A spot where a Storage Tower may now stand that covers tree cells (it would have been refused before). */
function treeSpot(state) {
  const sim = new Set(state.map.blockedCells.map((q) => q.y * W + q.x));
  const trees = new Set(cellsOf(TERRAIN.TREES).filter((i) => sim.has(i)));   // trees the live board blocks
  for (let y = 0; y < map.height - 1; y++) for (let x = 0; x < W - 1; x++) {
    const c = { x, y };
    if (!footprint(c).some((i) => trees.has(i))) continue;
    if (validatePlacement(state, 'OUT-storage', c).ok) return c;
  }
  return null;
}

test('a building goes up on trees; the save keeps them cleared, the raid board walks there once it is gone', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const c = treeSpot(state);
  assert.ok(c, 'some blocking trees can be built on');
  const { state: plain } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  plain.clearable = null;
  assert.equal(validatePlacement(plain, 'OUT-storage', c).reason, 'blocked by rocks or trees', 'refused before this change');
  const water = cellsOf(TERRAIN.WATER)[0];
  assert.match(validatePlacement(state, 'OUT-mg', { x: water % W, y: Math.floor(water / W) }).reason, /water/, 'water never');
  assert.ok(applyCommand(state, { type: 'place', structId: 'OUT-storage', cell: c }).ok);
  const saved = fromLiveSim(state, link, T0).outpost;
  const cut = footprint(c).filter((i) => clearableIndex(map, i));
  assert.ok(cut.length > 0);
  assert.deepEqual(saved.cleared, cut, 'the tree cells under it are cleared');
  // sold: the trees stay cut down, and raiders may walk there
  const pad = Object.keys(saved.building.length ? {} : saved.pads).find((id) => saved.pads[id].at && saved.pads[id].at.x === c.x)
    || saved.building.find((j) => j.at && j.at.x === c.x).pad;
  const sold = { ...saved, pads: { ...saved.pads }, building: saved.building.filter((j) => j.pad !== pad) };
  delete sold.pads[pad];
  assert.deepEqual(clearedCells(sold, map), cut, 'still cleared once it is gone');
  const board = raidSimMap(sold, map), blocked = new Set(board.blockedCells.map((q) => q.y * W + q.x));
  assert.ok(cut.every((i) => !blocked.has(i)), 'open ground on the raid board');
  const before = new Set(raidSimMap(o, map).blockedCells.map((q) => q.y * W + q.x));
  assert.ok(cut.some((i) => before.has(i)), 'they were blocking before');
});

test('a visit with nothing built on trees saves no cleared field', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  assert.equal(withClearing(o, map), o);
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  assert.equal('cleared' in fromLiveSim(state, link, T0).outpost, false);
});

test('the 3D view: a cleared tree cell draws no tree; uncleared trees stay', () => {
  const forge = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
  const gm = renderMapFor(outpostBattleMap(map));
  const cols = gm.cols, at = (t) => Math.floor(t.z) * cols + Math.floor(t.x);
  const full = planObstructions(gm, { plants: 1 });
  const blocked = new Set((gm.blockedCells || []).map((q) => q.y * cols + q.x));
  const treeCells = [...new Set(full.trees.map(at))].filter((i) => blocked.has(i)).slice(0, 6);
  assert.ok(treeCells.length > 0 && forge, 'blocked tree cells with trees');
  const cut = planObstructions(gm, { plants: 1, cleared: new Set(treeCells) });
  assert.ok(cut.trees.every((t) => !treeCells.includes(at(t))), 'none on the cleared cells');
  assert.equal(cut.trees.length, full.trees.filter((t) => !treeCells.includes(at(t))).length, 'every other tree stays');
  const scene = readFileSync(new URL('./view/outpostScene.js', import.meta.url), 'utf8');
  assert.match(scene, /const cells = \[\.\.\.\(o\.cleared \|\| \[\]\)\];/, 'the saved clearing is drawn');
  assert.match(scene, /!\(map\.blocking && map\.blocking\[i\]\) \|\| clearableIndex\(map, i\)/, 'water and cliffs keep their pieces');
});
