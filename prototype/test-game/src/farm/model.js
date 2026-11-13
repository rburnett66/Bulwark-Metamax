/**
 * src/farm/model.js — the farm, a layer on the outpost [MM-story_mwabgeyj_a].
 *
 * Owner rule 7 (2026-11-10): "we already have an outpost and the farm is a new system on top of the outpost". So the
 * farm's state is `o.farm` inside the outpost record (s.outposts[planet]); it has no clock, power grid, raid schedule or
 * build queue of its own: time moves in the outpost's advance() (which calls src/farm/grow.js), power is the outpost's
 * powerGrids() (farm buildings are consumers on it), and raids are the outpost's (trampling is story A11).
 *
 *   o.farm = { plots: { [id]: plot }, buildings: { [id]: { kind, x, y, w, h, tier, done } }, next: n }
 *   plot   = { id, x, y, w, h, method, prepDone, crop, level, plantedAt, progress, ripeAt, cycle, yieldShare }
 *
 * A plot runs: (prepping → prepped) → planted → sprout → plant → FRUITED → (harvest: crop | dead: pods back) →
 * harvested → prep again. Design: docs/16 Bulwark MM/design/Farming-Design.md §5–§6; tech plan §3.1.
 *
 * The Silo (owner rule 4, 2026-11-10): when it is full the plants keep growing but HARVEST is refused; a Fruited plant
 * left too long dies as usual, and a dead plant's harvest returns its pods (pods need no Silo room). Without a finished,
 * powered Silo the Farmhouse holds Farmhouse_Store_Hours of output — the outpost's own rule for a rig without a Storage
 * Tower, applied to the farm.
 *
 * Where things go: this module is pure and never writes outside the outpost. A harvest RETURNS what it yields
 * ({ crop, units } for the farm store, story A13; pods for s.pods, story A4); the caller banks them. `ctx.held` is
 * what the farm store already holds for this planet (units), so the Silo can be checked.
 *
 * Crop levels (owner rule 9, 2026-11-10): seed pods have no level. A plot is planted at its crop's tech-tree level (the
 * caller reads it with src/farm/levels.js cropLevel), capped by growLevel (level 5 needs a trick: an Irrigated plot with
 * water), and keeps that level until it is harvested — a later upgrade only reaches new plantings.
 *
 * Every function returns a NEW outpost; the one passed in is never changed. No Date.now, no Math.random: times come in
 * as ms; nothing here is random.
 */
import { FARM, cropOf, methodOf, podLevel, farmBuildingOf, yieldOf, podsBack, prepCost, growLevel } from '../data/farm.js';
import { powerGrids, takenRects } from '../outpost/model.js';
import { windowSec, finished, hasWater } from './grow.js';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The outpost's farm, created empty on first use. Mutates o. */
export function ensureFarm(o) {
  if (!o.farm || typeof o.farm !== 'object') o.farm = { plots: {}, buildings: {}, next: 1 };
  o.farm.plots ||= {}; o.farm.buildings ||= {}; o.farm.next ||= 1;
  return o.farm;
}

/** Everything that takes ground on the outpost map: the landing pad, deposits and buildings (outpost model takenRects),
 *  defenses, farm plots and farm buildings → [{ x, y, w, h, what }]. */
export function occupied(o, map) {
  const out = takenRects(o, map);
  for (const d of o.defenses || []) out.push({ x: d.cell[0], y: d.cell[1], w: 1, h: 1, what: 'defense ' + d.id });
  if (o.farm) {
    for (const p of Object.values(o.farm.plots)) out.push({ x: p.x, y: p.y, w: p.w, h: p.h, what: 'plot ' + p.id });
    for (const [id, b] of Object.entries(o.farm.buildings)) out.push({ x: b.x, y: b.y, w: b.w, h: b.h, what: b.kind + ' ' + id });
  }
  return out;
}

/**
 * The walkway rule (owner 2026-11-10 [MM-story_mwahj1kx_1f]): plots and farm buildings keep FARM.Plot_Walkway_Cells of
 * clear ground between them, so the avatar and, later, the agrobots can walk between the beds. → the farm thing the
 * rect would crowd ({ what }), or null. Only the farm's own things count: pads keep their own yard (cells.js).
 */
export function walkwayHit(o, rect, gap = FARM.Plot_Walkway_Cells ?? 1) {
  if (!o.farm || !(gap > 0)) return null;
  const grown = { x: rect.x - gap, y: rect.y - gap, w: rect.w + 2 * gap, h: rect.h + 2 * gap };
  for (const p of Object.values(o.farm.plots)) if (overlaps(grown, p)) return { what: 'plot ' + p.id };
  for (const [id, b] of Object.entries(o.farm.buildings)) if (overlaps(grown, b)) return { what: b.kind + ' ' + id };
  return null;
}

/** Why a w × h rect at (x, y) cannot take a farm thing, or null. ctx.cellOk(rect) adds the map's farm-cell rule (A6). */
export function groundRefusal(o, map, rect, ctx) {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) return 'off the map';
  const hit = occupied(o, map).find((r) => overlaps(r, rect));
  if (hit) return `the ground is taken (${hit.what})`;
  const crowd = walkwayHit(o, rect);
  if (crowd) return `keep a walkway clear of the ${crowd.what.replace(/ \S+$/, '')}`;
  return ctx && ctx.cellOk ? ctx.cellOk(rect) || null : null;
}

// ── plots ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A plot's state at time t (default the outpost's clock): prepping, prepped, planted, sprout, plant, fruited, dead, harvested. */
export function plotState(o, plot, t = o.t) {
  if (!plot.crop) {
    if (plot.prepDone == null) return 'harvested';
    return plot.prepDone > t ? 'prepping' : 'prepped';
  }
  if (plot.progress >= 1 && plot.ripeAt != null) return t < plot.ripeAt + windowSec(plot) * 1000 ? 'fruited' : 'dead';
  if (plot.progress < FARM.Sprout_At) return 'planted';
  return plot.progress < FARM.Plant_At ? 'sprout' : 'plant';
}

/**
 * Put a new plot on the ground and start its first prep (the plot costs its prep, Farming-Design §5.1).
 * what: { x, y, method }. ctx: { map, gold, now, methods?: ids the player has (default ['traditional']), cellOk? }.
 * → { outpost, cost, plot } or { error }
 */
export function placePlot(outpost, what, ctx) {
  const m = methodOf(what.method || 'traditional');
  if (!m) return { error: `unknown method ${what.method}` };
  if (!(ctx.methods || ['traditional']).includes(m.id)) return { error: `${m.name} is not unlocked` };
  const rect = { x: what.x, y: what.y, w: m.w, h: m.h };
  const why = groundRefusal(outpost, ctx.map, rect, ctx);
  if (why) return { error: why };
  const cost = prepCost(m.id);
  if (cost.gold > (ctx.gold ?? Infinity)) return { error: `costs ${cost.gold} gold` };
  const o = clone(outpost), f = ensureFarm(o);
  const id = 'p' + f.next++;
  f.plots[id] = { id, ...rect, method: m.id, prepDone: ctx.now + cost.sec * 1000, crop: null, level: null, plantedAt: null,
    progress: 0, ripeAt: null, cycle: 0, yieldShare: 1 };
  return { outpost: o, cost: cost.gold, plot: id };
}

/** Prep a harvested plot again (gold and time). → { outpost, cost } or { error } */
export function prep(outpost, plotId, ctx) {
  const p = outpost.farm && outpost.farm.plots[plotId];
  if (!p) return { error: `no plot ${plotId}` };
  if (plotState(outpost, p, ctx.now) !== 'harvested') return { error: 'only a harvested plot is prepped' };
  const cost = prepCost(p.method);
  if (cost.gold > (ctx.gold ?? Infinity)) return { error: `costs ${cost.gold} gold` };
  const o = clone(outpost);
  o.farm.plots[plotId].prepDone = ctx.now + cost.sec * 1000;
  return { outpost: o, cost: cost.gold };
}

/**
 * The level a plot would grow a crop at if planted now (owner rule 9): the crop's tech-tree level `techLevel`, capped by
 * the plot's method (growLevel: level 5 needs an Irrigated plot with water — a water cell or a finished, powered Pump
 * in reach at time t). map: the outpost map (no map: no water). → { level, capped, why }
 */
export function plantLevel(o, map, plot, techLevel, t = o.t) {
  const m = methodOf(plot.method);
  const water = !!(m && m.waterReach && o.farm && hasWater(o, map, plot, t, map ? powerGrids(o, map).powered : null));
  return growLevel(techLevel, plot.method, { water });
}

/**
 * 1 POD = 1 PLANT (owner 2026-11-12: "when I plant a plot with seed pods but I only have 7 pods I should only see 7
 * plants") [MM-story_mwelnbfc_1]. A plot holds up to its method's Pods_Per plants (16: its 4 × 4 spots); `plants` is
 * how many were planted. A plot planted before this has no `plants` and counts as full.
 */
export const plotFull = (p) => methodOf(p.method).pods;
export const plotPlants = (p) => Math.max(0, Math.min(plotFull(p), p.plants ?? plotFull(p)));
/** What a planted plot yields: the method's full-plot yield × how full it is × any trampling share. */
export const plotYield = (p) => yieldOf(p.crop, p.method, p.level) * (plotPlants(p) / plotFull(p)) * (p.yieldShare ?? 1);

/**
 * Plant a prepped plot with one crop, one pod per plant: as many pods as the player holds, up to the method's Pods_Per. Pods have no level: `level` is the
 * crop's tech-tree level (src/farm/levels.js cropLevel), and the plot stores the level it actually grows at
 * (plantLevel) until it is harvested. The caller spends the pods (story A4): ctx.podsHeld is how many of that crop the
 * player holds. ctx: { now, map, podsHeld }.
 * → { outpost, level, capped, why, spend: { crop, n } } or { error }
 */
export function plant(outpost, plotId, { crop, level = 1 }, ctx) {
  const p = outpost.farm && outpost.farm.plots[plotId];
  if (!p) return { error: `no plot ${plotId}` };
  if (plotState(outpost, p, ctx.now) !== 'prepped') return { error: 'the plot is not prepped' };
  if (!cropOf(crop)) return { error: `unknown crop ${crop}` };
  if (!podLevel(level)) return { error: `no crop level ${level}` };
  const n = Math.min(plotFull(p), Math.floor(ctx.podsHeld ?? 0));
  if (n < 1) return { error: 'needs a seed pod' };
  const grow = plantLevel(outpost, ctx.map, p, level, ctx.now);
  const o = clone(outpost), q = o.farm.plots[plotId];
  Object.assign(q, { crop, level: grow.level, plantedAt: ctx.now, progress: 0, ripeAt: null, cycle: q.cycle + 1, yieldShare: 1, plants: n });
  return { outpost: o, level: grow.level, capped: grow.capped, why: grow.why, spend: { crop, n } };
}

// ── the Silo ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The farm's output per hour now: every planted plot's yield over its grow time with its method. */
export function outputPerHour(o) {
  let u = 0;
  for (const p of Object.values((o.farm && o.farm.plots) || {})) {
    if (!p.crop) continue;
    const m = methodOf(p.method);
    u += plotYield(p) * m.speed / cropOf(p.crop).growHours;
  }
  return u;
}

/** The finished, powered Silo, or null. */
export function siloReady(o, map) {
  const ids = Object.keys((o.farm && o.farm.buildings) || {}).filter((id) => o.farm.buildings[id].kind === 'silo' && finished(o.farm.buildings[id], o.t));
  if (!ids.length) return null;
  const { powered } = powerGrids(o, map);
  return ids.find((id) => powered.has(id)) || null;
}

/**
 * How many units the farm can hold: Silo_Hours of its output with a finished, powered Silo, else
 * Farmhouse_Store_Hours of it; never less than the largest single harvest on the farm (at least one Traditional plot of
 * Loam Grain), so an empty store always takes one harvest.
 */
export function storeCapacity(o, map) {
  const hours = siloReady(o, map) ? FARM.Silo_Hours : FARM.Farmhouse_Store_Hours;
  let one = yieldOf('loam-grain', 'traditional', 1);
  for (const p of Object.values((o.farm && o.farm.plots) || {})) if (p.crop) one = Math.max(one, plotYield(p));
  return Math.max(Math.ceil(hours * outputPerHour(o)), one);
}

// ── harvesting ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Harvest a plot at the outpost's time (advance it first). Fruited: the crop into the store, if it fits
 * (ctx.held = units the farm store holds for this planet); some pods back for grain and vegetables (a plain count:
 * pods have no level, owner rule 9). Dead: the planted pods back, no crop, no room needed. Either way the plot is left
 * harvested (prep it again). `level` is the plot's own (it grew at it), for the harvest effect.
 * ctx: { map, held }. → { outpost, kind: 'crop' | 'pods', crop, level, units, pods: [{ crop, n }] } or { error }
 */
export function harvest(outpost, plotId, ctx) {
  const p = outpost.farm && outpost.farm.plots[plotId];
  if (!p) return { error: `no plot ${plotId}` };
  const st = plotState(outpost, p);
  if (st !== 'fruited' && st !== 'dead') return { error: `nothing to harvest (${st})` };
  const o = clone(outpost), q = o.farm.plots[plotId], n = plotPlants(q);
  const clear = () => Object.assign(q, { crop: null, level: null, plantedAt: null, progress: 0, ripeAt: null, prepDone: null, yieldShare: 1, plants: null });
  if (st === 'dead') {
    const out = { outpost: o, kind: 'pods', crop: q.crop, level: q.level, units: 0, pods: [{ crop: q.crop, n }] };
    clear();
    return out;
  }
  const units = Math.max(1, Math.floor(plotYield(q)));
  const room = storeCapacity(outpost, ctx.map) - (ctx.held || 0);
  if (units > room) return { error: 'the Silo is full', full: true };
  const pods = [];
  const back = podsBack(q.crop, n);
  if (back) pods.push({ crop: q.crop, n: back });
  const out = { outpost: o, kind: 'crop', crop: q.crop, level: q.level, units, pods };
  clear();
  return out;
}

/**
 * HARVEST ALL (the Farmhouse panel, Farming-Design §5.1): every Fruited and Dead plot in id order; a Fruited plot that
 * no longer fits in the store is skipped and listed in `blocked`. → { outpost, results: [...], blocked: [plotId] }
 */
export function harvestAll(outpost, ctx) {
  let o = outpost, held = ctx.held || 0;
  const results = [], blocked = [];
  const ids = Object.keys((o.farm && o.farm.plots) || {}).sort((a, b) => +a.slice(1) - +b.slice(1));
  for (const id of ids) {
    const st = plotState(o, o.farm.plots[id]);
    if (st !== 'fruited' && st !== 'dead') continue;
    const r = harvest(o, id, { ...ctx, held });
    if (r.error) { if (r.full) blocked.push(id); continue; }
    o = r.outpost; held += r.units;
    results.push({ plot: id, ...r, outpost: undefined });
  }
  return { outpost: o, results, blocked };
}

// ── farm buildings (Farmhouse, Silo, Pump) ───────────────────────────────────────────────────────────────────────
/**
 * Build a farm building on free ground, with the outpost's build timing. The Farmhouse is granted by a farming contract
 * (story A5: ctx.grant) and there is one; the Silo and the Pump are bought.
 * what: { kind, x, y }. ctx: { map, gold, now, grant?, cellOk? }. → { outpost, cost, id } or { error }
 */
export function placeFarmBuilding(outpost, what, ctx) {
  const def = farmBuildingOf(what.kind);
  if (!def) return { error: `unknown farm building ${what.kind}` };
  const has = (k) => Object.values((outpost.farm && outpost.farm.buildings) || {}).some((b) => b.kind === k);
  if (def.kind === 'farmhouse') {
    if (!ctx.grant) return { error: 'the Farmhouse comes with the farming contract' };
    if (has('farmhouse')) return { error: 'the farm has its Farmhouse' };
  }
  const rect = { x: what.x, y: what.y, w: def.w, h: def.h };
  const why = groundRefusal(outpost, ctx.map, rect, ctx);
  if (why) return { error: why };
  const cost = def.kind === 'farmhouse' ? 0 : def.cost;
  if (cost > (ctx.gold ?? Infinity)) return { error: `costs ${cost} gold` };
  const o = clone(outpost), f = ensureFarm(o);
  const id = 'f' + f.next++;
  f.buildings[id] = { kind: def.kind, ...rect, tier: 1, done: ctx.now + def.buildSec * 1000 };
  return { outpost: o, cost, id };
}

// ── what the player sees (the FARM button's status line, the panels) ─────────────────────────────────────────────
/**
 * The farm's warnings and counts at the outpost's time: { fruited, dead, growing, prepped, siloFull, unpowered: [id] }.
 * ctx.held = units the farm store holds for this planet.
 */
export function farmStatus(o, map, ctx = {}) {
  const out = { fruited: 0, dead: 0, growing: 0, prepped: 0, siloFull: false, unpowered: [] };
  if (!o.farm) return out;
  for (const p of Object.values(o.farm.plots)) {
    const st = plotState(o, p);
    if (st === 'fruited') out.fruited++;
    else if (st === 'dead') out.dead++;
    else if (st === 'prepped') out.prepped++;
    else if (st === 'planted' || st === 'sprout' || st === 'plant') out.growing++;
  }
  out.siloFull = (ctx.held || 0) >= storeCapacity(o, map);
  const { off } = powerGrids(o, map);
  out.unpowered = Object.keys(o.farm.buildings).filter((id) => finished(o.farm.buildings[id], o.t) && off[id]);
  return out;
}

/** The away report's farm lines from an advance() report: "2 plots fruited", "1 plant died". */
export function farmReportLines(report) {
  const f = report && report.farm;
  if (!f) return [];
  const lines = [];
  if (f.ripened.length) lines.push(`${f.ripened.length} plot${f.ripened.length > 1 ? 's' : ''} fruited`);
  if (f.died.length) lines.push(`${f.died.length} plant${f.died.length > 1 ? 's' : ''} died`);
  return lines;
}

// ── raids and the farm (Farming-Design §10; tech plan §2.3 F5, story A11) ───────────────────────────────────────────
// The farm has no raids of its own: the outpost's raid (src/outpost/raid.js, the battle sim on the outpost map) reports
// the cells its raiders stood on, and the outpost's advance() hands them to trample() at the raid's moment. Plots never
// block paths. The farmhands and the avatar are not in the raid sim at all, so they are never targets.
const GROWING = new Set(['planted', 'sprout', 'plant']);

/**
 * Raiders crossing the farm. cells: [[x, y], …] (or { x, y }) the raiders stood on; t: the raid's moment (ms, default the
 * outpost's clock). Every growing surface plot a cell falls on is set back one stage, once per raid: Plant → Sprout
 * (progress to Sprout_At), Sprout → Planted (progress to 0); Planted stays Planted. A Fruited plot keeps
 * Trample_Fruited_Yield of its yield (yieldShare), once: a second trampling takes nothing more. Dead, prepping,
 * prepped and harvested plots are untouched; nothing is killed and no pod is lost.
 * → { outpost (a new one), trampled: [{ plot, from, to, yieldShare? }] } in plot-id order.
 */
export function trample(outpost, cells, t = outpost.t) {
  const plots = (outpost.farm && outpost.farm.plots) || {};
  const ids = Object.keys(plots).sort((a, b) => +a.slice(1) - +b.slice(1));
  if (!ids.length || !cells || !cells.length) return { outpost, trampled: [] };
  const at = new Set(cells.map((c) => (Array.isArray(c) ? `${c[0]},${c[1]}` : `${c.x},${c.y}`)));
  const hit = (p) => {
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (at.has(`${x},${y}`)) return true;
    return false;
  };
  const o = clone(outpost), trampled = [];
  for (const id of ids) {
    const p = o.farm.plots[id], from = plotState(o, p, t);
    if ((from !== 'fruited' && !GROWING.has(from)) || from === 'planted') continue;   // Planted has no stage to lose
    if (!hit(p)) continue;
    if (from === 'fruited') {
      const share = Math.min(p.yieldShare ?? 1, FARM.Trample_Fruited_Yield);
      if (share === (p.yieldShare ?? 1)) continue;   // trampled already: no second loss
      p.yieldShare = share;
      trampled.push({ plot: id, from, to: from, yieldShare: share });
      continue;
    }
    if (from === 'plant') p.progress = FARM.Sprout_At;
    else p.progress = 0;   // sprout → planted
    trampled.push({ plot: id, from, to: plotState(o, p, t) });
  }
  return trampled.length ? { outpost: o, trampled } : { outpost, trampled };
}

/**
 * A breach on the farm's store (Farming-Design §10: a breach takes 25 % of what is stored, here the Silo). The farm model
 * does not hold the store (the caller banks harvests into the farm inventory, s.stores.farm[planet]); a raid entry's
 * `farmLoss` is the share lost, and the caller applies it to what it holds with this. held: a number of units, or
 * { [crop]: units }. → { held (what is left, same shape), lost (same shape) }
 */
export function applyFarmLoss(held, share = FARM.Breach_Silo_Loss) {
  const cut = (u) => { const l = (+u || 0) * share; return [(+u || 0) - l, l]; };
  if (held == null || typeof held !== 'object') { const [k, l] = cut(held); return { held: k, lost: l }; }
  const left = {}, lost = {};
  for (const [item, u] of Object.entries(held)) [left[item], lost[item]] = cut(u);
  return { held: left, lost };
}
