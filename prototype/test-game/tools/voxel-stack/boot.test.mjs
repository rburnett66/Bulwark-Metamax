// BOOT GATE. Runs stack-forge.js's module scope with the DOM and PIXI stubbed, and fails if it throws.
//
// WHY THIS EXISTS. Five separate times this tool shipped dead-on-arrival while every other gate was
// green, because nothing executed module scope:
//   bEl out of scope in bakeDecor            -> ReferenceError on every decor bake
//   update() touching null baked sprites     -> killed the PIXI ticker, no 3D at all
//   carveSig reading VIEWS from its TDZ      -> tool never started
//   buildFaces reading an undefined `m`      -> tool never started, and the header vanished with it
//   an inline comment swallowing a one-liner -> unbalanced braces
// node --check proves the file PARSES. The unit suites exercise pure functions. Neither runs the boot
// path, which is exactly where load-order, scope and null-init faults live.
//
// It runs module scope AND drives one ticker frame. Module scope alone would have missed the update()
// fault entirely — that one lived inside the frame callback and only fired once the ticker ran.
//
// VERIFIED BY MUTATION, not by passing. A green gate proves nothing on its own, so each fault class was
// reintroduced into stack-forge.js and the gate confirmed to fail:
//   `const PAINT = (m && m.PAINT) || null`  -> caught (ReferenceError: m is not defined)
//   a const read before its declaration     -> caught (TDZ)
//   the null guard removed from update()    -> caught (TypeError: Cannot set properties of null)
// If you widen the stubs, re-run that check. Stubs that are too generous turn this file into decoration.
//
// The stubs are deliberately dumb: they answer shape, not behaviour. A boot that completes here can still
// be wrong on screen — this gate only claims the file RUNS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

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
  // Same reasoning as the display stub: the 2D context surface is large (arcTo, bezierCurveTo, filter,
  // globalCompositeOperation...). Unknown methods no-op rather than throw, so the gate fails on the code.
  const ctx = new Proxy(ctx2d, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const el = () => {
    const node = {
      style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' },
      dataset: {}, children: [], files: [], options: [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild() {}, removeChild() {}, insertBefore() {}, remove() {}, replaceChildren() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setAttribute() {},
      removeAttribute() {}, getAttribute: () => null, focus() {}, blur() {}, click() {},
      querySelector: () => null, querySelectorAll: () => [], closest: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      getContext: () => ctx, toDataURL: () => 'data:,', toBlob() {},
      width: 64, height: 64, clientWidth: 100, clientHeight: 100, offsetHeight: 30,
      value: '', textContent: '', innerHTML: '', innerText: '', checked: false, disabled: false, hidden: true,
      max: '128', min: '0', step: '1', selectedIndex: 0,
    };
    return new Proxy(node, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  };
  const xy = () => ({ x: 0, y: 0, set() {} });
  // PIXI display objects are fluent builders with a large surface (drawRect, arcTo, bezierCurveTo, ...).
  // Enumerating them means a new stub gap on every unfamiliar call, so unknown METHODS return `this` and
  // unknown properties read undefined. The gate then fails on the code, never on the stub.
  const display = () => {
    const base = Object.assign(el(), {
      scale: xy(), position: xy(), anchor: xy(), pivot: xy(), skew: xy(),
      texture: {}, visible: true, alpha: 1, rotation: 0, tint: 0xffffff, zIndex: 0,
      addChild(c) { return c; }, removeChild() {}, destroy() {},
    });
    const fluent = new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        if (typeof k === 'symbol') return undefined;
        return (...a) => fluent;                      // any unknown draw call chains
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    return fluent;
  };
  const sandbox = {};                       // declared early so Application can register itself on it
  const PIXI = {
    Application: class { constructor() { (sandbox.__pixiApps = sandbox.__pixiApps || []).push(this); this.view = el(); this.stage = display(); this.screen = { x: 0, y: 0, width: 800, height: 600 };
      this.renderer = { extract: { canvas: () => el() }, plugins: {}, render() {}, resize() {}, events: {},
        on() { return this; }, off() { return this; }, once() { return this; }, emit() { return this; },
        screen: { width: 800, height: 600 }, view: el() };
      // RUN FRAME ONE. The historical `update() touching null baked sprites` fault lived INSIDE the
      // ticker callback, so a stub that only registers it proves nothing — that bug killed the ticker on
      // the first frame and left the tool with no 3D at all. Registering and invoking once catches the
      // whole null-init class that boot-only execution walks straight past.
      const frame = [];
      this.ticker = {
        add(fn) { if (typeof fn === 'function') frame.push(fn); return this; },
        remove(fn) { const i = frame.indexOf(fn); if (i >= 0) frame.splice(i, 1); return this; },
        start() {}, stop() {}, on() { return this; },
        deltaTime: 1, deltaMS: 16, elapsedMS: 16, lastTime: 0, FPS: 60,
        _runFrameOne() { for (const fn of frame.slice()) fn(1); },
      }; } },
    Container: class { constructor() { return display(); } },
    Sprite: class { constructor() { return display(); } },
    Graphics: class { constructor() { return display(); } },
    Text: class { constructor() { return display(); } },
    Texture: { from: () => ({ baseTexture: { update() {}, setSize() {} }, destroy() {} }), WHITE: {}, EMPTY: {} },
    BaseTexture: { from: () => ({ update() {}, destroy() {} }) },
    RenderTexture: { create: () => ({ destroy() {}, baseTexture: { update() {} } }) },
    Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } },
    Point: class { constructor(x, y) { Object.assign(this, { x, y }); } },
    settings: {}, SCALE_MODES: { NEAREST: 0, LINEAR: 1 }, utils: { TextureCache: {} },
  };
  const doc = {
    createElement: () => el(), createElementNS: () => el(), getElementById: () => el(),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    body: el(), head: el(), documentElement: el(), hidden: false, activeElement: null,
    currentScript: { src: 'http://127.0.0.1:9000/tools/voxel-stack/stack-forge.js' },
  };
  const store = new Map();
  Object.assign(sandbox, {
    document: doc, PIXI, console: { log() {}, info() {}, warn() {}, error() {}, table() {} },
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
    alert() {}, confirm: () => false, prompt: () => null,
    navigator: { userAgent: 'node' }, performance: { now: () => 0 },
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.location = { pathname: '/tools/voxel-stack/stack-forge.html', href: 'http://127.0.0.1:9000/tools/voxel-stack/stack-forge.html' };
  sandbox.location = sandbox.window.location;
  sandbox.window.addEventListener = () => {};
  sandbox.window.innerWidth = 1600; sandbox.window.innerHeight = 900; sandbox.window.devicePixelRatio = 1;
  return sandbox;
}

test('stack-forge.js completes module scope without throwing', () => {
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  // load order must match stack-forge.html: the cores first, then the header, then the tool
  for (const f of ['../../src/data/factions.js', 'carve.js', 'select.js', 'palette.js', '../toolhead.js']) {
    vm.runInContext(readFileSync(DIR + f, 'utf8'), sandbox, { filename: f });
  }
  let err = null;
  try {
    vm.runInContext(readFileSync(DIR + 'stack-forge.js', 'utf8'), sandbox, { filename: 'stack-forge.js' });
    // module scope is only half the boot — drive one frame so ticker-registered work runs too
    for (const a of sandbox.__pixiApps || []) a.ticker._runFrameOne();
  } catch (e) { err = e; }
  assert.equal(err, null, err ? `boot threw ${err.constructor.name}: ${err.message}\n  ${(err.stack || '').split('\n')[1] || ''}` : '');
});

test('the tested cores expose what the tool delegates to', () => {
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(DIR + 'carve.js', 'utf8'), sandbox, { filename: 'carve.js' });
  vm.runInContext(readFileSync(DIR + 'select.js', 'utf8'), sandbox, { filename: 'select.js' });
  // stack-forge declares its own `function sliceMask`, which shadows carve.js's global — it delegates to
  // sliceMaskCore instead, so that alias must survive.
  assert.equal(typeof sandbox.sliceMaskCore, 'function', 'carve.js must export sliceMaskCore');
  assert.equal(typeof sandbox.carve, 'function', 'carve.js must export carve');
  assert.equal(typeof sandbox.rectToKeys, 'function', 'select.js must export rectToKeys');
  vm.runInContext(readFileSync(DIR + 'palette.js', 'utf8'), sandbox, { filename: 'palette.js' });
  assert.equal(typeof sandbox.reducePalette, 'function', 'palette.js must export reducePalette');
  assert.equal(typeof sandbox.paletteOptions, 'function', 'palette.js must export paletteOptions');
  assert.equal(typeof sandbox.applyPalette, 'function', 'palette.js must export applyPalette');
});

test('THE SHADOW IS REAL, and the *Core aliases survive it', () => {
  // palette.js does Object.assign(globalThis, api). stack-forge.js is a classic script whose top-level
  // `function medianCut` declaration hoists over globalThis and REPLACES that export — silently, with no
  // error, so any tool code calling the bare name gets the tool's population-blind version instead. This
  // asserts the hazard exists (so nobody "cleans up" the aliases believing it doesn't) AND that the
  // aliases the tool actually calls come through untouched.
  //
  // rgb2hsv IS NO LONGER SHADOWED, and that is deliberate (FFF-8): the tool's own rgb2hsv/hsv2rgb existed
  // only for the palette TUNER — the hue/sat/value re-tint that wrote palMap, a draw-time filter — and both
  // went with it. The assertion is kept as a POSITIVE one rather than deleted, because "palette.js's
  // rgb2hsv is the one in scope" is exactly the fact a future helper would silently break.
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  for (const f of ['../../src/data/factions.js', 'carve.js', 'select.js', 'palette.js', '../toolhead.js']) {
    vm.runInContext(readFileSync(DIR + f, 'utf8'), sandbox, { filename: f });
  }
  const before = { medianCut: sandbox.medianCut, rgb2hsv: sandbox.rgb2hsv };
  vm.runInContext(readFileSync(DIR + 'stack-forge.js', 'utf8'), sandbox, { filename: 'stack-forge.js' });

  assert.notEqual(sandbox.medianCut, before.medianCut,
    'stack-forge.js no longer shadows medianCut — if that is deliberate, delete this test and say why');
  assert.equal(sandbox.medianCutCore, before.medianCut, 'medianCutCore must still be palette.js\'s');
  assert.equal(sandbox.rgb2hsv, before.rgb2hsv,
    'stack-forge.js has re-declared rgb2hsv — it shadows palette.js\'s, so call rgb2hsvCore instead');
  assert.equal(sandbox.rgb2hsvCore, before.rgb2hsv, 'rgb2hsvCore must still be palette.js\'s');

  for (const k of ['extractPalette', 'reducePalette', 'spreadPalette', 'bestPalette', 'paletteRms',
    'paletteOptions', 'paletteStats', 'applyPalette', 'nearest', 'lum', 'dist2']) {
    assert.equal(typeof sandbox[k + 'Core'], 'function', `${k}Core did not survive stack-forge.js loading`);
  }
  assert.ok(Array.isArray(sandbox.PALETTE_SIZES) && sandbox.PALETTE_SIZES.length === 6,
    'PALETTE_SIZES must survive as the six offered sizes');
});
