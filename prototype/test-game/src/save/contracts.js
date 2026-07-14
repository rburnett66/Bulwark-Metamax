/**
 * src/save/contracts.js — the QUEST CONTRACT system (owner design + workbook Quest_Contract).
 *
 * Every campaign map's quest-giver FACTION sends a CHARACTER (from the 81-hero alignment matrix
 * in the voicepacks) offering a contract: haul the quest crystals seeded beyond the front.
 *
 *   ACCEPT & FULFIL  → giver +Loyalty_Per_Node×nodes (scaled by haul), rival −50% of the gain,
 *                      and the player's ALIGNMENT moves toward the character's — finishing an
 *                      evil character's task makes you more evil, a good one's more good (owner).
 *   ACCEPT & FAIL    → partial gain − Broken_Promise_Penalty (can net NEGATIVE), rival −50% of
 *                      the partial. Worse than never taking it — overpromising must sting.
 *   DECLINE          → giver −Decline_Cost, rival +50% of it. Free tempo; a made enemy.
 *
 * All effects are SAVE-side (loyalty ledger, alignment, tech tiers) — the sim stays pure; the
 * battle only counts hauled quest crystals (mapScore.questRed/questGreen), which this module
 * judges at match end.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';
import { updateSave } from './save.js';

export const FACTION_NAMES = ['Ground / Powder', 'Air', 'High Tech', 'Artillery', 'Water',
  'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)'];

/** The 9-step alignment axis, absolute good (+4) to dark evil (−4). */
export const ALIGN_SCORE = { AG: 4, PG: 3, G: 2, CG: 1, N: 0, CE: -1, E: -2, PE: -3, DE: -4 };
export function alignWord(score) {
  if (score >= 2) return 'GOOD';
  if (score <= -2) return 'EVIL';
  if (score === 0) return 'NEUTRAL';
  return score > 0 ? 'LEANS GOOD' : 'LEANS EVIL';
}

const GP = MAPDATA.globalParams;
const LOYALTY_PER_NODE = GP.Loyalty_Per_Node || 10;
const DECLINE_COST = GP.Decline_Cost || 30;
const DECLINE_RIVAL_GAIN = GP.Decline_Rival_Gain != null ? GP.Decline_Rival_Gain : 0.5;
const BROKEN_PENALTY = GP.Broken_Promise_Penalty || 45;
const TECH_AT = [GP.Tech_T1_Threshold || 100, GP.Tech_T2_Threshold || 260, GP.Tech_T3_Threshold || 520];
const FULFIL_FRACTION = 0.8;   // hauled >= 80% of the quest units = kept your word

function factionRow(fid) { return MAPDATA.factions.find((f) => f.Faction_ID === fid) || null; }

/** Build the contract OFFER for a map (null when the map seeds no quest nodes — maps 1-2).
 *  Character rotates through the giver's 9-hero cast with each contract you've ever been
 *  offered, so the good and evil voices take turns asking. */
export function buildOffer(mapId, map, voicePacks, save) {
  const row = MAPDATA.maps.find((r) => r.Map_ID === mapId);
  if (!row || !row.Quest_Giver_Faction) return null;
  const questNodes = (map.resources || []).filter((r) => r.role === 'quest');
  if (!questNodes.length) return null;
  const giverId = row.Quest_Giver_Faction;
  const giver = FACTION_NAMES[giverId - 1];
  const frow = factionRow(giverId);
  const rival = frow && frow.Rival_Faction ? FACTION_NAMES[frow.Rival_Faction - 1] : null;
  const cast = voicePacks && voicePacks.factions && voicePacks.factions[giver]
    ? voicePacks.factions[giver].characters : null;
  const offered = Object.values((save && save.maps) || {}).filter((m) => m.contract).length;
  const character = cast && cast.length ? cast[(mapId * 3 + offered) % cast.length] : null;
  const gainMax = LOYALTY_PER_NODE * questNodes.length;
  return {
    mapId, giver, giverId, rival,
    character: character ? { name: character.name, align: character.align, phrase: (character.phrases || [])[0] || '' } : null,
    alignScore: character ? (ALIGN_SCORE[character.align] || 0) : 0,
    nodes: questNodes.length,
    unitsTotal: questNodes.reduce((a, n) => a + (n.units || 0), 0),
    gainMax,
    declineCost: DECLINE_COST,
    state: 'OFFERED',
  };
}

function addLoyalty(s, faction, delta) {
  if (!faction || !delta) return;
  const l = (s.loyalty || (s.loyalty = {}));
  l[faction] = (l[faction] || 0) + delta;
  // tech tiers are CUMULATIVE loyalty thresholds (workbook): recompute, never revoke
  const t = (s.tech || (s.tech = {}));
  let tier = t[faction] || 0;
  while (tier < 3 && l[faction] >= TECH_AT[tier]) tier++;
  t[faction] = tier;
}

/** DECLINE — applied immediately, before the battle. */
export function applyDecline(offer) {
  return updateSave((s) => {
    addLoyalty(s, offer.giver, -DECLINE_COST);
    if (offer.rival) addLoyalty(s, offer.rival, Math.round(DECLINE_COST * DECLINE_RIVAL_GAIN));
    const m = s.maps[offer.mapId] || (s.maps[offer.mapId] = { beaten: false, bestScore: null, stars: null, avg: null, contract: null });
    m.contract = 'DECLINED';
  });
}

/** ACCEPT — recorded now; judged at match end by judgeContract. */
export function applyAccept(offer) {
  return updateSave((s) => {
    const m = s.maps[offer.mapId] || (s.maps[offer.mapId] = { beaten: false, bestScore: null, stars: null, avg: null, contract: null });
    m.contract = 'ACCEPTED';
  });
}

/** Match over: judge an ACCEPTED contract from the battle's hauled quest units.
 *  Returns {outcome, gain, alignShift} for the result screen. */
export function judgeContract(offer, hauledUnits, won) {
  const frac = offer.unitsTotal > 0 ? Math.max(0, Math.min(1, hauledUnits / offer.unitsTotal)) : 0;
  const fulfilled = won && frac >= FULFIL_FRACTION;
  let gain, alignShift = 0;
  if (fulfilled) {
    gain = Math.round(offer.gainMax * frac);
    alignShift = offer.alignScore * 2;   // finishing an evil hero's task makes you more evil (owner)
  } else {
    gain = Math.round(offer.gainMax * frac * 0.5) - BROKEN_PENALTY;   // partial − penalty; can be negative
  }
  updateSave((s) => {
    addLoyalty(s, offer.giver, gain);
    if (offer.rival && gain > 0) addLoyalty(s, offer.rival, -Math.round(gain * 0.5));
    if (alignShift) s.alignment = (s.alignment || 0) + alignShift;
    const m = s.maps[offer.mapId] || (s.maps[offer.mapId] = { beaten: false, bestScore: null, stars: null, avg: null, contract: null });
    m.contract = fulfilled ? 'FULFILLED' : 'BROKEN';
  });
  return { outcome: fulfilled ? 'FULFILLED' : 'BROKEN', gain, alignShift };
}
