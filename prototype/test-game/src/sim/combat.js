/**
 * src/sim/combat.js — Targeting and damage core for BULWARK.
 *
 * Domain-legality checks, deterministic target acquisition, effectiveness-scaled
 * damage, and kill resolution. Shared verbatim by the live sim and the headless
 * balance harness (no rendering, no DOM, no randomness of its own).
 */

import { EFFECTIVENESS, DAMAGE_TYPES, getStructureDef } from '../data/tables.js';
import { grantKillIncome } from './economy.js';
import { emitEvent } from './core.js';

/** Sentinel target id used internally for the player base (base has no entity id). */
const BASE_TARGET_ID = -1;

/** Duration (seconds) of the frost chill status applied on hit. */
const CHILL_DURATION = 1.0;

/* -------------------------------------------------------------------------- */
/*  Domain legality                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Weapon-domain rule:
 *  - anti-air ('Air' or 'Both') hits Flyer
 *  - anti-ground ('Ground' or 'Both') hits Walker and Floater (Floater counts as Ground)
 *  - anti-ground NEVER hits Flyer; anti-air-only never hits ground domains
 *
 * @param {'Ground'|'Air'|'Both'} canTarget
 * @param {'Walker'|'Floater'|'Flyer'} targetDomain
 * @returns {boolean}
 */
export function canHitDomain(canTarget, targetDomain) {
  if (targetDomain === 'Flyer') {
    return canTarget === 'Air' || canTarget === 'Both';
  }
  // Walker and Floater are both "Ground" for weapon purposes.
  return canTarget === 'Ground' || canTarget === 'Both';
}

/**
 * Structure variant: structures declare canTargetDomains as a list which may
 * contain either concrete domains ('Walker','Floater','Flyer') or the weapon
 * categories ('Ground','Air','Both').
 */
function domainsAllow(domainList, targetDomain) {
  if (!domainList || domainList.length === 0) return false;
  for (let i = 0; i < domainList.length; i++) {
    const d = domainList[i];
    if (d === targetDomain) return true;
    if ((d === 'Ground' || d === 'Both') &&
        (targetDomain === 'Walker' || targetDomain === 'Floater')) return true;
    if ((d === 'Air' || d === 'Both') && targetDomain === 'Flyer') return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Vision (minimal stub per GDD §vision)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Vision stub: radar sees air (not ground detail); air units see ground at
 * range; completed towers with AA weapons are assumed radar-equipped.
 * Ground targets are always visible at weapon range in this slice.
 */
function canSee(shooter, target) {
  if (target && target.domain === 'Flyer') {
    // Towers: the domain-legality check already gates AA capability; AA towers
    // are radar-equipped by definition in this slice.
    if (shooter.structId !== undefined) return true;
    if (shooter.radarDetect) return true;
    // Units without radar may still engage flyers their weapon can legally hit.
    return canHitDomain(shooter.canTarget, 'Flyer');
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Target acquisition                                                        */
/* -------------------------------------------------------------------------- */

function distBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function structureIsTargetable(s) {
  return s.hp > 0 &&
    s.lifecycle !== 'Destroyed' &&
    s.lifecycle !== 'Placing';
}

/**
 * Deterministic nearest-in-range legal target for a unit or completed tower.
 * Ties are broken by the lowest entity id. Iteration order over the entity
 * Maps is insertion order (== ascending id order) which, combined with the
 * strict comparison below, makes acquisition fully deterministic.
 *
 * Returns the target entity id, BASE_TARGET_ID (-1) for the player base,
 * or null when no legal target is in range.
 *
 * @param {object} state SimState
 * @param {object} shooter Unit or Structure
 * @returns {number|null}
 */
export function acquireTarget(state, shooter) {
  // ---- Structure (tower) shooter ------------------------------------------
  if (shooter.structId !== undefined) {
    let def;
    try { def = getStructureDef(shooter.structId); } catch (e) { return null; }
    const range = def.range;
    if (!range || range <= 0) return null;
    let bestId = null;
    let bestD = Infinity;
    for (const u of state.units.values()) {
      if (u.hp <= 0) continue;
      if (u.side !== 'attacker') continue;
      if (!domainsAllow(def.canTargetDomains, u.domain)) continue;
      if (!canSee(shooter, u)) continue;
      const d = distBetween(shooter.pos, u.pos);
      if (d > range) continue;
      if (d < bestD || (d === bestD && (bestId === null || u.id < bestId))) {
        bestD = d;
        bestId = u.id;
      }
    }
    return bestId;
  }

  // ---- Unit shooter ---------------------------------------------------------
  const range = shooter.range;
  if (!range || range <= 0) return null;

  if (shooter.side === 'attacker') {
    if (shooter.targetsBase) {
      // Basic attackers ignore towers entirely; they only attack the base.
      if (state.base && state.base.hp > 0 &&
          distBetween(shooter.pos, state.base.pos) <= range) {
        return BASE_TARGET_ID;
      }
      return null;
    }
    // Targets:'Structures' (e.g. Artillery): nearest live structure in range.
    let bestId = null;
    let bestD = Infinity;
    for (const s of state.structures.values()) {
      if (!structureIsTargetable(s)) continue;
      const d = distBetween(shooter.pos, s.pos);
      if (d > range) continue;
      if (d < bestD || (d === bestD && (bestId === null || s.id < bestId))) {
        bestD = d;
        bestId = s.id;
      }
    }
    if (bestId !== null) return bestId;
    // No structure in reach: fall back to the base so siege never idles at it.
    if (state.base && state.base.hp > 0 &&
        distBetween(shooter.pos, state.base.pos) <= range) {
      return BASE_TARGET_ID;
    }
    return null;
  }

  // Defender-side troop (deployed via deployTroop): engages attacker units.
  let bestId = null;
  let bestD = Infinity;
  for (const u of state.units.values()) {
    if (u.hp <= 0) continue;
    if (u.side !== 'attacker') continue;
    if (!canHitDomain(shooter.canTarget, u.domain)) continue;
    if (!canSee(shooter, u)) continue;
    const d = distBetween(shooter.pos, u.pos);
    if (d > range) continue;
    if (d < bestD || (d === bestD && (bestId === null || u.id < bestId))) {
      bestD = d;
      bestId = u.id;
    }
  }
  return bestId;
}

/* -------------------------------------------------------------------------- */
/*  Damage application                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Applies effectiveness-matrix-scaled damage over dt seconds.
 * Flips structure lifecycle Complete -> Damaged on first damage and
 * -> Destroyed on death (removal/cleanup is stepStructures' job).
 * Applies frost chill status (never to air per design rule).
 * Emits 'damage' (and 'destroyed' for structures) events.
 *
 * @param {object} state SimState
 * @param {number|null} sourceId entity id of the shooter (null = environment)
 * @param {object} target Unit | Structure | Base
 * @param {number} rawDps raw damage per second before type scaling
 * @param {string} damageType e.g. 'Kinetic'
 * @param {number} dt tick duration in seconds
 * @returns {{dealt:number, killed:boolean}}
 */
export function applyDamage(state, sourceId, target, rawDps, damageType, dt) {
  if (!target || target.hp <= 0) return { dealt: 0, killed: false };

  const row = EFFECTIVENESS[damageType];
  const mult = (row && row[target.armorClass] !== undefined)
    ? row[target.armorClass]
    : 1;

  let dealt = rawDps * mult * dt;
  if (dealt <= 0) return { dealt: 0, killed: false };
  if (dealt > target.hp) dealt = target.hp;

  target.hp -= dealt;
  const killed = target.hp <= 1e-9;
  if (killed) target.hp = 0;

  // Status stub: frost chill slows everything EXCEPT air units (design rule).
  const typeFlags = DAMAGE_TYPES[damageType];
  if (typeFlags && typeFlags.slow && !killed &&
      target.unitId !== undefined &&
      !(target.domain === 'Flyer' && !typeFlags.slowsAir)) {
    target.slowTimer = Math.max(target.slowTimer || 0, CHILL_DURATION);
  }

  // Structure lifecycle transitions.
  const isStruct = target.structId !== undefined && target.lifecycle !== undefined;
  if (isStruct) {
    if (killed) {
      target.lifecycle = 'Destroyed';
    } else if (target.lifecycle === 'Complete' && target.hp < target.maxHp) {
      target.lifecycle = 'Damaged';
    }
  }

  const isBase = target.id === undefined;
  emitEvent(state, {
    type: 'damage',
    tick: state.tick,
    sourceId: sourceId,
    targetId: isBase ? BASE_TARGET_ID : target.id,
    targetKind: isBase ? 'base' : (isStruct ? 'structure' : 'unit'),
    amount: dealt,
    damageType: damageType,
    killed: killed,
    pos: { x: target.pos.x, y: target.pos.y }
  });

  if (isStruct && killed) {
    emitEvent(state, {
      type: 'destroyed',
      tick: state.tick,
      entityId: target.id,
      structId: target.structId,
      pos: { x: target.pos.x, y: target.pos.y }
    });
  }

  return { dealt: dealt, killed: killed };
}

/* -------------------------------------------------------------------------- */
/*  Combat tick                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One combat tick: every live armed unit and every completed tower acquires a
 * target (deterministically) and fires continuous DPS over dt. Attacker kills
 * grant income via the economy module; all kills emit 'kill' events. Structure
 * death flips lifecycle (cleanup + path recompute handled by stepStructures);
 * base death is detected by the core step (lose condition).
 *
 * @param {object} state SimState
 * @param {number} dt tick duration in seconds
 */
export function stepCombat(state, dt) {
  const deadUnitIds = [];

  // ---- Units fire -----------------------------------------------------------
  for (const unit of state.units.values()) {
    if (unit.hp <= 0) continue;
    if (!unit.dps || unit.dps <= 0) continue;
    if (unit.kind === 'repair') continue; // repair troops never fight

    // Re-validate a sticky target, otherwise re-acquire deterministically.
    let tid = unit.targetId;
    let target = null;
    if (tid !== null && tid !== undefined) {
      if (tid === BASE_TARGET_ID) {
        target = (state.base && state.base.hp > 0 &&
                  distBetween(unit.pos, state.base.pos) <= unit.range)
          ? state.base : null;
      } else {
        const cand = state.units.get(tid) || state.structures.get(tid);
        if (cand && cand.hp > 0 &&
            distBetween(unit.pos, cand.pos) <= unit.range &&
            (cand.structId !== undefined
              ? structureIsTargetable(cand)
              : canHitDomain(unit.canTarget, cand.domain))) {
          target = cand;
        }
      }
    }
    if (!target) {
      tid = acquireTarget(state, unit);
      unit.targetId = tid;
      if (tid === null) continue;
      target = (tid === BASE_TARGET_ID)
        ? state.base
        : (state.units.get(tid) || state.structures.get(tid));
      if (!target || target.hp <= 0) { unit.targetId = null; continue; }
    } else {
      unit.targetId = tid;
    }

    unit.state = 'Attacking';
    const res = applyDamage(state, unit.id, target, unit.dps, unit.damageType, dt);
    if (res.killed) {
      unit.targetId = null;
      if (target.unitId !== undefined && target.id !== undefined) {
        deadUnitIds.push(target.id);
      }
      // Structures: lifecycle already flipped to Destroyed by applyDamage.
      // Base: core stepSim detects hp<=0 and sets the lose result.
    }
  }

  // ---- Completed towers fire --------------------------------------------------
  for (const s of state.structures.values()) {
    if (s.lifecycle !== 'Complete' && s.lifecycle !== 'Damaged') continue;
    let def;
    try { def = getStructureDef(s.structId); } catch (e) { continue; }
    const tier = s.tier || 1;
    const dps = Array.isArray(def.dps) ? (def.dps[tier - 1] || 0) : (def.dps || 0);
    if (dps <= 0) continue; // walls/moats do not shoot

    let tid = s.targetId;
    let target = null;
    if (tid !== null && tid !== undefined && tid !== BASE_TARGET_ID) {
      const cand = state.units.get(tid);
      if (cand && cand.hp > 0 && cand.side === 'attacker' &&
          domainsAllow(def.canTargetDomains, cand.domain) &&
          distBetween(s.pos, cand.pos) <= def.range) {
        target = cand;
      }
    }
    if (!target) {
      tid = acquireTarget(state, s);
      s.targetId = tid;
      if (tid === null) continue;
      target = state.units.get(tid);
      if (!target || target.hp <= 0) { s.targetId = null; continue; }
    } else {
      s.targetId = tid;
    }

    const res = applyDamage(state, s.id, target, dps, def.damageType, dt);
    if (res.killed) {
      s.targetId = null;
      deadUnitIds.push(target.id);
    }
  }

  // ---- Resolve unit deaths (income + kill log + removal) ----------------------
  for (let i = 0; i < deadUnitIds.length; i++) {
    const id = deadUnitIds[i];
    const u = state.units.get(id);
    if (!u) continue; // already resolved this tick
    let income = 0;
    if (u.side === 'attacker') {
      income = grantKillIncome(state, u);
    }
    emitEvent(state, {
      type: 'kill',
      tick: state.tick,
      entityId: id,
      unitId: u.unitId,
      side: u.side,
      lane: u.lane,
      income: income,
      radius: u.radius,                 // lets the render scale the burning-wreck flame to the unit's size
      pos: { x: u.pos.x, y: u.pos.y }
    });
    state.units.delete(id);
  }
}