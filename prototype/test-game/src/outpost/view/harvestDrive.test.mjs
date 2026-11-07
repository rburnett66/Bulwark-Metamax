// The harvesters on screen (story O10 [MM-story_mw5oem5o_r]): the trip loop the view draws with the battle's miner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeLengths, pointAlong, tripTimes, harvesterPose, harvesterUnits } from './harvestDrive.js';
import { harvestRates } from '../../data/outpost.js';
import { harvestPlan, referenceOutpost } from '../model.js';
import { map, T0 } from './fixtures.mjs';

const route = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];

test('a route\'s length and the point along it', () => {
  assert.deepEqual(routeLengths(route), { lens: [0, 3, 7], total: 7 });
  const { lens } = routeLengths(route);
  assert.deepEqual(pointAlong(route, lens, 1.5), { x: 1.5, y: 0 });
  assert.deepEqual(pointAlong(route, lens, 5), { x: 3, y: 2 });
  assert.deepEqual(pointAlong(route, lens, 99), { x: 3, y: 4 });
});

test('a trip: out at the battle speed, pull the load at the tier\'s rate, back, unload — then again', () => {
  const R = harvestRates(), t = tripTimes(R, 'common', 7);
  assert.equal(t.go, 7 / R.speed);
  assert.equal(t.pull, R.capacity / R.pull.common);
  assert.equal(t.total, 2 * t.go + t.pull + R.unload);
  assert.ok(tripTimes(R, 'uncommon', 7).pull > t.pull, 'premium fields pull slower');
  assert.equal(harvesterPose(route, 0, t).phase, 'go');
  assert.deepEqual([harvesterPose(route, t.go + 1, t).phase, harvesterPose(route, t.go + 1, t).x, harvesterPose(route, t.go + 1, t).y], ['pull', 3, 4]);
  assert.equal(harvesterPose(route, t.go + t.pull + t.back / 2, t).phase, 'back');
  assert.equal(harvesterPose(route, t.total - 0.1, t).phase, 'unload');
  assert.deepEqual(harvesterPose(route, t.total + 0.5, t), harvesterPose(route, 0.5, t), 'it loops');
});

test('the fleet as battle units: the System miner, one per harvester, parked at the bay when it has no power', () => {
  const o = referenceOutpost('ground', { seed: 1, map, now: T0 });
  o.pads.b1 = { kind: 'resourceBay', tier: 1 }; o.harvesters = 2;
  const plan = harvestPlan(o, map), routes = Object.fromEntries(plan.map((h) => [h.i, [{ x: 30, y: 8 }, { x: h.field[0], y: h.field[1] }]]));
  const u = harvesterUnits(plan, routes, harvestRates(), 12);
  assert.deepEqual(u.map((x) => [x.id, x.artKey, x.isHarvester, x.unitId]), [['oh0', 'SYS-Harvester', true, 'GND-Trucks'], ['oh1', 'SYS-Harvester', true, 'GND-Trucks']]);
  assert.notDeepEqual(u[0].pos, u[1].pos, 'staggered');
  const idle = harvesterUnits(plan, routes, harvestRates(), 12, { running: false });
  assert.ok(idle.every((x) => x.pos.x === 30 && x.pos.y === 8 && x.state === 'idle'));
});
