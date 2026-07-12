/**
 * prototype/test-game/src/sim/finalscore.test.mjs  [polish-16.s12 — Final Score]
 *
 * Guards the gold-remaining scoring bug: computeFinalScore read `eco.gold` (which the economy never sets —
 * the live balance is `eco.money`), so a positive gold balance scored as 0. Now a positive balance scores
 * +1 point per gold, spent gold is still counted, and a fractional balance floors (never negative).
 */
import { createSim, emitEvent } from './core.js';
import { WAVES, MAP } from '../data/tables.js';

function endWith({ money = 0, kills = 0, spent = 0, time = 0 }) {
  const sim = createSim(1, { waves: WAVES, map: MAP });
  sim.economy.money = money; sim.economy.kills = kills; sim.economy.totalSpent = spent; sim.time = time;
  sim.result = 'won';
  emitEvent(sim, { type: 'result', tick: sim.tick });   // terminal event -> finalizeGame
  return sim.finalScore || {};
}

const a = endWith({ money: 500, kills: 3, spent: 120, time: 0 });
const b = endWith({ money: 249.9, time: 0 });
const c = endWith({ money: 0, kills: 1, time: 0 });

const checks = [
  ['positive gold balance is scored (not 0)', a.goldRemaining === 500],
  ['+1 point per gold remaining', a.score === 3 * 100 - 120 + 500],   // kills*100 - spent + remaining
  ['gold spent still counted', a.goldSpent === 120],
  ['fractional balance floors to whole gold', b.goldRemaining === 249],
  ['zero balance scores zero gold (no crash)', c.goldRemaining === 0],
];

console.log('[polish-16.s12] final score — gold remaining');
let ok = true;
for (const [n, p] of checks) { console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}`); ok = ok && p; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
