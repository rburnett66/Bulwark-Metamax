/**
 * src/farm/levels.js — a crop's level: its MASTERY, and the farm machinery owned [MM-story_mwatmww5_1l], [MM-story_mwatmy2u_1m].
 *
 * Owner rule 9 (2026-11-10): seed pods have no level; a crop's level is the player's, and a plot keeps the level it was
 * planted at (src/farm/model.js plant) until it is harvested. Rule 12: "Planting, harvesting and selling fruit from seed
 * pods increases the player's mastery of the pods allowing level 2–5 to be grown." Rule 13: level 3 needs fertilizer
 * (a Fertilizer Machine), 4 agrobots, 5 irrigation. Owner 2026-11-21: "We don't need to create a tree for the crop
 * upgrades, only the farm equipment." So:
 *   mastery   s.mastery[cropId], points: one per pod planted; harvests, sales and deliveries count as the plants that
 *             grew them (src/data/farm.js plantsFor). The thresholds are data (Crop_Levels, CROP_LEVEL_RULES), the same
 *             for every crop.
 *   machinery the MACHINERY nodes of the OUTPOST & FARM tree (s.tech.owned). Each unlocks once any crop's mastery
 *             reaches its level (machineryUnlocked), and gold buys it (rule D7).
 *   level     the highest level the crop's mastery has opened whose machine is owned. Level 5 also needs water at the
 *             plot (src/data/farm.js growLevel), as before.
 * Until fertilizer recipes are discovered in missions (E6), the Fertilizer Machine makes every crop's fertilizer.
 *
 * Pure: reads the save; the note* functions and migrateCropNodes write only the save they are given. No clock, no
 * randomness.
 */
import { CROPS, CROP_LEVEL_RULES, MAX_POD_LEVEL, cropOf, masteryFor, plantsFor } from '../data/farm.js';

const owned = (s) => (s && s.tech && s.tech.owned) || {};

/** The machines, level by level: [{ level, id }] (levels 3–5, from Crop_Levels.Machine). */
export const MACHINES = Object.freeze(CROP_LEVEL_RULES.filter((r) => r.machine).map((r) => Object.freeze({ level: r.level, id: r.machine })));
/** The machine a level needs, or null. */
export const machineFor = (level) => (MACHINES.find((m) => m.level === level) || {}).id || null;

/** A crop's mastery points so far. */
export const masteryOf = (s, cropId) => Math.max(0, +(((s && s.mastery) || {})[cropId]) || 0);

/** Add mastery points to a crop. → the points now. */
export function addMastery(s, cropId, points) {
  if (!s || !cropOf(cropId) || !(points > 0)) return masteryOf(s, cropId);
  if (!s.mastery || typeof s.mastery !== 'object') s.mastery = {};
  s.mastery[cropId] = masteryOf(s, cropId) + points;
  return s.mastery[cropId];
}
/** Pods planted: a point each. */
export const notePlanted = (s, cropId, pods) => addMastery(s, cropId, Math.floor(pods) || 0);
/** Units harvested, sold or delivered: the plants that grew them. */
export const noteGrown = (s, cropId, units) => addMastery(s, cropId, plantsFor(cropId, units));

/** The level a crop's mastery has opened, 1 … 5. */
export function masteryLevel(s, cropId) {
  const m = masteryOf(s, cropId);
  let L = 1;
  while (L < MAX_POD_LEVEL && m >= masteryFor(L + 1)) L++;
  return L;
}

/**
 * A crop's level now and what holds it: { level, mastered, capped, why, next }. level: what new plantings grow at
 * (before the plot's own water check); mastered: the level its mastery has opened; why: the missing machine's words;
 * next: { level, need, have } toward the next level by mastery, or null at the top.
 */
export function cropLevelInfo(s, cropId, machineName = (id) => id) {
  const mastered = masteryLevel(s, cropId), own = owned(s);
  let level = 1, why = null;
  for (let L = 2; L <= mastered; L++) {
    const mc = machineFor(L);
    if (mc && !own[mc]) { why = `level ${L} needs the ${machineName(mc)}`; break; }
    level = L;
  }
  const next = mastered < MAX_POD_LEVEL ? { level: mastered + 1, need: masteryFor(mastered + 1), have: masteryOf(s, cropId) } : null;
  return { level, mastered, capped: level < mastered, why, next };
}

/** A crop's level now, 1 … 5: what new plantings grow at. */
export const cropLevel = (s, cropId) => cropLevelInfo(s, cropId).level;

/** Every crop's level now: { [cropId]: 1 … 5 }. */
export function cropLevels(s) {
  const out = {};
  for (const c of CROPS) out[c.id] = cropLevel(s, c.id);
  return out;
}

/** The machines any crop's mastery has unlocked for purchase (rule D7: unlocked, then bought): a Set of node ids. */
export function machineryUnlocked(s) {
  const top = Math.max(1, ...CROPS.map((c) => masteryLevel(s, c.id)));
  return new Set(MACHINES.filter((m) => top >= m.level).map((m) => m.id));
}

/** The words a machine's gate shows: "A crop mastered to level 3". */
export const machineUnlockText = (id) => `A crop mastered to level ${(MACHINES.find((m) => m.id === id) || { level: '?' }).level}`;

const OLD_NODE = /^crop_([a-z0-9_]+)_([2-5])$/;
/**
 * Old saves bought crop levels in the tech tree (rule 9, retired 2026-11-21). Each owned crop node is refunded the
 * gold paid for it and the crop's mastery is raised to that level's threshold, so the player keeps the level they
 * reached (the machinery for level 3 and up still applies). Mutates s. → the gold refunded.
 */
export function migrateCropNodes(s) {
  const tech = s && s.tech;
  if (!tech || !tech.owned) return 0;
  let gold = 0;
  for (const id of Object.keys(tech.owned)) {
    const m = OLD_NODE.exec(id);
    if (!m) continue;
    const cropId = m[1].replace(/_/g, '-'), level = +m[2];
    if (tech.owned[id] && cropOf(cropId)) {
      const need = masteryFor(level);
      if (Number.isFinite(need) && masteryOf(s, cropId) < need) addMastery(s, cropId, need - masteryOf(s, cropId));
    }
    gold += Math.max(0, +((tech.paid || {})[id]) || 0);
    delete tech.owned[id];
    if (tech.paid) delete tech.paid[id];
    if (tech.unlocked) delete tech.unlocked[id];
  }
  if (gold) { if (!s.carry || typeof s.carry !== 'object') s.carry = {}; s.carry.gold = (+s.carry.gold || 0) + gold; }
  return gold;
}
