// The capacity gauge in the outpost scene [MM-task_mwd3zlwd_6]: which buildings it drives and with which fill — the
// Storage Tower's is the OUTPOST panel's own "Storage units / cap" (hudModel storage.frac, the rigs' bays pooled), the
// Resource Bay's is its hopper — and the scene applies it on sync, to those models only, without rebuilding them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { planBuildings } from './conduits.js';
import { hudModel } from './hudModel.js';
import { gaugeFill, createOutpostScene } from './outpostScene.js';
import { referenceOutpost, confirmOnline, advance, place } from '../model.js';
import { map, T0, MIN, HOUR, freeSpot } from './fixtures.mjs';

const online = () => confirmOnline(referenceOutpost('ground', { seed: 7, map, now: T0 }), map, T0).outpost;
const quiet = { map, raid: null };

test('gaugeFill: the Storage Tower shows the panel\'s pooled storage fraction; other buildings have no gauge', () => {
  for (const o of [online(), advance(online(), T0 + 40 * MIN, quiet).outpost, advance(online(), T0 + 5 * HOUR, quiet).outpost]) {
    const plan = planBuildings(o, map, o.t), h = hudModel(o, map, { gold: 0, now: o.t });
    const towers = plan.filter((b) => b.kind === 'storage');
    assert.ok(towers.length >= 1);
    for (const t of towers) assert.ok(Math.abs(gaugeFill(t) - h.storage.frac) < 1e-12, `tower = panel (${gaugeFill(t)} vs ${h.storage.frac})`);
    for (const b of plan.filter((x) => !['storage', 'resourceBay', 'harvesterBay'].includes(x.kind))) assert.equal(gaugeFill(b), null, b.kind);
  }
  const full = advance(online(), T0 + 5 * HOUR, quiet).outpost;
  assert.equal(gaugeFill(planBuildings(full, map, full.t).find((b) => b.kind === 'storage')), 1);
});

test('gaugeFill: a finished Resource Bay shows its hopper (hudModel hopper.frac); one still building shows nothing', () => {
  let o = online();
  o = place(o, { pad: 'f1', kind: 'harvesterBay', at: freeSpot(o, 'resourceBay') }, { map, now: T0, gold: 1e9, unlockedTiers: ['common'] }).outpost;
  assert.equal(gaugeFill(planBuildings(o, map, T0).find((b) => b.pad === 'f1')), null, 'under construction');
  o = advance(o, T0 + 2 * HOUR, quiet).outpost;
  const bay = planBuildings(o, map, o.t).find((b) => b.pad === 'f1'), h = hudModel(o, map, { gold: 0, now: o.t });
  assert.ok(bay && Number.isFinite(gaugeFill(bay)));
  assert.ok(Math.abs(gaugeFill(bay) - (h.hopper ? h.hopper.frac : 0)) < 1e-12);
});

// a stand-in model kit: every slug has a model; each instance records the gauge fills it was given
function fakeKit() {
  const made = [];
  return {
    made,
    manifest: new Proxy({}, { get: (_, k) => (typeof k === 'string' ? { anchors: {} } : undefined) }),
    async make(slug) {
      const inst = { slug, object: new THREE.Group(), anchors: {}, nodes: {}, nodesOf: () => [], gaugeCalls: [],
        setWorking() {}, setLook() {}, update() {}, dispose() {}, setGauge(f) { inst.gaugeCalls.push(f); } };
      made.push(inst);
      return inst;
    },
  };
}

test('the scene drives setGauge on storage towers only, live on every sync', async () => {
  const kit = fakeKit();
  const r = { scene: new THREE.Scene(), lights: { invalidateShadows() {} }, camera: new THREE.PerspectiveCamera() };
  let sc;
  try { sc = createOutpostScene(THREE, r, { map, kit, reduced: true }); } catch (e) { assert.fail('scene builds headless: ' + e.message); }
  const o1 = advance(online(), T0 + 20 * MIN, quiet).outpost;
  sc.sync(o1, o1.t);
  await new Promise((ok) => setTimeout(ok, 0));   // the models load
  sc.sync(o1, o1.t);
  const storage = kit.made.filter((i) => i.slug === 'storage'), others = kit.made.filter((i) => i.slug !== 'storage' && i.slug !== 'resourceBay');
  assert.ok(storage.length >= 1 && others.length >= 2);
  const f1 = hudModel(o1, map, { gold: 0, now: o1.t }).storage.frac;
  assert.ok(f1 > 0 && f1 < 1);
  for (const s of storage) assert.ok(Math.abs(s.gaugeCalls.at(-1) - f1) < 1e-12);
  for (const x of others) assert.deepEqual(x.gaugeCalls, [], x.slug);
  // the level follows the outpost on the next sync, with no new model
  const n = kit.made.length;
  const o2 = advance(o1, T0 + 5 * HOUR, quiet).outpost;
  sc.sync(o2, o2.t);
  assert.equal(kit.made.length, n, 'no rebuild');
  for (const s of storage) assert.equal(s.gaugeCalls.at(-1), 1);
  sc.dispose();
});
