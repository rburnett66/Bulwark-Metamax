/**
 * src/data/factionRelations.js — RELATIONS: how the nine factions see each other [MM-story_mwohmk85_2v].
 * Owner 2026-11-19 (docs/tech-plan/Character-Secrets.md §1): Alignment stays the moral axis; faction ↔ faction is
 * Relations, on Allied · Friendly · Neutral · Wary · Hostile. A character's relations start from their faction's row
 * and are bent by their own secrets (content/characters/<faction>.json `relations`).
 *
 * The table is symmetric. Every workbook rival pair (contracts.js rivalOf: Powder ↔ Air, High Tech ↔ Artillery,
 * Water ↔ Arcane, Space ↔ Dark) is Hostile; the rest follows the GDD §9 tropes. Draft, for owner review.
 * Pure data + functions.
 */

export const RELATION_STEPS = Object.freeze(['hostile', 'wary', 'neutral', 'friendly', 'allied']);
export const RELATION_LABEL = Object.freeze({ hostile: 'Hostile', wary: 'Wary', neutral: 'Neutral', friendly: 'Friendly', allied: 'Allied' });
export const FACTION_KEYS = Object.freeze(['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies']);

// one row per pair, written once (the table is symmetric); unlisted pairs are neutral
const PAIRS = [
  ['ground', 'air', 'hostile'],          // rivals: the old empire against the ace-pilot youth
  ['ground', 'hightech', 'wary'],        // the corporations buy the empire's wars
  ['ground', 'artillery', 'friendly'],   // two armies, one doctrine
  ['ground', 'space', 'wary'],
  ['ground', 'dark', 'wary'],            // a movement that would tear the flags down
  ['ground', 'greenies', 'wary'],        // the collective against the nation
  ['air', 'hightech', 'friendly'],       // the jets are bought from someone
  ['air', 'artillery', 'wary'],          // flak against fliers
  ['air', 'space', 'friendly'],          // the sky and what is above it
  ['hightech', 'artillery', 'hostile'],  // rivals
  ['hightech', 'water', 'wary'],         // the seas are a resource to them
  ['hightech', 'arcane', 'wary'],        // science against faith
  ['hightech', 'space', 'friendly'],
  ['hightech', 'dark', 'wary'],
  ['hightech', 'greenies', 'hostile'],   // capital against the collective
  ['artillery', 'space', 'wary'],
  ['artillery', 'greenies', 'wary'],
  ['water', 'arcane', 'hostile'],        // rivals
  ['water', 'dark', 'wary'],
  ['water', 'greenies', 'friendly'],     // tide and growth
  ['arcane', 'space', 'wary'],
  ['arcane', 'dark', 'wary'],            // the schism's corrupted end (GDD §12 [RE])
  ['space', 'dark', 'hostile'],          // rivals
  ['dark', 'greenies', 'friendly'],      // two movements, one enemy
];

const TABLE = (() => {
  const t = {};
  for (const a of FACTION_KEYS) { t[a] = {}; for (const b of FACTION_KEYS) t[a][b] = a === b ? 'allied' : 'neutral'; }
  for (const [a, b, r] of PAIRS) { t[a][b] = r; t[b][a] = r; }
  for (const k of FACTION_KEYS) Object.freeze(t[k]);
  return Object.freeze(t);
})();
export const FACTION_RELATIONS = TABLE;

/** How faction a sees faction b ('hostile' … 'allied'), or null for an unknown key. */
export function relationOf(a, b) {
  return (TABLE[a] && TABLE[a][b]) || null;
}

/** A faction's row toward the other eight: [{ key, relation, label }]. */
export function factionRelationRow(key) {
  if (!TABLE[key]) return [];
  return FACTION_KEYS.filter((k) => k !== key).map((k) => ({ key: k, relation: TABLE[key][k], label: RELATION_LABEL[TABLE[key][k]] }));
}

/**
 * A character's relations: their faction's row with their own bends applied. ch: a characters-file entry
 * ({ relations: { [factionKey]: { to, why } } }). → [{ key, relation, label, bent, why }]
 */
export function characterRelations(factionKey, ch) {
  const bends = (ch && ch.relations) || {};
  return factionRelationRow(factionKey).map((r) => {
    const b = bends[r.key];
    return b && RELATION_LABEL[b.to]
      ? { key: r.key, relation: b.to, label: RELATION_LABEL[b.to], bent: b.to !== r.relation, from: r.relation, why: b.why || '' }
      : { ...r, bent: false, why: '' };
  });
}
