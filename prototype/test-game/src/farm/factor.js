/**
 * src/farm/factor.js — the farming contract is offered in person by the planet faction's Factor [MM-story_mwcuzyf7_3k].
 *
 * Owner 2026-11-11: "Where is the farm mission which unlocks farming. This should come directly from the faction for the
 * planet I unlock, and it should be a nice character in the room on the capital ship tied to resource trade."
 *
 * Every faction capital ship has a Trade Station crewed by the faction's Factor (ship-interior/shipRooms.js). The Factor
 * is one of the faction's existing nine characters: its Neutral (N) one, the character who deals with every side
 * (GDD §11: Quartermaster Ines Roth "counts the powder while they wave flags"). No character is invented.
 *
 * The Factor's desk on a planet (factorDesk):
 *   'gate'  — the planet has a farming contract but farming is shut: the Factor says what is needed (finish the planet)
 *   'offer' — F1 is on offer (contract.js farmOffer): the room marks the Factor; talking opens the scene and the card
 *   'farm'  — the contract is the player's: the Factor talks about the harvest
 *   null    — nothing to say about farming on this planet
 *
 * The scene is the shared one: the Factor's lines through the comm card (comm/dialog.js characterCall), then the
 * contract card (render/contractModal.js) with farmCard's terms, ACCEPT / LATER → acceptFarmContract / declineFarmContract.
 * Talking counts as a greeting (standings.noteRapportEvent 'greet', once a day); accepting adds a 'contract'.
 *
 * Pure: no DOM. Functions change only the save they are given.
 */
import { farmContractOf } from '../data/farm.js';
import { farmOffer, hasFarm, farmingOpen, farmCard, acceptFarmContract } from './contract.js';
import { noteRapportEvent } from '../save/standings.js';

/** The ship room the Factor keeps (shipRooms.js NEUTRAL_ROLE.trade). */
export const FACTOR_ROOM = 'trade';
/** The Factor is the faction's Neutral character (voicepacks.json align). */
export const FACTOR_ALIGN = 'N';

/** A faction's Factor from the voice packs: { name, faction, factionName, phrase, gender } or null. */
export function factorOf(packs, factionKey) {
  const f = packs && packs.factions && packs.factions[factionKey];
  const c = f && (f.characters || []).find((x) => x.align === FACTOR_ALIGN);
  return c ? { name: c.name, faction: factionKey, factionName: f.name, phrase: (c.phrases || [])[0] || '', gender: c.gender } : null;
}

/** What the Factor has for the player on a planet: 'gate' | 'offer' | 'farm' | null (see the header). */
export function factorDesk(s, key) {
  if (!farmContractOf(key, 'F1')) return null;
  if (hasFarm(s, key)) return 'farm';
  if (!farmingOpen(s, key)) return 'gate';
  return farmOffer(s, key) ? 'offer' : null;
}

/** The Trade Station shows its offer flag: F1 is on offer there. */
export const factorFlag = (s, key) => factorDesk(s, key) === 'offer';

/**
 * The Factor's lines for a desk state from reveals.json factionShip.farm: [{ line, intent }]. after: 'accept' | 'later'
 * picks the reply to the card instead. Unknown → [].
 */
export function factorLines(farmLines, key, state, after = null) {
  const set = farmLines && farmLines[key];
  if (!set) return [];
  const pick = after ? set[after] : set[state];
  return (pick || []).map((l) => ({ line: l.line, intent: l.intent || 'statement' }));
}

/** The contract card the Factor hands over: farmCard's terms, with the Factor as the speaker. */
export function factorCard(key, shipName, factor) {
  const card = farmCard(key, shipName);
  if (!card || !factor) return null;
  return { ...card, kicker: 'FARMING CONTRACT — TRADE STATION · ' + String(shipName || '').toUpperCase(), character: { name: factor.name, phrase: factor.phrase } };
}

/** Talking to the Factor is a greeting: +1 to their rating, once a day (standings.js). → counted */
export function noteFactorTalk(s, key, factor, opts = {}) {
  return !!factor && noteRapportEvent(s, factor.name, key, 'greet', opts);
}

/** ACCEPT at the Trade Station: the contract (contract.js), and the deal counts with the Factor. → acceptFarmContract's result */
export function acceptViaFactor(s, key, factor, ctx) {
  const r = acceptFarmContract(s, key, ctx);
  if (!r.error && factor) noteRapportEvent(s, factor.name, key, 'contract', ctx.day ? { day: ctx.day } : {});
  return r;
}
// LATER at the Trade Station is contract.js declineFarmContract itself: the offer stays on the Factor's desk.
