// [MM-story_mwabgax7_9] Farm data: the Phase A sheets, extracted to MAPDATA, read by src/data/farm.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAPDATA } from '../../content/maps/mapdata.js';
import {
  FARM, CROPS, cropOf, cropsOf, METHODS, methodOf, POD_LEVELS, MAX_POD_LEVEL, podLevel, FARM_BUILDINGS, farmBuildingOf,
  farmContractOf, growSec, fruitedSec, stageAt, yieldOf, podsBack, prepCost, NEW_MATERIALS, MAP_CROP_LEVEL, CROP_LEVELS,
  CROP_LEVEL_NODES, cropLevelChain, growLevel,
} from './farm.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const H = 3600;

test('the JSON and the JS module carry the same farm data', () => {
  const json = JSON.parse(readFileSync(new URL('../../content/maps/mapdata.json', import.meta.url), 'utf8'));
  for (const k of ['farmParams', 'crops', 'farmMethods', 'podLevels', 'farmBuildings', 'farmContracts', 'cropLevels']) {
    assert.ok(k in MAPDATA, k + ' extracted');
    assert.deepEqual(MAPDATA[k], json[k], k);
  }
});

test('36 crops: every planet\'s four surface resources, one per tier, in the catalogue\'s order', () => {
  assert.equal(CROPS.length, 36);
  assert.deepEqual(CROPS.map((c) => [c.planet, c.tier]), CATALOG.resources.map((r) => [r.planet, r.tier]));
  for (const c of CROPS) assert.ok(c.growHours > 0 && c.yield >= 1 && c.fruitedHours > 0, c.id);
  assert.equal(new Set(CROPS.map((c) => c.id)).size, 36);
});

test('Helium-4 is a new material: the only crop that is not a battle resource, and Helium-3 is untouched', () => {
  // owner rules 1 and 5: Helium-3 and Helium-4 are two different materials, and farming has its own inventory, so
  // Helium-4 never joins the battle catalogue. The Crops sheet marks it Material = new [MM-story_mwabg5me_7].
  const ids = new Set(CATALOG.resources.map((r) => r.id));
  assert.deepEqual(CROPS.filter((c) => !ids.has(c.id)).map((c) => c.id), ['helium-4']);
  assert.deepEqual(NEW_MATERIALS.map((c) => c.id), ['helium-4'], 'the sheet says which crops are new materials');
  assert.ok(CROPS.every((c) => c.newMaterial === !ids.has(c.id)), 'every other crop is the battle resource of its name');
  const he4 = cropOf('helium-4');
  assert.deepEqual([he4.name, he4.planet, he4.tier, he4.category, he4.growsAs], ['Helium-4', 'Lumen', 'uncommon', 'Minerals', 'accreted']);
  assert.equal(cropOf('helium-3'), null, 'Helium-3 is not a crop');
  assert.deepEqual(CATALOG.resources.find((r) => r.id === 'helium-3'), { id: 'helium-3', name: 'Helium-3', tier: 'uncommon', planet: 'Lumen', faction: 'Space Tech', value: 2 },
    'the battle resource Helium-3 is unchanged');
  for (const c of CROPS) if (c.id !== 'helium-4') assert.equal(c.name, CATALOG.resources.find((r) => r.id === c.id).name, c.id);
});

test('grow times and yields follow Farming-Design §5.4: category × tier stretch', () => {
  const loam = cropOf('loam-grain');
  assert.deepEqual([loam.category, loam.growHours, loam.yield, loam.fruitedHours], ['Grain', 2, 16, 2]);
  assert.deepEqual([cropOf('heartwood-amber').growHours, cropOf('heartwood-amber').yield], [6, 4], 'materials 4 h × 1.5, 6 ÷ 1.5');
  assert.deepEqual([cropOf('elder-bloom').growHours, cropOf('elder-bloom').yield], [16, 2], 'epic tier × 4');
  assert.deepEqual([cropOf('solar-pearl').growHours, cropOf('solar-pearl').yield], [32, 1], 'gems at epic tier: 8 h × 4, at least 1');
  assert.deepEqual(cropsOf('Verdance').map((c) => c.id), ['loam-grain', 'heartwood-amber', 'rootsong-seeds', 'elder-bloom']);
  assert.deepEqual(cropsOf('ground'), cropsOf('Verdance'));
});

test('Phase A methods: Traditional and Irrigated, both 2 × 2 with 4 pods; Irrigated grows 1.5× within 4 cells of water', () => {
  assert.deepEqual(METHODS.map((m) => m.id), ['traditional', 'irrigated']);
  const t = methodOf('traditional'), i = methodOf('irrigated');
  assert.deepEqual([t.w, t.h, t.pods, t.speed, t.waterReach], [2, 2, FARM.Pods_Per_Plot, 1, 0]);
  assert.deepEqual([i.w, i.h, i.pods, i.speed, i.waterReach], [2, 2, 4, 1.5, 4]);
  assert.equal(methodOf('hydroponic'), null, 'the grow rooms are future (owner rule 2)');
});

test('five crop levels in the prototype\'s colours; Rare (level 3) is battle quality', () => {
  assert.equal(MAX_POD_LEVEL, 5);
  assert.equal(CROP_LEVELS, POD_LEVELS, 'one table, two names');
  assert.deepEqual(POD_LEVELS.map((l) => l.name), ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']);
  assert.deepEqual(POD_LEVELS.map((l) => l.colour), ['#ffffff', '#4dff6a', '#4da6ff', '#b25cff', '#ffc83d']);
  assert.deepEqual(POD_LEVELS.map((l) => l.value), [0.5, 0.75, 1, 1.3, 1.75]);
  assert.ok(POD_LEVELS.every((l) => !('benchGold' in l)), 'the pod bench is gone (owner rule 9)');
  assert.ok(POD_LEVELS.every((l, i) => !i || (l.embers.count > POD_LEVELS[i - 1].embers.count && l.embers.life > POD_LEVELS[i - 1].embers.life)),
    'a higher level throws more embers, for longer');
  assert.equal(podLevel(0), null);
  assert.equal(podLevel(6), null);
});

test('the stages run Planted → Sprout → Plant → Fruited → Dead inside the grow time and the Fruited window', () => {
  const g = growSec('loam-grain');
  assert.equal(g, 2 * H);
  assert.equal(growSec('loam-grain', 'irrigated'), (2 * H) / 1.5);
  assert.equal(fruitedSec('loam-grain'), 2 * H, 'Fruited lasts as long as the crop took to grow (D2)');
  assert.deepEqual([0, 0.1, 0.3, 0.999, 1, 1.999, 2].map((k) => stageAt('loam-grain', 'traditional', k * g)),
    ['planted', 'sprout', 'plant', 'plant', 'fruited', 'fruited', 'dead']);
  assert.throws(() => growSec('nope'), /unknown crop/);
});

test('yield: the crop\'s yield × the method × (1 + 5 % per level above Common); pods back by category', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((L) => yieldOf('loam-grain', 'traditional', L)), [16, 16, 17, 18, 19]);
  assert.equal(yieldOf('solar-pearl', 'traditional', 1), 1, 'never below 1');
  assert.throws(() => yieldOf('loam-grain', 'traditional', 6), /pod level/);
  assert.equal(podsBack('loam-grain', 4), 1, 'grain: 20 % of 4, at least 1');
  assert.equal(podsBack('rootsong-seeds', 4), 0, 'vegetables: 10 % of 4 rounds down');
  assert.equal(podsBack('rootsong-seeds', 12), 1);
  assert.equal(podsBack('heartwood-amber', 12), 0, 'others give none');
});

test('Phase A buildings and Verdance F1', () => {
  assert.deepEqual(FARM_BUILDINGS.map((b) => b.kind), ['farmhouse', 'silo', 'pump']);
  assert.deepEqual([farmBuildingOf('pump').w, farmBuildingOf('pump').waterReach], [1, 4]);
  assert.equal(farmBuildingOf('farmhouse').cost, 0, 'F1 grants the Farmhouse');
  const f1 = farmContractOf('ground', 'F1');
  assert.equal(f1.title, 'Bread for the Regiments');
  assert.equal(cropOf(f1.crop).name, 'Loam Grain');
  assert.deepEqual([f1.plantPlots, f1.deliver, f1.methodsAtOnce, f1.gold, f1.loyalty, f1.xp, f1.podCrate],
    [3, 40, 2, 1500, 15, 300, FARM.Pod_Crate]);
  assert.ok(!('podCrateLevel' in f1), 'the crate\'s pods have no level');
  assert.ok(f1.deliver <= 3 * yieldOf(f1.crop, 'traditional', 1), 'F1\'s delivery fits three Common plots (Farming-Design §5.4)');
  assert.deepEqual(f1.grants, ['farmhouse']);
  assert.ok(f1.unlocks.includes('method:irrigated') && f1.unlocks.includes('tab:seedpods'));
  assert.deepEqual(prepCost('traditional'), { gold: 100, sec: 2 });   // owner 2026-11-12: prepping takes 2 s
});

test('the tuning is all there and numeric', () => {
  for (const k of ['Prep_Gold', 'Prep_Sec', 'Sprout_At', 'Plant_At', 'Fruited_Window', 'Pods_Per_Plot', 'Pod_Price',
    'Chest_Units_Per_Pod', 'Pod_Crate', 'Silo_Hours',
    'Breach_Silo_Loss', 'Trample_Fruited_Yield', 'Avatar_Cells', 'Farmhands']) assert.equal(typeof FARM[k], 'number', k);
  assert.ok(FARM.Sprout_At < FARM.Plant_At);
  for (const k of ['Lucky_Chance', 'Lucky_Chance_High', 'Bench_In']) assert.ok(!(k in FARM), k + ' is gone with the bench and the lucky roll (owner rule 9)');
});

// ── owner rule 9 (2026-11-10) [MM-story_mwai5f8t_1g]: crop levels come from the tech tree; pods have no level ──────
test('seed pods have one fixed price, every crop alike (Farm_Params Pod_Price, proposed)', () => {
  assert.equal(FARM.Pod_Price, 25);
  assert.ok(Number.isInteger(FARM.Pod_Price) && FARM.Pod_Price > 0);
});

test('battle-map crops count as level 3 (Rare): its worth is the battle price', () => {
  assert.equal(MAP_CROP_LEVEL, 3);
  assert.equal(podLevel(MAP_CROP_LEVEL).name, 'Rare');
  assert.equal(podLevel(MAP_CROP_LEVEL).value, 1);
});

test('the crop level nodes: Verdance\'s four crops, a chain II–V each, priced and gated from the workbook', () => {
  const verdance = cropsOf('ground').map((c) => c.id);
  assert.equal(CROP_LEVEL_NODES.length, 16);
  assert.deepEqual([...new Set(CROP_LEVEL_NODES.map((n) => n.crop))], verdance, 'Verdance first, in tier order');
  for (const id of verdance) {
    const chain = cropLevelChain(id);
    assert.deepEqual(chain.map((n) => n.level), [2, 3, 4, 5], id);
    assert.ok(chain.every((n, i) => !i || n.price > chain[i - 1].price), id + ': each level dearer');
    assert.deepEqual(chain.map((n) => n.unlock.state), ['accepted', 'complete', 'complete', 'complete'], id + ': II with F1 accepted, III–V with F1 complete');
    assert.ok(chain.every((n) => n.unlock.contract === 'F1' && n.proposed), id + ': proposed gates and prices');
  }
  assert.deepEqual(cropLevelChain('loam-grain').map((n) => [n.id, n.name, n.price]), [
    ['crop_loam_grain_2', 'Loam Grain II', 500], ['crop_loam_grain_3', 'Loam Grain III', 1200],
    ['crop_loam_grain_4', 'Loam Grain IV', 2500], ['crop_loam_grain_5', 'Loam Grain V', 5000]]);
  assert.deepEqual(cropLevelChain('elder-bloom').map((n) => n.price), [1500, 3600, 7500, 15000], 'epic tier ×3');
  assert.deepEqual(cropLevelChain('petal-silk'), [], 'other planets join later as rows');
});

test('level 5 needs a trick: a Traditional plot grows a level-5 crop at 4; an Irrigated plot reaches 5 with water', () => {
  assert.equal(methodOf('traditional').level5Needs, 'never');
  assert.equal(methodOf('irrigated').level5Needs, 'water');
  for (const L of [1, 2, 3, 4]) {
    assert.deepEqual(growLevel(L, 'traditional'), { level: L, capped: false, why: null });
    assert.deepEqual(growLevel(L, 'irrigated', { water: false }), { level: L, capped: false, why: null });
  }
  assert.deepEqual(growLevel(5, 'traditional'), { level: 4, capped: true, why: 'level 5 needs irrigation' });
  assert.deepEqual(growLevel(5, 'traditional', { water: true }), { level: 4, capped: true, why: 'level 5 needs irrigation' }, 'water alone is not enough');
  const dry = growLevel(5, 'irrigated', { water: false });
  assert.equal(dry.level, 4);
  assert.match(dry.why, /level 5 needs water/);
  assert.deepEqual(growLevel(5, 'irrigated', { water: true }), { level: 5, capped: false, why: null });
});
