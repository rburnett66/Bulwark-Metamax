/**
 * Stack Forge (vox-s7) — build the voxel model, orbit it as a 3D object, set the bake camera.
 *
 * Live preview = the same slice-stack the baker uses, shown interactively: azimuth yaws every layer,
 * elevation sets the per-layer rise (SP). Drag to orbit; Set camera locks (azimuth, elevation) into a
 * schema-valid unit pack. Reuses the tested camera math + pack contract; global PIXI is the vendored 7.
 *
 * The model here is a PLACEHOLDER procedural tank (base + turret) so the 3D tooling can be built and
 * felt now; artist-image ingest → real volumes is vox-s1/s3. Bake → atlases → export is vox-s3/s4.
 */
// Self-contained CLASSIC script (no ES-module imports) so it runs as a harness tab AND standalone —
// module imports die on file:// and were the "can't make it work" failure. Mirrors
// src/render/voxel/{stack,pack}.js (which the GAME runtime imports as modules); kept honest by the tests.
const FOOT = 64, LAYERS = 16, ANGLES = 64, SP_MAX = 6, MOUNT_DZ = 9, WORLD_SCALE = 3;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const elevationToSP = (elDeg, spMax = SP_MAX) => Math.max(0, Math.round(spMax * Math.cos(clamp(elDeg, 0, 90) * Math.PI / 180)));
const layerScreenY = (k, baseY, sp) => baseY - k * sp;
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

// rounded rect path helper
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ── procedural placeholder parts (front = +X). color canvas + height canvas (brighter = taller) ──
function drawBody(x, hx, f) {
  const c = f / 2;
  for (const sy of [-0.40, 0.28]) {                     // tracks
    x.fillStyle = '#28241d'; rr(x, c - f * 0.43, c + f * sy, f * 0.86, f * 0.12, 3); x.fill();
    hx.fillStyle = '#3a3a3a'; rr(hx, c - f * 0.43, c + f * sy, f * 0.86, f * 0.12, 3); hx.fill();
  }
  x.fillStyle = '#ad9d73'; rr(x, c - f * 0.42, c - f * 0.24, f * 0.84, f * 0.48, 5); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = '#c9b88d'; rr(x, c + f * 0.26, c - f * 0.24, f * 0.16, f * 0.48, 4); x.fill();   // glacis +X
  hx.fillStyle = '#8a8a8a'; rr(hx, c - f * 0.42, c - f * 0.24, f * 0.84, f * 0.48, 5); hx.fill();
}
function drawTurret(x, hx, f) {
  const c = f / 2;
  x.fillStyle = '#6f6a52'; rr(x, c + f * 0.06, c - f * 0.045, f * 0.42, f * 0.09, 3); x.fill();  // barrel +X
  hx.fillStyle = '#9a9a9a'; rr(hx, c + f * 0.06, c - f * 0.045, f * 0.42, f * 0.09, 3); hx.fill();
  x.fillStyle = '#b6a67f'; rr(x, c - f * 0.22, c - f * 0.20, f * 0.40, f * 0.40, 8); x.fill();   // turret
  x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = '#c9b88d'; x.beginPath(); x.arc(c - f * 0.04, c - f * 0.04, f * 0.07, 0, 7); x.fill();
  hx.fillStyle = '#e0e0e0'; rr(hx, c - f * 0.22, c - f * 0.20, f * 0.40, f * 0.40, 8); hx.fill();
}

// heightmap-extrude a draw fn into LAYERS slice textures (index 0 = bottom)
function makeSlices(drawFn) {
  const col = document.createElement('canvas'); col.width = col.height = FOOT;
  const hgt = document.createElement('canvas'); hgt.width = hgt.height = FOOT;
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  hx.fillStyle = '#000'; hx.fillRect(0, 0, FOOT, FOOT);
  drawFn(cx, hx, FOOT);
  const cd = cx.getImageData(0, 0, FOOT, FOOT).data, hd = hx.getImageData(0, 0, FOOT, FOOT).data;
  const N = FOOT * FOOT, height = new Float32Array(N);
  for (let i = 0; i < N; i++) height[i] = cd[i * 4 + 3] > 20 ? (hd[i * 4] / 255) * LAYERS : 0;
  const textures = [];
  for (let k = 0; k < LAYERS; k++) {
    const lc = document.createElement('canvas'); lc.width = lc.height = FOOT;
    const img = lc.getContext('2d').createImageData(FOOT, FOOT), o = img.data, t = k / (LAYERS - 1);
    for (let i = 0; i < N; i++) {
      const h = height[i];
      if (h <= k) { o[i * 4 + 3] = 0; continue; }
      const shade = h <= k + 1 ? 1.0 : lerp(0.42, 0.92, t), p = i * 4;
      o[p] = clamp(cd[p] * shade, 0, 255); o[p + 1] = clamp(cd[p + 1] * shade, 0, 255);
      o[p + 2] = clamp(cd[p + 2] * shade, 0, 255); o[p + 3] = 255;
    }
    lc.getContext('2d').putImageData(img, 0, 0);
    textures.push(PIXI.Texture.from(lc));
  }
  return textures;
}

// ── boot the tool ──
const app = new PIXI.Application({ width: 720, height: 560, backgroundColor: 0x0a121c,
  antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
$('stage').appendChild(app.view);

const rig = new PIXI.Container();
rig.scale.set(WORLD_SCALE);
rig.position.set(360, 300);   // screen centre
app.stage.addChild(rig);

// ground grid for depth reference
const grid = new PIXI.Graphics(); grid.lineStyle(1, 0x1d3040, 1);
for (let g = -120; g <= 120; g += 20) { grid.moveTo(g, -80).lineTo(g, 80); grid.moveTo(-120, g * 0.66).lineTo(120, g * 0.66); }
grid.position.set(0, 40); rig.addChild(grid);

const bodySlices = makeSlices(drawBody);
const turretSlices = makeSlices(drawTurret);
const mk = (slices) => slices.map((tex) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); rig.addChild(s); return s; });
const bodyL = mk(bodySlices);
const turretL = mk(turretSlices);

const state = { az: 0, el: 30, taim: 0, spin: false, part: 'both', baseY: 24 };

function update() {
  const sp = elevationToSP(state.el, SP_MAX);
  const azR = state.az * Math.PI / 180, taimR = state.taim * Math.PI / 180;
  const showBody = state.part !== 'turret', showTurret = state.part !== 'body';
  for (let k = 0; k < LAYERS; k++) {
    bodyL[k].visible = showBody;
    bodyL[k].position.set(0, layerScreenY(k, state.baseY, sp));
    bodyL[k].rotation = azR;
    turretL[k].visible = showTurret;
    turretL[k].position.set(0, layerScreenY(k, state.baseY, sp) - MOUNT_DZ * sp);   // rests on the hull
    turretL[k].rotation = azR + taimR;                                              // aims independently
  }
}
app.ticker.add(() => {
  if (state.spin) { state.taim = (state.taim + 1.2) % 360; $('taim').value = state.taim | 0; $('taimV').textContent = (state.taim | 0) + '°'; }
  update();
});

// ── drag to orbit (⟵⟶ azimuth · ⭡⭣ elevation) ──
let drag = null;
app.view.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el }; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  state.az = ((drag.az + (e.clientX - drag.x) * 0.6) % 360 + 360) % 360;
  state.el = clamp(drag.el - (e.clientY - drag.y) * 0.35, 0, 90);
  syncInputs();
});
function syncInputs() {
  $('az').value = state.az | 0; $('azV').textContent = (state.az | 0) + '°';
  $('el').value = state.el | 0; $('elV').textContent = (state.el | 0) + '°';
}

// ── controls ──
$('az').addEventListener('input', (e) => { state.az = +e.target.value; $('azV').textContent = state.az + '°'; });
$('el').addEventListener('input', (e) => { state.el = +e.target.value; $('elV').textContent = state.el + '°'; });
$('taim').addEventListener('input', (e) => { state.taim = +e.target.value; $('taimV').textContent = state.taim + '°'; });
$('spin').addEventListener('change', (e) => { state.spin = e.target.checked; });
$('partSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.part = b.dataset.p;
  [...$('partSeg').children].forEach((c) => c.classList.toggle('on', c === b));
});

$('setCam').addEventListener('click', () => {
  const az = state.az | 0, el = state.el | 0, sp = elevationToSP(el, SP_MAX);
  const pack = {
    id: 'placeholder-tank', class: 'ground', footprint: [FOOT, FOOT, LAYERS],
    camera: { azimuth: az, elevation: el }, layerSpacing: sp,
    parts: [
      { id: 'body', kind: 'directional', facings: 8, atlas: 'placeholder.body.png', cell: [FOOT, FOOT], pivot: [FOOT / 2, Math.round(FOOT * 0.7)], zeroFacing: '+x' },
      { id: 'turret', kind: 'stack', angles: ANGLES, atlas: 'placeholder.turret.png', cell: [FOOT, FOOT], pivot: [FOOT / 2, Math.round(FOOT * 0.7)], mount: [0, 0, MOUNT_DZ] },
    ],
    shadow: { kind: 'ellipse', rx: FOOT / 2, ry: Math.round(FOOT * 0.22), alt: 0 },
    stats: { speed: 90, turnRate: 3.0, turretRate: 4.0 },
  };
  const v = validatePack(pack);
  $('camState').innerHTML = `<span class="lock">✓ Camera set — azimuth ${az}° · elevation ${el}° · layerSpacing ${sp}</span>`;
  $('packState').innerHTML = v.ok ? '<span class="lock">Pack schema-valid ✓</span>'
    : 'Pack INVALID: ' + v.errors.join('; ');
  $('packJson').textContent = JSON.stringify(pack, null, 2);
});

syncInputs();
update();
