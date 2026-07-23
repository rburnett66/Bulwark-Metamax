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

import { MAP, STRUCTURES, UNITS, EFFECTIVENESS, getUnitDef } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';
import { applyDamage } from '../sim/combat.js';
import { recomputeUnitPaths } from '../sim/pathfinding.js';
import { placeCompletedStructure, ensureUnitPath } from '../sim/balanceSim.js';

/** LAND-MINE spec — now the REAL shipped row (design rev 2, M3.4: prototype retired).
 *  The gauntlet's mine reads STR-Mine so table retunes carry through automatically. */
const MINE_ROW = STRUCTURES['STR-Mine'];
export const MINE_SPEC = Object.freeze({
  damage: MINE_ROW.dps[0],                       // 1500 — one-shot-any-tank burst
  damageType: MINE_ROW.damageType,               // Kinetic
  triggerRadius: MINE_ROW.triggerRadius || 0.45, // tiles from the buried dot
  blastRadius: MINE_ROW.blastRadius || 0.5,      // small AoE around the trigger point
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

/* ────────────────────────────────────────────────────────────────────────────
   FIRING LINE — the owner's original gallery design: ONE lane, a spaced series
   of every tower below it, damage measured PER TOWER against the moving target.
   Towers that can't legally touch the runner read 0 (the counter matrix inline).
   ──────────────────────────────────────────────────────────────────────────── */

/** The line, in pass order along the route. Mine last (it ends a mortal run). */
export const FIRING_LINE = Object.freeze([
  Object.freeze({ structId: 'STR-Cannon', tier: 1, label: 'Cannon T1' }),
  Object.freeze({ structId: 'STR-Cannon', tier: 2, label: 'Cannon T2' }),
  Object.freeze({ structId: 'STR-Cannon', tier: 3, label: 'Cannon T3' }),
  Object.freeze({ structId: 'STR-Flak', tier: 1, label: 'Flak T1' }),
  Object.freeze({ structId: 'STR-Flak', tier: 2, label: 'Flak T2' }),
  Object.freeze({ structId: 'STR-Flak', tier: 3, label: 'Flak T3' }),
  Object.freeze({ mine: true, label: 'Mine (M0)' }),
]);
const LINE_FRACS = [0.12, 0.23, 0.34, 0.45, 0.56, 0.67];   // tower route-fractions; mine at 0.86
const LINE_OFFSET = 2;                                      // tiles BELOW the route (the owner's sketch)

/**
 * One firing-line run. Towers auto-place LINE_OFFSET tiles below the runner's
 * SCOUTED route (so ground/air/water lanes all engage), the mine buries on the
 * route near the end. immortal=true (default) turns the runner into a probe —
 * every tower gets its full pass, and 'wouldDieAt' reports where cumulative
 * damage crosses the unit's REAL hp. immortal=false is a live survivability run.
 * Deterministic; per-tower damage uses the same dps × effectiveness × dt the
 * combat tick applies (cross-checked by tests against actual hp loss).
 */
export function runFiringLine(opts) {
  const { unitId, tier = 1, seed = 1, edits = null, immortal = true, collectTrace = false } = opts;
  const unitDef = getUnitDef(unitId);

  // scout the real route (no defenses) to lay the line along it
  const scout = runGauntlet({ unitId, tier, seed, edits: edits || undefined, defense: GAUNTLET_DEFENSES[0], collectTrace: true });
  const tr = scout.trace && scout.trace.length ? scout.trace : [{ x: MAP.base.x, y: MAP.base.y }];
  const at = (f) => tr[Math.min(tr.length - 1, Math.floor(tr.length * f))];

  const state = createSim(seed >>> 0, { waves: [], map: MAP });
  if (state.base) state.base.cannon = null;               // lane measurement — no base super-cannon

  const towers = [];
  FIRING_LINE.forEach((fix, i) => {
    if (fix.mine) return;
    const p = at(LINE_FRACS[i]);
    const cell = {
      x: Math.max(0, Math.min(MAP.cols - 1, Math.round(p.x))),
      y: Math.max(0, Math.min(MAP.rows - 1, Math.round(p.y) + LINE_OFFSET)),
    };
    const def = STRUCTURES[fix.structId];
    const s = placeCompletedStructure(state, fix.structId, cell);
    s.tier = fix.tier; s.hp = def.hp[fix.tier - 1]; s.maxHp = s.hp;
    towers.push({ fix, cell, s, def, tAcquire: null, lockTicks: 0, damage: 0 });
  });
  recomputeUnitPaths(state);

  const lane = laneFor(unitDef.domain);
  const spawn = spawnFor(lane);
  const unit = createUnit(state, unitId, tier, { x: spawn.x, y: spawn.y }, lane, 'attacker');
  if (!state.units.has(unit.id)) state.units.set(unit.id, unit);
  ensureUnitPath(state, unit, lane, spawn);
  if (edits) {
    if (edits.hp !== undefined && isFinite(edits.hp) && edits.hp > 0) { unit.hp = edits.hp; unit.maxHp = edits.hp; }
    for (const k of ['dps', 'speed', 'range', 'damageType', 'aoeRadius']) if (edits[k] !== undefined) unit[k] = edits[k];
  }
  const realHp = unit.maxHp;                              // 'would die at' measures against THIS
  if (immortal) { unit.hp = 1e9; unit.maxHp = 1e9; }      // probe mode: every tower gets its pass

  const minePos = at(0.86);
  const mine = { pos: { x: minePos.x, y: minePos.y }, armed: true, triggeredAt: null, dealt: 0 };

  const baseHp0 = state.base.hp;
  const maxTicks = Math.ceil(MAX_SECONDS / FIXED_DT);
  let cumDamage = 0, wouldDieAt = null, traveled = 0;
  let prevHp = unit.hp, prevPos = { x: unit.pos.x, y: unit.pos.y };
  let outcome = 'timeout';
  const trace = collectTrace ? [] : null;

  for (let tk = 0; tk < maxTicks; tk++) {
    stepSim(state, FIXED_DT);
    const live = state.units.get(unit.id);

    // per-tower attribution: a locked tower deals dps × effectiveness × dt this tick —
    // the exact formula stepCombat applies, so the split sums to the real hp loss.
    for (const t of towers) {
      if (t.s.targetId !== unit.id || !live || live.hp <= 0) continue;
      if (t.tAcquire === null) t.tAcquire = state.time;
      t.lockTicks++;
      const row = EFFECTIVENESS[t.def.damageType];
      const mult = (row && row[unit.armorClass] !== undefined) ? row[unit.armorClass] : 1;
      t.damage += t.def.dps[t.fix.tier - 1] * mult * FIXED_DT;
    }

    if (mine.armed && live && live.hp > 0 && live.domain !== 'Flyer' &&
        dist(live.pos, mine.pos) <= MINE_SPEC.triggerRadius) {
      mine.armed = false; mine.triggeredAt = state.time;
      const r = applyDamage(state, null, live, MINE_SPEC.damage, MINE_SPEC.damageType, 1);
      mine.dealt = r.dealt;
      if (r.killed) state.units.delete(live.id);
    }

    if (live) {
      traveled += dist(live.pos, prevPos);
      prevPos = { x: live.pos.x, y: live.pos.y };
      if (live.hp < prevHp - 1e-9) cumDamage += prevHp - live.hp;
      prevHp = live.hp;
      if (wouldDieAt === null && cumDamage >= realHp - 1e-9) {
        wouldDieAt = { time: Math.round(state.time * 100) / 100, traveled: Math.round(traveled * 100) / 100 };
      }
      // probe runs trace VIRTUAL hp (real hp minus damage so far) — the viewer's bar must drain,
      // not sit pinned at the 1e9 probe pool ("unit taking no damage", owner remote test)
      if (trace && (tk % 3 === 0)) trace.push({ x: live.pos.x, y: live.pos.y, hp: immortal ? Math.max(0, realHp - cumDamage) : live.hp });
    }

    if (!live || live.hp <= 0) { outcome = 'died'; break; }
    if (state.base.hp < baseHp0 - 1e-9 ||
        baseFootprintDist(live.pos) <= Math.max(live.range || 0.5, 1.4) + 0.05) { outcome = 'reached'; break; }
    if (state.result) { outcome = 'reached'; break; }
  }

  const liveEnd = state.units.get(unit.id);
  return {
    unitId, tier, immortal, outcome,
    time: Math.round(state.time * 100) / 100,
    realHp,
    totalDamage: Math.round(cumDamage * 10) / 10,
    wouldDieAt,                                            // null = survives the whole line on real hp
    hpLeft: immortal ? null : Math.round(Math.max(0, liveEnd ? liveEnd.hp : 0) * 10) / 10,
    traveled: Math.round(traveled * 100) / 100,
    towers: towers.map((t) => ({
      label: t.fix.label, structId: t.fix.structId, tier: t.fix.tier, cell: t.cell,
      tAcquire: t.tAcquire === null ? null : Math.round(t.tAcquire * 100) / 100,
      lockTime: Math.round(t.lockTicks * FIXED_DT * 100) / 100,
      damage: Math.round(t.damage * 10) / 10,
      effDps: t.lockTicks ? Math.round((t.damage / (t.lockTicks * FIXED_DT)) * 10) / 10 : 0,
    })),
    mine: { triggered: mine.triggeredAt !== null, at: mine.triggeredAt, dealt: Math.round(mine.dealt * 10) / 10, pos: mine.pos },
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
