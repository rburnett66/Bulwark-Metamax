/**
 * src/render3d/fx/impactsView.js — draws the world-impact effects model (impacts.js) [MM-story_mv87jvnb_5]
 * (plan v2.2 §6.10 BATCHES; code design §4.11b buildFx3D / drawFx).
 *
 * Draw calls, each hidden when empty:
 *   1 additive particle batch (sparks, flash, embers)             renderOrder 4.2
 *   1 additive FLAME flipbook batch (every fire) [MM-task_mvfqzjkm_7] renderOrder 4.25
 *   1 alpha particle batch (smoke, dust)                           renderOrder 4.1
 *   2 ground decal batches (dark scorch; additive rings + pools)   renderOrder 1.2 / 1.3
 *   1 instanced chunk mesh (small metal bits)
 *   per model per part (body, turret) one instanced WRECK mesh built from the unit's own LOD geometry, charred,
 *   plus a planar-shadow mesh sharing its instance matrix.
 * Peak in a fight with every model dying: 5 + 6 wreck meshes + 6 shadows; typically 5–9.
 *
 * Sparks run white-hot → orange → red with age, their streak length from speed. THREE is passed in.
 */
import { tintMix, FX_MIX } from './factionFx.js';
import { createPBatch, createDBatch, createFBatch } from './particles.js';
import { createFireAtlas, fireFrame } from './fireAtlas.js';
import { K, D, DEFAULT_IMPACT_CAPS, SINK_DEPTH } from './impacts.js';
import { createUnitMaterial } from '../units/material.js';
import { shadowMaterial } from '../units/models3d.js';

export const CHAR = Object.freeze([0.42, 0.38, 0.35]);   // charred hull tint (code design §4.11b)
export const WRECK_METAL = 0.1;                           // burnt metal: almost no reflection
/** Flame sprite brightness; the size comes with the atlas (atlas.scale) [MM-task_mvfqzjkm_7]. */
export const FIRE_SPRITE = Object.freeze({ gain: 0.85 });

/**
 * createImpactsView(THREE, scene, { lodGroups, sunDir, caps })
 *   lodGroups — units3d.lodGroups(): { model: { group: { geo, pivot } } }
 *   caps      — the batch capacities (the model's caps limit what it fills; Low simply fills less)
 */
export function createImpactsView(THREE, scene, { lodGroups = {}, sunDir = { x: -0.5, y: 0.7, z: -0.5 }, caps = DEFAULT_IMPACT_CAPS, shadowAlpha = 0.34, fireAtlas = null } = {}) {
  const add = createPBatch(THREE, scene, caps.additive, true, 4.2);
  // every fire is a flipbook flame (the owner's sheet when committed, else the procedural stand-in) [MM-task_mvfqzjkm_7]
  const atlas = fireAtlas || createFireAtlas(THREE, { onSwap: (A) => fire.setAtlas(A) });
  const fire = createFBatch(THREE, scene, caps.additive, atlas, 4.25);
  const smoke = createPBatch(THREE, scene, caps.smoke, false, 4.1);
  const decDark = createDBatch(THREE, scene, caps.scorch, false, 1.2);
  const decAdd = createDBatch(THREE, scene, caps.glow, true, 1.3);

  const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
  const chunkMat = new THREE.MeshLambertMaterial({ color: 0x4a4644 });
  const chunkMesh = new THREE.InstancedMesh(chunkGeo, chunkMat, caps.chunks);
  chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chunkMesh.count = 0; chunkMesh.frustumCulled = false; chunkMesh.visible = false;
  scene.add(chunkMesh);

  const metal = createUnitMaterial(THREE, { metal: WRECK_METAL });
  const wreckMat = metal.material;
  wreckMat.color.setRGB(CHAR[0], CHAR[1], CHAR[2]);      // multiplies the vertex colours: charred, glow parts dead too
  wreckMat.customProgramCacheKey = () => 'unit3d-wreck';
  const shMat = shadowMaterial(THREE, sunDir, shadowAlpha);
  const wreckMesh = {};   // model → group → { im, sh, pivot }
  for (const [model, groups] of Object.entries(lodGroups)) {
    wreckMesh[model] = {};
    for (const [g, L] of Object.entries(groups)) {
      const im = new THREE.InstancedMesh(L.geo, wreckMat, caps.wrecks);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.receiveShadow = true;
      // a wreck casts its unit's shadow proxy (shadow.js) [MM-story_mvibvqd2_7]; L.geo if a caller passes none
      const sh = new THREE.InstancedMesh(L.shGeo || L.geo, shMat, caps.wrecks);
      sh.instanceMatrix = im.instanceMatrix;
      for (const m of [im, sh]) { m.count = 0; m.frustumCulled = false; m.visible = false; scene.add(m); }
      im.renderOrder = 3; sh.renderOrder = 2;
      wreckMesh[model][g] = { im, sh, pivot: L.pivot };
    }
  }

  const m4 = new THREE.Matrix4(), mp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), s = new THREE.Vector3();
  const counts = new Map();

  return {
    add, smoke, fire, atlas, decDark, decAdd, chunkMesh, wreckMesh,
    /** Fill every batch from the model. Returns { particles, decals, chunks, wrecks } drawn. */
    sync(model, liveShadows = true) {
      add.begin(); smoke.begin(); fire.begin();
      // a faction-tinted particle (impacts.js `tc`/`tw`, factionFx.js) mixes its colour toward the faction's [MM-story_mviqruvd_2]
      const T = (p, r, g, b) => (p.tw ? [r + (p.tc[0] - r) * p.tw, g + (p.tc[1] - g) * p.tw, b + (p.tc[2] - b) * p.tw] : [r, g, b]);
      for (const p of model.particles) {
        const u = p.t / p.life, f = 1 - u;
        switch (p.kind) {
          case K.SPARK: {
            const sp = Math.hypot(p.vx, p.vy, p.vz), hot = Math.max(0, 1 - u * 1.6);
            if (p.shade === 1) {   // repair spark (fx/repairFx.js): leaves blue-white, cools through to orange [MM-task_mvcrs0q1_14]
              const c = Math.min(1, Math.max(0, (u - 0.12) / 0.5)), k = c * c * (3 - 2 * c);
              add.push(p.x, p.y, p.z, p.vx, p.vy, p.vz, p.size, Math.min(0.16, sp * 0.03), 0.45 + 0.55 * k, 0.78 - 0.26 * k, 1 - 0.85 * k, f * (1 - 0.25 * k));
              break;
            }
            const [r, g, b] = T(p, 1, 0.55 + 0.45 * hot, 0.15 + 0.6 * hot * hot);
            add.push(p.x, p.y, p.z, p.vx, p.vy, p.vz, p.size, Math.min(0.22, sp * 0.035), r, g, b, f);
            break;
          }
          case K.EMBER: { const [r, g, b] = T(p, 1, 0.5, 0.15); add.push(p.x, p.y, p.z, 0, 0, 0, p.size * p.fl, 0, r, g, b, f); break; }
          case K.FLASH: if (p.shade === 1) add.push(p.x, p.y, p.z, 0, 0, 0, p.size * (0.6 + u), 0, 0.55, 0.8, 1, f * f);   // repair arc: blue
            else { const [r, g, b] = T(p, 1, 0.92, 0.7); add.push(p.x, p.y, p.z, 0, 0, 0, p.size * (0.6 + u), 0, r, g, b, f * f); }
            break;
          case K.FIRE: {   // a flipbook flame on its own frame; tinted from hot to ember-red as it ages [MM-task_mvfqzjkm_7]
            const sz = p.size * Math.max(0.15, 1 + p.grow * u) * fire.scale;
            const [r, g, b] = T(p, 1, 0.92 - 0.3 * u, 0.85 - 0.45 * u);
            fire.push(p.x, p.y, p.z, p.vx, p.vy, p.vz, sz, 0, r, g, b, f * FIRE_SPRITE.gain * p.fl, fireFrame(p.sd, p.t, fire.frames, fire.fps));
            break;
          }
          case K.SMOKE: {
            const sz = p.size * (1 + (p.grow || 0.8) * u * 3), c = p.shade || 0.25, a = Math.min(1, u * 6) * f * (p.dusty ? Math.min(1, 0.45 * Math.max(1, p.dusty)) : 0.55);   // dusty > 1 = more opaque dust (build sites ×1.5)
            smoke.push(p.x, p.y, p.z, 0, 0, 0, sz, 0, c * (p.dusty ? 1.5 : 1), c * (p.dusty ? 1.3 : 1), c * (p.dusty ? 1.1 : 1.05), a);
            break;
          }
          case K.DUST: smoke.push(p.x, p.y, p.z, 0, 0, 0, p.size * 1.6, 0, 0.45, 0.38, 0.3, f * 0.8); break;
          default: break;
        }
      }
      const nP = add.end() + smoke.end() + fire.end();

      decDark.begin(); decAdd.begin();
      for (const d of model.scorches) {
        const u = d.t / d.life;
        decDark.push(d.x, 0.022, d.z, d.r, d.rot, D.SCORCH, d.seed, d.col[0], d.col[1], d.col[2], d.a * Math.min(1, (1 - u) * 4));
      }
      for (const d of model.glows) {
        const u = d.t / d.life;
        if (d.kind === D.RING) decAdd.push(d.x, 0.03, d.z, d.r + (d.r1 - d.r) * Math.sqrt(u), d.rot, D.RING, d.seed, d.col[0], d.col[1], d.col[2], d.a * (1 - u));
        else decAdd.push(d.x, 0.035, d.z, d.r, d.rot, D.POOL, d.seed, d.col[0], d.col[1], d.col[2], d.a * (1 - u) * (1 - u));
      }
      if (model.caps.wreckLights) {          // burning wrecks light the ground around them (flickering pool)
        for (const w of model.wrecks) {
          if (!w.rest || w.t >= w.burn) continue;
          const k = Math.min(1, (w.burn - w.t) / 2.5) * (w.group === 'turret' ? 0.5 : 1);
          const c = tintMix([1.0, 0.45, 0.15], w.tc, FX_MIX.wreckLight);   // a faction's wreck lights the ground in its colour
          decAdd.push(w.x, 0.035, w.z, 0.9 * w.fl * Math.max(0.5, k) * (w.k || 1), 0, D.POOL, 0, c[0], c[1], c[2], 0.5 * k);
        }
      }
      const nD = decDark.end() + decAdd.end();

      let ci = 0;
      for (const c of model.chunks) {
        if (ci >= caps.chunks) break;
        e.set(c.rx, c.ry, c.rz); q.setFromEuler(e);
        const k = c.s * (1 - c.sink * 0.6);   // debris plates (impacts.js debris()) are non-uniform: sx/sy/sz
        m4.compose(v.set(c.x, c.y - c.sink * c.s, c.z), q, s.set(k * (c.sx || 1), k * (c.sy || 1), k * (c.sz || 1)));
        chunkMesh.setMatrixAt(ci++, m4);
      }
      chunkMesh.count = ci; chunkMesh.visible = ci > 0;
      if (ci) chunkMesh.instanceMatrix.needsUpdate = true;

      counts.clear();
      let nW = 0;
      for (const w of model.wrecks) {
        const M = wreckMesh[w.model] && wreckMesh[w.model][w.group];
        if (!M) continue;
        const key = w.model + '/' + w.group;
        const i = counts.get(key) || 0;
        if (i >= caps.wrecks) continue;
        counts.set(key, i + 1);
        e.set(w.roll, w.yaw, w.pitch, 'YXZ'); q.setFromEuler(e);
        m4.compose(v.set(w.x, w.y - w.sink * SINK_DEPTH, w.z), q, s.setScalar(w.scale));
        if (w.group !== 'turret') m4.multiply(mp.makeTranslation(M.pivot.x, M.pivot.y, M.pivot.z));
        M.im.setMatrixAt(i, m4);
        nW++;
      }
      for (const [model, groups] of Object.entries(wreckMesh)) {
        for (const [g, M] of Object.entries(groups)) {
          const c = counts.get(model + '/' + g) || 0;
          M.im.count = c; M.im.visible = c > 0;
          M.sh.count = liveShadows ? c : 0; M.sh.visible = liveShadows && c > 0;
          if (c) M.im.instanceMatrix.needsUpdate = true;
        }
      }
      return { particles: nP, decals: nD, chunks: ci, wrecks: nW };
    },
    dispose() {
      add.dispose(); smoke.dispose(); fire.dispose(); decDark.dispose(); decAdd.dispose();
      scene.remove(chunkMesh); chunkGeo.dispose(); chunkMat.dispose();
      for (const groups of Object.values(wreckMesh)) for (const M of Object.values(groups)) { scene.remove(M.im); scene.remove(M.sh); }
      wreckMat.dispose(); shMat.dispose();   // the geometry belongs to units3d
    },
  };
}
