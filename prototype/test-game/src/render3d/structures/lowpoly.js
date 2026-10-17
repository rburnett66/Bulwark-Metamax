/**
 * src/render3d/structures/lowpoly.js — the low-poly base, walls, towers and resource crystals in the scene.
 * LPS [MM-story_mv87jzov_9] (code design §8.3). Same surface as markers.js (setBase / setStructures /
 * dispose) plus setResources(state) and setWorld(palette), so index.js swaps it in by style: these models
 * on the low-poly ground, markers.js's boxes under ?ground=baked.
 *
 * Geometry comes from models.js (pure arrays: faceted, one flat colour per triangle). Here each structure
 * GROUP is ONE InstancedMesh — wall posts, wall arms, cannon towers, flak towers, harvester bays, fallback
 * blocks, crystal shards — plus one merged mesh for the base, so the draw-call cost is one per group that has
 * any instances, whatever the count. The instance colour carries the lifecycle tint (building / upgrading /
 * damaged / selling) and, for crystals, the crystal colour. Everything casts into and receives the static
 * shadow map; set* return true only when the static set changed, so the caller re-renders it once.
 *
 * THREE is passed in (no import) — see index.js.
 */
import { buildBaseModel, buildStructureModels, buildCrystalShard, planStructures, planCrystals, revealedWave } from './models.js';
import { LOWPAL, CRYSTAL } from '../styles/lowpoly-palettes.js';
import { hexRGB } from '../ground/lowpoly.js';

/** Instance capacity per group (the 24 × 16 battlefield caps what can be built long before these). */
export const CAPACITY = Object.freeze({ wallPost: 400, wallArm: 1600, cannon: 200, flak: 200, bay: 40, other: 200, crystal: 3000 });

function toGeometry(THREE, a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
  g.computeBoundingSphere();
  return g;
}

export function createLowPolyStructures(THREE, scene, palette = LOWPAL.meadow) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  group.name = 'structures-lowpoly';
  scene.add(group);

  const makeInstanced = (name, geo, cap) => {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.name = `structures-${name}`;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);   // exists from the start → the shader is built with it
    m.count = 0;
    m.visible = false;
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  };

  const meshes = {};
  let base = null;
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  let baseCell = null, structSig = null, crystalSig = null, lastList = [], baseHidden = false;

  function buildModels(pal) {
    const struct = pal.struct || LOWPAL.meadow.struct;
    const models = buildStructureModels(struct);
    for (const [k, a] of Object.entries(models)) {
      if (meshes[k]) { meshes[k].geometry.dispose(); meshes[k].geometry = toGeometry(THREE, a); } else meshes[k] = makeInstanced(k, toGeometry(THREE, a), CAPACITY[k]);
    }
    if (!meshes.crystal) meshes.crystal = makeInstanced('crystal', toGeometry(THREE, buildCrystalShard()), CAPACITY.crystal);
    const bgeo = toGeometry(THREE, buildBaseModel(struct));
    if (base) { base.geometry.dispose(); base.geometry = bgeo; } else {
      base = new THREE.Mesh(bgeo, material);
      base.name = 'structures-base';
      base.castShadow = base.receiveShadow = true;
      base.visible = false;
      group.add(base);
    }
  }
  buildModels(palette);
  const crystalRGB = Object.fromEntries(Object.entries(CRYSTAL).map(([k, v]) => [k, hexRGB(v)]));

  function fill(mesh, list, place) {
    const n = Math.min(list.length, mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      const tint = place(list[i]);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, col.setRGB(tint[0], tint[1], tint[2]));
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  const api = {
    meshes, get base() { return base; },
    /** LC [MM-story_mvbk1hf3_1]: the landing craft draws the base; hide this mesh (towers still aim from baseCell). */
    setBaseVisible(v) { baseHidden = !v; base.visible = !!baseCell && !baseHidden; },
    setBase(b) {
      baseCell = b ? { x: b.x, y: b.y } : null;
      base.visible = !!b && !baseHidden;
      if (b) base.position.set(b.x + 0.5, 0, b.y + 0.5);
      structSig = null;   // towers aim away from the base
    },
    /** Returns true when the static set changed (the caller re-renders the shadow map once). */
    setStructures(list) {
      lastList = list;
      const plan = planStructures(list, baseCell);
      if (plan.sig === structSig) return false;
      structSig = plan.sig;
      for (const [k, inst] of Object.entries(plan.groups)) {
        fill(meshes[k], inst, (p) => {
          tmp.position.set(p.x, 0, p.z);
          tmp.rotation.set(0, p.ry, 0);
          tmp.scale.set(p.sx, p.sy, p.sz);
          return p.tint;
        });
      }
      return true;
    },
    /** Crystal fields from the sim's live resource nodes. Returns true when the static set changed. */
    setResources(state) {
      const nodes = state && (state.resourceNodes || (state.map && state.map.resources));
      const plan = planCrystals(nodes, revealedWave(state), crystalRGB);
      if (plan.sig === crystalSig) return false;
      crystalSig = plan.sig;
      fill(meshes.crystal, plan.shards, (p) => {
        tmp.position.set(p.x, p.y, p.z);
        tmp.rotation.set(p.rx, p.ry, p.rz);
        tmp.scale.set(p.w, p.h, p.w);
        return p.color;
      });
      return true;
    },
    /** Recolour for a world palette (same shapes). The caller re-renders the shadow map anyway. */
    setWorld(pal) {
      buildModels(pal || LOWPAL.meadow);
      structSig = null;
      api.setStructures(lastList);
    },
    dispose() {
      for (const m of Object.values(meshes)) m.geometry.dispose();
      if (base) base.geometry.dispose();
      material.dispose();
      scene.remove(group);
    },
  };
  return api;
}
