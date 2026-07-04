/*
 * prototype-kits/canvas-game/runtime.js  (PS-3.1)
 *
 * The canvas-game RUNTIME KERNEL — written once, tested, never LLM-generated. It owns every piece
 * that the single-shot builds kept getting wrong: the asset loader (onload/onerror/timeout), input
 * (keys + edge-latch + mouse), the button system WITH click dispatch, the scene/state machine, the
 * crash-proof render loop, and draw helpers. Screens + mechanics are config-driven modules that use
 * this API; because the engine lives here, the model never writes engine code — so a second engine
 * is impossible. CSP-safe: no eval / new Function / string-argument timers.
 *
 * Modules attach to a global namespace so the scaffold can concatenate or <script>-include them with
 * no bundler:  window.MMKit = { runtime, screens, mechanics }.
 */
(function () {
  'use strict';
  var K = (typeof window !== 'undefined' ? window : globalThis);
  K.MMKit = K.MMKit || {};

  var CW = 960, CH = 600;
  var canvas = null, ctx = null;
  var images = {};
  var keys = {}, keyLatch = {};
  var mouse = { x: 0, y: 0, down: false, clicked: false };
  var buttons = [];
  var particles = [];
  var scenes = {};            // name -> render fn
  var updaters = [];          // per-frame update hooks (each guards by scene if it cares)
  var state = null, stateTime = 0, lastT = 0, started = false;
  var frameN = 0;             // monotonic frame index (replay timestamps)

  /* ---- seeded RNG (determinism contract, GDD-class §18) ----
     mulberry32: tiny, fast, seed-stable across platforms. ALL game randomness goes through
     R.rand() — never Math.random() — so a fixed config.seed reproduces a run exactly. */
  var _rngState = 123456789 >>> 0;
  function srand(seed) { _rngState = (seed >>> 0) || 1; }
  function rand() {
    _rngState = (_rngState + 0x6D2B79F5) >>> 0;
    var t = _rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---- replay log: every player input, stamped with the frame index. Bounded so a long
     session can't grow unbounded; exportReplay() = {seed, events} — re-driving the sim with
     the same seed + events must reproduce the battle (replay IS the determinism test). ---- */
  var EVENTS_MAX = 20000;
  var events = [];
  var _seedUsed = 123456789;
  function logEvent(type, data) {
    if (events.length >= EVENTS_MAX) events.shift();
    var e = { f: frameN, t: type };
    if (data) for (var k in data) e[k] = data[k];
    events.push(e);
  }
  function exportReplay() { return { seed: _seedUsed, events: events.slice() }; }

  function init(canvasId, opts) {
    opts = opts || {};
    CW = opts.W || 960; CH = opts.H || 600;
    canvas = (typeof document !== 'undefined') ? document.getElementById(canvasId || 'c') : null;
    if (!canvas) return false;
    canvas.width = CW; canvas.height = CH;
    ctx = canvas.getContext('2d');
    function resize() {
      // CRISP AT NATIVE RESOLUTION (mmdev-e29): the backing buffer matches the DISPLAYED size x
      // devicePixelRatio, while every screen keeps drawing in logical CW x CH coordinates via the
      // transform. The old code stretched a fixed 960x600 buffer over the window (no dpr), so the
      // whole game upscale-blurred on any larger/HiDPI display — "screens crisp, game fuzzy".
      var r = Math.min(window.innerWidth / CW, window.innerHeight / CH);
      var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      canvas.style.width = (CW * r) + 'px'; canvas.style.height = (CH * r) + 'px';
      canvas.width = Math.max(1, Math.round(CW * r * dpr));
      canvas.height = Math.max(1, Math.round(CH * r * dpr));
      if (ctx.setTransform) ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
    }
    window.addEventListener('resize', resize); resize();
    window.addEventListener('keydown', function (e) {
      if (!keys[e.key]) logEvent('kd', { k: e.key });
      keys[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.key] = false; logEvent('ku', { k: e.key }); });
    function pos(e) {
      var b = canvas.getBoundingClientRect();
      return { x: (e.clientX - b.left) * (CW / b.width), y: (e.clientY - b.top) * (CH / b.height) };
    }
    canvas.addEventListener('mousemove', function (e) { var p = pos(e); mouse.x = p.x; mouse.y = p.y; });
    canvas.addEventListener('mousedown', function (e) { var p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; logEvent('md', { x: Math.round(p.x), y: Math.round(p.y) }); });
    canvas.addEventListener('mouseup', function () { mouse.down = false; mouse.clicked = true; logEvent('mu', { x: Math.round(mouse.x), y: Math.round(mouse.y) }); });
    return true;
  }

  /* ---- assets ---- */
  function loadAssets(map, done) {
    var entries = []; for (var k in map) if (map[k]) entries.push([k, map[k]]);
    var n = entries.length, finished = false;
    if (!n) { done(); return; }
    function tick() { if (--n <= 0 && !finished) { finished = true; done(); } }
    entries.forEach(function (e) {
      var im = new Image();
      im.onload = function () { images[e[0]] = im; tick(); };
      im.onerror = function () { images[e[0]] = null; tick(); };
      im.src = e[1];
    });
    setTimeout(function () { if (!finished) { finished = true; done(); } }, 8000);
  }
  function img(key) { return images[key] || null; }

  /* ---- draw helpers ---- */
  function drawBg(key, fallback) {
    // screens are stored under 'scr_<key>' (see start); accept the bare key too so a screen's
    // cfg.asset='PLAY' resolves to the loaded 'scr_PLAY' image instead of falling back to a colour.
    var im = images[key] || images['scr_' + key];
    if (im && im.width) {
      var ir = im.width / im.height, cr = CW / CH, dw, dh, dx, dy;
      if (ir > cr) { dh = CH; dw = CH * ir; dx = (CW - dw) / 2; dy = 0; }
      else { dw = CW; dh = CW / ir; dx = 0; dy = (CH - dh) / 2; }
      ctx.drawImage(im, dx, dy, dw, dh);
      return true;                       // drew the real backdrop
    } else { ctx.fillStyle = fallback || '#13314e'; ctx.fillRect(0, 0, CW, CH); return false; }  // fell back to a colour
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function text(t, x, y, font, color, align) {
    ctx.fillStyle = color || '#fff'; ctx.font = font || '20px Trebuchet MS';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  }
  function drawSpr(key, x, y, w, h) {
    var im = images[key];
    if (im && im.width) { var s = Math.min(w / im.width, h / im.height); ctx.drawImage(im, x - im.width * s / 2, y - im.height * s / 2, im.width * s, im.height * s); return true; }
    return false;
  }

  /* ---- region map (inside vs outside a play region): sample a mask, or the backdrop art itself, so
     gameplay can keep the player + markers inside the intended region. GENERIC — no genre assumed.
     useRegion(key, asMask) builds the sample buffer (cover-mapped like drawBg); isInRegion(x,y) classifies
     a canvas point. No region set → everything is inside (safe default). ---- */
  var regionBuf = null, regionW = 0, regionH = 0, regionMask = false, regionKey = null;
  function useRegion(key, asMask) {
    if (key === regionKey && regionBuf) return true;          // cached
    var im = images[key] || images['scr_' + key];
    if (!im || !im.width) { regionBuf = null; regionKey = null; return false; }
    try {
      var oc = document.createElement('canvas'); oc.width = im.width; oc.height = im.height;
      var octx = oc.getContext('2d'); octx.drawImage(im, 0, 0);
      regionBuf = octx.getImageData(0, 0, im.width, im.height).data;
      regionW = im.width; regionH = im.height; regionMask = !!asMask; regionKey = key; return true;
    } catch (e) { regionBuf = null; regionKey = null; return false; }
  }
  function isInRegion(x, y) {
    if (!regionBuf) return true;
    var ir = regionW / regionH, cr = CW / CH, dw, dh, dx, dy;
    if (ir > cr) { dh = CH; dw = CH * ir; dx = (CW - dw) / 2; dy = 0; }
    else { dw = CW; dh = CW / ir; dx = 0; dy = (CH - dh) / 2; }
    var px = (x - dx) / dw * regionW | 0, py = (y - dy) / dh * regionH | 0;
    if (px < 0 || py < 0 || px >= regionW || py >= regionH) return false;   // off-image = land
    var i = (py * regionW + px) * 4, r = regionBuf[i], g = regionBuf[i + 1], b = regionBuf[i + 2], a = regionBuf[i + 3];
    if (regionMask) return a > 40 && ((b - r) > 16 || (g - r) > 16);        // mask: cool-colour mark = inside the region, white = outside
    return (b - r) > 8;                                                      // heuristic: cool/bluish region = inside
  }

  /* ---- buttons (with click dispatch) ---- */
  function clearBtns() { buttons = []; }
  function addBtn(x, y, w, h, label, cb, opts) { buttons.push({ x: x, y: y, w: w, h: h, label: label, cb: cb, opts: opts || {} }); }
  function drawBtns() {
    var i, b;
    for (i = 0; i < buttons.length; i++) {
      b = buttons[i];
      var hov = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
      ctx.fillStyle = hov ? '#2a9fe0' : (b.opts.color || b.opts.bg || '#1d6fa5'); roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
      text(b.label, b.x + b.w / 2, b.y + b.h / 2, b.opts.font || 'bold 20px Trebuchet MS', b.opts.fg || '#fff');
    }
    if (mouse.clicked) {
      for (i = 0; i < buttons.length; i++) {
        b = buttons[i];
        if (mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) {
          mouse.clicked = false; if (typeof b.cb === 'function') b.cb(); break;
        }
      }
    }
  }

  /* ---- particles ---- */
  function spawn(x, y, opts) {
    opts = opts || {};
    particles.push({ x: x, y: y, vx: (rand() - 0.5) * (opts.spread || 2), vy: (rand() - 0.5) * (opts.spread || 2) - (opts.up || 0), life: 1, r: opts.r || 3, col: opts.col || '244,249,248' });
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.5; p.r += dt * 6;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i]; ctx.fillStyle = 'rgba(' + p.col + ',' + (0.5 * Math.max(0, p.life)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---- scene machine + loop ---- */
  function scene(name, renderFn) { scenes[name] = renderFn; }
  function go(name) { state = name; stateTime = 0; mouse.clicked = false; }
  function current() { return state; }
  function onUpdate(fn) { if (typeof fn === 'function') updaters.push(fn); }

  function loop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000) || 0; lastT = t; stateTime += dt;
    try {
      for (var u = 0; u < updaters.length; u++) updaters[u](dt);
      updateParticles(dt);
      var fn = scenes[state];
      if (fn) fn(); else { ctx.fillStyle = '#0e2233'; ctx.fillRect(0, 0, CW, CH); }
    } catch (err) {
      ctx.fillStyle = '#0e2233'; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#ff6b6b'; ctx.font = '15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Runtime error: ' + ((err && err.message) || err), 20, 20);
      ctx.fillStyle = '#ffb3b3'; ctx.font = '12px monospace';
      ctx.fillText(String((err && err.stack || '').split('\n')[1] || '').trim().slice(0, 120), 20, 44);
      ctx.fillText('scene: ' + state, 20, 64);
    }
    // edge-latch maintenance: release a latch once its key is up
    for (var kk in keyLatch) if (!keys[kk]) keyLatch[kk] = false;
    mouse.clicked = false;
    frameN++;
    requestAnimationFrame(loop);
  }
  function run() { if (started) return; started = true; requestAnimationFrame(loop); }

  /* one-shot key: true exactly once per press (edge-detected via keyLatch, auto-released in loop).
     Use for discrete actions (cast, jump, confirm). For held movement read keys[k] directly. */
  function pressed(k) { if (keys[k] && !keyLatch[k]) { keyLatch[k] = true; return true; } return false; }

  /* ---- one-call boot: wire scenes + mechanics from a config, load assets, run ---- */
  function start(config) {
    config = config || {};
    // Deterministic by default: a fixed seed unless the config supplies one. Same seed +
    // same inputs = identical run (the replay/§18 contract).
    _seedUsed = (typeof config.seed === 'number' && isFinite(config.seed)) ? (config.seed >>> 0) : 123456789;
    srand(_seedUsed);
    if (!init('c', config.canvas)) return;
    var assets = {};
    var src = config.assets || {};
    var s; for (s in (src.screens || {})) assets['scr_' + s] = src.screens[s];
    for (s in (src.sprites || {})) assets['spr_' + s] = src.sprites[s];
    var shared = config.data || {};   // mutable game state shared across modules
    K.MMKit.game = shared;
    // LOUD ASSEMBLY ASSERTIONS (mmdev-e29-s11): a missing factory or a broken kit contract is a
    // BOOT FAILURE the gates can see — the old silent placeholder/skip converted four real wiring
    // bugs into a green PASS (the Bulwark incident). Never hide assembly defects.
    // mechanics first (they expose update + helpers the gameplay screen uses)
    (config.mechanics || []).forEach(function (m) {
      var factory = K.MMKit.mechanics && K.MMKit.mechanics[m];
      if (!factory) throw new Error("[canvas-kit] config.mechanics names missing mechanic '" + m + "' — assembly failure (script not loaded before start?)");
      var inst = factory(config, shared); shared['mech_' + m] = inst; if (inst && inst.update) onUpdate(inst.update);
    });
    if ((config.mechanics || []).length && !(config.states || []).some(function (s) { return s.name === 'GAMEPLAY'; })) {
      throw new Error("[canvas-kit] mechanics are configured but no state is named 'GAMEPLAY' — the kit contract requires it (mechanics gate on GAMEPLAY and will silently no-op forever)");
    }
    // screens
    (config.states || []).forEach(function (st) {
      var factory = K.MMKit.screens && K.MMKit.screens[st.screen];
      if (!factory) throw new Error("[canvas-kit] state '" + st.name + "' references missing screen factory '" + st.screen + "' — assembly failure (screen script not loaded before start?)");
      scene(st.name, factory(st, config, shared));
    });
    go(config.first || (config.states && config.states[0] && config.states[0].name) || 'TITLE');
    loadAssets(assets, function () { run(); });
  }

  K.MMKit.runtime = {
    init: init, loadAssets: loadAssets, img: img, drawBg: drawBg, drawSpr: drawSpr,
    roundRect: roundRect, text: text, clearBtns: clearBtns, addBtn: addBtn, drawBtns: drawBtns,
    spawn: spawn, updateParticles: updateParticles, drawParticles: drawParticles,
    scene: scene, go: go, current: current, onUpdate: onUpdate, run: run, start: start,
    useRegion: useRegion, isInRegion: isInRegion, isWater: isInRegion, pressed: pressed,
    srand: srand, rand: rand, logEvent: logEvent, exportReplay: exportReplay,
    get ctx() { return ctx; }, get W() { return CW; }, get H() { return CH; },
    get frame() { return frameN; }, events: events,
    keys: keys, keyLatch: keyLatch, mouse: mouse,
  };
})();
