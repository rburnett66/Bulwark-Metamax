<summary>
This file implements troop-based repair mechanics. Repairs are free (no gold) but consume/require troops that must physically travel from the base to the damaged structure. Once a troop arrives, repair proceeds over time restoring HP. It also supports timed free repairs (auto-repair over time as a fallback rule).

Key integration points (inferred from the plan/MODEL):
- Reads/writes strict world state: `world.structures`, `world.repairJobs`, `world.base`, `world.troops` (repair troop pool).
- Called by `step.js` each tick with `(world, dt, ctx)`.
- Commanded via `commands.js` → a `repair` command starts a job.
- Lifecycle interaction: sets structure to `Damaged`→heals→`Complete`; won't repair `Destroyed` unless full rebuild disabled.
- Deterministic: no Math.random; uses geometry distances only.
</summary>

```javascript
// src/sim/repair.js
// Troop-based repair travel + timed free repairs.
// Deterministic, headless-safe. READS/WRITES strict sim state only.
//
// Model rules implemented:
//  - Repairs are FREE (no gold) but consume a troop from the base repair pool.
//  - A repair troop must TRAVEL from the base to the target structure before
//    repair work begins (travel is time based on distance / troop speed).
//  - Repair then restores HP over time (heal rate). Structure transitions
//    Damaged -> (Building/Repairing) -> Complete when HP full.
//  - Timed free repairs: an optional passive slow auto-repair for Complete-but-
//    slightly-damaged structures with no active troop, as a fallback rule.
//  - Cancelling / structure destruction returns the troop to the pool.
//
// A "repair job" record lives in world.repairJobs (array). Each job:
//   {
//     id, structureId,
//     phase: 'travel' | 'working',
//     troopX, troopY,        // current troop position (for renderer march line)
//     targetX, targetY,      // structure anchor
//     speed,                 // tiles/sec
//     healPerSec,            // hp/sec while working
//     done: false
//   }
//
// Tunables are read from config tables when available, with safe fallbacks so
// the sim always runs.

const DEFAULTS = {
  // Repair troop travel speed (tiles/sec). Uses Trucks-ish speed as a default.
  TROOP_SPEED: 2.5,
  // Fraction of a structure's max HP repaired per second while a troop works.
  REPAIR_FRACTION_PER_SEC: 0.20, // full repair of a full-HP structure ~5s
  // Minimum heal floor so tiny structures still finish quickly.
  MIN_HEAL_PER_SEC: 40,
  // Passive timed free repair rate (fraction of maxHP per sec) for Complete
  // structures that are below full HP and have NO active troop job.
  PASSIVE_FRACTION_PER_SEC: 0.02,
  // Only passively repair after this many seconds of not taking damage.
  PASSIVE_DELAY: 4.0,
  // Size of the base repair-troop pool (troops available for simultaneous jobs).
  TROOP_POOL: 4,
  // A structure is considered "Damaged" state below this HP fraction.
  DAMAGED_THRESHOLD: 0.999,
};

function tunables(world) {
  const t = (world && world.config && world.config.repair) || {};
  return {
    troopSpeed: num(t.troopSpeed, DEFAULTS.TROOP_SPEED),
    repairFrac: num(t.repairFractionPerSec, DEFAULTS.REPAIR_FRACTION_PER_SEC),
    minHeal: num(t.minHealPerSec, DEFAULTS.MIN_HEAL_PER_SEC),
    passiveFrac: num(t.passiveFractionPerSec, DEFAULTS.PASSIVE_FRACTION_PER_SEC),
    passiveDelay: num(t.passiveDelay, DEFAULTS.PASSIVE_DELAY),
    pool: num(t.troopPool, DEFAULTS.TROOP_POOL),
  };
}

function num(v, d) {
  return typeof v === 'number' && isFinite(v) ? v : d;
}

// ---------------------------------------------------------------------------
// State bootstrap
// ---------------------------------------------------------------------------

export function ensureRepairState(world) {
  if (!world.repairJobs) world.repairJobs = [];
  const cfg = tunables(world);
  if (typeof world.repairTroopsFree !== 'number') {
    world.repairTroopsFree = cfg.pool;
    world.repairTroopsTotal = cfg.pool;
  }
  if (typeof world._repairJobSeq !== 'number') world._repairJobSeq = 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStructure(world, id) {
  const list = world.structures || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function baseAnchor(world) {
  const b = world.base;
  if (b && typeof b.x === 'number') return { x: b.x, y: b.y };
  return { x: 0, y: 0 };
}

function structAnchor(s) {
  return { x: s.x, y: s.y };
}

function jobForStructure(world, structureId) {
  const jobs = world.repairJobs || [];
  for (let i = 0; i < jobs.length; i++) {
    if (jobs[i].structureId === structureId && !jobs[i].done) return jobs[i];
  }
  return null;
}

function structMaxHp(s) {
  return num(s.maxHp, num(s.hp, 1));
}

function isRepairable(s) {
  if (!s) return false;
  if (s.state === 'Destroyed') return false;
  if (s.state === 'Selling') return false;
  if (s.state === 'Placing') return false;
  // Must be an established structure (Building can still be "in progress" —
  // repair only applies to Complete/Damaged/Aiming/Firing states).
  return s.hp < structMaxHp(s) - 1e-6;
}

// ---------------------------------------------------------------------------
// Public: start a repair job (called from commands.js)
// Returns true if a job was started (or already active), false if blocked.
// ---------------------------------------------------------------------------

export function startRepair(world, structureId, events) {
  ensureRepairState(world);
  const s = getStructure(world, structureId);
  if (!s) return false;
  if (!isRepairable(s)) return false;

  // Already repairing?
  const existing = jobForStructure(world, structureId);
  if (existing) return true;

  // Need a free troop from the pool.
  if (world.repairTroopsFree <= 0) {
    if (events) events.push({ t: 'repairBlocked', structureId, reason: 'noTroops' });
    return false;
  }

  const cfg = tunables(world);
  const base = baseAnchor(world);
  const anchor = structAnchor(s);
  const maxHp = structMaxHp(s);
  const healPerSec = Math.max(cfg.minHeal, maxHp * cfg.repairFrac);

  world.repairTroopsFree -= 1;

  const job = {
    id: world._repairJobSeq++,
    structureId,
    phase: 'travel',
    troopX: base.x,
    troopY: base.y,
    targetX: anchor.x,
    targetY: anchor.y,
    speed: cfg.troopSpeed,
    healPerSec,
    done: false,
  };
  world.repairJobs.push(job);

  // Flag structure as under repair (lifecycle-visible).
  s.repairing = true;
  if (s.state === 'Complete' || s.state === 'Damaged' ||
      s.state === 'Aiming' || s.state === 'Firing') {
    // keep functional state, mark a sub-flag; lifecycle.js can read s.repairing
  }

  if (events) events.push({ t: 'repairStart', structureId, jobId: job.id });
  return true;
}

// ---------------------------------------------------------------------------
// Public: cancel a repair (returns troop to pool)
// ---------------------------------------------------------------------------

export function cancelRepair(world, structureId, events) {
  ensureRepairState(world);
  const job = jobForStructure(world, structureId);
  if (!job) return false;
  finishJob(world, job, false, events);
  return true;
}

function finishJob(world, job, completed, events) {
  if (job.done) return;
  job.done = true;
  world.repairTroopsFree = Math.min(
    world.repairTroopsTotal,
    world.repairTroopsFree + 1
  );
  const s = getStructure(world, job.structureId);
  if (s) s.repairing = false;
  if (events) {
    events.push({
      t: completed ? 'repairComplete' : 'repairCancel',
      structureId: job.structureId,
      jobId: job.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Public: per-tick update (called from step.js)
// ---------------------------------------------------------------------------

export function stepRepair(world, dt, events) {
  ensureRepairState(world);
  if (dt <= 0) return;

  const cfg = tunables(world);
  const jobs = world.repairJobs;

  // Advance active jobs.
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    if (job.done) continue;

    const s = getStructure(world, job.structureId);

    // Structure gone / destroyed / no longer repairable -> release troop.
    if (!s || s.state === 'Destroyed' || s.state === 'Selling') {
      finishJob(world, job, false, events);
      continue;
    }

    // Keep target synced (structure won't move, but safe).
    job.targetX = s.x;
    job.targetY = s.y;

    if (job.phase === 'travel') {
      const dx = job.targetX - job.troopX;
      const dy = job.targetY - job.troopY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const stepDist = job.speed * dt;
      if (dist <= stepDist || dist < 1e-4) {
        job.troopX = job.targetX;
        job.troopY = job.targetY;
        job.phase = 'working';
        if (events) {
          events.push({ t: 'repairArrive', structureId: job.structureId, jobId: job.id });
        }
      } else {
        const inv = stepDist / dist;
        job.troopX += dx * inv;
        job.troopY += dy * inv;
      }
    }

    if (job.phase === 'working') {
      const maxHp = structMaxHp(s);
      if (s.hp >= maxHp - 1e-6) {
        s.hp = maxHp;
        markRepaired(s);
        finishJob(world, job, true, events);
        continue;
      }
      s.hp = Math.min(maxHp, s.hp + job.healPerSec * dt);
      s.repairing = true;
      if (s.hp >= maxHp - 1e-6) {
        s.hp = maxHp;
        markRepaired(s);
        finishJob(world, job, true, events);
      }
    }
  }

  // Compact finished jobs (deterministic in-place filter).
  if (jobs.length) {
    let w = 0;
    for (let r = 0; r < jobs.length; r++) {
      if (!jobs[r].done) jobs[w++] = jobs[r];
    }
    jobs.length = w;
  }

  // Passive timed free repair for structures with no active job.
  passiveRepair(world, dt, cfg, events);
}

// ---------------------------------------------------------------------------
// Passive / timed free repair
// ---------------------------------------------------------------------------

function passiveRepair(world, dt, cfg, events) {
  const list = world.structures || [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s) continue;
    if (s.state === 'Destroyed' || s.state === 'Selling' || s.state === 'Placing') continue;
    if (s.state === 'Building') continue;

    const maxHp = structMaxHp(s);
    if (s.hp >= maxHp - 1e-6) {
      // fully healed -> normalize lifecycle flag & timer
      s._sinceDamage = 0;
      continue;
    }

    // Skip if there is an active troop job (that path already heals it).
    if (jobForStructure(world, s.id)) continue;

    // Track time since last damage. combat.js should set s._sinceDamage=0 on hit;
    // if it doesn't, we accumulate here regardless (delay just becomes an approx).
    if (typeof s._sinceDamage !== 'number') s._sinceDamage = 0;
    s._sinceDamage += dt;

    if (s._sinceDamage < cfg.passiveDelay) continue;

    const heal = maxHp * cfg.passiveFrac * dt;
    if (heal > 0) {
      const prev = s.hp;
      s.hp = Math.min(maxHp, s.hp + heal);
      if (s.hp >= maxHp - 1e-6) {
        s.hp = maxHp;
        markRepaired(s);
        if (events && prev < maxHp) {
          events.push({ t: 'repairComplete', structureId: s.id, passive: true });
        }
      }
    }
  }
}

function markRepaired(s) {
  s.repairing = false;
  // Restore functional lifecycle state if it had degraded to "Damaged".
  if (s.state === 'Damaged') s.state = 'Complete';
}

// ---------------------------------------------------------------------------
// Query helpers for HUD / renderer
// ---------------------------------------------------------------------------

export function isRepairing(world, structureId) {
  if (!world.repairJobs) return false;
  return !!jobForStructure(world, structureId);
}

export function getRepairJob(world, structureId) {
  if (!world.repairJobs) return null;
  return jobForStructure(world, structureId);
}

export function repairTroopsAvailable(world) {
  return typeof world.repairTroopsFree === 'number' ? world.repairTroopsFree : 0;
}

// ---------------------------------------------------------------------------
// Notify damage (call from combat.js when a structure is hit) — resets the
// passive-repair delay timer. Safe no-op if unused.
// ---------------------------------------------------------------------------

export function notifyStructureDamaged(structure) {
  if (structure) structure._sinceDamage = 0;
}

export default {
  ensureRepairState,
  startRepair,
  cancelRepair,
  stepRepair,
  isRepairing,
  getRepairJob,
  repairTroopsAvailable,
  notifyStructureDamaged,
};