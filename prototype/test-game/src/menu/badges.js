/**
 * src/menu/badges.js — the main menu's RED-DOT notification badges [MM-story_mvkhei9q_k]. Menu-Progression-Design §4.
 * Pure rules: (save, context) → which buttons show a dot, and what to remember when a screen is opened.
 *
 * context = { readyTech: [ids buyable now], harvesterNext: { level, cost } | null, bank: gold }
 */
/** Settings features that are new to a player until they open Settings once. Add a key when one ships. */
export const SETTINGS_NEWS = Object.freeze(['fxlab']);

export function computeBadges(s, ctx) {
  const seen = (s && s.seen) || {};
  const seenTech = new Set(seen.techtree || []), seenSet = new Set(seen.settings || []);
  const hn = ctx.harvesterNext;
  return {
    play: ((s && s.unlockedThrough) || 1) > (seen.play || 1),
    techtree: (ctx.readyTech || []).some((id) => !seenTech.has(id)),
    harvester: !!(hn && ctx.bank >= hn.cost && seen.harvester !== hn.level),
    settings: SETTINGS_NEWS.some((k) => !seenSet.has(k)),
  };
}

/** What opening `screen` should remember, as [key, value] — or null when the screen has no badge. */
export function seenFor(screen, s, ctx) {
  if (screen === 'survey') return ['play', (s && s.unlockedThrough) || 1];
  if (screen === 'techtree') return ['techtree', [...new Set([...(((s && s.seen) || {}).techtree || []), ...(ctx.readyTech || [])])]];
  if (screen === 'harvester') return ['harvester', ctx.harvesterNext ? ctx.harvesterNext.level : null];
  if (screen === 'settings') return ['settings', [...SETTINGS_NEWS]];
  return null;
}
