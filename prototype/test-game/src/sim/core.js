import { ASSUMPTIONS, WAVES, MAP, getUnitDef, getStructureDef, BONUS_NERFS } from '../data/tables.js';
import { createRng } from './rng.js';
import { buildNavGrid, findWalkerPath, findRoute, getFlyerPath, getWaterPath } from './pathfinding.js';
import { createUnit, createBase, createStructure } from './entities.js';
import { acquireTarget, applyDamage, stepCombat } from './combat.js';
import { initEconomy, stepEconomy, canAfford, spend, grantKillIncome } from './economy.js';
import { validatePlacement, placeStructure, startUpgrade, startSell, requestRepair, stepStructures } from './structures.js';
import { initWaves, startNextWave, stepWaves } from './waves.js';
import { initHarvest, cmdHarvest, stepHarvest, cmdBuyHarvester, resetFleetForWave } from './harvest.js';
import { deployMine, stepMines } from './mines.js';
import { initBonuses, applyBonus, cannonRange, cannonDamage } from './bonuses.js';
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
  const primary = findRoute(state.navGrid, from, to);   // prefer a 2-wide corridor
  if (!primary || !primary.length) return;
  state.routes.push(primary);
  // Seed several DISTINCT corridors up front: each avoids the cells of the routes already found (buffer 1 for
  // a lane of clear space between them, then buffer 0 as a fallback), so units fan out from the very start.
  for (let k = 0; k < 4 && state.routes.length < MAX_ROUTES; k++) {
    let alt = findRoute(state.navGrid, from, to, routeCellsSet(state, 1));
    if (!alt || !alt.length) alt = findRoute(state.navGrid, from, to, routeCellsSet(state, 0));
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
  let p = findRoute(state.navGrid, from, to, avoid);          // prefer 2-wide, avoid existing routes + the jam
  if (!p || !p.length) p = findRoute(state.navGrid, from, to, jam);   // fallback: just skirt the jam
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
/* campaign carry                                                      */
/* ------------------------------------------------------------------ */
function applyCampaignCarry(state, carry) {
  const eco = state.economy;
  if (Number.isFinite(carry.gold)) {
    eco.money = Math.max(0, Math.floor(carry.gold));
    eco.totalEarned = eco.money;
  }
  const bp = state.base && state.base.pos;
  const list = carry.structures || [];
  if (!bp || !list.length) return;
  let refunded = 0;
  const boost = 1e9;                       // validatePlacement checks funds — carried defenses are already paid for
  eco.money += boost;
  for (const c of list) {
    const cell = { x: bp.x + (c.dx | 0), y: bp.y + (c.dy | 0) };
    let ok = false;
    try { ok = !!validatePlacement(state, c.structId, cell).ok; } catch (e) { ok = false; }
    if (ok && state.resourceNodes) {       // never auto-crush the new map's fields
      const def = getStructureDef(c.structId);
      const fw = (def.footprint && def.footprint.w) || 1, fh = (def.footprint && def.footprint.h) || 1;
      for (const n of state.resourceNodes) {
        if (n.remaining <= 0 && !n.respawns) continue;
        if (n.x >= cell.x && n.x < cell.x + fw && n.y >= cell.y && n.y < cell.y + fh) { ok = false; break; }
      }
    }
    if (!ok) { refunded += Math.max(0, c.invested | 0); continue; }
    const def = getStructureDef(c.structId);
    const st = createStructure(state, c.structId, cell);
    const tier = Math.max(1, Math.min(def.hp.length, c.tier | 0 || 1));
    st.tier = tier;
    st.hp = st.maxHp = def.hp[tier - 1];
    st.dps = def.dps[tier - 1];
    st.lifecycle = 'Complete';
    st.progress = 0;
    st.invested = Math.max(0, c.invested | 0) || def.cost[0];
    if (!state.structures.has(st.id)) state.structures.set(st.id, st);
  }
  eco.money -= boost;
  if (refunded > 0) { eco.money += refunded; eco.totalEarned += refunded; }
  state.navGrid = buildNavGrid(state.map, Array.from(state.structures.values()));
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
    mines: new Map(),   // MINE DRONES (mines.js): flying couriers + armed mines — never structures
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
    harvesterLevel: (options.harvesterLevel | 0) || 1,   // workbook upgrade level (menu-bought, save-owned)
    // WAVE-BONUS pre-nerf (WB3): turrets AND walls START capped at T2 — bonuses 15/16 unlock T3. When a
    // campaign save supplies its own tiers we honor them; otherwise cap at startTierCap instead of "all open".
    structTiers: options.structTiers || { cannon: BONUS_NERFS.startTierCap, flak: BONUS_NERFS.startTierCap, wall: BONUS_NERFS.startTierCap },
    // per-unit collision radii derived from the voxel pack footprint (unitId → half-width tiles). Lets a
    // unit's collision match the tank you SEE instead of the shape-table default. null → unitRadius(def).
    voxelRadii: options.voxelRadii || null,
    _resultEmitted: false
  };

  initBonuses(state);   // WAVE BONUSES: persistent run mods + the per-wave offer (bonuses.js)
  state.base = createBase(map);
  state.navGrid = buildNavGrid(map, []);
  // cache the fixed water lane so waves/deploys can reuse it without recompute
  state.waterPath = getWaterPath(map);
  // campaign maps carry resource nodes → runtime node state + the player's harvester (harvest.js)
  initHarvest(state, map);

  // CAMPAIGN CARRY (owner): winning a map brings your remaining gold AND your standing defenses
  // into the next battle. Structures re-plant at the same offsets from the NEW base; ones that
  // can't legally fit (water, off-board, occupied, or sitting on a resource — no silent crush)
  // refund their invested cost as gold instead. Applied at t=0, so it's part of the initial
  // deterministic state.
  if (options.carry) applyCampaignCarry(state, options.carry);

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
    case 'harvest':
      result = cmdHarvest(state, cmd);
      break;
    case 'buyHarvester':
      result = cmdBuyHarvester(state);
      break;
    case 'chooseBonus':
      result = applyBonus(state, cmd.bonusId);   // WAVE BONUSES — validates against the current offer
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

  // MINE DRONE: the purchase launches a courier, never a structure (mines are walkable +
  // untargetable — state.mines). deployMine spends, records, and emits its own events.
  let mineDef = null;
  try { mineDef = getStructureDef(cmd.structId); } catch (e) { /* validated above */ }
  if (mineDef && mineDef.kind === 'mine') {
    return deployMine(state, cmd.structId, { x: Math.round(cell.x), y: Math.round(cell.y) });
  }

  const s = placeStructure(state, cmd.structId, cell);   // placeStructure→spend() tracks state.goldSpent
  if (!s) return { ok: false, reason: 'cost' };

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
  if (!startUpgrade(state, sid)) {   // startUpgrade→spend() tracks state.goldSpent
    return { ok: false, reason: s.tier >= 3 ? 'maxTier' : 'cost' };
  }
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
  if (!requestRepair(state, sid)) {   // requestRepair→spend() tracks state.goldSpent
    return { ok: false, reason: 'noRepairNeeded' };
  }
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
  // spend() already tracks state.goldSpent — no manual add (was double-counting deploys).

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
const SLOW_FACTOR = 0.5;   // frost chill: fraction of normal ground speed while slowUntil holds (retune via stats)

export function stepMovement(state, dt) {
  const base = state.base;

  for (const unit of state.units.values()) {
    if (unit.hp <= 0) continue;
    // REPAIR TROOPS are owned by structures.js (marchAlong + repair lifecycle keyed on state 'repairMarch'). If
    // this generic mover touched them it would clobber that state to 'moving' → they'd reach the structure but
    // never actually repair. Skip them here; they path around structures via their nav path and ignore units.
    if (unit.isRepairTroop) continue;
    // HARVESTERS are owned by harvest.js (collect→haul→deposit FSM) for the same reason.
    if (unit.isHarvester) continue;

    // STATIONARY tracking (for the base super-cannon: it only lands on units that stay put). Compares to the
    // position at the top of the previous tick, so it captures march + separation movement.
    const mv = (unit._px != null) ? Math.hypot(unit.pos.x - unit._px, unit.pos.y - unit._py) : 1;
    unit._still = (mv < 0.03) ? (unit._still || 0) + 1 : 0;
    unit._px = unit.pos.x; unit._py = unit.pos.y;   // ALSO the tick-start anchor for the contact clamp's
                                                    // total-displacement measurement (stepContactClamp)

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
        // An active OVERTAKE also isn't stuck: the unit is deliberately aiming BESIDE its blocker, so its
        // waypoint distance legitimately grows — flagging that as stuck fired detour re-paths mid-maneuver
        // and sent units wandering (backtracking to detour waypoints after the pass).
        if (advanced || state.tick < (unit._detourGraceTick || 0) || state.tick <= (unit._ovtUntil || 0)) { unit._stuck = 0; }
        else if ((unit._stuck = (unit._stuck || 0) + 1) >= 12) {                   // ~0.4s truly wedged → route around
          const avoid = jamCells(state, unit);
          discoverRoute(state, avoid);                                             // append a reusable alternate
          const detour = findRoute(state.navGrid, roundCell(unit.pos), roundCell(base.pos), avoid);   // stuck → reroute wide, around the jam
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
    // Move along a PERSISTENT BLENDED HEADING (unit.hdg) that eases toward the current waypoint each tick,
    // and consume waypoints by ARRIVAL RADIUS instead of exact coordinate. The old exact-consume march snapped
    // the movement direction to each new cell-to-cell segment, so a column zigzagged waypoint to waypoint and
    // any unit displaced by the crowd visibly whipped its facing around ("turned around"); the blend converges
    // in ~5 ticks — fast enough not to orbit, slow enough to read as a turn. No hard SNAP onto waypoints — the
    // unit keeps whatever position it settled at (so the separation pass's lateral nudges persist and units
    // spread) — and the periodic re-path above lets it find a NEW way around walls it's drifted or been pushed
    // toward, rather than fighting to stay on one line.
    const HDG_BLEND = 0.35;
    const path = unit.path;
    if (path && unit.pathIdx < path.length) {
      unit.state = 'moving';
      // after a detour (overtake / crowd displacement) never march BACK to stale waypoints: greedily skip
      // any waypoint that is no closer than the one after it (on an undisturbed path the next waypoint is
      // always farther, so this is a no-op; after a sideways excursion it re-enters the path nearest-ahead).
      while (unit.pathIdx + 1 < path.length) {
        const w0 = path[unit.pathIdx], w1 = path[unit.pathIdx + 1];
        const d0 = (w0.x - unit.pos.x) * (w0.x - unit.pos.x) + (w0.y - unit.pos.y) * (w0.y - unit.pos.y);
        const d1 = (w1.x - unit.pos.x) * (w1.x - unit.pos.x) + (w1.y - unit.pos.y) * (w1.y - unit.pos.y);
        if (d1 <= d0) unit.pathIdx += 1; else break;
      }
      let remaining = (unit.speed || 0) * dt;
      if (unit.slowUntil && state.tick < unit.slowUntil) remaining *= SLOW_FACTOR;   // frost chill active → move slower
      const ARRIVE = Math.max(0.35, remaining * 1.5);
      let guard = path.length + 2;
      while (remaining > 0 && unit.pathIdx < path.length && guard-- > 0) {
        const wp = path[unit.pathIdx];
        const dx = wp.x - unit.pos.x;
        const dy = wp.y - unit.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= ARRIVE) { unit.pathIdx += 1; continue; }        // close enough — head for the next waypoint
        let desx = dx / d, desy = dy / d;                        // desired direction: straight at the waypoint
        // OVERTAKE in progress (separation flagged a slower blocker dead ahead last tick): aim at the
        // clearance point BESIDE the blocker instead — the waypoint pull resumes when the goal expires.
        if (unit._ovtGoal && state.tick <= (unit._ovtUntil || 0)) {
          const ox = unit._ovtGoal.x - unit.pos.x, oy = unit._ovtGoal.y - unit.pos.y;
          const od = Math.sqrt(ox * ox + oy * oy);
          if (od > 0.2) { desx = ox / od; desy = oy / od; }
        }
        let h = unit.hdg;
        if (!h) { h = unit.hdg = { x: desx, y: desy }; }
        else {
          h.x += HDG_BLEND * (desx - h.x); h.y += HDG_BLEND * (desy - h.y);
          const hl = Math.sqrt(h.x * h.x + h.y * h.y);
          if (hl > 1e-6) { h.x /= hl; h.y /= hl; } else { h.x = desx; h.y = desy; }   // degenerate (180° flip mid-blend)
        }
        const step = Math.min(remaining, d);
        // FACING-LOCKED MOTION (owner 2026-07-17): ground units render at 16 baked facings, so they
        // MOVE along the nearest of those 16 angles too — displacement always matches the drawn
        // frame and the sprite never reads as sliding sideways. The blended hdg stays continuous
        // underneath, so turns still sweep facing-to-facing instead of thrashing. Walkers only —
        // air stays smooth (Tier B banks through its turns).
        let mx = h.x, my = h.y;
        if (unit.domain === 'Walker') {
          const SEG = Math.PI / 8;                                    // 2π/16 buckets
          let qi = Math.round(Math.atan2(h.y, h.x) / SEG);
          // OBSTACLE STEER (owner 2026-07-17): probe ~0.75 ahead of the facing; if it runs into a
          // blocked cell (wall/structure/water), TURN to the nearest clear facing — preferring the
          // side of the waypoint — instead of grinding along the obstacle. The turn is committed
          // into hdg so next tick continues around it, not back into it. Skipped on the final
          // approach to the current waypoint (an adjacent-to-wall goal must stay reachable).
          const grid = state.navGrid;
          if (grid && grid.passable && d > 1.1) {
            const blockedAhead = (bi) => {
              const ang = bi * SEG;
              const cx2 = Math.round(unit.pos.x + Math.cos(ang) * 0.75);
              const cy2 = Math.round(unit.pos.y + Math.sin(ang) * 0.75);
              if (cx2 < 0 || cy2 < 0 || cx2 >= grid.cols || cy2 >= grid.rows) return true;
              return !grid.passable[cy2 * grid.cols + cx2];
            };
            if (blockedAhead(qi)) {
              const side = (h.x * desy - h.y * desx) >= 0 ? 1 : -1;   // turn toward the waypoint's side first
              for (let k = 1; k <= 6; k++) {
                if (!blockedAhead(qi + k * side)) { qi += k * side; break; }
                if (!blockedAhead(qi - k * side)) { qi -= k * side; break; }
              }
            }
          }
          const q = qi * SEG;
          mx = Math.cos(q); my = Math.sin(q);
          h.x += 0.5 * (mx - h.x); h.y += 0.5 * (my - h.y);           // commit the steer into the heading
          const hl2 = Math.sqrt(h.x * h.x + h.y * h.y);
          if (hl2 > 1e-6) { h.x /= hl2; h.y /= hl2; }
        }
        unit.pos.x += mx * step; unit.pos.y += my * step;
        remaining -= step;
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
              : findRoute(state.navGrid, roundCell(unit.pos), baseTargetFor(state, unit));   // prefer 2-wide on the long haul
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
// REST distance between two bodies = the distance at which their DRAWN sprites just touch. Sprites render at
// 4/3 × collision radius (render/harness SPRITE_OVER_COLLISION — mirrored here, NOT imported: the sim stays
// render-free; unitart-scale.test pins the render side to the same 4/3). Resting at raw collision distance put
// ~0.5 cells of visible sprite interpenetration on every clean follow — physics-correct frames READ as bumping.
export const REST_RATIO = 1.2;   // was 4/3 — the plan's fallback: the full sprite-touch ring made a big
                                 // contested zone and queues jittered at its edge (owner playtest). At 1.2
                                 // sprites overlap a whisker at rest; motion is calm.
const REST_PAD = 0.02;
// TROOP SPACING FLOOR (owner, 2026-07-15): "keep troops 2 units apart and we will be fine" —
// no ground pair rests closer than 2 tiles centre-to-centre, whatever their size. Crowds stay
// readable, art can never overlap, funnels drain single-file with daylight.
export const REST_MIN = 2.0;
export function contactDistR(rA, rB) { return Math.max((rA + rB) * REST_RATIO + REST_PAD, REST_MIN); }
function contactDist(a, b) { return contactDistR(a.radius || 0.3, b.radius || 0.3); }

// air flies over the ground/water plane; only same-plane bodies interact
function unitLayer(u) { return (u.altitude > 0 || u.domain === 'Flyer') ? 1 : 0; }

// per-tick applied-force record for the HUD collision overlay (render-only; hashState ignores it).
// push = radial overlap dissolve, steer = lateral avoidance (both pre-forward-strip), clamp = contact clamp.
function dbgSep(state, id) {
  if (!state.debugSep) state.debugSep = new Map();
  let e = state.debugSep.get(id);
  if (!e) { e = { pushX: 0, pushY: 0, steerX: 0, steerY: 0, clampX: 0, clampY: 0 }; state.debugSep.set(id, e); }
  return e;
}

/**
 * CONTACT CLAMP — velocity-level collision resolution (the shipped-game approach: SupCom2/Factorio-style).
 * Runs LAST in the movement chain (after stepMovement AND stepSeparation), gating each unit's TOTAL tick
 * displacement (march + avoidance steer + radial dissolve, measured from the tick-start position _px/_py):
 * for each same-layer pair now closer than contactDist, undo ONLY the part of that displacement that closed
 * the gap (never more), split between the pair by who did the closing. Gating only the march (an earlier
 * design) let the steer compress dense crowds straight through their footprints — every displacement source
 * must pass through this one boundary.
 * Properties that kill the "bumping":
 *   • tangential motion is untouched → a faster unit GLIDES along the boundary while its avoidance steer
 *     walks it around — no jitter;
 *   • a follower dead-behind a slower leader lands exactly at contactDist every tick → it paces the leader
 *     with zero oscillation (the old position-push shoved it back each tick after movement closed in — the
 *     spawn "slamming" and the backward shove that spun fast units around);
 *   • correction ≤ this tick's closing motion → pairs that ALREADY overlap are held, never popped apart
 *     (the research's radius-shrink trick expressed as a cap); the demoted radial push dissolves them;
 *   • parked/attacking units participate as passive anvils (zero movement → zero share of the correction).
 * Deterministic: fixed i<j order over the insertion-ordered unit array, movement deltas (_mvx/_mvy) frozen
 * from stepMovement, positions corrected sequentially.
 */
/** TERRAIN CLAMP (owner: 'units going through walls'): after all movement/pushes, a ground
 *  unit whose centre landed in an impassable cell (wall/moat/base/water) is put back —
 *  axis-split so tangential motion along a wall face survives (the glide, not the clip).
 *  Deterministic: pure grid + per-tick displacement. */
export function stepTerrainClamp(state) {
  const grid = state.navGrid;
  if (!grid || !grid.passable) return;
  const cols = grid.cols, rows = grid.rows;
  const blocked = (x, y) => {
    const cx = Math.round(x), cy = Math.round(y);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
    return !grid.passable[cy * cols + cx];
  };
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0 || u.domain !== 'Walker' || u._px == null) continue;
    if (!blocked(u.pos.x, u.pos.y)) continue;
    const keepX = !blocked(u.pos.x, u._py);   // try sliding along one axis
    const keepY = !blocked(u._px, u.pos.y);
    if (keepX) { u.pos.y = u._py; }
    else if (keepY) { u.pos.x = u._px; }
    else { u.pos.x = u._px; u.pos.y = u._py; }   // fully wedged — stay put this tick
  }
  // BODY REPULSION (owner: a tank's collision boundary must not overlap walls — a small corner
  // clip is fine, but no RIDING the wall). The centre clamp above keeps the centre out of a wall
  // cell; this pushes the unit's BODY off adjacent wall cells. For each blocked neighbour cell,
  // find the closest point on that cell to the unit centre; if the body penetrates past a small
  // tolerance, push the centre out along the shortest axis. Deterministic (pure grid geometry).
  const TOL = 0.12;   // allowed corner clip before we push
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0 || u.domain !== 'Walker' || u._px == null) continue;
    const r = Math.min(u.radius || 0.3, 0.7);   // effective wall-collision radius (capped like the art)
    const px = u.pos.x, py = u.pos.y;
    const cx0 = Math.round(px), cy0 = Math.round(py);
    let bestPen = 0, bestNx = 0, bestNy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const wx = cx0 + dx, wy = cy0 + dy;
      if (wx < 0 || wy < 0 || wx >= cols || wy >= rows) continue;
      if (grid.passable[wy * cols + wx]) continue;   // only blocked cells repel
      // wall cell occupies [wx-0.5, wx+0.5] x [wy-0.5, wy+0.5]; closest point to the unit centre
      const clx = Math.max(wx - 0.5, Math.min(px, wx + 0.5));
      const cly = Math.max(wy - 0.5, Math.min(py, wy + 0.5));
      const ox = px - clx, oy = py - cly;
      const d = Math.hypot(ox, oy);
      const pen = r - d;
      if (pen > bestPen + 1e-6) { bestPen = pen; const inv = d > 1e-6 ? 1 / d : 0; bestNx = ox * inv; bestNy = oy * inv; }
    }
    if (bestPen > TOL) {   // riding the wall — push the body out (keeping the tolerated clip)
      const push = bestPen - TOL;
      u.pos.x += bestNx * push;
      u.pos.y += bestNy * push;
    }
  }
}

export function stepContactClamp(state) {
  const units = [];
  for (const u of state.units.values()) if (u.hp > 0 && !u.isRepairTroop && !u.isHarvester) units.push(u);
  const n = units.length;
  if (n < 2) return;
  // TWO relaxation sweeps: pairs are resolved sequentially, so a later pair's correction can nudge a unit
  // back into an already-resolved pair (multi-pair squeeze in dense crowds); the second sweep mops that up.
  // Closing is re-measured from the tick-start anchor each sweep, so corrections only ever shrink.
  for (let pass = 0; pass < 2; pass++)
  for (let i = 0; i < n; i++) {
    const a = units[i];
    for (let j = i + 1; j < n; j++) {
      const b = units[j];
      if (unitLayer(a) !== unitLayer(b)) continue;
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const C = contactDist(a, b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= C * C || d2 < 1e-12) continue;   // coincident pairs: the radial pass's id-tiebreak handles them
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;            // a → b
      const amx = (a._px != null) ? a.pos.x - a._px : 0, amy = (a._px != null) ? a.pos.y - a._py : 0;
      const bmx = (b._px != null) ? b.pos.x - b._px : 0, bmy = (b._px != null) ? b.pos.y - b._py : 0;
      const ca = Math.max(0, amx * nx + amy * ny);      // a's closing displacement this tick
      const cb = Math.max(0, -(bmx * nx + bmy * ny));   // b's closing displacement this tick
      const closing = ca + cb;
      if (closing <= 0) continue;                // pre-existing overlap, not this tick's doing — hold, don't pop
      const deficit = Math.min(closing, C - d);  // undo movement only — NEVER push apart
      const fa = deficit * (ca / closing), fb = deficit * (cb / closing);
      // NOTE: the march loop may have consumed a waypoint the clamp now pulls the unit a hair short of —
      // harmless, it simply heads for the next one (arrival is radius-based).
      a.pos.x -= nx * fa; a.pos.y -= ny * fa;
      b.pos.x += nx * fb; b.pos.y += ny * fb;
      if (fa > 0) { const e = dbgSep(state, a.id); e.clampX -= nx * fa; e.clampY -= ny * fa; }
      if (fb > 0) { const e = dbgSep(state, b.id); e.clampX += nx * fb; e.clampY += ny * fb; }
    }
  }
}

// OVERTAKE steering goal — the piece the lateral force alone can't do. A fast follower's PATH runs straight
// THROUGH the slower leader, so its desired heading keeps re-aiming into the blocker; the contact clamp then
// strips the closing motion and the follower creeps at the leader's pace, riding its bumper forever ("fast
// units keep chasing slower units"). While a blocker is ahead in the corridor, give the follower a temporary
// movement goal BESIDE the blocker (one rest-distance out on its escape side, half a look ahead) — the march
// aims there instead of at its waypoint, carries it around at its own speed, and the goal expires a few ticks
// after the corridor test stops firing (then the waypoint pull resumes). Deterministic: pure pair geometry.
function setOvertakeGoal(state, u, blocker, ex, ey, nx, ny, rSum) {
  // beside the blocker on the escape side, and half a body AHEAD along the pass axis (u → blocker) — NOT
  // along u's own heading: the goal bends the heading, so heading-relative geometry feeds back into wobble.
  const gx = blocker.pos.x + ex * (rSum + 0.3) + nx * (rSum * 0.5);
  const gy = blocker.pos.y + ey * (rSum + 0.3) + ny * (rSum * 0.5);
  // CORRIDOR GUARD (owner 2026-07-20: "tanks get stuck in the crack"): in a 1-tile gap the escape side is a
  // cliff wall, so this goal lands INSIDE a blocked cell — the follower then drives into the wall, the terrain
  // clamp shoves it back, and it oscillates in the crack forever. If there's no room to pass, DON'T overtake;
  // let the follower queue single-file behind the blocker (the contact clamp already paces it).
  const g = state.navGrid;
  if (g && g.passable) {
    const cx = Math.round(gx), cy = Math.round(gy);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows || !g.passable[cy * g.cols + cx]) return;
  }
  u._ovtGoal = { x: gx, y: gy };
  u._ovtBlocker = blocker.id;
  u._ovtUntil = state.tick + 8;
}

// escape-side choice, STICKY per blocker: while an overtake of this blocker is in progress, keep the side
// already committed to — the raw lateral sign flips as the follower crosses the blocker's lane line, and
// re-deciding every tick swung units back and forth across the lane (wander/orbit).
function escapeSide(state, u, blocker, lat, tiebreak) {
  if (u._ovtBlocker === blocker.id && state.tick <= (u._ovtUntil || 0)) return u._ovtS;
  const s = lat > 1e-3 ? -1 : (lat < -1e-3 ? 1 : tiebreak);
  u._ovtS = s;
  return s;
}

export function stepSeparation(state, dt) {
  const units = [];
  // REPAIR TROOPS are excluded from separation entirely — they path AROUND structures (nav grid) but IGNORE other
  // units, marching straight to their target instead of bouncing through the crowd.
  for (const u of state.units.values()) if (u.hp > 0 && u.state !== 'attacking' && !u.isRepairTroop && !u.isHarvester) units.push(u);
  const n = units.length;
  if (n < 2) return;
  const layer = unitLayer;
  const px = new Float64Array(n), py = new Float64Array(n);
  const sx = new Float64Array(n), sy = new Float64Array(n);   // lateral avoidance STEER, tracked apart for the debug overlay
  // each unit's PATH INTENT: direction toward its current waypoint — deliberately NOT the blended movement
  // heading (unit.hdg). The overtake goal bends hdg toward the blocker's side, so gating "is the blocker
  // ahead of me?" on hdg is self-fulfilling: the goal turns the unit at the blocker, the corridor test keeps
  // firing, and the unit ORBITS its blocker forever. The waypoint direction is what the unit actually wants,
  // and the goal can't bend it. (hdg is only a fallback for units mid-maneuver with no waypoint.)
  const hx = new Float64Array(n), hy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = units[i];
    const wp = (u.path && u.pathIdx < u.path.length) ? u.path[u.pathIdx] : null;
    if (wp) {
      const dx = wp.x - u.pos.x, dy = wp.y - u.pos.y, l = Math.sqrt(dx * dx + dy * dy);
      if (l > 1e-6) { hx[i] = dx / l; hy[i] = dy / l; continue; }
    }
    if (u.hdg) { hx[i] = u.hdg.x; hy[i] = u.hdg.y; }
  }

  for (let i = 0; i < n; i++) {
    const a = units[i];
    for (let j = i + 1; j < n; j++) {
      const b = units[j];
      if (layer(a) !== layer(b)) continue;
      const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
      const rawSum = (a.radius || 0.3) + (b.radius || 0.3);   // raw collision footprints — true interpenetration
      const rSum = contactDistR(a.radius || 0.3, b.radius || 0.3);   // rest distance (sprites just touch)
      const d = Math.sqrt(dx * dx + dy * dy);

      // (1) RADIAL dissolve — ONLY while raw footprints truly interpenetrate (spawn stacks, cannon squeeze).
      //     Keeping units APART at rest is the contact clamp's job now; running this push out to the rest
      //     distance was the bump oscillation (movement closes, push shoves back, repeat). Gain halved so the
      //     dissolve is a slide, not a pop; the faster unit still yields more.
      if (d < rawSum) {
        let nx, ny, overlap;
        if (d < 1e-6) { nx = 0; ny = (a.id < b.id ? -1 : 1); overlap = rawSum; }
        else { nx = dx / d; ny = dy / d; overlap = rawSum - d; }
        const sa = a.speed || 0.1, sb = b.speed || 0.1, sum = sa + sb;
        const g = 0.5 * overlap;
        px[i] -= nx * g * (sa / sum); py[i] -= ny * g * (sa / sum);
        px[j] += nx * g * (sb / sum); py[j] += ny * g * (sb / sum);
      }

      // (2) FORWARD AVOIDANCE — steer around a unit genuinely BLOCKING the lane ahead. In the rear unit's own
      //     heading frame we resolve the blocker into FORWARD (fwd, along heading) and LATERAL (lat, across it)
      //     offsets. Steer only while the blocker is AHEAD (fwd > 0) and inside the rear unit's footprint
      //     CORRIDOR (|lat| < rSum). The instant the rear unit has slid far enough that the blocker leaves its
      //     corridor, this stops firing — so the maneuver has a stable resting point (side-by-side) instead of
      //     oscillating between "on the route line, behind" and "shoved aside" (the hover/stutter). A whole wave
      //     of ONE unit type (identical speed) still splits into parallel lanes because the ≤-speed test fires.
      //     (The old follow-BRAKE is gone: the contact clamp is now the hard guarantee a follower can't close
      //     into the leader, and the brake's backward correction was itself part of the visible "pressing".)
      const look = rSum + 1.0;
      if (d > 1e-6 && d < look) {
        const nx = dx / d, ny = dy / d;
        const closeness = Math.max(0, Math.min(1, (look - d) / Math.max(1e-6, look - rSum)));   // 1 touching → 0 at look
        // steering strength TAPERS with closeness — a whisper at the outer band, firm approaching contact,
        // then CUT INSIDE THE REST RING (+0.15): at the ring the clamp owns the interaction, and steering a
        // unit that cannot advance just wiggles it in place (owner: "jittery, related to the collision ring").
        // The moment the leader moves and the gap re-opens, steering resumes and overtakes work as before.
        if (d < rSum + 0.15) continue;
        const str = (1 - d / look) * 0.7 * closeness;
        // a's frame — is b blocking a's lane ahead?
        const fwdA = nx * hx[i] + ny * hy[i], latA = nx * (-hy[i]) + ny * (hx[i]);
        if ((hx[i] || hy[i]) && fwdA > 0 && Math.abs(latA) * d < rSum && (b.speed || 0) <= (a.speed || 0)) {
          const s = escapeSide(state, a, b, latA, (a.id < b.id ? 1 : -1));   // slide away from b's side (sticky)
          sx[i] += (-hy[i]) * s * str; sy[i] += (hx[i]) * s * str;
          setOvertakeGoal(state, a, b, (-hy[i]) * s, (hx[i]) * s, nx, ny, rSum);
        }
        // b's frame — is a blocking b's lane ahead?
        const fwdB = -nx * hx[j] - ny * hy[j], latB = -nx * (-hy[j]) - ny * (hx[j]);
        if ((hx[j] || hy[j]) && fwdB > 0 && Math.abs(latB) * d < rSum && (a.speed || 0) <= (b.speed || 0)) {
          const s = escapeSide(state, b, a, latB, (b.id < a.id ? 1 : -1));
          sx[j] += (-hy[j]) * s * str; sy[j] += (hx[j]) * s * str;
          setOvertakeGoal(state, b, a, (-hy[j]) * s, (hx[j]) * s, -nx, -ny, rSum);
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    // STEER, DON'T SLIDE (owner 2026-07-17): the lateral avoidance no longer displaces the body —
    // it already bends the march through the overtake goal, so the unit TURNS and drives around the
    // blocker at its own speed along a real facing. Only the radial interpenetration dissolve still
    // moves positions (true overlaps: spawn stacks, cannon squeeze).
    let ox = px[i], oy = py[i];
    // NEVER propel a unit FORWARD along its own heading: a faster follower's radial push must not
    // bulldoze the unit ahead toward the base ("truck ramming the tank, bump bump bump"). Crowd
    // pressure may slide a body sideways or backward — forward motion comes ONLY from the unit's
    // own movement step.
    const fwdPush = ox * hx[i] + oy * hy[i];
    if (fwdPush > 0) { ox -= hx[i] * fwdPush; oy -= hy[i] * fwdPush; }
    const ol = Math.sqrt(ox * ox + oy * oy);
    if (ol < 0.02) continue;                                        // DEAD-ZONE — ignore sub-visible nudges that
                                                                    // only cause shimmer; real avoidance is larger
    const maxStep = 0.15;                                           // clamp per tick — smooth, no teleporting
    if (ol > maxStep) { ox = ox / ol * maxStep; oy = oy / ol * maxStep; }
    units[i].pos.x += ox; units[i].pos.y += oy;
    const e = dbgSep(state, units[i].id);                           // overlay: radial vs steer INTENT (heading-borne)
    e.pushX += px[i]; e.pushY += py[i]; e.steerX += sx[i]; e.steerY += sy[i];
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
      if (dist(u.pos, base.pos) > cannonRange(state, CANNON.range)) continue;   // WB: pre-nerf −30% + buyback
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
        if (u.side !== 'attacker') continue;   // NO FRIENDLY FIRE (owner): the base's own shell never
                                               // hurts harvesters or deployed defenders in the blast
        if (dist(u.pos, p) <= CANNON.aoe) applyDamage(state, -2, u, cannonDamage(state, CANNON.damage), 'Concussion', 1);   // WB: pre-nerf −50% + buyback
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
  state.debugSep = new Map();   // per-tick applied-force record for the HUD overlay (render-only, not hashed)
  stepMovement(state, dtFixed);

  // 3b. Separation: dissolve true overlaps + steer faster units AROUND slower ones (sets overtake goals).
  stepSeparation(state, dtFixed);

  // 3c. Contact clamp LAST: undo each pair's total CLOSING displacement this tick (march + steer + dissolve)
  //     so bodies glide to rest at sprite-touching distance — velocity-level resolution; no push-back
  //     oscillation ("slamming"/"bumping"), and no displacement source can compress the crowd through it.
  stepContactClamp(state);
  // 3c-bis. TERRAIN clamp: nobody ends the tick inside a wall/moat/base cell, whatever pushed them
  // (separation pushes and overtake goals are terrain-blind — owner: "units going through walls").
  stepTerrainClamp(state);

  // 3d. Harvest: the harvester's collect→haul→deposit loop + node regrowth (campaign maps only).
  stepHarvest(state, dtFixed);

  // 4. Structures: build/upgrade/sell/repair timers, lifecycle, destruction.
  stepStructures(state, dtFixed);

  // 5. Combat: units + completed towers acquire targets and fire;
  //    kills grant income and emit kill events inside combat.
  stepCombat(state, dtFixed);

  // 5b. Base super-cannon: aim at a stationary siege unit, fire a slow arcing shell, massive AOE on impact.
  stepBaseCannon(state, dtFixed);

  // 5c. Mine drones: courier flight, arming, ground-contact detonation (mines.js). Runs BEFORE the
  //     death cleanup below so mine kills resolve with the standard kill event + bounty this tick.
  stepMines(state, dtFixed);

  // 6. Death cleanup: remove dead units deterministically (Map preserves
  //    insertion order, so iteration + deletion is stable across runs).
  const dead = [];
  for (const unit of state.units.values()) {
    if (unit.hp <= 0) dead.push(unit.id);
  }
  for (let i = 0; i < dead.length; i++) {
    const u = state.units.get(dead[i]);
    // Any death NOT already resolved+emitted by combat (base super-cannon AOE, enemy ARTILLERY AOE, collisions,
    // etc.) still emits a 'kill' — and EVERY attacker kill pays the bounty (owner, 2026-07-13: with the
    // harvest economy there is no passive income, so cannon/AOE kills paying zero read as broken).
    if (u) {
      const income = u.side === 'attacker' ? grantKillIncome(state, u) : 0;
      emitEvent(state, { type: 'kill', tick: state.tick, entityId: dead[i], unitId: u.unitId, side: u.side, lane: u.lane, income, radius: u.radius, pos: { x: u.pos.x, y: u.pos.y } });
    }
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
