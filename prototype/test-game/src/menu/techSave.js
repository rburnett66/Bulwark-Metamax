/**
 * src/menu/techSave.js — the Tech Net on the REAL save [MM-story_mvkhed1f_h]. Menu-Progression-Design §1.
 *
 * Turns the campaign save into a data/techtree.js status context (bank = banked gold, owned = save.tech.owned +
 * the starting kit + Map 3 Victory once won) and gives the view a buy / refund adapter that moves the gold.
 * No DOM, no three.js: the save functions are passed in, so tests drive it with a fake save.
 */
import { TECH_BY_ID, startingOwned, settleFree, techStatus, techPrice, refundBlock, PORTALS } from '../data/techtree.js';
import { outpostUnlocks } from '../outpost/contract.js';
import { machineryUnlocked, cropLevelInfo, machineFor } from '../farm/levels.js';
import { podsUnlocked, cropDelivered, unlockUnits, unlockHint } from '../farm/unlock.js';
import { CROPS, cropOf, podLevel } from '../data/farm.js';

/**
 * The Outpost nodes the player's outpost contracts have unlocked, on any planet (Outpost-Design §7, story O10): a
 * collected contract step's `tech:<node>` Unlocks makes the node buyable (tech plan D7: a mission unlocks, gold buys).
 */
export function outpostTechUnlocked(s) {
  const out = new Set();
  for (const key of Object.keys((s && s.outposts) || {})) for (const t of outpostUnlocks(s, key).unlocks) out.add(t);
  // the farm machinery (owner rule 13, 2026-11-21): a crop mastered to a level unlocks that level's machine, gold buys it
  for (const t of machineryUnlocked(s)) out.add(t);
  return out;
}

/**
 * One crop as the tech tree's SEED PODS presents it (owner 2026-11-21: "The crop upgrades are presented in the tech
 * tree, and the tree can hint at how to unlock crops") [MM-story_mwpyr9zs_44]: unlocked or not and how to unlock it,
 * its level (mastery with machinery), its mastery toward the next level and the machine that level needs.
 */
export function cropInfo(s, id) {
  const c = cropOf(id) || { id, name: id };
  const L = cropLevelInfo(s, id, (m) => (TECH_BY_ID[m] || { name: m }).name), lv = podLevel(L.level) || { name: '', colour: '#ffffff' };
  const next = L.next ? { ...L.next, machine: machineFor(L.next.level), machineName: machineFor(L.next.level) ? (TECH_BY_ID[machineFor(L.next.level)] || {}).name : null } : null;
  return { id, name: c.name, unlocked: podsUnlocked(s, id), delivered: Math.min(cropDelivered(s, id), unlockUnits()), need: unlockUnits(),
    hint: unlockHint(id), level: L.level, levelName: lv.name, colour: lv.colour, mastered: L.mastered, why: L.why, next };
}

export const map3Won = (s) => !!((s.maps && s.maps[3] && s.maps[3].beaten) ||
  Object.values(s.factionRecords || {}).some((f) => f && f.mapsWon && f.mapsWon[3]));

/**
 * factionOfPlanet: planet name ('Florael') → the faction name factionRecords is keyed by.
 * opts.missionGate: nodes need a mission to unlock them before they can be bought (tech plan D7) [MM-story_mvzkdvrl_1l];
 * opts.unlockedBy(id) names that mission on the node's gate.
 */
export function techCtxFromSave(s, factionOfPlanet = (p) => p, opts = {}) {
  const owned = startingOwned();
  for (const [id, on] of Object.entries((s.tech && s.tech.owned) || {})) if (on && TECH_BY_ID[id]) owned.add(id);
  if (map3Won(s)) owned.add('map3');
  settleFree(owned);
  return {
    owned, bank: (s.carry && s.carry.gold) || 0, paid: (s.tech && s.tech.paid) || {},
    // SEED PODS shows each planet's crops unlocked (owner 2026-11-21, rule 10)
    cropsUnlocked: new Set(CROPS.filter((c) => podsUnlocked(s, c.id)).map((c) => c.id)),
    cropName: (id) => (cropOf(id) || { name: id }).name,
    cropInfo: (id) => cropInfo(s, id),
    cropProgress: (id) => Math.min(cropDelivered(s, id), unlockUnits()).toLocaleString('en-US') + ' / ' + unlockUnits().toLocaleString('en-US') + ' delivered',
    ...(opts.missionGate ? { unlocked: new Set([...Object.keys((s.tech && s.tech.unlocked) || {}), ...outpostTechUnlocked(s)]), unlockedBy: opts.unlockedBy || null } : {}),
    hasWin: (planet) => {
      const fr = s.factionRecords && s.factionRecords[factionOfPlanet(planet)];
      return !!(fr && fr.mapsWon && Object.values(fr.mapsWon).some(Boolean));
    },
  };
}

/** TESTING (owner 2026-10-25): "today they are all unlocked for testing". Every planet counts as open while this is
 *  true; set it false to gate planets by portal code (planetOpen below), with nothing else to change. The menu's
 *  `?planets=locked` shows the gated look without touching this. */
export const ALL_PLANETS_OPEN = true;

/**
 * Can the player campaign on this planet? The home planet (the one with no portal code — Verdance) always; every
 * other homeworld once its portal code is owned (Tech-Tree-Design §6). planetName: 'Florael'. ctx: techCtxFromSave.
 * opts.allOpen defaults to ALL_PLANETS_OPEN (the testing switch). [MM-story_mvoi0e36_3]
 */
export function planetOpen(ctx, planetName, { allOpen = ALL_PLANETS_OPEN } = {}) {
  if (allOpen) return true;
  const k = String(planetName || '').toLowerCase();
  if (!PORTALS.some(([key]) => key === k)) return true;
  return !!(ctx && ctx.owned && ctx.owned.has('portal_' + k));
}

/** The view adapter for the game menu. save = { loadSave, buyTech, refundTech }. */
export function createGameTechAdapter({ save, factionOfPlanet, onChange, onClose, ctxOpts }) {
  const ctx = () => techCtxFromSave(save.loadSave(), factionOfPlanet, ctxOpts);
  return {
    mode: 'game',
    ctx,
    buy(id) {
      const n = TECH_BY_ID[id], c = ctx();
      if (!n || n.milestone || techStatus(n, c) !== 'ready') return false;
      const ok = save.buyTech(id, techPrice(n, c));
      if (ok && onChange) onChange();
      return ok;
    },
    refund(id) {
      const n = TECH_BY_ID[id], why = n ? refundBlock(n, ctx()) : 'Unknown upgrade.';
      if (why) return why;
      save.refundTech(id);
      if (onChange) onChange();
      return '';
    },
    onClose,
  };
}
