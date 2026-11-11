// Outpost construction FX (owner 2026-11-08): dust round a job, welding sparks from a point that moves every 4 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionSites, createConstructionFx, WELD_CYCLE } from './constructionFx.js';

const map = { pads: [{ id: 'p1', x: 4, y: 6, w: 4, h: 4 }] };
const K = { SPARK: 0, FLASH: 2, SMOKE: 4 };
const job = (done) => ({ building: [{ pad: 'p1', kind: 'power', tier: 1, done }] });

test('a job is a building site until its time; progress grows', () => {
  const s = constructionSites(job(10_000), map, 0);
  assert.equal(s.length, 1);
  assert.equal(s[0].lifecycle, 'Building');
  assert.deepEqual(s[0].footprint, { w: 4, h: 4 });
  assert.equal(constructionSites(job(10_000), map, 10_000).length, 0, 'finished jobs throw nothing');
  assert.ok(constructionSites(job(10_000), map, 5_000)[0].progress > s[0].progress);
});

test('dust and sparks while building; the weld point moves every WELD_CYCLE seconds', () => {
  const fx = createConstructionFx({ seed: 3 });
  const sites = constructionSites(job(1e9), map, 0);
  const sparkAt = [];
  const emit = (k, x, y, z) => { if (k === K.SPARK) sparkAt.push([x, y, z]); };
  let puffs = 0, sparks = 0;
  for (let i = 0; i < 30; i++) { const r = fx.step(0.1, sites, emit, K); puffs += r.puffs; sparks += r.sparks; }
  assert.ok(puffs > 0, 'dust');
  assert.ok(sparks > 0, 'sparks');
  const first = sparkAt[0];
  assert.ok(sparkAt.every((p) => p[0] === first[0] && p[2] === first[2]), 'one weld point inside the cycle');
  for (let i = 0; i < (WELD_CYCLE / 0.1) + 5; i++) fx.step(0.1, sites, emit, K);
  assert.ok(sparkAt.some((p) => p[0] !== first[0] || p[2] !== first[2]), 'the welder moved on');
});

test('the dust is four times the battle build dust', async () => {
  const { createBuildFx } = await import('../../render3d/fx/buildFx.js');
  const { DUST_MULT } = await import('./constructionFx.js');
  assert.equal(DUST_MULT, 4);
  const sites = constructionSites(job(1e9), map, 0);
  const fx = createConstructionFx({ seed: 9 }), battle = createBuildFx({ seed: 9 });
  let ours = 0, theirs = 0;
  for (let i = 0; i < 50; i++) { ours += fx.step(0.05, sites, () => {}, K).puffs; theirs += battle.step(0.05, { structures: new Map(sites.map((s) => [s.id, s])) }, null, () => {}, K); }
  assert.ok(Math.abs(ours - 4 * theirs) <= 4, ours + ' vs 4 x ' + theirs);
});

// Red sparks on damaged defenses (owner 2026-11-09: "when a structure is damage there should be red sparks, just like
// the blue construction sparks").
import { damageSites, DAMAGE_RATE } from './constructionFx.js';
import { SPARK_TINT } from '../../render3d/fx/repairFx.js';
import { structureDef } from '../../data/outpost.js';
test('a damaged defense throws red sparks, more the worse it is; a whole one throws none', () => {
  const max = structureDef('mg', 1).battle.hp;
  const o = { defenses: [
    { id: 'd1', kind: 'mg', tier: 1, cell: [30, 10], hp: max },          // whole
    { id: 'd2', kind: 'mg', tier: 1, cell: [31, 10], hp: max * 0.9 },    // scratched
    { id: 'd3', kind: 'mg', tier: 1, cell: [32, 10], hp: 0 },            // wrecked
  ] };
  const sites = damageSites(o);
  assert.deepEqual(sites.map((s) => s.id), ['dmg-d2', 'dmg-d3']);
  assert.ok(Math.abs(sites[0].damage - 0.1) < 1e-9 && sites[1].damage === 1);
  const count = (list) => {
    const fx = createConstructionFx({ seed: 3 }), shades = [];
    let n = 0;
    for (let i = 0; i < 60; i++) n += fx.stepDamage(1 / 30, list, (kind, x, y, z, vx, vy, vz, life, size, grow, shade) => { if (kind === 'S') shades.push(shade); }, { SPARK: 'S', FLASH: 'F' });
    return { n, shades };
  };
  const light = count([sites[0]]), heavy = count([sites[1]]);
  assert.ok(heavy.n > light.n * 3, `a wreck sparks more (${heavy.n} vs ${light.n})`);
  assert.ok(Math.abs(heavy.n - DAMAGE_RATE.heavy * 2) <= 2, 'about DAMAGE_RATE.heavy a second');
  assert.ok(heavy.shades.length && heavy.shades.every((s) => s === SPARK_TINT.damage), 'red (the damage tint)');
  assert.equal(count([]).n, 0);
});
