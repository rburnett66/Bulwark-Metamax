// The outpost save ↔ a live battle SimState [MM-task_mwcdvk4o_2s] (TECH_PLAN::One-Battle-UX.md S2.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost, defaultPads } from './model.js';
import { structureDef } from '../data/outpost.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { applyCommand, stepSim, FIXED_DT } from '../sim/core.js';

const run = (s, sec) => { for (let i = 0; i < Math.ceil(sec / FIXED_DT); i++) stepSim(s, FIXED_DT); };
const strip = (o) => JSON.parse(JSON.stringify(o));

/** A busy outpost: the reference set, a worn gun, a building under construction, a gun upgrading, a gun selling. */
function busyOutpost() {
  const o = referenceOutpost('ground', { seed: 1234, map, now: T0 });
  const pads = defaultPads(map);
  const spare = map.pads.find((p) => p.role !== 'hub' && !Object.values(pads).includes(p.id) && !o.pads[p.id]);
  o.building.push({ pad: spare.id, kind: 'storage', tier: 1, done: T0 + 600 });                    // 0.6 s left
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
  const hub = map.pads.find((p) => p.role === 'hub');
  assert.equal(state.base.pos.x, Math.floor(hub.x + hub.w / 2));
  const lifecycles = new Set([...state.structures.values()].map((s) => s.lifecycle));
  for (const l of ['Complete', 'Damaged', 'Building', 'Upgrading']) assert.ok(lifecycles.has(l), `has a ${l} structure`);
  assert.equal([...state.structures.values()].filter((s) => s.structId === 'OUT-mg' && s.hp <= 0).length, 0, 'wrecks stay out');
  assert.ok(state.placementRules && state.placementRules.length >= 2, 'the outpost rules are on the shared placement');
});

test('jobs finish on the sim clock and the save sees them finished', () => {
  const o = busyOutpost();
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, 2);
  const { outpost: back } = fromLiveSim(state, link, T0 + 2000);
  assert.equal(back.building.length, 0, 'the construction and the pad upgrade are done');
  const job = o.building.find((j) => j.kind === 'storage');
  assert.deepEqual(back.pads[job.pad], { kind: 'storage', tier: 1 });
  const power = o.building.find((j) => j.kind === 'power');
  assert.equal(back.pads[power.pad].tier, 2, 'Power Station II');
  assert.equal(back.upgrading, null, 'the gun upgrade landed');
});

test('a building placed during the visit is saved on its pad; gold moves through the battle economy', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const pads = defaultPads(map);
  const free = map.pads.find((p) => p.role !== 'hub' && !Object.values(pads).includes(p.id) && !o.pads[p.id]);
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 10000 });
  const res = applyCommand(state, { type: 'place', structId: 'OUT-storage', cell: { x: free.x, y: free.y } });
  assert.equal(res.ok, true, res.reason);
  const { outpost: back, gold } = fromLiveSim(state, link, T0);
  assert.equal(gold, 10000 - structureDef('storage', 1).cost, 'paid the outpost price');
  assert.equal(back.building.length, 1);
  assert.equal(back.building[0].pad, free.id);
  assert.equal(back.building[0].kind, 'storage');
});

test('a building on no pad is refused loudly by the pad-based save (until S2c)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1e6 });
  const onPad = new Set(map.pads.flatMap((p) => { const c = []; for (let y = p.y - 1; y <= p.y + p.h; y++) for (let x = p.x - 1; x <= p.x + p.w; x++) c.push(`${x},${y}`); return c; }));
  let placed = false;
  for (let y = 2; y < state.map.rows - 3 && !placed; y++) {
    for (let x = 2; x < state.map.cols - 3 && !placed; x++) {
      if (onPad.has(`${x},${y}`) || onPad.has(`${x + 1},${y + 1}`)) continue;
      placed = applyCommand(state, { type: 'place', structId: 'OUT-storage', cell: { x, y } }).ok;
    }
  }
  assert.ok(placed, 'found an open spot off the pads');
  assert.throws(() => fromLiveSim(state, link, T0), /stands on no pad/);
});
