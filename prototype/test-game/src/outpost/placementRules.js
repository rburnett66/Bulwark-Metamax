/**
 * src/outpost/placementRules.js — the outpost's own placement rules, as checks inside the battle's shared placement
 * (sim/structures.js validatePlacement → state.placementRules) [MM-task_mwcdvixz_2r] (S2.1, TECH_PLAN::One-Battle-UX.md §5.3).
 *
 * The outpost keeps NO placement code of its own: a live outpost SimState carries these rules and every placement goes
 * through the battle's validatePlacement, ghost and refusal reasons. Each rule reads the live sim (its structures) and
 * reuses the outpost model's formulas (model.js gunRefusalFor), never a copy of them.
 *
 *   outpostPlacementRules(map) → [rule]; rule(state, def, cell) → reason | null
 */
import { GUN_KINDS, HUB_CLEARANCE } from '../data/outpost.js';
import { gunRefusalFor } from './model.js';
import { ghostPower } from './view/conduits.js';
import { spacingConflict } from '../sim/structures.js';

const live = (state) => Array.from(state.structures.values()).filter((s) => s.lifecycle !== 'Destroyed' && s.lifecycle !== 'Selling');
const kindOf = (s, getDef) => { try { return getDef(s.structId).outpostKind || null; } catch (e) { return null; } };

/** A Mining Rig must stand exactly on a deposit (its 2×2 footprint on the deposit's 2×2 cells). */
export function rigNeedsDeposit(map) {
  const deposits = (map && map.deposits) || [];
  return (state, def, cell) => {
    if (def.outpostKind !== 'rig') return null;
    return deposits.some((d) => d.x === cell.x && d.y === cell.y) ? null : 'needs a deposit';
  };
}

/**
 * The landing pad's wider clearance (S2c.2 [MM-story_mwc9pmbn_2i]; owner 2026-11-11: "the mining station is too close
 * to the landing pad"): every building and defense keeps `clearance` free cells (data/outpost.js HUB_CLEARANCE) from
 * the hub's footprint. It IS the build-spacing rule (sim/structures.js spacingConflict, Chebyshev, the larger of the two
 * spacings wins) with the hub standing in as a structure whose spacing is the clearance — no second checker. The hub is
 * the live sim's base, not one of its structures, which is why it is passed here.
 */
export function hubClearance(map, clearance = HUB_CLEARANCE) {
  const hub = map && map.hub;
  if (!hub || !(clearance > 0)) return () => null;
  const landingPad = [{ structId: 'OUT-hub', pos: { x: hub.x, y: hub.y }, footprint: { w: hub.w, h: hub.h } }];
  const spacingOf = () => ({ spacing: clearance });
  return (state, def, cell) => (spacingConflict(landingPad, def, cell, spacingOf) ? `keep ${clearance} cells clear of the landing pad` : null);
}

/** One more gun (MG or Cannon) only while the crew cap allows it: the hub's Gun_Cap plus the finished Habitat's tier. */
export function gunCrewCap(getDef) {
  return (state, def) => {
    if (!GUN_KINDS.includes(def.outpostKind)) return null;
    const all = live(state);
    const guns = all.filter((s) => GUN_KINDS.includes(kindOf(s, getDef))).length;
    const habitat = Math.max(0, ...all.filter((s) => kindOf(s, getDef) === 'habitat' && s.lifecycle !== 'Building').map((s) => s.tier || 1));
    return gunRefusalFor(guns, habitat);
  };
}

/** The outpost's rules for a live outpost SimState on `map`. getDef = tables.getStructureDef. */
export function outpostPlacementRules(map, getDef) {
  return [rigNeedsDeposit(map), hubClearance(map), gunCrewCap(getDef)];
}

/** The rules that say WHERE an outpost structure may stand (not whether the player may build one now): the rig on a
 *  deposit and the hub clearance. siting.js places the starting kit and migrates saves by these. */
export function outpostPositionRules(map) {
  return [rigNeedsDeposit(map), hubClearance(map)];
}

// ── warnings: legal, but the player should know (sim/structures.js validatePlacement → state.placementWarnings) ────
const WARN_TEXT = Object.freeze({ reach: 'no power in reach', supply: 'grid short' });
/**
 * The ghost's power answer for a placement (One Battle UX §5.2: the ghost is amber when placeable but unpowered),
 * memoised on the last (outpost, structure, cell) — the shared ghost asks every frame. getOutpost: () → the outpost
 * (save shape) as it stands now.
 * → (def, cell, structId) → view/conduits.js ghostPower's answer, or null (not an outpost kind / draws no power).
 */
export function ghostPowerOf(getOutpost, map) {
  let last = null;
  return (def, cell, structId) => {
    const kind = def && def.outpostKind;
    if (!kind || !cell) return null;
    const o = getOutpost();
    if (!o) return null;
    if (last && last.o === o && last.structId === structId && last.x === cell.x && last.y === cell.y) return last.res;
    const fp = def.footprint || { w: 1, h: 1 };
    const res = ghostPower(o, map, kind, { x: cell.x, y: cell.y, w: fp.w || 1, h: fp.h || 1 });
    last = { o, structId, x: cell.x, y: cell.y, res };
    return res;
  };
}

/** The placement WARNING rule: 'no power in reach' / 'grid short' for a power-drawing outpost kind, else null. */
export function powerWarning(getOutpost, map, of = ghostPowerOf(getOutpost, map)) {
  return (state, def, cell, structId) => {
    const res = of(def, cell, structId);
    return res && res.reason ? WARN_TEXT[res.reason] : null;
  };
}
