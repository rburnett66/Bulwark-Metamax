// mapgen.js — build a campaign map from the Map Design GDD's workbook data (content/maps/mapdata.js).
//
// The GDD's model (v1.2): the player starts in a small pocket and the playable area grows outward in
// concentric RINGS after each wave (Growth_Curve / Wave_Table). Spawns sit 2 tiles outside the current
// edge on the wave's focus side. Resources follow the radial gradient: primary near the base, premium
// deep in the newly-opened ring on the spawn side, quest at the far edge on the OPPOSITE side
// (waves 5–8 only). The workbook holds the values; this module holds the geometry.
//
// Output = the engine's full MAP contract (createSim/buildNavGrid/renderer all read it) PLUS:
//   rings:      per-wave playable rect + spawn points + side focus + lane budgets
//   resources:  node list {id, type, role, wave, x, y, grade, units, valuePerUnit, respawns}
// Deterministic: same (mapId, seed, overrides) → identical map. Edits from the Map Lab tool arrive as
// an OVERRIDES object (applyOverrides) so hand-tuning never forks the generator.
import { MAPDATA } from '../../content/maps/mapdata.js';
import { createRng } from './rng.js';
import { buildNavGrid, findWalkerPath } from './pathfinding.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { bakedBlocking } from '../terrain/terrainBake.js';
import { WAVE_WINDOWS } from '../../content/maps/wave-windows.js';
import { POINTS_TO_POWER } from './campaign.js';

const TILE = 64;   // matches tables.js MAP_TILE — 64px/tile
// SAFE BORDER (owner, 2026-07-13): 2 tiles of non-buildable approach terrain wrap the battlefield.
// Enemy spawns live INSIDE it (2 outside the play edge, as the ring schedule always specified, no
// more clamping onto the play area) and the player cannot build there. map.playArea marks the field.
const BORDER = 2;
const BASE_HP = 3000;

export function mapDef(mapId) {
  const m = MAPDATA.maps.find((r) => r.Map_ID === mapId);
  if (!m) throw new Error(`mapgen: unknown map ${mapId}`);
  return m;
}
export function waveRows(mapId) {
  return MAPDATA.waveTable.filter((r) => r.Map_ID === mapId).sort((a, b) => a.Wave - b.Wave);
}
export function resourceDef(type, tier) {
  return MAPDATA.resources.find((r) => r.Resource === type && r.Tier === tier) || null;
}
/** GDD §5.2: the three roles for a (map, faction) pairing — primary from the map, premium from the
 *  faction (secondary on clash), quest = the remaining type. Precomputed for all 81 pairings. */
export function rolesFor(mapId, factionId) {
  const row = MAPDATA.resourceRoles.find(
    (r) => r.Map === `Map_${String(mapId).padStart(2, '0')}` && r.Faction === `Faction_${String(factionId).padStart(2, '0')}`);
  if (!row) throw new Error(`mapgen: no resource roles for map ${mapId} faction ${factionId}`);
  return { primary: row.Map_Primary, premium: row.Premium_Effective, quest: row.Quest_Resource, swapped: row['Swapped?'] === 'SWAPPED' };
}

// playable rect for a wave: centered on the map center, workbook dims, clamped to full size
function ringRect(full, row) {
  const w = Math.min(row.Playable_W, full.Full_W), h = Math.min(row.Playable_H, full.Full_H);
  const x0 = Math.floor((full.Full_W - w) / 2), y0 = Math.floor((full.Full_H - h) / 2);
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1, w, h };
}

// spawn point on the focus side, 2 tiles outside the current edge (workbook Spawn_Dist_* is measured
// from center and already includes the +2), clamped inside the full board so units exist on-grid.
function spawnFor(full, rect, side, cy, cx) {
  const c = { x: Math.floor(full.Full_W / 2), y: Math.floor(full.Full_H / 2) };
  let p;
  if (side === 'L') p = { x: rect.x0 - 2, y: cy };
  else if (side === 'R') p = { x: rect.x1 + 2, y: cy };
  else if (side === 'T') p = { x: cx, y: rect.y0 - 2 };
  else p = { x: cx, y: rect.y1 + 2 };
  return { x: Math.max(-BORDER, Math.min(full.Full_W - 1 + BORDER, p.x)),
           y: Math.max(-BORDER, Math.min(full.Full_H - 1 + BORDER, p.y)) };
}

const OPP = { L: 'R', R: 'L', T: 'B', B: 'T' };

// candidate cells of a band on one side (or all sides when side is null), shuffled deterministically
function bandCells(rect, inner, side, rng, blocked) {
  // band = cells inside `rect` but OUTSIDE `inner` (the previous ring); wave 1 has inner = null
  const cells = [];
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (inner && x >= inner.x0 && x <= inner.x1 && y >= inner.y0 && y <= inner.y1) continue;
      if (blocked.has(`${x},${y}`)) continue;
      if (side === 'L' && x > rect.x0 + Math.floor(rect.w * 0.35)) continue;
      if (side === 'R' && x < rect.x1 - Math.floor(rect.w * 0.35)) continue;
      if (side === 'T' && y > rect.y0 + Math.floor(rect.h * 0.35)) continue;
      if (side === 'B' && y < rect.y1 - Math.floor(rect.h * 0.35)) continue;
      cells.push({ x, y });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {   // Fisher–Yates on the seeded stream
    const j = Math.floor(rng() * (i + 1));
    const t = cells[i]; cells[i] = cells[j]; cells[j] = t;
  }
  return cells;
}

// meandering river for Has_Water maps: enters from one L/R edge OUTSIDE the wave-1 pocket, wanders
// horizontally, and STOPS short of the far edge — the dry tip is the ford that keeps every ground
// spawn BFS-connected to the base (GDD leaves water rules open; connectivity is the rule we add).
function buildRiver(full, pocket, rng) {
  const cells = [];
  const fromLeft = rng() < 0.5;
  const above = rng() < 0.5;  // river band above or below the pocket
  let y = above
    ? Math.max(1, pocket.y0 - 2 - Math.floor(rng() * 2))
    : Math.min(full.Full_H - 2, pocket.y1 + 2 + Math.floor(rng() * 2));
  const len = Math.floor(full.Full_W * (0.55 + rng() * 0.15));   // never spans the full width
  const lane = [];
  for (let i = 0; i < len; i++) {
    const x = fromLeft ? i : full.Full_W - 1 - i;
    const wide = 1 + (rng() < 0.5 ? 1 : 0);                       // 2–3 wide, breathes
    for (let dy = -1; dy <= wide - 1; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < full.Full_H) cells.push({ x, y: yy });
    }
    if (i % 3 === 2) lane.push({ x, y });
    if (rng() < 0.3) {                                            // meander, but stay off the pocket
      const step = rng() < 0.5 ? -1 : 1;
      const ny = y + step;
      const hitsPocket = above ? ny >= pocket.y0 - 1 : ny <= pocket.y1 + 1;
      if (ny > 1 && ny < full.Full_H - 2 && !hitsPocket) y = ny;
    }
  }
  return { cells, lane, entersLeft: fromLeft };
}

/**
 * Build the full campaign map. opts: { seed?: number, overrides?: object }.
 * Throws if the result can't satisfy the engine contract (spawn→base connectivity on every ring).
 */
export function buildCampaignMap(mapId, opts = {}) {
  const full = mapDef(mapId);
  const rows = waveRows(mapId);
  if (rows.length !== 8) throw new Error(`mapgen: map ${mapId} has ${rows.length} wave rows, want 8`);
  const seed = (opts.seed || 0) ^ (mapId * 0x9e3779b9);
  const rng = createRng(seed >>> 0).next;   // createRng returns {next,...}; the closure carries the state

  const cx = Math.floor(full.Full_W / 2), cy = Math.floor(full.Full_H / 2);
  const pocket = ringRect(full, rows[0]);

  // ── base: 3×3 plus at the map center (the ring model is concentric around it) ──
  const baseCells = [], cornerSlots = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    (Math.abs(dx) === 1 && Math.abs(dy) === 1 ? cornerSlots : baseCells).push({ x: cx + dx, y: cy + dy });
  }
  const base = { x: cx, y: cy, hp: BASE_HP, footprint: { w: 3, h: 3 }, cells: baseCells, cornerSlots };

  // ── water ──
  let waterCells = [], waterLane = [];
  if (full.Has_Water) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const river = buildRiver(full, pocket, rng);
      // never under the base footprint
      const bad = river.cells.some((c) => Math.abs(c.x - cx) <= 1 && Math.abs(c.y - cy) <= 1);
      if (!bad && river.cells.length) { waterCells = river.cells; waterLane = river.lane; break; }
    }
  }
  const waterSet = new Set(waterCells.map((c) => `${c.x},${c.y}`));

  // a GROUND spawn must be dry — the river can cross any edge band, and a spawn cell on water is an
  // impassable BFS source (units would materialize in the drink). Nudge along the spawn's axis to the
  // nearest dry cell, deterministically.
  const drySpawn = (p, side) => {
    if (!waterSet.has(`${p.x},${p.y}`)) return p;
    const vertical = side === 'L' || side === 'R';   // slide along the edge, not off it
    for (let d = 1; d < Math.max(full.Full_W, full.Full_H); d++) {
      for (const s of [1, -1]) {
        const q = vertical ? { x: p.x, y: p.y + d * s } : { x: p.x + d * s, y: p.y };
        if (q.x < -BORDER || q.y < -BORDER || q.x >= full.Full_W + BORDER || q.y >= full.Full_H + BORDER) continue;
        if (!waterSet.has(`${q.x},${q.y}`)) return q;
      }
    }
    return p;
  };

  // ── rings: per-wave rect + spawns + budgets ──
  const rings = [];
  let prevRect = null;
  for (const row of rows) {
    const rect = ringRect(full, row);
    const side = row.Side_Focus;
    // lateral spread along the focus edge so consecutive waves don't reuse the exact cell
    const gy = Math.max(rect.y0, Math.min(rect.y1, cy + Math.floor((rng() - 0.5) * rect.h * 0.5)));
    const gx = Math.max(rect.x0, Math.min(rect.x1, cx + Math.floor((rng() - 0.5) * rect.w * 0.5)));
    const ground = drySpawn(spawnFor(full, rect, side, gy, gx), side);
    // water spawns on the river where it crosses the focus half (water maps only)
    let water = null;
    if (full.Has_Water && row.Water_Pts > 0 && waterLane.length) {
      const half = waterLane.filter((p) => (side === 'L' ? p.x <= cx : side === 'R' ? p.x >= cx : true))
        .filter((p) => p.x >= rect.x0 - 2 && p.x <= rect.x1 + 2);
      water = (half.length ? half : waterLane)[0];
    }
    const air = spawnFor(full, rect, side, gy, gx);   // air shares the focus side; flies straight in
    rings.push({
      wave: row.Wave, rect, sideFocus: side,
      spawns: { ground, water, air },
      budget: { total: row.Spawn_Budget, ground: row.Ground_Pts, air: row.Air_Pts, water: row.Water_Pts },
      parSec: row.Wave_Par_Sec,
      nodes: { primary: row.Primary_Nodes, premium: row.Premium_Nodes, quest: row.Quest_Nodes,
               primaryQuota: row.Primary_Quota_Nodes },
    });
    prevRect = rect;
  }

  // ── resources: radial-gradient placement per wave (GDD §5) ──
  const blocked = new Set(waterSet);
  for (const c of baseCells) blocked.add(`${c.x},${c.y}`);
  for (const c of cornerSlots) blocked.add(`${c.x},${c.y}`);
  // BASE GAP (owner): no crops within 2 cells of base centre (the dock ring). Block it HERE so the
  // wave-1 economy seeds JUST OUTSIDE the gap — previously resources seeded inside it and harvest.js
  // culled them, wiping the wave-1 primary income (the "no buying power" bug, 2026-07-14).
  const BASE_GAP = 2;
  for (let dy = -BASE_GAP; dy <= BASE_GAP; dy++) for (let dx = -BASE_GAP; dx <= BASE_GAP; dx++) {
    blocked.add(`${cx + dx},${cy + dy}`);
  }
  const maxR = Math.hypot(full.Full_W / 2, full.Full_H / 2);
  const resources = [];
  let rid = 1, fid = 1;
  // Resources grow as FIELDS — connected clusters of cells the harvester works as one job. Primary
  // fields are patches (2-3 cells: the safe income you settle into); premium is usually a single
  // rich cell (the one-shot prize); quest is always a lone node at the far edge.
  // Owner tuning (2026-07-13): primary fields shrank 2-3 → 1-2 cells — the board carried too much
  // easy gold once collection landed (the harvest economy is now the faucet: no passive income).
  const CLUSTER = { primary: (r) => 1 + (r() < 0.5 ? 1 : 0), premium: (r) => 1 + (r() < 0.25 ? 1 : 0), quest: () => 1 };
  const place = (n, wave, band, type, role, rect) => {
    const def = resourceDef(type, role === 'premium' ? 'Premium' : 'Primary');
    let bi = 0;
    for (let i = 0; i < n; i++) {
      while (bi < band.length && blocked.has(`${band[bi].x},${band[bi].y}`)) bi++;
      if (bi >= band.length) break;
      const seed = band[bi++];
      const fieldId = `f${mapId}-${fid++}`;
      const cluster = [seed];
      const want = CLUSTER[role](rng);
      // grow the field over adjacent free cells inside the ring
      while (cluster.length < want) {
        const from = cluster[Math.floor(rng() * cluster.length)];
        const cand = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const q = { x: from.x + dx, y: from.y + dy };
          if (q.x < rect.x0 || q.x > rect.x1 || q.y < rect.y0 || q.y > rect.y1) continue;
          if (blocked.has(`${q.x},${q.y}`) || cluster.some((c) => c.x === q.x && c.y === q.y)) continue;
          cand.push(q);
        }
        if (!cand.length) break;
        cluster.push(cand[Math.floor(rng() * cand.length)]);
      }
      for (const c of cluster) {
        blocked.add(`${c.x},${c.y}`);
        resources.push({
          id: `r${mapId}-${rid++}`, fieldId, type, role, wave, x: c.x, y: c.y,
          grade: Math.min(1, Math.hypot(c.x - cx, c.y - cy) / maxR),   // radial gradient: tier reads off position
          units: def ? def.Units_Per_Node : 20,
          valuePerUnit: role === 'quest' ? 0 : (def ? def.Value_Per_Unit : 4),
          respawns: role === 'primary' ? !!(def && def.Respawns_In_Match) : false,
        });
      }
    }
  };
  const primaryType = full.Primary_Resource;
  prevRect = null;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i], row = rows[i];
    // PRIMARY: in the new ring, inner half (near-base bias) — any side. Safe income.
    const primBand = bandCells(ring.rect, prevRect, null, rng, blocked)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    place(ring.nodes.primary, ring.wave, primBand, primaryType, 'primary', ring.rect);
    // PREMIUM: deep in the new ring on the FOCUS side — the blood price. Type is per-faction
    // (rolesFor), so nodes carry role 'premium'; the campaign glue resolves the type at match
    // start. Placeholder type = the non-primary with the highest tier value.
    const premBand = bandCells(ring.rect, prevRect, ring.sideFocus, rng, blocked)
      .sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
    place(ring.nodes.premium, ring.wave, premBand, 'PREMIUM', 'premium', ring.rect);
    // QUEST: waves 5–8, far edge (outer 20% of radius) on the OPPOSITE side — the tempo price.
    if (ring.nodes.quest > 0) {
      const qBand = bandCells(ring.rect, null, OPP[ring.sideFocus] || null, rng, blocked)
        .filter((c) => Math.hypot(c.x - cx, c.y - cy) / maxR >= 0.8 * (ring.rect.w / full.Full_W));
      place(ring.nodes.quest, ring.wave, qBand, 'QUEST', 'quest', ring.rect);
    }
    prevRect = ring.rect;
  }

  // ── engine contract fields ──
  const slots = [...cornerSlots];
  // advisory hardpoints on the pocket edge midpoints + corners
  for (const p of [{ x: pocket.x0, y: cy }, { x: pocket.x1, y: cy }, { x: cx, y: pocket.y0 }, { x: cx, y: pocket.y1 },
                   { x: pocket.x0, y: pocket.y0 }, { x: pocket.x1, y: pocket.y0 }, { x: pocket.x0, y: pocket.y1 }, { x: pocket.x1, y: pocket.y1 }]) {
    if (!waterSet.has(`${p.x},${p.y}`)) slots.push({ x: p.x, y: p.y });
  }
  const buildableCells = [];
  const slotSet = new Set(slots.map((c) => `${c.x},${c.y}`));
  const fullRect = rings[rings.length - 1].rect;
  for (let y = fullRect.y0; y <= fullRect.y1; y++) {
    for (let x = fullRect.x0; x <= fullRect.x1; x++) {
      const k = `${x},${y}`;
      if (waterSet.has(k) || slotSet.has(k)) continue;
      if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) continue;
      buildableCells.push({ x, y });
    }
  }

  const g8 = rings[7].spawns.ground;
  const map = {
    // OPEN PLAY (owner, 2026-07-13): the whole map is visible, buildable, and harvestable from
    // wave 1 — ring rects remain as the per-wave SPAWN schedule (enemies enter farther out as
    // waves progress) and as node metadata, but they no longer gate the player. Set false to
    // restore GDD §3 ring-gating for a map.
    openPlay: true,
    cols: full.Full_W, rows: full.Full_H, tile: TILE,
    spawnGround: rings[0].spawns.ground,
    spawnWater: rings[0].spawns.water || rings[0].spawns.ground,
    spawnAir: rings[0].spawns.air,
    waterCells, waterLane: waterLane.length ? [...waterLane, { x: cx, y: cy }] : [],
    groundLane: [g8, { x: cx, y: cy }],   // render hint: the long approach
    base, slots, buildableCells,
    // maps extension
    mapId, name: full.Map_Name, primary: primaryType, hasWater: !!full.Has_Water,
    difficulty: full.Difficulty, parTimeSec: full.Par_Time_Sec, questGiver: full.Quest_Giver_Faction,
    seed: opts.seed || 0, rings, resources,
  };
  // ── SAFE BORDER: shift the whole battlefield +BORDER into a widened grid. The border ring is
  //    approach terrain — spawns live there (finally OUTSIDE the play edge with no clamping), the
  //    player cannot build there (structures.js checks map.playArea), resources never spawn there.
  {
    // identity-set guard: several map fields share point OBJECTS (spawnGround aliases
    // rings[0].spawns.ground, slots embed base.cornerSlots) — each object shifts exactly once
    const seenPts = new Set();
    const sh = (c) => { if (c && !seenPts.has(c)) { seenPts.add(c); c.x += BORDER; c.y += BORDER; } };
    map.cols += 2 * BORDER; map.rows += 2 * BORDER;
    sh(map.spawnGround); sh(map.spawnWater); sh(map.spawnAir);
    for (const c of map.waterCells) sh(c);
    for (const c of map.waterLane) sh(c);
    for (const c of map.groundLane) sh(c);
    map.base.x += BORDER; map.base.y += BORDER;
    for (const c of map.base.cells) sh(c);
    for (const c of map.base.cornerSlots) sh(c);
    for (const c of map.slots) sh(c);
    for (const c of map.buildableCells) sh(c);
    for (const r of map.resources) { r.x += BORDER; r.y += BORDER; }
    for (const ring of map.rings) {
      ring.rect.x0 += BORDER; ring.rect.x1 += BORDER; ring.rect.y0 += BORDER; ring.rect.y1 += BORDER;
      sh(ring.spawns.ground); sh(ring.spawns.water); sh(ring.spawns.air);
    }
    map.border = BORDER;
    map.playArea = { x0: BORDER, y0: BORDER, x1: map.cols - 1 - BORDER, y1: map.rows - 1 - BORDER };
  }
  if (opts.overrides) applyOverrides(map, opts.overrides);

  // ── the contract's hard rule: every ring's ground spawn must reach the base ──
  for (const ring of rings) {
    const nav = buildNavGrid(map, []);
    const p = findWalkerPath(nav, ring.spawns.ground, { x: base.x, y: base.y });
    if (!p || p.length === 0) throw new Error(`mapgen: map ${mapId} wave ${ring.wave} ground spawn cannot reach the base`);
  }
  return map;
}

/**
 * Resolve faction-dependent resource types (GDD §5.2): premium nodes take the faction's effective
 * premium (secondary on clash), quest nodes take the remaining third type. Call at match start —
 * and in the Map Lab preview — with the chosen faction. Mutates and returns the map.
 */
export function resolveResourceTypes(map, factionId) {
  const roles = rolesFor(map.mapId, factionId);
  for (const r of map.resources) {
    if (r.role === 'premium') {
      r.type = roles.premium;
      const def = resourceDef(roles.premium, 'Premium');
      if (def) { r.units = def.Units_Per_Node; r.valuePerUnit = def.Value_Per_Unit; }
    } else if (r.role === 'quest') {
      r.type = roles.quest;   // pays loyalty, never gold — valuePerUnit stays 0
    }
  }
  map.roles = roles;
  return map;
}

/**
 * STAGE 2 — build a playable game map from a Terrain Forge export (terrain.html EXPORT / saved slot).
 * The forge supplies GEOMETRY (grid size, base, terrain, blocking, resources, per-wave spawns); the
 * WAVE BUDGETS + faction schedule stay from the map's workbook rows (waveRows) so balance is unchanged.
 * Produces the same MAP contract createSim/buildNavGrid/renderer read, plus map.terrain (render) and
 * map.blockedCells (impassable). Deterministic — a pure function of (forge, mapId).
 */
export function buildTerrainMap(forge, mapId, opts = {}) {
  const cols = forge.cols | 0, rows = forge.rows | 0;
  const T = forge.terrain || [];
  // BLOCKING must match what the digicam bake DRAWS. The bake domain-warps its terrain samples for organic
  // cliff outlines, so the grid-aligned forge.blocking desyncs from the drawn cliffs — units then path onto
  // cells that look like solid cliff ("walks into a cliff and gets stuck"). When the caller passes the same
  // bake tune the render uses (tf.bake.v1), recompute the blocking under that warp so sim == picture.
  // seed/sub/warp mirror bakeTerrain's own defaults exactly (seed ?? 7, sub ?? 5, warp ?? 0.6) so the sim's
  // blocking equals the drawn terrain whether or not a tf.bake.v1 tune is present.
  const B = opts.bakeTune
    ? bakedBlocking({ cols, rows, terrain: T }, { seed: opts.bakeTune.seed, sub: opts.bakeTune.sub, warp: opts.bakeTune.warp })
    : (forge.blocking || []);
  const bpos = (forge.base && forge.base.pos) || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
  const bx = Math.max(1, Math.min(cols - 2, bpos.x | 0));
  const cy = Math.max(1, Math.min(rows - 2, bpos.y | 0));
  const baseCells = [], cornerSlots = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    (Math.abs(dx) === 1 && Math.abs(dy) === 1 ? cornerSlots : baseCells).push({ x: bx + dx, y: cy + dy });
  }
  const base = { x: bx, y: cy, hp: BASE_HP, footprint: { w: 3, h: 3 }, cells: baseCells, cornerSlots };
  const inBase = (x, y) => Math.abs(x - bx) <= 1 && Math.abs(y - cy) <= 1;
  // terrain → water (own layer) + blocking (impassable). The base gap stays clear.
  const waterCells = [], blockedCells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (inBase(x, y)) continue;
    const i = y * cols + x;
    if (T[i] === TERRAIN.WATER) waterCells.push({ x, y });
    else if (B[i]) blockedCells.push({ x, y });
  }
  const def = mapDef(mapId);
  const primaryType = def.Primary_Resource || 'Powder';
  const primDef = resourceDef(primaryType, 'Primary');
  const rows8 = waveRows(mapId);

  // ── RESOURCES: guarantee each map's economy per wave ──────────────────────────────────────────
  // Each resource binds to the FIRST wave-window that reveals it, and every wave is GUARANTEED its
  // workbook node counts: primary (blue) near the base, premium (yellow, the faction resource —
  // Flower/Crystal/Mineral) deeper, quest at the far edge. The forge's scattered pools are honored
  // where they exist; any shortfall is backfilled on walkable cells inside that wave's window, so a
  // map can never come up economically starved. Types/values for premium+quest resolve per faction
  // later (resolveResourceTypes); primary carries its own value here.
  const wins = ((forge.waveWindows && forge.waveWindows.length) ? forge.waveWindows : WAVE_WINDOWS)
    .map((w) => ({ wave: w.wave, x0: w.x - 1, y0: w.y - 1, x1: w.x - 1 + w.w - 1, y1: w.y - 1 + w.h - 1 }));
  const waveFor = (x, y) => {
    for (const w of wins) if (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) return w.wave;
    // outside every window → bind to the NEAREST window's wave (owner 2026-07-16: the old
    // last-window fallback silently pushed off-window painted nodes to wave 8 — "too few resources")
    let best = 1, bd = Infinity;
    for (const w of wins) {
      const dx = Math.max(w.x0 - x, 0, x - w.x1), dy = Math.max(w.y0 - y, 0, y - w.y1);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = w.wave; }
    }
    return best;
  };
  const occupied = new Set([...waterCells, ...blockedCells].map((c) => `${c.x},${c.y}`));
  // BASE GAP (story-mrmwo8dx6ke): honor the forge's authored gap — clear ring BEYOND the 3x3
  // footprint (half-width 1). gap=2 → no resources within ±3 of the base centre (docks included).
  const baseGapR = 1 + ((forge.base && forge.base.gap != null) ? forge.base.gap : 2);
  for (let dy = -baseGapR; dy <= baseGapR; dy++) for (let dx = -baseGapR; dx <= baseGapR; dx++) occupied.add(`${bx + dx},${cy + dy}`);
  const distC = (x, y) => Math.hypot(x - bx, y - cy);
  let rid = 0;
  const mkRes = (x, y, role, wave) => ({
    id: `t${mapId}-${role[0]}${rid++}-${x}-${y}`, type: primaryType, role, wave, x, y, grade: 0.5,
    units: (role === 'primary' && primDef) ? primDef.Units_Per_Node : 20,
    valuePerUnit: (role === 'primary' && primDef) ? primDef.Value_Per_Unit : 4,
    respawns: role === 'primary',
  });
  const resources = [];
  // nearest free cell to (x,y), searching outward — used to RELOCATE authored nodes that land on
  // occupied cells (water/blocked/base-gap) instead of silently dropping them (owner 2026-07-16:
  // painted fields near the base vanished into the gap ring → "the game starts with too few")
  const nearestFree = (x, y, maxR = 6) => {
    for (let R = 1; R <= maxR; R++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (!occupied.has(`${nx},${ny}`)) return { x: nx, y: ny };
    }
    return null;
  };
  for (const r of (forge.resources || [])) {           // honor the tool's authored/scattered pools first
    let { x, y } = r;
    if (occupied.has(`${x},${y}`)) {
      const alt = nearestFree(x, y);                   // pushed just past the gap/obstacle, field intact
      if (!alt) continue;
      x = alt.x; y = alt.y;
    }
    occupied.add(`${x},${y}`);
    const node = mkRes(x, y, r.role || 'primary', waveFor(x, y));
    if (r.color) node.color = r.color;                 // authored rare-1/rare-2 (red/green) sticks
    resources.push(node);
  }
  // STARTER FIELD (owner 2026-07-17): the ship landed HERE because of the resources, so wave 1 must
  // open with a genuine field — a dense ring of primary nodes hugging the base gap, not the old bare
  // >=3. It has to read as abundance the moment the match starts so the player over-invests in
  // harvesters early (respawning primary income snowballs). Pack the annulus just beyond the gap,
  // closest ring first, up to STARTER_FIELD_NODES, counting whatever the paint/backfill already put
  // near the base.
  {
    const STARTER_FIELD_NODES = 8;
    const nearR = baseGapR + 3;
    const isNear = (n) => n.role === 'primary' && n.wave === 1 && distC(n.x, n.y) <= nearR;
    let have = resources.filter(isNear).length;
    for (let R = baseGapR + 1; R <= nearR && have < STARTER_FIELD_NODES; R++) {
      for (let dy = -R; dy <= R && have < STARTER_FIELD_NODES; dy++)
        for (let dx = -R; dx <= R && have < STARTER_FIELD_NODES; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue;   // walk this ring's perimeter
          const x = bx + dx, y = cy + dy, k = `${x},${y}`;
          if (x < 0 || y < 0 || x >= cols || y >= rows || occupied.has(k)) continue;
          occupied.add(k); resources.push(mkRes(x, y, 'primary', 1)); have++;
        }
    }
  }
  for (const row of rows8) {                            // then GUARANTEE the workbook counts per wave
    const wave = row.Wave;
    const w = wins.find((x) => x.wave === wave) || { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 };
    const cellsIn = [];
    for (let y = Math.max(0, w.y0); y <= Math.min(rows - 1, w.y1); y++)
      for (let x = Math.max(0, w.x0); x <= Math.min(cols - 1, w.x1); x++)
        if (!occupied.has(`${x},${y}`)) cellsIn.push({ x, y });
    const near = [...cellsIn].sort((a, b) => distC(a.x, a.y) - distC(b.x, b.y));
    const far = [...cellsIn].sort((a, b) => distC(b.x, b.y) - distC(a.x, a.y));
    const guarantee = (role, want, pool) => {
      let have = resources.filter((rr) => rr.wave === wave && rr.role === role).length;
      for (const c of pool) {
        if (have >= want) break;
        const k = `${c.x},${c.y}`;
        if (occupied.has(k)) continue;
        occupied.add(k); resources.push(mkRes(c.x, c.y, role, wave)); have++;
      }
    };
    guarantee('primary', row.Primary_Nodes || 0, near);         // blue — near-base income
    guarantee('premium', row.Premium_Nodes || 0, far);          // yellow — faction resource, deeper
    if ((row.Quest_Nodes || 0) > 0) guarantee('quest', row.Quest_Nodes, far);   // far edge, waves 5-8
  }

  // rings: workbook BUDGETS + one forge spawn point per lane (from the wave's spread)
  const sbw = forge.spawnsByWave || (forge.spawns ? { 1: forge.spawns } : {});
  const pick = (wave, lane) => {
    const a = (sbw[wave] || sbw[String(wave)] || []).filter((s) => s.lane === lane);
    return a.length ? { x: a[(a.length / 2) | 0].x, y: a[(a.length / 2) | 0].y } : null;
  };
  const fullRect = { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1, w: cols, h: rows };
  const laneList = (wave, lane) => (sbw[wave] || sbw[String(wave)] || [])
    .filter((s) => s.lane === lane).map((s) => ({ x: s.x, y: s.y }));
  const rings = rows8.map((row, i) => {
    const wave = row.Wave || (i + 1);
    const ground = pick(wave, 'ground') || pick(wave, 'air') || { x: 0, y: cy };
    // TROOPS FOLLOW THE TOOL (owner 2026-07-16, v2): authored spawn points ARE the wave's unit
    // counts — 30 painted ground points means ~30 ground troops, not a proportion of the workbook
    // budget (the owner authored 50-80 point waves and got 4-9 units). One tier-1 unit ≈ 100 power
    // = 100/POINTS_TO_POWER budget points; fillLane's big anchors/cheap bodies keep ±texture.
    // Waves with NO authored points keep the workbook budget (generator behavior).
    const lists = { ground: laneList(wave, 'ground'), air: laneList(wave, 'air'), water: laneList(wave, 'water') };
    const nAuthored = lists.ground.length + lists.air.length + lists.water.length;
    let budget = { total: row.Spawn_Budget, ground: row.Ground_Pts, air: row.Air_Pts, water: row.Water_Pts };
    if (nAuthored > 0) {
      const PTS_PER_UNIT = 100 / POINTS_TO_POWER;          // ≈ one tier-1 unit in budget points
      budget = {
        ground: Math.round(lists.ground.length * PTS_PER_UNIT),
        air: Math.round(lists.air.length * PTS_PER_UNIT),
        water: Math.round(lists.water.length * PTS_PER_UNIT),
      };
      budget.total = budget.ground + budget.air + budget.water;
    }
    return { wave, rect: fullRect, sideFocus: null,
      spawns: { ground, water: pick(wave, 'water'), air: pick(wave, 'air') || ground },
      spawnList: nAuthored > 0 ? lists : null,              // ALL painted points — spawner cycles them
      budget,
      parSec: row.Wave_Par_Sec, nodes: { primary: 0, premium: 0, quest: 0, primaryQuota: 0 } };
  });
  // buildable / advisory slots: any open non-base, non-water, non-blocked cell
  const waterSet = new Set(waterCells.map((c) => `${c.x},${c.y}`));
  const blockSet = new Set(blockedCells.map((c) => `${c.x},${c.y}`));
  const buildableCells = [], slots = [...cornerSlots];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const k = `${x},${y}`;
    if (waterSet.has(k) || blockSet.has(k) || inBase(x, y)) continue;
    buildableCells.push({ x, y });
  }
  return {
    openPlay: true, cols, rows, tile: TILE,
    spawnGround: rings[0].spawns.ground, spawnWater: rings[0].spawns.water || rings[0].spawns.ground,
    spawnAir: rings[0].spawns.air,
    waterCells, waterLane: [], groundLane: [rings[7].spawns.ground, { x: bx, y: cy }],
    base, slots, buildableCells,
    terrain: T, blockedCells, fromForge: true,            // STAGE 2 extras
    palettes: forge.palettes || {},                       // tile-sheet names per terrain type (renderer bakes)
    baseGap: baseGapR,                                    // resource/crop clear radius from base centre
    waveWindows: wins,                                    // authored per-wave view rects — the camera frames THESE
    mapId, name: (def.Map_Name || `Map ${mapId}`) + ' (forge)', primary: primaryType,
    hasWater: waterCells.length > 0, difficulty: def.Difficulty, parTimeSec: def.Par_Time_Sec,
    questGiver: def.Quest_Giver_Faction, seed: opts.seed || 0, rings, resources,
    decor: forge.decor || [],                             // voxel-decor groves {x,y,type} scattered in Terrain Forge (Stage 3 renders them)
  };
}

/**
 * Apply Map Lab edits. overrides = {
 *   waterAdd: [{x,y}], waterRemove: [{x,y}],
 *   resourceMove: [{id,x,y}], resourceRemove: [id], resourceAdd: [{type,role,wave,x,y,units,valuePerUnit}],
 *   spawnMove: [{wave, lane:'ground'|'air'|'water', x, y}],
 * } — everything optional. Mutates and returns the map.
 */
export function applyOverrides(map, ov) {
  if (!ov) return map;
  const key = (c) => `${c.x},${c.y}`;
  if (ov.waterRemove && ov.waterRemove.length) {
    const rm = new Set(ov.waterRemove.map(key));
    map.waterCells = map.waterCells.filter((c) => !rm.has(key(c)));
  }
  if (ov.waterAdd && ov.waterAdd.length) {
    const have = new Set(map.waterCells.map(key));
    for (const c of ov.waterAdd) if (!have.has(key(c))) map.waterCells.push({ x: c.x, y: c.y });
  }
  if (ov.resourceRemove && ov.resourceRemove.length) {
    const rm = new Set(ov.resourceRemove);
    map.resources = map.resources.filter((r) => !rm.has(r.id));
  }
  if (ov.resourceMove) {
    for (const m of ov.resourceMove) {
      const r = map.resources.find((x) => x.id === m.id);
      if (r) { r.x = m.x; r.y = m.y; }
    }
  }
  if (ov.resourceAdd) {
    let n = 1;
    for (const a of ov.resourceAdd) {
      map.resources.push({ id: a.id || `ov-${n++}-${a.x}-${a.y}`, type: a.type || map.primary, role: a.role || 'primary',
        wave: a.wave || 1, x: a.x, y: a.y, grade: 0.5, units: a.units || 20, valuePerUnit: a.valuePerUnit ?? 4,
        respawns: (a.role || 'primary') === 'primary' });
    }
  }
  if (ov.spawnMove) {
    for (const s of ov.spawnMove) {
      const ring = map.rings.find((r) => r.wave === s.wave);
      if (ring && ring.spawns[s.lane]) { ring.spawns[s.lane] = { x: s.x, y: s.y }; }
      if (s.wave === 1) {
        if (s.lane === 'ground') map.spawnGround = { x: s.x, y: s.y };
        if (s.lane === 'air') map.spawnAir = { x: s.x, y: s.y };
        if (s.lane === 'water') map.spawnWater = { x: s.x, y: s.y };
      }
    }
  }
  return map;
}
