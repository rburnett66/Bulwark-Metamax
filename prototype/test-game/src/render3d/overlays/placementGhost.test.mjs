// [MM-task_mvfjylci_9] The build ghost is the structure's own model drawn as an outline — cyan where it fits, red where
// it doesn't — not a block; structures without a model keep the block.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createPlacementGhost, ghostModelKey, ghostGeometry, OUTLINE } from './placement.js';

test('which model each build tool ghosts', () => {
  assert.equal(ghostModelKey('STR-Cannon'), 'sys_cannon_t1');
  assert.equal(ghostModelKey('STR-Flak'), 'sys_flak_t1');
  assert.equal(ghostModelKey('STR-Rockets'), 'sys_rockets_t1');
  assert.equal(ghostModelKey('STR-Missile'), 'sys_missile_t1');
  assert.equal(ghostModelKey('STR-Wall'), 'sys_wall');
  assert.equal(ghostModelKey('STR-Mine'), null);
  assert.equal(ghostModelKey('STR-Harvestor'), null);
});

test('ghostGeometry: every part at its pivot, and one shared outward direction per position (a closed hull)', () => {
  const g = ghostGeometry(THREE, 'sys_cannon_t1'), P = g.attributes.position.array, O = g.attributes.aOut.array;
  const seen = new Map();
  let maxY = 0;
  for (let i = 0; i < P.length; i += 3) {
    maxY = Math.max(maxY, P[i + 1]);
    assert.ok(Math.abs(Math.hypot(O[i], O[i + 1], O[i + 2]) - 1) < 1e-5, 'unit outward');
    const k = `${P[i].toFixed(3)},${P[i + 1].toFixed(3)},${P[i + 2].toFixed(3)}`, o = `${O[i].toFixed(4)},${O[i + 1].toFixed(4)},${O[i + 2].toFixed(4)}`;
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k).add(o);
  }
  const shared = [...seen.values()].filter((v) => v.size === 1).length / seen.size;
  assert.ok(shared > 0.95, `corners push out one way in every face (${(shared * 100).toFixed(1)}%; thin plates excepted)`);
  assert.ok(maxY > 2, `the turret and barrel stand on the base (top ${maxY.toFixed(2)})`);
});

test('sync: the model outline for a tower, cyan / red with validity; the block for a mine; hidden when unarmed', () => {
  const scene = new THREE.Scene(), gh = createPlacementGhost(THREE, scene);
  gh.sync({ buildSelection: 'STR-Cannon', hoverCell: { x: 4, y: 5 }, hoverValid: true });
  assert.equal(gh.showing, 'model:sys_cannon_t1');
  assert.equal(gh.outlineColor, OUTLINE.ok);
  gh.sync({ buildSelection: 'STR-Cannon', hoverCell: { x: 4, y: 5 }, hoverValid: false });
  assert.equal(gh.outlineColor, OUTLINE.bad, 'red when it does not fit');
  gh.sync({ buildSelection: 'STR-Mine', hoverCell: { x: 4, y: 5 }, hoverValid: true });
  assert.equal(gh.showing, 'box');
  gh.sync({ buildSelection: null });
  assert.equal(gh.showing, null);
  gh.dispose();
});
