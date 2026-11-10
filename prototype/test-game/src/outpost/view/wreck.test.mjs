// [MM-story_mwb8zamf_23] owner 2026-11-10: an outpost defense at 0 HP looks wrecked (charred, slumped, smoking, turret dead)
// until a repair drone restores it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defenseStructures } from './conduits.js';
import { damageSites } from './constructionFx.js';
import { lifecycleLook } from '../../render3d/structures/models.js';
import { planSystem } from '../../render3d/structures/system3d.js';

const outpost = (hp) => ({ pads: {}, defenses: [{ id: 'd1', kind: 'cannon', tier: 1, cell: [5, 5], hp }] });

test('a defense at 0 HP is a wreck; worn and whole ones are not', () => {
  assert.equal(defenseStructures(outpost(0))[0].lifecycle, 'Wrecked');
  assert.equal(defenseStructures(outpost(120))[0].lifecycle, 'Damaged');
  assert.equal(defenseStructures(outpost(400))[0].lifecycle, 'Active');
});

test('the wreck look: charred and slumped, and its turret does not aim', () => {
  const w = lifecycleLook({ lifecycle: 'Wrecked', hp: 0, maxHp: 400 });
  assert.equal(w.key, 'W');
  assert.ok(w.sy < 1 && w.tint.every((c) => c < 0.4));
  const [item] = planSystem(defenseStructures(outpost(0))).items;
  assert.equal(item.aim, false);
  assert.equal(planSystem(defenseStructures(outpost(200))).items[0].aim, true);
});

test('a wreck smokes (its damage site says so)', () => {
  assert.equal(damageSites(outpost(0))[0].wreck, true);
  assert.equal(damageSites(outpost(200))[0].wreck, false);
  assert.deepEqual(damageSites(outpost(400)), []);
});
