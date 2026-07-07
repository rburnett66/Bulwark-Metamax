// src/sim/targeting.js
// Domain-aware weapon targeting: anti-air vs anti-ground selection.
// Pure/deterministic — reads state, returns target ids. Never mutates world.
//
// Weapons declare which domains they can hit via `canTarget`:
//   - 'Ground' : can hit Walker + Floater (surface domains), NOT Air
//   - 'Air'    : can hit Flyer only (anti-air)
//   - 'Both'   : can hit any domain
//
// Target selection is deterministic: among all valid enemies inside range,
// pick by a stable priority (closest-to-base progress, then lowest hp, then
// lowest id) so replays are identical regardless of iteration order.

/**
 * Domain of an entity, normalized to one of: 'Ground' | 'Water' | 'Air'.
 */
export function domainOf(entity) {
  if (!entity) return 'Ground';
  const d = entity.domain;
  if (d === 'Flyer' || d === 'Air') return 'Air';
  if (d === 'Floater' || d === 'Swimmer' || d === 'Water') return 'Water';
  // Walker / Ground / anything else defaults to Ground.
  return 'Ground';
}

/**
 * Can a weapon with the given `canTarget` capability hit `entity`?
 * canTarget: 'Ground' | 'Air' | 'Both'
 */
export function canWeaponHit(canTarget, entity) {
  const dom = domainOf(entity);
  switch (canTarget) {
    case 'Both':
      return true;
    case 'Air':
      // Anti-air: hits flyers only.
      return dom === 'Air';
    case 'Ground':
    default:
      // Anti-ground: hits surface domains (walker + floater), never air.
      return dom !== 'Air';
  }
}

/**
 * Squared distance between two positions {x,y}.
 */
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Return the effective range (in world units) for a tower.
 * Reads tower.range (already derived stat in tiles) times tileSize if present.
 */
export function towerRange(tower, tileSize) {
  const r = tower.range != null ? tower.range : 0;
  const ts = tileSize != null ? tileSize : 1;
  return r * ts;
}

/**
 * Is an attacker alive & valid as a firing target?
 */
function isLiveAttacker(a) {
  return a && a.alive !== false && (a.hp == null || a.hp > 0);
}

/**
 * Determine progress metric used for target priority.
 * Higher = closer to base (more urgent). Falls back to negative distance-to-base.
 */
function threatProgress(attacker, basePos) {
  if (attacker.progress != null) return attacker.progress;
  if (basePos) {
    // Closer to base = higher urgency. Use negative distance.
    const d = Math.sqrt(dist2(attacker.pos.x, attacker.pos.y, basePos.x, basePos.y));
    return -d;
  }
  return 0;
}

/**
 * Compare two candidate attackers for target priority.
 * Returns negative if `a` is a better target than `b`.
 * Priority order (deterministic):
 *   1) higher threat progress (closer to base)
 *   2) lower current hp (finish wounded first)
 *   3) lower stable id
 */
function betterTarget(a, b, basePos) {
  const pa = threatProgress(a, basePos);
  const pb = threatProgress(b, basePos);
  if (pa !== pb) return pb - pa; // higher progress first
  const ha = a.hp != null ? a.hp : 0;
  const hb = b.hp != null ? b.hp : 0;
  if (ha !== hb) return ha - hb; // lower hp first
  // Stable id tiebreak.
  const ia = String(a.id);
  const ib = String(b.id);
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}

/**
 * Select the best target id for a single tower.
 *
 * @param {object} tower       tower entity: {id, pos:{x,y}, range, canTarget, target}
 * @param {Array}  attackers   array of attacker entities
 * @param {object} opts        { tileSize, basePos, respectManual }
 * @returns {string|number|null} target id, or null if none in range
 */
export function selectTargetForTower(tower, attackers, opts = {}) {
  if (!tower || !tower.pos) return null;

  const tileSize = opts.tileSize != null ? opts.tileSize : 1;
  const basePos = opts.basePos || null;
  const canTarget = tower.canTarget || 'Ground';
  const range = towerRange(tower, tileSize);
  const range2 = range * range;

  // Manual target override: if the tower has a manually-assigned target that is
  // still valid, in-range, and hittable, keep it (sticky targeting).
  if (opts.respectManual && tower.manualTarget != null) {
    const forced = attackers.find(a => a.id === tower.manualTarget);
    if (
      isLiveAttacker(forced) &&
      canWeaponHit(canTarget, forced) &&
      dist2(tower.pos.x, tower.pos.y, forced.pos.x, forced.pos.y) <= range2
    ) {
      return forced.id;
    }
  }

  // Sticky current target: keep firing on the current target while it remains
  // valid and in range, unless a manual override forced re-selection.
  if (tower.target != null) {
    const cur = attackers.find(a => a.id === tower.target);
    if (
      isLiveAttacker(cur) &&
      canWeaponHit(canTarget, cur) &&
      dist2(tower.pos.x, tower.pos.y, cur.pos.x, cur.pos.y) <= range2
    ) {
      return cur.id;
    }
  }

  // Full re-scan for best target.
  let best = null;
  for (let i = 0; i < attackers.length; i++) {
    const a = attackers[i];
    if (!isLiveAttacker(a) || !a.pos) continue;
    if (!canWeaponHit(canTarget, a)) continue;
    if (dist2(tower.pos.x, tower.pos.y, a.pos.x, a.pos.y) > range2) continue;
    if (best === null || betterTarget(a, best, basePos) < 0) {
      best = a;
    }
  }

  return best ? best.id : null;
}

/**
 * Compute and return an ordered list of {towerId, targetId} assignments.
 * Deterministic: iterates towers in stable id order.
 *
 * Does NOT mutate world; the caller (combat/step) applies results.
 *
 * @param {object} world  strict state; expects world.towers or world.structures
 * @returns {Array<{towerId, targetId}>}
 */
export function computeTargeting(world) {
  const assignments = [];
  if (!world) return assignments;

  const tileSize = world.tileSize != null ? world.tileSize : 1;
  const basePos = world.base ? world.base.pos : null;

  // Gather live attackers (walkers/floaters/flyers).
  const attackers = gatherAttackers(world);

  // Gather firing structures (towers) that are Complete and can fire.
  const towers = gatherTowers(world);

  // Stable order for determinism.
  towers.sort((a, b) => {
    const ia = String(a.id);
    const ib = String(b.id);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });

  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const targetId = selectTargetForTower(t, attackers, {
      tileSize,
      basePos,
      respectManual: true,
    });
    assignments.push({ towerId: t.id, targetId });
  }

  return assignments;
}

/**
 * Collect all live attacker entities from the world in a flat array.
 */
export function gatherAttackers(world) {
  const out = [];
  const pushAll = (arr) => {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      if (isLiveAttacker(arr[i])) out.push(arr[i]);
    }
  };

  if (Array.isArray(world.attackers)) {
    pushAll(world.attackers);
  } else {
    pushAll(world.walkers);
    pushAll(world.floaters);
    pushAll(world.flyers);
  }
  // Also support a generic entities map with a `side` flag.
  if (Array.isArray(world.entities)) {
    for (let i = 0; i < world.entities.length; i++) {
      const e = world.entities[i];
      if (e && e.side === 'attacker' && isLiveAttacker(e)) {
        if (out.indexOf(e) === -1) out.push(e);
      }
    }
  }
  return out;
}

/**
 * Collect all towers that are able to fire this tick.
 * A tower must be a firing structure in a Complete-ish state.
 */
export function gatherTowers(world) {
  const out = [];
  const isFiring = (s) => {
    if (!s || !s.pos) return false;
    if (s.canTarget == null && s.range == null) return false;
    // Only Complete / Damaged / Upgrading towers can fire; not Placing/Building/Destroyed/Selling.
    const st = s.state || s.lifecycle;
    if (st === 'Placing' || st === 'Building' || st === 'Destroyed' || st === 'Selling') {
      return false;
    }
    if (s.hp != null && s.hp <= 0) return false;
    return true;
  };

  if (Array.isArray(world.towers)) {
    for (let i = 0; i < world.towers.length; i++) {
      if (isFiring(world.towers[i])) out.push(world.towers[i]);
    }
  }
  if (Array.isArray(world.structures)) {
    for (let i = 0; i < world.structures.length; i++) {
      const s = world.structures[i];
      // Walls/moats have no weapon (canTarget undefined) → skipped by isFiring.
      if (isFiring(s)) {
        if (out.indexOf(s) === -1) out.push(s);
      }
    }
  }
  return out;
}

export default {
  domainOf,
  canWeaponHit,
  towerRange,
  selectTargetForTower,
  computeTargeting,
  gatherAttackers,
  gatherTowers,
};