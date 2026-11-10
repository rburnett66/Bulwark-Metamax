/**
 * src/farm/levels.js — a crop's level, from the tech tree [MM-story_mwai5f8t_1g].
 *
 * Owner rule 9 (2026-11-10): "The player will only grow their most upgraded crop — so a player who has corn leveled to
 * 3 will always grow level 3 corn. But the game needs to remember the level with each crop, because I might have a plot
 * of level 2 and I upgrade to level 4 on tech tree. That will not apply to existing crops, only the ones I grow from
 * now on." So: seed pods have no level; a crop's level is the highest node of its chain the player owns in the
 * OUTPOST & FARM tree's SEED PODS division (src/data/farm.js CROP_LEVEL_NODES, the workbook's Crop_Levels); a plot
 * stores the level it was planted at (src/farm/model.js plant) and keeps it until it is harvested.
 *
 * Rule D7: a contract unlocks a node, gold buys it. cropTechUnlocked(s) names the nodes the farming contracts have
 * unlocked (II with F1 accepted on the crop's planet, III–V with F1 complete: proposed, until F2/F3 exist).
 *
 * Pure: reads the save, writes nothing. No clock, no randomness.
 */
import { CROPS, CROP_LEVEL_NODES, cropLevelChain } from '../data/farm.js';

const owned = (s) => (s && s.tech && s.tech.owned) || {};

/** A crop's level now, 1 … 5: the highest node of its chain owned, in order (a gap stops the climb). */
export function cropLevel(s, cropId) {
  const own = owned(s);
  let level = 1;
  for (const n of cropLevelChain(cropId)) {
    if (!own[n.id] || n.level !== level + 1) break;
    level = n.level;
  }
  return level;
}

/** Every crop's level now: { [cropId]: 1 … 5 }. */
export function cropLevels(s) {
  const out = {};
  for (const c of CROPS) out[c.id] = cropLevel(s, c.id);
  return out;
}

/** The next node of a crop's chain (the one to buy), or null at the top or for a crop with no chain yet. */
export function nextLevelNode(s, cropId) {
  const L = cropLevel(s, cropId);
  return cropLevelChain(cropId).find((n) => n.level === L + 1) || null;
}

/** Has a planet's farming contract reached a state? 'accepted' = taken on (active or complete); 'complete' = collected. */
function contractAt(s, planetKey, contract, state) {
  const fc = ((s && s.farmContracts) || {})[planetKey];
  if (!fc || fc.state === 'offered') return false;
  if ((fc.step || 1) > (+String(contract).slice(1) || 1)) return true;   // a later step means this one is behind
  return state === 'accepted' ? true : fc.state === 'complete';
}

/** The crop level nodes the farming contracts have unlocked (tech plan D7): a Set of node ids. */
export function cropTechUnlocked(s) {
  const out = new Set();
  for (const n of CROP_LEVEL_NODES) if (contractAt(s, n.planetKey, n.unlock.contract, n.unlock.state)) out.add(n.id);
  return out;
}

/** The words a node's gate shows: "Farming F1 on Verdance accepted". */
export function cropUnlockText(n, planetName) {
  return `Farming ${n.unlock.contract} on ${planetName} ${n.unlock.state === 'complete' ? 'complete' : 'accepted'}`;
}
