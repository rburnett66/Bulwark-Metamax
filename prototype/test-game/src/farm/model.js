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
 * Every function returns a NEW outpost; the one passed in is never changed. No Date.now, no Math.random: times come in
 * as ms, and the lucky roll is seeded from the outpost's seed, the plot and its cycle (tech plan §2.3 F4).
 */
import { FARM, cropOf, methodOf, podLevel, MAX_POD_LEVEL, farmBuildingOf, yieldOf, podsBack, prepCost } from '../data/farm.js';
import { powerGrids } from '../outpost/model.js';
import { windowSec, finished } from './grow.js';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The outpost's farm, created empty on first use. Mutates o. */
export function ensureFarm(o) {
  if (!o.farm || typeof o.farm !== 'object') o.farm = { plots: {}, buildings: {}, next: 1 };
  o.farm.plots ||= {}; o.farm.buildings ||= {}; o.farm.next ||= 1;
  return o.farm;
}

/** Everything that takes ground on the outpost map: pads, defenses, farm plots and farm buildings → [{ x, y, w, h, what }]. */
export function occupied(o, map) {
  const out = (map.pads || []).map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, what: 'pad ' + p.id }));
  for (const d of o.defenses || []) out.push({ x: d.cell[0], y: d.cell[1], w: 1, h: 1, what: 'defense ' + d.id });
  if (o.farm) {
    for (const p of Object.values(o.farm.plots)) out.push({ x: p.x, y: p.y, w: p.w, h: p.h, what: 'plot ' + p.id });
    for (const [id, b] of Object.entries(o.farm.buildings)) out.push({ x: b.x, y: b.y, w: b.w, h: b.h, what: b.kind + ' ' + id });
  }
  return out;
}

/** Why a w × h rect at (x, y) cannot take a farm thing, or null. ctx.cellOk(rect) adds the map's farm-cell rule (A6). */
function groundRefusal(o, map, rect, ctx) {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) return 'off the map';
  const hit = occupied(o, map).find((r) => overlaps(r, rect));
  if (hit) return `the ground is taken (${hit.what})`;
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
 * Plant a prepped plot with one crop at one pod level, one pod per row (the method's Pods_Per). The caller spends the
 * pods (story A4): ctx.podsHeld is how many of that crop and level the player holds.
 * → { outpost, spend: { crop, level, n } } or { error }
 */
export function plant(outpost, plotId, { crop, level }, ctx) {
  const p = outpost.farm && outpost.farm.plots[plotId];
  if (!p) return { error: `no plot ${plotId}` };
  if (plotState(outpost, p, ctx.now) !== 'prepped') return { error: 'the plot is not prepped' };
  if (!cropOf(crop)) return { error: `unknown crop ${crop}` };
  if (!podLevel(level)) return { error: `no pod level ${level}` };
  const n = methodOf(p.method).pods;
  if ((ctx.podsHeld ?? 0) < n) return { error: `needs ${n} pods` };
  const o = clone(outpost), q = o.farm.plots[plotId];
  Object.assign(q, { crop, level, plantedAt: ctx.now, progress: 0, ripeAt: null, cycle: q.cycle + 1, yieldShare: 1 });
  return { outpost: o, spend: { crop, level, n } };
}

// ── the Silo ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The farm's output per hour now: every planted plot's yield over its grow time with its method. */
export function outputPerHour(o) {
  let u = 0;
  for (const p of Object.values((o.farm && o.farm.plots) || {})) {
    if (!p.crop) continue;
    const m = methodOf(p.method);
    u += yieldOf(p.crop, p.method, p.level) * m.speed / cropOf(p.crop).growHours;
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
  for (const p of Object.values((o.farm && o.farm.plots) || {})) if (p.crop) one = Math.max(one, yieldOf(p.crop, p.method, p.level));
  return Math.max(Math.ceil(hours * outputPerHour(o)), one);
}

// ── harvesting ───────────────────────────────────────────────────────────────────────────────────────────────────
function mix(a, b) {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const idNum = (id) => [...String(id)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
/**
 * The lucky level-up (Farming-Design §8.3): a Fruited harvest returns one pod a level up on a seeded chance —
 * Lucky_Chance, Lucky_Chance_High from Rare up, never from Legendary. Seeded from the outpost's seed, the plot and its
 * cycle only, so the same harvest always rolls the same.
 */
export function luckyRoll(seed, plotId, cycle, level) {
  if (level >= MAX_POD_LEVEL) return false;
  const chance = level >= 3 ? FARM.Lucky_Chance_High : FARM.Lucky_Chance;
  return mix(mix(seed >>> 0, idNum(plotId)), cycle) / 4294967296 < chance;
}

/**
 * Harvest a plot at the outpost's time (advance it first). Fruited: the crop into the store, if it fits
 * (ctx.held = units the farm store holds for this planet); some pods back for grain and vegetables; the lucky roll.
 * Dead: the planted pods back, no crop, no room needed. Either way the plot is left harvested (prep it again).
 * ctx: { map, held }. → { outpost, kind: 'crop' | 'pods', crop, level, units, pods: [{ crop, level, n }] } or { error }
 */
export function harvest(outpost, plotId, ctx) {
  const p = outpost.farm && outpost.farm.plots[plotId];
  if (!p) return { error: `no plot ${plotId}` };
  const st = plotState(outpost, p);
  if (st !== 'fruited' && st !== 'dead') return { error: `nothing to harvest (${st})` };
  const o = clone(outpost), q = o.farm.plots[plotId], n = methodOf(q.method).pods;
  const clear = () => Object.assign(q, { crop: null, level: null, plantedAt: null, progress: 0, ripeAt: null, prepDone: null, yieldShare: 1 });
  if (st === 'dead') {
    const out = { outpost: o, kind: 'pods', crop: q.crop, level: q.level, units: 0, pods: [{ crop: q.crop, level: q.level, n }] };
    clear();
    return out;
  }
  const units = Math.max(1, Math.floor(yieldOf(q.crop, q.method, q.level) * (q.yieldShare ?? 1)));
  const room = storeCapacity(outpost, ctx.map) - (ctx.held || 0);
  if (units > room) return { error: 'the Silo is full', full: true };
  const pods = [];
  const back = podsBack(q.crop, n);
  if (back) pods.push({ crop: q.crop, level: q.level, n: back });
  if (luckyRoll(o.seed, q.id, q.cycle, q.level)) pods.push({ crop: q.crop, level: q.level + 1, n: 1, lucky: true });
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
