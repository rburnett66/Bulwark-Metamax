/**
 * src/render3d/markers.js — PLACEHOLDER geometry for the base and structures as simple lit primitives.
 * Since LPS [MM-story_mv87jzov_9] this is only the ?ground=baked style: on the low-poly ground index.js uses
 * structures/lowpoly.js (low-poly base, walls, towers and crystal fields) instead.
 * Units left this file with T5: they are the 3D models in units/models3d.js. Both cast into the static
 * shadow map.
 *
 * THREE is passed in (no import) — see index.js.
 */
import { cellToWorld } from './camera.js';


export function createMarkers(THREE, scene) {
  const tmp = new THREE.Object3D();

  // Base: 3x3 footprint block with a keep.
  const base = new THREE.Group();
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x6f6a5e });
  const foot = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 2.8), baseMat);
  foot.position.y = 0.45;
  const keep = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.4), new THREE.MeshLambertMaterial({ color: 0x9a7f52 }));
  keep.position.y = 0.9;
  for (const m of [foot, keep]) { m.castShadow = true; m.receiveShadow = true; base.add(m); }
  base.visible = false;
  scene.add(base);

  // Structures: one instanced block; height by kind is a later T3 task — 1 cell for now.
  const structGeo = new THREE.BoxGeometry(0.86, 1, 0.86);
  structGeo.translate(0, 0.5, 0);
  const structs = new THREE.InstancedMesh(structGeo, new THREE.MeshLambertMaterial({ color: 0x8c9399 }), 400);
  structs.count = 0;
  structs.castShadow = true;
  structs.receiveShadow = true;
  structs.frustumCulled = false;
  scene.add(structs);
  let structSig = '';

  return {
    /** LC: the landing craft draws the base on the 3D view; this hides the placeholder. */
    setBaseVisible(v) { base.visible = !!v; },
    setBase(b) {
      base.visible = !!b;
      if (b) base.position.set(cellToWorld(b.x), 0, cellToWorld(b.y));
    },
    /** Returns true when the static set changed (the caller re-renders the shadow map once). */
    setStructures(list) {
      const sig = list.map((s) => `${s.id}@${s.cell ? s.cell.x + ',' + s.cell.y : s.pos.x + ',' + s.pos.y}`).join('|');
      if (sig === structSig) return false;
      structSig = sig;
      let n = 0;
      for (const s of list) {
        if (n >= structs.instanceMatrix.count) break;
        const c = s.cell || s.pos;
        tmp.position.set(cellToWorld(Math.floor(c.x)), 0, cellToWorld(Math.floor(c.y)));
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        structs.setMatrixAt(n++, tmp.matrix);
      }
      structs.count = n;
      structs.instanceMatrix.needsUpdate = true;
      return true;
    },
    dispose() {
      structs.geometry.dispose(); structs.material.dispose(); scene.remove(structs);
      base.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      scene.remove(base);
    },
  };
}
