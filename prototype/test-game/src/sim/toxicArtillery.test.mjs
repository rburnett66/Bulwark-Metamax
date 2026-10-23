// src/sim/toxicArtillery.test.mjs — owner 2026-10-22 balance calls: "turn poison damage into toxic damage and have it
// corrode humans, harvesters and repair drones" [MM-task_mvjxae69_g]; "trim artillery to 9.5" [MM-task_mvjxahqe_i].
import test from 'node:test';
import assert from 'node:assert/strict';
import '../data/factions.js';
import { UNITS, STRUCTURES, EFFECTIVENESS, ROLE_EFFECTIVENESS, DAMAGE_TYPES } from '../data/tables.js';
import { applyDamage } from './combat.js';

const state = () => ({ tick: 0, events: [] });
const T = (o) => ({ id: 7, pos: { x: 0, y: 0 }, ...o });
const hit = (o) => { const target = T(o); const before = target.hp; applyDamage(state(), 1, target, 100, 'Toxic', 1); return before - target.hp; };

test('Poison is gone; Toxic replaces it everywhere, with the Corrode status', () => {
  assert.equal(EFFECTIVENESS.Poison, undefined);
  assert.equal(DAMAGE_TYPES.Poison, undefined);
  assert.equal(DAMAGE_TYPES.Toxic.status, 'Corrode');
  const types = Object.values(UNITS).map((u) => u.damageType);
  assert.ok(!types.includes('Poison'));
  assert.equal(types.filter((t) => t === 'Toxic').length, 14, 'the 14 Dark Energy + Greenies units');
});

test('Toxic corrodes humans, harvesters and repair drones; machines barely; structures not at all', () => {
  assert.equal(hit({ hp: 1000, armorClass: 'Organic' }), 180, 'humans (Organic)');
  assert.equal(hit({ hp: 1000, armorClass: 'Machinery', isHarvester: true }), 100 * ROLE_EFFECTIVENESS.Toxic.harvester, 'harvester truck (Machinery) corrodes');
  assert.equal(hit({ hp: 1000, armorClass: 'Organic', isRepairTroop: true }), 100 * ROLE_EFFECTIVENESS.Toxic.repairDrone, 'repair drone');
  assert.ok(ROLE_EFFECTIVENESS.Toxic.harvester > 1 && ROLE_EFFECTIVENESS.Toxic.repairDrone > 1);
  assert.ok(Math.abs(hit({ hp: 1000, armorClass: 'Machinery' }) - 10) < 1e-9, 'an ordinary machine: 0.1');
  assert.equal(hit({ hp: 1000, armorClass: 'Structure' }), 0, 'structures stay immune');
  // the role override is Toxic-only: Kinetic still uses the armor class
  const t = T({ hp: 1000, armorClass: 'Machinery', isHarvester: true });
  applyDamage(state(), 1, t, 100, 'Kinetic', 1);
  assert.equal(t.hp, 900);
});

test('every Artillery range is at most 9.5 — inside the Rocket tower (10)', () => {
  const arts = Object.entries(UNITS).filter(([id]) => /-Artillery$/.test(id));
  assert.equal(arts.length, 9);
  for (const [id, u] of arts) assert.ok(u.range <= 9.5, `${id} ${u.range}`);
  assert.ok(STRUCTURES['STR-Rockets'].range > 9.5);
});
