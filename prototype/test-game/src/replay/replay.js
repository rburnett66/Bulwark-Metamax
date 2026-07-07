import { createSimCore } from '../sim/simCore.js';

// Re-drives the headless core from a battle log and asserts determinism.
// A battle log is expected to contain:
//   { seed, config, commands: [{tick, command}], events: [...], finalHash }
// We replay by feeding the recorded commands at the same ticks and comparing
// the resulting event stream / final state hash to the recorded one.

function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== 'object') {
      if (typeof v === 'number') {
        // normalize -0 and clamp float noise for stable hashing
        if (Object.is(v, -0)) return '0';
        return String(v);
      }
      return JSON.stringify(v);
    }
    if (seen.has(v)) return '"[circular]"';
    seen.add(v);
    if (Array.isArray(v)) {
      return '[' + v.map(walk).join(',') + ']';
    }
    const keys = Object.keys(v).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + walk(v[k])).join(',') + '}';
  };
  return walk(value);
}

// FNV-1a 32-bit hash over a string
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

export function hashState(world) {
  // Snapshot only the deterministic sim-relevant fields.
  const snap = extractDeterministicSnapshot(world);
  return fnv1a(stableStringify(snap));
}

function num(x) {
  if (typeof x !== 'number') return x;
  // Round to reduce accumulated float drift being an issue; sim is deterministic
  // so identical runs produce identical floats — rounding is just defensive.
  return Math.round(x * 1e6) / 1e6;
}

function extractDeterministicSnapshot(world) {
  if (!world) return null;
  const s = world.state || world;
  const out = {
    tick: s.tick,
    time: num(s.time),
    seed: s.seed,
    rngState: s.rng && typeof s.rng.getState === 'function' ? s.rng.getState() : s.rngState,
    economy: s.economy
      ? { gold: num(s.economy.gold), spent: num(s.economy.spent), earned: num(s.economy.earned), bankrupt: !!s.economy.bankrupt }
      : undefined,
    base: s.base ? { hp: num(s.base.hp), x: num(s.base.x), y: num(s.base.y), dead: !!s.base.dead } : undefined,
    wave: s.waves
      ? { current: s.waves.current, active: !!s.waves.active, spawnedThisWave: s.waves.spawnedThisWave, totalWaves: s.waves.totalWaves }
      : undefined,
    status: s.status || s.gameStatus,
    entities: [],
    structures: [],
    projectiles: [],
  };

  const list = (arr) => (Array.isArray(arr) ? arr : []);

  for (const e of list(s.entities || s.units)) {
    out.entities.push({
      id: e.id,
      kind: e.kind,
      domain: e.domain,
      x: num(e.x),
      y: num(e.y),
      alt: num(e.altitude != null ? e.altitude : e.alt),
      hp: num(e.hp),
      dead: !!e.dead,
      target: e.targetId != null ? e.targetId : (e.target && e.target.id),
      pathIdx: e.pathIndex != null ? e.pathIndex : e.pathIdx,
    });
  }

  for (const st of list(s.structures)) {
    out.structures.push({
      id: st.id,
      kind: st.kind,
      x: num(st.x),
      y: num(st.y),
      tier: st.tier,
      hp: num(st.hp),
      state: st.state,
      buildT: num(st.buildTimer),
      cooldown: num(st.cooldown),
      target: st.targetId != null ? st.targetId : (st.target && st.target.id),
      dead: !!st.dead,
    });
  }

  for (const p of list(s.projectiles)) {
    out.projectiles.push({
      id: p.id,
      x: num(p.x),
      y: num(p.y),
      targetId: p.targetId != null ? p.targetId : (p.target && p.target.id),
      dmg: num(p.damage),
      dead: !!p.dead,
    });
  }

  // Deterministic ordering
  out.entities.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
  out.structures.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
  out.projectiles.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));

  return out;
}

// Group recorded commands by the tick they were applied on.
function indexCommandsByTick(commands) {
  const byTick = new Map();
  for (const rec of commands || []) {
    const t = rec.tick != null ? rec.tick : (rec.t != null ? rec.t : 0);
    const cmd = rec.command != null ? rec.command : rec.cmd != null ? rec.cmd : rec;
    if (!byTick.has(t)) byTick.set(t, []);
    byTick.get(t).push(cmd);
  }
  return byTick;
}

/**
 * Replays a battle log through a fresh headless sim core and verifies that
 * the produced event stream and final state match the recorded values.
 *
 * @param {object} log  battleLog.serialize() output
 * @param {object} [opts]
 * @param {number} [opts.maxTicks]  safety cap
 * @returns {object} result with { ok, reason, hashMatch, eventMatch, replayHash, recordedHash, ... }
 */
export function replay(log, opts = {}) {
  if (!log || typeof log !== 'object') {
    return { ok: false, reason: 'no-log' };
  }

  const seed = log.seed != null ? log.seed : 0;
  const config = log.config;
  const byTick = indexCommandsByTick(log.commands);

  // Determine how far to run.
  let lastTick = 0;
  for (const rec of log.commands || []) {
    const t = rec.tick != null ? rec.tick : rec.t != null ? rec.t : 0;
    if (t > lastTick) lastTick = t;
  }
  const recordedEndTick = log.endTick != null ? log.endTick : lastTick;
  const maxTicks = opts.maxTicks != null ? opts.maxTicks : Math.max(recordedEndTick + 1, 200000);

  // Fresh sim core, deterministic from seed.
  const core = createSimCore({ seed, config });
  const world = core.world || core;

  const replayEvents = [];
  // Hook into world event emission if available.
  const collectEvents = () => {
    const s = world.state || world;
    if (Array.isArray(s.events)) {
      for (const ev of s.events) replayEvents.push(ev);
      s.events.length = 0;
    }
  };

  let tick = 0;
  let terminated = false;

  // Apply any commands recorded before the first step (tick 0).
  const applyForTick = (t) => {
    const cmds = byTick.get(t);
    if (!cmds) return;
    for (const cmd of cmds) {
      if (typeof core.applyCommand === 'function') core.applyCommand(cmd);
      else if (typeof world.applyCommand === 'function') world.applyCommand(cmd);
      else if (typeof world.dispatch === 'function') world.dispatch(cmd);
    }
  };

  applyForTick(0);
  collectEvents();

  while (tick < maxTicks) {
    // Advance one deterministic tick.
    if (typeof core.step === 'function') core.step();
    else if (typeof world.step === 'function') world.step();
    tick++;

    // Commands recorded at this tick are applied after the step boundary,
    // matching battleLog's record-at-tick convention (input applied at tick N
    // is queued for the reducer before that tick's systems; we mirror by
    // applying before the NEXT step). To keep this exact, apply for the
    // now-current tick prior to using its state.
    applyForTick(tick);
    collectEvents();

    const s = world.state || world;
    const status = s.status || s.gameStatus;
    if (status === 'win' || status === 'lose' || s.done === true) {
      terminated = true;
      // Continue to honor recorded end tick if it extends beyond, but a
      // terminal state is deterministic — stop here unless more commands remain.
      if (tick >= recordedEndTick) break;
    }
    if (tick >= recordedEndTick && recordedEndTick > 0) break;
  }

  const replayHash = hashState(world);
  const recordedHash = log.finalHash != null ? log.finalHash : log.stateHash;

  // Compare event streams if the log recorded them.
  const recordedEvents = Array.isArray(log.events) ? log.events : null;
  let eventMatch = true;
  let eventDiffIndex = -1;
  if (recordedEvents) {
    const norm = (e) => stableStringify(normalizeEvent(e));
    const a = replayEvents.map(norm);
    const b = recordedEvents.map(norm);
    if (a.length !== b.length) {
      eventMatch = false;
      eventDiffIndex = Math.min(a.length, b.length);
    } else {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          eventMatch = false;
          eventDiffIndex = i;
          break;
        }
      }
    }
  }

  const hashMatch = recordedHash == null ? null : replayHash === recordedHash;

  const ok = (hashMatch === null || hashMatch === true) && eventMatch;

  return {
    ok,
    reason: ok ? 'deterministic' : 'divergence',
    hashMatch,
    eventMatch,
    eventDiffIndex,
    replayHash,
    recordedHash,
    ticks: tick,
    terminated,
    replayEventCount: replayEvents.length,
    recordedEventCount: recordedEvents ? recordedEvents.length : null,
    finalStatus: (world.state || world).status || (world.state || world).gameStatus,
  };
}

function normalizeEvent(e) {
  if (!e || typeof e !== 'object') return e;
  // Strip presentation-only / non-deterministic fields if any leaked in.
  const { renderHint, _dbg, wallTime, ...rest } = e;
  return rest;
}

/**
 * Convenience: run a full battle twice from the same seed/commands and prove
 * both runs are identical (does not require a pre-recorded log).
 */
export function proveDeterminism({ seed = 0, config, commands = [], maxTicks } = {}) {
  const makeLog = () => ({ seed, config, commands, events: null });
  const run = (log) => {
    const r = replay(log, { maxTicks });
    return r;
  };
  const a = run(makeLog());
  const b = run(makeLog());
  return {
    ok: a.replayHash === b.replayHash,
    hashA: a.replayHash,
    hashB: b.replayHash,
    ticksA: a.ticks,
    ticksB: b.ticks,
  };
}

export default replay;