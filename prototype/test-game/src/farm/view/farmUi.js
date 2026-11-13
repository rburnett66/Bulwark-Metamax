/**
 * src/farm/view/farmUi.js — what a selected plot or farm building shows, and the FARM tab's pictures [MM-story_mwabgs3l_f].
 *
 * Since S6 [MM-story_mwc9q1y6_2n] the farm is on the outpost's battle session: its build list is the shared rail's FARM
 * tab (farm/farmRail.js, data/farmStructures.js) and its placement the battle's own; what is left here is the panel a
 * selected plot or farm building shows (outpost/view/sessionView.js renders it), the rail's farm pictures and the
 * crop sale. The model is src/farm/model.js; the map's ground rule is src/farm/cells.js (passed in as ctx.cellOk).
 *
 * Pure: (outpost, map, ctx) → plain objects the HUD renders. ctx: { gold, now, methods, cellOk, pods, levels, held,
 * room, delivered, f1 } — pods: the save's s.pods ({ cropId: count }; pods have no level, owner rule 9); levels: every
 * crop's tech-tree level ({ cropId: 1–5 }, src/farm/levels.js cropLevels); held: the farm store for this planet.
 */
import { methodOf, farmBuildingOf, cropOf, podLevel, prepCost, CROPS } from '../../data/farm.js';
import { plotState, storeCapacity, farmStatus, plantLevel, plotPlants, plotFull, plotYield } from '../model.js';
import { podRowCount } from '../pods.js';
import { windowSec } from '../grow.js';
import { OUTPOST_GLYPHS } from '../../outpost/view/menuIcons.js';

/** A ripe crop's colour by category (the scale prototype's grain gold; the others read apart at a glance). */
export const RIPE = Object.freeze({ Grain: 0xe8c860, Vegetable: 0xb05ad8, Fruit: 0xff7a3a, Materials: 0xf2a33a, Minerals: 0xcfd8e0, Gems: 0x7ad8ff });

/**
 * The picture of a FARM-tab item on the shared battle rail (S6, hud.setBuildPicture's glyph): the farm glyphs the old
 * farm menu drew (outpost/view/menuIcons.js OUTPOST_GLYPHS) for plots and buildings; a crop is its seed head in its
 * category's ripe colour. → an SVG fragment (24 × 24), or null.
 */
export function farmRailGlyph(structId) {
  const id = String(structId || '').replace(/^FARM-/, '');
  if (OUTPOST_GLYPHS[id]) return OUTPOST_GLYPHS[id];
  if (!id.startsWith('crop-')) return null;
  const c = cropOf(id.slice(5));
  if (!c) return null;
  const col = '#' + (RIPE[c.category] || RIPE.Grain).toString(16).padStart(6, '0');
  return `<path d="M12 21V11" stroke="#4f9a37" stroke-width="2"/><path d="M12 15c-3-1-5-3-5-6 3 0 5 2 5 6zM12 15c3-1 5-3 5-6-3 0-5 2-5 6z" fill="#7bc24a"/><ellipse cx="12" cy="7" rx="3.2" ry="4.4" fill="${col}"/>`;
}

const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const STATE_NAME = { prepping: 'Prepping', prepped: 'Prepped: ready to plant', planted: 'Planted', sprout: 'Sprout', plant: 'Growing', fruited: 'Fruited: harvest now', dead: 'Dead: harvest for the pods back', harvested: 'Harvested: prep to plant again' };
const TONE = { prepping: 'busy', prepped: 'ok', planted: 'busy', sprout: 'busy', plant: 'busy', fruited: 'ok', dead: 'warn', harvested: 'warn' };
const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`; };

/**
 * The crops this plot could be planted with now (owner rule 9): one choice per crop with a plot's worth of pods (one
 * per row), each at the level it would actually grow at — the crop's tech-tree level (levels[crop], default 1), capped
 * by the plot (level 5 needs an Irrigated plot with water: model.plantLevel).
 * → [{ crop, n, name, level, techLevel, levelName, colour, capped, why }]
 */
export function plantChoices(o, map, plot, pods = {}, levels = {}) {
  const need = 1, full = methodOf(plot.method).pods, out = [];
  for (const c of CROPS) {
    const n = podRowCount(pods[c.id]);
    if (n < need) continue;
    const techLevel = levels[c.id] || 1, g = plantLevel(o, map, plot, techLevel), L = podLevel(g.level);
    out.push({ crop: c.id, n: Math.min(n, full), name: c.name, level: g.level, techLevel, levelName: L.name, colour: L.colour, capped: g.capped, why: g.why });
  }
  return out;
}

/** "level 5 needs irrigation" → "needs irrigation"; the short words of a cap, for a button. */
const capShort = (why) => String(why || '').replace(/^level 5 /, '').replace(/:.*$/, '');

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
      out.stats.push(['Crop', c.name], ['Level', `${p.level} · ${L.name}`]);
      out.levelColour = L.colour;
      if (st === 'fruited' || st === 'dead') {
        const left = p.ripeAt + windowSec(p) * 1000 - now;   // the Fruited window (Fruited_Window × its grow time)
        out.stats.push([st === 'fruited' ? 'Dies in' : 'Died', st === 'fruited' ? clock(left / 1000) : 'pods come back on harvest']);
      } else {
        out.stats.push(['Grown', `${Math.floor(p.progress * 100)}%`]);
        out.bay = p.progress; out.oreColour = L.colour;
      }
      out.stats.push(['Plants', `${plotPlants(p)} of ${plotFull(p)}`]);
      out.stats.push(['Yield', `${fmt(Math.floor(plotYield(p)))} ${c.name}${(p.yieldShare ?? 1) < 1 ? ' (trampled)' : ''}`]);
      if (st === 'fruited' || st === 'dead') {
        const units = Math.floor(plotYield(p));
        const full = st === 'fruited' && units > (ctx.room ?? Infinity);
        out.actions.push({ act: 'harvest', arg: p.id, label: st === 'dead' ? 'HARVEST · pods back' : `HARVEST · ${fmt(units)}`, enabled: !full, why: full ? 'The Silo is full: sell or deliver to make room' : null });
        if (full) out.warnings = [{ text: 'Silo full: the crop waits, and dies at the end of its window' }];
      }
    } else if (st === 'prepped') {
      const choices = plantChoices(o, map, p, ctx.pods, ctx.levels);
      for (const ch of choices.slice(0, 6)) {
        out.actions.push({ act: 'plant', arg: ch.crop, level: ch.level, colour: ch.colour, enabled: true, why: ch.capped ? `Level ${ch.level}: ${ch.why}` : null,
          label: `PLANT ${ch.name} · L${ch.level} ${ch.levelName}${ch.capped ? ` (L5 ${capShort(ch.why)})` : ''} · ${ch.n} pod${ch.n === 1 ? '' : 's'}` });
      }
      const capped = choices.find((ch) => ch.capped);
      if (capped) out.note = `Level ${capped.level} — ${capped.why}.`;
      if (!choices.length) out.note = `No seed pods: each pod plants one plant, up to ${m.pods} a plot. Buy them at STORES › Seed pods; a won map's Pod Reward Chest brings them; F1 grants a crate.`;
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
    out.note = 'The farm\'s hub. Crop levels are researched in the Tech Tree (OUTPOST & FARM › SEED PODS); seed pods are bought at STORES › Seed pods.';
  }
  if (b.kind === 'pump') out.stats.push(['Water reach', `${def.waterReach} cells`]);
  return out;
}
