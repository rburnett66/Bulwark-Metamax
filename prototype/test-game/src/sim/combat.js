Looking at the balance schema and the plan, I'll implement a headless combat core that handles targeting by domain, damage-type effectiveness, status effects, and DPS application.

```javascript
// src/sim/combat.js
// Headless combat core: targeting by domain, damage-type effectiveness,
// status effects, and DPS application. Pure logic — reads/writes strict sim
// state only. Same code path usable by the balance sim (deterministic).

import { CONSTANTS } from '../config/constants.js';

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------
export const DOMAIN = {
  GROUND: 'Ground',
  WATER: 'Water',
  AIR: 'Air',
};

// Map an entity to its combat domain (what a weapon must be able to target
// in order to hit it).
export function entityDomain(e) {
  if (!e) return DOMAIN.GROUND;
  if (e.domain === 'Flyer' || e.domain === DOMAIN.AIR) return DOMAIN.AIR;
  if (e.domain === 'Floater' || e.domain === 'Swimmer' || e.domain === DOMAIN.WATER) return DOMAIN.WATER;
  return DOMAIN.GROUND;
}

// Normalise a weapon's "can target" declaration into a set of domains.
// Data uses: "Ground", "Air", "Both" (ground+air), "Water", "All".
export function canTargetDomains(canTarget) {
  const set = new Set();
  const v = (canTarget || 'Ground').toString();
  if (v === 'Both') {
    set.add(DOMAIN.GROUND);
    set.add(DOMAIN.WATER);
    set.add(DOMAIN.AIR);
    return set;
  }
  if (v === 'All') {
    set.add(DOMAIN.GROUND);
    set.add(DOMAIN.WATER);
    set.add(DOMAIN.AIR);
    return set;
  }
  if (v === DOMAIN.GROUND) {
    set.add(DOMAIN.GROUND);
    set.add(DOMAIN.WATER); // anti-ground can also hit surface water units
    return set;
  }
  if (v === DOMAIN.AIR) {
    set.add(DOMAIN.AIR);
    return set;
  }
  if (v === DOMAIN.WATER) {
    set.add(DOMAIN.WATER);
    return set;
  }
  // fallback: literal
  set.add(v);
  return set;
}

export function weaponCanHit(weaponCanTarget, targetEntity) {
  const domains = canTargetDomains(weaponCanTarget);
  return domains.has(entityDomain(targetEntity));
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function tilesToWorld(tiles) {
  return tiles * (CONSTANTS.TILE_SIZE || 32);
}

// ---------------------------------------------------------------------------
// Effectiveness matrix lookup
// ---------------------------------------------------------------------------
// tables.effectiveness: { <DamageType>: { Organic, Machinery, Aircraft, Structure, Energy } }
export function effectivenessMultiplier(tables, damageType, armorClass) {
  const eff = tables && tables.effectiveness;
  if (!eff) return 1;
  const row = eff[damageType];
  if (!row) return 1;
  const m = row[armorClass];
  return typeof m === 'number' ? m : 1;
}

// ---------------------------------------------------------------------------
// Damage type status flags
// ---------------------------------------------------------------------------
// tables.damageTypes: { <DamageType>: { status, dot, slow, chain } }
export function damageTypeFlags(tables, damageType) {
  const dt = tables && tables.damageTypes;
  if (!dt || !dt[damageType]) {
    return { status: null, dot: false, slow: false, chain: false };
  }
  const row = dt[damageType];
  return {
    status: row.status || row.statusEffect || null,
    dot: !!row.dot,
    slow: !!row.slow,
    chain: !!row.chain,
  };
}

// ---------------------------------------------------------------------------
// Status effect application
// ---------------------------------------------------------------------------
// Status durations / magnitudes (deterministic constants).
const STATUS = {
  BURN: { key: 'Burn', duration: 3.0, dpsFactor: 0.25 },   // Fire DoT
  TOXIN: { key: 'Toxin', duration: 4.0, dpsFactor: 0.30 }, // Poison DoT
  CHILL: { key: 'Chill', duration: 2.0, slowFactor: 0.5 }, // Frost slow
  STAGGER: { key: 'Stagger', duration: 0.5 },              // Concussion (machinery)
  OVERLOAD: { key: 'Overload', duration: 1.0 },            // Electric (machinery disable)
};

function ensureStatus(entity) {
  if (!entity.status) entity.status = {};
  return entity.status;
}

// Apply a status effect keyed to the incoming damage type.
export function applyStatus(target, damageType, baseDps, flags) {
  if (!target || target.dead) return;
  const armor = target.armorClass;
  const st = ensureStatus(target);

  switch (damageType) {
    case 'Fire': {
      if (flags.dot) {
        st.Burn = {
          key: STATUS.BURN.key,
          remaining: STATUS.BURN.duration,
          dps: baseDps * STATUS.BURN.dpsFactor,
          damageType: 'Fire',
        };
      }
      break;
    }
    case 'Poison': {
      // Poison DoT only bites organics (machines/energy immune per matrix).
      if (flags.dot && armor === 'Organic') {
        st.Toxin = {
          key: STATUS.TOXIN.key,
          remaining: STATUS.TOXIN.duration,
          dps: baseDps * STATUS.TOXIN.dpsFactor,
          damageType: 'Poison',
        };
      }
      break;
    }
    case 'Frost': {
      // Chill slows ALL except air units (design rule).
      if (flags.slow && entityDomain(target) !== DOMAIN.AIR) {
        st.Chill = {
          key: STATUS.CHILL.key,
          remaining: STATUS.CHILL.duration,
          slowFactor: STATUS.CHILL.slowFactor,
        };
      }
      break;
    }
    case 'Concussion': {
      // Stagger machinery only.
      if (armor === 'Machinery') {
        st.Stagger = {
          key: STATUS.STAGGER.key,
          remaining: STATUS.STAGGER.duration,
        };
      }
      break;
    }
    case 'Electric': {
      // Overload disables machines.
      if (armor === 'Machinery') {
        st.Overload = {
          key: STATUS.OVERLOAD.key,
          remaining: STATUS.OVERLOAD.duration,
        };
      }
      break;
    }
    default:
      break;
  }
}

// Query helpers used by movement/firing systems.
export function slowMultiplier(entity) {
  if (!entity || !entity.status) return 1;
  const c = entity.status.Chill;
  if (c && c.remaining > 0) return 1 - c.slowFactor;
  return 1;
}

export function isDisabled(entity) {
  if (!entity || !entity.status) return false;
  const o = entity.status.Overload;
  const s = entity.status.Stagger;
  if (o && o.remaining > 0) return true;
  if (s && s.remaining > 0) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Damage application
// ---------------------------------------------------------------------------
// Apply raw damage scaled by effectiveness against the target's armor class.
// Returns the amount of HP actually removed.
export function applyDamage(tables, target, rawDamage, damageType, ctx) {
  if (!target || target.dead || target.hp <= 0) return 0;
  const mult = effectivenessMultiplier(tables, damageType, target.armorClass);
  const dmg = rawDamage * mult;
  if (dmg <= 0) return 0;
  const before = target.hp;
  target.hp -= dmg;
  const removed = before - Math.max(0, target.hp);

  if (target.hp <= 0) {
    target.hp = 0;
    if (!target.dead) {
      target.dead = true;
      target.state = 'Death';
      if (ctx && ctx.onKill) ctx.onKill(target, ctx.source);
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Status tick — advance DoTs and decrement durations
// ---------------------------------------------------------------------------
export function tickStatus(tables, entity, dt, ctx) {
  if (!entity || !entity.status || entity.dead) return;
  const st = entity.status;

  for (const k of Object.keys(st)) {
    const s = st[k];
    if (!s) { delete st[k]; continue; }
    // DoTs deal effectiveness-scaled damage over time.
    if (s.dps && s.dps > 0 && s.damageType) {
      const raw = s.dps * dt;
      applyDamage(tables, entity, raw, s.damageType, ctx);
      if (entity.dead) return;
    }
    s.remaining -= dt;
    if (s.remaining <= 0) delete st[k];
  }
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------
// Find the best target for a weapon-bearing entity (tower or attacker) from a
// candidate list. Deterministic: ties broken by candidate id (ascending).
//
// weapon = {
//   x, y, rangeTiles, canTarget, targetsBase, targetsStructures
// }
export function acquireTarget(weapon, candidates) {
  const rangeWorld = tilesToWorld(weapon.rangeTiles);
  let best = null;
  let bestDist = Infinity;
  let bestId = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c || c.dead || c.hp <= 0) continue;
    if (!weaponCanHit(weapon.canTarget, c)) continue;
    const d = dist(weapon.x, weapon.y, c.x, c.y);
    if (d > rangeWorld) continue;
    // Prefer nearest; deterministic tiebreak on id.
    const cid = c.id != null ? c.id : i;
    if (d < bestDist - 1e-6 || (Math.abs(d - bestDist) <= 1e-6 && cid < bestId)) {
      best = c;
      bestDist = d;
      bestId = cid;
    }
  }
  return best;
}

// Validate that an existing target is still in range and legal.
export function targetStillValid(weapon, target) {
  if (!target || target.dead || target.hp <= 0) return false;
  if (!weaponCanHit(weapon.canTarget, target)) return false;
  const rangeWorld = tilesToWorld(weapon.rangeTiles);
  return dist(weapon.x, weapon.y, target.x, target.y) <= rangeWorld;
}

// ---------------------------------------------------------------------------
// Weapon firing (tower / unit)
// ---------------------------------------------------------------------------
// Fire an attacker/tower weapon this tick. Handles cooldown, DPS application,
// AoE splash, and electric chain. Mutates state. Deterministic.
//
// shooter = full entity with { dps (already tier-scaled), damageType,
//   range, canTarget, aoeRadius, cooldownTimer, fireInterval }
// ctx = { tables, candidates, onKill, onHit, source }
export function fireWeapon(shooter, dt, ctx) {
  if (!shooter || shooter.dead) return null;
  if (isDisabled(shooter)) {
    // Disabled machines still tick cooldown toward zero but cannot fire.
    if (shooter.cooldownTimer > 0) shooter.cooldownTimer = Math.max(0, shooter.cooldownTimer - dt);
    return null;
  }

  const tables = ctx.tables;
  const weapon = {
    x: shooter.x,
    y: shooter.y,
    rangeTiles: shooter.range || 0,
    canTarget: shooter.canTarget || 'Ground',
    targetsBase: !!shooter.targetsBase,
    targetsStructures: shooter.targets === 'Structures',
  };

  // Re-acquire target if invalid.
  if (!targetStillValid(weapon, shooter.target)) {
    shooter.target = acquireTarget(weapon, ctx.candidates || []);
    // Telegraph reset: aiming state.
    shooter.state = shooter.target ? 'Aiming' : (shooter.baseState || 'Idle');
  }

  // Advance cooldown.
  if (shooter.cooldownTimer == null) shooter.cooldownTimer = 0;
  if (shooter.cooldownTimer > 0) {
    shooter.cooldownTimer = Math.max(0, shooter.cooldownTimer - dt);
  }

  if (!shooter.target) return null;

  // Fire interval: how often a "shot" lands. We model DPS as continuous, but
  // present discrete shots for FX. Use fireInterval or derive a default.
  const interval = shooter.fireInterval || 1.0;

  // Continuous DPS application (deterministic, frame-rate independent).
  // Damage dealt this tick = dps * dt to the primary target.
  const dps = shooter.dps || 0;
  const damageType = shooter.damageType || 'Kinetic';
  const flags = damageTypeFlags(tables, damageType);

  const primary = shooter.target;
  const tickDamage = dps * dt;

  const hitCtx = {
    tables,
    source: shooter,
    onKill: ctx.onKill,
  };

  applyDamage(tables, primary, tickDamage, damageType, hitCtx);
  applyStatus(primary, damageType, dps, flags);

  // AoE splash — damage other candidates within aoeRadius of the primary.
  const aoe = shooter.aoeRadius || 0;
  if (aoe > 0) {
    const aoeWorld = tilesToWorld(aoe);
    const cands = ctx.candidates || [];
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      if (!c || c === primary || c.dead || c.hp <= 0) continue;
      if (!weaponCanHit(weapon.canTarget, c)) continue;
      if (dist(primary.x, primary.y, c.x, c.y) <= aoeWorld) {
        applyDamage(tables, c, tickDamage * 0.5, damageType, hitCtx);
        applyStatus(c, damageType, dps * 0.5, flags);
      }
    }
  }

  // Electric chain — bounce to nearest additional target.
  if (flags.chain) {
    const chainWorld = tilesToWorld(2.5);
    const cands = ctx.candidates || [];
    let bounce = null;
    let bd = Infinity;
    let bid = Infinity;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      if (!c || c === primary || c.dead || c.hp <= 0) continue;
      if (!weaponCanHit(weapon.canTarget, c)) continue;
      const d = dist(primary.x, primary.y, c.x, c.y);
      const cid = c.id != null ? c.id : i;
      if (d <= chainWorld && (d < bd - 1e-6 || (Math.abs(d - bd) <= 1e-6 && cid < bid))) {
        bounce = c; bd = d; bid = cid;
      }
    }
    if (bounce) {
      applyDamage(tables, bounce, tickDamage * 0.6, damageType, hitCtx);
      applyStatus(bounce, damageType, dps * 0.6, flags);
    }
  }

  // Discrete shot bookkeeping for FX telegraphing.
  if (shooter.cooldownTimer <= 0) {
    shooter.cooldownTimer = interval;
    shooter.state = 'Firing';
    shooter.lastShotTarget = primary.id != null ? primary.id : null;
    if (ctx.onHit) ctx.onHit(shooter, primary, damageType);
  }

  return primary;
}

// ---------------------------------------------------------------------------
// Base damage — attackers that reach & target the base
// ---------------------------------------------------------------------------
// Attacker deals continuous DPS to the base while in range.
export function attackBase(attacker, base, dt, ctx) {
  if (!attacker || attacker.dead || !base) return 0;
  if (isDisabled(attacker)) return 0;
  const rangeWorld = tilesToWorld(attacker.range || 0);
  const d = dist(attacker.x, attacker.y, base.x, base.y);
  if (d > rangeWorld + (base.radius || 0)) return 0;

  const tables = ctx.tables;
  const dps = attacker.dps || 0;
  const damageType = attacker.damageType || 'Kinetic';
  const tickDamage = dps * dt;

  const before = base.hp;
  const mult = effectivenessMultiplier(tables, damageType, base.armorClass || 'Structure');
  base.hp -= tickDamage * mult;
  if (base.hp < 0) base.hp = 0;
  attacker.state = 'Attacking';
  const dealt = before - base.hp;
  if (ctx.onBaseHit) ctx.onBaseHit(attacker, base, dealt);
  return dealt;
}

// ---------------------------------------------------------------------------
// Full combat step — used by sim/step.js and the headless balance sim.
// ---------------------------------------------------------------------------
// state = strict sim state; ctx supplies callbacks + tables.
export function stepCombat(state, dt, ctx) {
  const tables = (ctx && ctx.tables) || (state.tables) || {};
  const cb = {
    tables,
    onKill: (ctx && ctx.onKill) || null,
    onHit: (ctx && ctx.onHit) || null,
    onBaseHit: (ctx && ctx.onBaseHit) || null,
  };

  const attackers = state.attackers || (state.entities && state.entities.attackers) || [];
  const structures = state.structures || (state.entities && state.entities.structures) || [];
  const base = state.base || (state.entities && state.entities.base);

  // --- 1. Tick status effects on all combatants (DoT/slow/disable) ---
  for (let i = 0; i < attackers.length; i++) {
    tickStatus(tables, attackers[i], dt, cb);
  }
  for (let i = 0; i < structures.length; i++) {
    tickStatus(tables, structures[i], dt, cb);
  }

  // --- 2. Towers/structures fire on attackers within their targetable domains ---
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (!s || s.dead) continue;
    if (s.state === 'Building' || s.state === 'Placing' || s.state === 'Selling') continue;
    if (s.isTerrain || s.kind === 'wall' || s.kind === 'moat') continue; // walls/moats don't fire
    if (!s.dps || s.dps <= 0) continue; // non-weapon structures skip
    // Only alive attacker candidates.
    fireWeapon(s, dt, {
      tables,
      candidates: attackers,
      onKill: cb.onKill,
      onHit: cb.onHit,
    });
  }

  // --- 3. Attackers act: siege units target structures; others attack base ---
  for (let i = 0; i < attackers.length; i++) {
    const a = attackers[i];
    if (!a || a.dead) continue;

    if (a.targets === 'Structures') {
      // Siege: prefer nearest in-range structure, else march (handled by pathing).
      const weapon = {
        x: a.x, y: a.y,
        rangeTiles: a.range || 0,
        canTarget: a.canTarget || 'Ground',
      };
      const structCands = structures.filter(
        (s) => s && !s.dead && !s.isTerrain
      );
      if (!targetStillValid(weapon, a.target)) {
        a.target = acquireTarget(weapon, structCands);
      }
      if (a.target) {
        fireWeapon(a, dt, {
          tables,
          candidates: structCands,
          onKill: cb.onKill,
          onHit: cb.onHit,
        });
      } else if (base) {
        // No structures in range → fall back to base.
        attackBase(a, base, dt, cb);
      }
    } else {
      // Base-targeting attacker.
      if (base) attackBase(a, base, dt, cb);
    }
  }

  // --- 4. Reap dead attackers (mark; removal handled by state/lifecycle) ---
  // Kept here as combat state cleanup marker only; actual splice done outside
  // to preserve deterministic ordering with economy/kill income.
  return state;
}

export default {
  DOMAIN,
  entityDomain,
  canTargetDomains,
  weaponCanHit,
  effectivenessMultiplier,
  damageTypeFlags,
  applyStatus,
  slowMultiplier,
  isDisabled,
  applyDamage,
  tickStatus,
  acquireTarget,
  targetStillValid,
  fireWeapon,
  attackBase,
  stepCombat,
};