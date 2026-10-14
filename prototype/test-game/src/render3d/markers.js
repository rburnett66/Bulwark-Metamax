/**
 * src/render3d/markers.js — PLACEHOLDER geometry for the T3.1 skeleton: the base, structures and live
 * units as simple lit primitives, so a real battle can be watched in the 3D view before the 3D unit
 * models (T5) and obstruction meshes (T4) are ported. Replaced, not extended, by those stories.
 *
 * One InstancedMesh per side for units (two draw calls regardless of count). Units do not cast into the
 * static shadow map (they move; their planar shadows arrive with T5); the base and structures do.
 *
 * THREE is passed in (no import) — see index.js.
 */
import { cellToWorld } from './camera.js';

const UNIT_CAP = 600;
const SIDE_COLOR = { attacker: 0xd0573c, defender: 0x4c8fd6 };

export function createMarkers(THREE, scene) {
  const tmp = new THREE.Object3D();

  // Units: a low wedge-ish box, longer along +X (model forward) so heading reads.
  const unitGeo = new THREE.BoxGeometry(0.9, 0.45, 0.6);
  unitGeo.translate(0, 0.225, 0);
  const units = {};
  for (const side of Object.keys(SIDE_COLOR)) {
    const m = new THREE.InstancedMesh(unitGeo, new THREE.MeshLambertMaterial({ color: SIDE_COLOR[side] }), UNIT_CAP);
    m.count = 0;
    m.frustumCulled = false;   // instances span the whole map; the bounding sphere of instance 0 would cull them
    scene.add(m);
    units[side] = m;
  }

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
    /** units: [{ x, y, heading, side }] in cells. */
    setUnits(list) {
      const n = { attacker: 0, defender: 0 };
      for (const u of list) {
        const m = units[u.side] || units.attacker;
        const key = units[u.side] ? u.side : 'attacker';
        if (n[key] >= UNIT_CAP) continue;
        tmp.position.set(cellToWorld(u.x), 0, cellToWorld(u.y));
        tmp.rotation.set(0, -u.heading, 0);   // heading = atan2(dz, dx); model forward +X → rotate by −heading
        tmp.updateMatrix();
        m.setMatrixAt(n[key]++, tmp.matrix);
      }
      for (const side of Object.keys(units)) {
        units[side].count = n[side];
        units[side].instanceMatrix.needsUpdate = true;
      }
      return n.attacker + n.defender;
    },
    dispose() {
      for (const m of Object.values(units)) { m.geometry.dispose(); m.material.dispose(); scene.remove(m); }
      structs.geometry.dispose(); structs.material.dispose(); scene.remove(structs);
      base.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      scene.remove(base);
    },
  };
}
