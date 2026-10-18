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

const VERT = /* glsl */`
varying vec2 vXZ;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vXZ = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform vec4 uRect;     // world x0, z0, x1, z1 (cell edges)
uniform vec4 uPrev;     // the window before the last growth
uniform float uMargin, uFlash;
uniform vec3 uVeil, uFlashCol;
varying vec2 vXZ;
float inside(vec4 r, vec2 p) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
void main() {
  // signed distance (cells) from the window edge: > 0 outside
  vec2 d2 = max(uRect.xy - vXZ, vXZ - uRect.zw);
  float d = max(d2.x, d2.y);
  float a = smoothstep(0.0, uMargin, d);   // the vignette: clear at the edge, dark at uMargin cells, dark beyond (= fogAlpha)
  float flash = uFlash * inside(uRect, vXZ) * (1.0 - inside(uPrev, vXZ));
  vec3 col = mix(uVeil, uFlashCol, flash / max(a + flash, 1e-4));
  a = a + flash * (1.0 - a);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col, a);
}`;

export function createFogView(THREE, scene, map) {
  const geo = new THREE.PlaneGeometry(map.cols + EXTENT * 2, map.rows + EXTENT * 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.cols / 2, 0, map.rows / 2);
  const u = {
    uRect: { value: new THREE.Vector4() }, uPrev: { value: new THREE.Vector4() },
    uMargin: { value: FOG_MARGIN }, uFlash: { value: 0 },
    uVeil: { value: new THREE.Color(VEIL) }, uFlashCol: { value: new THREE.Color(FLASH) },
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
    /** Show the fogTracker's frame ({ win, flash }). Returns true when the fog is drawn. */
    sync(frame) {
      const win = frame && frame.win;
      mesh.visible = !!win;
      if (!win) return false;
      toWorld(u.uRect.value, win.rect);
      if (frame.flash) { toWorld(u.uPrev.value, frame.flash.prev); u.uFlash.value = 0.45 * frame.flash.alpha; }
      else u.uFlash.value = 0;
      return true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
