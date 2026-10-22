/**
 * src/render3d/fx/casings.js — spent brass from the Machine Gun tower [MM-story_mvk3kwu2_m].
 *
 * Owner 2026-10-22: "The gun should spray brass bullet casings up and to the right from the gun base." Every round
 * the tower fires kicks one casing out of the ejection port (systemModels sys_mg `eject`, on the gun's right): it
 * flies up and out along the eject direction with a little scatter, tumbles, drops, bounces a couple of times on the
 * ground, lies there glinting and fades. The planner is pure (no three.js; its own seeded rng, render-side only);
 * the view draws `instances()` as one InstancedMesh of small brass cylinders.
 */
export const CASINGS = Object.freeze({
  speed: [1.6, 2.4],   // cells/s out of the port
  scatter: 0.35,       // random spread added to the eject direction
  gravity: 9.5,        // cells/s²
  bounce: 0.32,        // vertical speed kept per bounce
  friction: 0.55,      // ground speed kept per bounce
  spin: [14, 26],      // rad/s tumble
  life: 2.6,           // s on the ground before it is gone (fades over the last 0.6 s)
  fade: 0.6,
  len: 0.09, radius: 0.02,    // cells — a touch over life size so the brass reads at battle zoom
  cap: 400,
});

/** opts.cap overrides CASINGS.cap (quality tier); seed makes the scatter repeatable. */
export function createCasings({ cap = CASINGS.cap, seed = 7 } = {}) {
  let a = seed >>> 0 || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = (lo, hi) => lo + (hi - lo) * rnd();
  const list = [];
  return {
    /** A round was fired: one casing out of port p = { x, y, z, dx, dy, dz } (dir need not be unit length). */
    emit(p) {
      if (!p) return;
      if (list.length >= cap) list.shift();
      const l = Math.hypot(p.dx, p.dy, p.dz) || 1, s = r(CASINGS.speed[0], CASINGS.speed[1]), k = CASINGS.scatter;
      list.push({
        x: p.x, y: p.y, z: p.z,
        vx: (p.dx / l) * s + r(-k, k), vy: (p.dy / l) * s + r(0, k), vz: (p.dz / l) * s + r(-k, k),
        rx: r(0, 6.28), ry: r(0, 6.28), wx: r(CASINGS.spin[0], CASINGS.spin[1]) * (rnd() < 0.5 ? -1 : 1), wy: r(-8, 8),
        t: 0, rest: 0, landed: false, bounces: 0,
      });
    },
    step(dt) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        c.t += d;
        if (!c.landed) {
          c.vy -= CASINGS.gravity * d;
          c.x += c.vx * d; c.y += c.vy * d; c.z += c.vz * d;
          c.rx += c.wx * d; c.ry += c.wy * d;
          if (c.y <= CASINGS.radius) {
            c.y = CASINGS.radius;
            if (c.bounces >= 2 || Math.abs(c.vy) < 0.6) { c.landed = true; c.vx = c.vy = c.vz = 0; c.rx = Math.PI / 2; }
            else { c.vy = -c.vy * CASINGS.bounce; c.vx *= CASINGS.friction; c.vz *= CASINGS.friction; c.wx *= 0.5; c.bounces++; }
          }
        } else {
          c.rest += d;
          if (c.rest >= CASINGS.life) { list.splice(i, 1); }
        }
      }
    },
    /** [{ x, y, z, rx, ry, alpha }] — alpha fades over the last CASINGS.fade s on the ground. */
    instances() {
      return list.map((c) => ({ x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, alpha: c.landed ? Math.max(0, Math.min(1, (CASINGS.life - c.rest) / CASINGS.fade)) : 1 }));
    },
    get count() { return list.length; },
    clear() { list.length = 0; },
  };
}

/** The view: one InstancedMesh of small brass cylinders; a faded casing shrinks away. THREE is injected. */
export function createCasingsView(THREE, scene, { cap = CASINGS.cap } = {}) {
  const geo = new THREE.CylinderGeometry(CASINGS.radius, CASINGS.radius, CASINGS.len, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6bd52, metalness: 0.6, roughness: 0.28, emissive: 0x6b4a10 });   // bright brass that still glints
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'mg-casings'; mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const o = new THREE.Object3D();
  return {
    mesh,
    sync(list) {
      const n = Math.min(cap, list ? list.length : 0);
      for (let i = 0; i < n; i++) {
        const c = list[i];
        o.position.set(c.x, c.y, c.z); o.rotation.set(c.rx, c.ry, 0); o.scale.setScalar(Math.max(0.001, c.alpha)); o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.count = n; mesh.visible = n > 0;
      if (n) mesh.instanceMatrix.needsUpdate = true;
      return n;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
