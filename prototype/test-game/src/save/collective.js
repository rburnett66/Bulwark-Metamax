/**
 * src/save/collective.js — the Collective opening's save state [MM-story_mw47lq0l_7].
 *
 * Tech plan: Collective-Opening.md §2 (save / missionFlow): `collective.{introSeen, contractAccepted, transport}`,
 * milestone resume, existing saves marked seen. Pure functions on a save object (node-tested); the menu and the
 * intro runner call them through save.js loadSave / updateSave.
 *
 *   collectiveOf(s)          → s.collective, filled in (an old save that has played counts as having seen the intro)
 *   needsIntro(s)            → true for a new save whose player has not accepted the first contract
 *   resumeBeat(s)            → 'start' | 'transport' | null (null: nothing to resume)
 *   acceptFirstContract(s, { transport }) → s   (ACCEPT on the contract card: the intro counts as seen from here)
 */

export const FIRST_CONTRACT = Object.freeze({ planet: 'ground', mapId: 1 });
export const DEFAULT_TRANSPORT = 'hauler';

/** The `collective` block, created on first read. A save that already has battles or map results predates the
 *  opening: it is marked seen so a returning player is not sent through it (they can replay it from Settings). */
export function collectiveOf(s) {
  if (!s.collective || typeof s.collective !== 'object') {
    const played = !!((s.progress && s.progress.battles > 0) || (s.maps && Object.keys(s.maps).length));
    s.collective = { introSeen: played, contractAccepted: played, transport: played ? DEFAULT_TRANSPORT : null, seenBefore: played };
    if (played) s.collective.launched = true;
  }
  const c = s.collective;
  if (typeof c.introSeen !== 'boolean') c.introSeen = false;
  if (typeof c.contractAccepted !== 'boolean') c.contractAccepted = false;
  if (c.transport === undefined) c.transport = null;
  return c;
}

/** Should the game open on the intro? Only a save that has never accepted the first contract. */
export function needsIntro(s) {
  return !collectiveOf(s).introSeen;
}

/** Where a first-run intro picks up after a reload: from the start, or (contract accepted, never launched) at the
 *  Loading Bay. A finished intro resumes nothing. */
export function resumeBeat(s) {
  const c = collectiveOf(s);
  if (c.launched || (c.introSeen && !c.contractAccepted)) return null;
  if (c.contractAccepted && !c.launched) return 'transport';
  return c.introSeen ? null : 'start';
}

/** ACCEPT on the first contract card: the contract and the transport are the player's; the intro counts as seen. */
export function acceptFirstContract(s, { transport = DEFAULT_TRANSPORT } = {}) {
  const c = collectiveOf(s);
  c.contractAccepted = true; c.introSeen = true; c.transport = transport;
  return s;
}

/** The transport launched for Verdance: the intro is complete. */
export function markLaunched(s) {
  const c = collectiveOf(s);
  c.launched = true; c.introSeen = true;
  return s;
}
