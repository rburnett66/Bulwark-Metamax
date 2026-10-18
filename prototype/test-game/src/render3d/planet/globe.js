/**
 * src/render3d/planet/globe.js — a faction homeworld as a live globe: continents from noise on the sphere, oceans or
 * lava seas, ice caps, craters, a drifting cloud shell and an atmosphere rim in the planet's haze colour (the "Bulwark
 * Planets" design page's shaders). Shared by the menu's planet views (menu/menuStage.js) and the PNG bake
 * (tools/planets/bake.html), so the live globe and the baked card image are the same planet. [MM-story_mvcnxgt8_13]
 *
 *   const g = makeGlobe(THREE, 'water', { geo });   scene.add(g.root);   each frame: g.spin(dt)  (or set g.yaw)
 * THREE is injected (no import).
 */
import { PLANETS } from '../../data/planets.js';

export const GLOBE_KEYS = Object.keys(PLANETS);   // faction order — the noise seed index, same as the design page
export const SUN_DIR = Object.freeze([-0.62, 0.32, 0.72]);

export const GNOISE = `
float gh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float gn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * gn(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;
export const VS = `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
export const SURF = `uniform vec3 uOcean[2]; uniform vec3 uLand[4]; uniform vec3 uDry; uniform float uWater, uPolar, uLush, uLava, uSeed; uniform vec3 uSun; uniform vec3 uHaze; uniform float uCrater;
  varying vec3 vN; varying vec3 vP; varying vec3 vV; ${GNOISE}
  void main() {
    vec3 p = normalize(vP) * 2.1 + uSeed;
    float h = fbm(p), bio = fbm(p * 1.7 + 5.3), lat = abs(normalize(vP).y);
    vec3 c;
    if (h < uWater) { c = mix(uOcean[0], uOcean[1], smoothstep(uWater - 0.12, uWater, h)); if (uLava > 0.5) c *= 1.0 + 0.6 * gn(p * 9.0); }
    else { float e = (h - uWater) / max(1.0 - uWater, 0.01);
      c = e < 0.45 ? mix(uLand[0], uLand[1], e / 0.45) : e < 0.8 ? mix(uLand[1], uLand[2], (e - 0.45) / 0.35) : mix(uLand[2], uLand[3], (e - 0.8) / 0.2);
      c = mix(c, uDry, smoothstep(0.55, 0.75, bio) * (1.0 - uLush) * 0.9 + smoothstep(0.62, 0.8, bio) * 0.25); }
    if (uCrater > 0.5) { vec3 q = normalize(vP) * 7.0 + uSeed; vec3 ci = floor(q); float dmin = 9.0;
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) { vec3 o = ci + vec3(float(i), float(j), float(k)); vec3 cpt = o + vec3(gh(o), gh(o + 3.1), gh(o + 7.7)); dmin = min(dmin, length(q - cpt) / (0.25 + 0.5 * gh(o + 1.3))); }
      c *= 0.78 + 0.22 * smoothstep(0.55, 0.85, dmin) + 0.18 * (1.0 - smoothstep(0.85, 1.0, dmin)) * step(0.85, dmin); }
    // richer primary colours (owner 2026-10-17): push the surface away from its grey by 35% [MM-task_mvd3p8tl_m]
    { float L = dot(c, vec3(0.299, 0.587, 0.114)); c = clamp(mix(vec3(L), c, 1.35), 0.0, 1.0); }
    float cap = smoothstep(1.0 - uPolar - 0.04, 1.0 - uPolar + 0.04, lat + (gn(p * 4.0) - 0.5) * 0.12);
    c = mix(c, vec3(0.93, 0.96, 1.0), cap * step(0.001, uPolar));
    float nl = dot(normalize(vN), uSun), day = smoothstep(-0.15, 0.35, nl);
    vec3 col = c * (0.06 + 1.05 * max(nl, 0.0));
    if (uLava > 0.5 && h < uWater) col += uOcean[0] * 0.6 * (1.0 - day);
    float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.5);
    col = mix(col, uHaze * (0.25 + day), rim * 0.375);   // rim haze halved (owner 2026-10-17)
    gl_FragColor = vec4(col, 1.0);
  }`;
export const CLOUD = `uniform float uCloud, uT, uSeed; uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${GNOISE}
  void main() { vec3 p = normalize(vP) * 3.2 + vec3(uT * 0.05, 0.0, uSeed);
    float c = smoothstep(1.0 - uCloud * 0.55, 1.0 - uCloud * 0.55 + 0.18, fbm(p) + 0.18);
    float nl = max(dot(normalize(vN), uSun), 0.0); gl_FragColor = vec4(vec3(0.95) * (0.08 + nl), c * 0.85); }`;
// Additive on black in the design page; here the halo's brightness becomes its alpha so it sits on any card colour.
export const ATMO = `uniform vec3 uHaze; uniform vec3 uSun; varying vec3 vN; varying vec3 vV;
  void main() { float f = pow(clamp(-dot(normalize(vN), vV) * 1.9, 0.0, 1.0), 2.2) * 0.575;   // halo halved (owner 2026-10-17)
    float day = smoothstep(-0.4, 0.5, dot(normalize(vN), uSun));
    vec3 c = uHaze * f * (0.25 + day); float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
    gl_FragColor = vec4(c / max(a, 1e-3), a); }`;


/**
 * Build one globe. opts: geo (a shared SphereGeometry; default 96×64), additive (halo blended additively — on
 * black space; default false: its brightness is its alpha, so it sits on any background).
 * → { root, planet, clouds, uniforms, yaw, spin(dt, speed), dispose() }
 */
export function makeGlobe(THREE, key, opts = {}) {
  const pl = PLANETS[key] || PLANETS.ground, g = pl.globe, i = Math.max(0, GLOBE_KEYS.indexOf(key));
  const geo = opts.geo || new THREE.SphereGeometry(1, 96, 64), own = !opts.geo;
  const sun = new THREE.Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
  const U = { uOcean: { value: g.ocean.map((c) => new THREE.Color(c)) }, uLand: { value: g.land.map((c) => new THREE.Color(c)) }, uDry: { value: new THREE.Color(g.dry) },
    uWater: { value: 0.32 + g.water * 0.3 }, uPolar: { value: g.polar }, uLush: { value: pl.lush }, uLava: { value: g.lava ? 1 : 0 },
    uSeed: { value: i * 3.7 }, uSun: { value: sun }, uHaze: { value: new THREE.Color(pl.haze) }, uCloud: { value: g.cloud }, uT: { value: 0 }, uCrater: { value: g.craters ? 1 : 0 } };
  const planet = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: SURF }));
  const clouds = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: CLOUD, transparent: true, depthWrite: false }));
  const atmo = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: ATMO, transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  clouds.scale.setScalar(1.015); atmo.scale.setScalar(1.16);
  const tilt = new THREE.Group(); tilt.rotation.z = 0.35; tilt.add(planet, clouds);
  const root = new THREE.Group(); root.add(atmo, tilt);   // halo first, the globe over it
  const G = {
    root, planet, clouds, uniforms: U, yaw: i * 0.9,   // the design page's opening pose
    /** Advance the spin (rad/s) and the cloud drift. */
    spin(dt, speed = 0.12) { G.yaw += dt * speed; U.uT.value += dt; G.pose(); },
    pose() { planet.rotation.y = G.yaw; clouds.rotation.y = G.yaw * 1.2; },
    dispose() { for (const m of [planet, clouds, atmo]) m.material.dispose(); if (own) geo.dispose(); },
  };
  G.pose();
  return G;
}
