/**
 * src/save/battleLog.js — the history of played campaign battles [MM-story_mw1azvh8_d].
 *
 * Owner 2026-11-03: a HISTORY button on the Play page opens "the history of battles on this planet". Nothing kept a
 * per-battle record before this (planetMaps holds only the best result per map), so every played campaign battle now
 * appends one compact entry, newest first, capped at LOG_CAP so the save stays small (~0.3 KB an entry).
 * Pure: functions change only the save they are given. Replays are never logged (a replay re-runs a logged battle).
 */
export const LOG_CAP = 150;
const TIERS = ['common', 'uncommon', 'rare', 'epic'];
const tiers = (o) => Object.fromEntries(TIERS.map((t) => [t, Math.max(0, Math.round((o && o[t]) || 0))]));

/**
 * One battle → its log entry. b = { at, planet, faction, mapId, mapName, result, finalScore, waveStars, totalWaves,
 * rewards (save.js ledger | null), harvested, kept (per tier), contract, favour ({title, outcome} | null) }.
 */
export function battleEntry(b) {
  const fs = b.finalScore || {}, ws = (Array.isArray(b.waveStars) ? b.waveStars : []).map((w) => (typeof w === 'number' ? w : (w && w.stars) || 0));
  const avg = ws.length ? Math.round(ws.reduce((a, n) => a + n, 0) / (b.totalWaves || ws.length) * 10) / 10 : 0;
  return {
    at: b.at, planet: b.planet || '', faction: b.faction || '', mapId: b.mapId, mapName: b.mapName || '',
    result: b.result === 'win' ? 'win' : 'lose', score: fs.score || 0, kills: fs.kills || 0,
    seconds: (fs.minutes || 0) * 60 + (fs.seconds || 0), waves: ws.length, totalWaves: b.totalWaves || ws.length, stars: ws, avg,
    gold: b.rewards ? b.rewards.gold.earned : 0, xp: b.rewards ? b.rewards.xp.earned : 0,
    harvested: tiers(b.harvested), kept: tiers(b.kept), contract: !!b.contract,
    favour: b.favour ? { title: b.favour.title, outcome: b.favour.outcome } : null,
  };
}

/** Add an entry at the front; drop the oldest past LOG_CAP. */
export function logBattle(s, entry) {
  if (!Array.isArray(s.battleLog)) s.battleLog = [];
  s.battleLog.unshift(entry);
  if (s.battleLog.length > LOG_CAP) s.battleLog.length = LOG_CAP;
  return entry;
}

/** This planet's battles, newest first. */
export const battlesOn = (s, planet) => ((s && s.battleLog) || []).filter((e) => e.planet === planet);

/** The planet's record at a glance, from its log and its per-map bests. */
export function planetRecord(s, planet, maps = 9) {
  const list = battlesOn(s, planet), wins = list.filter((e) => e.result === 'win');
  const byMap = ((s && s.planetMaps) || {})[planet] || {};
  const best = list.reduce((m, e) => (e.score > m ? e.score : m), 0);
  const harvested = TIERS.reduce((a, t) => a + list.reduce((x, e) => x + (e.harvested[t] || 0), 0), 0);
  return {
    battles: list.length, wins: wins.length, losses: list.length - wins.length,
    winRate: list.length ? Math.round(wins.length / list.length * 100) : 0,
    bestScore: best, kills: list.reduce((a, e) => a + e.kills, 0), harvested,
    seconds: list.reduce((a, e) => a + e.seconds, 0),
    maps: Array.from({ length: maps }, (_, i) => {
      const r = byMap[i + 1] || null;
      return { id: i + 1, beaten: !!(r && r.beaten), bestAvg: r && r.bestAvg != null ? r.bestAvg : null, runs: r ? r.runs : 0 };
    }),
  };
}
