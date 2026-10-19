// T3.4 [MM-task_mv9s9o5d_3] — the ring fog's window (same as the Pixi view's), its reveal flash, the fog view, and
// the battle camera rules (no yaw in battle; ease back on wave start; free twist outside it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from '../../../vendor/three.module.js';
import { fogWindow, createFogTracker, REVEAL_FLASH_S, insideWindow } from './fogModel.js';
import { createFogView, fogAlpha, FOG_MARGIN, CLOUD, cloudBias, cloudDark, cloudNoisePixels } from './fog.js';
import { stepYaw, twistBy, wrapYaw, cameraPose, screenToGroundCell, groundCellToScreen } from '../camera.js';
import { buildTerrainMap, buildCampaignMap } from '../../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));

const rings = [{ rect: { x0: 10, y0: 8, x1: 20, y1: 16 } }, { rect: { x0: 6, y0: 4, x1: 26, y1: 20 } }, { rect: { x0: 0, y0: 0, x1: 31, y1: 23 } }];
const campaign = { cols: 32, rows: 24, rings, base: { x: 15, y: 12 } };
const at = (current, active = false, map = campaign) => ({ map, waves: { current, active } });

test('campaign rings: the current wave\'s ring, gated; the build phase shows ring 1; the last ring is the whole board', () => {
  assert.deepEqual(fogWindow(at(0)), { rect: rings[0].rect, gated: true, wave: 1 });
  assert.deepEqual(fogWindow(at(2, true)).rect, rings[1].rect);
  assert.equal(fogWindow(at(3, true)), null, 'whole board in play → no fog');
  assert.equal(fogWindow(at(9, true)), null, 'past the last ring clamps to it');
});

test('open-play maps without windows, and the classic board, have no fog', () => {
  assert.equal(fogWindow(at(1, true, { ...campaign, openPlay: true })), null);
  assert.equal(fogWindow({ map: { cols: 10, rows: 10 }, waves: { current: 1 } }), null);
  assert.equal(fogWindow(null, null), null);
});

test('forge windows: the coming wave between waves, the live one in battle, widened to the base zone; never gated', () => {
  const map = { cols: 40, rows: 30, openPlay: true, base: { x: 30, y: 15 },
    waveWindows: [{ wave: 1, x0: 5, y0: 5, x1: 15, y1: 12 }, { wave: 2, x: 3, y: 3, w: 20, h: 10 }] };
  const w0 = fogWindow(at(0, false, map));
  assert.equal(w0.gated, false);
  assert.equal(w0.wave, 1);
  assert.deepEqual(w0.rect, { x0: 5, y0: 5, x1: 32, y1: 17 }, 'stretched to base ±2');
  assert.equal(fogWindow(at(1, true, map)).wave, 1, 'live wave 1');
  assert.equal(fogWindow(at(1, false, map)).wave, 2, 'between waves: the coming one');
  assert.deepEqual(fogWindow(at(2, true, map)).rect, { x0: 2, y0: 2, x1: 32, y1: 17 }, '{x,y,w,h} is 1-based');
});

test('the real powder-map-1 and a real campaign map both have a fog window at wave 1', () => {
  const forge = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const fw = fogWindow({ map: forge, waves: { current: 0, active: false } });
  assert.ok(fw && !fw.gated, 'forge map: window, not gated');
  const b = forge.base;
  assert.ok(fw.rect.x0 <= b.x && b.x <= fw.rect.x1 && fw.rect.y0 <= b.y && b.y <= fw.rect.y1, 'base inside');
  const camp = buildCampaignMap(1);
  if (camp.rings && camp.rings.length > 1 && !camp.openPlay) {
    const cw = fogWindow({ map: camp, waves: { current: 1, active: true } });
    assert.ok(cw && cw.gated);
  }
});

test('reveal flash: a growing ring flashes the opened band, then fades out', () => {
  const tr = createFogTracker();
  const st = at(1, true);
  assert.equal(tr.update(st, null, 0.1).flash, null);
  st.waves.current = 2;
  const f = tr.update(st, null, 0.1).flash;
  assert.deepEqual(f.prev, rings[0].rect);
  assert.deepEqual(f.cur, rings[1].rect);
  assert.ok(f.alpha > 0.85 && f.alpha < 1);
  let last = f;
  for (let t = 0; t < REVEAL_FLASH_S + 0.1; t += 0.1) last = tr.update(st, null, 0.1).flash;
  assert.equal(last, null);
  // a restart (window shrinks back) does not flash
  st.waves.current = 1;
  assert.equal(tr.update(st, null, 0.1).flash, null);
});

test('the fog view: one mesh over the scene (no depth test), under the ghost; clouds ring the map when the board is open', () => {
  const scene = new THREE.Scene();
  const v = createFogView(THREE, scene, campaign);
  assert.equal(scene.children.length, 1);
  const m = v.mesh;
  assert.equal(m.material.depthTest, false);
  assert.equal(m.material.depthWrite, false);
  assert.ok(m.renderOrder > 5 && m.renderOrder < 10, 'after combat FX (5), before the placement ghost (10)');
  // the whole board open: the cloud bank rings the MAP edge (owner 2026-10-19) [MM-story_mvfk3el9_b]
  assert.equal(v.sync({ win: null }, 3), true);
  assert.equal(m.visible, true);
  assert.deepEqual(m.material.uniforms.uRect.value.toArray(), [0, 0, campaign.cols, campaign.rows]);
  assert.equal(m.material.uniforms.uTime.value, 3, 'the drift clock');
  assert.equal(v.sync({ win: { rect: rings[0].rect, gated: true }, flash: null }), true);
  const u = m.material.uniforms;
  assert.deepEqual(u.uRect.value.toArray(), [10, 8, 21, 17], 'inclusive cells → cell edges');
  assert.equal(u.uFlash.value, 0);
  v.sync({ win: { rect: rings[1].rect, gated: false }, flash: { prev: rings[0].rect, cur: rings[1].rect, alpha: 0.5 } });
  assert.ok(u.uFlash.value > 0);
  assert.ok(u.uNoise.value && u.uCloud.value.x === CLOUD.full, 'cloud noise + band');
  assert.equal(u.uLine, undefined, 'no hard outline (vignette, owner 2026-10-18)');
  // the quad reaches past the horizon at the farthest zoom
  m.geometry.computeBoundingBox();
  assert.ok(m.geometry.boundingBox.min.x < -150 && m.geometry.boundingBox.max.z > 24 + 150);
  v.dispose();
  assert.equal(scene.children.length, 0);
});

test('vignette: clear at the window edge, darkening smoothly to fully dark 5 cells out, dark beyond [MM-story_mveehs1r_f]', () => {
  assert.equal(FOG_MARGIN, 5);
  assert.equal(fogAlpha(-3), 0, 'inside the play area: clear');
  assert.equal(fogAlpha(0), 0, 'at the edge: clear (no hard line)');
  let prev = 0;
  for (let d = 0.25; d <= FOG_MARGIN; d += 0.25) { const a = fogAlpha(d); assert.ok(a > prev, `monotonic at ${d}`); prev = a; }
  assert.ok(fogAlpha(1) < 0.15, 'the first cell out is still mostly visible');
  assert.ok(fogAlpha(4) > 0.85, 'nearly dark a cell before the margin');
  assert.equal(fogAlpha(FOG_MARGIN), 1);
  assert.equal(fogAlpha(FOG_MARGIN + 3), 1, 'past the margin the map is dark');
});

test('insideWindow: cell positions against an inclusive window', () => {
  const r = { x0: 10, y0: 8, x1: 20, y1: 16 };
  assert.equal(insideWindow(r, { x: 10, y: 8 }), true);
  assert.equal(insideWindow(r, { x: 20, y: 16 }), true);
  assert.equal(insideWindow(r, { x: 9.4, y: 10 }), false);
  assert.equal(insideWindow(r, { x: 15, y: 17 }), false);
  assert.equal(insideWindow(null, { x: 99, y: 99 }), true, 'no window: everything is in play');
});

// ── camera rules ───────────────────────────────────────────────────────────────────────────────
test('in battle a twist is refused; outside it the view turns', () => {
  const cam = { tx: 10, tz: 10, dist: 40, yaw: 0 };
  assert.equal(twistBy(cam, 0.5, true), false);
  assert.equal(cam.yaw, 0);
  assert.equal(twistBy(cam, 0.5, false), true);
  assert.equal(cam.yaw, 0.5);
  twistBy(cam, 6, false);
  assert.ok(cam.yaw > -Math.PI && cam.yaw <= Math.PI, 'wrapped');
});

test('wave start: a leftover yaw eases back to exactly 0, the short way round; nothing happens outside battle', () => {
  const cam = { tx: 10, tz: 10, dist: 40, yaw: 2.5 };
  stepYaw(cam, false, 1);
  assert.equal(cam.yaw, 2.5, 'build phase keeps the player\'s yaw');
  const seq = [];
  for (let i = 0; i < 60; i++) { stepYaw(cam, true, 1 / 60); seq.push(cam.yaw); }
  assert.ok(Math.abs(seq[29]) < 0.2, `~95 % back in 0.5 s (yaw ${seq[29]})`);
  assert.equal(cam.yaw, 0, 'snaps to exactly 0');
  for (let i = 1; i < seq.length; i++) assert.ok(Math.abs(seq[i]) <= Math.abs(seq[i - 1]), 'monotonic');
  const c2 = { yaw: 3 * Math.PI / 2 };   // = -π/2: the short way is back through -π/2, not round through π
  stepYaw(c2, true, 1 / 60);
  assert.ok(c2.yaw < 0 && c2.yaw > -Math.PI / 2);
});

test('picking still inverts under any out-of-battle yaw', () => {
  for (const yaw of [0.4, -1.2, 2.9, wrapYaw(5)]) {
    const cam = { tx: 16, tz: 12, dist: 40, yaw };
    for (const cell of [{ x: 16, y: 12 }, { x: 12, y: 9 }, { x: 20, y: 15 }]) {
      const p = groundCellToScreen(cam, 1280, 720, cell);
      assert.deepEqual(screenToGroundCell(cam, 1280, 720, p.x, p.y, 32, 24), cell, `yaw ${yaw}`);
    }
    const pose = cameraPose(cam);
    assert.ok(Math.abs(Math.hypot(pose.position.x - 16, pose.position.z - 12) - 40 * Math.cos(37 * Math.PI / 180)) < 1e-9);
  }
});

test('cloud band: wisps at the window edge thicken to full cover, then sink into the dark veil far out [MM-story_mvfk3el9_b]', () => {
  assert.equal(cloudBias(-1), -1, 'none inside the play area');
  assert.ok(cloudBias(0) < -0.4 && cloudBias(CLOUD.full) > 0.5, 'edge → full');
  for (let d = 0; d < CLOUD.full; d += 0.5) assert.ok(cloudBias(d + 0.5) >= cloudBias(d), 'monotonic');
  assert.equal(cloudDark(CLOUD.dark - 0.1), 0);
  assert.equal(cloudDark(CLOUD.black + 1), 1);
  assert.ok(CLOUD.full < CLOUD.dark && CLOUD.dark < CLOUD.black);
  const px = cloudNoisePixels(32, 7), px2 = cloudNoisePixels(32, 7);
  assert.deepEqual(px, px2, 'deterministic');
  let lo = 255, hi = 0; for (let i = 0; i < px.length; i += 4) { lo = Math.min(lo, px[i]); hi = Math.max(hi, px[i]); }
  assert.ok(hi - lo > 80, `contrast ${lo}..${hi}`);
  // tileable: the left and right columns join (no seam)
  let seam = 0; for (let y = 0; y < 32; y++) seam = Math.max(seam, Math.abs(px[(y * 32) * 4] - px[(y * 32 + 31) * 4]));
  assert.ok(seam < 40, `no seam (${seam})`);
});
