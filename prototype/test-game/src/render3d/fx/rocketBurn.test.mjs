// [MM-story_mvehp5rq_k] rocket tower: 4× slower salvos (dps unchanged), double range, and a unit a salvo hits burns
// until the next salvo so the continuous damage reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES } from '../../data/tables.js';
import { createCombatFx } from './combatFxModel.js';
import { createImpacts, K } from './impacts.js';

test('data: cadence 12 s, range 10, dps unchanged', () => {
  const R = STRUCTURES['STR-Rockets'];
  assert.equal(R.cadence, 12);
  assert.equal(R.range, 10);
  assert.deepEqual(R.dps, [30, 46.5, 69]);
});

test('a landed salvo ignites its target for about one salvo interval', () => {
  const fx = createCombatFx();
  const st = {
    time: 0,
    units: new Map([[1, { id: 1, unitId: 'tank', hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', pos: { x: 10, y: 4 }, targetId: null }]]),
    structures: new Map([[100, { id: 100, structId: 'STR-Rockets', kind: 'antiGround', lifecycle: 'Complete', footprint: { w: 1, h: 1 }, pos: { x: 4, y: 4 }, targetId: 1 }]]),
    base: { pos: { x: 16, y: 16 } },
  };
  const lit = [];
  const opts = { getDef: () => null, ignite: (id, secs) => lit.push([id, secs]) };
  for (let i = 0; i < 240; i++) { st.time += 1 / 60; fx.update(st, {}, [], 1 / 60, opts); }
  assert.ok(lit.length >= 1, 'ignited');
  assert.ok(lit.every(([id, s]) => id === 1 && s >= 12), JSON.stringify(lit[0]));
});

test('impacts: a burning unit trails fire at its drawn position, and stops when it dies', () => {
  const imp = createImpacts({ seed: 2 });
  const state = { time: 0, tick: 0, units: new Map([[7, { id: 7, hp: 5, pos: { x: 3, y: 3 } }]]) };
  const views = [{ id: 7, model: 'tank', x: 3.5, y: 0, z: 3.5, heading: 0 }];
  imp.ignite(7, 12);
  for (let i = 0; i < 30; i++) { state.time += 1 / 30; imp.update(state, {}, [], 1 / 30, views); }
  const fire = imp.particles.filter((p) => p.kind === K.FIRE);
  assert.ok(fire.length > 3 && fire.every((p) => Math.abs(p.x - 3.5) < 0.6 && Math.abs(p.z - 3.5) < 0.6), `flames on the unit (${fire.length})`);
  state.units.get(7).hp = 0;
  imp.update(state, {}, [], 1 / 30, views);
  assert.deepEqual(imp.burningUnits, [], 'dead: no longer burning');
});
