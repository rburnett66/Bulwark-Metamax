/**
 * src/dialog/conversationState.js — a player-paced conversation, as a pure state machine [MM-story_mw47llqj_6].
 *
 * Design: Collective-Opening-Design §6.2 — typed lines, click / tap / Space / Enter advances, holding or a second
 * press finishes the line, speaker changes, holo-slide cues, progress pips. No DOM, no audio, no clock: the panel
 * (conversation.js) feeds it time and input, and node tests drive it headlessly.
 *
 *   const c = createConversationState(script, { cps: 42 });
 *   c.tick(dt) → { index, line, speaker, shown (chars typed), full (line finished), slide, done }
 *   c.press()  → 'finish' (completed the typing) | 'next' (moved on) | 'end' (past the last line)
 */

/** Check a script's shape: { speakers, slides?, lines: [{ speaker, text, slide?, intent? }] } → errors[]. */
export function validateScript(S) {
  const errors = [];
  if (!S || !Array.isArray(S.lines) || !S.lines.length) return ['lines: at least one line'];
  const speakers = S.speakers || {}, slides = S.slides || {};
  S.lines.forEach((l, i) => {
    if (!speakers[l.speaker]) errors.push(`line ${i + 1}: unknown speaker "${l.speaker}"`);
    if (!l.text || typeof l.text !== 'string') errors.push(`line ${i + 1}: no text`);
    if (l.slide && !slides[l.slide]) errors.push(`line ${i + 1}: unknown slide "${l.slide}"`);
    if (l.intent && !['statement', 'question', 'exclaim', 'trail'].includes(l.intent)) errors.push(`line ${i + 1}: unknown intent "${l.intent}"`);
  });
  return errors;
}

/** The slide shown at each line: a line's own `slide`, else the last one cued before it (null before any). */
export function slideTrack(S) {
  let cur = null;
  return S.lines.map((l) => (cur = l.slide || cur));
}

export function createConversationState(S, { cps = 42, reduce = false } = {}) {
  const track = slideTrack(S);
  let index = 0, shown = 0, done = false;
  const line = () => S.lines[Math.min(index, S.lines.length - 1)];
  const len = () => line().text.length;
  function state() {
    const l = line();
    return {
      index, count: S.lines.length, line: l, text: l.text.slice(0, Math.floor(shown)),
      speaker: S.speakers[l.speaker], speakerKey: l.speaker,
      shown: Math.floor(shown), full: shown >= len(), slide: track[Math.min(index, track.length - 1)],
      newSlide: index === 0 ? !!track[0] : track[index] !== track[index - 1], done,
    };
  }
  return {
    /** Advance typing by dt seconds (reduced motion: the whole line at once). */
    tick(dt = 0) {
      if (!done) shown = reduce ? len() : Math.min(len(), shown + dt * cps);
      return state();
    },
    /** One press: finish the typing, or move to the next line, or end. */
    press() {
      if (done) return 'end';
      if (shown < len()) { shown = len(); return 'finish'; }
      if (index >= S.lines.length - 1) { done = true; return 'end'; }
      index++; shown = reduce ? len() : 0;
      return 'next';
    },
    /** Jump to the end (skip). */
    skip() { index = S.lines.length - 1; shown = len(); done = true; return state(); },
    get state() { return state(); },
  };
}
