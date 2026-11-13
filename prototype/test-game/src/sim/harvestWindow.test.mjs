// Owner 2026-11-10 [MM-story_mwbd4114_28]: "when you clear the attack wave, celebrate with a message but let the player
// continue to harvest resources until time expires. Time on each level should be based on the expected attack duration
// plus 15 seconds." Then (owner, same day) "each wave is tuned to 3 minutes" [MM-story_mwbkgcmu_2b]: a campaign wave
// lasts WAVE_WINDOW_SEC; cleared sooner, it stays open to harvest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, stepSim, applyCommand } from './core.js';
import { buildCampaignWaves } from './campaign.js';
import { WAVE_CLEAR_HARVEST_SEC } from '../data/tables.js';
import { waveClockText, fmtWaveClock } from '../render/hud.js';

const DT = 1 / 30;
const board = () => { const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1); return createSim(3, { map, waves: buildCampaignWaves(map) }); };
const killAttackers = (s) => { for (const u of s.units.values()) if (u.side === 'attacker') u.hp = 0; };

// Then (owner 2026-11-12) [MM-story_mwebtduu_1]: "From the last kill player get 20 seconds of bonus time to gather
// resources. The waves are finishing in 30 seconds and then testers sit for 2 and a half minutes."

test('a campaign wave has no clock while it is fought; its 20 s of harvest bonus time is armed', () => {
  assert.equal(WAVE_CLEAR_HARVEST_SEC, 20);
  const sim = board();
  assert.ok(applyCommand(sim, { type: 'startWave' }).ok);
  assert.equal(sim.waves.endsAt, null, 'no clock until the last kill');
  assert.equal(sim.waves.harvestAfterClear, 20);
});

test('cleared early: secured, the harvest runs 20 s from the last kill, then the wave ends', () => {
  const sim = board();
  applyCommand(sim, { type: 'startWave' });
  let secured = null, cleared = null, stars = null;
  for (let i = 0; i < 30 * 600 && sim.waves.pendingSpawns.length; i++) stepSim(sim, DT);
  killAttackers(sim);
  const clearAt = sim.time;
  assert.ok(clearAt - sim.waves.waveStart.time < 160, 'a quick wave (' + (clearAt - sim.waves.waveStart.time).toFixed(0) + ' s)');
  const takeAtClear = { ...sim.waveTake };
  for (let i = 0; i < 30 * 600 && !cleared; i++) {
    for (const e of stepSim(sim, DT)) {
      if (e.type === 'wave' && e.phase === 'secured') secured = { e, t: sim.time };
      if (e.type === 'wave' && e.phase === 'clear') cleared = { e, t: sim.time };
      if (e.type === 'waveStars') stars = e;
    }
    if (secured && !cleared) assert.ok(sim.waves.active, 'the wave stays open through its bonus time');
  }
  assert.ok(secured, 'a secured event');
  assert.equal(secured.e.wave, 1);
  assert.ok(Math.abs(secured.e.left - 20) < 0.11, 'the banner offers 20 s (' + secured.e.left + ')');
  assert.ok(Math.abs(secured.e.endsAt - (secured.t + 20)) < 1e-9);
  assert.ok(cleared && cleared.t >= secured.t + 20 - 1e-9 && cleared.t < secured.t + 20 + 2 * DT, 'the wave ends 20 s after the last kill');
  assert.ok(cleared.t - clearAt < 21, 'no 3-minute wait: ' + (cleared.t - clearAt).toFixed(1) + ' s after the kill');
  assert.equal(sim.waves.active, false);
  const after = (sim.waveTake.common || 0) + (sim.waveTake.uncommon || 0);
  const before = (takeAtClear.common || 0) + (takeAtClear.uncommon || 0);
  assert.ok(after > before, 'more was gathered in the bonus time (' + before + ' -> ' + after + ')');
  // the par star times the fight, not the bonus time
  assert.ok(stars.detail.time.sec <= Math.round((secured.t - sim.waves.waveStart.time) * 10) / 10 + 0.1);
  assert.equal(stars.flags[4], stars.detail.time.sec <= sim.map.rings[0].parSec);
});

test('a long fight still gets its 20 s after the last kill (past the old 3-minute mark)', () => {
  const sim = board();
  applyCommand(sim, { type: 'startWave' });
  for (let i = 0; i < 30 * 600 && sim.waves.pendingSpawns.length; i++) stepSim(sim, DT);
  // the fight drags past the old 3-minute mark
  sim.time = sim.waves.waveStart.time + 200;
  stepSim(sim, DT);
  assert.ok(sim.waves.active && sim.waves.endsAt == null, 'still fighting, no clock');
  killAttackers(sim);
  let secured = null, cleared = null;
  for (let i = 0; i < 30 * 60 && !cleared; i++) for (const e of stepSim(sim, DT)) {
    if (e.type === 'wave' && e.phase === 'secured') secured = sim.time;
    if (e.type === 'wave' && e.phase === 'clear') cleared = sim.time;
  }
  assert.ok(secured != null && cleared != null && Math.abs(cleared - secured - 20) < 2 * DT, 'secured, then 20 s, then clear');
});

test('an outpost raid (no fields, no par) has no bonus time: it ends at its last kill', () => {
  const sim = board();
  applyCommand(sim, { type: 'startWave' });
  sim.waves.harvestAfterClear = null;   // what startNextWave sets on a board without harvest rings
  for (let i = 0; i < 30 * 600 && sim.waves.pendingSpawns.length; i++) stepSim(sim, DT);
  killAttackers(sim);
  let secured = false, cleared = false;
  for (let i = 0; i < 4; i++) for (const e of stepSim(sim, DT)) {
    if (e.type === 'wave' && e.phase === 'secured') secured = true;
    if (e.type === 'wave' && e.phase === 'clear') cleared = true;
  }
  assert.ok(cleared && !secured, 'ends at once');
});

test('the HUD readout: enemies + time left, then secured + harvest time', () => {
  assert.equal(fmtWaveClock(75.2), '1:16');
  assert.equal(fmtWaveClock(0), '0:00');
  const w = { endsAt: 100, securedAt: null };
  assert.equal(waveClockText(w, 7, 40), '⚔ 7 left · 1:00');
  assert.equal(waveClockText({ endsAt: 100, securedAt: 60 }, 0, 88), '✔ Secured · harvest 0:12');
  assert.equal(waveClockText({ endsAt: null }, 3, 10), '⚔ 3 left', 'an untimed wave reads as before');
  assert.equal(waveClockText({ endsAt: 100, securedAt: null }, 2, 130), '⚔ 2 left', 'over time: just the count');
});
