// src/sim/log.js
// Battle log stream: ordered inputs + seed + events; serialization for replay.
//
// The battle log is the canonical, deterministic record of a play session:
//   - the seed used to initialize the RNG
//   - the ordered list of input commands (each tagged with the tick it applies on)
//   - an (optional) ordered list of events emitted by the sim during play
//   - periodic / final state hashes used to verify deterministic replay
//
// The replay driver (src/sim/replay.js) re-drives the headless combat core from
// this log and compares state hashes to prove determinism.
//
// This module is intentionally rendering-agnostic: it only records strict data.

/**
 * A single recorded input command.
 * @typedef {Object} LogInput
 * @property {number} tick   - simulation tick on which the command should be applied
 * @property {number} seq    - monotonic sequence number (tie-break ordering within a tick)
 * @property {Object} cmd    - command payload (see src/sim/commands.js)
 */

/**
 * A single recorded sim event (informational; not required for replay,
 * but useful for verification & debugging).
 * @typedef {Object} LogEvent
 * @property {number} tick
 * @property {number} seq
 * @property {string} type
 * @property {Object} data
 */

const LOG_VERSION = 1;

export class BattleLog {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.seed] - RNG seed for the session (defaults 0)
   * @param {Object} [opts.meta] - arbitrary metadata (map name, faction, etc.)
   */
  constructor(opts = {}) {
    this.version = LOG_VERSION;
    this.seed = (opts.seed >>> 0) || 0;
    this.meta = opts.meta ? { ...opts.meta } : {};

    /** @type {LogInput[]} ordered by (tick, seq) */
    this.inputs = [];
    /** @type {LogEvent[]} ordered by (tick, seq) */
    this.events = [];
    /** @type {{tick:number, hash:number}[]} */
    this.hashes = [];

    // Monotonic sequence counters so ordering is stable even within one tick.
    this._inputSeq = 0;
    this._eventSeq = 0;

    // Cursors used by consumers (e.g. replay) that stream through inputs in order.
    this._inputCursor = 0;

    // When recording is closed (e.g. after a run finishes) further writes throw.
    this._closed = false;
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /**
   * Set / reset the seed. Should be done before any ticks are simulated.
   * @param {number} seed
   */
  setSeed(seed) {
    if (this._closed) throw new Error('BattleLog: cannot set seed on a closed log');
    this.seed = seed >>> 0;
    return this;
  }

  /**
   * Record an input command that applies on a given tick.
   * @param {number} tick
   * @param {Object} cmd - command object (must be JSON-serializable)
   * @returns {LogInput}
   */
  recordInput(tick, cmd) {
    if (this._closed) throw new Error('BattleLog: cannot record input on a closed log');
    const entry = {
      tick: tick | 0,
      seq: this._inputSeq++,
      cmd: cloneData(cmd),
    };
    this.inputs.push(entry);
    return entry;
  }

  /**
   * Record an event emitted by the sim (kill, build-complete, base-hit, etc.).
   * @param {number} tick
   * @param {string} type
   * @param {Object} [data]
   * @returns {LogEvent}
   */
  recordEvent(tick, type, data = {}) {
    if (this._closed) return null;
    const entry = {
      tick: tick | 0,
      seq: this._eventSeq++,
      type: String(type),
      data: cloneData(data),
    };
    this.events.push(entry);
    return entry;
  }

  /**
   * Record a deterministic state hash checkpoint at a given tick.
   * @param {number} tick
   * @param {number} hash - 32-bit unsigned hash of strict sim state
   */
  recordHash(tick, hash) {
    if (this._closed) throw new Error('BattleLog: cannot record hash on a closed log');
    this.hashes.push({ tick: tick | 0, hash: hash >>> 0 });
    return this;
  }

  /**
   * Mark the log as complete (no more writes allowed).
   */
  close() {
    this._closed = true;
    // Ensure canonical ordering for serialization / replay.
    this.sort();
    return this;
  }

  get closed() {
    return this._closed;
  }

  // ---------------------------------------------------------------------------
  // Ordering / querying
  // ---------------------------------------------------------------------------

  /**
   * Stable-sort inputs and events by (tick, seq). Idempotent.
   */
  sort() {
    const cmp = (a, b) => (a.tick - b.tick) || (a.seq - b.seq);
    this.inputs.sort(cmp);
    this.events.sort(cmp);
    this.hashes.sort((a, b) => a.tick - b.tick);
    return this;
  }

  /**
   * Return all inputs scheduled to apply exactly on `tick`.
   * (Non-destructive; safe to call independent of the cursor.)
   * @param {number} tick
   * @returns {LogInput[]}
   */
  inputsAtTick(tick) {
    const out = [];
    for (let i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].tick === tick) out.push(this.inputs[i]);
      else if (this.inputs[i].tick > tick) break; // relies on sorted order
    }
    return out;
  }

  /**
   * Streaming consumer: drain and return all inputs up to and including `tick`,
   * advancing an internal cursor. Used by the replay driver to feed commands
   * in exact recorded order.
   *
   * Requires the log to be sorted (call sort()/close() first). BattleLog keeps
   * inputs sorted after close(); during live recording, ordering is preserved
   * because seq is monotonic and inputs are typically pushed in tick order.
   *
   * @param {number} tick
   * @returns {LogInput[]}
   */
  drainInputsUpTo(tick) {
    const out = [];
    while (
      this._inputCursor < this.inputs.length &&
      this.inputs[this._inputCursor].tick <= tick
    ) {
      out.push(this.inputs[this._inputCursor]);
      this._inputCursor++;
    }
    return out;
  }

  /**
   * Reset the streaming cursor to the beginning (for a fresh replay pass).
   */
  resetCursor() {
    this._inputCursor = 0;
    return this;
  }

  /**
   * Return the last recorded tick across inputs/events/hashes (0 if empty).
   */
  lastTick() {
    let t = 0;
    if (this.inputs.length) t = Math.max(t, this.inputs[this.inputs.length - 1].tick);
    if (this.events.length) t = Math.max(t, this.events[this.events.length - 1].tick);
    if (this.hashes.length) t = Math.max(t, this.hashes[this.hashes.length - 1].tick);
    return t;
  }

  /**
   * Number of recorded inputs.
   */
  get inputCount() {
    return this.inputs.length;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Produce a plain, JSON-serializable object of the entire log.
   * @returns {Object}
   */
  toJSON() {
    // Ensure canonical order before emitting.
    this.sort();
    return {
      version: this.version,
      seed: this.seed,
      meta: cloneData(this.meta),
      inputs: this.inputs.map((i) => ({ tick: i.tick, seq: i.seq, cmd: cloneData(i.cmd) })),
      events: this.events.map((e) => ({
        tick: e.tick,
        seq: e.seq,
        type: e.type,
        data: cloneData(e.data),
      })),
      hashes: this.hashes.map((h) => ({ tick: h.tick, hash: h.hash })),
    };
  }

  /**
   * Serialize to a JSON string.
   * @param {number} [space] - pretty-print indent (optional)
   * @returns {string}
   */
  serialize(space) {
    return JSON.stringify(this.toJSON(), null, space);
  }

  /**
   * Reconstruct a BattleLog from a plain object (as produced by toJSON()).
   * @param {Object} obj
   * @returns {BattleLog}
   */
  static fromObject(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('BattleLog.fromObject: invalid object');
    }
    const log = new BattleLog({ seed: obj.seed | 0, meta: obj.meta || {} });
    log.version = obj.version || LOG_VERSION;

    if (Array.isArray(obj.inputs)) {
      log.inputs = obj.inputs.map((i) => ({
        tick: i.tick | 0,
        seq: i.seq | 0,
        cmd: cloneData(i.cmd),
      }));
      // Advance seq counter beyond the max so further recording stays ordered.
      log._inputSeq = log.inputs.reduce((m, i) => Math.max(m, i.seq + 1), 0);
    }

    if (Array.isArray(obj.events)) {
      log.events = obj.events.map((e) => ({
        tick: e.tick | 0,
        seq: e.seq | 0,
        type: String(e.type),
        data: cloneData(e.data),
      }));
      log._eventSeq = log.events.reduce((m, e) => Math.max(m, e.seq + 1), 0);
    }

    if (Array.isArray(obj.hashes)) {
      log.hashes = obj.hashes.map((h) => ({ tick: h.tick | 0, hash: h.hash >>> 0 }));
    }

    log.sort();
    return log;
  }

  /**
   * Reconstruct a BattleLog from a JSON string.
   * @param {string} str
   * @returns {BattleLog}
   */
  static deserialize(str) {
    return BattleLog.fromObject(JSON.parse(str));
  }

  /**
   * Create a fresh recording clone that shares seed + inputs but has empty
   * events/hashes and a reset cursor. Useful for the replay driver which
   * re-derives events by re-running the sim.
   * @returns {BattleLog}
   */
  cloneForReplay() {
    const log = new BattleLog({ seed: this.seed, meta: this.meta });
    log.version = this.version;
    log.inputs = this.inputs.map((i) => ({ tick: i.tick, seq: i.seq, cmd: cloneData(i.cmd) }));
    log._inputSeq = this._inputSeq;
    log.sort();
    log.resetCursor();
    return log;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Deep clone of JSON-safe data. Kept small & dependency-free so the log stays
 * self-contained. Handles primitives, arrays, and plain objects. Functions and
 * class instances are not expected in command/event payloads.
 * @param {*} v
 * @returns {*}
 */
function cloneData(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const arr = new Array(v.length);
    for (let i = 0; i < v.length; i++) arr[i] = cloneData(v[i]);
    return arr;
  }
  const out = {};
  for (const k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) {
      out[k] = cloneData(v[k]);
    }
  }
  return out;
}

/**
 * Deterministic 32-bit FNV-1a hash of a JSON-serializable value. Used to
 * checksum strict sim state for replay verification. Keys are visited in
 * insertion order; sim state should build objects deterministically so this
 * is stable across identical runs.
 * @param {*} value
 * @returns {number} unsigned 32-bit hash
 */
export function hashState(value) {
  let h = 0x811c9dc5 >>> 0;
  const feed = (s) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  const walk = (v) => {
    if (v === null) {
      feed('n');
    } else if (typeof v === 'number') {
      // Normalize -0 to 0 and use a fixed representation for stability.
      feed('#');
      feed(Number.isFinite(v) ? String(v === 0 ? 0 : v) : 'NaN');
    } else if (typeof v === 'boolean') {
      feed(v ? 't' : 'f');
    } else if (typeof v === 'string') {
      feed('s');
      feed(v);
    } else if (Array.isArray(v)) {
      feed('[');
      for (let i = 0; i < v.length; i++) walk(v[i]);
      feed(']');
    } else if (typeof v === 'object') {
      feed('{');
      for (const k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k)) {
          feed('k');
          feed(k);
          walk(v[k]);
        }
      }
      feed('}');
    } else {
      // Undefined / function / symbol — skip but mark.
      feed('u');
    }
  };
  walk(value);
  return h >>> 0;
}

export { LOG_VERSION };
export default BattleLog;