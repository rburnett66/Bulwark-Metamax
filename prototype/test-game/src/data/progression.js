/**
 * src/data/progression.js — COMMANDER XP and RANKS [MM-story_mvkhef1t_i]. docs/16 Bulwark MM/design/Menu-Progression-Design.md §2.1.
 * Pure data + formulas: balance is data, tune here.
 */
export const XP_BASE = 300, XP_STEP = 150;   // XP to go from level L to L+1 = XP_BASE + XP_STEP × (L − 1)
export const RANKS = Object.freeze(['Recruit', 'Private', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Lieutenant', 'Captain', 'Major',
  'Lt. Colonel', 'Colonel', 'Brigadier']);   // levels 1..11; 12–14 General, 15+ Marshal

export function rankTitle(level) {
  if (level <= RANKS.length) return RANKS[Math.max(1, level) - 1];
  return level < 15 ? 'General' : 'Marshal';
}
export const xpToNext = (level) => XP_BASE + XP_STEP * (Math.max(1, level) - 1);

/** xp (total) → { level, into (XP into this level), need (XP this level needs), title, frac }. */
export function levelFromXp(xp) {
  let level = 1, left = Math.max(0, Math.floor(xp || 0));
  while (left >= xpToNext(level)) { left -= xpToNext(level); level += 1; }
  const need = xpToNext(level);
  return { level, into: left, need, title: rankTitle(level), frac: left / need };
}

/** XP for one battle. mapId 0 (the classic board) grants nothing. avgStars 0..5. */
export function xpForBattle({ mapId, result, avgStars = 0, kills = 0 }) {
  if (!mapId) return 0;
  if (result === 'win') return Math.round(100 + 25 * mapId + 20 * avgStars + Math.floor(kills / 4));
  return Math.round(25 + 10 * mapId + Math.floor(kills / 8));
}
