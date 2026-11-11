// [MM-task_mvbry998_r] selecting a tower shows its range and its kind's coverage; placing shows the gap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCoverage, COVER_COLORS, coverClass } from './coverage.js';

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

// One Battle UX S2b [MM-story_mwc9plas_2h]: the energy grid's nodes are a third coverage class, `power` (cyan), at reach.
test('grid nodes are the `power` class: select one → every node\'s reach; arm one → the map + the ghost reach', async () => {
  const { getStructureDef } = await import('../../data/tables.js');
  const { structureDef } = await import('../../data/outpost.js');
  const st = getStructureDef('OUT-power'), py = getStructureDef('OUT-pylon');
  assert.equal(coverClass(st), 'power');
  assert.equal(coverClass(py), 'power');
  assert.equal(coverClass(getStructureDef('OUT-rig')), null, 'a consumer is not a node');
  assert.equal(coverClass(getStructureDef('OUT-mg')), 'antiGround', 'an outpost gun stays a tower');
  const O = (id, structId, x, y, extra = {}) => { const d = getStructureDef(structId);
    return [id, { id, structId, kind: d.kind, pos: { x, y }, footprint: d.footprint, tier: 1, hp: d.hp[0], lifecycle: 'Complete', ...extra }]; };
  const state = { structures: new Map([O(1, 'OUT-power', 10, 10, { tier: 2 }), O(2, 'OUT-pylon', 20, 10), O(3, 'OUT-pylon', 30, 30, { lifecycle: 'Destroyed' }),
    O(4, 'OUT-rig', 4, 4), O(5, 'OUT-mg', 6, 6)]) };
  // select the pylon: its own dashed ring at its reach, and the station's reach (at ITS tier) as cyan coverage
  const sel = planCoverage(state, { selectedStructureId: 2 }, getStructureDef);
  const own = sel.find((p) => p.shape === 'circle' && p.primary);
  assert.equal(own.r, structureDef('pylon', 1).reach);
  assert.deepEqual([own.x, own.z], [20.5, 10.5]);
  const cover = sel.filter((p) => !p.primary);
  assert.equal(cover.length, 1, 'the one other live node — not the destroyed pylon, not the rig, not the gun');
  assert.deepEqual([cover[0].x, cover[0].z, cover[0].r, cover[0].color], [11, 11, structureDef('power', 2).reach, COVER_COLORS.power]);
  // selecting the station shows the pylon's reach the same way
  assert.equal(planCoverage(state, { selectedStructureId: 1 }, getStructureDef).filter((p) => !p.primary)[0].r, structureDef('pylon', 1).reach);
  // arm a pylon: every node's reach + the ghost's reach at the hover cell
  const arm = planCoverage(state, { buildSelection: 'OUT-pylon', hoverCell: { x: 2, y: 3 }, hoverValid: true }, getStructureDef);
  assert.equal(arm.filter((p) => !p.primary).length, 2);
  const ghost = arm.find((p) => p.primary);
  assert.deepEqual([ghost.x, ghost.z, ghost.r, ghost.color], [2.5, 3.5, structureDef('pylon', 1).reach, COVER_COLORS.select]);
  // arm a power-drawing building: the grid's reach map, no ghost ring (it has no reach of its own)
  const rig = planCoverage(state, { buildSelection: 'OUT-rig', hoverCell: { x: 2, y: 3 }, hoverValid: true }, getStructureDef);
  assert.deepEqual(rig.map((p) => p.color), [COVER_COLORS.power, COVER_COLORS.power]);
  assert.ok(rig.every((p) => !p.primary));
  // selecting a gun still shows gun coverage only
  assert.ok(planCoverage(state, { selectedStructureId: 5 }, getStructureDef).every((p) => p.color !== COVER_COLORS.power));
});
