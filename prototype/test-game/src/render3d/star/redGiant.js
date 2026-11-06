/**
 * src/render3d/star/redGiant.js — Vesper, the Collective's red giant, up close [MM-story_mw47l791_1].
 *
 * Owner 2026-11-05: the opening presents "the red giant, the fly by of the collective ship …". Design: Collective-Opening
 * §3 — deep red-orange (≈ 3,200 K), very large, slowly boiling granulation, a darker limb, a few prominences, and a
 * broad soft glare instead of a lens flare. It is the key light for everything near it.
 *
 *   const star = createRedGiant(THREE, { radius: 400, tier: 'high' });
 *   scene.add(star.group);
 *   star.update(dt, camera);        // every frame: boils the surface, turns the corona card to the camera
 *   key.color.copy(star.lightColor);
 *
 * Draws: TWO — the surface sphere (granulation + limb darkening) and one camera-facing card for the corona glow and
 * the prominences (the card sits at the star's centre, so the sphere's depth hides its inner half). Both shaders write
 * HDR values above 1 at the hot centre and in the prominences, so the presentation chain's bloom picks them up.
 * Deterministic: the noise is a fixed hash and the motion runs on accumulated dt only (no clock, no Math.random).
 */

const TIERS = { high: { oct: 5, seg: [96, 64] }, standard: { oct: 4, seg: [72, 48] }, low: { oct: 3, seg: [48, 32] } };

const NOISE = `
float h31(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

const SURF_VS = `
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
void main() {
  vObj = position; vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// Granulation: big convection cells (red giants have a few huge ones) from a warped fbm, with dark lanes between them
// (a ridge term), boiling slowly. Limb darkening is strong (u ≈ 0.85) and reddens toward the edge.
const SURF_FS = `
uniform float uTime, uHeat; uniform vec3 uHot, uMid, uCool;
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
${NOISE}
void main() {
  vec3 p = normalize(vObj) * 3.2;
  float t = uTime * 0.018;
  vec3 w = vec3(fbm(p + vec3(t, 0.0, -t)), fbm(p + vec3(5.2, t, 1.3)), fbm(p + vec3(-t, 2.8, 7.1)));
  float cells = fbm(p * 1.3 + w * 1.6 + vec3(0.0, t * 1.7, 0.0));
  float lanes = 1.0 - abs(fbm(p * 2.6 + w * 1.1 - vec3(t * 2.3)) * 2.0 - 1.0);
  float g = clamp(cells * 1.1 - pow(lanes, 4.0) * 0.18 + 0.12, 0.0, 1.0);
  float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
  float limb = 1.0 - 0.85 * (1.0 - pow(mu, 0.6));
  vec3 col = mix(uCool, uMid, smoothstep(0.05, 0.5, g));
  col = mix(col, uHot, smoothstep(0.55, 0.95, g) * mu);
  col *= limb * uHeat * (0.75 + 0.5 * g);
  gl_FragColor = vec4(col, 1.0);
}`;

const CARD_VS = `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// The corona card, in units of the star radius (vP = 0 at the centre, |vP| = 1 at the limb): a soft glare that falls
// off outside the limb, and prominences — bright filaments of fbm in polar coordinates, only in a band just outside it.
const CARD_FS = `
uniform float uTime, uGlare, uProm; uniform vec3 uGlow, uProminence;
varying vec2 vP;
${NOISE}
void main() {
  float r = length(vP);
  if (r > 3.0) discard;
  float th = atan(vP.y, vP.x);
  float out1 = max(0.0, r - 1.0);
  float glare = (exp(-out1 * 5.5) * 0.9 + exp(-out1 * 1.4) * 0.22) * smoothstep(0.92, 1.0, r);
  float band = smoothstep(0.99, 1.02, r) * (1.0 - smoothstep(1.06, 1.32, r));
  vec3 q = vec3(cos(th) * 3.0, sin(th) * 3.0, out1 * 9.0 - uTime * 0.03);
  float f = fbm(q * 1.4 + vec3(0.0, 0.0, uTime * 0.01));
  float loops = pow(clamp(f * 1.6 - 0.45, 0.0, 1.0), 2.2);
  float arcs = smoothstep(0.55, 0.75, fbm(vec3(th * 2.0, 0.3, uTime * 0.004)));   // only a few sectors carry them
  float prom = loops * band * arcs * uProm;
  vec3 c = uGlow * glare * uGlare + uProminence * prom * 2.4;
  gl_FragColor = vec4(c, 1.0);
}`;

/** Additive on an HDR buffer: colour adds, alpha untouched. */
function additive(THREE, m) {
  m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  return m;
}

export const RED_GIANT = Object.freeze({
  hot: '#ffb36a', mid: '#e8462a', cool: '#5a0c08', glow: '#ff5a2a', prominence: '#ff7a3c', light: '#ff9a6a',
});

/**
 * createRedGiant(THREE, { radius, tier, heat, glare, prominences, palette }) → { group, surface, card, lightColor,
 * update(dt, camera), setIntensity(k), dispose }.
 */
export function createRedGiant(THREE, { radius = 100, tier = 'high', heat = 1.6, glare = 1.0, prominences = 1.0, palette = {} } = {}) {
  const T = TIERS[tier] || TIERS.high, P = { ...RED_GIANT, ...palette };
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const defines = { OCT: T.oct };
  const time = { value: 0 };
  const group = new THREE.Group(); group.name = 'redGiant';

  const surfMat = new THREE.ShaderMaterial({
    defines, vertexShader: SURF_VS, fragmentShader: SURF_FS,
    uniforms: { uTime: time, uHeat: { value: heat }, uHot: { value: lin(P.hot) }, uMid: { value: lin(P.mid) }, uCool: { value: lin(P.cool) } },
  });
  const surfGeo = new THREE.SphereGeometry(radius, T.seg[0], T.seg[1]);
  const surface = new THREE.Mesh(surfGeo, surfMat); surface.name = 'redGiant.surface';
  group.add(surface);

  const cardMat = additive(THREE, new THREE.ShaderMaterial({
    defines, vertexShader: CARD_VS, fragmentShader: CARD_FS, transparent: true, depthWrite: false, depthTest: true,
    uniforms: { uTime: time, uGlare: { value: glare }, uProm: { value: prominences }, uGlow: { value: lin(P.glow) }, uProminence: { value: lin(P.prominence) } },
  }));
  // the card is in radius units (6 × 6 → |vP| ≤ 3); scaled to the star's radius
  const cardGeo = new THREE.PlaneGeometry(6, 6);
  const card = new THREE.Mesh(cardGeo, cardMat); card.name = 'redGiant.corona';
  card.scale.setScalar(radius); card.renderOrder = 2;
  group.add(card);

  return {
    group, surface, card, radius,
    lightColor: lin(P.light),
    /** Boil the surface and turn the corona card to face the camera. */
    update(dt, camera) {
      time.value += dt || 0;
      if (camera) card.quaternion.copy(camera.quaternion);   // the group is never rotated, so the camera's own turn faces it
    },
    /** 0 … 1+: how bright the star reads (the opening fades it in). */
    setIntensity(k) {
      surfMat.uniforms.uHeat.value = heat * k;
      cardMat.uniforms.uGlare.value = glare * k;
      cardMat.uniforms.uProm.value = prominences * k;
    },
    get time() { return time.value; },
    dispose() {
      group.parent && group.parent.remove(group);
      surfGeo.dispose(); surfMat.dispose(); cardGeo.dispose(); cardMat.dispose();
    },
  };
}
