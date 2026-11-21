/**
 * src/farm/unlock.js — a crop's seed pods unlock once enough of it is delivered (owner rule 10, 2026-11-10)
 * [MM-story_mwatmukb_1j].
 *
 * *"After I have collected and sold 500 units of a crop I unlock the crop's seed pods. This unlock grants you access to
 * the pods, but you still need to acquire the actual pods."* Every unit of the crop delivered counts (owner answer):
 * the units a battle banks at its end (the Collective's quota and the surplus alike, as save/inventory.js bankHarvest
 * banks them) and every farm sale or delivery to a ship. At FARM.Pod_Unlock_Units (500) the crop's pods unlock,
 * galaxy-wide and for good. Until then its pods cannot be bought, dropped or planted.
 *
 * Save (save.js defaults and migrates): s.cropDelivered = { [cropId]: units } (the lifetime count) and
 * s.podUnlocks = { [cropId]: true } (the unlocked crops). A crop is also unlocked by a grant (the F1 Pod Crate's crop,
 * so the crate's pods can be planted) and, on load, for a crop an older save already holds pods of or has planted.
 *
 * Pure: no DOM, no clock, no randomness. A crop id is the battle resource's catalogue id (src/data/farm.js CROPS).
 */
import { FARM, cropOf, cropsOf } from '../data/farm.js';

/** Units of a crop to deliver before its pods unlock (proposed 500, owner rule 10). */
export const unlockUnits = () => (Number.isFinite(FARM.Pod_Unlock_Units) ? FARM.Pod_Unlock_Units : 500);

/** Units of a crop delivered so far, lifetime. */
export const cropDelivered = (s, cropId) => Math.max(0, +(((s && s.cropDelivered) || {})[cropId]) || 0);

/** Are a crop's seed pods unlocked? */
export const podsUnlocked = (s, cropId) => !!(((s && s.podUnlocks) || {})[cropId]) || cropDelivered(s, cropId) >= unlockUnits();

/** Unlock a crop's pods outright (a grant: the F1 Pod Crate). → true when this call unlocked it. */
export function unlockPods(s, cropId) {
  if (!cropOf(cropId) || podsUnlocked(s, cropId)) return false;
  if (!s.podUnlocks || typeof s.podUnlocks !== 'object') s.podUnlocks = {};
  s.podUnlocks[cropId] = true;
  return true;
}

/**
 * Count delivered units: { [cropId]: units } (ids that are not crops are skipped, as is anything not a positive
 * number). → the crops this delivery unlocked, in the order given.
 */
export function recordDelivered(s, units) {
  const unlocked = [];
  if (!units) return unlocked;
  if (!s.cropDelivered || typeof s.cropDelivered !== 'object') s.cropDelivered = {};
  for (const [id, n] of Object.entries(units)) {
    if (!cropOf(id) || !(n > 0)) continue;
    const was = podsUnlocked(s, id);
    s.cropDelivered[id] = cropDelivered(s, id) + Math.floor(n);
    if (!was && podsUnlocked(s, id)) {
      if (!s.podUnlocks || typeof s.podUnlocks !== 'object') s.podUnlocks = {};
      s.podUnlocks[id] = true;
      unlocked.push(id);
    }
  }
  return unlocked;
}

/**
 * A battle's delivery as crops: every unit the harvesters carried home, by tier ({ common, uncommon, rare, epic }: the
 * tally's `harvested`, the quota and the surplus alike; owner answer), as { [cropId]: units } of the planet's crops. A
 * tier whose crop is a farm-only new material (Helium-4) delivers nothing: the battle carried Helium-3 (owner rule 1).
 */
export function battleDelivery(planet, byTier) {
  const out = {};
  if (!planet || !byTier) return out;
  const crops = cropsOf(planet);
  for (const [tier, n] of Object.entries(byTier)) {
    const c = crops.find((x) => x.tier === tier);
    if (c && !c.newMaterial && n > 0) out[c.id] = (out[c.id] || 0) + Math.floor(n);
  }
  return out;
}

/** Progress toward a crop's unlock, for the SEED PODS tab: { delivered, need, open }. */
export function unlockProgress(s, cropId) {
  const need = unlockUnits(), delivered = cropDelivered(s, cropId);
  return { delivered, need, open: podsUnlocked(s, cropId) };
}

/**
 * How to unlock a crop's pods, in the player's words (owner 2026-11-21: "the tree can hint at how to unlock crops")
 * [MM-story_mwpyr9zs_44]. A battle crop: harvest it on its planet's maps (its tier names which deposit), and farm sales
 * count too. A farm-only new material (Helium-4): no battle carries it, so its pods come from a farming contract.
 */
export function unlockHint(cropId) {
  const c = cropOf(cropId);
  if (!c) return '';
  if (c.newMaterial) return `${c.name} is a farm-only material: ${c.planet}'s battles carry a different one, so its first pods will come from a farming contract.`;
  return `Deliver ${unlockUnits().toLocaleString('en-US')} ${c.name}, the ${c.tier} resource on ${c.planet}'s maps: every unit your harvesters bring home counts, and every farm sale or delivery.`;
}
