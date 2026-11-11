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
