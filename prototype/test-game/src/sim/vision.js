Looking at the vision model requirements, I need to implement minimal vision/radar mechanics that read sim state.

```javascript
// src/sim/vision.js
// Minimal vision / radar system for BULWARK vertical slice.
//
// Rules (from MODEL):
//  - Radar sees air, not ground.
//  - Air units see ground at range.
//  - Vision is a READ-ONLY derived layer over strict sim state — it never
//    mutates gameplay-critical state in a way that would break determinism,
//    but it does write a per-tick `vision` snapshot into state for renderer/FX
//    consumption (fog of war). All computation is deterministic given state.
//
// This mirrors the data-driven attributes on entities:
//   entity.radarDetect  (Radar-Detect column)  -> can be seen by radar
//   entity.seesGround   (Sees Ground column)   -> this entity reveals ground
//   entity.vision       (Vision tiles)         -> detection radius
//   entity.domain       ('walker'|'floater'|'flyer')
//
// The system is headless-safe: no PIXI, no DOM.

import { TILE } from '../config/constants.js';

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Is this entity an air/flyer domain unit? */
export function isAir(e) {
  return e && (e.domain === 'flyer' || e.domain === 'air');
}

/** Is this entity a ground-bound domain unit (walker)? */
export function isGround(e) {
  return e && (e.domain === 'walker' || e.domain === 'ground');
}

/** Is this entity a water-lane domain unit (floater/swimmer)? */
export function isWater(e) {
  return e && (e.domain === 'floater' || e.domain === 'swimmer' || e.domain === 'water');
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Squared distance between two positioned things (in world units). */
function dist2(a, b) {
  const ax = a.x != null ? a.x : (a.pos ? a.pos.x : 0);
  const ay = a.y != null ? a.y : (a.pos ? a.pos.y : 0);
  const bx = b.x != null ? b.x : (b.pos ? b.pos.x : 0);
  const by = b.y != null ? b.y : (b.pos ? b.pos.y : 0);
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Vision range of an entity in world units (tiles * TILE). Falls back to base vision. */
function visionWorld(e) {
  const tiles = (e && typeof e.vision === 'number' && e.vision > 0) ? e.vision : 4;
  return tiles * TILE;
}

// ---------------------------------------------------------------------------
// Vision snapshot
// ---------------------------------------------------------------------------

/**
 * Build a deterministic vision snapshot from current sim state.
 *
 * Returns an object:
 *   {
 *     detected:   Set<entityId>   // enemy entities currently detected by defender side
 *     radarAir:   Set<entityId>   // air units seen by radar (structures/radar sources)
 *     airSeesGround: Set<entityId>// ground units revealed by enemy air units
 *     sources:    Array<{ id, x, y, radius, kind }>  // for fog rendering
 *   }
 *
 * Determinism: iteration order follows the arrays in state.entities, and no
 * randomness or floating time-of-day is used, so identical state => identical
 * snapshot.
 */
export function computeVision(state) {
  const detected = new Set();
  const radarAir = new Set();
  const airSeesGround = new Set();
  const sources = [];

  const entities = collectEntities(state);
  const structures = collectStructures(state);

  // ---- Radar (defender structures/towers) sees AIR, not ground. ----
  // Any friendly structure acts as a passive radar for air units within its
  // vision range. Anti-air towers explicitly detect air; all structures give
  // partial radar coverage for air per the "radar sees air" rule.
  for (const s of structures) {
    if (!s || s.dead) continue;
    if (s.state === 'Destroyed' || s.state === 'destroyed') continue;
    const radius = visionWorld(s);
    sources.push({
      id: s.id,
      x: srcX(s),
      y: srcY(s),
      radius,
      kind: 'radar',
    });
    const r2 = radius * radius;
    for (const e of entities) {
      if (!e || e.dead) continue;
      if (e.side === 'defender' || e.friendly) continue; // only enemies
      if (!isAir(e)) continue;                             // radar => air only
      // Only detectable if the unit carries a radar signature (radarDetect).
      const detectable = e.radarDetect !== false;
      if (!detectable) continue;
      if (dist2(s, e) <= r2) {
        radarAir.add(e.id);
        detected.add(e.id);
      }
    }
  }

  // ---- Air units (attacker side flyers) see GROUND at range. ----
  // This reveals defender ground entities to the attacker sensor picture.
  // For the slice it is informational (fog for renderer / AI); it never
  // alters targeting rules which are domain-gated in combat.js.
  for (const a of entities) {
    if (!a || a.dead) continue;
    if (!isAir(a)) continue;
    if (a.seesGround === false) continue; // must have "Sees Ground"
    const radius = visionWorld(a);
    sources.push({
      id: a.id,
      x: srcX(a),
      y: srcY(a),
      radius,
      kind: 'air-recon',
    });
    const r2 = radius * radius;
    for (const g of entities) {
      if (!g || g.dead) continue;
      if (g.id === a.id) continue;
      if (!(isGround(g) || isWater(g) || isStructureEntity(g))) continue;
      if (dist2(a, g) <= r2) {
        airSeesGround.add(g.id);
        detected.add(g.id);
      }
    }
    // Air also sees the base as a ground reveal.
    if (state.base) {
      if (dist2(a, state.base) <= r2) {
        airSeesGround.add(state.base.id || 'base');
        detected.add(state.base.id || 'base');
      }
    }
  }

  return { detected, radarAir, airSeesGround, sources };
}

/**
 * Advance / update the vision system for this tick and store on state.
 * Called from step.js in the fixed system order.
 */
export function updateVision(state) {
  const snap = computeVision(state);
  state.vision = snap;
  return snap;
}

/** Convenience query: is entity currently detected by the defender picture? */
export function isDetected(state, entityOrId) {
  if (!state.vision) return true; // no vision computed => treat as visible
  const id = typeof entityOrId === 'object' ? entityOrId.id : entityOrId;
  return state.vision.detected.has(id);
}

/** Convenience query: is an air unit currently on radar? */
export function onRadar(state, entityOrId) {
  if (!state.vision) return false;
  const id = typeof entityOrId === 'object' ? entityOrId.id : entityOrId;
  return state.vision.radarAir.has(id);
}

// ---------------------------------------------------------------------------
// Internal collectors — tolerant of different state shapes
// ---------------------------------------------------------------------------

function srcX(e) {
  return e.x != null ? e.x : (e.pos ? e.pos.x : 0);
}
function srcY(e) {
  return e.y != null ? e.y : (e.pos ? e.pos.y : 0);
}

function isStructureEntity(e) {
  return e && (e.category === 'structure' || e.isStructure || e.tier != null && e.footprint != null);
}

function collectEntities(state) {
  // Prefer explicit attacker/unit arrays; fall back to a merged entities list.
  const out = [];
  if (Array.isArray(state.entities)) {
    for (const e of state.entities) out.push(e);
  }
  if (Array.isArray(state.units)) {
    for (const e of state.units) out.push(e);
  }
  if (Array.isArray(state.attackers)) {
    for (const e of state.attackers) out.push(e);
  }
  // De-dup by id (arrays may overlap).
  if (out.length) {
    const seen = new Set();
    const uniq = [];
    for (const e of out) {
      if (!e) continue;
      const id = e.id != null ? e.id : e;
      if (seen.has(id)) continue;
      seen.add(id);
      uniq.push(e);
    }
    return uniq;
  }
  return out;
}

function collectStructures(state) {
  const out = [];
  if (Array.isArray(state.structures)) {
    for (const s of state.structures) out.push(s);
  }
  if (Array.isArray(state.towers)) {
    for (const s of state.towers) out.push(s);
  }
  // Also glean structures out of the generic entities list if tagged.
  if (Array.isArray(state.entities)) {
    for (const e of state.entities) {
      if (isStructureEntity(e)) out.push(e);
    }
  }
  if (out.length) {
    const seen = new Set();
    const uniq = [];
    for (const s of out) {
      if (!s) continue;
      const id = s.id != null ? s.id : s;
      if (seen.has(id)) continue;
      seen.add(id);
      uniq.push(s);
    }
    return uniq;
  }
  return out;
}

export default {
  computeVision,
  updateVision,
  isDetected,
  onRadar,
  isAir,
  isGround,
  isWater,
};