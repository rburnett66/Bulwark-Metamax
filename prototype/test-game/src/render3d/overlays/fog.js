/**
 * src/render3d/overlays/fog.js — the ring fog (plan v2.2 §6.5) [MM-task_mv9s9o5d_3].
 *
 * One large ground-level quad drawn after the scene (no depth test): every pixel whose ground point lies
 * outside the current window (fogModel.js) is veiled, and a thin cyan outline marks the window's edge — a
 * constant ~1.5 px on screen at any zoom (screen-space derivatives). When a ring grows, the band that just
 * opened flashes and fades. Same reading as the Pixi view's overlay: a light veil that keeps the locked
 * ground readable ("the player should see what's coming and want it"), not black fog of war.
 *
 * Like the Pixi overlay it is a screen-space veil over the ground point under each pixel, so a tall object
 * at the window's edge is veiled by the ground behind it. THREE is passed in (no import) — see index.js.
 */

const VEIL = 0x05070a, LINE = 0x5fe0ff, FLASH = 0x9fe8ff;
const DIM = { gated: 0.38, open: 0.34 };   // renderer.js: campaign ring veil 0.38, forge window dim 0.34
const LINE_ALPHA = 0.85;
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
uniform float uDim, uFlash, uLine;
uniform vec3 uVeil, uLineCol, uFlashCol;
varying vec2 vXZ;
float inside(vec4 r, vec2 p) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
void main() {
  // signed distance (cells) from the window edge: > 0 outside
  vec2 d2 = max(uRect.xy - vXZ, vXZ - uRect.zw);
  float d = max(d2.x, d2.y);
  float px = max(fwidth(d), 1e-4);
  float line = (1.0 - smoothstep(0.75, 1.5, abs(d) / px)) * uLine;
  float outside = step(0.0, d);
  float flash = uFlash * inside(uRect, vXZ) * (1.0 - inside(uPrev, vXZ));
  vec3 col = uVeil;
  float a = outside * uDim;
  col = mix(col, uFlashCol, flash / max(a + flash, 1e-4));
  a = a + flash * (1.0 - a);
  col = mix(col, uLineCol, line);
  a = max(a, line);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col, a);
}`;

export function createFogView(THREE, scene, map) {
  const geo = new THREE.PlaneGeometry(map.cols + EXTENT * 2, map.rows + EXTENT * 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.cols / 2, 0, map.rows / 2);
  const u = {
    uRect: { value: new THREE.Vector4() }, uPrev: { value: new THREE.Vector4() },
    uDim: { value: DIM.gated }, uFlash: { value: 0 }, uLine: { value: LINE_ALPHA },
    uVeil: { value: new THREE.Color(VEIL) }, uLineCol: { value: new THREE.Color(LINE) }, uFlashCol: { value: new THREE.Color(FLASH) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false,
    extensions: { derivatives: true },
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
      u.uDim.value = win.gated ? DIM.gated : DIM.open;
      if (frame.flash) { toWorld(u.uPrev.value, frame.flash.prev); u.uFlash.value = 0.45 * frame.flash.alpha; }
      else u.uFlash.value = 0;
      return true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
