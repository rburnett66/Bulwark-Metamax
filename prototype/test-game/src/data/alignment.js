/**
 * src/data/alignment.js — the GDD §10 alignment system, as RULES [MM-story_mwp61a5f_32].
 *
 * docs/sources/bulwark-gdd.md §10.2: "an implementer can regenerate & validate the matrix from these". This module
 * implements the eleven rules, not the table; characterSystem.test.mjs regenerates the 9×9 matrix and compares it with
 * the GDD §10.3 table cell by cell (docs/tech-plan/Character-System.md §1).
 * Values: ++ = +2 Allied · + = +1 Respect · 0 Neutral · − = −1 Distrust · −− = −2 Hostile. Symmetric. Pure.
 */

export const ALIGNMENTS = Object.freeze(['AG', 'PG', 'G', 'CG', 'N', 'CE', 'E', 'PE', 'DE']);
export const ALIGN_NAME = Object.freeze({ AG: 'Angelic Good', PG: 'Pure Good', G: 'Good', CG: 'Chaotic Good', N: 'Neutral',
  CE: 'Chaotic Evil', E: 'Evil', PE: 'Pure Evil', DE: 'Dark Evil' });

/** Polarity: 'good' | 'neutral' | 'evil'. */
export function polarity(a) {
  if (['AG', 'PG', 'G', 'CG'].includes(a)) return 'good';
  if (['CE', 'E', 'PE', 'DE'].includes(a)) return 'evil';
  return 'neutral';
}

/** Conviction tier: 3 Zealots / Balance-Keepers · 2 Committed · 1 Chaotic · 0 Uncommitted. */
export function conviction(a) {
  if (['AG', 'PG', 'PE', 'DE'].includes(a)) return 3;
  if (a === 'G' || a === 'E') return 2;
  if (a === 'CG' || a === 'CE') return 1;
  return 0;
}

/** The relation two alignments have, from the GDD §10.2 rules. → −2 … +2 */
export function alignmentRelation(a, b) {
  if (!ALIGNMENTS.includes(a) || !ALIGNMENTS.includes(b)) throw new Error(`unknown alignment ${a} / ${b}`);
  if (a === b) return 2;                                          // 1. same alignment / kin
  const [ta, tb] = [conviction(a), conviction(b)];
  const same = polarity(a) === polarity(b);
  const pair = (x, y) => (ta === x && tb === y) || (ta === y && tb === x);
  if (ta === 3 && tb === 3) return same ? 2 : 1;                   // 2, 3. zealots: allied, or the balance pact
  if (pair(3, 2)) return same ? 2 : -2;                            // 4
  if (pair(3, 1)) return same ? -1 : -2;                           // 5. disappointed / hostile
  if (pair(3, 0)) return -2;                                       // 6
  if (ta === 2 && tb === 2) return same ? 2 : -2;                  // 7
  if (pair(2, 1)) return same ? 1 : -1;                            // 8
  if (pair(2, 0)) return -1;                                       // 9
  if (ta === 1 && tb === 1) return 0;                              // 10. chaos recognizes chaos
  if (pair(1, 0)) return 0;                                        // 11
  throw new Error(`no rule for ${a} / ${b}`);
}

/** The whole 9×9 matrix, generated. → { [a]: { [b]: −2…+2 } } */
export function alignmentMatrix() {
  const m = {};
  for (const a of ALIGNMENTS) { m[a] = {}; for (const b of ALIGNMENTS) m[a][b] = alignmentRelation(a, b); }
  return m;
}

export const RELATION_SYMBOL = Object.freeze({ 2: '++', 1: '+', 0: '0', '-1': '−', '-2': '− −' });
