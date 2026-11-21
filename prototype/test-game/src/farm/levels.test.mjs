// [MM-story_mwatmww5_1l] [MM-story_mwatmy2u_1m] A crop's level is its MASTERY, with the farm machinery owned (owner
// rules 12-13). Owner 2026-11-21: "We don't need to create a tree for the crop upgrades, only the farm equipment."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, migrate } from '../save/save.js';
import { CROPS, CROP_LEVEL_RULES, masteryFor, plantsFor, cropOf, FARM } from '../data/farm.js';
import { TECH_BY_ID, techStatus, techGates } from '../data/techtree.js';
import { techCtxFromSave, createGameTechAdapter } from '../menu/techSave.js';
import { cropLevel, cropLevels, cropLevelInfo, masteryOf, masteryLevel, notePlanted, noteGrown, machineryUnlocked,
  MACHINES, machineFor, migrateCropNodes } from './levels.js';

const own = (s, ...ids) => { for (const id of ids) s.tech.owned[id] = true; return s; };
const mastered = (s, crop, pts) => { s.mastery[crop] = pts; return s; };

test('the rules are data: levels 2-5, mastery rising, a machine from level 3, the same for every crop', () => {
  assert.deepEqual(CROP_LEVEL_RULES.map((r) => [r.level, r.mastery, r.machine]),
    [[2, 100, null], [3, 300, 'mc_fertilizer'], [4, 800, 'mc_agrobots'], [5, 2000, 'mc_irrigation']]);
  assert.equal(masteryFor(1), 0);
  assert.deepEqual(MACHINES.map((m) => [m.level, m.id]), [[3, 'mc_fertilizer'], [4, 'mc_agrobots'], [5, 'mc_irrigation']]);
  assert.equal(machineFor(2), null);
});

test('mastery points: a pod planted is one; units harvested, sold or delivered count as the plants that grew them', () => {
  const s = defaultSave();
  notePlanted(s, 'loam-grain', 16);
  assert.equal(masteryOf(s, 'loam-grain'), 16);
  const grain = cropOf('loam-grain'), egg = cropOf('broodqueen-egg');
  noteGrown(s, 'loam-grain', grain.yield);   // one full plot's harvest
  assert.equal(masteryOf(s, 'loam-grain'), 32);
  assert.equal(plantsFor(egg, egg.yield), FARM.Pods_Per_Plot, 'every tier: one plot\'s yield is one plot\'s plants');
  notePlanted(s, 'not-a-crop', 50);
  assert.equal(s.mastery['not-a-crop'], undefined);
  assert.equal(masteryOf(null, 'loam-grain'), 0);
});

test('the level: what mastery has opened, held at the first missing machine', () => {
  const s = defaultSave();
  assert.equal(cropLevel(s, 'loam-grain'), 1);
  mastered(s, 'loam-grain', 99);
  assert.equal(cropLevel(s, 'loam-grain'), 1);
  mastered(s, 'loam-grain', 100);
  assert.equal(cropLevel(s, 'loam-grain'), 2, 'level 2 needs no machine');
  mastered(s, 'loam-grain', 2500);
  assert.equal(masteryLevel(s, 'loam-grain'), 5);
  let i = cropLevelInfo(s, 'loam-grain', (id) => TECH_BY_ID[id].name);
  assert.deepEqual([i.level, i.mastered, i.capped, i.why], [2, 5, true, 'level 3 needs the Fertilizer Machine']);
  own(s, 'mc_fertilizer', 'mc_agrobots');
  i = cropLevelInfo(s, 'loam-grain', (id) => TECH_BY_ID[id].name);
  assert.deepEqual([i.level, i.why], [4, 'level 5 needs the Irrigation']);
  own(s, 'mc_irrigation');
  assert.equal(cropLevel(s, 'loam-grain'), 5);
  assert.equal(cropLevelInfo(s, 'loam-grain').next, null, 'top');
  assert.equal(cropLevel(s, 'petal-silk'), 1, 'per crop: machines are shared, mastery is not');
  assert.equal(Object.keys(cropLevels(s)).length, CROPS.length);
  assert.deepEqual(cropLevelInfo(defaultSave(), 'petal-silk').next, { level: 2, need: 100, have: 0 });
});

test('MACHINERY in the tech tree: three machines, each unlocked by a crop mastered to its level, then bought', () => {
  const s = defaultSave();
  s.carry = { gold: 20_000, structures: [] };
  const opts = { missionGate: true };
  const fert = TECH_BY_ID.mc_fertilizer, bots = TECH_BY_ID.mc_agrobots;
  assert.equal(machineryUnlocked(s).size, 0);
  assert.equal(techStatus(fert, techCtxFromSave(s, undefined, opts)), 'locked');
  assert.equal(techGates(fert, techCtxFromSave(s, undefined, opts))[0].txt, 'A crop mastered to level 3');
  mastered(s, 'rootsong-seeds', 300);
  assert.deepEqual([...machineryUnlocked(s)], ['mc_fertilizer']);
  assert.equal(techStatus(fert, techCtxFromSave(s, undefined, opts)), 'ready');
  const save = { loadSave: () => s, buyTech: (id, price) => { s.carry.gold -= price; s.tech.owned[id] = true; s.tech.paid[id] = price; return true; }, refundTech: () => {} };
  const adapter = createGameTechAdapter({ save, ctxOpts: opts });
  assert.equal(adapter.buy(bots.id), false, 'Agrobots: locked until a crop reaches level 4, and needs the Fertilizer Machine');
  assert.equal(adapter.buy(fert.id), true);
  assert.equal(s.carry.gold, 20_000 - fert.price);
  assert.equal(cropLevel(s, 'rootsong-seeds'), 3);
});

test('old saves: bought crop nodes are refunded and become mastery, so the level is kept', () => {
  const s = defaultSave();
  s.carry = { gold: 100, structures: [] };
  s.tech.owned = { crop_loam_grain_2: true, crop_loam_grain_3: true, cannon2: true };
  s.tech.paid = { crop_loam_grain_2: 500, crop_loam_grain_3: 1200, cannon2: 600 };
  assert.equal(migrateCropNodes(s), 1700);
  assert.equal(s.carry.gold, 1800);
  assert.deepEqual(Object.keys(s.tech.owned), ['cannon2'], 'other research untouched');
  assert.equal(masteryOf(s, 'loam-grain'), 300);
  assert.equal(masteryLevel(s, 'loam-grain'), 3);
  assert.equal(migrateCropNodes(s), 0, 'once only');
  const old = { ...defaultSave(), tech: { owned: { crop_elder_bloom_2: true }, paid: { crop_elder_bloom_2: 1500 }, unlocked: {} }, carry: { gold: 0 } };
  delete old.mastery;
  const m = migrate(old);
  assert.equal(m.carry.gold, 1500);
  assert.equal(m.mastery['elder-bloom'], 100);
});

// [MM-story_mwpyr9zs_44] owner 2026-11-21: "The crop upgrades are presented in the tech tree, and the tree can hint at how
// to unlock crops."
test('the tech tree presents each crop: locked with a hint and progress, else its level, mastery and the next machine', async () => {
  const { cropInfo } = await import('../menu/techSave.js');
  const { unlockHint } = await import('./unlock.js');
  const s = defaultSave();
  s.cropDelivered['petal-silk'] = 120;
  let i = cropInfo(s, 'petal-silk');
  assert.deepEqual([i.unlocked, i.delivered, i.need], [false, 120, 500]);
  assert.equal(i.hint, 'Deliver 500 Petal Silk, the common resource on Florael\'s maps: every unit your harvesters bring home counts, and every farm sale or delivery.');
  assert.match(unlockHint('helium-4'), /farm-only material.*farming contract/);
  s.podUnlocks['loam-grain'] = true; s.mastery['loam-grain'] = 450;
  i = cropInfo(s, 'loam-grain');
  assert.deepEqual([i.unlocked, i.level, i.levelName, i.mastered, i.why], [true, 2, 'Uncommon', 3, 'level 3 needs the Fertilizer Machine']);
  assert.deepEqual([i.next.level, i.next.need, i.next.machineName], [4, 800, 'Agrobots']);
  s.tech.owned.mc_fertilizer = true;
  i = cropInfo(s, 'loam-grain');
  assert.deepEqual([i.level, i.levelName, i.colour, i.why], [3, 'Rare', '#4da6ff', null]);
  const ctx = techCtxFromSave(s);
  assert.equal(ctx.cropInfo('loam-grain').level, 3, 'the tree reads it from its context');
});
