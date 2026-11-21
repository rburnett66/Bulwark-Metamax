/**
 * src/data/flaws.js — FLAWS, generated on eight axes [MM-story_mwp61a5f_32].
 *
 * Owner 2026-11-20: "Flaw might be another personality factor to determine. And should be derived from the rest of the
 * characteristics. Lack of trusting, too trusting, proud, emotionally unstable, greedy, lustful, arrogant, closed
 * minded, low IQ, lazy, self centered, narcissistic, over baring, rude, racist, mean spirited, endless list here."
 * docs/tech-plan/Character-System.md §5a. The rules attach to the 16 extremes of eight axes, never to a word, so the
 * word lists can grow without new rules. Pure.
 */
import { polarity, conviction } from './alignment.js';
import { HOME_SIDE } from './magic.js';
import { traitPushes } from './factionTraits.js';

/** Each axis is a flaw at either extreme; each extreme's ladder is its name then its words, mild → harsh. */
export const AXES = Object.freeze({
  trust:    { low: ['gullible', 'too trusting', 'naive', 'easily led'], high: ['suspicious', 'distrustful', 'paranoid'] },
  selfRegard: { low: ['self-doubting', 'insecure', 'servile'], high: ['proud', 'vain', 'arrogant', 'conceited', 'grandiose'] },
  temper:   { low: ['cold', 'aloof', 'callous', 'unfeeling'], high: ['volatile', 'moody', 'emotionally unstable', 'hot-headed', 'wrathful'] },
  appetite: { low: ['joyless', 'prudish', 'puritan', 'grim'], high: ['indulgent', 'greedy', 'lustful', 'gluttonous', 'decadent'] },
  mind:     { low: ['flighty', 'short-sighted', 'scatterbrained', 'dim', 'slow-witted', 'credulous'], high: ['rigid', 'stubborn', 'closed-minded', 'dogmatic', 'prejudiced', 'bigoted'] },
  drive:    { low: ['idle', 'lazy', 'apathetic', 'indecisive'], high: ['driven', 'obsessive', 'ruthless', 'consumed'] },
  regard:   { low: ['self-effacing', 'doormat', 'people-pleaser'], high: ['self-centred', 'rude', 'selfish', 'overbearing', 'mean-spirited', 'narcissistic'] },
  courage:  { low: ['cowardly', 'timid', 'spineless'], high: ['reckless', 'rash', 'foolhardy'] },
});
export const AXIS_ORDER = Object.freeze(Object.keys(AXES));

/** Rank from the title: high, low, or mid. */
const HIGH = /\b(General|Field-Marshal|Marshal|Chancellor|Chieftain|Chief|CEO|Hierophant|Admiral|Regent|Prime|Sovereign|Warlord|Commander|Raider-Chief|Matriarch|Patriarch)\b/i;
const LOW = /\b(Sergeant|raider|crewman|Cadet|Mechanic|Acolyte|Splinter|Composter|Private|Corporal|Deckhand)\b/i;
export function rankOf(name) { return HIGH.test(name) ? 'high' : LOW.test(name) ? 'low' : 'mid'; }

const PERSONALITY_PUSH = Object.freeze({
  wary: { trust: 1, temper: -1 },
  'open-hearted': { trust: -1, regard: -1 },
  whimsical: { mind: -1, drive: -1, selfRegard: -1 },
  devoted: { drive: 1, regard: -1 },
  schemer: { trust: 1, regard: 1, temper: -1 },
  cruel: { regard: 1, temper: -1 },
});
const HOME_PUSH = Object.freeze({ brain: { mind: 1 }, body: { temper: 1 }, soul: { courage: 1 } });

/**
 * The eight axis scores, −3 … +3. c: { name, faction, align, personality, againstType?: [word], threads?: { hunts,
 * hunted, lovesCount, unreturnedLove, uses, used } } (counts / booleans from the drama threads).
 * → { scores, why: { [axis]: [reason] } }
 */
export function flawScores(c) {
  const s = Object.fromEntries(AXIS_ORDER.map((a) => [a, 0])), why = Object.fromEntries(AXIS_ORDER.map((a) => [a, []]));
  const add = (axis, by, reason) => { if (by) { s[axis] += by; why[axis].push(`${by > 0 ? '+' : ''}${by} ${reason}`); } };
  const pol = polarity(c.align), tier = conviction(c.align);
  if (pol === 'evil') { add('regard', 1, 'evil'); add('appetite', 1, 'evil'); }
  if (pol === 'good' && tier === 3) add('appetite', -1, 'good zealot');
  if (tier === 3) { add('mind', 1, 'zealot'); add('selfRegard', 1, 'zealot'); }
  if (tier === 1) { add('temper', 1, 'chaotic'); add('courage', 1, 'chaotic'); add('mind', -1, 'chaotic'); }
  if (tier === 0) add('drive', -1, 'uncommitted');
  for (const [axis, by] of Object.entries(PERSONALITY_PUSH[c.personality] || {})) add(axis, by, c.personality);
  const rank = rankOf(c.name);
  if (rank === 'high') { add('selfRegard', 1, 'high rank'); add('regard', 1, 'high rank'); }
  if (rank === 'low') add('selfRegard', -1, 'low rank');
  const t = c.threads || {};
  if (t.hunts) { add('drive', 2, 'hunts someone'); add('temper', 1, 'hunts someone'); }
  if (t.hunted) add('trust', 1, 'is hunted');
  if ((t.lovesCount || 0) >= 2) add('appetite', 1, 'loves two or more');
  if (t.unreturnedLove) add('selfRegard', -1, 'loves without return');
  if (t.uses) { add('appetite', 1, 'uses someone'); add('regard', 1, 'uses someone'); }
  if (t.used) add('trust', 1, 'was used');
  for (const [axis, by] of Object.entries(HOME_PUSH[HOME_SIDE[c.faction]] || {})) add(axis, by, `${HOME_SIDE[c.faction]} home`);
  for (const p of traitPushes(c.faction)) if (!(c.againstType || []).includes(p.word)) add(p.axis, p.by, `faction lacks ${p.word}`);
  for (const a of AXIS_ORDER) s[a] = Math.max(-3, Math.min(3, s[a]));
  return { scores: s, why };
}

/** The word on an extreme's ladder: context words first, then the severity step. */
function wordFor(axis, extreme, score, c) {
  const ladder = AXES[axis][extreme];
  const t = c.threads || {};
  if (axis === 'regard' && extreme === 'high' && rankOf(c.name) === 'high') return 'overbearing';
  if (axis === 'appetite' && extreme === 'high' && (t.lovesCount || 0) >= 2) return 'lustful';
  if (axis === 'temper' && extreme === 'high' && t.hunts) return 'wrathful';
  if (axis === 'mind' && extreme === 'high' && c.prejudiceAgainst) return `prejudiced against ${c.prejudiceAgainst}`;
  const pol = polarity(c.align);
  const step = (Math.abs(score) - 2) + (pol === 'neutral' ? 1 : 0) + (pol === 'evil' ? 2 : 0) + (conviction(c.align) === 3 ? 1 : 0);
  const word = ladder[Math.max(0, Math.min(ladder.length - 1, step))];
  // prejudice always has a target: the faction their own faction is hostile to (Character-System §5a.3)
  if ((word === 'prejudiced' || word === 'bigoted') && c.hostileTo) return `${word} against ${c.hostileTo}`;
  return word;
}

/**
 * A character's flaws: the strongest axis if it reaches 2, and a second if another reaches 3 (ties by axis order).
 * A declared flaw ({ word, why }) replaces the generated one. → [{ axis, extreme, score, word, declared? }]
 */
export function flawsFor(c) {
  if (c.flaw && c.flaw.word) return [{ axis: axisOfWord(c.flaw.word), extreme: null, score: null, word: c.flaw.word, declared: true, why: c.flaw.why || '' }];
  const { scores } = flawScores(c);
  const ranked = AXIS_ORDER.map((a) => ({ axis: a, score: scores[a] }))
    .filter((x) => Math.abs(x.score) >= 2)
    .sort((x, y) => Math.abs(y.score) - Math.abs(x.score) || AXIS_ORDER.indexOf(x.axis) - AXIS_ORDER.indexOf(y.axis));
  const out = [];
  if (ranked[0]) out.push(ranked[0]);
  if (ranked[1] && Math.abs(ranked[1].score) >= 3) out.push(ranked[1]);
  return out.map((x) => {
    const extreme = x.score > 0 ? 'high' : 'low';
    return { axis: x.axis, extreme, score: x.score, word: wordFor(x.axis, extreme, x.score, c) };
  });
}

/** Which axis a word belongs to (for declared flaws), or null for a word not yet on any ladder. */
export function axisOfWord(word) {
  const w = String(word).toLowerCase().replace(/^prejudiced against .*/, 'prejudiced');
  for (const a of AXIS_ORDER) if (AXES[a].low.includes(w) || AXES[a].high.includes(w)) return a;
  return null;
}
