// Conduits DERIVED from the energy grid (One Battle UX S2b [MM-story_mwc9plas_2h], plan §5.2): each grid's minimum
// spanning tree over its nodes plus one branch to each building, on FREE positions — never the map's authored pad graph.
// And the ghost's power answer (amber ghost + dashed preview conduit), from powerGrids on a hypothetical placement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planConduits, gridTree, joinNode, ghostPower, GHOST_ID } from './conduits.js';
import { structureDef, POWER_PRIORITY, powerPriority } from '../../data/outpost.js';
import { powerGrids } from '../model.js';
import { powerWarning } from '../placementRules.js';

const free = { pads: [], deposits: [], conduits: [['s', 'r']] };   // an authored link that must be IGNORED
const at = (kind, x, y, w = 2, h = 2, tier = 1) => ({ kind, tier, at: { x, y, w, h } });
const P1 = structureDef('power', 1), PY = structureDef('pylon', 1), RIG = structureDef('rig', 1);

test('the grid tree: a minimum spanning tree from the station, deterministic, outward', () => {
  const n = (id, x, y) => ({ id, at: [x, y] });
  const nodes = [n('s', 0, 0), n('b', 10, 0), n('a', 5, 0), n('c', 5, 4)];
  const tree = gridTree(nodes, 's').map(([p, c]) => p.id + '>' + c.id);
  assert.deepEqual(tree, ['s>a', 'a>c', 'a>b'], 'Prim from the station: nearest first, ties on ids');
  assert.deepEqual(gridTree([...nodes].reverse(), 's').map(([p, c]) => p.id + '>' + c.id), tree, 'input order does not matter');
  assert.deepEqual(gridTree([n('s', 0, 0)], 's'), [], 'a lone station has no links');
});

test('join rule: the nearest node whose reach covers the point', () => {
  const nodes = [{ id: 'far', at: [0, 0], reach: 20 }, { id: 'near', at: [8, 0], reach: 3 }];
  assert.equal(joinNode(nodes, [10, 0]).id, 'near');
  assert.equal(joinNode(nodes, [12, 0]).id, 'far', 'the nearer one does not reach');
  assert.equal(joinNode(nodes, [40, 0]), null);
});

test('conduits: MST over stations + pylons, one branch per building, free positions, map links ignored', () => {
  const o = { t: 0, online: true, defenses: [], building: [], pads: {
    s: at('power', 0, 0), y1: at('pylon', P1.reach, 0, 1, 1), y2: at('pylon', P1.reach + PY.reach, 0, 1, 1),
    r: at('rig', P1.reach + PY.reach * 2 - 1, 0), st: at('storage', 0, 4), lone: at('rig', 200, 200) } };
  const plan = planConduits(o, free);
  const links = plan.filter((c) => c.kind === 'link').map((c) => c.from + '>' + c.to);
  assert.deepEqual(links, ['s>y1', 'y1>y2'], 'the grid tree runs out from the station');
  const branches = Object.fromEntries(plan.filter((c) => c.kind === 'branch').map((c) => [c.to, c.from]));
  assert.deepEqual(branches, { r: 'y2', st: 's' }, 'each building hangs off the node it joins; one out of reach gets none');
  assert.ok(plan.every((c) => c.powered), 'online and powered: all lit');
  assert.ok(plan.every((c) => c.points.length >= 2 && c.length > 0));
  assert.deepEqual(planConduits(structuredClone(o), free), plan, 'deterministic');
  // offline: the same plan, dark
  assert.ok(planConduits({ ...o, online: false }, free).every((c) => !c.powered));
});

test('conduits: a building under construction gets a dark branch; a short grid leaves the cut consumer dark', () => {
  const n = Math.floor(P1.supply / RIG.draw) + 1;
  const pads = { s: at('power', 0, 0) };
  for (let i = 0; i < n; i++) pads['r' + i] = at('rig', 3 * i, 3);
  const o = { t: 0, online: true, defenses: [], pads, building: [{ pad: 'job', kind: 'storage', tier: 1, at: { x: 0, y: -3, w: 2, h: 2 }, done: 1e12 }] };
  const plan = planConduits(o, free);
  const g = powerGrids(o, free);
  const job = plan.find((c) => c.to === 'job');
  assert.ok(job && !job.powered, 'the build site is wired, dark until built');
  for (const c of plan.filter((x) => x.kind === 'branch' && x.to !== 'job')) assert.equal(c.powered, g.powered.has(c.to), c.to);
  assert.ok(plan.some((c) => c.kind === 'branch' && !c.powered && c.to !== 'job'), 'the cut rig is dark');
});

test('the ghost: powered, no power in reach, or grid short — from powerGrids on the hypothetical placement', () => {
  const o = { t: 0, online: true, defenses: [], building: [], pads: { s: at('power', 0, 0), y: at('pylon', 6, 0, 1, 1) } };
  const ok = ghostPower(o, free, 'rig', { x: 8, y: 0, w: 2, h: 2 });
  assert.equal(ok.reason, null);
  assert.equal(ok.node, 'y', 'the dashed preview runs to the pylon it would join');
  assert.ok(ok.route.points.length >= 2);
  const out = ghostPower(o, free, 'rig', { x: 100, y: 100, w: 2, h: 2 });
  assert.deepEqual([out.reason, out.node, out.route], ['reach', null, null]);
  assert.equal(ghostPower(o, free, 'pylon', { x: 3, y: 3, w: 1, h: 1 }), null, 'a node draws nothing: no warning');
  assert.equal(ghostPower(o, free, 'wall', { x: 3, y: 3, w: 1, h: 1 }), null, 'a wall draws nothing');
  // short: fill the station up, then one more rig
  const pads = { s: at('power', 0, 0) };
  for (let i = 0; i < Math.floor(P1.supply / RIG.draw); i++) pads['r' + i] = at('rig', 3 * i, 3);
  const full = { ...o, pads };
  assert.equal(ghostPower(full, free, 'rig', { x: 0, y: -3, w: 2, h: 2 }).reason, 'supply');
  // a defense ghost is a defense consumer (its cell)
  const mg = ghostPower(o, free, 'mg', { x: 100, y: 0, w: 1, h: 1 });
  assert.equal(mg.reason, 'reach');
  assert.ok(!Object.keys(o.pads).includes(GHOST_ID), 'the outpost is never touched');
});

test('the warning rule: a placement mode says "valid but warn" through state.placementWarnings', () => {
  const o = { t: 0, online: true, defenses: [], building: [], pads: { s: at('power', 0, 0) } };
  const getDef = (id) => ({ 'OUT-rig': { outpostKind: 'rig', footprint: { w: 2, h: 2 } }, 'OUT-wall': { outpostKind: 'wall', footprint: { w: 1, h: 1 } } })[id];
  const rule = powerWarning(() => o, free);
  assert.equal(rule(null, getDef('OUT-rig'), { x: 100, y: 100 }, 'OUT-rig'), 'no power in reach');
  assert.equal(rule(null, getDef('OUT-rig'), { x: 2, y: 0 }, 'OUT-rig'), null);
  assert.equal(rule(null, getDef('OUT-wall'), { x: 100, y: 100 }, 'OUT-wall'), null);
  assert.equal(rule(null, { kind: 'cannon' }, { x: 100, y: 100 }, 'STR-Cannon'), null, 'battle structures: no grid, no warning');
});

test('the shared hook: validatePlacement carries a mode warning on an ACCEPTED spot; input + ghost read it', async () => {
  const { createSim, applyCommand } = await import('../../sim/core.js');
  const { validatePlacement } = await import('../../sim/structures.js');
  const { ghostState } = await import('../../render3d/overlays/placement.js');
  const s = createSim(7, {});
  s.economy.money = 1e6;
  const cell = { x: 20, y: 6 };
  const plain = validatePlacement(s, 'OUT-mg', cell);
  assert.deepEqual(plain, { ok: true, reason: '' }, 'no warnings set: exactly as before');
  s.placementWarnings = [() => { throw new Error('broken'); }, (st, def) => (def.outpostKind === 'mg' ? 'no power in reach' : null)];
  assert.deepEqual(validatePlacement(s, 'OUT-mg', cell), { ok: true, reason: '', warn: 'no power in reach' }, 'a broken rule is skipped');
  s.placementRules = [() => 'refused'];
  assert.deepEqual(validatePlacement(s, 'OUT-mg', cell), { ok: false, reason: 'refused' }, 'a refusal wins: no warning on a bad spot');
  s.placementRules = [];
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-mg', cell }).ok, true, 'a warning never refuses');
  assert.equal(ghostState({ hoverValid: false, hoverWarn: 'x' }), 'bad');
  assert.equal(ghostState({ hoverValid: true, hoverWarn: 'no power in reach' }), 'warn');
  assert.equal(ghostState({ hoverValid: true, hoverWarn: null }), 'ok');
});

test('power priority is data (data/outpost.js POWER_PRIORITY): core first, unlisted last', () => {
  assert.ok(powerPriority('hub') < powerPriority('storage') && powerPriority('storage') < powerPriority('rig'));
  assert.equal(powerPriority('somethingNew'), Math.max(...Object.values(POWER_PRIORITY)) + 1);
  assert.ok(Object.isFrozen(POWER_PRIORITY));
});
