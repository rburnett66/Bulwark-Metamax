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
import { bonusDamageMult } from './bonuses.js';

/** Sentinel target id for the player base (the base has no entity id). */
export const BASE_TARGET_ID = -1;

/** Duration (seconds) of the frost chill status applied on hit. */
const CHILL_DURATION = 1.0;

/**
 * Distance-tie window, in CELL units (1 cell = one map grid cell; unit collision
 * radii run 0.38-0.50 cells and speeds 0.39-4.0 cells/s).
 *
 * Two candidates whose distance from the shooter differs by LESS than this count
 * as equidistant, and the documented lowest-entity-id rule decides between them.
 * An explicit window is required: acquisition ranks with float arithmetic, so
 * genuinely-equidistant entities almost never compare exactly equal and an
 * equality-based tie-break is dead code.
 *
 * 1e-4 cells is ~2 orders of magnitude below the smallest movement the sim can
 * produce in one tick (slowest unit 0.39 cells/s x FIXED_DT = ~1.3e-2 cells) and
 * ~8 orders above float64 noise in the squared comparison (~1e-12 absolute at
 * board scale). It therefore separates "the same distance" from "genuinely
 * closer" without ever masking real geometry.
 */
const TIE_EPSILON_CELLS = 1e-4;

/* -------------------------------------------------------------------------- */
/*  Domain legality                                                           */
/* -------------------------------------------------------------------------- */

/**
 * TARGETING HAS EXACTLY TWO CATEGORIES: Air and Ground.
 *
 *   Air    = Flyer
 *   Ground = EVERYTHING ELSE (Walker, Floater, Swimmer, and any future domain)
 *
 * A unit's `domain` is a MOVEMENT concept, not a targeting one. It picks the
 * lane and the pathfinder — Walkers walk, Floaters and Swimmers traverse water,
 * Flyers fly — and nothing else. Swimmers are ground units with a speed
 * modifier over water; a cannon shoots one exactly as it shoots a tank. Only
 * ALTITUDE changes what a weapon can reach.
 *
 * The test is written as "is it Air?" rather than as a list of the ground
 * domains ON PURPOSE. Two separate ground enumerations used to live here — one
 * for units, one for structures — and they drifted: Swimmer fell through to
 * Ground for units (hittable) but was absent from the structure list (immune to
 * every ground tower). A new ground-ish domain must not be able to reintroduce
 * that split.
 *
 * @param {string} targetDomain
 * @returns {boolean} true when the domain is in the AIR targeting category
 */
function isAirDomain(targetDomain) {
  return targetDomain === 'Flyer';
}

/**
 * Weapon-domain rule for UNITS, which declare a single weapon category.
 * See isAirDomain above for the two-category rule this implements.
 *
 * @param {'Ground'|'Air'|'Both'} canTarget
 * @param {'Walker'|'Floater'|'Swimmer'|'Flyer'} targetDomain movement domain
 * @returns {boolean}
 */
export function canHitDomain(canTarget, targetDomain) {
  if (isAirDomain(targetDomain)) {
    return canTarget === 'Air' || canTarget === 'Both';
  }
  return canTarget === 'Ground' || canTarget === 'Both';
}

/**
 * Structure variant, implementing the SAME two-category rule as canHitDomain.
 *
 * Structures declare canTargetDomains as a list whose entries may be weapon
 * categories ('Ground','Air','Both') or concrete movement domains ('Walker',
 * 'Floater','Swimmer','Flyer'). Every entry collapses to one of the two
 * targeting categories: naming ANY ground domain means "this weapon hits
 * ground", naming Flyer means "this weapon hits air". The roster's
 * ['Walker','Floater'] on the cannon has always MEANT "ground" — spelling out
 * the ground domains is what let Swimmer go missing.
 *
 * @param {string[]} domainList structure canTargetDomains
 * @param {string} targetDomain movement domain of the candidate
 * @returns {boolean}
 */
function domainsAllow(domainList, targetDomain) {
  if (!domainList || domainList.length === 0) return false;   // walls/moats/bays have no weapon
  const wantAir = isAirDomain(targetDomain);
  for (let i = 0; i < domainList.length; i++) {
    const d = domainList[i];
    if (d === 'Both') return true;
    const entryIsAir = (d === 'Air') || isAirDomain(d);
    if (entryIsAir === wantAir) return true;
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

/**
 * SQUARED distance. Every range test and every nearest-target comparison in this
 * module runs in squared space: the per-candidate Math.sqrt bought nothing but
 * rounding, and it was that rounding which destroyed the distance ties the
 * lowest-id rule is supposed to arbitrate. Callers compare against range*range.
 */
function dist2Between(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Width of the TIE_EPSILON_CELLS window expressed in SQUARED space, for a weapon
 * of `range`. Squared differences are not linear in distance:
 *
 *   d1^2 - d2^2 = (d1 - d2) * (d1 + d2)
 *
 * so a fixed window in cells maps to a window in squared space that scales with
 * (d1 + d2). Both candidates have already passed the range test, so
 * d1 + d2 <= 2 * range; using that bound keeps the window from ever being
 * NARROWER than TIE_EPSILON_CELLS. At close quarters it is somewhat wider (at
 * d = 0.5 with range 6 it spans ~1.2e-3 cells) — still a thousandth of a cell,
 * far below anything the sim can express, and it only widens the id rule's reach.
 */
function tieSlack2(range) {
  return 2 * range * TIE_EPSILON_CELLS;
}

/**
 * Nearest-wins-with-id-tiebreak accumulator, shared by all three acquisition
 * branches so they cannot drift apart again.
 *
 * Returns true when the candidate should displace the incumbent: strictly nearer
 * (by more than the tie window), or equidistant within the window AND carrying a
 * lower entity id.
 *
 * @param {number} d2      candidate squared distance
 * @param {number} id      candidate entity id
 * @param {number} bestD2  incumbent squared distance (Infinity when none)
 * @param {number|null} bestId incumbent entity id (null when none)
 * @param {number} slack2  tieSlack2(range) for this shooter
 * @returns {boolean}
 */
function beatsBest(d2, id, bestD2, bestId, slack2) {
  if (bestId === null) return true;
  if (d2 < bestD2 - slack2) return true;                  // genuinely closer
  return d2 <= bestD2 + slack2 && id < bestId;            // tied -> lowest id
}

function structureIsTargetable(s) {
  return s.hp > 0 &&
    s.lifecycle !== 'Destroyed' &&
    s.lifecycle !== 'Placing';
}

/* -------------------------------------------------------------------------- */
/*  Base reach — ONE definition                                               */
/* -------------------------------------------------------------------------- */

/**
 * Minimum reach against the base, in CELL units, regardless of weapon range.
 *
 * Short-range units (WTR-Trucks is 1.225) would otherwise have to press inside
 * the keep's footprint ring to register, and the separation/contact passes stop
 * them getting there — they stall at the wall doing nothing. The floor is set
 * just above one cell so a unit standing in the ring slot adjacent to a
 * footprint cell always engages.
 */
const BASE_REACH_FLOOR = 1.4;

/** Reach used for a unit that carries no weapon range at all (cell units). */
const BASE_REACH_DEFAULT_RANGE = 0.5;

/**
 * THE definition of "this attacker is in reach of the base". stepMovement (which
 * applies the damage) and acquireTarget (which reports the target) both call
 * this, so they can no longer give different answers in the same tick — a unit
 * at the footprint edge used to be damaging the base while acquireTarget
 * returned null, leaving targetId null mid-attack.
 *
 * Measured to the nearest base FOOTPRINT cell, not the centre: the keep is 3x3,
 * and footprint measurement is what lets the mob spread AROUND it instead of all
 * cramming toward one point. Floored at BASE_REACH_FLOOR so short-range units
 * do not stall. Squared throughout, consistent with the rest of this module.
 *
 * NOTE: this answers reachability only. stepMovement owns the actual base
 * damage; stepCombat deliberately skips the base so it is not applied twice.
 *
 * @param {object} state SimState
 * @param {object} unit attacking unit
 * @returns {boolean}
 */
export function inBaseReach(state, unit) {
  const b = state && state.base;
  if (!b || !unit) return false;
  const reach = Math.max(unit.range || BASE_REACH_DEFAULT_RANGE, BASE_REACH_FLOOR);
  const reach2 = reach * reach;
  const cells = (b.cells && b.cells.length) ? b.cells : [b.pos];
  for (let i = 0; i < cells.length; i++) {
    if (dist2Between(unit.pos, cells[i]) <= reach2) return true;
  }
  return false;
}

/**
 * Deterministic nearest-in-range legal target for a unit or completed tower.
 * Ties are broken by the lowest entity id — see TIE_EPSILON_CELLS for what
 * counts as a tie, and beatsBest() for the comparison every branch shares.
 * Iteration order over the entity Maps is insertion order (== ascending id
 * order), so acquisition is fully deterministic; the id rule is what makes it
 * deterministic in the documented WAY rather than by accident of Map order.
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
    const range2 = range * range;
    const slack2 = tieSlack2(range);
    let bestId = null;
    let bestD2 = Infinity;
    for (const u of state.units.values()) {
      if (u.hp <= 0) continue;
      if (u.side !== 'attacker') continue;
      if (!domainsAllow(def.canTargetDomains, u.domain)) continue;
      if (!canSee(shooter, u)) continue;
      const d2 = dist2Between(shooter.pos, u.pos);
      if (d2 > range2) continue;
      if (beatsBest(d2, u.id, bestD2, bestId, slack2)) {
        if (d2 < bestD2) bestD2 = d2;   // keep the SMALLEST distance so the tie window cannot creep outward
        bestId = u.id;
      }
    }
    return bestId;
  }

  // ---- Unit shooter ---------------------------------------------------------
  const range = shooter.range;
  if (!range || range <= 0) return null;
  const range2 = range * range;
  const slack2 = tieSlack2(range);

  if (shooter.side === 'attacker') {
    // #4: JUGGERNAUTS shoot defences they pass while still advancing on the base — so unlike basic attackers
    // (which ignore towers), they target the nearest structure in range like siege, falling back to the base.
    // core.js only ever STOPS (engages) a base-targeter at the base, so a juggernaut keeps moving while it fires.
    const isJugg = shooter.role === 'Juggernaut';
    if (shooter.targetsBase && !isJugg) {
      // Basic attackers ignore towers entirely; they only attack the base.
      // inBaseReach is THE reach rule — the same one stepMovement uses to apply
      // the damage, so targetId can no longer be null while the base is being hit.
      if (state.base && state.base.hp > 0 && inBaseReach(state, shooter)) {
        return BASE_TARGET_ID;
      }
      return null;
    }
    // Structure hunters (Artillery) AND juggernauts: nearest live structure in range.
    let bestId = null;
    let bestD2 = Infinity;
    for (const s of state.structures.values()) {
      if (!structureIsTargetable(s)) continue;
      const d2 = dist2Between(shooter.pos, s.pos);
      if (d2 > range2) continue;
      if (beatsBest(d2, s.id, bestD2, bestId, slack2)) {
        if (d2 < bestD2) bestD2 = d2;
        bestId = s.id;
      }
    }
    if (bestId !== null) return bestId;
    // No structure in reach: fall back to the base so siege never idles at it.
    if (state.base && state.base.hp > 0 && inBaseReach(state, shooter)) {
      return BASE_TARGET_ID;
    }
    return null;
  }

  // Defender-side troop (deployed via deployTroop): engages attacker units.
  let bestId = null;
  let bestD2 = Infinity;
  for (const u of state.units.values()) {
    if (u.hp <= 0) continue;
    if (u.side !== 'attacker') continue;
    if (!canHitDomain(shooter.canTarget, u.domain)) continue;
    if (!canSee(shooter, u)) continue;
    const d2 = dist2Between(shooter.pos, u.pos);
    if (d2 > range2) continue;
    if (beatsBest(d2, u.id, bestD2, bestId, slack2)) {
      if (d2 < bestD2) bestD2 = d2;
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
    target.slowUntil = Math.max(target.slowUntil || 0, state.tick + Math.max(1, Math.round(CHILL_DURATION / Math.max(dt, 1e-6))));   // stepMovement reads slowUntil
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
        // Same reach rule as acquisition and as stepMovement's damage — a sticky
        // base target must not be dropped a tick before the damage stops.
        target = (state.base && state.base.hp > 0 && inBaseReach(state, unit))
          ? state.base : null;
      } else {
        const cand = state.units.get(tid) || state.structures.get(tid);
        if (cand && cand.hp > 0 &&
            dist2Between(unit.pos, cand.pos) <= unit.range * unit.range &&
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

    unit.state = 'attacking';   // lowercase — core.js movement/separation gates test 'attacking'
    if (target !== state.base) {   // base damage is owned by stepMovement (footprint reach) — don't double-apply
      const res = applyDamage(state, unit.id, target, unit.dps, unit.damageType, dt);
      if (res.killed) {
        unit.targetId = null;
        if (target.unitId !== undefined && target.id !== undefined) {
          deadUnitIds.push(target.id);
        }
        // Structures: lifecycle already flipped to Destroyed by applyDamage.
      }
    }
    // SPLASH: units with aoeRadius also damage other enemies near the primary target (retune via stats).
    if (unit.aoeRadius > 0 && target.pos) {
      const px = target.pos.x, py = target.pos.y, r2 = unit.aoeRadius * unit.aoeRadius;
      for (const other of state.units.values()) {
        if (other === target || other.hp <= 0 || other.side === unit.side) continue;
        if (!canHitDomain(unit.canTarget, other.domain)) continue;
        const ox = other.pos.x - px, oy = other.pos.y - py;
        if (ox * ox + oy * oy > r2) continue;
        if (applyDamage(state, unit.id, other, unit.dps, unit.damageType, dt).killed) deadUnitIds.push(other.id);
      }
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
          dist2Between(s.pos, cand.pos) <= def.range * def.range) {
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

    // WAVE BONUSES: +% defender damage vs air / ground / troops (bonuses 1-3), applied to TOWER fire.
    const res = applyDamage(state, s.id, target, dps * bonusDamageMult(state, target), def.damageType, dt);
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