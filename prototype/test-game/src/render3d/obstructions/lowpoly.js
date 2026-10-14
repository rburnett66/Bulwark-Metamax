/**
 * src/render3d/obstructions/lowpoly.js — the low-poly organic obstructions (owner: low-poly organic "the best
 * yet"; plan v2.2.2 §4; code design §4.8). T4 [MM-story_mv77hsxk_6].
 *
 * Turns placement.js's plan into TWO merged, vertex-coloured, flat-shaded meshes — all rocks (plateau boulder
 * piles, boulders, stones) and all trees — one draw call each. Both cast into and receive the static shadow
 * map. Colours come from a world palette; MEADOW is the default. The full palette set (11 worlds) and the
 * low-poly ground are story LP [MM-story_mv87jxp2_7]; the off-map world is SUR [MM-story_mv87k0nt_a].
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { planObstructions, rng } from './placement.js';

/** The prototype's Meadow palette — the subset obstructions use. LP will hold all eleven. */
export const MEADOW = Object.freeze({
  rock: ['#7f83d8', '#8a8ae2', '#7479cc', '#9194e6'], rockB: '#a3a6cf', pebble: '#b2b4d8',
  canopy: ['#e07a62', '#e8906e', '#d96b5c', '#eea07c', '#e07a62'], rare: '#d8e0ea',
  pine: ['#3f9a8a', '#2f8a7c', '#4fae94', '#3a8f78'], trunk: '#3b4fc4',
});

/** Faceted rock: an icosphere with hashed per-vertex displacement (shared vertices move together). */
function blob(THREE, detail, seed, amt) {
  const g = new THREE.IcosahedronGeometry(1, detail), a = g.attributes.position.array, cache = new Map(), r = rng(seed);
  for (let i = 0; i < a.length; i += 3) {
    const key = `${Math.round(a[i] * 1e3)},${Math.round(a[i + 1] * 1e3)},${Math.round(a[i + 2] * 1e3)}`;
    if (!cache.has(key)) cache.set(key, 1 + (r() - 0.5) * amt);
    const k = cache.get(key);
    a[i] *= k; a[i + 1] *= k; a[i + 2] *= k;
  }
  return g;
}

/** Accumulates transformed, flat-coloured triangles into one geometry (code design §4.8 Merge). */
function createMerge(THREE) {
  const p = [], c = [];
  return {
    add(geo, m4, col, jitter = 0.08) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(m4);
      const a = g.attributes.position.array;
      const r = rng((a.length * 7919 + ((a[0] * 1000) | 0)) | 0);   // per-piece facet jitter, deterministic
      for (let i = 0; i < a.length; i += 9) {
        const k = 1 + (r() - 0.5) * jitter;
        for (let v = 0; v < 3; v++) { p.push(a[i + v * 3], a[i + v * 3 + 1], a[i + v * 3 + 2]); c.push(col.r * k, col.g * k, col.b * k); }
      }
      g.dispose();
    },
    mesh(name) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      g.computeVertexNormals();   // non-indexed → face normals → the faceted look
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.name = name;
      m.castShadow = m.receiveShadow = true;
      return m;
    },
    get triangles() { return p.length / 9; },
  };
}

/**
 * Build the obstruction meshes for `map` (the sim's map) into a Group. Returns { group, stats, plan }.
 */
export function buildLowPolyObstructions(THREE, map, palette = MEADOW) {
  const plan = planObstructions(map);
  const C = (h) => new THREE.Color(h);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const xf = (x, y, z, sx, sy, sz, rx, ry, rz) => { e.set(rx, ry, rz); q.setFromEuler(e); return m4.compose(V.set(x, y, z), q, S.set(sx, sy, sz)).clone(); };

  const BLOBS = [0, 1, 2, 3, 4, 5].map((i) => blob(THREE, 1, 100 + i, 0.32));
  const SMALL = [0, 1, 2].map((i) => blob(THREE, 0, 200 + i, 0.3));
  const tone = (t, v) => t === 'rock' ? C(palette.rockB) : t === 'pebble' ? C(palette.pebble)
    : C(palette.rock[v % 4]).multiplyScalar(t === 'plateau3' ? 1.1 : t === 'plateau2' ? 1.06 : 1);

  const rocks = createMerge(THREE);
  for (const r of plan.rocks) {
    const geo = r.shape === 'small' ? SMALL[r.variant % 3] : BLOBS[r.variant % 6];
    rocks.add(geo, xf(r.x, r.y, r.z, r.sx, r.sy, r.sz, r.rx, r.ry, r.rz), tone(r.tone, r.variant), r.shape === 'small' ? 0.08 : 0.06);
  }

  const trees = createMerge(THREE);
  const trunkG = new THREE.CylinderGeometry(0.05, 0.07, 1, 5);
  const coneG = new THREE.ConeGeometry(1, 1, 6);
  const icoG = [blob(THREE, 0, 300, 0.15), blob(THREE, 1, 301, 0.12)];
  for (const t of plan.trees) {
    if (t.kind === 'round') {
      trees.add(trunkG, xf(t.x, t.h * 0.5, t.z, t.s, t.h, t.s, 0, t.ry, 0), C(palette.trunk), 0.05);
      for (const d of [-1, 1]) {
        trees.add(trunkG, xf(t.x + d * 0.12 * t.s * Math.cos(t.ry), t.h * 0.78, t.z - d * 0.12 * t.s * Math.sin(t.ry),
          t.s * 0.8, t.h * 0.45, t.s * 0.8, 0, t.ry, d * 0.6), C(palette.trunk), 0.05);
      }
      trees.add(icoG[t.variant % 2], xf(t.x, t.h + t.rc * 0.75, t.z, t.rc, t.rc * 0.95, t.rc, 0, t.ry, 0),
        C(t.rare ? palette.rare : palette.canopy[t.canopy % palette.canopy.length]), 0.1);
    } else {
      const col = C(palette.pine[t.tone % palette.pine.length]);
      trees.add(trunkG, xf(t.x, 0.15 * t.s, t.z, t.s, 0.3 * t.s, t.s, 0, t.ry, 0), C(palette.trunk), 0.05);
      for (let k = 0; k < t.n; k++) {
        const w = (0.42 - k * 0.1) * t.s, hh = t.H * (0.55 - k * 0.08);
        trees.add(coneG, xf(t.x, 0.25 * t.s + k * t.H * 0.26 + hh / 2, t.z, w, hh, w, 0, t.ry + k, 0), col.clone().multiplyScalar(1 + k * 0.08), 0.12);
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'obstructions';
  const rockMesh = rocks.mesh('obstructions-rocks');
  const treeMesh = trees.mesh('obstructions-trees');
  group.add(rockMesh, treeMesh);
  for (const g of [...BLOBS, ...SMALL, trunkG, coneG, ...icoG]) g.dispose();
  return {
    group, plan,
    stats: { rocks: plan.rocks.length, trees: plan.trees.length, triangles: rocks.triangles + trees.triangles },
  };
}
