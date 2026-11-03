// shots.test.mjs — lens maths and shot recipes stay sane.  [MM-story_mw01uvuu_4]
import test from 'node:test';
import assert from 'node:assert/strict';
import { lensFov, shot, SHOT_ORDER } from './shots.js';

const box = { min: { x: -10.6, y: -1.8, z: -2.9 }, max: { x: 10.5, y: 4.6, z: 2.9 } };   // Lumen-sized

test('full-frame focal lengths map to the usual vertical FOVs at 16:9', () => {
  for (const [mm, deg] of [[24, 45.7], [35, 32.3], [50, 22.9], [85, 13.6], [135, 8.6]]) {
    assert.ok(Math.abs(lensFov(mm, 16 / 9) - deg) < 0.2, `${mm} mm → ${lensFov(mm, 16 / 9)}`);
  }
});

test('portrait keeps the landscape horizontal coverage (capped at 60°)', () => {
  const aspect = 9 / 19.5, mm = 85;
  const v = lensFov(mm, aspect) * Math.PI / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const hLand = 2 * Math.atan(Math.tan(lensFov(mm, 16 / 9) * Math.PI / 360) * 16 / 9);
  assert.ok(Math.abs(h - hLand) < 1e-6);
  assert.ok(lensFov(24, aspect) <= 60);
});

test('every shot returns a finite camera outside the hull and is deterministic', () => {
  for (const name of SHOT_ORDER) {
    for (const t of [0, 3.3, 9]) {
      const a = shot(name, t, { box, aspect: 16 / 9 }), b = shot(name, t, { box, aspect: 16 / 9 });
      assert.deepEqual(a, b);
      for (const v of [...a.position, ...a.target, a.fov]) assert.ok(Number.isFinite(v));
      const [x, y, z] = a.position;
      const inside = x > box.min.x && x < box.max.x && y > box.min.y && y < box.max.y && z > box.min.z && z < box.max.z;
      assert.ok(!inside, `${name} at t=${t} is inside the hull`);
    }
  }
});

test('the orbit is slow: under 1.5° of yaw per second', () => {
  const a = shot('orbit', 2, { box, still: false }), b = shot('orbit', 3, { box, still: false });
  const ang = (p) => Math.atan2(-(p.position[2]), p.position[0]);
  assert.ok(Math.abs(ang(b) - ang(a)) * 180 / Math.PI < 1.5);
});
