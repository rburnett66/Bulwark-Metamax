/**
 * src/save/missionFlow.js — how missions reach the log and leave it [MM-story_mvzkd148_1j]. Mission-Log-Design §11.
 *
 * Capital ships [MM-story_mw12m06h_1]: a planet's faction flagship arrives when that planet's map 3 is won at an average
 * of 3 stars or more. Until then the Collective ship, the player's first employer and always present, grants and
 * collects the planet's maps 1-3 missions; maps 4-9 are granted and collected aboard the planet's own ship. Collecting
 * is what moves a quest line.
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
import { logMission, claim, bankBattle, missionStatus, failMission, alignmentBand, factionOfPlanet, refreshSaveObjectives } from './missions.js';
import { measureOnline, measureOreSold, measureRaidsHeld, contractStepCollected, planetKeyOf } from '../outpost/contract.js';
import { farmingOpen, measureFarmPlanted, measureCropDelivered, measureMethodsGrowing, farmStepCollected } from '../farm/contract.js';
import { bankHarvest } from './inventory.js';
import { battlePods } from '../farm/pods.js';
import { recordDelivered, battleDelivery } from '../farm/unlock.js';
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
/** The map whose ≥ 3★ win brings a planet's capital ship, and the ship that serves maps 1..SHIP_MAP until then. */
export const SHIP_MAP = 3;
export const COLLECTIVE_SHIP = 'the Collective ship';   // = missions.json collective.ship (missionFlow.test checks)
/** Is the ship this mission is collected at in orbit? The Collective ship always is. */
export const collectShipHere = (s, m) => m.collectAt === COLLECTIVE_SHIP || shipArrived(s, m.planet);

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
  // the outpost contracts (Outpost tech plan §5.2) [MM-story_mw5oe8km_k]: param is the planet key, or the ore id
  outpost_online: (s, c) => measureOnline(s, c.param) === 1,
  ore_sold: (s, c) => measureOreSold(s, c.param) >= c.value,
  raids_held: (s, c) => measureRaidsHeld(s, c.param) >= c.value,
  outpost_contract_step: (s, c) => (((s.outpostContracts || {})[c.param] || {}).step || 0) >= c.value,
  // the farming contracts (Farming tech plan §5 A5) [MM-story_mwabgpsa_e]: the gate is a Rig Mk II at the planet's outpost
  farming_open: (s, c) => farmingOpen(s, c.param),
  farm_plots_planted: (s, c) => measureFarmPlanted(s, c.param) >= c.value,
  crop_delivered: (s, c) => measureCropDelivered(s, c.param) >= c.value,
  farm_methods_growing: (s, c) => measureMethodsGrowing(s, c.param) >= c.value,
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
  if (mapId === SHIP_MAP && rec.bestAvg >= STAR_GATE && !shipArrived(s, planet)) {
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
  // every unit banked counts toward its crop's seed pod unlock (owner rule 10) [MM-story_mwatmukb_1j]
  out.podsUnlocked = result.tally ? recordDelivered(s, battleDelivery(result.planet, result.tally.harvested || result.tally.kept)) : [];
  // Rare seed pods from every unit the harvesters carried home (Farming-Design §9.1: "per 200 units carried"), after
  // the battle (tech plan §2.3 F9) [MM-story_mwabgh3x_b]. Not just the surplus over the Collective's quota.
  out.pods = result.tally ? battlePods(s, result.planet, result.tally.harvested || result.tally.kept) : {};
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

/**
 * Something changed at an outpost (accepted, online, a sale, a raid): re-read the outpost missions' objectives and log
 * any mission whose gate it opened. → { progressed, ready, logged }.
 */
export function settleOutpost(s, catalog, ctx = flowCtx(s)) {
  const out = refreshSaveObjectives(s, ctx);
  out.logged = syncMissions(s, catalog, ctx).map((m) => m.id);
  return out;
}

/** Why a Ready mission cannot be collected yet, or null: the planet's ship must be in orbit. */
export function collectBlock(s, m) {
  if (missionStatus(m, s) !== 'ready') return 'Not ready';
  return collectShipHere(s, m) ? null : 'Waiting for ' + m.collectAt;
}

/** Collect a Ready mission aboard its ship: the rewards bank, the quest line moves, its next step can be granted. */
export function collect(s, id, catalog, ctx = flowCtx(s)) {
  const m = s.missions.find((x) => x.id === id);
  if (!m || collectBlock(s, m)) return null;
  const ledger = claim(s, id, catalog, { now: ctx.now });
  if (!ledger) return null;
  s.questSteps[m.questLine] = Math.max(s.questSteps[m.questLine] || 0, m.step);
  if (m.type === 'outpost') contractStepCollected(s, planetKeyOf(m.planet), m.step, { now: ctx.now === undefined ? Date.now() : ctx.now });
  if (m.type === 'farm') farmStepCollected(s, planetKeyOf(m.planet), m.step, { now: ctx.now === undefined ? Date.now() : ctx.now });
  return { ledger, logged: syncMissions(s, catalog, ctx).map((x) => x.id) };
}
