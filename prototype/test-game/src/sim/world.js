Looking at this task, I need to build the central state container + reducer. It must integrate with commands, entities, lifecycle, economy, etc. I'll create a strict state shape and a reducer applying commands deterministically.

```javascript
// src/sim/world.js
// Central strict state container + reducer applying commands.
// Deterministic: all randomness flows through the seeded RNG stored in state.
// Rendering reads this state; nothing here touches the DOM or pixi.

import { makeRng } from './rng.js';

/*
 * WORLD STATE SHAPE (strict, serializable)
 * {
 *   seed, tick, time, phase, over, result,
 *   rngState,
 *   geometry: { ... },          // from geometry.build
 *   base: { x,y,hp,maxHp,level, slots:[...] },
 *   economy: { gold, income, ... },
 *   structures: [ { id,type,tier,x,y,slot,hp,maxHp,state,... } ],
 *   units: [ { id,kind,domain,x,y,hp,maxHp,... } ],
 *   projectiles: [ ... ],
 *   troops: [ ... ],            // repair troops in transit
 *   waves: { current,total,active,queue,spawnTimer,... },
 *   selection: id|null,
 *   events: [ ... ],            // transient per-tick events for renderer/log
 *   nextId,
 * }
 */

// ---- ID allocation -------------------------------------------------------
export function allocId(state) {
  const id = state.nextId;
  state.nextId = id + 1;
  return id;
}

// ---- World creation ------------------------------------------------------
// createWorld is the single source of the initial strict state. The step /
// system modules mutate a working copy each tick; the reducer applies commands.
export function createWorld(config, seed) {
  const tables = config && config.data && config.data.tables ? config.data.tables : {};

  // Build geometry lazily via injected builder if provided, else a default.
  const geometry = config.buildGeometry
    ? config.buildGeometry(config)
    : defaultGeometry();

  const baseSlots = geometry.slots.map((s, i) => ({
    index: i,
    x: s.x,
    y: s.y,
    occupied: false,
    structureId: null,
  }));

  const startGold =
    (tables.assumptions && tables.assumptions.StartGold) != null
      ? tables.assumptions.StartGold
      : 1500;

  const totalWaves =
    tables.waves && tables.waves.total != null
      ? tables.waves.total
      : Array.isArray(tables.waves) ? tables.waves.length : 5;

  const rng = makeRng(seed);

  const state = {
    seed: seed >>> 0,
    tick: 0,
    time: 0,
    dt: 1 / 30,
    phase: 'build', // 'build' | 'battle' | 'over'
    over: false,
    result: null, // 'win' | 'lose'
    rngState: rng.serialize(),

    geometry,

    base: {
      x: geometry.base.x,
      y: geometry.base.y,
      hp: 1000,
      maxHp: 1000,
      level: 1,
      slots: baseSlots,
    },

    economy: {
      gold: startGold,
      income: 0, // accrual per second (passive)
      passiveRate: 5, // gold/sec baseline
      totalEarned: 0,
      totalSpent: 0,
      bankrupt: false,
    },

    structures: [],
    units: [],
    projectiles: [],
    troops: [],

    waves: {
      current: 0,
      total: totalWaves,
      active: false,
      queue: [],
      spawnTimer: 0,
      spawnIndex: 0,
      cleared: false,
    },

    selection: null,
    deploy: null, // { kind, x, y } pending deploy order

    events: [],
    nextId: 1,

    config,
  };

  return state;
}

function defaultGeometry() {
  // Fallback geometry if geometry module not wired. Coordinates in tiles.
  const W = 40;
  const H = 24;
  const groundLaneY = 8;
  const waterLaneY = 16;
  const base = { x: W - 3, y: 12 };
  const slots = [];
  const slotOrigin = { x: W - 7, y: 6 };
  for (let i = 0; i < 6; i++) {
    slots.push({
      x: slotOrigin.x + (i % 3) * 2,
      y: slotOrigin.y + Math.floor(i / 3) * 4,
    });
  }
  return {
    width: W,
    height: H,
    groundLaneY,
    waterLaneY,
    base,
    slots,
    spawn: { ground: { x: 1, y: groundLaneY }, water: { x: 1, y: waterLaneY }, air: { x: 1, y: 4 } },
  };
}

// ---- RNG helpers (keep state serializable + deterministic) --------------
export function worldRng(state) {
  const rng = makeRng(0);
  rng.deserialize(state.rngState);
  return {
    next() {
      const v = rng.next();
      state.rngState = rng.serialize();
      return v;
    },
    int(n) {
      const v = rng.int(n);
      state.rngState = rng.serialize();
      return v;
    },
    range(a, b) {
      const v = rng.range(a, b);
      state.rngState = rng.serialize();
      return v;
    },
  };
}

// ---- Events --------------------------------------------------------------
export function emit(state, type, data) {
  state.events.push(Object.assign({ type, tick: state.tick }, data || {}));
}

export function clearEvents(state) {
  state.events.length = 0;
}

// ---- Lookups -------------------------------------------------------------
export function getStructure(state, id) {
  for (let i = 0; i < state.structures.length; i++) {
    if (state.structures[i].id === id) return state.structures[i];
  }
  return null;
}

export function getUnit(state, id) {
  for (let i = 0; i < state.units.length; i++) {
    if (state.units[i].id === id) return state.units[i];
  }
  return null;
}

export function getSlot(state, index) {
  return state.base.slots[index] || null;
}

export function findFreeSlotNear(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const s of state.base.slots) {
    if (s.occupied) continue;
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// =========================================================================
// REDUCER
// =========================================================================
// applyCommand mutates the strict state in place based on a validated command.
// Command handlers are injected from the system modules to avoid import cycles,
// but we also provide default lightweight implementations so world.js is
// runnable standalone. The step orchestrator passes a `systems` bundle.
//
// A command is { type, ... }. The reducer returns true if the command was
// accepted (for battle-log recording), false if rejected.

export function applyCommand(state, cmd, systems) {
  if (!cmd || typeof cmd.type !== 'string') return false;
  systems = systems || {};

  switch (cmd.type) {
    case 'select':
      return cmdSelect(state, cmd);
    case 'deselect':
      state.selection = null;
      return true;
    case 'place':
      return cmdPlace(state, cmd, systems);
    case 'upgrade':
      return cmdUpgrade(state, cmd, systems);
    case 'sell':
      return cmdSell(state, cmd, systems);
    case 'repair':
      return cmdRepair(state, cmd, systems);
    case 'target':
      return cmdTarget(state, cmd);
    case 'deploy':
      return cmdDeploy(state, cmd, systems);
    case 'startWave':
      return cmdStartWave(state, cmd, systems);
    case 'setPhase':
      state.phase = cmd.phase;
      return true;
    default:
      return false;
  }
}

// --- select ---------------------------------------------------------------
function cmdSelect(state, cmd) {
  const s = getStructure(state, cmd.id);
  if (!s) {
    state.selection = null;
    return false;
  }
  state.selection = cmd.id;
  return true;
}

// --- place ----------------------------------------------------------------
function cmdPlace(state, cmd, systems) {
  const tables = state.config.data ? state.config.data.tables : {};
  const structDefs = tables.structures || {};
  const def = structDefs[cmd.structType] || (systems.getStructureDef && systems.getStructureDef(state, cmd.structType));
  if (!def) return false;

  // Resolve target slot (or free-place terrain for walls/moats)
  const isTerrain = def.category === 'wall' || def.category === 'moat';
  let slot = null;
  if (!isTerrain) {
    if (cmd.slot != null) {
      slot = getSlot(state, cmd.slot);
      if (!slot || slot.occupied) return false;
    } else {
      slot = findFreeSlotNear(state, cmd.x, cmd.y);
      if (!slot) return false;
    }
  }

  // Cost check
  const cost = costOf(def, 1);
  if (state.economy.gold < cost) return false;

  // Terrain space check for walls/moats via grid system
  const px = slot ? slot.x : cmd.x;
  const py = slot ? slot.y : cmd.y;
  if (isTerrain && systems.canPlaceTerrain) {
    if (!systems.canPlaceTerrain(state, px, py, def)) return false;
  }

  // Spend
  spend(state, cost);

  // Create structure (via entities factory if provided)
  const buildTime = def.buildTime != null ? def.buildTime : 2;
  let s;
  if (systems.makeStructure) {
    s = systems.makeStructure(state, {
      type: cmd.structType,
      def,
      x: px,
      y: py,
      slot: slot ? slot.index : null,
    });
  } else {
    s = {
      id: allocId(state),
      type: cmd.structType,
      category: def.category || 'tower',
      def,
      tier: 1,
      x: px,
      y: py,
      slot: slot ? slot.index : null,
      hp: 1,
      maxHp: tierHp(def, 1),
      state: 'building',
      buildTime,
      buildTimer: 0,
      cooldown: 0,
      target: null,
      targetMode: 'nearest',
      footprint: def.footprint || { w: 1, h: 1 },
      isTerrain,
    };
    state.structures.push(s);
  }

  if (slot) {
    slot.occupied = true;
    slot.structureId = s.id;
  }

  // Terrain reroutes walker paths
  if (isTerrain) {
    if (systems.addTerrain) systems.addTerrain(state, s);
    if (systems.recomputePaths) systems.recomputePaths(state);
  }

  emit(state, 'placed', { id: s.id, structType: cmd.structType, x: px, y: py });
  return true;
}

// --- upgrade --------------------------------------------------------------
function cmdUpgrade(state, cmd, systems) {
  const s = getStructure(state, cmd.id);
  if (!s) return false;
  if (s.state !== 'complete' && s.state !== 'damaged') return false;
  if (s.tier >= 2) return false; // upgrade once (T1 -> T2 per acceptance)

  const nextTier = s.tier + 1;
  const cur = costOf(s.def, s.tier);
  const cum = costOf(s.def, nextTier);
  const delta = Math.max(0, cum - cur);
  if (state.economy.gold < delta) return false;

  spend(state, delta);

  if (systems.beginUpgrade) {
    systems.beginUpgrade(state, s, nextTier);
  } else {
    const oldMax = s.maxHp;
    s.state = 'upgrading';
    s.tier = nextTier;
    s.maxHp = tierHp(s.def, nextTier);
    // preserve hp fraction
    const frac = oldMax > 0 ? s.hp / oldMax : 1;
    s.hp = s.maxHp * frac;
    s.upgradeTime = s.def.upgradeTime != null ? s.def.upgradeTime : 3;
    s.upgradeTimer = 0;
  }

  emit(state, 'upgrade', { id: s.id, tier: nextTier });
  return true;
}

// --- sell -----------------------------------------------------------------
function cmdSell(state, cmd, systems) {
  const s = getStructure(state, cmd.id);
  if (!s) return false;
  if (s.state === 'destroyed' || s.state === 'selling') return false;

  const invested = costOf(s.def, s.tier);
  const refundRate =
    s.def.sellRefund != null
      ? s.def.sellRefund
      : (state.config.data && state.config.data.tables.assumptions &&
          state.config.data.tables.assumptions.SellRefund) || 0.5;
  const refund = Math.floor(invested * refundRate);

  addGold(state, refund);

  if (systems.beginSell) {
    systems.beginSell(state, s);
  } else {
    removeStructure(state, s);
  }

  if (s.isTerrain) {
    if (systems.removeTerrain) systems.removeTerrain(state, s);
    if (systems.recomputePaths) systems.recomputePaths(state);
  }

  if (state.selection === s.id) state.selection = null;
  emit(state, 'sold', { id: s.id, refund });
  return true;
}

// --- repair ---------------------------------------------------------------
function cmdRepair(state, cmd, systems) {
  const s = getStructure(state, cmd.id);
  if (!s) return false;
  if (s.hp >= s.maxHp) return false;
  if (s.state === 'destroyed' || s.state === 'placing' || s.state === 'building') return false;
  if (s.repairing) return false;

  if (systems.beginRepair) {
    return systems.beginRepair(state, s);
  }
  // Default: spawn a troop that travels to the structure, then repairs.
  const troop = {
    id: allocId(state),
    targetId: s.id,
    x: state.base.x,
    y: state.base.y,
    speed: 3,
    arrived: false,
    repairTime: 3,
    repairTimer: 0,
  };
  state.troops.push(troop);
  s.repairing = true;
  emit(state, 'repairStart', { id: s.id });
  return true;
}

// --- target ---------------------------------------------------------------
function cmdTarget(state, cmd) {
  const s = getStructure(state, cmd.id);
  if (!s) return false;
  if (cmd.mode) {
    s.targetMode = cmd.mode; // 'nearest' | 'strongest' | 'first'
  }
  if (cmd.targetId != null) {
    s.forcedTarget = cmd.targetId;
  } else if (cmd.clear) {
    s.forcedTarget = null;
  }
  emit(state, 'target', { id: s.id, mode: s.targetMode });
  return true;
}

// --- deploy (attacker/troop deploy order) --------------------------------
// In this defensive slice, "deploy" issues a march destination order for
// repair/support troops or a debug spawn; validity checked by systems.
function cmdDeploy(state, cmd, systems) {
  if (systems.deploy) {
    return systems.deploy(state, cmd);
  }
  // Default: record a deploy order destination (a march target, not spawn).
  const cost = cmd.cost || 0;
  if (state.economy.gold < cost) return false;
  // validity: within board
  if (
    cmd.x < 0 ||
    cmd.y < 0 ||
    cmd.x > state.geometry.width ||
    cmd.y > state.geometry.height
  ) {
    return false;
  }
  if (cost) spend(state, cost);
  const troop = {
    id: allocId(state),
    kind: cmd.kind || 'trooper',
    x: state.base.x,
    y: state.base.y,
    dest: { x: cmd.x, y: cmd.y },
    speed: 3,
    arrived: false,
    deployed: true,
  };
  state.troops.push(troop);
  emit(state, 'deploy', { id: troop.id, x: cmd.x, y: cmd.y });
  return true;
}

// --- startWave ------------------------------------------------------------
function cmdStartWave(state, cmd, systems) {
  if (state.waves.active) return false;
  if (state.waves.current >= state.waves.total) return false;
  if (state.over) return false;

  if (systems.startWave) {
    return systems.startWave(state);
  }
  // Default fallback: mark active; wave system fills queue.
  state.waves.current += 1;
  state.waves.active = true;
  state.waves.spawnTimer = 0;
  state.waves.spawnIndex = 0;
  state.phase = 'battle';
  emit(state, 'waveStart', { wave: state.waves.current });
  return true;
}

// =========================================================================
// SHARED MUTATORS
// =========================================================================
export function spend(state, amount) {
  state.economy.gold -= amount;
  state.economy.totalSpent += amount;
  if (state.economy.gold < 0) {
    state.economy.gold = 0;
    state.economy.bankrupt = true;
  }
}

export function addGold(state, amount) {
  state.economy.gold += amount;
  if (amount > 0) state.economy.totalEarned += amount;
  if (state.economy.gold > 0) state.economy.bankrupt = false;
}

export function removeStructure(state, s) {
  const idx = state.structures.indexOf(s);
  if (idx >= 0) state.structures.splice(idx, 1);
  if (s.slot != null) {
    const slot = getSlot(state, s.slot);
    if (slot) {
      slot.occupied = false;
      slot.structureId = null;
    }
  }
  s.state = 'destroyed';
}

export function removeUnit(state, u) {
  const idx = state.units.indexOf(u);
  if (idx >= 0) state.units.splice(idx, 1);
}

export function setWin(state) {
  if (state.over) return;
  state.over = true;
  state.result = 'win';
  state.phase = 'over';
  emit(state, 'gameOver', { result: 'win' });
}

export function setLose(state) {
  if (state.over) return;
  state.over = true;
  state.result = 'lose';
  state.phase = 'over';
  emit(state, 'gameOver', { result: 'lose' });
}

// =========================================================================
// COST / TIER HELPERS (data-driven; no hardcoded balance)
// =========================================================================
export function costOf(def, tier) {
  if (!def) return 0;
  if (def.cost && def.cost[tier - 1] != null) return def.cost[tier - 1];
  if (def['Cost T' + tier] != null) return def['Cost T' + tier];
  const base = def.baseCost != null ? def.baseCost : def.Power != null ? def.Power * 3 : 100;
  if (tier === 1) return base;
  if (tier === 2) return Math.round(base * 2.5);
  return Math.round(base * 5);
}

export function tierHp(def, tier) {
  if (!def) return 100;
  if (def.hp && def.hp[tier - 1] != null) return def.hp[tier - 1];
  if (def['HP T' + tier] != null) return def['HP T' + tier];
  const base = def.baseHp != null ? def.baseHp : def.Base_HP != null ? def.Base_HP : 200;
  if (tier === 1) return base;
  if (tier === 2) return Math.round(base * 1.6);
  return Math.round(base * 2.4);
}

export function tierDps(def, tier) {
  if (!def) return 0;
  if (def.dps && def.dps[tier - 1] != null) return def.dps[tier - 1];
  if (def['DPS T' + tier] != null) return def['DPS T' + tier];
  const base = def.baseDps != null ? def.baseDps : def.Base_DPS != null ? def.Base_DPS : 0;
  if (tier === 1) return base;
  if (tier === 2) return base * 1.55;
  return base * 2.3;
}

// =========================================================================
// SNAPSHOT / RESTORE (for replay determinism verification)
// =========================================================================
export function snapshot(state) {
  // Deep clone the serializable portions. config is shared (read-only tables)
  // so we exclude it from the clone and re-attach on restore.
  const cfg = state.config;
  state.config = undefined;
  const json = JSON.stringify(state);
  state.config = cfg;
  return json;
}

export function restore(json, config) {
  const state = JSON.parse(json);
  state.config = config;
  return state;
}

// Structural hash for determinism assertions (cheap, order-sensitive).
export function hashState(state) {
  let h = 2166136261 >>> 0;
  const feed = (n) => {
    n = n | 0;
    h ^= n & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (n >>> 8) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (n >>> 16) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  };
  feed(state.tick);
  feed(Math.round(state.base.hp * 100));
  feed(Math.round(state.economy.gold * 100));
  feed(state.waves.current);
  feed(state.structures.length);
  feed(state.units.length);
  for (const u of state.units) {
    feed(u.id);
    feed(Math.round(u.x * 1000));
    feed(Math.round(u.y * 1000));
    feed(Math.round(u.hp * 100));
  }
  for (const s of state.structures) {
    feed(s.id);
    feed(Math.round(s.hp * 100));
    feed(s.tier);
  }
  return h >>> 0;
}