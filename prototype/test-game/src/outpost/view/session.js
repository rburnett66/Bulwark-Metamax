/**
 * src/outpost/view/session.js — the outpost view's link to the save [MM-story_mw5oeer7_n].
 *
 * Every change the view makes goes through src/outpost/model.js against the save, then
 * missionFlow.settleOutpost, so the outpost contract's missions progress (tech plan docs/tech-plan/Outpost.md §5,
 * "As built (O3)"; §6.1). Each action first advances the saved outpost to `now`, so what the player acts on is
 * what the screen shows.
 *
 * Pure apart from the store: no DOM, no clock. The view reads the wall clock (Date.now()) and passes it in; the
 * review page passes its own clock and an in-memory store. store: { load() → save, update(fn) → save }
 * (save.js loadSave / updateSave in the game).
 *
 * Raids: the hook comes from raidSeam.raidHookFor (story O7 plugs the battle sim in there).
 */
import { advance, sell, place, upgrade, repair, repairCost, setDeep, confirmOnline, onlineProblems, windowMs, emptyHopper, upgradeDefense } from '../model.js';
import * as Model from '../model.js';
import { outpostUnlocks } from '../contract.js';
import { bankOutpostHarvest } from '../../save/inventory.js';
import { startingOwned } from '../../data/techtree.js';
import { PLANETS } from '../../data/planets.js';
import { settleOutpost, flowCtx } from '../../save/missionFlow.js';
import { bankOf } from '../../save/save.js';
import { structureDef, OUTPOST, OUTPOST_TECH_IDS } from '../../data/outpost.js';
import { raidHookFor } from './raidSeam.js';
import { awayReportModel } from './awayReport.js';

const goldAdd = (s, n) => {
  s.carry = s.carry || { gold: 0, structures: [] };
  s.carry.gold = Math.max(0, (s.carry.gold || 0) + n);
  s.goldBank = s.carry.gold;
};
const stepOf = (s, planet) => ((s.outpostContracts || {})[planet] || {}).step || 1;

/**
 * createSession({ store, planet, map, catalog, raidHook? }) → the view's session.
 * catalog: the mission catalog (content/missions/missions.json); null skips settling (the missions can't load).
 * raidHook: overrides raidHookFor (tests, the review page's stand-in).
 */
export function createSession({ store, planet, map, catalog = null, raidHook, flowOpts = {} }) {
  const hookFor = (s) => (raidHook !== undefined ? raidHook : raidHookFor(map, stepOf(s, planet)));
  /**
   * The model's ctx for this save (story O10): unlockedTiers from the collected contracts; `unlocks` the Outpost tech
   * the player OWNS (a contract unlocks a node, the Tech Tree sells it, tech plan D7); techOwned every owned tree id
   * (tower tiers and docks reach the outpost through its Upgrade Bay); Cargo Shuttle II sets the shuttle tier.
   */
  const ctxFor = (s, now) => {
    const u = outpostUnlocks(s, planet), owned = startingOwned();
    for (const [id, on] of Object.entries((s.tech && s.tech.owned) || {})) if (on) owned.add(id);
    const unlocks = new Set(OUTPOST_TECH_IDS.filter((id) => owned.has(id)));
    return {
      map, now, gold: bankOf(s), raid: hookFor(s), shuttleTier: unlocks.has('cargo_shuttle_2') ? 2 : 1, farDiscovered: false,
      unlockedTiers: u.unlockedTiers, unlocks, techOwned: owned, contractUnlocks: u.unlocks, farBuyer: u.farBuyer,
    };
  };
  /**
   * Opening the outpost empties the Resource Bay's hopper into the inventory (design §6, story O10), through
   * src/save/inventory.js. Needs the mission catalogue (it names the planet's resources); without it the hopper waits.
   * → { [resourceId]: n } banked
   */
  function bankHopper(s) {
    const o = s.outposts && s.outposts[planet];
    if (!o || !catalog) return {};
    const e = emptyHopper(o);
    if (!Object.keys(e.units).length) return {};
    let banked = {};
    try { banked = bankOutpostHarvest(s, e.units, catalog, (PLANETS[planet] || {}).name || planet); } catch (err) { console.warn('[outpost] hopper', err); return {}; }
    s.outposts[planet] = e.outpost;
    return banked;
  }
  const settle = (s, now) => { if (catalog) return settleOutpost(s, catalog, flowCtx(s, { ...flowOpts, now })); return null; };
  let last = null;   // the outpost as last advanced (saved or a live copy)

  /** Advance the saved outpost to `now` inside a save update; returns the report. */
  function advanceSaved(s, now) {
    const o = s.outposts && s.outposts[planet];
    if (!o) return null;
    const r = advance(o, now, ctxFor(s, now));
    s.outposts[planet] = r.outpost;
    return r.report;
  }

  const api = {
    planet, map,
    /** The save as stored now. */
    save: () => store.load(),
    /** The outpost the screen should show (the last advance). */
    outpost: () => last || (store.load().outposts || {})[planet] || null,
    gold: () => bankOf(store.load()),
    /** The contract step and the unlocks, for the HUD and panels. */
    ctx(now) { return ctxFor(store.load(), now); },

    /**
     * Opening the view: advance the saved outpost to now (the away catch-up, raids fought through the hook), save it,
     * settle the missions. → { outpost, report, away } — away: the away report's model ({ show, rows… }).
     */
    open(now) {
      let report = null, settled = null, banked = {};
      const s = store.update((sv) => { report = advanceSaved(sv, now); banked = bankHopper(sv); settled = settle(sv, now); });
      last = s.outposts[planet] || null;
      if (report) report.banked = banked;
      return { outpost: last, report, away: awayReportModel(report, planet, map, catalog), settled, banked };
    },

    /**
     * The same catch-up spread over several calls (story O7: 72 h of raids on the battle sim costs up to ~600 ms cold):
     * advance is split-invariant, so the save is advanced one raid window (Raid_Min_Gap_Hours) at a time, saved after
     * each, and `pause()` (the view passes a next-frame wait) runs between windows. The reports are merged; the result
     * equals open(now). → Promise<{ outpost, report, away, settled }>
     */
    async openChunked(now, pause = async () => {}) {
      const s0 = store.load(), o0 = s0.outposts && s0.outposts[planet];
      if (!o0) return api.open(now);
      const step = windowMs(OUTPOST), stop = Math.min(now, o0.t + OUTPOST.Away_Cap_Hours * 3_600_000);
      let merged = null, t = o0.t;
      while (t < stop) {
        const to = Math.min(stop, t + step);
        let rep = null;
        store.update((sv) => { rep = advanceSaved(sv, to); });
        merged = mergeReports(merged, rep);
        t = to;
        if (t < stop) await pause();
      }
      let settled = null, banked = {};
      const s = store.update((sv) => { banked = bankHopper(sv); settled = settle(sv, now); });
      last = s.outposts[planet] || null;
      if (merged) merged.banked = banked;
      return { outpost: last, report: merged, away: awayReportModel(merged, planet, map, catalog), settled, banked };
    },

    /**
     * The live clock while the view is open: a copy advanced to now for the screen. When the step crosses a raid or a
     * finished build it is saved (a raid is fought exactly once), else nothing is written. → { outpost, report, saved }
     */
    live(now) {
      const s = store.load(), o = s.outposts && s.outposts[planet];
      if (!o) return { outpost: null, report: null, saved: false };
      const r = advance(o, now, ctxFor(s, now));
      if (r.report.raids.length || r.report.built.length) {
        const sv = store.update((x) => { x.outposts[planet] = r.outpost; settle(x, now); });
        last = sv.outposts[planet];
        return { outpost: last, report: r.report, saved: true };
      }
      last = r.outpost;
      return { outpost: last, report: r.report, saved: false };
    },

    /**
     * Act on the outpost. action: { type: 'online' | 'sell' | 'place' | 'upgrade' | 'upgradeDefense' | 'repair' | 'repairAll' | 'deep' | 'buyHarvester', … }.
     * → { ok: true, outpost, cost, gold (bank after), loads? (sell), earned? } or { ok: false, error }.
     */
    act(action, now) {
      let out = null;
      store.update((s) => {
        if (!s.outposts || !s.outposts[planet]) { out = { ok: false, error: 'no outpost here' }; return; }
        advanceSaved(s, now);
        const o = s.outposts[planet], ctx = ctxFor(s, now);
        const r = apply(o, action, ctx, now);
        if (!r || r.error) { out = { ok: false, error: (r && r.error) || 'nothing to do' }; s.outposts[planet] = o; settle(s, now); return; }
        s.outposts[planet] = r.outpost;
        if (r.cost) goldAdd(s, -r.cost);
        if (r.gold) goldAdd(s, r.gold);
        const settled = settle(s, now);
        out = { ok: true, outpost: r.outpost, cost: r.cost || 0, earned: r.gold || 0, loads: r.loads || null, gold: bankOf(s), settled };
      });
      if (out.ok) last = out.outpost;
      return out;
    },
  };

  function apply(o, a, ctx, now) {
    switch (a.type) {
      case 'online': return confirmOnline(o, map, now);
      case 'sell': {
        const r = sell(o, ctx);
        if (r.error) return r;
        if (!r.loads.length) return { error: 'no full load yet' };
        return { outpost: r.outpost, gold: r.gold, loads: r.loads };
      }
      case 'place': return place(o, a.pad ? { pad: a.pad, kind: a.kind } : { cell: a.cell, kind: a.kind }, ctx);
      case 'upgrade': return upgrade(o, a.pad, ctx);
      case 'repair': return repair(o, a.id, ctx);
      case 'repairAll': {
        let cur = o, cost = 0;
        for (const d of o.defenses) {
          const c = repairCost(cur, d.id) || 0;
          if (!c) continue;
          const r = repair(cur, d.id, { ...ctx, gold: ctx.gold - cost });
          if (r.error) return cost ? { outpost: cur, cost } : r;
          cur = r.outpost; cost += r.cost;
        }
        return cost ? { outpost: cur, cost } : { error: 'nothing is worn' };
      }
      case 'deep': return setDeep(o, a.pad, a.on, ctx);
      // the Upgrade Bay (story O10): a defense to its next tier, as far as the tech tree's tier
      case 'upgradeDefense': return upgradeDefense(o, a.id, ctx);
      // the build menu's HARVESTER (story O17): story O16's buyHarvester(o, ctx) → { outpost, cost } | { error }, read
      // optionally so the view works before it lands (the menu keeps the item locked until it is exported)
      case 'buyHarvester': return typeof Model.buyHarvester === 'function' ? Model.buyHarvester(o, ctx) : { error: 'Build a Resource Bay first' };
      default: return { error: `unknown action ${a.type}` };
    }
  }
  return api;
}

/** Two advance() reports, one after the other, as one. */
export function mergeReports(a, b) {
  if (!a) return b && { ...b, extracted: { ...b.extracted }, harvested: { ...(b.harvested || {}) }, full: [...b.full], raids: [...b.raids], built: [...b.built] };
  if (!b) return a;
  const extracted = { ...a.extracted }, harvested = { ...(a.harvested || {}) };
  for (const [k, v] of Object.entries(b.extracted)) extracted[k] = (extracted[k] || 0) + v;
  for (const [k, v] of Object.entries(b.harvested || {})) harvested[k] = (harvested[k] || 0) + v;
  return { from: a.from, to: b.to, extracted, harvested, hopperFull: b.hopperFull ?? a.hopperFull, full: [...a.full, ...b.full], raids: [...a.raids, ...b.raids], built: [...a.built, ...b.built] };
}

/** What it would cost to repair every worn defense (the REPAIR button's label). */
export function repairAllCost(o) {
  return (o ? o.defenses : []).reduce((a, d) => a + (repairCost(o, d.id) || 0), 0);
}

/** Problems that stop GO ONLINE, worded for the player. */
export function onlineIssues(o, map) {
  return onlineProblems(o, map).map((p) => p.replace(/^no (\w+)$/, 'no $1 built').replace(/^(\w+) unpowered \((reach|supply)\)$/,
    (m, id, why) => `${id} has no power (${why === 'reach' ? 'out of reach of a station' : 'the grid is short'})`));
}

/** A building's definition at its tier (re-exported for the panels). */
export const defOf = (kind, tier) => structureDef(kind, tier);
