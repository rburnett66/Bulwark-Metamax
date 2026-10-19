// [MM-task_mvfqzjkm_7] fire sprites: every fire draws flipbook flames — a procedural stand-in until the owner's sheet
// (content/fx/fire-atlas.png + .json) is committed, then that.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { FIRE_ATLAS, fireAtlasPixels, createFireAtlas, fireFrame } from './fireAtlas.js';
import { createImpacts, K } from './impacts.js';
import { createImpactsView } from './impactsView.js';

const A = FIRE_ATLAS, W = A.cols * A.cell, N = A.cols * A.rows;
const px = fireAtlasPixels();
const lum = (f, x, y) => {   // x, y in 0..1 inside frame f (y up)
  const ox = (f % A.cols) * A.cell, oy = Math.floor(f / A.cols) * A.cell;
  const i = ((oy + Math.min(A.cell - 1, Math.floor(y * A.cell))) * W + ox + Math.min(A.cell - 1, Math.floor(x * A.cell))) * 4;
  return px[i] + px[i + 1] + px[i + 2];
};
const frameDiff = (a, b) => {
  let d = 0;
  for (let y = 0; y < 1; y += 1 / 32) for (let x = 0; x < 1; x += 1 / 32) d += Math.abs(lum(a, x, y) - lum(b, x, y));
  return d;
};

test('the stand-in flipbook: deterministic, a flame per frame — hot root, dim tip, black sides', () => {
  assert.deepEqual(fireAtlasPixels().slice(0, 8192), px.slice(0, 8192), 'same seed → same pixels');
  for (let f = 0; f < N; f++) {
    assert.ok(lum(f, 0.5, 0.25) > 400, `frame ${f}: bright body`);
    assert.ok(lum(f, 0.5, 0.25) > lum(f, 0.5, 0.92) * 2, `frame ${f}: the tip fades`);
    assert.ok(lum(f, 0.03, 0.5) < 20 && lum(f, 0.97, 0.5) < 20, `frame ${f}: black either side (additive = transparent)`);
  }
  // reddish: red ≥ green ≥ blue everywhere it glows
  for (let i = 0; i < px.length; i += 4 * 97) if (px[i + 3] > 30) assert.ok(px[i] >= px[i + 1] && px[i + 1] >= px[i + 2]);
});

test('the flipbook loops: the last frame runs into the first like any other pair', () => {
  let sum = 0;
  for (let f = 0; f < N - 1; f++) sum += frameDiff(f, f + 1);
  const avg = sum / (N - 1), wrap = frameDiff(N - 1, 0);
  assert.ok(wrap < avg * 2, `wrap step ${wrap.toFixed(0)} vs average ${avg.toFixed(0)}`);
  assert.ok(avg > 0, 'frames move');
});

test('fireFrame: each flame starts on its own frame and plays forward at the atlas fps', () => {
  assert.equal(fireFrame(0, 0), 0);
  assert.equal(fireFrame(0.5, 0), N / 2);
  assert.equal(fireFrame(0, 1 / A.fps), 1);
  assert.equal(fireFrame(0.99, 10 / A.fps), (Math.floor(0.99 * N) + 10) % N);
  for (let t = 0; t < 3; t += 0.07) { const f = fireFrame(0.37, t); assert.ok(f >= 0 && f < N && Number.isInteger(f)); }
});

test('every fire particle draws in the flame batch, not as a glow dot; the sheet swaps in', () => {
  const scene = new THREE.Scene(), view = createImpactsView(THREE, scene, {}), fx = createImpacts();
  assert.equal(view.atlas.source, 'procedural', 'no sheet in node: the stand-in');
  for (let i = 0; i < 12; i++) fx.emit(K.FIRE, i * 0.1, 0.2, 0, 0, 1, 0, 0.5, 0.2);
  fx.emit(K.SPARK, 0, 0.2, 0, 1, 1, 0, 0.5, 0.02);
  view.sync(fx);
  assert.equal(view.fire.n, 12, 'twelve flames');
  assert.equal(view.add.n, 1, 'only the spark is a glow dot');
  assert.equal(view.fire.mesh.material.blending, THREE.AdditiveBlending);
  const frames = new Set(Array.from(view.fire.a.iFrame.array.slice(0, 12)));
  assert.ok(frames.size > 6, `flames on different frames (${frames.size})`);
  // the owner's sheet: 8 × 4, read top-left first
  const sheet = { texture: new THREE.Texture(), cols: 8, rows: 4, frames: 32, topDown: true };
  view.fire.setAtlas(sheet);
  const u = view.fire.mesh.material.uniforms;
  assert.ok(u.uAtlas.value === sheet.texture && u.uGrid.value.x === 8 && u.uGrid.value.y === 4 && u.uTopDown.value === 1);
  assert.equal(view.fire.frames, 32);
  view.dispose();
});

test('createFireAtlas: the stand-in texture, and no network in node', () => {
  const a = createFireAtlas(THREE);
  assert.equal(a.source, 'procedural');
  assert.equal(a.texture.image.width, W);
  assert.equal(a.frames, N);
});

test('the owner\'s sheet ships: manifest and PNG agree, flames keyed to black [MM-task_mvfqzjkm_7]', async () => {
  const fs = await import('node:fs');
  const { sheetAtlas } = await import('./fireAtlas.js');
  const m = JSON.parse(fs.readFileSync(new URL('../../../content/fx/fire-atlas.json', import.meta.url), 'utf8'));
  assert.ok(m.cols > 0 && m.rows > 0, 'a sheet is committed');
  const png = fs.readFileSync(new URL('../../../content/fx/fire-atlas.png', import.meta.url));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  assert.equal(w % m.cols, 0, 'whole-pixel columns'); assert.equal(h % m.rows, 0, 'whole-pixel rows');
  const a = sheetAtlas(new THREE.Texture(), m);
  assert.ok(a.frames === m.cols * m.rows && a.topDown && a.source === 'sheet');
  assert.ok(a.fps < FIRE_ATLAS.fps, 'separate variants flicker slower than an animation plays');
});
