/** cannon.test.mjs — base super-cannon aims at a stationary siege unit, fires a slow shell, does massive AOE,
 *  and is deterministic / replay-safe. Run: node src/sim/cannon.test.mjs */
import assert from 'node:assert';
import { createSim, applyCommand, stepSim } from './core.js';
import { WAVES, MAP } from '../data/tables.js';
import { hashState } from './replay.js';
function run() {
  const s = createSim(3, { waves: WAVES, map: MAP }); applyCommand(s, { type: 'startWave' });
  const ev = { aim: 0, shot: 0, impact: 0 };
  for (let i = 0; i < 60 * 30 && !s.result; i++) { const es = stepSim(s, 1 / 30) || []; for (const e of es) { if (e.type === 'cannonAim') ev.aim++; if (e.type === 'cannonShot') ev.shot++; if (e.type === 'cannonImpact') ev.impact++; } }
  return { s, ev };
}
const a = run(), b = run();
assert(a.ev.aim > 0 && a.ev.shot > 0 && a.ev.impact > 0, `cannon aimed/fired/hit (got ${JSON.stringify(a.ev)})`);
assert.strictEqual(a.ev.shot, a.ev.impact, 'every shot lands an impact');
assert.strictEqual(hashState(a.s), hashState(b.s), 'cannon is deterministic / replay-safe');
assert.strictEqual(JSON.stringify(a.ev), JSON.stringify(b.ev), 'identical cannon activity across runs');
console.log(`cannon.test OK — aimed ${a.ev.aim}, fired ${a.ev.shot}, ${a.ev.impact} AOE impacts; deterministic`);
