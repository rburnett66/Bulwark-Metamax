/**
 * src/render3d/units/models3d.js — live 3D units (plan v2.2.1 §6.3; code design §4.11). [MM-story_mv77hv5d_7]
 *
 * Each model type is merged into ONE vertex-coloured geometry per group (body, turret) and drawn as an
 * InstancedMesh — one draw call per type × group, whatever the count. Two variants per group: full detail and
 * LOD (lod.js), sharing ONE instance-matrix buffer, so switching is a count change, not a rebuild. Glow parts
 * are unlit through a per-vertex flag. Shadows: the LOD instances projected flat onto Y = 0 along the sun —
 * exact silhouettes, stencil-once so overlaps never double-darken, no per-frame shadow-map pass.
 *
 * Material: the metal look (material.js, MAT [MM-story_mv87jwol_6]) — per-vertex metalness/roughness from
 * metal.js, a sky/ground reflection and a fresnel edge; setMetal(0) gives back the flat look.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from './prims.js';
import { UNIT_MODELS } from './models.js';
import { MODEL_KEYS, UNIT_SCALE } from './modelKeys.js';
import { lodDef, LOD_DISTANCE } from './lod.js';
import { metalFor, isGlowKey } from './metal.js';
import { createUnitMaterial } from './material.js';

/** Studio palette per material key (code design §4.11 UCOL). */
export const UNIT_COLORS = Object.freeze({
  hull: 0xc4c8cd, hull2: 0xa6acb3, panel: 0xadb3ba, dark: 0x4a4f56, black: 0x22252a, track: 0x2e3135,
  metal: 0x7b828a, glass: 0x1c2533, glow: 0x46f2ff, glowB: 0x4aa8ff, amber: 0xffb340,
});
const DEFAULT_CAP = 600;
export const HOVER_HEIGHT = 1.1;   // cells — flyers fly at this height (code design §4.11)

/**
 * Merge a built model's groups into one geometry per group: { [group]: { geo, pivot, tris } }.
 * Exported for tests (tri counts) — needs THREE but no WebGL.
 */
export function mergeModelGroups(THREE, def, prims = createPrims(THREE), modelKey = def && def.ref) {
  const dummy = new THREE.MeshBasicMaterial();
  const built = prims.buildModel(def, () => dummy);
  const out = {};
  const c = new THREE.Color();
  for (const [gname, G] of Object.entries(built.groups)) {
    const pos = [], nor = [], col = [], emi = [], mr = [];
    for (const mesh of G.children) {
      const k = mesh.userData.mat;
      c.setHex(UNIT_COLORS[k] ?? 0xff00ff);   // magenta = a material key with no colour — visible on purpose
      const e = isGlowKey(k) ? 1 : 0;
      const [mtl, rgh] = metalFor(k, modelKey);   // MAT: per-part metalness / roughness
      const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
      for (let i = 0; i < P.length; i += 3) {
        pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]);
        col.push(c.r, c.g, c.b); emi.push(e); mr.push(mtl, rgh);
      }
      mesh.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aEmit', new THREE.Float32BufferAttribute(emi, 1));
    geo.setAttribute('aMR', new THREE.Float32BufferAttribute(mr, 2));
    const piv = (def.pivots && def.pivots[gname]) || [0, 0, 0];
    out[gname] = { geo, pivot: new THREE.Vector3(piv[0], piv[1], piv[2]), tris: pos.length / 9 };
  }
  dummy.dispose();
  return out;
}

/** One geometry from a and b, b shifted by `off` (non-indexed, same attributes). */
export function mergeOffset(THREE, a, b, off) {
  const geo = new THREE.BufferGeometry();
  for (const [name, A] of Object.entries(a.attributes)) {
    const B = b.attributes[name], n = A.itemSize, arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array, 0); arr.set(B.array, A.array.length);
    if (name === 'position') for (let i = A.array.length; i < arr.length; i += 3) { arr[i] += off.x; arr[i + 1] += off.y; arr[i + 2] += off.z; }
    geo.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
  }
  return geo;
}

/** Planar-shadow material (shared by live units and FX wrecks, which reuse their instance matrices). */
export function shadowMaterial(THREE, sunDir, alpha) {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) }, alpha: { value: alpha } },
    vertexShader: `uniform vec3 uSunDir;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        w.xyz -= uSunDir * (w.y / uSunDir.y);
        w.y = 0.03;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: 'uniform float alpha; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); }',
    transparent: true, depthWrite: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
  });
}

/**
 * Build every model's instanced meshes into `scene`.
 *   const units = createUnits3D(THREE, scene, { sunDir })
 *   units.setUnits([{ model, x, y, z, heading, aim, scale }], camDist, liveShadows)   // world units
 */
export function createUnits3D(THREE, scene, { sunDir, shadowAlpha = 0.34, cap = DEFAULT_CAP } = {}) {
  const prims = createPrims(THREE);
  const metal = createUnitMaterial(THREE);
  const mat = metal.material;
  const shMat = shadowMaterial(THREE, sunDir, shadowAlpha);
  const types = {};
  const tris = {};
  const owned = [];

  for (const key of MODEL_KEYS) {
    const def = UNIT_MODELS[key];
    const full = mergeModelGroups(THREE, def, prims, key);
    const lod = mergeModelGroups(THREE, lodDef(def), prims, key);
    const T = { def, groups: {} };
    tris[key] = { full: 0, lod: 0 };
    for (const gname of Object.keys(full)) {
      const L = lod[gname] || full[gname];
      const imLod = new THREE.InstancedMesh(L.geo, mat, cap);
      imLod.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const imFull = new THREE.InstancedMesh(full[gname].geo, mat, cap);
      imFull.instanceMatrix = imLod.instanceMatrix;          // one matrix buffer feeds full, LOD and the shadow
      const sh = new THREE.InstancedMesh(L.geo, shMat, cap);
      sh.instanceMatrix = imLod.instanceMatrix;
      for (const m of [imLod, imFull, sh]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
      // units RECEIVE the static shadow map (T4): they darken under trees and plateaus. They don't CAST into
      // it — they move, and the map renders only on static changes; their own shadows are the planar ones.
      imLod.receiveShadow = imFull.receiveShadow = true;
      imLod.renderOrder = imFull.renderOrder = 3;
      sh.renderOrder = 2;
      T.groups[gname] = { imFull, imLod, sh, pivot: full[gname].pivot, lodGeo: L.geo };
      tris[key].full += full[gname].tris;
      tris[key].lod += L.tris;
      owned.push(full[gname].geo);
      if (L !== full[gname]) owned.push(L.geo);
    }
    types[key] = T;
  }

  const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), mp = new THREE.Matrix4(), mt = new THREE.Matrix4(), mr = new THREE.Matrix4();
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0), qBank = new THREE.Quaternion();
  const counts = {};
  let usingLod = false;

  return {
    tris,
    material: metal,
    /** MAT: 1 = metal (default), 0 = the previous flat look. */
    setMetal(k) { metal.setMetal(k); },
    get usingLod() { return usingLod; },
    /** Each model's LOD geometry + pivot per group — FX wrecks are drawn from the unit's own geometry. */
    lodGroups() {
      const out = {};
      for (const [key, T] of Object.entries(types)) {
        out[key] = {};
        for (const [g, G] of Object.entries(T.groups)) if (!g.startsWith('barrel') && !g.startsWith('spin')) out[key][g] = { geo: G.lodGeo, pivot: G.pivot };   // rotors are not wrecked
        // a wreck's turret keeps its guns: the barrels (level) folded into the turret geometry
        const TG = T.groups.turret;
        if (TG) {
          let geo = TG.lodGeo;
          for (const [g, BG] of Object.entries(T.groups)) if (g.startsWith('barrel')) { geo = mergeOffset(THREE, geo, BG.lodGeo, BG.pivot.clone().sub(TG.pivot)); owned.push(geo); }
          out[key].turret = { geo, pivot: TG.pivot };
        }
      }
      return out;
    },
    /** Returns how many units were drawn (capped per model at `cap`). */
    setUnits(list, camDist, liveShadows, t = 0) {   // t: render clock (s) — rotors and fans spin on it
      for (const key of MODEL_KEYS) counts[key] = 0;
      let drawn = 0;
      for (const u of list) {
        const T = types[u.model];
        if (!T) continue;
        const i = counts[u.model];
        if (i >= cap) continue;
        counts[u.model] = i + 1;
        drawn++;
        const k = UNIT_SCALE * (u.scale || 1);
        q.setFromAxisAngle(yAxis, -u.heading);
        if (u.bank) q.multiply(qBank.setFromAxisAngle(xAxis, u.bank));   // a plane banking through a turn (flightPath.js)
        m1.compose(v.set(u.x, u.y || 0, u.z), q, s.set(k, k, k));
        const TG = T.groups.turret;
        if (TG) mt.compose(TG.pivot, q.setFromAxisAngle(yAxis, -((u.aim ?? u.heading) - u.heading)), one).premultiply(m1);
        for (const [gname, G] of Object.entries(T.groups)) {
          if (gname === 'turret') m2.copy(mt);
          else if (gname.startsWith('spin')) {   // a rotor / fan turning about its own axis (def.spin) [MM-story_mvehe3sy_j]
            const S = (T.def.spin && T.def.spin[gname]) || { axis: 'y', speed: 20 }, a = (t * S.speed + (u.id || 0) * 1.7) % (Math.PI * 2);
            m2.copy(m1).multiply(mp.makeTranslation(G.pivot.x, G.pivot.y, G.pivot.z)).multiply(S.axis === 'z' ? mr.makeRotationZ(a) : S.axis === 'x' ? mr.makeRotationX(a) : mr.makeRotationY(a));
          }
          else if (gname.startsWith('barrel') && TG) {   // rides the turret, pitched about its trunnion [MM-story_mvedy16u_9]
            m2.copy(mt).multiply(mp.makeTranslation(G.pivot.x - TG.pivot.x, G.pivot.y - TG.pivot.y, G.pivot.z - TG.pivot.z)).multiply(mr.makeRotationZ(u.pitch || 0));
            const back = u.recoil && u.recoil[gname];   // a main gun's slide-back, along its pitched axis [MM-story_mvee15ja_b]
            if (back) m2.multiply(mp.makeTranslation(-back, 0, 0));
          } else {
            m2.copy(m1).multiply(mp.makeTranslation(G.pivot.x, G.pivot.y, G.pivot.z));
          }
          G.imLod.setMatrixAt(i, m2);
        }
      }
      usingLod = camDist > LOD_DISTANCE;
      for (const key of MODEL_KEYS) {
        const n = counts[key];
        for (const G of Object.values(types[key].groups)) {
          G.imLod.count = usingLod ? n : 0;
          G.imFull.count = usingLod ? 0 : n;
          G.sh.count = liveShadows ? n : 0;
          G.imLod.instanceMatrix.needsUpdate = true;
        }
      }
      return drawn;
    },
    dispose() {
      for (const T of Object.values(types)) for (const G of Object.values(T.groups)) {
        for (const m of [G.imFull, G.imLod, G.sh]) scene.remove(m);
      }
      for (const g of owned) g.dispose();
      mat.dispose(); shMat.dispose();
    },
  };
}
