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
  assert.deepEqual(outpostQuality({ safe: true }), { qualityQuery: 'low', lean: true }, 'safe mode: Low with lean drawing buffers');
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

// iPhone 2026-11-14 [MM-task_mwfvyhev_1o]: safe mode was still killed after a minute on the menu.
test('safe mode renders lean (no MSAA, 1x pixels, 512 shadow map) and the menu waits a beat after releasing its GPU contexts', () => {
  const idx = readFileSync(new URL('../../render3d/index.js', import.meta.url), 'utf8');
  assert.match(idx, /new THREE\.WebGLRenderer\(\{ antialias: !lean,/);
  assert.match(idx, /setPixelRatio\(lean \? 1 : pixelRatioFor/);
  assert.match(idx, /lean \? Math\.min\(512, tier\.shadowSize\) : tier\.shadowSize/);
  const menu = readFileSync(new URL('../../menu/menu.js', import.meta.url), 'utf8');
  const open = menu.slice(menu.indexOf('async function openOutpost'));
  assert.ok(open.indexOf('stage.dispose()') < open.indexOf('OUTPOST_RELEASE_MS') && open.indexOf('OUTPOST_RELEASE_MS') < open.indexOf("import('../outpost/view/sessionView.js')"), 'release, wait, then build the outpost');
});

// iPhone v2026.11.13-n [MM-task_mwh8pl3c_1x]: opens within ~20 s of a page load ran; opens after 23 min / an hour on the
// menu were killed at frame 1. Safe mode now opens a late visit on a fresh page.
test('safe mode: a late open goes through a fresh page, once, and only in safe mode', async () => {
  const { needsFreshPage, requestFreshOpen, takeFreshOpen, FRESH_MS, FRESH_KEY } = await import('./safeMode.js');
  assert.equal(needsFreshPage({ safe: true, sinceLoadMs: FRESH_MS + 1 }), true);
  assert.equal(needsFreshPage({ safe: true, sinceLoadMs: FRESH_MS - 1 }), false, 'just after a load: open here');
  assert.equal(needsFreshPage({ safe: false, sinceLoadMs: 3_600_000 }), false, 'not in safe mode: never');
  assert.equal(needsFreshPage({ safe: true, sinceLoadMs: 3_600_000, fresh: true }), false, 'the open the reload asked for');
  const ss = store(); ss.removeItem = (k) => ss.m.delete(k);
  const win = { sessionStorage: ss };
  assert.equal(requestFreshOpen(win, { planet: 'ground', tab: 'farm' }, 1000), true);
  assert.ok(ss.m.has(FRESH_KEY));
  assert.deepEqual(takeFreshOpen(win, 3000), { planet: 'ground', tab: 'farm' });
  assert.equal(takeFreshOpen(win, 3000), null, 'taken once');
  requestFreshOpen(win, { planet: 'ground' }, 1000);
  assert.equal(takeFreshOpen(win, 1000 + 61_000), null, 'a stale request is dropped');
  assert.equal(requestFreshOpen({}, { planet: 'ground' }, 0), false, 'no sessionStorage: open where it is');
  const menu = readFileSync(new URL('../../menu/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /if \(!fresh && freshPageFirst\(planet, tab\)\) return;/);
  assert.match(menu, /takeFreshOpen\(doc\.defaultView, Date\.now\(\)\); if \(f\) setTimeout\(\(\) => openOutpost\(f\.planet, f\.tab, \{ fresh: true \}\)/);
  assert.doesNotMatch(menu, /crumb\(`outpost: /, "the reload's crumb is not an outpost step (a cut-short visit to lastSessionCrashed)");
  const log = readFileSync(new URL('../../diag/errorLog.js', import.meta.url), 'utf8');
  assert.match(log, /'page hidden'/); assert.match(log, /page visible · away /);
});
