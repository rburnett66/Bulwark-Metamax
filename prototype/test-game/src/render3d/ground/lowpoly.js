/**
 * src/render3d/ground/lowpoly.js — the low-poly organic ground (code design §4.8 steps 3–4; plan v2.2.2 §4).
 * LP [MM-story_mv87jxp2_7]. Owner 2026-10-13: "Low poly organic is the best yet".
 *
 * A real triangulated plane at Y = 0 over the whole map: a 0.5-cell grid whose interior vertices are jittered
 * ±21% of the spacing (the border stays straight), one diagonal per quad chosen by hash, and ONE FLAT COLOUR
 * PER TRIANGLE sampled at its centroid from the map's terrain codes — rolling teal→grass→lime noise bands,
 * soft class fields (brush, forest floor, stone, lilac rock ground, dirt / sand), sand roads from the level's
 * committed road mask, and shore → foam → light → deep water bands. Each triangle's normal tilts up to ±0.08
 * so the facets catch the one sun differently. Then grass tufts: three leaning blades on open grass and
 * brush, never on roads, blocked cells or the base.
 *
 * Built from the SIM's map (terrain codes + blockedCells), like the obstructions. Deterministic: hashes and
 * a seeded mulberry32 stream, never Math.random — the same map builds the same ground, and a palette only
 * changes colours (tests pin both).
 *
 * Ported from the approved prototype (tools/terrain3d-proto body3d.html buildLowPoly). Differences: the
 * colour maths is plain arrays (no THREE.Color) so the core runs under node --test; tufts use their own seeded
 * stream instead of sharing one with the rocks and trees, so the placement differs from the prototype in
 * detail but not in kind.
 *
 * THREE is injected (no import) — see render3d/index.js. Everything above buildLowPolyGround is pure.
 */
import { rng } from '../obstructions/placement.js';
import { GRASS, createGrassGroundMaterial } from './grassDetail.js';

export const GRID = 0.5;          // vertex spacing, in cells
export const JITTER = 0.42;       // interior vertex jitter, × GRID (±21%)
export const TILT = 0.16;         // per-triangle normal tilt range (±0.08)

// terrain code → colour class (terrainGen.js codes): g grass, b brush, d dirt, w water, t trees, r rocks,
// s rock-border (stone), c cliff / cliff-border
const CLASS = { 0: 'g', 2: 'b', 7: 'b', 1: 'd', 6: 'w', 4: 't', 3: 'r', 8: 's', 5: 'c', 9: 'c' };
const TUFT_CODES = new Set([0, 2, 7]);

/** '#rrggbb' → [r, g, b] in 0..1 (what THREE.Color(hex) gives in r128 without colour management). */
export function hexRGB(h) {
  const n = typeof h === 'number' ? h : parseInt(String(h).slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const lerp3 = (a, b, t) => { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

/** The prototype's sine hash, 0..1. */
export function h2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * Sampler over the level's road mask (content/maps/baked/<slug>/road_mask.png, red channel = road weight).
 * `mask` = { width, height, data: RGBA bytes } or null (no roads). Returns (x, z) in cells → 0..1.
 */
export function roadSampler(mask, cols, rows) {
  if (!mask || !mask.data || !mask.width || !mask.height) return () => 0;
  const { width: W, height: Hh, data } = mask;
  return (x, z) => {
    const px = Math.min(W - 1, Math.max(0, ((x / cols) * W) | 0)), pz = Math.min(Hh - 1, Math.max(0, ((z / rows) * Hh) | 0));
    return data[(pz * W + px) * 4] / 255;
  };
}

/** colAt(x, z) → [r, g, b] for the map + palette (code design §4.8 step 3). */
export function createGroundColour(map, palette, roadAt = () => 0) {
  const { cols, rows } = map;
  const terrain = map.terrain || [];
  const F = {};
  for (const k of 'gbdwtrsc') F[k] = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) F[CLASS[terrain[i]] || 'g'][i] = 1;
  const field = (A, x, z) => {
    x -= 0.5; z -= 0.5;
    const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x))), z0 = Math.max(0, Math.min(rows - 1, Math.floor(z)));
    const x1 = Math.min(cols - 1, x0 + 1), z1 = Math.min(rows - 1, z0 + 1);
    const fx = Math.max(0, Math.min(1, x - x0)), fz = Math.max(0, Math.min(1, z - z0));
    return (A[z0 * cols + x0] * (1 - fx) + A[z0 * cols + x1] * fx) * (1 - fz) + (A[z1 * cols + x0] * (1 - fx) + A[z1 * cols + x1] * fx) * fz;
  };
  const P = Object.fromEntries(Object.entries(palette.ground).map(([k, v]) => [k, hexRGB(v)]));
  const colAt = (x, z) => {
    const n = vnoise(x * 0.085, z * 0.085) * 0.65 + vnoise(x * 0.21 + 9, z * 0.21 + 3) * 0.35;
    let c = n < 0.5 ? lerp3(P.teal, P.grass, (n - 0.2) / 0.3) : lerp3(P.grass, P.lime, (n - 0.5) / 0.3);   // rolling light bands
    const fb = field(F.b, x, z), ft = field(F.t, x, z), fd = field(F.d, x, z), fw = field(F.w, x, z);
    const fr = field(F.r, x, z) + field(F.c, x, z), fs = field(F.s, x, z);
    c = lerp3(c, P.brush, fb * 0.6);
    c = lerp3(c, P.forest, Math.min(1, ft * 1.3) * 0.85);
    c = lerp3(c, P.stone, fs * 0.5);
    c = lerp3(c, P.lilac, Math.min(1, fr * 1.4) * 0.8);
    if (fd > 0.32) c = lerp3(c, fd > 0.55 ? P.sand : P.dirt, ((fd - 0.32) / 0.25) * 0.9 + 0.1);
    const r = roadAt(x, z);
    if (r > 0.1) c = lerp3(c, r > 0.32 ? P.road : P.roadEdge, r > 0.32 ? 0.9 : ((r - 0.1) / 0.22) * 0.8);
    if (fw > 0.28) c = fw > 0.62 ? lerp3(P.waterL, P.waterD, (fw - 0.62) / 0.3) : fw > 0.48 ? P.foam.slice() : P.shore.slice();
    return c;
  };
  /**
   * grassAt(x, z) → 0..1: where the normal-mapped grass shows [MM-story_mven9dp1_r] — open grass only (brush, forest
   * floor, dirt, rock, stone, water and roads all push it out), in soft noise-shaped patches covering roughly half
   * the meadow.
   */
  colAt.grassAt = (x, z) => {
    const notGrass = field(F.b, x, z) * 0.8 + field(F.t, x, z) * 1.6 + field(F.d, x, z) * 2.2 + field(F.w, x, z) * 3
      + (field(F.r, x, z) + field(F.c, x, z)) * 2 + field(F.s, x, z) * 1.5 + roadAt(x, z) * 4;
    const open = Math.max(0, Math.min(1, 1 - notGrass));
    const n = vnoise(x * 0.07 + 31.7, z * 0.07 + 17.3) * 0.7 + vnoise(x * 0.19 + 5.1, z * 0.19 + 9.4) * 0.3;
    const patch = Math.max(0, Math.min(1, (n - 0.42) / 0.16));
    return open * patch * patch * (3 - 2 * patch);
  };
  return colAt;
}

/**
 * The ground triangles. Returns { position, normal, color } (Float32Arrays, non-indexed, 3 verts per
 * triangle, wound to face UP) and `triangles`.
 */
export function buildGroundArrays(map, palette, roadAt = () => 0, grid = GRID, { grass = false, tile = GRASS.tileCells } = {}) {
  const { cols, rows } = map;
  const colAt = createGroundColour(map, palette, roadAt);
  const NX = Math.round(cols / grid), NZ = Math.round(rows / grid);
  const vx = new Float64Array((NX + 1) * (NZ + 1)), vz = new Float64Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const edge = i === 0 || j === 0 || i === NX || j === NZ, k = j * (NX + 1) + i;
    vx[k] = i * grid + (edge ? 0 : (h2(i, j) - 0.5) * grid * JITTER);
    vz[k] = j * grid + (edge ? 0 : (h2(j + 0.37, i + 1.7) - 0.5) * grid * JITTER);
  }
  const tris = NX * NZ * 2;
  const position = new Float32Array(tris * 9), normal = new Float32Array(tris * 9), color = new Float32Array(tris * 9);
  // the grass detail (High / Standard): a smooth per-VERTEX mask (patch edges blend across facets) + world-space uv
  const mask = grass ? new Float32Array((NX + 1) * (NZ + 1)) : null;
  if (mask) for (let k = 0; k < mask.length; k++) mask[k] = colAt.grassAt(vx[k], vz[k]);
  const aGrass = grass ? new Float32Array(tris * 3) : null, aGUv = grass ? new Float32Array(tris * 6) : null;
  let o = 0;
  const tri = (a, b, c) => {
    const cx = (vx[a] + vx[b] + vx[c]) / 3, cz = (vz[a] + vz[b] + vz[c]) / 3;
    const k = 0.95 + h2(cx * 3.1, cz * 2.7) * 0.1, cc = colAt(cx, cz);
    const nx = (h2(cx * 1.3, cz * 5.1) - 0.5) * TILT, nz = (h2(cx * 4.7, cz * 1.9) - 0.5) * TILT, nl = Math.hypot(nx, 1, nz);
    for (const v of [a, c, b]) {        // a, c, b: counter-clockwise seen from above → the front face is up
      position[o] = vx[v]; position[o + 1] = 0; position[o + 2] = vz[v];
      normal[o] = nx / nl; normal[o + 1] = 1 / nl; normal[o + 2] = nz / nl;
      color[o] = cc[0] * k; color[o + 1] = cc[1] * k; color[o + 2] = cc[2] * k;
      if (aGrass) { const q = o / 3; aGrass[q] = mask[v]; aGUv[q * 2] = vx[v] / tile; aGUv[q * 2 + 1] = vz[v] / tile; }
      o += 3;
    }
  };
  const VI = (i, j) => j * (NX + 1) + i;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = VI(i, j), b = VI(i + 1, j), c = VI(i + 1, j + 1), d = VI(i, j + 1);
    if (h2(i * 0.7, j * 1.3) < 0.5) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  return { position, normal, color, triangles: tris, colAt, aGrass, aGUv };
}

/**
 * Where the grass tufts go: [{ x, z, base: [r,g,b], blades: [{ h, a, k }] }]. Open grass gets one tuft
 * 45% of the time, brush one or two; never on blocked cells, the base's 3×3, or a road.
 */
export function planTufts(map, palette, roadAt = () => 0, colAt = createGroundColour(map, palette, roadAt), { seed = 4321 } = {}) {
  const { cols, rows } = map;
  const terrain = map.terrain || [];
  const blocked = new Set((map.blockedCells || []).map((c) => c.y * cols + c.x));
  const base = map.base || null;
  const R = rng(seed), tuft = hexRGB(palette.tuft), out = [];
  for (let i = 0; i < cols * rows; i++) {
    const t = terrain[i];
    if (!TUFT_CODES.has(t) || blocked.has(i)) continue;
    const cx = i % cols, cz = (i / cols) | 0;
    if (base && Math.abs(cx - base.x) <= 1 && Math.abs(cz - base.y) <= 1) continue;
    const n = t === 0 ? (R() < 0.45 ? 1 : 0) : (R() < 0.8 ? 2 : 1);
    for (let k = 0; k < n; k++) {
      const x = cx + 0.1 + R() * 0.8, z = cz + 0.1 + R() * 0.8;
      const blades = [0, 1, 2].map(() => ({ h: 0.16 + R() * 0.14, a: R() * Math.PI * 2, k: 0.9 + R() * 0.3 }));
      if (roadAt(x, z) > 0.12) continue;
      const b = lerp3(colAt(x, z), tuft, 0.35).map((v) => v * 1.05);
      out.push({ x, z, base: b, blades });
    }
  }
  return out;
}

/**
 * Build the ground group for `map` with `palette` (a LOWPAL entry) and an optional road mask
 * ({ width, height, data }). `apron` = the off-map colour. `grid` (vertex spacing) and `tufts` are the quality
 * tier's ground resolution (render3d/quality.js — Low builds a 1-cell grid without tufts). Returns { group, stats }.
 */
export function buildLowPolyGround(THREE, map, palette, { roadMask = null, apron = 0x5cbf6c, grid = GRID, tufts: withTufts = true, grassDetail = false } = {}) {
  const roadAt = roadSampler(roadMask, map.cols, map.rows);
  const G = buildGroundArrays(map, palette, roadAt, grid, { grass: grassDetail });
  const group = new THREE.Group();
  group.name = 'ground';

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(G.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(G.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(G.color, 3));
  if (G.aGrass) {   // normal-mapped grass patches (High / Standard) [MM-story_mven9dp1_r]
    g.setAttribute('aGrass', new THREE.BufferAttribute(G.aGrass, 1));
    g.setAttribute('aGUv', new THREE.BufferAttribute(G.aGUv, 2));
  }
  const ground = new THREE.Mesh(g, G.aGrass ? createGrassGroundMaterial(THREE) : new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false }));
  ground.name = 'ground-lowpoly';
  ground.receiveShadow = true;
  ground.renderOrder = 0;
  group.add(ground);

  // Grass tufts: 3-sided open cones, merged; normals forced up so blades light like the grass they grow from.
  const plan = withTufts ? planTufts(map, palette, roadAt, G.colAt) : [];   // Low tier: no tufts (T3.5)
  // three's open cone emits two triangles per side, one of them zero-area at the tip: keep only the real ones
  const blade = new THREE.ConeGeometry(1, 1, 3, 1, true).toNonIndexed();
  const bp = [], src = blade.attributes.position.array;
  for (let i = 0; i < src.length; i += 9) {
    const ux = src[i + 3] - src[i], uy = src[i + 4] - src[i + 1], uz = src[i + 5] - src[i + 2];
    const vx = src[i + 6] - src[i], vy = src[i + 7] - src[i + 1], vz = src[i + 8] - src[i + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 1e-9) for (let k = 0; k < 9; k++) bp.push(src[i + k]);
  }
  const per = bp.length;
  const pos = new Float32Array(plan.length * 3 * per), col = new Float32Array(plan.length * 3 * per);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), p = new THREE.Vector3();
  let o = 0;
  for (const t of plan) for (const b of t.blades) {
    e.set(Math.cos(b.a) * 0.35, b.a, Math.sin(b.a) * 0.35); q.setFromEuler(e);
    m4.compose(V.set(t.x + Math.cos(b.a) * 0.04, b.h / 2, t.z + Math.sin(b.a) * 0.04), q, S.set(0.025, b.h, 0.025));
    for (let i = 0; i < per; i += 3) {
      p.set(bp[i], bp[i + 1], bp[i + 2]).applyMatrix4(m4);
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      col[o] = t.base[0] * b.k; col[o + 1] = t.base[1] * b.k; col[o + 2] = t.base[2] * b.k;
      o += 3;
    }
  }
  blade.dispose();
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  tg.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const tufts = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  tufts.name = 'ground-tufts';
  tufts.receiveShadow = true;
  group.add(tufts);

  // The off-map apron in the world's colour (the outside world — hills, cliffs — is story SUR).
  const ap = new THREE.PlaneGeometry(map.cols + 200, map.rows + 200);
  ap.rotateX(-Math.PI / 2);
  const apronMesh = new THREE.Mesh(ap, new THREE.MeshLambertMaterial({ color: apron, depthWrite: false }));
  apronMesh.name = 'ground-apron';
  apronMesh.position.set(map.cols / 2, -0.02, map.rows / 2);
  apronMesh.receiveShadow = true;
  apronMesh.renderOrder = -1;
  group.add(apronMesh);

  return { group, stats: { triangles: G.triangles, tufts: plan.length, bladeTriangles: (pos.length / 9) | 0, grassCover: G.aGrass ? G.aGrass.reduce((a, b) => a + b, 0) / G.aGrass.length : 0 } };
}
