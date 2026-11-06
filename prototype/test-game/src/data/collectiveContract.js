/**
 * src/data/collectiveContract.js — the Collective's contract for a planet × map [MM-story_mw12m2df_2] [MM-story_mw4a1o3p_m].
 *
 * Owner 2026-11-03: at the start of the game the player sells every harvested resource to the Collective through
 * the contract; whatever is collected beyond what the contract requires, the player keeps (inventory).
 * Owner 2026-11-05: contracts "exist for each planet and each map" and cover "common and uncommon resources"; "the rare
 * resources are part of the secondary contracts that make each map harder, and also give players a reason to go back
 * and replay levels". So the Collective buys COMMON and UNCOMMON only; rare and epic are always kept.
 *
 * Values: the map-data workbook's Collective_Contracts sheet (81 rows, measured by tools/economy/contract_quota.mjs),
 * extracted to MAPDATA.collectiveContracts. The sim applies the quota (harvest.js initContract); this only reads it.
 * Tech plan: docs/tech-plan/Collective-Faction.md §3.3.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';

/** The tiers the Collective buys. Rare and epic are not among them. */
export const CONTRACT_TIERS = Object.freeze(['common', 'uncommon']);

const rowFor = (planet, mapId) => (MAPDATA.collectiveContracts || [])
  .find((r) => r.Map_ID === mapId && (r.Planet_Key === planet || r.Planet === planet));

/**
 * → { common, uncommon } units the Collective buys on this planet's map, or null when there is no contract (an unknown
 * planet or map: the classic board and the harness, where every load pays). `planet` is the planet key ('ground') or
 * its name ('Verdance').
 */
export function contractFor(planet, mapId) {
  const row = rowFor(planet, mapId);
  return row ? { common: row.Common, uncommon: row.Uncommon } : null;
}

/** → { standing, goldBonus } paid on the first completion of this planet × map contract, or null. */
export function contractReward(planet, mapId) {
  const row = rowFor(planet, mapId);
  return row ? { standing: row.Standing, goldBonus: row.Gold_Bonus || 0 } : null;
}
