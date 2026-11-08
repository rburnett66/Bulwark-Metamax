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
