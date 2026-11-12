// Owner 2026-11-11: "towers should not take damage during construction, since they don't become targets until completion".
// One sim: battles and the outpost alike.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../data/factions.js';
import { applyDamage, acquireTarget, UNDER_CONSTRUCTION } from './combat.js';

const S = (o) => ({ id: 11, structId: 'STR-Cannon', tier: 1, kind: 'antiGround', armorClass: 'Structure', pos: { x: 5, y: 5 }, hp: 400, maxHp: 400, ...o });
const hit = (s) => { const before = s.hp; applyDamage({ tick: 0, events: [] }, 1, s, 100, 'Kinetic', 1); return before - s.hp; };

test('a structure being placed or built takes no damage; a standing one (incl. upgrading) does', () => {
  assert.deepEqual([...UNDER_CONSTRUCTION].sort(), ['Building', 'Placing']);
  assert.equal(hit(S({ lifecycle: 'Building' })), 0);
  assert.equal(hit(S({ lifecycle: 'Placing' })), 0);
  assert.ok(hit(S({ lifecycle: 'Complete' })) > 0);
  assert.ok(hit(S({ lifecycle: 'Upgrading' })) > 0, 'an upgrade in progress is a standing structure');
});

test('a fire-on-the-move attacker never targets a structure under construction, and does once it completes', () => {
  const s = S({ lifecycle: 'Building' });
  const state = { tick: 0, events: [], units: new Map(), structures: new Map([[s.id, s]]), base: null, map: null };
  const raider = { id: 99, side: 'attacker', pos: { x: 6, y: 5 }, range: 4, hp: 100, targetsBase: true, engagesStructuresWhileAdvancing: true };
  assert.notEqual(acquireTarget(state, raider), s.id);
  s.lifecycle = 'Complete';
  assert.equal(acquireTarget(state, raider), s.id);
});
