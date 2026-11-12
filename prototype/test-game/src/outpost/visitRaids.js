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
 * The timing and the raiders are visitProbe.js's (probeDelay: the first at 45–75 s, then 100–180 s after the last one
 * clears; probeUnits: the planet's light tank and a trooper, a second tank every other probe) — reused, not copied.
 * The raiders follow the outpost's raid rules (raid.js raiderRules: raid-only strength — visitProbe.js probeRules, the
 * step-1 raid's multipliers × Outpost_Params Probe_Strength, so a probe stays mild [MM-task_mwcutmnk_3h] — range cap, fire while advancing;
 * siegeRoutes: walls may seal the ramps, so an idle raider marches on the first defense in its way) and pull back after
 * PROBE_MAX_S, held or not — the same rules a raid runs, shared, not copied.
 * Deterministic: probe times come from the outpost seed and run on SIM time, never the wall clock.
 *
 *   const raids = createVisitRaids(state, { planet, seed });
 *   …after each fixed sim step: raids.step();
 */
import { startNextWave } from '../sim/waves.js';
import { buildNavGrid } from '../sim/pathfinding.js';
import { probeDelay, probeUnits, probeRules, PROBE_MAX_S } from './view/visitProbe.js';
import { raiderRules, siegeRoutes } from './raid.js';

export function createVisitRaids(state, { planet, seed, probes = 0, nextIn = null }) {
  // an endless schedule: probes are queued one at a time and clearing one is never the battle's last wave
  state.waveTable = state.waveTable || [];
  state.waves.endless = true;
  // probes so far this visit, and when the next comes — carried over when the live state is rebuilt mid-visit
  let n = probes;
  let nextAt = state.time + (nextIn != null ? nextIn : probeDelay(seed >>> 0, n));
  let wasActive = false, startedAt = 0;
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
        // a probe pulls back after PROBE_MAX_S: its survivors leave, so the wave clears and the next one is timed
        if (state.time - startedAt > PROBE_MAX_S && !w.pendingSpawns.length) {
          for (const [id, u] of state.units) if (u.side === 'attacker') state.units.delete(id);
        }
      }
      if (wasActive && !w.active) nextAt = state.time + probeDelay(seed >>> 0, n);   // the gap runs from the clear
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
    get probes() { return n; },
    get nextAt() { return nextAt; },
  };
  return api;
}
