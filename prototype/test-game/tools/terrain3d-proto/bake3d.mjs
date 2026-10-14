// Offline "Bake level" for the three.js terrain prototype.
// Uses the Bulwark repo's OWN modules (bakeTerrain, buildTerrainMap, buildNavGrid, findRoute) — no copies —
// so the ground image, blocking and road routes are exactly what the current game computes.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Usage (from anywhere): node prototype/test-game/tools/terrain3d-proto/bake3d.mjs [mapId]
// fileURLToPath, not URL.pathname: on Windows pathname is "/C:/..." and path.resolve doubles the drive.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');   // prototype/test-game
const MAP_ID = process.argv[2] || 'powder-map-1';
// What the 3D renderer loads is CONTENT and is committed (a code-only deploy renders nothing).
const OUT = path.join(REPO, 'content/maps/baked', MAP_ID);
// 2D-prototype leftovers and previews are not content: they go to the gitignored scratch folder.
const SCRATCH = path.join(HERE, 'out3d');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });

// bakeTerrain falls back to document.createElement('canvas') when OffscreenCanvas is missing (Node).
globalThis.document = { createElement: (t) => { if (t !== 'canvas') throw new Error(t); const c = createCanvas(1, 1); return c; } };
// Object.assign(canvas, {width, height}) must resize a napi canvas — it does (width/height are setters).

const imp = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { bakeTerrain } = await imp('src/terrain/terrainBake.js');
const { TERRAIN } = await imp('src/terrain/terrainGen.js');
const { buildTerrainMap } = await imp('src/sim/mapgen.js');
const { buildNavGrid, findRoute } = await imp('src/sim/pathfinding.js');

const forge = JSON.parse(fs.readFileSync(path.join(REPO, 'content/maps/forge', MAP_ID + '.json'), 'utf8'));
const map = buildTerrainMap(forge, 1, { seed: 0, bakeTune: {} });   // exactly what main.js does (default tune)
const { cols, rows } = map;
console.log('map', cols, rows, 'base', map.base.x, map.base.y, 'blocked', map.blockedCells.length, 'water', map.waterCells.length);

// ── 1. MAP LAYERS: the repo's own digicam bake ───────────────────────────────────────────────────────
let t0 = Date.now();
// 3D engine: cliffs are real geometry and shadows come from the sun, so the ground image paints neither.
const bake = bakeTerrain({ cols, rows, terrain: forge.terrain }, { cliffDrop: 0, shadow: false });
const W = bake.width, H = bake.height, PX = W / cols;                  // PX_PER_CELL of the current bake
console.log('bake', W, 'x', H, 'PX_PER_CELL', PX, 'ms', Date.now() - t0);
const ctx = bake.getContext('2d');
const img = ctx.getImageData(0, 0, W, H);
const px = img.data;

// ── 2. ROADS: traffic from the sim's pathfinder (primary + alternates, like core.js seedRoute) ────────
const baseCells = [];
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) baseCells.push({ x: map.base.x + dx, y: map.base.y + dy });
const nav = buildNavGrid(map, []);   // exactly as sim core.js does (no base footprint block)
const basePos = { x: map.base.x, y: map.base.y };
const routeCells = (routes, buf) => {
  const s = new Set();
  for (const r of routes) for (const c of r) for (let dx = -buf; dx <= buf; dx++) for (let dy = -buf; dy <= buf; dy++) {
    const x = c.x + dx, y = c.y + dy; if (x >= 0 && x < cols && y >= 0 && y < rows) s.add(y * cols + x);
  }
  return s;
};
const ALT_W = [1.0, 0.35, 0.15];   // plan v1.8 §3.5: primary + 2 alternates
const traffic = [];   // {pts:[{x,y}], w}
let spawnCount = 0;
for (const [wave, list] of Object.entries(forge.spawnsByWave || {})) {
  for (const sp of list.filter((s) => s.lane === 'ground')) {
    spawnCount++;
    const from = { x: Math.round(sp.x), y: Math.round(sp.y) };
    const routes = [];
    const primary = findRoute(nav, from, basePos);
    if (!primary || !primary.length) continue;
    routes.push(primary);
    for (let k = 0; k < 2; k++) {   // same shape as seedRoute (it seeds up to 4; the road shows the top 2): avoid buffer 1, then 0
      let alt = findRoute(nav, from, basePos, routeCells(routes, 1));
      if (!alt || !alt.length) alt = findRoute(nav, from, basePos, routeCells(routes, 0));
      if (!alt || !alt.length || routes.some((r) => JSON.stringify(r) === JSON.stringify(alt))) break;
      routes.push(alt);
    }
    routes.forEach((r, i) => traffic.push({ pts: [from, ...r], w: ALT_W[i] || 0.05, wave: +wave }));
  }
}
console.log('ground spawns', spawnCount, 'route polylines', traffic.length);

// Rasterise traffic at sub-cell resolution (5 per cell, matching the bake's sub=5 grid).
const SUB = 5, FC = cols * SUB, FR = rows * SUB;
const wear = new Float32Array(FC * FR);
const R = 0.5;                                   // half-width of a lane, in cells (tank collision ≈ 0.57)
for (const tr of traffic) {
  const seg = new Float32Array(FC * FR);          // per-route max (a route doesn't add to itself)
  for (let i = 0; i < tr.pts.length - 1; i++) {
    const a = { x: tr.pts[i].x + 0.5, y: tr.pts[i].y + 0.5 }, b = { x: tr.pts[i + 1].x + 0.5, y: tr.pts[i + 1].y + 0.5 };
    const minx = Math.max(0, Math.floor((Math.min(a.x, b.x) - R - 1) * SUB)), maxx = Math.min(FC - 1, Math.ceil((Math.max(a.x, b.x) + R + 1) * SUB));
    const miny = Math.max(0, Math.floor((Math.min(a.y, b.y) - R - 1) * SUB)), maxy = Math.min(FR - 1, Math.ceil((Math.max(a.y, b.y) + R + 1) * SUB));
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
    for (let fy = miny; fy <= maxy; fy++) for (let fx = minx; fx <= maxx; fx++) {
      const qx = (fx + 0.5) / SUB, qy = (fy + 0.5) / SUB;
      let t = ((qx - a.x) * vx + (qy - a.y) * vy) / L2; t = Math.max(0, Math.min(1, t));
      const dx = qx - (a.x + vx * t), dy = qy - (a.y + vy * t), d = Math.hypot(dx, dy);
      const v = d <= R ? 1 : Math.max(0, 1 - (d - R) / 0.35);   // flat core, short shoulder
      if (v > seg[fy * FC + fx]) seg[fy * FC + fx] = v;
    }
  }
  for (let i = 0; i < seg.length; i++) wear[i] += seg[i] * tr.w;
}
let wmax = 0; for (const v of wear) if (v > wmax) wmax = v;
// Normalise with a soft cap so a corridor used by several spawns saturates (the merged road near the base).
const CAP = wmax * 0.55;   // the busiest corridor saturates; quiet routes stay faint
for (let i = 0; i < wear.length; i++) wear[i] = Math.min(1, wear[i] / CAP);

// Cells that never take wear: blocked, water, base footprint.
const noWear = new Uint8Array(cols * rows);
for (const c of map.blockedCells) noWear[c.y * cols + c.x] = 1;
for (const c of map.waterCells) noWear[c.y * cols + c.x] = 1;
for (const c of baseCells) noWear[c.y * cols + c.x] = 1;

function hash2(x, y, s) { let a = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; a = Math.imul(a ^ (a >>> 13), 1274126177); return ((a ^ (a >>> 16)) >>> 0) / 4294967296; }
// Band thresholds (data constants in the real generator).
const T_EDGE = 0.06, T_WORN = 0.16, T_CORE = 0.38;
const band = (w) => (w >= T_CORE ? 3 : w >= T_WORN ? 2 : w >= T_EDGE ? 1 : 0);
// Dirt palette from the bake's own DEFAULT_STACK dirt (#785632), three tones (July rule: 3 tones, tight/smooth).
const CORE = [[104, 74, 43], [96, 68, 39], [112, 80, 47]];
const WORN = [[122, 88, 52], [116, 84, 49], [128, 93, 56]];
const PEB = [148, 140, 128];
const DIGI = Math.max(2, Math.round((PX / SUB) / 3));          // the bake's digicam block size
const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const wearAtPx = (x, y) => {
  const fx = Math.min(FC - 1, Math.floor(x / (PX / SUB))), fy = Math.min(FR - 1, Math.floor(y / (PX / SUB)));
  const cx = Math.floor(fx / SUB), cy = Math.floor(fy / SUB);
  if (noWear[cy * cols + cx]) return 0;
  return wear[fy * FC + fx];
};
let roadBlocks = 0;
for (let by = 0; by < H; by += DIGI) for (let bx = 0; bx < W; bx += DIGI) {
  const cxp = bx + DIGI / 2, cyp = by + DIGI / 2;
  const j = (hash2(bx / DIGI | 0, by / DIGI | 0, 31) - 0.5) * 0.06;    // hashed jitter → blocky, organic band edge
  const b = band(wearAtPx(cxp, cyp) + j);
  if (!b) continue;
  const h = hash2(bx / DIGI | 0, by / DIGI | 0, 77);
  let col = null;
  if (b === 3) col = CORE[(h * 3) | 0];
  else if (b === 2) col = h < 0.06 ? PEB : WORN[(h * 3) | 0];
  else if (b === 1) col = h < 0.55 ? WORN[(h * 3) | 0] : null;          // edge: grass broken into dirt blocks
  // far-side seam: the road is a step DOWN — darken its north edge (sun top-left, player at the bottom)
  const northB = band(wearAtPx(cxp, cyp - DIGI * 1.0) + j);
  const seam = (b >= 2 && northB <= 1);
  roadBlocks++;
  for (let y = by; y < Math.min(H, by + DIGI); y++) for (let x = bx; x < Math.min(W, bx + DIGI); x++) {
    const k = (y * W + x) * 4;
    if (col) {
      // keep the bake's lighting: scale the road colour by how lit/shadowed the original pixel was
      const s = Math.max(0.55, Math.min(1.2, lum(px[k], px[k + 1], px[k + 2]) / 0.36));
      px[k] = col[0] * s; px[k + 1] = col[1] * s; px[k + 2] = col[2] * s;
    } else if (b === 1 && h > 0.9) {           // tuft: a brighter grass block along the edge
      px[k] = Math.min(255, px[k] * 1.12); px[k + 1] = Math.min(255, px[k + 1] * 1.15); px[k + 2] = Math.min(255, px[k + 2] * 1.05);
    }
    if (seam) { px[k] *= 0.72; px[k + 1] *= 0.72; px[k + 2] *= 0.72; }
  }
}
ctx.putImageData(img, 0, 0);
console.log('road digicam blocks painted', roadBlocks, 'DIGI', DIGI);

// ── 3. STATIC SHADOWS: pine decor shadows projected onto the ground (the pack's baked shadow silhouette) ──
const decorDb = JSON.parse(fs.readFileSync(path.join(REPO, 'content/decor/voxel-decor.json'), 'utf8'));
const pine = decorDb.decor['pine-tree-1'];
const pinePack = pine.pack, pinePart = pinePack.parts[0];
const pineImg = await loadImage(Buffer.from(pine.atlases.decor.split(',')[1], 'base64'));
const pineShadowSrc = pine.atlases.decorShadow || pine.atlases.shadow || Object.values(pine.atlases).find((v, i) => i === 1);
const pineShadowImg = pineShadowSrc ? await loadImage(Buffer.from(pineShadowSrc.split(',')[1], 'base64')) : null;
console.log('pine atlases', Object.keys(pine.atlases), pineImg.width, pineImg.height, pineShadowImg && pineShadowImg.width);
fs.writeFileSync(path.join(SCRATCH, 'pine.png'), Buffer.from(pine.atlases.decor.split(',')[1], 'base64'));
if (pineShadowSrc) fs.writeFileSync(path.join(SCRATCH, 'pine-shadow.png'), Buffer.from(pineShadowSrc.split(',')[1], 'base64'));

// Static shadow mask at 8 px / cell (units sample it to darken under trees).
const MASK_PX = 8;
const mask = createCanvas(cols * MASK_PX, rows * MASK_PX); const mctx = mask.getContext('2d');
mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height);
const SHADOW_ALPHA = 0.24;   // = buildDecorSprite's shadow alpha — ONE tint/opacity for every shadow
const decorTiles = (pinePack.scale && pinePack.scale.tiles) || 1;
for (const d of []) {
  if (!pineShadowImg) break;
  const sc = (PX * decorTiles * ((pinePack.decor && pinePack.decor.scale) || 1) * (d.s || 1)) / (pinePack.footprint[0] * pinePack.renderScale);
  const gx = (d.x + 0.5 + (d.dx || 0)) * PX, gy = (d.y + 0.5 + (d.dy || 0)) * PX;
  const [pw, ph] = pinePart.shadowCell || pinePart.cell, [pvx, pvy] = pinePart.pivot;
  // darken ground: draw silhouette black at SHADOW_ALPHA (max-combine: draw to an offscreen first)
  const tmp = createCanvas(Math.ceil(pw * sc), Math.ceil(ph * sc)); const tctx = tmp.getContext('2d');
  tctx.drawImage(pineShadowImg, 0, 0, pw, ph, 0, 0, tmp.width, tmp.height);
  tctx.globalCompositeOperation = 'source-in'; tctx.fillStyle = '#000'; tctx.fillRect(0, 0, tmp.width, tmp.height);
  const ox = gx - pvx * sc, oy = gy - pvy * sc;
  mctx.globalCompositeOperation = 'lighten';
  const wtmp = createCanvas(tmp.width, tmp.height); const wctx = wtmp.getContext('2d');
  wctx.drawImage(tmp, 0, 0); wctx.globalCompositeOperation = 'source-in'; wctx.fillStyle = '#fff'; wctx.fillRect(0, 0, tmp.width, tmp.height);
  mctx.drawImage(wtmp, ox / PX * MASK_PX, oy / PX * MASK_PX, tmp.width / PX * MASK_PX, tmp.height / PX * MASK_PX);
}
// Apply the mask to the ground ONCE (so overlapping tree shadows never double-darken).
{
  const big = createCanvas(W, H); const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true; bctx.drawImage(mask, 0, 0, W, H);
  const m = bctx.getImageData(0, 0, W, H).data;
  const g = ctx.getImageData(0, 0, W, H); const gp = g.data;
  for (let i = 0; i < gp.length; i += 4) {
    const a = (m[i] / 255) * SHADOW_ALPHA;
    if (a > 0) { gp[i] *= 1 - a; gp[i + 1] *= 1 - a; gp[i + 2] *= 1 - a; }
  }
  ctx.putImageData(g, 0, 0);
}

// ── 4. EXPORT: full-res tiles (≤ 2048, mobile-safe) and a half-res image (Low tier) ──────────────────
const TILE = 2048;
const tiles = [];
for (let ty = 0; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
  const tw = Math.min(TILE, W - tx), th = Math.min(TILE, H - ty);
  const c = createCanvas(tw, th); c.getContext('2d').drawImage(bake, tx, ty, tw, th, 0, 0, tw, th);
  const name = `ground_${tx / TILE}_${ty / TILE}.webp`;
  fs.writeFileSync(path.join(OUT, name), await c.encode('webp', 100));
  tiles.push({ name, x: tx / PX, y: ty / PX, w: tw / PX, h: th / PX });
}
const half = createCanvas(W / 2, H / 2); const hctx = half.getContext('2d'); hctx.imageSmoothingEnabled = false; hctx.drawImage(bake, 0, 0, W / 2, H / 2);
fs.writeFileSync(path.join(OUT, 'ground_half.webp'), await half.encode('webp', 100));
fs.writeFileSync(path.join(SCRATCH, 'shadow_mask.png'), await mask.encode('png'));
fs.writeFileSync(path.join(OUT, "routes.json"), JSON.stringify(traffic));
{ // road wear mask (SUB px per cell) for stylised renderers: R = wear 0..1, zero on cells that never wear
  const rm = createCanvas(FC, FR), rctx = rm.getContext('2d'), id = rctx.createImageData(FC, FR);
  for (let fy = 0; fy < FR; fy++) for (let fx = 0; fx < FC; fx++) {
    const v = noWear[Math.floor(fy / SUB) * cols + Math.floor(fx / SUB)] ? 0 : Math.round(wear[fy * FC + fx] * 255), o = (fy * FC + fx) * 4;
    id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255;
  }
  rctx.putImageData(id, 0, 0); fs.writeFileSync(path.join(OUT, 'road_mask.png'), await rm.encode('png'));
}
fs.writeFileSync(path.join(SCRATCH, 'ground_full_preview.png'), await (() => { const p = createCanvas(W / 4, H / 4); p.getContext('2d').drawImage(bake, 0, 0, W / 4, H / 4); return p.encode('png'); })());

// Level data the runtime needs (same values the sim uses).
const level = {
  cols, rows, PX_PER_CELL: PX,
  base: { x: map.base.x, y: map.base.y },
  baseCells,
  blocked: map.blockedCells.map((c) => c.y * cols + c.x),
  water: map.waterCells.map((c) => c.y * cols + c.x),
  terrain: forge.terrain,
  decor: forge.decor,
  waveWindows: forge.waveWindows,
  spawnsByWave: forge.spawnsByWave,
  resources: forge.resources,
  tiles,
  pine: { cell: pinePart.cell, pivot: pinePart.pivot, footprint: pinePack.footprint, renderScale: pinePack.renderScale, tiles: decorTiles, scale: (pinePack.decor && pinePack.decor.scale) || 1 },
  shadowAlpha: SHADOW_ALPHA,
  maskPx: MASK_PX,
};
fs.writeFileSync(path.join(OUT, 'level.json'), JSON.stringify(level));
console.log('tiles', tiles.map((t) => t.name).join(' '));
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0), 'KB');
