/**
 * src/outpost/view/resourceCard.js — the battle's resource card, filled with the outpost's own numbers, and the
 * outpost's words for a truck that is not driving [MM-task_mwd2qawq_3].
 *
 * Owner 2026-11-12: "the resource info on the outpost is wrong - generic" and "the harvester is not harvesting". A tap on
 * a surface field at the outpost opened the battle's card (render/resourceInfo.js) with battle numbers: gold a unit (an
 * outpost load is never sold), a Collective quota, "regrows when harvested". The battle card stays the one card and
 * renderer; the outpost supplies its content through the HUD's resourceInfo hook (render/hud.js), from the outpost
 * model's own data: the field's live stock and its regrowth (model.surfaceFieldGroups, the sim's nodes), the trucks on it
 * and why they wait (sim/harvest.js harvesterHold), what they bring in (model.harvestPlan rates), and the hopper.
 * A deposit (no rig on it: a rig is a structure, its tap selects it) gets the same card from data/ores.js and the model.
 * Pure: no DOM.
 */
import { surfaceFieldGroups, harvestPlan, hopperCap, hopperUnits, buildingRect, depositAt, rigRatePerMin, bayCapacity, powerGrids } from '../model.js';
import { harvesterHold } from '../../sim/harvest.js';
import { oresOf } from '../../data/ores.js';
import { structureDef } from '../../data/outpost.js';
import { fmtClock, fmtRate, fmtUnits, ROMAN } from './hudModel.js';

const HOUR = 3_600_000;
const TIER_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const perHour = (unitsPerMs) => `${+(unitsPerMs * HOUR).toFixed(unitsPerMs * HOUR >= 10 ? 0 : 1)} / h`;

/** A truck's hold (sim/harvest.js harvesterHold) in the outpost's words, or null when it is working. */
export function harvesterHoldText(hold) {
  if (!hold) return null;
  if (hold.why === 'parked') return 'Parked: the Resource Bay has no power';
  if (hold.why === 'full') return 'Hopper full: it empties into your inventory when you next open the outpost';
  if (hold.why === 'regrowing') return 'Waiting: field regrowing' + (hold.inSec != null ? ` · next unit in ${fmtClock(hold.inSec)}` : '');
  return null;
}

/** The deposit id the outpost's ground tap gives the card: 'deposit:<tier>'. */
export const depositCardId = (tier) => `deposit:${tier}`;

/**
 * The card for `id` at the outpost: render/hud.js resourceInfo(id, state, card). card: the battle's model for a sim
 * resource node (resourceInfoModel), null otherwise. ctx: { outpost (the save shape now), map, planet, unlockedTiers? }.
 * → the card model (resourceInfoHtml's shape, with its own `rows`), null to close it, undefined to keep the battle's.
 */
export function outpostResourceCard(id, state, card, { outpost, map, planet, unlockedTiers = null }) {
  if (typeof id === 'string' && id.startsWith('deposit:')) return depositCard(id.slice(8), { outpost, map, planet, unlockedTiers });
  if (!card) return null;
  const node = (state.resourceNodes || []).find((n) => n.id === id);
  const f = node && surfaceFieldGroups(map).find((g) => g.id === node.fieldId);
  if (!f) return undefined;   // not one of the outpost's surface fields: the battle's card as it is
  const trucks = (state.harvesterIds || []).map((h) => state.units.get(h)).filter((u) => u && u.hp > 0 && u.fieldId === f.id);
  const plan = harvestPlan(outpost, map).filter((h) => h.fieldId === f.id);
  const left = card.left, rows = [];
  rows.push(['Field', `${fmtUnits(left)} of ${fmtUnits(f.cap)} left · ${f.cells.length} cell${f.cells.length === 1 ? '' : 's'}`]);
  const toFull = left < f.cap - 1e-9 && f.regrow > 0 ? (f.cap - left) / f.regrow / 1000 : 0;
  rows.push(['Regrows', `${perHour(f.regrow)}` + (toFull > 0 ? ` · full in ${fmtClock(toFull)}` : ' · full')]);
  if (trucks.length) {
    const why = trucks.map((u) => harvesterHoldText(harvesterHold(state, u))).find(Boolean);
    rows.push(['Harvesters', `${trucks.length} on it` + (why ? ` · ${why}` : ' · working')]);
    const take = plan.reduce((a, h) => a + h.rate, 0);
    rows.push(['Brings in', left >= 1 ? `${perHour(take)} while it has stock` : `${perHour(Math.min(take, f.regrow))} (what regrows)`]);
  } else {
    rows.push(['Harvesters', (outpost.harvesters || 0) > 0 ? 'none — your harvesters work nearer fields' : 'none — buy one for the Resource Bay']);
  }
  const room = Math.max(0, hopperCap(outpost, map) - hopperUnits(outpost));
  if ((outpost.harvesters || 0) > 0) rows.push(['Hopper', `${fmtUnits(hopperUnits(outpost))} / ${fmtUnits(hopperCap(outpost, map))}` + (room < 1 ? ' · full' : '')]);
  return { ...card, contract: null, valuePerUnit: 0, harvesters: trucks.length, total: f.cap, regrowIn: toFull || null,
    roleLabel: 'Surface field — your harvesters gather it into the Resource Bay\'s hopper; it regrows slowly', rows };
}

/** The card for an unbuilt deposit of `tier`: its ore, price, whether its tier is open, and the rig on it (if any). */
function depositCard(tier, { outpost, map, planet, unlockedTiers }) {
  const ore = oresOf(planet).find((x) => x.tier === tier);
  if (!ore) return null;
  const rigPad = Object.keys(outpost.pads).find((id) => outpost.pads[id].kind === 'rig' && (outpost.pads[id].deposit || depositAt(map, buildingRect(outpost, map, id))) === tier);
  const rows = [['Ore', `${ore.name} · ${TIER_LABEL[tier] || tier} deposit`],
    ['Price', `${ore.price} gold a unit · deep seam ${ore.deepPrice}× the price at ${ore.deepRate}× the speed`]];
  if (unlockedTiers && !unlockedTiers.includes(tier)) rows.push(['Status', 'Locked · an outpost contract opens this ore']);
  if (rigPad) {
    const b = outpost.pads[rigPad], on = powerGrids(outpost, map).powered.has(rigPad);
    rows.push(['Mining Station', `${ROMAN[b.tier]} · ${on ? fmtRate(rigRatePerMin(outpost, rigPad)) : 'stopped: no power'}`]);
    const bay = Object.values(outpost.storage[rigPad] || {}).reduce((a, u) => a + u, 0);
    rows.push(['Bay', `${fmtUnits(bay)} / ${fmtUnits(bayCapacity(outpost, rigPad, map))}`]);
  } else {
    rows.push(['Mining Station', `none — build one on it (${fmtRate(ore.rate * (structureDef('rig', 1) || { rateMult: 1 }).rateMult)} at tier I)`]);
  }
  return { id: depositCardId(tier), tier, tierLabel: TIER_LABEL[tier] || tier, color: ore.colour || '#c8a060', name: ore.name, iconId: null,
    note: ore.use || '', planet: null, role: 'deposit', roleLabel: 'Ore deposit — a Mining Station on it mines into its own bay; the hub ships full loads',
    revealed: true, rows };
}
