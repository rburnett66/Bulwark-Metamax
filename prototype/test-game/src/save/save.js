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
 *   progress         { xp } commander XP (data/progression.js) [MM-story_mvkhef1t_i]
 *   tech             { owned: {id: true}, paid: {id: gold} } the Tech Tree (data/techtree.js) [MM-story_mvkhed1f_h]
 *   seen             what the menu's red-dot badges last showed (menu/badges.js) [MM-story_mvkhei9q_k]
 *   pendingRewards   the last battle(s)' rewards, waiting to fly into the menu widget [MM-story_mvkhegop_j]
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
    structTiers: { cannon: 1, flak: 1, wall: 1 },   // Amendment B2: max in-battle tier unlocked per type (gold-bought)
    techNodes: {},       // Tech Tree epic: { [nodeId]: true } researched upgrades (gold-bought). Clearance
                         // (which tiers are buyable) DERIVES from Map-2 faction wins — see techClearance().
    alignment: 0,        // the good/evil axis (owner): finishing a good hero's contract raises it,
                         // an evil hero's lowers it — the 81-character matrix supplies the givers
    progress: { xp: 0 },
    tech: { owned: {}, paid: {} },
    seen: {},
    pendingRewards: null,
  };
}

function migrate(s) {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return defaultSave();
  // v1 field fills (schema grew within v1 during the epic — additive, no version bump needed)
  if (typeof s.alignment !== 'number') s.alignment = 0;
  if (!s.factionRecords) s.factionRecords = {};
  if (!s.structTiers) s.structTiers = { cannon: 1, flak: 1, wall: 1 };
  if (!s.techNodes) s.techNodes = {};
  if (!s.progress || typeof s.progress.xp !== 'number') s.progress = { xp: 0 };
  if (!s.tech || typeof s.tech !== 'object' || !s.tech.owned) s.tech = { owned: {}, paid: {} };
  if (!s.tech.paid) s.tech.paid = {};
  if (!s.seen || typeof s.seen !== 'object') s.seen = {};
  if (s.pendingRewards === undefined) s.pendingRewards = null;
  return s;
}

/** Tech-tree clearance (0..4): the number of DISTINCT factions the player has beaten on Map 2,
 *  in any order. Gates which tier of tech-tree upgrades is buyable. Reads factionRecords, which
 *  recordResult() already stamps with mapsWon[mapId] per faction. */
export function techClearance(s = loadSave()) {
  const fr = s.factionRecords || {};
  let n = 0;
  for (const f of Object.keys(fr)) if (fr[f] && fr[f].mapsWon && fr[f].mapsWon[2]) n += 1;
  return Math.min(4, n);
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
    // the SECONDARY dialog character (tips & story) is earned by a 5-star wave in the last battle
    s.lastRunFiveStar = Array.isArray(waveStars) && waveStars.some((w) => w.stars === 5);
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

// ── PROGRESSION + BATTLE REWARDS (docs/16 Bulwark MM/design/Menu-Progression-Design.md §2–3) ─────────────────────
/** Total best stars over every map. */
export function totalStars(s) {
  let n = 0;
  for (const m of Object.values((s && s.maps) || {})) if (m && Array.isArray(m.stars)) n += m.stars.reduce((a, b) => a + (b || 0), 0);
  return n;
}
export const bankOf = (s) => (s && s.carry && s.carry.gold) || 0;
/**
 * PURE: the rewards one battle earns. before = the save before recordResult, after = the save after it.
 * battle = { mapId, result, finalScore, waveStars, totalWaves, xpFor } (xpFor = progression.xpForBattle).
 * → { ledger, bankTo, xpTo } — ledger = { mapId, result, gold:{earned,from,to}, stars:{from,to}, xp:{earned,from,to} }.
 * A WIN banks the leftover gold (the same thing NEXT MAP does); a loss leaves the bank alone. Map 0 earns nothing.
 */
export function battleRewards(before, after, battle) {
  const win = battle.result === 'win', fs = battle.finalScore || {};
  const bankFrom = bankOf(before), xpFrom = (before.progress && before.progress.xp) || 0;
  const campaign = !!battle.mapId;
  const goldEarned = campaign && win ? Math.max(0, Math.floor(fs.goldRemaining || 0)) : 0;
  const bankTo = campaign && win ? goldEarned : bankFrom;
  const ws = Array.isArray(battle.waveStars) ? battle.waveStars : [];
  const avgStars = ws.length ? ws.reduce((a, w) => a + (w.stars || 0), 0) / (battle.totalWaves || ws.length) : 0;
  const xpEarned = battle.xpFor ? battle.xpFor({ mapId: battle.mapId, result: battle.result, avgStars, kills: fs.kills || 0 }) : 0;
  return {
    bankTo, xpTo: xpFrom + xpEarned,
    ledger: { mapId: battle.mapId | 0, result: battle.result, battles: 1,
      gold: { earned: goldEarned, from: bankFrom, to: bankTo },
      stars: { from: totalStars(before), to: totalStars(after) },
      xp: { earned: xpEarned, from: xpFrom, to: xpFrom + xpEarned } },
  };
}
/** Two battles before the menu was seen add up: the first one's from-values, the latest to-values. */
export function mergeRewards(prev, next) {
  if (!prev) return next;
  return { ...next, battles: (prev.battles || 1) + 1,
    gold: { earned: prev.gold.earned + next.gold.earned, from: prev.gold.from, to: next.gold.to },
    stars: { from: prev.stars.from, to: next.stars.to },
    xp: { earned: prev.xp.earned + next.xp.earned, from: prev.xp.from, to: next.xp.to } };
}
/** Settle a finished battle's rewards into the save (call right after recordResult). Returns this battle's ledger. */
export function grantBattleRewards(before, battle) {
  let ledger = null;
  updateSave((s) => {
    const r = battleRewards(before, s, battle);
    ledger = r.ledger;
    if (!battle.mapId) return;
    if (battle.result === 'win') { s.carry = { gold: r.bankTo, structures: [] }; s.goldBank = r.bankTo; }
    s.progress = { xp: r.xpTo };
    s.pendingRewards = mergeRewards(s.pendingRewards, r.ledger);
  });
  return ledger;
}
/** The menu takes the pending rewards once (and clears them). */
export function takePendingRewards() {
  let r = null;
  updateSave((s) => { r = s.pendingRewards || null; s.pendingRewards = null; });
  return r;
}

// ── TECH TREE purchases (data/techtree.js decides what may be bought; this moves the gold) ───────────────────────
export function buyTech(id, price) {
  let ok = false;
  updateSave((s) => {
    if (s.tech.owned[id]) return;
    if (bankOf(s) < price) return;
    s.carry = s.carry || { gold: 0, structures: [] };
    s.carry.gold -= price; s.goldBank = s.carry.gold;
    s.tech.owned[id] = true; s.tech.paid[id] = price;
    ok = true;
  });
  return ok;
}
export function refundTech(id) {
  let ok = false;
  updateSave((s) => {
    if (!s.tech.owned[id]) return;
    const back = s.tech.paid[id] || 0;
    s.carry = s.carry || { gold: 0, structures: [] };
    s.carry.gold += back; s.goldBank = s.carry.gold;
    delete s.tech.owned[id]; delete s.tech.paid[id];
    ok = true;
  });
  return ok;
}
/** The menu badges' memory: seen[key] = value. */
export function markSeen(key, value) { return updateSave((s) => { s.seen[key] = value; }); }

/** Amendment B2 — structure tier unlock economy: gold buys the RIGHT to upgrade in battle,
 *  per type, on a strict ladder. Costs: [T2, T3]. T4 lands with tables + art. */
export const TIER_COSTS = { cannon: [600, 1500], flak: [600, 1500], wall: [400, 1000] };
export function buyStructTier(type, tier) {
  let ok = false;
  updateSave((s) => {
    const cur = (s.structTiers && s.structTiers[type]) || 1;
    const cost = (TIER_COSTS[type] || [])[tier - 2];
    if (tier !== cur + 1 || cost == null) return;
    if (!s.carry || (s.carry.gold || 0) < cost) return;
    s.carry.gold -= cost;
    s.goldBank = s.carry.gold;
    s.structTiers[type] = tier;
    ok = true;
  });
  return ok;
}

/** Tech Tree epic — research a node: spend the gold bank, mark it owned. Mirrors buyStructTier's
 *  gold source (carry.gold, mirrored to goldBank). Clearance is enforced by the caller (the screen),
 *  but we still guard cost + already-owned here. Returns true on success. */
export function buyResearch(nodeId, cost) {
  let ok = false;
  updateSave((s) => {
    if (!s.techNodes) s.techNodes = {};
    if (s.techNodes[nodeId]) return;                       // already researched
    if (!s.carry || (s.carry.gold || 0) < cost) return;    // not enough banked gold
    s.carry.gold -= cost;
    s.goldBank = s.carry.gold;
    s.techNodes[nodeId] = true;
    ok = true;
  });
  return ok;
}
