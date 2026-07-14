/**
 * src/terrain/terrainGen.js — procedural FEATURE MAP generator (owner design 2026-07-14).
 *
 * Stage 1 of the terrain pipeline: turn per-type PERCENTAGE + NOISE knobs into a grid where every
 * cell carries a terrain TYPE. Stage 2 (elsewhere) paints tile palettes over the types and bakes
 * the ground to one texture. This module is pure + deterministic (seeded value noise) so the tool
 * preview, the exported map, and the game all agree byte-for-byte.
 *
 * Types (priority high→low): water, cliff, trees, rocks, brush, dirt, grass.
 * Borders (tree/rock/cliff) are DERIVED: the perimeter of each blocking region.
 * Blocking (no ground movement / no build): trees, rocks, cliff, cliff-border, water.
 */

export const TERRAIN = Object.freeze({
  GRASS: 0, DIRT: 1, BRUSH: 2, ROCKS: 3, TREES: 4, CLIFF: 5, WATER: 6,
  TREE_BORDER: 7, ROCK_BORDER: 8, CLIFF_BORDER: 9,
});
export const TERRAIN_NAME = ['grass', 'dirt', 'brush', 'rocks', 'trees', 'cliff', 'water', 'tree-border', 'rock-border', 'cliff-border'];
export const BLOCKING = new Set([TERRAIN.TREES, TERRAIN.ROCKS, TERRAIN.CLIFF, TERRAIN.CLIFF_BORDER, TERRAIN.WATER]);
// tool preview colours (Stage 2 replaces these with the authored tile palettes)
export const TERRAIN_COLOR = ['#4f7a3a', '#8a6f43', '#6f8a3a', '#8d8d92', '#2f5a2f', '#7c7f86', '#2f6db0', '#173d17', '#55575c', '#5a5d63'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bilinear value noise in [0,1]. scale = grid frequency (higher = finer patches). */
function valueNoise(x, y, scale, seed) {
  const fx = x * scale, fy = y * scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const s = (a) => a * a * (3 - 2 * a);           // smoothstep
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const u = s(tx), v = s(ty);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
/** fBm (a few octaves) for organic, non-uniform fields. noiseLevel 0..1 maps to base frequency. */
function fbm(x, y, noiseLevel, seed) {
  const baseScale = 0.04 + noiseLevel * 0.22;    // low noise = big smooth regions, high = fine grain
  let v = 0, amp = 0.6, freq = baseScale, norm = 0;
  for (let o = 0; o < 3; o++) { v += valueNoise(x, y, freq, seed + o * 101) * amp; norm += amp; amp *= 0.5; freq *= 2.03; }
  return v / norm;
}

/** The Nth percentile threshold of a field so that ~pct% of cells exceed it (coverage control). */
function thresholdForPct(field, pct) {
  if (pct <= 0) return Infinity;
  if (pct >= 100) return -Infinity;
  const sorted = Float32Array.from(field).sort();
  const idx = Math.floor((1 - pct / 100) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

/**
 * @param {object} opts
 *   cols, rows, seed
 *   types: { grass, dirt, brush, rocks, trees, cliff } each { pct, noise }  (pct 0..100, noise 0..1)
 *   water: { mode:'patches'|'connected', pct, noise }
 * @returns {{ cols, rows, terrain: Uint8Array, blocking: Uint8Array }}
 */
export function generateTerrain(opts) {
  const cols = opts.cols | 0, rows = opts.rows | 0, seed = (opts.seed | 0) || 1;
  const n = cols * rows;
  const T = opts.types || {};
  const terrain = new Uint8Array(n).fill(TERRAIN.GRASS);

  // ── base: grass vs dirt by one field, split at the dirt percentage ──
  const dirtField = new Float32Array(n);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) dirtField[y * cols + x] = fbm(x, y, (T.dirt && T.dirt.noise) || 0.4, seed + 11);
  const dirtThr = thresholdForPct(dirtField, (T.dirt && T.dirt.pct) || 0);
  for (let i = 0; i < n; i++) terrain[i] = dirtField[i] >= dirtThr ? TERRAIN.DIRT : TERRAIN.GRASS;

  // ── feature layers, priority low→high so higher features overwrite (brush < rocks < trees < cliff) ──
  const layer = (type, cfg, seedOff) => {
    if (!cfg || (cfg.pct || 0) <= 0) return;
    const field = new Float32Array(n);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) field[y * cols + x] = fbm(x, y, cfg.noise || 0.4, seed + seedOff);
    const thr = thresholdForPct(field, cfg.pct);
    for (let i = 0; i < n; i++) if (field[i] >= thr) terrain[i] = type;
  };
  layer(TERRAIN.BRUSH, T.brush, 23);
  layer(TERRAIN.ROCKS, T.rocks, 37);
  layer(TERRAIN.TREES, T.trees, 53);
  layer(TERRAIN.CLIFF, T.cliff, 71);

  // ── water: patches (blob noise) or connected (keep only the largest blob) ──
  const W = opts.water || { pct: 0 };
  if ((W.pct || 0) > 0) {
    const wf = new Float32Array(n);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) wf[y * cols + x] = fbm(x, y, (W.noise != null ? W.noise : 0.25), seed + 97);
    const wthr = thresholdForPct(wf, W.pct);
    const water = new Uint8Array(n);
    for (let i = 0; i < n; i++) water[i] = wf[i] >= wthr ? 1 : 0;
    if (W.mode === 'connected') keepLargestBlob(water, cols, rows);
    for (let i = 0; i < n; i++) if (water[i]) terrain[i] = TERRAIN.WATER;
  }

  // ── borders: perimeter of each blocking region gets its *-border variant ──
  const idx = (x, y) => y * cols + x;
  const isBlockType = (t) => t === TERRAIN.TREES || t === TERRAIN.ROCKS || t === TERRAIN.CLIFF;
  const borderOf = { [TERRAIN.TREES]: TERRAIN.TREE_BORDER, [TERRAIN.ROCKS]: TERRAIN.ROCK_BORDER, [TERRAIN.CLIFF]: TERRAIN.CLIFF_BORDER };
  const out = Uint8Array.from(terrain);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const t = terrain[idx(x, y)];
    if (!isBlockType(t)) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { edge = true; break; }   // map edge counts
      if (terrain[idx(nx, ny)] !== t) { edge = true; break; }                     // meets something else
    }
    if (edge) out[idx(x, y)] = borderOf[t];
  }

  const blocking = new Uint8Array(n);
  for (let i = 0; i < n; i++) blocking[i] = BLOCKING.has(out[i]) ? 1 : 0;
  return { cols, rows, terrain: out, blocking };
}

/** Zero every water cell not in the single largest 4-connected component (→ one connected body). */
function keepLargestBlob(water, cols, rows) {
  const seen = new Uint8Array(water.length);
  let best = null, bestSize = 0;
  for (let s = 0; s < water.length; s++) {
    if (!water[s] || seen[s]) continue;
    const stack = [s], comp = []; seen[s] = 1;
    while (stack.length) {
      const c = stack.pop(); comp.push(c);
      const x = c % cols, y = (c / cols) | 0;
      const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (water[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (comp.length > bestSize) { bestSize = comp.length; best = comp; }
  }
  const keep = new Set(best || []);
  for (let i = 0; i < water.length; i++) if (!keep.has(i)) water[i] = 0;
}

// ── Stage 1b: base placement + resource / spawn generation (owner 2026-07-14) ─────────────────
// All operate on a generateTerrain() result `g = {cols, rows, terrain, blocking}` and are pure +
// seeded, so the tool, the export, and the game agree.

function mulberrySeed(seed) { return mulberry32((seed | 0) || 1); }
function isBlock(g, x, y) {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return true;
  return !!g.blocking[y * g.cols + x];
}
function set(g, x, y, t) { g.terrain[y * g.cols + x] = t; g.blocking[y * g.cols + x] = BLOCKING.has(t) ? 1 : 0; }

/** Place the 3x3 BASE centrally on open ground and enforce a CLEAR GAP around it: within `gap`
 *  cells (Chebyshev from centre) all terrain is forced to open grass (the 'nothing gap'), which
 *  also becomes the resource-exclusion zone. Returns { pos, cells, gap }. Mutates g. */
export function placeBase(g, gap = 2, at = null) {
  let best;
  if (at) {
    // pinned position (world-center for the wave-window model); clamp so the 3x3 fits in-bounds
    best = { x: Math.max(1, Math.min(g.cols - 2, at.x | 0)), y: Math.max(1, Math.min(g.rows - 2, at.y | 0)) };
  } else {
    const cx = Math.floor(g.cols / 2), cy = Math.floor(g.rows / 2);
    // spiral out from centre for the nearest 3x3 whose footprint fits in-bounds
    best = { x: cx, y: cy };
    outer: for (let r = 0; r < Math.max(g.cols, g.rows); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x - 1 >= 0 && y - 1 >= 0 && x + 1 < g.cols && y + 1 < g.rows) { best = { x, y }; break outer; }
      }
    }
  }
  const pos = best, cells = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push({ x: pos.x + dx, y: pos.y + dy });
  // clear the gap zone: force open terrain, strip blocking (the 'nothing gap' around the base)
  for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
    const x = pos.x + dx, y = pos.y + dy;
    if (x >= 0 && y >= 0 && x < g.cols && y < g.rows) set(g, x, y, TERRAIN.GRASS);
  }
  g.base = { pos, cells, gap };
  return g.base;
}

/** Scatter RESOURCE nodes on walkable ground, honoring the base resource-gap, distributed by
 *  distance from the base: primary (blue) common near, premium (yellow) mid, quest (red/green)
 *  far. Deterministic. Returns [{x,y,role,color}]. */
export function generateResources(g, opts = {}) {
  const rnd = mulberrySeed((g.base ? 991 : 0) + (opts.seed || 13) * 7 + 5);
  const base = g.base ? g.base.pos : { x: g.cols / 2, y: g.rows / 2 };
  const gap = g.base ? g.base.gap : 2;
  const density = opts.density != null ? opts.density : 0.05;   // fraction of walkable cells that seed
  const maxR = Math.hypot(g.cols, g.rows) / 2;
  const nodes = [];
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    if (isBlock(g, x, y)) continue;
    if (Math.max(Math.abs(x - base.x), Math.abs(y - base.y)) <= gap) continue;   // resource gap
    if (rnd() > density) continue;
    const d = Math.hypot(x - base.x, y - base.y) / maxR;          // 0 at base → 1 at far corner
    let role, color;
    if (d < 0.45) { role = 'primary'; color = 'blue'; }
    else if (d < 0.72) { role = rnd() < 0.6 ? 'primary' : 'premium'; color = role === 'premium' ? 'yellow' : 'blue'; }
    else { const q = rnd(); role = q < 0.4 ? 'quest' : 'premium'; color = role === 'quest' ? (rnd() < 0.5 ? 'red' : 'green') : 'yellow'; }
    nodes.push({ x, y, role, color });
  }
  return nodes;
}

/** SPAWN points on the map edges, tagged by lane: ground on walkable edge, water on water edge,
 *  air on any edge. Colored by the tool. Deterministic. Returns [{x,y,lane}]. */
export function generateSpawns(g, opts = {}) {
  const rnd = mulberrySeed((opts.seed || 13) * 13 + 29);
  const edges = [];
  for (let x = 0; x < g.cols; x++) { edges.push({ x, y: 0 }); edges.push({ x, y: g.rows - 1 }); }
  for (let y = 1; y < g.rows - 1; y++) { edges.push({ x: 0, y }); edges.push({ x: g.cols - 1, y }); }
  const groundEdge = edges.filter((e) => !isBlock(g, e.x, e.y));
  const waterEdge = edges.filter((e) => g.terrain[e.y * g.cols + e.x] === TERRAIN.WATER);
  const pick = (arr, k) => {
    const a = arr.slice(); const out = [];
    for (let i = 0; i < k && a.length; i++) out.push(a.splice((rnd() * a.length) | 0, 1)[0]);
    return out;
  };
  const spawns = [];
  for (const e of pick(groundEdge, opts.ground || 6)) spawns.push({ x: e.x, y: e.y, lane: 'ground' });
  for (const e of pick(edges, opts.air || 4)) spawns.push({ x: e.x, y: e.y, lane: 'air' });
  for (const e of pick(waterEdge, opts.water || 3)) spawns.push({ x: e.x, y: e.y, lane: 'water' });
  return spawns;
}

/**
 * Wave-window SPAWN generation — places spawns on the OUTER EDGE of a rect (the wave's battle
 * window, or the whole world), on the attack side(s). Spawns are spaced EVENLY (not random): even,
 * separated entry points are the single biggest lever for minimizing pathing collision, since units
 * enter in parallel lanes instead of funnelling through one cell. Tunables:
 *   rect     {x0,y0,x1,y1} 0-indexed inclusive — the edge to spawn on (default = full grid)
 *   side     'west'|'east'|'north'|'south'|'surround' — which edge(s); surround splits across all 4
 *   ground/air/water  counts per lane
 *   spread   0..1 fraction of the edge length used (1 = full edge, .5 = centred half)
 *   spacing  min cells between adjacent spawns on the same edge (collision knob)
 * Ground spawns skip blocking cells; water spawns need a water edge; air uses any edge cell.
 * Deterministic (no RNG — even layout is inherently stable). Returns [{x,y,lane}].
 */
export function generateEdgeSpawns(g, opts = {}) {
  const r = opts.rect || { x0: 0, y0: 0, x1: g.cols - 1, y1: g.rows - 1 };
  const side = opts.side || 'surround';
  const spread = opts.spread != null ? Math.max(0.1, Math.min(1, opts.spread)) : 1;
  const spacing = Math.max(1, opts.spacing || 2);
  const counts = { ground: opts.ground != null ? opts.ground : 6, air: opts.air != null ? opts.air : 4, water: opts.water != null ? opts.water : 3 };
  const sides = side === 'surround' ? ['west', 'east', 'north', 'south'] : [side];

  const edgeCells = (s) => {
    const cells = [];
    if (s === 'west') for (let y = r.y0; y <= r.y1; y++) cells.push({ x: r.x0, y });
    else if (s === 'east') for (let y = r.y0; y <= r.y1; y++) cells.push({ x: r.x1, y });
    else if (s === 'north') for (let x = r.x0; x <= r.x1; x++) cells.push({ x, y: r.y0 });
    else if (s === 'south') for (let x = r.x0; x <= r.x1; x++) cells.push({ x, y: r.y1 });
    return cells;
  };
  // evenly place k points along the valid cells of an edge, centred by `spread`, honouring `spacing`
  const place = (cells, k, valid) => {
    const usable = cells.filter(valid);
    if (!usable.length || k <= 0) return [];
    const span = Math.max(1, Math.round(usable.length * spread));
    const seg = usable.slice(Math.floor((usable.length - span) / 2), Math.floor((usable.length - span) / 2) + span);
    const out = []; let lastIdx = -Infinity;
    for (let i = 0; i < k; i++) {
      let idx = seg.length === 1 ? 0 : Math.round((k === 1 ? 0.5 : i / (k - 1)) * (seg.length - 1));
      if (idx - lastIdx < spacing) idx = lastIdx + spacing;      // enforce min separation
      if (idx > seg.length - 1) break;                            // ran out of room
      out.push(seg[idx]); lastIdx = idx;
    }
    return out;
  };
  const split = (total) => {                                      // divide a lane's count across sides
    const b = Math.floor(total / sides.length), rem = total % sides.length;
    return sides.map((_, i) => b + (i < rem ? 1 : 0));
  };

  const spawns = [], seen = new Set();
  for (const lane of ['ground', 'air', 'water']) {
    if (!counts[lane]) continue;
    const parts = split(counts[lane]);
    const valid = lane === 'water' ? (c) => g.terrain[c.y * g.cols + c.x] === TERRAIN.WATER
      : lane === 'ground' ? (c) => !isBlock(g, c.x, c.y) : () => true;
    sides.forEach((s, si) => {
      for (const c of place(edgeCells(s), parts[si], valid)) {
        const key = c.x + ',' + c.y + ',' + lane;
        if (seen.has(key)) continue; seen.add(key);
        spawns.push({ x: c.x, y: c.y, lane });
      }
    });
  }
  return spawns;
}

export const RESOURCE_COLOR = { blue: '#4a9fe0', yellow: '#e0c24a', red: '#e0574a', green: '#5ad06a' };
export const LANE_COLOR = { ground: '#ff9a3d', air: '#5fe0ff', water: '#3a7fd0' };
