import { WAVES, MAP, getUnitDef } from '../data/tables.js';
import { createUnit } from './entities.js';
import { emitEvent } from './core.js';

/**
 * Wave scheduler.
 *
 * Wave 0 is the pre-battle build phase: no wave is active and the player
 * may build freely. The player explicitly starts each wave (startNextWave),
 * which queues that wave's spawn schedule as absolute sim times. stepWaves
 * emits due spawns as attacker units on their lanes, detects when the wave
 * is fully cleared (no pending spawns and no live attackers), and sets
 * state.result = 'win' after the final wave is cleared.
 *
 * Fully deterministic: spawn schedule is derived only from the wave table
 * and the sim time at which the wave was started; spawn order for identical
 * times is stable (sequence-number tiebreak).
 */

function spawnPointForLane(map, lane) {
  if (lane === 'water') return map.spawnWater;
  if (lane === 'air') return map.spawnAir;
  return map.spawnGround;
}

/**
 * Create the wave sub-state.
 * @param {Array} waveTable - WAVES table from data/tables.js
 * @returns {{current:number,total:number,active:boolean,pendingSpawns:Array,cleared:boolean}}
 */
export function initWaves(waveTable) {
  const table = Array.isArray(waveTable) ? waveTable : WAVES;
  return {
    current: 0,               // wave 0 = pre-battle build phase
    total: table.length,
    active: false,
    pendingSpawns: [],        // [{time, unitId, lane, seq}]
    cleared: false,
  };
}

/**
 * Begin the next wave: queues its spawn schedule at absolute sim times.
 * @param {object} state - SimState
 * @returns {boolean} false if a wave is already active or all waves are done
 */
export function startNextWave(state) {
  const w = state.waves;
  if (!w) return false;
  if (w.active) return false;
  if (w.current >= w.total) return false;

  const nextIndex = w.current; // zero-based index into table; wave numbers are 1-based
  const table = WAVES;
  const waveDef = table[nextIndex];
  if (!waveDef) return false;

  w.current = nextIndex + 1;
  w.active = true;
  w.cleared = false;
  w.pendingSpawns = [];

  let seq = 0;
  const now = state.time;
  const spawns = waveDef.spawns || [];
  for (let s = 0; s < spawns.length; s++) {
    const entry = spawns[s];
    // Validate the unit exists in the tables (throws on missing => surfaces
    // data errors immediately rather than mid-battle).
    getUnitDef(entry.unitId);
    const delay = entry.delay || 0;
    const interval = entry.interval || 0;
    const count = entry.count | 0;
    for (let i = 0; i < count; i++) {
      w.pendingSpawns.push({
        time: now + delay + i * interval,
        unitId: entry.unitId,
        lane: entry.lane,
        seq: seq++,
      });
    }
  }

  // Stable deterministic ordering: earliest time first, table order breaks ties.
  w.pendingSpawns.sort(function (a, b) {
    if (a.time !== b.time) return a.time - b.time;
    return a.seq - b.seq;
  });

  emitEvent(state, {
    type: 'wave',
    tick: state.tick,
    phase: 'start',
    wave: w.current,
    total: w.total,
  });

  return true;
}

function anyAttackersAlive(state) {
  if (!state.units) return false;
  for (const unit of state.units.values()) {
    if (unit.side === 'attacker' && unit.hp > 0) return true;
  }
  return false;
}

/**
 * Advance the wave scheduler one tick: emit due spawns, detect wave clear,
 * and set the win result after the final wave is cleared.
 * @param {object} state - SimState
 * @param {number} dt - fixed timestep seconds
 */
export function stepWaves(state, dt) {
  const w = state.waves;
  if (!w || !w.active) return;

  const map = state.map || MAP;

  // Emit all spawns whose scheduled time has arrived. pendingSpawns is
  // sorted, so we consume from the front.
  while (w.pendingSpawns.length > 0 && w.pendingSpawns[0].time <= state.time) {
    const spawn = w.pendingSpawns.shift();
    const pos = spawnPointForLane(map, spawn.lane);
    const unit = createUnit(
      state,
      spawn.unitId,
      1,
      { x: pos.x, y: pos.y },
      spawn.lane,
      'attacker'
    );
    // Ensure the unit is registered in the sim (createUnit may or may not
    // insert; Map.set is idempotent either way).
    if (unit && state.units && !state.units.has(unit.id)) {
      state.units.set(unit.id, unit);
    }
    emitEvent(state, {
      type: 'spawn',
      tick: state.tick,
      unitId: spawn.unitId,
      entityId: unit ? unit.id : null,
      lane: spawn.lane,
      wave: w.current,
      pos: { x: pos.x, y: pos.y },
    });
  }

  // Wave clear detection: all spawns emitted and no live attackers remain.
  if (w.pendingSpawns.length === 0 && !anyAttackersAlive(state)) {
    w.active = false;
    w.cleared = true;

    emitEvent(state, {
      type: 'wave',
      tick: state.tick,
      phase: 'clear',
      wave: w.current,
      total: w.total,
    });

    // Surviving the final wave = win (unless the base already died).
    if (w.current >= w.total && state.result === null) {
      state.result = 'win';
      emitEvent(state, {
        type: 'win',
        tick: state.tick,
        wave: w.current,
      });
    }
  }
}