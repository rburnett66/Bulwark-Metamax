Looking at the model, I need to implement a headless combat core: firing with telegraph/wind-up, projectiles (ballistic/hitscan), damage-type × armor-class resolution, and kills. It must be deterministic and read from config tables.

```javascript
// src/sim/combat.js
// Headless combat core: firing, projectiles, damage-type resolution, kills.
// Deterministic. Reads stats from config.data.tables. Never renders.
//
// This module operates on the strict world state produced by world.js and
// consumed by step.js. It handles:
//   - Weapon cooldowns + telegraph/lock-on wind-up (time-to-fire) before launch
//   - Projectile spawning (ballistic lob vs hitscan beam)
//   - Projectile travel + impact
//   - Damage-type x armor-class effectiveness resolution (+ AoE, status flags)
//   - Kill detection, income grant, structure destruction handoff to lifecycle
//
// It exposes pure-ish functions that mutate world in place using the world's
// deterministic RNG (world.rng) and fixed dt.

import { effectivenessMultiplier } from '../config/effectiveness.js';

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

// Resolve an entity's live position (x,y) regardless of shape.
function entPos(e) {
  return { x: e.x, y: e.y };
}

// Is the entity alive / a valid target still in world?
function isAlive(e) {
  return e && !e.dead && e.hp > 0 &&
    e.lifecycle !== 'Destroyed' && e.lifecycle !== 'Selling';
}

// Pull a weapon descriptor from an attacking entity (tower or unit).
// Weapons are data-driven; entities carry resolved stats on themselves
// (dps, range, damageType, armorTargeting, canTarget, aoe, status, projectileClass).
function getWeapon(e) {
  return {
    dps: e.dps || 0,
    range: e.range || 0,
    damageType: e.damageType || 'Kinetic',
    canTargetAir: !!e.canTargetAir,
    canTargetGround: e.canTargetGround !== false,
    aoe: e.aoe || 0,
    status: e.status || '—',
    // projectile class: 'beam' = hitscan, 'lob'/'ballistic' = traveling arc
    projectileClass: e.projectileClass || (e.aoe > 0 ? 'lob' : 'bolt'),
    projectileSpeed: e.projectileSpeed || 16, // tiles/sec for traveling shots
    // fire cadence: shots per second derived so that dps == damagePerShot * fireRate
    fireRate: e.fireRate || 1.0, // shots/sec
    // time-to-fire (lock-on wind-up) telegraph, seconds
    windUp: (e.windUp != null) ? e.windUp : 0.35,
  };
}

// Damage per individual shot given dps and fireRate.
function damagePerShot(w) {
  return w.fireRate > 0 ? (w.dps / w.fireRate) : w.dps;
}

// ---------------------------------------------------------------------------
// Armor class of a target for effectiveness lookup
// ---------------------------------------------------------------------------

function armorClassOf(target) {
  if (target.kind === 'base') return 'Structure';
  if (target.isStructure) return 'Structure';
  if (target.armorClass) return target.armorClass;
  // fallbacks by domain
  if (target.domain === 'Flyer') return 'Aircraft';
  return 'Machinery';
}

// ---------------------------------------------------------------------------
// Status effect application (Frost slow, Fire/Poison DoT, Electric/Concussion)
// ---------------------------------------------------------------------------

function applyStatus(world, target, status, damageType, magnitude) {
  if (!target || status === '—' || !status) return;
  target.status = target.status || {};

  switch (damageType) {
    case 'Frost': {
      // Chill: slow ALL except air units (design rule).
      if (target.domain !== 'Flyer') {
        target.status.chill = { slow: 0.5, until: world.time + 2.0 };
      }
      break;
    }
    case 'Fire': {
      // Burn DoT
      target.status.burn = {
        dps: magnitude * 0.25,
        until: world.time + 3.0,
        damageType: 'Fire',
      };
      break;
    }
    case 'Poison': {
      // Toxin DoT (only meaningful vs organics; multiplier handled elsewhere)
      target.status.toxin = {
        dps: magnitude * 0.3,
        until: world.time + 4.0,
        damageType: 'Poison',
      };
      break;
    }
    case 'Concussion': {
      // Stagger: brief machine stagger (disables firing for structures/machines)
      const ac = armorClassOf(target);
      if (ac === 'Machinery' || ac === 'Structure' || target.isStructure) {
        target.status.stagger = { until: world.time + 0.6 };
      }
      break;
    }
    case 'Electric': {
      // Overload: disables machines briefly
      const ac = armorClassOf(target);
      if (ac === 'Machinery' || ac === 'Structure') {
        target.status.overload = { until: world.time + 0.8 };
      }
      break;
    }
    default:
      break;
  }
}

// Is an entity currently disabled from firing by a status?
export function isDisabled(world, e) {
  if (!e.status) return false;
  const s = e.status;
  if (s.stagger && s.stagger.until > world.time) return true;
  if (s.overload && s.overload.until > world.time) return true;
  return false;
}

// Current speed multiplier from status (Frost chill).
export function speedMultiplier(world, e) {
  if (!e.status || !e.status.chill) return 1;
  if (e.status.chill.until > world.time) return 1 - e.status.chill.slow;
  return 1;
}

// ---------------------------------------------------------------------------
// Damage resolution
// ---------------------------------------------------------------------------

// Apply raw pre-type damage to a target through the effectiveness matrix.
// Returns actual damage dealt (post-multiplier), and handles kill.
export function dealDamage(world, source, target, rawAmount, damageType, evtType) {
  if (!isAlive(target)) return 0;

  const armor = armorClassOf(target);
  const mult = effectivenessMultiplier(damageType, armor);
  const amount = rawAmount * mult;

  target.hp -= amount;

  // Structure damage state transitions handled by lifecycle; flag here.
  if (target.isStructure && target.lifecycle === 'Complete' && target.hp < (target.maxHp || target.hp)) {
    target.lifecycle = 'Damaged';
  }

  // event log
  world.events.push({
    t: evtType || 'damage',
    time: world.time,
    tick: world.tick,
    src: source ? source.id : null,
    dst: target.id,
    amount,
    damageType,
    mult,
  });

  // Kill / destruction
  if (target.hp <= 0 && !target.dead) {
    handleKill(world, source, target);
  }
  return amount;
}

function handleKill(world, source, target) {
  target.hp = 0;

  if (target.kind === 'base') {
    // base death handled by waves/step; mark it.
    target.dead = true;
    world.events.push({ t: 'baseDestroyed', time: world.time, tick: world.tick, dst: target.id });
    world.baseDestroyed = true;
    return;
  }

  if (target.isStructure) {
    // structure destroyed -> lifecycle FSM will finalize removal
    target.lifecycle = 'Destroyed';
    target.dead = true;
    target.status = target.status || {};
    world.events.push({ t: 'structureDestroyed', time: world.time, tick: world.tick, dst: target.id, src: source ? source.id : null });
    return;
  }

  // Attacker unit killed -> grant income to player, coin feedback event
  target.dead = true;
  const bounty = target.bounty != null ? target.bounty : Math.round((target.cost || 0) * 0.25);
  if (world.economy) {
    world.economy.gold += bounty;
    world.economy.lastDelta = (world.economy.lastDelta || 0) + bounty;
  }
  world.events.push({
    t: 'kill',
    time: world.time,
    tick: world.tick,
    src: source ? source.id : null,
    dst: target.id,
    kind: target.kind,
    bounty,
    x: target.x,
    y: target.y,
  });
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

let PROJ_SEQ = 1;
function nextProjId() { return 'proj' + (PROJ_SEQ++); }

function spawnProjectile(world, source, target, w) {
  const dmg = damagePerShot(w);
  const proj = {
    id: nextProjId(),
    srcId: source.id,
    dstId: target ? target.id : null,
    x: source.x,
    y: source.y,
    // remember target position (for lob) but home for bolts
    tx: target ? target.x : source.x,
    ty: target ? target.y : source.y,
    damage: dmg,
    damageType: w.damageType,
    aoe: w.aoe,
    status: w.status,
    projectileClass: w.projectileClass,
    speed: w.projectileSpeed,
    born: world.time,
    dead: false,
  };

  if (w.projectileClass === 'beam') {
    // Hitscan: resolve immediately.
    proj.hitscan = true;
    resolveProjectileImpact(world, proj, target);
    proj.dead = true;
    world.events.push({
      t: 'beam', time: world.time, tick: world.tick,
      src: source.id, dst: target ? target.id : null,
      x0: source.x, y0: source.y, x1: proj.tx, y1: proj.ty,
      damageType: w.damageType,
    });
    return;
  }

  world.projectiles.push(proj);
  world.events.push({
    t: 'muzzle', time: world.time, tick: world.tick,
    src: source.id, x: source.x, y: source.y, damageType: w.damageType,
  });
}

// Move projectiles, detect impact, resolve.
export function stepProjectiles(world, dt) {
  const live = [];
  for (let i = 0; i < world.projectiles.length; i++) {
    const p = world.projectiles[i];
    if (p.dead) continue;

    // homing: update target position if target still alive (bolts home; lobs go to remembered point)
    const target = p.dstId ? world.byId[p.dstId] : null;
    if (p.projectileClass !== 'lob' && isAlive(target)) {
      p.tx = target.x;
      p.ty = target.y;
    }

    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const stepDist = p.speed * dt;

    if (d <= stepDist || d < 1e-4) {
      // impact
      p.x = p.tx; p.y = p.ty;
      resolveProjectileImpact(world, p, isAlive(target) ? target : null);
      p.dead = true;
      world.events.push({
        t: 'impact', time: world.time, tick: world.tick,
        x: p.x, y: p.y, damageType: p.damageType, aoe: p.aoe,
      });
      continue;
    }

    p.x += (dx / d) * stepDist;
    p.y += (dy / d) * stepDist;

    // safety: expire very old projectiles
    if (world.time - p.born > 8) { p.dead = true; continue; }

    live.push(p);
  }
  world.projectiles = live;
}

function resolveProjectileImpact(world, proj, primaryTarget) {
  const source = world.byId[proj.srcId] || null;

  if (proj.aoe && proj.aoe > 0) {
    // Splash: damage every valid target of the source's targeting set within aoe.
    const r = proj.aoe;
    const r2 = r * r;
    // Collect candidate targets: attackers OR structures depending on source
    const cands = candidateTargetsForSplash(world, source);
    for (let i = 0; i < cands.length; i++) {
      const t = cands[i];
      if (!isAlive(t)) continue;
      if (dist2(t.x, t.y, proj.x, proj.y) <= r2) {
        dealDamage(world, source, t, proj.damage, proj.damageType, 'splash');
        applyStatus(world, t, proj.status, proj.damageType, proj.damage);
      }
    }
    // ensure primary hit even if just outside epsilon
    if (primaryTarget && isAlive(primaryTarget)) {
      if (dist2(primaryTarget.x, primaryTarget.y, proj.x, proj.y) > r2) {
        dealDamage(world, source, primaryTarget, proj.damage, proj.damageType, 'splash');
        applyStatus(world, primaryTarget, proj.status, proj.damageType, proj.damage);
      }
    }
  } else {
    if (primaryTarget && isAlive(primaryTarget)) {
      dealDamage(world, source, primaryTarget, proj.damage, proj.damageType, 'hit');
      applyStatus(world, primaryTarget, proj.status, proj.damageType, proj.damage);
    }
  }
}

// Which entities can be splashed for a given source (based on side).
function candidateTargetsForSplash(world, source) {
  if (!source) return [];
  if (source.side === 'defender') {
    // tower splash hits attackers
    return world.attackers || [];
  }
  // attacker splash hits structures + base
  const out = [];
  if (world.structures) {
    for (let i = 0; i < world.structures.length; i++) out.push(world.structures[i]);
  }
  if (world.base) out.push(world.base);
  return out;
}

// ---------------------------------------------------------------------------
// DoT ticking (Fire burn / Poison toxin)
// ---------------------------------------------------------------------------

export function stepStatusEffects(world, dt) {
  const list = [];
  if (world.attackers) for (const a of world.attackers) list.push(a);
  if (world.structures) for (const s of world.structures) list.push(s);
  if (world.base) list.push(world.base);

  for (const e of list) {
    if (!e.status || !isAlive(e)) continue;
    const s = e.status;
    // Burn
    if (s.burn) {
      if (s.burn.until > world.time) {
        dealDamage(world, null, e, s.burn.dps * dt, s.burn.damageType, 'dot');
      } else {
        delete s.burn;
      }
    }
    // Toxin
    if (s.toxin && isAlive(e)) {
      if (s.toxin.until > world.time) {
        dealDamage(world, null, e, s.toxin.dps * dt, s.toxin.damageType, 'dot');
      } else {
        delete s.toxin;
      }
    }
    // expire transient
    if (s.chill && s.chill.until <= world.time) delete s.chill;
    if (s.stagger && s.stagger.until <= world.time) delete s.stagger;
    if (s.overload && s.overload.until <= world.time) delete s.overload;
  }
}

// ---------------------------------------------------------------------------
// Firing (towers + units with weapons)
// ---------------------------------------------------------------------------
// Firing lifecycle per shooter:
//   fireCooldown: seconds until next shot is allowed
//   aimTarget: currently locked target id
//   windUpLeft: telegraph/lock-on remaining before launch (time-to-fire)
//   aimState: 'idle' | 'aiming' | 'firing'
//
// The targeting module (targeting.js) selects targets; here we consume them.

import { selectTarget } from './targeting.js';

export function stepShooter(world, shooter, dt) {
  if (!isAlive(shooter)) return;

  // Structures must be Complete to fire.
  if (shooter.isStructure && shooter.lifecycle !== 'Complete' && shooter.lifecycle !== 'Damaged') {
    shooter.aimState = 'idle';
    return;
  }

  // Disabled by status?
  if (isDisabled(world, shooter)) {
    shooter.aimState = 'idle';
    return;
  }

  const w = getWeapon(shooter);
  if (w.dps <= 0 || w.range <= 0) return;

  // tick cooldown
  if (shooter.fireCooldown == null) shooter.fireCooldown = 0;
  if (shooter.fireCooldown > 0) shooter.fireCooldown -= dt;

  // Acquire / validate target through targeting module.
  let target = shooter.aimTarget ? world.byId[shooter.aimTarget] : null;
  const inRange = target && isAlive(target) &&
    dist(shooter.x, shooter.y, target.x, target.y) <= w.range;

  if (!inRange) {
    target = selectTarget(world, shooter, w);
    if (target) {
      shooter.aimTarget = target.id;
      // start telegraph wind-up (head/sensor swing then lock-on)
      shooter.windUpLeft = w.windUp;
      shooter.aimState = 'aiming';
    } else {
      shooter.aimTarget = null;
      shooter.windUpLeft = 0;
      shooter.aimState = 'idle';
      return;
    }
  }

  if (!target || !isAlive(target)) {
    shooter.aimTarget = null;
    shooter.aimState = 'idle';
    return;
  }

  // aim angle recorded for renderer (weapon rotation) — read-only presentation aid.
  shooter.aimAngle = Math.atan2(target.y - shooter.y, target.x - shooter.x);

  // wind-up (lock-on) must complete before the first shot launches.
  if (shooter.windUpLeft == null) shooter.windUpLeft = 0;
  if (shooter.windUpLeft > 0) {
    shooter.windUpLeft -= dt;
    shooter.aimState = 'aiming';
    return;
  }

  // ready to fire?
  if (shooter.fireCooldown <= 0) {
    shooter.aimState = 'firing';
    spawnProjectile(world, shooter, target, w);
    shooter.fireCooldown = w.fireRate > 0 ? (1 / w.fireRate) : 1;
  } else {
    shooter.aimState = 'aiming';
  }
}

// Run all shooters (towers + armed attacker units that hit structures/base via contact,
// but ranged attackers use projectiles too).
export function stepCombat(world, dt) {
  // Defensive structures fire at attackers.
  if (world.structures) {
    for (let i = 0; i < world.structures.length; i++) {
      const s = world.structures[i];
      if (!s.isWeapon) continue;
      s.side = 'defender';
      stepShooter(world, s, dt);
    }
  }

  // Attacker units fire/attack the base or structures.
  if (world.attackers) {
    for (let i = 0; i < world.attackers.length; i++) {
      const a = world.attackers[i];
      if (!isAlive(a)) continue;
      a.side = 'attacker';
      stepAttackerCombat(world, a, dt);
    }
  }

  stepProjectiles(world, dt);
  stepStatusEffects(world, dt);
}

// Attacker combat: attackers path to base and attack it (or structures if flagged).
// Ranged attackers use projectiles; melee/contact attackers deal contact damage when
// adjacent to their target.
function stepAttackerCombat(world, a, dt) {
  if (isDisabled(world, a)) return;
  const w = getWeapon(a);
  if (w.dps <= 0) return;

  // determine what this attacker targets: 'Structures' or 'Base'
  const targetsStructures = a.targets === 'Structures';

  let target = a.aimTarget ? world.byId[a.aimTarget] : null;
  const inRange = target && isAlive(target) &&
    dist(a.x, a.y, target.x, target.y) <= Math.max(w.range, a.reach || 0.75);

  if (!inRange) {
    target = selectTarget(world, a, w);
    if (target) {
      a.aimTarget = target.id;
      a.windUpLeft = w.windUp;
      a.aimState = 'aiming';
    } else {
      a.aimTarget = null;
      a.aimState = 'idle';
      return;
    }
  }
  if (!target || !isAlive(target)) { a.aimTarget = null; return; }

  a.aimAngle = Math.atan2(target.y - a.y, target.x - a.x);

  const reach = Math.max(w.range, a.reach || 0.75);
  const d = dist(a.x, a.y, target.x, target.y);
  if (d > reach) {
    // still moving toward target; movement handled by movement.js
    a.aimState = 'idle';
    return;
  }

  if (a.fireCooldown == null) a.fireCooldown = 0;
  if (a.fireCooldown > 0) a.fireCooldown -= dt;

  if (a.windUpLeft == null) a.windUpLeft = 0;
  if (a.windUpLeft > 0) { a.windUpLeft -= dt; a.aimState = 'aiming'; return; }

  if (a.fireCooldown <= 0) {
    a.aimState = 'firing';
    if (w.range >= 1.5 || w.projectileClass !== 'bolt' || w.aoe > 0) {
      // ranged / siege -> projectile
      spawnProjectile(world, a, target, w);
    } else {
      // contact -> immediate damage
      const dmg = damagePerShot(w);
      dealDamage(world, a, target, dmg, w.damageType, 'melee');
      applyStatus(world, target, w.status, w.damageType, dmg);
    }
    a.fireCooldown = w.fireRate > 0 ? (1 / w.fireRate) : 1;
  } else {
    a.aimState = 'aiming';
  }
}

// ---------------------------------------------------------------------------
// Public headless API surface
// ---------------------------------------------------------------------------

export default {
  stepCombat,
  stepShooter,
  stepProjectiles,
  stepStatusEffects,
  dealDamage,
  isDisabled,
  speedMultiplier,
};