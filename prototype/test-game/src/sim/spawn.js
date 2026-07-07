// src/sim/spawn.js
// Troop/attacker deploy: spawn at base, march to drop destination, deploy validity checks.
//
// This module handles PLAYER-deployed troops (attackers deployed by the player at the base
// that march to a chosen drop location), and provides deploy validity checks reused by
// placement/input systems for structure placement as well.
//
// It reads from config.data.tables (aggregated data) and the strict sim state.
// It never touches rendering; it only mutates sim state through explicit factory calls.

import { makeWalker, makeFloater, makeFlyer } from './entities.js';

//
// ---- Deploy validity ----
//
// A deploy/placement is valid if:
//  - the destination is inside the board bounds
//  - the terrain at the destination permits the entity's domain
//  - the player can afford the cost (checked against economy)
//
// Returns { ok: boolean, reason: string|null }
//

export function checkDeployValidity(state, opts) {
  const { x, y, domain = 'walker', cost = 0, footprint = null } = opts;
  const board = state.board;

  // Board bounds check
  if (!board.inBounds(x, y)) {
    return { ok: false, reason: 'out-of-bounds' };
  }

  // Footprint occupancy check (for structures / walls / moats)
  if (footprint) {
    const cells = footprintCells(x, y, footprint);
    for (const c of cells) {
      if (!board.inBounds(c.x, c.y)) {
        return { ok: false, reason: 'out-of-bounds' };
      }
      if (board.isBlocked && board.isBlocked(c.x, c.y)) {
        return { ok: false, reason: 'terrain-blocked' };
      }
      if (isCellOccupied(state, c.x, c.y)) {
        return { ok: false, reason: 'occupied' };
      }
    }
  } else {
    // Domain-based terrain check for units
    if (!domainAllowsCell(board, domain, x, y)) {
      return { ok: false, reason: 'terrain-blocked' };
    }
  }

  // Cost / affordability check
  if (cost > 0 && state.economy && state.economy.money < cost) {
    return { ok: false, reason: 'insufficient-cost' };
  }

  return { ok: true, reason: null };
}

function domainAllowsCell(board, domain, x, y) {
  const terrain = board.terrainAt ? board.terrainAt(x, y) : null;
  switch (domain) {
    case 'flyer':
      // Flyers ignore ground terrain entirely.
      return true;
    case 'floater':
    case 'swimmer':
      // Water lane only.
      return terrain === 'water';
    case 'walker':
    default:
      // Ground lane; blocked by water / walls / moats.
      if (terrain === 'water') return false;
      if (board.isBlocked && board.isBlocked(x, y)) return false;
      return true;
  }
}

function footprintCells(x, y, footprint) {
  const cells = [];
  const w = footprint.w || 1;
  const h = footprint.h || 1;
  const cx = Math.round(x);
  const cy = Math.round(y);
  const ox = Math.floor(w / 2);
  const oy = Math.floor(h / 2);
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      cells.push({ x: cx - ox + dx, y: cy - oy + dy });
    }
  }
  return cells;
}

function isCellOccupied(state, cx, cy) {
  for (const e of state.entities) {
    if (!e.footprint) continue;
    if (e.state === 'Destroyed') continue;
    const cells = footprintCells(e.x, e.y, e.footprint);
    for (const c of cells) {
      if (c.x === cx && c.y === cy) return true;
    }
  }
  return false;
}

//
// ---- Spawn / deploy ----
//
// Deploy a troop: it SPAWNS at the player base and receives a march order to the
// chosen drop location. The drop point is a destination, not a spawn point.
//
// Returns the created entity, or null if invalid.
//

export function deployTroop(state, unitId, dropX, dropY) {
  const tables = state.config.data.tables;
  const unit = lookupUnit(tables, unitId);
  if (!unit) return null;

  const domain = normalizeDomain(unit.Domain);
  const cost = unit.Cost || unit['Cost T1'] || 0;

  // Validate the drop destination for this domain.
  const check = checkDeployValidity(state, {
    x: dropX,
    y: dropY,
    domain,
    cost,
  });
  if (!check.ok) {
    return { ok: false, reason: check.reason, entity: null };
  }

  // Spend cost through the economy (bankruptcy-safe).
  if (cost > 0 && state.economy) {
    if (!state.economy.spend(cost)) {
      return { ok: false, reason: 'insufficient-cost', entity: null };
    }
  }

  // Spawn at the base clearing.
  const base = state.base;
  const spawn = baseSpawnPoint(state, domain);

  let entity;
  const spec = buildUnitSpec(unit);

  if (domain === 'flyer') {
    entity = makeFlyer(state, spec, spawn.x, spawn.y);
  } else if (domain === 'floater' || domain === 'swimmer') {
    entity = makeFloater(state, spec, spawn.x, spawn.y);
  } else {
    entity = makeWalker(state, spec, spawn.x, spawn.y);
  }

  // Deploy loop: issue a MARCH order toward the drop location (destination order).
  entity.deployed = true;
  entity.dropX = dropX;
  entity.dropY = dropY;
  entity.marchTarget = { x: dropX, y: dropY };

  // Recompute a path for domain-constrained movers (walkers reroute around walls/moats).
  if (state.pathing && (domain === 'walker' || domain === 'floater' || domain === 'swimmer')) {
    entity.path = state.pathing.computePath(state, entity, { x: dropX, y: dropY }, domain);
    entity.pathIndex = 0;
  }

  state.entities.push(entity);

  // Log the deploy event for deterministic replay.
  if (state.log) {
    state.log.event('deploy', {
      id: entity.id,
      unitId,
      spawnX: spawn.x,
      spawnY: spawn.y,
      dropX,
      dropY,
      domain,
      cost,
    });
  }

  return { ok: true, reason: null, entity };
}

//
// ---- March advancement ----
//
// Advance deployed troops toward their drop destination. Once arrived, they follow
// their standard attacker behavior (path to base / attack per combat core). Deployed
// troops are player attackers marching to a drop point; the combat/step system takes
// over movement once the drop is reached.
//

export function advanceDeploys(state, dt) {
  for (const e of state.entities) {
    if (!e.deployed || e.arrivedAtDrop) continue;
    if (e.state === 'Death' || e.hp <= 0) continue;

    const moved = marchStep(state, e, dt);
    if (!moved) {
      // Reached destination.
      e.arrivedAtDrop = true;
      e.marchTarget = null;
      e.animState = 'Idle';
      if (state.log) {
        state.log.event('deploy-arrived', { id: e.id, x: e.x, y: e.y });
      }
    } else {
      e.animState = 'Moving';
    }
  }
}

function marchStep(state, e, dt) {
  // Follow computed path when available (walkers/floaters reroute around terrain).
  if (e.path && e.path.length > 0) {
    return followPath(e, dt);
  }
  // Otherwise straight-line march (flyers ignore terrain).
  return marchStraight(e, e.dropX, e.dropY, dt);
}

function followPath(e, dt) {
  const speed = e.speed || 1;
  let remaining = speed * dt;
  while (remaining > 0 && e.pathIndex < e.path.length) {
    const node = e.path[e.pathIndex];
    const dx = node.x - e.x;
    const dy = node.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= remaining) {
      e.x = node.x;
      e.y = node.y;
      remaining -= dist;
      e.pathIndex++;
    } else {
      const t = remaining / dist;
      e.x += dx * t;
      e.y += dy * t;
      remaining = 0;
    }
  }
  return e.pathIndex < e.path.length;
}

function marchStraight(e, tx, ty, dt) {
  const speed = e.speed || 1;
  const step = speed * dt;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= step || dist === 0) {
    e.x = tx;
    e.y = ty;
    return false;
  }
  const t = step / dist;
  e.x += dx * t;
  e.y += dy * t;
  return true;
}

//
// ---- Helpers ----
//

function baseSpawnPoint(state, domain) {
  const base = state.base;
  // Spawn near the base clearing; flyers/floaters offset toward their lanes.
  if (domain === 'floater' || domain === 'swimmer') {
    const wl = state.board.waterLaneSpawn ? state.board.waterLaneSpawn() : null;
    if (wl) return wl;
  }
  return { x: base.x, y: base.y };
}

function normalizeDomain(d) {
  if (!d) return 'walker';
  const s = String(d).toLowerCase();
  if (s === 'flyer' || s === 'air') return 'flyer';
  if (s === 'floater' || s === 'swimmer' || s === 'water') return 'floater';
  return 'walker';
}

function lookupUnit(tables, unitId) {
  if (!tables || !tables.units) return null;
  if (Array.isArray(tables.units)) {
    return tables.units.find((u) => u.UnitID === unitId || u.id === unitId) || null;
  }
  return tables.units[unitId] || null;
}

function buildUnitSpec(unit) {
  return {
    unitId: unit.UnitID || unit.id,
    kind: unit.Shape || unit.kind || 'Troops',
    domain: normalizeDomain(unit.Domain),
    armorClass: unit['Armor Class'] || unit.armorClass || 'Organic',
    damageType: unit['Damage Type'] || unit.damageType || 'Kinetic',
    canTarget: unit['Can Target'] || unit.canTarget || 'Ground',
    targets: unit.Targets || unit.targets || 'Base',
    targetsBase: (unit.Targets || unit.targets || 'Base') === 'Base',
    hp: unit['HP T1'] != null ? unit['HP T1'] : unit.hp || 100,
    dps: unit['DPS T1'] != null ? unit['DPS T1'] : unit.dps || 10,
    range: unit.Range != null ? unit.Range : unit.range || 1,
    speed: unit.Speed != null ? unit.Speed : unit.speed || 1,
    vision: unit.Vision != null ? unit.Vision : unit.vision || 4,
    aoe: unit['AoE r'] || unit.aoe || 0,
    status: unit.Status || unit.status || '—',
    faction: unit.Faction || unit.faction || 'Ground / Powder',
  };
}