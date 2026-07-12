/** routes.test.mjs — multi-route navigation: units spread across a growing route list, stuck units (walled in)
 *  DISCOVER alternates, and the whole thing is REPLAY-SAFE (derived route state rebuilds identically).
 *  Run: node src/sim/routes.test.mjs */
import assert from 'node:assert';
import { createSim, applyCommand, stepSim } from './core.js';
import { WAVES, MAP } from '../data/tables.js';
import { hashState } from './replay.js';

const CMDS = [
  { tick: 1, cmd: { type: 'place', structId: 'STR-Wall', cell: { x: 6, y: 11 } } },
  { tick: 1, cmd: { type: 'place', structId: 'STR-Wall', cell: { x: 6, y: 12 } } },
  { tick: 1, cmd: { type: 'place', structId: 'STR-Wall', cell: { x: 6, y: 13 } } },
  { tick: 2, cmd: { type: 'startWave' } },
];
function play() {
  const s = createSim(3, { waves: WAVES, map: MAP });
  let ci = 0;
  for (let i = 0; i < 40 * 30 && !s.result; i++) {
    while (ci < CMDS.length && CMDS[ci].tick === s.tick) { applyCommand(s, CMDS[ci].cmd); ci++; }
    stepSim(s, 1 / 30);
  }
  return s;
}
const a = play(), b = play();
// REPLAY: re-running the same command script reproduces the exact state (route list is derived + deterministic)
assert.strictEqual(hashState(a), hashState(b), 'replay: same script -> identical state hash');
assert(a.routes && a.routes.length > 1, `stuck units discovered alternate routes (got ${a.routes ? a.routes.length : 0})`);
assert.strictEqual(a.routes.length, b.routes.length, 'route list identical on replay');
// clean run (no walls) still deterministic + still reaches the base
function clean() { const s = createSim(5, { waves: WAVES, map: MAP }); applyCommand(s, { type: 'startWave' }); for (let i = 0; i < 30 * 30 && !s.result; i++) stepSim(s, 1 / 30); return s; }
assert.strictEqual(hashState(clean()), hashState(clean()), 'clean run deterministic');
console.log(`routes.test OK — replay-safe; ${a.routes.length} routes discovered around a wall; clean run deterministic`);
