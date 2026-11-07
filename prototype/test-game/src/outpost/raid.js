/**
 * src/outpost/raid.js — outpost raids on the battle simulation [MM-story_mw5oegk1_o].
 *
 * Every raid, live or away, is one wave of the battle sim on the outpost map (design docs/16 Bulwark MM/design/
 * Outpost-Design.md §5.2–§5.3; tech plan docs/tech-plan/Outpost.md §4.2–§4.3). One function decides it; the live
 * view ticks the same object in real time and a closed view finishes it headless, so the result is identical.
 *
 * ── The API (the contract with the outpost view, story O6) ──────────────────────────────────────────────────────
 *
 *   runRaid(outpost, raid, { map, step, seed?, units?, bakeTune?, onTick? })
 *     → { result: 'held' | 'breach', defenses: [{ id, hp }], events, ticks, timedOut }
 *     Runs the raid headless to its end. `raid` is what advance() hands its hook: { at, window?, first?, powered }.
 *     onTick(events, raidObj) is called after every fixed tick (optional; e.g. a progress bar).
 *
 *   createRaid(outpost, raid, { map, step, seed?, units?, bakeTune? })
 *     → { state, dt, tick(), step(seconds), finish(), done, result(), defenseIds, buildingPads, lanes }
 *     The stepping form for the live view. tick() runs one fixed sim tick (FIXED_DT = 1/30 s) and returns that
 *     tick's drained sim events (spawn, kill, damage, destroyed …) for the battle renderer's FX. step(seconds)
 *     accumulates real time and runs as many whole fixed ticks as fit, returning their events concatenated.
 *     finish() runs the rest headless and returns result(). `done` turns true on the tick that decides the raid;
 *     result() is null until then. `state` is a battle SimState: draw state.units / state.structures with the
 *     battle renderer. defenseIds maps a sim structure id → the outpost defense id; buildingPads lists the mesa
 *     pads that count as buildings for a breach; lanes are the raid spawn points.
 *     Because the sim only ever advances in FIXED_DT ticks, a raid stepped live with any frame timing and then
 *     finished headless gives exactly the result runRaid gives.
 *
 *     bakeTune: leave it out (the default {}, bakeTerrain's own defaults, as main.js uses without a saved tune) in the
 *     live view AND the away hook alike: the bake tune shapes the cliffs, so a different tune is a different raid.
 *
 *   makeRaidHook({ map, step, units? })  → (outpost, raid) => { result, defenses, events, ticks, timedOut }
 *     The ctx.raid adapter for advance(): advance(o, t, { map, raid: makeRaidHook({ map, step }) }) runs every
 *     due raid headless, in order, during catch-up. `step` is the planet's contract step (1–3) or a function
 *     (outpost) → step.
 *
 *   raidSize(planet, step) / raidUnits(planet, step)   the measured raid (Outpost_Raids via src/data/outpost.js)
 *   raidSeed(outpostSeed, raid)                         the sim seed of one raid (the outpost seed + the raid window)
 *   wellDefended(outpost, map)                          the starter kit plus one Machine Gun (design §5.2), for
 *                                                       the measurement tool and the tests
 *
 * ── The raid rules ──────────────────────────────────────────────────────────────────────────────────────────────
 *
 *  - The board: the outpost map loaded exactly as a battle map (buildTerrainMap on its Forge export, with the bake
 *    tune, see raidSimMap); every finished building's pad is solid (raiders walk round the buildings, as the map
 *    validator assumes); the hub is the battle base, so raiders march on it along the map's ground spawns (the raid
 *    lanes). The base's super-cannon is off: the hub has no gun.
 *  - Sealed walls: an outpost, unlike a battle, may close its ramps with walls. A raider the battle router leaves
 *    idle (no open route) marches on the hub as if the defenses were not there, up to the first one in its way, and
 *    shoots it until it falls (siege, below).
 *  - The defenders: the outpost's defenses, each its Battle_Struct (STR-MG, STR-Cannon, STR-Wall) at its tier,
 *    starting from its SAVED HP. A destroyed defense (HP 0) is a wreck and is not placed. A defense that draws power
 *    and is not in raid.powered stays inert: it is placed (it blocks and can be shot) but never fires.
 *  - The raiders: one wave of the planet faction's tier I lightGround units (troops and assault tanks), the measured
 *    number for the contract step, cycling Units in order and alternating the raid lanes (the first lane drawn from
 *    the raid's seed). Raiders fire on the
 *    defenses they pass while they keep marching (the battle's engagesStructuresWhileAdvancing rule): a raid is
 *    dissidents trying to reach the buildings, and the wear they leave is what carries over between raids. Water's
 *    swimmers walk on an outpost's dry ground (domain Walker), since an outpost map has no water lane.
 *  - The result: a breach the moment any raider standing on the mesa top comes within BREACH_REACH of a mesa
 *    building (any finished, non-remote pad, the hub included; design §5.2). Held once every raider is dead. A raid still undecided after
 *    RAID_MAX_SEC is held (the survivors withdraw) and reports timedOut.
 *  - Deterministic: the sim is seeded with raidSeed(outpost.seed, raid) and steps only in FIXED_DT; no clock, no
 *    Math.random (replay-determinism contract, CLAUDE.md).
 */
import { createSim, stepSim, FIXED_DT } from '../sim/core.js';
import { startNextWave } from '../sim/waves.js';
import { createStructure } from '../sim/entities.js';
import { buildNavGrid, findWalkerPath } from '../sim/pathfinding.js';
import { getStructureDef } from '../data/tables.js';
import { referenceOutpost, powerGrids } from './model.js';
import { structureDef, raidFor } from '../data/outpost.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { buildTerrainMap } from '../sim/mapgen.js';

// buildTerrainMap reads a campaign map id for its workbook rows (resources, wave budgets); a raid replaces both, so
// any valid id serves. Map 1 is used.
const RAID_MAP_ID = 1;
const TERRAIN_CACHE = new WeakMap();   // forge export → Map(bake tune → buildTerrainMap result)

export const RAID_DT = FIXED_DT;
/** A raid undecided after this long is held: the survivors withdraw. */
export const RAID_MAX_SEC = 300;
/** A raider this close (cells, from its centre to a pad's edge) to a mesa building has breached. */
export const BREACH_REACH = 0.75;
/** Raid lanes for a map with no ground spawns (the draft layout): the north-west corner and the east edge. */
const DEFAULT_LANES = (cols, rows) => [{ x: 0, y: 3 }, { x: cols - 1, y: rows - 5 }];
const MESA_TOP = 2;   // outpostPads HEIGHT.TOP
/** Where "well defended" puts its extra Machine Gun: beside the kit's Cannon (measured on Verdance: it holds more
 *  than beside the kit's MG). */
export const WELL_DEFENDED_NEAR = 'cannon';
/** The outpost seeds the measurement and the tests run, so both read the same medians. */
export const MEASURE_SEEDS = Object.freeze([11, 222, 3333, 44444, 555555, 6, 77]);
const KEEP_EVENTS = new Set(['spawn', 'kill', 'build']);

function mix(a, b) {
  let h = ((a >>> 0) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
/** The sim seed of one raid: the outpost seed and the raid window (the scripted first raid has its own key). */
export function raidSeed(outpostSeed, raid = {}) {
  const key = raid.first ? 0x7f1257 : raid.window != null ? raid.window : Math.floor((raid.at || 0) / 60_000);
  return mix(outpostSeed >>> 0, key) || 1;
}

/** The measured raid size for a planet's contract step (Outpost_Raids), or 0 when the data has none. */
export const raidSize = (planet, step = 1) => (raidFor(planet, step) || {}).size || 0;
/** The raid's units, in spawn order: the size taken from Units cycled in order. */
export function raidUnits(planet, step = 1) {
  const r = raidFor(planet, step);
  if (!r || !r.units.length) return [];
  return Array.from({ length: r.size }, (_, i) => r.units[i % r.units.length]);
}

// ── the board ────────────────────────────────────────────────────────────────────────────────────────────────────
const dims = (map) => ({ cols: map.width ?? map.cols, rows: map.height ?? map.rows });

/** The mesa pads that count as buildings for a breach: finished, not remote. */
function buildingPadsOf(outpost, map) {
  return map.pads.filter((p) => !p.remote && outpost.pads[p.id]);
}

/**
 * The battle-sim map for a raid on this outpost (see the board rule above). A Forge outpost map (map.forge, from
 * outpostMapFromForge) is loaded exactly as a battle map is: buildTerrainMap(forge, …, { bakeTune }) with the same
 * default bake tune main.js uses, so the raid's blocking is the drawn terrain's. Only what a battle adds and an outpost
 * has not is then replaced: the base sits on the hub, the waves come down the raid lanes, there are no surface
 * resources (no harvesters) and no wave windows, and finished buildings are solid. The draft layout (no terrain)
 * gets an open board of its size. opts.bakeTune: the render's tf.bake.v1 tune, when the live view has one.
 */
export function raidSimMap(outpost, map, opts = {}) {
  const hub = map.pads.find((p) => p.role === 'hub');
  const bx = Math.floor(hub.x + hub.w / 2), by = Math.floor(hub.y + hub.h / 2);
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push({ x: bx + dx, y: by + dy });
  const inBase = (x, y) => Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1;
  let m;
  if (map.forge) {
    // the terrain board depends only on the forge export and the bake tune: build it once per map (it is the costly
    // part of a raid's setup) and never mutate it — everything a raid changes is replaced below
    const tune = opts.bakeTune || {}, key = JSON.stringify(tune);
    let byTune = TERRAIN_CACHE.get(map.forge);
    if (!byTune) TERRAIN_CACHE.set(map.forge, (byTune = new Map()));
    if (!byTune.has(key)) byTune.set(key, buildTerrainMap(map.forge, RAID_MAP_ID, { seed: 0, bakeTune: tune }));
    m = byTune.get(key);
  } else {
    const { cols, rows } = dims(map);
    const waterCells = [], blockedCells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (map.terrain && map.terrain[i] === TERRAIN.WATER) waterCells.push({ x, y });
      else if (map.blocking && map.blocking[i]) blockedCells.push({ x, y });
    }
    m = { openPlay: true, cols, rows, tile: 1, waterCells, blockedCells, waterLane: [], decor: [] };
  }
  const { cols, rows } = m;
  // finished buildings are solid (the hub is the base: its 3 × 3 core stays clear, as in a battle)
  const blocked = new Set(m.blockedCells.filter((c) => !inBase(c.x, c.y)).map((c) => c.y * cols + c.x));
  for (const p of map.pads) {
    if (p.role === 'hub' || !outpost.pads[p.id]) continue;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x < cols && y < rows) blocked.add(y * cols + x);
  }
  const ground = (map.spawns || []).filter((s) => (s.lane || 'ground') === 'ground').map((s) => ({ x: s.x, y: s.y }));
  const lanes = ground.length ? ground : DEFAULT_LANES(cols, rows);
  return {
    ...m,
    outpostRaid: true, name: `${outpost.planet} outpost raid`,
    base: { x: bx, y: by, hp: 3000, footprint: { w: 3, h: 3 }, cells, cornerSlots: [] },
    blockedCells: [...blocked].sort((a, b) => a - b).map((i) => ({ x: i % cols, y: (i / cols) | 0 })),
    waterCells: m.waterCells.filter((c) => !inBase(c.x, c.y)),
    groundLane: [lanes[0], { x: bx, y: by }], spawnGround: lanes[0], spawnAir: lanes[0], spawnWater: lanes[0],
    rings: [{ wave: 1, rect: { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1, w: cols, h: rows }, sideFocus: null,
      spawns: { ground: lanes[0], air: lanes[0], water: lanes[0] }, spawnList: { ground: lanes, air: [], water: [] } }],
    waveWindows: [], playArea: null, resources: [], slots: [], buildableCells: [],
  };
}

/** The starter kit plus one more Machine Gun (design §5.2 "well defended"), on the free, buildable, powered mesa-top
 *  cell (off the pads) nearest the kit's Cannon (WELL_DEFENDED_NEAR). → a new outpost (the one passed in is unchanged). */
export function wellDefended(outpost, map, { near = WELL_DEFENDED_NEAR } = {}) {
  const o = JSON.parse(JSON.stringify(outpost));
  const anchor = o.defenses.find((d) => d.kind === near) || o.defenses[0];
  const { cols, rows } = dims(map);
  const station = map.pads.find((p) => p.role === 'power' && !p.remote);
  const reach = (structureDef('power', 1) || {}).reach || 10;
  const sc = [station.x + station.w / 2, station.y + station.h / 2];
  const taken = new Set(o.defenses.map((d) => `${d.cell[0]},${d.cell[1]}`));
  let best = null;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (taken.has(`${x},${y}`)) continue;
    if (map.pads.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)) continue;   // off the pads
    if (map.blocking && map.blocking[i]) continue;
    if (map.terrain && map.terrain[i] === TERRAIN.WATER) continue;
    if (map.heights && map.heights[i] !== 2) continue;                       // on the mesa top
    if (Math.hypot(x + 0.5 - sc[0], y + 0.5 - sc[1]) > reach) continue;      // powered by the first station
    const d = Math.hypot(x - anchor.cell[0], y - anchor.cell[1]);
    if (!best || d < best.d - 1e-9) best = { d, cell: [x, y] };
  }
  const n = Math.max(0, ...o.defenses.map((d) => +String(d.id).slice(1) || 0)) + 1;
  o.defenses.push({ id: `d${n}`, kind: 'mg', tier: 1, cell: best.cell, hp: structureDef('mg', 1).battle.hp });
  return o;
}

// ── the raid ─────────────────────────────────────────────────────────────────────────────────────────────────────
const toRect = (p) => ({ x0: p.x - 0.5, y0: p.y - 0.5, x1: p.x + p.w - 0.5, y1: p.y + p.h - 0.5 });
const rectDist = (r, x, y) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));

/**
 * Build a raid ready to tick. See the API at the top of the file.
 * opts: { map (the outpost map), step (contract step, default 1), seed (overrides raidSeed), units (overrides the
 * measured raid: an array of unit ids, used by the measurement tool) }.
 */
export function createRaid(outpost, raid = {}, opts = {}) {
  const map = opts.map;
  if (!map) throw new Error('createRaid: opts.map (the outpost map) is required');
  const step = opts.step || 1;
  const units = opts.units || raidUnits(outpost.planet, step);
  const seed = opts.seed != null ? opts.seed : raidSeed(outpost.seed, raid);
  const powered = raid.powered instanceof Set ? raid.powered : new Set(raid.powered || []);
  const simMap = raidSimMap(outpost, map, opts);
  // which lane the first raider takes is drawn from the raid's seed; the raiders then alternate the lanes
  const lanes = simMap.rings[0].spawnList.ground, k = seed % lanes.length;
  simMap.rings[0].spawnList.ground = [...lanes.slice(k), ...lanes.slice(0, k)];
  const waves = [{ faction: outpost.planet, spawns: units.map((unitId) => ({ unitId, lane: 'ground', count: 1, delay: 0, interval: 0 })) }];
  const state = createSim(seed, { map: simMap, waves });
  state.base.cannon = null;                       // the hub has no super-cannon
  state.economy.money = 0;

  // the defenses, from their saved HP
  const defenseIds = new Map(), placed = [];
  for (const d of outpost.defenses) {
    if (!(d.hp > 0)) continue;                    // a wreck until repaired
    const od = structureDef(d.kind, d.tier);
    const def = getStructureDef(od.battleStruct);
    const s = createStructure(state, od.battleStruct, { x: d.cell[0], y: d.cell[1] });
    s.tier = d.tier;
    s.maxHp = def.hp[d.tier - 1];
    s.hp = Math.min(d.hp, s.maxHp);
    s.dps = def.dps[d.tier - 1];
    s.lifecycle = s.hp < s.maxHp ? 'Damaged' : 'Complete';
    s.progress = 0;
    if (od.draw > 0 && !powered.has(d.id)) { s.stunnedUntil = Infinity; s.unpowered = true; }   // inert
    state.structures.set(s.id, s);
    defenseIds.set(s.id, d.id);
    placed.push([d.id, s]);
  }
  state.navGrid = buildNavGrid(state.map, Array.from(state.structures.values()));
  startNextWave(state);

  const buildingPads = buildingPadsOf(outpost, map);
  const rects = buildingPads.map(toRect);
  const { cols: mc, rows: mr } = dims(map);
  const onTop = map.heights ? (u) => {
    const x = Math.round(u.pos.x), y = Math.round(u.pos.y);
    return x >= 0 && y >= 0 && x < mc && y < mr && map.heights[y * mc + x] === MESA_TOP;
  } : null;
  const maxTicks = Math.ceil(RAID_MAX_SEC / RAID_DT);
  const kept = [];
  let outcome = null, acc = 0, timedOut = false, breachBy = null;

  const raidify = () => {
    for (const u of state.units.values()) {
      if (u._raider || u.side !== 'attacker') continue;
      u._raider = true;
      u.engagesStructuresWhileAdvancing = true;   // fire on the defenses passed, keep marching
      if (u.domain !== 'Walker') {                // swimmers walk on an outpost's dry ground
        u.domain = 'Walker'; u.altitude = 0; u.path = []; u.pathIdx = 0; u.routeIdx = null;
      }
    }
  };
  // walls may seal the hub (an outpost, unlike a battle, may close its ramps): a raider the battle router leaves
  // idle (no open route) marches on the hub as if the defenses were not there, but only up to the first one in its
  // way; there it stands and shoots it (the nearest structure in range) until it falls and the router reopens.
  const openGrid = buildNavGrid(state.map, []);
  const base = { x: simMap.base.x, y: simMap.base.y };
  const siege = () => {
    const g = state.navGrid;
    for (const u of state.units.values()) {
      if (u.side !== 'attacker' || u.hp <= 0 || u.state !== 'idle') continue;
      if (u.path && u.pathIdx < u.path.length) continue;
      const p = findWalkerPath(openGrid, { x: Math.round(u.pos.x), y: Math.round(u.pos.y) }, base) || [];
      // the cells of the open path up to the first one a defense blocks (a smoothed path skips cells, so walk the
      // straight segments between its waypoints cell by cell)
      const out = [];
      let at = { x: Math.round(u.pos.x), y: Math.round(u.pos.y) }, blocked = false;
      for (const w of p) {
        const n = Math.max(Math.abs(w.x - at.x), Math.abs(w.y - at.y));
        for (let k = 1; k <= n && !blocked; k++) {
          const c = { x: Math.round(at.x + ((w.x - at.x) * k) / n), y: Math.round(at.y + ((w.y - at.y) * k) / n) };
          if (!g.passable[c.y * g.cols + c.x] && !(Math.abs(c.x - base.x) <= 1 && Math.abs(c.y - base.y) <= 1)) blocked = true;
          else out.push(c);
        }
        if (blocked) break;
        at = w;
      }
      if (out.length) { u.path = out; u.pathIdx = 0; u.state = 'moving'; }
    }
  };
  const decide = () => {
    for (const u of state.units.values()) {
      if (u.side !== 'attacker' || u.hp <= 0) continue;
      if (onTop && !onTop(u)) continue;           // below the mesa's cliff is not at a building
      if (rects.some((r) => rectDist(r, u.pos.x, u.pos.y) <= BREACH_REACH)) { breachBy = u; return 'breach'; }
    }
    const w = state.waves;
    let alive = false;
    for (const u of state.units.values()) if (u.side === 'attacker' && u.hp > 0) { alive = true; break; }
    if (!w.pendingSpawns.length && !alive) return 'held';
    if (state.tick >= maxTicks) { timedOut = true; return 'held'; }
    return null;
  };

  const obj = {
    state, dt: RAID_DT, defenseIds, buildingPads, lanes: simMap.rings[0].spawnList.ground, seed, units: units.slice(),
    get done() { return outcome !== null; },
    tick() {
      if (outcome) return [];
      raidify();
      const evs = stepSim(state, RAID_DT);
      for (const e of evs) if (KEEP_EVENTS.has(e.type)) kept.push(e);
      siege();
      const r = decide();
      if (r) {
        const ev = { type: r === 'breach' ? 'raidBreach' : 'raidHeld', tick: state.tick, timedOut };
        if (breachBy) Object.assign(ev, { entityId: breachBy.id, unitId: breachBy.unitId, pos: { x: breachBy.pos.x, y: breachBy.pos.y } });
        kept.push(ev); evs.push(ev);
        outcome = {
          result: r,
          defenses: outpost.defenses.map((d) => {
            const hit = placed.find(([id]) => id === d.id);
            return { id: d.id, hp: hit ? Math.max(0, Math.round(hit[1].hp * 1000) / 1000) : d.hp };
          }),
          events: kept, ticks: state.tick, timedOut,
        };
      }
      return evs;
    },
    step(seconds) {
      const out = [];
      acc += Math.max(0, seconds);
      while (acc >= RAID_DT - 1e-12 && !outcome) { acc -= RAID_DT; for (const e of obj.tick()) out.push(e); }
      return out;
    },
    finish(onTick) {
      while (!outcome) { const evs = obj.tick(); if (onTick) onTick(evs, obj); }
      return outcome;
    },
    result() { return outcome; },
  };
  return obj;
}

/** Run a raid headless to its end (see the API at the top of the file). */
export function runRaid(outpost, raid, opts = {}) {
  return createRaid(outpost, raid, opts).finish(opts.onTick);
}

/** The ctx.raid adapter for advance(): every due raid runs headless on the battle sim. */
export function makeRaidHook({ map, step = 1, units } = {}) {
  return (outpost, raid) => runRaid(outpost, raid, { map, step: typeof step === 'function' ? step(outpost) : step, units });
}

// ── measurement helpers (tools/economy/outpost_raids.mjs and the tests) ─────────────────────────────────────────────
/**
 * The outpost a contract step is played with (design §2.3–§2.4): step 1 the reference set (referenceOutpost); step 2 adds a Rig I on the uncommon
 * deposit and upgrades the first station to Power Station II; step 3 adds a Rig I on the remote rare deposit with its
 * own station. Every building finished, the kit's defenses at full HP.
 */
export function stepOutpost(planet, step, { map, seed = 1 }) {
  const o = referenceOutpost(planet, { seed, map, now: 0 });
  const padFor = (tier) => (map.deposits.find((d) => d.tier === tier) || {}).pad;
  if (step >= 2) {
    const first = map.pads.find((p) => p.role === 'power' && !p.remote);
    o.pads[first.id] = { kind: 'power', tier: 2 };
    const r2 = padFor('uncommon');
    if (r2) { o.pads[r2] = { kind: 'rig', tier: 1, deposit: 'uncommon', deep: false }; o.storage[r2] = {}; }
  }
  if (step >= 3) {
    const r3 = padFor('rare');
    const p2 = map.pads.find((p) => p.role === 'power' && p.remote);
    if (r3) { o.pads[r3] = { kind: 'rig', tier: 1, deposit: 'rare', deep: false }; o.storage[r3] = {}; }
    if (p2) o.pads[p2.id] = { kind: 'power', tier: 1 };
  }
  return o;
}

/**
 * Raids held before the first breach, with no repairs between raids (design §5.2): raid after raid (windows 0, 1, …)
 * on the outpost, each defense keeping the HP it ended the last raid with. → n (max when none breached).
 * opts: { map, step, units? (default the measured raid), max = 20, bakeTune? }.
 */
export function holdsBeforeBreach(outpost, { map, step = 1, units, max = 20, bakeTune } = {}) {
  const o = JSON.parse(JSON.stringify(outpost));
  for (let k = 0; k < max; k++) {
    const r = runRaid(o, { window: k, at: k, powered: powerGrids(o, map).powered }, { map, step, units, bakeTune });
    if (r.result === 'breach') return k;
    for (const d of r.defenses) o.defenses.find((x) => x.id === d.id).hp = d.hp;
  }
  return max;
}
