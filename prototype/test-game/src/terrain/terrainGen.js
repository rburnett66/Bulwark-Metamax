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
