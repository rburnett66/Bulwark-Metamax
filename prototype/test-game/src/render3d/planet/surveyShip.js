/**
 * src/render3d/planet/surveyShip.js — the SURVEY SHIP in orbit around a menu globe, scanning the surface
 * [MM-story_mvoi0e36_3]. Owner 2026-10-25: a planet the player can campaign on has the survey ship in orbit doing
 * its surveys; a locked planet's space stays clean (menu.js decides which, menuStage.js draws it).
 *
 * The hull is the resource ship of the orbital-survey design page (MM-story_mvaa99py_u): a six-sided hull with a
 * bridge, four ore pods, radiator fins, twin engines and a survey dish on the belly. It flies an inclined circular
 * orbit round a unit-radius globe (passing in front of the disc and behind it), belly to the planet, and sweeps the
 * ground below with a scan beam in bursts; a footprint ring marks where the beam lands.
 *
 *   const s = makeSurveyShip(THREE);   scene.add(s.root);   each frame: s.update(dt)   ·   s.dispose()
 *
 * Render-only; THREE is injected and nothing here needs a canvas, so it builds under node with the vendored three.
 * The beam, ring and lights are additive with brightness-as-alpha (as galaxyStage's light()) so they sit on the
 * menu's transparent canvas without painting black.
 */
import { SUN_DIR } from './globe.js';

export const SHIP = Object.freeze({
  orbit: 1.24,     // orbit radius, in planet radii (the globe's halo reaches 1.16)
  incl: 0.38,      // rad: the orbit plane's tilt off the camera's view axis, so a pass crosses the disc's upper half
  node: -0.5,      // rad: the orbit plane's turn about the view axis, so the track runs corner to corner
  speed: 0.28,     // rad/s along the orbit (~22 s a lap)
  scale: 0.046,    // hull units → planet radii (the hull is ~4.6 units nose to engines: ~0.2 R long)
  scanOn: 3.2,     // s the beam is on, then …
  scanOff: 1.6,    // … s it is off before the next sweep
  footprint: 0.1,  // the beam's ground footprint, in planet radii
});
const SCAN = 0x6fd3c8;

/** Where the ship is at orbit angle `a` (and which way it flies), for an orbit of radius r, tilt incl, node turn. */
export function orbitFrame(a, { orbit = SHIP.orbit, incl = SHIP.incl, node = SHIP.node } = {}) {
  // e1 across the view, e2 mostly toward the camera with a little lift; then the whole plane turned by `node`
  const cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(incl), si = Math.sin(incl);
  const e1 = [cn, sn, 0], e2 = [-sn * si, cn * si, ci];
  const c = Math.cos(a), s = Math.sin(a);
  const up = [c * e1[0] + s * e2[0], c * e1[1] + s * e2[1], c * e1[2] + s * e2[2]];   // unit: away from the planet
  const vel = [-s * e1[0] + c * e2[0], -s * e1[1] + c * e2[1], -s * e1[2] + c * e2[2]];   // unit: along the orbit
  return { pos: up.map((v) => v * orbit), up, vel };
}

/** Beam strength 0..1 at time t: bursts of scanOn seconds, scanOff apart, with soft edges. */
export function scanLevel(t, { scanOn = SHIP.scanOn, scanOff = SHIP.scanOff } = {}) {
  const p = ((t % (scanOn + scanOff)) + scanOn + scanOff) % (scanOn + scanOff);
  if (p >= scanOn) return 0;
  return Math.min(1, p / 0.35, (scanOn - p) / 0.35);
}

function additive(THREE, mat) {
  mat.transparent = true; mat.depthWrite = false;
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneFactor;
  mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneFactor;
  return mat;
}

export function makeSurveyShip(THREE, opts = {}) {
  const o = { ...SHIP, ...opts };
  const root = new THREE.Group(); root.name = 'surveyShip';
  const geos = [], mats = [];
  const keep = (g) => (geos.push(g), g), mat = (m) => (mats.push(m), m);

  // light for the hull only (the globe's shaders carry their own sun)
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.25); sun.position.set(SUN_DIR[0] * 5, SUN_DIR[1] * 5, SUN_DIR[2] * 5);
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2f38, 0.45);
  root.add(sun, fill);

  // ── the hull: ship local +Z = nose, +Y = dorsal (away from the planet), −Y = belly
  const ship = new THREE.Group(); ship.scale.setScalar(o.scale); root.add(ship);
  const M = (c, x = {}) => mat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.35, flatShading: true, ...x }));
  const hullM = M(0xb9c0bf), darkM = M(0x3b4246), paintM = M(0xd9a441, { roughness: 0.5 }),
    glassM = M(0x9ff3ea, { emissive: 0x6fd3c8, emissiveIntensity: 0.9 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(keep(geo), m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); ship.add(mesh); return mesh;
  };
  const H = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.5, 0.58, 2.8, 6), hullM, 0, 0, 0, H);
  add(new THREE.ConeGeometry(0.5, 0.9, 6), hullM, 0, 0, 1.85, H);
  add(new THREE.BoxGeometry(0.5, 0.28, 0.7), darkM, 0, 0.5, 0.9);                 // bridge
  add(new THREE.BoxGeometry(0.42, 0.06, 0.12), glassM, 0, 0.6, 1.26);             // bridge windows
  add(new THREE.BoxGeometry(2.6, 0.12, 0.22), darkM, 0, 0, -0.2);                 // cargo spine
  const pod = new THREE.CylinderGeometry(0.34, 0.34, 1.05, 8), band = new THREE.CylinderGeometry(0.355, 0.355, 0.1, 8);
  keep(pod); keep(band);
  for (const sx of [-1, 1]) for (const z of [0.45, -0.85]) {                       // four ore pods
    for (const [g, m, dz] of [[pod, paintM, 0], [band, darkM, 0.3], [band, darkM, -0.3]]) {
      const mesh = new THREE.Mesh(g, m); mesh.position.set(sx * 1.05, -0.05, z + dz); mesh.rotation.x = H; ship.add(mesh);
    }
  }
  const glowM = mat(additive(THREE, new THREE.MeshBasicMaterial({ color: 0x8ff0ff })));
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.9, 1.0), darkM, sx * 0.3, 0.75, -0.75, 0, 0, sx * -0.35);   // radiator fins
    add(new THREE.CylinderGeometry(0.24, 0.3, 0.7, 8), darkM, sx * 0.42, -0.08, -1.65, H);        // engines
    add(new THREE.SphereGeometry(0.2, 10, 8), glowM, sx * 0.42, -0.08, -2.02);                     // engine glow
  }
  add(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), darkM, 0, -0.22, 0.25);   // survey dish
  add(new THREE.SphereGeometry(0.1, 10, 8), glassM, 0, -0.5, 0.25);              // emitter
  // nav lights: port red, starboard green, a white strobe on the bridge
  const navs = [[-1.45, -0.05, -0.2, 0xff4a3a], [1.45, -0.05, -0.2, 0x5aff8a], [0, 0.72, 0.9, 0xffffff]].map(([x, y, z, c]) => {
    const m = mat(additive(THREE, new THREE.MeshBasicMaterial({ color: c })));
    return add(new THREE.SphereGeometry(0.11, 8, 6), m, x, y, z);
  });

  // ── the scan beam: an open cone from the dish to the ground (unit height, apex at y=0, opening down −y)
  const beamGeo = keep(new THREE.CylinderGeometry(0.02, 1, 1, 32, 1, true)); beamGeo.translate(0, -0.5, 0);
  const beamU = { uT: { value: 0 }, uOn: { value: 0 }, uC: { value: new THREE.Color(SCAN) } };
  const beam = new THREE.Mesh(beamGeo, mat(additive(THREE, new THREE.ShaderMaterial({ uniforms: beamU, side: THREE.DoubleSide,
    vertexShader: 'varying float vT; varying vec3 vN; varying vec3 vV; void main() { vT = -position.y; vec4 w = modelMatrix * vec4(position, 1.0);'
      + ' vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uT, uOn; uniform vec3 uC; varying float vT; varying vec3 vN; varying vec3 vV;'
      + ' void main() { float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);'
      + ' float bands = 0.55 + 0.45 * smoothstep(0.6, 1.0, fract(vT * 6.0 - uT * 1.6));'
      + ' float a = (0.10 + 0.55 * edge) * bands * (0.35 + 0.65 * vT) * smoothstep(0.0, 0.1, vT) * uOn;'
      + ' vec3 c = uC * a; gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }' }))));
  beam.frustumCulled = false; root.add(beam);
  // the footprint: a thin ring on the ground under the ship, pulsing outward while the beam is on
  const ringGeo = keep(new THREE.RingGeometry(0.86, 1, 40));
  const ringM = mat(additive(THREE, new THREE.MeshBasicMaterial({ color: SCAN, side: THREE.DoubleSide })));
  const ring = new THREE.Mesh(ringGeo, ringM); ring.frustumCulled = false; root.add(ring);

  let a = 0.35, t = 0;   // start just past the disc's right edge, inbound across the front
  const V = (v) => new THREE.Vector3(v[0], v[1], v[2]);
  const basis = new THREE.Matrix4(), zAxis = new THREE.Vector3(0, 0, 1), yAxis = new THREE.Vector3(0, 1, 0);
  const black = new THREE.Color(0, 0, 0), ringCol = new THREE.Color(SCAN), navCol = navs.map((n) => n.material.color.clone());

  function update(dt) {
    t += dt; a += dt * o.speed;
    const f = orbitFrame(a, o), up = V(f.up), nose = V(f.vel), side = new THREE.Vector3().crossVectors(up, nose).normalize();
    ship.position.copy(V(f.pos));
    ship.quaternion.setFromRotationMatrix(basis.makeBasis(side, up, nose));
    // beam: from the belly straight down to the ground; the cone's radius at the ground is the footprint
    const on = scanLevel(t, o), len = o.orbit - 1 - o.scale * 0.5;
    beam.position.copy(up).multiplyScalar(o.orbit - o.scale * 0.5);
    beam.quaternion.setFromUnitVectors(yAxis, up);
    beam.scale.set(o.footprint, len, o.footprint);
    beamU.uT.value = t; beamU.uOn.value = on; beam.visible = on > 0.01;
    const pulse = (t * 0.9) % 1;
    ring.position.copy(up).multiplyScalar(1.004);
    ring.quaternion.setFromUnitVectors(zAxis, up);
    ring.scale.setScalar(o.footprint * (0.55 + 0.6 * pulse));
    ringM.color.copy(black).lerp(ringCol, on * (1 - pulse) * 0.9); ring.visible = on > 0.01;
    // nav lights blink (the strobe faster)
    navs.forEach((n, i) => n.material.color.copy(black).lerp(navCol[i], (Math.sin(t * (i === 2 ? 5.1 : 2.3) + i) > 0.2) ? 1 : 0.15));
  }
  update(0);

  return {
    root, update,
    get angle() { return a; },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
