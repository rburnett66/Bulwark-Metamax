/**
 * prototype/test-game/src/harness/scenario.js  [state-harness sh-m1.s1]
 *
 * Deterministic verification SCENARIOS for the State Harness. A scenario spawns a unit, drives the REAL sim,
 * and captures the per-tick readout TRACE — the machine-checkable surface each story's DoD asserts against
 * (so "done" means "the scenario passes", not "it boots"). Headless + deterministic (seed + fixed dt), so the
 * same scenario is reproducible and can be run by MetaMax's develop gate (sh-m1.s7).
 */
import { createSim, stepSim, FIXED_DT } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';
import { WAVES, MAP } from '../data/tables.js';
import { unitReadout } from './readout.js';

/**
 * Run a scenario and capture the readout trace.
 *   spec: { unitId, tier?, pos:{x,y}, lane?, side?, seed?, ticks?, onTick?(state, unit, i) }
 *   returns { unitId, unit, trace:[{tick, health, hasTarget, awareness, aimAngle}] }
 */
export function runScenario(spec) {
  const st = createSim(spec.seed || 1, { waves: WAVES, map: MAP });
  const u = createUnit(st, spec.unitId, spec.tier || 1, { x: spec.pos.x, y: spec.pos.y },
                       spec.lane || 'ground', spec.side || 'attacker');
  if (st.units && u && u.id != null && !st.units.has(u.id)) st.units.set(u.id, u);
  const trace = [];
  const ticks = spec.ticks || 300;
  for (let i = 0; i < ticks; i++) {
    const cur = (st.units && st.units.get(u.id)) || u;
    if (typeof spec.onTick === 'function') spec.onTick(st, cur, i);
    stepSim(st, FIXED_DT);
    const after = (st.units && st.units.get(u.id)) || cur;
    trace.push({ tick: st.tick, ...unitReadout(st, after) });
  }
  return { unitId: u.id, unit: (st.units && st.units.get(u.id)) || u, trace };
}

/** Convenience assertions used by DoD scenarios (return {ok, note}). */
export const assert = {
  acquires: (trace) => {
    const hit = trace.find((t) => t.hasTarget);
    return { ok: !!hit, note: hit ? `acquired at tick ${hit.tick}` : 'never acquired a target' };
  },
  aimTowardPositiveX: (trace) => {
    const hit = trace.find((t) => t.hasTarget && t.aimAngle != null);
    return { ok: !!hit && Math.abs(hit.aimAngle) < Math.PI / 2,
             note: hit ? `aim ${hit.aimAngle.toFixed(2)} rad` : 'no aim' };
  },
  healthDropsAfter: (trace, tick) => {
    const before = [...trace].reverse().find((t) => t.tick <= tick);
    const after = trace.find((t) => t.tick > tick + 5);
    return { ok: !!before && !!after && after.health < before.health,
             note: before && after ? `${before.health.toFixed(2)} -> ${after.health.toFixed(2)}` : 'n/a' };
  },
};
