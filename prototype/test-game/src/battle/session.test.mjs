// The battle session is the ONE place the battle view, input and clock live [MM-story_mwc9p7al_2e]
// (docs/tech-plan/One-Battle-UX.md). Owner 2026-11-11: "utilize existing systems, DO NOT DUPLICATE".
// These checks fail if the code moved into src/battle/session.js grows a second copy back in main.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const SESSION = readFileSync(new URL('./session.js', import.meta.url), 'utf8');

test('main.js mounts the battle through the session', () => {
  assert.match(MAIN, /import \{ createBattleSession \} from '\.\/battle\/session\.js'/);
  assert.match(MAIN, /createBattleSession\(mountEl, \{/);
  assert.match(MAIN, /session\.start\(\{/);
  assert.match(MAIN, /session\.createHud\(\{/);
});

test('main.js keeps no copy of the view, the input binding or the clock', () => {
  const gone = [
    [/new PIXI\.Application/, 'the Pixi application'],
    [/app\.ticker/, 'the frame loop'],
    [/\bcreateRenderer\(/, 'the 2D renderer'],
    [/\brenderFrame\(/, 'the per-frame draw'],
    [/\bcreateInput\(/, 'the input binding'],
    [/\bcreateHud\(mountEl/, 'the HUD construction'],
    [/\bupdateHud\(/, 'the HUD update'],
    [/\bstepSim\(sim, FIXED_DT\)/, 'the fixed-step sim call'],
    [/accumulator/, 'the fixed-step accumulator'],
    [/function (mount3D|fallbackTo2D|retry3D|suspend3D|resume3D)\b/, 'the 3D view lifecycle'],
    [/function hudInsets/, 'the HUD insets'],
  ];
  for (const [re, what] of gone) assert.doesNotMatch(MAIN, re, `${what} lives in battle/session.js, not main.js`);
});

test('the session owns each of them exactly once', () => {
  const once = [
    [/new PIXI\.Application\(/g, 'Pixi application'],
    [/app\.ticker\.add\(/g, 'frame loop'],
    [/stepSim\(sim, FIXED_DT\)/g, 'fixed-step sim call'],
    [/updateHud\(hud, /g, 'HUD update'],
    [/async function mount3D\(/g, '3D mount'],
  ];
  for (const [re, what] of once) assert.equal((SESSION.match(re) || []).length, 1, `one ${what}`);
});

test('the clock steps the sim before the mode sees the step, and the mode decides when it stops', () => {
  const loop = SESSION.slice(SESSION.indexOf('function start('));
  const order = ['h.paused()', 'h.stopped()', 'h.beforeStep(sim)', 'stepSim(sim, FIXED_DT)', 'h.afterStep(sim, evs)',
    'accumulator -= FIXED_DT', 'h.afterTick(sim)', 'h.beforeFrame(dtMs)', 'h.viewFrame(dtMs, frame)', 'renderFrame(',
    'h.beforeHud()', 'updateHud(hud'];
  let at = -1;
  for (const step of order) {
    const i = loop.indexOf(step, at + 1);
    assert.ok(i > at, `${step} runs after the step before it`);
    at = i;
  }
  // the sim is never stepped from a wall clock or Math.random in the session (replay determinism)
  assert.doesNotMatch(SESSION, /Math\.random|Date\.now/);
});
