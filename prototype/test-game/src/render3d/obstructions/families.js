/**
 * src/render3d/obstructions/families.js — the SHAPES of each planet's props [MM-story_mvk4auz0_n].
 * Faction-Terrain-Design §2.4 prop kits / §5.3 prop families; the kit (which family where) is data/foliage.js.
 *
 * Owner 2026-10-22: "we need decor that matches the theme of each planet's terrain. We should also create custom
 * rocks shapes for each planet".
 *
 * Every family is low-poly, flat-shaded, vertex-coloured triangles added to one of four merges (lowpoly.js):
 *   rocks  — boulders, plateaus, stones (casts + receives shadow)
 *   trees  — the trees on blocked tree cells (casts + receives)
 *   glow   — emissive bits drawn UNLIT (§5.4): embers, crystals, mushroom caps, spire tips, bog blisters
 *   plants — walkable ground cover (receives only; low enough to sit under a tower)
 * so a planet costs at most four draw calls whatever its kit.
 *
 * THREE is injected. Pure geometry: every number comes from the planner's seeded records (placement.js).
 */

/** Faceted rock: an icosphere with hashed per-vertex displacement (shared vertices move together). */
export function blob(THREE, detail, seed, amt, rng) {
  const g = new THREE.IcosahedronGeometry(1, detail), a = g.attributes.position.array, cache = new Map(), r = rng(seed);
  for (let i = 0; i < a.length; i += 3) {
    const key = `${Math.round(a[i] * 1e3)},${Math.round(a[i + 1] * 1e3)},${Math.round(a[i + 2] * 1e3)}`;
    if (!cache.has(key)) cache.set(key, 1 + (r() - 0.5) * amt);
    const k = cache.get(key);
    a[i] *= k; a[i + 1] *= k; a[i + 2] *= k;
  }
  return g;
}

/** A copy of `geo` without its bottom cap (faces lying on y = -0.5): a column's underside is never seen. */
function dropBottom(THREE, geo) {
  const g = geo.toNonIndexed(), a = g.attributes.position.array, keep = [];
  for (let i = 0; i < a.length; i += 9) {
    if (Math.abs(a[i + 1] + 0.5) < 1e-6 && Math.abs(a[i + 4] + 0.5) < 1e-6 && Math.abs(a[i + 7] + 0.5) < 1e-6) continue;
    for (let k = 0; k < 9; k++) keep.push(a[i + k]);
  }
  geo.dispose(); g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  return out;
}

/**
 * The shared geometries one build uses; dispose() frees them. Kept lean for the §5.3 budget (rocks + trees + glow
 * ≤ ~30k triangles per map): columns and slabs lose their unseen bottoms, thin blades and sticks are open tubes.
 */
export function createGeoms(THREE, rng) {
  const G = {
    BLOBS: [0, 1, 2, 3, 4, 5].map((i) => blob(THREE, 1, 100 + i, 0.32, rng)),
    SMALL: [0, 1, 2].map((i) => blob(THREE, 0, 200 + i, 0.3, rng)),
    ico: [blob(THREE, 0, 300, 0.15, rng), blob(THREE, 1, 301, 0.12, rng)],
    shard: [0, 1, 2].map((i) => blob(THREE, 0, 400 + i, 0.75, rng)),   // Lumen: strongly displaced → angular
    trunk: new THREE.CylinderGeometry(0.05, 0.07, 1, 5),
    stick: new THREE.CylinderGeometry(1, 1, 1, 4, 1, true),           // thin branches, twigs, stalks (unit radius, open)
    cone6: new THREE.ConeGeometry(1, 1, 6),
    cone5: new THREE.ConeGeometry(1, 1, 5),
    cone4: new THREE.ConeGeometry(1, 1, 4),
    blade: new THREE.ConeGeometry(1, 1, 3, 1, true),
    hex: dropBottom(THREE, new THREE.CylinderGeometry(1, 1, 1, 6)),
    hexTube: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),          // crystal shafts (a pyramid caps them)
    hexTaper: dropBottom(THREE, new THREE.CylinderGeometry(0.82, 1, 1, 6)),
    cyl5: new THREE.CylinderGeometry(1, 1, 1, 5, 1, true),
    slab: dropBottom(THREE, new THREE.CylinderGeometry(0.93, 1, 1, 6)),
    slabSide: new THREE.CylinderGeometry(0.93, 1, 1, 6, 1, true),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 7, 1, true),
    octa: new THREE.OctahedronGeometry(1, 0),
    dome: new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2),
    tinyCap: new THREE.ConeGeometry(1, 1, 5, 1, true),
  };
  G.dispose = () => { for (const v of Object.values(G)) for (const g of [].concat(v)) if (g && g.dispose) g.dispose(); };
  return G;
}

/**
 * The drawing context the families use. `merges` = { rocks, trees, glow, plants } (lowpoly.js createMerge).
 *   put(target, geo, x, y, z, sx, sy, sz, rx, ry, rz, col, jitter?, top?)       world-space piece
 *   putIn(target, geo, B, x, y, z, sx, sy, sz, rx, ry, rz, col, jitter?, top?)  piece in a parent frame B (Matrix4)
 *   rod(target, geo, x0, y0, z0, tilt, az, len, rad, col, jitter?) → [x, y, z] end   a rod from a point along a direction
 * `top` = { col, ny }: faces whose normal points up more than `ny` take `col` (snow, moss, light column tops).
 */
export function createDraw(THREE, merges) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const xf = (x, y, z, sx, sy, sz, rx, ry, rz) => { e.set(rx, ry, rz); q.setFromEuler(e); return m4.compose(V.set(x, y, z), q, S.set(sx, sy, sz)).clone(); };
  const put = (t, geo, x, y, z, sx, sy, sz, rx, ry, rz, col, jitter = 0.08, top = null) => merges[t].add(geo, xf(x, y, z, sx, sy, sz, rx, ry, rz), col, jitter, top);
  const putIn = (t, geo, B, x, y, z, sx, sy, sz, rx, ry, rz, col, jitter = 0.08, top = null) => merges[t].add(geo, B.clone().multiply(xf(x, y, z, sx, sy, sz, rx, ry, rz)), col, jitter, top);
  const rod = (t, geo, x0, y0, z0, tilt, az, len, rad, col, jitter = 0.06) => {
    const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = -Math.sin(tilt) * Math.sin(az);
    put(t, geo, x0 + dx * len / 2, y0 + dy * len / 2, z0 + dz * len / 2, rad, len, rad, 0, az, -tilt, col, jitter);
    return [x0 + dx * len, y0 + dy * len, z0 + dz * len];
  };
  return { xf, put, putIn, rod };
}

const TAU = Math.PI * 2;
const pickOf = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

// ---------------------------------------------------------------------------------------------------- ROCKS
/**
 * Draw one rock record (placement.js) in the planet's style. c = { base (Color), C(hex), pal, kc (kit colours) }.
 * Plateau courses keep their centre height (r.y) and footprint, so a ridge still reads as one solid ridge.
 */
export function drawRock(D, G, r, c) {
  const { put, putIn, xf } = D, { base, C, kc, pal } = c;
  const style = r.style || 'boulder', small = r.shape === 'small';
  const B = xf(r.x, r.y, r.z, 1, 1, 1, 0, r.ry, 0);   // an upright frame for the built styles (no tilt: pillars stand)
  const course = r.tone === 'plateau' || r.tone === 'plateau2' || r.tone === 'plateau3';
  const boulder = (col, top = null) => put('rocks', small ? G.SMALL[r.variant % 3] : G.BLOBS[r.variant % 6], r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz, col, small ? 0.08 : 0.06, top);
  switch (style) {
    case 'mossy':   // Vexmire: boulders furred with moss on every upward face
      return boulder(base, { col: C(kc.moss || pal.tuft), ny: 0.45 });
    case 'hoodoo': {   // Ochre: banded sandstone pillars with a wider cap stone
      if (small) return boulder(base);
      const band = base.clone().multiplyScalar(1.12), cap = C(pal.rockB);
      if (course) {
        const h = r.sy * 1.9, w = r.sx * 0.95;
        putIn('rocks', G.hexTaper, B, 0, -h * 0.25, 0, w, h * 0.5, w, 0, 0, 0, base, 0.05);
        putIn('rocks', G.hexTaper, B, 0, h * 0.25, 0, w * 0.86, h * 0.5, w * 0.86, 0, 0.5, 0, band, 0.05);
        return;
      }
      const H = r.sy * 3.4, w = r.sx * 0.5, y0 = -r.y;   // stand on the ground, rise ~1.4 cells
      putIn('rocks', G.hexTaper, B, 0, y0 + H * 0.2, 0, w, H * 0.4, w, 0, 0, 0, base, 0.05);
      putIn('rocks', G.hexTaper, B, 0, y0 + H * 0.58, 0, w * 0.72, H * 0.36, w * 0.72, 0, 0.6, 0, band, 0.05);
      putIn('rocks', G.ico[0], B, 0, y0 + H * 0.8, 0, w * 1.25, H * 0.12, w * 1.25, 0, r.variant, 0, cap, 0.06);
      return;
    }
    case 'mesa': {   // Kessra: flat-topped layered slabs, alternating strata
      if (small) return boulder(base);
      const light = base.clone().multiplyScalar(1.16), dark = base.clone().multiplyScalar(0.86);
      if (course) {
        const h = r.sy * 1.8, w = r.sx * 1.05;
        putIn('rocks', G.slabSide, B, 0, -h * 0.25, 0, w, h * 0.5, w, 0, 0, 0, dark, 0.04);
        putIn('rocks', G.slab, B, 0, h * 0.25, 0, w * 0.96, h * 0.5, w * 0.96, 0, 0.45, 0, light, 0.04);
        return;
      }
      const y0 = -r.y, w = r.sx * 0.85;   // a small butte: three strata stepping in
      putIn('rocks', G.slabSide, B, 0, y0 + 0.17, 0, w, 0.34, w, 0, 0, 0, dark, 0.04);
      putIn('rocks', G.slab, B, 0, y0 + 0.47, 0, w * 0.78, 0.26, w * 0.78, 0, 0.4, 0, light, 0.04);
      putIn('rocks', G.slab, B, 0, y0 + 0.7, 0, w * 0.55, 0.2, w * 0.55, 0, 0.9, 0, base, 0.04);
      return;
    }
    case 'iceShard': {   // Rime: clusters of tilted ice blades, snow on their upper faces
      const ice = C(kc.ice || pal.ground.shore), deep = C(kc.iceDeep || pal.ground.waterL), snow = { col: C(kc.snow || '#ffffff'), ny: 0.82 };
      if (small) return put('rocks', G.octa, r.x, r.y, r.z, r.sx * 0.9, r.sy * 1.5, r.sz * 0.9, r.rx, r.ry, r.rz, ice, 0.1);
      const H = course ? r.sy * 2.1 : r.sy * 3.2, y0 = course ? -r.sy * 0.9 : -r.y, w = r.sx;
      const n = course ? 3 : 2 + (r.variant % 2);
      for (let k = 0; k < n; k++) {
        const a = r.ry + k * (TAU / n), off = k ? 0.3 * w : 0, h = H * (k ? 0.7 : 1);
        putIn('rocks', G.cone4, B, Math.cos(a) * off, y0 + h / 2, Math.sin(a) * off, w * (k ? 0.32 : 0.42), h, w * (k ? 0.32 : 0.42),
          Math.sin(a) * (k ? 0.35 : 0.08), a, Math.cos(a) * (k ? 0.35 : 0.08), k % 2 ? deep : ice, 0.12, snow);
      }
      return;
    }
    case 'basalt': {   // Cinder: hexagonal basalt columns, the tops a lighter grey
      const top = { col: base.clone().multiplyScalar(1.45), ny: 0.9 };
      if (small) return putIn('rocks', G.hex, B, 0, 0, 0, r.sx * 0.7, r.sy * 1.4, r.sx * 0.7, 0, 0, 0, base, 0.06, top);
      const Hc = course ? r.sy * 1.9 : r.sy * 2.6, y0 = course ? -r.sy * 0.95 : -r.y, w = r.sx * (course ? 0.44 : 0.36);
      const cols = 3;
      for (let k = 0; k < cols; k++) {
        const a = k * (TAU / cols) + r.variant, off = k === 0 ? 0 : w * 1.15, h = Hc * (0.62 + ((r.variant * 7 + k * 3) % 5) * 0.1);
        const tone = base.clone().multiplyScalar(0.9 + ((k * 5 + r.variant) % 3) * 0.08);
        putIn('rocks', G.hex, B, Math.cos(a) * off, y0 + h / 2, Math.sin(a) * off, w, h, w, 0, 0, 0, tone, 0.04, top);
      }
      return;
    }
    case 'shard': {   // Lumen: sharp angular shards; boulder cells lean a second blade against the first
      const geo = G.shard[r.variant % 3];
      if (small) return put('rocks', geo, r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz, base, 0.1);
      put('rocks', geo, r.x, r.y, r.z, r.sx * 1.05, r.sy * (course ? 1.1 : 1.35), r.sz * 0.9, r.rx, r.ry, r.rz, base, 0.08);
      if (!course) putIn('rocks', G.cone4, B, r.sx * 0.35, 0.1, 0, r.sx * 0.28, r.sy * 2.2, r.sx * 0.22, 0, r.variant, -0.45, C(pal.rockB), 0.1);
      return;
    }
    case 'crystalRidge': {   // Xenthe: a dark rock body bristling with glowing magenta crystals
      const glow = C(kc.crystal || pal.rock[0]);
      if (small) return put('glow', G.cone6, r.x, r.y + r.sy * 0.4, r.z, r.sx * 0.45, r.sy * 2.2, r.sx * 0.45, r.rx, r.ry, r.rz, glow, 0.15);
      const body = base.clone().multiplyScalar(0.55);
      put('rocks', G.SMALL[r.variant % 3], r.x, r.y * (course ? 1 : 0.7), r.z, r.sx, r.sy * (course ? 0.95 : 0.7), r.sz, r.rx, r.ry, r.rz, body, 0.06);
      const n = course ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const a = r.ry + k * (TAU / n) + 0.4, off = r.sx * 0.35, h = r.sy * (1.4 + (k % 2) * 0.6);
        putIn('glow', G.cone6, B, Math.cos(a) * off, r.sy * 0.35 + h * 0.4, Math.sin(a) * off, r.sx * 0.22, h, r.sx * 0.22,
          Math.sin(a) * 0.4, a, Math.cos(a) * 0.4, glow.clone().multiplyScalar(0.85 + k * 0.12), 0.12);
      }
      return;
    }
    case 'moonrock': {   // Lumen: a mixed field of grey moon rocks — rounded, angular or flat, each its own grey [MM-story_mvl774l4_p]
      const col = C(pickOf(kc.rocks || pal.rock, r.variant * 5 + (r.tone === 'pebble' ? 2 : 0))), kind = r.variant % 3;
      if (course) return put('rocks', G.BLOBS[r.variant % 6], r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz, col, 0.07);   // ridges stay solid
      if (small) return put('rocks', kind === 1 ? G.shard[r.variant % 3] : G.SMALL[r.variant % 3], r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz, col, 0.1);
      if (kind === 0) {   // a rounded, pitted boulder with a smaller stone at its foot
        put('rocks', G.BLOBS[r.variant % 6], r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz, col, 0.07);
        return putIn('rocks', G.SMALL[(r.variant + 1) % 3], B, r.sx * 0.62, -r.y + r.sy * 0.18, r.sz * 0.3, r.sx * 0.32, r.sy * 0.3, r.sx * 0.3, 0, r.variant, 0, col.clone().multiplyScalar(1.12), 0.1);
      }
      if (kind === 1) {   // an angular shard leaning on a second
        put('rocks', G.shard[r.variant % 3], r.x, r.y, r.z, r.sx, r.sy * 1.3, r.sz * 0.9, r.rx, r.ry, r.rz, col, 0.08);
        return putIn('rocks', G.shard[(r.variant + 1) % 3], B, r.sx * 0.4, 0, -r.sz * 0.2, r.sx * 0.45, r.sy * 0.9, r.sx * 0.4, 0.2, r.variant, -0.35, col.clone().multiplyScalar(0.88), 0.1);
      }
      put('rocks', G.SMALL[r.variant % 3], r.x, r.y * 0.6, r.z, r.sx * 1.25, r.sy * 0.6, r.sz * 1.15, 0, r.ry, 0, col, 0.08);   // a flat slab with a chip on top
      return putIn('rocks', G.SMALL[(r.variant + 2) % 3], B, -r.sx * 0.15, -r.y * 0.4 + r.sy * 0.55, 0, r.sx * 0.35, r.sy * 0.28, r.sx * 0.32, 0, r.variant * 2, 0, col.clone().multiplyScalar(1.15), 0.1);
    }
    default:   // 'boulder' — Verdance / Florael: the approved faceted boulder
      return boulder(base);
  }
}

// ---------------------------------------------------------------------------------------------------- TREES
/** Draw one tree record. c = { C, pal, kc, glowSpike } — colours: kit first, then the world palette. */
export function drawTree(D, G, t, c) {
  const { put, rod } = D, { C, pal, kc } = c;
  const trunkC = C(pal.trunk);
  switch (t.kind) {
    case 'broadleaf': {   // the approved Verdance tree, exactly as before
      put('trees', G.trunk, t.x, t.h * 0.5, t.z, t.s, t.h, t.s, 0, t.ry, 0, trunkC, 0.05);
      for (const d of [-1, 1]) {
        put('trees', G.trunk, t.x + d * 0.12 * t.s * Math.cos(t.ry), t.h * 0.78, t.z - d * 0.12 * t.s * Math.sin(t.ry),
          t.s * 0.8, t.h * 0.45, t.s * 0.8, 0, t.ry, d * 0.6, trunkC, 0.05);
      }
      return put('trees', G.ico[t.variant % 2], t.x, t.h + t.rc * 0.75, t.z, t.rc, t.rc * 0.95, t.rc, 0, t.ry, 0,
        C(t.rare ? pal.rare : pal.canopy[t.canopy % pal.canopy.length]), 0.1);
    }
    case 'pine': case 'snowPine': {
      const col = C(pal.pine[t.tone % pal.pine.length]), snow = C(kc.snow || '#ffffff');
      put('trees', G.trunk, t.x, 0.15 * t.s, t.z, t.s, 0.3 * t.s, t.s, 0, t.ry, 0, trunkC, 0.05);
      for (let k = 0; k < t.n; k++) {
        const w = (0.42 - k * 0.1) * t.s, hh = t.H * (0.55 - k * 0.08), y = 0.25 * t.s + k * t.H * 0.26 + hh / 2;
        put('trees', G.cone6, t.x, y, t.z, w, hh, w, 0, t.ry + k, 0, col.clone().multiplyScalar(1 + k * 0.08), 0.12);
        if (t.kind === 'snowPine') put('trees', G.cone6, t.x, y + hh * 0.2, t.z, w * 0.66, hh * 0.62, w * 0.66, 0, t.ry + k + 0.5, 0, snow, 0.05);
      }
      return;
    }
    case 'blossom': {   // Florael: a leaning trunk, two boughs, three blossom puffs
      const H = 0.75 * t.h * t.s, top = rod('trees', G.stick, t.x, 0, t.z, Math.abs(t.lean) * 0.6, t.ry, H, 0.06 * t.s, trunkC);
      const pink = (k) => C(t.rare ? pal.rare : pal.canopy[(t.tone + k) % pal.canopy.length]);
      for (let k = 0; k < 3; k++) {
        const a = t.ry + k * 2.1, end = k ? rod('trees', G.stick, top[0], top[1] - 0.05, top[2], 0.9, a, 0.26 * t.s, 0.035 * t.s, trunkC) : top;
        const rr = (k ? 0.24 : 0.32) * t.s;
        put('trees', G.ico[0], end[0], end[1] + rr * 0.5, end[2], rr, rr * 0.85, rr, 0, a, 0, pink(k), 0.12);
      }
      return;
    }
    case 'spike': {   // Kessra / Cinder: a tall bare trunk bristling with spikes (Cinder's tips glow like embers)
      const col = C(kc.spike || pal.trunk), H = 1.45 * t.h * t.s;
      const top = rod('trees', G.cone5, t.x, 0, t.z, Math.abs(t.lean) * 0.4, t.ry, H, 0.09 * t.s, col, 0.05);
      const n = 4 + t.n, ember = C(kc.ember || '#ff7a1a');
      for (let k = 0; k < n; k++) {
        const f = 0.3 + 0.6 * (k / n), x0 = t.x + (top[0] - t.x) * f, y0 = top[1] * f, z0 = t.z + (top[2] - t.z) * f;
        const end = rod('trees', G.cone4, x0, y0, z0, 0.75 + (k % 3) * 0.2, t.ry + k * 2.4, (0.5 - 0.25 * f) * t.s, 0.03 * t.s, col, 0.05);
        if (c.glowSpike) put('glow', G.octa, end[0], end[1], end[2], 0.045 * t.s, 0.06 * t.s, 0.045 * t.s, 0, k, 0, ember, 0.15);
      }
      if (c.glowSpike) put('glow', G.octa, top[0], top[1], top[2], 0.06 * t.s, 0.09 * t.s, 0.06 * t.s, 0, t.ry, 0, ember, 0.15);
      return;
    }
    case 'snag': {   // a dead, bleached, leaning trunk with two or three broken limbs
      const col = C(kc.snag || '#c8bca8'), H = 1.15 * t.h * t.s;
      const top = rod('trees', G.stick, t.x, 0, t.z, 0.1 + Math.abs(t.lean), t.ry, H, 0.075 * t.s, col, 0.05);
      for (let k = 0; k < 2 + (t.n % 2); k++) {
        const f = 0.45 + k * 0.2, x0 = t.x + (top[0] - t.x) * f, y0 = top[1] * f, z0 = t.z + (top[2] - t.z) * f;
        rod('trees', G.stick, x0, y0, z0, 0.7 + k * 0.25, t.ry + 2 + k * 2.3, (0.38 - k * 0.08) * t.s, 0.035 * t.s, col.clone().multiplyScalar(0.92));
      }
      return;
    }
    case 'cactus': {   // Ochre: a saguaro, one or two arms, a flower on the rare one
      const col = C(kc.cactus || pal.pine[0]), H = 1.2 * t.h * t.s, r = 0.12 * t.s;
      put('trees', G.cyl8, t.x, H / 2, t.z, r, H, r, 0, t.ry, 0, col, 0.06);
      put('trees', G.ico[0], t.x, H, t.z, r, r * 0.8, r, 0, t.ry, 0, col, 0.06);
      for (let k = 0; k < 1 + (t.n % 2); k++) {
        const a = t.ry + k * Math.PI, y = H * (0.42 + k * 0.12), ra = r * 0.66, arm = 0.2 * t.s, up = (0.3 + 0.08 * k) * t.s;
        const ax = t.x + Math.cos(a) * (r + arm / 2), az = t.z - Math.sin(a) * (r + arm / 2);
        put('trees', G.cyl8, ax, y, az, ra, arm, ra, 0, a, Math.PI / 2, col.clone().multiplyScalar(1.06), 0.06);
        const ex = t.x + Math.cos(a) * (r + arm), ez = t.z - Math.sin(a) * (r + arm);
        put('trees', G.cyl8, ex, y + up / 2, ez, ra, up, ra, 0, a, 0, col.clone().multiplyScalar(1.06), 0.06);
        put('trees', G.ico[0], ex, y + up, ez, ra, ra * 0.8, ra, 0, a, 0, col, 0.06);
      }
      if (t.rare) put('trees', G.octa, t.x, H + r * 0.7, t.z, 0.06 * t.s, 0.05 * t.s, 0.06 * t.s, 0, 0, 0, C(pickOf(kc.flowers || ['#f04a6a'], t.variant)), 0.1);
      return;
    }
    case 'acacia': {   // Ochre: a forked trunk under a wide flat crown
      const H = 0.95 * t.h * t.s, canopy = C(pal.canopy[t.tone % pal.canopy.length]);
      const fork = rod('trees', G.stick, t.x, 0, t.z, Math.abs(t.lean) * 0.5, t.ry, H * 0.55, 0.06 * t.s, trunkC);
      for (const d of [-1, 1]) {
        const end = rod('trees', G.stick, fork[0], fork[1], fork[2], 0.55, t.ry + (d > 0 ? 0 : Math.PI), H * 0.5, 0.04 * t.s, trunkC);
        put('trees', G.ico[0], end[0], end[1] + 0.05 * t.s, end[2], 0.42 * t.s, 0.11 * t.s, 0.36 * t.s, 0, t.ry, 0, d > 0 ? canopy : canopy.clone().multiplyScalar(0.9), 0.08);
      }
      return;
    }
    case 'iceSpire': {   // Rime: a tall ice spire with smaller blades round its foot
      const ice = C(kc.ice || '#bfe2f4'), deep = C(kc.iceDeep || '#8ec4e8'), H = 1.65 * t.h * t.s;
      put('trees', G.cone5, t.x, H / 2, t.z, 0.2 * t.s, H, 0.2 * t.s, 0, t.ry, 0, ice, 0.12);
      for (let k = 0; k < 2 + t.n; k++) {
        const a = t.ry + k * 2.2, ox = t.x + Math.cos(a) * 0.16 * t.s, oz = t.z - Math.sin(a) * 0.16 * t.s;
        rod('trees', G.cone4, ox, 0, oz, 0.3 + (k % 2) * 0.15, a, H * (0.45 - k * 0.06), 0.1 * t.s, k % 2 ? ice : deep, 0.12);
      }
      return;
    }
    case 'needleSpire': {   // Lumen: a thin grey needle of rock with a glowing tip, a smaller needle beside it
      const col = C(kc.spire || pal.rock[0]), tip = C(kc.tip || '#9af4ff'), H = 1.85 * t.h * t.s;
      const top = rod('trees', G.cone5, t.x, 0, t.z, Math.abs(t.lean) * 0.3, t.ry, H, 0.13 * t.s, col, 0.08);
      put('glow', G.octa, top[0], top[1] - 0.04 * t.s, top[2], 0.05 * t.s, 0.1 * t.s, 0.05 * t.s, 0, t.ry, 0, tip, 0.1);
      for (let k = 0; k < 1 + (t.n % 2); k++) {
        const a = t.ry + 2 + k * 2.5, ox = t.x + Math.cos(a) * 0.2 * t.s, oz = t.z - Math.sin(a) * 0.2 * t.s;
        rod('trees', G.cone5, ox, 0, oz, 0.2, a, H * 0.5, 0.08 * t.s, col.clone().multiplyScalar(0.9), 0.08);
      }
      return;
    }
    case 'crystal': {   // Lumen (cyan) / Xenthe (magenta): a glowing crystal cluster on a dark root stone
      const glow = C(kc.crystal || '#5ae0f0');
      put('trees', G.SMALL[t.variant % 3], t.x, 0.08 * t.s, t.z, 0.3 * t.s, 0.16 * t.s, 0.3 * t.s, 0, t.ry, 0, C(pal.rock[t.tone % 4]).multiplyScalar(0.6), 0.08);
      for (let k = 0; k < 3 + (t.n % 2); k++) {
        const a = t.ry + k * 2.3, tilt = k ? 0.25 + (k % 3) * 0.15 : 0.05, len = (k ? 0.8 - k * 0.1 : 1.25) * t.h * t.s, rad = (k ? 0.1 : 0.14) * t.s;
        const ox = t.x + Math.cos(a) * (k ? 0.12 : 0) * t.s, oz = t.z - Math.sin(a) * (k ? 0.12 : 0) * t.s;
        const end = rod('glow', G.hexTube, ox, 0.02, oz, tilt, a, len, rad, glow.clone().multiplyScalar(0.82 + (k % 3) * 0.1), 0.1);
        const dx = Math.sin(tilt) * Math.cos(a), dz = -Math.sin(tilt) * Math.sin(a), dy = Math.cos(tilt), ph = rad * 1.8;
        put('glow', G.cone6, end[0] + dx * ph / 2, end[1] + dy * ph / 2, end[2] + dz * ph / 2, rad, ph, rad, 0, a, -tilt, glow.clone().multiplyScalar(1.1), 0.1);
      }
      return;
    }
    case 'mushroom': {   // Xenthe: a pale stem under a glowing cap, a smaller one at its foot
      const stem = C(kc.stem || '#d8e0e8'), caps = kc.caps || pal.canopy;
      const one = (x, z, s, k) => {
        const H = 1.05 * t.h * s, top = rod('trees', G.cyl5, x, 0, z, Math.abs(t.lean) * 0.4, t.ry + k, H, 0.085 * s, stem, 0.05);
        put('trees', G.cone6, top[0], top[1] - 0.03 * s, top[2], 0.44 * s, 0.06 * s, 0.44 * s, Math.PI, t.ry, 0, stem.clone().multiplyScalar(0.7), 0.05);   // the gills
        put('glow', G.dome, top[0], top[1], top[2], 0.5 * s, 0.3 * s, 0.5 * s, 0, t.ry + k, 0, C(pickOf(caps, t.tone + k)), 0.08);
      };
      one(t.x, t.z, t.s, 0);
      for (let k = 1; k <= t.n % 2; k++) { const a = t.ry + k * 2.6; one(t.x + Math.cos(a) * 0.3 * t.s, t.z - Math.sin(a) * 0.3 * t.s, t.s * 0.42, k); }
      return;
    }
    case 'sporePod': {   // Vexmire: a fat spore pod on a short stalk, glowing blisters, a smaller pod beside it
      const pod = C(kc.pod || pal.pine[0]), stalk = C(kc.hive || pal.trunk), blister = C(kc.blister || '#d8ff4a');
      const one = (x, z, s, k) => {
        const top = rod('trees', G.stick, x, 0, z, Math.abs(t.lean) * 0.5, t.ry + k, 0.32 * s, 0.05 * s, stalk);
        const ry = 0.32 * s, h = 0.5 * s * t.h, cy = top[1] + h * 0.85;
        put('trees', G.ico[1], top[0], cy, top[2], ry, h, ry, 0, t.ry + k, 0, pod.clone().multiplyScalar(0.95 + (k % 2) * 0.1), 0.1);
        for (let b = 0; b < 3; b++) { const a = t.ry + b * 2.1 + k; put('glow', G.octa, top[0] + Math.cos(a) * ry * 0.95, cy + (b - 1) * h * 0.3, top[2] - Math.sin(a) * ry * 0.95, 0.05 * s, 0.05 * s, 0.05 * s, 0, a, 0, blister, 0.1); }
      };
      one(t.x, t.z, t.s, 0);
      if (t.n) { const a = t.ry + 2.4; one(t.x + Math.cos(a) * 0.34 * t.s, t.z - Math.sin(a) * 0.34 * t.s, t.s * 0.55, 1); }
      return;
    }
    case 'hive': {   // Vexmire: a stacked mud hive mound pocked with dark openings
      const mud = C(kc.hive || '#8a6a3a'), hole = C(kc.hiveDark || '#4a3420'), s = t.s * t.h;
      put('trees', G.ico[1], t.x, 0.3 * s, t.z, 0.55 * t.s, 0.45 * s, 0.55 * t.s, 0, t.ry, 0, mud, 0.08);
      put('trees', G.ico[0], t.x, 0.72 * s, t.z, 0.4 * t.s, 0.38 * s, 0.4 * t.s, 0, t.ry + 1, 0, mud.clone().multiplyScalar(1.08), 0.08);
      put('trees', G.cone6, t.x, 1.12 * s, t.z, 0.24 * t.s, 0.42 * s, 0.24 * t.s, 0, t.ry, 0, mud.clone().multiplyScalar(1.15), 0.08);
      for (let k = 0; k < 3; k++) {
        const a = t.ry + k * 2.1, rr = (k === 2 ? 0.4 : 0.55) * t.s, y = (k === 2 ? 0.72 : 0.3) * s;
        put('trees', G.octa, t.x + Math.cos(a) * rr * 0.92, y, t.z - Math.sin(a) * rr * 0.92, 0.04 * t.s, 0.09 * t.s, 0.08 * t.s, 0, a, 0, hole, 0.05);
      }
      return;
    }
    default:   // unknown family → a broadleaf-like puff so a typo never leaves an invisible wall
      put('trees', G.trunk, t.x, 0.4 * t.s, t.z, t.s, 0.8 * t.s, t.s, 0, t.ry || 0, 0, trunkC, 0.05);
      put('trees', G.ico[0], t.x, 0.95 * t.s, t.z, 0.45 * t.s, 0.42 * t.s, 0.45 * t.s, 0, t.ry || 0, 0, C(pal.canopy[0]), 0.1);
  }
}

// ---------------------------------------------------------------------------------------------------- COVER
/** Draw one walkable ground-cover plant (placement.js planPlants). Everything stays under ~0.45 cells tall. */
export function drawPlant(D, G, p, c) {
  const { put, rod } = D, { C, pal, kc } = c, s = p.s;
  const green = () => C(kc.shrub || pal.pine[p.variant % pal.pine.length]);
  const fan = (n, len, rad, col, t0, t1, geo = G.blade, target = 'plants') => {
    const ends = [];
    for (let k = 0; k < n; k++) {
      const tilt = t0 + (t1 - t0) * (((k * 7 + p.variant) % n) / n), az = p.ry + k * (TAU / n) + p.a;
      ends.push(rod(target, geo, p.x, 0, p.z, tilt, az, len * (0.8 + ((k + p.variant) % 3) * 0.12), rad, col.clone().multiplyScalar(0.9 + (k % 3) * 0.08), 0.08));
    }
    return ends;
  };
  switch (p.kind) {
    case 'shrub':
      return put('plants', G.ico[0], p.x, 0.12 * s, p.z, 0.22 * s, 0.17 * s, 0.22 * s, 0, p.ry, 0, green(), 0.12);
    case 'flowerBush': case 'blossomBush': {
      const bush = p.kind === 'blossomBush' ? C(pal.canopy[p.variant % pal.canopy.length]) : green();
      put('plants', G.ico[0], p.x, 0.12 * s, p.z, 0.22 * s, 0.17 * s, 0.22 * s, 0, p.ry, 0, bush, 0.12);
      const fl = kc.flowers || [pal.rare];
      for (let k = 0; k < 3; k++) {
        const a = p.ry + k * 2.1;
        put('plants', G.octa, p.x + Math.cos(a) * 0.12 * s, 0.25 * s, p.z - Math.sin(a) * 0.12 * s, 0.045 * s, 0.035 * s, 0.045 * s, 0, a, 0, C(pickOf(fl, p.variant + k)), 0.05);
      }
      return;
    }
    case 'thornscrub':
      fan(5, 0.32 * s, 0.022 * s, C(kc.thorn || pal.trunk), 0.35, 0.95);
      return;
    case 'smallCactus': {
      const col = C(kc.cactus || pal.pine[0]);
      if (p.variant % 2) {   // a barrel cactus
        put('plants', G.cyl8, p.x, 0.09 * s, p.z, 0.1 * s, 0.18 * s, 0.1 * s, 0, p.ry, 0, col, 0.06);
        put('plants', G.ico[0], p.x, 0.18 * s, p.z, 0.1 * s, 0.06 * s, 0.1 * s, 0, p.ry, 0, col.clone().multiplyScalar(1.08), 0.06);
        if (p.a < 0.4) put('plants', G.octa, p.x, 0.25 * s, p.z, 0.04 * s, 0.03 * s, 0.04 * s, 0, 0, 0, C(pickOf(kc.flowers || ['#f04a6a'], p.variant)), 0.05);
      } else {   // prickly pads
        for (let k = 0; k < 3; k++) {
          const a = p.ry + k * 2.1;
          put('plants', G.ico[0], p.x + Math.cos(a) * 0.07 * s, (0.1 + (k === 2 ? 0.12 : 0)) * s, p.z - Math.sin(a) * 0.07 * s, 0.1 * s, 0.13 * s, 0.035 * s, (k - 1) * 0.3, a, 0, col.clone().multiplyScalar(0.94 + k * 0.05), 0.06);
        }
      }
      return;
    }
    case 'twigs': case 'emberTwigs': {
      const col = C(kc.twig || pal.trunk);
      for (let k = 0; k < 3; k++) {
        const az = p.ry + k * 2.2, x0 = p.x - Math.cos(az) * 0.12 * s, z0 = p.z + Math.sin(az) * 0.12 * s;
        const end = rod('plants', G.stick, x0, 0.02, z0, 1.35 + (k % 2) * 0.12, az, (0.3 - k * 0.04) * s, 0.016 * s, col, 0.08);
        if (p.kind === 'emberTwigs' && k < 2) put('glow', G.octa, end[0], end[1] + 0.01, end[2], 0.03 * s, 0.025 * s, 0.03 * s, 0, az, 0, C(kc.ember || '#ff7a1a'), 0.15);
      }
      return;
    }
    case 'tussock':
      fan(6, 0.34 * s, 0.03 * s, C(kc.tussock || pal.tuft), 0.12, 0.6);
      return;
    case 'crystalScatter': {
      const glow = C(kc.crystal || '#5ae0f0');
      for (let k = 0; k < 2 + (p.variant % 2); k++) {
        const a = p.ry + k * 2.4, x0 = p.x + Math.cos(a) * 0.08 * s, z0 = p.z - Math.sin(a) * 0.08 * s;
        rod('glow', G.cone6, x0, 0, z0, 0.2 + k * 0.2, a, (0.2 - k * 0.04) * s, 0.04 * s, glow.clone().multiplyScalar(0.85 + k * 0.1), 0.1);
      }
      return;
    }
    case 'rubble': {   // Lumen: a scatter of small moon stones in several greys — one stone and a few chips [MM-story_mvl774l4_p]
      const tones = kc.rubble || pal.rock, n = 3 + (p.variant % 3);
      for (let k = 0; k < n; k++) {
        const a = p.ry + k * 2.39, rr = (0.04 + ((k * 0.37 + p.a) % 1) * 0.16) * s, x = p.x + Math.cos(a) * rr, z = p.z - Math.sin(a) * rr;
        const sz = (k === 0 ? 0.1 : 0.045 + ((k + p.variant) % 3) * 0.02) * s;
        put('plants', k === 0 ? G.SMALL[p.variant % 3] : G.octa, x, sz * 0.45, z, sz * 1.2, sz * 0.75, sz, 0.2 * k, a, 0, C(pickOf(tones, p.variant + k)), 0.1);
      }
      return;
    }
    case 'sprouts': {
      const col = C(kc.sprout || pal.tuft), tip = C(kc.tip || '#b8fff0');
      for (const end of fan(4, 0.26 * s, 0.012 * s, col, 0.08, 0.5, G.stick)) put('glow', G.octa, end[0], end[1], end[2], 0.028 * s, 0.035 * s, 0.028 * s, 0, 0, 0, tip, 0.1);
      return;
    }
    case 'toadstools': {
      const stem = C(kc.stem || '#d8e0e8'), caps = kc.caps || pal.canopy;
      for (let k = 0; k < 2 + (p.variant % 2); k++) {
        const a = p.ry + k * 2.3, x = p.x + Math.cos(a) * 0.09 * s, z = p.z - Math.sin(a) * 0.09 * s, h = (0.12 - k * 0.025) * s;
        put('plants', G.stick, x, h / 2, z, 0.018 * s, h, 0.018 * s, 0, a, 0, stem, 0.05);
        put('glow', G.tinyCap, x, h + 0.02 * s, z, 0.07 * s, 0.045 * s, 0.07 * s, 0, a, 0, C(pickOf(caps, p.variant + k)), 0.08);
      }
      return;
    }
    case 'reeds': {
      const ends = fan(6, 0.42 * s, 0.022 * s, C(kc.reed || pal.tuft), 0.05, 0.35);
      for (let k = 0; k < 2; k++) put('plants', G.stick, ends[k][0], ends[k][1] - 0.03 * s, ends[k][2], 0.024 * s, 0.08 * s, 0.024 * s, 0, 0, 0, C(kc.cattail || pal.trunk), 0.05);
      return;
    }
    default:
      return put('plants', G.ico[0], p.x, 0.1 * s, p.z, 0.18 * s, 0.14 * s, 0.18 * s, 0, p.ry, 0, green(), 0.12);
  }
}
