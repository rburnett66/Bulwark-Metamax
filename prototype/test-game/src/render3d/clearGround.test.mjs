// Owner 2026-11-17 [MM-task_mwl50yxm_5]: "Would it be possible to add the ability to clear terrain when a building or
// farm plot are dropped? This would include removing rocks and foliage or decor."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
import { outpostMapFromForge } from '../outpost/outpostMap.js';
import { outpostBattleMap } from '../outpost/view/outpostBoard.js';
import { renderMapFor } from './ground/synthTerrain.js';
import { planObstructions, invisibleWalls, onCleared } from './obstructions/placement.js';
import { planTufts, createGroundColour, buildLowPolyGround } from './ground/lowpoly.js';
import { planDecals } from './ground/decals.js';
import { LOWPAL } from './styles/lowpoly-palettes.js';

const forge = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const gm = renderMapFor(outpostBattleMap(outpostMapFromForge(forge, 'ground')));
const cols = gm.cols;
const blocked = new Set((gm.blockedCells || []).map((c) => c.y * cols + c.x));
const cellOf = (x, z) => Math.floor(z) * cols + Math.floor(x);
const pal = LOWPAL.meadow;

// clear every open cell in a wide band of the map: a block of 20 × 10 cells
const band = new Set();
for (let y = 8; y < 18; y++) for (let x = 10; x < 30; x++) band.add(y * cols + x);
const open = (i) => band.has(i) && !blocked.has(i);
const key = (o) => JSON.stringify(o);

test('the cleared-cell test is by the cell a point falls in', () => {
  const s = new Set([3 * cols + 5]);
  assert.equal(onCleared(s, cols, 5.01, 3.99), true);
  assert.equal(onCleared(s, cols, 6.0, 3.5), false);
  assert.equal(onCleared(null, cols, 5.5, 3.5), false);
  assert.equal(onCleared(new Set(), cols, 5.5, 3.5), false);
});

test('obstructions: the clutter on cleared open cells goes, everything else stays exactly where it was', () => {
  const full = planObstructions(gm, { plants: 1 }), cut = planObstructions(gm, { plants: 1, cleared: band });
  for (const k of ['rocks', 'trees', 'plants']) {
    const xz = (r) => [r.x, r.z];
    const kept = full[k].filter((r) => !open(cellOf(...xz(r))));
    assert.deepEqual(cut[k].map(key), kept.map(key), k + ': the same records off the cleared cells, none moved');
    assert.ok(cut[k].every((r) => !open(cellOf(r.x, r.z))), k + ': none left on a cleared open cell');
  }
  const dropped = full.plants.length - cut.plants.length + full.rocks.length - cut.rocks.length;
  assert.ok(dropped > 5, 'the band had clutter to clear (' + dropped + ')');
  assert.deepEqual(invisibleWalls(gm, cut), [], 'a blocked cell keeps its rock / tree (no invisible walls)');
});

test('grass tufts and decals: none on a cleared cell, the rest unmoved', () => {
  const colAt = createGroundColour(gm, pal);
  const tf = planTufts(gm, pal, () => 0, colAt), tc = planTufts(gm, pal, () => 0, colAt, { cleared: band });
  assert.ok(tf.length > tc.length, 'tufts were cleared');
  assert.deepEqual(tc.map(key), tf.filter((t) => !band.has(cellOf(t.x, t.z))).map(key));
  const df = planDecals(gm, colAt), dc = planDecals(gm, colAt, () => 0, { cleared: band });
  assert.ok(df.length > dc.length, 'decals were cleared');
  assert.deepEqual(dc.map(key), df.filter((d) => !band.has(cellOf(d.x, d.z))).map(key));
});

test('the ground rebuilds only its tufts for a new cleared set, and they come back when cleared again', () => {
  const g = buildLowPolyGround(THREE, gm, pal, { tufts: true });
  const ground = g.group.getObjectByName('ground-lowpoly'), all = g.stats.tufts;
  g.retuft(band);
  assert.ok(g.stats.tufts < all, 'fewer tufts with the band cleared');
  assert.equal(g.group.getObjectByName('ground-lowpoly'), ground, 'the ground mesh itself is not rebuilt');
  assert.equal(g.group.children.filter((c) => c.name === 'ground-tufts').length, 1, 'one tuft mesh, the old one swapped out');
  g.retuft(null);
  assert.equal(g.stats.tufts, all, 'a building sold: its tufts grow back');
});

test('render3d: setCleared rebuilds the clutter only when the set changes; the outpost feeds it every placed thing', () => {
  const src = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
  assert.match(src, /export function setCleared\(r, cells\)/);
  assert.match(src, /if \(key === \(r\.clearedKey \|\| ''\)\) return false;/, 'no rebuild when nothing changed');
  assert.match(src, /cleared: r\.cleared \}\);\r?\n {4}scene\.add\(r\.ground\.group\);/, 'a world switch keeps the cleared cells');
  assert.match(src, /r\.ground\.retuft\(r\.cleared\)/);
  assert.match(src, /r\.setCleared = \(cells\) => setCleared\(r, cells\);/);
  const scene = readFileSync(new URL('../outpost/view/outpostScene.js', import.meta.url), 'utf8');
  assert.match(scene, /const rects = occupied\(o, map\)/, 'buildings (from their drop), defenses, plots, farm buildings, the pad, the deposits');
  assert.match(scene, /syncFrames\(o\);\r?\n {6}syncCleared\(o\);/, 'every sync');
});
