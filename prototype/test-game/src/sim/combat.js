// src/sim/combat.js
// Weapon-domain targeting, effectiveness-matrix damage, target acquisition,
// projectiles / fire cooldowns, kill->income events, attacker vs base/structure damage.
// Pure deterministic sim code: no rendering deps, no Math.random (rng only via state.rng if ever needed).

import { ASSUMPTIONS, EFFECTIVENESS } from '../data/tables.js';

// ---------------------------------------------------------------------------
// Tunables (read from Assumptions table when present, sane fallbacks otherwise)
// ---------------------------------------------------------------------------

function assume(key, def) {
  if (!ASSUMPTIONS) return def;
  const v = ASSUMPTIONS[key];
  if (typeof v === 'number') return v;
  if (v && typeof v.value === 'number') return v.value;
  return def;
}

export const FIRE_INTERVAL = assume('Fire_interval', 1.0);            // seconds between shots
export const PROJECTILE_SPEED = assume('Projectile_speed', 9.0);      // tiles / second
export const KILL_INCOME_FRACTION = assume('Kill_income_fraction', 0.25);
export const CHILL_DURATION = assume('Chill_duration', 2.0);
export const CHILL_SLOW_FACTOR = assume('Chill_slow_factor', 0.5);
export const STAGGER_DURATION = assume('Stagger_duration', 0.5);
export const BURN_DURATION = assume('Burn_duration', 3.0);
export const BURN_DPS_FRACTION = assume('Burn_dps_fraction', 0.2);
export const TOXIN_DURATION = assume('Toxin_duration', 4.0);
export const TOXIN_DPS_FRACTION = assume('Toxin_dps_fraction', 0.25);
export const CHAIN_RADIUS = assume('Chain_radius', 1.5);
export const CHAIN_DAMAGE_FRACTION = assume('Chain_damage_fraction', 0.5);
export const RANGE_EPSILON = 0.001;

// ---------------------------------------------------------------------------
// Domain / effectiveness helpers
// ---------------------------------------------------------------------------

export function isAir(e) {
  if (!e) return false;
  return e.domain === 'Flyer' || e.domain === 'flyer' || e.domain === 'Air' || e.domain === 'air' || e.flying === true;
}

export function targetClassOf(e) {
  return isAir(e) ? 'Air' : 'Ground';
}

// A weapon declares which domains it may hit: 'Ground', 'Air', or 'Both'.
export function weaponCanHit(canTarget, targetDomainClass) {
  if (!canTarget) return targetDomainClass === 'Ground'; // default weapons are anti-ground
  if (canTarget === 'Both') return true;
  return canTarget === targetDomainClass;
}

export function getEffectiveness(damageType, armorClass) {
  if (!damageType || !armorClass) return 1;
  const eff = EFFECTIVENESS;
  if (!eff) return 1;
  const row = eff[damageType];
  if (row && typeof row[armorClass] === 'number') return row[armorClass];
  // tolerate array-of-rows shape [{ 'Damage Type': 'Fire', Organic: 1.3, ... }]
  if (Array.isArray(eff)) {
    for (let i = 0; i < eff.length; i++) {
      const r = eff[i];
      if (r && (r.type === damageType || r['Damage Type'] === damageType || r.damageType === damageType)) {
        if (typeof r[armorClass] === 'number') return r[armorClass];
      }
    }
  }
  return 1;
}

export function computeDamage(rawDamage, damageType, armorClass) {
  return rawDamage * getEffectiveness(damageType, armorClass);
}

export function killIncomeFor(unit) {
  const cost = (unit && (unit.cost || unit.price || unit.costT1)) || 0;
  return Math.max(0, Math.round(cost * KILL_INCOME_FRACTION));
}

// ---------------------------------------------------------------------------
// State access helpers
// ---------------------------------------------------------------------------

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function unitAlive(u) {
  return !!u && u.alive !== false && u.hp > 0;
}

function structureLive(s) {
  if (!s || s.hp <= 0) return false;
  const st = s.state;
  return st !== 'Destroyed' && st !== 'Placing';
}

function structureCanFire(s) {
  if (!structureLive(s)) return false;
  const st = s.state;
  return (st === 'Complete' || st === 'Damaged') && (s.dps || 0) > 0 && (s.range || 0) > 0;
}

function targetVisible(t) {
  // vision.js exposes per-entity visibility flags; default to visible.
  if (!t) return false;
  if (t.detected === false) return false;
  if (t.visible === false) return false;
  return true;
}

function findEntity(state, id) {
  if (id == null) return null;
  if (state.base && (id === state.base.id || id === 'base')) return state.base;
  const units = state.units || [];
  for (let i = 0; i < units.length; i++) if (units[i].id === id) return units[i];
  const structs = state.structures || [];
  for (let i = 0; i < structs.length; i++) if (structs[i].id === id) return structs[i];
  return null;
}

function pushEvent(state, events, ev) {
  ev.tick = state.tick | 0;
  events.push(ev);
}

// ---------------------------------------------------------------------------
// Target acquisition (deterministic, sticky)
// ---------------------------------------------------------------------------

export function acquireTarget(shooter, candidates) {
  const range = (shooter.range || 0) + RANGE_EPSILON;
  const canTarget = shooter.canTarget;

  const valid = (t) => {
    if (t === shooter) return false;
    if (t.isBase) { if (t.hp <= 0) return false; }
    else if (t.isStructure || t.state !== undefined && t.footprint !== undefined) { if (!structureLive(t)) return false; }
    else if (t.isStructure) { if (!structureLive(t)) return false; }
    else if (!unitAlive(t) && !t.isBase && !t.isStructure) {
      if (t.state !== undefined && t.tier !== undefined) { if (!structureLive(t)) return false; }
      else return false;
    }
    if (!targetVisible(t)) return false;
    if (!weaponCanHit(canTarget, targetClassOf(t))) return false;
    return dist(shooter.x, shooter.y, t.x, t.y) <= range;
  };

  // sticky: keep the current target while it remains valid & in range
  if (shooter.targetId != null) {
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].id === shooter.targetId) {
        if (valid(candidates[i])) return candidates[i];
        break;
      }
    }
  }

  let best = null, bestD = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const t = candidates[i];
    if (!valid(t)) continue;
    const d = dist(shooter.x, shooter.y, t.x, t.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export function spawnProjectile(state, events, shooter, target) {
  const interval = shooter.fireInterval || FIRE_INTERVAL;
  const rawDamage = (shooter.dps || 0) * interval;
  if (!state.projectiles) state.projectiles = [];
  state._nextProjectileId = (state._nextProjectileId || 0) + 1;
  const p = {
    id: 'p' + state._nextProjectileId,
    x: shooter.x, y: shooter.y,
    tx: target.x, ty: target.y,
    targetId: target.id,
    team: shooter.team || (shooter.tier !== undefined ? 'defender' : 'attacker'),
    sourceId: shooter.id,
    damage: rawDamage,
    damageType: shooter.damageType || 'Kinetic',
    canTarget: shooter.canTarget || 'Ground',
    aoe: shooter.aoe || 0,
    speed: shooter.projectileSpeed || PROJECTILE_SPEED,
    alive: true,
  };
  state.projectiles.push(p);
  shooter.lastShotTick = state.tick | 0;
  pushEvent(state, events, { type: 'shot', from: shooter.id, to: target.id, x: shooter.x, y: shooter.y, tx: target.x, ty: target.y, damageType: p.damageType });
  return p;
}

// ---------------------------------------------------------------------------
// Damage application (effectiveness matrix + status effects)
// ---------------------------------------------------------------------------

export function applyDamage(state, events, target, rawDamage, damageType, sourceTeam, sourceId) {
  if (!target) return 0;
  const armor = target.armorClass || (target.isBase || target.tier !== undefined ? 'Structure' : 'Organic');
  const mult = getEffectiveness(damageType, armor);
  const dmg = rawDamage * mult;
  if (dmg <= 0 && damageType !== 'Frost') {
    // zero-effect hit (e.g. poison vs structure) — still no status on immune
    if (mult <= 0) return 0;
  }
  target.hp -= dmg;
  if (target.hp < 0) target.hp = 0;

  applyStatus(target, rawDamage, damageType, mult, sourceTeam, sourceId);

  if (target.isBase || target === state.base) {
    pushEvent(state, events, { type: 'baseDamaged', amount: dmg, hp: target.hp });
    if (target.hp <= 0 && !target._destroyedReported) {
      target._destroyedReported = true;
      target.alive = false;
      pushEvent(state, events, { type: 'baseDestroyed' });
    }
  } else if (target.tier !== undefined || target.isStructure) {
    // structure
    if (target.hp > 0) {
      if (target.state === 'Complete') target.state = 'Damaged';
      pushEvent(state, events, { type: 'structureDamaged', id: target.id, hp: target.hp, amount: dmg });
    } else if (target.state !== 'Destroyed') {
      target.state = 'Destroyed';
      target.alive = false;
      pushEvent(state, events, { type: 'structureDestroyed', id: target.id, x: target.x, y: target.y });
      state.pathsDirty = true; // walls/moats gone -> walker paths must recompute
    }
  } else {
    // unit
    if (target.hp <= 0 && target.alive !== false) {
      target.alive = false;
      const income = (target.team === 'attacker' && sourceTeam === 'defender') ? killIncomeFor(target) : 0;
      pushEvent(state, events, {
        type: 'kill', id: target.id, kind: target.kind, team: target.team,
        x: target.x, y: target.y, income, by: sourceId,
      });
    }
  }
  return dmg;
}

function applyStatus(target, rawDamage, damageType, mult, sourceTeam, sourceId) {
  if (target.hp <= 0) return;
  if (damageType === 'Frost') {
    // Frost slows ALL except air units (design rule: no slow on air)
    if (!isAir(target)) {
      target.chillTimer = CHILL_DURATION;
    }
  } else if (damageType === 'Concussion') {
    if ((target.armorClass || '') === 'Machinery') target.staggerTimer = STAGGER_DURATION;
  } else if (damageType === 'Fire' && mult > 0) {
    if (!target.dots) target.dots = [];
    target.dots.push({ dps: rawDamage * mult * BURN_DPS_FRACTION, timeLeft: BURN_DURATION, damageType: 'Fire', sourceTeam, sourceId });
  } else if (damageType === 'Poison' && mult > 0) {
    if (!target.dots) target.dots = [];
    target.dots.push({ dps: rawDamage * mult * TOXIN_DPS_FRACTION, timeLeft: TOXIN_DURATION, damageType: 'Poison', sourceTeam, sourceId });
  }
}

// ---------------------------------------------------------------------------
// Per-frame combat step
// ---------------------------------------------------------------------------

function tickStatuses(state, events, dt) {
  const units = state.units || [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!unitAlive(u)) { u.slowFactor = 1; continue; }
    if (u.chillTimer > 0) {
      u.chillTimer -= dt;
      u.slowFactor = CHILL_SLOW_FACTOR;
      if (u.chillTimer <= 0) { u.chillTimer = 0; u.slowFactor = 1; }
    } else {
      u.slowFactor = 1;
    }
    if (u.staggerTimer > 0) { u.staggerTimer -= dt; if (u.staggerTimer < 0) u.staggerTimer = 0; }
    if (u.dots && u.dots.length) {
      for (let d = 0; d < u.dots.length; d++) {
        const dot = u.dots[d];
        const step = Math.min(dot.timeLeft, dt);
        if (step > 0) {
          u.hp -= dot.dps * step;
          dot.timeLeft -= step;
        }
      }
      u.dots = u.dots.filter((d) => d.timeLeft > 0);
      if (u.hp <= 0 && u.alive !== false) {
        u.hp = 0;
        u.alive = false;
        // credit last defender-sourced dot if any
        let by = null, income = 0;
        if (u.team === 'attacker') { income = killIncomeFor(u); }
        pushEvent(state, events, { type: 'kill', id: u.id, kind: u.kind, team: u.team, x: u.x, y: u.y, income, by });
      }
    }
  }
}

function fireShooter(state, events, shooter, candidates, dt) {
  if (shooter.cooldown == null) shooter.cooldown = 0;
  if (shooter.cooldown > 0) shooter.cooldown -= dt;

  if ((shooter.dps || 0) <= 0 || (shooter.range || 0) <= 0) {
    shooter.targetId = null;
    shooter.attacking = false;
    return;
  }

  const target = acquireTarget(shooter, candidates);
  shooter.targetId = target ? target.id : null;
  shooter.attacking = !!target;

  if (!target) return;
  if (shooter.staggerTimer > 0) return; // concussion stagger suppresses fire
  if (shooter.cooldown <= 0) {
    shooter.cooldown += (shooter.fireInterval || FIRE_INTERVAL);
    spawnProjectile(state, events, shooter, target);
  }
}

function resolveImpact(state, events, p, target) {
  const ix = target ? target.x : p.tx;
  const iy = target ? target.y : p.ty;
  pushEvent(state, events, { type: 'impact', x: ix, y: iy, damageType: p.damageType, team: p.team });

  if (target) {
    applyDamage(state, events, target, p.damage, p.damageType, p.team, p.sourceId);
  }

  // splash (AoE) — hits other valid enemies of this projectile's team within radius
  if (p.aoe > 0) {
    const splashTargets = enemiesOf(state, p.team);
    for (let i = 0; i < splashTargets.length; i++) {
      const t = splashTargets[i];
      if (!t || (target && t.id === target.id)) continue;
      if (!isLiveTarget(t)) continue;
      if (!weaponCanHit(p.canTarget, targetClassOf(t))) continue;
      if (dist(ix, iy, t.x, t.y) <= p.aoe + RANGE_EPSILON) {
        applyDamage(state, events, t, p.damage, p.damageType, p.team, p.sourceId);
      }
    }
  }

  // electric chain — arcs to the single nearest additional enemy
  if (p.damageType === 'Electric' && target) {
    const pool = enemiesOf(state, p.team);
    let best = null, bestD = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const t = pool[i];
      if (!t || t.id === target.id || !isLiveTarget(t)) continue;
      if (!weaponCanHit(p.canTarget, targetClassOf(t))) continue;
      const d = dist(ix, iy, t.x, t.y);
      if (d <= CHAIN_RADIUS + RANGE_EPSILON && d < bestD) { bestD = d; best = t; }
    }
    if (best) applyDamage(state, events, best, p.damage * CHAIN_DAMAGE_FRACTION, p.damageType, p.team, p.sourceId);
  }
}

function isLiveTarget(t) {
  if (!t) return false;
  if (t.isBase) return t.hp > 0;
  if (t.tier !== undefined || t.isStructure) return structureLive(t);
  return unitAlive(t);
}

function enemiesOf(state, team) {
  if (team === 'defender') {
    return (state.units || []).filter((u) => u.team === 'attacker');
  }
  // attackers hurt defender-side property: structures + base
  const out = [];
  const structs = state.structures || [];
  for (let i = 0; i < structs.length; i++) out.push(structs[i]);
  if (state.base) out.push(state.base);
  return out;
}

export function updateProjectiles(state, events, dt) {
  const projectiles = state.projectiles || [];
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (!p.alive) continue;
    const target = findEntity(state, p.targetId);
    const live = isLiveTarget(target);
    if (live) { p.tx = target.x; p.ty = target.y; }
    const d = dist(p.x, p.y, p.tx, p.ty);
    const step = p.speed * dt;
    if (d <= step || d < RANGE_EPSILON) {
      p.x = p.tx; p.y = p.ty;
      p.alive = false;
      if (live) resolveImpact(state, events, p, target);
      else if (p.aoe > 0) resolveImpact(state, events, p, null); // AoE still detonates at last known point
    } else {
      p.x += ((p.tx - p.x) / d) * step;
      p.y += ((p.ty - p.y) / d) * step;
    }
  }
  state.projectiles = projectiles.filter((p) => p.alive);
}

// ---------------------------------------------------------------------------
// Main entry — called each fixed step by the headless core (same code path
// the balance-sim harness drives; zero rendering dependencies).
// ---------------------------------------------------------------------------

export function updateCombat(state, dt, events) {
  if (!events) {
    if (!state.events) state.events = [];
    events = state.events;
  }

  // 1) status effects & damage-over-time
  tickStatuses(state, events, dt);

  const units = state.units || [];
  const structures = state.structures || [];
  const attackers = units.filter((u) => u.team === 'attacker' && unitAlive(u));
  const defenders = units.filter((u) => u.team !== 'attacker' && unitAlive(u));
  const liveStructures = structures.filter(structureLive);
  const base = state.base;

  // 2) defensive structures fire at attackers (anti-air hits air; anti-ground cannot)
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (!structureCanFire(s)) { s.targetId = null; continue; }
    if (!s.team) s.team = 'defender';
    fireShooter(state, events, s, attackers, dt);
  }

  // 3) deployed defender troops fight attackers
  for (let i = 0; i < defenders.length; i++) {
    fireShooter(state, events, defenders[i], attackers, dt);
  }

  // 4) attackers: basic units target the base only (structures are hazards);
  //    flagged units (targets === 'Structures') besiege structures, base as fallback.
  for (let i = 0; i < attackers.length; i++) {
    const u = attackers[i];
    const wantsStructures = u.targets === 'Structures' || u.targetsStructures === true || u.targetsBase === false;
    let candidates;
    if (wantsStructures) {
      candidates = liveStructures.slice();
      if (base && base.hp > 0) candidates.push(base);
    } else {
      candidates = (base && base.hp > 0) ? [base] : [];
    }
    fireShooter(state, events, u, candidates, dt);
  }

  // 5) projectiles travel and land
  updateProjectiles(state, events, dt);

  return events;
}

// Alias for integrators that prefer step naming.
export const stepCombat = updateCombat;

export default {
  updateCombat,
  stepCombat,
  updateProjectiles,
  acquireTarget,
  spawnProjectile,
  applyDamage,
  computeDamage,
  getEffectiveness,
  weaponCanHit,
  targetClassOf,
  isAir,
  killIncomeFor,
  FIRE_INTERVAL,
  PROJECTILE_SPEED,
  KILL_INCOME_FRACTION,
};