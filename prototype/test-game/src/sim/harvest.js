// harvest.js — the harvester + resource collection loop (Maps GDD §5/§8, story 3 of the epic).
//
// Campaign maps carry resource nodes (mapgen.js places them on the radial gradient). The player owns
// ONE harvester (level-4 upgrade adds a second — later story): click a revealed node to send it; it
// pulls units at the node's harvest rate until full or the node is dry, hauls home, deposits, and
// keeps cycling on its own until the node is gone or it gets a new order. Primary nodes regrow
// (Primary_Respawn_Sec); premium and quest never do. Deposits pay gold into the build economy AND the
// map-score tally (state.mapScore) — quest nodes pay loyalty units only, never gold (§5A).
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

/** Create runtime node state + the player's harvester. Called by createSim on campaign maps. */
export function initHarvest(state, map) {
  if (!map || !map.resources || !map.resources.length) return;
  state.resourceNodes = map.resources.map((r) => ({
    id: r.id, type: r.type, role: r.role, wave: r.wave, x: r.x, y: r.y,
    units: r.units, remaining: r.units, valuePerUnit: r.valuePerUnit,
    respawns: !!r.respawns, respawnAt: null,
    harvestSec: nodeHarvestSec(r),
  }));
  state.mapScore = { goldFromPrimary: 0, goldFromPremium: 0, questUnits: 0 };
  const s = harvesterStats();
  const u = createUnit(state, HARVESTER_UNIT, 1, { x: map.base.x, y: map.base.y + 2 }, 'ground', 'defender');
  if (!state.units.has(u.id)) state.units.set(u.id, u);
  u.isHarvester = true;
  u.state = 'harvestIdle';
  u.dps = 0; u.targetsBase = false; u.targetId = null;
  u.hp = s.hp; u.maxHp = s.hp; u.speed = s.speed;
  u.cargo = 0; u.cargoValue = 0; u.capacity = s.capacity; u.yieldMult = s.yieldMult;
  u.harvestNodeId = null;
  state.harvesterId = u.id;
}

function nodeHarvestSec(r) {
  const def = MAPDATA.resources.find((d) => d.Resource === r.type && (r.role === 'premium' ? d.Tier === 'Premium' : d.Tier === 'Primary'));
  return (def && def.Harvest_Sec_Per_Node) || 8;
}

function nodeRevealed(state, node) {
  const wv = Math.max(1, Math.min((state.waves && state.waves.current) || 1, 8));
  return node.wave <= wv;
}

/** Command: send the harvester to a node. {type:'harvest', nodeId} */
export function cmdHarvest(state, cmd) {
  const u = state.units.get(state.harvesterId);
  if (!u || u.hp <= 0) return { ok: false, reason: 'no harvester' };
  const node = (state.resourceNodes || []).find((n) => n.id === cmd.nodeId);
  if (!node) return { ok: false, reason: 'no such node' };
  if (!nodeRevealed(state, node)) return { ok: false, reason: 'not revealed yet' };
  if (node.remaining <= 0 && !node.respawns) return { ok: false, reason: 'node exhausted' };
  u.harvestNodeId = node.id;
  routeTo(state, u, node);
  emitEvent(state, { type: 'harvestOrder', tick: state.tick, nodeId: node.id, pos: { x: node.x, y: node.y } });
  return { ok: true, reason: '' };
}

function routeTo(state, u, target) {
  const map = state.map;
  const nav = buildNavGrid(map, [...state.structures.values()].filter((s) => s.hp > 0 && s.lifecycle !== 'Destroyed'));
  const from = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) };
  u.path = findWalkerPath(nav, from, { x: target.x, y: target.y }) || [{ x: target.x, y: target.y }];
  u.pathIdx = 0;
  u.state = 'harvestGo';
}
function routeHome(state, u) {
  const map = state.map;
  const nav = buildNavGrid(map, [...state.structures.values()].filter((s) => s.hp > 0 && s.lifecycle !== 'Destroyed'));
  const from = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) };
  const home = { x: map.base.x, y: map.base.y + 2 };
  u.path = findWalkerPath(nav, from, home) || [home];
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
  const node = u.harvestNodeId ? nodes.find((n) => n.id === u.harvestNodeId) : null;

  if (u.state === 'harvestGo') {
    if (!node) { u.state = 'harvestIdle'; return; }
    if (marchAlong(u, dt)) u.state = 'harvestPull';
  } else if (u.state === 'harvestPull') {
    if (!node || (node.remaining <= 0 && u.cargo === 0)) {
      // arrived at a dry node — wait in place if it regrows, else go idle where it stands
      if (node && node.respawns) return;
      u.state = 'harvestIdle'; u.harvestNodeId = null; return;
    }
    const rate = node.units / Math.max(1, node.harvestSec);   // units per second at this node
    const take = Math.min(rate * dt, node.remaining, u.capacity - u.cargo);
    if (take > 0) {
      node.remaining -= take;
      u.cargo += take;
      u.cargoValue += take * (node.valuePerUnit || 0);
      u.cargoRole = node.role;
    }
    if (u.cargo >= u.capacity - 1e-9 || (node.remaining <= 0 && u.cargo > 0)) routeHome(state, u);
  } else if (u.state === 'harvestReturn') {
    if (marchAlong(u, dt)) {
      // DEPOSIT: gold into the build economy + the map-score tally; quest cargo pays loyalty units
      const gold = Math.floor(u.cargoValue * (u.yieldMult || 1));
      if (u.cargoRole === 'quest') {
        state.mapScore.questUnits += Math.floor(u.cargo);
      } else if (gold > 0) {
        if (state.economy) state.economy.money = (state.economy.money || 0) + gold;
        if (u.cargoRole === 'premium') state.mapScore.goldFromPremium += gold;
        else state.mapScore.goldFromPrimary += gold;
      }
      emitEvent(state, { type: 'deposit', tick: state.tick, gold, units: Math.floor(u.cargo), role: u.cargoRole || 'primary', nodeId: u.harvestNodeId });
      u.cargo = 0; u.cargoValue = 0; u.cargoRole = null;
      // auto-cycle: back to the same node while it has (or will regrow) anything
      if (node && (node.remaining > 0 || node.respawns)) routeTo(state, u, node);
      else { u.state = 'harvestIdle'; u.harvestNodeId = null; }
    }
  }
}
