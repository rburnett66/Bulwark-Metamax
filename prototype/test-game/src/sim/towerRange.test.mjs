/** towerRange.test.mjs — upgrades add range [MM-story_mvlebo9c_3]. Owner 2026-10-23: "Tower upgrades should all
 *  increase range 10%". Run: node --test src/sim/towerRange.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, MAP, TOWER_RANGE_PER_UPGRADE, towerRange } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { placeCompletedStructure } from './balanceSim.js';
import { planCoverage } from '../render3d/overlays/coverage.js';
import { getStructureDef } from '../data/tables.js';

test('every tower: T2 reaches 10% further than T1, T3 10% further than T2', () => {
  assert.equal(TOWER_RANGE_PER_UPGRADE, 0.10);
  let towers = 0;
  for (const [id, def] of Object.entries(STRUCTURES)) {
    if (!(def.range > 0)) { assert.equal(towerRange(def, 3), 0, `${id} has no range to grow`); continue; }
    towers++;
    assert.equal(towerRange(def, 1), def.range, `${id} T1`);
    assert.ok(Math.abs(towerRange(def, 2) - def.range * 1.1) < 1e-9, `${id} T2`);
    assert.ok(Math.abs(towerRange(def, 3) - def.range * 1.21) < 1e-9, `${id} T3`);
  }
  assert.ok(towers >= 5, 'the towers were checked');
  assert.equal(towerRange(STRUCTURES['STR-Cannon'], undefined), STRUCTURES['STR-Cannon'].range, 'an untiered structure is T1');
});

function hitsAt(tier, dist) {
  const st = createSim(11, { waves: [], map: MAP });
  if (st.base) st.base.cannon = null;
  const slot = MAP.slots[6];
  const tw = placeCompletedStructure(st, 'STR-Cannon', slot);
  tw.tier = tier;
  const u = createUnit(st, 'GND-Troops', 1, { x: tw.pos.x + dist, y: tw.pos.y }, 'ground', 'attacker');
  if (!st.units.has(u.id)) st.units.set(u.id, u);
  u.speed = 0; u.dps = 0; u.hp = u.maxHp = 1e6; u.path = []; u.targetsBase = false;
  let dmg = 0;
  for (let t = 0; t < 120; t++) for (const e of stepSim(st, FIXED_DT)) if (e.type === 'damage' && e.sourceId === tw.id && e.targetId === u.id) dmg += e.amount;
  return dmg;
}

test('in the sim: a troop just past T1 reach is shot only once the tower is upgraded', () => {
  const R = STRUCTURES['STR-Cannon'].range;
  assert.ok(hitsAt(1, R * 0.9) > 0, 'control: T1 hits inside its range');
  assert.equal(hitsAt(1, R * 1.05), 0, 'T1 cannot reach 105%');
  assert.ok(hitsAt(2, R * 1.05) > 0, 'T2 reaches 105%');
  assert.equal(hitsAt(2, R * 1.15), 0, 'T2 cannot reach 115%');
  assert.ok(hitsAt(3, R * 1.15) > 0, 'T3 reaches 115%');
});

test('the range ring shows the upgraded reach', () => {
  const st = createSim(11, { waves: [], map: MAP });
  const tw = placeCompletedStructure(st, 'STR-Cannon', MAP.slots[6]);
  tw.tier = 3;
  const rings = planCoverage(st, { selectedStructureId: tw.id }, getStructureDef).filter((c) => c.shape === 'circle' && c.primary);
  assert.equal(rings.length, 1);
  assert.ok(Math.abs(rings[0].r - STRUCTURES['STR-Cannon'].range * 1.21) < 1e-9);
});
