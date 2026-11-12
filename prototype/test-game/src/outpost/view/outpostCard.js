/**
 * src/outpost/view/outpostCard.js — what the outpost's HUD shows, as HudCard and top-bar readout models
 * [MM-story_mwcuyrqr_3j].
 *
 * Spec docs/16 Bulwark MM/design/Outpost-AAA-UX.md §1 (D2, D4), §2 (D3, D10), §8. Owner 2026-11-12, on the old panel
 * ("Online", "Threat: size 17 · 7 raids/day", "Storage 10 / 720 · 0 loads ready", SELL, LEAVE): "we still need a AAA
 * quality design for the resource gathering and outpost header. This info panel looks very placeholder."
 *
 * The outpost draws no panel of its own: these are DATA for the battle HUD's shared pieces —
 *   - outpostReadouts → hud.setReadouts (render/hud.js): status (ONLINE / OFFLINE / RAID m:ss), ⚡ power, ▣ storage, ☠ threat;
 *     during a raid the battle's own "⚔ n left" readout speaks and the status chip steps aside;
 *   - outpostCardModel → a HudCard (render/hudCard.js): title + status, GATHERING (per ore and surface resource: icon,
 *     stored units, rate an hour, a mini bar), the harvesters working / waiting, the storage and hopper gauges, then
 *     GO ONLINE · S SELL · R REPAIR ALL;
 *   - farmCardModel → the same HudCard for a selected plot or farm building (farm/view/farmUi.js farmPanelModel).
 * Every number comes from the outpost model the save and the live visit share (model.js rigExtraction — the rule
 * liveSim.js stepLiveOutpost mines by —, harvestPlan / surfaceFieldGroups / fieldStock, hopperCap / hopperUnits,
 * hudModel's storage, power, loads and threat). Nothing here shows progress toward a pod or the Pod Reward Chest.
 * Pure: no DOM.
 */
import { rigExtraction, bayCapacity, harvestPlan, surfaceFieldGroups, fieldStock, hopperCap, hopperUnits, resourceBayPad, powerGrids, depositAt, buildingRect } from '../model.js';
import { oresOf, oreById } from '../../data/ores.js';
import { PLANETS } from '../../data/planets.js';
import { resourceId } from '../../data/resourceIcons.js';
import { harvesterHold } from '../../sim/harvest.js';
import { hudModel, sellButton, fmtGold, fmtUnits, fmtClock } from './hudModel.js';

const HOUR = 3_600_000;
const SURFACE_COLOUR = { common: '#5fb8ff', uncommon: '#ffd34a' };   // the battle's blue / yellow crystals (awayReport.js)

/** Units an hour → "+12/h", "+0.4/h"; 0 → ''. */
export const fmtPerHour = (perHour) => (perHour > 0 ? `+${+perHour.toFixed(perHour >= 10 ? 0 : 1)}/h` : '');

/** A fill fraction's tone: warn from 90 %, bad when full. */
const fillTone = (f) => (f >= 1 - 1e-9 ? 'bad' : f >= 0.9 ? 'warn' : null);

/**
 * The GATHERING rows. o: the outpost now (the save shape: fromLiveSim at the visit's clock); map; planet.
 * → [{ id, kind: 'ore' | 'surface', name, icon, colour, units (stored), perHour, full, pct }] — the planet's ores that have
 * a Mining Station or ore in storage, then the surface resources the harvesters bring in (when there are harvesters or
 * anything in the hopper).
 */
export function gatheringRows(o, map, planet = o.planet) {
  const rows = [];
  const rigs = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig');
  // what each running rig mines now (units / ms), its bay's room taken into account — the live visit's own rule
  const running = new Map();
  for (const r of rigExtraction(o, map, 1)) { const ore = oreById(r.item); if (ore) running.set(ore.id, (running.get(ore.id) || 0) + r.rate); }
  const stored = new Map(hudModel(o, map).ores.map((x) => [x.id, x.units]));
  for (const ore of oresOf(planet)) {
    const mine = rigs.filter((id) => oreOf(o, map, id) === ore.id);
    const units = stored.get(ore.id) || 0;
    if (!mine.length && !(units > 0)) continue;
    const cap = mine.reduce((a, id) => a + bayCapacity(o, id, map), 0);
    const perHour = (running.get(ore.id) || 0) * HOUR;
    rows.push({ id: ore.id, kind: 'ore', name: ore.name, icon: null, colour: ore.colour || '#c8a060', units, perHour,
      full: mine.length > 0 && cap > 0 && units >= cap - 1e-6, pct: cap > 0 ? Math.min(1, units / cap) : 0, rigs: mine.length });
  }
  const hop = o.hopper || {}, trucks = o.harvesters || 0;
  if (trucks > 0 || hopperUnits(o) > 0) {
    const names = (PLANETS[planet] || {}).resources || {};
    const plan = harvestPlan(o, map), stock = fieldStock(o, map), groups = new Map(surfaceFieldGroups(map).map((f) => [f.id, f]));
    const bay = resourceBayPad(o), powered = !!bay && powerGrids(o, map).powered.has(bay);
    const hCap = hopperCap(o, map), room = hCap - hopperUnits(o);
    // a field with stock gives the trucks' rate; a bare one only what regrows (model.steadyHarvest's rule)
    const demand = {};
    for (const h of plan) demand[h.fieldId] = (demand[h.fieldId] || 0) + h.rate;
    const perTier = { common: 0, uncommon: 0 };
    for (const [id, d] of Object.entries(demand)) { const f = groups.get(id); perTier[f.tier] += (stock[id] >= 1 ? d : Math.min(d, f.regrow)); }
    for (const tier of ['common', 'uncommon']) {
      const units = hop[tier] || 0;
      if (!plan.some((h) => h.tier === tier) && !(units > 0)) continue;
      const name = (names[tier] && names[tier].name) || `${tier} surface resource`;
      const perHour = powered && room >= 1 ? perTier[tier] * HOUR : 0;
      rows.push({ id: tier, kind: 'surface', name, icon: names[tier] ? resourceId(names[tier].name) : null, colour: SURFACE_COLOUR[tier], units, perHour,
        full: room < 1, pct: hCap > 0 ? Math.min(1, units / hCap) : 0, parked: !powered });
    }
  }
  return rows;
}
/** The ore a rig pad mines (its deposit's ore id, as hudModel.rigHeadOf reads it), or null. */
function oreOf(o, map, padId) {
  const b = o.pads[padId];
  const tier = b && (b.deposit || depositAt(map, buildingRect(o, map, padId)));
  const ore = tier ? oresOf(o.planet).find((x) => x.tier === tier) : null;
  return ore ? ore.id : null;
}

/** The live visit's trucks: { total, working, waiting, why } (sim/harvest.js harvesterHold for a truck that waits). */
export function harvesterCounts(state) {
  const out = { total: 0, working: 0, waiting: 0, why: null };
  if (!state || !state.units) return out;
  for (const id of state.harvesterIds || []) {
    const u = state.units.get(id);
    if (!u || !(u.hp > 0)) continue;
    out.total++;
    const hold = harvesterHold(state, u);
    if (hold) { out.waiting++; out.why = out.why || hold.why; } else out.working++;
  }
  return out;
}
const WAIT_WORD = { parked: 'no power', full: 'hopper full', regrowing: 'field regrowing' };

/**
 * The outpost card (a HudCard model). o: the outpost now; ctx: { planet, gold, now, live (the visit's SimState, for the
 * trucks), issues (onlineIssues), gate (what opens farming, or null), repairCost (session.js repairAllCost), raid (a visit
 * raid is under way), act(action) (runs an outpost-economy action: 'online' | 'sell' | 'repairAll') }.
 */
export function outpostCardModel(o, map, { planet = o.planet, gold = 0, now = o.t, live = null, issues = [], gate = null, repairCost = 0, raid = false, act = () => {} } = {}) {
  const h = hudModel(o, map, { gold, now });
  const status = raid ? { text: 'Under raid', tone: 'bad' } : h.online ? (h.raidInbound ? { text: 'Raid inbound', tone: 'warn' } : { text: 'Online', tone: 'ok' }) : { text: 'Offline', tone: 'warn' };
  const rows = gatheringRows(o, map, planet);
  const items = rows.map((r) => ({ name: r.name, icon: r.icon, colour: r.colour, units: fmtUnits(r.units), pct: r.pct * 100,
    rate: r.full ? 'FULL' : r.parked ? 'OFF' : r.perHour > 0 ? fmtPerHour(r.perHour) : '—', rateTone: r.full ? 'bad' : (r.parked || !(r.perHour > 0)) ? 'dim' : null }));
  const gather = { head: 'Gathering', aside: 'stored · per hour', items, rows: [], gauges: [], lines: [] };
  if (!items.length) gather.lines.push({ text: 'Nothing mined yet: build a Mining Station on a deposit.', tone: 'dim' });
  const trucks = harvesterCounts(live);
  if (trucks.total) gather.rows.push(['Harvesters', trucks.waiting ? `${trucks.working} working · ${trucks.waiting} waiting (${WAIT_WORD[trucks.why] || 'idle'})` : `${trucks.working} working`, trucks.waiting ? 'warn' : 'ok']);
  else if ((o.harvesters || 0) > 0) gather.rows.push(['Harvesters', `${o.harvesters} at the Resource Bay`]);
  const stores = { head: 'Stores', aside: h.loads ? `${h.loads} ${h.loads === 1 ? 'load' : 'loads'} ready` : 'no full load', gauges: [] };
  if (h.storage.cap > 0) stores.gauges.push({ label: 'Storage', value: `${fmtUnits(h.storage.units)} / ${fmtUnits(h.storage.cap)}`, pct: h.storage.frac * 100, tone: fillTone(h.storage.frac) });
  if (h.hopper) stores.gauges.push({ label: 'Hopper', value: `${fmtUnits(h.hopper.units)} / ${fmtUnits(h.hopper.cap)}`, pct: h.hopper.frac * 100, tone: fillTone(h.hopper.frac) });
  const notes = { lines: [] };
  if (!h.online) notes.lines.push(issues.length ? { text: `To go online: ${issues.join('; ')}`, tone: 'warn' } : { text: 'Ready to go online. Raiders will come.', tone: 'info' });
  if (gate) notes.lines.push({ text: gate, tone: 'gold' });
  const actions = [];
  if (!h.online) actions.push({ label: 'Go online', primary: true, wide: true, enabled: !issues.length, title: issues.length ? 'Go online: ' + issues.join('; ') : '', run: () => act({ type: 'online' }) });
  const sb = sellButton(h);
  actions.push({ key: 'S', label: 'Sell', sub: sb.sub, enabled: sb.enabled, title: sb.enabled ? `Sell ${sb.sub}` : `Sell: ${sb.sub}`, run: () => act({ type: 'sell' }) });
  if (repairCost > 0) actions.push({ key: 'R', label: 'Repair all', sub: `${fmtGold(repairCost)}g`, enabled: repairCost <= gold, title: repairCost <= gold ? '' : `Repair all costs ${fmtGold(repairCost)} gold`, run: () => act({ type: 'repairAll' }) });
  return { title: 'Outpost', status, sections: [gather, stores, notes], actions };
}

/**
 * The top bar's readouts at the outpost (spec §1, §8): [status, power, storage, threat] for hud.setReadouts. o: the outpost
 * now; ctx: { gold, now, raidIn (seconds to the next visit raid, or null), raid (one is under way), onThreat (the chip's tap) }.
 */
export function outpostReadouts(o, map, { gold = 0, now = o.t, raidIn = null, raid = false, onThreat = null } = {}) {
  const h = hudModel(o, map, { gold, now });
  const status = !h.online ? { text: 'OFFLINE', tone: 'off', title: 'The outpost is offline: no raids, no loads sold. Go online from the outpost card.' }
    : raidIn != null && Number.isFinite(raidIn) ? { text: `RAID ${fmtClock(raidIn)}`, tone: 'clock', title: 'Time to the next raid on this visit' }
      : { text: 'ONLINE', tone: 'ok', title: 'The outpost is online' };
  const p = h.power, pf = p.supply > 0 ? p.draw / p.supply : (p.draw > 0 ? Infinity : 0);
  const ptone = p.short || pf > 1 + 1e-9 ? 'bad' : pf >= 0.9 ? 'warn' : null;
  const s = h.storage;
  return [
    { id: 'op-status', text: status.text, tone: status.tone, title: status.title, hidden: !!raid },   // a raid: the battle's "⚔ n left" speaks
    { id: 'op-power', glyph: '⚡', text: `${p.draw}/${p.supply}`, tone: ptone, title: `Power: ${p.draw} used of ${p.supply} supplied` + (p.unpowered ? ` · ${p.unpowered} without power` : '') },
    { id: 'op-store', glyph: '▣', text: `${fmtUnits(s.units)}/${fmtUnits(s.cap)}`, bar: s.frac, tone: fillTone(s.frac), title: `Storage: ${fmtUnits(s.units)} of ${fmtUnits(s.cap)} units in the Mining Stations' bays` },
    { id: 'op-threat', glyph: '☠', text: h.threat.online ? `${h.threat.size} · ${h.threat.perDay >= 1 ? Math.round(h.threat.perDay) : +h.threat.perDay.toFixed(1)}/day` : `${h.threat.size} · offline`,
      title: h.threat.text, onTap: onThreat },
  ];
}

/** The threat chip's tap: one line saying what it means (an info toast). */
export function threatInfo(o, map, now = o.t) {
  const t = hudModel(o, map, { now }).threat;
  return t.online ? `${t.text} — a bigger outpost draws more raids` : `${t.text} — go online to start mining for sale; raiders follow`;
}

/** A selected plot or farm building's panel (farm/view/farmUi.js farmPanelModel) as a HudCard model; run(act, arg) acts. */
export function farmCardModel(fm, { run = () => {}, close = () => {} } = {}) {
  const TONE = { ok: 'ok', warn: 'warn', off: 'warn', busy: 'info' };
  const lines = [...(fm.warnings || []).map((w) => ({ text: w.text, tone: 'warn' })), ...(fm.note ? [{ text: fm.note, tone: 'dim' }] : [])];
  const actions = (fm.actions || []).map((a) => ({ label: a.label, enabled: a.enabled !== false, title: a.why || '', wide: (fm.actions || []).length % 2 === 1 && a === fm.actions[0], run: () => run(a.act, a.arg) }));
  actions.push({ label: 'Close', run: close });
  return { title: fm.title, status: fm.status ? { text: fm.status, tone: TONE[fm.tone] || null } : null,
    sections: [{ rows: (fm.stats || []).map(([k, v]) => [k, v]) }, { lines }], actions };
}
