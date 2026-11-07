// The mined ores read from the workbook match the outpost design (§3, §4.2, §4.4, §8.4, §8.5) [MM-story_mw5oe4ap_i].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allOres, oresOf, oreOf, oreById, oreItemId, oreRatePerMin, orePrice, oreValuePerHour, oreWantedBy, ORE_TIERS } from './ores.js';

const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];

test('27 ores: three per planet, common → rare, ids and names unique', () => {
  assert.equal(allOres().length, 27);
  for (const p of PLANETS) assert.deepEqual(oresOf(p).map((o) => o.tier), ORE_TIERS, p);
  assert.equal(new Set(allOres().map((o) => o.id)).size, 27);
  assert.equal(new Set(allOres().map((o) => o.name)).size, 27);
});

test("Verdance's and Florael's ores are the owner's (design §3); lookups by key or by name agree", () => {
  assert.deepEqual(oresOf('ground').map((o) => o.name), ['Iron', 'Aluminum', 'Lithium']);
  assert.deepEqual(oresOf('air').map((o) => o.name), ['Magnesium', 'Boron', 'Cobalt']);
  assert.deepEqual(oresOf('Verdance'), oresOf('ground'));
  assert.equal(oreOf('ground', 'rare').name, 'Lithium');
});

test('each outpost runs three different rigs (design §8.4), and Verdance is auger, laser, brine', () => {
  for (const p of PLANETS) assert.equal(new Set(oresOf(p).map((o) => o.rig)).size, 3, p);
  assert.deepEqual(oresOf('ground').map((o) => o.rig), ['auger', 'laser', 'brine']);
});

test('gold per hour of a Rig I matches design §4.2 (shallow) and §4.4 (deep: 1/4 speed, 5x price)', () => {
  const [iron, alu, li] = oresOf('ground');
  assert.deepEqual([iron, alu, li].map((o) => oreValuePerHour(o)), [720, 1080, 1440]);
  assert.deepEqual([iron, alu, li].map((o) => oreValuePerHour(o, { deep: true })), [900, 1350, 1800]);
  assert.equal(oreRatePerMin(iron, { deep: true }), 0.75);
  assert.equal(orePrice(iron, { deep: true }), 20);
  assert.equal(oreValuePerHour(iron, { rateMult: 2 }), 1440, 'Rig Mk II doubles extraction');
});

test('deep grade is its own item id that resolves to the same ore', () => {
  assert.equal(oreItemId('iron', true), 'iron_deep');
  assert.equal(oreById('iron_deep').name, 'Iron');
  assert.equal(oreById('iron_deep').deep, true);
  assert.equal(oreById('iron').deep, undefined);
  assert.equal(oreById('nope'), null);
});

test('the far buyer (design §8.5): every faction wants one other planet\'s rare ore', () => {
  const wanted = allOres().filter((o) => o.wantedBy);
  assert.equal(wanted.length, 9);
  for (const o of wanted) {
    assert.equal(o.tier, 'rare', o.name);
    assert.notEqual(o.wantedBy, o.planet, o.name);
  }
  assert.equal(new Set(wanted.map((o) => o.wantedBy)).size, 9);
  assert.equal(oreWantedBy('air').name, 'Lithium');
  assert.equal(oreWantedBy('space').name, 'Iridium');
});
