/**
 * src/reveal/surveyStage.js — the transport arrives over a new planet and surveys it [MM-story_mw56vi32_7].
 *
 * Owner 2026-11-06: "when you unlock a planet, and return to the menu the players transport ship surveys the new planet.
 * It is in the prototype, use the generic transport ship for now". The prototype is tools/planets/orbital-survey.html;
 * its timing and beats come through surveyPlan.js (pure, tested). Drawn with what the game already has: the planet's
 * live globe (render3d/planet/globe.js), a far moon (the airless Lumen globe, small), the space backdrop, and the
 * generic transport hull (render3d/planet/surveyShip.js — the prototype's resource ship) flying free.
 * Tech plan: docs/tech-plan/Content-Reveal.md §5.1 (P4–P5).
 *
 *   const st = createSurveyStage(THREE, { renderer, planet: 'air', tier, reduce });
 *   st.arrive(x) each frame of the 17 s arrival (x 0..1) → readout;  st.survey(state) each frame of the scan
 *   st.resize(w, h) · st.render(dt) · st.dispose()
 */
import { makeGlobe } from '../render3d/planet/globe.js';
import { makeSurveyShip } from '../render3d/planet/surveyShip.js';
import { createBackdrop } from '../render3d/space/backdrop.js';
import { speedTable, arcU, arrivalReadout } from './surveyPlan.js';
import { PLANETS } from '../data/planets.js';

const ORBIT = 1.32, MOON_ORBIT = 7.5, MOON_R = 0.27;
const D0 = [0.1, 0.93, 0.36];            // where the ship holds station (the prototype's D)
const MOON0 = [-2.9, 1.25, -6.8];        // the far moon's direction (the prototype's MOON_START)

export function createSurveyStage(THREE, { renderer, planet = 'ground', tier = 'high', seed = 7 } = {}) {
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 1200);
  renderer.setClearColor(0x05070a, 1);
  const bd = createBackdrop(THREE, { seed: seed + 3, tier, sunDir: [-0.855, 0.422, -0.302], nebulaIntensity: 0.55, sunIntensity: 0.6 });
  scene.add(bd.group);
  const sphere = new THREE.SphereGeometry(1, 128, 96);
  const globe = makeGlobe(THREE, planet, { geo: sphere, additive: true });
  globe.yaw = 0.4; globe.pose();
  scene.add(globe.root);
  const moon = makeGlobe(THREE, 'space', { geo: sphere, additive: true });
  const moonPos = V(MOON0).normalize().multiplyScalar(MOON_ORBIT);
  moon.root.scale.setScalar(MOON_R); moon.root.position.copy(moonPos);
  scene.add(moon.root);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x22283a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(-0.855, 0.422, -0.302).multiplyScalar(10); scene.add(sun);

  // the transport: the generic hull, flying free
  const ship = makeSurveyShip(THREE, { free: true, scale: 0.0135, footprint: 0.05 });
  scene.add(ship.root);
  const D = V(D0).normalize(), UP = new THREE.Vector3(0, 1, 0);
  const east = UP.clone().cross(D).normalize();
  const shipBase = D.clone().multiplyScalar(ORBIT);
  const SHIP_Q = (() => {
    const nose = east.clone().negate(), side = D.clone().cross(nose).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, D, nose));
  })();

  // the arrival path (the prototype's startArrival): inbound beyond the moon, past its sunlit side, then down to station
  const mDir = moonPos.clone().normalize();
  const side = mDir.clone().cross(UP).normalize();
  const fly = moonPos.clone().addScaledVector(side, 0.62).addScaledVector(UP, 0.06);
  const out = moonPos.clone().multiplyScalar(0.5).addScaledVector(side, 1.1);
  const entry = shipBase.clone().addScaledVector(east, 0.9).addScaledVector(D, 0.3);
  const mid = out.clone().add(entry).multiplyScalar(0.5); if (mid.length() < 2.4) mid.setLength(2.4);
  const curve = new THREE.CatmullRomCurve3([moonPos.clone().addScaledVector(mDir, 9).addScaledVector(side, -1.5).addScaledVector(UP, 1.2), fly, out, mid, entry,
    shipBase.clone().addScaledVector(east, 0.2).addScaledVector(D, 0.03), shipBase.clone()], false, 'centripetal');
  let uFly = 0, best = 1e9;
  for (let j = 0; j <= 400; j++) { const d = curve.getPointAt(j / 400).distanceTo(fly); if (d < best) { best = d; uFly = j / 400; } }
  const T = speedTable(uFly);

  // the orbit view the camera settles into: behind and above the ship, the planet's limb below it
  const wideP = shipBase.clone().addScaledVector(D, 0.28).addScaledVector(east, 0.42).addScaledVector(D.clone().cross(east), -0.36);
  const wideT = shipBase.clone().addScaledVector(D, -0.22).addScaledVector(east, -0.1);

  // site markers on the ground: rings (rated: gold, scanning: cyan, locked: white with a pulse)
  const markers = [];
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
  const tangent = (c) => { const up = Math.abs(c.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP; const t1 = up.clone().cross(c).normalize(); return [t1, c.clone().cross(t1)]; };
  const offsetDir = (c, ang, dist) => { const [t1, t2] = tangent(c); return c.clone().multiplyScalar(Math.cos(dist)).add(t1.multiplyScalar(Math.sin(dist) * Math.cos(ang))).add(t2.multiplyScalar(Math.sin(dist) * Math.sin(ang))).normalize(); };
  const zAxis = new THREE.Vector3(0, 0, 1);

  const arrQ = new THREE.Quaternion(), arrM = new THREE.Matrix4(), camP = new THREE.Vector3(), camT = new THREE.Vector3();
  let t = 0;
  function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }

  /** One frame of the arrival at time fraction x (0..1) → the readout. */
  function arrive(x) {
    x = Math.min(1, Math.max(0, Number(x) || 0));
    const u = Math.min(1, Math.max(0, arcU(T, x))), pos = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const upv = pos.clone().normalize(); upv.addScaledVector(tan, -upv.dot(tan)).normalize();
    const sd = upv.clone().cross(tan).normalize();
    arrQ.setFromRotationMatrix(arrM.makeBasis(sd, upv, tan));
    const k = Math.min(1, Math.max(0, (x - 0.84) / 0.16)); arrQ.slerp(SHIP_Q, k * k * (3 - 2 * k));
    ship.setPose(pos, arrQ); ship.setBeam(0);
    // chase camera (the prototype's stepArrival), blended into the orbit view as the ship settles
    camP.copy(pos).addScaledVector(tan, -0.22).addScaledVector(upv, 0.06).addScaledVector(sd, 0.07);
    camT.copy(pos).addScaledVector(tan, 0.3);
    const mk = Math.exp(-(((u - uFly) / 0.07) ** 2));
    if (mk > 0.01) { const toMoon = moonPos.clone().sub(pos), off = toMoon.clone().addScaledVector(tan, -toMoon.dot(tan)).normalize();
      camP.addScaledVector(off, -0.12 * mk).addScaledVector(tan, -0.1 * mk); camT.lerp(moonPos, 0.45 * mk); }
    const pk = Math.min(1, Math.max(0, (u - uFly - 0.04) / 0.12)), far = Math.min(1, Math.max(0, (pos.length() - 1.6) / 1.4));
    if (pk > 0) camT.lerp(new THREE.Vector3(), 0.55 * pk * pk * (3 - 2 * pk) * far);
    camP.addScaledVector(upv, 0.05 * (1 - far)); camT.lerp(pos.clone().addScaledVector(upv, -0.06), 1 - far);
    const r = arrivalReadout(x, u, uFly, (PLANETS[planet] || {}).name || planet);
    camP.lerp(wideP, r.blend); camT.lerp(wideT, r.blend);
    camera.position.copy(camP); camera.lookAt(camT);
    return r;
  }

  /** One frame of the survey: the beam on the aimed point, a marker per site. */
  function survey(st) {
    ship.setPose(shipBase, SHIP_Q);
    camera.position.copy(wideP); camera.lookAt(wideT);
    const aimDir = offsetDir(D, st.aim.ang, st.aim.dist);
    ship.setBeam(st.phase === 'hold' ? 0.5 : 1, aimDir);
    st.sites.forEach((s, i) => {
      let m = markers[i];
      if (!m) {
        m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf2c869, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        m.frustumCulled = false; scene.add(m); markers[i] = m;
      }
      const dir = offsetDir(D, s.ang, s.dist);
      m.position.copy(dir).multiplyScalar(1.004); m.quaternion.setFromUnitVectors(zAxis, dir);
      m.visible = s.state !== 'hidden';
      const locked = s.state === 'locked', scanning = s.state === 'scanning';
      m.material.color.set(locked ? 0xeafffb : scanning ? 0x6fd3c8 : 0xf2c869);
      const pulse = locked ? 1 + 0.35 * Math.sin(t * 5) : 1;
      m.scale.setScalar((locked ? 0.03 : 0.018) * pulse);
      m.material.opacity = s.state === 'queued' ? 0.45 : 1;
    });
  }

  function render(dt) {
    t += dt; ship.update(dt); globe.spin(dt, 0); moon.spin(dt, 0.02);
    bd.update(dt, camera);
    renderer.render(scene, camera);
  }

  return {
    camera, arrive, survey, render, resize,
    /** Hand the hull back to its orbit (the menu's survey ship picks up from here). */
    get ship() { return ship; },
    dispose() {
      ship.dispose(); globe.dispose(); moon.dispose(); bd.dispose(); sphere.dispose(); ringGeo.dispose();
      for (const m of markers) m.material.dispose();
    },
  };
}
