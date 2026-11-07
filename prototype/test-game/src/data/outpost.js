/**
 * src/data/outpost.js — outpost buildings, contracts and tuning [MM-story_mw5oe4ap_i].
 *
 * Values: the map-data workbook's Outpost_Structures, Outpost_Contracts and Outpost_Params sheets →
 * MAPDATA.outpostStructures / .outpostContracts / .outpostParams. Defenses take their battle stats from STRUCTURES
 * (src/data/tables.js) through Battle_Struct, so the outpost and the battle game use the same numbers (owner).
 * Design: docs/16 Bulwark MM/design/Outpost-Design.md §2, §4.5, §5.2, §6 · Tech plan: docs/tech-plan/Outpost.md §3.2.
 * Pure data; no DOM, no clock.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';
import { STRUCTURES } from './tables.js';

/** The tuning (Outpost_Params), by name: Load_Sec, Store_Hours, Deep_Rate_Mult, … */
export const OUTPOST = Object.freeze({ ...(MAPDATA.outpostParams || {}) });

/** The buildings in the contract-1 kit (design §2.3). Walls come as a ring, placed with the map. */
export const KIT = Object.freeze(['hub', 'power', 'rig', 'storage', 'cannon', 'mg', 'wall']);
export const DEFENSE_KINDS = Object.freeze(['mg', 'cannon', 'wall']);

const num = (v) => (typeof v === 'number' ? v : 0);
const STRUCTS = Object.freeze((MAPDATA.outpostStructures || []).map((r) => Object.freeze({
  kind: r.Kind, tier: r.Tier, cost: num(r.Cost), value: num(r.Value), buildSec: num(r.Build_Sec),
  draw: num(r.Power_Draw), supply: num(r.Power_Supply), reach: num(r.Power_Reach),
  bayHours: num(r.Bay_Hours) || null, rateMult: num(r.Rate_Mult) || null, capacityMult: num(r.Capacity_Mult) || null,
  battleStruct: r.Battle_Struct || null, model: r.Model || null, unlock: r.Unlock || '',
})));

/** A building's definition at a tier, or null. A defense also carries its battle stats at that tier (`battle`). */
export function structureDef(kind, tier = 1) {
  const d = STRUCTS.find((s) => s.kind === kind && s.tier === tier);
  if (!d) return null;
  if (!d.battleStruct) return d;
  const b = STRUCTURES[d.battleStruct];
  const at = (v) => (Array.isArray(v) ? v[Math.min(tier, v.length) - 1] : v);
  return { ...d, battle: { hp: at(b.hp), dps: at(b.dps), range: b.range, targets: b.canTargetDomains, groundTargets: b.groundTargets || null } };
}

/** The highest tier the data defines for a kind. */
export const maxTier = (kind) => Math.max(0, ...STRUCTS.filter((s) => s.kind === kind).map((s) => s.tier));

/** Every outpost structure row (for tools and tests). */
export const allStructures = () => STRUCTS;

/** A planet's contract step (1–3), or null. `unlocks` is split into { ores: [tier], techs: [id], farBuyer }. */
export function contractFor(planet, step) {
  const r = (MAPDATA.outpostContracts || []).find((c) => c.Planet_Key === planet && c.Step === step);
  if (!r) return null;
  const tags = String(r.Unlocks || '').split(/\s+/).filter(Boolean);
  return Object.freeze({
    planet, step, title: r.Title, oreTier: r.Ore_Tier, deliver: r.Deliver, raidsHeld: r.Raids_Held,
    gold: r.Gold, loyalty: r.Loyalty, xp: r.XP,
    unlocks: Object.freeze({
      ores: tags.filter((t) => t.startsWith('ore:')).map((t) => t.slice(4)),
      techs: tags.filter((t) => t.startsWith('tech:')).map((t) => t.slice(5)),
      farBuyer: tags.includes('far_buyer'),
    }),
  });
}

/**
 * Power budget of a set of buildings, ignoring reach: [{ kind, tier }] → { supply, draw, spare }. Reach and grid
 * pooling need the map (powerGrids in src/outpost/model.js); this is the whole-outpost sum the design quotes
 * ("the kit draws 9 of the first station's 10").
 */
export function powerBudget(structures) {
  let supply = 0, draw = 0;
  for (const s of structures) {
    const d = structureDef(s.kind, s.tier || 1);
    if (!d) continue;
    supply += d.supply;
    draw += d.draw;
  }
  return { supply, draw, spare: supply - draw };
}

/** Storage bay size in units for one rig (design §4.2): Store tower hours × that rig's shallow output × rig capacity. */
export function bayUnits(ore, { rigTier = 1, storageTier = 1 } = {}) {
  const rig = structureDef('rig', rigTier), st = structureDef('storage', storageTier);
  if (!rig || !st) return 0;
  return ore.rate * 60 * st.bayHours * rig.capacityMult;
}

/** Units in one shuttle load for one rig: Load_Sec of its current output. */
export const loadUnits = (ratePerMin) => ratePerMin * (OUTPOST.Load_Sec / 60);
