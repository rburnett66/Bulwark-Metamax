/**
 * src/gallery/lane.js — GAUNTLET: one attacker paths spawn→base past one defense,
 * on the REAL sim (createSim/stepSim — movement, pathfinding, tower fire, kills).
 *
 * Measures what the balance work needs per matchup:
 *   - target acquisition time (tower first locks the unit) + the distance it locked at
 *   - dps received / total damage taken / time under fire
 *   - dps dealt (structure + base hp deltas, balanceSim-style)
 *   - survivability: reached the base (hp remaining) vs died (distance covered)
 *
 * Also carries the LAND-MINE M0 prototype (MINE_SPEC + trigger/blast logic) per
 * docs/16 Bulwark MM/design/Land-Mine-Design.md — the reference implementation
 * until Epic M1 moves it into the sim proper. Damage flows through the real
 * applyDamage so effectiveness/events stay honest.
 *
 * Headless-safe: lane.test.mjs runs this under node --test. Deterministic —
 * fixed seed, no wall-clock, no Math.random.
 */

import { MAP, STRUCTURES, UNITS, getUnitDef } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';
import { applyDamage } from '../sim/combat.js';
import { recomputeUnitPaths } from '../sim/pathfinding.js';
import { placeCompletedStructure, ensureUnitPath } from '../sim/balanceSim.js';

/** LAND-MINE prototype constants (design rev 1). "Same damage as the base turret for now":
 *  the burst reads the live Cannon T1 dps so cannon retunes carry through automatically. */
export const MINE_SPEC = Object.freeze({
  damage: STRUCTURES['STR-Cannon'].dps[0],   // 45 — one-shot burst
  damageType: STRUCTURES['STR-Cannon'].damageType,   // Kinetic (design Q2: A/B Concussion here)
  triggerRadius: 0.45,                       // tiles from the buried dot
  blastRadius: 1.0,                          // AoE around the trigger point
});

/** The matrix the owner asked for: cannon T1-3, anti-air T1-3, land mine (+ a no-defense control). */
export const GAUNTLET_DEFENSES = Object.freeze([
  Object.freeze({ key: 'none', label: 'No defense' }),
  Object.freeze({ key: 'cannon1', structId: 'STR-Cannon', tier: 1, label: 'Cannon T1' }),
  Object.freeze({ key: 'cannon2', structId: 'STR-Cannon', tier: 2, label: 'Cannon T2' }),
  Object.freeze({ key: 'cannon3', structId: 'STR-Cannon', tier: 3, label: 'Cannon T3' }),
  Object.freeze({ key: 'flak1', structId: 'STR-Flak', tier: 1, label: 'Flak T1' }),
  Object.freeze({ key: 'flak2', structId: 'STR-Flak', tier: 2, label: 'Flak T2' }),
  Object.freeze({ key: 'flak3', structId: 'STR-Flak', tier: 3, label: 'Flak T3' }),
  Object.freeze({ key: 'mine', mine: true, label: 'Land mine (M0)' }),
]);

const DEFAULT_SLOT = 6;          // MAP.slots[6] = (30,14): mid-lane on the ground corridor
const MAX_SECONDS = 240;         // slowest roster walker (0.312 t/s) needs ~186s to cross

function laneFor(domain) {
  if (domain === 'Flyer') return 'air';
  if (domain === 'Floater' || domain === 'Swimmer') return 'water';
  return 'ground';
}
function spawnFor(lane) {
  if (lane === 'air') return MAP.spawnAir;
  if (lane === 'water') return MAP.spawnWater;
  return MAP.spawnGround;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance to the nearest base FOOTPRINT cell — 'reached' means physical contact
 *  (the same footprint-reach rule stepMovement uses to open fire on the base). */
function baseFootprintDist(pos) {
  const cells = MAP.base.cells || [MAP.base];
  let best = Infinity;
  for (const c of cells) best = Math.min(best, dist(pos, c));
  return best;
}

/**
 * Run one gauntlet. defense = an entry of GAUNTLET_DEFENSES (or a compatible
 * {structId,tier} / {mine:true}). Deterministic for a given (unitId, tier, defense, seed).
 * Returns { outcome, time, metrics..., trace } — trace is sampled {x,y,hp} for the viewer.
 *
 * The mine defense runs a SCOUT pass first (same seed, no defense) to record the
 * route the sim's router ACTUALLY gives this unit, and buries the mine on that
 * route at ~60% — unit.path at t0 is not authoritative (round-robin rerouting).
 */
export function runGauntlet(opts) {
  if (opts.defense && opts.defense.mine && !opts._minePos) {
    const scout = runGauntlet({ ...opts, defense: GAUNTLET_DEFENSES[0], collectTrace: true });
    const tr = scout.trace && scout.trace.length ? scout.trace : [{ x: MAP.base.x, y: MAP.base.y }];
    const at = tr[Math.min(tr.length - 1, Math.floor(tr.length * 0.6))];
    return runGauntlet({ ...opts, _minePos: { x: at.x, y: at.y } });
  }
  const { unitId, tier = 1, defense = GAUNTLET_DEFENSES[0], seed = 1, slotIndex = DEFAULT_SLOT, collectTrace = false } = opts;
  const unitDef = getUnitDef(unitId);   // throws on unknown id
  const state = createSim(seed >>> 0, { waves: [], map: MAP });
  // The BASE SUPER-CANNON is out of scope for a LANE measurement: its _still threshold (0.03
  // tiles/tick ≈ 0.9 t/s) reads every roster artillery/heavy-tank as "stationary" and snipes them
  // MID-MARCH (see MetaMax finding ticket). The gauntlet ends at the doorstep, so the base's own
  // deterrent is disabled — the run measures the picked defense, nothing else.
  if (state.base) state.base.cannon = null;

  // ── defense fixture ──
  let tower = null;
  if (defense && defense.structId) {
    const def = STRUCTURES[defense.structId];
    const t = Math.min(3, Math.max(1, (defense.tier || 1) | 0));
    tower = placeCompletedStructure(state, defense.structId, MAP.slots[slotIndex]);
    tower.tier = t;
    tower.hp = def.hp[t - 1];
    tower.maxHp = tower.hp;
    recomputeUnitPaths(state);
  }

  // ── attacker ──
  const lane = laneFor(unitDef.domain);
  const spawn = spawnFor(lane);
  const unit = createUnit(state, unitId, tier, { x: spawn.x, y: spawn.y }, lane, 'attacker');
  if (!state.units.has(unit.id)) state.units.set(unit.id, unit);
  ensureUnitPath(state, unit, lane, spawn);

  // ── TUNING OVERRIDES (sandbox): the gallery's live edits, applied to the spawned entity.
  // The sim reads entity fields, so overridden stats run through the REAL combat/movement code —
  // only the values are sandboxed. Copy a keeper into tables.js via the retune diff.
  const edits = opts.edits || null;
  if (edits) {
    if (edits.hp !== undefined && isFinite(edits.hp) && edits.hp > 0) { unit.hp = edits.hp; unit.maxHp = edits.hp; }
    for (const k of ['dps', 'speed', 'range', 'damageType', 'aoeRadius']) {
      if (edits[k] !== undefined) unit[k] = edits[k];
    }
  }

  // ── mine fixture (M0 prototype): buried on the scouted route (see above) ──
  const mine = opts._minePos
    ? { pos: { x: opts._minePos.x, y: opts._minePos.y }, armed: true, triggeredAt: null, dealt: 0 }
    : null;

  // ── measured loop ──
  const baseHp0 = state.base.hp;
  const towerHp0 = tower ? tower.hp : 0;
  const maxTicks = Math.ceil(MAX_SECONDS / FIXED_DT);
  let prevHp = unit.hp, prevPos = { x: unit.pos.x, y: unit.pos.y };
  let damageTaken = 0, firstHitT = null, lastHitT = null, traveled = 0;
  let tAcquire = null, acquireDist = null;
  let outcome = 'timeout';
  const trace = collectTrace ? [] : null;

  for (let tk = 0; tk < maxTicks; tk++) {
    stepSim(state, FIXED_DT);
    const live = state.units.get(unit.id);

    // mine trigger — the M0 prototype step (design: ground-only, one shot, blast radius)
    if (mine && mine.armed && live && live.hp > 0 && live.domain !== 'Flyer' &&
        dist(live.pos, mine.pos) <= MINE_SPEC.triggerRadius) {
      mine.armed = false;
      mine.triggeredAt = state.time;
      for (const u of state.units.values()) {   // blast: every ground attacker in radius (asc id = map order)
        if (u.side !== 'attacker' || u.hp <= 0 || u.domain === 'Flyer') continue;
        if (dist(u.pos, mine.pos) > MINE_SPEC.blastRadius) continue;
        const r = applyDamage(state, null, u, MINE_SPEC.damage, MINE_SPEC.damageType, 1);   // dt=1 → raw burst
        mine.dealt += r.dealt;
        if (r.killed) state.units.delete(u.id);
      }
    }

    if (live) {
      traveled += dist(live.pos, prevPos);
      prevPos = { x: live.pos.x, y: live.pos.y };
      if (live.hp < prevHp - 1e-9) {
        damageTaken += prevHp - live.hp;
        if (firstHitT === null) firstHitT = state.time;
        lastHitT = state.time;
      }
      prevHp = live.hp;
    }
    if (tower && tAcquire === null && tower.targetId === unit.id) {
      tAcquire = state.time;
      acquireDist = live ? dist(tower.pos, live.pos) : null;
    }
    if (trace && (tk % 3 === 0)) trace.push({ x: prevPos.x, y: prevPos.y, hp: live ? live.hp : 0 });

    if (!live || live.hp <= 0) { outcome = 'died'; break; }
    // 'reached' = physical base contact (footprint reach, same rule stepMovement fires on) or any
    // base damage. NOT base-hp-only: passive base repair (+8/s) out-heals weak hitters forever, and
    // a unit parked at the wall long enough eats the base super-cannon — the gauntlet measures the
    // LANE, so the run ends at the doorstep.
    if (state.base.hp < baseHp0 - 1e-9 ||
        baseFootprintDist(live.pos) <= Math.max(live.range || 0.5, 1.4) + 0.05) { outcome = 'reached'; break; }
    if (state.result) { outcome = 'reached'; break; }
  }

  const liveEnd = state.units.get(unit.id);
  const hpLeft = liveEnd ? Math.max(0, liveEnd.hp) : 0;
  const underFire = (firstHitT !== null) ? Math.max(FIXED_DT, (lastHitT - firstHitT) + FIXED_DT) : 0;
  const towerLive = tower ? state.structures.get(tower.id) : null;
  const dpsDealt = ((towerHp0 - (towerLive ? Math.max(0, towerLive.hp) : (tower ? 0 : 0))) +
                    (baseHp0 - Math.max(0, state.base.hp))) / Math.max(state.time, FIXED_DT);

  return {
    unitId, tier, defense: defense ? (defense.key || defense.structId || 'custom') : 'none',
    outcome,
    time: Math.round(state.time * 100) / 100,
    tAcquire: tAcquire === null ? null : Math.round(tAcquire * 100) / 100,
    acquireDist: acquireDist === null ? null : Math.round(acquireDist * 100) / 100,
    damageTaken: Math.round(damageTaken * 10) / 10,
    dpsReceived: underFire > 0 ? Math.round((damageTaken / underFire) * 10) / 10 : 0,
    timeUnderFire: Math.round(underFire * 100) / 100,
    hpLeft: Math.round(hpLeft * 10) / 10,
    hpFrac: Math.round((hpLeft / Math.max(1, unit.maxHp)) * 1000) / 1000,
    traveled: Math.round(traveled * 100) / 100,
    dpsDealt: Math.round(dpsDealt * 10) / 10,
    mine: mine ? { triggered: mine.triggeredAt !== null, at: mine.triggeredAt, dealt: Math.round(mine.dealt * 10) / 10, pos: mine.pos } : null,
    trace,
  };
}

/** The owner's matrix: every defense config for one attacker+tier. Deterministic. */
export function runGauntletMatrix(unitId, tier = 1, seed = 1, edits = null) {
  return GAUNTLET_DEFENSES.map((d) => runGauntlet({ unitId, tier, defense: d, seed, edits: edits || undefined }));
}

/**
 * Faction sweep — the counter-matrix reality check: every unit of a faction ×
 * every defense config, compacted for the grid view. Table stats only (no
 * edits): this is the overview a tune gets compared against.
 */
export function runFactionSweep(faction, tier = 1, seed = 1) {
  const ids = Object.keys(UNITS).filter((id) => UNITS[id].faction === faction);
  return ids.map((unitId) => ({
    unitId,
    shape: UNITS[unitId].shape,
    domain: UNITS[unitId].domain,
    runs: GAUNTLET_DEFENSES.map((d) => {
      const r = runGauntlet({ unitId, tier, defense: d, seed });
      return { defense: d.key, outcome: r.outcome, hpFrac: r.hpFrac, time: r.time, traveled: r.traveled };
    }),
  }));
}
