// [MM-story_mwb8zamf_23] owner 2026-11-10: an outpost defense at 0 HP looks wrecked (charred, slumped, smoking, turret dead)
// until a repair drone restores it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defenseStructures } from './conduits.js';
import { createStructureFx } from '../../render3d/fx/structureFx.js';
import { K } from '../../render3d/fx/impacts.js';
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

test('a wreck smokes and sparks the most, through the shared structure FX (render3d/fx/structureFx.js) [MM-story_mwcrfnyf_3c]', () => {
  const run = (hp) => {
    const fx = createStructureFx({ seed: 5 }), st = { structures: new Map(defenseStructures(outpost(hp)).map((s) => [s.id, s])) };
    const n = { spark: 0, smoke: 0 };
    for (let i = 0; i < 60; i++) fx.step(1 / 30, st, (kind) => { if (kind === K.SPARK) n.spark++; if (kind === K.SMOKE) n.smoke++; }, K);
    return n;
  };
  const wreck = run(0), worn = run(200), whole = run(400);
  assert.ok(wreck.spark > worn.spark && wreck.smoke > worn.smoke, `a wreck throws the most (${JSON.stringify(wreck)} vs ${JSON.stringify(worn)})`);
  assert.ok(worn.spark > 0 && worn.smoke > 0, 'a worn one throws some');
  assert.deepEqual(whole, { spark: 0, smoke: 0 }, 'a whole one throws none');
});
