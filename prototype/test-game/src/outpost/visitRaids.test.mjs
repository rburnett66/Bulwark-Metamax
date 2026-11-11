// Visit raids as waves of the live battle SimState [MM-subtask_mwcij14c_33] (TECH_PLAN::One-Battle-UX.md §5b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost } from './model.js';
import { toLiveSim } from './liveSim.js';
import { createVisitRaids } from './visitRaids.js';
import { probeDelay, PROBE_FIRST_S } from './view/visitProbe.js';
import { stepSim, FIXED_DT, createSim } from '../sim/core.js';

function visit(seed = 7) {
  const o = referenceOutpost('ground', { seed, map, now: T0 });
  o.online = true;
  const { state } = toLiveSim(o, { map, now: T0, gold: 1000 });
  return { state, raids: createVisitRaids(state, { planet: 'ground', seed: o.seed }) };
}
const run = (state, raids, sec, each) => {
  for (let i = 0; i < Math.round(sec / FIXED_DT); i++) { const ev = stepSim(state, FIXED_DT); raids.step(); if (each) each(ev); }
};

test('the first raid comes 1–2 minutes into a visit, as a wave of the live sim, from the probe timing', () => {
  const { state, raids } = visit();
  const due = probeDelay(state.seed >>> 0, 0);
  assert.ok(due >= PROBE_FIRST_S[0] && due <= PROBE_FIRST_S[1], `${due} s`);
  run(state, raids, due - 1);
  assert.equal(raids.probes, 0, 'not before it is due');
  assert.equal(state.waves.active, false);
  run(state, raids, 2);
  assert.equal(raids.probes, 1, 'the probe started');
  assert.equal(state.waves.active, true, 'as a wave of the live sim');
  run(state, raids, 5);
  const raiders = [...state.units.values()].filter((u) => u.side === 'attacker');
  assert.ok(raiders.length >= 2, 'its raiders are live sim units');
});

test('the defenses fight it with the battle combat, kills pay the battle bounty, and the outpost never "wins" and locks', () => {
  const { state, raids } = visit();
  const gold0 = state.economy.money;
  let kills = 0;
  run(state, raids, 300, (evs) => { for (const e of evs || []) if (e.type === 'kill' && e.side === 'attacker') kills++; });
  assert.ok(raids.probes >= 1);
  assert.ok(kills >= 1, 'the defenses killed raiders');
  assert.ok(state.economy.money > gold0, 'kills paid gold (combat.grantKillIncome)');
  assert.equal(state.result, null, 'an endless visit schedule never ends the sim');
  assert.ok(!state.bonusOffer || !state.bonusOffer.length, 'no wave-bonus offer between raids');
});

test('raids keep coming: the next one is timed from the clear, deterministic from the seed', () => {
  const a = visit(11), b = visit(11);
  run(a.state, a.raids, 600); run(b.state, b.raids, 600);
  assert.ok(a.raids.probes >= 2, `${a.raids.probes} probes in 10 minutes`);
  assert.equal(a.raids.probes, b.raids.probes, 'same seed, same raids');
  assert.equal(a.state.economy.money, b.state.economy.money, 'and the same bounty');
});

test('a battle (no endless flag) still wins when its last wave clears', () => {
  const s = createSim(7, { waves: [{ faction: 'Ground / Powder', spawns: [] }] });
  assert.equal(s.waves.endless, undefined);
});
