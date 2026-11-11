// Owner 2026-11-10 [MM-story_mwbd4114_28]: "when you clear the attack wave, celebrate with a message but let the player
// continue to harvest resources until time expires. Time on each level should be based on the expected attack duration
// plus 15 seconds." A campaign wave lasts its par + WAVE_HARVEST_EXTRA_SEC; cleared sooner, it stays open to harvest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, stepSim, applyCommand } from './core.js';
import { buildCampaignWaves } from './campaign.js';
import { WAVE_HARVEST_EXTRA_SEC } from '../data/tables.js';
import { waveClockText, fmtWaveClock } from '../render/hud.js';

const DT = 1 / 30;
const board = () => { const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1); return createSim(3, { map, waves: buildCampaignWaves(map) }); };
const killAttackers = (s) => { for (const u of s.units.values()) if (u.side === 'attacker') u.hp = 0; };

test('a wave lasts its par + 15 s', () => {
  assert.equal(WAVE_HARVEST_EXTRA_SEC, 15);
  const sim = board();
  assert.ok(applyCommand(sim, { type: 'startWave' }).ok);
  assert.equal(sim.waves.endsAt, sim.time + sim.map.rings[0].parSec + 15);
});

test('cleared early: a secured celebration, the wave stays open and the harvest runs on to the end of its time', () => {
  const sim = board();
  applyCommand(sim, { type: 'startWave' });
  const endsAt = sim.waves.endsAt;
  // let the whole wave spawn, then wipe it out at once
  let secured = null, cleared = null, stars = null;
  for (let i = 0; i < 30 * 600 && sim.waves.pendingSpawns.length; i++) stepSim(sim, DT);
  killAttackers(sim);
  const clearAt = sim.time;
  assert.ok(clearAt < endsAt, 'the wipe lands with time on the clock');
  const takeAtClear = { ...sim.waveTake };
  for (let i = 0; i < 30 * 600 && !cleared; i++) {
    for (const e of stepSim(sim, DT)) {
      if (e.type === 'wave' && e.phase === 'secured') secured = { e, t: sim.time };
      if (e.type === 'wave' && e.phase === 'clear') cleared = { e, t: sim.time };
      if (e.type === 'waveStars') stars = e;
    }
    if (secured && !cleared) assert.ok(sim.waves.active, 'the wave stays open while its time runs');
  }
  assert.ok(secured, 'a secured event');
  assert.equal(secured.e.wave, 1);
  assert.ok(secured.e.left > 0 && Math.abs(secured.e.endsAt - endsAt) < 1e-9);
  assert.ok(cleared && cleared.t >= endsAt - 1e-9 && cleared.t < endsAt + 2 * DT, 'the wave ends when its time is up');
  assert.equal(sim.waves.active, false);
  // harvesters kept working through the window
  const after = (sim.waveTake.common || 0) + (sim.waveTake.uncommon || 0);
  const before = (takeAtClear.common || 0) + (takeAtClear.uncommon || 0);
  assert.ok(after > before, 'more was gathered after the clear (' + before + ' -> ' + after + ')');
  // the par star times the fight, not the window
  assert.ok(stars.detail.time.sec <= Math.round((secured.t - sim.waves.waveStart.time) * 10) / 10 + 0.1);
  assert.equal(stars.flags[4], stars.detail.time.sec <= sim.map.rings[0].parSec);
});

test('the time running out never ends a fight: attackers still alive keep the wave going', () => {
  const sim = board();
  applyCommand(sim, { type: 'startWave' });
  sim.waves.endsAt = sim.time + 1;   // a very short clock
  for (let i = 0; i < 30 * 3; i++) stepSim(sim, DT);
  assert.ok(sim.waves.active, 'the wave is still on with its attackers alive');
  let secured = false, cleared = false;
  for (let i = 0; i < 30 * 600 && sim.waves.pendingSpawns.length; i++) stepSim(sim, DT);
  killAttackers(sim);
  for (let i = 0; i < 4; i++) for (const e of stepSim(sim, DT)) {
    if (e.type === 'wave' && e.phase === 'secured') secured = true;
    if (e.type === 'wave' && e.phase === 'clear') cleared = true;
  }
  assert.ok(cleared && !secured, 'cleared after its time: it ends at once, no harvest window');
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
