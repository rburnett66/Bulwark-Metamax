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
import { TUNE } from './fxTune.js';   // live reticle look (Effects Lab) [MM-story_mvk63439_o]

const prng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const CANNON_FX = Object.freeze({ apex: 1.6, apexPerCell: 0.32, fires: [10, 20], boom: 1.7, shake: 0.32, muzzleY: 0.9 });

/**
 * Each base fires its own weapon (owner 2026-10-16: "the weapon system is different for different bases players
 * can unlock"). The craft's roof weapon picks the LOOK of the base's heavy shot; the sim's damage, radius and timing
 * are the same for all — every style lands its main blast exactly at the sim's impact time.
 *   shell  — one heavy shell on a high arc (cannon)          rail   — a flat, fast cyan slug (railgun)
 *   mortar — one shell on a steep lob                        rockets — a staggered salvo of 6 rockets, spread
 *   missiles — 4 missiles weaving in on curving paths        gatling — a stream of tracers raking the area
 *   energy — a violet energy orb (shield crafts)
 */
export const BASE_STYLES = Object.freeze({
  shell: { n: 1, apexK: 1, color: 0xfff2c0, halo: 0xff9a30, size: 1 },
  rail: { n: 1, apexK: 0.25, color: 0xd8fbff, halo: 0x46e0ff, size: 0.8 },
  mortar: { n: 1, apexK: 2.1, color: 0xfff2c0, halo: 0xff9a30, size: 1.1 },
  rockets: { n: 6, apexK: 0.7, color: 0xfff0d0, halo: 0xff7a30, size: 0.6, spread: 0.6, stagger: 0.07 },
  missiles: { n: 4, apexK: 0.9, color: 0xffffff, halo: 0x9fd4ff, size: 0.55, spread: 0.45, stagger: 0.1, weave: 1.2 },
  gatling: { n: 14, apexK: 0.08, color: 0xffe6a0, halo: 0xffb050, size: 0.35, spread: 0.8, stagger: 0.05, fast: 1 },
  energy: { n: 1, apexK: 0.6, color: 0xf2e0ff, halo: 0xb070ff, size: 1.2 },
});
/** Craft weaponType (craft/models.js) → base shot style. */
export function baseStyleFor(weaponType = '') {
  const w = String(weaponType).toLowerCase();
  if (w.includes('railgun')) return 'rail';
  if (w.includes('rocket')) return 'rockets';
  if (w.includes('missile')) return 'missiles';
  if (w.includes('mortar')) return 'mortar';
  if (w.includes('troop') || w.includes('gun ')) return 'gatling';
  if (w.includes('shield')) return 'energy';
  return 'shell';
}

/** Apex (world units) of the base cannon's main round over horizontal distance d — the roof gun pitches to it. */
export function baseApex(d, S = BASE_STYLES.shell) {
  return (CANNON_FX.apex + CANNON_FX.apexPerCell * d) * S.apexK;
}

/**
 * Launch pitch (radians) of the base cannon's main round from muzzle m to ground point (tx, tz): the shell flies
 * y = fy·(1 − u) + apex·4u(1 − u), so the slope at u = 0 is (4·apex − fy) / d. [MM-story_mvedy2wj_a]
 */
export function baseLaunchPitch(m, tx, tz, S = BASE_STYLES.shell) {
  const d = Math.hypot(tx - m.x, tz - m.z);
  return Math.atan2(4 * baseApex(d, S) - m.y, Math.max(1e-6, d));
}

export function createCannonFx({ seed = 1, style = 'shell' } = {}) {
  const S = BASE_STYLES[style] || BASE_STYLES.shell;
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
          const dur = ev.dur || 1.6, r = ev.radius || 2.5;
          for (let k = 0; k < S.n; k++) {
            // the MAIN round (k = 0) lands exactly at the sim's impact; salvo rounds launch staggered, spread over the disk
            const main = k === 0, start = main ? 0 : k * (S.stagger || 0);
            const a = rand() * Math.PI * 2, rr = main ? 0 : Math.sqrt(rand()) * r * (S.spread || 0);
            shells.push({ fx: m.x + (main ? 0 : (rand() - 0.5) * 0.25), fy: m.y, fz: m.z + (main ? 0 : (rand() - 0.5) * 0.25),
              tx: tx + Math.cos(a) * rr, tz: tz + Math.sin(a) * rr, t: -start, dur: main ? dur : Math.max(0.25, dur - start + (rand() - 0.5) * 0.2),
              r, main, apex: baseApex(d, S) * (main ? 1 : 0.8 + rand() * 0.4),
              weave: S.weave ? (rand() - 0.5) * 2 * S.weave : 0, x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0, live: main });
          }
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
        if (s.t < 0) continue;                        // a salvo round still waiting on its rail
        s.live = true;
        const u = Math.min(1, s.t / s.dur);
        // missiles weave: a sideways sine across the path that dies out at the target
        const px = -(s.tz - s.fz), pz = s.tx - s.fx, pl = Math.hypot(px, pz) || 1, wv = s.weave * Math.sin(u * Math.PI);
        const nx = s.fx + (s.tx - s.fx) * u + (px / pl) * wv, nz = s.fz + (s.tz - s.fz) * u + (pz / pl) * wv, ny = s.fy * (1 - u) + s.apex * 4 * u * (1 - u);
        if (dt > 0) { s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; s.vz = (nz - s.z) / dt; }
        s.x = nx; s.y = ny; s.z = nz;
        if (impacts && impacts.emit && dt > 0) {   // fire and smoke streaming off the shell
          for (let c = Math.floor(30 * dt + rand()); c > 0; c--) impacts.emit(K.FIRE, nx + rnd(-0.04, 0.04), ny, nz + rnd(-0.04, 0.04), rnd(-0.2, 0.2), rnd(0, 0.3), rnd(-0.2, 0.2), rnd(0.15, 0.3), rnd(0.08, 0.14), -0.2);
          for (let c = Math.floor(14 * dt + rand()); c > 0; c--) impacts.emit(K.SMOKE, nx, ny, nz, rnd(-0.1, 0.1), rnd(0.1, 0.3), rnd(-0.1, 0.1), rnd(0.9, 1.5), rnd(0.08, 0.13), 0.5, 0.35);
        }
        if (u < 1) continue;
        shells.splice(i, 1);
        if (!s.main) {                                // a salvo round: its own small hit; the main round carries the AOE
          if (impacts) { if (S.fast) { if (impacts.fxGround) impacts.fxGround(s.tx, s.tz); } else impacts.boom(s.tx, s.tz, 0.5, false); }
          continue;
        }
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
    style: S,
  };
}

/** Draws reticles (ground decals: fill + ring + cross, pulsing) and shells (glowing core + halo + ground shadow). */
export function createCannonFxView(THREE, scene, { cap = 16, style = 'shell' } = {}) {
  const ST = BASE_STYLES[style] || BASE_STYLES.shell;
  const group = new THREE.Group(); group.name = 'cannon-fx'; scene.add(group);
  // the reticle reads its look from the live tuning layer (fx/fxTune.js TUNE.reticle; defaults = the original shader)
  // so the Effects Lab can tune it [MM-story_mvk63439_o]
  const retMat = () => new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 1 }, uCol: { value: new THREE.Color(1, 0.31, 0.19) },
      uRing: { value: 0.04 }, uInner: { value: 0.7 }, uInnerR: { value: 0.45 }, uCross: { value: 0.8 },
      uFill: { value: 0.1 }, uPulseFill: { value: 0.08 }, uSpeed: { value: 9 }, uDepth: { value: 0.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uA, uRing, uInner, uInnerR, uCross, uFill, uPulseFill, uSpeed, uDepth; uniform vec3 uCol; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float d = length(p);
        if (d > 1.0) discard;
        float pulse = 0.5 + 0.5 * sin(uT * uSpeed);
        float r0 = 1.0 - uRing * 2.5;
        float ring = smoothstep(r0 - 0.04, r0, d) * (1.0 - smoothstep(0.97, 1.0, d));
        float inner = smoothstep(uInnerR - 0.03, uInnerR, d) * (1.0 - smoothstep(uInnerR + 0.02, uInnerR + 0.05, d)) * uInner;
        float cross = (1.0 - smoothstep(0.012, 0.03, abs(p.x))) + (1.0 - smoothstep(0.012, 0.03, abs(p.y)));
        cross *= step(0.12, d) * (1.0 - step(r0 - 0.02, d)) * uCross;
        float fill = uFill + uPulseFill * pulse;
        float a = max(max(ring, inner), cross) * ((1.0 - uDepth) + uDepth * pulse) + fill;
        gl_FragColor = vec4(uCol, a * uA);
      }`,
    transparent: true, depthWrite: false,
  });
  const reticles = Array.from({ length: cap }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), retMat());
    m.position.y = 0.05; m.renderOrder = 6; m.visible = false; group.add(m); return m;
  });
  const coreG = new THREE.SphereGeometry(1, 10, 8), haloG = new THREE.SphereGeometry(1, 10, 8), shadowG = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const coreM = new THREE.MeshBasicMaterial({ color: ST.color });
  const haloM = new THREE.MeshBasicMaterial({ color: ST.halo, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const shells = Array.from({ length: cap }, () => {
    const core = new THREE.Mesh(coreG, coreM), halo = new THREE.Mesh(haloG, haloM), shadow = new THREE.Mesh(shadowG, shadowM);
    core.scale.setScalar(0.11 * ST.size); halo.scale.setScalar(0.26 * ST.size); halo.renderOrder = 7; shadow.renderOrder = 5;
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
        const R = TUNE.reticle, u = m.material.uniforms;
        m.position.x = r.x; m.position.z = r.z; m.scale.set(r.r * R.size, 1, r.r * R.size);
        u.uT.value = clock + i * 0.37;
        u.uA.value = Math.min(1, r.t * 4) * R.alpha;
        u.uCol.value.set(R.color); u.uRing.value = R.ring; u.uInner.value = R.inner; u.uInnerR.value = R.innerR;
        u.uCross.value = R.cross; u.uFill.value = R.fill; u.uPulseFill.value = R.pulseFill; u.uSpeed.value = R.pulseSpeed; u.uDepth.value = R.pulseDepth;
      });
      const live = model.shells.filter((q) => q.live);
      shells.forEach((v, i) => {
        const s = live[i];
        v.core.visible = v.halo.visible = v.shadow.visible = !!s;
        if (!s) return;
        v.core.position.set(s.x, s.y, s.z); v.halo.position.set(s.x, s.y, s.z);
        v.halo.scale.setScalar((0.24 + 0.05 * Math.sin(clock * 40 + i)) * ST.size);
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
