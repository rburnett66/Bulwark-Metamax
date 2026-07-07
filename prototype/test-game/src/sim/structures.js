// src/sim/structures.js
// Structure lifecycle state machine, placement validity, build timers,
// upgrade one tier, sell partial refund, free troop-travel repair jobs.

import { TABLES } from '../data/tables.js';
import { makeStructure } from '../sim/entities.js';
import { canPlaceStructureAt, occupyTiles, freeTiles, isSlotTile, tilesForFootprint } from '../sim/grid.js';
import { recomputePaths } from '../sim/pathing.js';
import { canAfford, spend, refund } from '../sim/economy.js';

// Lifecycle state constants
export const STRUCT_STATE = {
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  DESTROYED: 'Destroyed',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling',
};

const SELL_REFUND_FRACTION = 0.5; // partial refund
const SELL_TIME = 1.0;            // seconds to tear down
const REPAIR_RATE_FRACTION = 0.2; // fraction of max HP repaired per second once troop arrives
const REPAIR_TROOP_SPEED = 2.0;   // tiles per second the repair troop travels

function structDef(structId) {
  const def = TABLES.structures[structId] || (TABLES.structuresList || []).find((s) => s.id === structId);
  if (!def) throw new Error('Unknown structure id: ' + structId);
  return def;
}

function buildTimeFor(def, tier) {
  // Data-driven: buildTime from table, scaled slightly per tier if not specified per-tier
  if (def.buildTime != null) {
    return def.buildTime * (tier > 1 ? 0.75 : 1);
  }
  return 3;
}

function costFor(def, tier) {
  const t = tier || 1;
  if (def.costByTier && def.costByTier[t - 1] != null) return def.costByTier[t - 1];
  if (t === 1) return def.cost;
  const a = TABLES.assumptions;
  const mult = t === 2 ? a.Upgrade_Cost_x_T2 : a.Upgrade_Cost_x_T3;
  return Math.round(def.cost * mult);
}

export function upgradeCost(structure) {
  const def = structDef(structure.defId);
  const nextTier = structure.tier + 1;
  if (nextTier > (def.maxTier || 3)) return null;
  // Incremental cost = cumulative value at next tier - cumulative value at current tier
  return Math.max(0, costFor(def, nextTier) - costFor(def, structure.tier));
}

export function sellRefund(structure) {
  const def = structDef(structure.defId);
  const value = costFor(def, structure.tier);
  return Math.floor(value * SELL_REFUND_FRACTION);
}

// ---------------------------------------------------------------------------
// Placement validity: space + terrain + cost. Returns {ok, reason}
// ---------------------------------------------------------------------------
export function checkPlacement(state, structId, tx, ty) {
  const def = structDef(structId);
  const footprint = def.footprint || { w: 1, h: 1 };

  // Space + terrain check via grid
  const spaceOk = canPlaceStructureAt(state.grid, def, tx, ty);
  if (!spaceOk.ok) return { ok: false, reason: spaceOk.reason || 'blocked' };

  // Towers snap to hard-point slots; walls/moats go on terrain
  if (def.requiresSlot) {
    if (!isSlotTile(state.grid, tx, ty)) {
      return { ok: false, reason: 'must place on hard-point slot' };
    }
    // slot not already occupied by another structure
    for (const s of state.structures) {
      if (s.state === STRUCT_STATE.DESTROYED) continue;
      if (s.tx === tx && s.ty === ty) return { ok: false, reason: 'slot occupied' };
    }
  }

  // Cost check
  const cost = costFor(def, 1);
  if (!canAfford(state, cost)) {
    return { ok: false, reason: 'insufficient funds', cost };
  }

  return { ok: true, cost, footprint };
}

// ---------------------------------------------------------------------------
// Place a structure: deduct cost, enter Building state with a timer.
// Emits events into state.events. Returns the structure or null.
// ---------------------------------------------------------------------------
export function placeStructure(state, structId, tx, ty) {
  const check = checkPlacement(state, structId, tx, ty);
  if (!check.ok) {
    state.events.push({ tick: state.tick, type: 'placeRejected', structId, tx, ty, reason: check.reason });
    return null;
  }

  const def = structDef(structId);
  const cost = costFor(def, 1);
  spend(state, cost, 'build:' + structId);

  const structure = makeStructure(def, tx, ty, state.nextEntityId++);
  structure.defId = def.id;
  structure.state = STRUCT_STATE.BUILDING;
  structure.buildTimer = buildTimeFor(def, 1);
  structure.buildTotal = structure.buildTimer;
  structure.tier = 1;
  structure.hp = 0; // HP rises as it builds
  structure.repairJob = null;

  state.structures.push(structure);

  // Occupy tiles; walls/moats affect walker pathing immediately
  occupyTiles(state.grid, structure, tilesForFootprint(def.footprint || { w: 1, h: 1 }, tx, ty));
  if (def.blocksWalkers || def.isWall || def.isMoat) {
    recomputePaths(state);
  }

  state.events.push({ tick: state.tick, type: 'placed', id: structure.id, structId, tx, ty, cost });
  return structure;
}

// ---------------------------------------------------------------------------
// Upgrade one tier: deduct incremental cost, enter Upgrading state.
// ---------------------------------------------------------------------------
export function startUpgrade(state, structure) {
  if (!structure) return false;
  if (structure.state !== STRUCT_STATE.COMPLETE && structure.state !== STRUCT_STATE.DAMAGED) {
    state.events.push({ tick: state.tick, type: 'upgradeRejected', id: structure.id, reason: 'not ready' });
    return false;
  }
  const def = structDef(structure.defId);
  if (structure.tier >= (def.maxTier || 3)) {
    state.events.push({ tick: state.tick, type: 'upgradeRejected', id: structure.id, reason: 'max tier' });
    return false;
  }
  const cost = upgradeCost(structure);
  if (cost == null || !canAfford(state, cost)) {
    state.events.push({ tick: state.tick, type: 'upgradeRejected', id: structure.id, reason: 'insufficient funds' });
    return false;
  }
  spend(state, cost, 'upgrade:' + structure.defId);
  structure.prevState = structure.hp < structure.maxHp ? STRUCT_STATE.DAMAGED : STRUCT_STATE.COMPLETE;
  structure.state = STRUCT_STATE.UPGRADING;
  structure.buildTimer = buildTimeFor(def, structure.tier + 1);
  structure.buildTotal = structure.buildTimer;
  state.events.push({ tick: state.tick, type: 'upgradeStarted', id: structure.id, toTier: structure.tier + 1, cost });
  return true;
}

// ---------------------------------------------------------------------------
// Sell: partial refund, enter Selling state then remove.
// ---------------------------------------------------------------------------
export function startSell(state, structure) {
  if (!structure) return false;
  if (structure.state === STRUCT_STATE.DESTROYED || structure.state === STRUCT_STATE.SELLING) {
    return false;
  }
  const amount = sellRefund(structure);
  structure.state = STRUCT_STATE.SELLING;
  structure.sellTimer = SELL_TIME;
  structure.sellRefundAmount = amount;
  cancelRepairJob(state, structure);
  state.events.push({ tick: state.tick, type: 'sellStarted', id: structure.id, refund: amount });
  return true;
}

// ---------------------------------------------------------------------------
// Repairs: free but require a troop to travel from the base to the structure.
// Repair job phases: 'travel' -> 'repairing' -> done.
// ---------------------------------------------------------------------------
export function requestRepair(state, structure) {
  if (!structure) return false;
  if (structure.state !== STRUCT_STATE.DAMAGED && structure.state !== STRUCT_STATE.COMPLETE) {
    state.events.push({ tick: state.tick, type: 'repairRejected', id: structure.id, reason: 'not repairable' });
    return false;
  }
  if (structure.hp >= structure.maxHp) {
    state.events.push({ tick: state.tick, type: 'repairRejected', id: structure.id, reason: 'full hp' });
    return false;
  }
  if (structure.repairJob) {
    return false; // already has a repair job
  }
  const base = state.base;
  const dx = structure.tx - base.tx;
  const dy = structure.ty - base.ty;
  const dist = Math.sqrt(dx * dx + dy * dy);
  structure.repairJob = {
    phase: 'travel',
    x: base.tx,
    y: base.ty,
    travelRemaining: dist,
    totalDist: dist,
    targetId: structure.id,
  };
  state.events.push({ tick: state.tick, type: 'repairDispatched', id: structure.id, dist });
  return true;
}

function cancelRepairJob(state, structure) {
  if (structure.repairJob) {
    structure.repairJob = null;
    state.events.push({ tick: state.tick, type: 'repairCancelled', id: structure.id });
  }
}

// ---------------------------------------------------------------------------
// Damage handling — called by combat when a structure takes a hit.
// ---------------------------------------------------------------------------
export function damageStructure(state, structure, amount) {
  if (structure.state === STRUCT_STATE.DESTROYED) return;
  structure.hp -= amount;
  if (structure.hp <= 0) {
    structure.hp = 0;
    destroyStructure(state, structure);
  } else if (structure.state === STRUCT_STATE.COMPLETE) {
    structure.state = STRUCT_STATE.DAMAGED;
    state.events.push({ tick: state.tick, type: 'structDamaged', id: structure.id });
  }
}

function destroyStructure(state, structure) {
  structure.state = STRUCT_STATE.DESTROYED;
  cancelRepairJob(state, structure);
  const def = structDef(structure.defId);
  freeTiles(state.grid, structure, tilesForFootprint(def.footprint || { w: 1, h: 1 }, structure.tx, structure.ty));
  if (def.blocksWalkers || def.isWall || def.isMoat) {
    recomputePaths(state);
  }
  state.events.push({ tick: state.tick, type: 'structDestroyed', id: structure.id });
}

function removeStructure(state, structure) {
  const def = structDef(structure.defId);
  freeTiles(state.grid, structure, tilesForFootprint(def.footprint || { w: 1, h: 1 }, structure.tx, structure.ty));
  const idx = state.structures.indexOf(structure);
  if (idx >= 0) state.structures.splice(idx, 1);
  if (def.blocksWalkers || def.isWall || def.isMoat) {
    recomputePaths(state);
  }
}

// ---------------------------------------------------------------------------
// Per-tick update: build timers, upgrade timers, sell timers, repair jobs.
// dt in seconds (fixed timestep).
// ---------------------------------------------------------------------------
export function updateStructures(state, dt) {
  for (let i = state.structures.length - 1; i >= 0; i--) {
    const s = state.structures[i];

    switch (s.state) {
      case STRUCT_STATE.BUILDING: {
        s.buildTimer -= dt;
        // HP rises proportionally with build progress
        const progress = Math.min(1, 1 - Math.max(0, s.buildTimer) / s.buildTotal);
        s.hp = Math.max(s.hp, Math.floor(s.maxHp * progress));
        if (s.buildTimer <= 0) {
          s.buildTimer = 0;
          s.hp = s.maxHp;
          s.state = STRUCT_STATE.COMPLETE;
          state.events.push({ tick: state.tick, type: 'buildComplete', id: s.id });
        }
        break;
      }

      case STRUCT_STATE.UPGRADING: {
        s.buildTimer -= dt;
        if (s.buildTimer <= 0) {
          s.buildTimer = 0;
          applyTierUp(state, s);
        }
        break;
      }

      case STRUCT_STATE.SELLING: {
        s.sellTimer -= dt;
        if (s.sellTimer <= 0) {
          refund(state, s.sellRefundAmount, 'sell:' + s.defId);
          state.events.push({ tick: state.tick, type: 'sold', id: s.id, refund: s.sellRefundAmount });
          removeStructure(state, s);
        }
        break;
      }

      case STRUCT_STATE.COMPLETE:
      case STRUCT_STATE.DAMAGED: {
        updateRepairJob(state, s, dt);
        // Damaged -> Complete when fully repaired
        if (s.state === STRUCT_STATE.DAMAGED && s.hp >= s.maxHp) {
          s.hp = s.maxHp;
          s.state = STRUCT_STATE.COMPLETE;
          state.events.push({ tick: state.tick, type: 'repairComplete', id: s.id });
        }
        break;
      }

      case STRUCT_STATE.DESTROYED: {
        // Destroyed structures linger as rubble for the renderer; keep them.
        break;
      }
    }
  }
}

function applyTierUp(state, s) {
  const def = structDef(s.defId);
  const a = TABLES.assumptions;
  const newTier = s.tier + 1;
  const hpMult = newTier === 2 ? a.Upgrade_HP_x_T2 : a.Upgrade_HP_x_T3;
  const dpsMult = newTier === 2 ? a.Upgrade_DPS_x_T2 : a.Upgrade_DPS_x_T3;

  const hpFrac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
  const baseHp = def.hpByTier && def.hpByTier[newTier - 1] != null
    ? def.hpByTier[newTier - 1]
    : Math.round(def.hp * hpMult);
  const baseDps = def.dpsByTier && def.dpsByTier[newTier - 1] != null
    ? def.dpsByTier[newTier - 1]
    : def.dps * dpsMult;

  s.tier = newTier;
  s.maxHp = baseHp;
  s.hp = Math.round(baseHp * Math.max(hpFrac, 0.999)); // upgrade completes fully repaired if it was full
  if (s.hp > s.maxHp) s.hp = s.maxHp;
  s.dps = baseDps;
  s.state = s.hp < s.maxHp ? STRUCT_STATE.DAMAGED : STRUCT_STATE.COMPLETE;
  state.events.push({ tick: state.tick, type: 'upgradeComplete', id: s.id, tier: s.tier });
}

function updateRepairJob(state, s, dt) {
  const job = s.repairJob;
  if (!job) return;

  if (job.phase === 'travel') {
    const step = REPAIR_TROOP_SPEED * dt;
    job.travelRemaining -= step;
    // interpolate position for the renderer
    const t = job.totalDist > 0 ? 1 - Math.max(0, job.travelRemaining) / job.totalDist : 1;
    job.x = state.base.tx + (s.tx - state.base.tx) * t;
    job.y = state.base.ty + (s.ty - state.base.ty) * t;
    if (job.travelRemaining <= 0) {
      job.phase = 'repairing';
      job.x = s.tx;
      job.y = s.ty;
      state.events.push({ tick: state.tick, type: 'repairArrived', id: s.id });
    }
  } else if (job.phase === 'repairing') {
    // Free repair: no gold cost, takes time
    const heal = s.maxHp * REPAIR_RATE_FRACTION * dt;
    s.hp = Math.min(s.maxHp, s.hp + heal);
    if (s.hp >= s.maxHp) {
      s.hp = s.maxHp;
      s.repairJob = null;
      if (s.state === STRUCT_STATE.DAMAGED) {
        s.state = STRUCT_STATE.COMPLETE;
      }
      state.events.push({ tick: state.tick, type: 'repairComplete', id: s.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Query helpers used by combat / renderer / HUD
// ---------------------------------------------------------------------------
export function isOperational(structure) {
  return structure.state === STRUCT_STATE.COMPLETE || structure.state === STRUCT_STATE.DAMAGED;
}

export function isTargetable(structure) {
  return structure.state !== STRUCT_STATE.DESTROYED && structure.state !== STRUCT_STATE.SELLING && structure.state !== STRUCT_STATE.PLACING;
}

export function getStructureById(state, id) {
  for (const s of state.structures) {
    if (s.id === id) return s;
  }
  return null;
}

export function structureAtTile(state, tx, ty) {
  for (const s of state.structures) {
    if (s.state === STRUCT_STATE.DESTROYED) continue;
    const def = structDef(s.defId);
    const fp = def.footprint || { w: 1, h: 1 };
    if (tx >= s.tx && tx < s.tx + fp.w && ty >= s.ty && ty < s.ty + fp.h) return s;
  }
  return null;
}

export function buildProgress(structure) {
  if (structure.state === STRUCT_STATE.BUILDING || structure.state === STRUCT_STATE.UPGRADING) {
    if (!structure.buildTotal) return 1;
    return Math.min(1, 1 - structure.buildTimer / structure.buildTotal);
  }
  return 1;
}

export function structureCost(structId) {
  return costFor(structDef(structId), 1);
}