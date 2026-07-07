const FIXED_DT = 1 / 60;

/**
 * Advance the deterministic simulation by one fixed timestep.
 * All systems are orchestrated here in a strict, deterministic order.
 *
 * @param {object} world      Central strict state container (from world.js)
 * @param {object} systems    Bag of system modules {movement, pathfinding, targeting, combat, economy, repair, lifecycle, waves, vision}
 * @param {number} dt         Timestep in seconds (defaults to FIXED_DT)
 * @param {object} [log]      Optional battle log for recording events
 */
export function step(world, systems, dt = FIXED_DT, log = null) {
  if (world.status !== 'playing') {
    // still advance tick counter so replays stay aligned, but do no work
    world.tick++;
    world.time += dt;
    return world;
  }

  const {
    lifecycle,
    pathfinding,
    movement,
    targeting,
    combat,
    economy,
    repair,
    waves,
    vision,
  } = systems;

  // 1) Structure lifecycle transitions (Placing->Building->Complete, Upgrading, Selling, Destroyed cleanup)
  if (lifecycle && lifecycle.update) {
    lifecycle.update(world, dt, log);
  }

  // 2) Terrain-dependent path recompute (walls/moats changed => rebuild walker paths)
  if (pathfinding && pathfinding.update) {
    pathfinding.update(world, dt, log);
  }

  // 3) Wave spawning / scheduling (may create new attacker entities)
  if (waves && waves.update) {
    waves.update(world, dt, log);
  }

  // 4) Vision / detection stub (radar sees air, air sees ground)
  if (vision && vision.update) {
    vision.update(world, dt, log);
  }

  // 5) Movement: domain pathing for walkers (ground), floaters (water), flyers (ignore terrain)
  if (movement && movement.update) {
    movement.update(world, dt, log);
  }

  // 6) Targeting: domain-aware weapon target selection for towers & attackers
  if (targeting && targeting.update) {
    targeting.update(world, dt, log);
  }

  // 7) Combat: firing, projectile travel, damage-type resolution, kills
  if (combat && combat.update) {
    combat.update(world, dt, log);
  }

  // 8) Repair: troop-based travel + timed free repairs
  if (repair && repair.update) {
    repair.update(world, dt, log);
  }

  // 9) Economy: live money accrual, kill income processing, spend/refund reconciliation
  if (economy && economy.update) {
    economy.update(world, dt, log);
  }

  // 10) Win/lose resolution (survive N waves = win; base HP 0 = lose)
  resolveEndConditions(world, log);

  // Advance deterministic clock LAST so all systems saw the same tick.
  world.tick++;
  world.time += dt;

  return world;
}

/**
 * Evaluate win/lose transitions from strict state.
 */
function resolveEndConditions(world, log) {
  const base = world.base;
  if (base && base.hp <= 0 && world.status === 'playing') {
    base.hp = 0;
    world.status = 'lost';
    if (log && log.event) {
      log.event(world.tick, { type: 'gameOver', result: 'lose', reason: 'baseDestroyed' });
    }
    return;
  }

  // Win when all scheduled waves are complete and no attackers remain alive.
  if (world.status === 'playing' && world.waves) {
    const w = world.waves;
    const allWavesDone =
      w.spawnedAll === true &&
      w.currentIndex >= (w.total != null ? w.total : (w.schedule ? w.schedule.length : 0));
    if (allWavesDone) {
      const attackersAlive = world.entities
        ? Object.values(world.entities).some(
            (e) => e && e.faction === 'attacker' && e.alive !== false && e.hp > 0
          )
        : false;
      if (!attackersAlive) {
        world.status = 'won';
        if (log && log.event) {
          log.event(world.tick, { type: 'gameOver', result: 'win', reason: 'wavesSurvived' });
        }
      }
    }
  }
}

export { FIXED_DT };
export default step;