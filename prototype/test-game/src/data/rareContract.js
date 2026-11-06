/**
 * src/data/rareContract.js — the optional RARE contract offered in battle [MM-task_mw5h8fxu_d] [MM-story_mw5eozsn_c].
 *
 * Owner 2026-11-06: "Players do not get missions associated with other planets, although a faction character can
 * appear if your star level is above a 2 on wave 3 and present you with the optional contract to collect rare
 * resources … Accepting the contract allows you to sell some rare resources without actually visiting the capital
 * ship for that faction, and the optional contract will resolve at the end of that map." Q4: it "appears only if you
 * get 3 stars on wave 3" and "will introduce a new character" who greets you aboard that ship on the first visit.
 * Q6: "Decline costs nothing, but player will need to re-earn it to unlock it again."
 *
 * Values: the map-data workbook's Rare_Contracts sheet (81 rows, tools/economy/rare_quota.mjs) → MAPDATA.rareContracts.
 * Design: docs/16 Bulwark MM/design/Rare-Contracts-Design.md · Tech plan: docs/tech-plan/Content-Reveal.md §5.5.
 * Pure data + predicates; no DOM, no clock, no Math.random (the buyer pick takes a seed).
 */
import { MAPDATA } from '../../content/maps/mapdata.js';

/** The offer rule: after this wave is cleared at this many stars or more. */
export const RARE_OFFER = Object.freeze({ wave: 3, minStars: 3 });

const rowFor = (planet, mapId) => (MAPDATA.rareContracts || [])
  .find((r) => r.Map_ID === mapId && (r.Planet_Key === planet || r.Planet === planet));

/** → { quota, pricePerUnit, loyalty } for this planet's map, or null (unknown planet or map). */
export function rareContractFor(planet, mapId) {
  const r = rowFor(planet, mapId);
  return r ? { quota: r.Quota, pricePerUnit: r.Price_Per_Unit, loyalty: r.Loyalty } : null;
}

/**
 * Is the offer earned now? Only when the wave just cleared is RARE_OFFER.wave, it scored RARE_OFFER.minStars or more,
 * and this run has not already offered it (accepted or declined: a decline is re-earned on a later run, never
 * re-offered in the same one).
 */
export function rareOfferEarned({ clearedWave, waveStars, alreadyOffered = false }, R = RARE_OFFER) {
  return !alreadyOffered && clearedWave === R.wave && Number(waveStars) >= R.minStars;
}

/**
 * Who can buy: the planets whose capital ship has arrived (keys), minus the planet being fought on. The pick is a
 * seeded index so a replay offers the same buyer. → planet key or null when no ship but this planet's has arrived.
 */
export function pickBuyer(arrivedPlanets, fightingPlanet, seed = 0) {
  const pool = (arrivedPlanets || []).filter((k) => k && k !== fightingPlanet).sort();
  if (!pool.length) return null;
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}

/**
 * Resolve at the end of the map, win or lose: the rare units harvested this map are sold up to the quota.
 * → { sold, gold, loyalty } (loyalty to the buyer only when something was sold).
 */
export function settleRareContract(contract, rareHarvested) {
  if (!contract) return { sold: 0, gold: 0, loyalty: 0 };
  const sold = Math.max(0, Math.min(contract.quota, Math.floor(rareHarvested || 0)));
  return { sold, gold: sold * contract.pricePerUnit, loyalty: sold > 0 ? contract.loyalty : 0 };
}
