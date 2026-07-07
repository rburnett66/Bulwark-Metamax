// src/sim/lifecycle.js
// Structure lifecycle FSM:
//   Placing -> Building -> Complete -> (Damaged) -> Destroyed
//   plus Upgrading and Selling
//
// This module is a pure, deterministic set of helpers that operate on a
// structure entity's strict state. It NEVER touches rendering. The reducer
// (world.js) and step orchestration (step.js) call these functions to advance
// lifecycle timers and apply transitions.
//
// All timings/costs come from data tables (config.data.tables) — no hardcoded
// balance. Assumptions supply upgrade cost/hp/dps multipliers; structures table
// supplies build time, base cost, hp, etc.

export const LifecycleState = Object.freeze({
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  DESTROYED: 'Destroyed',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling',
});

// A structure is "operational" (can fire, be targeted as a live building)
// only while it is Complete or Damaged (or Upgrading — it keeps working while
// the tier rolls up, per typical TD behavior it can be paused; here we keep it
// firing at current tier during the upgrade for simplicity/determinism).
export function isOperational(structure) {
  return (
    structure.lifecycle === LifecycleState.COMPLETE ||
    structure.lifecycle === LifecycleState.DAMAGED ||
    structure.lifecycle === LifecycleState.UPGRADING
  );
}

// A structure blocks terrain / occupies slots while it exists (not destroyed,
// not still a pure ghost). Placing/Building already reserve space.
export function occupiesSpace(structure) {
  return structure.lifecycle !== LifecycleState.DESTROYED;
}

export function isAlive(structure) {
  return structure.lifecycle !== LifecycleState.DESTROYED;
}

// Damage threshold at which we flip Complete <-> Damaged (visual/state cue).
const DAMAGED_FRACTION = 0.6;

// ---------------------------------------------------------------------------
// Table access helpers
// ---------------------------------------------------------------------------

function getTables(config) {
  return (config && config.data && config.data.tables) || {};
}

function getStructureDef(config, defId) {
  const tables = getTables(config);
  const structs = tables.structures || {};
  // structures table may be keyed by id or be an array
  if (Array.isArray(structs)) {
    return structs.find((s) => s.id === defId || s.StructureID === defId) || null;
  }
  return structs[defId] || null;
}

function getAssumptions(config) {
  const tables = getTables(config);
  return tables.assumptions || {};
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Build time in sim seconds for a given def / tier.
export function buildTimeFor(config, defId, tier) {
  const def = getStructureDef(config, defId);
  const base = def ? num(def.buildTime, num(def.BuildTime, 3)) : 3;
  // upgrades take a fraction longer per tier
  if (tier && tier > 1) return base * (1 + 0.5 * (tier - 1));
  return base;
}

// HP for a def at a given tier (data-driven; falls back to Upgrade curves).
export function maxHpFor(config, defId, tier) {
  const def = getStructureDef(config, defId);
  const a = getAssumptions(config);
  if (!def) return 100;
  const base =
    num(def.hpT1, num(def.HP_T1, num(def.hp, num(def.HP, 100))));
  if (tier <= 1) return base;
  if (tier === 2) {
    const t2 = num(def.hpT2, num(def.HP_T2, base * num(a.Upgrade_HP_x_T2, 1.6)));
    return t2;
  }
  const t3 = num(def.hpT3, num(def.HP_T3, base * num(a.Upgrade_HP_x_T3, 2.4)));
  return t3;
}

// Cost to place tier1, or cumulative cost curve for upgrades.
export function baseCostFor(config, defId) {
  const def = getStructureDef(config, defId);
  if (!def) return 50;
  return num(def.costT1, num(def.Cost_T1, num(def.cost, num(def.Cost, 50))));
}

// Incremental cost to upgrade from current tier to next tier.
export function upgradeCostFor(config, defId, currentTier) {
  const def = getStructureDef(config, defId);
  const a = getAssumptions(config);
  const base = baseCostFor(config, defId);
  if (!def) return base;
  const c1 = base;
  const c2 = num(
    def.costT2,
    num(def.Cost_T2, base * num(a.Upgrade_Cost_x_T2, 2.5))
  );
  const c3 = num(
    def.costT3,
    num(def.Cost_T3, base * num(a.Upgrade_Cost_x_T3, 5))
  );
  if (currentTier === 1) return Math.round(c2 - c1);
  if (currentTier === 2) return Math.round(c3 - c2);
  return 0; // already max tier
}

// Total gold value invested in this structure at its current tier (for refund).
export function investedValueFor(config, defId, tier) {
  const def = getStructureDef(config, defId);
  const a = getAssumptions(config);
  const base = baseCostFor(config, defId);
  if (!def) return base;
  if (tier <= 1) return base;
  if (tier === 2)
    return num(def.costT2, num(def.Cost_T2, base * num(a.Upgrade_Cost_x_T2, 2.5)));
  return num(def.costT3, num(def.Cost_T3, base * num(a.Upgrade_Cost_x_T3, 5)));
}

// Partial refund on sell (data-driven; default 50%).
export function sellValueFor(config, defId, tier) {
  const def = getStructureDef(config, defId);
  const frac = def ? num(def.sellRefund, num(def.SellRefund, 0.5)) : 0.5;
  return Math.round(investedValueFor(config, defId, tier) * frac);
}

export const MAX_TIER = 3;

// ---------------------------------------------------------------------------
// Transition initiators (mutate the passed structure; caller handles economy)
// ---------------------------------------------------------------------------

// Create the lifecycle fields on a freshly-placed structure. The entity factory
// (entities.js) should call this so all structures share consistent shape.
export function initLifecycle(structure, config, defId, tier = 1) {
  structure.defId = defId;
  structure.tier = tier;
  structure.maxHp = maxHpFor(config, defId, tier);
  structure.hp = structure.maxHp;
  structure.lifecycle = LifecycleState.PLACING;
  structure.buildTimer = 0;
  structure.buildDuration = buildTimeFor(config, defId, tier);
  structure.upgradeTimer = 0;
  structure.upgradeDuration = 0;
  structure.upgradeTargetTier = tier;
  structure.sellTimer = 0;
  structure.sellDuration = num(getStructureDef(config, defId) &&
    getStructureDef(config, defId).sellTime, 0.4);
  structure.destroyTimer = 0;
  return structure;
}

// Confirm placement -> begin building. Returns true if state changed.
export function beginBuild(structure, config) {
  if (structure.lifecycle !== LifecycleState.PLACING) return false;
  structure.lifecycle = LifecycleState.BUILDING;
  structure.buildTimer = 0;
  structure.buildDuration = buildTimeFor(config, structure.defId, structure.tier);
  return true;
}

// Attempt to start an upgrade. Caller must have validated/charged cost.
export function beginUpgrade(structure, config) {
  if (!isOperational(structure)) return false;
  if (structure.lifecycle === LifecycleState.UPGRADING) return false;
  if (structure.tier >= MAX_TIER) return false;
  const nextTier = structure.tier + 1;
  structure.lifecycle = LifecycleState.UPGRADING;
  structure.upgradeTargetTier = nextTier;
  structure.upgradeTimer = 0;
  structure.upgradeDuration = buildTimeFor(config, structure.defId, nextTier);
  return true;
}

// Attempt to start selling. Caller grants refund when sale completes.
export function beginSell(structure /*, config */) {
  if (structure.lifecycle === LifecycleState.DESTROYED) return false;
  if (structure.lifecycle === LifecycleState.SELLING) return false;
  structure.lifecycle = LifecycleState.SELLING;
  structure.sellTimer = 0;
  return true;
}

// ---------------------------------------------------------------------------
// Damage / heal (deterministic, integer-friendly)
// ---------------------------------------------------------------------------

// Apply damage; returns amount actually applied. Flips to Damaged/Destroyed.
export function applyDamage(structure, amount) {
  if (!isAlive(structure)) return 0;
  if (
    structure.lifecycle === LifecycleState.PLACING ||
    structure.lifecycle === LifecycleState.SELLING
  ) {
    // ghosts / selling structures are not combat-live
    return 0;
  }
  const before = structure.hp;
  structure.hp = Math.max(0, structure.hp - Math.max(0, amount));
  const applied = before - structure.hp;

  if (structure.hp <= 0) {
    structure.hp = 0;
    structure.lifecycle = LifecycleState.DESTROYED;
    structure.destroyTimer = 0;
  } else if (
    structure.lifecycle === LifecycleState.COMPLETE ||
    structure.lifecycle === LifecycleState.UPGRADING
  ) {
    if (structure.hp < structure.maxHp * DAMAGED_FRACTION) {
      // stay in the same functional tier, but reflect Damaged if not upgrading
      if (structure.lifecycle === LifecycleState.COMPLETE) {
        structure.lifecycle = LifecycleState.DAMAGED;
      }
    }
  }
  return applied;
}

// Repair up by amount; used by repair.js when a troop finishes traveling.
export function applyRepair(structure, amount) {
  if (!isOperational(structure) && structure.lifecycle !== LifecycleState.BUILDING) {
    return 0;
  }
  const before = structure.hp;
  structure.hp = Math.min(structure.maxHp, structure.hp + Math.max(0, amount));
  const healed = structure.hp - before;
  if (
    structure.lifecycle === LifecycleState.DAMAGED &&
    structure.hp >= structure.maxHp * DAMAGED_FRACTION
  ) {
    structure.lifecycle = LifecycleState.COMPLETE;
  }
  return healed;
}

// Set structure fully repaired (timed free repair completion helper).
export function repairFull(structure) {
  structure.hp = structure.maxHp;
  if (structure.lifecycle === LifecycleState.DAMAGED) {
    structure.lifecycle = LifecycleState.COMPLETE;
  }
}

// ---------------------------------------------------------------------------
// Per-tick advancement of timers. Called every fixed step by step.js.
// Returns a list of lifecycle events (for battleLog + HUD feedback).
// dt is fixed sim delta in seconds.
// ---------------------------------------------------------------------------

export function advance(structure, dt, config) {
  const events = [];
  switch (structure.lifecycle) {
    case LifecycleState.BUILDING: {
      structure.buildTimer += dt;
      // during build, hp ramps so a fresh structure isn't instantly killable
      const frac = clamp01(structure.buildTimer / (structure.buildDuration || 1e-6));
      structure.hp = Math.max(
        structure.hp,
        Math.ceil(structure.maxHp * frac)
      );
      if (structure.buildTimer >= structure.buildDuration) {
        structure.lifecycle = LifecycleState.COMPLETE;
        structure.hp = structure.maxHp;
        structure.buildTimer = structure.buildDuration;
        events.push({ type: 'build_complete', id: structure.id });
      }
      break;
    }
    case LifecycleState.UPGRADING: {
      structure.upgradeTimer += dt;
      if (structure.upgradeTimer >= structure.upgradeDuration) {
        const newTier = structure.upgradeTargetTier;
        const oldMax = structure.maxHp;
        const hpFrac = oldMax > 0 ? structure.hp / oldMax : 1;
        structure.tier = newTier;
        structure.maxHp = maxHpFor(config, structure.defId, newTier);
        // preserve proportional hp, then top off (upgrade repairs)
        structure.hp = structure.maxHp;
        structure.upgradeTimer = structure.upgradeDuration;
        // recompute functional state
        structure.lifecycle =
          structure.hp < structure.maxHp * DAMAGED_FRACTION
            ? LifecycleState.DAMAGED
            : LifecycleState.COMPLETE;
        // (hpFrac retained conceptually; upgrade fully heals here)
        void hpFrac;
        events.push({
          type: 'upgrade_complete',
          id: structure.id,
          tier: newTier,
        });
      }
      break;
    }
    case LifecycleState.SELLING: {
      structure.sellTimer += dt;
      if (structure.sellTimer >= (structure.sellDuration || 0)) {
        structure.lifecycle = LifecycleState.DESTROYED;
        events.push({
          type: 'sell_complete',
          id: structure.id,
          refund: sellValueFor(config, structure.defId, structure.tier),
        });
      }
      break;
    }
    case LifecycleState.DESTROYED: {
      structure.destroyTimer += dt;
      break;
    }
    case LifecycleState.COMPLETE:
    case LifecycleState.DAMAGED:
    case LifecycleState.PLACING:
    default:
      break;
  }
  return events;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Fractional build/upgrade progress (0..1) for renderer read-only use.
export function progress(structure) {
  if (structure.lifecycle === LifecycleState.BUILDING) {
    return clamp01(structure.buildTimer / (structure.buildDuration || 1e-6));
  }
  if (structure.lifecycle === LifecycleState.UPGRADING) {
    return clamp01(structure.upgradeTimer / (structure.upgradeDuration || 1e-6));
  }
  if (structure.lifecycle === LifecycleState.SELLING) {
    return clamp01(structure.sellTimer / (structure.sellDuration || 1e-6));
  }
  return 1;
}

export function canUpgrade(structure) {
  return isOperational(structure) && structure.tier < MAX_TIER;
}

export function canSell(structure) {
  return (
    structure.lifecycle !== LifecycleState.DESTROYED &&
    structure.lifecycle !== LifecycleState.SELLING
  );
}

export default {
  LifecycleState,
  MAX_TIER,
  isOperational,
  occupiesSpace,
  isAlive,
  initLifecycle,
  beginBuild,
  beginUpgrade,
  beginSell,
  applyDamage,
  applyRepair,
  repairFull,
  advance,
  progress,
  canUpgrade,
  canSell,
  buildTimeFor,
  maxHpFor,
  baseCostFor,
  upgradeCostFor,
  investedValueFor,
  sellValueFor,
};