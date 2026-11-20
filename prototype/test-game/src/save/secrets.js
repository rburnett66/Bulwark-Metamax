/**
 * src/save/secrets.js — a character's nine secrets, revealed as the player's rapport with them rises
 * [MM-story_mwohmk85_2v]. Owner 2026-11-19: "The secrets are revealed as friendship increases. But the order will
 * change for each character … [characters] intentionally hide truth for a variety of reasons .. shame, fear, loyalty,
 * control, love … Whimsical characters could share magic quickly while evil character share secrets or lies to
 * manipulate." Rules: docs/tech-plan/Character-Secrets.md §4.
 *
 * A character (content/characters/<faction>.json) lists its secrets in its OWN reveal order. The nth needs rapport ≥
 * SECRET_STEPS[n]; a guard adds a condition, and a guarded secret not yet earned is HELD BACK while the ones after it
 * can still come out; a secret with a `lie` shows the lie first and the truth once rapport ≥ lie.until.
 * Rapport is save/standings.js's ledger (s.rapport[name].score). Pure: no DOM.
 */
import { hasMet } from './standings.js';

export const SECRET_KEYS = Object.freeze(['love', 'hate', 'want', 'share', 'desire', 'treasure', 'sorrow', 'magic', 'sense']);
export const SECRET_LABEL = Object.freeze({
  love: 'Who they love', hate: 'Who they hate', want: 'What they want', share: 'What they share', desire: 'Secret desire',
  treasure: 'Hidden treasure', sorrow: 'Trouble or sorrow', magic: 'Their magic', sense: 'Their sense',
});
/** Rapport needed for the 1st … 9th secret in a character's order (Friendly 20 ≈ the 4th, Trusted 60 ≈ the 7th). */
export const SECRET_STEPS = Object.freeze([0, 5, 12, 20, 30, 42, 60, 80, 100]);
export const GUARDS = Object.freeze(['shame', 'fear', 'loyalty', 'control', 'love']);
export const SHAME_EXTRA = 15, CONTROL_AT = 60;
export const GUARD_HINT = Object.freeze({
  shame: 'Ashamed to say', fear: 'Afraid to say', loyalty: 'Keeping it for their faction', control: 'Holding it over you', love: 'Protecting someone',
});

export const PERSONALITIES = Object.freeze({
  whimsical: 'Shares magic and the strange things they sense early, and rarely guards anything.',
  'open-hearted': 'Love and sorrow come out early. Guards only to protect someone.',
  proud: 'Their sorrow comes last. Guards what shames them.',
  wary: 'Gives little at first. Guards what frightens them until you keep a promise.',
  devoted: 'Holds back anything that touches their faction.',
  schemer: 'Leads with an offer, often a lie. Holds secrets over you.',
  cruel: 'Lies to manipulate. The truth comes late.',
});

const rapportOf = (s, name) => (s && s.rapport && s.rapport[name]) || null;

/** Is a guarded secret earned? (the step itself is checked by the caller) */
function guardMet(guard, sec, step, ctx) {
  switch (guard) {
    case 'shame': return ctx.score >= step + SHAME_EXTRA;
    case 'fear': return ctx.kept >= 1;
    case 'loyalty': return ctx.loyalty >= 0;
    case 'control': return ctx.score >= CONTROL_AT;
    case 'love': return !!(sec.who && hasMet(rapportOf(ctx.s, sec.who)));
    default: return true;
  }
}

/**
 * The player's view of a character's secrets. ch: a characters-file entry; s: the save; factionName: the character's
 * faction display name (the loyalty ledger is keyed by it).
 * → { met, score, secrets: [{ key, label, state: 'out'|'held'|'locked', text, line, lie, wasLie, mission, item, guard, hint, step }],
 *     out, held, locked }
 */
export function revealSecrets(ch, s, factionName = null) {
  const r = rapportOf(s, ch && ch.name), met = hasMet(r);
  const ctx = { s, score: r ? r.score : 0, kept: r ? r.kept || 0 : 0, loyalty: (s && s.loyalty && factionName && s.loyalty[factionName]) || 0 };
  const list = ((ch && ch.secrets) || []).map((sec, i) => {
    const step = SECRET_STEPS[Math.min(i, SECRET_STEPS.length - 1)];
    const base = { key: sec.key, label: SECRET_LABEL[sec.key] || sec.key, step, guard: sec.guard || null };
    if (!met || ctx.score < step) return { ...base, state: 'locked' };
    if (sec.guard && !guardMet(sec.guard, sec, step, ctx)) return { ...base, state: 'held', hint: GUARD_HINT[sec.guard] || '' };
    const lying = !!(sec.lie && ctx.score < sec.lie.until);
    return {
      ...base, state: 'out', lie: lying, wasLie: !!(sec.lie && !lying),
      text: lying ? sec.lie.text : sec.text, line: lying ? (sec.lie.line || null) : (sec.line || null),
      mission: sec.mission || null, item: sec.item || null,
    };
  });
  const count = (st) => list.filter((x) => x.state === st).length;
  return { met, score: ctx.score, secrets: list, out: count('out'), held: count('held'), locked: count('locked') };
}

/** A token for a secret as told: its key, and whether the telling was the truth (a lie uncovered is news again). */
const tellToken = (x) => x.key + (x.lie ? ':lie' : '');

/**
 * The next secret this character has not yet told the player in person (in their order), or null. Heard secrets are
 * kept in s.secretsHeard[name] = [token]. → { key, line, text, lie, wasLie } | null
 */
export function untoldSecret(ch, s, factionName = null) {
  const heard = new Set((s && s.secretsHeard && s.secretsHeard[ch && ch.name]) || []);
  const v = revealSecrets(ch, s, factionName);
  return v.secrets.find((x) => x.state === 'out' && x.line && !heard.has(tellToken(x))) || null;
}

/** Mark a secret as told in person. → s */
export function noteSecretTold(s, name, secret) {
  if (!s || !name || !secret) return s;
  const book = s.secretsHeard || (s.secretsHeard = {});
  const list = book[name] || (book[name] = []);
  const t = tellToken(secret);
  if (!list.includes(t)) list.push(t);
  return s;
}
