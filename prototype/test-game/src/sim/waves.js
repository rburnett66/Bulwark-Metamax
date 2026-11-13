import { WAVES, MAP, getUnitDef, WAVE_SPEED_MULT, WAVE_WINDOW_SEC, WAVE_CLEAR_HARVEST_SEC } from '../data/tables.js';
import { raisesPending } from './abilities.js';
import { MAX_LIVE_3D } from '../data/renderTiers.js';
import { createUnit, unitRadius } from './entities.js';
import { emitEvent, contactDistR, REST_RATIO } from './core.js';
import { resetFleetForWave, waveQuota } from './harvest.js';
import { rollBonusOffer } from './bonuses.js';

// Live Tier C (live-3D render) attackers on the field right now — the §5 sparsity cap counts these.
function liveTierCCount(state) {
  let n = 0;
  for (const u of state.units.values()) {
    if (u && u.hp > 0 && (getUnitDef(u.unitId) || {}).render_tier === 'C') n++;
  }
  return n;
}

/**
 * Wave scheduler.
 *
 * Wave 0 is the pre-battle build phase: no wave is active and the player
 * may build freely. The player explicitly starts each wave (startNextWave),
 * which queues that wave's spawn schedule as absolute sim times. stepWaves
 * emits due spawns as attacker units on their lanes, detects when the wave
 * is fully cleared (no pending spawns and no live attackers), and sets
 * state.result = 'win' after the final wave is cleared.
 *
 * Fully deterministic: spawn schedule is derived only from the wave table
 * and the sim time at which the wave was started; spawn order for identical
 * times is stable (sequence-number tiebreak).
 */

// STAGING (owner, 2026-07-13): ground waves ASSEMBLE ACROSS THE SAFE BORDER on the wave's focus
// side — spread laterally over the 2-deep band instead of single-filing through one cell — then
// enter the battlefield. Deterministic per spawn seq; the border is always dry (rivers live inside
// the play area), so no water checks needed.
function stagedGroundPos(map, ring, seq) {
  const pa = map.playArea;
  if (!pa || !ring || !ring.sideFocus) return null;
  const anchor = ring.spawns.ground;
  const LAT = [0, 1, -1, 2, -2, 3, -3, 4, -4];
  const lat = LAT[seq % LAT.length] + (Math.floor(seq / LAT.length) % 2 ? 1 : 0);
  const depth = seq % 2;   // alternate between the two border rows/cols
  let p;
  if (ring.sideFocus === 'L')      p = { x: pa.x0 - 1 - depth, y: anchor.y + lat };
  else if (ring.sideFocus === 'R') p = { x: pa.x1 + 1 + depth, y: anchor.y + lat };
  else if (ring.sideFocus === 'T') p = { x: anchor.x + lat, y: pa.y0 - 1 - depth };
  else                             p = { x: anchor.x + lat, y: pa.y1 + 1 + depth };
  p.x = Math.max(0, Math.min(map.cols - 1, p.x));
  p.y = Math.max(0, Math.min(map.rows - 1, p.y));
  return p;
}

/**
 * Which painted spawn point a wave unit came from (T0b [MM-story_mv7axdnv_f], T0 audit §9): the index into
 * the wave's authored point list for its lane, exactly as spawnPointForLane cycles it (seq % length).
 * null when the lane has no painted points (workbook campaign maps, classic board). Pure; reads the map only.
 */
export function spawnPointIndex(map, lane, waveNumber, seq) {
  if (!map || !map.rings || !map.rings.length) return null;
  const ring = map.rings[Math.max(1, Math.min(waveNumber || 1, map.rings.length)) - 1];
  const list = ring && ring.spawnList && ring.spawnList[lane];
  return list && list.length ? (seq | 0) % list.length : null;
}

function spawnPointForLane(map, lane, waveNumber, seq) {
  // CAMPAIGN maps (mapgen.js): spawns advance outward with the ring — each wave's points sit 2 tiles
  // outside that wave's playable edge on its focus side. Classic maps keep the fixed points.
  if (map.rings && map.rings.length) {
    const w = Math.max(1, Math.min(waveNumber || 1, map.rings.length));
    const ring = map.rings[w - 1];
    // FORGE MAPS (owner 2026-07-16): the tool authors MULTIPLE spawn points per lane — units cycle
    // through all of them (deterministic by seq) so the wave enters exactly where it was painted.
    const list = ring.spawnList && ring.spawnList[lane];
    if (list && list.length) return list[(seq | 0) % list.length];
    const s = ring.spawns;
    const p = lane === 'water' ? s.water : lane === 'air' ? s.air : s.ground;
    if (p) return p;
  }
  if (lane === 'water') return map.spawnWater;
  if (lane === 'air') return map.spawnAir;
  return map.spawnGround;
}

/**
 * Create the wave sub-state.
 * @param {Array} waveTable - WAVES table from data/tables.js
 * @returns {{current:number,total:number,active:boolean,pendingSpawns:Array,cleared:boolean}}
 */
export function initWaves(waveTable) {
  const table = Array.isArray(waveTable) ? waveTable : WAVES;
  return {
    current: 0,               // wave 0 = pre-battle build phase
    total: table.length,
    active: false,
    pendingSpawns: [],        // [{time, unitId, lane, seq}]
    cleared: false,
  };
}

/**
 * Begin the next wave: queues its spawn schedule at absolute sim times.
 * @param {object} state - SimState
 * @returns {boolean} false if a wave is already active or all waves are done
 */
/** Star_Rubric scorer — deterministic, judged at wave clear against the wave-start snapshot.
 *  1 core untouched · 2 no harvesters lost · 3 common quota · 4 uncommon quota (owner 2026-11-07: quotas sized to
 *  the wave's free fleet, harvesting.js waveQuota; the old "all premium cleared" star is gone) · 5 cleared under par. Conditions with no subject on
 *  this board (classic: no nodes/ring) default TRUE so every board stays 5-starrable. */
function scoreWave(state, w) {
  const map = state.map;
  const ring = map && map.rings && map.rings.length
    ? map.rings[Math.max(1, Math.min(w.current, map.rings.length)) - 1] : null;
  const ws = w.waveStart || {};
  // the par star times the fight (start to the last attacker down), not the harvest window after it
  const fightEnd = w.securedAt != null ? w.securedAt : state.time;
  const hvAlive = (state.harvesterIds || []).reduce((a, id) => {
    const u = state.units.get(id); return a + (u && u.hp > 0 ? 1 : 0);
  }, 0);
  // harvest quotas (owner 2026-11-07): common and uncommon gathered this wave against the quotas shown before it
  const q = w.quota || null, took = state.waveTake || {};
  const common = q && q.common > 0 ? { gathered: Math.floor((took.common || 0) + 1e-9), need: q.common } : null;
  const uncommon = q && q.uncommon > 0 ? { gathered: Math.floor((took.uncommon || 0) + 1e-9), need: q.uncommon } : null;
  const flags = [
    ws.baseHp == null || (state.base && state.base.hp >= ws.baseHp),   // 1 core takes no damage
    ws.harvesters == null || hvAlive >= ws.harvesters,                  // 2 zero harvesters lost
    !common || common.gathered >= common.need,                          // 3 common quota gathered
    !uncommon || uncommon.gathered >= uncommon.need,                    // 4 uncommon quota gathered
    !(ring && ring.parSec) || (fightEnd - (ws.time || 0)) <= ring.parSec,   // 5 under par
  ].map((f) => !!f);
  // WAVE REPORT (owner 2026-11-07: "a proper score with stars at the end of each wave"): the numbers behind each star
  const detail = {
    core: ws.baseHp == null || !state.base ? null : { start: ws.baseHp, end: Math.max(0, state.base.hp), max: ws.baseMaxHp || state.base.maxHp },
    harvesters: ws.harvesters == null ? null : { start: ws.harvesters, alive: hvAlive },
    common, uncommon,
    time: { sec: Math.round((fightEnd - (ws.time || 0)) * 10) / 10, par: (ring && ring.parSec) || null },
    gold: state.economy ? Math.round((state.economy.totalEarned || 0) - (ws.earned || 0)) : 0,
  };
  return { wave: w.current, flags, stars: flags.reduce((a, f) => a + (f ? 1 : 0), 0), detail };
}

export function startNextWave(state) {
  const w = state.waves;
  if (!w) return false;
  if (w.active) return false;
  if (w.current >= w.total) return false;

  const nextIndex = w.current; // zero-based index into table; wave numbers are 1-based
  const table = state.waveTable || WAVES;   // the sim's OWN schedule (faction test / custom), not the global
  const waveDef = table[nextIndex];
  if (!waveDef) return false;

  w.current = nextIndex + 1;
  w.active = true;
  w.cleared = false;
  w.pendingSpawns = [];
  if (state.resourceNodes) resetFleetForWave(state);   // owner: each wave opens with its free fleet (1, 2, 3, then 3) + healed base
  // the wave's harvest quotas (common, uncommon), sized to the free fleet and the ring's par; the take counts from here
  { const map = state.map, ring = map && map.rings && map.rings.length ? map.rings[Math.min(w.current, map.rings.length) - 1] : null;
    // the quota is sized to the time the wave actually has: its par, at most the window [MM-story_mwbkgcmu_2b]
    w.quota = state.resourceNodes && ring ? waveQuota(state, w.current, Math.min(ring.parSec, WAVE_WINDOW_SEC)) : null;
    state.waveTake = { common: 0, uncommon: 0, rare: 0, epic: 0 };
    // HARVEST BONUS TIME [MM-story_mwebtduu_1]: a harvest board's wave runs on WAVE_CLEAR_HARVEST_SEC (20 s) after its
    // last kill (stepWaves sets endsAt then). No par, or no fields to harvest (outpost raids): no bonus time.
    w.harvestAfterClear = state.resourceNodes && ring && ring.parSec > 0 ? WAVE_CLEAR_HARVEST_SEC : null;
    w.endsAt = null;
    w.securedAt = null; }
  // STAR RUBRIC snapshot (Story 4): the five wave stars are judged against the state at wave start
  w.waveStart = {
    time: state.time,
    baseHp: state.base ? state.base.hp : null,
    baseMaxHp: state.base ? state.base.maxHp : null,
    earned: state.economy ? state.economy.totalEarned || 0 : 0,   // the wave report's gold line
    harvesters: (state.harvesterIds || []).reduce((a, id) => {
      const u = state.units.get(id); return a + (u && u.hp > 0 ? 1 : 0);
    }, 0),
  };

  let seq = 0;
  const now = state.time;
  const spawns = waveDef.spawns || [];
  for (let s = 0; s < spawns.length; s++) {
    const entry = spawns[s];
    // Validate the unit exists in the tables (throws on missing => surfaces
    // data errors immediately rather than mid-battle).
    getUnitDef(entry.unitId);
    const delay = entry.delay || 0;
    const interval = entry.interval || 0;
    const count = entry.count | 0;
    for (let i = 0; i < count; i++) {
      w.pendingSpawns.push({
        time: now + delay + i * interval,
        unitId: entry.unitId,
        lane: entry.lane,
        seq: seq++,
      });
    }
  }

  // Stable deterministic ordering: earliest time first, table order breaks ties.
  w.pendingSpawns.sort(function (a, b) {
    if (a.time !== b.time) return a.time - b.time;
    return a.seq - b.seq;
  });

  // SPACE OUT the queue per lane so no two units on the same lane materialize on the SAME tick and stack on the
  // single spawn cell ("stuck at spawn"). The gap SCALES WITH THE DEPARTING UNIT'S SPEED — a crawling heavy /
  // water-siege unit (speed ~0.39) needs far longer to clear the spawn cell than a fast one, and a flat gap left
  // those factions (esp. Water: two units at 0.39) stacking. Gap ≈ time for the previous unit to move ~0.85 cell,
  // clamped so a wave of slow units still enters at a reasonable cadence. Deterministic (schedule rebuilds
  // identically, speeds come from the tables) → replay-safe. Preserves unit composition/order; only nudges timing.
  // Gap = time for the departing unit to travel its own DIAMETER (+ a margin) and fully vacate the single spawn
  // cell, so both slow AND large units (e.g. Artillery/Heavy Tanks: radius ~0.42, speed ~0.39) clear before the
  // next appears. A flat clear-distance let big tanks pile because they never moved a full body-length in time.
  // MAX_GAP raised with the sprite-sized footprints: a Heavy Tank (radius 1.48, speed ~0.39) needs
  // several seconds to clear its own body off the spawn cell — the old 3s cap left big units stacking.
  const MIN_GAP = 0.5, MAX_GAP = 6.0;
  // clear distance = the SPRITE diameter (collision × REST_RATIO — the sim's rest spacing), not the raw
  // collision diameter: the space-based gate below holds at that boundary, so the schedule should too.
  const laneClearGap = (speed, radius) =>
    Math.max(MIN_GAP, Math.min(MAX_GAP, (2 * (radius || 0.3) * REST_RATIO + 0.25) / (speed || 1)));
  const lastByLane = {};
  for (let s = 0; s < w.pendingSpawns.length; s++) {
    const sp = w.pendingSpawns[s];
    const prev = lastByLane[sp.lane];
    if (prev != null) { const g = laneClearGap(prev.speed, prev.radius); if (sp.time < prev.time + g) sp.time = prev.time + g; }
    const def = getUnitDef(sp.unitId);
    lastByLane[sp.lane] = { time: sp.time, speed: def.speed || 1, radius: unitRadius(def) };
  }
  // Re-sort: pushing later spawns forward can reorder across lanes.
  w.pendingSpawns.sort(function (a, b) {
    if (a.time !== b.time) return a.time - b.time;
    return a.seq - b.seq;
  });

  emitEvent(state, {
    type: 'wave',
    tick: state.tick,
    phase: 'start',
    wave: w.current,
    total: w.total,
    faction: waveDef.faction || null,   // who's attacking — for the pre-wave announcement banner
  });

  return true;
}

// Is a live attacker body still covering this spawn point? Clear distance = the sim's REST distance
// (contactDistR: sprites just touching) — a unit must never materialize inside the boundary the contact
// clamp maintains, or it enters the world already "slammed" into the leaver.
function spawnBlocked(state, pos, unitId) {
  if (!state.units) return false;
  const rNew = unitRadius(getUnitDef(unitId));
  for (const u of state.units.values()) {
    if (!u || u.hp <= 0 || u.side !== 'attacker') continue;
    const dx = u.pos.x - pos.x, dy = u.pos.y - pos.y;
    const clear = contactDistR(u.radius || 0.3, rNew);
    if (dx * dx + dy * dy < clear * clear) return true;
  }
  return false;
}

function anyAttackersAlive(state) {
  if (!state.units) return false;
  for (const unit of state.units.values()) {
    if (unit.side === 'attacker' && unit.hp > 0) return true;
  }
  return false;
}

/**
 * Advance the wave scheduler one tick: emit due spawns, detect wave clear,
 * and set the win result after the final wave is cleared.
 * @param {object} state - SimState
 * @param {number} dt - fixed timestep seconds
 */
export function stepWaves(state, dt) {
  const w = state.waves;
  if (!w || !w.active) return;

  const map = state.map || MAP;

  // Emit all spawns whose scheduled time has arrived. pendingSpawns is
  // sorted, so we consume from the front.
  // SPACE-BASED GATE: the scheduled gap assumes the previous unit marches off at full speed, but a
  // downstream jam backs the column up INTO the spawn cell — and a time-based gap then materializes
  // units inside the queue (the pile-up). If a live body still physically covers the spawn point,
  // HOLD that lane's spawn and retry next tick. Deterministic (pure sim state), replay-safe.
  const heldLanes = {};
  while (w.pendingSpawns.length > 0 && w.pendingSpawns[0].time <= state.time) {
    const head = w.pendingSpawns[0];
    if (heldLanes[head.lane]) break;                    // keep in-lane order; other lanes drained already
    let headPos = spawnPointForLane(map, head.lane, w.current, head.seq | 0);
    let headPoint = spawnPointIndex(map, head.lane, w.current, head.seq | 0);   // T0b origin.point
    // ground waves STAGE across the safe border (campaign maps): each unit gets its own spot in
    // the band, deterministic by seq — the column enters the map as a front, not a single file
    if (head.lane === 'ground' && map.rings && map.playArea) {
      const ring = map.rings[Math.max(1, Math.min(w.current, map.rings.length)) - 1];
      const staged = stagedGroundPos(map, ring, head.seq | 0);
      if (staged) { headPos = staged; headPoint = null; }   // staged spot is not a painted point
    }
    // ground only: water/air spawns spread laterally, so their base point being covered is normal
    if (head.lane === 'ground' && spawnBlocked(state, headPos, head.unitId)) {
      heldLanes[head.lane] = true;
      // Push the whole lane's schedule back so relative gaps survive the hold.
      for (let i = 0; i < w.pendingSpawns.length; i++) {
        if (w.pendingSpawns[i].lane === head.lane && w.pendingSpawns[i].time <= state.time) {
          w.pendingSpawns[i].time = state.time + dt;
        }
      }
      w.pendingSpawns.sort(function (a, b) { return (a.time - b.time) || (a.seq - b.seq); });
      continue;
    }
    // TIER C SPARSITY CAP (rendering-tiers spec §5, hard rule): a live-3D unit may never spawn past
    // MAX_LIVE_3D simultaneous instances. QUEUE, don't drop — the spawn re-tries each tick and emits
    // as soon as an existing Tier C unit dies. Deterministic (pure sim state), replay-safe.
    if ((getUnitDef(head.unitId) || {}).render_tier === 'C' && liveTierCCount(state) >= MAX_LIVE_3D) {
      head.time = state.time + dt;
      w.pendingSpawns.sort(function (a, b) { return (a.time - b.time) || (a.seq - b.seq); });
      continue;
    }
    const spawn = w.pendingSpawns.shift();
    const pos = headPos;
    let sx = pos.x, sy = pos.y;
    // WATER / AIR lanes spawn from a single cell but travel by straight-line getFlyerPath (they ignore terrain),
    // so — unlike ground units, which re-converge onto a shared route — a lateral spawn offset PERSISTS and pulls
    // them apart. This clears the worst congestion on the 1-cell-wide water channel, where a crawling siege unit
    // otherwise plugs everything behind it. Offset cycles by spawn sequence (deterministic → replay-safe) and is
    // clamped to the board. Ground keeps the single spawn point (its routes would just re-stack an offset).
    if (spawn.lane !== 'ground') {
      const bp = state.base ? state.base.pos : { x: pos.x + 1, y: pos.y };
      const ldx = bp.x - pos.x, ldy = bp.y - pos.y, ll = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
      const perpx = -ldy / ll, perpy = ldx / ll;
      const SPREAD = [0, 1.2, -1.2, 2.4, -2.4, 0.6, -0.6, 1.8, -1.8];
      const off = SPREAD[(spawn.seq || 0) % SPREAD.length];
      sx = Math.max(0, Math.min((map.cols || 1) - 1, pos.x + perpx * off));
      sy = Math.max(0, Math.min((map.rows || 1) - 1, pos.y + perpy * off));
    }
    // GROUND spawn that landed on a blocked cell — the map editor placed a cliff/rock region over an
    // authored spawn point, so the unit would spawn walled-in and go idle forever. Nudge to the nearest
    // walkable cell (deterministic ring scan → replay-safe). Water/air ignore the nav grid.
    if (spawn.lane === 'ground' && state.navGrid) {
      const g = state.navGrid, cx = Math.round(sx), cy = Math.round(sy);
      const passable = (x, y) => x >= 0 && y >= 0 && x < g.cols && y < g.rows && !!g.passable[y * g.cols + x];
      if (!passable(cx, cy)) {
        let best = null;
        for (let r = 1; r <= 8 && !best; r++) {
          for (let dy = -r; dy <= r && !best; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;   // only the ring at radius r
              if (passable(cx + dx, cy + dy)) { best = { x: cx + dx, y: cy + dy }; break; }
            }
          }
        }
        if (best) { sx = best.x; sy = best.y; }
      }
    }
    const unit = createUnit(
      state,
      spawn.unitId,
      1,
      { x: sx, y: sy },
      spawn.lane,
      'attacker'
    );
    // ORIGIN (T0b): which wave, lane and painted point this attacker came from. Output only — set after
    // createUnit so no spawn-time logic can read it; path lines (T3b) key on it.
    if (unit) unit.origin = { wave: w.current, lane: spawn.lane, point: headPoint };
    // a faction's per-wave speed (tables.js WAVE_SPEED_MULT; owner 2026-11-07: Verdance wave 1 at 80 %)
    const spdMult = unit && ((WAVE_SPEED_MULT[(((state.waveTable || WAVES)[w.current - 1]) || {}).faction] || {})[w.current]);
    if (spdMult) unit.speed *= spdMult;
    // Ensure the unit is registered in the sim (createUnit may or may not
    // insert; Map.set is idempotent either way).
    if (unit && state.units && !state.units.has(unit.id)) {
      state.units.set(unit.id, unit);
    }
    emitEvent(state, {
      type: 'spawn',
      tick: state.tick,
      unitId: spawn.unitId,
      entityId: unit ? unit.id : null,
      lane: spawn.lane,
      wave: w.current,
      pos: { x: pos.x, y: pos.y },
      origin: unit ? unit.origin : null,   // T0b: { wave, lane, point } — the key path lines group by
    });
  }

  // Wave clear detection: all spawns emitted and no live attackers remain.
  if (w.pendingSpawns.length === 0 && !anyAttackersAlive(state) && !raisesPending(state)) {
    // HARVEST BONUS TIME [MM-story_mwbd4114_28, MM-story_mwebtduu_1]: the last attacker is down — celebrate ('secured')
    // and keep the wave running WAVE_CLEAR_HARVEST_SEC more, so the harvesters gather until endsAt. No timer ever ends a
    // fight: the clock starts at the last kill.
    if (w.securedAt == null) {
      w.securedAt = state.time;
      if (w.harvestAfterClear != null) w.endsAt = state.time + w.harvestAfterClear;
      if (w.endsAt != null && state.time < w.endsAt) {
        emitEvent(state, { type: 'wave', tick: state.tick, phase: 'secured', wave: w.current, total: w.total,
          endsAt: w.endsAt, left: Math.round((w.endsAt - state.time) * 10) / 10 });
      }
    }
    if (w.endsAt != null && state.time < w.endsAt) return;
    w.active = false;
    w.cleared = true;

    // ── WAVE STARS (Story 4, workbook Star_Rubric — five independent conditions, 1 star each) ──
    const sc = scoreWave(state, w);
    (state.waveStars || (state.waveStars = [])).push(sc);
    emitEvent(state, { type: 'waveStars', tick: state.tick, wave: sc.wave, stars: sc.stars, flags: sc.flags.slice(), detail: sc.detail });

    emitEvent(state, {
      type: 'wave',
      tick: state.tick,
      phase: 'clear',
      wave: w.current,
      total: w.total,
    });

    // WAVE BONUSES: roll the 3-of-16 offer from the seeded rng (deterministic → replay-identical).
    // Not on the final wave — that clear is a win, no interlude to choose in.
    // An ENDLESS schedule (the outpost's visit raids [MM-subtask_mwcij14c_33]: waves are queued one at a time as they
    // come) has no final wave: no win, and no wave-bonus offer between raids. A battle never sets it.
    if (w.current < w.total && !w.endless) rollBonusOffer(state);

    // Surviving the final wave = win (unless the base already died).
    if (w.current >= w.total && state.result === null && !w.endless) {
      state.result = 'win';
      emitEvent(state, {
        type: 'win',
        tick: state.tick,
        wave: w.current,
      });
    }
  }
}