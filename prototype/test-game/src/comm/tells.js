/**
 * src/comm/tells.js — TELLS in the prose: how sure a character sounds when they pass on a rumour [MM-story_mwp61bjm_33].
 *
 * Owner 2026-11-20: "Credibility score could also influence dialog creation. adding delays, contradictions or elements
 * like '..' 'um' 'well,' 'I, uh ..' could subtly indicate in credibility in the prose." docs/tech-plan/Character-System.md
 * §7.4. A rumour is written once, clean; the tells are added when it is spoken.
 *   how many: credibility ≥ 0.9 → 0 · 0.5–0.9 → 1 · < 0.5 → 2; a twist, lie or false version +1, except that a schemer
 *             or a cruel teller lies smoothly; an open-hearted or whimsical teller always adds one filler (their voice);
 *             at most 2.
 *   which:    by personality (fillers, hedges, a pause) or by a flaw with its own tell (§5a.4), which replaces it.
 * Deterministic: the same teller, owner and secret always read the same (no Math.random). Outside the sim tick.
 */

const FILLERS = ['Um,', 'Uh,', 'I, uh ..'];
const HEDGES = ['Well,', 'They say', 'If it\'s true,'];
const FLAW_TELL = {   // the extreme's own tell (Character-System §5a.4)
  'selfRegard:high': ['Everyone knows .. I know.'],
  'selfRegard:low': ['… or not.'],
  'trust:high': HEDGES, 'courage:low': HEDGES,
  'mind:low': ['Where was I. Right.'],
  'regard:low': ['Sorry,'],
  'drive:low': ['Fine.'],
};

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** How many tells a line gets (§7.4). */
export function tellCount({ credibility = 1, version = 'true', personality = 'wary' } = {}) {
  let n = credibility >= 0.9 ? 0 : credibility >= 0.5 ? 1 : 2;
  const lying = version === 'twist' || version === 'lie' || version === 'false';
  if (lying && personality !== 'schemer' && personality !== 'cruel') n += 1;
  if (personality === 'open-hearted' || personality === 'whimsical') n += 1;   // their voice, even telling the truth
  return Math.min(2, n);
}

/**
 * The spoken line with its tells. line: the clean rumour line ("About Otto: he wants …"). opts: { credibility, version,
 * personality, flaw: { axis, extreme } | null, seed: string }. → string
 */
export function tellsFor(line, opts = {}) {
  const n = tellCount(opts);
  if (!n) return line;
  const seed = hash(String(opts.seed || line));
  const flawTell = opts.flaw ? FLAW_TELL[`${opts.flaw.axis}:${opts.flaw.extreme}`] : null;
  const p = opts.personality;
  const lyingSmoothly = (p === 'schemer' || p === 'cruel') && opts.version !== 'true' && (opts.credibility || 1) < 0.5;
  let out = line;
  for (let i = 0; i < n; i++) {
    const pick = (list) => list[(seed + i * 7) % list.length];
    if (lyingSmoothly) { out = out.replace(/([.!?])$/, '$1 Or so I heard. No. I know.'); break; }   // a contradiction only
    if (flawTell && i === 0) { const t = pick(flawTell); out = /^…/.test(t) ? out.replace(/([.!?])$/, ` ${t}`) : `${t} ${out}`; continue; }
    if (p === 'devoted') { out = out.replace(/^(About )/, '$1.. '); if (!/\.\. /.test(out)) out = '.. ' + out; continue; }
    if (p === 'wary' || p === 'schemer' || p === 'cruel') { out = `${pick(HEDGES)} ${out.replace(/^./, (m) => m.toLowerCase())}`; continue; }
    out = `${pick(FILLERS)} ${out.replace(/^./, (m) => m.toLowerCase())}`;   // open-hearted, whimsical, and the rest
  }
  return out;
}

/** Where a typed line holds its breath: the index of every ".." (commCard typeText pauses there). */
export function pausePoints(text) {
  const out = [];
  for (let i = String(text).indexOf('..'); i >= 0; i = String(text).indexOf('..', i + 2)) out.push(i + 2);
  return out;
}
