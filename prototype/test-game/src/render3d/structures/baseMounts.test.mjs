// src/render3d/structures/baseMounts.test.mjs — [MM-task_mvj0k7v3_k] towers on the base's corner slots sit ON the
// landing craft. Owner 2026-10-21: "when towers are placed on the corners of the base unit they need to be above ..
// not inside the base". node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import '../../data/factions.js';
import { planMounts, mountOf, MOUNT_SCALE } from './baseMounts.js';
import { planSystem, muzzlePoint } from './system3d.js';
import { planBars } from '../overlays/healthBars.js';
import { createCraft3D } from '../craft/craft3d.js';
import { landedPose } from '../craft/landing.js';
import { LANDING_CRAFT_ORDER } from '../craft/models.js';
import { MAP } from '../../data/tables.js';

const corners = MAP.base.cornerSlots;
const S = (id, kind, x, y) => ({ id, kind, cell: { x, y }, pos: { x, y }, lifecycle: 'Complete', hp: 4, maxHp: 10 });

test('every landing craft measures a hull top over all four corner slots, as the game places it', () => {
  for (const key of LANDING_CRAFT_ORDER) {
    const craft = createCraft3D(THREE, new THREE.Scene(), key);
    craft.place(MAP.base);
    craft.apply(landedPose());
    const m = planMounts(corners, (x, z) => craft.topAt(x, z));
    assert.equal(m.size, 4, `${key}: all four corners are on the hull (${[...m.keys()]})`);
    for (const [k, y] of m) assert.ok(y > 0.5 && y < 2.5, `${key} ${k}: deck height ${y}`);
    assert.equal(craft.topAt(MAP.base.x + 6.5, MAP.base.y + 0.5), 0, `${key}: open ground beside the craft is 0`);
  }
});

test('a corner tower is lifted onto the hull and drawn at 75%; a tower elsewhere is untouched', () => {
  const mounts = new Map(corners.map((c) => [c.x + ',' + c.y, 1.2]));
  const c0 = corners[0];
  const { items } = planSystem([S(1, 'antiGround', c0.x, c0.y), S(2, 'antiGround', 10, 5)], MAP.base, mounts);
  const on = items.find((i) => i.id === 1), off = items.find((i) => i.id === 2);
  assert.equal(on.y, 1.2); assert.equal(on.ms, MOUNT_SCALE);
  assert.equal(off.y, 0); assert.equal(off.ms, 1);
  // the firing point rides up with it, and the gun is 75% the size: tip height = mount + 0.75 × the ground tower's
  const ground = muzzlePoint({ ...on, y: 0, ms: 1 }, on.ry), mounted = muzzlePoint(on, on.ry);
  assert.ok(Math.abs(mounted.y - (1.2 + ground.y * MOUNT_SCALE)) < 1e-9, `muzzle y ${mounted.y} vs ${1.2 + ground.y * MOUNT_SCALE}`);
  assert.equal(mounted.gx, undefined, 'no ground shockwave under a hull-mounted tower');
  assert.ok(ground.gx !== undefined, 'a ground tower keeps its shockwave');
  // the plan signature changes when mounts arrive, so the binder redraws
  assert.notEqual(planSystem([S(1, 'antiGround', c0.x, c0.y)], MAP.base, mounts).sig, planSystem([S(1, 'antiGround', c0.x, c0.y)], MAP.base, null).sig);
});

test('a mounted tower keeps its health bar above it', () => {
  const c0 = corners[0], mounts = new Map([[c0.x + ',' + c0.y, 1.2]]);
  const s = { ...S(9, 'antiGround', c0.x, c0.y), hp: 4 };
  const state = { structures: new Map([[9, s]]), units: new Map() };
  const mem = new Map();
  planBars(state, [], mem, 0.016, { mounts });      // first sight at 4/10 hp
  s.hp = 3;                                         // a hit shows the bar
  let bars = [];
  for (let i = 0; i < 20; i++) bars = planBars(state, [], mem, 0.05, { mounts });
  const b = bars.find((x) => x.id === 's9');
  assert.ok(b, 'the bar shows');
  assert.ok(b.y > 1.2 + 1.15 * MOUNT_SCALE - 0.01, `bar height ${b.y}`);
  assert.equal(mountOf(mounts, S(1, 'antiGround', 10, 5)), null);
});
