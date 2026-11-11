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
 * Positions (S2c [MM-story_mwc9pmbn_2i]): a building on a map pad keeps that pad's id; one placed anywhere else is saved
 * under a new id ('f1', 'f2', …) carrying its own `at` rectangle, and model.buildingRect answers for both. Pure: no DOM,
 * no clock (the caller passes `now`).
 */
import { createSim } from '../sim/core.js';
import { createStructure } from '../sim/entities.js';
import { buildNavGrid } from '../sim/pathfinding.js';
import { getStructureDef } from '../data/tables.js';
import { outpostStructId, OUTPOST_BUILDING_KINDS } from '../data/outpostStructures.js';
import { structureDef } from '../data/outpost.js';
import { buildingRect } from './model.js';
import { raidSimMap } from './raid.js';
import { outpostPlacementRules } from './placementRules.js';

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const isBuilding = (kind) => OUTPOST_BUILDING_KINDS.includes(kind);
/** fraction of a timed job done at `now` → the sim's progress; and the wall-clock end of a job at `progress`. */
const progressOf = (since, done, now) => (done > since ? clamp01((now - since) / (done - since)) : 1);
const doneAt = (since, done, progress, now) => Math.round(now + (1 - progress) * (done - since));
const sinceOf = (done, ms) => done - ms;   // a pad job records only `done`; its start is `done − its Build_Sec`

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
 * map), now (ms), gold (the player's gold) }. → { state, link } — keep `link` for fromLiveSim.
 */
export function toLiveSim(outpost, { map, now, gold = 0 }) {
  if (!map) throw new Error('toLiveSim: ctx.map (the outpost map) is required');
  if (now == null) throw new Error('toLiveSim: ctx.now is required');
  // the raid's board, with no building cells blocked: here the buildings are structures and block by themselves
  const simMap = raidSimMap({ ...outpost, pads: {} }, map);
  const state = createSim(outpost.seed >>> 0, { map: simMap, waves: [] });
  state.base.cannon = null;                  // the hub has no super-cannon
  state.economy.money = gold;
  state.economy.incomePerSec = 0;            // an outpost earns by mining and kills, not a battle's passive income
  state.placementRules = outpostPlacementRules(map, getStructureDef);
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
  // defenses (a wreck at 0 HP stays out of the sim until it is repaired — as in a raid)
  const wrecks = [];
  for (const d of outpost.defenses) {
    if (!(d.hp > 0)) { wrecks.push(d); continue; }
    const { id, kind, tier, cell, hp, building, selling, ...extra } = d;
    const s = addStructure(state, kind, cell, tier);
    s.hp = Math.min(hp, s.maxHp);
    s.lifecycle = s.hp < s.maxHp ? 'Damaged' : 'Complete';
    if (building) { s.lifecycle = 'Building'; s.progress = progressOf(building.since, building.done, now); }
    if (selling) { s.lifecycle = 'Selling'; s.progress = progressOf(selling.since, selling.done, now); }
    const u = outpost.upgrading && outpost.upgrading.id === id ? outpost.upgrading : null;
    if (u) { s.lifecycle = 'Upgrading'; s.progress = progressOf(u.since, u.done, now); }
    ids.set(s.id, { defense: id, extra, building, selling, upgrading: u });
  }
  state.navGrid = buildNavGrid(state.map, Array.from(state.structures.values()));
  return { state, link: { outpost, map, ids, wrecks, now } };
}

/**
 * The live SimState back into the save at `now`. → { outpost, gold }. Throws (loudly) for a building that stands on no
 * map pad — the pad-based save cannot hold it until S2c.
 */
export function fromLiveSim(state, link, now) {
  const { outpost: before, map, ids } = link;
  const o = clone(before);
  o.pads = {};
  for (const [pad, b] of Object.entries(before.pads)) if (b.kind === 'hub') o.pads[pad] = clone(b);
  const padJobs = [], defenses = new Map(), newDefenses = [];
  let upgrading = null;
  // a building placed during the visit: on a free map pad it takes that pad's id; anywhere else a new free id + its rect
  const taken = new Set([...Object.keys(before.pads), ...(before.building || []).map((j) => j.pad)]);
  let nextFree = 1 + Math.max(0, ...[...taken].filter((id) => /^f\d+$/.test(id)).map((id) => +id.slice(1)));
  const placeOf = (s, def) => {
    const p = map.pads.find((q) => q.x === s.pos.x && q.y === s.pos.y && q.w === def.footprint.w && q.h === def.footprint.h && !taken.has(q.id));
    if (p) { taken.add(p.id); return { pad: p.id, extra: {} }; }
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
    if (s.lifecycle === 'Destroyed') continue;
    const def = getStructureDef(s.structId), kind = def.outpostKind;
    if (!kind) continue;                       // not an outpost structure
    const e = ids.get(s.id) || null;
    if (isBuilding(kind)) {
      if (s.lifecycle === 'Selling') continue;  // buildings sell at once
      const where = e ? { pad: e.pad, extra: e.extra } : placeOf(s, def);
      const pad = where.pad, extra = where.extra;
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
  for (const d of before.defenses) {
    if (!(d.hp > 0)) o.defenses.push(clone(d));
    else if (defenses.has(d.id)) o.defenses.push(defenses.get(d.id));
  }
  o.defenses.push(...newDefenses);
  o.upgrading = upgrading || null;
  if (before.upgrading == null && upgrading == null && !('upgrading' in before)) delete o.upgrading;
  return { outpost: o, gold: state.economy.money };
}
