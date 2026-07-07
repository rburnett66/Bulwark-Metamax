// src/sim/vision.js
// Minimal deterministic vision model for BULWARK.
//   Rule 1: radar detects AIR units, but NOT ground/water units.
//   Rule 2: air units see ground at range (per-unit "Sees Ground" flag from tables).
//   Rule 3: ground/water/structure observers see ground/water targets within vision range.
// Exposed as per-entity visibility flags (entity.visibility / entity.visible), written by
// updateVision(state), called from the headless sim core each tick. Pure state in/out —
// no rendering, no randomness, stable iteration order (deterministic for replay hashing).

import * as Tables from '../data/tables.js';

// ---------------------------------------------------------------------------
// Assumptions / constants (data-driven, no hardcoded balance)
// ---------------------------------------------------------------------------

function resolveAssumptions() {
  const t = Tables;
  const candidates = [
    t.ASSUMPTIONS, t.Assumptions, t.assumptions,
    t.TABLES && t.TABLES.assumptions, t.TABLES && t.TABLES.Assumptions,
    t.TABLES && t.TABLES.ASSUMPTIONS,
    t.tables && t.tables.assumptions,
    t.default && t.default.assumptions,
    t.default && t.default.Assumptions,
    t.default && t.default.ASSUMPTIONS,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && typeof c === 'object') return c;
  }
  return {};
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function assumption(names, fallback) {
  const A = resolveAssumptions();
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if (A[key] !== undefined && A[key] !== null) {
      const raw = (typeof A[key] === 'object' && A[key] !== null && 'value' in A[key])
        ? A[key].value
        : A[key];
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

export const VISION_BASE = assumption(
  ['Vision_base', 'visionBase', 'VISION_BASE', 'vision_base'], 4
);

// Radar reach: generous relative to visual baseline — radar is a long-range
// sensor that trades breadth (air-only) for reach. Derived from Vision_base
// so it scales with global tuning rather than being an independent magic number.
export const DEFAULT_RADAR_RANGE = VISION_BASE * 3;

// ---------------------------------------------------------------------------
// Small helpers (tolerant readers of entity shapes produced by entities.js /
// structures.js — they never mutate anything except updateVision's flag writes)
// ---------------------------------------------------------------------------

function truthy(v) {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') return /^(yes|true|y|1)$/i.test(v.trim());
  return false;
}

function posOf(e) {
  if (e && e.pos && e.pos.x !== undefined && e.pos.y !== undefined) return e.pos;
  return e || { x: 0, y: 0 };
}

export function distance(a, b) {
  const pa = posOf(a);
  const pb = posOf(b);
  const dx = num(pa.x, 0) - num(pb.x, 0);
  const dy = num(pa.y, 0) - num(pb.y, 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function domainOf(e) {
  if (!e) return 'ground';
  const d = String(e.domain || e.moveDomain || e.travelDomain || '').toLowerCase();
  if (d.indexOf('fly') !== -1 || d.indexOf('air') !== -1) return 'air';
  if (d.indexOf('float') !== -1 || d.indexOf('swim') !== -1 || d.indexOf('water') !== -1) return 'water';
  if (e.isFlyer === true) return 'air';
  if (e.isFloater === true || e.isSwimmer === true) return 'water';
  if (e.altitude !== undefined && e.altitude !== null && num(e.altitude, 0) > 0) return 'air';
  return 'ground';
}

export function isAir(e) { return domainOf(e) === 'air'; }
export function isWater(e) { return domainOf(e) === 'water'; }
export function isGroundDomain(e) { return domainOf(e) === 'ground'; }

function isStructureLike(e) {
  if (!e) return false;
  if (e.isStructure === true || e.isBase === true) return true;
  const k = String(e.kind || e.type || '').toLowerCase();
  return k === 'base' || k === 'structure' || k === 'tower' || k === 'wall' || k === 'moat';
}

function isBaseEntity(e) {
  if (!e) return false;
  if (e.isBase === true) return true;
  return String(e.kind || e.type || '').toLowerCase() === 'base';
}

export function sideOf(e) {
  if (!e) return 'attacker';
  const s = String(e.side || e.team || e.owner || e.faction === 'player' ? (e.side || e.team || e.owner || '') : '').toLowerCase();
  if (s === 'defender' || s === 'player' || s === 'friendly' || s === 'ally') return 'defender';
  if (s === 'attacker' || s === 'enemy' || s === 'wave') return 'attacker';
  // Fallback: structures & base belong to the defender; units default to attacker
  // unless explicitly flagged as player troops.
  if (isStructureLike(e)) return 'defender';
  if (e.isPlayerTroop === true || e.deployed === true) return 'defender';
  return 'attacker';
}

function isAlive(e) {
  if (!e) return false;
  if (e.dead === true || e.removed === true) return false;
  if (e.hp !== undefined && e.hp !== null && num(e.hp, 1) <= 0) return false;
  const st = String(e.lifecycle || e.lifecycleState || '').toLowerCase();
  if (st === 'destroyed' || st === 'sold') return false;
  return true;
}

function canObserve(e) {
  if (!isAlive(e)) return false;
  // Structures under construction / being sold have no active sensors.
  const st = String(e.lifecycle || e.lifecycleState || '').toLowerCase();
  if (st === 'placing' || st === 'building' || st === 'selling') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Sensor capability queries
// ---------------------------------------------------------------------------

function canTargetAir(e) {
  if (!e) return false;
  const ct = e.canTarget !== undefined ? e.canTarget : (e.targetDomains !== undefined ? e.targetDomains : null);
  if (Array.isArray(ct)) {
    for (let i = 0; i < ct.length; i++) {
      const d = String(ct[i]).toLowerCase();
      if (d === 'air' || d === 'flyer' || d === 'both' || d === 'all') return true;
    }
    return false;
  }
  if (typeof ct === 'string') {
    const d = ct.toLowerCase();
    return d.indexOf('air') !== -1 || d.indexOf('both') !== -1 || d.indexOf('all') !== -1 || d.indexOf('fly') !== -1;
  }
  if (e.weapon) return canTargetAir(e.weapon);
  return false;
}

export function hasRadar(e) {
  if (!e) return false;
  if (truthy(e.radar) || truthy(e.hasRadar)) return true;
  // Anti-air weapons come paired with a radar in this minimal model,
  // and the base itself carries a radar mast.
  if (isBaseEntity(e)) return true;
  if (isStructureLike(e) && canTargetAir(e)) return true;
  return false;
}

export function radarRange(e) {
  if (!e) return 0;
  const r = num(e.radarRange, NaN);
  if (Number.isFinite(r)) return r;
  return DEFAULT_RADAR_RANGE;
}

export function visionRange(e) {
  if (!e) return VISION_BASE;
  const v = num(e.vision, NaN);
  if (Number.isFinite(v)) return v;
  const v2 = num(e.visionRange, NaN);
  if (Number.isFinite(v2)) return v2;
  const v3 = num(e.sight, NaN);
  if (Number.isFinite(v3)) return v3;
  return VISION_BASE;
}

// "Sees Ground" flag from the Units table: whether an AIR unit can spot ground
// targets. Ground/water/structure observers always use plain visual range.
export function seesGroundFlag(e) {
  if (!e) return false;
  if (!isAir(e)) return true;
  return truthy(e.seesGround) || truthy(e.seesGroundFlag) || truthy(e['Sees Ground']);
}

// Radar signature: does radar pick this entity up at all? (air = yes, ground = no)
export function radarSignature(e) {
  if (!e) return false;
  if (e.radarSignature !== undefined) return truthy(e.radarSignature);
  if (e.radarDetect !== undefined) return truthy(e.radarDetect);
  return isAir(e);
}

// ---------------------------------------------------------------------------
// Core detection predicate — the one rule everyone shares
// ---------------------------------------------------------------------------

export function canDetect(observer, target) {
  if (!observer || !target || observer === target) return false;
  if (!canObserve(observer) || !isAlive(target)) return false;

  const d = distance(observer, target);

  if (isAir(target)) {
    // Air targets: only radar sees them from the ground; air sees air visually.
    if (hasRadar(observer) && radarSignature(target) && d <= radarRange(observer)) return true;
    if (isAir(observer) && d <= visionRange(observer)) return true;
    return false;
  }

  // Ground / water targets: radar explicitly CANNOT see them.
  if (isAir(observer)) {
    // Air units see ground at range only if flagged for it.
    return seesGroundFlag(observer) && d <= visionRange(observer);
  }
  // Ground / water / structure observers: plain visual range.
  return d <= visionRange(observer);
}

// Which sensor produced the contact? Used to split the flags.
function detectionKind(observer, target) {
  if (!observer || !target || !canObserve(observer) || !isAlive(target)) return null;
  const d = distance(observer, target);
  if (isAir(target)) {
    if (hasRadar(observer) && radarSignature(target) && d <= radarRange(observer)) return 'radar';
    if (isAir(observer) && d <= visionRange(observer)) return 'visual';
    return null;
  }
  if (isAir(observer)) {
    return (seesGroundFlag(observer) && d <= visionRange(observer)) ? 'visual' : null;
  }
  return d <= visionRange(observer) ? 'visual' : null;
}

// ---------------------------------------------------------------------------
// State-wide flag pass
// ---------------------------------------------------------------------------

function collectEntities(state) {
  const out = [];
  if (!state) return out;
  if (state.base) out.push(state.base);
  const lists = [state.structures, state.units, state.troops, state.attackers];
  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];
    if (!Array.isArray(list)) continue;
    for (let j = 0; j < list.length; j++) {
      const e = list[j];
      if (e && out.indexOf(e) === -1) out.push(e);
    }
  }
  return out;
}

function writeFlags(target, radar, visual) {
  const visible = radar || visual;
  if (!target.visibility) {
    target.visibility = { radar: radar, visual: visual, visible: visible };
  } else {
    target.visibility.radar = radar;
    target.visibility.visual = visual;
    target.visibility.visible = visible;
  }
  target.visible = visible;
  target.detectedByRadar = radar;
}

function applyVisionPass(targets, observers) {
  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];
    if (!target) continue;
    let radar = false;
    let visual = false;
    if (isAlive(target)) {
      for (let o = 0; o < observers.length; o++) {
        const kind = detectionKind(observers[o], target);
        if (kind === 'radar') radar = true;
        else if (kind === 'visual') visual = true;
        if (radar && visual) break;
      }
    }
    writeFlags(target, radar, visual);
  }
}

/**
 * Main entry — called by the sim core each fixed step.
 * Writes per-entity visibility flags (entity.visibility = {radar, visual, visible},
 * entity.visible, entity.detectedByRadar). Deterministic: stable order, no RNG.
 * Returns the same state object for chaining.
 */
export function updateVision(state) {
  if (!state) return state;

  const entities = collectEntities(state);
  const defenders = [];
  const attackers = [];
  for (let i = 0; i < entities.length; i++) {
    (sideOf(entities[i]) === 'defender' ? defenders : attackers).push(entities[i]);
  }

  // Attackers are observed by the defense (radar towers / base / troops)...
  applyVisionPass(attackers, defenders);
  // ...and defensive structures/troops are observed by attackers
  // (air units spot ground at range; walkers/floaters use plain vision).
  applyVisionPass(defenders, attackers);

  // The base is a landmark: always visible to everyone regardless of sensors.
  if (state.base) {
    writeFlags(state.base, state.base.detectedByRadar === true, true);
  }

  // Convenience aggregate for the HUD / renderer (read-only summary; counts
  // only — kept scalar so the serialized state hash stays simple and stable).
  let airContacts = 0;
  let groundContacts = 0;
  for (let i = 0; i < attackers.length; i++) {
    const a = attackers[i];
    if (!a || !isAlive(a) || !a.visible) continue;
    if (isAir(a)) airContacts++;
    else groundContacts++;
  }
  state.vision = state.vision || {};
  state.vision.airContacts = airContacts;
  state.vision.groundContacts = groundContacts;

  return state;
}

/**
 * Targeting helper for combat.js: is `target` currently visible to `side`?
 * If the vision pass has never run on this entity, default to visible so the
 * combat core still works headless without an explicit vision step.
 */
export function isVisibleTo(target, side) {
  if (!target) return false;
  if (!target.visibility) return true;
  // Flags are written from the perspective of the OPPOSING side's sensors,
  // so a defender asking about an attacker (and vice versa) just reads them.
  if (side !== undefined && sideOf(target) === side) return true; // own units always known
  return target.visibility.visible === true;
}

/** Filter a candidate target list down to what `observer` can actually detect. */
export function visibleTargets(observer, candidates) {
  const out = [];
  if (!observer || !Array.isArray(candidates)) return out;
  for (let i = 0; i < candidates.length; i++) {
    if (canDetect(observer, candidates[i])) out.push(candidates[i]);
  }
  return out;
}

export default {
  VISION_BASE: VISION_BASE,
  DEFAULT_RADAR_RANGE: DEFAULT_RADAR_RANGE,
  updateVision: updateVision,
  canDetect: canDetect,
  isVisibleTo: isVisibleTo,
  visibleTargets: visibleTargets,
  distance: distance,
  domainOf: domainOf,
  isAir: isAir,
  isWater: isWater,
  isGroundDomain: isGroundDomain,
  hasRadar: hasRadar,
  radarRange: radarRange,
  visionRange: visionRange,
  seesGroundFlag: seesGroundFlag,
  radarSignature: radarSignature,
  sideOf: sideOf,
};