/**
 * src/outpost/contract.js — the outpost contracts: granted aboard a planet's capital ship, run as Mission Log missions
 * (tech plan docs/tech-plan/Outpost.md §5, story O3) [MM-story_mw5oe8km_k].
 *
 * The three contracts per planet are mission rows (type 'outpost', quest line QL-<PLANET>-O) that
 * tools/extract_missions.py generates from the map-data workbook's Outpost_Contracts sheet. The Mission Log lists,
 * tracks and pays them like any mission. This module holds what is outpost-specific:
 *   - ACCEPT on the contract card (aboard, or later from the Mission Log) creates the outpost with the kit placed;
 *   - what the contract has unlocked so far (ore tiers and outpost techs), derived from the steps collected;
 *   - the save-side measures the missions read (online, ore sold, raids held).
 *
 * Pure: functions change only the save they are given. Wall-clock time is passed in.
 */
import { createOutpost, outpostSeed } from './model.js';
import { contractFor } from '../data/outpost.js';
import { oresOf } from '../data/ores.js';
import { PLANETS } from '../data/planets.js';

/** The outpost quest line id for a planet key: 'ground' → 'QL-VER-O' (the planet name's first three letters). */
export const outpostQuestLine = (key) => 'QL-' + String((PLANETS[key] || {}).name || key).slice(0, 3).toUpperCase() + '-O';
/** The mission id of a planet's contract step: 'ground', 1 → 'OC-VER-1'. */
export const outpostMissionId = (key, step) => 'OC-' + String((PLANETS[key] || {}).name || key).slice(0, 3).toUpperCase() + '-' + step;
/** The planet key of a planet name ('Verdance' → 'ground'). */
export const planetKeyOf = (name) => Object.keys(PLANETS).find((k) => PLANETS[k].name === name) || null;

/** How far a planet's contracts have come: the highest step collected (0 = none yet). */
export const contractsCollected = (s, key) => ((s.questSteps || {})[outpostQuestLine(key)] || 0);

/** Has the player accepted the outpost contract (the outpost exists)? */
export const hasOutpost = (s, key) => !!(s.outposts && s.outposts[key]);

/**
 * The first contract is on offer: the planet's contract 1 exists, the ship is in orbit, and no outpost yet.
 * Declining keeps it on offer (design §2.2: the gateway contract must not be lost).
 */
export function outpostOffer(s, key) {
  if (hasOutpost(s, key)) return null;
  const c = contractFor(key, 1);
  if (!c) return null;
  const ship = (s.capitalShips || {})[(PLANETS[key] || {}).name];   // capital ships are keyed by planet name
  return ship && ship.arrived ? c : null;
}

/**
 * ACCEPT: create the outpost with the kit on its default pads (not online until the player confirms it in the view,
 * design §2.3 step 1), and mark the contract active. Accepting twice changes nothing. → the outpost.
 */
export function acceptOutpostContract(s, key, { map, now, seedSalt = '' }) {
  if (!s.outposts) s.outposts = {};
  if (!s.outpostContracts) s.outpostContracts = {};
  if (s.outposts[key]) return s.outposts[key];
  s.outposts[key] = createOutpost(key, { seed: outpostSeed(seedSalt || String(now), key), map, now });
  s.outpostContracts[key] = { step: 1, state: 'active', since: now };
  return s.outposts[key];
}

/** DECLINE (later): the offer stays, in the Mission Log, with nothing granted. */
export function declineOutpostContract(s, key, { now }) {
  if (!s.outpostContracts) s.outpostContracts = {};
  if (hasOutpost(s, key)) return;
  s.outpostContracts[key] = { step: 1, state: 'offered', since: now };
}

/** A contract step was collected (missionFlow.collect): the next step becomes active. */
export function contractStepCollected(s, key, step, { now }) {
  if (!s.outpostContracts) s.outpostContracts = {};
  const next = contractFor(key, step + 1);
  s.outpostContracts[key] = next ? { step: step + 1, state: 'active', since: now } : { step, state: 'complete', since: now };
}

/**
 * What the collected contracts have unlocked: the ore tiers the rigs may work and the outpost techs (the model's
 * place / setDeep ctx). → { unlockedTiers: ['common', …], unlocks: Set<tech id>, farBuyer }.
 */
export function outpostUnlocks(s, key) {
  const tiers = ['common'], techs = new Set();
  let farBuyer = false;
  for (let k = 1; k <= contractsCollected(s, key); k++) {
    const c = contractFor(key, k);
    if (!c) break;
    for (const t of c.unlocks.ores) if (!tiers.includes(t)) tiers.push(t);
    for (const t of c.unlocks.techs) techs.add(t);
    farBuyer = farBuyer || c.unlocks.farBuyer;
  }
  return { unlockedTiers: tiers, unlocks: techs, farBuyer };
}

// ── the measures the outpost missions read (missions.js SAVE_MEASURE, missionFlow.js GATE) ─────────────────────────
/** 1 once the planet's outpost is ONLINE. */
export const measureOnline = (s, key) => (s.outposts && s.outposts[key] && s.outposts[key].online ? 1 : 0);
/** Units of an ore sold over the outpost's life (ore ids are unique across planets). */
export function measureOreSold(s, oreId) {
  let n = 0;
  for (const o of Object.values(s.outposts || {})) n += (o.sold && o.sold[oreId]) || 0;
  return Math.floor(n + 1e-9);
}
/** Raids the planet's outpost has held at or after `since` (ms). */
export function measureRaidsHeld(s, key, since = 0) {
  const o = s.outposts && s.outposts[key];
  if (!o || !o.raids) return 0;
  return o.raids.log.filter((r) => r.result === 'held' && r.at >= since).length;
}

/**
 * The contract card's words (design §2.3), for showContractModal: { kicker, task, terms, acceptLabel, declineLabel }.
 * Trusted HTML built from game data. ship: the capital ship's name.
 */
export function outpostCard(key, ship) {
  const c = contractFor(key, 1);
  if (!c) return null;
  const P = PLANETS[key] || {}, ore = oresOf(key).find((o) => o.tier === c.oreTier) || { name: c.oreTier + ' ore', price: 0 };
  const next = oresOf(key).filter((o) => c.unlocks.ores.includes(o.tier)).map((o) => o.name);
  const raids = c.raidsHeld === 1 ? 'Hold the outpost through a raid' : `Hold the outpost through ${c.raidsHeld} raids`;
  return {
    kicker: 'OUTPOST CONTRACT — ' + String(ship || '').toUpperCase(),
    task: `<b>${c.title}.</b> A hub, a power station, a mining rig and a storage tower on ${P.name || key}, with a cannon, a machine gun and a wall ring to guard them. Yours to run.`,
    terms: [
      `1 · Establish the outpost: every building on its pad and powered`,
      `2 · Deliver <b>${c.deliver.toLocaleString('en-US')} ${ore.name}</b> to ${ship} (${ore.price} gold each as it sells)`,
      c.raidsHeld ? `3 · ${raids}` : '',
      `Pays <b>${c.gold.toLocaleString('en-US')} gold</b>, <b>+${c.loyalty} loyalty</b>, ${c.xp} XP` + (next.length ? ` · unlocks <b>${next.join(', ')}</b>` + (c.unlocks.techs.includes('deep_drilling_1') ? ' and Deep Drilling I' : '') : ''),
    ].filter(Boolean).join('<br>'),
    acceptLabel: 'ACCEPT CONTRACT',
    declineLabel: 'LATER',
  };
}
