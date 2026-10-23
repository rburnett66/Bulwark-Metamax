// [MM-story_mvk4auz0_n] — every planet dresses its map 1 in its own prop kit (data/foliage.js): its tree families, its
// rock shape, walkable ground cover so no map is bare — and still no invisible walls, inside the triangle budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../../vendor/three.module.js';
import { planObstructions, invisibleWalls, CODE } from './placement.js';
import { buildLowPolyObstructions } from './lowpoly.js';
import { buildTerrainMap } from '../../sim/mapgen.js';
import { LOWPAL } from '../styles/lowpoly-palettes.js';
import { PLANETS } from '../../data/planets.js';
import { FOLIAGE, TREE_FAMILIES, ROCK_STYLES, COVER_FAMILIES, foliageKitKey } from '../../data/foliage.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SLUG = { ground: 'powder', air: 'air', hightech: 'high-tech', artillery: 'artillery', water: 'water', arcane: 'arcane-energy', space: 'space-tech', dark: 'dark-energy', greenies: 'greenies' };
const MAPS = Object.fromEntries(Object.entries(SLUG).map(([k, slug]) => [k, buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, `content/maps/forge/${slug}-map-1.json`), 'utf8')), 1, { seed: 0, bakeTune: {} })]));
const BUILT = Object.fromEntries(Object.keys(SLUG).map((k) => [k, buildLowPolyObstructions(THREE, MAPS[k], LOWPAL[PLANETS[k].palette], { kit: k })]));

/** §5.3: rocks + trees (+ their glow) ≤ ~25k per map — 30k is the hard ceiling; the cover has its own. */
export const BUDGET = Object.freeze({ obstructions: 30000, plants: 16000, minPlants: 150, meshes: 4 });

test('every planet has a kit, and every kit names only families and a rock style that exist', () => {
  assert.deepEqual(Object.keys(FOLIAGE).sort(), Object.keys(PLANETS).sort());
  for (const [k, K] of Object.entries(FOLIAGE)) {
    for (const f of Object.keys(K.trees)) assert.ok(TREE_FAMILIES.includes(f), `${k}: tree ${f}`);
    for (const f of Object.keys(K.cover)) assert.ok(COVER_FAMILIES.includes(f), `${k}: cover ${f}`);
    assert.ok(ROCK_STYLES.includes(K.rocks), `${k}: rocks ${K.rocks}`);
  }
  assert.equal(new Set(Object.values(FOLIAGE).map((K) => K.rocks)).size >= 7, true, 'rock shapes are per planet (Verdance and Florael share the boulder, §2.4)');
});

test("the battle planet picks the kit; a ?world= preview picks that palette's planet; else Verdance", () => {
  const pal = Object.fromEntries(Object.entries(PLANETS).map(([k, p]) => [k, p.palette]));
  assert.equal(foliageKitKey('dark', 'meadow', pal), 'dark');
  assert.equal(foliageKitKey(null, 'canyon', pal), 'artillery');
  assert.equal(foliageKitKey(null, 'dusk', pal), 'ground');
  assert.equal(foliageKitKey('nope', null, pal), 'ground');
});

for (const k of Object.keys(SLUG)) {
  test(`${PLANETS[k].name} (${SLUG[k]}-map-1): its own trees and rocks, no invisible walls, dressed, in budget`, () => {
    const map = MAPS[k], { plan, stats, group } = BUILT[k], K = FOLIAGE[k];
    assert.deepEqual(invisibleWalls(map, plan), [], 'every blocked rock / tree / cliff cell still gets a solid piece');
    for (const t of plan.trees) assert.ok(t.kind in K.trees, `tree ${t.kind} is in the kit`);
    for (const r of plan.rocks) assert.equal(r.style, K.rocks);
    // ground cover: walkable, dry, clear of the base and the resource fields
    const blocked = new Set(map.blockedCells.map((c) => c.y * map.cols + c.x));
    const res = new Set((map.resources || []).map((r) => r.y * map.cols + r.x));
    for (const p of plan.plants) {
      const i = Math.floor(p.z) * map.cols + Math.floor(p.x), t = map.terrain[i];
      assert.ok([CODE.GRASS, CODE.DIRT, CODE.BRUSH, CODE.TREE_BORDER].includes(t), `cover on code ${t}`);
      assert.ok(!blocked.has(i) && !res.has(i), 'cover never on a blocked cell or a resource field');
      assert.ok(Math.hypot(p.x - (map.base.x + 0.5), p.z - (map.base.y + 0.5)) > 2, 'cover clear of the base');
      assert.ok(p.kind in K.cover);
    }
    assert.ok(plan.trees.length + plan.plants.length >= BUDGET.minPlants, `${plan.trees.length} trees + ${plan.plants.length} plants: the map is dressed`);
    assert.ok(stats.triangles <= BUDGET.obstructions, `obstructions ${stats.triangles} tris`);
    assert.ok(stats.plantTriangles <= BUDGET.plants, `cover ${stats.plantTriangles} tris`);
    assert.ok(group.children.length <= BUDGET.meshes, 'at most four draw calls');
    for (const m of group.children) {
      const p = m.geometry.getAttribute('position');
      assert.ok(p.count > 0 && p.count % 3 === 0 && m.geometry.getAttribute('color').count === p.count, m.name);
      for (let i = 0; i < p.array.length; i++) assert.ok(Number.isFinite(p.array[i]), `${m.name} finite`);
    }
    const glow = group.children.find((m) => m.name === 'obstructions-glow');
    if (glow) assert.ok(glow.material.isMeshBasicMaterial, 'the glow is unlit');
  });
}

test('the cover is deterministic and moves no tree or rock; roads and the low tier thin it', () => {
  const map = MAPS.artillery;
  const a = planObstructions(map, { kit: 'artillery' }), b = planObstructions(map, { kit: 'artillery' });
  assert.equal(JSON.stringify(a.plants), JSON.stringify(b.plants));
  const none = planObstructions(map, { kit: 'artillery', plants: 0 });
  assert.equal(none.plants.length, 0);
  assert.equal(JSON.stringify(none.rocks), JSON.stringify(a.rocks), 'rocks unchanged by the cover');
  assert.equal(JSON.stringify(none.trees), JSON.stringify(a.trees), 'trees unchanged by the cover');
  assert.ok(planObstructions(map, { kit: 'artillery', plants: 0.5 }).plants.length < a.plants.length);
  const roaded = planObstructions(map, { kit: 'artillery', roadAt: (x) => (x < 32 ? 1 : 0) });
  assert.ok(roaded.plants.every((p) => p.x >= 32) && roaded.plants.length > 0, 'nothing on a road');
});

test('a planet kit only changes the LOOK: blocking, cover and tree spots are the same on every kit', () => {
  const map = MAPS.ground, ref = planObstructions(map, { kit: 'ground' });
  for (const k of Object.keys(FOLIAGE)) {
    const p = planObstructions(map, { kit: k });
    assert.deepEqual([...p.cover].sort(), [...ref.cover].sort(), k);
    assert.deepEqual(p.trees.map((t) => [t.x, t.z]), ref.trees.map((t) => [t.x, t.z]), `${k}: trees stand where the map put them`);
    assert.deepEqual(invisibleWalls(map, p), []);
  }
});
