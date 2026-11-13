// Owner 2026-11-13 [MM-story_mwf8eikt_5]: "when outpost buildings are constructed they should have dust clouds and
// sparks". The outpost's structures already share the battle's build FX; the farm's buildings are not sim structures,
// so they join as extra build sites (state.extraBuildSites).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { farmBuildSites } from '../model.js';
import { farmBuildingOf } from '../../data/farm.js';
import { createBuildFx, fxStructures } from '../../render3d/fx/buildFx.js';
import { createStructureFx } from '../../render3d/fx/structureFx.js';

const K = new Proxy({}, { get: (_, k) => k });
const T = 1_000_000;
const o = { farm: { buildings: {
  b1: { kind: 'silo', x: 10, y: 12, w: 2, h: 2, tier: 1, done: T + farmBuildingOf('silo').buildSec * 500 },   // half built
  b2: { kind: 'farmhouse', x: 4, y: 4, w: 2, h: 2, tier: 1, done: T - 1 },                                      // finished
} } };

test('a farm building under construction is a build site; a finished one is not', () => {
  const sites = farmBuildSites(o, T);
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0].pos, { x: 10, y: 12 });
  assert.deepEqual(sites[0].footprint, { w: 2, h: 2 });
  assert.equal(sites[0].lifecycle, 'Building');
  assert.ok(Math.abs(sites[0].progress - 0.5) < 1e-9);
});

test('the battle build FX raise dust and welding sparks at an extra build site', () => {
  const state = { structures: new Map(), extraBuildSites: () => farmBuildSites(o, T) };
  assert.equal(fxStructures(state).length, 1);
  const got = [];
  const emit = (...a) => { got.push(a); };
  const dust = createBuildFx({ seed: 3 }), sparks = createStructureFx({ seed: 5 });
  let puffs = 0, weld = 0;
  for (let i = 0; i < 30; i++) { puffs += dust.step(1 / 30, state, [], emit, K, null, 'high') || 0; weld += sparks.step(1 / 30, state, emit, K, 'high').weld; }
  assert.ok(puffs > 0, 'dust puffs: ' + puffs);
  assert.ok(weld > 0, 'welding sparks: ' + weld);
  assert.equal(fxStructures({ structures: new Map() }).length, 0, 'a battle (no extra sites) is unchanged');
});

test('the session view hands the farm\'s build sites to the live state', () => {
  const src = readFileSync(new URL('../../outpost/view/sessionView.js', import.meta.url), 'utf8');
  assert.match(src, /sim\.extraBuildSites = \(\) => farmSites\(\)/);
});
