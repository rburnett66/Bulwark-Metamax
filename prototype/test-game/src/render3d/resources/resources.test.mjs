// LC-RES [MM-story_mvbks25v_5] — the 36 planet resource models and the field planner.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import { PLANETS } from '../../data/planets.js';
import { RESOURCE_MODELS, TIERS, resourceModel, tierOf, planResources } from './models.js';
import { mergeResourceModel, createResources3D } from './resources3d.js';

test('a model for every planet × tier, named after the planet data', () => {
  assert.equal(Object.keys(RESOURCE_MODELS).length, Object.keys(PLANETS).length * 4);
  for (const [key, P] of Object.entries(PLANETS)) {
    for (const tier of TIERS) {
      const m = resourceModel(key, tier);
      assert.ok(m, `${key}.${tier}`);
      assert.equal(m.name, P.resources[tier].name, `${key}.${tier} is ${P.resources[tier].name}`);
    }
  }
});

test('every model: palette covers its keys, it fits on one cell, and it has something that glows or reads', () => {
  for (const m of Object.values(RESOURCE_MODELS)) {
    for (const p of m.parts) assert.ok(m.palette[p.m], `${m.key}: ${p.m} has a colour`);
    const g = mergeResourceModel(THREE, m);
    const box = new THREE.Box3();
    for (const geo of [g.lit, g.glow]) if (geo) { geo.computeBoundingBox(); box.union(geo.boundingBox); }
    assert.ok(box.min.x >= -0.5 && box.max.x <= 0.5 && box.min.z >= -0.5 && box.max.z <= 0.5, `${m.key}: inside one cell (${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)} × ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)})`);
    assert.ok(box.max.y <= 1.0 && box.min.y >= -0.15, `${m.key}: height ${box.max.y.toFixed(2)}`);
    assert.ok(g.tris > 20 && g.tris < 2500, `${m.key}: ${g.tris} triangles`);
  }
});

test('tierOf: primary → common, premium → uncommon, quest red → rare, quest green → epic', () => {
  assert.equal(tierOf({ role: 'primary', color: 'blue' }), 'common');
  assert.equal(tierOf({ role: 'premium', color: 'yellow' }), 'uncommon');
  assert.equal(tierOf({ role: 'quest', color: 'red' }), 'rare');
  assert.equal(tierOf({ role: 'quest', color: 'green' }), 'epic');
  assert.equal(tierOf({}), 'common');
});

test('planResources: drains in quarters, hides unrevealed and consumed nodes, keeps regrowing stubs, rings carry role colour', () => {
  const nodes = [
    { id: 'a', role: 'primary', color: 'blue', x: 3, y: 4, units: 40, remaining: 40, wave: 1 },
    { id: 'b', role: 'premium', color: 'yellow', x: 5, y: 4, units: 40, remaining: 9, wave: 1 },
    { id: 'c', role: 'quest', color: 'green', x: 7, y: 4, units: 40, remaining: 40, wave: 6 },
    { id: 'd', role: 'primary', color: 'blue', x: 9, y: 4, units: 40, remaining: 0, respawns: true, wave: 1 },
    { id: 'e', role: 'quest', color: 'red', x: 9, y: 6, units: 40, remaining: 0, wave: 1 },
  ];
  const P = planResources(nodes, 2);
  assert.equal(P.byTier.common.length, 2, 'fresh primary + regrowing stub');
  assert.equal(P.byTier.uncommon.length, 1);
  assert.equal(P.byTier.epic.length, 0, 'wave-6 node not revealed yet');
  assert.equal(P.byTier.rare.length, 0, 'consumed quest node gone');
  const [fresh, stub] = P.byTier.common;
  assert.deepEqual([fresh.x, fresh.z], [3.5, 4.5]);
  assert.equal(stub.dim, 0.45);
  assert.ok(P.byTier.uncommon[0].s < fresh.s, 'a drained field is smaller');
  assert.deepEqual(P.rings.map((r) => r.color), ['blue', 'yellow', 'blue']);
  assert.equal(planResources(nodes, 2).sig, P.sig, 'deterministic');
  assert.notEqual(planResources(nodes, 6).sig, P.sig, 'a new ring changes the set');
});

test('renderer: builds every planet, lays out a state, says when the static set changed', () => {
  const scene = new THREE.Scene();
  for (const key of Object.keys(PLANETS)) {
    const r = createResources3D(THREE, scene, key);
    assert.equal(r.complete, true, `${key}: four models`);
    const state = { waves: { current: 1 }, resourceNodes: [{ id: 'n1', role: 'primary', color: 'blue', x: 2, y: 2, units: 10, remaining: 10, wave: 1 }] };
    assert.equal(r.setResources(state), true);
    assert.equal(r.setResources(state), false, 'unchanged → no shadow re-render');
    r.dispose();
  }
  assert.equal(scene.children.length, 0);
});
