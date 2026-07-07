/**
 * src/sim/balanceSim.js
 * Headless automated balance harness (GDD §17).
 *
 * Runs N seeded battles per unit on the fixed harness board using the SAME
 * deterministic combat core (createSim/stepSim) as live play, deriving an
 * average-DPS-based price and a cross-seed stability report.
 *
 * A harness battle:
 *   - creates a sim with NO waves (empty wave table) on the standard MAP
 *   - places a fixed defender layout (anti-ground + anti-air towers) on the
 *     first hard-point slots, forced to 'Complete' (harness fixtures, not
 *     player purchases)
 *   - spawns ONE copy of the unit under test as an attacker on its domain
 *     lane after a small seed-derived delay (injects cross-seed variation)
 *   - steps the sim at FIXED_DT until the unit dies, the base falls, the
 *     sim resolves, or a hard time cap is reached
 *   - measures damage dealt (base hp loss + defender structure hp loss)
 *     over the unit's active lifetime -> avgDps
 */

import { ASSUMPTIONS, UNITS, STRUCTURES, MAP, getUnitDef } from '../data/tables.js';
import { createRng } from './rng.js';
import {
  buildNavGrid,
  findWalkerPath,
  getWaterPath,
  getFlyerPath,
  recomputeUnitPaths
} from './pathfinding.js';
import { createUnit, createStructure } from './entities.js';
import { createSim, stepSim, FIXED_DT } from './core.js';

// ---------------------------------------------------------------------------
// Harness constants
// ---------------------------------------------------------------------------

const MAX_BATTLE_SECONDS = 180;          // hard cap so a stalled battle terminates
const SEED_STRIDE = 7919;                // prime stride between battle seeds
const SEED_BASE = 1000;                  // first battle seed offset

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Deterministically pick the harness tower types from the structure table. */
function pickHarnessTowers() {
  let antiGround = null;
  let antiAir = null;
  const ids = Object.keys(STRUCTURES);
  for (let i = 0; i < ids.length; i++) {
    const def = STRUCTURES[ids[i]];
    if (!def) continue;
    if (def.kind === 'antiGround' && antiGround === null) antiGround = ids[i];
    if (def.kind === 'antiAir' && antiAir === null) antiAir = ids[i];
  }
  return { antiGround, antiAir };
}

/**
 * Place a harness structure and force it straight to Complete at full hp.
 * These are fixed test fixtures — they bypass the economy on purpose.
 */
function placeCompletedStructure(state, structId, slot) {
  const s = createStructure(state, structId, slot);
  s.lifecycle = 'Complete';
  s.progress = 1;
  s.hp = s.maxHp;
  if (state.structures && typeof state.structures.set === 'function' && !state.structures.has(s.id)) {
    state.structures.set(s.id, s);
  }
  return s;
}

/** Map a unit domain to its spawn lane. */
function laneForDomain(domain) {
  if (domain === 'Flyer') return 'air';
  if (domain === 'Floater') return 'water';
  return 'ground';
}

/** Lane spawn point on the harness board. */
function spawnForLane(lane) {
  if (lane === 'air') return MAP.spawnAir;
  if (lane === 'water') return MAP.spawnWater;
  return MAP.spawnGround;
}

/** Guarantee the test unit has a domain-correct path to the base. */
function ensureUnitPath(state, unit, lane, spawn) {
  if (unit.path && unit.path.length > 0) return;
  const basePos = { x: MAP.base.x, y: MAP.base.y };
  if (lane === 'air') {
    unit.path = getFlyerPath({ x: spawn.x, y: spawn.y }, basePos);
  } else if (lane === 'water') {
    unit.path = getWaterPath(MAP);
  } else {
    const nav = state.navGrid ||
      buildNavGrid(MAP, Array.from(state.structures.values()));
    const from = { x: Math.round(spawn.x), y: Math.round(spawn.y) };
    unit.path = findWalkerPath(nav, from, basePos) || [basePos];
  }
  unit.pathIdx = 0;
}

/**
 * Calibration constant: gold per point of sustained DPS.
 * Derived once from the workbook roster (mean T1 cost / T1 raw DPS) so that
 * sim-derived prices land in the same currency scale as the balance tables.
 * Falls back to the Assumptions conversion if the roster is degenerate.
 */
let _goldPerDps = null;
function goldPerDps() {
  if (_goldPerDps !== null) return _goldPerDps;
  let sum = 0;
  let count = 0;
  const ids = Object.keys(UNITS);
  for (let i = 0; i < ids.length; i++) {
    const def = UNITS[ids[i]];
    if (def && def.dps && def.dps[0] > 0 && def.cost && def.cost[0] > 0) {
      sum += def.cost[0] / def.dps[0];
      count++;
    }
  }
  _goldPerDps = count > 0
    ? sum / count
    : ASSUMPTIONS.costPerPowerGold / ASSUMPTIONS.dpsPerPoint;
  return _goldPerDps;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * One automated headless battle of `unitId` on the fixed harness board.
 * Uses the exact same createSim/stepSim code path as live play.
 *
 * @param {string} unitId
 * @param {number} seed
 * @returns {{avgDps:number, duration:number, kills:number}}
 */
export function runBalanceBattle(unitId, seed) {
  const unitDef = getUnitDef(unitId); // throws on unknown id

  // Empty wave table: the harness drives its own single-unit spawn.
  const state = createSim(seed >>> 0, { waves: [], map: MAP });

  // Harness-local rng for spawn-delay jitter (separate stream from sim rng).
  const harnessRng = createRng(((seed >>> 0) ^ 0x5f356495) >>> 0);

  // --- Fixed defender layout: AG, AA, AG, AA on the first hard-point slots.
  const towers = pickHarnessTowers();
  const wanted = [
    towers.antiGround,
    towers.antiAir,
    towers.antiGround,
    towers.antiAir
  ].filter(function (id) { return id !== null && id !== undefined; });

  const slots = MAP.slots || [];
  const layout = [];
  const nFixtures = Math.min(wanted.length, slots.length);
  for (let i = 0; i < nFixtures; i++) {
    layout.push(placeCompletedStructure(state, wanted[i], slots[i]));
  }
  recomputeUnitPaths(state);

  // --- Small seeded pre-battle delay: injects cross-seed timing variation.
  const delayTicks = harnessRng.nextInt(0, 12);
  for (let t = 0; t < delayTicks; t++) {
    stepSim(state, FIXED_DT);
  }

  // --- Spawn the unit under test on its domain lane.
  const lane = laneForDomain(unitDef.domain);
  const spawn = spawnForLane(lane);
  const unit = createUnit(
    state, unitId, 1, { x: spawn.x, y: spawn.y }, lane, 'attacker'
  );
  if (state.units && typeof state.units.set === 'function' && !state.units.has(unit.id)) {
    state.units.set(unit.id, unit);
  }
  ensureUnitPath(state, unit, lane, spawn);

  // --- Damage accounting baselines.
  const prevStructHp = new Map();
  for (let i = 0; i < layout.length; i++) {
    prevStructHp.set(layout[i].id, Math.max(0, layout[i].hp));
  }
  let prevBaseHp = Math.max(0, state.base.hp);

  let totalDamage = 0;
  let kills = 0;
  const killedIds = new Set();
  const startTime = state.time;
  const maxTicks = Math.ceil(MAX_BATTLE_SECONDS / FIXED_DT);

  // --- Main deterministic battle loop.
  for (let t = 0; t < maxTicks; t++) {
    stepSim(state, FIXED_DT);

    // Defender structure hp deltas (a destroyed structure may be removed
    // from the map; count its remaining hp as dealt damage).
    for (let i = 0; i < layout.length; i++) {
      const sid = layout[i].id;
      const prev = prevStructHp.get(sid);
      if (prev <= 0) continue;
      const live = state.structures.get(sid);
      const cur = live ? Math.max(0, live.hp) : 0;
      if (cur < prev) totalDamage += prev - cur;
      if (cur <= 0 && !killedIds.has(sid)) {
        killedIds.add(sid);
        kills++;
      }
      prevStructHp.set(sid, cur);
    }

    // Base hp delta.
    const curBase = Math.max(0, state.base.hp);
    if (curBase < prevBaseHp) {
      totalDamage += prevBaseHp - curBase;
      prevBaseHp = curBase;
    }

    // Termination conditions.
    const liveUnit = state.units.get(unit.id);
    const unitDead = !liveUnit || liveUnit.hp <= 0;
    if (unitDead || state.base.hp <= 0 || state.result) break;
  }

  if (state.base.hp <= 0) kills++; // base destruction counts as a kill

  const duration = Math.max(state.time - startTime, FIXED_DT);
  return {
    avgDps: totalDamage / duration,
    duration: duration,
    kills: kills
  };
}

/**
 * Average DPS over `battles` seeded harness runs -> derived price.
 * Fixed deterministic seed sequence (shared across all units so every unit
 * is measured on the same seed set), demonstrating cross-seed stability via
 * the returned standard deviation.
 *
 * @param {string} unitId
 * @param {number} [battles=100]
 * @returns {{unitId:string, avgDps:number, price:number, stddev:number}}
 */
export function computeUnitPrice(unitId, battles) {
  const n = Math.max(1, (battles === undefined || battles === null) ? 100 : (battles | 0));
  const samples = new Array(n);

  for (let i = 0; i < n; i++) {
    const seed = (SEED_BASE + i * SEED_STRIDE) >>> 0;
    samples[i] = runBalanceBattle(unitId, seed).avgDps;
  }

  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i];
  const avgDps = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = samples[i] - avgDps;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const price = Math.round(avgDps * goldPerDps());

  return {
    unitId: unitId,
    avgDps: round2(avgDps),
    price: price,
    stddev: round2(stddev)
  };
}

/**
 * Batch pricing report: sim-derived price vs workbook table price for each
 * unit. Invoked from the HUD debug button; also logs to the console.
 *
 * @param {string[]} [unitIds]  defaults to the full roster
 * @param {number}   [battles]  battles per unit (default 25 for interactive
 *                              use; pass 100 for the full §17 pass)
 * @returns {Array<{unitId:string, avgDps:number, price:number, tablePrice:number, delta:number}>}
 */
export function runPricingReport(unitIds, battles) {
  const ids = (unitIds && unitIds.length > 0) ? unitIds : Object.keys(UNITS);
  const n = (battles === undefined || battles === null) ? 25 : Math.max(1, battles | 0);

  const rows = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const def = UNITS[id];
    if (!def) continue;

    const priced = computeUnitPrice(id, n);
    const tablePrice = (def.cost && def.cost.length > 0) ? def.cost[0] : 0;

    rows.push({
      unitId: id,
      avgDps: priced.avgDps,
      price: priced.price,
      tablePrice: tablePrice,
      delta: priced.price - tablePrice
    });
  }

  /* eslint-disable no-console */
  if (typeof console !== 'undefined') {
    console.log(
      '[BalanceSim] Pricing report — ' + rows.length + ' unit(s), ' +
      n + ' battle(s) each, goldPerDps=' + round2(goldPerDps())
    );
    if (typeof console.table === 'function') {
      console.table(rows);
    } else {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        console.log(
          '  ' + r.unitId +
          '  avgDps=' + r.avgDps +
          '  simPrice=' + r.price +
          '  tablePrice=' + r.tablePrice +
          '  delta=' + (r.delta >= 0 ? '+' : '') + r.delta
        );
      }
    }
  }
  /* eslint-enable no-console */

  return rows;
}

// ---------------------------------------------------------------------------
// Global namespace attachment (offline, no-bundler build)
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.Bulwark = window.Bulwark || {};
  window.Bulwark.sim = window.Bulwark.sim || {};
  window.Bulwark.sim.runBalanceBattle = runBalanceBattle;
  window.Bulwark.sim.computeUnitPrice = computeUnitPrice;
  window.Bulwark.sim.runPricingReport = runPricingReport;
}