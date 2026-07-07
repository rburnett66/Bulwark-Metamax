// src/sim/waves.js
// Wave spawning, wave counter, win-on-survive / lose-on-base-death.
// Deterministic: consumes sim.rng and reads wave definitions from state.
// Integrates with spawn/entities via injected factory (state.spawnAttacker) or
// falls back to entities factory if present.

import { CONFIG } from '../config/constants.js';

/**
 * The waves system owns:
 *  - wave counter / phase (idle, spawning, active, won, lost)
 *  - spawning attackers over time from wave definitions
 *  - checking win-on-survive (all waves cleared) and lose-on-base-death
 *
 * State shape (see state.js):
 *   state.waves = {
 *     definitions: [ { units:[{unitId, count, domain, delay, interval, hp?, ...}], ... } ],
 *     current: -1,           // index of currently running wave (-1 = none started)
 *     count: 0,              // number of waves started
 *     total: N,              // total waves to survive
 *     phase: 'idle'|'spawning'|'active'|'won'|'lost',
 *     spawnQueue: [],        // pending spawn orders
 *     spawnTimer: 0,
 *     autoNext: false,
 *     timeSinceCleared: 0,
 *   }
 */

export const WavePhase = Object.freeze({
  IDLE: 'idle',
  SPAWNING: 'spawning',
  ACTIVE: 'active',
  WON: 'won',
  LOST: 'lost',
});

/**
 * Initialize / normalize the waves substate on a fresh sim state.
 * definitions: array of wave defs (from verticalSlice data).
 */
export function initWaves(state, definitions) {
  const defs = Array.isArray(definitions) ? definitions : [];
  state.waves = {
    definitions: defs,
    current: -1,
    count: 0,
    total: defs.length,
    phase: WavePhase.IDLE,
    spawnQueue: [],
    spawnTimer: 0,
    autoNext: false,
    timeSinceCleared: 0,
    // grace time between "field cleared" and win check confirming (seconds)
    clearGrace: (CONFIG && CONFIG.waves && CONFIG.waves.clearGrace) || 0.25,
  };
  return state.waves;
}

/**
 * Whether a new wave can be started right now.
 */
export function canStartWave(state) {
  const w = state.waves;
  if (!w) return false;
  if (w.phase === WavePhase.WON || w.phase === WavePhase.LOST) return false;
  if (w.phase === WavePhase.SPAWNING || w.phase === WavePhase.ACTIVE) return false;
  return w.current + 1 < w.definitions.length;
}

/**
 * Start the next wave. Builds a deterministic spawn queue from the definition.
 * Returns true if a wave was started.
 */
export function startWave(state) {
  const w = state.waves;
  if (!canStartWave(state)) return false;

  w.current += 1;
  w.count += 1;
  w.phase = WavePhase.SPAWNING;
  w.spawnTimer = 0;
  w.timeSinceCleared = 0;

  const def = w.definitions[w.current] || {};
  const groups = Array.isArray(def.units) ? def.units : [];

  const queue = [];
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    const count = grp.count || 1;
    const delay = grp.delay || 0;      // delay before first spawn of this group
    const interval = grp.interval != null ? grp.interval : 0.75; // between spawns
    for (let i = 0; i < count; i++) {
      queue.push({
        time: delay + i * interval,
        unitId: grp.unitId,
        domain: grp.domain,           // walker | floater | flyer (optional override)
        tier: grp.tier || 1,
        targetsBase: grp.targetsBase,
        overrides: grp.overrides || null,
        groupIndex: g,
      });
    }
  }
  // Deterministic order: by time, then group, then original order.
  queue.forEach((q, idx) => { q._seq = idx; });
  queue.sort((a, b) => (a.time - b.time) || (a.groupIndex - b.groupIndex) || (a._seq - b._seq));

  w.spawnQueue = queue;

  // Log the wave start event if a log stream exists.
  if (state.log && typeof state.log.event === 'function') {
    state.log.event('waveStart', { wave: w.current, count: queue.length });
  }
  return true;
}

/**
 * Count live attacker entities on the field.
 */
function liveAttackers(state) {
  let n = 0;
  const ents = state.entities || [];
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (!e) continue;
    if (e.dead) continue;
    if (e.faction === 'attacker' || e.side === 'attacker' || e.isAttacker) {
      if (e.hp > 0) n++;
    }
  }
  return n;
}

/**
 * Resolve the attacker spawn callback. Priority:
 *  1) state.spawnAttacker (wired by main.js/spawn.js)
 *  2) injected via options.spawn
 */
function resolveSpawner(state, opts) {
  if (opts && typeof opts.spawn === 'function') return opts.spawn;
  if (typeof state.spawnAttacker === 'function') return state.spawnAttacker;
  return null;
}

/**
 * Perform a single spawn order deterministically.
 */
function doSpawn(state, order, spawner) {
  if (!spawner) return null;
  const ent = spawner(state, {
    unitId: order.unitId,
    domain: order.domain,
    tier: order.tier,
    targetsBase: order.targetsBase,
    overrides: order.overrides,
    wave: state.waves.current,
  });
  if (ent && state.log && typeof state.log.event === 'function') {
    state.log.event('spawn', {
      wave: state.waves.current,
      unitId: order.unitId,
      id: ent.id != null ? ent.id : undefined,
    });
  }
  return ent;
}

/**
 * Advance the wave system by dt seconds. Call once per fixed sim step,
 * AFTER combat has applied damage (so base HP is current) but ordering is
 * managed by step.js. Reads/writes only wave substate + spawns entities.
 */
export function stepWaves(state, dt, opts) {
  const w = state.waves;
  if (!w) return;
  if (w.phase === WavePhase.WON || w.phase === WavePhase.LOST) return;

  // Lose condition: base HP depleted (checked every step).
  if (isBaseDead(state)) {
    setLost(state);
    return;
  }

  const spawner = resolveSpawner(state, opts);

  if (w.phase === WavePhase.SPAWNING) {
    w.spawnTimer += dt;
    // Emit all spawns whose scheduled time has elapsed (deterministic order).
    while (w.spawnQueue.length > 0 && w.spawnQueue[0].time <= w.spawnTimer + 1e-9) {
      const order = w.spawnQueue.shift();
      doSpawn(state, order, spawner);
    }
    if (w.spawnQueue.length === 0) {
      w.phase = WavePhase.ACTIVE;
      w.timeSinceCleared = 0;
    }
  }

  if (w.phase === WavePhase.ACTIVE) {
    const alive = liveAttackers(state);
    if (alive === 0) {
      w.timeSinceCleared += dt;
      if (w.timeSinceCleared >= w.clearGrace) {
        onWaveCleared(state);
      }
    } else {
      w.timeSinceCleared = 0;
    }
  }
}

/**
 * Called when the active wave has no live attackers left.
 */
function onWaveCleared(state) {
  const w = state.waves;
  if (state.log && typeof state.log.event === 'function') {
    state.log.event('waveCleared', { wave: w.current });
  }

  // Win condition: this was the last wave.
  if (w.current + 1 >= w.definitions.length) {
    setWon(state);
    return;
  }

  // Otherwise return to idle; player (or auto) starts the next wave.
  w.phase = WavePhase.IDLE;
  w.timeSinceCleared = 0;

  if (w.autoNext) {
    startWave(state);
  }
}

/**
 * Base death detection. Base entity is flagged isBase (from entities.js).
 */
export function isBaseDead(state) {
  const base = getBase(state);
  if (!base) return false;
  return base.hp <= 0 || base.dead === true;
}

export function getBase(state) {
  if (state.base) return state.base;
  const ents = state.entities || [];
  for (let i = 0; i < ents.length; i++) {
    if (ents[i] && ents[i].isBase) return ents[i];
  }
  return null;
}

function setWon(state) {
  const w = state.waves;
  w.phase = WavePhase.WON;
  state.outcome = 'win';
  if (state.log && typeof state.log.event === 'function') {
    state.log.event('gameWon', { wave: w.current });
  }
}

function setLost(state) {
  const w = state.waves;
  w.phase = WavePhase.LOST;
  state.outcome = 'lose';
  if (state.log && typeof state.log.event === 'function') {
    state.log.event('gameLost', { wave: w.current });
  }
}

/**
 * Convenience status readout for the HUD.
 */
export function waveStatus(state) {
  const w = state.waves;
  if (!w) {
    return { current: 0, total: 0, phase: WavePhase.IDLE, alive: 0, canStart: false, outcome: null };
  }
  return {
    current: w.current + 1,       // 1-based for display
    started: w.count,
    total: w.total,
    phase: w.phase,
    alive: liveAttackers(state),
    pending: w.spawnQueue.length,
    canStart: canStartWave(state),
    outcome: state.outcome || null,
    autoNext: w.autoNext,
  };
}

export function setAutoNext(state, on) {
  if (state.waves) state.waves.autoNext = !!on;
}

export const Waves = {
  init: initWaves,
  start: startWave,
  step: stepWaves,
  canStart: canStartWave,
  status: waveStatus,
  isBaseDead,
  getBase,
  setAutoNext,
  Phase: WavePhase,
};

export default Waves;