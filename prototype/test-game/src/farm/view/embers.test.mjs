// src/farm/view/embers.test.mjs — the harvest effect (Farming-Design §5.3) [MM-story_mwabh2oc_j]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { POD_LEVELS } from '../../data/farm.js';
import { createImpacts, K, EMBER_SHADE, LOW_IMPACT_CAPS } from '../../render3d/fx/impacts.js';
import { createImpactsView, farmEmberLook } from '../../render3d/fx/impactsView.js';
import { createFarmEmbers, emberParams, emberSeed, IDLE } from './embers.js';
import { plantSpots, FARM_Y } from './farmLayer.js';

// a farm: p1 Fruited (level from `lv`), p2 Dead, p3 growing — plotState reads progress / ripeAt against o.t
const NOW = 1e9;
function farmOf(lv = 3) {
  const plot = (id, x, extra) => ({ id, x, y: 10, w: 3, h: 3, method: 'traditional', prepDone: 0, crop: 'loam-grain', level: lv, plantedAt: 0, cycle: 2, yieldShare: 1, ...extra });
  return { seed: 77, t: NOW, farm: { plots: {
    p1: plot('p1', 4, { progress: 1, ripeAt: NOW - 1000 }),
    p2: plot('p2', 9, { progress: 1, ripeAt: NOW - 1e9 }),
    p3: plot('p3', 14, { progress: 0.5, ripeAt: null }),
  }, buildings: {} } };
}
const farmParticles = (fx) => fx.particles.filter((p) => p.kind === K.EMBER && p.shade === EMBER_SHADE.farm);
const step = (fx, n, dt = 1 / 30) => { for (let i = 0; i < n; i++) fx.update({ time: (i + 1) * dt, tick: i }, null, [], dt, null); };

test('the five levels: white, green, blue, purple, gold; count ×1.5 a level, lifetime and rise climbing', () => {
  assert.deepEqual(POD_LEVELS.map((l) => l.colour), ['#ffffff', '#4dff6a', '#4da6ff', '#b25cff', '#ffc83d']);
  const P = [1, 2, 3, 4, 5].map(emberParams);
  assert.deepEqual(P[0].col, [1, 1, 1]);
  for (let i = 1; i < 5; i++) {
    assert.ok(Math.abs(P[i].count / P[i - 1].count - 1.5) < 0.02, `count ×1.5 at level ${i + 1}`);
    assert.ok(P[i].life > P[i - 1].life && P[i].rise > P[i - 1].rise, `longer and higher at level ${i + 1}`);
    assert.equal(P[i].colour, POD_LEVELS[i].colour);
  }
  assert.equal(emberParams(99).level, 1);   // anything else reads as Common
});

test('a Fruited harvest bursts in its level colour from the plot\'s 16 plant spots, seeded per plot and cycle', () => {
  for (const lv of [1, 5]) {
    const o = farmOf(lv), fx = createImpacts({ seed: 3 }), F = createFarmEmbers();
    const out = F.harvest([{ plot: 'p1', kind: 'crop', level: lv, cycle: 2 }], o, fx, K);
    const ps = farmParticles(fx);
    assert.equal(out.embers, emberParams(lv).count);
    assert.equal(ps.length, out.embers);
    const look = emberParams(lv).col;
    for (const p of ps) assert.deepEqual(p.tc, look);
    // every one starts on a plant spot's own patch of the bed, above the ground; every spot throws
    const spots = plantSpots(o.farm.plots.p1), hit = new Set();
    for (const p of ps) {
      const i = spots.findIndex(([x, z]) => Math.abs(p.x - x) <= 3 / 8 + 1e-9 && Math.abs(p.z - z) <= 3 / 8 + 1e-9);
      assert.ok(i >= 0, 'on a plant spot');
      hit.add(i);
      assert.ok(p.y > FARM_Y && p.vy > 0, 'rising');
    }
    assert.equal(hit.size, 16);
  }
  // the same harvest throws the same embers; another cycle throws others
  const a = createImpacts(), b = createImpacts(), c = createImpacts();
  createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 2, cycle: 2 }], farmOf(2), a, K);
  createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 2, cycle: 2 }], farmOf(2), b, K);
  createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 2, cycle: 3 }], farmOf(2), c, K);
  assert.deepEqual(a.particles.map((p) => [p.x, p.y, p.z, p.vy, p.life]), b.particles.map((p) => [p.x, p.y, p.z, p.vy, p.life]));
  assert.notDeepEqual(a.particles.map((p) => p.x), c.particles.map((p) => p.x));
  assert.notEqual(emberSeed(77, 'p1', 2), emberSeed(77, 'p2', 2));
});

test('embers rise and wobble on value noise, then fade out at the top; no PRNG draw, no Math.random', () => {
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random in the ember path'); };
  try {
    const o = farmOf(4), fx = createImpacts();
    createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 4, cycle: 2 }], o, fx, K);
    const ps = farmParticles(fx), y0 = ps.map((p) => p.y), x0 = ps.map((p) => p.x);
    step(fx, 20);
    const alive = farmParticles(fx);
    assert.ok(alive.length > 0);
    assert.ok(alive.every((p) => p.y > y0[ps.indexOf(p)]), 'all risen');
    // each on its own path: sideways drift differs from ember to ember
    const drift = alive.map((p) => p.x - x0[ps.indexOf(p)]);
    assert.ok(new Set(drift.map((d) => d.toFixed(4))).size > alive.length / 2);
    // the look: fade in, full, fade out near the end of life
    const p = { t: 0, life: 2, tc: [0.3, 1, 0.4], ns: 5 };
    assert.equal(farmEmberLook(p)[3], 0);
    assert.ok(farmEmberLook({ ...p, t: 1 })[3] > 0.5);
    assert.ok(farmEmberLook({ ...p, t: 1.95 })[3] < 0.1);
    const dim = farmEmberLook({ ...p, t: 1, tc: [0.15, 0.5, 0.2] });
    assert.ok(Math.abs(Math.max(dim[0], dim[1], dim[2]) - 0.9) < 1e-9, 'brightened (additive, unlit)');
    const gold = emberParams(5).col, G = farmEmberLook({ ...p, t: 1, tc: gold });
    assert.ok(Math.max(G[0], G[1], G[2]) <= 1 + 1e-9 && Math.abs(G[1] / G[0] - gold[1] / gold[0]) < 1e-9, 'gold stays gold: no channel clips');
  } finally { Math.random = real; }
  // the battle's stream is unchanged by farm embers stepping beside it (they never draw from the effects' PRNG)
  const a = createImpacts({ seed: 9 }), b = createImpacts({ seed: 9 });
  createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 1, cycle: 2 }], farmOf(1), b, K);
  step(a, 5); step(b, 5);
  a.fxHit(3, 3, 1, 0); b.fxHit(3, 3, 1, 0);
  const sparks = (fx) => fx.particles.filter((p) => p.kind === K.SPARK).map((p) => [p.vx, p.vy, p.vz, p.life]);
  assert.deepEqual(sparks(a), sparks(b));
});

test('idle embers drift off each Fruited plot only, capped a frame — and none in safe mode', () => {
  const o = farmOf(3), fx = createImpacts(), F = createFarmEmbers();
  let n = 0;
  for (let i = 0; i < 30; i++) n += F.step(1 / 30, o, fx, K);
  assert.ok(n > 0);
  const spots = plantSpots(o.farm.plots.p1);
  for (const p of farmParticles(fx)) assert.ok(Math.abs(p.x - (4 + 1.5)) < 2.5, 'over p1 only');
  assert.ok(spots.length === 16);
  // capped per frame however many plots wait
  const big = farmOf(5);
  for (let i = 0; i < 40; i++) big.farm.plots['q' + i] = { ...big.farm.plots.p1, id: 'q' + i, x: 20 + i * 4 };
  assert.ok(createFarmEmbers().step(0.2, big, createImpacts(), K) <= IDLE.maxPerFrame);
  // safe mode: no idle embers at all
  const S = createFarmEmbers({ safe: true }), fs = createImpacts();
  let m = 0;
  for (let i = 0; i < 60; i++) m += S.step(1 / 30, o, fs, K);
  assert.equal(m, 0);
  assert.equal(fs.particles.length, 0);
});

test('a dead plot\'s harvest puffs grey-brown dust, no embers', () => {
  const o = farmOf(5), fx = createImpacts();
  const out = createFarmEmbers().harvest([{ plot: 'p2', kind: 'pods', level: 5, cycle: 2 }], o, fx, K);
  assert.equal(out.embers, 0);
  assert.ok(out.dust > 0);
  assert.equal(fx.particles.filter((p) => p.kind === K.EMBER).length, 0);
  const smoke = fx.particles.filter((p) => p.kind === K.SMOKE);
  assert.ok(smoke.length > 0 && smoke.every((p) => p.dusty));
  const spots = plantSpots(o.farm.plots.p2);
  for (const p of smoke) assert.ok(spots.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.3));
});

test('the Low tier: HARVEST ALL of many Legendary plots stays inside the pool', () => {
  const o = farmOf(5), plots = [];
  for (let i = 0; i < 12; i++) { const id = 'q' + i; o.farm.plots[id] = { ...o.farm.plots.p1, id, x: 20 + i * 4 }; plots.push({ plot: id, kind: 'crop', level: 5, cycle: 2 }); }
  const fx = createImpacts({ caps: LOW_IMPACT_CAPS });
  const out = createFarmEmbers().harvest(plots, o, fx, K);
  assert.ok(out.embers <= LOW_IMPACT_CAPS.additive && fx.counts.additive <= LOW_IMPACT_CAPS.additive);
  // thinned alike: every plot still throws some
  for (const h of plots) assert.ok(farmParticles(fx).some((p) => Math.abs(p.x - (o.farm.plots[h.plot].x + 1.5)) < 1.6));
});

test('the view draws a farm ember in its colour; the battle\'s shades are byte-for-byte unchanged', () => {
  // golden: a fixed battle sequence (hits, ground hits, a boom, a burn, repair / damage sparks and flashes, wreck
  // embers, dust) drawn through the view, hashed — recorded before the farm shade was added
  const fx = createImpacts({ seed: 7 });
  const view = createImpactsView(THREE, new THREE.Scene(), {});
  const hash = (arr) => { let h = 2166136261; for (const x of new Uint32Array(new Float32Array(arr).buffer)) h = Math.imul(h ^ x, 16777619) >>> 0; return h; };
  fx.fxHit(3, 4, 1, 0); fx.fxGround(5, 5); fx.boom(6, 2, 1, true); fx.burn(2, 2, 0.6, 3);
  for (let i = 0; i < 6; i++) {
    fx.emit(K.SPARK, 1, 0.5, 1, 1, 2, 0.5, 0.8, 0.02, 0, 1 + (i % 2)); fx.emit(K.FLASH, 1, 0.5, 1, 0, 0, 0, 0.3, 0.4, 0, i % 3);
    fx.emit(K.EMBER, 2, 0.3, 2, 0.1, 1.5, -0.1, 1.4, 0.012); fx.emit(K.DUST, 2, 0.1, 2, 0.5, 1, 0.2, 0.6, 0.04);
  }
  const out = [];
  let t = 0;
  for (let f = 0; f < 20; f++) {
    t += 1 / 30; fx.update({ time: t, tick: f }, null, [], 1 / 30, null);
    const n = view.sync(fx);
    if (f % 5 === 4) out.push([n.particles, hash(view.add.a.iCol.array.slice(0, view.add.n * 4)), hash(view.add.a.iPos.array.slice(0, view.add.n * 3)), hash(view.smoke.a.iCol.array.slice(0, view.smoke.n * 4))]);
  }
  assert.deepEqual(out, [[106, 3188994802, 3684640007, 993326142], [97, 2242712774, 2496537092, 931531928], [86, 3029885636, 1493914617, 2615894622], [76, 2789336105, 605732724, 172115599]]);

  // a farm ember: drawn in the additive batch in its level's colour
  const g = createImpacts(), v2 = createImpactsView(THREE, new THREE.Scene(), {});
  createFarmEmbers().harvest([{ plot: 'p1', kind: 'crop', level: 5, cycle: 2 }], farmOf(5), g, K);
  step(g, 10);
  v2.sync(g);
  const C = v2.add.a.iCol.array, gold = emberParams(5).col;
  assert.ok(v2.add.n > 0);
  for (let i = 0; i < v2.add.n; i++) {
    const a = C[i * 4 + 3];
    if (a <= 0) continue;
    assert.ok(Math.abs(C[i * 4] / C[i * 4 + 2] - gold[0] / gold[2]) < 1e-3, 'gold, not the battle ember\'s orange');
  }
});
