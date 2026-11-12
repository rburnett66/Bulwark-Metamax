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
 *     fields: { [fieldId]: units },                                 // surface field stock (O10); absent = full
 *     liveHarvest?: { from, to },                                   // a visit's stretch the battle sim's trucks ran (S4)
 *     raids: { window, log: [{ at, result, lost, damage, bounty? }] },
 *     sold: { [oreId]: units } }                                    // lifetime, both grades, for contract steps
 *
 * The contract grants only the hub (owner 2026-11-07, story O16); everything else is bought with place() and
 * buyHarvester(). A rig mines into its own small bay (Rig_Bay_Min minutes of output) whenever it is powered; a
 * finished, powered Storage Tower raises every rig's bay to Bay_Hours; an unpowered tower's door is closed. Ore
 * already stored is never lost to a power cut, and the hub can always ship it (sell).
 *
 * The map (Forge format, tech plan §6.6; outpostMap.js): { hub: { id, x, y, w, h } (the landing pad), deposits:
 * [{ tier, x, y }] (2 × 2 cells each), kitDefenses: [{ kind, cell }] } — kitDefenses is the reference defense set
 * (referenceOutpost, the raid measurement); it is not granted. No build pads (One Battle UX S2c.2
 * [MM-story_mwc9pmbn_2i]): a building's key in o.pads is just its id; where it stands is its own `at` rectangle
 * (buildingRect). Old saves keyed buildings by the map pads they stood on — legacyPads.js remembers those rectangles
 * and siting.js migrateOutpostLayout moves such buildings onto their own `at`.
 *
 * Harvesters (story O10, design §6, §6.2): a finished, powered Resource Bay sends its harvesters to the outpost map's
 * surface fields (common and uncommon, off the mesa). They drive and load at the battle harvest rate (data/outpost.js
 * harvesterRate), but a field is a finite stock that regrows at Surface_Respawn_Mult (5 %) of the battle's rate (owner
 * 2026-11-07): a harvester takes its field's stock, then only what regrows. Into a hopper that holds Hopper_Hours of
 * the steady take; emptyHopper() banks it when the outpost is opened. Piecewise closed form inside advance().
 *
 * Guns and the Habitat (story O15): the hub crews Gun_Cap guns (Machine Guns and Cannons; walls do not count); the
 * one Habitat adds Habitat_Guns_Per_Tier per tier. place() refuses a gun over the cap.
 *
 * Tech (story O10): ctx.unlocks is the Outpost tech the player OWNS (bought in the Tech Tree after a contract
 * unlocked it); ctx.techOwned the whole tree's owned ids. A defense goes past tier 1 only at an outpost with a
 * finished, powered Upgrade Bay, up to the tier the player owns in the tree (mg2, cannon3, ...; walls: Reinforced Walls).
 *
 * Raids: `advance` finds each raid due and asks `ctx.raid(outpost, { at, window, first, powered })` for its outcome:
 * { result: 'held' | 'breach', defenses: [{ id, hp }], cells? }. The game passes the battle sim's runRaid (story O7); the
 * tests and the review page pass a stand-in. raidOutcome() applies an outcome: a breach loses Breach_Storage_Loss of
 * every bay and changes no building (owner Q6). With a farm (o.farm), the raid's `cells` (where its raiders stood)
 * trample the plots at the raid's moment (src/farm/model.js trample) and the report's raid entry carries
 * `trampled: [{ plot, from, to }]` and `farmLoss` (Breach_Silo_Loss on a breach, else 0) for the farm store (story A11).
 */
import { createRng } from '../sim/rng.js';
import { ASSUMPTIONS, getStructureDef } from '../data/tables.js';
import { oresOf, oreById, oreItemId } from '../data/ores.js';
import { POWER_NODE_KINDS, outpostStructId } from '../data/outpostStructures.js';
import { legacyPadRect } from './legacyPads.js';
import { referenceKit, LAYOUT_VERSION } from './siting.js';
import { reservedRects } from './outpostMap.js';
import { OUTPOST, structureDef, DEFENSE_KINDS, GUN_KINDS, canonicalKind, harvesterDef, harvesterRate, surfaceStock, powerPriority } from '../data/outpost.js';
// the farm is a layer on the outpost (owner rule 7): it grows inside this advance() and its buildings join this power grid
import { growFarm, farmBuildEvents } from '../farm/grow.js';
// raids trample the farm (story A11): the raid's raider cells, applied at the raid's moment on this one clock
import { trample } from '../farm/model.js';
import { FARM, farmBuildingOf } from '../data/farm.js';

const MIN = 60_000, HOUR = 3_600_000;
const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const P = (ctx) => (ctx && ctx.params) || OUTPOST;

// ── the map ──────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Where a building stands, as a rectangle { id, x, y, w, h } [MM-story_mwc9pmbn_2i]. Every building carries its own
 * `at` rectangle (One Battle UX S2c); the hub stands on the map's landing pad (map.hub); a building from a save written
 * before S2c.2 that has no `at` yet stands where its legacy map pad was (legacyPads.js — the same rectangle, so
 * nothing moves). Every "where is this building" question goes through here. id: its key in o.pads (or a
 * construction job's `pad`). → the rect, or null when there is no such building.
 */
export function buildingRect(o, map, id) {
  const b = (o.pads && o.pads[id]) || ((o.building || []).find((j) => j.pad === id && j.at)) || ((o.building || []).find((j) => j.pad === id)) || null;
  if (!b) return null;
  if (b.at) return { id, x: b.at.x, y: b.at.y, w: b.at.w, h: b.at.h };
  if (b.kind === 'hub' && map && map.hub) return { id, x: map.hub.x, y: map.hub.y, w: map.hub.w, h: map.hub.h };
  return legacyPadRect(map, id);
}
/**
 * The ground the outpost's fixed features and buildings take: the map's landing pad and deposits (outpostMap.js
 * reservedRects), then every building and construction job where it stands (buildingRect), by id. → [{ x, y, w, h, what }].
 * What the farm keeps off and its walkers walk round (it replaced "the map's pads").
 */
export function takenRects(o, map) {
  const out = reservedRects(map);
  const ids = [...new Set([...Object.keys((o && o.pads) || {}), ...((o && o.building) || []).map((j) => j.pad)])].sort();
  for (const id of ids) {
    const kind = ((o.pads && o.pads[id]) || (o.building || []).find((j) => j.pad === id) || {}).kind;
    if (kind === 'hub') continue;   // the landing pad, above
    const r = buildingRect(o, map, id);
    if (r) out.push({ x: r.x, y: r.y, w: r.w, h: r.h, what: `${kind} ${id}` });
  }
  return out;
}
const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];
const cellCentre = (c) => [c[0] + 0.5, c[1] + 0.5];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The deposit tier a rig standing on rectangle `rect` mines (its top-left on the deposit's, the rig rule), or null. */
export const depositAt = (map, rect) => (rect && ((map && map.deposits) || []).find((d) => d.x === rect.x && d.y === rect.y) || {}).tier || null;

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
 * The outpost's size for the raid rule (owner 2026-11-11: "The bigger the base the more frequent attacks."): the
 * buildings and defenses it has finished at `at` (ms), the granted hub left out, so a fresh outpost is size 0 and is
 * raided at the base rate. A build or a defense still under way counts once it finishes by `at`; a defense being sold
 * stops counting once its dismantling is done. It counts what stands, not the gold spent, so the player reads it at a
 * glance: every pad filled and every defense placed (walls included) adds one. Pure. [MM-story_mwcfrtu4_2w]
 * The farm's buildings count too (owner 2026-11-11, on #281: "farm buildings count: yes"): the farm is o.farm on this
 * same record (farm/model.js), so a Farmhouse, Silo or Pump adds one once its build is done by `at`. Plots do not count:
 * they are ground, not buildings. Tier does not weigh in (pending the owner). [MM-story_mwco8she_38]
 */
export function outpostSize(o, at = o.t) {
  let n = 0;
  const pads = o.pads || {};
  for (const b of Object.values(pads)) if (b && b.kind && b.kind !== 'hub') n++;
  for (const b of o.building || []) if (b.done <= at && !(pads[b.pad] && pads[b.pad].kind)) n++;
  for (const d of o.defenses || []) {
    if (d.building && d.building.done > at) continue;
    if (d.selling && d.selling.done <= at) continue;
    n++;
  }
  for (const b of Object.values((o.farm && o.farm.buildings) || {})) if (b && b.done <= at) n++;
  return n;
}

/**
 * The raid chance per window at outpost size `size` (workbook Outpost_Params): the base, window / Raid_Mean_Hours,
 * grown by Raid_Chance_Per_Size for every unit of size, never above Raid_Chance_Max (nor 1: a window holds at most one
 * raid). Size 0 is the base chance exactly.
 */
export function raidChance(size = 0, params = OUTPOST) {
  const base = params.Raid_Min_Gap_Hours / params.Raid_Mean_Hours;
  const grown = base * (1 + (params.Raid_Chance_Per_Size || 0) * Math.max(0, size || 0));
  return Math.min(grown, params.Raid_Chance_Max ?? 1, 1);
}

/**
 * Every window's draw in [fromWindow, toWindow]: [{ window, at, roll }]: the minute a raid would come and the roll it
 * must beat (roll < raidChance(size): it comes). Drawn from the seed and the window index only, so the schedule never
 * depends on how often the game is opened (tech plan §4.2), nor on the size: a bigger base turns more of the SAME
 * draws into raids, so on one seed it is never raided less than a smaller one.
 */
function raidDraws(seed, fromWindow, toWindow, params = OUTPOST) {
  const w = windowMs(params), out = [];
  for (let i = fromWindow; i <= toWindow; i++) {
    const rng = createRng(mix(seed, i));
    const roll = rng.next();
    out.push({ window: i, at: i * w + Math.floor(rng.next() * (w / MIN)) * MIN, roll });
  }
  return out;
}

/**
 * The raids in windows [fromWindow, toWindow], in order: [{ window, at }], for an outpost of `size` (outpostSize).
 * A window holds a raid with probability raidChance(size), at a minute inside it. Pure in (seed, windows, params,
 * size); size 0 is the schedule from before raids grew with the base.
 */
export function raidSchedule(seed, fromWindow, toWindow, params = OUTPOST, size = 0) {
  const chance = raidChance(size, params);
  return raidDraws(seed, fromWindow, toWindow, params).filter((d) => d.roll < chance).map(({ window, at }) => ({ window, at }));
}

/** This outpost's raids in windows [fromWindow, toWindow], each judged at the size the outpost has at its minute
 *  (outpostSize(o, at)): the one rule advance() and the Sensor Spire's forecast both read. */
function outpostRaids(o, fromWindow, toWindow, params) {
  return raidDraws(o.seed, fromWindow, toWindow, params).filter((d) => d.roll < raidChance(outpostSize(o, d.at), params))
    .map(({ window, at }) => ({ window, at }));
}

// ── creating the outpost (the contract grants the hub) ───────────────────────────────────────────────────────────
/** The reference kit's building ids: { hub, power, rig (on the common deposit), storage } (siting.js referenceKit). */
export function defaultPads() {
  return { hub: 'hub', power: 'p1', rig: 'r1', storage: 's1' };
}

/**
 * The outpost the contract grants (design §2.3, owner 2026-11-07): ONLY the Outpost Hub, on its pad. The player buys
 * the Power Station, the Mining Rig, the Storage Tower, the Resource Bay, harvesters and the defenses with their own
 * gold through place() / buyHarvester(). It is not online until confirmOnline().
 */
export function createOutpost(planet, { seed, map, now }) {
  return {
    planet, seed: seed >>> 0, online: false, t: now, firstRaidAt: null,
    pads: { [(map.hub && map.hub.id) || 'hub']: { kind: 'hub', tier: 1 } }, building: [], defenses: [], storage: {},
    harvesters: 0, hopper: {}, fields: {}, raids: { window: null, log: [] }, sold: {},
    layout: LAYOUT_VERSION,   // sited by the S2c.2 rules from the start (siting.js migrateOutpostLayout skips it)
    lifetime: newLifetime(now),
  };
}

/**
 * The reference outpost (the former contract kit): the hub, Power Station I, a Rig I on the common deposit, Storage
 * Tower I, all finished, and the map's `kitDefenses` (the reference "starter defense set" the raid measurement uses,
 * tech plan §4.3). Nothing in play grants it; the measurement, the tests and the review pages build it directly.
 * Where each piece stands is siting.js referenceKit: by the shared placement rules (the hub clearance, the 1-cell
 * build spacing, the rig on its deposit), deterministic per map.
 */
export function referenceOutpost(planet, { seed, map, now }) {
  const o = createOutpost(planet, { seed, map, now });
  const kit = referenceKit(map);
  for (const [id, b] of Object.entries(kit.pads)) o.pads[id] = clone(b);
  o.storage[defaultPads().rig] = {};
  o.defenses = kit.defenses.map((k, i) => ({
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
  if (!o.fields || typeof o.fields !== 'object') o.fields = {};
  if (!o.lifetime || typeof o.lifetime !== 'object') {
    // saved before the status screen counted: start from what was sold (a lower bound on what was mined)
    o.lifetime = newLifetime(o.t);
    for (const [ore, u] of Object.entries(o.sold || {})) o.lifetime.extracted[ore] = u;
  }
  return o;
}

// ── lifetime totals and current rates (the status screen, owner 2026-11-07: "the outpost is continual play, not wave
// based — there should be a status screen that says total collection, and current collection per hour rates") ──
/** The lifetime ledger: what the rigs extracted (per ore item), the harvesters gathered (per tier), and the gold sales paid. */
export function newLifetime(since) {
  return { since: since ?? null, extracted: {}, harvested: {}, gold: 0, loads: 0 };
}
/**
 * What the outpost collects per hour right now. Rigs: their rate while finished, powered and their bay has room (a full
 * bay or no power reads 0 with its reason). Harvesters: per field, the battle rate while it has stock, else what
 * regrows; 0 when the hopper is full or the bay is unpowered.
 * → { ore: [{ pad, item, perHour, stopped: null | 'full' | 'power' }], harvest: { common, uncommon }, oreTotal, harvestTotal }
 */
export function collectionRates(o, map, params = OUTPOST) {
  const { powered } = powerGrids(o, map);
  const tower = openTowerTier(o, powered);
  const ore = [];
  for (const id of Object.keys(o.pads).sort()) {
    const b = o.pads[id];
    if (b.kind !== 'rig' || !rigOre(o, id)) continue;
    const item = oreItemId(rigOre(o, id).id, !!b.deep), full = bayUnits(o, id) >= capFor(o, id, tower, params) - 1e-6;
    const stopped = !powered.has(id) ? 'power' : full ? 'full' : null;
    ore.push({ pad: id, item, perHour: stopped ? 0 : rigRatePerMin(o, id) * 60, stopped });
  }
  const harvest = { common: 0, uncommon: 0 };
  const running = harvestRunning(o, map, params, powered);
  if (running.length && hopperUnits(o) < hopperCap(o, map, params) - 1e-9) {
    const groups = new Map(surfaceFieldGroups(map, params).map((f) => [f.id, f])), demand = {};
    for (const h of running) demand[h.fieldId] = (demand[h.fieldId] || 0) + h.rate;
    for (const [id, d] of Object.entries(demand)) {
      const f = groups.get(id), S = Math.min(f.cap, (o.fields || {})[id] ?? f.cap);
      harvest[f.tier] += (S > 1e-9 ? d : Math.min(d, f.regrow)) * HOUR;
    }
  }
  return { ore, harvest, oreTotal: ore.reduce((a, r) => a + r.perHour, 0), harvestTotal: harvest.common + harvest.uncommon };
}

// ── power (design §4.5) ──────────────────────────────────────────────────────────────────────────────────────────
// Consumers are served in priority order when a grid is short (data/outpost.js POWER_PRIORITY), core first.

/**
 * The power grids, by proximity (One Battle UX S2b, plan §5.2). The NODES are the Power Stations (supply + reach) and
 * the Pylons (reach only: no supply, no draw — data/outpostStructures.js POWER_NODE_KINDS). Two nodes link when they
 * are within the larger of their reaches; linked nodes form one grid and pool their supply. A consumer joins the grid
 * of the nearest node whose reach covers its centre (a node of a pylons-only grid carries no power, so it is no
 * candidate), and a grid powers its consumers in priority order until its supply runs out. Positions are
 * buildingRect's, so map pads and free positions answer alike.
 * → { grids: [{ stations, nodes, supply, draw, powered }], powered: Set<id>, off: { [id]: 'reach' | 'supply' } }
 * `stations` are a grid's Power Stations, `nodes` all of its nodes (stations and pylons).
 * Ids are pad ids for buildings and defense ids for defenses. Walls draw nothing and are always on. Farm buildings
 * (o.farm.buildings, owner rule 7) are consumers on the same grids once finished at time `t` (default o.t).
 */
export function powerGrids(o, map, t = o.t) {
  const { nodes, find, groups: grids } = nodeGroups(o, map);
  // pylons linked to no station have no power to give: they are not a grid (unlitChains lists them, for drawing)
  for (const [root, g] of grids) if (!g.stations.length) grids.delete(root);
  return serveGrids(o, map, t, nodes, find, grids);
}

/** The grid nodes (stations + pylons) and their linked groups by the reach rule — powerGrids' first step, shared with
 *  unlitChains so both read one rule. → { nodes, find (node index → its group's root), groups: Map<root, group> } */
function nodeGroups(o, map) {
  const nodes = Object.entries(o.pads).filter(([, b]) => POWER_NODE_KINDS.includes(b.kind))
    .map(([id, b]) => ({ id, kind: b.kind, at: centre(buildingRect(o, map, id)), def: structureDef(b.kind, b.tier) }));
  // union nodes within reach of each other
  const parent = nodes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (dist(nodes[i].at, nodes[j].at) <= Math.max(nodes[i].def.reach, nodes[j].def.reach)) parent[find(i)] = find(j);
    }
  }
  const grids = new Map();
  nodes.forEach((s, i) => {
    const g = grids.get(find(i)) || { stations: [], nodes: [], supply: 0, draw: 0, powered: [], members: [] };
    if (s.kind === 'power') g.stations.push(s.id);
    g.nodes.push(s.id);
    g.supply += s.def.supply;
    grids.set(find(i), g);
  });
  return { nodes, find, groups: grids };
}

/**
 * The pylon chains linked to NO station (owner 2026-11-11, #282 answer 3: drawn with dark, unlit conduits). powerGrids
 * leaves them out — they carry no power, so they never power anything; this only says which pylons they are.
 * → [{ nodes: [pylon ids, sorted] }], sorted by first id.
 */
export function unlitChains(o, map) {
  return [...nodeGroups(o, map).groups.values()].filter((g) => !g.stations.length)
    .map((g) => ({ nodes: [...g.nodes].sort() }))
    .sort((a, b) => (a.nodes[0] < b.nodes[0] ? -1 : a.nodes[0] > b.nodes[0] ? 1 : 0));
}

/** powerGrids' second step: consumers join the nearest live node in reach, then each grid serves them by priority. */
function serveGrids(o, map, t, nodes, find, grids) {
  const consumers = [
    ...Object.entries(o.pads).filter(([, b]) => !POWER_NODE_KINDS.includes(b.kind))
      .map(([id, b]) => ({ id, kind: b.kind, at: centre(buildingRect(o, map, id)), draw: structureDef(b.kind, b.tier).draw })),
    ...o.defenses.map((d) => ({ id: d.id, kind: d.kind, at: cellCentre(d.cell), draw: structureDef(d.kind, d.tier).draw })),
    ...Object.entries((o.farm && o.farm.buildings) || {}).filter(([, b]) => b.done <= t)
      .map(([id, b]) => ({ id, kind: b.kind, at: [b.x + b.w / 2, b.y + b.h / 2], draw: farmBuildingOf(b.kind).draw })),
  ];
  const off = {}, powered = new Set();
  for (const c of consumers) {
    if (!c.draw) { powered.add(c.id); continue; }
    let best = null;
    nodes.forEach((s, i) => {
      const d = dist(s.at, c.at);
      if (d <= s.def.reach && grids.has(find(i)) && (!best || d < best.d)) best = { d, root: find(i) };
    });
    if (!best) { off[c.id] = 'reach'; continue; }
    grids.get(best.root).members.push(c);
  }
  for (const g of grids.values()) {
    g.members.sort((a, b) => powerPriority(a.kind) - powerPriority(b.kind) || (a.id < b.id ? -1 : 1));
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
 * the mesa (heights > 0) and off the map's landing pad and deposits and their 1-cell margin (outpostMap.js
 * reservedRects), the cells the view draws. -> [{ x, y, tier }]
 */
export function surfaceFields(map) {
  const cols = map.width, H = map.heights, R = reservedRects(map);
  const onPad = (x, y) => R.some((p) => x >= p.x - 1 && x < p.x + p.w + 1 && y >= p.y - 1 && y < p.y + p.h + 1);
  return (map.resources || []).filter((r) => ROLE_TIER[r.role] && !(H && H[r.y * cols + r.x] > 0) && !onPad(r.x, r.y))
    .map((r) => ({ x: r.x, y: r.y, tier: ROLE_TIER[r.role] }));
}
/**
 * The surface fields as the battle groups them: connected (8-neighbour) cells of one tier. Each holds its cells' battle
 * stock and regrows at Surface_Respawn_Mult of the battle rate (data/outpost.js surfaceStock). Cached per map.
 * -> [{ id ('<tier>:<x>,<y>' of its first cell), tier, cells: [[x, y]], cap (units), regrow (units / ms) }]
 */
const FIELD_CACHE = new WeakMap();
export function surfaceFieldGroups(map, params = OUTPOST) {
  const key = params.Surface_Respawn_Mult;
  const hit = FIELD_CACHE.get(map);
  if (hit && hit.key === key) return hit.groups;
  const cells = surfaceFields(map).sort((a, b) => a.y - b.y || a.x - b.x);
  const at = new Map(cells.map((c) => [`${c.x},${c.y}`, c])), seen = new Set(), stock = surfaceStock(params), groups = [];
  for (const c of cells) {
    if (seen.has(c)) continue;
    const g = [], stack = [c];
    seen.add(c);
    while (stack.length) {
      const k = stack.pop();
      g.push([k.x, k.y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nb = at.get(`${k.x + dx},${k.y + dy}`);
        if (nb && !seen.has(nb) && nb.tier === c.tier) { seen.add(nb); stack.push(nb); }
      }
    }
    g.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const per = stock[c.tier];
    groups.push(Object.freeze({ id: `${c.tier}:${g[0][0]},${g[0][1]}`, tier: c.tier, cells: g, cap: per.units * g.length, regrow: (per.regrow * g.length) / 1000 }));
  }
  FIELD_CACHE.set(map, { key, groups });
  return groups;
}
/** Each field's stock now: { [fieldId]: units } (a field never touched is full). */
export function fieldStock(o, map, params = OUTPOST) {
  const out = {};
  for (const f of surfaceFieldGroups(map, params)) out[f.id] = Math.min(f.cap, (o.fields || {})[f.id] ?? f.cap);
  return out;
}

/** The finished Resource Bay's pad id, or null. */
export const resourceBayPad = (o) => Object.keys(o.pads).sort().find((id) => o.pads[id].kind === 'resourceBay') || null;

/**
 * Where each harvester works (the view drives them along these): harvesters alternate common, uncommon, common, ...;
 * the k-th harvester of a tier takes the k-th nearest field of that tier to the Resource Bay (the other tier when the
 * map has none), and drives to that field's nearest cell. It stays on its field: once the stock is gone it takes only
 * what regrows (owner 2026-11-07).
 * -> [{ i, tier, fieldId, from: [x, y] (the bay's centre), field: [x, y] (cell), dist (cells), rate (units / ms, the
 * battle rate) }]; [] with no finished bay or no fields. Power is not asked here (see harvestRunning).
 */
export function harvestPlan(o, map, params = OUTPOST) {
  const bay = resourceBayPad(o), n = Math.min(o.harvesters || 0, params.Harvester_Max ?? 4);
  if (!bay || !n) return [];
  const pad = buildingRect(o, map, bay);
  if (!pad) return [];
  const at = centre(pad), groups = surfaceFieldGroups(map, params);
  const byTier = {};
  for (const t of HARVEST_TIERS) {
    byTier[t] = groups.filter((f) => f.tier === t).map((f) => {
      let best = null;
      for (const c of f.cells) { const d = dist(at, cellCentre(c)); if (!best || d < best.d || (d === best.d && (c[0] < best.c[0] || (c[0] === best.c[0] && c[1] < best.c[1])))) best = { d, c }; }
      return { f, d: best.d, c: best.c };
    }).sort((a, b) => a.d - b.d || (a.f.id < b.f.id ? -1 : 1));
  }
  const used = { common: 0, uncommon: 0 }, out = [];
  for (let i = 0; i < n; i++) {
    let tier = HARVEST_TIERS[i % 2];
    if (!byTier[tier].length) tier = HARVEST_TIERS[(i + 1) % 2];
    const list = byTier[tier];
    if (!list.length) break;
    const x = list[used[tier]++ % list.length];
    out.push({ i, tier, fieldId: x.f.id, from: at, field: [...x.c], dist: x.d, rate: harvesterRate(tier, x.d, params) / 1000 });
  }
  return out;
}
/**
 * What the harvesters bring in once their fields are bare (the steady take): per field, the lesser of the harvesters'
 * battle rate and the field's regrowth. -> { total (units / ms), byTier: { common, uncommon }, byField: { [id]: units / ms } }
 */
export function steadyHarvest(o, map, params = OUTPOST) {
  const groups = new Map(surfaceFieldGroups(map, params).map((f) => [f.id, f])), demand = {};
  for (const h of harvestPlan(o, map, params)) demand[h.fieldId] = (demand[h.fieldId] || 0) + h.rate;
  const out = { total: 0, byTier: { common: 0, uncommon: 0 }, byField: {} };
  for (const [id, d] of Object.entries(demand)) {
    const f = groups.get(id), t = Math.min(d, f.regrow);
    out.byField[id] = t; out.byTier[f.tier] += t; out.total += t;
  }
  return out;
}
/**
 * The hopper's size in units: Hopper_Hours of the harvesters' steady take (their fields' regrowth, or less), and never
 * less than the full stock of the fields they work, so a fresh field always fits.
 */
export function hopperCap(o, map, params = OUTPOST) {
  const st = steadyHarvest(o, map, params), groups = new Map(surfaceFieldGroups(map, params).map((f) => [f.id, f]));
  const stock = Object.keys(st.byField).reduce((a, id) => a + groups.get(id).cap, 0);
  return Math.max(st.total * params.Hopper_Hours * HOUR, stock);
}

/**
 * The surface fields and the hopper over dt ms, in closed form (owner 2026-11-07): piecewise linear between the moments
 * a field runs dry, a field is full again, or the hopper fills. On a field, harvesters take their battle rate while it
 * has stock, then only what regrows; with nobody on it (or the hopper full) it regrows to its full stock. Mutates o.
 */
function harvestFields(o, map, params, dt, running, report, now) {
  const groups = surfaceFieldGroups(map, params);
  if (!groups.length) return;
  o.fields = o.fields || {};
  const demand = {};
  for (const h of running) demand[h.fieldId] = (demand[h.fieldId] || 0) + h.rate;
  const cap = hopperCap(o, map, params);
  const live = groups.filter((f) => demand[f.id] || (o.fields[f.id] != null && o.fields[f.id] < f.cap));
  let left = dt, t = now;
  for (let guard = 0; left > 0 && live.length && guard < 10_000; guard++) {
    const space = cap - hopperUnits(o), open = space > 1e-9;
    const rows = live.map((f) => {
      const S = Math.min(f.cap, o.fields[f.id] ?? f.cap), want = open ? demand[f.id] || 0 : 0;
      const take = S > 1e-9 ? want : Math.min(want, f.regrow);
      let dS = f.regrow - take;
      if (S >= f.cap - 1e-9 && dS > 0) dS = 0;
      return { f, S, take, dS };
    });
    const T = rows.reduce((a, r) => a + r.take, 0);
    let step = left;
    for (const r of rows) {
      if (r.dS < 0) step = Math.min(step, r.S / -r.dS);
      else if (r.dS > 0) step = Math.min(step, (r.f.cap - r.S) / r.dS);
    }
    if (T > 0) step = Math.min(step, space / T);
    step = Math.max(0, step);
    for (const r of rows) {
      let S = r.S + r.dS * step;
      if (r.dS < 0 && step >= r.S / -r.dS - 1e-9) S = 0;
      if (r.dS > 0 && step >= (r.f.cap - r.S) / r.dS - 1e-9) S = r.f.cap;
      o.fields[r.f.id] = Math.max(0, Math.min(r.f.cap, S));
      if (r.take > 0) {
        const g = r.take * step;
        o.hopper[r.f.tier] = (o.hopper[r.f.tier] || 0) + g;
        report.harvested[r.f.tier] = (report.harvested[r.f.tier] || 0) + g;
      }
    }
    if (T > 0 && step >= space / T - 1e-9) { report.hopperFull = report.hopperFull ?? t + step; }
    left -= step; t += step;   // a zero step only lands a field on its boundary (clamped above); the next one moves on
  }
  for (const f of groups) if (o.fields[f.id] != null && o.fields[f.id] >= f.cap - 1e-9) delete o.fields[f.id];   // full = absent
}
/**
 * The parts of [a, b] outside a live visit's harvest stretch live = { from, to } (ms): while the player was at the
 * outpost the battle sim's trucks gathered and the fields regrew there (One Battle UX S4 [MM-story_mwc9pzyd_2l]), so the
 * closed form must not count that stretch a second time. → [[from, to], …] (empty pieces left out)
 */
export function outsideLive(live, a, b) {
  if (!live || !(live.to > live.from) || live.to <= a || live.from >= b) return b > a ? [[a, b]] : [];
  const out = [];
  if (live.from > a) out.push([a, live.from]);
  if (live.to < b) out.push([live.to, b]);
  return out;
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
    // every window's draw: whether it is a raid is judged when its minute comes, at the outpost's size then
    for (const r of raidDraws(o.seed, fromW, Math.floor(end / w), params)) {
      if (r.at > o.t && r.at <= end && (o.firstRaidAt == null || r.at > o.firstRaidAt)) raids.push(r);
    }
  }
  const events = [
    ...o.building.filter((b) => b.done > o.t && b.done <= end).map((b) => ({ at: b.done, build: b })),
    ...o.building.filter((b) => b.done <= o.t).map((b) => ({ at: o.t, build: b })),
    ...raids.map((r) => ({ at: r.at, raid: r })),
    ...(o.upgrading && o.upgrading.done <= end ? [{ at: Math.max(o.t, o.upgrading.done), upgraded: true }] : []),
    ...farmBuildEvents(o, o.t, end),
    // a repair drone finishing its work (owner 2026-11-10: drones fly out from the hub) [MM-story_mwb3y511_20]
    ...o.defenses.filter((d) => d.repair && d.repair.done <= end).map((d) => ({ at: Math.max(o.t, d.repair.done), repaired: d.id })),
    // a defense finishing its build, or its dismantling (tower parity) [MM-story_mwb8zdb0_26]
    ...o.defenses.filter((d) => d.building && d.building.done <= end).map((d) => ({ at: Math.max(o.t, d.building.done), defenseBuilt: d.id })),
    ...o.defenses.filter((d) => d.selling && d.selling.done <= end).map((d) => ({ at: Math.max(o.t, d.selling.done), defenseSold: d.id })),
  ].sort((a, b) => a.at - b.at || ((a.build || a.upgraded || a.farmBuilt || a.repaired || a.defenseBuilt || a.defenseSold) ? -1 : 1));

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
    // the harvesters and the surface fields (finite stock, 5 % regrowth), into the hopper — except over a stretch a
    // live visit already ran on the battle sim's own trucks (o.liveHarvest, outpost/liveSim.js fromLiveSim)
    for (const [a, b] of outsideLive(o.liveHarvest, now, until)) harvestFields(o, map, params, b - a, harvestRunning(o, map, params), report, a);
    // the farm's plants, at this stretch's power and water (src/farm/grow.js)
    if (o.farm) growFarm(o, map, now, until, powerGrids(o, map, now).powered, report);
    now = until;
  };
  for (const ev of events) {
    extractTo(ev.at);
    if (ev.build) {
      const b = ev.build;
      o.building = o.building.filter((x) => x !== b && !(x.pad === b.pad && x.done === b.done));
      const prev = o.pads[b.pad] || {};
      o.pads[b.pad] = { ...prev, kind: b.kind, tier: b.tier, ...(b.at && !prev.at ? { at: b.at } : {}),   // a free building keeps its spot
        ...(b.kind === 'rig' ? { deposit: b.deposit ?? prev.deposit, deep: !!prev.deep } : {}) };
      if (b.kind === 'rig') o.storage[b.pad] ||= {};
      report.built.push({ pad: b.pad, kind: b.kind, tier: b.tier, at: b.done });
    } else if (ev.farmBuilt) {
      const b = o.farm.buildings[ev.farmBuilt];
      report.built.push({ farm: ev.farmBuilt, kind: b.kind, tier: b.tier, at: ev.at });
    } else if (ev.defenseBuilt) {
      const d = o.defenses.find((x) => x.id === ev.defenseBuilt);
      if (d && d.building) { delete d.building; report.built.push({ defense: d.id, kind: d.kind, tier: d.tier, at: ev.at }); }
    } else if (ev.defenseSold) {
      o.defenses = o.defenses.filter((x) => x.id !== ev.defenseSold);
    } else if (ev.repaired) {
      const d = o.defenses.find((x) => x.id === ev.repaired);
      if (d && d.repair) {
        delete d.repair;
        d.hp = structureDef(d.kind, d.tier).battle.hp;
        (report.repaired ||= []).push({ defense: d.id, at: ev.at });
      }
    } else if (ev.upgraded) {
      const d = finishDefenseUpgrade(o);
      if (d) report.built.push({ defense: d.id, kind: d.kind, tier: d.tier, at: ev.at });
    } else if (ev.raid.roll != null && !(ev.raid.roll < raidChance(outpostSize(o, ev.at), params))) {
      // this window's draw is no raid at the outpost's size now: the window is settled, quietly
      o.raids.window = ev.raid.window;
    } else {
      // a defense on the Upgrade Bay is off its cell and does not fight
      // a defense on the Upgrade Bay, still being built, or being sold is off duty: it does not fight
      const away = o.upgrading ? o.upgrading.id : null;
      const offDuty = (d) => d.id === away || !!d.building || !!d.selling;
      const fighting = o.defenses.some(offDuty) ? { ...o, defenses: o.defenses.filter((d) => !offDuty(d)) } : o;
      const { roll: _roll, ...raid } = ev.raid;
      const outcome = ctx.raid ? ctx.raid(fighting, { ...raid, powered: powerGrids(o, map).powered }) : { result: 'held', defenses: [] };
      const applied = raidOutcome(o, { ...outcome, at: ev.at }, params);
      Object.assign(o, applied.outpost);
      if (o.farm) {
        // the farm on this map (Farming-Design §10): raiders that crossed growing plots trampled them, and a breach
        // takes Breach_Silo_Loss of the farm's store (held by the caller: the entry carries the share, farmLoss)
        const tr = trample(o, outcome.cells || [], ev.at);
        o.farm = tr.outpost.farm;
        applied.entry.trampled = tr.trampled;
        applied.entry.farmLoss = outcome.result === 'breach' ? FARM.Breach_Silo_Loss : 0;
      }
      report.raids.push(applied.entry);
      if (ev.raid.window != null) o.raids.window = ev.raid.window;
    }
  }
  extractTo(end);
  if (o.liveHarvest && end >= o.liveHarvest.to) delete o.liveHarvest;   // the visit's stretch is behind the clock now
  if (o.online) o.raids.window = Math.max(o.raids.window ?? -1, lastSettledWindow(o.seed, end, params));
  o.t = end;
  report.to = end;
  const L = (o.lifetime ||= newLifetime(report.from));
  for (const [k, u] of Object.entries(report.extracted)) L.extracted[k] = (L.extracted[k] || 0) + u;
  for (const [k, u] of Object.entries(report.harvested)) L.harvested[k] = (L.harvested[k] || 0) + u;
  return { outpost: o, report };
}

/** The last window whose draw is at or before `end`: the window holding `end` counts only once its minute has passed,
 *  so a raid later in that window is still found, and judged at the outpost's size then, by the next advance. */
function lastSettledWindow(seed, end, params) {
  const w = Math.floor(end / windowMs(params));
  return raidDraws(seed, w, w, params).some((r) => r.at > end) ? w - 1 : w;
}

/**
 * Apply a raid outcome: defenses take their new HP; a breach loses Breach_Storage_Loss of every bay's ore (owner Q6)
 * and changes no building. The log keeps the last Replay_Keep raids. → { outpost, entry }
 */
export function raidOutcome(outpost, { result, defenses = [], at, bounty = 0 }, params = OUTPOST) {
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
  // the kills' gold (raid.js outcome.bounty, the battle's grantKillIncome): carried on the entry for the save to bank
  // (outpost/view/session.js) and the away report to show; the outpost model holds no gold
  if (bounty > 0) entry.bounty = bounty;
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
  const L = (o.lifetime ||= newLifetime(o.t));
  L.gold += gold; L.loads += loads.length;
  return { outpost: o, loads, gold, loyalty: { home: far ? -params.Far_Loyalty_Cost * loads.length : 0 } };
}

// ── building, upgrading, repairing (design §6, §6.1) ─────────────────────────────────────────────────────────────
/** The building kinds the build list offers (everything but the granted hub), and the defenses (placed on cells). */
export const PAD_KINDS = Object.freeze(['power', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'habitat']);

// ── the gun cap (owner 2026-11-07, design §6, story O15) ─────────────────────────────────────────────────────────
/** The guns placed (Machine Guns and Cannons, wrecks included: a wreck keeps its crew post). Walls do not count. */
export const gunCount = (o) => o.defenses.filter((d) => GUN_KINDS.includes(d.kind)).length;
/** The finished Habitat's tier (0 = none). Under construction it does not count yet. */
export const habitatTier = (o) => Math.max(0, ...Object.values(o.pads).filter((b) => b.kind === 'habitat').map((b) => b.tier));
/** How many guns the outpost crews: Gun_Cap from the hub, + Habitat_Guns_Per_Tier for each Habitat tier. */
export function gunCap(o, params = OUTPOST) {
  return gunCapFor(habitatTier(o), params);
}
/** The gun cap for a finished Habitat of tier h (0 = none) — the one formula the save and the live sim both use. */
export function gunCapFor(h, params = OUTPOST) {
  return (params.Gun_Cap ?? 4) + (params.Habitat_Guns_Per_Tier ?? 4) * h;
}
/** Why one more gun cannot be placed now, or null. */
export function gunRefusal(o, params = OUTPOST) {
  return gunRefusalFor(gunCount(o), habitatTier(o), params);
}
/**
 * Why one more gun cannot be placed with n guns standing and a finished Habitat of tier h, or null — shared by the
 * save's rules above and the live sim's placement rule (outpost/placementRules.js) [MM-task_mwcdvixz_2r].
 */
export function gunRefusalFor(n, h, params = OUTPOST) {
  const cap = gunCapFor(h, params);
  if (n < cap) return null;
  if (!h) return `the hub crews ${cap} guns: build a Habitat for more`;
  if (structureDef('habitat', h + 1)) return `the Habitat crews ${cap} guns: upgrade it to Habitat ${'I'.repeat(h + 1)} for more`;
  return `the outpost crews at most ${cap} guns`;
}
const busy = (o, pad) => !!o.pads[pad] || o.building.some((b) => b.pad === pad);

/**
 * Build something new, or a defense on a free cell, with the player's gold (owner 2026-11-07: the contract grants only
 * the hub). what: { kind, at: { x, y }, pad? } with kind one of PAD_KINDS ('harvesterBay' is read as 'resourceBay'):
 * the building's top-left cell (its footprint from the data) and optionally its id (default the next free 'f<n>'). An
 * old caller's { pad } alone (the tests and review pages): a reference-kit id (p1 / r1 / s1) stands where the kit puts
 * it (siting.js referenceKit), any other legacy pad id where that pad was (legacyPads.js). Or { cell, kind } with kind one of
 * DEFENSE_KINDS ('mg', 'cannon', 'wall'). The game places through the battle sim (liveSim.js); this is the save-side
 * rule S3 retires. A rig must stand on a deposit (its top-left on the deposit's).
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
    const inR = (p) => what.cell[0] >= p.x && what.cell[0] < p.x + p.w && what.cell[1] >= p.y && what.cell[1] < p.y + p.h;
    const ids = [...new Set([...Object.keys(o.pads), ...o.building.map((b) => b.pad)])];
    if ((map.hub && inR(map.hub)) || ids.some((id) => { const r = buildingRect(o, map, id); return r && inR(r); })) return { error: 'defenses go off the buildings' };
    const n = Math.max(0, ...o.defenses.map((d) => +d.id.slice(1) || 0)) + 1;
    const nd = { id: `d${n}`, kind, tier: 1, cell: [...what.cell], hp: def.battle.hp };
    // owner 2026-11-10 (tower parity): a defense is built over its buildSec, as a battle tower is; it does not fight a
    // raid until it is done (advance: d.building) [MM-story_mwb8zdb0_26]. A bare call (no clock) builds at once.
    if (ctx.now != null && def.buildSec > 0) nd.building = { since: ctx.now, done: ctx.now + def.buildSec * 1000 };
    o.defenses.push(nd);
    return { outpost: o, cost: def.cost };
  }
  const taken = new Set([...Object.keys(o.pads), ...o.building.map((b) => b.pad)]);
  const id = what.pad || `f${1 + Math.max(0, ...[...taken].filter((x) => /^f\d+$/.test(x)).map((x) => +x.slice(1)))}`;
  if (busy(o, id)) return { error: `${id} is taken` };
  const fp = getStructureDef(outpostStructId(kind)).footprint || { w: 2, h: 2 };
  const kitAt = what.at ? null : ((referenceKit(map).pads[id] || {}).at || null);
  const legacy = what.at ? null : kitAt || legacyPadRect(map, id);
  const at = what.at ? { x: what.at.x, y: what.at.y, w: fp.w, h: fp.h } : legacy ? { x: legacy.x, y: legacy.y, w: fp.w, h: fp.h } : null;
  if (!at) return { error: `no spot for ${id}: give its cell (at)` };
  let deposit;
  if (kind === 'rig') {
    deposit = depositAt(map, at);
    if (!deposit) return { error: 'a rig goes on a deposit' };
    if (!(ctx.unlockedTiers || ['common']).includes(deposit)) return { error: `the ${deposit} ore is not unlocked` };
  }
  o.building.push({ pad: id, kind, tier: 1, done: now + def.buildSec * 1000, at, ...(deposit ? { deposit } : {}) });
  return { outpost: o, cost: def.cost, id };
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
  if (d.building) return 'it is still being built';
  if (d.selling) return 'it is being sold';
  if (!Object.values(o.pads).some((b) => b.kind === 'upgradeBay')) return 'build the Upgrade Bay first';
  if (o.upgrading) return o.upgrading.id === id ? `the ${DEF_NAME[d.kind] || d.kind} is already on the Upgrade Bay` : `the Upgrade Bay is busy with the ${DEF_NAME[o.upgrading.kind] || o.upgrading.kind}`;
  if (ctx.map && !upgradeBayReady(o, ctx.map)) return 'the Upgrade Bay has no power';
  const u = next.unlock || '';
  if (u === 'techtree+upgradeBay' && !inSet(ctx.techOwned, `${d.kind}${next.tier}`)) return `needs ${DEF_NAME[d.kind]} T${next.tier} in the Tech Tree`;
  if (u.startsWith('tech:') && !inSet(ctx.unlocks, u.slice(5))) return `needs ${TECH_NAME[u.slice(5)] || u.slice(5).replace(/_/g, ' ')} in the Tech Tree`;
  if (next.cost > (ctx.gold ?? Infinity)) return `costs ${next.cost} gold`;
  return null;
}
/**
 * Send a defense to the Upgrade Bay for its next tier (owner 2026-11-07: "the upgrade pad in the outpost should always
 * show the unit being upgraded"; upgrades are timed, as buildings are). Gold is paid now; the defense leaves its cell
 * for the bay's pad for the next tier's build time (it does not fight a raid meanwhile), then returns at the new tier.
 * Its HP rises by the tier's extra HP; wear it already had stays. One defense on the bay at a time.
 * -> { outpost, cost, done } or { error }
 */
export function upgradeDefense(outpost, id, ctx = {}) {
  const why = defenseUpgradeRefusal(outpost, id, ctx);
  if (why) return { error: why };
  const o = clone(outpost), d = o.defenses.find((x) => x.id === id);
  const next = structureDef(d.kind, d.tier + 1);
  const now = ctx.now ?? o.t;
  o.upgrading = { id, kind: d.kind, tier: d.tier + 1, done: now + next.buildSec * 1000, since: now };
  return { outpost: o, cost: next.cost, done: o.upgrading.done };
}
/** Finish the defense on the Upgrade Bay (advance calls it at its time): the new tier, back on its cell. Mutates o. */
function finishDefenseUpgrade(o) {
  const u = o.upgrading, d = u && o.defenses.find((x) => x.id === u.id);
  o.upgrading = null;
  if (!d) return null;
  const was = structureDef(d.kind, d.tier), next = structureDef(d.kind, u.tier);
  d.tier = u.tier;
  d.hp = Math.min(next.battle.hp, d.hp + (next.battle.hp - was.battle.hp));
  o.upgradeShow = { kind: d.kind, tier: d.tier, id: d.id };   // the bay keeps showing the last unit it upgraded
  return d;
}
/** The defense the Upgrade Bay's pad shows: the one on it now, else the last it upgraded. -> { kind, tier, id, working, done } or null */
export function upgradeBayShows(o) {
  if (o.upgrading) return { ...o.upgrading, working: true };
  return o.upgradeShow ? { ...o.upgradeShow, working: false } : null;
}

// ── selling a structure (the battle's SELL, owner 2026-11-07: "repurpose that UX") ──────────────────────────────
/** Gold invested in a kind up to a tier (every tier's cost, as the battle counts an upgraded tower). */
const investedIn = (kind, tier) => { let g = 0; for (let t = 1; t <= tier; t++) g += (structureDef(kind, t) || {}).cost || 0; return g; };
/**
 * What selling a building or defense pays back, or why it cannot be sold. target: { pad } or { defense: id }.
 * The battle's rule: sellRefundFrac (50 %) of everything invested in it. The hub is the outpost and is never sold; a
 * building under construction, a unit on the Upgrade Bay, the bay while it works, and a Mining Station with ore in its
 * bay (sell the ore first) are refused. -> { refund } or { error }
 */
export function sellStructureQuote(o, target) {
  const frac = Number.isFinite(ASSUMPTIONS.sellRefundFrac) ? ASSUMPTIONS.sellRefundFrac : 0.5;
  if (target && target.defense != null) {
    const d = o.defenses.find((x) => x.id === target.defense);
    if (!d) return { error: `no defense ${target.defense}` };
    if (o.upgrading && o.upgrading.id === d.id) return { error: 'it is on the Upgrade Bay' };
    if (d.selling) return { error: 'it is being sold' };
    return { refund: Math.floor(investedIn(d.kind, d.tier) * frac) };
  }
  const id = target && target.pad, b = id && o.pads[id];
  if (!b) return { error: `nothing on ${id}` };
  if (b.kind === 'hub') return { error: 'the hub is the outpost' };
  if (o.building.some((x) => x.pad === id)) return { error: 'it is still building' };
  if (b.kind === 'upgradeBay' && o.upgrading) return { error: 'the Upgrade Bay is working' };
  if (b.kind === 'rig' && bayUnits(o, id) >= 1) return { error: 'sell the ore in its bay first' };
  return { refund: Math.floor(investedIn(b.kind, b.tier) * frac) };
}
/** How long a defense takes to sell: the battle tower's sellTime (tables.js), in ms. */
export function defenseSellMs(kind) {
  const id = kind === 'mg' ? 'STR-MG' : kind === 'cannon' ? 'STR-Cannon' : 'STR-Wall';
  try { return Math.round(1000 * (getStructureDef(id).sellTime || 0)); } catch (e) { return 0; }
}
/**
 * Sell a building or defense. The refund is paid now. A defense sold with a clock (ctx.now) is dismantled as a battle
 * tower is: it stays on its cell for its sellTime (d.selling, the battle's grey Selling look), does not fight, and
 * advance() removes it [MM-story_mwb8zdb0_26]. Without a clock, or a building, it goes at once.
 * -> { outpost, refund } or { error }
 */
export function sellStructure(outpost, target, ctx = {}) {
  const q = sellStructureQuote(outpost, target);
  if (q.error) return q;
  const o = clone(outpost);
  const sd = target.defense != null ? o.defenses.find((d) => d.id === target.defense) : null;
  const ms = sd ? defenseSellMs(sd.kind) : 0;
  if (sd && ctx.now != null && ms > 0) { sd.selling = { since: ctx.now, done: ctx.now + ms }; delete sd.repair; }
  else if (target.defense != null) o.defenses = o.defenses.filter((d) => d.id !== target.defense);
  else { delete o.pads[target.pad]; delete o.storage[target.pad]; }
  return { outpost: o, refund: q.refund };
}

/** What repairing a defense to full HP costs: Value × Repair_Share_Per_HP × the share of HP missing (design §6.1). */
export function repairCost(o, id, params = OUTPOST) {
  const d = o.defenses.find((x) => x.id === id);
  if (!d) return null;
  if (d.repair) return 0;   // a drone is already on its way: nothing more to pay
  const def = structureDef(d.kind, d.tier);
  return Math.ceil(def.value * params.Repair_Share_Per_HP * (1 - d.hp / def.battle.hp));
}
/**
 * Where a repair drone starts: the centre of the outpost's hub pad (the base), in cells. null when the map has no hub.
 */
export function droneHome(o, map) {
  const id = Object.keys(o.pads || {}).sort().find((p) => o.pads[p].kind === 'hub');
  const pad = id && map ? buildingRect(o, map, id) : null;
  return pad ? [pad.x + pad.w / 2, pad.y + pad.h / 2] : null;
}
/** A repair drone's flight from the hub to a defense, in ms (Repair_Drone_Speed cells / s). */
export function droneFlightMs(o, map, d, params = OUTPOST) {
  const home = droneHome(o, map);
  if (!home) return 0;
  const dist = Math.hypot(d.cell[0] + 0.5 - home[0], d.cell[1] + 0.5 - home[1]);
  return Math.round(1000 * dist / Math.max(0.1, params.Repair_Drone_Speed ?? 2));
}

/**
 * Repair a defense to full HP. Only this restores HP (design §5.2). Owner 2026-11-10: "the repair drone need to travel
 * from the base and repair defenses" [MM-story_mwb3y511_20]: the gold is paid now and a drone leaves the hub; it flies
 * to the defense (droneFlightMs), works Repair_Work_Sec, and the defense is whole when it is done (advance() restores
 * the HP at d.repair.done, on the outpost's clock, so it is deterministic and finishes while the player is away). A
 * defense with a drone already on its way cannot be ordered again. Without ctx.now and ctx.map (a bare model call) the
 * repair is instant, as before. → { outpost, cost, drone? } or { error }
 */
export function repair(outpost, id, ctx = {}) {
  const params = P(ctx);
  const d0 = outpost.defenses.find((x) => x.id === id);
  if (d0 && d0.repair) return { error: 'a repair drone is already on its way' };
  if (d0 && d0.building) return { error: 'it is still being built' };
  if (d0 && d0.selling) return { error: 'it is being sold' };
  const cost = repairCost(outpost, id, params);
  if (cost == null) return { error: `no defense ${id}` };
  if (cost > (ctx.gold ?? Infinity)) return { error: `costs ${cost} gold` };
  const o = clone(outpost);
  const d = o.defenses.find((x) => x.id === id);
  if (ctx.now != null && ctx.map && droneHome(o, ctx.map)) {
    const at = ctx.now, arrive = at + droneFlightMs(o, ctx.map, d, params);
    d.repair = { at, arrive, done: arrive + Math.round(1000 * (params.Repair_Work_Sec ?? 4)) };
    return { outpost: o, cost, drone: { ...d.repair } };
  }
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
 * How many harvesters the Resource Bay holds (owner 2026-11-09: 1 to start, 2 at most): Harvester_Cap, + 1 each for the tech
 * tree's Dock 3 and Dock 4 at an outpost with a finished Upgrade Bay (tech-tree upgrades reach an outpost through its
 * Upgrade Bay, design §6), never above Harvester_Max. ctx: { techOwned?, params? }.
 */
export function harvesterCap(o, ctx = {}) {
  const params = P(ctx), h = harvesterDef();
  const base = params.Harvester_Cap ?? (h && h.cap) ?? 1, max = params.Harvester_Max ?? (h && h.max) ?? 2;
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
 *   - storage_full: a rig whose bay is full (mining stops), and the Storage Tower when any rig's bay is full;
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
    // owner 2026-11-09: "When storage is full mining stops" — the miner stops and shows storage full, and so does the
    // Storage Tower, as soon as any rig's bay in it is full
    else if (rigs.some(fullRig)) add(id, 'storage_full');
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
  const r = outpostRaids(o, fromW, Math.floor((from + horizonMs) / w), params).find((x) => x.at > from);
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
