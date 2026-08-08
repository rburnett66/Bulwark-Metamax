// HANDLER GATE. boot.test.mjs runs module scope and one ticker frame; it CANNOT catch a fault inside a
// click handler, and that is where the last several faults lived:
//   fillSelection reading an undeclared `part`   -> ReferenceError after pushVol: a phantom undo entry
//                                                   and no fill, silently
//   an undeclared DEFAULT_VOX_PALETTE            -> same shape, different button
//   Remap -> Bake writing voxEdit[part].set(...) -> no error at all; it reported success and did nothing
// The last one is the important one: a handler can be completely broken WITHOUT throwing. So this file
// does not just invoke handlers, it MEASURES THE MODEL either side of them. "It ran" is not the claim.
//
// WHY IT DOES NOT SHARE boot.test.mjs's SANDBOX. That one is deliberately dumb — getElementById returns
// a fresh throwaway proxy every call, which is right for "does the file run" and useless here, because
// `$('x').onclick = f` and `$('x').onclick()` would touch two different objects. This one keeps a stable
// registry keyed on the ids the HTML actually declares, so handlers can be assigned and then fired.
// Widening boot.test.mjs's stubs to cover both would weaken the gate it is; two stubs, two jobs.
//
// VERIFIED BY MUTATION, not by passing. Each fault was reintroduced into stack-forge.js and the gate
// confirmed to fail — on the intended test, and only that one:
//   apply writes a local Map instead of setVox  -> caught by "THE NO-OP THAT STARTED THIS"
//   mirror uses setVox instead of copyVoxColour -> caught by "THE MIRROR MUST NOT INVENT AUTHORSHIP"
//   pushVolAll() -> pushVol(gridPart())         -> caught by "an undo entry covers EVERY part"
//   "Reset edits" stops dropping the carve      -> caught by "Reset edits resets something"
//   move clears each voxel as it copies it      -> caught by "move never eats the voxels…"
// If you add a test here, mutate the thing it claims to protect and check that it fails. A green gate
// proves nothing on its own — that is the whole lesson of the store nothing read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const HTML_IDS = [...readFileSync(DIR + 'stack-forge.html', 'utf8').matchAll(/id="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);

function makeSandbox() {
  const ctx2d = {
    canvas: { width: 64, height: 64 },
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
    putImageData() {}, drawImage() {}, fillRect() {}, clearRect() {}, strokeRect() {}, rect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {}, ellipse() {},
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, transform() {}, clip() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }), setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}),
  };
  const ctx = new Proxy(ctx2d, { get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' ? undefined : () => undefined), set: (t, k, v) => { t[k] = v; return true; } });
  const el = (id) => new Proxy({
    id: id || '', style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
    dataset: {}, children: [], files: [], options: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, insertBefore() {}, remove() {}, replaceChildren() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setAttribute() {},
    removeAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    getContext: () => ctx, toDataURL: () => 'data:,', toBlob() {},
    width: 160, height: 160, clientWidth: 160, clientHeight: 160, offsetHeight: 30,
    value: '', textContent: '', innerHTML: '', innerText: '', checked: false, disabled: false, hidden: true,
    max: '128', min: '0', step: '1', selectedIndex: 0,
  }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });

  const registry = new Map();                       // THE POINT: one object per id, for the whole run
  const byId = (id) => { if (!registry.has(id)) registry.set(id, el(id)); return registry.get(id); };
  for (const id of HTML_IDS) byId(id);
  byId('gridPaintCol').value = '#8fa7bd';
  byId('uid').value = 'unit';

  // REAL <select> SEMANTICS, for the faction dropdowns only. The generic stub stores whatever string you
  // assign to `.value`, and a browser does not: assigning a value with no matching <option> leaves the
  // select on '' and it displays option[0]. That difference IS the bug class these dropdowns had — a
  // dialog selecting a faction that was not in its own option list looked perfectly correct in the
  // harness while silently claiming "Ground / Powder" in the browser. A stub that cannot reproduce it
  // cannot gate it, so these three model the real thing: replacing the options re-derives the value from
  // `selected` (or option[0]), and assigning an absent value clears it.
  for (const id of ['faction', 'svFaction', 'loadFaction']) {
    const s = byId(id);
    let html = '', value = '';
    const opts = () => [...html.matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/g)]
      .map((m) => ({ sel: /\bselected\b/.test(m[1]), text: m[2] }));
    Object.defineProperty(s, 'innerHTML', { configurable: true,
      get: () => html,
      set: (v) => { html = String(v); const o = opts(), pick = o.find((x) => x.sel) || o[0]; value = pick ? pick.text : ''; } });
    Object.defineProperty(s, 'value', { configurable: true,
      get: () => value,
      set: (v) => { value = opts().some((x) => x.text === String(v)) ? String(v) : ''; } });
  }

  const xy = () => ({ x: 0, y: 0, set() {} });
  const display = () => {
    const base = Object.assign(el(), { scale: xy(), position: xy(), anchor: xy(), pivot: xy(), skew: xy(),
      texture: {}, visible: true, alpha: 1, rotation: 0, tint: 0xffffff, zIndex: 0,
      addChild: (c) => c, removeChild() {}, destroy() {} });
    const fluent = new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' ? undefined : () => fluent), set: (t, k, v) => { t[k] = v; return true; } });
    return fluent;
  };
  const sandbox = {};
  const PIXI = {
    Application: class { constructor() {
      (sandbox.__pixiApps = sandbox.__pixiApps || []).push(this);
      this.view = el(); this.stage = display(); this.screen = { x: 0, y: 0, width: 800, height: 600 };
      this.renderer = { extract: { canvas: () => el() }, plugins: {}, render() {}, resize() {}, events: {},
        on() { return this; }, off() { return this; }, once() { return this; }, screen: { width: 800, height: 600 }, view: el() };
      const frame = [];
      this.ticker = { add(fn) { if (typeof fn === 'function') frame.push(fn); return this; }, remove() { return this; },
        start() {}, stop() {}, on() { return this; }, deltaTime: 1, deltaMS: 16, elapsedMS: 16, lastTime: 0, FPS: 60,
        _runFrameOne() { for (const fn of frame.slice()) fn(1); } };
    } },
    Container: class { constructor() { return display(); } }, Sprite: class { constructor() { return display(); } },
    Graphics: class { constructor() { return display(); } }, Text: class { constructor() { return display(); } },
    Texture: { from: () => ({ baseTexture: { update() {}, setSize() {} }, destroy() {} }), WHITE: {}, EMPTY: {} },
    BaseTexture: { from: () => ({ update() {}, destroy() {} }) },
    RenderTexture: { create: () => ({ destroy() {}, baseTexture: { update() {} } }) },
    Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } },
    Point: class { constructor(x, y) { Object.assign(this, { x, y }); } },
    settings: {}, SCALE_MODES: { NEAREST: 0, LINEAR: 1 }, utils: { TextureCache: {} },
  };
  const store = new Map();
  Object.assign(sandbox, {
    document: { createElement: () => el(), createElementNS: () => el(), getElementById: byId,
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
      body: el(), head: el(), documentElement: el(), hidden: false, activeElement: null,
      currentScript: { src: 'http://127.0.0.1:9000/tools/voxel-stack/stack-forge.js' } },
    PIXI, console: { log() {}, info() {}, warn() {}, error() {}, table() {} },
    Math, JSON, Date, Object, Array, String, Number, Boolean, Set, Map, WeakMap, Promise, Error, TypeError,
    RegExp, Symbol, Infinity, NaN, isNaN, isFinite, parseInt, parseFloat,
    Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array, Float32Array, Float64Array, ArrayBuffer,
    encodeURIComponent, decodeURIComponent, structuredClone: (o) => o, btoa: (s) => s, atob: (s) => s,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    indexedDB: { open: () => ({ result: { transaction: () => ({ objectStore: () => ({ put: () => ({}), get: () => ({}), delete: () => ({}), getAllKeys: () => ({}) }) }), createObjectStore() {} } }) },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    fetch: () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    Image: class { constructor() { return el(); } }, FileReader: class {}, Blob: class {}, URL: { createObjectURL: () => 'blob:' },
    ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} },
    alert() {}, confirm: () => true, prompt: () => null,
    navigator: { userAgent: 'node' }, performance: { now: () => 0 },
  });
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.location = sandbox.window.location = { pathname: '/tools/voxel-stack/stack-forge.html', href: 'http://127.0.0.1:9000/tools/voxel-stack/stack-forge.html' };
  sandbox.window.addEventListener = () => {};
  sandbox.window.innerWidth = 1600; sandbox.window.innerHeight = 900; sandbox.window.devicePixelRatio = 1;
  return sandbox;
}

/**
 * boot the tool and hand it a model: a 16×16×8 hull ramp with one red accent stripe
 *
 * `opts.fetch` replaces the sandbox's 404-everything fetch BEFORE module scope runs, which is the only
 * window there is: initFactions() fires at the bottom of stack-forge.js and its fetches are in flight
 * before boot() returns. The faction tests need to both RECORD what was asked for and serve real content.
 */
function boot(opts = {}) {
  const sb = makeSandbox();
  if (opts.fetch) sb.fetch = opts.fetch;
  vm.createContext(sb);
  for (const f of ['../../src/data/factions.js', 'carve.js', 'select.js', 'palette.js', '../toolhead.js', 'stack-forge.js']) {
    vm.runInContext(readFileSync(DIR + f, 'utf8'), sb, { filename: f });
  }
  for (const a of sb.__pixiApps || []) a.ticker._runFrameOne();
  const run = (code) => vm.runInContext(code, sb);
  run(`
    state.foot = 16; state.bodyLayers = 8; state.turretLayers = 4; state.part = 'body';
    (() => {
      const foot = 16, layers = 8, N = foot * foot;
      const VOL = new Uint8Array(layers * N), vcol = new Uint8Array(layers * N * 3), PAINT = new Uint8Array(layers * N);
      for (let z = 0; z < 5; z++) for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
        const k = z * N + y * foot + x; VOL[k] = 1;
        const v = 90 + z * 22;                                  // a tonal hull ramp…
        if (y === 7) { vcol[k*3] = 210; vcol[k*3+1] = 40; vcol[k*3+2] = 45; }   // …plus one accent to lose
        else { vcol[k*3] = v; vcol[k*3+1] = v + 3; vcol[k*3+2] = v + 8; }
      }
      const filled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && !!VOL[z*N + y*foot + x];
      // the REAL sig, or buildModelRaw discards this fixture and re-carves an empty model from no art
      carveCache.body = { foot, layers, sig: carveSig('body', foot, layers),
        m: { VOL, vcol, PAINT, filled, cd: null, views: null, sp: null, dbg: {} } };
      const tf = footOf('turret'), tl = state.turretLayers, TN = tf * tf;
      const TVOL = new Uint8Array(tl * TN);
      carveCache.turret = { foot: tf, layers: tl, sig: carveSig('turret', tf, tl),
        m: { VOL: TVOL, vcol: new Uint8Array(tl * TN * 3), PAINT: new Uint8Array(tl * TN),
             filled: (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < tf && y < tf && z < tl && !!TVOL[z*TN + y*tf + x],
             cd: null, views: null, sp: null, dbg: {} } };
    })();
  `);
  // Arrays and objects that cross the vm boundary belong to the SANDBOX's realm, so deepStrictEqual
  // rejects them against a host literal even when every element matches. Anything structural is compared
  // through this instead.
  const json = (code) => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, sb));
  return {
    run, json, sb,
    click: (id) => run(`document.getElementById('${id}').onclick()`),
    filled: () => run(`(() => { let n = 0; for (const b of liveVOL('body')) if (b) n++; return n; })()`),
    painted: () => run(`(() => { let n = 0; for (const b of carveCache.body.m.PAINT) if (b) n++; return n; })()`),
    distinct: () => run(`(() => {
      const m = carveCache.body.m, foot = 16, layers = 8, N = foot*foot, s = new Set();
      for (let z=0;z<layers;z++) for (let y=0;y<foot;y++) for (let x=0;x<foot;x++) {
        if (!m.filled(x,y,z)) continue; const k = (z*N + y*foot + x) * 3;
        s.add((m.vcol[k]<<16)|(m.vcol[k+1]<<8)|m.vcol[k+2]); }
      return s.size; })()`),
    countRGB: (r, g, b) => run(`(() => { const m = carveCache.body.m; let n = 0;
      for (let i = 0; i < m.PAINT.length; i++) if (m.vcol[i*3]===${r}&&m.vcol[i*3+1]===${g}&&m.vcol[i*3+2]===${b}) n++;
      return n; })()`),
  };
}

test('the palette window opens and offers all six sizes, each with real stats', () => {
  const t = boot();
  t.click('openPal');
  assert.equal(t.run('palOpts.length'), 6, 'six options');
  assert.deepEqual(t.json('palOpts.map(o => o.n)'), t.json('PALETTE_SIZES'));
  assert.ok(t.run('palEntries.length') > 0, 'the window must read the model, not an empty histogram');
  assert.ok(t.run('palWork.length') > 0, 'opening must leave a working palette selected');
  for (const o of t.json('palOpts.map(o => ({ via: o.via, rms: o.rms, avail: o.lumAvail, spread: o.stats.lumSpread, mean: o.stats.meanErr }))')) {
    assert.ok(o.via === 'spread' || o.via === 'coverage');
    assert.ok(Number.isFinite(o.rms) && Number.isFinite(o.mean));
    assert.ok(o.avail > 0, 'lumAvail must describe the MODEL, so lumSpread can be read against it');
    assert.ok(o.spread <= o.avail + 1e-6);
  }
  assert.ok(t.run(`document.getElementById('palSourceNote').textContent`).length > 0, 'the window must say what it read');
});

test('THE NO-OP THAT STARTED THIS: applying a palette actually changes the model', () => {
  // The predecessor of this button wrote voxEdit[part].set(...) — a store with no readers — and then
  // reported "baked N voxels -> M colours". Every assertion here is about the MODEL, not the message.
  const t = boot();
  t.click('openPal');
  const before = t.distinct();
  assert.ok(before > 4, 'test setup: the model must have more colours than the budget');
  t.run('palChoose(4)');
  assert.equal(t.run('palWork.length'), 4);
  t.click('palApply');
  assert.ok(t.distinct() <= 4, `apply must leave at most 4 colours, got ${t.distinct()}`);
  assert.equal(t.painted(), t.filled(), 'every filled voxel must be marked PAINT, or the next carve overwrites it');
});

test('applying a palette is EXACTLY one undo entry, and it restores colour and PAINT', () => {
  const t = boot();
  t.click('openPal');
  const before = t.distinct();
  t.run('palChoose(4)');
  const depth = t.run('volHistory.length');
  t.click('palApply');
  assert.equal(t.run('volHistory.length') - depth, 1, 'apply must push exactly ONE entry');
  const after = t.distinct();
  t.run('volUndo()');
  assert.equal(t.distinct(), before, 'undo must restore every colour');
  assert.equal(t.painted(), 0, 'undo must restore PAINT as well as vcol');
  t.run('volRedoStep()');
  assert.equal(t.distinct(), after, 'redo must be the true inverse of undo');
});

test('an undo entry covers EVERY part the operation touched, not just the active one', () => {
  // The palette apply writes body AND turret. When an entry was a single { part, ... } it snapshotted
  // whichever part was on screen and mutated both, so Ctrl+Z restored half the unit with no way back.
  const t = boot();
  t.click('openPal');
  t.run('palChoose(4)');
  t.click('palApply');
  const entry = t.json('volHistory[volHistory.length - 1].map(e => e.part)');
  assert.deepEqual(entry.slice().sort(), ['body', 'turret'], 'the entry must name both parts');
  for (const e of t.json('volHistory[volHistory.length - 1].map(e => ({ hasVcol: !!e.vcol, hasPaint: !!e.paint, hasSnap: !!e.snap }))')) {
    assert.ok(e.hasSnap && e.hasVcol && e.hasPaint, 'each part snapshot must carry VOL, vcol AND PAINT');
  }
});

test('fill, flood fill and move each write the model and each push exactly one undo entry', () => {
  const t = boot();
  t.run(`renderGridView(); gridSel = { c0: 4, r0: 4, c1: 11, r1: 11 }; gridSelView = gridView; gridSelVox = buildSelVox(true);`);
  assert.ok(t.run('gridSelVox.set.size') > 0, 'test setup: something must be selected');

  t.run(`document.getElementById('gridPaintCol').value = '#00ff88'`);
  let d = t.run('volHistory.length');
  assert.equal(t.run('fillSelection()'), true, 'fill must report doing something');
  assert.equal(t.run('volHistory.length') - d, 1, 'fill: exactly one undo entry');
  assert.equal(t.countRGB(0, 255, 136), t.run('gridSelVox.set.size'), 'fill must recolour every selected voxel');

  d = t.run('volHistory.length');
  const n = t.run('moveSelectionCells(2, 1)');
  assert.ok(n > 0, 'move must move something');
  assert.equal(t.run('volHistory.length') - d, 1, 'move: exactly one undo entry');
  assert.equal(t.run('gridSelVox.set.size'), n, 'the selection must travel with the voxels');
  t.run('volUndo()');

  t.run(`gridSelVox = null; gridSel = null; gridSelView = null; renderGridView();
         document.getElementById('gridPaintCol').value = '#ff00ff';`);
  d = t.run('volHistory.length');
  assert.equal(t.run('floodFillAt(6, 6)'), true, 'flood fill with no selection must fill the patch under the cursor');
  assert.equal(t.run('volHistory.length') - d, 1, 'flood fill: exactly one undo entry');
  assert.ok(t.countRGB(255, 0, 255) > 0, 'flood fill must actually write colour');
});

test('move never eats the voxels it has not copied yet', () => {
  // Source and destination overlap on almost every drag. Clearing as you go loses the overlap.
  const t = boot();
  t.run(`renderGridView(); gridSel = { c0: 4, r0: 4, c1: 11, r1: 11 }; gridSelView = gridView; gridSelVox = buildSelVox(true);`);
  const before = t.filled(), sel = t.run('gridSelVox.set.size');
  const moved = t.run('moveSelectionCells(1, 0)');            // a one-cell shift: maximum overlap
  assert.equal(moved, sel, 'a one-cell move inside the grid must not drop anything');
  assert.equal(t.filled(), before, 'a move must not change how many voxels exist');
});

test('THE MIRROR MUST NOT INVENT AUTHORSHIP', () => {
  // mirrorWorld used setVox, which marks PAINT — and PAINT permanently takes a voxel off the wall-art
  // pass in buildFaces. So mirroring flattened the whole mirrored half to its bare column colour,
  // on the commonest operation there is. It copies the source's PAINT now instead of asserting 1.
  const t = boot();
  t.run(`(() => { carveCache.body.m.PAINT.fill(0); setVox('body', 2*256 + 10*16 + 5, [1, 2, 3]); })()`);
  assert.equal(t.painted(), 1, 'test setup: exactly one authored voxel, on the half the mirror reads FROM');
  t.click('gridMirrorLR');
  assert.equal(t.painted(), 2, 'only the authored voxel and its image may be authored');
  assert.equal(t.run(`(() => carveCache.body.m.PAINT[2*256 + 5*16 + 5])()`), 1, 'the image of an authored voxel is authored');
  assert.equal(t.run(`(() => carveCache.body.m.PAINT[2*256 + 6*16 + 5])()`), 0,
    'a voxel mirrored from an UNAUTHORED source must stay unauthored, or it loses its wall art');
});

test('"Reset edits" resets something', () => {
  // It used to clear voxEdit — a store nothing read — so the button was inert while the Palette window
  // promised "Reset edits restores the source".
  const t = boot();
  t.run(`renderGridView(); gridSel = { c0: 4, r0: 4, c1: 11, r1: 11 }; gridSelView = gridView;
         gridSelVox = buildSelVox(true); document.getElementById('gridPaintCol').value = '#00ff88'; fillSelection();`);
  assert.ok(t.painted() > 0, 'test setup: something is painted');
  t.click('gridResetEdits');                                   // confirm() is stubbed true
  assert.equal(t.painted(), 0, 'reset must drop the authored colour');
  assert.equal(t.run('volDirty.body'), false, 'reset must clear the dirty flag it just satisfied');
  t.run('volUndo()');
  assert.ok(t.painted() > 0, 'and Ctrl+Z must bring the work back');
});

test('every button on the palette window runs without throwing, and the slot editor round-trips', () => {
  const t = boot();
  t.click('openPal');
  t.run(`palWorkSel = 0; palSyncSlot();
         document.getElementById('palSlotCol').value = '#123456';
         document.getElementById('palSlotCol').oninput({ target: document.getElementById('palSlotCol') });`);
  assert.deepEqual(t.json('palWork[0]'), [0x12, 0x34, 0x56], 'editing a slot must change the working palette');
  assert.equal(t.run(`document.getElementById('gridPaintCol').value`), '#123456', 'and load it as the paint colour');
  t.click('palSlotReset');
  assert.deepEqual(t.json('palWork[0]'), t.json('palWorkBase[0]'), 'revert must restore what the reduction chose');
  t.click('palRefresh');
  t.click('paletteClose');
  t.click('paintSwatch');
  t.click('gridUndoBtn');
  t.click('gridRedoBtn');
});

// ── FFF-8: THE PALETTE IS MODEL DATA, NOT A RENDER FILTER ────────────────────────────────────────
// buildFaces, collectVox and the grid each used to build a quantiser from state.paletteN and re-bin EVERY
// voxel on EVERY draw, then push the result through the palMap tuner. So the hex an artist picked was
// replaced between the model and the screen, and the model — which is what ships — never held the colour
// they saw. These pin the property that replaced it.

/**
 * Give the sandbox a REAL keyed source slice, so the slice half of the palette can be measured.
 *
 * The generic canvas stub hands back a zeroed ImageData on every call, which is right for "does it draw
 * without throwing" and useless here: keyedCanvas would key an empty image and slicePaletteEntries would
 * honestly report no colours. So canvases get a persistent pixel buffer that drawImage fills from the
 * image and getImageData/putImageData round-trip through — enough for the real keyBackground to run.
 *
 * The art is a white field with two solid blocks. White floods from the border and is keyed out; the two
 * blocks are 425 apart from it in Manhattan distance against a tolerance of 75, so they survive — which is
 * the point: what reaches the palette is what survives KEYING, not every pixel in the file.
 */
const SLICE_A = [7, 222, 111], SLICE_B = [200, 20, 10];
function installSliceArt(t, part = 'body', view = 'top', W = 32, H = 32) {
  t.run(`(() => {
    const base = document.createElement.bind(document);
    if (!document.__canvasPatched) {
      document.__canvasPatched = true;
      document.createElement = (tag) => {
        const el = base(tag);
        if (String(tag).toLowerCase() !== 'canvas') return el;
        let buf = null;
        const ensure = () => { const n = Math.max(4, (el.width | 0) * (el.height | 0) * 4);
          if (!buf || buf.length !== n) buf = new Uint8ClampedArray(n); return buf; };
        const real = { drawImage: (im) => { const b = ensure(); if (im && im.__px) b.set(im.__px.subarray(0, b.length)); },
          getImageData: () => ({ data: ensure(), width: el.width, height: el.height }),
          putImageData: (id) => { const b = ensure(); if (id && id.data !== b) b.set(id.data.subarray(0, b.length)); } };
        el.getContext = () => new Proxy(real, { get: (o, k) => (k in o ? o[k] : typeof k === 'symbol' ? undefined : () => undefined),
          set: (o, k, v) => { o[k] = v; return true; } });
        return el;
      };
    }
    const W = ${W}, H = ${H}, px = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { px[i*4] = 255; px[i*4+1] = 255; px[i*4+2] = 255; px[i*4+3] = 255; }
    const block = (x0, y0, c) => { for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 10; x++) {
      const p = (y * W + x) * 4; px[p] = c[0]; px[p+1] = c[1]; px[p+2] = c[2]; px[p+3] = 255; } };
    block(5, 5, ${JSON.stringify(SLICE_A)}); block(5, 18, ${JSON.stringify(SLICE_B)});
    imgs['${part}']['${view}'] = { width: W, height: H, __px: px };
    // adding art moves the carve signature; re-stamp so the fixture model stands (the carve is not what
    // is under test here — the palette's SOURCE is)
    for (const p of ['body', 'turret']) if (carveCache[p]) carveCache[p].sig = carveSig(p, carveCache[p].foot, carveCache[p].layers);
  })()`);
}

test('FFF-8: the full palette is read from the KEYED SLICES, not from the carved model', () => {
  // MUTATION: point sliceTally at the raw image instead of keyedCanvas -> white joins the palette and the
  // background this tool spent a whole modal removing gets a slot in a 4-colour reduction.
  const t = boot();
  installSliceArt(t);
  const got = t.json(`slicePaletteEntries().map((e) => e.rgb)`);
  assert.deepEqual(got.map((c) => c.join()).sort(), [SLICE_A.join(), SLICE_B.join()].sort(),
    'exactly the two colours that survive keying — the white field must be gone');
  assert.ok(t.json(`slicePaletteEntries().map((e) => e.n)`).every((n) => n > 0), 'each colour carries its population');
});

test('FFF-8 END TO END: the colour on screen == the colour in the model == the colour that bakes', () => {
  // The claim, on a unit with a REDUCED palette, measured through all three consumers at once:
  //   buildFaces  = what the 3D view and the bake draw
  //   collectVox  = what the .vox export and the Tier C model embed emit
  //   m.vcol      = what is saved
  // MUTATION: put `if (quant) {…}` back into buildFaces -> faceVsModel goes non-zero and this fails.
  const t = boot();
  t.click('openPal');
  t.run('palChoose(4)');
  t.click('palApply');
  const r = t.json(`(() => {
    const foot = 16, layers = 8, N = foot * foot, m = carveCache.body.m;
    const F = buildFaces('body', foot, layers);
    const cells = collectVox('body', foot, layers, 0, 0);
    const pal = new Set(palWork.map((c) => (c[0] << 16) | (c[1] << 8) | c[2]));
    let faceVsModel = 0, exportVsModel = 0, faceOffPalette = 0;
    for (const f of F.faces) {
      const o = (f.z * N + f.y * foot + f.x) * 3;
      if (f.r !== m.vcol[o] || f.g !== m.vcol[o + 1] || f.b !== m.vcol[o + 2]) faceVsModel++;
      if (!pal.has((f.r << 16) | (f.g << 8) | f.b)) faceOffPalette++;
    }
    for (const c of cells) {
      const o = (c.z * N + c.y * foot + c.x) * 3;
      if (c.r !== m.vcol[o] || c.g !== m.vcol[o + 1] || c.b !== m.vcol[o + 2]) exportVsModel++;
    }
    return { faces: F.faces.length, cells: cells.length, faceVsModel, exportVsModel, faceOffPalette };
  })()`);
  assert.ok(r.faces > 0 && r.cells > 0, 'test setup: there must be something to measure');
  assert.equal(r.faceVsModel, 0, `${r.faceVsModel}/${r.faces} drawn faces do not match the model's own colour`);
  assert.equal(r.exportVsModel, 0, `${r.exportVsModel}/${r.cells} exported voxels do not match the model's own colour`);
  assert.equal(r.faceOffPalette, 0, 'every drawn face must be one of the palette colours the artist chose');

  // and the GRID agrees — it used to build a SECOND quantiser over a different histogram
  const grid = t.json(`(() => {
    renderGridView();
    const foot = 16, layers = 8, N = foot * foot, m = carveCache.body.m;
    let off = 0, seen = 0;
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!m.filled(x, y, z)) continue;
      const c = gridGeom.colAt(x, y, z), o = (z * N + y * foot + x) * 3; seen++;
      if (c[0] !== m.vcol[o] || c[1] !== m.vcol[o + 1] || c[2] !== m.vcol[o + 2]) off++;
    }
    return { seen, off };
  })()`);
  assert.ok(grid.seen > 0);
  assert.equal(grid.off, 0, `${grid.off}/${grid.seen} grid cells disagree with the model`);
});

test('FFF-8: the draw-time filter and its four stores are GONE, not merely unused', () => {
  // A store nothing reads is this tool's most expensive recurring bug. These four had readers — on every
  // draw — which is worse: they silently overrode the model. Named individually so a partial revert cannot
  // pass. MUTATION: re-declare any one of them -> this fails and names it.
  const t = boot();
  for (const name of ['buildQuantiser', 'buildPalette', 'weightedMedianCut', 'palMap', 'palKeep', 'palDrop',
    'setPaletteN', 'remapModelToWorking', 'palEpoch']) {
    assert.equal(t.run(`typeof ${name}`), 'undefined', `${name} is a piece of the render-time palette filter`);
  }
  assert.equal(t.run(`state.paletteN === undefined`), true, 'state.paletteN must not exist');
  assert.equal(t.run(`JSON.stringify(snapshotProject()).includes('palMap')`), false,
    'a saved project must not carry filter state beside a model that does not contain its result');
  // buildFaces has no `raw` mode left, because there is no reduction for `raw` to skip
  assert.equal(t.run(`buildFaces.length`), 3, 'buildFaces takes (partId, foot, layers) — nothing else');
});

test('FFF-8: the model palette comes from the MODEL, the full palette from the SLICES', () => {
  // Two palettes, two sources, and the split is the point. The inline paint strip describes what the model
  // HOLDS; the Palette window offers what the ART makes available. modelPalette used to fold the wall
  // sheets in, which made it neither.
  // MUTATION: fold V.side back into modelPalette -> the strip claims a colour vcol does not contain.
  const t = boot();
  t.run(`(() => {
    const foot = 16, layers = 8, w = foot, h = layers;
    const m = new Uint8Array(w * h).fill(1), c = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) { c[i*3] = 7; c[i*3+1] = 222; c[i*3+2] = 111; }   // a colour ONLY the side sheet has
    carveCache.body.m.views = { side: { w, h, m, c }, front: null, back: null, ox: 0, oy: 0, z0: 0 };
    gridModel = null; renderGridView();
  })()`);
  const WALL = (7 << 16) | (222 << 8) | 111;
  const strip = t.json('gridModel.palette.map((c) => (c[0]<<16)|(c[1]<<8)|c[2])');
  assert.ok(strip.length > 0, 'test setup: the strip must have something in it');
  assert.ok(!strip.includes(WALL), 'the MODEL palette must not name a colour that is only in a slice sheet');
  const vcolHas = t.run(`(() => { const m = carveCache.body.m, s = new Set();
    for (let i = 0; i < m.PAINT.length; i++) s.add((m.vcol[i*3]<<16)|(m.vcol[i*3+1]<<8)|m.vcol[i*3+2]);
    return ${JSON.stringify(strip)}.every((k) => s.has(k)); })()`);
  assert.equal(vcolHas, true, 'every colour in the strip must be one vcol actually holds');
  // …and the same colour IS offered by the palette window, because it reaches the screen from a slice
  t.click('openPal');
  assert.ok(t.json('palEntries.map((e) => (e.rgb[0]<<16)|(e.rgb[1]<<8)|e.rgb[2])').includes(WALL),
    'the full palette must offer a colour the slices put on the model');
});

test('FFF-8: applying a palette does not narrow what the palette window can offer next time', () => {
  // THE REASON THE FULL PALETTE COMES FROM THE SLICES. Reduce the model to 2 colours and the model has 2
  // colours — so a window that re-read the MODEL could then only ever offer 2, and every later reduction
  // would be a reduction of a reduction. The slices do not move when the model does.
  // MUTATION: drop the slicePaletteEntries merge from palGatherEntries -> after is 2 and this fails.
  const t = boot();
  installSliceArt(t);
  t.click('openPal');
  const before = t.run('palEntries.length');
  assert.ok(before > 4, 'test setup: the unit must start with more colours than the budget');
  t.run('palChoose(2)');
  t.click('palApply');
  assert.ok(t.distinct() <= 2, 'test setup: the apply must actually have reduced the model');
  t.click('palRefresh');                                             // re-read the source
  const after = t.run('palEntries.length');
  assert.ok(after > 2, `the pool collapsed to the model (${after}) — the source must stay the source`);
  const keys = t.json('palEntries.map((e) => e.rgb.join())');
  for (const c of [SLICE_A, SLICE_B]) {
    assert.ok(keys.includes(c.join()), `${c} is in the art, so it must still be on offer after an Apply`);
  }
  assert.ok(t.run('palOpts.find((o) => o.n === 8).palette.length') > 2,
    'and a bigger size must still be a real offer, not two greys wearing eight hats');
});

test('every paint tool can render its grid', () => {
  // A tool whose branch throws in renderGridView takes the whole canvas down, and the seg button that
  // selects it is the only way to find out.
  const t = boot();
  for (const tool of ['box', 'move', 'paint', 'fill', 'erase', 'add']) {
    t.run(`gridTool = '${tool}'; renderGridView();`);
    assert.equal(t.run('gridTool'), tool);
  }
  for (const view of ['top', 'side', 'front', 'back']) {
    t.run(`gridView = '${view}'; renderGridView();`);
    assert.ok(t.run('!!gridGeom.colAt'), `${view}: gridGeom must carry colAt for the flood fill to match on`);
  }
});

// ── FACTIONS ─────────────────────────────────────────────────────────────────────────────────────
// GGG-2 made the tool LOOK UP a faction's prefix and file instead of guessing them, and that closed the
// two guesses that were visible. These cover what it did not: the registry modelling one file per faction
// when System has three (GGG-6), a Save dialog whose faction dropdown was read by nothing, a roster that
// showed factionless ids under every faction at once, and a "no art" note that could not tell a missing
// file from a failed request.
//
// Every test below was mutation-checked against the code it protects — the fix reverted, the gate
// confirmed red on that test and only that test. The mutations are named in each test.

/** a fetch that RECORDS every url and serves canned bodies; anything unlisted 404s like the real thing */
function contentFetch(bodies = {}) {
  const seen = [];
  const fetch = (url) => {
    const u = String(url);
    seen.push(u);
    const hit = Object.keys(bodies).find((k) => u.endsWith(k));
    return Promise.resolve(hit
      ? { ok: true, status: 200, json: () => Promise.resolve(bodies[hit]) }
      : { ok: false, status: 404, json: () => Promise.resolve({}) });
  };
  return { fetch, seen, asked: (name) => seen.some((u) => u.endsWith(name)) };
}
const unitsDoc = (faction, ids) => ({ faction, units: Object.fromEntries(ids.map((id) => [id, { role: 'r', shape: 's' }])) });
/** let the sandbox's in-flight promise chains (initFactions -> loadShipped -> loadFaction) settle */
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };

/** make renderRoster's DOM survive the stub, and collect the cards it draws */
function captureCards(t) {
  t.run(`
    (() => {
      const grid = document.getElementById('unitGrid');
      grid.__cards = [];
      grid.appendChild = (c) => { grid.__cards.push({ id: c.dataset.uid, html: c.innerHTML }); };
      // renderRoster empties the grid before it draws; the collector has to empty with it, or every
      // faction you visit keeps the cards of the one before and a bucketing bug looks like a pass.
      let _html = '';
      Object.defineProperty(grid, 'innerHTML', {
        get: () => _html,
        set: (v) => { _html = v; if (v === '') grid.__cards.length = 0; },
        configurable: true,
      });
      document.createElement = () => {
        const cv = { width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => undefined }) };
        return { dataset: {}, className: '', innerHTML: '', style: {}, onclick: null, appendChild() {},
                 querySelector: () => cv,
                 classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
      };
    })();
  `);
  return () => t.json(`document.getElementById('unitGrid').__cards`);
}

test('GGG-6: opening System reads ALL THREE of its files, not the first one', async () => {
  // MUTATION: registry `files: ['system']` -> only system.units.json is requested and the five units in
  // system-flak/system-base are unauthorable, which is the entire bug.
  const net = contentFetch({
    'system.units.json': unitsDoc('System', ['SYS-Cannon', 'SYS-Wall']),
    'system-flak.units.json': unitsDoc('System', ['SYS-Flak', 'SYS-Flak-2']),
    'system-base.units.json': unitsDoc('System', ['SYS-Base', 'SYS-Harvester']),
  });
  const t = boot({ fetch: net.fetch });
  await settle();
  const cards = captureCards(t);
  t.run(`loadFaction('System')`);
  await settle();

  for (const f of ['system.units.json', 'system-flak.units.json', 'system-base.units.json']) {
    assert.ok(net.asked(f), `System must request ${f}`);
  }
  assert.deepEqual(t.json('roster.map(u => u.id)'),
    ['SYS-Cannon', 'SYS-Wall', 'SYS-Flak', 'SYS-Flak-2', 'SYS-Base', 'SYS-Harvester'],
    'the roster is the UNION of every declared file, in declaration order');
  assert.equal(t.run('noArtNote'), '', 'all three loaded, so there is nothing to report');
  assert.equal(cards().length, 6);
});

test('the tool no longer fetches content/units/index.json — nothing read it', async () => {
  // MUTATION: restore the initFactions fetch -> this fails. filesIndex was a store with no readers, the
  // same shape as the voxEdit bug this whole gate exists for.
  const net = contentFetch({});
  boot({ fetch: net.fetch });
  await settle();
  assert.ok(!net.asked('index.json'), `nothing reads it, so nothing should ask for it: ${net.seen.join(', ')}`);
});

test('a factionless id gets ONE home, not nine', async () => {
  // The owner's report was "`abrams` seems to appear in multiple factions". It appears in none: `extras`
  // was built from the WHOLE manifest and filtered only by "the current roster did not name it", so every
  // id with no home showed up under all nine factions AND System.
  // MUTATION: drop `.filter(belongsHere)` -> Air shows abrams and SPA-U3, and this fails.
  const net = contentFetch({
    'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks']),
  });
  const t = boot({ fetch: net.fetch });
  await settle();
  t.run(`shippedUnits = { 'GND-Tanks': {}, 'GRN-Tanks': {}, 'SPA-U3': {}, 'abrams': {} };`);
  const cards = captureCards(t);
  const idsIn = async (faction) => { t.run(`loadFaction(${JSON.stringify(faction)})`); await settle(); return cards().map((c) => c.id); };

  assert.deepEqual(await idsIn('Ground / Powder'), ['GND-Tanks'], 'its own unit, and nothing else');
  assert.deepEqual(await idsIn('Air'), [], 'Air has no art and owns none of these ids');
  assert.deepEqual(await idsIn('Greenies (Chem)'), ['GRN-Tanks'], 'bucketed by its OWN prefix, not by where you stand');
  assert.deepEqual(await idsIn('System'), []);
  // and the orphans are somewhere — exactly one somewhere
  assert.deepEqual(await idsIn('⚠ Unassigned'), ['SPA-U3', 'abrams'],
    'ids whose prefix resolves to no faction belong here, and only here');
});

test('orphans stay VISIBLE — bucketing must not become hiding', async () => {
  // The counterpart to the test above, and the reason the fix is not `.filter(id => FAC.factionOfUnitId(id))`.
  // Orphaned content that nothing displays survives for months (FFF-7 / SPA-U3). ⚠ Unassigned is offered
  // in the faction dropdown so the orphans have a place a person can actually reach.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  assert.ok(t.json('FACTIONS').includes('⚠ Unassigned'), 'the set must be reachable from the dropdown');
  t.run(`shippedUnits = { 'abrams': {} };`);
  const cards = captureCards(t);
  t.run(`loadFaction('⚠ Unassigned')`); await settle();
  assert.deepEqual(cards().map((c) => c.id), ['abrams']);
  assert.match(t.run(`document.getElementById('setState').innerHTML`), /resolve to no unit def/,
    'and it must say what is wrong with them, not just list them');
});

test('an orphan shows its FULL id, so it cannot pass for a healthy unit', async () => {
  // MUTATION: `u.id.replace(/^[A-Za-z]+-/, '')` -> SPA-U3 renders as "U3", indistinguishable from a real
  // unit whose faction is implied by the panel it sits in. That is how the orphan went unnoticed.
  const net = contentFetch({ 'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks']) });
  const t = boot({ fetch: net.fetch });
  await settle();
  t.run(`shippedUnits = { 'GND-Tanks': {}, 'SPA-U3': {} };`);
  const cards = captureCards(t);

  t.run(`loadFaction('Ground / Powder')`); await settle();
  assert.match(cards()[0].html, />Tanks</, 'a REAL prefix is dropped — the panel already says the faction');

  t.run(`loadFaction('⚠ Unassigned')`); await settle();
  assert.match(cards()[0].html, />SPA-U3</, 'an unrecognised prefix is kept — it is the only signal it is broken');
});

test('"could not load" is not the same claim as "no art authored"', async () => {
  // MUTATION: collapse the `failed` branch back into the empty-state branch -> Ground / Powder reports
  // "no authored art file yet" while ground-powder.units.json sits on disk. The old catch swallowed the
  // failure, so serving the tool from file://, offline, or against a half-deployed content/ told you the
  // art did not exist, pointing at content that was never the problem.
  const t = boot({ fetch: contentFetch({}).fetch });                 // every request 404s
  await settle();
  t.run(`loadFaction('Ground / Powder')`); await settle();
  const failNote = t.run('noArtNote');
  assert.match(failNote, /could not load/i);
  assert.match(failNote, /ground-powder\.units\.json/, 'it must name the file that failed');
  assert.doesNotMatch(failNote, /no authored art file yet/);

  t.run(`loadFaction('Air')`); await settle();                       // declares no file at all — nothing to fail
  assert.match(t.run('noArtNote'), /no authored art file yet/);
  assert.match(t.run('noArtNote'), /AIR-\*/, 'and it must say what a new unit here would be called');
});

test('the set line reports every card it drew, and keeps the note as well as the count', async () => {
  // The denominator was `roster.length`, which excludes extras — two designed units plus two of your own
  // read "4/2 supplied". And the note REPLACED the count, so a faction showing cards could simultaneously
  // insist there was nothing there.
  const net = contentFetch({ 'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks', 'GND-Trucks']) });
  const t = boot({ fetch: net.fetch });
  await settle();
  t.run(`shippedUnits = { 'GND-Tanks': {}, 'GND-Trucks': {}, 'GND-Mine': {}, 'GND-Scout': {} };`);
  captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();
  assert.match(t.run(`document.getElementById('setState').innerHTML`), /4\/4/, 'never n/roster.length');
});

test('the Save dialog offers System, and opens on the faction the ID belongs to', async () => {
  // MUTATION: `FACTIONS.filter(f => f !== 'System' && f !== DECOR_SET)` -> System is absent, so standing
  // in System and opening Save selects nothing and a <select> falls back to option[0]: the dialog says
  // "Ground / Powder" over a SYS-* unit. It was also a display name hand-spelled outside the registry,
  // which is the habit the registry exists to end.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  assert.ok(t.json('UNIT_FACTIONS').includes('System'), 'System units are real and authorable');
  assert.ok(!t.json('UNIT_FACTIONS').some((f) => f.includes('Terrain') || f.includes('Unassigned')),
    'the pseudo-sets have no prefix and must not be offered as a save target');

  t.run(`curFaction = 'Air'; openSaveModal('SYS-Flak')`);
  assert.equal(t.run(`document.getElementById('svFaction').value`), 'System',
    'the id is the fact; the panel you are standing in is not');
});

test('THE SPA-U3 GATE: a save whose prefix contradicts its faction is refused', async () => {
  // GGG-2 fixed the id "+ Add unit" PROPOSES. It did not fix the id you can type: the Add prompt is
  // editable and the Save dialog's id is a free-text field, so SPA-U3 was still reachable through the
  // primary save path — with a faction dropdown right beside it that nothing read.
  // MUTATION: remove the svBlockedByFaction() call from svGeom -> the orphan is written and this fails.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  t.run(`curFaction = 'Space Tech'; openSaveModal('SPA-U3');
         document.getElementById('svFaction').value = 'Space Tech'; svSyncPath();`);

  assert.match(t.run(`document.getElementById('svWarn').innerHTML`), /never resolve to a unit def/);
  assert.equal(t.run(`document.getElementById('svWarn').hidden`), false, 'the warning must be SHOWN');

  // ASSERT ON WHAT HAPPENS BEFORE THE FIRST await. svGeom adopts the id — `$('uid').value = id;
  // activeUnitId = id;` — synchronously, and only THEN awaits doAutosave. The await never settles in this
  // sandbox (the idb stub fires no request events), so asserting on the manifest alone passes whether the
  // gate is there or not: a mutation that deletes the gate is caught here and nowhere else.
  t.run(`activeUnitId = 'GND-Tanks'; document.getElementById('uid').value = 'GND-Tanks';`);
  const before = t.json('Object.keys(loadManifest().units || {})');
  t.run(`document.getElementById('svGeom').onclick()`);
  assert.equal(t.run('activeUnitId'), 'GND-Tanks', 'a refused id must not become the active unit');
  assert.equal(t.run(`document.getElementById('uid').value`), 'GND-Tanks', 'nor be adopted by the id field');
  await settle();
  assert.deepEqual(t.json('Object.keys(loadManifest().units || {})'), before, 'nothing may be written');
  assert.deepEqual(t.json('roster.map(u => u.id)'), [], 'and no card may be created');
  assert.equal(t.run(`document.getElementById('saveModal').hidden`), false, 'the dialog stays open to be fixed');

  // BOTH buttons, not just the recommended one. "Save all" bakes and writes sprite sheets and the
  // manifest; a gate on only one of the two leaves the heavier path open. Its first synchronous act
  // without the gate is closeSave(), and then quickSave adopts the id — so the modal staying open and
  // uid staying put is what proves it refused.
  t.run(`document.getElementById('saveModal').hidden = false;
         activeUnitId = 'GND-Tanks'; document.getElementById('uid').value = 'GND-Tanks';
         document.getElementById('svAll').onclick();`);
  assert.equal(t.run(`document.getElementById('saveModal').hidden`), false, 'Save all must refuse it too');
  assert.equal(t.run(`document.getElementById('uid').value`), 'GND-Tanks', 'and must not adopt the id');
  await settle();
  assert.deepEqual(t.json('Object.keys(loadManifest().units || {})'), before, 'still nothing written');

  // a MATCHING prefix is not blocked — the gate must not simply refuse everything
  t.run(`openSaveModal('SPC-U3'); document.getElementById('svFaction').value = 'Space Tech'; svSyncPath();`);
  assert.equal(t.run(`document.getElementById('svWarn').hidden`), true, 'SPC-U3 under Space Tech is correct');
  assert.equal(t.run(`svMismatch()`), null);
});

test('the faction dropdown REPAIRS the prefix instead of just labelling it', async () => {
  // It was decorative: neither save button ever read $('svFaction'), while the note beneath it claimed
  // "Faction <X> tags the card". It tagged nothing — the card lands on whatever roster you are standing
  // in. Changing it now rewrites the id, which is the one-click repair for an orphan.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  const rePrefix = (id, fac) => { t.run(`openSaveModal(${JSON.stringify(id)});
    document.getElementById('svFaction').value = ${JSON.stringify(fac)};
    document.getElementById('svFaction').onchange();`);
    return t.run(`document.getElementById('svId').value`); };

  assert.equal(rePrefix('SPA-U3', 'Space Tech'), 'SPC-U3', 'the orphan that started all of this');
  assert.equal(rePrefix('GND-Tanks', 'Water'), 'WTR-Tanks', 'a real prefix is swapped, not appended');
  assert.equal(rePrefix('abrams', 'Ground / Powder'), 'GND-abrams', 'an id with no prefix gains one');
  assert.equal(rePrefix('SYS-Flak', 'System'), 'SYS-Flak', 'already right — left alone');
});

test('the Load dialog cannot claim you are somewhere you are not', async () => {
  // MUTATION: `sel.innerHTML = UNIT_FACTIONS.map(...)` unconditionally -> standing in a pseudo-set leaves
  // no option selected, the <select> shows option[0], and since this dropdown RE-LOADS whatever it
  // displays there was no way back to the set you came from.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  for (const set of ['🌿 Terrain (decor)', '⚠ Unassigned', 'System', 'Air']) {
    t.run(`curFaction = ${JSON.stringify(set)}; openLoadModal();`);
    await settle();
    assert.equal(t.run(`document.getElementById('loadFaction').value`), set,
      `the dropdown must show ${set}, the set actually open`);
  }
});

test('the Unit id field ships with no default id', () => {
  // value="abrams". Every fresh session started on a real-looking, factionless id, so anyone who saved
  // without changing it created or overwrote a unit called `abrams` — which is where the dirty data in
  // the shipped manifest came from. The harness cannot catch this: makeSandbox sets uid itself.
  const html = readFileSync(DIR + 'stack-forge.html', 'utf8');
  const uid = html.match(/<input[^>]*id="uid"[^>]*>/);
  assert.ok(uid, 'the field must exist');
  const value = uid[0].match(/value="([^"]*)"/);
  assert.ok(!value || value[1] === '', `the id field must not default to a real-looking id, got "${value && value[1]}"`);
  assert.match(uid[0], /placeholder="[^"]+"/, 'with the placeholder doing the teaching instead');
});

test('ROUND TRIP: a new unit in EVERY faction gets an id that resolves back to that faction', async () => {
  // The SPA-U3 class, proved absent rather than argued absent. This is half of the round trip: the tool
  // proposes an id, and that id resolves through the registry to the faction you were standing in. The
  // other half is in src/data/factions.test.mjs, which checks every registry prefix against the ids
  // tables.js ACTUALLY uses and that every id in tables.js resolves — the tool cannot read tables.js
  // itself (ES module vs classic script), so the two gates meet at the registry.
  // MUTATION: prefixFor back to `name.slice(0,3).toUpperCase()` -> six of the nine fail here by name.
  const t = boot({ fetch: contentFetch({}).fetch });
  await settle();
  captureCards(t);
  t.run(`prompt = (msg, def) => def;`);                              // accept the id the tool proposes
  const sets = t.json('FACTIONS');
  const real = sets.filter((f) => !f.includes('Terrain') && !f.includes('Unassigned'));
  assert.equal(real.length, 10, 'nine playable factions plus System');

  for (const f of real) {
    t.run(`roster = []; curFaction = ${JSON.stringify(f)};
           document.getElementById('addUnit').onclick();`);
    const ids = t.json('roster.map(u => u.id)');
    assert.equal(ids.length, 1, `${f}: adding a unit must create exactly one roster entry`);
    assert.equal(t.run(`(BulwarkFactions.factionOfUnitId(${JSON.stringify(ids[0])}) || {}).name || null`), f,
      `${f} proposed "${ids[0]}", which resolves to a different faction — that is the SPA-U3 bug`);
    // and the id it proposed is one the Save dialog will accept, so the two paths cannot disagree
    t.run(`openSaveModal(${JSON.stringify(ids[0])});`);
    assert.equal(t.run(`document.getElementById('svFaction').value`), f);
    assert.equal(t.run(`svMismatch()`), null, `${f}: the Save gate must accept the id Add unit proposed`);
  }

  // the pseudo-sets have no prefix, so they must REFUSE rather than invent one
  for (const f of ['⚠ Unassigned']) {
    t.run(`roster = []; curFaction = ${JSON.stringify(f)};
           document.getElementById('addUnit').onclick();`);
    assert.deepEqual(t.json('roster.map(u => u.id)'), [], `${f} has no prefix and must not fabricate an id`);
  }
});
