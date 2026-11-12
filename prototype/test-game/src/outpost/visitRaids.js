/**
 * src/outpost/visitRaids.js — the small raids that come while the player is AT the outpost, as WAVES of the live battle
 * SimState [MM-subtask_mwcij14c_33] (S2.4c of One Battle UX; owner rules TECH_PLAN::One-Battle-UX.md §5b).
 *
 * Owner 2026-11-11: "low level raids that started 1 to 2 minutes after you visit … The player should be able to see their
 * defenses hold up, and do repairs or upgrades before they go … Players collect gold on outpost kills just like battle."
 * The old view stepped each probe in a raid sim of its own beside the scene (visitProbe.js startProbe). Here a probe is
 * simply the next wave of the live SimState (sim/waves.js startNextWave): it spawns down the raid lanes, the player's
 * defenses fight it with the battle's combat, and every kill pays the battle bounty into the live economy
 * (combat.grantKillIncome) — no combat or reward code of the outpost's own.
 *
 * The timing and the raiders (probeDelay: the first at 45–75 s, then 100–180 s after the last one clears; probeUnits:
 * the planet's light tank and a trooper, a second tank every other probe) are the old view's probes' (visitProbe.js,
 * moved here in S6 when that view was deleted [MM-story_mwc9q1y6_2n]).
 * The raiders follow the outpost's raid rules (raid.js raiderRules: raid-only strength — probeRules below, the step-1
 * raid's multipliers × Outpost_Params Probe_Strength, so a probe stays mild [MM-task_mwcutmnk_3h] — range cap, fire while advancing;
 * siegeRoutes: walls may seal the ramps, so an idle raider marches on the first defense in its way) and pull back after
 * PROBE_MAX_S, held or not — the same rules a raid runs, shared, not copied.
 * Deterministic: probe times come from the outpost seed and run on SIM time, never the wall clock.
 *
 *   const raids = createVisitRaids(state, { planet, seed });
 *   …after each fixed sim step: raids.step();
 *   raids.takeCells() → the cells the last cleared probe's raiders stood on, once (the farm is trampled by them, S6)
 */
import { startNextWave } from '../sim/waves.js';
import { buildNavGrid } from '../sim/pathfinding.js';
import { raidFor, OUTPOST } from '../data/outpost.js';
import { raiderRules, siegeRoutes } from './raid.js';

/** When probes come, in seconds of visit time: the first, then the gap after each one ends. */
export const PROBE_FIRST_S = [45, 75];
export const PROBE_GAP_S = [100, 180];
/** A probe gives up and pulls back after this long, held or not. */
export const PROBE_MAX_S = 90;

function mix(a, b) {
  let h = ((a >>> 0) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seconds until probe number n (0 = the first) comes, after the visit opens (n = 0) or the last probe ends. */
export function probeDelay(seed, n) {
  const [lo, hi] = n === 0 ? PROBE_FIRST_S : PROBE_GAP_S;
  return lo + (mix(seed, 0x9b0 + n) % 1000) / 1000 * (hi - lo);
}

/** The probe's raiders: the planet's light tank and a trooper, and a second tank every other probe. [] without data. */
export function probeUnits(planet, n = 0) {
  const r = raidFor(planet, 1);
  if (!r || !r.units.length) return [];
  const tank = r.units.find((u) => /-Tanks$/.test(u)) || r.units[0];
  const troop = r.units.find((u) => /-Troops$/.test(u)) || r.units[0];
  return n % 2 ? [tank, troop, tank] : [tank, troop];
}

/**
 * A probe's raid-only strength (owner 2026-11-11: "the attacks on the outpost are supposed to be mild but they are
 * crushing my base") [MM-task_mwcutmnk_3h]: the planet's step-1 raid multipliers (Outpost_Raids Raider_HP_Mult,
 * Raider_Damage_Mult) × Outpost_Params Probe_Strength. At the raid's full strength the starter kit lost a wall per
 * probe on the ground outpost (measured in PR #296); the dial lives in the workbook. → { hpMult, dmgMult }.
 */
export function probeRules(planet) {
  const r = raidFor(planet, 1) || {};
  const k = OUTPOST.Probe_Strength ?? 1;
  return { hpMult: (r.hpMult ?? 1) * k, dmgMult: (r.dmgMult ?? 1) * k };
}

export function createVisitRaids(state, { planet, seed, probes = 0, nextIn = null }) {
  // an endless schedule: probes are queued one at a time and clearing one is never the battle's last wave
  state.waveTable = state.waveTable || [];
  state.waves.endless = true;
  // probes so far this visit, and when the next comes — carried over when the live state is rebuilt mid-visit
  let n = probes;
  let nextAt = state.time + (nextIn != null ? nextIn : probeDelay(seed >>> 0, n));
  let wasActive = false, startedAt = 0;
  // the cells this probe's raiders have stood on (a raid tramples the farm by them: farm/model.js trample), handed over
  // once when it clears — the same report a raid's sim gives (raid.js cells)
  const walked = new Set();
  let cleared = null;
  const rules = probeRules(planet);
  const openGrid = buildNavGrid(state.map, []);
  const base = { x: state.map.base.x, y: state.map.base.y };
  const api = {
    /** Call after each fixed step: start the next probe when it is due; time the one after when this one clears. */
    step() {
      const w = state.waves;
      if (w.active) {
        raiderRules(state, rules);
        siegeRoutes(state, openGrid, base);
        for (const u of state.units.values()) if (u.side === 'attacker' && u.hp > 0 && u.pos) walked.add(`${Math.round(u.pos.x)},${Math.round(u.pos.y)}`);   // (round x, round y), as raid.js reads it
        // a probe pulls back after PROBE_MAX_S: its survivors leave, so the wave clears and the next one is timed
        if (state.time - startedAt > PROBE_MAX_S && !w.pendingSpawns.length) {
          for (const [id, u] of state.units) if (u.side === 'attacker') state.units.delete(id);
        }
      }
      if (wasActive && !w.active) {
        nextAt = state.time + probeDelay(seed >>> 0, n);   // the gap runs from the clear
        cleared = [...walked].map((k) => k.split(',').map(Number));
        walked.clear();
      }
      wasActive = w.active;
      if (w.active || state.result || state.time < nextAt) return null;
      const units = probeUnits(planet, n);
      if (!units.length) { nextAt = Infinity; return null; }
      state.waveTable.push({ faction: planet, probe: n, spawns: units.map((unitId) => ({ unitId, lane: 'ground', count: 1, delay: 0, interval: 0 })) });
      w.total = state.waveTable.length;
      n++;
      wasActive = startNextWave(state);
      startedAt = state.time;
      return wasActive ? { probe: n - 1, units } : null;
    },
    /** The cells the last cleared probe's raiders stood on ([[x, y], …], in the order first reached), once; else null. */
    takeCells() { const c = cleared; cleared = null; return c; },
    get probes() { return n; },
    get nextAt() { return nextAt; },
  };
  return api;
}
