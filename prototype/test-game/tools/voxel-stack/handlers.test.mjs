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

/** boot the tool and hand it a model: a 16×16×8 hull ramp with one red accent stripe */
function boot() {
  const sb = makeSandbox();
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
    run, json,
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
  t.click('paletteAdvanced');
  t.click('paletteClose');
  t.click('paintSwatch');
  t.click('gridUndoBtn');
  t.click('gridRedoBtn');
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
