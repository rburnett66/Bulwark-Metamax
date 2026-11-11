// [MM-story_mwabh0cd_i] The surface avatar's tap queue and the farmhand rules (story A8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQueue, queueStep, queueView, queueIdle, WORK_SEC } from './avatarQueue.js';
import { farmhandCount, farmhandStops, farmhandLeg, homePoint, standPoint, walkPath, walkerBlocked, MAX_RIGS, AVATAR_CELLS } from './avatar.js';
import { rng } from '../../ship-interior/crew.js';
import { buildNavGrid } from '../../sim/pathfinding.js';
import { defaultSave } from '../../save/save.js';
import { referenceOutpost, confirmOnline } from '../../outpost/model.js';
import { outpostMapFromForge } from '../../outpost/outpostMap.js';
import { outpostBattleMap } from '../../outpost/view/outpostBoard.js';
import { acceptFarmContract } from '../contract.js';
import { cellRule, packPlots } from '../cells.js';
import { placePlot } from '../model.js';

/** Drive a queue the way avatar.js does, with a fake walk: every walk arrives (or has no path) at once. */
function driver({ noPath = () => false } = {}) {
  let q = createQueue();
  const landed = [], log = [];
  const run = (ev) => {
    const r = queueStep(q, ev);
    q = r.q;
    for (const e of r.effects) {
      log.push(e.type);
      if (e.type === 'land') landed.push(e.job.key);
      if (e.type === 'walk') run(noPath(e.job) ? { type: 'noPath' } : { type: 'arrived' });
    }
  };
  return { run, landed, log, get q() { return q; }, tick(sec, step = 0.1) { for (let t = 0; t < sec; t += step) run({ type: 'tick', dt: step }); } };
}

test('a tap walks, works for WORK_SEC, then lands once', () => {
  const d = driver();
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p1' } });
  assert.deepEqual(d.log, ['walk', 'work']);
  assert.deepEqual(d.landed, [], 'nothing lands before the work is done');
  d.tick(WORK_SEC * 0.5);
  assert.deepEqual(d.landed, []);
  d.tick(WORK_SEC);
  assert.deepEqual(d.landed, ['harvest:p1']);
  d.tick(5);
  assert.deepEqual(d.landed, ['harvest:p1'], 'lands exactly once');
  assert.ok(queueIdle(d.q));
  assert.equal(d.log.at(-1), 'home', 'the avatar walks home when the queue empties');
});

test('taps queue in order, each lands once; a repeated tap is not queued twice', () => {
  let q = createQueue();
  const effects = [];
  for (const p of ['p1', 'p2', 'p3', 'p2']) { const r = queueStep(q, { type: 'enqueue', action: { type: 'harvest', plot: p } }); q = r.q; effects.push(...r.effects); }
  assert.deepEqual(effects.map((e) => e.type), ['walk', 'dup']);
  assert.deepEqual(queueView(q).map((j) => [j.key, j.phase]), [['harvest:p1', 'walk'], ['harvest:p2', 'queued'], ['harvest:p3', 'queued']]);
  const d = driver();
  for (const p of ['p1', 'p2', 'p3']) d.run({ type: 'enqueue', action: { type: 'harvest', plot: p } });
  d.run({ type: 'enqueue', action: { type: 'prep', plot: 'p1' } });   // another action on the same plot is its own job
  d.tick(WORK_SEC * 6);
  assert.deepEqual(d.landed, ['harvest:p1', 'harvest:p2', 'harvest:p3', 'prep:p1']);
  assert.equal(d.q.landed, 4);
});

test('no path: the action lands at once rather than being lost', () => {
  const d = driver({ noPath: (job) => job.plot === 'p2' });
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p2' } });
  assert.deepEqual(d.landed, ['harvest:p2']);
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p1' } });
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p2' } });   // queued behind p1: lands when its turn comes
  d.tick(WORK_SEC + 0.2);
  assert.deepEqual(d.landed, ['harvest:p2', 'harvest:p1', 'harvest:p2']);
});

test('a raid: the job in hand goes back to the head, nothing lands while sheltering, the queue resumes after', () => {
  const d = driver();
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p1' } });
  d.run({ type: 'enqueue', action: { type: 'harvest', plot: 'p2' } });
  d.tick(WORK_SEC * 0.5);   // p1 half worked
  d.run({ type: 'shelter', on: true });
  assert.equal(d.log.at(-1), 'shelter');
  assert.deepEqual(queueView(d.q).map((j) => j.key), ['harvest:p1', 'harvest:p2']);
  d.run({ type: 'enqueue', action: { type: 'prep', plot: 'p3' } });   // a tap during the raid waits too
  d.tick(30);
  assert.deepEqual(d.landed, [], 'nothing lands during the raid');
  d.run({ type: 'shelter', on: true });   // repeated: no change
  d.run({ type: 'shelter', on: false });
  d.tick(WORK_SEC * 4);
  assert.deepEqual(d.landed, ['harvest:p1', 'harvest:p2', 'prep:p3'], 'each lands once, in order, after the raid');
  assert.ok(queueIdle(d.q));
});

test('arrived / noPath / tick out of turn change nothing', () => {
  let q = createQueue();
  for (const ev of [{ type: 'arrived' }, { type: 'noPath' }, { type: 'tick', dt: 5 }, { type: 'shelter', on: false }]) {
    const r = queueStep(q, ev);
    assert.deepEqual(r.effects, []);
    q = r.q;
  }
  assert.ok(queueIdle(q));
});

// ── farmhands and the figures on the real Verdance map ───────────────────────────────────────────────────────────
const map = outpostMapFromForge(JSON.parse(readFileSync(new URL('../../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');
const T0 = Date.UTC(2026, 10, 10, 10);
function farmOutpost(plots = 3) {
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  let o = referenceOutpost('ground', { seed: 5, map, now: T0 });
  for (const b of Object.values(o.pads)) if (b.kind === 'rig' || b.kind === 'power') b.tier = 2;   // a Rig II draws 8: it needs Power Station II [MM-story_mwcp7u7b_3a]
  o = confirmOnline(o, map, T0).outpost;
  s.outposts = { ground: o }; s.outpostContracts = { ground: { step: 3, state: 'complete', since: T0 } };
  acceptFarmContract(s, 'ground', { map, now: T0, cellOk: cellRule(map, o) });
  o = s.outposts.ground;
  for (const r of packPlots(map, o).slice(0, plots)) { const res = placePlot(o, { x: r.x, y: r.y, method: 'traditional' }, { map, now: T0, gold: Infinity, cellOk: cellRule(map, o) }); if (!res.error) o = res.outpost; }
  return o;
}

test('farmhands: none in safe mode or without a farm, and never more than MAX_RIGS figures with the avatar', () => {
  const o = farmOutpost();
  assert.equal(MAX_RIGS, 3);
  assert.equal(farmhandCount({ safe: true, farm: o.farm }), 0, 'safe mode covers the farm: no farmhands');
  assert.equal(farmhandCount({ safe: false, farm: null }), 0);
  assert.equal(farmhandCount({ safe: false, farm: { plots: {}, buildings: {} } }), 0);
  const n = farmhandCount({ safe: false, farm: o.farm });
  assert.ok(n >= 2 && 1 + n <= MAX_RIGS, `${n} farmhands`);
  assert.ok(1 + farmhandCount({ farm: o.farm, max: 2 }) <= 2);
});

test('the avatar is 0.45 of a cell; it waits at the Farmhouse door; plots are worked from their front edge', () => {
  assert.equal(AVATAR_CELLS, 0.45);
  const o = farmOutpost(), fh = Object.values(o.farm.buildings).find((b) => b.kind === 'farmhouse');
  const h = homePoint(o, map);
  assert.ok(h.z > fh.y + fh.h && h.z < fh.y + fh.h + 1 && h.x > fh.x && h.x < fh.x + fh.w, 'at the door');
  const p = Object.values(o.farm.plots)[0], s = standPoint(p, map, 0);
  assert.ok(s.z > p.y + p.h && s.z < p.y + p.h + 0.5 && Math.abs(s.x - (p.x + p.w / 2)) < 0.3);
});

test('walks follow the outpost nav grid from the Farmhouse to every plot; farmhand rounds are seeded and never touch a plot', () => {
  const o = farmOutpost();
  const nav = buildNavGrid(outpostBattleMap(map), [], walkerBlocked(o, map));
  const h = homePoint(o, map);
  for (const p of Object.values(o.farm.plots)) {
    const s = standPoint(p, map, 1), path = walkPath(nav, h, s);
    assert.ok(path && path.length, `a path to ${p.id}`);
    assert.deepEqual(path.at(-1), { x: s.x, z: s.z });
  }
  const stops = farmhandStops(o, map);
  assert.ok(stops.length >= Object.keys(o.farm.plots).length);
  const legs = (seed) => { const d = rng(seed); let last = -1; return Array.from({ length: 8 }, () => { const l = farmhandLeg(d, stops, last); last = l.idx; return [l.idx, l.pose, +l.hold.toFixed(4)]; }); };
  assert.deepEqual(legs(41), legs(41), 'the same seed walks the same rounds');
  assert.notDeepEqual(legs(41), legs(42));
  // a farmhand's leg is a place and a pose: nothing in it can act on a plot (life, not labour: D45)
  const l = farmhandLeg(rng(3), stops);
  assert.deepEqual(Object.keys(l).sort(), ['hold', 'idx', 'pose', 'stop']);
});
