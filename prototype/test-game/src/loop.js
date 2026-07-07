// src/loop.js
// Main loop: fixed sim step + render sync, pause/speed control.
//
// This module drives the deterministic simulation forward at a fixed timestep
// while rendering interpolates/reads at whatever rate the browser provides.
// Presentation (render) NEVER mutates sim state — determinism is preserved.
//
// It integrates with:
//   - sim/step.js       : world = step(world, dtFixed, commandsThisTick, log)
//                         (falls back to world.step / simCore.step if needed)
//   - render/renderer.js: renderer.render(world, alpha)
//   - input/controller  : controller.drainCommands() -> [commands]
//   - hud/hud.js         : hud.update(world, loopState)
//   - replay/battleLog   : log.record(...) already handled inside step
//
// The loop is intentionally decoupled: you pass it callbacks/objects, and it
// owns the timing. No hardcoded balance — everything comes through `world`.

const FIXED_DT = 1 / 30;      // deterministic sim tick (seconds)
const MAX_FRAME_DT = 0.25;    // clamp to avoid spiral-of-death after tab-away
const MAX_STEPS_PER_FRAME = 8; // catch-up cap per rendered frame

export class GameLoop {
  /**
   * @param {object} opts
   * @param {object} opts.session        session/state glue (holds world ref, ui state)
   * @param {function} opts.getWorld     () => world  (current sim world)
   * @param {function} opts.setWorld     (world) => void (store stepped world)
   * @param {function} opts.stepFn       (world, dt, commands, log) => world
   * @param {function} opts.drainCommands () => command[]  (input -> commands)
   * @param {object}  [opts.renderer]    { render(world, alpha) }
   * @param {object}  [opts.hud]         { update(world, loop) }
   * @param {object}  [opts.log]         battle log (passed to stepFn)
   * @param {function}[opts.onGameOver]  (world) => void
   * @param {function}[opts.isGameOver]  (world) => boolean
   */
  constructor(opts) {
    this.session = opts.session || null;
    this.getWorld = opts.getWorld;
    this.setWorld = opts.setWorld;
    this.stepFn = opts.stepFn;
    this.drainCommands = opts.drainCommands || (() => []);
    this.renderer = opts.renderer || null;
    this.hud = opts.hud || null;
    this.log = opts.log || null;
    this.onGameOver = opts.onGameOver || null;
    this.isGameOver =
      opts.isGameOver ||
      ((w) => !!(w && (w.gameOver || w.result || w.status === 'won' || w.status === 'lost')));

    // Timing state
    this.fixedDt = FIXED_DT;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.speed = 1; // 0.5 / 1 / 2 / 4 speed multiplier
    this.availableSpeeds = [0.5, 1, 2, 4];

    // Diagnostics
    this.tickCount = 0;
    this.frameCount = 0;
    this.fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    this._gameOverFired = false;

    this._rafId = 0;
    this._frame = this._frame.bind(this);
  }

  // ---- Public control API -------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
    this._rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) {
      this.start();
      return;
    }
    if (this.paused) {
      this.paused = false;
      // Reset timing so we don't fast-forward across the pause gap.
      this.lastTime = performance.now() / 1000;
      this.accumulator = 0;
    }
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  setSpeed(mult) {
    if (typeof mult === 'number' && mult > 0) {
      this.speed = mult;
    }
  }

  cycleSpeed() {
    const idx = this.availableSpeeds.indexOf(this.speed);
    const next = this.availableSpeeds[(idx + 1) % this.availableSpeeds.length];
    this.speed = next;
    return next;
  }

  /** Advance exactly one fixed tick (used when paused, for debugging). */
  stepOnce() {
    this._simTick();
    // Render immediately so the single step is visible.
    if (this.renderer) {
      const w = this.getWorld();
      this.renderer.render(w, 0);
    }
    if (this.hud) this.hud.update(this.getWorld(), this._loopSnapshot());
  }

  // ---- Internal -----------------------------------------------------------

  _loopSnapshot() {
    return {
      paused: this.paused,
      running: this.running,
      speed: this.speed,
      tickCount: this.tickCount,
      frameCount: this.frameCount,
      fps: this.fps,
      fixedDt: this.fixedDt,
    };
  }

  _simTick() {
    let world = this.getWorld();
    if (!world) return;

    // Drain queued input into deterministic commands for THIS tick.
    let commands = [];
    try {
      commands = this.drainCommands() || [];
    } catch (e) {
      // Input errors must never crash the sim loop.
      commands = [];
    }

    // Deterministic step. stepFn is responsible for logging into this.log.
    const next = this.stepFn(world, this.fixedDt, commands, this.log);
    if (next) {
      world = next;
      this.setWorld(world);
    }
    this.tickCount++;

    // Game-over detection (fired once).
    if (!this._gameOverFired && this.isGameOver(world)) {
      this._gameOverFired = true;
      if (this.onGameOver) {
        try {
          this.onGameOver(world);
        } catch (e) {
          /* swallow to keep loop alive for overlay rendering */
        }
      }
    }
  }

  _frame(nowMs) {
    if (!this.running) return;
    this._rafId = requestAnimationFrame(this._frame);

    const now = nowMs / 1000;
    let frameDt = now - this.lastTime;
    this.lastTime = now;

    // Clamp to avoid huge catch-up after the tab was backgrounded.
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;
    if (frameDt < 0) frameDt = 0;

    // FPS metering.
    this._fpsAccum += frameDt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    this.frameCount++;

    // Advance the sim in fixed steps, scaled by speed. When paused we still
    // render (so HUD / selection UI updates), but do not accumulate sim time.
    if (!this.paused && !this._gameOverFired) {
      this.accumulator += frameDt * this.speed;

      let steps = 0;
      while (this.accumulator >= this.fixedDt && steps < MAX_STEPS_PER_FRAME) {
        this._simTick();
        this.accumulator -= this.fixedDt;
        steps++;
        if (this._gameOverFired) break;
      }

      // If we blew past the catch-up cap, drop the leftover time to prevent
      // a permanent lag spiral (determinism is per-tick, not wall-clock).
      if (steps >= MAX_STEPS_PER_FRAME && this.accumulator > this.fixedDt) {
        this.accumulator = 0;
      }
    } else {
      // Keep accumulator drained while paused so resume is snappy.
      this.accumulator = 0;
    }

    // Interpolation factor for smooth rendering between fixed ticks.
    const alpha = this.paused ? 0 : this.accumulator / this.fixedDt;

    const world = this.getWorld();
    if (this.renderer && world) {
      try {
        this.renderer.render(world, alpha);
      } catch (e) {
        // Rendering must never break the sim; log to console only.
        // eslint-disable-next-line no-console
        console.error('render error', e);
      }
    }

    if (this.hud && world) {
      try {
        this.hud.update(world, this._loopSnapshot());
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('hud error', e);
      }
    }
  }
}

/**
 * Convenience factory used by main.js. Resolves the step function from the
 * various shapes step/simCore may export so the loop stays decoupled.
 */
export function createLoop(config) {
  let stepFn = config.stepFn;

  if (!stepFn) {
    // Try common shapes.
    if (config.step && typeof config.step.step === 'function') {
      stepFn = config.step.step;
    } else if (config.step && typeof config.step.default === 'function') {
      stepFn = config.step.default;
    } else if (typeof config.step === 'function') {
      stepFn = config.step;
    } else if (config.simCore && typeof config.simCore.step === 'function') {
      stepFn = config.simCore.step;
    }
  }

  if (typeof stepFn !== 'function') {
    throw new Error('createLoop: no valid step function provided');
  }

  return new GameLoop({ ...config, stepFn });
}

export { FIXED_DT };
export default GameLoop;