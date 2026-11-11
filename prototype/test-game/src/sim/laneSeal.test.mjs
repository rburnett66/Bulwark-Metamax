// The shared placement keeps the ground lane open [MM-task_mwcdvk4o_2s]: a placement that CLOSES the last lane is
// refused (the battle, as before); a board whose lane is already closed — an outpost kit walls its ramps on purpose —
// may still build elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, applyCommand } from './core.js';
import { createStructure } from './entities.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';

const lanePath = (s) => {
  const m = s.map, src = m.rings && m.rings.length ? m.rings[0].spawns.ground : m.spawnGround;
  return findWalkerPath(buildNavGrid(m, [...s.structures.values()]), { x: src.x, y: src.y }, { x: m.base.x, y: m.base.y });
};
const rich = () => { const s = createSim(7, {}); s.economy.money = 1e7; s.economy.incomePerSec = 0; return s; };

test('a battle never lets the player close the lane: the closing wall is refused, the lane stays open', () => {
  const s = rich();
  const x = Math.floor((s.map.spawnGround.x + s.map.base.x) / 2);
  const reasons = [];
  for (let y = 0; y < s.map.rows; y++) reasons.push(applyCommand(s, { type: 'place', structId: 'STR-Wall', cell: { x, y } }).reason);
  assert.ok(reasons.includes('blocksPath'), 'one wall in the line is refused for closing the lane');
  assert.ok(lanePath(s), 'the lane is still open');
});

test('a board that is already closed still builds elsewhere (the seal was not this placement\'s)', () => {
  const s = rich();
  const x = Math.floor((s.map.spawnGround.x + s.map.base.x) / 2);
  for (let y = 0; y < s.map.rows; y++) {             // seal the lane directly, as an outpost kit's walls do
    const w = createStructure(s, 'STR-Wall', { x, y });
    w.lifecycle = 'Complete';
    s.structures.set(w.id, w);
  }
  assert.equal(lanePath(s), null, 'sealed');
  const res = applyCommand(s, { type: 'place', structId: 'STR-Cannon', cell: { x: s.map.base.x + 3, y: s.map.base.y + 3 } });
  assert.notEqual(res.reason, 'blocksPath', 'not refused for a seal it did not make');
});
