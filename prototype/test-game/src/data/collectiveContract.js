/**
 * src/data/collectiveContract.js — the Collective contract quota for a map [MM-story_mw12m2df_2].
 *
 * Owner 2026-11-03: at the start of the game the player sells every harvested resource to the Collective through
 * the contract; whatever is collected beyond what the contract requires, the player keeps (inventory). The quota is
 * per map and per tier, on the map-data workbook's Maps sheet (Contract_Common / _Uncommon / _Rare / _Epic).
 * The sim applies it (harvest.js initContract); this only reads the data.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';

export const CONTRACT_TIERS = Object.freeze(['common', 'uncommon', 'rare', 'epic']);

/** → { common, uncommon, rare, epic } units the Collective buys on this map, or null when the map has no row. */
export function contractFor(mapId) {
  const row = MAPDATA.maps.find((r) => r.Map_ID === mapId);
  if (!row || row.Contract_Common == null) return null;
  return { common: row.Contract_Common, uncommon: row.Contract_Uncommon, rare: row.Contract_Rare, epic: row.Contract_Epic };
}
