// [MM-story_mw2qkmb1_2] The tiled terrain prototype: the splat texture tiles and is made in code, the ground carries
// per-vertex layer weights from the map, decals are placed on the right ground, chunked for culling, and fade out
// toward the whole-map view.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../../vendor/three.module.js';
import { LOWPAL } from '../styles/lowpoly-palettes.js';
import { buildGroundArrays, createGroundColour, buildLowPolyGround } from './lowpoly.js';
import { SPLAT, layerHeights, splatTextureData, tapsForTier, splatSetFor } from './splat.js';
import { DECALS, KINDS, decalAtlasData, planDecals, chunkDecals, decalFade, buildDecals } from './decals.js';
import { CAMERA } from '../camera.js';
import { buildTerrainMap } from '../../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const mapN = (n) => buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, `content/maps/forge/powder-map-${n}.json`), 'utf8')), n, { seed: 0, bakeTune: {} });
const MAP = mapN(1);
const PAL = LOWPAL.meadow;

test('the splat texture tiles seamlessly: the heights at u = 0 and u = 1 match (every layer)', () => {
  const W = splatSetFor('meadow');
  for (const v of [0, 0.13, 0.5, 0.77]) {
    const a = layerHeights(0, v, W), b = layerHeights(1, v, W), c = layerHeights(v, 0, W), d = layerHeights(v, 1, W);
    for (let k = 0; k < 4; k++) { assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `u seam ch ${k}`); assert.ok(Math.abs(c[k] - d[k]) < 1e-9, `v seam ch ${k}`); }
  }
});

test('the texture is made in code: 256² RGBA, every channel has real contrast, cached, and differs per planet', () => {
  const t = splatTextureData('meadow');
  assert.equal(t.size, SPLAT.size);
  assert.equal(t.data.length, SPLAT.size * SPLAT.size * 4);
  for (let c = 0; c < 4; c++) {
    let lo = 255, hi = 0;
    for (let i = c; i < t.data.length; i += 4) { lo = Math.min(lo, t.data[i]); hi = Math.max(hi, t.data[i]); }
    assert.ok(hi - lo > 90, `channel ${c} contrast ${hi - lo}`);
  }
  assert.equal(splatTextureData('meadow'), t, 'cached');
  assert.notDeepEqual(splatTextureData('winter').data.subarray(0, 4096), t.data.subarray(0, 4096));
  assert.equal(tapsForTier('high'), 2);
  assert.equal(tapsForTier('standard'), 1);
});

test('layer weights follow the terrain codes: turf is grass, roads are soil, rock codes are rock, water is none', () => {
  const col = createGroundColour(MAP, PAL);
  const at = (code) => { const i = MAP.terrain.findIndex((t, k) => t === code && MAP.terrain[k + 1] === code && MAP.terrain[k + MAP.cols] === code); return i < 0 ? null : col.layersAt((i % MAP.cols) + 1, ((i / MAP.cols) | 0) + 1); };
  const g = at(0); assert.ok(g && g.grass > 0.8, 'grass');
  const w = at(6); if (w) assert.ok(w.grass + w.soil + w.rock + w.sand < 0.2, 'water');
  const r = at(3); if (r) assert.ok(r.rock > 0.6, 'rock');
  const gi = MAP.terrain.findIndex((t, k) => t === 0 && MAP.terrain[k + 1] === 0 && MAP.terrain[k + MAP.cols] === 0);
  const gx = (gi % MAP.cols) + 1, gz = ((gi / MAP.cols) | 0) + 1;
  const cr = createGroundColour(MAP, PAL, () => 1);
  assert.ok(cr.layersAt(gx, gz).soil > 0.9, 'roads are soil');
  for (let k = 0; k < 200; k++) {
    const L = col.layersAt(Math.random() * MAP.cols, Math.random() * MAP.rows);
    assert.ok(L.grass + L.soil + L.rock + L.sand <= 1.0001);
  }
});

test('the splat ground: smooth per-vertex colour + 4 weights + a world uv; the default ground is unchanged', () => {
  const plain = buildGroundArrays(MAP, PAL, () => 0, 0.5);
  assert.equal(plain.aSplat, null);
  const S = buildGroundArrays(MAP, PAL, () => 0, 0.5, { splat: true });
  assert.equal(S.aSplat.length, S.triangles * 12);
  assert.equal(S.aSUv.length, S.triangles * 6);
  assert.deepEqual(S.position, plain.position, 'same mesh');
  const r = buildLowPolyGround(THREE, MAP, PAL, { splat: { world: 'meadow', taps: 2 }, grassDetail: true });
  const mesh = r.group.getObjectByName('ground-lowpoly');
  assert.ok(mesh.geometry.getAttribute('aSplat') && !mesh.geometry.getAttribute('aGrass'));
  assert.equal(mesh.material.customProgramCacheKey(), 'ground-splat-2');
  assert.equal(r.stats.splat, true);
});

test('decals: atlas made in code, placed by ground kind, never on blocked cells / water / the base, deterministic', () => {
  const A = decalAtlasData();
  assert.equal(A.size, DECALS.atlasCells * DECALS.cellPx);
  const col = createGroundColour(MAP, PAL);
  const L = planDecals(MAP, col);
  assert.ok(L.length > 150, 'enough detail: ' + L.length);
  assert.deepEqual(planDecals(MAP, col), L, 'deterministic');
  const blocked = new Set(MAP.blockedCells.map((c) => c.y * MAP.cols + c.x));
  for (const d of L) {
    assert.ok(!blocked.has(Math.floor(d.z) * MAP.cols + Math.floor(d.x)), 'blocked');
    if (MAP.base) assert.ok(!(Math.abs(Math.floor(d.x) - MAP.base.x) <= 1 && Math.abs(Math.floor(d.z) - MAP.base.y) <= 1), 'base');
    assert.ok(col.layersAt(d.x, d.z).water <= 0.25, 'water');
    if (KINDS[d.kind] === 'flowers') assert.ok(col.layersAt(d.x, d.z).grass > 0, 'flowers on turf');
  }
  assert.ok(new Set(L.map((d) => d.kind)).size >= 4, 'several kinds');
});

test('decals are chunked: a 64 × 32 map is at most 8 draw calls, each chunk with its own bounding sphere', () => {
  const col = createGroundColour(MAP, PAL);
  const D = buildDecals(THREE, MAP, col, () => 0);
  assert.ok(D.stats.chunks <= Math.ceil(MAP.cols / DECALS.chunk) * Math.ceil(MAP.rows / DECALS.chunk));
  const spheres = new Set();
  for (const m of D.group.children) {
    assert.ok(m.isInstancedMesh && m.frustumCulled);
    assert.ok(m.geometry.boundingSphere, 'preset sphere for the frustum test');
    spheres.add(m.geometry.boundingSphere.center.x + ',' + m.geometry.boundingSphere.center.z);
    assert.equal(m.material, D.group.children[0].material, 'one shared material');
  }
  assert.equal(spheres.size, D.stats.chunks);
  assert.equal(chunkDecals(planDecals(MAP, col)).size, D.stats.chunks);
});

test('decals fade out as the camera pulls back to the whole map', () => {
  const { cols, rows } = MAP;
  assert.equal(decalFade({ dist: CAMERA.startDist }, 16 / 9, cols, rows), 1, 'desktop start view: full');
  assert.ok(decalFade({ dist: 70 }, 16 / 9, cols, rows) < 0.05, 'desktop whole map: gone');
  assert.ok(decalFade({ dist: CAMERA.maxDist }, 9 / 19.5, cols, rows) < 0.05, 'portrait at the far end: gone');
  assert.equal(decalFade({ dist: CAMERA.minDist }, 9 / 19.5, cols, rows), 1, 'close in: full');
  const col = createGroundColour(MAP, PAL), D = buildDecals(THREE, MAP, col, () => 0);
  D.update({ dist: CAMERA.maxDist }, 16 / 9);
  assert.equal(D.group.visible, false, 'hidden once gone — no draw calls');
  D.update({ dist: 30 }, 16 / 9);
  assert.equal(D.group.visible, true);
});

test('every Verdance map 1–9 builds the tiled ground and its decals', () => {
  for (let n = 1; n <= 9; n++) {
    const m = mapN(n), r = buildLowPolyGround(THREE, m, PAL, { splat: { world: 'meadow', taps: 1 } });
    const D = buildDecals(THREE, m, r.colAt, () => 0);
    assert.ok(D.stats.decals > 100, `map ${n}: ${D.stats.decals}`);
  }
});

// [MM-story_mw2uk8lq_1] the tiled ground is the default on every map; each planet's decals fit the planet.
import { WORLD_DECALS } from './decals.js';
import { PLANETS } from '../../data/planets.js';

const FAC = [['powder', 'ground'], ['air', 'air'], ['high-tech', 'hightech'], ['artillery', 'artillery'], ['water', 'water'],
  ['arcane-energy', 'arcane'], ['space-tech', 'space'], ['dark-energy', 'dark'], ['greenies', 'greenies']];

test('every battle planet has a splat set and a decal rule (or is lush: every kind)', () => {
  for (const [, key] of FAC) {
    const w = PLANETS[key].palette;
    assert.ok(LOWPAL[w], w);
    assert.ok(splatSetFor(w) && splatSetFor(w) !== splatSetFor('nope') || w === 'meadow', `${w} has its own splat set`);
    assert.ok(w in WORLD_DECALS, `${w} has a decal rule`);
  }
});

test('barren, frozen and burnt worlds grow no flowers, clover or leaves', () => {
  const m = mapN(1);
  for (const w of ['lunar', 'volcanic', 'winter', 'canyon']) {
    const col = createGroundColour(m, LOWPAL[w]);
    const kinds = new Set(planDecals(m, col, () => 0, { world: w }).map((d) => KINDS[d.kind]));
    for (const k of ['flowers', 'clover', 'leaves']) assert.ok(!kinds.has(k), `${w}: ${k}`);
    assert.ok(kinds.size >= 1, `${w} still has detail`);
  }
  const lunar = new Set(planDecals(m, createGroundColour(m, LOWPAL.lunar), () => 0, { world: 'lunar' }).map((d) => KINDS[d.kind]));
  for (const k of lunar) assert.ok(['pebbles', 'crack', 'ruts'].includes(k), 'lunar: ' + k);
  const lush = planDecals(m, createGroundColour(m, PAL), () => 0, { world: 'meadow' });
  assert.deepEqual(lush, planDecals(m, createGroundColour(m, PAL)), 'a lush world = every kind, same as no world');
});

test('all 81 maps (9 planets × 9) build the tiled ground and their decals', () => {
  for (const [slug, key] of FAC) {
    const world = PLANETS[key].palette, pal = LOWPAL[world];
    for (let n = 1; n <= 9; n++) {
      const m = buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, `content/maps/forge/${slug}-map-${n}.json`), 'utf8')), n, { seed: 0, bakeTune: {} });
      const r = buildLowPolyGround(THREE, m, pal, { splat: { world, taps: 2 }, tufts: false });
      assert.equal(r.stats.splat, true, `${slug} ${n}`);
      const D = buildDecals(THREE, m, r.colAt, () => 0, { world });
      assert.ok(D.stats.decals > 30, `${slug} ${n}: ${D.stats.decals} decals`);
      assert.ok(D.stats.chunks <= Math.ceil(m.cols / DECALS.chunk) * Math.ceil(m.rows / DECALS.chunk));
    }
  }
});
