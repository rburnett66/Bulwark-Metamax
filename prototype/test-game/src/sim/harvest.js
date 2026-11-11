// harvest.js — the harvester + resource FIELD collection loop (Maps GDD §5/§8, story 3 of the epic).
//
// The harvester CAMPS at the base in an open cell. Clicking any cell of a resource FIELD (a connected
// cluster of resource cells — mapgen grows primaries as 2-3 cell patches; premium is usually a single
// rich cell) assigns the whole field as its job: fill up → haul home → deposit (gold visibly lands) →
// return to the field's next unworked cell → repeat. When the field is STRIPPED the harvester
// auto-continues on the nearest revealed field of the SAME resource (type + crystal colour, owner
// 2026-07-17); only when no same-resource field exists does it deliver and rest at the dock.
//
// The harvester is driven HERE (marchAlong on its own nav path, like repair troops) — stepMovement,
// separation, and the contact clamp all skip it, so the economy loop never tangles with the crowd sim.
import { MAPDATA } from '../../content/maps/mapdata.js';
import { HARVESTER_UNLOAD_TIME } from '../data/tables.js';
import { harvesterStats, nodeHarvestSec } from './harvestStats.js';
import { createUnit } from './entities.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';
import { emitEvent } from './core.js';

const HARVESTER_UNIT = 'GND-Trucks';   // the truck IS the harvester (own stats overridden below)

// Baseline harvester = Factions sheet row 1 (the tuning reference) at the state's upgrade level: harvestStats.js, the
// one source the outpost's away closed form reads too (data/outpost.js harvestRates).

// The base keeps 4 harvester DOCKS just outside its 3x3 footprint — top, bottom, left, right
// (owner spec). Dock order is the build order: a new harvester takes the first open one. Cap = 4.
export const HARVESTER_CAP = 4;
// PURCHASE LADDER (owner 2026-07-16): 1st free (given at wave start), then 500 / 750 / 1000.
// Index = harvester count you ALREADY have when buying the next one.
export const HARVESTER_PRICE = [0, 500, 750, 1000];
export function harvesterPrice(state) {
  const have = aliveHarvesters(state).length;
  return have >= HARVESTER_CAP ? null : (HARVESTER_PRICE[have] || 0);
}
export function dockCells(map) {
  const cx = map.base.x, cy = map.base.y;
  const water = new Set((map.waterCells || []).map((c) => `${c.x},${c.y}`));
  const raw = [{ x: cx, y: cy - 2 }, { x: cx, y: cy + 2 }, { x: cx - 2, y: cy }, { x: cx + 2, y: cy }];
  return raw.filter((q) => q.x >= 0 && q.y >= 0 && q.x < map.cols && q.y < map.rows && !water.has(`${q.x},${q.y}`));
}
// first dock no live harvester calls home
function firstOpenDock(state) {
  const taken = new Set();
  for (const id of state.harvesterIds || []) {
    const u = state.units.get(id);
    if (u && u.hp > 0 && u.homePos) taken.add(`${u.homePos.x},${u.homePos.y}`);
  }
  for (const d of dockCells(state.map)) if (!taken.has(`${d.x},${d.y}`)) return d;
  return dockCells(state.map)[0] || { x: state.map.base.x, y: state.map.base.y + 2 };
}

/** Spawn one harvester at the FIRST OPEN DOCK (positions 1-4 around the base). Used at match
 *  start and by a completed Harvestor bay. Returns null at the fleet cap. home (optional): the cell
 *  it docks and unloads at instead of a base dock (an outpost's Resource Bay, outpost/liveSim.js). */
export function spawnHarvester(state, home = null) {
  if (aliveHarvesters(state).length >= HARVESTER_CAP) return null;
  const pos = home || firstOpenDock(state);
  const s = harvesterStats(state);
  const u = createUnit(state, HARVESTER_UNIT, 1, { x: pos.x, y: pos.y }, 'ground', 'defender');
  if (!state.units.has(u.id)) state.units.set(u.id, u);
  u.isHarvester = true;
  u.artKey = 'SYS-Harvester';   // author its look in the State Bench under faction "System"
  u.state = 'harvestIdle';
  u.dps = 0; u.targetsBase = false; u.targetId = null;
  u.hp = s.hp; u.maxHp = s.hp; u.speed = s.speed;
  u.cargo = 0; u.cargoValue = 0; u.cargoMix = {}; u.capacity = s.capacity; u.yieldMult = s.yieldMult;
  u.fieldId = null;        // the assigned FIELD (whole connected patch)
  u.harvestNodeId = null;  // the specific cell being worked right now
  u.homePos = { x: pos.x, y: pos.y };
  state.harvesterIds.push(u.id);
  state.harvesterId = state.harvesterIds[0];   // legacy single-id alias (first of the fleet)
  return u;
}

/** Create runtime node state + the player's first harvester. Called by createSim on campaign maps. */
export function initHarvest(state, map) {
  if (!map || !map.resources || !map.resources.length) return;
  // CRYSTAL COLOR economy (owner spec): blue + yellow(gold) crystals pay GOLD; red + green are the
  // QUEST crystals — tracked in the header as objectives, but their haul ALSO pays gold.
  //   role primary -> blue, premium -> yellow, quest -> red or green (split by id hash)
  const hash8 = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };
  // Clear crops in the base's DOCK RING (owner: 'remove crops within 2 cells of the base to
  // avoid confusion') — 2 cells from base CENTRE covers the 3x3 base + its 4 docks, where a crop
  // under a harvester made taps ambiguous. Measured from centre so the wave-1 economy just
  // beyond the ring survives (small maps seed their opening right next to the base).
  const _bc = (state.base && state.base.pos) || { x: -999, y: -999 };
  const _gapR = (map && map.baseGap) || 2;   // forge maps carry the authored base gap (story-mrmwo8dx6ke)
  const _nearBase = (x, y) => Math.abs(x - _bc.x) <= _gapR && Math.abs(y - _bc.y) <= _gapR;
  state.resourceNodes = map.resources.filter((r) => !_nearBase(r.x, r.y)).map((r) => resourceNode(r,
    r.role === 'primary' ? 'blue' : r.role === 'premium' ? 'yellow' : (hash8(r.id) % 2 ? 'red' : 'green')));
  // FIELD IDENTITY IS CONNECTIVITY (owner spec: "all connected resource cells"): when the generator
  // drops separate clusters that happen to ABUT, they read as one big field on the board — so they
  // ARE one field. Re-label by 8-neighbour flood fill over same-role cells; one harvest order works
  // the whole contiguous patch. Deterministic: nodes visited in array order.
  {
    const byCell = new Map(state.resourceNodes.map((n) => [`${n.x},${n.y}`, n]));
    const seen = new Set();
    let fid = 0;
    for (const n of state.resourceNodes) {
      if (seen.has(n.id)) continue;
      const label = `fld-${++fid}`;
      const stack = [n];
      seen.add(n.id);
      while (stack.length) {
        const cur = stack.pop();
        cur.fieldId = label;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nb = byCell.get(`${cur.x + dx},${cur.y + dy}`);
            if (nb && !seen.has(nb.id) && nb.role === n.role) { seen.add(nb.id); stack.push(nb); }
          }
        }
      }
    }
  }
  state.mapScore = { goldFromPrimary: 0, goldFromPremium: 0, questUnits: 0, questRed: 0, questGreen: 0 };
  // HARVEST ECONOMY (owner, 2026-07-13): on resource maps the harvester IS the faucet — start with
  // 900 gold and turn the passive gold timer OFF. Every coin after the opening build is hauled.
  if (state.economy) {
    state.economy.money = 900;
    state.economy.totalEarned = 900;
    state.economy.incomePerSec = 0;
  }
  state.harvesterIds = [];
  spawnHarvester(state);   // the starting harvester docks at position 1
}

/**
 * One runtime resource node (a cell of a field) from a map resource { id, fieldId?, type, role, wave, x, y, color?,
 * units, remaining?, valuePerUnit?, respawns?, regrow? }. color: the colour when the resource names none. regrow
 * (units / s, optional): the node's share of its FIELD's continuous regrowth (stepHarvest) — an outpost surface field
 * regrows this way (data/outpost.js surfaceStock); battle nodes leave it out and respawn whole (respawns).
 */
export function resourceNode(r, color = 'blue') {
  const n = {
    id: r.id, fieldId: r.fieldId || r.id, type: r.type, role: r.role, wave: r.wave, x: r.x, y: r.y,
    color: r.color || color,
    units: r.units, remaining: r.remaining ?? r.units,
    valuePerUnit: r.valuePerUnit || questGoldValue(r),   // quest nodes now pay gold too
    respawns: !!r.respawns, respawnAt: null,
    harvestSec: nodeHarvestSec(r),
  };
  if (r.regrow > 0) n.regrow = r.regrow;
  return n;
}

/** Alive harvesters, pruning the dead from the roster (deterministic — insertion order kept). */
export function aliveHarvesters(state) {
  if (!state.harvesterIds) return [];
  const out = [];
  state.harvesterIds = state.harvesterIds.filter((id) => {
    const u = state.units.get(id);
    if (u && u.hp > 0) { out.push(u); return true; }
    return false;
  });
  state.harvesterId = state.harvesterIds[0] ?? null;
  return out;
}

// quest nodes pay their type's Primary-tier gold value (they used to pay zero)
function questGoldValue(r) {
  const def = MAPDATA.resources.find((d) => d.Resource === r.type && d.Tier === 'Primary');
  return (def && def.Value_Per_Unit) || 4;
}

function nodeRevealed(state, node) {
  // RING SEEDING (owner, 2026-07-15): resources arrive WITH their wave's ring — even in open play.
  // Harvested state carries between waves; fresh fields (and the ring's premium) seed deeper into
  // the map every wave, so the player must PUSH OUT to keep the economy growing. Build placement
  // stays open-play; only the harvest economy is ring-gated.
  const wv = Math.max(1, Math.min((state.waves && state.waves.current) || 1, 8));
  return node.wave <= wv;
}

function fieldCells(state, fieldId) {
  return state.resourceNodes.filter((n) => n.fieldId === fieldId);
}
// NODE RESERVATION (story-mrmwiikd60b): a cell being worked or driven to by one truck is off-limits
// to the others — no two harvesters ever collect on the same location. Reservations are implicit:
// the set of every OTHER live truck's current harvestNodeId while it's en route or pulling.
function reservedNodes(state, exceptUnit) {
  const taken = new Set();
  for (const id of state.harvesterIds || []) {
    if (exceptUnit && id === exceptUnit.id) continue;
    const h = state.units.get(id);
    if (h && h.hp > 0 && h.harvestNodeId && (h.state === 'harvestGo' || h.state === 'harvestPull')) taken.add(h.harvestNodeId);
  }
  return taken;
}
// FIELD LOCK (outpost harvesters, owner 2026-11-07: "it stays on its field: once the stock is gone it takes only what
// regrows"): a truck with u.fieldLock never leaves its assigned field — no auto-continue, no idle gather elsewhere — and
// only drives out for a cell holding a whole unit (a deposit credits whole units), so on a bare field it waits at its
// dock while the field regrows instead of shuttling slivers. Unlocked (battle) trucks are unchanged.
const worthPulling = (u, n) => n.remaining > (u.fieldLock ? 1 - 1e-9 : 0);
// HOLD (outpost visits, owner 2026-11-11): a truck stays at its dock when it is parked (u.parked: its Resource Bay has no
// power — outpost/liveSim.js syncHarvestPower) or when the board's store is full. state.harvestRoom (units, optional) is
// the room left where loads land (the outpost's hopper); what trucks already carry counts against it, so a full hopper
// stops the harvest exactly like the away closed form and nothing overflows. Battle boards set neither: no hold.
function roomLeft(state) {
  if (state.harvestRoom == null) return Infinity;
  let carried = 0;
  for (const id of state.harvesterIds || []) { const h = state.units.get(id); if (h && h.hp > 0) carried += h.cargo || 0; }
  return state.harvestRoom - carried;
}
const held = (state, u) => !!u.parked || roomLeft(state) < 1 - 1e-9;
// nearest field cell with anything left to pull, skipping cells another truck has claimed
// (deterministic: distance, then id)
function nextFieldTarget(state, u) {
  const taken = reservedNodes(state, u);
  const live = fieldCells(state, u.fieldId).filter((n) => worthPulling(u, n) && nodeRevealed(state, n) && !taken.has(n.id));
  if (!live.length) return null;
  live.sort((a, b) =>
    (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  return live[0];
}
// IDLE AUTO-GATHER (owner 2026-07-16): an idle harvester finds the CLOSEST available resource —
// any type, any field — revealed, non-empty, unreserved. Trucks only rest when the map is bare.
function nearestFreeNode(state, u) {
  if (u.fieldLock) return u.fieldId ? nextFieldTarget(state, u) : null;   // a locked truck gathers only its own field
  const taken = reservedNodes(state, u);
  const live = (state.resourceNodes || []).filter((n) => n.remaining > 0 && nodeRevealed(state, n) && !taken.has(n.id));
  if (!live.length) return null;
  live.sort((a, b) =>
    (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  return live[0];
}
// AUTO-CONTINUE (owner 2026-07-17): when the assigned field is stripped, the harvester finds the
// NEAREST revealed field carrying the SAME resource (type + crystal colour) and keeps working.
// Deterministic: distance, then id. Returns a node in the new field, or null when none exist.
function nextSameResourceField(state, u) {
  if (!u.resType || u.fieldLock) return null;
  const taken = reservedNodes(state, u);
  const live = (state.resourceNodes || []).filter((n) =>
    n.fieldId !== u.fieldId && n.remaining > 0 && nodeRevealed(state, n) && !taken.has(n.id) &&
    n.type === u.resType && n.color === u.resColor);
  if (!live.length) return null;
  live.sort((a, b) =>
    (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  return live[0];
}

/** Command: put a harvester on a FIELD. {type:'harvest', nodeId, harvesterId?} — any cell of the
 *  field works. harvesterId (click the harvester, then the field) picks the exact truck; without
 *  it the nearest idle harvester takes the job (nearest busy one retasks as a fallback). */
export function cmdHarvest(state, cmd) {
  const fleet = aliveHarvesters(state);
  if (!fleet.length) return { ok: false, reason: 'no harvester — build a Harvestor' };
  const node = (state.resourceNodes || []).find((n) => n.id === cmd.nodeId);
  if (!node) return { ok: false, reason: 'no such node' };
  if (!nodeRevealed(state, node)) return { ok: false, reason: 'not revealed yet' };
  const live = fieldCells(state, node.fieldId).some((n) => n.remaining > 0);
  if (!live) return { ok: false, reason: 'field exhausted' };
  // FIELD-LOCKED trucks take no field orders (owner 2026-11-11: outpost harvesters stay on their fields)
  const LOCKED = 'outpost harvesters stay on their own fields';
  let u = null;
  if (cmd.harvesterId != null) {
    u = fleet.find((h) => h.id === cmd.harvesterId) || null;
    if (!u) return { ok: false, reason: 'that harvester is gone' };
    if (u.fieldLock) return { ok: false, reason: LOCKED };
  } else {
    const free = fleet.filter((h) => !h.fieldLock);
    if (!free.length) return { ok: false, reason: LOCKED };
    const byDist = (a, b) => (Math.hypot(a.pos.x - node.x, a.pos.y - node.y) - Math.hypot(b.pos.x - node.x, b.pos.y - node.y)) || (a.id - b.id);
    const idle = free.filter((h) => !h.fieldId && h.state === 'harvestIdle').sort(byDist);
    u = idle[0] || free.slice().sort(byDist)[0];
  }
  u.fieldId = node.fieldId;
  if (u.state === 'harvestUnload') {
    // UNLOADING trucks finish the 3 s unload first (the load is already coming off) — the new
    // field is remembered and the truck heads there the moment the deposit lands.
    u.harvestNodeId = null;
  } else {
    // route to the clicked cell unless another truck already claimed it — then the nearest free cell
    const target = (node.remaining > 0 && !reservedNodes(state, u).has(node.id)) ? node : nextFieldTarget(state, u);
    if (target) routeTo(state, u, target);
    else u.state = 'harvestIdle';
  }
  emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: node.id, fieldId: node.fieldId, unitId: u.id, pos: { x: node.x, y: node.y } });
  return { ok: true, reason: '' };
}

function liveStructs(state) {
  return [...state.structures.values()].filter((s) => s.hp > 0 && s.lifecycle !== 'Destroyed');
}
function baseCells(state) {
  return state.base ? (state.base.cells || [state.base.pos]) : [];
}
function routeTo(state, u, target) {
  const nav = buildNavGrid(state.map, liveStructs(state), baseCells(state));
  const from = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) };
  u.path = findWalkerPath(nav, from, { x: target.x, y: target.y }) || [{ x: target.x, y: target.y }];
  u.pathIdx = 0;
  u.harvestNodeId = target.id;
  u.resType = target.type; u.resColor = target.color;   // remember the resource — auto-continue matches it
  u.state = 'harvestGo';
}
function routeHome(state, u) {
  const nav = buildNavGrid(state.map, liveStructs(state), baseCells(state));
  const from = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) };
  u.path = findWalkerPath(nav, from, u.homePos) || [u.homePos];
  u.pathIdx = 0;
  u.state = 'harvestReturn';
}

// same simple marcher the repair troops use — the harvester ignores the crowd on purpose
function marchAlong(unit, dt) {
  if (!unit.path || unit.path.length === 0) return true;
  if (unit.pathIdx == null) unit.pathIdx = 0;
  let remaining = (unit.speed || 1.5) * dt;
  while (remaining > 0 && unit.pathIdx < unit.path.length) {
    const wp = unit.path[unit.pathIdx];
    const dx = wp.x - unit.pos.x, dy = wp.y - unit.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= remaining || d < 1e-9) { unit.pos.x = wp.x; unit.pos.y = wp.y; unit.pathIdx++; remaining -= d; }
    else { unit.pos.x += (dx / d) * remaining; unit.pos.y += (dy / d) * remaining; remaining = 0; }
  }
  return unit.pathIdx >= unit.path.length;
}

/** BUY a harvester at the BASE (owner: 'select base to purchase'). Ladder-priced, cap 4.
 *  Returns {ok, reason, cost}. */
export function cmdBuyHarvester(state) {
  // a board whose fleet is bought elsewhere (an outpost visit: the Resource Bay's harvesters, outpost/liveSim.js) names why
  if (state.harvesterBuyRefusal) return { ok: false, reason: state.harvesterBuyRefusal };
  const price = harvesterPrice(state);
  if (price === null) return { ok: false, reason: 'max harvesters' };
  const eco = state.economy;
  if (!eco || (eco.money || 0) < price) return { ok: false, reason: 'need ' + price + 'g' };
  eco.money -= price; eco.totalSpent = (eco.totalSpent || 0) + price; state.goldSpent = (state.goldSpent || 0) + price;
  const u = spawnHarvester(state);
  if (!u) { eco.money += price; return { ok: false, reason: 'no open dock' }; }
  emitEvent(state, { type: 'harvesterBought', tick: state.tick, unitId: u.id, cost: price, pos: { x: u.pos.x, y: u.pos.y } });
  return { ok: true, reason: '', cost: price };
}

/** Per-wave transition (the free fleet above). OWNER RULE CHANGE (epic-mrmwh12kq3 / story-mrmwpzcl6wq, 2026-07-18):
 *  harvesters PERSIST between waves — no retirement, no re-dock, no cargo wipe. Trucks keep their
 *  field assignments and keep working straight through the interlude. Only a fully wiped fleet
 *  gets the free starter (the economy must never dead-end); the healed base rule is unchanged. */
// FREE FLEET PER WAVE (owner 2026-11-07: "have 1 wave 1, have 2 wave 2, have 3 wave 3, then minimum 3 for the rest of
// the waves"): each wave opens with at least this many harvesters; the game tops the fleet up for free (bought ones
// count, and the docks still cap it at HARVESTER_CAP).
export const FREE_FLEET_BY_WAVE = Object.freeze([1, 2, 3]);
export const freeFleetFor = (wave) => FREE_FLEET_BY_WAVE[Math.max(1, wave | 0) - 1] ?? FREE_FLEET_BY_WAVE[FREE_FLEET_BY_WAVE.length - 1];
// WAVE QUOTAS (owner 2026-11-07: "a quota for common and a ... quota for uncommon"; the uncommon/premium "all fields
// cleared" star is gone): each wave asks for an amount of common (blue) and uncommon (yellow) that the wave's free
// fleet can gather inside its time limit. The amount is sized from the nearest revealed field of each tier: one truck's
// round trip (drive out, fill, drive home, unload) gives its rate; the fleet works QUOTA_WORK_SHARE of the par time,
// QUOTA_SPLIT of it on each tier. Shown before the wave and judged at its clear.
export const QUOTA_WORK_SHARE = 0.5;   // waves often clear before par: size the ask to half of it
export const QUOTA_SPLIT = Object.freeze({ common: 2 / 3, uncommon: 1 / 3 });
// the first wave asks only for the easiest resource (owner 2026-11-08: "the star task on the first wave should be the
// easiest resource to gather not uncommon or rare. On Verdance the requirement is Amberwood which isn't even visible on
// the first map"): uncommon is asked from this wave on; before it the fleet's whole share goes to common
export const UNCOMMON_QUOTA_FROM_WAVE = 2;
const TIER_OF_COLOR = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };
export const tierOfNode = (n) => TIER_OF_COLOR[n.color] || (n.role === 'primary' ? 'common' : n.role === 'premium' ? 'uncommon' : 'rare');
/** The wave's quotas → { common, uncommon } units (0 = no fields of that tier revealed: nothing asked). Deterministic. */
export function waveQuota(state, wave, parSec) {
  const out = { common: 0, uncommon: 0 };
  const nodes = state.resourceNodes || [];
  if (!nodes.length || !(parSec > 0)) return out;
  const st = harvesterStats(state), b = state.base ? state.base.pos || state.base : { x: 0, y: 0 };
  const fleet = Math.min(HARVESTER_CAP, Math.max(aliveHarvesters(state).length, freeFleetFor(wave)));
  const tiers = wave >= UNCOMMON_QUOTA_FROM_WAVE ? ['common', 'uncommon'] : ['common'];
  for (const tier of tiers) {
    const share = tiers.length === 1 ? 1 : QUOTA_SPLIT[tier];
    const pool = nodes.filter((n) => n.wave <= wave && tierOfNode(n) === tier && n.units > 0);
    if (!pool.length) continue;
    const near = pool.reduce((a, n) => (Math.hypot(n.x - b.x, n.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? n : a));
    const d = Math.hypot(near.x - b.x, near.y - b.y), pull = near.units / Math.max(1, near.harvestSec);
    const trip = (2 * d) / Math.max(0.1, st.speed) + st.capacity / Math.max(0.1, pull) + HARVESTER_UNLOAD_TIME;
    const total = pool.filter((n) => n.wave === wave).reduce((a, n) => a + n.units, 0) || pool.reduce((a, n) => a + n.units, 0);
    out[tier] = Math.max(1, Math.min(Math.floor(total * 0.6), Math.floor((st.capacity / trip) * fleet * parSec * QUOTA_WORK_SHARE * share)));
  }
  return out;
}
export function resetFleetForWave(state) {
  const want = Math.min(HARVESTER_CAP, freeFleetFor(state.waves ? state.waves.current : 1));
  for (let guard = 0; aliveHarvesters(state).length < want && guard < HARVESTER_CAP; guard++) if (!spawnHarvester(state)) break;
  state.harvesterId = (state.harvesterIds || [])[0] ?? null;
  if (state.base) state.base.hp = state.base.maxHp;            // healed base every wave (owner)
}

export function stepHarvest(state, dt) {
  const nodes = state.resourceNodes;
  if (!nodes) return;

  // primary regrowth (GDD §5.3: ~75s; the time bonus is what keeps farming honest)
  const respawnSec = (MAPDATA.globalParams && MAPDATA.globalParams.Primary_Respawn_Sec) || 75;
  for (const n of nodes) {
    if (n.respawns && n.remaining <= 0 && n.respawnAt == null) n.respawnAt = state.time + respawnSec;
    if (n.respawnAt != null && state.time >= n.respawnAt) {
      n.remaining = n.units; n.respawnAt = null;
      emitEvent(state, { type: 'nodeRespawn', tick: state.tick, nodeId: n.id, pos: { x: n.x, y: n.y } });
    }
  }

  // FIELD REGROWTH (outpost surface fields, data/outpost.js surfaceStock): a field whose nodes carry `regrow` regrows
  // continuously at the sum of its cells' rates while it is below its full stock — the away closed form's rule
  // (outpost/model.js harvestFields), so a live visit and the away accrual regrow alike. The field's regrowth fills
  // its cells that are below full, in node order (deterministic). Battle nodes carry no `regrow` and skip this.
  stepFieldRegrowth(nodes, dt);

  // HARVESTOR BAY conversion: a completed STR-Harvestor is a purchase, not a building — it turns
  // into a new harvester unit homed on that cell and frees the ground.
  if (state.structures) {
    const done = [];
    for (const s of state.structures.values()) {
      if (s.structId === 'STR-Harvestor' && s.lifecycle === 'Complete') done.push(s);
    }
    for (const s of done) {
      state.structures.delete(s.id);
      if (!state.harvesterIds) state.harvesterIds = [];
      const nu = spawnHarvester(state);   // takes the first open dock (positions 1-4)
      if (nu) emitEvent(state, { type: 'harvesterBuilt', tick: state.tick, unitId: nu.id, pos: { x: nu.pos.x, y: nu.pos.y } });
    }
  }

  for (const u of aliveHarvesters(state)) {
    if (u.disruptedUntil && state.tick < u.disruptedUntil) continue;   // stuck in a Water Blob puddle [MM-story_mvn06wnv_7]
    stepOneHarvester(state, u, dt);
  }

  // TRUCK-TRUCK SEPARATION (owner: 'harvesters need to stop colliding'): the fleet ignores the
  // combat crowd by contract, but trucks sharing a field stacked on the same crystal. Gentle
  // mutual push between MOVING trucks only (docked/pulling trucks hold their spot), deterministic
  // i<j order, capped per tick — they fan out over neighbouring cells instead of overlapping.
  const fleet = aliveHarvesters(state);
  for (let i = 0; i < fleet.length; i++) {
    for (let j = i + 1; j < fleet.length; j++) {
      const a = fleet[i], b = fleet[j];
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      const want = 1.1;                        // ~a cell of daylight between truck centres
      if (d >= want || d < 1e-6) continue;
      const push = Math.min(0.06, (want - d) * 0.5);
      const nx = dx / d, ny = dy / d;
      const aMoves = a.state === 'harvestGo' || a.state === 'harvestReturn';
      const bMoves = b.state === 'harvestGo' || b.state === 'harvestReturn';
      const aShare = aMoves && bMoves ? 0.5 : (aMoves ? 1 : (bMoves ? 0 : 0.5));
      a.pos.x -= nx * push * aShare; a.pos.y -= ny * push * aShare;
      b.pos.x += nx * push * (1 - aShare); b.pos.y += ny * push * (1 - aShare);
    }
  }
}

function stepFieldRegrowth(nodes, dt) {
  let fields = null;
  for (const n of nodes) {
    if (!(n.regrow > 0)) continue;
    const f = (fields ||= new Map()).get(n.fieldId);
    if (f) { f.rate += n.regrow; f.cells.push(n); } else fields.set(n.fieldId, { rate: n.regrow, cells: [n] });
  }
  if (!fields) return;
  for (const f of fields.values()) {
    let left = f.rate * dt;
    for (const n of f.cells) {
      if (left <= 0) break;
      const add = Math.min(left, n.units - n.remaining);
      if (add > 0) { n.remaining += add; left -= add; }
    }
  }
}

function stepOneHarvester(state, u, dt) {
  const nodes = state.resourceNodes;
  // structure placed/sold/destroyed since this trip was planned → the old path may now cut
  // through a wall. Re-route to the SAME destination on the fresh grid (deterministic: keyed
  // to the sim's navVersion, bumped in recomputeUnitPaths).
  if ((u.state === 'harvestGo' || u.state === 'harvestReturn') && u._navV !== (state.navVersion || 0)) {
    u._navV = state.navVersion || 0;
    if (u.state === 'harvestGo') {
      const node = nodes && nodes.find((n) => n.id === u.harvestNodeId);
      if (node) routeTo(state, u, node); else routeHome(state, u);
    } else {
      routeHome(state, u);
    }
  } else if (u._navV === undefined) {
    u._navV = state.navVersion || 0;
  }
  if (u.state === 'harvestIdle') {
    // IDLE AUTO-GATHER (owner 2026-07-16): an idle truck dispatches ITSELF to the closest available
    // resource (any type). Trucks only truly rest when nothing revealed remains; explicit orders
    // still override at any time (cmdHarvest retasks regardless of state).
    if (held(state, u)) return;                 // parked or the store is full: the truck holds its dock
    const pick = nearestFreeNode(state, u);
    if (pick) { u.fieldId = pick.fieldId; routeTo(state, u, pick); }
  } else if (u.state === 'harvestGo') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node || held(state, u)) { routeHome(state, u); return; }
    if (marchAlong(u, dt)) u.state = 'harvestPull';
  } else if (u.state === 'harvestPull') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node || u.parked) { routeHome(state, u); return; }   // power cut: haul home what is on board
    const room = roomLeft(state);
    if (room <= 1e-9) { routeHome(state, u); return; }        // the store is full: stop pulling
    const rate = node.units / Math.max(1, node.harvestSec);   // units per second at this cell
    // L5 unlock (workbook): PREMIUM FAST-HARVEST — endgame greed enabler
    const lvl = state.harvesterLevel || 1;
    const pullRate = (lvl >= 5 && node.role === 'premium') ? rate * 1.5 : rate;
    const take = Math.min(pullRate * dt, Math.max(0, node.remaining), u.capacity - u.cargo, room);
    if (take > 0) {
      const tk = (state.waveTake ||= { common: 0, uncommon: 0, rare: 0, epic: 0 });   // the wave quotas' count
      tk[tierOfNode(node)] = (tk[tierOfNode(node)] || 0) + take;
      node.remaining -= take;
      u.cargo += take;
      u.cargoValue += take * (node.valuePerUnit || 0);
      u.cargoRole = node.role;
      u.cargoColor = node.color;                  // the colour on the truck's bed (the renderer draws the last pull)
      // what the load is made of, per colour: a truck retasked part-loaded onto another field carries both, and each
      // part is credited at its own tier on delivery [MM-story_mw4a1o3p_m]
      const m = (u.cargoMix ||= {})[node.color] ||= { units: 0, value: 0, role: node.role };
      m.units += take; m.value += take * (node.valuePerUnit || 0); m.role = node.role;
    }
    // L3 unlock (workbook): AUTO-RETURN AT 90% — stop topping off on sparse cells (micro relief)
    const fullAt = (state.harvesterLevel || 1) >= 3 ? u.capacity * 0.9 : u.capacity - 1e-9;
    if (u.cargo >= fullAt) { routeHome(state, u); return; }   // full (enough) — haul it home
    if (node.remaining <= 0) {
      const next = nextFieldTarget(state, u);
      if (next) { routeTo(state, u, next); return; }   // this cell is bare — work the next one
      // field EMPTIED — auto-continue on the nearest field of the SAME resource (owner 2026-07-17)
      const hop = nextSameResourceField(state, u);
      if (hop) {
        u.fieldId = hop.fieldId;
        routeTo(state, u, hop);
        emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: hop.id, fieldId: hop.fieldId, unitId: u.id, pos: { x: hop.x, y: hop.y } });
      } else { if (!u.fieldLock) u.fieldId = null; routeHome(state, u); }   // no same-resource field left — deliver, await orders
    }
  } else if (u.state === 'harvestReturn') {
    if (marchAlong(u, dt)) {
      if (u.cargo > 0) beginUnload(state, u, dt);   // docked with a load — hold for the unload timer
      else leaveDock(state, u);                      // empty-handed return: straight back out
    }
  } else if (u.state === 'harvestUnload') {
    // UNLOAD (owner 2026-10-16): the truck holds at the dock for HARVESTER_UNLOAD_TIME. A destroyed
    // base can't receive the load → abort, nothing credited. (A truck killed mid-unload simply
    // drops out of aliveHarvesters — its cargo was never credited.)
    if (!state.base || !(state.base.hp > 0)) {
      emitEvent(state, { type: 'unloadCancel', tick: state.tick, id: u.id, pos: { x: u.pos.x, y: u.pos.y } });
      u.cargo = 0; u.cargoValue = 0; u.cargoRole = null; u.cargoColor = null; u.cargoMix = {};
      u.unloadTicks = 0;
      u.fieldId = null; u.harvestNodeId = null;
      u.state = 'harvestIdle';
      return;
    }
    u.unloadTicks -= 1;
    if (u.unloadTicks > 0) return;
    u.unloadTicks = 0;
    creditDeposit(state, u);
    leaveDock(state, u);
  }
}

/** Gold a load is worth on delivery (yield applied, floored) — the value unloadStart promises and
 *  the deposit credits. */
function cargoGold(u) {
  return Math.floor(u.cargoValue * (u.yieldMult || 1));
}

/** Truck reached the dock with cargo: start the deterministic, TICK-counted unload timer. */
function beginUnload(state, u, dt) {
  u.state = 'harvestUnload';
  u.path = []; u.pathIdx = 0;
  u.unloadTicks = Math.max(1, Math.round(HARVESTER_UNLOAD_TIME / Math.max(dt, 1e-6)));
  emitEvent(state, {
    type: 'unloadStart', tick: state.tick, id: u.id, pos: { x: u.pos.x, y: u.pos.y },
    dur: HARVESTER_UNLOAD_TIME, color: u.cargoColor || 'blue', gold: cargoGold(u),
  });
}

/** The colour economy's tiers (same table as save/battleTally.js COLOR_TIER; the sim may not import save code). */
const CARGO_TIER = { blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' };

/** COLLECTIVE CONTRACT [MM-story_mw12m2df_2] (owner 2026-11-03): the player sells every harvested resource to the
 *  Collective under the map's contract. A load pays gold until its tier's quota is met; anything above the quota is
 *  NOT sold — it pays no gold and the player keeps it (the inventory banks it at battle end). `quota` comes from the
 *  map-data workbook (Maps: Contract_*), passed in through createSim's options so a replay rebuilds the same contract.
 *  No contract (classic board, harness) = every load pays, as before. */
export function initContract(quota) {
  if (!quota) return null;
  const z = () => ({ common: 0, uncommon: 0, rare: 0, epic: 0 });
  const q = z();
  for (const k of Object.keys(q)) q[k] = Math.max(0, Math.floor(Number(quota[k]) || 0));
  return { quota: q, sold: z(), kept: z() };
}

/** DEPOSIT (owner color economy): every haul the contract still buys pays gold — blue/yellow are the economy
 *  crystals, red/green additionally count up the header QUEST objectives. Runs when the unload completes.
 *
 *  PER TIER [MM-story_mw4a1o3p_m]. A load is credited colour by colour (blue, yellow, red, green), each part at its
 *  own tier, with one `deposit` event per colour. It used to be credited whole at the tier of its LAST crystal, so a
 *  truck retasked part-loaded from a common field onto a rare one sold its common units as rare (balance report
 *  2026-11-05, "mixed loads"). A single-colour load — the usual case — credits exactly as before. */
const MIX_ORDER = ['blue', 'yellow', 'red', 'green'];
function creditDeposit(state, u) {
  if (!(u.cargo > 0)) return;
  const mix = u.cargoMix && Object.keys(u.cargoMix).length ? u.cargoMix
    : { [u.cargoColor || 'blue']: { units: u.cargo, value: u.cargoValue, role: u.cargoRole } };   // a truck from an older save
  const colors = Object.keys(mix).sort((a, b) => MIX_ORDER.indexOf(a) - MIX_ORDER.indexOf(b));
  for (const color of colors) creditPart(state, u, color, mix[color]);
  if (state.harvestRoom != null) state.harvestRoom = Math.max(0, state.harvestRoom - u.cargo);   // the load is in the store
  u.cargo = 0; u.cargoValue = 0; u.cargoRole = null; u.cargoColor = null; u.cargoMix = {};
}

/** Credit one colour of a load: sell it to the contract up to its tier's quota, keep the rest. */
function creditPart(state, u, color, part) {
  const units = Math.floor(part.units + 1e-9);   // a full load summed tick by tick can land a hair under its whole
  if (!(part.units > 0)) return;
  const tier = CARGO_TIER[color] || 'common';
  const role = part.role || 'primary';
  let gold = Math.floor(part.value * (u.yieldMult || 1)), sold = units, kept = 0;
  const c = state.contract;
  if (c) {
    sold = Math.min(units, Math.max(0, c.quota[tier] - c.sold[tier]));
    kept = units - sold;
    gold = units > 0 ? Math.floor(gold * sold / units) : 0;
    c.sold[tier] += sold;
    c.kept[tier] += kept;
  }
  if (gold > 0) {
    if (state.economy) state.economy.money = (state.economy.money || 0) + gold;
    if (role === 'premium') state.mapScore.goldFromPremium += gold;
    else state.mapScore.goldFromPrimary += gold;
  }
  if (color === 'red' || color === 'green') {
    state.mapScore.questUnits += units;
    if (color === 'red') state.mapScore.questRed += units; else state.mapScore.questGreen += units;
  }
  emitEvent(state, { type: 'deposit', tick: state.tick, gold, units, sold, kept, contract: !!c, role, color, fieldId: u.fieldId, pos: { x: u.pos.x, y: u.pos.y } });
}

/** Done at the dock: still mid-job? head back out — to the assigned field, or if it was stripped
 *  while hauling, to the nearest field of the SAME resource (owner 2026-07-17); else rest. */
function leaveDock(state, u) {
  let next = u.fieldId && !held(state, u) ? nextFieldTarget(state, u) : null;
  if (!next && u.fieldId && !held(state, u)) {
    const hop = nextSameResourceField(state, u);
    if (hop) {
      u.fieldId = hop.fieldId; next = hop;
      emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: hop.id, fieldId: hop.fieldId, unitId: u.id, pos: { x: hop.x, y: hop.y } });
    }
  }
  if (next) routeTo(state, u, next);
  else {
    if (!u.fieldLock) u.fieldId = null;   // a locked truck keeps its field and waits for it to regrow
    u.harvestNodeId = null;
    u.state = 'harvestIdle';
  }
}
