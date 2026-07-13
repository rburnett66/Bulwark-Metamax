import { ASSUMPTIONS, STRUCTURES, MAP, getStructureDef } from '../data/tables.js';
import { buildNavGrid, findWalkerPath, recomputeUnitPaths } from './pathfinding.js';
import { createUnit, createStructure } from './entities.js';
import { canAfford, spend, refund, getSellValue } from './economy.js';
import { emitEvent } from './core.js';

const REPAIR_TROOP_ID = 'GND-Troops';

function getMap(state) {
  return state.map || MAP;
}

function isTowerKind(kind) {
  return kind === 'antiGround' || kind === 'antiAir';
}

function footprintCells(pos, footprint) {
  const cells = [];
  const w = (footprint && footprint.w) || 1;
  const h = (footprint && footprint.h) || 1;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return cells;
}

function structureCells(s) {
  return footprintCells(s.pos, s.footprint);
}

function cellKey(c) {
  return c.x + ',' + c.y;
}

function liveStructures(state) {
  const out = [];
  for (const s of state.structures.values()) {
    if (s.lifecycle !== 'Destroyed') out.push(s);
  }
  return out;
}

function occupiedCellSet(state) {
  const set = new Set();
  for (const s of liveStructures(state)) {
    for (const c of structureCells(s)) set.add(cellKey(c));
  }
  return set;
}

export function validatePlacement(state, structId, slotOrCell) {
  let def;
  try {
    def = getStructureDef(structId);
  } catch (e) {
    return { ok: false, reason: 'noSlot' };
  }
  if (!slotOrCell || typeof slotOrCell.x !== 'number' || typeof slotOrCell.y !== 'number') {
    return { ok: false, reason: 'terrain' };
  }
  const map = getMap(state);
  const cell = { x: Math.round(slotOrCell.x), y: Math.round(slotOrCell.y) };
  const occupied = occupiedCellSet(state);

  // The Harvestor bay buys a harvester — meaningless on boards with no resources (classic map).
  if (def.kind === 'harvestorBay' && !state.resourceNodes) {
    return { ok: false, reason: 'no resources on this map' };
  }

  // Walls/towers may be placed anywhere EXCEPT high terrain, rocks, or trees.
  const isForbiddenTerrain = (c) => {
    const t = map.terrain && map.terrain[c.y] ? map.terrain[c.y][c.x] : null;
    return t === 'high' || t === 'rock' || t === 'rocks' || t === 'tree' || t === 'trees';
  };
  const forbidden = new Set([
    cellKey(map.spawnGround),
    cellKey(map.spawnWater)
  ]);
  // s10: the 3x3 base BODY is occupied — nothing can be placed on it; its 4 corner slots stay buildable.
  for (const c of ((map.base && map.base.cells) || [map.base])) forbidden.add(cellKey(c));
  // Ring-gated campaign maps (GDD §3): building only on revealed ground. openPlay maps (the current
  // default) build anywhere — rings still schedule the enemy spawns but never fence the player.
  let ringRect = null;
  if (map.rings && map.rings.length && !map.openPlay) {
    const w = Math.max(1, Math.min((state.waves && state.waves.current) || 1, map.rings.length));
    ringRect = map.rings[w - 1].rect;
  }
  const cells = footprintCells(cell, def.footprint);
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= map.cols || c.y >= map.rows) return { ok: false, reason: 'terrain' };
    if (ringRect && (c.x < ringRect.x0 || c.x > ringRect.x1 || c.y < ringRect.y0 || c.y > ringRect.y1)) {
      return { ok: false, reason: 'outside the revealed ring' };
    }
    if (occupied.has(cellKey(c))) return { ok: false, reason: 'occupied' };
    if (forbidden.has(cellKey(c))) return { ok: false, reason: 'terrain' };
    if (isForbiddenTerrain(c)) return { ok: false, reason: 'terrain' };
  }
  if (!canAfford(state, def.cost[0])) return { ok: false, reason: 'cost' };

  // Every structure (towers included, now that they block) must leave the ground lane OPEN — reject any
  // placement that would seal the base off so units can no longer path to it.
  // Hypothetical nav grid with the new piece: the ground lane must stay open.
  const ghost = {
    id: -1,
    structId: structId,
    kind: def.kind,
    pos: { x: cell.x, y: cell.y },
    footprint: { w: (def.footprint && def.footprint.w) || 1, h: (def.footprint && def.footprint.h) || 1 },
    lifecycle: 'Building',
    hp: 1,
    maxHp: 1
  };
  const testStructures = liveStructures(state).concat([ghost]);
  const nav = buildNavGrid(map, testStructures);
  // campaign maps: the lane that must stay open runs from the CURRENT wave's ground spawn
  // (independent of ring-gating — openPlay maps still spawn per wave)
  const src = (map.rings && map.rings.length)
    ? map.rings[Math.max(1, Math.min((state.waves && state.waves.current) || 1, map.rings.length)) - 1].spawns.ground
    : map.spawnGround;
  const path = findWalkerPath(nav, { x: src.x, y: src.y }, { x: map.base.x, y: map.base.y });
  if (!path) return { ok: false, reason: 'blocksPath' };

  return { ok: true, reason: '' };
}

export function placeStructure(state, structId, slotOrCell) {
  const check = validatePlacement(state, structId, slotOrCell);
  if (!check.ok) return null;
  const def = getStructureDef(structId);
  const cost = def.cost[0];
  if (!spend(state, cost, 'build:' + structId)) return null;

  const cell = { x: Math.round(slotOrCell.x), y: Math.round(slotOrCell.y) };
  const s = createStructure(state, structId, cell);
  if (!state.structures.has(s.id)) state.structures.set(s.id, s);
  s.lifecycle = 'Building';
  s.progress = 0;
  s.invested = cost;
  s.repairPending = false;

  emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: structId, phase: 'start', pos: { x: s.pos.x, y: s.pos.y } });

  recomputeUnitPaths(state);   // any structure now changes the nav grid → reroute walkers around it
  return s;
}

export function startUpgrade(state, structureId) {
  const s = state.structures.get(structureId);
  if (!s) return false;
  if (s.lifecycle !== 'Complete' && s.lifecycle !== 'Damaged') return false;
  const def = getStructureDef(s.structId);
  const maxTier = def.hp.length;
  if (s.tier >= 3 || s.tier >= maxTier) return false;
  const upCost = def.cost[s.tier] - def.cost[s.tier - 1];
  if (!canAfford(state, upCost)) return false;
  if (!spend(state, upCost, 'upgrade:' + s.structId)) return false;
  s.invested = (s.invested || def.cost[0]) + upCost;
  s.lifecycle = 'Upgrading';
  s.progress = 0;
  emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'upgradeStart', tier: s.tier + 1 });
  return true;
}

export function startSell(state, structureId) {
  const s = state.structures.get(structureId);
  if (!s) return false;
  if (s.lifecycle === 'Selling' || s.lifecycle === 'Destroyed') return false;
  s.lifecycle = 'Selling';
  s.progress = 0;
  emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'sellStart' });
  return true;
}

export function requestRepair(state, structureId) {
  const s = state.structures.get(structureId);
  if (!s) return false;
  if (s.lifecycle !== 'Damaged' && s.lifecycle !== 'Complete') return false;
  if (s.hp >= s.maxHp) return false;
  if (s.repairPending) return false;

  const map = getMap(state);
  const basePos = { x: map.base.x, y: map.base.y };
  const troop = createUnit(state, REPAIR_TROOP_ID, 1, { x: basePos.x, y: basePos.y }, 'ground', 'defender');
  if (!state.units.has(troop.id)) state.units.set(troop.id, troop);
  troop.isRepairTroop = true;
  troop.repairTargetId = s.id;
  troop.state = 'repairMarch';
  troop.dps = 0;
  troop.targetId = null;
  troop.targetsBase = false;

  // Path from base to the structure (or an adjacent open cell if the footprint blocks walkers).
  const nav = buildNavGrid(map, liveStructures(state));
  let path = findWalkerPath(nav, basePos, { x: s.pos.x, y: s.pos.y });
  if (!path) {
    const neighbors = [
      { x: s.pos.x - 1, y: s.pos.y },
      { x: s.pos.x + ((s.footprint && s.footprint.w) || 1), y: s.pos.y },
      { x: s.pos.x, y: s.pos.y - 1 },
      { x: s.pos.x, y: s.pos.y + ((s.footprint && s.footprint.h) || 1) }
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= map.cols || n.y >= map.rows) continue;
      const p = findWalkerPath(nav, basePos, n);
      if (p) { path = p; break; }
    }
  }
  troop.path = path || [{ x: s.pos.x, y: s.pos.y }];
  troop.pathIdx = 0;

  s.repairPending = true;
  emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'repairDispatch', troopId: troop.id });
  return true;
}

function marchAlong(unit, dt) {
  if (!unit.path || unit.path.length === 0) return true;
  if (unit.pathIdx == null) unit.pathIdx = 0;
  let remaining = (unit.speed || 1.5) * dt;
  while (remaining > 0 && unit.pathIdx < unit.path.length) {
    const wp = unit.path[unit.pathIdx];
    const dx = wp.x - unit.pos.x;
    const dy = wp.y - unit.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= remaining || d < 1e-9) {
      unit.pos.x = wp.x;
      unit.pos.y = wp.y;
      unit.pathIdx++;
      remaining -= d;
    } else {
      unit.pos.x += (dx / d) * remaining;
      unit.pos.y += (dy / d) * remaining;
      remaining = 0;
    }
  }
  return unit.pathIdx >= unit.path.length;
}

function distToStructure(unit, s) {
  const w = (s.footprint && s.footprint.w) || 1;
  const h = (s.footprint && s.footprint.h) || 1;
  const cx = s.pos.x + (w - 1) / 2;
  const cy = s.pos.y + (h - 1) / 2;
  const dx = cx - unit.pos.x;
  const dy = cy - unit.pos.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function stepStructures(state, dt) {
  const structs = Array.from(state.structures.values());
  const toRemove = [];
  let pathDirty = false;

  for (const s of structs) {
    let def;
    try {
      def = getStructureDef(s.structId);
    } catch (e) {
      continue;
    }
    if (s.lifecycle === 'Placing') {
      s.lifecycle = 'Building';
      s.progress = 0;
    }
    if (s.lifecycle === 'Building') {
      s.progress += def.buildTime > 0 ? dt / def.buildTime : 1;
      if (s.progress >= 1) {
        s.progress = 1;
        s.lifecycle = 'Complete';
        s.hp = s.maxHp;
        emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'complete', pos: { x: s.pos.x, y: s.pos.y } });
      }
    } else if (s.lifecycle === 'Upgrading') {
      s.progress += def.upgradeTime > 0 ? dt / def.upgradeTime : 1;
      if (s.progress >= 1) {
        const frac = s.maxHp > 0 ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 1;
        s.tier = Math.min(3, s.tier + 1);
        s.maxHp = def.hp[s.tier - 1];
        s.hp = frac * s.maxHp;
        s.dps = def.dps[s.tier - 1];
        s.progress = 0;
        s.lifecycle = s.hp >= s.maxHp ? 'Complete' : 'Damaged';
        emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'upgradeComplete', tier: s.tier });
      }
    } else if (s.lifecycle === 'Selling') {
      s.progress += def.sellTime > 0 ? dt / def.sellTime : 1;
      if (s.progress >= 1) {
        const value = getSellValue(s, STRUCTURES, ASSUMPTIONS);
        refund(state, value, 'sell:' + s.structId);
        emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'sold', refund: value, pos: { x: s.pos.x, y: s.pos.y } });
        toRemove.push(s);
      }
    } else if (s.lifecycle === 'Destroyed') {
      emitEvent(state, { type: 'build', tick: state.tick, id: s.id, structId: s.structId, phase: 'destroyed', pos: { x: s.pos.x, y: s.pos.y } });
      toRemove.push(s);
    }
  }

  for (const s of toRemove) {
    state.structures.delete(s.id);
    pathDirty = true;   // any removed structure re-opens cells → walkers can reroute through them
  }

  // Repair troops: march to structure, then heal it over time.
  for (const u of Array.from(state.units.values())) {
    if (!u.isRepairTroop) continue;
    const target = state.structures.get(u.repairTargetId);
    if (!target || target.lifecycle === 'Destroyed' || target.lifecycle === 'Selling') {
      if (target) target.repairPending = false;
      state.units.delete(u.id);
      continue;
    }
    if (u.hp <= 0) {
      target.repairPending = false;
      state.units.delete(u.id);
      continue;
    }
    if (u.state === 'repairMarch') {
      const arrivedPath = marchAlong(u, dt);
      if (arrivedPath || distToStructure(u, target) <= 1.25) {
        u.state = 'repairing';
        emitEvent(state, { type: 'build', tick: state.tick, id: target.id, structId: target.structId, phase: 'repairStart', troopId: u.id });
      }
    } else if (u.state === 'repairing') {
      let def;
      try {
        def = getStructureDef(target.structId);
      } catch (e) {
        target.repairPending = false;
        state.units.delete(u.id);
        continue;
      }
      const duration = def.buildTime > 0 ? def.buildTime : 3;
      const rate = target.maxHp / duration;
      target.hp = Math.min(target.maxHp, target.hp + rate * dt);
      if (target.hp >= target.maxHp) {
        target.hp = target.maxHp;
        if (target.lifecycle === 'Damaged') target.lifecycle = 'Complete';
        target.repairPending = false;
        state.units.delete(u.id);
        emitEvent(state, { type: 'build', tick: state.tick, id: target.id, structId: target.structId, phase: 'repaired' });
      }
    }
  }

  if (pathDirty) {
    recomputeUnitPaths(state);
  }
}