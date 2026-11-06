/**
 * src/save/reveals.js — which planets are surveyed, and which reveals are due [MM-story_mw56v5hu_2].
 *
 * Tech plan: docs/tech-plan/Content-Reveal.md §4. Owner 2026-11-06:
 *   "New planets get introduced after the player completes an objective … When the player returns to the menu
 *    triggers the new content presentation" · "when you unlock a planet, and return to the menu the players transport
 *    ship surveys the new planet" · "Undiscovered planets should not be dimmed, but they may be 'unsurveyed'" ·
 *   "Once a player completes Map 3 at 3 stars or better the capital ship arrives for that faction".
 *
 * The queue is DERIVED from the save, never pushed by events, so it is idempotent and covers saves made before this
 * existed (a planet whose predecessor's map 3 is already beaten is due; a ship that arrived without a reveal is due):
 *   planet reveal due  ⇔ the previous planet's map 3 is beaten and the planet is not surveyed
 *   ship reveal due    ⇔ capitalShips[planet].arrived and the ship's first sight has not played
 * Planets play first (in campaign order), then ships. The testing switch that opens every planet for play
 * (techSave.ALL_PLANETS_OPEN) does not touch any of this, so reveals can be seen while every planet stays playable.
 *
 *   s.reveals = { surveyed: { ground: true, … }, shipSeen: { ground: true, … } }
 * Pure: no DOM, no clock.
 */
import { PLANETS } from '../data/planets.js';

/** Campaign order (Verdance → Vexmire): the planet index the unlock chain walks. */
export const PLANET_ORDER = Object.freeze(Object.keys(PLANETS));
/** The map whose win surveys the next planet (Q2 default: the same win that opens its portal, Mission-Log §11). */
export const SURVEY_MAP = 3;

/** Make sure s.reveals exists; an old save keeps every planet it has already played as surveyed. → s */
export function ensureReveals(s) {
  const r = s.reveals || (s.reveals = {});
  if (!r.surveyed || typeof r.surveyed !== 'object') r.surveyed = {};
  if (!r.shipSeen || typeof r.shipSeen !== 'object') r.shipSeen = {};
  for (const key of PLANET_ORDER) {
    const maps = rec(s.planetMaps, key);
    if (maps && Object.keys(maps).length) r.surveyed[key] = true;   // already fought there: no survey owed
  }
  return s;
}

export const isSurveyed = (s, key) => !!(s.reveals && s.reveals.surveyed && s.reveals.surveyed[key]);
// the save keys planetMaps and capitalShips by planet NAME (missionFlow.recordPlanetMap: "Verdance"); reveals by key
const rec = (o, key) => (o || {})[(PLANETS[key] || {}).name] || (o || {})[key] || null;
const map3Beaten = (s, key) => !!((rec(s.planetMaps, key) || {})[SURVEY_MAP] || {}).beaten;
export const shipArrived = (s, key) => !!(rec(s.capitalShips, key) || {}).arrived;

/** The reveals due now, in play order: [{ kind:'planet', planet }…, { kind:'ship', planet }…]. Read-only. */
export function revealsDue(s) {
  const r = (s.reveals || {}), surveyed = r.surveyed || {}, seen = r.shipSeen || {};
  const out = [];
  // Verdance: the transport surveys it when it leaves the Long Ledger (owner Q5 2026-11-06: "you survey Verdance")
  const left = !!(s.collective && (s.collective.launched || s.collective.departed));
  PLANET_ORDER.forEach((key, i) => {
    const owed = i === 0 ? left : map3Beaten(s, PLANET_ORDER[i - 1]);
    if (!surveyed[key] && owed) out.push({ kind: 'planet', planet: key });
  });
  for (const key of PLANET_ORDER) if (shipArrived(s, key) && !seen[key]) out.push({ kind: 'ship', planet: key });
  return out;
}

/** The commit beats (plan §4.3): the survey locked a site / the ship's title card showed. → s */
export function markSurveyed(s, key) { ensureReveals(s).reveals.surveyed[key] = true; return s; }
export function markShipSeen(s, key) { ensureReveals(s).reveals.shipSeen[key] = true; return s; }

/** Reveals that became due between two saves (for the results screen's "New signal" lines). */
export function newlyDue(before, after) {
  const k = (x) => x.kind + ':' + x.planet, had = new Set(revealsDue(before).map(k));
  return revealsDue(after).filter((x) => !had.has(k(x)));
}

/** The results-screen line for a reveal that just became due. */
export function revealLine(item, shipName) {
  const P = PLANETS[item.planet];
  return item.kind === 'planet'
    ? `New signal — ${P ? P.name : item.planet} discovered. Your transport will survey it.`
    : `${shipName || 'A capital ship'} is inbound to ${P ? P.name : item.planet}.`;
}
