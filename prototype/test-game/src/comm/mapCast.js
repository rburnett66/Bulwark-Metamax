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
import { untoldSecret, noteSecretTold } from '../save/secrets.js';
import { rumourFrom, rumoursFor, noteRumour, ownerTells, REACTIONS } from '../save/rumours.js';
import { tellsFor } from './tells.js';
import { shortName } from './shortName.js';
import { FACTION_KEYS } from '../data/factionRelations.js';
import { standingOf, moodChangeOf } from '../save/standings.js';

/** Fetch the drama threads (content/characters/threads.json). Never throws. → { threads: [] } */
export async function loadThreads(url = 'content/characters/threads.json') {
  try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* none yet */ }
  return { threads: [] };
}

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
 * The primary's opening at the map's start: their start line. Secrets are told aboard the faction's capital ship
 * (owner 2026-11-21: "Secrets should usually be delivered at the capital ships"; aboardSecretCalls).
 * → { spec, secret: null } | null
 */
export function openingCall(cast, files, packs, s, factionName = null) {
  if (!cast || !cast.primary) return null;
  const ch = characterEntry(files, cast.primary.faction, cast.primary.name);
  if (ch) {
    const spec = characterCall(packs, cast.primary.faction, ch.name, say(ch.lines && ch.lines.start), 'CHALLENGE');
    return spec ? { spec, secret: null } : null;
  }
  const pc = (packFaction(packs, cast.primary.faction) || { characters: [] }).characters.find((c) => c.name === cast.primary.name);
  const m0 = pc && pc.lines && pc.lines.m0;
  const spec = m0 ? characterCall(packs, cast.primary.faction, pc.name, say(firstSentence(m0.line)), 'CHALLENGE') : null;
  return spec ? { spec, secret: null } : null;
}

/**
 * Aboard a faction's capital ship: the characters of that faction with a newly unlocked secret come forward and tell it,
 * in the faction's own order, at most `limit` per visit [MM-story_mwpsuo5b_3x]. Owner 2026-11-21: "Secrets should usually
 * be delivered at the capital ships." → [{ spec, name, secret }] (noteSecretTold each one once it is shown)
 */
export function aboardSecretCalls(files, packs, factionKey, s, factionName = null, limit = 3) {
  const file = files && files[factionKey];
  if (!file) return [];
  const out = [];
  for (const ch of file.characters) {
    if (out.length >= limit) break;
    const secret = untoldSecret(ch, s, factionName);
    if (!secret) continue;
    const spec = characterCall(packs, factionKey, ch.name, say(secret.line), 'SECRET');
    if (spec) out.push({ spec, name: ch.name, secret });
  }
  return out;
}

const PRONOUN_START = /^(He|She|It|They|His|Her|Its|Their|My|Our)\b/;
/** The clean line a teller says about someone: "About Otto: he wants Petal Silk, …". */
export function rumourLine(owner, text) {
  const t = String(text || '');
  return `About ${shortName(owner)}: ${PRONOUN_START.test(t) ? t.replace(/^./, (m) => m.toLowerCase()) : t}`;
}

/**
 * The scene aboard a faction's capital ship (Character-System §7.1, owner 2026-11-21: "Secrets should usually be
 * delivered at the capital ships") [MM-story_mwp61bjm_33]: up to `limit` of the faction's characters speak. One with a
 * newly unlocked secret tells it (and if the player had heard it as a rumour, they react, §7.5); one with nothing new
 * of their own passes on a rumour about someone they know, in their own voice with its tells (§7.4).
 * model: characterModel buildModel(...). → { calls: [spec], commit(save) } — commit records it all in a save.
 */
export function aboardScene(model, files, packs, factionKey, s, factionName = null, limit = 3) {
  const file = files && files[factionKey];
  if (!file) return { calls: [], commit: () => {} };
  const calls = [], ops = [];
  for (const ch of file.characters) {
    if (calls.length >= limit) break;
    const told = untoldSecret(ch, s, factionName);
    if (told) {
      const spec = characterCall(packs, factionKey, ch.name, say(told.line), 'SECRET');
      if (!spec) continue;
      calls.push(spec);
      const raw = (ch.secrets || []).find((x) => x.key === told.key) || told;
      const heard = rumoursFor(s, ch.name).some((r) => r.key === told.key);
      const react = heard && REACTIONS[raw.guard];
      if (react) { const r = characterCall(packs, factionKey, ch.name, say(react.line), 'SECRET'); if (r) calls.push(r); }
      ops.push((sv) => { noteSecretTold(sv, ch.name, told); if (heard) ownerTells(model, sv, ch.name, raw); });
      continue;
    }
    const r = model ? rumourFrom(model, files, ch.name, s) : null;
    if (!r) continue;
    const flaw = model.flawsOf(ch.name)[0] || null;
    const line = tellsFor(rumourLine(r.owner, r.text), { credibility: r.credibility, version: r.version,
      personality: model.personalityOf(ch.name).personality, flaw, seed: `${ch.name}|${r.owner}|${r.key}` });
    const spec = characterCall(packs, factionKey, ch.name, say(line), 'RUMOUR');
    if (!spec) continue;
    calls.push(spec);
    ops.push((sv) => noteRumour(sv, r));
  }
  return { calls, commit: (sv) => { for (const op of ops) op(sv); } };
}

/** The secondary's one line after wave 3: they introduce themselves (and, when it is earned, offer the contract). → spec | null */
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

// ── the wave-3 contract offer as a dialog [MM-story_mwpzbj5c_45] ───────────────────────────────────────────────────────
// Owner 2026-11-21: "The contract offers on Wave should be presented as character dialogs since they are often
// introductions of new characters." · "I hear you are resource gathering on Florael" · "I'm Chelsea from (faction) and if
// you can deliver some elder root we will pay, it's always good to have friends in high places."

/** The faction as it is spoken: "the Ground fleet", "the Greenies fleet" (the registry name up to its " / " or " ("). */
export const spokenFleet = (factionName) => `the ${String(factionName || '').split(/\s*[/(]/)[0].trim()} fleet`;

/** How a character closes an offer, by personality (character files; the six of Character-System §3). */
const OFFER_CLOSER = {
  'open-hearted': "It's always good to have friends in high places.",
  devoted: "Do this for us and we'll remember it.",
  wary: 'Keep it quiet, and keep it coming.',
  schemer: 'Friends in high places are worth more than gold. Remember who asked.',
  cruel: "Don't make me regret asking.",
  whimsical: 'Think of it as a little adventure. With pay.',
};
const OFFER_REPLY = {
  accept: { good: "Good. We'll be watching for it.", neutral: 'Done, then. Bring it in.', evil: "Good. Don't be late." },
  decline: { good: 'Your call. Maybe another time.', neutral: "Your loss. Offers like this don't wait.", evil: 'Remember you said no.' },
};
const leaning = (align) => (/G$/.test(align || '') ? 'good' : /E$/.test(align || '') ? 'evil' : 'neutral');

/**
 * The offer scene: the contact introduces themselves and makes the offer in their own voice, the player chooses, the
 * contact answers. o: { factionKey (the buyer's), name (the contact), factionName, planetName (where the player is),
 * rareName, quota, price, personality, flavour (their own line, said last, or null) }.
 * → { calls: [intro, offer], replies: { accept, decline }, after: [flavour] } — comm.playScene's calls and options.
 */
export function contractOfferScene(packs, o) {
  const pc = (packFaction(packs, o.factionKey) || { characters: [] }).characters.find((c) => c.name === o.name) || {};
  const sub = 'CONTRACT OFFER';
  const line = (text) => characterCall(packs, o.factionKey, o.name, say(text), sub);
  const closer = OFFER_CLOSER[o.personality] || OFFER_CLOSER['open-hearted'];
  const intro = line(`I hear you're gathering resources on ${o.planetName}.`);
  const offer = line(`I'm ${shortName(o.name)}, from ${spokenFleet(o.factionName)}. If you can deliver some ${o.rareName}, we will pay: ${o.price} gold each, up to ${o.quota}. ${closer}`);
  const lean = leaning(pc.align);
  return {
    calls: [intro, offer].filter(Boolean),
    replies: { accept: line(OFFER_REPLY.accept[lean]), decline: line(OFFER_REPLY.decline[lean]) },
    after: o.flavour ? [line(o.flavour)].filter(Boolean) : [],
  };
}
