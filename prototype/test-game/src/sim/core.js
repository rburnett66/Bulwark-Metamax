import { ASSUMPTIONS, WAVES, MAP, getUnitDef } from '../data/tables.js';
import { createRng } from './rng.js';
import { buildNavGrid, findWalkerPath, getFlyerPath, getWaterPath } from './pathfinding.js';
import { createUnit, createBase } from './entities.js';
import { acquireTarget, applyDamage, stepCombat } from './combat.js';
import { initEconomy, stepEconomy, canAfford, spend } from './economy.js';
import { validatePlacement, placeStructure, startUpgrade, startSell, requestRepair, stepStructures } from './structures.js';
import { initWaves, startNextWave, stepWaves } from './waves.js';
import { createLog, recordCommand } from './replay.js';

/**
 * Fixed simulation timestep in seconds. The sim ONLY advances in these
 * increments; the render loop accumulates real time and calls stepSim
 * zero or more times per frame. This is the root of determinism.
 */
export const FIXED_DT = 1 / 30;

/* ------------------------------------------------------------------ */
/* Helpers (pure, local)                                               */
/* ------------------------------------------------------------------ */

function roundCell(pos) {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

function dist(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the Final Score presented when the game ends (final wave
 * cleared or base destroyed). Points for kills; minus points for each
 * minute and second played; minus points for all gold spent; bonus for
 * remaining gold. Also records the elapsed time breakdown for display.
 */
function computeFinalScore(state) {
  const eco = state.economy || {};
  const kills = (eco.kills != null ? eco.kills : (state.kills != null ? state.kills : (eco.totalKills || 0)));
  const goldSpent = (eco.totalSpent != null ? eco.totalSpent : (state.goldSpent || 0));
  // The live balance is eco.money (economy.js), NOT eco.gold — reading eco.gold made remaining gold
  // score as 0 even with a positive balance. Floor to whole gold for an integer score.
  const goldRemaining = Math.max(0, Math.floor(eco.money != null ? eco.money : (eco.gold != null ? eco.gold : 0)));

  const totalSeconds = Math.max(0, Math.floor(state.time || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const KILL_POINTS = 100;
  const MINUTE_PENALTY = 60;
  const SECOND_PENALTY = 1;
  const GOLD_SPENT_PENALTY = 1;
  const GOLD_REMAINING_BONUS = 1;   // +1 point per +1 gold remaining (owner)

  const score =
    kills * KILL_POINTS
    - minutes * MINUTE_PENALTY
    - seconds * SECOND_PENALTY
    - goldSpent * GOLD_SPENT_PENALTY
    + goldRemaining * GOLD_REMAINING_BONUS;

  return {
    score: score,
    kills: kills,
    minutes: minutes,
    seconds: seconds,
    totalSeconds: totalSeconds,
    goldSpent: goldSpent,
    goldRemaining: goldRemaining
  };
}

/**
 * Finalize the game: compute + store the final score exactly once when a
 * result is set (final wave cleared or base destroyed). Idempotent.
 */
function finalizeGame(state) {
  if (!state.result) return;
  if (state.finalScore == null) {
    state.finalScore = computeFinalScore(state);
    emitEvent(state, { type: 'finalScore', tick: state.tick, finalScore: state.finalScore });
  }
}

function laneForDomain(domain) {
  if (domain === 'Flyer') return 'air';
  if (domain === 'Floater') return 'water';
  return 'ground';
}

/* ------------------------------------------------------------------ */
/* createSim                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build a fresh, fully deterministic SimState from a seed.
 * Zero rendering concerns live here; the state is a plain data bag
 * that every sibling sim module reads/mutates through its interface.
 */
export function createSim(seed, opts) {
  const options = opts || {};
  const map = options.map || MAP;
  const waveTable = options.waves || WAVES;

  const state = {
    tick: 0,
    time: 0,
    seed: seed,
    rng: createRng(seed),
    map: map,
    waveTable: waveTable,
    base: null,
    units: new Map(),
    structures: new Map(),
    economy: initEconomy(ASSUMPTIONS),
    waves: initWaves(waveTable),
    navGrid: null,
    events: [],
    result: null,
    finalScore: null,
    goldSpent: 0,
    selectedId: null,
    hudState: 'idle',
    log: createLog(seed),
    // deterministic monotonically increasing id source consumed by
    // entities.nextEntityId(state)
    nextId: 1,
    entityIdCounter: 0,
    _resultEmitted: false
  };

  state.base = createBase(map);
  state.navGrid = buildNavGrid(map, []);
  // cache the fixed water lane so waves/deploys can reuse it without recompute
  state.waterPath = getWaterPath(map);

  return state;
}

/* ------------------------------------------------------------------ */
/* emitEvent                                                           */
/* ------------------------------------------------------------------ */

/**
 * Append a sim event. Events are drained by stepSim each tick and
 * consumed by the HUD / renderer FX / battle log.
 */
export function emitEvent(state, ev) {
  state.events.push(ev);
  // When a terminal result event is emitted (final wave cleared or base
  // destroyed), compute + store the Final Score exactly once. finalizeGame
  // is idempotent and no-ops until state.result is set.
  if (ev && (ev.type === 'result' || ev.type === 'gameOver' || ev.type === 'victory' || ev.type === 'defeat' || ev.type === 'win' || ev.type === 'lose')) {
    if (ev.type !== 'finalScore' && state.result) {
      finalizeGame(state);
    }
  }
}

/* ------------------------------------------------------------------ */
/* applyCommand                                                        */
/* ------------------------------------------------------------------ */

/**
 * Validate + apply ONE player command at the current tick.
 * Every ACCEPTED command is appended to the battle log (replay source).
 * Returns {ok, reason} so the HUD can toast rejections.
 */
export function applyCommand(state, cmd) {
  if (!cmd || typeof cmd.type !== 'string') {
    return { ok: false, reason: 'badCommand' };
  }
  if (state.result) {
    return { ok: false, reason: 'gameOver' };
  }

  let result;
  switch (cmd.type) {
    case 'place':
      result = cmdPlace(state, cmd);
      break;
    case 'upgrade':
      result = cmdUpgrade(state, cmd);
      break;
    case 'sell':
      result = cmdSell(state, cmd);
      break;
    case 'repair':
      result = cmdRepair(state, cmd);
      break;
    case 'startWave':
      result = cmdStartWave(state, cmd);
      break;
    case 'deployTroop':
      result = cmdDeployTroop(state, cmd);
      break;
    default:
      result = { ok: false, reason: 'unknownCommand' };
      break;
  }

  if (result.ok) {
    recordCommand(state.log, state.tick, cmd);
  }
  return result;
}

function cmdPlace(state, cmd) {
  const cell = cmd.cell || cmd.slot || cmd.pos;
  if (!cmd.structId || !cell) return { ok: false, reason: 'badCommand' };

  const v = validatePlacement(state, cmd.structId, cell);
  if (!v.ok) return { ok: false, reason: v.reason || 'invalid' };

  const goldBefore = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  const s = placeStructure(state, cmd.structId, cell);
  if (!s) return { ok: false, reason: 'cost' };
  const goldAfter = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  if (goldAfter < goldBefore) state.goldSpent += (goldBefore - goldAfter);

  emitEvent(state, {
    type: 'build',
    tick: state.tick,
    structureId: s.id,
    structId: cmd.structId,
    pos: { x: s.pos.x, y: s.pos.y }
  });
  return { ok: true, reason: '' };
}

function cmdUpgrade(state, cmd) {
  const sid = typeof cmd.id === 'number' ? cmd.id : cmd.structureId;
  if (typeof sid !== 'number') return { ok: false, reason: 'badCommand' };
  const s = state.structures.get(sid);
  if (!s) return { ok: false, reason: 'noStructure' };
  const gUp = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  if (!startUpgrade(state, sid)) {
    return { ok: false, reason: s.tier >= 3 ? 'maxTier' : 'cost' };
  }
  const gUpAfter = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  if (gUpAfter < gUp) state.goldSpent += (gUp - gUpAfter);
  emitEvent(state, { type: 'upgradeStart', tick: state.tick, structureId: sid });
  return { ok: true, reason: '' };
}

function cmdSell(state, cmd) {
  const sid = typeof cmd.id === 'number' ? cmd.id : cmd.structureId;
  if (typeof sid !== 'number') return { ok: false, reason: 'badCommand' };
  if (!state.structures.get(sid)) return { ok: false, reason: 'noStructure' };
  if (!startSell(state, sid)) {
    return { ok: false, reason: 'busy' };
  }
  emitEvent(state, { type: 'sellStart', tick: state.tick, structureId: sid });
  return { ok: true, reason: '' };
}

function cmdRepair(state, cmd) {
  const sid = typeof cmd.id === 'number' ? cmd.id : cmd.structureId;
  if (typeof sid !== 'number') return { ok: false, reason: 'badCommand' };
  if (!state.structures.get(sid)) return { ok: false, reason: 'noStructure' };
  const gRep = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  if (!requestRepair(state, sid)) {
    return { ok: false, reason: 'noRepairNeeded' };
  }
  const gRepAfter = (state.economy && state.economy.gold != null) ? state.economy.gold : 0;
  if (gRepAfter < gRep) state.goldSpent += (gRep - gRepAfter);
  emitEvent(state, { type: 'repairStart', tick: state.tick, structureId: sid });
  return { ok: true, reason: '' };
}

function cmdStartWave(state, cmd) {
  if (!startNextWave(state)) {
    return { ok: false, reason: state.waves.active ? 'waveActive' : 'wavesDone' };
  }
  emitEvent(state, { type: 'wave', tick: state.tick, wave: state.waves.current });
  return { ok: true, reason: '' };
}

function cmdDeployTroop(state, cmd) {
  if (!cmd.unitId) return { ok: false, reason: 'badCommand' };
  const dest = cmd.dest || cmd.cell || cmd.pos;
  if (!dest) return { ok: false, reason: 'noDestination' };

  let def;
  try {
    def = getUnitDef(cmd.unitId);
  } catch (e) {
    return { ok: false, reason: 'unknownUnit' };
  }

  const tier = cmd.tier === 2 || cmd.tier === 3 ? cmd.tier : 1;
  const cost = def.cost[tier - 1];
  if (!canAfford(state, cost)) return { ok: false, reason: 'cost' };

  // Troops SPAWN at the player base; the drop point is a march ORDER.
  const basePos = { x: state.base.pos.x, y: state.base.pos.y };
  const destCell = roundCell(dest);

  let path;
  if (def.domain === 'Flyer' || def.domain === 'Floater') {
    // flyers ignore terrain; floaters approximated as direct water travel
    path = getFlyerPath(basePos, destCell);
  } else {
    path = findWalkerPath(state.navGrid, roundCell(basePos), destCell);
    if (!path) return { ok: false, reason: 'blocked' };
  }

  if (!spend(state, cost, 'deploy:' + cmd.unitId)) {
    return { ok: false, reason: 'cost' };
  }
  state.goldSpent = (state.goldSpent || 0) + cost;

  const unit = createUnit(state, cmd.unitId, tier, { x: basePos.x, y: basePos.y }, laneForDomain(def.domain), 'defender');
  unit.path = path;
  unit.pathIdx = 0;
  unit.state = 'marching';
  state.units.set(unit.id, unit);

  emitEvent(state, {
    type: 'spawn',
    tick: state.tick,
    unitId: cmd.unitId,
    entityId: unit.id,
    side: 'defender',
    pos: { x: unit.pos.x, y: unit.pos.y }
  });
  return { ok: true, reason: '' };
}

/* ------------------------------------------------------------------ */
/* stepMovement                                                        */
/* ------------------------------------------------------------------ */

/**
 * Advance all units along their domain paths.
 * - Attackers whose 'targets' flag is Base attack the base when in reach.
 * - ONLY Targets:Structures units divert to attack structures.
 * - Defender troops simply march to their ordered destination, then idle
 *   (their firing is handled by stepCombat).
 */
export function stepMovement(state, dt) {
  const base = state.base;

  for (const unit of state.units.values()) {
    if (unit.hp <= 0) continue;

    const isAttacker = unit.side === 'attacker';
    let engaged = false;

    if (isAttacker && unit.targetsBase === false) {
      // Structure hunter (e.g. artillery): divert to a live structure target.
      let tgt = null;
      if (unit.targetId != null) {
        tgt = state.structures.get(unit.targetId) || null;
        if (tgt && (tgt.hp <= 0 || tgt.lifecycle === 'Destroyed')) tgt = null;
      }
      if (!tgt) {
        const tid = acquireTarget(state, unit);
        unit.targetId = tid;
        tgt = tid != null ? state.structures.get(tid) || null : null;
      }
      if (tgt && dist(unit.pos, tgt.pos) <= unit.range) {
        unit.state = 'attacking';
        engaged = true; // stepCombat resolves the actual fire
      }
    }

    if (isAttacker && !engaged) {
      // Base-targeters (and structure hunters with nothing left to siege)
      // attack the base once within weapon reach.
      const hasStructTarget = unit.targetsBase === false && unit.targetId != null;
      if (!hasStructTarget) {
        const reach = Math.max(unit.range || 0.5, 0.6);
        if (dist(unit.pos, base.pos) <= reach) {
          unit.state = 'attacking';
          applyDamage(state, unit.id, base, unit.dps, unit.damageType, dt);
          engaged = true;
        }
      }
    }

    if (engaged) continue;

    // ---- march along the current path -------------------------------
    const path = unit.path;
    if (path && unit.pathIdx < path.length) {
      unit.state = 'moving';
      let remaining = (unit.speed || 0) * dt;
      while (remaining > 0 && unit.pathIdx < path.length) {
        const wp = path[unit.pathIdx];
        const dx = wp.x - unit.pos.x;
        const dy = wp.y - unit.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= remaining || d === 0) {
          unit.pos.x = wp.x;
          unit.pos.y = wp.y;
          unit.pathIdx += 1;
          remaining -= d;
        } else {
          unit.pos.x += (dx / d) * remaining;
          unit.pos.y += (dy / d) * remaining;
          remaining = 0;
        }
      }
    }

    // ---- path exhausted ---------------------------------------------
    if (!path || unit.pathIdx >= path.length) {
      if (isAttacker) {
        // Not yet in reach of the base (walls may have shifted things):
        // deterministically re-path toward the base by domain.
        const reach = Math.max(unit.range || 0.5, 0.6);
        if (dist(unit.pos, base.pos) > reach) {
          if (unit.domain === 'Walker') {
            const p = findWalkerPath(state.navGrid, roundCell(unit.pos), roundCell(base.pos));
            if (p && p.length > 0) {
              unit.path = p;
              unit.pathIdx = 0;
            } else {
              unit.state = 'idle'; // fully walled off; wait for reroute
            }
          } else {
            unit.path = getFlyerPath(unit.pos, base.pos);
            unit.pathIdx = 0;
          }
        }
      } else if (unit.state === 'moving' || unit.state === 'marching') {
        unit.state = 'idle';
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* stepSim                                                             */
/* ------------------------------------------------------------------ */

/**
 * ONE deterministic fixed tick. Strict phase order:
 *   economy -> waves/spawns -> movement -> structures -> combat ->
 *   death cleanup -> win/lose.
 * Returns (and drains) all events emitted since the last tick — including
 * events emitted by commands applied between ticks — for HUD/FX/log use.
 */
export function stepSim(state, dtFixed) {
  if (state.result && state._resultEmitted) {
    // Game over: drain any leftover events, do not advance.
    return state.events.splice(0, state.events.length);
  }

  state.tick += 1;
  state.time += dtFixed;

  // 1. Economy: passive income accrual.
  stepEconomy(state, dtFixed);

  // 2. Waves: due spawns become attacker units; wave-clear / win detection.
  stepWaves(state, dtFixed);

  // 3. Movement: units advance along domain paths; base assaults land here.
  stepMovement(state, dtFixed);

  // 4. Structures: build/upgrade/sell/repair timers, lifecycle, destruction.
  stepStructures(state, dtFixed);

  // 5. Combat: units + completed towers acquire targets and fire;
  //    kills grant income and emit kill events inside combat.
  stepCombat(state, dtFixed);

  // 6. Death cleanup: remove dead units deterministically (Map preserves
  //    insertion order, so iteration + deletion is stable across runs).
  const dead = [];
  for (const unit of state.units.values()) {
    if (unit.hp <= 0) dead.push(unit.id);
  }
  for (let i = 0; i < dead.length; i++) {
    state.units.delete(dead[i]);
    if (state.selectedId === dead[i]) state.selectedId = null;
  }

  // s10: passive base repair — the keep slowly mends between assaults (capped at max; never revives a dead base).
  if (state.base.hp > 0 && state.base.hp < state.base.maxHp) {
    state.base.hp = Math.min(state.base.maxHp, state.base.hp + 8 * dtFixed);
  }

  // 7. Win / lose transitions. stepWaves sets result='win' after the final
  //    clear; base death always overrides to a loss.
  if (state.base.hp <= 0) {
    state.base.hp = 0;
    if (state.result !== 'lose') state.result = 'lose';
  }
  if (state.result && !state._resultEmitted) {
    state._resultEmitted = true;
    emitEvent(state, { type: state.result, tick: state.tick, wave: state.waves.current });
  }

  // Drain this tick's events for HUD / renderer FX.
  return state.events.splice(0, state.events.length);
}