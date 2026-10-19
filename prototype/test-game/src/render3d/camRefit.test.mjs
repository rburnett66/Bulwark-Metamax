// [MM-task_mvfjtyqh_8] After a reward pick the camera frames the WHOLE new play area (target + zoom) for the screen,
// at any aspect — owner 2026-10-19, a 2.6:1 window mid-match: "cameras not centering at this resolution".
import test from 'node:test';
import assert from 'node:assert/strict';
import { focusPlayArea } from './index.js';
import { createFogTracker, fogWindow } from './overlays/fogModel.js';
import { groundToNdc, clearBox } from './camera.js';

const map = { cols: 48, rows: 32, openPlay: true, base: { x: 30, y: 12 },
  waveWindows: [{ wave: 1, x0: 11, y0: 3, x1: 34, y1: 18 }, { wave: 2, x0: 4, y0: 3, x1: 40, y1: 26 }] };

for (const [name, w, h, ins] of [['16:9', 1920, 1080, { left: 76 }], ['21:9', 2560, 1080, { left: 76 }], ['2.6:1 (owner)', 1999, 760, { left: 42, top: 50 }]]) {
  test(`wave-end focus at ${name}: glides target AND zoom to frame the whole new window inside the HUD-clear box`, () => {
    const fog = createFogTracker();
    const state1 = { waves: { current: 1, active: false }, map };
    fog.update(state1, map, 0);                                   // wave 1's window is on screen
    fog.hold(true);
    const state2 = { waves: { current: 1, active: false }, map };   // between waves → the next window
    const r = { fog, map, cam: { tx: 22, tz: 11, dist: 30, yaw: 0 }, _w: w, _h: h, viewInsets: () => ins, userMoved: true };
    const dur = focusPlayArea(r, { ...state2, waves: { current: 1, active: false } });
    assert.ok(dur > 0 && r.camGlide && r.camGlide.gd != null, 'a glide with a zoom target');
    assert.equal(r.userMoved, false, 'auto-framing re-armed');
    const win = fogWindow(state2, map).rect, rect = { x0: win.x0, z0: win.y0, x1: win.x1 + 1, z1: win.y1 + 1 };
    const end = { tx: r.camGlide.gx, tz: r.camGlide.gz, dist: r.camGlide.gd, yaw: 0 }, box = clearBox(w, h, ins), a = w / h;
    for (const [x, z] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
      const p = groundToNdc(end, a, x, z);
      assert.ok(p.x >= box.x0 - 1e-6 && p.x <= box.x1 + 1e-6 && p.y >= box.y0 - 1e-6 && p.y <= box.y1 + 1e-6, `${name}: corner (${x},${z}) on screen at ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
  });
}
