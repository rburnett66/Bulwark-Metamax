/**
 * src/farm/contract.js — the farming gate and the farming contracts [MM-story_mwabgpsa_e].
 *
 * Built the way the outpost contracts are (src/outpost/contract.js), not beside them (owner rule 7): a farming contract
 * is a Mission Log mission (type 'farm', quest line QL-<PLA>-F) that tools/extract_missions.py generates from the
 * map-data workbook's Farm_Contracts sheet; the Mission Log lists, tracks and pays it like any mission. It is offered in
 * person by the planet faction's Factor at the Trade Station aboard its capital ship (farm/factor.js)
 * [MM-story_mwcuzyf7_3k] — the one way to take it.
 *
 * The gate (owner, 2026-11-09, Farming-Design §2.2, D41/D46): farming opens on a planet when that planet's outpost has
 * a finished Mining Rig Mk II. F1 then appears at the Factor's desk. ACCEPT grants the Farmhouse (placed on free
 * ground near the outpost's hub) and the Pod Crate.
 *
 * Pure: functions change only the save they are given. Wall-clock time is passed in.
 */
import { PLANETS } from '../data/planets.js';
import { farmContractOf, cropOf, farmBuildingOf, methodOf } from '../data/farm.js';
import { ensureFarm, occupied, placeFarmBuilding, plotState } from './model.js';
import { grantPodCrate } from './pods.js';

const nameOf = (key) => (PLANETS[key] || {}).name || key;
/** The farming quest line of a planet key: 'ground' → 'QL-VER-F'. */
export const farmQuestLine = (key) => 'QL-' + String(nameOf(key)).slice(0, 3).toUpperCase() + '-F';
/** The mission id of a planet's farming contract step: 'ground', 1 → 'FC-VER-1'. */
export const farmMissionId = (key, step) => 'FC-' + String(nameOf(key)).slice(0, 3).toUpperCase() + '-' + step;

/** Farming is open on a planet once its outpost has a finished Mining Rig Mk II (the outpost's level-2 miner). */
export function farmingOpen(s, key) {
  const o = s.outposts && s.outposts[key];
  return !!o && Object.values(o.pads || {}).some((b) => b.kind === 'rig' && b.tier >= 2);
}
/** Has the player accepted a farming contract on this planet (the farm exists)? */
export const hasFarm = (s, key) => !!(s.farmContracts && s.farmContracts[key] && s.farmContracts[key].state !== 'offered');

/** F1 is on offer: farming is open, the planet's ship is in orbit, F1 exists, and no farm yet. Declining keeps it on offer. */
export function farmOffer(s, key) {
  if (hasFarm(s, key) || !farmingOpen(s, key)) return null;
  const c = farmContractOf(key, 'F1');
  if (!c) return null;
  const ship = (s.capitalShips || {})[nameOf(key)];
  return ship && ship.arrived ? c : null;
}

/** Free ground for a w × h building nearest the outpost's hub (the Farmhouse "at the mesa's foot"). */
export function spotNearHub(o, map, w, h, cellOk = null) {
  const hub = map.hub || { x: map.width / 2, y: map.height / 2, w: 0, h: 0 };   // the landing pad (S2c.2: no map pads)
  const c = [hub.x + hub.w / 2, hub.y + hub.h / 2], taken = occupied(o, map);
  let best = null;
  for (let y = 0; y + h <= map.height; y++) {
    for (let x = 0; x + w <= map.width; x++) {
      const r = { x, y, w, h };
      if (taken.some((t) => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h)) continue;
      if (cellOk && cellOk(r)) continue;
      const d = Math.hypot(x + w / 2 - c[0], y + h / 2 - c[1]);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * ACCEPT F1: the farm is created on the outpost, the Farmhouse is placed near the hub (built over its Build_Sec), the
 * Pod Crate lands in the pods, and the contract is active. Accepting twice changes nothing. ctx: { map, now, cellOk? }.
 * → { farmhouse: id, crate: { crop, n } } or { error }
 */
export function acceptFarmContract(s, key, { map, now, cellOk = null }) {
  if (hasFarm(s, key)) return { error: 'already accepted' };
  if (!farmingOpen(s, key)) return { error: 'farming opens with a Mining Rig Mk II' };
  const c = farmContractOf(key, 'F1');
  if (!c) return { error: `no farming contract on ${nameOf(key)}` };
  const o = s.outposts[key];
  ensureFarm(o);
  const fh = farmBuildingOf('farmhouse'), at = spotNearHub(o, map, fh.w, fh.h, cellOk);
  if (!at) return { error: 'no free ground for the Farmhouse' };
  const r = placeFarmBuilding(o, { kind: 'farmhouse', ...at }, { map, now, grant: true, cellOk });
  if (r.error) return { error: r.error };
  s.outposts[key] = r.outpost;
  const crate = grantPodCrate(s, c);
  if (!s.farmContracts) s.farmContracts = {};
  s.farmContracts[key] = { step: 1, state: 'active', since: now, delivered: {} };
  return { farmhouse: r.id, crate };
}

/** DECLINE (later): the offer stays, with nothing granted. */
export function declineFarmContract(s, key, { now }) {
  if (!s.farmContracts) s.farmContracts = {};
  if (hasFarm(s, key)) return;
  s.farmContracts[key] = { step: 1, state: 'offered', since: now, delivered: {} };
}

/** A farming contract step was collected (missionFlow.collect): the contract is complete (Phase A ships F1 only). */
export function farmStepCollected(s, key, step, { now }) {
  if (!s.farmContracts) s.farmContracts = {};
  const prev = s.farmContracts[key] || { delivered: {} };
  s.farmContracts[key] = { ...prev, step, state: 'complete', since: now, collected: step };
}

/**
 * What the farming contracts have unlocked: the methods the player may build (Traditional always, Irrigated with F1),
 * the SEED PODS tab, and the techs named (Sprinklers; bought in the OUTPOST & FARM tree). F1's unlocks apply on
 * ACCEPT, not on collect: its own steps need them (the FARM button to play it, Irrigated for "grow two ways").
 * → { methods: [...], seedPods: bool, techs: Set, accepted }
 */
export function farmUnlocks(s, key) {
  const fc = (s.farmContracts || {})[key];
  const methods = ['traditional'], techs = new Set();
  let seedPods = false;
  // the methods learned anywhere work on every farmed planet (Distribution §5.1): every accepted contract counts
  for (const [k, v] of Object.entries(s.farmContracts || {})) {
    if (!v || v.state === 'offered') continue;
    const c = farmContractOf(k, 'F1');
    for (const u of (c && c.unlocks) || []) {
      if (u.startsWith('method:') && methodOf(u.slice(7)) && !methods.includes(u.slice(7))) methods.push(u.slice(7));
      if (u.startsWith('tech:')) techs.add(u.slice(5));
      if (u === 'tab:seedpods') seedPods = true;
    }
  }
  return { methods, seedPods, techs, accepted: !!fc && fc.state !== 'offered' };
}

// ── the measures the farming missions read (missions.js SAVE_MEASURE, missionFlow.js GATE) ──────────────────────────
/** Traditional plots on the planet's farm that have been planted at least once (F1 "Break ground"). */
export function measureFarmPlanted(s, key) {
  const f = s.outposts && s.outposts[key] && s.outposts[key].farm;
  if (!f) return 0;
  return Object.values(f.plots).filter((p) => p.method === 'traditional' && p.cycle >= 1).length;
}
/** Units of a crop delivered to the ships over the farm's life. */
export function measureCropDelivered(s, cropId) {
  let n = 0;
  for (const c of Object.values(s.farmContracts || {})) n += (c && c.delivered && c.delivered[cropId]) || 0;
  return n;
}
/** How many different methods have something growing (or ripe) on the planet's farm right now. */
export function measureMethodsGrowing(s, key) {
  const o = s.outposts && s.outposts[key];
  if (!o || !o.farm) return 0;
  const live = new Set();
  for (const p of Object.values(o.farm.plots)) {
    const st = plotState(o, p);
    if (st === 'planted' || st === 'sprout' || st === 'plant' || st === 'fruited') live.add(p.method);
  }
  return live.size;
}
/** Record a delivery to the ship (the FARM tab takes the units from the farm store first). */
export function recordDelivery(s, key, cropId, units) {
  if (!cropOf(cropId) || !(units > 0)) return 0;
  if (!s.farmContracts) s.farmContracts = {};
  const c = (s.farmContracts[key] ||= { step: 1, state: 'active', since: 0, delivered: {} });
  c.delivered ||= {};
  c.delivered[cropId] = (c.delivered[cropId] || 0) + units;
  return c.delivered[cropId];
}

/**
 * The contract card's words for showContractModal (as outpostCard; the Factor hands it over: factor.js factorCard):
 * { kicker, task, terms, acceptLabel, declineLabel }. Trusted HTML from game data. ship: the capital ship's name.
 */
export function farmCard(key, ship) {
  const c = farmContractOf(key, 'F1');
  if (!c) return null;
  const crop = cropOf(c.crop), P = nameOf(key);
  return {
    kicker: 'FARMING CONTRACT — ' + String(ship || '').toUpperCase(),
    task: `<b>${c.title}.</b> The regiments need bread. The contract grants you a <b>Farmhouse</b> beside your ${P} outpost and a <b>Pod Crate</b> of ${c.podCrate} ${crop.name} seed pods. Work the land your outpost leaves free.`,
    terms: [
      `1 · Break ground: prep ${c.plantPlots} Traditional plots and plant them`,
      `2 · Bring in a harvest: deliver <b>${c.deliver} ${crop.name}</b> to ${ship}`,
      `3 · Grow two ways: have ${c.methodsAtOnce} methods growing at once`,
      `Pays <b>${c.gold.toLocaleString('en-US')} gold</b>, <b>+${c.loyalty} loyalty</b>, ${c.xp} XP · unlocks <b>the FARM button, SEED PODS and Irrigated plots</b>`,
    ].join('<br>'),
    acceptLabel: 'ACCEPT CONTRACT',
    declineLabel: 'LATER',
  };
}
