/**
 * src/data/characterModel.js — the generated CHARACTER MODEL [MM-story_mwp61a5f_32].
 *
 * docs/tech-plan/Character-System.md: "Every character fact is generated from a layer below it, or declared as an
 * exception with a reason." Layers, bottom up: alignment (alignment.js) · faction relations (factionRelations.js) ·
 * faction traits (factionTraits.js) · base relation · personality · drama threads (content/characters/threads.json) ·
 * flaws (flaws.js) · secret reach and who knows · magic side (magic.js).
 * buildModel takes the content (voice packs, the faction characters files that exist, threads) and answers questions
 * about it; characterSystem.test.mjs and tools/dialog/character_gate.mjs check the content against it. Pure.
 */
import { alignmentRelation, polarity } from './alignment.js';
import { FACTION_KEYS, relationOf } from './factionRelations.js';
import { flawsFor, flawScores } from './flaws.js';

/** Character-System §4 (v0.3): each alignment's primary and alternate personality. */
export const PERSONALITY = Object.freeze({
  AG: ['devoted', 'open-hearted'], PG: ['devoted', 'wary'], G: ['open-hearted', 'wary'], CG: ['whimsical', 'open-hearted'],
  N: ['wary', 'whimsical'], CE: ['cruel', 'schemer'], E: ['schemer', 'devoted'], PE: ['schemer', 'cruel'], DE: ['cruel', 'schemer'],
});
export const PERSONALITIES = Object.freeze(['devoted', 'open-hearted', 'wary', 'whimsical', 'schemer', 'cruel']);

/** The faction score in a base relation: same faction, allied or friendly +1; neutral 0; wary or hostile −1. */
export function factionScore(fa, fb) {
  if (fa === fb) return 1;
  const r = relationOf(fa, fb);
  return r === 'allied' || r === 'friendly' ? 1 : r === 'neutral' ? 0 : -1;
}

/** Character-System §6: the default reach of each secret. */
export const DEFAULT_REACH = Object.freeze({ want: 'close', love: 'close', share: 'close', sorrow: 'close', hate: 'across',
  desire: 'private', treasure: 'private', magic: 'private', sense: 'private' });
const CIRCLE_KINDS = new Set(['love', 'kin', 'confidant', 'comrade']);

/**
 * Build the model. packs: content/dialog/voicepacks.json · files: { [factionKey]: content/characters/<key>.json } (the
 * ones that exist) · threads: content/characters/threads.json.
 */
export function buildModel({ packs, files = {}, threads = { threads: [] } }) {
  const chars = new Map();
  for (const key of FACTION_KEYS) {
    const fac = packs && packs.factions && packs.factions[key];
    if (!fac) continue;
    const file = files[key];
    for (const pc of fac.characters) {
      const entry = (file && file.characters.find((c) => c.name === pc.name)) || null;
      chars.set(pc.name, { name: pc.name, faction: key, factionName: fac.name, align: pc.align, gender: pc.gender, entry,
        declaredPersonality: entry ? entry.personality || null : null });
    }
  }
  const list = (threads && threads.threads) || [];
  const from = (n) => list.filter((t) => t.from === n);
  const to = (n) => list.filter((t) => t.to === n);

  const baseRelation = (a, b) => {
    const A = chars.get(a), B = chars.get(b);
    if (!A || !B) return null;
    return Math.max(-2, Math.min(2, alignmentRelation(A.align, B.align) + factionScore(A.faction, B.faction)));
  };

  /** The personality the rules give (declared if it is the primary or alternate, else the primary), and whether the
   *  declared one is outside the table. */
  const personalityOf = (n) => {
    const c = chars.get(n);
    const [primary, alternate] = PERSONALITY[c.align];
    const d = c.declaredPersonality;
    if (d === primary || d === alternate) return { personality: d, outside: false };
    return { personality: primary, outside: !!d, declared: d };
  };

  const threadFacts = (n) => {
    const out = from(n), inn = to(n);
    const loves = out.filter((t) => t.kind === 'love');
    return {
      hunts: out.some((t) => t.kind === 'hunts'), hunted: inn.some((t) => t.kind === 'hunts'),
      lovesCount: loves.length, unreturnedLove: loves.some((t) => !list.some((u) => u.from === t.to && u.to === n && u.kind === 'love')),
      uses: out.some((t) => t.kind === 'uses'), used: inn.some((t) => t.kind === 'uses'),
    };
  };

  const flawInput = (n) => {
    const c = chars.get(n);
    const hostile = FACTION_KEYS.find((k) => k !== c.faction && relationOf(c.faction, k) === 'hostile');
    return { name: n, faction: c.faction, align: c.align, personality: personalityOf(n).personality,
      hostileTo: hostile && packs.factions[hostile] ? packs.factions[hostile].name : null,
      againstType: (c.entry && c.entry.againstType) ? [].concat(c.entry.againstType) : [], flaw: c.entry && c.entry.flaw,
      threads: threadFacts(n) };
  };

  /** Everyone in a character's circle: love / kin / confidant / comrade threads either way, plus same faction at +2. */
  const circleOf = (n) => {
    const c = chars.get(n), out = new Set();
    for (const t of list) {
      if (!CIRCLE_KINDS.has(t.kind)) continue;
      if (t.from === n && chars.has(t.to)) out.add(t.to);
      if (t.to === n && chars.has(t.from)) out.add(t.from);
    }
    for (const o of chars.values()) if (o.name !== n && o.faction === c.faction && baseRelation(n, o.name) === 2) out.add(o.name);
    return [...out];
  };

  /** Characters of another faction tied to this one by any thread. */
  const acrossOf = (n) => {
    const c = chars.get(n), out = new Set();
    for (const t of list) {
      const other = t.from === n ? t.to : t.to === n ? t.from : null;
      if (other && chars.has(other) && chars.get(other).faction !== c.faction) out.add(other);
    }
    return [...out];
  };

  /** A secret's reach: declared, else the default shifted by personality and flaw. */
  const reachOf = (n, secret) => {
    if (secret.reach) return secret.reach;
    let r = DEFAULT_REACH[secret.key] || 'private';
    // a hate of a group (no one they rival or hunt) is not known across the line; the people around them hear it
    // (owner 2026-11-20: "hate groups or individuals .. hate could be dislike or dont trust")
    if (secret.key === 'hate' && !list.some((t) => t.from === n && (t.kind === 'rival' || t.kind === 'hunts'))) r = 'close';
    const p = personalityOf(n).personality;
    const flaws = flawsFor(flawInput(n));
    if (p === 'whimsical' && (secret.key === 'magic' || secret.key === 'sense')) r = 'close';
    if (p === 'open-hearted' && secret.key === 'desire') r = 'close';
    if ((p === 'schemer' || flaws.some((f) => f.axis === 'selfRegard' && f.extreme === 'high')) && (secret.key === 'sorrow' || secret.key === 'love')) r = 'private';
    if (flaws.some((f) => f.axis === 'trust' && f.extreme === 'high') && r === 'close') r = 'private';
    return r;
  };

  /** Who besides the owner knows a secret. → [name] */
  const knowersOf = (n, secret) => {
    const r = reachOf(n, secret);
    if (r === 'close') return circleOf(n);
    if (r === 'across') {
      // a hate is known to the one hated, whatever their faction ("the one you hate knows it", §6)
      const hated = secret.key === 'hate' ? list.filter((t) => t.from === n && (t.kind === 'rival' || t.kind === 'hunts') && chars.has(t.to)).map((t) => t.to) : [];
      return [...new Set([...hated, ...acrossOf(n)])];
    }
    return [];
  };

  return { chars, threads: list, baseRelation, personalityOf, threadFacts, flawInput,
    flawsOf: (n) => flawsFor(flawInput(n)), flawScoresOf: (n) => flawScores(flawInput(n)),
    circleOf, acrossOf, reachOf, knowersOf, polarityOf: (n) => polarity(chars.get(n).align) };
}
