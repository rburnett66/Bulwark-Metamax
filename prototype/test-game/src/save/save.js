/**
 * src/save/save.js — THE campaign save. Single owner of persistent player state.
 *
 * Everything the menu reads and the game writes lives here, versioned, in one localStorage key.
 * Design data (thresholds, rubrics, map rows) stays in content/maps/mapdata.js — this file holds
 * only PLAYER state. Schema v1 (2026-07-15, the menu epic):
 *
 *   v                1 — bump on shape changes; migrate() upgrades old saves in place
 *   goldBank         gold carried between maps (null = no campaign in flight → maps use their default)
 *   carry            campaign carry snapshot {gold, structures:[{structId,tier,dx,dy,invested}]} | null
 *   unlockedThrough  highest map id the player may enter (fixed 9-map sequence; beat N → N+1.
 *                    The GDD's ≥3.0-star gate replaces "beat" when Story 4 lands stars.)
 *   maps             { [mapId]: { beaten, bestScore, stars:[...8]|null, avg|null, contract|null } }
 *                    contract: 'ACCEPTED'|'DECLINED'|'FULFILLED'|'BROKEN'
 *   loyalty          { [factionId]: signed number } (cumulative; tech thresholds read this)
 *   tech             { [factionId]: 0..3 } highest unlocked tier
 *   harvesterLevel   1..5
 *
 * Determinism contract: any field that CHANGES A BATTLE (carry, tech, harvesterLevel, contract
 * buffs) must be injected at createSim time — never mid-battle — so replays stay reproducible.
 */

const KEY = 'bulwark:save';

export function defaultSave() {
  return {
    v: 1,
    goldBank: null,
    carry: null,
    unlockedThrough: 1,
    maps: {},
    loyalty: {},
    tech: {},
    harvesterLevel: 1,
    alignment: 0,        // the good/evil axis (owner): finishing a good hero's contract raises it,
                         // an evil hero's lowers it — the 81-character matrix supplies the givers
  };
}

function migrate(s) {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return defaultSave();
  // v1 field fills (schema grew within v1 during the epic — additive, no version bump needed)
  if (typeof s.alignment !== 'number') s.alignment = 0;
  if (!s.factionRecords) s.factionRecords = {};
  return s;
}

export function loadSave() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw));
  } catch (e) {
    return defaultSave();
  }
}

export function writeSave(s) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) { /* storage blocked/full — campaign state stays in-memory for the session */ }
  return s;
}

/** Read-modify-write in one step: updateSave(s => { s.goldBank = 500; }) */
export function updateSave(fn) {
  const s = loadSave();
  fn(s);
  return writeSave(s);
}

/** Record a finished battle. The GDD gate: a >= 3.0 STAR AVERAGE unlocks the next map
 *  (workbook Global_Params.Star_Gate). waveStars = the sim's per-wave rubric results. */
export const STAR_GATE = 3.0;
export function recordResult(mapId, result, finalScore, waveStars, totalWaves, faction) {
  if (!mapId) return loadSave();   // classic board — no campaign record
  return updateSave((s) => {
    const m = s.maps[mapId] || (s.maps[mapId] = { beaten: false, bestScore: null, stars: null, avg: null, contract: null });
    // per-FACTION campaign record (the Factions screen reads this): maps won vs them + star history
    if (faction && result === 'win') {
      const fr = (s.factionRecords || (s.factionRecords = {}));
      const f = fr[faction] || (fr[faction] = { mapsWon: {}, starSum: 0, starRuns: 0 });
      f.mapsWon[mapId] = true;
      if (Array.isArray(waveStars) && waveStars.length) {
        f.starSum += waveStars.reduce((a, w) => a + w.stars, 0) / (totalWaves || waveStars.length);
        f.starRuns += 1;
      }
    }
    if (result === 'win') {
      m.beaten = true;
      const sc = finalScore && typeof finalScore.score === 'number' ? finalScore.score : null;
      if (sc != null && (m.bestScore == null || sc > m.bestScore)) m.bestScore = sc;
      if (Array.isArray(waveStars) && waveStars.length) {
        const stars = waveStars.map((w) => w.stars);
        const avg = Math.round((stars.reduce((a, b) => a + b, 0) / (totalWaves || stars.length)) * 10) / 10;
        if (m.avg == null || avg > m.avg) { m.stars = stars; m.avg = avg; }   // keep the BEST run
        if (mapId < 9 && (m.avg || 0) >= STAR_GATE) s.unlockedThrough = Math.max(s.unlockedThrough, mapId + 1);
      } else if (mapId < 9) {
        s.unlockedThrough = Math.max(s.unlockedThrough, mapId + 1);   // no star data — beat-gate fallback
      }
    }
  });
}

export function resetSave() {
  return writeSave(defaultSave());
}
