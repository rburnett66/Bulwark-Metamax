/**
 * src/render3d/ground/grassDetail.js — a normal-mapped grass surface for patches of open ground. [MM-story_mven9dp1_r]
 *
 * Owner 2026-10-18: "Can we add a normal mapped grass texture to the terrain in some areas?" — and the reference image
 * of the same day (rich, visibly bladed turf under a low sun).
 *
 * TEXTURES ARE GENERATED, NOT DOWNLOADED: a tileable 256² blade field is drawn once from a seeded stream — thousands of
 * short tapering blade strokes, wrapped across the edges so the tile repeats seamlessly. Its height gives
 *   · the NORMAL MAP (central differences, wrapped), which catches the sun blade by blade, and
 *   · the DETAIL ALBEDO, a multiplier around 1 (stored around 128): blades a touch brighter and yellower at the tips,
 *     the gaps between them darker — it modulates the ground's own vertex colour, so every world's palette still rules.
 * Deterministic (never Math.random) and pure up to grassDetailTextures(); the THREE parts take THREE injected.
 *
 * WHERE: a per-vertex mask (lowpoly.js grassAt) — open grass only, in noise-shaped patches; never roads, water, dirt,
 * rock or forest floor. The ground's Lambert (per-vertex) material becomes Phong with no specular (per-pixel diffuse)
 * on the High / Standard tiers so the normal map can light; Low keeps the flat Lambert ground (quality.js grassDetail).
 */
import { rng } from '../obstructions/placement.js';

export const GRASS = Object.freeze({
  size: 256,          // texture edge, px (power of two: mipmapped, repeat-wrapped)
  blades: 2600,       // strokes per tile
  len: [5, 13],       // blade length, px
  width: 1.6,         // blade half-width at the root, px
  bump: 2.4,          // normal-map strength (height → slope)
  tileCells: 1.6,     // one texture tile spans this many cells
  normalK: 0.9,       // how much the normal map bends the lighting where the mask is 1
  albedoK: 1.0,       // how much the detail albedo modulates the colour where the mask is 1
  seed: 9137,
});

/**
 * The blade field → { size, albedo: Uint8Array RGBA, normal: Uint8Array RGBA, height: Float32Array }. Tileable.
 */
export function grassDetailTextures(G = GRASS) {
  const N = G.size, H = new Float32Array(N * N), tint = new Float32Array(N * N);
  const R = rng(G.seed);
  const wrap = (v) => ((v % N) + N) % N;
  for (let b = 0; b < G.blades; b++) {
    const x0 = R() * N, y0 = R() * N, a = R() * Math.PI * 2, L = G.len[0] + R() * (G.len[1] - G.len[0]);
    const tall = 0.55 + R() * 0.45, hue = R();
    const dx = Math.cos(a), dy = Math.sin(a), steps = Math.ceil(L * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, w = G.width * (1 - t * 0.85), h = tall * (0.35 + 0.65 * t);   // root low + wide, tip high + thin
      const cx = x0 + dx * L * t, cy = y0 + dy * L * t, r = Math.ceil(w + 1);
      for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        const d = Math.hypot(ox + (cx % 1) - 0.5, oy + (cy % 1) - 0.5);
        if (d > w + 0.5) continue;
        const k = Math.max(0, 1 - Math.max(0, d - w + 0.5)), v = h * (0.6 + 0.4 * (1 - d / (w + 0.5))) * k;
        const i = wrap(Math.floor(cy) + oy) * N + wrap(Math.floor(cx) + ox);
        if (v > H[i]) { H[i] = v; tint[i] = hue * t; }
      }
    }
  }
  const albedo = new Uint8Array(N * N * 4), normal = new Uint8Array(N * N * 4);
  const at = (x, y) => H[wrap(y) * N + wrap(x)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, h = H[i];
    // normal from the wrapped height gradient, leaning DOWN-slope on both axes: (−∂h/∂u, −∂h/∂v, 1). The DataTexture is
    // not flipped (row = v = +world Z), so there is no GL y flip — the old flip lit relief from the mirrored sun
    // (owner 2026-10-19 "not oriented to the correct light source angle") [MM-task_mvfq860y_2]
    const sx = (at(x - 1, y) - at(x + 1, y)) * G.bump, sy = (at(x, y - 1) - at(x, y + 1)) * G.bump;
    const l = Math.hypot(sx, sy, 1);
    normal[i * 4] = Math.round(((sx / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 1] = Math.round(((sy / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 3] = 255;
    // detail albedo: 128 = ×1. Gaps ~×0.72, blade bodies ~×1.0–1.12, tips a little warmer (more red, less blue)
    const m = 0.72 + 0.42 * h, warm = tint[i] * 0.18;
    albedo[i * 4] = Math.round(Math.min(255, 128 * m * (1 + warm)));
    albedo[i * 4 + 1] = Math.round(Math.min(255, 128 * m * (1 + warm * 0.4)));
    albedo[i * 4 + 2] = Math.round(Math.min(255, 128 * m * (1 - warm * 0.6)));
    albedo[i * 4 + 3] = 255;
  }
  return { size: N, albedo, normal, height: H };
}

let cached = null;
/** Two repeat-wrapped, mipmapped DataTextures { albedo, normal } (built once per page). */
export function grassDetailTextureSet(THREE, G = GRASS) {
  if (cached && cached.THREE === THREE) return cached.set;
  const t = grassDetailTextures(G);
  const mk = (data) => {
    const tex = new THREE.DataTexture(data, t.size, t.size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
    return tex;
  };
  const set = { albedo: mk(t.albedo), normal: mk(t.normal) };
  cached = { THREE, set };
  return set;
}

/**
 * SAND / DIRT DETAIL [MM-task_mvfn5gxu_d] — owner 2026-10-19: "can we apply a bump map to the sand and ground terrain?".
 * A tileable height field of wind ripples (bent by low-frequency noise so they meander), fine grain and a scatter
 * of small pebbles; the normal map and a detail albedo (×1 around 128: ripple crests a touch lighter, troughs and
 * pebble shadows darker) come from it, as for the grass. Seeded, pure.
 */
export const SAND = Object.freeze({
  size: 256, ripples: 7, wobble: 0.9, ripple: 0.5, grain: 0.22, pebbles: 70, pebble: [1.5, 3.4],
  bump: 2.2, tileCells: 1.8, normalK: 0.75, albedoK: 0.85, seed: 5281,
});
export function sandDetailTextures(S = SAND) {
  const N = S.size, H = new Float32Array(N * N);
  const R = rng(S.seed);
  // smooth tileable noise (4×4 lattice, wrapped) for the ripple wobble
  const L = 4, lat = Array.from({ length: L * L }, R);
  const lnoise = (x, y) => {
    const fx = (x / N) * L, fy = (y / N) * L, ix = Math.floor(fx), iy = Math.floor(fy);
    let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const g = (i, j) => lat[((j % L + L) % L) * L + ((i % L + L) % L)];
    return g(ix, iy) * (1 - u) * (1 - v) + g(ix + 1, iy) * u * (1 - v) + g(ix, iy + 1) * (1 - u) * v + g(ix + 1, iy + 1) * u * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const w = lnoise(x, y);
    const ph = ((y / N) * S.ripples + w * S.wobble + (x / N) * 1.0) * Math.PI * 2;   // integer cycles → tiles
    const rip = Math.pow(0.5 + 0.5 * Math.sin(ph), 1.6);                                // sharper crests
    H[y * N + x] = rip * S.ripple + R() * S.grain;
  }
  const peb = new Float32Array(N * N);
  for (let k = 0; k < S.pebbles; k++) {
    const cx = R() * N, cy = R() * N, r = S.pebble[0] + R() * (S.pebble[1] - S.pebble[0]);
    for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++) for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) {
      const d = Math.hypot(ox, oy) / r;
      if (d > 1) continue;
      const i = (((Math.floor(cy) + oy) % N + N) % N) * N + (((Math.floor(cx) + ox) % N + N) % N);
      const h = 0.9 * Math.sqrt(1 - d * d);
      if (h > peb[i]) peb[i] = h;
    }
  }
  for (let i = 0; i < N * N; i++) H[i] = Math.max(H[i], peb[i] + 0.25 * (peb[i] > 0));
  const albedo = new Uint8Array(N * N * 4), normal = new Uint8Array(N * N * 4);
  const at = (x, y) => H[((y % N + N) % N) * N + ((x % N + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const sx = (at(x - 1, y) - at(x + 1, y)) * S.bump, sy = (at(x, y - 1) - at(x, y + 1)) * S.bump, l = Math.hypot(sx, sy, 1);   // down-slope on both axes, as the grass [MM-task_mvfq860y_2]
    normal[i * 4] = Math.round(((sx / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 1] = Math.round(((sy / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
    normal[i * 4 + 3] = 255;
    const m = peb[i] > 0 ? 0.78 + 0.25 * peb[i] : 0.86 + 0.22 * Math.min(1, H[i]);   // pebbles a little darker, crests lighter
    albedo[i * 4] = albedo[i * 4 + 1] = albedo[i * 4 + 2] = Math.round(Math.min(255, 128 * m));
    albedo[i * 4 + 3] = 255;
  }
  return { size: N, albedo, normal, height: H };
}
let sandCached = null;
export function sandDetailTextureSet(THREE, S = SAND) {
  if (sandCached && sandCached.THREE === THREE) return sandCached.set;
  const t = sandDetailTextures(S);
  const mk = (data) => {
    const tex = new THREE.DataTexture(data, t.size, t.size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
    return tex;
  };
  const set = { albedo: mk(t.albedo), normal: mk(t.normal) };
  sandCached = { THREE, set };
  return set;
}

/**
 * The ground material with the grass detail: Phong, vertex colours, no specular (per-pixel diffuse, so it reads like
 * the Lambert ground it replaces), plus a shader patch that — weighted by the per-vertex `aGrass` mask — multiplies in
 * the detail albedo and bends the normal by the normal map (a derivative tangent frame; no tangents needed).
 * Needs attributes `aGrass` (float) and `aGUv` (vec2, world xz / tileCells).
 */
export function createGrassGroundMaterial(THREE, G = GRASS, S = SAND) {
  const tex = grassDetailTextureSet(THREE, G), stex = sandDetailTextureSet(THREE, S);
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, depthWrite: false, specular: 0x000000, shininess: 1 });
  mat.extensions = mat.extensions || {};
  mat.extensions.derivatives = true;
  mat.userData.grass = { tex, G };
  mat.userData.sand = { tex: stex, S };
  mat.customProgramCacheKey = () => 'ground-grass-sand-detail';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrassAlb = { value: tex.albedo };
    sh.uniforms.uGrassNrm = { value: tex.normal };
    sh.uniforms.uGrassK = { value: G.normalK };
    sh.uniforms.uGrassA = { value: G.albedoK };
    sh.uniforms.uSandAlb = { value: stex.albedo };
    sh.uniforms.uSandNrm = { value: stex.normal };
    sh.uniforms.uSandK = { value: S.normalK };
    sh.uniforms.uSandA = { value: S.albedoK };
    sh.uniforms.uSandTile = { value: G.tileCells / S.tileCells };   // aGUv is world / grass tile → rescale for sand
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGrass;\nattribute float aSand;\nattribute vec2 aGUv;\nvarying float vGrass;\nvarying float vSand;\nvarying vec2 vGUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrass = aGrass;\nvSand = aSand;\nvGUv = aGUv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGrassAlb;\nuniform sampler2D uGrassNrm;\nuniform float uGrassK;\nuniform float uGrassA;\nuniform sampler2D uSandAlb;\nuniform sampler2D uSandNrm;\nuniform float uSandK;\nuniform float uSandA;\nuniform float uSandTile;\nvarying float vGrass;\nvarying float vSand;\nvarying vec2 vGUv;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vGrass > 0.001) diffuseColor.rgb *= mix(vec3(1.0), texture2D(uGrassAlb, vGUv).rgb * 2.0, vGrass * uGrassA);
        if (vSand > 0.001) diffuseColor.rgb *= mix(vec3(1.0), texture2D(uSandAlb, vGUv * uSandTile).rgb * 2.0, vSand * uSandA);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (vGrass > 0.001 || vSand > 0.001) {
          vec3 gn = vec3(0.0, 0.0, 1.0);
          if (vGrass > 0.001) { vec3 q = texture2D(uGrassNrm, vGUv).xyz * 2.0 - 1.0; gn.xy += q.xy * uGrassK * vGrass; }
          if (vSand > 0.001) { vec3 q = texture2D(uSandNrm, vGUv * uSandTile).xyz * 2.0 - 1.0; gn.xy += q.xy * uSandK * vSand; }
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
          vec2 st0 = dFdx(vGUv), st1 = dFdy(vGUv);
          vec3 q1perp = cross(q1, normal), q0perp = cross(normal, q0);
          vec3 T = q1perp * st0.x + q0perp * st1.x, B = q1perp * st0.y + q0perp * st1.y;
          float det = max(dot(T, T), dot(B, B));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(T * (gn.x * sc) + B * (gn.y * sc) + normal * gn.z);
        }`);
  };
  return mat;
}
