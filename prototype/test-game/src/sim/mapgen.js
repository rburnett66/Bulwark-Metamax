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

const TILE = 32;
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
  return { x: Math.max(0, Math.min(full.Full_W - 1, p.x)), y: Math.max(0, Math.min(full.Full_H - 1, p.y)) };
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
        if (q.x < 0 || q.y < 0 || q.x >= full.Full_W || q.y >= full.Full_H) continue;
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
  const maxR = Math.hypot(full.Full_W / 2, full.Full_H / 2);
  const resources = [];
  let rid = 1;
  const place = (n, wave, band, type, role) => {
    const def = resourceDef(type, role === 'premium' ? 'Premium' : 'Primary');
    for (let i = 0; i < n && i < band.length; i++) {
      const c = band[i];
      blocked.add(`${c.x},${c.y}`);
      resources.push({
        id: `r${mapId}-${rid++}`, type, role, wave, x: c.x, y: c.y,
        grade: Math.min(1, Math.hypot(c.x - cx, c.y - cy) / maxR),   // radial gradient: tier reads off position
        units: def ? def.Units_Per_Node : 20,
        valuePerUnit: role === 'quest' ? 0 : (def ? def.Value_Per_Unit : 4),
        respawns: role === 'primary' ? !!(def && def.Respawns_In_Match) : false,
      });
    }
  };
  const primaryType = full.Primary_Resource;
  prevRect = null;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i], row = rows[i];
    // PRIMARY: in the new ring, inner half (near-base bias) — any side. Safe income.
    const primBand = bandCells(ring.rect, prevRect, null, rng, blocked)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    place(ring.nodes.primary, ring.wave, primBand, primaryType, 'primary');
    // PREMIUM: deep in the new ring on the FOCUS side — the blood price. Type is per-faction
    // (rolesFor), so nodes carry role 'premium'; the campaign glue resolves the type at match
    // start. Placeholder type = the non-primary with the highest tier value.
    const premBand = bandCells(ring.rect, prevRect, ring.sideFocus, rng, blocked)
      .sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
    place(ring.nodes.premium, ring.wave, premBand, 'PREMIUM', 'premium');
    // QUEST: waves 5–8, far edge (outer 20% of radius) on the OPPOSITE side — the tempo price.
    if (ring.nodes.quest > 0) {
      const qBand = bandCells(ring.rect, null, OPP[ring.sideFocus] || null, rng, blocked)
        .filter((c) => Math.hypot(c.x - cx, c.y - cy) / maxR >= 0.8 * (ring.rect.w / full.Full_W));
      place(ring.nodes.quest, ring.wave, qBand, 'QUEST', 'quest');
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
