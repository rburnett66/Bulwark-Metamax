/**
 * src/farm/pods.js — seed pods: the stock, the pod bench, Rare pods from battles, the F1 Pod Crate
 * [MM-story_mwabgh3x_b].
 *
 * Design: docs/16 Bulwark MM/design/Farming-Design.md §8 (levels, how pods level up), §9.1 (where pods come from);
 * Farming-Distribution-Design.md §3–§4. Tech plan: docs/tech-plan/Farming.md §3.1, §3.3, §2.3 F4 and F9.
 *
 * Save (defaulted in save.js): s.pods = { [cropId]: { [level]: count } } and s.podCarry = { [cropId]: units } (the
 * battle units not yet worth a pod). Pods belong to the OUTPOST & FARM side (owner rule 5): nothing here ever writes
 * the battle's s.inventory. Gold is the campaign bank, s.carry.gold (read with bankOf), spent the way save.js's
 * buyResearch spends it.
 *
 * Pure: no DOM, no clock, no randomness. The lucky level-up roll is the farm model's (src/farm/model.js), not this
 * file's. Every number comes from src/data/farm.js (proposed defaults, Farming-Design D14).
 */
import { FARM, MAX_POD_LEVEL, podLevel, cropOf, cropsOf } from '../data/farm.js';
import { bankOf } from '../save/save.js';

/** Rare (level 3) is battle quality (owner, Farming-Design §8.2): the level battles drop. */
export const BATTLE_POD_LEVEL = 3;

const isLevel = (level) => Number.isInteger(level) && level >= 1 && level <= MAX_POD_LEVEL;
const isCount = (n) => Number.isInteger(n) && n >= 0;

function check(cropId, level) {
  if (!cropOf(cropId)) throw new Error('pods: unknown crop "' + cropId + '"');
  if (!isLevel(level)) throw new Error('pods: no pod level ' + level);
}

/** The save's pod stock, created if an object handed in has none yet. */
function stockOf(s) {
  if (!s.pods || typeof s.pods !== 'object') s.pods = {};
  return s.pods;
}

/** Pods held of one crop at one level. */
export const podCount = (s, cropId, level) => (((s && s.pods) || {})[cropId] || {})[level] || 0;

/** Every pod held of one crop, all levels. */
export const podsOfCrop = (s, cropId) => {
  const row = ((s && s.pods) || {})[cropId] || {};
  return Object.values(row).reduce((a, n) => a + n, 0);
};

/** Add n pods of a crop at a level. → the new count. */
export function addPods(s, cropId, level, n) {
  check(cropId, level);
  if (!isCount(n)) throw new Error('pods: bad pod count ' + n);
  const stock = stockOf(s), row = stock[cropId] || (stock[cropId] = {});
  row[level] = (row[level] || 0) + n;
  return row[level];
}

/** Spend n pods of a crop at a level. Short of them: false, and nothing changes. */
export function spendPods(s, cropId, level, n) {
  check(cropId, level);
  if (!isCount(n)) throw new Error('pods: bad pod count ' + n);
  const have = podCount(s, cropId, level);
  if (have < n) return false;
  const row = stockOf(s)[cropId] || (s.pods[cropId] = {});
  if (have - n) row[level] = have - n;
  else delete row[level];
  if (!Object.keys(row).length) delete s.pods[cropId];
  return true;
}

/**
 * The pod bench (Farming-Design §8.3): Bench_In pods of one crop and level make 1 of the next level, for that level's
 * benchGold. → { ok: true, crop, from, to, gold } or { ok: false, reason: 'top' | 'pods' | 'gold', need, have }.
 * A refusal changes nothing. (Pod Bench II's half price, Verdance F3, is a later story.)
 */
export function benchUpgrade(s, cropId, level) {
  check(cropId, level);
  if (level >= MAX_POD_LEVEL) return { ok: false, reason: 'top', need: 0, have: 0 };
  const need = FARM.Bench_In, have = podCount(s, cropId, level);
  if (have < need) return { ok: false, reason: 'pods', need, have };
  const gold = podLevel(level).benchGold, bank = bankOf(s);
  if (bank < gold) return { ok: false, reason: 'gold', need: gold, have: bank };
  spendPods(s, cropId, level, need);
  s.carry.gold -= gold;
  s.goldBank = s.carry.gold;   // mirrored, as every other gold spend in save.js does
  addPods(s, cropId, level + 1, 1);
  return { ok: true, crop: cropId, from: level, to: level + 1, gold };
}

/** Battle units per Rare pod for a crop tier: Battle_Pod_Units, an epic field Battle_Pod_Units_Epic (§2.3 F9). */
export const unitsPerPod = (tier) => (tier === 'epic' ? FARM.Battle_Pod_Units_Epic : FARM.Battle_Pod_Units);

/**
 * Rare pods from one finished battle (Farming-Design §9.1, Distribution §4.2): one Rare pod of the field's crop per
 * unitsPerPod(tier) units carried home; the remainder waits in s.podCarry for the next battle on that planet.
 * keptByTier: { common, uncommon, rare, epic } units (the tally bankHarvest banks). planet: the planet's name or key.
 * A tier whose crop is a farm-only new material (Helium-4) yields nothing: the battle carried Helium-3, which is not a
 * crop (owner rule 1). Arithmetic only, after the battle, so the sim and its replays are untouched.
 * → { [cropId]: pods banked } (only crops that gained a pod).
 */
export function battlePods(s, planet, keptByTier) {
  const out = {};
  if (!planet || !keptByTier) return out;
  const crops = cropsOf(planet);
  if (!s.podCarry || typeof s.podCarry !== 'object') s.podCarry = {};
  for (const [tier, units] of Object.entries(keptByTier)) {
    if (!(units > 0)) continue;
    const c = crops.find((x) => x.tier === tier);
    if (!c || c.newMaterial) continue;
    const per = unitsPerPod(tier), total = (s.podCarry[c.id] || 0) + Math.floor(units);
    const n = Math.floor(total / per), rest = total - n * per;
    if (rest) s.podCarry[c.id] = rest;
    else delete s.podCarry[c.id];
    if (n) { addPods(s, c.id, BATTLE_POD_LEVEL, n); out[c.id] = n; }
  }
  return out;
}

/** The F1 Pod Crate: contract.podCrate pods of contract.crop at contract.podCrateLevel. → { crop, level, n }. */
export function grantPodCrate(s, contract) {
  const n = contract.podCrate || 0, level = contract.podCrateLevel || 1;
  if (n) addPods(s, contract.crop, level, n);
  return { crop: contract.crop, level, n };
}
