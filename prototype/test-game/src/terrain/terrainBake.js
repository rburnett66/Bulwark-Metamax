/**
 * src/terrain/terrainBake.js — Terrain Forge baked-view renderer.
 *
 * Builds the digicam / rigid-voxel ground look from the CURRENT map (the per-cell TYPE grid from
 * terrainGen.js), a JS port of the visual language in docs Terrain-Design.md. The Python pipeline
 * (tools/terrain-bake) stays the offline baker; this reproduces the look live so authors see real terrain.
 *
 * HEIGHT MODEL — a configurable MATERIAL STACK (bottom→top). Each material is a contiguous band of `layers`
 * in the vertical height ladder with its own color, noise, and transition CURVE. Summing the thicknesses
 * gives the level ladder; MATERIAL is a function of LEVEL. A forge cell of type T sits at the TOP level of
 * its material's band; the ground then TERRACES down toward the nearest basin in one-unit steps, so a drop
 * of N levels reads as N concentric layers. A material's `curve` sets how wide those steps are (linear =
 * even treads; aggressive = narrow treads → a steep wall, e.g. cliffs). Everything stays quantized — no
 * Gaussian on the height field (design §2.2); the only smoothing is a median on the plan shape.
 */

import { TERRAIN } from './terrainGen.js';

// Default stack, LOW→HIGH — ORDER MATCHES MAP GENERATION (terrainGen.js feature priority brush < rocks <
// trees < cliff), so a trees region reads as higher-layered than a rocks region, exactly as generation
// overwrites them. `layers` = band thickness; `curve`: 'linear' (even, wide treads — soft ground terraces
// gently through dirt) | 'aggressive' (narrow treads → sheer, for rocks/cliff). water base; shore = waterline.
export const DEFAULT_STACK = [
  { key: 'water', color: '#4a7ea8', noise: 0.22, layers: 1, curve: 'linear' },
  { key: 'shore', color: '#c8b27a', noise: 0.30, layers: 1, curve: 'linear' },
  { key: 'dirt',  color: '#785632', noise: 0.85, layers: 2, curve: 'linear' },
  { key: 'grass', color: '#688e42', noise: 0.90, layers: 1, curve: 'linear' },
  { key: 'brush', color: '#5f7f3a', noise: 0.95, layers: 1, curve: 'linear' },
  { key: 'rocks', color: '#8a857d', noise: 0.55, layers: 2, curve: 'aggressive' },
  { key: 'trees', color: '#4c6b39', noise: 0.80, layers: 1, curve: 'linear' },
  { key: 'cliff', color: '#6b6b70', noise: 0.65, layers: 8, curve: 'aggressive' },
];

// forge TYPE → stack material key (Stage-1→Stage-2 bridge). Each feature maps to its OWN band so the
// baked elevation order matches generation; borders ride with their feature.
const TYPE2KEY = {
  [TERRAIN.WATER]: 'water',
  [TERRAIN.DIRT]: 'dirt',
  [TERRAIN.GRASS]: 'grass',
  [TERRAIN.BRUSH]: 'brush',
  [TERRAIN.ROCKS]: 'rocks', [TERRAIN.ROCK_BORDER]: 'rocks',
  [TERRAIN.TREES]: 'trees', [TERRAIN.TREE_BORDER]: 'trees',
  [TERRAIN.CLIFF]: 'cliff', [TERRAIN.CLIFF_BORDER]: 'cliff',
};
const CLIFF_TYPES = new Set([TERRAIN.CLIFF, TERRAIN.CLIFF_BORDER]);

const REF_CELL = 96, REF_U = 3;           // design reference: CELL 96 → U 3
const TOP_LIT = 0.20, LIT_BAND_RATIO = 1 / 3, SIDE_FACE_RATIO = 0.55, SIDE_DARK = 0.30, SIDE_LIT = 0.22;
// sub-cells-per-level multiplier per curve. linear treads are WIDE so soft transitions (water→dirt→grass)
// read as distinct single steps of dirt, not a sheer drop; aggressive stays narrow → sheer rock/cliff walls.
const CURVE_FACTOR = { linear: 1.6, aggressive: 0.4 };

function hash2(x, y, seed) {
  let a = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
// smooth value noise (smoothstep-interpolated lattice) + 2-octave fbm — for the organic boundary warp
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y, seed) {
  return 0.55 * vnoise(x, y, seed)
    + 0.30 * vnoise(x * 2.03 + 11.1, y * 2.03 + 7.7, seed + 101)
    + 0.15 * vnoise(x * 4.10 + 3.3, y * 4.10 + 19.2, seed + 211);   // fine octave → noisy/rocky edges (cliffs)
}
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((h || '').trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
}
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const shade = (c, d) => [c[0] * (1 - d), c[1] * (1 - d), c[2] * (1 - d)];
const lift = (c, u) => [c[0] + (255 - c[0]) * u, c[1] + (255 - c[1]) * u, c[2] + (255 - c[2]) * u];

/** Expand the material stack into per-LEVEL lookups. Returns arrays indexed by level 0..total-1. */
function buildLadder(stack, band) {
  const color = [], noise = [], step = [], key = [], topOf = {};
  let lvl = 0;
  for (const m of stack) {
    const layers = Math.max(1, Math.round(m.layers || 1));
    const c = hexToRgb(m.color);
    const stepPx = Math.max(0.35, band * (CURVE_FACTOR[m.curve] ?? 1));   // sub-cells to rise one level
    for (let k = 0; k < layers; k++) {
      color[lvl] = c; noise[lvl] = m.noise ?? 0.5; step[lvl] = stepPx; key[lvl] = m.key; lvl++;
    }
    topOf[m.key] = lvl - 1;   // a cell of this material sits at the TOP of its band
  }
  const total = lvl;
  const cum = new Float64Array(total + 1);       // cum[L] = sub-cell distance to reach level L from the floor
  for (let L = 0; L < total; L++) cum[L + 1] = cum[L] + step[L];
  return { total, color, noise, step, key, topOf, cum };
}

/**
 * Bake the current map to an offscreen canvas. Returns the canvas (blit it, smoothing off, into the forge
 * canvas). Deterministic in `seed`.
 * @param {{cols:number,rows:number,terrain:Uint8Array}} map
 * @param {{seed?:number, sub?:number, smooth?:number, band?:number, faceDark?:number, stack?:Array,
 *          shadow?:boolean, shadowStrength?:number, shadowEl?:number, shadowSoft?:number}} [opt]
 */
export function bakeTerrain(map, opt = {}) {
  const { cols, rows, terrain } = map;
  const seed = opt.seed ?? 7;
  const sub = Math.max(1, Math.min(12, Math.round(opt.sub ?? 5)));
  const smooth = Math.max(0, Math.min(4, Math.round(opt.smooth ?? 1)));
  const band = Math.max(1, Math.round(opt.band ?? 2));
  const faceDark = opt.faceDark ?? 0.55;
  const warp = Math.max(0, Math.min(2, opt.warp ?? 0.6));   // organic outline: coarse-cells of boundary displacement
  const stack = (opt.stack && opt.stack.length) ? opt.stack : DEFAULT_STACK;
  // cast-shadow controls (Shading epic T): terrain self-shadow from the height field
  const doShadow = opt.shadow !== false;
  const shadowStrength = Math.max(0, Math.min(1, opt.shadowStrength ?? 0.4));
  const shadowEl = Math.max(5, Math.min(80, opt.shadowEl ?? 25));      // sun elevation (°): lower = longer shadows
  const shadowSoft = Math.max(0, Math.min(4, Math.round(opt.shadowSoft ?? 1)));
  const cliffDrop = Math.max(0, Math.min(8, Math.round(opt.cliffDrop ?? 3)));   // cliff cube height (layers above bordering ground); 0 = terrace like soft ground

  const L = buildLadder(stack, band);
  const lvlOf = (t) => L.topOf[TYPE2KEY[t] ?? 'grass'] ?? L.topOf.grass ?? Math.max(0, L.total - 1);

  // ── coarse levels, then SUB-SAMPLE into a fine grid ──
  // DOMAIN WARP (organic outlines): instead of nearest-sampling the coarse grid — which snaps every region
  // boundary to the axis-aligned cell edges (the long straight cliff lines) — offset each fine cell's sample
  // position by a smooth 2-octave noise field. Boundaries then undulate organically at sub-cell scale, while
  // region interiors stay put. The median smooth + terrace run AFTER, cleaning any speckle the warp leaves.
  const fc = cols * sub, fr = rows * sub;
  let flv = new Int16Array(fc * fr);
  const fcliff = new Uint8Array(fc * fr);
  const amp = warp * sub;                       // max displacement, in fine cells
  const wf = 1 / (sub * 2.2);                    // warp wavelength ≈ 2 coarse cells (gentle undulation)
  for (let fy = 0; fy < fr; fy++) for (let fx = 0; fx < fc; fx++) {
    let wx = fx, wy = fy;
    if (amp > 0) {
      wx += (fbm(fx * wf, fy * wf, seed + 31) - 0.5) * 2 * amp;
      wy += (fbm(fx * wf, fy * wf, seed + 67) - 0.5) * 2 * amp;
    }
    const cx = wx < 0 ? 0 : wx >= fc ? cols - 1 : (wx / sub) | 0;
    const cy = wy < 0 ? 0 : wy >= fr ? rows - 1 : (wy / sub) | 0;
    const p = cy * cols + cx;
    flv[fy * fc + fx] = lvlOf(terrain[p]);
    fcliff[fy * fc + fx] = CLIFF_TYPES.has(terrain[p]) ? 1 : 0;
  }

  // ── corner-smooth the plan shape (median; quantized; cliffs kept sharp) ──
  if (smooth > 0) {
    const med = (src, x, y) => {
      const s = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx < 0 ? 0 : x + dx >= fc ? fc - 1 : x + dx;
        const ny = y + dy < 0 ? 0 : y + dy >= fr ? fr - 1 : y + dy;
        s.push(src[ny * fc + nx]);
      }
      s.sort((a, b) => a - b); return s[4];
    };
    for (let p = 0; p < smooth; p++) {
      const nxt = new Int16Array(flv.length);
      for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) { const i = y * fc + x; nxt[i] = fcliff[i] ? flv[i] : med(flv, x, y); }
      flv = nxt;
    }
  }

  // ── TERRACE: higher ground steps DOWN to meet lower ground over (level-drop) one-unit layers; each
  // material's `curve` sets the tread width (cum-cost distance). Seed from the LOW SIDE of every boundary
  // (a cell that has a strictly-higher neighbor) and let the drop propagate INTO the higher region — so a
  // grass plateau beside water ramps grass→dirt→dirt→shore→water instead of dropping like a cliff. (Seeding
  // local minima instead made every flat region its own basin, terracing only a 1-cell rim.) ──
  const BIG = 1 << 30;
  const dist = new Int32Array(fc * fr).fill(BIG);
  const srcLv = new Int16Array(fc * fr);
  const seeds = [];
  for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
    const i = y * fc + x, v = flv[i];
    let low = false;                                 // low side of a boundary → the drop rises from here
    if (x > 0 && flv[i - 1] > v) low = true;
    if (!low && x < fc - 1 && flv[i + 1] > v) low = true;
    if (!low && y > 0 && flv[i - fc] > v) low = true;
    if (!low && y < fr - 1 && flv[i + fc] > v) low = true;
    if (low) seeds.push(i);
  }
  seeds.sort((a, b) => flv[a] - flv[b]);
  const q = new Int32Array(fc * fr); let qh = 0, qt = 0;
  for (const s of seeds) { dist[s] = 0; srcLv[s] = flv[s]; q[qt++] = s; }
  while (qh < qt) {
    const i = q[qh++], ix = i % fc, iy = (i / fc) | 0, d = dist[i] + 1;
    const nb = [];
    if (ix > 0) nb.push(i - 1); if (ix < fc - 1) nb.push(i + 1);
    if (iy > 0) nb.push(i - fc); if (iy < fr - 1) nb.push(i + fc);
    for (const j of nb) if (d < dist[j]) { dist[j] = d; srcLv[j] = srcLv[i]; q[qt++] = j; }
  }
  const terr = new Int16Array(fc * fr);
  for (let i = 0; i < flv.length; i++) {
    if (fcliff[i] && cliffDrop > 0) { terr[i] = flv[i]; continue; }   // cube cliffs skip terracing (set below); drop 0 = terrace like ground
    const bl = srcLv[i], target = L.cum[bl] + dist[i];    // how far up the cum-cost slope the distance reaches
    let lv = bl;
    while (lv < flv[i] && L.cum[lv + 1] <= target) lv++;
    terr[i] = lv;
  }

  // ── CLIFF CUBES: soft ground terraces flat; a cliff instead stands a FIXED `cliffDrop` layers above the
  // ground it borders, sheer on every exposed side → proper cube blocks that read as clear no-pathing walls.
  // Pass A sets edge cliffs from their non-cliff neighbour; pass B floods that height across cliff interiors. ──
  const cliffTopLv = L.topOf.cliff ?? (L.total - 1);
  if (cliffDrop > 0) {
    const done = new Uint8Array(fc * fr);
    for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
      const i = y * fc + x; if (!fcliff[i]) continue;
      let g = -1;                                          // highest non-cliff ground this cliff touches
      if (x > 0 && !fcliff[i - 1]) g = Math.max(g, terr[i - 1]);
      if (x < fc - 1 && !fcliff[i + 1]) g = Math.max(g, terr[i + 1]);
      if (y > 0 && !fcliff[i - fc]) g = Math.max(g, terr[i - fc]);
      if (y < fr - 1 && !fcliff[i + fc]) g = Math.max(g, terr[i + fc]);
      if (g >= 0) { terr[i] = Math.min(cliffTopLv, g + cliffDrop); done[i] = 1; }
    }
    for (let pass = 0, changed = 1; changed && pass < fc + fr; pass++) {   // flood the plateau height inward
      changed = 0;
      for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
        const i = y * fc + x; if (!fcliff[i] || done[i]) continue;
        let m = -1;
        if (x > 0 && done[i - 1]) m = Math.max(m, terr[i - 1]);
        if (x < fc - 1 && done[i + 1]) m = Math.max(m, terr[i + 1]);
        if (y > 0 && done[i - fc]) m = Math.max(m, terr[i - fc]);
        if (y < fr - 1 && done[i + fc]) m = Math.max(m, terr[i + fc]);
        if (m >= 0) { terr[i] = m; done[i] = 1; changed++; }
      }
    }
  }

  // ── resolution + render ──
  const MAXPX = 5120;
  const fpx = Math.max(6, Math.min(24, Math.floor(MAXPX / Math.max(fc, fr))));
  const U = Math.max(1.5, fpx * sub * REF_U / REF_CELL);
  const DIGI = Math.max(2, Math.round(fpx / 3));
  const cv = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(fc * fpx, fr * fpx)
    : Object.assign(document.createElement('canvas'), { width: fc * fpx, height: fr * fpx });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const at = (x, y) => (x < 0 || y < 0 || x >= fc || y >= fr) ? null : terr[y * fc + x];
  const colOf = (lv) => L.color[Math.max(0, Math.min(L.total - 1, lv))] || [128, 128, 128];
  const noiseOf = (lv) => L.noise[Math.max(0, Math.min(L.total - 1, lv))] ?? 0.4;

  // ── CAST SHADOWS: march the height field toward the sun (135° = the grid diagonal up-left, −x,−y) ONCE.
  // A fine cell is shadowed when a taller cell up-sun occludes the sun ray; the ray climbs `stepRise` levels
  // per diagonal step, so once it clears the tallest level nothing can occlude and the march stops (cheap).
  // Baked into the surface → free at runtime. Decor drop-shadows composite here later (epic E → T). ──
  let shadowF = null;
  if (doShadow && shadowStrength > 0) {
    shadowF = new Float32Array(fc * fr);
    const stepRise = Math.max(1e-3, Math.SQRT2 * fpx * Math.tan(shadowEl * Math.PI / 180) / U);
    for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
      const h0 = terr[y * fc + x];
      let ray = h0, k = 1, sh = 0;
      while (true) {
        ray += stepRise;
        if (ray > L.total) break;                       // ray cleared the tallest possible terrain
        const sx = x - k, sy = y - k;
        if (sx < 0 || sy < 0) break;                    // ran off the up-sun edge
        if (terr[sy * fc + sx] > ray) { sh = 1; break; } // a taller cell up-sun blocks the sun
        k++;
      }
      shadowF[y * fc + x] = sh;
    }
    for (let p = 0; p < shadowSoft; p++) {               // penumbra: soften the boolean edge
      const nxt = new Float32Array(shadowF.length);
      for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= fc || ny >= fr) continue;
          s += shadowF[ny * fc + nx]; n++;
        }
        nxt[y * fc + x] = s / n;
      }
      shadowF = nxt;
    }
  }
  const shMul = (i) => shadowF ? (1 - shadowStrength * shadowF[i]) : 1;
  // cliff cells stand at a shifted level (cube height), so their colour must come from the CLIFF material,
  // not from colOf(level) which would pick whatever band that level lands in.
  const cliffCol = colOf(cliffTopLv), cliffNz = noiseOf(cliffTopLv);

  // pass 1: grained surfaces — value jitter scaled by the level's noise, dimmed where shadowed
  for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
    const i = y * fc + x, lv = terr[i], base = fcliff[i] ? cliffCol : colOf(lv), nz = fcliff[i] ? cliffNz : noiseOf(lv), ox = x * fpx, oy = y * fpx, sm = shMul(i);
    for (let gy = 0; gy < fpx; gy += DIGI) for (let gx = 0; gx < fpx; gx += DIGI) {
      const j = hash2((ox + gx) / DIGI | 0, (oy + gy) / DIGI | 0, seed + lv * 7);
      const d = (j - 0.5) * nz * 0.42;            // ± up to ~21% value swing at noise 1
      ctx.fillStyle = rgb([base[0] * (1 - d) * sm, base[1] * (1 - d) * sm, base[2] * (1 - d) * sm]);
      ctx.fillRect(ox + gx, oy + gy, Math.min(DIGI, fpx - gx), Math.min(DIGI, fpx - gy));
    }
  }

  // pass 2: rigid faces + 45° lighting on the terraced grid. Cliff faces get a taller cap so cube walls
  // read as solid blocks; soft ground keeps the gentle ~0.9-cell cap.
  for (let y = 0; y < fr; y++) for (let x = 0; x < fc; x++) {
    const i = y * fc + x, lv = terr[i], ox = x * fpx, oy = y * fpx, surf = fcliff[i] ? cliffCol : colOf(lv);
    const faceCap = fcliff[i] ? fpx * 0.98 : fpx * 0.9;
    const south = at(x, y + 1);
    if (south != null && lv > south) {
      const faceH = Math.min((lv - south) * U, faceCap);
      ctx.fillStyle = rgb(shade(surf, faceDark));
      ctx.fillRect(ox, oy + fpx - faceH, fpx, faceH);
      ctx.fillStyle = rgb(lift(colOf(south), TOP_LIT));
      ctx.fillRect(ox, (y + 1) * fpx, fpx, Math.max(1, faceH * LIT_BAND_RATIO));
    }
    const north = at(x, y - 1);
    if (north != null && lv > north) { ctx.fillStyle = rgb(lift(surf, TOP_LIT)); ctx.fillRect(ox, oy, fpx, Math.max(1, (lv - north) * U * LIT_BAND_RATIO)); }
    const east = at(x + 1, y);
    if (east != null && lv > east) { const w = Math.min(faceCap, Math.max(1, (lv - east) * U * SIDE_FACE_RATIO)); ctx.fillStyle = rgb(shade(surf, SIDE_DARK)); ctx.fillRect(ox + fpx - w, oy, w, fpx); }
    const west = at(x - 1, y);
    if (west != null && lv > west) { const w = Math.min(faceCap, Math.max(1, (lv - west) * U * SIDE_FACE_RATIO)); ctx.fillStyle = rgb(lift(surf, SIDE_LIT)); ctx.fillRect(ox, oy, w, fpx); }
  }

  return cv;
}
