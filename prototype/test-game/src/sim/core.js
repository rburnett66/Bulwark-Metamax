import { TABLES } from '../data/tables.js';
import { mulberry32 } from './rng.js';
import { createGrid, isWalkable, canPlaceStructureAt, applyStructureTerrain, removeStructureTerrain, slotPositions } from './grid.js';
import { recomputePaths, pathFor, straightLinePath } from './pathing.js';
import { makeBase, makeUnit, makeStructure } from './entities.js';
import { updateStructures, tryPlaceStructure, tryUpgradeStructure, trySellStructure, tryRepairStructure } from './structures.js';
import { updateCombat } from './combat.js';
import { createWaveState, updateWaves, startWave } from './waves.js';
import { createEconomy, updateEconomy, canAfford, spend, addIncome } from './economy.js';
import { updateVision } from './vision.js';

// ---------------------------------------------------------------------------
// Headless deterministic sim core.
// Fixed timestep, pure serializable state, zero rendering dependencies.
// ---------------------------------------------------------------------------

export const TICK_RATE = 20;            // fixed sim ticks per second
export const DT = 1 / TICK_RATE;        // seconds per tick

export function createCore(seed, opts) {
  opts = opts || {};
  const rngState = { seed: seed >>> 0 };
  const grid = createGrid(TABLES);
  const state = {
    seed: seed >>> 0,
    tick: 0,
    time: 0,
    dt: DT,
    status: 'playing',              // 'playing' | 'won' | 'lost'
    nextId: 1,
    grid,
    base: null,
    units: [],                       // attacker + deployed friendly units
    structures: [],
    projectiles: [],
    repairJobs: [],
    economy: createEconomy(TABLES),
    waves: createWaveState(TABLES),
    events: [],                      // events emitted this tick (drained by log)
    pathsDirty: true,
    pathCache: {},
    rngCalls: 0,
    baseLevel: (TABLES.Assumptions && TABLES.Assumptions.Base_start_level) || 1,
  };
  state.base = makeBase(state, TABLES, grid);
  recomputePaths(state);
  state.pathsDirty = false;
  return state;
}

// Deterministic RNG bound to sim state -------------------------------------

export function rand(state) {
  // mulberry32 evolves state.seed-derived stream; keep stream in state for
  // full serializability.
  if (state._rngStream === undefined || state._rngStreamSeed !== state.seed) {
    state._rngStream = mulberry32(state.seed);
    state._rngStreamSeed = state.seed;
    // replay any consumed calls to restore stream position after deserialize
    for (let i = 0; i < (state.rngCalls | 0); i++) state._rngStream();
  }
  state.rngCalls = (state.rngCalls | 0) + 1;
  return state._rngStream();
}

export function randInt(state, n) {
  return Math.floor(rand(state) * n);
}

// Event helper ---------------------------------------------------------------

export function emit(state, type, data) {
  const ev = { tick: state.tick, type };
  if (data) for (const k in data) ev[k] = data[k];
  state.events.push(ev);
  return ev;
}

// ---------------------------------------------------------------------------
// Input command application. Every command is a plain serializable object:
//   { cmd: 'startWave' }
//   { cmd: 'place', kind: 'towerAG'|'towerAA'|'wall'|'moat', x, y }
//   { cmd: 'upgrade', id }
//   { cmd: 'sell', id }
//   { cmd: 'repair', id }
//   { cmd: 'deploy', unitId: 'GND-Troops', x, y }   (spawns at base, marches)
// Returns { ok, reason?, events }
// ---------------------------------------------------------------------------

export function applyCommand(state, cmd) {
  if (!cmd || state.status !== 'playing') {
    return { ok: false, reason: 'inactive' };
  }
  switch (cmd.cmd) {
    case 'startWave':
      return startWave(state);
    case 'place':
      return tryPlaceStructure(state, cmd.kind, cmd.x | 0, cmd.y | 0);
    case 'upgrade':
      return tryUpgradeStructure(state, cmd.id);
    case 'sell':
      return trySellStructure(state, cmd.id);
    case 'repair':
      return tryRepairStructure(state, cmd.id);
    case 'deploy':
      return deployTroop(state, cmd.unitId, cmd.x | 0, cmd.y | 0);
    default:
      return { ok: false, reason: 'unknown-command' };
  }
}

// Deploy friendly troop: spawns AT the base, marches to drop destination.
function deployTroop(state, unitId, tx, ty) {
  const def = TABLES.Units.find((u) => u.id === unitId);
  if (!def) return { ok: false, reason: 'unknown-unit' };
  const cost = def.cost1 !== undefined ? def.cost1 : def.cost;
  if (!canAfford(state.economy, cost)) return { ok: false, reason: 'insufficient-funds' };
  // deploy validity: destination must be inside board and traversable for domain
  const g = state.grid;
  if (tx < 0 || ty < 0 || tx >= g.width || ty >= g.height) {
    return { ok: false, reason: 'out-of-bounds' };
  }
  if (def.domain === 'Walker' && !isWalkable(g, tx, ty, 'Walker')) {
    return { ok: false, reason: 'blocked-terrain' };
  }
  if (def.domain === 'Floater' && !isWalkable(g, tx, ty, 'Floater')) {
    return { ok: false, reason: 'not-water' };
  }
  spend(state.economy, cost);
  const unit = makeUnit(state, def, state.base.x, state.base.y, {
    team: 'player',
    tier: 1,
    dest: { x: tx, y: ty },
  });
  // path from base to destination in unit domain
  if (def.domain === 'Flyer') {
    unit.path = straightLinePath(state.base.x, state.base.y, tx, ty);
  } else {
    unit.path = pathFor(state, state.base.x, state.base.y, tx, ty, def.domain);
    if (!unit.path) {
      // refund on unreachable destination
      addIncome(state.economy, cost);
      state.units = state.units.filter((u) => u !== unit);
      return { ok: false, reason: 'unreachable' };
    }
  }
  unit.pathIndex = 0;
  emit(state, 'deploy', { id: unit.id, unitId, x: tx, y: ty, cost });
  return { ok: true, id: unit.id };
}

// ---------------------------------------------------------------------------
// Fixed timestep step. `inputs` is an array of commands to apply this tick
// (may be empty/undefined). Pure state mutation; deterministic given
// identical seed + identical command stream.
// Returns array of events emitted during this tick.
// ---------------------------------------------------------------------------

export function step(state, inputs) {
  state.events = [];
  if (state.status !== 'playing') {
    state.tick++;
    state.time = state.tick * DT;
    return state.events;
  }

  // 1. apply inputs (ordered)
  if (inputs && inputs.length) {
    for (let i = 0; i < inputs.length; i++) {
      applyCommand(state, inputs[i]);
    }
  }

  // 2. recompute walker/floater paths if terrain changed (wall/moat placed/sold/destroyed)
  if (state.pathsDirty) {
    recomputePaths(state);
    state.pathsDirty = false;
  }

  // 3. economy accrual (real-time money)
  updateEconomy(state, DT);

  // 4. waves: spawn timing, wave progress, win check
  updateWaves(state, DT);

  // 5. structure lifecycle: building timers, upgrading, selling, repair jobs
  updateStructures(state, DT);

  // 6. unit movement
  moveUnits(state, DT);

  // 7. combat: targeting, cooldowns, projectiles, damage, kill income
  updateCombat(state, DT);

  // 8. vision flags
  updateVision(state);

  // 9. cleanup dead entities, terrain updates for destroyed walls
  cleanup(state);

  // 10. win/lose checks
  if (state.base.hp <= 0 && state.status === 'playing') {
    state.status = 'lost';
    emit(state, 'lose', {});
  } else if (state.status === 'playing' && state.waves.complete) {
    // waves module sets complete when all waves survived and field is clear
    const attackersLeft = state.units.some((u) => u.team === 'attacker' && u.hp > 0);
    if (!attackersLeft) {
      state.status = 'won';
      emit(state, 'win', {});
    }
  }

  state.tick++;
  state.time = state.tick * DT;
  return state.events;
}

// Unit movement --------------------------------------------------------------

function moveUnits(state, dt) {
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.hp <= 0 || u.dead) continue;
    if (u.stunned && u.stunned > 0) {
      u.stunned -= dt;
      continue;
    }
    // engaged units holding to fire don't move (combat sets u.engaged)
    if (u.engaged) continue;

    let path = u.path;
    if (!path || u.pathIndex === undefined) {
      assignPath(state, u);
      path = u.path;
    }
    if (!path || u.pathIndex >= path.length) {
      // arrived: attackers at end reached base clearing; friendlies idle at dest
      if (u.team === 'attacker') u.atBase = true;
      continue;
    }
    let speed = u.speed;
    if (u.chilled && u.chilled > 0 && u.domain !== 'Flyer') {
      speed *= 0.6;
      u.chilled -= dt;
    }
    let remaining = speed * dt;
    while (remaining > 0 && u.pathIndex < path.length) {
      const node = path[u.pathIndex];
      const dx = node.x - u.x;
      const dy = node.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= remaining || dist < 1e-9) {
        u.x = node.x;
        u.y = node.y;
        u.pathIndex++;
        remaining -= dist;
      } else {
        u.x += (dx / dist) * remaining;
        u.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    if (u.pathIndex >= path.length && u.team === 'attacker') {
      u.atBase = true;
    }
  }
}

function assignPath(state, u) {
  const g = state.grid;
  let goal;
  if (u.team === 'attacker') {
    goal = { x: state.base.x, y: state.base.y };
  } else if (u.dest) {
    goal = u.dest;
  } else {
    u.path = [];
    u.pathIndex = 0;
    return;
  }
  const sx = Math.round(u.x), sy = Math.round(u.y);
  if (u.domain === 'Flyer') {
    u.path = straightLinePath(u.x, u.y, goal.x, goal.y);
  } else {
    u.path = pathFor(state, sx, sy, goal.x, goal.y, u.domain) || [];
  }
  u.pathIndex = 0;
}

// Reroute all ground units when terrain changes (called from structures via flag)
export function markPathsDirty(state) {
  state.pathsDirty = true;
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.domain !== 'Flyer') {
      u.path = null;
      u.pathIndex = 0;
    }
  }
}

// Cleanup --------------------------------------------------------------------

function cleanup(state) {
  // dead units
  const alive = [];
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.hp <= 0 || u.dead) {
      u.dead = true;
      emit(state, 'unitDied', { id: u.id, unitId: u.unitId, team: u.team });
      if (u.team === 'attacker') {
        const bounty = u.bounty || 0;
        if (bounty > 0) {
          addIncome(state.economy, bounty);
          emit(state, 'killIncome', { amount: bounty, from: u.id });
        }
        if (state.waves) state.waves.aliveAttackers = Math.max(0, (state.waves.aliveAttackers || 1) - 1);
      }
    } else {
      alive.push(u);
    }
  }
  state.units = alive;

  // destroyed structures: free terrain, mark paths dirty for walls/moats
  const keep = [];
  for (let i = 0; i < state.structures.length; i++) {
    const s = state.structures[i];
    if (s.state === 'Destroyed' && !s._terrainRemoved) {
      removeStructureTerrain(state.grid, s);
      s._terrainRemoved = true;
      emit(state, 'structureDestroyed', { id: s.id, kind: s.kind });
      if (s.blocksPath) markPathsDirty(state);
      continue; // drop destroyed structures from list
    }
    if (s.state === 'Sold') {
      continue;
    }
    keep.push(s);
  }
  state.structures = keep;

  // dead projectiles
  state.projectiles = state.projectiles.filter((p) => !p.dead);

  // repair jobs whose target is gone
  state.repairJobs = state.repairJobs.filter((j) => {
    if (j.done) return false;
    const target = state.structures.find((s) => s.id === j.structureId);
    return !!target;
  });
}

// ---------------------------------------------------------------------------
// Serialization + state hash (for determinism/replay assertions)
// ---------------------------------------------------------------------------

export function serializeState(state) {
  // strip non-serializable runtime helpers (_rngStream)
  const copy = {};
  for (const k in state) {
    if (k === '_rngStream' || k === '_rngStreamSeed' || k === 'pathCache') continue;
    copy[k] = state[k];
  }
  return JSON.stringify(copy, roundingReplacer);
}

function roundingReplacer(key, value) {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    // quantize floats so hash is stable across identical runs
    return Math.round(value * 1e6) / 1e6;
  }
  return value;
}

// FNV-1a 32-bit hash of the canonical serialized state
export function stateHash(state) {
  const str = hashString(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function hashString(state) {
  // canonical, order-stable digest of the gameplay-relevant state
  const parts = [];
  parts.push('t' + state.tick, 's' + state.seed, 'st' + state.status, 'r' + state.rngCalls);
  parts.push('b' + q(state.base.hp) + ',' + state.base.x + ',' + state.base.y);
  parts.push('$' + q(state.economy.money));
  parts.push('w' + state.waves.currentWave + '/' + state.waves.totalWaves + ':' + (state.waves.active ? 1 : 0));
  const us = state.units.slice().sort((a, b) => a.id - b.id);
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    parts.push('u' + u.id + ':' + u.unitId + ':' + q(u.x) + ',' + q(u.y) + ':' + q(u.hp) + ':' + u.team);
  }
  const ss = state.structures.slice().sort((a, b) => a.id - b.id);
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i];
    parts.push('S' + s.id + ':' + s.kind + ':' + s.x + ',' + s.y + ':' + q(s.hp) + ':' + s.tier + ':' + s.state);
  }
  const ps = state.projectiles.slice().sort((a, b) => a.id - b.id);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    parts.push('p' + p.id + ':' + q(p.x) + ',' + q(p.y));
  }
  return parts.join('|');
}

function q(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Headless run helper: drives a fresh core with a scripted command schedule.
// schedule: { tick: [commands...] }  — used by harness + replay driver.
// ---------------------------------------------------------------------------

export function runHeadless(seed, schedule, maxTicks, onTick) {
  const state = createCore(seed);
  const limit = maxTicks || TICK_RATE * 60 * 10; // 10 min cap
  while (state.status === 'playing' && state.tick < limit) {
    const cmds = schedule ? schedule[state.tick] : undefined;
    const events = step(state, cmds);
    if (onTick) onTick(state, events);
  }
  return state;
}

// Utility: allocate a deterministic entity id
export function nextId(state) {
  return state.nextId++;
}

// Expose tables + slot helper for consumers that only import core
export { TABLES, slotPositions, canPlaceStructureAt, applyStructureTerrain };