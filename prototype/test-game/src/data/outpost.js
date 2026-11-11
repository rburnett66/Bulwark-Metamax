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
import { STRUCTURES, BONUS_NERFS, HARVESTER_UNLOAD_TIME } from './tables.js';

/** The tuning (Outpost_Params), by name: Load_Sec, Store_Hours, Deep_Rate_Mult, … */
export const OUTPOST = Object.freeze({ ...(MAPDATA.outpostParams || {}) });

/** What the contract grants (design §2.3, owner 2026-11-07): the Outpost Hub only. Everything else is bought. */
export const GRANTED = Object.freeze(['hub']);
/** What going online (contract step 1, "Establish") asks for: these four, all powered, the rig on the common ore. */
export const ESTABLISH = Object.freeze(['hub', 'power', 'rig', 'storage']);
/**
 * The reference outpost the raid measurement and the design's power sums use (the former contract kit): the four
 * above plus the map's `kitDefenses` (a Cannon, a Machine Gun and walls). Nothing grants it any more.
 */
export const REFERENCE_SET = Object.freeze(['hub', 'power', 'rig', 'storage', 'cannon', 'mg', 'wall']);
/** The only defenses an outpost may build (owner: Wall, Machine Gun, the turret tower = the battle's Cannon Tower). */
export const DEFENSE_KINDS = Object.freeze(['mg', 'cannon', 'wall']);
/** The defenses the hub crews and the gun cap counts (owner 2026-11-07: Machine Guns and Cannons; walls do not count). */
export const GUN_KINDS = Object.freeze(['mg', 'cannon']);
/**
 * Who gets power first when a grid is short (design §4.5, One Battle UX §5.2): lower serves first, so the outpost keeps
 * its core running. A kind not listed serves last (POWER_PRIORITY_LAST). outpost/model.js powerGrids reads it.
 * A data constant here, not a workbook column yet: the workbook (Outpost_Structures) would take a Power_Priority
 * column, but it is owned by another lane this round.
 */
export const POWER_PRIORITY = Object.freeze({ hub: 0, storage: 1, rig: 2, mg: 3, cannon: 3, resourceBay: 4, upgradeBay: 5, habitat: 6, farmhouse: 7, silo: 7, pump: 8 });
export const POWER_PRIORITY_LAST = 9;
/** A kind's power priority (lower is served first). */
export const powerPriority = (kind) => POWER_PRIORITY[kind] ?? POWER_PRIORITY_LAST;
/** Old kind names kept readable: the Harvester Bay became the Resource Bay (owner, 2026-11-07). */
export const KIND_ALIASES = Object.freeze({ harvesterBay: 'resourceBay' });
/** A kind's current name ('harvesterBay' → 'resourceBay'; anything else unchanged). */
export const canonicalKind = (kind) => KIND_ALIASES[kind] || kind;

const num = (v) => (typeof v === 'number' ? v : 0);
const STRUCTS = Object.freeze((MAPDATA.outpostStructures || []).map((r) => Object.freeze({
  kind: r.Kind, tier: r.Tier, cost: num(r.Cost), value: num(r.Value), buildSec: num(r.Build_Sec),
  draw: num(r.Power_Draw), supply: num(r.Power_Supply), reach: num(r.Power_Reach),
  bayHours: num(r.Bay_Hours) || null, rateMult: num(r.Rate_Mult) || null, capacityMult: num(r.Capacity_Mult) || null,
  battleStruct: r.Battle_Struct || null, model: r.Model || null, unlock: r.Unlock || '',
})));

/** A building's definition at a tier, or null. A defense also carries its battle stats at that tier (`battle`). */
export function structureDef(kind, tier = 1) {
  kind = canonicalKind(kind);
  const d = STRUCTS.find((s) => s.kind === kind && s.tier === tier);
  if (!d) return null;
  if (!d.battleStruct) return d;
  const b = STRUCTURES[d.battleStruct];
  const at = (v) => (Array.isArray(v) ? v[Math.min(tier, v.length) - 1] : v);
  return { ...d, battle: { hp: at(b.hp), dps: at(b.dps), range: b.range, targets: b.canTargetDomains, groundTargets: b.groundTargets || null } };
}

/** The highest tier the data defines for a kind. */
export const maxTier = (kind) => Math.max(0, ...STRUCTS.filter((s) => s.kind === canonicalKind(kind)).map((s) => s.tier));

/**
 * The harvester the Resource Bay fields (owner 2026-11-07: bought from the build list once a Resource Bay is built):
 * { cost, cap, max } — cost from the Outpost_Structures `harvester` row (the battle harvester's price × 4), the cap
 * an outpost starts with (Harvester_Cap) and the most it can ever hold (Harvester_Max; raising the cap is O10).
 */
export function harvesterDef() {
  const d = structureDef('harvester', 1);
  return d ? { cost: d.cost, value: d.value, cap: OUTPOST.Harvester_Cap, max: OUTPOST.Harvester_Max } : null;
}

/**
 * The battle harvest rate an outpost harvester gathers at (design §6, story O10): the battle harvester's own numbers,
 * read from the same workbook rows the battle reads (harvest.js harvesterStats / nodeHarvestSec):
 *   capacity  Factions row 1 Harvester_Base_Capacity (the tuning reference, upgrade level 1);
 *   speed     Harvester_Base_Speed × BONUS_NERFS.harvesterSpeedMult (the battle's starting speed), cells / s;
 *   pull      units / s at a cell: Units_Per_Node / Harvest_Sec_Per_Node of the tier's Resources row — common is
 *             the Primary row of Flowers (every planet's primary fields), uncommon the Premium row of the reference
 *             faction's Premium_Resource;
 *   unload    HARVESTER_UNLOAD_TIME, s at the bay.
 * A trip to a field d cells away is 2·d·Harvest_Route_Mult / speed + capacity / pull + unload seconds and brings
 * `capacity` units, × Harvest_Rate_Mult (1 = the battle's rate). → { capacity, speed, unload, pull: { common, uncommon } }
 */
export function harvestRates() {
  const f = (MAPDATA.factions && MAPDATA.factions[0]) || {};
  const row = (type, tier) => (MAPDATA.resources || []).find((r) => r.Resource === type && r.Tier === tier) || {};
  const pull = (r) => (r.Units_Per_Node || 20) / Math.max(1, r.Harvest_Sec_Per_Node || 8);
  return Object.freeze({
    capacity: f.Harvester_Base_Capacity || 40,
    speed: (f.Harvester_Base_Speed || 3) * BONUS_NERFS.harvesterSpeedMult,
    unload: HARVESTER_UNLOAD_TIME,
    pull: Object.freeze({ common: pull(row('Flowers', 'Primary')), uncommon: pull(row(f.Premium_Resource || 'Crystals', 'Premium')) }),
  });
}

/**
 * An outpost surface field's stock and regrowth per cell (owner 2026-11-07: "Full battle rate but the spawn rate of
 * surface resources on outpost land is 5% of the premium land surveyed for the tower defense mode"). A cell holds what
 * a battle node of its tier holds (Units_Per_Node: Flowers Primary for common, the reference faction's premium row for
 * uncommon) and regrows at Surface_Respawn_Mult × the battle's rate, a node's units per Primary_Respawn_Sec.
 * → { common: { units, regrow (units / s) }, uncommon: { … } }
 */
export function surfaceStock(params = OUTPOST) {
  const f = (MAPDATA.factions && MAPDATA.factions[0]) || {};
  const row = (type, tier) => (MAPDATA.resources || []).find((r) => r.Resource === type && r.Tier === tier) || {};
  const respawn = (MAPDATA.globalParams && MAPDATA.globalParams.Primary_Respawn_Sec) || 75;
  const cell = (r) => { const units = r.Units_Per_Node || 20; return Object.freeze({ units, regrow: (units / respawn) * (params.Surface_Respawn_Mult ?? 1) }); };
  return Object.freeze({ common: cell(row('Flowers', 'Primary')), uncommon: cell(row(f.Premium_Resource || 'Crystals', 'Premium')), respawnSec: respawn });
}

/** Units per second one harvester brings home from a field `dist` cells (straight line) from the Resource Bay. */
export function harvesterRate(tier, dist, params = OUTPOST, rates = harvestRates()) {
  const pull = rates.pull[tier];
  if (!pull) return 0;
  const trip = (2 * dist * (params.Harvest_Route_Mult ?? 1)) / rates.speed + rates.capacity / pull + rates.unload;
  return (rates.capacity / trip) * (params.Harvest_Rate_Mult ?? 1);
}

/**
 * The Outpost division of the tech tree (design §7, story O10): MAPDATA.outpostTech (the workbook's Outpost_Tech
 * sheet) → [{ id, name, price, effect, unlockedBy, requires: [id], applies: 'outposts' | 'upgradeBay' }].
 * A contract step unlocks a node; the player buys it in the Tech Tree.
 */
export const OUTPOST_TECH = Object.freeze((MAPDATA.outpostTech || []).map((r) => Object.freeze({
  id: r.Node, name: r.Name, price: num(r.Price), effect: r.Effect || '', unlockedBy: r.Unlocked_By || '',
  requires: Object.freeze(String(r.Requires || '').split(/\s+/).filter(Boolean)), applies: r.Applies || 'outposts',
})));
export const OUTPOST_TECH_IDS = Object.freeze(OUTPOST_TECH.map((t) => t.id));

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
 * A planet's raid at a contract step (Outpost_Raids, measured by tools/economy/outpost_raids.mjs; design §5.2):
 * { planet, step, units: [unit ids, cycled in spawn order], size, breacher: unit id | null (after the others, in the
 * raids of every Breacher_Every-th window; owner 2026-11-07, for planets whose troops cannot hurt walls, "breacher
 * every other raid"), breacherEvery, breacherHpMult (the breacher's HP against battle HP, × the step's strength), strength (the step's Strength_Step, 1 at step 1), hpMult, dmgMult (raid-only
 * raider strength, owner 2026-11-07 "weaker raiders", × the step's strength; 1 = battle strength), farDayBump }, or
 * null when the data has none.
 */
export function raidFor(planet, step = 1) {
  const r = (MAPDATA.outpostRaids || []).find((x) => x.Planet_Key === planet);
  if (!r) return null;
  const s = Math.max(1, Math.min(3, step | 0 || 1));
  // the step's strength (owner 2026-11-07, "same set, smaller raids"): Strength_Step2/3 scale both multipliers
  const strength = s === 1 ? 1 : (num(r[`Strength_Step${s}`]) || 1);
  return Object.freeze({
    planet, step: s, units: Object.freeze(String(r.Units || '').split(/\s+/).filter(Boolean)),
    size: num(r[`Size_Step${s}`]), breacher: r.Breacher || null, breacherEvery: Math.max(1, num(r.Breacher_Every) || 1),
    breacherHpMult: num(r.Breacher_HP_Mult) || 1,
    strength, hpMult: (num(r.Raider_HP_Mult) || 1) * strength, dmgMult: (num(r.Raider_Damage_Mult) || 1) * strength,
    farDayBump: num(r.Far_Day_Bump),
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

/**
 * Storage bay size in units for one rig (design §4.2): with a powered Storage Tower, the tower's hours × that rig's
 * shallow output × rig capacity; with none (storageTier 0, or a tower without power: its door is closed), the rig's
 * own small bay, Rig_Bay_Min minutes of its shallow output × rig capacity (owner 2026-11-07).
 */
export function bayUnits(ore, { rigTier = 1, storageTier = 1 } = {}) {
  const rig = structureDef('rig', rigTier);
  if (!rig) return 0;
  if (!storageTier) return ore.rate * OUTPOST.Rig_Bay_Min * rig.capacityMult;
  const st = structureDef('storage', storageTier);
  return st ? ore.rate * 60 * st.bayHours * rig.capacityMult : 0;
}

/** Units in one shuttle load for one rig: Load_Sec of its current output. */
export const loadUnits = (ratePerMin) => ratePerMin * (OUTPOST.Load_Sec / 60);
