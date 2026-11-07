/**
 * src/outpost/model.js — the outpost's rules, pure [MM-story_mw5oe696_j].
 *
 * Every outpost rule lives here so the menu, the outpost view, the away report, the review page and the tests read
 * the same answers (tech plan docs/tech-plan/Outpost.md §4; design docs/16 Bulwark MM/design/Outpost-Design.md §4–§6).
 *
 * Pure: no DOM, no storage, no clock. Wall-clock time is read by the caller (menu, outpost view) and passed in as
 * milliseconds since the epoch; this is outside the battle sim, so the replay-determinism contract is untouched.
 * Randomness (the raid schedule) comes from createRng seeded by the outpost's seed and the window index only.
 * Every function returns a NEW outpost; the one passed in is never changed.
 *
 * The outpost (s.outposts[planet]):
 *   { planet, seed, online, t, firstRaidAt,
 *     pads: { [padId]: { kind, tier, deposit?, deep? } },          // finished buildings
 *     building: [{ pad, kind, tier, done, deposit? }],              // under construction (also upgrades)
 *     defenses: [{ id, kind, tier, cell: [x, y], hp }],
 *     storage: { [rigPadId]: { [itemId]: units } },                 // one bay per rig; deep grade is '<ore>_deep'
 *     raids: { window, log: [{ at, result, lost, damage }] },
 *     sold: { [oreId]: units } }                                    // lifetime, both grades, for contract steps
 *
 * The map (Forge format, tech plan §6.6; src/outpost/draftLayout.js until O4): { pads: [{ id, x, y, w, h, role,
 * remote }], deposits: [{ tier, pad }], kitDefenses: [{ kind, cell }] }.
 *
 * Raids: `advance` finds each raid due and asks `ctx.raid(outpost, { at, window, first, powered })` for its outcome:
 * { result: 'held' | 'breach', defenses: [{ id, hp }] }. The game passes the battle sim's runRaid (story O7); the
 * tests and the review page pass a stand-in. raidOutcome() applies an outcome: a breach loses Breach_Storage_Loss of
 * every bay and changes no building (owner Q6).
 */
import { createRng } from '../sim/rng.js';
import { oresOf, oreById, oreItemId } from '../data/ores.js';
import { OUTPOST, structureDef, DEFENSE_KINDS } from '../data/outpost.js';

const MIN = 60_000, HOUR = 3_600_000;
const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const P = (ctx) => (ctx && ctx.params) || OUTPOST;

// ── the map ──────────────────────────────────────────────────────────────────────────────────────────────────────
const padOf = (map, id) => map.pads.find((p) => p.id === id) || null;
const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];
const cellCentre = (c) => [c[0] + 0.5, c[1] + 0.5];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The deposit tier a rig pad sits on, or null. */
export const depositOf = (map, padId) => (map.deposits.find((d) => d.pad === padId) || {}).tier || null;

// ── the seed and the raid schedule ───────────────────────────────────────────────────────────────────────────────
function mix(a, b) {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
/** A stable seed for a save + planet. */
export function outpostSeed(saveId, planet) {
  let h = 2166136261 >>> 0;
  for (const ch of `${saveId}:${planet}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Window length (ms): at most one raid per window (Raid_Min_Gap_Hours). */
export const windowMs = (params = OUTPOST) => params.Raid_Min_Gap_Hours * HOUR;

/**
 * The raids in windows [fromWindow, toWindow], in order: [{ window, at }]. A window holds a raid with probability
 * window / Raid_Mean_Hours, at a minute inside it; both are drawn from the seed and the window index only, so the
 * schedule never depends on how often the game is opened (tech plan §4.2).
 */
export function raidSchedule(seed, fromWindow, toWindow, params = OUTPOST) {
  const w = windowMs(params), chance = params.Raid_Min_Gap_Hours / params.Raid_Mean_Hours, out = [];
  for (let i = fromWindow; i <= toWindow; i++) {
    const rng = createRng(mix(seed, i));
    if (rng.next() < chance) out.push({ window: i, at: i * w + Math.floor(rng.next() * (w / MIN)) * MIN });
  }
  return out;
}

// ── creating the outpost (the contract kit) ──────────────────────────────────────────────────────────────────────
/**
 * The outpost the contract grants (design §2.3): the hub, Power Station I, a Rig I on the common deposit, Storage
 * Tower I and the kit defenses, on the map's default pads. It is not online until confirmOnline().
 */
export function createOutpost(planet, { seed, map, now }) {
  const first = (role, f = () => true) => map.pads.find((p) => p.role === role && !p.remote && f(p));
  const rigPad = first('rig', (p) => depositOf(map, p.id) === 'common');
  const pads = {
    [first('hub').id]: { kind: 'hub', tier: 1 },
    [first('power').id]: { kind: 'power', tier: 1 },
    [rigPad.id]: { kind: 'rig', tier: 1, deposit: 'common', deep: false },
    [first('storage').id]: { kind: 'storage', tier: 1 },
  };
  const defenses = (map.kitDefenses || []).map((d, i) => ({
    id: `d${i + 1}`, kind: d.kind, tier: 1, cell: [...d.cell], hp: structureDef(d.kind, 1).battle.hp,
  }));
  return {
    planet, seed: seed >>> 0, online: false, t: now, firstRaidAt: null,
    pads, building: [], defenses, storage: { [rigPad.id]: {} },
    raids: { window: null, log: [] }, sold: {},
  };
}

// ── power (design §4.5) ──────────────────────────────────────────────────────────────────────────────────────────
// Consumers are served in this order when a grid is short, so the outpost keeps its core running first.
const PRIORITY = { hub: 0, storage: 1, rig: 2, mg: 3, cannon: 3, harvesterBay: 4, upgradeBay: 5 };

/**
 * The power grids: stations within reach of each other pool their supply; a consumer joins the grid of the nearest
 * station whose reach covers it, and a grid powers its consumers in priority order until its supply runs out.
 * → { grids: [{ stations, supply, draw, powered }], powered: Set<id>, off: { [id]: 'reach' | 'supply' } }
 * Ids are pad ids for buildings and defense ids for defenses. Walls draw nothing and are always on.
 */
export function powerGrids(o, map) {
  const stations = Object.entries(o.pads).filter(([, b]) => b.kind === 'power')
    .map(([id, b]) => ({ id, at: centre(padOf(map, id)), def: structureDef('power', b.tier) }));
  // union stations within reach of each other
  const parent = stations.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      if (dist(stations[i].at, stations[j].at) <= Math.max(stations[i].def.reach, stations[j].def.reach)) parent[find(i)] = find(j);
    }
  }
  const grids = new Map();
  stations.forEach((s, i) => {
    const g = grids.get(find(i)) || { stations: [], supply: 0, draw: 0, powered: [], members: [] };
    g.stations.push(s.id);
    g.supply += s.def.supply;
    grids.set(find(i), g);
  });
  const consumers = [
    ...Object.entries(o.pads).filter(([, b]) => b.kind !== 'power')
      .map(([id, b]) => ({ id, kind: b.kind, at: centre(padOf(map, id)), draw: structureDef(b.kind, b.tier).draw })),
    ...o.defenses.map((d) => ({ id: d.id, kind: d.kind, at: cellCentre(d.cell), draw: structureDef(d.kind, d.tier).draw })),
  ];
  const off = {}, powered = new Set();
  for (const c of consumers) {
    if (!c.draw) { powered.add(c.id); continue; }
    let best = null;
    stations.forEach((s, i) => {
      const d = dist(s.at, c.at);
      if (d <= s.def.reach && (!best || d < best.d)) best = { d, root: find(i) };
    });
    if (!best) { off[c.id] = 'reach'; continue; }
    grids.get(best.root).members.push(c);
  }
  for (const g of grids.values()) {
    g.members.sort((a, b) => (PRIORITY[a.kind] ?? 9) - (PRIORITY[b.kind] ?? 9) || (a.id < b.id ? -1 : 1));
    for (const c of g.members) {
      if (g.draw + c.draw <= g.supply) { g.draw += c.draw; g.powered.push(c.id); powered.add(c.id); } else off[c.id] = 'supply';
    }
    delete g.members;
  }
  return { grids: [...grids.values()], powered, off };
}

// ── extraction and storage (design §4.2, §4.4) ───────────────────────────────────────────────────────────────────
function rigOre(o, padId) {
  const b = o.pads[padId];
  return oresOf(o.planet).find((x) => x.tier === b.deposit) || null;
}
/** The bay capacity of a rig, in units (design §4.2): Bay_Hours of its shallow output × the Mk II multiplier. */
export function bayCapacity(o, padId) {
  const ore = rigOre(o, padId), rig = structureDef('rig', o.pads[padId].tier);
  const storageTier = Math.max(0, ...Object.values(o.pads).filter((b) => b.kind === 'storage').map((b) => b.tier));
  const st = structureDef('storage', storageTier);
  return ore && st ? ore.rate * 60 * st.bayHours * rig.capacityMult : 0;
}
const bayUnits = (o, padId) => Object.values(o.storage[padId] || {}).reduce((a, b) => a + b, 0);

/** Units per minute a rig produces now: its ore at its grade, × its tier's Rate_Mult. */
export function rigRatePerMin(o, padId) {
  const b = o.pads[padId], ore = rigOre(o, padId);
  if (!ore) return 0;
  return ore.rate * (b.deep ? ore.deepRate : 1) * structureDef('rig', b.tier).rateMult;
}

/** Which rigs run now: online, hub and storage powered, the rig powered. → [{ pad, item, rate, cap }] */
function runningRigs(o, map) {
  if (!o.online) return [];
  const { powered } = powerGrids(o, map);
  const hub = Object.keys(o.pads).find((id) => o.pads[id].kind === 'hub');
  const storage = Object.keys(o.pads).find((id) => o.pads[id].kind === 'storage');
  if (!hub || !powered.has(hub) || !storage || !powered.has(storage)) return [];
  return Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig' && powered.has(id)).map((id) => {
    const ore = rigOre(o, id);
    return { pad: id, item: oreItemId(ore.id, !!o.pads[id].deep), rate: rigRatePerMin(o, id) / MIN, cap: bayCapacity(o, id) };
  });
}

// ── advancing through time (tech plan §4.1) ──────────────────────────────────────────────────────────────────────
/**
 * Advance the outpost to `toMs`, in closed form: the interval is cut only at the events that change a rate (a build
 * finishing, a raid); between them each rig extracts rate × Δt, capped by the space left in its bay. Nothing is sold
 * here: selling is always the player's tap (design §4.3).
 * Guards: a clock that went back advances nothing and never lowers `t`; the interval is capped at Away_Cap_Hours.
 * ctx: { map, raid?, params? }. → { outpost, report: { from, to, extracted, full, raids, built } }
 */
export function advance(outpost, toMs, ctx) {
  const params = P(ctx), map = ctx.map;
  const o = clone(outpost);
  const report = { from: o.t, to: o.t, extracted: {}, full: [], raids: [], built: [] };
  if (!(toMs > o.t)) return { outpost: o, report };
  const end = Math.min(toMs, o.t + params.Away_Cap_Hours * HOUR);

  // raids due in (t, end]: the scripted first raid, then the schedule's from the window after the last resolved
  const raids = [];
  if (o.online && o.firstRaidAt != null && o.firstRaidAt > o.t && o.firstRaidAt <= end) raids.push({ at: o.firstRaidAt, first: true });
  if (o.online) {
    const w = windowMs(params);
    const fromW = o.raids.window == null ? Math.floor(o.t / w) : o.raids.window + 1;
    for (const r of raidSchedule(o.seed, fromW, Math.floor(end / w), params)) {
      if (r.at > o.t && r.at <= end && (o.firstRaidAt == null || r.at > o.firstRaidAt)) raids.push(r);
    }
  }
  const events = [
    ...o.building.filter((b) => b.done > o.t && b.done <= end).map((b) => ({ at: b.done, build: b })),
    ...o.building.filter((b) => b.done <= o.t).map((b) => ({ at: o.t, build: b })),
    ...raids.map((r) => ({ at: r.at, raid: r })),
  ].sort((a, b) => a.at - b.at || (a.build ? -1 : 1));

  let now = o.t;
  const extractTo = (until) => {
    const dt = until - now;
    if (dt <= 0) return;
    for (const r of runningRigs(o, map)) {
      const bay = (o.storage[r.pad] ||= {});
      const space = r.cap - bayUnits(o, r.pad);
      if (space <= 0) continue;
      const got = Math.min(r.rate * dt, space);
      bay[r.item] = (bay[r.item] || 0) + got;
      report.extracted[r.item] = (report.extracted[r.item] || 0) + got;
      if (got >= space - 1e-9) report.full.push({ pad: r.pad, at: now + space / r.rate });
    }
    now = until;
  };
  for (const ev of events) {
    extractTo(ev.at);
    if (ev.build) {
      const b = ev.build;
      o.building = o.building.filter((x) => x !== b && !(x.pad === b.pad && x.done === b.done));
      const prev = o.pads[b.pad] || {};
      o.pads[b.pad] = { ...prev, kind: b.kind, tier: b.tier, ...(b.kind === 'rig' ? { deposit: b.deposit ?? prev.deposit, deep: !!prev.deep } : {}) };
      if (b.kind === 'rig') o.storage[b.pad] ||= {};
      report.built.push({ pad: b.pad, kind: b.kind, tier: b.tier, at: b.done });
    } else {
      const outcome = ctx.raid ? ctx.raid(o, { ...ev.raid, powered: powerGrids(o, map).powered }) : { result: 'held', defenses: [] };
      const applied = raidOutcome(o, { ...outcome, at: ev.at }, params);
      Object.assign(o, applied.outpost);
      report.raids.push(applied.entry);
      if (ev.raid.window != null) o.raids.window = ev.raid.window;
    }
  }
  extractTo(end);
  if (o.online) o.raids.window = Math.max(o.raids.window ?? -1, lastSettledWindow(o.seed, end, params));
  o.t = end;
  report.to = end;
  return { outpost: o, report };
}

/** The last window whose raid (if any) is at or before `end`: the window holding `end` counts only once its raid
 *  has happened, so a raid later in that window is still found by the next advance. */
function lastSettledWindow(seed, end, params) {
  const w = Math.floor(end / windowMs(params));
  return raidSchedule(seed, w, w, params).some((r) => r.at > end) ? w - 1 : w;
}

/**
 * Apply a raid outcome: defenses take their new HP; a breach loses Breach_Storage_Loss of every bay's ore (owner Q6)
 * and changes no building. The log keeps the last Replay_Keep raids. → { outpost, entry }
 */
export function raidOutcome(outpost, { result, defenses = [], at }, params = OUTPOST) {
  const o = clone(outpost);
  let damage = 0;
  for (const d of defenses) {
    const mine = o.defenses.find((x) => x.id === d.id);
    if (!mine) continue;
    damage += Math.max(0, mine.hp - d.hp);
    mine.hp = Math.max(0, d.hp);
  }
  const lost = {};
  if (result === 'breach') {
    for (const bay of Object.values(o.storage)) {
      for (const [item, units] of Object.entries(bay)) {
        const l = units * params.Breach_Storage_Loss;
        bay[item] = units - l;
        lost[item] = (lost[item] || 0) + l;
      }
    }
  }
  const entry = { at, result, lost, damage };
  o.raids.log = [...o.raids.log, entry].slice(-params.Replay_Keep);
  return { outpost: o, entry };
}

// ── going online (contract step 1) ───────────────────────────────────────────────────────────────────────────────
/** What stops the outpost going online: [] when every kit building is placed and powered. */
export function onlineProblems(o, map) {
  const { off } = powerGrids(o, map);
  const out = [];
  for (const kind of ['hub', 'power', 'rig', 'storage']) {
    if (!Object.values(o.pads).some((b) => b.kind === kind)) out.push(`no ${kind}`);
  }
  for (const [id, why] of Object.entries(off)) out.push(`${id} unpowered (${why})`);
  return out;
}
/** Bring the outpost online at `now` (design §2.3 step 1); schedules the scripted first raid. */
export function confirmOnline(outpost, map, now, params = OUTPOST) {
  const problems = onlineProblems(outpost, map);
  if (problems.length) return { error: problems.join('; ') };
  const o = clone(outpost);
  o.online = true;
  o.t = Math.max(o.t, now);
  o.firstRaidAt = o.t + params.First_Raid_Sec * 1000;
  o.raids.window = Math.floor(o.t / windowMs(params));
  return { outpost: o };
}

// ── selling (design §4.3, §8.5) ──────────────────────────────────────────────────────────────────────────────────
/** Units in one shuttle load of an item from a rig: Load_Sec of that rig's output at that grade. */
function loadOf(o, padId, item, params) {
  const b = o.pads[padId], ore = oreById(item);
  if (!b || !ore) return Infinity;
  return ore.rate * (ore.deep ? ore.deepRate : 1) * structureDef('rig', b.tier).rateMult * (params.Load_Sec / 60);
}
/** Full loads waiting in storage, over every bay and grade. */
export function loadsReady(o, ctx) {
  const params = P(ctx);
  let n = 0;
  for (const [pad, bay] of Object.entries(o.storage)) {
    for (const [item, units] of Object.entries(bay)) n += Math.floor(units / loadOf(o, pad, item, params) + 1e-9);
  }
  return n;
}

/**
 * Sell every full load (a partial load stays). buyer: null for the home ship, or a faction key for the far buyer
 * (design §8.5), which takes only the rare ore it wants, pays Far_Buyer_Mult, and costs Far_Loyalty_Cost home
 * loyalty per load; it is refused until ctx.farDiscovered. ctx.shuttleTier 2 adds Shuttle_II_Bonus.
 * → { outpost, loads: [{ pad, item, units, gold }], gold, loyalty: { home } } or { error }
 */
export function sell(outpost, ctx = {}, { buyer = null } = {}) {
  const params = P(ctx);
  let far = null;
  if (buyer) {
    far = oresOf(outpost.planet).find((x) => x.wantedBy === buyer);
    if (!far) return { error: `${buyer} buys nothing from this outpost` };
    if (!ctx.farDiscovered) return { error: 'the far buyer has not been found yet' };
  }
  const o = clone(outpost), loads = [];
  const bonus = 1 + (ctx.shuttleTier >= 2 ? params.Shuttle_II_Bonus : 0);
  for (const [pad, bay] of Object.entries(o.storage)) {
    for (const [item, units] of Object.entries(bay)) {
      const ore = oreById(item);
      if (far && ore.id !== far.id) continue;
      const size = loadOf(o, pad, item, params), n = Math.floor(units / size + 1e-9);
      if (!n) continue;
      const price = ore.price * (ore.deep ? ore.deepPrice : 1) * (far ? params.Far_Buyer_Mult : 1) * bonus;
      for (let i = 0; i < n; i++) loads.push({ pad, item, units: size, gold: Math.round(size * price) });
      bay[item] = Math.max(0, units - n * size);
      o.sold[ore.id] = (o.sold[ore.id] || 0) + n * size;
    }
  }
  const gold = loads.reduce((a, l) => a + l.gold, 0);
  return { outpost: o, loads, gold, loyalty: { home: far ? -params.Far_Loyalty_Cost * loads.length : 0 } };
}

// ── building, upgrading, repairing (design §6, §6.1) ─────────────────────────────────────────────────────────────
const ROLE_FITS = {
  hub: ['hub'], power: ['power', 'spare'], rig: ['rig'], storage: ['storage'],
  harvesterBay: ['bay', 'spare'], upgradeBay: ['bay', 'spare'],
};
const busy = (o, pad) => !!o.pads[pad] || o.building.some((b) => b.pad === pad);

/**
 * Build something new on an empty pad, or a defense on a free cell. what: { pad, kind } or { cell, kind }.
 * ctx: { map, gold, now, unlockedTiers: ['common', …], unlocks: Set|[] of tech ids }.
 * → { outpost, cost } or { error }. A new defense starts at full HP; only repair() restores HP afterwards.
 */
export function place(outpost, what, ctx) {
  const { map, gold = Infinity, now } = ctx;
  const kind = what.kind;
  const def = structureDef(kind, 1);
  if (!def) return { error: `unknown building ${kind}` };
  if (def.cost > gold) return { error: `costs ${def.cost} gold` };
  if (!unlocked(def, ctx, outpost)) return { error: `${kind} is not unlocked (${def.unlock})` };
  const o = clone(outpost);
  if (DEFENSE_KINDS.includes(kind)) {
    if (!what.cell) return { error: 'a defense goes on a cell' };
    if (o.defenses.some((d) => d.cell[0] === what.cell[0] && d.cell[1] === what.cell[1])) return { error: 'that cell is taken' };
    if (map.pads.some((p) => what.cell[0] >= p.x && what.cell[0] < p.x + p.w && what.cell[1] >= p.y && what.cell[1] < p.y + p.h)) return { error: 'defenses go off the pads' };
    const n = Math.max(0, ...o.defenses.map((d) => +d.id.slice(1) || 0)) + 1;
    o.defenses.push({ id: `d${n}`, kind, tier: 1, cell: [...what.cell], hp: def.battle.hp });
    return { outpost: o, cost: def.cost };
  }
  const pad = padOf(map, what.pad);
  if (!pad) return { error: `no pad ${what.pad}` };
  if (busy(o, pad.id)) return { error: `pad ${pad.id} is taken` };
  if (!(ROLE_FITS[kind] || []).includes(pad.role)) return { error: `a ${kind} cannot go on a ${pad.role} pad` };
  let deposit;
  if (kind === 'rig') {
    deposit = depositOf(map, pad.id);
    if (!deposit) return { error: 'a rig goes on a deposit' };
    if (!(ctx.unlockedTiers || ['common']).includes(deposit)) return { error: `the ${deposit} ore is not unlocked` };
  }
  o.building.push({ pad: pad.id, kind, tier: 1, done: now + def.buildSec * 1000, ...(deposit ? { deposit } : {}) });
  return { outpost: o, cost: def.cost };
}

/** Upgrade the building on a pad to its next tier (Power Station II, Rig Mk II, Storage Tower II). */
export function upgrade(outpost, padId, ctx) {
  const b = outpost.pads[padId];
  if (!b) return { error: `nothing on ${padId}` };
  if (outpost.building.some((x) => x.pad === padId)) return { error: `${padId} is already building` };
  const def = structureDef(b.kind, b.tier + 1);
  if (!def) return { error: `${b.kind} has no tier ${b.tier + 1}` };
  if (def.cost > (ctx.gold ?? Infinity)) return { error: `costs ${def.cost} gold` };
  if (!unlocked(def, ctx, outpost)) return { error: `${b.kind} tier ${b.tier + 1} is not unlocked (${def.unlock})` };
  const o = clone(outpost);
  o.building.push({ pad: padId, kind: b.kind, tier: b.tier + 1, done: ctx.now + def.buildSec * 1000 });
  return { outpost: o, cost: def.cost };
}

function unlocked(def, ctx, o) {
  const u = def.unlock || '';
  if (u === 'kit' || u.startsWith('contract:')) return true;
  const has = (id) => (ctx.unlocks instanceof Set ? ctx.unlocks.has(id) : (ctx.unlocks || []).includes(id));
  if (u.startsWith('tech:')) return has(u.slice(5));
  if (u === 'techtree+upgradeBay') return has(`tier${def.tier}`) && Object.values(o.pads).some((b) => b.kind === 'upgradeBay');
  return false;
}

/** What repairing a defense to full HP costs: Value × Repair_Share_Per_HP × the share of HP missing (design §6.1). */
export function repairCost(o, id, params = OUTPOST) {
  const d = o.defenses.find((x) => x.id === id);
  if (!d) return null;
  const def = structureDef(d.kind, d.tier);
  return Math.ceil(def.value * params.Repair_Share_Per_HP * (1 - d.hp / def.battle.hp));
}
/** Repair a defense to full HP. Only this restores HP (design §5.2). → { outpost, cost } or { error } */
export function repair(outpost, id, ctx = {}) {
  const cost = repairCost(outpost, id, P(ctx));
  if (cost == null) return { error: `no defense ${id}` };
  if (cost > (ctx.gold ?? Infinity)) return { error: `costs ${cost} gold` };
  const o = clone(outpost);
  const d = o.defenses.find((x) => x.id === id);
  d.hp = structureDef(d.kind, d.tier).battle.hp;
  return { outpost: o, cost };
}

/** Switch a rig between its shallow and deep seam (design §4.4); needs Deep Drilling I. */
export function setDeep(outpost, padId, on, ctx = {}) {
  const b = outpost.pads[padId];
  if (!b || b.kind !== 'rig') return { error: `${padId} is not a rig` };
  const has = ctx.unlocks instanceof Set ? ctx.unlocks.has('deep_drilling_1') : (ctx.unlocks || []).includes('deep_drilling_1');
  if (on && !has) return { error: 'Deep Drilling I is not unlocked' };
  const o = clone(outpost);
  o.pads[padId].deep = !!on;
  return { outpost: o };
}

/** A one-glance status for the menu's OUTPOST button (design §10): loads ready, storage full, worn defenses, last raid. */
export function status(o, ctx) {
  const rigs = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig');
  const full = rigs.length > 0 && rigs.every((id) => bayUnits(o, id) >= bayCapacity(o, id) - 1e-6);
  const worn = o.defenses.some((d) => d.hp < structureDef(d.kind, d.tier).battle.hp);
  const last = o.raids.log[o.raids.log.length - 1] || null;
  const loads = loadsReady(o, ctx);
  return { loads, full, worn, lastRaid: last, dot: loads > 0 || worn };
}
