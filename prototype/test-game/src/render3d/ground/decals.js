/**
 * src/render3d/ground/decals.js — terrain detail decals (prototype) [MM-story_mw2qkmb1_2].
 *
 * Owner 2026-11-04: "we can also add decals for terrain details, those draws should be very cheap since the decals get
 * reused and do not draw off screen. The decals can also fade out as the camera pulls back to full map."
 *
 * - ONE atlas drawn in code (4 × 4 cells of 128 px, 8 kinds in use): pebbles, cracks, leaf litter, flowers, clover,
 *   wheel ruts, cracked mud, twigs. No download.
 * - Placement is pure and seeded from the map (planDecals): each kind on the ground it belongs to (flowers on turf,
 *   ruts along roads, cracks on rock, leaves under trees), never on blocked cells, water or the base's 3 × 3.
 * - Drawn as one InstancedMesh per 16 × 16-cell chunk sharing one quad and one material: a 64 × 32 map is at most
 *   8 draw calls, and three's frustum test drops every chunk that is off screen (each chunk geometry carries its own
 *   bounding sphere).
 * - update(cam, aspect) fades them out as the view pulls back toward the whole map and hides the group once gone.
 *
 * Everything above buildDecals is pure (node-tested); THREE is injected.
 */
import { rng } from '../obstructions/placement.js';
import { CAMERA } from '../camera.js';

export const DECALS = Object.freeze({
  atlasCells: 4,      // atlas grid (cells per side)
  cellPx: 128,
  chunk: 16,          // cells per chunk side → one draw call each
  y: 0.012,           // height above the ground plane
  // fade: by how much of the map fills the view (1 = the whole map) and by zoom distance (portrait screens never see
  // the whole map at once, so the far end of the zoom also fades them)
  fade: Object.freeze({ cover: [0.86, 1.0], dist: [0.8, 0.97] }),
});

export const KINDS = Object.freeze(['pebbles', 'crack', 'leaves', 'flowers', 'clover', 'ruts', 'mud', 'twigs']);
const K = Object.fromEntries(KINDS.map((k, i) => [k, i]));

// ---- the atlas (pure: an RGBA byte buffer) ---------------------------------------------------------------------
function blend(img, W, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= W || y >= W || a <= 0) return;
  const o = (y * W + x) * 4, ia = img[o + 3] / 255, na = a + ia * (1 - a);
  for (let c = 0; c < 3; c++) img[o + c] = Math.round(((rgb[c] * 255) * a + img[o + c] * ia * (1 - a)) / (na || 1));
  img[o + 3] = Math.round(na * 255);
}
function disc(img, W, cx, cy, r, rgb, a = 1, soft = 1, shade = 0) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const k = Math.max(0, Math.min(1, (r - d) / soft));
    if (k <= 0) continue;
    const lit = shade ? 1 + shade * ((cy - (y + 0.5)) - (x + 0.5 - cx)) / (r * 1.4) : 1;   // lit from the top-left
    blend(img, W, x, y, rgb.map((v) => Math.max(0, Math.min(1, v * lit))), a * k);
  }
}
function ellipse(img, W, cx, cy, rx, ry, ang, rgb, a = 1) {
  const R = Math.max(rx, ry) + 1, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
    const d = Math.hypot(u, v);
    if (d < 1) blend(img, W, x, y, rgb, a * Math.min(1, (1 - d) * 4));
  }
}
function line(img, W, x0, y0, x1, y1, w, rgb, a = 1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 1;
  for (let i = 0; i <= n; i++) { const t = i / n; disc(img, W, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w * (1 - t * 0.4), rgb, a * 0.6, 0.8); }
}
/** Fade a cell's alpha to zero at its border so no decal ever shows a square edge. */
function vignette(img, W, ox, oy, S) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.max(Math.abs(x + 0.5 - S / 2), Math.abs(y + 0.5 - S / 2)) / (S / 2);
    const k = Math.max(0, Math.min(1, (1 - d) / 0.12)), o = ((oy + y) * W + ox + x) * 4;
    img[o + 3] = Math.round(img[o + 3] * k);
  }
}

/**
 * The decal atlas: { size, data } RGBA. Greyscale kinds are tinted per instance by the ground colour under them;
 * flowers and leaves carry their own colour. Deterministic.
 */
let atlasCache = null;
export function decalAtlasData() {
  if (atlasCache) return atlasCache;
  const S = DECALS.cellPx, N = DECALS.atlasCells, W = S * N, img = new Uint8Array(W * W * 4), R = rng(90210);
  const cell = (k) => [(k % N) * S, Math.floor(k / N) * S];
  const grey = (v) => [v, v, v];
  { // pebbles: a loose cluster of shaded stones with contact shadows
    const [ox, oy] = cell(K.pebbles);
    for (let i = 0; i < 9; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * S * 0.3, r = S * (0.035 + R() * 0.06);
      const x = ox + S / 2 + Math.cos(a) * d, y = oy + S / 2 + Math.sin(a) * d;
      disc(img, W, x + r * 0.3, y + r * 0.35, r * 1.1, grey(0.15), 0.45, 3);
      disc(img, W, x, y, r, grey(0.82 + R() * 0.18), 1, 1.2, 0.55);
    }
  }
  { // crack: a branching dark fissure
    const [ox, oy] = cell(K.crack);
    const walk = (x, y, ang, len, w, depth) => {
      for (let i = 0; i < len; i++) {
        const nx = x + Math.cos(ang) * 4, ny = y + Math.sin(ang) * 4;
        line(img, W, x, y, nx, ny, w, grey(0.12), 0.9);
        x = nx; y = ny; ang += (R() - 0.5) * 0.7; w *= 0.96;
        if (depth < 2 && R() < 0.12) walk(x, y, ang + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.6), (len - i) * 0.6, w * 0.7, depth + 1);
      }
    };
    walk(ox + S * 0.18, oy + S * 0.55, -0.2, 22, 2.2, 0);
  }
  { // leaves: fallen leaves, warm browns and olive
    const [ox, oy] = cell(K.leaves);
    const C = [[0.62, 0.36, 0.16], [0.74, 0.50, 0.20], [0.48, 0.40, 0.18], [0.80, 0.42, 0.20]];
    for (let i = 0; i < 16; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * S * 0.36, x = ox + S / 2 + Math.cos(a) * d, y = oy + S / 2 + Math.sin(a) * d;
      const ang = R() * 6.28, c = C[(R() * C.length) | 0];
      ellipse(img, W, x + 1.2, y + 1.5, S * 0.05, S * 0.022, ang, grey(0.1), 0.35);
      ellipse(img, W, x, y, S * 0.05, S * 0.022, ang, c, 0.95);
    }
  }
  { // flowers: a scatter of tiny blooms
    const [ox, oy] = cell(K.flowers);
    const C = [[1, 1, 0.96], [1, 0.9, 0.35], [0.95, 0.75, 0.95], [1, 1, 0.96]];
    for (let i = 0; i < 18; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * S * 0.36, x = ox + S / 2 + Math.cos(a) * d, y = oy + S / 2 + Math.sin(a) * d;
      const c = C[(R() * C.length) | 0], r = S * (0.018 + R() * 0.012);
      for (let p = 0; p < 5; p++) { const pa = p * 1.2566 + a; disc(img, W, x + Math.cos(pa) * r, y + Math.sin(pa) * r, r * 0.8, c, 1, 1); }
      disc(img, W, x, y, r * 0.6, [1, 0.78, 0.2], 1, 1);
    }
  }
  { // clover: dark lush blobs (tinted by the turf, darker)
    const [ox, oy] = cell(K.clover);
    for (let i = 0; i < 22; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * S * 0.32, x = ox + S / 2 + Math.cos(a) * d, y = oy + S / 2 + Math.sin(a) * d;
      for (let p = 0; p < 3; p++) { const pa = p * 2.094 + a; disc(img, W, x + Math.cos(pa) * 3.2, y + Math.sin(pa) * 3.2, 3.4, grey(0.55 + R() * 0.2), 0.9, 1.5, 0.3); }
    }
  }
  { // ruts: two parallel wheel tracks across the cell (laid along a road)
    const [ox, oy] = cell(K.ruts);
    for (const off of [-0.17, 0.17]) for (let x = 4; x < S - 4; x += 2) {
      const y = oy + S / 2 + S * off + Math.sin(x * 0.08) * 1.5;
      disc(img, W, ox + x, y, S * 0.045, grey(0.42), 0.5, 3);
      disc(img, W, ox + x, y - S * 0.035, 1.6, grey(0.9), 0.25, 1);   // the lip of the rut catches the light
    }
  }
  { // mud: a dried, cracked patch
    const [ox, oy] = cell(K.mud);
    disc(img, W, ox + S / 2, oy + S / 2, S * 0.34, grey(0.62), 0.55, S * 0.12);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28 + R() * 0.4, x = ox + S / 2 + Math.cos(a) * S * 0.1, y = oy + S / 2 + Math.sin(a) * S * 0.1;
      line(img, W, x, y, ox + S / 2 + Math.cos(a) * S * 0.33, oy + S / 2 + Math.sin(a) * S * 0.33, 1.2, grey(0.25), 0.8);
    }
    for (let i = 0; i < 6; i++) { const a = R() * 6.28, d = S * (0.12 + R() * 0.14); line(img, W, ox + S / 2 + Math.cos(a) * d, oy + S / 2 + Math.sin(a) * d, ox + S / 2 + Math.cos(a + 0.7) * d, oy + S / 2 + Math.sin(a + 0.7) * d, 1, grey(0.25), 0.7); }
  }
  { // twigs: thin sticks
    const [ox, oy] = cell(K.twigs);
    for (let i = 0; i < 7; i++) {
      const x = ox + S * (0.2 + R() * 0.6), y = oy + S * (0.2 + R() * 0.6), a = R() * 6.28, l = S * (0.1 + R() * 0.16);
      line(img, W, x + 1, y + 1.5, x + Math.cos(a) * l + 1, y + Math.sin(a) * l + 1.5, 1.6, grey(0.1), 0.35);
      line(img, W, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 1.5, [0.46, 0.32, 0.2], 1);
    }
  }
  for (let k = 0; k < KINDS.length; k++) { const [ox, oy] = cell(k); vignette(img, W, ox, oy, S); }
  atlasCache = { size: W, data: img };
  return atlasCache;
}

// ---- placement (pure) ------------------------------------------------------------------------------------------
// [kind, layer, chance per try, size range (cells), tint: 'ground' × k | 'own']
const RULES = [
  ['flowers', 'grass', 0.035, [0.7, 1.1], 'own'],
  ['clover', 'grass', 0.06, [0.8, 1.4], 0.82],
  ['twigs', 'grass', 0.012, [0.6, 0.9], 'own'],
  ['leaves', 'forest', 0.35, [0.8, 1.3], 'own'],
  ['twigs', 'forest', 0.12, [0.6, 1.0], 'own'],
  ['pebbles', 'soil', 0.07, [0.5, 0.9], 1.05],
  ['mud', 'soil', 0.05, [1.0, 1.6], 0.78],
  ['crack', 'rock', 0.16, [0.9, 1.5], 0.7],
  ['pebbles', 'rock', 0.1, [0.5, 0.8], 1.1],
  ['pebbles', 'sand', 0.03, [0.4, 0.7], 1.0],
  ['ruts', 'road', 0.18, [1.2, 1.6], 0.9],
];

/**
 * Which decal kinds each world grows (by palette key) [MM-story_mw2uk8lq_1]: a barren, frozen or burnt world has no
 * flowers, clover or leaves. `scale` thins a kind (0.3 = 30% as often). Unknown worlds get everything.
 */
export const WORLD_DECALS = Object.freeze({
  meadow: null, sakura: null, tropical: null, alien: null,   // lush: every kind
  savanna: { allow: ['pebbles', 'crack', 'flowers', 'ruts', 'mud', 'twigs'], scale: { flowers: 0.3 } },
  canyon: { allow: ['pebbles', 'crack', 'ruts', 'mud', 'twigs'] },
  winter: { allow: ['pebbles', 'crack', 'ruts', 'mud', 'twigs'], scale: { twigs: 0.5 } },
  volcanic: { allow: ['pebbles', 'crack', 'ruts', 'mud'] },
  lunar: { allow: ['pebbles', 'crack', 'ruts'] },
});

/**
 * Where the decals go: [{ x, z, rot, size, kind, tint: [r,g,b] }], deterministic for the map. `colAt` is the ground
 * colour sampler (lowpoly.js createGroundColour — it carries layersAt), `roadAt` the road mask sampler.
 */
export function planDecals(map, colAt, roadAt = () => 0, { seed = 7717, tries = 2, world = null } = {}) {
  const W = (world && WORLD_DECALS[world]) || null;
  const rules = W ? RULES.filter((r) => W.allow.includes(r[0])).map((r) => (W.scale && W.scale[r[0]] ? [r[0], r[1], r[2] * W.scale[r[0]], r[3], r[4]] : r)) : RULES;
  const { cols, rows } = map;
  const blocked = new Set((map.blockedCells || []).map((c) => c.y * cols + c.x));
  const base = map.base || null, R = rng(seed + ((map.seed | 0) >>> 0)), out = [];
  for (let i = 0; i < cols * rows; i++) {
    if (blocked.has(i)) continue;
    const cx = i % cols, cz = (i / cols) | 0;
    if (base && Math.abs(cx - base.x) <= 1 && Math.abs(cz - base.y) <= 1) continue;
    for (let t = 0; t < tries; t++) {
      const x = cx + 0.1 + R() * 0.8, z = cz + 0.1 + R() * 0.8, roll = R(), L = colAt.layersAt(x, z);
      if (L.water > 0.25) continue;
      const w = { grass: L.grass * (L.road > 0.2 ? 0 : 1) * (1 - Math.min(1, L.forest * 1.5)), forest: Math.min(1, L.forest * 1.3), soil: L.soil * (L.road > 0.3 ? 0.4 : 1), rock: L.rock, sand: L.sand, road: L.road > 0.4 ? 1 : 0 };
      let acc = 0, rule = null;
      for (const r of rules) { acc += r[2] * w[r[1]]; if (roll < acc) { rule = r; break; } }
      if (!rule) continue;
      const [kind, , , [s0, s1], tint] = rule;
      let rot = R() * Math.PI * 2;
      if (kind === 'ruts') {   // lay the ruts along the road: across its gradient
        const gx = roadAt(x + 0.4, z) - roadAt(x - 0.4, z), gz = roadAt(x, z + 0.4) - roadAt(x, z - 0.4);
        if (Math.hypot(gx, gz) > 1e-3) rot = Math.atan2(gz, gx) + Math.PI / 2;
      }
      const g = colAt(x, z), k = tint === 'own' ? null : tint;
      out.push({ x, z, rot, size: s0 + R() * (s1 - s0), kind: K[kind], tint: k == null ? [1, 1, 1] : g.map((v) => Math.min(1, v * k)) });
    }
  }
  return out;
}

/** Bucket decals into chunk × chunk-cell squares → Map 'cx,cz' → { cx, cz, list }. */
export function chunkDecals(list, chunk = DECALS.chunk) {
  const m = new Map();
  for (const d of list) {
    const cx = Math.floor(d.x / chunk), cz = Math.floor(d.z / chunk), k = cx + ',' + cz;
    if (!m.has(k)) m.set(k, { cx, cz, list: [] });
    m.get(k).list.push(d);
  }
  return m;
}

/**
 * How visible the decals are for a camera: 1 close in → 0 at (or near) the whole map. `cam` = { dist },
 * `aspect` = viewport w / h. Pure.
 */
export function decalFade(cam, aspect, cols, rows, F = DECALS.fade) {
  const visH = 2 * cam.dist * Math.tan((CAMERA.fovDeg * Math.PI) / 360);
  const depth = visH / Math.sin((CAMERA.pitchDeg * Math.PI) / 180);
  const cover = Math.min(1, (visH * aspect) / cols) * Math.min(1, depth / rows);
  const far = cam.dist / CAMERA.maxDist;
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  return 1 - Math.max(ss(F.cover[0], F.cover[1], cover), ss(F.dist[0], F.dist[1], far));
}

// ---- three.js --------------------------------------------------------------------------------------------------
/**
 * Build the decal group for a map. Returns { group, update(cam, aspect), stats: { decals, chunks } }.
 */
export function buildDecals(THREE, map, colAt, roadAt, { seed, world = null } = {}) {
  const list = planDecals(map, colAt, roadAt, { ...(seed != null ? { seed } : {}), world });
  const A = decalAtlasData();
  const tex = new THREE.DataTexture(A.data, A.size, A.size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  const fade = { value: 1 };
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.userData.textures = [tex];
  mat.customProgramCacheKey = () => 'ground-decals';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = fade;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = vUv * ' + (1 / DECALS.atlasCells).toFixed(4) + ' + aCell;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFade;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= uFade;');
  };
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);
  const group = new THREE.Group();
  group.name = 'ground-decals';
  // (no group.renderOrder: three sorts by the GROUP's order first, which would lift every decal over the fog at 8)
  const N = DECALS.atlasCells, C = DECALS.chunk, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color();
  let chunks = 0;
  for (const { cx, cz, list: L } of chunkDecals(list, C).values()) {
    const g = new THREE.BufferGeometry();   // shares the quad's buffers; its own bounding sphere = the chunk
    for (const k of ['position', 'normal', 'uv']) g.setAttribute(k, quad.attributes[k]);
    g.setIndex(quad.index);
    const cell = new Float32Array(L.length * 2);
    L.forEach((d, i) => { cell[i * 2] = (d.kind % N) / N; cell[i * 2 + 1] = Math.floor(d.kind / N) / N; });   // DataTexture: data row 0 = v 0
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((cx + 0.5) * C, 0, (cz + 0.5) * C), C * 0.75 + 1.5);
    const mesh = new THREE.InstancedMesh(g, mat, L.length);
    L.forEach((d, i) => {
      q.setFromAxisAngle(up, d.rot);
      m4.compose(P.set(d.x, DECALS.y, d.z), q, S.set(d.size, 1, d.size));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.setRGB(d.tint[0], d.tint[1], d.tint[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'decals-' + cx + '-' + cz;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.frustumCulled = true;   // r128 turns culling OFF for InstancedMesh; the chunk's preset sphere makes it safe
    group.add(mesh);
    chunks++;
  }
  const { cols, rows } = map;
  return {
    group,
    fade,
    update(cam, aspect) {
      fade.value = decalFade(cam, aspect || 16 / 9, cols, rows);
      group.visible = fade.value > 0.01;
      return fade.value;
    },
    stats: { decals: list.length, chunks },
  };
}

