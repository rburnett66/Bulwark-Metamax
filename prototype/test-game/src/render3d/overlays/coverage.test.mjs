// [MM-task_mvbry998_r] selecting a tower shows its range and its kind's coverage; placing shows the gap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCoverage, COVER_COLORS } from './coverage.js';

const DEFS = { cannon: { kind: 'antiGround', range: 4 }, flak: { kind: 'antiAir', range: 5 }, wall: { kind: 'wall' }, mine: { kind: 'mine', triggerRadius: 0.45 } };
const getDef = (id) => { if (!DEFS[id]) throw new Error('unknown'); return DEFS[id]; };
const S = (id, structId, x, y, extra = {}) => [id, { id, structId, kind: DEFS[structId].kind, pos: { x, y }, hp: 10, lifecycle: 'Complete', ...extra }];

test('selecting a tower: outline + dashed range, and the coverage of every live tower of its kind', () => {
  const state = { structures: new Map([S(1, 'cannon', 10, 10), S(2, 'cannon', 16, 10), S(3, 'flak', 12, 4), S(4, 'cannon', 20, 20, { hp: 0 }), S(5, 'wall', 5, 5)]) };
  const plan = planCoverage(state, { selectedStructureId: 1 }, getDef);
  const sq = plan.filter((p) => p.shape === 'square'), rings = plan.filter((p) => p.shape === 'circle');
  assert.equal(sq.length, 1, 'footprint outline');
  assert.deepEqual([sq[0].x, sq[0].z], [10.5, 10.5]);
  const own = rings.find((p) => p.primary);
  assert.equal(own.r, 4); assert.equal(own.dash, 1);
  const cover = rings.filter((p) => !p.primary);
  assert.equal(cover.length, 1, 'only the other LIVE anti-ground tower');
  assert.deepEqual([cover[0].x, cover[0].z, cover[0].color], [16.5, 10.5, COVER_COLORS.antiGround]);
  assert.ok(cover[0].fill > 0, 'filled, so overlaps read brighter');
  const wallSel = planCoverage(state, { selectedStructureId: 5 }, getDef);
  assert.equal(wallSel.filter((p) => p.shape === 'circle').length, 0, 'a wall has no range');
});

test('placing a tower shows its kind\'s coverage + the ghost range; placing a mine shows the armed mines', () => {
  const state = { structures: new Map([S(3, 'flak', 12, 4), S(1, 'cannon', 10, 10)]), mines: new Map([[9, { pos: { x: 3, y: 3 }, state: 'armed' }], [8, { pos: { x: 4, y: 3 }, state: 'flying' }]]) };
  const p = planCoverage(state, { buildSelection: 'flak', hoverCell: { x: 2, y: 2 }, hoverValid: true }, getDef);
  assert.equal(p.filter((q) => !q.primary).length, 1, 'the one existing flak');
  const ghost = p.find((q) => q.primary);
  assert.deepEqual([ghost.x, ghost.z, ghost.r], [2.5, 2.5, 5]);
  const bad = planCoverage(state, { buildSelection: 'flak', hoverCell: { x: 2, y: 2 }, hoverValid: false }, getDef).find((q) => q.primary);
  assert.equal(bad.color, COVER_COLORS.mine, 'an invalid spot rings red');
  const m = planCoverage(state, { buildSelection: 'mine' }, getDef);
  assert.equal(m.length, 1, 'armed mines only');
  assert.equal(planCoverage(state, {}, getDef).length, 0, 'nothing selected → nothing drawn');
});
