/**
 * Stack Forge — the full voxel unit pipeline (vox-s1..s7), self-contained CLASSIC script (global PIXI).
 *
 *   1 (vox-s1) load part art (color + optional height) OR a procedural placeholder, per-object
 *              resolution (footprint px) + layer count.
 *   2 (vox-s7) orbit the model as 3D, set the bake camera (azimuth/elevation).
 *   3          one game-aligned directional light (stored in the manifest so every unit agrees).
 *   4 (vox-s3) bake the per-angle cache with the CAS-lite unsharp smooth/sharpen pass; preview baked.
 *   5 (vox-s4) save the unit: sprite-sheet atlas(es) + <unit>.json → units manifest + downloads.
 *
 * Mirrors src/render/voxel/{pack,select,stack}.js (the tested GAME modules) — inlined so the tool has
 * no cross-dir imports (which failed on file://). The runtime (vox-s5) consumes exactly this pack.
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// INK: the ONE alpha threshold deciding "this pixel is subject". Every consumer in the carve path must use
// it. The footprint used to test >20 while the elevation masks tested >40, so a slice at alpha 30 was solid
// to one and empty to the other — the views disagreed about where the silhouette ended.
const INK_A = 40;
// WHICH SLICES CUT. Owner: "carve top, then carve side, then carve front" — each button carves
// cumulatively up to and including its own slice, so every stage can be checked before the next.
// WHICH SLICES CUT. Defaulted to TOP ONLY and was persisted nowhere, so every load — and every one of
// the ~20 recarve() call sites — rebuilt the model as the top silhouette extruded through the full box
// height, with the side and front art contributing nothing. Owner's rule 4 is 'their COLLISIONS carve
// the block'; that was opt-in, and it reset on reload. carve.js (the TESTED core) already defaulted to
// all three, so the tested carve and the shipped carve disagreed and no test could see it.
const carveCuts = { top: true, side: true, front: true };
// ── TRACE: instruments the REAL carve path so every step reports its own voxel/pixel count. Armed by
// ⬛ Regenerate geometry; null otherwise, so the cost is one null check per step.
let TRACE = null;
const T = (label, n, extra) => { if (TRACE) TRACE.push({ label, n, extra: extra || '' }); };
const countOpaque = (cv) => { if (!cv) return -1; const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data; let k = 0; for (let i = 0; i < cv.width * cv.height; i++) if (d[i * 4 + 3] > INK_A) k++; return k; };
const countMask = (g) => { if (!g) return -1; let k = 0; for (let i = 0; i < g.m.length; i++) if (g.m[i]) k++; return k; };
const countVol = (V) => { let k = 0; for (let i = 0; i < V.length; i++) if (V[i]) k++; return k; };
// screen px per layer at 1 px/voxel: a voxel is a real cube (zScale stretches it) seen at the camera tilt
const layerSp = (elDeg) => state.zScale * Math.cos(clamp(elDeg, 0, 90) * Math.PI / 180);
// BODY_FRAMES 16 -> 32 (owner 2026-08-07): 22.5° steps were visibly chunky as a hull turned; 11.25° is
// half that. NOTHING downstream hardcodes the count — packAtlas derives cols from ceil(sqrt(n)),
// angleBucket(heading, n) takes any n, pack.js only requires facings > 0, and the loader reads `facings`
// off the PACK. So this is opt-in per unit: already-baked units keep rendering at whatever count their
// pack records, and pick up 32 only when re-baked. Nothing shipped changes until you choose to.
//
// COST, measured across the 7 shipped packs: total atlas pixels 29.5M -> 36.9M (1.25x, ~113 -> ~141 MB
// VRAM at 4 B/px). Only a quarter more because the 64-angle turrets already dominate the budget.
// Note this spends VRAM and DOWNLOAD, which the recent save-architecture work did NOT improve — that
// moved atlases out of the localStorage quota into IndexedDB/disk, which is a different budget.
//
// WATCH GND-Artillery. Its turret atlas is ALREADY 2592x2816, past WebGL's guaranteed 2048
// MAX_TEXTURE_SIZE floor (most real devices do 4096+, so this is a risk, not a live break). At 32 its
// body atlas reaches 1944x2112 and crosses that floor too. Every other unit stays well under.
const WORLD_SCALE = 3, BODY_FRAMES = 32, TURRET_FRAMES = 64, MANIFEST_KEY = 'bulwark:stackforge';
// THE world-scale contract (mirrors src/render/voxel/pack.js): 32 voxels = 1 tile for EVERY unit.
// Bigger unit ⇒ higher Resolution, never a bigger stretch — voxel density is constant on the board.
const VOX_PER_TILE = 32;
const unitTiles = (foot) => foot / VOX_PER_TILE;
// COLLISION footprint: mirrors the game (loader.VOXEL_UNIT_SCALE 0.5) with a small pad so the body touches
// just before it collides. Half-width in TILES = tiles · 0.5 · 1.2 / 2 = tiles · 0.3. Shown as a ring in the
// in-game preview and shipped as pack.collision so the sim's unit radius matches the tank on screen.
const GAME_UNIT_SCALE = 0.5, COLLISION_PAD = 1.2;
// collision from the ACTUAL filled body extent, NOT the footprint resolution (which includes padding) — so
// the ring + shipped pack.collision match the VISIBLE tank, not the oversized bounding box. Cached per model.
let _collCache = { sig: '', tiles: 0 };
let carveEpoch = 0;      // bumped on every re-carve; part of the collision cache key so new art can't return a stale radius
function bodyExtentTiles() {
  // GEOMETRY LIVES IN VOL, so this keys on carveEpoch alone. It used to hash voxEdit — the count plus a
  // per-entry del/fill flag — to catch an erase-then-repaint that leaves the size unchanged. voxEdit no
  // longer describes geometry at all (zero 'del' writers remain), so that hash could only go stale in the
  // one direction that matters: an edit that changes the extent without touching the overlay.
  // carveEpoch is bumped by refreshModel(), which EVERY geometry edit calls, so it covers all of them.
  const foot = state.foot, layers = state.bodyLayers, sig = carveEpoch + ':' + foot + ':' + layers;
  if (_collCache.sig === sig) return _collCache.tiles;
  let ex = foot;
  try {
    const m = buildModel('body', foot, layers);
    let minx = foot, maxx = -1, miny = foot, maxy = -1;
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!m.filled(x, y, z)) continue;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    if (maxx >= 0) ex = Math.max(maxx - minx + 1, maxy - miny + 1);   // widest horizontal span of real voxels
  } catch (e) { /* fall back to footprint */ }
  const tiles = (ex / VOX_PER_TILE) * GAME_UNIT_SCALE * COLLISION_PAD / 2;
  _collCache = { sig, tiles };
  return tiles;
}
const _CLASSES = new Set(['ground', 'air', 'structure', 'decor']), _KINDS = new Set(['directional', 'stack']);
function validatePack(p) {
  const e = [];
  if (!p || typeof p !== 'object') return { ok: false, errors: ['not an object'] };
  if (!p.id) e.push('missing id');
  if (!_CLASSES.has(p.class)) e.push('bad class');
  if (!Array.isArray(p.footprint) || p.footprint.length !== 3) e.push('footprint [W,D,H]');
  if (!p.camera || typeof p.camera.azimuth !== 'number' || typeof p.camera.elevation !== 'number') e.push('camera {azimuth,elevation}');
  if (typeof p.layerSpacing !== 'number') e.push('layerSpacing');
  if (!Array.isArray(p.parts) || !p.parts.length) e.push('parts[]');
  else p.parts.forEach((pt, i) => {
    if (!pt.id) e.push(`part[${i}] id`);
    if (!_KINDS.has(pt.kind)) e.push(`part[${i}] kind`);
    if (!pt.atlas) e.push(`part[${i}] atlas`);
    if (pt.kind === 'directional' && !(pt.facings > 0)) e.push(`part[${i}] facings`);
    if (pt.kind === 'stack' && !(pt.angles > 0)) e.push(`part[${i}] angles`);
  });
  return { ok: e.length === 0, errors: e };
}

// bake geometry from a unit's resolution/layers/spacing. pivotPx offsets the rotation centre along the
// length; the render texture is sized to the max pivot→corner radius so an offset barrel never clips.
function geom(foot, layers, sp, pivotPx) {
  pivotPx = pivotPx || 0;
  const px = foot / 2 + pivotPx, R = Math.hypot(Math.max(px, foot - px), foot / 2);
  const DIAG = Math.ceil(2 * R), RTW = DIAG + 8, RTH = Math.ceil(DIAG + layers * sp) + 8;
  return { DIAG, RTW, RTH, CX: RTW / 2, BASEY: RTH - DIAG / 2 - 4 };
}
const rr = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

// ── procedural placeholder parts (used when no color image is loaded). front = +X ──
function drawBody(x, hx, f) {
  const c = f / 2;
  for (const sy of [-0.40, 0.28]) { x.fillStyle = '#28241d'; rr(x, c - f * 0.43, c + f * sy, f * 0.86, f * 0.12, 3); x.fill();
    hx.fillStyle = '#3a3a3a'; rr(hx, c - f * 0.43, c + f * sy, f * 0.86, f * 0.12, 3); hx.fill(); }
  x.fillStyle = '#ad9d73'; rr(x, c - f * 0.42, c - f * 0.24, f * 0.84, f * 0.48, 5); x.fill();
  x.fillStyle = '#c9b88d'; rr(x, c + f * 0.26, c - f * 0.24, f * 0.16, f * 0.48, 4); x.fill();
  hx.fillStyle = '#8a8a8a'; rr(hx, c - f * 0.42, c - f * 0.24, f * 0.84, f * 0.48, 5); hx.fill();
}
function drawTurret(x, hx, f) {
  const c = f / 2;
  x.fillStyle = '#6f6a52'; rr(x, c + f * 0.06, c - f * 0.045, f * 0.42, f * 0.09, 3); x.fill();
  hx.fillStyle = '#9a9a9a'; rr(hx, c + f * 0.06, c - f * 0.045, f * 0.42, f * 0.09, 3); hx.fill();
  x.fillStyle = '#b6a67f'; rr(x, c - f * 0.22, c - f * 0.20, f * 0.40, f * 0.40, 8); x.fill();
  x.fillStyle = '#c9b88d'; x.beginPath(); x.arc(c - f * 0.04, c - f * 0.04, f * 0.07, 0, 7); x.fill();
  hx.fillStyle = '#e0e0e0'; rr(hx, c - f * 0.22, c - f * 0.20, f * 0.40, f * 0.40, 8); hx.fill();
}

// aspect-preserving fit: draw img centred inside w×h WITHOUT stretching (fixes squished footprints).
function drawFit(ctx, img, w, h) {
  const s = Math.min(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
// knock out a solid (e.g. white) background by FLOOD-FILLING from the image border through
// background-coloured pixels. Only bg actually connected to the edge is removed, so it works when the
// object runs off an edge (tank tracks) AND when bg floats between object parts (above/below a barrel) —
// the flood reaches those pockets from the border and stops at the object outline. Feathers the AA edge.
function keyBackground(data, w, h, tol, picks) {
  tol = tol || 75;                                                   // cutout sensitivity (per-image, tunable)
  const satC = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b), SAT_GUARD = 40;
  // SEED COLOURS: explicit eyedropper picks ("touch to remove") take over; otherwise majority-vote the
  // opaque corners for the background colour. Multiple picks let you knock out several tints in one go;
  // each pick can also carry the clicked point so an INTERIOR patch of that colour (not touching the
  // border) still floods.
  let seeds, seedPts = [];
  if (picks && picks.length) {
    seeds = picks.map((p) => p.col);
    seedPts = picks.filter((p) => p.pt).map((p) => p.pt);
  } else {
    const c = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    const cs = [c(0, 0), c(w - 1, 0), c(0, h - 1), c(w - 1, h - 1)];
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let seed = null, best = 0;
    for (const q of cs) { if (q[3] < 200) continue; let n = 0; for (const r of cs) if (r[3] > 200 && dist(q, r) < 45) n++; if (n > best) { best = n; seed = q; } }
    if (!seed) return;                                               // no opaque border colour → leave as-is
    seeds = [[seed[0], seed[1], seed[2]]];
  }
  const seedSat = seeds.map((s) => satC(s[0], s[1], s[2]));
  // nearest seed (Manhattan) + its index → the tolerance test and the per-seed CHROMA GUARD below.
  const nearInfo = (p) => { const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2]; let bd = 1e9, bi = 0;
    for (let i = 0; i < seeds.length; i++) { const s = seeds[i], d = Math.abs(r - s[0]) + Math.abs(g - s[1]) + Math.abs(b - s[2]); if (d < bd) { bd = d; bi = i; } } return [bd, bi]; };
  // SATURATION GUARD: never remove a pixel much more CHROMATIC than the matched seed (chroma = max−min).
  // A white/grey seed (chroma≈0) would otherwise let a high tolerance eat saturated subject pixels
  // (dark-green leaves touching white). Relative to the seed, so a coloured background still keys.
  const okChroma = (p, bi) => (satC(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) - seedSat[bi]) <= SAT_GUARD;
  const N = w * h, vis = new Uint8Array(N), st = [];
  const hard = tol * 0.8, soft = tol * 1.75, span = Math.max(1, soft - hard);   // feather band scales with tol
  const push = (x, y) => { if (x < 0 || x >= w || y < 0 || y >= h) return; const p = y * w + x; if (vis[p]) return; const ni = nearInfo(p); if (ni[0] < tol && okChroma(p, ni[1])) { vis[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }        // seed the whole border
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  for (const pt of seedPts) push(pt[0] | 0, pt[1] | 0);             // eyedropper points seed interior regions too
  while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }
  for (let p = 0; p < N; p++) {
    if (vis[p]) { data[p * 4 + 3] = 0; continue; }                   // flooded background → transparent
    // HARD EDGE: an anti-aliased pixel touching removed background goes FULLY transparent. No ramp — alpha
    // is binary, opaque or clear. The old graded band left pixels at alpha 107/164/188, which then read as
    // ink to one threshold and clear to another.
    const ni = nearInfo(p), d = ni[0];
    if (d < soft && okChroma(p, ni[1])) {                           // …but never eat a saturated subject edge
      const x = p % w, y = (p / w) | 0;
      if ((x > 0 && vis[p - 1]) || (x < w - 1 && vis[p + 1]) || (y > 0 && vis[p - w]) || (y < h - 1 && vis[p + w]))
        data[p * 4 + 3] = 0;
    }
  }
}
// raster an image at native size and knock out its background → a canvas with clean alpha. Optional polygon
// shapes ({ pts:[[x,y]…], cut }) then edit the result: KEEP shapes union into the subject (everything outside
// all keeps is removed), CUT shapes punch holes. Keying runs FIRST (the flood needs the real image borders).
// `maxPx` (optional) keys a DOWNSCALED copy instead of the native raster. Keying is a border flood fill
// over every pixel, so a 2000x2000 reference photo is 4M pixels of work — right once for the editor,
// ruinous forty times over for roster card thumbnails. At maxPx=152 that is ~17k pixels, ~250x less, and
// it is the same algorithm on the same seeds: the card shows what the carve keys, not the background the
// artist keyed out. Polygon shapes and eyedropper points are in SOURCE coordinates, so they scale with
// the raster — otherwise a downscaled key would cut in the wrong place.
// Omit it and nothing changes: every existing caller keys at native size.
function keyedCanvas(img, tol, polys, picks, maxPx) {
  const iw = img.width, ih = img.height;
  const s = (maxPx && Math.max(iw, ih) > maxPx) ? maxPx / Math.max(iw, ih) : 1;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(iw * s)); cv.height = Math.max(1, Math.round(ih * s));
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height);
  if (s !== 1 && picks && picks.length) picks = picks.map((p) => (p.pt ? { col: p.col, pt: [p.pt[0] * s, p.pt[1] * s] } : p));
  const id = g.getImageData(0, 0, cv.width, cv.height); keyBackground(id.data, cv.width, cv.height, tol, picks); g.putImageData(id, 0, 0);
  if (polys && polys.length) {
    if (s !== 1) polys = polys.map((q) => ({ cut: q.cut, pts: q.pts.map((p) => [p[0] * s, p[1] * s]) }));
    const trace = (list) => { g.beginPath();
      for (const q of list) { g.moveTo(q.pts[0][0], q.pts[0][1]); for (let i = 1; i < q.pts.length; i++) g.lineTo(q.pts[i][0], q.pts[i][1]); g.closePath(); } g.fill(); };
    const keeps = polys.filter((q) => !q.cut && q.pts.length >= 3), cuts = polys.filter((q) => q.cut && q.pts.length >= 3);
    if (keeps.length) { g.globalCompositeOperation = 'destination-in'; trace(keeps); }
    if (cuts.length) { g.globalCompositeOperation = 'destination-out'; trace(cuts); }
    g.globalCompositeOperation = 'source-over';
  }
  return cv;
}
// keyed + CROPPED to the content bounding box — so empty margins and the raw image aspect ratio don't
// distort registration (a long-barrel side view maps its CONTENT, not the whole rectangle).
function keyedCropped(img, tol, poly, picks) {
  const k = keyedCanvas(img, tol, poly, picks), d = k.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, k.width, k.height).data;
  let x0 = k.width, y0 = k.height, x1 = -1, y1 = -1;
  for (let yy = 0; yy < k.height; yy++) for (let xx = 0; xx < k.width; xx++) if (d[(yy * k.width + xx) * 4 + 3] > INK_A) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < x0) return k;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(k, x0, y0, cw, ch, 0, 0, cw, ch);
  return cv;
}
// sliceMask — read the ORIGINAL slice directly onto a w×h box face. For each face cell, sample the ONE
// source pixel at that cell's centre: opaque -> geo, clear -> no geo. Nothing else. No canvas rescale, no
// interpolation, no averaging, no crop, no aspect refit, no normalize. `elev` flips rows so image-down = z-up.
// (Replaces sliceMask, which rescaled through drawImage and let the browser invent in-between alpha.)
// ONE RESAMPLER. The body of this function used to be a second, independent copy of carve.js's
// sliceMask -- the tested one, which stack-forge.html never loaded. Two implementations of the same
// maths is how the grid and the carve came to disagree on 414 of 1728 cells. It now delegates, so
// carve.test.mjs is a real gate on the code the browser runs.
// Verified behaviour-preserving before switching: 24 cases across four source sizes, three target
// sizes and both elev modes -- zero differing cells in either the mask or the colour buffer.
// A canvas as the { width, height, data } buffer carve.js expects. Null in, null out — a missing slice
// must stay missing, because carve() treats a null slice as "cuts nothing on this axis".
function asPixels(canvas) {
  if (!canvas) return null;
  if (canvas.data) return canvas;                                   // already a pixel buffer
  const w = Math.max(1, canvas.width), h = Math.max(1, canvas.height);
  return { width: w, height: h, data: canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data };
}
function sliceMask(canvas, w, h, elev) {
  const sw = Math.max(1, canvas.width), sh = Math.max(1, canvas.height);
  const img = canvas.data ? canvas                                  // already an ImageData-shaped buffer
    : { width: sw, height: sh, data: canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data };
  return globalThis.sliceMaskCore(img, w, h, elev);
}
function parseVox(buf) {
  const dv = new DataView(buf); let p = 0;
  const u32 = () => { const v = dv.getUint32(p, true); p += 4; return v; };
  const tag = () => { const s = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)); p += 4; return s; };
  if (tag() !== 'VOX ') throw new Error('not a .vox file');
  u32();                                                       // version
  if (tag() !== 'MAIN') throw new Error('no MAIN chunk');
  u32(); const end = p + u32();                                // MAIN content bytes (0) + children bytes
  let size = null, rgba = null; const models = [];
  while (p < end) {
    const id = tag(), n = u32(), cN = u32(), next = p + n + cN;
    if (id === 'SIZE') size = [u32(), u32(), u32()];
    else if (id === 'XYZI') { const cnt = u32(), arr = new Uint8Array(cnt * 4); for (let i = 0; i < cnt * 4; i++) arr[i] = dv.getUint8(p + i); models.push({ size, vox: arr, count: cnt }); }
    else if (id === 'RGBA') { rgba = new Uint8Array(1024); for (let i = 0; i < 1024; i++) rgba[i] = dv.getUint8(p + i); }
    p = next;
  }
  if (!models.length || !models[0].size) throw new Error('no voxel models');
  // MagicaVoxel OMITS the RGBA chunk when a model uses the stock palette, so `rgba` is null for a large
  // share of real .vox files. This read an undeclared DEFAULT_VOX_PALETTE and every such import died with
  // "DEFAULT_VOX_PALETTE is not defined". The stock palette is a fixed 256-entry table; rather than inline
  // 1KB of it for a fallback, synthesise a stable ramp so the import SUCCEEDS and the model is visible and
  // recolourable, instead of failing outright. Colours will not match MagicaVoxel's default swatches — that
  // is the deliberate trade, and it beats refusing the file.
  const m = models[0], [nx, ny, nz] = m.size;
  const pal = rgba || (() => {
    const p = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      p[i * 4] = (i * 37) & 255; p[i * 4 + 1] = (i * 91) & 255; p[i * 4 + 2] = (i * 53) & 255; p[i * 4 + 3] = 255;
    }
    return p;
  })();
  const data = new Uint8Array(nx * ny * nz * 4);
  for (let i = 0; i < m.count; i++) {
    const x = m.vox[i * 4], y = m.vox[i * 4 + 1], z = m.vox[i * 4 + 2], c = m.vox[i * 4 + 3], pi = ((c - 1) & 255) * 4;
    const di = ((z * ny + y) * nx + x) * 4;
    data[di] = pal[pi]; data[di + 1] = pal[pi + 1]; data[di + 2] = pal[pi + 2]; data[di + 3] = 255;
  }
  return { nx, ny, nz, data };
}
// resample an imported voxel model into the tool's foot×foot×layers grid (aspect-preserving footprint,
// centred; z fit to layers). Returns per-voxel colour (vcol) + filled(), matching buildVolume's shape.
function buildVoxVolume(vm, foot, layers) {
  const { nx, ny, nz, data } = vm, N = foot * foot;
  const sxy = Math.min(foot / nx, foot / ny), bw = Math.max(1, Math.round(nx * sxy)), bh = Math.max(1, Math.round(ny * sxy));
  const Hh = Math.min(layers, nz), offx = (foot - bw) >> 1, offy = (foot - bh) >> 1;
  const vcol = new Uint8Array(layers * N * 3), fill = new Uint8Array(layers * N);
  for (let z = 0; z < layers; z++) {
    const mz = Math.floor(z * nz / Hh); if (mz >= nz) continue;
    for (let y = 0; y < foot; y++) {
      const my = Math.floor((y - offy) / sxy); if (my < 0 || my >= ny) continue;
      for (let x = 0; x < foot; x++) {
        const mx = Math.floor((x - offx) / sxy); if (mx < 0 || mx >= nx) continue;
        const di = ((mz * ny + my) * nx + mx) * 4;
        // NOT INK_A, deliberately: an imported .vox has no anti-aliased edge, so any alpha is a real voxel
        if (data[di + 3] > 0) { const oi = z * N + y * foot + x; fill[oi] = 1; vcol[oi * 3] = data[di]; vcol[oi * 3 + 1] = data[di + 1]; vcol[oi * 3 + 2] = data[di + 2]; }
      }
    }
  }
  const filled = (x, y, z) => (x >= 0 && x < foot && y >= 0 && y < foot && z >= 0 && z < layers) ? !!fill[z * N + y * foot + x] : false;
  return { VOL: fill, filled, vcol, cd: null, dbg: { vox: [nx, ny, nz], bw, bh, Hh } };   // VOL: edits reach an imported .vox
}

// ── .vox writer: turn our carved/imported data back into a real MagicaVoxel object (round-trips to any
// voxel editor and back through parseVox). Serialises SIZE + XYZI + a ≤256 RGBA palette. ──
function writeVox(nx, ny, nz, voxels, palette) {
  const cnt = voxels.length, sizeC = 12, xyziC = 4 + cnt * 4, rgbaC = 1024, hdr = 12;
  const children = (hdr + sizeC) + (hdr + xyziC) + (hdr + rgbaC), total = 8 + hdr + children;
  const buf = new ArrayBuffer(total), dv = new DataView(buf); let p = 0;
  const str = (s) => { for (let i = 0; i < 4; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v) => { dv.setUint32(p, v, true); p += 4; };
  str('VOX '); u32(150); str('MAIN'); u32(0); u32(children);
  str('SIZE'); u32(sizeC); u32(0); u32(nx); u32(ny); u32(nz);
  str('XYZI'); u32(xyziC); u32(0); u32(cnt);
  for (const v of voxels) { dv.setUint8(p++, v.x); dv.setUint8(p++, v.y); dv.setUint8(p++, v.z); dv.setUint8(p++, v.ci); }
  str('RGBA'); u32(rgbaC); u32(0);
  for (let i = 0; i < 256; i++) { const c = palette[i] || [0, 0, 0]; dv.setUint8(p++, c[0]); dv.setUint8(p++, c[1]); dv.setUint8(p++, c[2]); dv.setUint8(p++, 255); }
  return buf;
}
// gather a part's filled voxels as {x,y,z,r,g,b}, offset into place.
// THE MODEL'S COLOUR, VERBATIM. This used to run a live quantiser + the palMap tuner over every voxel on
// the way out, so the .vox export and the Tier C model embed shipped colours that were never stored on the
// model — the artist's hex was replaced downstream, silently. Palette work is PAINT now (it writes vcol
// through setVox), so there is nothing left to apply here: what the model holds is what ships.
function collectVox(partId, foot, layers, zOff, xOff) {
  const { filled, vcol } = buildModel(partId, foot, layers), N = foot * foot, out = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3, r = vcol[c], g = vcol[c + 1], b = vcol[c + 2];
    const X = x + xOff, Z = z + zOff; if (X < 0 || X > 255 || Z < 0 || Z > 255) continue;
    out.push({ x: X, y, z: Z, r, g, b });
  }
  return out;
}
// export the current model (body + turret assembled, or the active part) as a .vox download
function exportVox() {
  const foot = state.foot, mount = mountZOf(state.bodyLayers);
  let cells = [];
  if (state.part !== 'turret') cells = cells.concat(collectVox('body', foot, state.bodyLayers, 0, 0));
  if (state.part !== 'body') {                                     // SF3: center the (smaller) turret in the base grid
    const tFoot = footOf('turret'), tc = Math.floor((foot - tFoot) / 2);
    const tcells = collectVox('turret', tFoot, state.turretLayers, mount, 0);
    for (const c of tcells) { c.x += tc + Math.round(state.turretDx); c.y += tc; }
    cells = cells.concat(tcells);
  }
  if (!cells.length) { alert('Nothing to export — load art or a .vox first.'); return; }
  const uniq = new Map(); for (const c of cells) { const k = (c.r << 16) | (c.g << 8) | c.b; if (!uniq.has(k)) uniq.set(k, [c.r, c.g, c.b]); }
  let pal = [...uniq.values()]; if (pal.length > 255) pal = medianCut(pal, 255);
  const pcache = new Map(), idxOf = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let v = pcache.get(k); if (v !== undefined) return v; let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const q = pal[i], d = (q[0] - r) * (q[0] - r) + (q[1] - g) * (q[1] - g) + (q[2] - b) * (q[2] - b); if (d < bd) { bd = d; bi = i; } } pcache.set(k, bi); return bi; };
  let nz = 1; for (const c of cells) if (c.z + 1 > nz) nz = c.z + 1;
  const voxels = cells.map((c) => ({ x: c.x, y: c.y, z: c.z, ci: idxOf(c.r, c.g, c.b) + 1 }));
  const buf = writeVox(foot, foot, nz, voxels, pal);
  const id = ($('uid').value || 'unit').trim(), url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  dl(`${id}.vox`, url); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Space-carve a part's volume from orthographic views: TOP → footprint + colour; SIDE (height along the
// length) + FRONT (height across the width) → the carved height; BACK falls back for FRONT. A voxel is
// filled only where every supplied view agrees. Top alone = flat extrude. No Top view → procedural.
// Returns { cd (colour bytes), H (top-surface height/column), filled(x,y,z) }.
// GEOMETRY placement (owner 2026-07-18): the legacy "top = master scale" normalization, expressed as
// the three world-axis spans [lo,hi) the carve reads — spanX/spanY = footprint length/width, spanZ =
// height. The geometry step will let the user override these; keeping the math here verbatim means auto
// placement is byte-identical to before. Every downstream mask derives bw/bh/Hv/ox/oy/z0 from the spans.
// THE BOX IS THE GRID (owner 2026-08-04). The slices are stretched over the SIDES OF A BOX and their
// collisions carve it; the box is therefore simply the grid the artist sized with Resolution (x/y) and
// Layers (z). Nothing here derives a sub-box from the art's aspect ratio — that was the "top = master
// scale" normalize, and it is the thing that made a 20px and a 100px drawing carve the same block.
function autoSpans(foot, layers) {
  return { spanX: { lo: 0, hi: foot }, spanY: { lo: 0, hi: foot }, spanZ: { lo: 0, hi: layers }, Hraw: layers };
}
// the spans the carve uses: auto placement (autoSpans) unless the artist has manually reconciled this
// part in the geometry step, in which case use the saved spans, clamped to the grid (lo<hi, hi≤foot/≤layers).
function geomSpans(partId, topC, sideC, frontC, foot, layers, reach) {
  const g = geomState[partId];
  if (!g || g.auto || !g.spanX) return autoSpans(foot, layers);
  // INVARIANT: footOf/gridLayersOf make the grid ⊇ geometry, so this clamp should be a no-op. If it ever fires,
  // the grid is smaller than the geometry (only possible at the hard 128 ceiling) — make that LOUD, never silent.
  const span = (s, cap) => {
    if ((s.hi | 0) > cap && !geomSpans._warned) { geomSpans._warned = true; console.warn(`[stack-forge] ${partId}: geometry span ${s.hi} exceeds grid ${cap} — CLAMPED (128-voxel ceiling). Reduce the unit or split it.`); }
    let lo = Math.max(0, Math.min(cap - 1, s.lo | 0)), hi = Math.max(lo + 1, Math.min(cap, s.hi | 0)); return { lo, hi };
  };
  const spanZ = span(g.spanZ, layers);
  return { spanX: span(g.spanX, foot), spanY: span(g.spanY, foot), spanZ, Hraw: spanZ.hi - spanZ.lo };
}
// Story 6 — PROCEDURAL tree: trunk cylinder + canopy from panel params, no source art.
function buildProceduralTree(foot, layers) {
  const N = foot * foot, cx = (foot - 1) / 2, cy = (foot - 1) / 2;
  const trunkH = clamp(state.decorTrunkH | 0, 1, layers), trunkR = Math.max(0.5, state.decorTrunkR);
  const canopyBase = clamp(state.decorCanopyBase | 0, 0, layers - 1), canopyR = Math.max(1, state.decorCanopyR), shape = state.decorCanopy || 'cone';
  const trunkCol = [96, 66, 38], canopyCol = [46, 120, 54];
  const vcol = new Uint8Array(layers * N * 3), fill = new Uint8Array(layers * N);
  const set = (x, y, z, col) => { if (x < 0 || y < 0 || z < 0 || x >= foot || y >= foot || z >= layers) return; const k = z * N + y * foot + x; fill[k] = 1; const c = k * 3; vcol[c] = col[0]; vcol[c + 1] = col[1]; vcol[c + 2] = col[2]; };
  const disc = (z, r, col) => { if (r < 0.5) return; for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) set(x, y, z, col); } };
  for (let z = 0; z < trunkH; z++) disc(z, trunkR, trunkCol);        // trunk
  const chH = Math.max(1, layers - canopyBase);
  for (let z = canopyBase; z < layers; z++) {                        // canopy — radius profile by shape
    const f = (z - canopyBase) / chH;                                // 0 at base → 1 at top
    let r; if (shape === 'cone') r = canopyR * (1 - f);
    else if (shape === 'round') r = canopyR * Math.sqrt(Math.max(0, 1 - (2 * f - 1) * (2 * f - 1)));
    else r = canopyR * (0.55 + 0.45 * Math.sin(f * Math.PI));        // blob: fat middle
    disc(z, r, canopyCol);
  }
  const filled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && !!fill[z * N + y * foot + x];
  return { VOL: fill, vcol, filled, views: null, sp: null, dbg: { proc: true } };   // VOL: edits reach a procedural tree
}
function buildVolume(partId, foot, layers) {
  if (voxPart[partId]) return buildVoxVolume(voxPart[partId], foot, layers);   // imported .vox → use it directly
  if (editingDecor && partId === 'body' && state.decorProc) return buildProceduralTree(foot, layers);   // parameters, not slices
  // NOTE: no decor carve fork. Decor and units run the SAME slices-over-a-box intersection.
  const src = imgs[partId], N = foot * foot;
  if (!src.top && !src.side && !src.front && !src.back) {   // ── no art at all → procedural placeholder ──
    const col = document.createElement('canvas'); col.width = col.height = foot;
    const hgt = document.createElement('canvas'); hgt.width = hgt.height = foot;
    const cx = col.getContext('2d', { willReadFrequently: true }), hx = hgt.getContext('2d', { willReadFrequently: true });
    hx.fillStyle = '#000'; hx.fillRect(0, 0, foot, foot);
    (partId === 'turret' ? drawTurret : drawBody)(cx, hx, foot);
    const cd = cx.getImageData(0, 0, foot, foot).data, hd = hx.getImageData(0, 0, foot, foot).data;
    const H = new Float32Array(N);
    for (let i = 0; i < N; i++) H[i] = cd[i * 4 + 3] > INK_A ? (hd[i * 4] / 255) * layers : 0;
    // materialise the height field into a real VOL — every model source must be VOL-backed, or `filled`
    // is a closure the editor cannot write to and DEL silently does nothing on this part.
    const pv = new Uint8Array(layers * N);
    for (let z = 0; z < layers; z++) for (let i = 0; i < N; i++) if (z < H[i]) pv[z * N + i] = 1;
    return { VOL: pv, cd, H, filled: (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && !!pv[z * N + y * foot + x] };
  }
  // crop every view to its content, then register by a COMMON scale taken from the top's fit — so the
  // side's height maps PROPORTIONALLY (a long-barrel side doesn't get stretched vertically to fill layers).
  const tol = keyTolState[partId], pol = polyState[partId], pk = pickState[partId];
  const xf = imgXf[partId] || {};   // SF2 per-side alignment (scale/offset) folded into the carve
  if (TRACE) for (const v of ['top', 'side', 'front', 'back']) {
    const raw = src[v];
    if (!raw) { T(`slice ${v}`, -1, 'NO IMAGE'); continue; }
    const keyed = keyedCanvas(raw, tol[v], pol[v], pk[v]);
    const after = xfCanvas(keyed, xf[v]);
    const nRaw = raw.width * raw.height, nKey = countOpaque(keyed), nXf = countOpaque(after);
    const px = pol[v] && pol[v].length ? ` polys:${pol[v].length}` : '', pkx = pk[v] && pk[v].length ? ` picks:${pk[v].length}` : '';
    const xfx = (xf[v] && (xf[v].sx !== 1 || xf[v].sy !== 1 || xf[v].ox !== 0 || xf[v].oy !== 0)) ? ' XF-MOVED' : '';
    T(`slice ${v}`, nKey, `${raw.width}x${raw.height} (${nRaw}px) → keyed ${nKey} opaque (${(100 * nKey / nRaw).toFixed(1)}%) tol:${tol[v]}${px}${pkx} → after align ${nXf}${xfx}`);
  }
  const topC = src.top ? xfCanvas(keyedCanvas(src.top, tol.top, pol.top, pk.top), xf.top) : null;      // UNCROPPED: keeps position + size
  const sideC = src.side ? xfCanvas(keyedCanvas(src.side, tol.side, pol.side, pk.side), xf.side) : null;
  const frontC = src.front ? xfCanvas(keyedCanvas(src.front, tol.front, pol.front, pk.front), xf.front) : (src.back ? xfCanvas(keyedCanvas(src.back, tol.back, pol.back, pk.back), xf.back) : null);
  const tc = document.createElement('canvas'); tc.width = tc.height = foot; const tx = tc.getContext('2d', { willReadFrequently: true });
  // procedural barrel reserves a FORWARD margin so the body shrinks back and the tube protrudes past it
  const reach = (partId === 'turret' && state.barrelLen > 0) ? state.barrelLen : 0;
  // GEOMETRY: placement comes from three shared world-axis spans (auto today via autoSpans; the geometry
  // step will override them). Every mask below derives from the spans — z0 lets a silhouette sit off the
  // ground (z0=0 today, so behaviour is unchanged). Reconciliation is implicit: shared axes = shared span.
  const sp = geomSpans(partId, topC, sideC, frontC, foot, layers, reach);
  const ox = sp.spanX.lo, bw = sp.spanX.hi - sp.spanX.lo;
  const oy = sp.spanY.lo, bh = sp.spanY.hi - sp.spanY.lo;
  const z0 = sp.spanZ.lo, Hv = sp.spanZ.hi - sp.spanZ.lo, Hraw = sp.Hraw;
  T('box', bw * bh * Hv, `x[${ox},${ox + bw}) y[${oy},${oy + bh}) z[${z0},${z0 + Hv}) in grid ${foot}x${foot}x${layers} — ${(geomState[partId] && !geomState[partId].auto && geomState[partId].spanX) ? 'MANUAL' : 'auto (full grid)'}`);
  // ONE RESAMPLER FOR EVERY FACE. The footprint used to come from tx.drawImage — a canvas rescale that
  // point-samples each cell centre, so whether a feature survived depended on its PHASE, not its size,
  // while the elevations went through sliceMask's coverage test. Measured on detailed art at box 64: the
  // two silhouettes disagreed on 414 of 1728 cells, 366 of them cells the elevations wanted. Each one is a
  // whole vertical column the intersection then removed — the gaps and holes. Now the top goes through
  // sliceMask too, and its colour comes from the same cells, so a carved voxel can never lack a colour.
  if (!topC) { tx.fillStyle = '#9a8c66'; tx.fillRect(ox, oy, bw, bh); }   // no top → plain box from side/front
  const cd = tx.getImageData(0, 0, foot, foot).data;
  const topG = topC ? sliceMask(topC, bw, bh, false) : null;
  if (topG) for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = y * bw + x; if (!topG.m[i]) continue;
    const p = ((oy + y) * foot + (ox + x)) * 4;
    cd[p] = topG.c[i * 3]; cd[p + 1] = topG.c[i * 3 + 1]; cd[p + 2] = topG.c[i * 3 + 2]; cd[p + 3] = 255;
  }
  const sideG = sideC ? sliceMask(sideC, bw, Hv, true) : null;    // length × height 
  const frontG = frontC ? sliceMask(frontC, bh, Hv, true) : null; // width × height
  const backC = src.back ? xfCanvas(keyedCanvas(src.back, tol.back, pol.back, pk.back), xf.back) : null; // colour-only: paints the −x walls
  const backG = backC ? sliceMask(backC, bh, Hv, true) : null;
  if (TRACE) { T('mask top', countMask(topG), topG ? `${topG.w}x${topG.h} cells` : 'none — footprint falls back to the flat fill');
    T('mask side', countMask(sideG), sideG ? `${sideG.w}x${sideG.h} cells (does NOT cut yet)` : 'none');
    T('mask front', countMask(frontG), frontG ? `${frontG.w}x${frontG.h} cells (does NOT cut yet)` : 'none');
    T('mask back', countMask(backG), backG ? `${backG.w}x${backG.h} cells (colour only)` : 'none'); }
  const views = (sideG || frontG || backG) ? { side: sideG, front: frontG, back: backG, ox, oy, z0 } : null;

  // ── THE CARVE (owner 2026-08-04): 1. clear the volume  2. fill it with solid geo  3. apply each SLICE as
  // a mask and cut every voxel the slice does not cover with opacity. The mask IS the slice. Each cut runs
  // over the real volume in turn — nothing is lazy, nothing is re-derived, and a slice can only REMOVE.
  // CLEAR -> FILL SOLID -> CUT is carve.js's job. That module carries the tests; this file used to hold a
  // second, independent copy of the same loop, which is how the tested carve and the shipped carve came
  // to disagree on their defaults with nothing able to see it.
  // Proven byte-for-byte identical before switching: 32 cases across four grid sizes, full-grid and inset
  // boxes, and all four cut combinations — zero diverging voxels.
  // colour:false — carveRaw owns vcol (it smears the top colour down each column from `cd`), so carve()'s
  // own colour pass would be a full layers x foot^2 write whose result is discarded.
  const VOL = carve({
    foot, layers,
    box: { ox, oy, bw, bh, z0, Hv },
    // carve.js is DOM-free and takes pixel buffers; these are canvases. Convert here rather than teaching
    // the tested core about canvas, which is the thing that keeps it testable in node.
    slices: { top: asPixels(topC), side: asPixels(sideC), front: asPixels(frontC) },
    cuts: carveCuts,
    colour: false,
  }).VOL;
  T('after CUT', countVol(VOL), `carve.js: ${['top', carveCuts.side ? 'side' : null, carveCuts.front ? 'front' : null].filter(Boolean).join(' + ')}`);
  if (!topG && carveCuts.top) {   // no top slice: footprint falls back to the flat fill drawn into cd
    for (let z = z0; z < z0 + Hv; z++) for (let y = oy; y < oy + bh; y++) for (let x = ox; x < ox + bw; x++) {
      const k = z * N + y * foot + x;
      if (VOL[k] && cd[(y * foot + x) * 4 + 3] <= INK_A) VOL[k] = 0;
    }
  }
  T('after fallback cut', countVol(VOL), 'flat-fill footprint cut (only when there is no top slice)');
  const bodyFilled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers
    && !!VOL[z * N + y * foot + x];
  // procedural barrel: a real round tube along +X, placed relative to the body box, ORed into the volume
  let inBarrel = null;
  if (reach && topC) {
    // THREE FIXES, all measured:
    // 1. LENGTH WAS INERT. bx1 was min(foot-1, ox+bw+reach); autoSpans makes ox=0 and bw=foot, so
    //    ox+bw+reach >= foot for every reach and the min() pinned bx1 at foot-1. The tube was x[22..63]
    //    at barrelLen 1, 8, 24 and 48 alike — the slider was an on/off switch. The tube now ENDS at the
    //    box front and runs BACK by the length, so the slider controls length within the grid.
    // 2. HALF A VOXEL OFF-CENTRE. oy + bh/2 is the extent centre; the footprint's voxel centre is
    //    (bh-1)/2. At bh=64 r=4 the tube covered y[28..36] — nine rows centred on 32, not 31.5.
    // 3. HEIGHT IGNORED z0. bz was Hv-relative but measured from absolute z=0, so a box lifted off the
    //    ground put the barrel axis below it.
    const cy = oy + (bh - 1) / 2, r = Math.max(0.5, state.barrelRad);
    const bx1 = Math.min(foot - 1, ox + bw - 1);                                   // the tip, at the box front
    const bx0 = Math.max(ox, bx1 - Math.max(1, reach) + 1);                        // …running back by Barrel len
    const bz = z0 + clamp(Math.round(state.barrelElev / 100 * (Hv - 1)), 0, Hv - 1);
    inBarrel = (x, y, z) => x >= bx0 && x <= bx1 && (y - cy) * (y - cy) + (z - bz) * (z - bz) <= r * r;
    let R = 0, G = 0, B = 0, c = 0;                                  // barrel tint = darkened mean body colour
    for (let i = 0; i < N; i++) { const p = i * 4; if (cd[p + 3] > INK_A) { R += cd[p]; G += cd[p + 1]; B += cd[p + 2]; c++; } }
    const bt = c ? [R / c * 0.72 | 0, G / c * 0.72 | 0, B / c * 0.72 | 0] : [82, 84, 92];
    for (let x = Math.max(0, bx0); x <= bx1; x++) for (let y = Math.max(0, Math.ceil(cy - r)); y <= Math.min(foot - 1, Math.floor(cy + r)); y++) {
      const p = (y * foot + x) * 4; if (cd[p + 3] <= INK_A) { cd[p] = bt[0]; cd[p + 1] = bt[1]; cd[p + 2] = bt[2]; cd[p + 3] = 255; }
    }
  }
  // OR the barrel INTO VOL. Composing it into `filled` made barrel voxels procedural — on screen but
  // absent from VOL, so VOL[k]=0 could never remove one. Now every visible voxel is a VOL voxel.
  if (inBarrel) for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++)
    if (!VOL[z * N + y * foot + x] && inBarrel(x, y, z)) VOL[z * N + y * foot + x] = 1;
  const filled = bodyFilled;
  const H = new Float32Array(N);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    let h = 0; for (let z = layers - 1; z >= 0; z--) if (filled(x, y, z)) { h = z + 1; break; }
    H[y * foot + x] = h;
  }
  return { VOL, cd, H, filled, views, sp, dbg: { bw, bh, Hv, Hraw: +Hraw.toFixed(1), tw: topC && topC.width, th: topC && topC.height, sw: sideC && sideC.width, sh: sideC && sideC.height, fw: frontC && frontC.width, fh: frontC && frontC.height } };
}

// Unified voxel model for every consumer: always per-voxel colour (vcol), whether the part came from a
// .vox (already per-voxel) or the photo carve (per-column cd, materialised here). So there's ONE model —
// a stack of coloured cubes — and no cd/vcol branching downstream. Returns { vcol, filled, dbg }.
//
// `voxEdit` USED TO LIVE HERE and is GONE (2026-08-07). It was a per-part Map of key → 'del' | [r,g,b]
// that nothing read: buildModel stopped layering it on when VOL became the model, so its geometry half
// was already dead, and its colour half was superseded by setVox writing m.vcol + m.PAINT directly.
// It kept ONE live writer to the very end — the Remap → Bake button — which is why that button reported
// "baked N voxels" and changed nothing at all. There is no store here now; VOL is the geometry, vcol is
// the colour and PAINT says who chose it. If you are tempted to add a fourth, add its reader first.
// GEOMETRY reconciliation state (owner 2026-07-18): per-part placement of the source views on the
// target grid, as three shared world-axis spans. `auto:true` = follow autoSpans (legacy); the geometry
// step flips it to false and stores explicit spanX/spanY/spanZ {lo,hi}. `bottomFrom` = where the −z
// underside derives from. Persisted in the project (version 2). Shared axes = shared span object.
const geomState = { body: { auto: true, bottomFrom: 'top' }, turret: { auto: true, bottomFrom: 'top' } };
// ONE PLACEMENT STORE. geomState[part] is the single source of truth for the box; every reader goes
// through effPlace and every writer through setPlace. The old lastSpans (a global side effect written
// inside buildVolume) and boxPlace (a pending copy only the 3D box read) are gone — they were two extra
// stores that the 2D box, the 3D box and the carve each read differently.
function effPlace(part) {
  const g = geomState[part];
  if (g && !g.auto && g.spanX) return { ox: g.spanX.lo, oy: g.spanY.lo, bw: g.spanX.hi - g.spanX.lo,
    bh: g.spanY.hi - g.spanY.lo, z0: g.spanZ.lo, Hv: g.spanZ.hi - g.spanZ.lo };
  return { ox: 0, oy: 0, bw: footOf(part), bh: footOf(part), z0: 0, Hv: gridLayersOf(part) };
}
// raise ONE axis of the grid so a dragged box fits. z -> Layers, x/y -> Resolution (snapped UP to the
// slider's step-4 ladder, which only ever makes room). Never shrinks.
// LAYERS OWNS HEIGHT. Once the geometry box is dragged, geomState[part] holds an EXPLICIT spanZ and
// auto goes false -- from then on the carve reads that span, not the slider. A turret frozen at 0..8
// stayed 8 voxels tall however far Layers was pushed, and the extra grid was empty air above it.
// Raising Layers now takes the span's ceiling with it unconditionally: an earlier version only did
// so when the span already reached the old ceiling, which is precisely what kept the owner's turret
// pinned at 8. Lowering Layers clamps the span down so it can never point past the grid.
function growSpanZ(part, wasLayers) {
  const g = geomState[part]; if (!g || g.auto || !g.spanZ) return;
  const now = state[part === 'turret' ? 'turretLayers' : 'bodyLayers'];
  const lo = Math.min(g.spanZ.lo, Math.max(0, now - 1));
  g.spanZ = { lo, hi: now };
}
function growAxis(part, axis, want) {
  const isT = part === 'turret';
  if (axis === 'z') {
    const lid = isT ? 'turretLayers' : 'bodyLayers';
    if (want <= state[lid]) return;
    const el = $(lid); if (el && +el.max < want) el.max = String(want);
    state[lid] = want; if (el) { el.value = want; const lv = $(lid + 'V'); if (lv) lv.textContent = String(want); }
  } else {
    const cur = isT ? (state.turretFoot || state.foot) : state.foot;
    const wantF = clamp(Math.ceil(want / 4) * 4, 16, RES_MAX);
    if (wantF <= cur) return;
    if (isT) state.turretFoot = wantF; else state.foot = wantF;
    const el = $(isT ? 'turretRes' : 'res'); if (el) el.value = wantF;
  }
  syncSizeUI();
}
function setPlace(part, p) {
  const foot = footOf(part), layers = gridLayersOf(part);
  const cl = (lo, sz, cap) => { const a = clamp(lo | 0, 0, cap - 1); return { lo: a, hi: clamp(a + Math.max(1, sz | 0), a + 1, cap) }; };
  geomState[part] = { auto: false, bottomFrom: (geomState[part] && geomState[part].bottomFrom) || 'top',
    spanX: cl(p.ox, p.bw, foot), spanY: cl(p.oy, p.bh, foot), spanZ: cl(p.z0 || 0, p.Hv, layers) };
}
// the space-carved model BEFORE manual edits (buildVolume is not cached — callers that only need the
// base, like the live slice editor, cache this and layer edits on cheaply).
// DOES THIS PART'S MODEL CONTAIN HAND WORK? Set by pushVolParts, which runs before EVERY edit (geometry
// and colour alike), and by restoreVol when a saved model comes back off disk. Cleared ONLY by an explicit
// discard — a Carve button, "Reset edits", a new unit. It used to be cleared by recarve(), which ~20
// unrelated controls called, so the flag that protects the artist's work was reset by the very events it
// exists to survive. This is declared HERE, beside carveCache, because buildModelRaw reads it and
// refreshModel() runs at module scope long before the undo block below.
const volDirty = { body: false, turret: false };
// carveCache holds THE MODEL — VOL, vcol and PAINT — which is the artifact that gets saved. The name is
// a leftover from when it really was a cache of the slices; it is kept because ~40 sites read it and
// renaming would bury the change that matters. What changed (FFF-2) is who may empty it: an explicit
// re-carve, or a unit switch. Not a slider, and not a render frame.
const carveCache = { body: null, turret: null };   // { foot, layers, m, sig } — emptied only on the artist's say-so
// THE CARVE'S INPUTS, as a string. NOT a licence to rebuild — buildModelRaw compares against it to know
// the model is STALE relative to its slices, and stale is a thing to REPORT, not to resolve by throwing
// the model away. It must still be complete, because an input missing from here is an input whose change
// goes unreported.
//
// Why not a counter: it would have to be bumped by every writer, which is the same completeness problem
// with an extra place to forget. And it cannot be carveEpoch, which refreshModel() bumps after EVERY edit
// — a model would read as stale against its own slices the moment it was painted.
//
// Deliberately excluded: anything a hand edit changes. VOL, vcol and PAINT are the model, not its inputs.
function carveSig(partId, foot, layers) {
  const xf = (imgXf[partId] || {}), g = geomState[partId] || {}, sp = (a) => (a ? `${a.lo},${a.hi}` : '-');
  let s = `${foot}:${layers}:${carveCuts.top}${carveCuts.side}${carveCuts.front}`;
  s += `|g${g.auto ? 'A' : ''}${sp(g.spanX)}/${sp(g.spanY)}/${sp(g.spanZ)}:${g.bottomFrom || ''}`;
  // NOT the VIEWS const — that is declared at :2974, and refreshModel() runs at module scope well before
  // it, so reaching for it here threw "Cannot access 'VIEWS' before initialization" on load. A literal has
  // no temporal dead zone. If a fifth view is ever added, this list is the one to update with it.
  for (const v of ['top', 'side', 'front', 'back']) {
    const x = xf[v] || {};
    s += `|${v}${imgs[partId] && imgs[partId][v] ? 1 : 0}`
      + `:${x.sx || 1},${x.sy || 1},${x.ox || 0},${x.oy || 0}`
      + `:${(keyTolState[partId] || {})[v]}`
      + `:${((polyState[partId] || {})[v] || []).length}`
      + `:${((pickState[partId] || {})[v] || []).length}`;
  }
  if (partId === 'turret') s += `|b${state.barrelLen},${state.barrelRad},${state.barrelElev}`;
  s += `|v${voxPart[partId] ? voxPart[partId].nz : '-'}`;
  if (partId === 'body' && state.decorProc) s += `|d${state.decorTrunkH},${state.decorTrunkR},${state.decorCanopyR},${state.decorCanopyBase}`;
  return s;
}
// THE ONLY function that writes colour. Every tool goes through it, so 'who changed this voxel's colour'
// has one answer. It writes the model — m.vcol — and marks the voxel PAINTed so the wall-art pass leaves
// it alone. Returns false when there is no model or the voxel is empty; a colour on empty space is a lie.
function setVox(part, k, rgb) {
  const m = carveCache[part] && carveCache[part].m;
  if (!m || !m.vcol || !m.PAINT) return false;
  const V = liveVOL(part);
  if (V && !V[k]) return false;                                   // never colour a voxel that is not there
  m.vcol[k * 3] = rgb[0]; m.vcol[k * 3 + 1] = rgb[1]; m.vcol[k * 3 + 2] = rgb[2];
  m.PAINT[k] = 1;
  return true;
}
// COPY a voxel's colour onto another, INCLUDING whether it was authored. Mirroring must not invent
// authorship: setVox marks PAINT, and PAINT permanently takes a voxel off the wall-art pass in
// buildFaces — so mirroring a hull whose flank detail comes from the side sheet FLATTENED the mirrored
// half to its bare column colour. Bilateral symmetry is the commonest operation on a tank, so that was
// most of the model, every time. Authored stays authored; carve-derived stays derived and keeps its art.
function copyVoxColour(part, k, srcK) {
  const m = carveCache[part] && carveCache[part].m;
  if (!m || !m.vcol) return false;
  const V = liveVOL(part);
  if (V && !V[k]) return false;                                   // same rule as setVox: no colour on empty space
  m.vcol[k * 3] = m.vcol[srcK * 3]; m.vcol[k * 3 + 1] = m.vcol[srcK * 3 + 1]; m.vcol[k * 3 + 2] = m.vcol[srcK * 3 + 2];
  if (m.PAINT) m.PAINT[k] = m.PAINT[srcK];
  return true;
}
// RE-FIT, NOT RE-DERIVE. The grid moved under a model that has hand work in it, so its arrays are the
// wrong LENGTH — but the work in them is not wrong, and re-carving is precisely the thing this refuses to
// do behind the artist's back. Every voxel is copied by its (x, y, z) COORDINATE into arrays of the new
// shape: a grow keeps everything and adds empty space, a shrink drops what no longer fits and says so.
// `views` (the slice sheets projected onto the OLD box) is carried over — pick() bounds-checks, so where
// it still lines up the wall art still paints and where it does not the voxel falls back to vcol. To get
// the box itself re-derived at the new size, press a Carve button; that is the explicit ask.
function refitModel(m, oldFoot, oldLayers, foot, layers) {
  const oN = oldFoot * oldFoot, N = foot * foot;
  const VOL = new Uint8Array(layers * N), vcol = new Uint8Array(layers * N * 3), PAINT = new Uint8Array(layers * N);
  let kept = 0, lost = 0;
  for (let z = 0; z < oldLayers; z++) for (let y = 0; y < oldFoot; y++) for (let x = 0; x < oldFoot; x++) {
    if (!m.filled(x, y, z)) continue;
    if (z >= layers || y >= foot || x >= foot) { lost++; continue; }
    const ok = z * oN + y * oldFoot + x, k = z * N + y * foot + x;
    VOL[k] = 1; kept++;
    if (m.vcol) { vcol[k * 3] = m.vcol[ok * 3]; vcol[k * 3 + 1] = m.vcol[ok * 3 + 1]; vcol[k * 3 + 2] = m.vcol[ok * 3 + 2]; }
    if (m.PAINT) PAINT[k] = m.PAINT[ok];
  }
  if (lost) console.warn(`[stack-forge] grid shrank ${oldFoot}×${oldLayers} → ${foot}×${layers}: ${lost} voxel(s) fell outside it and were dropped (Ctrl+Z, or raise the size back)`);
  else console.info(`[stack-forge] grid ${oldFoot}×${oldLayers} → ${foot}×${layers}: ${kept} hand-edited voxel(s) re-fitted, NOT re-carved`);
  const filled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && !!VOL[z * N + y * foot + x];
  return { ...m, VOL, vcol, PAINT, filled };
}
// THE MODEL IS THE SAVED ARTIFACT, NOT A CACHE OF THE SLICES (FFF-2). Owner: "The model derives from
// slice art. Edits for color and geo go into the model!!" / "The cache is only for undo, and the cache
// does not get saved. The model geo and coloring persist get saved."
//
// This used to read: the signature moved, so throw the model away and carve a new one. Any change to a
// carve INPUT moves the signature, so a Layers drag (per drag-pixel), a Resolution change, a slice nudge,
// a flip, a Geometry-box slider — and, worst, an ORBIT FRAME, via updateGamePreview → bodyExtentTiles →
// buildModel — silently destroyed hand work nobody asked to lose. Six paths, one cause; guarding six call
// sites would have left the seventh.
//
// THE RULE: a carve happens when the USER ASKS (a Carve button, Reset edits, a new unit). carveSig keeps
// its legitimate job — knowing the model is STALE relative to its slices — and that is now SURFACED
// (carveStale, shown in the grid header) instead of silently resolved by destroying the model.
const carveStale = { body: false, turret: false };   // model no longer matches its slices — offer, don't act
function buildModelRaw(partId, foot, layers) {
  const hit = carveCache[partId], sig = carveSig(partId, foot, layers);
  if (hit) {
    if (hit.sig === sig && hit.foot === foot && hit.layers === layers) { carveStale[partId] = false; return hit.m; }
    if (volDirty[partId]) {                            // hand work lives here — the slices do not get to overwrite it
      if (hit.foot !== foot || hit.layers !== layers) {
        hit.m = refitModel(hit.m, hit.foot, hit.layers, foot, layers);
        hit.foot = foot; hit.layers = layers;
      }
      // hit.sig deliberately KEEPS the signature of the carve this model came from, so staleness is
      // re-derived on every call instead of being latched: put the input back where it was and the flag
      // clears itself. (A dims change takes one extra call to settle, because the refit has to run in
      // reverse first — hit.foot/hit.layers move, hit.sig does not.)
      carveStale[partId] = true;
      return hit.m;
    }
  }
  const m = carveRaw(partId, foot, layers);
  carveCache[partId] = { foot, layers, m, sig };
  carveStale[partId] = false;
  return m;
}
// PAINT: one byte per voxel beside VOL and vcol. 1 = the artist chose this colour and it is
// AUTHORITATIVE; 0 = carve-derived, and the slice sheet that depicts that wall may colour it.
//
// WHY IT SURVIVED FFF-2. Its ORIGINAL purpose — letting a re-carve rebuild vcol from the art and then
// re-lay the artist's colour on top — is indeed gone: a re-carve is an explicit "start over from the
// source" now, and starting over means starting over. But it was never only that, and it has three live
// readers today:
//   1. buildFaces — the wall-art override. Without it, wallCol beats vcol unconditionally on every
//      non-top face, so painting a voxel red would suppress its side art and fall back to the flat column
//      colour. This is the load-bearing one, and after FFF-8 it is the ONLY thing between the model's
//      colour and the screen.
//   2. snapshotProject — "is there authored colour worth serialising here", which decides whether vcol
//      goes to disk at all.
//   3. restoreVol — putting it back, so a reloaded unit keeps its authorship.
// Deleting it would take the first with it. It stays, with its meaning restated: PAINT means the model's
// colour wins here, not "re-lay me after the next carve".
function carveRaw(partId, foot, layers) {
  const v = buildVolume(partId, foot, layers), N = foot * foot;
  if (v.vcol) return { vcol: v.vcol, PAINT: new Uint8Array(layers * N), filled: v.filled, cd: null, views: v.views, sp: v.sp, dbg: v.dbg, VOL: v.VOL };  // .vox → already voxels
  const cd = v.cd, filled = v.filled, vcol = new Uint8Array(layers * N * 3);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    const i = y * foot + x, p = i * 4; if (cd[p + 3] <= INK_A) continue;
    const r = cd[p], g = cd[p + 1], b = cd[p + 2];
    for (let z = 0; z < layers; z++) if (filled(x, y, z)) { const c = (z * N + i) * 3; vcol[c] = r; vcol[c + 1] = g; vcol[c + 2] = b; }
  }
  return { vcol, PAINT: new Uint8Array(layers * N), filled, cd: null, views: v.views, sp: v.sp, dbg: v.dbg, VOL: v.VOL };
}
// THE CARVE IS THE MODEL. Nothing is layered on top of it: every edit tool writes VOL / vcol / PAINT in
// place, so buildModel is buildModelRaw. Kept as a name because ~20 call sites read as "the model", and
// collapsing them would churn a lot of unrelated code for no behaviour change.
function buildModel(partId, foot, layers) {
  return buildModelRaw(partId, foot, layers);
}

// median-cut → n representative colours.
// THE ONLY SURVIVOR OF THE OLD REDUCER BLOCK, and it is not a render filter: the .vox FILE FORMAT caps its
// RGBA chunk at 256 entries, so exportVox has to fold a richer model down to fit. It never touches what is
// drawn or what is stored. buildPalette / weightedMedianCut / chromaOf / buildQuantiser all fed the
// draw-time filter and are gone (FFF-8). NOTE: this declaration shadows palette.js's `medianCut` global —
// see the *Core note at the bottom of palette.js; every call into palette.js goes through a *Core alias.
function medianCut(colors, n) {
  if (!colors.length) return [[128, 128, 128]];
  let boxes = [colors.slice()];
  while (boxes.length < n) {
    let bi = -1, best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.length < 2) continue;
      let mn = [255, 255, 255], mx = [0, 0, 0];
      for (const c of b) for (let ch = 0; ch < 3; ch++) { if (c[ch] < mn[ch]) mn[ch] = c[ch]; if (c[ch] > mx[ch]) mx[ch] = c[ch]; }
      const range = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      if (range > best) { best = range; bi = i; }
    }
    if (bi < 0) break;
    const box = boxes[bi]; let mn = [255, 255, 255], mx = [0, 0, 0];
    for (const c of box) for (let ch = 0; ch < 3; ch++) { if (c[ch] < mn[ch]) mn[ch] = c[ch]; if (c[ch] > mx[ch]) mx[ch] = c[ch]; }
    const rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ch = rg[1] > rg[0] ? (rg[2] > rg[1] ? 2 : 1) : (rg[2] > rg[0] ? 2 : 0);
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1; boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((b) => { let r = 0, g = 0, bl = 0; for (const c of b) { r += c[0]; g += c[1]; bl += c[2]; } const m = b.length || 1; return [Math.round(r / m), Math.round(g / m), Math.round(bl / m)]; });
}
// ── CUBE STACK: the unified voxel model reduced to its EXPOSED cube faces — the only thing the renderer
// draws. THE FACE COLOUR IS THE MODEL'S COLOUR. LIGHTING IS NOT baked in — it's applied per-frame from the
// rotated face normal, so the world light stays fixed while the object turns under it.
// n: 0 = top, 1 = +x, 2 = −x, 3 = +y, 4 = −y (grid space, y = image-down).
//
// NO PALETTE FILTER RUNS HERE (FFF-8). This used to build a quantiser from state.paletteN and re-bin EVERY
// voxel on EVERY draw, then push the result through the palMap tuner — so the hex an artist picked was
// replaced between the model and the screen, and the model (which is what ships) never held the colour
// they saw. Palette work is paint now: it writes vcol through setVox and is saved with the model. The
// only thing that still decides a face's colour is whether the voxel is PAINTed (vcol wins) or
// carve-derived (the slice sheet that depicts that wall wins) — see wallCol below.
function buildFaces(partId, foot, layers) {
  const model = buildModel(partId, foot, layers), N = foot * foot;   // unified voxel model
  const { filled, vcol, views: V } = model;
  // The painted flag comes from the MODEL now. It used to be read from voxEdit while the COLOUR was read
  // from vcol — two different stores — so the flag fired and the colour did not: painting a voxel red
  // suppressed its wall art and then fell back to the flat column colour. Measured, in 3D and in the bake.
  // PAINT and vcol MUST come from the same object, or this reintroduces exactly that split.
  const PAINT = model.PAINT || null;
  // wall colour comes from the elevation view that DEPICTS that wall: side view → ±y walls (far side
  // mirrored), front view → +x wall, back view → −x wall (mirrored front when no back was drawn).
  // Top view keeps colouring the tops. Fallback everywhere = the voxel's column colour.
  const pick = (g, ix, z, mirror) => {
    if (!g || ix < 0 || ix >= g.w || z < 0 || z >= g.h) return null;
    const i = z * g.w + (mirror ? g.w - 1 - ix : ix);
    return g.m[i] ? [g.c[i * 3], g.c[i * 3 + 1], g.c[i * 3 + 2]] : null;
  };
  const wallCol = (x, y, z, n) => {
    if (!V) return null;
    const zz = z - (V.z0 || 0);                          // masks are Hv tall from z0; index into them from z0
    // NEITHER ±y face is mirrored, and that is what makes them mirrors of each other.
    // `pick` indexes the sheet by WORLD x, so sampling both flanks with the same ix lays the art along
    // +x on both — nose-at-large-x on each side. The orbit supplies the mirror for free: at az=0 the
    // camera sits at +Y and +x runs screen-right; orbit round to the −y flank and +x runs screen-LEFT,
    // so that flank is seen reversed exactly as a real object would be.
    // Applying g.w−1−ix DOUBLE-mirrors whichever face carries it, which is why setting the flag on n===4
    // made the LEFT flank read backwards and setting it on n===3 flipped the RIGHT one. The flag was
    // never the choice — the mirror belongs to the camera, not the sampler.
    if (n >= 3) return pick(V.side, x - V.ox, zz, false);
    if (n === 2 && V.back) return pick(V.back, y - V.oy, zz, false);
    return pick(V.front, y - V.oy, zz, n === 2);
  };
  const faces = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3;
    const painted = !!(PAINT && PAINT[c / 3]);            // artist colour is authoritative — skip the wall-art pass, keep vcol
    const add = (n) => {
      const w = (n === 0 || painted) ? null : wallCol(x, y, z, n);   // painted → use the voxel colour so in-game matches the grid
      const r = w ? w[0] : vcol[c], g = w ? w[1] : vcol[c + 1], b = w ? w[2] : vcol[c + 2];
      faces.push({ x, y, z, n, r, g, b, k: (r << 16) | (g << 8) | b, d: 0 });
    };
    if (!filled(x, y, z + 1)) add(0);
    if (!filled(x + 1, y, z)) add(1);
    if (!filled(x - 1, y, z)) add(2);
    if (!filled(x, y + 1, z)) add(3);
    if (!filled(x, y - 1, z)) add(4);
  }
  return { faces, foot, layers };
}

// ── THE renderer: parts drawn as REAL 3D cubes under an orthographic orbit camera (azimuth + elevation).
// Back-face cull → painter's sort (far→near along the view ray) → each face painted as a projected quad.
// Tops stay flat neutral; walls catch the world-fixed directional light via their ROTATED normal — this is
// what turns the model from layers of 2D into a solid object. Orbit view, in-game inset and the bake all
// draw through here, so the preview IS the shipped pixels.
// part: { faces, az, gx?, gy?, zOff?, pivotFrac? } — gx/gy = ground-plane offset, zOff in layers.
//
// `env` (optional) supplies { zScale, lightAz, lightK } for a model that is NOT the one in the editor —
// a card thumbnail draws another unit's saved project, and that project has its own voxel height and
// light. Reading those off `state` would either render it wrong or force a caller to mutate `state` and
// put it back, and a half-restored `state` is exactly how the live view gets corrupted. Omit it and
// nothing changes: every existing caller draws the live model at the live settings.
function renderParts(ctx, S, cx, groundY, el, parts, env) {
  const E = env || state;
  const eR = el * Math.PI / 180, se = Math.sin(eR), ce = Math.cos(eR), h = E.zScale;
  const la = E.lightAz * Math.PI / 180, Lx = Math.cos(la), Ly = -Math.sin(la);
  const k = clamp(E.lightK / 100, 0, 1), WALL = 0.52, RANGE = 0.46;
  for (const P of parts) {
    const F = P.faces; if (!F) continue;
    const ca = Math.cos(P.az), sa = Math.sin(P.az);
    const cx0 = F.foot * (P.pivotFrac == null ? 0.5 : P.pivotFrac), cy0 = F.foot / 2;
    const gx = P.gx || 0, gy = P.gy || 0, z0 = P.zOff || 0;
    const shadeOf = (nx, ny) => clamp(WALL + k * RANGE * ((nx * ca - ny * sa) * Lx + (nx * sa + ny * ca) * Ly), 0.3, 1);
    const shades = [1, shadeOf(1, 0), shadeOf(-1, 0), shadeOf(0, 1), shadeOf(0, -1)];
    const camDot = [se, sa, -sa, ca, -ca];                     // rotated normal · view dir, per face kind
    const vis = [];
    for (const f of F.faces) {
      if (camDot[f.n] <= 0.02) continue;                       // back-face cull (edge-on ≈ zero area anyway)
      f.d = ((f.x + 0.5 - cx0) * sa + (f.y + 0.5 - cy0) * ca + gy) * ce + (z0 + f.z + 0.5) * h * se;
      vis.push(f);
    }
    vis.sort((a, b) => a.d - b.d);                             // painter: far → near
    const PX = (X, Y) => cx + S * (X * ca - Y * sa + gx);
    const PY = (X, Y, Z) => groundY + S * ((X * sa + Y * ca + gy) * se - (z0 + Z) * h * ce);
    for (const f of vis) {
      const s = shades[f.n];
      const col = 'rgb(' + ((f.r * s) | 0) + ',' + ((f.g * s) | 0) + ',' + ((f.b * s) | 0) + ')';
      ctx.fillStyle = col; ctx.strokeStyle = col;              // stroke seals AA hairlines between quads
      const x0 = f.x - cx0, y0 = f.y - cy0, z = f.z;
      ctx.beginPath();
      if (f.n === 0) { const Z = z + 1;                        // top face
        ctx.moveTo(PX(x0, y0), PY(x0, y0, Z)); ctx.lineTo(PX(x0 + 1, y0), PY(x0 + 1, y0, Z));
        ctx.lineTo(PX(x0 + 1, y0 + 1), PY(x0 + 1, y0 + 1, Z)); ctx.lineTo(PX(x0, y0 + 1), PY(x0, y0 + 1, Z));
      } else if (f.n < 3) { const X = f.n === 1 ? x0 + 1 : x0; // ±x wall
        ctx.moveTo(PX(X, y0), PY(X, y0, z)); ctx.lineTo(PX(X, y0 + 1), PY(X, y0 + 1, z));
        ctx.lineTo(PX(X, y0 + 1), PY(X, y0 + 1, z + 1)); ctx.lineTo(PX(X, y0), PY(X, y0, z + 1));
      } else { const Y = f.n === 3 ? y0 + 1 : y0;              // ±y wall
        ctx.moveTo(PX(x0, Y), PY(x0, Y, z)); ctx.lineTo(PX(x0 + 1, Y), PY(x0 + 1, Y, z));
        ctx.lineTo(PX(x0 + 1, Y), PY(x0 + 1, Y, z + 1)); ctx.lineTo(PX(x0, Y), PY(x0, Y, z + 1));
      }
      ctx.closePath(); ctx.fill();
      if (P.sel && P.sel.has(f.z * F.foot * F.foot + f.y * F.foot + f.x)) {   // outline GRID-VIEW-selected voxels in cyan
        ctx.strokeStyle = '#5fe0ff'; ctx.lineWidth = 1.75; ctx.stroke(); ctx.lineWidth = 0.75;
      } else ctx.stroke();
    }
  }
}

// Build the voxel set for the CURRENT marquee rect in the current facing/slice (Layer 0 = whole column
// through depth = "select the objects"). Called on commit to freeze the selection into voxels so it can
// then persist across facing switches.
// ── THE SHARED SELECTION ─────────────────────────────────────────────────────────────────────────
// ONE set of voxel keys that EVERY view shows. The grid draws it projected along whatever facing is on
// screen; the 3D view outlines it in cyan. That is what makes "select from the top, then trim it back
// from the side" work — there is one selection, not one per view, so there is nothing to reconcile.
let selEpoch = 0;                                         // bumped on every change so the 3D view redraws
// A selection is only meaningful at the dims it was made at: its keys are ABSOLUTE (z*foot² + y*foot + x),
// so the same key addresses a different voxel the moment foot or layers changes. The dims are stamped here
// and checked by selCheckDims below — the same guard restoreVol already applies to a saved volume
// (:2042, "discarded rather than mis-indexed"), which the selection never got.
function selEnsure(part) {
  const foot = footOf(part), layers = gridLayersOf(part);
  if (!gridSelVox || gridSelVox.part !== part) gridSelVox = { part, foot, layers, set: new Set() };
  return gridSelVox;
}
// Called once per grid build, so every one of the ~15 `gridSelVox.part !== g.part` checks downstream stays
// correct WITHOUT being touched: a stale selection is gone before any of them run. Clearing rather than
// remapping is deliberate — a remap across a resize has no well-defined answer (voxels the new grid has no
// room for would have to be dropped silently), and losing a selection is cheap next to scattering deletes
// through unrelated voxels, which is what happened before this existed.
function selCheckDims(part, foot, layers) {
  if (!gridSelVox) return;
  if (gridSelVox.foot === undefined) { gridSelVox.foot = foot; gridSelVox.layers = layers; return; }  // pre-stamp selection
  if (gridSelVox.foot !== foot || gridSelVox.layers !== layers) {
    console.info(`[stack-forge] selection cleared — it was made at ${gridSelVox.foot}×${gridSelVox.layers}, the grid is now ${foot}×${layers}`);
    gridSelVox = null; gridSel = null; gridSelView = null; selEpoch++;
  }
}
const rectBounds = (g, c0, r0, c1, r1) => ({
  a0: Math.max(0, Math.min(c0, c1)), a1: Math.min(g.cols - 1, Math.max(c0, c1)),
  b0: Math.max(0, Math.min(r0, r1)), b1: Math.min(g.rows - 1, Math.max(r0, r1)),
});
// The voxels a grid rect covers. Layer 0 = the whole depth COLUMN, so a top-view band grabs the solid
// object and you can then carve it back from another facing; layer i = that one slice. Only FILLED
// voxels are ever selected — a selection names geometry, never empty space.
function rectVox(g, c0, r0, c1, r1) {
  const foot = g.foot, N = foot * foot, out = [], { a0, a1, b0, b1 } = rectBounds(g, c0, r0, c1, r1);
  for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) {
    if (g.slice === 0) {
      for (let s = 0; s < g.depth; s++) { const [x, y, z] = g.toVox(cx, cy, s); if (gridFilledAt(g, x, y, z)) out.push(z * N + y * foot + x); }
    } else { const [x, y, z] = g.toVox(cx, cy, g.slice - 1); if (gridFilledAt(g, x, y, z)) out.push(z * N + y * foot + x); }
  }
  return out;
}
function selAddRect(g, r) {
  const sel = selEnsure(g.part); let n = 0;
  for (const k of rectVox(g, r.c0, r.r0, r.c1, r.r1)) { if (!sel.set.has(k)) n++; sel.set.add(k); }
  selEpoch++; return n;
}
// CTRL band: trim the SELECTION only. It never touches VOL — unselected carve voxels are not its business.
function selTrimRect(g, r) {
  if (!gridSelVox || gridSelVox.part !== g.part) return 0;
  const foot = g.foot, N = foot * foot, S = gridSelVox.set, { a0, a1, b0, b1 } = rectBounds(g, r.c0, r.r0, r.c1, r.r1);
  let n = 0;
  const drop = (x, y, z) => { if (S.delete(z * N + y * foot + x)) n++; };
  for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) {
    if (g.slice === 0) { for (let s = 0; s < g.depth; s++) { const v = g.toVox(cx, cy, s); drop(v[0], v[1], v[2]); } }
    else { const v = g.toVox(cx, cy, g.slice - 1); drop(v[0], v[1], v[2]); }
  }
  selEpoch++; return n;
}
function buildSelVox(surfaceOnly) {
  if (!gridSel || !gridGeom) return null;
  const g = gridGeom, foot = g.foot, N = foot * foot, set = new Set();
  if (surfaceOnly) {                                      // "Select layer" stays on the visible surface — else a
    const { a0, a1, b0, b1 } = rectBounds(g, gridSel.c0, gridSel.r0, gridSel.c1, gridSel.r1);   // full-rect Layer-0
    for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) {                       // pick on Top would
      const [x, y, z] = gridTargetVox(g, cx, cy);                                               // grab the whole model
      if (gridFilledAt(g, x, y, z)) set.add(z * N + y * foot + x);
    }
  } else for (const k of rectVox(g, gridSel.c0, gridSel.r0, gridSel.c1, gridSel.r1)) set.add(k);
  selEpoch++;
  return { part: g.part, foot: g.foot, layers: g.layers, set };   // dims stamped — see selCheckDims
}
// The PERSISTENT selection as voxels (survives facing/layer switches), keyed for the 3D outline + masking.
function gridSelSet() { return gridSelVox; }
// Can this grid be selected in? Only needs a real facing (a cell↔voxel map) — NOT `editable`, which is off
// in Geometry mode for the slice adjusters. Selecting mutates nothing, so no edit gate applies to it.
function selectableGrid() { const g = gridGeom; return !!(g && g.toVox && g.cols > 0 && g.rows > 0 && g.depth > 0); }
// What this cell shows of the selection in the CURRENT facing: 2 = the voxel this layer addresses is
// selected, 1 = something DEEPER in this column is. Tier 1 is the whole point — it is how a selection
// made in the top view stays visible from the side, where you trim it.
function selCellState(g, cx, cy) {
  if (!gridSelVox || !g || gridSelVox.part !== g.part || !gridSelVox.set.size) return 0;
  const foot = g.foot, N = foot * foot, S = gridSelVox.set;
  const t = gridTargetVox(g, cx, cy);
  if (S.has(t[2] * N + t[1] * foot + t[0])) return 2;
  for (let s = 0; s < g.depth; s++) { const [x, y, z] = g.toVox(cx, cy, s); if (S.has(z * N + y * foot + x)) return 1; }
  return 0;
}
// assemble the current unit (body + mounted turret, honouring the part filter) and render it into a canvas
//
// `opts.card` = render the UNIT and nothing else: both parts regardless of the part filter, and none of
// the editor's overlays (the cyan selection outline, the FRONT/BACK/LEFT/RIGHT orientation tags, the
// dimension box). The card image is an artifact written to the repo and looked at later, so a selection
// the artist happened to have live, or a part filter they happened to be on, must not be baked into it.
// Same scene assembly either way — mount height, ride height, turret pivot — so a card cannot drift from
// what the orbit shows. Pass a target from mkTarget(), never voxMeta: this must not draw on the canvas
// the live view is showing.
function drawScene(meta, el, bodyAz, turretAz, opts) {
  const card = !!(opts && opts.card);
  const ctx = meta.ctx; ctx.clearRect(0, 0, meta.W, meta.Hp);
  const mountDz = mountZOf(state.bodyLayers);
  // Drop the whole unit so its LOWEST FILLED VOXEL sits on the ground line. The turret moves with the
  // body by the same amount, or lowering the hull would leave the turret hanging where it was.
  const floorZ = bodyFloorZ;
  const sel = card ? null : gridSelSet();
  const parts = [];
  if (card || state.part !== 'turret') parts.push({ faces: bodyFaces, az: bodyAz, zOff: -floorZ, sel: sel && sel.part === 'body' ? sel.set : null });
  if (card || state.part !== 'body') parts.push({ faces: turretFaces, az: turretAz, zOff: mountDz - floorZ,
    gx: state.turretDx * Math.cos(bodyAz), gy: state.turretDx * Math.sin(bodyAz),
    pivotFrac: 0.5 + state.turretPivot / 100, sel: sel && sel.part === 'turret' ? sel.set : null });
  renderParts(ctx, meta.S, meta.cx, meta.groundY, el, parts);
  if (card) return;
  // ORIENTATION MARKERS IN THE MAIN VIEW (owner 2026-08-05: "we have a matrix of conditions — turret,
  // base, left, right"). The grid view already labels its edges from its own toVox map; the orbit had
  // nothing, so which flank you are looking at was inferred rather than read. Projects the four world
  // extremities through the SAME transform renderParts uses, so it cannot drift from what was drawn.
  // World: x=+FRONT/−BACK, y=−LEFT(0)/+RIGHT(foot−1), z=UP. Shares the Grid View ⊹ toggle.
  if (gridOrient) {
    const eR = el * Math.PI / 180, se = Math.sin(eR), ce = Math.cos(eR), h = state.zScale;
    const foot = state.foot, layers = state.bodyLayers, S = meta.S;
    const ca = Math.cos(bodyAz), sa = Math.sin(bodyAz), cx0 = foot / 2, cy0 = foot / 2;
    const PX = (X, Y) => meta.cx + S * ((X - cx0) * ca - (Y - cy0) * sa);
    const PY = (X, Y, Z) => meta.groundY + S * (((X - cx0) * sa + (Y - cy0) * ca) * se - Z * h * ce);
    const zc = layers / 2, m = foot * 0.72;                        // push the tags clear of the silhouette
    const marks = [['FRONT', foot / 2 + m, foot / 2, '#f2c869'], ['BACK', foot / 2 - m, foot / 2, '#7f9bb3'],
                   ['LEFT',  foot / 2, foot / 2 - m, '#5fe0ff'],   ['RIGHT', foot / 2, foot / 2 + m, '#ff8fb0']];
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [lab, X, Y, col] of marks) {
      const px = PX(X, Y), py = PY(X, Y, zc);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,11,18,.9)'; ctx.strokeText(lab, px, py);
      ctx.fillStyle = col; ctx.fillText(lab, px, py);
    }
  }
  if (state.showDimBox) drawDimBox(ctx, meta, el, bodyAz, state.part === 'turret' ? 'turret' : 'body');
}

// ── DIMENSION BOX (SF1): a 3D box sized to the unit (foot×foot×layers, zScale-stretched) drawn through
// the SAME orthographic transform as renderParts, so it tracks orbit. Per-cell gridlines (faint per
// voxel, bold per tile = VOX_PER_TILE) + a face label on every visible side, and each loaded view image
// projected onto its matching face (top, side mirrored, front, back — the carve's own convention). ──
function drawDimBox(ctx, meta, el, az, part) {
  const foot = footOf(part), layers = (part === 'turret' ? state.turretLayers : state.bodyLayers);
  if (!foot || !layers) return;
  const S = meta.S, cx = meta.cx, groundY = meta.groundY;
  const eR = el * Math.PI / 180, se = Math.sin(eR), ce = Math.cos(eR), h = state.zScale;
  const ca = Math.cos(az), sa = Math.sin(az);
  const cx0 = foot / 2, cy0 = foot / 2;
  const PX = (X, Y) => cx + S * (X * ca - Y * sa);
  const PY = (X, Y, Z) => groundY + S * ((X * sa + Y * ca) * se - Z * h * ce);
  const P = (X, Y, Z) => ({ x: PX(X - cx0, Y - cy0), y: PY(X - cx0, Y - cy0, Z) });   // world voxel coords → screen
  const raw = imgs[part] || {}, xfp = imgXf[part] || {};
  const view = { top: xfCanvas(raw.top, xfp.top), side: xfCanvas(raw.side, xfp.side), front: xfCanvas(raw.front, xfp.front), back: xfCanvas(raw.back, xfp.back) };   // per-side alignment

  // affine image map: image rect → the face parallelogram (o = img(0,0), u = img(w,0), v = img(0,h))
  const projImg = (img, o, u, v) => {
    if (!img) return; const w = img.width || img.naturalWidth, hi = img.height || img.naturalHeight; if (!w || !hi) return;
    ctx.save(); ctx.globalAlpha = 0.82;
    ctx.imageSmoothingEnabled = false;   // alpha is BINARY in the carve; bilinear here invents in-between edges the carve never sees
    ctx.setTransform((u.x - o.x) / w, (u.y - o.y) / w, (v.x - o.x) / hi, (v.y - o.y) / hi, o.x, o.y);
    ctx.drawImage(img, 0, 0, w, hi);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
  };
  // per-cell gridlines across a face defined by corner A and full edges to B (u) and C (v), nu×nv cells
  const faceGrid = (A, B, C, nu, nv) => {
    const line = (p0, p1, tile) => { ctx.strokeStyle = tile ? 'rgba(120,205,255,0.55)' : 'rgba(120,205,255,0.13)'; ctx.lineWidth = tile ? 1.3 : 0.5; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); };
    for (let i = 0; i <= nu; i++) { const t = i / nu, p0 = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }; line(p0, { x: p0.x + (C.x - A.x), y: p0.y + (C.y - A.y) }, i % VOX_PER_TILE === 0); }
    for (let j = 0; j <= nv; j++) { const t = j / nv, p0 = { x: A.x + (C.x - A.x) * t, y: A.y + (C.y - A.y) * t }; line(p0, { x: p0.x + (B.x - A.x), y: p0.y + (B.y - A.y) }, j % VOX_PER_TILE === 0); }
  };
  const label = (A, B, C, txt) => { const m = { x: (A.x + B.x + C.x + (B.x + C.x - A.x)) / 4, y: (A.y + B.y + C.y + (B.y + C.y - A.y)) / 4 }; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(200,235,255,0.9)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(txt, m.x, m.y); ctx.restore(); };

  // which walls face the camera (same convention as renderParts camDot = [se, sa, -sa, ca, -ca])
  const showFront = sa > 0.02, showBack = sa < -0.02, showPlusY = ca > 0.02, showMinusY = ca < -0.02;

  // The box IS the UNIT's bounding box — its length/width/height are the unit's real dimensions
  // (the placement), NOT the full voxel grid. So the height reads in proportion to the length, images
  // FILL the box faces, and the gridlines are the unit's own cells. SF2 sliders resize this box.
  const pl = effPlace(part);
  const x0 = pl.ox, x1 = pl.ox + pl.bw, y0 = pl.oy, y1 = pl.oy + pl.bh, zb = pl.z0, zt = pl.z0 + pl.Hv;
  const nL = pl.bw, nW = pl.bh, nH = pl.Hv, tl = (v) => (v / VOX_PER_TILE).toFixed(2);
  // FACES (image projected onto the FULL face, then gridlines + label). Corner order = (A origin, B=A+u, C=A+v).
  // TOP (Z=zt): img x→X (length), y→Y (width)
  { const A = P(x0, y0, zt), B = P(x1, y0, zt), C = P(x0, y1, zt); projImg(view.top, A, B, C); faceGrid(A, B, C, nL, nW); label(A, B, C, 'TOP  L' + tl(nL) + '×W' + tl(nW) + ' t'); }
  // +X FRONT: img x→Y (width), y→down(Z height)
  if (showFront) { const A = P(x1, y0, zt), B = P(x1, y1, zt), C = P(x1, y0, zb); projImg(view.front, A, B, C); faceGrid(A, B, C, nW, nH); label(A, B, C, 'FRONT  H' + tl(nH) + ' t'); }
  // −X BACK (mirrored)
  if (showBack) { const A = P(x0, y1, zt), B = P(x0, y0, zt), C = P(x0, y1, zb); projImg(view.back, A, B, C); faceGrid(A, B, C, nW, nH); label(A, B, C, 'BACK'); }
  // SIDE = the visible ±Y wall. Both walls put the unit's FRONT at the +X (x1) end, so they read as
  // natural mirror images when you orbit around (owner: the left side was reversed vs top/front — it
  // must mirror the right). img x→X (length, back→front = x0→x1), y→down(Z height).
  if (showPlusY) { const A = P(x0, y1, zt), B = P(x1, y1, zt), C = P(x0, y1, zb); projImg(view.side, A, B, C); faceGrid(A, B, C, nL, nH); label(A, B, C, 'SIDE  L' + tl(nL) + '×H' + tl(nH) + ' t'); }
  else if (showMinusY) { const A = P(x0, y0, zt), B = P(x1, y0, zt), C = P(x0, y0, zb); projImg(view.side, A, B, C); faceGrid(A, B, C, nL, nH); label(A, B, C, 'SIDE  L' + tl(nL) + '×H' + tl(nH) + ' t'); }

  // wireframe = the unit's bounding box (placement)
  const c = [P(x0, y0, zb), P(x1, y0, zb), P(x1, y1, zb), P(x0, y1, zb), P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)];
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  ctx.strokeStyle = 'rgba(95,224,255,0.9)'; ctx.lineWidth = 1.6;
  for (const [a, b] of E) { ctx.beginPath(); ctx.moveTo(c[a].x, c[a].y); ctx.lineTo(c[b].x, c[b].y); ctx.stroke(); }
  ctx.lineWidth = 0.75;
}

// ── bake: per-angle cache with 2× supersample + CAS-lite unsharp (ported from the prototype) ──
// (the CAS-lite unsharp pass is gone — it blurred the frame in order to sharpen it)
function bakeAngleCache(renderer, faces, opts) {
  const { frames, g, pivotFrac = 0.5, el, scale = 1 } = opts, SS = 1, STEP = (Math.PI * 2) / frames;   // SS=1: no supersample AA
  const W = g.RTW * scale, H = g.RTH * scale;                      // scale = baked px per voxel (crispness)
  const cv = document.createElement('canvas'); cv.width = W * SS; cv.height = H * SS;
  const ctx = cv.getContext('2d'); ctx.lineWidth = 0.75 * SS; ctx.lineJoin = 'round';
  const tex = PIXI.Texture.from(cv); tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const spr = new PIXI.Sprite(tex); spr.scale.set(1 / SS);
  const cache = [];
  for (let a = 0; a < frames; a++) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    renderParts(ctx, scale * SS, g.CX * scale * SS, g.BASEY * scale * SS, el, [{ faces, az: a * STEP, pivotFrac }]);   // true 3D frame
    tex.baseTexture.update();
    const rt = PIXI.RenderTexture.create({ width: W, height: H });
    rt.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    renderer.render(spr, { renderTexture: rt });
    cache.push(rt);
  }
  spr.destroy(); tex.destroy(true);
  return cache;
}
const bucketOf = (a, n) => (((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n);

// ── SHADOW BAKE (Shading epic S1): a REAL cast-shadow shape, not the old top-sprite-sheared hack.
// Every FILLED voxel drops its footprint to the ground plane, sheared away from the world-fixed sun by
// its height; the union of dark quads is the true silhouette the volume would throw. Baked per angle
// into an atlas parallel to the frame atlas, so the runtime just picks a frame (no runtime distortion).
// Sun is screen-fixed lower-right (matches src/render/sun.js — top-left sun, azimuth 135°).
const SHADOW_EL = 55;                                   // shadow light elevation (°): steeper = shorter
const SHADOW_DIRX = Math.SQRT1_2, SHADOW_DIRY = Math.SQRT1_2;   // screen lower-right unit vector
// per-voxel-height screen shear (px), given px-per-voxel S and voxel height zScale
const shadowGain = (S) => S * state.zScale / Math.tan(SHADOW_EL * Math.PI / 180);

function renderShadowVolume(ctx, S, cx, groundY, el, foot, layers, filled, az, pivotFrac) {
  const se = Math.sin(el * Math.PI / 180), ca = Math.cos(az), sa = Math.sin(az);
  const cx0 = foot * (pivotFrac == null ? 0.5 : pivotFrac), cy0 = foot / 2, gain = shadowGain(S);
  ctx.fillStyle = '#000';
  for (let z = 0; z < layers; z++) {
    const dx = gain * z * SHADOW_DIRX, dy = gain * z * SHADOW_DIRY;     // height shear, screen px
    for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!filled(x, y, z)) continue;
      const P = (X, Y) => {                                             // footprint corner → ground, sheared
        const rx = (X - cx0) * ca - (Y - cy0) * sa, ry = (X - cx0) * sa + (Y - cy0) * ca;
        return [cx + S * rx + dx, groundY + S * ry * se + dy];
      };
      const a = P(x, y), b = P(x + 1, y), c = P(x + 1, y + 1), d = P(x, y + 1);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    }
  }
}

// Mirror of bakeAngleCache for the shadow: per-angle ground silhouette RTs, same geom so shadowFrames
// align 1:1 with the body/turret frames (same pivot) — the runtime draws them at the unit's anchor.
function bakeShadowCache(renderer, filled, opts) {
  const { frames, g, pivotFrac = 0.5, el, scale = 1, foot, layers } = opts, STEP = (Math.PI * 2) / frames;
  const W = g.RTW * scale, H = g.RTH * scale;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = PIXI.Texture.from(cv); tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const spr = new PIXI.Sprite(tex);
  const cache = [];
  for (let a = 0; a < frames; a++) {
    ctx.clearRect(0, 0, W, H);
    renderShadowVolume(ctx, scale, g.CX * scale, g.BASEY * scale, el, foot, layers, filled, a * STEP, pivotFrac);
    tex.baseTexture.update();
    const rt = PIXI.RenderTexture.create({ width: W, height: H });
    rt.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    renderer.render(spr, { renderTexture: rt });
    cache.push(rt);
  }
  spr.destroy(); tex.destroy(true);
  return cache;
}

// ── app + state ──
const app = new PIXI.Application({ backgroundColor: 0x0a121c, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true, resizeTo: $('stage') });
$('stage').appendChild(app.view);
const rig = new PIXI.Container(); rig.scale.set(WORLD_SCALE); app.stage.addChild(rig);
const grid = new PIXI.Graphics(); grid.lineStyle(1, 0x1d3040, 1);
for (let g = -120; g <= 120; g += 20) { grid.moveTo(g, -80).lineTo(g, 80); grid.moveTo(-120, g * 0.66).lineTo(120, g * 0.66); }
grid.position.set(0, 40); rig.addChild(grid);
// keep the big orbit view centred as the stage resizes (fills the whole stage area now)
let SCW = 720, SCH = 560, MODEL_CX = 470;
let rigPan = { x: 0, y: 0 };                        // user PAN of the main view (middle/shift-drag) — move it aside for the Grid View
function rigX() { return MODEL_CX + rigPan.x; }
function rigY() { return SCH * 0.56 + rigPan.y; }
function layout() {
  SCW = app.screen.width; SCH = app.screen.height;
  MODEL_CX = Math.min(SCW / 2 + 120, SCW - 160);   // shift right so the floating orbit panel doesn't cover the model
  rig.position.set(rigX(), rigY());
  if (typeof placeGamePreview === 'function') placeGamePreview();
  drawLight();
}
app.renderer.on('resize', layout);

// light-source indicator — a sun on a ring at the light azimuth, in SCREEN space (on top of the
// model), showing where the game-aligned light comes from. Elevation shrinks the ring (more overhead).
const lightGfx = new PIXI.Graphics(); app.stage.addChild(lightGfx);
function drawLight() {
  const cx = rigX(), cy = SCH * 0.44 + rigPan.y, R = 150 + (1 - 0.6) * 90;   // ~overhead-ish ring, centred on the model
  const la = state.lightAz * Math.PI / 180, sx = cx + Math.cos(la) * R, sy = cy - Math.sin(la) * R;   // y-up
  const g = lightGfx; g.clear();
  g.lineStyle(1, 0x2a4055, 0.5); g.drawCircle(cx, cy, R);                       // faint compass ring
  g.lineStyle(4, 0xf2c869, 0.22);                                              // beam toward the model
  g.moveTo(sx, sy).lineTo(cx + Math.cos(la) * 90, cy - Math.sin(la) * 90);
  g.lineStyle(0);
  g.beginFill(0xf2c869, 0.13); g.drawCircle(sx, sy, 24); g.endFill();          // glow
  g.beginFill(0xffe4a0, 0.96); g.drawCircle(sx, sy, 10); g.endFill();          // sun
  g.lineStyle(2, 0xffe4a0, 0.85);                                             // rays
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.moveTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 13).lineTo(sx + Math.cos(a) * 19, sy + Math.sin(a) * 19); }
}

// ── SCALE CHART (below Orbit + camera): side views of the current model + saved units on ONE shared
// px-per-tile ruler, in two faction rows (A vs B) for cross-faction comparison. World contract:
// VOX_PER_TILE voxels = 1 tile — bigger unit means more voxels, never a bigger stretch. ──
const chartCache = {};                        // unit id → { key, body, turret, ready } atlas images
const prefixOf = (id) => (id.indexOf('-') > 0 ? id.slice(0, id.indexOf('-')) : id);
function chartImgsFor(id, entry) {
  const key = ((entry.atlases && entry.atlases.body) || '').length;
  let rec = chartCache[id];
  if (rec && rec.key === key) return rec.ready ? rec : null;
  rec = chartCache[id] = { key, ready: false };
  let n = 0; const done = () => { if (++n >= 2) { rec.ready = true; renderScaleChart(); } };
  rec.body = new Image(); rec.body.onload = done; rec.body.onerror = done; rec.body.src = entry.atlases.body;
  rec.turret = new Image(); rec.turret.onload = done; rec.turret.onerror = done; rec.turret.src = entry.atlases.turret;
  return null;
}
function entryThumbH(e, T) {
  if (e.current) {
    const S = T / VOX_PER_TILE;
    return Math.max(14, Math.ceil((state.bodyLayers + state.turretLayers + 2) * state.zScale * S + state.foot * S * 0.5) + 6);
  }
  const p = e.entry.pack, B = p.renderScale || 1, sc = (T / VOX_PER_TILE) / B;
  const bp = (p.parts || []).find((q) => q.id === 'body');
  return bp ? Math.max(14, Math.ceil(bp.cell[1] * sc) + 4) : 20;
}
// LEFT-ALIGNED side view: the unit's nose-to-tail length starts at xLeft and runs right over the grid
function drawPackThumb(ctx, entry, xLeft, groundY, T) {
  const rec = chartImgsFor(entry.pack.id, entry); if (!rec) return;
  const p = entry.pack, B = p.renderScale || 1, sc = (T / VOX_PER_TILE) / B, footB = p.footprint[0] * B;
  const bp = (p.parts || []).find((q) => q.id === 'body'), tp = (p.parts || []).find((q) => q.id === 'turret');
  const draw = (img, part, ox, oy) => {
    if (!img || !part) return;
    ctx.drawImage(img, 0, 0, part.cell[0], part.cell[1],
      xLeft - (part.pivot[0] - footB / 2) * sc + ox, groundY - part.pivot[1] * sc + oy,
      part.cell[0] * sc, part.cell[1] * sc);
  };
  draw(rec.body, bp, 0, 0);                                        // frame 0 = facing +x → a side-on look
  if (tp) { const m = tp.mount || [0, 0, 0];
    draw(rec.turret, tp, m[0] * B * sc, -(m[2] || 0) * (p.layerSpacing || 0) * B * sc); }
}
function drawCurrentThumb(ctx, xLeft, groundY, T) {
  if (!bodyFaces) return;
  const S = T / VOX_PER_TILE, foot = state.foot, h = state.zScale;
  const W2 = Math.max(4, Math.ceil(foot * S) + 6);
  const H2 = Math.max(4, Math.ceil((state.bodyLayers + state.turretLayers + 2) * h * S + foot * S * 0.5) + 4);
  const tc = document.createElement('canvas'); tc.width = W2; tc.height = H2;
  const tctx = tc.getContext('2d'); tctx.lineWidth = 0.4; tctx.lineJoin = 'round';
  const mountDz = mountZOf(state.bodyLayers);
  const parts = [{ faces: bodyFaces, az: 0 }];
  if (turretFaces) parts.push({ faces: turretFaces, az: 0, zOff: mountDz, gx: state.turretDx, gy: 0, pivotFrac: 0.5 + state.turretPivot / 100 });
  renderParts(tctx, S, W2 / 2, H2 - 2, state.el, parts);
  ctx.drawImage(tc, xLeft - (W2 - foot * S) / 2, groundY - H2 + 2);
}
function syncChartSelects(prefixes) {
  const mk = (sel) => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">—</option>' + prefixes.map((p) => `<option>${p}</option>`).join('');
    if (cur && prefixes.includes(cur)) sel.value = cur;
  };
  mk($('chartA')); mk($('chartB'));
  if (!$('chartA').value && prefixes.length) {
    const want = prefixOf(($('uid').value || '').trim());
    $('chartA').value = prefixes.includes(want) ? want : prefixes[0];
  }
}
function renderScaleChart() {
  const cv = $('scaleChart'); if (!cv) return;
  const tiles = unitTiles(state.foot);
  $('resTiles').textContent = '= ' + (+tiles.toFixed(2)) + ' tile' + (tiles === 1 ? '' : 's');
  syncSizeUI();                                        // keep the Unit-size slider honest after loads/res changes
  const units = (loadManifest().units) || {};
  const prefixes = [...new Set(Object.keys(units).map(prefixOf))].sort();
  syncChartSelects(prefixes);
  const rowsSel = [$('chartA').value, $('chartB').value];
  const sections = [];
  for (let r = 0; r < 2; r++) {
    const list = [];
    if (r === 0) list.push({ id: '▶ current', tiles, current: true });   // the model on the stage leads
    if (rowsSel[r]) for (const id of Object.keys(units)) if (prefixOf(id) === rowsSel[r]) {
      const p = units[id].pack;
      list.push({ id, tiles: (p.scale && p.scale.tiles) || p.footprint[0] / VOX_PER_TILE, entry: units[id] });
    }
    if (list.length) sections.push({ label: rowsSel[r] || 'CURRENT', list });
  }
  const W = cv.width;
  if (!sections.length) { cv.getContext('2d').clearRect(0, 0, W, cv.height); return; }
  // STACKED layout: one unit per line, side views left-aligned at X0 running RIGHT over the tile grid
  const X0 = 46;
  let maxTiles = 1;
  for (const s of sections) for (const e of s.list) if (e.tiles > maxTiles) maxTiles = e.tiles;
  const T = Math.min(18, (W - X0 - 8) / maxTiles);                   // ONE px-per-tile for everything (~30% smaller per unit → ~9 fit)
  let total = 16;                                                    // top ruler strip
  for (const s of sections) { total += 12; for (const e of s.list) total += entryThumbH(e, T) + 13; }
  cv.height = Math.max(140, total);                                  // grow the canvas; the dock scrolls
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, cv.height);
  ctx.font = '8px sans-serif'; ctx.textBaseline = 'top';
  // vertical tile grid + tile numbers along the top
  for (let i = 0, gx = X0; gx <= W - 2; gx += T, i++) {
    ctx.fillStyle = i % 1 === 0 ? 'rgba(60,86,112,.30)' : 'rgba(60,86,112,.18)';
    ctx.fillRect(gx, 12, 1, cv.height - 12);
    ctx.fillStyle = '#5a7188'; ctx.fillText(String(i), gx - (i > 9 ? 4 : 2), 2);
  }
  let y = 16;
  for (const s of sections) {
    ctx.fillStyle = '#f2c869'; ctx.fillText(s.label, 2, y); y += 12;
    for (const e of s.list) {
      const th = entryThumbH(e, T), groundY = y + th;
      ctx.strokeStyle = '#24384a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X0 - 3, groundY + 0.5); ctx.lineTo(W - 2, groundY + 0.5); ctx.stroke();
      if (e.current) drawCurrentThumb(ctx, X0, groundY, T);
      else drawPackThumb(ctx, e.entry, X0, groundY, T);
      ctx.fillStyle = e.current ? '#f2c869' : '#8fa7bd';
      ctx.fillText(e.id.replace(/^[A-Za-z]+-/, '').slice(0, 8), 2, groundY - 16);
      ctx.fillStyle = '#5a7188';
      ctx.fillText((+e.tiles.toFixed(2)) + 't', 2, groundY - 7);
      y = groundY + 13;
    }
  }
}
$('chartA').onchange = renderScaleChart;
$('chartB').onchange = renderScaleChart;

// ── IN-GAME preview (bottom-right inset): the unit standing on a board tile at GAME scale + shadow,
// slowly turning to show its facings — so you can judge how it reads on the board, not just in orbit.
// Game facts (from src/render): 64px tile, ground greens 0x33502c/0x3c5c33/0x45683a, black grid @0.12,
// unit ≈ 2 tiles wide, flat ellipse shadow 0x000000 @0.26 (radii tile·r·0.62 × tile·r·0.31).
const BASE_PVW = 214, BASE_TILE = 54;                  // base inset size / preview px-per-tile (64 shrunk to fit)
let PVW = 214, PVH = 210, GAME_TILE = BASE_TILE;       // resizable inset — tile px scales with the width
const gameLayer = new PIXI.Container(); app.stage.addChild(gameLayer);
const gPanel = new PIXI.Graphics(); gameLayer.addChild(gPanel);
const gWorld = new PIXI.Container(); gameLayer.addChild(gWorld);         // masked board + shadow + unit
const gBoard = new PIXI.Graphics(); gWorld.addChild(gBoard);
const gShadow = new PIXI.Graphics(); gWorld.addChild(gShadow);
const gUnit = new PIXI.Container(); gWorld.addChild(gUnit);
const gCollision = new PIXI.Graphics(); gWorld.addChild(gCollision);   // collision footprint ring, over the unit
const gClip = new PIXI.Graphics(); gameLayer.addChild(gClip); gWorld.mask = gClip;
const gTitle = new PIXI.Text('IN-GAME  ·  1 tile = 64px', { fontFamily: 'Segoe UI, sans-serif', fontSize: 10, fill: 0xb9c8d6, letterSpacing: 1.4 });
gameLayer.addChild(gTitle);                                             // caption along the bottom, clear of the unit
// inset controls: ⟳ pause/run the turntable · ⌖ snap to the orbit camera's azimuth · corner grip resizes
const gBtnSpin = new PIXI.Text('⟳', { fontFamily: 'Segoe UI, sans-serif', fontSize: 15, fill: 0x7fd4c2 });
const gBtnSnap = new PIXI.Text('⌖', { fontFamily: 'Segoe UI, sans-serif', fontSize: 15, fill: 0xb9c8d6 });
const gFrame = new PIXI.Graphics();                                     // crisp outline + resize grip, above the board
gameLayer.addChild(gBtnSpin); gameLayer.addChild(gBtnSnap); gameLayer.addChild(gFrame);
let gSpin = true, gDragPrev = null, gResize = null;
function setGSpin(v) { gSpin = v; gBtnSpin.style.fill = v ? 0x7fd4c2 : 0x54657a; }
let gBodyBaked = null, gTurretBaked = null, gAnchor = { x: PVW / 2, y: PVH * 0.6 };
function drawGameBoard() {
  gPanel.clear(); gPanel.beginFill(0x0e1216, 1); gPanel.drawRoundedRect(0, 0, PVW, PVH, 10); gPanel.endFill();
  gClip.clear(); gClip.beginFill(0xffffff); gClip.drawRoundedRect(0, 0, PVW, PVH, 10); gClip.endFill();
  // tile the whole panel, aligned so a tile centres exactly on the unit's anchor point
  const T = GAME_TILE, ax = PVW / 2, ay = PVH * 0.62, bands = [0x33502c, 0x3c5c33, 0x45683a];
  const x0 = ax - T / 2 - Math.ceil((ax - T / 2) / T) * T, y0 = ay - T / 2 - Math.ceil((ay - T / 2) / T) * T;
  gBoard.clear();
  let ry = 0;
  for (let y = y0; y < PVH; y += T, ry++) { let cx = 0;
    for (let x = x0; x < PVW; x += T, cx++) { gBoard.beginFill(bands[(cx * 7 + ry * 3) % 3]); gBoard.drawRect(x, y, T, T); gBoard.endFill(); } }
  gBoard.lineStyle(1, 0x000000, 0.12);
  for (let x = x0; x < PVW + T; x += T) gBoard.moveTo(x, y0).lineTo(x, PVH + T);
  for (let y = y0; y < PVH + T; y += T) gBoard.moveTo(x0, y).lineTo(PVW + T, y);
  gAnchor = { x: ax, y: ay };                                           // ground-contact point (a tile centre)
  gTitle.position.set(11, PVH - 16);
  gBtnSpin.position.set(PVW - 24, 4); gBtnSnap.position.set(PVW - 46, 4);
  gFrame.clear(); gFrame.lineStyle(1, 0x24384a, 1); gFrame.drawRoundedRect(0, 0, PVW, PVH, 10);
  gFrame.lineStyle(2, 0x3c5670, 0.9);
  for (let i = 0; i < 3; i++) gFrame.moveTo(2, PVH - 5 - i * 5).lineTo(5 + i * 5, PVH - 2);
}
function placeGamePreview() { gameLayer.position.set(SCW - PVW - 16, 16); }
function resizePreview(w, h) {
  PVW = clamp(w, 150, 1100) | 0; PVH = clamp(h, 140, 900) | 0;   // raised ceiling: drag the in-game inset much larger
  GAME_TILE = BASE_TILE * PVW / BASE_PVW;
  drawGameBoard(); placeGamePreview();
}
drawGameBoard();

const imgs = { body: { top: null, side: null, front: null, back: null }, turret: { top: null, side: null, front: null, back: null } };
// SF2 per-side ALIGNMENT: independent scale (sx,sy) + offset (ox,oy as fraction of the image) per view,
// so a reference that doesn't match the box can be stretched/nudged to fit. Applied to the box projection
// AND the carve (buildVolume) so Generate reflects the alignment.
const mkXf = () => ({ top: { sx: 1, sy: 1, ox: 0, oy: 0 }, side: { sx: 1, sy: 1, ox: 0, oy: 0 }, front: { sx: 1, sy: 1, ox: 0, oy: 0 }, back: { sx: 1, sy: 1, ox: 0, oy: 0 } });
const imgXf = { body: mkXf(), turret: mkXf() };
function xfCanvas(im, xf) {
  if (!im || !xf || (xf.sx === 1 && xf.sy === 1 && xf.ox === 0 && xf.oy === 0)) return im;
  const w = im.width || im.naturalWidth, h = im.height || im.naturalHeight; if (!w || !h) return im;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  // willReadFrequently HERE, not at the read site: asPixels/sliceMask read this canvas back on every carve,
  // and a later getContext('2d', {...}) returns the context that already exists and silently ignores the flag.
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;                                   // alpha stays binary when a slice is nudged
  g.translate(w / 2 + (xf.ox || 0) * w, h / 2 + (xf.oy || 0) * h); g.scale(xf.sx || 1, xf.sy || 1); g.drawImage(im, -w / 2, -h / 2);
  return c;
}
// per-slot flip: keep the raw source + H/V flags so flips compose from the original (no quality drift)
const mkViews = (v) => ({ top: v(), side: v(), front: v(), back: v() });
const srcImg = { body: mkViews(() => null), turret: mkViews(() => null) };
const flipState = { body: mkViews(() => ({ h: false, v: false })), turret: mkViews(() => ({ h: false, v: false })) };
const rotState = { body: mkViews(() => 0), turret: mkViews(() => 0) };        // per-image rotation (0/90/180/270 CW)
const keyTolState = { body: mkViews(() => 75), turret: mkViews(() => 75) };   // per-image cutout sensitivity
const polyState = { body: mkViews(() => null), turret: mkViews(() => null) }; // per-image polygon cutout ([x,y] px)
const pickState = { body: mkViews(() => []), turret: mkViews(() => []) };     // per-image eyedropper "touch to remove" colours: [{col:[r,g,b], pt:[x,y]}]
const imgURLCache = { body: mkViews(() => null), turret: mkViews(() => null) }; // PNG data-URL cache (project saves)
const voxB64 = { body: null, turret: null };                                  // base64 cache of imported .vox data
// NO PER-UNIT PALETTE STATE LIVES HERE ANY MORE (FFF-8). palMap (the colour tuner), palKeep / palDrop
// (the reducer's pins) and state.paletteN were four stores that existed only to steer a draw-time filter,
// and resetPalette() existed only to stop one unit's filter bleeding into the next. A palette is applied
// as paint now — it is IN vcol, it travels with the model, and a unit switch carries it because the model
// carries it. There is nothing left to clear.
// THE PAINT COLOUR, in one place. Brush, Fill, Add-extrude and the palette window all read this; it used
// to be parsed from the hex input inline at four call sites, one of which had already drifted.
function paintRGB() {
  const h = ($('gridPaintCol') && $('gridPaintCol').value) || '#8fa7bd';
  return [parseInt(h.slice(1, 3), 16) || 0, parseInt(h.slice(3, 5), 16) || 0, parseInt(h.slice(5, 7), 16) || 0];
}
// …and the one place that SETS it, so the big swatch button beside it always shows the truth.
function setPaintRGB(rgb) {
  const el = $('gridPaintCol'); if (!el) return;
  el.value = hexOf(rgb);
  syncPaintSwatch();
}
function syncPaintSwatch() {
  const sw = $('paintSwatch'); if (!sw) return;
  const hex = ($('gridPaintCol') && $('gridPaintCol').value) || '#8fa7bd';
  sw.style.background = hex;
  sw.title = `Paint colour ${hex} — click to open the picker`;
  const lab = $('paintSwatchHex'); if (lab) lab.textContent = hex.toUpperCase();
}
let bulkLoad = false;                                                         // true while restoring a project
let loadingUnit = false;                                                      // true from selectUnit() until its async load resolves — blocks autosave clobbering the new slot
// the STABLE key the WIP autosaves under — set only by an explicit load/save/new, NOT by the free-text
// Unit-id box. This keeps a stray edit to that box from misfiling the unit you're actually editing.
let activeUnitId = 'unit';
// DECOR set: when set to a decor id, the editor is working on a DECOR (Terrain set), NOT a unit — WIP
// autosaves under a separate `decor:` IndexedDB namespace so authoring decor can never collide with or
// overwrite a unit (the Tree-1 wipe). Cleared whenever a unit is loaded.
let editingDecor = null;
function flipCanvas(im, h, v) {
  const w = im.width, hh = im.height, c = document.createElement('canvas'); c.width = w; c.height = hh;
  const g = c.getContext('2d'); g.translate(h ? w : 0, v ? hh : 0); g.scale(h ? -1 : 1, v ? -1 : 1); g.drawImage(im, 0, 0); return c;
}
function rotCanvas(im, rot) {                                                 // rot ∈ {90,180,270}, clockwise
  const sw = im.width, sh = im.height, c = document.createElement('canvas');
  c.width = (rot % 180) ? sh : sw; c.height = (rot % 180) ? sw : sh;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180); g.drawImage(im, -sw / 2, -sh / 2);
  return c;
}
// Turret mount height. The ceiling used to be the BODY's layer count, so once the turret sat on the
// body's top (bodyMountZ) the slider had only bodyLayers−bodyMountZ of travel left and went dead —
// with the usual 16-layer body topping out at 8, the "hard cap at 8" the owner hit. A turret is allowed
// to sit ABOVE the hull (mast, pedestal), so the ceiling is now body+turret layers, which is exactly
// what voxBounds.HT already sizes the baked canvas for — so nothing can be raised out of frame.
function mountZOf(bodyLayers) { return clamp(bodyMountZ + state.mountZ, 0, bodyLayers + state.turretLayers); }
// The tilt the SPRITES bake at. Module scope on purpose: units and decor both bake, and a const local
// to doBake left bakeDecor throwing ReferenceError on every call.
const bakeElOf = () => (state.bakeEl == null ? state.el : state.bakeEl);
const state = { foot: 64, bodyLayers: 16, turretLayers: 12, az: 0, el: 30, bakeEl: 45, taim: 0, turretDx: 0, turretPivot: 0, mountZ: 0, spin: false, part: 'both',
  barrelLen: 0, barrelRad: 4, barrelElev: 55, lightAz: 135, lightK: 55, zScale: 1.8, zoom: WORLD_SCALE, bakeScale: 2, cls: 'ground', baseY: 24, baked: null,
  decorScale: 1, decorProc: false, decorTrunkH: 30, decorTrunkR: 3, decorCanopy: 'cone', decorCanopyR: 14, decorCanopyBase: 30,   // decor on-map scale + procedural-tree params (Stories 6,7)
  showDimBox: false,   // SF1: the 3D dimension box + per-face view-image projections overlay
  turretFoot: 64 };    // SF3: turret footprint (voxels), INDEPENDENT of base foot — a turret can be smaller than the hull
// ── SINGLE-SOURCE GRID INVARIANT (owner 2026-07-30) ─────────────────────────────────────────────────────
// The recurring "clamp / chop / geometry-vs-paint mismatch" had ONE root cause: the carve grid (foot×foot×
// layers) and the geometry spans were two independently-mutated states, and geomSpans reconciled a conflict
// by SILENTLY clamping the spans to the grid (dropping voxels). Fix it structurally: the EFFECTIVE grid is a
// DERIVED value = max(requested resolution, committed geometry extent), computed HERE — the one accessor every
// consumer reads. So `grid ⊇ geometry` holds BY CONSTRUCTION; no mutator (res / Cube / import / load / drag)
// can make the carve clamp. The only residual clamp is the hard 128-voxel ceiling, which updateDims flags red.
// SF3: the footprint (voxels) for a part — turret has its own; body uses the base foot. Never smaller than the geometry.
const footOf = (part) => (part === 'turret' ? (state.turretFoot || state.foot) : state.foot);   // the grid IS the box — nothing derives it
let bodyFaces = null, turretFaces = null, bodyBaked = null, turretBaked = null, lastPack = null;
let voxMeta = null, voxTex = null, voxSpr = null, voxShadow = null, voxSig = '';   // orbit cube-render canvas
let gVoxMeta = null, gVoxTex = null, gVoxSpr = null, gVoxShadow = null;            // in-game inset canvas
const shadowLean = () => -Math.cos(state.lightAz * Math.PI / 180) * 0.6;   // shear away from the sun
let voxBounds = { R: 64, HT: 40 };                                     // current model bounds (set by rebuild)
const INSET_S = 3;                                                     // inset render px/voxel (scaled to game size)

// a cube-render target: canvas + placement metadata at S px per voxel
function mkTarget(S, R, HT) {
  const W = 2 * R * S, Hp = (2 * R + HT) * S;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hp;
  const ctx = cv.getContext('2d'); ctx.lineWidth = 0.75; ctx.lineJoin = 'round';
  return { cv, ctx, S, cx: W / 2, groundY: Hp - R * S, W, Hp };
}
const orbitS = () => clamp(Math.ceil(state.zoom), 2, 8);   // render density tracks the zoom → crisp up close
function buildOrbitTarget(S) {
  if (voxSpr) { voxSpr.destroy(); voxShadow.destroy(); voxTex.destroy(true); }
  voxMeta = mkTarget(S, voxBounds.R, voxBounds.HT);
  voxTex = PIXI.Texture.from(voxMeta.cv);
  // NEAREST, like every other texture in this tool. PIXI defaults to LINEAR, and this one was never set —
  // which is why the 3D model read soft while the slice beside it stayed crisp. The sprite is drawn at
  // supersample density S and displayed at scale 1/S (see orbitS), so a LINEAR minify bilinearly blended
  // every voxel edge on the way down. It also explains why the blur EASED WHEN ZOOMED IN: orbitS tracks
  // the zoom, so a higher S left more detail to survive the blend — the filter was always the cause, the
  // zoom only masked it.
  voxTex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  // silhouette shadow: the model's own render (un-flipped — high camera), squashed + sheared off the sun
  const la0 = state.lightAz * Math.PI / 180;
  voxShadow = new PIXI.Sprite(voxTex);
  voxShadow.anchor.set(0.5, voxMeta.groundY / voxMeta.Hp);
  voxShadow.position.set(-Math.cos(la0) * state.foot * 0.30, state.baseY + Math.sin(la0) * state.foot * 0.20 + 1);
  voxShadow.tint = 0x000000; voxShadow.alpha = 0.22;
  voxShadow.scale.set(1 / S, 0.55 / S); voxShadow.skew.x = shadowLean();
  rig.addChild(voxShadow);
  voxSpr = new PIXI.Sprite(voxTex); voxSpr.scale.set(1 / S);
  voxSpr.anchor.set(0.5, voxMeta.groundY / voxMeta.Hp); voxSpr.position.set(0, state.baseY);
  rig.addChild(voxSpr); voxSig = '';
}
const voxPart = { body: null, turret: null };   // imported MagicaVoxel models (override the photo carve per part)
let bodyMountZ = 9;                              // layer just above the body's top → where the turret sits
let bodyFloorZ = 0;                              // lowest FILLED layer — the unit's ride height, measured not assumed

// highest filled layer of the BODY (+1) → the layer the turret should sit ON, not inside
function bodyTopLayer(foot, layers) {
  // buildModel, NOT buildVolume. Calling buildVolume direct bypassed carveCache, so every refreshModel
  // ran a FULL keyed-image carve of the body whose only surviving output is one integer — and worse, a
  // fresh buildVolume has its own VOL, so hand edits were invisible here: shaving the top off the hull
  // did not lower bodyMountZ and the turret kept mounting at the pre-edit height.
  const { filled } = buildModel('body', foot, layers);
  for (let z = layers - 1; z >= 0; z--) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (filled(x, y, z)) return z + 1;
  return 0;
}
// RIDE HEIGHT IS THE LOWEST FILLED VOXEL, not grid z=0. renderParts puts Z=0 on the ground line, so a
// carve that leaves empty layers under the hull — which happens whenever the side/front art does not
// reach the bottom of the box — renders the unit FLOATING by exactly that many layers. Measured here and
// applied as a render offset, so the model's own footprint decides where it sits.
function partFloorZ(partId, foot, layers) {
  const m = buildModel(partId, foot, layers);
  if (!m || !m.filled) return 0;
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (m.filled(x, y, z)) return z;
  return 0;                                                  // empty model — nothing to sit on the ground
}

// (re)build the voxel models + the cube-render canvases — the orbit/camera-set preview and the inset
// ── Orthographic grid view (upper-left): a flat, square-voxel view of one face. Top walks z-slices
// top→bottom (the slice view); Side/Front/Back are silhouettes. Voxels are always square (true cubes),
// independent of the zScale cube-height stretch used by the 3D render.
let gridView = 'top', gridLayer = 0, gridModel = null;   // gridModel: cached buildModel, invalidated by recarve
let gridZoom = 1, gridPanX = 0, gridPanY = 0;            // scroll-wheel zoom of the grid editor (cursor-anchored)
// THE FOUR PAINT TOOLS, plus the two geometry ones. Opens on ▢ Select, because every other tool reads
// better once you have chosen what you are working on — and Select is the only one that cannot damage
// anything. It used to open on 🗑 Delete.
let gridTool = 'box', gridGeom = null;                   // gridGeom: last-drawn cell layout, so pointer edits map back to voxels
// live ✥ Move drag: { part, dc, dr } in grid cells. Draw-only — the model is written once, on release.
let moveGhost = null;
let gridMode = 'paint';                                  // 'paint' = per-voxel slice editing · 'geom' = reconcile view spans
let gridAlign = false;                                   // ⊞ Align T/S: carved TOP projection stacked above SIDE, length-aligned (read-only, Pass 1)
let gridBoxSel = null;                                    // transient marquee being dragged {c0,r0,c1,r1} in grid cells
let selBoxing = null;                                     // SHIFT (add, cyan) / CTRL (trim, red) selection band being dragged
let gridAddBox = null;                                    // ➕ Add: transient rubber-band that extrudes the surface patch on release
let gridLasso = null, lassoMode = false;                 // Story 5: ◇ Angle lasso — freeform outline (cell points) for the visual-hull carve
let gridSel = null;                                       // last marquee rect (in gridSelView's facing) — for the dashed outline in that one view
let gridSelView = null;                                   // which gridView the gridSel rect belongs to
let gridSelVox = null;                                    // PERSISTENT selection { part, set:<voxel keys> } — survives facing/layer switches, so a Layer-0 object selection can be painted on every face without reselecting
let gridGuides = true;                                    // centre point + H/V centre lines (alignment/symmetry guide)
let gridOrient = true;                                    // orientation indicator: label each grid edge with the world direction it faces
// geometry box axis mapping: for each grid view, which world-axis span each in-plane axis (col,row) reads
// and whether the grid coord is reversed vs the axis value. cap: x/y=foot, z=layers. Used by both the
// geom overlay draw and the drag editing so they stay in lock-step.
const GEOAX = {
  top:   { col: { axis: 'x', flip: false }, row: { axis: 'y', flip: false } },
  side:  { col: { axis: 'x', flip: false }, row: { axis: 'z', flip: true } },
  // MUST match AX.toVox: front maps col -> (foot-1-c) [reversed], back maps col -> c [not]. These two were
  // swapped, so the Geometry box for front/back was drawn at the opposite end of the grid from its voxels.
  front: { col: { axis: 'y', flip: false }, row: { axis: 'z', flip: true } },   // matches AX.front: elevation art is left-on-left
  back:  { col: { axis: 'y', flip: false }, row: { axis: 'z', flip: true } },
};
const spanKey = { x: 'spanX', y: 'spanY', z: 'spanZ' };
const gridPart = () => (state.part === 'turret' ? 'turret' : 'body');
const gridLayersOf = (part) => (part === 'turret' ? state.turretLayers : state.bodyLayers);
// LAYER 0 = raycast "surface": the target voxel at a grid cell is the FIRST filled voxel along the view's
// depth axis (what a ray straight into the model would hit), so painting Layer 0 recolours the FACING
// surface and it shows in the 3D view. Deeper layers address their exact depth slice as before.
// ONE `filled`, sourced from VOL — the same model `layerKeys`/`deleteSelection` cut. It used to consult
// voxEdit first, so the tool AIMED with the overlay and CUT with VOL: any stale 'del' made a click pass
// through a visible voxel and hit the one behind it.
function gridFilledAt(g, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= g.foot || y >= g.foot || z >= g.layers) return false;
  return !!(gridModel && gridModel.filled && gridModel.filled(x, y, z));
}
function gridTargetVox(g, cx, cy) {
  if (g.slice === 0) {                                        // LAYER 0 = the non-layer SURFACE projection
    for (let s = 0; s < g.depth; s++) { const v = g.toVox(cx, cy, s); if (gridFilledAt(g, v[0], v[1], v[2])) return v; }
    return g.toVox(cx, cy, 0);                                // empty column → near surface (paint adds; erase no-ops)
  }
  return g.toVox(cx, cy, g.slice - 1);                        // layers 1..depth address real slices 0..depth-1
}
// THE MODEL'S PALETTE, DERIVED FROM THE MODEL (owner: "Models palette should be derived from model").
// Every distinct colour vcol actually holds on a filled voxel, most-used first. This is the inline paint
// strip, and it is also what Re-project snaps to — so both now name colours the model can be proved to
// contain, instead of colours a draw-time reducer was about to invent.
//
// TWO THINGS IT NO LONGER DOES. (1) It folded in state.paletteN / palMap, so it competed with the
// quantiser it was trying to describe. Both are gone. (2) It folded in the WALL sheets (side/front/back
// source art), which are NOT the model — they are the slices. Colours that only live in the slice art are
// still reachable, from the Palette window, which builds the FULL palette from exactly those slices
// (slicePaletteEntries). Model palette from the model; full palette from the slices.
// The 512 cap is a safety valve for a full-colour photo carve, not a reduction — it never changes a voxel.
function modelPalette(m, foot, layers) {
  const N = foot * foot, counts = new Map();
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!m.filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3, k = (m.vcol[c] << 16) | (m.vcol[c + 1] << 8) | m.vcol[c + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 512)
    .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
}
// x/y/z DIMENSION readout — the model's carved voxel bounding box vs the grid it lives in, so clamping is
// visible: an axis whose model extent hits the grid edge AND whose intended span (geomState) runs past the
// grid is flagged CLAMPED in red. Shown in the grid header + over the primary view. (owner request)
function modelBBox(filled, foot, layers) {
  let x0 = foot, x1 = -1, y0 = foot, y1 = -1, z0 = layers, z1 = -1;
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (filled(x, y, z)) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return { x0, x1, y0, y1, z0, z1 };
}
function updateDims(part, foot, layers, base) {
  const gd = $('gridDims'), sd = $('stageDims'); if (!gd && !sd) return;
  const bb = base.bbox || modelBBox(base.filled, foot, layers), { x0, x1, y0, y1, z0, z1 } = bb;
  if (x1 < 0) { if (gd) gd.textContent = 'empty'; if (sd) sd.textContent = ''; return; }
  const Lx = x1 - x0 + 1, Wy = y1 - y0 + 1, Hz = z1 - z0 + 1;
  const g = geomState[part];                                          // intended spans (explicit) — used to detect a clamp
  const want = (g && !g.auto && g.spanX) ? { x: g.spanX.hi, y: g.spanY.hi, z: g.spanZ.hi } : null;
  // clamped if the model reaches the grid edge on an axis AND the intended span wanted more than the grid holds
  const clX = x1 >= foot - 1 && (want ? want.x > foot : false);
  const clY = y1 >= foot - 1 && (want ? want.y > foot : false);
  const clZ = z1 >= layers - 1 && (want ? want.z > layers : false);
  const T = VOX_PER_TILE, tl = (v) => (v / T).toFixed(2);
  const ax = (lab, n, cl) => cl ? `⚠${lab}${n}` : `${lab}${n}`;
  const txt = `${part}  ${ax('X', Lx, clX)} × ${ax('Y', Wy, clY)} × ${ax('Z', Hz, clZ)} vox  (${tl(Lx)}×${tl(Wy)}×${tl(Hz)} t)  ·  grid ${foot}×${foot}×${layers}`;
  const anyCl = clX || clY || clZ;
  if (gd) { gd.textContent = txt + (anyCl ? '  — CLAMPED' : ''); gd.style.color = anyCl ? '#e0625f' : '#8fa7bd'; }
  if (sd) { sd.textContent = txt + (anyCl ? '  — CLAMPED, raise Resolution' : ''); sd.style.color = anyCl ? '#e0625f' : '#8fa7bd'; sd.style.borderColor = anyCl ? '#e0625f' : 'var(--line)'; }
}
// ── THE OFFER (FFF-2) ─────────────────────────────────────────────────────────────────────────────
// carveSig's legitimate job is knowing the model is STALE relative to its slices. Its ILLEGITIMATE job —
// the one that cost six paths' worth of hand work — was resolving that by silently re-carving. So it is
// surfaced here instead: the artist is TOLD, and decides. "Keep" is not a no-op UI nicety either — it
// dismisses the row for the signature that raised it, so an input the artist has already answered for
// does not nag on every redraw.
let carveStaleAck = { body: null, turret: null };
function renderCarveStale(part) {
  const row = $('carveStaleRow'); if (!row) return;
  const sig = carveCache[part] ? carveSig(part, footOf(part), gridLayersOf(part)) : null;
  const show = !!carveStale[part] && carveStaleAck[part] !== sig;
  row.hidden = !show;
  if (!show) return;
  const msg = $('carveStaleMsg');
  if (msg) msg.textContent = `The ${part}'s source slices have changed since it was carved. Its hand edits are kept — nothing has been re-carved.`;
  const go = $('carveStaleGo');
  if (go) go.onclick = () => { recarveFromSource(part); refreshModel(); renderGridView(); scheduleAutosave(); };
  const keep = $('carveStaleKeep');
  if (keep) keep.onclick = () => { carveStaleAck[part] = sig; row.hidden = true; };
}
function renderGridView() {
  const cv = $('gridCanvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const part = gridPart(), foot = footOf(part), layers = gridLayersOf(part), N = foot * foot;
  selCheckDims(part, foot, layers);   // drop a selection whose absolute keys no longer address this grid
  // cache the carve; the edit tools write it in place, so live painting never re-carves.
  if (!gridModel || gridModel.part !== part || gridModel.foot !== foot || gridModel.layers !== layers) {
    const m = buildModelRaw(part, foot, layers);
    gridModel = { part, foot, layers, vcol: m.vcol, filled: m.filled, views: m.views, sp: m.sp, palette: modelPalette(m, foot, layers), bbox: modelBBox(m.filled, foot, layers) };
  }
  // NO palSig BRANCH. It existed to refresh the strip when the draw-time reducer/tuner moved; both are
  // gone, and every write to the model already nulls gridModel (refreshModel), so the strip is rebuilt
  // from the model whenever the model changes and at no other time.
  const base = gridModel, V = base.views;
  updateDims(part, foot, layers, base);   // x/y/z readout in the grid header + primary view; flags clamped axes
  renderCarveStale(part);                 // FFF-2: "these slices no longer match this model" — an offer, never an act
  // ONE MODEL: base.filled is the carve, read directly.
  // When the overlay was disabled in buildModel, this copy was missed, so the GRID hid voxels that the 3D
  // view still drew: stale 'del' entries blanked geometry here and nowhere else. Read the carve, only.
  const filled = (x, y, z) => (x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers)
    && base.filled(x, y, z);
  // FACE COLOUR: sample the SAME source the 3D render paints for the face this view shows — Top faces
  // from the top-down colour, Side/Front/Back walls from the side/front/back source art — so once
  // quant+tuner run below the grid matches in-game (buildFaces), not a flat top-projection. Painted
  // voxels carry their own colour.
  const pickWall = (g, ix, z, mirror) => {
    if (!g || !g.m || ix < 0 || ix >= g.w || z < 0 || z >= g.h) return null;
    const i = z * g.w + (mirror ? g.w - 1 - ix : ix);
    return g.m[i] ? [g.c[i * 3], g.c[i * 3 + 1], g.c[i * 3 + 2]] : null;
  };
  const rawCol = (x, y, z) => {
    // colour comes from the model; the overlay it used to consult is no longer written
    if (V) {
      let w = null; const zz = z - (V.z0 || 0);                                     // masks are Hv tall from z0
      if (gridView === 'side') w = pickWall(V.side, x - V.ox, zz, false);           // ±y wall ← side art
      else if (gridView === 'front') w = pickWall(V.front, y - V.oy, zz, false);    // +x wall ← front art
      else if (gridView === 'back') w = V.back ? pickWall(V.back, y - V.oy, zz, false) : pickWall(V.front, y - V.oy, zz, true); // -x wall ← back (or mirrored front)
      if (w) return w;
    }
    const c = (z * N + y * foot + x) * 3; return [base.vcol[c], base.vcol[c + 1], base.vcol[c + 2]];   // Top faces / fallback
  };
  // Every view is a SLICE perpendicular to a depth axis; the Layer slider walks slices along it, so
  // add/erase editing works in all four. Top→z (from the top), Side→y, Front/Back→x. toVox maps an
  // in-plane cell (col,row) + slice index to a voxel (x,y,z).
  const AX = {
    top:   { cols: foot, rows: foot,   depth: layers, axis: 'z', toVox: (c, r, s) => [c, r, layers - 1 - s] },
    side:  { cols: foot, rows: layers, depth: foot,   axis: 'y', toVox: (c, r, s) => [c, s, layers - 1 - r] },
    front: { cols: foot, rows: layers, depth: foot,   axis: 'x', toVox: (c, r, s) => [foot - 1 - s, c, layers - 1 - r] },  // +x FRONT: raycast from +x, col→y DIRECT — the Front slot holds a third-angle elevation drawn left-on-left, so image col 0 is the model's LEFT (y=0), matching the carve's (y - oy) index
    back:  { cols: foot, rows: layers, depth: foot,   axis: 'x', toVox: (c, r, s) => [s, c, layers - 1 - r] },                        // −x BACK: raycast from x=0, opposite-side col→y
    // ¾ ANGLE (decor): a DIAGONAL slice along the (1,1) camera ray. col → the in-plane diagonal h = x−y
    // (constant along a ray), CENTRED so the facing is foot-wide like Front/Side (matches the same-size source
    // art); depth s walks from the +x+y CORNER inward, so the first hit is the surface the camera sees.
    angle: { cols: foot, rows: layers, depth: foot, axis: 'diag', toVox: (c, r, s) => { const h = c - (foot >> 1), xs = Math.min(foot - 1, foot - 1 + h), x = xs - s; return [x, x - h, layers - 1 - r]; } },
  };
  const ax = AX[gridView] || AX.top, cols = ax.cols, rows = ax.rows, depth = ax.depth;
  gridLayer = clamp(gridLayer, 0, depth);   // 0 = surface projection (non-layer); 1..depth = real slices 0..depth-1
  const slice = gridLayer;
  const geomMode = gridMode === 'geom';
  const lr = $('gridLayerRow'); if (lr) lr.style.display = '';    // layer slider useful in both modes
  // Both control rows show in BOTH modes (owner: 'replicate the bottom controls onto both geometry and
  // paint'). The modes differ only in what is DRAWN and what the POINTER does — Geometry draws the slice
  // overlays and its handles take the drag; Paint hides them and the pointer edits voxels.
  const tr = $('gridToolRow'); if (tr) tr.style.display = '';
  if ($('gridAngleBtn')) $('gridAngleBtn').style.display = editingDecor ? '' : 'none';   // ¾ Angle facing is decor-only — show it whenever editing decor
  if ($('gridLassoBtn')) { $('gridLassoBtn').style.display = gridView === 'angle' ? '' : 'none'; $('gridLassoBtn').classList.toggle('on', lassoMode && gridView === 'angle'); }   // lasso is Angle-only
  if ($('gridReproj')) { const a = gridView === 'angle'; $('gridReproj').textContent = a ? '◇ Carve to outline' : '🖼 Re-project'; $('gridReproj').title = a ? 'Select the shape to KEEP, then this marks voxels outside the ¾ outline for deletion — press Delete to remove them.' : "Re-project this facing's source image onto the surface."; }
  const gr2 = $('gridGeoRow'); if (gr2) gr2.style.display = '';
  // inline PAINT PALETTE — the model's colours as swatches, shown only in Paint mode (no need to open the Palette window)
  const gpal = $('gridPalette');
  if (gpal) {
    const showPal = gridTool === 'paint' || gridTool === 'add';   // Add uses the paint colour too
    gpal.style.display = showPal ? 'flex' : 'none';
    const psig = part + ':' + foot + ':' + layers + ':' + (base.palette ? base.palette.length : 0);
    if (showPal && gpal.dataset.sig !== psig) {
      gpal.dataset.sig = psig; gpal.innerHTML = '';
      for (const c of (base.palette || [])) {
        const b = document.createElement('button');
        b.style.cssText = 'width:18px;height:18px;padding:0;margin:0;border:1px solid #2a3a4a;border-radius:3px;cursor:pointer;background:' + cssOf(c);
        b.title = hexOf(c);
        b.onclick = () => setPaintRGB(c);   // one setter, so the big swatch follows the strip
        gpal.appendChild(b);
      }
    }
  }
  const ls = $('gridLayer'); if (ls) ls.max = String(depth);   // +1 for the surface projection at position 0
  // LABEL THE SLIDER POSITION, not the internal index. 0 is the whole surface projection; 1..N are the
  // N individual layers. Printing slice-1 made 28 layers read as 0..27.
  const lv = $('gridLayerV'); if (lv) lv.textContent = slice === 0 ? 'surface ▲' : `${ax.axis} ${slice} / ${depth}`;

  // THE GRID CELL IS THE FACE COLOUR, exactly as buildFaces computes it: the wall sheet for a carve-derived
  // voxel, vcol for a painted one. There is no reducer and no tuner between here and the model any more
  // (FFF-8), which is what makes "the grid, the 3D view and the bake agree" a property rather than a hope —
  // the two used to build SEPARATE quantisers over different histograms and disagree on unpainted voxels.
  const colAt = (x, y, z) => rawCol(x, y, z);
  // ── ALIGN mode (owner 2026-07-20): third-angle projection of the CARVED model. TOP (X×Y) above SIDE (X×Z)
  //    share the length axis X (vertical seam → X aligns down the left column); FRONT (Y×Z) sits to the RIGHT
  //    of SIDE and shares the height axis Z (horizontal seam → Z aligns across the bottom row). Top↔Front share
  //    Y diagonally (a 90° rotation apart). Validates that the view sizes line up + spot bad voxels. Read-only. ──
  if (gridAlign) {
    const lr2 = $('gridLayerRow'); if (lr2) lr2.style.display = 'none';
    const tr2 = $('gridToolRow'); if (tr2) tr2.style.display = 'none';
    const gr3 = $('gridGeoRow'); if (gr3) gr3.style.display = 'none';
    const gp2 = $('gridPalette'); if (gp2) gp2.style.display = 'none';
    if (editingDecor) {                                    // DECOR: the 3 carving views (Front / ¾ Angle / Side) in a row, height-aligned
      const SEP = 2, Wc = cv.width, Hc = cv.height;
      const panes = [{ ax: AX.front, cols: foot, label: 'FRONT  Y×Z' }, { ax: AX.angle, cols: foot, label: '¾ ANGLE  H×Z' }, { ax: AX.side, cols: foot, label: 'SIDE  X×Z' }];
      const totalCols = panes.reduce((s, p) => s + p.cols, 0) + SEP * (panes.length - 1);
      const cellA = Math.max(1, Math.floor(Math.min(Wc / totalCols, Hc / (layers + 1))));
      const gw = totalCols * cellA, gh = layers * cellA, ox0 = Math.floor((Wc - gw) / 2), oy = Math.floor((Hc - gh) / 2);
      ctx.clearRect(0, 0, Wc, Hc); ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, Wc, Hc);
      const surf = (axm, cx, cy) => { for (let s = 0; s < axm.depth; s++) { const [x, y, z] = axm.toVox(cx, cy, s); if (filled(x, y, z)) return colAt(x, y, z); } return null; };
      let ox = ox0;
      for (const p of panes) {
        if (cellA >= 4) { ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let cy = 0; cy < layers; cy++) for (let cx = 0; cx < p.cols; cx++) if ((cx + cy) & 1) ctx.fillRect(ox + cx * cellA, oy + cy * cellA, cellA, cellA); }
        for (let cy = 0; cy < layers; cy++) for (let cx = 0; cx < p.cols; cx++) { const col = surf(p.ax, cx, cy); if (col) { ctx.fillStyle = cssOf(col); ctx.fillRect(ox + cx * cellA, oy + cy * cellA, cellA, cellA); } }
        ctx.strokeStyle = 'rgba(120,150,180,.45)'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, p.cols * cellA - 1, layers * cellA - 1);
        ctx.fillStyle = 'rgba(143,167,189,.92)'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'top'; ctx.fillText(p.label, ox + 3, oy + 3);
        ox += (p.cols + SEP) * cellA;
      }
      let minz = layers, maxz = -1; for (let z = 0; z < layers; z++) { let any = false; for (let y = 0; y < foot && !any; y++) for (let x = 0; x < foot && !any; x++) if (filled(x, y, z)) any = true; if (any) { if (z < minz) minz = z; if (z > maxz) maxz = z; } }
      if (maxz >= 0) { ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(95,224,255,.6)';   // shared Z (height) guide across all three
        for (const zEdge of [layers - 1 - maxz, layers - minz]) { const ly = oy + zEdge * cellA + 0.5; ctx.beginPath(); ctx.moveTo(ox0, ly); ctx.lineTo(ox0 + gw, ly); ctx.stroke(); } ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(95,224,255,.9)'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top'; ctx.fillText('ht ' + (maxz - minz + 1), ox0 + 3, oy + (layers - 1 - maxz) * cellA + 1); }
      gridGeom = { align: true, editable: false, cell: cellA, ox: ox0, oyTop: oy, oySide: oy, foot, layers, part };
      return;
    }
    const SEP = 2, Wc = cv.width, Hc = cv.height;
    const cellA = Math.max(1, Math.floor(Math.min(Wc / (2 * foot + SEP), Hc / (foot + layers + SEP))));
    const gwA = (2 * foot + SEP) * cellA, ghA = (foot + layers + SEP) * cellA;
    const oxL = Math.floor((Wc - gwA) / 2), oyT = Math.floor((Hc - ghA) / 2);
    const oyB = oyT + (foot + SEP) * cellA;                 // bottom row: SIDE + FRONT
    const oxF = oxL + (foot + SEP) * cellA;                 // right column: FRONT
    const surf = (axm, cx, cy) => { for (let s = 0; s < axm.depth; s++) { const [x, y, z] = axm.toVox(cx, cy, s); if (filled(x, y, z)) return colAt(x, y, z); } return null; };
    ctx.clearRect(0, 0, Wc, Hc); ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, Wc, Hc);
    const drawPane = (axm, ox, oy, pcols, prows, label) => {
      if (cellA >= 4) { ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let cy = 0; cy < prows; cy++) for (let cx = 0; cx < pcols; cx++) if ((cx + cy) & 1) ctx.fillRect(ox + cx * cellA, oy + cy * cellA, cellA, cellA); }
      for (let cy = 0; cy < prows; cy++) for (let cx = 0; cx < pcols; cx++) { const col = surf(axm, cx, cy); if (col) { ctx.fillStyle = cssOf(col); ctx.fillRect(ox + cx * cellA, oy + cy * cellA, cellA, cellA); } }
      ctx.strokeStyle = 'rgba(120,150,180,.45)'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, pcols * cellA - 1, prows * cellA - 1);
      ctx.fillStyle = 'rgba(143,167,189,.92)'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'top'; ctx.fillText(label, ox + 3, oy + 3);
    };
    drawPane(AX.top,   oxL, oyT, foot, foot,   'TOP  X×Y');
    drawPane(AX.side,  oxL, oyB, foot, layers, 'SIDE  X×Z');
    drawPane(AX.front, oxF, oyB, foot, layers, 'FRONT  Y×Z');
    // shared-axis alignment guides: X (length, gold) vertical through TOP+SIDE; Z (height, cyan) horizontal through SIDE+FRONT
    let minx = foot, maxx = -1, minz = layers, maxz = -1;
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (filled(x, y, z)) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; }
    if (maxx >= 0) {
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(242,200,105,.7)';            // X extent — vertical, spanning TOP and SIDE (left column)
      for (const gx of [minx, maxx + 1]) { const lx = oxL + gx * cellA + 0.5; ctx.beginPath(); ctx.moveTo(lx, oyT); ctx.lineTo(lx, oyB + layers * cellA); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(95,224,255,.6)';             // Z extent — horizontal, spanning SIDE and FRONT (bottom row)
      for (const zEdge of [layers - 1 - maxz, layers - minz]) { const ly = oyB + zEdge * cellA + 0.5; ctx.beginPath(); ctx.moveTo(oxL, ly); ctx.lineTo(oxF + foot * cellA, ly); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(242,200,105,.9)'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillText('len ' + (maxx - minx + 1), oxL + minx * cellA + 2, oyB - 2);
      ctx.fillStyle = 'rgba(95,224,255,.9)'; ctx.textBaseline = 'top'; ctx.fillText('ht ' + (maxz - minz + 1), oxF + 3, oyB + (layers - 1 - maxz) * cellA + 1);
    }
    gridGeom = { align: true, editable: false, cell: cellA, ox: oxL, oyTop: oyT, oySide: oyB, foot, layers, part };
    return;
  }
  const cellAt = (cx, cy) => {
    if (slice === 0) {                                              // LAYER 0 = surface: FIRST filled voxel along depth
      for (let s = 0; s < depth; s++) { const [x, y, z] = ax.toVox(cx, cy, s); if (filled(x, y, z)) return colAt(x, y, z); }
      return null;
    }
    const [x, y, z] = ax.toVox(cx, cy, slice - 1); return filled(x, y, z) ? colAt(x, y, z) : null;
  };
  const anyDepth = (cx, cy) => { for (let s = 0; s < depth; s++) { const [x, y, z] = ax.toVox(cx, cy, s); if (filled(x, y, z)) return true; } return false; };

  // ONE scale for every view: size the cell from the LARGEST grid (top = foot × foot), not this view's own
  // rows — otherwise the short side/front views (foot × layers) grow their cells and render at a different
  // scale. A voxel is now the same square px in top/side/front/back; shorter views just centre with padding.
  // Voxels stay TRUE CUBES in the data; the render (and the dim box) STRETCH height by zScale, so the grid
  // must scale its Z axis the same way or it won't agree with the render/box (owner 2026-07-30 — the side/
  // front/back read ~5× too tall because this unit's zScale < 1 squashes height in the render but the grid
  // was square). Only views whose ROWS are Z (side/front/back/angle) scale; TOP (rows = Y) stays square.
  // cellV = vertical px-per-voxel for THIS view; cols keep the square `cell` so a voxel's WIDTH reads the same.
  const zsc = (gridView === 'top') ? 1 : state.zScale;
  const W = cv.width, H = cv.height;
  const uCols = foot, uRows = Math.max(foot, layers * zsc, layers * state.zScale);   // fit the tallest possible view (side/front scaled by zScale)
  const fitCell = Math.max(1, Math.floor(Math.min(W / uCols, H / uRows)));
  const cell = Math.max(1, Math.floor(fitCell * gridZoom));               // scroll-wheel zoom (square voxel WIDTH)
  const cellV = Math.max(1, Math.round(cell * zsc));                      // voxel HEIGHT in px for this view (zScale-scaled: <1 squashes, >1 stretches)
  const gw = cell * cols, gh = cellV * rows;
  const ox = Math.floor((W - gw) / 2) + gridPanX, oy = Math.floor((H - gh) / 2) + gridPanY;
  // The sizing box needs SPANS and an axis map — not side/front/back art. Requiring `V` meant a part
  // with only a top slice (or no wall art yet) drew no box at all, so the cyan handles did not exist and
  // there was nothing to drag: owner "the blue handles do not respond". The slice image it overlays is
  // already drawn behind `if (keyed)`, so it simply renders as a bare box when there is no art.
  const geomActive = gridMode === 'geom' && base.sp && GEOAX[gridView];
  // colAt rides along so the pointer tools can match on WHAT IS DRAWN. Flood fill comparing raw vcol
  // would refuse to spread across a face whose colour comes from the side sheet — visibly one patch,
  // two different numbers. gridGeom is already the render→pointer handoff; this is what it is for.
  gridGeom = { cell, cellV, zsc, ox, oy, cols, rows, depth, slice, toVox: ax.toVox, foot, layers, part, editable: !geomActive, colAt };
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, W, H);
  // faint checker so the empty grid still reads as a grid at any zoom
  if (cell >= 4) { ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if ((cx + cy) & 1) ctx.fillRect(ox + cx * cell, oy + cy * cellV, cell, cellV); }
  // faint silhouette of the WHOLE model (all depths) so the active slice reads in context
  ctx.fillStyle = 'rgba(150,185,220,.13)';
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (anyDepth(cx, cy)) ctx.fillRect(ox + cx * cell, oy + cy * cellV, cell, cellV);
  // the ACTIVE slice — palette-correct in Paint mode, flat grey in Geometry mode (shape, not colour)
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const col = cellAt(cx, cy); if (!col) continue;
    ctx.fillStyle = geomActive ? '#68788a' : `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect(ox + cx * cell, oy + cy * cellV, cell, cellV);
  }
  // a REAL grid: cell lines across the WHOLE area (occupied + empty) + a crisp outer frame
  if (cell >= 3) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let cx = 0; cx <= cols; cx++) { ctx.moveTo(ox + cx * cell + .5, oy); ctx.lineTo(ox + cx * cell + .5, oy + gh); }
    for (let cy = 0; cy <= rows; cy++) { ctx.moveTo(ox, oy + cy * cellV + .5); ctx.lineTo(ox + gw, oy + cy * cellV + .5); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,160,200,.55)'; ctx.lineWidth = 1; ctx.strokeRect(ox + .5, oy + .5, gw - 1, gh - 1);

  // ORIENTATION INDICATOR (2026-07-21): label each edge with the WORLD direction it faces, read straight
  // from the same `ax.toVox` mapping the grid edits use — so the TOP/SIDE (and base-vs-turret) orientation
  // is explicit and any disagreement with the 3D orbit is immediately visible. World axes: x=+FRONT/−BACK,
  // y=−LEFT(0)/+RIGHT(foot−1), z=UP. The four maps agree front=+x, so all views share it; base and turret
  // use the SAME map, so this reads the same for both parts.
  //
  // THE HANDEDNESS, DERIVED (owner 2026-08-05: "the left side of top is labeled as right"). AX.top maps
  // col→x and row→y, and canvas rows grow DOWNWARD, so +x is screen-right and +y is screen-DOWN — a plain
  // map view with the nose pointing "east". Looking DOWN at a vehicle heading east, its LEFT flank faces
  // "north" = UP the screen = y=0. So y=0 is LEFT and y=foot−1 is RIGHT. This comment previously asserted
  // the opposite, and EVERY row below was written from that claim — so all of them were reversed.
  if (gridOrient) {
    const ORI = {
      top:   { t: 'LEFT',  b: 'RIGHT', l: 'BACK',  r: 'FRONT', note: 'TOP · looking down (−Z)' },
      side:  { t: 'UP',    b: 'DOWN',  l: 'BACK',  r: 'FRONT', note: 'SIDE · viewed from the LEFT (−Y)' },
      front: { t: 'UP',    b: 'DOWN',  l: 'LEFT',  r: 'RIGHT', note: 'FRONT · +X elevation' },   // a drawn elevation, not a head-on camera: left-on-left, as authored
      back:  { t: 'UP',    b: 'DOWN',  l: 'LEFT',  r: 'RIGHT', note: 'BACK · viewed from −X' },    // behind it: its left is on YOUR left
      angle: { t: 'UP',    b: 'DOWN',  l: 'LEFT',  r: 'RIGHT', note: '¾ ANGLE · diagonal slice along the +X+Y camera ray' },
    }[gridView];
    if (ORI) {
      const lab = (text, cx, cy, inside) => {
        ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (inside) { const w = ctx.measureText(text).width + 6; ctx.fillStyle = 'rgba(6,12,20,.72)'; ctx.fillRect(cx - w / 2, cy - 7, w, 13); }
        ctx.fillStyle = inside ? 'rgba(140,210,255,.95)' : 'rgba(120,200,255,.8)';
        ctx.fillText(text, cx, cy);
      };
      lab(ORI.t, ox + gw / 2, oy >= 14 ? oy - 6 : oy + 8, oy < 14);
      lab(ORI.b, ox + gw / 2, (H - (oy + gh)) >= 14 ? oy + gh + 7 : oy + gh - 8, (H - (oy + gh)) < 14);
      lab(ORI.l, ox >= 36 ? ox - 18 : ox + 16, oy + gh / 2, ox < 36);
      lab(ORI.r, (W - (ox + gw)) >= 36 ? ox + gw + 18 : ox + gw - 16, oy + gh / 2, (W - (ox + gw)) < 36);
      ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(120,200,255,.6)'; ctx.fillText(ORI.note, 4, 4);
    }
    // ROTATING COMPASS (owner): a rose that turns with the object's azimuth so you always know where
    // Front / Left / Back / Right point while editing a slice — especially in the side view. Front (+X,
    // the unit's facing / zeroFacing) is gold; the whole rose spins by state.az.
    const R = 20, ccx = W - R - 12, ccy = H - R - 12, a = state.az * Math.PI / 180;
    ctx.save(); ctx.translate(ccx, ccy);
    ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(a);
    // FRONT points screen-RIGHT, not up: renderParts is PX = cx + S*(X*ca − Y*sa), so at az=0 the +X
    // (FRONT) axis runs along screen +x and +Y (RIGHT) runs screen-DOWN. Drawing F at (0,−1) put the rose
    // a quarter turn out of step with the model — owner: "the base is 90 clockwise of the compass".
    const dirs = [['F', 1, 0, 'rgba(242,200,105,.95)'], ['R', 0, 1, 'rgba(140,210,255,.85)'], ['B', -1, 0, 'rgba(140,210,255,.85)'], ['L', 0, -1, 'rgba(140,210,255,.85)']];
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.5;
    for (const [lab, dx, dy, col] of dirs) {
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(dx * R * 0.5, dy * R * 0.5); ctx.lineTo(dx * R * 0.86, dy * R * 0.86); ctx.stroke();
      ctx.save(); ctx.translate(dx * (R + 8), dy * (R + 8)); ctx.rotate(-a); ctx.fillStyle = col; ctx.fillText(lab, 0, 0); ctx.restore();   // keep labels upright
    }
    ctx.fillStyle = 'rgba(242,200,105,.95)'; ctx.beginPath(); ctx.moveTo(R * 0.86, 0); ctx.lineTo(R * 0.55, -3.5); ctx.lineTo(R * 0.55, 3.5); ctx.closePath(); ctx.fill();   // front arrowhead → +X (screen right)
    ctx.restore();
  }

  const drawMarquee = (s, stroke, fill) => {
    const c0 = Math.min(s.c0, s.c1), c1 = Math.max(s.c0, s.c1), r0 = Math.min(s.r0, s.r1), r1 = Math.max(s.r0, s.r1);
    const rx = ox + c0 * cell + 0.5, ry = oy + r0 * cellV + 0.5, rw = (c1 - c0 + 1) * cell - 1, rh = (r1 - r0 + 1) * cellV - 1;
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(rx, ry, rw, rh); }
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
  };
  if (gridGuides) {                                               // centre point + H/V centre lines — align + check symmetry
    const cxp = ox + (cols / 2) * cell, cyp = oy + (rows / 2) * cellV;
    ctx.strokeStyle = 'rgba(242,200,105,.40)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(Math.round(cxp) + 0.5, oy); ctx.lineTo(Math.round(cxp) + 0.5, oy + rows * cellV); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, Math.round(cyp) + 0.5); ctx.lineTo(ox + cols * cell, Math.round(cyp) + 0.5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(242,200,105,.95)'; ctx.beginPath(); ctx.arc(cxp, cyp, Math.max(2, cell * 0.14), 0, Math.PI * 2); ctx.fill();
  }
  // SELECTION: highlight the SELECTED voxels visible in THIS facing (they persist across facings so a Layer-0
  // object pick can be painted on every face), plus the exact dashed rect only in the facing it was drawn in.
  if (gridBoxSel) drawMarquee(gridBoxSel, '#e0625f', null);               // marquee being dragged
  if (gridAddBox) drawMarquee(gridAddBox, '#5fe07a', 'rgba(95,224,122,.14)');   // ➕ Add surface-extrude patch
  if (gridLasso && gridLasso.length) {                                    // ◇ Angle lasso outline (cell points)
    const px = (p) => ox + (p.c + 0.5) * cell, py = (p) => oy + (p.r + 0.5) * cell;
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px(gridLasso[0]), py(gridLasso[0]));
    for (let i = 1; i < gridLasso.length; i++) ctx.lineTo(px(gridLasso[i]), py(gridLasso[i]));
    if (!lassoMode) ctx.closePath();                                      // closed once finished
    ctx.stroke();
    ctx.fillStyle = '#ffb454'; for (const p of gridLasso) { ctx.beginPath(); ctx.arc(px(p), py(p), 2.5, 0, 7); ctx.fill(); }
    if (lassoMode && gridLasso.length >= 3) { ctx.strokeStyle = '#fff'; ctx.strokeRect(px(gridLasso[0]) - 4, py(gridLasso[0]) - 4, 8, 8); }   // click here to close
  }
  // FRONT/BACK MISMATCH: the carve takes width geometry from the front; the back only paints the −x wall.
  // Where their silhouettes disagree, the back art won't line up with the geometry — flag it red so you
  // can fix it with a few face paints (owner 2026-07-18). Only when both a front and back image exist.
  if ((gridView === 'front' || gridView === 'back') && V && V.front && V.back) {
    const A = V.front, B = V.back, bhh = A.w, Hvv = A.h, z0v = V.z0 || 0, oyv = V.oy;
    ctx.fillStyle = 'rgba(224,98,95,.5)';
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const [, y, z] = ax.toVox(cx, cy, slice), iy = y - oyv, iz = z - z0v;
      if (iy < 0 || iy >= bhh || iz < 0 || iz >= Hvv) continue;
      if (!!A.m[iz * bhh + iy] !== !!B.m[iz * bhh + iy]) ctx.fillRect(ox + cx * cell, oy + cy * cellV, cell, cellV);
    }
  }

  if (geomActive) {
    // GEOMETRY RECONCILE: overlay the source silhouette where its span rect maps onto the grid, plus a
    // draggable box (drag an edge to stretch that dimension, the interior to move). Shared spans keep
    // the other views in lock-step. spans come from base.sp (auto today; the user's saved override once
    // they drag). n: the box's two in-plane axes read GEOAX[view].col/row.
    const g = GEOAX[gridView], capOf = (a) => (a === 'z' ? layers : foot);
    // box reads live geomState when the part is manually reconciled (so it moves during a drag without a
    // full re-carve every frame); otherwise the auto spans the carve just used.
    const bsp = (geomState[part] && geomState[part].spanX) ? geomState[part] : base.sp;
    const rng = (info) => { const s = bsp[spanKey[info.axis]], cap = capOf(info.axis); return info.flip ? { lo: cap - s.hi, hi: cap - s.lo } : { lo: s.lo, hi: s.hi }; };
    const cR = rng(g.col), rR = rng(g.row);
    const bx = ox + cR.lo * cell, by = oy + rR.lo * cellV, bw2 = (cR.hi - cR.lo) * cell, bh2 = (rR.hi - rR.lo) * cellV;
    // apply the SAME per-side scale/align (xf) the carve uses, or the geometry overlay (raw image) won't match
    // the paint voxels (transformed) once a side is aligned — owner: "geometry and paint do not match".
    const keyed = imgs[part][gridView] ? xfCanvas(keyedCanvas(imgs[part][gridView], keyTolState[part][gridView], polyState[part][gridView], pickState[part][gridView]), (imgXf[part] || {})[gridView]) : null;   // UNCROPPED: match the carve
    // DRAW THE MASK, NOT THE IMAGE. Blitting `keyed` resampled it with NEAREST, while the carve resamples
    // with sliceMask's majority coverage — so the overlay could show a feature the carve deletes. Measured:
    // a 1px antenna in a 200px slice at box 32 draws 1 cell here and survives 0 cells in the carve. You
    // were aligning against a picture that lied. Filling the mask's own cells makes them agree by
    // construction rather than by two algorithms happening to match.
    if (keyed) {
      const cols2 = Math.max(1, cR.hi - cR.lo), rows2 = Math.max(1, rR.hi - rR.lo);
      const mk = sliceMask(keyed, cols2, rows2, false);              // the exact cells the carve would keep
      ctx.globalAlpha = 0.42;
      for (let r = 0; r < rows2; r++) for (let c = 0; c < cols2; c++) {
        const i = r * cols2 + c; if (!mk.m[i]) continue;
        ctx.fillStyle = `rgb(${mk.c[i * 3]},${mk.c[i * 3 + 1]},${mk.c[i * 3 + 2]})`;
        ctx.fillRect(bx + c * cell, by + r * cellV, Math.ceil(cell), Math.ceil(cellV));
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#48d0e0'; ctx.lineWidth = 2; ctx.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, bh2 - 1);
    ctx.fillStyle = '#48d0e0';                                       // edge-midpoint handles
    for (const [hx, hy] of [[bx + bw2 / 2, by], [bx + bw2 / 2, by + bh2], [bx, by + bh2 / 2], [bx + bw2, by + bh2 / 2]]) ctx.fillRect(hx - 4, hy - 4, 8, 8);
    gridGeom.geom = { bx, by, bw: bw2, bh: bh2, cell, cellV, ox, oy, gw, gh, col: g.col, row: g.row, foot, layers };
    // ── SLICE ADJUSTERS on the projection. Amber, inset from the cyan BOX handles. An EDGE handle moves
    // ONLY that edge (the opposite one is pinned), a CORNER moves two, and the INTERIOR moves the whole
    // slice. xfCanvas centres the slice at (0.5+ox) of the box and scales by sx about that centre, so
    // pinning an edge needs BOTH sx and ox to change — scaling alone always moves both sides.
    if (keyed) {
      const xfc = (imgXf[part] || {})[gridView] || { sx: 1, sy: 1, ox: 0, oy: 0 };
      const ccx = bx + bw2 * (0.5 + (xfc.ox || 0)), ccy = by + bh2 * (0.5 + (xfc.oy || 0));
      const hw = bw2 * (xfc.sx || 1) / 2, hh = bh2 * (xfc.sy || 1) / 2;
      const L = ccx - hw, R = ccx + hw, T = ccy - hh, B = ccy + hh;
      // NOT `slice` — that key already holds the LAYER INDEX (set above). Overwriting it with this box
      // made every `g.slice - 1` reader compute NaN: painting on any layer >= 1 threw, and the SHIFT/CTRL
      // selection band silently selected nothing in Geometry mode.
      gridGeom.sliceBox = { bx, by, bw: bw2, bh: bh2, L, R, T, B, view: gridView, part };
      ctx.strokeStyle = 'rgba(242,200,105,.9)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.strokeRect(L + .5, T + .5, R - L - 1, B - T - 1); ctx.setLineDash([]);
      ctx.fillStyle = '#f2c869';
      for (const [hx, hy] of [[L, (T + B) / 2], [R, (T + B) / 2], [(L + R) / 2, T], [(L + R) / 2, B],
                              [L, T], [R, T], [L, B], [R, B]]) ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }
    const sx = bsp[spanKey[g.col.axis]], sy = bsp[spanKey[g.row.axis]];
    ctx.fillStyle = '#8fa7bd'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(`${g.col.axis.toUpperCase()} ${sx.lo}–${sx.hi} · ${g.row.axis.toUpperCase()} ${sy.lo}–${sy.hi}${geomState[part].auto ? '  (auto)' : ''}`, ox + 3, oy + 3);
  } else if (gridView !== 'top' && cell >= 2) {
    // TOP-DOWN reference (Paint mode, side/front/back): a small footprint map in the corner with a line
    // marking where the current slice sits, so you know which part of the model you're on.
    const mc = Math.max(1, Math.floor(Math.min(64, Math.min(W, H) * 0.30) / foot)), mw = mc * foot, mmx = W - mw - 6, mmy = 16;
    ctx.fillStyle = 'rgba(6,11,18,.92)'; ctx.fillRect(mmx - 3, mmy - 3, mw + 6, mw + 6);
    ctx.fillStyle = 'rgba(150,185,220,.5)';                          // footprint: any voxel in the (x,y) column
    for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      let any = false; for (let z = 0; z < layers && !any; z++) if (filled(x, y, z)) any = true;
      if (any) ctx.fillRect(mmx + x * mc, mmy + y * mc, mc, mc);
    }
    ctx.strokeStyle = '#f2c869'; ctx.lineWidth = 1.5; ctx.beginPath();  // current-slice line (depth axis)
    if (gridView === 'side') { const yy = mmy + slice * mc + mc / 2; ctx.moveTo(mmx, yy); ctx.lineTo(mmx + mw, yy); }
    else if (gridView === 'angle') { ctx.moveTo(mmx + slice * mc, mmy); ctx.lineTo(mmx, mmy + slice * mc); }   // diagonal slice, from the +x+y corner
    else { const sx = gridView === 'back' ? (foot - 1 - slice) : slice, xx = mmx + sx * mc + mc / 2; ctx.moveTo(xx, mmy); ctx.lineTo(xx, mmy + mw); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,160,200,.6)'; ctx.lineWidth = 1; ctx.strokeRect(mmx + .5, mmy + .5, mw - 1, mw - 1);
    ctx.fillStyle = '#8fa7bd'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText('top ref', mmx, mmy - 4);
  }
  // ── SELECTION, DRAWN LAST ───────────────────────────────────────────────────────────────────────
  // It must be the TOPMOST thing in the grid. It used to draw before the Geometry overlay, so switching
  // to a facing that has one buried the highlight under a 0.42-alpha slice image and the selection
  // looked like it had been cleared on every perspective change. Nothing may paint over it.
  ctx.globalAlpha = 1;
  if (gridSelVox && gridSelVox.part === part) {
    // ✥ MOVE GHOST. While a move drag is live the selection is drawn shifted by the drag, so you can see
    // where the voxels will land before you let go. Nothing has moved yet — the model is written once,
    // on release, so the whole drag is ONE undo entry.
    const gh = moveGhost && moveGhost.part === part ? moveGhost : null;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const s = selCellState(gridGeom, gh ? cx - gh.dc : cx, gh ? cy - gh.dr : cy); if (!s) continue;
      ctx.fillStyle = s === 2 ? 'rgba(95,224,255,.38)' : 'rgba(95,224,255,.15)';   // deeper-in-column reads faint
      ctx.fillRect(ox + cx * cell, oy + cy * cellV, cell, cellV);
      if (s === 2) { ctx.strokeStyle = 'rgba(120,240,255,.85)'; ctx.lineWidth = 1; ctx.strokeRect(ox + cx * cell + .5, oy + cy * cellV + .5, cell - 1, cellV - 1); }
    }
    if (gridSel && gridSelView === gridView) drawMarquee(gridSel, '#5fe0ff', null);
  }
  if (selBoxing) drawMarquee(selBoxing, selBoxing.mode === 'trim' ? '#ff5f5f' : '#5fe0ff',
    selBoxing.mode === 'trim' ? 'rgba(255,95,95,.18)' : 'rgba(95,224,255,.12)');   // CTRL band is RED: trims the selection
}

// PERSIST the derived effective grid (footOf/gridLayersOf already guarantee grid ⊇ geometry for every reader;
// this writes it back into state + the UI so export, the sliders, and the Resolution dropdown all agree). It
// only ever grows to fit the geometry — a unit longer than it is tall keeps its length; 128 voxels is the hard
// ceiling. This is the single reconciliation point, called at the top of every carve (recarve).
// A BAKE IS GPU MEMORY, AND DROPPING THE REFERENCE DOES NOT FREE IT.
// bakeAngleCache/bakeShadowCache each return an ARRAY of PIXI.RenderTexture — 32 body + 64 turret + 32
// body-shadow + 64 turret-shadow = 192 textures per bake. `state.baked = null` orphaned every one of
// them: the sprites were destroyed, the textures were not, and PIXI has no finaliser. refreshModel()
// runs after EVERY edit, so a single bake followed by a single slider nudge leaked the lot — 38 MB on a
// small unit, 84 MB on GND-Artillery — and the browser died after a handful of iterations.
//
// This is the fix for that. It is also why BODY_FRAMES 16 -> 32 made the crash arrive sooner: the leak
// per bake grew with the frame count (160 -> 192 textures), which is exactly the wrong thing to scale.
//
// destroy(true) releases the base texture as well as the wrapper; without the flag the GPU allocation
// survives. Wrapped per texture so one bad entry cannot abort the sweep and strand the rest.
function releaseBaked(b) {
  if (!b) return;
  let n = 0;
  for (const key of ['body', 'turret', 'bodyShadow', 'turretShadow', 'frame', 'shadow']) {
    const v = b[key];
    if (!v) continue;
    for (const rt of (Array.isArray(v) ? v : [v])) {
      if (rt && typeof rt.destroy === 'function') { try { rt.destroy(true); n++; } catch (e) { /* already gone */ } }
    }
  }
  return n;
}
function refreshModel() {
  carveEpoch++;                                       // invalidate anything cached against the previous carve
  if (bodyBaked) { bodyBaked.destroy(); bodyBaked = null; } if (turretBaked) { turretBaked.destroy(); turretBaked = null; }
  if (gBodyBaked) { gBodyBaked.destroy(); gBodyBaked = null; } if (gTurretBaked) { gTurretBaked.destroy(); gTurretBaked = null; }
  releaseBaked(state.baked); state.baked = null; voxSig = ''; $('saveUnit').disabled = true; $('dlSheet').disabled = true;
  bodyMountZ = bodyTopLayer(state.foot, state.bodyLayers);   // turret mounts on the body's actual top
  bodyFloorZ = partFloorZ('body', state.foot, state.bodyLayers);   // …and the hull sits on its own lowest voxel
  bodyFaces = buildFaces('body', state.foot, state.bodyLayers);
  turretFaces = buildFaces('turret', footOf('turret'), state.turretLayers);   // SF3: turret's own footprint
  // canvases sized to the worst case at any azimuth: footprint diagonal + offsets + the full stack height
  // Same defect as the bake frame, and worse because it hides it: R was computed from the BODY footprint,
  // so a turret with a larger footprint clipped in the ORBIT too — you could not see the damage the bake
  // was doing. Measured at body 64 / turret 96 / 25% pivot: R was 64 where 95 is needed.
  // HT likewise: mountZOf clamps the mount to bodyLayers + turretLayers, so the top of the stack can
  // reach bodyLayers + 2*turretLayers while this budgeted bodyLayers + turretLayers + 4.
  const foot = Math.max(state.foot, footOf('turret')), h = state.zScale;
  const topZ = Math.max(state.bodyLayers, mountZOf(state.bodyLayers) + state.turretLayers);
  voxBounds = { R: Math.ceil(foot * 0.71 + Math.abs(state.turretDx) + foot * Math.abs(state.turretPivot) / 100) + 2,
    HT: Math.ceil((topZ + 4) * h) };
  buildOrbitTarget(orbitS());
  if (gVoxSpr) { gVoxSpr.destroy(); gVoxShadow.destroy(); gVoxTex.destroy(true); }
  gVoxMeta = mkTarget(INSET_S, voxBounds.R, voxBounds.HT);
  gVoxTex = PIXI.Texture.from(gVoxMeta.cv);
  gVoxTex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;   // same default-LINEAR miss as voxTex, inset view
  const laI = state.lightAz * Math.PI / 180;
  gVoxShadow = new PIXI.Sprite(gVoxTex);
  gVoxShadow.anchor.set(0.5, gVoxMeta.groundY / gVoxMeta.Hp);
  gVoxShadow.position.set(-Math.cos(laI) * state.foot * 0.30, Math.sin(laI) * state.foot * 0.20 + 1);
  gVoxShadow.tint = 0x000000; gVoxShadow.alpha = 0.22;
  gVoxShadow.scale.set(1 / INSET_S, 0.55 / INSET_S); gVoxShadow.skew.x = shadowLean();
  gUnit.addChild(gVoxShadow);
  gVoxSpr = new PIXI.Sprite(gVoxTex); gVoxSpr.scale.set(1 / INSET_S);
  gVoxSpr.anchor.set(0.5, gVoxMeta.groundY / gVoxMeta.Hp); gVoxSpr.position.set(0, 0);
  gUnit.addChild(gVoxSpr);
  setTimeout(renderScaleChart, 0);   // model changed → refresh the side-view scale chart
  gridModel = null; renderGridView(); // model changed → invalidate cache + refresh the grid view
}
refreshModel();

// ── THE THREE LEVELS (owner 2026-08-04: "maybe calling rebuild slices from 42 locations is the bug").
// recarveFromSource(parts)  THE EXPLICIT ASK. Discards hand work and derives from the slices. Undoable.
//                           Callers: the Carve buttons, "Reset edits", a confirmed flip, the stale offer.
// recarve()      a carve INPUT changed. Re-derives a part with no hand work; leaves one that has it alone
//                (buildModelRaw flags it stale instead). ~20 callers, none of which may destroy anything.
// refreshModel() rebuild faces from the model, then redraw. Paint, erase, undo, lighting — none of these
//                can change geometry, so none re-carve.
// recarve() means "a carve INPUT changed", and that is ALL it means. It re-derives from the slices for a
// part with no hand work — the normal authoring flow, where dragging Layers should make the box taller —
// and leaves a part that HAS hand work alone; buildModelRaw flags that part stale instead. It used to null
// both caches and clear volDirty unconditionally, which is how ~20 unrelated controls (and one render
// frame) could throw a carve away. Clearing volDirty is now exclusively an explicit discard's business.
function recarve() {
  for (const p of ['body', 'turret']) if (!volDirty[p]) carveCache[p] = null;
  refreshModel();
}
// THE EXPLICIT ASK: throw this part's hand work away and derive it from the slices again. Undoable — the
// snapshot is taken first, so Ctrl+Z brings the work back. This is the ONLY way a model with hand work in
// it gets replaced by a carve, and every caller is a button the artist pressed.
function recarveFromSource(parts) {
  const list = Array.isArray(parts) ? parts : [parts];
  const live = list.filter((p) => carveCache[p]);
  if (live.length) pushVolParts(live);          // ONE undo entry covering every part being discarded
  for (const p of list) { carveCache[p] = null; volDirty[p] = false; carveStale[p] = false; }
  gridModel = null;                             // (pushVolParts sets volDirty; clearing after is deliberate)
}
// Put a saved volume back after a carve has rebuilt VOL. Dims must match exactly — the keys are absolute
// z*foot²+y*foot+x, so replaying a 32-grid volume into a 64-grid model would scatter it. A mismatch
// discards rather than mis-indexes, and says so.
function restoreVol(p) {
  if (!p || !p.vol) return;
  for (const part of ['body', 'turret']) {
    const s = p.vol[part]; if (!s) continue;
    const c = carveCache[part], V = c && c.m && c.m.VOL;
    if (!V) continue;
    if (s.foot !== c.foot || s.layers !== c.layers) {
      console.warn(`[stack-forge] ${part}: saved volume was ${s.foot}×${s.layers}, this carve is ${c.foot}×${c.layers} — hand edits discarded rather than mis-indexed`);
      continue;
    }
    if (s.edited && s.b64) {
      const u = u8FromB64(s.b64);
      if (u.length !== V.length) { console.warn(`[stack-forge] ${part}: saved volume length mismatch — discarded`); continue; }
      V.set(u); volDirty[part] = true;
    }
    // COLOUR RESTORES INDEPENDENTLY OF GEOMETRY. Gating this on s.edited would drop the paint of anyone
    // who coloured a unit without also carving it by hand — the commonest way to lose work here, and the
    // reason the check below tests `paint`, not `edited`. vcol without PAINT is meaningless: PAINT is what
    // marks a voxel as artist-chosen, so a restore missing it would let the next re-carve overwrite the lot.
    if (s.paint && s.vcol && c.m.PAINT && c.m.vcol) {
      const P = u8FromB64(s.paint), C = u8FromB64(s.vcol);
      if (P.length !== c.m.PAINT.length || C.length !== c.m.vcol.length) {
        console.warn(`[stack-forge] ${part}: saved colour length mismatch — paint discarded rather than mis-indexed`);
      } else { c.m.PAINT.set(P); c.m.vcol.set(C); volDirty[part] = true; }
    }
    // volDirty IS WHAT PROTECTS A RESTORED MODEL (FFF-2). It is what tells buildModelRaw this part holds
    // work the slices cannot reproduce, so no later carve-input change may re-derive over it. Setting it
    // only in the `s.edited` branch above meant a unit that was painted but never hand-carved came back
    // off disk unprotected — and the first Layers nudge threw the paint away, which is precisely the
    // "coloured but not carved" case the comment above already had to be written for once.
  }
  gridModel = null; refreshModel();
}
function update() {
  const se = Math.sin(state.el * Math.PI / 180);
  const azR = state.az * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const showB = state.part !== 'turret', showT = state.part !== 'body';

  // THE MAIN WINDOW IS THE GEOMETRY VIEW, ALWAYS. It used to silently become a baked-sprite viewer the
  // moment a bake existed — and the geometry branch turned voxSpr ON without ever turning the baked
  // sprites OFF, so after bake-then-edit BOTH drew and the model appeared over the sprites. Baked frames
  // now live in their own preview modal; nothing here is implicit. (Owner 2026-08-06.)
  // GUARDED: bodyBaked/turretBaked are null until a bake creates them, and refreshModel() destroys and
  // nulls them again on every edit. The old code only touched them inside `if (state.baked)`, where they
  // were guaranteed to exist; hoisting them out of that branch threw on every frame before a bake and
  // killed the whole render loop — which is why the 3D unit disappeared.
  if (!voxSpr || !voxShadow || !voxMeta || !voxTex) return;   // orbit target not built yet, or mid-rebuild
  if (bodyBaked) bodyBaked.visible = false;
  if (turretBaked) turretBaked.visible = false;
  voxSpr.visible = true; voxShadow.visible = true;
  // only re-render the cube scene when something it depends on actually changed
  const sig = state.az.toFixed(1) + '|' + state.el.toFixed(1) + '|' + state.taim.toFixed(1) + '|' + state.turretDx + '|' +
    state.turretPivot + '|' + state.mountZ + '|' + state.part + '|' + state.lightAz + '|' + state.lightK + '|' + state.zScale +
    '|' + (gridSelVox ? selEpoch + ':' + gridSelVox.part + ':' + gridView + ':' + gridLayer : 'x') +   // selEpoch, not set.size: trading one selected voxel for another must still redraw
    '|dim' + (state.showDimBox ? state.foot + ':' + footOf('turret') + ':' + state.bodyLayers + ':' + state.turretLayers : '0');   // SF1 dim box (+SF3 turret foot)
  if (sig !== voxSig) { voxSig = sig; drawScene(voxMeta, state.el, azR, azR + taimR); voxTex.baseTexture.update(); }
}
// position the in-game preview: unit at GAME scale on the tile, slowly turning to show facings, with the
// game shadow. Uses the same elevation as the bake camera so the preview matches what you'll ship.
let gPrevAz = 0;
function updateGamePreview() {
  if (gSpin && !gDragPrev) gPrevAz = (gPrevAz + 0.4) % 360;
  const azR = gPrevAz * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const spG = layerSp(state.el), se = Math.sin(state.el * Math.PI / 180);
  const uScale = GAME_TILE * GAME_UNIT_SCALE / VOX_PER_TILE;          // GAME-ACCURATE: footprint × 0.5 tiles (matches loader.js VOXEL_UNIT_SCALE)
  gUnit.scale.set(uScale); gUnit.position.set(gAnchor.x, gAnchor.y + GAME_TILE * 0.12);
  // COLLISION footprint ring — the sim's unit radius, ~1.2× the on-screen tank width (option 2). Cyan ring.
  {
    const rr = bodyExtentTiles() * GAME_TILE, cyGround = gAnchor.y + GAME_TILE * 0.06;
    gCollision.clear();
    gCollision.beginFill(0x5fe0ff, 0.07); gCollision.drawCircle(gAnchor.x, cyGround, rr); gCollision.endFill();
    gCollision.lineStyle(1.5, 0x5fe0ff, 0.85); gCollision.drawCircle(gAnchor.x, cyGround, rr); gCollision.lineStyle(0);
  }
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = mountZOf(state.bodyLayers);
  const ox = state.turretDx * Math.cos(azR), oy = state.turretDx * Math.sin(azR) * se, r = 0.75;
  // faint contact blob only — the silhouette shadow carries the read for the live cube render
  gShadow.clear(); gShadow.beginFill(0x000000, state.baked ? 0.26 : 0.10);
  gShadow.drawEllipse(gAnchor.x, gAnchor.y + GAME_TILE * 0.06, GAME_TILE * r * 0.62, GAME_TILE * r * 0.31); gShadow.endFill();
  if (state.baked && gBodyBaked) {                                    // show the actual baked (smooth) game asset
    gVoxSpr.visible = false; gVoxShadow.visible = false;
    const bb = bucketOf(azR, state.baked.bodyFrames), tb = bucketOf(azR + taimR, state.baked.turretFrames);
    gBodyBaked.texture = state.baked.body[bb]; gBodyBaked.visible = showB; gBodyBaked.position.set(0, 0);
    gTurretBaked.texture = state.baked.turret[tb]; gTurretBaked.visible = showT; gTurretBaked.position.set(ox, -mountDz * spG + oy);
    return;
  }
  gVoxSpr.visible = true; gVoxShadow.visible = true;
  drawScene(gVoxMeta, state.el, azR, azR + taimR);                    // live cube render at game scale
  gVoxTex.baseTexture.update();
}
app.ticker.add(() => {
  if (state.spin) { state.taim = (state.taim + 1.2) % 360; $('taim').value = state.taim | 0; $('taimV').textContent = (state.taim | 0) + '°'; }
  update(); updateGamePreview();
});

// ── orbit drag (main stage) + IN-GAME inset interactions (buttons / drag-to-turn / corner resize) ──
let drag = null, pan = null;
// double-click empty stage → recentre the panned view
app.view.addEventListener('dblclick', (e) => { if (insetHit(e).inside) return; rigPan = { x: 0, y: 0 }; rig.position.set(rigX(), rigY()); drawLight(); });
const insetHit = (e) => { const px = e.offsetX - gameLayer.x, py = e.offsetY - gameLayer.y;
  return { px, py, inside: px >= 0 && px <= PVW && py >= 0 && py <= PVH }; };
app.view.addEventListener('pointerdown', (e) => {
  const q = insetHit(e);
  if (q.inside) {
    if (q.py < 24 && q.px > PVW - 28) { setGSpin(!gSpin); return; }                       // ⟳ pause/run turntable
    if (q.py < 24 && q.px > PVW - 50) { setGSpin(false); gPrevAz = ((state.az % 360) + 360) % 360; return; }  // ⌖ match orbit camera
    if (q.px < 20 && q.py > PVH - 20) { gResize = { x: e.clientX, y: e.clientY, w: PVW, h: PVH }; return; }   // corner grip
    gDragPrev = { x: e.clientX, az: gPrevAz };                                            // drag the unit itself
    return;
  }
  if (e.button === 1 || e.shiftKey) {                                                     // MIDDLE or SHIFT+drag = PAN the view aside
    pan = { x: e.clientX, y: e.clientY, px: rigPan.x, py: rigPan.y }; e.preventDefault(); return;
  }
  drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el };                       // left-drag = orbit rotate
});
window.addEventListener('pointerup', () => { drag = null; gDragPrev = null; gResize = null; pan = null; });
window.addEventListener('pointermove', (e) => {
  if (gResize) { resizePreview(gResize.w - (e.clientX - gResize.x), gResize.h + (e.clientY - gResize.y)); return; }
  if (pan) { rigPan.x = pan.px + (e.clientX - pan.x); rigPan.y = pan.py + (e.clientY - pan.y); rig.position.set(rigX(), rigY()); drawLight(); return; }
  if (gDragPrev) { gPrevAz = ((gDragPrev.az + (e.clientX - gDragPrev.x) * 0.6) % 360 + 360) % 360; return; }
  if (drag) {
    state.az = ((drag.az + (e.clientX - drag.x) * 0.6) % 360 + 360) % 360;
    state.el = clamp(drag.el - (e.clientY - drag.y) * 0.35, 0, 90); syncInputs();
    renderGridView();   // grid compass rotates with the object as you orbit
    return;
  }
  if (e.target !== app.view) return;                                                      // cursor hints
  const q = insetHit(e);
  app.view.style.cursor = !q.inside ? 'default'
    : (q.px < 20 && q.py > PVH - 20) ? 'nesw-resize'
    : (q.py < 24 && q.px > PVW - 50) ? 'pointer' : 'grab';
});
// ── scroll-wheel zoom (orbit view) — render density follows the zoom so cubes stay crisp up close ──
function setZoom(z) {
  state.zoom = clamp(z, 0.8, 10);
  rig.scale.set(state.zoom);
  if (voxMeta && voxMeta.S !== orbitS()) buildOrbitTarget(orbitS());
  voxSig = '';
}
app.view.addEventListener('wheel', (e) => {
  if (insetHit(e).inside) return;                          // the inset is fixed game scale on purpose
  e.preventDefault();
  setZoom(state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
}, { passive: false });
function syncInputs() { $('az').value = state.az | 0; $('azV').textContent = (state.az | 0) + '°'; $('el').value = state.el | 0; $('elV').textContent = (state.el | 0) + '°'; }

// ── controls ──
$('az').oninput = (e) => { state.az = +e.target.value; $('azV').textContent = state.az + '°'; renderGridView(); };   // spin the grid compass with az
$('el').oninput = (e) => { state.el = +e.target.value; $('elV').textContent = state.el + '°'; };
$('taim').oninput = (e) => { state.taim = +e.target.value; $('taimV').textContent = state.taim + '°'; };
$('tdx').oninput = (e) => { state.turretDx = +e.target.value; $('tdxV').textContent = state.turretDx; };
$('tmz').oninput = (e) => { state.mountZ = +e.target.value; $('tmzV').textContent = (state.mountZ > 0 ? '+' : '') + state.mountZ; };
$('viewSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.az = +b.dataset.az; state.el = +b.dataset.el; syncInputs(); renderGridView(); };
$('tpiv').oninput = (e) => { state.turretPivot = +e.target.value; $('tpivV').textContent = state.turretPivot; };
$('blen').oninput = (e) => { state.barrelLen = +e.target.value; $('blenV').textContent = state.barrelLen || 'off'; recarve(); };
$('brad').oninput = (e) => { state.barrelRad = +e.target.value; $('bradV').textContent = state.barrelRad; recarve(); };
$('belev').oninput = (e) => { state.barrelElev = +e.target.value; $('belevV').textContent = state.barrelElev; recarve(); };
$('spin').onchange = (e) => { state.spin = e.target.checked; };
$('dimBox').onchange = (e) => { state.showDimBox = e.target.checked; voxSig = ''; const r = $('boxSizeRow'); if (r) r.style.display = e.target.checked ? '' : 'none'; if (e.target.checked) { boxSyncSliders(); xfSyncSliders(); } };   // SF1 toggle + SF2 sizing panel

// ── SF2: size & place the reference images in the dim box, then Generate the geometry ──
const boxPart = () => (state.part === 'turret' ? 'turret' : 'body');
function boxSyncSliders() {
  const part = boxPart(), foot = footOf(part), layers = (part === 'turret' ? state.turretLayers : state.bodyLayers);
  const p = effPlace(part);
  // Size/place up to the hard 128 voxel ceiling — NOT the current foot/layers. The box may exceed the current
  // grid; Generate grows Resolution/layers to fit so the carve never clamps (owner: "the carve clamps are the problem").
  const set = (id, v, max) => { const el = $(id); if (el) { el.max = String(max); el.value = String(Math.round(v)); } const lv = $(id + 'V'); if (lv) lv.textContent = String(Math.round(v)); };
  set('boxLen', p.bw, 128); set('boxWid', p.bh, 128); set('boxHt', p.Hv, 128);
  set('boxOx', p.ox, Math.max(0, 128 - p.bw)); set('boxOy', p.oy, Math.max(0, 128 - p.bh));
}
function boxEdit(field, val) {
  const part = boxPart(), p = effPlace(part);                    // read the one store…
  p[field] = val;
  setPlace(part, p);                                             // …and write straight back to it, clamped to the grid
  const lv = $({ bw: 'boxLenV', bh: 'boxWidV', Hv: 'boxHtV', ox: 'boxOxV', oy: 'boxOyV' }[field]); if (lv) lv.textContent = String(Math.round(val));
  voxSig = ''; gridModel = null;                                 // 2D box, 3D box and carve all read effPlace → all track
}
if ($('boxLen')) $('boxLen').oninput = (e) => boxEdit('bw', +e.target.value);
if ($('boxWid')) $('boxWid').oninput = (e) => boxEdit('bh', +e.target.value);
if ($('boxHt')) $('boxHt').oninput = (e) => boxEdit('Hv', +e.target.value);
if ($('boxOx')) $('boxOx').oninput = (e) => boxEdit('ox', +e.target.value);
if ($('boxOy')) $('boxOy').oninput = (e) => boxEdit('oy', +e.target.value);
if ($('boxGen')) $('boxGen').onclick = () => {   // re-carve at the current placement
  const part = boxPart();
  setPlace(part, effPlace(part));            // normalise/clamp whatever is in the store, then carve
  gridModel = null; recarve(); scheduleAutosave(); boxSyncSliders();
};
if ($('boxAuto')) $('boxAuto').onclick = () => {   // back to auto-fit
  const part = boxPart(); geomState[part] = { auto: true, bottomFrom: (geomState[part] && geomState[part].bottomFrom) || 'top' };
  gridModel = null; recarve(); scheduleAutosave(); boxSyncSliders();
};

// SF2 per-side ALIGNMENT: select a side, then high-res scale/align sliders stretch & nudge that image.
let boxSide = 'top';
function xfSyncSliders() {
  const xf = imgXf[boxPart()][boxSide] || { sx: 1, sy: 1, ox: 0, oy: 0 };
  const set = (id, v) => { const el = $(id); if (el) el.value = String(v); const lv = $(id + 'V'); if (lv) lv.textContent = (+v).toFixed(3); };
  set('xfSx', xf.sx); set('xfSy', xf.sy); set('xfOx', xf.ox); set('xfOy', xf.oy);
}
if ($('boxSideSeg')) $('boxSideSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; boxSide = b.dataset.v; [...$('boxSideSeg').children].forEach((c) => c.classList.toggle('on', c === b)); xfSyncSliders(); };
function xfEdit(field, val, live) {
  imgXf[boxPart()][boxSide][field] = val;
  const lv = $({ sx: 'xfSxV', sy: 'xfSyV', ox: 'xfOxV', oy: 'xfOyV' }[field]); if (lv) lv.textContent = val.toFixed(3);
  // live drag: redraw the orbit box AND the grid overlay so the slice moves under the cursor.
  // release: re-carve. Previously only voxSig was reset, so the grid never updated while dragging.
  if (live) { voxSig = ''; renderGridView(); }
  else { gridModel = null; recarve(); scheduleAutosave(); }
}
if ($('xfSx')) { $('xfSx').oninput = (e) => xfEdit('sx', +e.target.value, true); $('xfSx').onchange = (e) => xfEdit('sx', +e.target.value, false); }
if ($('xfSy')) { $('xfSy').oninput = (e) => xfEdit('sy', +e.target.value, true); $('xfSy').onchange = (e) => xfEdit('sy', +e.target.value, false); }
if ($('xfOx')) { $('xfOx').oninput = (e) => xfEdit('ox', +e.target.value, true); $('xfOx').onchange = (e) => xfEdit('ox', +e.target.value, false); }
if ($('xfOy')) { $('xfOy').oninput = (e) => xfEdit('oy', +e.target.value, true); $('xfOy').onchange = (e) => xfEdit('oy', +e.target.value, false); }
if ($('xfReset')) $('xfReset').onclick = () => { imgXf[boxPart()][boxSide] = { sx: 1, sy: 1, ox: 0, oy: 0 }; xfSyncSliders(); gridModel = null; recarve(); scheduleAutosave(); };
$('bodyLayers').oninput = (e) => { const was = state.bodyLayers; state.bodyLayers = +e.target.value; $('bodyLayersV').textContent = state.bodyLayers; growSpanZ('body', was); recarve(); };
// ⬛ Cube: make the build volume a true voxel cube driven by the HEIGHT you set — footprint (length×width) snaps
// to match Base layers (owner: "if the height is 64, set base to 64×64"). Footprint is a discrete Resolution, so
// height snaps to the nearest one and both axes end equal. On-screen height is still scaled by Cube height (zScale).
if ($('bodyCube')) $('bodyCube').onclick = () => {
  const res = [32, 48, 64, 96, 128];
  const target = res.reduce((a, b) => Math.abs(b - state.bodyLayers) <= Math.abs(a - state.bodyLayers) ? b : a);
  state.foot = target; if ($('res')) $('res').value = target;      // footprint = height (nearest Resolution)
  setLayers('body', target);                                       // exact cube: layers = foot = target
  syncSizeUI(); recarve();
};
$('turretLayers').oninput = (e) => { const was = state.turretLayers; state.turretLayers = +e.target.value; $('turretLayersV').textContent = state.turretLayers; growSpanZ('turret', was); recarve(); };
$('res').onchange = (e) => { state.foot = +e.target.value; syncSizeUI(); recarve(); };
$('turretRes').onchange = (e) => { state.turretFoot = +e.target.value; syncSizeUI(); recarve(); };   // SF3
// fine world-size control (the VOX_PER_TILE contract): tiles → foot voxels, layers scale along
function syncSizeUI() {
  const t = unitTiles(state.foot);
  $('uSize').value = Math.round(t * 100); $('uSizeV').textContent = t.toFixed(2) + ' t';
  $('res').value = [32, 48, 64, 96, 128].includes(state.foot) ? state.foot : '';
  if ($('turretRes')) {   // SF3: turret footprint readout, in tiles, vs the base
    const tf = state.turretFoot || state.foot;
    $('turretRes').value = [16, 24, 32, 48, 64, 96, 128].includes(tf) ? tf : '';
    if ($('turretResTiles')) $('turretResTiles').textContent = tf === state.foot ? '= base' : (tf / VOX_PER_TILE).toFixed(2) + ' t';
  }
}
function setUnitSize(tiles) {
  const newFoot = clamp(Math.round(tiles * VOX_PER_TILE), 16, 256);
  if (newFoot === state.foot) return;
  const k = newFoot / state.foot;
  state.foot = newFoot;
  setLayers('body', clamp(Math.round(state.bodyLayers * k), 4, MAX_LAYERS));      // keep the proportions
  setLayers('turret', clamp(Math.round(state.turretLayers * k), 3, MAX_LAYERS));
  syncSizeUI(); recarve();
}
$('uSize').oninput = (e) => { $('uSizeV').textContent = (+e.target.value / 100).toFixed(2) + ' t'; };
$('uSize').onchange = (e) => setUnitSize(+e.target.value / 100);          // re-carve on release
// ── .vox import: bring a ready-made voxel model in as the base/turret (skips the carve) ──
// ONE ceiling for every layer count. The Base slider already allowed 128 while the Turret slider and
// all three clamps below stopped at 40, so a turret could never exceed a third of a full-height body
// and a tall imported .vox was silently truncated. setLayers does not clamp -- it writes to the input,
// so the slider's max attribute was the real cap and the JS clamps only compounded it.
// The footprint ceiling, the twin of MAX_LAYERS. Both call sites below read RES_MAX and NOTHING
// declared it, so every geometry-box drag threw ReferenceError on pointermove -- before renderGridView,
// so the cyan box never moved and no span was ever written.
const RES_MAX = 128;
const MAX_LAYERS = 128;
const setLayers = (which, v) => { const id = which === 'body' ? 'bodyLayers' : 'turretLayers'; state[id] = v; $(id).value = v; $(id + 'V').textContent = v; };
function fitToVox() {
  let mx = 0;
  for (const kk of ['body', 'turret']) { const v = voxPart[kk]; if (v) mx = Math.max(mx, v.nx, v.ny); }
  if (!mx) return;
  const res = [32, 48, 64, 96, 128]; state.foot = res.find((r) => r >= mx) || 128; $('res').value = state.foot; if ($('turretRes')) { const _tf = state.turretFoot || state.foot; $('turretRes').value = [16,24,32,48,64,96,128].includes(_tf) ? _tf : ''; }
  if (voxPart.body) setLayers('body', clamp(voxPart.body.nz, 4, MAX_LAYERS));
  if (voxPart.turret) setLayers('turret', clamp(voxPart.turret.nz, 4, MAX_LAYERS));
}
function importVox(part, file) {
  const rd = new FileReader();
  rd.onload = () => {
    try { const m = parseVox(rd.result); voxPart[part] = m; voxB64[part] = null; fitToVox(); recarve();
      $('voxState').innerHTML = `<span class="lock">✓ ${part}: ${m.nx}×${m.ny}×${m.nz} voxels — foot ${state.foot}, ${part} layers ${part === 'body' ? state.bodyLayers : state.turretLayers}</span>`;
    } catch (e) { alert('Could not read that .vox — ' + e.message); }
  };
  rd.readAsArrayBuffer(file);
}
$('voxBody').onchange = (e) => e.target.files[0] && importVox('body', e.target.files[0]);
$('voxTurret').onchange = (e) => e.target.files[0] && importVox('turret', e.target.files[0]);
$('voxClear').onclick = () => { voxPart.body = null; voxPart.turret = null; voxB64.body = null; voxB64.turret = null; recarve(); $('voxState').textContent = 'Cleared — back to the photo carve.'; };
$('exportVox').onclick = exportVox;
$('lightAz').oninput = (e) => { state.lightAz = +e.target.value; $('lightAzV').textContent = state.lightAz + '°'; refreshModel(); drawLight(); };
$('lightK').oninput = (e) => { state.lightK = +e.target.value; $('lightKV').textContent = state.lightK; refreshModel(); };
// #pal handler is defined with #palN below (setPaletteN keeps both sliders in lock-step)
$('zScale').oninput = (e) => { state.zScale = +e.target.value / 100; $('zScaleV').textContent = state.zScale.toFixed(2) + '×'; refreshModel(); };
$('bakeEl').oninput = (e) => {                                     // bake tilt — does NOT invalidate the
  state.bakeEl = +e.target.value;                                  // orbit view, but it DOES stale the bake
  $('bakeElV').textContent = state.bakeEl + '°';
  releaseBaked(state.baked); state.baked = null; $('saveUnit').disabled = true; $('dlSheet').disabled = true;
  $('bakeState').innerHTML = '<span style="color:#e0b060">tilt changed — re-bake before saving</span>';
};
$('bakeScale').oninput = (e) => { state.bakeScale = +e.target.value; $('bakeScaleV').textContent = state.bakeScale + '×'; };
$('partSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (editingDecor && b.dataset.p !== 'body') return; state.part = b.dataset.p; gridSel = null; gridSelVox = null; gridSelView = null; [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b)); renderGridView(); };
// relabel the body's back slot ("Back" ⇄ "Angle ¾") everywhere it appears — the view drop slot AND the
// Slice-a-Sheet destination button — since decor repurposes Back as the optional ¾ view.
function setBackSlotLabel(txt) {
  const bk = document.querySelector('.vpick[data-part="body"][data-view="back"]');
  const s = bk && bk.closest('.vslot') && bk.closest('.vslot').querySelector('.vmeta span');
  if (s) s.textContent = txt;
  const sb = document.querySelector('.slotBtn[data-sp="body"][data-sv="back"]');   // Slice-a-Sheet destination
  if (sb) sb.textContent = txt;
  const decorMode = txt === 'Angle ¾';                                             // only decor exposes the ¾ Angle grid facing
  if ($('gridAngleBtn')) $('gridAngleBtn').style.display = decorMode ? '' : 'none';
  if (!decorMode && gridView === 'angle') { gridView = 'top'; [...$('gridViewSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.v === 'top')); }
}
// decor is a single BODY part — force body-only so the turret placeholder never shows while authoring a prop
function forceDecorBodyOnly() {
  state.part = 'body'; state.cls = 'decor';
  [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.p === 'body'));
  [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === 'decor'));
  setBackSlotLabel('Angle ¾');                        // the Back slot holds the optional 3/4 view for the decor loft
  if (gridView === 'top') { gridView = 'front'; [...$('gridViewSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.v === 'front')); }   // decor's Top is DERIVED, not authored — start on Front
  gridSel = null; gridSelVox = null; gridSelView = null;
  renderGridView();
}

// ── grid-view panel: mode (paint vs geometry) + face selector + z-slice walker ──
if ($('gridModeSeg')) $('gridModeSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; gridMode = b.dataset.m; if (gridMode !== 'geom') gridLayer = 0;   /* PAINT opens on the whole surface projection (layer 0), never wherever Geometry was left */ gridSel = null; gridSelView = null;   /* the dashed rect is per-facing; the voxel SET survives a mode switch so you can keep editing it */ [...$('gridModeSeg').children].forEach((c) => c.classList.toggle('on', c === b)); renderGridView(); };
if ($('gridResetGeo')) $('gridResetGeo').onclick = () => { const part = gridPart(); geomState[part] = { auto: true, bottomFrom: geomState[part].bottomFrom || 'top' }; gridModel = null; recarve(); scheduleAutosave(); };
$('gridViewSeg').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'gridAlignBtn') { gridAlign = !gridAlign; b.classList.toggle('on', gridAlign); renderGridView(); return; }   // ⊞ Align: toggle the dual-projection overlay (keeps the selection)
  gridView = b.dataset.v; gridLayer = 0; gridAlign = false; gridLasso = null; lassoMode = false;
  // TWO-WAY: the Scale/Align sliders edit imgXf[part][boxSide], so boxSide must follow the facing you
  // are viewing or they edit a slice that is not on screen.
  if (['top', 'side', 'front', 'back'].includes(gridView)) {
    boxSide = gridView;
    const ss = $('boxSideSeg'); if (ss) [...ss.children].forEach((c) => c.classList.toggle('on', c.dataset.v === boxSide));
    if (typeof xfSyncSliders === 'function') xfSyncSliders();
  }   // picking a single facing exits Align + the lasso; the voxel selection PERSISTS across facings (paint faces without reselecting)
  gridZoom = 1; gridPanX = 0; gridPanY = 0;   // fresh facing → reset the scroll-wheel zoom
  const ab = $('gridAlignBtn'); if (ab) ab.classList.remove('on');
  [...$('gridViewSeg').children].forEach((c) => c.classList.toggle('on', c === b && c.id !== 'gridAlignBtn')); renderGridView();
};   // views have different col/row dims — a selection can't carry over
$('gridLayer').oninput = (e) => { gridLayer = +e.target.value; renderGridView(); };
// scroll-wheel ZOOM of the grid editor, anchored under the cursor (owner). Wheel down = out, up = in.
$('gridCanvas').addEventListener('wheel', (e) => {
  const g = gridGeom; if (!g || g.align) return;   // align overlay is read-only / self-laid-out
  e.preventDefault();
  const cv = $('gridCanvas'), rect = cv.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (cv.width / rect.width), py = (e.clientY - rect.top) * (cv.height / rect.height);
  const cxu = (px - g.ox) / g.cell, cyu = (py - g.oy) / g.cellV;   // grid-cell coord under the cursor (stays fixed)
  const oldZoom = gridZoom;
  gridZoom = clamp(gridZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 12);
  if (gridZoom === oldZoom) return;
  if (gridZoom <= 1.001) { gridZoom = 1; gridPanX = 0; gridPanY = 0; renderGridView(); return; }   // snap back to centered fit
  const baseCell = g.cell / oldZoom, cell2 = Math.max(1, Math.floor(baseCell * gridZoom));
  const cellV2 = Math.max(1, Math.round(cell2 * (g.zsc || 1)));   // vertical px follows the view's zScale scaling
  const oxC = Math.floor((cv.width - cell2 * g.cols) / 2), oyC = Math.floor((cv.height - cellV2 * g.rows) / 2);
  gridPanX = Math.round(px - cxu * cell2 - oxC);   // keep the pre-zoom cell under the cursor
  gridPanY = Math.round(py - cyu * cellV2 - oyC);
  renderGridView();
}, { passive: false });
// ── SLICE EDITOR (owner 2026-07-17): on the Top view, click/drag to add or erase voxels in the
// current z-layer. Erase removes even source-carved voxels; paint adds using that column's own
// colour (grey for a fresh column — recolour later in the palette window). Edits land in VOL / vcol /
// PAINT, so the orbit preview, side chart, bake and exports all follow. Full model
// rebuild is deferred to pointer-up so painting stays responsive; the grid itself repaints live.
if ($('gridToolSeg')) $('gridToolSeg').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  gridTool = b.dataset.t;
  [...$('gridToolSeg').children].forEach((c) => c.classList.toggle('on', c === b));
  renderGridView();   // sets gridGeom for the current view/layer first
  // Picking a tool that ACTS ON A SELECTION acts immediately when one is live — you already said what you
  // meant by selecting it. Both stay selected afterwards for freehand use.
  if (gridTool === 'erase' && gridSelVox) deleteSelection();
  if (gridTool === 'fill' && gridSelVox) fillSelection();
};
// Clear layer IS deleteCurrentLayer: same cells, same intent. It wrote voxEdit 'del' -- a store the model
// does not read -- so it removed nothing, while deleteCurrentLayer beside it did the job correctly.
if ($('gridClearLayer')) $('gridClearLayer').onclick = () => { deleteCurrentLayer(); };
// ── CARVE TOP / SIDE / FRONT. Each button runs the whole carve (clear -> fill solid -> cut) with the
// cuts enabled cumulatively up to its own slice, so each stage is checkable on its own before the next.
function runCarve(upTo, label) {
  carveCuts.top   = true;
  carveCuts.side  = upTo === 'side' || upTo === 'front';
  carveCuts.front = upTo === 'front';
  const part = gridPart(), foot = footOf(part), layers = gridLayersOf(part);
  // THE EXPLICIT ASK. A Carve button is the artist saying "derive this from the slices again", so it — and
  // only it, plus Reset edits and a flip the artist confirmed — may replace hand work. Both parts, because
  // carveCuts is a whole-unit setting and both carve from it; one Ctrl+Z puts the whole unit back.
  recarveFromSource(['body', 'turret']);
  TRACE = []; recarve(); const steps = TRACE; TRACE = null; renderGridView();
  const m = buildModel(part, foot, layers);
  let n = 0; for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (m.filled(x, y, z)) n++;
  const bb = modelBBox(m.filled, foot, layers);
  const dim = bb.x1 < 0 ? 'EMPTY' : `${bb.x1 - bb.x0 + 1}×${bb.y1 - bb.y0 + 1}×${bb.z1 - bb.z0 + 1}`;
  const on = ['top', carveCuts.side ? 'side' : null, carveCuts.front ? 'front' : null].filter(Boolean).join(' + ');
  const gd = $('gridDims');
  if (gd) { gd.textContent = `${label} → ${n} voxels · ${dim} · grid ${foot}×${foot}×${layers} · cuts: ${on}`;
            gd.style.color = n ? '#8fa7bd' : '#e0625f'; }
  console.info(`[stack-forge] ${label} — cuts: ${on} → ${n} voxels, ${dim}`);
  for (const st of steps) console.info(`    ${String(st.n).padStart(8)}  ${st.label}${st.extra ? '   — ' + st.extra : ''}`);
}
if ($('carveTop'))   $('carveTop').onclick   = () => runCarve('top',   'CARVE TOP');
if ($('carveSide'))  $('carveSide').onclick  = () => runCarve('side',  'CARVE TOP + SIDE');
if ($('carveFront')) $('carveFront').onclick = () => runCarve('front', 'CARVE TOP + SIDE + FRONT');
// Delete the voxels this facing/layer is showing, when there is no selection. Layer 0 is the surface
// raycast, so it removes the facing skin; a real layer removes that slice.
// ── DELETE acts on the CARVED VOLUME. VOL is the model: removing a voxel is VOL[k] = 0, and undo is a
// snapshot of VOL restored wholesale. No overlay, no 'del' sentinel, nothing layered after the carve.
const volHistory = [];
function liveVOL(part) {
  const hit = carveCache[part];
  return hit && hit.m ? hit.m.VOL : null;
}
// ONE ENTRY IS A LIST OF PART SNAPSHOTS, and it captures ALL THREE arrays a part owns: VOL (geometry),
// vcol (colour) and PAINT (who chose that colour). A VOL-only entry made every paint stroke silently
// un-undoable the moment setVox started writing vcol, which is why colour is in here.
//
// WHY A LIST. Entries used to be a single { part, ... }, so a whole-unit operation — the palette remap
// writes body AND turret — pushed one snapshot of the active part and mutated both. Ctrl+Z then restored
// half the model and left the other half remapped, with no way back. An operation declares every part it
// is about to touch and gets exactly ONE entry covering all of them.
function volSnapPart(part) {
  const V = liveVOL(part); if (!V) return null;
  const m = carveCache[part] && carveCache[part].m;
  return { part, snap: V.slice(),
    vcol: m && m.vcol ? m.vcol.slice() : null, paint: m && m.PAINT ? m.PAINT.slice() : null };
}
// SNAPSHOT THE ARRAYS YOU ARE ABOUT TO MUTATE. buildModel can replace carveCache[part].m via the sig
// path, so anything that builds must build FIRST and push SECOND — otherwise the snapshot is of a
// different array than the one the edit then writes, and the undo restores nothing (the mirrorWorld bug).
// ONE LEVEL (owner 2026-08-07: "give me one level of undo for paint and geo" / "Do not make this overly
// complex"). It was 60 deep, and the depth is where both of its bugs lived: volApply's length guard (a
// history entry outliving the dims it was taken at) and the mirror's double push. One slot cannot outlive
// anything, and the undo/redo pair is still a true inverse. The cache is undo ONLY and is never saved —
// what persists is the model, which already carries every edit these snapshots restore.
const MAX_UNDO = 1;
function pushVolParts(parts) {
  const entry = [];
  for (const p of parts) { const s = volSnapPart(p); if (s) { entry.push(s); volDirty[p] = true; } }
  if (!entry.length) return;
  volRedo.length = 0;                                  // a fresh edit forks the timeline — nothing left to redo
  volHistory.push(entry);
  while (volHistory.length > MAX_UNDO) volHistory.shift();
}
function pushVol(part) { pushVolParts([part]); }
// every part a whole-unit operation (palette remap, bake) rewrites — one Ctrl+Z puts the unit back
function pushVolAll() { pushVolParts(['body', 'turret']); }
// ONE HISTORY, AND THE KEYS ARE INVERSES. Undo used to pop volHistory while REDO drove a second, separate
// stack of voxEdit snapshots — so Ctrl+Z and Ctrl+Y were not inverses of each other, and the toolbar
// button undid a third thing while its tooltip claimed Ctrl+Z. Undo now captures the state it is about to
// replace, so redo has something true to restore.
const volRedo = [];
function volApply(h) {
  const cur = [];                                                    // what we are about to overwrite
  for (const e of h) {
    const V = liveVOL(e.part); if (!V) continue;
    const m = carveCache[e.part] && carveCache[e.part].m;
    if (V.length !== e.snap.length) continue;                        // dims changed under the history — skip rather than mis-index
    cur.push(volSnapPart(e.part));
    if (e.vcol && m && m.vcol && m.vcol.length === e.vcol.length) m.vcol.set(e.vcol);
    if (e.paint && m && m.PAINT && m.PAINT.length === e.paint.length) m.PAINT.set(e.paint);
    V.set(e.snap);
  }
  if (!cur.length) return null;
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  return cur;
}
function volUndo() {
  const h = volHistory.pop(); if (!h) return false;
  const cur = volApply(h); if (!cur) return false;
  volRedo.push(cur); while (volRedo.length > MAX_UNDO) volRedo.shift();
  return true;
}
function volRedoStep() {
  const h = volRedo.pop(); if (!h) return false;
  const cur = volApply(h); if (!cur) return false;
  volHistory.push(cur); while (volHistory.length > MAX_UNDO) volHistory.shift();
  return true;
}
// the voxels the current facing/layer is showing (layer 0 = the surface raycast)
function layerKeys(g, V) {
  const N = g.foot * g.foot, out = [];
  const at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < g.foot && y < g.foot && z < g.layers && !!V[z * N + y * g.foot + x];
  for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) {
    if (g.slice === 0) {
      for (let sdep = 0; sdep < g.depth; sdep++) {
        const [x, y, z] = g.toVox(cx, cy, sdep);
        if (at(x, y, z)) { out.push(z * N + y * g.foot + x); break; }
      }
    } else {
      const [x, y, z] = g.toVox(cx, cy, g.slice - 1);
      if (at(x, y, z)) out.push(z * N + y * g.foot + x);
    }
  }
  return out;
}
function deleteCurrentLayer() {
  const g = gridGeom; if (!g || !g.toVox) return false;
  const V = liveVOL(g.part);
  if (!V) { console.warn('[stack-forge] delete: no carved volume — press a Carve button first'); return false; }
  const keys = layerKeys(g, V); if (!keys.length) return false;
  pushVol(g.part);
  for (const k of keys) V[k] = 0;
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  console.info(`[stack-forge] deleted ${keys.length} voxels (${g.slice === 0 ? 'surface' : 'layer ' + g.slice}) — ESC to undo`);
  return true;
}
if ($('gridDeleteBtn')) $('gridDeleteBtn').onclick = () => doDelete();   // identical to DEL
// RESET EDITS = back to the carve, for real. It used to clear voxEdit — a store nothing read — so the
// button cleared nothing while the Palette window's blurb promised "Reset edits restores the source".
// Dropping this part's carve cache is what actually restores it: buildModelRaw re-derives VOL, vcol and a
// zeroed PAINT from the source art on the next build. Snapshot first, so Ctrl+Z brings the work back.
if ($('gridResetEdits')) $('gridResetEdits').onclick = () => {
  const part = gridPart();
  if (!carveCache[part]) { console.warn('[stack-forge] reset edits: nothing carved yet'); return; }
  if (!confirm(`Reset the ${part} to its carve?\n\nEvery hand-deleted / added voxel and every painted colour on this part goes back to what the source art carves. Ctrl+Z undoes it.`)) return;
  recarveFromSource(part);             // snapshots first, then drops the cache → buildModelRaw re-derives
  refreshModel(); renderGridView(); scheduleAutosave();
};
if ($('gridGuides')) $('gridGuides').onchange = (e) => { gridGuides = e.target.checked; renderGridView(); };
if ($('gridOrient')) $('gridOrient').onchange = (e) => { gridOrient = e.target.checked; voxSig = ''; renderGridView(); };   // voxSig: the markers live in the MAIN view too
// MIRROR one half of the current view onto the other, folding across the GRID CENTRE LINE (the ✛ guide),
// NOT the model's content centre — so each half lands symmetric about the centreline (owner: centre the
// model to the guide, then mirror). View-relative via gridGeom.toVox: 'col' folds the vertical centreline
// (visual left↔right), 'row' folds the horizontal centreline (visual top↔bottom). srcLow copies the low
// half (left/top) onto the high half (right/bottom); !srcLow does the reverse.
// WORLD-axis mirror (owner: the old view-relative mirror folded the screen axis, so 'L-R' in the top/side
// view mirrored FRONT↔BACK instead of left↔right). These fold a fixed WORLD axis regardless of facing —
// matching the compass: left↔right = Y, front↔back = X — so a mirror always means what its label says.
function mirrorWorld(axis, srcSecond) {
  const part = gridPart(), foot = footOf(part), layers = gridLayersOf(part), N = foot * foot;
  // ONE undo entry, and it must snapshot the array the mirror then mutates. This pushed TWICE — once
  // here and again after buildModel — so the first Ctrl+Z appeared to do nothing. Worse, buildModel can
  // replace carveCache[part].m via the sig path, so the earlier snapshot could be of a DIFFERENT array
  // than the V captured below. Build first, then snapshot, then mutate.
  const m = buildModel(part, foot, layers);
  const V = liveVOL(part);
  pushVol(part);
  let n = 0;
  const cap = (axis === 'z') ? layers : foot, c2 = cap - 1;
  const coord = (x, y, z) => (axis === 'x' ? x : axis === 'y' ? y : z);
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    const a = coord(x, y, z);
    if (srcSecond ? (a * 2 <= c2) : (a * 2 >= c2)) continue;   // write only the TARGET half
    const sa = c2 - a, sx = axis === 'x' ? sa : x, sy = axis === 'y' ? sa : y, sz = axis === 'z' ? sa : z;
    const k = z * N + y * foot + x;
    // GEOMETRY GOES TO VOL, COLOUR GOES THROUGH setVox. Both branches used to write voxEdit — a store the
    // model does not read — so mirroring changed nothing at all, in either view.
    if (m.filled(sx, sy, sz)) {
      if (!V) continue;
      V[k] = 1;                                                // geometry first, then the colour it carries
      copyVoxColour(part, k, sz * N + sy * foot + sx);         // NOT setVox — see copyVoxColour: marking the
      n++;                                                     // mirrored half PAINTed flattened its side art
    } else if (V && V[k]) { V[k] = 0; n++; }
  }
  gridModel = null; refreshModel(); scheduleAutosave();
  console.info(`[stack-forge] mirrored ${n} voxel(s) on ${axis} — Ctrl+Z to undo`);
}
if ($('gridMirrorLR')) $('gridMirrorLR').onclick = () => mirrorWorld('y', false);   // left↔right (world Y) — bilateral symmetry
if ($('gridMirrorRL')) $('gridMirrorRL').onclick = () => mirrorWorld('y', true);
if ($('gridMirrorTB')) $('gridMirrorTB').onclick = () => mirrorWorld('x', false);   // front↔back (world X)
if ($('gridMirrorBT')) $('gridMirrorBT').onclick = () => mirrorWorld('x', true);
if ($('gridUndoBtn')) $('gridUndoBtn').onclick = () => volUndo();   // same stack as Ctrl+Z, as the tooltip claims
if ($('gridRedoBtn')) $('gridRedoBtn').onclick = () => volRedoStep();
// select every cell on the current layer (a whole-layer selection to paint/erase within)
if ($('gridSelLayer')) $('gridSelLayer').onclick = () => { const g = gridGeom; if (!g) return; gridSel = { c0: 0, r0: 0, c1: g.cols - 1, r1: g.rows - 1 }; gridSelView = gridView; gridSelVox = buildSelVox(true); renderGridView(); };
// delete EVERY voxel in the active selection (the surface voxels on Layer 0, or the slice voxels on a real
// layer). Shared by Delete/Backspace and by pressing Erase while a selection is active.
function deleteSelection() {
  const g = gridGeom; if (!g || !gridSelVox || gridSelVox.part !== g.part || !gridSelVox.set.size) return false;
  const V = liveVOL(g.part);
  if (!V) { console.warn('[stack-forge] delete: no carved volume — press a Carve button first'); return false; }
  let n = 0; for (const k of gridSelVox.set) if (V[k]) n++;
  if (!n) return false;
  pushVol(g.part);                                     // snapshot BEFORE the write — ESC restores it
  for (const k of gridSelVox.set) V[k] = 0;            // VOL IS THE MODEL: a delete is a plain write
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  console.info(`[stack-forge] deleted ${n} selected voxels — ESC to undo`);
  return true;
}
// ONE delete, used by the button and by the DEL key. A selection wins; with none, the current layer goes.
function doDelete() {
  return (gridSelVox && gridSelVox.set && gridSelVox.set.size) ? deleteSelection() : deleteCurrentLayer();
}
// FILL the selection with the current paint colour — recolours EVERY existing voxel in it (on Layer 0, that's
// every facing surface voxel; on a real layer, every filled slice voxel). Never adds voxels.
function fillSelection() {
  const g = gridGeom; if (!gridSelVox || !g || !g.editable || gridSelVox.part !== g.part) return false;
  const N = g.foot * g.foot, rgb = paintRGB();
  let n = 0; const pending = [];
  // recolour the SELECTED voxels whose face this facing shows (the surface voxel per cell)
  for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) { const [x, y, z] = gridTargetVox(g, cx, cy), k = z * N + y * g.foot + x; if (gridSelVox.set.has(k) && gridFilledAt(g, x, y, z)) { pending.push(k); n++; } }
  if (!n) return false;
  const part = gridPart();                      // was unbound — Fill threw a ReferenceError AFTER pushVol,
  pushVol(part);                                // leaving a phantom undo entry and no fill, silently.
  for (const k of pending) setVox(part, k, rgb);
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave(); return true;
}
// 🪣 FILL with NO selection = a paint bucket: flood the contiguous patch of like-coloured surface under
// the cursor, on this facing. Matching is on the DRAWN colour (gridGeom.colAt), not raw vcol, because a
// face coloured by the side sheet and its neighbour are visibly one patch and numerically two.
// TOL is generous on purpose: a photo carve has no flat areas, and a bucket that stops at every
// anti-aliased shade is a bucket nobody uses.
const FILL_TOL2 = 34 * 34;
function floodFillAt(cx0, cy0) {
  const g = gridGeom; if (!g || !g.editable || !g.colAt) return false;
  const N = g.foot * g.foot, rgb = paintRGB(), part = g.part;
  const cellVox = (c, r) => { const v = gridTargetVox(g, c, r); return gridFilledAt(g, v[0], v[1], v[2]) ? v : null; };
  const seed = cellVox(cx0, cy0); if (!seed) return false;
  const seedCol = g.colAt(seed[0], seed[1], seed[2]);
  const near = (c) => { const dr = c[0] - seedCol[0], dg = c[1] - seedCol[1], db = c[2] - seedCol[2]; return dr * dr + dg * dg + db * db <= FILL_TOL2; };
  const seen = new Set([cy0 * g.cols + cx0]), stack = [[cx0, cy0]], keys = [];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const v = cellVox(cx, cy); if (!v) continue;
    if (!near(g.colAt(v[0], v[1], v[2]))) continue;
    keys.push(v[2] * N + v[1] * g.foot + v[0]);
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
      const id = ny * g.cols + nx; if (seen.has(id)) continue;
      seen.add(id); stack.push([nx, ny]);
    }
  }
  if (!keys.length) return false;
  pushVol(part);                                 // ONE entry for the whole flood
  let n = 0; for (const k of keys) if (setVox(part, k, rgb)) n++;
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  console.info(`[stack-forge] filled ${n} voxel(s) from the patch under the cursor`);
  return n > 0;
}
// ONE fill, used by the 🪣 tool, the 🪣 button and Enter/F. A selection wins; with none, flood the patch.
function doFill(cx, cy) {
  if (gridSelVox && gridSelVox.set && gridSelVox.set.size) return fillSelection();
  return (cx == null) ? false : floodFillAt(cx, cy);
}
if ($('gridFill')) $('gridFill').onclick = () => fillSelection();

// ── ✥ MOVE ────────────────────────────────────────────────────────────────────────────────────────
// Translate the selected voxels — geometry AND colour AND their authored flag — by a whole-voxel delta.
// The delta comes from the facing itself (toVox at two cells, differenced), so a drag right in the Side
// view moves along world x and the same drag in Front moves along world y, without this knowing which.
// Voxels pushed off the grid are DROPPED, deliberately: silently clamping them would pile the edge of a
// moved shape into a wall, and there is no correct place to put them.
function moveSelectionCells(dc, dr) {
  const g = gridGeom; if (!g || !g.toVox || !gridSelVox || gridSelVox.part !== g.part || !gridSelVox.set.size) return 0;
  if (!dc && !dr) return 0;
  const a = g.toVox(0, 0, 0), b = g.toVox(dc, dr, 0);
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  if (!dx && !dy && !dz) return 0;
  const part = g.part, foot = g.foot, layers = g.layers, N = foot * foot;
  const V = liveVOL(part), m = carveCache[part] && carveCache[part].m;
  if (!V || !m || !m.vcol) return 0;
  // READ THE WHOLE PAYLOAD FIRST. Source and destination overlap on almost every drag, so clearing as
  // you go eats the voxels you have not copied yet.
  const payload = [];
  for (const k of gridSelVox.set) {
    if (!V[k]) continue;
    const x = k % foot, y = ((k / foot) | 0) % foot, z = (k / N) | 0;
    const nx = x + dx, ny = y + dy, nz = z + dz;
    if (nx < 0 || ny < 0 || nz < 0 || nx >= foot || ny >= foot || nz >= layers) continue;   // off the grid → dropped
    payload.push({ from: k, to: nz * N + ny * foot + nx, rgb: [m.vcol[k * 3], m.vcol[k * 3 + 1], m.vcol[k * 3 + 2]],
      paint: m.PAINT ? m.PAINT[k] : 0 });
  }
  if (!payload.length) return 0;
  pushVol(part);                                 // ONE entry for the whole drag
  for (const k of gridSelVox.set) V[k] = 0;      // clear the ORIGINAL footprint, including anything dropped
  const landed = new Set();
  for (const p of payload) {
    V[p.to] = 1;
    m.vcol[p.to * 3] = p.rgb[0]; m.vcol[p.to * 3 + 1] = p.rgb[1]; m.vcol[p.to * 3 + 2] = p.rgb[2];
    if (m.PAINT) m.PAINT[p.to] = p.paint;        // authored stays authored; carve-derived stays derived
    landed.add(p.to);
  }
  const dropped = gridSelVox.set.size - payload.length;
  gridSelVox = { part, foot, layers, set: landed };   // the selection travels with the voxels
  gridSel = null; gridSelView = null; selEpoch++;
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  console.info(`[stack-forge] moved ${payload.length} voxel(s) by (${dx},${dy},${dz})`
    + (dropped > 0 ? ` — ${dropped} pushed off the grid and dropped` : '') + ' — Ctrl+Z to undo');
  return payload.length;
}
// ── DIAGNOSTIC: report how the source view art (V) maps onto this part's exposed faces, so a misaligned
// image (e.g. front tips reading black in-game) is visible as a coverage gap, not guesswork. Read-only.
function gridDiag() {
  const part = gridPart(), foot = footOf(part), layers = gridLayersOf(part), N = foot * foot;
  const m = buildModel(part, foot, layers), V = m.views, filled = m.filled;
  const F = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && filled(x, y, z);
  const hit = (g, ix, z, mir) => { if (!g || !g.m || ix < 0 || ix >= g.w || z < 0 || z >= g.h) return false; return !!g.m[z * g.w + (mir ? g.w - 1 - ix : ix)]; };
  const ox = (V && V.ox) || 0, oy = (V && V.oy) || 0, z0 = (V && V.z0) || 0;
  const grp = { fx: [0, 0], bx: [0, 0], sy: [0, 0] };            // [exposed faces, faces the art colours]
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1, bz0 = 1e9, bz1 = -1;
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!F(x, y, z)) continue;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
    const zz = z - z0;
    if (!F(x + 1, y, z)) { grp.fx[0]++; if (V && hit(V.front, y - oy, zz, false)) grp.fx[1]++; }         // +x front (barrel tips)
    if (!F(x - 1, y, z)) { grp.bx[0]++; if (V && (V.back ? hit(V.back, y - oy, zz, false) : hit(V.front, y - oy, zz, true))) grp.bx[1]++; }
    if (!F(x, y + 1, z)) { grp.sy[0]++; if (V && hit(V.side, x - ox, zz, false)) grp.sy[1]++; }         // both flanks sample by world x;
    if (!F(x, y - 1, z)) { grp.sy[0]++; if (V && hit(V.side, x - ox, zz, false)) grp.sy[1]++; }         // the camera supplies the mirror
  }
  const artDim = (g) => (g && g.m) ? `${g.w}x${g.h}` : '—none';
  const pct = (a) => a[0] ? `${a[1]}/${a[0]} (${Math.round(100 * a[1] / a[0])}% art, ${a[0] - a[1]} fall back to voxel colour)` : 'none';
  const L = [
    `STACK-FORGE DIAG — part=${part}  foot=${foot}  layers=${layers}`,
    `filled bbox: x[${bx0}..${bx1}] y[${by0}..${by1}] z[${bz0}..${bz1}]`,
    V ? `view art: ox=${ox} oy=${oy} z0=${z0}   front=${artDim(V.front)}  side=${artDim(V.side)}  back=${artDim(V.back)}` : 'view art: NONE (walls use per-voxel colour)',
    `+x front faces (barrel tips):  ${pct(grp.fx)}`,
    `-x back faces:                 ${pct(grp.bx)}`,
    `±y side faces:                 ${pct(grp.sy)}`,
    `front-view index: y-oy over [${by0 - oy}..${by1 - oy}] into 0..${V && V.front ? V.front.w - 1 : '?'}   (out-of-range ⇒ black tips)`,
    `side-view index:  x-ox over [${bx0 - ox}..${bx1 - ox}] into 0..${V && V.side ? V.side.w - 1 : '?'}`,
  ];
  console.log(L.join('\n'));
  alert(L.join('\n'));
}
if ($('gridDiag')) $('gridDiag').onclick = () => gridDiag();
// ── RE-PROJECT: reapply the facing's source image onto its aligned surface by FITTING the image to the
// model's silhouette (not the stored ox/oy — those may be off, which is why sides read as top-layer colour).
// Geometry is untouched; each sampled pixel is SNAPPED to the active (reduced/tuned) palette and baked as
// real paint, so it shows in-game. Masked to the active selection when there is one. Preserves the art's own
// axis convention (across-axis + height→up), so it fixes offset/scale — if it comes out mirrored, that's a
// separate flip to confirm.
function reprojectSurface() {
  const g = gridGeom; if (!g || !g.editable) { alert('Re-project: switch to a paint facing (Top / Front / Side / Back).'); return false; }
  const N = g.foot * g.foot;
  const pal = (gridModel && gridModel.palette) || [];
  const snap = (r, gg, b) => { if (!pal.length) return [r, gg, b]; let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r) * (p[0] - r) + (p[1] - gg) * (p[1] - gg) + (p[2] - b) * (p[2] - b); if (d < bd) { bd = d; bi = i; } } return pal[bi]; };
  const useSelT = gridSelVox && gridSelVox.part === g.part;
  const firstHit1 = (cx, cy) => { for (let s = 0; s < g.depth; s++) { const v = g.toVox(cx, cy, s); if (gridFilledAt(g, v[0], v[1], v[2])) return v; } return null; };
  // ¾ ANGLE view owns NO face (voxels are axis-aligned cubes), so it can't "paint a facing" — instead it
  // PROJECTS a diagonal cut: marquee-select the shape to KEEP, and this marks every filled voxel whose
  // diagonal projection (col = x−y+foot−1, row = layers−1−z) falls OUTSIDE the box for deletion. The button
  // reads "◇ Carve to outline" here; press Delete to remove the marked voxels. An interactive ¾ carve.
  if (gridView === 'angle') {
    const poly = (gridLasso && gridLasso.length >= 3) ? gridLasso : null;   // Story 5: lasso outline wins over the rect
    if (!poly && !gridSel) { alert('Angle carve: draw a ◇ Lasso outline (or drag a ▢ Select box) around the shape to KEEP, then press ◇ Carve to outline.'); return false; }
    const foot = g.foot, layers = g.layers;
    let c0, c1, r0, r1;
    if (!poly) { c0 = Math.min(gridSel.c0, gridSel.c1); c1 = Math.max(gridSel.c0, gridSel.c1); r0 = Math.min(gridSel.r0, gridSel.r1); r1 = Math.max(gridSel.r0, gridSel.r1); }
    const inPoly = (cc, rr) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a.r > rr) !== (b.r > rr)) && (cc < (b.c - a.c) * (rr - a.r) / (b.r - a.r) + a.c)) inside = !inside; } return inside; };
    const keep = poly ? inPoly : (cc, rr) => cc >= c0 && cc <= c1 && rr >= r0 && rr <= r1;
    const outside = new Set();
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!gridFilledAt(g, x, y, z)) continue;
      const col = (x - y) + (foot >> 1), row = layers - 1 - z;   // this voxel's cell in the (centred) Angle projection
      if (!keep(col, row)) outside.add(z * N + y * foot + x);
    }
    if (!outside.size) { alert('Angle carve: every voxel is inside the outline — nothing to remove.'); return false; }
    gridSelVox = { part: g.part, foot: g.foot, layers: g.layers, set: outside }; gridSelView = gridView;   // select the OUTSIDE voxels; Delete removes them
    renderGridView();
    return true;
  }
  // TOP (units) has no side-sheet, and DECOR has no wall art at all (views:null — its colour is the baked
  // per-voxel front+side average). In both cases the source IS the carved vcol: re-project = restore it onto
  // the first face the ray hits, on ANY facing.
  if (gridView === 'top' || !(gridModel && gridModel.views)) {
    const vcol = gridModel && gridModel.vcol; if (!vcol) { alert('Re-project: no carved colour to project.'); return false; }
    const pend = [];
    for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) {
      const v = firstHit1(cx, cy); if (!v) continue;   // first filled voxel the ray hits in this column
      const x = v[0], y = v[1], z = v[2], k = z * N + y * g.foot + x;
      if (useSelT && !gridSelVox.set.has(k)) continue;
      const c = k * 3; pend.push([k, snap(vcol[c], vcol[c + 1], vcol[c + 2])]);
    }
    if (!pend.length) { alert('Re-project: no surface' + (useSelT ? ' in the selection.' : '.')); return false; }
    pushVol(gridPart()); for (const [k, col] of pend) setVox(gridPart(), k, col);
    gridModel = null; refreshModel(); renderGridView(); scheduleAutosave(); return true;
  }
  const V = gridModel && gridModel.views;
  const src = gridView === 'side' ? (V && V.side) : gridView === 'front' ? (V && V.front) : gridView === 'back' ? (V && (V.back || V.front)) : null;
  if (!src || !src.m) { alert('Re-project: no source image for this facing (Top has none).'); return false; }
  // source image content bbox — the drawn pixels only
  let iX0 = 1e9, iX1 = -1, iY0 = 1e9, iY1 = -1;
  for (let iy = 0; iy < src.h; iy++) for (let ix = 0; ix < src.w; ix++) if (src.m[iy * src.w + ix]) { if (ix < iX0) iX0 = ix; if (ix > iX1) iX1 = ix; if (iy < iY0) iY0 = iy; if (iy > iY1) iY1 = iy; }
  if (iX1 < 0) { alert('Re-project: the source image is empty.'); return false; }
  // gather this facing's surface voxels + the model silhouette bbox in the two in-plane WORLD axes (across, z)
  const colAxis = gridView === 'side' ? 'x' : 'y';     // side → world x across; front/back → world y across
  const useSel = gridSelVox && gridSelVox.part === g.part;
  const bothSides = gridView === 'side';               // one side sheet feeds BOTH ±y walls → do left AND right in one pass
  // the surface faces the ray hits: NEAR (from s=0) always; the FAR side too on the Side facing.
  const rayHits = (cx, cy) => {
    const out = [];
    for (let s = 0; s < g.depth; s++) { const v = g.toVox(cx, cy, s); if (gridFilledAt(g, v[0], v[1], v[2])) { out.push(v); break; } }
    if (bothSides) for (let s = g.depth - 1; s >= 0; s--) { const v = g.toVox(cx, cy, s); if (gridFilledAt(g, v[0], v[1], v[2])) { if (!out.length || out[0][0] !== v[0] || out[0][1] !== v[1] || out[0][2] !== v[2]) out.push(v); break; } }
    return out;
  };
  const surf = []; let c0 = 1e9, c1 = -1, r0 = 1e9, r1 = -1;
  for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) {
    for (const v of rayHits(cx, cy)) {                 // FIRST face(s) the ray hits — near (+ far on Side); never interior voxels
      const x = v[0], y = v[1], z = v[2], k = z * N + y * g.foot + x;
      if (useSel && !gridSelVox.set.has(k)) continue;
      const cv = colAxis === 'x' ? x : y;
      if (cv < c0) c0 = cv; if (cv > c1) c1 = cv; if (z < r0) r0 = z; if (z > r1) r1 = z;
      surf.push([k, cv, z]);
    }
  }
  if (!surf.length) { alert('Re-project: no target surface' + (useSel ? ' within the selection.' : '.')); return false; }
  const sampleArt = (ix, iy) => {                     // nearest drawn pixel within a small radius (silhouettes have gaps)
    for (let rad = 0; rad <= 2; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const px = ix + dx, py = iy + dy; if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
      const i = py * src.w + px; if (src.m[i]) return [src.c[i * 3], src.c[i * 3 + 1], src.c[i * 3 + 2]];
    }
    return null;
  };
  const cSpan = Math.max(1, c1 - c0), rSpan = Math.max(1, r1 - r0);
  const pending = [];
  for (const [k, cv, z] of surf) {
    const ix = Math.round(iX0 + ((cv - c0) / cSpan) * (iX1 - iX0));
    const iy = Math.round(iY0 + ((z - r0) / rSpan) * (iY1 - iY0));   // image row 0 = z0 (bottom) → higher z = higher row (matches art)
    const col = sampleArt(ix, iy); if (col) pending.push([k, snap(col[0], col[1], col[2])]);
  }
  if (!pending.length) { alert('Re-project: no colours sampled from the image.'); return false; }
  pushVol(gridPart());
  for (const [k, col] of pending) setVox(gridPart(), k, col);
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  return true;
}
if ($('gridReproj')) $('gridReproj').onclick = () => reprojectSurface();
if ($('gridLassoBtn')) $('gridLassoBtn').onclick = () => { lassoMode = !lassoMode; if (lassoMode) gridLasso = []; else if (gridLasso && gridLasso.length < 3) gridLasso = null; $('gridLassoBtn').classList.toggle('on', lassoMode); renderGridView(); };
// ESC clears the selection; Delete erases it; Enter/F fills it; Ctrl+Z / Ctrl+Y undo/redo
document.addEventListener('keydown', (e) => {
  // NOTHING DESTRUCTIVE REACHES THE MODEL FROM BEHIND A DIALOG. The old guard exempted only INPUT and
  // TEXTAREA and checked one modal by name, so DEL destroyed geometry behind the Save dialog and ESC —
  // whose terminal fallback was volUndo() — silently reverted an edit instead of closing the dialog.
  // ESC no longer mutates anything anywhere; undo is Ctrl+Z.
  if (document.querySelector('[id$="Modal"]:not([hidden])')) return;
  if (e.target && e.target.closest && e.target.closest('input, select, textarea, button')) return;
  if (!$('keyModal') || !$('keyModal').hidden) return;               // don't fight the cutout modal's own ESC
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { volUndo(); e.preventDefault(); return; }   // same undo as ESC
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { volRedoStep(); e.preventDefault(); return; }   // true inverse of Ctrl+Z
  if (e.key === 'Escape' && lassoMode) { lassoMode = false; if (gridLasso && gridLasso.length) gridLasso.pop(); if (gridLasso && !gridLasso.length) gridLasso = null; renderGridView(); }   // ESC backs out of the lasso first
  else if (e.key === 'Escape' && gridLasso) { gridLasso = null; renderGridView(); }   // …then clears a finished lasso
  else if (e.key === 'Escape' && (gridSel || gridSelVox)) { gridSel = null; gridSelVox = null; gridSelView = null; renderGridView(); }
  // ESC NEVER MUTATES. It used to fall through to volUndo(), so dismissing a dialog silently reverted an
  // edit — and because ESC is overloaded four ways, the mutation was the terminal case nobody expected.
  // Undo is Ctrl+Z, and only Ctrl+Z.
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (doDelete()) e.preventDefault(); }   // DEL is the shortcut for the Delete button
  else if ((e.key === 'Enter' || e.key === 'f' || e.key === 'F') && gridSelVox) { if (doFill(null, null)) e.preventDefault(); }
});
(() => {
  const cv = $('gridCanvas'); if (!cv) return;
  let strokeVol = false;   // has THIS stroke already snapshotted VOL? reset on pointerdown
  const editAt = (e, erase) => {
    const g = gridGeom; if (!g || !g.editable) return false;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * (cv.width / r.width), py = (e.clientY - r.top) * (cv.height / r.height);
    const cx = Math.floor((px - g.ox) / g.cell), cy = Math.floor((py - g.oy) / g.cellV);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
    const [x, y, z] = gridTargetVox(g, cx, cy), N = g.foot * g.foot, k = z * N + y * g.foot + x;
    // a selection MASKS editing to the SELECTED VOXELS (not a view rect): pick objects once in Layer 0, then
    // paint their front/side/back faces across facings — corner voxels paint from any view — without reselecting.
    if (gridSelVox && gridSelVox.part === g.part && !gridSelVox.set.has(k)) return false;
    const curFilled = gridFilledAt(g, x, y, z);        // VOL, the model — never an overlay
    if (erase) {
      // ERASE WRITES THE MODEL. It used to write voxEdit 'del', which nothing reads, so nothing
      // disappeared — and because curFilled was read back from that same overlay, the first no-op
      // latched and every retry on the voxel returned false. Same path deleteSelection uses.
      const V = liveVOL(g.part); if (!V || !V[k]) return false;
      if (!strokeVol) { pushVol(g.part); strokeVol = true; }   // ONE undo entry per stroke, not per voxel
      V[k] = 0; return true;
    }
    // BRUSH: recolour a filled voxel, or — on a real layer — spawn one where the cell is empty. Layer 0 is
    // the surface raycast, so there it only ever recolours the facing voxel; spawning there would put a
    // voxel at an arbitrary depth in an empty column.
    else {
      if (!curFilled) {
        if (g.slice === 0) return false;
        const V = liveVOL(g.part); if (!V) return false;
        if (!strokeVol) { pushVol(g.part); strokeVol = true; }
        V[k] = 1;                                     // geometry first: setVox refuses to colour empty space,
      } else if (!strokeVol) { pushVol(g.part); strokeVol = true; }   // which is why the add branch never painted
      setVox(g.part, k, paintRGB());
    }
    renderGridView();                                                // live repaint off the cached carve
    return true;
  };
  // ➕ Add = SURFACE EXTRUDE. Rubber-band a patch of the surface, drag, release → each column in the patch grows
  // one voxel toward the camera (mirror of Delete peeling it), in the current paint colour. On a real Layer slice
  // it just fills that slice's empty cells. Returns true if it added anything.
  const extrudeAddCell = (g, cx, cy, rgb) => {
    let x, y, z;
    if (g.slice === 0) {
      let s0 = -1;
      for (let s = 0; s < g.depth; s++) { const v = g.toVox(cx, cy, s); if (gridFilledAt(g, v[0], v[1], v[2])) { s0 = s; break; } }
      if (s0 === 0) return false;                                    // surface already at the front face — nowhere to grow
      [x, y, z] = g.toVox(cx, cy, s0 > 0 ? s0 - 1 : g.depth - 1);    // one step toward camera; empty column seeds at the ground plane
    } else [x, y, z] = g.toVox(cx, cy, g.slice - 1);
    const N = g.foot * g.foot, k = z * N + y * g.foot + x;
    const curFilled = gridFilledAt(g, x, y, z);                       // VOL, never the overlay
    if (curFilled) return false;                                     // only spawn on EMPTY cells
    // ADD WRITES THE MODEL. It used to set voxEdit only, so the voxel never appeared anywhere. The colour
    // is seeded into vcol at the same time or the new voxel ships BLACK — the carve fills vcol only where
    // the carve itself filled, and nothing else writes it for a spawned cell.
    const V = liveVOL(g.part);
    if (!V) return false;
    V[k] = 1;                                                        // geometry first — setVox refuses to colour empty space
    setVox(g.part, k, rgb.slice());                                  // the spawned voxel owns its colour
    return true;
  };
  const commitAddBox = () => {
    const g = gridGeom, b = gridAddBox; if (!g || !b) return;
    const c0 = clamp(Math.min(b.c0, b.c1), 0, g.cols - 1), c1 = clamp(Math.max(b.c0, b.c1), 0, g.cols - 1);
    const r0 = clamp(Math.min(b.r0, b.r1), 0, g.rows - 1), r1 = clamp(Math.max(b.r0, b.r1), 0, g.rows - 1);
    const rgb = paintRGB(); let any = false;
    if (liveVOL(g.part)) pushVol(g.part);                            // ONE undo entry for the whole patch
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) if (extrudeAddCell(g, cx, cy, rgb)) any = true;
    if (any) { gridModel = null; refreshModel(); scheduleAutosave(); }
    return any;
  };
  let painting = false, dirty = false, boxing = null, addBoxing = null;   // addBoxing: the ➕ Add surface-extrude rubber-band
  let moveDrag = null;                                                   // ✥ Move: { c0, r0 } — the cell the drag started on
  const cellOf = (e) => { const g = gridGeom; if (!g) return null; const { px, py } = ptCell(e); return { cx: clamp(Math.floor((px - g.ox) / g.cell), 0, g.cols - 1), cy: clamp(Math.floor((py - g.oy) / g.cellV), 0, g.rows - 1) }; };
  // ── GEOMETRY drag (owner 2026-07-18): in Geometry mode, drag the box edges to stretch a dimension or
  // the interior to move it. Edits write the shared world-axis spans in geomState, so linked views move
  // in lock-step. On first edit we snapshot the current auto spans and flip auto→false. The uncolored
  // carve re-runs on pointer-up (heavy); the box + silhouette track live off geomState.
  const capOf = (a, foot, layers) => (a === 'z' ? layers : foot);
  const ensureGeomSpans = () => {                                   // freeze current placement into geomState, editable
    const part = gridGeom.part, gs = geomState[part];
    if (!gs.spanX && gridModel && gridModel.sp) { gs.spanX = { ...gridModel.sp.spanX }; gs.spanY = { ...gridModel.sp.spanY }; gs.spanZ = { ...gridModel.sp.spanZ }; }
    gs.auto = false;
  };
  const ptCell = (e) => { const r = cv.getBoundingClientRect(); return { px: (e.clientX - r.left) * (cv.width / r.width), py: (e.clientY - r.top) * (cv.height / r.height) }; };
  const geomHit = (e) => {
    const g = gridGeom && gridGeom.geom; if (!g) return null;
    const { px, py } = ptCell(e), T = Math.max(6, g.cell * 0.6);
    const onX = px >= g.bx - T && px <= g.bx + g.bw + T, onY = py >= g.by - T && py <= g.by + g.bh + T;
    if (!onX || !onY) return null;
    if (Math.abs(px - g.bx) < T) return 'L';
    if (Math.abs(px - (g.bx + g.bw)) < T) return 'R';
    if (Math.abs(py - g.by) < T) return 'T';
    if (Math.abs(py - (g.by + g.bh)) < T) return 'B';
    if (px > g.bx && px < g.bx + g.bw && py > g.by && py < g.by + g.bh) return 'move';
    return null;
  };
  // Drag one edge and ONLY that edge moves; the opposite is pinned. Grab the interior to move the whole
  // slice. Both are proven in node (56 cases): the dragged edge lands under the cursor, the pinned edge
  // does not move, and the width floor matches the sx clamp so the two can never fight.
  let sliceDrag = null;
  const sliceHit = (e) => {
    const q = gridGeom && gridGeom.sliceBox; if (!q) return null;
    const { px, py } = ptCell(e), T = 7;
    if (px < q.L - T || px > q.R + T || py < q.T - T || py > q.B + T) return null;
    const nL = Math.abs(px - q.L) <= T, nR = Math.abs(px - q.R) <= T;
    const nT = Math.abs(py - q.T) <= T, nB = Math.abs(py - q.B) <= T;
    if (nT && nL) return 'TL'; if (nT && nR) return 'TR';
    if (nB && nL) return 'BL'; if (nB && nR) return 'BR';
    if (nL) return 'L'; if (nR) return 'R'; if (nT) return 'T'; if (nB) return 'B';
    return 'move';
  };
  const sliceMove = (e) => {
    const q = gridGeom && gridGeom.sliceBox; if (!q || !sliceDrag) return;
    const { px, py } = ptCell(e), xf = imgXf[q.part][q.view], d = sliceDrag;
    if (d.mode === 'move') {
      xf.ox = clamp(d.ox0 + (px - d.px0) / q.bw, -2, 2);
      xf.oy = clamp(d.oy0 + (py - d.py0) / q.bh, -2, 2);
    } else {
      if (d.mode.includes('L') || d.mode.includes('R')) {
        const isR = d.mode.includes('R'), pin = isR ? d.L : d.R, minW = q.bw * 0.05;
        const t = isR ? Math.max(px, pin + minW) : Math.min(px, pin - minW);
        const lo = Math.min(pin, t), hi = Math.max(pin, t);
        xf.sx = clamp((hi - lo) / q.bw, 0.05, 8);
        xf.ox = clamp(((lo + hi) / 2 - q.bx) / q.bw - 0.5, -2, 2);
      }
      if (d.mode.includes('T') || d.mode.includes('B')) {
        const isB = d.mode.includes('B'), pin = isB ? d.T : d.B, minH = q.bh * 0.05;
        const t = isB ? Math.max(py, pin + minH) : Math.min(py, pin - minH);
        const lo = Math.min(pin, t), hi = Math.max(pin, t);
        xf.sy = clamp((hi - lo) / q.bh, 0.05, 8);
        xf.oy = clamp(((lo + hi) / 2 - q.by) / q.bh - 0.5, -2, 2);
      }
    }
    xfSyncSliders(); voxSig = ''; renderGridView();
  };
  let geomDrag = null;                                             // { mode, gc0, gr0, cR0, rR0 }
  const gridRectFromSpans = (g) => {
    const gs = geomState[gridGeom.part];
    const rng = (info) => { const s = gs[spanKey[info.axis]], cap = capOf(info.axis, g.foot, g.layers); return info.flip ? { lo: cap - s.hi, hi: cap - s.lo } : { lo: s.lo, hi: s.hi }; };
    return { cR: rng(g.col), rR: rng(g.row) };
  };
  const spansFromGridRect = (g, cR, rR) => {
    const gs = geomState[gridGeom.part];
    // Drag an edge to a screen cell and land the SPAN exactly there, growing the grid when the drag goes
    // past it. Order matters and is what three earlier attempts got wrong: UNFLIP first, with the pivot the
    // box was DRAWN with, THEN grow, THEN clamp. Growing in screen space cannot work — on a reversed axis
    // (side/front/back rows are z, flip:true) the screen coordinate DECREASES as the span grows, so a
    // max(lo,hi) test never fires and the clamp pins you at the grid edge. Proven in node over all four
    // views x both axes: 56 cases covering exact landing, growth past the grid, shrink into the grid, and
    // ceiling/inversion guards.
    const put = (info, lo, hi) => {
      const capOld = capOf(info.axis, g.foot, g.layers);
      let sp = info.flip ? { lo: capOld - Math.round(hi), hi: capOld - Math.round(lo) }
                         : { lo: Math.round(lo), hi: Math.round(hi) };
      if (sp.hi < sp.lo) sp = { lo: sp.hi, hi: sp.lo };
      const capNew = clamp(Math.max(capOld, sp.hi, 1), 1, info.axis === 'z' ? MAX_LAYERS : RES_MAX);   // per-axis ceiling
      if (capNew > capOld) growAxis(gridGeom.part, info.axis, capNew);
      const lo2 = clamp(sp.lo, 0, capNew - 1), hi2 = clamp(sp.hi, lo2 + 1, capNew);
      gs[spanKey[info.axis]] = { lo: lo2, hi: hi2 };
    };
    put(g.col, cR.lo, cR.hi); put(g.row, rR.lo, rR.hi);
  };
  const geomMove = (e) => {
    const g = gridGeom.geom; if (!g || !geomDrag) return;
    const { px, py } = ptCell(e), gc = (px - g.ox) / g.cell, gr = (py - g.oy) / g.cellV;
    let { cR, rR } = gridRectFromSpans(g);
    if (geomDrag.mode === 'move') {
      const dcx = Math.round(gc - geomDrag.gc0), dcy = Math.round(gr - geomDrag.gr0);
      const cw = geomDrag.cR0.hi - geomDrag.cR0.lo, rh = geomDrag.rR0.hi - geomDrag.rR0.lo;
      let cl = clamp(geomDrag.cR0.lo + dcx, 0, g.foot - cw), rl = clamp(geomDrag.rR0.lo + dcy, 0, (g.row.axis === 'z' ? g.layers : g.foot) - rh);
      cR = { lo: cl, hi: cl + cw }; rR = { lo: rl, hi: rl + rh };
    } else if (geomDrag.mode === 'L') cR.lo = gc;
    else if (geomDrag.mode === 'R') cR.hi = gc;
    else if (geomDrag.mode === 'T') rR.lo = gr;
    else if (geomDrag.mode === 'B') rR.hi = gr;
    spansFromGridRect(g, cR, rR);
    renderGridView();                                              // box + silhouette track live; carve re-runs on release
  };
  cv.addEventListener('pointerdown', (e) => {
    // SHIFT / CTRL band — FIRST, ahead of the slice handles, the geometry box and every tool. Selecting
    // mutates nothing, so no edit gate applies to it and it must work in every mode, facing and layer.
    // (It sat after the geometry-box branch, whose `if (!mode) return` swallowed the click, so Geometry
    // mode could neither make nor trim a selection.) A held modifier means "select", never "drag".
    //   SHIFT = ADD to the shared set (cyan). A single-cell SHIFT click TOGGLES — that is how you
    //           deselect one voxel. Dragging again adds; it never replaces.
    //   CTRL  = TRIM the set (red). Removes keys from the SELECTION only; carve geometry is untouched.
    if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.button !== 2 && selectableGrid()) {
      const c = cellOf(e); if (!c) return;
      selBoxing = { c0: c.cx, r0: c.cy, c1: c.cx, r1: c.cy, mode: (e.ctrlKey || e.metaKey) ? 'trim' : 'add' };
      renderGridView(); cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (gridGeom && gridGeom.sliceBox) {                           // Geometry mode: SLICE handles win
      const sm = sliceHit(e);
      if (sm) {
        const q = gridGeom.sliceBox, xf = imgXf[q.part][q.view] || { sx: 1, sy: 1, ox: 0, oy: 0 };
        const { px, py } = ptCell(e);
        sliceDrag = { mode: sm, L: q.L, R: q.R, T: q.T, B: q.B, ox0: xf.ox || 0, oy0: xf.oy || 0, px0: px, py0: py };
        dirty = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
    }
    if (gridGeom && gridGeom.geom) {                               // Geometry mode: box drag
      const mode = geomHit(e); if (!mode) return;
      ensureGeomSpans();
      const g = gridGeom.geom, { px, py } = ptCell(e), r = gridRectFromSpans(g);
      geomDrag = { mode, gc0: (px - g.ox) / g.cell, gr0: (py - g.oy) / g.cellV, cR0: r.cR, rR0: r.rR };
      dirty = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (!gridGeom || !gridGeom.editable) return;
    if (lassoMode && e.button !== 2) {                             // ◇ Angle lasso: click points; click near the first to close
      const c = cellOf(e); if (!c) return;
      if (!gridLasso) gridLasso = [];
      if (gridLasso.length >= 3 && Math.hypot(gridLasso[0].c - c.cx, gridLasso[0].r - c.cy) < 1.6) { lassoMode = false; if ($('gridLassoBtn')) $('gridLassoBtn').classList.remove('on'); }
      else gridLasso.push({ c: c.cx, r: c.cy });
      renderGridView(); e.preventDefault(); return;
    }
    // DELETE with a SELECTION active → delete the selected voxels on the CURRENT layer (Layer 0 cuts the whole
    // column through, after a confirm). Deliberately one layer at a time: walk the Layer slider and delete again;
    // an already-empty layer just no-ops (no stuck loop). Right-click still freehand-deletes within the selection.
    if (gridTool === 'erase' && gridSelVox && e.button !== 2) { deleteSelection(); e.preventDefault(); return; }
    if (gridTool === 'fill' && e.button !== 2) {                   // 🪣 Fill: the selection if there is one, else the patch under the cursor
      const c = cellOf(e); doFill(c ? c.cx : null, c ? c.cy : null); e.preventDefault(); return;
    }
    if (gridTool === 'move' && e.button !== 2) {                   // ✥ Move: drag the selection; the model is written on release
      if (!gridSelVox || gridSelVox.part !== gridGeom.part || !gridSelVox.set.size) {
        console.warn('[stack-forge] move: select some voxels first (▢ Select, or SHIFT-drag)'); return;
      }
      const c = cellOf(e); if (!c) return;
      moveDrag = { c0: c.cx, r0: c.cy }; moveGhost = { part: gridGeom.part, dc: 0, dr: 0 };
      cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (gridTool === 'box' && e.button !== 2) {                    // ▢ Select: rubber-band a persistent selection
      const c = cellOf(e); if (!c) return;
      boxing = { c0: c.cx, r0: c.cy, c1: c.cx, r1: c.cy }; gridBoxSel = boxing; renderGridView();
      cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (gridTool === 'add' && e.button !== 2) {                    // ➕ Add: rubber-band a surface patch → extrude on release
      const c = cellOf(e); if (!c) return;
      addBoxing = { c0: c.cx, r0: c.cy, c1: c.cx, r1: c.cy }; gridAddBox = addBoxing; renderGridView();
      cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    strokeVol = false;                                             // new stroke → one fresh VOL snapshot
    // Only 🖌 Brush and 🗑 Delete reach here — Select / Move / Fill / Add all returned above. The old
    // expression still tested for 'box' and 'add', which had been unreachable since they grew their own
    // branches; keeping dead alternatives in a boolean is how the next tool ends up silently erasing.
    const erase = gridTool === 'erase' || e.button === 2;           // right-drag erases whatever the tool is
    if (editAt(e, erase)) { painting = true; dirty = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); }   // editAt/strokeVol already took ONE snapshot for this stroke
  });
  cv.addEventListener('pointermove', (e) => {
    if (sliceDrag) sliceMove(e);
    else if (moveDrag) { const c = cellOf(e); if (c && moveGhost) { moveGhost.dc = c.cx - moveDrag.c0; moveGhost.dr = c.cy - moveDrag.r0; renderGridView(); } }
    else if (selBoxing) { const c = cellOf(e); if (c) { selBoxing.c1 = c.cx; selBoxing.r1 = c.cy; renderGridView(); } }
    else if (geomDrag) geomMove(e);
    else if (addBoxing) { const c = cellOf(e); if (c) { addBoxing.c1 = c.cx; addBoxing.r1 = c.cy; gridAddBox = addBoxing; renderGridView(); } }
    else if (boxing) { const c = cellOf(e); if (c) { boxing.c1 = c.cx; boxing.r1 = c.cy; gridBoxSel = boxing; renderGridView(); } }
    else if (painting) editAt(e, gridTool === 'erase' || !!(e.buttons & 2));   // right-drag mid-stroke still erases
  });
  const finish = () => {
    if (moveDrag) {                                                // ✥ Move: ONE write, ONE undo entry, on release
      const g = moveGhost; moveDrag = null; moveGhost = null;
      if (g && (g.dc || g.dr)) moveSelectionCells(g.dc, g.dr); else renderGridView();
      return;
    }
    if (selBoxing) {                                               // release a SHIFT/CTRL band → update the shared selection
      const g = gridGeom, band = selBoxing; selBoxing = null;
      if (selectableGrid()) {
        // a single-cell SHIFT click TOGGLES — that is how you deselect one voxel without the CTRL band
        const single = band.mode === 'add' && band.c0 === band.c1 && band.r0 === band.r1;
        const n = band.mode === 'trim' ? selTrimRect(g, band)
                : single && selCellState(g, band.c0, band.r0) === 2 ? -selTrimRect(g, band)
                : selAddRect(g, band);
        gridSel = null; gridSelView = null;                        // the dashed rect belonged to a single facing; the SET is the state
        console.info(`[stack-forge] ${n < 0 ? 'deselected ' + -n : (band.mode === 'trim' ? 'trimmed ' : 'selected ') + n} voxel(s) — selection now ${gridSelVox ? gridSelVox.set.size : 0}`);
      }
      voxSig = ''; renderGridView(); return;                       // voxSig reset so the 3D view re-outlines
    }
    if (addBoxing) {                                               // ➕ Add: release → extrude the surface patch in the paint colour
      commitAddBox();                                            // takes its own single snapshot for the patch
      addBoxing = null; gridAddBox = null; renderGridView();
    }
    if (boxing) {                                                  // release the marquee → PERSISTENT selection (stays until ESC)
      gridSel = { c0: Math.min(boxing.c0, boxing.c1), r0: Math.min(boxing.r0, boxing.r1), c1: Math.max(boxing.c0, boxing.c1), r1: Math.max(boxing.r0, boxing.r1) };
      gridSelView = gridView; gridSelVox = buildSelVox();   // freeze to voxels so the selection persists across facings
      boxing = null; gridBoxSel = null; renderGridView();
    }
    if (sliceDrag) { sliceDrag = null; dirty = false; gridModel = null; recarve(); renderGridView(); scheduleAutosave(); return; }
    painting = false; geomDrag = null; if (dirty) { dirty = false; gridModel = null; refreshModel(); scheduleAutosave(); }  // full re-carve on release
  };
  cv.addEventListener('pointerup', finish);
  cv.addEventListener('pointercancel', finish);
  cv.addEventListener('contextmenu', (e) => { if (gridGeom && (gridGeom.editable || gridGeom.geom)) e.preventDefault(); });   // right-drag = erase (paint)
})();
// keep the grid canvas buffer matched to its displayed size so resizing stays crisp, and re-render
if (window.ResizeObserver) {
  const gcv = $('gridCanvas');
  new ResizeObserver(() => {
    const w = Math.max(1, Math.round(gcv.clientWidth)), h = Math.max(1, Math.round(gcv.clientHeight));
    if (gcv.width !== w || gcv.height !== h) { gcv.width = w; gcv.height = h; renderGridView(); }
  }).observe(gcv);
}
// drag a floating window by its header (resize is the native CSS corner handle)
function makeDraggable(panelId, handleId) {
  const p = $(panelId), h = $(handleId); if (!p || !h) return;
  let dx = 0, dy = 0, drag = false;
  h.addEventListener('pointerdown', (e) => { drag = true; const r = p.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; h.setPointerCapture(e.pointerId); e.preventDefault(); });
  h.addEventListener('pointermove', (e) => { if (!drag) return; const s = (p.offsetParent || document.body).getBoundingClientRect(); p.style.left = Math.max(0, e.clientX - s.left - dx) + 'px'; p.style.top = Math.max(0, e.clientY - s.top - dy) + 'px'; });
  h.addEventListener('pointerup', () => { drag = false; });
}
makeDraggable('gridPanel', 'gridDrag');
makeDraggable('scalePanel', 'scaleDrag');
// the Scale chart grows as tall as it needs (renderScaleChart sets its height) and the panel scrolls;
// keep its buffer width matched to the panel so it stays crisp and re-lays out on resize.
if (window.ResizeObserver && $('scaleScroll')) {
  const ss = $('scaleScroll'), scv = $('scaleChart');
  new ResizeObserver(() => { const w = Math.max(140, Math.round(ss.clientWidth)); if (scv.width !== w) scv.width = w; renderScaleChart(); }).observe(ss);
}
$('clsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.cls = b.dataset.c; [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };

// ── orthographic view pickers: 4 thumbnails per part; click to browse OR hover + Ctrl+V to paste ──
const VIEWS = ['top', 'side', 'front', 'back'];
document.querySelectorAll('.views').forEach((box) => {
  box.innerHTML = VIEWS.map((v) => `<div class="vslot"><label class="vpick" data-part="${box.dataset.part}" data-view="${v}"><canvas width="128" height="84"></canvas><input type="file" accept="image/*"></label><div class="vmeta"><span>${v[0].toUpperCase() + v.slice(1)}</span><span class="fl"><button type="button" class="flip keybtn" title="Tune cutout outline">✂</button>${v === 'top' ? '<button type="button" class="flip" data-rot="1" title="Rotate 90° clockwise">⟳</button>' : ''}<button type="button" class="flip" data-axis="h" title="Flip horizontal">⇔</button><button type="button" class="flip" data-axis="v" title="Flip vertical">⇕</button></span></div></div>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.flip'); if (!btn) return;
    e.preventDefault(); const pick = btn.closest('.vslot').querySelector('.vpick');
    if (btn.classList.contains('keybtn')) { openKeyModal(pick.dataset.part, pick.dataset.view); return; }
    if (btn.dataset.rot) { toggleRot(pick.dataset.part, pick.dataset.view); return; }
    toggleFlip(pick.dataset.part, pick.dataset.view, btn.dataset.axis);
  });
});
const pickFor = (part, view) => document.querySelector(`.vpick[data-part="${part}"][data-view="${view}"]`);
function setView(pick, im) {
  const part = pick.dataset.part, view = pick.dataset.view;
  voxPart[part] = null; voxB64[part] = null;                                  // photos override an imported .vox
  srcImg[part][view] = im; flipState[part][view] = { h: false, v: false };   // new image → clear flips
  rotState[part][view] = 0;
  keyTolState[part][view] = 75; polyState[part][view] = null; pickState[part][view] = [];   // …and reset the cutout tuning
  imgURLCache[part][view] = null;
  renderView(pick);
}
function renderView(pick) {
  const part = pick.dataset.part, view = pick.dataset.view, src = srcImg[part][view];
  if (!src) return;
  // Flip in DISPLAY space: the top view can be ROTATED (only view with ⟳), and flipping the SOURCE
  // then rotating made ⇕ come out as a left/right mirror on a 90/270 view (owner bug). Under a quarter
  // turn the on-screen axes swap, so apply the button's flip to the source axis that becomes it —
  // matching toggleFlip's dispAxis convention. No-op on un-rotated views.
  const fl = flipState[part][view];
  const rot = rotState[part][view] || 0, swap = !!(rot % 180);
  const fh = swap ? fl.v : fl.h, fv = swap ? fl.h : fl.v;
  const flipped = (fl.h || fl.v) ? flipCanvas(src, fh, fv) : src;
  const im = rot ? rotCanvas(flipped, rot) : flipped;
  imgs[part][view] = im;
  const g = pick.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 128, 84); drawFit(g, keyedCanvas(im, keyTolState[part][view], polyState[part][view], pickState[part][view]), 128, 84);
  pick.classList.add('set'); updateFlipBtns(pick);
  if (!bulkLoad) recarve();                                             // restore rebuilds once at the end
}
function toggleFlip(part, view, axis) {
  if (!srcImg[part][view]) return;
  flipState[part][view][axis] = !flipState[part][view][axis];
  const polys = polyState[part][view], im = srcImg[part][view];              // keep the shapes on the subject
  // polys live in DISPLAY space (post-flip, post-rot); a pre-rot flip shows up on screen on the
  // other axis when the view is rotated 90/270, and display dims are the source dims swapped
  const rot = rotState[part][view] || 0, swap = !!(rot % 180);
  const W = swap ? im.height : im.width, H = swap ? im.width : im.height;
  const dispAxis = swap ? (axis === 'h' ? 'v' : 'h') : axis;
  const mirror = (pt) => { if (dispAxis === 'h') pt[0] = W - 1 - pt[0]; else pt[1] = H - 1 - pt[1]; };
  const p0 = (polys && polys[0] && polys[0].pts[0]) ? JSON.stringify(polys[0].pts[0]) : 'none';   // diag, see below
  if (polys) for (const q of polys) for (const pt of q.pts) mirror(pt);
  // The eyedropper picks carry a POINT as well as a colour — pt seeds an interior region the border
  // flood cannot reach (keyBackground:seedPts). Those points live in the same DISPLAY space as the
  // polys, so a flip must mirror them too. Mirroring only the polys left the picks seeding the
  // ORIGINAL side of the image: the picture flipped and the cutout did not follow it.
  const picks = pickState[part][view];
  if (picks) for (const q of picks) if (q && q.pt) mirror(q.pt);
  // THE SLICE'S PLACEMENT MUST MIRROR TOO. xfCanvas centres the slice at fraction (0.5 + ox) of the box
  // face, so mirroring the face maps f → 1−f and ox must become −ox. Without this the picture flipped
  // inside a cut-out that stayed put: art mirrored, the region it carves did not follow it. Most visible
  // on a turret, where the slice adjusters have usually pushed ox off zero. Scale is unsigned — a mirror
  // does not change how big the slice is, only which side of centre it sits on.
  const xf = (imgXf[part] || {})[view];
  if (xf) { if (dispAxis === 'h') xf.ox = -(xf.ox || 0); else xf.oy = -(xf.oy || 0); }
  // TEMPORARY DIAGNOSTIC (owner: "flip moves the image, not the polygon cutout"). Running toggleFlip
  // headlessly shows the polys DO mirror, so this reports what actually happens in the browser: how many
  // shapes exist, and the first vertex before → after. If npoly=0 the shape is not in polyState at all
  // (the cutout is the chroma key, not a polygon); if x does not change, something is restoring it.
  console.info('[flip]', part, view, 'axis', axis, '→disp', dispAxis, 'W', W, 'H', H,
    '| polys', polys ? polys.length : 0, polys && polys[0] ? `pt0 ${p0} → ${JSON.stringify(polys[0].pts[0])}` : '',
    '| picks', picks ? picks.length : 0, '| ox', xf ? xf.ox : 'n/a');
  // A flip on a CARVING view (top/side/front) re-mirrors the carve, but grid-view voxel edits are stored at
  // ABSOLUTE coordinates and don't move with it — old edits then linger as duplicated / misplaced voxels
  // (owner 2026-07-20: "view flip → geometry duplication"). Offer to recarve this part (reset its edits) so
  // the grid view stays 100% consistent with the new carve. Back is colour-only → never touches geometry.
  // The dirty flag is the honest test now. It used to ask `voxEdit[part].size` — a store nothing wrote to
  // any more — so the warning had stopped firing on the very edits it exists to protect. And it snapshotted
  // gridPart(), not `part`, so flipping the inactive part's art pushed an undo entry for the wrong one.
  if (view !== 'back' && volDirty[part] &&
      confirm(`Flip re-carves the ${part}. Its hand edits (deleted/added voxels, painted colour) are pinned to the OLD carve and will not line up.\n\nOK = recarve this part (discard those edits — Ctrl+Z brings them back)\nCancel = keep them (they may not line up)`)) {
    recarveFromSource(part);
  }
  renderView(pickFor(part, view));
}
function toggleRot(part, view) {
  if (!srcImg[part][view]) return;
  const old = rotState[part][view] || 0;
  rotState[part][view] = (old + 90) % 360;
  const polys = polyState[part][view];
  if (polys) {                                                               // 90° CW in display space: (x,y) → (H−1−y, x)
    const im = srcImg[part][view], H = (old % 180) ? im.width : im.height;
    for (const q of polys) for (const p of q.pts) { const x = p[0]; p[0] = H - 1 - p[1]; p[1] = x; }
  }
  renderView(pickFor(part, view));
}
function updateFlipBtns(pick) {
  const part = pick.dataset.part, view = pick.dataset.view;
  const fl = flipState[part][view], slot = pick.closest('.vslot'); if (!slot) return;
  slot.querySelector('.flip[data-axis="h"]').classList.toggle('on', fl.h);
  slot.querySelector('.flip[data-axis="v"]').classList.toggle('on', fl.v);
  const rb = slot.querySelector('.flip[data-rot]');
  if (rb) { const rot = rotState[part][view] || 0; rb.classList.toggle('on', !!rot); rb.textContent = rot ? rot + '°' : '⟳'; rb.title = rot ? `Rotated ${rot}° — click for ${(rot + 90) % 360 || 'no'}°` : 'Rotate 90° clockwise'; }
}
// ── cutout tuner: modal with a live keyed preview, per-image sensitivity slider + polygon shapes.
// workPolys = closed shapes ({pts, cut}); workPoly = the shape being drawn; polyCut = mode for it. ──
let keyTarget = null, workPolys = [], workPoly = [], polyDrawing = false, polyCut = false, keyScale = 1;
// zoom/pan viewport for the cutout tuner: keyScale = fit scale (image→canvas), keyZoom ≥1 magnifies, and
// keyPan{X,Y} is the top-left of the visible region in IMAGE px. Effective scale = keyScale·keyZoom.
let keyZoom = 1, keyPanX = 0, keyPanY = 0;
// eyedropper "touch to remove": workPicks = [{col:[r,g,b], pt:[x,y]}] sampled from the ORIGINAL image;
// pickMode arms the next canvas click to sample instead of drawing a polygon. keyOrig caches the raw
// (un-keyed) pixels so a pick reads the true source colour, not the already-keyed preview.
let workPicks = [], pickMode = false, keyOrig = null;
const clonePicks = (list) => (list || []).map((q) => ({ col: q.col.slice(), pt: q.pt ? q.pt.slice() : null }));
const clonePolys = (list) => list.map((q) => ({ cut: !!q.cut, pts: q.pts.map((p) => p.slice()) }));
function syncPolyBtns() {
  $('keyPoly').classList.toggle('on', polyDrawing);
  $('keyPoly').textContent = polyDrawing ? '✏ Click points… (click 1st to close)' : '✏ Draw polygon';
  $('keyPolyInv').classList.toggle('on', polyCut);
  $('keyPolyInv').textContent = polyCut ? '➖ Cut inside' : '➕ Keep inside';
  if ($('keyPick')) { $('keyPick').classList.toggle('on', pickMode); $('keyPick').textContent = pickMode ? '🎯 Click a colour to remove…' : '🎯 Pick colour to remove'; }
  $('keyCanvas').style.cursor = (polyDrawing || pickMode) ? 'crosshair' : 'default';
}
function openKeyModal(part, view) {
  if (!imgs[part][view]) return;                                   // nothing loaded in this slot yet
  keyTarget = { part, view };
  const im = imgs[part][view];
  const oc = document.createElement('canvas'); oc.width = im.width; oc.height = im.height;   // raw source for the eyedropper
  const og = oc.getContext('2d', { willReadFrequently: true }); og.drawImage(im, 0, 0);
  keyOrig = og.getImageData(0, 0, im.width, im.height);
  $('keyTitle').textContent = (part === 'body' ? 'base' : part) + ' · ' + view;
  $('keyTol').value = keyTolState[part][view]; $('keyTolV').textContent = keyTolState[part][view];
  workPolys = clonePolys(polyState[part][view] || []);
  workPicks = clonePicks(pickState[part][view]);
  workPoly = []; polyDrawing = false; polyCut = false; pickMode = false; syncPolyBtns();
  keyZoom = 1; keyPanX = 0; keyPanY = 0;                            // reset the zoom viewport for a fresh image
  renderKeyPreview();
  $('keyModal').hidden = false;
}
function renderKeyPreview() {
  const im = imgs[keyTarget.part][keyTarget.view];
  const maxW = Math.min(1440, window.innerWidth * 0.86), maxH = Math.min(1020, window.innerHeight * 0.72);
  const cv = $('keyCanvas'), s = keyScale = Math.min(maxW / im.width, maxH / im.height, 12);
  cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
  // viewport: at keyZoom>1 we draw a magnified sub-region; keep pan inside the image
  const sx = s * keyZoom, regionW = cv.width / sx, regionH = cv.height / sx;
  keyPanX = Math.max(0, Math.min(Math.max(0, im.width - regionW), keyPanX));
  keyPanY = Math.max(0, Math.min(Math.max(0, im.height - regionH), keyPanY));
  const toX = (ix) => (ix - keyPanX) * sx, toY = (iy) => (iy - keyPanY) * sx;   // image px → canvas px
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;   // no smoothing anywhere
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(keyedCanvas(im, +$('keyTol').value, workPolys, workPicks), keyPanX, keyPanY, regionW, regionH, 0, 0, cv.width, cv.height);
  const d = g.getImageData(0, 0, cv.width, cv.height).data, w = cv.width, hh = cv.height;   // outline overlay
  const solid = (x, y) => x >= 0 && x < w && y >= 0 && y < hh && d[(y * w + x) * 4 + 3] > INK_A;   // was a literal 40 — correct only until INK_A moved
  g.fillStyle = '#ff4fd8';
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++)
    if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  const drawPoly = (pts, closed, col) => {                         // shape paths + vertex handles
    g.lineWidth = 1.5; g.strokeStyle = col;
    g.beginPath(); g.moveTo(toX(pts[0][0]), toY(pts[0][1]));
    for (let i = 1; i < pts.length; i++) g.lineTo(toX(pts[i][0]), toY(pts[i][1]));
    if (closed) g.closePath();
    g.stroke();
    g.fillStyle = col;
    for (const p of pts) g.fillRect(toX(p[0]) - 2, toY(p[1]) - 2, 4, 4);
  };
  for (const pk of workPicks) if (pk.pt) {                          // 🎯 marker at each sampled colour, ringed white
    const px = toX(pk.pt[0] + 0.5), py = toY(pk.pt[1] + 0.5);
    g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fillStyle = `rgb(${pk.col[0]},${pk.col[1]},${pk.col[2]})`; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
  }
  for (const q of workPolys) drawPoly(q.pts, true, q.cut ? '#e0625f' : '#f2c869');
  if (workPoly.length) {
    drawPoly(workPoly, false, polyCut ? '#e0625f' : '#f2c869');
    g.strokeStyle = '#ff4fd8'; g.strokeRect(toX(workPoly[0][0]) - 4, toY(workPoly[0][1]) - 4, 8, 8);
  }
  if (keyZoom > 1.001) {                                            // zoom readout, so you know you're magnified
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(4, 4, 60, 16);
    g.fillStyle = '#7fd4c2'; g.font = '11px Segoe UI, sans-serif'; g.fillText(keyZoom.toFixed(1) + '×  ⇧scroll', 8, 16);
  }
}
$('keyCanvas').addEventListener('click', (e) => {
  if (!polyDrawing && !pickMode) return;
  const cv = $('keyCanvas'), r = cv.getBoundingClientRect(), css = cv.width / r.width;    // CSS px → canvas px
  const sx = keyScale * keyZoom;                                   // canvas px → image px through the zoom viewport
  const x = (e.clientX - r.left) * css / sx + keyPanX, y = (e.clientY - r.top) * css / sx + keyPanY;
  if (pickMode) {                                                  // 🎯 eyedropper: sample the RAW source colour + seed point
    const ix = Math.max(0, Math.min(keyOrig.width - 1, x | 0)), iy = Math.max(0, Math.min(keyOrig.height - 1, y | 0)), o = (iy * keyOrig.width + ix) * 4;
    // was >20 — half the carve's threshold, so it sampled edge pixels the carve treats as clear
    if (keyOrig.data[o + 3] > INK_A) { workPicks.push({ col: [keyOrig.data[o], keyOrig.data[o + 1], keyOrig.data[o + 2]], pt: [ix, iy] }); renderKeyPreview(); }
    return;
  }
  if (workPoly.length >= 3) {                                      // close by clicking the first point…
    const dx = (workPoly[0][0] - x) * sx, dy = (workPoly[0][1] - y) * sx;   // threshold in canvas px
    if (dx * dx + dy * dy < 120) {                                 // …and stay in draw mode for the next shape
      workPolys.push({ pts: workPoly, cut: polyCut }); workPoly = [];
      renderKeyPreview(); return;
    }
  }
  workPoly.push([x, y]); renderKeyPreview();
});
// ⇧ + wheel → zoom toward the cursor for precise cutout tuning. Keeps the image point under the pointer
// fixed while magnifying; wheel without Shift is left alone (page/modal scroll).
$('keyCanvas').addEventListener('wheel', (e) => {
  if (!e.shiftKey || $('keyModal').hidden) return;
  e.preventDefault();
  const cv = $('keyCanvas'), r = cv.getBoundingClientRect(), css = cv.width / r.width;
  const mx = (e.clientX - r.left) * css, my = (e.clientY - r.top) * css;    // cursor in canvas px
  const sx0 = keyScale * keyZoom;
  const iu = mx / sx0 + keyPanX, iv = my / sx0 + keyPanY;                    // image point under the cursor
  keyZoom = Math.max(1, Math.min(80, keyZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));   // up to 80× so single pixels are trimmable on 4K art
  const sx1 = keyScale * keyZoom;
  keyPanX = iu - mx / sx1; keyPanY = iv - my / sx1;                          // re-anchor so that point stays put
  renderKeyPreview();
}, { passive: false });
$('keyPoly').onclick = () => {
  polyDrawing = !polyDrawing; if (!polyDrawing) workPoly = [];     // toggle off = abandon the unfinished shape
  syncPolyBtns(); renderKeyPreview();
};
$('keyPolyInv').onclick = () => { polyCut = !polyCut; syncPolyBtns(); renderKeyPreview(); };
$('keyPolyUndo').onclick = () => {
  if (workPoly.length) workPoly.pop(); else workPolys.pop();       // last point first, then whole shapes
  renderKeyPreview();
};
$('keyPolyClear').onclick = () => { workPolys = []; workPoly = []; renderKeyPreview(); };
// 🎯 eyedropper "touch to remove": arm/undo/clear the picked background colours
if ($('keyPick')) $('keyPick').onclick = () => { pickMode = !pickMode; if (pickMode) { polyDrawing = false; workPoly = []; } syncPolyBtns(); renderKeyPreview(); };
if ($('keyPickUndo')) $('keyPickUndo').onclick = () => { workPicks.pop(); renderKeyPreview(); };
if ($('keyPickClear')) $('keyPickClear').onclick = () => { workPicks = []; renderKeyPreview(); };
$('keyTol').oninput = () => { $('keyTolV').textContent = $('keyTol').value; renderKeyPreview(); };
$('keyApply').onclick = () => {
  keyTolState[keyTarget.part][keyTarget.view] = +$('keyTol').value;
  polyState[keyTarget.part][keyTarget.view] = workPolys.length ? clonePolys(workPolys) : null;
  pickState[keyTarget.part][keyTarget.view] = clonePicks(workPicks);
  $('keyModal').hidden = true;
  renderView(pickFor(keyTarget.part, keyTarget.view));             // re-key the thumb + re-carve the model
};
$('keyCancel').onclick = () => { $('keyModal').hidden = true; };
$('keyModal').addEventListener('click', (e) => { if (e.target === $('keyModal')) $('keyModal').hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('keyModal').hidden) return;
  if (workPoly.length) { workPoly = []; renderKeyPreview(); }      // cancel the unfinished shape…
  else if (polyDrawing) { polyDrawing = false; syncPolyBtns(); renderKeyPreview(); }   // …then exit draw mode…
  else if (pickMode) { pickMode = false; syncPolyBtns(); renderKeyPreview(); }         // …then exit the eyedropper…
  else $('keyModal').hidden = true;                                // …then close the dialog
});

// ── SHEET SLICER (owner 2026-07-16): open ONE image holding several orthographic views, drag a
// rectangle or circle over each region, click its destination slot — no external cutting. Circle
// selections mask outside the circle to transparent (round turrets). Feeds setView like a file drop.
let sheetImg = null, sheetScale = 1, sheetShape = 'rect', sheetSel = null, sheetDrag = null;
const sheetCv = $('sheetCanvas'), sheetCtx = sheetCv.getContext('2d');
function sheetDraw() {
  sheetCtx.clearRect(0, 0, sheetCv.width, sheetCv.height);
  if (!sheetImg) return;
  sheetCtx.imageSmoothingEnabled = false;   // no smoothing anywhere
  sheetCtx.drawImage(sheetImg, 0, 0, sheetImg.width * sheetScale, sheetImg.height * sheetScale);
  if (!sheetSel) return;
  const s = sheetSel, k = sheetScale;
  sheetCtx.save();
  sheetCtx.strokeStyle = '#f2c869'; sheetCtx.lineWidth = 2; sheetCtx.setLineDash([6, 4]);
  if (s.kind === 'rect') sheetCtx.strokeRect(s.x * k, s.y * k, s.w * k, s.h * k);
  else { sheetCtx.beginPath(); sheetCtx.arc(s.cx * k, s.cy * k, s.r * k, 0, 7); sheetCtx.stroke(); }
  sheetCtx.restore();
}
function sheetSetImage(im) {
  sheetImg = im; sheetSel = null;
  const maxW = Math.min(1400, window.innerWidth * 0.88), maxH = Math.min(860, window.innerHeight * 0.58);
  sheetScale = Math.min(maxW / im.width, maxH / im.height, 3);
  sheetCv.width = Math.max(1, Math.round(im.width * sheetScale));
  sheetCv.height = Math.max(1, Math.round(im.height * sheetScale));
  $('sheetState').textContent = `${im.width}×${im.height} loaded — drag a region, then click its slot.`;
  sheetDraw();
}
const sheetPos = (e) => {
  const r = sheetCv.getBoundingClientRect(), f = sheetCv.width / r.width;   // CSS px → canvas px
  return { x: (e.clientX - r.left) * f / sheetScale, y: (e.clientY - r.top) * f / sheetScale };
};
sheetCv.addEventListener('pointerdown', (e) => {
  if (!sheetImg) return;
  sheetDrag = sheetPos(e);
  sheetCv.setPointerCapture(e.pointerId);
});
sheetCv.addEventListener('pointermove', (e) => {
  if (!sheetDrag) return;
  const p = sheetPos(e);
  if (sheetShape === 'rect') {
    sheetSel = { kind: 'rect', x: Math.min(sheetDrag.x, p.x), y: Math.min(sheetDrag.y, p.y),
      w: Math.abs(p.x - sheetDrag.x), h: Math.abs(p.y - sheetDrag.y) };
  } else {
    sheetSel = { kind: 'circle', cx: sheetDrag.x, cy: sheetDrag.y, r: Math.hypot(p.x - sheetDrag.x, p.y - sheetDrag.y) };
  }
  sheetDraw();
});
sheetCv.addEventListener('pointerup', () => { sheetDrag = null; });
function sheetCrop() {
  const s = sheetSel;
  if (!s || !sheetImg) return null;
  if (s.kind === 'rect') {
    if (s.w < 4 || s.h < 4) return null;
    const cv2 = document.createElement('canvas');
    cv2.width = Math.max(1, Math.round(s.w)); cv2.height = Math.max(1, Math.round(s.h));
    cv2.getContext('2d').drawImage(sheetImg, s.x, s.y, s.w, s.h, 0, 0, cv2.width, cv2.height);
    return cv2;
  }
  if (s.r < 3) return null;
  const d = Math.max(2, Math.round(s.r * 2));
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = d;
  const g = cv2.getContext('2d');
  g.beginPath(); g.arc(d / 2, d / 2, d / 2, 0, 7); g.clip();               // outside the circle → transparent
  g.drawImage(sheetImg, s.cx - s.r, s.cy - s.r, s.r * 2, s.r * 2, 0, 0, d, d);
  return cv2;
}
document.querySelectorAll('.slotBtn').forEach((b) => b.addEventListener('click', () => {
  const crop = sheetCrop();
  if (!crop) { $('sheetState').textContent = 'Drag a region first (a few pixels at least).'; return; }
  setView(pickFor(b.dataset.sp, b.dataset.sv), crop);
  b.classList.add('assigned');
  $('sheetState').textContent = `→ ${b.dataset.sp === 'body' ? 'base' : b.dataset.sp} · ${b.dataset.sv} set. Drag the next region.`;
}));
$('openSheet').onclick = () => {
  document.querySelectorAll('.slotBtn').forEach((b) => b.classList.remove('assigned'));
  $('sheetModal').hidden = false;
  if (!sheetImg) $('sheetState').textContent = 'Open or paste an image to start.';
  sheetDraw();
};
$('sheetLoad').onclick = () => $('sheetFile').click();
$('sheetFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const im = new Image(); im.onload = () => sheetSetImage(im); im.src = URL.createObjectURL(f);
});
$('shapeRect').onclick = () => { sheetShape = 'rect'; $('shapeRect').classList.add('on'); $('shapeCircle').classList.remove('on'); };
$('shapeCircle').onclick = () => { sheetShape = 'circle'; $('shapeCircle').classList.add('on'); $('shapeRect').classList.remove('on'); };
$('sheetClose').onclick = () => { $('sheetModal').hidden = true; };
$('sheetModal').addEventListener('click', (e) => { if (e.target === $('sheetModal')) $('sheetModal').hidden = true; });

// Colour helpers shared across the tool. rgb2hsv / hsv2rgb / keyRGB went with the tuner that was their
// only caller (FFF-8); these two are read by the paint swatch, the inline strip and the Palette window.
const cssOf = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hexOf = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
// ── THE PALETTE WINDOW ────────────────────────────────────────────────────────────────────────────
// Replaces SF4's two-row drag-and-drop remap, whose ⬇ Bake wrote voxEdit[part].set(...) — a store with
// no readers — and then reported "baked N voxels → M colours". It changed nothing, ever, and said so
// confidently. Nothing of it is kept; the explicit per-colour work it was reaching for is the working
// palette below, and the Advanced… window still has the pin/eliminate/tune surface.
//
// WHAT THIS IS. Six reductions of the model's own colours — 2 / 4 / 8 / 16 / 32 / 48 — each shown with
// what it costs, and a sample that redraws a top and a side view in the candidate palette BEFORE
// anything is written. Every reduction comes from palette.js via its *Core aliases (see the shadow note
// there); there is no quantiser in this block, which is the whole point of the exercise.

// ── WHAT COLOUR IS THIS VOXEL, REALLY? ────────────────────────────────────────────────────────────
// A voxel holds ONE vcol but shows up to FIVE faces, and on a photo-carved unit the faces are what you
// see: buildFaces paints the ±y flanks from the side sheet and the ±x ends from the front/back sheets,
// while vcol only ever holds the top-down column colour. So a palette built from vcol — or a remap that
// writes nearest(vcol) — throws away every side and front sheet in the unit.
//
// Flattening is lossy by definition (one voxel, one colour, up to five faces), so the rule has to be
// stated rather than stumbled into: take the colour MOST of the voxel's exposed faces show, and break a
// tie toward a WALL face over the top face. Preferring the wall can only preserve art and never invent
// it, because the top face's colour IS vcol, which is the fallback everywhere else anyway.
function renderedVoxColours(partId, foot, layers) {
  const built = buildFaces(partId, foot, layers, true);              // raw: before the reducer and the tuner
  const N = foot * foot, byVox = new Map();
  for (const f of built.faces) {
    const k = f.z * N + f.y * foot + f.x;
    let tally = byVox.get(k); if (!tally) { tally = new Map(); byVox.set(k, tally); }
    const ck = (f.r << 16) | (f.g << 8) | f.b, e = tally.get(ck);
    if (e) { e.n++; if (f.n > 0) e.wall = true; }
    else tally.set(ck, { rgb: [f.r, f.g, f.b], n: 1, wall: f.n > 0 });
  }
  const out = new Map();
  for (const [k, tally] of byVox) {
    let best = null;
    // insertion order is face order (top, +x, −x, +y, −y), so this is deterministic run to run
    for (const e of tally.values()) if (!best || e.n > best.n || (e.n === best.n && e.wall && !best.wall)) best = e;
    if (best) out.set(k, best.rgb);
  }
  return out;
}

// ── THE FULL PALETTE COMES FROM THE SLICES ───────────────────────────────────────────────────────
// Owner: "The source is always safe .. original slices." / "Full palette is derived from slices."
//
// WHY IT CANNOT COME FROM THE MODEL. The model is what palette work WRITES. Apply a 4-colour palette and
// the model contains four colours — so a window that re-read the model could then only ever offer four,
// and the second reduction would be a reduction of a reduction. The slices do not move when the model
// does. That is the whole property: the pool of colours you may choose from is what the ART makes
// available, before anything was reduced, and it is still all there after ten applies.
//
// KEYED, exactly as the carve keys them (keyedCanvas + the same tol / polygon / eyedropper state), so a
// background this tool has already knocked out can never claim a palette slot. NOT xf-transformed:
// alignment decides where art sits on the box, not which colours it contains.
//
// SAMPLED ON A STRIDE. A source photo is megapixels and this runs on every window open; the histogram is
// a proportion, so a uniform deterministic sample preserves it. Cached per (part, view) against the image
// identity and its keying state, because keyedCanvas is the expensive part.
const SLICE_PAL_SAMPLES = 60000;              // per view — enough to be stable, cheap enough to be instant
const slicePalCache = { body: mkViews(() => null), turret: mkViews(() => null) };
function sliceTally(part, view) {
  const img = imgs[part][view];
  if (!img) return null;
  const tol = keyTolState[part][view], polys = polyState[part][view] || [], picks = pickState[part][view] || [];
  const sig = `${tol}:${polys.length}:${picks.length}`;
  const hit = slicePalCache[part][view];
  if (hit && hit.img === img && hit.sig === sig) return hit.tally;
  const cv = keyedCanvas(img, tol, polys, picks);
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
  const N = cv.width * cv.height, step = Math.max(1, Math.floor(N / SLICE_PAL_SAMPLES));
  const tally = new Map();
  for (let i = 0; i < N; i += step) {
    const p = i * 4; if (d[p + 3] <= INK_A) continue;               // keyed-out background is not a colour
    const k = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2];
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  slicePalCache[part][view] = { img, sig, tally };
  return tally;
}
/** every colour the source art offers, both parts, all four views — {rgb, n} by sampled pixel count */
function slicePaletteEntries() {
  const tally = new Map();
  for (const part of ['body', 'turret']) for (const v of VIEWS) {
    const t = sliceTally(part, v); if (!t) continue;
    for (const [k, n] of t) tally.set(k, (tally.get(k) || 0) + n);
  }
  return [...tally.entries()].map(([k, n]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], n }));
}

let palEntries = [];                          // the pool the reductions are chosen from: slices ∪ model
let palSliceN = 0, palModelN = 0;             // how many distinct colours each source contributed
// voxel key → its rendered colour, per part. STAMPED WITH THE DIMS IT WAS BUILT AT: the keys are
// absolute (z*foot²+y*foot+x), so if Layers or Resolution moves while the window is open the same key
// addresses a different voxel. Same guard restoreVol and selCheckDims already apply.
const palVoxCols = { body: null, turret: null };
let palVoxDims = { body: null, turret: null };
const palColsFor = (part, foot, layers) => {
  const d = palVoxDims[part];
  return (d && d.foot === foot && d.layers === layers) ? palVoxCols[part] : null;
};
let palOpts = [];                             // paletteOptionsCore() output — one per offered size
let palPickN = 0;                             // which size is selected
let palWork = [];                             // the WORKING palette: the selection, hand-editable
let palWorkBase = [];                         // what the reduction chose, so a slot can be reverted
let palWorkSel = -1;

// Both parts, one histogram: the palette is a property of the UNIT, and applying it to only the part
// that happens to be on screen is how a turret ends up on a different palette from its hull.
//
// THE MODEL HALF of the pool. It is still needed alongside the slices for two reasons that are not
// stylistic: a .vox import and a procedural decor tree have NO slices at all, and a hand-painted voxel
// holds a hex the artist typed that no source sheet contains. Dropping either would make colours the unit
// genuinely uses unreachable from the palette that claims to describe it.
function palGatherEntries() {
  palVoxCols.body = null; palVoxCols.turret = null; palVoxDims = { body: null, turret: null };
  const tally = new Map();
  for (const part of ['body', 'turret']) {
    const foot = footOf(part), layers = part === 'body' ? state.bodyLayers : state.turretLayers;
    if (!carveCache[part]) continue;
    // renderedVoxColours goes through buildModel, which can REPLACE carveCache[part].m via the sig path.
    // So it runs first and `m` is read after it — reading `m` first left a stale array whose vcol was
    // not the one the faces were built from.
    const cols = renderedVoxColours(part, foot, layers);
    const m = carveCache[part] && carveCache[part].m;
    if (!m || !m.vcol || !m.filled) continue;
    palVoxCols[part] = cols; palVoxDims[part] = { foot, layers };
    const N = foot * foot;
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!m.filled(x, y, z)) continue;
      const k = z * N + y * foot + x, o = k * 3;
      const c = cols.get(k) || [m.vcol[o], m.vcol[o + 1], m.vcol[o + 2]];   // no exposed face → interior voxel
      if (!c[0] && !c[1] && !c[2]) continue;                                // unwritten is not a colour anyone chose
      const ck = (c[0] << 16) | (c[1] << 8) | c[2], e = tally.get(ck);
      if (e) e.n++; else tally.set(ck, { rgb: [c[0], c[1], c[2]], n: 1 });
    }
  }
  // ── MERGE: the slices are the source, the model is what is on the box. Both, at EQUAL total weight.
  // Not for balance's sake — because the two are counted in different units. A slice tally counts sampled
  // PIXELS (tens of thousands per sheet) and the model counts VOXELS (up to 196k at 64³). Added raw,
  // whichever happens to be bigger decides the reduction and the other might as well not be there.
  // Normalising the slice mass to the model's makes the pool "half what the art offers, half what the
  // model shows", which is a stated rule instead of an accident of grid resolution.
  const modelMass = [...tally.values()].reduce((s, e) => s + e.n, 0);
  palModelN = tally.size;
  const slices = slicePaletteEntries();
  palSliceN = slices.length;
  const sliceMass = slices.reduce((s, e) => s + e.n, 0);
  const scale = (sliceMass && modelMass) ? modelMass / sliceMass : 1;
  for (const e of slices) {
    const ck = (e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2], hit = tally.get(ck);
    const w = Math.max(1, Math.round(e.n * scale));
    if (hit) hit.n += w; else tally.set(ck, { rgb: e.rgb.slice(), n: w });
  }
  palEntries = [...tally.values()].sort((a, b) => b.n - a.n
    || a.rgb[0] - b.rgb[0] || a.rgb[1] - b.rgb[1] || a.rgb[2] - b.rgb[2]);
  return palEntries;
}

function palBuildOptions() {
  palGatherEntries();
  palOpts = palEntries.length ? paletteOptionsCore(palEntries, PALETTE_SIZES) : [];
  const note = $('palSourceNote');
  if (note) {
    note.textContent = palEntries.length
      ? `${palEntries.length} colours available — ${palSliceN} from the source slices, ${palModelN} on the model`
        + ` · spanning ${(palOpts[0] ? palOpts[0].lumAvail : 0).toFixed(0)} of 255 in luminance.`
        + ' The slices are the safe source: the full palette stays this wide however many times you Apply.'
      : 'Nothing to read yet — load source art and press a Carve button first.';
  }
  // Default to 8. Measured on the shipped SPA-U3 body, 8 is the first size where no part of the model is
  // badly wrong; 2 and 4 are offered and honest, but they are a stylistic choice, not a safe default.
  const keep = palOpts.some((o) => o.n === palPickN) ? palPickN
    : ((palOpts.find((o) => o.n === 8) || palOpts[0] || {}).n || 0);
  if (keep) palChoose(keep);
  else { palWork = []; palWorkBase = []; palWorkSel = -1; palRenderOptions(); palRenderWork(); palDrawPreview(); }
}

function palChoose(n) {
  const o = palOpts.find((q) => q.n === n); if (!o) return;
  palPickN = n;
  palWorkBase = o.palette.map((c) => c.slice());
  palWork = o.palette.map((c) => c.slice());
  palWorkSel = -1;
  palRenderOptions(); palRenderWork(); palDrawPreview();
  if ($('paletteState')) $('paletteState').textContent =
    `${palWork.length} colours · ${o.via === 'spread' ? 'tonal spread' : 'coverage + variety'} won on fit (rms ${o.rms.toFixed(1)})`;
}

function palRenderOptions() {
  const box = $('palOptions'); if (!box) return;
  box.innerHTML = '';
  for (const o of palOpts) {
    const st = o.stats;
    // lumSpread is meaningless on its own — 22 is a disaster on a model spanning 183 and fine on one
    // spanning 30. It is always shown against what the model actually had to offer.
    const pct = o.lumAvail ? (100 * st.lumSpread / o.lumAvail) : 100;
    const flat = pct < 55;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palOpt' + (o.n === palPickN ? ' sel' : '');
    b.innerHTML = `<div class="n">${o.palette.length} colour${o.palette.length === 1 ? '' : 's'}`
      + `<small>${o.via === 'spread' ? 'tonal' : 'coverage'}</small></div>`
      + `<div class="sw">${o.palette.map((c) => `<i style="background:${cssOf(c)}"></i>`).join('')}</div>`
      + `<div class="st">avg err <b>${st.meanErr.toFixed(1)}</b> · worst <b>${st.worstErr.toFixed(0)}</b><br>`
      + `tone <b class="${flat ? 'warn' : ''}">${st.lumSpread.toFixed(0)}</b>/${o.lumAvail.toFixed(0)}`
      + `${flat ? ' ⚠ flat' : ''} · ${st.hueCount} hue${st.hueCount === 1 ? '' : 's'}</div>`;
    b.title = `${o.n} colours — mean error ${st.meanErr.toFixed(2)}, worst ${st.worstErr.toFixed(1)}, rms ${o.rms.toFixed(2)}.`
      + ` Chosen by ${o.via === 'spread' ? 'equal-luminance banding' : 'coverage + variety'}, which fit this model better.`;
    b.onclick = () => palChoose(o.n);
    box.appendChild(b);
  }
}

function palRenderWork() {
  const box = $('palWorkSwatches'); if (!box) return;
  box.innerHTML = '';
  palWork.forEach((c, i) => {
    const edited = palWorkBase[i] && c.join() !== palWorkBase[i].join();
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palWs' + (i === palWorkSel ? ' sel' : '') + (edited ? ' edited' : '');
    b.style.background = cssOf(c);
    b.title = `${hexOf(c)} — click to select this slot and load it as the paint colour`;
    b.onclick = () => { palWorkSel = i; setPaintRGB(c); palRenderWork(); };
    box.appendChild(b);
  });
  palSyncSlot();
}
function palSyncSlot() {
  const row = $('palSlotRow'); if (!row) return;
  const has = palWorkSel >= 0 && palWorkSel < palWork.length;
  row.hidden = !has;
  if (!has) return;
  const hex = hexOf(palWork[palWorkSel]);
  $('palSlotN').textContent = String(palWorkSel + 1);
  $('palSlotCol').value = hex;
  $('palSlotHex').textContent = hex.toUpperCase();
}

// ── THE SAMPLE WINDOW ─────────────────────────────────────────────────────────────────────────────
// The load-bearing half of the request: a palette picker without a live preview is guesswork with extra
// steps. Two orthographic projections of the part on screen — one as the model is, one as it would be —
// drawn from the SAME per-voxel colour Apply will write, so the comparison is the actual result and not
// an impression of it.
const PAL_PREV_AX = {
  top:  (foot, layers) => ({ cols: foot, rows: foot,   depth: layers, at: (c, r, s) => [c, r, layers - 1 - s] }),
  side: (foot, layers) => ({ cols: foot, rows: layers, depth: foot,   at: (c, r, s) => [c, s, layers - 1 - r] }),
};
function palDrawProjection(cvId, part, which, palette) {
  const cv = $(cvId); if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, W, H);
  const m = carveCache[part] && carveCache[part].m; if (!m || !m.vcol || !m.filled) return;
  const foot = footOf(part), layers = part === 'body' ? state.bodyLayers : state.turretLayers, N = foot * foot;
  const ax = PAL_PREV_AX[which](foot, layers);
  const cell = Math.max(1, Math.floor(Math.min(W / ax.cols, H / ax.rows)));
  const ox = Math.floor((W - cell * ax.cols) / 2), oy = Math.floor((H - cell * ax.rows) / 2);
  const cols = palColsFor(part, foot, layers);
  for (let r = 0; r < ax.rows; r++) for (let c = 0; c < ax.cols; c++) {
    let col = null;
    for (let s = 0; s < ax.depth; s++) {                              // first voxel the ray hits = the surface
      const [x, y, z] = ax.at(c, r, s);
      if (x < 0 || y < 0 || z < 0 || x >= foot || y >= foot || z >= layers) continue;
      if (!m.filled(x, y, z)) continue;
      const k = z * N + y * foot + x, o = k * 3;
      col = (cols && cols.get(k)) || [m.vcol[o], m.vcol[o + 1], m.vcol[o + 2]];
      break;
    }
    if (!col) continue;
    if (palette && palette.length) col = nearestCore(col, palette);
    ctx.fillStyle = cssOf(col);
    ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
  }
}
function palDrawPreview() {
  const part = gridPart();
  const lbl = $('palPrevPart'); if (lbl) lbl.textContent = part;
  palDrawProjection('palPrevTopNow', part, 'top', null);
  palDrawProjection('palPrevTopNew', part, 'top', palWork);
  palDrawProjection('palPrevSideNow', part, 'side', null);
  palDrawProjection('palPrevSideNew', part, 'side', palWork);
}

// ── APPLY ─────────────────────────────────────────────────────────────────────────────────────────
// Through setVox, one voxel at a time — NOT applyPalette(), which writes vcol directly and cannot set
// PAINT. PAINT is what marks a colour as the artist's, and without it the next re-carve overwrites the
// lot. This is also why the palette is derived from the rendered face colour above: the write is
// permanent for the wall-art pass, so it had better be sourced from what the wall was showing.
function palApplyToModel() {
  if (!palWork.length) { $('paletteState').textContent = 'Pick a palette size first.'; return; }
  // BUILD BOTH PARTS FIRST, THEN SNAPSHOT, THEN MUTATE. buildModel can swap carveCache[part].m, so a
  // snapshot taken before the build can be of a different array than the one setVox goes on to write.
  const built = ['body', 'turret'].map((part) => ({ part, foot: footOf(part),
    layers: part === 'body' ? state.bodyLayers : state.turretLayers }))
    .map((p) => ({ ...p, m: buildModel(p.part, p.foot, p.layers) }));
  pushVolAll();                                                      // ONE entry, both parts, one Ctrl+Z
  let touched = 0;
  for (const { part, foot, layers, m } of built) {
    if (!m || !m.vcol || !m.filled) continue;
    const N = foot * foot, cols = palColsFor(part, foot, layers);
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!m.filled(x, y, z)) continue;
      const k = z * N + y * foot + x, o = k * 3;
      const src = (cols && cols.get(k)) || [m.vcol[o], m.vcol[o + 1], m.vcol[o + 2]];
      if (setVox(part, k, nearestCore(src, palWork))) touched++;
    }
  }
  // The `if (state.paletteN) setPaletteN(0)` mitigation that used to sit here (40e6bea) is GONE. It
  // existed only because a live reducer would otherwise re-bin the palette that had just been written into
  // the model — a workaround for the filter, not a feature. With the filter deleted the model simply shows
  // what it holds, so there is nothing to switch off.
  gridModel = null; refreshModel(); renderGridView(); scheduleAutosave();
  palBuildOptions();                                                 // re-read the source (slices) + the model
  $('paletteState').textContent = `Applied ${palWork.length} colours to ${touched} voxel(s) across body + turret. `
    + 'The model now HOLDS these colours — they are what the grid draws, what the 3D view draws and what bakes. '
    + 'Ctrl+Z undoes the whole thing in one step.';
}

function openPaletteWindow() {
  palBuildOptions();
  $('paletteModal').hidden = false;
}
$('openPal').onclick = openPaletteWindow;
$('paletteClose').onclick = () => { $('paletteModal').hidden = true; };
$('palRefresh').onclick = () => palBuildOptions();
$('palApply').onclick = palApplyToModel;
$('palSlotCol').oninput = (e) => {
  if (palWorkSel < 0 || palWorkSel >= palWork.length) return;
  const h = e.target.value;
  palWork[palWorkSel] = [parseInt(h.slice(1, 3), 16) || 0, parseInt(h.slice(3, 5), 16) || 0, parseInt(h.slice(5, 7), 16) || 0];
  setPaintRGB(palWork[palWorkSel]);
  palRenderWork(); palDrawPreview();
};
$('palSlotReset').onclick = () => {
  if (palWorkSel < 0 || !palWorkBase[palWorkSel]) return;
  palWork[palWorkSel] = palWorkBase[palWorkSel].slice();
  palRenderWork(); palDrawPreview();
};
makeDraggable('paletteModal', 'paletteDrag');

// ── the Photoshop-style paint swatch ──────────────────────────────────────────────────────────────
// A big swatch showing the live paint colour; clicking it opens the platform picker. The <input
// type=color> is still the model — it is just no longer the thing you aim at, because a 24×20 native
// control next to six tool buttons is not a colour button, it is a rounding error.
if ($('paintSwatch')) $('paintSwatch').onclick = () => {
  const el = $('gridPaintCol'); if (!el) return;
  if (typeof el.showPicker === 'function') { try { el.showPicker(); return; } catch (err) { /* not allowed here — fall through */ } }
  el.click();
};
if ($('gridPaintCol')) $('gridPaintCol').oninput = () => syncPaintSwatch();
syncPaintSwatch();

let pasteTarget = null;
document.querySelectorAll('.vpick').forEach((pick) => {
  pick.addEventListener('mouseenter', () => { pasteTarget = pick; document.querySelectorAll('.vpick').forEach((p) => p.classList.toggle('active', p === pick)); });
  pick.querySelector('input').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const im = new Image(); im.onload = () => setView(pick, im); im.onerror = () => alert('Could not load that image — PNG/JPEG?'); im.src = URL.createObjectURL(file);
  });
});
// paste an image from the clipboard: into the sheet slicer while it's open, else the hovered view slot
document.addEventListener('paste', (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const it of items) if (it.type && it.type.indexOf('image') === 0) {
    const file = it.getAsFile(); if (!file) return;
    if (!$('sheetModal').hidden) {
      const im = new Image(); im.onload = () => sheetSetImage(im); im.src = URL.createObjectURL(file);
      e.preventDefault(); return;
    }
    if (!pasteTarget) return;
    const im = new Image(); im.onload = () => setView(pasteTarget, im); im.src = URL.createObjectURL(file);
    e.preventDefault(); return;
  }
});

$('setCam').onclick = () => {
  $('camState').innerHTML = `<span class="lock">✓ Camera set — azimuth ${state.az | 0}° · elevation ${state.el | 0}° · layer sp ${layerSp(state.el).toFixed(2)}px</span>`;
};

// ── BAKE ──
function doBake() {
  // BAKE TILT. The sprites bake at their OWN elevation (default 45°) so the orbit camera can be moved
  // freely while inspecting without changing what ships. layerSp/pack.camera follow the bake, not the
  // preview, or the shipped sprite would not match the elevation recorded beside it.
  const bEl = bakeElOf();
  const foot = state.foot, bL = state.bodyLayers, tL = state.turretLayers, sp = layerSp(bEl), B = state.bakeScale;
  // FRAME THE LARGER FOOTPRINT, NOT THE BODY'S. geom() was called with state.foot while renderParts
  // centres each part on its OWN F.foot — and SF3 gives the turret an independent footprint (the res
  // dropdown offers up to 128 against a body as small as 32). Measured at body 64 / turret 96 / 25%
  // pivot: the frame gave 62.0px of half-width where the turret needs 86.5 — 24.5px sheared off each
  // side of the baked sprite. The pivot padding was wrong for the same reason: computed from the body's
  // foot while renderParts shifts by the turret's.
  const gFoot = Math.max(foot, footOf('turret'));
  const pivotPx = gFoot * state.turretPivot / 100, pivotFrac = 0.5 + state.turretPivot / 100;
  const g = geom(gFoot, Math.max(bL, tL), sp, pivotPx);   // shared texture sized for the taller stack; both bottom-align at BASEY
  const t0 = performance.now();
  const body = bakeAngleCache(app.renderer, bodyFaces, { frames: BODY_FRAMES, g, pivotFrac: 0.5, el: bEl, scale: B });
  const turret = bakeAngleCache(app.renderer, turretFaces, { frames: TURRET_FRAMES, g, pivotFrac, el: bEl, scale: B });
  // S1: cast-shadow shape atlas, from the filled volume (aligned 1:1 with the frame atlases)
  const bodyFilled = buildModel('body', foot, bL).filled, turretFilled = buildModel('turret', footOf('turret'), tL).filled;
  const bodyShadow = bakeShadowCache(app.renderer, bodyFilled, { frames: BODY_FRAMES, g, pivotFrac: 0.5, el: bEl, scale: B, foot, layers: bL });
  const turretShadow = bakeShadowCache(app.renderer, turretFilled, { frames: TURRET_FRAMES, g, pivotFrac, el: bEl, scale: B, foot: footOf('turret'), layers: tL });
  state.baked = { body, turret, bodyShadow, turretShadow, bodyFrames: BODY_FRAMES, turretFrames: TURRET_FRAMES, g, sp, foot, bodyLayers: bL, turretLayers: tL, scale: B , el: bEl };
  const mkBaked = (tex, parent) => { const s = new PIXI.Sprite(tex);       // frames are B px/voxel → shrink to world size
    s.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); s.scale.set(1 / B); parent.addChild(s); return s; };
  bodyBaked = mkBaked(body[0], rig); turretBaked = mkBaked(turret[0], rig);
  gBodyBaked = mkBaked(body[0], gUnit); gTurretBaked = mkBaked(turret[0], gUnit);   // in-game preview
  const vram = ((g.RTW * B * g.RTH * B * 4 * (BODY_FRAMES + TURRET_FRAMES)) / 1048576).toFixed(1);
  $('bakeState').innerHTML = `<span class="lock">✓ Baked in ${(performance.now() - t0).toFixed(0)}ms · ${g.RTW * B}×${g.RTH * B} · ~${vram}MB cache</span>`;
  $('saveUnit').disabled = false; $('dlSheet').disabled = false;
}
$('bake').onclick = doBake;

// pack a part's baked frames into one atlas canvas (grid), return { canvas, cols, cell:[w,h] }
function packAtlas(cache) {
  const n = cache.length, cw = cache[0].width, ch = cache[0].height, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < n; i++) { const fc = app.renderer.extract.canvas(cache[i]); ctx.drawImage(fc, (i % cols) * cw, ((i / cols) | 0) * ch); }
  return { canvas: cv, cols, cell: [cw, ch] };
}
function buildPack() {
  const b = state.baked, id = ($('uid').value || 'unit').trim(), B = b.scale || 1;
  const ba = packAtlas(b.body), ta = packAtlas(b.turret);
  const bsa = b.bodyShadow ? packAtlas(b.bodyShadow) : null, tsa = b.turretShadow ? packAtlas(b.turretShadow) : null;   // S1 shadow atlases
  const pivot = [Math.round(b.g.CX * B), Math.round(b.g.BASEY * B)], mountDz = mountZOf(b.bodyLayers);   // SAME rule as the preview, or the pack ships a different mount height than you set
  const totalH = Math.max(b.bodyLayers, mountDz + b.turretLayers);
  const pack = {
    id, class: state.cls, footprint: [b.foot, b.foot, totalH],
    scale: { voxPerTile: VOX_PER_TILE, tiles: unitTiles(b.foot) },   // the world-size contract
    camera: { azimuth: state.az | 0, elevation: (b.el != null ? b.el : state.el) | 0 }, layerSpacing: Math.round(b.sp * 100) / 100,   // the BAKE tilt, or the sprite and its recorded elevation disagree
    voxel: { height: state.zScale },
    renderScale: B,                                    // atlas px per voxel — draw frames at 1/renderScale
    light: { azimuth: state.lightAz, contrast: state.lightK },
    parts: [
      { id: 'body', kind: 'directional', facings: b.bodyFrames, atlas: `${id}.body.png`, cell: ba.cell, cols: ba.cols, pivot, layers: b.bodyLayers, zeroFacing: '+x',
        ...(bsa ? { shadowAtlas: `${id}.body.shadow.png`, shadowCell: bsa.cell, shadowCols: bsa.cols } : {}) },
      { id: 'turret', kind: 'stack', angles: b.turretFrames, atlas: `${id}.turret.png`, cell: ta.cell, cols: ta.cols, pivot, layers: b.turretLayers, mount: [state.turretDx, 0, mountDz],
        ...(tsa ? { shadowAtlas: `${id}.turret.shadow.png`, shadowCell: tsa.cell, shadowCols: tsa.cols } : {}) },
    ],
    // S1: baked cast-shadow shapes replace the runtime skew. `elevation`/`dir` are recorded so the game
    // (and flyer shadows) can offset consistently; ellipse fields kept as the pre-shadow-atlas fallback.
    shadow: (bsa && tsa)
      ? { kind: 'baked', elevation: SHADOW_EL, dir: [SHADOW_DIRX, SHADOW_DIRY], alt: state.cls === 'air' ? 30 : 0 }
      : { kind: 'ellipse', rx: Math.round(b.foot / 2), ry: Math.round(b.foot * 0.22), alt: state.cls === 'air' ? 30 : 0 },
    stats: { speed: 90, turnRate: 3.0, turretRate: 4.0 },
    collision: +bodyExtentTiles().toFixed(3),   // sim unit-radius half-width (tiles) from the real body extent; matches the preview ring
  };
  // Tier C (rendering-tiers spec §3C): embed the assembled voxel model so the game can render this
  // unit as a LIVE 3D object with real pitch/roll. Big (~4B/voxel base64) — only for set-pieces.
  if ($('embedModel').checked) {
    // SF3: body fills the b.foot grid; the (possibly smaller) turret is CENTERED into it — its own
    // footOf('turret') grid offset by (b.foot − turretFoot)/2, plus the turretDx mount shift on x.
    const tFoot = footOf('turret'), tc = Math.floor((b.foot - tFoot) / 2), tdx = Math.round(state.turretDx);
    const bodyCells = collectVox('body', b.foot, b.bodyLayers, 0, 0);
    const turretCells = collectVox('turret', tFoot, b.turretLayers, mountDz, 0);
    let nz = 1; for (const c of bodyCells) if (c.z + 1 > nz) nz = c.z + 1; for (const c of turretCells) if (c.z + 1 > nz) nz = c.z + 1;
    const data = new Uint8Array(b.foot * b.foot * nz * 4);
    const put = (c, ox, oy) => { const X = c.x + ox, Y = c.y + oy; if (X < 0 || Y < 0 || X >= b.foot || Y >= b.foot) return; const i = ((c.z * b.foot + Y) * b.foot + X) * 4; data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255; };
    for (const c of bodyCells) put(c, 0, 0);
    for (const c of turretCells) put(c, tc + tdx, tc);
    pack.model = { nx: b.foot, ny: b.foot, nz, b64: b64FromU8(data) };
  }
  const atlases = { body: ba.canvas.toDataURL('image/png'), turret: ta.canvas.toDataURL('image/png') };
  if (bsa) atlases['body.shadow'] = bsa.canvas.toDataURL('image/png');
  if (tsa) atlases['turret.shadow'] = tsa.canvas.toDataURL('image/png');
  return { pack, atlases };
}

// ── SAVE to manifest ──
const loadManifest = () => { try { return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}'); } catch (e) { return {}; } };
function renderManifest() {
  const m = loadManifest(), ids = Object.keys(m.units || {});
  $('manifest').innerHTML = ids.length
    ? ids.map((id) => `<div class="u"><b>${id}</b><span>${m.units[id].pack.class} · ${m.units[id].pack.footprint.join('×')}</span></div>`).join('')
    : 'No units saved yet.';
}
// A save that fails must be impossible to miss: it shouts in the console, writes the prominent state
// line, AND blocks with a dialog. No hidden notes — the muted `saveState` note was the only signal and
// it was routinely overwritten by a success message from quickSave a moment later.
function saveFailed(kind, detail) {
  const msg = `SAVE FAILED — ${kind}

${detail}`;
  console.error('[stack-forge] ' + msg);
  $('saveState').innerHTML = `<b style="color:#ff6b6b">✗ SAVE FAILED — ${kind}</b>`;
  if ($('projState')) $('projState').innerHTML = `<b style="color:#ff6b6b">✗ NOT SAVED — ${kind}</b>`;
  alert(msg);
  return { ok: false, kind, detail };
}
async function doSaveUnit() {
  // FAIL LOUD. Both of this function's failure paths used to `return` bare, and quickSave printed
  // 'Saved …' regardless — a failed save reported success, which is how a unit went missing for a day.
  if (!state.baked) return saveFailed('NO BAKE', 'The model is not baked. Press Bake, then Save.');
  let built, v;
  try { built = buildPack(); v = validatePack(built.pack); }
  catch (e) { return saveFailed('BAKE/PACK FAILED', (e && e.message) || String(e)); }
  activeUnitId = built.pack.id;                           // an explicit save under this id is a deliberate rename → follow it
  unTombstone('proj:' + built.pack.id);                   // …and it un-deletes the id: this is the deliberate ask
  const m = loadManifest();
  m.config = { camera: built.pack.camera, light: built.pack.light };   // shared game-wide config
  // ATLASES DO NOT GO IN localStorage. They are ~1.4 MB of base64 per unit and were 99.9% of every
  // manifest entry — three units reached 4.2 M chars and the write started throwing. localStorage now
  // holds the ~800-char DESCRIPTOR; the pixels live in IndexedDB (a separate, far larger budget) and
  // ship to disk as real PNGs.
  // Same for an embedded Tier C model: 742K chars of base64 for ONE unit. localStorage keeps the
  // dimensions so the descriptor stays meaningful; the voxels go to IndexedDB and ship as their own file.
  let lean = built.pack;
  if (lean.model && lean.model.b64) lean = Object.assign({}, lean, { model: { nx: lean.model.nx, ny: lean.model.ny, nz: lean.model.nz } });
  m.units = m.units || {}; m.units[built.pack.id] = { pack: lean };
  try {
    await idb.put('atlas:' + built.pack.id, built.atlases);
    await idb.put('model:' + built.pack.id, (built.pack.model && built.pack.model.b64) ? built.pack.model : null);
  }
  catch (e) { return saveFailed('ATLAS STORE FAILED', `Could not store the sprite atlases for "${built.pack.id}".

${(e && e.message) || e}`); }
  const json = JSON.stringify(m);
  // SIZE IS THE REAL DEFECT, so state it every save instead of waiting for the write to throw.
  // 99.9-100% of every entry is base64 PNG; the descriptor is ~1KB. Three units already reach 4.2M
  // chars, and localStorage is the wrong home for that — see SAVE-ARCHITECTURE-PLAN.md steps 2-3.
  const bulk = (e) => JSON.stringify(e || {}).length
    ;
  const ids = Object.keys(m.units || {});
  const heavy = ids.map((k) => [k, bulk(m.units[k])]).sort((x, y) => y[1] - x[1]);
  console.info(`[stack-forge] manifest ${json.length.toLocaleString()} chars across ${ids.length} unit(s) — `
    + heavy.map(([k, n]) => `${k} ${(n / 1024).toFixed(0)}KB`).join(', '));
  const embedded = (((built.pack || {}).model || {}).b64 || '').length;
  if (embedded) console.warn(`[stack-forge] "${built.pack.id}" embeds ${embedded.toLocaleString()} chars of voxel`
    + ` geometry (Save as 3D). Only Tier C units are rendered as live voxels in-game — for every other unit`
    + ` this is dead weight in the manifest.`);
  if (json.length > 1_500_000) {
    const mb = (json.length / 1048576).toFixed(2);
    console.warn(`[stack-forge] manifest is ${mb}M chars — approaching the localStorage ceiling. Ship it.`);
    $('saveState').innerHTML = `<b style="color:#e0975f">⚠ manifest ${mb}M chars — Ship it to disk soon</b>`;
  }
  try { localStorage.setItem(MANIFEST_KEY, json); }
  catch (e) { return saveFailed('STORAGE FULL',
    `The units manifest is ${json.length.toLocaleString()} characters and will not fit in localStorage.` +
    `

Use 🚀 Ship manifest to write it to disk, then clear the browser copy.` +
    `

(${(e && e.name) || e})`); }
  lastPack = built;
  $('saveState').innerHTML = v.ok ? `<span class="lock">Saved "${built.pack.id}" ✓ (schema-valid)</span>` : 'Saved, but INVALID: ' + v.errors.join('; ');
  $('packJson').textContent = JSON.stringify(built.pack, null, 2);
  renderManifest();
  thumbInvalidate(built.pack.id);
  renderRoster();        // flip this unit's card to "supplied ✓"
  renderScaleChart();    // the new unit joins the side-view scale chart
  return { ok: true, id: built.pack.id, chars: json.length, valid: v.ok };
}
$('saveUnit').onclick = () => openSaveModal();   // the Save button opens the SAVE MODAL — id, faction, destination, then a deliberate choice

// ── downloads ──
const dl = (name, url) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
$('dlSheet').onclick = () => {
  const built = lastPack && lastPack.pack.id === ($('uid').value || 'unit').trim() ? lastPack : buildPack();
  dl(built.pack.parts[0].atlas, built.atlases.body);
  dl(built.pack.parts[1].atlas, built.atlases.turret);
  dl(`${built.pack.id}.json`, 'data:application/json,' + encodeURIComponent(JSON.stringify(built.pack, null, 2)));
};
$('dlManifest').onclick = () => dl('units.json', 'data:application/json,' + encodeURIComponent(JSON.stringify(loadManifest(), null, 2)));
// ONE-CLICK ship (owner 2026-07-16): write the live manifest straight to the repo ship path through
// the dev server's /__ship — the deployed game reads content/units/voxel-units.json, and forgetting
// this export was why deployed showed no voxel units. Static site: POST fails → graceful message.
// SHIP = write real files. Sprite atlases go to disk as PNGs under content/units/voxel/ and the manifest
// ships as DESCRIPTORS ONLY (~1KB/unit instead of ~1.4MB). loader.js:50 already resolves
// `entry.atlases[pt.id] || atlasBase + pt.atlas` and :32 passes atlasBase='content/units/voxel/' for the
// shipped file, so this needs ZERO game changes — inline base64 was only ever the first branch of a
// fallback that has always existed. Measured before: 3 units = 4,223,752 chars, 99.9% of it base64.
const shipFile = async (path, payload) => {
  const r = await fetch('/__ship', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ path }, payload)) });
  const d = await r.json().catch(() => ({ ok: false, error: 'not a dev server' }));
  if (!d.ok) throw new Error(`${path}: ${d.error || 'unknown'}`);
  return d;
};
// ── THE CARD IMAGE (DDD-6) ────────────────────────────────────────────────────────────────────────
// "If a unit has vox data then bake and save an image rendered from the vox" (owner 2026-08-07). ONE
// frame of the model, at the bake tilt and facing 0 so it reads the way the atlas frame it stands in for
// would, cropped to the unit and written to the REPO — art belongs in the repository, not in a database.
//
// It is deliberately NOT under content/units/voxel/ and is never named by a pack's parts[]: the game
// never loads it, so it cannot reach loader.js, pack.test.mjs or the atlas-size gate. It is a picture of
// a unit for a person to look at.
//
// Rendered through drawScene — ONE scene — into a throwaway target from mkTarget(). bakeAngleCache
// renders N frames into PIXI render textures and is far too heavy for this; and passing a fresh target
// rather than voxMeta is what keeps the live orbit canvas untouched.
/** AAA-7: crop a rendered target to its drawn pixels and lay that into the PICTURE REGION of a standard
 *  CARD_PX square, with `label`'s id and dimensions composited into the caption band underneath.
 *  The size is FIXED, not derived from the roster's CSS box — a card on disk must not change shape
 *  because a grid did. The background is opaque so the file reads on its own, outside this tool. */
function cropToCard(src, label) {
  const g0 = src.getContext('2d', { willReadFrequently: true });
  const d = g0.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    if (d[(y * src.width + x) * 4 + 3] <= 8) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < x0) return null;                                        // nothing was drawn — an empty model
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  const cv = document.createElement('canvas'); cv.width = CARD_PX; cv.height = CARD_PX;
  const g = cv.getContext('2d'); if (!g) return null;
  g.fillStyle = CARD_BG; g.fillRect(0, 0, CARD_PX, CARD_PX);
  const s = Math.min((CARD_PX - 8) / sw, (CARD_ART - 8) / sh), w = sw * s, h = sh * s;
  g.drawImage(src, x0, y0, sw, sh, (CARD_PX - w) / 2, (CARD_ART - h) / 2, w, h);
  drawCardBand(g, label && label.name, label && label.dims);
  return cv;
}
/** Bake the card image for the unit CURRENTLY IN THE EDITOR and write it to the repo.
 *  `p` is the project snapshot the save just wrote, so the signature describes exactly what was saved.
 *  Returns a result object — never throws, and never claims a write that did not happen. */
async function saveCardImage(id, p) {
  let sig = '';
  try { sig = modelSigOf(p || snapshotProject(id)); } catch (e) { return { ok: false, kind: 'SIG FAILED', detail: (e && e.message) || String(e) }; }
  if (!sig) return { ok: false, kind: 'NO VOX', detail: 'the model has no filled voxels — the card falls back to the slices' };
  if (!bodyFaces) return { ok: false, kind: 'NO MODEL', detail: 'nothing is built in the editor' };
  let url;
  try {
    const t = mkTarget(2, voxBounds.R, voxBounds.HT);             // 2 px per voxel, then downscaled into the card
    drawScene(t, bakeElOf(), 0, 0, { card: true });               // both parts, no selection / orientation tags / dim box
    // THE CAPTION DESCRIBES WHAT THE PICTURE IS OF. Both come from the LIVE editor model in the same
    // breath — the picture from drawScene, the dimensions from the same grid it just drew — so the file
    // cannot ship a caption for one model over a render of another.
    const cv = cropToCard(t.cv, { name: id, dims: cardDimsLive() });
    if (!cv) return { ok: false, kind: 'NOTHING DRAWN', detail: 'the model rendered empty' };
    // BBB-1: JPEG. cropToCard fills CARD_BG across the whole square before it draws, so the card has no
    // alpha to lose — see CARD_MIME for what this does and does not buy.
    url = cv.toDataURL(CARD_MIME, CARD_JPEG_Q);
    // A CANVAS THAT CANNOT ENCODE THE FORMAT SILENTLY GIVES YOU A PNG, and toDataURL says so in the
    // prefix. Shipping that under a .jpg name would put a PNG on disk with the wrong extension, and
    // /__ship's magic-byte check would reject it as "payload is not a JPEG" — a confusing report of a
    // real problem. Name the file after what was actually encoded.
  } catch (e) { return { ok: false, kind: 'RENDER FAILED', detail: (e && e.message) || String(e) }; }
  const path = CARD_SHIP_DIR + id + (url.startsWith('data:image/jpeg') ? '.jpg' : '.png');
  try {
    // /__ship IS THE ONLY WRITE PATH and it needs the dev server. Opened from GitHub Pages there is no
    // POST endpoint, so this fails — and the card then falls back to the unit's slices for that session
    // rather than pretending an image was saved.
    const d = await shipFile(path, { b64: url });
    // STAMP WHAT IT DEPICTS. cardSig lives beside the descriptor in the browser manifest, is read by
    // exactly one consumer (thumbResolve) and is NOT shipped: freshness is a claim only the browser that
    // wrote the image can make. Where it is unknown the card says "model" and claims nothing further.
    try {
      const m = loadManifest(); m.units = m.units || {};
      m.units[id] = Object.assign({}, m.units[id], { cardSig: sig });
      localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
    } catch (e) { /* a full manifest costs freshness, not the image */ }
    // ONE CARD PER UNIT, NOT ONE PER FORMAT. Writing <id>.jpg beside an existing <id>.png would leave the
    // PNG in the repo forever: the resolver prefers the JPEG, so the PNG becomes a file nothing reads and
    // nothing updates — a picture of a unit as it was, sitting next to the unit, which is exactly the
    // "data pollution" removal was built for. Best effort: a failure here costs a stale sibling, never the
    // card that was just written, so it can only report, never throw.
    for (const ext of CARD_READ_EXT) {
      const sib = CARD_SHIP_DIR + id + ext;
      if (sib === path) continue;
      try { await unshipFile(sib); } catch (e) { /* no dev server, or it was not there */ }
    }
    thumbInvalidate(id);
    return { ok: true, path, bytes: d.bytes || 0 };
  } catch (e) {
    thumbInvalidate(id);
    return { ok: false, kind: 'NOT WRITTEN', detail: (e && e.message) || String(e) };
  }
}
// SAY WHAT HAPPENED TO THE PICTURE. A write that could not happen must be visible, not silent — the
// deployed site has no /__ship, and "the card looks wrong" is otherwise unexplainable from the UI.
function cardImageNote(r) {
  if (r && r.ok) return `🖼 Card image → <b>${r.path}</b> · ${CARD_PX}×${CARD_PX}, captioned <code>${cardDimsLive()}</code>`
    + ` (${(r.bytes / 1024).toFixed(0)}KB) — commit it with the unit.`;
  if (r && r.kind === 'NO VOX') return `<span style="opacity:.7">🖼 No voxels yet — the card shows the source slices.</span>`;
  return `<span style="color:#e0975f">⚠ Card image NOT written (${(r && r.kind) || 'unknown'}) — the card falls back to the slices.`
    + ` /__ship needs the local dev server (python serve_prototype.py).</span>`;
}
$('shipManifest').onclick = async () => {
  // MERGE, NEVER REPLACE. Ship used to write loadManifest() wholesale, replacing the committed file with
  // whatever THIS browser held. A browser with 3 units silently deleted the other 4 from a 6-unit file --
  // GND-HeavyTanks among them. Read disk first and merge over it: shipping can only ADD or UPDATE.
  const m = loadManifest(), ids = Object.keys(m.units || {});
  // AN UNREADABLE DISK MANIFEST ABORTS THE SHIP. The merge below only protects on-disk units when this
  // read SUCCEEDS — a network error or malformed JSON left onDisk empty, and the write then went ahead and
  // deleted every unit this browser did not know about. That is the exact failure that lost four units.
  // A 404 is different and safe: nothing has been shipped yet, so there is nothing to lose.
  let onDisk = { units: {} };
  try {
    const r = await fetch('../../content/units/voxel-units.json', { cache: 'no-store' });
    if (r.ok) onDisk = await r.json();
    else if (r.status !== 404) return saveFailed('SHIP ABORTED — CANNOT READ DISK',
      `content/units/voxel-units.json returned ${r.status}. Shipping would overwrite it with only the `
      + `${ids.length} unit(s) this browser holds, deleting anything else on disk. Nothing was written.`);
  } catch (e) {
    return saveFailed('SHIP ABORTED — CANNOT READ DISK',
      `Could not read content/units/voxel-units.json — ${(e && e.message) || e}. Shipping would overwrite `
      + `it with only the ${ids.length} unit(s) this browser holds. Nothing was written.`);
  }
  const kept = Object.keys(onDisk.units || {}).filter((k) => !ids.includes(k));
  if (!ids.length) { $('projState').textContent = 'Nothing to ship — the units manifest is empty.'; return; }
  $('projState').textContent = `Shipping ${ids.length} unit(s)…`;
  try {
    let files = 0, bytes = 0; const skipped = [];   // units whose local copy is not shippable — disk wins
    const lean = { config: m.config || onDisk.config, units: Object.assign({}, onDisk.units) };   // start from disk
    for (const id of ids) {
      const e = m.units[id], atl = e.atlases || (await idb.get('atlas:' + id).catch(() => null)) || {};
      for (const pt of (e.pack.parts || [])) {                      // atlas + optional shadow, per part
        for (const [key, name] of [[pt.id, pt.atlas], [pt.id + '.shadow', pt.shadowAtlas]]) {
          const url = atl[key]; if (!url || !name) continue;
          const d = await shipFile(UNIT_SHIP_DIR + name, { b64: url });
          files++; bytes += d.bytes || 0;
        }
      }
      // GEOMETRY BY PATH. A Tier C model is ~742K chars of base64 — 99% of the shipped file for one
      // unit. Write it as its own JSON and leave a `src` behind; loader.js hydrates it before
      // buildLive3D reads pack.model. Non-Tier-C units never have one.
      let pack = e.pack;
      if (pack.model && !pack.model.b64) {                            // voxels live in IndexedDB now
        const stored = await idb.get('model:' + id).catch(() => null);
        if (stored && stored.b64) pack = Object.assign({}, pack, { model: stored });
      }
      if (pack.model && pack.model.b64) {
        const rel = 'model/' + id + '.json';
        const d = await shipFile('content/units/' + rel, { data: pack.model });
        files++; bytes += d.bytes || 0;
        pack = Object.assign({}, pack, { model: { nx: pack.model.nx, ny: pack.model.ny, nz: pack.model.nz, src: rel } });
      }
      // AN INVALID DESCRIPTOR MUST NOT REPLACE A GOOD ONE. "Save geometry" writes a stub — id, class,
      // footprint, geometryOnly — with no camera, no layerSpacing and no parts. It fails validatePack, so
      // loader.js drops the unit and it vanishes from the game. Shipping that over an already-shipped unit
      // therefore DESTROYS it. Keep what is on disk instead, and say which and why.
      const v2 = validatePack(pack);
      if (!v2.ok) {
        if (onDisk.units && onDisk.units[id]) { skipped.push(`${id} (${v2.errors.join('; ')})`); continue; }
        return saveFailed('SHIP ABORTED — INVALID DESCRIPTOR',
          `"${id}" is not a shippable pack: ${v2.errors.join('; ')}. Bake and save it before shipping. `
          + 'Nothing was written.');
      }
      lean.units[id] = { pack };                                      // descriptor only — no inline base64
    }
    const d = await shipFile('content/units/voxel-units.json', { data: lean });
    for (const id of ids) thumbInvalidate(id);                    // the atlases are IN THE REPO now — the cards can show them
    renderRoster();
    const before = JSON.stringify(m).length, after = JSON.stringify(lean).length;
    if (kept.length) console.info(`[stack-forge] kept ${kept.length} unit(s) already on disk: ${kept.join(', ')}`);
    $('projState').innerHTML = `🚀 Shipped <b>${ids.length}</b> unit(s)` + (kept.length ? `, kept <b>${kept.length}</b> already on disk` : '') + `: ${files} PNG(s)`
      + ` (${(bytes / 1048576).toFixed(2)} MB) → content/units/voxel/, manifest ${after.toLocaleString()} chars`
      + ` (was ${before.toLocaleString()}, ${(100 - 100 * after / before).toFixed(1)}% smaller) — commit to deploy.`;
    console.info(`[stack-forge] shipped ${files} atlas file(s), manifest ${before.toLocaleString()} → ${after.toLocaleString()} chars`);
  } catch (e) {
    const msg = `SHIP FAILED

${(e && e.message) || e}

On the deployed static site there is no POST endpoint — use Download units.json instead.`;
    console.error('[stack-forge] ' + msg);
    $('projState').innerHTML = `<b style="color:#ff6b6b">✗ SHIP FAILED — ${(e && e.message) || e}</b>`;
    alert(msg);
  }
};

// ── DECOR (Stage 1): author a static prop as the BODY (Top/Side/Front), bake ONE frame + one real cast
// shadow, and save/ship a decor pack the map generator auto-scatters. Reuses the unit carve/render/shadow;
// no turret, no rotation. Decor packs live in their OWN manifest (bulwark:stackforge:decor) and ship path
// (content/decor/voxel-decor.json), so the unit flow is completely untouched.
const DECOR_MANIFEST_KEY = 'bulwark:stackforge:decor';
const DECOR_FRAMES = 1;
const DECOR_TERRAINS = ['open', 'brush', 'trees', 'rocks', 'cliff'];   // affinity keys (Stage 2 maps these to the map's terrain ids)
const loadDecorManifest = () => { try { return JSON.parse(localStorage.getItem(DECOR_MANIFEST_KEY) || '{}'); } catch (e) { return {}; } };
function renderDecorManifest() {
  const el = $('decorManifest'); if (!el) return;
  const m = loadDecorManifest(), ids = Object.keys(m.decor || {});
  el.innerHTML = ids.length
    ? ids.map((id) => { const d = (m.decor[id].pack && m.decor[id].pack.decor) || {}; return `<div class="u"><b>${id}</b><span>${(d.affinity || []).join('/') || 'any'} · d${d.density != null ? d.density : '?'}${d.blocks ? ' · blocks' : ''}</span></div>`; }).join('')
    : 'No decor saved yet.';
}
function decorFields() {
  const affinity = DECOR_TERRAINS.filter((t) => { const c = $('decAff_' + t); return c && c.checked; });
  const density = $('decDensity') ? +$('decDensity').value : 50;
  const blocks = !!($('decBlocks') && $('decBlocks').checked);
  return { affinity, density, blocks, scale: state.decorScale || 1 };   // Story 7: on-map scale carried in the pack
}
function setDecorFields(d) {                                        // restore the 🌿 panel from a saved decor's metadata
  d = d || {};
  for (const t of DECOR_TERRAINS) { const c = $('decAff_' + t); if (c) c.checked = (d.affinity || []).includes(t); }
  if ($('decDensity')) { $('decDensity').value = d.density != null ? d.density : 50; if ($('decDensityV')) $('decDensityV').textContent = $('decDensity').value; }
  if ($('decBlocks')) $('decBlocks').checked = !!d.blocks;
  state.decorScale = d.scale || 1;
  if ($('decScale')) { $('decScale').value = Math.round(state.decorScale * 100); if ($('decScaleV')) $('decScaleV').textContent = state.decorScale.toFixed(1) + '×'; }
}
// Terrain set: clicking a decor card LOADS the prop for editing (never saves). Flushes whatever we were on
// under its own namespace first, switches into decor editing (WIP isolated to `decor:`), restores the body
// art from the decor WIP + the panel fields from the saved pack. Saving stays explicit (🌿 Save/Ship).
function loadDecorForEdit(id) {
  clearTimeout(autosaveTimer);
  try {
    if (editingDecor) { const out = snapshotProject(editingDecor); if (projectHasContent(out)) putProject('decor:' + editingDecor, out); }
    else { const out = snapshotProject(activeUnitId); if (out && projectHasContent(out)) putProject('proj:' + out.id, out); }
  } catch (e) { /* best-effort flush */ }
  editingDecor = id;
  unTombstone('decor:' + id);                             // opening a prop is the deliberate ask for it to exist
  const entry = (loadDecorManifest().decor || {})[id];
  if ($('did')) $('did').value = id;
  if (entry && entry.pack) setDecorFields(entry.pack.decor);
  idb.get('decor:' + id).then((p) => {
    if (p) return loadProject(p).then(() => { forceDecorBodyOnly(); $('projState').textContent = `Loaded decor "${id}" — edit the body art, then re-bake/save in the 🌿 Decor panel.`; });
    forceDecorBodyOnly();
    $('projState').textContent = `Decor "${id}" has no editable source on this browser (shipped only) — its baked pack still ships.`;
  }).catch((e) => { $('projState').textContent = `Load failed for decor "${id}": ${(e && e.message) || e}`; });
}
function bakeDecor() {
  if (!bodyFaces) { alert('Decor: author the prop as the BODY first (load Top / Side / Front in step 1), then Bake decor.'); return; }
  // Frame and render at the SAME tilt. sp came from the ORBIT elevation while the frames rendered at
  // bakeElOf(), so with the orbit steeper than the bake tilt the render texture was shorter than the
  // model and the crown was clipped in the shipped sprite. doBake fixed this for units; decor was missed.
  const bEl = bakeElOf();
  const foot = state.foot, bL = state.bodyLayers, sp = layerSp(bEl), B = state.bakeScale;
  const g = geom(foot, bL, sp, 0);                                     // body-only, centred pivot
  const frame = bakeAngleCache(app.renderer, bodyFaces, { frames: DECOR_FRAMES, g, pivotFrac: 0.5, el: bEl, scale: B });
  const filled = buildModel('body', foot, bL).filled;
  const shadow = bakeShadowCache(app.renderer, filled, { frames: DECOR_FRAMES, g, pivotFrac: 0.5, el: bEl, scale: B, foot, layers: bL });
  state.decorBaked = { frame, shadow, g, sp, foot, layers: bL, scale: B, el: bEl };   // the tilt these pixels were drawn at
  $('decorBakeState').innerHTML = `<span class="lock">✓ Decor baked · 1 frame + cast shadow · ${g.RTW * B}×${g.RTH * B}</span>`;
}
function buildDecorPack() {
  const b = state.decorBaked, id = (($('did') && $('did').value) || 'decor').trim(), B = b.scale || 1;
  const fa = packAtlas(b.frame), sa = b.shadow ? packAtlas(b.shadow) : null;
  const pivot = [Math.round(b.g.CX * B), Math.round(b.g.BASEY * B)], meta = decorFields();
  const pack = {
    id, type: 'decor', class: 'decor', footprint: [b.foot, b.foot, b.layers],
    scale: { voxPerTile: VOX_PER_TILE, tiles: unitTiles(b.foot) },
    camera: { azimuth: 0, elevation: (b.el != null ? b.el : state.el) | 0 }, layerSpacing: Math.round(b.sp * 100) / 100,   // the BAKE tilt, matching the pixels
    voxel: { height: state.zScale }, renderScale: B,
    light: { azimuth: state.lightAz, contrast: state.lightK },
    parts: [
      { id: 'decor', kind: 'directional', facings: DECOR_FRAMES, atlas: `${id}.decor.png`, cell: fa.cell, cols: fa.cols, pivot, layers: b.layers, zeroFacing: '+x',
        ...(sa ? { shadowAtlas: `${id}.decor.shadow.png`, shadowCell: sa.cell, shadowCols: sa.cols } : {}) },
    ],
    shadow: sa ? { kind: 'baked', elevation: SHADOW_EL, dir: [SHADOW_DIRX, SHADOW_DIRY], alt: 0 }
      : { kind: 'ellipse', rx: Math.round(b.foot / 2), ry: Math.round(b.foot * 0.22), alt: 0 },
    decor: { affinity: meta.affinity, density: meta.density, blocks: meta.blocks, scale: meta.scale },   // Stage 2 auto-scatter + Story 7 on-map scale
  };
  const atlases = { decor: fa.canvas.toDataURL('image/png') };
  if (sa) atlases['decor.shadow'] = sa.canvas.toDataURL('image/png');
  return { pack, atlases };
}
// Ship the decor STRAIGHT TO DISK — the decor atlas is too big for localStorage (the units manifest fills
// it), so we never rely on the localStorage manifest here. Bake if needed, build the pack fresh, MERGE it
// into whatever's already shipped (so multiple props accumulate), and write the file. This is the one-click
// path: authoring → disk → Terrain Forge/​game read the shipped file.
async function shipDecor() {
  if (!state.decorBaked) bakeDecor();
  if (!state.decorBaked) { alert('Ship decor: author + bake the prop (body Front / Side) first.'); return; }
  const built = buildDecorPack();
  let man = { decor: {} };
  try { const r0 = await fetch('../../content/decor/voxel-decor.json', { cache: 'no-store' }); if (r0.ok) man = await r0.json(); } catch (_) {}   // accumulate onto the shipped file (tool runs from tools/voxel-stack)
  man.decor = man.decor || {};
  try { const ls = loadDecorManifest(); if (ls && ls.decor) Object.assign(man.decor, ls.decor); } catch (_) {}   // + any localStorage packs (if it had room)
  man.decor[built.pack.id] = built;                                                                              // the one we just built
  man.config = { camera: built.pack.camera, light: built.pack.light };
  try {
    const r = await fetch('/__ship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'content/decor/voxel-decor.json', data: man }) });
    const d = await r.json().catch(() => ({ ok: false, error: 'not a dev server' }));
    if (d.ok) {
      $('decorSaveState').innerHTML = `<span class="lock">🚀 Shipped "${built.pack.id}" (${Object.keys(man.decor).length} decor total) → content/decor/voxel-decor.json ✓</span>`;
      editingDecor = built.pack.id;
      try { unTombstone('decor:' + built.pack.id); putProject('decor:' + built.pack.id, snapshotProject(built.pack.id)); } catch (e) { /* WIP best-effort */ }
      if ($('decorPackJson')) $('decorPackJson').textContent = JSON.stringify(built.pack, null, 2);
      renderDecorManifestFromDisk(man);
      if (isDecorSet()) loadFaction(DECOR_SET);
    } else $('decorSaveState').textContent = `Ship failed: ${d.error || 'unknown'} (run on the dev server).`;
  } catch (e) { $('decorSaveState').textContent = 'Ship failed: ' + e.message; }
}
function renderDecorManifestFromDisk(man) {   // show the shipped list even when localStorage is full
  const el = $('decorManifest'); if (!el) return;
  const ids = Object.keys((man && man.decor) || {});
  el.innerHTML = ids.length ? ids.map((id) => { const dd = (man.decor[id].pack && man.decor[id].pack.decor) || {}; return `<div class="u"><b>${id}</b><span>${(dd.affinity || []).join('/') || 'any'} · d${dd.density != null ? dd.density : '?'}${dd.blocks ? ' · blocks' : ''}</span></div>`; }).join('') : 'No decor saved yet.';
}
// ONE CLICK = shipDecor: bake if needed → build the pack → write it to the LOCAL repo file. No localStorage.
if ($('decorSaveShip')) $('decorSaveShip').onclick = shipDecor;
if ($('bakeDecor')) $('bakeDecor').onclick = bakeDecor;
if ($('decDensity')) $('decDensity').oninput = () => { $('decDensityV').textContent = $('decDensity').value; };
// Stories 6 & 7 — procedural-tree params + on-map scale
const decRebuild = () => { gridModel = null; recarve(); renderGridView(); };
if ($('decScale')) $('decScale').oninput = () => { state.decorScale = (+$('decScale').value) / 100; if ($('decScaleV')) $('decScaleV').textContent = state.decorScale.toFixed(1) + '×'; };   // on-map size only — no re-carve
if ($('decProc')) $('decProc').onchange = () => { state.decorProc = $('decProc').checked; if ($('decProcRow')) $('decProcRow').style.display = state.decorProc ? '' : 'none'; decRebuild(); };
const decProcSlider = (id, key) => { if ($(id)) $(id).oninput = () => { state[key] = +$(id).value; if ($(id + 'V')) $(id + 'V').textContent = $(id).value; if (state.decorProc) decRebuild(); }; };
decProcSlider('decTrunkH', 'decorTrunkH'); decProcSlider('decTrunkR', 'decorTrunkR'); decProcSlider('decCanopyR', 'decorCanopyR'); decProcSlider('decCanopyBase', 'decorCanopyBase');
if ($('decCanopySeg')) $('decCanopySeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.decorCanopy = b.dataset.c; [...$('decCanopySeg').children].forEach((c) => c.classList.toggle('on', c === b)); if (state.decorProc) decRebuild(); };
renderDecorManifest();

// ── PROJECT save/load: the full working state (source art, cutout tuning, every setting) as one snapshot.
// Autosaves to IndexedDB per unit id (localStorage is too small for art) and restores on reopen; the same
// snapshot downloads/loads as a portable .sfproj.json file. ──
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const q = indexedDB.open('bulwark-stackforge', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('projects');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  }));
  const op = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const tx = db.transaction('projects', mode), rq = fn(tx.objectStore('projects'));
    tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error);
  }));
  return { put: (k, v) => op('readwrite', (s) => s.put(v, k)), get: (k) => op('readonly', (s) => s.get(k)),
    del: (k) => op('readwrite', (s) => s.delete(k)), keys: () => op('readonly', (s) => s.getAllKeys()) };
})();
// ── DELETE BEATS AUTOSAVE ─────────────────────────────────────────────────────────────────────────
// A delete used to be a coin flip. `document.addEventListener('click', scheduleAutosave, true)` is
// CAPTURE phase, so it fires on the very click that runs the delete — arming doAutosave 500ms out with
// the deleted unit still loaded in the editor. Whether the unit came back depended on whether that timer
// landed before or after the store round-trip. Cancelling the timer is not enough on its own either: the
// timer can already be overdue while confirm() blocks, and it then fires during the delete's own awaits.
//
// So a deleted key is TOMBSTONED, and every path that writes a project checks the tombstone. The delete
// is authoritative until the id is deliberately re-anchored — opened, loaded or explicitly saved — which
// is the only signal that says "I mean this id to exist again". Re-creating a removed unit under the same
// id therefore still works; nothing else can resurrect it.
const deletedKeys = new Set();
/** the id is wanted again: opened, loaded, or explicitly saved under. Removes the tombstone, if any. */
function unTombstone(key) { deletedKeys.delete(key); }
/** THE ONE WRITE for a WIP project. Every flush path routes through here, so a background save cannot
 *  quietly undo a delete from a code path that predates it. Resolves false when the write was refused. */
function putProject(key, p) {
  if (deletedKeys.has(key)) { console.warn('[stack-forge] refused to write ' + key + ' — it was deleted'); return Promise.resolve(false); }
  return Promise.resolve(idb.put(key, p)).then(() => true);
}
const b64FromU8 = (a) => { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const u8FromB64 = (s) => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
const loadImgURL = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
function imgURL(part, view) {
  const im = srcImg[part][view]; if (!im) return null;
  let u = imgURLCache[part][view];
  if (!u) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    c.getContext('2d').drawImage(im, 0, 0); u = imgURLCache[part][view] = c.toDataURL('image/png'); }
  return u;
}
function snapshotProject(idOverride) {
  const images = {}, vox = {};
  for (const part of ['body', 'turret']) {
    images[part] = {}; for (const v of VIEWS) images[part][v] = imgURL(part, v);
    const m = voxPart[part];
    vox[part] = m ? { nx: m.nx, ny: m.ny, nz: m.nz, b64: voxB64[part] || (voxB64[part] = b64FromU8(m.data)) } : null;
  }
  // THE CARVED VOLUME. VOL is the model now, and it was serialised nowhere — so every voxel deleted in
  // a session was lost on reload while the save reported success. Stored like the .vox blob: one byte
  // per voxel, base64, stamped with the dims it was carved at so a resize can reject it instead of
  // mis-indexing. Only saved when it DIFFERS from a plain re-carve, so untouched units stay small.
  // COLOUR RIDES WITH THE GEOMETRY. vcol + PAINT were serialised NOWHERE, so every Paint stroke, Fill,
  // Mirror-colour and palette Remap survived only until the next reload or unit switch, while the save
  // reported success — the same defect this VOL block was written to fix, reintroduced one store over
  // when setVox/PAINT replaced the voxEdit colour half. PAINT is the flag that says "the artist chose
  // this"; without it a reload cannot tell authored colour from carve-derived colour, so both must go.
  // Only worth storing when something is actually painted: PAINT is one byte per voxel and compresses
  // to nothing, but vcol is three, and an untouched unit should not carry a megabyte of re-derivable art.
  const vol = {};
  for (const part of ['body', 'turret']) {
    const c = carveCache[part], V = c && c.m && c.m.VOL;
    if (!V) { vol[part] = null; continue; }
    const P = c.m.PAINT, painted = P ? P.some((b) => b) : false;
    vol[part] = { foot: c.foot, layers: c.layers, edited: !!volDirty[part], b64: b64FromU8(V),
      paint: painted ? b64FromU8(P) : null,
      vcol: painted && c.m.vcol ? b64FromU8(c.m.vcol) : null };
  }
  const st = { ...state }; delete st.baked; delete st.decorBaked;   // baked textures are PIXI objects — never serialise them into the WIP
  return { format: 'stackforge-project', version: 2, id: (idOverride || $('uid').value || 'unit').trim(), vol,
    state: st, flips: flipState, rots: rotState, keyTol: keyTolState, polys: polyState, picks: pickState, images, vox,
    carveCuts: { ...carveCuts },   // which slices cut — reset to top-only on every load until now
    // NO palMap / palKeep / palDrop / paletteN. They were the draw-time filter's state, saved beside a
    // model that did not contain the colours they produced. The palette lives in vol[].vcol now.
    geom: { body: { ...geomState.body }, turret: { ...geomState.turret } },
    imgXf: { body: JSON.parse(JSON.stringify(imgXf.body)), turret: JSON.parse(JSON.stringify(imgXf.turret)) } };   // SF2 per-side alignment
}
function syncAllControls() {
  const set = (id, val, lab) => { $(id).value = val; if (lab !== undefined) $(id + 'V').textContent = lab; };
  set('az', state.az | 0, (state.az | 0) + '°'); set('el', state.el | 0, (state.el | 0) + '°'); set('taim', state.taim | 0, (state.taim | 0) + '°');
  set('tdx', state.turretDx, '' + state.turretDx); set('tmz', state.mountZ, (state.mountZ > 0 ? '+' : '') + state.mountZ);
  set('tpiv', state.turretPivot, '' + state.turretPivot);
  set('blen', state.barrelLen, state.barrelLen || 'off'); set('brad', state.barrelRad, '' + state.barrelRad); set('belev', state.barrelElev, '' + state.barrelElev);
  set('bodyLayers', state.bodyLayers, '' + state.bodyLayers); set('turretLayers', state.turretLayers, '' + state.turretLayers);
  set('zScale', Math.round(state.zScale * 100), state.zScale.toFixed(2) + '×');
  set('lightAz', state.lightAz, state.lightAz + '°'); set('lightK', state.lightK, '' + state.lightK);
  set('bakeScale', state.bakeScale, state.bakeScale + '×');
  set('bakeEl', state.bakeEl == null ? 45 : state.bakeEl, (state.bakeEl == null ? 45 : state.bakeEl) + '°');   // bake tilt survives a project load
  $('res').value = state.foot; if ($('turretRes')) { const _tf = state.turretFoot || state.foot; $('turretRes').value = [16,24,32,48,64,96,128].includes(_tf) ? _tf : ''; } $('spin').checked = state.spin;
  if ($('decProc')) $('decProc').checked = !!state.decorProc;
  if ($('decProcRow')) $('decProcRow').style.display = state.decorProc ? '' : 'none';
  const setDec = (id, v, lab) => { if ($(id)) { $(id).value = v; if ($(id + 'V')) $(id + 'V').textContent = lab != null ? lab : v; } };
  setDec('decScale', Math.round((state.decorScale || 1) * 100), (state.decorScale || 1).toFixed(1) + '×');
  setDec('decTrunkH', state.decorTrunkH); setDec('decTrunkR', state.decorTrunkR); setDec('decCanopyR', state.decorCanopyR); setDec('decCanopyBase', state.decorCanopyBase);
  if ($('decCanopySeg')) [...$('decCanopySeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === (state.decorCanopy || 'cone')));
  [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.p === state.part));
  rig.scale.set(state.zoom);
}
async function loadProject(p) {
  bulkLoad = true;
  // THE OUTGOING UNIT'S GEOMETRY MUST GO WITH IT. carveCache holds VOL — the model itself — and
  // buildModelRaw returns the cached entry whenever foot/layers match, so a new unit of the same
  // dimensions inherited the previous unit's voxels. Undo/selection/palette were already discarded
  // here; the volume was not, because it only became the model when the voxEdit overlay was retired.
  carveCache.body = null; carveCache.turret = null; gridModel = null;
  // volDirty travels with the model it describes. Left true across a unit switch it would tell
  // buildModelRaw the INCOMING unit has hand work to protect, and its first carve would never run.
  volDirty.body = false; volDirty.turret = false; carveStale.body = false; carveStale.turret = false;
  carveStaleAck = { body: null, turret: null };
  volHistory.length = 0; volRedo.length = 0; gridSel = null; gridSelVox = null; gridSelView = null;   // undo history + selection belong to the OUTGOING unit — never let them apply to this one
  try {
    $('uid').value = p.id || 'unit'; activeUnitId = (p.id || 'unit');   // anchor the WIP key to the restored project
    unTombstone('proj:' + activeUnitId);        // loading a project IS the deliberate ask for this id to exist
    releaseBaked(state.baked); Object.assign(state, p.state || {}); state.baked = null;
    if (!(p.state && p.state.turretFoot)) state.turretFoot = state.foot;   // SF3: pre-turret-res projects → turret matches base
    delete state.paletteN;                    // a v1/v2 project may carry it; nothing reads it (FFF-8)
    // p.palMap / p.palKeep / p.palDrop are deliberately NOT restored, for the same reason p.voxEdit is
    // not: they fed a filter that no longer exists. A project saved before FFF-8 renders at the colours
    // its MODEL holds, which is the colour contract now — press Apply in the Palette window to re-reduce.
    // p.voxEdit (v1/v2 projects) is deliberately NOT restored: the store it fed was never read by the
    // model, so replaying it would restore nothing and cost a Map per part. The colour those projects
    // meant to carry is in p.vol[part].vcol/.paint, which restoreVol puts back.
    for (const part of ['body', 'turret']) geomState[part] = (p.geom && p.geom[part]) ? { ...p.geom[part] } : { auto: true, bottomFrom: 'top' };  // v1 projects → auto (identical to before)
    for (const part of ['body', 'turret']) imgXf[part] = (p.imgXf && p.imgXf[part]) ? p.imgXf[part] : mkXf();   // SF2 per-side alignment
    for (const part of ['body', 'turret']) {
      const pv = p.vox && p.vox[part];
      voxPart[part] = pv ? { nx: pv.nx, ny: pv.ny, nz: pv.nz, data: u8FromB64(pv.b64) } : null;
      voxB64[part] = pv ? pv.b64 : null;
      for (const v of VIEWS) {
        flipState[part][v] = (p.flips && p.flips[part] && p.flips[part][v]) || { h: false, v: false };
        rotState[part][v] = (p.rots && p.rots[part] && p.rots[part][v]) || 0;
        keyTolState[part][v] = (p.keyTol && p.keyTol[part] && p.keyTol[part][v]) || 75;
        polyState[part][v] = (p.polys && p.polys[part] && p.polys[part][v]) || null;
        pickState[part][v] = (p.picks && p.picks[part] && p.picks[part][v]) || [];
        const pick = pickFor(part, v), url = p.images && p.images[part] && p.images[part][v];
        if (url) { srcImg[part][v] = await loadImgURL(url); imgURLCache[part][v] = url; renderView(pick); }
        else {
          srcImg[part][v] = null; imgs[part][v] = null; imgURLCache[part][v] = null;
          pick.classList.remove('set'); updateFlipBtns(pick);
          pick.querySelector('canvas').getContext('2d').clearRect(0, 0, 128, 84);
        }
      }
    }
  } finally { bulkLoad = false; }
  // restore which slices cut BEFORE recarving, or the reload silently reverts to the default set
  if (p.carveCuts) Object.assign(carveCuts, p.carveCuts);
  syncAllControls(); recarve(); restoreVol(p); drawLight(); renderRoster();   // recarve rebuilds VOL from the art, THEN the saved hand edits go back on top
}
let autosaveTimer = 0;
// a project is worth persisting only if it has real editable content — source art, an imported .vox,
// or manual voxel edits. A baked-only pack preview (loadPackPreview clears the source) has NONE of
// these, so autosaving it would overwrite a genuine WIP with an empty shell and hijack sf:last — the
// root cause of "the unit I worked on reloads empty".
function projectHasContent(p) {
  for (const part of ['body', 'turret']) {
    if (p.vox && p.vox[part]) return true;
    if (p.vol && p.vol[part] && p.vol[part].edited) return true;   // hand-carved geometry IS content — a delete-only session scored 0 here and was discarded as an empty shell
    if (p.vol && p.vol[part] && p.vol[part].paint) return true;    // …and so is PAINT. A colour-only session scored 0 for exactly the same reason and was thrown away as an empty shell.
    if (p.images && p.images[part]) for (const v of VIEWS) if (p.images[part][v]) return true;
  }
  return false;
}
// Is there unsaved work? Set wherever the WIP is marked dirty, cleared on a successful save. Lets a
// LOAD skip a redundant re-write of a unit that was saved seconds ago -- with a per-voxel VOL blob now
// in every snapshot that write is no longer free, and it made 'load another unit' feel like a re-save.
let wipDirty = false;
function setWipStatus(txt, kind) { const el = $('wipStatus'); if (!el) return; el.textContent = txt; el.style.color = kind === 'saved' ? '#57d98a' : kind === 'dirty' ? '#e0b060' : 'var(--muted)'; }
function scheduleAutosave() {
  if (bulkLoad || loadingUnit) return;                    // never arm a save while a unit is loading (would key the OLD model to the NEW slot)
  clearTimeout(autosaveTimer); autosaveTimer = setTimeout(doAutosave, 500);
  wipDirty = true;
  setWipStatus('● unsaved…', 'dirty');
}
// THE STORE THAT HOLDS THE CARVING, AND THE LAST SAVE PATH THAT LIED. It returned void on three
// different outcomes — skipped, nothing-to-save, wrote — and its catch swallowed the exception behind a
// muted "⚠ save failed" label, discarding the reason. Callers could not tell success from failure, so
// "Save geometry" printed "card created" whether the geometry had been written or not.
// Now: every outcome is a result object, and a real failure goes through saveFailed like every other save.
async function doAutosave() {
  if (bulkLoad || loadingUnit) return { ok: false, kind: 'SKIPPED', detail: 'a load is in flight' };
  clearTimeout(autosaveTimer);
  const decorId = editingDecor;                            // editing a DECOR → isolate the WIP to the decor: namespace
  let p;
  try {
    p = snapshotProject(decorId || activeUnitId);          // key off the loaded unit/decor, not the mutable id box
  } catch (e) {
    wipDirty = true;
    return saveFailed('SNAPSHOT FAILED', `Could not capture "${decorId || activeUnitId}" — ${(e && e.message) || e}`);
  }
  // THE DELETE WINS, AND IT IS CHECKED FIRST. This is the click-armed timer landing while a removal is
  // still in flight, with the removed unit's model still in the editor — the resurrection this fix is
  // about. Ahead of the content test on purpose: a deleted key must not be written whatever it holds.
  // A distinct outcome, never a silent skip — a caller that thinks it saved must be able to see it did not.
  const wipKey = (decorId ? 'decor:' + decorId : 'proj:' + p.id);
  if (deletedKeys.has(wipKey)) { wipDirty = false; setWipStatus('— removed', 'muted'); return { ok: false, kind: 'DELETED', id: p.id, key: wipKey }; }
  // NOT an error, and NOT a save: a distinct outcome, so a caller cannot report a write that never happened.
  if (!projectHasContent(p)) { setWipStatus('— nothing to save', 'muted'); return { ok: false, kind: 'EMPTY', id: p.id }; }
  try {
    if (decorId) { await putProject('decor:' + decorId, p); localStorage.setItem('bulwark:sf:lastDecor', decorId); }
    else { await putProject('proj:' + p.id, p); localStorage.setItem('bulwark:sf:last', p.id); }
  } catch (e) {
    wipDirty = true;                                       // still unsaved — the next trigger must try again
    setWipStatus('⚠ save failed', 'dirty');
    return saveFailed('AUTOSAVE FAILED', `Could not write ${decorId ? 'decor:' + decorId : 'proj:' + p.id}`
      + ` to IndexedDB — ${(e && e.name) || ''} ${(e && e.message) || e}. Your work is still in the editor;`
      + ` fix the cause and save again before switching units.`);
  }
  const t = new Date().toLocaleTimeString();
  $('projState').textContent = `Autosaved ${decorId ? 'decor ' : ''}"${p.id}" · ${t}`;
  wipDirty = false;
  // THE CARD IS NOW OUT OF DATE. Marked dirty, not redrawn: an autosave fires 500ms after any input and
  // rebuilding a thumbnail on every keystroke is exactly the cost this cache exists to avoid. The card
  // refreshes on the next roster render — switching units, changing faction, saving — which is when
  // anyone is actually looking at it. (Marked, not deleted, so an edit that did not touch the slice the
  // card is drawn from revives the decoded canvas instead of re-keying it — see thumbResolve.)
  thumbInvalidate(p.id);
  const first = !(decorId ? decorWipIds : wipIds).has(p.id);
  (decorId ? decorWipIds : wipIds).add(p.id);
  if (first) renderRoster();                                     // first save of a unit → its card appears now, not on the next reload
  setWipStatus(`✓ saved ${t}`, 'saved');
  return { ok: true, id: p.id, decor: !!decorId, p };
}
if ($('wipSaveNow')) $('wipSaveNow').onclick = () => doAutosave();
document.addEventListener('input', scheduleAutosave, true);
document.addEventListener('change', scheduleAutosave, true);
document.addEventListener('click', scheduleAutosave, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) doAutosave(); });
window.addEventListener('pagehide', () => doAutosave());              // best-effort flush before a reload/close
window.addEventListener('beforeunload', () => doAutosave());          // capture edits made in the last moment
$('projSave').onclick = () => {
  const p = snapshotProject(), url = URL.createObjectURL(new Blob([JSON.stringify(p)], { type: 'application/json' }));
  dl(`${p.id}.sfproj.json`, url); setTimeout(() => URL.revokeObjectURL(url), 1500);
};
$('projLoad').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const p = JSON.parse(rd.result);
      if (p.format !== 'stackforge-project') throw new Error('not a Stack Forge project file');
      loadProject(p).then(() => { $('projState').textContent = `Loaded project "${p.id}".`; scheduleAutosave(); });
    } catch (err) { alert('Could not load that project — ' + err.message); }
  };
  rd.readAsText(f);
});

// ── faction unit set (left panel): ALL factions; a window per unit (empty = "needs art"); add units ──
// The Terrain set is a decor-only pseudo-faction: its roster comes from the DECOR manifest, cards LOAD a
// prop for editing (never save), and everything routes through the isolated decor flow — no unit collision.
const DECOR_SET = '🌿 Terrain (decor)';
// ⚠ UNASSIGNED is the home for ids whose prefix resolves to NO faction — `abrams`, the orphan `SPA-U3`.
// They used to appear under all nine factions at once (see renderRoster), which read as "this unit is in
// multiple factions" when the truth is that it is in none. They need exactly one place to be, and they
// must still be somewhere: content that is orphaned AND invisible is how orphans survive for months.
const UNASSIGNED_SET = '⚠ Unassigned';
const isDecorSet = () => curFaction === DECOR_SET;
// (isUnassignedSet lived here. Its one caller was renderRoster's bucketing test, which is now the shared
//  idBelongsToSet below — a one-line alias with no callers is the same dead store this file keeps deleting.)
// The two pseudo-sets are TOOL modes, not factions: neither has a prefix, a voice or a place in the
// game's faction list, so neither belongs in factions.js. `isPseudoSet` is the one test for "this entry
// in the dropdown is not a real faction" — every filter below reads it instead of comparing strings.
const isPseudoSet = (name) => name === DECOR_SET || name === UNASSIGNED_SET;
// THE ONE BUCKETING RULE: which set an id's card belongs to. renderRoster and the Remove dialog both read
// it, because a Remove dialog that disagreed with the roster would either offer units you cannot see or
// hide ones you can — and this rule is already the fix for "abrams appears in every faction at once".
function idBelongsToSet(id, setName) {
  if (setName === DECOR_SET) return true;                          // the decor roster is already id-complete
  const f = FAC.factionOfUnitId(id);
  return setName === UNASSIGNED_SET ? !f : (!!f && f.name === setName);
}
const FACTION_KEY = 'bulwark:sf:lastFaction';   // the set you were last working in
// THE REGISTRY IS THE LIST. This was a hand-typed array that had to stay in step with tables.js,
// menu.js and voice.js by hand — see src/data/factions.js for what that cost.
const FAC = BulwarkFactions;
// FAC.ALL is the nine playable factions plus System, in that order — so this no longer names 'System'
// as a literal. It did (`[...FAC.NAMES, FAC.SYSTEM.name, …]`, and again in UNIT_FACTIONS), which is the
// exact habit the registry exists to end: a display name spelled by hand in a second place.
const FACTIONS = [...FAC.ALL.map((f) => f.name), DECOR_SET, UNASSIGNED_SET];
const ROLES = ['Skirmisher', 'Support', 'Bruiser', 'Siege', 'Juggernaut', 'Harasser', 'Striker', 'Guided AA'];
// prefixFor GUESSED the id prefix as name.slice(0,3).toUpperCase() and was wrong for SIX of the nine
// factions — GRO/GND, HIG/HTC, WAT/WTR, SPA/SPC, DAR/DRK, GRE/GRN. Every unit the owner created in those
// six got an id the game could never resolve; the orphan SPA-U3 pack is exactly that. It is a LOOKUP now,
// and returns null rather than inventing a prefix for a faction that has none.
const prefixFor = (name) => { const f = FAC.find(name); return f ? f.prefix : null; };
// `filesIndex` used to live here: initFactions fetched content/units/index.json into it on every boot and
// NOTHING ever read it. It was the input to the old substring-matching fileForFaction; once that became a
// registry lookup the fetch was pure ceremony. Deleted rather than left as a store with no readers — that
// is the same shape as the voxEdit bug the handler gate was built for.
let curFaction = null, roster = [], noArtNote = '';   // noArtNote: why a roster is empty, shown instead of invented slots
// SHIPPED units (the deployed manifest with baked art) are pulled in so the roster/Load list surface
// units that exist in the game but were never saved in THIS browser — otherwise a fresh browser shows
// every slot as "needs art" and nothing loads. A localStorage-saved unit of the same id wins.
let shippedUnits = {};
const suppliedUnits = () => ({ ...shippedUnits, ...(loadManifest().units || {}) });
// …and the same for decor. The decor roster unioned the SHIPPED ids in but drew `supplied` from
// localStorage alone, so every prop that exists only on disk — which is all of them, the decor atlas is
// far too big for localStorage — showed "● WIP" over art that is baked, shipped and in the repo. That is
// exactly the badge-disagrees-with-the-picture failure this ticket is about, one store over.
let shippedDecor = {};
const suppliedDecor = () => ({ ...shippedDecor, ...(loadDecorManifest().decor || {}) });
async function loadShipped() {
  try { const d = await (await fetch('../../content/units/voxel-units.json')).json(); shippedUnits = d.units || {}; } catch (e) { shippedUnits = {}; }
}
// THE TOOL HEADER. Every Bulwark page wears the same one: which tool you are in, a link to every other
// tool, the file actions in a single strip, and one status slot. Before this the page's only heading was
// <h1>UNIT SET</h1> -- a panel title -- and there was no way to reach another tool except by editing the
// URL. The file actions here are DECLARED, not laid out: the header owns the presentation.
if (typeof ToolHead !== 'undefined') ToolHead.mount({
  tool: 'stack-forge',
  actions: [
    { label: '💾 Save…',  title: 'Name the unit and faction, then save geometry or everything', on: () => openSaveModal() },
    { label: '📂 Open…',  title: 'Load a saved unit or a project file', ghost: true, on: () => { const b = $('loadUnit'); if (b) b.click(); } },
    { label: '🚀 Ship',   title: 'Write sprite PNGs + the manifest into content/ — then commit to deploy', ghost: true, on: () => { const b = $('shipManifest'); if (b) b.click(); } },
    { label: '🎞 Sprites', title: 'Preview the baked sprite sheet — the frames that actually ship', ghost: true, on: () => { const b = $('spOpen'); if (b) b.click(); } },
  ],
  status: 'no unit loaded',
});
// Ids that have an editable WIP in IndexedDB. Kept as plain Sets because renderRoster is synchronous;
// refreshed whenever the set can have changed, never read straight from idb mid-render. The card path
// reads these to decide, WITHOUT touching IndexedDB, that a slot is genuinely empty — which is most of
// a roster, and is what keeps renderRoster from queueing a project read per designed-but-unauthored slot.
const wipIds = new Set(), decorWipIds = new Set();
async function refreshWipIds() {
  try {
    const keys = (await idb.keys()) || [];
    wipIds.clear(); decorWipIds.clear();
    for (const k of keys) {
      if (typeof k !== 'string') continue;
      if (k.startsWith('proj:')) wipIds.add(k.slice(5));
      else if (k.startsWith('decor:')) decorWipIds.add(k.slice(6));
    }
  } catch (e) { /* no store yet — the roster simply shows packs only */ }
}
async function initFactions() {
  await loadShipped();
  await refreshWipIds();                                          // so the first roster already shows carved-but-unbaked units                                            // so "supplied ✓" + Load reflect deployed art
  $('faction').innerHTML = FACTIONS.map((f) => `<option>${f}</option>`).join('');
  $('faction').onchange = () => loadFaction($('faction').value);
  // REMEMBER THE FACTION. It always reopened on FACTIONS[0], so work resumed under the wrong faction
  // while the geometry restored correctly — you would edit a unit and only later notice the faction was
  // wrong. Restored from the last one actually opened; an unknown/removed name falls back to the first.
  let want = FACTIONS[0];
  try { const last = localStorage.getItem(FACTION_KEY); if (last && FACTIONS.includes(last)) want = last; } catch (e) { /* private mode */ }
  $('faction').value = want;
  loadFaction(want);
}
// EVERY file the faction has, not the first one that matched. Two bugs died here. The original
// normalised the name, truncated it to FIVE characters and took the first substring hit in the content
// index — so 'System' matched three files and stopped at the first, and 'Air' truncated to "air" would
// match any future file containing it anywhere. GGG-2 replaced that with a registry lookup, but the
// registry still modelled ONE file per faction, so system-flak.units.json and system-base.units.json
// stayed unreachable and SYS-Flak/-2/-3, SYS-Base and SYS-Harvester remained unauthorable (GGG-6).
// The registry now declares a LIST and this returns all of it; a faction with no authored art returns
// [] and is REPORTED, instead of silently resolving to somebody else's file — which is how Artillery
// came to display Ground/Powder units.
function filesForFaction(name) {
  return FAC.filesOf(name);
}
async function loadFaction(name) {
  // LEAVING THE TERRAIN SET FOR UNITS. This flushed the decor and cleared editingDecor but left the decor's
  // art, VOL and geometry loaded in the editor, and never re-anchored activeUnitId. The next click anywhere
  // scheduled an autosave, which — with editingDecor now null — snapshotted the DECOR still in the editor
  // and wrote it to proj:<activeUnitId>, destroying that unit's WIP. One dropdown change from the Tree-1
  // wipe, running backwards. The fix is to leave nothing of the decor behind.
  //
  // Decor lives under System today and will eventually be authored per faction for maps, so this boundary
  // is going to carry more traffic, not less — it has to be clean before that lands.
  if (name !== DECOR_SET && editingDecor) {
    const leaving = editingDecor;
    try {
      const dout = snapshotProject(leaving);
      if (projectHasContent(dout)) await putProject('decor:' + leaving, dout);   // AWAITED: a fire-and-forget put can resolve after the unit loads and clobber it
    } catch (e) {
      return saveFailed('DECOR SAVE FAILED', `Could not save the prop "${leaving}" before leaving the Terrain set. `
        + `${(e && e.message) || e} — the switch was cancelled so nothing is lost.`);
    }
    editingDecor = null;
    clearSourceArt();                                              // the decor's art, VOL, spans and selection go with it
    releaseBaked(state.decorBaked); state.decorBaked = null; gridModel = null; state.part = 'body';
    activeUnitId = null;                                           // nothing is open yet — an autosave now has no unit to misfile into
    wipDirty = false;                                              // the decor is saved; the editor is empty. Nothing is pending.
    recarve();
  }
  curFaction = name; roster = []; noArtNote = '';
  try { localStorage.setItem(FACTION_KEY, name); } catch (e) { /* private mode */ }   // survive a reload
  if ($('faction') && $('faction').value !== name) $('faction').value = name;
  if (name === DECOR_SET) {                                        // Terrain set = decor mode (body-only + revolve + decor: autosave)
    // roster = every decor the browser knows: baked (manifest) + IN-PROGRESS WIP (IndexedDB decor:*)
    try { const r = await fetch('../../content/decor/voxel-decor.json', { cache: 'no-store' }); if (r.ok) { const sh = await r.json(); shippedDecor = (sh && sh.decor) || {}; } } catch (e) { /* shipped file (disk truth, since localStorage may be full) */ }
    const dm = suppliedDecor(), ids = new Set(Object.keys(dm));
    await refreshWipIds();                                        // decorWipIds — so a prop with only a WIP is still a card, and an empty slot is still decided without a read
    for (const id of decorWipIds) ids.add(id);
    roster = [...ids].map((id) => ({ id, role: dm[id] ? 'baked' : 'WIP', shape: '🌿', decor: true, wip: !dm[id] }));
    if (!editingDecor) {                                          // arriving fresh from a unit
      clearTimeout(autosaveTimer);
      try { const out = snapshotProject(activeUnitId); if (out && projectHasContent(out)) putProject('proj:' + out.id, out); } catch (e) { /* flush unit */ }
      const lastDecor = (() => { try { return localStorage.getItem('bulwark:sf:lastDecor'); } catch (e) { return null; } })();
      if (lastDecor && ids.has(lastDecor)) { renderRoster(); loadDecorForEdit(lastDecor); return; }   // reopen your last prop
      editingDecor = (($('did') && $('did').value) || 'decor').trim();   // else a clean new slate
      clearSourceArt(); releaseBaked(state.decorBaked); state.decorBaked = null; gridModel = null;
      state.bodyLayers = 64; if ($('bodyLayers')) { $('bodyLayers').value = 64; $('bodyLayersV').textContent = 64; }
      recarve();
    }
    renderRoster(); forceDecorBodyOnly(); return;
  }
  if (name === UNASSIGNED_SET) {                                   // no file, no prefix — renderRoster fills it from the orphans
    noArtNote = 'Ids whose prefix matches no faction. They resolve to no unit def, so the game can never '
      + 'spawn them. Rename one to a real <prefix>-<name> (see the Save dialog) or delete it.';
    renderRoster(); return;
  }
  // EVERY FILE, UNIONED. This read one file; System has three, so five units were unauthorable (GGG-6).
  const files = filesForFaction(name);
  const failed = [];
  for (const f of files) {
    try {
      const r = await fetch('../../content/units/' + f);
      if (!r || !r.ok) { failed.push(f); continue; }               // a 404 is a FAILURE, not an absence
      const u = (await r.json()).units || {};
      for (const id of Object.keys(u)) {
        if (roster.some((x) => x.id === id)) continue;             // ids are disjoint today; last-wins if they ever are not
        roster.push({ id, role: u[id].role || '', shape: u[id].shape || '' });
      }
    } catch (e) { failed.push(f); }
  }
  // NO ART FILE -> SAY SO. This fabricated eight slots named <PREFIX>-U1..U8 from a prefix that was wrong
  // for six of nine factions, and assigned the SAME string to role AND shape — every real unit has them
  // differ (role is what a unit DOES, shape is what it IS), so the fabricated rosters were malformed on
  // both axes. Six of nine factions hit this path, so most of what the tool showed was invented.
  // Now: an honest empty state. The roster stays empty and says why. (It cannot fall back to the unit
  // table — tables.js is an ES module and this tool is a classic script, so UNITS is not reachable here.
  // Whether those factions get real content files is GGG-4's decision, not something to paper over.)
  //
  // "DECLARED BUT DID NOT LOAD" IS NOT "NOT AUTHORED". The old catch swallowed a failed fetch and fell
  // into the empty-state branch, so opening the tool from file://, offline, or against a half-deployed
  // content/ told you Ground / Powder had "no authored art file yet" — pointing at content that does not
  // exist while the real file sat on disk. A load failure now names the files that failed.
  if (failed.length) {
    noArtNote = `${name} — could not load ${failed.join(', ')}. `
      + `${roster.length ? 'Some units are missing from this list.' : 'Its units cannot be listed.'} `
      + `The file is DECLARED, so this is a load failure, not missing art — check the server and reload.`;
  } else if (!roster.length) {
    const p = prefixFor(name);
    noArtNote = p
      ? `${name} — no authored art file yet. New units here will be ${p}-*.`
      : `${name} is not a known faction.`;
  }
  renderRoster();
}
// ── CARD THUMBNAILS (DDD-6) ───────────────────────────────────────────────────────────────────────
// Every card was a grey box, so the unit set read as a wall of identical slots with no way to tell a
// finished unit from an empty one without clicking it. The cause: the card drew
// `supplied[id].atlases.body` — an INLINE data-URL atlas on the manifest entry. Atlases left
// localStorage for IndexedDB (three units of inline base64 reached 4.2M chars and the write started
// throwing) and the shipped manifest is descriptors-only, so that field is absent on essentially every
// entry today and every card fell through to the placeholder. It also stretched the WHOLE atlas grid
// into the thumbnail when it did find one, so a card showed sixteen tiny units rather than one.
//
// ART LIVES IN THE REPO, NOT IN A DATABASE (owner 2026-08-07). So a card resolves its picture from
// content/**, and IndexedDB is consulted only for the artist's WORKING state (the slices and the voxel
// model of a unit that has no art yet) — never as the home of art. The chain, in priority order:
//
//   1  content/units/voxel/<id>.body.png   the baked atlas, frame 0        -> baked
//      (decor: the atlas embedded in content/decor/voxel-decor.json — still the repo, just inline)
//   2  content/units/card/<id>.png         a card image rendered from the  -> model
//      voxel model and written to the repo at save time (see saveCardImage)
//   3  the BASE (body) TOP slice, keyed                                    -> source
//   4  any other slice: body side, front, back, then turret top, side,     -> source
//      front, back — first that exists wins
//   5  nothing authored                                                    -> empty
//
// and one failure state that must never be mistaken for "never authored":
//   *  the manifest names an atlas that is NOT in the repo                 -> missing
//
// A card's BADGE is derived from the state its thumbnail actually resolved, so the two cannot disagree.
// The old badge read "✓ supplied" off the manifest while the picture was a grey box, and a corrupt
// atlas (im.onerror was unhandled) left exactly that pairing permanently.
// ── AAA-7: THE CARD IS A STANDARD 256×256 ARTIFACT ────────────────────────────────────────────────
// The saved picture used to be THUMB_W×THUMB_H — a size derived from a CSS grid box. That makes the file
// a by-product of a layout: change the roster and every card on disk is the wrong size. It is now a fixed
// square that anything can rely on, and it CARRIES ITS OWN CAPTION: the unit id and its dimensions are
// composited into the PNG, not laid over it in HTML. An HTML overlay produces a picture that means
// nothing the moment it leaves the roster — in a file browser, in a PR diff, pasted into a message.
//
// GEOMETRY. The square is split once and the split is a contract, because the grid crops on it:
//     [0 .. CARD_ART)      the picture
//     [CARD_ART .. 256)    the caption band: id, then dimensions
// The grid draws ONLY the picture region (text sized for 256 is an unreadable smudge at a third of it),
// the full-size view draws the whole square. ONE artifact, two crops — not two renders to keep in step.
const CARD_PX = 256;                     // the standard card artifact: square, fixed, never derived from a layout
const CARD_BAND = 44;                    // the caption band, reserved at the bottom
const CARD_ART = CARD_PX - CARD_BAND;    // 212 — the picture region, and the aspect the roster box carries
const CARD_BG = '#0a121c';               // OPAQUE. A transparent PNG with pale text is invisible in a file browser.
const THUMB_W = 152, THUMB_H = 126;      // the roster canvas: the ART REGION's aspect (256:212), scaled down
const THUMB_KEY_PX = CARD_ART;           // slices are keyed at CARD size, not photo size (see keyedCanvas)
const THUMB_POOL = 3;                    // concurrent resolves — enough to hide latency, few enough to leave the main thread alone
const UNIT_ATLAS_BASE = '../../content/units/voxel/';
// The card image is a UNIT artifact only. Decor ships its atlas inline in content/decor/voxel-decor.json
// the moment it is shipped, so a decor prop is either baked (and shows its atlas) or unshipped (and shows
// its slices) — there is no window a card image would fill, and a read path nothing writes is the same
// defect as a store nothing reads, pointing the other way.
const UNIT_CARD_BASE = '../../content/units/card/';
const CARD_SHIP_DIR = 'content/units/card/';
// ── BBB-1: THE CARD FILE IS A JPEG ────────────────────────────────────────────────────────────────
// Owner: "the cards can be compressed jpg images." It buys REPO AND DOWNLOAD size, and the honest size
// of that win is smaller than it sounds. MEASURED on a real card (GND-Artillery frame 0, letterboxed on
// CARD_BG, caption band composited): 13.9KB as PNG, 5.2KB as JPEG q0.9. Across a 90-unit catalog that is
// 0.46MB in the repo instead of 1.2MB — worth having, not transformative.
//
// IT BUYS NO MEMORY AT ALL, and nothing here should be read as claiming otherwise: a decoded 256×256
// bitmap is 256KB of backing store whatever the file it came from. The memory fix is the rung ORDER
// below — not decoding a 1296×1408 atlas to fill a 152×112 box — and it would be worth exactly as much
// if the card stayed a PNG.
//
// ALPHA. JPEG has none. The card was already opaque before this change and did not become opaque for it:
// cropToCard, cardCanvasOf and drawCardBand each fill CARD_BG across the full square before drawing,
// because a transparent PNG with pale text is invisible in a file browser (AAA-7). CHECKED, not assumed —
// the minimum alpha over a whole rendered card is 255. Nothing downstream
// reads a card's alpha — nothing downstream reads a card at all. content/units/card/ is named by this
// file and by its tests, and by nothing in the game: not loader.js, not a pack's parts[], not the atlas
// gate. It is a picture of a unit for a person to look at.
const CARD_MIME = 'image/jpeg';
// 0.9, chosen by measuring the thing that actually breaks. A card is flat voxel art on a near-black field
// with 11.5px MONOSPACE dimensions in the caption band, and small pale text on a dark ground is where JPEG
// fails first — so the band was measured on its own, not averaged into the picture that surrounds it.
// Worst channel error, whole card / caption band alone, and the size:
//     q0.80   4.1KB   max 49 / 36
//     q0.85   4.6KB   max 38 / 38
//     q0.90   5.2KB   max 23 / 20     <- the band's error roughly halves here, for 0.6KB
//     q0.95   6.5KB   max 23 / 17
// 0.9 is where the caption stops ringing; below it the digits visibly fringe, above it the file grows 25%
// to buy another 3/255. Across a 90-unit catalog the 0.85 -> 0.9 step costs 54KB total, which is not a
// trade worth making against a caption you have to squint at — the caption is the reason AAA-7 made the
// card an artifact instead of a thumbnail.
const CARD_JPEG_Q = 0.9;
// READ BOTH. Cards written before this change are .png and must keep resolving — the JPEG is the new
// WRITE format, not a demand that the repo be rewritten. Order is write-format-first: one 404 for a
// legacy card, none for a current one.
const CARD_READ_EXT = ['.jpg', '.png'];
// The ship-side spelling of UNIT_ATLAS_BASE. Removal has to name exactly the files the ship wrote, so
// the folder is a constant both halves read rather than a literal each of them repeats.
const UNIT_SHIP_DIR = 'content/units/voxel/';
// The one place a card's outcomes are spelled. `stale` rides on `model` as a modifier — a card image is
// derived from a model the artist keeps editing, and a three-edits-ago picture that looks current is a
// worse lie than a grey box.
const THUMB_STATES = {
  baked:   { badge: '✓ baked',       cls: 'ok'  },
  model:   { badge: '◆ model',       cls: 'mdl' },
  source:  { badge: '● slices',      cls: 'wip' },
  empty:   { badge: 'needs art',     cls: 'no'  },
  missing: { badge: '⚠ art missing', cls: 'err' },
  pending: { badge: '…',             cls: 'no'  },
};
// key -> { state, cv, sig, dirty }. Session memory only. A thumbnail is DERIVED — it must not become a
// persisted store, and the one thing that IS written (the card image) goes to the repo, not here.
// AAA-7: an entry is now the 256×256 ARTIFACT, not a grid-sized thumbnail — 256KB per card against the
// old 68KB, so a full nine-faction 90-unit tour holds ~23MB of canvas. Paid deliberately: the grid and
// the full-size view then read the SAME pixels (one scaled, one 1:1), so they cannot disagree, and
// opening a card is instant instead of a second async resolve that might land on newer state.
//
// BBB-1: …AND IT IS BOUNDED NOW. It was a plain Map, invalidated by id and evicted by nothing, so a
// nine-faction tour of a 90-unit catalog ended holding every card it had ever drawn. MEASURED: 23.8MB of
// canvas at 95 cards — which is real, and is also NOT what crashed the tab (dropping the whole cache
// mid-tour returned 3MB of 222; the other 219 was atlas decode, see thumbResolve). So this bound is
// hygiene with a number on it, not the fix, and it is written down that way so the next person does not
// go looking for a saving here that was never in it.
const thumbCache = new Map();
const thumbBusy = new Map();             // key -> true while a resolve is in flight (never two for one card)
const thumbEpoch = new Map();            // key -> generation, bumped on invalidate so an in-flight resolve cannot write back stale art
let thumbLive = [];                      // the cards on screen right now, so a late resolve can find its card
const thumbQueue = []; let thumbRunning = 0;
const thumbKey = (id, decorSet) => (decorSet ? 'decor:' : 'unit:') + id;
const thumbEpochOf = (key) => thumbEpoch.get(key) || 0;
// STALE, NOT DELETED. Invalidation keeps the entry so the next resolve can compare signatures and revive
// the already-decoded canvas when the art did not actually change — most autosaves change geometry, not
// the slice the card is drawn from, and re-keying an image for nothing is the expensive half.
function thumbInvalidate(id) {
  for (const key of [thumbKey(id, false), thumbKey(id, true)]) {
    thumbEpoch.set(key, thumbEpochOf(key) + 1);
    const hit = thumbCache.get(key); if (hit) hit.dirty = true;
  }
}
// ── THE BOUND ─────────────────────────────────────────────────────────────────────────────────────
// BY BYTES, NOT BY COUNT. Only entries that hold a canvas cost anything; `empty`, and a `missing` with
// nothing to draw, are a state string and a signature. Counting those against the bound would evict a
// picture to make room for the memory of not having one — and re-deciding an empty card costs a store
// read, so the free entries are also the ones least worth throwing away.
//
// 16MB = 64 cards at CARD_PX². The number is chosen against the two ways a bound goes wrong:
//   too small  — the LRU thrashes INSIDE one screen. The biggest roster the tool draws today is 18
//                cards (Ground / Powder: 8 designed + its extras); a bound under that would evict a card
//                the very next renderRoster is about to redraw, so every render re-resolves everything
//                and the "cache" makes the tool slower and hits the network harder than none at all.
//                64 is 3.5× the biggest roster — the current faction can never evict itself.
//   too large  — it is not a bound. 90 cards is 23.8MB, so anything at or above that is decoration.
// So: below the whole catalog, far above any one screen. Evicting costs one re-resolve — now a ~9KB
// card fetch and a 256×256 decode, since thumbResolve no longer reaches for the atlas.
const THUMB_CACHE_BYTES = 16 * 1024 * 1024;
const thumbBytesOf = (res) => (res && res.cv ? res.cv.width * res.cv.height * 4 : 0);
/** Move a key to the young end. Map iterates in insertion order, so re-inserting IS the LRU touch. */
function thumbTouch(key) {
  const hit = thumbCache.get(key);
  if (hit) { thumbCache.delete(key); thumbCache.set(key, hit); }
  return hit;
}
/** THE ONE WRITE into thumbCache, so a caller cannot add a canvas without paying the bound. Evicts from
 *  the old end until the total fits — but never a card that is ON SCREEN or open in the full-size view:
 *  dropping one of those would blank a card the user is looking at and immediately re-resolve it, which
 *  is the thrash above wearing a different hat. */
function thumbStore(key, res) {
  thumbCache.delete(key);
  thumbCache.set(key, res);
  const pinned = new Set(thumbLive.map((L) => L.key));
  if (cardView) pinned.add(cardView.key);
  pinned.add(key);
  let total = 0;
  for (const v of thumbCache.values()) total += thumbBytesOf(v);
  if (total <= THUMB_CACHE_BYTES) return;
  for (const k of [...thumbCache.keys()]) {
    if (total <= THUMB_CACHE_BYTES) break;
    if (pinned.has(k)) continue;
    const b = thumbBytesOf(thumbCache.get(k));
    if (!b) continue;                                  // free entries are not what the bound is about
    thumbCache.delete(k); total -= b;
  }
}
function thumbPump() {
  while (thumbRunning < THUMB_POOL && thumbQueue.length) {
    const job = thumbQueue.shift(); thumbRunning++;
    Promise.resolve().then(job).then(() => { thumbRunning--; thumbPump(); }, () => { thumbRunning--; thumbPump(); });
  }
}
/** decode a URL into an <img>, or null. A 404/corrupt file rejects — im.onerror used to be unhandled. */
const thumbImage = (url) => loadImgURL(url).then((im) => im, () => null);
/** IS IT IN THE REPO — asked without decoding it. A HEAD is ~200 bytes on the wire and zero pixels; the
 *  same question asked with `new Image()` costs the whole atlas (see thumbResolve). A network failure is
 *  reported as absent, which is what the old unhandled im.onerror silently meant too. */
const thumbHead = (url) => (String(url).startsWith('data:')
  ? Promise.resolve(true)                              // an inline atlas is already here; there is nothing to ask
  : fetch(url, { method: 'HEAD', cache: 'no-store' }).then((r) => !!r.ok, () => false));
/** ── DECODE SMALL, OR DO NOT DECODE ───────────────────────────────────────────────────────────────
 *  Decode ONE ATLAS FRAME straight to the size the card draws it at, and release it the moment it is
 *  blitted. `new Image()` cannot do either: it decodes the whole sheet and then hands the lifetime of
 *  that bitmap to the GC and to Chrome's own image cache.
 *
 *  MEASURED, 95 atlas loads (the six shipped body sheets, cache-busted so each is a distinct resource,
 *  which is what a 90-unit catalog is), Chrome private bytes across all processes after a forced GC:
 *      new Image()                                        337MB decoded ->  279MB still held
 *      createImageBitmap(blob) + .close()                 337MB decoded ->  279MB still held
 *      createImageBitmap(blob, cell, {resize}) + .close()  16MB decoded ->   15MB still held
 *  So `.close()` on its own buys NOTHING — the release everyone reaches for first is not the lever. The
 *  lever is never materialising the full sheet: crop and resize during the decode. 18× less held.
 *
 *  It degrades, it does not fail: no createImageBitmap, a resize option the browser ignores, a blob that
 *  will not decode — any of those falls back to the <img>, which is exactly today's behaviour. */
async function thumbFrameBitmap(url, cell, dw, dh) {
  if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return null;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r || !r.ok || typeof r.blob !== 'function') return null;
    const blob = await r.blob();
    const opt = { resizeWidth: Math.max(1, Math.round(dw)), resizeHeight: Math.max(1, Math.round(dh)), resizeQuality: 'pixelated' };
    // 'pixelated', not 'high'. These are voxel sprites drawn with imageSmoothingEnabled = false
    // everywhere else in this file; a smoothed downscale would make the card the one place the art is
    // blurred, and the card is meant to be a picture OF the sprite.
    return cell && cell.length >= 2
      ? await createImageBitmap(blob, 0, 0, cell[0], cell[1], opt)
      : await createImageBitmap(blob, opt);
  } catch (e) { return null; }
}
/** the atlas source named for this card, and the cell to cut frame 0 out of. */
function thumbAtlasOf(id, decorSet, entry) {
  const part = decorSet ? 'decor' : 'body';
  const pack = entry && (entry.pack || entry);
  const pt = pack && pack.parts && pack.parts.find ? pack.parts.find((q) => q.id === part) : null;
  const inline = entry && entry.atlases ? entry.atlases[part] : null;
  const url = inline || (pt && pt.atlas && !decorSet ? UNIT_ATLAS_BASE + pt.atlas : null);
  return { url, cell: pt && pt.cell ? pt.cell : null };
}
/** WHAT THE MODEL IS, as a short string. Changes whenever a voxel, its colour or its authorship does —
 *  so it can decide whether a saved card image still depicts the saved model. '' = no voxels at all. */
function modelSigOf(p) {
  let out = '', any = false;
  const hs = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  for (const part of ['body', 'turret']) {
    const v = p && p.vol && p.vol[part];
    if (!v || !v.b64) { out += '|-'; continue; }
    let A = null; try { A = u8FromB64(v.b64); } catch (e) { out += '|?'; continue; }
    let n = 0; for (let i = 0; i < A.length; i++) if (A[i]) n++;
    if (n) any = true;
    out += '|' + v.foot + 'x' + v.layers + ':' + n + ':' + hs(v.b64) + (v.vcol ? ':' + hs(v.vcol) : '') + (v.paint ? ':' + hs(v.paint) : '');
  }
  return any ? out : '';
}
/** the first slice this project actually has, in a fixed order: body top first (the owner's rule), then
 *  the rest of the body, then the turret. Returns the raw source URL plus everything needed to key it. */
const THUMB_SLICES = [];
for (const part of ['body', 'turret']) for (const view of ['top', 'side', 'front', 'back']) THUMB_SLICES.push([part, view]);
function thumbSliceOf(p) {
  for (const [part, view] of THUMB_SLICES) {
    const url = p && p.images && p.images[part] ? p.images[part][view] : null;
    if (!url) continue;
    return { part, view, url,
      flip: (p.flips && p.flips[part] && p.flips[part][view]) || { h: false, v: false },
      rot: (p.rots && p.rots[part] && p.rots[part][view]) || 0,
      tol: (p.keyTol && p.keyTol[part] && p.keyTol[part][view]) || 75,
      polys: (p.polys && p.polys[part] && p.polys[part][view]) || null,
      picks: (p.picks && p.picks[part] && p.picks[part][view]) || [] };
  }
  return null;
}
// WHICH DIMENSIONS (AAA-7). Two candidates: the voxel footprint the artist manipulates directly with the
// Resolution and Base-layers sliders, and `scale.tiles` — the size ON THE BOARD, which is what decides
// whether a unit reads correctly beside its neighbours. The card carries BOTH, because they are the two
// halves of the load-bearing world-scale contract (VOX_PER_TILE voxels = 1 tile): a card reading
// "64×64×35 vox · 2 tiles" makes that contract visible, and "96×96×40 vox · 2 tiles" would be a broken
// unit you could see at a glance. Either number alone hides the other.
//
// The height is the BODY grid's layer count, not the pack's footprint[2]: footprint[2] folds in the
// turret mount offset, which is a render bound the tool derives, not a size the artist sets. Every source
// below (live editor, saved project, shipped pack) can name the body grid, so one rule covers all of them
// and two cards of the same unit cannot quote different numbers.
const cardDimsText = (foot, layers) => {
  if (!foot || !layers) return '';
  const t = foot / VOX_PER_TILE;
  return `${foot}×${foot}×${layers} vox · ${+t.toFixed(2)} tile${t === 1 ? '' : 's'}`;
};
/** the dimensions of the model IN THE EDITOR — the same model drawScene is about to draw for the card. */
const cardDimsLive = () => cardDimsText(footOf('body'), state.bodyLayers);
/** the dimensions a saved project describes. The carved VOL is preferred over the slider state: it is
 *  what the picture is actually of, and a resize that has not been re-carved would otherwise be quoted. */
const cardDimsProject = (p) => {
  const v = p && p.vol && p.vol.body;
  if (v && v.foot && v.layers) return cardDimsText(v.foot, v.layers);
  const s = p && p.state;
  return s ? cardDimsText(s.foot, s.bodyLayers) : '';
};
/** the dimensions a shipped pack declares. */
const cardDimsPack = (entry) => {
  const pack = entry && (entry.pack || entry); if (!pack || !pack.footprint) return '';
  const body = pack.parts && pack.parts.find ? pack.parts.find((q) => q.id === 'body') : null;
  return cardDimsText(pack.footprint[0], (body && body.layers) || pack.footprint[2]);
};
/** THE CAPTION, drawn into the artifact. One function, so the band a card SAVES and the band the viewer
 *  composites for a card that has no file cannot say things in different shapes. */
function drawCardBand(g, name, dims) {
  g.save();
  g.fillStyle = CARD_BG; g.fillRect(0, CARD_ART, CARD_PX, CARD_BAND);
  g.fillStyle = '#1c2c40'; g.fillRect(0, CARD_ART, CARD_PX, 1);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // THE FULL ID, not the roster's prefix-stripped display name: the file has to identify its unit when
  // nothing around it does. Shrink to fit rather than clip — a truncated id names the wrong unit.
  let px = 17;
  g.fillStyle = '#e6eef6';
  if (name) {
    for (; px > 9; px--) { g.font = `600 ${px}px "Segoe UI",system-ui,sans-serif`; if (g.measureText(name).width <= CARD_PX - 16) break; }
    g.font = `600 ${px}px "Segoe UI",system-ui,sans-serif`;
    g.fillText(name, CARD_PX / 2, CARD_ART + 19);
  }
  if (dims) {
    g.fillStyle = '#8fa7bd'; g.font = '11.5px ui-monospace,SFMono-Regular,Menlo,monospace';
    g.fillText(dims, CARD_PX / 2, CARD_ART + 35);
  }
  g.restore();
}
/** WHERE A sw×sh PICTURE LANDS in the card's picture region, letterboxed with a 4px margin. Extracted so
 *  the two ways a frame reaches a card — scaled by drawImage, or scaled during the decode — cannot land it
 *  in two different places. No clamp at 1: a small frame is upscaled to fill the card, as it always was. */
function cardFit(sw, sh) {
  const s = Math.min((CARD_PX - 8) / sw, (CARD_ART - 8) / sh), w = sw * s, h = sh * s;
  return { s, w, h, x: (CARD_PX - w) / 2, y: (CARD_ART - h) / 2 };
}
/** an image fitted, letterboxed, into the PICTURE REGION of a fresh 256×256 card, with its caption band
 *  composited underneath. srcRect cuts one atlas frame. `label` may be null for a picture with no caption. */
function cardCanvasOf(im, srcRect, label) {
  const cv = document.createElement('canvas'); cv.width = CARD_PX; cv.height = CARD_PX;
  const g = cv.getContext('2d'); if (!g) return null;
  g.fillStyle = CARD_BG; g.fillRect(0, 0, CARD_PX, CARD_PX);     // opaque, so the file reads outside the tool
  if (im) {
    const sw = srcRect ? srcRect[0] : (im.width || im.naturalWidth || 1), sh = srcRect ? srcRect[1] : (im.height || im.naturalHeight || 1);
    const f = cardFit(sw, sh);
    g.imageSmoothingEnabled = false;
    // FRAME 0, NOT THE SHEET. The old draw was drawImage(im, 0, 0, 76, 56) — the whole 4×4 (or 8-cell)
    // atlas squeezed into the thumbnail, so a card that DID find its atlas showed a contact sheet.
    g.drawImage(im, 0, 0, sw, sh, f.x, f.y, f.w, f.h);
  }
  if (label) drawCardBand(g, label.name, label.dims);
  return cv;
}
/** A SAVED CARD FILE, shown as itself. When the PNG on disk already IS a 256×256 artifact its band is
 *  part of the file, so it is blitted 1:1 and NOT re-captioned — re-captioning would paint today's id and
 *  dimensions over a picture that may be three edits old, which is the exact lie `⟳ stale` exists to
 *  prevent. Anything that is not 256×256 (a card written before AAA-7) is treated as a bare picture. */
function cardCanvasFromFile(im, label) {
  const w = im.naturalWidth || im.width || 0, h = im.naturalHeight || im.height || 0;
  if (w !== CARD_PX || h !== CARD_PX) return cardCanvasOf(im, null, label);
  const cv = document.createElement('canvas'); cv.width = CARD_PX; cv.height = CARD_PX;
  const g = cv.getContext('2d'); if (!g) return null;
  g.fillStyle = CARD_BG; g.fillRect(0, 0, CARD_PX, CARD_PX);
  g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0);
  return cv;
}
/** THE SAVED CARD ARTIFACT, if the repo has one. Tries the JPEG this tool writes, then the PNG it used
 *  to — a card authored before BBB-1 must not disappear. Returns { cv, file } or null.
 *  `file` is the SHIP-side path, because that is what paintCardView quotes back to the artist. */
async function thumbCardFile(id, label) {
  for (const ext of CARD_READ_EXT) {
    const im = await thumbImage(UNIT_CARD_BASE + id + ext);
    if (!im) continue;
    return { cv: cardCanvasFromFile(im, label || null), file: CARD_SHIP_DIR + id + ext, ext };
  }
  return null;
}
/** THE ATLAS RUNG — now the fallback, and now decoded small. Cuts frame 0 straight to the size the card
 *  draws it at (thumbFrameBitmap), blits it, and closes the bitmap. Falls back to the old whole-sheet
 *  <img> decode when the browser cannot do that, so this can only be cheaper, never absent. */
async function thumbAtlasCard(atl, label) {
  const cell = atl.cell;
  if (cell && cell.length >= 2) {
    const f = cardFit(cell[0], cell[1]);
    const bm = await thumbFrameBitmap(atl.url, cell, f.w, f.h);
    if (bm) {
      const cv = document.createElement('canvas'); cv.width = CARD_PX; cv.height = CARD_PX;
      const g = cv.getContext('2d');
      if (g) {
        g.fillStyle = CARD_BG; g.fillRect(0, 0, CARD_PX, CARD_PX);
        g.imageSmoothingEnabled = false;
        g.drawImage(bm, Math.round(f.x), Math.round(f.y));
        if (label) drawCardBand(g, label.name, label.dims);
      }
      if (bm.close) bm.close();
      return g ? cv : null;
    }
  }
  const im = await thumbImage(atl.url);
  return im ? cardCanvasOf(im, cell, label) : null;
}
/** a slice, flipped/rotated as the artist set it and keyed the way the carve keys it, as a card canvas. */
function thumbSliceCanvas(im, sl, label) {
  // Flip then rotate, matching renderView's display-space convention — a card that shows a unit upside
  // down because the artist flipped the slice is not showing the unit.
  const swap = !!(sl.rot % 180), fh = swap ? sl.flip.v : sl.flip.h, fv = swap ? sl.flip.h : sl.flip.v;
  const flipped = (sl.flip.h || sl.flip.v) ? flipCanvas(im, fh, fv) : im;
  const orient = sl.rot ? rotCanvas(flipped, sl.rot) : flipped;
  return cardCanvasOf(keyedCanvas(orient, sl.tol, sl.polys, sl.picks, THUMB_KEY_PX), null, label);
}
// ── BBB-1: THE STATE IS ONE QUESTION, THE PICTURE IS ANOTHER ──────────────────────────────────────
// This function used to answer both with the same act: it DECODED the baked atlas, and whether that
// decode succeeded was simultaneously "is the art in the repo" and "what does the card show". That is
// why a 152×112 thumbnail cost a 1296×1408 decode — the tool was asking a yes/no question by
// materialising 7MB of pixels, ninety times.
//
// MEASURED, headless Chrome, a nine-faction tour of a 90-unit catalog (95 cards):
//     341MB decoded, Chrome private bytes 683MB -> 905MB.
//     Blocking JUST the atlas fetches and touring again: 673MB -> 673MB. Flat. Every megabyte of that
//     growth was this decode; none of it was PIXI, the DOM, the roster or the live view.
// Dropping the ENTIRE thumbCache at the end of the tour returned 3MB of the 222 — so the cache size, and
// the 256KB-per-card the standard card artifact costs, are not where the memory was. This was.
//
// Split in two, cheapest question first:
//   IS IT IN THE REPO   a HEAD. No pixels. Decides baked / missing exactly as before.
//   WHAT DOES IT SHOW   content/units/card/<id>.jpg|png — a 256×256 artifact, purpose-built, already the
//                       right shape for the box. The atlas is now the FALLBACK for a unit baked before
//                       card images existed, and when it is reached it is cropped and resized during the
//                       decode rather than materialised whole (thumbFrameBitmap).
//
// The five states and `stale` are untouched. `stale` still rides on `model` alone: for a baked unit the
// repo atlas is the authority and no freshness claim was ever made about it, so routing that unit's
// PICTURE through the card file must not start making one.
/** Resolve one card, once. Reads content/ for art and IndexedDB only for the artist's working state. */
async function thumbResolve(id, decorSet, entry, prev) {
  const atl = thumbAtlasOf(id, decorSet, entry);
  if (atl.url) {
    const dims = cardDimsPack(entry);
    // The two questions are independent, so they go out together — the card file must not wait on the HEAD.
    const [inRepo, card] = await Promise.all([thumbHead(atl.url), decorSet ? null : thumbCardFile(id, { name: id, dims })]);
    if (inRepo) {
      if (card && card.cv) return { state: 'baked', dims, cv: card.cv, file: card.file,
        sig: 'baked|card|' + card.file + '|' + atl.url.length };
      const cv = await thumbAtlasCard(atl, { name: id, dims });
      if (cv) return { state: 'baked', dims, cv, sig: 'atlas|' + atl.url.slice(0, 96) + '|' + atl.url.length };
    }
    // NAMED AND NOT THERE. This is the state that used to be indistinguishable from "never baked":
    // im.onerror was unhandled, so a missing or corrupt atlas silently left the placeholder while the
    // badge still claimed the unit was supplied. It is also the ordinary state of a unit baked in this
    // browser and not yet shipped — the atlas is real, it is just not in the repo.
    //
    // So: keep the STATE (red badge, red frame, "art missing"), and still show the unit's picture from
    // whatever else it has. Being unable to see a unit is the problem being fixed; a card that shows the
    // unit AND says its art is not in the repo tells the truth twice, and the frame stops it reading as
    // a healthy card.
    // `card` was already fetched above, so it is handed down rather than asked for a second time — a unit
    // baked in this browser and not yet shipped is the state the tool spends most of its time in, and
    // paying two round trips for one file on the busiest path would be a poor trade for tidier code.
    const fb = await thumbFallback(id, decorSet, prev, card);
    return { state: 'missing', cv: fb ? fb.cv : null, fbSig: fb ? fb.sig : null, dims: fb ? fb.dims : cardDimsPack(entry),
      sig: 'missing|' + atl.url.length + '|' + (fb ? fb.sig : '-') };
  }
  const fb = await thumbFallback(id, decorSet, prev);
  return fb || { state: 'empty', cv: null, sig: 'empty', dims: '' };
}
/** Everything below the baked atlas: the saved card image, then the source slices. Shared, because a
 *  unit whose atlas is missing from the repo needs the same picture as one that never had an atlas.
 *  `card` is thumbCardFile's answer when the caller has already asked; `undefined` means "not asked". */
async function thumbFallback(id, decorSet, prev, card) {
  const p = await idb.get((decorSet ? 'decor:' : 'proj:') + id).catch(() => null);
  if (!p) return null;
  const label = { name: id, dims: cardDimsProject(p) };
  // 2 — THE VOXEL MODEL. "If a unit has vox data then bake and save an image rendered from the vox"
  // (owner 2026-08-07). Read literally: the image is produced ONCE and written to the repo, not
  // re-rendered per roster draw. `vol` covers both kinds of vox data — an imported .vox is materialised
  // into VOL on load ("VOL: edits reach an imported .vox") and a carve writes VOL directly — so "has vox
  // data" is "VOL has filled voxels", which is the model the tool actually saves and ships.
  const msig = decorSet ? '' : modelSigOf(p);
  if (msig) {
    const got = card === undefined ? await thumbCardFile(id, label) : card;
    if (got && got.cv) {
      // FRESH ONLY IF IT DEPICTS THIS MODEL. cardSig is stamped beside the descriptor when the image is
      // written; a card image whose model has moved on is shown, and marked, never passed off as current.
      const stamped = ((loadManifest().units || {})[id] || {}).cardSig || null;
      return { state: 'model', cv: got.cv, sig: 'card|' + got.ext + '|' + msig,
        stale: stamped !== msig, dims: label.dims, file: got.file };
    }
    // vox but no card image in the repo — /__ship needs the dev server, so this is the normal state on
    // the deployed site. Fall through to the slices rather than show nothing.
  }
  const sl = thumbSliceOf(p);
  if (!sl) return null;
  // AAA-7: the CAPTION is part of the canvas now, so it is part of the signature. Without it a resize
  // would revive a picture captioned with the old dimensions — the revive would be caching a lie, and a
  // wrong caption on a right picture is the failure mode this whole ticket is about. It costs a re-key
  // only when foot/layers actually move, which is exactly when the carve is being redone anyway.
  const sig = 'slice|' + sl.part + '.' + sl.view + '|' + sl.url.length + '|' + sl.flip.h + sl.flip.v + '|' + sl.rot
    + '|' + sl.tol + '|' + (sl.polys ? JSON.stringify(sl.polys).length : 0) + '|' + sl.picks.length
    + '|' + label.dims;
  // THE SIGNATURE EARNS ITS KEEP HERE. An autosave fires 500ms after any input and invalidates the card,
  // but most edits are geometry — the slice is untouched. Reviving the decoded, keyed canvas costs a
  // string compare instead of an image decode plus a flood fill.
  // `fbSig` is what the FALLBACK last produced. A 'missing' card's own sig also names the atlas that
  // would not load, so comparing against that would never match and would re-key the slice on every
  // refresh — the one case where the revive is most wanted, because that card is refreshed the most.
  if (prev && prev.cv && (prev.fbSig || prev.sig) === sig) return { state: 'source', cv: prev.cv, sig, dims: label.dims };
  const im = await thumbImage(sl.url);
  if (!im) return { state: 'missing', cv: null, sig, dims: label.dims };
  return { state: 'source', cv: thumbSliceCanvas(im, sl, label), sig, dims: label.dims };
}
/** paint a resolved (or pending) state onto a card: picture, badge and the card's own state marker. */
function thumbPaint(card, res, u, decorSet) {
  const spec = THUMB_STATES[res.state] || THUMB_STATES.empty;
  card.dataset.thumb = res.state + (res.stale ? ' stale' : '');
  const b = card.querySelector ? card.querySelector('.badge') : null;
  if (b) { b.textContent = spec.badge + (res.stale ? ' ⟳ stale' : ''); b.className = 'badge ' + spec.cls; }
  const cvs = card.querySelector ? card.querySelector('canvas') : null;
  const g = cvs && cvs.getContext ? cvs.getContext('2d') : null;
  if (!g) return;
  g.clearRect(0, 0, THUMB_W, THUMB_H);
  // THE PICTURE REGION ONLY. The cached canvas is the whole 256×256 artifact, caption included; at a
  // third of that size the caption is an illegible smear that eats a fifth of the picture, so the grid
  // cuts [0, CARD_ART) and the text lives where it is readable — the saved file and the full-size view.
  // The card's own <div class="un"> already names it in real, selectable HTML at grid size.
  if (res.cv) { g.drawImage(res.cv, 0, 0, CARD_PX, CARD_ART, 0, 0, THUMB_W, THUMB_H); }
  else {
    g.fillStyle = res.state === 'missing' ? '#2a1420' : '#132234'; g.fillRect(0, 0, THUMB_W, THUMB_H);
    g.fillStyle = res.state === 'missing' ? '#ff6b6b' : '#3c5670';
    g.font = '18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(res.state === 'missing' ? '⚠' : (u.shape || u.role || '?'), THUMB_W / 2, THUMB_H / 2);
  }
  // The failure and the staleness are drawn ON the picture, not only beside it — a badge can be missed
  // at 8.5px, and "this looks current but is not" is the one failure a thumbnail makes worse.
  if (res.state === 'missing' || res.stale) {
    g.strokeStyle = res.state === 'missing' ? '#ff6b6b' : '#e0b060';
    g.lineWidth = 4; g.strokeRect(2, 2, THUMB_W - 4, THUMB_H - 4);
  }
}
/** queue a resolve for a card that has no cached thumbnail (or whose cache went dirty).
 *  There is NO `if (prev && !prev.dirty) return` here. It looks like the obvious guard and it was
 *  unreachable: renderRoster only calls this when the cache MISSED or when the entry is dirty, so the
 *  condition can never be true. Mutation testing found it — a dead guard is the same defect as a store
 *  nothing reads, and leaving one in makes the cache look protected in a place it is not.
 *  `thumbBusy` is the guard that is real: it stops two renders in the same tick queueing the same card. */
function thumbWant(key, id, decorSet, entry) {
  if (thumbBusy.get(key)) return;
  const prev = thumbCache.get(key);
  const gen = thumbEpochOf(key);
  thumbBusy.set(key, true);
  thumbQueue.push(() => thumbResolve(id, decorSet, entry, prev)
    .catch(() => ({ state: 'missing', cv: null, sig: 'threw' }))
    .then((res) => {
      thumbBusy.delete(key);
      if (thumbEpochOf(key) !== gen) return;      // invalidated while in flight — do not cache what is already stale
      thumbStore(key, res);                       // …and through the bound, never straight into the Map
      for (const L of thumbLive) if (L.key === key) thumbPaint(L.card, res, L.u, L.decorSet);
      if (cardView && cardView.key === key) paintCardView(res);   // the full-size view is a late-resolving card too
    }));
  thumbPump();
}
// ── AAA-7: THE CARD AT FULL SIZE ──────────────────────────────────────────────────────────────────
// The roster shows the artifact scaled to a ~97px column; this shows the same cached 256×256 at its own
// pixels, caption band and all. It is deliberately NOT a re-render: the grid and this view read the same
// canvas, so a card cannot look like one thing in the roster and another when you open it.
let cardView = null;                     // { key, id, decorSet, zoom } while the viewer is open
const CARD_VIEW_ZOOMS = [1, 2, 3];
function openCardView(id, decorSet) {
  const key = thumbKey(id, decorSet);
  cardView = { key, id, decorSet, zoom: (cardView && cardView.zoom) || 1 };
  $('cardModal').hidden = false;
  const hit = thumbTouch(key);                                   // opening a card is the strongest "keep this" there is
  paintCardView(hit || { state: 'pending', cv: null });
  // An empty slot never resolves during renderRoster (it is decided from wipIds without touching the
  // store), so opening one has to ask for the real answer rather than show a permanent "…".
  if (!hit || hit.dirty) thumbWant(key, id, decorSet, (decorSet ? suppliedDecor() : suppliedUnits())[id]);
}
function paintCardView(res) {
  if (!cardView || $('cardModal').hidden) return;
  const spec = THUMB_STATES[res.state] || THUMB_STATES.empty;
  const id = cardView.id;
  $('cardTitle').textContent = id;
  const dims = res.dims || '';
  $('cardMeta').innerHTML = `<span class="${'badge ' + spec.cls}">${spec.badge}${res.stale ? ' ⟳ stale' : ''}</span>`
    + (dims ? ` · <span style="font-family:ui-monospace,monospace">${dims}</span>` : '')
    + ` · <span style="font-family:ui-monospace,monospace">${CARD_PX}×${CARD_PX}</span>`;
  // WHERE THIS PICTURE COMES FROM, said plainly. Only the `model` rung is a file this tool writes; every
  // other rung is composited here and now. A caption band makes any picture look like a saved card, so
  // the one line that distinguishes an artifact on disk from a preview of one has to be present.
  // …and it names the file it ACTUALLY read. This said `.png` as a literal while the resolver had just
  // read a `.jpg`, which is the same class of lie as a stale caption: a path you can copy that is wrong.
  $('cardSrc').innerHTML = res.file
    ? `From <code style="color:#8fd0ff">${res.file}</code> — the file in the repo.`
      + (res.stale ? ` <b style="color:#e0b060">It no longer depicts the saved model. Save the unit to rewrite it.</b>` : '')
    : `<span style="opacity:.75">Composited from the ${res.state === 'baked' ? 'baked atlas' : res.state === 'source' ? 'source slices' : 'card state'}`
      + ` — no <code>${CARD_SHIP_DIR}${id}${CARD_READ_EXT[0]}</code> in the repo. Save the unit with the dev server running to write one.</span>`;
  const cvs = $('cardCanvas'); if (!cvs) return;
  cvs.width = CARD_PX; cvs.height = CARD_PX;
  cvs.style.width = (CARD_PX * cardView.zoom) + 'px'; cvs.style.height = (CARD_PX * cardView.zoom) + 'px';
  const g = cvs.getContext ? cvs.getContext('2d') : null; if (!g) return;
  g.clearRect(0, 0, CARD_PX, CARD_PX);
  g.fillStyle = CARD_BG; g.fillRect(0, 0, CARD_PX, CARD_PX);
  g.imageSmoothingEnabled = false;
  if (res.cv) g.drawImage(res.cv, 0, 0);
  else {
    g.fillStyle = res.state === 'missing' ? '#2a1420' : '#132234'; g.fillRect(0, 0, CARD_PX, CARD_ART);
    g.fillStyle = res.state === 'missing' ? '#ff6b6b' : '#3c5670';
    g.font = '46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(res.state === 'missing' ? '⚠' : res.state === 'pending' ? '…' : '?', CARD_PX / 2, CARD_ART / 2);
    drawCardBand(g, id, res.dims || '');
  }
  // The same two markings the roster draws, at the size they are actually readable. A 256×256 with a
  // name baked into it is MORE convincing when it is wrong, so `stale` has to survive the enlargement.
  if (res.state === 'missing' || res.stale) {
    g.strokeStyle = res.state === 'missing' ? '#ff6b6b' : '#e0b060';
    g.lineWidth = 4; g.strokeRect(2, 2, CARD_PX - 4, CARD_PX - 4);
  }
}
$('cardClose').onclick = () => { $('cardModal').hidden = true; cardView = null; };
$('cardModal').onclick = (e) => { if (e.target === $('cardModal')) { $('cardModal').hidden = true; cardView = null; } };
$('cardZoomSeg').onclick = (e) => {
  const b = e.target.closest ? e.target.closest('button') : null; if (!b || !cardView) return;
  const z = +b.dataset.z; if (!CARD_VIEW_ZOOMS.includes(z)) return;
  cardView.zoom = z;
  [...$('cardZoomSeg').children].forEach((c) => c.classList.toggle('on', c === b));
  paintCardView(thumbCache.get(cardView.key) || { state: 'pending', cv: null });
};
function renderRoster() {
  const decorSet = isDecorSet();
  const grid = $('unitGrid'), supplied = decorSet ? suppliedDecor() : suppliedUnits();
  grid.innerHTML = ''; let n = 0;
  // THE ROSTER IS NOT THE WHOLE SET. This walked the fixed `roster` list only, so a unit baked and saved
  // under an id that is not on it got a manifest entry, an atlas and a WIP -- and no card. It looked as
  // though the save had failed. Anything supplied/saved the roster does not name is appended here, so
  // your own units show up beside the designed ones.
  const named = new Set(roster.map((u) => u.id));
  // …BUT AN EXTRA BELONGS TO EXACTLY ONE SET. `supplied` is the WHOLE manifest, so every id the current
  // faction's roster did not name appeared under EVERY faction. That is what the owner saw as "`abrams`
  // seems to appear in multiple factions": it is in none of them. It is factionless, and the roster was
  // showing factionless ids nine times over — `SPA-U3` too.
  //
  // The fix is BUCKETING, not filtering. Each extra goes under the faction its own prefix resolves to;
  // anything with no recognised prefix goes to ⚠ Unassigned and nowhere else. Dropping them instead
  // would hide orphans, and invisible orphaned content is already its own problem (FFF-7) — the whole
  // reason extras exist is that a saved unit with no card looks like a failed save.
  const belongsHere = (id) => idBelongsToSet(id, curFaction);
  // A unit exists if it has a PACK **or** a WIP. The decor roster already unions decor:* from
  // IndexedDB; the unit roster only read the manifest, so a unit carved but not yet baked had no card —
  // and a card-click on that empty-looking slot opened Save and overwrote the WIP.
  const wip = [...wipIds].filter((id) => !named.has(id) && !supplied[id]);
  const extras = [...Object.keys(supplied).filter((id) => !named.has(id)), ...wip]
    .filter(belongsHere).sort()
    .map((id) => ({ id, role: decorSet ? 'prop' : (supplied[id] ? 'saved' : 'WIP'), wip: !supplied[id] }));
  const cards = [...roster, ...extras];
  const live = [];
  for (const u of cards) {
    const has = !!supplied[u.id]; if (has) n++;
    const selId = decorSet ? editingDecor : $('uid').value;
    const card = document.createElement('div'); card.className = 'ucard' + (u.id === selId ? ' sel' : ''); card.dataset.uid = u.id;
    // STRIP ONLY A PREFIX THAT IS REAL. This was `.replace(/^[A-Za-z]+-/, '')` — it stripped anything
    // hyphen-shaped, so the orphan `SPA-U3` displayed as "U3" and read exactly like a healthy unit whose
    // faction was implied by the panel it sat in. A card now loses its prefix only when that prefix
    // resolves to a faction; an unrecognised id is shown IN FULL, which is the only on-card signal that
    // it cannot resolve to a unit def. (Decor always shows its full id — it matches the Unit Id field.)
    const fac = FAC.factionOfUnitId(u.id);
    const name = (decorSet || !fac) ? u.id : u.id.slice(fac.prefix.length + 1);
    // AAA-7: the ⤢ is a SEPARATE target. Hanging the full-size view off the card's own click would have
    // taken the gesture that opens (or saves) a unit — the thing the roster is mostly used for — and made
    // "look at it bigger" cost a dialog dismissal every time.
    card.innerHTML = `<canvas width="${THUMB_W}" height="${THUMB_H}"></canvas><button class="zoom" title="View the 256×256 card at full size">⤢</button>`
      + `<div class="un">${name}</div><div class="ur">${u.role || '—'}</div><div class="badge no"></div>`;
    // THE BADGE IS DERIVED FROM THE PICTURE. It used to be read off the manifest ("✓ supplied") while
    // the picture came from a field that is no longer there, so the two said different things forever.
    const key = thumbKey(u.id, decorSet);
    live.push({ key, card, u, decorSet });
    const hit = thumbTouch(key);                                 // drawn = used: this is the LRU's only recency signal
    if (hit) thumbPaint(card, hit, u, decorSet);
    // AN EMPTY SLOT IS DECIDED WITHOUT TOUCHING THE STORE. No manifest entry and no WIP means there is
    // nothing anywhere to draw — which is most of a designed roster — so those cards cost one fill and
    // never queue a project read.
    else if (!has && !(decorSet ? decorWipIds : wipIds).has(u.id)) thumbPaint(card, { state: 'empty' }, u, decorSet);
    else { thumbPaint(card, { state: 'pending' }, u, decorSet); thumbWant(key, u.id, decorSet, supplied[u.id]); }
    if (hit && hit.dirty) thumbWant(key, u.id, decorSet, supplied[u.id]);   // shown from cache, refreshed behind it
    card.onclick = decorSet ? () => loadDecorForEdit(u.id) : () => onCardClick(u.id);
    const zb = card.querySelector ? card.querySelector('.zoom') : null;
    if (zb) zb.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); openCardView(u.id, decorSet); };
    grid.appendChild(card);
  }
  thumbLive = live;                                            // a late resolve repaints its own card, never the whole grid
  // THE NOTE AND THE COUNT ARE BOTH TRUE AT ONCE. The note used to REPLACE the count, so a faction with
  // no art file but units you had saved yourself showed cards and a line insisting there was nothing —
  // and the count's denominator was `roster.length`, which excludes extras, so a faction with two
  // designed units and two of your own read "4/2 supplied". Denominator is every card drawn; the note,
  // when there is one, is appended rather than substituted.
  const count = `<span class="lock">${n}/${cards.length}</span> ${decorSet ? 'decor' : 'supplied'}`;
  $('setState').innerHTML = `<b>${curFaction}</b> — ${count}`
    + (noArtNote ? `<br><span style="color:var(--muted)">${noArtNote}</span>` : '');
}
$('addUnit').onclick = async () => {
  if (isDecorSet()) {                                              // Terrain set: start a FRESH decor prop on a clean editor
    const id = (prompt('New decor id:', freeDecorId()) || '').trim();
    if (!id) return;
    // Same guard as the unit path: never let "new" quietly become "reopen and overwrite".
    if (roster.some((u) => u.id === id)) {
      alert(`"${id}" already exists.\n\nPick a different id, or open it from the roster on the left — "+ Add unit" will not overwrite it.`);
      return;
    }
    clearTimeout(autosaveTimer);
    try {                                                          // flush whatever we were on under its own namespace first
      if (editingDecor) { const out = snapshotProject(editingDecor); if (projectHasContent(out)) putProject('decor:' + editingDecor, out); }
      else { const out = snapshotProject(activeUnitId); if (out && projectHasContent(out)) putProject('proj:' + out.id, out); }
    } catch (e) { /* best-effort */ }
    editingDecor = id; if ($('did')) $('did').value = id;
    state.bodyLayers = 64; if ($('bodyLayers')) { $('bodyLayers').value = 64; $('bodyLayersV').textContent = 64; }   // decor tends tall — raise height
    clearSourceArt(); releaseBaked(state.decorBaked); state.decorBaked = null; gridModel = null; state.part = 'body'; recarve(); forceDecorBodyOnly();   // clean slate, body-only
    roster.push({ id, role: 'decor', shape: '🌿', decor: true });   // unconditional: the guard above already refused duplicates
    renderRoster();
    $('projState').textContent = `New decor "${id}" — load Top/Side/Front art as the body, set the 🌿 Decor panel, then Bake + Save.`;
    return;
  }
  // A NEW UNIT GETS THE FACTION'S REAL PREFIX. This used to seed the prompt from prefixFor's guess, so a
  // Space Tech unit was proposed as SPA-* while every Space Tech unit is SPC-* — the orphan SPA-U3 pack
  // is one that got accepted. If the faction is unknown there is no honest default, so refuse rather
  // than propose something that cannot resolve.
  const p = prefixFor(curFaction);
  if (!p) { alert(`"${curFaction}" is not a known faction — cannot generate a unit id.`); return; }
  const id = (prompt('New unit id:', freeUnitId(p)) || '').trim();
  if (!id) return;
  // A COLLISION IS NOT A SILENT "OPEN IT". This used to read
  //     if (!roster.some(u => u.id === id)) roster.push(...);
  //     renderRoster(); await selectUnit(id);
  // so an id that already existed skipped the push and then loaded THAT unit into the editor. You asked
  // to create a unit and were handed someone else's, unwarned — and the autosave-on-switch path then
  // wrote your new work back over the original under proj:<id>. That is the reported corruption, and the
  // tool was doing exactly what it was told. Opening an existing unit is what the roster is for.
  if (roster.some((u) => u.id === id)) {
    alert(`"${id}" already exists.\n\nPick a different id, or open the existing unit from the roster on the left — "+ Add unit" will not overwrite it.`);
    return;
  }
  roster.push({ id, role: '', shape: '' });
  renderRoster(); await selectUnit(id);
};
/**
 * The next genuinely FREE `<prefix>-U<n>`, found by scanning the roster rather than counting it.
 * `roster.length + 1` was only ever right while ids were a dense 1..N run, and remove-a-unit (DDD-5)
 * shipped in PR #21 — delete GND-U3 from GND-U1..GND-U5 and length drops to 4, so the next add proposed
 * GND-U5, which exists. Non-sequential ids (GND-abrams) and designed-but-unauthored slots get there
 * without any delete. Scanning cannot collide by construction, so the proposal is always safe to accept.
 */
function freeUnitId(prefix) {
  const taken = new Set(roster.map((u) => u.id));
  for (let n = 1; n <= roster.length + 1000; n++) {
    const id = `${prefix}-U${n}`;
    if (!taken.has(id)) return id;
  }
  return `${prefix}-U${Date.now()}`;                               // unreachable in practice; never propose a dup
}
/** the decor equivalent — same reasoning, same failure mode without it */
function freeDecorId() {
  const taken = new Set(roster.map((u) => u.id));
  for (let n = 1; n <= roster.length + 1000; n++) {
    const id = 'decor-' + n;
    if (!taken.has(id)) return id;
  }
  return 'decor-' + Date.now();
}
// wipe the current unit's source art/vox + per-view cutout state so switching to a pack-only unit
// doesn't keep re-carving and displaying the PREVIOUS unit (the "still looking at Base" bug).
function clearSourceArt() {
  for (const part of ['body', 'turret']) {
    voxPart[part] = null; voxB64[part] = null;
    for (const v of VIEWS) {
      srcImg[part][v] = null; imgs[part][v] = null; imgURLCache[part][v] = null;
      flipState[part][v] = { h: false, v: false }; rotState[part][v] = 0; keyTolState[part][v] = 75; polyState[part][v] = null; pickState[part][v] = [];
      const pick = pickFor(part, v);
      if (pick) { pick.classList.remove('set'); updateFlipBtns(pick); const cvs = pick.querySelector('canvas'); if (cvs) cvs.getContext('2d').clearRect(0, 0, cvs.width, cvs.height); }
    }
  }
  // EVERYTHING per-unit, not just the art. These four kept the OUTGOING unit's settings alive because
  // nothing on the incoming path necessarily overwrites them: a frozen geomState span silently pinned
  // the new unit's height (the '8'), imgXf offset its slices, carveCache held the old voxels, and the
  // undo stack could restore the previous unit's geometry into this one.
  imgXf.body = mkXf(); imgXf.turret = mkXf();
  geomState.body = { auto: true, bottomFrom: 'top' }; geomState.turret = { auto: true, bottomFrom: 'top' };
  carveCache.body = null; carveCache.turret = null;
  carveStale.body = false; carveStale.turret = false; carveStaleAck = { body: null, turret: null };
  volHistory.length = 0; volRedo.length = 0; volDirty.body = false; volDirty.turret = false;
  gridSel = null; gridSelVox = null; gridSelView = null;
  gridModel = null;
}
async function selectUnit(id, skipSave) {
  // SAFETY: flush the OUTGOING unit under ITS OWN id first (so its last edits aren't lost or misfiled),
  // cancel any click-armed autosave, and block autosaves until the incoming unit finishes loading — the
  // async load must own the slot, or a stale-model autosave overwrites the unit you're switching to.
  clearTimeout(autosaveTimer);
  if (skipSave) editingDecor = null;   // ⏭ Skip: discard the outgoing unit's unsaved work by not flushing it
  else if (editingDecor) { try { const dout = snapshotProject(editingDecor); if (projectHasContent(dout)) putProject('decor:' + editingDecor, dout); } catch (e) { /* flush decor */ } editingDecor = null; }   // leaving decor editing for a unit
  // AUTO-SAVE THE OUTGOING UNIT. Switching units is not a decision point about saving -- the work goes
  // back where it came from, every time. skipSave remains for the explicit discard path only, and a clean
  // WIP still writes nothing because snapshotProject serialises a per-voxel VOL blob.
  if (!skipSave && wipDirty && activeUnitId && activeUnitId !== id) {
    try {
      const out = snapshotProject(activeUnitId);
      if (out && projectHasContent(out) && await putProject('proj:' + out.id, out)) { wipIds.add(out.id); wipDirty = false; }
    } catch (e) { return saveFailed('AUTOSAVE ON SWITCH FAILED', `Could not save "${activeUnitId}" before opening "${id}".

${(e && e.message) || e}

The switch was cancelled so nothing is lost.`); }
  }
  setBackSlotLabel('Back');                              // units use the Back slot as the rear view again
  // THE OUTGOING UNIT'S GEOMETRY MUST GO WITH IT. carveCache holds VOL — the model itself — and
  // buildModelRaw returns the cached entry whenever foot/layers match, so a new unit of the same
  // dimensions inherited the previous unit's voxels. Undo/selection/palette were already discarded
  // here; the volume was not, because it only became the model when the voxEdit overlay was retired.
  carveCache.body = null; carveCache.turret = null; gridModel = null;
  // volDirty travels with the model it describes. Left true across a unit switch it would tell
  // buildModelRaw the INCOMING unit has hand work to protect, and its first carve would never run.
  volDirty.body = false; volDirty.turret = false; carveStale.body = false; carveStale.turret = false;
  carveStaleAck = { body: null, turret: null };
  volHistory.length = 0; volRedo.length = 0; gridSel = null; gridSelVox = null; gridSelView = null;   // discard the outgoing unit's undo history + selection before the switch (non-WIP packs skip loadProject)
  loadingUnit = true;
  $('uid').value = id; activeUnitId = id;                 // anchor the WIP key to the unit being loaded
  unTombstone('proj:' + id);                              // OPENING it is the deliberate ask — a removed id can be re-authored
  const m = suppliedUnits();
  if (m[id]) {
    const p = m[id].pack, bp = (p.parts || []).find((q) => q.id === 'body'), tp = (p.parts || []).find((q) => q.id === 'turret');
    state.cls = p.class; state.foot = p.footprint[0];
    state.bodyLayers = (bp && bp.layers) || p.footprint[2]; state.turretLayers = (tp && tp.layers) || p.footprint[2];
    if (p.light) { state.lightAz = p.light.azimuth; $('lightAz').value = state.lightAz; $('lightAzV').textContent = state.lightAz + '°'; }
    $('res').value = state.foot; if ($('turretRes')) { const _tf = state.turretFoot || state.foot; $('turretRes').value = [16,24,32,48,64,96,128].includes(_tf) ? _tf : ''; }
    $('bodyLayers').value = state.bodyLayers; $('bodyLayersV').textContent = state.bodyLayers;
    $('turretLayers').value = state.turretLayers; $('turretLayersV').textContent = state.turretLayers;
    [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  }
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  drawLight();
  // a WIP project restores full editable source (loadProject rebuilds); otherwise DROP the previous
  // unit's source so it stops rendering, then show the saved pack's baked model in the orbit.
  // CLEAR FIRST, ALWAYS. This used to run only when there was NO WIP, so switching to a unit that HAD
  // one left every store the project file does not carry showing the previous unit -- you could not tell
  // whether you were looking at new work or the last unit's. loadProject then restores what it owns.
  clearSourceArt();
  idb.get('proj:' + id).then((p) => {
    if (p) return loadProject(p).then(() => { $('projState').textContent = `Loaded "${id}" — continue editing.`; });
    if (m[id]) return loadPackPreview(m[id]).then(() => {
      gridModel = null; renderGridView();                           // reflect the cleared source (baked shows in orbit)
      $('projState').textContent = `Loaded "${id}" baked pack — orbit/in-game show the baked model; no editable source on this browser.`;
    });
    recarve();
    $('projState').textContent = `Nothing to load for "${id}" (no WIP project and no saved pack).`;
  }).catch((e) => { console.error('[load] failed for', id, e); $('projState').textContent = `Load failed for "${id}": ${(e && e.message) || e}`; })
    .finally(() => { loadingUnit = false; });              // load done → autosaves may resume, now correctly keyed to this unit
}

// rebuild the baked preview straight from a saved pack's atlases — "load asset pack and continue"
async function loadPackPreview(entry) {
  const p = entry.pack, B = p.renderScale || 1;
  // Atlases live in IndexedDB now (localStorage holds the descriptor only). Tolerate old entries that
  // still carry them inline so a manifest saved before this change still previews.
  const atlases = entry.atlases || (await idb.get('atlas:' + p.id).catch(() => null)) || null;
  if (!atlases) { console.warn('[stack-forge] no atlases stored for', p.id, '— nothing to preview'); return; }
  const mk = async (partId) => {
    const part = (p.parts || []).find((q) => q.id === partId);
    if (!part || !atlases[partId]) return null;
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = atlases[partId]; });
    const base = PIXI.BaseTexture.from(img);
    base.scaleMode = PIXI.SCALE_MODES.NEAREST;   // sprite-sheet preview: the frames that actually ship, unsmoothed
    const n = part.kind === 'directional' ? part.facings : part.angles, cols = part.cols || Math.ceil(Math.sqrt(n));
    const frames = [];
    for (let i = 0; i < n; i++) frames.push(new PIXI.Texture(base,
      new PIXI.Rectangle((i % cols) * part.cell[0], ((i / cols) | 0) * part.cell[1], part.cell[0], part.cell[1])));
    return { frames, part };
  };
  const body = await mk('body'), turret = await mk('turret');
  if (!body || !turret) return;
  const g = { RTW: body.part.cell[0], RTH: body.part.cell[1], CX: body.part.pivot[0], BASEY: body.part.pivot[1] };
  state.baked = { body: body.frames, turret: turret.frames, bodyFrames: body.part.facings, turretFrames: turret.part.angles,
    g, sp: p.layerSpacing, foot: p.footprint[0], bodyLayers: body.part.layers || p.footprint[2], turretLayers: turret.part.layers || p.footprint[2], scale: B };
  const mkB = (tex, parent) => { const s = new PIXI.Sprite(tex); s.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); s.scale.set(1 / B); parent.addChild(s); return s; };
  if (bodyBaked) { bodyBaked.destroy(); } if (turretBaked) { turretBaked.destroy(); }
  if (gBodyBaked) { gBodyBaked.destroy(); } if (gTurretBaked) { gTurretBaked.destroy(); }
  bodyBaked = mkB(body.frames[0], rig); turretBaked = mkB(turret.frames[0], rig);
  gBodyBaked = mkB(body.frames[0], gUnit); gTurretBaked = mkB(turret.frames[0], gUnit);
  lastPack = entry;                                     // downloads reuse the stored atlases as-is
  $('dlSheet').disabled = false;
  $('bakeState').innerHTML = `<span class="lock">✓ Showing the saved pack (${p.footprint.join('×')} · ${B}×)</span>`;
}

// ── ONE-CLICK save flow: clicking a roster card is ALWAYS a save — "save the current model as this
// unit" (sprites or 3D). It never loads (that clobbered work in progress); loading an existing unit
// goes through the 📂 Load button, which lists every unit with a WIP project or a saved pack. ──
let saveAsId = null;
// Clicking a roster card used to be ALWAYS A SAVE: the modal was titled 'Save unit' and its primary,
// '(recommended)' button overwrote the clicked unit with whatever was in the editor. Clicking a unit to
// OPEN it therefore destroyed it (owner 2026-08-06: 'my tank unit is now screwed up'). Opening is now the
// default and overwriting is a deliberate, separately-labelled action.
// ── THE SAVE MODAL ───────────────────────────────────────────────────────────────────────────────
// One dialog, one id, one faction, and two honest buttons. It states the repo paths it writes so
// 'I saved' names a location instead of one of four invisible stores.
//   Save geometry — the editable unit (voxels + slices) and a descriptor, so the CARD EXISTS. No bake.
//   Save all      — bake, then geometry + sprite sheets + manifest in one action.
// EVERY SET THAT HAS A REAL PREFIX — the nine playable factions AND System. This excluded System by
// spelling its display name as a literal, which was both a duplicate of the registry and wrong: SYS-*
// units are real, authorable, and reachable from the left rail. Select System there and open this dialog
// and NO option matched, so the <select> fell back to option[0] and the dialog silently claimed you were
// saving a Ground / Powder unit. The Load modal had it worse — its dropdown then RE-LOADS whatever it
// displays, so there was no way back to System from inside the dialog at all.
const UNIT_FACTIONS = FACTIONS.filter((f) => !isPseudoSet(f));
// PRINT WHAT IS ACTUALLY WRITTEN. This used to name content/units/<faction>.units.json — a file the tool
// only ever READS. fileForFaction has exactly two callers: building the roster, and this line. Naming a
// destination nothing writes is worse than naming none, because it is confidently wrong.
const svDests = (id, all) => {
  const d = [`proj:${id || '<id>'} (IndexedDB — voxels + slices)`, `bulwark:stackforge (descriptor)`];
  if (all) d.push(`atlas:${id || '<id>'} (IndexedDB — sprite sheets)`);
  // The card image is written to the REPO by both save buttons, so the dialog names it. A dialog that
  // states its destinations and then writes somewhere it did not name is the defect this list was
  // introduced to end.
  d.push(`${CARD_SHIP_DIR}${id || '<id>'}.png (repo — the card picture)`);
  return d;
};
const svShipDests = (id) => [`content/units/voxel/${id || '<id>'}.{body,turret}.png`, 'content/units/voxel-units.json'];

// THE FACTION IS THE ID'S PREFIX — there is nowhere else for it to live. This tool writes proj:<id>,
// bulwark:stackforge, atlas:<id>, content/units/voxel/<id>.{body,turret}.png and one shared
// voxel-units.json; NOT ONE of those is per-faction. So this dialog's dropdown had nothing to write to,
// and it wrote nothing — neither save button has ever read $('svFaction'). The note under it said
// "Faction <X> tags the card", and it tagged nothing: the card is pushed onto whatever roster you happen
// to be standing in. A control that does nothing while claiming otherwise is worse than no control, and
// this one sits on the last gate before an id is committed.
//
// IT IS THAT GATE NOW. GGG-2 fixed the id PROPOSED by "+ Add unit" — but that prompt is editable and
// this field is free text, so a Space Tech unit could still be saved as SPA-U3 simply by typing it. The
// orphan the whole registry was built to prevent was still reachable through the primary save path.
// Choosing a faction rewrites the id's prefix, and a mismatch now blocks the save outright.

/** the id with its prefix replaced by that faction's: `SPA-U3` + Space Tech -> `SPC-U3`, `abrams` -> `SPC-abrams` */
function svRePrefix(id, facName) {
  const f = FAC.find(facName);
  if (!f) return id;
  const cur = FAC.factionOfUnitId(id);
  // strip a REAL prefix by length; otherwise strip a prefix-SHAPED head (that is what SPA- is) so the
  // repair for an orphan is its stem under the right prefix, not the whole broken id carried along.
  const stem = cur ? id.slice(cur.prefix.length + 1) : id.replace(/^[A-Za-z]{2,5}-/, '');
  return `${f.prefix}-${stem}`;
}
/** null when the id agrees with the chosen faction; otherwise WHY it does not, and what to use instead. */
function svMismatch() {
  const id = ($('svId').value || '').trim(), f = FAC.find($('svFaction').value);
  if (!id || !f) return null;
  const got = FAC.factionOfUnitId(id);
  if (got && got.prefix === f.prefix) return null;
  return got
    ? `<b>${id}</b> is a ${got.name} id (<b>${got.prefix}-*</b>) but this dialog says <b>${f.name}</b>.`
      + ` Select ${got.name} above, or save it as <b>${svRePrefix(id, f.name)}</b>.`
    : `<b>${id}</b> carries no known faction prefix, so it can never resolve to a unit def — this is`
      + ` exactly how SPA-U3 and abrams happened. ${f.name} units are <b>${f.prefix}-*</b>:`
      + ` use <b>${svRePrefix(id, f.name)}</b>.`;
}
function openSaveModal(id) {
  const sel = $('svFaction');
  // OPEN ON THE ID'S OWN FACTION, not on whatever panel you are standing in. Those differ precisely when
  // something is wrong — the Load modal can put a SYS-* unit in the editor while the rail says Air — and
  // in that case the id is the fact and the panel is not.
  const want = (FAC.factionOfUnitId((id || $('uid').value || '').trim()) || {}).name
    || (UNIT_FACTIONS.includes(curFaction) ? curFaction : UNIT_FACTIONS[0]);
  sel.innerHTML = UNIT_FACTIONS.map((f) => `<option${f === want ? ' selected' : ''}>${f}</option>`).join('');
  sel.value = want;
  $('svId').value = (id || $('uid').value || '').trim();
  svSyncPath();
  $('saveModal').hidden = false;
}
function svSyncPath() {
  const id = ($('svId').value || '').trim(), fac = $('svFaction').value;
  $('svPath').innerHTML = `Save writes → ${svDests(id, true).join('  ·  ')}`
    + `<br>Then <b>🚀 Ship</b> writes → ${svShipDests(id).join('  ·  ')}`
    + `<br><span style="opacity:.7">The tool writes no per-faction file — <b>${fac}</b> is carried by the`
    + ` id's <b>${(FAC.find(fac) || {}).prefix || '?'}-</b> prefix, and that is the only thing the game reads.</span>`;
  const bad = svMismatch(), clash = !!suppliedUnits()[id];
  $('svWarn').hidden = !(bad || clash);
  $('svWarn').innerHTML = [
    bad ? `⛔ ${bad}` : '',
    clash ? `⚠ <b>${id}</b> already exists — saving REPLACES it.` : '',
  ].filter(Boolean).join('<br>');
}
/** the one place both save buttons check the id before anything is written. */
function svBlockedByFaction() {
  const bad = svMismatch();
  if (!bad) return null;
  return saveFailed('WRONG FACTION PREFIX', bad.replace(/<\/?b>/g, '')
    + '\n\nNothing was written. Change the Faction dropdown (it rewrites the prefix for you) or edit the id.');
}
const closeSave = () => { $('saveModal').hidden = true; };
$('svId').oninput = svSyncPath;
// CHANGING THE FACTION REWRITES THE PREFIX. That is what makes this dropdown a control rather than a
// label, and it is the one-click repair for an orphan: open SPA-U3, pick Space Tech, get SPC-U3.
$('svFaction').onchange = () => {
  const id = ($('svId').value || '').trim();
  if (id) $('svId').value = svRePrefix(id, $('svFaction').value);
  svSyncPath();
};
$('svCancel').onclick = closeSave;
$('saveModal').addEventListener('click', (e) => { if (e.target === $('saveModal')) closeSave(); });
// GEOMETRY ONLY: no bake, no sprites. Writes the editable unit and a descriptor stub so a card appears
// immediately — you can carve a unit over several sessions without ever baking it.
$('svGeom').onclick = async () => {
  const id = ($('svId').value || '').trim();
  if (!id) return saveFailed('NO ID', 'Give the unit an id before saving.');
  const blocked = svBlockedByFaction(); if (blocked) return blocked;   // refuse BEFORE a card or a WIP exists
  $('uid').value = id; activeUnitId = id;
  unTombstone('proj:' + id);                                      // an explicit save IS the ask — a removed id can be re-created
  try {
    // REPORT WHAT ACTUALLY HAPPENED. This awaited the autosave and then claimed "Card created" regardless
    // of the outcome — descriptor written, geometry not.
    const r = await doAutosave();                                 // proj:<id> — voxels, slices, cutouts
    if (!r || !r.ok) {
      if (r && r.kind === 'EMPTY') return saveFailed('NOTHING TO SAVE',
        `"${id}" has no geometry, slices or imported model yet, so there is nothing to write. Load art or`
        + ` carve something first — no card was created.`);
      return r;                                                   // AUTOSAVE FAILED / SNAPSHOT FAILED already shouted
    }
    const m = loadManifest(); m.units = m.units || {};
    if (!m.units[id]) m.units[id] = { pack: { id, class: state.cls, footprint: [state.foot, state.foot, state.bodyLayers], geometryOnly: true } };
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
    if (!roster.some((u) => u.id === id)) roster.push({ id, role: '', shape: '' });
    // THE CARD PICTURE IS PART OF SAVING. A geometry save is exactly the case the owner is blocked on —
    // a unit with a model and no bake — so this is where its picture gets made and written to the repo.
    const img = await saveCardImage(id, r.p);
    closeSave(); renderRoster();
    $('projState').innerHTML = `🧊 Geometry saved for <b>${id}</b> → proj:${id} (IndexedDB). Card created. Not baked — use <b>Save all</b> to ship sprites.`
      + `<br>${cardImageNote(img)}`;
  } catch (e) { return saveFailed('GEOMETRY SAVE FAILED', (e && e.message) || String(e)); }
};
// EVERYTHING: bake, geometry, sprite sheets, manifest.
$('svAll').onclick = async () => {
  const id = ($('svId').value || '').trim();
  if (!id) return saveFailed('NO ID', 'Give the unit an id before saving.');
  const blocked = svBlockedByFaction(); if (blocked) return blocked;   // refuse BEFORE anything is baked
  // NOTHING TO SAVE IS A WARNING, NOT A SILENT SUCCESS (owner 2026-08-07). "Save geometry" already
  // refused an empty unit — doAutosave reports EMPTY and svGeom shouts — but "Save all" went straight
  // to doBake, baked an empty volume, wrote a manifest entry and reported a successful save of nothing.
  // The test for "empty" is projectHasContent, unchanged and NOT reimplemented here: a unit with no
  // slices but an imported .vox, hand-carved geometry or paint is real work and is not blocked.
  const gate = svContentGate(id); if (!gate.ok) return gate.fail;
  if (suppliedUnits()[id] && !confirm(`REPLACE the saved unit "${id}"?

Its sprites and geometry are overwritten with the model currently in the editor.`)) return;
  closeSave();
  const r = await quickSave(id, !!$('embedModel').checked);       // bakes, writes atlases + manifest
  if (!r || !r.ok) return r;                                      // quickSave already shouted
  if (!roster.some((u) => u.id === id)) roster.push({ id, role: '', shape: '' });
  const img = await saveCardImage(id, gate.p);
  renderRoster();
  $('projState').innerHTML = ($('projState').textContent || '') + `  ·  🚀 Ship to write ${svShipDests(id).join(' + ')}.`
    + `<br>${cardImageNote(img)}`;
};
/** The one gate both save buttons can ask "is there anything here at all?". Snapshots ONCE and hands the
 *  snapshot back so the caller does not serialise a per-voxel VOL blob twice for one save. */
function svContentGate(id) {
  let p;
  try { p = snapshotProject(id); }
  catch (e) { return { ok: true, p: null }; }                     // let the real save path report a snapshot failure in its own words
  if (projectHasContent(p)) return { ok: true, p };
  return { ok: false, p, fail: saveFailed('NOTHING TO SAVE',
    `"${id}" has no slice art, no imported .vox, no carved geometry and no paint — there is nothing to `
    + `write, so nothing was saved.\n\nLoad a Top / Side / Front slice into the BODY (or import a .vox), `
    + `then save.`) };
}
// Clicking a card OPENS. It never saves — that lived here as a 'recommended' overwrite button and
// destroyed a unit the owner meant to open. An EMPTY slot has nothing to open, so it goes straight to
// the Save modal with the id prefilled, which is the only place a save can now begin.
// ── BAKED SPRITE PREVIEW ─────────────────────────────────────────────────────────────────────────
// The main window is the geometry editor and stays that way. The frames that actually SHIP are shown
// here, laid out as the atlas grid, so 'what did I bake' is an explicit question with an explicit
// answer instead of a hidden mode that silently replaced the model.
let spPart = 'body';
function spDraw() {
  const cv = $('spCanvas'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const b = state.baked;
  if (!b) { cv.width = 320; cv.height = 60; g.fillStyle = '#8fa7bd'; g.font = '12px system-ui'; g.fillText('Nothing baked yet — press Bake.', 10, 34); return; }
  const frames = spPart === 'turret' ? b.turret : b.body;
  const n = frames.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const z = (+$('spZoom').value || 100) / 100;
  const cw = Math.max(1, Math.round(b.g.RTW * z)), ch = Math.max(1, Math.round(b.g.RTH * z));
  cv.width = cols * cw; cv.height = rows * ch;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#060b12'; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < n; i++) {
    let src = null;
    try { src = app.renderer.extract.canvas(frames[i]); } catch (e) { /* texture gone */ }
    const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
    if (src) g.drawImage(src, x, y, cw, ch);
    g.strokeStyle = 'rgba(120,200,255,.18)'; g.strokeRect(x + .5, y + .5, cw - 1, ch - 1);
  }
  $('spMeta').textContent = `${n} frame(s) · cell ${b.g.RTW}×${b.g.RTH} · grid ${cols}×${rows}`
    + ` · baked at ${b.el != null ? b.el : state.el}° tilt, ${b.scale}× — these are the pixels that ship.`;
}
$('spOpen').onclick = () => { $('spTitle').textContent = ($('uid').value || 'unit').trim(); $('spriteModal').hidden = false; spDraw(); };
$('spClose').onclick = () => { $('spriteModal').hidden = true; };
$('spriteModal').addEventListener('click', (e) => { if (e.target === $('spriteModal')) $('spriteModal').hidden = true; });
$('spZoom').oninput = (e) => { $('spZoomV').textContent = e.target.value + '%'; spDraw(); };
$('spPartSeg').onclick = (e) => { const b2 = e.target.closest('button'); if (!b2) return; spPart = b2.dataset.p;
  [...$('spPartSeg').children].forEach((c) => c.classList.toggle('on', c === b2)); spDraw(); };
function onCardClick(id) {
  saveAsId = id;
  if (!suppliedUnits()[id]) { openSaveModal(id); return; }
  $('saveAsTitle2').textContent = 'Open — ' + id;
  $('saveAsModal').hidden = false;
}
// Load is FACTION-FIRST: pick the faction by name, then the unit within it. The dropdown lives in the
// modal because that is where you are choosing what to open — it defaulted to the left rail's selection
// and there was no way to reach another faction's units without leaving the dialog first.
// It opens on the LAST faction you worked in (bulwark:sf:lastFaction), not always the first entry.
async function openLoadModal() {
  const sel = $('loadFaction');
  if (sel && !sel.dataset.wired) {
    sel.dataset.wired = '1';
    sel.onchange = async () => { await loadFaction(sel.value); await openLoadModal(); };   // rebuilds `roster`, then relists
  }
  if (sel) {
    // IT MUST OFFER THE SET YOU ARE ACTUALLY IN, pseudo-sets included. UNIT_FACTIONS holds only real
    // factions, so standing in 🌿 Terrain or ⚠ Unassigned left no option selected and the <select> fell
    // back to option[0]: the dialog said "Ground / Powder" while listing something else entirely. This
    // dropdown RE-LOADS whatever it displays, so that lie was one interaction away from becoming true —
    // and there was no way back to the set you came from without closing the dialog.
    const opts = (!curFaction || UNIT_FACTIONS.includes(curFaction)) ? UNIT_FACTIONS : [curFaction, ...UNIT_FACTIONS];
    sel.innerHTML = opts.map((f) => `<option${f === curFaction ? ' selected' : ''}>${f}</option>`).join('');
    if (curFaction) sel.value = curFaction;
  }
  const m = suppliedUnits();
  let projIds = [];
  try { projIds = ((await idb.keys()) || []).filter((k) => typeof k === 'string' && k.startsWith('proj:')).map((k) => k.slice(5)); } catch (e) { /* no store */ }
  const wip = new Set(projIds), packed = new Set(Object.keys(m));
  const ids = [...new Set([...roster.map((u) => u.id), ...wip, ...packed])].filter((id) => wip.has(id) || packed.has(id));
  ids.sort((a, b) => {                                            // current roster first, then the rest A→Z
    const ra = roster.findIndex((u) => u.id === a), rb = roster.findIndex((u) => u.id === b);
    if ((ra < 0) !== (rb < 0)) return ra < 0 ? 1 : -1;
    return ra >= 0 ? ra - rb : a.localeCompare(b);
  });
  const list = $('loadList'); list.innerHTML = '';
  if (!ids.length) list.innerHTML = `<div class="note">Nothing saved yet in <b>${curFaction || 'this faction'}</b> — pick another faction above, or bake a unit and save it.</div>`;
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; row.style.gap = '4px';
    const b = document.createElement('button');
    b.className = 'ghost loadRow'; b.style.flex = '1';
    b.innerHTML = `<span class="lid">${id}</span><span class="ltag">${wip.has(id) ? '✎ project' : ''}${wip.has(id) && packed.has(id) ? ' · ' : ''}${packed.has(id) ? '📦 pack' : ''}</span>`;
    b.onclick = async () => { $('loadModal').hidden = true; await selectUnit(id); };   // selectUnit auto-saves the outgoing unit itself
    row.appendChild(b);
    if (wip.has(id)) {                                                 // delete the WIP project (falls back to the pack, or gone)
      const del = document.createElement('button'); del.className = 'ghost'; del.textContent = '🗑'; del.title = 'Delete this browser WIP project';
      del.style.cssText = 'width:auto;padding:6px 9px;margin:0;flex:0 0 auto';
      // THE NARROW DELETE: discard THIS BROWSER's edits and fall back to the shipped pack. It is not a
      // removal — the pack, the repo art and the descriptor all stay — and the confirmation now says which
      // of the two you are getting. It also used to be a coin flip: the capture-phase click listener armed
      // doAutosave on this very click, and 500ms later the still-loaded model was written straight back to
      // proj:<id>. Tombstone first, cancel the timer, and leave the editor somewhere defined.
      del.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Discard the work-in-progress project for "${id}"?

`
          + `Only proj:${id} (IndexedDB — this browser's voxels, slices and cutouts) is deleted.`
          + ` The saved pack, the repo art and the descriptor all stay, so the unit itself remains.`
          + `

This CANNOT be undone. To remove the unit and everything it occupies, use`
          + ` 🗑 Remove… under the unit set.`)) return;
        clearTimeout(autosaveTimer);
        deletedKeys.add('proj:' + id);                                 // …so the armed autosave cannot write it back
        const open = (activeUnitId === id);
        try { await idb.del('proj:' + id); }
        catch (err) { deletedKeys.delete('proj:' + id); alert(`Could not delete proj:${id} — ${(err && err.message) || err}. Nothing was removed.`); return; }
        wipIds.delete(id); thumbInvalidate(id); thumbCache.delete(thumbKey(id, false));
        if (open) {
          wipDirty = false;
          try { if (localStorage.getItem('bulwark:sf:last') === id) localStorage.removeItem('bulwark:sf:last'); } catch (err) { /* private mode */ }
          if (suppliedUnits()[id]) await selectUnit(id);               // re-open on the PACK — a deliberate ask, so the tombstone lifts
          else { clearSourceArt(); activeUnitId = null; $('uid').value = ''; lastPack = null; recarve(); setWipStatus('— discarded', 'muted'); }
        }
        openLoadModal();
      };
      row.appendChild(del);
    }
    list.appendChild(row);
  }
  $('loadModal').hidden = false;
}
$('loadUnit').onclick = openLoadModal;
$('loadCancel').onclick = () => { $('loadModal').hidden = true; };
// LOAD DIAGNOSTIC (owner 2026-07-18): for every unit, report the FACTS that decide the load path —
// does a WIP project exist in IndexedDB, does it actually have content, which source views/vox it holds,
// is there a pack (saved vs shipped-only), and exactly what selectUnit() will do. Reading this instead
// of inferring is how we stop guessing about load.
async function diagnoseLoad() {
  const m = suppliedUnits(), localUnits = loadManifest().units || {};
  let projIds = [];
  try { projIds = ((await idb.keys()) || []).filter((k) => typeof k === 'string' && k.startsWith('proj:')).map((k) => k.slice(5)); } catch (e) { /* no store */ }
  const ids = [...new Set([...projIds, ...Object.keys(m)])].sort();
  const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i += 7) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };  // sampled djb2 — same art → same hash
  const rows = [];
  for (const id of ids) {
    let wip = null; try { wip = await idb.get('proj:' + id); } catch (e) { /* skip */ }
    const hasWip = !!wip, content = wip ? projectHasContent(wip) : false;
    const viewsOf = (part) => (wip && wip.images && wip.images[part]) ? VIEWS.filter((v) => wip.images[part][v]).map((v) => v[0]).join('') : '';
    const imgs = wip ? `b:${viewsOf('body') || '-'} t:${viewsOf('turret') || '-'}` : '-';
    const bTop = wip && wip.images && wip.images.body && wip.images.body.top;   // the ACTUAL body-top art
    const art = bTop ? hashStr(bTop) : '-';
    const pack = !!m[id], packKind = pack ? (localUnits[id] ? 'saved' : (shippedUnits[id] ? 'shipped' : 'other')) : '-';
    const action = hasWip ? (content ? 'loadProject → EDITABLE' : 'loadProject → EMPTY (!)') : (pack ? 'loadPackPreview → baked only' : 'nothing to load');
    rows.push({ id, wip: hasWip ? (content ? 'yes' : 'EMPTY') : '-', imgs, artHash: art, layers: wip && wip.state ? `${wip.state.bodyLayers}/${wip.state.turretLayers}` : '-', pack: packKind, 'load →': action });
  }
  console.table(rows);
  // group by art hash: any hash shared by >1 unit means those units carry the SAME source art (corruption)
  const byArt = {};
  for (const r of rows) if (r.artHash !== '-') (byArt[r.artHash] = byArt[r.artHash] || []).push(r.id);
  const dupes = Object.values(byArt).filter((g) => g.length > 1);
  if (dupes.length) console.warn('[diag] units SHARING the same body art (corrupted WIPs):', dupes);
  const el = $('loadDiagNote');
  if (el) el.innerHTML = `Dumped <b>${rows.length}</b> units to the Console. ` + (dupes.length ? `<span style="color:#e0975f">Same-art groups (corrupted): ${dupes.map((g) => g.join('=')).join(' · ')}</span>` : 'No shared-art corruption.');
  return rows;
}
if ($('loadDiag')) $('loadDiag').onclick = diagnoseLoad;
$('loadModal').addEventListener('click', (e) => { if (e.target === $('loadModal')) $('loadModal').hidden = true; });

// ── REMOVING A UNIT (DDD-5) ───────────────────────────────────────────────────────────────────────
// "We need the ability to remove units — we have data pollution" (owner, twice). There was no removal
// path anywhere in the tool: `idb.del` had exactly ONE caller — the WIP row in the Load dialog — and
// every id ever mistyped, experimented with or abandoned lived forever across four stores and the repo.
//
// A unit occupies SIX places, and a removal that misses one leaves a card behind and looks broken:
//   IndexedDB      proj:<id>   the editable project — voxels, slices, cutouts
//                  atlas:<id>  the baked sprite sheets
//                  model:<id>  the Tier C voxel geometry
//   localStorage   bulwark:stackforge — the descriptor; plus the bulwark:sf:last pointer
//   the repo       content/units/voxel/<id>.{body,turret}[.shadow].png
//                  content/units/card/<id>.png · content/units/model/<id>.json
//                  and the unit's entry inside content/units/voxel-units.json
//
// A DESIGNED UNIT IS REFUSED, EXPLICITLY AND IN PART. An id named by a content/units/*.units.json is a
// DESIGN — hand-written repo content this tool only ever READS. Deleting it client-side would be undone
// by the next load from source, so removal strips every authored ARTIFACT and KEEPS the design slot: the
// card comes back reading "needs art", which is the truth about that unit. The confirmation says so
// before you agree to it, and says that removing the design itself is a repo edit. A refusal with a
// stated reason beats a delete that silently does not stick.
//
// AND IT CANNOT BE RESURRECTED BY THE AUTOSAVE. See deletedKeys / putProject above — the click that runs
// a removal also arms doAutosave (capture phase), and without the tombstone that timer would write the
// removed unit straight back 500ms later. That fix comes first because without it a broken removal and a
// resurrected one look identical.

/** POST a delete to the dev server. Mirrors shipFile: the ONLY removal path for repo art, it needs the
 *  local dev server, and it throws with the reason rather than reporting a removal that did not happen. */
const unshipFile = async (path) => {
  const r = await fetch('/__unship', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }) });
  const d = await r.json().catch(() => ({ ok: false, error: 'not a dev server' }));
  if (!d.ok) throw new Error(`${path}: ${d.error || 'unknown'}`);
  return d;
};

// A *.units.json, read once per session. `null` means the file could not be read — which is NOT the same
// claim as "it does not name this unit", and the difference decides whether the card disappears.
const designedFileCache = new Map();
async function designedIdsIn(file) {
  if (designedFileCache.has(file)) return designedFileCache.get(file);
  let ids = null;
  try {
    const r = await fetch('../../content/units/' + file, { cache: 'no-store' });
    if (r.ok) ids = new Set(Object.keys(((await r.json()) || {}).units || {}));
  } catch (e) { ids = null; }
  designedFileCache.set(file, ids);
  return ids;
}
/** Is this id a DESIGN? -> { designed: true | false | null, file }. `null` is "could not tell", and it is
 *  reported as such: telling the owner a slot will vanish when it will come back is the lie to avoid. */
async function designedOrigin(id) {
  const f = FAC.factionOfUnitId(id);
  if (!f) return { designed: false, file: null };            // no known prefix — no design file can name it
  for (const file of FAC.filesOf(f.name)) {
    const ids = await designedIdsIn(file);
    if (ids === null) return { designed: null, file };
    if (ids.has(id)) return { designed: true, file };
  }
  return { designed: false, file: null };
}

/** Everything `id` occupies, right now, as concrete targets. Synchronous: it reads only what the tool
 *  already knows (the manifest, the shipped units, wipIds), so the confirmation can enumerate without a
 *  round trip. Repo file NAMES come from the unit's own pack where there is one — atlas and shadow
 *  filenames are authored, not guessable — and from the convention where there is not. */
function removalPlan(id, origin) {
  const local = (loadManifest().units || {})[id] || null;
  const shipped = shippedUnits[id] || null;
  const files = [];
  const push = (f) => { if (f && !files.includes(f)) files.push(f); };
  // BOTH PACKS, NOT THE FIRST ONE. The local descriptor can be a "Save geometry" stub — id, class,
  // footprint, geometryOnly, NO parts — while the shipped pack is the one that names the real files.
  // Preferring either alone leaves the other's atlases and shadow sheets behind in the repo.
  let named = false;
  for (const e of [local, shipped]) {
    const pack = e && e.pack; if (!pack) continue;
    for (const pt of (pack.parts || [])) {
      if (pt.atlas) { push(UNIT_SHIP_DIR + pt.atlas); named = true; }
      if (pt.shadowAtlas) push(UNIT_SHIP_DIR + pt.shadowAtlas);
    }
    if (pack.model) push('content/units/' + (pack.model.src || `model/${id}.json`));
  }
  // No pack names its atlases (geometry-only, or nothing saved at all) — fall back to the convention the
  // ship path uses. Attempting a file that is not there is reported as "not present", never as a removal.
  if (!named) for (const part of ['body', 'turret']) push(`${UNIT_SHIP_DIR}${id}.${part}.png`);
  // THE CARD PICTURE, IN EVERY FORMAT IT HAS EVER BEEN WRITTEN IN. Naming only '.png' here would orphan
  // the '.jpg' cards this tool writes now — the unit would be gone from every store and its picture would
  // still be in the repo, which is the failure DDD-5 enumerated six places to avoid. Removal names what
  // the resolver reads, from the same constant, so the two cannot drift.
  for (const ext of CARD_READ_EXT) push(CARD_SHIP_DIR + id + ext);
  return {
    id, files,
    designed: origin ? origin.designed : false,
    designedFile: origin ? origin.file : null,
    wip: wipIds.has(id), local: !!local, shipped: !!shipped,
    stores: [
      `proj:${id}   (IndexedDB — the editable project: voxels, slices, cutouts)${wipIds.has(id) ? '' : ' — none'}`,
      `atlas:${id}  (IndexedDB — the baked sprite sheets)`,
      `model:${id}  (IndexedDB — Tier C voxel geometry)`,
      `${MANIFEST_KEY}   (localStorage — the descriptor)${local ? '' : ' — none'}`,
    ],
  };
}

/** THE CONFIRMATION. It names every unit, enumerates every store and file, and states plainly what can
 *  and cannot be undone — the browser stores cannot, the repo files land in .bak and can. */
function removalConfirmText(plans) {
  const L = [];
  L.push(plans.length === 1 ? `REMOVE THE UNIT "${plans[0].id}"?` : `REMOVE ${plans.length} UNITS?`);
  L.push('');
  L.push('This permanently destroys authored work.');
  L.push('• The browser stores (IndexedDB, localStorage) CANNOT BE UNDONE.');
  L.push('• Repo files are MOVED to <path>.bak by the dev server, so those are recoverable on disk.');
  for (const p of plans) {
    L.push('');
    L.push(`── ${p.id} ──`);
    for (const s of p.stores) L.push('   ' + s);
    for (const f of p.files) L.push('   ' + f + '   (repo — if present)');
    if (p.shipped) L.push('   content/units/voxel-units.json — its entry (the file is rewritten without it)');
    if (p.designed === true) {
      L.push(`   KEPT: the DESIGN in content/units/${p.designedFile}.`);
      L.push(`         "${p.id}" is a designed unit, so its slot stays on the roster and goes back to`);
      L.push('         reading "needs art". Removing the design is a repo edit — this tool only reads');
      L.push('         that file, so deleting the slot here would not stick.');
    } else if (p.designed === null) {
      L.push(`   ⚠ content/units/${p.designedFile} could not be read, so whether "${p.id}" is a DESIGN is`);
      L.push('     unknown. If it is, its empty slot will come back on the next load. Its art goes either way.');
    }
  }
  L.push('');
  L.push('Continue?');
  return L.join('\n');
}

/** Remove ONE unit and report per-store. Never throws; every target is its own step with its own outcome,
 *  because "it said removed" over a half-removed unit is exactly the class of lie this tool keeps fixing
 *  (the save path once printed "card created" whether or not the write succeeded). */
async function removeUnit(id, plan) {
  plan = plan || removalPlan(id, null);
  const steps = [];
  const step = (store, ok, detail) => steps.push({ store, ok, detail });
  // 1 — TOMBSTONE BEFORE THE FIRST AWAIT. The click that got here already armed doAutosave in the capture
  // phase; clearing the timer is necessary and not sufficient (it can be overdue while confirm() blocks,
  // and then fires inside the awaits below). The tombstone is what actually makes the delete authoritative.
  clearTimeout(autosaveTimer);
  deletedKeys.add('proj:' + id);
  // 2 — THE SHIPPED MANIFEST IS THE GATE, and it goes first. A removal that leaves the unit's entry in
  // content/units/voxel-units.json is a removal that comes back on the next reload — so if it cannot be
  // rewritten, nothing is touched at all. Same rail as Ship's: an unreadable disk manifest aborts, because
  // rewriting from a failed read is how four units were once deleted.
  if (plan.shipped) {
    let onDisk = null;
    try {
      const r = await fetch('../../content/units/voxel-units.json', { cache: 'no-store' });
      if (r.ok) onDisk = await r.json();
      else if (r.status !== 404) throw new Error('HTTP ' + r.status);
    } catch (e) {
      deletedKeys.delete('proj:' + id);
      step('content/units/voxel-units.json', false, `could not read it — ${(e && e.message) || e}.`
        + ` Rewriting it without "${id}" would risk every other unit on disk. NOTHING was removed.`);
      return { id, ok: false, aborted: true, steps, plan };
    }
    if (onDisk && onDisk.units && onDisk.units[id]) {
      const lean = { config: onDisk.config, units: Object.assign({}, onDisk.units) };
      delete lean.units[id];
      try {
        await shipFile('content/units/voxel-units.json', { data: lean });
        step('content/units/voxel-units.json', true, `entry removed — ${Object.keys(lean.units).length} unit(s) still on disk`);
      } catch (e) {
        deletedKeys.delete('proj:' + id);
        step('content/units/voxel-units.json', false, `${(e && e.message) || e}. NOTHING was removed —`
          + ' a unit still named by the shipped manifest reappears on the next load.');
        return { id, ok: false, aborted: true, steps, plan };
      }
    } else step('content/units/voxel-units.json', true, 'no entry on disk');
  }
  // 3 — the repo art. Each file is its own outcome; "not present" is a success, so a removal is safe to
  // repeat after a partial failure.
  for (const f of plan.files) {
    try { const d = await unshipFile(f); step(f, true, d.existed ? `moved to ${d.trash}` : 'not present'); }
    catch (e) { step(f, false, (e && e.message) || String(e)); }
  }
  // 4 — the browser stores. This is the half that cannot be undone.
  for (const k of ['proj:' + id, 'atlas:' + id, 'model:' + id]) {
    try { await idb.del(k); step(k, true, 'deleted'); }
    catch (e) { step(k, false, (e && e.message) || String(e)); }
  }
  try {
    const m = loadManifest();
    const had = !!(m.units && m.units[id]);
    if (had) { delete m.units[id]; localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); }
    if (localStorage.getItem('bulwark:sf:last') === id) localStorage.removeItem('bulwark:sf:last');
    step(MANIFEST_KEY, true, had ? 'descriptor removed' : 'no descriptor');
  } catch (e) { step(MANIFEST_KEY, false, (e && e.message) || String(e)); }
  // 5 — everything the tool holds IN MEMORY. Missing these is how a removed unit keeps its card until
  // the next reload, which reads as a failed delete.
  delete shippedUnits[id];
  wipIds.delete(id);
  thumbInvalidate(id);                                          // bump the epoch: an in-flight resolve cannot write back
  thumbCache.delete(thumbKey(id, false));                       // …and drop the picture, so the card is decided fresh
  if (plan.designed !== true) {                                 // a DESIGN keeps its slot — that is the refusal, stated
    const i = roster.findIndex((u) => u.id === id);
    if (i >= 0) roster.splice(i, 1);
  }
  // 6 — THE EDITOR MUST LAND SOMEWHERE DEFINED. Removing the unit you are looking at used to leave its
  // model, its id and its dirty flag exactly where they were, which is half of why the autosave put it
  // back. Now the editor is emptied and anchored to nothing; the tombstone survives, so nothing can
  // re-create the id until it is deliberately opened or saved again.
  if (activeUnitId === id || ($('uid').value || '').trim() === id) {
    wipDirty = false;
    clearSourceArt();
    activeUnitId = null; $('uid').value = ''; lastPack = null;
    recarve();                                                  // refreshModel() drops the baked sprites and state.baked
    setWipStatus('— removed', 'muted');
    $('bakeState').innerHTML = `<span style="color:var(--muted)">Removed "${id}" — the editor is empty.</span>`;
  }
  return { id, ok: steps.every((s) => s.ok), aborted: false, steps, plan };
}

/** the per-store outcome of a run, as the dialog shows it. A partial failure is never a colour change. */
function removalReportHTML(results) {
  return results.map((r) => {
    const head = r.aborted ? `<b style="color:#ff6b6b">✗ ${r.id} — ABORTED, nothing removed</b>`
      : r.ok ? `<b style="color:#57d98a">✓ ${r.id} — removed</b>`
      : `<b style="color:#ff6b6b">⚠ ${r.id} — PARTIALLY removed</b>`;
    return `<div style="margin:6px 0">${head}` + r.steps.map((s) =>
      `<div style="margin-left:14px;color:${s.ok ? 'var(--muted)' : '#ff6b6b'}">${s.ok ? '✓' : '✗'} ${s.store} — ${s.detail}</div>`).join('') + '</div>';
  }).join('');
}

/** Confirm, then remove, then REPORT. The one entry point; the dialog and any future caller share it. */
async function removeUnits(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return { ok: false, kind: 'NOTHING SELECTED', results: [], plans: [] };
  const plans = [];
  for (const id of list) plans.push(removalPlan(id, await designedOrigin(id)));
  if (!confirm(removalConfirmText(plans))) return { ok: false, kind: 'CANCELLED', results: [], plans };
  const results = [];
  for (const p of plans) results.push(await removeUnit(p.id, p));
  renderManifest(); renderRoster(); renderScaleChart();
  const bad = results.filter((r) => !r.ok);
  const html = removalReportHTML(results);
  if ($('rmState')) $('rmState').innerHTML = html;
  $('projState').innerHTML = bad.length
    ? `<b style="color:#ff6b6b">✗ REMOVE INCOMPLETE — ${bad.length} of ${results.length} unit(s)</b><br>${html}`
    : `🗑 Removed <b>${results.length}</b> unit(s). Repo files were moved to <b>.bak</b>; commit the deletions to deploy.<br>${html}`;
  // A PARTIAL FAILURE IS LOUD. The precedent is the save path that printed "card created" whether or not
  // the write happened: a removal that half-worked and looked green is the same defect, and worse, because
  // the leftovers are the data pollution this feature exists to clear.
  if (bad.length) {
    const msg = `REMOVE INCOMPLETE — ${bad.length} of ${results.length} unit(s) were not fully removed.\n\n`
      + bad.map((r) => `${r.id}:\n` + r.steps.filter((s) => !s.ok).map((s) => `  ✗ ${s.store} — ${s.detail}`).join('\n')).join('\n\n')
      + '\n\nWhat DID get removed is listed in the dialog. Repo files need the local dev server'
      + ' (python serve_prototype.py). Fix the cause and remove again — removal is safe to repeat.';
    console.error('[stack-forge] ' + msg);
    alert(msg);
  } else console.info(`[stack-forge] removed ${results.length} unit(s): ${results.map((r) => r.id).join(', ')}`);
  return { ok: !bad.length, results, plans };
}

// ── the Remove dialog ─────────────────────────────────────────────────────────────────────────────
// Multi-select, because "clean up old data" means volume — but the confirmation still enumerates every
// unit and every target, one by one. Decor is deliberately NOT offered here: a prop lives inline inside
// content/decor/voxel-decor.json under a different key, and a half-understood removal of the owner's
// props is worse than no button. Saying so is the honest answer.
function rmSelectedIds() {
  const boxes = $('rmList').querySelectorAll ? $('rmList').querySelectorAll('input') : [];
  return [...boxes].filter((b) => b.checked).map((b) => b.dataset.uid);
}
function openRemoveModal() {
  const list = $('rmList'); list.innerHTML = '';
  if ($('rmState')) $('rmState').innerHTML = '';
  if (isDecorSet()) {
    $('rmIntro').innerHTML = '<b style="color:#e0975f">Decor is not removable here.</b> A prop lives inline inside'
      + ' <b>content/decor/voxel-decor.json</b>, not as its own files, so removing one is a different operation'
      + ' from removing a unit. Pick a faction to remove units.';
    $('removeModal').hidden = false;
    return;
  }
  const supplied = suppliedUnits();
  const ids = [...new Set([...roster.map((u) => u.id), ...Object.keys(supplied), ...wipIds])]
    .filter((id) => supplied[id] || wipIds.has(id))               // only ids that actually occupy something
    .filter((id) => idBelongsToSet(id, curFaction))               // the SAME bucketing rule the roster uses
    .sort();
  $('rmIntro').innerHTML = ids.length
    ? `<b>${curFaction}</b> — ${ids.length} unit(s) with something saved. Tick what to remove, then confirm.`
      + ' Empty design slots are not listed: they occupy nothing.'
    : `<b>${curFaction}</b> — nothing here occupies any store, so there is nothing to remove.`;
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'rmRow';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.uid = id; cb.style.flex = '0 0 auto';
    const name = document.createElement('div'); name.className = 'rmId'; name.textContent = id;
    const what = document.createElement('div'); what.className = 'rmWhat';
    const plan = removalPlan(id, null);
    what.innerHTML = [
      plan.wip ? 'WIP project' : '', plan.local ? 'descriptor' : '', plan.shipped ? '<b>shipped pack</b>' : '',
    ].filter(Boolean).join(' · ') + `<br>${plan.files.length} repo file(s): ${plan.files.map((f) => f.replace('content/units/', '')).join(', ')}`;
    row.appendChild(cb); row.appendChild(name); row.appendChild(what);
    list.appendChild(row);
  }
  $('removeModal').hidden = false;
}
if ($('rmOpen')) $('rmOpen').onclick = openRemoveModal;
if ($('rmCancel')) $('rmCancel').onclick = () => { $('removeModal').hidden = true; };
if ($('rmAll')) $('rmAll').onclick = () => { for (const b of ($('rmList').querySelectorAll ? $('rmList').querySelectorAll('input') : [])) b.checked = true; };
if ($('rmNone')) $('rmNone').onclick = () => { for (const b of ($('rmList').querySelectorAll ? $('rmList').querySelectorAll('input') : [])) b.checked = false; };
if ($('rmGo')) $('rmGo').onclick = async () => {
  const ids = rmSelectedIds();
  if (!ids.length) { $('rmState').innerHTML = '<span style="color:#e0975f">Nothing ticked — select at least one unit.</span>'; return; }
  const r = await removeUnits(ids);
  if (r.kind === 'CANCELLED') { $('rmState').innerHTML = '<span style="color:var(--muted)">Cancelled — nothing was removed.</span>'; return; }
  openRemoveModal();                                             // relist: what is gone is gone, what failed is still there
  if ($('rmState')) $('rmState').innerHTML = removalReportHTML(r.results);
};
$('removeModal').addEventListener('click', (e) => { if (e.target === $('removeModal')) $('removeModal').hidden = true; });
// Reports what ACTUALLY happened. It used to print 'Saved …' and paint the card selected before knowing
// whether doSaveUnit had written anything, so a quota failure or an unbaked model looked like success.
async function quickSave(id, as3D) {
  $('uid').value = id;
  $('embedModel').checked = !!as3D;
  try { doBake(); }
  catch (e) { return saveFailed('BAKE THREW', `Baking "${id}" failed.

${(e && e.message) || e}`); }
  const r = await doSaveUnit();
  if (!r || !r.ok) return r;                                   // saveFailed already shouted; do NOT claim success
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  $('projState').textContent = `Saved "${id}" as ${as3D ? '3D (editable model + baked)' : 'sprites only'}`
    + ` — ${r.chars.toLocaleString()} chars in the manifest. Reload the game to see it.`;
  doAutosave();
  return r;
}
$('saveAsLoad').onclick = async () => { $('saveAsModal').hidden = true; await selectUnit(saveAsId); };   // selectUnit auto-saves the outgoing unit itself
// SAFETY: overwriting an EXISTING saved unit needs an explicit yes — clicking a roster card to *select* it
// must never silently replace it with the current model (owner data-loss report).
// Skip = switch WITHOUT saving: no flush of the outgoing unit, clear, then load. Cancel just closes the
// modal and leaves you where you are. Load still flushes first (doAutosave) -- that is the difference.
$('saveAsSkip').onclick = async () => { $('saveAsModal').hidden = true; await selectUnit(saveAsId, true); };   // the ONE explicit discard path
const closeSaveAs = () => { $('saveAsModal').hidden = true; saveAsId = null; };
$('saveAsCancel').onclick = closeSaveAs;
document.addEventListener('keydown', (e) => {                      // ESC closes it too — Cancel must never be the only way out
  if (e.key === 'Escape' && !$('saveAsModal').hidden) { closeSaveAs(); e.stopPropagation(); }
}, true);
$('saveAsModal').addEventListener('click', (e) => { if (e.target === $('saveAsModal')) closeSaveAs(); });

syncInputs(); renderManifest(); layout(); update(); updateGamePreview(); initFactions();
(async () => {                                                     // resume the last working session
  try {
    const last = localStorage.getItem('bulwark:sf:last');
    if (!last) return;
    const p = await idb.get('proj:' + last);
    if (p) { await loadProject(p); $('projState').textContent = `Restored "${p.id}" from autosave.`; }
  } catch (e) { /* no stored session */ }
})();
window.__sf = { imgs, state, recarve, setView, toggleFlip, pickFor, buildVolume, buildModel, buildFaces, renderParts, drawScene, keyedCropped, sliceMask, parseVox, voxPart, fitToVox, collectVox, writeVox, exportVox, setGSpin, resizePreview, setZoom, keyTolState, polyState, openKeyModal, snapshotProject, loadProject,
  gdbg: () => ({ baked: !!state.baked, gbaked: !!gBodyBaked, gvis: gBodyBaked && gBodyBaked.visible, gkids: gUnit.children.length }) };   // debug/test hook
