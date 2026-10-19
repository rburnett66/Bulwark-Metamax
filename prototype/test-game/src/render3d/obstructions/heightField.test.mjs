// [MM-story_mvegnpxf_i] aircraft clear plateaus, rocks and trees: the obstruction height field, the clearance over a
// point, and the eased lift every flyer gets — measured against the real Powder map 1 obstructions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../vendor/three.module.js';
import { buildHeightField, airClearance, createAirLift, AIR_CLEARANCE } from './heightField.js';
import { buildLowPolyObstructions } from './lowpoly.js';
import { buildTerrainMap } from '../../sim/mapgen.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FORGE = JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8'));
const map = buildTerrainMap(FORGE, 1, { seed: 0, bakeTune: {} });
const obs = buildLowPolyObstructions(THREE, map);
const field = buildHeightField(obs.group.children, map.cols, map.rows);

test('the real obstructions are taller than the old flyer height — the reason for this story', () => {
  assert.ok(field.max > HOVER_HEIGHT + 0.5, `tallest obstruction ${field.max.toFixed(2)} vs flyers ${HOVER_HEIGHT}`);
});

test('clearance: over every cell with an obstruction, the safe height is above everything within a cell of it', () => {
  let checked = 0;
  for (let z = 0; z < map.rows; z++) for (let x = 0; x < map.cols; x++) {
    const t = field.top[z * map.cols + x];
    if (!t) continue;
    checked++;
    const c = airClearance(field, x + 0.5, z + 0.5);
    assert.ok(c >= t + AIR_CLEARANCE - 1e-6, `cell ${x},${z}`);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = field.top[(z + dz) * map.cols + (x + dx)] || 0;
      if (x + dx >= 0 && x + dx < map.cols && z + dz >= 0 && z + dz < map.rows) assert.ok(c >= n + AIR_CLEARANCE - 1e-6);
    }
  }
  assert.ok(checked > 20, `the map has obstructions (${checked} cells)`);
  assert.equal(airClearance(field, -50, -50), 0, 'open ground off the map: no lift');
});

test('a flyer crossing a ridge is lifted over it — never through it — and settles back to cruise on open ground', () => {
  // find the tallest cell and fly a line across it
  let best = 0; for (let k = 1; k < field.top.length; k++) if (field.top[k] > field.top[best]) best = k;
  const bx = best % map.cols, bz = Math.floor(best / map.cols);
  const lift = createAirLift();
  const st = { units: new Map([[1, { id: 1, altitude: 1, domain: 'Flyer', hp: 5 }]]) };
  let minGap = Infinity, endY = 0;
  for (let i = -60; i <= 120; i++) {
    const x = bx + 0.5 + i * 0.05;
    const v = { id: 1, x, y: HOVER_HEIGHT, z: bz + 0.5 };
    lift.update(st, [v], field, null, 1 / 30);
    const under = field.top[bz * map.cols + Math.floor(x)] || 0;
    if (under) minGap = Math.min(minGap, v.y - under);
    assert.ok(lift.drawn.get(1).y === v.y, 'aim reads the drawn height');
    endY = v.y;
  }
  assert.ok(minGap >= AIR_CLEARANCE - 1e-6, `stays ${minGap.toFixed(2)} above the obstruction`);
  // far out on open ground, after a while, it sinks back toward cruise
  const lift2 = createAirLift(); const v2 = { id: 1, x: -20, y: HOVER_HEIGHT, z: -20 };
  lift2.update(st, [{ ...v2, x: bx + 0.5, z: bz + 0.5 }], field, null, 1 / 30);
  for (let i = 0; i < 300; i++) { const v = { ...v2 }; lift2.update(st, [v], field, null, 1 / 30); endY = v.y; }
  assert.ok(Math.abs(endY - HOVER_HEIGHT) < 1e-6, 'back at cruise height');
});

test('ground units are never lifted', () => {
  const lift = createAirLift();
  const st = { units: new Map([[2, { id: 2, altitude: 0, domain: 'Ground', hp: 5 }]]) };
  const v = { id: 2, x: 10.5, y: 0, z: 10.5 };
  lift.update(st, [v], field, null, 0.1);
  assert.equal(v.y, 0);
  const d = lift.drawn.get(2);   // listed only as a drawn GROUND pose (aim follows the driven unit) [MM-story_mvekcu8r_n]
  assert.ok(d && d.ground && d.x === 10.5 && d.y < 0.5 && !d.strafe);
});
