// [MM-story_mw2s3s9k_c] The FPS counter: rolling frame stats, the readout text, the saved on/off choice (off by default),
// and the meter only runs a frame loop while it is on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameStats, fpsText, loadFpsChoice, saveFpsChoice, createFpsMeter, FPS_KEY, FPS_WINDOW } from './fpsMeter.js';

test('frame stats: average, worst and 1% low over a rolling window; stalls are ignored', () => {
  const s = createFrameStats(10);
  assert.equal(s.summary().frames, 0);
  for (let i = 0; i < 9; i++) s.push(16);
  s.push(40);
  const a = s.summary();
  assert.equal(a.frames, 10);
  assert.ok(Math.abs(a.avgMs - 18.4) < 1e-9);
  assert.equal(a.worstMs, 40);
  assert.equal(Math.round(a.low1Fps), 25);
  s.push(5000); s.push(0); s.push(NaN);   // a hidden tab / bad sample
  assert.equal(s.summary().worstMs, 40);
  for (let i = 0; i < 10; i++) s.push(10);   // the window rolls: the 40 ms frame is gone
  assert.equal(s.summary().worstMs, 10);
  assert.equal(Math.round(s.summary().fps), 100);
  assert.ok(FPS_WINDOW >= 60);
});

test('readout: FPS line, then the 3D line when the view reports', () => {
  const s = { fps: 59.6, avgMs: 16.78, worstMs: 21.2, low1Fps: 47 };
  assert.deepEqual(fpsText(s), ['60 FPS · 16.8 ms · worst 21 ms']);
  const [, b] = fpsText(s, { calls: 16, triangles: 58287, ground: 'tiled ground', tier: 'High' });
  assert.equal(b, '3D 16 calls · 58k tris · tiled ground · High');
  assert.equal(fpsText(s, { calls: 8, triangles: 1500 })[1], '3D 8 calls · 1.5k tris');
});

test('choice: off by default, saved per device, survives storage that throws', () => {
  const mem = new Map(), st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.equal(loadFpsChoice(st), false);
  saveFpsChoice(st, true);
  assert.equal(mem.get(FPS_KEY), '1');
  assert.equal(loadFpsChoice(st), true);
  saveFpsChoice(st, false);
  assert.equal(loadFpsChoice(st), false);
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(loadFpsChoice(bad), false);
  assert.doesNotThrow(() => saveFpsChoice(bad, true));
  assert.equal(loadFpsChoice(null), false);
});

test('meter: no frame loop while off; one loop while on; turning off cancels it', () => {
  let next = 1, live = new Set();
  const win = { requestAnimationFrame: (fn) => { const id = next++; live.add(id); return id; }, cancelAnimationFrame: (id) => live.delete(id) };
  const mkEl = () => ({ className: '', textContent: '', innerHTML: '', setAttribute() {}, classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } } });
  const doc = { defaultView: win, createElement: mkEl };
  const parent = { kids: [], appendChild(e) { this.kids.push(e); } };
  const m = createFpsMeter(doc, parent);
  assert.equal(live.size, 0, 'nothing measured while off');
  assert.equal(m.el.classList.contains('on'), false);
  m.set(true);
  assert.equal(live.size, 1);
  assert.equal(m.el.classList.contains('on'), true);
  m.set(true);
  assert.equal(live.size, 1, 'no second loop');
  m.set(false);
  assert.equal(live.size, 0);
  assert.equal(m.el.classList.contains('on'), false);
});
