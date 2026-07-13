/** contact.test.mjs — velocity-level contact resolution: bodies rest at sprite-touching distance without
 *  oscillating ("bumping"), followers never jitter backward, and the sim stays deterministic.
 *  Run: node src/sim/contact.test.mjs */
import assert from 'node:assert';
import { createSim, applyCommand, stepSim } from './core.js';
import { WAVES, MAP } from '../data/tables.js';
import { hashState } from './replay.js';

// 1) determinism through the new movement/clamp/separation passes
function run(seed) { const s = createSim(seed, { waves: WAVES, map: MAP }); applyCommand(s, { type: 'startWave' }); for (let i = 0; i < 30 * 30 && !s.result; i++) stepSim(s, 1 / 30); return s; }
assert.strictEqual(hashState(run(7)), hashState(run(7)), 'deterministic: same seed -> identical state');

// 2) REST-CONTACT invariant: on the field, no two same-layer ground bodies are ever squeezed inside their raw
//    collision footprints (small slack for a mid-dissolve transient), at EVERY tick — not just on average.
// 3) NO-JITTER invariant: the bump was a rapid ALTERNATION — movement closes, push shoves back, every few
//    ticks, hundreds of times. Assert no unit's along-heading motion sign-alternates with visible magnitude
//    more than a handful of times, and that total backward drift stays small (slow smooth yielding while
//    wedged in a crowd is legitimate; a push-back oscillator racks up alternations AND backward distance).
const s = createSim(7, { waves: WAVES, map: MAP });
applyCommand(s, { type: 'startWave' });
let worstFloor = Infinity;
const backTotal = new Map();   // unit id -> accumulated backward movement along its heading
const altCount = new Map();    // unit id -> count of visible-magnitude sign alternations (the bump signature)
const prevAlong = new Map();   // unit id -> along-heading motion last tick
const prevPos = new Map();     // unit id -> {x,y} at the previous tick
for (let i = 0; i < 30 * 30 && !s.result; i++) {
  stepSim(s, 1 / 30);
  if (i <= 90) continue;
  const g = [...s.units.values()].filter((u) => u.hp > 0 && u.altitude === 0 && u.state !== 'attacking');
  for (let x = 0; x < g.length; x++) {
    for (let y = x + 1; y < g.length; y++) {
      if (g[x].pos.x > 3 && g[y].pos.x > 3) {
        const dd = Math.hypot(g[x].pos.x - g[y].pos.x, g[x].pos.y - g[y].pos.y);
        worstFloor = Math.min(worstFloor, dd - (g[x].radius + g[y].radius));
      }
    }
  }
  for (const u of g) {
    const p = prevPos.get(u.id);
    if (p && u.hdg && u.pos.x > 3) {
      const along = (u.pos.x - p.x) * u.hdg.x + (u.pos.y - p.y) * u.hdg.y;
      if (along < 0) backTotal.set(u.id, (backTotal.get(u.id) || 0) - along);
      const pa = prevAlong.get(u.id);
      if (pa != null && ((pa < -0.03 && along > 0.03) || (pa > 0.03 && along < -0.03))) {
        altCount.set(u.id, (altCount.get(u.id) || 0) + 1);
      }
      prevAlong.set(u.id, along);
    }
    prevPos.set(u.id, { x: u.pos.x, y: u.pos.y });
  }
}
assert(worstFloor > -0.1, `no pair squeezed inside raw collision footprints (worst intrusion ${worstFloor.toFixed(3)}, want > -0.1)`);
let worstBack = 0, worstAlt = 0;
for (const v of backTotal.values()) worstBack = Math.max(worstBack, v);
for (const v of altCount.values()) worstAlt = Math.max(worstAlt, v);
assert(worstAlt <= 20, `no unit oscillates back-and-forth (worst alternation count ${worstAlt}, want <= 20 — the old bump racked up hundreds)`);
assert(worstBack < 3.0, `backward drift stays small (worst total ${worstBack.toFixed(3)} cells over the run, want < 3)`);

// 4) ARRIVAL sanity: radius-based waypoint consumption still delivers the assault — some attacker closes on the
//    base (or the base takes damage) within 90s on a clean board.
const a = createSim(3, { waves: WAVES, map: MAP });
applyCommand(a, { type: 'startWave' });
let arrived = false;
for (let i = 0; i < 30 * 90 && !arrived; i++) {
  stepSim(a, 1 / 30);
  if (a.base.hp < a.base.maxHp - 1) arrived = true;
  else for (const u of a.units.values()) {
    if (u.side === 'attacker' && u.hp > 0 && Math.hypot(u.pos.x - a.base.pos.x, u.pos.y - a.base.pos.y) <= 4) { arrived = true; break; }
  }
}
assert(arrived, 'attackers still reach the base with radius-based waypoint arrival');

console.log(`contact.test OK — deterministic; worst footprint intrusion ${worstFloor === Infinity ? 'n/a' : worstFloor.toFixed(3)}; worst alternations ${worstAlt}; worst backward drift ${worstBack.toFixed(3)}; assault arrives`);
