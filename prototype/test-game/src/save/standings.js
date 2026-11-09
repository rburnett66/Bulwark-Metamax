/**
 * src/save/standings.js — the player's standing with every character and faction, shown aboard a capital ship
 * [MM-task_mw9nm69a_3]. Owner 2026-11-09: "when a player is on a capital ship there should be a button that allow them
 * to see a list of all faction characters and show the players rating with them, on this same view there should be a
 * faction tab that shows the players relationship with each faction. So players need to visit capital ships to see
 * this view."
 *
 * Characters: the 81 heroes of the voice packs (9 per faction). A character's RATING is a ledger of how the player
 * treated the missions that character gave (missions carry giver.name):
 *   kept (collected)  → + the mission's planet loyalty (impact.loyaltyPlanet), default KEPT
 *   broken (failed)   → the mission's broken-promise penalty (impact.brokenPenalty), default BROKEN
 *   abandoned         → ABANDONED (the decline cost)
 * It is written at the one place a mission ends (missions.js endMission → noteRapport) and kept in s.rapport, so a
 * failed mission dismissed from the log still counts. ensureRapport backfills an old save once from the missions it
 * still holds.
 *
 * Factions: the loyalty ledger that already exists (s.loyalty by faction name, contracts.addLoyalty) and its tiers
 * (LOYALTY_TIERS: 100 / 260 / 520).
 *
 *   s.rapport = { [characterName]: { score, kept, broken, faction } }   s.rapportBackfilled = true
 * Pure: no DOM.
 */
import { LOYALTY_TIERS, rivalOf } from './contracts.js';
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;

export const KEPT = 25, BROKEN = -45, ABANDONED = -30;
const ABANDON_REASON = /abandon/i;

/** The change a mission's end makes to its giver's rating. */
export function rapportDelta(m, end, reason) {
  const imp = m.impact || {};
  if (end === 'done') return imp.loyaltyPlanet > 0 ? imp.loyaltyPlanet : KEPT;
  if (end === 'failed') return ABANDON_REASON.test(reason || '') ? ABANDONED : (imp.brokenPenalty < 0 ? imp.brokenPenalty : BROKEN);
  return 0;
}

/** Record a mission's end against its giver (missions.js endMission calls this). */
export function noteRapport(s, m, end, reason) {
  const g = m && m.giver;
  if (!g || !g.name || (end !== 'done' && end !== 'failed')) return;
  const book = s.rapport || (s.rapport = {});
  const r = book[g.name] || (book[g.name] = { score: 0, kept: 0, broken: 0, faction: g.faction || null });
  r.score += rapportDelta(m, end, reason);
  if (end === 'done') r.kept++; else r.broken++;
}

/** Old saves: build the ledger once from the ended missions still in the log. → s */
export function ensureRapport(s) {
  if (s.rapportBackfilled) return s;
  if (!s.rapport) s.rapport = {};
  if (!Object.keys(s.rapport).length) for (const m of s.missions || []) if (m.end) noteRapport(s, m, m.end, m.endReason);
  s.rapportBackfilled = true;
  return s;
}

/** A character's rating band. met: the player has dealt with them (any mission ended). */
export function rapportBand(score, met) {
  if (!met) return { key: 'unmet', label: 'Not met' };
  if (score >= 60) return { key: 'trusted', label: 'Trusted' };
  if (score >= 20) return { key: 'friendly', label: 'Friendly' };
  if (score > -20) return { key: 'neutral', label: 'Neutral' };
  if (score > -60) return { key: 'wary', label: 'Wary' };
  return { key: 'hostile', label: 'Hostile' };
}

/** A faction's relationship band from its loyalty and tier. */
export function factionBand(loyalty, tier) {
  if (tier >= 1) return { key: 'allied', label: `Allied · Tier ${tier}` };
  if (loyalty <= -60) return { key: 'hostile', label: 'Hostile' };
  if (loyalty < 0) return { key: 'wary', label: 'Wary' };
  if (loyalty > 0) return { key: 'friendly', label: 'Friendly' };
  return { key: 'neutral', label: 'Neutral' };
}

/** The nine factions in the registry's order: [{ key, name }]. */
const factions = () => REG.COMBAT_FACTIONS.map((f) => ({ key: f.key, name: f.name }));

/**
 * Every character, grouped by faction: [{ key, name, trope, characters: [{ name, align, motivation, score, kept,
 * broken, met, band }] }]. packs: content/dialog/voicepacks.json.
 */
export function characterStandings(s, packs) {
  const book = (s && s.rapport) || {};
  const byKey = (packs && packs.factions) || {};
  return factions().filter((f) => byKey[f.key]).map((f) => ({
    key: f.key, name: f.name, trope: byKey[f.key].trope || '',
    characters: (byKey[f.key].characters || []).map((c) => {
      const r = book[c.name] || null, met = !!(r && (r.kept || r.broken));
      const score = r ? r.score : 0;
      return { name: c.name, align: c.align, motivation: c.motivation || '', score, kept: r ? r.kept : 0, broken: r ? r.broken : 0, met, band: rapportBand(score, met) };
    }),
  }));
}

/** Every faction's relationship: [{ key, name, loyalty, tier, next, prev, band, rival, metCount }]. */
export function factionStandings(s, packs = null) {
  const loyalty = (s && s.loyalty) || {}, tiers = (s && s.factionTiers) || {}, book = (s && s.rapport) || {};
  return factions().map((f) => {
    const l = loyalty[f.name] || 0, tier = tiers[f.name] || 0;
    const cast = packs && packs.factions && packs.factions[f.key] ? packs.factions[f.key].characters || [] : [];
    return {
      key: f.key, name: f.name, loyalty: l, tier,
      prev: tier > 0 ? LOYALTY_TIERS[tier - 1] : 0, next: tier < LOYALTY_TIERS.length ? LOYALTY_TIERS[tier] : null,
      band: factionBand(l, tier), rival: rivalOf(f.name),
      metCount: cast.filter((c) => book[c.name] && (book[c.name].kept || book[c.name].broken)).length, castCount: cast.length,
    };
  });
}

export { LOYALTY_TIERS };
