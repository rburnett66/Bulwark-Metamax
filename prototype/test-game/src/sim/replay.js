class ReplayDriver {
  constructor(deps) {
    // deps: { makeSim, commands, log }
    // makeSim(seed) -> fresh sim instance with .step(dt) and .state
    this.makeSim = deps.makeSim;
    this.commands = deps.commands;
    this.logModule = deps.log;
  }

  // Re-drive a fresh headless core from a serialized log and produce
  // the final deterministic state hash + per-checkpoint hashes.
  replay(logData) {
    const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
    const seed = log.seed >>> 0;
    const dt = log.dt || (1 / 30);
    const sim = this.makeSim(seed);

    // Build a tick->commands lookup from the ordered input stream.
    const inputsByTick = new Map();
    for (const entry of (log.inputs || [])) {
      const t = entry.tick | 0;
      if (!inputsByTick.has(t)) inputsByTick.set(t, []);
      inputsByTick.get(t).push(entry);
    }

    const totalTicks = log.finalTick | 0;
    const checkpoints = [];
    const checkpointEvery = log.checkpointEvery || 60;

    for (let tick = 0; tick <= totalTicks; tick++) {
      // Apply all inputs scheduled at this tick BEFORE stepping.
      const cmds = inputsByTick.get(tick);
      if (cmds) {
        for (const c of cmds) {
          this.applyCommand(sim, c);
        }
      }
      // Advance one fixed step.
      if (tick < totalTicks) sim.step(dt);

      if (tick % checkpointEvery === 0) {
        checkpoints.push({ tick, hash: this.hashState(sim.state) });
      }
    }

    return {
      seed,
      finalTick: totalTicks,
      finalHash: this.hashState(sim.state),
      checkpoints,
      state: sim.state,
    };
  }

  applyCommand(sim, entry) {
    // entry: { type, ...args }
    if (this.commands && typeof this.commands.apply === 'function') {
      this.commands.apply(sim, entry);
      return;
    }
    // Fallback: direct dispatch if commands module exposes named handlers.
    if (this.commands && typeof this.commands[entry.type] === 'function') {
      this.commands[entry.type](sim, entry);
    }
  }

  // Verify a live-recorded log reproduces the recorded final hash.
  verify(logData) {
    const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
    const recordedHash = log.finalHash != null ? (log.finalHash >>> 0) : null;
    const result = this.replay(log);
    const ok = recordedHash == null ? true : (result.finalHash === recordedHash);

    // Also verify per-checkpoint hashes if the log carried them.
    let checkpointOk = true;
    let mismatchTick = -1;
    if (Array.isArray(log.checkpoints) && log.checkpoints.length) {
      const byTick = new Map();
      for (const cp of result.checkpoints) byTick.set(cp.tick, cp.hash);
      for (const rec of log.checkpoints) {
        const got = byTick.get(rec.tick);
        if (got == null) continue;
        if ((got >>> 0) !== (rec.hash >>> 0)) {
          checkpointOk = false;
          mismatchTick = rec.tick;
          break;
        }
      }
    }

    return {
      deterministic: ok && checkpointOk,
      hashMatch: ok,
      checkpointMatch: checkpointOk,
      mismatchTick,
      recordedHash,
      computedHash: result.finalHash,
      result,
    };
  }

  // Run the same sim twice from the same seed + input log and confirm
  // both runs produce identical final hashes (pure determinism proof).
  selfTest(logData) {
    const a = this.replay(logData);
    const b = this.replay(logData);
    return {
      deterministic: a.finalHash === b.finalHash,
      hashA: a.finalHash,
      hashB: b.finalHash,
    };
  }

  // ---- Deterministic state hashing (order-stable FNV-1a over 32-bit) ----

  hashState(state) {
    const h = new Hasher();
    this._hashState(h, state);
    return h.value >>> 0;
  }

  _hashState(h, s) {
    if (!s) { h.pushInt(0); return; }

    // Base
    if (s.base) {
      h.pushStr('base');
      h.pushFloat(s.base.x);
      h.pushFloat(s.base.y);
      h.pushFloat(s.base.hp);
      h.pushInt(s.base.level | 0);
    }

    // Economy
    if (s.economy) {
      h.pushStr('econ');
      h.pushFloat(s.economy.money);
      h.pushInt((s.economy.bankrupt ? 1 : 0));
    } else if (s.money != null) {
      h.pushStr('money');
      h.pushFloat(s.money);
    }

    // Waves
    if (s.waves) {
      h.pushStr('waves');
      h.pushInt(s.waves.current | 0);
      h.pushInt(s.waves.total | 0);
      h.pushInt(s.waves.active ? 1 : 0);
      h.pushFloat(s.waves.spawnTimer || 0);
      h.pushInt(s.waves.spawnIndex | 0);
    }

    // Win / lose
    h.pushStr('outcome');
    h.pushInt(s.won ? 1 : 0);
    h.pushInt(s.lost ? 1 : 0);
    h.pushInt(s.gameOver ? 1 : 0);

    // Time / tick
    h.pushInt((s.tick != null ? s.tick : 0) | 0);

    // RNG internal state (critical for determinism)
    if (s.rng && s.rng.state != null) {
      h.pushStr('rng');
      h.pushInt(s.rng.state >>> 0);
    }

    // Entities: hash in a stable order by id.
    const ents = this._collectEntities(s);
    ents.sort((a, b) => {
      const ia = a.id, ib = b.id;
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return 0;
    });
    h.pushStr('entities');
    h.pushInt(ents.length);
    for (const e of ents) this._hashEntity(h, e);
  }

  _collectEntities(s) {
    const out = [];
    const push = (arr) => {
      if (!arr) return;
      if (Array.isArray(arr)) { for (const e of arr) if (e) out.push(e); }
      else if (typeof arr === 'object') {
        for (const k of Object.keys(arr)) { const e = arr[k]; if (e) out.push(e); }
      }
    };
    push(s.entities);
    push(s.attackers);
    push(s.units);
    push(s.structures);
    push(s.towers);
    push(s.walls);
    push(s.troops);
    push(s.projectiles);
    return out;
  }

  _hashEntity(h, e) {
    h.pushStr(String(e.id != null ? e.id : ''));
    h.pushStr(String(e.kind != null ? e.kind : ''));
    h.pushStr(String(e.type != null ? e.type : ''));
    h.pushStr(String(e.domain != null ? e.domain : ''));
    h.pushStr(String(e.state != null ? e.state : ''));
    h.pushFloat(e.x);
    h.pushFloat(e.y);
    h.pushFloat(e.hp);
    h.pushInt(e.tier | 0);
    h.pushFloat(e.altitude || 0);
    h.pushInt(e.dead ? 1 : 0);
    // Target reference by id only (stable, avoids cycles).
    if (e.target && e.target.id != null) h.pushStr('t:' + e.target.id);
    else if (e.targetId != null) h.pushStr('t:' + e.targetId);
    else h.pushInt(0);
    // Timers that matter to lifecycle determinism.
    h.pushFloat(e.buildTimer || 0);
    h.pushFloat(e.upgradeTimer || 0);
    h.pushFloat(e.repairTimer || 0);
    h.pushFloat(e.cooldown || 0);
    h.pushFloat(e.pathProgress || 0);
    if (e.pathIndex != null) h.pushInt(e.pathIndex | 0);
  }
}

// FNV-1a 32-bit accumulator with quantized floats for cross-run stability.
class Hasher {
  constructor() {
    this.value = 0x811c9dc5 >>> 0;
    this._buf = new ArrayBuffer(4);
    this._f32 = new Float32Array(this._buf);
    this._u32 = new Uint32Array(this._buf);
  }

  _mix(byte) {
    this.value ^= (byte & 0xff);
    // FNV prime 16777619, kept in 32-bit
    this.value = Math.imul(this.value, 0x01000193) >>> 0;
  }

  pushInt(n) {
    let v = (n | 0) >>> 0;
    this._mix(v & 0xff);
    this._mix((v >>> 8) & 0xff);
    this._mix((v >>> 16) & 0xff);
    this._mix((v >>> 24) & 0xff);
  }

  pushFloat(f) {
    if (f == null || Number.isNaN(f)) { this.pushInt(0x7fc00000); return; }
    // Quantize to reduce float noise; sim is fixed-step deterministic
    // but this guards against harmless representational drift.
    const q = Math.round(f * 1024) / 1024;
    this._f32[0] = q;
    this.pushInt(this._u32[0]);
  }

  pushStr(str) {
    const s = String(str);
    this.pushInt(s.length);
    for (let i = 0; i < s.length; i++) {
      this._mix(s.charCodeAt(i) & 0xff);
      this._mix((s.charCodeAt(i) >>> 8) & 0xff);
    }
  }
}

export { ReplayDriver, Hasher };
export default ReplayDriver;

export function createReplayDriver(deps) {
  return new ReplayDriver(deps);
}

// Convenience: hash any state with a standalone hasher (no driver needed).
export function hashState(state) {
  const driver = new ReplayDriver({});
  return driver.hashState(state);
}