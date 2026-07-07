// src/sim/commands.js
// Command schema for the BULWARK deterministic sim.
// Commands are plain, serializable data objects that get recorded into the
// battle log and re-driven during replay. They are the ONLY authorized way to
// mutate world state (via world.js reducer). Nothing here mutates state; this
// module only defines/validates/normalizes command payloads.

// ---------------------------------------------------------------------------
// Command type constants
// ---------------------------------------------------------------------------

export const CommandTypes = Object.freeze({
  PLACE: 'place',          // place a structure at a slot
  SELECT: 'select',        // select a structure / entity (UI-driven, but recorded)
  UPGRADE: 'upgrade',      // upgrade a structure one tier
  SELL: 'sell',            // sell a structure for partial refund
  DEPLOY: 'deploy',        // deploy a troop that marches to a drop location
  START_WAVE: 'startWave', // begin the next wave
  REPAIR: 'repair',        // repair a structure (troop-based, timed)
  TARGET: 'target',        // set a structure's target priority / manual target
  SET_SPEED: 'setSpeed',   // sim speed control (recorded for determinism parity)
  PAUSE: 'pause',          // pause/resume toggle (recorded)
});

export const ALL_COMMAND_TYPES = Object.freeze(Object.values(CommandTypes));

// Valid target-priority modes for the TARGET command.
export const TargetModes = Object.freeze({
  FIRST: 'first',     // furthest along path toward base
  LAST: 'last',       // least along path
  NEAREST: 'nearest', // closest to the tower
  STRONGEST: 'strongest', // highest hp
  WEAKEST: 'weakest', // lowest hp
  MANUAL: 'manual',   // explicit entity id
});

export const ALL_TARGET_MODES = Object.freeze(Object.values(TargetModes));

// ---------------------------------------------------------------------------
// Small validation helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}
function isInt(v) {
  return isFiniteNumber(v) && Math.floor(v) === v;
}

// ---------------------------------------------------------------------------
// Command factory functions
// Each returns a normalized, plain-object command. `issuedBy` distinguishes
// 'player' vs 'system' (e.g., automated wave spawns / harness) so the replay
// can reproduce exactly.
// ---------------------------------------------------------------------------

/**
 * PLACE — request to build a structure.
 * @param {object} p
 * @param {string} p.structureType  key into config.data.tables.structures
 * @param {number} p.slot           hard-point slot index
 * @param {string} [p.issuedBy='player']
 */
export function place({ structureType, slot, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.PLACE,
    structureType,
    slot,
    issuedBy,
  };
}

/**
 * SELECT — mark an entity/structure as selected.
 * @param {object} p
 * @param {?string} p.id  entity id, or null to clear selection
 */
export function select({ id = null, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.SELECT,
    id,
    issuedBy,
  };
}

/**
 * UPGRADE — advance a structure one tier.
 */
export function upgrade({ id, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.UPGRADE,
    id,
    issuedBy,
  };
}

/**
 * SELL — remove a structure for partial refund.
 */
export function sell({ id, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.SELL,
    id,
    issuedBy,
  };
}

/**
 * DEPLOY — spawn a troop at base that marches to a drop location.
 * (The drop point is a DESTINATION order, not a spawn point.)
 * @param {object} p
 * @param {string} p.unitType  key into config.data.tables.units
 * @param {number} p.x         world/tile x destination
 * @param {number} p.y         world/tile y destination
 */
export function deploy({ unitType, x, y, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.DEPLOY,
    unitType,
    x,
    y,
    issuedBy,
  };
}

/**
 * START_WAVE — begin the next wave.
 */
export function startWave({ issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.START_WAVE,
    issuedBy,
  };
}

/**
 * REPAIR — request a troop-based, timed repair on a structure.
 */
export function repair({ id, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.REPAIR,
    id,
    issuedBy,
  };
}

/**
 * TARGET — set a structure's targeting mode (and optional manual target).
 * @param {object} p
 * @param {string} p.id            structure id
 * @param {string} p.mode          one of TargetModes
 * @param {?string} [p.targetId]   required when mode === MANUAL
 */
export function target({ id, mode = TargetModes.FIRST, targetId = null, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.TARGET,
    id,
    mode,
    targetId,
    issuedBy,
  };
}

/**
 * SET_SPEED — sim speed multiplier (1 = normal). Recorded for parity.
 */
export function setSpeed({ speed = 1, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.SET_SPEED,
    speed,
    issuedBy,
  };
}

/**
 * PAUSE — toggle/set paused state. Recorded for parity.
 */
export function pause({ paused = true, issuedBy = 'player' } = {}) {
  return {
    type: CommandTypes.PAUSE,
    paused: !!paused,
    issuedBy,
  };
}

// ---------------------------------------------------------------------------
// Validation
// Returns { ok:true } or { ok:false, reason:'...' }.
// The world reducer uses this before applying; invalid commands are dropped
// (but still may be logged as rejected for debugging).
// ---------------------------------------------------------------------------

export function validate(cmd) {
  if (!cmd || typeof cmd !== 'object') {
    return { ok: false, reason: 'command is not an object' };
  }
  if (!isNonEmptyString(cmd.type)) {
    return { ok: false, reason: 'missing command type' };
  }
  if (!ALL_COMMAND_TYPES.includes(cmd.type)) {
    return { ok: false, reason: `unknown command type: ${cmd.type}` };
  }

  switch (cmd.type) {
    case CommandTypes.PLACE:
      if (!isNonEmptyString(cmd.structureType)) {
        return { ok: false, reason: 'place: missing structureType' };
      }
      if (!isInt(cmd.slot) || cmd.slot < 0) {
        return { ok: false, reason: 'place: slot must be a non-negative integer' };
      }
      return { ok: true };

    case CommandTypes.SELECT:
      if (cmd.id !== null && !isNonEmptyString(cmd.id)) {
        return { ok: false, reason: 'select: id must be a string or null' };
      }
      return { ok: true };

    case CommandTypes.UPGRADE:
      if (!isNonEmptyString(cmd.id)) {
        return { ok: false, reason: 'upgrade: missing id' };
      }
      return { ok: true };

    case CommandTypes.SELL:
      if (!isNonEmptyString(cmd.id)) {
        return { ok: false, reason: 'sell: missing id' };
      }
      return { ok: true };

    case CommandTypes.DEPLOY:
      if (!isNonEmptyString(cmd.unitType)) {
        return { ok: false, reason: 'deploy: missing unitType' };
      }
      if (!isFiniteNumber(cmd.x) || !isFiniteNumber(cmd.y)) {
        return { ok: false, reason: 'deploy: x/y must be finite numbers' };
      }
      return { ok: true };

    case CommandTypes.START_WAVE:
      return { ok: true };

    case CommandTypes.REPAIR:
      if (!isNonEmptyString(cmd.id)) {
        return { ok: false, reason: 'repair: missing id' };
      }
      return { ok: true };

    case CommandTypes.TARGET:
      if (!isNonEmptyString(cmd.id)) {
        return { ok: false, reason: 'target: missing id' };
      }
      if (!ALL_TARGET_MODES.includes(cmd.mode)) {
        return { ok: false, reason: `target: invalid mode ${cmd.mode}` };
      }
      if (cmd.mode === TargetModes.MANUAL && !isNonEmptyString(cmd.targetId)) {
        return { ok: false, reason: 'target: manual mode requires targetId' };
      }
      return { ok: true };

    case CommandTypes.SET_SPEED:
      if (!isFiniteNumber(cmd.speed) || cmd.speed <= 0) {
        return { ok: false, reason: 'setSpeed: speed must be a positive number' };
      }
      return { ok: true };

    case CommandTypes.PAUSE:
      if (typeof cmd.paused !== 'boolean') {
        return { ok: false, reason: 'pause: paused must be boolean' };
      }
      return { ok: true };

    default:
      return { ok: false, reason: `unhandled command type: ${cmd.type}` };
  }
}

// ---------------------------------------------------------------------------
// Normalization
// Produces a canonical plain object with only the fields relevant to the type,
// so log entries are stable and comparable across runs.
// ---------------------------------------------------------------------------

export function normalize(cmd) {
  if (!cmd || typeof cmd !== 'object') return null;
  const issuedBy = isNonEmptyString(cmd.issuedBy) ? cmd.issuedBy : 'player';

  switch (cmd.type) {
    case CommandTypes.PLACE:
      return place({ structureType: cmd.structureType, slot: cmd.slot, issuedBy });
    case CommandTypes.SELECT:
      return select({ id: cmd.id ?? null, issuedBy });
    case CommandTypes.UPGRADE:
      return upgrade({ id: cmd.id, issuedBy });
    case CommandTypes.SELL:
      return sell({ id: cmd.id, issuedBy });
    case CommandTypes.DEPLOY:
      return deploy({ unitType: cmd.unitType, x: cmd.x, y: cmd.y, issuedBy });
    case CommandTypes.START_WAVE:
      return startWave({ issuedBy });
    case CommandTypes.REPAIR:
      return repair({ id: cmd.id, issuedBy });
    case CommandTypes.TARGET:
      return target({ id: cmd.id, mode: cmd.mode, targetId: cmd.targetId ?? null, issuedBy });
    case CommandTypes.SET_SPEED:
      return setSpeed({ speed: cmd.speed, issuedBy });
    case CommandTypes.PAUSE:
      return pause({ paused: cmd.paused, issuedBy });
    default:
      return null;
  }
}

/**
 * Convenience: validate + normalize together.
 * @returns {{ok:true, command:object} | {ok:false, reason:string}}
 */
export function prepare(cmd) {
  const v = validate(cmd);
  if (!v.ok) return v;
  const command = normalize(cmd);
  if (!command) return { ok: false, reason: 'normalization failed' };
  return { ok: true, command };
}

// Aggregate export mirroring the factory names for ergonomic imports.
export const Commands = Object.freeze({
  place,
  select,
  upgrade,
  sell,
  deploy,
  startWave,
  repair,
  target,
  setSpeed,
  pause,
  validate,
  normalize,
  prepare,
  Types: CommandTypes,
  TargetModes,
});

export default Commands;