import { createSim, applyCommand, stepSim, FIXED_DT } from './core.js';

/**
 * Battle log + replay support.
 *
 * A BattleLog is the complete ordered record of a session:
 *   { seed, commands: [{tick, cmd}], finalHash }
 *
 * Replays re-drive the headless sim core (createSim/applyCommand/stepSim)
 * from the log and prove determinism by comparing FNV-1a state hashes.
 */

const MAX_REPLAY_TICKS = 1000000; // safety cap (~9 hours of sim time)

/**
 * Create an empty battle log for a fresh session.
 * @param {number} seed
 * @returns {{seed:number, commands:Array<{tick:number, cmd:object}>, finalHash:string|null}}
 */
export function createLog(seed) {
  return {
    seed: seed | 0,
    commands: [],
    finalHash: null,
  };
}

/**
 * Append an accepted command with its tick to the log.
 * @param {object} log BattleLog
 * @param {number} tick
 * @param {object} cmd
 */
export function recordCommand(log, tick, cmd) {
  if (!log || !Array.isArray(log.commands)) return;
  log.commands.push({ tick: tick | 0, cmd: JSON.parse(JSON.stringify(cmd)) });
}

/**
 * Serialize a battle log to a JSON string for export.
 * @param {object} log BattleLog
 * @returns {string}
 */
export function serializeLog(log) {
  return JSON.stringify(
    {
      version: 1,
      seed: log.seed,
      commands: log.commands,
      finalHash: log.finalHash || null,
    },
    null,
    2
  );
}

/**
 * Parse an exported battle log JSON string.
 * @param {string} json
 * @returns {object} BattleLog
 */
export function deserializeLog(json) {
  const raw = JSON.parse(json);
  if (raw == null || typeof raw !== 'object') {
    throw new Error('replay: invalid log JSON');
  }
  const seed = Number(raw.seed);
  if (!Number.isFinite(seed)) {
    throw new Error('replay: log missing numeric seed');
  }
  const commands = Array.isArray(raw.commands)
    ? raw.commands
        .filter((c) => c && typeof c === 'object' && c.cmd && typeof c.cmd === 'object')
        .map((c) => ({ tick: Number(c.tick) | 0, cmd: c.cmd }))
    : [];
  // Keep stable order by tick (commands recorded during play are already
  // ordered, but be defensive about hand-edited logs).
  commands.sort((a, b) => a.tick - b.tick);
  return {
    seed: seed | 0,
    commands,
    finalHash: typeof raw.finalHash === 'string' ? raw.finalHash : null,
  };
}

// ---------------------------------------------------------------------------
// FNV-1a hashing
// ---------------------------------------------------------------------------

function fnv1aInit() {
  return 0x811c9dc5;
}

function fnv1aString(h, str) {
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  // separator between fields so "ab","c" differs from "a","bc"
  h ^= 0x1f;
  h = Math.imul(h, 0x01000193);
  return h;
}

function numStr(n) {
  if (n == null || !Number.isFinite(n)) return 'x';
  // Quantize to avoid printing representation quirks while remaining
  // deterministic (the sim itself is deterministic, so equal runs produce
  // bit-identical values; quantization only shortens the strings).
  return (Math.round(n * 4096) / 4096).toString();
}

/**
 * Deterministic FNV-1a hash over tick, rng state, money, base hp, and all
 * entity positions/hp. Entities are visited in ascending id order so the
 * hash is independent of Map insertion quirks.
 * @param {object} state SimState
 * @returns {string} 8-char hex hash
 */
export function hashState(state) {
  let h = fnv1aInit();

  h = fnv1aString(h, 't' + (state.tick | 0));

  let rngState = 0;
  if (state.rng && typeof state.rng.getState === 'function') {
    rngState = state.rng.getState();
  }
  h = fnv1aString(h, 'r' + numStr(rngState));

  const money = state.economy ? state.economy.money : 0;
  h = fnv1aString(h, 'm' + numStr(money));

  const baseHp = state.base ? state.base.hp : 0;
  h = fnv1aString(h, 'b' + numStr(baseHp));

  // Units (sorted by id)
  if (state.units) {
    const ids = [];
    state.units.forEach((_, id) => ids.push(id));
    ids.sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      const u = state.units.get(ids[i]);
      if (!u) continue;
      h = fnv1aString(
        h,
        'u' + ids[i] + ':' + numStr(u.pos && u.pos.x) + ',' + numStr(u.pos && u.pos.y) + ':' + numStr(u.hp)
      );
    }
  }

  // Structures (sorted by id)
  if (state.structures) {
    const ids = [];
    state.structures.forEach((_, id) => ids.push(id));
    ids.sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      const s = state.structures.get(ids[i]);
      if (!s) continue;
      h = fnv1aString(
        h,
        's' + ids[i] + ':' + numStr(s.pos && s.pos.x) + ',' + numStr(s.pos && s.pos.y) + ':' + numStr(s.hp) + ':' + (s.tier | 0) + ':' + (s.lifecycle || '')
      );
    }
  }

  // Campaign resource nodes + harvester cargo (absent on classic maps → their hashes are unchanged).
  if (state.resourceNodes) {
    for (let i = 0; i < state.resourceNodes.length; i++) {
      const n = state.resourceNodes[i];
      h = fnv1aString(h, 'n' + n.id + ':' + numStr(n.remaining));
    }
    for (const hid of state.harvesterIds || []) {
      const hv = state.units ? state.units.get(hid) : null;
      if (hv) h = fnv1aString(h, 'hc' + hid + ':' + numStr(hv.cargo) + ':' + numStr(hv.cargoValue));
    }
  }

  if (state.result) {
    h = fnv1aString(h, 'w' + state.result);
  }

  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Headless replay
// ---------------------------------------------------------------------------

/**
 * Headlessly re-drive the sim from a battle log.
 *
 * Runs createSim(log.seed), applying each logged command at its recorded
 * tick and stepping with FIXED_DT. Stops at `untilTick` if given; otherwise
 * runs until all commands are consumed and the sim reaches a result (or a
 * safety cap).
 *
 * @param {object} log BattleLog
 * @param {number} [untilTick]
 * @param {(state:object)=>void} [onTick]
 * @returns {{state:object, hash:string, matches:boolean|null}}
 */
export function runReplay(log, untilTick, onTick) {
  const state = createSim(log.seed);

  const commands = (log.commands || []).slice().sort((a, b) => a.tick - b.tick);
  let cmdIdx = 0;
  const lastCmdTick = commands.length ? commands[commands.length - 1].tick : -1;

  const hasLimit = typeof untilTick === 'number' && Number.isFinite(untilTick);
  const limit = hasLimit ? Math.max(0, untilTick | 0) : MAX_REPLAY_TICKS;

  while (state.tick < limit) {
    // Apply every command recorded for the current tick before stepping.
    while (cmdIdx < commands.length && commands[cmdIdx].tick <= state.tick) {
      applyCommand(state, commands[cmdIdx].cmd);
      cmdIdx++;
    }

    stepSim(state, FIXED_DT);

    if (typeof onTick === 'function') {
      onTick(state);
    }

    // Without an explicit limit, stop once the battle resolved and all
    // recorded commands have been consumed.
    if (!hasLimit && state.result !== null && state.tick > lastCmdTick) {
      break;
    }
  }

  const hash = hashState(state);
  const matches = log.finalHash ? hash === log.finalHash : null;

  return { state, hash, matches };
}