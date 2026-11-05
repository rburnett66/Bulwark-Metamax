/**
 * src/render3d/ground/splat.js — the tiled terrain shader (prototype) [MM-story_mw2qkmb1_2].
 *
 * Owner 2026-11-04: "how is the texture applied .. cant it be tiled in the terrain shader for a much lower cost?"
 * → "yes prototype it".
 *
 * Instead of a painted 2048² ground per map (~3 MB a map), every planet gets ONE small tileable texture made in code
 * at load time — no download at all. Its four channels are the height (detail) of four layers:
 *   R grass · G soil (dirt, roads) · B rock (rock, stone, cliff) · A sand
 * The ground mesh carries four per-vertex layer weights from the map's own terrain codes and the road mask
 * (lowpoly.js layersAt). The fragment shader samples the texture once (Standard) or twice (High: a second rotated,
 * rescaled tap mixed in by world-space macro noise so the tile never reads as a grid), height-blends the layers
 * (taller detail wins at a seam — grass tufts poke into dirt, sand fills between stones), shades each layer between
 * a dark and a light multiplier of the vertex colour, and on High bends the normal by the blended height (two more
 * taps at the neighbouring pixels' uv: 4 reads). Low keeps the flat Lambert ground (lowpoly.js) — 0 samples.
 *
 * GPU cost: one 256² RGBA texture (256 KB + mips) per planet; 4 texture reads per ground pixel on High, 1 on Standard.
 *
 * Pure above createSplatGroundMaterial (node-tested); THREE is injected.
 */

export const SPLAT = Object.freeze({
  size: 256,          // texture side, px (power of two → mipmaps in WebGL1)
  tileCells: 3,       // one texture tile spans 3 × 3 cells
  bump: { high: 0.3, standard: 0 },
  // per-layer [dark, light] multipliers of the vertex colour: crevice → tip
  // centred on 1 so a layer keeps the palette's colour on average; the range is the layer's contrast
  shade: Object.freeze({
    grass: [[0.82, 0.86, 0.80], [1.10, 1.10, 0.98]],
    soil: [[0.84, 0.82, 0.80], [1.10, 1.08, 1.05]],
    rock: [[0.74, 0.74, 0.78], [1.16, 1.16, 1.16]],
    sand: [[0.92, 0.91, 0.89], [1.06, 1.05, 1.03]],
  }),
});

// per-world look of the layers (feature scales, seeds). Unknown worlds → meadow's.
const WORLD_SET = Object.freeze({
  meadow: { seed: 11, grassClump: 8, pebbles: 10, cracks: 5, ripple: 4 },
  sakura: { seed: 23, grassClump: 6, pebbles: 12, cracks: 6, ripple: 4 },
  savanna: { seed: 37, grassClump: 10, pebbles: 9, cracks: 4, ripple: 3 },
  canyon: { seed: 41, grassClump: 8, pebbles: 8, cracks: 4, ripple: 3 },
  winter: { seed: 53, grassClump: 6, pebbles: 12, cracks: 6, ripple: 3 },
  volcanic: { seed: 67, grassClump: 8, pebbles: 14, cracks: 7, ripple: 3 },
  lunar: { seed: 71, grassClump: 8, pebbles: 16, cracks: 6, ripple: 3 },
  alien: { seed: 89, grassClump: 7, pebbles: 11, cracks: 5, ripple: 6 },
});
export const splatSetFor = (world) => WORLD_SET[world] || WORLD_SET.meadow;

// ---- periodic noise (tiles exactly over [0,1)²) ---------------------------------------------------------------
function hash(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a, n) => ((a % n) + n) % n;
/** Value noise with an integer lattice of px × py over the unit square, wrapping. */
function pnoise(u, v, px, py, s) {
  const x = u * px, y = v * py, ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = mod(ix, px), x1 = mod(ix + 1, px), y0 = mod(iy, py), y1 = mod(iy + 1, py);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
function fbm(u, v, p, oct, s) {
  let t = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { t += pnoise(u, v, p << o, p << o, s + o * 17) * a; n += a; a *= 0.5; }
  return t / n;
}
/** Periodic Worley: distances to the nearest two feature points on a p × p wrapping grid → [f1, f2] in cell units. */
function worley(u, v, p, s) {
  const x = u * p, y = v * p, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = mod(cx, p), wy = mod(cy, p);
    const d = Math.hypot(cx + hash(wx, wy, s) - x, cy + hash(wx, wy, s + 5) - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}
const sat = (v) => Math.max(0, Math.min(1, v));
const sstep = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** The four layer heights at (u, v) ∈ [0,1)² for a world set → [grass, soil, rock, sand], each 0..1. */
export function layerHeights(u, v, W = WORLD_SET.meadow) {
  const s = W.seed;
  // grass: dense fine blades (stretched noise, two directions) over soft clumps
  const blades = 0.5 * pnoise(u, v, 40, 12, s) + 0.5 * pnoise(u, v, 12, 40, s + 3);
  const clump = fbm(u, v, W.grassClump, 3, s + 7);
  const grass = sat(0.08 + blades * 0.12 + sstep(0.3, 0.75, clump) * 0.4);   // + blade strokes (splatTextureData)
  // soil: lumpy earth + small pebbles
  const [p1] = worley(u, v, W.pebbles * 2, s + 11);
  const pebble = sstep(0.32, 0.18, p1) * (0.6 + hash(Math.floor(u * W.pebbles * 2), Math.floor(v * W.pebbles * 2), s + 13) * 0.4);
  const soil = sat(fbm(u, v, 8, 4, s + 15) * 0.75 + pebble * 0.55 - 0.08);
  // rock: plates split by dark cracks
  const [r1, r2] = worley(u, v, W.cracks, s + 19);
  const crack = sstep(0.0, 0.09, r2 - r1);
  const rock = sat((fbm(u, v, 6, 4, s + 23) * 0.6 + 0.3) * (0.55 + crack * 0.45) + (1 - r1) * 0.1);
  // sand: wind ripples bent by low noise + grain
  const warp = fbm(u, v, 3, 2, s + 29);
  const ripple = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * W.ripple + u * 2 + warp * 1.6));
  const sand = sat(ripple * 0.32 + pnoise(u, v, 64, 64, s + 31) * 0.3 + 0.22);
  return [grass, soil, rock, sand];
}

/** The planet's splat texture: { size, data: Uint8Array RGBA } (R grass, G soil, B rock, A sand). Cached per world. */
const dataCache = new Map();
export function splatTextureData(world = 'meadow', size = SPLAT.size) {
  const key = world + ':' + size;
  if (dataCache.has(key)) return dataCache.get(key);
  const W = splatSetFor(world), data = new Uint8Array(size * size * 4);
  const H = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = layerHeights(x / size, y / size, W), o = (y * size + x) * 4;
    for (let c = 0; c < 4; c++) H[o + c] = h[c];
  }
  // grass blades: short strokes rising root → tip, wrapped at the edges so the tile stays seamless
  let st = (W.seed * 2654435761) >>> 0;
  const R = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const k = size / 256, n = Math.round(2600 * k * k);
  for (let i = 0; i < n; i++) {
    const x0 = R() * size, y0 = R() * size, a = R() * Math.PI * 2, len = (5 + R() * 7) * k, top = 0.55 + R() * 0.45;
    for (let t = 0; t <= 1; t += 1 / (len * 1.5)) {
      const px = mod(Math.floor(x0 + Math.cos(a) * len * t), size), py = mod(Math.floor(y0 + Math.sin(a) * len * t), size), o = (py * size + px) * 4;
      H[o] = Math.max(H[o], H[o] * 0.4 + top * (0.35 + 0.65 * t));
    }
  }
  for (let i = 0; i < H.length; i++) data[i] = Math.round(sat(H[i]) * 255);
  const out = { size, data };
  dataCache.set(key, out);
  return out;
}

/**
 * Texture reads per ground pixel for a quality tier key. High: 2 = 4 reads (the base tap, the rotated anti-repeat tap,
 * two bump taps); Standard: 1 = 1 read (colour detail only, no bump). Low never builds this material (flat ground).
 */
export const tapsForTier = (key) => (key === 'high' ? 2 : 1);

const v3 = (a) => 'vec3(' + a.map((n) => n.toFixed(3)).join(', ') + ')';

/**
 * The ground material: Phong with vertex colours and no specular (reads like the Lambert ground it replaces), plus the
 * splat patch. Needs attributes `aSplat` (vec4 layer weights) and `aSUv` (vec2, world xz / tileCells).
 * opts: { world, taps (1 | 2), bump }.
 */
export function createSplatGroundMaterial(THREE, { world = 'meadow', taps = 2, bump = taps > 1 ? SPLAT.bump.high : SPLAT.bump.standard } = {}) {
  const t = splatTextureData(world);
  const tex = new THREE.DataTexture(t.data, t.size, t.size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, depthWrite: false, specular: 0x000000, shininess: 1 });
  mat.extensions = mat.extensions || {};
  mat.extensions.derivatives = true;
  mat.userData.splat = { tex, taps, world };
  mat.userData.textures = [tex];   // index.js disposeGroup frees these
  mat.customProgramCacheKey = () => 'ground-splat-' + taps;
  const S = SPLAT.shade;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSplat = { value: tex };
    sh.uniforms.uBump = { value: bump };
    sh.uniforms.uTile = { value: SPLAT.tileCells };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSplat;\nattribute vec2 aSUv;\nvarying vec4 vSplat;\nvarying vec2 vSUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = aSplat;\nvSUv = aSUv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
#define SPLAT_TAPS ${taps | 0}
uniform sampler2D uSplat;
uniform float uBump;
uniform float uTile;
varying vec4 vSplat;
varying vec2 vSUv;
float spHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float spNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(spHash(i), spHash(i + vec2(1.0, 0.0)), f.x), mix(spHash(i + vec2(0.0, 1.0)), spHash(i + vec2(1.0)), f.x), f.y);
}
vec3 spPerturb(vec3 pos, vec3 n, vec2 dH) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 spWorld = vSUv * uTile;
  vec4 spT = texture2D(uSplat, vSUv);
  vec4 tA0 = spT;
#if SPLAT_TAPS > 1
  float spM = smoothstep(0.3, 0.7, spNoise(spWorld * 0.11 + 3.7));
  vec4 spT2 = texture2D(uSplat, mat2(0.8, -0.6, 0.6, 0.8) * vSUv * 1.37 + vec2(0.37, 0.71));
  spT = mix(spT, spT2, spM);
#endif
  float spSum = vSplat.x + vSplat.y + vSplat.z + vSplat.w;
  vec4 spB = vSplat * (spT + 0.35);
  float spTop = max(max(spB.x, spB.y), max(spB.z, spB.w)) - 0.22;
  spB = max(spB - spTop, 0.0);
  spB /= max(spB.x + spB.y + spB.z + spB.w, 1e-4);
  vec3 spMul = spB.x * mix(${v3(S.grass[0])}, ${v3(S.grass[1])}, spT.x)
             + spB.y * mix(${v3(S.soil[0])}, ${v3(S.soil[1])}, spT.y)
             + spB.z * mix(${v3(S.rock[0])}, ${v3(S.rock[1])}, spT.z)
             + spB.w * mix(${v3(S.sand[0])}, ${v3(S.sand[1])}, spT.w);
  float spMacro = 0.93 + 0.14 * spNoise(spWorld * 0.045 + 11.3);
  diffuseColor.rgb *= mix(vec3(1.0), spMul * spMacro, clamp(spSum, 0.0, 1.0));
#if SPLAT_TAPS > 1
  // bump (High): the blended height at the neighbouring pixels' uv — two more filtered taps, like three's bumpMap
  // (a screen-space dFdx of the height alone shades in 2 × 2 blocks)
  vec2 spDx = dFdx(vSUv), spDy = dFdy(vSUv);
  float spW = clamp(spSum, 0.0, 1.0);
  float spH0 = dot(spB, spT) * spW;
  vec2 spDH = vec2(dot(spB, texture2D(uSplat, vSUv + spDx)) * spW - dot(spB, tA0) * spW,
                   dot(spB, texture2D(uSplat, vSUv + spDy)) * spW - dot(spB, tA0) * spW);
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if SPLAT_TAPS > 1
  normal = spPerturb(-vViewPosition, normal, spDH * uBump);
#endif`);
  };
  return mat;
}
