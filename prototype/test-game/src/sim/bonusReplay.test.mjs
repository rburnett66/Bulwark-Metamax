// src/sim/bonusReplay.test.mjs — WB6: a run whose LOG carries a chooseBonus
// replays to an identical state. The offer isn't in the log — replay must
// regenerate it deterministically from stepWaves (same seed + same init →
// same wave schedule → same rng draw → same 3 offered), then the recorded
// choice still validates. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP } from '../data/tables.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { runReplay, hashState } from './replay.js';

// 2 waves so wave-1's clear rolls an offer (the final wave is a win, no offer).
// The replay log's init carries the wave table + map, exactly as a real run's
// init carries mapId/faction that regenerate the same schedule.
const INIT = {
  waves: [
    { wave: 1, faction: 'Test', spawns: [{ unitId: 'GND-Troops', count: 3, lane: 'ground', delay: 0, interval: 0.5 }] },
    { wave: 2, faction: 'Test', spawns: [{ unitId: 'GND-Troops', count: 3, lane: 'ground', delay: 0, interval: 0.5 }] },
  ],
  map: MAP,
};
const CMDS = [
  { tick: 0, cmd: { type: 'place', structId: 'STR-Cannon', cell: { x: MAP.spawnGround.x + 6, y: MAP.spawnGround.y } } },
  { tick: 0, cmd: { type: 'startWave' } },
];

/** Play live off the same init+commands; choose the first offered bonus at wave-1 clear. */
function playLive() {
  const s = createSim(9, INIT);
  for (const c of CMDS) applyCommand(s, c.cmd);
  let chose = false, chosenId = null, chosenTick = null;
  for (let t = 0; t < 1600; t++) {
    stepSim(s, FIXED_DT);
    if (!chose && s.bonuses.offer) {
      chosenId = s.bonuses.offer[0];
      assert.equal(applyCommand(s, { type: 'chooseBonus', bonusId: chosenId }).ok, true);
      chose = true; chosenTick = s.tick;
    }
  }
  assert.equal(chose, true, 'wave-1 clear offered a bonus');
  return { s, chosenId, chosenTick };
}

test('WB6: a recorded chooseBonus replays (offer regenerated) to an identical hash', () => {
  const { s: live, chosenId, chosenTick } = playLive();
  assert.ok(live.bonuses.owned.includes(chosenId), 'live applied the choice');

  // The replay log = the same init + the same commands including the logged choice.
  const log = { seed: 9, init: INIT, commands: CMDS.concat([{ tick: chosenTick, cmd: { type: 'chooseBonus', bonusId: chosenId } }]) };
  const replayed = runReplay(log, live.tick);
  assert.equal(replayed.hash, hashState(live), 'replay hash matches live');
  assert.deepEqual(replayed.state.bonuses.owned, live.bonuses.owned, 'replay reproduced the offer + choice');
});

test('WB6: replay is stable across two runs (offer regenerates identically)', () => {
  const { chosenId, chosenTick } = playLive();
  const log = { seed: 9, init: INIT, commands: CMDS.concat([{ tick: chosenTick, cmd: { type: 'chooseBonus', bonusId: chosenId } }]) };
  const a = runReplay(log, 1400), b = runReplay(log, 1400);
  assert.equal(a.hash, b.hash);
  assert.deepEqual(a.state.bonuses.owned, b.state.bonuses.owned);
});
