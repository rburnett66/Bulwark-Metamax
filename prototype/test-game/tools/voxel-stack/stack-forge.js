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
const lerp = (a, b, t) => a + (b - a) * t;
const elevationToSP = (elDeg, spMax = 6) => Math.max(0, Math.round(spMax * Math.cos(clamp(elDeg, 0, 90) * Math.PI / 180)));
const WORLD_SCALE = 3, SP_MAX = 6, BODY_FRAMES = 16, TURRET_FRAMES = 64, MANIFEST_KEY = 'bulwark:stackforge';
const _CLASSES = new Set(['ground', 'air', 'structure']), _KINDS = new Set(['directional', 'stack']);
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
  const DIAG = Math.ceil(2 * R), RTW = DIAG + 8, RTH = DIAG + (layers - 1) * sp + 8;
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
function keyBackground(data, w, h) {
  const c = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const cs = [c(0, 0), c(w - 1, 0), c(0, h - 1), c(w - 1, h - 1)];
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // background seed = the opaque border colour shared by the most corners (majority vote)
  let seed = null, best = 0;
  for (const q of cs) { if (q[3] < 200) continue; let n = 0; for (const r of cs) if (r[3] > 200 && dist(q, r) < 45) n++; if (n > best) { best = n; seed = q; } }
  if (!seed) return;                                                 // no opaque border colour → leave as-is
  const kr = seed[0], kg = seed[1], kb = seed[2];
  const near = (p) => Math.abs(data[p * 4] - kr) + Math.abs(data[p * 4 + 1] - kg) + Math.abs(data[p * 4 + 2] - kb);
  const N = w * h, vis = new Uint8Array(N), st = [], TOL = 75;
  const push = (x, y) => { if (x < 0 || x >= w || y < 0 || y >= h) return; const p = y * w + x; if (!vis[p] && near(p) < TOL) { vis[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }        // seed the whole border
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }
  for (let p = 0; p < N; p++) {
    if (vis[p]) { data[p * 4 + 3] = 0; continue; }                   // flooded background → transparent
    const d = near(p);                                              // feather AA pixels touching removed bg
    if (d < 130) {
      const x = p % w, y = (p / w) | 0;
      if ((x > 0 && vis[p - 1]) || (x < w - 1 && vis[p + 1]) || (y > 0 && vis[p - w]) || (y < h - 1 && vis[p + w]))
        data[p * 4 + 3] = d < 60 ? 0 : Math.min(data[p * 4 + 3], Math.round((d - 60) / 70 * 255));
    }
  }
}
// raster an image at native size and knock out its background → a canvas with clean alpha.
function keyedCanvas(img) {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, cv.width, cv.height); keyBackground(id.data, cv.width, cv.height); g.putImageData(id, 0, 0);
  return cv;
}
// keyed + CROPPED to the content bounding box — so empty margins and the raw image aspect ratio don't
// distort registration (a long-barrel side view maps its CONTENT, not the whole rectangle).
function keyedCropped(img) {
  const k = keyedCanvas(img), d = k.getContext('2d').getImageData(0, 0, k.width, k.height).data;
  let x0 = k.width, y0 = k.height, x1 = -1, y1 = -1;
  for (let yy = 0; yy < k.height; yy++) for (let xx = 0; xx < k.width; xx++) if (d[(yy * k.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < x0) return k;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(k, x0, y0, cw, ch, 0, 0, cw, ch);
  return cv;
}
// stretch a (keyed, cropped) content canvas to w×h and return an alpha grid; `elev` flips rows (z-up).
function gridStretch(canvas, w, h, elev) {
  h = Math.max(1, h);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) for (let a = 0; a < w; a++) { const row = elev ? (h - 1 - r) : r; out[row * w + a] = d[(r * w + a) * 4 + 3] > 40 ? 1 : 0; }
  return out;
}

// ── MagicaVoxel .vox → a native voxel model { nx, ny, nz, data } (data: nx*ny*nz*4 rgba, a>0 = filled).
// A .vox IS a stack of coloured cubes, so it skips the photo carve entirely — exact geometry + per-voxel
// colour, fed straight into the same neutral-model → light → rotate/capture pipeline. First model only. ──
const DEFAULT_VOX_PALETTE = (() => { const a = new Uint8Array(256 * 4); for (let i = 0; i < 256; i++) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = Math.min(255, 48 + i * 3 / 4 | 0); a[i * 4 + 3] = 255; } return a; })();
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
  const m = models[0], [nx, ny, nz] = m.size, pal = rgba || DEFAULT_VOX_PALETTE, data = new Uint8Array(nx * ny * nz * 4);
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
        if (data[di + 3] > 0) { const oi = z * N + y * foot + x; fill[oi] = 1; vcol[oi * 3] = data[di]; vcol[oi * 3 + 1] = data[di + 1]; vcol[oi * 3 + 2] = data[di + 2]; }
      }
    }
  }
  const filled = (x, y, z) => (x >= 0 && x < foot && y >= 0 && y < foot && z >= 0 && z < layers) ? !!fill[z * N + y * foot + x] : false;
  return { filled, vcol, cd: null, dbg: { vox: [nx, ny, nz], bw, bh, Hh } };
}

// Space-carve a part's volume from orthographic views: TOP → footprint + colour; SIDE (height along the
// length) + FRONT (height across the width) → the carved height; BACK falls back for FRONT. A voxel is
// filled only where every supplied view agrees. Top alone = flat extrude. No Top view → procedural.
// Returns { cd (colour bytes), H (top-surface height/column), filled(x,y,z) }.
function buildVolume(partId, foot, layers) {
  if (voxPart[partId]) return buildVoxVolume(voxPart[partId], foot, layers);   // imported .vox → use it directly
  const src = imgs[partId], N = foot * foot;
  if (!src.top && !src.side && !src.front && !src.back) {   // ── no art at all → procedural placeholder ──
    const col = document.createElement('canvas'); col.width = col.height = foot;
    const hgt = document.createElement('canvas'); hgt.width = hgt.height = foot;
    const cx = col.getContext('2d'), hx = hgt.getContext('2d');
    hx.fillStyle = '#000'; hx.fillRect(0, 0, foot, foot);
    (partId === 'turret' ? drawTurret : drawBody)(cx, hx, foot);
    const cd = cx.getImageData(0, 0, foot, foot).data, hd = hx.getImageData(0, 0, foot, foot).data;
    const H = new Float32Array(N);
    for (let i = 0; i < N; i++) H[i] = cd[i * 4 + 3] > 20 ? (hd[i * 4] / 255) * layers : 0;
    return { cd, H, filled: (x, y, z) => z < H[y * foot + x] };
  }
  // crop every view to its content, then register by a COMMON scale taken from the top's fit — so the
  // side's height maps PROPORTIONALLY (a long-barrel side doesn't get stretched vertically to fill layers).
  const topC = src.top ? keyedCropped(src.top) : null;
  const sideC = src.side ? keyedCropped(src.side) : null;
  const frontC = src.front ? keyedCropped(src.front) : (src.back ? keyedCropped(src.back) : null);
  const tc = document.createElement('canvas'); tc.width = tc.height = foot; const tx = tc.getContext('2d');
  // procedural barrel reserves a FORWARD margin so the body shrinks back and the tube protrudes past it
  const reach = (partId === 'turret' && state.barrelLen > 0) ? state.barrelLen : 0;
  let s, bw, bh, ox, oy;
  if (topC) {                                            // footprint + colour from the top (aspect-preserving)
    const availW = Math.max(8, foot - reach);            // leave room up-front for the barrel
    s = Math.min(availW / topC.width, foot / topC.height);
    bw = Math.max(1, Math.round(topC.width * s)); bh = Math.max(1, Math.round(topC.height * s));
    ox = Math.floor((availW - bw) / 2); oy = Math.floor((foot - bh) / 2);   // body sits toward the rear
    tx.drawImage(topC, ox, oy, bw, bh);
  } else {                                               // no top: length from side, width from front
    const SL = sideC ? sideC.width : foot, FW = frontC ? frontC.width : Math.round(foot * 0.5);
    s = Math.min(foot / SL, foot / Math.max(1, FW));
    bw = Math.max(1, Math.round(SL * s)); bh = Math.max(1, Math.round(FW * s));
    ox = Math.floor((foot - bw) / 2); oy = Math.floor((foot - bh) / 2);
    tx.fillStyle = '#9a8c66'; tx.fillRect(ox, oy, bw, bh);
  }
  const cd = tx.getImageData(0, 0, foot, foot).data;
  const top = (x, y) => cd[(y * foot + x) * 4 + 3] > 20;
  // HEIGHT is the truth from the FRONT view — it's near-square, so it isn't distorted by a long barrel.
  // Each profile's WIDTH maps to a known footprint dim (front width → depth bh, side width → length bw),
  // so height = view.height × (that footprint dim / view.width). Prefer front; the side is then stretched
  // (gridStretch) to this SAME Hv — i.e. the side's height is normalized to the front's truth.
  const Hraw = frontC ? frontC.height * (bh / frontC.width)
    : sideC ? sideC.height * (bw / sideC.width)
    : layers * 0.66;
  const Hv = Math.min(layers, Math.max(1, Math.round(Hraw)));
  const sideG = sideC ? gridStretch(sideC, bw, Hv, true) : null;    // length × height (normalized to front)
  const frontG = frontC ? gridStretch(frontC, bh, Hv, true) : null; // width × height
  const side = (x, z) => sideG ? (x >= ox && x < ox + bw && z >= 0 && z < Hv && !!sideG[z * bw + (x - ox)]) : z < Hv;
  const width = (y, z) => frontG ? (y >= oy && y < oy + bh && z >= 0 && z < Hv && !!frontG[z * bh + (y - oy)]) : z < Hv;
  const flat = !sideG && !frontG;
  const bodyFilled = flat ? (x, y, z) => top(x, y) && z < Hv : (x, y, z) => top(x, y) && side(x, z) && width(y, z);
  // procedural barrel: a real round tube along +X, placed relative to the body box, ORed into the volume
  let inBarrel = null;
  if (reach && topC) {
    const cy = oy + bh / 2, r = Math.max(0.5, state.barrelRad);
    const bx0 = ox + Math.round(bw * 0.35), bx1 = Math.min(foot - 1, ox + bw + reach);   // from inside the body to the tip
    const bz = clamp(Math.round(state.barrelElev / 100 * (Hv - 1)), 0, layers - 1);
    inBarrel = (x, y, z) => x >= bx0 && x <= bx1 && (y - cy) * (y - cy) + (z - bz) * (z - bz) <= r * r;
    let R = 0, G = 0, B = 0, c = 0;                                  // barrel tint = darkened mean body colour
    for (let i = 0; i < N; i++) { const p = i * 4; if (cd[p + 3] > 20) { R += cd[p]; G += cd[p + 1]; B += cd[p + 2]; c++; } }
    const bt = c ? [R / c * 0.72 | 0, G / c * 0.72 | 0, B / c * 0.72 | 0] : [82, 84, 92];
    for (let x = Math.max(0, bx0); x <= bx1; x++) for (let y = Math.max(0, Math.ceil(cy - r)); y <= Math.min(foot - 1, Math.floor(cy + r)); y++) {
      const p = (y * foot + x) * 4; if (cd[p + 3] < 20) { cd[p] = bt[0]; cd[p + 1] = bt[1]; cd[p + 2] = bt[2]; cd[p + 3] = 255; }
    }
  }
  const filled = inBarrel ? (x, y, z) => bodyFilled(x, y, z) || inBarrel(x, y, z) : bodyFilled;
  const H = new Float32Array(N);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    let h = 0; for (let z = layers - 1; z >= 0; z--) if (filled(x, y, z)) { h = z + 1; break; }
    H[y * foot + x] = h;
  }
  return { cd, H, filled, dbg: { bw, bh, Hv, Hraw: +Hraw.toFixed(1), tw: topC && topC.width, th: topC && topC.height, sw: sideC && sideC.width, sh: sideC && sideC.height, fw: frontC && frontC.width, fh: frontC && frontC.height } };
}

// Slice a part into layer textures as a STACK OF COLOURED CUBES. Tops render in FLAT neutral colour
// (the clean cube colour — no per-pixel/height-field texture). Lighting lives on the EDGES: the exposed
// vertical cube faces (a filled voxel with an empty same-layer neighbour) are the surfaces that catch the
// game-aligned directional light — bright when the face points toward it, shaded when it points away.
function makeSlices(partId, foot, layers, lightAz, lightK) {
  const { cd, filled, vcol } = buildVolume(partId, foot, layers), N = foot * foot;   // vcol = per-voxel colour (.vox)
  const la = lightAz * Math.PI / 180, Lx = Math.cos(la), Ly = -Math.sin(la);   // light-source dir, image space (y-down)
  const k = clamp(lightK / 100, 0, 1), WALL = 0.52, RANGE = 0.46;              // wall base + directional swing
  const textures = [];
  for (let kk = 0; kk < layers; kk++) {
    const lc = document.createElement('canvas'); lc.width = lc.height = foot;
    const ctx = lc.getContext('2d'), img = ctx.createImageData(foot, foot), o = img.data;
    for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      const i = y * foot + x, p = i * 4;
      if (!filled(x, y, kk)) { o[p + 3] = 0; continue; }
      let shade;
      if (!filled(x, y, kk + 1)) {
        shade = 1.0;                                              // TOP face — flat, neutral cube colour
      } else {                                                    // WALL — directional light on the exposed faces
        let d = -2;                                               // best (face · light) over exposed cube faces
        if (!filled(x + 1, y, kk)) d = Math.max(d, Lx);          // +x face
        if (!filled(x - 1, y, kk)) d = Math.max(d, -Lx);         // -x face
        if (!filled(x, y - 1, kk)) d = Math.max(d, -Ly);         // image-up face
        if (!filled(x, y + 1, kk)) d = Math.max(d, Ly);          // image-down face
        shade = clamp(WALL + k * RANGE * (d <= -2 ? 0 : d), 0.3, 1.0);   // enclosed → flat ambient (unseen)
      }
      let cr, cg, cb;                                            // neutral cube colour: per-voxel (.vox) or per-column
      if (vcol) { const c = (kk * N + i) * 3; cr = vcol[c]; cg = vcol[c + 1]; cb = vcol[c + 2]; }
      else { cr = cd[p]; cg = cd[p + 1]; cb = cd[p + 2]; }
      o[p] = clamp(cr * shade, 0, 255); o[p + 1] = clamp(cg * shade, 0, 255);
      o[p + 2] = clamp(cb * shade, 0, 255); o[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    textures.push(PIXI.Texture.from(lc));
  }
  return textures;
}

// ── bake: per-angle cache with 2× supersample + CAS-lite unsharp (ported from the prototype) ──
const SHARPEN_FRAG = `
  precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler;
  uniform vec2 uTexel; uniform float uSharp;
  void main() {
    vec4 c = texture2D(uSampler, vTextureCoord);
    vec3 n = texture2D(uSampler, vTextureCoord + vec2(0.0,-uTexel.y)).rgb;
    vec3 s = texture2D(uSampler, vTextureCoord + vec2(0.0, uTexel.y)).rgb;
    vec3 e = texture2D(uSampler, vTextureCoord + vec2( uTexel.x,0.0)).rgb;
    vec3 w = texture2D(uSampler, vTextureCoord + vec2(-uTexel.x,0.0)).rgb;
    vec3 blur = (n+s+e+w)*0.25; vec3 sharp = c.rgb + uSharp*(c.rgb - blur);
    gl_FragColor = vec4(clamp(sharp,0.0,1.0), c.a);
  }`;
function bakeAngleCache(renderer, slices, opts) {
  const { frames, smooth, sharp, layers, sp, g, pivotFrac = 0.5 } = opts, SS = smooth ? 2 : 1, STEP = (Math.PI * 2) / frames;
  const container = new PIXI.Container(), layerSprites = [];
  for (let kk = 0; kk < layers; kk++) { const s = new PIXI.Sprite(slices[kk]); s.anchor.set(pivotFrac, 0.5); s.scale.set(SS); container.addChild(s); layerSprites.push(s); }
  let bigRT = null, ds = null;
  if (smooth) {
    bigRT = PIXI.RenderTexture.create({ width: g.RTW * SS, height: g.RTH * SS }); bigRT.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    ds = new PIXI.Sprite(bigRT); ds.scale.set(1 / SS);
    if (sharp > 0) ds.filters = [new PIXI.Filter(undefined, SHARPEN_FRAG, { uSharp: sharp, uTexel: [1 / g.RTW, 1 / g.RTH] })];
  }
  const cache = [];
  for (let a = 0; a < frames; a++) {
    const ang = a * STEP;
    for (let kk = 0; kk < layers; kk++) { layerSprites[kk].position.set(g.CX * SS, (g.BASEY - kk * sp) * SS); layerSprites[kk].rotation = ang; }
    const rt = PIXI.RenderTexture.create({ width: g.RTW, height: g.RTH });
    rt.baseTexture.scaleMode = smooth ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;
    if (smooth) { renderer.render(container, { renderTexture: bigRT }); renderer.render(ds, { renderTexture: rt }); }
    else renderer.render(container, { renderTexture: rt });
    cache.push(rt);
  }
  container.destroy({ children: true }); if (bigRT) { ds.destroy(); bigRT.destroy(true); }
  return cache;
}
const bucketOf = (a, n) => (((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n);

// ── app + state ──
const app = new PIXI.Application({ backgroundColor: 0x0a121c, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true, resizeTo: $('stage') });
$('stage').appendChild(app.view);
const rig = new PIXI.Container(); rig.scale.set(WORLD_SCALE); app.stage.addChild(rig);
const grid = new PIXI.Graphics(); grid.lineStyle(1, 0x1d3040, 1);
for (let g = -120; g <= 120; g += 20) { grid.moveTo(g, -80).lineTo(g, 80); grid.moveTo(-120, g * 0.66).lineTo(120, g * 0.66); }
grid.position.set(0, 40); rig.addChild(grid);
// keep the big orbit view centred as the stage resizes (fills the whole stage area now)
let SCW = 720, SCH = 560;
function layout() {
  SCW = app.screen.width; SCH = app.screen.height;
  rig.position.set(SCW / 2, SCH * 0.56);
  if (typeof placeGamePreview === 'function') placeGamePreview();
  drawLight();
}
app.renderer.on('resize', layout);

// light-source indicator — a sun on a ring at the light azimuth, in SCREEN space (on top of the
// model), showing where the game-aligned light comes from. Elevation shrinks the ring (more overhead).
const lightGfx = new PIXI.Graphics(); app.stage.addChild(lightGfx);
function drawLight() {
  const cx = SCW / 2, cy = SCH * 0.44, R = 150 + (1 - 0.6) * 90;   // ~overhead-ish ring, centred on the stage
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

// ── IN-GAME preview (bottom-right inset): the unit standing on a board tile at GAME scale + shadow,
// slowly turning to show its facings — so you can judge how it reads on the board, not just in orbit.
// Game facts (from src/render): 64px tile, ground greens 0x33502c/0x3c5c33/0x45683a, black grid @0.12,
// unit ≈ 2 tiles wide, flat ellipse shadow 0x000000 @0.26 (radii tile·r·0.62 × tile·r·0.31).
const GAME_TILE = 54, PVW = 214, PVH = 210;            // preview px/tile (64 shrunk to fit) + inset size
const gameLayer = new PIXI.Container(); app.stage.addChild(gameLayer);
const gPanel = new PIXI.Graphics(); gameLayer.addChild(gPanel);
const gWorld = new PIXI.Container(); gameLayer.addChild(gWorld);         // masked board + shadow + unit
const gBoard = new PIXI.Graphics(); gWorld.addChild(gBoard);
const gShadow = new PIXI.Graphics(); gWorld.addChild(gShadow);
const gUnit = new PIXI.Container(); gWorld.addChild(gUnit);
const gClip = new PIXI.Graphics(); gameLayer.addChild(gClip); gWorld.mask = gClip;
const gTitle = new PIXI.Text('IN-GAME  ·  1 tile = 64px', { fontFamily: 'Segoe UI, sans-serif', fontSize: 10, fill: 0xb9c8d6, letterSpacing: 1.4 });
gTitle.position.set(11, PVH - 16); gameLayer.addChild(gTitle);   // caption along the bottom, clear of the unit
let gBodyL = [], gTurretL = [], gBodyBaked = null, gTurretBaked = null, gAnchor = { x: PVW / 2, y: PVH * 0.6 };
gClip.beginFill(0xffffff); gClip.drawRoundedRect(0, 0, PVW, PVH, 10); gClip.endFill();
function drawGameBoard() {
  gPanel.clear(); gPanel.lineStyle(1, 0x24384a, 1); gPanel.beginFill(0x0e1216, 1); gPanel.drawRoundedRect(0, 0, PVW, PVH, 10); gPanel.endFill();
  gBoard.clear();
  const cols = 4, rows = 4, bw = cols * GAME_TILE, bh = rows * GAME_TILE, bands = [0x33502c, 0x3c5c33, 0x45683a];
  const bx = (PVW - bw) / 2, by = PVH - bh + GAME_TILE;                  // board sits low; unit stands centre-ish
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) { gBoard.beginFill(bands[(cx * 7 + ry * 3) % 3]); gBoard.drawRect(bx + cx * GAME_TILE, by + ry * GAME_TILE, GAME_TILE, GAME_TILE); gBoard.endFill(); }
  gBoard.lineStyle(1, 0x000000, 0.12);
  for (let c = 0; c <= cols; c++) gBoard.moveTo(bx + c * GAME_TILE, by).lineTo(bx + c * GAME_TILE, by + bh);
  for (let r = 0; r <= rows; r++) gBoard.moveTo(bx, by + r * GAME_TILE).lineTo(bx + bw, by + r * GAME_TILE);
  gAnchor = { x: bx + bw / 2, y: by + GAME_TILE * 1.5 };                 // ground-contact point (a tile centre)
}
function placeGamePreview() { gameLayer.position.set(SCW - PVW - 16, 16); }
drawGameBoard();

const imgs = { body: { top: null, side: null, front: null, back: null }, turret: { top: null, side: null, front: null, back: null } };
// per-slot flip: keep the raw source + H/V flags so flips compose from the original (no quality drift)
const mkViews = (v) => ({ top: v(), side: v(), front: v(), back: v() });
const srcImg = { body: mkViews(() => null), turret: mkViews(() => null) };
const flipState = { body: mkViews(() => ({ h: false, v: false })), turret: mkViews(() => ({ h: false, v: false })) };
function flipCanvas(im, h, v) {
  const w = im.width, hh = im.height, c = document.createElement('canvas'); c.width = w; c.height = hh;
  const g = c.getContext('2d'); g.translate(h ? w : 0, v ? hh : 0); g.scale(h ? -1 : 1, v ? -1 : 1); g.drawImage(im, 0, 0); return c;
}
const state = { foot: 64, layers: 16, az: 0, el: 30, taim: 0, turretDx: 0, turretPivot: 0, spin: false, part: 'both',
  barrelLen: 0, barrelRad: 4, barrelElev: 55, lightAz: 135, lightK: 55, smooth: true, sharp: 0.6, cls: 'ground', baseY: 24, baked: null };
let bodyL = [], turretL = [], bodyBaked = null, turretBaked = null, lastPack = null;
const voxPart = { body: null, turret: null };   // imported MagicaVoxel models (override the photo carve per part)

// (re)build the LIVE slice-stack sprites (LAYERS can change) — the orbit/camera-set preview
function rebuildSlices() {
  for (const s of bodyL) s.destroy(); for (const s of turretL) s.destroy();
  if (bodyBaked) { bodyBaked.destroy(); bodyBaked = null; } if (turretBaked) { turretBaked.destroy(); turretBaked = null; }
  state.baked = null; $('saveUnit').disabled = true; $('dlSheet').disabled = true;
  const bs = makeSlices('body', state.foot, state.layers, state.lightAz, state.lightK);
  const ts = makeSlices('turret', state.foot, state.layers, state.lightAz, state.lightK);
  const mk = (slices, parent) => slices.map((tex) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); parent.addChild(s); return s; });
  bodyL = mk(bs, rig); turretL = mk(ts, rig);
  for (const s of gBodyL) s.destroy(); for (const s of gTurretL) s.destroy();   // in-game preview shares the same textures
  if (gBodyBaked) { gBodyBaked.destroy(); gBodyBaked = null; } if (gTurretBaked) { gTurretBaked.destroy(); gTurretBaked = null; }
  gBodyL = mk(bs, gUnit); gTurretL = mk(ts, gUnit);
}
rebuildSlices();

function update() {
  const sp = elevationToSP(state.el, SP_MAX), azR = state.az * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = Math.round(state.layers * 0.55);
  const ox = state.turretDx * Math.cos(azR), oy = state.turretDx * Math.sin(azR);   // front-back mount offset
  const pivotFrac = 0.5 + state.turretPivot / 100;                                  // turret rotation pivot
  if (state.baked) {
    for (const s of bodyL) s.visible = false; for (const s of turretL) s.visible = false;
    const bb = bucketOf(azR, state.baked.bodyFrames), tb = bucketOf(azR + taimR, state.baked.turretFrames);
    bodyBaked.texture = state.baked.body[bb]; bodyBaked.visible = showB; bodyBaked.position.set(0, state.baseY);
    turretBaked.texture = state.baked.turret[tb]; turretBaked.visible = showT;
    turretBaked.position.set(ox, state.baseY - mountDz * sp + oy);
    return;
  }
  for (let k = 0; k < state.layers; k++) {
    bodyL[k].visible = showB; bodyL[k].position.set(0, state.baseY - k * sp); bodyL[k].rotation = azR;
    turretL[k].visible = showT; turretL[k].anchor.set(pivotFrac, 0.5); turretL[k].position.set(ox, state.baseY - mountDz * sp - k * sp + oy); turretL[k].rotation = azR + taimR;
  }
}
// position the in-game preview: unit at GAME scale on the tile, slowly turning to show facings, with the
// game shadow. Uses the same elevation as the bake camera so the preview matches what you'll ship.
let gPrevAz = 0;
function updateGamePreview() {
  gPrevAz = (gPrevAz + 0.4) % 360;
  const azR = gPrevAz * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const spG = elevationToSP(state.el, SP_MAX), uScale = (GAME_TILE * 1.7) / state.foot;   // footprint ≈ 1.7 tiles
  gUnit.scale.set(uScale); gUnit.position.set(gAnchor.x, gAnchor.y + GAME_TILE * 0.12);
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = Math.round(state.layers * 0.55);
  const ox = state.turretDx * Math.cos(azR), oy = state.turretDx * Math.sin(azR), pivotFrac = 0.5 + state.turretPivot / 100, r = 0.75;
  gShadow.clear(); gShadow.beginFill(0x000000, 0.26); gShadow.drawEllipse(gAnchor.x, gAnchor.y + GAME_TILE * 0.06, GAME_TILE * r * 0.62, GAME_TILE * r * 0.31); gShadow.endFill();
  if (state.baked && gBodyBaked) {                                    // show the actual baked (smooth) game asset
    for (const s of gBodyL) s.visible = false; for (const s of gTurretL) s.visible = false;
    const bb = bucketOf(azR, state.baked.bodyFrames), tb = bucketOf(azR + taimR, state.baked.turretFrames);
    gBodyBaked.texture = state.baked.body[bb]; gBodyBaked.visible = showB; gBodyBaked.position.set(0, 0);
    gTurretBaked.texture = state.baked.turret[tb]; gTurretBaked.visible = showT; gTurretBaked.position.set(ox, -mountDz * spG + oy);
    return;
  }
  if (gBodyBaked) { gBodyBaked.visible = false; gTurretBaked.visible = false; }
  for (let k = 0; k < state.layers; k++) {
    gBodyL[k].visible = showB; gBodyL[k].position.set(0, -k * spG); gBodyL[k].rotation = azR;
    gTurretL[k].visible = showT; gTurretL[k].anchor.set(pivotFrac, 0.5); gTurretL[k].position.set(ox, -mountDz * spG - k * spG + oy); gTurretL[k].rotation = azR + taimR;
  }
}
app.ticker.add(() => {
  if (state.spin) { state.taim = (state.taim + 1.2) % 360; $('taim').value = state.taim | 0; $('taimV').textContent = (state.taim | 0) + '°'; }
  update(); updateGamePreview();
});

// ── orbit drag ──
let drag = null;
app.view.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el }; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  state.az = ((drag.az + (e.clientX - drag.x) * 0.6) % 360 + 360) % 360;
  state.el = clamp(drag.el - (e.clientY - drag.y) * 0.35, 0, 90); syncInputs();
});
function syncInputs() { $('az').value = state.az | 0; $('azV').textContent = (state.az | 0) + '°'; $('el').value = state.el | 0; $('elV').textContent = (state.el | 0) + '°'; }

// ── controls ──
$('az').oninput = (e) => { state.az = +e.target.value; $('azV').textContent = state.az + '°'; };
$('el').oninput = (e) => { state.el = +e.target.value; $('elV').textContent = state.el + '°'; };
$('taim').oninput = (e) => { state.taim = +e.target.value; $('taimV').textContent = state.taim + '°'; };
$('tdx').oninput = (e) => { state.turretDx = +e.target.value; $('tdxV').textContent = state.turretDx; };
$('tpiv').oninput = (e) => { state.turretPivot = +e.target.value; $('tpivV').textContent = state.turretPivot; };
$('blen').oninput = (e) => { state.barrelLen = +e.target.value; $('blenV').textContent = state.barrelLen || 'off'; rebuildSlices(); };
$('brad').oninput = (e) => { state.barrelRad = +e.target.value; $('bradV').textContent = state.barrelRad; rebuildSlices(); };
$('belev').oninput = (e) => { state.barrelElev = +e.target.value; $('belevV').textContent = state.barrelElev; rebuildSlices(); };
$('spin').onchange = (e) => { state.spin = e.target.checked; };
$('layers').oninput = (e) => { state.layers = +e.target.value; $('layersV').textContent = state.layers; rebuildSlices(); };
$('res').onchange = (e) => { state.foot = +e.target.value; rebuildSlices(); };
// ── .vox import: bring a ready-made voxel model in as the base/turret (skips the carve) ──
function fitToVox() {
  let mx = 0, mh = 0;
  for (const kk of ['body', 'turret']) { const v = voxPart[kk]; if (v) { mx = Math.max(mx, v.nx, v.ny); mh = Math.max(mh, v.nz); } }
  if (!mx) return;
  const res = [32, 48, 64, 96, 128]; state.foot = res.find((r) => r >= mx) || 128; state.layers = clamp(mh, 6, 40);
  $('res').value = state.foot; $('layers').value = state.layers; $('layersV').textContent = state.layers;
}
function importVox(part, file) {
  const rd = new FileReader();
  rd.onload = () => {
    try { const m = parseVox(rd.result); voxPart[part] = m; fitToVox(); rebuildSlices();
      $('voxState').innerHTML = `<span class="lock">✓ ${part}: ${m.nx}×${m.ny}×${m.nz} voxels — foot ${state.foot}, layers ${state.layers}</span>`;
    } catch (e) { alert('Could not read that .vox — ' + e.message); }
  };
  rd.readAsArrayBuffer(file);
}
$('voxBody').onchange = (e) => e.target.files[0] && importVox('body', e.target.files[0]);
$('voxTurret').onchange = (e) => e.target.files[0] && importVox('turret', e.target.files[0]);
$('voxClear').onclick = () => { voxPart.body = null; voxPart.turret = null; rebuildSlices(); $('voxState').textContent = 'Cleared — back to the photo carve.'; };
$('lightAz').oninput = (e) => { state.lightAz = +e.target.value; $('lightAzV').textContent = state.lightAz + '°'; rebuildSlices(); drawLight(); };
$('lightK').oninput = (e) => { state.lightK = +e.target.value; $('lightKV').textContent = state.lightK; rebuildSlices(); };
$('smooth').onchange = (e) => { state.smooth = e.target.checked; };
$('sharp').oninput = (e) => { state.sharp = +e.target.value / 100; $('sharpV').textContent = state.sharp.toFixed(2); };
$('partSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.part = b.dataset.p; [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };
$('clsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.cls = b.dataset.c; [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };

// ── orthographic view pickers: 4 thumbnails per part; click to browse OR hover + Ctrl+V to paste ──
const VIEWS = ['top', 'side', 'front', 'back'];
document.querySelectorAll('.views').forEach((box) => {
  box.innerHTML = VIEWS.map((v) => `<div class="vslot"><label class="vpick" data-part="${box.dataset.part}" data-view="${v}"><canvas width="48" height="40"></canvas><input type="file" accept="image/*"></label><div class="vmeta"><span>${v[0].toUpperCase() + v.slice(1)}</span><span class="fl"><button type="button" class="flip" data-axis="h" title="Flip horizontal">⇔</button><button type="button" class="flip" data-axis="v" title="Flip vertical">⇕</button></span></div></div>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.flip'); if (!btn) return;
    e.preventDefault(); const pick = btn.closest('.vslot').querySelector('.vpick');
    toggleFlip(pick.dataset.part, pick.dataset.view, btn.dataset.axis);
  });
});
const pickFor = (part, view) => document.querySelector(`.vpick[data-part="${part}"][data-view="${view}"]`);
function setView(pick, im) {
  const part = pick.dataset.part, view = pick.dataset.view;
  voxPart[part] = null;                                                       // photos override an imported .vox
  srcImg[part][view] = im; flipState[part][view] = { h: false, v: false };   // new image → clear flips
  renderView(pick);
}
function renderView(pick) {
  const part = pick.dataset.part, view = pick.dataset.view, src = srcImg[part][view];
  if (!src) return;
  const fl = flipState[part][view], im = (fl.h || fl.v) ? flipCanvas(src, fl.h, fl.v) : src;
  imgs[part][view] = im;
  const g = pick.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 48, 40); drawFit(g, keyedCanvas(im), 48, 40);
  pick.classList.add('set'); updateFlipBtns(pick); rebuildSlices();
}
function toggleFlip(part, view, axis) {
  if (!srcImg[part][view]) return;
  flipState[part][view][axis] = !flipState[part][view][axis]; renderView(pickFor(part, view));
}
function updateFlipBtns(pick) {
  const fl = flipState[pick.dataset.part][pick.dataset.view], slot = pick.closest('.vslot'); if (!slot) return;
  slot.querySelector('.flip[data-axis="h"]').classList.toggle('on', fl.h);
  slot.querySelector('.flip[data-axis="v"]').classList.toggle('on', fl.v);
}
let pasteTarget = null;
document.querySelectorAll('.vpick').forEach((pick) => {
  pick.addEventListener('mouseenter', () => { pasteTarget = pick; document.querySelectorAll('.vpick').forEach((p) => p.classList.toggle('active', p === pick)); });
  pick.querySelector('input').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const im = new Image(); im.onload = () => setView(pick, im); im.onerror = () => alert('Could not load that image — PNG/JPEG?'); im.src = URL.createObjectURL(file);
  });
});
// paste an image from the clipboard into the hovered/active view slot
document.addEventListener('paste', (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const it of items) if (it.type && it.type.indexOf('image') === 0) {
    const file = it.getAsFile(); if (!file || !pasteTarget) return;
    const im = new Image(); im.onload = () => setView(pasteTarget, im); im.src = URL.createObjectURL(file);
    e.preventDefault(); return;
  }
});

$('setCam').onclick = () => {
  $('camState').innerHTML = `<span class="lock">✓ Camera set — azimuth ${state.az | 0}° · elevation ${state.el | 0}° · SP ${elevationToSP(state.el | 0, SP_MAX)}</span>`;
};

// ── BAKE ──
$('bake').onclick = () => {
  const foot = state.foot, layers = state.layers, sp = elevationToSP(state.el, SP_MAX);
  const pivotPx = foot * state.turretPivot / 100, pivotFrac = 0.5 + state.turretPivot / 100;
  const g = geom(foot, layers, sp, pivotPx);   // render texture sized for the turret's (possibly offset) pivot
  const t0 = performance.now();
  const bs = makeSlices('body', foot, layers, state.lightAz, state.lightK);
  const ts = makeSlices('turret', foot, layers, state.lightAz, state.lightK);
  const body = bakeAngleCache(app.renderer, bs, { frames: BODY_FRAMES, smooth: false, sharp: 0, layers, sp, g, pivotFrac: 0.5 });
  const turret = bakeAngleCache(app.renderer, ts, { frames: TURRET_FRAMES, smooth: state.smooth, sharp: state.sharp, layers, sp, g, pivotFrac });
  bs.forEach((t) => t.destroy(true)); ts.forEach((t) => t.destroy(true));
  state.baked = { body, turret, bodyFrames: BODY_FRAMES, turretFrames: TURRET_FRAMES, g, sp, foot, layers };
  bodyBaked = new PIXI.Sprite(body[0]); bodyBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); rig.addChild(bodyBaked);
  turretBaked = new PIXI.Sprite(turret[0]); turretBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); rig.addChild(turretBaked);
  gBodyBaked = new PIXI.Sprite(body[0]); gBodyBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); gUnit.addChild(gBodyBaked);   // in-game preview
  gTurretBaked = new PIXI.Sprite(turret[0]); gTurretBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); gUnit.addChild(gTurretBaked);
  const vram = ((g.RTW * g.RTH * 4 * (BODY_FRAMES + TURRET_FRAMES)) / 1048576).toFixed(1);
  $('bakeState').innerHTML = `<span class="lock">✓ Baked in ${(performance.now() - t0).toFixed(0)}ms · ${g.RTW}×${g.RTH} · ~${vram}MB cache</span>`;
  $('saveUnit').disabled = false; $('dlSheet').disabled = false;
};

// pack a part's baked frames into one atlas canvas (grid), return { canvas, cols, cell:[w,h] }
function packAtlas(cache, g) {
  const n = cache.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cv = document.createElement('canvas'); cv.width = cols * g.RTW; cv.height = rows * g.RTH;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < n; i++) { const fc = app.renderer.extract.canvas(cache[i]); ctx.drawImage(fc, (i % cols) * g.RTW, ((i / cols) | 0) * g.RTH); }
  return { canvas: cv, cols, cell: [g.RTW, g.RTH] };
}
function buildPack() {
  const b = state.baked, id = ($('uid').value || 'unit').trim();
  const ba = packAtlas(b.body, b.g), ta = packAtlas(b.turret, b.g);
  const pivot = [Math.round(b.g.CX), Math.round(b.g.BASEY)], mountDz = Math.round(b.layers * 0.55);
  const pack = {
    id, class: state.cls, footprint: [b.foot, b.foot, b.layers],
    camera: { azimuth: state.az | 0, elevation: state.el | 0 }, layerSpacing: b.sp,
    light: { azimuth: state.lightAz, contrast: state.lightK },
    parts: [
      { id: 'body', kind: 'directional', facings: b.bodyFrames, atlas: `${id}.body.png`, cell: ba.cell, cols: ba.cols, pivot, zeroFacing: '+x' },
      { id: 'turret', kind: 'stack', angles: b.turretFrames, atlas: `${id}.turret.png`, cell: ta.cell, cols: ta.cols, pivot, mount: [state.turretDx, 0, mountDz] },
    ],
    shadow: { kind: 'ellipse', rx: Math.round(b.foot / 2), ry: Math.round(b.foot * 0.22), alt: state.cls === 'air' ? 30 : 0 },
    stats: { speed: 90, turnRate: 3.0, turretRate: 4.0 },
  };
  return { pack, atlases: { body: ba.canvas.toDataURL('image/png'), turret: ta.canvas.toDataURL('image/png') } };
}

// ── SAVE to manifest ──
const loadManifest = () => { try { return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}'); } catch (e) { return {}; } };
function renderManifest() {
  const m = loadManifest(), ids = Object.keys(m.units || {});
  $('manifest').innerHTML = ids.length
    ? ids.map((id) => `<div class="u"><b>${id}</b><span>${m.units[id].pack.class} · ${m.units[id].pack.footprint.join('×')}</span></div>`).join('')
    : 'No units saved yet.';
}
$('saveUnit').onclick = () => {
  if (!state.baked) return; const built = buildPack(); const v = validatePack(built.pack);
  const m = loadManifest();
  m.config = { camera: built.pack.camera, light: built.pack.light };   // shared game-wide config
  m.units = m.units || {}; m.units[built.pack.id] = built;
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); } catch (e) { $('saveState').textContent = 'Save failed (storage full — use Download).'; return; }
  lastPack = built;
  $('saveState').innerHTML = v.ok ? `<span class="lock">Saved "${built.pack.id}" ✓ (schema-valid)</span>` : 'Saved, but INVALID: ' + v.errors.join('; ');
  $('packJson').textContent = JSON.stringify(built.pack, null, 2);
  renderManifest();
  renderRoster();   // flip this unit's card to "supplied ✓"
};

// ── downloads ──
const dl = (name, url) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
$('dlSheet').onclick = () => {
  const built = lastPack && lastPack.pack.id === ($('uid').value || 'unit').trim() ? lastPack : buildPack();
  dl(built.pack.parts[0].atlas, built.atlases.body);
  dl(built.pack.parts[1].atlas, built.atlases.turret);
  dl(`${built.pack.id}.json`, 'data:application/json,' + encodeURIComponent(JSON.stringify(built.pack, null, 2)));
};
$('dlManifest').onclick = () => dl('units.json', 'data:application/json,' + encodeURIComponent(JSON.stringify(loadManifest(), null, 2)));

// ── faction unit set (left panel): ALL factions; a window per unit (empty = "needs art"); add units ──
const FACTIONS = ['Ground / Powder', 'Air', 'High Tech', 'Artillery', 'Water', 'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)', 'System'];
const ROLES = ['Skirmisher', 'Support', 'Bruiser', 'Siege', 'Juggernaut', 'Harasser', 'Striker', 'Guided AA'];
const prefixFor = (name) => (name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'UNI');
let filesIndex = [], curFaction = null, roster = [];
async function initFactions() {
  try { filesIndex = (await (await fetch('../../content/units/index.json')).json()).factions || []; } catch (e) { filesIndex = []; }
  $('faction').innerHTML = FACTIONS.map((f) => `<option>${f}</option>`).join('');
  $('faction').onchange = () => loadFaction($('faction').value);
  loadFaction(FACTIONS[0]);
}
function fileForFaction(name) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, ''), key = norm(name).slice(0, 5);
  return filesIndex.find((f) => norm(f).includes(key));
}
async function loadFaction(name) {
  curFaction = name; roster = [];
  const file = fileForFaction(name);
  if (file) {
    try { const d = await (await fetch('../../content/units/' + file)).json(); const u = d.units || {};
      for (const id of Object.keys(u)) roster.push({ id, role: u[id].role || '', shape: u[id].shape || '' }); } catch (e) { /* fall through to slots */ }
  }
  if (!roster.length) { const p = prefixFor(name); roster = ROLES.map((r, i) => ({ id: `${p}-U${i + 1}`, role: r, shape: r })); }
  renderRoster();
}
function renderRoster() {
  const grid = $('unitGrid'), supplied = (loadManifest().units) || {};
  grid.innerHTML = ''; let n = 0;
  for (const u of roster) {
    const has = !!supplied[u.id]; if (has) n++;
    const card = document.createElement('div'); card.className = 'ucard' + (u.id === $('uid').value ? ' sel' : ''); card.dataset.uid = u.id;
    card.innerHTML = `<canvas width="76" height="56"></canvas><div class="un">${u.id.replace(/^[A-Za-z]+-/, '')}</div><div class="ur">${u.role || '—'}</div><div class="badge ${has ? 'ok' : 'no'}">${has ? '✓ supplied' : 'needs art'}</div>`;
    const g = card.querySelector('canvas').getContext('2d');
    if (has && supplied[u.id].atlases && supplied[u.id].atlases.body) { const im = new Image(); im.onload = () => { g.clearRect(0, 0, 76, 56); g.drawImage(im, 0, 0, 76, 56); }; im.src = supplied[u.id].atlases.body; }
    else { g.fillStyle = '#132234'; g.fillRect(0, 0, 76, 56); g.fillStyle = '#3c5670'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(u.shape || u.role || '?', 38, 32); }
    card.onclick = () => selectUnit(u.id);
    grid.appendChild(card);
  }
  $('setState').innerHTML = `<b>${curFaction}</b> — <span class="lock">${n}/${roster.length}</span> supplied`;
}
$('addUnit').onclick = () => {
  const p = prefixFor(curFaction || 'UNI'), id = (prompt('New unit id:', `${p}-U${roster.length + 1}`) || '').trim();
  if (!id) return;
  if (!roster.some((u) => u.id === id)) roster.push({ id, role: '', shape: '' });
  renderRoster(); selectUnit(id);
};
function selectUnit(id) {
  $('uid').value = id;
  const m = (loadManifest().units) || {};
  if (m[id]) {
    const p = m[id].pack;
    state.cls = p.class; state.foot = p.footprint[0]; state.layers = p.footprint[2];
    if (p.light) { state.lightAz = p.light.azimuth; $('lightAz').value = state.lightAz; $('lightAzV').textContent = state.lightAz + '°'; }
    $('res').value = state.foot; $('layers').value = state.layers; $('layersV').textContent = state.layers;
    [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  }
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  rebuildSlices(); drawLight();
}

syncInputs(); renderManifest(); layout(); update(); updateGamePreview(); initFactions();
window.__sf = { imgs, state, rebuildSlices, setView, toggleFlip, pickFor, buildVolume, keyedCropped, gridStretch, parseVox, voxPart, fitToVox,
  gdbg: () => ({ baked: !!state.baked, gbaked: !!gBodyBaked, gvis: gBodyBaked && gBodyBaked.visible, gkids: gUnit.children.length }) };   // debug/test hook
