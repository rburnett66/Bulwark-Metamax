// LP [MM-story_mv87jxp2_7] — the low-poly ground and the world palettes: data completeness, determinism,
// palette = colours only, the grid covers the map facing up, colours follow the sim's terrain + the road mask,
// tufts stay off roads / blocked cells / the base, and the real three.js build (BufferGeometry needs no WebGL).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

import * as THREE from '../../../vendor/three.module.js';
import { LOWPAL, WORLD_LIGHT, PALETTE_KEYS, DEFAULT_WORLD, resolveWorld } from '../styles/lowpoly-palettes.js';
import { buildGroundArrays, createGroundColour, planTufts, roadSampler, buildLowPolyGround, hexRGB, GRID } from './lowpoly.js';
import { buildLowPolyObstructions, MEADOW } from '../obstructions/lowpoly.js';
import { createLights, sunIntensity } from '../lighting.js';
import { buildTerrainMap } from '../../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));
const MAP = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });   // exactly what main.js builds
const BLOCKED = new Set(MAP.blockedCells.map((c) => c.y * MAP.cols + c.x));

async function roadMask() {
  const img = await loadImage(fs.readFileSync(path.join(GAME, 'content/maps/baked/powder-map-1/road_mask.png')));
  const cv = createCanvas(img.width, img.height), ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test('eleven worlds, each with every colour the ground, tufts, rocks and trees read, plus its lighting', () => {
  assert.deepEqual(PALETTE_KEYS, ['meadow', 'autumn', 'winter', 'canyon', 'tropical', 'sakura', 'dusk', 'volcanic', 'alien', 'highlands', 'savanna']);
  const hex = /^#[0-9a-f]{6}$/;
  const GROUND = ['lime', 'grass', 'teal', 'brush', 'forest', 'stone', 'lilac', 'sand', 'dirt', 'road', 'roadEdge', 'shore', 'foam', 'waterL', 'waterD'];
  for (const k of PALETTE_KEYS) {
    const P = LOWPAL[k];
    for (const g of GROUND) assert.match(P.ground[g], hex, `${k}.ground.${g}`);
    for (const f of ['rockB', 'pebble', 'tuft', 'rare', 'trunk']) assert.match(P[f], hex, `${k}.${f}`);
    assert.equal(P.rock.length, 4); assert.equal(P.pine.length, 4); assert.equal(P.canopy.length, 5);
    for (const c of [...P.rock, ...P.pine, ...P.canopy, ...P.hills]) assert.match(c, hex);
    const L = WORLD_LIGHT[k];
    assert.ok(L, `${k} has lighting`);
    assert.ok(L.ambient > 0 && L.hemi[2] > 0 && L.sun[1] > 0);
  }
  assert.equal(DEFAULT_WORLD, 'meadow');
  assert.equal(resolveWorld('Dusk'), 'dusk');
  assert.equal(resolveWorld('nope'), 'meadow');
  assert.equal(resolveWorld(undefined), 'meadow');
  assert.equal(MEADOW, LOWPAL.meadow, 'obstructions use the same palette object');
});

test('the approved Meadow numbers are the prototype\'s', () => {
  assert.equal(LOWPAL.meadow.ground.grass, '#5fca6e');
  assert.equal(LOWPAL.meadow.ground.road, '#f0dfb0');
  assert.deepEqual(LOWPAL.meadow.rock, ['#7f83d8', '#8a8ae2', '#7479cc', '#9194e6']);
  assert.deepEqual(WORLD_LIGHT.meadow, { clear: 0x6f90d4, apron: 0x5cbf6c, ambient: 0.16, hemi: [0xc4d8ff, 0x86b88f, 0.5], sun: [0xfff0d8, 1.05] });
});

test('the ground grid covers the whole map, flat at Y = 0, every triangle facing UP (no back faces from above)', () => {
  const G = buildGroundArrays(MAP, LOWPAL.meadow);
  assert.equal(G.triangles, (MAP.cols / GRID) * (MAP.rows / GRID) * 2);
  let area = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const p = G.position;
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vz = p[i + 8] - p[i + 2];
    const upY = uz * vx - ux * vz;           // y of (B − A) × (C − A): > 0 → counter-clockwise from above → front face up
    assert.ok(upY > 0, `triangle ${i / 9} faces up`);
    area += upY / 2;
    for (let v = 0; v < 9; v += 3) {
      assert.equal(p[i + v + 1], 0);
      minX = Math.min(minX, p[i + v]); maxX = Math.max(maxX, p[i + v]); minZ = Math.min(minZ, p[i + v + 2]); maxZ = Math.max(maxZ, p[i + v + 2]);
    }
    assert.ok(G.normal[i + 1] > 0.99, 'normals point up (tilt ≤ 0.08)');
  }
  assert.ok(Math.abs(area - MAP.cols * MAP.rows) < 1e-3, `no gaps, no overlaps: area ${area}`);
  assert.deepEqual([minX, maxX, minZ, maxZ], [0, MAP.cols, 0, MAP.rows]);
});

test('determinism: the same map builds the same ground; a world palette changes colours only', () => {
  const a = buildGroundArrays(MAP, LOWPAL.meadow), b = buildGroundArrays(MAP, LOWPAL.meadow), d = buildGroundArrays(MAP, LOWPAL.dusk);
  assert.deepEqual(a.position, b.position);
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.position, d.position, 'geometry identical across worlds');
  assert.notDeepEqual(a.color, d.color, 'colours differ');
  const tm = planTufts(MAP, LOWPAL.meadow), tw = planTufts(MAP, LOWPAL.winter);
  assert.deepEqual(tm.map((t) => [t.x, t.z, t.blades]), tw.map((t) => [t.x, t.z, t.blades]), 'tufts sit in the same places');
  const om = buildLowPolyObstructions(THREE, MAP, LOWPAL.meadow), oa = buildLowPolyObstructions(THREE, MAP, LOWPAL.autumn);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(om.group.children[i].geometry.attributes.position.array, oa.group.children[i].geometry.attributes.position.array);
    assert.notDeepEqual(om.group.children[i].geometry.attributes.color.array, oa.group.children[i].geometry.attributes.color.array);
  }
});

test('colours follow the SIM map: water is water, roads are road', async () => {
  const mask = await roadMask();
  const roadAt = roadSampler(mask, MAP.cols, MAP.rows);
  const colAt = createGroundColour(MAP, LOWPAL.meadow, roadAt);
  const P = Object.fromEntries(Object.entries(LOWPAL.meadow.ground).map(([k, v]) => [k, hexRGB(v)]));
  // a water cell surrounded by water → light→deep water, never grass
  const W = MAP.terrain.findIndex((t, i) => t === 6 && [i - 1, i + 1, i - MAP.cols, i + MAP.cols].every((j) => MAP.terrain[j] === 6));
  assert.ok(W >= 0, 'the map has open water');
  const cw = colAt((W % MAP.cols) + 0.5, ((W / MAP.cols) | 0) + 0.5);
  assert.ok(cw[2] > cw[1] && cw[2] > cw[0], `water is blue: ${cw}`);
  // a well-worn road pixel (the mask is wear 0..~0.82; road > 0.32) → the road colour (90% toward it)
  let rx = -1, rz = -1;
  for (let z = 0.25; z < MAP.rows && rx < 0; z += 0.5) for (let x = 0.25; x < MAP.cols; x += 0.5) {
    const i = Math.floor(z) * MAP.cols + Math.floor(x);
    if (roadAt(x, z) > 0.6 && MAP.terrain[i] !== 6 && ![i - 1, i + 1, i - MAP.cols, i + MAP.cols].some((j) => MAP.terrain[j] === 6)) { rx = x; rz = z; break; }
  }
  assert.ok(rx >= 0, 'the committed road mask has roads');
  const cr = colAt(rx, rz);
  assert.ok(cr.every((v, i) => Math.abs(v - P.road[i]) < 0.12), `road colour at ${rx},${rz}: ${cr} vs ${P.road}`);
  // no mask → no roads anywhere (the sampler is total)
  assert.equal(roadSampler(null, 64, 32)(10, 10), 0);
});

test('tufts: only on open grass / brush, never on blocked cells, the base or a road', async () => {
  const mask = await roadMask();
  const roadAt = roadSampler(mask, MAP.cols, MAP.rows);
  const tufts = planTufts(MAP, LOWPAL.meadow, roadAt);
  assert.ok(tufts.length > 200, `a meadow has grass: ${tufts.length}`);
  for (const t of tufts) {
    const i = Math.floor(t.z) * MAP.cols + Math.floor(t.x);
    assert.ok([0, 2, 7].includes(MAP.terrain[i]), 'grass or brush');
    assert.ok(!BLOCKED.has(i));
    assert.ok(Math.abs(Math.floor(t.x) - MAP.base.x) > 1 || Math.abs(Math.floor(t.z) - MAP.base.y) > 1, 'clear of the base');
    assert.ok(roadAt(t.x, t.z) <= 0.12, 'clear of roads');
  }
});

test('three.js build: ground + tufts + apron, ground receives the shadow map and draws first without depth write', async () => {
  const { group, stats } = buildLowPolyGround(THREE, MAP, LOWPAL.meadow, { roadMask: await roadMask(), apron: WORLD_LIGHT.meadow.apron });
  const [ground, tufts, apron] = group.children;
  assert.equal(ground.name, 'ground-lowpoly');
  assert.equal(ground.geometry.attributes.position.count, stats.triangles * 3);
  assert.ok(ground.receiveShadow && !ground.castShadow);
  assert.equal(ground.material.depthWrite, false);
  assert.ok(ground.material.vertexColors);
  assert.equal(tufts.name, 'ground-tufts');
  assert.equal(tufts.geometry.attributes.position.count, stats.tufts * 3 * 3 * 3, '3 blades × 3 open-cone triangles × 3 verts (zero-area tip triangles stripped)');
  assert.ok(!tufts.castShadow);
  assert.equal(apron.material.color.getHex(), WORLD_LIGHT.meadow.apron);
  assert.ok(stats.triangles + stats.bladeTriangles < 30000, `budget: ${stats.triangles} + ${stats.bladeTriangles}`);
});

test('world lighting: hemisphere + ambient + tinted sun from the world, the sun direction never moves', () => {
  const scene = new THREE.Scene();
  const renderer = { shadowMap: {}, setClearColor(c) { this.clear = c; } };
  const L = createLights(THREE, renderer, scene, MAP.cols, MAP.rows);
  const dir0 = L.sun.position.clone();
  assert.equal(L.hemi.intensity, 0, 'off until a world is applied (baked-ground balance unchanged)');
  L.setWorld(WORLD_LIGHT.dusk);
  assert.equal(renderer.clear, WORLD_LIGHT.dusk.clear);
  assert.equal(L.hemi.intensity, 0.5);
  assert.equal(L.hemi.color.getHex(), 0xff9a8a);
  assert.equal(L.ambient.intensity, 0.16);
  assert.equal(L.sun.color.getHex(), 0xff9a5a);
  assert.ok(Math.abs(L.sun.intensity - sunIntensity(L.dir) * 1.2) < 1e-9);
  assert.ok(L.sun.position.equals(dir0), 'one sun (Q14)');
});
