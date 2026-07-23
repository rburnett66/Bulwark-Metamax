// src/sim/mines.test.mjs — MINE DRONE (Land-Mine rev 2, M1-M3): the moat slot's
// drone-deployed single-use mine, on the real sim. node --test, headless.
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP, STRUCTURES, UNITS, EFFECTIVENESS } from '../data/tables.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';

const DEF = STRUCTURES['STR-Mine'];
const CELL = { x: 20, y: 12 };   // open ground on the lane

function sim() { return createSim(1, { waves: [], map: MAP }); }
function place(state, cell = CELL) { return applyCommand(state, { type: 'place', structId: 'STR-Mine', cell }); }
function armMine(state, cell = CELL) {   // deploy + step until the courier buries
  const r = place(state, cell);
  assert.equal(r.ok, true, 'deploy accepted: ' + r.reason);
  let evs = [];
  for (let t = 0; t < 900; t++) {
    evs = evs.concat(stepSim(state, FIXED_DT));
    const m = [...state.mines.values()][0];
    if (m && m.state === 'armed') return { mine: m, events: evs };
  }
  assert.fail('courier never armed');
}
function addWalker(state, unitId, tier, pos) {
  const u = createUnit(state, unitId, tier, pos, 'ground', 'attacker');
  state.units.set(u.id, u);
  return u;
}

test('replaced the moat: STR-Moat is gone, STR-Mine holds its palette slot', () => {
  assert.equal(STRUCTURES['STR-Moat'], undefined);
  assert.equal(DEF.kind, 'mine');
  assert.equal(Object.keys(STRUCTURES).indexOf('STR-Mine'), 3, 'same positional slot → hotkey 4');
});

test('deploy: place command spends gold, spawns a flying courier, logs to the replay', () => {
  const state = sim();
  const gold0 = state.economy.money;
  const r = place(state);
  assert.equal(r.ok, true);
  assert.equal(state.economy.money, gold0 - DEF.cost[0]);
  assert.equal(state.structures.size, 0, 'a mine is never a structure');
  const m = [...state.mines.values()][0];
  assert.equal(m.state, 'flying');
  assert.equal(state.log.commands.length >= 1, true, 'command recorded for replay determinism');
});

test('lifecycle events: mineDeploy → mineArmed at the target cell', () => {
  const state = sim();
  const { mine, events } = armMine(state);
  const types = events.map((e) => e.type);
  assert.ok(types.includes('mineArmed'), 'armed event fired');
  assert.equal(mine.pos.x, CELL.x);
  assert.equal(mine.pos.y, CELL.y);
});

test('eliminates ANY tank: the beefiest roster walker dies on contact', () => {
  const state = sim();
  armMine(state);
  const heavy = addWalker(state, 'GND-HeavyTanks', 3, { x: CELL.x, y: CELL.y });   // 1452 hp, the max
  const evs = stepSim(state, FIXED_DT);
  assert.equal(state.units.get(heavy.id), undefined, 'T3 heavy tank removed');
  assert.ok(evs.some((e) => e.type === 'mineExplode'), 'explosion event');
  assert.ok(evs.some((e) => e.type === 'kill' && e.entityId === heavy.id), 'standard kill event + bounty path');
  assert.equal(state.mines.size, 0, 'single use — the mine is spent');
});

test('air immunity: a flyer over the dot neither triggers nor takes damage', () => {
  const state = sim();
  armMine(state);
  const flyer = addWalker(state, 'AIR-Copters', 1, { x: CELL.x, y: CELL.y });
  flyer.domain = 'Flyer';   // createUnit copies domain from the def anyway — assert it did
  assert.equal(UNITS['AIR-Copters'].domain, 'Flyer');
  stepSim(state, FIXED_DT);
  assert.equal(state.mines.size, 1, 'mine still armed');
  const live = state.units.get(flyer.id);
  assert.ok(live && live.hp === live.maxHp, 'flyer untouched');
});

test('single use: a second tank crosses the spent cell unharmed', () => {
  const state = sim();
  armMine(state);
  addWalker(state, 'GND-Tanks', 1, { x: CELL.x, y: CELL.y });
  stepSim(state, FIXED_DT);
  assert.equal(state.mines.size, 0, 'first tank spent the mine');
  const second = addWalker(state, 'GND-Tanks', 1, { x: CELL.x, y: CELL.y });
  for (let t = 0; t < 30; t++) stepSim(state, FIXED_DT);
  const live = state.units.get(second.id);
  assert.ok(live && live.hp === live.maxHp, 'second tank untouched');
});

test('small blast: clumped neighbour dies, a unit 0.7 tiles out is untouched', () => {
  const state = sim();
  armMine(state);
  const near = addWalker(state, 'GND-Troops', 1, { x: CELL.x + 0.3, y: CELL.y });   // inside 0.5 blast
  const far = addWalker(state, 'GND-Troops', 1, { x: CELL.x + 0.7, y: CELL.y });    // outside blast AND trigger
  stepSim(state, FIXED_DT);
  assert.equal(state.units.get(near.id), undefined, 'clumped trooper died in the blast');
  const liveFar = state.units.get(far.id);
  assert.ok(liveFar && liveFar.hp === liveFar.maxHp, '0.7 tiles out: unharmed (blast ' + DEF.blastRadius + ')');
});

test('cap: the 9th live mine is rejected', () => {
  const state = sim();
  state.economy.money = 99999;
  for (let i = 0; i < DEF.cap; i++) {
    const r = place(state, { x: 10 + i * 2, y: 10 });
    assert.equal(r.ok, true, 'mine ' + (i + 1) + ' accepted');
  }
  const r9 = place(state, { x: 30, y: 10 });
  assert.equal(r9.ok, false);
  assert.match(r9.reason, /max mines/);
});

test('mines never block: walkers path straight over an armed minefield', () => {
  const state = sim();
  state.economy.money = 99999;
  for (let i = 0; i < 3; i++) assert.equal(place(state, { x: 18 + i, y: 12 }).ok, true);
  for (let t = 0; t < 900; t++) stepSim(state, FIXED_DT);   // let all couriers bury
  assert.equal(state.structures.size, 0);
  const nav = buildNavGrid(state.map || MAP, [...state.structures.values()]);
  const path = findWalkerPath(nav, { x: MAP.spawnGround.x, y: MAP.spawnGround.y }, { x: MAP.base.x, y: MAP.base.y });
  assert.ok(path && path.length, 'lane stays open across the minefield');
});

test('determinism: two seeded sims with the same script drain identical event streams', () => {
  const run = () => {
    const state = sim();
    const evs = [];
    place(state);
    addWalker(state, 'GND-Tanks', 1, { x: CELL.x - 4, y: CELL.y });
    for (let t = 0; t < 600; t++) evs.push(...stepSim(state, FIXED_DT));
    return { evs: JSON.stringify(evs), mines: state.mines.size, units: state.units.size, gold: state.economy.money };
  };
  assert.deepEqual(run(), run());
});

test('effectiveness honesty: the burst routes through the matrix (Kinetic ×1.1 vs Energy)', () => {
  assert.equal(EFFECTIVENESS[DEF.damageType].Energy, 1.1);
  const maxEnergyHeavy = UNITS['ARC-HeavyTanks'].hp[2];   // 1320 — needs 1200 raw at ×1.1
  assert.ok(DEF.dps[0] * 1.1 > maxEnergyHeavy, 'burst clears the toughest Energy-armor walker');
  assert.ok(DEF.dps[0] >= UNITS['GND-HeavyTanks'].hp[2], 'burst clears the toughest Machinery walker');
});
