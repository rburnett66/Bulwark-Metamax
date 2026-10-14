// render3d pure helpers — camera maths, the one sun, baked-level/map agreement, heading tracking.
// None of these modules imports three.js: CI has neither three.js nor WebGL (plan v2.2 §9).
// [MM-task_mv883c5d_b]
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CAMERA, cellToWorld, worldToCell, createCameraState, clampCamera, cameraPose, panByPixels, zoomBy, rayToGround } from './camera.js';
import { AMBIENT, sunDirection, sunIntensity } from './lighting.js';
import { bakedLevelDir, checkLevelAgainstMap } from './level.js';
import { createHeadingTracker, angleDelta, turnToward, HULL_TURN, TURRET_TURN } from './heading.js';
import { SUN } from '../render/sun.js';
import { buildTerrainMap } from '../sim/mapgen.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── camera ────────────────────────────────────────────────────────────────────────────────────────
test('camera starts on the base cell centre, at the start distance, yaw 0', () => {
  const cam = createCameraState({ cols: 64, rows: 32, base: { x: 31, y: 15 } });
  assert.deepEqual(cam, { tx: 31.5, tz: 15.5, dist: CAMERA.startDist, yaw: 0 });
});

test('pose: pitched down 37°, south of the target at yaw 0, looking at the ground target', () => {
  const pose = cameraPose({ tx: 10, tz: 5, dist: 20, yaw: 0 });
  assert.deepEqual(pose.target, { x: 10, y: 0, z: 5 });
  assert.ok(close(pose.position.x, 10));
  assert.ok(pose.position.z > 5, 'camera sits south (+Z) of the target, looking north');
  const pitch = Math.atan2(pose.position.y, pose.position.z - 5) * 180 / Math.PI;
  assert.ok(close(pitch, 37, 1e-9));
  assert.ok(close(Math.hypot(pose.position.y, pose.position.z - 5), 20, 1e-9), 'distance preserved');
});

test('clamp keeps the distance and target inside their limits', () => {
  const cam = clampCamera({ tx: -50, tz: 999, dist: 1, yaw: 0 }, 64, 32);
  assert.equal(cam.dist, CAMERA.minDist);
  assert.equal(cam.tx, -CAMERA.margin);
  assert.equal(cam.tz, 32 + CAMERA.margin);
  assert.equal(clampCamera({ tx: 0, tz: 0, dist: 1e6, yaw: 0 }, 64, 32).dist, CAMERA.maxDist);
});

test('pan: drag right moves the target west, drag down moves it north; vertical covers more ground', () => {
  const a = panByPixels({ tx: 0, tz: 0, dist: 40, yaw: 0 }, 100, 0, 800);
  assert.ok(a.tx < 0 && close(a.tz, 0));
  const b = panByPixels({ tx: 0, tz: 0, dist: 40, yaw: 0 }, 0, 100, 800);
  assert.ok(b.tz < 0 && close(b.tx, 0));
  assert.ok(Math.abs(b.tz) > Math.abs(a.tx), 'foreshortened ground: 1 / sin(pitch) more per pixel vertically');
  const none = panByPixels({ tx: 1, tz: 2, dist: 40, yaw: 0 }, 100, 100, 0);
  assert.deepEqual([none.tx, none.tz], [1, 2], 'a zero-height viewport moves nothing');
});

test('zoom multiplies distance; garbage factors are ignored', () => {
  assert.equal(zoomBy({ dist: 40 }, 1.5).dist, 60);
  assert.equal(zoomBy({ dist: 40 }, 0).dist, 40);
  assert.equal(zoomBy({ dist: 40 }, NaN).dist, 40);
});

test('ray → ground: hits Y=0 below the camera, misses when parallel or pointing up', () => {
  assert.deepEqual(rayToGround({ x: 1, y: 10, z: 2 }, { x: 0.5, y: -1, z: 0 }), { x: 6, z: 2 });
  assert.equal(rayToGround({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }), null);
  assert.equal(rayToGround({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 }), null);
});

test('cell ↔ world uses the cell-centre convention of Pixi cellToLocal', () => {
  assert.equal(cellToWorld(3), 3.5);
  assert.deepEqual(worldToCell(3.99, 0.01), { x: 3, y: 0 });
  assert.deepEqual(worldToCell(cellToWorld(7), cellToWorld(4)), { x: 7, y: 4 });
});

// ── lighting ──────────────────────────────────────────────────────────────────────────────────────
test('sun comes from render/sun.js: 135°/45° → light from the north-west (−X, −Z), unit length', () => {
  const d = sunDirection();
  assert.equal(SUN.azimuthDeg, 135);
  assert.ok(d.x < 0 && d.z < 0 && d.y > 0);
  assert.ok(close(d.x, d.z, 1e-12), '135° is exactly diagonal');
  assert.ok(close(Math.hypot(d.x, d.y, d.z), 1, 1e-12));
  assert.ok(close(d.y, Math.sin(Math.PI / 4), 1e-12));
});

test('balance: ambient + sun on a flat ground = 1 (baked colour exactly), shadow = ambient', () => {
  const d = sunDirection();
  assert.ok(close(AMBIENT + sunIntensity(d) * d.y, 1, 1e-12));
  assert.equal(AMBIENT, 0.6);
});

// ── baked level ↔ the sim's map ───────────────────────────────────────────────────────────────────
test('the COMMITTED powder-map-1 bake matches the map the sim builds (size, base, blocking)', () => {
  const level = JSON.parse(fs.readFileSync(path.join(GAME, bakedLevelDir('powder-map-1'), 'level.json'), 'utf8'));
  const forge = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));
  const map = buildTerrainMap(forge, 1, { seed: 0, bakeTune: {} });   // what main.js builds with the default tune
  const res = checkLevelAgainstMap(level, map);
  assert.deepEqual(res.problems, []);
  assert.equal(res.ok, true);
  for (const t of level.tiles) assert.ok(fs.existsSync(path.join(GAME, bakedLevelDir('powder-map-1'), t.name)), `tile ${t.name} is committed`);
});

test('a stale bake is reported, never passed: size, base and blocking drift are each named', () => {
  const map = { cols: 4, rows: 2, base: { x: 1, y: 1 }, blockedCells: [{ x: 0, y: 0 }, { x: 3, y: 1 }] };
  assert.equal(checkLevelAgainstMap({ cols: 4, rows: 2, base: { x: 1, y: 1 }, blocked: [0, 7] }, map).ok, true);
  const size = checkLevelAgainstMap({ cols: 5, rows: 2, base: { x: 1, y: 1 }, blocked: [0, 7] }, map);
  assert.equal(size.ok, false); assert.match(size.problems[0], /size/);
  const base = checkLevelAgainstMap({ cols: 4, rows: 2, base: { x: 2, y: 1 }, blocked: [0, 7] }, map);
  assert.equal(base.ok, false); assert.match(base.problems.join(), /base/);
  const blk = checkLevelAgainstMap({ cols: 4, rows: 2, base: { x: 1, y: 1 }, blocked: [0, 6] }, map);
  assert.equal(blk.ok, false); assert.match(blk.problems.join(), /1 cell\(s\) blocked only in the sim, 1 only in the bake/);
  assert.equal(checkLevelAgainstMap(null, map).ok, false);
  assert.equal(checkLevelAgainstMap({}, null).ok, false);
});

// ── heading ───────────────────────────────────────────────────────────────────────────────────────
test('heading follows motion (atan2(dy, dx)), holds still when parked, forgets dead units', () => {
  const h = createHeadingTracker();
  assert.equal(h.update(1, 0, 0), 0, 'first sighting: initial heading');
  assert.ok(close(h.update(1, 1, 0), 0));                    // east
  assert.ok(close(h.update(1, 1, 1), Math.PI / 2));          // south (+y)
  assert.ok(close(h.update(1, 1, 1), Math.PI / 2), 'no motion → keeps the last heading');
  assert.ok(close(h.update(1, 1 + 1e-6, 1), Math.PI / 2), 'sub-threshold jitter is ignored');
  for (let i = 0; i < 20; i++) h.update(1, 1 + (i % 2 ? 0.15 : 0), 1 + (i % 2 ? -0.12 : 0));   // a sim flip-flop (0.15 cells / tick)
  assert.ok(close(h.update(1, 1, 1), Math.PI / 2), 'shuffling in place never turns the unit');
  for (let i = 1; i <= 8; i++) h.update(1, 1 + Math.ceil(i / 2) * 0.1, 1 + Math.floor(i / 2) * 0.1);   // grid stair-steps east/south
  assert.ok(Math.abs(h.update(1, 1.4, 1.4) - Math.PI / 4) < 0.5, 'stair-steps read as the diagonal, not 0° / 90° flips');
  h.update(2, 5, 5);
  h.sweep(new Set([2]));
  assert.equal(h.size, 1);
  assert.equal(h.update(1, 9, 9, 0.25), 0.25, 'a forgotten id starts fresh');
});

test('SMOOTH TURNING: hull + turret ease toward their goals at a capped rate, the shortest way round', () => {
  const deg = (d) => (d * Math.PI) / 180;
  assert.ok(close(angleDelta(deg(170), deg(-170)), deg(20)), 'across ±180° the short way');
  assert.ok(close(angleDelta(deg(-170), deg(170)), deg(-20)));
  assert.ok(close(turnToward(0, deg(90), deg(30)), deg(30)), 'capped');
  assert.equal(turnToward(0, deg(10), deg(30)), deg(10), 'arrives exactly, no overshoot');

  const h = createHeadingTracker(), dt = 1 / 60;
  h.update(1, 0, 0);
  h.update(1, 1, 0);                                         // first real direction: east
  let v = h.turn(1, 0, 0, dt);
  assert.equal(v.heading, 0, 'the first heading snaps — no spin on spawn');
  h.update(1, 1, 1);                                         // path corner: goal jumps to south (+90°)
  v = h.turn(1, Math.PI / 2, Math.PI, dt);                   // and the target switches to due west
  assert.ok(close(v.heading, HULL_TURN * dt), `hull turned one frame's worth: ${v.heading}`);
  assert.ok(close(Math.abs(v.aim), TURRET_TURN * dt), 'turret slews independently, at its own rate');
  for (let i = 0; i < 60; i++) v = h.turn(1, Math.PI / 2, Math.PI, dt);
  assert.ok(close(v.heading, Math.PI / 2) && close(Math.abs(angleDelta(v.aim, Math.PI)), 0), 'both arrive within a second');
  let prev = v.heading, maxStep = 0;
  for (let i = 0; i < 90; i++) { v = h.turn(1, -Math.PI / 2, -Math.PI / 2, dt); maxStep = Math.max(maxStep, Math.abs(angleDelta(prev, v.heading))); prev = v.heading; }
  assert.ok(maxStep <= HULL_TURN * dt + 1e-12, `no frame turns more than the cap (max ${maxStep})`);
  assert.deepEqual(h.turn(1, 1, 2), { heading: 1, aim: 2 }, 'no dt → snap (single frames, tests)');
  assert.deepEqual(h.turn(99, 1, 2, dt), { heading: 1, aim: 2 }, 'unknown id → goals as given');
});

// ── the default path stays untouched ─────────────────────────────────────────────────────────────
test('render3d imports no three.js statically, and main.js reaches it only through a dynamic import', () => {
  const dir = path.join(GAME, 'src/render3d');
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(dir);
  assert.ok(files.length >= 6);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /^\s*import\s[^;]*three/m, `${path.relative(GAME, f)} must not statically import three.js`);
  }
  const main = fs.readFileSync(path.join(GAME, 'src/main.js'), 'utf8');
  assert.doesNotMatch(main, /^\s*import\s[^;]*render3d/m, 'main.js must not statically import render3d');
  assert.match(main, /import\('\.\/render3d\/index\.js'\)/);
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /three/i, 'index.html never loads three.js');
});
