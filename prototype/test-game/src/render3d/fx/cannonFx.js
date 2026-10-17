/**
 * src/render3d/fx/cannonFx.js — the base's heavy SUPER-CANNON in the battle view. [MM-task_mvbvpyer_x]
 *
 * Owner 2026-10-16: "heavy defense cannon projectiles" were missing from the 3D view. The 2D view's contract
 * (render/renderer.js cannonAim / cannonShot / shell touchdown), carried over:
 *   AIM      — a pulsing red target reticle on the ground where the shell will land, at the REAL blast radius
 *              (ev.radius = CANNON.aoe), held through the aim and the shell's flight.
 *   SHOT     — a glowing shell leaves the landing craft's roof gun (its muzzle, so the turret visibly fires) and
 *              arcs to the target over ev.dur — the sim applies the AOE the same moment — trailing fire and smoke,
 *              its shadow sliding along the ground under it.
 *   IMPACT   — detonates exactly on touchdown: a big explosion through the world-impact FX (fireball, sparks,
 *              chunks, scorch, shock ring, light pool), 10–20 small fires scattered over the blast disk (the
 *              footprint reads), and a camera thump.
 * The model is pure (no three.js; seeded) and owns no damage — presentation only. createCannonFxView draws it.
 */
import { cellToWorld } from '../camera.js';
import { K } from './impacts.js';

const prng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const CANNON_FX = Object.freeze({ apex: 1.6, apexPerCell: 0.32, fires: [10, 20], boom: 1.7, shake: 0.32, muzzleY: 0.9 });

export function createCannonFx({ seed = 1 } = {}) {
  const rand = prng(seed);
  const rnd = (a, b) => a + rand() * (b - a);
  const reticles = [], shells = [], landed = [];
  let shake = 0;
  return {
    reticles, shells, landed,
    get shake() { return shake; },
    /** Read this frame's sim events. muzzle() → world { x, y, z } of the roof gun's muzzle, or null. */
    onEvents(events, muzzle) {
      if (!events) return;
      for (const ev of events) {
        if (ev.type === 'cannonAim' && ev.pos) {
          reticles.push({ x: cellToWorld(ev.pos.x), z: cellToWorld(ev.pos.y), r: ev.radius || 2.5, t: 0, life: (ev.dur || 3) + 4 });
        } else if (ev.type === 'cannonShot' && ev.from && ev.to) {
          const m = (muzzle && muzzle()) || { x: cellToWorld(ev.from.x), y: CANNON_FX.muzzleY, z: cellToWorld(ev.from.y) };
          const tx = cellToWorld(ev.to.x), tz = cellToWorld(ev.to.y), d = Math.hypot(tx - m.x, tz - m.z);
          shells.push({ fx: m.x, fy: m.y, fz: m.z, tx, tz, t: 0, dur: ev.dur || 1.6, r: ev.radius || 2.5, apex: CANNON_FX.apex + CANNON_FX.apexPerCell * d,
            x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0 });
        }
      }
    },
    /** Advance; `impacts` (fx/impacts.js) takes the trail and the detonation. */
    step(dt, impacts) {
      dt = Math.max(0, Math.min(0.1, dt || 0));
      landed.length = 0;
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        s.t += dt;
        const u = Math.min(1, s.t / s.dur);
        const nx = s.fx + (s.tx - s.fx) * u, nz = s.fz + (s.tz - s.fz) * u, ny = s.fy * (1 - u) + s.apex * 4 * u * (1 - u);
        if (dt > 0) { s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; s.vz = (nz - s.z) / dt; }
        s.x = nx; s.y = ny; s.z = nz;
        if (impacts && impacts.emit && dt > 0) {   // fire and smoke streaming off the shell
          for (let c = Math.floor(30 * dt + rand()); c > 0; c--) impacts.emit(K.FIRE, nx + rnd(-0.04, 0.04), ny, nz + rnd(-0.04, 0.04), rnd(-0.2, 0.2), rnd(0, 0.3), rnd(-0.2, 0.2), rnd(0.15, 0.3), rnd(0.08, 0.14), -0.2);
          for (let c = Math.floor(14 * dt + rand()); c > 0; c--) impacts.emit(K.SMOKE, nx, ny, nz, rnd(-0.1, 0.1), rnd(0.1, 0.3), rnd(-0.1, 0.1), rnd(0.9, 1.5), rnd(0.08, 0.13), 0.5, 0.35);
        }
        if (u < 1) continue;
        shells.splice(i, 1);
        landed.push({ x: s.tx, z: s.tz, r: s.r });
        if (impacts) {
          impacts.boom(s.tx, s.tz, CANNON_FX.boom * (s.r / 2.5), true);
          const n = CANNON_FX.fires[0] + Math.floor(rand() * (CANNON_FX.fires[1] - CANNON_FX.fires[0] + 1));
          for (let k = 0; k < n; k++) {                // uniform over the blast disk (sqrt), not a ring
            const rr = Math.sqrt(rand()) * s.r * 0.9, a = rand() * Math.PI * 2;
            if (impacts.burn) impacts.burn(s.tx + Math.cos(a) * rr, s.tz + Math.sin(a) * rr, rnd(0.3, 0.55), rnd(3, 5));
          }
        }
        shake = Math.max(shake, CANNON_FX.shake);
        // its reticle goes with it
        let best = -1, bd = 0.6;
        for (let j = 0; j < reticles.length; j++) { const d = Math.hypot(reticles[j].x - s.tx, reticles[j].z - s.tz); if (d < bd) { bd = d; best = j; } }
        if (best >= 0) reticles.splice(best, 1);
      }
      for (let i = reticles.length - 1; i >= 0; i--) { reticles[i].t += dt; if (reticles[i].t >= reticles[i].life) reticles.splice(i, 1); }
      shake = Math.max(0, shake - dt * 0.9);
    },
    clear() { reticles.length = 0; shells.length = 0; landed.length = 0; shake = 0; },
  };
}

/** Draws reticles (ground decals: fill + ring + cross, pulsing) and shells (glowing core + halo + ground shadow). */
export function createCannonFxView(THREE, scene, { cap = 4 } = {}) {
  const group = new THREE.Group(); group.name = 'cannon-fx'; scene.add(group);
  const retMat = () => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uA; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float d = length(p);
        if (d > 1.0) discard;
        float pulse = 0.5 + 0.5 * sin(uT * 9.0);
        float ring = smoothstep(0.86, 0.9, d) * (1.0 - smoothstep(0.97, 1.0, d));
        float inner = smoothstep(0.42, 0.45, d) * (1.0 - smoothstep(0.47, 0.5, d)) * 0.7;
        float cross = (1.0 - smoothstep(0.012, 0.03, abs(p.x))) + (1.0 - smoothstep(0.012, 0.03, abs(p.y)));
        cross *= step(0.12, d) * (1.0 - step(0.88, d)) * 0.8;
        float fill = 0.10 + 0.08 * pulse;
        float a = max(max(ring, inner), cross) * (0.65 + 0.35 * pulse) + fill;
        gl_FragColor = vec4(1.0, 0.31, 0.19, a * uA);
      }`,
    transparent: true, depthWrite: false,
  });
  const reticles = Array.from({ length: cap }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), retMat());
    m.position.y = 0.05; m.renderOrder = 6; m.visible = false; group.add(m); return m;
  });
  const coreG = new THREE.SphereGeometry(1, 10, 8), haloG = new THREE.SphereGeometry(1, 10, 8), shadowG = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const coreM = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const haloM = new THREE.MeshBasicMaterial({ color: 0xff9a30, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const shells = Array.from({ length: cap }, () => {
    const core = new THREE.Mesh(coreG, coreM), halo = new THREE.Mesh(haloG, haloM), shadow = new THREE.Mesh(shadowG, shadowM);
    core.scale.setScalar(0.11); halo.scale.setScalar(0.26); halo.renderOrder = 7; shadow.renderOrder = 5;
    core.visible = halo.visible = shadow.visible = false; group.add(core, halo, shadow); return { core, halo, shadow };
  });
  let clock = 0;
  return {
    sync(model, dt) {
      clock += dt || 0;
      reticles.forEach((m, i) => {
        const r = model.reticles[i];
        m.visible = !!r;
        if (!r) return;
        m.position.x = r.x; m.position.z = r.z; m.scale.set(r.r, 1, r.r);
        m.material.uniforms.uT.value = clock + i * 0.37;
        m.material.uniforms.uA.value = Math.min(1, r.t * 4);
      });
      shells.forEach((v, i) => {
        const s = model.shells[i];
        v.core.visible = v.halo.visible = v.shadow.visible = !!s;
        if (!s) return;
        v.core.position.set(s.x, s.y, s.z); v.halo.position.set(s.x, s.y, s.z);
        v.halo.scale.setScalar(0.24 + 0.05 * Math.sin(clock * 40 + i));
        v.shadow.position.set(s.x, 0.04, s.z);
        const h = Math.max(0, s.y); v.shadow.scale.setScalar(0.14 + h * 0.05); v.shadow.material.opacity = Math.max(0.08, 0.4 - h * 0.05);
      });
    },
    dispose() {
      scene.remove(group);
      for (const m of reticles) { m.geometry.dispose(); m.material.dispose(); }
      coreG.dispose(); haloG.dispose(); shadowG.dispose(); coreM.dispose(); haloM.dispose(); shadowM.dispose();
    },
  };
}
