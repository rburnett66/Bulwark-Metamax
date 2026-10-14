// T3b [MM-story_mv79mi1o_d] — expected-path lines: keyed by unit origin, routed on the SIM's nav grid,
// live only while a unit with that origin lives, 0.3 s in / out, re-routed when the sim rebuilds its grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPathLines, lineKey, spawnCell, waveHsl, FADE, WAVE_HUES } from './pathLinesModel.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from '../../sim/core.js';
import { buildTerrainMap, buildCampaignMap, resolveResourceTypes } from '../../sim/mapgen.js';
import { buildCampaignWaves } from '../../sim/campaign.js';
import { buildNavGrid } from '../../sim/pathfinding.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));

function battle(map, ticks) {
  resolveResourceTypes(map, 1);
  const sim = createSim(1, { waves: buildCampaignWaves(map, null), map });
  applyCommand(sim, { type: 'startWave' });
  for (let t = 0; t < ticks; t++) stepSim(sim, FIXED_DT);
  return sim;
}

test('forge level: a live wave unit makes a line from its painted spawn point to the base, on the sim grid', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const sim = battle(map, 120);
  const attackers = [...sim.units.values()].filter((u) => u.origin);
  assert.ok(attackers.length > 0, 'wave 1 has spawned');
  const pl = createPathLines();
  const r = pl.update(sim, map, 1 / 60);
  assert.equal(r.geometryDirty, true);
  const keys = new Set(attackers.filter((u) => u.origin.lane === 'ground').map((u) => lineKey(u.origin)));
  assert.deepEqual(new Set(pl.lines.keys()), keys, 'exactly one line per live ground origin');
  for (const L of pl.lines.values()) {
    assert.ok(L.pts && L.pts.length >= 2, `${L.key} has a route`);
    assert.deepEqual(L.pts[0], L.spawn, 'starts at the painted spawn point');
    const end = L.pts[L.pts.length - 1], b = sim.base.pos || map.base;
    assert.ok(Math.hypot(end.x - b.x, end.y - b.y) <= 2.5, `${L.key} ends at the base (${end.x},${end.y})`);
    for (const p of L.pts) assert.equal(sim.navGrid.passable[p.y * map.cols + p.x] || 0, 1, 'every route cell is walkable on the sim grid');
  }
});

test('fade: 0 → 1 over 0.3 s while alive; out over 0.3 s after the last unit dies; then gone', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const sim = battle(map, 120);
  const pl = createPathLines();
  pl.update(sim, map, 0);
  const [k, L] = [...pl.lines.entries()][0];
  assert.equal(L.alpha, 0);
  pl.update(sim, map, FADE / 2);
  assert.ok(Math.abs(L.alpha - 0.5) < 1e-9 && Math.abs(L.prog - 0.5) < 1e-9, 'half-way after 0.15 s');
  pl.update(sim, map, FADE);
  assert.equal(L.alpha, 1);
  for (const u of sim.units.values()) if (u.origin && lineKey(u.origin) === k) u.hp = 0;   // its units all die
  pl.update(sim, map, FADE / 2);
  assert.ok(pl.lines.has(k) && Math.abs(L.alpha - 0.5) < 1e-9, 'fading out, still drawn');
  const r = pl.update(sim, map, FADE);
  assert.ok(!pl.lines.has(k), 'removed after fading out');
  assert.equal(r.geometryDirty, true);
});

test('structures: when the sim rebuilds its nav grid, every live line re-routes on the new grid', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const sim = battle(map, 120);
  const pl = createPathLines();
  pl.update(sim, map, 0.1);
  const L = [...pl.lines.values()][0];
  const before = JSON.stringify(L.pts);
  // wall off the route's middle cell the way the sim does on a build: a new grid object
  const mid = L.pts[(L.pts.length / 2) | 0];
  sim.navGrid = buildNavGrid(map, [], [{ x: mid.x, y: mid.y }]);
  assert.equal(pl.update(sim, map, 0.1).geometryDirty, true, 'a new grid object re-routes');
  assert.ok(L.pts && L.pts.length >= 2, 'still routed');
  assert.notEqual(JSON.stringify(L.pts), before, 'the route changed');
  assert.ok(!L.pts.some((p) => p.x === mid.x && p.y === mid.y), 'and avoids the blocked cell');
  assert.equal(pl.update(sim, map, 0.1).geometryDirty, false, 'same grid next frame: no rebuild');
});

test('no line for air/water origins, workbook maps (point null), dead units or units without an origin', () => {
  const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
  const fake = { navGrid: buildNavGrid(map, []), base: { pos: map.base }, units: new Map([
    [1, { id: 1, hp: 10, origin: { wave: 1, lane: 'air', point: 0 } }],
    [2, { id: 2, hp: 10, origin: { wave: 1, lane: 'ground', point: null } }],
    [3, { id: 3, hp: 0, origin: { wave: 1, lane: 'ground', point: 0 } }],
    [4, { id: 4, hp: 10, origin: null }],
  ]) };
  const pl = createPathLines();
  pl.update(fake, map, 0.1);
  assert.equal(pl.lines.size, 0);
  const wb = buildCampaignMap(3, { seed: 0 });
  assert.equal(spawnCell(wb, { wave: 1, lane: 'ground', point: null }), null);
});

test('per-wave colour: the prototype hues, alternate waves in lightness; wave 9 wraps to wave 1\'s hue', () => {
  assert.deepEqual(waveHsl(1), { h: WAVE_HUES[0], s: 0.62, l: 0.62 });
  assert.deepEqual(waveHsl(2), { h: WAVE_HUES[1], s: 0.62, l: 0.52 });
  assert.equal(waveHsl(9).h, WAVE_HUES[0]);
  assert.equal(new Set(WAVE_HUES).size, 8, 'eight distinct hues');
});

test('view: one ribbon mesh, 2 vertices per route point, fades update in place without a rebuild', async () => {
  const THREE = await import('../../../vendor/three.module.js');
  const { createPathLinesView } = await import('./pathLines.js');
  const scene = new THREE.Scene();
  const view = createPathLinesView(THREE, scene);
  const lines = new Map([['1:ground:0', { key: '1:ground:0', wave: 1, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }], len: 2.414, alpha: 0.5, prog: 0.5 }]]);
  assert.equal(view.sync(lines, true, 0), 1);
  const g = view.mesh.geometry;
  assert.equal(g.getAttribute('position').count, 6);
  assert.equal(g.index.count, 12, 'two quads');
  assert.ok(view.mesh.visible);
  lines.get('1:ground:0').alpha = 1;
  view.sync(lines, false, 1);
  assert.equal(view.mesh.geometry, g, 'no rebuild on a fade-only frame');
  assert.equal(g.getAttribute('aAlpha').array[0], 1);
  assert.equal(view.sync(new Map(), true, 2), 0);
  assert.equal(view.mesh.visible, false, 'hidden with no lines');
});
