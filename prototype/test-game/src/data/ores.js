/**
 * src/data/ores.js — the 27 mined ores, three per planet [MM-story_mw5oe4ap_i].
 *
 * Ores are their own family: surface resources come from battles and the Harvester Bay, ores only from outpost
 * mining rigs. Each planet has a common, an uncommon and a rare ore; each is mined by its own rig design (Rig_Head).
 * A rig can switch to the deposit's deep seam: the same ore at deep grade, its own item (`<id>_deep`), extracted
 * at Deep_Rate_Mult of the speed and sold at Deep_Price_Mult of the price.
 *
 * Values: the map-data workbook's Ores sheet → MAPDATA.ores (tools/economy/write_outpost_sheets.py seeds it).
 * Design: docs/16 Bulwark MM/design/Outpost-Design.md §3, §4 · Tech plan: docs/tech-plan/Outpost.md §3.2.
 * Pure data; no DOM, no clock.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';

export const ORE_TIERS = Object.freeze(['common', 'uncommon', 'rare']);
const DEEP = '_deep';

const ORES = Object.freeze((MAPDATA.ores || []).map((r) => Object.freeze({
  id: r.Ore_Id, name: r.Ore, planet: r.Planet_Key, planetName: r.Planet, tier: r.Tier,
  rate: r.Rate_Per_Min, price: r.Price, deepRate: r.Deep_Rate_Mult, deepPrice: r.Deep_Price_Mult,
  colour: r.Colour, rig: r.Rig_Head, wantedBy: r.Wanted_By || null, use: r.Use,
})));

/** Every ore, in workbook order (planet by planet, common → rare). */
export const allOres = () => ORES;

/** A planet's three ores (key or display name), common → rare. */
export function oresOf(planet) {
  return ORE_TIERS.map((t) => ORES.find((o) => (o.planet === planet || o.planetName === planet) && o.tier === t))
    .filter(Boolean);
}

/** The planet's ore of this tier, or null. */
export const oreOf = (planet, tier) => oresOf(planet).find((o) => o.tier === tier) || null;

/** An ore by id. The deep-grade item id (`iron_deep`) returns the same ore with deep: true. */
export function oreById(id) {
  const deep = typeof id === 'string' && id.endsWith(DEEP);
  const o = ORES.find((x) => x.id === (deep ? id.slice(0, -DEEP.length) : id));
  return o ? (deep ? { ...o, deep: true } : o) : null;
}

/** The storage / inventory item id for an ore at a grade. */
export const oreItemId = (id, deep = false) => (deep ? id + DEEP : id);

/** Units per minute one rig extracts: Rig I shallow is `rate`; deep × deepRate; rig tier via its Rate_Mult. */
export const oreRatePerMin = (ore, { deep = false, rateMult = 1 } = {}) => ore.rate * (deep ? ore.deepRate : 1) * rateMult;

/** Gold per unit at the home buyer: `price`, deep × deepPrice. */
export const orePrice = (ore, { deep = false } = {}) => ore.price * (deep ? ore.deepPrice : 1);

/** Gold per hour one rig earns on this ore (the design's §4.2 / §4.4 tables). */
export const oreValuePerHour = (ore, { deep = false, rateMult = 1 } = {}) =>
  oreRatePerMin(ore, { deep, rateMult }) * 60 * orePrice(ore, { deep });

/** The rare ore this faction pays the far price for (design §8.5), or null. */
export const oreWantedBy = (faction) => ORES.find((o) => o.wantedBy === faction) || null;
