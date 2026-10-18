// T3.2 [MM-task_mv9s9lvj_1] — picking under the 3D view: pixel → cell through the battle camera, the
// inverse, the touch lift, and input.js acting on a TAP (a drag pans, a pinch zooms; neither builds).
// camera.js is pure maths; the vendored three.js is used here ONLY to cross-check the ray it builds.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../vendor/three.module.js';
import { CAMERA, cameraPose, pickRay, screenToGroundCell, groundCellToScreen, cellToWorld, touchSlotPoint, TOUCH_OFFSET } from './camera.js';
import { buildCampaignMap } from '../sim/mapgen.js';
import { buildCampaignWaves } from '../sim/campaign.js';
import { createSim } from '../sim/core.js';
import { validatePlacement } from '../sim/structures.js';
import fs from 'node:fs';
import { createInput, createUiState } from '../input/input.js';

const W = 1280, H = 720, COLS = 64, ROWS = 32;
const cams = [
  { tx: 31.5, tz: 15.5, dist: CAMERA.startDist, yaw: 0 },
  { tx: 10, tz: 25, dist: CAMERA.minDist, yaw: 0 },
  { tx: 50, tz: 8, dist: 70, yaw: 0 },
  { tx: 30, tz: 16, dist: 40, yaw: 0.7 },   // out-of-battle yaw (later T3 slice) must still invert
];

test('pickRay is the ray THREE.Raycaster.setFromCamera builds for the same camera', () => {
  for (const cam of cams) {
    const pose = cameraPose(cam);
    const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, W / H, CAMERA.near, CAMERA.far);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateMatrixWorld();
    const rc = new THREE.Raycaster();
    for (const [nx, ny] of [[0, 0], [-0.9, 0.8], [0.6, -0.95], [1, 1]]) {
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const { dir } = pickRay(cam, W / H, nx, ny);
      const l = Math.hypot(dir.x, dir.y, dir.z);
      const d = rc.ray.direction;
      assert.ok(Math.abs(dir.x / l - d.x) < 1e-6 && Math.abs(dir.y / l - d.y) < 1e-6 && Math.abs(dir.z / l - d.z) < 1e-6,
        `cam ${JSON.stringify(cam)} ndc (${nx},${ny})`);
    }
  }
});

test('the screen centre picks the camera target cell', () => {
  const c = screenToGroundCell({ tx: 31.5, tz: 15.5, dist: 46, yaw: 0 }, W, H, W / 2, H / 2, COLS, ROWS);
  assert.deepEqual(c, { x: 31, y: 15 });
});

test('cell → screen → cell round-trips for every visible cell', () => {
  for (const cam of cams) {
    let checked = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const p = groundCellToScreen(cam, W, H, { x, y });
      if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) continue;   // off screen
      assert.deepEqual(screenToGroundCell(cam, W, H, p.x, p.y, COLS, ROWS), { x, y }, `cam ${JSON.stringify(cam)}`);
      checked++;
    }
    assert.ok(checked > 20, `checked ${checked} cells`);
  }
});

test('off the map → null, never a clamped edge cell (a tap past the edge must not build on it)', () => {
  const cam = { tx: 0, tz: 0, dist: 30, yaw: 0 };   // map corner in the middle of the view
  assert.equal(screenToGroundCell(cam, W, H, 5, H - 5, COLS, ROWS), null);
  // and the sky above the horizon misses the ground entirely
  assert.equal(screenToGroundCell({ tx: 30, tz: 16, dist: 95, yaw: 0 }, W, H * 50, W / 2, 0, COLS, ROWS), null);
});

test('touch lift aims 1.4 cells up-screen (north at yaw 0)', () => {
  const cam = { tx: 31.5, tz: 15.5, dist: 46, yaw: 0 };
  const p = groundCellToScreen(cam, W, H, { x: 31, y: 15 });
  assert.deepEqual(screenToGroundCell(cam, W, H, p.x, p.y, COLS, ROWS, 1.4), { x: 31, y: 14 });
});

// ── input.js under the 3D view: tap acts, drag/pinch do not ──────────────────────────────────────
function fakeCanvas() {
  const ls = {};
  return {
    addEventListener(t, fn) { (ls[t] = ls[t] || []).push(fn); },
    removeEventListener(t, fn) { ls[t] = (ls[t] || []).filter((f) => f !== fn); },
    fire(t, ev) { for (const fn of ls[t] || []) fn({ button: 0, timeStamp: 0, preventDefault() {}, ...ev }); },
  };
}
function rig() {
  const canvas = fakeCanvas();
  const ui = createUiState();
  ui.buildSelection = 'STR-Wall';
  const sent = [];
  const state = { units: new Map(), structures: new Map() };
  const pick = (ev) => ({ x: Math.floor(ev.clientX / 10), y: Math.floor(ev.clientY / 10) });
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
  createInput(canvas, null, () => state, (cmd) => { sent.push(cmd); return { ok: true }; }, ui, { pick, tapToAct: true });
  return { canvas, ui, sent };
}

test('a tap places at the picked cell', () => {
  const { canvas, sent } = rig();
  canvas.fire('pointerdown', { pointerId: 1, clientX: 52, clientY: 33, timeStamp: 0 });
  assert.equal(sent.length, 0, 'nothing happens on press');
  canvas.fire('pointerup', { pointerId: 1, clientX: 54, clientY: 34, timeStamp: 120 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'place');
  assert.deepEqual(sent[0].cell, { x: 5, y: 3 });
});

test('a drag (camera pan) never places', () => {
  const { canvas, sent } = rig();
  canvas.fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 30 });
  canvas.fire('pointerup', { pointerId: 1, clientX: 140, clientY: 30, timeStamp: 200 });
  assert.equal(sent.length, 0);
});

test('a long press never places', () => {
  const { canvas, sent } = rig();
  canvas.fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 30, timeStamp: 0 });
  canvas.fire('pointerup', { pointerId: 1, clientX: 50, clientY: 30, timeStamp: 900 });
  assert.equal(sent.length, 0);
});

test('a pinch never places — not even when the fingers lift without moving', () => {
  const { canvas, sent } = rig();
  canvas.fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 30 });
  canvas.fire('pointerdown', { pointerId: 2, clientX: 150, clientY: 30 });
  canvas.fire('pointerup', { pointerId: 2, clientX: 150, clientY: 30, timeStamp: 100 });
  canvas.fire('pointerup', { pointerId: 1, clientX: 50, clientY: 30, timeStamp: 110 });
  assert.equal(sent.length, 0);
  // and the NEXT single tap works again
  canvas.fire('pointerdown', { pointerId: 3, clientX: 50, clientY: 30, timeStamp: 200 });
  canvas.fire('pointerup', { pointerId: 3, clientX: 50, clientY: 30, timeStamp: 260 });
  assert.equal(sent.length, 1);
});

test('right-click cancels the build tool on press; a cancelled pointer never acts', () => {
  const { canvas, ui, sent } = rig();
  canvas.fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 30 });
  canvas.fire('pointercancel', { pointerId: 1, clientX: 50, clientY: 30, timeStamp: 50 });
  assert.equal(sent.length, 0);
  canvas.fire('pointerdown', { pointerId: 2, button: 2, clientX: 50, clientY: 30 });
  assert.equal(ui.buildSelection, null);
});

test('hover follows the pointer through pick (drives the ghost)', () => {
  const { canvas, ui } = rig();
  canvas.fire('pointermove', { pointerId: 1, clientX: 71, clientY: 42 });
  assert.deepEqual(ui.hoverCell, { x: 7, y: 4 });
});


// ── touch placement: the slot sits up-left of the finger, the finger steers it, release builds ──
// [MM-story_mvee80a0_d] owner 2026-10-18: "virtual joystick … slot should show up and left of the touch point and
// it should build on finger release".
test('the touch slot is a fixed screen offset up and left of the finger, clamped inside the view', () => {
  assert.ok(TOUCH_OFFSET.x < 0 && TOUCH_OFFSET.y < 0, 'up and left');
  assert.deepEqual(touchSlotPoint(600, 400, W, H), { x: 600 + TOUCH_OFFSET.x, y: 400 + TOUCH_OFFSET.y });
  const corner = touchSlotPoint(20, 30, W, H);
  assert.ok(corner.x >= TOUCH_OFFSET.edge && corner.y >= TOUCH_OFFSET.edge, 'near the top-left edge the slot stays on screen');
  // on the ground: the slot cell is north-west of the finger's cell at yaw 0
  const cam = { tx: 31.5, tz: 15.5, dist: CAMERA.startDist, yaw: 0 };
  const finger = screenToGroundCell(cam, W, H, 640, 400, COLS, ROWS);
  const s = touchSlotPoint(640, 400, W, H);
  const slot = screenToGroundCell(cam, W, H, s.x, s.y, COLS, ROWS);
  assert.ok(slot.x < finger.x && slot.y < finger.y, `slot ${JSON.stringify(slot)} is up-left of finger ${JSON.stringify(finger)}`);
});

function touchRig() {
  const map = buildCampaignMap(1, { seed: 2 });
  const state = createSim(3, { map, waves: buildCampaignWaves(map) });
  state.money = 100000;
  const canvas = fakeCanvas();
  const ui = createUiState();
  ui.buildSelection = 'STR-Wall';
  const sent = [];
  // 10 px per cell; a touch with a tool armed picks at the offset slot, as render3d eventToCell does
  const pick = (ev, u) => {
    let x = ev.clientX, y = ev.clientY;
    if (ev.pointerType === 'touch' && u && u.buildSelection) ({ x, y } = touchSlotPoint(x, y, 10000, 10000));
    return { x: Math.floor(x / 10), y: Math.floor(y / 10) };
  };
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
  createInput(canvas, null, () => state, (cmd) => { sent.push(cmd); return { ok: true }; }, ui, { pick, tapToAct: true });
  // a valid build cell, and the finger position whose slot lands on it
  const r = map.rings[0].rect;
  let good = null;
  for (let y = r.y0; y <= r.y1 && !good; y++) for (let x = r.x0; x <= r.x1 && !good; x++) if (validatePlacement(state, 'STR-Wall', { x, y }).ok) good = { x, y };
  const fingerFor = (c) => ({ clientX: c.x * 10 + 5 - TOUCH_OFFSET.x, clientY: c.y * 10 + 5 - TOUCH_OFFSET.y });
  return { canvas, ui, sent, state, good, fingerFor };
}
const T = (o) => ({ pointerType: 'touch', ...o });

test('touch with a tower armed: the ghost follows the offset slot, the finger does not pan, release builds there', () => {
  const { canvas, ui, sent, good, fingerFor } = touchRig();
  assert.ok(good, 'found a valid cell');
  const start = fingerFor({ x: good.x + 3, y: good.y + 2 }), end = fingerFor(good);
  canvas.fire('pointerdown', T({ pointerId: 7, ...start, timeStamp: 0 }));
  assert.equal(ui.placingPointer, 7, 'the camera is told this finger is steering');
  assert.deepEqual(ui.hoverCell, { x: good.x + 3, y: good.y + 2 }, 'ghost at the slot, not under the finger');
  canvas.fire('pointermove', T({ pointerId: 7, ...end }));
  assert.deepEqual(ui.hoverCell, good);
  assert.equal(ui.hoverValid, true);
  canvas.fire('pointerup', T({ pointerId: 7, ...end, timeStamp: 1500 }));   // a long drag — still builds (no tap limits)
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].cell, good, 'built on the slot cell');
  assert.equal(ui.placingPointer, null);
  assert.equal(ui.buildSelection, 'STR-Wall', 'the tool stays armed for the next tower');
});

test('touch placement: release on an invalid slot builds nothing', () => {
  const { canvas, sent, state, fingerFor } = touchRig();
  const base = state.base.pos;   // the base itself is never a valid build cell
  const f = fingerFor(base);
  canvas.fire('pointerdown', T({ pointerId: 1, ...f }));
  canvas.fire('pointerup', T({ pointerId: 1, ...f, timeStamp: 200 }));
  assert.equal(sent.length, 0);
});

test('touch placement: a second finger cancels (and becomes a pinch)', () => {
  const { canvas, ui, sent, good, fingerFor } = touchRig();
  const f = fingerFor(good);
  canvas.fire('pointerdown', T({ pointerId: 1, ...f }));
  canvas.fire('pointerdown', T({ pointerId: 2, clientX: f.clientX + 200, clientY: f.clientY }));
  assert.equal(ui.placingPointer, null, 'the camera may pinch now');
  canvas.fire('pointerup', T({ pointerId: 2, clientX: f.clientX + 200, clientY: f.clientY, timeStamp: 100 }));
  canvas.fire('pointerup', T({ pointerId: 1, ...f, timeStamp: 120 }));
  assert.equal(sent.length, 0);
});

test('touch placement: lifting over the HUD (back onto the build palette) cancels', () => {
  const { canvas, sent, good, fingerFor } = touchRig();
  const f = fingerFor(good);
  const prev = globalThis.document;
  globalThis.document = { elementFromPoint: () => ({ tagName: 'BUTTON' }) };   // not the canvas
  try {
    canvas.fire('pointerdown', T({ pointerId: 1, ...f }));
    canvas.fire('pointerup', T({ pointerId: 1, ...f, timeStamp: 200 }));
  } finally { if (prev === undefined) delete globalThis.document; else globalThis.document = prev; }
  assert.equal(sent.length, 0);
});

test('mouse play is unchanged: a click places under the cursor, a drag does not', () => {
  const { canvas, sent, good } = touchRig();
  const at = { clientX: good.x * 10 + 5, clientY: good.y * 10 + 5 };
  canvas.fire('pointerdown', { pointerType: 'mouse', pointerId: 1, ...at, timeStamp: 0 });
  canvas.fire('pointerup', { pointerType: 'mouse', pointerId: 1, ...at, timeStamp: 80 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].cell, good, 'no offset for the mouse');
  canvas.fire('pointerdown', { pointerType: 'mouse', pointerId: 2, ...at, timeStamp: 100 });
  canvas.fire('pointerup', { pointerType: 'mouse', pointerId: 2, clientX: at.clientX + 90, clientY: at.clientY, timeStamp: 200 });
  assert.equal(sent.length, 1, 'a mouse drag still pans, never builds');
});

test('the 3D camera does not pan with the finger that is steering the build slot', () => {
  const src = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8');
  assert.match(src, /r\.ui && r\.ui\.placingPointer === e\.pointerId\) return;/);
  assert.match(src, /r\.ui = ui;/);
  assert.match(src, /touchSlotPoint\(px, py, rect\.width, rect\.height\)/);
});
