/**
 * src/render3d/overlays/fog.js — the play-area fog: a VIGNETTE around the current window. [MM-story_mveehs1r_f]
 * (Built as the ring fog, plan v2.2 §6.5 [MM-task_mv9s9o5d_3]; reshaped by docs/tech-plan/3D-Combat-Polish.md §9.)
 *
 * Owner 2026-10-18: "draw the map 5 cells beyond the actual focus play area, but I want a darkened fog" —
 * "Darkened area similar to a vignette effect." One large ground-level quad drawn after the scene (no depth
 * test): the ground point under each pixel is clear inside the window, darkens smoothly over FOG_MARGIN cells
 * outside it, and is fully dark beyond — so the map visibly ends FOG_MARGIN cells past the play area. No hard
 * outline. When the window grows, the band that just opened flashes and fades.
 *
 * A screen-space veil over the ground point under each pixel, so a tall object at the edge is veiled by the
 * ground behind it. THREE is passed in (no import) — see index.js. fogAlpha() is the shader's curve in JS (tests).
 */

/** Cells of vignette outside the play area; past it everything is dark. */
export const FOG_MARGIN = 5;
/** Veil opacity at signed distance d (cells; > 0 outside the window): 0 inside, smoothstep to 1 at FOG_MARGIN. */
export function fogAlpha(d, margin = FOG_MARGIN) {
  if (d <= 0) return 0;
  const t = Math.min(1, d / margin);
  return t * t * (3 - 2 * t);
}

const VEIL = 0x020304, FLASH = 0x9fe8ff;
const EXTENT = 400;   // cells past the map on every side — beyond the horizon at the farthest zoom

/**
 * CLOUD FOG [MM-story_mvfk3el9_b] — owner 2026-10-19: "a cheap cloud shader … a dimensional fog of war instead of the
 * black", "the black area is fine but the clouds should fill in the sides", "in the biggest view there should still be
 * a cloud effect on the edges". Past the play area a bank of drifting, sun-lit cloud thickens from scattered wisps at
 * the window edge to full cover by CLOUD.full cells out; past CLOUD.dark the bank fades into the dark veil. With the
 * whole board open the bank rings the MAP edge instead, so the world never ends in bare clear colour.
 *
 * CHEAP: still ONE quad, one draw call; a 128² tileable value-noise texture (built once, fbm baked in) sampled at two
 * drifting scales, plus one offset tap toward the sun for the lit / shadowed sides — four texture reads a pixel.
 */
export const CLOUD = Object.freeze({
  full: 5.0,     // cells outside the window where the cover is complete
  dark: 8.0,     // cells out where the bank starts sinking into the veil (ragged by the noise)…
  black: 14,     // …and is fully dark
  scale: 0.085,  // noise cycles per cell (big billows)
  drift: Object.freeze([0.18, 0.07]),   // cells / s the bank drifts
  lit: Object.freeze([0.86, 0.89, 0.94]), shade: Object.freeze([0.36, 0.41, 0.52]),
  noise: 128,
});
/** JS twin of the shader's cloud cover bias at d cells outside the window (tests): −0.45 at the edge → +0.55 at full. */
export function cloudBias(d, C = CLOUD) {
  if (d < -0.25) return -1;   // inside the play area: no cloud
  const t = Math.max(0, Math.min(1, d / C.full));
  return -0.45 + t * t * (3 - 2 * t);
}
/** JS twin of the veil share at d (0 → 1 between CLOUD.dark and CLOUD.black). */
export function cloudDark(d, C = CLOUD) {
  const t = Math.max(0, Math.min(1, (d - C.dark) / (C.black - C.dark)));
  return t * t * (3 - 2 * t);
}

/** A tileable N² value-noise texture with 4 octaves baked in (seeded, never Math.random). RGBA, value in every channel. */
export function cloudNoisePixels(N = CLOUD.noise, seed = 4177) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = new Float32Array(N * N);
  let amp = 1, tot = 0;
  for (const cells of [4, 8, 16, 32]) {
    const g = Array.from({ length: cells * cells }, rnd);
    const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const n = at(ix, iy) * (1 - u) * (1 - v) + at(ix + 1, iy) * u * (1 - v) + at(ix, iy + 1) * (1 - u) * v + at(ix + 1, iy + 1) * u * v;
      out[y * N + x] += n * amp;
    }
    tot += amp; amp *= 0.5;
  }
  const px = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const v = Math.round((out[i] / tot) * 255); px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  return px;
}

const VERT = /* glsl */`
varying vec2 vXZ;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vXZ = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform vec4 uRect;     // world x0, z0, x1, z1 (cell edges) — the play window, or the map when the board is open
uniform vec4 uPrev;     // the window before the last growth
uniform float uFlash, uTime;
uniform vec3 uVeil, uFlashCol, uLit, uShade;
uniform vec2 uDrift, uSun;   // drift (cells/s); the sun's ground direction (for the lit side)
uniform vec4 uCloud;    // full, dark, black, scale
uniform sampler2D uNoise;
varying vec2 vXZ;
float inside(vec4 r, vec2 p) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
float clouds(vec2 p) {
  vec2 q = p * uCloud.w;
  return texture2D(uNoise, q + uDrift * uCloud.w * uTime).r * 0.65 + texture2D(uNoise, q * 2.3 - uDrift.yx * uCloud.w * uTime * 1.7 + 0.37).r * 0.35;
}
void main() {
  // signed distance (cells) from the window edge: > 0 outside
  vec2 d2 = max(uRect.xy - vXZ, vXZ - uRect.zw);
  float d = max(d2.x, d2.y);
  float flash = uFlash * inside(uRect, vXZ) * (1.0 - inside(uPrev, vXZ));
  if (d < -0.25 && flash < 0.002) discard;
  // cloud cover: noise above a threshold that falls as we go out (wisps at the edge → full bank)
  float t = clamp(d / uCloud.x, 0.0, 1.0);
  float bias = d < -0.25 ? -1.0 : -0.45 + t * t * (3.0 - 2.0 * t);
  float n = clouds(vXZ);
  float cover = smoothstep(0.36, 0.66, n + bias);
  // lit / shadowed: compare with a tap toward the sun — denser toward the sun = this side faces away
  float ns = clouds(vXZ + uSun * 1.6);
  float lit = clamp(0.55 + (n - ns) * 4.0, 0.0, 1.0);
  vec3 cloud = mix(uShade, uLit, lit) * (0.82 + 0.18 * smoothstep(0.4, 0.8, n));   // thicker billows catch more light
  // far out: the bank sinks into the dark veil
  float k = clamp((d - uCloud.y + (n - 0.5) * 6.0) / (uCloud.z - uCloud.y), 0.0, 1.0);   // a ragged far edge, not a box
  float far = k * k * (3.0 - 2.0 * k);
  vec3 col = mix(cloud, uVeil, far);
  float a = max(cover * 0.94, far);
  col = mix(col, uFlashCol, flash / max(a + flash, 1e-4));
  a = a + flash * (1.0 - a);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col, a);
}`;

let noiseTex = null;
function cloudNoise(THREE) {
  if (!noiseTex) {
    noiseTex = new THREE.DataTexture(cloudNoisePixels(), CLOUD.noise, CLOUD.noise, THREE.RGBAFormat);
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.magFilter = THREE.LinearFilter; noiseTex.minFilter = THREE.LinearFilter;
    noiseTex.needsUpdate = true;
  }
  return noiseTex;
}

export function createFogView(THREE, scene, map) {
  const geo = new THREE.PlaneGeometry(map.cols + EXTENT * 2, map.rows + EXTENT * 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.cols / 2, 0, map.rows / 2);
  const u = {
    uRect: { value: new THREE.Vector4() }, uPrev: { value: new THREE.Vector4() },
    uFlash: { value: 0 }, uTime: { value: 0 },
    uVeil: { value: new THREE.Color(VEIL) }, uFlashCol: { value: new THREE.Color(FLASH) },
    uLit: { value: new THREE.Color().fromArray(CLOUD.lit) }, uShade: { value: new THREE.Color().fromArray(CLOUD.shade) },
    uDrift: { value: new THREE.Vector2(CLOUD.drift[0], CLOUD.drift[1]) },
    uSun: { value: new THREE.Vector2(-0.707, -0.707) },   // the sun is north-west (render/sun.js): its ground direction
    uCloud: { value: new THREE.Vector4(CLOUD.full, CLOUD.dark, CLOUD.black, CLOUD.scale) },
    uNoise: { value: cloudNoise(THREE) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 8;   // over the scene and its effects; under the placement ghost (10)
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  const toWorld = (v, r) => v.set(r.x0, r.y0, r.x1 + 1, r.y1 + 1);   // inclusive cells → cell edges

  return {
    mesh,
    /**
     * Show the fogTracker's frame ({ win, flash }) at clock `t` (s, for the drift). The cloud bank rings the play window,
     * or — with the whole board open (win null) — the map's own edge. Returns true (always drawn).
     */
    sync(frame, t = 0) {
      const win = frame && frame.win;
      mesh.visible = true;
      u.uTime.value = t || 0;
      if (win) toWorld(u.uRect.value, win.rect);
      else u.uRect.value.set(0, 0, map.cols, map.rows);   // the open board: clouds past its edge [MM-story_mvfk3el9_b]
      if (!win) { u.uFlash.value = 0; return true; }
      if (frame.flash) { toWorld(u.uPrev.value, frame.flash.prev); u.uFlash.value = 0.45 * frame.flash.alpha; }
      else u.uFlash.value = 0;
      return true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
