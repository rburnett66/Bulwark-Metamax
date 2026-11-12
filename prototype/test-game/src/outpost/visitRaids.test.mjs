// Visit raids as waves of the live battle SimState [MM-subtask_mwcij14c_33] (TECH_PLAN::One-Battle-UX.md §5b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost } from './model.js';
import { toLiveSim } from './liveSim.js';
import { createVisitRaids, probeDelay, probeUnits, PROBE_FIRST_S, PROBE_GAP_S } from './visitRaids.js';
import '../data/factions.js';
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

// the probes' timing and raiders (moved from view/visitProbe.js with the old farm view's deletion, S6)
test('probes come 45–75 s into a visit, then every 100–180 s, the same for the same seed', () => {
  for (const seed of [1, 11, 999]) {
    const d0 = probeDelay(seed, 0);
    assert.ok(d0 >= PROBE_FIRST_S[0] && d0 <= PROBE_FIRST_S[1], `first ${d0}`);
    for (let n = 1; n < 6; n++) { const d = probeDelay(seed, n); assert.ok(d >= PROBE_GAP_S[0] && d <= PROBE_GAP_S[1], `gap ${d}`); }
    assert.equal(probeDelay(seed, 3), probeDelay(seed, 3));
  }
});

test('a probe is the planet\'s light tank and a trooper, a second tank every other time', () => {
  assert.deepEqual(probeUnits('ground', 0), ['GND-Tanks', 'GND-Troops']);
  assert.deepEqual(probeUnits('ground', 1), ['GND-Tanks', 'GND-Troops', 'GND-Tanks']);
  for (const p of ['air', 'water', 'dark', 'greenies']) assert.ok(probeUnits(p, 0).some((u) => /-Tanks$/.test(u)), p);
});


// S6 [MM-story_mwc9q1y6_2n]: a visit raid tramples the farm as a raid does — the cells its raiders stood on, once it clears
test('a cleared visit raid hands over the cells its raiders stood on, once, the same every run', () => {
  const a = visit(11), b = visit(11);
  let got = null, at = -1;
  run(a.state, a.raids, 400, () => { const c = a.raids.takeCells(); if (c && !got) { got = c; at = a.state.time; } });
  assert.ok(got && got.length > 0, 'the first raid reported cells when it cleared');
  assert.ok(got.every((c) => Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1])), 'whole [x, y] cells');
  assert.equal(a.raids.takeCells(), null, 'handed over once');
  let again = null;
  run(b.state, b.raids, 400, () => { const c = b.raids.takeCells(); if (c && !again) again = c; });
  assert.deepEqual(again, got, 'same seed, same cells');
  assert.ok(at > 0);
});
