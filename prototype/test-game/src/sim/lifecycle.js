// src/sim/lifecycle.js
// Structure lifecycle transitions:
//   Placing -> Building -> Complete -> Damaged -> Destroyed
//   plus Upgrading, Selling, and Repair.
//
// This module is HEADLESS and DETERMINISTIC. It never touches rendering.
// It mutates strict sim state (entities/economy) only, in fixed order,
// stepped by the sim step loop.
//
// State machine (per structure entity):
//
//   PLACING    - transient authoring state before a build is committed.
//                (Placement previews live in input/placement.js; a committed
//                 build lands directly in BUILDING via beginBuild().)
//   BUILDING   - build timer counting up; structure inert (no fire),
//                partial HP shown. On completion -> COMPLETE.
//   COMPLETE   - fully operational; can fire, take damage, upgrade, sell,
//                or become DAMAGED.
//   DAMAGED    - hp below the damaged threshold but > 0; still operational.
//                Repair returns it toward COMPLETE.
//   UPGRADING  - upgrade timer counting up; still operational at old tier's
//                stats until completion; on completion tier increments and
//                stats scale.
//   SELLING    - sell timer (short); on completion the structure is removed
//                and a partial refund is issued.
//   DESTROYED  - hp reached 0; inert; produces rubble; removed after a decay.

export const LifecycleState = Object.freeze({
  PLACING: 'Placing',
  BUILDING: 'Building',
  COMPLETE: 'Complete',
  DAMAGED: 'Damaged',
  UPGRADING: 'Upgrading',
  SELLING: 'Selling',
  DESTROYED: 'Destroyed',
});

// Fraction of maxHp below which a COMPLETE structure reads as DAMAGED.
const DAMAGED_THRESHOLD = 0.6;

// How long (seconds) a sell takes.
const SELL_TIME = 0.6;

// How long a destroyed rubble decal lingers before removal (seconds).
const RUBBLE_DECAY = 3.0;

// Repair rate: fraction of maxHp restored per second while a troop is present.
const REPAIR_RATE = 0.35;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isStructure(e) {
  return e && (e.category === 'structure' || e.category === 'tower' ||
               e.category === 'wall' || e.category === 'moat');
}

function tierMultipliers(state, key, tier) {
  // Pull upgrade multipliers from the assumptions table when available,
  // otherwise fall back to the documented defaults.
  const tables = state && state.tables ? state.tables : null;
  const a = tables && tables.assumptions ? tables.assumptions : null;
  const defaults = {
    hp: { 2: 1.6, 3: 2.4 },
    dps: { 2: 1.55, 3: 2.3 },
    cost: { 2: 2.5, 3: 5 },
  };
  if (!a) {
    return defaults[key][tier] || 1;
  }
  if (key === 'hp') {
    return tier === 2 ? (a.Upgrade_HP_x_T2 ?? defaults.hp[2])
         : tier === 3 ? (a.Upgrade_HP_x_T3 ?? defaults.hp[3]) : 1;
  }
  if (key === 'dps') {
    return tier === 2 ? (a.Upgrade_DPS_x_T2 ?? defaults.dps[2])
         : tier === 3 ? (a.Upgrade_DPS_x_T3 ?? defaults.dps[3]) : 1;
  }
  if (key === 'cost') {
    return tier === 2 ? (a.Upgrade_Cost_x_T2 ?? defaults.cost[2])
         : tier === 3 ? (a.Upgrade_Cost_x_T3 ?? defaults.cost[3]) : 1;
  }
  return 1;
}

// Recompute a structure's tier-scaled combat stats from its base (tier1) stats.
function applyTierStats(state, s) {
  const tier = s.tier || 1;
  const base = s.baseStats || {
    hp: s.maxHp || s.hp || 100,
    dps: s.dps || 0,
    range: s.range || 0,
  };
  s.baseStats = base;

  const hpMul = tier === 1 ? 1 : tierMultipliers(state, 'hp', tier);
  const dpsMul = tier === 1 ? 1 : tierMultipliers(state, 'dps', tier);

  const prevMax = s.maxHp || base.hp;
  const newMax = base.hp * hpMul;

  // Preserve current damage fraction when scaling up on upgrade.
  const frac = prevMax > 0 ? (s.hp / prevMax) : 1;
  s.maxHp = newMax;
  s.hp = Math.max(1, Math.min(newMax, newMax * frac));

  s.dps = base.dps * dpsMul;
  s.range = base.range; // range does not scale with tier in this build
}

function refundValue(state, s) {
  // Refund = refundRate * total invested value (cumulative cost for tier).
  const refundRate = (state.config && state.config.refundRate != null)
    ? state.config.refundRate
    : 0.5;
  const base = s.costBase != null ? s.costBase : (s.cost != null ? s.cost : 0);
  const tier = s.tier || 1;
  const cumMul = tier === 1 ? 1 : tierMultipliers(state, 'cost', tier);
  return Math.floor(base * cumMul * refundRate);
}

function upgradeCost(state, s) {
  const nextTier = (s.tier || 1) + 1;
  if (nextTier > 3) return Infinity;
  const base = s.costBase != null ? s.costBase : (s.cost != null ? s.cost : 0);
  const curMul = tierMultipliers(state, 'cost', s.tier || 1);
  const nextMul = tierMultipliers(state, 'cost', nextTier);
  // cumulative value model: pay the difference to reach next cumulative value.
  return Math.max(0, Math.floor(base * (nextMul - curMul)));
}

function emit(state, ev) {
  if (state.log && typeof state.log.event === 'function') {
    state.log.event(ev);
  } else if (state.events && typeof state.events.push === 'function') {
    state.events.push(ev);
  }
}

// ---------------------------------------------------------------------------
// Public commands (called by commands.js after validity checks)
// ---------------------------------------------------------------------------

// Commit a structure into BUILDING. Assumes cost already reserved/spent by
// the caller (economy) and slot/space validity already checked.
export function beginBuild(state, s) {
  if (!isStructure(s)) return false;
  s.state = LifecycleState.BUILDING;
  s.tier = s.tier || 1;
  s.buildTime = s.buildTime != null ? s.buildTime : 1.0;
  s.buildTimer = 0;
  s.active = false; // cannot fire while building
  // During building it starts at low HP and rises to full on completion.
  applyTierStats(state, s);
  s.buildStartHp = Math.max(1, Math.floor(s.maxHp * 0.15));
  s.hp = s.buildStartHp;
  emit(state, { type: 'build_start', id: s.id, tick: state.tick });
  return true;
}

// Begin an upgrade if legal. Returns true if started.
export function beginUpgrade(state, s) {
  if (!isStructure(s)) return false;
  if ((s.tier || 1) >= 3) return false;
  if (s.state !== LifecycleState.COMPLETE && s.state !== LifecycleState.DAMAGED) {
    return false;
  }
  const cost = upgradeCost(state, s);
  if (state.economy && state.economy.money < cost) return false;
  if (state.economy) {
    state.economy.money -= cost;
    if (typeof state.economy.spend === 'function') {
      // economy.spend already deducted? avoid double: only mutate directly here.
    }
  }
  s.prevState = s.state;
  s.state = LifecycleState.UPGRADING;
  s.upgradeTime = s.upgradeTime != null ? s.upgradeTime : (s.buildTime || 1.0) * 1.5;
  s.upgradeTimer = 0;
  s.active = true; // stays operational during upgrade at old stats
  emit(state, { type: 'upgrade_start', id: s.id, toTier: (s.tier || 1) + 1,
                cost, tick: state.tick });
  return true;
}

// Begin selling. Refund is issued on completion.
export function beginSell(state, s) {
  if (!isStructure(s)) return false;
  if (s.state === LifecycleState.DESTROYED || s.state === LifecycleState.SELLING) {
    return false;
  }
  s.state = LifecycleState.SELLING;
  s.sellTime = SELL_TIME;
  s.sellTimer = 0;
  s.active = false;
  s.pendingRefund = refundValue(state, s);
  emit(state, { type: 'sell_start', id: s.id, refund: s.pendingRefund,
                tick: state.tick });
  return true;
}

// Begin (or continue eligibility for) a repair. Repairs are free but require
// a troop present and take time. This flags the structure for repair; actual
// progress happens in step() when a repair troop is assigned/present.
export function beginRepair(state, s) {
  if (!isStructure(s)) return false;
  if (s.state !== LifecycleState.DAMAGED && s.state !== LifecycleState.COMPLETE) {
    return false;
  }
  if (s.hp >= s.maxHp) return false;
  s.repairRequested = true;
  emit(state, { type: 'repair_request', id: s.id, tick: state.tick });
  return true;
}

// Apply damage to a structure (called by combat core). Handles state flip
// to DAMAGED / DESTROYED. Returns actual damage applied.
export function damageStructure(state, s, amount) {
  if (!isStructure(s)) return 0;
  if (s.state === LifecycleState.DESTROYED ||
      s.state === LifecycleState.SELLING) return 0;
  const before = s.hp;
  s.hp = Math.max(0, s.hp - amount);
  const applied = before - s.hp;

  if (s.hp <= 0) {
    destroyStructure(state, s);
  } else if (s.state === LifecycleState.COMPLETE &&
             s.hp < s.maxHp * DAMAGED_THRESHOLD) {
    s.state = LifecycleState.DAMAGED;
    emit(state, { type: 'structure_damaged', id: s.id, tick: state.tick });
  }
  return applied;
}

function destroyStructure(state, s) {
  s.state = LifecycleState.DESTROYED;
  s.hp = 0;
  s.active = false;
  s.rubbleTimer = 0;
  s.rubbleDecay = RUBBLE_DECAY;
  // Free the slot immediately so a new structure can be queued there.
  if (s.slotIndex != null && state.slots && state.slots[s.slotIndex]) {
    state.slots[s.slotIndex].occupant = null;
  }
  emit(state, { type: 'structure_destroyed', id: s.id, tick: state.tick });

  // Terrain-affecting structures (walls/moats) change pathing when gone.
  if ((s.category === 'wall' || s.category === 'moat') &&
      state.pathing && typeof state.pathing.markDirty === 'function') {
    state.pathing.markDirty();
  }
}

// ---------------------------------------------------------------------------
// Per-tick advancement (called from step.js in fixed order)
// ---------------------------------------------------------------------------

export function step(state, dt) {
  const ents = state.entities;
  const toRemove = [];

  for (let i = 0; i < ents.length; i++) {
    const s = ents[i];
    if (!isStructure(s)) continue;

    switch (s.state) {
      case LifecycleState.BUILDING: {
        s.buildTimer += dt;
        const t = Math.min(1, s.buildTimer / Math.max(0.0001, s.buildTime));
        // HP rises from build start to full over the build.
        s.hp = s.buildStartHp + (s.maxHp - s.buildStartHp) * t;
        if (s.buildTimer >= s.buildTime) {
          s.hp = s.maxHp;
          s.state = LifecycleState.COMPLETE;
          s.active = true;
          emit(state, { type: 'build_complete', id: s.id, tick: state.tick });
          // A new wall/moat reroutes walkers.
          if ((s.category === 'wall' || s.category === 'moat') &&
              state.pathing && typeof state.pathing.markDirty === 'function') {
            state.pathing.markDirty();
          }
        }
        break;
      }

      case LifecycleState.UPGRADING: {
        s.upgradeTimer += dt;
        if (s.upgradeTimer >= s.upgradeTime) {
          s.tier = (s.tier || 1) + 1;
          applyTierStats(state, s);
          s.hp = s.maxHp; // completion tops up HP (pie-sweep flash cue)
          s.state = (s.hp < s.maxHp * DAMAGED_THRESHOLD)
            ? LifecycleState.DAMAGED
            : LifecycleState.COMPLETE;
          s.active = true;
          emit(state, { type: 'upgrade_complete', id: s.id, tier: s.tier,
                        tick: state.tick });
        }
        break;
      }

      case LifecycleState.SELLING: {
        s.sellTimer += dt;
        if (s.sellTimer >= s.sellTime) {
          if (state.economy) {
            state.economy.money += s.pendingRefund || 0;
          }
          emit(state, { type: 'sell_complete', id: s.id,
                        refund: s.pendingRefund || 0, tick: state.tick });
          if (s.slotIndex != null && state.slots && state.slots[s.slotIndex]) {
            state.slots[s.slotIndex].occupant = null;
          }
          if ((s.category === 'wall' || s.category === 'moat') &&
              state.pathing && typeof state.pathing.markDirty === 'function') {
            state.pathing.markDirty();
          }
          toRemove.push(s);
        }
        break;
      }

      case LifecycleState.DESTROYED: {
        s.rubbleTimer += dt;
        if (s.rubbleTimer >= s.rubbleDecay) {
          toRemove.push(s);
        }
        break;
      }

      case LifecycleState.COMPLETE:
      case LifecycleState.DAMAGED: {
        // Repair progression: requires a troop present at the structure.
        if (s.repairRequested && s.hp < s.maxHp) {
          const troop = findRepairTroop(state, s);
          if (troop) {
            // Move the repair troop toward the structure, then repair.
            const arrived = advanceRepairTroop(state, troop, s, dt);
            if (arrived) {
              s.hp = Math.min(s.maxHp, s.hp + s.maxHp * REPAIR_RATE * dt);
              if (s.hp >= s.maxHp) {
                s.hp = s.maxHp;
                s.repairRequested = false;
                if (troop) troop.repairTarget = null;
                emit(state, { type: 'repair_complete', id: s.id,
                              tick: state.tick });
              }
            }
          }
        }
        // Flip DAMAGED<->COMPLETE based on current HP.
        if (s.state === LifecycleState.DAMAGED &&
            s.hp >= s.maxHp * DAMAGED_THRESHOLD) {
          s.state = LifecycleState.COMPLETE;
        } else if (s.state === LifecycleState.COMPLETE &&
                   s.hp < s.maxHp * DAMAGED_THRESHOLD && s.hp > 0) {
          s.state = LifecycleState.DAMAGED;
        }
        break;
      }

      default:
        break;
    }
  }

  if (toRemove.length) {
    for (const s of toRemove) {
      const idx = ents.indexOf(s);
      if (idx >= 0) ents.splice(idx, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Repair troop logistics (deterministic; consumes a troop's time)
// ---------------------------------------------------------------------------

function findRepairTroop(state, s) {
  // Reuse an already-assigned troop if it still exists.
  if (s.repairTroopId != null) {
    const t = state.entities.find(e => e.id === s.repairTroopId);
    if (t && t.category === 'repairTroop') return t;
    s.repairTroopId = null;
  }
  // Find a free repair troop (spawned by economy/commands as friendly workers).
  let best = null;
  let bestD = Infinity;
  for (const e of state.entities) {
    if (e.category !== 'repairTroop') continue;
    if (e.repairTarget != null) continue;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) {
    best.repairTarget = s.id;
    s.repairTroopId = best.id;
  }
  return best;
}

function advanceRepairTroop(state, troop, s, dt) {
  const dx = s.x - troop.x;
  const dy = s.y - troop.y;
  const dist = Math.hypot(dx, dy);
  const reach = (troop.reach != null ? troop.reach : 0.75);
  if (dist <= reach) return true;
  const spd = (troop.speed != null ? troop.speed : 3.0);
  const move = spd * dt;
  if (move >= dist) {
    troop.x = s.x;
    troop.y = s.y;
    return true;
  }
  troop.x += (dx / dist) * move;
  troop.y += (dy / dist) * move;
  return false;
}

// ---------------------------------------------------------------------------
// Query helpers used by HUD / renderer (read-only)
// ---------------------------------------------------------------------------

export function canUpgrade(state, s) {
  if (!isStructure(s)) return false;
  if ((s.tier || 1) >= 3) return false;
  if (s.state !== LifecycleState.COMPLETE && s.state !== LifecycleState.DAMAGED) {
    return false;
  }
  return state.economy ? state.economy.money >= upgradeCost(state, s) : false;
}

export function getUpgradeCost(state, s) {
  return upgradeCost(state, s);
}

export function getRefund(state, s) {
  return refundValue(state, s);
}

export function isOperational(s) {
  return s && (s.state === LifecycleState.COMPLETE ||
               s.state === LifecycleState.DAMAGED ||
               s.state === LifecycleState.UPGRADING) &&
         s.active === true;
}

export default {
  LifecycleState,
  beginBuild,
  beginUpgrade,
  beginSell,
  beginRepair,
  damageStructure,
  step,
  canUpgrade,
  getUpgradeCost,
  getRefund,
  isOperational,
};