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
import { FACTION_KEYS, relationOf } from './factionRelations.js';

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
 * and this run has not already offered it. An offer the player declined stays OPEN (owner 2026-11-21: "Players can
 * always return to find a mission they need" [MM-story_mwpzbj5c_45]): on the next map on that planet it comes again at
 * wave RARE_OFFER.wave without the stars.
 */
export function rareOfferEarned({ clearedWave, waveStars, alreadyOffered = false, open = false }, R = RARE_OFFER) {
  return !alreadyOffered && clearedWave === R.wave && (!!open || Number(waveStars) >= R.minStars);
}

/**
 * ACCEPTING takes a side (owner 2026-11-21 [MM-story_mwq11to8_1]: "accepting offers from rival factions might increase
 * alignment with one while hurting alignment with another rival faction"). The moment an offer is accepted the faction
 * that made it gains a little loyalty and every faction Hostile to it (factionRelations.js) loses as much; the sale's
 * reward still comes when the goods sell. Proposed values (owner to tune).
 */
export const ACCEPT_LOYALTY = Object.freeze({ giver: 2, hostile: -2 });
/**
 * The loyalty an accepted offer moves now. buyerKey: the offering faction's key; nameOf(key): its display name (the
 * loyalty ledger's key). → [{ key, name, delta }], the giver first.
 */
export function acceptEffects(buyerKey, nameOf = (k) => k, A = ACCEPT_LOYALTY) {
  if (!FACTION_KEYS.includes(buyerKey)) return [];
  const out = [{ key: buyerKey, name: nameOf(buyerKey), delta: A.giver }];
  for (const k of FACTION_KEYS) if (k !== buyerKey && relationOf(buyerKey, k) === 'hostile') out.push({ key: k, name: nameOf(k), delta: A.hostile });
  return out.filter((e) => e.name && e.delta);
}
/** Those effects in words for the offer's terms: "+2 loyalty with Ground / Powder; −2 with Air". */
export const acceptEffectsText = (effects) => effects.map((e, i) => `${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)}${i ? '' : ' loyalty'} with ${e.name}`).join('; ');

/** The offer left open on a planet (s.openOffers[planetKey]: { contact, buyer }), or null. */
export const openOfferOn = (s, planetKey) => ((s && s.openOffers) || {})[planetKey] || null;
/** Keep a declined offer open on a planet, or close it (contact null) once it is accepted. Mutates s. */
export function setOpenOffer(s, planetKey, offer) {
  if (!s.openOffers || typeof s.openOffers !== 'object') s.openOffers = {};
  if (offer && offer.contact && offer.buyer) s.openOffers[planetKey] = { contact: offer.contact, buyer: offer.buyer };
  else delete s.openOffers[planetKey];
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

/**
 * Bank a settled rare contract into the save (end of map, win or lose) [MM-story_mw5eozsn_c]. The units sold leave the
 * battle's kept tally, so the inventory does not bank them as well; the gold goes to the campaign bank; the loyalty to
 * the buyer through addLoyalty (save/contracts.js, passed in so this file stays free of the save layer). → settled.
 */
export function bankRareSale(s, settled, { buyerFaction, tally = null, addLoyalty } = {}) {
  if (!settled || !settled.sold) return settled;
  if (tally && tally.kept) tally.kept.rare = Math.max(0, (tally.kept.rare || 0) - settled.sold);
  if (settled.gold > 0) {
    const c = s.carry || (s.carry = { gold: 0, structures: [] });
    c.gold = (c.gold || 0) + settled.gold; s.goldBank = c.gold;
  }
  if (addLoyalty && buyerFaction && settled.loyalty) addLoyalty(s, buyerFaction, settled.loyalty);
  return settled;
}

/** The results-screen line for a settled contract. */
export function rareResultLine(settled, shipName, resourceName = 'rare') {
  return settled.sold > 0
    ? `${shipName} bought ${settled.sold} ${resourceName} for ${settled.gold.toLocaleString('en-US')} gold.`
    : `${shipName}'s contract closed with nothing to sell.`;
}
