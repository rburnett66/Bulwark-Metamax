/**
 * prototype/test-game/src/harness/states.test.mjs  [sh-m1.s6 — the state DoD scenario]
 *
 * Drive one unit through its gameplay states and assert the readout transitions correctly (the reach-to-surface
 * proof for "Drive the 7 states"): acquire → weapon locks aim, attack → aim held on target, take-damage → base
 * readout drops, heal → recovers, death → zero. Deterministic + headless — the covering scenario the s7 gate runs
 * for sh-m1.s6.
 */
import { runScenario } from './scenario.js';
import { UNITS, MAP } from '../data/tables.js';

const unitId = Object.keys(UNITS).find((k) => UNITS[k].domain === 'Walker') || Object.keys(UNITS)[0];
const b = MAP.base;
const DMG = 120, HEAL = 200, DIE = 300;

const res = runScenario({
  unitId,
  pos: { x: b.x - 2, y: b.y },
  ticks: 360,
  onTick: (st, u, i) => {
    if (!u) return;
    if (i === DMG) u.hp = u.maxHp * 0.4;                              // take damage
    if (i === HEAL) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4);   // heal
    if (i === DIE) u.hp = 0;                                          // death
  },
});
const t = res.trace;
const at = (tick) => t.find((x) => x.tick >= tick) || t[t.length - 1];
const before = (tick) => [...t].reverse().find((x) => x.tick <= tick);

const acq = t.find((x) => x.awareness === 1);
const dmgB = before(DMG), dmgA = at(DMG + 10);
const healB = before(HEAL), healA = at(HEAL + 10);
const dead = at(DIE + 5);

const checks = [
  ['acquire → head awareness 0→1', !!acq],
  ['attack → weapon aim locked on the target', !!(acq && acq.aimAngle != null)],
  ['take-damage → base/health drops', !!(dmgB && dmgA && dmgA.health < dmgB.health)],
  ['heal → health recovers', !!(healB && healA && healA.health > healB.health)],
  ['death → health 0', !!(dead && dead.health === 0)],
];

console.log(`[sh-m1.s6] unit states via readout (unit=${unitId})`);
let ok = true;
for (const [n, p] of checks) { console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}`); ok = ok && p; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
