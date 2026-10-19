// FX [MM-story_mv87jvnb_5] — world-impact effects in the 3D view: the recipe each sim event triggers, the burning
// wreck's life (burn → sink → removed), consume-once by tick + id, tier caps + oldest-first wreck eviction,
// determinism, read-only on the sim, and the view's bounded draw calls.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import {
  createImpacts, K, D, DEFAULT_IMPACT_CAPS, LOW_IMPACT_CAPS, HIT_GAP_TICKS, SINK_DELAY, SINK_TIME, modelInfo,
} from './impacts.js';
import { createImpactsView } from './impactsView.js';
import { createUnits3D } from '../units/models3d.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';
import { UNIT_SCALE } from '../units/modelKeys.js';
import { AIM } from './combatFxModel.js';

const MAP = { cols: 32, rows: 32, base: { x: 16, y: 16 } };

function world({ tick = 0, units = [], structures = [] } = {}) {
  return {
    tick, time: tick / 30,
    units: new Map(units.map((u) => [u.id, { hp: 10, side: 'attacker', domain: 'Ground', ...u }])),
    structures: new Map(structures.map((s) => [s.id, { lifecycle: 'Complete', footprint: { w: 1, h: 1 }, ...s }])),
  };
}
const tower = { id: 100, structId: 'STR-Tower', pos: { x: 4, y: 4 } };
const tankView = (o) => ({ id: 1, model: 'tank', scale: 1, x: 10.5, y: 0, z: 4.5, heading: 0, aim: Math.PI, ...o });
const dmg = (o) => ({ type: 'damage', tick: 5, sourceId: 100, targetId: 1, targetKind: 'unit', amount: 1, killed: false, pos: { x: 10, y: 4 }, ...o });
const kill = (o) => ({ type: 'kill', tick: 6, entityId: 1, unitId: 'tank', radius: 0.3, pos: { x: 10, y: 4 }, ...o });
const count = (fx, kind) => fx.particles.filter((p) => p.kind === kind).length;

/** Frame 1 shows the unit (fills the last-frame cache); frame 2 delivers `events` with the unit gone. */
function killFrame(fx, view, events, extraState = {}) {
  fx.update(world({ tick: 5, structures: [tower], ...extraState }), MAP, [], 1 / 60, [view]);
  fx.update(world({ tick: 6, structures: [tower] }), MAP, events, 0, []);
}

test('hit on armour: 14 sparks + 2 smoke, ricocheting back toward the shooter (≥ 60% within ±0.8 rad of reverse)', () => {
  const fx = createImpacts();
  const st = world({ tick: 5, units: [{ id: 1, unitId: 'tank', pos: { x: 10, y: 4 } }], structures: [tower] });
  fx.update(st, MAP, [dmg()], 0, [tankView()]);
  assert.equal(count(fx, K.SPARK), 14);
  assert.equal(count(fx, K.SMOKE), 2);
  assert.equal(count(fx, K.FLASH), 0, 'no flash: combatFx already flashes the hit');
  assert.equal(fx.stats.hits, 1);
  // the round travelled +X (tower west of the tank) → the sparks fly back −X
  const sparks = fx.particles.filter((p) => p.kind === K.SPARK);
  const back = sparks.filter((p) => Math.abs(Math.atan2(p.vz, -p.vx)) <= 0.8 + 1e-9).length;
  assert.ok(back >= 8, `most sparks ricochet back (${back}/14)`);
  for (const p of sparks) assert.ok(p.vy > 0, 'sparks leave upward');
  assert.ok(sparks.every((p) => p.x < 10.5), 'sparks start on the near face of the plate');
});

test('hit on a flyer sparks at flying height; structure / base targets at their aim heights', () => {
  const fx = createImpacts();
  const st = world({ tick: 5, units: [{ id: 1, unitId: 'jet', altitude: 1, pos: { x: 10, y: 4 } }], structures: [tower] });
  fx.update(st, MAP, [dmg()], 0, [tankView({ model: 'jet', y: HOVER_HEIGHT })]);
  assert.ok(fx.particles.every((p) => p.y > HOVER_HEIGHT));
  for (const [targetKind, y] of [['structure', AIM.structure], ['base', AIM.base]]) {
    const f2 = createImpacts();
    f2.update(world({ tick: 5, units: [{ id: 9, unitId: 'tank', pos: { x: 2, y: 2 } }] }), MAP, [dmg({ sourceId: 9, targetId: 50, targetKind })], 0, []);
    assert.equal(f2.stats.hits, 1);
    assert.ok(f2.particles.every((p) => p.y === y), `${targetKind} sparks at ${y}`);
  }
});

test('a hit on a plane sparks where the plane is DRAWN (flight path + floor), not over its sim cell [MM-task_mveuiry6_c]', () => {
  const fx = createImpacts();
  const st = world({ tick: 5, units: [{ id: 1, unitId: 'bomber', domain: 'Flyer', altitude: 1, pos: { x: 10, y: 4 } }], structures: [tower] });
  const drawn = { id: 1, model: 'bomber', scale: 1, x: 12.3, y: 2.9, z: 6.1, heading: 0, aim: 0 };   // off its cell, at the floor
  fx.update(st, MAP, [dmg()], 0, [drawn]);
  assert.equal(fx.stats.hits, 1);
  const sp = fx.particles.filter((p) => p.kind === K.SPARK);
  assert.ok(sp.length > 0);
  for (const p of sp) {
    assert.ok(Math.hypot(p.x - 12.3, p.z - 6.1) < 0.6, `spark at (${p.x.toFixed(2)},${p.z.toFixed(2)}) on the airframe`);
    assert.ok(Math.abs(p.y - (2.9 + 0.24)) < 0.3, `spark height ${p.y.toFixed(2)} at the drawn altitude`);
  }
});

test('hits are throttled per (source, target) — the sim deals damage every tick', () => {
  const fx = createImpacts();
  const st = world({ tick: 5, units: [{ id: 1, unitId: 'tank', pos: { x: 10, y: 4 } }], structures: [tower] });
  const evs = [];
  for (let t = 0; t < HIT_GAP_TICKS * 3; t++) evs.push(dmg({ tick: t }));
  fx.update(st, MAP, evs, 0, [tankView()]);
  assert.equal(fx.stats.hits, 3, 'one spark burst per HIT_GAP_TICKS');
  fx.update(st, MAP, [dmg({ tick: 200, sourceId: 101 })], 0, [tankView()]);   // another shooter is not throttled by the first
  assert.equal(fx.stats.grounds + fx.stats.hits, 4);
});

test('a sourceless hit (base cannon AOE, mines) lands on the ground: dust, sparks, a puff, a small scorch', () => {
  const fx = createImpacts();
  fx.update(world({ tick: 5 }), MAP, [dmg({ sourceId: -2 })], 0, []);
  assert.equal(fx.stats.grounds, 1);
  assert.equal(count(fx, K.DUST), 6);
  assert.equal(count(fx, K.SPARK), 4);
  assert.equal(count(fx, K.SMOKE), 1);
  assert.equal(fx.scorches.length, 1);
});

test('the shooter died the same tick: travel direction comes from its last-frame view', () => {
  const fx = createImpacts();
  fx.update(world({ tick: 4 }), MAP, [], 0, [tankView(), { id: 7, model: 'buggy', x: 14.5, y: 0, z: 4.5, heading: 0 }]);
  fx.update(world({ tick: 5 }), MAP, [dmg({ sourceId: 7 })], 0, [tankView()]);
  assert.equal(fx.stats.hits, 1);
  const sparks = fx.particles.filter((p) => p.kind === K.SPARK);
  assert.ok(sparks.filter((p) => p.vx > 0).length >= 8, 'round came from the east → sparks fly back east');
});

test('a killing blow on a unit leaves the sparks to the kill event (no double effect)', () => {
  const fx = createImpacts();
  fx.update(world({ tick: 5, structures: [tower] }), MAP, [dmg({ killed: true })], 0, []);
  assert.equal(fx.particles.length, 0);
});

test('KILL (tank): boom recipe + a burning hull wreck + the turret blown off its pivot, with the last-frame aim', () => {
  const fx = createImpacts();
  const heading = Math.PI / 2, aim = 0.3;
  killFrame(fx, tankView({ heading, aim }), [kill()]);
  assert.equal(count(fx, K.FIRE), 14);
  assert.equal(count(fx, K.SPARK), 28);
  assert.equal(count(fx, K.SMOKE), 8);
  assert.equal(count(fx, K.FLASH), 0, 'combatFx flashes the kill');
  assert.equal(fx.chunks.length, 6);
  assert.deepEqual(fx.scorches.map((d) => d.kind), [D.SCORCH]);
  assert.deepEqual(fx.glows.map((d) => d.kind).sort(), [D.RING, D.POOL].sort());
  assert.ok(fx.scorches[0].life === 22, 'scorch lasts 22 s');
  assert.ok(fx.shake > 0, 'short camera shake');
  assert.equal(fx.wrecks.length, 2);
  const [hull, turret] = fx.wrecks;
  assert.equal(hull.group, 'body'); assert.equal(hull.phase, 'burning');
  assert.ok(hull.burn >= 7 && hull.burn <= 10);
  assert.ok(Math.abs(hull.yaw + heading) < 1e-9, 'the hull keeps its heading');
  assert.equal(turret.group, 'turret'); assert.equal(turret.phase, 'falling');
  assert.ok(Math.abs(turret.yaw + aim) < 1e-9, 'the turret leaves pointing where it last aimed');
  assert.ok(turret.vy >= 4.2 && turret.vy <= 6.0, 'launched upward');
  // start = turret pivot rotated by the heading, scaled
  const p = modelInfo('tank').turretPivot;
  assert.ok(Math.abs(turret.x - (10.5 - p.z * UNIT_SCALE)) < 1e-9 && Math.abs(turret.z - (4.5 + p.x * UNIT_SCALE)) < 1e-9);
  assert.ok(Math.abs(turret.y - p.y * UNIT_SCALE) < 1e-9);
});

test('KILL: turretless models leave only the hull; a unit never drawn falls back to its resolved model', () => {
  const fx = createImpacts();
  killFrame(fx, tankView({ model: 'beetle' }), [kill()]);
  assert.deepEqual(fx.wrecks.map((w) => w.model + '/' + w.group), ['beetle/body']);
  const fx2 = createImpacts();
  fx2.update(world({ tick: 6 }), MAP, [kill({ entityId: 99, unitId: 'X' })], 0, [], { resolve: () => ({ model: 'buggy', scale: 1 }) });
  assert.deepEqual(fx2.wrecks.map((w) => w.model + '/' + w.group), ['buggy/body', 'buggy/turret']);
});

test('KILL (flyer): no boom in the air — it falls with its momentum, booms where it lands, then burns', () => {
  const fx = createImpacts();
  killFrame(fx, tankView({ model: 'jet', y: HOVER_HEIGHT, heading: 0 }), [kill()]);
  assert.equal(fx.stats.booms, 0);
  assert.equal(fx.wrecks.length, 1);
  const w = fx.wrecks[0];
  assert.equal(w.phase, 'falling');
  const x0 = w.x;
  const st = world({ tick: 7 });
  for (let i = 0; i < 120 && w.phase === 'falling'; i++) fx.update(st, MAP, [], 1 / 30, []);
  assert.equal(w.phase, 'burning');
  assert.equal(w.y, 0);
  assert.ok(w.x > x0 + 0.3, 'carried forward by its momentum');
  assert.equal(fx.stats.booms, 1, 'exploded on touchdown');
  assert.ok(fx.particles.some((p) => p.kind === K.FLASH), 'its ground impact flashes here (the sim reports none)');
});

test('wreck lifecycle: burn → charred → sink → removed; the turret bounces at most twice and settles', () => {
  const fx = createImpacts();
  killFrame(fx, tankView(), [kill()]);
  const [hull, turret] = fx.wrecks;
  const st = world({ tick: 7 });
  const seen = new Set();
  let bounces = 0, prevVy = turret.vy;
  for (let i = 0; i < 30 * 30; i++) {
    fx.update(st, MAP, [], 1 / 30, []);
    if (fx.wrecks.includes(hull)) seen.add(hull.phase);
    if (turret.falling && prevVy < 0 && turret.vy > 0) bounces++;
    prevVy = turret.vy;
    if (!fx.wrecks.length) break;
  }
  assert.deepEqual([...seen], ['burning', 'charred', 'sinking']);
  assert.ok(bounces <= 2);
  assert.equal(fx.wrecks.length, 0, 'removed once sunk');
  // timing: the hull is gone at burn + SINK_DELAY + SINK_TIME
  const fx2 = createImpacts();
  killFrame(fx2, tankView({ model: 'beetle' }), [kill()]);
  const h = fx2.wrecks[0];
  const life = h.burn + SINK_DELAY + SINK_TIME;
  let t = 0;
  while (fx2.wrecks.length && t < 40) { fx2.update(st, MAP, [], 0.05, []); t += 0.05; }
  assert.ok(Math.abs(t - life) < 0.06, `removed at ${t.toFixed(2)} s, expected ${life.toFixed(2)} s`);
});

test('burning wrecks keep emitting fire + smoke while they burn, and stop after', () => {
  const fx = createImpacts();
  killFrame(fx, tankView({ model: 'beetle' }), [kill()]);
  const h = fx.wrecks[0];
  const st = world({ tick: 7 });
  for (let i = 0; i < 60; i++) fx.update(st, MAP, [], 1 / 30, []);
  assert.ok(count(fx, K.FIRE) > 10 && count(fx, K.SMOKE) > 5);
  while (h.t < h.burn + 4) fx.update(st, MAP, [], 0.1, []);
  assert.equal(count(fx, K.FIRE), 0);
});

test('consume-once by tick + id: the same events delivered again (dropped / repeated frame) never double-fire', () => {
  const fx = createImpacts();
  const evs = [kill(), dmg({ tick: 6, targetId: 2, pos: { x: 3, y: 3 }, sourceId: -2 }), { type: 'destroyed', tick: 6, entityId: 100, pos: { x: 4, y: 4 } }];
  killFrame(fx, tankView(), evs);
  const st = world({ tick: 7 });
  fx.update(st, MAP, evs, 0, []);
  fx.update(st, MAP, evs.slice().reverse(), 0, []);
  assert.equal(fx.stats.kills, 1);
  assert.equal(fx.stats.grounds, 1);
  assert.equal(fx.stats.booms, 2, 'one kill boom + one structure boom');
  assert.equal(fx.wrecks.length, 2);
  assert.equal(fx.stats.consumed, 3);
  assert.equal(fx.stats.skipped, 6);
  // a NEW kill of another id on the same tick still fires
  fx.update(st, MAP, [kill({ entityId: 2 })], 0, []);
  assert.equal(fx.stats.kills, 2);
});

test('deterministic: the same frames give the same effects (seeded, no Math.random)', () => {
  const run = () => {
    const fx = createImpacts({ seed: 7 });
    killFrame(fx, tankView(), [kill()]);
    for (let i = 0; i < 40; i++) fx.update(world({ tick: 7 }), MAP, [], 1 / 30, []);
    return JSON.stringify([fx.particles.map((p) => [p.kind, p.x.toFixed(6), p.y.toFixed(6)]), fx.wrecks.map((w) => [w.x, w.y, w.z])]);
  };
  const orig = Math.random;
  Math.random = () => { throw new Error('Math.random used'); };
  try { assert.equal(run(), run()); } finally { Math.random = orig; }
});

test('read-only: frozen sim state and frozen events go through untouched', () => {
  const fx = createImpacts();
  const deep = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deep(v); return o; };
  const st = world({ tick: 5, units: [{ id: 1, unitId: 'tank', pos: { x: 10, y: 4 } }], structures: [tower] });
  for (const u of st.units.values()) deep(u);
  for (const s of st.structures.values()) deep(s);
  deep(st);
  const evs = deep([dmg(), kill({ entityId: 3 })]);
  assert.doesNotThrow(() => fx.update(st, MAP, evs, 1 / 60, [tankView()]));
});

test('caps: Low budget limits particles + decals, density thins every recipe, wreck lights off', () => {
  const fx = createImpacts({ caps: LOW_IMPACT_CAPS });
  assert.equal(fx.caps.wreckLights, false);
  killFrame(fx, tankView(), [kill()]);
  assert.equal(count(fx, K.SPARK), Math.round(28 * LOW_IMPACT_CAPS.density));
  assert.equal(count(fx, K.FIRE), Math.round(14 * LOW_IMPACT_CAPS.density));
  const st = world({ tick: 7 });
  for (let k = 0; k < 40; k++) fx.boom(16, 16, 1);
  assert.ok(fx.counts.additive <= LOW_IMPACT_CAPS.additive);
  assert.ok(fx.counts.smoke <= LOW_IMPACT_CAPS.smoke);
  assert.ok(fx.scorches.length <= LOW_IMPACT_CAPS.scorch && fx.glows.length <= LOW_IMPACT_CAPS.glow);
  assert.ok(fx.chunks.length <= LOW_IMPACT_CAPS.chunks);
  fx.update(st, MAP, [], 1 / 30, []);
  assert.equal(fx.counts.additive + fx.counts.smoke, fx.particles.length, 'live counts stay in step');
  // setCaps switches budgets live (quality tiers)
  fx.setCaps(DEFAULT_IMPACT_CAPS);
  assert.equal(fx.caps.additive, DEFAULT_IMPACT_CAPS.additive);
});

test('wreck eviction: past the per-model-per-part cap the OLDEST wreck goes first', () => {
  const fx = createImpacts({ caps: { ...LOW_IMPACT_CAPS, wrecks: 3 } });
  const st = world({ tick: 1 });
  for (let i = 0; i < 5; i++) fx.fxExplode({ model: 'beetle', scale: 1, x: i, y: 0, z: 0, heading: 0, aim: 0 });
  fx.update(st, MAP, [], 0, []);
  assert.equal(fx.wrecks.length, 3);
  assert.deepEqual(fx.wrecks.map((w) => w.x), [2, 3, 4], 'the two oldest were evicted');
  for (let i = 0; i < 2; i++) fx.fxExplode({ model: 'tank', scale: 1, x: 10 + i, y: 0, z: 0, heading: 0, aim: 0 });
  assert.equal(fx.wrecks.filter((w) => w.model === 'beetle').length, 3, 'other models do not evict beetles');
});

test('a restart (sim clock back) clears everything', () => {
  const fx = createImpacts();
  killFrame(fx, tankView(), [kill()]);
  assert.ok(fx.particles.length && fx.wrecks.length);
  fx.update({ tick: 0, time: 0, units: new Map(), structures: new Map() }, MAP, [], 0, []);
  assert.equal(fx.particles.length + fx.wrecks.length + fx.chunks.length + fx.scorches.length + fx.glows.length, 0);
});

test('the view: bounded batches — 5 particle/flame/decal draws [MM-task_mvfqzjkm_7] + chunks + one wreck mesh (and shadow) per model part', () => {
  const scene = new THREE.Scene();
  const units = createUnits3D(THREE, scene, { sunDir: { x: -0.5, y: 0.7, z: -0.5 } });
  const before = scene.children.length;
  const view = createImpactsView(THREE, scene, { lodGroups: units.lodGroups() });
  const parts = Object.values(units.lodGroups()).reduce((a, g) => a + Object.keys(g).length, 0);
  assert.equal(scene.children.length - before, 6 + parts * 2);   // + the flame flipbook batch
  const fx = createImpacts();
  // empty → nothing visible (no draw calls)
  view.sync(fx);
  assert.equal(scene.children.slice(before).filter((o) => o.visible).length, 0);
  killFrame(fx, tankView(), [kill()]);
  fx.update(world({ tick: 7 }), MAP, [], 1 / 30, []);
  const r = view.sync(fx);
  assert.equal(r.particles, fx.particles.length);
  assert.equal(r.wrecks, 2);
  assert.equal(r.chunks, fx.chunks.length);
  const vis = scene.children.slice(before).filter((o) => o.visible);
  assert.equal(vis.length, 6 + 2 * 2, 'particles ×2, flames, decals ×2, chunks, tank body + turret wrecks and their shadows');
  assert.ok(vis.every((o) => !o.material.depthWrite || o.isInstancedMesh), 'effect batches never write depth');
  assert.equal(view.add.mesh.material.blending, THREE.AdditiveBlending);
  assert.equal(view.wreckMesh.tank.body.sh.instanceMatrix, view.wreckMesh.tank.body.im.instanceMatrix, 'shadow shares the wreck matrices');
  view.sync(fx, false);
  assert.equal(view.wreckMesh.tank.body.sh.visible, false, 'no live shadows → no wreck shadows');
  view.dispose();
  assert.equal(scene.children.length, before);
  units.dispose();
});
