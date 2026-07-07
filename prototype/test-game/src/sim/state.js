tick-perfect deterministic sim needs a strict container. Here's the state module.

```javascript
// src/sim/state.js
// Strict deterministic sim state container.
// Holds base, entities, economy, waves, slots, terrain.
// No rendering, no timers — pure data + a deterministic hash.

import { CONSTANTS } from '../config/constants.js';

let __idCounter = 0;

/**
 * Allocate a new unique entity id (monotonic within a sim run).
 * IDs are deterministic because entity creation order is deterministic.
 */
export function nextId(state) {
  // Keep id allocation inside the state so replays are reproducible.
  state.idSeq = (state.idSeq | 0) + 1;
  return state.idSeq;
}

/**
 * Structure lifecycle enumeration.
 */
export const StructState = Object.freeze({
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  DESTROYED: 'Destroyed',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling'
});

/**
 * Unit animation-ish state (sim-side only tracks logical mode).
 */
export const UnitState = Object.freeze({
  IDLE: 'Idle',
  MOVING: 'Moving',
  ATTACKING: 'Attacking',
  DEATH: 'Death'
});

/**
 * Movement / entity domains.
 */
export const Domain = Object.freeze({
  GROUND: 'Ground',
  WATER: 'Water',
  AIR: 'Air'
});

/**
 * Create a fresh, empty strict sim state.
 * @param {object} opts
 * @param {number} opts.seed - deterministic seed
 * @param {object} [opts.config] - injected config (constants/data)
 */
export function createState(opts = {}) {
  const seed = (opts.seed >>> 0) || 1;
  const C = opts.config && opts.config.constants ? opts.config.constants : CONSTANTS;

  const state = {
    // ---- meta / determinism ----
    seed,
    tick: 0,           // integer tick counter
    time: 0,           // accumulated sim time in seconds (fixed-step derived)
    idSeq: 0,          // deterministic id allocator
    status: 'playing', // 'playing' | 'won' | 'lost'
    rngState: seed >>> 0,

    // ---- board / terrain (populated by board.js) ----
    board: {
      width: C.BOARD_TILES_X || 24,
      height: C.BOARD_TILES_Y || 16,
      tileSize: C.TILE_SIZE || 32,
      groundLane: null,   // {tiles:[{x,y}], startPx, endPx}
      waterLane: null,
      slots: [],          // hard-point slots: {id,x,y,occupiedBy}
      // terrain grid: 0 = open ground, 1 = wall, 2 = moat, 3 = water
      terrain: []         // terrain[y][x]
    },

    // ---- player base ----
    base: {
      id: 0,
      x: 0,
      y: 0,
      hp: C.BASE_HP || 5000,
      maxHp: C.BASE_HP || 5000,
      level: 1
    },

    // ---- economy ----
    economy: {
      money: (C.START_MONEY != null) ? C.START_MONEY : 500,
      accrualPerSec: (C.MONEY_PER_SEC != null) ? C.MONEY_PER_SEC : 10,
      accrualCarry: 0,      // fractional carry so integer money stays deterministic
      totalEarned: 0,
      totalSpent: 0,
      bankrupt: false
    },

    // ---- waves ----
    waves: {
      current: 0,           // wave index currently running (0 = none started)
      total: 0,             // total waves in the slice (set by waves.js)
      active: false,        // is a wave in progress
      spawnQueue: [],       // pending spawns: {t, def}
      spawnCursor: 0,       // index into current wave's spawn list
      waveStartTick: 0,
      cleared: 0,           // waves fully survived
      defs: []              // wave definitions loaded from data
    },

    // ---- entity registries (arrays kept dense; iterate in id order) ----
    attackers: [],   // walker / floater / flyer units (attackers)
    structures: [],  // towers / walls / moats
    troops: [],      // player-deployed troops (march + repair labour)
    projectiles: [], // in-flight shots (combat.js)
    effects: [],     // logical status effects on entities

    // ---- deploy / order bookkeeping ----
    pendingRepairs: [], // {structureId, troopId, progress}

    // ---- config handle (data tables etc.) ----
    config: opts.config || null
  };

  return state;
}

/* ============================================================
 * Entity add/remove helpers — keep registries deterministic.
 * ============================================================ */

export function addAttacker(state, ent) {
  if (ent.id == null) ent.id = nextId(state);
  state.attackers.push(ent);
  return ent;
}

export function addStructure(state, ent) {
  if (ent.id == null) ent.id = nextId(state);
  state.structures.push(ent);
  return ent;
}

export function addTroop(state, ent) {
  if (ent.id == null) ent.id = nextId(state);
  state.troops.push(ent);
  return ent;
}

export function addProjectile(state, p) {
  if (p.id == null) p.id = nextId(state);
  state.projectiles.push(p);
  return p;
}

export function addEffect(state, fx) {
  if (fx.id == null) fx.id = nextId(state);
  state.effects.push(fx);
  return fx;
}

export function findStructure(state, id) {
  for (let i = 0; i < state.structures.length; i++) {
    if (state.structures[i].id === id) return state.structures[i];
  }
  return null;
}

export function findAttacker(state, id) {
  for (let i = 0; i < state.attackers.length; i++) {
    if (state.attackers[i].id === id) return state.attackers[i];
  }
  return null;
}

export function findTroop(state, id) {
  for (let i = 0; i < state.troops.length; i++) {
    if (state.troops[i].id === id) return state.troops[i];
  }
  return null;
}

/**
 * Remove dead / cleaned-up entities from a registry in-place.
 * Preserves relative order (deterministic).
 */
export function compact(arr, keepFn) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    if (keepFn(arr[r])) {
      if (w !== r) arr[w] = arr[r];
      w++;
    }
  }
  arr.length = w;
}

/**
 * Sweep all registries removing entities flagged for deletion.
 */
export function sweep(state) {
  compact(state.attackers, (a) => !a.dead);
  compact(state.troops, (t) => !t.dead);
  compact(state.projectiles, (p) => !p.dead);
  compact(state.effects, (e) => !e.dead);
  // Destroyed structures remain visible one tick (renderer), but sim removes
  // them from slot occupancy elsewhere; here we drop fully-cleaned structures.
  compact(state.structures, (s) => !s.removed);
}

/* ============================================================
 * Terrain / slot queries (strict, read-only helpers).
 * ============================================================ */

export function terrainAt(state, tx, ty) {
  const b = state.board;
  if (tx < 0 || ty < 0 || tx >= b.width || ty >= b.height) return -1;
  const row = b.terrain[ty];
  if (!row) return 0;
  const v = row[tx];
  return (v == null) ? 0 : v;
}

export function setTerrain(state, tx, ty, val) {
  const b = state.board;
  if (tx < 0 || ty < 0 || tx >= b.width || ty >= b.height) return;
  if (!b.terrain[ty]) b.terrain[ty] = [];
  b.terrain[ty][tx] = val;
}

export function findSlot(state, id) {
  const slots = state.board.slots;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].id === id) return slots[i];
  }
  return null;
}

export function freeSlots(state) {
  return state.board.slots.filter((s) => !s.occupiedBy);
}

/* ============================================================
 * Win / lose evaluation (called by step ordering).
 * ============================================================ */

export function evaluateEndConditions(state) {
  if (state.status !== 'playing') return state.status;
  if (state.base.hp <= 0) {
    state.base.hp = 0;
    state.status = 'lost';
    return 'lost';
  }
  const w = state.waves;
  if (w.total > 0 && w.cleared >= w.total && !w.active &&
      state.attackers.length === 0) {
    state.status = 'won';
    return 'won';
  }
  return 'playing';
}

/* ============================================================
 * Deterministic state hash — used by replay verification.
 * Order-stable FNV-1a over quantized numeric fields.
 * ============================================================ */

function fnv1a(hash, n) {
  // n expected as a 32-bit integer.
  hash ^= (n & 0xff);        hash = Math.imul(hash, 0x01000193);
  hash ^= ((n >>> 8) & 0xff); hash = Math.imul(hash, 0x01000193);
  hash ^= ((n >>> 16) & 0xff);hash = Math.imul(hash, 0x01000193);
  hash ^= ((n >>> 24) & 0xff);hash = Math.imul(hash, 0x01000193);
  return hash >>> 0;
}

// Quantize a float to a fixed-point integer for stable hashing.
function q(v) {
  if (v == null || !isFinite(v)) return 0;
  return Math.round(v * 1000) | 0;
}

function hashStr(hash, s) {
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash = hash >>> 0;
  }
  return hash;
}

/**
 * Produce a deterministic 32-bit hash of the entire strict state.
 * Two runs with identical seed + inputs must produce identical hashes
 * at the same tick.
 */
export function hashState(state) {
  let h = 0x811c9dc5 >>> 0;

  h = fnv1a(h, state.tick | 0);
  h = fnv1a(h, state.seed | 0);
  h = fnv1a(h, state.rngState | 0);
  h = hashStr(h, state.status);
  h = fnv1a(h, state.idSeq | 0);

  // base
  h = fnv1a(h, q(state.base.hp));
  h = fnv1a(h, q(state.base.x));
  h = fnv1a(h, q(state.base.y));
  h = fnv1a(h, state.base.level | 0);

  // economy
  h = fnv1a(h, q(state.economy.money));
  h = fnv1a(h, q(state.economy.accrualCarry));
  h = fnv1a(h, q(state.economy.totalEarned));
  h = fnv1a(h, q(state.economy.totalSpent));
  h = fnv1a(h, state.economy.bankrupt ? 1 : 0);

  // waves
  h = fnv1a(h, state.waves.current | 0);
  h = fnv1a(h, state.waves.total | 0);
  h = fnv1a(h, state.waves.active ? 1 : 0);
  h = fnv1a(h, state.waves.spawnCursor | 0);
  h = fnv1a(h, state.waves.cleared | 0);

  // attackers (id order maintained by insertion)
  for (let i = 0; i < state.attackers.length; i++) {
    const a = state.attackers[i];
    h = fnv1a(h, a.id | 0);
    h = fnv1a(h, q(a.x));
    h = fnv1a(h, q(a.y));
    h = fnv1a(h, q(a.altitude || 0));
    h = fnv1a(h, q(a.hp));
    h = fnv1a(h, a.pathIndex | 0);
    h = hashStr(h, a.state || '');
  }

  // structures
  for (let i = 0; i < state.structures.length; i++) {
    const s = state.structures[i];
    h = fnv1a(h, s.id | 0);
    h = fnv1a(h, q(s.x));
    h = fnv1a(h, q(s.y));
    h = fnv1a(h, q(s.hp));
    h = fnv1a(h, s.tier | 0);
    h = hashStr(h, s.lifecycle || '');
    h = fnv1a(h, q(s.buildProgress || 0));
    h = fnv1a(h, q(s.upgradeProgress || 0));
    h = fnv1a(h, s.targetId | 0);
    h = fnv1a(h, q(s.cooldown || 0));
  }

  // troops
  for (let i = 0; i < state.troops.length; i++) {
    const t = state.troops[i];
    h = fnv1a(h, t.id | 0);
    h = fnv1a(h, q(t.x));
    h = fnv1a(h, q(t.y));
    h = fnv1a(h, q(t.hp));
    h = hashStr(h, t.job || '');
  }

  // projectiles
  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    h = fnv1a(h, p.id | 0);
    h = fnv1a(h, q(p.x));
    h = fnv1a(h, q(p.y));
    h = fnv1a(h, q(p.damage || 0));
    h = fnv1a(h, p.targetId | 0);
  }

  return h >>> 0;
}

/**
 * Shallow structural clone of the strict state (for snapshotting/debug).
 * Deep-copies registries and nested plain objects only (no functions).
 */
export function snapshot(state) {
  return JSON.parse(JSON.stringify({
    seed: state.seed,
    tick: state.tick,
    time: state.time,
    idSeq: state.idSeq,
    status: state.status,
    rngState: state.rngState,
    base: state.base,
    economy: state.economy,
    waves: {
      current: state.waves.current,
      total: state.waves.total,
      active: state.waves.active,
      spawnCursor: state.waves.spawnCursor,
      cleared: state.waves.cleared
    },
    attackers: state.attackers,
    structures: state.structures,
    troops: state.troops,
    projectiles: state.projectiles,
    board: {
      width: state.board.width,
      height: state.board.height,
      tileSize: state.board.tileSize,
      slots: state.board.slots,
      terrain: state.board.terrain
    }
  }));
}

export default {
  createState,
  nextId,
  StructState,
  UnitState,
  Domain,
  addAttacker,
  addStructure,
  addTroop,
  addProjectile,
  addEffect,
  findStructure,
  findAttacker,
  findTroop,
  findSlot,
  freeSlots,
  compact,
  sweep,
  terrainAt,
  setTerrain,
  evaluateEndConditions,
  hashState,
  snapshot
};