// src/replay/battleLog.js
// Ordered record of seed + inputs (commands) + events written during play.
// This is the canonical stream a replay re-drives through the headless sim core
// to prove determinism (same seed + same ordered commands => identical state).
//
// The log is a strict, append-only structure:
//   { version, seed, meta, commands:[{tick, cmd}], events:[{tick, ...}] }
//
// Commands are the authoritative input; events are informational (for auditing /
// determinism cross-checks). Replay MUST reproduce events identically.

const BATTLE_LOG_VERSION = 1;

export class BattleLog {
  /**
   * @param {number} seed - deterministic PRNG seed for the battle
   * @param {object} [meta] - optional metadata (config hash, slice id, etc.)
   */
  constructor(seed = 0, meta = {}) {
    this.version = BATTLE_LOG_VERSION;
    this.seed = seed >>> 0;
    this.meta = meta || {};
    // Ordered command records. Each: { tick:int, cmd:{type,...} }
    this.commands = [];
    // Ordered event records emitted by the sim. Each: { tick:int, type, ...data }
    this.events = [];
    // Monotonic sequence counter to guarantee stable ordering when many
    // records share the same tick.
    this._seq = 0;
    this._closed = false;
  }

  /** Reset seed (only allowed before any command recorded). */
  setSeed(seed) {
    if (this.commands.length > 0) {
      throw new Error('BattleLog: cannot change seed after commands recorded');
    }
    this.seed = seed >>> 0;
    return this;
  }

  /**
   * Record an input command at a given sim tick.
   * Commands must be recorded in non-decreasing tick order.
   * @param {number} tick - the sim tick at which the command is applied
   * @param {object} cmd  - command object (from src/sim/commands.js schema)
   */
  recordCommand(tick, cmd) {
    if (this._closed) throw new Error('BattleLog: cannot record on closed log');
    if (typeof tick !== 'number' || tick < 0 || (tick | 0) !== tick) {
      throw new Error('BattleLog: invalid tick ' + tick);
    }
    if (!cmd || typeof cmd !== 'object' || typeof cmd.type !== 'string') {
      throw new Error('BattleLog: invalid command (needs .type)');
    }
    const last = this.commands[this.commands.length - 1];
    if (last && tick < last.tick) {
      throw new Error(
        'BattleLog: command tick ' + tick + ' < last ' + last.tick + ' (out of order)'
      );
    }
    // Deep-clone the command so later mutation of the caller's object cannot
    // corrupt the recorded log. Commands are plain data.
    const rec = { seq: this._seq++, tick: tick | 0, cmd: cloneData(cmd) };
    this.commands.push(rec);
    return rec;
  }

  /**
   * Record a sim event at a given tick (informational / determinism audit).
   * @param {number} tick
   * @param {string} type - event type ('kill','build','destroy','wave','baseHit', etc.)
   * @param {object} [data]
   */
  recordEvent(tick, type, data = {}) {
    if (this._closed) return; // events after close are dropped silently
    if (typeof type !== 'string') throw new Error('BattleLog: event needs string type');
    const rec = { seq: this._seq++, tick: (tick | 0), type, data: cloneData(data) };
    this.events.push(rec);
    return rec;
  }

  /** Freeze the log (end of battle). */
  close(result) {
    this._closed = true;
    if (result !== undefined) this.meta.result = cloneData(result);
    return this;
  }

  get isClosed() {
    return this._closed;
  }

  /** Number of recorded commands. */
  get commandCount() {
    return this.commands.length;
  }

  /** Number of recorded events. */
  get eventCount() {
    return this.events.length;
  }

  /**
   * Return all commands that should be applied AT exactly `tick`, in stable
   * recorded order. Used by both live play (dispatch) and replay driver.
   * @param {number} tick
   * @returns {Array<{tick,cmd}>}
   */
  commandsAtTick(tick) {
    const out = [];
    for (let i = 0; i < this.commands.length; i++) {
      if (this.commands[i].tick === tick) out.push(this.commands[i]);
    }
    return out;
  }

  /**
   * Iterate commands in [fromTick, toTick] inclusive, calling fn(tick,cmd).
   * Preserves stable recorded order.
   */
  forEachCommandInRange(fromTick, toTick, fn) {
    for (let i = 0; i < this.commands.length; i++) {
      const c = this.commands[i];
      if (c.tick >= fromTick && c.tick <= toTick) fn(c.tick, c.cmd, c.seq);
    }
  }

  /** The last tick at which any command was recorded (or -1 if none). */
  lastCommandTick() {
    const last = this.commands[this.commands.length - 1];
    return last ? last.tick : -1;
  }

  /**
   * Serialize to a plain JSON-safe object.
   */
  toJSON() {
    return {
      version: this.version,
      seed: this.seed,
      meta: cloneData(this.meta),
      closed: this._closed,
      commands: this.commands.map((r) => ({ tick: r.tick, cmd: r.cmd })),
      events: this.events.map((r) => ({ tick: r.tick, type: r.type, data: r.data })),
    };
  }

  /** Serialize to a JSON string. */
  serialize() {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Rebuild a BattleLog from a plain object (from toJSON / parsed serialize()).
   * @param {object|string} data
   * @returns {BattleLog}
   */
  static fromJSON(data) {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || typeof data !== 'object') {
      throw new Error('BattleLog.fromJSON: invalid data');
    }
    const log = new BattleLog(data.seed >>> 0, data.meta || {});
    log.version = data.version || BATTLE_LOG_VERSION;
    const cmds = Array.isArray(data.commands) ? data.commands : [];
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      // bypass ordering validation only if already ordered; still enforce it
      log.recordCommand(c.tick | 0, c.cmd);
    }
    const evs = Array.isArray(data.events) ? data.events : [];
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      log.recordEvent(e.tick | 0, e.type, e.data || {});
    }
    if (data.closed) log._closed = true;
    return log;
  }

  static deserialize(str) {
    return BattleLog.fromJSON(str);
  }

  /**
   * Compare two event streams for determinism verification.
   * Returns { ok:boolean, diffIndex:number, reason:string }.
   */
  static compareEvents(a, b) {
    const ea = a instanceof BattleLog ? a.events : a;
    const eb = b instanceof BattleLog ? b.events : b;
    const n = Math.min(ea.length, eb.length);
    for (let i = 0; i < n; i++) {
      const x = ea[i];
      const y = eb[i];
      if (x.tick !== y.tick || x.type !== y.type) {
        return {
          ok: false,
          diffIndex: i,
          reason:
            'event ' + i + ' mismatch: ' +
            '(' + x.tick + ',' + x.type + ') vs (' + y.tick + ',' + y.type + ')',
        };
      }
      if (!deepEqual(x.data, y.data)) {
        return {
          ok: false,
          diffIndex: i,
          reason: 'event ' + i + ' data mismatch (' + x.type + ')',
        };
      }
    }
    if (ea.length !== eb.length) {
      return {
        ok: false,
        diffIndex: n,
        reason: 'event count mismatch: ' + ea.length + ' vs ' + eb.length,
      };
    }
    return { ok: true, diffIndex: -1, reason: 'identical' };
  }
}

/* ------------------------------------------------------------------ */
/* Local deep-clone / deep-equal (no external deps; JSON-safe data).   */
/* ------------------------------------------------------------------ */

function cloneData(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = cloneData(v[i]);
    return out;
  }
  const out = {};
  for (const k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = cloneData(v[k]);
  }
  return out;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== 'object') {
    // numbers: treat NaN===NaN as equal for determinism auditing
    if (ta === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    return false;
  }
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    const k = ka[i];
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export { BATTLE_LOG_VERSION };
export default BattleLog;