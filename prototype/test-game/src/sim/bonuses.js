/**
 * src/sim/bonuses.js — WAVE BONUSES (Wave-Bonuses-Design rev 1, epic mm-49d52ced1b73).
 *
 * At each wave end the sim rolls 3 distinct eligible bonuses from the SEEDED rng
 * into state.bonuses.offer; the player's pick arrives as a replay-logged command
 * {type:'chooseBonus', bonusId} and applyBonus() mutates the run. Everything is a
 * deterministic function of sim state — the replay only records the CHOICE, so the
 * 3 offered options must regenerate identically (roll from state.rng at the clear
 * tick). All magnitudes/pre-nerfs are data (tables.BONUSES / BONUS_NERFS).
 */

import { BONUSES, BONUS_NERFS, getBonusDef } from '../data/tables.js';
import { emitEvent } from './core.js';

/** state.bonuses shape — persistent run mods + the current offer. */
export function initBonuses(state) {
  state.bonuses = {
    owned: [],                               // chosen ids, in order (stackables repeat)
    offer: null,                             // [id,id,id] pending choice, or null
    dmg: { air: 0, ground: 0, troops: 0 },   // additive damage fractions (defender fire)
    harv: { speed: 0, capacity: 0, hp: 0 },  // additive harvester fractions
    cannon: { range: 0, damage: 0 },         // additive base-cannon fractions
    mineCredits: 0,                          // free STR-Mine deploys (bonus 12)
  };
}

/** A tier-unlock bonus is dead once its group(s) already sit at max tier (3). */
function unlockRedundant(state, def) {
  if (def.kind !== 'unlockTier') return false;
  const st = state.structTiers;
  if (!st) return true;   // no cap → T3 already open
  return def.groups.every((g) => (st[g] || 1) >= 3);
}

/** Bonuses still worth offering (drops redundant unlocks; stackables always eligible). */
function eligible(state) {
  return BONUSES.filter((b) => !unlockRedundant(state, b));
}

/**
 * Roll 3 DISTINCT eligible bonuses into state.bonuses.offer using the seeded rng.
 * Called at wave clear (waves.js). Deterministic → replay regenerates the same 3.
 */
export function rollBonusOffer(state) {
  if (!state.bonuses) initBonuses(state);
  const pool = eligible(state).slice();
  const pick = [];
  const n = Math.min(3, pool.length);
  for (let i = 0; i < n; i++) {
    const j = state.rng.nextInt(0, pool.length - 1);   // inclusive
    pick.push(pool[j].id);
    pool.splice(j, 1);                                  // distinct
  }
  state.bonuses.offer = pick;
  emitEvent(state, { type: 'bonusOffer', tick: state.tick, wave: state.waves ? state.waves.current : 0, offer: pick.slice() });
  return pick;
}

/* -------------------------------------------------------------------------- */
/*  Effect application                                                        */
/* -------------------------------------------------------------------------- */

function healStructuresByKind(state, kind) {
  let n = 0;
  for (const s of state.structures.values()) {
    if (s.kind !== kind || s.lifecycle === 'Destroyed') continue;
    if (s.hp < s.maxHp) { s.hp = s.maxHp; if (s.lifecycle === 'Damaged') s.lifecycle = 'Complete'; }
    n++;
  }
  return n;
}

function eachHarvester(state, fn) {
  for (const id of state.harvesterIds || []) {
    const u = state.units.get(id);
    if (u && u.hp > 0 && u.isHarvester) fn(u);
  }
}

/**
 * Apply a chosen bonus. Returns {ok, reason}. Rejects a pick that isn't in the
 * current offer (so a stale/forged command can't hand out free upgrades) — the
 * offer is cleared on success (one pick per wave end).
 */
export function applyBonus(state, bonusId) {
  if (!state.bonuses) initBonuses(state);
  const offer = state.bonuses.offer;
  if (!offer || offer.indexOf(bonusId) === -1) return { ok: false, reason: 'not offered' };
  const def = getBonusDef(bonusId);
  if (!def) return { ok: false, reason: 'unknown bonus' };

  switch (def.kind) {
    case 'dmgMod':
      state.bonuses.dmg[def.target] += def.mag;
      break;
    case 'heal':
      healStructuresByKind(state, def.target);
      break;
    case 'healBase':
      if (state.base) state.base.hp = Math.min(state.base.maxHp, state.base.hp + state.base.maxHp * def.mag);
      break;
    case 'healHarv':
      eachHarvester(state, (u) => { u.hp = u.maxHp; });
      break;
    case 'harvMod': {
      state.bonuses.harv[def.field] += def.mag;   // future spawns read this (harvest.js)
      const r = 1 + def.mag;                       // existing fleet scales by this pick's ratio
      eachHarvester(state, (u) => {
        if (def.field === 'speed') u.speed *= r;
        else if (def.field === 'capacity') u.capacity *= r;
        else if (def.field === 'hp') { u.maxHp *= r; u.hp = Math.min(u.maxHp, u.hp * r); }
      });
      break;
    }
    case 'cannonMod':
      state.bonuses.cannon[def.field] += def.mag;   // stepBaseCannon reads via cannonRange/cannonDamage
      break;
    case 'mineCredit':
      state.bonuses.mineCredits += def.mag;
      break;
    case 'unlockTier':
      if (!state.structTiers) state.structTiers = {};
      for (const g of def.groups) state.structTiers[g] = 3;
      break;
    default:
      return { ok: false, reason: 'bad bonus kind' };
  }

  state.bonuses.owned.push(bonusId);
  state.bonuses.offer = null;
  emitEvent(state, { type: 'bonusChosen', tick: state.tick, bonusId, label: def.label });
  return { ok: true, reason: '' };
}

/* -------------------------------------------------------------------------- */
/*  Read helpers (consumed by combat.js / core.js / harvest.js / mines.js)    */
/* -------------------------------------------------------------------------- */

/** Persistent defender-damage multiplier vs a target (air/ground stack with troops). */
export function bonusDamageMult(state, target) {
  const b = state.bonuses && state.bonuses.dmg;
  if (!b || !target) return 1;
  let m = 1;
  if (target.domain === 'Flyer') m += b.air; else m += b.ground;
  if (target.kind === 'Troops' || target.shape === 'Troops') m += b.troops;
  return m;
}

/** Effective base super-cannon range/damage: pre-nerf × (1 + bought-back fraction). */
export function cannonRange(state, baseRange) {
  return baseRange * BONUS_NERFS.baseCannonRangeMult * (1 + ((state.bonuses && state.bonuses.cannon.range) || 0));
}
export function cannonDamage(state, baseDamage) {
  return baseDamage * BONUS_NERFS.baseCannonPowerMult * (1 + ((state.bonuses && state.bonuses.cannon.damage) || 0));
}

/** Consume one free mine credit (bonus 12) if any remain — deployMine calls before charging gold. */
export function consumeMineCredit(state) {
  if (state.bonuses && state.bonuses.mineCredits > 0) { state.bonuses.mineCredits--; return true; }
  return false;
}
