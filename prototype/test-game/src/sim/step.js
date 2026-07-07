const FIXED_DT = 1 / 60;

export function createStepper(sim) {
  let accumulator = 0;

  function fixedStep() {
    const state = sim.state;
    if (state.status !== 'running') return;

    const dt = FIXED_DT;
    state.time += dt;
    state.tick++;

    // 1) Economy: money accrual over time
    sim.economy.accrue(state, dt);

    // 2) Waves: spawn attackers, advance wave logic
    sim.waves.update(state, dt);

    // 3) Spawn: march deployed troops from base to drop destinations
    if (sim.spawn && sim.spawn.update) sim.spawn.update(state, dt);

    // 4) Lifecycle: Placing→Building→Complete→Damaged→Destroyed, Upgrading, Selling, repairs
    sim.lifecycle.update(state, dt);

    // 5) Pathing: recompute walker paths around walls/moats when terrain dirty
    sim.pathing.update(state, dt);

    // 6) Movement: advance all mobile entities along their paths/lanes
    stepMovement(sim, state, dt);

    // 7) Vision: radar/air-sees-ground detection
    if (sim.vision && sim.vision.update) sim.vision.update(state, dt);

    // 8) Combat: targeting by domain, damage-type effectiveness, status, DPS
    sim.combat.update(state, dt);

    // 9) Attacker damage to base + structures
    stepAttackerDamage(sim, state, dt);

    // 10) Cleanup dead entities, grant kill income
    stepCleanup(sim, state);

    // 11) Win/lose evaluation
    sim.waves.checkEndConditions(state);
  }

  function stepMovement(sim, state, dt) {
    for (const e of state.entities) {
      if (e.dead) continue;
      if (e.type !== 'walker' && e.type !== 'floater' && e.type !== 'flyer' && e.type !== 'troop') continue;
      if (e.staggerTimer && e.staggerTimer > 0) {
        e.staggerTimer -= dt;
        continue;
      }
      let speed = e.speed || 0;
      if (e.slowTimer && e.slowTimer > 0) {
        e.slowTimer -= dt;
        speed *= 0.5;
      }
      if (speed <= 0) continue;
      advanceAlongPath(e, speed * dt);
    }
  }

  function advanceAlongPath(e, dist) {
    if (!e.path || e.pathIndex == null) return;
    while (dist > 0 && e.pathIndex < e.path.length) {
      const target = e.path[e.pathIndex];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= dist) {
        e.x = target.x;
        e.y = target.y;
        dist -= d;
        e.pathIndex++;
      } else {
        e.x += (dx / d) * dist;
        e.y += (dy / d) * dist;
        dist = 0;
      }
    }
    if (e.pathIndex >= e.path.length) {
      e.atDestination = true;
    }
  }

  function stepAttackerDamage(sim, state, dt) {
    const base = state.base;
    for (const e of state.entities) {
      if (e.dead || !e.isAttacker) continue;
      if (!e.atDestination && !isInRangeOfBase(e, base)) continue;

      if (e.targetsStructures) {
        // artillery-type: attack nearest structure in range
        const struct = findNearestStructureInRange(state, e);
        if (struct) {
          applyDamage(sim, struct, e.dps * dt, e.damageType, e);
        } else if (isInRangeOfBase(e, base)) {
          base.hp -= e.dps * dt;
        }
      } else {
        if (isInRangeOfBase(e, base)) {
          base.hp -= e.dps * dt;
          e.attacking = true;
        }
      }
    }
    if (base.hp < 0) base.hp = 0;
  }

  function isInRangeOfBase(e, base) {
    const r = (e.range || 1) * (sim.config?.tileSize || 1);
    const d = Math.hypot(base.x - e.x, base.y - e.y);
    return d <= r + (base.radius || 0);
  }

  function findNearestStructureInRange(state, e) {
    let best = null;
    let bestD = Infinity;
    const r = (e.range || 1) * (sim.config?.tileSize || 1);
    for (const s of state.structures) {
      if (s.dead || s.state === 'Destroyed') continue;
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d <= r + (s.radius || 0) && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function applyDamage(sim, target, amount, damageType, source) {
    if (sim.combat && sim.combat.applyTypedDamage) {
      sim.combat.applyTypedDamage(target, amount, damageType, source);
    } else {
      target.hp -= amount;
    }
    if (target.hp <= 0) {
      target.hp = 0;
    }
  }

  function stepCleanup(sim, state) {
    for (const e of state.entities) {
      if (e.dead) continue;
      if (e.hp <= 0) {
        e.dead = true;
        e.deathTick = state.tick;
        if (e.isAttacker && e.reward) {
          sim.economy.grantKill(state, e.reward, e);
          state.stats.kills++;
        }
        if (e.isAttacker) {
          state.stats.attackersRemaining--;
        }
      }
    }
    // structures reaching 0 hp transition via lifecycle; mark destroyed
    for (const s of state.structures) {
      if (s.dead) continue;
      if (s.hp <= 0 && s.state !== 'Destroyed') {
        sim.lifecycle.destroy(state, s);
      }
    }
    // Purge fully-expired dead entities after a grace period
    state.entities = state.entities.filter(
      (e) => !(e.dead && state.tick - e.deathTick > 30)
    );
  }

  function step(dt) {
    accumulator += dt;
    // clamp to avoid spiral of death
    if (accumulator > 0.5) accumulator = 0.5;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 240) {
      // Apply queued commands deterministically at start of each fixed tick
      sim.applyPendingCommands();
      fixedStep();
      accumulator -= FIXED_DT;
      steps++;
    }
  }

  return { step, fixedStep, FIXED_DT };
}

export { FIXED_DT };