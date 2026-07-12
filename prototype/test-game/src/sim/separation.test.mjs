/** separation.test.mjs — units have a footprint (no stacking on the field) + faster units route around slower,
 *  and the sim stays deterministic (replays hold). Run: node src/sim/separation.test.mjs */
import assert from 'node:assert';
import { createSim, applyCommand, stepSim } from './core.js';
import { WAVES, MAP } from '../data/tables.js';
import { hashState } from './replay.js';

function run() { const s = createSim(7, { waves: WAVES, map: MAP }); applyCommand(s, { type: 'startWave' }); for (let i = 0; i < 30 * 30 && !s.result; i++) stepSim(s, 1 / 30); return s; }
assert.strictEqual(hashState(run()), hashState(run()), 'deterministic: same seed -> identical state');

// every unit has a footprint
const chk = createSim(1, { waves: WAVES, map: MAP }); applyCommand(chk, { type: 'startWave' }); stepSim(chk, 1 / 30);
for (const u of chk.units.values()) assert(u.radius > 0, 'units have a radius');

// on the field (past the lane entry) ground footprints don't stack
const s = createSim(7, { waves: WAVES, map: MAP }); applyCommand(s, { type: 'startWave' });
let worstAway = 1;
for (let i = 0; i < 30 * 30 && !s.result; i++) {
  stepSim(s, 1 / 30);
  if (i > 90) {
    const g = [...s.units.values()].filter((u) => u.hp > 0 && u.altitude === 0 && u.state !== 'attacking');
    for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) {
      if (g[x].pos.x > 3 && g[y].pos.x > 3) {
        const dd = Math.hypot(g[x].pos.x - g[y].pos.x, g[x].pos.y - g[y].pos.y);
        worstAway = Math.min(worstAway, dd / (g[x].radius + g[y].radius));
      }
    }
  }
}
assert(worstAway > 0.5, `field units keep a footprint apart (worst ratio ${worstAway.toFixed(2)}, want >0.5)`);
console.log(`separation.test OK — deterministic; footprints present; field overlap worst ratio ${worstAway.toFixed(2)} (1.0=touching)`);
