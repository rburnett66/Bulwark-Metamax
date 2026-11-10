// The Verdance farm cells (story A6 [MM-story_mwabgjcm_c]; Farming-Design §2.1, §4.4; tech plan Farming.md §5 A6):
// the farm-cell layer the Terrain Forge writes on the outpost map, its reader and the 2 × 2 plot placement rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outpostMapFromForge, draftOutpostMap } from '../outpost/outpostMap.js';
import { referenceOutpost, surfaceFields, surfaceFieldGroups } from '../outpost/model.js';
import { generateTerrain } from '../terrain/terrainGen.js';
import { stampOutpost } from '../terrain/outpostPads.js';
import { deriveFarmCells, farmCellCounts, FARM_CELL } from '../terrain/farmCells.js';
import { farmCellAt, canPlacePlot, plotSpots, packPlots, hasFarmLayer } from './cells.js';

const FORGE = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const map = outpostMapFromForge(FORGE);
const W = map.width;
const find = (tag) => { const i = map.farmCells.indexOf(FARM_CELL[tag]); return [i % W, (i / W) | 0]; };

test('the Verdance outpost map carries the farm-cell layer, read through outpostMapFromForge', () => {
  assert.ok(hasFarmLayer(map));
  assert.equal(map.farmCells.length, 64 * 32);
  const c = farmCellCounts(map.farmCells);
  for (const k of ['soil', 'slope', 'water', 'grove', 'collection', 'lane']) assert.ok(c[k] > 0, `${k} cells (${c[k]})`);
  // measured on the shipped map (seed 40): soil 1035, slope 77, water 130, grove 234, collection 15, lane 117 (the old
  // seed-313 map before A6, derived the same way: soil 831, slope 59, water 169, grove 348, collection 54, lane 117)
  assert.ok(c.soil >= 1000, `soil ${c.soil}`);
  assert.equal(farmCellAt(map, -1, 0), null);
  assert.equal(farmCellAt(draftOutpostMap('ground'), 1, 1), null, 'the draft layout has no layer');
});

test('the layer is what the Forge derives from the stamped grid (mesa none, ramps slope, lanes, ponds, groves, fields)', () => {
  const g = generateTerrain({ cols: FORGE.cols, rows: FORGE.rows, seed: FORGE.seed, types: FORGE.types, water: FORGE.water });
  stampOutpost(g, { mesa: FORGE.mesa, pads: FORGE.pads, spawns: FORGE.spawns, kitDefenses: FORGE.kitDefenses });
  assert.deepEqual(FORGE.farmCells, deriveFarmCells(FORGE, g.lanes));
  for (let i = 0; i < FORGE.farmCells.length; i++) {
    const t = FORGE.farmCells[i], x = i % W, y = (i / W) | 0;
    if (FORGE.heights[i] === 2) assert.equal(t, FARM_CELL.NONE, 'the outpost owns the mesa top');
    if (FORGE.heights[i] === 1) assert.equal(t, FARM_CELL.SLOPE, 'a ramp is a slope');
    if (t === FARM_CELL.SOIL) assert.ok(!FORGE.blocking[i] && FORGE.terrain[i] <= 2, `soil (${x}, ${y}) is open grass, dirt or brush`);
    if (t === FARM_CELL.WATER) assert.equal(FORGE.terrain[i], 6);
  }
  for (const s of map.spawns) assert.equal(farmCellAt(map, s.x, s.y), 'lane', 'each raid spawn starts its lane');
  for (const r of FORGE.resources) assert.ok(['collection', 'none', 'lane', 'slope'].includes(farmCellAt(map, r.x, r.y)), `field (${r.x}, ${r.y})`);
});

test('at least 30 2 × 2 soil plots fit round the mesa (measured: 688 spots, 109 packed with a 1-cell walkway between plots, 210 edge to edge; the old map 460 and 148)', () => {
  const spots = plotSpots(map), packed = packPlots(map);
  assert.ok(packed.length >= 30, `packed plots ${packed.length}`);
  assert.equal(spots.length, 688);
  assert.equal(packed.length, 109);
  assert.equal(packPlots(map, null, 2, 2, 0).length, 210);   // edge to edge, the old packing
  for (const p of packed) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    assert.equal(map.heights[(p.y + dy) * W + p.x + dx], 0, 'off the mesa');
    assert.equal(farmCellAt(map, p.x + dx, p.y + dy), 'soil');
  }
});

test('placement refusals: off the map, mesa, pads, lanes, blocking, defenses, other farm things, not soil', () => {
  const [sx, sy] = plotSpots(map)[0];
  assert.equal(canPlacePlot(map, null, sx, sy), true);
  assert.equal(canPlacePlot(draftOutpostMap('ground'), null, 0, 0), 'no farm layer');
  assert.equal(canPlacePlot(map, null, -1, 0), 'off the map');
  assert.equal(canPlacePlot(map, null, W - 1, 0), 'off the map');
  const hub = map.pads.find((p) => p.role === 'hub');
  assert.equal(canPlacePlot(map, null, hub.x, hub.y), 'on the mesa');
  const r3 = map.pads.find((p) => p.id === 'r3');
  assert.equal(canPlacePlot(map, null, r3.x, r3.y), 'on a pad', 'the remote rig in the lowland');
  assert.equal(canPlacePlot(map, null, r3.x + r3.w, r3.y), 'on a pad', 'its 1-cell yard');
  const [lx, ly] = [map.spawns[0].x, map.spawns[0].y];
  assert.equal(canPlacePlot(map, null, lx, ly), 'on a raid lane');
  const bi = map.blocking.findIndex((b, i) => b && map.heights[i] === 0 && map.farmCells[i] !== FARM_CELL.LANE
    && !map.pads.some((p) => Math.abs(i % W - p.x) < 4 && Math.abs(((i / W) | 0) - p.y) < 4));
  assert.equal(canPlacePlot(map, null, Math.min(bi % W, W - 2), Math.min((bi / W) | 0, 30), 1, 1), 'on blocking terrain');
  const o = { defenses: [{ id: 'd9', kind: 'mg', cell: [sx + 1, sy] }] };
  assert.equal(canPlacePlot(map, o, sx, sy), 'on a defense');
  assert.equal(canPlacePlot(map, referenceOutpost('ground', { seed: 1, map, now: 0 }), sx, sy), true, 'the kit stands on the mesa');
  assert.equal(canPlacePlot(map, null, sx, sy, 2, 2, [{ x: sx + 1, y: sy + 1, w: 2, h: 2 }]), 'overlaps another farm thing');
  assert.equal(canPlacePlot(map, null, sx, sy, 2, 2, [{ x: sx + 2, y: sy, w: 2, h: 2 }]), true, 'touching is fine');
  const [wx, wy] = find('WATER');
  assert.equal(canPlacePlot(map, null, Math.min(wx, W - 2), wy, 1, 1), 'on blocking terrain', 'water blocks');
  // a slope cell at the cliff's foot is open ground but not soil
  const si = map.farmCells.findIndex((c, i) => c === FARM_CELL.SLOPE && map.heights[i] === 0);
  assert.equal(canPlacePlot(map, null, si % W, (si / W) | 0, 1, 1), 'not soil');
});

test('far fewer natural resources: 15 Forge resource fields (was 54), 11 surface fields for the harvesters (was 48 in 44 groups)', () => {
  // before A6 the Verdance outpost (seed 313) carried the battle maps' scatter: 54 resources, 48 harvestable cells in
  // 44 groups. Owner 2026-11-10: "way fewer natural resources to gather".
  assert.equal(FORGE.resources.length, 15);
  assert.equal(FORGE.resourceDensity, 0.0125, 'the Forge knob that made it');
  const f = surfaceFields(map);
  assert.equal(f.length, 11);
  assert.equal(surfaceFieldGroups(map).length, 11);
  assert.ok(f.some((c) => c.tier === 'common') && f.some((c) => c.tier === 'uncommon'), 'the harvesters still have both tiers');
});
