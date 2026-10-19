// [MM-task_mveuiw7u_e] [MM-task_mvewfno7_g] Pre-match framing: the play area fills the part of the screen the HUD
// leaves clear, at every LANDSCAPE aspect we tune for — owner 2026-10-18: "We are only tuning game play for landscape
// screens, but mobile and pc monitors can have different aspect ratios (16:9, 23x9)".
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA, FIT, fitCameraToRect, groundToNdc, clearBox } from './camera.js';

const RECT = { x0: 11, z0: 3, x1: 35, z1: 19 };        // map 1's first window, world edges
const VIEWS = [                                          // name, w, h, HUD insets (measured headless)
  ['PC 16:9', 1920, 1080, { top: 0, left: 76 }],
  ['PC 21:9', 2560, 1080, { top: 0, left: 76 }],
  ['phone 19.5:9', 844, 390, { top: 54, left: 63 }],
  ['phone 20:9', 915, 412, { top: 54, left: 66 }],
  ['phone 23:9', 1040, 407, { top: 54, left: 65 }],
];
const corners = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]];
const ext = (c, a) => {
  const ps = corners(RECT).map(([x, z]) => groundToNdc(c, a, x, z));
  return { top: Math.max(...ps.map((p) => p.y)), bot: Math.min(...ps.map((p) => p.y)), l: Math.min(...ps.map((p) => p.x)), r: Math.max(...ps.map((p) => p.x)) };
};

for (const [name, w, h, ins] of VIEWS) {
  test(`fit ${name}: the whole play area inside the HUD-clear box, centred in it, and tight`, () => {
    const a = w / h, box = clearBox(w, h, ins);
    const c = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, RECT, a, box), e = ext(c, a);
    const eps = 1e-6;
    assert.ok(e.top <= box.y1 + eps && e.bot >= box.y0 - eps && e.l >= box.x0 - eps && e.r <= box.x1 + eps,
      `${name}: inside (${e.l.toFixed(2)}..${e.r.toFixed(2)}, ${e.bot.toFixed(2)}..${e.top.toFixed(2)})`);
    assert.ok(Math.abs((e.top + e.bot) / 2 - (box.y0 + box.y1) / 2) < 1e-3, `${name}: centred vertically`);
    assert.ok(Math.abs((e.l + e.r) / 2 - (box.x0 + box.x1) / 2) < 1e-3, `${name}: centred horizontally`);
    // the top bar's bottom edge, in NDC: nothing of the play area above it
    assert.ok(e.top <= 1 - ((ins.top || 0) / h) * 2, `${name}: below the top bar`);
    assert.ok(e.l >= ((ins.left || 0) / w) * 2 - 1, `${name}: right of the build tray`);
    const touch = Math.max((e.top - e.bot) / (box.y1 - box.y0), (e.r - e.l) / (box.x1 - box.x0));
    if (c.dist > CAMERA.minDist && c.dist < CAMERA.maxDist) assert.ok(touch > 0.99, `${name}: tight (${touch.toFixed(3)})`);
    assert.ok(c.dist < CAMERA.maxDist, `${name}: inside the zoom-out limit (${c.dist.toFixed(1)})`);
  });
}

test('wider screens come in closer; a HUD pushes the camera back a little and shifts the area right/down', () => {
  const d = (w, h, ins) => fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, RECT, w / h, clearBox(w, h, ins));
  assert.ok(d(1920, 1080).dist > d(2560, 1080).dist, '16:9 stands further back than 21:9');
  const bare = d(844, 390), hud = d(844, 390, { top: 54, left: 63 });
  assert.ok(hud.dist > bare.dist, 'less clear screen → further back');
  assert.ok(hud.tx < bare.tx, 'the target moves left so the area sits right of the tray');
});

test('clearBox: FIT about the clear region; a HUD that would leave nothing clear is ignored', () => {
  const b = clearBox(1000, 500, {});
  assert.ok(Math.abs(b.x1 - FIT.x) < 1e-12 && Math.abs(b.y0 + FIT.y) < 1e-12);
  const t = clearBox(1000, 500, { top: 100, left: 100 });
  assert.ok(Math.abs(t.y1 - (0.6 - 0.8 * (1 - FIT.y))) < 1e-9, 'top: 1 - 0.4 shrunk toward the centre');
  const silly = clearBox(1000, 500, { top: 480 });
  assert.equal(silly.y1, FIT.y);
});

test('fit: clamped to the zoom limits, and it keeps the yaw', () => {
  const tiny = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, { x0: 10, z0: 10, x1: 11, z1: 11 }, 16 / 9);
  assert.equal(tiny.dist, CAMERA.minDist);
  const huge = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0 }, { x0: 0, z0: 0, x1: 300, z1: 300 }, 16 / 9);
  assert.equal(huge.dist, CAMERA.maxDist);
  const turned = fitCameraToRect({ tx: 0, tz: 0, dist: 46, yaw: 0.7 }, RECT, 16 / 9);
  assert.equal(turned.yaw, 0.7);
  for (const [x, z] of corners(RECT)) { const p = groundToNdc(turned, 16 / 9, x, z); assert.ok(Math.abs(p.x) <= FIT.x + 1e-6 && Math.abs(p.y) <= FIT.y + 1e-6); }
});
