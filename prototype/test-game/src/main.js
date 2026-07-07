const { Application, Container, Graphics, Text } = PIXI;

import { CONSTANTS } from './config/constants.js';
import { buildData } from './data/index.js';
import { makeRNG } from './sim/rng.js';
import { createState } from './sim/state.js';
import { buildBoard } from './sim/board.js';
import { step } from './sim/step.js';
import { Commands } from './sim/commands.js';
import { BattleLog } from './sim/log.js';
import { verifyReplay } from './sim/replay.js';
import { Renderer } from './render/renderer.js';
import { Pointer } from './input/pointer.js';
import { Keyboard } from './input/keyboard.js';
import { HUD } from './hud/hud.js';

async function main() {
  const data = buildData();

  const app = new Application();
  await app.init({
    background: 0x0a1420,
    resizeTo: window,
    antialias: true,
  });
  document.getElementById('app').appendChild(app.canvas);

  const SEED = 0xC0FFEE;
  const rng = makeRNG(SEED);
  const state = createState({ data, seed: SEED });
  buildBoard(state, CONSTANTS, data);

  const log = new BattleLog(SEED);
  const commands = new Commands(state, data, log, CONSTANTS);

  const renderer = new Renderer(app, state, data, CONSTANTS);
  const hud = new HUD(state, data, commands, CONSTANTS);
  const placement = { active: null, x: 0, y: 0, valid: false, kind: null };
  state.placement = placement;

  const pointer = new Pointer(app, state, commands, renderer, placement, CONSTANTS);
  const keyboard = new Keyboard(state, commands, renderer);

  hud.onSelectBuild = (id) => {
    placement.active = id;
    placement.kind = 'structure';
  };
  hud.onStartWave = () => commands.startWave();
  hud.onUpgrade = () => { if (state.selectedId != null) commands.upgrade(state.selectedId); };
  hud.onSell = () => { if (state.selectedId != null) commands.sell(state.selectedId); };
  hud.onRepair = () => { if (state.selectedId != null) commands.repair(state.selectedId); };
  hud.onReplay = () => runReplayVerify(log, data, CONSTANTS);

  keyboard.onStartWave = () => commands.startWave();
  keyboard.onUpgrade = () => { if (state.selectedId != null) commands.upgrade(state.selectedId); };
  keyboard.onSell = () => { if (state.selectedId != null) commands.sell(state.selectedId); };
  keyboard.onPause = () => { state.paused = !state.paused; };
  keyboard.onRotate = (d) => renderer.rotate(d);

  // fixed timestep accumulator
  const DT = CONSTANTS.TICK_DT;
  let acc = 0;
  let last = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    let frameDt = (now - last) / 1000;
    last = now;
    if (frameDt > 0.25) frameDt = 0.25;
    if (!state.paused && !state.gameOver) {
      acc += frameDt;
      while (acc >= DT) {
        commands.flushInputs(state.tick);
        step(state, DT, data, CONSTANTS, log);
        acc -= DT;
      }
    }
    renderer.draw(placement);
    hud.update();
  });

  window.__BULWARK = { state, data, log, commands, verify: () => runReplayVerify(log, data, CONSTANTS) };
}

function runReplayVerify(log, data, CONSTANTS) {
  const result = verifyReplay(log, data, CONSTANTS, buildBoard, createState);
  console.log('[REPLAY] deterministic =', result.ok, 'hash live=', result.liveHash, 'replay=', result.replayHash);
  return result;
}

main();