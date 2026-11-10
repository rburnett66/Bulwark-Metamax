/**
 * src/farm/chest.js — the Pod Reward Chest: how seed pods drop (owner rule 11, 2026-11-10) [MM-story_mwatmvpt_1k].
 *
 * *"At the end of delivering a resource contract (full map) at any star level I am granted a Pod Reward Chest … one
 * actual seed pod for every 100 resources delivered. These resources accrue between battles, so 50 resources from one
 * map, and 50 resources from another will drop 1 seed pod."* And: *"the chest is the delivery mechanism for the pod
 * drops."* So a battle never adds pods to the stock directly: its pods go into a chest, held until the player opens it.
 *
 * - Every unit of a crop delivered at a map's end (src/farm/unlock.js battleDelivery: the quota and the surplus) adds
 *   to that crop's carry, s.podCarry[cropId], once the crop's pods are unlocked (owner answer: counting starts at the
 *   unlock). On the map that crosses the unlock, only the units past it count.
 * - A WON map (any stars) turns every full FARM.Chest_Units_Per_Pod (100) of each carry into pods and grants one chest
 *   holding them; the rest of each carry waits for the next map. A lost map adds to the carry and grants nothing.
 *   A chest that would hold no pods is not granted.
 * - Chests are held in s.podChests (oldest first) until opened (Pirate Bash's sequence: granted at the result, held,
 *   tapped open, the pods revealed one card at a time: src/menu/podChest.js). openChest puts its pods into s.pods.
 *
 * Pure: no DOM, no clock (the caller passes `at`), no randomness: a chest's contents are fixed when it is granted.
 */
import { FARM, cropOf } from '../data/farm.js';
import { addPods } from './pods.js';
import { podsUnlocked, recordDelivered, cropDelivered, unlockUnits } from './unlock.js';

/** Delivered units per pod (proposed 100, owner rule 11), every crop tier alike. */
export const unitsPerPod = () => (Number.isFinite(FARM.Chest_Units_Per_Pod) && FARM.Chest_Units_Per_Pod > 0 ? FARM.Chest_Units_Per_Pod : 100);

/** The chests waiting to be opened, oldest first. */
export const chestsHeld = (s) => (Array.isArray(s && s.podChests) ? s.podChests : []);

/** Pods inside a chest, all crops. */
export const chestPodCount = (chest) => Object.values((chest && chest.pods) || {}).reduce((a, n) => a + n, 0);

function carryOf(s) {
  if (!s.podCarry || typeof s.podCarry !== 'object') s.podCarry = {};
  return s.podCarry;
}

/**
 * Record a map's delivery ({ [cropId]: units }) toward the unlocks and the chest carry. → { unlocked: [cropId],
 * counted: { [cropId]: units } } — counted is what went into the carry (an unlocked crop's units; on the crossing
 * map, those past the unlock).
 */
export function deliver(s, delivery) {
  const was = {};
  for (const id of Object.keys(delivery || {})) was[id] = podsUnlocked(s, id);
  const unlocked = recordDelivered(s, delivery);
  const counted = {}, carry = carryOf(s);
  for (const [id, n] of Object.entries(delivery || {})) {
    if (!cropOf(id) || !(n > 0)) continue;
    const units = was[id] ? Math.floor(n) : podsUnlocked(s, id) ? Math.max(0, Math.min(Math.floor(n), cropDelivered(s, id) - unlockUnits())) : 0;
    if (!units) continue;
    counted[id] = units;
    carry[id] = (carry[id] || 0) + units;
  }
  return { unlocked, counted };
}

/** Turn every full unitsPerPod() of each carry into pods (the rest stays). → { [cropId]: pods }. */
export function takeChestPods(s) {
  const per = unitsPerPod(), carry = carryOf(s), out = {};
  for (const id of Object.keys(carry)) {
    const units = Math.floor(carry[id]) || 0, n = Math.floor(units / per), rest = units - n * per;
    if (n) out[id] = n;
    if (rest > 0) carry[id] = rest;
    else delete carry[id];
  }
  return out;
}

/**
 * The end of a map: its delivery, and on a win the chest. ({ planet, mapId, result, at }) → { unlocked, counted,
 * chest } — chest is the granted chest ({ id, planet, mapId, at, pods }) or null.
 */
export function settleChest(s, delivery, { planet = null, mapId = null, result = null, at = 0 } = {}) {
  const { unlocked, counted } = deliver(s, delivery);
  let chest = null;
  if (result === 'win') {
    const pods = takeChestPods(s);
    if (Object.keys(pods).length) {
      if (!Array.isArray(s.podChests)) s.podChests = [];
      if (!Number.isInteger(s.podChestSeq)) s.podChestSeq = 0;
      s.podChestSeq += 1;
      chest = { id: 'pc' + s.podChestSeq, planet, mapId, at, pods };
      s.podChests.push(chest);
    }
  }
  return { unlocked, counted, chest };
}

/**
 * Open a held chest: its pods go into the stock, the chest is gone. → { id, pods, draws: [{ crop, n }] } (draws in the
 * order the cards are revealed: the chest's own order) or null when no such chest is held.
 */
export function openChest(s, id) {
  const list = chestsHeld(s), i = list.findIndex((c) => c && c.id === id);
  if (i < 0) return null;
  const chest = list[i], draws = [];
  for (const [crop, n] of Object.entries(chest.pods || {})) {
    if (!cropOf(crop) || !(n > 0)) continue;
    addPods(s, crop, n);
    draws.push({ crop, n });
  }
  s.podChests = list.filter((_, j) => j !== i);
  return { id: chest.id, pods: { ...chest.pods }, draws };
}
