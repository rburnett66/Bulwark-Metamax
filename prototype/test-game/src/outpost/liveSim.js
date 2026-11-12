/**
 * src/outpost/liveSim.js — a visited outpost as a LIVE battle SimState, and back [MM-task_mwcdvk4o_2s]
 * (S2.2 of One Battle UX, TECH_PLAN::One-Battle-UX.md §4).
 *
 * Owner 2026-11-11: one pattern, one implementation. While the player is at the outpost it runs on the battle's own
 * sim (sim/core.js): its buildings and defenses are sim structures (the 'OUT-<kind>' defs, data/outpostStructures.js),
 * its gold is the battle economy (so kills pay the battle bounty, plan §5b), and every action is a battle command.
 * Away time stays the outpost model's closed form (model.advance). This module is the seam between the two:
 *
 *   const { state, link } = toLiveSim(outpost, { map, now, gold });   // on arrival (after the away catch-up)
 *   …the battle session steps `state`…
 *   const { outpost: saved, gold } = fromLiveSim(state, link, now);    // on leaving
 *
 * A visit with no actions saves back exactly what was loaded (liveSim.test.mjs). The board is built the way a raid
 * builds it (raid.js raidSimMap: the base sits on the hub, the raid lanes are the spawns) — reused, not copied — but
 * the buildings are sim structures here rather than blocked cells. Construction, upgrades and timed sells carry over:
 * the save's wall-clock `done` becomes sim `progress`, and back.
 *
 * Harvest (S4 [MM-story_mwc9pzyd_2l]): the outpost's surface fields (model.surfaceFieldGroups, the closed form's own list)
 * are the sim's resource nodes, at their saved stock and regrowing at the closed form's rate; the bought harvesters are
 * the battle's harvesters (sim/harvest.js), docked beside the Resource Bay, each locked to the field harvestPlan gives it.
 * The trucks' loads are kept, never sold (a zero-quota Collective contract: the battle's own "kept" path), and on leaving
 * they land in the hopper; the save then marks the visit's stretch (o.liveHarvest) so the away closed form does not
 * count it again.
 *
 * Positions (S2c [MM-story_mwc9pmbn_2i]): a building keeps its id; one placed during the visit is saved
 * under a new id ('f1', 'f2', …) carrying its own `at` rectangle (no map pads since S2c.2), read by model.buildingRect. Pure: no DOM,
 * no clock (the caller passes `now`).
 */
import { createSim } from '../sim/core.js';
import { createStructure } from '../sim/entities.js';
import { buildNavGrid } from '../sim/pathfinding.js';
import { getStructureDef } from '../data/tables.js';
import { outpostStructId, OUTPOST_BUILDING_KINDS } from '../data/outpostStructures.js';
import { structureDef, surfaceResource, surfaceStock } from '../data/outpost.js';
import { buildingRect, surfaceFieldGroups, fieldStock, harvestPlan, resourceBayPad, powerGrids, hopperUnits, hopperCap, upgradeRefusal } from './model.js';
import { resourceNode, spawnHarvester, initContract } from '../sim/harvest.js';
import { raidSimMap } from './raid.js';
import { outpostPlacementRules } from './placementRules.js';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const isBuilding = (kind) => OUTPOST_BUILDING_KINDS.includes(kind);
/** fraction of a timed job done at `now` → the sim's progress; and the wall-clock end of a job at `progress`. */
const progressOf = (since, done, now) => (done > since ? clamp01((now - since) / (done - since)) : 1);
const doneAt = (since, done, progress, now) => Math.round(now + (1 - progress) * (done - since));
const sinceOf = (done, ms) => done - ms;   // a pad job records only `done`; its start is `done − its Build_Sec`

/** sim/structures.js opt-in: an outpost DEFENSE the raid destroys stays as a wreck; a building is gone (as fromLiveSim saves). */
function keepDefenseWreck(s) {
  let def = null;
  try { def = getStructureDef(s.structId); } catch (e) { return false; }
  return !!(def && def.outpostKind && !isBuilding(def.outpostKind));
}

function addStructure(state, kind, cell, tier) {
  const id = outpostStructId(kind), def = getStructureDef(id);
  const s = createStructure(state, id, { x: cell[0], y: cell[1] });
  s.tier = tier;
  s.maxHp = def.hp[tier - 1];
  s.hp = s.maxHp;
  s.dps = def.dps[tier - 1];
  s.invested = def.cost[tier - 1];
  s.lifecycle = 'Complete';
  s.progress = 0;
  state.structures.set(s.id, s);
  return s;
}

/**
 * The outpost as a live SimState. outpost: save.outposts[planet] (already advanced to `now`). ctx: { map (the outpost
 * map), now (ms), gold (the player's gold), unlocks, techOwned (the save's owned Outpost tech and tree ids, as the
 * model's ctx: session.js ctxFor) }. → { state, link } — keep `link` for fromLiveSim.
 */
export function toLiveSim(outpost, { map, now, gold = 0, unlocks = null, techOwned = null }) {
  if (!map) throw new Error('toLiveSim: ctx.map (the outpost map) is required');
  if (now == null) throw new Error('toLiveSim: ctx.now is required');
  // the raid's board, with no building cells blocked: here the buildings are structures and block by themselves
  const simMap = raidSimMap({ ...outpost, pads: {} }, map);
  const state = createSim(outpost.seed >>> 0, { map: simMap, waves: [] });
  state.base.cannon = null;                  // the hub has no super-cannon
  state.economy.money = gold;
  state.economy.incomePerSec = 0;            // an outpost earns by mining and kills, not a battle's passive income
  state.placementRules = outpostPlacementRules(map, getStructureDef);
  const link = { outpost, map, ids: null, wrecks: null, now, harvest: null };
  // the battle's upgrade command on an outpost structure asks the outpost's own rule (model.upgradeRefusal: tech
  // unlocks, the Upgrade Bay and its power, the tree's tiers) — the save's rule, not a copy [MM-task_mwcunn53_3f]
  state.upgradeRules = [outpostUpgradeRule(link, { unlocks: unlocks || [], techOwned: techOwned || [] })];
  const padAt = (id) => buildingRect(outpost, map, id);
  const ids = new Map();                     // sim structure id → { pad, extra } | { defense, extra }
  const byPad = new Map();

  // finished buildings (the hub is the base)
  for (const [pad, b] of Object.entries(outpost.pads)) {
    if (b.kind === 'hub') continue;
    const p = padAt(pad);
    if (!p) throw new Error(`toLiveSim: building on unknown pad ${pad}`);
    const { kind, tier, ...extra } = b;
    const s = addStructure(state, kind, [p.x, p.y], tier);
    ids.set(s.id, { pad, extra });
    byPad.set(pad, s);
  }
  // construction and upgrades on pads
  for (const job of outpost.building || []) {
    const p = padAt(job.pad);
    if (!p) throw new Error(`toLiveSim: job on unknown pad ${job.pad}`);
    const ms = (structureDef(job.kind, job.tier) || {}).buildSec * 1000 || 0;
    const progress = progressOf(sinceOf(job.done, ms), job.done, now);
    const up = byPad.get(job.pad);
    if (up) { up.lifecycle = 'Upgrading'; up.progress = progress; ids.get(up.id).job = true; continue; }
    const { pad, kind, tier, done, ...extra } = job;
    const s = addStructure(state, kind, [p.x, p.y], 1);
    s.lifecycle = 'Building';
    s.progress = progress;
    ids.set(s.id, { pad, extra, building: true });
  }
  // defenses. A wreck at 0 HP is an inert 'Wrecked' structure (sim/structures.js opt-in wrecks): drawn, smoking and
  // sparking (render3d/fx/structureFx.js), but it blocks no raider, is never targeted, never fires and draws no power
  // in the sim — as a raid treats it. A defense a raid destroys during the visit becomes one the same tick
  // (state.keepWreck), so it is in the save as a wreck, never lost between two reads [MM-story_mwcrfnyf_3c].
  const wrecks = [];
  state.keepWreck = keepDefenseWreck;
  for (const d of outpost.defenses) {
    const { id, kind, tier, cell, hp, building, selling, ...extra } = d;
    const s = addStructure(state, kind, cell, tier);
    if (!(hp > 0)) {
      wrecks.push(d);
      s.hp = 0; s.lifecycle = 'Wrecked';
      ids.set(s.id, { defense: id, extra });
      continue;
    }
    s.hp = Math.min(hp, s.maxHp);
    s.lifecycle = s.hp < s.maxHp ? 'Damaged' : 'Complete';
    if (building) { s.lifecycle = 'Building'; s.progress = progressOf(building.since, building.done, now); }
    if (selling) { s.lifecycle = 'Selling'; s.progress = progressOf(selling.since, selling.done, now); }
    const u = outpost.upgrading && outpost.upgrading.id === id ? outpost.upgrading : null;
    if (u) { s.lifecycle = 'Upgrading'; s.progress = progressOf(u.since, u.done, now); }
    ids.set(s.id, { defense: id, extra, building, selling, upgrading: u });
  }
  state.navGrid = buildNavGrid(state.map, Array.from(state.structures.values()));
  Object.assign(link, { ids, wrecks, harvest: seedHarvest(state, outpost, map) });
  return { state, link };
}

/**
 * sim/structures.js state.upgradeRules entry: an outpost structure's upgrade, refused as the save refuses it. Reads the
 * live state as the save would see it at the sim's time (fromLiveSim, as syncHarvestPower does) and asks the model's
 * upgradeRefusal for that building's pad or that defense. Gold is the sim's own check (no ctx.gold). Not an outpost
 * structure → null.
 */
function outpostUpgradeRule(link, owned) {
  return (state, s) => {
    let def = null;
    try { def = getStructureDef(s.structId); } catch (e) { return null; }
    if (!def || !def.outpostKind) return null;
    const now = link.now + Math.round(state.time * 1000), where = new Map();
    const o = fromLiveSim(state, link, now, where).outpost;
    const target = where.get(s.id);
    if (!target) return null;
    return upgradeRefusal(o, target, { map: link.map, now, ...owned });
  };
}

const TIER_OF_COLOR = { blue: 'common', yellow: 'uncommon' };
/** Each surface field's stock in the live state: { [fieldId]: units } (the sum of its nodes, in node order). */
function liveFieldStock(state) {
  const out = {};
  for (const n of state.resourceNodes || []) out[n.fieldId] = (out[n.fieldId] || 0) + n.remaining;
  return out;
}

/**
 * The surface fields as sim resource nodes and the harvesters as sim harvesters (S4). A field's saved stock fills its
 * cells in order; every cell regrows its share of the field's rate (harvest.js stepFieldRegrowth). The trucks run only
 * when the closed form's would: a finished, powered Resource Bay (u.parked otherwise; syncHarvestPower follows power
 * changes during the visit) and room in the hopper (state.harvestRoom: loads stop when it is full, nothing overflows).
 * -> { loaded: { [fieldId]: units }, trucks } for fromLiveSim, or null with no fields.
 */
function seedHarvest(state, outpost, map) {
  const groups = surfaceFieldGroups(map);
  if (!groups.length) return null;
  const stock = fieldStock(outpost, map), per = surfaceStock();
  state.resourceNodes = [];
  for (const f of groups) {
    const res = surfaceResource(f.tier), cell = per[f.tier];
    let left = stock[f.id];
    for (const [x, y] of f.cells) {
      const remaining = Math.max(0, Math.min(cell.units, left));
      left -= remaining;
      state.resourceNodes.push(resourceNode({ id: `sf:${x},${y}`, fieldId: f.id, type: res.type, role: res.role, color: res.color,
        wave: 1, x, y, units: cell.units, remaining, regrow: cell.regrow }));
    }
  }
  state.harvesterIds = [];
  state.mapScore = { goldFromPrimary: 0, goldFromPremium: 0, questUnits: 0, questRed: 0, questGreen: 0 };
  state.contract = initContract({ common: 0, uncommon: 0, rare: 0, epic: 0 });   // every load is kept, none is sold
  // the outpost's harvesters are bought for the Resource Bay (model.buyHarvester), not at the base as in a battle
  state.harvesterBuyRefusal = 'harvesters are bought for the Resource Bay';
  const loaded = liveFieldStock(state);
  const plan = harvestPlan(outpost, map), bay = resourceBayPad(outpost);
  if (!plan.length) return { loaded, trucks: 0 };
  const powered = powerGrids(outpost, map).powered.has(bay);
  state.harvestRoom = Math.max(0, hopperCap(outpost, map) - hopperUnits(outpost));   // the hopper's room (owner: stop when full)
  // the docks: open cells around the bay, each truck taking the free one nearest its field (deterministic: distance, y, x)
  const r = buildingRect(outpost, map, bay);
  const nav = buildNavGrid(state.map, Array.from(state.structures.values()), state.base.cells || []);
  const ring = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    if (!inside && x >= 0 && y >= 0 && x < nav.cols && y < nav.rows && nav.passable[y * nav.cols + x]) ring.push({ x, y });
  }
  const taken = new Set();
  for (const h of plan) {
    const d = (c) => Math.hypot(c.x - h.field[0], c.y - h.field[1]);
    const dock = ring.filter((c) => !taken.has(`${c.x},${c.y}`)).sort((a, b) => d(a) - d(b) || a.y - b.y || a.x - b.x)[0]
      || { x: r.x, y: r.y + r.h };
    taken.add(`${dock.x},${dock.y}`);
    const u = spawnHarvester(state, dock);
    if (!u) break;
    u.fieldId = h.fieldId;
    u.fieldLock = true;                        // the closed form's rule: a harvester stays on its field
    u.parked = !powered;                       // no power, no operation (the closed form's harvestRunning)
  }
  return { loaded, trucks: plan.length };
}

/**
 * The visit's harvest into the save (S4): the fields' live stock, and into the hopper what the trucks unloaded (the
 * contract's kept units) plus what they still carry (it left the fields); the live state kept it within the hopper's room. Nothing changes when
 * nothing moved, so a visit with no time saves back exactly what was loaded. Mutates o.
 */
function saveHarvest(o, state, link, now) {
  const { loaded } = link.harvest, live = liveFieldStock(state), caps = new Map(surfaceFieldGroups(link.map).map((f) => [f.id, f.cap]));
  for (const [id, units] of Object.entries(live)) {
    if (units === loaded[id]) continue;
    o.fields = o.fields || {};
    if (units >= caps.get(id) - 1e-9) delete o.fields[id]; else o.fields[id] = Math.max(0, units);
  }
  const got = {};
  const kept = (state.contract && state.contract.kept) || {};
  for (const t of ['common', 'uncommon']) if (kept[t] > 0) got[t] = kept[t];
  for (const id of state.harvesterIds || []) {
    const u = state.units.get(id);
    if (!u || !(u.cargo > 0)) continue;
    for (const [color, part] of Object.entries(u.cargoMix || {})) {
      const t = TIER_OF_COLOR[color];
      if (t && part.units > 0) got[t] = (got[t] || 0) + part.units;
    }
  }
  if (Object.keys(got).length) {
    o.hopper = o.hopper || {};
    // the live state never gathers past the hopper's room (state.harvestRoom), so nothing here is clamped or lost
    for (const t of ['common', 'uncommon']) {
      const add = got[t] || 0;
      if (!(add > 0)) continue;
      o.hopper[t] = (o.hopper[t] || 0) + add;
      if (o.lifetime) o.lifetime.harvested[t] = (o.lifetime.harvested[t] || 0) + add;
    }
  }
  if (now > link.now) {
    const prev = o.liveHarvest;
    o.liveHarvest = { from: prev ? Math.min(prev.from, link.now) : link.now, to: Math.max(now, prev ? prev.to : now) };
  }
}

/**
 * Power changes during a visit (owner 2026-11-11): park the outpost's trucks when their Resource Bay has no power and
 * start them again when it has — a station built, sold or upgraded, a pylon placed. Reads the live state as the save
 * would see it (fromLiveSim → model.powerGrids), so it is the closed form's own power rule. The session calls it on the
 * sim's tick count (sessionView afterTick), never on the wall clock. → whether the bay is powered (null: no trucks).
 */
export function syncHarvestPower(state, link) {
  if (!link.harvest || !link.harvest.trucks) return null;
  const o = fromLiveSim(state, link, link.now + Math.round(state.time * 1000)).outpost;
  const bay = resourceBayPad(o);
  const powered = !!bay && powerGrids(o, link.map).powered.has(bay);
  for (const id of state.harvesterIds || []) {
    const u = state.units.get(id);
    if (u && u.fieldLock) u.parked = !powered;
  }
  return powered;
}

/**
 * The live SimState back into the save at `now`. → { outpost, gold }. A building placed during the visit gets a new
 * free id and its own `at` rectangle. `where` (optional Map) is filled with each sim structure id → its place in the
 * save: { pad } for a building, { defense: id } for a defense (the upgrade rule above reads it).
 */
export function fromLiveSim(state, link, now, where = null) {
  const { outpost: before, map, ids } = link;
  const o = clone(before);
  o.pads = {};
  for (const [pad, b] of Object.entries(before.pads)) if (b.kind === 'hub') o.pads[pad] = clone(b);
  const padJobs = [], defenses = new Map(), newDefenses = [];
  let upgrading = null;
  // a building placed during the visit: a new free id + its own rectangle (S2c.2: the maps have no pads)
  const taken = new Set([...Object.keys(before.pads), ...(before.building || []).map((j) => j.pad)]);
  let nextFree = 1 + Math.max(0, ...[...taken].filter((id) => /^f\d+$/.test(id)).map((id) => +id.slice(1)));
  const placeOf = (s, def) => {
    const id = `f${nextFree++}`;
    taken.add(id);
    const extra = { at: { x: s.pos.x, y: s.pos.y, w: def.footprint.w, h: def.footprint.h } };
    if (def.outpostKind === 'rig') {
      const dep = (map.deposits || []).find((d) => d.x === s.pos.x && d.y === s.pos.y);
      if (dep) { extra.deposit = dep.tier; extra.deep = false; }
    }
    return { pad: id, extra };
  };
  let nextDefense = Math.max(0, ...before.defenses.map((d) => +String(d.id).slice(1) || 0)) + 1;

  for (const s of state.structures.values()) {
    const def = getStructureDef(s.structId), kind = def.outpostKind;
    if (!kind) continue;                       // not an outpost structure
    const e = ids.get(s.id) || null;
    if (s.lifecycle === 'Destroyed' || s.lifecycle === 'Wrecked') {
      // a defense a raid destroyed stays in the save as a WRECK at 0 HP — repaired, it fights again (as in a raid);
      // a sold one is gone from the sim altogether (structures.js deletes it) [MM-subtask_mwcij14c_33]. 'Wrecked': a
      // wreck from before the visit, or one the sim kept the tick it was destroyed (state.keepWreck)
      if (!isBuilding(kind)) {
        const id = e ? e.defense : `d${nextDefense++}`;
        const wreck = { id, kind, tier: s.tier, cell: [s.pos.x, s.pos.y], hp: 0, ...(e ? e.extra : {}) };
        if (e) defenses.set(id, wreck); else newDefenses.push(wreck);
      }
      continue;
    }
    if (isBuilding(kind)) {
      if (s.lifecycle === 'Selling') continue;  // buildings sell at once
      const at = e ? { pad: e.pad, extra: e.extra } : placeOf(s, def);
      const pad = at.pad, extra = at.extra;
      if (where) where.set(s.id, { pad });
      if (s.lifecycle === 'Building') {
        const ms = structureDef(kind, 1).buildSec * 1000;
        const { deep, ...jobExtra } = extra;   // a job carries its spot and deposit; `deep` belongs to the finished rig
        padJobs.push({ pad, kind, tier: 1, done: Math.round(now + (1 - s.progress) * ms), ...jobExtra });
        continue;
      }
      o.pads[pad] = { kind, tier: s.tier, ...extra };
      if (s.lifecycle === 'Upgrading') {
        const ms = structureDef(kind, s.tier + 1).buildSec * 1000;
        padJobs.push({ pad, kind, tier: s.tier + 1, done: Math.round(now + (1 - s.progress) * ms) });
      }
      continue;
    }
    // a defense
    const id = e ? e.defense : `d${nextDefense++}`;
    if (where) where.set(s.id, { defense: id });
    const d = { id, kind, tier: s.tier, cell: [s.pos.x, s.pos.y], hp: s.hp, ...(e ? e.extra : {}) };
    if (s.lifecycle === 'Building') {
      const b = (e && e.building) || { since: now, done: now + def.buildTime * 1000 };
      d.building = { since: b.since, done: doneAt(b.since, b.done, s.progress, now) };
    }
    if (s.lifecycle === 'Selling') {
      const b = (e && e.selling) || { since: now, done: now + (def.sellTime || 0) * 1000 };
      d.selling = { since: b.since, done: doneAt(b.since, b.done, s.progress, now) };
    }
    if (s.lifecycle === 'Upgrading') {
      const u = (e && e.upgrading) || { since: now, done: now + (structureDef(kind, s.tier + 1) || {}).buildSec * 1000 };
      upgrading = { id, kind, tier: s.tier + 1, done: doneAt(u.since, u.done, s.progress, now), since: u.since };
    }
    if (e) defenses.set(id, d); else newDefenses.push(d);
  }
  // keep the save's order: pad jobs as they were (new ones after), defenses as they were (wrecks in place, new last)
  const jobKey = (j) => `${j.pad}:${j.tier}`;
  const oldJobs = (before.building || []).map(jobKey);
  padJobs.sort((a, b) => ((oldJobs.indexOf(jobKey(a)) + 1 || 1e9) - (oldJobs.indexOf(jobKey(b)) + 1 || 1e9)));
  o.building = padJobs;
  o.defenses = [];
  for (const d of before.defenses) if (defenses.has(d.id)) o.defenses.push(defenses.get(d.id));   // wrecks are live structures too
  o.defenses.push(...newDefenses);
  o.upgrading = upgrading || null;
  if (before.upgrading == null && upgrading == null && !('upgrading' in before)) delete o.upgrading;
  if (link.harvest) saveHarvest(o, state, link, now);
  return { outpost: o, gold: state.economy.money };
}
