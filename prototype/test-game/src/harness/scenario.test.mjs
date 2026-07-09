/**
 * prototype/test-game/src/harness/scenario.test.mjs  [state-harness sh-m1.s1 — the DoD scenario]
 *
 * The story's Definition of Done, expressed as a deterministic, headless assertion (run with `node`):
 *   a spawned unit acquires a target; the readout trace shows awareness 0->1, aimAngle points at the target,
 *   and health drops on damage. Exits non-zero if any assertion fails — this is the shape MetaMax's develop
 *   gate (sh-m1.s7) will run to gate "done".
 */
import { runScenario, assert } from './scenario.js';
import { UNITS, MAP } from '../data/tables.js';

const unitId = Object.keys(UNITS).find((k) => UNITS[k].domain === 'Walker') || Object.keys(UNITS)[0];
const base = MAP.base;
const DMG_AT = 200;

const res = runScenario({
  unitId,
  pos: { x: base.x - 2, y: base.y },                              // within range of the base
  ticks: 400,
  onTick: (st, u, i) => { if (i === DMG_AT && u) u.hp = u.maxHp * 0.5; },   // take damage
});

const checks = [
  ['awareness 0 -> 1 (acquires a target)', assert.acquires(res.trace)],
  ['weapon aim points at the base (+x)', assert.aimTowardPositiveX(res.trace)],
  ['base readout / health drops on damage', assert.healthDropsAfter(res.trace, DMG_AT)],
];

console.log(`[sh-m1.s1] unit=${unitId} ticks=${res.trace.length}`);
let ok = true;
for (const [name, r] of checks) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${name}  (${r.note})`);
  ok = ok && r.ok;
}
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
