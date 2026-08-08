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
 * A REAL IndexedDB, in memory, honouring the request/transaction event model idb() actually drives:
 * open() returns a request whose onsuccess fires LATER (handlers are assigned after the call returns),
 * a transaction's oncomplete fires after the store call, and the value comes off `request.result`.
 *
 * Opt-in, because the default stub deliberately never settles and several tests below depend on that —
 * "assert on what happens BEFORE the first await" is the only way they can catch what they catch.
 * `__idbGets` counts reads so a test can prove the card cache is not re-reading the store per render.
 */
function idbStub(seed) {
  const data = new Map(Object.entries(seed || {}));
  let gets = 0;
  const later = (fn) => Promise.resolve().then(fn);
  const store = {
    put: (v, k) => { data.set(String(k), v); return {}; },
    get: (k) => { gets++; return { result: data.get(String(k)) }; },
    delete: (k) => { data.delete(String(k)); return {}; },
    getAllKeys: () => ({ result: [...data.keys()] }),
  };
  const db = {
    createObjectStore() {},
    transaction: () => { const tx = { objectStore: () => store }; later(() => tx.oncomplete && tx.oncomplete()); return tx; },
  };
  return {
    data, gets: () => gets,
    api: { open: () => { const q = { result: db }; later(() => { if (q.onupgradeneeded) q.onupgradeneeded(); if (q.onsuccess) q.onsuccess(); }); return q; } },
  };
}

/**
 * An Image that actually resolves. `ok(src)` decides load vs error, so a test can serve
 * content/units/voxel/<id>.body.png and 404 everything else — which is the whole point of the card
 * chain: art comes from the repo, and a named-but-absent file must be DISTINGUISHABLE from no art.
 */
function imageStub(ok) {
  return class {
    constructor() { this.width = 64; this.height = 48; this.naturalWidth = 64; this.naturalHeight = 48; }
    set src(v) { this._src = v; Promise.resolve().then(() => { if (ok(String(v))) { if (this.onload) this.onload(); } else if (this.onerror) this.onerror(new Error('404 ' + v)); }); }
    get src() { return this._src; }
  };
}

/**
 * boot the tool and hand it a model: a 16×16×8 hull ramp with one red accent stripe
 *
 * `opts.fetch` replaces the sandbox's 404-everything fetch BEFORE module scope runs, which is the only
 * window there is: initFactions() fires at the bottom of stack-forge.js and its fetches are in flight
 * before boot() returns. The faction tests need to both RECORD what was asked for and serve real content.
 * `opts.idb` / `opts.images` do the same for the two stubs above, for the same reason.
 */
function boot(opts = {}) {
  const sb = makeSandbox();
  if (opts.fetch) sb.fetch = opts.fetch;
  let idb = null;
  if (opts.idb) { idb = idbStub(opts.idb === true ? {} : opts.idb); sb.indexedDB = idb.api; }
  if (opts.images) sb.Image = imageStub(opts.images === true ? () => true : opts.images);
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
    run, json, sb, idb,
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
  t.click('palApply');
  assert.equal(t.run('volHistory.length'), 1, 'apply must be exactly ONE undo step');
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

test('fill, flood fill and move each write the model and each is exactly ONE undo step', () => {
  // MEASURED AS A ROUND TRIP, not as a push count. The history is one level deep now (FFF-2), so counting
  // entries proves nothing: a second push would evict the first and the length would still read 1. Undoing
  // back to the EXACT pre-operation state is the claim, and it is the one that fails if an operation
  // pushes twice — one undo would land on the intermediate state instead.
  const t = boot();
  const shot = () => t.run(`(() => { const m = carveCache.body.m;
    return [...m.VOL].join(',') + '|' + [...m.vcol].join(',') + '|' + [...m.PAINT].join(','); })()`);
  const step = (label, before, run) => {
    run();
    assert.equal(t.run('volHistory.length'), 1, `${label}: one undo step`);
    assert.notEqual(shot(), before, `${label}: must actually change the model`);
    const after = shot();
    t.run('volUndo()');
    assert.equal(shot(), before, `${label}: ONE undo must land exactly on the pre-operation model`);
    t.run('volRedoStep()');
    assert.equal(shot(), after, `${label}: redo must be the true inverse`);
  };

  t.run(`renderGridView(); gridSel = { c0: 4, r0: 4, c1: 11, r1: 11 }; gridSelView = gridView; gridSelVox = buildSelVox(true);`);
  assert.ok(t.run('gridSelVox.set.size') > 0, 'test setup: something must be selected');

  t.run(`document.getElementById('gridPaintCol').value = '#00ff88'`);
  step('fill', shot(), () => assert.equal(t.run('fillSelection()'), true, 'fill must report doing something'));
  assert.equal(t.countRGB(0, 255, 136), t.run('gridSelVox.set.size'), 'fill must recolour every selected voxel');

  let n = 0;
  step('move', shot(), () => { n = t.run('moveSelectionCells(2, 1)'); assert.ok(n > 0, 'move must move something'); });
  assert.equal(t.run('gridSelVox.set.size'), n, 'the selection must travel with the voxels');
  t.run('volUndo()');

  t.run(`gridSelVox = null; gridSel = null; gridSelView = null; renderGridView();
         document.getElementById('gridPaintCol').value = '#ff00ff';`);
  step('flood fill', shot(), () => assert.equal(t.run('floodFillAt(6, 6)'), true,
    'flood fill with no selection must fill the patch under the cursor'));
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

// ── FFF-2: THE MODEL IS THE SAVED ARTIFACT, NOT A CACHE OF THE SLICES ────────────────────────────
// buildModelRaw treated the model as a cache it could throw away: any change to a carve INPUT moved
// carveSig, and the next buildModel silently re-derived from the slices. Six paths reached that, and one
// of them was a RENDER FRAME. The fix is not six guards; it is that a carve happens when the user asks.

/** put BOTH kinds of hand work into the body: a deleted voxel (geo) and a painted one (colour) */
function seedHandWork(t) {
  t.run(`(() => {
    pushVol('body');                                   // one undo step covering both edits below
    liveVOL('body')[2 * 256 + 6 * 16 + 6] = 0;         // GEO: punch a hole the slices would fill back in
    setVox('body', 2 * 256 + 8 * 16 + 8, [255, 0, 255]);   // COLOUR: a hex no carve would ever produce
  })()`);
}
/** read the model back BY COORDINATE — the keys move when foot changes, the work does not */
const handWork = (t) => t.json(`(() => {
  const part = 'body', foot = footOf(part), layers = gridLayersOf(part);
  const m = buildModel(part, foot, layers), N = foot * foot;
  let n = 0;
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (m.filled(x, y, z)) n++;
  const k = (2 * N + 8 * foot + 8) * 3;
  return { filled: n, holeKept: !m.filled(6, 6, 2), paint: [m.vcol[k], m.vcol[k + 1], m.vcol[k + 2]].join(),
           dirty: volDirty.body, stale: carveStale.body };
})()`);

test('FFF-2: EVERY carve input can move without destroying the model', () => {
  // The six paths from the report, each fired the way the tool fires it. Every one of them silently
  // re-derived from the slices before this change.
  // MUTATION: restore `if (hit && dims && hit.sig === sig) return hit.m; const m = carveRaw(...)` in
  // buildModelRaw -> all six fail at once, which is the point: one cause, not six.
  const paths = {
    '(a) Layers slider, per drag-pixel':
      `document.getElementById('bodyLayers').oninput({ target: { value: 12 } });`,
    '(b) Resolution':
      `document.getElementById('res').onchange({ target: { value: 32 } });`,
    '(b) unit size in tiles':
      `setUnitSize(1.5);`,
    '(b) Cube':
      `document.getElementById('bodyCube').onclick();`,
    '(c) slice alignment drag (imgXf), on release':
      `xfEdit('ox', 0.25, false);`,
    '(d) renderView / flip / cutout-Apply — the unconditional recarve()':
      `recarve();`,
    '(e) Geometry box slider — mutates geomState and never calls recarve() at all':
      `boxEdit('Hv', 4);`,
    '(f) a RENDER FRAME: updateGamePreview -> bodyExtentTiles -> buildModel':
      `bodyExtentTiles();`,
  };
  for (const [label, code] of Object.entries(paths)) {
    const t = boot();
    seedHandWork(t);
    const before = handWork(t);
    assert.equal(before.holeKept, true, 'test setup: the geo edit is in the model');
    assert.equal(before.paint, '255,0,255', 'test setup: the colour edit is in the model');
    t.run(code);
    const after = handWork(t);
    assert.equal(after.holeKept, true, `${label}: the deleted voxel came back — the carve was re-run`);
    assert.equal(after.paint, '255,0,255', `${label}: the painted colour was overwritten by the carve`);
    assert.equal(after.filled, before.filled, `${label}: the volume changed size behind the artist`);
    assert.equal(after.dirty, true, `${label}: volDirty must still describe a model that still has hand work`);
  }
});

test('FFF-2: volDirty can never remain true across a rebuild, so autosave cannot stamp a lost carve', () => {
  // Path (e) committed the loss to disk: boxEdit moved geomState without calling recarve(), so volDirty
  // stayed true while the next buildModel handed back a freshly re-derived volume — and autosave wrote it
  // out as `edited: true`, reporting success over work that was gone. The invariant is structural now: a
  // rebuild only happens when volDirty is false.
  // MUTATION: make buildModelRaw re-carve regardless of volDirty -> the first assertion fails.
  const t = boot();
  seedHandWork(t);
  t.run(`boxEdit('Hv', 4); document.getElementById('bodyLayers').oninput({ target: { value: 12 } });`);
  const now = handWork(t);
  assert.equal(now.paint, '255,0,255', 'the model survived, so `edited: true` is the truth');
  assert.equal(now.dirty, true, 'and volDirty still describes a model that still has hand work in it');
  // and after an EXPLICIT re-carve the flag is down, so the fresh volume is not claimed as hand work
  t.run(`recarveFromSource('body'); buildModel('body', footOf('body'), gridLayersOf('body'));`);
  assert.equal(t.run('volDirty.body'), false, 'an explicit re-carve must clear the flag it just satisfied');
  assert.equal(t.json(`(snapshotProject().vol.body || {}).edited`), false,
    'and the saved volume must not claim to be edited');
});

test('FFF-2: a stale model is OFFERED a re-carve, never given one', () => {
  // carveSig keeps its real job — knowing the model no longer matches its slices — and loses the one that
  // cost the work. MUTATION: drop `carveStale[partId] = true` -> the row never appears and a stale model
  // is silently stale, which is how this went unnoticed for so long.
  const t = boot();
  seedHandWork(t);
  t.run(`renderGridView();`);
  assert.equal(t.run(`document.getElementById('carveStaleRow').hidden`), true, 'nothing stale yet');
  t.run(`boxEdit('Hv', 4); renderGridView();`);
  assert.equal(t.run('carveStale.body'), true, 'the signature moved, so the model IS stale');
  assert.equal(t.run(`document.getElementById('carveStaleRow').hidden`), false, 'and the artist must be told');
  assert.match(t.run(`document.getElementById('carveStaleMsg').textContent`), /hand edits are kept/);

  // "Keep" dismisses it for THAT signature — an answered question must not be asked on every redraw
  t.run(`document.getElementById('carveStaleKeep').onclick(); renderGridView();`);
  assert.equal(t.run(`document.getElementById('carveStaleRow').hidden`), true, 'Keep must settle it');
  assert.equal(t.json(`(() => { const m = buildModel('body', footOf('body'), gridLayersOf('body'));
    return !m.filled(6, 6, 2); })()`), true, 'Keep keeps the model, obviously');

  // …and "Re-carve" is the explicit ask: it discards, and ONE Ctrl+Z brings the work back.
  // The magenta is the signal — no carve of any source art produces #ff00ff, so if it is gone the model
  // was re-derived, and (6,6,2) is not a witness because a fresh carve need not fill it either.
  t.run(`boxEdit('Hv', 5); renderGridView(); document.getElementById('carveStaleGo').onclick();`);
  assert.equal(handWork(t).paint === '255,0,255', false, 'Re-carve must actually re-derive from the slices');
  assert.equal(t.run('volDirty.body'), false, 'and the model it produced is not hand work');
  t.run('volUndo()');
  const back = handWork(t);
  assert.equal(back.paint, '255,0,255', 'one undo must bring the painted colour back');
  assert.equal(back.holeKept, true, 'and the geometry edit with it');
});

test('FFF-2: with NOTHING to protect, a carve input still re-carves — the normal flow is intact', () => {
  // The counterpart, and the reason the rule is "hand work", not "never re-carve". Dragging Layers on a
  // fresh carve SHOULD make the box taller; refusing that would trade one broken tool for another.
  // MUTATION: make buildModelRaw always keep the cache -> the model never follows the slider again.
  // BOTH kinds of path, because they reach buildModelRaw differently: one calls recarve() (which drops the
  // cache for a clean part) and one — the Geometry box — never calls it at all and relies on the signature.
  // MUTATION B: `if (hit) return hit.m;` ahead of the carve -> the boxEdit case fails while the slider case
  // still passes, which is exactly why both are here.
  // the accent stripe is the witness: only the test fixture has it, no carve of this (art-less) unit
  // produces it, so its disappearance means the model was re-derived
  for (const [label, code] of Object.entries({
    'Layers slider (through recarve)': `document.getElementById('bodyLayers').oninput({ target: { value: 20 } });`,
    'Geometry box (through the signature alone)': `boxEdit('Hv', 4);`,
  })) {
    const t = boot();
    assert.equal(t.run('volDirty.body'), false, 'test setup: no hand work');
    assert.ok(t.countRGB(210, 40, 45) > 0, 'test setup: the fixture model is loaded');
    t.run(code + ` buildModel('body', footOf('body'), gridLayersOf('body'));`);
    assert.equal(t.countRGB(210, 40, 45), 0, `${label}: a clean model must follow its carve inputs`);
    assert.equal(t.run('volDirty.body'), false, `${label}: a re-derived model is not hand work`);
    assert.equal(t.run('carveStale.body'), false, `${label}: nor is it stale — it was just carved`);
  }
});

test('FFF-2: a Carve button IS the explicit ask, and is one undo step for the whole unit', () => {
  // MUTATION: route runCarve back through plain recarve() -> the hand work survives the press, which
  // sounds safe and means the artist has no way to start over from the source at all.
  const t = boot();
  seedHandWork(t);
  t.run(`(() => { pushVol('turret'); const V = liveVOL('turret'); V[0] = 1; })()`);
  assert.equal(t.run('volDirty.body && volDirty.turret'), true, 'test setup: both parts have hand work');
  t.click('carveTop');
  assert.equal(t.run('volDirty.body'), false, 'a Carve button discards — that is what it is for');
  assert.equal(t.run('volDirty.turret'), false, 'both parts, because carveCuts is a whole-unit setting');
  assert.equal(t.run('volHistory.length'), 1, 'and it is ONE undo step, not one per part');
  assert.deepEqual(t.json('volHistory[0].map((e) => e.part).slice().sort()'), ['body', 'turret'],
    'covering every part it discarded — a one-part entry leaves half the unit un-undoable');
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

/** a fetch that RECORDS every url and serves canned bodies; anything unlisted 404s like the real thing.
 *  POSTs to /__ship are recorded as { path, png } and answered like the dev server, so a test can assert
 *  WHERE a write landed — `shipped` is empty when there is no server, which is the deployed case. */
function contentFetch(bodies = {}, opts = {}) {
  const seen = [], shipped = [];
  const fetch = (url, init) => {
    const u = String(url);
    if (u === '/__ship') {
      if (!opts.ship) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, error: 'not a dev server' }) });
      const req = JSON.parse(init.body);
      shipped.push({ path: req.path, png: !!req.b64, bytes: (req.b64 || '').length });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, path: req.path, bytes: (req.b64 || JSON.stringify(req.data || '')).length }) });
    }
    seen.push(u);
    const hit = Object.keys(bodies).find((k) => u.endsWith(k));
    return Promise.resolve(hit
      ? { ok: true, status: 200, json: () => Promise.resolve(bodies[hit]) }
      : { ok: false, status: 404, json: () => Promise.resolve({}) });
  };
  return { fetch, seen, shipped, asked: (name) => seen.some((u) => u.endsWith(name)) };
}
const unitsDoc = (faction, ids) => ({ faction, units: Object.fromEntries(ids.map((id) => [id, { role: 'r', shape: 's' }])) });
/** let the sandbox's in-flight promise chains (initFactions -> loadShipped -> loadFaction) settle */
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };

/**
 * make renderRoster's DOM survive the stub, and collect the cards it draws
 *
 * The cards are kept as LIVE ELEMENTS, not as a snapshot taken at appendChild. A thumbnail resolves
 * asynchronously and repaints its own card afterwards (that is the design — renderRoster must not block
 * on IndexedDB or an image decode), so a snapshot of innerHTML at append time would record the pending
 * state forever and every card assertion would be about the placeholder.
 *
 * Canvas contexts RECORD their calls and still delegate to the sandbox 2d stub, so a test can ask what
 * was actually drawn — "the card got an image" is a drawImage with the right source rect, not a state
 * flag. getImageData reports a drawn block in the middle: the stub cannot rasterise, and cropToCard /
 * keyBackground both read pixels back, so a canvas that reports nothing anywhere would make every
 * pixel-reading path fail for a reason the code under test is not responsible for.
 */
function captureCards(t) {
  t.run(`
    (() => {
      const grid = document.getElementById('unitGrid');
      grid.__cards = [];
      grid.appendChild = (c) => { grid.__cards.push(c); };
      // renderRoster empties the grid before it draws; the collector has to empty with it, or every
      // faction you visit keeps the cards of the one before and a bucketing bug looks like a pass.
      let _html = '';
      Object.defineProperty(grid, 'innerHTML', {
        get: () => _html,
        set: (v) => { _html = v; if (v === '') grid.__cards.length = 0; },
        configurable: true,
      });
      const mk = document.createElement.bind(document);      // the ORIGINAL — its 2d stub is the one we wrap
      document.createElement = () => {
        const ops = [], raw = mk().getContext('2d');
        raw.getImageData = (x, y, w, h) => {
          const d = new Uint8ClampedArray(Math.max(4, w * h * 4));
          for (let yy = h >> 2; yy < h - (h >> 2); yy++) for (let xx = w >> 2; xx < w - (w >> 2); xx++) {
            const i = (yy * w + xx) * 4; d[i] = 120; d[i + 1] = 130; d[i + 2] = 140; d[i + 3] = 255;
          }
          return { data: d, width: w, height: h };
        };
        const ctx = new Proxy(raw, {
          get: (o, k) => (typeof k === 'string' && typeof o[k] === 'function'
            ? (...a) => { ops.push([k].concat(a.filter((x) => typeof x === 'number'))); return o[k].apply(o, a); }
            : o[k]),
          set: (o, k, v) => { o[k] = v; return true; },
        });
        const cv = { width: 0, height: 0, __ops: ops, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' };
        const badge = { textContent: '', className: '' };
        return { dataset: {}, className: '', innerHTML: '', style: {}, onclick: null, appendChild() {},
                 width: 0, height: 0, __ops: ops, __badge: badge, __cv: cv,
                 getContext: () => ctx, toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
                 querySelector: (sel) => (sel === '.badge' ? badge : cv),
                 classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
      };
    })();
  `);
  return () => t.json(`document.getElementById('unitGrid').__cards.map(c => ({
    id: c.dataset.uid, html: c.innerHTML, thumb: c.dataset.thumb || null,
    badge: c.__badge.textContent, badgeCls: c.__badge.className, ops: c.__cv.__ops }))`);
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

// ── DDD-6: THE CARDS SHOW THE UNIT ────────────────────────────────────────────────────────────────
// "Testing is very difficult without being able to see what is done" — every card was a grey box, so
// the unit set was a wall of identical slots. The card drew `supplied[id].atlases.body`, an INLINE
// data-URL atlas on the manifest entry; atlases left localStorage for IndexedDB and the shipped manifest
// is descriptors-only, so that field is absent on essentially every entry and every card fell through to
// the placeholder — while the badge went on saying "✓ supplied".
//
// Art lives in the REPO (owner 2026-08-07), so the chain is: the baked atlas in content/units/voxel/,
// then a card image rendered from the voxel model and written to content/units/card/, then the source
// slices, then honestly nothing. IndexedDB is read only for the artist's working state, never as the
// home of art.
//
// Every test here was mutation-checked — the fix reverted, the gate confirmed red on that test alone.

/** one VOL blob as the project serialises it. btoa/atob are identity in the sandbox, so a "b64" here is
 *  a raw byte string — which is exactly what b64FromU8 produces under the same stubs. */
function volBlob(foot, layers, fill) {
  const N = foot * foot; let s = '';
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) s += String.fromCharCode(fill(x, y, z) ? 1 : 0);
  return { foot, layers, edited: true, b64: s, paint: null, vcol: null };
}
const emptyViews = () => ({ top: null, side: null, front: null, back: null });
/** a saved WIP project, the way snapshotProject writes one */
function wipProject(id, o = {}) {
  return { format: 'stackforge-project', version: 2, id,
    vol: { body: 'vol' in o ? o.vol : volBlob(4, 2, (x, y, z) => z === 0 || x < 2), turret: null },
    state: { foot: 4, bodyLayers: 2, turretLayers: 1, zScale: 1.8, lightAz: 135, lightK: 55, bakeEl: 45 },
    images: { body: Object.assign(emptyViews(), o.images || {}), turret: emptyViews() },
    flips: { body: {}, turret: {} }, rots: { body: {}, turret: {} }, keyTol: { body: {}, turret: {} },
    polys: { body: {}, turret: {} }, picks: { body: {}, turret: {} },
    vox: { body: null, turret: null } };
}
const packOf = (id) => ({ pack: { id, parts: [
  { id: 'body', atlas: id + '.body.png', cell: [216, 266], cols: 4 },
  { id: 'turret', atlas: id + '.turret.png', cell: [216, 266], cols: 8 } ] } });
const opOf = (card, name) => (card.ops || []).find((o) => o[0] === name) || null;

test('DDD-6: a BAKED unit card shows frame 0 of the atlas IN THE REPO', async () => {
  // MUTATION: restore `supplied[u.id].atlases.body` as the only source -> the descriptor carries no
  // inline atlas, so the card falls through to the placeholder and thumb reads 'empty'. That is the bug.
  // MUTATION: drawImage(im, 0, 0, W, H) instead of the cell rect -> the source rect is the whole sheet
  // and the card shows a 4x4 contact sheet of tiny units. Caught by the source-rect assertion.
  const net = contentFetch({ 'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks']) });
  const t = boot({ fetch: net.fetch, idb: true, images: (s) => s === '../../content/units/voxel/GND-Tanks.body.png' });
  await settle();
  t.run(`shippedUnits = ${JSON.stringify({ 'GND-Tanks': packOf('GND-Tanks') })};`);
  const cards = captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();

  const c = cards()[0];
  assert.equal(c.id, 'GND-Tanks');
  assert.equal(c.thumb, 'baked', 'the atlas is in the repo, so the card is baked — not a grey placeholder');
  assert.match(c.badge, /baked/);
  assert.equal(c.badgeCls, 'badge ok', 'the badge is DERIVED from what the picture resolved');
  assert.ok(opOf(c, 'drawImage'), 'the card canvas must actually receive an image');

  const cell = t.json(`thumbCache.get('unit:GND-Tanks').cv.__ops.find(o => o[0] === 'drawImage')`);
  assert.deepEqual(cell.slice(1, 5), [0, 0, 216, 266],
    'ONE FRAME: the source rect must be the pack cell at (0,0), not the whole atlas grid');
});

test('DDD-6: a unit with vox data shows the CARD IMAGE saved from it, and staleness is visible', async () => {
  // The owner's rule: "if a unit has vox data then bake and save an image rendered from the vox".
  // MUTATION: drop the card-image branch from thumbResolve -> the unit falls to its slices (or to
  // 'empty' when it has none) and a carved unit still cannot be told apart at a glance.
  const net = contentFetch({});
  const t = boot({ fetch: net.fetch, images: (s) => s === '../../content/units/card/GND-Wip.png',
    idb: { 'proj:GND-Wip': wipProject('GND-Wip') } });
  await settle();
  const cards = captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();

  const c = cards().find((x) => x.id === 'GND-Wip');
  assert.ok(c, 'a unit with only a WIP still gets a card');
  assert.equal(c.thumb, 'model stale', 'shown from the saved card image — and marked, because no cardSig says it depicts THIS model');
  assert.match(c.badge, /stale/, 'a card image that may be out of date must say so, not pass for current');
  assert.ok(opOf(c, 'drawImage'), 'the card canvas gets the image');

  // stamp the signature the image was written with -> the same card is now fresh, and says nothing extra
  t.run(`(async () => {
    const p = await idb.get('proj:GND-Wip');
    const m = loadManifest(); m.units = m.units || {};
    m.units['GND-Wip'] = { cardSig: modelSigOf(p) };
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
    thumbInvalidate('GND-Wip');
  })()`);
  await settle();
  t.run(`renderRoster()`); await settle();
  const fresh = cards().find((x) => x.id === 'GND-Wip');
  assert.equal(fresh.thumb, 'model', 'a card image that depicts the saved model is fresh');
  assert.doesNotMatch(fresh.badge, /stale/);
});

test('DDD-6: a CARVED-but-never-baked unit with no card image falls back to its slices', async () => {
  // The bigger half of the owner's problem: a unit being worked on has no atlas anywhere — not in the
  // repo, not in a database — so without this it can never have a thumbnail at all.
  // MUTATION: drop the slice branch -> thumb reads 'empty' and a unit with art loaded looks unauthored.
  const net = contentFetch({});
  const t = boot({ fetch: net.fetch, images: (s) => s.startsWith('data:'),   // the slice decodes; the repo has nothing
    idb: { 'proj:GND-Slices': wipProject('GND-Slices', { vol: null, images: { top: 'data:image/png;base64,TOP' } }) } });
  await settle();
  const cards = captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();

  const c = cards().find((x) => x.id === 'GND-Slices');
  assert.equal(c.thumb, 'source');
  assert.match(c.badge, /slices/);
  assert.equal(c.badgeCls, 'badge wip');
  assert.ok(opOf(c, 'drawImage'), 'the card canvas gets the keyed slice');
});

test('DDD-6: the BASE TOP slice wins, and the fallback order is fixed', async () => {
  // "Can be the top down slice image... If base top does not have a slice use any other existing slice."
  // MUTATION: iterate views before parts, or start at 'side' -> the wrong slice is chosen and this fails.
  const t = boot({ fetch: contentFetch({}).fetch, idb: true });
  await settle();
  const pick = (imgs, turret) => t.json(`thumbSliceOf(${JSON.stringify({
    images: { body: Object.assign({ top: null, side: null, front: null, back: null }, imgs),
              turret: Object.assign({ top: null, side: null, front: null, back: null }, turret || {}) } })})`);
  assert.equal(pick({ top: 'T', side: 'S', front: 'F' }).view, 'top', 'body top is the first choice');
  assert.deepEqual([pick({ side: 'S', front: 'F' }).part, pick({ side: 'S', front: 'F' }).view], ['body', 'side']);
  assert.deepEqual([pick({ back: 'B' }).part, pick({ back: 'B' }).view], ['body', 'back']);
  assert.deepEqual([pick({}, { side: 'TS' }).part, pick({}, { side: 'TS' }).view], ['turret', 'side']);
  // THE ORDER IS PARTS-OUTER, VIEWS-INNER. Iterating views outer instead passes every assertion above
  // and still picks the wrong slice here: the BODY's last view must beat the turret's first, because
  // "any other existing slice" means any other slice OF THE UNIT before any slice of its turret.
  assert.deepEqual([pick({ back: 'B' }, { top: 'TT' }).part, pick({ back: 'B' }, { top: 'TT' }).view], ['body', 'back'],
    'the turret is searched only after EVERY body view, not view by view');
  assert.equal(t.run(`thumbSliceOf({ images: { body: {}, turret: {} } })`), null, 'no slice anywhere is null, not a guess');
});

test('DDD-6: an atlas the repo does not have must NOT look like "never baked"', async () => {
  // im.onerror was unhandled, so a missing or corrupt atlas silently left the placeholder while the
  // badge went on reading "supplied" — the picture and the badge saying different things forever.
  // MUTATION: return { state: 'empty' } instead of 'missing' -> a broken unit is indistinguishable from
  // an unauthored slot, which is the state this ticket exists to separate.
  const net = contentFetch({ 'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks', 'GND-Ghost']) });
  const t = boot({ fetch: net.fetch, idb: true, images: () => false });      // nothing loads
  await settle();
  t.run(`shippedUnits = ${JSON.stringify({ 'GND-Tanks': packOf('GND-Tanks') })};`);
  const cards = captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();

  const broken = cards().find((x) => x.id === 'GND-Tanks'), blank = cards().find((x) => x.id === 'GND-Ghost');
  assert.equal(broken.thumb, 'missing', 'named in the manifest, not in the repo');
  assert.equal(broken.badgeCls, 'badge err');
  assert.equal(blank.thumb, 'empty', 'nothing was ever authored here');
  assert.notEqual(broken.thumb, blank.thumb, 'the two must not be the same card');
  assert.notEqual(broken.badge, blank.badge, 'nor say the same thing');
});

test('DDD-6: a unit whose atlas is not in the repo still SHOWS the unit', async () => {
  // This is the ordinary state of a unit baked in this browser and not yet shipped — the atlas is real,
  // it is just not in the repository. Being unable to see it is the whole problem being fixed, so the
  // card shows the unit from its slices AND keeps saying the art is not in the repo.
  // MUTATION: `return { state: 'missing', cv: null }` without the fallback -> the picture is a red box
  // and a unit the artist can see everywhere else is invisible on its own card.
  // System, not FACTIONS[0]: boot renders the first faction's roster before the test can install
  // shippedUnits, and a card resolved then is cached — so the manifest entry would arrive too late.
  const net = contentFetch({ 'system.units.json': unitsDoc('System', ['SYS-Cannon']) });
  const t = boot({ fetch: net.fetch, images: (s) => s.startsWith('data:'),   // the slice decodes, the repo atlas 404s
    idb: { 'proj:SYS-Cannon': wipProject('SYS-Cannon', { images: { top: 'data:image/png;base64,TOP' } }) } });
  await settle();
  t.run(`shippedUnits = ${JSON.stringify({ 'SYS-Cannon': packOf('SYS-Cannon') })};`);
  const cards = captureCards(t);
  t.run(`loadFaction('System')`); await settle();

  const c = cards()[0];
  assert.equal(c.thumb, 'missing', 'the state still says the art is not in the repo');
  assert.equal(c.badgeCls, 'badge err');
  assert.ok(opOf(c, 'drawImage'), 'and the card still shows the unit');
  assert.ok(opOf(c, 'strokeRect'), 'behind a warning frame, so it cannot read as a healthy card');
});

test('DDD-6: renderRoster is called constantly and must not re-read the store', async () => {
  // renderRoster runs on nearly every state change. A per-render IndexedDB read per card would put a
  // multi-megabyte structured clone on the path of every click.
  // MUTATION: drop the thumbCache lookup (always thumbWant) -> reads climb with every render.
  const net = contentFetch({ 'ground-powder.units.json': unitsDoc('Ground / Powder', ['GND-Tanks']) });
  const t = boot({ fetch: net.fetch, images: (s) => s.startsWith('data:'),
    idb: { 'proj:GND-Tanks': wipProject('GND-Tanks', { images: { top: 'data:,T' } }) } });
  await settle();
  const cards = captureCards(t);
  t.run(`loadFaction('Ground / Powder')`); await settle();
  assert.equal(cards()[0].thumb, 'source');

  // SETTLE BETWEEN RENDERS. In a tight loop only one resolve can ever be in flight (thumbBusy blocks
  // the rest), so a cacheless build would still read once and the count would look fine. Each render
  // has to be a genuinely independent opportunity to go back to the store.
  const after = t.idb.gets();
  for (let i = 0; i < 8; i++) { t.run(`renderRoster()`); await settle(); }
  assert.equal(t.idb.gets(), after, 'eight more renders, ZERO more reads — the thumbnail is cached per id');
  assert.equal(cards()[0].thumb, 'source', 'and the card still shows its picture');

  // …and a card that IS out of date, rendered twice before the refresh lands, is read ONCE. renderRoster
  // really does run twice in a tick — doAutosave calls it and so does the click handler that armed the
  // autosave. MUTATION: drop the thumbBusy guard -> two reads for one card.
  t.run(`thumbInvalidate('GND-Tanks'); renderRoster(); renderRoster();`);
  await settle();
  assert.equal(t.idb.gets(), after + 1, 'a dirtied card rendered twice in one tick resolves ONCE');
});

test('DDD-6: an unauthored slot is decided WITHOUT touching the store', async () => {
  // A designed roster is mostly empty slots. Queueing a project read for each one would make opening a
  // faction cost a store round-trip per card for cards that can never have a picture.
  // MUTATION: drop the `!has && !wipIds.has(id)` short-circuit -> every empty slot queues a read.
  // The served faction is deliberately NOT the one boot opens (FACTIONS[0]) — boot renders that roster
  // before the test can take a baseline, so a count taken afterwards would already include its reads
  // and the mutation would hide inside them.
  const net = contentFetch({ 'system.units.json': unitsDoc('System', ['SYS-A', 'SYS-B', 'SYS-C']) });
  const t = boot({ fetch: net.fetch, idb: true, images: () => false });
  await settle();
  assert.equal(t.idb.gets(), 0, 'test setup: the faction boot opened has no units, so nothing has been read');
  const cards = captureCards(t);
  t.run(`loadFaction('System')`); await settle();
  assert.deepEqual(cards().map((c) => c.thumb), ['empty', 'empty', 'empty']);
  assert.equal(t.idb.gets(), 0, 'three empty slots, ZERO reads — an empty slot is decided from wipIds alone');
});

test('DDD-6: the card image is written to the REPO, under card/ and never under voxel/', async () => {
  // Art belongs in the repository, not in a database. content/units/card/<id>.png is a CARD artifact:
  // it must not land in content/units/voxel/ where the game and pack.test.mjs would meet it.
  // MUTATION: point CARD_SHIP_DIR at content/units/voxel/ -> the path assertion fails.
  const net = contentFetch({}, { ship: true });
  const t = boot({ fetch: net.fetch, idb: true });
  await settle();
  captureCards(t);   // its canvases report pixels — the sandbox cannot rasterise, and cropToCard reads them back
  t.run(`state.foot = 16; state.bodyLayers = 8; volDirty.body = true; recarve();`);
  assert.ok(t.run('!!bodyFaces'), 'test setup: there is a model in the editor');

  t.run(`(async () => { window.__r = await saveCardImage('GND-Tanks', null); })();`);
  await settle();
  const res = t.json('window.__r');
  assert.equal(res.ok, true, 'with a dev server the image is written');
  assert.equal(res.path, 'content/units/card/GND-Tanks.png');
  assert.deepEqual(net.shipped.map((s) => s.path), ['content/units/card/GND-Tanks.png']);
  assert.ok(net.shipped[0].png, 'it is written as a PNG, not as JSON');
  assert.ok(t.run(`(loadManifest().units || {})['GND-Tanks'].cardSig`), 'and it stamps WHAT it depicts');
});

test('DDD-6: with no dev server the card image is NOT claimed to be saved', async () => {
  // /__ship is the only write path and the deployed site has no POST endpoint. Reporting a write that
  // did not happen is how content goes missing quietly.
  // MUTATION: swallow the shipFile rejection and return { ok: true } -> this fails.
  const net = contentFetch({});                                  // no ship endpoint
  const t = boot({ fetch: net.fetch, idb: true });
  await settle();
  captureCards(t);
  t.run(`state.foot = 16; state.bodyLayers = 8; volDirty.body = true; recarve();
         (async () => { window.__r = await saveCardImage('GND-Tanks', null); })();`);
  await settle();
  const res = t.json('window.__r');
  assert.equal(res.ok, false);
  assert.equal(res.kind, 'NOT WRITTEN');
  assert.match(t.run(`cardImageNote(window.__r)`), /NOT written/i, 'and the save event says so');
  assert.equal(t.run(`((loadManifest().units || {})['GND-Tanks'] || {}).cardSig || ''`), '',
    'nothing was written, so nothing may be stamped as depicting it');
});

test('DDD-6: "Save all" on genuinely empty work WARNS instead of saving nothing', async () => {
  // "If no slice image exists warn the user there is nothing to save during a save event." Save geometry
  // already refused (doAutosave reports EMPTY); Save all went straight to doBake, baked an empty volume
  // and reported a successful save of nothing.
  // MUTATION: remove the svContentGate call from svAll -> quickSave runs and the manifest gains an entry.
  const t = boot({ fetch: contentFetch({}).fetch, idb: true });
  await settle();
  t.run(`carveCache.body = null; carveCache.turret = null; volDirty.body = false; volDirty.turret = false;`);
  const before = t.json('Object.keys(loadManifest().units || {})');
  t.run(`openSaveModal('GND-Empty'); document.getElementById('svId').value = 'GND-Empty';
         document.getElementById('svAll').onclick();`);
  await settle();
  assert.match(t.run(`document.getElementById('saveState').innerHTML`), /NOTHING TO SAVE/);
  assert.deepEqual(t.json('Object.keys(loadManifest().units || {})'), before, 'and nothing was written');
});

test('DDD-6: the "nothing to save" warning must not fire on vox, carved geometry or paint', async () => {
  // A unit can legitimately have NO slices and still be real work. The gate is projectHasContent —
  // the same test the autosave uses, not a second copy of the rule beside it.
  // MUTATION: gate on `p.images` alone -> a hand-carved or imported unit is refused, which is worse
  // than the bug being fixed.
  const t = boot({ fetch: contentFetch({}).fetch, idb: true });
  await settle();
  const gate = () => t.json(`(() => { const g = svContentGate('GND-Tanks'); return { ok: g.ok }; })()`);

  t.run(`volDirty.body = false; volDirty.turret = false; carveCache.body.m.PAINT.fill(0);`);
  assert.equal(gate().ok, false, 'a bare carve from art that is not loaded has nothing to write');

  t.run(`volDirty.body = true;`);                                 // hand-carved geometry
  assert.equal(gate().ok, true, 'hand-carved geometry is content, with or without slices');

  t.run(`volDirty.body = false; carveCache.body.m.PAINT[0] = 1;`);   // paint only
  assert.equal(gate().ok, true, 'paint is content');

  t.run(`carveCache.body.m.PAINT.fill(0); voxPart.body = { nx: 2, ny: 2, nz: 2, data: new Uint8Array(32) }; voxB64.body = 'x';`);
  assert.equal(gate().ok, true, 'an imported .vox is content');
});

test('DDD-6: a shipped decor prop is not labelled WIP over its own baked art', async () => {
  // The decor roster unioned the SHIPPED ids in but read `supplied` from localStorage alone, so a prop
  // that is baked, shipped and in the repo showed "WIP" over its atlas — the badge and the picture
  // disagreeing, one store over from the bug this ticket names.
  // MUTATION: `supplied = loadDecorManifest().decor || {}` -> the prop reads WIP and this fails.
  const net = contentFetch({ 'voxel-decor.json': { decor: { 'pine-tree-1': { pack: { id: 'pine-tree-1',
    parts: [{ id: 'decor', atlas: 'pine-tree-1.decor.png', cell: [244, 394], cols: 1 }] },
    atlases: { decor: 'data:image/png;base64,PINE' } } } } });
  const t = boot({ fetch: net.fetch, idb: true, images: (s) => s.startsWith('data:') });
  await settle();
  const cards = captureCards(t);
  t.run(`loadFaction(DECOR_SET)`); await settle();

  const c = cards().find((x) => x.id === 'pine-tree-1');
  assert.ok(c, 'the shipped prop has a card');
  assert.equal(c.thumb, 'baked', 'its atlas ships inline in content/decor/voxel-decor.json — that is the repo');
  assert.equal(c.badgeCls, 'badge ok');
  const cell = t.json(`thumbCache.get('decor:pine-tree-1').cv.__ops.find(o => o[0] === 'drawImage')`);
  assert.deepEqual(cell.slice(1, 5), [0, 0, 244, 394], 'one frame of the decor atlas');
});
