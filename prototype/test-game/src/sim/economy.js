// src/sim/economy.js
// Real-time economy for the Bulwark vertical slice.
// Responsibilities:
//   - live money accrual (fixed-timestep deterministic)
//   - kill -> income events
//   - spend on build / upgrade (repairs are free money-wise; they consume troop travel time)
//   - sell partial refund
//   - bankruptcy detection
//   - troop deployment cost + spawn-at-base / march-to-drop-destination orders
// All balance numbers are read from the data tables (src/data/tables.js) — nothing hardcoded
// except last-resort fallbacks used only if a table entry is missing.

import * as TablesMod from '../data/tables.js';
import * as Entities from './entities.js';
import * as Pathing from './pathing.js';

const TABLES =
  TablesMod.TABLES ||
  TablesMod.Tables ||
  TablesMod.tables ||
  TablesMod.default ||
  TablesMod;

// ---------------------------------------------------------------------------
// Table access helpers (defensive against naming variants in the data file)
// ---------------------------------------------------------------------------

function assumptionsTable() {
  return (TABLES && (TABLES.Assumptions || TABLES.assumptions || TABLES.ASSUMPTIONS)) || null;
}

function unitTable() {
  return (TABLES && (TABLES.Units || TABLES.units || TABLES.UNITS)) || null;
}

function structureTable() {
  return (TABLES && (TABLES.Structures || TABLES.structures || TABLES.STRUCTURES)) || null;
}

export function getAssumption(name, fallback) {
  const A = assumptionsTable();
  if (!A) return fallback;
  if (Array.isArray(A)) {
    for (let i = 0; i < A.length; i++) {
      const row = A[i];
      if (!row) continue;
      const key = row.Parameter || row.parameter || row.name || row.Name || row.key || row.id;
      if (key === name) {
        const v = Number(row.Value != null ? row.Value : row.value);
        if (isFinite(v)) return v;
      }
    }
    return fallback;
  }
  if (A[name] != null) {
    const v = Number(A[name].Value != null ? A[name].Value : A[name]);
    if (isFinite(v)) return v;
  }
  return fallback;
}

function num(row, keys) {
  if (!row) return NaN;
  for (let i = 0; i < keys.length; i++) {
    const v = row[keys[i]];
    if (v != null) {
      const n = Number(v);
      if (isFinite(n)) return n;
    }
  }
  return NaN;
}

function tableRows(table) {
  if (!table) return [];
  if (Array.isArray(table)) return table;
  const out = [];
  for (const k in table) {
    if (Object.prototype.hasOwnProperty.call(table, k)) out.push(table[k]);
  }
  return out;
}

export function findRow(table, id) {
  if (!table || id == null) return null;
  if (!Array.isArray(table) && table[id]) return table[id];
  const rows = tableRows(table);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rid =
      row.UnitID || row.unitId || row.unitID ||
      row.StructID || row.structId || row.structID ||
      row.id || row.ID || row.key ||
      row.Name || row.name;
    if (rid === id) return row;
  }
  return null;
}

function rowCost(row, tier) {
  if (!row) return NaN;
  // array-style cost: cost:[t1,t2,t3]
  const arr = row.cost || row.costs || row.Cost;
  if (Array.isArray(arr)) {
    const v = Number(arr[Math.min(Math.max(tier, 1), arr.length) - 1]);
    if (isFinite(v)) return v;
  }
  let keys;
  if (tier >= 3) keys = ['costT3', 'CostT3', 'Cost T3', 'cost_t3', 'cost3'];
  else if (tier === 2) keys = ['costT2', 'CostT2', 'Cost T2', 'cost_t2', 'cost2'];
  else keys = ['costT1', 'CostT1', 'Cost T1', 'cost_t1', 'cost1', 'cost', 'Cost', 'price', 'Price'];
  let v = num(row, keys);
  if (isFinite(v)) return v;
  // derive from power budget: cost = power * gold-per-power * tier multiplier
  const power = num(row, ['power', 'Power']);
  if (isFinite(power)) {
    const cpp = getAssumption('Cost_per_power_gold', 3);
    const mult =
      tier >= 3 ? getAssumption('Upgrade_Cost_x_T3', 5) :
      tier === 2 ? getAssumption('Upgrade_Cost_x_T2', 2.5) : 1;
    return power * cpp * mult;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// Public price queries (data-driven)
// ---------------------------------------------------------------------------

export function unitCost(unitId, tier) {
  const c = rowCost(findRow(unitTable(), unitId), tier || 1);
  return isFinite(c) ? Math.round(c) : Infinity;
}

export function structureCost(structId, tier) {
  const c = rowCost(findRow(structureTable(), structId), tier || 1);
  return isFinite(c) ? Math.round(c) : Infinity;
}

// Cost to upgrade one tier: the delta of cumulative tier value.
export function upgradeCost(baseCostT1, fromTier) {
  const m2 = getAssumption('Upgrade_Cost_x_T2', 2.5);
  const m3 = getAssumption('Upgrade_Cost_x_T3', 5);
  if (!isFinite(baseCostT1)) return Infinity;
  if (fromTier <= 1) return Math.round(baseCostT1 * (m2 - 1));
  if (fromTier === 2) return Math.round(baseCostT1 * (m3 - m2));
  return Infinity; // T3 is max tier
}

export function upgradeCostForStructure(structId, fromTier) {
  return upgradeCost(structureCost(structId, 1), fromTier);
}

// Sell partial refund of everything invested so far.
export function sellRefund(totalInvested, refundFraction) {
  const f = refundFraction != null ? refundFraction : getAssumption('Sell_refund_fraction', 0.5);
  if (!isFinite(totalInvested)) return 0;
  return Math.max(0, Math.round(totalInvested * f));
}

// Repairs are FREE money-wise (they consume troop travel + time, handled by structures.js).
export function repairCost() {
  return 0;
}

let _cheapestCache = null;
export function cheapestActionCost() {
  if (_cheapestCache != null) return _cheapestCache;
  let min = Infinity;
  const tables = [unitTable(), structureTable()];
  for (let t = 0; t < tables.length; t++) {
    const rows = tableRows(tables[t]);
    for (let i = 0; i < rows.length; i++) {
      const c = rowCost(rows[i], 1);
      if (isFinite(c) && c > 0 && c < min) min = c;
    }
  }
  if (!isFinite(min)) min = 100;
  _cheapestCache = Math.round(min);
  return _cheapestCache;
}

// ---------------------------------------------------------------------------
// Economy state
// ---------------------------------------------------------------------------

export function createEconomy(opts) {
  opts = opts || {};
  return {
    money: Math.round(
      opts.startMoney != null
        ? opts.startMoney
        : getAssumption('Start_Money', getAssumption('Starting_Gold', 1200))
    ),
    incomeRate:
      opts.incomeRate != null
        ? opts.incomeRate
        : getAssumption('Income_per_sec', getAssumption('Gold_per_sec', 12)),
    killFraction:
      opts.killFraction != null
        ? opts.killFraction
        : getAssumption('Kill_income_fraction', 0.5),
    sellFraction:
      opts.sellFraction != null
        ? opts.sellFraction
        : getAssumption('Sell_refund_fraction', 0.5),
    fractional: 0,      // sub-gold accumulator so money stays an integer
    time: 0,            // sim-seconds elapsed
    totalEarned: 0,
    totalSpent: 0,
    kills: 0,
    killIncome: 0,
    bankrupt: false,
    bankruptSince: -1,  // sim time at which bankruptcy started, -1 if solvent
    deltas: [],         // recent {amount, reason, time} for HUD readout
    events: []          // ordered economy events for the battle log (drained by core)
  };
}

function pushDelta(econ, amount, reason) {
  econ.deltas.push({ amount: amount, reason: reason || '', time: econ.time });
  while (econ.deltas.length > 12) econ.deltas.shift();
}

function pushEvent(econ, ev) {
  ev.time = econ.time;
  econ.events.push(ev);
}

// Drain queued economy events into the battle log (called by core each step).
export function drainEvents(econ) {
  if (econ.events.length === 0) return [];
  const out = econ.events;
  econ.events = [];
  return out;
}

function updateBankruptcy(econ) {
  const broke = econ.money < cheapestActionCost();
  if (broke && !econ.bankrupt) {
    econ.bankrupt = true;
    econ.bankruptSince = econ.time;
    pushEvent(econ, { type: 'bankrupt', money: econ.money, floor: cheapestActionCost() });
  } else if (!broke && econ.bankrupt) {
    econ.bankrupt = false;
    econ.bankruptSince = -1;
    pushEvent(econ, { type: 'solvent', money: econ.money });
  }
}

export function isBankrupt(econ) {
  return !!econ.bankrupt;
}

// Fixed-timestep accrual. dt is in sim-seconds (deterministic when dt is constant).
export function tickEconomy(econ, dt) {
  econ.time += dt;
  econ.fractional += econ.incomeRate * dt;
  const gained = Math.floor(econ.fractional);
  if (gained > 0) {
    econ.fractional -= gained;
    econ.money += gained;
    econ.totalEarned += gained;
  }
  while (econ.deltas.length && econ.time - econ.deltas[0].time > 3) econ.deltas.shift();
  updateBankruptcy(econ);
  return econ;
}

export const stepEconomy = tickEconomy;

// ---------------------------------------------------------------------------
// Spend / credit primitives
// ---------------------------------------------------------------------------

export function canAfford(econ, amount) {
  const a = Math.round(amount);
  return isFinite(a) && a <= econ.money;
}

export function spend(econ, amount, reason) {
  const a = Math.round(amount);
  if (!isFinite(a) || a < 0) return false;
  if (a > econ.money) {
    pushEvent(econ, { type: 'spend-denied', amount: a, reason: reason || '', money: econ.money });
    return false;
  }
  econ.money -= a;
  econ.totalSpent += a;
  pushDelta(econ, -a, reason);
  pushEvent(econ, { type: 'spend', amount: a, reason: reason || '', money: econ.money });
  updateBankruptcy(econ);
  return true;
}

export function credit(econ, amount, reason) {
  const a = Math.round(amount);
  if (!isFinite(a) || a <= 0) return 0;
  econ.money += a;
  econ.totalEarned += a;
  pushDelta(econ, a, reason);
  pushEvent(econ, { type: 'credit', amount: a, reason: reason || '', money: econ.money });
  updateBankruptcy(econ);
  return a;
}

export const refund = credit;

// ---------------------------------------------------------------------------
// Kill income
// ---------------------------------------------------------------------------

// Called by combat.js (via core) whenever an attacker dies. Returns gold granted.
export function onKill(econ, victim) {
  let base = 0;
  if (victim) {
    if (isFinite(victim.bounty)) base = Number(victim.bounty);
    else if (isFinite(victim.cost)) base = Number(victim.cost);
    else {
      const id = victim.unitId || victim.kind || victim.type || victim.id;
      const c = unitCost(id, victim.tier || 1);
      if (isFinite(c)) base = c;
    }
  }
  const income = Math.max(1, Math.round(base * econ.killFraction));
  econ.kills += 1;
  econ.killIncome += income;
  econ.money += income;
  econ.totalEarned += income;
  pushDelta(econ, income, 'kill');
  pushEvent(econ, {
    type: 'kill-income',
    amount: income,
    victim: victim ? (victim.unitId || victim.kind || victim.type || victim.id || 'unknown') : 'unknown',
    money: econ.money
  });
  updateBankruptcy(econ);
  return income;
}

// ---------------------------------------------------------------------------
// Structure purchase helpers (structures.js does placement geometry; economy
// gates the gold side so all money flows through one ledger)
// ---------------------------------------------------------------------------

export function tryBuyStructure(econ, structId) {
  const cost = structureCost(structId, 1);
  if (!isFinite(cost)) return { ok: false, reason: 'unknown-structure', cost: Infinity };
  if (!canAfford(econ, cost)) return { ok: false, reason: 'insufficient-funds', cost: cost };
  spend(econ, cost, 'build:' + structId);
  return { ok: true, cost: cost };
}

export function tryBuyUpgrade(econ, structId, fromTier) {
  const cost = upgradeCostForStructure(structId, fromTier);
  if (!isFinite(cost)) return { ok: false, reason: 'max-tier', cost: Infinity };
  if (!canAfford(econ, cost)) return { ok: false, reason: 'insufficient-funds', cost: cost };
  spend(econ, cost, 'upgrade:' + structId);
  return { ok: true, cost: cost };
}

export function sellStructure(econ, structId, totalInvested) {
  const back = sellRefund(
    isFinite(totalInvested) ? totalInvested : structureCost(structId, 1),
    econ.sellFraction
  );
  credit(econ, back, 'sell:' + structId);
  return back;
}

// ---------------------------------------------------------------------------
// Troop deployment: paid at deploy time; unit SPAWNS AT THE BASE and receives
// a march order to the chosen drop destination (drop point is a destination,
// NOT a spawn point). Validity: space + terrain + cost.
// ---------------------------------------------------------------------------

function resolveUnitFactory() {
  return (
    Entities.createUnit ||
    Entities.makeUnit ||
    Entities.spawnUnit ||
    Entities.unitFromTable ||
    null
  );
}

function resolvePathFinder() {
  return (
    Pathing.findPath ||
    Pathing.computePath ||
    Pathing.pathFor ||
    Pathing.bfs ||
    null
  );
}

function gridPassable(grid, domain, x, y) {
  if (!grid) return true;
  if (typeof grid.isPassable === 'function') return grid.isPassable(x, y, domain);
  if (typeof grid.passable === 'function') return grid.passable(x, y, domain);
  const d = String(domain || 'Walker').toLowerCase();
  if (d === 'flyer' || d === 'air') return true;
  if (d === 'floater' || d === 'swimmer' || d === 'water') {
    if (typeof grid.isWater === 'function') return !!grid.isWater(x, y);
    return true;
  }
  // walker: not water, not blocked by wall/moat/structure terrain
  let ok = true;
  if (typeof grid.isWater === 'function' && grid.isWater(x, y)) ok = false;
  if (ok && typeof grid.isBlocked === 'function' && grid.isBlocked(x, y)) ok = false;
  return ok;
}

function gridInBounds(grid, x, y) {
  if (!grid) return true;
  if (typeof grid.inBounds === 'function') return grid.inBounds(x, y);
  if (typeof grid.isInBounds === 'function') return grid.isInBounds(x, y);
  const w = grid.width != null ? grid.width : grid.cols;
  const h = grid.height != null ? grid.height : grid.rows;
  if (isFinite(w) && isFinite(h)) return x >= 0 && y >= 0 && x < w && y < h;
  return true;
}

function gridOccupied(grid, x, y) {
  if (!grid) return false;
  if (typeof grid.isOccupied === 'function') return !!grid.isOccupied(x, y);
  if (typeof grid.occupied === 'function') return !!grid.occupied(x, y);
  return false;
}

function basePosition(state) {
  const base =
    (state && state.base) ||
    (state && state.entities && state.entities.base) ||
    null;
  if (!base) return { x: 0, y: 0 };
  const x = base.x != null ? base.x : (base.tileX != null ? base.tileX : (base.tx != null ? base.tx : 0));
  const y = base.y != null ? base.y : (base.tileY != null ? base.tileY : (base.ty != null ? base.ty : 0));
  return { x: x, y: y };
}

// Pure validity check (used by the HUD/input placement preview — no side effects).
export function canDeploy(econ, state, unitId, dropX, dropY) {
  const cost = unitCost(unitId, 1);
  if (!isFinite(cost)) return { ok: false, reason: 'unknown-unit', cost: Infinity };
  if (!canAfford(econ, cost)) return { ok: false, reason: 'insufficient-funds', cost: cost };
  const grid = state ? state.grid : null;
  if (!gridInBounds(grid, dropX, dropY)) return { ok: false, reason: 'out-of-bounds', cost: cost };
  const row = findRow(unitTable(), unitId);
  const domain = (row && (row.Domain || row.domain)) || 'Walker';
  if (!gridPassable(grid, domain, dropX, dropY)) return { ok: false, reason: 'blocked-terrain', cost: cost };
  if (gridOccupied(grid, dropX, dropY)) return { ok: false, reason: 'occupied', cost: cost };
  return { ok: true, cost: cost, domain: domain };
}

// Full deploy: charges gold, spawns the unit at the base, issues a march order
// (with a computed path for walkers/floaters) to the drop destination.
export function deployTroop(econ, state, unitId, dropX, dropY) {
  const check = canDeploy(econ, state, unitId, dropX, dropY);
  if (!check.ok) {
    pushEvent(econ, { type: 'deploy-denied', unitId: unitId, reason: check.reason, cost: check.cost });
    return check;
  }

  const factory = resolveUnitFactory();
  if (typeof factory !== 'function') {
    return { ok: false, reason: 'no-unit-factory', cost: check.cost };
  }
  let unit = null;
  try {
    unit = factory(unitId, state && state.rng);
  } catch (e) {
    unit = null;
  }
  if (!unit) {
    try { unit = factory(unitId); } catch (e2) { unit = null; }
  }
  if (!unit) return { ok: false, reason: 'spawn-failed', cost: check.cost };

  const origin = basePosition(state);
  unit.x = origin.x;
  unit.y = origin.y;
  unit.team = 'player';
  unit.deployed = true;
  unit.state = 'marching';
  unit.dest = { x: dropX, y: dropY };
  if (unit.cost == null) unit.cost = check.cost;

  const domain = unit.domain || check.domain || 'Walker';
  const d = String(domain).toLowerCase();
  if (d !== 'flyer' && d !== 'air') {
    const fp = resolvePathFinder();
    if (fp && state && state.grid) {
      let path = null;
      try {
        path = fp(state.grid, { x: origin.x, y: origin.y }, { x: dropX, y: dropY }, domain);
      } catch (e) {
        path = null;
      }
      if (!path || path.length === 0) {
        pushEvent(econ, { type: 'deploy-denied', unitId: unitId, reason: 'unreachable', cost: check.cost });
        return { ok: false, reason: 'unreachable', cost: check.cost };
      }
      unit.path = path;
      unit.pathIndex = 0;
    }
  }

  // Charge only once everything is valid — no gold lost on failed drops.
  spend(econ, check.cost, 'deploy:' + unitId);

  if (state) {
    if (Array.isArray(state.units)) state.units.push(unit);
    else if (Array.isArray(state.entities)) state.entities.push(unit);
    else if (state.entities && Array.isArray(state.entities.units)) state.entities.units.push(unit);
  }

  pushEvent(econ, {
    type: 'deploy',
    unitId: unitId,
    cost: check.cost,
    from: { x: origin.x, y: origin.y },
    to: { x: dropX, y: dropY }
  });

  return { ok: true, unit: unit, cost: check.cost };
}

// ---------------------------------------------------------------------------
// Serialization (stable subset for the deterministic state hash / replay)
// ---------------------------------------------------------------------------

export function serializeEconomy(econ) {
  return {
    money: econ.money,
    frac: Math.round(econ.fractional * 1e6),
    earned: econ.totalEarned,
    spent: econ.totalSpent,
    kills: econ.kills,
    killIncome: econ.killIncome,
    bankrupt: econ.bankrupt ? 1 : 0
  };
}

export function restoreEconomy(econ, snap) {
  if (!snap) return econ;
  econ.money = snap.money | 0;
  econ.fractional = (snap.frac || 0) / 1e6;
  econ.totalEarned = snap.earned | 0;
  econ.totalSpent = snap.spent | 0;
  econ.kills = snap.kills | 0;
  econ.killIncome = snap.killIncome | 0;
  econ.bankrupt = !!snap.bankrupt;
  return econ;
}