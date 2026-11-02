// engineFx.js — capital-ship exhaust, driven by the engine_N markers in each ship GLB.  [MM-story_mvzrzcjh_1z]
//
//   const fx = createEngineFx(THREE, shipRoot);   // after loading a ship GLB
//   fx.setIntensity(1);                           // 0 = cold, 0.35 idle, 1 cruise, 2 story burn (any value works)
//   fx.update(dtSeconds, camera);                 // every frame
//
// Cost: TWO draw calls per ship whatever its engine count — every plume (inner core + outer flame) is one
// merged mesh and every nozzle bloom is one merged billboard mesh; all motion is in the shaders. One
// PointLight per ship tints the stern. Colour comes from the marker's extras.color (faction propulsion).
//
// Look: a white-hot core with Mach diamonds just behind the nozzle, a faction-coloured flame that thins and
// cools along its length, scrolling turbulence, a soft flicker, and a nozzle bloom that dominates when the
// camera looks up the exhaust from behind (the shot the plume alone can't sell).

const PLUME_VS = `
attribute vec3 aOrigin; attribute float aRadius; attribute float aT; attribute float aTheta;
attribute float aLayer; attribute float aSeed; attribute vec3 aColor;
uniform float uTime; uniform float uK;
varying float vT; varying float vLayer; varying vec3 vColor; varying float vEdge; varying float vSeed; varying float vTheta;
void main() {
  float k = max(uK, 0.0);
  float flick = 1.0 + 0.06 * sin(uTime * 23.0 + aSeed * 7.0) + 0.04 * sin(uTime * 37.0 + aSeed * 3.0);
  float len = aRadius * (aLayer < 0.5 ? (1.2 + 2.6 * k) : (2.4 + 7.5 * k)) * flick;
  float bulge = aLayer < 0.5 ? (0.5 * (1.0 - aT)) : (0.8 + 0.2 * sin(aT * 3.14159) - 0.75 * aT * aT);
  float r = aRadius * max(bulge, 0.02) * (0.85 + 0.15 * min(k, 1.0));
  vec3 p = aOrigin + vec3(-aT * len, cos(aTheta) * r, sin(aTheta) * r);
  vT = aT; vLayer = aLayer; vColor = aColor; vSeed = aSeed; vTheta = aTheta;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 nrm = normalize(normalMatrix * vec3(0.0, cos(aTheta), sin(aTheta)));
  vEdge = abs(dot(nrm, normalize(-mv.xyz)));        // 1 = facing the camera, 0 = silhouette
  gl_Position = projectionMatrix * mv;
}`;

const PLUME_FS = `
uniform float uTime; uniform float uK;
varying float vT; varying float vLayer; varying vec3 vColor; varying float vEdge; varying float vSeed; varying float vTheta;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float k = clamp(uK, 0.0, 3.0);
  if (k <= 0.001) discard;
  float core = vLayer < 0.5 ? 1.0 : 0.0;
  // turbulence scrolls down the plume
  float n = noise(vec2(vTheta * 2.0 + vSeed, vT * 6.0 - uTime * 9.0)) * 0.6
          + noise(vec2(vTheta * 5.0, vT * 14.0 - uTime * 17.0)) * 0.4;
  float fade = pow(1.0 - vT, core > 0.5 ? 1.2 : 1.7);
  float soft = pow(vEdge, core > 0.5 ? 0.8 : 1.6);           // feathered silhouette, no hard cone edge
  // Mach diamonds in the core
  float diamonds = core * (0.55 + 0.45 * pow(abs(sin(vT * 18.0 - uTime * 2.0)), 6.0));
  float a = fade * soft * (core > 0.5 ? diamonds : (0.3 + 0.35 * n)) * min(k, 1.0);   // throttle lengthens, not whitens
  vec3 hot = mix(vColor, vec3(1.0), core > 0.5 ? 0.55 : 0.15 * (1.0 - vT));
  vec3 cool = vColor * mix(1.0, 0.45, vT);                  // cools and deepens toward the tail
  vec3 col = mix(hot, cool, smoothstep(0.0, 0.7, vT)) * (core > 0.5 ? 1.05 : 0.8) * (0.7 + 0.3 * k);
  gl_FragColor = vec4(col, a);   // additive: src·alpha + dst
}`;

const GLOW_VS = `
attribute vec3 aOrigin; attribute float aRadius; attribute vec2 aCorner; attribute vec3 aColor; attribute float aSeed;
uniform float uTime; uniform float uK;
varying vec2 vUv; varying vec3 vColor; varying float vBehind;
void main() {
  float k = max(uK, 0.0);
  vec4 mvO = modelViewMatrix * vec4(aOrigin, 1.0);
  // how directly the camera looks up the exhaust (engines thrust along -X in ship space)
  vec3 axis = normalize((modelViewMatrix * vec4(-1.0, 0.0, 0.0, 0.0)).xyz);
  vBehind = clamp(dot(axis, normalize(-mvO.xyz)), 0.0, 1.0);
  float flick = 1.0 + 0.05 * sin(uTime * 31.0 + aSeed * 5.0);
  float size = aRadius * (1.6 + 1.4 * min(k, 2.0) + 2.2 * vBehind * min(k, 1.5)) * flick;
  mvO.xy += aCorner * size;
  vUv = aCorner; vColor = aColor;
  gl_Position = projectionMatrix * mvO;
}`;

const GLOW_FS = `
uniform float uK;
varying vec2 vUv; varying vec3 vColor; varying float vBehind;
void main() {
  float k = clamp(uK, 0.0, 3.0);
  float d = length(vUv);
  if (d > 1.0 || k <= 0.001) discard;
  float halo = pow(1.0 - d, 2.2);
  float hot = pow(max(1.0 - d * 2.4, 0.0), 2.0);             // white-hot centre
  float ring = smoothstep(0.42, 0.36, abs(d - 0.38)) * 0.35 * vBehind;  // nozzle lip, seen from behind
  vec3 col = vColor * halo * 1.1 + mix(vColor, vec3(1.0), 0.6) * hot * (0.45 + 0.6 * vBehind) + vColor * ring;
  float a = (halo * 0.7 + hot) * min(k, 1.2) * (0.5 + 0.4 * vBehind);
  gl_FragColor = vec4(col, a);   // additive: src·alpha + dst
}`;

const SEG_T = 14, SEG_R = 14;

export function createEngineFx(THREE, root, { pointLight = true } = {}) {
  const engines = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((o) => {
    if (!/^engine_\d+$/.test(o.name)) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
    const ex = o.userData || {};
    const c = ex.color || [0.6, 0.8, 1.0];
    engines.push({ p, r: ex.radius || o.scale.x || 0.4, color: new THREE.Color(c[0], c[1], c[2]) });
  });
  const uniforms = { uTime: { value: 0 }, uK: { value: 1 } };
  const group = new THREE.Group();
  group.name = 'engineFx';
  if (!engines.length) return { group, setIntensity() {}, update() {}, engines };

  // plumes: per engine, two layers (0 core, 1 flame) of a SEG_T × SEG_R tube, all in one geometry
  const P = { aOrigin: [], aRadius: [], aT: [], aTheta: [], aLayer: [], aSeed: [], aColor: [] };
  const idx = [];
  let base = 0;
  engines.forEach((e, ei) => {
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i <= SEG_T; i++) {
        for (let j = 0; j <= SEG_R; j++) {
          P.aOrigin.push(e.p.x, e.p.y, e.p.z); P.aRadius.push(e.r);
          P.aT.push(i / SEG_T); P.aTheta.push((j / SEG_R) * Math.PI * 2);
          P.aLayer.push(layer); P.aSeed.push(ei * 1.37 + layer); P.aColor.push(e.color.r, e.color.g, e.color.b);
        }
      }
      for (let i = 0; i < SEG_T; i++) {
        for (let j = 0; j < SEG_R; j++) {
          const a = base + i * (SEG_R + 1) + j, b = a + SEG_R + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      base += (SEG_T + 1) * (SEG_R + 1);
    }
  });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(P.aT.length * 3), 3));
  pg.setAttribute('aOrigin', new THREE.Float32BufferAttribute(P.aOrigin, 3));
  pg.setAttribute('aRadius', new THREE.Float32BufferAttribute(P.aRadius, 1));
  pg.setAttribute('aT', new THREE.Float32BufferAttribute(P.aT, 1));
  pg.setAttribute('aTheta', new THREE.Float32BufferAttribute(P.aTheta, 1));
  pg.setAttribute('aLayer', new THREE.Float32BufferAttribute(P.aLayer, 1));
  pg.setAttribute('aSeed', new THREE.Float32BufferAttribute(P.aSeed, 1));
  pg.setAttribute('aColor', new THREE.Float32BufferAttribute(P.aColor, 3));
  pg.setIndex(idx);
  const fxMat = (vs, fs) => new THREE.ShaderMaterial({
    uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const plumes = new THREE.Mesh(pg, fxMat(PLUME_VS, PLUME_FS));
  plumes.frustumCulled = false;            // vertices are placed in the shader
  plumes.renderOrder = 10;

  // nozzle blooms: one camera-facing quad per engine, one geometry
  const G = { aOrigin: [], aRadius: [], aCorner: [], aColor: [], aSeed: [] };
  const gi = [];
  engines.forEach((e, ei) => {
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => {
      G.aOrigin.push(e.p.x - 0.02, e.p.y, e.p.z); G.aRadius.push(e.r); G.aCorner.push(u, v);
      G.aColor.push(e.color.r, e.color.g, e.color.b); G.aSeed.push(ei * 2.1);
    });
    const b = ei * 4; gi.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(engines.length * 12), 3));
  gg.setAttribute('aOrigin', new THREE.Float32BufferAttribute(G.aOrigin, 3));
  gg.setAttribute('aRadius', new THREE.Float32BufferAttribute(G.aRadius, 1));
  gg.setAttribute('aCorner', new THREE.Float32BufferAttribute(G.aCorner, 2));
  gg.setAttribute('aColor', new THREE.Float32BufferAttribute(G.aColor, 3));
  gg.setAttribute('aSeed', new THREE.Float32BufferAttribute(G.aSeed, 1));
  gg.setIndex(gi);
  const glows = new THREE.Mesh(gg, fxMat(GLOW_VS, GLOW_FS));
  glows.frustumCulled = false;
  glows.renderOrder = 11;

  group.add(plumes, glows);
  let light = null;
  if (pointLight) {
    const c = new THREE.Vector3(), col = new THREE.Color(0, 0, 0);
    let rmax = 0;
    engines.forEach((e) => { c.add(e.p); col.add(e.color); rmax = Math.max(rmax, e.r); });
    c.divideScalar(engines.length); col.multiplyScalar(1 / engines.length);
    light = new THREE.PointLight(col, 0, rmax * 30, 2);
    light.position.copy(c).add(new THREE.Vector3(-rmax * 3, 0, 0));
    group.add(light);
  }
  root.add(group);

  let k = 1, shown = 1;
  return {
    group, engines,
    setIntensity(v) { k = Math.max(0, v); },
    get intensity() { return k; },
    update(dt) {
      shown += (k - shown) * Math.min(1, dt * 3);        // spool up and down instead of snapping
      uniforms.uTime.value += dt;
      uniforms.uK.value = shown;
      if (light) light.intensity = 2.5 * shown;
    },
    dispose() { pg.dispose(); gg.dispose(); plumes.material.dispose(); glows.material.dispose(); root.remove(group); },
  };
}

// Every ship GLB carries the same two materials and the same shared panel textures. Swap in ONE body
// material and ONE unlit glow material for the whole fleet, so the textures sit in GPU memory once and
// ships batch well. ship_glow is unlit by design (glTF can't express emissive-by-vertex-colour).
const fleet = {};
export function prepareShip(THREE, root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.name === 'ship_glow') {
      fleet.glow = fleet.glow || new THREE.MeshBasicMaterial({ name: 'ship_glow', vertexColors: true, toneMapped: false });
      if (m !== fleet.glow) m.dispose();
      o.material = fleet.glow;
    } else if (m.name === 'ship_body') {
      if (!fleet.body) { fleet.body = m; return; }
      if (m !== fleet.body) { m.map && m.map.dispose(); m.normalMap && m.normalMap.dispose(); m.dispose(); }
      o.material = fleet.body;
    }
  });
  return root;
}
