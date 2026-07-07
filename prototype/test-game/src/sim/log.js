/*
 * src/sim/log.js
 * Battle log: ordered record of seed + tick-stamped inputs + events.
 * Includes the replay driver that re-feeds a recorded log into a fresh
 * headless sim core and asserts hash-identical determinism.
 *
 * Pure data + logic. Zero rendering dependencies.
 */

import * as Core from './core.js';

/* ------------------------------------------------------------------ *
 * Core adapter helpers (the core is headless; we only need to be able
 * to construct it from a seed, step it with a tick's inputs, and read
 * a serializable state hash).
 * ------------------------------------------------------------------ */

export function makeHeadlessCore(seed) {
  if (typeof Core.createCore === 'function') return Core.createCore(seed);
  if (typeof Core.create === 'function') return Core.create(seed);
  if (typeof Core.SimCore === 'function') return new Core.SimCore(seed);
  if (typeof Core.Core === 'function') return new Core.Core(seed);
  if (typeof Core.default === 'function') {
    const Ctor = Core.default;
    // Try class construction first, fall back to plain factory call.
    try {
      return new Ctor(seed);
    } catch (err) {
      return Ctor(seed);
    }
  }
  throw new Error('log.js: unable to construct sim core from ./core.js exports');
}

export function readCoreHash(core) {
  if (!core) return '';
  if (typeof core.stateHash === 'function') return String(core.stateHash());
  if (typeof core.getStateHash === 'function') return String(core.getStateHash());
  if (typeof core.hash === 'function') return String(core.hash());
  if (typeof core.getHash === 'function') return String(core.getHash());
  if (core.stateHash !== undefined && typeof core.stateHash !== 'function') {
    return String(core.stateHash);
  }
  if (core.hash !== undefined && typeof core.hash !== 'function') {
    return String(core.hash);
  }
  throw new Error('log.js: sim core exposes no state hash accessor');
}

export function readCoreTick(core) {
  if (!core) return 0;
  if (typeof core.getTick === 'function') return core.getTick() | 0;
  if (typeof core.tick === 'number') return core.tick | 0;
  if (core.state && typeof core.state.tick === 'number') return core.state.tick | 0;
  return 0;
}

function coreIsOver(core) {
  if (!core) return true;
  const st = core.state || core;
  if (typeof core.isOver === 'function') return !!core.isOver();
  if (typeof st.gameOver === 'boolean') return st.gameOver;
  if (st.outcome && st.outcome !== 'playing' && st.outcome !== 'running' && st.outcome !== null) {
    return true;
  }
  if (typeof st.won === 'boolean' && st.won) return true;
  if (typeof st.lost === 'boolean' && st.lost) return true;
  return false;
}

function stepCore(core, inputs) {
  // Convention: core.step(inputArray) advances exactly one fixed tick.
  core.step(inputs);
}

/* ------------------------------------------------------------------ *
 * Entry kinds
 * ------------------------------------------------------------------ */

export const LOG_KIND = Object.freeze({
  INPUT: 'input',
  EVENT: 'event',
  CHECKPOINT: 'checkpoint',
});

export const LOG_VERSION = 1;

/** How often (in ticks) recordAutoCheckpoint will actually store a hash. */
export const CHECKPOINT_INTERVAL = 120;

/* ------------------------------------------------------------------ *
 * BattleLog
 * ------------------------------------------------------------------ */

export class BattleLog {
  constructor(seed) {
    this.version = LOG_VERSION;
    this.seed = seed >>> 0;
    /** Ordered input commands: { tick, seq, cmd } */
    this.inputs = [];
    /** Ordered sim events (informational; not re-fed): { tick, seq, event } */
    this.events = [];
    /** Hash checkpoints: { tick, hash } */
    this.checkpoints = [];
    /** Final result stamp, set when a run ends. */
    this.finalTick = -1;
    this.finalHash = null;
    this.outcome = null; // 'win' | 'lose' | null
    this._seq = 0;
    this._closed = false;
    /** Fast lookup: tick -> array of cmds (built lazily for replay). */
    this._inputIndex = null;
  }

  get closed() {
    return this._closed;
  }

  get lastTick() {
    let t = this.finalTick;
    if (this.inputs.length) {
      const it = this.inputs[this.inputs.length - 1].tick;
      if (it > t) t = it;
    }
    if (this.events.length) {
      const et = this.events[this.events.length - 1].tick;
      if (et > t) t = et;
    }
    if (this.checkpoints.length) {
      const ct = this.checkpoints[this.checkpoints.length - 1].tick;
      if (ct > t) t = ct;
    }
    return t;
  }

  /** Record a timestamped player input command (the replayable stream). */
  recordInput(tick, cmd) {
    if (this._closed) return null;
    const entry = { tick: tick | 0, seq: this._seq++, cmd: cloneData(cmd) };
    this.inputs.push(entry);
    this._inputIndex = null;
    return entry;
  }

  /** Record a sim event (kills, wave starts, structure completion, ...). */
  recordEvent(tick, event) {
    if (this._closed) return null;
    const entry = { tick: tick | 0, seq: this._seq++, event: cloneData(event) };
    this.events.push(entry);
    return entry;
  }

  /** Record several sim events emitted by one tick. */
  recordEvents(tick, events) {
    if (!events || !events.length) return;
    for (let i = 0; i < events.length; i++) this.recordEvent(tick, events[i]);
  }

  /** Explicit hash checkpoint at a tick. */
  recordCheckpoint(tick, hash) {
    if (this._closed) return null;
    const cp = { tick: tick | 0, hash: String(hash) };
    this.checkpoints.push(cp);
    return cp;
  }

  /** Cheap periodic checkpointing — call every tick; stores every CHECKPOINT_INTERVAL. */
  recordAutoCheckpoint(tick, core) {
    if (this._closed) return null;
    if ((tick | 0) % CHECKPOINT_INTERVAL !== 0) return null;
    return this.recordCheckpoint(tick, readCoreHash(core));
  }

  /** Stamp the final outcome + hash and close the log to further writes. */
  finalize(tick, hash, outcome) {
    this.finalTick = tick | 0;
    this.finalHash = hash === undefined || hash === null ? null : String(hash);
    this.outcome = outcome === undefined ? null : outcome;
    this._closed = true;
    return this;
  }

  /** Re-open a finalized log (used when resuming an aborted session). */
  reopen() {
    this._closed = false;
    return this;
  }

  /** All input commands stamped for a given tick, in recorded order. */
  inputsAt(tick) {
    if (!this._inputIndex) {
      const idx = new Map();
      for (let i = 0; i < this.inputs.length; i++) {
        const e = this.inputs[i];
        let arr = idx.get(e.tick);
        if (!arr) {
          arr = [];
          idx.set(e.tick, arr);
        }
        arr.push(e);
      }
      // Deterministic order within a tick: by recording sequence.
      idx.forEach((arr) => arr.sort((a, b) => a.seq - b.seq));
      this._inputIndex = idx;
    }
    const arr = this._inputIndex.get(tick | 0);
    if (!arr) return EMPTY_ARRAY;
    return arr.map((e) => e.cmd);
  }

  /** Merged, ordered stream of every entry (for display / export). */
  entries() {
    const out = [];
    for (let i = 0; i < this.inputs.length; i++) {
      const e = this.inputs[i];
      out.push({ kind: LOG_KIND.INPUT, tick: e.tick, seq: e.seq, data: e.cmd });
    }
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      out.push({ kind: LOG_KIND.EVENT, tick: e.tick, seq: e.seq, data: e.event });
    }
    for (let i = 0; i < this.checkpoints.length; i++) {
      const c = this.checkpoints[i];
      out.push({ kind: LOG_KIND.CHECKPOINT, tick: c.tick, seq: -1, data: c.hash });
    }
    out.sort((a, b) => (a.tick - b.tick) || (a.seq - b.seq));
    return out;
  }

  /* ------------------------------ serialization ------------------------------ */

  toJSON() {
    return {
      version: this.version,
      seed: this.seed,
      inputs: this.inputs,
      events: this.events,
      checkpoints: this.checkpoints,
      finalTick: this.finalTick,
      finalHash: this.finalHash,
      outcome: this.outcome,
    };
  }

  serialize() {
    return JSON.stringify(this.toJSON());
  }

  static fromJSON(obj) {
    const log = new BattleLog(obj.seed >>> 0);
    log.version = obj.version | 0 || LOG_VERSION;
    log.inputs = Array.isArray(obj.inputs)
      ? obj.inputs.map((e) => ({ tick: e.tick | 0, seq: e.seq | 0, cmd: cloneData(e.cmd) }))
      : [];
    log.events = Array.isArray(obj.events)
      ? obj.events.map((e) => ({ tick: e.tick | 0, seq: e.seq | 0, event: cloneData(e.event) }))
      : [];
    log.checkpoints = Array.isArray(obj.checkpoints)
      ? obj.checkpoints.map((c) => ({ tick: c.tick | 0, hash: String(c.hash) }))
      : [];
    log.finalTick = obj.finalTick === undefined ? -1 : obj.finalTick | 0;
    log.finalHash = obj.finalHash === undefined || obj.finalHash === null ? null : String(obj.finalHash);
    log.outcome = obj.outcome === undefined ? null : obj.outcome;
    let maxSeq = -1;
    for (let i = 0; i < log.inputs.length; i++) if (log.inputs[i].seq > maxSeq) maxSeq = log.inputs[i].seq;
    for (let i = 0; i < log.events.length; i++) if (log.events[i].seq > maxSeq) maxSeq = log.events[i].seq;
    log._seq = maxSeq + 1;
    log._closed = log.finalHash !== null;
    return log;
  }

  static deserialize(json) {
    return BattleLog.fromJSON(JSON.parse(json));
  }

  clone() {
    return BattleLog.fromJSON(JSON.parse(this.serialize()));
  }
}

const EMPTY_ARRAY = Object.freeze([]);

function cloneData(v) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  return JSON.parse(JSON.stringify(v));
}

export function createLog(seed) {
  return new BattleLog(seed);
}

/* ------------------------------------------------------------------ *
 * Replay driver — feeds a recorded log back into a FRESH headless core.
 * ------------------------------------------------------------------ */

/**
 * Incremental replay driver. Owns its own fresh core built from the
 * log's seed; step() advances one fixed tick, re-feeding recorded
 * inputs and verifying checkpoints as they are crossed.
 *
 * main.js drives this in replay mode (rendering reads driver.core.state);
 * runReplay() below drives it to completion headlessly.
 */
export class ReplayDriver {
  constructor(log, coreFactory) {
    this.log = log;
    this.core = (coreFactory || makeHeadlessCore)(log.seed);
    this.tick = 0;
    this.endTick = log.finalTick >= 0 ? log.finalTick : log.lastTick;
    this.done = false;
    this.mismatches = [];
    this.checkpointsChecked = 0;
    this.checkpointsPassed = 0;
    this._cpByTick = new Map();
    for (let i = 0; i < log.checkpoints.length; i++) {
      const c = log.checkpoints[i];
      this._cpByTick.set(c.tick, c.hash);
    }
    this.finalHash = null;
    this.identical = null;
  }

  /** Inputs recorded for the current tick (before it is stepped). */
  pendingInputs() {
    return this.log.inputsAt(this.tick);
  }

  /** Advance exactly one tick. Returns false once the replay is finished. */
  step() {
    if (this.done) return false;
    const inputs = this.log.inputsAt(this.tick);
    stepCore(this.core, inputs);
    // Verify any checkpoint recorded at the tick we just completed.
    const expected = this._cpByTick.get(this.tick);
    if (expected !== undefined) {
      this.checkpointsChecked++;
      const got = readCoreHash(this.core);
      if (got === expected) {
        this.checkpointsPassed++;
      } else {
        this.mismatches.push({ tick: this.tick, expected, got });
      }
    }
    this.tick++;
    if (this.tick > this.endTick || (this.log.finalTick < 0 && coreIsOver(this.core))) {
      this._finish();
      return false;
    }
    return true;
  }

  /** Advance up to n ticks (for throttled live replay). Returns ticks run. */
  stepMany(n) {
    let ran = 0;
    while (ran < n && this.step()) ran++;
    if (this.done && ran < n) return ran + (ran === 0 ? 0 : 0);
    return ran;
  }

  _finish() {
    if (this.done) return;
    this.done = true;
    this.finalHash = readCoreHash(this.core);
    if (this.log.finalHash !== null) {
      this.identical = this.finalHash === this.log.finalHash && this.mismatches.length === 0;
    } else {
      this.identical = this.mismatches.length === 0;
    }
  }

  /** Run remaining ticks to completion (headless). */
  runToEnd(maxTicks) {
    const cap = maxTicks === undefined ? 1000000 : maxTicks;
    let guard = 0;
    while (!this.done && guard < cap) {
      this.step();
      guard++;
    }
    if (!this.done) this._finish();
    return this.report();
  }

  report() {
    return {
      seed: this.log.seed,
      ticksRun: this.tick,
      finalHash: this.finalHash,
      expectedHash: this.log.finalHash,
      identical: this.identical,
      checkpointsChecked: this.checkpointsChecked,
      checkpointsPassed: this.checkpointsPassed,
      mismatches: this.mismatches.slice(),
      outcome: this.log.outcome,
    };
  }
}

export function createReplayDriver(log, coreFactory) {
  return new ReplayDriver(log, coreFactory);
}

/**
 * Run a full headless replay of a recorded log and return a determinism
 * report: { identical, finalHash, expectedHash, mismatches, ... }.
 */
export function runReplay(log, coreFactory, maxTicks) {
  const driver = new ReplayDriver(log, coreFactory);
  return driver.runToEnd(maxTicks);
}

/**
 * Replay the log twice into two independent fresh cores and additionally
 * compare against the recorded hash. Throws on any divergence when
 * `throwOnFail` is true; always returns the combined report.
 */
export function verifyDeterminism(log, options) {
  const opts = options || {};
  const factory = opts.coreFactory || makeHeadlessCore;
  const maxTicks = opts.maxTicks;

  const runA = runReplay(log, factory, maxTicks);
  const runB = runReplay(log, factory, maxTicks);

  const crossIdentical = runA.finalHash === runB.finalHash;
  const vsRecorded =
    log.finalHash === null ? true : runA.finalHash === log.finalHash && runB.finalHash === log.finalHash;
  const checkpointsOk = runA.mismatches.length === 0 && runB.mismatches.length === 0;
  const identical = crossIdentical && vsRecorded && checkpointsOk;

  const report = {
    identical,
    crossIdentical,
    vsRecorded,
    checkpointsOk,
    expectedHash: log.finalHash,
    runA,
    runB,
    summary: identical
      ? 'REPLAY OK — hash-identical (' + String(runA.finalHash) + ')'
      : 'REPLAY DIVERGED — expected ' +
        String(log.finalHash) +
        ' got A=' +
        String(runA.finalHash) +
        ' B=' +
        String(runB.finalHash) +
        (checkpointsOk ? '' : ' (+' + (runA.mismatches.length + runB.mismatches.length) + ' checkpoint mismatches)'),
  };

  if (opts.throwOnFail && !identical) {
    throw new Error('Determinism assertion failed: ' + report.summary);
  }
  return report;
}

/**
 * Assert-style helper: replays the log against the live core's final hash.
 * Used at game end ("prove determinism" acceptance gate).
 */
export function assertReplayMatches(log, liveHash) {
  const finalHash = liveHash !== undefined && liveHash !== null ? String(liveHash) : log.finalHash;
  const run = runReplay(log);
  const ok = finalHash === null ? run.mismatches.length === 0 : run.finalHash === finalHash && run.mismatches.length === 0;
  return {
    ok,
    liveHash: finalHash,
    replayHash: run.finalHash,
    mismatches: run.mismatches,
    summary: ok
      ? 'Deterministic: replay hash matches live hash (' + String(run.finalHash) + ')'
      : 'NON-DETERMINISTIC: live=' + String(finalHash) + ' replay=' + String(run.finalHash),
  };
}

/* ------------------------------------------------------------------ *
 * Recorder — thin session wrapper binding a live core to a BattleLog.
 * main.js / input.js route all commands through recorder.dispatch().
 * ------------------------------------------------------------------ */

export class LogRecorder {
  constructor(core, log) {
    this.core = core;
    this.log = log || new BattleLog(readSeed(core));
    this._pending = [];
  }

  /** Queue a command for the NEXT sim tick (and record it in the log). */
  dispatch(cmd) {
    const tick = readCoreTick(this.core);
    this.log.recordInput(tick, cmd);
    this._pending.push(cloneData(cmd));
    return cmd;
  }

  /** Step the live core one tick with all queued commands; logs emitted events. */
  step() {
    const tick = readCoreTick(this.core);
    const inputs = this._pending;
    this._pending = [];
    const result = this.core.step(inputs);
    const events = extractEvents(this.core, result);
    if (events && events.length) this.log.recordEvents(tick, events);
    this.log.recordAutoCheckpoint(tick, this.core);
    if (coreIsOver(this.core) && !this.log.closed) {
      const st = this.core.state || this.core;
      const outcome =
        st.outcome !== undefined && st.outcome !== null
          ? st.outcome
          : st.won
            ? 'win'
            : st.lost
              ? 'lose'
              : null;
      this.log.finalize(readCoreTick(this.core), readCoreHash(this.core), outcome);
    }
    return result;
  }
}

function readSeed(core) {
  if (!core) return 0;
  if (typeof core.seed === 'number') return core.seed >>> 0;
  const st = core.state || {};
  if (typeof st.seed === 'number') return st.seed >>> 0;
  return 0;
}

function extractEvents(core, stepResult) {
  if (Array.isArray(stepResult)) return stepResult;
  if (stepResult && Array.isArray(stepResult.events)) return stepResult.events;
  if (Array.isArray(core.lastEvents)) return core.lastEvents;
  const st = core.state || {};
  if (Array.isArray(st.events)) return st.events;
  return null;
}

export function createRecorder(core, log) {
  return new LogRecorder(core, log);
}

export default BattleLog;