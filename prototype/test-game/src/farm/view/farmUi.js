/**
 * src/farm/view/farmUi.js — what the FARM tab shows: its build list and its panels [MM-story_mwabgs3l_f].
 *
 * The outpost view's FARM tab (Farming-Design §2.3: "a tab switches between OUTPOST and FARM on the same map"). It is the
 * outpost's own build list, placement loop and panel (src/outpost/view/buildMenu.js, hud.js), fed farm items: nothing
 * of the outpost view is rebuilt (owner rule 7). The model is src/farm/model.js; the map's ground rule is
 * src/farm/cells.js (passed in as ctx.cellOk).
 *
 * Pure: (outpost, map, ctx) → plain objects the HUD renders. ctx: { gold, now, methods, cellOk, pods, held, room,
 * delivered, f1 } — pods: the save's s.pods; held: the farm store for this planet ({ cropId: units }).
 */
import { methodOf, farmBuildingOf, cropOf, podLevel, POD_LEVELS, yieldOf, prepCost, CROPS } from '../../data/farm.js';
import { occupied, plotState, storeCapacity, farmStatus, walkwayHit } from '../model.js';
import { windowSec } from '../grow.js';

/** The FARM tab's build list, top to bottom: the two Phase A methods, then the farm buildings the player buys. */
export const FARM_MENU = Object.freeze([
  { id: 'traditional', label: 'TRADITIONAL PLOT', what: 'plot' },
  { id: 'irrigated', label: 'IRRIGATED PLOT', what: 'plot' },
  { id: 'silo', label: 'SILO', what: 'building' },
  { id: 'pump', label: 'PUMP', what: 'building' },
].map(Object.freeze));

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const sizeOf = (it) => (it.what === 'plot' ? methodOf(it.id) : farmBuildingOf(it.id));
const STATE_NAME = { prepping: 'Prepping', prepped: 'Prepped: ready to plant', planted: 'Planted', sprout: 'Sprout', plant: 'Growing', fruited: 'Fruited: harvest now', dead: 'Dead: harvest for the pods back', harvested: 'Harvested: prep to plant again' };
const TONE = { prepping: 'busy', prepped: 'ok', planted: 'busy', sprout: 'busy', plant: 'busy', fruited: 'ok', dead: 'warn', harvested: 'warn' };
const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`; };

/**
 * Where an item can go: the top-left cells where it fits — on the map, off everything that takes ground (pads,
 * defenses, the farm's own things: model.occupied) and on ground the map's rule allows (ctx.cellOk, src/farm/cells.js).
 * The same tests the model's place* run, without cloning the outpost per cell (a 64 × 32 map is 2,048 spots per item).
 * → { targets: [{ cell }], error } (error: the first refusal, when there is no target)
 */
export function farmTargets(o, map, id, ctx = {}) {
  const it = FARM_MENU.find((m) => m.id === id);
  if (!it) return { targets: [], error: 'unknown item' };
  const sz = sizeOf(it), taken = occupied(o, map), targets = [];
  let error = null;
  for (let y = 0; y + sz.h <= map.height; y++) {
    for (let x = 0; x + sz.w <= map.width; x++) {
      const r = { x, y, w: sz.w, h: sz.h };
      const hit = taken.find((t) => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h);
      const crowd = hit ? null : walkwayHit(o, r);   // the walkway between farm things (owner 2026-11-10)
      const why = hit ? `the ground is taken (${hit.what})` : crowd ? `keep a walkway clear of the ${crowd.what.replace(/ \S+$/, '')}` : ctx.cellOk ? ctx.cellOk(r) : null;
      if (why) { error = error || why; continue; }
      targets.push({ cell: [x, y] });
    }
  }
  return { targets, error: targets.length ? null : error };
}

/**
 * The FARM tab's build list, in the outpost build list's shape (buildMenu.js), so the HUD's rail and the placement
 * reducer take it as they are. → [{ id, kind, label, place: 'cell', cost, poor, locked, why, enabled, targets, size, key }]
 */
export function farmMenu(o, map, ctx = {}) {
  const gold = ctx.gold ?? Infinity, methods = ctx.methods || ['traditional'];
  return FARM_MENU.map((m, i) => {
    const sz = sizeOf(m);
    const out = { id: m.id, kind: m.id, label: m.label, place: 'cell', what: m.what, size: { w: sz.w, h: sz.h }, key: String(i + 1) };
    out.cost = m.what === 'plot' ? prepCost(m.id).gold : sz.cost;
    if (m.what === 'plot' && !methods.includes(m.id)) { out.locked = true; out.why = `${sz.name} is not unlocked yet`; out.targets = []; }
    else {
      const t = farmTargets(o, map, m.id, ctx);
      out.targets = t.targets; out.locked = !t.targets.length;
      out.why = out.locked ? (t.error || 'No free ground').replace(/^./, (c) => c.toUpperCase()) : null;
    }
    out.poor = out.cost > gold;
    if (!out.locked && out.poor) out.why = `Costs ${fmt(out.cost)} gold`;
    out.enabled = !out.locked && !out.poor;
    return out;
  });
}

/** What farm thing stands on a cell: { plot: id } | { farm: id } | null. */
export function farmAt(o, x, y) {
  if (!o.farm) return null;
  const inR = (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const p of Object.values(o.farm.plots)) if (inR(p)) return { plot: p.id };
  for (const [id, b] of Object.entries(o.farm.buildings)) if (inR(b)) return { farm: id };
  return null;
}

/** The pods held that could plant this plot (one per row), Common first: [{ crop, level, n, name, colour }]. */
export function plantChoices(plot, pods = {}) {
  const need = methodOf(plot.method).pods, out = [];
  for (const c of CROPS) {
    const row = pods[c.id] || {};
    for (const L of POD_LEVELS) if ((row[L.level] || 0) >= need) out.push({ crop: c.id, level: L.level, n: row[L.level], name: c.name, levelName: L.name, colour: L.colour });
  }
  return out;
}

const sellValue = (cropId) => {
  const c = cropOf(cropId);
  return c && (c.tier === 'common' ? 1 : c.tier === 'uncommon' ? 2 : 0);
};
/** Crops the farm store can sell now (the battle's price per unit: common 1, uncommon 2; rare and epic are kept). */
export function sellable(held = {}) {
  let gold = 0, units = 0;
  for (const [id, u] of Object.entries(held)) { const v = sellValue(id); if (v && u > 0) { gold += v * Math.floor(u); units += Math.floor(u); } }
  return { gold, units };
}

/**
 * The panel for a plot or a farm building, in hud.panel's shape: { title, sub, status, tone, stats, bay?, warnings?,
 * actions: [{ act, arg?, label, enabled, why? }], note? }. sel: { plot } | { farm }.
 */
export function farmPanelModel(o, map, sel, ctx = {}) {
  if (!o.farm) return null;
  const now = ctx.now ?? o.t, gold = ctx.gold ?? Infinity;
  if (sel.plot) {
    const p = o.farm.plots[sel.plot];
    if (!p) return null;
    const m = methodOf(p.method), st = plotState(o, p, now);
    const out = { kind: 'plot', title: `${m.name}`, sub: `${p.w} × ${p.h} at ${p.x}, ${p.y}`, status: STATE_NAME[st], tone: TONE[st], stats: [], actions: [] };
    if (p.crop) {
      const c = cropOf(p.crop), L = podLevel(p.level);
      out.stats.push(['Crop', `${c.name} · ${L.name} pods`]);
      if (st === 'fruited' || st === 'dead') {
        const left = p.ripeAt + windowSec(p) * 1000 - now;   // the Fruited window (Fruited_Window × its grow time)
        out.stats.push([st === 'fruited' ? 'Dies in' : 'Died', st === 'fruited' ? clock(left / 1000) : 'pods come back on harvest']);
      } else {
        out.stats.push(['Grown', `${Math.floor(p.progress * 100)}%`]);
        out.bay = p.progress; out.oreColour = L.colour;
      }
      out.stats.push(['Yield', `${fmt(Math.floor(yieldOf(p.crop, p.method, p.level) * (p.yieldShare ?? 1)))} ${c.name}${(p.yieldShare ?? 1) < 1 ? ' (trampled)' : ''}`]);
      if (st === 'fruited' || st === 'dead') {
        const units = Math.floor(yieldOf(p.crop, p.method, p.level) * (p.yieldShare ?? 1));
        const full = st === 'fruited' && units > (ctx.room ?? Infinity);
        out.actions.push({ act: 'harvest', arg: p.id, label: st === 'dead' ? 'HARVEST · pods back' : `HARVEST · ${fmt(units)}`, enabled: !full, why: full ? 'The Silo is full: sell or deliver to make room' : null });
        if (full) out.warnings = [{ text: 'Silo full: the crop waits, and dies at the end of its window' }];
      }
    } else if (st === 'prepped') {
      const choices = plantChoices(p, ctx.pods);
      for (const ch of choices.slice(0, 6)) out.actions.push({ act: 'plant', arg: `${ch.crop}:${ch.level}`, label: `PLANT ${ch.name} · ${ch.levelName} (${ch.n})`, colour: ch.colour, enabled: true });
      if (!choices.length) out.note = `No seed pods: ${m.pods} of one crop and level plant this plot. Battles bring Rare pods; F1 grants a crate.`;
    } else if (st === 'harvested') {
      const c = prepCost(p.method);
      out.actions.push({ act: 'prep', arg: p.id, label: `PREP · ${fmt(c.gold)}g`, enabled: c.gold <= gold, why: c.gold > gold ? `Costs ${fmt(c.gold)} gold` : null });
    } else if (st === 'prepping') out.stats.push(['Ready in', clock((p.prepDone - now) / 1000)]);
    return out;
  }
  const b = o.farm.buildings[sel.farm];
  if (!b) return null;
  const def = farmBuildingOf(b.kind), building = b.done > now;
  const out = { kind: b.kind, title: def.name, sub: `${b.w} × ${b.h} at ${b.x}, ${b.y}`, status: building ? `Building · ${clock((b.done - now) / 1000)}` : 'Online', tone: building ? 'busy' : 'ok', stats: [], actions: [] };
  const fs = farmStatus(o, map, { held: ctx.heldTotal || 0 });
  if (fs.unpowered.includes(sel.farm)) { out.status = 'No power'; out.tone = 'off'; }
  if (b.kind === 'farmhouse' || b.kind === 'silo') {
    const cap = storeCapacity(o, map), held = ctx.heldTotal || 0;
    out.stats.push(['Stored', `${fmt(held)} / ${fmt(cap)}`]); out.bay = cap ? Math.min(1, held / cap) : 0; out.oreColour = '#d9a441';
    if (held >= cap) out.warnings = [{ text: 'Storage full: harvests wait until you sell or deliver' }];
  }
  if (b.kind === 'farmhouse') {
    out.stats.push(['Fruited', String(fs.fruited)], ['Dead', String(fs.dead)], ['Growing', String(fs.growing)]);
    out.actions.push({ act: 'harvestAll', label: `HARVEST ALL (${fs.fruited + fs.dead})`, enabled: fs.fruited + fs.dead > 0 });
    const s = sellable(ctx.held);
    out.actions.push({ act: 'farmSell', label: s.units ? `SELL CROPS · +${fmt(s.gold)}g` : 'SELL CROPS', enabled: s.units > 0, why: s.units ? null : 'Nothing to sell' });
    if (ctx.f1) {
      const need = Math.max(0, ctx.f1.deliver - (ctx.delivered || 0)), have = Math.floor((ctx.held || {})[ctx.f1.crop] || 0);
      if (need > 0) out.actions.push({ act: 'deliver', arg: ctx.f1.crop, label: `DELIVER ${cropOf(ctx.f1.crop).name} · ${fmt(Math.min(need, have))}/${fmt(need)}`, enabled: have > 0, why: have ? null : `Harvest ${cropOf(ctx.f1.crop).name} first` });
    }
    out.note = 'The farm\'s hub. Seed pods are upgraded at the pod bench: STORES › Seed pods.';
  }
  if (b.kind === 'pump') out.stats.push(['Water reach', `${def.waterReach} cells`]);
  return out;
}
