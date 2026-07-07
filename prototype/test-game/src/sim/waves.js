// src/sim/waves.js
// Wave scheduler for BULWARK vertical slice.
// - Reads N wave definitions from the data tables (no balance hardcoded here).
// - Handles the "start wave" input, builds a deterministic tick-stamped spawn
//   queue (per lane / domain), spawns attackers via the entity factories,
//   and resolves win (survive all waves) / lose (base HP reaches 0).
// Pure state in / state out: everything it touches lives on the sim state
// object so replay + hashing stay deterministic.

import * as Tables from '../data/tables.js';
import * as Entities from './entities.js';
import * as Grid from './grid.js';
import * as Pathing from './pathing.js';

// ---------------------------------------------------------------------------
// Table resolution (tolerant of export shape, but data-driven only)
// ---------------------------------------------------------------------------

const T = Tables.TABLES || Tables.tables || Tables.default || Tables;

function unitsTable() {
  const u = T.Units || T.units || T.UNITS || (T.data && T.data.units);
  if (Array.isArray(u)) return u;
  if (u && typeof u === 'object') return Object.values(u);
  return [];
}

function unitRow(unitId) {
  const rows = unitsTable();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const id = r.UnitID || r.unitId || r.id || r.key || r.name;
    if (id === unitId) return r;
  }
  return null;
}

function domainOfUnit(unitId, fallback) {
  const r = unitRow(unitId);
  if (r) {
    const d = r.Domain || r.domain;
    if (d) return normalizeDomain(d);
  }
  return normalizeDomain(fallback || 'Walker');
}

function normalizeDomain(d) {
  const s = String(d || 'Walker').toLowerCase();
  if (s.indexOf('fly') >= 0 || s.indexOf('air') >= 0) return 'Flyer';
  if (s.indexOf('float') >= 0 || s.indexOf('swim') >= 0 || s.indexOf('water') >= 0) return 'Floater';
  return 'Walker';
}

// ---------------------------------------------------------------------------
// Wave definitions
// ---------------------------------------------------------------------------

function rawWaveDefs() {
  const w =
    T.Waves || T.WAVES || T.waves || T.waveDefs || T.WaveDefs ||
    (T.data && (T.data.waves || T.data.Waves));
  if (Array.isArray(w) && w.length) return w;
  return fallbackWavesFromRoster();
}

// Fallback derived purely from the Units table (roster + counts only —
// timing lives here because scheduling *is* this module's job).
function fallbackWavesFromRoster() {
  const roster = unitsTable()
    .filter(function (r) {
      const f = r && (r.Faction || r.faction);
      return f && String(f).toLowerCase().indexOf('ground') >= 0;
    })
    .map(function (r) { return r.UnitID || r.unitId || r.id; })
    .filter(Boolean);
  const ids = roster.length ? roster : ['GND-Troops', 'GND-Tanks', 'GND-Copters'];
  const waves = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const entries = [];
    const kinds = 1 + Math.min(2, i >> 1);
    for (let k = 0; k <= kinds - 1; k++) {
      const unitId = ids[(i + k) % ids.length];
      entries.push({
        unit: unitId,
        count: 2 + i,
        tier: i >= 4 ? 2 : 1,
        delay: 0.5 + k * 2.0,
        interval: 1.25
      });
    }
    waves.push({ name: 'Wave ' + (i + 1), entries: entries, reward: 40 + i * 20 });
  }
  return waves;
}

function normalizeWaveDef(def, index) {
  let entries;
  if (Array.isArray(def)) entries = def;
  else if (def && Array.isArray(def.entries)) entries = def.entries;
  else if (def && Array.isArray(def.spawns)) entries = def.spawns;
  else if (def && Array.isArray(def.units)) entries = def.units;
  else entries = [];
  const norm = entries.map(function (e) {
    if (typeof e === 'string') e = { unit: e };
    const unitId = e.unit || e.unitId || e.UnitID || e.id || e.kind;
    return {
      unit: unitId,
      count: Math.max(1, e.count | 0 || e.n | 0 || 1),
      tier: Math.max(1, Math.min(3, e.tier | 0 || 1)),
      delay: numberOr(e.delay, numberOr(e.startDelay, numberOr(e.at, 0.5))),
      interval: numberOr(e.interval, numberOr(e.spacing, numberOr(e.gap, 1.0))),
      domain: normalizeDomain(e.domain || e.lane || domainOfUnit(unitId)),
      lane: e.lane || null
    };
  }).filter(function (e) { return !!e.unit; });
  return {
    name: (def && (def.name || def.Name)) || ('Wave ' + (index + 1)),
    entries: norm,
    reward: numberOr(def && (def.reward || def.bonus || def.income), 0)
  };
}

function numberOr(v, d) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return (typeof n === 'number' && isFinite(n)) ? n : d;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getWaveDefs() {
  return rawWaveDefs().map(normalizeWaveDef);
}

export function getWaveCount() {
  return rawWaveDefs().length;
}

/** Attach wave-scheduler state to a fresh sim state. Idempotent. */
export function initWaves(state) {
  if (state.waves && state.waves.__waves) return state.waves;
  const defs = getWaveDefs();
  state.waves = {
    __waves: true,
    index: 0,                 // 1-based number of the wave in progress / last started
    total: defs.length,
    phase: 'idle',            // idle | active | won | lost
    queue: [],                // pending spawns [{tick, unit, tier, domain}] sorted by tick
    completed: 0,
    defs: defs
  };
  return state.waves;
}

/** Start-wave input. Returns true if the wave was started. */
export function startWave(state) {
  const ws = initWaves(state);
  if (state.outcome || ws.phase !== 'idle') return false;
  if (ws.index >= ws.total) return false;
  ws.index += 1;
  ws.phase = 'active';
  ws.queue = buildSpawnQueue(state, ws.defs[ws.index - 1], state.tick | 0);
  emit(state, { type: 'waveStart', wave: ws.index, total: ws.total, spawns: ws.queue.length });
  return true;
}

/** Called once per fixed sim tick from the core. */
export function stepWaves(state) {
  const ws = initWaves(state);
  if (ws.phase === 'won' || ws.phase === 'lost') return;

  // --- LOSE: base HP reached zero ---
  const bhp = baseHp(state);
  if (bhp !== null && bhp <= 0) {
    ws.phase = 'lost';
    state.outcome = 'lose';
    emit(state, { type: 'defeat', wave: ws.index, total: ws.total });
    return;
  }

  if (ws.phase !== 'active') return;

  const tick = state.tick | 0;

  // --- Spawn everything due this tick ---
  while (ws.queue.length && ws.queue[0].tick <= tick) {
    const s = ws.queue.shift();
    spawnAttacker(state, s);
  }

  // --- Wave completion: queue drained and no attackers left alive ---
  if (!ws.queue.length && !anyAttackersAlive(state)) {
    ws.completed = ws.index;
    ws.phase = 'idle';
    emit(state, { type: 'waveEnd', wave: ws.index, total: ws.total });
    const reward = ws.defs[ws.index - 1] ? ws.defs[ws.index - 1].reward : 0;
    if (reward > 0) {
      addMoney(state, reward);
      emit(state, { type: 'waveReward', wave: ws.index, amount: reward });
    }
    // --- WIN: survived every wave ---
    if (ws.index >= ws.total) {
      ws.phase = 'won';
      state.outcome = 'win';
      emit(state, { type: 'victory', waves: ws.total });
    }
  }
}

/** HUD/harness helper: read-only summary of the wave state. */
export function waveStatus(state) {
  const ws = initWaves(state);
  return {
    current: ws.index,
    total: ws.total,
    phase: ws.phase,
    pendingSpawns: ws.queue.length,
    attackersAlive: countAttackers(state),
    canStart: !state.outcome && ws.phase === 'idle' && ws.index < ws.total
  };
}

export function isWaveActive(state) {
  const ws = initWaves(state);
  return ws.phase === 'active';
}

// ---------------------------------------------------------------------------
// Spawn queue construction (deterministic tick stamps)
// ---------------------------------------------------------------------------

function dtSeconds(state) {
  if (typeof state.dt === 'number' && state.dt > 0) return state.dt;
  if (typeof state.stepSeconds === 'number' && state.stepSeconds > 0) return state.stepSeconds;
  const hz = state.tickRate || state.tickHz || 20;
  return 1 / hz;
}

function secondsToTicks(state, sec) {
  return Math.max(1, Math.round(sec / dtSeconds(state)));
}

function buildSpawnQueue(state, waveDef, nowTick) {
  const queue = [];
  if (!waveDef) return queue;
  for (let e = 0; e < waveDef.entries.length; e++) {
    const entry = waveDef.entries[e];
    for (let i = 0; i < entry.count; i++) {
      const sec = entry.delay + i * entry.interval;
      queue.push({
        tick: nowTick + secondsToTicks(state, sec),
        unit: entry.unit,
        tier: entry.tier,
        domain: entry.domain,
        seq: queue.length // stable tiebreaker
      });
    }
  }
  queue.sort(function (a, b) { return (a.tick - b.tick) || (a.seq - b.seq); });
  return queue;
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function makeUnitEntity(spec) {
  const candidates = ['createUnit', 'makeUnit', 'spawnUnit', 'unitFromTable', 'createAttacker'];
  for (let i = 0; i < candidates.length; i++) {
    const fn = Entities[candidates[i]];
    if (typeof fn === 'function') {
      let u = null;
      try { u = fn(spec.unit, spec.tier, { side: 'attacker' }); } catch (err) { u = null; }
      if (u && typeof u === 'object') return u;
    }
  }
  return null;
}

function spawnAttacker(state, spec) {
  const domain = normalizeDomain(spec.domain || domainOfUnit(spec.unit));
  const unit = makeUnitEntity(spec);
  if (!unit) {
    emit(state, { type: 'spawnFailed', unit: spec.unit });
    return null;
  }

  // Identity / ownership
  if (unit.id === undefined || unit.id === null) {
    state.nextId = (state.nextId | 0) + 1;
    unit.id = state.nextId;
  } else if (typeof unit.id === 'number') {
    state.nextId = Math.max(state.nextId | 0, unit.id);
  }
  unit.side = 'attacker';
  unit.team = 'attacker';
  unit.isAttacker = true;
  if (!unit.domain) unit.domain = domain;
  unit.kind = unit.kind || spec.unit;

  // Position at the lane spawn point for this domain
  const pos = spawnPosition(state, normalizeDomain(unit.domain));
  unit.x = pos.x;
  unit.y = pos.y;
  if (normalizeDomain(unit.domain) === 'Flyer' && unit.altitude === undefined) unit.altitude = 1;

  // Path (core repaths anything flagged; try eagerly if pathing exposes a helper)
  tryAssignPath(state, unit);

  if (!Array.isArray(state.units)) state.units = [];
  state.units.push(unit);
  emit(state, { type: 'spawn', id: unit.id, unit: spec.unit, tier: spec.tier, domain: unit.domain, x: unit.x, y: unit.y });
  return unit;
}

function spawnPosition(state, domain) {
  const grid = state.grid || {};

  // Preferred: ask the grid module
  const gridFns = ['getSpawnPoint', 'spawnPointFor', 'spawnPoint', 'laneSpawn'];
  for (let i = 0; i < gridFns.length; i++) {
    const fn = Grid[gridFns[i]];
    if (typeof fn === 'function') {
      let p = null;
      try { p = fn(grid, domain); } catch (err) { p = null; }
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    }
  }

  // Next: precomputed spawn points stored on the grid state
  const stored =
    (grid.spawns && (grid.spawns[domain] || grid.spawns[domain.toLowerCase()])) ||
    (domain === 'Floater' ? (grid.waterSpawn || grid.floaterSpawn) : (grid.groundSpawn || grid.walkerSpawn));
  if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') {
    return { x: stored.x, y: stored.y };
  }

  // Last resort: left edge of the appropriate lane band
  const h = grid.height || grid.rows || 12;
  let y;
  if (domain === 'Floater') {
    y = firstNumber([grid.waterLaneY, grid.waterY, grid.lanes && grid.lanes.water && grid.lanes.water.y], Math.floor(h * 0.7));
  } else {
    y = firstNumber([grid.groundLaneY, grid.groundY, grid.lanes && grid.lanes.ground && grid.lanes.ground.y], Math.floor(h * 0.35));
  }
  return { x: 0, y: y };
}

function firstNumber(list, d) {
  for (let i = 0; i < list.length; i++) {
    if (typeof list[i] === 'number' && isFinite(list[i])) return list[i];
  }
  return d;
}

function tryAssignPath(state, unit) {
  unit.needsPath = true;
  const wholeFns = ['assignPath', 'computePathFor', 'pathForUnit', 'repathUnit'];
  for (let i = 0; i < wholeFns.length; i++) {
    const fn = Pathing[wholeFns[i]];
    if (typeof fn === 'function') {
      try {
        fn(state, unit);
        unit.needsPath = false;
        return;
      } catch (err) { /* keep needsPath, core will repath */ }
    }
  }
  const f = Pathing.computePath || Pathing.findPath || Pathing.bfsPath;
  if (typeof f === 'function' && state.grid) {
    try {
      const goal = baseTile(state);
      if (goal) {
        const p = f(state.grid, { x: Math.round(unit.x), y: Math.round(unit.y) }, goal, normalizeDomain(unit.domain));
        if (Array.isArray(p) && p.length) {
          unit.path = p;
          unit.pathIndex = 0;
          unit.needsPath = false;
        }
      }
    } catch (err) { /* core will repath */ }
  }
}

function baseTile(state) {
  const b = state.base;
  if (b && typeof b.x === 'number' && typeof b.y === 'number') {
    return { x: Math.round(b.x), y: Math.round(b.y) };
  }
  const g = state.grid || {};
  const gb = g.base || g.baseTile || g.basePos;
  if (gb && typeof gb.x === 'number' && typeof gb.y === 'number') {
    return { x: Math.round(gb.x), y: Math.round(gb.y) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Attacker census + base HP + economy + events
// ---------------------------------------------------------------------------

function isLiveAttacker(u) {
  if (!u || u.dead || u.removed) return false;
  const hp = (typeof u.hp === 'number') ? u.hp : u.health;
  if (typeof hp === 'number' && hp <= 0) return false;
  return u.side === 'attacker' || u.team === 'attacker' || u.isAttacker === true;
}

function anyAttackersAlive(state) {
  const units = state.units;
  if (!Array.isArray(units)) return false;
  for (let i = 0; i < units.length; i++) {
    if (isLiveAttacker(units[i])) return true;
  }
  return false;
}

function countAttackers(state) {
  const units = state.units;
  if (!Array.isArray(units)) return 0;
  let n = 0;
  for (let i = 0; i < units.length; i++) {
    if (isLiveAttacker(units[i])) n++;
  }
  return n;
}

function baseHp(state) {
  const b = state.base;
  if (!b) return null;
  if (typeof b.hp === 'number') return b.hp;
  if (typeof b.health === 'number') return b.health;
  return null;
}

function addMoney(state, amount) {
  if (state.economy && typeof state.economy.money === 'number') {
    state.economy.money += amount;
  } else if (typeof state.money === 'number') {
    state.money += amount;
  } else if (state.economy) {
    state.economy.money = amount;
  } else {
    state.money = amount;
  }
}

function emit(state, ev) {
  ev.tick = state.tick | 0;
  if (!Array.isArray(state.events)) state.events = [];
  state.events.push(ev);
}

export default {
  initWaves: initWaves,
  startWave: startWave,
  stepWaves: stepWaves,
  waveStatus: waveStatus,
  isWaveActive: isWaveActive,
  getWaveDefs: getWaveDefs,
  getWaveCount: getWaveCount
};