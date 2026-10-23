/**
 * src/comm/questBeats.js — WHEN the secondary-resource quest speaks [MM-story_mvk8gz1k_r].
 *
 * Owner 2026-10-22: "on each planet there are secondary resource quests already in the game. Having these pop-up on
 * every waves feel like too much dialog. Let's have it pop up between wave 1 and 2 with a closing dialog at the end of
 * wave 8. We will tune the copy later."
 *
 * Two beats per map, nothing in between:
 *   offer   — the quest-giver's contract (render/contractModal.js) in the interlude after wave 1, before wave 2
 *             (it used to open at map start, and a FIELD TIP from the giver followed it into every interlude);
 *   closing — the giver's verdict line after the final wave is won (fulfilled or broken).
 * Pure data + predicates; main.js asks them.
 */
export const QUEST_BEATS = Object.freeze({
  offerBeforeWave: 2,   // the interlude that leads into this wave number shows the offer
  closingOnWin: true,   // the giver closes the deal after the last wave is won
});

/** nextIdx = the wave table index about to start (0 = wave 1). True only in the interlude before wave 2. */
export function questOfferDue(nextIdx, B = QUEST_BEATS) {
  return Number.isInteger(nextIdx) && nextIdx + 1 === B.offerBeforeWave;
}

/** A closing line plays iff a contract was accepted this run and the battle ended in a win. */
export function questClosingDue(contract, result, B = QUEST_BEATS) {
  return !!contract && result === 'win' && B.closingOnWin;
}
