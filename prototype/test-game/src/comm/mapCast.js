/**
 * src/comm/mapCast.js — ONE character per map, a SECONDARY from another faction at wave 3 [MM-story_mwohmm89_2x].
 * Owner 2026-11-19: "instead of meeting a new character on each wave, interact with 1 character per map with the
 * secondary character from another faction appearing at wave 3. We need to simplify the dialog, what we have now is
 * too wordy." Cadence (docs/tech-plan/Character-Secrets.md §5): the primary speaks at the map's start (a newly revealed
 * secret if there is one) and at its end; after wave 3 the secondary speaks once; nothing between the other waves.
 *
 * The cast comes from the faction's characters file (content/characters/<key>.json `maps`); a faction without one
 * rotates its voice-pack cast by map number, and its rival's champion is the secondary. Lines from a characters file
 * are short already; voice-pack lines are cut to their first sentence [MM-story_mwohmn64_2y].
 * Pure except loadCharacterFiles (fetch). Specs go through dialog.js characterCall, the one comm-card path.
 */
import { characterCall } from './dialog.js';
import { untoldSecret } from '../save/secrets.js';
import { FACTION_KEYS } from '../data/factionRelations.js';
import { standingOf, moodChangeOf } from '../save/standings.js';

/** Fetch every faction's characters file that exists. Never throws. → { [factionKey]: file } */
export async function loadCharacterFiles(base = 'content/characters/') {
  const out = {};
  await Promise.all(FACTION_KEYS.map(async (k) => {
    try {
      const r = await fetch(base + k + '.json');
      if (!r.ok) return;
      const f = await r.json();
      if (f && Array.isArray(f.characters)) out[k] = f;
    } catch (e) { /* this faction has no characters file yet */ }
  }));
  return out;
}

/** The first sentence of a long line (voice-pack lines run to three). */
export function firstSentence(line) {
  const t = String(line || '').trim();
  const m = t.match(/^.*?[.!?…](?=\s|$)/);
  return m ? m[0] : t;
}
const intentOf = (line) => (/!$/.test(line) ? 'exclaim' : /\?$/.test(line) ? 'question' : /…$/.test(line) ? 'trail' : 'statement');
const say = (line) => (line ? { line, intent: intentOf(line) } : null);

const packFaction = (packs, key) => (packs && packs.factions && packs.factions[key]) || null;
const champion = (chars) => (chars || []).find((c) => c.align === 'PE') || (chars || [])[0] || null;
/** The character's entry in a characters file, or null. */
export function characterEntry(files, factionKey, name) {
  const f = files && files[factionKey];
  return (f && f.characters.find((c) => c.name === name)) || null;
}

/**
 * Who speaks on this map. factionKey: the planet's faction (registry key); mapId: the map number on that planet;
 * rivalKey: the faction's rival (registry key) for the fallback secondary.
 * → { factionKey, primary: { name, faction }, secondary: { name, faction, line } } | null
 */
export function mapCast(files, packs, factionKey, mapId, rivalKey = null) {
  const n = Math.max(1, mapId | 0);
  const authored = files && files[factionKey] && files[factionKey].maps && files[factionKey].maps[String(n)];
  if (authored && authored.primary) {
    return { factionKey, primary: { name: authored.primary, faction: factionKey },
      secondary: authored.secondary ? { name: authored.secondary.name, faction: authored.secondary.faction, line: authored.secondary.line || null } : null };
  }
  const fac = packFaction(packs, factionKey);
  if (!fac || !fac.characters.length) return null;
  const p = fac.characters[(n - 1) % fac.characters.length];
  const rk = rivalKey && rivalKey !== factionKey ? rivalKey : FACTION_KEYS.find((k) => k !== factionKey && packFaction(packs, k));
  const rc = champion((packFaction(packs, rk) || {}).characters);
  return { factionKey, primary: { name: p.name, faction: factionKey },
    secondary: rc ? { name: rc.name, faction: rk, line: (rc.phrases && rc.phrases[0]) || null } : null };
}

/**
 * The primary's opening at the map's start: a newly revealed secret, told in person, else their start line.
 * → { spec, secret } (secret: the told secret, for noteSecretTold) | null
 */
export function openingCall(cast, files, packs, s, factionName = null) {
  if (!cast || !cast.primary) return null;
  const ch = characterEntry(files, cast.primary.faction, cast.primary.name);
  if (ch) {
    const secret = untoldSecret(ch, s, factionName);
    const line = secret ? secret.line : (ch.lines && ch.lines.start);
    const spec = characterCall(packs, cast.primary.faction, ch.name, say(line), secret ? 'SECRET' : 'CHALLENGE');
    return spec ? { spec, secret } : null;
  }
  const pc = (packFaction(packs, cast.primary.faction) || { characters: [] }).characters.find((c) => c.name === cast.primary.name);
  const m0 = pc && pc.lines && pc.lines.m0;
  const spec = m0 ? characterCall(packs, cast.primary.faction, pc.name, say(firstSentence(m0.line)), 'CHALLENGE') : null;
  return spec ? { spec, secret: null } : null;
}

/** The secondary's one line after wave 3. → spec | null */
export function secondaryCall(cast, packs) {
  const sc = cast && cast.secondary;
  if (!sc || !sc.line) return null;
  return characterCall(packs, sc.faction, sc.name, say(sc.line), 'INTERCEPT');
}

/** The primary's last word: 'win' (the player won) or 'lose'. → spec | null */
export function closingCall(cast, files, packs, result) {
  if (!cast || !cast.primary) return null;
  const ch = characterEntry(files, cast.primary.faction, cast.primary.name);
  const key = result === 'win' ? 'win' : 'lose';
  if (ch && ch.lines && ch.lines[key]) return characterCall(packs, cast.primary.faction, ch.name, say(ch.lines[key]), result === 'win' ? 'CONCESSION' : 'VERDICT');
  const pc = (packFaction(packs, cast.primary.faction) || { characters: [] }).characters.find((c) => c.name === cast.primary.name);
  const l = pc && pc.lines && (result === 'win' ? pc.lines.winEfficient : pc.lines.defeat);
  return l ? characterCall(packs, cast.primary.faction, pc.name, say(firstSentence(l.line)), result === 'win' ? 'CONCESSION' : 'VERDICT') : null;
}

/**
 * A call with its speaker's relationship portrait (antagonistic / neutral / friendly) from the player's rating with them
 * and any mood shift, and moodChange ('up' hearts / 'down' bolts) when it differs from the portrait the player last saw
 * [MM-story_mwpni0v4_3m]. → the call (unchanged when it has no speaker)
 */
export function withMood(call, s) {
  if (!call || !call.name) return call;
  try {
    const mood = standingOf(s, call.name).mood;
    return { ...call, mood, moodChange: moodChangeOf(s, call.name, mood) };
  } catch (e) { return call; }
}

/** The wave whose clear brings the secondary in (owner: "appearing at wave 3"). */
export const SECONDARY_AFTER_WAVE = 3;
