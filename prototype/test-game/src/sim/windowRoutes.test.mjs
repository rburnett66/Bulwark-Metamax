// [MM-story_mw2xd5wf_1] Ground troops stay in their wave's window. Owner 2026-11-04: "I am seeing some bizarre unit
// pathing where unit appear to wrap around the map even leaving the visual area into the fog".
// Cause: one shared route list seeded from wave 1's spawn; forge maps alternate sides, so a wave-2 unit on the east
// was handed a west route and walked across the base, out of its window, and back. Now: a route set per painted
// spawn point, searched inside that wave's window; points that cannot reach the base in their window are dropped;
// a window with no way through at all grows to cover the route.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { buildTerrainMap, resolveResourceTypes } from './mapgen.js';
import { buildCampaignWaves } from './campaign.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FACTIONS = ['powder', 'air', 'high-tech', 'artillery', 'water', 'arcane-energy', 'space-tech', 'dark-energy', 'greenies'];
const load = (fac, id) => buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, `content/maps/forge/${fac}-map-${id}.json`), 'utf8')), id, { seed: 0, bakeTune: {} });

test('pathfinding: a bounds rectangle keeps the route inside it, and is ignored from a start outside it', () => {
  const nav = buildNavGrid({ cols: 10, rows: 10, waterCells: [], blockedCells: [] }, []);
  const B = { x0: 0, y0: 0, x1: 9, y1: 2 };
  const p = findWalkerPath(nav, { x: 0, y: 1 }, { x: 9, y: 1 }, null, false, B);
  assert.ok(p && p.every((c) => c.y >= 0 && c.y <= 2));
  // a wall across the band → no route inside it
  const walled = buildNavGrid({ cols: 10, rows: 10, waterCells: [], blockedCells: [0, 1, 2].map((y) => ({ x: 5, y })) }, []);
  assert.equal(findWalkerPath(walled, { x: 0, y: 1 }, { x: 9, y: 1 }, null, false, B), null);
  assert.ok(findWalkerPath(walled, { x: 0, y: 1 }, { x: 9, y: 1 }, null, false), 'unbounded still finds the way round');
  assert.ok(findWalkerPath(walled, { x: 0, y: 8 }, { x: 9, y: 1 }, null, false, B), 'start outside → bounds ignored');
});

test('all 81 maps: every ground spawn point reaches the base inside its wave window', () => {
  let points = 0, grown = 0;
  for (const fac of FACTIONS) for (let id = 1; id <= 9; id++) {
    const map = load(fac, id);
    const nav = buildNavGrid(map, []);
    for (const ring of map.rings) {
      const w = map.waveWindows.find((x) => x.wave === ring.wave);
      if (w.grownFrom) grown++;
      const B = { x0: Math.max(0, w.x0 - 1), y0: Math.max(0, w.y0 - 1), x1: Math.min(map.cols - 1, w.x1 + 1), y1: Math.min(map.rows - 1, w.y1 + 1) };
      for (const p of (ring.spawnList && ring.spawnList.ground) || []) {
        points++;
        const r = findWalkerPath(nav, p, map.base, null, false, B);
        assert.ok(r && r.length, `${fac}-map-${id} wave ${ring.wave} (${p.x},${p.y}) cannot reach the base in its window`);
      }
    }
  }
  assert.ok(points > 3000, `${points} points checked`);
  assert.ok(grown < 40, `${grown} windows had to grow`);
});

test('dropping cut-off points keeps the wave its size (the budget counts every painted point)', () => {
  const map = load('powder', 7);   // wave 2 had two points (52,15) and (52,18) cut off by terrain
  const forge = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-7.json'), 'utf8'));
  const painted = (forge.spawnsByWave[2] || []).filter((s) => s.lane === 'ground').length;
  const ring = map.rings[1];
  assert.ok(ring.droppedGround > 0, 'some points were dropped');
  assert.equal(ring.spawnList.ground.length, painted - ring.droppedGround);
  assert.ok(ring.budget.ground >= painted * 3, 'budget still counts all painted points');
});

/** Run waves 1..n on a map with an unkillable base; worst distance (cells) any walker got outside its window. */
function worstOutside(fac, id, waves) {
  const map = load(fac, id);
  resolveResourceTypes(map, 1);
  const sim = createSim(1, { waves: buildCampaignWaves(map, null), map });
  sim.base.hp = sim.base.maxHp = 1e9;
  let worst = 0, where = null;
  for (let wave = 1; wave <= waves; wave++) {
    applyCommand(sim, { type: 'startWave' });
    const W = map.waveWindows.find((x) => x.wave === wave);
    for (let t = 0; t < 30 * 60; t++) {
      stepSim(sim, FIXED_DT);
      for (const u of sim.units.values()) {
        if (u.side !== 'attacker' || u.domain !== 'Walker' || u.hp <= 0) continue;
        const dx = Math.max(W.x0 - u.pos.x, 0, u.pos.x - (W.x1 + 1)), dy = Math.max(W.y0 - u.pos.y, 0, u.pos.y - (W.y1 + 1));
        const d = Math.hypot(dx, dy);
        if (d > worst) { worst = d; where = `wave ${wave} ${u.unitId} (${u.pos.x.toFixed(1)},${u.pos.y.toFixed(1)})`; }
      }
    }
    for (const u of sim.units.values()) if (u.side === 'attacker') u.hp = 0;
    for (let k = 0; k < 10; k++) stepSim(sim, FIXED_DT);
  }
  return { worst, where };
}

test('powder-map-1 waves 1–2: no walker leaves its window (wave 2 used to cross to wave 1\'s spawn, 18.7 cells out)', () => {
  const { worst, where } = worstOutside('powder', 1, 2);
  assert.ok(worst < 2.5, `worst ${worst.toFixed(1)} cells out: ${where}`);
});

test('water-map-1 wave 1: the lake forces a route south — the window grows to cover it', () => {
  const map = load('water', 1);
  assert.ok(map.waveWindows[0].grownFrom, 'wave 1 window grew');
  const { worst, where } = worstOutside('water', 1, 1);
  assert.ok(worst < 2.5, `worst ${worst.toFixed(1)} cells out: ${where}`);
});
