// T5 [MM-story_mv77hv5d_7] — 3D unit models: geometry, LOD, roster mapping, sim → view, single source.
// Geometry uses the VENDORED three.js module (committed, so CI has it) — BufferGeometry needs no WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../../vendor/three.module.js';
import { UNIT_MODELS } from './models.js';
import { createPrims, track } from './prims.js';
import { lodDef, partSize, LOD_MAX_CYL_SEG, isDetail } from './lod.js';
import { mergeModelGroups, UNIT_COLORS } from './models3d.js';
import { MODEL_KEYS, ART_CLASS_MODELS, resolveUnitModel } from './modelKeys.js';
import { buildUnitViews, createModelResolver, targetPos, HOVER_HEIGHT } from './unitViews.js';
import { createHeadingTracker } from '../heading.js';
import { UNITS, SYSTEM_UNITS } from '../../data/tables.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '../../..');
const sumTris = (groups) => Object.values(groups).reduce((a, g) => a + g.tris, 0);

// ── geometry ──────────────────────────────────────────────────────────────────────────────────────
// Golden numbers: FULL = the prototype's measured UNITTRIS (code design §6.2). LOD re-measured 2026-10-14 after
// [MM-story_mv8iu7l4_d] — the prototype's LOD (1272 / 680 / 1492 / 602) had dropped every extruded part.
// A change here is a model change.
const GOLDEN = { tank: [3362, 1534], buggy: [1260, 760], beetle: [2748, 1724], jet: [994, 698], tiger: [3660, 1520], copter: [1720, 920], drone: [1708, 1496], miner: [4524, 1320],
  air_troops: [1436, 1020], air_scout: [1192, 912], air_tank: [2580, 1128], air_artillery: [3456, 2000], air_heavy: [3470, 1338], air_gunship: [1788, 1444], air_fighter: [1112, 832], air_missile: [2084, 1756], air_bomber: [1512, 796] };   // AIR faction models from the owner's concepts [MM-story_mvh8woji_1]   // copter + drone: owner sheets 2026-10-18 [MM-story_mvehe3sy_j]; miner: the System harvester [MM-story_mvg3xsca_1x]

test('the approved models build to their golden triangle counts, full and LOD', () => {
  assert.deepEqual([...MODEL_KEYS].sort(), Object.keys(GOLDEN).sort());
  const prims = createPrims(THREE);
  for (const [key, [full, lod]] of Object.entries(GOLDEN)) {
    assert.equal(sumTris(mergeModelGroups(THREE, UNIT_MODELS[key], prims)), full, `${key} full`);
    assert.equal(sumTris(mergeModelGroups(THREE, lodDef(UNIT_MODELS[key]), prims)), lod, `${key} LOD`);
  }
});

test('groups and pivots: tank and buggy have a turret group on their pivot; beetle and jet are one body', () => {
  for (const key of MODEL_KEYS) {
    const g = mergeModelGroups(THREE, UNIT_MODELS[key]);
    const hasTurret = !!(UNIT_MODELS[key].pivots && UNIT_MODELS[key].pivots.turret);
    const hasBarrel = !!(UNIT_MODELS[key].pivots && UNIT_MODELS[key].pivots.barrel);   // the gun pitches on its own group [MM-story_mvedy16u_9]
    const guns = Object.keys(UNIT_MODELS[key].pivots || {}).filter((n) => n.startsWith('barrel'));   // the twin tank has barrel + barrel2
    const spins = Object.keys(UNIT_MODELS[key].pivots || {}).filter((n) => n.startsWith('spin'));   // rotors and fans [MM-story_mvehe3sy_j]
    assert.deepEqual(Object.keys(g).sort(), [...(hasTurret ? [...(hasBarrel ? guns : []), 'turret'] : []), ...spins, 'body'].sort(), key);
    for (const n of spins) assert.ok(UNIT_MODELS[key].spin[n], `${key}: ${n} has a spin axis/speed`);
    if (hasTurret) assert.deepEqual(g.turret.pivot.toArray(), UNIT_MODELS[key].pivots.turret, `${key} turret pivot`);
    for (const G of Object.values(g)) {
      for (const a of ['position', 'normal', 'color', 'aEmit']) assert.ok(G.geo.getAttribute(a), `${key} has ${a}`);
      assert.equal(G.geo.getAttribute('position').count, G.geo.getAttribute('aEmit').count);
    }
  }
});

test('every material key the models use has a colour (magenta would mean a missing one)', () => {
  const used = new Set();
  for (const def of Object.values(UNIT_MODELS)) for (const p of def.parts) used.add([def.colors || UNIT_COLORS, p.m || 'hull']);   // def.colors: a model in another palette (the System miner)
  for (const [pal, k] of used) assert.ok(k in pal, `material key "${k}" has no colour`);
});

// ── LOD ───────────────────────────────────────────────────────────────────────────────────────────
test('LOD drops detail and sub-threshold parts, keeps glow strips, caps cylinders at 6 sides', () => {
  const def = { parts: [
    { t: 'box', s: [1, 1, 1], m: 'hull' },                 // kept
    { t: 'box', s: [0.05, 0.03, 0.5], m: 'black', d: 1 },  // detail flag → dropped
    { t: 'box', s: [0.5, 0.05, 0.05], m: 'hull' },         // middle extent 0.05 < 0.12 → dropped
    { t: 'box', s: [0.5, 0.06, 0.03], m: 'glow' },         // glow: 0.06 ≥ 0.05 → kept
    { t: 'cyl', r: 0.3, l: 1, seg: 12, m: 'dark' },        // kept, seg capped
    { t: 'loft', secs: [], m: 'hull' },                    // non box/cyl → always kept
  ] };
  const lod = lodDef(def);
  assert.deepEqual(lod.parts.map((p) => p.t + ':' + p.m), ['box:hull', 'box:glow', 'cyl:dark', 'loft:hull']);
  assert.equal(lod.parts.find((p) => p.t === 'cyl').seg, LOD_MAX_CYL_SEG);
  assert.equal(def.parts[4].seg, 12, 'the source definition is not mutated');
  assert.equal(partSize({ t: 'cyl', r: [0.1, 0.4], l: 2 }), 0.8);
});

test('REGRESSION: the LOD keeps every extruded / lofted / ellipsoid part — `d: [from, to]` is a depth, not the detail flag', () => {
  for (const [key, def] of Object.entries(UNIT_MODELS)) {
    const kept = new Set(lodDef(def).parts.map((p) => JSON.stringify({ ...p, seg: undefined })));
    const lost = def.parts.filter((p) => ['ext', 'loft', 'ell'].includes(p.t) && !kept.has(JSON.stringify({ ...p, seg: undefined })));
    assert.deepEqual(lost.map((p) => `${p.t}/${p.m}`), [], `${key} keeps its silhouette at far zoom`);
  }
  assert.equal(isDetail({ t: 'ext', d: [0.4, 0.6] }), false, 'an extrusion depth range is not the detail flag');
  assert.equal(isDetail({ t: 'box', d: 1 }), true);
  assert.equal(isDetail({ t: 'cyl', d: 0 }), false, 'd: 0 (glow hubs) is kept');
  // the four models actually have extruded parts, so this test can fail
  assert.ok(Object.values(UNIT_MODELS).every((d) => d.parts.some((p) => p.t === 'ext')));
});

// ── roster → model ────────────────────────────────────────────────────────────────────────────────
const ROSTER = { ...UNITS, ...SYSTEM_UNITS };
const MOBILE = Object.entries(ROSTER).filter(([, d]) => d.domain !== 'Structure');

test('every mobile unit in the roster resolves to one of the four models — none through the domain default', () => {
  assert.ok(MOBILE.length >= 70, `roster has ${MOBILE.length} mobile units`);
  const viaDomain = [];
  for (const [id, def] of MOBILE) {
    const r = resolveUnitModel(id, def);
    assert.ok(MODEL_KEYS.includes(r.model), `${id} → ${r.model}`);
    assert.ok(r.scale > 0, `${id} scale`);
    if (r.via === 'domain') viaDomain.push(`${id} (${def.artClass})`);
  }
  assert.deepEqual(viaDomain, [], 'unmapped artClass — add it to ART_CLASS_MODELS');
});

test('STAND-INS are listed, not silent: exactly these classes borrow another class\'s model', () => {
  const standIns = Object.entries(ART_CLASS_MODELS).filter(([, e]) => !e.exact).map(([c, e]) => `${c}→${e.model}`).sort();
  // Shrinks as the Stack Forge model pipeline (UMP) authors each class's own model. Update deliberately.
  assert.deepEqual(standIns, ['artillery→tank', 'heavyBomber→jet', 'infantry→beetle', 'truck→buggy']);   // copter + drone have their own models [MM-story_mvehe3sy_j]
  const used = new Set(MOBILE.map(([, d]) => d.artClass));
  for (const c of Object.keys(ART_CLASS_MODELS)) assert.ok(used.has(c), `ART_CLASS_MODELS.${c} is used by the roster`);
  assert.equal(resolveUnitModel('SYS-Harvester', ROSTER['SYS-Harvester']).via, 'unitId');
});

test('an unknown unit id still gets a visible model (flyer → jet, else tank)', () => {
  const resolve = createModelResolver(() => { throw new Error('unknown'); });
  assert.equal(resolve('NOPE-1').model, 'tank');
  assert.equal(resolveUnitModel('x', { domain: 'Flyer', artClass: 'zeppelin' }).model, 'jet');
});

// ── sim → view ────────────────────────────────────────────────────────────────────────────────────
function simState() {
  const units = new Map([
    [1, { id: 1, unitId: 'GND-Tanks', pos: { x: 2, y: 3 }, altitude: 0, targetId: 2 }],
    [2, { id: 2, unitId: 'GND-Trucks', artKey: 'SYS-Harvester', isHarvester: true, pos: { x: 2, y: 6 }, altitude: 0, targetId: null }],
    [3, { id: 3, unitId: 'GND-Planes', pos: { x: 9, y: 9 }, altitude: 1, targetId: BASE_TARGET_ID }],
    [4, { id: 4, unitId: 'GND-Tanks', pos: { x: 0, y: 0 }, altitude: 0, targetId: 50 }],
  ]);
  const structures = new Map([[50, { id: 50, pos: { x: 3, y: 0 } }]]);
  return { units, structures };
}

test('views: cell-centre positions, flyers hover, turrets aim at unit / structure / base targets', () => {
  const map = { base: { x: 9, y: 4 } };
  const v = buildUnitViews(simState(), map, createHeadingTracker(), createModelResolver());
  const by = Object.fromEntries(v.map((u) => [u.id, u]));
  assert.deepEqual([by[1].x, by[1].z, by[1].y, by[1].model], [2.5, 3.5, 0, 'tank']);
  assert.ok(Math.abs(by[1].aim - Math.PI / 2) < 1e-12, 'aims south at unit 2');
  assert.equal(by[2].model, 'miner');   // spawned as GND-Trucks + artKey SYS-Harvester (sim/harvest.js); the harvester draws as the System miner (was the buggy stand-in) [MM-story_mvg3xsca_1x]
  assert.equal(by[2].aim, by[2].heading, 'no target → turret along the hull');
  assert.equal(by[3].y, HOVER_HEIGHT);
  assert.ok(Math.abs(by[3].aim - (-Math.PI / 2)) < 1e-12, 'aims north at the base');
  assert.ok(Math.abs(by[4].aim) < 1e-12, 'aims east at structure 50');
});

test('views: headings follow motion and dead units are forgotten; a vanished target falls back to the hull', () => {
  const s = simState(), h = createHeadingTracker(), resolve = createModelResolver(), map = {};
  buildUnitViews(s, map, h, resolve);
  s.units.get(2).pos = { x: 3, y: 6 };          // harvester drives east
  s.units.delete(4);
  const v = buildUnitViews(s, map, h, resolve);
  assert.equal(v.find((u) => u.id === 2).heading, 0);
  assert.equal(h.size, 3, 'unit 4 swept');
  assert.equal(targetPos(s, map, 999), null);
  assert.equal(targetPos(s, map, BASE_TARGET_ID), null, 'no base on the map → no aim point');
});

// ── single source ─────────────────────────────────────────────────────────────────────────────────
test('the tools build from the game\'s units modules — no second copy, classic form strips import/export', async () => {
  assert.ok(!fs.existsSync(path.join(GAME, 'tools/unit-models/src/prims.js')), 'old tool copy of prims.js is gone');
  assert.ok(!fs.existsSync(path.join(GAME, 'tools/unit-models/src/models.js')), 'old tool copy of models.js is gone');
  const { classicUnitsSource } = await import('../../../tools/unit-models/classic.mjs');
  const src = classicUnitsSource();
  assert.doesNotMatch(src, /^\s*(import|export)\s/m);
  assert.match(src, /var Prims = createPrims\(THREE\);/);
  assert.match(src, /const UNIT_MODELS = M;/);
  // the classic script runs as-is given a THREE global and yields the same models
  const fn = new Function('THREE', src + '\nreturn { Prims, UNIT_MODELS };');
  const { Prims, UNIT_MODELS: classicModels } = fn(THREE);
  assert.deepEqual(Object.keys(classicModels), Object.keys(UNIT_MODELS));
  assert.equal(Prims.buildModel(classicModels.tank, () => new THREE.MeshBasicMaterial()).tris, GOLDEN.tank[0]);
  assert.equal(typeof track, 'function');
});
