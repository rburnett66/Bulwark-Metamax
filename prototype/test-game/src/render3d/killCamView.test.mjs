// src/render3d/killCamView.test.mjs — the Kill Camera looks between the base and its killer [MM-task_mvjng96y_b].
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA, groundToNdc, cellToWorld } from './camera.js';
import { KILL_VIEW, killCamPose } from './killCamView.js';

const base = { x: 20, y: 20 }, killer = { x: 26, y: 17 };

test('the target is the midpoint between the base and the killer', () => {
  const c = killCamPose({ base, killer, t: 0, w: 1280, h: 720 });
  assert.equal(c.tx, (cellToWorld(base.x) + cellToWorld(killer.x)) / 2);
  assert.equal(c.tz, (cellToWorld(base.y) + cellToWorld(killer.y)) / 2);
  const solo = killCamPose({ base, killer: null, t: 0, w: 1280, h: 720 });
  assert.equal(solo.tx, cellToWorld(base.x)); assert.equal(solo.tz, cellToWorld(base.y));
});

test('both the base and the killer are on screen, below the header, for the whole sequence', () => {
  for (const [w, h] of [[1280, 720], [390, 844], [2560, 1080]]) {
    for (const t of [0, 7, 15]) {
      const c = killCamPose({ base, killer, t, total: 15, w, h });
      for (const p of [base, killer]) {
        const n = groundToNdc(c, w / h, cellToWorld(p.x), cellToWorld(p.y));
        assert.ok(n && Math.abs(n.x) < 1 && n.y > -1 && n.y < 1 - 2 * KILL_VIEW.headerFrac, `${w}x${h} t=${t}: ${JSON.stringify(n)}`);
      }
    }
  }
});

test('it pushes in and drifts round over the sequence, within the camera limits', () => {
  const a = killCamPose({ base, killer, t: 0, total: 15, w: 1280, h: 720 });
  const b = killCamPose({ base, killer, t: 15, total: 15, w: 1280, h: 720 });
  assert.ok(b.dist < a.dist, 'pushes in');
  assert.ok(Math.abs(b.yaw - a.yaw - KILL_VIEW.orbit) < 1e-9, 'drifts round');
  const near = killCamPose({ base, killer: { x: 20, y: 21 }, t: 0, w: 1280, h: 720 });
  assert.ok(near.dist >= CAMERA.minDist && near.dist <= CAMERA.maxDist);
  const far = killCamPose({ base, killer: { x: 120, y: 90 }, t: 0, w: 1280, h: 720 });
  assert.ok(far.dist <= CAMERA.maxDist);
});
