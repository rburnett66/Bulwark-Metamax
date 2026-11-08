// Owner 2026-11-07: each wave opens with 1, 2, 3, then 3 harvesters; the stars ask for a common and an uncommon quota
// (no "all premium cleared" star), sized to what that fleet can gather, shown before the wave.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, stepSim, applyCommand } from './core.js';
import { buildCampaignWaves } from './campaign.js';
import { freeFleetFor, waveQuota, FREE_FLEET_BY_WAVE } from './harvest.js';

const board = () => { const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1); return { map, sim: createSim(3, { map, waves: buildCampaignWaves(map) }) }; };
const alive = (s) => s.harvesterIds.filter((id) => (s.units.get(id) || {}).hp > 0).length;

test('the free fleet: 1 on wave 1, 2 on wave 2, 3 on wave 3, then 3', () => {
  assert.deepEqual(FREE_FLEET_BY_WAVE, [1, 2, 3]);
  assert.deepEqual([1, 2, 3, 4, 8].map(freeFleetFor), [1, 2, 3, 3, 3]);
});

test('each wave tops the fleet up to its free size, and the quotas are set and counted', () => {
  const { sim } = board();
  for (let wave = 1; wave <= 3; wave++) {
    assert.ok(applyCommand(sim, { type: 'startWave' }).ok);
    assert.equal(alive(sim), freeFleetFor(wave), 'wave ' + wave + ' opens with its free fleet');
    const q = sim.waves.quota;
    assert.ok(q && q.common > 0, 'a common quota');
    assert.deepEqual(q, waveQuota(sim, wave, sim.map.rings[wave - 1].parSec), 'the same numbers the intel shows');
    let ev = null;
    for (let i = 0; i < 30 * 400 && !ev && !sim.result; i++) for (const e of stepSim(sim, 1 / 30)) if (e.type === 'waveStars') ev = e;
    if (!ev) break;
    assert.ok(ev.detail.common && ev.detail.common.need === q.common);
    assert.equal(ev.flags[2], ev.detail.common.gathered >= q.common);
    if (ev.detail.uncommon) assert.equal(ev.flags[3], ev.detail.uncommon.gathered >= q.uncommon);
  }
});

test('a quota asks only what the wave can give: never more than 60 % of its fields', () => {
  const { sim } = board();
  const q = waveQuota(sim, 1, 1e6);
  const ring = sim.resourceNodes.filter((n) => n.wave === 1 && n.color === 'blue').reduce((a, n) => a + n.units, 0);
  assert.ok(q.common <= Math.floor(ring * 0.6));
});
