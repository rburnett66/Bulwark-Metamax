// [MM-task_mveuiw7u_e] Pre-match framing: the play area fills the view at every aspect ratio — owner 2026-10-18: "the
// map camera is not properly positioned before the match .. probably needs to be calculated for every aspect ratio".
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA, FIT, fitCameraToRect, groundToNdc, clampCamera } from './camera.js';

const RECT = { x0: 6, z0: 6, x1: 26, z1: 22 };
const ASPECTS = [['phone portrait', 390 / 844], ['square', 1], ['16:9', 16 / 9], ['ultrawide', 21 / 9], ['phone landscape', 844 / 390]];
const corners = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]];

for (const [name, a] of ASPECTS) {
  test(`fit ${name}: every corner inside the frame, and it touches the frame (no wasted zoom)`, () => {
    const c = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, RECT, a);
    const ps = corners(RECT).map(([x, z]) => groundToNdc(c, a, x, z));
    for (const p of ps) assert.ok(Math.abs(p.x) <= FIT.x + 1e-6 && Math.abs(p.y) <= FIT.y + 1e-6, `${name}: corner at ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    const edge = Math.max(...ps.map((p) => Math.max(Math.abs(p.x) / FIT.x, Math.abs(p.y) / FIT.y)));
    if (c.dist > CAMERA.minDist && c.dist < CAMERA.fitMaxDist) assert.ok(edge > 0.99, `${name}: tight (${edge.toFixed(3)})`);
    const top = Math.max(...ps.map((p) => p.y)), bot = Math.min(...ps.map((p) => p.y));
    assert.ok(Math.abs(top + bot) < 1e-3, `${name}: centred top/bottom (${top.toFixed(3)} / ${bot.toFixed(3)})`);
    assert.ok(Math.abs(c.tx - 16) < 1e-6, 'centred left/right');
  });
}

test('fit: a taller-than-wide screen pulls back further than a wide one; a wide one comes in closer', () => {
  const d = (a) => fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, RECT, a).dist;
  assert.ok(d(390 / 844) > d(1) && d(1) > d(16 / 9) && d(16 / 9) > d(21 / 9));
});

test('a tall phone on map 1\'s first window (24×16 cells) stands back past the zoom-out limit, and the clamp keeps it', () => {
  const R = { x0: 11, z0: 3, x1: 35, z1: 19 }, c = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, R, 390 / 844);
  assert.ok(c.dist > CAMERA.maxDist && c.dist < CAMERA.fitMaxDist, `dist ${c.dist.toFixed(1)}`);
  const d = c.dist; clampCamera(c, 48, 32, d); assert.equal(c.dist, d, 'kept with the raised limit');
  clampCamera(c, 48, 32); assert.equal(c.dist, CAMERA.maxDist, 'the normal limit otherwise');
});

test('fit: clamped to the zoom limits, and it keeps the yaw', () => {
  const tiny = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, { x0: 10, z0: 10, x1: 11, z1: 11 }, 16 / 9);
  assert.equal(tiny.dist, CAMERA.minDist);
  const huge = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, { x0: 0, z0: 0, x1: 200, z1: 200 }, 0.5);
  assert.equal(huge.dist, CAMERA.fitMaxDist);
  const turned = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0.7 }, RECT, 16 / 9);
  assert.equal(turned.yaw, 0.7);
  for (const [x, z] of corners(RECT)) { const p = groundToNdc(turned, 16 / 9, x, z); assert.ok(Math.abs(p.x) <= FIT.x + 1e-6 && Math.abs(p.y) <= FIT.y + 1e-6); }
});
