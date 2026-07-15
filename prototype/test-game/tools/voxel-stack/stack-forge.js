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
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
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
  const ctx = cv.getContext('2d'); ctx.drawImage(canvas, 0, 0, w, h);
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
  const { filled, vcol } = buildModel(partId, foot, layers), N = foot * foot;
  const quant = buildQuantiser(null, vcol, filled, foot, layers, state.paletteN), out = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3; let r = vcol[c], g = vcol[c + 1], b = vcol[c + 2];
    if (quant) { const q = quant(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
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
  const tol = keyTolState[partId], pol = polyState[partId];
  const topC = src.top ? keyedCropped(src.top, tol.top, pol.top) : null;
  const sideC = src.side ? keyedCropped(src.side, tol.side, pol.side) : null;
  const frontC = src.front ? keyedCropped(src.front, tol.front, pol.front) : (src.back ? keyedCropped(src.back, tol.back, pol.back) : null);
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
  const backC = src.back ? keyedCropped(src.back, tol.back, pol.back) : null; // colour-only: paints the −x walls
  const backG = backC ? gridStretch(backC, bh, Hv, true) : null;
  const side = (x, z) => sideG ? (x >= ox && x < ox + bw && z >= 0 && z < Hv && !!sideG.m[z * bw + (x - ox)]) : z < Hv;
  const width = (y, z) => frontG ? (y >= oy && y < oy + bh && z >= 0 && z < Hv && !!frontG.m[z * bh + (y - oy)]) : z < Hv;
  const flat = !sideG && !frontG;
  const views = (sideG || frontG || backG) ? { side: sideG, front: frontG, back: backG, ox, oy } : null;
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
  return { cd, H, filled, views, dbg: { bw, bh, Hv, Hraw: +Hraw.toFixed(1), tw: topC && topC.width, th: topC && topC.height, sw: sideC && sideC.width, sh: sideC && sideC.height, fw: frontC && frontC.width, fh: frontC && frontC.height } };
}

// Unified voxel model for every consumer: always per-voxel colour (vcol), whether the part came from a
// .vox (already per-voxel) or the photo carve (per-column cd, materialised here). So there's ONE model —
// a stack of coloured cubes — and no cd/vcol branching downstream. Returns { vcol, filled, dbg }.
function buildModel(partId, foot, layers) {
  const v = buildVolume(partId, foot, layers);
  if (v.vcol) return v;                                              // .vox → already a voxel model
  const N = foot * foot, cd = v.cd, filled = v.filled, vcol = new Uint8Array(layers * N * 3);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    const i = y * foot + x, p = i * 4; if (cd[p + 3] < 20) continue;
    const r = cd[p], g = cd[p + 1], b = cd[p + 2];
    for (let z = 0; z < layers; z++) if (filled(x, y, z)) { const c = (z * N + i) * 3; vcol[c] = r; vcol[c + 1] = g; vcol[c + 2] = b; }
  }
  return { vcol, filled, cd: null, views: v.views, dbg: v.dbg };
}

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
// build a colour→palette quantiser over a part's filled voxels (null when Palette is off / full colour)
function buildQuantiser(cd, vcol, filled, foot, layers, n) {
  if (!n) return null;
  const N = foot * foot, seen = new Set(), cols = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    let r, g, b; if (vcol) { const c = (z * N + y * foot + x) * 3; r = vcol[c]; g = vcol[c + 1]; b = vcol[c + 2]; } else { const p = (y * foot + x) * 4; r = cd[p]; g = cd[p + 1]; b = cd[p + 2]; }
    const key = (r << 16) | (g << 8) | b; if (!seen.has(key)) { seen.add(key); cols.push([r, g, b]); }
  }
  const pal = medianCut(cols, n), cache = new Map();
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
  const quant = buildQuantiser(null, vcol, filled, foot, layers, state.paletteN);      // palette cleanup (median-cut)
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
    if (n >= 3) return pick(V.side, x - V.ox, z, n === 4);
    if (n === 2 && V.back) return pick(V.back, y - V.oy, z, false);
    return pick(V.front, y - V.oy, z, n === 2);
  };
  const faces = [];
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!filled(x, y, z)) continue;
    const c = (z * N + y * foot + x) * 3;
    const add = (n) => {
      const w = n === 0 ? null : wallCol(x, y, z, n);
      let r = w ? w[0] : vcol[c], g = w ? w[1] : vcol[c + 1], b = w ? w[2] : vcol[c + 2];
      if (quant) { const q = quant(r, g, b); r = q[0]; g = q[1]; b = q[2]; }
      faces.push({ x, y, z, n, r, g, b, d: 0 });
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
  const T = Math.min(26, (W - X0 - 8) / maxTiles);                   // ONE px-per-tile for everything
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
  PVW = clamp(w, 150, 520) | 0; PVH = clamp(h, 140, 480) | 0;
  GAME_TILE = BASE_TILE * PVW / BASE_PVW;
  drawGameBoard(); placeGamePreview();
}
drawGameBoard();

const imgs = { body: { top: null, side: null, front: null, back: null }, turret: { top: null, side: null, front: null, back: null } };
// per-slot flip: keep the raw source + H/V flags so flips compose from the original (no quality drift)
const mkViews = (v) => ({ top: v(), side: v(), front: v(), back: v() });
const srcImg = { body: mkViews(() => null), turret: mkViews(() => null) };
const flipState = { body: mkViews(() => ({ h: false, v: false })), turret: mkViews(() => ({ h: false, v: false })) };
const keyTolState = { body: mkViews(() => 75), turret: mkViews(() => 75) };   // per-image cutout sensitivity
const polyState = { body: mkViews(() => null), turret: mkViews(() => null) }; // per-image polygon cutout ([x,y] px)
const imgURLCache = { body: mkViews(() => null), turret: mkViews(() => null) }; // PNG data-URL cache (project saves)
const voxB64 = { body: null, turret: null };                                  // base64 cache of imported .vox data
let bulkLoad = false;                                                         // true while restoring a project
function flipCanvas(im, h, v) {
  const w = im.width, hh = im.height, c = document.createElement('canvas'); c.width = w; c.height = hh;
  const g = c.getContext('2d'); g.translate(h ? w : 0, v ? hh : 0); g.scale(h ? -1 : 1, v ? -1 : 1); g.drawImage(im, 0, 0); return c;
}
const state = { foot: 64, bodyLayers: 16, turretLayers: 12, az: 0, el: 30, taim: 0, turretDx: 0, turretPivot: 0, mountZ: 0, spin: false, part: 'both',
  barrelLen: 0, barrelRad: 4, barrelElev: 55, paletteN: 0, lightAz: 135, lightK: 55, zScale: 1.8, zoom: WORLD_SCALE, smooth: true, sharp: 0.6, bakeScale: 2, cls: 'ground', baseY: 24, baked: null };
let bodyFaces = null, turretFaces = null, bodyBaked = null, turretBaked = null, lastPack = null;
let voxMeta = null, voxTex = null, voxSpr = null, voxShadow = null, voxSig = '';   // orbit cube-render canvas
let gVoxMeta = null, gVoxTex = null, gVoxSpr = null, gVoxShadow = null;            // in-game inset canvas
const shadowLean = () => -Math.cos(state.lightAz * Math.PI / 180) * 0.5;   // shear away from the sun
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
  voxShadow.position.set(-Math.cos(la0) * state.foot * 0.10, state.baseY + Math.sin(la0) * state.foot * 0.06 + 1);
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
  gVoxShadow.position.set(-Math.cos(laI) * state.foot * 0.10, Math.sin(laI) * state.foot * 0.06 + 1);
  gVoxShadow.tint = 0x000000; gVoxShadow.alpha = 0.22;
  gVoxShadow.scale.set(1 / INSET_S, 0.55 / INSET_S); gVoxShadow.skew.x = shadowLean();
  gUnit.addChild(gVoxShadow);
  gVoxSpr = new PIXI.Sprite(gVoxTex); gVoxSpr.scale.set(1 / INSET_S);
  gVoxSpr.anchor.set(0.5, gVoxMeta.groundY / gVoxMeta.Hp); gVoxSpr.position.set(0, 0);
  gUnit.addChild(gVoxSpr);
  setTimeout(renderScaleChart, 0);   // model changed → refresh the side-view scale chart
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
$('pal').oninput = (e) => { state.paletteN = +e.target.value; $('palV').textContent = state.paletteN || 'full'; rebuildSlices(); };
$('zScale').oninput = (e) => { state.zScale = +e.target.value / 100; $('zScaleV').textContent = state.zScale.toFixed(2) + '×'; rebuildSlices(); };
$('smooth').onchange = (e) => { state.smooth = e.target.checked; };
$('sharp').oninput = (e) => { state.sharp = +e.target.value / 100; $('sharpV').textContent = state.sharp.toFixed(2); };
$('bakeScale').oninput = (e) => { state.bakeScale = +e.target.value; $('bakeScaleV').textContent = state.bakeScale + '×'; };
$('partSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.part = b.dataset.p; [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };
$('clsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.cls = b.dataset.c; [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };

// ── orthographic view pickers: 4 thumbnails per part; click to browse OR hover + Ctrl+V to paste ──
const VIEWS = ['top', 'side', 'front', 'back'];
document.querySelectorAll('.views').forEach((box) => {
  box.innerHTML = VIEWS.map((v) => `<div class="vslot"><label class="vpick" data-part="${box.dataset.part}" data-view="${v}"><canvas width="128" height="84"></canvas><input type="file" accept="image/*"></label><div class="vmeta"><span>${v[0].toUpperCase() + v.slice(1)}</span><span class="fl"><button type="button" class="flip keybtn" title="Tune cutout outline">✂</button><button type="button" class="flip" data-axis="h" title="Flip horizontal">⇔</button><button type="button" class="flip" data-axis="v" title="Flip vertical">⇕</button></span></div></div>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.flip'); if (!btn) return;
    e.preventDefault(); const pick = btn.closest('.vslot').querySelector('.vpick');
    if (btn.classList.contains('keybtn')) { openKeyModal(pick.dataset.part, pick.dataset.view); return; }
    toggleFlip(pick.dataset.part, pick.dataset.view, btn.dataset.axis);
  });
});
const pickFor = (part, view) => document.querySelector(`.vpick[data-part="${part}"][data-view="${view}"]`);
function setView(pick, im) {
  const part = pick.dataset.part, view = pick.dataset.view;
  voxPart[part] = null; voxB64[part] = null;                                  // photos override an imported .vox
  srcImg[part][view] = im; flipState[part][view] = { h: false, v: false };   // new image → clear flips
  keyTolState[part][view] = 75; polyState[part][view] = null;                // …and reset the cutout tuning
  imgURLCache[part][view] = null;
  renderView(pick);
}
function renderView(pick) {
  const part = pick.dataset.part, view = pick.dataset.view, src = srcImg[part][view];
  if (!src) return;
  const fl = flipState[part][view], im = (fl.h || fl.v) ? flipCanvas(src, fl.h, fl.v) : src;
  imgs[part][view] = im;
  const g = pick.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 128, 84); drawFit(g, keyedCanvas(im, keyTolState[part][view], polyState[part][view]), 128, 84);
  pick.classList.add('set'); updateFlipBtns(pick);
  if (!bulkLoad) rebuildSlices();                                             // restore rebuilds once at the end
}
function toggleFlip(part, view, axis) {
  if (!srcImg[part][view]) return;
  flipState[part][view][axis] = !flipState[part][view][axis];
  const polys = polyState[part][view], im = srcImg[part][view];              // keep the shapes on the subject
  if (polys) for (const q of polys) for (const p of q.pts) { if (axis === 'h') p[0] = im.width - 1 - p[0]; else p[1] = im.height - 1 - p[1]; }
  renderView(pickFor(part, view));
}
function updateFlipBtns(pick) {
  const fl = flipState[pick.dataset.part][pick.dataset.view], slot = pick.closest('.vslot'); if (!slot) return;
  slot.querySelector('.flip[data-axis="h"]').classList.toggle('on', fl.h);
  slot.querySelector('.flip[data-axis="v"]').classList.toggle('on', fl.v);
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
  return { put: (k, v) => op('readwrite', (s) => s.put(v, k)), get: (k) => op('readonly', (s) => s.get(k)) };
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
function snapshotProject() {
  const images = {}, vox = {};
  for (const part of ['body', 'turret']) {
    images[part] = {}; for (const v of VIEWS) images[part][v] = imgURL(part, v);
    const m = voxPart[part];
    vox[part] = m ? { nx: m.nx, ny: m.ny, nz: m.nz, b64: voxB64[part] || (voxB64[part] = b64FromU8(m.data)) } : null;
  }
  const st = { ...state }; delete st.baked;
  return { format: 'stackforge-project', version: 1, id: ($('uid').value || 'unit').trim(),
    state: st, flips: flipState, keyTol: keyTolState, polys: polyState, images, vox };
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
  set('sharp', Math.round(state.sharp * 100), state.sharp.toFixed(2)); set('bakeScale', state.bakeScale, state.bakeScale + '×');
  $('res').value = state.foot; $('smooth').checked = state.smooth; $('spin').checked = state.spin;
  [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.c === state.cls));
  [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c.dataset.p === state.part));
  rig.scale.set(state.zoom);
}
async function loadProject(p) {
  bulkLoad = true;
  try {
    $('uid').value = p.id || 'unit';
    Object.assign(state, p.state || {}); state.baked = null;
    for (const part of ['body', 'turret']) {
      const pv = p.vox && p.vox[part];
      voxPart[part] = pv ? { nx: pv.nx, ny: pv.ny, nz: pv.nz, data: u8FromB64(pv.b64) } : null;
      voxB64[part] = pv ? pv.b64 : null;
      for (const v of VIEWS) {
        flipState[part][v] = (p.flips && p.flips[part] && p.flips[part][v]) || { h: false, v: false };
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
function scheduleAutosave() { if (bulkLoad) return; clearTimeout(autosaveTimer); autosaveTimer = setTimeout(doAutosave, 800); }
async function doAutosave() {
  if (bulkLoad) { scheduleAutosave(); return; }
  try {
    const p = snapshotProject();
    await idb.put('proj:' + p.id, p); localStorage.setItem('bulwark:sf:last', p.id);
    $('projState').textContent = `Autosaved "${p.id}" · ${new Date().toLocaleTimeString()}`;
  } catch (e) { /* storage unavailable — project file still works */ }
}
document.addEventListener('input', scheduleAutosave, true);
document.addEventListener('change', scheduleAutosave, true);
document.addEventListener('click', scheduleAutosave, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) doAutosave(); });
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
function selectUnit(id) {
  $('uid').value = id;
  const m = (loadManifest().units) || {};
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
  rebuildSlices(); drawLight();
  // resume this unit's work: full WIP project when one exists, else load the saved asset pack itself
  idb.get('proj:' + id).then((p) => {
    if (p) return loadProject(p).then(() => { $('projState').textContent = `Loaded "${id}" — continue editing.`; });
    if (m[id]) return loadPackPreview(m[id]).then(() => {
      $('projState').textContent = `Loaded "${id}" baked pack (no source project on this browser — art slots empty).`;
    });
  }).catch(() => {});
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

// ── ONE-CLICK save flow: click a roster card → fresh slot offers "save the current model as this
// unit" (sprites or 3D) and the tool does the rest; a saved slot loads and you continue editing. ──
let saveAsId = null;
async function onCardClick(id) {
  let saved = !!((loadManifest().units || {})[id]);
  if (!saved) { try { saved = !!(await idb.get('proj:' + id)); } catch (e) { /* no store */ } }
  if (saved) { selectUnit(id); return; }
  saveAsId = id;
  $('saveAsTitle').textContent = id;
  $('saveAsModal').hidden = false;
}
function quickSave(id, as3D) {
  $('uid').value = id;
  if (as3D) $('embedModel').checked = true;
  doBake();                                             // current camera + bake settings
  doSaveUnit();                                         // pack → manifest, card flips to ✓
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === id));
  $('projState').textContent = `Saved "${id}" as ${as3D ? '3D (live model + baked fallback)' : 'baked sprites'} — reload the game to see it.`;
  doAutosave();                                         // park the working project under this id too
}
$('saveAsSprites').onclick = () => { $('saveAsModal').hidden = true; quickSave(saveAsId, false); };
$('saveAs3D').onclick = () => { $('saveAsModal').hidden = true; quickSave(saveAsId, true); };
$('saveAsEdit').onclick = () => {
  $('saveAsModal').hidden = true; $('uid').value = saveAsId;
  document.querySelectorAll('.ucard').forEach((c) => c.classList.toggle('sel', c.dataset.uid === saveAsId));
};
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
