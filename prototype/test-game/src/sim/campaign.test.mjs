/** campaign.test.mjs — ring-campaign glue: budget-driven waves, spawns that advance with the ring,
 *  placement gated to revealed ground, deterministic across runs. Run: node src/sim/campaign.test.mjs */
import assert from 'node:assert';
import { buildCampaignMap } from './mapgen.js';
import { buildCampaignWaves, currentRing, POINTS_TO_POWER } from './campaign.js';
import { createSim, applyCommand, stepSim } from './core.js';
import { validatePlacement } from './structures.js';
import { UNITS } from '../data/tables.js';
import { hashState } from './replay.js';

// ── budgets fill honestly: composition power lands within one max-unit of the wave's budget ──
for (const id of [1, 5, 9]) {
  const map = buildCampaignMap(id, { seed: 1 });
  const waves = buildCampaignWaves(map);
  assert.strictEqual(waves.length, 8, `map ${id}: 8 waves`);
  assert.strictEqual(JSON.stringify(buildCampaignWaves(map)), JSON.stringify(waves), `map ${id}: waves deterministic`);
  for (let w = 0; w < 8; w++) {
    const ring = map.rings[w];
    const power = waves[w].spawns.reduce((s, sp) => s + (UNITS[sp.unitId].power || 0), 0);
    const target = ring.budget.total * POINTS_TO_POWER;
    assert(power > 0, `map ${id} wave ${w + 1}: spawns exist`);
    assert(power <= target, `map ${id} wave ${w + 1}: composition (${power}) within budget (${target})`);
    assert(power >= target - 120, `map ${id} wave ${w + 1}: budget actually spent (${power}/${target})`);
    for (const sp of waves[w].spawns) {
      if (sp.lane === 'water') assert(map.hasWater, `map ${id}: water spawns only on water maps`);
    }
    assert(waves[w].faction, `map ${id} wave ${w + 1}: faction assigned`);
  }
}

// ── the full flow on map 1: spawns advance outward with the ring; placement is ring-gated ──
function runCampaign(seed) {
  const map = buildCampaignMap(1, { seed: 2 });
  const waves = buildCampaignWaves(map);
  const s = createSim(seed, { map, waves });
  const spawnPos = [];   // first ground-spawn position seen per wave
  for (let wave = 1; wave <= 8; wave++) {
    const res = applyCommand(s, { type: 'startWave' });
    assert(res.ok, `wave ${wave} starts`);
    // run until the wave's schedule fully drains, sweeping attackers EVERY tick (an undefended base
    // would otherwise die mid-wave); capture the first ground-spawn position on the way
    let sawSpawn = null;
    for (let i = 0; i < 30 * 90 && !s.result; i++) {
      const evs = stepSim(s, 1 / 30);
      for (const e of evs) {
        if (e.type === 'spawn' && e.lane === 'ground' && !sawSpawn) sawSpawn = { x: e.pos.x, y: e.pos.y };
      }
      for (const u of s.units.values()) if (u.side === 'attacker') u.hp = 0;   // continuous sweep
      if (s.waves.cleared && !s.waves.active) break;
    }
    assert(!s.result || s.result === 'win', `wave ${wave}: base survived (result=${s.result})`);
    assert(sawSpawn, `wave ${wave} spawned ground units`);
    spawnPos.push(sawSpawn);
    const ring = currentRing(map, wave);
    assert.deepStrictEqual(sawSpawn, ring.spawns.ground, `wave ${wave} spawns at the ring's ground point`);
    assert(s.waves.cleared || s.result, `wave ${wave} cleared`);
  }
  return { s, spawnPos };
}
const runA = runCampaign(7);
// spawn distance from the base grows as the ring grows (the enemy walks farther)
const base = { x: 12, y: 8 };
const d1 = Math.hypot(runA.spawnPos[0].x - base.x, runA.spawnPos[0].y - base.y);
const d8 = Math.hypot(runA.spawnPos[7].x - base.x, runA.spawnPos[7].y - base.y);
assert(d8 > d1, `spawns pushed outward across the map (wave1 ${d1.toFixed(1)} -> wave8 ${d8.toFixed(1)})`);

// determinism of the full campaign flow
const runB = runCampaign(7);
assert.strictEqual(hashState(runA.s), hashState(runB.s), 'campaign runs deterministically');

// ── placement gating: inside the wave-1 pocket ok; outside the revealed ring rejected ──
{
  const map = buildCampaignMap(1, { seed: 2 });
  const s = createSim(3, { map, waves: buildCampaignWaves(map) });
  const pocket = map.rings[0].rect;
  s.money = 100000;
  const inside = { x: pocket.x0 + 1, y: pocket.y0 + 1 };
  const outside = { x: map.rings[7].rect.x1 - 1, y: map.rings[7].rect.y1 - 1 };
  const okIn = validatePlacement(s, 'STR-Wall', inside);
  const okOut = validatePlacement(s, 'STR-Wall', outside);
  assert(okIn.ok || okIn.reason === 'occupied', `inside the pocket is placeable (${okIn.reason || 'ok'})`);
  assert(!okOut.ok && /ring/.test(okOut.reason), `outside the ring is rejected (${okOut.reason})`);
}

console.log('campaign.test OK — budgets filled, spawns advance with the ring, placement ring-gated, deterministic');
