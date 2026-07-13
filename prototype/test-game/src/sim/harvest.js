// harvest.js — the harvester + resource FIELD collection loop (Maps GDD §5/§8, story 3 of the epic).
//
// The harvester CAMPS at the base in an open cell. Clicking any cell of a resource FIELD (a connected
// cluster of resource cells — mapgen grows primaries as 2-3 cell patches; premium is usually a single
// rich cell) assigns the whole field as its job: fill up → haul home → deposit (gold visibly lands) →
// return to the field's next unworked cell → repeat until the field is done, then rest at the base
// until redeployed. A regrowing primary field keeps the assignment: the harvester rests at home while
// the field is bare and heads back out on its own when it regrows. Premium/quest never regrow — once
// stripped, the job is over.
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
function harvesterStats() {
  const f = (MAPDATA.factions && MAPDATA.factions[0]) || {};
  return {
    capacity: f.Harvester_Base_Capacity || 40,
    speed: f.Harvester_Base_Speed || 3,
    hp: f.Harvester_Base_HP || 120,
    yieldMult: f.Yield_Mult || 1,
  };
}

// open cell next to the base for the harvester to camp on — first free spot scanning outward
function homeCell(map) {
  const bad = new Set();
  for (const c of map.base.cells || []) bad.add(`${c.x},${c.y}`);
  for (const c of map.base.cornerSlots || []) bad.add(`${c.x},${c.y}`);
  for (const c of map.waterCells || []) bad.add(`${c.x},${c.y}`);
  for (const r of map.resources || []) bad.add(`${r.x},${r.y}`);
  for (let radius = 2; radius <= 4; radius++) {
    for (const [dx, dy] of [[0, radius], [0, -radius], [radius, 0], [-radius, 0],
                            [radius, radius], [-radius, radius], [radius, -radius], [-radius, -radius]]) {
      const q = { x: map.base.x + dx, y: map.base.y + dy };
      if (q.x < 0 || q.y < 0 || q.x >= map.cols || q.y >= map.rows) continue;
      if (!bad.has(`${q.x},${q.y}`)) return q;
    }
  }
  return { x: map.base.x, y: map.base.y + 2 };
}

/** Create runtime node state + the player's harvester. Called by createSim on campaign maps. */
export function initHarvest(state, map) {
  if (!map || !map.resources || !map.resources.length) return;
  state.resourceNodes = map.resources.map((r) => ({
    id: r.id, fieldId: r.fieldId || r.id, type: r.type, role: r.role, wave: r.wave, x: r.x, y: r.y,
    units: r.units, remaining: r.units, valuePerUnit: r.valuePerUnit,
    respawns: !!r.respawns, respawnAt: null,
    harvestSec: nodeHarvestSec(r),
  }));
  state.mapScore = { goldFromPrimary: 0, goldFromPremium: 0, questUnits: 0 };
  const s = harvesterStats();
  const home = homeCell(map);
  const u = createUnit(state, HARVESTER_UNIT, 1, { x: home.x, y: home.y }, 'ground', 'defender');
  if (!state.units.has(u.id)) state.units.set(u.id, u);
  u.isHarvester = true;
  u.state = 'harvestIdle';
  u.dps = 0; u.targetsBase = false; u.targetId = null;
  u.hp = s.hp; u.maxHp = s.hp; u.speed = s.speed;
  u.cargo = 0; u.cargoValue = 0; u.capacity = s.capacity; u.yieldMult = s.yieldMult;
  u.fieldId = null;        // the assigned FIELD (whole connected patch)
  u.harvestNodeId = null;  // the specific cell being worked right now
  u.homePos = home;
  state.harvesterId = u.id;
}

function nodeHarvestSec(r) {
  const def = MAPDATA.resources.find((d) => d.Resource === r.type && (r.role === 'premium' ? d.Tier === 'Premium' : d.Tier === 'Primary'));
  return (def && def.Harvest_Sec_Per_Node) || 8;
}

function nodeRevealed(state, node) {
  if (state.map && state.map.openPlay) return true;   // open play: the whole board is harvestable
  const wv = Math.max(1, Math.min((state.waves && state.waves.current) || 1, 8));
  return node.wave <= wv;
}

function fieldCells(state, fieldId) {
  return state.resourceNodes.filter((n) => n.fieldId === fieldId);
}
// nearest field cell with anything left to pull (deterministic: distance, then id)
function nextFieldTarget(state, u) {
  const live = fieldCells(state, u.fieldId).filter((n) => n.remaining > 0 && nodeRevealed(state, n));
  if (!live.length) return null;
  live.sort((a, b) =>
    (Math.hypot(a.x - u.pos.x, a.y - u.pos.y) - Math.hypot(b.x - u.pos.x, b.y - u.pos.y)) || (a.id < b.id ? -1 : 1));
  return live[0];
}

/** Command: put the harvester on a FIELD. {type:'harvest', nodeId} — any cell of the field works. */
export function cmdHarvest(state, cmd) {
  const u = state.units.get(state.harvesterId);
  if (!u || u.hp <= 0) return { ok: false, reason: 'no harvester' };
  const node = (state.resourceNodes || []).find((n) => n.id === cmd.nodeId);
  if (!node) return { ok: false, reason: 'no such node' };
  if (!nodeRevealed(state, node)) return { ok: false, reason: 'not revealed yet' };
  const live = fieldCells(state, node.fieldId).some((n) => n.remaining > 0 || n.respawns);
  if (!live) return { ok: false, reason: 'field exhausted' };
  u.fieldId = node.fieldId;
  const target = node.remaining > 0 ? node : nextFieldTarget(state, u);
  if (target) routeTo(state, u, target);
  else u.state = 'harvestIdle';   // whole field regrowing — camp at home, auto-resume on respawn
  emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: node.id, fieldId: node.fieldId, pos: { x: node.x, y: node.y } });
  return { ok: true, reason: '' };
}

function liveStructs(state) {
  return [...state.structures.values()].filter((s) => s.hp > 0 && s.lifecycle !== 'Destroyed');
}
function routeTo(state, u, target) {
  const nav = buildNavGrid(state.map, liveStructs(state));
  const from = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) };
  u.path = findWalkerPath(nav, from, { x: target.x, y: target.y }) || [{ x: target.x, y: target.y }];
  u.pathIdx = 0;
  u.harvestNodeId = target.id;
  u.state = 'harvestGo';
}
function routeHome(state, u) {
  const nav = buildNavGrid(state.map, liveStructs(state));
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

  const u = state.units.get(state.harvesterId);
  if (!u || u.hp <= 0) return;

  if (u.state === 'harvestIdle') {
    // camped at home with a standing field assignment — head back out the moment the field regrows
    if (u.fieldId) {
      const target = nextFieldTarget(state, u);
      if (target) routeTo(state, u, target);
    }
  } else if (u.state === 'harvestGo') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node) { routeHome(state, u); return; }
    if (marchAlong(u, dt)) u.state = 'harvestPull';
  } else if (u.state === 'harvestPull') {
    const node = nodes.find((n) => n.id === u.harvestNodeId);
    if (!node) { routeHome(state, u); return; }
    const rate = node.units / Math.max(1, node.harvestSec);   // units per second at this cell
    const take = Math.min(rate * dt, Math.max(0, node.remaining), u.capacity - u.cargo);
    if (take > 0) {
      node.remaining -= take;
      u.cargo += take;
      u.cargoValue += take * (node.valuePerUnit || 0);
      u.cargoRole = node.role;
    }
    if (u.cargo >= u.capacity - 1e-9) { routeHome(state, u); return; }   // full — haul it home
    if (node.remaining <= 0) {
      const next = nextFieldTarget(state, u);
      if (next) routeTo(state, u, next);            // this cell is bare — work the next one
      else routeHome(state, u);                     // field done (for now) — deliver what we have
    }
  } else if (u.state === 'harvestReturn') {
    if (marchAlong(u, dt)) {
      // DEPOSIT: gold into the build economy + the map-score tally; quest cargo pays loyalty units
      if (u.cargo > 0) {
        const gold = Math.floor(u.cargoValue * (u.yieldMult || 1));
        if (u.cargoRole === 'quest') {
          state.mapScore.questUnits += Math.floor(u.cargo);
        } else if (gold > 0) {
          if (state.economy) state.economy.money = (state.economy.money || 0) + gold;
          if (u.cargoRole === 'premium') state.mapScore.goldFromPremium += gold;
          else state.mapScore.goldFromPrimary += gold;
        }
        emitEvent(state, { type: 'deposit', tick: state.tick, gold, units: Math.floor(u.cargo), role: u.cargoRole || 'primary', fieldId: u.fieldId });
        u.cargo = 0; u.cargoValue = 0; u.cargoRole = null;
      }
      // back to the field if it has anything left; else REST AT BASE. A regrowing (primary) field
      // keeps the assignment — harvestIdle auto-resumes on respawn; a stripped premium/quest field
      // is finished, so the harvester waits for a new order.
      const next = nextFieldTarget(state, u);
      if (next) routeTo(state, u, next);
      else {
        const willRegrow = u.fieldId && fieldCells(state, u.fieldId).some((n) => n.respawns);
        if (!willRegrow) u.fieldId = null;
        u.harvestNodeId = null;
        u.state = 'harvestIdle';
      }
    }
  }
}
