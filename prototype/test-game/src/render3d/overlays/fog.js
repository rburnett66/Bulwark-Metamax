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
 * CLOUD FOG [MM-story_mvfk3el9_b] — owner 2026-10-19: "a cheap cloud shader … instead of the black", "the clouds should
 * fill in the sides", "in the biggest view there should still be a cloud effect on the edges", then (after the first
 * look): "we don't need twisting, or deepness, just enough for edges .. but high performance for pc and mobile. Mobile
 * could use rougher math for speed".
 *
 * So: a soft CLOUD EDGE around the play area — a billowy, noise-broken rim a little way outside the window, soft white
 * cloud past it, sinking into the dark veil far out (ragged, not a box). With the whole board open it rings the map.
 *
 * COST: one quad, one draw call, pixels inside the play area discarded first. Per cloud pixel the DETAIL path (High
 * tier, desktops) reads the noise texture twice; the ROUGH path (Standard / Low, what phones get) once, with no extra
 * octave — a compile-time switch, so the cheap path carries no branch.
 */
export const CLOUD = Object.freeze({
  edge: 1.2,     // cells outside the window where the cloud rim sits (on average)
  wave: 2.4,     // how far the noise pushes the rim in / out (cells) — the billows
  soft: 1.6,     // the rim's soft fade-in width (cells)
  dark: 9.0,     // cells out where the bank starts sinking into the veil (ragged by the noise)…
  black: 15,     // …and is fully dark
  scale: 0.07,   // noise cycles per cell (big, soft billows)
  drift: Object.freeze([0.12, 0.05]),   // cells / s
  lit: Object.freeze([0.9, 0.92, 0.96]), shade: Object.freeze([0.62, 0.67, 0.76]),
  noise: 128,
});
/** JS twin of the shader's cloud alpha at d cells outside the window for a noise value n (0..1): the soft rim (tests). */
export function cloudAlpha(d, n = 0.5, C = CLOUD) {
  const e = d - C.edge - (0.5 - n) * C.wave;
  const t = Math.max(0, Math.min(1, e / C.soft));
  return t * t * (3 - 2 * t);
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
uniform vec2 uDrift;
uniform vec4 uCloud;    // edge, wave, soft, scale
uniform vec2 uFar;      // dark, black
uniform sampler2D uNoise;
varying vec2 vXZ;
float inside(vec4 r, vec2 p) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
void main() {
  vec2 d2 = max(uRect.xy - vXZ, vXZ - uRect.zw);
  float d = max(d2.x, d2.y);                       // cells outside the window (< 0 inside)
  float flash = uFlash * inside(uRect, vXZ) * (1.0 - inside(uPrev, vXZ));
  if (d < 0.0 && flash < 0.002) discard;           // the play area costs nothing
  vec2 q = vXZ * uCloud.w + uDrift * uCloud.w * uTime;
  float n = texture2D(uNoise, q).r;
#ifdef CLOUD_DETAIL
  n = n * 0.7 + texture2D(uNoise, q * 2.7 + 0.31).r * 0.3;   // a finer billow on desktops
#endif
  // the soft rim: the edge sits uCloud.x out, pushed in / out by the noise; fades in over uCloud.z cells
  float e = clamp((d - uCloud.x - (0.5 - n) * uCloud.y) / uCloud.z, 0.0, 1.0);
  float a = e * e * (3.0 - 2.0 * e);
  // shading: billow crowns lit, the thin rim a little shadowed (no extra taps)
  vec3 col = mix(uShade, uLit, clamp(n * 1.3 - 0.15 + e * 0.25, 0.0, 1.0));
  // far out: the bank sinks into the dark veil along a ragged line
  float k = clamp((d - uFar.x + (n - 0.5) * 6.0) / (uFar.y - uFar.x), 0.0, 1.0);
  float far = k * k * (3.0 - 2.0 * k);
  col = mix(col, uVeil, far);
  a = max(a * 0.96, far);
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

/**
 * PLANES vs THE BANK [MM-task_mvfnb9jd_e] — owner 2026-10-19: "shift cloud fog a little so planes are visible at the top
 * of the map". The veil is drawn over the GROUND point under each pixel, and a plane at height h is seen against
 * ground h / tan(pitch) farther from the camera — so near the far edge a plane over the play area sat on clouds. The
 * window edges facing away from the camera move out by that distance (split by the camera's yaw). Mutates `r`
 * (Vector4-like x0, z0, x1, z1) and returns it.
 */
export function farShift(r, dist, yaw = 0) {
  if (!(dist > 0)) return r;
  const ax = -Math.sin(yaw), az = -Math.cos(yaw);   // ground direction pointing away from the camera
  if (ax < 0) r.x -= dist * -ax; else r.z += dist * ax;
  if (az < 0) r.y -= dist * -az; else r.w += dist * az;
  return r;
}
/** Ground distance a flyer at height h is displaced by, seen at camera pitch (degrees). */
export const flightParallax = (h, pitchDeg) => (h > 0 ? h / Math.tan((pitchDeg * Math.PI) / 180) : 0);

export function createFogView(THREE, scene, map, { detail = true } = {}) {
  const geo = new THREE.PlaneGeometry(map.cols + EXTENT * 2, map.rows + EXTENT * 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.cols / 2, 0, map.rows / 2);
  const u = {
    uRect: { value: new THREE.Vector4() }, uPrev: { value: new THREE.Vector4() },
    uFlash: { value: 0 }, uTime: { value: 0 },
    uVeil: { value: new THREE.Color(VEIL) }, uFlashCol: { value: new THREE.Color(FLASH) },
    uLit: { value: new THREE.Color().fromArray(CLOUD.lit) }, uShade: { value: new THREE.Color().fromArray(CLOUD.shade) },
    uDrift: { value: new THREE.Vector2(CLOUD.drift[0], CLOUD.drift[1]) },
    uCloud: { value: new THREE.Vector4(CLOUD.edge, CLOUD.wave, CLOUD.soft, CLOUD.scale) },
    uFar: { value: new THREE.Vector2(CLOUD.dark, CLOUD.black) },
    uNoise: { value: cloudNoise(THREE) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG, defines: detail ? { CLOUD_DETAIL: 1 } : {},
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
    sync(frame, t = 0, far = null) {
      const win = frame && frame.win;
      mesh.visible = true;
      u.uTime.value = t || 0;
      if (win) toWorld(u.uRect.value, win.rect);
      else u.uRect.value.set(0, 0, map.cols, map.rows);   // the open board: clouds past its edge [MM-story_mvfk3el9_b]
      if (far) farShift(u.uRect.value, far.dist, far.yaw);   // planes over the play area stay clear of the bank [MM-task_mvfnb9jd_e]
      if (!win) { u.uFlash.value = 0; return true; }
      if (frame.flash) { toWorld(u.uPrev.value, frame.flash.prev); u.uFlash.value = 0.45 * frame.flash.alpha; }
      else u.uFlash.value = 0;
      return true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
