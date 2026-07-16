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
import { createUnit } from './entities.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';
import { emitEvent } from './core.js';

const HARVESTER_UNIT = 'GND-Trucks';   // the truck IS the harvester (own stats overridden below)

// Baseline harvester = Factions sheet row 1 (the tuning reference) at upgrade level 1.
// Faction choice + upgrade levels arrive with the campaign shell story.
function harvesterStats(state) {
  const f = (MAPDATA.factions && MAPDATA.factions[0]) || {};
  // HARVESTER UPGRADES (workbook, levels 1-5): multipliers injected at createSim via
  // state.harvesterLevel — part of the initial deterministic state, never mid-battle.
  const lvl = Math.max(1, Math.min(5, (state && state.harvesterLevel) || 1));
  const up = (MAPDATA.harvesterUpgrades || []).find((u) => u.Level === lvl) || {};
  return {
    capacity: Math.round((f.Harvester_Base_Capacity || 40) * (up.Capacity_Mult || 1)),
    speed: (f.Harvester_Base_Speed || 3) * (up.Speed_Mult || 1),
    hp: Math.round((f.Harvester_Base_HP || 120) * (up.HP_Mult || 1)),
    yieldMult: f.Yield_Mult || 1,
  };
}

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
 *  start and by a completed Harvestor bay. Returns null at the fleet cap. */
export function spawnHarvester(state) {
  if (aliveHarvesters(state).length >= HARVESTER_CAP) return null;
  const pos = firstOpenDock(state);
  const s = harvesterStats(state);
  const u = createUnit(state, HARVESTER_UNIT, 1, { x: pos.x, y: pos.y }, 'ground', 'defender');
  if (!state.units.has(u.id)) state.units.set(u.id, u);
  u.isHarvester = true;
  u.artKey = 'SYS-Harvester';   // author its look in the State Bench under faction "System"
  u.state = 'harvestIdle';
  u.dps = 0; u.targetsBase = false; u.targetId = null;
  u.hp = s.hp; u.maxHp = s.hp; u.speed = s.speed;
  u.cargo = 0; u.cargoValue = 0; u.capacity = s.capacity; u.yieldMult = s.yieldMult;
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
  state.resourceNodes = map.resources.filter((r) => !_nearBase(r.x, r.y)).map((r) => ({
    id: r.id, fieldId: r.fieldId || r.id, type: r.type, role: r.role, wave: r.wave, x: r.x, y: r.y,
    color: r.color || (r.role === 'primary' ? 'blue' : r.role === 'premium' ? 'yellow' : (hash8(r.id) % 2 ? 'red' : 'green')),
    units: r.units, remaining: r.units,
    valuePerUnit: r.valuePerUnit || questGoldValue(r),   // quest nodes now pay gold too
    respawns: !!r.respawns, respawnAt: null,
    harvestSec: nodeHarvestSec(r),
  }));
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

function nodeHarvestSec(r) {
  const def = MAPDATA.resources.find((d) => d.Resource === r.type && (r.role === 'premium' ? d.Tier === 'Premium' : d.Tier === 'Primary'));
  return (def && def.Harvest_Sec_Per_Node) || 8;
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
// nearest field cell with anything left to pull, skipping cells another truck has claimed
// (deterministic: distance, then id)
function nextFieldTarget(state, u) {
  const taken = reservedNodes(state, u);
  const live = fieldCells(state, u.fieldId).filter((n) => n.remaining > 0 && nodeRevealed(state, n) && !taken.has(n.id));
  if (!live.length) return null;
  live.sort((a, b) =>
    (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  return live[0];
}
// IDLE AUTO-GATHER (owner 2026-07-16): an idle harvester finds the CLOSEST available resource —
// any type, any field — revealed, non-empty, unreserved. Trucks only rest when the map is bare.
function nearestFreeNode(state, u) {
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
  if (!u.resType) return null;
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
  let u = null;
  if (cmd.harvesterId != null) {
    u = fleet.find((h) => h.id === cmd.harvesterId) || null;
    if (!u) return { ok: false, reason: 'that harvester is gone' };
  } else {
    const byDist = (a, b) => (Math.hypot(a.pos.x - node.x, a.pos.y - node.y) - Math.hypot(b.pos.x - node.x, b.pos.y - node.y)) || (a.id - b.id);
    const idle = fleet.filter((h) => !h.fieldId && h.state === 'harvestIdle').sort(byDist);
    u = idle[0] || fleet.slice().sort(byDist)[0];
  }
  u.fieldId = node.fieldId;
  // route to the clicked cell unless another truck already claimed it — then the nearest free cell
  const target = (node.remaining > 0 && !reservedNodes(state, u).has(node.id)) ? node : nextFieldTarget(state, u);
  if (target) routeTo(state, u, target);
  else u.state = 'harvestIdle';
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

/** Per-wave transition. OWNER RULE CHANGE (epic-mrmwh12kq3 / story-mrmwpzcl6wq, 2026-07-18):
 *  harvesters PERSIST between waves — no retirement, no re-dock, no cargo wipe. Trucks keep their
 *  field assignments and keep working straight through the interlude. Only a fully wiped fleet
 *  gets the free starter (the economy must never dead-end); the healed base rule is unchanged. */
export function resetFleetForWave(state) {
  if (!aliveHarvesters(state).length) spawnHarvester(state);   // none survived → give the free one
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

  for (const u of aliveHarvesters(state)) stepOneHarvester(state, u, dt);

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
    const pick = nearestFreeNode(state, u);
    if (pick) { u.fieldId = pick.fieldId; routeTo(state, u, pick); }
  } else if (u.state === 'harvestGo') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node) { routeHome(state, u); return; }
    if (marchAlong(u, dt)) u.state = 'harvestPull';
  } else if (u.state === 'harvestPull') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node) { routeHome(state, u); return; }
    const rate = node.units / Math.max(1, node.harvestSec);   // units per second at this cell
    // L5 unlock (workbook): PREMIUM FAST-HARVEST — endgame greed enabler
    const lvl = state.harvesterLevel || 1;
    const pullRate = (lvl >= 5 && node.role === 'premium') ? rate * 1.5 : rate;
    const take = Math.min(pullRate * dt, Math.max(0, node.remaining), u.capacity - u.cargo);
    if (take > 0) {
      node.remaining -= take;
      u.cargo += take;
      u.cargoValue += take * (node.valuePerUnit || 0);
      u.cargoRole = node.role;
      u.cargoColor = node.color;
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
      } else { u.fieldId = null; routeHome(state, u); }   // no same-resource field left — deliver, await orders
    }
  } else if (u.state === 'harvestReturn') {
    if (marchAlong(u, dt)) {
      // DEPOSIT (owner color economy): EVERY haul pays gold — blue/yellow are the economy crystals,
      // red/green additionally count up the header QUEST objectives.
      if (u.cargo > 0) {
        const gold = Math.floor(u.cargoValue * (u.yieldMult || 1));
        if (gold > 0) {
          if (state.economy) state.economy.money = (state.economy.money || 0) + gold;
          if (u.cargoRole === 'premium') state.mapScore.goldFromPremium += gold;
          else state.mapScore.goldFromPrimary += gold;
        }
        if (u.cargoColor === 'red' || u.cargoColor === 'green') {
          const n = Math.floor(u.cargo);
          state.mapScore.questUnits += n;
          if (u.cargoColor === 'red') state.mapScore.questRed += n; else state.mapScore.questGreen += n;
        }
        emitEvent(state, { type: 'deposit', tick: state.tick, gold, units: Math.floor(u.cargo), role: u.cargoRole || 'primary', color: u.cargoColor || 'blue', fieldId: u.fieldId });
        u.cargo = 0; u.cargoValue = 0; u.cargoRole = null; u.cargoColor = null;
      }
      // still mid-job (came home full)? head back out — to the assigned field, or if it was
      // stripped while hauling, to the nearest field of the SAME resource (owner 2026-07-17)
      let next = u.fieldId ? nextFieldTarget(state, u) : null;
      if (!next && u.fieldId) {
        const hop = nextSameResourceField(state, u);
        if (hop) {
          u.fieldId = hop.fieldId; next = hop;
          emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: hop.id, fieldId: hop.fieldId, unitId: u.id, pos: { x: hop.x, y: hop.y } });
        }
      }
      if (next) routeTo(state, u, next);
      else {
        u.fieldId = null;
        u.harvestNodeId = null;
        u.state = 'harvestIdle';
      }
    }
  }
}
