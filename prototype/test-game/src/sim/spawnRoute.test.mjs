// [MM-story_mv8m42ti_f] — a walker spawned at a painted point AWAY from map.spawnGround must not be handed a
// shared route whose first waypoint sits behind a wall. powder-map-1 wave 1: AIR-Trucks spawned at (11,3), got
// the route [(12,14), …] string-pulled from (11,14), drove into the row-5 wall and flip-flopped ±0.15 cells
// every tick for the rest of the battle (5359 reversals in 90 s) — and never reached the base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { buildTerrainMap, resolveResourceTypes } from './mapgen.js';
import { buildCampaignWaves } from './campaign.js';
import { lineClear } from './pathfinding.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));

function battle(ticks) {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  resolveResourceTypes(map, 1);
  const sim = createSim(1, { waves: buildCampaignWaves(map, null), map });
  const prev = new Map(), lastD = new Map(), reversals = new Map(), firstPath = new Map(), closest = new Map();
  for (let t = 1; t <= ticks; t++) {
    if (t % 300 === 1) applyCommand(sim, { type: 'startWave' });
    stepSim(sim, FIXED_DT);
    for (const u of sim.units.values()) {
      if (u.side !== 'attacker' || u.domain !== 'Walker') continue;
      const db = Math.hypot(u.pos.x - sim.base.pos.x, u.pos.y - sim.base.pos.y);
      if (!closest.has(u.id) || db < closest.get(u.id).d) closest.set(u.id, { d: db, unitId: u.unitId });
      if (!firstPath.has(u.id) && u.path && u.path.length) firstPath.set(u.id, { from: { x: Math.round(u.pos.x), y: Math.round(u.pos.y) }, path: u.path.slice() });
      const p = prev.get(u.id);
      if (p) {
        const d = { x: u.pos.x - p.x, y: u.pos.y - p.y }, q = lastD.get(u.id);
        const m = Math.hypot(d.x, d.y);
        if (q && m > 0.02 && d.x * q.x + d.y * q.y < -0.9 * m * Math.hypot(q.x, q.y)) reversals.set(u.id, (reversals.get(u.id) || 0) + 1);
        lastD.set(u.id, d);
      }
      prev.set(u.id, { x: u.pos.x, y: u.pos.y });
    }
  }
  return { sim, reversals, firstPath, closest };
}

test('powder-map-1 wave 1: no attacker walker flip-flops (the AIR-Trucks wall bounce)', () => {
  const { sim, reversals } = battle(900);
  for (const [id, n] of reversals) {
    const u = sim.units.get(id);
    assert.ok(n < 20, `${u ? u.unitId : 'dead'} #${id} reversed direction ${n} times`);
  }
});

test('every walker can walk straight to the first waypoint it is handed', () => {
  const { sim, firstPath } = battle(400);
  assert.ok(firstPath.size >= 3, `tracked ${firstPath.size} walkers`);
  for (const [id, { from, path: p }] of firstPath) {
    assert.ok(lineClear(sim.navGrid, from, p[0]) || (from.x === p[0].x && from.y === p[0].y),
      `#${id} at (${from.x},${from.y}) → first waypoint (${p[0].x},${p[0].y}) crosses a wall`);
  }
});

test('the AIR-Trucks spawned at (11,3) reaches the base', () => {
  // its closest approach, not where it is at the end: since routes start at each unit's own spawn point
  // [MM-story_mw2xd5wf_1] it arrives sooner, attacks and is gone before tick 400
  const { closest } = battle(400);
  assert.ok(closest.has(2), 'unit #2 (the wave-1 AIR-Trucks) was tracked');
  assert.equal(closest.get(2).unitId, 'AIR-Trucks');
  assert.ok(closest.get(2).d < 4, `got no closer than ${closest.get(2).d.toFixed(1)} cells to the base`);
});
