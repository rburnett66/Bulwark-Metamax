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

// bake geometry from a unit's resolution/layers/spacing
function geom(foot, layers, sp) {
  const DIAG = Math.ceil(foot * 1.42), RTW = DIAG + 8, RTH = DIAG + (layers - 1) * sp + 8;
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

// rasterize a loaded Image / procedural fn into a foot×foot color canvas + height canvas
function partCanvases(partId, foot) {
  const col = document.createElement('canvas'); col.width = col.height = foot;
  const hgt = document.createElement('canvas'); hgt.width = hgt.height = foot;
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  hx.fillStyle = '#000'; hx.fillRect(0, 0, foot, foot);
  const src = imgs[partId];
  if (src.color) {
    cx.drawImage(src.color, 0, 0, foot, foot);
    if (src.height) hx.drawImage(src.height, 0, 0, foot, foot);
    else { // no height map → a flat slab under the silhouette (mid height)
      const d = cx.getImageData(0, 0, foot, foot).data; const im = hx.createImageData(foot, foot), o = im.data;
      for (let i = 0; i < foot * foot; i++) { const a = d[i * 4 + 3] > 20 ? 180 : 0; o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = a; o[i * 4 + 3] = 255; }
      hx.putImageData(im, 0, 0);
    }
  } else { (partId === 'turret' ? drawTurret : drawBody)(cx, hx, foot); }
  return { col, hgt };
}

// heightmap-extrude with GAME-ALIGNED directional lighting (normal · light). Returns slice textures.
function makeSlices(partId, foot, layers, lightAz, lightK) {
  const { col, hgt } = partCanvases(partId, foot);
  const cd = col.getContext('2d').getImageData(0, 0, foot, foot).data;
  const hd = hgt.getContext('2d').getImageData(0, 0, foot, foot).data;
  const N = foot * foot, H = new Float32Array(N);
  for (let i = 0; i < N; i++) H[i] = cd[i * 4 + 3] > 20 ? (hd[i * 4] / 255) * layers : 0;
  // directional light: normal from height gradient, dotted with a fixed-elevation light at lightAz
  const la = lightAz * Math.PI / 180, lz = 0.6, lx = Math.cos(la), ly = Math.sin(la);
  const ll = Math.hypot(lx, ly, lz), Lx = lx / ll, Ly = ly / ll, Lz = lz / ll, k = lightK / 100;
  const lit = new Float32Array(N);
  for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    const i = y * foot + x;
    const hxg = H[i + (x < foot - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)];
    const hyg = H[i + (y < foot - 1 ? foot : 0)] - H[i - (y > 0 ? foot : 0)];
    const nl = Math.hypot(-hxg, -hyg, 1), nx = -hxg / nl, ny = -hyg / nl, nz = 1 / nl;
    const lam = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
    lit[i] = clamp(1 - k + k * (0.5 + lam), 0.35, 1.25);   // ambient + directional
  }
  const textures = [];
  for (let kk = 0; kk < layers; kk++) {
    const lc = document.createElement('canvas'); lc.width = lc.height = foot;
    const img = lc.getContext('2d').createImageData(foot, foot), o = img.data, t = kk / Math.max(1, layers - 1);
    for (let i = 0; i < N; i++) {
      if (H[i] <= kk) { o[i * 4 + 3] = 0; continue; }
      const top = H[i] <= kk + 1;
      const shade = (top ? 1.0 : lerp(0.5, 0.95, t)) * lit[i], p = i * 4;
      o[p] = clamp(cd[p] * shade, 0, 255); o[p + 1] = clamp(cd[p + 1] * shade, 0, 255);
      o[p + 2] = clamp(cd[p + 2] * shade, 0, 255); o[p + 3] = 255;
    }
    lc.getContext('2d').putImageData(img, 0, 0);
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
  const { frames, smooth, sharp, layers, sp, g } = opts, SS = smooth ? 2 : 1, STEP = (Math.PI * 2) / frames;
  const container = new PIXI.Container(), layerSprites = [];
  for (let kk = 0; kk < layers; kk++) { const s = new PIXI.Sprite(slices[kk]); s.anchor.set(0.5); s.scale.set(SS); container.addChild(s); layerSprites.push(s); }
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
const app = new PIXI.Application({ width: 720, height: 560, backgroundColor: 0x0a121c, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
$('stage').appendChild(app.view);
const rig = new PIXI.Container(); rig.scale.set(WORLD_SCALE); rig.position.set(360, 300); app.stage.addChild(rig);
const grid = new PIXI.Graphics(); grid.lineStyle(1, 0x1d3040, 1);
for (let g = -120; g <= 120; g += 20) { grid.moveTo(g, -80).lineTo(g, 80); grid.moveTo(-120, g * 0.66).lineTo(120, g * 0.66); }
grid.position.set(0, 40); rig.addChild(grid);

const imgs = { body: { color: null, height: null }, turret: { color: null, height: null } };
const state = { foot: 64, layers: 16, az: 0, el: 30, taim: 0, spin: false, part: 'both',
  lightAz: 135, lightK: 55, smooth: true, sharp: 0.6, cls: 'ground', baseY: 24, baked: null };
let bodyL = [], turretL = [], bodyBaked = null, turretBaked = null, lastPack = null;

// (re)build the LIVE slice-stack sprites (LAYERS can change) — the orbit/camera-set preview
function rebuildSlices() {
  for (const s of bodyL) s.destroy(); for (const s of turretL) s.destroy();
  if (bodyBaked) { bodyBaked.destroy(); bodyBaked = null; } if (turretBaked) { turretBaked.destroy(); turretBaked = null; }
  state.baked = null; $('saveUnit').disabled = true; $('dlSheet').disabled = true;
  const bs = makeSlices('body', state.foot, state.layers, state.lightAz, state.lightK);
  const ts = makeSlices('turret', state.foot, state.layers, state.lightAz, state.lightK);
  const mk = (slices) => slices.map((tex) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); rig.addChild(s); return s; });
  bodyL = mk(bs); turretL = mk(ts);
}
rebuildSlices();

function update() {
  const sp = elevationToSP(state.el, SP_MAX), azR = state.az * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const showB = state.part !== 'turret', showT = state.part !== 'body', mountDz = Math.round(state.layers * 0.55);
  if (state.baked) {
    for (const s of bodyL) s.visible = false; for (const s of turretL) s.visible = false;
    const bb = bucketOf(azR, state.baked.bodyFrames), tb = bucketOf(azR + taimR, state.baked.turretFrames);
    bodyBaked.texture = state.baked.body[bb]; bodyBaked.visible = showB; bodyBaked.position.set(0, state.baseY);
    turretBaked.texture = state.baked.turret[tb]; turretBaked.visible = showT;
    turretBaked.position.set(0, state.baseY - mountDz * sp);
    return;
  }
  for (let k = 0; k < state.layers; k++) {
    bodyL[k].visible = showB; bodyL[k].position.set(0, state.baseY - k * sp); bodyL[k].rotation = azR;
    turretL[k].visible = showT; turretL[k].position.set(0, state.baseY - mountDz * sp - k * sp); turretL[k].rotation = azR + taimR;
  }
}
app.ticker.add(() => {
  if (state.spin) { state.taim = (state.taim + 1.2) % 360; $('taim').value = state.taim | 0; $('taimV').textContent = (state.taim | 0) + '°'; }
  update();
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
$('spin').onchange = (e) => { state.spin = e.target.checked; };
$('layers').oninput = (e) => { state.layers = +e.target.value; $('layersV').textContent = state.layers; rebuildSlices(); };
$('res').onchange = (e) => { state.foot = +e.target.value; rebuildSlices(); };
$('lightAz').oninput = (e) => { state.lightAz = +e.target.value; $('lightAzV').textContent = state.lightAz + '°'; rebuildSlices(); };
$('lightK').oninput = (e) => { state.lightK = +e.target.value; $('lightKV').textContent = state.lightK; rebuildSlices(); };
$('smooth').onchange = (e) => { state.smooth = e.target.checked; };
$('sharp').oninput = (e) => { state.sharp = +e.target.value / 100; $('sharpV').textContent = state.sharp.toFixed(2); };
$('partSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.part = b.dataset.p; [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };
$('clsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; state.cls = b.dataset.c; [...$('clsSeg').children].forEach((c) => c.classList.toggle('on', c === b)); };

// image loading
document.querySelectorAll('input[type=file]').forEach((inp) => inp.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return; const part = inp.dataset.part, map = inp.dataset.map;
  const im = new Image(); im.onload = () => { imgs[part][map] = im; $(`${part}-${map}-s`).textContent = '✓'; $(`${part}-${map}-s`).className = 'ok'; rebuildSlices(); };
  im.src = URL.createObjectURL(file);
}));

$('setCam').onclick = () => {
  $('camState').innerHTML = `<span class="lock">✓ Camera set — azimuth ${state.az | 0}° · elevation ${state.el | 0}° · SP ${elevationToSP(state.el | 0, SP_MAX)}</span>`;
};

// ── BAKE ──
$('bake').onclick = () => {
  const foot = state.foot, layers = state.layers, sp = elevationToSP(state.el, SP_MAX), g = geom(foot, layers, sp);
  const t0 = performance.now();
  const bs = makeSlices('body', foot, layers, state.lightAz, state.lightK);
  const ts = makeSlices('turret', foot, layers, state.lightAz, state.lightK);
  const body = bakeAngleCache(app.renderer, bs, { frames: BODY_FRAMES, smooth: false, sharp: 0, layers, sp, g });
  const turret = bakeAngleCache(app.renderer, ts, { frames: TURRET_FRAMES, smooth: state.smooth, sharp: state.sharp, layers, sp, g });
  bs.forEach((t) => t.destroy(true)); ts.forEach((t) => t.destroy(true));
  state.baked = { body, turret, bodyFrames: BODY_FRAMES, turretFrames: TURRET_FRAMES, g, sp, foot, layers };
  bodyBaked = new PIXI.Sprite(body[0]); bodyBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); rig.addChild(bodyBaked);
  turretBaked = new PIXI.Sprite(turret[0]); turretBaked.anchor.set(g.CX / g.RTW, g.BASEY / g.RTH); rig.addChild(turretBaked);
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
      { id: 'turret', kind: 'stack', angles: b.turretFrames, atlas: `${id}.turret.png`, cell: ta.cell, cols: ta.cols, pivot, mount: [0, 0, mountDz] },
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

syncInputs(); renderManifest(); update();
