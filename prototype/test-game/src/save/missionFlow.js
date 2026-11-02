/**
 * src/save/missionFlow.js — how missions reach the log and leave it [MM-story_mvzkd148_1j]. Mission-Log-Design §11.
 *
 * Capital ships: a planet's faction flagship arrives when that planet's first map is won at an average of 3 stars or
 * more. Missions are granted aboard it, and Ready rewards are collected there; collecting is what moves a quest line.
 * Every gate here comes from the mission's own View / Unlock rows in content/missions/missions.json.
 *
 * Secondaries [MM-story_mvzkd2t8_1k]: a replay that beats a map's best average offers that map's optional secondary,
 * in the Light or Shadow version the commander's alignment history selects, for one attempt: the next battle on that
 * map. Leaving the band before collection withdraws it. Either version of a step moves the favours line, so a commander
 * whose alignment flips carries on with the other path.
 *
 * Pure: functions change only the save object they are given. A condition this file does not know throws, so a new
 * row in the workbook cannot quietly leave a mission locked forever.
 */
import { STAR_GATE } from './save.js';
import { logMission, claim, bankBattle, missionStatus, failMission, alignmentBand, factionOfPlanet } from './missions.js';
import { bankHarvest } from './inventory.js';
import { levelFromXp } from '../data/progression.js';
import { techCtxFromSave, planetOpen } from '../menu/techSave.js';

/** What the gates read that is not in the save. opts.allOpen: the menu's ?planets=locked preview of the portal gate. */
export function flowCtx(s, opts = {}) {
  const tc = techCtxFromSave(s);
  return {
    level: (x) => levelFromXp((x.progress && x.progress.xp) || 0).level,
    owns: (id) => tc.owned.has(id),
    planetOpen: (name) => planetOpen(tc, name, opts.allOpen === undefined ? undefined : { allOpen: opts.allOpen }),
    now: opts.now,
  };
}

export const mapRecord = (s, planet, map) => ((s.planetMaps || {})[planet] || {})[map] || null;
export const shipArrived = (s, planet) => !!((s.capitalShips || {})[planet] && s.capitalShips[planet].arrived);

function compare(have, op, want) {
  if (op === '≥') return have >= want;
  if (op === '≤') return have <= want;
  if (op === '=' || op === undefined) return have === want;
  throw new Error('missions: unknown comparison "' + op + '"');
}

/** Is one View / Unlock row met right now? */
const GATE = Object.freeze({
  rank_at_least: (s, c, ctx) => ctx.level(s) >= c.value,
  alignment: (s, c) => compare(s.alignment || 0, c.op, c.value),
  tech_node: (s, c, ctx) => ctx.owns(c.param),
  loyalty: (s, c) => compare((s.loyalty || {})[c.param] || 0, c.op || '≥', c.value),
  planet_open: (s, c, ctx) => ctx.planetOpen(c.param),
  planet_map_unlocked: (s, c) => c.value <= 1 || !!(mapRecord(s, c.param, c.value - 1) || {}).beaten,
  planet_map_beaten: (s, c) => !!(mapRecord(s, c.param, c.value) || {}).beaten,
  planet_map_stars: (s, c) => ((mapRecord(s, c.param, c.value) || {}).bestAvg || 0) >= c.value,
  replay_improves: (s, c) => !!(mapRecord(s, c.param, c.value) || {}).improved,
  capital_ship_arrived: (s, c) => shipArrived(s, c.param),
  quest_step_collected: (s, c) => ((s.questSteps || {})[c.param] || 0) >= c.value,
});
export const GATE_CONDITIONS = Object.freeze(Object.keys(GATE));

export function gateMet(s, c, ctx) {
  const fn = GATE[c.cond];
  if (!fn) throw new Error('missions: unknown gate condition "' + c.cond + '"');
  return !!fn(s, c, ctx);
}

export const viewMet = (s, def, ctx) => (def.view || []).every((c) => gateMet(s, c, ctx));
export const unlockMet = (s, def, ctx) => (def.unlock || []).every((c) => gateMet(s, c, ctx));

/** A live mission whose alignment band was left is withdrawn. → the ids withdrawn. */
export function reviewAlignment(s, ctx = {}) {
  const out = [];
  for (const m of s.missions) {
    if (m.end || !(m.fail || []).some((f) => f.cond === 'alignment_flips')) continue;
    const b = alignmentBand(m), a = s.alignment || 0;
    if ((b.min !== undefined && a < b.min) || (b.max !== undefined && a > b.max)) {
      failMission(s, m, 'Withdrawn: your alignment history left the ' + (m.variant === 'shadow' ? 'Shadow' : 'Light') + ' band.', { now: ctx.now });
      out.push(m.id);
    }
  }
  return out;
}

/** This step of the line was already collected (by either version): its other version is never offered. */
const stepTaken = (s, def) => ((s.questSteps || {})[def.questLine] || 0) >= def.step;

/** Log every mission whose gates are now met. → the records logged. Called wherever a gate can have changed. */
export function syncMissions(s, catalog, ctx = flowCtx(s)) {
  reviewAlignment(s, ctx);
  const logged = [];
  for (const def of catalog.missions) {
    if (stepTaken(s, def)) continue;
    const old = s.missions.findIndex((m) => m.id === def.id);
    if (old >= 0 && s.missions[old].end !== 'failed') continue;
    if (viewMet(s, def, ctx) && unlockMet(s, def, ctx)) {
      if (old >= 0) s.missions.splice(old, 1);   // offered again: a new replay beat the best, or the band came back
      const rec = logMission(s, def, { now: ctx.now });
      logged.push(rec);
      s.loggedQueue.push({ kind: 'mission', id: rec.id });
    }
  }
  return logged;
}

/** Visible but not yet granted: the "Locked — next steps" group. Derived from the catalogue, never stored. */
export function lockedMissions(s, catalog, ctx = flowCtx(s)) {
  return catalog.missions.filter((def) => !stepTaken(s, def) && !s.missions.some((m) => m.id === def.id) && viewMet(s, def, ctx) && !unlockMet(s, def, ctx));
}

/** The per-planet map record, and the capital ship's arrival. → { arrived: planet | null }. */
export function recordPlanetMap(s, result) {
  const { planet, mapId } = result;
  if (!planet || !mapId) return { arrived: null };
  const byMap = s.planetMaps[planet] || (s.planetMaps[planet] = {});
  const rec = byMap[mapId] || (byMap[mapId] = { beaten: false, bestAvg: null, runs: 0, improved: false });
  rec.runs += 1;
  if (result.result !== 'win') return { arrived: null };
  if (rec.beaten && result.avgStars > rec.bestAvg) rec.improved = true;   // a replay that beats the best offers the secondary
  rec.beaten = true;
  if (rec.bestAvg === null || result.avgStars > rec.bestAvg) rec.bestAvg = result.avgStars;
  if (mapId === 1 && rec.bestAvg >= STAR_GATE && !shipArrived(s, planet)) {
    s.capitalShips[planet] = { arrived: true };
    s.loggedQueue.push({ kind: 'ship', planet });
    return { arrived: planet };
  }
  return { arrived: null };
}

/** Everything a finished, played battle changes in the log. */
export function settleBattle(s, result, catalog, ctx = flowCtx(s)) {
  const out = bankBattle(s, result, ctx);
  out.harvested = bankHarvest(s, result, catalog);
  out.arrived = recordPlanetMap(s, result).arrived;
  out.logged = syncMissions(s, catalog, ctx).map((m) => m.id);
  return out;
}

/** The secondary whose one attempt ended in this battle, for the giver's closing word and the result message. */
export function resolvedSecondary(s, out) {
  const ended = [...out.failed.map((id) => [id, 'BROKEN']), ...out.ready.map((id) => [id, 'FULFILLED'])];
  for (const [id, outcome] of ended) {
    const m = s.missions.find((x) => x.id === id);
    if (m && m.role === 'secondary') return { id, title: m.title, giver: factionOfPlanet(m.planet), outcome, ship: m.collectAt, penalty: m.impact.brokenPenalty || 0 };
  }
  return null;
}
export function favourMessage(f) {
  return f.outcome === 'FULFILLED' ? 'FAVOUR KEPT — ' + f.title + ': collect aboard ' + f.ship
    : 'FAVOUR BROKEN — ' + f.title + (f.penalty ? ': ' + f.penalty + ' ' + f.giver + ' loyalty' : '');
}

/** Why a Ready mission cannot be collected yet, or null: the planet's ship must be in orbit. */
export function collectBlock(s, m) {
  if (missionStatus(m, s) !== 'ready') return 'Not ready';
  return shipArrived(s, m.planet) ? null : 'Waiting for ' + m.collectAt;
}

/** Collect a Ready mission aboard its ship: the rewards bank, the quest line moves, its next step can be granted. */
export function collect(s, id, catalog, ctx = flowCtx(s)) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || collectBlock(s, m)) return null;
  const ledger = claim(s, id, catalog, { now: ctx.now });
  if (!ledger) return null;
  s.questSteps[m.questLine] = Math.max(s.questSteps[m.questLine] || 0, m.step);
  return { ledger, logged: syncMissions(s, catalog, ctx).map((x) => x.id) };
}
