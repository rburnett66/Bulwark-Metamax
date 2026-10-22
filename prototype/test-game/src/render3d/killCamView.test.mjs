// src/render3d/killCamView.test.mjs — the Kill Camera arcs from behind the base to behind the killer [MM-task_mvjprwua_c].
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA, cameraPose, groundToNdc, cellToWorld } from './camera.js';
import { KILL_VIEW, killCamPose, startYaw } from './killCamView.js';

const base = { x: 20, y: 20 }, killer = { x: 26, y: 17 }, REPLAY = 10;
const W = (p) => ({ x: cellToWorld(p.x), z: cellToWorld(p.y) });
const pose = (t, o = {}) => killCamPose({ base, killer, t, replay: REPLAY, w: 1280, h: 720, ...o });
/** Ground distance from the camera to a point. */
const camDist = (c, p) => { const P = cameraPose(c).position, q = W(p); return Math.hypot(P.x - q.x, P.z - q.z); };
/** The camera's forward direction on the ground · the unit vector to a point from the target. */
const facing = (c, p) => { const P = cameraPose(c), q = W(p); const fx = P.target.x - P.position.x, fz = P.target.z - P.position.z, n = Math.hypot(fx, fz);
  const vx = q.x - c.tx, vz = q.z - c.tz, m = Math.hypot(vx, vz); return (fx * vx + fz * vz) / (n * m); };

test('the target is the midpoint and the tilt is the game\'s', () => {
  for (const t of [0, 4, 9]) {
    const c = pose(t);
    assert.equal(c.tx, (W(base).x + W(killer).x) / 2); assert.equal(c.tz, (W(base).z + W(killer).z) / 2);
    const P = cameraPose(c), pitch = Math.atan2(P.position.y, Math.hypot(P.position.x - c.tx, P.position.z - c.tz)) * 180 / Math.PI;
    assert.ok(Math.abs(pitch - CAMERA.pitchDeg) < 1e-9, 'same tilt');
  }
});

test('it starts behind the base looking at the killer', () => {
  const c = pose(0);
  assert.ok(camDist(c, base) < camDist(c, killer), 'the base is the nearer of the two');
  assert.ok(facing(c, killer) > 0.999, 'looking straight at the killer');
});

test('it arcs to the right and faces the base from behind the killer 2 s before the base falls', () => {
  const y0 = pose(0).yaw;
  let last = y0;
  for (let t = 0.5; t <= REPLAY - KILL_VIEW.faceBase; t += 0.5) {
    const c = pose(t);
    assert.ok(c.yaw >= last - 1e-12, 'turns one way only'); last = c.yaw;
    // moving to its right: the camera's ground position moves along its own screen-right vector
    const a = cameraPose(pose(t - 0.25)).position, b = cameraPose(c).position, rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    if (t < REPLAY - KILL_VIEW.faceBase) assert.ok((b.x - a.x) * rx + (b.z - a.z) * rz > 0, `t=${t}: moving right`);
  }
  for (const t of [REPLAY - KILL_VIEW.faceBase, REPLAY - 1, REPLAY, REPLAY + 5]) {
    const c = pose(t);
    assert.ok(Math.abs(c.yaw - y0 - Math.PI) < 1e-9, `t=${t}: half way round`);
    assert.ok(camDist(c, killer) < camDist(c, base), 'behind the killer');
    assert.ok(facing(c, base) > 0.999, 'facing the base');
  }
  assert.ok(Math.abs(pose(REPLAY / 2 - 1).yaw - y0 - Math.PI / 2) < 0.2, 'about side-on half way');
});

test('both stay on screen, below the header, the whole way round, on any screen', () => {
  for (const [w, h] of [[1280, 720], [390, 844], [2560, 1080]]) {
    for (let t = 0; t <= REPLAY + 5; t += 0.5) {
      const c = pose(t, { w, h });
      for (const p of [base, killer]) {
        const n = groundToNdc(c, w / h, W(p).x, W(p).z);
        assert.ok(n && Math.abs(n.x) < 1 && n.y > -1 && n.y < 1 - 2 * KILL_VIEW.headerFrac, `${w}x${h} t=${t}: ${JSON.stringify(n)}`);
      }
    }
  }
});

test('it pushes in as it comes round, within the camera limits; with no killer it still turns', () => {
  assert.ok(pose(REPLAY).dist < pose(0).dist);
  const near = killCamPose({ base, killer: { x: 20, y: 21 }, t: 0, replay: REPLAY, w: 1280, h: 720 });
  assert.ok(near.dist >= CAMERA.minDist && near.dist <= CAMERA.maxDist);
  const far = killCamPose({ base, killer: { x: 120, y: 90 }, t: 0, replay: REPLAY, w: 1280, h: 720 });
  assert.ok(far.dist <= CAMERA.maxDist);
  assert.equal(startYaw(base, null, 0.4), 0.4);
  const solo = killCamPose({ base, killer: null, t: REPLAY, replay: REPLAY, w: 1280, h: 720, yaw0: 0.4 });
  assert.equal(solo.tx, W(base).x); assert.ok(Math.abs(solo.yaw - 0.4 - Math.PI) < 1e-9);
});
