/**
 * src/render3d/resources/resources3d.js — the battle planet's resource fields as 3D models. [MM-story_mvbks25v_5]
 *
 * Replaces the generic crystal shards (structures/lowpoly.js setResources) when the planet is known. Each of the
 * planet's four models (models.js) is merged into two geometries — lit (vertex colour, Lambert) and glow
 * (vertex colour, unlit) — and drawn as InstancedMeshes, one instance per live node: 8 draw calls for all fields,
 * plus one for the role-colour rings under them. Instance colour dims a regrowing stub. setResources returns
 * true only when the static set changed, so the caller re-renders the shadow map once (same contract as LPS).
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from '../units/prims.js';
import { isGlowKey } from '../units/metal.js';
import { TIERS, resourceModel, planResources } from './models.js';
import { revealedWave } from '../structures/models.js';
import { CRYSTAL } from '../styles/lowpoly-palettes.js';

const CAP = 600;

/** Merge one resource model into { lit, glow } vertex-coloured geometries (null when empty). Exported for tools/tests. */
export function mergeResourceModel(THREE, def, prims = createPrims(THREE)) {
  const dummy = new THREE.MeshBasicMaterial();
  const built = prims.buildModel(def, () => dummy);
  const A = { lit: { pos: [], nor: [], col: [] }, glow: { pos: [], nor: [], col: [] } }, c = new THREE.Color();
  let tris = 0;
  built.group.updateMatrixWorld(true);
  built.group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const k = mesh.userData.mat, T = isGlowKey(k) ? A.glow : A.lit;
    c.set(def.palette[k] || '#ff00ff');
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { T.pos.push(P[i], P[i + 1], P[i + 2]); T.nor.push(N[i], N[i + 1], N[i + 2]); T.col.push(c.r, c.g, c.b); }
    tris += P.length / 9;
    g.dispose(); mesh.geometry.dispose();
  });
  dummy.dispose();
  const geo = (B) => {
    if (!B.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  return { lit: geo(A.lit), glow: geo(A.glow), tris };
}

import { RING, RING_VERT, RING_FRAG, phaseOf } from './pulseRing.js';

export function createResources3D(THREE, scene, planet) {
  const prims = createPrims(THREE);
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  // the field marker: a thin ring that expands and cycles (pulseRing.js) [MM-task_mvk37bu6_k]
  const ringMat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const group = new THREE.Group(); group.name = 'resources-planet';
  scene.add(group);
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  const ringRGB = Object.fromEntries(Object.entries(CRYSTAL).map(([k, v]) => [k, new THREE.Color(v)]));

  const inst = (geo, mat, name, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat, CAP);
    m.name = name; m.count = 0; m.visible = false; m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
    m.castShadow = shadow; m.receiveShadow = shadow;
    group.add(m);
    return m;
  };
  const ringGeo = new THREE.PlaneGeometry(2 * RING.r1, 2 * RING.r1).rotateX(-Math.PI / 2);
  const ringPhase = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  const ringCol = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  ringGeo.setAttribute('aPhase', ringPhase); ringGeo.setAttribute('aColor', ringCol);
  const rings = inst(ringGeo, ringMat, 'resources-rings', false);
  rings.renderOrder = 1;

  let meshes = {}, sig = null, current = null;
  function setPlanet(key) {
    for (const t of Object.values(meshes)) for (const m of [t.lit, t.glow]) if (m) { group.remove(m); m.geometry.dispose(); }
    meshes = {}; sig = null; current = key;
    for (const tier of TIERS) {
      const def = resourceModel(key, tier);
      if (!def) continue;
      const g = mergeResourceModel(THREE, def, prims);
      meshes[tier] = { lit: g.lit && inst(g.lit, litMat, `resources-${tier}`, true), glow: g.glow && inst(g.glow, glowMat, `resources-${tier}-glow`, false), tris: g.tris };
    }
    return Object.keys(meshes).length === TIERS.length;
  }
  setPlanet(planet);

  function fill(m, list, place) {
    if (!m) return;
    const n = Math.min(list.length, CAP);
    for (let i = 0; i < n; i++) { const d = place(list[i]); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); m.setColorAt(i, col.setScalar(1).multiplyScalar(d)); }
    m.count = n; m.visible = n > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }

  return {
    group, get planet() { return current; }, setPlanet,
    get complete() { return Object.keys(meshes).length === TIERS.length; },
    /** Lay out the live fields. Returns true when the static set changed. */
    setResources(state) {
      const nodes = state && (state.resourceNodes || (state.map && state.map.resources));
      const plan = planResources(nodes, revealedWave(state));
      if (plan.sig === sig) return false;
      sig = plan.sig;
      for (const tier of TIERS) {
        const M = meshes[tier], list = plan.byTier[tier];
        if (!M) continue;
        const place = (p) => { tmp.position.set(p.x, 0, p.z); tmp.rotation.set(0, p.ry, 0); tmp.scale.setScalar(p.s); return p.dim; };
        fill(M.lit, list, place); fill(M.glow, list, place);
      }
      const n = Math.min(plan.rings.length, CAP);
      for (let i = 0; i < n; i++) {
        const r = plan.rings[i];
        tmp.position.set(r.x, 0.025, r.z); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix();
        rings.setMatrixAt(i, tmp.matrix);
        col.copy(ringRGB[r.color] || ringRGB.blue).multiplyScalar(r.dim);
        ringCol.setXYZ(i, col.r, col.g, col.b); ringPhase.setX(i, phaseOf(r.id != null ? r.id : r.x + ',' + r.z));
      }
      rings.count = n; rings.visible = n > 0; rings.instanceMatrix.needsUpdate = true; ringCol.needsUpdate = true; ringPhase.needsUpdate = true;
      return true;
    },
    /** Advance the ring pulse (seconds of render time). */
    tick(t) { ringMat.uniforms.uTime.value = t; },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      litMat.dispose(); glowMat.dispose(); ringMat.dispose();
    },
  };
}
