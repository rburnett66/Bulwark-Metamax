/**
 * src/comm/questBeats.js — WHEN the quest speaks in battle [MM-story_mvk8gz1k_r] [MM-story_mvzkd2t8_1k].
 *
 * Owner 2026-11-02 (Mission-Log-Design §11): the wave-2 contract offer moved off the battle timeline. The faction
 * contract is now the planet's secondary mission, offered aboard the capital ship before the battle. One beat is left:
 *   closing — the giver's verdict after the final wave is won, when a secondary's attempt ended in this battle.
 * Pure data + predicates; main.js asks them.
 */
export const QUEST_BEATS = Object.freeze({
  closingOnWin: true,   // the giver closes the deal after the last wave is won
});

/** A closing line plays iff a secondary's attempt ended in this battle and the battle ended in a win. */
export function questClosingDue(favour, result, B = QUEST_BEATS) {
  return !!favour && result === 'win' && B.closingOnWin;
}
