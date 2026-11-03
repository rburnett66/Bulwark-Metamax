// backdrop.js — deep-space backdrop for the capital-ship presentation: starfield, nebula, a small sun, and a
// matching cheap environment scene for PMREM reflections.
//
//   const bd = createBackdrop(THREE, { seed: 7, tier: 'high' });
//   scene.add(bd.group);
//   scene.environment = new THREE.PMREMGenerator(renderer).fromScene(bd.envScene, 0.04).texture;
//   key.position.copy(bd.sunDirection).multiplyScalar(50); key.color.copy(bd.sunColor);
//   bd.update(dt, camera);                        // every frame, BEFORE render (follows the camera)
//   bd.sunAnchor.add(lensFlare);                  // optional: a Lensflare sits exactly on the sun
//
// Everything is at "infinite" distance: the group re-centres on the camera and scales itself to 0.9 × camera.far
// every update, so parallax never reveals it and it is always inside the frustum. Every material is additive,
// depthWrite:false, depthTest:true, fog:false, opaque-list (transparent:false) with renderOrder −1e6, so it draws
// first, before the hull, and never needs sorting against the ship's transparent FX.
//
// Draw calls: nebula 1 + stars 1 + bright-star spikes 1 (not on low) + sun 1 = 4 (3 on low).
// Seeded and deterministic: a mulberry32 PRNG, never Math.random; the shader noise is a fixed hash.

const TIERS = {
  high: { stars: 3600, bright: 10, octaves: 4, warp: 3, segs: [64, 32], spikes: true, dustStars: true },
  standard: { stars: 2600, bright: 8, octaves: 3, warp: 2, segs: [48, 24], spikes: true, dustStars: true },
  low: { stars: 1600, bright: 6, octaves: 2, warp: 1, segs: [32, 16], spikes: false, dustStars: false },
};

const DEFAULT_PALETTE = {
  deep: '#020308',      // the darkest sky (added under the nebula)
  a: '#3a2f78',         // nebula colour 1 — violet
  b: '#1b5f80',         // nebula colour 2 — teal
  c: '#8c4a3c',         // nebula colour 3 — dusty rust, only in the densest knots
  fill: '#8fb0ff',      // cool fill band in the env scene
  sun: '#ffe8c8',       // the sun (and the key light colour)
};

// ── GLSL: shared value noise / fbm ─────────────────────────────────────────────────────────────────────
// iq's cheap 3D hash (no sin, stable on mobile highp). OCTAVES / WARP are #defines per tier.
const NOISE = `
float h31(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < OCTAVES; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / (1.0 - pow(0.5, float(OCTAVES)));          // normalised to ~0..1 whatever the octave count
}
// the nebula field for a unit direction → (density, dust, colour mix x, colour mix y)
uniform mat3 uRot; uniform vec3 uOffset; uniform vec3 uBandN; uniform float uScale;
vec4 nebulaField(vec3 dir) {
  vec3 p = uRot * dir * uScale + uOffset;
  vec3 q = vec3(fbm(p), 0.5, 0.5);
#if WARP > 1
  q.y = fbm(p + vec3(5.2, 1.3, 2.8));
#endif
#if WARP > 2
  q.z = fbm(p + vec3(1.7, 9.2, 4.1));
#endif
  float n = fbm(p * 1.3 + 2.6 * (q - 0.5));
  float b = dot(dir, uBandN);
  float band = exp(-b * b * 7.0);                       // the clouds gather along a galactic band
  float fil = 1.0 - abs(2.0 * n - 1.0); fil = fil * fil * fil;   // wispy ridges along the warp folds
  float density = (smoothstep(0.45, 0.85, n) * 0.75 + fil * 0.35) * (0.15 + 0.85 * band) + 0.06 * band;
  float dust = smoothstep(0.52, 0.7, q.y * 0.55 + n * 0.6) * (0.3 + 0.7 * band);   // dark lanes
  return vec4(density, dust, q.x, q.z);
}`;

const NEB_VS = `
varying vec3 vDir;
void main() {
  vDir = position;                                      // the sphere is centred on the camera: position = direction
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEB_FS = `
${NOISE}
uniform vec3 uDeep; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uIntensity;
uniform vec3 uSunDir; uniform vec3 uSunCol;
varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  vec4 f = nebulaField(dir);
  vec3 col = mix(uA, uB, smoothstep(0.38, 0.62, f.z));
  col = mix(col, uC, smoothstep(0.5, 0.7, f.w) * smoothstep(0.25, 0.7, f.x));
  float lum = f.x * (1.0 - 0.85 * f.y);
  vec3 c = uDeep + col * lum * uIntensity;
  float s = max(dot(dir, uSunDir), 0.0);
  c += uSunCol * (0.010 * pow(s, 10.0) + 0.03 * pow(s, 120.0));   // faint forward scatter round the sun
  // dither ~1 sRGB step: work in sqrt (≈ perceptual) space so dark gradients never band
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  c = sqrt(max(c, 0.0)) + (ign - 0.5) / 255.0; c *= max(c, 0.0);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

// stars: sizes in device pixels (no attenuation); optional per-star dust extinction from the nebula field
const STAR_VS = `
#ifdef DUST_STARS
${NOISE}
#endif
attribute float aFlux; attribute vec3 aColor; attribute vec2 aTw;
uniform float uPR; uniform float uTime; uniform float uBright;
varying vec3 vColor; varying float vI; varying float vSharp;
void main() {
  float I = aFlux * uBright;
  I *= 1.0 + aTw.x * sin(uTime * (1.3 + aTw.y * 0.7) + aTw.y * 40.0);   // aTw.x = 0 for most stars
#ifdef DUST_STARS
  vec4 f = nebulaField(normalize(position));
  I *= 1.0 - 0.8 * f.y;                                 // stars dim behind the dust lanes
#endif
  vI = I; vColor = aColor;
  float px = 1.9 + 2.6 * sqrt(clamp(I, 0.0, 4.0));      // bright stars are bigger; the faint are a soft 1–2 px dot
  vSharp = mix(5.0, 9.0, clamp(I, 0.0, 1.0));
  gl_PointSize = px * uPR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_FS = `
varying vec3 vColor; varying float vI; varying float vSharp;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * vSharp);
  float halo = exp(-r2 * 2.5) * 0.12 * clamp(vI - 0.6, 0.0, 2.0);
  gl_FragColor = vec4(vColor * vI * (core + halo) * (1.0 - r2), 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

// bright stars: screen-aligned quads with 4-point diffraction spikes (same orientation for every star, like real optics)
const SPIKE_VS = `
attribute vec2 aCorner; attribute float aFlux; attribute vec3 aColor; attribute float aSize;
uniform vec4 uViewport; uniform float uPR; uniform float uTime;
varying vec2 vUv; varying vec3 vColor; varying float vI;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 px = aCorner * aSize * uPR;                       // half-size in device pixels
  clip.xy += px / uViewport.zw * 2.0 * clip.w;
  vUv = aCorner; vColor = aColor;
  vI = aFlux * (1.0 + 0.04 * sin(uTime * 0.9 + aSize));
  gl_Position = clip;
}`;

const SPIKE_FS = `
uniform float uSpike; uniform float uRot;
varying vec2 vUv; varying vec3 vColor; varying float vI;
void main() {
  float c = cos(uRot), s = sin(uRot);
  vec2 uv = mat2(c, s, -s, c) * vUv;
  float r2 = dot(vUv, vUv);
  float core = exp(-r2 * 700.0) * 3.0 + exp(-r2 * 120.0) * 0.6;
  float halo = exp(-sqrt(r2) * 9.0) * 0.18;
  float sx = exp(-abs(uv.y) * 160.0) * pow(max(1.0 - abs(uv.x), 0.0), 4.0);
  float sy = exp(-abs(uv.x) * 160.0) * pow(max(1.0 - abs(uv.y), 0.0), 4.0);
  float edge = 1.0 - smoothstep(0.85, 1.0, max(abs(vUv.x), abs(vUv.y)));
  float I = (core + halo + (sx + sy) * 0.55 * uSpike) * vI * edge;
  // spikes pick up a faint chromatic fringe toward their tips
  vec3 tint = mix(vColor, vColor * vec3(0.85, 0.95, 1.15), clamp(length(uv) * 1.5, 0.0, 1.0));
  gl_FragColor = vec4(tint * I, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

// the sun: a static quad facing the camera (the camera is always at the group's centre)
const SUN_VS = `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SUN_FS = `
uniform vec3 uCol; uniform float uDisc; uniform float uRd; uniform float uTime; uniform float uSeed; uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float rd = uRd;
  float x = clamp(r / rd, 0.0, 1.0);
  float limb = 0.55 + 0.45 * sqrt(1.0 - x * x);         // limb darkening
  float disc = (1.0 - smoothstep(rd * 0.88, rd, r)) * limb;
  float rr = max(r, rd);
  float fade = 1.0 - smoothstep(0.0, 1.0, r); fade *= fade;   // no visible quad/circle edge, even after ACES lifts the darks
  float corona = (pow(rd / rr, 2.2) * 1.2 + exp(-(rr - rd) * 22.0) * 2.0) * fade;
  float a = atan(vUv.y, vUv.x + 1e-5);                 // atan(0,0) is NaN on some GPUs — NaN in a float target smears through bloom
  float rays = 0.5 + 0.5 * sin(a * 7.0 + uSeed) * sin(a * 11.0 - uSeed * 1.7 + uTime * 0.05);
  rays = pow(rays, 3.0) * exp(-(rr - rd) * 5.0) * 0.5 * pow(rd / rr, 0.6) * fade;
  vec3 white = mix(uCol, vec3(1.0), 0.6);
  vec3 col = white * disc * uDisc + uCol * (corona + rays);
  gl_FragColor = vec4(col * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// approximate black-body colour (sRGB, Tanner Helland's fit), normalised to its max channel
function kelvinToRgb(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = [r, g, b].map((v) => Math.min(255, Math.max(0, v)) / 255);
  const m = Math.max(...c);
  return c.map((v) => v / m);
}

export function createBackdrop(THREE, {
  seed = 1, tier = 'high', sunDir = [0.62, 0.28, 0.73], palette = {},
  nebulaIntensity = 0.9, starBrightness = 1, sunIntensity = 1, sunSize = 1, twinkle = true,
} = {}) {
  const T = TIERS[tier] || TIERS.high;
  const pal = { ...DEFAULT_PALETTE, ...palette };
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const rnd = mulberry32((seed * 2654435761) >>> 0 || 1);
  const disposables = [];
  const own = (x) => (disposables.push(x), x);

  const group = new THREE.Group();
  group.name = 'backdrop';
  const sunDirection = new THREE.Vector3(...sunDir).normalize();
  const sunColor = lin(pal.sun);

  // seeded orientation: a random rotation for the noise domain and a galactic band normal
  const randUnit = () => { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(t), s * Math.sin(t), u); };
  const bandN = randUnit();
  // keep the band from passing straight through the sun (the sun reads better against darker sky)
  bandN.addScaledVector(sunDirection, 0.35).normalize();
  const rotM = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromAxisAngle(randUnit(), rnd() * Math.PI * 2));
  const rot3 = new THREE.Matrix3().setFromMatrix4(rotM);
  const fieldUniforms = {
    uRot: { value: rot3 }, uOffset: { value: new THREE.Vector3(rnd() * 50, rnd() * 50, rnd() * 50) },
    uBandN: { value: bandN }, uScale: { value: 2.6 },
  };
  const defines = { OCTAVES: T.octaves, WARP: T.warp };
  const time = { value: 0 };
  // additive on RGB, leave destination alpha alone (plain AdditiveBlending would pile alpha above 1 in a float
  // target, and UnrealBloomPass then shows each backdrop quad as a faint box)
  const common = { depthWrite: false, depthTest: true, transparent: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

  // ── nebula ─────────────────────────────────────────────────────────────────────────────────────────
  const nebMat = own(new THREE.ShaderMaterial({
    ...common, side: THREE.BackSide, defines,
    uniforms: { ...fieldUniforms, uDeep: { value: lin(pal.deep) }, uA: { value: lin(pal.a) }, uB: { value: lin(pal.b) },
      uC: { value: lin(pal.c) }, uIntensity: { value: nebulaIntensity }, uSunDir: { value: sunDirection },
      uSunCol: { value: sunColor } },
    vertexShader: NEB_VS, fragmentShader: NEB_FS,
  }));
  const nebula = new THREE.Mesh(own(new THREE.SphereGeometry(1, T.segs[0], T.segs[1])), nebMat);
  nebula.renderOrder = -1e6; nebula.frustumCulled = false; nebula.name = 'backdrop.nebula';
  group.add(nebula);

  // ── stars ──────────────────────────────────────────────────────────────────────────────────────────
  // magnitudes from N(<m) ∝ 10^(0.35 m): many faint, few bright. Displayed intensity ∝ flux^0.45 (the eye's
  // compression), so the faintest are ~0.05 and the brightest reach ~2 (HDR — bloom catches them).
  const mMin = -1.2, mMax = 7.5, k = 0.35;
  const x0 = Math.pow(10, k * mMin), x1 = Math.pow(10, k * mMax);
  const stars = [];
  const n = T.stars + T.bright;
  const gauss = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // basis of the galactic plane, for band-hugging stars
  const e1 = new THREE.Vector3().crossVectors(bandN, Math.abs(bandN.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const e2 = new THREE.Vector3().crossVectors(bandN, e1);
  for (let i = 0; i < n; i++) {
    const m = Math.log10(x0 + (x1 - x0) * rnd()) / k;
    const flux = Math.pow(10, -0.4 * (m - mMax));
    let dir;
    if (rnd() < 0.35) {                                    // 35% crowd the galactic band
      const lon = rnd() * Math.PI * 2, lat = gauss() * 0.22;
      dir = new THREE.Vector3().addScaledVector(e1, Math.cos(lon) * Math.cos(lat)).addScaledVector(e2, Math.sin(lon) * Math.cos(lat))
        .addScaledVector(bandN, Math.sin(lat)).normalize();
    } else dir = randUnit();
    const kel = Math.min(25000, Math.max(2800, 6200 * Math.exp(gauss() * 0.32)));
    const c = kelvinToRgb(kel).map((v) => 0.45 + 0.55 * v);   // stars read pale; keep the hint of temperature
    const col = new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear();
    stars.push({ dir, I: 0.13 * Math.pow(flux, 0.42), col, kel });
  }
  stars.sort((a, b) => b.I - a.I);
  // the brightest few become spike quads (high/standard); on low they stay points
  const brightStars = T.spikes ? stars.slice(0, T.bright) : [];
  const pointStars = T.spikes ? stars.slice(T.bright) : stars;
  // and make sure none of them sits on top of the sun
  for (const s of brightStars) if (s.dir.dot(sunDirection) > 0.97) s.dir.applyAxisAngle(bandN, 0.4);

  {
    const N = pointStars.length;
    const pos = new Float32Array(N * 3), flux = new Float32Array(N), col = new Float32Array(N * 3), tw = new Float32Array(N * 2);
    pointStars.forEach((s, i) => {
      pos.set([s.dir.x, s.dir.y, s.dir.z], i * 3);
      flux[i] = Math.min(s.I, 2.5); col.set([s.col.r, s.col.g, s.col.b], i * 3);
      // a few mid-bright stars twinkle very slightly (scintillation-ish; a presentation liberty)
      if (twinkle && s.I > 0.18 && rnd() < 0.15) tw.set([0.18 + 0.12 * rnd(), rnd()], i * 2);
    });
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aFlux', new THREE.BufferAttribute(flux, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aTw', new THREE.BufferAttribute(tw, 2));
    const mat = own(new THREE.ShaderMaterial({
      ...common, defines: T.dustStars ? { ...defines, DUST_STARS: 1 } : defines,
      uniforms: { ...fieldUniforms, uPR: { value: 1 }, uTime: time, uBright: { value: starBrightness } },
      vertexShader: STAR_VS, fragmentShader: STAR_FS,
    }));
    const pts = new THREE.Points(g, mat);
    pts.renderOrder = -1e6 + 1; pts.frustumCulled = false; pts.name = 'backdrop.stars';
    pts.onBeforeRender = (renderer) => { mat.uniforms.uPR.value = renderer.getPixelRatio(); };
    group.add(pts);
  }

  // ── bright stars with diffraction spikes ───────────────────────────────────────────────────────────
  let spikeMat = null;
  if (brightStars.length) {
    const N = brightStars.length;
    const pos = new Float32Array(N * 12), corner = new Float32Array(N * 8), flux = new Float32Array(N * 4),
      col = new Float32Array(N * 12), size = new Float32Array(N * 4), idx = [];
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    brightStars.forEach((s, i) => {
      const I = Math.min(1.6, 0.5 + s.I * 0.7);
      const sz = 22 + 30 * Math.min(1, s.I / 2);           // half-size, CSS px
      for (let v = 0; v < 4; v++) {
        const j = i * 4 + v;
        pos.set([s.dir.x, s.dir.y, s.dir.z], j * 3); corner.set(C[v], j * 2);
        flux[j] = I; col.set([s.col.r, s.col.g, s.col.b], j * 3); size[j] = sz;
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aFlux', new THREE.BufferAttribute(flux, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setIndex(idx);
    spikeMat = own(new THREE.ShaderMaterial({
      ...common,
      uniforms: { uViewport: { value: new THREE.Vector4(0, 0, 1, 1) }, uPR: { value: 1 }, uTime: time,
        uSpike: { value: 1 }, uRot: { value: 0.26 + rnd() * 0.2 } },
      vertexShader: SPIKE_VS, fragmentShader: SPIKE_FS,
    }));
    const mesh = new THREE.Mesh(g, spikeMat);
    mesh.renderOrder = -1e6 + 2; mesh.frustumCulled = false; mesh.name = 'backdrop.brightStars';
    mesh.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(spikeMat.uniforms.uViewport.value);
      spikeMat.uniforms.uPR.value = renderer.getPixelRatio();
    };
    group.add(mesh);
  }

  // ── sun ───────────────────────────────────────────────────────────────────────────────────────────
  // a quad at 0.9 of the backdrop radius, built facing the centre; half-size 6.5° (corona), disc ≈ 0.4° radius
  const SUN_R = 0.9;
  const sunHalf = Math.tan(THREE.MathUtils.degToRad(6.5 * sunSize)) * SUN_R;
  const sunMat = own(new THREE.ShaderMaterial({
    ...common,
    uniforms: { uCol: { value: sunColor }, uDisc: { value: 2.5 }, uRd: { value: 0.062 }, uTime: time,
      uSeed: { value: rnd() * 10 }, uIntensity: { value: sunIntensity } },
    vertexShader: SUN_VS, fragmentShader: SUN_FS,
  }));
  const sun = new THREE.Mesh(own(new THREE.PlaneGeometry(sunHalf * 2, sunHalf * 2)), sunMat);
  sun.position.copy(sunDirection).multiplyScalar(SUN_R);
  sun.lookAt(0, 0, 0);                                     // plane +Z faces the centre (where the camera is)
  sun.renderOrder = -1e6 + 3; sun.frustumCulled = false; sun.name = 'backdrop.sun';
  group.add(sun);
  // the anchor a lens flare hangs from (no rotation, so a child Lensflare is simply at the sun)
  const sunAnchor = new THREE.Object3D();
  sunAnchor.name = 'backdrop.sunAnchor';
  sunAnchor.position.copy(sunDirection).multiplyScalar(SUN_R);
  group.add(sunAnchor);

  // ── env scene for PMREM ───────────────────────────────────────────────────────────────────────────
  const envScene = new THREE.Scene();
  {
    const avg = lin(pal.a).add(lin(pal.b)).multiplyScalar(0.5 * nebulaIntensity * 0.45).add(lin(pal.deep));
    const sky = new THREE.Mesh(own(new THREE.SphereGeometry(50, 24, 12)),
      own(new THREE.MeshBasicMaterial({ color: avg.multiplyScalar(1.2), side: THREE.BackSide, fog: false, toneMapped: false })));
    envScene.add(sky);
    // faint cool band along the galactic plane — gives the hull a soft cool streak in its reflections
    const band = new THREE.Mesh(own(new THREE.CylinderGeometry(40, 40, 9, 32, 1, true)),
      own(new THREE.MeshBasicMaterial({ color: lin(pal.fill).multiplyScalar(0.05), side: THREE.DoubleSide, fog: false, toneMapped: false })));
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bandN);
    envScene.add(band);
    // the sun card: emissive, a little larger than the visible disc so specular highlights have some body
    const card = new THREE.Mesh(own(new THREE.CircleGeometry(2.2, 24)),
      own(new THREE.MeshBasicMaterial({ color: sunColor.clone().multiplyScalar(30 * sunIntensity), fog: false, toneMapped: false })));
    card.position.copy(sunDirection).multiplyScalar(30);
    card.lookAt(0, 0, 0);
    envScene.add(card);
  }

  const camPos = new THREE.Vector3();
  const sunWorld = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  function update(dt, camera) {
    time.value += dt || 0;
    if (!camera) return;
    camera.getWorldPosition(camPos);
    group.position.copy(camPos);
    const r = (camera.isPerspectiveCamera ? camera.far : 1000) * 0.9;
    group.scale.setScalar(r);
    group.updateMatrixWorld(true);
  }

  /** World position of the sun this frame (after update). */
  function sunWorldPosition(target = new THREE.Vector3()) {
    return target.copy(sunDirection).multiplyScalar(SUN_R * group.scale.x).add(group.position);
  }

  /** Where the sun is on screen: { visible, x, y } in NDC (−1..1); visible = in front of the camera and on screen. */
  function sunScreenVisible(camera) {
    sunWorldPosition(sunWorld);
    ndc.copy(sunWorld).project(camera);
    const inFront = camera.getWorldDirection(camPos).dot(sunDirection) > 0;
    return { visible: inFront && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1, x: ndc.x, y: ndc.y };
  }

  function dispose() {
    group.parent && group.parent.remove(group);
    for (const d of disposables) d.dispose();
    disposables.length = 0;
  }

  return {
    group, sunDirection, sunColor, envScene, sunAnchor, update, sunWorldPosition, sunScreenVisible, dispose,
    /** live knobs */
    uniforms: { nebulaIntensity: nebMat.uniforms.uIntensity, sunIntensity: sunMat.uniforms.uIntensity, time },
    brightStarDirections: brightStars.map((s) => s.dir.clone()),
    stats: { drawCalls: 2 + (spikeMat ? 1 : 0) + 1, stars: pointStars.length + brightStars.length, brightStars: brightStars.length, tier },
  };
}
