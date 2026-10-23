/**
 * src/render3d/obstructions/lowpoly.js — the low-poly organic obstructions (owner: low-poly organic "the best
 * yet"; plan v2.2.2 §4; code design §4.8). T4 [MM-story_mv77hsxk_6].
 *
 * Turns placement.js's plan into merged, vertex-coloured, flat-shaded meshes — all rocks (plateau boulder
 * piles, boulders, stones) and all trees — one draw call each; plus, per planet kit [MM-story_mvk4auz0_n], an unlit
 * glow mesh and the walkable ground cover (shapes: families.js). Both cast into and receive the static shadow
 * map. Colours come from a world palette (styles/lowpoly-palettes.js, LP); MEADOW is the default. The off-map
 * world is SUR [MM-story_mv87k0nt_a].
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { planObstructions, rng } from './placement.js';
import { LOWPAL } from '../styles/lowpoly-palettes.js';
import { DEFAULT_KIT } from '../../data/foliage.js';
import { createGeoms, createDraw, drawRock, drawTree, drawPlant } from './families.js';

/** The default world palette (all eleven live in styles/lowpoly-palettes.js — LP [MM-story_mv87jxp2_7]). */
export const MEADOW = LOWPAL.meadow;

/**
 * Accumulates transformed, flat-coloured triangles into one geometry (code design §4.8 Merge).
 * `top` = { col, ny } recolours faces whose normal points up more than ny (snow, moss, column tops).
 * `unlit`: the merge is drawn without lighting (the glow mesh), so each face is pre-shaded here by how far it
 * faces up — the facets still read, but the colour never drops into shadow.
 */
function createMerge(THREE, { unlit = false } = {}) {
  const p = [], c = [];
  return {
    add(geo, m4, col, jitter = 0.08, top = null) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(m4);
      const a = g.attributes.position.array;
      const r = rng((a.length * 7919 + ((a[0] * 1000) | 0)) | 0);   // per-piece facet jitter, deterministic
      for (let i = 0; i < a.length; i += 9) {
        let k = 1 + (r() - 0.5) * jitter, cc = col;
        if (top || unlit) {
          const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2];
          const vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = Math.hypot(nx, ny, nz) || 1;
          if (top && ny / n > top.ny) cc = top.col;
          if (unlit) k *= 0.78 + 0.22 * Math.max(0, ny / n);
        }
        for (let v = 0; v < 3; v++) { p.push(a[i + v * 3], a[i + v * 3 + 1], a[i + v * 3 + 2]); c.push(cc.r * k, cc.g * k, cc.b * k); }
      }
      g.dispose();
    },
    mesh(name, { cast = true } = {}) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      g.computeVertexNormals();   // non-indexed → face normals → the faceted look
      const m = new THREE.Mesh(g, unlit ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.name = name;
      m.castShadow = cast;
      m.receiveShadow = !unlit;
      return m;
    },
    get triangles() { return p.length / 9; },
  };
}

/**
 * Build the obstruction meshes for `map` (the sim's map) into a Group. Returns { group, stats, plan }.
 * opts.kit: the planet's prop kit (data/foliage.js key or entry) — trees, rock style and ground cover
 * [MM-story_mvk4auz0_n]; opts.roadAt keeps cover off the roads; opts.plants scales cover (0 = none).
 * Meshes: obstructions-rocks, obstructions-trees, then obstructions-glow (unlit) and obstructions-plants when non-empty.
 */
export function buildLowPolyObstructions(THREE, map, palette = MEADOW, { kit = DEFAULT_KIT, roadAt = null, plants = 1 } = {}) {
  const plan = planObstructions(map, { kit, roadAt, plants });
  const K = plan.kit, kc = K.colors || {};
  const C = (h) => new THREE.Color(h);
  const merges = { rocks: createMerge(THREE), trees: createMerge(THREE), glow: createMerge(THREE, { unlit: true }), plants: createMerge(THREE) };
  const D = createDraw(THREE, merges), G = createGeoms(THREE, rng);
  const tone = (t, v) => t === 'rock' ? C(palette.rockB) : t === 'pebble' ? C(palette.pebble)
    : C(palette.rock[v % 4]).multiplyScalar(t === 'plateau3' ? 1.1 : t === 'plateau2' ? 1.06 : 1);
  const ctx = { C, pal: palette, kc, glowSpike: !!(K.glow && K.glow.spike) };

  for (const r of plan.rocks) drawRock(D, G, r, { ...ctx, base: tone(r.tone, r.variant) });
  for (const t of plan.trees) drawTree(D, G, t, ctx);
  for (const p of plan.plants) drawPlant(D, G, p, ctx);

  const group = new THREE.Group();
  group.name = 'obstructions';
  group.add(merges.rocks.mesh('obstructions-rocks'), merges.trees.mesh('obstructions-trees'));
  if (merges.glow.triangles) group.add(merges.glow.mesh('obstructions-glow'));
  if (merges.plants.triangles) group.add(merges.plants.mesh('obstructions-plants', { cast: false }));
  G.dispose();
  return {
    group, plan,
    stats: { rocks: plan.rocks.length, trees: plan.trees.length, plants: plan.plants.length,
      triangles: merges.rocks.triangles + merges.trees.triangles + merges.glow.triangles,   // the obstruction budget (§5.3)
      plantTriangles: merges.plants.triangles, glowTriangles: merges.glow.triangles },
  };
}
