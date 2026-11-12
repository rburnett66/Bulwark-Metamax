// The outpost save ↔ a live battle SimState [MM-task_mwcdvk4o_2s] (TECH_PLAN::One-Battle-UX.md S2.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0, freeSpot } from './view/fixtures.mjs';
import { reservedRects } from './outpostMap.js';
import { referenceOutpost, defaultPads, buildingRect, advance, powerGrids } from './model.js';
import { raidSimMap } from './raid.js';
import { structureDef } from '../data/outpost.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { applyCommand, stepSim, FIXED_DT } from '../sim/core.js';

const run = (s, sec) => { for (let i = 0; i < Math.ceil(sec / FIXED_DT); i++) stepSim(s, FIXED_DT); };
const strip = (o) => JSON.parse(JSON.stringify(o));

/** A busy outpost: the reference set, a worn gun, a building under construction, a gun upgrading, a gun selling. */
function busyOutpost() {
  const o = referenceOutpost('ground', { seed: 1234, map, now: T0 });
  const pads = defaultPads(map);
  const spare = freeSpot(o, 'storage');
  o.building.push({ pad: 'f1', kind: 'storage', tier: 1, done: T0 + 600, at: spare });               // 0.6 s left
  o.pads[pads.power].tier = 1;
  o.building.push({ pad: pads.power, kind: 'power', tier: 2, done: T0 + 400 });                     // upgrade under way
  const guns = o.defenses.filter((d) => d.kind === 'mg' || d.kind === 'cannon');
  guns[0].hp = Math.floor(guns[0].hp / 2);
  // timed jobs as the outpost writes them: each runs its real Build_Sec / sellTime, ending just after T0
  if (guns[1]) {
    const ms = structureDef(guns[1].kind, 2).buildSec * 1000;
    o.upgrading = { id: guns[1].id, kind: guns[1].kind, tier: 2, done: T0 + 500, since: T0 + 500 - ms };
  }
  const wall = o.defenses.find((d) => d.kind === 'wall');
  if (wall) wall.selling = { since: T0 - 200, done: T0 + 800 };                                         // STR-Wall sellTime 1 s
  o.defenses.push({ id: 'd99', kind: 'mg', tier: 1, cell: [...guns[0].cell], hp: 0 });                  // a wreck
  return o;
}

test('a visit with no actions saves back exactly what was loaded', () => {
  for (const o of [referenceOutpost('ground', { seed: 7, map, now: T0 }), busyOutpost()]) {
    const { state, link } = toLiveSim(o, { map, now: T0, gold: 5000 });
    const back = fromLiveSim(state, link, T0);
    assert.deepEqual(strip(back.outpost), strip(o));
    assert.equal(back.gold, 5000);
  }
});

test('the live state is the battle sim: buildings and defenses are OUT- structures, the hub is the base', () => {
  const o = busyOutpost();
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const ids = [...state.structures.values()].map((s) => s.structId);
  assert.ok(ids.every((id) => id.startsWith('OUT-')), ids.join(','));
  assert.ok(!ids.includes('OUT-hub'), 'the hub is state.base, not a structure');
  const hub = map.hub;
  assert.equal(state.base.pos.x, Math.floor(hub.x + hub.w / 2));
  const lifecycles = new Set([...state.structures.values()].map((s) => s.lifecycle));
  for (const l of ['Complete', 'Damaged', 'Building', 'Upgrading']) assert.ok(lifecycles.has(l), `has a ${l} structure`);
  // a wreck is in the live state as an inert 'Wrecked' hulk (no longer left out) [MM-story_mwcrfnyf_3c]
  const wrecked = [...state.structures.values()].filter((s) => s.hp <= 0);
  assert.ok(wrecked.length >= 1 && wrecked.every((s) => s.lifecycle === 'Wrecked'), 'wrecks are inert Wrecked structures');
  assert.ok(state.placementRules && state.placementRules.length >= 2, 'the outpost rules are on the shared placement');
});

test('jobs finish on the sim clock and the save sees them finished', () => {
  const o = busyOutpost();
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, 2);
  const { outpost: back } = fromLiveSim(state, link, T0 + 2000);
  assert.equal(back.building.length, 0, 'the construction and the pad upgrade are done');
  const job = o.building.find((j) => j.kind === 'storage');
  assert.deepEqual(back.pads[job.pad], { kind: 'storage', tier: 1, at: job.at });
  const power = o.building.find((j) => j.kind === 'power');
  assert.equal(back.pads[power.pad].tier, 2, 'Power Station II');
  assert.equal(back.upgrading, null, 'the gun upgrade landed');
});

test('a building placed during the visit is saved at its spot under a new id; gold moves through the battle economy', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const free = freeSpot(o, 'storage');
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 10000 });
  const res = applyCommand(state, { type: 'place', structId: 'OUT-storage', cell: { x: free.x, y: free.y } });
  assert.equal(res.ok, true, res.reason);
  const { outpost: back, gold } = fromLiveSim(state, link, T0);
  assert.equal(gold, 10000 - structureDef('storage', 1).cost, 'paid the outpost price');
  assert.equal(back.building.length, 1);
  assert.equal(back.building[0].pad, 'f1');
  assert.deepEqual(back.building[0].at, free);
  assert.equal(back.building[0].kind, 'storage');
});

/** Place a building away from the landing pad and the deposits (an open spot). → its cell, or null. */
function placeOffPads(state, structId) {
  const near = new Set(reservedRects(map).flatMap((p) => { const c = []; for (let y = p.y - 2; y <= p.y + p.h + 1; y++) for (let x = p.x - 2; x <= p.x + p.w + 1; x++) c.push(`${x},${y}`); return c; }));
  for (let y = 2; y < state.map.rows - 3; y++) for (let x = 2; x < state.map.cols - 3; x++) {
    if (near.has(`${x},${y}`) || near.has(`${x + 1},${y + 1}`)) continue;
    if (applyCommand(state, { type: 'place', structId, cell: { x, y } }).ok) return { x, y };
  }
  return null;
}

test('a building placed off the pads is saved at its own spot (S2c) and keeps it when it finishes', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const at = placeOffPads(state, 'OUT-storage');
  assert.ok(at, 'found an open spot off the pads');
  const { outpost: back } = fromLiveSim(state, link, T0);
  const job = back.building.find((j) => j.kind === 'storage');
  assert.equal(job.pad, 'f1', 'a new free id');
  assert.deepEqual(job.at, { x: at.x, y: at.y, w: 2, h: 2 }, 'its own rectangle');
  assert.deepEqual(buildingRect(back, map, 'f1'), { id: 'f1', ...job.at }, 'model.buildingRect answers for it');
  // the away catch-up finishes it: it stands where it was placed
  const done = advance(back, job.done + 1, { map, raid: () => ({ result: 'held', defenses: [] }) }).outpost;
  assert.deepEqual(done.pads.f1, { kind: 'storage', tier: 1, at: job.at });
  // and a second visit loads it at its spot and saves it back unchanged
  const again = toLiveSim(done, { map, now: job.done + 1, gold: 0 });
  const s = [...again.state.structures.values()].find((x) => x.structId === 'OUT-storage' && x.pos.x === at.x);
  assert.ok(s && s.pos.y === at.y, 'the live sim puts it where it was saved');
  assert.deepEqual(strip(fromLiveSim(again.state, again.link, job.done + 1).outpost), strip(done));
});

test('a Pylon placed on the live sim is saved as a 1×1 free building and is a grid node, never a consumer (S2b)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const at = placeOffPads(state, 'OUT-pylon');
  assert.ok(at, 'found an open spot');
  run(state, structureDef('pylon', 1).buildSec + 1);
  const { outpost: back } = fromLiveSim(state, link, T0 + (structureDef('pylon', 1).buildSec + 1) * 1000);
  assert.deepEqual(back.pads.f1, { kind: 'pylon', tier: 1, at: { x: at.x, y: at.y, w: 1, h: 1 } });
  const g = powerGrids(back, map);
  assert.equal(g.off.f1, undefined, 'a pylon draws nothing');
  assert.ok(g.grids.every((x) => !x.stations.includes('f1')), 'and is no station');
  const again = toLiveSim(back, { map, now: T0 + 60_000, gold: 0 });
  assert.deepEqual(strip(fromLiveSim(again.state, again.link, T0 + 60_000).outpost), strip(back), 'a second visit loads it back unchanged');
});

test('the outpost rules read a free building where it stands: power reach, raid blocking and breach', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const at = placeOffPads(state, 'OUT-storage');
  const job = fromLiveSim(state, link, T0).outpost;
  const built = advance(job, T0 + 3_600_000, { map, raid: () => ({ result: 'held', defenses: [] }) }).outpost;
  assert.ok(built.pads.f1, 'built');
  const grids = powerGrids(built, map);
  assert.ok(grids.powered.has('f1') || grids.off.f1 === 'reach' || grids.off.f1 === 'supply', 'the grid judges it at its own spot');
  const simMap = raidSimMap(built, map);
  const blocked = new Set(simMap.blockedCells.map((c) => `${c.x},${c.y}`));
  assert.ok(blocked.has(`${at.x},${at.y}`) && blocked.has(`${at.x + 1},${at.y + 1}`), 'a raid treats its cells as solid');
});

test('a defense a raid destroys is saved as a wreck at 0 HP (repairable), a sold one is gone', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const guns = [...state.structures.values()].filter((s) => s.structId === 'OUT-mg' || s.structId === 'OUT-cannon');
  const [dead, sold] = guns;
  dead.hp = 0; dead.lifecycle = 'Destroyed';                 // as combat.js leaves a structure it destroyed
  if (sold) state.structures.delete(sold.id);                 // as structures.js removes a sold one
  const back = fromLiveSim(state, link, T0).outpost;
  const deadId = link.ids.get(dead.id).defense;
  assert.equal(back.defenses.find((d) => d.id === deadId).hp, 0, 'the wreck stays, at 0 HP');
  if (sold) assert.equal(back.defenses.find((d) => d.id === link.ids.get(sold.id).defense), undefined, 'the sold one is gone');
});
