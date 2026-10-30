// src/sim/replayInit.test.mjs — a SERIALIZED battle log replays on a campaign board to the live hash [MM-task_mvgyb5ma_1].
//
// Owner 2026-10-20: "we need to run a debug pass on replay .. it looks like it broke". Two faults, both pinned here:
//   1. in-app playback rebuilt the sim from { map, waves, carry } only — the run's harvesterLevel and structTiers were
//      dropped, so any save with upgrades diverged from the recorded game;
//   2. the headless check replayed the serialized log with no board at all (the log can't carry map/waves objects), so
//      it ran the classic board and never matched.
// replayOpts(init, board) is the one place both paths now build from. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { buildCampaignWaves } from './campaign.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { createLog, recordCommand, serializeLog, deserializeLog, runReplay, hashState, replayOpts } from './replay.js';

const TICKS = 2400;

/** A board as selectMap builds it, and a live run on it that records exactly as main.js submit() does. */
function board(mapId) {
  const map = buildCampaignMap(mapId, { seed: 0 });
  resolveResourceTypes(map, 1);
  return { map, waves: buildCampaignWaves(map, null) };
}
function playLive(B, extra) {
  const init = { ...B, carry: null, harvesterLevel: 1, structTiers: null, mapId: 2, faction: null, ...extra };
  const sim = createSim(77, init), log = createLog(77, init);
  const submit = (cmd) => { const r = applyCommand(sim, cmd); if (r.ok) recordCommand(log, sim.tick, cmd); return r; };
  const b = B.map.base;
  const cell = [[3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3]].map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy }))
    .find((c) => applyCommand(createSim(77, init), { type: 'place', structId: 'STR-Cannon', cell: c }).ok);
  assert.ok(cell, 'a legal cannon cell next to the base');
  assert.equal(submit({ type: 'place', structId: 'STR-Cannon', cell }).ok, true);
  for (let t = 0; t < TICKS; t++) {
    if (t === 30) submit({ type: 'startWave' });
    if (t % 120 === 0) for (const s of sim.structures.values()) submit({ type: 'upgrade', id: s.id });   // tier 3 only where unlocked
    if (sim.bonuses && sim.bonuses.offer && sim.bonuses.offer.length) submit({ type: 'chooseBonus', bonusId: sim.bonuses.offer[0] });
    stepSim(sim, FIXED_DT);
  }
  log.finalHash = hashState(sim);
  return { sim, log };
}

// A deterministic opening-gold cushion (carried identically into replay by replayOpts) so the single
// cannon can actually be upgraded to tier 3 — the bigger advanced-mode waves [MM-story_mvnzz719_2]
// tighten the in-battle economy enough that kill/harvest income alone no longer funds the T2→T3 upgrade,
// which would leave this guard's tier-3 assertion unreachable for reasons unrelated to replay/init.
const UPGRADED = { harvesterLevel: 3, structTiers: { cannon: 3, flak: 3, wall: 3 }, carry: { gold: 8000 } };

test('replay: a serialized campaign log + the rebuilt board reproduces the live hash (upgraded save)', () => {
  const B = board(2);
  const { sim, log } = playLive(B, UPGRADED);
  const L = deserializeLog(serializeLog(log));               // what localStorage holds
  const r = runReplay({ ...L, init: replayOpts(L.init, board(2)) }, sim.tick);   // board rebuilt from mapId, as after a reload
  assert.equal(r.hash, log.finalHash);
});

test('replay: the run actually depends on the init it carries (guards fault 1 from passing vacuously)', () => {
  const B = board(2);
  const { sim, log } = playLive(B, UPGRADED);
  assert.ok([...sim.structures.values()].some((s) => s.tier === 3), 'the upgraded save reached a tier-3 cannon');
  const L = deserializeLog(serializeLog(log));
  const old = runReplay({ ...L, init: { map: B.map, waves: B.waves, carry: null } }, sim.tick);   // the pre-fix playback opts
  assert.notEqual(old.hash, log.finalHash, 'dropping harvesterLevel/structTiers must diverge, or this test proves nothing');
});

test('replay: a serialized log WITHOUT the board runs the wrong field (why the check needs replayOpts)', () => {
  const { sim, log } = playLive(board(2), {});
  const bare = runReplay(deserializeLog(serializeLog(log)), sim.tick);
  assert.notEqual(bare.hash, log.finalHash);
});

test('replayOpts: carries every rebuildable scalar and the board, defaults the rest', () => {
  const B = { map: { id: 'm' }, waves: [1] };
  assert.deepEqual(replayOpts({ mapId: 4, faction: 'Dark', carry: { gold: 5 }, harvesterLevel: 2, structTiers: { cannon: 3 } }, B),
    { map: B.map, waves: B.waves, carry: { gold: 5 }, harvesterLevel: 2, structTiers: { cannon: 3 }, mapId: 4, faction: 'Dark' });
  assert.deepEqual(replayOpts(null, B), { map: B.map, waves: B.waves, carry: null, harvesterLevel: 1, structTiers: null, mapId: null, faction: null });
});
