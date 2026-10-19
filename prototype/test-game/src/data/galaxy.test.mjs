// [MM-story_mvftq5q8_l] the galaxy the nine homeworlds sit in: layout, star field, and the planet ⇄ galaxy camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS } from './planets.js';
import { GALAXY, CAM, SYSTEMS, SYSTEM_KEYS, systemPos, galaxyStars, galaxyCamera, ease } from './galaxy.js';

test('every homeworld has a solar system, inside the galaxy, well apart from the others', () => {
  assert.deepEqual([...SYSTEM_KEYS].sort(), Object.keys(PLANETS).sort(), 'one system per planet, keyed like planets.js');
  assert.deepEqual(Object.keys(SYSTEMS).sort(), Object.keys(PLANETS).sort(), 'no stray systems');
  const P = SYSTEM_KEYS.map(systemPos);
  for (const p of P) assert.ok(Math.hypot(p[0], p[2]) < GALAXY.radius && Math.abs(p[1]) < GALAXY.thickness, 'in the disc');
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]);
    assert.ok(d > 12, `${SYSTEM_KEYS[i]}–${SYSTEM_KEYS[j]} apart (${d.toFixed(1)})`);
  }
  assert.deepEqual(systemPos('nope'), [0, 0, 0]);
});

test('the star field: deterministic, a bright core and two spiral arms', () => {
  const a = galaxyStars(3000), b = galaxyStars(3000);
  assert.deepEqual(a.pos.slice(0, 300), b.pos.slice(0, 300), 'seeded');
  let core = 0, rim = 0, maxR = 0;
  for (let i = 0; i < 3000; i++) {
    const r = Math.hypot(a.pos[i * 3], a.pos[i * 3 + 2]); maxR = Math.max(maxR, r);
    if (r < GALAXY.radius * 0.15) core++; else if (r > GALAXY.radius * 0.6) rim++;
    assert.ok(a.col[i * 3] >= 0 && a.col[i * 3] <= 1 && a.size[i] > 0);
  }
  assert.ok(core > 3000 * 0.15, 'a dense core (the bulge is 22% of the stars)');
  assert.ok(rim > 3000 * 0.1, 'arms reach out');
  assert.ok(maxR < GALAXY.radius * 1.3, 'nothing flung far beyond the rim');
});

test('the camera: f = 0 frames the planet exactly like the live globe; f = 1 is the high overview', () => {
  const focus = systemPos('water');
  const c0 = galaxyCamera(0, focus, 1);
  assert.deepEqual(c0.look, focus, 'looking at the planet');
  assert.ok(Math.abs(c0.dist - GALAXY.planetR * CAM.globeDist) < 1e-9, 'radius ÷ distance = the globe camera\'s 1 ÷ 6');
  const tall = galaxyCamera(0, focus, 3);
  assert.ok(Math.abs(tall.dist - c0.dist * 3) < 1e-9, 'a taller galaxy view backs off so the planet keeps its on-screen size');
  const c1 = galaxyCamera(1, focus, 1);
  assert.deepEqual(c1.look.map((v) => Math.round(v * 1e9) / 1e9 + 0), [0, 0, 0], 'the overview looks at the galaxy centre');
  assert.ok(Math.abs(c1.dist - CAM.galaxyDist) < 1e-9 && c1.pos[1] > c1.dist * 0.4, 'far and high');
  let prev = 0;
  for (let f = 0.05; f <= 1.0001; f += 0.05) { const d = galaxyCamera(f, focus, 1).dist; assert.ok(d >= prev, 'only backs away'); prev = d; }
  assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.ok(ease(0.5) > 0.49 && ease(0.5) < 0.51);
});
