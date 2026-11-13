/**
 * src/farm/farmRail.js — the farm on the outpost's shared battle rail: its FARM tab, its locks, and its ground rule
 * inside the battle's placement [MM-story_mwcgbd9q_2y] [MM-story_mwc9q1y6_2n] (S6, TECH_PLAN::One-Battle-UX.md §4).
 *
 * Owner 2026-11-11: "the Build menu should have build and Farm toggles so crops and machinery appear in the build UI
 * window"; "users are trained to work with camera, characters, and structure in one pattern". So the farm has no rail,
 * pointer, ghost or placement code of its own: the outpost session's battle rail gets a FARM tab (battle/catalogue.js
 * tabs) listing these items (data/farmStructures.js defs), the battle input arms and aims them, the battle ghost shows
 * them, and the battle's validatePlacement asks the rule below. A placement that passes is handed to the save session's
 * farm action (outpost/view/session.js act farmPlace / plant) — the farm model's rules (farm/model.js), run once.
 *
 *   farmRailIds(save, planet)           → the FARM tab's ids: plot methods, the Silo and Pump, then crops
 *   farmRailLocks(save, ctx, ids)       → { [id]: reason } for the catalogue (shown as padlocks, refused by the sim)
 *   farmRailTab(save, planet)           → the FARM tab for createCatalogue: machinery column + scrolling seed columns
 *   farmGateReason(save, planet, ship)  → why the farm is shut here (every FARM item's lock until it opens), or null
 *   farmGroundRule(getOutpost, map, getCtx) → a state.placementRules rule (state, def, cell, structId) → reason | null
 *   farmRefusal(o, map, def, cell, ctx) → the same answer, unmemoised (tests)
 *   grownFarm(o, map, now)              → the outpost with its farm grown on to `now` (a copy; the save is not touched)
 *
 * Pure: no DOM, no clock (ctx.now comes in).
 */
import { METHODS, CROPS, cropOf, methodOf, farmContractOf } from '../data/farm.js';
import { farmStructId, cropStructId, FARM_RAIL_BUILDINGS } from '../data/farmStructures.js';
import { groundRefusal, plotState } from './model.js';
import { growFarm } from './grow.js';
import { powerGrids } from '../outpost/model.js';
import { podCount } from './pods.js';
import { podsUnlocked, unlockUnits } from './unlock.js';
import { farmGate, hasFarm } from './contract.js';
import { PLANETS } from '../data/planets.js';

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Pods one planting needs at least (1 pod = 1 plant, owner 2026-11-12 [MM-story_mwelnbfc_1]), and the most a plot takes. */
const podsToPlant = () => 1;
const plotHolds = () => Math.max(...METHODS.map((m) => m.pods || 16));

/**
 * The FARM tab, top to bottom: the plot methods, the farm buildings the player buys (the Farmhouse is the contract's
 * grant), then the crops — the planet's own (its four), then any other crop the player holds pods of.
 */
export function farmRailIds(save, planet) {
  const own = CROPS.filter((c) => c.planet === planet || c.planetKey === planet).map((c) => c.id);
  const held = CROPS.filter((c) => !own.includes(c.id) && podCount(save, c.id) > 0).map((c) => c.id);
  return [...METHODS.map((m) => farmStructId(m.id)), ...FARM_RAIL_BUILDINGS.map(farmStructId), ...[...own, ...held].map(cropStructId)];
}

/**
 * The FARM tab as a catalogue tab (battle/catalogue.js) with the shared rail's COLUMN layout [MM-task_mwd2upbd_5]
 * (owner 2026-11-12: "Maybe the machinery is the far left and the seeds are adjacent and scroll"): the machinery (plot
 * methods, the farm buildings bought — any farm building added to the data joins it) in the far-left column, the seeds
 * (the planet's crops, then any other crop held) beside it in up to two columns that scroll. Order = farmRailIds'.
 */
export function farmRailTab(save, planet) {
  const ids = farmRailIds(save, planet), isSeed = (id) => id.startsWith('FARM-crop-');
  return { id: 'farm', label: 'FARM', layout: { type: 'columns', groups: [
    { id: 'machinery', ids: ids.filter((id) => !isSeed(id)) },
    { id: 'seeds', ids: ids.filter(isSeed), scroll: true, maxCols: 2 },
  ] } };
}

/**
 * Why the farm is shut on this planet, from the farming gate (farm/contract.js, farm/factor.js's desk states) — every
 * FARM item's lock until the farming contract is accepted, so the tab still shows the seed pods held (owner 2026-11-12:
 * "Even if farming is disabled the Farm menu should be active to confirm my seed pod inventory"). null once farmed.
 * ship: the planet's capital ship's name (the mission catalogue's capitalShips), or a generic one.
 */
export function farmGateReason(save, planet, ship = null) {
  if (hasFarm(save, planet)) return null;
  if (!farmContractOf(planet, 'F1')) return `Farming is not open on ${(PLANETS[planet] || {}).name || planet} yet`;
  // the one wording of the gate, step by step (farm/contract.js farmGate): the OUTPOST panel's line reads it too
  const g = farmGate(save, planet, { ship });
  return g ? g.text : null;
}

/**
 * Why each FARM item cannot be used now (the catalogue's locks): a method not unlocked yet; a crop whose seed pods are
 * locked (owner rule 10) or of which the player holds too few to plant. ctx: the save session's ctx (methods).
 */
export function farmRailLocks(save, ctx, ids) {
  const out = {}, methods = (ctx && ctx.methods) || ['traditional'], need = podsToPlant();
  for (const id of ids) {
    const m = methodOf(id.slice(5));
    if (m) { if (!methods.includes(m.id)) out[id] = `${m.name} is not unlocked yet`; continue; }
    if (!id.startsWith('FARM-crop-')) continue;
    const c = cropOf(id.slice(10));
    if (!c) continue;
    if (!podsUnlocked(save, c.id)) out[id] = `${c.name} seed pods are locked: deliver ${unlockUnits()} ${c.name} to unlock them`;
    else if (podCount(save, c.id) < need) out[id] = `Needs a ${c.name} seed pod: buy them at STORES › Seed pods`;
  }
  return out;
}

/**
 * The count a FARM-tab crop button shows in its price slot (the shared rail's railLabel hook) [MM-task_mwcztxf9_2]: the
 * seed pods the player HOLDS of that crop ("8 pods"), and in its tooltip how many one planting uses. Only pods held —
 * never progress toward the next Pod Reward Chest (owner rule: the chest is a surprise). pods: the save's s.pods.
 * → { text, title } for a crop item, null for anything else (the gold price stays).
 */
export function farmRailLabel(structId, pods = {}) {
  if (typeof structId !== 'string' || !structId.startsWith('FARM-crop-')) return null;
  const c = cropOf(structId.slice(10));
  if (!c) return null;
  const n = podCount({ pods }, c.id);
  return { text: `${n} pod${n === 1 ? '' : 's'}`, title: `${c.name}: ${n} seed pod${n === 1 ? '' : 's'} held · a plot plants up to ${plotHolds()}, one per pod` };
}

/** What farm thing covers a cell: { plot: id } | { farm: id } | null. */
export function farmThingAt(o, x, y) {
  if (!o || !o.farm) return null;
  const inR = (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const p of Object.values(o.farm.plots)) if (inR(p)) return { plot: p.id };
  for (const [id, b] of Object.entries(o.farm.buildings)) if (inR(b)) return { farm: id };
  return null;
}

/**
 * The farm's answer for a placement on the shared rail (null = no objection). def: getStructureDef(structId).
 *  - a crop: the cell must be on a PREPPED plot (it plants that plot);
 *  - a plot or a farm building: the farm model's own ground rule (farm/model.js groundRefusal: the map, everything
 *    standing, the walkway, the map's farm soil — ctx.cellOk, farm/cells.js);
 *  - an outpost structure: never on the farm's plots or buildings (the sim does not hold them as structures).
 */
export function farmRefusal(o, map, def, cell, ctx = {}) {
  if (!o || !def || !cell) return null;
  const fp = def.footprint || { w: 1, h: 1 };
  const rect = { x: cell.x, y: cell.y, w: fp.w || 1, h: fp.h || 1 };
  if (def.farmItem === 'crop') {
    const at = farmThingAt(o, cell.x, cell.y);
    if (!at || !at.plot) return 'plant it on a prepped plot';
    const st = plotState(o, o.farm.plots[at.plot], ctx.now ?? o.t);
    return st === 'prepped' ? null : `that plot is ${st === 'harvested' ? 'harvested: prep it first' : st}`;
  }
  if (def.farmItem) return groundRefusal(o, map, rect, { cellOk: ctx.cellOk }) || null;
  if (!o.farm) return null;
  for (const p of Object.values(o.farm.plots)) if (overlaps(rect, p)) return 'a farm plot is there';
  for (const b of Object.values(o.farm.buildings)) if (overlaps(rect, b)) return 'a farm building is there';
  return null;
}

/**
 * The rule for state.placementRules, memoised on the last (outpost, item, cell): the shared ghost asks every frame.
 * getOutpost: () → the outpost (save shape) as it stands now; getCtx: () → { now, cellOk }.
 */
export function farmGroundRule(getOutpost, map, getCtx = () => ({})) {
  let last = null;
  return (state, def, cell, structId) => {
    const o = getOutpost();
    if (!o) return null;
    if (last && last.o === o && last.id === structId && last.x === cell.x && last.y === cell.y) return last.why;
    const why = farmRefusal(o, map, def, cell, getCtx() || {});
    last = { o, id: structId, x: cell.x, y: cell.y, why };
    return why;
  };
}

/**
 * The outpost with its plants grown from its clock (o.t) to `now`, at the power of that moment — what a visit shows
 * between two saves (the save's own advance() grows the same stretch again when it next runs, from o.t: nothing is
 * counted twice). A copy: `o` is never changed. → o itself when there is no farm or no time to grow.
 */
export function grownFarm(o, map, now) {
  if (!o || !o.farm || !(now > o.t)) return o;
  const c = { ...o, farm: JSON.parse(JSON.stringify(o.farm)), t: now };
  growFarm(c, map, o.t, now, powerGrids(o, map, o.t).powered, null);
  return c;
}
