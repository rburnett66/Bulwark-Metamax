// No heavy raiders at an outpost [MM-task_mwd2qc3c_4]. Owner playtest 2026-11-12 (v2026.11.12-d): "base is getting
// attacked by heavy tanks, juggernauts". Owner rule (TECH_PLAN::One-Battle-UX.md §5b): outpost raids are "very simple ..
// low level raids"; a bigger base is attacked MORE OFTEN, never by stronger units.
//
// The tanks were the visit probes': probeUnits picked the planet's assault tank (GND-Tanks, the Shield Tank carrier,
// "Heavy armor") first — 28 of 47 probe raiders in 10 minutes on 5 seeds. Every path that can send a raider at an
// outpost is walked here, on every planet and every step a raid can reach, and judged by the unit's own typed fields
// from the battle tables (isInfantry, artClass), never by an id list: a raider is a trooper, the documented breacher
// (Outpost_Raids Breacher, Toxic planets) aside, and nothing a raid fields is ever heavy-tank class.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, getUnitDef } from '../data/tables.js';
import { raidFor } from '../data/outpost.js';
import { raidUnits, firstRaidUnits, makeRaidHook } from './raid.js';
import { probeUnits, createVisitRaids, PROBE_SIZE } from './visitRaids.js';
import { referenceOutpost, confirmOnline, advance } from './model.js';
import { toLiveSim } from './liveSim.js';
import { map, T0 } from './view/fixtures.mjs';
import { stepSim, FIXED_DT } from '../sim/core.js';

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
// the heavy classes, from the data: every unit drawn and sized as a heavy tank (artClass), i.e. the Juggernauts
const HEAVY = new Set(Object.keys(UNITS).filter((id) => UNITS[id].artClass === 'heavyTank'));
const isHeavy = (id) => HEAVY.has(id) || getUnitDef(id).artClass === 'heavyTank';
const isTrooper = (id) => getUnitDef(id).isInfantry === true;

/** Every raider each path can field for a planet: [{ path, ids }]. Steps 1–3 (raidFor clamps above), windows 0–3. */
function everyRaid(planet) {
  const out = [{ path: 'first raid', ids: firstRaidUnits(planet) }];
  for (let n = 0; n < 4; n++) out.push({ path: `visit probe ${n}`, ids: probeUnits(planet, n) });
  for (let step = 1; step <= 5; step++) for (let w = 0; w < 4; w++) out.push({ path: `away raid step ${step} window ${w}`, ids: raidUnits(planet, step, w) });
  return out;
}

test('the data knows its heavies: every faction has a heavy-tank class unit, and it is the Juggernaut', () => {
  assert.ok(HEAVY.size >= PLANETS.length, `${HEAVY.size} heavy-tank class units`);
  for (const id of HEAVY) assert.equal(UNITS[id].role, 'Juggernaut', id);
});

test('no raid an outpost can meet fields a heavy-tank class unit (Juggernaut), on any planet, at any step', () => {
  for (const planet of PLANETS) {
    for (const { path, ids } of everyRaid(planet)) {
      for (const id of ids) assert.ok(!isHeavy(id), `${planet} ${path}: ${id} is a ${UNITS[id].shape} (${UNITS[id].role})`);
    }
  }
});

test('outpost raiders are troopers: no assault tank, no vehicle — the breacher is the one documented exception', () => {
  for (const planet of PLANETS) {
    const breacher = (raidFor(planet, 1) || {}).breacher || null;
    for (const { path, ids } of everyRaid(planet)) {
      assert.ok(ids.length > 0, `${planet} ${path}: no raiders (the check would pass on nothing)`);
      for (const id of ids) {
        if (id === breacher && path.startsWith('away')) continue;
        assert.ok(isTrooper(id), `${planet} ${path}: ${id} is a ${UNITS[id].shape} (${UNITS[id].role}), not a trooper`);
      }
    }
    // a probe and the scripted first raid never bring the breacher
    for (let n = 0; n < 4; n++) assert.ok(!breacher || !probeUnits(planet, n).includes(breacher), `${planet} probe ${n}`);
    assert.ok(!breacher || !firstRaidUnits(planet).includes(breacher), `${planet} first raid`);
  }
});

test('the probe is sized, not escalated: two raiders, three every other probe, cycled from the workbook roster', () => {
  for (const planet of PLANETS) {
    const cycle = raidFor(planet, 1).units;
    for (let n = 0; n < 6; n++) {
      const ids = probeUnits(planet, n);
      assert.equal(ids.length, PROBE_SIZE[n % 2], `${planet} probe ${n}`);
      ids.forEach((id, i) => assert.equal(id, cycle[i % cycle.length]));
    }
  }
});

test('live: a 10-minute visit and two days away on Verdance spawn troopers only, and the away raids never leak into the visit sim', () => {
  const seen = new Set();
  for (const seed of [7, 11]) {
    // away: two days of raids on the battle sim, as the game runs them on arrival (raidSeam → makeRaidHook)
    let o = confirmOnline(referenceOutpost('ground', { seed, map, now: T0 }), map, T0).outpost;
    const hook0 = makeRaidHook({ map, step: 1 }), runs = [];
    const res = advance(o, T0 + 2 * 86_400_000, { map, raid: (oo, raid) => { const r = hook0(oo, raid); runs.push(r); return r; } });
    assert.ok(runs.length > 0, 'raids came');
    for (const r of runs) for (const e of r.events || []) if (e.type === 'spawn') seen.add(e.unitId);
    // arrival: the live sim holds the outpost, never a raid's raiders
    const { state } = toLiveSim(res.outpost, { map, now: T0 + 2 * 86_400_000, gold: 1000 });
    assert.equal([...state.units.values()].filter((u) => u.side === 'attacker').length, 0, 'no raider on arrival');
    // the visit: probes as waves of the live sim
    const raids = createVisitRaids(state, { planet: 'ground', seed: res.outpost.seed });
    for (let i = 0; i < Math.round(600 / FIXED_DT); i++) {
      for (const e of stepSim(state, FIXED_DT) || []) if (e.type === 'spawn') seen.add(e.unitId);
      raids.step();
    }
    assert.ok(raids.probes >= 2, `${raids.probes} probes`);
  }
  assert.ok(seen.size > 0);
  for (const id of seen) assert.ok(isTrooper(id) && !isHeavy(id), `spawned ${id} (${UNITS[id].shape})`);
});
