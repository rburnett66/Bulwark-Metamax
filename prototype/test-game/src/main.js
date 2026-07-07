import {
  Assumptions,
  Factions,
  Units,
  Structures,
  Board,
  activeSlotCount,
  getUnit,
  getStructure,
} from './data/tables.js';
import { setSeed, createRng } from './sim/rng.js';
import {
  TICK_RATE,
  DT,
  createCore,
  applyCommand,
  step,
  serializeState,
  stateHash,
  runHeadless,
} from './sim/core.js';
import { createLog, createReplayDriver, runReplay, verifyDeterminism } from './sim/log.js';
import { runHarness } from './sim/harness.js';
import { createRenderer } from './render/renderer.js';
import { createHUD } from './render/hud.js';
import { createInput } from './input/input.js';

const PIXI = (typeof globalThis !== 'undefined' && globalThis.PIXI) ? globalThis.PIXI : null;

const TABLES = {
  Assumptions,
  Factions,
  Units,
  Structures,
  Board,
  activeSlotCount,
  getUnit,
  getStructure,
};

const SIM_RATE = (typeof TICK_RATE === 'number' && TICK_RATE > 0) ? TICK_RATE : 20;
const TICK_SECONDS = (typeof DT === 'number' && DT > 0 && DT < 1) ? DT : (1 / SIM_RATE);
const TICK_MS = TICK_SECONDS * 1000;
const MAX_FRAME_MS = 250;
const DEFAULT_SEED = 0xB0157A2D >>> 0;

function getSeedFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('seed');
    if (s !== null && s !== '') {
      const n = parseInt(s, 10);
      if (!Number.isNaN(n)) return n >>> 0;
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_SEED;
}

// Call the first method on obj matching one of `names`, preserving `this`.
function tryCall(obj, names, ...args) {
  if (!obj) return undefined;
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (typeof obj[n] === 'function') {
      try {
        return obj[n](...args);
      } catch (e) {
        console.warn('[bulwark] call ' + n + ' failed:', e);
        return undefined;
      }
    }
  }
  return undefined;
}

// Try a factory function with several argument shapes; return first non-throwing result.
function tryFactory(factory, variants, label) {
  if (typeof factory !== 'function') return null;
  let lastErr = null;
  for (let i = 0; i < variants.length; i++) {
    try {
      const r = factory(...variants[i]);
      if (r !== undefined && r !== null) return r;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) console.warn('[bulwark] factory ' + label + ' fallback exhausted:', lastErr);
  return null;
}

function coreTick(core, fallback) {
  if (!core) return fallback;
  if (typeof core.tick === 'number') return core.tick;
  if (core.state && typeof core.state.tick === 'number') return core.state.tick;
  return fallback;
}

function safeHash(core) {
  try {
    if (typeof stateHash === 'function') return stateHash(core);
  } catch (e) { /* ignore */ }
  try {
    if (core && typeof core.stateHash === 'function') return core.stateHash();
  } catch (e) { /* ignore */ }
  try {
    if (typeof serializeState === 'function') {
      const s = serializeState(core);
      const str = typeof s === 'string' ? s : JSON.stringify(s);
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h;
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function createPixiApp() {
  if (!PIXI) {
    throw new Error('PIXI global not found — pixi.js must be bundled with the build.');
  }
  const opts = {
    width: 960,
    height: 640,
    backgroundColor: 0x10141c,
    background: 0x10141c,
    antialias: true,
    autoDensity: true,
    resolution: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
  };
  let app;
  try {
    app = new PIXI.Application(opts); // pixi v6/v7 style
  } catch (e) {
    app = new PIXI.Application();
  }
  const canvasNow = app.view || app.canvas;
  if (!canvasNow && typeof app.init === 'function') {
    await app.init(opts); // pixi v8 style
  }
  return app;
}

class Game {
  constructor(app, seed) {
    this.app = app;
    this.seed = seed >>> 0;
    this.mode = 'play'; // 'play' | 'replay'
    this.running = true;
    this.pendingCommands = [];
    this.commandHistory = [];
    this.replayQueue = [];
    this.replayDriver = null;
    this.liveHash = null;
    this.liveTick = 0;
    this.finalHash = null;
    this.tickCount = 0;
    this.gameOver = false;
    this.accumulator = 0;
    this.lastTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    try { setSeed(this.seed); } catch (e) { /* ignore */ }
    this.rng = tryFactory(createRng, [[this.seed]], 'createRng');

    this.core = this.buildCore(this.seed);
    this.log = this.buildLog(this.seed);

    const canvas = app.view || app.canvas;
    const mount = document.getElementById('game') || document.getElementById('app') || document.body;
    if (canvas && canvas.parentNode !== mount) mount.appendChild(canvas);

    const issue = (cmd) => this.issueCommand(cmd);

    this.renderer = tryFactory(createRenderer, [
      [{ app, stage: app.stage, core: this.core, tables: TABLES, view: canvas }],
      [app, this.core, TABLES],
      [app, this.core],
      [app],
    ], 'createRenderer');

    this.hud = tryFactory(createHUD, [
      [{
        core: this.core,
        tables: TABLES,
        app,
        renderer: this.renderer,
        onCommand: issue,
        issueCommand: issue,
        sendCommand: issue,
        dispatch: issue,
        onStartWave: () => issue({ type: 'startWave' }),
        onReplay: () => this.startReplay(),
        onHarness: () => this.runHarnessReport(),
        onNewGame: (s) => this.restart(s),
      }],
      [this.core, issue],
      [this.core],
      [],
    ], 'createHUD');

    this.input = tryFactory(createInput, [
      [{
        app,
        view: canvas,
        canvas,
        core: this.core,
        renderer: this.renderer,
        hud: this.hud,
        tables: TABLES,
        onCommand: issue,
        issueCommand: issue,
        sendCommand: issue,
        dispatch: issue,
      }],
      [canvas, this.core, issue],
      [this.core, issue],
      [],
    ], 'createInput');

    // Wire cross-references defensively.
    tryCall(this.renderer, ['setHUD', 'attachHUD'], this.hud);
    tryCall(this.renderer, ['setInput', 'attachInput'], this.input);
    tryCall(this.hud, ['setRenderer'], this.renderer);
    tryCall(this.input, ['attach', 'enable', 'start'], canvas);

    // Keyboard fallback: F2 replays, F4 runs the balance harness report.
    this._onKey = (ev) => {
      if (ev.key === 'F2') { ev.preventDefault(); this.startReplay(); }
      else if (ev.key === 'F4') { ev.preventDefault(); this.runHarnessReport(); }
    };
    window.addEventListener('keydown', this._onKey);

    this._boundFrame = (t) => this.frame(t);
    requestAnimationFrame(this._boundFrame);
  }

  buildCore(seed) {
    const core = tryFactory(createCore, [
      [{ seed, tables: TABLES, tickRate: SIM_RATE }],
      [{ seed }],
      [seed],
      [],
    ], 'createCore');
    if (!core) throw new Error('createCore failed to produce a sim core');
    return core;
  }

  buildLog(seed) {
    return tryFactory(createLog, [
      [{ seed, core: this.core }],
      [{ seed }],
      [seed],
      [],
    ], 'createLog');
  }

  rebindCore(core) {
    this.core = core;
    if (this.renderer) {
      if (tryCall(this.renderer, ['setCore', 'attachCore', 'bindCore', 'rebind'], core) === undefined) {
        try { this.renderer.core = core; } catch (e) { /* ignore */ }
      }
    }
    if (this.hud) {
      if (tryCall(this.hud, ['setCore', 'attachCore', 'bindCore'], core) === undefined) {
        try { this.hud.core = core; } catch (e) { /* ignore */ }
      }
    }
    if (this.input) {
      if (tryCall(this.input, ['setCore', 'attachCore', 'bindCore'], core) === undefined) {
        try { this.input.core = core; } catch (e) { /* ignore */ }
      }
    }
  }

  issueCommand(cmd) {
    if (!cmd || !this.running) return;
    if (this.mode === 'replay') return; // no live input during replay playback
    if (this.gameOver && cmd.type !== 'newGame' && cmd.type !== 'restart') return;
    const stamped = Object.assign({}, cmd, { tick: coreTick(this.core, this.tickCount) });
    this.commandHistory.push(stamped);
    tryCall(this.log, ['recordInput', 'recordCommand', 'record', 'addInput', 'push'], stamped);
    this.pendingCommands.push(stamped);
  }

  applyOne(cmd) {
    try {
      if (this.core && typeof this.core.applyCommand === 'function') {
        this.core.applyCommand(cmd);
      } else if (typeof applyCommand === 'function') {
        applyCommand(this.core, cmd);
      }
    } catch (e) {
      console.warn('[bulwark] applyCommand failed:', e);
    }
  }

  stepOnce(commands) {
    for (let i = 0; i < commands.length; i++) this.applyOne(commands[i]);
    let events;
    try {
      if (this.core && typeof this.core.step === 'function') {
        events = this.core.step(TICK_SECONDS);
      } else if (typeof step === 'function') {
        events = step(this.core, TICK_SECONDS);
      }
    } catch (e) {
      console.error('[bulwark] sim step failed:', e);
      this.running = false;
      return;
    }
    this.tickCount += 1;
    if (!Array.isArray(events)) {
      if (this.core && Array.isArray(this.core.events)) {
        events = this.core.events.splice(0, this.core.events.length);
      } else {
        events = [];
      }
    }
    this.consumeEvents(events);
  }

  consumeEvents(events) {
    if (!events) return;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;
      if (this.mode === 'play') {
        tryCall(this.log, ['recordEvent', 'addEvent'], coreTick(this.core, this.tickCount), ev);
      }
      tryCall(this.renderer, ['onEvent', 'handleEvent'], ev);
      tryCall(this.hud, ['onEvent', 'handleEvent'], ev);
      const t = ev.type || ev.kind;
      if (t === 'win' || t === 'victory' || t === 'gameWon') this.endGame(true);
      else if (t === 'lose' || t === 'defeat' || t === 'gameOver' || t === 'baseDestroyed') this.endGame(false);
    }
    // State-flag fallbacks for win/lose.
    const st = (this.core && this.core.state) || this.core || {};
    if (!this.gameOver) {
      if (st.won === true || st.victory === true) this.endGame(true);
      else if (st.lost === true || st.defeat === true || st.gameOver === true) this.endGame(false);
    }
  }

  endGame(won) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.finalHash = safeHash(this.core);
    tryCall(this.log, ['finalize', 'close', 'seal'], this.finalHash);
    const msg = won
      ? 'VICTORY — all waves survived (F2 = replay)'
      : 'DEFEAT — the base has fallen (F2 = replay)';
    tryCall(this.hud, ['showBanner', 'banner', 'setBanner', 'setMessage', 'showMessage'], msg);
    console.log('[bulwark] ' + msg + ' hash=' + this.finalHash);
  }

  startReplay() {
    if (this.mode === 'replay') return;
    if (this.commandHistory.length === 0 && this.tickCount === 0) return;
    this.liveHash = safeHash(this.core);
    this.liveTick = this.tickCount;
    this.mode = 'replay';
    this.gameOver = false;
    this.tickCount = 0;
    this.pendingCommands.length = 0;
    this.replayQueue = this.commandHistory.slice();
    this.accumulator = 0;

    // Optional module-level determinism verification, headless.
    try {
      if (this.log && typeof verifyDeterminism === 'function') {
        const ok = verifyDeterminism(this.log);
        console.log('[bulwark] verifyDeterminism:', ok);
      }
    } catch (e) { /* ignore */ }
    this.replayDriver = tryFactory(createReplayDriver, [[this.log], [{ log: this.log, seed: this.seed }]], 'createReplayDriver');

    try { setSeed(this.seed); } catch (e) { /* ignore */ }
    this.rebindCore(this.buildCore(this.seed));
    tryCall(this.renderer, ['reset', 'clear'], this.core);
    tryCall(this.hud, ['showBanner', 'banner', 'setBanner', 'setMessage', 'showMessage'], 'REPLAY — re-driving sim from battle log');
  }

  finishReplay() {
    const replayHash = safeHash(this.core);
    const match = (this.liveHash === null || replayHash === null)
      ? 'unverified'
      : (String(replayHash) === String(this.liveHash) ? 'MATCH — deterministic' : 'DIVERGED');
    const msg = 'REPLAY COMPLETE: ' + match;
    console.log('[bulwark] ' + msg, 'live=', this.liveHash, 'replay=', replayHash);
    tryCall(this.hud, ['showBanner', 'banner', 'setBanner', 'setMessage', 'showMessage'], msg);
    this.mode = 'play';
    this.replayDriver = null;
  }

  replayCommandsForTick(tick) {
    // Prefer the replay driver if it exposes a per-tick API.
    if (this.replayDriver) {
      const fromDriver = tryCall(this.replayDriver, ['inputsForTick', 'commandsForTick', 'getInputs', 'atTick'], tick);
      if (Array.isArray(fromDriver)) return fromDriver;
    }
    const out = [];
    while (this.replayQueue.length && (this.replayQueue[0].tick === undefined || this.replayQueue[0].tick <= tick)) {
      out.push(this.replayQueue.shift());
    }
    return out;
  }

  runHarnessReport() {
    try {
      const report = runHarness({ seed: this.seed, tables: TABLES });
      console.log('[bulwark] harness report:', report);
      tryCall(this.hud, ['showBanner', 'banner', 'setMessage', 'showMessage'], 'Harness run complete — see console');
      return report;
    } catch (e) {
      console.warn('[bulwark] harness run failed:', e);
      return null;
    }
  }

  restart(seed) {
    const s = (seed === undefined || seed === null) ? this.seed : (seed >>> 0);
    this.seed = s;
    this.mode = 'play';
    this.gameOver = false;
    this.tickCount = 0;
    this.accumulator = 0;
    this.pendingCommands.length = 0;
    this.commandHistory.length = 0;
    this.replayQueue.length = 0;
    this.replayDriver = null;
    this.finalHash = null;
    try { setSeed(s); } catch (e) { /* ignore */ }
    this.log = this.buildLog(s);
    this.rebindCore(this.buildCore(s));
    tryCall(this.renderer, ['reset', 'clear'], this.core);
    tryCall(this.hud, ['showBanner', 'banner', 'setMessage', 'showMessage'], 'NEW GAME — seed ' + s);
  }

  frame(now) {
    if (!this.running) return;
    let dtMs = now - this.lastTime;
    this.lastTime = now;
    if (dtMs > MAX_FRAME_MS) dtMs = MAX_FRAME_MS;
    if (dtMs < 0) dtMs = 0;
    this.accumulator += dtMs;

    let safety = 0;
    while (this.accumulator >= TICK_MS && safety < 200) {
      this.accumulator -= TICK_MS;
      safety += 1;
      if (this.mode === 'replay') {
        const tick = coreTick(this.core, this.tickCount);
        const cmds = this.replayCommandsForTick(tick);
        this.stepOnce(cmds);
        if (this.replayQueue.length === 0 && this.tickCount >= this.liveTick) {
          this.finishReplay();
        }
      } else if (!this.gameOver) {
        const cmds = this.pendingCommands;
        this.pendingCommands = [];
        this.stepOnce(cmds);
      } else {
        // hold sim; keep rendering
        break;
      }
    }

    const alpha = Math.max(0, Math.min(1, this.accumulator / TICK_MS));
    tryCall(this.input, ['update', 'tick'], TICK_SECONDS);
    tryCall(this.renderer, ['render', 'update', 'draw'], this.core, alpha);
    tryCall(this.hud, ['update', 'render', 'refresh'], this.core, alpha);
    if (this.app && this.app.renderer && this.app.stage && typeof this.app.renderer.render === 'function') {
      try { this.app.renderer.render(this.app.stage); } catch (e) { /* pixi ticker may already render */ }
    }
    requestAnimationFrame(this._boundFrame);
  }
}

async function boot() {
  const seed = getSeedFromUrl();
  const app = await createPixiApp();
  const game = new Game(app, seed);
  // Debug / headless access (combat core is callable headless).
  window.game = game;
  window.bulwark = {
    game,
    tables: TABLES,
    runHeadless,
    runHarness,
    runReplay,
    createCore,
    serializeState,
    stateHash,
    createRng,
  };
  console.log('[bulwark] booted. seed=' + seed + ' tickRate=' + SIM_RATE + ' (F2 replay, F4 harness)');
}

boot().catch((err) => {
  console.error('[bulwark] boot failed:', err);
  const el = document.createElement('pre');
  el.style.color = '#ff6666';
  el.style.padding = '16px';
  el.style.fontFamily = 'monospace';
  el.textContent = 'BOOT FAILED:\n' + (err && err.stack ? err.stack : String(err));
  document.body.appendChild(el);
});