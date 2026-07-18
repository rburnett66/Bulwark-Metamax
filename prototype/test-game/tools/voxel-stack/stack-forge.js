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
// screen px per layer at 1 px/voxel: a voxel is a real cube (zScale stretches it) seen at the camera tilt
const layerSp = (elDeg) => state.zScale * Math.cos(clamp(elDeg, 0, 90) * Math.PI / 180);
const WORLD_SCALE = 3, BODY_FRAMES = 16, TURRET_FRAMES = 64, MANIFEST_KEY = 'bulwark:stackforge';
// THE world-scale contract (mirrors src/render/voxel/pack.js): 32 voxels = 1 tile for EVERY unit.
// Bigger unit ⇒ higher Resolution, never a bigger stretch — voxel density is constant on the board.
const VOX_PER_TILE = 32;
const unitTiles = (foot) => foot / VOX_PER_TILE;
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
function keyBackground(data, w, h, tol) {
  tol = tol || 75;                                                   // cutout sensitivity (per-image, tunable)
  const c = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const cs = [c(0, 0), c(w - 1, 0), c(0, h - 1), c(w - 1, h - 1)];
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // background seed = the opaque border colour shared by the most corners (majority vote)
  let seed = null, best = 0;
  for (const q of cs) { if (q[3] < 200) continue; let n = 0; for (const r of cs) if (r[3] > 200 && dist(q, r) < 45) n++; if (n > best) { best = n; seed = q; } }
  if (!seed) return;                                                 // no opaque border colour → leave as-is
  const kr = seed[0], kg = seed[1], kb = seed[2];
  const near = (p) => Math.abs(data[p * 4] - kr) + Math.abs(data[p * 4 + 1] - kg) + Math.abs(data[p * 4 + 2] - kb);
  const N = w * h, vis = new Uint8Array(N), st = [];
  const hard = tol * 0.8, soft = tol * 1.75, span = Math.max(1, soft - hard);   // feather band scales with tol
  const push = (x, y) => { if (x < 0 || x >= w || y < 0 || y >= h) return; const p = y * w + x; if (!vis[p] && near(p) < tol) { vis[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }        // seed the whole border
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }
  for (let p = 0; p < N; p++) {
    if (vis[p]) { data[p * 4 + 3] = 0; continue; }                   // flooded background → transparent
    const d = near(p);                                              // feather AA pixels touching removed bg
    if (d < soft) {
      const x = p % w, y = (p / w) | 0;
      if ((x > 0 && vis[p - 1]) || (x < w - 1 && vis[p + 1]) || (y > 0 && vis[p - w]) || (y < h - 1 && vis[p + w]))
        data[p * 4 + 3] = d < hard ? 0 : Math.min(data[p * 4 + 3], Math.round((d - hard) / span * 255));
    }
  }
}
// raster an image at native size and knock out its background → a canvas with clean alpha. Optional polygon
// shapes ({ pts:[[x,y]…], cut }) then edit the result: KEEP shapes union into the subject (everything outside
// all keeps is removed), CUT shapes punch holes. Keying runs FIRST (the flood needs the real image borders).
function keyedCanvas(img, tol, polys) {
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, cv.width, cv.height); keyBackground(id.data, cv.width, cv.height, tol); g.putImageData(id, 0, 0);
  if (polys && polys.length) {
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
function keyedCropped(img, tol, poly) {
  const k = keyedCanvas(img, tol, poly), d = k.getContext('2d').getImageData(0, 0, k.width, k.height).data;
  let x0 = k.width, y0 = k.height, x1 = -1, y1 = -1;
  for (let yy = 0; yy < k.height; yy++) for (let xx = 0; xx < k.width; xx++) if (d[(yy * k.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
  if (x1 < x0) return k;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(k, x0, y0, cw, ch, 0, 0, cw, ch);
  return cv;
}
// stretch a (keyed, cropped) content canvas to w×h → alpha mask (m) + RGB samples (c) so elevation views
// both CARVE the volume and PAINT the cube walls they depict; `elev` flips rows (z-up).
function gridStretch(canvas, w, h, elev) {
  h = Math.max(1, h);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h), c = new Uint8Array(w * h * 3);
  for (let r = 0; r < h; r++) for (let a = 0; a < w; a++) {
    const row = elev ? (h - 1 - r) : r, i = row * w + a, p = (r * w + a) * 4;
    if (d[p + 3] > 40) { m[i] = 1; c[i * 3] = d[p]; c[i * 3 + 1] = d[p + 1]; c[i * 3 + 2] = d[p + 2]; }
  }
  return { m, c, w, h };
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
// gather a part's filled voxels (palette cleanup applied) as {x,y,z,r,g,b}, offset into place
function collectVox(partId, foot, layers, zOff, xOff) {
  const { filled, vcol, views } = buildModel(partId, foot, layers), N = foot * foot;
  const quant = buildQuantiser(null, vcol, filled, foot, layers, state.paletteN, views), out = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3; let r = vcol[c], g = vcol[c + 1], b = vcol[c + 2];
    if (quant) { const q = quant(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
    const t = palMap.get((r << 16) | (g << 8) | b);                  // colour tune follows .vox + Tier C exports
    if (t) { r = t[0]; g = t[1]; b = t[2]; }
    const X = x + xOff, Z = z + zOff; if (X < 0 || X > 255 || Z < 0 || Z > 255) continue;
    out.push({ x: X, y, z: Z, r, g, b });
  }
  return out;
}
// export the current model (body + turret assembled, or the active part) as a .vox download
function exportVox() {
  const foot = state.foot, mount = clamp(bodyMountZ + state.mountZ, 0, state.bodyLayers);
  let cells = [];
  if (state.part !== 'turret') cells = cells.concat(collectVox('body', foot, state.bodyLayers, 0, 0));
  if (state.part !== 'body') cells = cells.concat(collectVox('turret', foot, state.turretLayers, mount, Math.round(state.turretDx)));
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
function autoSpans(topC, sideC, frontC, foot, layers, reach) {
  let s, bw, bh, ox, oy;
  if (topC) {                                            // footprint from the top (aspect-preserving)
    const availW = Math.max(8, foot - reach);            // leave room up-front for the barrel
    s = Math.min(availW / topC.width, foot / topC.height);
    bw = Math.max(1, Math.round(topC.width * s)); bh = Math.max(1, Math.round(topC.height * s));
    ox = Math.floor((availW - bw) / 2); oy = Math.floor((foot - bh) / 2);   // body sits toward the rear
  } else {                                               // no top: length from side, width from front
    const SL = sideC ? sideC.width : foot, FW = frontC ? frontC.width : Math.round(foot * 0.5);
    s = Math.min(foot / SL, foot / Math.max(1, FW));
    bw = Math.max(1, Math.round(SL * s)); bh = Math.max(1, Math.round(FW * s));
    ox = Math.floor((foot - bw) / 2); oy = Math.floor((foot - bh) / 2);
  }
  // HEIGHT: prefer the side under the top's length scale, so the side keeps its own proportions.
  const Hraw = (topC && sideC) ? sideC.height * (bw / sideC.width)
    : frontC ? frontC.height * (bh / frontC.width)
    : sideC ? sideC.height * (bw / sideC.width)
    : layers * 0.66;
  const Hv = Math.min(layers, Math.max(1, Math.round(Hraw)));
  return { spanX: { lo: ox, hi: ox + bw }, spanY: { lo: oy, hi: oy + bh }, spanZ: { lo: 0, hi: Hv }, Hraw };
}
// the spans the carve uses: auto placement (autoSpans) unless the artist has manually reconciled this
// part in the geometry step, in which case use the saved spans, clamped to the grid (lo<hi, hi≤foot/≤layers).
function geomSpans(partId, topC, sideC, frontC, foot, layers, reach) {
  const g = geomState[partId];
  if (!g || g.auto || !g.spanX) return autoSpans(topC, sideC, frontC, foot, layers, reach);
  const span = (s, cap) => { let lo = Math.max(0, Math.min(cap - 1, s.lo | 0)), hi = Math.max(lo + 1, Math.min(cap, s.hi | 0)); return { lo, hi }; };
  const spanZ = span(g.spanZ, layers);
  return { spanX: span(g.spanX, foot), spanY: span(g.spanY, foot), spanZ, Hraw: spanZ.hi - spanZ.lo };
}
function buildVolume(partId, foot, layers) {
  if (voxPart[partId]) return buildVoxVolume(voxPart[partId], foot, layers);   // imported .vox → use it directly
  const src = imgs[partId], N = foot * foot;
  if (!src.top && !src.side && !src.front && !src.back) {   // ── no art at all → procedural placeholder ──
    const col = document.createElement('canvas'); col.width = col.height = foot;
    const hgt = document.createElement('canvas'); hgt.width = hgt.height = foot;
    const cx = col.getContext('2d', { willReadFrequently: true }), hx = hgt.getContext('2d', { willReadFrequently: true });
    hx.fillStyle = '#000'; hx.fillRect(0, 0, foot, foot);
    (partId === 'turret' ? drawTurret : drawBody)(cx, hx, foot);
    const cd = cx.getImageData(0, 0, foot, foot).data, hd = hx.getImageData(0, 0, foot, foot).data;
    const H = new Float32Array(N);
    for (let i = 0; i < N; i++) H[i] = cd[i * 4 + 3] > 20 ? (hd[i * 4] / 255) * layers : 0;
    return { cd, H, filled: (x, y, z) => z < H[y * foot + x] };
  }
  // crop every view to its content, then register by a COMMON scale taken from the top's fit — so the
  // side's height maps PROPORTIONALLY (a long-barrel side doesn't get stretched vertically to fill layers).
  const tol = keyTolState[partId], pol = polyState[partId];
  const topC = src.top ? keyedCropped(src.top, tol.top, pol.top) : null;
  const sideC = src.side ? keyedCropped(src.side, tol.side, pol.side) : null;
  const frontC = src.front ? keyedCropped(src.front, tol.front, pol.front) : (src.back ? keyedCropped(src.back, tol.back, pol.back) : null);
  const tc = document.createElement('canvas'); tc.width = tc.height = foot; const tx = tc.getContext('2d');
  // procedural barrel reserves a FORWARD margin so the body shrinks back and the tube protrudes past it
  const reach = (partId === 'turret' && state.barrelLen > 0) ? state.barrelLen : 0;
  // GEOMETRY: placement comes from three shared world-axis spans (auto today via autoSpans; the geometry
  // step will override them). Every mask below derives from the spans — z0 lets a silhouette sit off the
  // ground (z0=0 today, so behaviour is unchanged). Reconciliation is implicit: shared axes = shared span.
  const sp = geomSpans(partId, topC, sideC, frontC, foot, layers, reach);
  const ox = sp.spanX.lo, bw = sp.spanX.hi - sp.spanX.lo;
  const oy = sp.spanY.lo, bh = sp.spanY.hi - sp.spanY.lo;
  const z0 = sp.spanZ.lo, Hv = sp.spanZ.hi - sp.spanZ.lo, Hraw = sp.Hraw;
  if (Hraw > layers + 0.5) console.warn(`[stack-forge] ${partId}: normalized height ${Math.round(Hraw)} > Layers ${layers} — the profile is being squashed; raise the ${partId} Layers slider`);
  if (topC) tx.drawImage(topC, ox, oy, bw, bh);                    // footprint + colour from the top
  else { tx.fillStyle = '#9a8c66'; tx.fillRect(ox, oy, bw, bh); }  // no top → plain box from side/front spans
  const cd = tx.getImageData(0, 0, foot, foot).data;
  const top = (x, y) => cd[(y * foot + x) * 4 + 3] > 20;
  const sideG = sideC ? gridStretch(sideC, bw, Hv, true) : null;    // length × height (normalized to the common Hv)
  const frontG = frontC ? gridStretch(frontC, bh, Hv, true) : null; // width × height
  const backC = src.back ? keyedCropped(src.back, tol.back, pol.back) : null; // colour-only: paints the −x walls
  const backG = backC ? gridStretch(backC, bh, Hv, true) : null;
  const side = (x, z) => sideG ? (x >= ox && x < ox + bw && z >= z0 && z < z0 + Hv && !!sideG.m[(z - z0) * bw + (x - ox)]) : (z >= z0 && z < z0 + Hv);
  const width = (y, z) => frontG ? (y >= oy && y < oy + bh && z >= z0 && z < z0 + Hv && !!frontG.m[(z - z0) * bh + (y - oy)]) : (z >= z0 && z < z0 + Hv);
  const flat = !sideG && !frontG;
  const views = (sideG || frontG || backG) ? { side: sideG, front: frontG, back: backG, ox, oy, z0 } : null;
  const bodyFilled = flat ? (x, y, z) => top(x, y) && z >= z0 && z < z0 + Hv : (x, y, z) => top(x, y) && side(x, z) && width(y, z);
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
  return { cd, H, filled, views, sp, dbg: { bw, bh, Hv, Hraw: +Hraw.toFixed(1), tw: topC && topC.width, th: topC && topC.height, sw: sideC && sideC.width, sh: sideC && sideC.height, fw: frontC && frontC.width, fh: frontC && frontC.height } };
}

// Unified voxel model for every consumer: always per-voxel colour (vcol), whether the part came from a
// .vox (already per-voxel) or the photo carve (per-column cd, materialised here). So there's ONE model —
// a stack of coloured cubes — and no cd/vcol branching downstream. Returns { vcol, filled, dbg }.
// per-part manual voxel edits from the grid slice editor: key = z*N + y*foot + x →
//   'del'   the voxel is force-removed (even if the source carved it)
//   [r,g,b] the voxel is force-added/painted with this raw colour
// Applied at the tail of buildModel so the orbit preview, side chart, bake, in-game inset, Tier C
// embed and .vox export all see the same edited model (owner 2026-07-17).
const voxEdit = { body: new Map(), turret: new Map() };
// GEOMETRY reconciliation state (owner 2026-07-18): per-part placement of the source views on the
// target grid, as three shared world-axis spans. `auto:true` = follow autoSpans (legacy); the geometry
// step flips it to false and stores explicit spanX/spanY/spanZ {lo,hi}. `bottomFrom` = where the −z
// underside derives from. Persisted in the project (version 2). Shared axes = shared span object.
const geomState = { body: { auto: true, bottomFrom: 'top' }, turret: { auto: true, bottomFrom: 'top' } };
// the space-carved model BEFORE manual edits (buildVolume is not cached — callers that only need the
// base, like the live slice editor, cache this and layer edits on cheaply).
function buildModelRaw(partId, foot, layers) {
  const v = buildVolume(partId, foot, layers), N = foot * foot;
  if (v.vcol) return { vcol: v.vcol, filled: v.filled, cd: null, views: v.views, sp: v.sp, dbg: v.dbg };  // .vox → already voxels
  const cd = v.cd, filled = v.filled, vcol = new Uint8Array(layers * N * 3);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    const i = y * foot + x, p = i * 4; if (cd[p + 3] < 20) continue;
    const r = cd[p], g = cd[p + 1], b = cd[p + 2];
    for (let z = 0; z < layers; z++) if (filled(x, y, z)) { const c = (z * N + i) * 3; vcol[c] = r; vcol[c + 1] = g; vcol[c + 2] = b; }
  }
  return { vcol, filled, cd: null, views: v.views, sp: v.sp, dbg: v.dbg };
}
// layer the voxEdit overlay onto a raw model (clone vcol so buildVolume's arrays are never mutated).
function applyVoxEdits(m, partId, foot, layers) {
  const ed = voxEdit[partId]; if (!ed || !ed.size) return m;
  const N = foot * foot, vc = m.vcol.slice();
  for (const [k, val] of ed) if (val !== 'del') { const c = k * 3; vc[c] = val[0]; vc[c + 1] = val[1]; vc[c + 2] = val[2]; }
  const base = m.filled;
  const editedFilled = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= foot || y >= foot || z >= layers) return false;
    const e = ed.get(z * N + y * foot + x);
    return e !== undefined ? e !== 'del' : base(x, y, z);
  };
  return { vcol: vc, filled: editedFilled, cd: null, views: m.views, dbg: m.dbg };
}
function buildModel(partId, foot, layers) { return applyVoxEdits(buildModelRaw(partId, foot, layers), partId, foot, layers); }

// median-cut → n representative colours. Flattens camo/gradients (and rich .vox palettes) into a small,
// contrasting set of flat cube colours so the block structure reads clean instead of noisy.
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
// ── HUE-FAMILY PALETTE REDUCER (owner 2026-07-17) ─────────────────────────────────────────────────
// Plain median-cut is population-blind: a hull that is mostly grey/brown has a huge low-hue mass, so
// every split lands back in it and sparse accents (a washed-out blue window, a gold stripe) get
// averaged away — "reduce and you get nothing but grey/brown." Instead we bucket EVERY colour by hue
// (only near-perfect grey goes to one neutral bucket), guarantee each hue family present at least one
// palette slot, then split the remaining budget across families by population. A lone washed accent
// can never be out-voted by the grey/brown mass. Pinned colours are always kept on top of that.
const chromaOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
function weightedMedianCut(entries, n) {
  if (!entries.length || n <= 0) return [];
  let boxes = [entries.slice()];
  const rangeOf = (b) => { let mn = [255, 255, 255], mx = [0, 0, 0]; for (const e of b) for (let ch = 0; ch < 3; ch++) { const v = e.rgb[ch]; if (v < mn[ch]) mn[ch] = v; if (v > mx[ch]) mx[ch] = v; } return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; };
  while (boxes.length < n) {
    let bi = -1, best = -1;
    for (let i = 0; i < boxes.length; i++) { if (boxes[i].length < 2) continue; const rg = rangeOf(boxes[i]); const m = Math.max(rg[0], rg[1], rg[2]); if (m > best) { best = m; bi = i; } }
    if (bi < 0) break;
    const box = boxes[bi], rg = rangeOf(box), ch = rg[1] > rg[0] ? (rg[2] > rg[1] ? 2 : 1) : (rg[2] > rg[0] ? 2 : 0);
    box.sort((a, b) => a.rgb[ch] - b.rgb[ch]);
    const total = box.reduce((s, e) => s + e.c, 0); let acc = 0, mid = 1;
    for (let i = 0; i < box.length; i++) { acc += box[i].c; if (acc >= total / 2) { mid = Math.max(1, Math.min(box.length - 1, i + 1)); break; } }
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((b) => { let r = 0, g = 0, bl = 0, w = 0; for (const e of b) { r += e.rgb[0] * e.c; g += e.rgb[1] * e.c; bl += e.rgb[2] * e.c; w += e.c; } w = w || 1; return [Math.round(r / w), Math.round(g / w), Math.round(bl / w)]; });
}
function buildPalette(counts, n, pins, drops) {
  const nearAny = (rgb, list, d2) => (list || []).some((p) => (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2 < d2);
  const NEUTRAL_CH = 16;                                             // only near-perfect grey is "neutral"
  const bucketOf = (rgb) => chromaOf(...rgb) < NEUTRAL_CH ? 'n' : 'h' + (Math.round(rgb2hsv(...rgb)[0] / 15) % 24);
  let entries = [...counts.entries()].map(([k, c]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], c }));
  // ELIMINATE: a dropped colour removes its WHOLE hue family (e.g. eliminate one grey → all greys go);
  // those voxels remap to the nearest surviving colour in the quantiser. (Guard: never drop everything.)
  if (drops && drops.length) {
    const dropB = new Set(drops.map(bucketOf));
    const kept = entries.filter((e) => !dropB.has(bucketOf(e.rgb)));
    if (kept.length) entries = kept;
  }
  const seeds = (pins || []).map((p) => p.slice());
  if (entries.length + seeds.length <= n) {                          // budget covers every survivor → keep them all
    for (const e of entries) if (!nearAny(e.rgb, seeds, 1)) seeds.push(e.rgb);
    return seeds.slice(0, n);
  }
  let budget = n - seeds.length;
  if (budget <= 0) return seeds.slice(0, n);
  const fams = new Map();                                            // hue bucket (or 'n' = grey) → members + population
  for (const e of entries) {
    const key = chromaOf(...e.rgb) < NEUTRAL_CH ? 'n' : 'h' + (Math.round(rgb2hsv(...e.rgb)[0] / 15) % 24);
    let f = fams.get(key); if (!f) { f = { items: [], pop: 0 }; fams.set(key, f); }
    f.items.push(e); f.pop += e.c;
  }
  const fl = [...fams.values()], order = fl.map((_, i) => i).sort((a, b) => fl[b].pop - fl[a].pop);
  const alloc = fl.map(() => 0);
  let left = budget;
  for (const i of order) { if (left <= 0) break; alloc[i] = 1; left--; }         // 1 slot per family (biggest pop first)
  const active = order.filter((i) => alloc[i] > 0), totalPop = active.reduce((s, i) => s + fl[i].pop, 0) || 1;
  const rema = active.map((i) => ({ i, w: fl[i].pop / totalPop * left })); let used = 0;
  for (const r of rema) { const add = Math.floor(r.w); alloc[r.i] += add; used += add; }   // proportional to population
  rema.sort((a, b) => (b.w % 1) - (a.w % 1));
  for (let k = 0; k < left - used && k < rema.length; k++) alloc[rema[k].i]++;   // largest-remainder for the leftovers
  for (let i = 0; i < fl.length; i++) if (alloc[i] > 0) for (const c of weightedMedianCut(fl[i].items, alloc[i])) seeds.push(c);
  return seeds.slice(0, n);
}
// build a colour→palette quantiser over a part's filled voxels (null when Palette is off / full colour)
// `views` (side/front/back source art) is folded in so colours that only appear on a WALL — a blue
// window, a gold stripe painted only in the side sheet — are palette candidates too, instead of being
// quantised away against a top-only palette. buildFaces and the grid pass the same views → they agree.
function buildQuantiser(cd, vcol, filled, foot, layers, n, views) {
  if (!n) return null;
  const N = foot * foot, counts = new Map();
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    let r, g, b; if (vcol) { const c = (z * N + y * foot + x) * 3; r = vcol[c]; g = vcol[c + 1]; b = vcol[c + 2]; } else { const p = (y * foot + x) * 4; r = cd[p]; g = cd[p + 1]; b = cd[p + 2]; }
    const key = (r << 16) | (g << 8) | b; counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (views) for (const g of [views.side, views.front, views.back]) if (g && g.m) {
    for (let i = 0; i < g.w * g.h; i++) if (g.m[i]) { const key = (g.c[i * 3] << 16) | (g.c[i * 3 + 1] << 8) | g.c[i * 3 + 2]; counts.set(key, (counts.get(key) || 0) + 1); }
  }
  const kRGB = (k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
  const pal = buildPalette(counts, n, [...palKeep].map(kRGB), [...palDrop].map(kRGB)), cache = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b; let v = cache.get(key); if (v !== undefined) return v;
    let bi = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b); if (d < bd) { bd = d; bi = i; } }
    v = pal[bi]; cache.set(key, v); return v;
  };
}

// ── CUBE STACK: the unified voxel model reduced to its EXPOSED cube faces — the only thing the renderer
// draws. Palette cleanup is baked into the face colour; LIGHTING IS NOT — it's applied per-frame from the
// rotated face normal, so the world light stays fixed while the object turns under it.
// n: 0 = top, 1 = +x, 2 = −x, 3 = +y, 4 = −y (grid space, y = image-down).
function buildFaces(partId, foot, layers) {
  const { filled, vcol, views: V } = buildModel(partId, foot, layers), N = foot * foot; // unified voxel model
  const quant = buildQuantiser(null, vcol, filled, foot, layers, state.paletteN, V);   // palette cleanup (incl. wall art)
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
    if (n >= 3) return pick(V.side, x - V.ox, zz, n === 4);
    if (n === 2 && V.back) return pick(V.back, y - V.oy, zz, false);
    return pick(V.front, y - V.oy, zz, n === 2);
  };
  const faces = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3;
    const add = (n) => {
      const w = n === 0 ? null : wallCol(x, y, z, n);
      let r = w ? w[0] : vcol[c], g = w ? w[1] : vcol[c + 1], b = w ? w[2] : vcol[c + 2];
      if (quant) { const q = quant(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
      const k = (r << 16) | (g << 8) | b, t = palMap.get(k);          // artist colour tune (palette tuner)
      if (t) { r = t[0]; g = t[1]; b = t[2]; }
      faces.push({ x, y, z, n, r, g, b, k, d: 0 });                   // k = pre-tune key, the tuner's handle
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
function renderParts(ctx, S, cx, groundY, el, parts) {
  const eR = el * Math.PI / 180, se = Math.sin(eR), ce = Math.cos(eR), h = state.zScale;
  const la = state.lightAz * Math.PI / 180, Lx = Math.cos(la), Ly = -Math.sin(la);
  const k = clamp(state.lightK / 100, 0, 1), WALL = 0.52, RANGE = 0.46;
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
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

// assemble the current unit (body + mounted turret, honouring the part filter) and render it into a canvas
function drawScene(meta, el, bodyAz, turretAz) {
  const ctx = meta.ctx; ctx.clearRect(0, 0, meta.W, meta.Hp);
  const mountDz = clamp(bodyMountZ + state.mountZ, 0, state.bodyLayers);
  const parts = [];
  if (state.part !== 'turret') parts.push({ faces: bodyFaces, az: bodyAz });
  if (state.part !== 'body') parts.push({ faces: turretFaces, az: turretAz, zOff: mountDz,
    gx: state.turretDx * Math.cos(bodyAz), gy: state.turretDx * Math.sin(bodyAz),
    pivotFrac: 0.5 + state.turretPivot / 100 });
  renderParts(ctx, meta.S, meta.cx, meta.groundY, el, parts);
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
function bakeAngleCache(renderer, faces, opts) {
  const { frames, smooth, sharp, g, pivotFrac = 0.5, el, scale = 1 } = opts, SS = smooth ? 2 : 1, STEP = (Math.PI * 2) / frames;
  const W = g.RTW * scale, H = g.RTH * scale;                      // scale = baked px per voxel (crispness)
  const cv = document.createElement('canvas'); cv.width = W * SS; cv.height = H * SS;
  const ctx = cv.getContext('2d'); ctx.lineWidth = 0.75 * SS; ctx.lineJoin = 'round';
  const tex = PIXI.Texture.from(cv); tex.baseTexture.scaleMode = smooth ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;
  const spr = new PIXI.Sprite(tex); spr.scale.set(1 / SS);
  if (smooth && sharp > 0) spr.filters = [new PIXI.Filter(undefined, SHARPEN_FRAG, { uSharp: sharp, uTexel: [1 / W, 1 / H] })];
  const cache = [];
  for (let a = 0; a < frames; a++) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    renderParts(ctx, scale * SS, g.CX * scale * SS, g.BASEY * scale * SS, el, [{ faces, az: a * STEP, pivotFrac }]);   // true 3D frame
    tex.baseTexture.update();
    const rt = PIXI.RenderTexture.create({ width: W, height: H });
    rt.baseTexture.scaleMode = smooth ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;
    renderer.render(spr, { renderTexture: rt });
    cache.push(rt);
  }
  spr.destroy(); tex.destroy(true);
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
let SCW = 720, SCH = 560, MODEL_CX = 470;
function layout() {
  SCW = app.screen.width; SCH = app.screen.height;
  MODEL_CX = Math.min(SCW / 2 + 120, SCW - 160);   // shift right so the floating orbit panel doesn't cover the model
  rig.position.set(MODEL_CX, SCH * 0.56);
  if (typeof placeGamePreview === 'function') placeGamePreview();
  drawLight();
}
app.renderer.on('resize', layout);

// light-source indicator — a sun on a ring at the light azimuth, in SCREEN space (on top of the
// model), showing where the game-aligned light comes from. Elevation shrinks the ring (more overhead).
const lightGfx = new PIXI.Graphics(); app.stage.addChild(lightGfx);
function drawLight() {
  const cx = MODEL_CX, cy = SCH * 0.44, R = 150 + (1 - 0.6) * 90;   // ~overhead-ish ring, centred on the model
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
  const mountDz = clamp(bodyMountZ + state.mountZ, 0, state.bodyLayers);
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
// per-slot flip: keep the raw source + H/V flags so flips compose from the original (no quality drift)
const mkViews = (v) => ({ top: v(), side: v(), front: v(), back: v() });
const srcImg = { body: mkViews(() => null), turret: mkViews(() => null) };
const flipState = { body: mkViews(() => ({ h: false, v: false })), turret: mkViews(() => ({ h: false, v: false })) };
const rotState = { body: mkViews(() => 0), turret: mkViews(() => 0) };        // per-image rotation (0/90/180/270 CW)
const keyTolState = { body: mkViews(() => 75), turret: mkViews(() => 75) };   // per-image cutout sensitivity
const polyState = { body: mkViews(() => null), turret: mkViews(() => null) }; // per-image polygon cutout ([x,y] px)
const imgURLCache = { body: mkViews(() => null), turret: mkViews(() => null) }; // PNG data-URL cache (project saves)
const voxB64 = { body: null, turret: null };                                  // base64 cache of imported .vox data
const palMap = new Map();                    // palette tuner: pre-tune colour key → replacement [r,g,b]
const palKeep = new Set();                   // palette reducer: colour keys the artist pinned to survive reduction
const palDrop = new Set();                    // palette reducer: colour keys the artist marked to eliminate (remap away)
let bulkLoad = false;                                                         // true while restoring a project
// the STABLE key the WIP autosaves under — set only by an explicit load/save/new, NOT by the free-text
// Unit-id box. This keeps a stray edit to that box from misfiling the unit you're actually editing.
let activeUnitId = 'unit';
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
const state = { foot: 64, bodyLayers: 16, turretLayers: 12, az: 0, el: 30, taim: 0, turretDx: 0, turretPivot: 0, mountZ: 0, spin: false, part: 'both',
  barrelLen: 0, barrelRad: 4, barrelElev: 55, paletteN: 0, lightAz: 135, lightK: 55, zScale: 1.8, zoom: WORLD_SCALE, smooth: true, sharp: 0.6, bakeScale: 2, cls: 'ground', baseY: 24, baked: null };
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

// highest filled layer of the BODY (+1) → the layer the turret should sit ON, not inside
function bodyTopLayer(foot, layers) {
  const { filled } = buildVolume('body', foot, layers);
  for (let z = layers - 1; z >= 0; z--) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) if (filled(x, y, z)) return z + 1;
  return 0;
}

// (re)build the voxel models + the cube-render canvases — the orbit/camera-set preview and the inset
// ── Orthographic grid view (upper-left): a flat, square-voxel view of one face. Top walks z-slices
// top→bottom (the slice view); Side/Front/Back are silhouettes. Voxels are always square (true cubes),
// independent of the zScale cube-height stretch used by the 3D render.
let gridView = 'top', gridLayer = 0, gridModel = null;   // gridModel: cached buildModel, invalidated by rebuildSlices
let gridTool = 'erase', gridGeom = null;                 // gridGeom: last-drawn cell layout, so pointer edits map back to voxels
let gridMode = 'paint';                                  // 'paint' = per-voxel slice editing · 'geom' = reconcile view spans
// geometry box axis mapping: for each grid view, which world-axis span each in-plane axis (col,row) reads
// and whether the grid coord is reversed vs the axis value. cap: x/y=foot, z=layers. Used by both the
// geom overlay draw and the drag editing so they stay in lock-step.
const GEOAX = {
  top:   { col: { axis: 'x', flip: false }, row: { axis: 'y', flip: false } },
  side:  { col: { axis: 'x', flip: false }, row: { axis: 'z', flip: true } },
  front: { col: { axis: 'y', flip: false }, row: { axis: 'z', flip: true } },
  back:  { col: { axis: 'y', flip: true },  row: { axis: 'z', flip: true } },
};
const spanKey = { x: 'spanX', y: 'spanY', z: 'spanZ' };
const gridPart = () => (state.part === 'turret' ? 'turret' : 'body');
const gridLayersOf = (part) => (part === 'turret' ? state.turretLayers : state.bodyLayers);
function renderGridView() {
  const cv = $('gridCanvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const part = gridPart(), foot = state.foot, layers = gridLayersOf(part), N = foot * foot;
  // cache the RAW (pre-edit) carve; voxEdit is layered on cheaply below so live painting never re-carves.
  if (!gridModel || gridModel.part !== part || gridModel.foot !== foot || gridModel.layers !== layers) {
    const m = buildModelRaw(part, foot, layers);
    gridModel = { part, foot, layers, vcol: m.vcol, filled: m.filled, views: m.views, sp: m.sp };
  }
  const base = gridModel, ed = voxEdit[part], V = base.views;
  const filled = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= foot || y >= foot || z >= layers) return false;
    const e = ed.get(z * N + y * foot + x);
    return e !== undefined ? e !== 'del' : base.filled(x, y, z);
  };
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
    const e = ed.get(z * N + y * foot + x); if (Array.isArray(e)) return e;
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
    front: { cols: foot, rows: layers, depth: foot,   axis: 'x', toVox: (c, r, s) => [s, c, layers - 1 - r] },
    back:  { cols: foot, rows: layers, depth: foot,   axis: 'x', toVox: (c, r, s) => [foot - 1 - s, foot - 1 - c, layers - 1 - r] },
  };
  const ax = AX[gridView] || AX.top, cols = ax.cols, rows = ax.rows, depth = ax.depth;
  gridLayer = clamp(gridLayer, 0, Math.max(0, depth - 1));
  const slice = gridLayer;
  const geomMode = gridMode === 'geom';
  const lr = $('gridLayerRow'); if (lr) lr.style.display = '';    // layer slider useful in both modes
  const tr = $('gridToolRow'); if (tr) tr.style.display = geomMode ? 'none' : '';   // paint tools hidden in Geometry
  const gr2 = $('gridGeoRow'); if (gr2) gr2.style.display = geomMode ? '' : 'none'; // geometry controls shown in Geometry
  const ls = $('gridLayer'); if (ls) ls.max = String(Math.max(0, depth - 1));
  const lv = $('gridLayerV'); if (lv) lv.textContent = `${ax.axis} ${slice}` + (gridView === 'top' && slice === 0 ? ' top' : '');

  // palette-correct colour: exactly what the 3D render bakes — raw voxel → paletteN reduction → tuner.
  // quant reads an overlay-aware colour buffer so painted voxels join the palette (cheap copy, no re-carve).
  let qvcol = base.vcol;
  if (ed.size) { qvcol = base.vcol.slice(); for (const [k, val] of ed) if (val !== 'del') { const c = k * 3; qvcol[c] = val[0]; qvcol[c + 1] = val[1]; qvcol[c + 2] = val[2]; } }
  const quant = buildQuantiser(null, qvcol, filled, foot, layers, state.paletteN, V);
  const colAt = (x, y, z) => {
    let [r, g, b] = rawCol(x, y, z);
    if (quant) { const q = quant(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
    const t = palMap.get((r << 16) | (g << 8) | b); return t || [r, g, b];
  };
  const cellAt = (cx, cy) => { const [x, y, z] = ax.toVox(cx, cy, slice); return filled(x, y, z) ? colAt(x, y, z) : null; };
  const anyDepth = (cx, cy) => { for (let s = 0; s < depth; s++) { const [x, y, z] = ax.toVox(cx, cy, s); if (filled(x, y, z)) return true; } return false; };

  const W = cv.width, H = cv.height, cell = Math.max(1, Math.floor(Math.min(W / cols, H / rows)));
  const gw = cell * cols, gh = cell * rows, ox = Math.floor((W - gw) / 2), oy = Math.floor((H - gh) / 2);
  const geomActive = gridMode === 'geom' && V && base.sp && GEOAX[gridView];  // reconcile overlay (image-carved only)
  gridGeom = { cell, ox, oy, cols, rows, depth, slice, toVox: ax.toVox, foot, layers, part, editable: !geomActive };
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a121c'; ctx.fillRect(0, 0, W, H);
  // faint checker so the empty grid still reads as a grid at any zoom
  if (cell >= 4) { ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if ((cx + cy) & 1) ctx.fillRect(ox + cx * cell, oy + cy * cell, cell, cell); }
  // faint silhouette of the WHOLE model (all depths) so the active slice reads in context
  ctx.fillStyle = 'rgba(150,185,220,.13)';
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (anyDepth(cx, cy)) ctx.fillRect(ox + cx * cell, oy + cy * cell, cell, cell);
  // the ACTIVE slice — palette-correct in Paint mode, flat grey in Geometry mode (shape, not colour)
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const col = cellAt(cx, cy); if (!col) continue;
    ctx.fillStyle = geomActive ? '#68788a' : `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect(ox + cx * cell, oy + cy * cell, cell, cell);
  }
  // a REAL grid: cell lines across the WHOLE area (occupied + empty) + a crisp outer frame
  if (cell >= 3) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let cx = 0; cx <= cols; cx++) { ctx.moveTo(ox + cx * cell + .5, oy); ctx.lineTo(ox + cx * cell + .5, oy + gh); }
    for (let cy = 0; cy <= rows; cy++) { ctx.moveTo(ox, oy + cy * cell + .5); ctx.lineTo(ox + gw, oy + cy * cell + .5); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,160,200,.55)'; ctx.lineWidth = 1; ctx.strokeRect(ox + .5, oy + .5, gw - 1, gh - 1);

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
    const bx = ox + cR.lo * cell, by = oy + rR.lo * cell, bw2 = (cR.hi - cR.lo) * cell, bh2 = (rR.hi - rR.lo) * cell;
    const keyed = imgs[part][gridView] ? keyedCropped(imgs[part][gridView], keyTolState[part][gridView], polyState[part][gridView]) : null;
    if (keyed) { ctx.globalAlpha = 0.42; ctx.imageSmoothingEnabled = false; ctx.drawImage(keyed, bx, by, bw2, bh2); ctx.globalAlpha = 1; }
    ctx.strokeStyle = '#48d0e0'; ctx.lineWidth = 2; ctx.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, bh2 - 1);
    ctx.fillStyle = '#48d0e0';                                       // edge-midpoint handles
    for (const [hx, hy] of [[bx + bw2 / 2, by], [bx + bw2 / 2, by + bh2], [bx, by + bh2 / 2], [bx + bw2, by + bh2 / 2]]) ctx.fillRect(hx - 4, hy - 4, 8, 8);
    gridGeom.geom = { bx, by, bw: bw2, bh: bh2, cell, ox, oy, gw, gh, col: g.col, row: g.row, foot, layers };
    const sx = bsp[spanKey[g.col.axis]], sy = bsp[spanKey[g.row.axis]];
    ctx.fillStyle = '#8fa7bd'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(`${g.col.axis.toUpperCase()} ${sx.lo}–${sx.hi} · ${g.row.axis.toUpperCase()} ${sy.lo}–${sy.hi}${geomState[part].auto ? '  (auto)' : ''}`, ox + 3, oy + 3);
  } else if (!isTop && cell >= 2) {
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
    else { const sx = gridView === 'back' ? (foot - 1 - slice) : slice, xx = mmx + sx * mc + mc / 2; ctx.moveTo(xx, mmy); ctx.lineTo(xx, mmy + mw); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,160,200,.6)'; ctx.lineWidth = 1; ctx.strokeRect(mmx + .5, mmy + .5, mw - 1, mw - 1);
    ctx.fillStyle = '#8fa7bd'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText('top ref', mmx, mmy - 4);
  }
}

function rebuildSlices() {
  if (bodyBaked) { bodyBaked.destroy(); bodyBaked = null; } if (turretBaked) { turretBaked.destroy(); turretBaked = null; }
  if (gBodyBaked) { gBodyBaked.destroy(); gBodyBaked = null; } if (gTurretBaked) { gTurretBaked.destroy(); gTurretBaked = null; }
  state.baked = null; voxSig = ''; $('saveUnit').disabled = true; $('dlSheet').disabled = true;
  bodyMountZ = bodyTopLayer(state.foot, state.bodyLayers);   // turret mounts on the body's actual top
  bodyFaces = buildFaces('body', state.foot, state.bodyLayers);
  turretFaces = buildFaces('turret', state.foot, state.turretLayers);
  // canvases sized to the worst case at any azimuth: footprint diagonal + offsets + the full stack height
  const foot = state.foot, h = state.zScale;
  voxBounds = { R: Math.ceil(foot * 0.71 + Math.abs(state.turretDx) + foot * Math.abs(state.turretPivot) / 100) + 2,
    HT: Math.ceil((state.bodyLayers + state.turretLayers + 4) * h) };
  buildOrbitTarget(orbitS());
  if (gVoxSpr) { gVoxSpr.destroy(); gVoxShadow.destroy(); gVoxTex.destroy(true); }
  gVoxMeta = mkTarget(INSET_S, voxBounds.R, voxBounds.HT);
  gVoxTex = PIXI.Texture.from(gVoxMeta.cv);
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
rebuildSlices();

function update() {
  const sp = layerSp(state.el), se = Math.sin(state.el * Math.PI / 180);
  const azR = state.az * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = clamp(bodyMountZ + state.mountZ, 0, state.bodyLayers);
  const ox = state.turretDx * Math.cos(azR), oy = state.turretDx * Math.sin(azR) * se;   // mount offset, foreshortened
  if (state.baked) {
    voxSpr.visible = false; voxShadow.visible = false;
    const bb = bucketOf(azR, state.baked.bodyFrames), tb = bucketOf(azR + taimR, state.baked.turretFrames);
    bodyBaked.texture = state.baked.body[bb]; bodyBaked.visible = showB; bodyBaked.position.set(0, state.baseY);
    turretBaked.texture = state.baked.turret[tb]; turretBaked.visible = showT;
    turretBaked.position.set(ox, state.baseY - mountDz * sp + oy);
    return;
  }
  voxSpr.visible = true; voxShadow.visible = true;
  // only re-render the cube scene when something it depends on actually changed
  const sig = state.az.toFixed(1) + '|' + state.el.toFixed(1) + '|' + state.taim.toFixed(1) + '|' + state.turretDx + '|' +
    state.turretPivot + '|' + state.mountZ + '|' + state.part + '|' + state.lightAz + '|' + state.lightK + '|' + state.zScale;
  if (sig !== voxSig) { voxSig = sig; drawScene(voxMeta, state.el, azR, azR + taimR); voxTex.baseTexture.update(); }
}
// position the in-game preview: unit at GAME scale on the tile, slowly turning to show facings, with the
// game shadow. Uses the same elevation as the bake camera so the preview matches what you'll ship.
let gPrevAz = 0;
function updateGamePreview() {
  if (gSpin && !gDragPrev) gPrevAz = (gPrevAz + 0.4) % 360;
  const azR = gPrevAz * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const spG = layerSp(state.el), se = Math.sin(state.el * Math.PI / 180);
  const uScale = (GAME_TILE * 1.7) / state.foot;                      // footprint ≈ 1.7 tiles
  gUnit.scale.set(uScale); gUnit.position.set(gAnchor.x, gAnchor.y + GAME_TILE * 0.12);
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = clamp(bodyMountZ + state.mountZ, 0, state.bodyLayers);
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
let drag = null;
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
  drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el };
});
window.addEventListener('pointerup', () => { drag = null; gDragPrev = null; gResize = null; });
window.addEventListener('pointermove', (e) => {
  if (gResize) { resizePreview(gResize.w - (e.clientX - gResize.x), gResize.h + (e.clientY - gResize.y)); return; }
  if (gDragPrev) { gPrevAz = ((gDragPrev.az + (e.clientX - gDragPrev.x) * 0.6) % 360 + 360) % 360; return; }
  if (drag) {
    state.az = ((drag.az + (e.clientX - drag.x) * 0.6) % 360 + 360) % 360;
    state.el = clamp(drag.el - (e.clientY - drag.y) * 0.35, 0, 90); syncInputs(); return;
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
$('az').oninput = (e) => { state.az = +e.target.value; $('azV').textContent = state.az + '°'; };
$('el').oninput = (e) => { state.el = +e.target.value; $('elV').textContent = state.el + '°'; };
$('taim').oninput = (e) => { state.taim = +e.target.value; $('taimV').textContent = state.taim + '°'; };
$('tdx').oninput = (e) => { state.turretDx = +e.target.value; $('tdxV').textContent = state.turretDx; };
$('tmz').oninput = (e) => { state.mountZ = +e.target.value; $('tmzV').textContent = (state.mountZ > 0 ? '+' : '') + state.mountZ; };
$('viewSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.az = +b.dataset.az; state.el = +b.dataset.el; syncInputs(); };
$('tpiv').oninput = (e) => { state.turretPivot = +e.target.value; $('tpivV').textContent = state.turretPivot; };
$('blen').oninput = (e) => { state.barrelLen = +e.target.value; $('blenV').textContent = state.barrelLen || 'off'; rebuildSlices(); };
$('brad').oninput = (e) => { state.barrelRad = +e.target.value; $('bradV').textContent = state.barrelRad; rebuildSlices(); };
$('belev').oninput = (e) => { state.barrelElev = +e.target.value; $('belevV').textContent = state.barrelElev; rebuildSlices(); };
$('spin').onchange = (e) => { state.spin = e.target.checked; };
$('bodyLayers').oninput = (e) => { state.bodyLayers = +e.target.value; $('bodyLayersV').textContent = state.bodyLayers; rebuildSlices(); };
$('turretLayers').oninput = (e) => { state.turretLayers = +e.target.value; $('turretLayersV').textContent = state.turretLayers; rebuildSlices(); };
$('res').onchange = (e) => { state.foot = +e.target.value; syncSizeUI(); rebuildSlices(); };
// fine world-size control (the VOX_PER_TILE contract): tiles → foot voxels, layers scale along
function syncSizeUI() {
  const t = unitTiles(state.foot);
  $('uSize').value = Math.round(t * 100); $('uSizeV').textContent = t.toFixed(2) + ' t';
  $('res').value = [32, 48, 64, 96, 128].includes(state.foot) ? state.foot : '';
}
function setUnitSize(tiles) {
  const newFoot = clamp(Math.round(tiles * VOX_PER_TILE), 16, 256);
  if (newFoot === state.foot) return;
  const k = newFoot / state.foot;
  state.foot = newFoot;
  setLayers('body', clamp(Math.round(state.bodyLayers * k), 4, 40));      // keep the proportions
  setLayers('turret', clamp(Math.round(state.turretLayers * k), 3, 40));
  syncSizeUI(); rebuildSlices();
}
$('uSize').oninput = (e) => { $('uSizeV').textContent = (+e.target.value / 100).toFixed(2) + ' t'; };
$('uSize').onchange = (e) => setUnitSize(+e.target.value / 100);          // re-carve on release
// ── .vox import: bring a ready-made voxel model in as the base/turret (skips the carve) ──
const setLayers = (which, v) => { const id = which === 'body' ? 'bodyLayers' : 'turretLayers'; state[id] = v; $(id).value = v; $(id + 'V').textContent = v; };
function fitToVox() {
  let mx = 0;
  for (const kk of ['body', 'turret']) { const v = voxPart[kk]; if (v) mx = Math.max(mx, v.nx, v.ny); }
  if (!mx) return;
  const res = [32, 48, 64, 96, 128]; state.foot = res.find((r) => r >= mx) || 128; $('res').value = state.foot;
  if (voxPart.body) setLayers('body', clamp(voxPart.body.nz, 4, 40));
  if (voxPart.turret) setLayers('turret', clamp(voxPart.turret.nz, 4, 40));
}
function importVox(part, file) {
  const rd = new FileReader();
  rd.onload = () => {
    try { const m = parseVox(rd.result); voxPart[part] = m; voxB64[part] = null; fitToVox(); rebuildSlices();
      $('voxState').innerHTML = `<span class="lock">✓ ${part}: ${m.nx}×${m.ny}×${m.nz} voxels — foot ${state.foot}, ${part} layers ${part === 'body' ? state.bodyLayers : state.turretLayers}</span>`;
    } catch (e) { alert('Could not read that .vox — ' + e.message); }
  };
  rd.readAsArrayBuffer(file);
}
$('voxBody').onchange = (e) => e.target.files[0] && importVox('body', e.target.files[0]);
$('voxTurret').onchange = (e) => e.target.files[0] && importVox('turret', e.target.files[0]);
$('voxClear').onclick = () => { voxPart.body = null; voxPart.turret = null; voxB64.body = null; voxB64.turret = null; rebuildSlices(); $('voxState').textContent = 'Cleared — back to the photo carve.'; };
$('exportVox').onclick = exportVox;
$('lightAz').oninput = (e) => { state.lightAz = +e.target.value; $('lightAzV').textContent = state.lightAz + '°'; rebuildSlices(); drawLight(); };
$('lightK').oninput = (e) => { state.lightK = +e.target.value; $('lightKV').textContent = state.lightK; rebuildSlices(); };
// #pal handler is defined with #palN below (setPaletteN keeps both sliders in lock-step)
$('zScale').oninput = (e) => { state.zScale = +e.target.value / 100; $('zScaleV').textContent = state.zScale.toFixed(2) + '×'; rebuildSlices(); };
$('smooth').onchange = (e) => { state.smooth = e.target.checked; };
$('sharp').oninput = (e) => { state.sharp = +e.target.value / 100; $('sharpV').textContent = state.sharp.toFixed(2); };
$('bakeScale').oninput = (e) => { state.bakeScale = +e.target.value; $('bakeScaleV').textContent = state.bakeScale + '×'; };
$('partSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.part = b.dataset.p; [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b)); renderGridView(); };

// ── grid-view panel: mode (paint vs geometry) + face selector + z-slice walker ──
if ($('gridModeSeg')) $('gridModeSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; gridMode = b.dataset.m; [...$('gridModeSeg').children].forEach((c) => c.classList.toggle('on', c === b)); renderGridView(); };
if ($('gridResetGeo')) $('gridResetGeo').onclick = () => { const part = gridPart(); geomState[part] = { auto: true, bottomFrom: geomState[part].bottomFrom || 'top' }; gridModel = null; rebuildSlices(); scheduleAutosave(); };
$('gridViewSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; gridView = b.dataset.v; gridLayer = 0; [...$('gridViewSeg').children].forEach((c) => c.classList.toggle('on', c === b)); renderGridView(); };
$('gridLayer').oninput = (e) => { gridLayer = +e.target.value; renderGridView(); };
// ── SLICE EDITOR (owner 2026-07-17): on the Top view, click/drag to add or erase voxels in the
// current z-layer. Erase removes even source-carved voxels; paint adds using that column's own
// colour (grey for a fresh column — recolour later in the palette window). Edits land in voxEdit and
// flow through buildModel, so the orbit preview, side chart, bake and exports all follow. Full model
// rebuild is deferred to pointer-up so painting stays responsive; the grid itself repaints live.
if ($('gridToolSeg')) $('gridToolSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; gridTool = b.dataset.t; [...$('gridToolSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };
if ($('gridClearLayer')) $('gridClearLayer').onclick = () => {
  const g = gridGeom; if (!g) return; const ed = voxEdit[g.part], N = g.foot * g.foot;
  for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) { const [x, y, z] = g.toVox(cx, cy, g.slice); ed.set(z * N + y * g.foot + x, 'del'); }
  gridModel = null; renderGridView(); rebuildSlices(); scheduleAutosave();
};
if ($('gridResetEdits')) $('gridResetEdits').onclick = () => {
  voxEdit.body.clear(); voxEdit.turret.clear(); gridModel = null; rebuildSlices(); scheduleAutosave();
};
(() => {
  const cv = $('gridCanvas'); if (!cv) return;
  // the paint colour: the swatch chosen in the grid tool row (also settable by clicking a swatch in
  // the Palette window). Explicit colour beats guessing, and it round-trips through the reducer/tuner.
  const gridPaintRGB = () => { const h = ($('gridPaintCol') && $('gridPaintCol').value) || '#8fa7bd'; return [parseInt(h.slice(1, 3), 16) || 0, parseInt(h.slice(3, 5), 16) || 0, parseInt(h.slice(5, 7), 16) || 0]; };
  // (kept for reference/eyedrop) colour of the nearest existing voxel along the current view's depth axis
  const sampleColor = (cx, cy) => {
    const g = gridGeom, gm = gridModel; if (!g || !gm) return [150, 150, 150];
    const N = gm.foot * gm.foot, ed = voxEdit[g.part];
    const isFilled = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= gm.foot || y >= gm.foot || z >= gm.layers) return false; const o = ed.get(z * N + y * gm.foot + x); return o !== undefined ? o !== 'del' : gm.filled(x, y, z); };
    const colOf = (x, y, z) => { const o = ed.get(z * N + y * gm.foot + x); if (Array.isArray(o)) return o; const c = (z * N + y * gm.foot + x) * 3; return [gm.vcol[c], gm.vcol[c + 1], gm.vcol[c + 2]]; };
    for (let d = 1; d < g.depth; d++) for (const s of [g.slice - d, g.slice + d]) {
      if (s < 0 || s >= g.depth) continue;
      const [x, y, z] = g.toVox(cx, cy, s); if (isFilled(x, y, z)) return colOf(x, y, z);
    }
    return [150, 150, 150];
  };
  const editAt = (e, erase) => {
    const g = gridGeom; if (!g || !g.editable) return false;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * (cv.width / r.width), py = (e.clientY - r.top) * (cv.height / r.height);
    const cx = Math.floor((px - g.ox) / g.cell), cy = Math.floor((py - g.oy) / g.cell);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
    const [x, y, z] = g.toVox(cx, cy, g.slice), N = g.foot * g.foot, k = z * N + y * g.foot + x, ed = voxEdit[g.part];
    const ov = ed.get(k), curFilled = ov !== undefined ? ov !== 'del' : gridModel.filled(x, y, z);
    if (erase) { if (!curFilled) return false; ed.set(k, 'del'); }   // nothing to remove here
    else { if (curFilled) return false; ed.set(k, gridPaintRGB()); }   // add only where empty, in the chosen paint colour
    renderGridView();                                                // live repaint (overlay is layered on the cached carve)
    return true;
  };
  let painting = false, dirty = false;
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
  let geomDrag = null;                                             // { mode, gc0, gr0, cR0, rR0 }
  const gridRectFromSpans = (g) => {
    const gs = geomState[gridGeom.part];
    const rng = (info) => { const s = gs[spanKey[info.axis]], cap = capOf(info.axis, g.foot, g.layers); return info.flip ? { lo: cap - s.hi, hi: cap - s.lo } : { lo: s.lo, hi: s.hi }; };
    return { cR: rng(g.col), rR: rng(g.row) };
  };
  const spansFromGridRect = (g, cR, rR) => {
    const gs = geomState[gridGeom.part];
    const put = (info, lo, hi) => { const cap = capOf(info.axis, g.foot, g.layers); lo = clamp(Math.round(lo), 0, cap - 1); hi = clamp(Math.round(hi), lo + 1, cap); gs[spanKey[info.axis]] = info.flip ? { lo: cap - hi, hi: cap - lo } : { lo, hi }; };
    put(g.col, cR.lo, cR.hi); put(g.row, rR.lo, rR.hi);
  };
  const geomMove = (e) => {
    const g = gridGeom.geom; if (!g || !geomDrag) return;
    const { px, py } = ptCell(e), gc = (px - g.ox) / g.cell, gr = (py - g.oy) / g.cell;
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
    if (gridGeom && gridGeom.geom) {                               // Geometry mode: box drag
      const mode = geomHit(e); if (!mode) return;
      ensureGeomSpans();
      const g = gridGeom.geom, { px, py } = ptCell(e), r = gridRectFromSpans(g);
      geomDrag = { mode, gc0: (px - g.ox) / g.cell, gr0: (py - g.oy) / g.cell, cR0: r.cR, rR0: r.rR };
      dirty = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (!gridGeom || !gridGeom.editable) return;
    const erase = gridTool === 'erase' || e.button === 2;
    if (editAt(e, erase)) { painting = true; dirty = true; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  cv.addEventListener('pointermove', (e) => { if (geomDrag) geomMove(e); else if (painting) editAt(e, gridTool === 'erase' || (e.buttons & 2)); });
  const finish = () => { painting = false; geomDrag = null; if (dirty) { dirty = false; gridModel = null; rebuildSlices(); scheduleAutosave(); } };  // full re-carve on release
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
makeDraggable('palModal', 'palDrag');
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
  keyTolState[part][view] = 75; polyState[part][view] = null;                // …and reset the cutout tuning
  imgURLCache[part][view] = null;
  renderView(pick);
}
function renderView(pick) {
  const part = pick.dataset.part, view = pick.dataset.view, src = srcImg[part][view];
  if (!src) return;
  const fl = flipState[part][view], flipped = (fl.h || fl.v) ? flipCanvas(src, fl.h, fl.v) : src;
  const rot = rotState[part][view] || 0, im = rot ? rotCanvas(flipped, rot) : flipped;
  imgs[part][view] = im;
  const g = pick.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 128, 84); drawFit(g, keyedCanvas(im, keyTolState[part][view], polyState[part][view]), 128, 84);
  pick.classList.add('set'); updateFlipBtns(pick);
  if (!bulkLoad) rebuildSlices();                                             // restore rebuilds once at the end
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
  if (polys) for (const q of polys) for (const p of q.pts) { if (dispAxis === 'h') p[0] = W - 1 - p[0]; else p[1] = H - 1 - p[1]; }
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
const clonePolys = (list) => list.map((q) => ({ cut: !!q.cut, pts: q.pts.map((p) => p.slice()) }));
function syncPolyBtns() {
  $('keyPoly').classList.toggle('on', polyDrawing);
  $('keyPoly').textContent = polyDrawing ? '✏ Click points… (click 1st to close)' : '✏ Draw polygon';
  $('keyPolyInv').classList.toggle('on', polyCut);
  $('keyPolyInv').textContent = polyCut ? '➖ Cut inside' : '➕ Keep inside';
  $('keyCanvas').style.cursor = polyDrawing ? 'crosshair' : 'default';
}
function openKeyModal(part, view) {
  if (!imgs[part][view]) return;                                   // nothing loaded in this slot yet
  keyTarget = { part, view };
  $('keyTitle').textContent = (part === 'body' ? 'base' : part) + ' · ' + view;
  $('keyTol').value = keyTolState[part][view]; $('keyTolV').textContent = keyTolState[part][view];
  workPolys = clonePolys(polyState[part][view] || []);
  workPoly = []; polyDrawing = false; polyCut = false; syncPolyBtns();
  renderKeyPreview();
  $('keyModal').hidden = false;
}
function renderKeyPreview() {
  const im = imgs[keyTarget.part][keyTarget.view];
  const maxW = Math.min(1440, window.innerWidth * 0.86), maxH = Math.min(1020, window.innerHeight * 0.72);
  const cv = $('keyCanvas'), s = keyScale = Math.min(maxW / im.width, maxH / im.height, 12);
  cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = s < 1;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(keyedCanvas(im, +$('keyTol').value, workPolys), 0, 0, cv.width, cv.height);
  const d = g.getImageData(0, 0, cv.width, cv.height).data, w = cv.width, hh = cv.height;   // outline overlay
  const solid = (x, y) => x >= 0 && x < w && y >= 0 && y < hh && d[(y * w + x) * 4 + 3] > 40;
  g.fillStyle = '#ff4fd8';
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++)
    if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  const drawPoly = (pts, closed, col) => {                         // shape paths + vertex handles
    g.lineWidth = 1.5; g.strokeStyle = col;
    g.beginPath(); g.moveTo(pts[0][0] * s, pts[0][1] * s);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * s, pts[i][1] * s);
    if (closed) g.closePath();
    g.stroke();
    g.fillStyle = col;
    for (const p of pts) g.fillRect(p[0] * s - 2, p[1] * s - 2, 4, 4);
  };
  for (const q of workPolys) drawPoly(q.pts, true, q.cut ? '#e0625f' : '#f2c869');
  if (workPoly.length) {
    drawPoly(workPoly, false, polyCut ? '#e0625f' : '#f2c869');
    g.strokeStyle = '#ff4fd8'; g.strokeRect(workPoly[0][0] * s - 4, workPoly[0][1] * s - 4, 8, 8);
  }
}
$('keyCanvas').addEventListener('click', (e) => {
  if (!polyDrawing) return;
  const cv = $('keyCanvas'), r = cv.getBoundingClientRect(), css = cv.width / r.width;    // CSS px → canvas px
  const x = (e.clientX - r.left) * css / keyScale, y = (e.clientY - r.top) * css / keyScale;
  if (workPoly.length >= 3) {                                      // close by clicking the first point…
    const dx = (workPoly[0][0] - x) * keyScale, dy = (workPoly[0][1] - y) * keyScale;
    if (dx * dx + dy * dy < 120) {                                 // …and stay in draw mode for the next shape
      workPolys.push({ pts: workPoly, cut: polyCut }); workPoly = [];
      renderKeyPreview(); return;
    }
  }
  workPoly.push([x, y]); renderKeyPreview();
});
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
$('keyTol').oninput = () => { $('keyTolV').textContent = $('keyTol').value; renderKeyPreview(); };
$('keyApply').onclick = () => {
  keyTolState[keyTarget.part][keyTarget.view] = +$('keyTol').value;
  polyState[keyTarget.part][keyTarget.view] = workPolys.length ? clonePolys(workPolys) : null;
  $('keyModal').hidden = true;
  renderView(pickFor(keyTarget.part, keyTarget.view));             // re-key the thumb + re-carve the model
};
$('keyCancel').onclick = () => { $('keyModal').hidden = true; };
$('keyModal').addEventListener('click', (e) => { if (e.target === $('keyModal')) $('keyModal').hidden = true; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('keyModal').hidden) return;
  if (workPoly.length) { workPoly = []; renderKeyPreview(); }      // cancel the unfinished shape…
  else if (polyDrawing) { polyDrawing = false; syncPolyBtns(); renderKeyPreview(); }   // …then exit draw mode…
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
  sheetCtx.imageSmoothingEnabled = sheetScale < 1;
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

// ── PALETTE TUNER (owner 2026-07-16): every colour the model uses as a swatch strip; pick one and
// re-tint it on a hue strip + saturation/brightness square. Small palettes edit exactly; big
// full-colour models are grouped by median-cut and the whole group shifts by the same hue/sat/value
// delta so shading variation survives. Edits live in palMap, applied inside buildFaces/collectVox —
// so orbit preview, in-game inset, bake, Tier C model embeds and .vox exports all agree.
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const keyRGB = (k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
const cssOf = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hexOf = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
let palSwList = [], palSel = null, palH = 0, palS = 0, palVv = 1, palPending = false;
function palRebuild() {                                            // throttle: one model re-carve per frame
  if (palPending) return;
  palPending = true;
  requestAnimationFrame(() => { palPending = false; rebuildSlices(); scheduleAutosave(); });
}
const palCur = (k) => palMap.get(k) || keyRGB(k);
function palSwatchCol(sw, orig) {                                  // count-weighted average of member colours
  let r = 0, g = 0, b = 0, n = 0;
  for (const [k, c] of sw.members) { const m = orig ? keyRGB(k) : palCur(k); r += m[0] * c; g += m[1] * c; b += m[2] * c; n += c; }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
function palBuildSwatches() {
  const tally = new Map();
  for (const F of [bodyFaces, turretFaces]) if (F) for (const f of F.faces) tally.set(f.k, (tally.get(f.k) || 0) + 1);
  const entries = [...tally.entries()];
  let groups;
  if (entries.length <= 28) groups = entries.map((e) => ({ members: [e] }));
  else {                                                           // full-colour model → group into 18 families
    const cents = medianCut(entries.map(([k]) => keyRGB(k)), 18);
    groups = cents.map(() => ({ members: [] }));
    for (const [k, c] of entries) {
      const col = keyRGB(k); let bi = 0, bd = 1e9;
      for (let i = 0; i < cents.length; i++) { const p = cents[i], d = (p[0] - col[0]) ** 2 + (p[1] - col[1]) ** 2 + (p[2] - col[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      groups[bi].members.push([k, c]);
    }
    groups = groups.filter((g) => g.members.length);
  }
  const weight = (sw) => sw.members.reduce((n, [, c]) => n + c, 0);
  groups.sort((a, b) => weight(b) - weight(a));
  palSwList = groups; palSel = null; $('palPick').hidden = true;
  const box = $('palSwatches'); box.innerHTML = '';
  groups.forEach((sw, i) => {
    const b = document.createElement('button');
    b.className = 'palSw'; b.dataset.i = i;
    b.style.background = cssOf(palSwatchCol(sw));
    b.title = `${weight(sw)} faces · ${sw.members.length} colour(s)`;
    if (sw.members.some(([k]) => palMap.has(k))) b.classList.add('edited');
    if (swatchPinned(palSwatchCol(sw))) b.classList.add('pinned');
    if (swatchDropped(palSwatchCol(sw))) b.classList.add('dropped');
    b.onclick = () => palSelect(i);
    box.appendChild(b);
  });
  $('palState').textContent = `${entries.length} distinct colour(s)` + (entries.length > 28 ? ' — grouped into families; a family shifts together.' : '.') +
    (palMap.size ? ` ${palMap.size} tuned.` : '');
}
function palSelect(i) {
  palSel = palSwList[i];
  document.querySelectorAll('.palSw').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i));
  const cur = palSwatchCol(palSel);
  const gp = $('gridPaintCol'); if (gp) gp.value = hexOf(cur);        // selecting a swatch loads it as the grid paint colour
  [palH, palS, palVv] = rgb2hsv(cur[0], cur[1], cur[2]);
  $('palPick').hidden = false;
  $('palInfo').textContent = palSel.members.length === 1 ? 'Exact colour — replaced outright.' :
    `${palSel.members.length} shades move together (same hue/brightness shift).`;
  palDrawPickers(); palSyncChips(); updateKeepBtn();
}
function palSyncChips() {
  const cur = palSwatchCol(palSel);
  $('palWas').style.background = cssOf(palSwatchCol(palSel, true));
  $('palNow').style.background = cssOf(cur);
  $('palHex').textContent = hexOf(cur);
}
function palDrawPickers() {
  const hc = $('palHue'), hg = hc.getContext('2d');
  const grad = hg.createLinearGradient(0, 0, 0, hc.height);
  for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, cssOf(hsv2rgb(i * 60, 1, 1)));
  hg.fillStyle = grad; hg.fillRect(0, 0, hc.width, hc.height);
  const hy = palH / 360 * hc.height;
  hg.strokeStyle = '#fff'; hg.lineWidth = 2; hg.strokeRect(0.5, hy - 2, hc.width - 1, 4);
  const sc = $('palSV'), sg = sc.getContext('2d'), W = sc.width, H = sc.height;
  sg.fillStyle = cssOf(hsv2rgb(palH, 1, 1)); sg.fillRect(0, 0, W, H);
  let g2 = sg.createLinearGradient(0, 0, W, 0); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = g2; sg.fillRect(0, 0, W, H);
  g2 = sg.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
  sg.fillStyle = g2; sg.fillRect(0, 0, W, H);
  const mx = palS * W, my = (1 - palVv) * H;
  sg.beginPath(); sg.arc(mx, my, 6, 0, 7); sg.strokeStyle = palVv > 0.55 ? '#000' : '#fff'; sg.lineWidth = 2; sg.stroke();
}
function palApply() {                                              // push picker HSV into palMap for the swatch
  if (!palSel) return;
  const target = hsv2rgb(palH, palS, palVv);
  if (palSel.members.length === 1) palMap.set(palSel.members[0][0], target);
  else {
    const cur = palSwatchCol(palSel), [ch, cs, cv] = rgb2hsv(cur[0], cur[1], cur[2]);
    const dh = palH - ch, sr = cs > 0.02 ? palS / cs : null, vr = cv > 0.02 ? palVv / cv : null;
    for (const [k] of palSel.members) {
      let [h, s, v] = rgb2hsv(...palCur(k));
      h = (h + dh + 360) % 360;
      s = clamp(sr === null ? palS : s * sr, 0, 1);
      v = clamp(vr === null ? palVv : v * vr, 0, 1);
      palMap.set(k, hsv2rgb(h, s, v));
    }
  }
  const btn = document.querySelector('.palSw.sel');
  if (btn) { btn.style.background = cssOf(palSwatchCol(palSel)); btn.classList.add('edited'); }
  palSyncChips(); palDrawPickers(); palRebuild();
}
function palPickerDrag(cv, apply) {
  let on = false;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  cv.addEventListener('pointerdown', (e) => { on = true; cv.setPointerCapture(e.pointerId); apply(...at(e)); });
  cv.addEventListener('pointermove', (e) => { if (on) apply(...at(e)); });
  cv.addEventListener('pointerup', () => { on = false; });
}
palPickerDrag($('palHue'), (x, y) => { palH = y * 360; palApply(); });
palPickerDrag($('palSV'), (x, y) => { palS = x; palVv = 1 - y; palApply(); });
$('palResetOne').onclick = () => {
  if (!palSel) return;
  for (const [k] of palSel.members) palMap.delete(k);
  const cur = palSwatchCol(palSel); [palH, palS, palVv] = rgb2hsv(cur[0], cur[1], cur[2]);
  const btn = document.querySelector('.palSw.sel');
  if (btn) { btn.style.background = cssOf(cur); btn.classList.remove('edited'); }
  palSyncChips(); palDrawPickers(); palRebuild();
};
$('palResetAll').onclick = () => { palMap.clear(); palBuildSwatches(); palRebuild(); };
// palette SIZE + reduction — shared by the side-panel slider (#pal) and the floating window (#palN),
// both kept in lock-step. Re-carves the model, then refreshes the swatch strip if the window is open.
function palReduceRefresh() { rebuildSlices(); if (!$('palModal').hidden) palBuildSwatches(); scheduleAutosave(); }
function setPaletteN(v) {
  state.paletteN = v;
  $('pal').value = v; $('palV').textContent = v || 'full';
  $('palN').value = v; $('palNV').textContent = v || 'full';
  palReduceRefresh();
}
$('pal').oninput = (e) => setPaletteN(+e.target.value);
$('palN').oninput = (e) => setPaletteN(+e.target.value);
// KEEP a colour (always in the reduced palette) or ELIMINATE it (dropped, voxels remap to nearest
// survivor). The two are mutually exclusive; both toggle on the selected swatch.
const keyOf = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
const nearIn = (set, c) => { for (const k of set) { const p = keyRGB(k); if ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 < 24 * 24) return k; } return null; };
function swatchPinned(c) { return nearIn(palKeep, c); }
function swatchDropped(c) { return nearIn(palDrop, c); }
function updateKeepBtn() {
  if (!palSel) return;
  const c = palSwatchCol(palSel), pinned = swatchPinned(c) != null, dropped = swatchDropped(c) != null;
  const kb = $('palKeepBtn'); if (kb) { kb.textContent = pinned ? '📌 Kept — click to release' : '📌 Keep this color'; kb.classList.toggle('on', pinned); }
  const db = $('palDropBtn'); if (db) { db.textContent = dropped ? '🚫 Eliminated — click to restore' : '🚫 Eliminate this color'; db.classList.toggle('on', dropped); }
}
$('palKeepBtn').onclick = () => {
  if (!palSel) return;
  const c = palSwatchCol(palSel), existing = swatchPinned(c);
  if (existing != null) palKeep.delete(existing); else { palKeep.add(keyOf(c)); const d = swatchDropped(c); if (d != null) palDrop.delete(d); }
  updateKeepBtn(); palReduceRefresh();
};
$('palDropBtn').onclick = () => {
  if (!palSel) return;
  const c = palSwatchCol(palSel), existing = swatchDropped(c);
  if (existing != null) palDrop.delete(existing); else { palDrop.add(keyOf(c)); const k = swatchPinned(c); if (k != null) palKeep.delete(k); }
  updateKeepBtn(); palReduceRefresh();
};
$('palClearKeep').onclick = () => { palKeep.clear(); palDrop.clear(); palReduceRefresh(); updateKeepBtn(); };
$('openPal').onclick = () => { $('palN').value = state.paletteN; $('palNV').textContent = state.paletteN || 'full'; palBuildSwatches(); $('palModal').hidden = false; };
$('palClose').onclick = () => { $('palModal').hidden = true; };

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
  const foot = state.foot, bL = state.bodyLayers, tL = state.turretLayers, sp = layerSp(state.el), B = state.bakeScale;
  const pivotPx = foot * state.turretPivot / 100, pivotFrac = 0.5 + state.turretPivot / 100;
  const g = geom(foot, Math.max(bL, tL), sp, pivotPx);   // shared texture sized for the taller stack; both bottom-align at BASEY
  const t0 = performance.now();
  const body = bakeAngleCache(app.renderer, bodyFaces, { frames: BODY_FRAMES, smooth: false, sharp: 0, g, pivotFrac: 0.5, el: state.el, scale: B });
  const turret = bakeAngleCache(app.renderer, turretFaces, { frames: TURRET_FRAMES, smooth: state.smooth, sharp: state.sharp, g, pivotFrac, el: state.el, scale: B });
  state.baked = { body, turret, bodyFrames: BODY_FRAMES, turretFrames: TURRET_FRAMES, g, sp, foot, bodyLayers: bL, turretLayers: tL, scale: B };
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
  const pivot = [Math.round(b.g.CX * B), Math.round(b.g.BASEY * B)], mountDz = clamp(bodyMountZ + state.mountZ, 0, b.bodyLayers);
  const totalH = Math.max(b.bodyLayers, mountDz + b.turretLayers);
  const pack = {
    id, class: state.cls, footprint: [b.foot, b.foot, totalH],
    scale: { voxPerTile: VOX_PER_TILE, tiles: unitTiles(b.foot) },   // the world-size contract
    camera: { azimuth: state.az | 0, elevation: state.el | 0 }, layerSpacing: Math.round(b.sp * 100) / 100,
    voxel: { height: state.zScale },
    renderScale: B,                                    // atlas px per voxel — draw frames at 1/renderScale
    light: { azimuth: state.lightAz, contrast: state.lightK },
    parts: [
      { id: 'body', kind: 'directional', facings: b.bodyFrames, atlas: `${id}.body.png`, cell: ba.cell, cols: ba.cols, pivot, layers: b.bodyLayers, zeroFacing: '+x' },
      { id: 'turret', kind: 'stack', angles: b.turretFrames, atlas: `${id}.turret.png`, cell: ta.cell, cols: ta.cols, pivot, layers: b.turretLayers, mount: [state.turretDx, 0, mountDz] },
    ],
    shadow: { kind: 'ellipse', rx: Math.round(b.foot / 2), ry: Math.round(b.foot * 0.22), alt: state.cls === 'air' ? 30 : 0 },
    stats: { speed: 90, turnRate: 3.0, turretRate: 4.0 },
  };
  // Tier C (rendering-tiers spec §3C): embed the assembled voxel model so the game can render this
  // unit as a LIVE 3D object with real pitch/roll. Big (~4B/voxel base64) — only for set-pieces.
  if ($('embedModel').checked) {
    const cells = collectVox('body', b.foot, b.bodyLayers, 0, 0)
      .concat(collectVox('turret', b.foot, b.turretLayers, mountDz, Math.round(state.turretDx)));
    let nz = 1; for (const c of cells) if (c.z + 1 > nz) nz = c.z + 1;
    const data = new Uint8Array(b.foot * b.foot * nz * 4);
    for (const c of cells) { const i = ((c.z * b.foot + c.y) * b.foot + c.x) * 4; data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255; }
    pack.model = { nx: b.foot, ny: b.foot, nz, b64: b64FromU8(data) };
  }
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
function doSaveUnit() {
  if (!state.baked) return; const built = buildPack(); const v = validatePack(built.pack);
  activeUnitId = built.pack.id;                           // an explicit save under this id is a deliberate rename → follow it
  const m = loadManifest();
  m.config = { camera: built.pack.camera, light: built.pack.light };   // shared game-wide config
  m.units = m.units || {}; m.units[built.pack.id] = built;
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); } catch (e) { $('saveState').textContent = 'Save failed (storage full — use Download).'; return; }
  lastPack = built;
  $('saveState').innerHTML = v.ok ? `<span class="lock">Saved "${built.pack.id}" ✓ (schema-valid)</span>` : 'Saved, but INVALID: ' + v.errors.join('; ');
  $('packJson').textContent = JSON.stringify(built.pack, null, 2);
  renderManifest();
  renderRoster();        // flip this unit's card to "supplied ✓"
  renderScaleChart();    // the new unit joins the side-view scale chart
}
$('saveUnit').onclick = doSaveUnit;

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
$('shipManifest').onclick = async () => {
  try {
    const r = await fetch('/__ship', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'content/units/voxel-units.json', data: loadManifest() }) });
    const d = await r.json().catch(() => ({ ok: false, error: 'not a dev server' }));
    $('projState').textContent = d.ok
      ? `🚀 Shipped ${Object.keys(loadManifest().units || {}).length} unit(s) → content/units/voxel-units.json — commit to deploy.`
      : `Ship failed: ${d.error || 'unknown'} (deployed site? use Download units.json instead)`;
  } catch (e) { $('projState').textContent = 'Ship failed: ' + e.message; }
};

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
    keys: () => op('readonly', (s) => s.getAllKeys()) };
})();
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
  const st = { ...state }; delete st.baked;
  return { format: 'stackforge-project', version: 2, id: (idOverride || $('uid').value || 'unit').trim(),
    state: st, flips: flipState, rots: rotState, keyTol: keyTolState, polys: polyState, images, vox,
    palMap: [...palMap.entries()], palKeep: [...palKeep], palDrop: [...palDrop],
    voxEdit: { body: [...voxEdit.body], turret: [...voxEdit.turret] },
    geom: { body: { ...geomState.body }, turret: { ...geomState.turret } } };
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
  set('pal', state.paletteN, state.paletteN || 'full');
  set('palN', state.paletteN, state.paletteN || 'full');
  set('sharp', Math.round(state.sharp * 100), state.sharp.toFixed(2)); set('bakeScale', state.bakeScale, state.bakeScale + '×');
  $('res').value = state.foot; $('smooth').checked = state.smooth; $('spin').checked = state.spin;
  [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.p === state.part));
  rig.scale.set(state.zoom);
}
async function loadProject(p) {
  bulkLoad = true;
  try {
    $('uid').value = p.id || 'unit'; activeUnitId = (p.id || 'unit');   // anchor the WIP key to the restored project
    Object.assign(state, p.state || {}); state.baked = null;
    palMap.clear(); if (p.palMap) for (const [k, c] of p.palMap) palMap.set(k, c);
    palKeep.clear(); if (p.palKeep) for (const k of p.palKeep) palKeep.add(k);
    palDrop.clear(); if (p.palDrop) for (const k of p.palDrop) palDrop.add(k);
    voxEdit.body.clear(); voxEdit.turret.clear();
    if (p.voxEdit) { for (const [k, v] of p.voxEdit.body || []) voxEdit.body.set(k, v); for (const [k, v] of p.voxEdit.turret || []) voxEdit.turret.set(k, v); }
    for (const part of ['body', 'turret']) geomState[part] = (p.geom && p.geom[part]) ? { ...p.geom[part] } : { auto: true, bottomFrom: 'top' };  // v1 projects → auto (identical to before)
    for (const part of ['body', 'turret']) {
      const pv = p.vox && p.vox[part];
      voxPart[part] = pv ? { nx: pv.nx, ny: pv.ny, nz: pv.nz, data: u8FromB64(pv.b64) } : null;
      voxB64[part] = pv ? pv.b64 : null;
      for (const v of VIEWS) {
        flipState[part][v] = (p.flips && p.flips[part] && p.flips[part][v]) || { h: false, v: false };
        rotState[part][v] = (p.rots && p.rots[part] && p.rots[part][v]) || 0;
        keyTolState[part][v] = (p.keyTol && p.keyTol[part] && p.keyTol[part][v]) || 75;
        polyState[part][v] = (p.polys && p.polys[part] && p.polys[part][v]) || null;
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
  syncAllControls(); rebuildSlices(); drawLight(); renderRoster();
}
let autosaveTimer = 0;
// a project is worth persisting only if it has real editable content — source art, an imported .vox,
// or manual voxel edits. A baked-only pack preview (loadPackPreview clears the source) has NONE of
// these, so autosaving it would overwrite a genuine WIP with an empty shell and hijack sf:last — the
// root cause of "the unit I worked on reloads empty".
function projectHasContent(p) {
  for (const part of ['body', 'turret']) {
    if (p.vox && p.vox[part]) return true;
    if (p.voxEdit && p.voxEdit[part] && p.voxEdit[part].length) return true;
    if (p.images && p.images[part]) for (const v of VIEWS) if (p.images[part][v]) return true;
  }
  return false;
}
function setWipStatus(txt, kind) { const el = $('wipStatus'); if (!el) return; el.textContent = txt; el.style.color = kind === 'saved' ? '#57d98a' : kind === 'dirty' ? '#e0b060' : 'var(--muted)'; }
function scheduleAutosave() {
  if (bulkLoad) return;
  clearTimeout(autosaveTimer); autosaveTimer = setTimeout(doAutosave, 500);
  setWipStatus('● unsaved…', 'dirty');
}
async function doAutosave() {
  if (bulkLoad) { scheduleAutosave(); return; }
  clearTimeout(autosaveTimer);
  try {
    const p = snapshotProject(activeUnitId);               // key off the loaded unit, not the mutable id box
    if (!projectHasContent(p)) { setWipStatus('— nothing to save', 'muted'); return; }   // don't clobber a real WIP with an empty snapshot
    await idb.put('proj:' + p.id, p); localStorage.setItem('bulwark:sf:last', p.id);
    const t = new Date().toLocaleTimeString();
    $('projState').textContent = `Autosaved "${p.id}" · ${t}`;
    setWipStatus(`✓ saved ${t}`, 'saved');
  } catch (e) { setWipStatus('⚠ save failed', 'dirty'); }
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
const FACTIONS = ['Ground / Powder', 'Air', 'High Tech', 'Artillery', 'Water', 'Arcane / Energy', 'Space Tech', 'Dark Energy', 'Greenies (Chem)', 'System'];
const ROLES = ['Skirmisher', 'Support', 'Bruiser', 'Siege', 'Juggernaut', 'Harasser', 'Striker', 'Guided AA'];
const prefixFor = (name) => (name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'UNI');
let filesIndex = [], curFaction = null, roster = [];
// SHIPPED units (the deployed manifest with baked art) are pulled in so the roster/Load list surface
// units that exist in the game but were never saved in THIS browser — otherwise a fresh browser shows
// every slot as "needs art" and nothing loads. A localStorage-saved unit of the same id wins.
let shippedUnits = {};
const suppliedUnits = () => ({ ...shippedUnits, ...(loadManifest().units || {}) });
async function loadShipped() {
  try { const d = await (await fetch('../../content/units/voxel-units.json')).json(); shippedUnits = d.units || {}; } catch (e) { shippedUnits = {}; }
}
async function initFactions() {
  try { filesIndex = (await (await fetch('../../content/units/index.json')).json()).factions || []; } catch (e) { filesIndex = []; }
  await loadShipped();                                            // so "supplied ✓" + Load reflect deployed art
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
  const grid = $('unitGrid'), supplied = suppliedUnits();
  grid.innerHTML = ''; let n = 0;
  for (const u of roster) {
    const has = !!supplied[u.id]; if (has) n++;
    const card = document.createElement('div'); card.className = 'ucard' + (u.id === $('uid').value ? ' sel' : ''); card.dataset.uid = u.id;
    card.innerHTML = `<canvas width="76" height="56"></canvas><div class="un">${u.id.replace(/^[A-Za-z]+-/, '')}</div><div class="ur">${u.role || '—'}</div><div class="badge ${has ? 'ok' : 'no'}">${has ? '✓ supplied' : 'needs art'}</div>`;
    const g = card.querySelector('canvas').getContext('2d');
    if (has && supplied[u.id].atlases && supplied[u.id].atlases.body) { const im = new Image(); im.onload = () => { g.clearRect(0, 0, 76, 56); g.drawImage(im, 0, 0, 76, 56); }; im.src = supplied[u.id].atlases.body; }
    else { g.fillStyle = '#132234'; g.fillRect(0, 0, 76, 56); g.fillStyle = '#3c5670'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(u.shape || u.role || '?', 38, 32); }
    card.onclick = () => onCardClick(u.id);
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
// wipe the current unit's source art/vox + per-view cutout state so switching to a pack-only unit
// doesn't keep re-carving and displaying the PREVIOUS unit (the "still looking at Base" bug).
function clearSourceArt() {
  for (const part of ['body', 'turret']) {
    voxPart[part] = null; voxB64[part] = null;
    for (const v of VIEWS) {
      srcImg[part][v] = null; imgs[part][v] = null; imgURLCache[part][v] = null;
      flipState[part][v] = { h: false, v: false }; rotState[part][v] = 0; keyTolState[part][v] = 75; polyState[part][v] = null;
      const pick = pickFor(part, v);
      if (pick) { pick.classList.remove('set'); updateFlipBtns(pick); const cvs = pick.querySelector('canvas'); if (cvs) cvs.getContext('2d').clearRect(0, 0, cvs.width, cvs.height); }
    }
  }
  gridModel = null;
}
function selectUnit(id) {
  $('uid').value = id; activeUnitId = id;                 // anchor the WIP key to the unit being loaded
  const m = suppliedUnits();
  if (m[id]) {
    const p = m[id].pack, bp = (p.parts || []).find((q) => q.id === 'body'), tp = (p.parts || []).find((q) => q.id === 'turret');
    state.cls = p.class; state.foot = p.footprint[0];
    state.bodyLayers = (bp && bp.layers) || p.footprint[2]; state.turretLayers = (tp && tp.layers) || p.footprint[2];
    if (p.light) { state.lightAz = p.light.azimuth; $('lightAz').value = state.lightAz; $('lightAzV').textContent = state.lightAz + '°'; }
    $('res').value = state.foot;
    $('bodyLayers').value = state.bodyLayers; $('bodyLayersV').textContent = state.bodyLayers;
    $('turretLayers').value = state.turretLayers; $('turretLayersV').textContent = state.turretLayers;
    [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  }
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  drawLight();
  // a WIP project restores full editable source (loadProject rebuilds); otherwise DROP the previous
  // unit's source so it stops rendering, then show the saved pack's baked model in the orbit.
  idb.get('proj:' + id).then((p) => {
    if (p) return loadProject(p).then(() => { $('projState').textContent = `Loaded "${id}" — continue editing.`; });
    clearSourceArt();
    if (m[id]) return loadPackPreview(m[id]).then(() => {
      gridModel = null; renderGridView();                           // reflect the cleared source (baked shows in orbit)
      $('projState').textContent = `Loaded "${id}" baked pack — orbit/in-game show the baked model; no editable source on this browser.`;
    });
    rebuildSlices();
    $('projState').textContent = `Nothing to load for "${id}" (no WIP project and no saved pack).`;
  }).catch((e) => { console.error('[load] failed for', id, e); $('projState').textContent = `Load failed for "${id}": ${(e && e.message) || e}`; });
}

// rebuild the baked preview straight from a saved pack's atlases — "load asset pack and continue"
async function loadPackPreview(entry) {
  const p = entry.pack, B = p.renderScale || 1;
  const mk = async (partId) => {
    const part = (p.parts || []).find((q) => q.id === partId);
    if (!part || !entry.atlases || !entry.atlases[partId]) return null;
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = entry.atlases[partId]; });
    const base = PIXI.BaseTexture.from(img);
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
function onCardClick(id) {
  saveAsId = id;
  $('saveAsTitle').textContent = id;
  const exists = !!suppliedUnits()[id];                            // has art (saved locally or shipped) → loadable
  $('saveAsWarn').hidden = !exists;
  $('saveAsLoad').hidden = !exists;                                // offer Load when there's something to load
  $('saveAsModal').hidden = false;
}
async function openLoadModal() {
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
  if (!ids.length) list.innerHTML = '<div class="note">Nothing saved yet — bake a unit and click its slot to save one.</div>';
  for (const id of ids) {
    const b = document.createElement('button');
    b.className = 'ghost loadRow';
    b.innerHTML = `<span class="lid">${id}</span><span class="ltag">${wip.has(id) ? '✎ project' : ''}${wip.has(id) && packed.has(id) ? ' · ' : ''}${packed.has(id) ? '📦 pack' : ''}</span>`;
    b.onclick = () => { $('loadModal').hidden = true; doAutosave(); selectUnit(id); };   // flush WIP before it's replaced
    list.appendChild(b);
  }
  $('loadModal').hidden = false;
}
$('loadUnit').onclick = openLoadModal;
$('loadCancel').onclick = () => { $('loadModal').hidden = true; };
$('loadModal').addEventListener('click', (e) => { if (e.target === $('loadModal')) $('loadModal').hidden = true; });
function quickSave(id, as3D) {
  $('uid').value = id;
  $('embedModel').checked = !!as3D;                     // 3D embeds the editable model; sprites explicitly does not
  doBake();                                             // current camera + bake settings
  doSaveUnit();                                         // pack → manifest, card flips to ✓
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  $('projState').textContent = `Saved "${id}" as ${as3D ? '3D (live model + baked fallback)' : 'baked sprites'} — reload the game to see it.`;
  doAutosave();                                         // park the working project under this id too
}
$('saveAsLoad').onclick = () => { $('saveAsModal').hidden = true; doAutosave(); selectUnit(saveAsId); };   // actually load it
$('saveAsSprites').onclick = () => { $('saveAsModal').hidden = true; quickSave(saveAsId, false); };
$('saveAs3D').onclick = () => { $('saveAsModal').hidden = true; quickSave(saveAsId, true); };
$('saveAsCancel').onclick = () => { $('saveAsModal').hidden = true; };
$('saveAsModal').addEventListener('click', (e) => { if (e.target === $('saveAsModal')) $('saveAsModal').hidden = true; });

syncInputs(); renderManifest(); layout(); update(); updateGamePreview(); initFactions();
(async () => {                                                     // resume the last working session
  try {
    const last = localStorage.getItem('bulwark:sf:last');
    if (!last) return;
    const p = await idb.get('proj:' + last);
    if (p) { await loadProject(p); $('projState').textContent = `Restored "${p.id}" from autosave.`; }
  } catch (e) { /* no stored session */ }
})();
window.__sf = { imgs, state, rebuildSlices, setView, toggleFlip, pickFor, buildVolume, buildModel, buildFaces, renderParts, drawScene, keyedCropped, gridStretch, parseVox, voxPart, fitToVox, collectVox, writeVox, exportVox, setGSpin, resizePreview, setZoom, keyTolState, polyState, openKeyModal, snapshotProject, loadProject,
  gdbg: () => ({ baked: !!state.baked, gbaked: !!gBodyBaked, gvis: gBodyBaked && gBodyBaked.visible, gkids: gUnit.children.length }) };   // debug/test hook
