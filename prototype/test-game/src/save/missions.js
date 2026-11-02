/**
 * src/save/missions.js — the Mission Log's records [MM-story_mvyqol3w_d]. docs/tech-plan/Mission-Log.md §2–3.
 *
 * PURE: every function takes the save object and changes only that (the caller wraps it in updateSave). No DOM and no
 * sim access. Progress moves at BATTLE END only (D2), from a result built once by battleResult(); the sim never sees a
 * mission, so replays and balanceSim are untouched.
 *
 * A record enters save.missions at the moment it is assigned (D1). `failed` and `done` are stored; the live states are
 * computed by missionStatus(), so the list, the header badge and the tests can never disagree (D3).
 *
 * Counting rule. Haul, harvest and kill objectives ADD UP over every battle that counts. "In one battle" objectives
 * (gold spent, wave flags, five-star waves, finish time) keep the BEST single battle. A condition this file cannot
 * measure THROWS: an objective that silently never moves would look like a hard mission rather than a bug.
 */
import { addLoyalty, rivalOf, DECLINE } from './contracts.js';
import { bankOf, totalStars, mergeRewards } from './save.js';
import { mergeTally } from './battleTally.js';
import { PLANETS } from '../data/planets.js';
// Faction registry: a classic script with no ES exports (see comm/voice.js).
import '../data/factions.js';
const REG = globalThis.BulwarkFactions;

const WAVE_FLAG = Object.freeze({ waves_no_base_damage: 0, waves_no_harvester_lost: 1, waves_quota_met: 2, waves_premium_claimed: 3, waves_under_par: 4 });
const count = (result, i) => (result.waveStars || []).filter((w) => w.flags && w.flags[i]).length;

/** One battle's contribution, per Complete condition. add = cumulative, best = best single battle. */
const MEASURE = Object.freeze({
  win_map: { latch: true, need: () => 1, v: (r, o) => (r.result === 'win' && r.mapId === o.value ? 1 : 0) },
  planet_map_beaten: { latch: true, need: () => 1, v: (r, o) => (r.result === 'win' && r.mapId === o.value ? 1 : 0) },
  planet_map_stars: { best: true, need: (o) => o.value, v: (r) => (r.result === 'win' ? r.avgStars : 0) },
  finish_under: { latch: true, need: () => 1, v: (r, o) => (r.result === 'win' && r.totalSeconds < o.value * 60 ? 1 : 0) },
  harvest_common_gold: { need: (o) => o.value, v: (r) => r.goldCommon },
  harvest_uncommon_gold: { need: (o) => o.value, v: (r) => r.goldUncommon },
  haul_rare: { need: (o) => o.value, v: (r) => r.rare },
  haul_epic: { need: (o) => o.value, v: (r) => r.epic },
  kills_total: { need: (o) => o.value, v: (r) => r.kills },
  kills_domain: { need: (o) => o.value, v: (r, o) => (r.tally ? r.tally.kills.byDomain[o.param] || 0 : 0) },
  gold_spent: { best: true, need: (o) => o.value, v: (r) => r.goldSpent },
  five_star_waves: { best: true, need: (o) => o.value, v: (r) => (r.waveStars || []).filter((w) => w.stars === 5).length },
  walls_lost_max: { limit: true, need: (o) => o.value, v: (r) => (r.tally ? r.tally.structures.lost.wall || 0 : 0) },
  ...Object.fromEntries(Object.entries(WAVE_FLAG).map(([k, i]) => [k, { best: true, need: (o) => o.value, v: (r) => count(r, i) }])),
});
/** Complete conditions read from the save rather than from a battle. */
const SAVE_MEASURE = Object.freeze({
  rank_at_least: (s, o, ctx) => (ctx.level ? ctx.level(s) : 0),
  loyalty: (s, o) => (s.loyalty || {})[o.param] || 0,
});
export const MEASURED_CONDITIONS = Object.freeze([...Object.keys(MEASURE), ...Object.keys(SAVE_MEASURE)]);

export const planetKey = (planet) => Object.keys(PLANETS).find((k) => PLANETS[k].name === planet) || null;
export function planetOfFaction(factionName) {
  const f = REG.find(factionName);
  return f && PLANETS[f.key] ? PLANETS[f.key].name : null;
}
export function factionOfPlanet(planet) {
  const k = planetKey(planet), f = k && REG.find(k);
  return f ? f.name : null;
}

function objectiveFromDef(req, i) {
  const m = MEASURE[req.cond], sm = SAVE_MEASURE[req.cond];
  if (!m && !sm) throw new Error('missions: no way to measure Complete condition "' + req.cond + '"');
  const o = { id: 'o' + i, cond: req.cond, text: req.text, have: 0, need: m ? m.need(req) : req.value };
  for (const k of ['param', 'op', 'value']) if (req[k] !== undefined) o[k] = req[k];
  if (req.bonus) o.bonus = true;
  if (m && m.limit) o.limit = true;
  return o;
}

/** Assign a mission: the record is written now, never later (D1). Logging the same id twice is a no-op. */
export function logMission(s, def, { now = Date.now() } = {}) {
  const live = s.missions.find((m) => m.id === def.id);
  if (live) return null;
  const rec = {
    id: def.id, type: def.type, role: def.role, variant: def.variant || null, questLine: def.questLine, step: def.step,
    planet: def.planet, map: def.map, title: def.title, briefing: def.briefing,
    giver: { ...def.giver }, grantedAt: def.grantedAt, collectAt: def.collectAt,
    objectives: def.complete.map(objectiveFromDef),
    execute: def.execute.map((e) => ({ ...e })), fail: (def.fail || []).map((e) => ({ ...e })),
    rewards: def.rewards.map((r) => ({ ...r })), impact: { ...(def.impact || {}) }, gates: (def.unlock || []).map((e) => ({ ...e })),
    assignedBattle: (s.progress && s.progress.battles) || 0, assignedAt: now, endedBattle: null, endedAt: null,
    seen: false, tracked: false, end: null, endReason: null,
  };
  s.missions.push(rec);
  return rec;
}

/** The band a Light/Shadow mission must stay inside, from its own gates. */
export function alignmentBand(m) {
  const band = {};
  for (const g of m.gates || []) if (g.cond === 'alignment') { if (g.op === '≥') band.min = g.value; else if (g.op === '≤') band.max = g.value; }
  return band;
}

const objectiveMet = (o) => (o.limit ? o.have <= o.need : (o.op === '≤' && !MEASURE[o.cond] ? o.have <= o.need : o.have >= o.need));
const required = (m) => m.objectives.filter((o) => !o.bonus && !o.limit);

/** Required objectives only; limits and bonuses are excluded (design §3). Fractional stars count by the unit. */
export function progress(m) {
  const req = required(m);
  const have = req.reduce((a, o) => a + Math.min(o.have, o.need), 0), need = req.reduce((a, o) => a + o.need, 0);
  return { have, need, frac: need ? have / need : 0, done: req.every(objectiveMet) && m.objectives.filter((o) => o.limit).every(objectiveMet) };
}

/** One step from failing: a limit about to break, or the alignment band about to be left. */
export function atRisk(m, s) {
  if (m.objectives.some((o) => o.limit && o.have >= o.need)) return true;
  if ((m.fail || []).some((f) => f.cond === 'alignment_flips')) {
    const b = alignmentBand(m), a = s.alignment || 0;
    if ((b.min !== undefined && a <= b.min) || (b.max !== undefined && a >= b.max)) return true;
  }
  return false;
}

/** 'done' | 'failed' | 'ready' | 'risk' | 'new' | 'active'. */
export function missionStatus(m, s) {
  if (m.end === 'done' || m.end === 'failed') return m.end;
  if (progress(m).done) return 'ready';
  if (atRisk(m, s)) return 'risk';
  return m.seen ? 'active' : 'new';
}

/** Does this battle count for this mission? An Execute condition this file does not know throws. */
export function inScope(m, result) {
  return m.execute.every((e) => {
    if (e.cond === 'on_planet') return e.param === result.planet;
    if (e.cond === 'on_map') return e.value === result.mapId;
    if (e.cond === 'next_attempt') return true;
    throw new Error('missions: unknown Execute condition "' + e.cond + '" on ' + m.id);
  });
}

function endMission(s, m, end, reason, now) {
  m.end = end; m.endReason = reason; m.endedAt = now; m.endedBattle = (s.progress && s.progress.battles) || 0;
  m.tracked = false;
}

/** Fail a mission: the broken-promise penalty lands on the planet's faction. */
export function failMission(s, m, reason, { now = Date.now() } = {}) {
  endMission(s, m, 'failed', reason, now);
  if (m.impact && m.impact.brokenPenalty) addLoyalty(s, factionOfPlanet(m.planet), m.impact.brokenPenalty);
}

/** A secondary's attempt was used up: only another replay that beats the best result offers that step again. */
function spendReplay(s, m) {
  const rec = m.role === 'secondary' && s.planetMaps && s.planetMaps[m.planet] && s.planetMaps[m.planet][m.map];
  if (rec) rec.improved = false;
}

/**
 * Advance every live mission from one finished battle. → { progressed:[id], ready:[id], failed:[id] }.
 * ctx: { level(save), now }.
 */
export function applyBattle(s, result, ctx = {}) {
  const out = { progressed: [], ready: [], failed: [] };
  const now = ctx.now === undefined ? Date.now() : ctx.now;
  for (const m of s.missions) {
    if (m.end) continue;
    const scoped = inScope(m, result);
    const wasReady = progress(m).done;
    let moved = false;
    for (const o of m.objectives) {
      if (SAVE_MEASURE[o.cond]) {
        const v = SAVE_MEASURE[o.cond](s, o, ctx);
        if (v !== o.have) { o.have = v; moved = true; }
        continue;
      }
      if (!scoped) continue;
      const def = MEASURE[o.cond];
      if (!def) throw new Error('missions: no way to measure Complete condition "' + o.cond + '" on ' + m.id);
      const v = def.v(result, o);
      const next = def.latch || def.best ? Math.max(o.have, v) : o.have + v;
      if (next !== o.have) { o.have = next; moved = true; }
    }
    if (moved) out.progressed.push(m.id);
    if (scoped) {
      const unmet = !progress(m).done;
      for (const f of m.fail || []) {
        const hit = (f.cond === 'lose_battle' && result.result !== 'win') ||
          (f.cond === 'attempt_ends_unmet' && unmet) ||
          (f.cond === 'walls_lost_max' && (result.tally ? result.tally.structures.lost.wall || 0 : 0) > f.value);
        if (hit) {
          failMission(s, m, 'attempt_ends_unmet' === f.cond ? 'Broken promise: the attempt ended short.' : f.text, { now });
          spendReplay(s, m);
          out.failed.push(m.id);
          break;
        }
      }
    }
    if (!m.end && !wasReady && progress(m).done) out.ready.push(m.id);
  }
  return out;
}

/** The one reading of a finished battle that every mission is judged from. Pure; built once at battle end. */
export function battleResult({ mapId, planet, faction, result, finalScore, mapScore, waveStars, totalWaves, tally = null }) {
  const fs = finalScore || {}, ms = mapScore || {};
  const ws = Array.isArray(waveStars) ? waveStars : [];
  const avg = ws.length ? ws.reduce((a, w) => a + (w.stars || 0), 0) / (totalWaves || ws.length) : 0;
  return {
    mapId, planet, faction, result, avgStars: Math.round(avg * 10) / 10,
    kills: fs.kills || 0, goldSpent: fs.goldSpent || 0, totalSeconds: fs.totalSeconds || 0,
    goldCommon: ms.goldFromPrimary || 0, goldUncommon: ms.goldFromPremium || 0, rare: ms.questRed || 0, epic: ms.questGreen || 0,
    waveStars: ws.map((w) => ({ stars: w.stars, flags: w.flags })), tally,
  };
}

/** Bank a finished, played battle: lifetime stats and the battle counter, then mission progress. */
export function bankBattle(s, result, ctx = {}) {
  s.progress.battles = (s.progress.battles || 0) + 1;
  if (result.tally) mergeTally(s.stats, result.tally, result.result === 'win');
  return applyBattle(s, result, ctx);
}

const resourceId = (catalog, name) => {
  const r = catalog && (catalog.resources || []).find((x) => x.name === name);
  if (!r) throw new Error('missions: reward names an unknown resource "' + name + '"');
  return r.id;
};

/**
 * Bank a Ready mission's rewards, once. → the ledger the menu flies into the header, or null when it is not Ready.
 * Uses the same pendingRewards ledger as a battle, so the rewards arrive the same way.
 */
export function claim(s, id, catalog, { now = Date.now(), level = null } = {}) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || missionStatus(m, s) !== 'ready') return null;
  const goldFrom = bankOf(s), xpFrom = (s.progress && s.progress.xp) || 0, stars = totalStars(s);
  let gold = 0, xp = 0;
  for (const r of m.rewards) {
    if (r.kind === 'gold') gold += r.amount;
    else if (r.kind === 'xp') xp += r.amount;
    else if (r.kind === 'tech_unlock') s.tech.unlocked[r.target] = true;
    else if (r.kind === 'resource') {
      const rid = resourceId(catalog, r.target);
      s.inventory[rid] = (s.inventory[rid] || 0) + r.amount;
      s.inventoryNew[rid] = (s.inventoryNew[rid] || 0) + r.amount;
    } else if (r.kind === 'alignment') s.alignment = (s.alignment || 0) + r.amount;
    else if (r.kind === 'loyalty') addLoyalty(s, r.target, r.amount);
    else throw new Error('missions: unknown reward kind "' + r.kind + '" on ' + m.id);
  }
  if (gold) { s.carry = s.carry || { gold: 0, structures: [] }; s.carry.gold = (s.carry.gold || 0) + gold; s.goldBank = s.carry.gold; }
  if (xp) s.progress.xp = xpFrom + xp;
  const faction = factionOfPlanet(m.planet);
  if (m.impact.loyaltyPlanet) addLoyalty(s, faction, m.impact.loyaltyPlanet);
  if (m.impact.loyaltyRival) addLoyalty(s, rivalOf(faction), m.impact.loyaltyRival);
  if (m.impact.alignment) s.alignment = (s.alignment || 0) + m.impact.alignment;
  endMission(s, m, 'done', null, now);
  const ledger = { kind: 'mission', title: m.title, mapId: m.map, result: 'win', battles: 1,
    gold: { earned: gold, from: goldFrom, to: goldFrom + gold }, stars: { from: stars, to: stars }, xp: { earned: xp, from: xpFrom, to: xpFrom + xp } };
  s.pendingRewards = mergeRewards(s.pendingRewards, ledger);
  return ledger;
}

/** Give up a secondary: the decline rules (giver −30, rival +50 % of that). Primaries cannot be abandoned. */
export function abandon(s, id, { now = Date.now() } = {}) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || m.end || m.role === 'primary') return false;
  const faction = factionOfPlanet(m.planet), rival = rivalOf(faction);
  addLoyalty(s, faction, -DECLINE.cost);
  if (rival) addLoyalty(s, rival, Math.round(DECLINE.cost * DECLINE.rivalGain));
  endMission(s, m, 'failed', 'Abandoned by the commander.', now);
  spendReplay(s, m);
  return true;
}

/** Remove a failed mission from the log. */
export function dismiss(s, id) {
  const i = s.missions.findIndex((m) => m.id === id && m.end === 'failed');
  if (i < 0) return false;
  s.missions.splice(i, 1);
  return true;
}

/** Opening a dossier clears New. */
export function markMissionSeen(s, id) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || m.seen) return false;
  m.seen = true;
  return true;
}

/** At most one tracked mission (D5). Tracking a live mission replaces the last; tracking it again clears it. */
export function setTracked(s, id) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || m.end) return null;
  const on = !m.tracked;
  for (const x of s.missions) x.tracked = false;
  m.tracked = on;
  return on ? m.id : null;
}

export const trackedMission = (s) => (s.missions || []).find((m) => m.tracked && !m.end) || null;

/**
 * The battle HUD's tracker line (D5): the mission's progress if this battle ended now. A read-only look at the sim's
 * existing counters: nothing is written, to the sim or to the record. null when this battle does not count for it.
 */
export function trackerLine(m, state, { mapId, planet } = {}) {
  if (!m || !state) return null;
  const live = battleResult({ mapId, planet, result: 'win', mapScore: state.mapScore, waveStars: state.waveStars, totalWaves: state.waves ? state.waves.total : 8,
    finalScore: { kills: state.economy ? state.economy.kills || 0 : 0, goldSpent: state.goldSpent || 0, totalSeconds: Math.floor(state.time || 0) } });
  if (!inScope(m, live)) return null;
  let have = 0, need = 0;
  for (const o of m.objectives) {
    const def = MEASURE[o.cond];
    if (o.bonus || o.limit || !def) continue;
    if (o.cond === 'win_map' || o.cond === 'planet_map_beaten' || o.cond === 'finish_under') { need += o.need; have += Math.min(o.have, o.need); continue; }   // only a finished battle can settle these
    const v = def.v(live, o), now = def.best ? Math.max(o.have, v) : o.have + v;
    need += o.need; have += Math.min(now, o.need);
  }
  return m.title + ' · ' + Math.round(need ? (have / need) * 100 : 0) + '%';
}

/** The header's numbers: Ready to claim, unopened New, everything else in progress. */
export function badge(s) {
  const out = { ready: 0, fresh: 0, active: 0 };
  for (const m of s.missions || []) {
    const st = missionStatus(m, s);
    if (st === 'ready') out.ready += 1;
    else if (st === 'new') { out.fresh += 1; out.active += 1; } else if (st === 'risk' || st === 'active') out.active += 1;
    if ((st === 'risk') && !m.seen) out.fresh += 1;
  }
  return out;
}
