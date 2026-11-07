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
 *     harvesters: n,                                                // bought for the Resource Bay (O16; behaviour O10)
 *     hopper: { common: units, uncommon: units },                   // the Resource Bay's hopper (O10), fractional
 *     raids: { window, log: [{ at, result, lost, damage }] },
 *     sold: { [oreId]: units } }                                    // lifetime, both grades, for contract steps
 *
 * The contract grants only the hub (owner 2026-11-07, story O16); everything else is bought with place() and
 * buyHarvester(). A rig mines into its own small bay (Rig_Bay_Min minutes of output) whenever it is powered; a
 * finished, powered Storage Tower raises every rig's bay to Bay_Hours; an unpowered tower's door is closed. Ore
 * already stored is never lost to a power cut, and the hub can always ship it (sell).
 *
 * The map (Forge format, tech plan §6.6; src/outpost/draftLayout.js until O4): { pads: [{ id, x, y, w, h, role,
 * remote }], deposits: [{ tier, pad }], kitDefenses: [{ kind, cell }] } — kitDefenses is the reference defense set
 * (referenceOutpost, the raid measurement); it is not granted.
 *
 * Harvesters (story O10, design §6): a finished, powered Resource Bay sends its harvesters to the outpost map's surface
 * fields (common and uncommon, off the mesa) at the battle harvest rate (data/outpost.js harvesterRate), into a hopper
 * that holds Hopper_Hours of their gathering; emptyHopper() banks it when the outpost is opened. Like a rig, in closed
 * form inside advance().
 *
 * Guns and the Habitat (story O15): the hub crews Gun_Cap guns (Machine Guns and Cannons; walls do not count); the
 * one Habitat adds Habitat_Guns_Per_Tier per tier. place() refuses a gun over the cap.
 *
 * Tech (story O10): ctx.unlocks is the Outpost tech the player OWNS (bought in the Tech Tree after a contract
 * unlocked it); ctx.techOwned the whole tree's owned ids. A defense goes past tier 1 only at an outpost with a
 * finished, powered Upgrade Bay, up to the tier the player owns in the tree (mg2, cannon3, ...; walls: Reinforced Walls).
 *
 * Raids: `advance` finds each raid due and asks `ctx.raid(outpost, { at, window, first, powered })` for its outcome:
 * { result: 'held' | 'breach', defenses: [{ id, hp }] }. The game passes the battle sim's runRaid (story O7); the
 * tests and the review page pass a stand-in. raidOutcome() applies an outcome: a breach loses Breach_Storage_Loss of
 * every bay and changes no building (owner Q6).
 */
import { createRng } from '../sim/rng.js';
import { oresOf, oreById, oreItemId } from '../data/ores.js';
import { OUTPOST, structureDef, DEFENSE_KINDS, GUN_KINDS, canonicalKind, harvesterDef, harvesterRate } from '../data/outpost.js';

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

// ── creating the outpost (the contract grants the hub) ───────────────────────────────────────────────────────────
const firstPad = (map, role, f = () => true) => map.pads.find((p) => p.role === role && !p.remote && f(p));
/** The default pads the first setup goes on: { hub, power, rig (on the common deposit), storage } → pad ids. */
export function defaultPads(map) {
  const id = (p) => (p ? p.id : null);
  return {
    hub: id(firstPad(map, 'hub')), power: id(firstPad(map, 'power')),
    rig: id(firstPad(map, 'rig', (p) => depositOf(map, p.id) === 'common')), storage: id(firstPad(map, 'storage')),
  };
}

/**
 * The outpost the contract grants (design §2.3, owner 2026-11-07): ONLY the Outpost Hub, on its pad. The player buys
 * the Power Station, the Mining Rig, the Storage Tower, the Resource Bay, harvesters and the defenses with their own
 * gold through place() / buyHarvester(). It is not online until confirmOnline().
 */
export function createOutpost(planet, { seed, map, now }) {
  return {
    planet, seed: seed >>> 0, online: false, t: now, firstRaidAt: null,
    pads: { [firstPad(map, 'hub').id]: { kind: 'hub', tier: 1 } }, building: [], defenses: [], storage: {},
    harvesters: 0, hopper: {}, raids: { window: null, log: [] }, sold: {},
  };
}

/**
 * The reference outpost (the former contract kit): the hub, Power Station I, a Rig I on the common deposit, Storage
 * Tower I, all finished, and the map's `kitDefenses` (the reference "starter defense set" the raid measurement uses,
 * tech plan §4.3). Nothing in play grants it; the measurement, the tests and the review pages build it directly.
 */
export function referenceOutpost(planet, { seed, map, now }) {
  const o = createOutpost(planet, { seed, map, now });
  const d = defaultPads(map);
  o.pads[d.power] = { kind: 'power', tier: 1 };
  o.pads[d.rig] = { kind: 'rig', tier: 1, deposit: 'common', deep: false };
  o.pads[d.storage] = { kind: 'storage', tier: 1 };
  o.storage[d.rig] = {};
  o.defenses = (map.kitDefenses || []).map((k, i) => ({
    id: `d${i + 1}`, kind: k.kind, tier: 1, cell: [...k.cell], hp: structureDef(k.kind, 1).battle.hp,
  }));
  return o;
}

/**
 * Bring a saved outpost up to the current rules (save migration): the Harvester Bay is now the Resource Bay
 * (owner 2026-11-07), and outposts saved before harvesters were bought get `harvesters: 0`. Changes `o` in place.
 */
export function migrateOutpost(o) {
  if (!o || typeof o !== 'object') return o;
  for (const b of Object.values(o.pads || {})) if (b && b.kind) b.kind = canonicalKind(b.kind);
  for (const b of o.building || []) if (b && b.kind) b.kind = canonicalKind(b.kind);
  if (!Number.isFinite(o.harvesters)) o.harvesters = 0;
  if (!o.hopper || typeof o.hopper !== 'object') o.hopper = {};
  return o;
}

// ── power (design §4.5) ──────────────────────────────────────────────────────────────────────────────────────────
// Consumers are served in this order when a grid is short, so the outpost keeps its core running first.
const PRIORITY = { hub: 0, storage: 1, rig: 2, mg: 3, cannon: 3, resourceBay: 4, upgradeBay: 5, habitat: 6 };

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
/**
 * The tier of the Storage Tower whose door is open (finished and powered), or 0 (owner 2026-11-07: a tower without
 * power has its door closed and takes no new ore). `powered` is a Set from powerGrids; without it (no map to hand)
 * a finished tower counts as powered.
 */
function openTowerTier(o, powered) {
  return Math.max(0, ...Object.entries(o.pads)
    .filter(([id, b]) => b.kind === 'storage' && (!powered || powered.has(id))).map(([, b]) => b.tier));
}
const capFor = (o, padId, towerTier, params = OUTPOST) => {
  const ore = rigOre(o, padId), rig = structureDef('rig', o.pads[padId].tier);
  if (!ore || !rig) return 0;
  if (!towerTier) return ore.rate * params.Rig_Bay_Min * rig.capacityMult;
  const st = structureDef('storage', towerTier);
  return st ? ore.rate * 60 * st.bayHours * rig.capacityMult : 0;
};
/**
 * The bay capacity of a rig, in units (design §4.2, owner 2026-11-07). A rig mines into its own bay. Without an open
 * Storage Tower the bay is small: Rig_Bay_Min minutes of its shallow output × the Mk II multiplier. A finished,
 * powered tower raises it to Bay_Hours of that output (× Mk II, × Storage Tower II). Pass the map so an unpowered
 * tower (door closed) is not counted; without it every finished tower counts.
 */
export function bayCapacity(o, padId, map, params = OUTPOST) {
  return capFor(o, padId, openTowerTier(o, map ? powerGrids(o, map).powered : null), params);
}
const bayUnits = (o, padId) => Object.values(o.storage[padId] || {}).reduce((a, b) => a + b, 0);

/** Units per minute a rig produces now: its ore at its grade, × its tier's Rate_Mult. */
export function rigRatePerMin(o, padId) {
  const b = o.pads[padId], ore = rigOre(o, padId);
  if (!ore) return 0;
  return ore.rate * (b.deep ? ore.deepRate : 1) * structureDef('rig', b.tier).rateMult;
}

/**
 * Which rigs run now (owner 2026-11-07: no electricity, no operation): every finished, powered rig, into its own bay,
 * whose cap an open Storage Tower raises. Mining does not wait for the outpost to go online or for a tower; ore
 * already stored is never lost when power goes. → [{ pad, item, rate, cap }]
 */
function runningRigs(o, map, params = OUTPOST) {
  const { powered } = powerGrids(o, map);
  const tower = openTowerTier(o, powered);
  return Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig' && powered.has(id) && rigOre(o, id)).map((id) => {
    const ore = rigOre(o, id);
    return { pad: id, item: oreItemId(ore.id, !!o.pads[id].deep), rate: rigRatePerMin(o, id) / MIN, cap: capFor(o, id, tower, params) };
  });
}

// ── harvesters and the hopper (design §6, story O10) ─────────────────────────────────────────────────────────────
/** The surface tiers a Resource Bay's harvesters gather: the map's primary fields are common, premium uncommon. */
export const HARVEST_TIERS = Object.freeze(['common', 'uncommon']);
const ROLE_TIER = { primary: 'common', premium: 'uncommon' };
/**
 * The surface fields the harvesters can reach: the outpost map's resources (Forge `resources`) of the two tiers, off
 * the mesa (heights > 0) and off the pads and their 1-cell margin, the cells the view draws. -> [{ x, y, tier }]
 */
export function surfaceFields(map) {
  const cols = map.width, H = map.heights;
  const onPad = (x, y) => (map.pads || []).some((p) => x >= p.x - 1 && x < p.x + p.w + 1 && y >= p.y - 1 && y < p.y + p.h + 1);
  return (map.resources || []).filter((r) => ROLE_TIER[r.role] && !(H && H[r.y * cols + r.x] > 0) && !onPad(r.x, r.y))
    .map((r) => ({ x: r.x, y: r.y, tier: ROLE_TIER[r.role] }));
}
/** The finished Resource Bay's pad id, or null. */
export const resourceBayPad = (o) => Object.keys(o.pads).sort().find((id) => o.pads[id].kind === 'resourceBay') || null;

/**
 * Where each harvester works (the view drives them along these): harvesters alternate common, uncommon, common, ...;
 * each takes the nearest free field cell of its tier to the Resource Bay (the other tier when the map has none).
 * -> [{ i, tier, from: [x, y] (the bay's centre), field: [x, y] (cell), dist (cells), rate (units / ms) }]; [] with no
 * finished bay or no fields. Power is not asked here (see harvestRunning).
 */
export function harvestPlan(o, map, params = OUTPOST) {
  const bay = resourceBayPad(o), n = Math.min(o.harvesters || 0, params.Harvester_Max ?? 4);
  if (!bay || !n) return [];
  const pad = padOf(map, bay);
  if (!pad) return [];
  const at = centre(pad), fields = surfaceFields(map);
  const byTier = {};
  for (const t of HARVEST_TIERS) {
    byTier[t] = fields.filter((f) => f.tier === t)
      .map((f) => ({ ...f, d: dist(at, cellCentre([f.x, f.y])) })).sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
  }
  const used = { common: 0, uncommon: 0 }, out = [];
  for (let i = 0; i < n; i++) {
    let tier = HARVEST_TIERS[i % 2];
    if (!byTier[tier].length) tier = HARVEST_TIERS[(i + 1) % 2];
    const list = byTier[tier];
    if (!list.length) break;
    const f = list[Math.min(used[tier]++, list.length - 1)];
    out.push({ i, tier, from: at, field: [f.x, f.y], dist: f.d, rate: harvesterRate(tier, f.d, params) / 1000 });
  }
  return out;
}
/** The hopper's size in units: Hopper_Hours of what the harvesters bring in when the bay runs. */
export function hopperCap(o, map, params = OUTPOST) {
  return harvestPlan(o, map, params).reduce((a, h) => a + h.rate, 0) * params.Hopper_Hours * HOUR;
}
/** The harvesters at work now: the plan when the Resource Bay is finished AND powered (no power, no operation). */
export function harvestRunning(o, map, params = OUTPOST, powered = powerGrids(o, map).powered) {
  const bay = resourceBayPad(o);
  return bay && powered.has(bay) ? harvestPlan(o, map, params) : [];
}
export const hopperUnits = (o) => Object.values(o.hopper || {}).reduce((a, b) => a + b, 0);

/**
 * Empty the hopper (opening the outpost, design §6): its whole units leave for the player's inventory, the fractions
 * stay. -> { outpost, units: { common, uncommon } } (only tiers with a whole unit). The caller banks `units`
 * (src/save/inventory.js bankOutpostHarvest).
 */
export function emptyHopper(outpost) {
  const o = clone(outpost), units = {};
  o.hopper = o.hopper || {};
  for (const [tier, u] of Object.entries(o.hopper)) {
    const whole = Math.floor(u + 1e-9);
    if (whole <= 0) continue;
    units[tier] = whole;
    o.hopper[tier] = Math.max(0, u - whole);
  }
  return { outpost: o, units };
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
  const report = { from: o.t, to: o.t, extracted: {}, harvested: {}, full: [], raids: [], built: [] };
  o.hopper = o.hopper || {};
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
    for (const r of runningRigs(o, map, params)) {
      const bay = (o.storage[r.pad] ||= {});
      const space = r.cap - bayUnits(o, r.pad);
      if (space <= 0) continue;
      const got = Math.min(r.rate * dt, space);
      bay[r.item] = (bay[r.item] || 0) + got;
      report.extracted[r.item] = (report.extracted[r.item] || 0) + got;
      if (got >= space - 1e-9) report.full.push({ pad: r.pad, at: now + space / r.rate });
    }
    // the harvesters: one hopper for both tiers, filled in proportion to each harvester's rate, capped at Hopper_Hours
    const hv = harvestRunning(o, map, params);
    if (hv.length) {
      const R = hv.reduce((a, h) => a + h.rate, 0), cap = R * params.Hopper_Hours * HOUR, space = cap - hopperUnits(o);
      if (R > 0 && space > 0) {
        const got = Math.min(R * dt, space);
        for (const h of hv) {
          const g = got * (h.rate / R);
          o.hopper[h.tier] = (o.hopper[h.tier] || 0) + g;
          report.harvested[h.tier] = (report.harvested[h.tier] || 0) + g;
        }
        if (got >= space - 1e-9) report.hopperFull = now + space / R;
      }
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
/**
 * What stops the outpost going online (contract step 1, "Establish"; owner 2026-11-07): [] once the hub, a Power
 * Station, a Mining Rig on the common deposit and a Storage Tower are all FINISHED and powered. Mining itself needs
 * no tower (a rig fills its own small bay), but the contract's ask does. Buildings still under construction do not
 * count. → ['no power station', 'no mining rig on the iron', 'no storage tower', 'r1 unpowered (reach)', …]
 */
export function onlineProblems(o, map) {
  const { off } = powerGrids(o, map);
  const out = [];
  const has = (f) => Object.values(o.pads).some(f);
  const common = (oresOf(o.planet).find((x) => x.tier === 'common') || { name: 'common ore' }).name.toLowerCase();
  if (!has((b) => b.kind === 'hub')) out.push('no hub');
  if (!has((b) => b.kind === 'power')) out.push('no power station');
  if (!has((b) => b.kind === 'rig' && b.deposit === 'common')) out.push(`no mining rig on the ${common}`);
  if (!has((b) => b.kind === 'storage')) out.push('no storage tower');
  for (const [id, why] of Object.entries(off)) {
    const b = o.pads[id];
    if (b && (b.kind === 'hub' || b.kind === 'storage' || (b.kind === 'rig' && b.deposit === 'common'))) out.push(`${id} unpowered (${why})`);
  }
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
  resourceBay: ['bay', 'spare'], upgradeBay: ['bay', 'spare'], habitat: ['bay', 'spare'],
};
/** The pad kinds the build list offers (everything but the granted hub), and the defenses (placed on cells). */
export const PAD_KINDS = Object.freeze(['power', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'habitat']);

// ── the gun cap (owner 2026-11-07, design §6, story O15) ─────────────────────────────────────────────────────────
/** The guns placed (Machine Guns and Cannons, wrecks included: a wreck keeps its crew post). Walls do not count. */
export const gunCount = (o) => o.defenses.filter((d) => GUN_KINDS.includes(d.kind)).length;
/** The finished Habitat's tier (0 = none). Under construction it does not count yet. */
export const habitatTier = (o) => Math.max(0, ...Object.values(o.pads).filter((b) => b.kind === 'habitat').map((b) => b.tier));
/** How many guns the outpost crews: Gun_Cap from the hub, + Habitat_Guns_Per_Tier for each Habitat tier. */
export function gunCap(o, params = OUTPOST) {
  return (params.Gun_Cap ?? 3) + (params.Habitat_Guns_Per_Tier ?? 2) * habitatTier(o);
}
/** Why one more gun cannot be placed now, or null. */
export function gunRefusal(o, params = OUTPOST) {
  const n = gunCount(o), cap = gunCap(o, params), h = habitatTier(o);
  if (n < cap) return null;
  if (!h) return `the hub crews ${cap} guns: build a Habitat for more`;
  if (structureDef('habitat', h + 1)) return `the Habitat crews ${cap} guns: upgrade it to Habitat ${'I'.repeat(h + 1)} for more`;
  return `the outpost crews at most ${cap} guns`;
}
const busy = (o, pad) => !!o.pads[pad] || o.building.some((b) => b.pad === pad);

/**
 * Build something new on an empty pad, or a defense on a free cell, with the player's gold (owner 2026-11-07: the
 * contract grants only the hub). what: { pad, kind } with kind one of PAD_KINDS ('harvesterBay' is read as
 * 'resourceBay'), or { cell, kind } with kind one of DEFENSE_KINDS ('mg', 'cannon', 'wall').
 * ctx: { map, gold, now, unlockedTiers: ['common', …], unlocks: Set|[] of tech ids }.
 * → { outpost, cost } or { error }. A pad building goes into `building` and lands after its Build_Sec (advance()
 * finishes it); a defense is placed at once, at full HP; only repair() restores HP afterwards.
 */
export function place(outpost, what, ctx) {
  const { map, gold = Infinity, now } = ctx;
  const kind = canonicalKind(what.kind);
  if (kind === 'harvester') return { error: 'harvesters are bought, not placed (buyHarvester)' };
  if (kind === 'hub') return { error: 'the hub comes with the contract' };
  const def = structureDef(kind, 1);
  if (!def) return { error: `unknown building ${kind}` };
  if (GUN_KINDS.includes(kind)) { const why = gunRefusal(outpost, P(ctx)); if (why) return { error: why }; }
  if (kind === 'habitat' && (Object.values(outpost.pads).some((b) => b.kind === 'habitat') || outpost.building.some((b) => b.kind === 'habitat'))) {
    return { error: 'the outpost has its Habitat: upgrade it to Habitat II' };
  }
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

const inSet = (set, id) => (set instanceof Set ? set.has(id) : (set || []).includes(id));
function unlocked(def, ctx, o) {
  const u = def.unlock || '';
  if (u === 'granted' || u === 'kit' || u.startsWith('contract:')) return true;
  if (u.startsWith('tech:')) return inSet(ctx.unlocks, u.slice(5));
  // a tower tier from the tech tree (mg2, cannon3 ...), at an outpost with an Upgrade Bay (design §5.2, §6)
  if (u === 'techtree+upgradeBay') return inSet(ctx.techOwned, `${def.kind}${def.tier}`) && Object.values(o.pads).some((b) => b.kind === 'upgradeBay');
  return false;
}

// ── defense upgrades: the Upgrade Bay (design §6, story O10) ─────────────────────────────────────────────────────
const TECH_NAME = { reinforced_walls: 'Reinforced Walls' };
const DEF_NAME = { mg: 'Machine Gun', cannon: 'Cannon', wall: 'Wall' };
/** A finished Upgrade Bay with power (map given): "no electricity, no operation". -> pad id or null */
export function upgradeBayReady(o, map) {
  const ids = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'upgradeBay');
  if (!ids.length) return null;
  if (!map) return ids[0];
  const { powered } = powerGrids(o, map);
  return ids.find((id) => powered.has(id)) || null;
}
/**
 * Why a defense cannot go to its next tier now, or null (gold is asked only when ctx.gold is given). Tiers past I need
 * a finished, powered Upgrade Bay at this outpost, and the tier owned in the tech tree: `<kind><tier>` (mg2, cannon3)
 * for an Unlock of 'techtree+upgradeBay', the Outpost node for 'tech:<node>' (walls: Reinforced Walls).
 * ctx: { map, gold?, techOwned: Set<tree id>, unlocks: Set<owned Outpost node> }.
 */
export function defenseUpgradeRefusal(o, id, ctx = {}) {
  const d = o.defenses.find((x) => x.id === id);
  if (!d) return `no defense ${id}`;
  const next = structureDef(d.kind, d.tier + 1);
  if (!next) return `the ${DEF_NAME[d.kind] || d.kind} is at its top tier`;
  if (d.hp <= 0) return 'repair the wreck first';
  if (!Object.values(o.pads).some((b) => b.kind === 'upgradeBay')) return 'build the Upgrade Bay first';
  if (ctx.map && !upgradeBayReady(o, ctx.map)) return 'the Upgrade Bay has no power';
  const u = next.unlock || '';
  if (u === 'techtree+upgradeBay' && !inSet(ctx.techOwned, `${d.kind}${next.tier}`)) return `needs ${DEF_NAME[d.kind]} T${next.tier} in the Tech Tree`;
  if (u.startsWith('tech:') && !inSet(ctx.unlocks, u.slice(5))) return `needs ${TECH_NAME[u.slice(5)] || u.slice(5).replace(/_/g, ' ')} in the Tech Tree`;
  if (next.cost > (ctx.gold ?? Infinity)) return `costs ${next.cost} gold`;
  return null;
}
/**
 * Install a defense's next tier at the Upgrade Bay (instant, as placing a defense is). Its HP rises by the tier's
 * extra HP; wear it already had stays (only repair() restores HP). -> { outpost, cost } or { error }
 */
export function upgradeDefense(outpost, id, ctx = {}) {
  const why = defenseUpgradeRefusal(outpost, id, ctx);
  if (why) return { error: why };
  const o = clone(outpost), d = o.defenses.find((x) => x.id === id);
  const was = structureDef(d.kind, d.tier), next = structureDef(d.kind, d.tier + 1);
  d.tier += 1;
  d.hp = Math.min(next.battle.hp, d.hp + (next.battle.hp - was.battle.hp));
  return { outpost: o, cost: next.cost };
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

// ── harvesters (owner 2026-11-07: bought from the build list once the Resource Bay is built) ────────────────────────
/**
 * How many harvesters the Resource Bay holds (design §6: 2 to start, up to 4): Harvester_Cap, + 1 each for the tech
 * tree's Dock 3 and Dock 4 at an outpost with a finished Upgrade Bay (tech-tree upgrades reach an outpost through its
 * Upgrade Bay, design §6), never above Harvester_Max. ctx: { techOwned?, params? }.
 */
export function harvesterCap(o, ctx = {}) {
  const params = P(ctx), h = harvesterDef();
  const base = params.Harvester_Cap ?? (h && h.cap) ?? 2, max = params.Harvester_Max ?? (h && h.max) ?? 4;
  const bay = Object.values(o.pads).some((b) => b.kind === 'upgradeBay');
  const docks = bay ? ['dock3', 'dock4'].filter((id) => inSet(ctx.techOwned, id)).length : 0;
  return Math.min(max, base + docks);
}
/** What stops buying a harvester now, or null: no finished Resource Bay, the cap reached, or the gold short. */
export function harvesterRefusal(o, ctx = {}) {
  const h = harvesterDef();
  if (!h) return 'harvesters are not in the data';
  if (!Object.values(o.pads).some((b) => b.kind === 'resourceBay')) return 'build the Resource Bay first';
  const cap = harvesterCap(o, ctx);
  if ((o.harvesters || 0) >= cap) return `the Resource Bay holds ${cap} harvesters`;
  if (h.cost > (ctx.gold ?? Infinity)) return `costs ${h.cost} gold`;
  return null;
}
/**
 * Buy one harvester for the outpost's Resource Bay. ctx: { gold, params? }. → { outpost, cost } or { error }.
 * Refused until a FINISHED Resource Bay exists, and at Harvester_Cap. What a harvester gathers is story O10; this
 * is the purchase and the count (`o.harvesters`).
 */
export function buyHarvester(outpost, ctx = {}) {
  const why = harvesterRefusal(outpost, ctx);
  if (why) return { error: why };
  const o = clone(outpost);
  o.harvesters = (o.harvesters || 0) + 1;
  return { outpost: o, cost: harvesterDef().cost };
}

// ── warnings (owner 2026-11-07: full storage or no electricity shows a warning) ──────────────────────────────────
/**
 * Per-building warning flags for the view's warning icons. → { [padId | defenseId]: ['no_power' | 'storage_full' |
 * 'door_closed', …] }, only for ids with a warning. Finished buildings only.
 *   - no_power: a building (or gun) that draws power and gets none: it does not operate; what it stores is kept;
 *   - storage_full: a rig whose bay is full (it has stopped), and the Storage Tower when every rig's bay is full;
 *   - door_closed: a Storage Tower without power: it takes no new ore (rigs fill only their own small bays).
 */
export function warnings(o, map, params = OUTPOST) {
  const { powered, off } = powerGrids(o, map);
  const tower = openTowerTier(o, powered);
  const out = {};
  const add = (id, w) => { (out[id] ||= []).includes(w) || out[id].push(w); };
  for (const id of Object.keys(off)) add(id, 'no_power');
  const rigs = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig' && rigOre(o, id));
  const fullRig = (id) => bayUnits(o, id) >= capFor(o, id, tower, params) - 1e-6;
  for (const id of rigs) if (fullRig(id)) add(id, 'storage_full');
  for (const [id, b] of Object.entries(o.pads)) {
    if (b.kind !== 'storage') continue;
    if (!powered.has(id)) add(id, 'door_closed');
    else if (rigs.length && rigs.every(fullRig)) add(id, 'storage_full');
  }
  return out;
}

// ── the Sensor Spire (design §7): a raid's early warning ────────────────────────────────────────────────────────────
/**
 * The next raid after `from` (ms): the scripted first raid, else the schedule's next (the same draw advance() uses),
 * looked for up to `horizonMs` ahead. -> ms or null. Offline outposts are not raided. Pure.
 */
export function nextRaidAt(o, from, { params = OUTPOST, horizonMs = 24 * HOUR } = {}) {
  if (!o.online) return null;
  if (o.firstRaidAt != null && o.firstRaidAt > from) return o.firstRaidAt;
  const w = windowMs(params);
  const fromW = Math.max(Math.floor(from / w), o.raids.window == null ? -Infinity : o.raids.window + 1);
  const r = raidSchedule(o.seed, fromW, Math.floor((from + horizonMs) / w), params).find((x) => x.at > from);
  return r ? r.at : null;
}
/** A raid inbound within ctx.leadMs (the Sensor Spire's 10 minutes): ms until it, or null. Needs the node owned. */
export function raidWarning(o, now, ctx = {}) {
  if (!inSet(ctx.unlocks, 'sensor_spire')) return null;
  const at = nextRaidAt(o, now, { params: P(ctx) });
  const lead = ctx.leadMs ?? 10 * MIN;
  return at != null && at - now <= lead ? at - now : null;
}

/** A one-glance status for the menu's OUTPOST button (design §10): loads ready, storage full, worn defenses, last raid. */
export function status(o, ctx) {
  const rigs = Object.keys(o.pads).filter((id) => o.pads[id].kind === 'rig');
  const map = ctx && ctx.map;
  const full = rigs.length > 0 && rigs.every((id) => bayUnits(o, id) >= bayCapacity(o, id, map) - 1e-6);
  const worn = o.defenses.some((d) => d.hp < structureDef(d.kind, d.tier).battle.hp);
  const last = o.raids.log[o.raids.log.length - 1] || null;
  const loads = loadsReady(o, ctx);
  return { loads, full, worn, lastRaid: last, dot: loads > 0 || worn };
}
