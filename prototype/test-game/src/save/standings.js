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
 * still holds. Owner 2026-11-09 adds the everyday dealings (RAPPORT_GAIN, noteRapportEvent):
 *   "greeting the player on a ship visit is +1"            → the ship's captain (shipReveal.js); "greeting limit is
 *                                                              1 per day": the +1 counts once per local day per
 *                                                              character (the captain still greets on every visit)
 *   "selling items or purchasing items from character improve score"
 *                                                            → SELL at an outpost: the planet ship's captain buys
 *                                                              (outpost/view/session.js); a rare contract that sold
 *                                                              something: the ship's contact (main.js); a purchase from
 *                                                              a character: 'purchase' (no character sells yet)
 * Each band also picks the character's portrait expression (moodFor: angry, neutral, happy).
 *
 * Factions: the loyalty ledger that already exists (s.loyalty by faction name, contracts.addLoyalty) and its tiers
 * (LOYALTY_TIERS: 100 / 260 / 520).
 *
 *   s.rapport = { [characterName]: { score, kept, broken, faction, greets?, sales?, purchases?, greetDay? } }   s.rapportBackfilled = true
 * Pure: no DOM.
 */
import { LOYALTY_TIERS, rivalOf } from './contracts.js';
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;

export const KEPT = 25, BROKEN = -45, ABANDONED = -30;
/** The everyday dealings (owner 2026-11-09: a greeting is +1; selling to or buying from a character raises it). */
export const RAPPORT_GAIN = Object.freeze({ greet: 1, sale: 1, purchase: 1 });
const COUNTER = Object.freeze({ greet: 'greets', sale: 'sales', purchase: 'purchases' });
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

/** The player's local calendar day, 'YYYY-MM-DD' (the greeting limit's day). */
export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * A greeting, sale or purchase with a character: + RAPPORT_GAIN[kind]. faction: the registry key. A greeting counts
 * once per day per character (owner 2026-11-09: "greeting limit is 1 per day"); day defaults to the local day.
 * → true when it counted.
 */
export function noteRapportEvent(s, name, faction, kind, { day = localDay() } = {}) {
  if (!s || !name || !RAPPORT_GAIN[kind]) return false;
  const book = s.rapport || (s.rapport = {});
  const r = book[name] || (book[name] = { score: 0, kept: 0, broken: 0, faction: faction || null });
  if (kind === 'greet') { if (r.greetDay === day) return false; r.greetDay = day; }
  r.score += RAPPORT_GAIN[kind];
  r[COUNTER[kind]] = (r[COUNTER[kind]] || 0) + 1;
  return true;
}

/** The captain of a planet's capital ship (mission catalog capitalShips, keyed by planet name), or null. */
export function captainOf(catalog, planetName) {
  const cs = catalog && catalog.capitalShips && catalog.capitalShips[planetName];
  return (cs && cs.captain) || null;
}

/** Has the player dealt with this character at all? */
export const hasMet = (r) => !!(r && (r.kept || r.broken || r.greets || r.sales || r.purchases));

/** The portrait expression a rating shows: angry when wary or worse, happy when friendly or better. */
export function moodFor(bandKey) {
  if (bandKey === 'hostile' || bandKey === 'wary') return 'angry';
  if (bandKey === 'friendly' || bandKey === 'trusted' || bandKey === 'allied') return 'happy';
  return 'neutral';
}

/** A character's rating band and mood from the save. → { band, mood } */
export function standingOf(s, name) {
  const r = s && s.rapport && s.rapport[name], met = hasMet(r), band = rapportBand(r ? r.score : 0, met);
  return { band, mood: moodFor(band.key) };
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
      const r = book[c.name] || null, met = hasMet(r);
      const score = r ? r.score : 0, band = rapportBand(score, met);
      return { name: c.name, align: c.align, motivation: c.motivation || '', score, kept: r ? r.kept : 0, broken: r ? r.broken : 0,
        greets: (r && r.greets) || 0, sales: (r && r.sales) || 0, purchases: (r && r.purchases) || 0, met, band, mood: moodFor(band.key) };
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
      metCount: cast.filter((c) => hasMet(book[c.name])).length, castCount: cast.length,
    };
  });
}

export { LOYALTY_TIERS };
