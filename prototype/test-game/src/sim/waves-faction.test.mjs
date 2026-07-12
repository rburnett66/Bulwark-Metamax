/** waves-faction.test.mjs — the roster is in the game: waves are faction-varied, lanes match domains, and the
 *  sim runs a wave without the old GND-Floaters crash. Run: node src/sim/waves-faction.test.mjs */
import assert from 'node:assert';
import { createSim, applyCommand, stepSim } from './core.js';
import { WAVES, MAP, UNITS, makeWaves } from '../data/tables.js';

// 1. every spawn references a real unit + a lane matching its domain (Flyer=air, Floater/Swimmer=water, else=ground)
const laneFor = (d) => d === 'Flyer' ? 'air' : (d === 'Floater' || d === 'Swimmer') ? 'water' : 'ground';
const facs = new Set();
for (const w of WAVES) for (const s of w.spawns) {
  const def = UNITS[s.unitId];
  assert(def, `wave ${w.wave}: unknown unit ${s.unitId}`);
  assert.strictEqual(s.lane, laneFor(def.domain), `wave ${w.wave} ${s.unitId}: lane ${s.lane} != ${laneFor(def.domain)}`);
  facs.add(def.faction);
}
assert(facs.size >= 8, `waves should span the factions (got ${facs.size})`);

// 2. the sim actually RUNS a wave and spawns attackers with a faction — no crash
const state = createSim(1, { waves: WAVES, map: MAP });
const res = applyCommand(state, { type: 'startWave' });
assert(res && res.ok !== false, 'startWave accepted');
let maxUnits = 0, sawFaction = false;
for (let i = 0; i < 25 * 30 && !state.result; i++) {
  stepSim(state, 1 / 30);
  maxUnits = Math.max(maxUnits, state.units.size);
  for (const u of state.units.values()) if (u.faction) sawFaction = true;
}
assert(maxUnits > 0, 'wave 1 spawned attacker units');
assert(sawFaction, 'spawned units carry a faction');

// 3. FACTION TEST PICKER: a single-faction schedule must spawn ONLY that faction (guards the state.waveTable
//    fix — startNextWave was hardcoded to the global campaign, so custom waves were ignored).
for (const fac of ['Air', 'Dark Energy']) {
  const s2 = createSim(1, { waves: makeWaves(fac), map: MAP });
  assert(applyCommand(s2, { type: 'startWave' }).ok !== false, 'faction test wave starts');
  const seen = new Set();
  for (let i = 0; i < 20 * 30 && !s2.result; i++) { stepSim(s2, 1 / 30); for (const u of s2.units.values()) if (u.faction) seen.add(u.faction); }
  assert(seen.size > 0, `${fac} test spawned units`);
  assert(seen.size === 1 && seen.has(fac), `${fac} test spawns ONLY ${fac}, got [${[...seen]}]`);
}

console.log(`waves-faction.test OK — ${WAVES.length} campaign waves, ${facs.size} factions, lanes correct, wave 1 spawned ${maxUnits} units; faction test-picker spawns single factions`);
