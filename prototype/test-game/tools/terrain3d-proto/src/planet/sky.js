// ── Airborne particles per planet (pollen, petals, dust, ash + embers, snow, spores) ─────────────────────
// A box of particles around the camera target, wrapped so it never runs out; drawn with the FX batches'
// shader (velocity-stretched quads). Two small batches: one additive (glowing), one alpha (matter).
const AIR = { kind: null, p: [], add: null, norm: null };
const AIRK = {
  pollen: { n: 160, add: 1, col: [1.0, 0.95, 0.75], a: 0.55, size: [0.012, 0.02], vel: [0.25, 0.12, -0.1], jit: 0.15, y: [0.2, 3] },
  petals: { n: 240, add: 0, col: [1.0, 0.72, 0.85], a: 0.9, size: [0.018, 0.03], vel: [0.45, -0.28, -0.15], jit: 0.25, y: [0, 5], sway: 1 },
  dust:   { n: 380, add: 0, col: [0.86, 0.68, 0.5], a: 0.22, size: [0.04, 0.09], vel: [1.6, 0.05, -0.5], jit: 0.4, y: [0, 2.2], streak: 0.6 },
  ash:    { n: 320, add: 0, col: [0.55, 0.52, 0.5], a: 0.75, size: [0.012, 0.022], vel: [0.3, -0.35, -0.12], jit: 0.2, y: [0, 6], sway: 1, ember: 50 },
  snow:   { n: 520, add: 0, col: [1, 1, 1], a: 0.9, size: [0.014, 0.026], vel: [0.35, -0.75, -0.1], jit: 0.18, y: [0, 7], sway: 1 },
  chem:   { n: 150, add: 0, col: [0.78, 0.88, 0.36], a: 0.16, size: [0.14, 0.28], vel: [0.45, 0.05, -0.15], jit: 0.2, y: [0.2, 2.4] },
  spores: { n: 220, add: 1, col: null, a: 0.85, size: [0.014, 0.026], vel: [0.1, 0.18, 0.05], jit: 0.12, y: [0.1, 3.5], bob: 1 },
};
const SPORE_COLS = [[0.48, 1.0, 0.88], [1.0, 0.48, 0.91], [0.78, 1.0, 0.35]];
function buildAir() { AIR.add = new PBatch(800, true, 4.25); AIR.norm = new PBatch(800, false, 4.05); }
function setAir(kind) {
  AIR.kind = kind || null; AIR.p = [];
  const K = AIRK[kind]; if (!K) return;
  const box = () => ({ x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2, y: K.y[0] + Math.random() * (K.y[1] - K.y[0]) });
  for (let i = 0; i < K.n; i++) AIR.p.push(Object.assign(box(), { s: K.size[0] + Math.random() * (K.size[1] - K.size[0]), ph: Math.random() * 6.28,
    c: K.col || SPORE_COLS[i % 3], add: K.add, ember: false }));
  for (let i = 0; i < (K.ember || 0); i++) AIR.p.push(Object.assign(box(), { s: 0.014, ph: Math.random() * 6.28, c: [1, 0.55, 0.2], add: 1, ember: true }));
}
function drawAir(dt, t) {
  AIR.add.begin(); AIR.norm.begin();
  const K = AIRK[AIR.kind];
  if (K) {
    // particles live in a normalised box [-1,1] around the camera target, scaled to the view
    const W = Math.max(8, cam.dist * 0.75), D = Math.max(6, cam.dist * 0.6), H = K.y[1] - K.y[0];
    for (const q of AIR.p) {
      const vx = K.vel[0] + (q.ember ? 0 : 0), vy = q.ember ? 0.6 : K.vel[1], vz = K.vel[2];
      const sw = K.sway ? Math.sin(t * 1.3 + q.ph) * 0.35 : 0, bob = K.bob ? Math.sin(t * 0.9 + q.ph) * 0.12 : 0;
      q.x += ((vx + sw) * dt) / W; q.z += ((vz + Math.cos(t * 1.1 + q.ph) * K.jit) * dt) / D; q.y += (vy + bob) * dt;
      if (q.x > 1) q.x -= 2; if (q.x < -1) q.x += 2; if (q.z > 1) q.z -= 2; if (q.z < -1) q.z += 2;
      if (q.y < K.y[0]) q.y += H; if (q.y > K.y[1]) q.y -= H;
      const tw = K.add ? 0.6 + 0.4 * Math.sin(t * 3 + q.ph * 3) : 1, edge = Math.min(1, (1 - Math.abs(q.x)) * 4) * Math.min(1, (1 - Math.abs(q.z)) * 4);
      const a = (q.ember ? 0.9 : K.a) * tw * edge;
      const B = q.add ? AIR.add : AIR.norm;
      B.push(cam.tx + q.x * W, q.y, cam.tz + q.z * D, vx + sw, vy, vz, q.s, (K.streak || 0) * q.s * 6, q.c[0] * (q.add ? a : 1), q.c[1] * (q.add ? a : 1), q.c[2] * (q.add ? a : 1), q.add ? 1 : a);
    }
  }
  AIR.add.end(); AIR.norm.end();
}

// ── Globe: the current planet from orbit (HUD card). Own small WebGL canvas. ─────────────────────────────
// Procedural surface from 3D value-noise fbm on the sphere normal: ocean below `water`, land ramp from
// lowland to peaks, a dry/lush biome noise (lushness), polar caps, lava seas (Cinder); a drifting cloud
// shell; an atmosphere shell (fresnel rim in the haze colour, brightest on the day side) and a soft
// terminator. All parameters come from the planet definition.
const GLOBE = {};
const GNOISE = `
float gh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * gn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;
function buildGlobe() {
  const cv = $('globe'); if (!cv) return;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const sc = new THREE.Scene(), cm = new THREE.PerspectiveCamera(28, 1, 0.1, 20); cm.position.set(0, 0, 4.6);
  const U = { uOcean: { value: [new THREE.Color(), new THREE.Color()] }, uLand: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    uDry: { value: new THREE.Color() }, uWater: { value: 0.5 }, uPolar: { value: 0.1 }, uLush: { value: 1 }, uLava: { value: 0 }, uSeed: { value: 0 },
    uSun: { value: new THREE.Vector3(-0.6, 0.35, 0.72).normalize() }, uHaze: { value: new THREE.Color() }, uCloud: { value: 0.5 }, uT: { value: 0 }, uCrater: { value: 0 } };
  const VS = `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const surf = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: `
    uniform vec3 uOcean[2]; uniform vec3 uLand[4]; uniform vec3 uDry; uniform float uWater, uPolar, uLush, uLava, uSeed; uniform vec3 uSun; uniform vec3 uHaze; uniform float uCrater;
    varying vec3 vN; varying vec3 vP; varying vec3 vV; ${GNOISE}
    void main() {
      vec3 p = normalize(vP) * 2.1 + uSeed;
      float h = fbm(p), bio = fbm(p * 1.7 + 5.3), lat = abs(normalize(vP).y);
      vec3 c;
      if (h < uWater) { c = mix(uOcean[0], uOcean[1], smoothstep(uWater - 0.12, uWater, h)); if (uLava > 0.5) c *= 1.0 + 0.6 * gn(p * 9.0); }
      else { float e = (h - uWater) / max(1.0 - uWater, 0.01);
        c = e < 0.45 ? mix(uLand[0], uLand[1], e / 0.45) : e < 0.8 ? mix(uLand[1], uLand[2], (e - 0.45) / 0.35) : mix(uLand[2], uLand[3], (e - 0.8) / 0.2);
        c = mix(c, uDry, smoothstep(0.55, 0.75, bio) * (1.0 - uLush) * 0.9 + smoothstep(0.62, 0.8, bio) * 0.25); }
      if (uCrater > 0.5) { vec3 q = normalize(vP) * 7.0 + uSeed; vec3 ci = floor(q); float dmin = 9.0;     // craters: nearest random pit per cell
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) { vec3 o = ci + vec3(float(i), float(j), float(k)); vec3 cpt = o + vec3(gh(o), gh(o + 3.1), gh(o + 7.7)); dmin = min(dmin, length(q - cpt) / (0.25 + 0.5 * gh(o + 1.3))); }
        c *= 0.78 + 0.22 * smoothstep(0.55, 0.85, dmin) + 0.18 * (1.0 - smoothstep(0.85, 1.0, dmin)) * step(0.85, dmin) ; }
      float cap = smoothstep(1.0 - uPolar - 0.04, 1.0 - uPolar + 0.04, lat + (gn(p * 4.0) - 0.5) * 0.12);
      c = mix(c, vec3(0.93, 0.96, 1.0), cap * step(0.001, uPolar));
      float nl = dot(normalize(vN), uSun), day = smoothstep(-0.15, 0.35, nl);
      vec3 col = c * (0.08 + 1.05 * max(nl, 0.0)) ;
      if (uLava > 0.5 && h < uWater) col += uOcean[0] * 0.55 * (1.0 - day);        // lava glows on the night side
      float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.5);
      col = mix(col, uHaze * (0.25 + day), rim * 0.75);
      gl_FragColor = vec4(col, 1.0);
    }` });
  const clouds = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, transparent: true, depthWrite: false, fragmentShader: `
    uniform float uCloud, uT, uSeed; uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${GNOISE}
    void main() { vec3 p = normalize(vP) * 3.2 + vec3(uT * 0.05, 0.0, uSeed);
      float c = smoothstep(1.0 - uCloud * 0.55, 1.0 - uCloud * 0.55 + 0.18, fbm(p) + 0.18);
      float nl = max(dot(normalize(vN), uSun), 0.0); gl_FragColor = vec4(vec3(0.95) * (0.1 + nl), c * 0.85); }` });
  const atmo = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fragmentShader: `
    uniform vec3 uHaze; uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
    void main() { float f = pow(clamp(-dot(normalize(vN), vV) * 1.9, 0.0, 1.0), 2.2) * 1.15;   // 0 at the shell edge, full at the planet's limb
      float day = smoothstep(-0.4, 0.5, dot(normalize(vN), uSun));
      gl_FragColor = vec4(uHaze * f * (0.25 + day), 1.0); }` });
  const g = new THREE.SphereGeometry(1, 72, 48);
  const planet = new THREE.Mesh(g, surf), cl = new THREE.Mesh(g, clouds), at = new THREE.Mesh(g, atmo);
  cl.scale.setScalar(1.015); at.scale.setScalar(1.16); planet.rotation.z = cl.rotation.z = 0.35;
  sc.add(planet, cl, at);
  Object.assign(GLOBE, { r, sc, cm, U, planet, cl, cv });
}
function setGlobe(P) {
  const card = $('planetCard'); if (!card) return;
  const pl = P && P.planet && PLANETS[P.planet]; card.hidden = !pl; if (!pl || !GLOBE.r) return;
  const g = pl.globe, U = GLOBE.U;
  U.uOcean.value[0].set(g.ocean[0]); U.uOcean.value[1].set(g.ocean[1]); g.land.forEach((c, i) => U.uLand.value[i].set(c));
  U.uDry.value.set(g.dry); U.uWater.value = 0.32 + g.water * 0.3 - (g.water === 0 ? 0.5 : 0); U.uPolar.value = g.polar; U.uLush.value = pl.lush;
  U.uLava.value = g.lava ? 1 : 0; U.uCrater.value = g.craters ? 1 : 0; U.uCloud.value = g.cloud; U.uHaze.value.setHex(pl.atmo.haze); U.uSeed.value = Object.keys(PLANETS).indexOf(P.planet) * 3.7;
  const fe = Object.entries(FACTION_PLANET).find(([, v]) => v.planet === P.planet); $('planetFaction').textContent = fe ? `Faction ${fe[0]} · ${fe[1].faction}` : ''; $('planetName').textContent = pl.name; $('planetBlurb').textContent = pl.blurb;
  $('planetLush').style.left = Math.round(pl.lush * 100) + '%';
}
function drawGlobe(dt) {
  if (!GLOBE.r || $('planetCard').hidden) return;
  const cv = GLOBE.cv, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * GLOBE.r.getPixelRatio())) { GLOBE.r.setSize(w, h, false); GLOBE.cm.aspect = w / h; GLOBE.cm.updateProjectionMatrix(); }
  GLOBE.planet.rotation.y += dt * 0.12; GLOBE.cl.rotation.y += dt * 0.15; GLOBE.U.uT.value += dt;
  GLOBE.r.render(GLOBE.sc, GLOBE.cm);
}
