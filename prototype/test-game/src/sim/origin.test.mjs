// T0b [MM-story_mv7axdnv_f] — unit ORIGIN: every wave attacker records { wave, lane, point } at spawn.
// point = index into the wave's PAINTED spawn points for that lane (forge maps), null where there are none.
// Output only: no sim logic reads it, and the replay hash does not include it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { hashState } from './replay.js';
import { buildTerrainMap, buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { buildCampaignWaves } from './campaign.js';
import { spawnPointIndex } from './waves.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));

function run(map, ticks, seed = 1) {
  resolveResourceTypes(map, 1);
  const sim = createSim(seed, { waves: buildCampaignWaves(map, null), map });
  const spawns = [];
  for (let t = 1; t <= ticks; t++) {
    if (t % 300 === 1) applyCommand(sim, { type: 'startWave' });
    for (const e of stepSim(sim, FIXED_DT) || []) if (e.type === 'spawn') spawns.push(e);
  }
  return { sim, spawns };
}

test('forge level: every wave attacker carries { wave, lane, point } and the point IS where it spawned', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const { sim, spawns } = run(map, 3000);
  assert.ok(spawns.length >= 6, `spawned ${spawns.length}`);
  for (const e of spawns) {
    assert.ok(e.origin, 'spawn event carries origin');
    assert.equal(e.origin.wave, e.wave);
    assert.equal(e.origin.lane, e.lane);
    const list = map.rings[e.wave - 1].spawnList[e.lane];
    assert.ok(Number.isInteger(e.origin.point) && e.origin.point >= 0 && e.origin.point < list.length);
    assert.deepEqual({ x: e.pos.x, y: e.pos.y }, { x: list[e.origin.point].x, y: list[e.origin.point].y },
      'the event position is the painted point the origin names');
    const u = sim.units.get(e.entityId);
    if (u) assert.deepEqual(u.origin, e.origin, 'the unit and its spawn event agree');
  }
});

test('workbook campaign map: origin is set with point null (no painted points to name)', () => {
  const { spawns } = run(buildCampaignMap(3, { seed: 0 }), 3000);
  assert.ok(spawns.length > 0);
  for (const e of spawns) {
    assert.deepEqual(e.origin, { wave: e.wave, lane: e.lane, point: null });
  }
});

test('non-wave units carry origin null (harvesters, defenders, repair troops)', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const { sim } = run(map, 600);
  const others = [...sim.units.values()].filter((u) => u.side !== 'attacker');
  assert.ok(others.length > 0, 'the battle has at least one defender-side unit (the harvester)');
  for (const u of others) assert.equal(u.origin, null, `${u.unitId} #${u.id}`);
});

test('origin never reaches the replay hash', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const { sim } = run(map, 1200);
  const before = hashState(sim);
  for (const u of sim.units.values()) u.origin = { wave: 99, lane: 'x', point: 42 };
  assert.equal(hashState(sim), before);
});

test('spawnPointIndex cycles exactly like the spawner and is null without painted points', () => {
  const map = { rings: [{ spawnList: { ground: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] } }] };
  assert.deepEqual([0, 1, 2, 3, 7].map((s) => spawnPointIndex(map, 'ground', 1, s)), [0, 1, 2, 0, 1]);
  assert.equal(spawnPointIndex(map, 'air', 1, 0), null);
  assert.equal(spawnPointIndex({ rings: [] }, 'ground', 1, 0), null);
  assert.equal(spawnPointIndex(null, 'ground', 1, 0), null);
  assert.equal(spawnPointIndex(map, 'ground', 9, 4), 1, 'a wave past the last ring uses the last ring');
});
