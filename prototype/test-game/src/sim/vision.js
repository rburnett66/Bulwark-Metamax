// src/sim/vision.js
// Radar-sees-air / air-sees-ground vision stub logic.
//
// This module implements the "minimal / explicitly stubbed" vision rules from
// the MODEL:
//   - Radar (ground defenses) SEES AIR but NOT ground.
//   - Air units SEE GROUND at range.
//   - Vision range is data-driven from unit/structure vision stats.
//
// It is PURE and DETERMINISTIC: it reads the strict world state and returns a
// visibility summary. It never mutates positions, hp, waves, economy, etc.
// Callable headless (same code path as the balance sim); no rendering here.
//
// Distance uses squared-distance comparisons to avoid sqrt nondeterminism.

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

// Normalize a domain string to one of: 'air' | 'ground' | 'water'
function normalizeDomain(domain) {
  if (!domain) return 'ground';
  const d = String(domain).toLowerCase();
  if (d === 'flyer' || d === 'air' || d === 'flying') return 'air';
  if (d === 'floater' || d === 'swimmer' || d === 'water') return 'water';
  return 'ground';
}

function isAir(entity) {
  return normalizeDomain(entity && entity.domain) === 'air';
}

// Ground for vision purposes lumps walkers + floaters (surface things) together
// as "not air". The stubbed rule only distinguishes air vs. non-air.
function isGroundLike(entity) {
  return !isAir(entity);
}

// ---------------------------------------------------------------------------
// Geometry helpers (deterministic, sqrt-free comparisons)
// ---------------------------------------------------------------------------

function pos(e) {
  // Entities may store position as {x,y} directly or under .position
  if (e == null) return { x: 0, y: 0 };
  if (typeof e.x === 'number' && typeof e.y === 'number') return { x: e.x, y: e.y };
  if (e.position && typeof e.position.x === 'number') {
    return { x: e.position.x, y: e.position.y };
  }
  return { x: 0, y: 0 };
}

function dist2(a, b) {
  const pa = pos(a);
  const pb = pos(b);
  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------------------
// Vision-range resolution
// ---------------------------------------------------------------------------

// Return the observer's vision range in world units.
// Falls back to a sane default; scales tile-based vision to pixels if a tile
// size is supplied via world.geometry.tileSize.
function visionRange(observer, world) {
  const tileSize =
    (world && world.geometry && world.geometry.tileSize) ||
    (world && world.tileSize) ||
    1;
  let v = 0;
  if (observer && typeof observer.vision === 'number') {
    v = observer.vision;
  } else if (observer && observer.stats && typeof observer.stats.vision === 'number') {
    v = observer.stats.vision;
  } else {
    v = 4; // Vision_base from Assumptions
  }
  return v * tileSize;
}

// ---------------------------------------------------------------------------
// Detection predicates (the actual stub RULES)
// ---------------------------------------------------------------------------

// Can a radar / ground defense DETECT this target?
//   Rule: radar sees AIR, not ground.
function radarDetects(observer, target) {
  if (!observer || !target) return false;
  // An entity is a "radar" if it flags radarDetect / canTargetAir, else assume
  // ordinary ground defense that still uses radar for air spotting.
  return isAir(target);
}

// Can an AIR observer detect this target?
//   Rule: air units SEE GROUND at range (and also see other air).
function airSees(observer, target) {
  if (!observer || !target) return false;
  // Air observers with the "seesGround" flag can spot ground; all air sees air.
  const seesGround = observer.seesGround !== false; // default true for air
  if (isAir(target)) return true;
  return seesGround && isGroundLike(target);
}

// Generic can-observe check combining rules + range.
// observer: an entity (structure or unit) with position + vision.
// target: an entity with position + domain.
function canObserve(observer, target, world) {
  if (!observer || !target) return false;
  if (observer === target) return false;

  const observerIsAir = isAir(observer);

  // Domain-eligibility per stub rules.
  let eligible;
  if (observerIsAir) {
    eligible = airSees(observer, target);
  } else {
    // Ground observers use radar: see air only.
    eligible = radarDetects(observer, target);
  }
  if (!eligible) return false;

  // Range check (squared).
  const r = visionRange(observer, world);
  if (r <= 0) return false;
  return dist2(observer, target) <= r * r;
}

// ---------------------------------------------------------------------------
// Aggregate visibility computation over the whole world
// ---------------------------------------------------------------------------

// Collect the list of potential observers from the world.
// Structures (towers) act as radar observers; friendly air units (if any)
// act as air observers. Defensive side observes attackers.
function collectObservers(world) {
  const observers = [];
  if (!world) return observers;

  const structures = world.structures || (world.entities && world.entities.structures) || [];
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (!s) continue;
    // Only complete / operational structures observe.
    const state = s.lifecycle || s.state;
    if (state === 'Destroyed' || state === 'Selling' || state === 'Placing') continue;
    observers.push(s);
  }

  // Deployed friendly units that are air-capable can also observe (future-proof).
  const units = world.units || (world.entities && world.entities.units) || [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u) continue;
    if (u.friendly === true && isAir(u)) observers.push(u);
  }

  return observers;
}

// Collect targets to test visibility against (the attackers).
function collectTargets(world) {
  if (!world) return [];
  const attackers = world.attackers || (world.entities && world.entities.attackers) || [];
  if (attackers.length) return attackers.slice();
  // Fallback: any hostile units.
  const units = world.units || (world.entities && world.entities.units) || [];
  return units.filter((u) => u && u.friendly !== true);
}

// Compute visibility for the whole world.
// Returns:
//   {
//     visibleIds: Set<id>,          // target ids seen by at least one observer
//     byObserver: Map<obsId, id[]>, // per-observer detected target ids
//     detected(target): bool        // convenience predicate
//   }
// Deterministic: iteration order follows array order; no randomness.
function computeVisibility(world) {
  const observers = collectObservers(world);
  const targets = collectTargets(world);

  const visibleIds = new Set();
  const byObserver = new Map();

  for (let i = 0; i < observers.length; i++) {
    const obs = observers[i];
    const seen = [];
    for (let j = 0; j < targets.length; j++) {
      const tgt = targets[j];
      if (canObserve(obs, tgt, world)) {
        seen.push(tgt.id != null ? tgt.id : j);
        if (tgt.id != null) visibleIds.add(tgt.id);
      }
    }
    const key = obs.id != null ? obs.id : `obs_${i}`;
    byObserver.set(key, seen);
  }

  return {
    visibleIds,
    byObserver,
    detected(target) {
      if (!target) return false;
      if (target.id != null) return visibleIds.has(target.id);
      // Fall back to a live scan.
      for (let i = 0; i < observers.length; i++) {
        if (canObserve(observers[i], target, world)) return true;
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// System-style step hook (optional; safe to call each tick)
// ---------------------------------------------------------------------------

// Writes a `.seen` boolean onto attacker entities as a *presentation* aid,
// derived purely from state. This does not affect combat/pathing determinism
// (targeting.js does its own domain checks); it is a stub tag for renderers /
// fog-of-war. Because it's a pure function of state, replays remain stable.
function stepVision(world) {
  const vis = computeVisibility(world);
  const targets = collectTargets(world);
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t) continue;
    t.seen = vis.detected(t);
  }
  // Expose the latest snapshot for renderers / debug (read-only intent).
  if (world) world.vision = vis;
  return vis;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  normalizeDomain,
  isAir,
  isGroundLike,
  visionRange,
  radarDetects,
  airSees,
  canObserve,
  computeVisibility,
  collectObservers,
  collectTargets,
  stepVision,
};

export default {
  normalizeDomain,
  isAir,
  isGroundLike,
  visionRange,
  radarDetects,
  airSees,
  canObserve,
  computeVisibility,
  collectObservers,
  collectTargets,
  stepVision,
};