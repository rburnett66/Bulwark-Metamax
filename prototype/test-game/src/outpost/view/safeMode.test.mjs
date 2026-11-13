// Owner error report v2026.11.12-y (iPhone) [MM-story_mwf40d9i_1]: since the outpost moved onto the battle's view, every
// visit logged 'outpost: session view' and the tab reloaded ~4 s later. The one-view move had dropped the outpost's safe
// mode; it is back on the session view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outpostSafeMode, outpostQuality, gpuLine, SAFE_KEY, SAFE_LODS } from './safeMode.js';

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test('a visit cut short turns safe mode on, and it stays on', () => {
  const ls = store();
  assert.equal(outpostSafeMode({ localStorage: ls }, () => false), false);
  assert.equal(outpostSafeMode({ localStorage: ls }, () => true), true);
  assert.equal(ls.m.get(SAFE_KEY), '1');
  assert.equal(outpostSafeMode({ localStorage: ls }, () => false), true, 'remembered on this device');
});

test('blocked storage never throws', () => {
  const win = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(outpostSafeMode(win, () => true), true);
  assert.equal(outpostSafeMode(win, () => false), false);
});

test('quality: a forced tier, else ?quality=, else Low in safe mode, else the battle rules', () => {
  assert.deepEqual(outpostQuality({ tier: 'high', safe: true }), { qualityQuery: 'high' });
  assert.deepEqual(outpostQuality({ safe: true, query: 'high' }), {}, '?quality= is left to the battle mount');
  assert.deepEqual(outpostQuality({ safe: true }), { qualityQuery: 'low' });
  assert.deepEqual(outpostQuality({ safe: false }), {}, 'no null override of the page query or Settings');
  assert.deepEqual([...SAFE_LODS], [2]);
});

test('the GPU line reads the renderer, and a broken one reads "gpu ?"', () => {
  const r = { THREE: { Vector2: class { constructor() { this.x = 0; this.y = 0; } } }, tier: { key: 'low' },
    renderer: { info: { memory: { textures: 7, geometries: 40 }, programs: [1, 2] }, getPixelRatio: () => 1.5,
      getDrawingBufferSize: (v) => { v.x = 900; v.y = 400; return v; } } };
  assert.equal(gpuLine(r), 'tier low · dpr 1.5 · 900×400 · tex 7 · geo 40 · prog 2');
  assert.equal(gpuLine({}), 'gpu ?');
});

test('the session view uses safe mode and logs its steps and its close', () => {
  const src = readFileSync(new URL('./sessionView.js', import.meta.url), 'utf8');
  assert.match(src, /outpostSafeMode\(win\)/);
  assert.match(src, /lodLevels: safe \? SAFE_LODS : null/);
  assert.match(src, /outpostQuality\(\{ tier: opts\.tier, safe, query: urlQuality \}\)/);
  assert.doesNotMatch(src, /qualityQuery: opts\.tier \|\| null/, 'never a null override');
  assert.match(src, /createFarmEmbers\(\{ safe \}\)/);
  for (const c of ['outpost: starting the 3D view', 'outpost: loading the building models', 'outpost: placing the buildings',
    "crumb('outpost: closed')", 'outpost: open · ', 'outpost: frame ']) assert.ok(src.includes(c), c);
});
