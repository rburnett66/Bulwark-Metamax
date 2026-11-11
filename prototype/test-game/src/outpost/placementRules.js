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
import { GUN_KINDS } from '../data/outpost.js';
import { gunRefusalFor } from './model.js';
import { ghostPower } from './view/conduits.js';

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
  return [rigNeedsDeposit(map), gunCrewCap(getDef)];
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
