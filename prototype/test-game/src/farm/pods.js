/**
 * src/farm/pods.js — seed pods: the stock, buying them, pods from battles, the F1 Pod Crate
 * [MM-story_mwabgh3x_b], [MM-story_mwai5f8t_1g].
 *
 * Owner rule 9 (2026-11-10): seed pods have NO level. A crop's level comes from the tech tree (src/farm/levels.js
 * cropLevel) and a plot keeps the level it was planted at (src/farm/model.js plant). So the stock is a plain count per
 * crop, pods are bought at one fixed price (FARM.Pod_Price, any crop), and battles and the F1 crate give plain pods.
 * Design: docs/16 Bulwark MM/design/Farming-Design.md §9.1 (where pods come from); tech plan docs/tech-plan/Farming.md
 * rule 9, §3.1, §3.3.
 *
 * Save (defaulted and migrated in save.js): s.pods = { [cropId]: count } and s.podCarry = { [cropId]: units } (the
 * battle units not yet worth a pod). Pods belong to the OUTPOST & FARM side (owner rule 5): nothing here ever writes
 * the battle's s.inventory. Gold is the campaign bank, s.carry.gold (read with bankOf), spent the way save.js's
 * buyTech spends it.
 *
 * Pure: no DOM, no clock, no randomness. Every number comes from src/data/farm.js (proposed defaults, D14).
 */
import { FARM, cropOf, cropsOf } from '../data/farm.js';
import { bankOf } from '../save/save.js';

const isCount = (n) => Number.isInteger(n) && n >= 0;

function check(cropId, n) {
  if (!cropOf(cropId)) throw new Error('pods: unknown crop "' + cropId + '"');
  if (!isCount(n)) throw new Error('pods: bad pod count ' + n);
}

/** The save's pod stock, created if an object handed in has none yet. */
function stockOf(s) {
  if (!s.pods || typeof s.pods !== 'object') s.pods = {};
  return s.pods;
}

/**
 * An old save's row ({ [level]: count }, before rule 9) as a plain count: the levels summed. A number stays a number.
 * save.js migrates on load; this keeps a row read before that safe too.
 */
export const podRowCount = (row) => (typeof row === 'number' ? row
  : row && typeof row === 'object' ? Object.values(row).reduce((a, n) => a + (+n || 0), 0) : 0);

/** Pods held of one crop. */
export const podCount = (s, cropId) => podRowCount(((s && s.pods) || {})[cropId]);

/** Every pod held, all crops. */
export const podsHeld = (s) => Object.keys((s && s.pods) || {}).reduce((a, id) => a + podCount(s, id), 0);

/** Add n pods of a crop. → the new count. */
export function addPods(s, cropId, n) {
  check(cropId, n);
  const stock = stockOf(s);
  stock[cropId] = podRowCount(stock[cropId]) + n;
  if (!stock[cropId]) delete stock[cropId];
  return stock[cropId] || 0;
}

/** Spend n pods of a crop. Short of them: false, and nothing changes. */
export function spendPods(s, cropId, n) {
  check(cropId, n);
  const have = podCount(s, cropId);
  if (have < n) return false;
  const stock = stockOf(s);
  if (have - n) stock[cropId] = have - n;
  else delete stock[cropId];
  return true;
}

/** Gold for n pods: one fixed price per pod, every crop alike (FARM.Pod_Price, proposed). */
export const podPrice = (n = 1) => FARM.Pod_Price * n;

/**
 * BUY n pods of a crop on the SEED PODS tab, at podPrice(n), from the campaign bank (as the tech tree and the outpost
 * spend it). → { ok: true, crop, n, gold } or { ok: false, reason: 'gold', need, have }. A refusal changes nothing.
 */
export function buyPods(s, cropId, n = FARM.Pods_Per_Plot) {
  check(cropId, n);
  const gold = podPrice(n), bank = bankOf(s);
  if (bank < gold) return { ok: false, reason: 'gold', need: gold, have: bank };
  s.carry = s.carry || { gold: bank, structures: [] };
  s.carry.gold -= gold;
  s.goldBank = s.carry.gold;   // mirrored, as every other gold spend in save.js does
  addPods(s, cropId, n);
  return { ok: true, crop: cropId, n, gold };
}

/** Battle units per pod for a crop tier: Battle_Pod_Units, an epic field Battle_Pod_Units_Epic (§2.3 F9). */
export const unitsPerPod = (tier) => (tier === 'epic' ? FARM.Battle_Pod_Units_Epic : FARM.Battle_Pod_Units);

/**
 * Pods from one finished battle (Farming-Design §9.1, Distribution §4.2): one pod of the field's crop per
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
    if (n) { addPods(s, c.id, n); out[c.id] = n; }
  }
  return out;
}

/** The F1 Pod Crate: contract.podCrate pods of contract.crop. → { crop, n }. */
export function grantPodCrate(s, contract) {
  const n = contract.podCrate || 0;
  if (n) addPods(s, contract.crop, n);
  return { crop: contract.crop, n };
}
