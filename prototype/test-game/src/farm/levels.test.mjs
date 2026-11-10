// [MM-story_mwai5f8t_1g] Crop levels come from the tech tree (owner rule 9, 2026-11-10): cropLevel reads the owned chain;
// the farming contracts unlock the nodes (II: F1 accepted; III–V: F1 complete, proposed); gold buys them (D7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave } from '../save/save.js';
import { CROPS } from '../data/farm.js';
import { TECH_BY_ID, techStatus, techGates } from '../data/techtree.js';
import { techCtxFromSave, createGameTechAdapter } from '../menu/techSave.js';
import { cropLevel, cropLevels, nextLevelNode, cropTechUnlocked } from './levels.js';

const own = (s, ...ids) => { for (const id of ids) s.tech.owned[id] = true; return s; };

test('cropLevel: 1 with nothing owned, else the highest owned node of the chain, in order', () => {
  const s = defaultSave();
  assert.equal(cropLevel(s, 'loam-grain'), 1);
  own(s, 'crop_loam_grain_2');
  assert.equal(cropLevel(s, 'loam-grain'), 2);
  own(s, 'crop_loam_grain_3', 'crop_loam_grain_4', 'crop_loam_grain_5');
  assert.equal(cropLevel(s, 'loam-grain'), 5);
  assert.equal(cropLevel(s, 'elder-bloom'), 1, 'per crop');
  const gap = own(defaultSave(), 'crop_elder_bloom_3');
  assert.equal(cropLevel(gap, 'elder-bloom'), 1, 'a node without the one before it does not count');
  assert.equal(cropLevel(defaultSave(), 'petal-silk'), 1, 'a crop with no chain yet is level 1');
  assert.equal(cropLevel(null, 'loam-grain'), 1);
  const all = cropLevels(s);
  assert.equal(Object.keys(all).length, CROPS.length);
  assert.equal(all['loam-grain'], 5);
  assert.equal(nextLevelNode(s, 'loam-grain'), null, 'top');
  assert.equal(nextLevelNode(defaultSave(), 'loam-grain').id, 'crop_loam_grain_2');
  assert.equal(nextLevelNode(defaultSave(), 'petal-silk'), null);
});

test('the mission gates: II with F1 accepted, III–V with F1 complete', () => {
  const s = defaultSave();
  assert.equal(cropTechUnlocked(s).size, 0, 'no farm contract: nothing unlocked');
  s.farmContracts = { ground: { step: 1, state: 'offered' } };
  assert.equal(cropTechUnlocked(s).size, 0, 'an offer unlocks nothing');
  s.farmContracts.ground.state = 'active';
  assert.deepEqual([...cropTechUnlocked(s)].sort(), ['crop_elder_bloom_2', 'crop_heartwood_amber_2', 'crop_loam_grain_2', 'crop_rootsong_seeds_2']);
  s.farmContracts.ground.state = 'complete';
  assert.equal(cropTechUnlocked(s).size, 16);
});

test('through the game\'s tech adapter: locked until F1, then bought with gold; the level follows', () => {
  const s = defaultSave();
  s.carry = { gold: 10_000, structures: [] };
  const opts = { missionGate: true, unlockedBy: () => 'Bread for the Regiments' };
  const ii = TECH_BY_ID.crop_loam_grain_2, iii = TECH_BY_ID.crop_loam_grain_3;
  assert.equal(techStatus(ii, techCtxFromSave(s, undefined, opts)), 'locked');
  assert.match(techGates(ii, techCtxFromSave(s, undefined, opts))[0].txt, /Farming F1 on Verdance accepted/);
  s.farmContracts = { ground: { step: 1, state: 'active' } };
  assert.equal(techStatus(ii, techCtxFromSave(s, undefined, opts)), 'ready');
  const save = { loadSave: () => s, buyTech: (id, price) => { s.carry.gold -= price; s.tech.owned[id] = true; s.tech.paid[id] = price; return true; }, refundTech: () => {} };
  const adapter = createGameTechAdapter({ save, ctxOpts: opts });
  assert.equal(adapter.buy(ii.id), true);
  assert.equal(s.carry.gold, 10_000 - ii.price);
  assert.equal(cropLevel(s, 'loam-grain'), 2);
  assert.equal(adapter.buy(iii.id), false, 'III waits for F1 complete');
  s.farmContracts.ground.state = 'complete';
  assert.equal(adapter.buy(iii.id), true);
  assert.equal(cropLevel(s, 'loam-grain'), 3);
});
