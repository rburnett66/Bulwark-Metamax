/**
 * src/menu/galaxyStage.js — the main menu's 3D GALAXY [MM-story_mvftq5q8_l]: the nine homeworlds' solar systems in a
 * two-armed spiral, and the one camera fly between the target PLANET (framed exactly like the menu's live globe) and
 * the GALAXY overview. Drawn by menuStage.js's single canvas into a `[data-galaxy]` element:
 *
 *   <div data-galaxy data-target="water" data-mode="planet|galaxy" data-gx data-gy data-gh>
 *     <span data-sys="water">RIME</span> …       ← labels, positioned here each frame
 *   </div>
 *
 * data-gx/gy/gh: where the live globe sat (centre + height, px inside this element) so the fly starts on it.
 * Events dispatched on the element: 'bwm-galaxy-pick' {detail:{key}} when a system is clicked in galaxy view,
 * 'bwm-galaxy-arrive' when a fly back to a planet lands (the menu swaps the live globe back in).
 * Render-only; THREE and makeGlobe are injected.
 */
import { GALAXY, CAM, SYSTEM_KEYS, systemPos, galaxyStars, galaxyCamera } from '../data/galaxy.js';
import { PLANETS } from '../data/planets.js';
import { SUN_DIR } from '../render3d/planet/globe.js';

const FLY = 1.6;   // seconds for the whole fly out / in

/** Additive light on a TRANSPARENT canvas: plain AdditiveBlending also adds alpha (SRC_ALPHA, ONE), so a dark pixel turns
 *  opaque black over the menu's starfield. Colour adds (ONE, ONE); alpha takes the fragment's brightness. */
function light(THREE, mat) {
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor;
  mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneFactor;
  return mat;
}

const PVERT = `attribute float aSize; attribute vec3 aCol; uniform float uScale, uPR, uFade; varying vec3 vCol; varying float vA;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    float s = aSize * uScale / max(0.5, -mv.z); gl_PointSize = clamp(s, 1.2, 4.5) * uPR; vCol = aCol; vA = uFade * clamp(s * 0.9, 0.55, 1.4); }`;
const PFRAG = `varying vec3 vCol; varying float vA;
  void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = dot(q, q); if (d > 1.0) discard; vec3 c = vCol * vA * (1.0 - d); gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`;
const GVERT = `attribute float aSize; attribute vec3 aCol; uniform float uPR; varying vec3 vCol;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPR; vCol = aCol; }`;
const GFRAG = `uniform float uFade; varying vec3 vCol;
  void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float d = length(q); if (d > 1.0) discard;
    float a = (exp(-d * d * 7.0) + 0.35 * (1.0 - d)) * uFade; vec3 c = vCol * a; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`;

export function createGalaxyStage(THREE, makeGlobe) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(CAM.fov, 1, 0.05, 2000);

  // ── the star field (one draw)
  const S = galaxyStars();
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(S.pos, 3));
  sg.setAttribute('aCol', new THREE.BufferAttribute(S.col, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(S.size, 1));
  const starMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 300 }, uPR: { value: 1 }, uFade: { value: 1 } }, vertexShader: PVERT, fragmentShader: PFRAG,
    transparent: true, depthWrite: false });
  light(THREE, starMat);
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false;
  scene.add(stars);

  // ── the disc's soft light: core glow + two faint spiral arms (one additive quad in the galaxy plane)
  const discMat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 }, uTwist: { value: GALAXY.twist }, uR: { value: GALAXY.radius }, uCore: { value: new THREE.Color(...GALAXY.core.map((c) => c / 255)) }, uArm: { value: new THREE.Color(...GALAXY.arm.map((c) => c / 255)) } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uFade, uTwist, uR; uniform vec3 uCore, uArm; varying vec2 vP;
      void main() { float r = length(vP), th = atan(vP.y, vP.x);
        float arms = pow(max(0.0, cos(2.0 * (th - uTwist * 3.14159 * (r - 6.0) / uR))), 4.0) * exp(-r / (uR * 0.55)) * smoothstep(4.0, 18.0, r);
        float core = exp(-r * r / 260.0);
        vec3 c = uCore * core * 0.75 + uArm * arms * 0.22;
        c *= 1.0 - smoothstep(uR * 0.85, uR * 1.15, r);
        c *= uFade; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  light(THREE, discMat);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(GALAXY.radius * 2.4, GALAXY.radius * 2.4), discMat);
  disc.rotation.x = -Math.PI / 2; disc.frustumCulled = false; disc.renderOrder = -1;
  scene.add(disc);

  // ── the nine systems: a glowing star, a faint orbit, the homeworld globe (the same shader as the live globe)
  const sphere = new THREE.SphereGeometry(1, 64, 48);
  const sun = new THREE.Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
  const systems = new Map();
  const glowPos = new Float32Array(SYSTEM_KEYS.length * 3), glowCol = new Float32Array(SYSTEM_KEYS.length * 3), glowSize = new Float32Array(SYSTEM_KEYS.length);
  SYSTEM_KEYS.forEach((key, i) => {
    const p = systemPos(key), P = PLANETS[key];
    const g = makeGlobe(THREE, key, { geo: sphere });
    g.root.scale.setScalar(GALAXY.planetR); g.root.position.set(p[0], p[1], p[2]);
    scene.add(g.root);
    const star = [p[0] + sun.x * GALAXY.orbit, p[1] + sun.y * GALAXY.orbit, p[2] + sun.z * GALAXY.orbit];
    // orbit: a circle round the star through the planet
    const u = new THREE.Vector3(p[0] - star[0], p[1] - star[1], p[2] - star[2]); const r = u.length(); u.normalize();
    const n = new THREE.Vector3().crossVectors(u, new THREE.Vector3(0, 1, 0)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
    const pts = [];
    for (let k = 0; k <= 96; k++) { const t = (k / 96) * Math.PI * 2; pts.push(new THREE.Vector3(star[0] + r * (Math.cos(t) * u.x + Math.sin(t) * w.x), star[1] + r * (Math.cos(t) * u.y + Math.sin(t) * w.y), star[2] + r * (Math.cos(t) * u.z + Math.sin(t) * w.z))); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(P.ui || '#9cc8f0'), transparent: true, opacity: 0.35, depthWrite: false }));
    scene.add(ring);
    const sc = new THREE.Color(P.sun || '#fff4e0');
    glowPos.set(star, i * 3); glowCol.set([sc.r, sc.g * 0.92, sc.b * 0.8], i * 3); glowSize[i] = 30;
    systems.set(key, { globe: g, pos: p, ring, i });
  });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  gg.setAttribute('aCol', new THREE.BufferAttribute(glowCol, 3));
  gg.setAttribute('aSize', new THREE.BufferAttribute(glowSize, 1));
  const glowMat = new THREE.ShaderMaterial({ uniforms: { uPR: { value: 1 }, uFade: { value: 1 } }, vertexShader: GVERT, fragmentShader: GFRAG,
    transparent: true, depthWrite: false, depthTest: false });
  light(THREE, glowMat);
  const glows = new THREE.Points(gg, glowMat); glows.frustumCulled = false; glows.renderOrder = 5;
  scene.add(glows);
  // the target system's marker: a gold ring in the disc, seen from the galaxy view
  const mpts = []; for (let k = 0; k <= 64; k++) { const t = (k / 64) * Math.PI * 2; mpts.push(new THREE.Vector3(Math.cos(t) * 4.2, 0, Math.sin(t) * 4.2)); }
  const marker = new THREE.Line(new THREE.BufferGeometry().setFromPoints(mpts), new THREE.LineBasicMaterial({ color: 0xf2c869, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  marker.renderOrder = 6; scene.add(marker);

  let f = 0, focus = null, focusKey = null, arrived = true, t = 0;
  const v = new THREE.Vector3();

  return {
    /** Advance and draw state for one frame. el = the [data-galaxy] element; W, H its size (px); pr = pixel ratio. */
    update(dt, el, W, H, pr, reduce) {
      t += dt;
      const key = el.dataset.target && systems.has(el.dataset.target) ? el.dataset.target : SYSTEM_KEYS[0];
      const want = el.dataset.mode === 'galaxy' ? 1 : 0;
      if (reduce) f = want; else f += Math.sign(want - f) * Math.min(Math.abs(want - f), dt / FLY);
      // the focus glides to a newly picked system (in galaxy view) instead of jumping
      const tp = systems.get(key).pos;
      if (!focus) focus = tp.slice();
      const k = f <= 0 ? 1 : Math.min(1, dt * (f > 0.5 ? 2.2 : 6));   // at the planet pose it is simply there
      for (let i = 0; i < 3; i++) focus[i] += (tp[i] - focus[i]) * (reduce ? 1 : k);
      focusKey = key;
      const gh = Number(el.dataset.gh) || H, gx = el.dataset.gx != null ? Number(el.dataset.gx) : W / 2, gy = el.dataset.gy != null ? Number(el.dataset.gy) : H / 2;
      const C = galaxyCamera(f, focus, H / gh);
      cam.aspect = W / Math.max(1, H); cam.position.set(C.pos[0], C.pos[1], C.pos[2]); cam.lookAt(C.look[0], C.look[1], C.look[2]);
      // at f = 0 the planet sits where the live globe was; the offset melts away as the fly goes out
      // …and the galaxy, at f = 1, centres in the free area beside the menu column (data-cx)
      const off = 1 - C.e, cx = el.dataset.cx != null ? Number(el.dataset.cx) : W / 2;
      cam.setViewOffset(W, H, (W / 2 - gx) * off + (W / 2 - cx) * C.e, (H / 2 - gy) * off, W, H);
      cam.updateProjectionMatrix();
      starMat.uniforms.uScale.value = H / (2 * Math.tan((CAM.fov * Math.PI) / 360)) * 0.06;
      starMat.uniforms.uPR.value = glowMat.uniforms.uPR.value = pr;
      glowMat.uniforms.uFade.value = Math.min(1, C.e * 1.6);
      discMat.uniforms.uFade.value = Math.min(1, C.e * 1.3);
      for (const s of systems.values()) {
        s.globe.spin(dt, 0.12);
        s.ring.material.opacity = 0.35 * Math.min(1, C.e * 2);
        s.globe.root.visible = s.globe === systems.get(key).globe || C.e > 0.15;   // close in: only the target's planet
      }
      marker.position.set(tp[0], tp[1], tp[2]);
      marker.material.opacity = C.e > 0.4 ? (0.55 + 0.35 * Math.sin(t * 3)) * Math.min(1, (C.e - 0.4) * 3) : 0;
      // labels
      const show = C.e > 0.45, la = Math.min(1, (C.e - 0.45) * 3);
      for (const lab of el.querySelectorAll('[data-sys]')) {
        const s = systems.get(lab.dataset.sys);
        if (!s || !show) { lab.style.opacity = '0'; lab.style.pointerEvents = 'none'; continue; }
        v.set(s.pos[0], s.pos[1], s.pos[2]).project(cam);
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
        lab.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        lab.style.opacity = String(la * (v.z < 1 ? 1 : 0)); lab.style.pointerEvents = la > 0.5 ? 'auto' : 'none';
        lab.classList.toggle('on', lab.dataset.sys === key);
      }
      if (want === 0 && f <= 0 && !arrived) { arrived = true; el.dispatchEvent(new CustomEvent('bwm-galaxy-arrive')); }
      if (f > 0) arrived = false;
      return cam;
    },
    /** The system under a click at (x, y) px inside the element, or null (galaxy view only). */
    pick(x, y, W, H) {
      if (f < 0.6) return null;
      let best = null, bd = 34 * 34;
      for (const [key, s] of systems) {
        v.set(s.pos[0], s.pos[1], s.pos[2]).project(cam);
        if (v.z > 1) continue;
        const dx = (v.x * 0.5 + 0.5) * W - x, dy = (-v.y * 0.5 + 0.5) * H - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = key; }
      }
      return best;
    },
    scene, camera: cam,
    get fly() { return f; },
    dispose() {
      for (const s of systems.values()) { s.globe.dispose(); s.ring.geometry.dispose(); s.ring.material.dispose(); }
      sphere.dispose(); disc.geometry.dispose(); discMat.dispose(); sg.dispose(); starMat.dispose(); gg.dispose(); glowMat.dispose(); marker.geometry.dispose(); marker.material.dispose();
    },
  };
}
