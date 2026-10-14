// T4 [MM-story_mv77hsxk_6] — 3D obstructions: placement from the SIM's map, the no-invisible-walls
// invariant, determinism, and the real geometry build (vendored three.js; BufferGeometry needs no WebGL).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../../vendor/three.module.js';
import { planObstructions, invisibleWalls, CODE } from './placement.js';
import { buildLowPolyObstructions } from './lowpoly.js';
import { createUnits3D } from '../units/models3d.js';
import { buildTerrainMap, buildCampaignMap } from '../../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));
const MAP = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });   // exactly what main.js builds
const cellOf = (x, z) => Math.floor(z) * MAP.cols + Math.floor(x);
const BLOCKED = new Set(MAP.blockedCells.map((c) => c.y * MAP.cols + c.x));

test('NO INVISIBLE WALLS: every blocked rock / tree / cliff cell gets a solid piece', () => {
  const plan = planObstructions(MAP);
  assert.deepEqual(invisibleWalls(MAP, plan), []);
  assert.equal(plan.cover.size, MAP.blockedCells.length, 'on powder-map-1 every blocked cell is an obstruction code');
});

test('placement is deterministic: the same map always builds the same world', () => {
  assert.equal(JSON.stringify({ ...planObstructions(MAP), cover: null }), JSON.stringify({ ...planObstructions(MAP), cover: null }));
  assert.notEqual(JSON.stringify(planObstructions(MAP, { seed: 1 }).rocks), JSON.stringify(planObstructions(MAP).rocks), 'the seed matters');
});

test('solid rocks stand only on blocked cells; only small stones sit on walkable rock-border', () => {
  const plan = planObstructions(MAP);
  for (const r of plan.rocks) {
    const i = cellOf(r.x, r.z), t = MAP.terrain[i];
    if (r.tone === 'pebble' && t === CODE.ROCK_BORDER) { assert.ok(r.sx <= 0.2, 'rock-border stones are small'); continue; }
    if (r.tone === 'pebble') { assert.equal(t, CODE.ROCKS); continue; }   // pebble beside a rock-cell boulder
    assert.ok(BLOCKED.has(i), `${r.tone} at ${r.x.toFixed(2)},${r.z.toFixed(2)} stands on a blocked cell`);
  }
});

test('trees: every authored grove tree at its authored spot, then one per still-bare blocked tree cell', () => {
  const plan = planObstructions(MAP);
  const decor = MAP.decor;
  for (let k = 0; k < decor.length; k++) {
    const d = decor[k], t = plan.trees[k];
    assert.ok(Math.abs(t.x - (d.x + 0.5 + (d.dx || 0))) < 1e-9 && Math.abs(t.z - (d.y + 0.5 + (d.dy || 0))) < 1e-9, `decor ${k}`);
  }
  const decorCells = new Set(decor.map((d) => d.y * MAP.cols + d.x));
  const bare = [...BLOCKED].filter((i) => MAP.terrain[i] === CODE.TREES && !decorCells.has(i)).length;
  assert.equal(plan.trees.length, decor.length + bare);
  for (const t of plan.trees.slice(decor.length)) assert.ok(BLOCKED.has(cellOf(t.x, t.z)), 'fill trees only on blocked tree cells');
});

test('FINDING recorded, not changed: 5 authored trees stand on walkable tree-border cells', () => {
  const walk = MAP.decor.filter((d) => !BLOCKED.has(d.y * MAP.cols + d.x));
  assert.equal(walk.length, 5, 'level authoring — units can pass through these 5 trees');
  for (const d of walk) assert.equal(MAP.terrain[d.y * MAP.cols + d.x], 7, 'all on code 7 tree-border');
});

test('a workbook map (no terrain codes) plans nothing and does not throw', () => {
  const m = buildCampaignMap(3, { seed: 0 });
  const plan = planObstructions(m);
  assert.deepEqual([plan.rocks.length, plan.trees.length], [0, 0]);
});

test('geometry: two merged meshes (rocks, trees) that cast and receive shadows, inside a sane triangle budget', () => {
  const { group, stats } = buildLowPolyObstructions(THREE, MAP);
  assert.deepEqual(group.children.map((m) => m.name), ['obstructions-rocks', 'obstructions-trees']);
  for (const m of group.children) {
    assert.ok(m.castShadow && m.receiveShadow, `${m.name} casts + receives`);
    assert.ok(m.material.vertexColors, `${m.name} is vertex-coloured`);
    const p = m.geometry.getAttribute('position');
    assert.ok(p.count > 0 && p.count % 3 === 0, `${m.name} has whole triangles`);
    assert.equal(m.geometry.getAttribute('color').count, p.count);
  }
  assert.ok(stats.triangles > 5000 && stats.triangles < 60000, `obstructions = ${stats.triangles} tris`);
});

test('3D units RECEIVE the static shadow map (they darken under trees) but never cast into it', () => {
  const scene = new THREE.Scene();
  createUnits3D(THREE, scene, { sunDir: { x: -0.5, y: 0.7, z: -0.5 } });
  const lit = scene.children.filter((m) => m.isInstancedMesh && !(m.material instanceof THREE.ShaderMaterial));
  assert.ok(lit.length >= 8, 'full + LOD meshes per type and group');
  for (const m of lit) { assert.equal(m.receiveShadow, true); assert.equal(m.castShadow, false); }
});
