/**
 * src/comm/dialog.js  [comm-dialog]
 *
 * Dialog SELECTION per the Dialog & Storytelling System doc (bulwark-dialog-system.md):
 * which of the 81 characters speaks at which moment, saying which authored signature line.
 * Content comes from content/dialog/voicepacks.json — GENERATED from the design doc by
 * tools/extract_dialog.py (§0.1: writers tune the doc, never code).
 *
 * Moment map (§2/§12), fitted to the current single-match game where each campaign wave IS
 * one faction's assault:
 *   wave start  → M0/M1 challenge  → the faction's Champion (PE, §3.2 default); test-mode
 *                 repeat waves rotate the cast so 8 waves of one faction don't repeat a line
 *   wave clear  → M2 commentary    → WIN_EFFICIENT / WIN_CLOSE by outcome classification (§9)
 *   match lose  → M4 defeat taunt  → Champion's authored DEFEAT line
 *   match win   → M3/M5 concession → final faction's Champion, WIN_* by outcome
 *
 * All picks are seeded (hash of faction:wave:seed — §11 determinism), so a replay hears the
 * exact same calls. Pure functions over the packs object; fetch lives in loadVoicePacks().
 */
import { FACTION_KEY_BY_NAME, FACTIONS, hash } from './voice.js';

/* §9 outcome thresholds — tunable table, not hardcode */
export const OUTCOME_DEFAULTS = { efficientHp: 0.8, closeHp: 0.3 };

/** Fetch the generated voice packs. Never throws — null means "fall back to the tool cast". */
export async function loadVoicePacks() {
  try {
    const r = await fetch('content/dialog/voicepacks.json');
    if (!r.ok) return null;
    const data = await r.json();
    return (data && data.factions) ? data : null;
  } catch (e) {
    console.warn('[dialog] voicepacks unavailable — comm falls back to built-in cast:', e && e.message);
    return null;
  }
}

/** §9 classification from wave-end telemetry. Returns 'efficient' | 'close' | 'standard'. */
export function classifyOutcome(baseHpPct, structuresLost, t) {
  t = t || OUTCOME_DEFAULTS;
  if (baseHpPct <= t.closeHp || structuresLost > 0) return 'close';
  if (baseHpPct >= t.efficientHp) return 'efficient';
  return 'standard';
}

function castOf(packs, factionName) {
  const key = FACTION_KEY_BY_NAME[factionName];
  const fac = key && packs && packs.factions[key];
  return fac ? { key, chars: fac.characters } : null;
}
function champion(chars) {
  for (const c of chars) if (c.align === 'PE') return c;
  return chars[0];
}
/* A call spec the comm card can show: who, what, and how it sounds. */
function spec(key, factionName, ch, entry, role) {
  if (!ch || !entry) return null;
  return {
    factionKey: key, factionName,
    name: ch.name, sub: factionName + ' · ' + ch.align + (role ? ' · ' + role : ''),
    gender: ch.gender, intent: entry.intent || 'statement', line: entry.line,
    voiceSeed: hash(ch.name),
  };
}

/** M0/M1 — the challenge when a faction's wave starts. Champion by default (§3.2); repeat
 *  visits from the same faction (test mode) rotate through the rest of the cast's M0s. */
export function challengeCall(packs, factionName, wave, seed, visitCount) {
  const fac = castOf(packs, factionName);
  if (!fac) return null;
  const withM0 = fac.chars.filter((c) => c.lines.m0);
  if (!withM0.length) return null;
  let ch;
  if (!visitCount || visitCount <= 1) ch = champion(withM0);
  else ch = withM0[hash(factionName + ':m0:' + wave + ':' + seed) % withM0.length];
  return spec(fac.key, factionName, ch, ch.lines.m0, 'CHALLENGE');
}

/** M2/M3/M5 — commentary after the player repels a wave (or wins the match). The defeated
 *  faction concedes: WIN_EFFICIENT or WIN_CLOSE by §9 outcome ('standard' reads the
 *  efficient line — the muted variant of §5.2). Speaker rotates per-wave, seeded. */
export function winCall(packs, factionName, wave, seed, outcome, isFinal) {
  const fac = castOf(packs, factionName);
  if (!fac) return null;
  const lineKey = outcome === 'close' ? 'winClose' : 'winEfficient';
  const pool = fac.chars.filter((c) => c.lines[lineKey]);
  if (!pool.length) return null;
  const ch = isFinal ? champion(pool) : pool[hash(factionName + ':win:' + wave + ':' + seed) % pool.length];
  return spec(fac.key, factionName, ch, ch.lines[lineKey], isFinal ? 'CONCESSION' : null);
}

/** M4 — the base fell: the attacking faction's Champion delivers the authored defeat taunt. */
export function defeatCall(packs, factionName, seed) {
  const fac = castOf(packs, factionName);
  if (!fac) return null;
  const ch = champion(fac.chars.filter((c) => c.lines.defeat));
  return ch ? spec(fac.key, factionName, ch, ch.lines.defeat, 'VERDICT') : null;
}

/** Fallback spec from the comm tool's built-in 3-character cast (packs not loaded/missing). */
/** SECONDARY speaker (owner, 2026-07-16): bookends the match.
 *  kind 'tip'    — match START, only when the LOYALTY deal is live (contract accepted): the
 *                  giver's envoy tips the commander about the promised quest fields.
 *  kind 'reward' — match END, only when the STAR BONUS applied (a 5-star wave this battle):
 *                  the envoy grants the reward. Good-leaning cast pick, deterministic by seed. */
export function tipsCall(packs, factionName, seed, kind) {
  const f = packs && packs.factions && packs.factions[factionName];
  if (!f || !f.characters || !f.characters.length) return null;
  const goodish = f.characters.filter((c) => ['AG', 'PG', 'G', 'CG', 'N'].includes(c.align));
  const cast = goodish.length ? goodish : f.characters;
  const ch = cast[Math.abs(seed | 0) % cast.length];
  const phrase = (ch.phrases || [])[Math.abs((seed | 0) >> 2) % Math.max(1, (ch.phrases || []).length)] || '';
  const flavor = phrase ? ' “' + phrase + '”' : '';
  const line = kind === 'reward'
    ? 'Five stars, commander — the bonus is yours. ' + (ch.motivation || '') + flavor
    : 'The contract stands. The crystals we spoke of lie beyond the front — push out when the ring opens, and haul at least four of every five.' + flavor;
  return {
    name: ch.name, faction: factionName, gender: ch.gender,
    line, intent: 'statement', voiceSeed: (seed | 0) ^ (kind === 'reward' ? 0x7e11 : 0x5157),
    label: kind === 'reward' ? 'STAR BONUS' : 'FIELD TIP',
  };
}

export function fallbackCall(factionName, wave, seed) {
  const key = FACTION_KEY_BY_NAME[factionName];
  const f = key && FACTIONS[key];
  if (!f) return null;
  const c = f.cast[hash(factionName + ':' + (wave || 0) + ':' + (seed || 0)) % f.cast.length];
  return {
    factionKey: key, factionName, name: c.n, sub: f.name + ' · ' + c.a,
    gender: c.g, intent: c.intent, line: c.line, voiceSeed: hash(c.n),
  };
}
