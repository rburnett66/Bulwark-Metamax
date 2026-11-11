/**
 * src/outpost/view/hudModel.js — what the outpost HUD and panels show, as data [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1: top bar (gold, ore in storage, storage fill, power used / supplied, the
 * defenses' shield), bottom SELL (n loads) / BUILD / REPAIR (when worn), and the selected building's panel (status,
 * tier, rate, the deep / shallow switch on a rig, upgrade). Pure: reads the outpost through src/outpost/model.js; the
 * DOM lives in hud.js.
 */
import { powerGrids, loadsReady, bayCapacity, rigRatePerMin, repairCost, depositOf, onlineProblems, harvestPlan, hopperCap, hopperUnits,
  gunCount, gunCap, defenseUpgradeRefusal, harvesterCap, raidWarning, upgradeBayReady, steadyHarvest, fieldStock, surfaceFieldGroups , sellStructureQuote } from '../model.js';
import { structureDef, maxTier, DEFENSE_KINDS, OUTPOST, OUTPOST_TECH } from '../../data/outpost.js';
import { oresOf, oreById } from '../../data/ores.js';
import { bayKind } from './buildMenu.js';
import { buildingWarnings, warningLines } from './warnings.js';

export const KIND_NAME = Object.freeze({
  hub: 'Outpost Hub', power: 'Power Station', rig: 'Mining Station', storage: 'Storage Tower',
  harvesterBay: 'Resource Bay', resourceBay: 'Resource Bay', upgradeBay: 'Upgrade Bay', habitat: 'Habitat', cannon: 'Cannon Tower', mg: 'Machine Gun', wall: 'Wall',
});   // the Harvester Bay is the Resource Bay (owner 2026-11-07); the turret tower is the Cannon Tower
const RIG_NAME = { auger: 'Auger Drill', laser: 'Laser Cutter', brine: 'Brine Pump', crystal: 'Crystal Harvester', bore: 'Deep Bore', shielded: 'Shielded Extractor' };
export const ROMAN = Object.freeze(['', 'I', 'II', 'III']);
/** What a pad role can take (model.js ROLE_FITS, read the other way round) — the BUILD menu's choices. */
const buildsOn = (role) => ({ power: ['power'], spare: ['power', bayKind(), 'upgradeBay', 'habitat'], bay: [bayKind(), 'upgradeBay', 'habitat'], rig: ['rig'], storage: ['storage'], hub: ['hub'] })[role];

// ── formatting ───────────────────────────────────────────────────────────────────────────────────────────────────
/** 950 → "950", 12_400 → "12,400", 1_250_000 → "1.25M". */
export function fmtGold(n) {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  return v.toLocaleString('en-US');
}
/** Whole units, floored (storage is fractional; the UI never rounds up what cannot be sold). */
export const fmtUnits = (n) => Math.floor((n || 0) + 1e-9).toLocaleString('en-US');
/** Units per minute: "3 / min", "0.75 / min", "0.2 / min". */
export const fmtRate = (r) => `${+(r || 0).toFixed(r >= 10 ? 0 : r >= 1 ? 1 : 2)} / min`;
/** Seconds left → "4:59", "1:02:03". */
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// ── the outpost's numbers ────────────────────────────────────────────────────────────────────────────────────────
const bayUnits = (o, pad) => Object.values(o.storage[pad] || {}).reduce((a, b) => a + b, 0);

/** The rig model slug for a rig pad: its deposit's ore's head (rig_auger / rig_laser / rig_brine …). */
export function rigHeadOf(o, map, pad) {
  const tier = (o.pads[pad] && o.pads[pad].deposit) || depositOf(map, pad);
  const ore = oresOf(o.planet).find((x) => x.tier === tier);
  return ore ? ore.rig : 'auger';
}

/**
 * The HUD's numbers. o: the outpost (advanced to now); gold: the bank.
 * → { gold, ores: [{ id, name, colour, units, deep }], storage: { units, cap, frac }, power: { draw, supply, short },
 *     shield: { hp, max, frac, worn }, loads, online, problems, repairCost, building: n }
 */
export function hudModel(o, map, { gold = 0, now = null, unlocks = null } = {}) {
  const ores = new Map();
  for (const bay of Object.values(o.storage)) {
    for (const [item, units] of Object.entries(bay)) {
      const ore = oreById(item);
      if (!ore) continue;
      const k = ore.id;
      const row = ores.get(k) || { id: k, name: ore.name, colour: ore.colour, units: 0, deep: 0 };
      row.units += units;
      if (ore.deep) row.deep += units;
      ores.set(k, row);
    }
  }
  let units = 0, cap = 0;
  for (const pad of Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig')) { units += bayUnits(o, pad); cap += bayCapacity(o, pad, map); }
  const { grids, off } = powerGrids(o, map);
  const supply = grids.reduce((a, g) => a + g.supply, 0), draw = grids.reduce((a, g) => a + g.draw, 0);
  let hp = 0, max = 0;
  for (const d of o.defenses) { const def = structureDef(d.kind, d.tier); if (!def || !def.battle) continue; hp += d.hp; max += def.battle.hp; }
  const repair = o.defenses.reduce((a, d) => a + (repairCost(o, d.id) || 0), 0);
  // ores in planet order, with the planet's ores that have none yet left out
  const order = oresOf(o.planet).map((x) => x.id);
  // the Resource Bay's hopper (story O10): what the harvesters have brought in, banked to the inventory on open
  const hCap = hopperCap(o, map), hUnits = hopperUnits(o);
  const warn = now != null ? raidWarning(o, now, { unlocks }) : null;
  return {
    gold, online: !!o.online,
    hopper: o.harvesters > 0 || hUnits > 0 ? { units: hUnits, cap: hCap, frac: hCap > 0 ? Math.min(1, hUnits / hCap) : 0, harvesters: o.harvesters || 0 } : null,
    guns: { n: gunCount(o), cap: gunCap(o) },
    raidInbound: warn,
    ores: [...ores.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    storage: { units, cap, frac: cap > 0 ? Math.min(1, units / cap) : 0 },
    power: { draw, supply, short: Object.values(off).includes('supply'), unpowered: Object.keys(off).length },
    shield: { hp, max, frac: max > 0 ? hp / max : 1, worn: hp < max - 1e-6 },
    loads: loadsReady(o, {}),
    problems: o.online ? [] : onlineProblems(o, map),
    repairCost: repair,
    building: o.building.length,
  };
}

/** The SELL button: label and whether it can be tapped. */
export function sellButton(h) {
  if (!h.online) return { label: 'SELL', sub: 'outpost offline', enabled: false };
  if (!h.loads) return { label: 'SELL', sub: 'no full load', enabled: false };
  return { label: 'SELL', sub: `${h.loads} ${h.loads === 1 ? 'load' : 'loads'}`, enabled: true };
}

/**
 * The selected building's panel. sel: { pad } or { defense: id }. ctx: { now, gold, unlocks, unlockedTiers }.
 * → { title, sub, status, tone: 'ok' | 'warn' | 'off' | 'busy', stats: [[label, value]], deep?, upgrade?, repair?, build? }
 */
export function panelModel(o, map, sel, ctx = {}) {
  const { powered, off } = powerGrids(o, map);
  const now = ctx.now || o.t;
  if (sel.defense) {
    const d = o.defenses.find((x) => x.id === sel.defense);
    if (!d) return null;
    const def = structureDef(d.kind, d.tier), max = def.battle.hp, cost = repairCost(o, d.id) || 0;
    const frac = d.hp / max;
    // the Upgrade Bay (story O10): the next tier, as far as the tech tree's tier, at an outpost with the bay
    const next = structureDef(d.kind, d.tier + 1);
    const upWhy = next ? defenseUpgradeRefusal(o, d.id, { ...ctx, map }) : null;
    const onBay = o.upgrading && o.upgrading.id === d.id;
    if (onBay) {   // timed upgrades (owner 2026-11-07): it is on the Upgrade Bay's pad until its new tier is installed
      return {
        title: `${KIND_NAME[d.kind]} ${ROMAN[d.tier]}`, sub: 'on the Upgrade Bay',
        status: `Upgrading to ${ROMAN[o.upgrading.tier]} · ${fmtClock((o.upgrading.done - now) / 1000)}`, tone: 'busy',
        stats: [['Armour', `${Math.round(d.hp)} / ${max}`], ['Returns to', `cell ${d.cell[0]}, ${d.cell[1]}`]], hp: frac,
        note: 'Off its cell while it is upgraded: it does not fight a raid until it returns.',
        sell: sellOf(o, { defense: d.id }),
      };
    }
    return {
      upgradeDefense: next ? { label: `UPGRADE TO ${ROMAN[d.tier + 1]} · ${fmtGold(next.cost)}`, cost: next.cost, enabled: !upWhy, why: upWhy ? upWhy.replace(/^./, (c) => c.toUpperCase()) : null } : null,
      title: `${KIND_NAME[d.kind]} ${ROMAN[d.tier]}`, sub: `cell ${d.cell[0]}, ${d.cell[1]}`,
      status: d.selling ? 'Being dismantled' : d.building ? `Building · ${fmtClock(Math.max(0, d.building.done - now) / 1000)}` : d.repair ? (now < d.repair.arrive ? `Repair drone on its way · ${fmtClock((d.repair.arrive - now) / 1000)}` : `Being repaired · ${fmtClock(Math.max(0, d.repair.done - now) / 1000)}`)
        : !(d.hp > 0) ? 'Wrecked · needs repair' : off[d.id] ? 'No power' : frac >= 1 ? 'Ready' : frac < 0.4 ? 'Badly worn' : 'Worn',
      tone: (d.repair || d.building || d.selling) ? 'busy' : off[d.id] ? 'off' : frac >= 1 ? 'ok' : 'warn',
      stats: [['Armour', `${Math.round(d.hp)} / ${max}`], ...(def.battle.dps ? [['Damage', `${def.battle.dps} / s`]] : []), ['Range', `${def.battle.range || 1} cells`]],
      hp: frac,
      repair: cost ? { cost, enabled: cost <= (ctx.gold ?? Infinity), label: `REPAIR · ${fmtGold(cost)}` } : null,
      sell: sellOf(o, { defense: d.id }),
    };
  }
  const pad = map.pads.find((p) => p.id === sel.pad);
  if (!pad) return null;
  const b = o.pads[pad.id], job = o.building.find((x) => x.pad === pad.id);
  if (!b && !job) return { ...buildPanel(o, map, pad, ctx), empty: true };
  const kind = (b || job).kind, tier = b ? b.tier : 0;
  const head = kind === 'rig' ? rigHeadOf(o, map, pad.id) : null;
  const title = kind === 'rig' ? `${RIG_NAME[head] || 'Mining Station'} ${ROMAN[Math.max(1, tier)]}${tier >= 2 ? ' (Mk II)' : ''}` : `${KIND_NAME[kind] || kind} ${ROMAN[Math.max(1, tier)]}`;
  const stats = [];
  let status = 'Online', tone = 'ok';
  if (!b) { status = `Building · ${fmtClock((job.done - now) / 1000)}`; tone = 'busy'; }
  else if (job) { status = `Upgrading to ${ROMAN[job.tier]} · ${fmtClock((job.done - now) / 1000)}`; tone = 'busy'; }
  else if (off[pad.id]) { status = off[pad.id] === 'reach' ? 'No power: out of reach' : 'No power: grid short'; tone = 'off'; }
  else if (!o.online) { status = 'Waiting to go online'; tone = 'warn'; }
  const out = { title, sub: `pad ${pad.id}${pad.remote ? ' · remote site' : ''}`, status, tone, stats, kind, tier };
  // the building's warnings (owner 2026-11-07 07:33): no power, storage full, the storage tower's door shut
  const warn = b ? (buildingWarnings(o, map)[pad.id] || []) : [];
  if (warn.length) out.warnings = warningLines(warn).map((text) => ({ text, icon: /full/.test(text) ? 'crate' : /door/.test(text) ? 'door' : 'bolt' }));
  if (b && !job && warn.includes('door_closed')) { out.status = 'No power: door shut'; out.tone = 'off'; }
  if (b && kind === 'rig') {
    const ore = oresOf(o.planet).find((x) => x.tier === b.deposit);
    const cap = bayCapacity(o, pad.id, map), units = bayUnits(o, pad.id);
    const running = o.online && powered.has(pad.id) && !job;
    if (running && units >= cap - 1e-6) { out.status = 'Bay full: sell to resume'; out.tone = 'warn'; }
    stats.push(['Ore', ore ? `${ore.name}${b.deep ? ', deep grade' : ''}` : '—']);
    stats.push(['Rate', running ? fmtRate(rigRatePerMin(o, pad.id)) : 'stopped']);
    stats.push(['Bay', `${fmtUnits(units)} / ${fmtUnits(cap)}`]);
    out.bay = cap > 0 ? units / cap : 0;
    out.oreColour = ore && ore.colour;
    const can = ctx.unlocks instanceof Set ? ctx.unlocks.has('deep_drilling_1') : (ctx.unlocks || []).includes('deep_drilling_1');
    out.deep = { on: !!b.deep, enabled: can || !!b.deep, note: can ? (b.deep ? `¼ speed, ${ore ? ore.deepPrice : 5}× price` : 'shallow seam') : 'needs Deep Drilling I' };
  } else if (b && kind === 'power') {
    const def = structureDef('power', b.tier), g = powerGridOf(o, map, pad.id);
    stats.push(['Supply', `${def.supply}`], ['Reach', `${def.reach} cells`]);
    if (g) stats.push(['Grid', `${g.draw} / ${g.supply} used`]);
  } else if (b && kind === 'storage') {
    const def = structureDef('storage', b.tier);
    let units = 0, cap = 0;
    for (const id of Object.keys(o.pads).filter((x) => o.pads[x].kind === 'rig')) { units += bayUnits(o, id); cap += bayCapacity(o, id, map); }
    stats.push(['Holds', `${def.bayHours} h per rig`], ['Stored', `${fmtUnits(units)} / ${fmtUnits(cap)}`]);
    out.bay = cap > 0 ? units / cap : 0;
  } else if (b && (kind === 'resourceBay' || kind === 'harvesterBay')) {
    // story O10: the harvesters, where they work and the hopper they fill
    // owner 2026-11-07: the battle rate, but outpost fields regrow at 5 % of the battle's — a field's stock, then its regrowth
    const plan = harvestPlan(o, map), cap = hopperCap(o, map), units = hopperUnits(o);
    const running = powered.has(pad.id) && !job, stock = fieldStock(o, map), groups = new Map(surfaceFieldGroups(map).map((f) => [f.id, f]));
    stats.push(['Harvesters', `${o.harvesters || 0} / ${harvesterCap(o, ctx)}`]);
    for (const h of plan) {
      const f = groups.get(h.fieldId);
      stats.push([`${h.tier === 'common' ? 'Common' : 'Uncommon'} · #${h.i + 1}`, running ? `field ${fmtUnits(stock[h.fieldId])} / ${fmtUnits(f.cap)}` : 'stopped']);
    }
    if (plan.length) stats.push(['Fields regrowing', `${+(steadyHarvest(o, map).total * 3_600_000).toFixed(1)} / h`]);
    stats.push(['Hopper', `${fmtUnits(units)} / ${fmtUnits(cap)}`]);
    out.bay = cap > 0 ? units / cap : 0;
    out.oreColour = '#5fb8ff';
    out.note = 'The hopper empties into your inventory each time you open the outpost.';
    if (!(o.harvesters > 0)) out.note = 'Buy harvesters from the build list.';
  } else if (b && kind === 'upgradeBay') {
    // story O10: the Outpost tech, bought in the Tech Tree, and the defense tiers this bay installs
    const has = (id) => (ctx.unlocks instanceof Set ? ctx.unlocks.has(id) : (ctx.unlocks || []).includes(id));
    const open = (id) => (ctx.contractUnlocks instanceof Set ? ctx.contractUnlocks.has(id) : (ctx.contractUnlocks || []).includes(id));
    out.techs = OUTPOST_TECH.map((t) => ({ id: t.id, name: t.name, effect: t.effect, price: t.price,
      state: has(t.id) ? 'owned' : open(t.id) ? 'buy' : 'locked', note: has(t.id) ? 'installed' : open(t.id) ? `buy in the Tech Tree · ${fmtGold(t.price)}` : `unlocked by the outpost ${t.unlockedBy}` }));
    const ready = upgradeBayReady(o, map), on = o.upgrading;
    if (on) {
      const dd = o.defenses.find((x) => x.id === on.id);
      out.status = `Upgrading ${KIND_NAME[on.kind]} to ${ROMAN[on.tier]} · ${fmtClock((on.done - now) / 1000)}`; out.tone = 'busy';
      if (dd) stats.push(['On the pad', `${KIND_NAME[on.kind]} ${ROMAN[dd.tier]} → ${ROMAN[on.tier]}`]);
    } else if (o.upgradeShow) stats.push(['Last upgraded', `${KIND_NAME[o.upgradeShow.kind]} ${ROMAN[o.upgradeShow.tier]}`]);
    stats.push(['Defense tiers', !ready ? 'no power' : on ? 'one defense at a time' : 'tap a defense to upgrade it']);
  } else if (b && kind === 'habitat') {
    stats.push(['Guns crewed', `${gunCount(o)} / ${gunCap(o)}`], ['Crew', `+${(OUTPOST.Habitat_Guns_Per_Tier ?? 2) * b.tier} guns`]);
  } else if (b && kind === 'hub') {
    stats.push(['Loads ready', String(loadsReady(o, {}))], ['Load', `${OUTPOST.Load_Sec / 60} min of a rig`], ['Guns crewed', `${gunCount(o)} / ${gunCap(o)}`]);
  }
  if (b) out.sell = sellOf(o, { pad: pad.id });
  if (b && !job) {
    const next = structureDef(kind, b.tier + 1);
    if (next && b.tier < maxTier(kind) && !DEFENSE_KINDS.includes(kind)) {
      const why = upgradeBlock(o, next, ctx);
      out.upgrade = { label: `UPGRADE TO ${ROMAN[b.tier + 1]} · ${fmtGold(next.cost)}`, cost: next.cost, enabled: !why, why };
    }
  }
  return out;
}

/** The panel's SELL: the battle's refund (half of what was invested), or why it cannot be sold. */
function sellOf(o, target) {
  const q = sellStructureQuote(o, target);
  return q.error ? { enabled: false, refund: 0, why: q.error.replace(/^./, (c) => c.toUpperCase()), label: 'Sell' } : { enabled: true, refund: q.refund, why: null, label: `Sell (+${fmtGold(q.refund)}g)` };
}

function upgradeBlock(o, def, ctx) {
  const u = def.unlock || '';
  const has = (id) => (ctx.unlocks instanceof Set ? ctx.unlocks.has(id) : (ctx.unlocks || []).includes(id));
  if (u.startsWith('tech:') && !has(u.slice(5))) return `needs ${u.slice(5).replace(/_/g, ' ')}`;
  if (def.cost > (ctx.gold ?? Infinity)) return `costs ${fmtGold(def.cost)}`;
  return null;
}
function powerGridOf(o, map, stationPad) {
  return powerGrids(o, map).grids.find((g) => g.stations.includes(stationPad)) || null;
}

/** An empty pad's panel: what can be built on it, with price and why not. */
function buildPanel(o, map, pad, ctx) {
  const kinds = buildsOn(pad.role) || [];
  const tiers = ctx.unlockedTiers || ['common'];
  const options = kinds.map((kind) => {
    const def = structureDef(kind, 1);
    let why = null;
    if (!def) why = 'not available';
    else if (kind === 'rig') {
      const dep = depositOf(map, pad.id);
      if (!dep) why = 'no deposit';
      else if (!tiers.includes(dep)) why = `${(oresOf(o.planet).find((x) => x.tier === dep) || {}).name || dep} not unlocked`;
    }
    if (!why && def.cost > (ctx.gold ?? Infinity)) why = `costs ${fmtGold(def.cost)}`;
    const name = kind === 'rig' ? `${RIG_NAME[rigHeadOf(o, map, pad.id)] || 'Mining Station'}` : KIND_NAME[kind];
    return { kind, name, cost: def ? def.cost : 0, buildSec: def ? def.buildSec : 0, enabled: !why, why };
  });
  const dep = depositOf(map, pad.id), ore = dep && oresOf(o.planet).find((x) => x.tier === dep);
  return {
    title: pad.role === 'rig' && ore ? `${ore.name} deposit` : `Empty ${pad.role === 'spare' ? '' : pad.role + ' '}pad`.replace('  ', ' '),
    sub: `pad ${pad.id}${pad.remote ? ' · remote site' : ''}`,
    status: ore && !tiers.includes(dep) ? 'Locked: a later contract unlocks it' : 'Ready to build', tone: ore && !tiers.includes(dep) ? 'off' : 'ok',
    stats: ore ? [['Ore', `${ore.name} (${ore.tier})`], ['Price', `${ore.price} gold / unit`]] : [],
    build: options,
  };
}

/** The defenses that can be placed now (BUILD → defense), with price. */
export function defenseOptions(ctx = {}) {
  return DEFENSE_KINDS.map((kind) => {
    const def = structureDef(kind, 1);
    return { kind, name: KIND_NAME[kind], cost: def.cost, enabled: def.cost <= (ctx.gold ?? Infinity), why: def.cost <= (ctx.gold ?? Infinity) ? null : `costs ${fmtGold(def.cost)}` };
  });
}

/** The pads the BUILD sheet lists: every empty pad, mesa first. */
export function emptyPads(o, map) {
  return map.pads.filter((p) => !o.pads[p.id] && !o.building.some((b) => b.pad === p.id)).sort((a, b) => (a.remote ? 1 : 0) - (b.remote ? 1 : 0));
}
