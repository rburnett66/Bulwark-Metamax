/**
 * src/render3d/fx/rocketShots.js — rocket-tower rounds drawn as rockets [MM-task_mvf0kzw4_l].
 *
 * Owner 2026-10-19: "The projectile for the rocket launcher should be a rocket based on the tier of the tower". Each
 * round in flight (combatFxModel shots of kind 'rocket', which carry the firing tower's tier) draws as that tier's rack
 * rocket — accent tip, fin size — at the rack's scale, nose first along its flight arc (the shot's position is the nose,
 * its direction the arc's tangent). One InstancedMesh per tier in the towers' metal material: three draw calls at
 * most, none when nothing is aloft. Render-only.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from '../units/prims.js';
import { createUnitMaterial } from '../units/material.js';
import { rocketShotModel, SYSTEM_SCALE } from '../structures/systemModels.js';
import { mergeSystemModel } from '../structures/system3d.js';

export const ROCKET_SHOT_SCALE = SYSTEM_SCALE.sys_rockets;   // the rack's model-unit → cell scale

/** Instance matrix elements (column-major, 16) for a rocket whose nose is at p heading along unit d, at scale k (pure). */
export function rocketMatrix(p, d, k, out = new Array(16)) {
  // x axis = d; z axis = horizontal perpendicular (y-up world); y = z × x
  let zx = -d.z, zz = d.x, zl = Math.hypot(zx, zz);
  if (zl < 1e-6) { zx = 0; zz = 1; zl = 1; }             // straight up / down: any horizontal side will do
  zx /= zl; zz /= zl;
  const yx = -zz * d.y, yy = zz * d.x - zx * d.z, yz = zx * d.y;   // (zx,0,zz) × (dx,dy,dz)
  out[0] = d.x * k; out[1] = d.y * k; out[2] = d.z * k; out[3] = 0;
  out[4] = yx * k; out[5] = yy * k; out[6] = yz * k; out[7] = 0;
  out[8] = zx * k; out[9] = 0; out[10] = zz * k; out[11] = 0;
  out[12] = p.x; out[13] = p.y; out[14] = p.z; out[15] = 1;
  return out;
}

export function createRocketShots(THREE, scene, { cap = 96, env } = {}) {
  const mat = createUnitMaterial(THREE, env ? { env } : {});
  const prims = createPrims(THREE);
  const group = new THREE.Group(); group.name = 'rocket-shots';
  scene.add(group);
  const tiers = {};
  for (const t of [1, 2, 3]) {
    const def = rocketShotModel(t), parts = mergeSystemModel(THREE, def, prims), geo = parts.body.geo;
    const mesh = new THREE.InstancedMesh(geo, mat.material, cap);
    mesh.name = `rocket-shot-t${t}`;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    group.add(mesh);
    tiers[t] = { mesh, def };
  }
  const M = new THREE.Matrix4(), e = new Array(16);
  /** The length (cells) behind the nose where the motor flame starts. */
  const tail = tiers[1].def.length * ROCKET_SHOT_SCALE;
  return {
    group, tiers, tail,
    /** Copy the model's rocket rounds into the per-tier meshes. Returns how many were drawn. */
    sync(model) {
      const n = { 1: 0, 2: 0, 3: 0 };
      for (const s of (model && model.shots) || []) {
        if (s.kind !== 'rocket') continue;
        const t = Math.max(1, Math.min(3, s.tier | 0 || 1)), T = tiers[t];
        if (n[t] >= cap) continue;
        T.mesh.setMatrixAt(n[t]++, M.fromArray(rocketMatrix(s, { x: s.dx, y: s.dy, z: s.dz }, ROCKET_SHOT_SCALE, e)));
      }
      let all = 0;
      for (const t of [1, 2, 3]) {
        const m = tiers[t].mesh; m.count = n[t]; m.visible = n[t] > 0; all += n[t];
        if (n[t]) m.instanceMatrix.needsUpdate = true;
      }
      return all;
    },
    setEnv(v) { if (v) mat.setEnv(v); },
    dispose() {
      for (const t of [1, 2, 3]) tiers[t].mesh.geometry.dispose();
      mat.material.dispose();
      scene.remove(group);
    },
  };
}
