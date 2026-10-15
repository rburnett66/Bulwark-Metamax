// LPS [MM-story_mv87jzov_9] — low-poly base, walls, towers and resource crystals (code design §8.3):
// the height contract, footprints, the faceted look (flat colour per triangle, outward winding), world
// palettes, the layout planners (wall joins, tower facing, lifecycle, crystal fields) and the instanced
// scene wrapper against the vendored three.js (BufferGeometry / InstancedMesh need no WebGL).
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import {
  HEIGHT, buildBaseModel, buildWallPost, buildWallArm, buildCannonTower, buildFlakTower, buildBay, buildFallback,
  buildCrystalShard, buildStructureModels, createFacets, box, xform, planStructures, planCrystals, lifecycleLook,
  yawToward, revealedWave, groupOf,
} from './models.js';
import { createLowPolyStructures } from './lowpoly.js';
import { LOWPAL, PALETTE_KEYS, CRYSTAL } from '../styles/lowpoly-palettes.js';
import { hexRGB } from '../ground/lowpoly.js';

const M = LOWPAL.meadow.struct;
const bounds = (a) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.position.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.position[i + k]); hi[k] = Math.max(hi[k], a.position[i + k]); }
  return { lo, hi };
};
/** Signed volume (divergence theorem): positive iff the closed surface is wound outward. */
const volume = (a) => {
  const p = a.position; let v = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(i, i + 9);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
};
const near = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;

test('HEIGHT CONTRACT: wall 0.6, towers 1.4, base 1.8 — exactly, standing on the ground', () => {
  const cases = [[buildWallPost(M), HEIGHT.wall], [buildCannonTower(M), HEIGHT.tower], [buildFlakTower(M), HEIGHT.tower], [buildBaseModel(M), HEIGHT.base]];
  for (const [a, h] of cases) {
    const { lo, hi } = bounds(a);
    assert.ok(near(hi[1], h), `top ${hi[1]} should be ${h}`);
    assert.ok(near(lo[1], 0), `bottom ${lo[1]} should be the ground`);
  }
  assert.equal(HEIGHT.wall, 0.6); assert.equal(HEIGHT.tower, 1.4); assert.equal(HEIGHT.base, 1.8);
  assert.ok(bounds(buildWallArm(M)).hi[1] < HEIGHT.wall, 'the curtain between posts is lower than the post');
});

test('FOOTPRINTS unchanged: walls and towers stay in their cell, the base in its 3 × 3', () => {
  for (const a of [buildWallPost(M), buildWallArm(M), buildCannonTower(M), buildFlakTower(M), buildBay(M), buildFallback(M)]) {
    const { lo, hi } = bounds(a);
    for (const k of [0, 2]) assert.ok(lo[k] >= -0.5 - 1e-6 && hi[k] <= 0.5 + 1e-6, `axis ${k}: ${lo[k]}..${hi[k]}`);
  }
  const { lo, hi } = bounds(buildBaseModel(M));
  for (const k of [0, 2]) assert.ok(lo[k] >= -1.5 && hi[k] <= 1.5);
  const arm = bounds(buildWallArm(M));
  assert.ok(near(arm.hi[0], 0.5), 'the arm reaches the cell edge, so two neighbours meet');
});

test('FACETED: one flat colour per triangle, unit face normals, every primitive closed and wound outward', () => {
  const all = { ...buildStructureModels(M), base: buildBaseModel(M), crystal: buildCrystalShard() };
  for (const [name, a] of Object.entries(all)) {
    assert.equal(a.position.length % 9, 0);
    assert.equal(a.color.length, a.position.length);
    for (let i = 0; i < a.color.length; i += 9) {
      for (let k = 0; k < 3; k++) assert.ok(a.color[i + k] === a.color[i + 3 + k] && a.color[i + k] === a.color[i + 6 + k], `${name}: tri ${i / 9} is one colour`);
      const n = a.normal.subarray(i, i + 3);
      assert.ok(near(Math.hypot(n[0], n[1], n[2]), 1, 1e-4), `${name}: tri ${i / 9} has a face normal`);
      assert.deepEqual([...a.normal.subarray(i + 3, i + 6)], [...n]);
    }
    assert.ok(volume(a) > 0, `${name}: closed parts wound outward (signed volume ${volume(a)})`);
  }
  // exact check on one primitive: a box's signed volume is w·h·d
  const F = createFacets(1);
  box(F, xform(), { w: 0.4, h: 0.3, d: 0.2, side: [1, 1, 1] });
  assert.ok(near(volume(F.arrays()), 0.4 * 0.3 * 0.2));
});

test('deterministic, and a world palette recolours without moving a vertex', () => {
  assert.deepEqual(buildCannonTower(M), buildCannonTower(M));
  for (const key of PALETTE_KEYS) {
    const s = LOWPAL[key].struct;
    assert.ok(s, `${key} has a struct palette`);
    for (const k of ['stone', 'stoneDark', 'roof', 'trim', 'metal', 'wood']) assert.match(s[k], /^#[0-9a-f]{6}$/, `${key}.struct.${k}`);
    const a = buildBaseModel(s), b = buildBaseModel(M);
    assert.deepEqual(a.position, b.position, `${key}: same shape`);
  }
  assert.notDeepEqual(buildBaseModel(LOWPAL.dusk.struct).color, buildBaseModel(M).color);
  for (const c of ['blue', 'yellow', 'red', 'green']) assert.match(CRYSTAL[c], /^#[0-9a-f]{6}$/);
});

test('anti-ground and anti-air towers read apart (shape and colour)', () => {
  const c = buildCannonTower(M), f = buildFlakTower(M);
  assert.notEqual(c.triangles, f.triangles);
  const avg = (a) => { const s = [0, 0, 0]; for (let i = 0; i < a.color.length; i += 3) for (let k = 0; k < 3; k++) s[k] += a.color[i + k]; return s.map((v) => v / (a.color.length / 3)); };
  const d = avg(c).map((v, k) => Math.abs(v - avg(f)[k]));
  assert.ok(Math.max(...d) > 0.05, `average colours differ: ${d}`);
  assert.equal(groupOf('antiGround'), 'cannon'); assert.equal(groupOf('antiAir'), 'flak'); assert.equal(groupOf('wall'), 'wallPost');
  assert.equal(groupOf('somethingNew'), 'other');
});

// ── planners ──
const S = (id, kind, x, y, extra = {}) => ({ id, kind, structId: 'X', pos: { x, y }, footprint: { w: 1, h: 1 }, lifecycle: 'Complete', hp: 100, maxHp: 100, ...extra });
const deepFreeze = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); return o; };

test('walls join: an arm toward each orthogonal wall neighbour, none toward towers or diagonals', () => {
  const list = deepFreeze([S(1, 'wall', 5, 5), S(2, 'wall', 6, 5), S(3, 'wall', 7, 5), S(4, 'wall', 8, 6), S(5, 'antiGround', 5, 6)]);
  const { groups } = planStructures(list, { x: 10, y: 10 });
  assert.equal(groups.wallPost.length, 4);
  assert.equal(groups.wallArm.length, 4, 'ends one each, the middle two, the diagonal one none');
  for (const a of groups.wallArm) {
    const tip = xform({ r: [0, a.ry, 0], t: [a.x, 0, a.z] })([0.5, 0, 0]);
    assert.ok(near(tip[0], Math.round(tip[0]), 1e-9) && near(tip[2] % 1, 0.5, 1e-9), 'arm tip lands on the shared cell edge');
  }
  assert.equal(groups.cannon.length, 1);
  assert.equal(groups.wallPost[0].x, 5.5); assert.equal(groups.wallPost[0].z, 5.5);
});

test('towers aim away from the base', () => {
  const base = { x: 10, y: 10 };
  for (const [x, y] of [[14, 10], [10, 4], [6, 13], [12, 12]]) {
    const { groups } = planStructures([S(1, 'antiAir', x, y)], base);
    const t = groups.flak[0];
    const aim = xform({ r: [0, t.ry, 0] })([1, 0, 0]);
    const out = [t.x - (base.x + 0.5), t.z - (base.y + 0.5)], l = Math.hypot(...out);
    assert.ok(near(aim[0], out[0] / l, 1e-9) && near(aim[2], out[1] / l, 1e-9), `${x},${y}`);
  }
  assert.ok(near(yawToward(1, 0), 0));
});

test('lifecycle reads: building rises in 4 steps, upgrading / damaged / selling tint; destroyed is gone', () => {
  const steps = [0, 0.2, 0.3, 0.6, 0.9].map((p) => lifecycleLook({ lifecycle: 'Building', progress: p }));
  assert.deepEqual([...new Set(steps.map((s) => s.key))], ['B0', 'B1', 'B2', 'B3']);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].sy >= steps[i - 1].sy && steps[i].sy < 1);
  const c = lifecycleLook({ lifecycle: 'Complete', hp: 10, maxHp: 10 });
  assert.deepEqual([c.sy, c.tint], [1, [1, 1, 1]]);
  const keys = ['Upgrading', 'Selling'].map((lc) => lifecycleLook({ lifecycle: lc }).key);
  const d1 = lifecycleLook({ lifecycle: 'Damaged', hp: 70, maxHp: 100 }), d2 = lifecycleLook({ lifecycle: 'Damaged', hp: 20, maxHp: 100 });
  assert.equal(new Set([...keys, d1.key, d2.key, c.key]).size, 5);
  assert.ok(d2.tint[0] < d1.tint[0], 'badly damaged reads darker');
  assert.equal(planStructures([S(1, 'wall', 1, 1, { lifecycle: 'Destroyed' })]).groups.wallPost.length, 0);
});

test('signature: stable while nothing visible changes, new on a lifecycle step', () => {
  const a = planStructures([S(1, 'wall', 1, 1, { lifecycle: 'Building', progress: 0.1 })]).sig;
  assert.equal(a, planStructures([S(1, 'wall', 1, 1, { lifecycle: 'Building', progress: 0.2 })]).sig, 'same build step');
  assert.notEqual(a, planStructures([S(1, 'wall', 1, 1, { lifecycle: 'Building', progress: 0.3 })]).sig);
  assert.notEqual(a, planStructures([S(1, 'wall', 1, 1)]).sig);
});

const RGB = Object.fromEntries(Object.entries(CRYSTAL).map(([k, v]) => [k, hexRGB(v)]));
const N = (id, x, y, extra = {}) => ({ id, x, y, color: 'blue', role: 'primary', wave: 1, units: 100, remaining: 100, respawns: false, ...extra });

test('crystal fields: ring-gated, coloured, shrink as they drain, gone when consumed', () => {
  const nodes = deepFreeze([N('a', 3, 3), N('b', 4, 3, { color: 'red' }), N('c', 9, 9, { wave: 3 }), N('d', 5, 5, { remaining: 0 }), N('e', 6, 6, { remaining: 0, respawns: true })]);
  const p = planCrystals(nodes, 1, RGB);
  const at = (id, x, y) => p.shards.filter((s) => Math.floor(s.x) === x && Math.floor(s.z) === y);
  assert.ok(at('a', 3, 3).length >= 3 && at('a', 3, 3).length <= 5);
  assert.equal(at('c', 9, 9).length, 0, 'ring not arrived');
  assert.equal(at('d', 5, 5).length, 0, 'consumed');
  assert.ok(at('e', 6, 6).length > 0, 'regrowing primary shows stubs');
  const red = at('b', 4, 3)[0].color;
  assert.ok(red[0] > red[2] * 2, 'red node is red');
  assert.equal(planCrystals(nodes, 3, RGB).shards.length > p.shards.length, true);
  assert.deepEqual(planCrystals(nodes, 1, RGB), p, 'deterministic');
  const full = planCrystals([N('a', 3, 3)], 1, RGB), half = planCrystals([N('a', 3, 3, { remaining: 45 })], 1, RGB);
  assert.ok(Math.max(...half.shards.map((s) => s.h)) < Math.max(...full.shards.map((s) => s.h)));
  assert.equal(planCrystals([N('a', 3, 3, { remaining: 60 })], 1, RGB).sig, planCrystals([N('a', 3, 3, { remaining: 70 })], 1, RGB).sig, 'quantized');
  assert.equal(revealedWave({ waves: { current: 5 }, map: { rings: [1, 2, 3] } }), 3);
  assert.equal(revealedWave({}), 1);
});

test('scene: one InstancedMesh per group, instanced + shadowed, set* report static-set changes, setWorld recolours', () => {
  const scene = new THREE.Scene();
  const st = createLowPolyStructures(THREE, scene);
  st.setBase({ x: 10, y: 10 });
  assert.ok(st.base.visible && st.base.castShadow && st.base.receiveShadow);
  assert.equal(st.base.position.x, 10.5);
  const list = [S(1, 'wall', 5, 5), S(2, 'wall', 6, 5), S(3, 'antiGround', 7, 7), S(4, 'antiAir', 3, 3), S(5, 'harvestorBay', 2, 2)];
  assert.equal(st.setStructures(list), true);
  assert.equal(st.setStructures(list), false, 'unchanged → no shadow re-render');
  const m = st.meshes;
  assert.deepEqual([m.wallPost.count, m.wallArm.count, m.cannon.count, m.flak.count, m.bay.count, m.other.count], [2, 2, 1, 1, 1, 0]);
  for (const k of Object.keys(m)) {
    assert.ok(m[k].isInstancedMesh && m[k].castShadow && m[k].receiveShadow, k);
    assert.ok(m[k].instanceColor, `${k} carries instance colour`);
    assert.equal(m[k].visible, m[k].count > 0, `${k}: empty groups cost no draw call`);
  }
  assert.equal(new Set(Object.values(m).map((x) => x.material)).size, 1, 'one shared material');
  const state = { resourceNodes: [N('a', 12, 3), N('b', 13, 3, { color: 'yellow' })], waves: { current: 1 } };
  assert.equal(st.setResources(state), true);
  assert.equal(st.setResources(state), false);
  assert.ok(m.crystal.count >= 6);
  const before = m.cannon.geometry.attributes.color.array.slice();
  st.setWorld(LOWPAL.volcanic);
  assert.notDeepEqual(m.cannon.geometry.attributes.color.array, before);
  assert.equal(m.cannon.count, 1, 'instances survive a world change');
  st.dispose();
  assert.equal(scene.children.length, 0);
});
