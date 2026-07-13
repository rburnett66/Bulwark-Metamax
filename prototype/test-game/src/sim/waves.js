import { WAVES, MAP, getUnitDef } from '../data/tables.js';
import { createUnit, unitRadius } from './entities.js';
import { emitEvent, contactDistR, REST_RATIO } from './core.js';

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
  const table = state.waveTable || WAVES;   // the sim's OWN schedule (faction test / custom), not the global
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

  // SPACE OUT the queue per lane so no two units on the same lane materialize on the SAME tick and stack on the
  // single spawn cell ("stuck at spawn"). The gap SCALES WITH THE DEPARTING UNIT'S SPEED — a crawling heavy /
  // water-siege unit (speed ~0.39) needs far longer to clear the spawn cell than a fast one, and a flat gap left
  // those factions (esp. Water: two units at 0.39) stacking. Gap ≈ time for the previous unit to move ~0.85 cell,
  // clamped so a wave of slow units still enters at a reasonable cadence. Deterministic (schedule rebuilds
  // identically, speeds come from the tables) → replay-safe. Preserves unit composition/order; only nudges timing.
  // Gap = time for the departing unit to travel its own DIAMETER (+ a margin) and fully vacate the single spawn
  // cell, so both slow AND large units (e.g. Artillery/Heavy Tanks: radius ~0.42, speed ~0.39) clear before the
  // next appears. A flat clear-distance let big tanks pile because they never moved a full body-length in time.
  // MAX_GAP raised with the sprite-sized footprints: a Heavy Tank (radius 1.48, speed ~0.39) needs
  // several seconds to clear its own body off the spawn cell — the old 3s cap left big units stacking.
  const MIN_GAP = 0.5, MAX_GAP = 6.0;
  // clear distance = the SPRITE diameter (collision × REST_RATIO — the sim's rest spacing), not the raw
  // collision diameter: the space-based gate below holds at that boundary, so the schedule should too.
  const laneClearGap = (speed, radius) =>
    Math.max(MIN_GAP, Math.min(MAX_GAP, (2 * (radius || 0.3) * REST_RATIO + 0.25) / (speed || 1)));
  const lastByLane = {};
  for (let s = 0; s < w.pendingSpawns.length; s++) {
    const sp = w.pendingSpawns[s];
    const prev = lastByLane[sp.lane];
    if (prev != null) { const g = laneClearGap(prev.speed, prev.radius); if (sp.time < prev.time + g) sp.time = prev.time + g; }
    const def = getUnitDef(sp.unitId);
    lastByLane[sp.lane] = { time: sp.time, speed: def.speed || 1, radius: unitRadius(def) };
  }
  // Re-sort: pushing later spawns forward can reorder across lanes.
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
    faction: waveDef.faction || null,   // who's attacking — for the pre-wave announcement banner
  });

  return true;
}

// Is a live attacker body still covering this spawn point? Clear distance = the sim's REST distance
// (contactDistR: sprites just touching) — a unit must never materialize inside the boundary the contact
// clamp maintains, or it enters the world already "slammed" into the leaver.
function spawnBlocked(state, pos, unitId) {
  if (!state.units) return false;
  const rNew = unitRadius(getUnitDef(unitId));
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0 || u.side !== 'attacker') continue;
    const dx = u.pos.x - pos.x, dy = u.pos.y - pos.y;
    const clear = contactDistR(u.radius || 0.3, rNew);
    if (dx * dx + dy * dy < clear * clear) return true;
  }
  return false;
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
  // SPACE-BASED GATE: the scheduled gap assumes the previous unit marches off at full speed, but a
  // downstream jam backs the column up INTO the spawn cell — and a time-based gap then materializes
  // units inside the queue (the pile-up). If a live body still physically covers the spawn point,
  // HOLD that lane's spawn and retry next tick. Deterministic (pure sim state), replay-safe.
  const heldLanes = {};
  while (w.pendingSpawns.length > 0 && w.pendingSpawns[0].time <= state.time) {
    const head = w.pendingSpawns[0];
    if (heldLanes[head.lane]) break;                    // keep in-lane order; other lanes drained already
    const headPos = spawnPointForLane(map, head.lane);
    // ground only: water/air spawns spread laterally, so their base point being covered is normal
    if (head.lane === 'ground' && spawnBlocked(state, headPos, head.unitId)) {
      heldLanes[head.lane] = true;
      // Push the whole lane's schedule back so relative gaps survive the hold.
      for (let i = 0; i < w.pendingSpawns.length; i++) {
        if (w.pendingSpawns[i].lane === head.lane && w.pendingSpawns[i].time <= state.time) {
          w.pendingSpawns[i].time = state.time + dt;
        }
      }
      w.pendingSpawns.sort(function (a, b) { return (a.time - b.time) || (a.seq - b.seq); });
      continue;
    }
    const spawn = w.pendingSpawns.shift();
    const pos = headPos;
    let sx = pos.x, sy = pos.y;
    // WATER / AIR lanes spawn from a single cell but travel by straight-line getFlyerPath (they ignore terrain),
    // so — unlike ground units, which re-converge onto a shared route — a lateral spawn offset PERSISTS and pulls
    // them apart. This clears the worst congestion on the 1-cell-wide water channel, where a crawling siege unit
    // otherwise plugs everything behind it. Offset cycles by spawn sequence (deterministic → replay-safe) and is
    // clamped to the board. Ground keeps the single spawn point (its routes would just re-stack an offset).
    if (spawn.lane !== 'ground') {
      const bp = state.base ? state.base.pos : { x: pos.x + 1, y: pos.y };
      const ldx = bp.x - pos.x, ldy = bp.y - pos.y, ll = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
      const perpx = -ldy / ll, perpy = ldx / ll;
      const SPREAD = [0, 1.2, -1.2, 2.4, -2.4, 0.6, -0.6, 1.8, -1.8];
      const off = SPREAD[(spawn.seq || 0) % SPREAD.length];
      sx = Math.max(0, Math.min((map.cols || 1) - 1, pos.x + perpx * off));
      sy = Math.max(0, Math.min((map.rows || 1) - 1, pos.y + perpy * off));
    }
    const unit = createUnit(
      state,
      spawn.unitId,
      1,
      { x: sx, y: sy },
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