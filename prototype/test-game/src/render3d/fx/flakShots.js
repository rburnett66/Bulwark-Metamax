/**
 * src/render3d/fx/flakShots.js — flak rounds drawn as small black balls [MM-task_mvfqb2gm_4].
 *
 * Owner 2026-10-19: "the flack tower projectile should be small black round balls that explode in black puffs" and
 * "the flak also should not track, it should go fast then explode". The rounds themselves fly straight (combatFxModel
 * 'flak' shots, unguided); here each one in flight is a small dark lit sphere — one InstancedMesh, one draw call, none
 * when nothing is aloft. The glow-streak view (combatFx.js) skips them: an additive glow cannot draw black. The burst
 * (a small orange pop + a black smoke puff) is combatFxModel's flash + the 'flak' trail in render3d/index.js.
 *
 * THREE is injected (no import) — see render3d/index.js. Render-only.
 */
export const FLAK_BALL = Object.freeze({ radius: 0.07, color: 0x141414 });

export function createFlakShots(THREE, scene, { cap = 128 } = {}) {
  const geo = new THREE.IcosahedronGeometry(FLAK_BALL.radius, 1);
  const mat = new THREE.MeshLambertMaterial({ color: FLAK_BALL.color });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'flak-shots';
  mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);
  const M = new THREE.Matrix4();
  return {
    mesh,
    /** Copy the model's flak rounds into the mesh. Returns how many were drawn. */
    sync(model) {
      let n = 0;
      for (const s of (model && model.shots) || []) {
        if (s.kind !== 'flak' || n >= cap) continue;
        mesh.setMatrixAt(n++, M.makeTranslation(s.x, s.y, s.z));
      }
      mesh.count = n; mesh.visible = n > 0;
      if (n) mesh.instanceMatrix.needsUpdate = true;
      return n;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
