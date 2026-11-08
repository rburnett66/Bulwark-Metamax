// Owner 2026-11-07: "we need to reduce the speed of the wave one verdance units by 20%" (Verdance = Ground / Powder).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, stepSim, applyCommand } from './core.js';
import { buildCampaignWaves } from './campaign.js';
import { UNITS, WAVE_SPEED_MULT } from '../data/tables.js';

const FAC = 'Ground / Powder';
function spawned(wave) {
  const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1);
  const s = createSim(3, { map, waves: buildCampaignWaves(map, FAC) });
  for (let w = 1; w <= wave; w++) {
    applyCommand(s, { type: 'startWave' });
    if (w < wave) for (let i = 0; i < 30 * 400 && s.waves.active; i++) stepSim(s, 1 / 30);
  }
  for (let i = 0; i < 30 * 3; i++) stepSim(s, 1 / 30);
  return [...s.units.values()].filter((u) => u.side === 'attacker' && u.hp > 0);
}

test('Verdance wave 1 attackers move at 80 % of their speed; wave 2 at full speed', () => {
  assert.equal(WAVE_SPEED_MULT[FAC][1], 0.8);
  const w1 = spawned(1);
  assert.ok(w1.length > 0);
  for (const u of w1) assert.ok(Math.abs(u.speed - UNITS[u.unitId].speed * 0.8) < 1e-9, u.unitId + ' slowed');
  const w2 = spawned(2);
  for (const u of w2) assert.ok(Math.abs(u.speed - UNITS[u.unitId].speed) < 1e-9, u.unitId + ' full speed');
});
