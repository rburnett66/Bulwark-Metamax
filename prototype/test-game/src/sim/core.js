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

// ── Multi-route navigation ────────────────────────────────────────────────────────────────────────────
// A growing shared list of viable ground routes (spawn → base). Units are handed routes ROUND-ROBIN so traffic
// spreads across lines instead of piling on one; a unit that gets boxed in DISCOVERS a new route (BFS around the
// jam from the spawn) and appends it, so later units reuse it. Everything here is a pure function of sim state +
// spawn/tick order — no RNG, no wall-clock — so it rebuilds byte-identically on REPLAY (deterministic). The
// list + cursor live on state, so they are recreated the same way when a replay re-runs the same steps.
const MAX_ROUTES = 8;
function routesSetup(state) { if (!state.routes) { state.routes = []; state.routeCursor = 0; } }
// Cells occupied by all current routes (+ an optional buffer) — used to force each NEW route into fresh space
// so the corridors are genuinely DIVERSE (not hugging the same line).
function routeCellsSet(state, buffer) {
  const g = state.navGrid, set = new Set();
  for (const r of state.routes) for (let i = 0; i < r.length; i++) {
    const c = roundCell(r[i]);
    for (let dx = -buffer; dx <= buffer; dx++) for (let dy = -buffer; dy <= buffer; dy++) {
      const x = c.x + dx, y = c.y + dy;
      if (x >= 0 && x < g.cols && y >= 0 && y < g.rows) set.add(y * g.cols + x);
    }
  }
  return set;
}
function seedRoute(state) {
  routesSetup(state);
  if (state.routes.length) return;
  const spawn = (state.map && state.map.spawnGround) || { x: 0, y: 0 };
  const from = roundCell(spawn), to = roundCell(state.base.pos);
  const primary = findWalkerPath(state.navGrid, from, to);
  if (!primary || !primary.length) return;
  state.routes.push(primary);
  // Seed several DISTINCT corridors up front: each avoids the cells of the routes already found (buffer 1 for
  // a lane of clear space between them, then buffer 0 as a fallback), so units fan out from the very start.
  for (let k = 0; k < 4 && state.routes.length < MAX_ROUTES; k++) {
    let alt = findWalkerPath(state.navGrid, from, to, routeCellsSet(state, 1));
    if (!alt || !alt.length) alt = findWalkerPath(state.navGrid, from, to, routeCellsSet(state, 0));
    if (alt && alt.length && !state.routes.some((r) => sameRoute(r, alt))) state.routes.push(alt);
    else break;
  }
}
// ── Base attack slots ─────────────────────────────────────────────────────────────────────────────────────
// Every attacker used to path to the base's single CENTRE cell and attack within reach of it, so the whole mob
// stacked on one point (footprint overlap ~0.03 — units driving through each other). Instead we hand each unit a
// distinct SLOT on the ring of passable cells around the base footprint, so they SURROUND the base and attack
// from a line/ring. Slots are the 8-neighbours of every base cell that are passable + in-bounds + not a base
// cell, in a fixed deterministic order; each unit keeps `unit.id % slots.length` (stable → replay-safe).
function baseAttackSlots(state) {
  const b = state.base;
  if (b._attackSlots) return b._attackSlots;
  const g = state.navGrid;
  const cells = (b.cells && b.cells.length) ? b.cells : [roundCell(b.pos)];
  const isBaseCell = new Set(cells.map((c) => c.y * g.cols + c.x));
  const slotSet = new Set(); const slots = [];
  for (const c of cells) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || x >= g.cols || y < 0 || y >= g.rows) continue;
      const key = y * g.cols + x;
      if (isBaseCell.has(key)) continue;
      if (!g.passable[key]) continue;
      if (slotSet.has(key)) continue;
      slotSet.add(key); slots.push({ x, y });
    }
  }
  slots.sort((p, q) => (p.y * g.cols + p.x) - (q.y * g.cols + q.x));   // fixed order → deterministic assignment
  b._attackSlots = slots.length ? slots : [roundCell(b.pos)];
  return b._attackSlots;
}
// The cell this unit should march to and attack from (its ring slot). Assigned once, stable across the unit's life.
function baseTargetFor(state, unit) {
  const slots = baseAttackSlots(state);
  if (unit._baseSlotIdx == null) unit._baseSlotIdx = unit.id % slots.length;
  return slots[unit._baseSlotIdx];
}
// Distance from a unit to the NEAREST base footprint cell (not the centre) — so a unit standing at its ring slot
// still registers as "in reach" to attack.
function distToBaseFootprint(state, unit) {
  const b = state.base;
  const cells = (b.cells && b.cells.length) ? b.cells : [b.pos];
  let best = Infinity;
  for (const c of cells) { const d = dist(unit.pos, c); if (d < best) best = d; }
  return best;
}

function assignRoutePath(state, unit) {
  seedRoute(state);
  if (!state.routes.length) return null;
  const idx = state.routeCursor % state.routes.length;
  state.routeCursor += 1;
  unit.routeIdx = idx;
  return state.routes[idx].slice();   // clone — the unit advances its own pathIdx, never mutating the shared route
}
function sameRoute(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  return true;
}
function discoverRoute(state, jam) {   // append a NEW spawn→base route that skirts BOTH the jam and existing lines
  routesSetup(state);
  if (state.routes.length >= MAX_ROUTES) return;
  const spawn = (state.map && state.map.spawnGround) || { x: 0, y: 0 };
  const from = roundCell(spawn), to = roundCell(state.base.pos);
  const avoid = routeCellsSet(state, 0);
  if (jam) for (const c of jam) avoid.add(c);
  let p = findWalkerPath(state.navGrid, from, to, avoid);          // avoid existing routes + the jam → diverse
  if (!p || !p.length) p = findWalkerPath(state.navGrid, from, to, jam);   // fallback: just skirt the jam
  if (!p || !p.length) return;
  for (const r of state.routes) if (sameRoute(r, p)) return;
  state.routes.push(p);
}
// The jammed region around a stuck unit: its cell (3×3) + the next few waypoints of its current line
// + THE CROWD — the cells of nearby walkers. The crowd IS the jam; without it, every stuck unit's
// "detour" was a shortest path straight back through the same pile-up at the same wall corner.
function jamCells(state, unit) {
  const g = state.navGrid, avoid = new Set(), cc = roundCell(unit.pos);
  const add = (x, y) => { if (x >= 0 && x < g.cols && y >= 0 && y < g.rows) avoid.add(y * g.cols + x); };
  for (let ddx = -1; ddx <= 1; ddx++) for (let ddy = -1; ddy <= 1; ddy++) add(cc.x + ddx, cc.y + ddy);
  if (unit.path) for (let k = unit.pathIdx; k < Math.min(unit.path.length, unit.pathIdx + 6); k++) { const w = roundCell(unit.path[k]); add(w.x, w.y); }
  for (const other of state.units.values()) {   // deterministic iteration (insertion-ordered Map)
    if (other === unit || other.hp <= 0 || other.domain !== 'Walker') continue;
    const dx = other.pos.x - unit.pos.x, dy = other.pos.y - unit.pos.y;
    const near = (unit.radius || 0.3) + (other.radius || 0.3) + 2;   // neighbourhood scales with both bodies
    if (dx * dx + dy * dy > near * near) continue;
    // Stamp the other unit's WHOLE FOOTPRINT — units span several cells now (the collision box is the
    // sprite box), and stamping only the centre cell let "detours" route straight through a tank's body.
    const oc = roundCell(other.pos), rr = Math.ceil(other.radius || 0.3);
    for (let ax = -rr; ax <= rr; ax++) for (let ay = -rr; ay <= rr; ay++) add(oc.x + ax, oc.y + ay);
  }
  return avoid;
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
  if (domain === 'Floater' || domain === 'Swimmer') return 'water';   // water-faction swimmers use the water lane
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
    // REPAIR TROOPS are owned by structures.js (marchAlong + repair lifecycle keyed on state 'repairMarch'). If
    // this generic mover touched them it would clobber that state to 'moving' → they'd reach the structure but
    // never actually repair. Skip them here; they path around structures via their nav path and ignore units.
    if (unit.isRepairTroop) continue;

    // STATIONARY tracking (for the base super-cannon: it only lands on units that stay put). Compares to the
    // position at the top of the previous tick, so it captures march + separation movement.
    const mv = (unit._px != null) ? Math.hypot(unit.pos.x - unit._px, unit.pos.y - unit._py) : 1;
    unit._still = (mv < 0.03) ? (unit._still || 0) + 1 : 0;
    unit._px = unit.pos.x; unit._py = unit.pos.y;

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
        // Reach measured to the nearest base FOOTPRINT cell (not the centre), so a unit standing at its ring
        // slot attacks — and the mob spreads AROUND the base instead of all cramming to the centre point.
        const reach = Math.max(unit.range || 0.5, 1.4);
        if (distToBaseFootprint(state, unit) <= reach) {
          unit.state = 'attacking';
          applyDamage(state, unit.id, base, unit.dps, unit.damageType, dt);
          engaged = true;
        }
      }
    }

    if (engaged) continue;

    // ---- RE-PATH only when genuinely STUCK: a walker that isn't getting closer to the base for ~0.8s (boxed
    //      in by a wall / crowd) finds a NEW way around; a unit that's flowing fine is left alone, so it keeps
    //      the lateral spread the separation pass gives it (blanket re-pathing yanked everyone onto cell
    //      centres and re-stacked them). Deterministic — driven only by sim state + tick.
    if (isAttacker && unit.domain === 'Walker' && unit.state !== 'attacking') {
      const dBase = dist(unit.pos, base.pos);
      if (dBase > 3) {   // only re-route units still NAVIGATING; near the base they're queueing, not lost
        // Progress = advancing ALONG THE UNIT'S OWN PATH (waypoint index rises, or it closes on the
        // current waypoint) — NOT shrinking distance-to-base. A detour around an obstacle legitimately
        // walks sideways or AWAY from the base for a stretch; the old distance-to-base metric kept
        // flagging detouring units as "stuck" every 0.4s and yanked them back toward the blocked
        // corridor — the fighting-at-the-wall jitter. A freshly granted detour also gets a grace
        // window so it can actually be walked before stuck-detection resumes.
        const wp = (unit.path && unit.pathIdx < unit.path.length) ? unit.path[unit.pathIdx] : null;
        const dWp = wp ? dist(unit.pos, wp) : Infinity;
        const advanced = unit._lastPathIdx == null || unit.pathIdx > unit._lastPathIdx ||
                         (unit._lastDWp != null && dWp < unit._lastDWp - 0.015);
        unit._lastPathIdx = unit.pathIdx; unit._lastDWp = dWp;
        if (advanced || state.tick < (unit._detourGraceTick || 0)) { unit._stuck = 0; }
        else if ((unit._stuck = (unit._stuck || 0) + 1) >= 12) {                   // ~0.4s truly wedged → route around
          const avoid = jamCells(state, unit);
          discoverRoute(state, avoid);                                             // append a reusable alternate
          const detour = findWalkerPath(state.navGrid, roundCell(unit.pos), roundCell(base.pos), avoid);
          if (detour && detour.length > 0) {
            unit.path = detour; unit.pathIdx = 0;
            unit._detourGraceTick = state.tick + 45;                               // ~1.5s to commit to going around
          }
          unit._stuck = 0;
        }
      }
    }

    // ---- FINAL APPROACH: peel onto this unit's own base RING SLOT ----
    // Within ~5 cells of the base, a walker leaves the shared centre-bound route and heads for its assigned slot
    // on the ring around the base footprint, so the mob SURROUNDS the base instead of stacking on its centre
    // (footprint overlap was ~0.03 there). Re-paths only until it's actually targeting the slot (last waypoint ==
    // slot) → no per-tick thrash. Deterministic (slot = unit.id % slots), so replays hold.
    if (isAttacker && unit.domain === 'Walker' && unit.state !== 'attacking' && dist(unit.pos, base.pos) < 5) {
      const slot = baseTargetFor(state, unit);
      const last = unit.path && unit.path.length ? unit.path[unit.path.length - 1] : null;
      if (!last || last.x !== slot.x || last.y !== slot.y) {
        const p = findWalkerPath(state.navGrid, roundCell(unit.pos), slot);
        if (p && p.length > 0) { unit.path = p; unit.pathIdx = 0; }
      }
    }

    // ---- march along the current path -------------------------------
    // Move toward the current waypoint and advance when reached. No hard SNAP onto the exact coordinate — the
    // unit keeps whatever position it settled at (so the separation pass's lateral nudges persist and units
    // spread) — and the periodic re-path above lets it find a NEW way around walls it's drifted or been pushed
    // toward, rather than fighting to stay on one line.
    const path = unit.path;
    if (path && unit.pathIdx < path.length) {
      unit.state = 'moving';
      let remaining = (unit.speed || 0) * dt;
      let guard = path.length + 2;
      while (remaining > 0 && unit.pathIdx < path.length && guard-- > 0) {
        const wp = path[unit.pathIdx];
        const dx = wp.x - unit.pos.x;
        const dy = wp.y - unit.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= remaining || d === 0) {
          const step = d;
          if (d > 0) { unit.pos.x += (dx / d) * step; unit.pos.y += (dy / d) * step; }
          unit.pathIdx += 1;
          remaining -= step;
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
        const reach = Math.max(unit.range || 0.5, 1.4);
        if (distToBaseFootprint(state, unit) > reach) {
          if (unit.domain === 'Walker') {
            // INITIAL path → hand out a route round-robin (spreads traffic across the shared list); a mid-field
            // re-path (already had a route) heads for this unit's own base SLOT so the mob rings the base.
            const p = (unit.routeIdx == null && (!unit.path || unit.path.length === 0))
              ? assignRoutePath(state, unit)
              : findWalkerPath(state.navGrid, roundCell(unit.pos), baseTargetFor(state, unit));
            if (p && p.length > 0) {
              unit.path = p;
              unit.pathIdx = 0;
            } else {
              unit.state = 'idle'; // fully walled off; wait for reroute
            }
          } else {
            unit.path = getFlyerPath(unit.pos, baseTargetFor(state, unit));
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
/**
 * Unit SEPARATION + local avoidance — units have a footprint (unit.radius) and can't overlap, and a faster
 * unit slides AROUND a slower one ahead instead of piling up behind it. Fully deterministic (fixed iteration,
 * snapshot-then-apply, no RNG) so replays stay hash-stable.
 *   • Overlapping same-LAYER units (air separates from the ground/water plane) push apart.
 *   • The push is SPEED-WEIGHTED: the faster unit yields more; the slower holds its ground and keeps flowing.
 *   • The push is applied with a LATERAL bias relative to each unit's heading — sideways slide, not a backward
 *     shove — so the faster unit routes around the slower one.
 */
const SEP_BUFFER = 0.16;   // personal-space padding added to footprint sums so drawn bodies keep a visible gap
export function stepSeparation(state, dt) {
  const units = [];
  // REPAIR TROOPS are excluded from separation entirely — they path AROUND structures (nav grid) but IGNORE other
  // units, marching straight to their target instead of bouncing through the crowd.
  for (const u of state.units.values()) if (u.hp > 0 && u.state !== 'attacking' && !u.isRepairTroop) units.push(u);
  const n = units.length;
  if (n < 2) return;
  const layer = (u) => (u.altitude > 0 || u.domain === 'Flyer') ? 1 : 0;
  const px = new Float64Array(n), py = new Float64Array(n);
  const bk = new Float64Array(n);   // per-unit forward BRAKE (deceleration when pacing behind a slower blocker)
  // each unit's unit-heading toward its next waypoint (movement direction)
  const hx = new Float64Array(n), hy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = units[i], wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : null;
    if (wp) { const dx = wp.x - u.pos.x, dy = wp.y - u.pos.y, l = Math.sqrt(dx * dx + dy * dy); if (l > 1e-6) { hx[i] = dx / l; hy[i] = dy / l; } }
  }

  for (let i = 0; i < n; i++) {
    const a = units[i];
    for (let j = i + 1; j < n; j++) {
      const b = units[j];
      if (layer(a) !== layer(b)) continue;
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      // rSum includes a small PERSONAL-SPACE buffer beyond the raw footprints, so drawn bodies keep a visible
      // gap and never appear to touch/bump even at the separation boundary.
      const rSum = (a.radius || 0.3) + (b.radius || 0.3) + SEP_BUFFER;
      const d = Math.sqrt(dx * dx + dy * dy);

      // (1) RADIAL separation while footprints overlap — the faster unit yields more.
      if (d < rSum) {
        let nx, ny, overlap;
        if (d < 1e-6) { nx = 0; ny = (a.id < b.id ? -1 : 1); overlap = rSum; }
        else { nx = dx / d; ny = dy / d; overlap = rSum - d; }
        const sa = a.speed || 0.1, sb = b.speed || 0.1, sum = sa + sb;
        px[i] -= nx * overlap * (sa / sum); py[i] -= ny * overlap * (sa / sum);
        px[j] += nx * overlap * (sb / sum); py[j] += ny * overlap * (sb / sum);
      }

      // (2) FORWARD AVOIDANCE — steer around a unit genuinely BLOCKING the lane ahead. In the rear unit's own
      //     heading frame we resolve the blocker into FORWARD (fwd, along heading) and LATERAL (lat, across it)
      //     offsets. Steer only while the blocker is AHEAD (fwd > 0) and inside the rear unit's footprint
      //     CORRIDOR (|lat| < rSum). The instant the rear unit has slid far enough that the blocker leaves its
      //     corridor, this stops firing — so the maneuver has a stable resting point (side-by-side) instead of
      //     oscillating between "on the route line, behind" and "shoved aside" (the hover/stutter). A whole wave
      //     of ONE unit type (identical speed) still splits into parallel lanes because the ≤-speed test fires.
      //     A FASTER follower also BRAKES to the leader's pace while it's directly behind (bk[]), so it can't
      //     out-run its own sideways escape and rear-end the slower unit ("butt bumping").
      const look = rSum + 1.0;
      if (d > 1e-6 && d < look) {
        const nx = dx / d, ny = dy / d, str = (1 - d / look) * 0.7;
        const closeness = Math.max(0, Math.min(1, (look - d) / Math.max(1e-6, look - rSum)));   // 1 touching → 0 at look
        // a's frame — is b blocking a's lane ahead?
        const fwdA = nx * hx[i] + ny * hy[i], latA = nx * (-hy[i]) + ny * (hx[i]);
        if ((hx[i] || hy[i]) && fwdA > 0 && Math.abs(latA) * d < rSum && (b.speed || 0) <= (a.speed || 0)) {
          const s = latA > 1e-3 ? -1 : (latA < -1e-3 ? 1 : (a.id < b.id ? 1 : -1));   // slide away from b's side
          px[i] += (-hy[i]) * s * str; py[i] += (hx[i]) * s * str;
          const excess = ((a.speed || 0) - (b.speed || 0)) * dt;                       // ground a gains on b per tick
          if (excess > 0 && fwdA > 0.5) bk[i] = Math.max(bk[i], excess * closeness);   // pace behind, don't ram
        }
        // b's frame — is a blocking b's lane ahead?
        const fwdB = -nx * hx[j] - ny * hy[j], latB = -nx * (-hy[j]) - ny * (hx[j]);
        if ((hx[j] || hy[j]) && fwdB > 0 && Math.abs(latB) * d < rSum && (a.speed || 0) <= (b.speed || 0)) {
          const s = latB > 1e-3 ? -1 : (latB < -1e-3 ? 1 : (b.id < a.id ? 1 : -1));
          px[j] += (-hy[j]) * s * str; py[j] += (hx[j]) * s * str;
          const excess = ((b.speed || 0) - (a.speed || 0)) * dt;
          if (excess > 0 && fwdB > 0.5) bk[j] = Math.max(bk[j], excess * closeness);
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    let ox = px[i], oy = py[i];
    const ol = Math.sqrt(ox * ox + oy * oy);
    const b = bk[i];
    if (ol < 0.02 && b <= 0) continue;                             // DEAD-ZONE — ignore sub-visible nudges that
                                                                    // only cause shimmer; real avoidance is larger
    if (ol >= 0.02) {
      const maxStep = 0.15;                                         // clamp per tick — smooth, no teleporting
      if (ol > maxStep) { ox = ox / ol * maxStep; oy = oy / ol * maxStep; }
      units[i].pos.x += ox; units[i].pos.y += oy;
    }
    if (b > 0) { units[i].pos.x -= hx[i] * b; units[i].pos.y -= hy[i] * b; }   // BRAKE: back off along heading to pace the leader
  }
}

// Base SUPER-CANNON — long range, slow to aim, slow arcing shell, MASSIVE AOE. It locks a target's POSITION,
// so a unit that keeps moving has left before the shell lands: it only really hurts STATIONARY targets (the
// enemy's dug-in long-range siege units). Deterministic (target picked by longest-stationary + id tiebreak).
const CANNON = { range: 26, stillTicks: 24, aim: 3.0, flight: 1.6, cooldown: 4.5, aoe: 2.6, damage: 4000 };
export function stepBaseCannon(state, dt) {
  const base = state.base, c = base && base.cannon;
  if (!c || base.hp <= 0) return;
  if (c.timer > 0) c.timer -= dt;

  if (c.phase === 'idle') {
    let best = null;                                   // the most-stationary attacker in range
    for (const u of state.units.values()) {
      if (u.hp <= 0 || u.side !== 'attacker') continue;
      if (u.altitude > 0 || u.domain === 'Flyer') continue;   // GROUND artillery — never targets air units
      if ((u._still || 0) < CANNON.stillTicks) continue;
      if (dist(u.pos, base.pos) > CANNON.range) continue;
      if (!best || u._still > best._still || (u._still === best._still && u.id < best.id)) best = u;
    }
    if (best) {
      c.aimPos = { x: best.pos.x, y: best.pos.y };     // LOCK the position — movers dodge, dug-in units don't
      c.phase = 'aim'; c.timer = CANNON.aim; c.aimDur = CANNON.aim;   // aimDur lets the render show a charge gauge
      emitEvent(state, { type: 'cannonAim', tick: state.tick, pos: { x: c.aimPos.x, y: c.aimPos.y }, dur: CANNON.aim, radius: CANNON.aoe });
    }
  } else if (c.phase === 'aim') {
    if (c.timer <= 0) {
      c.phase = 'flight'; c.timer = CANNON.flight; c.shotFrom = { x: base.pos.x, y: base.pos.y }; c.shotDur = CANNON.flight;
      emitEvent(state, { type: 'cannonShot', tick: state.tick, from: { x: base.pos.x, y: base.pos.y }, to: { x: c.aimPos.x, y: c.aimPos.y }, dur: CANNON.flight, radius: CANNON.aoe });
    }
  } else if (c.phase === 'flight') {
    if (c.timer <= 0) {
      const p = c.aimPos;
      for (const u of state.units.values()) {          // MASSIVE AOE at the locked spot
        if (u.hp <= 0) continue;
        if (u.altitude > 0 || u.domain === 'Flyer') continue;   // ground blast doesn't hit aircraft overhead
        if (dist(u.pos, p) <= CANNON.aoe) applyDamage(state, -2, u, CANNON.damage, 'Concussion', 1);
      }
      emitEvent(state, { type: 'cannonImpact', tick: state.tick, pos: { x: p.x, y: p.y }, radius: CANNON.aoe });
      c.phase = 'cooldown'; c.timer = CANNON.cooldown;
    }
  } else if (c.phase === 'cooldown') {
    if (c.timer <= 0) { c.phase = 'idle'; c.timer = 0; c.aimPos = null; c.shotFrom = null; }
  }
}

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

  // 3b. Separation: units have a footprint and can't overlap; faster units slide AROUND slower ones.
  stepSeparation(state, dtFixed);

  // 4. Structures: build/upgrade/sell/repair timers, lifecycle, destruction.
  stepStructures(state, dtFixed);

  // 5. Combat: units + completed towers acquire targets and fire;
  //    kills grant income and emit kill events inside combat.
  stepCombat(state, dtFixed);

  // 5b. Base super-cannon: aim at a stationary siege unit, fire a slow arcing shell, massive AOE on impact.
  stepBaseCannon(state, dtFixed);

  // 6. Death cleanup: remove dead units deterministically (Map preserves
  //    insertion order, so iteration + deletion is stable across runs).
  const dead = [];
  for (const unit of state.units.values()) {
    if (unit.hp <= 0) dead.push(unit.id);
  }
  for (let i = 0; i < dead.length; i++) {
    const u = state.units.get(dead[i]);
    // Any death NOT already resolved+emitted by combat (base super-cannon AOE, enemy ARTILLERY AOE, collisions,
    // etc.) still emits a 'kill' so it produces the burning-wreck FX — EVERY destroyed unit burns, not just tower
    // kills. FX-only (income/score are granted in combat.js, unchanged); deterministic so replays hold.
    if (u) emitEvent(state, { type: 'kill', tick: state.tick, entityId: dead[i], unitId: u.unitId, side: u.side, lane: u.lane, income: 0, radius: u.radius, pos: { x: u.pos.x, y: u.pos.y } });
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