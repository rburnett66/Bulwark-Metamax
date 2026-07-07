// src/sim/commands.js
// Input command definitions applied to the deterministic sim.
// Commands are pure data descriptors + apply functions. Every command that
// mutates the sim is logged (see log.js) so replay can re-drive the core.
//
// Command shapes (all serializable):
//   { type: 'place',     structureId, slotIndex }
//   { type: 'select',    entityId | null }
//   { type: 'upgrade',   entityId }
//   { type: 'sell',      entityId }
//   { type: 'repair',    entityId }
//   { type: 'deploy',    unitId, x, y }
//   { type: 'startWave' }
//
// apply(sim, cmd) mutates sim.state deterministically and returns a result
// { ok:boolean, reason?:string, ... }. It DOES NOT log; the driver (commands
// queue in step / main) is responsible for logging accepted inputs so the
// replay stream matches exactly. Use applyAndLog() to do both.

import * as lifecycle from './lifecycle.js';
import * as economy from './economy.js';
import * as entities from './entities.js';
import * as spawn from './spawn.js';
import * as waves from './waves.js';
import * as placement from '../input/placement.js';

// ------------------------------------------------------------------
// Command constructors (factory helpers) — keep shapes canonical.
// ------------------------------------------------------------------

export const CommandTypes = Object.freeze({
  PLACE: 'place',
  SELECT: 'select',
  UPGRADE: 'upgrade',
  SELL: 'sell',
  REPAIR: 'repair',
  DEPLOY: 'deploy',
  START_WAVE: 'startWave',
});

export function cmdPlace(structureId, slotIndex) {
  return { type: CommandTypes.PLACE, structureId, slotIndex };
}
export function cmdSelect(entityId) {
  return { type: CommandTypes.SELECT, entityId: entityId ?? null };
}
export function cmdUpgrade(entityId) {
  return { type: CommandTypes.UPGRADE, entityId };
}
export function cmdSell(entityId) {
  return { type: CommandTypes.SELL, entityId };
}
export function cmdRepair(entityId) {
  return { type: CommandTypes.REPAIR, entityId };
}
export function cmdDeploy(unitId, x, y) {
  return { type: CommandTypes.DEPLOY, unitId, x, y };
}
export function cmdStartWave() {
  return { type: CommandTypes.START_WAVE };
}

// ------------------------------------------------------------------
// Data table lookup helpers
// ------------------------------------------------------------------

function tables(sim) {
  return (sim.config && sim.config.data && sim.config.data.tables) || {};
}

function findStructureDef(sim, structureId) {
  const t = tables(sim);
  const list = (t.structures && (t.structures.list || t.structures)) || [];
  if (Array.isArray(list)) {
    return list.find((s) => s.id === structureId || s.StructureID === structureId);
  }
  return list[structureId] || null;
}

function findUnitDef(sim, unitId) {
  const t = tables(sim);
  const list = (t.units && (t.units.list || t.units)) || [];
  if (Array.isArray(list)) {
    return list.find((u) => u.id === unitId || u.UnitID === unitId);
  }
  return list[unitId] || null;
}

// ------------------------------------------------------------------
// Individual command handlers
// ------------------------------------------------------------------

function applyPlace(sim, cmd) {
  const state = sim.state;
  const def = findStructureDef(sim, cmd.structureId);
  if (!def) return { ok: false, reason: 'unknown-structure' };

  const slotIndex = cmd.slotIndex;
  const slots = state.slots || [];
  if (slotIndex == null || slotIndex < 0 || slotIndex >= slots.length) {
    return { ok: false, reason: 'bad-slot' };
  }
  const slot = slots[slotIndex];
  if (!slot) return { ok: false, reason: 'bad-slot' };

  // Deploy validity check: space (slot occupied?), terrain, cost.
  if (slot.occupiedBy != null) {
    return { ok: false, reason: 'slot-occupied' };
  }

  const cost = economy.structureCost(sim, def, 1);
  if (!economy.canAfford(sim, cost)) {
    return { ok: false, reason: 'insufficient-funds' };
  }

  // Extra placement validity (terrain rules) delegated to placement module.
  const valid = placement.isValidPlacement
    ? placement.isValidPlacement(sim, def, slot)
    : true;
  if (!valid) {
    return { ok: false, reason: 'invalid-terrain' };
  }

  // Spend, create structure entity in Placing→Building lifecycle.
  economy.spend(sim, cost, 'build');
  const ent = entities.createStructure(sim, def, {
    x: slot.x,
    y: slot.y,
    slotIndex,
    footprint: def.footprint || { w: 1, h: 1 },
  });
  slot.occupiedBy = ent.id;
  lifecycle.beginBuild(sim, ent, def);

  // Walls/moats reroute walkers — trigger recompute.
  if (ent.blocksGround || def.terrain) {
    if (sim.pathing && sim.pathing.markDirty) sim.pathing.markDirty(sim);
  }

  return { ok: true, entityId: ent.id };
}

function applySelect(sim, cmd) {
  const state = sim.state;
  const id = cmd.entityId ?? null;
  if (id == null) {
    state.selectedId = null;
    return { ok: true, entityId: null };
  }
  const ent = state.entitiesById && state.entitiesById[id];
  if (!ent) {
    state.selectedId = null;
    return { ok: false, reason: 'no-entity' };
  }
  state.selectedId = id;
  return { ok: true, entityId: id };
}

function applyUpgrade(sim, cmd) {
  const state = sim.state;
  const ent = state.entitiesById && state.entitiesById[cmd.entityId];
  if (!ent) return { ok: false, reason: 'no-entity' };
  if (!ent.isStructure) return { ok: false, reason: 'not-structure' };
  if (ent.lifecycle !== 'Complete' && ent.lifecycle !== 'Damaged') {
    return { ok: false, reason: 'not-ready' };
  }
  if (ent.tier >= 3) return { ok: false, reason: 'max-tier' };
  if (ent.lifecycle === 'Upgrading') return { ok: false, reason: 'busy' };

  const def = findStructureDef(sim, ent.defId);
  if (!def) return { ok: false, reason: 'unknown-structure' };

  const nextTier = ent.tier + 1;
  const cost = economy.structureUpgradeCost(sim, def, ent.tier, nextTier);
  if (!economy.canAfford(sim, cost)) {
    return { ok: false, reason: 'insufficient-funds' };
  }

  economy.spend(sim, cost, 'upgrade');
  lifecycle.beginUpgrade(sim, ent, def, nextTier);
  return { ok: true, entityId: ent.id, tier: nextTier };
}

function applySell(sim, cmd) {
  const state = sim.state;
  const ent = state.entitiesById && state.entitiesById[cmd.entityId];
  if (!ent) return { ok: false, reason: 'no-entity' };
  if (!ent.isStructure) return { ok: false, reason: 'not-structure' };
  if (ent.lifecycle === 'Selling' || ent.lifecycle === 'Destroyed') {
    return { ok: false, reason: 'busy' };
  }

  const def = findStructureDef(sim, ent.defId);
  const refund = economy.sellRefund(sim, ent, def);

  // Free the slot immediately for placement logic parity; entity plays out
  // Selling lifecycle then Destroyed.
  const slotIndex = ent.slotIndex;
  if (slotIndex != null && state.slots && state.slots[slotIndex]) {
    state.slots[slotIndex].occupiedBy = null;
  }
  economy.grant(sim, refund, 'sell');
  lifecycle.beginSell(sim, ent, def);

  if (ent.blocksGround) {
    if (sim.pathing && sim.pathing.markDirty) sim.pathing.markDirty(sim);
  }

  if (state.selectedId === ent.id) state.selectedId = null;
  return { ok: true, entityId: ent.id, refund };
}

function applyRepair(sim, cmd) {
  const state = sim.state;
  const ent = state.entitiesById && state.entitiesById[cmd.entityId];
  if (!ent) return { ok: false, reason: 'no-entity' };
  if (!ent.isStructure) return { ok: false, reason: 'not-structure' };
  if (ent.lifecycle !== 'Damaged') return { ok: false, reason: 'not-damaged' };
  if (ent.repairing) return { ok: false, reason: 'already-repairing' };

  // Repairs are free but consume a troop that must travel to the structure.
  const troop = spawn.reserveRepairTroop
    ? spawn.reserveRepairTroop(sim, ent)
    : null;
  if (!troop) {
    return { ok: false, reason: 'no-troop' };
  }
  lifecycle.beginRepair(sim, ent, troop);
  return { ok: true, entityId: ent.id };
}

function applyDeploy(sim, cmd) {
  const def = findUnitDef(sim, cmd.unitId);
  if (!def) return { ok: false, reason: 'unknown-unit' };

  const cost = economy.unitCost(sim, def, 1);
  if (!economy.canAfford(sim, cost)) {
    return { ok: false, reason: 'insufficient-funds' };
  }

  // Deploy validity: destination reachable / in-bounds / valid terrain.
  const dest = { x: cmd.x, y: cmd.y };
  const valid = spawn.isValidDeploy
    ? spawn.isValidDeploy(sim, def, dest)
    : true;
  if (!valid) {
    return { ok: false, reason: 'invalid-drop' };
  }

  economy.spend(sim, cost, 'deploy');
  const unit = spawn.deployUnit(sim, def, dest);
  return { ok: true, entityId: unit ? unit.id : null };
}

function applyStartWave(sim /*, cmd */) {
  const res = waves.startWave(sim);
  return res && res.ok !== undefined
    ? res
    : { ok: true, wave: sim.state.waves ? sim.state.waves.current : 0 };
}

// ------------------------------------------------------------------
// Dispatch
// ------------------------------------------------------------------

const HANDLERS = {
  [CommandTypes.PLACE]: applyPlace,
  [CommandTypes.SELECT]: applySelect,
  [CommandTypes.UPGRADE]: applyUpgrade,
  [CommandTypes.SELL]: applySell,
  [CommandTypes.REPAIR]: applyRepair,
  [CommandTypes.DEPLOY]: applyDeploy,
  [CommandTypes.START_WAVE]: applyStartWave,
};

/**
 * Apply a command to the sim WITHOUT logging.
 * Returns a result object { ok, reason?, ... }.
 */
export function apply(sim, cmd) {
  if (!cmd || !cmd.type) return { ok: false, reason: 'bad-command' };
  const handler = HANDLERS[cmd.type];
  if (!handler) return { ok: false, reason: 'unknown-command' };
  try {
    return handler(sim, cmd) || { ok: true };
  } catch (err) {
    return { ok: false, reason: 'exception', error: String(err) };
  }
}

/**
 * Apply a command and, if accepted (and it mutates state), record it into the
 * battle log stream at the current tick for deterministic replay.
 * 'select' is a UI-only command and is NOT logged (it never affects sim state
 * hash) — but we log everything else that succeeds.
 */
export function applyAndLog(sim, cmd) {
  const res = apply(sim, cmd);
  if (res.ok && cmd.type !== CommandTypes.SELECT) {
    if (sim.log && sim.log.recordInput) {
      const tick = sim.state && sim.state.tick != null ? sim.state.tick : 0;
      sim.log.recordInput(tick, cmd);
    }
  }
  return res;
}

/**
 * Drain a queue of commands (used by step.js before advancing systems).
 * Commands here are assumed to already be recorded (during live play) or
 * being replayed from the log (during replay). This applies WITHOUT logging.
 */
export function applyQueue(sim, queue) {
  const results = [];
  if (!queue || !queue.length) return results;
  for (let i = 0; i < queue.length; i++) {
    results.push(apply(sim, queue[i]));
  }
  queue.length = 0;
  return results;
}

export default {
  CommandTypes,
  cmdPlace,
  cmdSelect,
  cmdUpgrade,
  cmdSell,
  cmdRepair,
  cmdDeploy,
  cmdStartWave,
  apply,
  applyAndLog,
  applyQueue,
};