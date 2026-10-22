// src/sim/obstructionGrid.test.mjs — [MM-task_mvj0k5ul_j] the obstruction grid gates building, and only water units cross
// water. Owner 2026-10-21: "There is supposed to be an obstruction grid that prevents placement of towers … units and
// towers don't go on water … Only water units path across water." validatePlacement used to read only named terrain
// ('rock', 'tree', …) that forge maps never carry, so every rock/tree/cliff and water cell took a tower. node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildTerrainMap, resolveResourceTypes } from './mapgen.js';
import { buildCampaignWaves } from './campaign.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { validatePlacement } from './structures.js';

const FORGE = new URL('../../content/maps/forge/powder-map-1.json', import.meta.url);

function sim() {
  const map = buildTerrainMap(JSON.parse(fs.readFileSync(FORGE, 'utf8')), 1, { seed: 0 });
  resolveResourceTypes(map, 1);
  const state = createSim(7, { map, waves: buildCampaignWaves(map) });
  state.gold = 1e7;
  return { state, map };
}
const inPlay = (map) => (c) => !map.playArea || (c.x >= map.playArea.x0 && c.x <= map.playArea.x1 && c.y >= map.playArea.y0 && c.y <= map.playArea.y1);

test('no tower or wall goes on an obstruction cell (rocks / trees / cliffs)', () => {
  const { state, map } = sim();
  const cells = map.blockedCells.filter(inPlay(map));
  assert.ok(cells.length > 20, `fixture: the map has obstructions in play (${cells.length})`);
  for (const id of ['STR-Cannon', 'STR-Wall']) {
    const took = cells.filter((c) => validatePlacement(state, id, c).ok);
    assert.equal(took.length, 0, `${id} accepted on ${took.length} obstruction cells, e.g. ${JSON.stringify(took[0])}`);
  }
  assert.equal(validatePlacement(state, 'STR-Cannon', cells[0]).reason, 'blocked by rocks or trees');
});

test('no tower or wall goes on water', () => {
  const { state, map } = sim();
  const cells = map.waterCells.filter(inPlay(map));
  assert.ok(cells.length > 20, `fixture: the map has water in play (${cells.length})`);
  for (const id of ['STR-Cannon', 'STR-Wall']) {
    const took = cells.filter((c) => validatePlacement(state, id, c).ok);
    assert.equal(took.length, 0, `${id} accepted on ${took.length} water cells, e.g. ${JSON.stringify(took[0])}`);
  }
  assert.equal(validatePlacement(state, 'STR-Cannon', cells[0]).reason, "can't build on water");
});

test('open ground still takes a tower (the gate is not a blanket refusal)', () => {
  const { state, map } = sim();
  const bad = new Set([...map.blockedCells, ...map.waterCells].map((c) => c.x + ',' + c.y));
  const pa = map.playArea || { x0: 0, y0: 0, x1: map.cols - 1, y1: map.rows - 1 };
  let ok = 0;
  for (let y = pa.y0; y <= pa.y1; y++) for (let x = pa.x0; x <= pa.x1; x++) {
    if (!bad.has(x + ',' + y) && validatePlacement(state, 'STR-Cannon', { x, y }).ok) ok++;
  }
  assert.ok(ok > 100, `open cells accepting a tower: ${ok}`);
});

test('ground troops cannot be sent onto water, and say why', () => {
  const { state, map } = sim();
  const w = map.waterCells.filter(inPlay(map));
  const r = applyCommand(state, { type: 'deployTroop', unitId: 'GND-Troops', dest: w[Math.floor(w.length / 2)] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "ground troops can't go on water");
});

test('only water units cross water: no ground unit stands on a water cell across three waves', () => {
  const { state, map } = sim();
  state.base.hp = state.base.maxHp = 1e9;
  const water = new Set(map.waterCells.map((c) => c.x + ',' + c.y));
  const wet = new Set();
  for (let w = 0; w < 3; w++) {
    applyCommand(state, { type: 'startWave' });
    for (let t = 0; t < 30 * 90; t++) {
      stepSim(state, FIXED_DT);
      for (const u of state.units.values()) {
        if (u.hp <= 0 || u.domain !== 'Walker' || u.altitude > 0) continue;
        if (water.has(Math.round(u.pos.x) + ',' + Math.round(u.pos.y))) wet.add(u.unitId);
      }
    }
  }
  assert.deepEqual([...wet], [], 'ground units seen standing on water');
});
