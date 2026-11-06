// The transport's arrival and survey scan [MM-story_mw56vi32_7]. Ported from tools/planets/orbital-survey.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVE_S, speedTable, arcU, arrivalReadout, pickSites, createSurvey } from './surveyPlan.js';

test('the arrival slows through the moon flyby and ends on the path', () => {
  const T = speedTable(0.3);
  assert.equal(T[0], 0); assert.equal(T.at(-1), 1);
  assert.equal(arcU(T, 0), 0); assert.ok(Math.abs(arcU(T, 1) - 1) < 1e-9);
  // more time is spent per unit of path around the flyby than on the inbound leg
  const dt = (u0, u1) => T[Math.round(u1 * 600)] - T[Math.round(u0 * 600)];
  assert.ok(dt(0.28, 0.32) > dt(0.05, 0.09), 'eased through the flyby');
  assert.equal(ARRIVE_S, 17);
});

test('the readout walks inbound → flyby → insertion → settling, loading the four targets', () => {
  const uFly = 0.3, r = (x, u) => arrivalReadout(x, u, uFly, 'Florael');
  assert.equal(r(0.05, 0.1).mode, 'Inbound'); assert.match(r(0.05, 0.1).status, /Florael/);
  assert.equal(r(0.3, 0.3).mode, 'Flyby');
  assert.equal(r(0.6, 0.6).mode, 'Insertion');
  assert.equal(r(0.95, 0.97).mode, 'Settling');
  assert.equal(r(0, 0).targets, 0); assert.equal(r(0.5, 0.5).targets, 4);
  assert.equal(r(1, 1).settled, true); assert.equal(r(1, 1).blend, 1);
});

test('sites are seeded, five per planet, scored 8–98', () => {
  const a = pickSites(17), b = pickSites(17), c = pickSites(118);
  assert.equal(a.length, 5); assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  for (const s of a) assert.ok(s.score >= 8 && s.score <= 98 && s.dist > 0 && s.dist < 0.25);
});

test('the survey sweeps, scans every site, locks the best and holds', () => {
  const sv = createSurvey(17, { resourceName: 'Petal Silk' });
  let st = sv.state, n = 0, sawScan = false;
  assert.equal(st.phase, 'sweep'); assert.match(st.status, /Petal Silk/);
  while (!st.done && n++ < 2000) { st = sv.step(1 / 30); if (st.phase === 'dwell') sawScan = true; }
  assert.ok(sawScan); assert.equal(st.done, true); assert.equal(st.locked, true);
  const best = Math.max(...st.sites.map((s) => s.score));
  assert.equal(st.sites[st.lockIdx].score, best); assert.equal(st.sites[st.lockIdx].state, 'locked');
  assert.match(st.status, /Landing site [A-E] confirmed/);
  assert.ok(n * (1 / 30) < 25, 'the survey takes under 25 s');
});

test('finish() jumps to the locked end state (skip / reduced motion)', () => {
  const st = createSurvey(5).finish();
  assert.equal(st.done, true); assert.equal(st.locked, true);
  assert.ok(st.sites.every((s) => s.state === 'rated' || s.state === 'locked'));
});
