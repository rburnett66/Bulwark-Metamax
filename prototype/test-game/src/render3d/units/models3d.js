/**
 * src/render3d/units/models3d.js — live 3D units (plan v2.2.1 §6.3; code design §4.11). [MM-story_mv77hv5d_7]
 *
 * Each model type is merged into ONE vertex-coloured geometry per group (body, turret) and drawn as an
 * InstancedMesh — one draw call per type × group, whatever the count. Two variants per group: full detail and
 * LOD (lod.js), sharing ONE instance-matrix buffer, so switching is a count change, not a rebuild. Glow parts
 * are unlit through a per-vertex flag. Shadows: each model's shadow PROXY (shadow.js: a few simple primitives per
 * group, not the LOD mesh [MM-story_mvibvqd2_7]) projected flat onto Y = 0 along the sun —
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
import { shadowDef } from './shadow.js';
import { metalFor, isGlowKey } from './metal.js';
import { createUnitMaterial } from './material.js';
import { kickMatrix, BODY_KICK } from '../fx/recoil.js';

/**
 * SPECIAL ABILITY looks [MM-story_mvn06y2l_8]: a view with `fx: { kind, k }` is drawn
 *   'cloak'  — INSTEAD of its normal look: a heat-haze ghost, dark and see-through with a bright shimmering rim
 *   'mirror' — INSTEAD of its normal look: a cyan hologram (scanlines, rim, flicker by k) — a fake the player can read
 *   'raised' — normally AND with a green rising glow that fades with k
 * Both extra looks are lazy per model group (most groups never need them) and draw the group's LOD geometry.
 */
const FX_VS = `attribute vec4 aTint; varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vC;
void main() {
  vTint = aTint;
  #ifdef USE_COLOR
  vC = color;
  #else
  vC = vec3(0.6);
  #endif
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  w.xyz += vN * 0.035;   // a skin just outside the body, so it never hides inside the unit's own mesh
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HOLO_FS = `uniform float uT; varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vC;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
  float scan = smoothstep(0.35, 0.5, fract(vW.y * 14.0 - uT * 2.5)) * 0.6 + 0.4;
  float band = smoothstep(0.96, 1.0, sin(vW.y * 3.0 - uT * 5.0));
  float lum = dot(vC, vec3(0.3, 0.59, 0.11));
  float a = (0.35 + lum * 0.35 + fr * 0.9) * scan + band * 0.7;
  gl_FragColor = vec4(mix(vTint.rgb, vec3(1.0), fr * 0.35 + band * 0.4), clamp(a, 0.0, 1.0) * vTint.a);
}`;
const CLOAK_FS = `uniform float uT; varying vec3 vN; varying vec3 vW; varying vec4 vTint; varying vec3 vC;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(dot(normalize(vN), V)), 1.6);
  float haze = sin(vW.y * 9.0 + vW.x * 4.0 - uT * 6.0 + sin(vW.z * 5.0 + uT * 2.0) * 1.5) * 0.5 + 0.5;
  float a = 0.12 + fr * 0.55 + haze * 0.12;
  vec3 col = mix(vC * 0.35, vec3(0.75, 0.85, 1.0), fr * 0.8 + haze * 0.15);
  gl_FragColor = vec4(col, a);
}`;

const KICK_REAR = 1.5;   // model units from a tank's centre to the rear edge it rears up on [MM-task_mvfpbbtp_1]

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
      c.setHex(k === 'accent' && def.accent != null ? def.accent : ((def.colors || UNIT_COLORS)[k] ?? 0xff00ff));   // def.colors: a model in another palette (the System miner); magenta = a key with no colour — visible on purpose
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
        w.xyz -= uSunDir * (max(w.y, 0.0) / uSunDir.y);   // a wading hull's submerged part casts from the waterline
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
  const shadowTris = {};   // per model: the shadow proxy's triangles (all groups) [MM-story_mvibvqd2_7]
  const owned = [];

  for (const key of MODEL_KEYS) {
    const def = UNIT_MODELS[key];
    const full = mergeModelGroups(THREE, def, prims, key);
    const lod = mergeModelGroups(THREE, lodDef(def), prims, key);
    const shadow = mergeModelGroups(THREE, shadowDef(def), prims, key);
    shadowTris[key] = Object.values(shadow).reduce((a, g) => a + g.tris, 0);
    const T = { def, groups: {} };
    tris[key] = { full: 0, lod: 0 };
    for (const gname of Object.keys(full)) {
      const L = lod[gname] || full[gname];
      const imLod = new THREE.InstancedMesh(L.geo, mat, cap);
      imLod.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const imFull = new THREE.InstancedMesh(full[gname].geo, mat, cap);
      imFull.instanceMatrix = imLod.instanceMatrix;          // one matrix buffer feeds full, LOD and the shadow
      // the shadow casts the group's proxy (same pivot, same instance matrices); a group with none (rotors) casts nothing
      const SG = shadow[gname], sh = SG ? new THREE.InstancedMesh(SG.geo, shMat, cap) : null;
      if (sh) { sh.instanceMatrix = imLod.instanceMatrix; owned.push(SG.geo); }
      for (const m of [imLod, imFull, sh]) if (m) { m.count = 0; m.frustumCulled = false; scene.add(m); }
      // units RECEIVE the static shadow map (T4): they darken under trees and plateaus. They don't CAST into
      // it — they move, and the map renders only on static changes; their own shadows are the planar ones.
      imLod.receiveShadow = imFull.receiveShadow = true;
      imLod.renderOrder = imFull.renderOrder = 3;
      if (sh) sh.renderOrder = 2;
      T.groups[gname] = { imFull, imLod, sh, pivot: full[gname].pivot, lodGeo: L.geo, shGeo: SG ? SG.geo : null, fxKey: key };
      tris[key].full += full[gname].tris;
      tris[key].lod += L.tris;
      owned.push(full[gname].geo);
      if (L !== full[gname]) owned.push(L.geo);
    }
    types[key] = T;
  }

  const mk = new THREE.Matrix4(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), mp = new THREE.Matrix4(), mt = new THREE.Matrix4(), mr = new THREE.Matrix4();
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), v2 = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0), qBank = new THREE.Quaternion();
  const counts = {};
  let usingLod = false;

  // ---- special-ability looks (lazy) ----
  const fxUniforms = { uT: { value: 0 } };
  let holoMat = null, cloakMat = null;
  const fxMats = () => {
    if (!holoMat) {
      holoMat = new THREE.ShaderMaterial({ uniforms: fxUniforms, vertexShader: FX_VS, fragmentShader: HOLO_FS, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      cloakMat = new THREE.ShaderMaterial({ uniforms: fxUniforms, vertexShader: FX_VS, fragmentShader: CLOAK_FS, vertexColors: true, transparent: true, depthWrite: false });
    }
  };
  const fxCounts = { holo: {}, cloak: {} };
  const fxGroups = [];   // groups that have fx meshes (to zero their counts)
  function fxOf(G) {
    if (G.fx) return G.fx;
    fxMats();
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    tint.setUsage(THREE.DynamicDrawUsage);
    G.lodGeo.setAttribute('aTint', tint);
    const holo = new THREE.InstancedMesh(G.lodGeo, holoMat, cap), cloak = new THREE.InstancedMesh(G.lodGeo, cloakMat, cap);
    for (const m of [holo, cloak]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 4; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    // aTint (colour + strength) is read by the hologram only; the cloak looks the same on every unit
    G.fx = { holo, cloak, tint };
    fxGroups.push(G);
    return G.fx;
  }
  const FX_TINT = { mirror: [0.3, 1.0, 0.95], raised: [0.35, 1.0, 0.45] };

  return {
    tris,
    /** Shadow-proxy triangles per model (shadow.js) — what each live unit's planar shadow costs. */
    shadowTris,
    material: metal,
    /** MAT: 1 = metal (default), 0 = the previous flat look. */
    setMetal(k) { metal.setMetal(k); },
    get usingLod() { return usingLod; },
    /** Each model's LOD geometry + pivot per group — FX wrecks are drawn from the unit's own geometry. */
    lodGroups() {
      const out = {};
      for (const [key, T] of Object.entries(types)) {
        out[key] = {};
        for (const [g, G] of Object.entries(T.groups)) if (!g.startsWith('barrel') && !g.startsWith('spin')) out[key][g] = { geo: G.lodGeo, shGeo: G.shGeo, pivot: G.pivot };   // rotors are not wrecked
        // a wreck's turret keeps its guns: the barrels (level) folded into the turret geometry
        const TG = T.groups.turret;
        if (TG) {
          let geo = TG.lodGeo, shGeo = TG.shGeo;
          for (const [g, BG] of Object.entries(T.groups)) if (g.startsWith('barrel')) {
            const off = BG.pivot.clone().sub(TG.pivot);
            geo = mergeOffset(THREE, geo, BG.lodGeo, off); owned.push(geo);
            if (BG.shGeo) { shGeo = shGeo ? mergeOffset(THREE, shGeo, BG.shGeo, off) : BG.shGeo; owned.push(shGeo); }   // the wreck's turret casts its guns' shadow too
          }
          out[key].turret = { geo, shGeo, pivot: TG.pivot };
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
        const fx = u.fx || null;
        const cloaked = !!(fx && fx.kind === 'cloak');
        const holo = !!(fx && (fx.kind === 'mirror' || fx.kind === 'raised'));
        const hidden = !!(fx && fx.kind === 'mirror');   // a mirror is ONLY its hologram
        const half = cap >> 1;
        let i;
        if (cloaked) { i = fxCounts.cloak[u.model] || 0; if (i >= half) continue; fxCounts.cloak[u.model] = i + 1; }
        else if (hidden) i = -1;
        else { i = counts[u.model]; if (i >= cap) continue; counts[u.model] = i + 1; }
        let hi = -1;
        if (holo) { hi = fxCounts.holo[u.model] || 0; if (hi >= half) hi = -1; else fxCounts.holo[u.model] = hi + 1; }
        drawn++;
        const k = UNIT_SCALE * (u.scale || 1);
        q.setFromAxisAngle(yAxis, -u.heading);
        if (u.bank) q.multiply(qBank.setFromAxisAngle(xAxis, u.bank));   // a plane banking through a turn (flightPath.js)
        m1.compose(v.set(u.x, u.y || 0, u.z), q, s.set(k, k, k));
        if (u.kick) {   // fire kick: the whole tank shoved back off its gun, front up on its rear edge [MM-task_mvfpbbtp_1]
          const a = u.aim ?? u.heading;
          m1.premultiply(mk.fromArray(kickMatrix(u.x, u.y || 0, u.z, Math.cos(a), Math.sin(a), u.kick.back * BODY_KICK.back, u.kick.lift * BODY_KICK.lift * Math.PI / 180, KICK_REAR * k)));
        }
        const TG = T.groups.turret;
        if (TG) mt.compose(TG.pivot, q.setFromAxisAngle(yAxis, -((u.aim ?? u.heading) - u.heading)), one).premultiply(m1);
        for (const [gname, G] of Object.entries(T.groups)) {
          if (gname === 'turret') m2.copy(mt);
          else if (gname.startsWith('spin')) {   // a rotor / fan turning about its own axis (def.spin) [MM-story_mvehe3sy_j]
            const S = (T.def.spin && T.def.spin[gname]) || { axis: 'y', speed: 20 }, a = (t * S.speed + (u.id || 0) * 1.7) % (Math.PI * 2);
            m2.copy(m1).multiply(mp.makeTranslation(G.pivot.x, G.pivot.y, G.pivot.z)).multiply(S.axis === 'z' ? mr.makeRotationZ(a) : S.axis === 'x' ? mr.makeRotationX(a) : mr.makeRotationY(a));
          }
          else if (gname.startsWith('deploy')) {   // stabilizer legs: swing from planted (authored) to stowed about the hinge [MM-story_mvh8woji_1]
            const D = T.def.deploy && T.def.deploy.groups && T.def.deploy.groups[gname];
            m2.copy(m1).multiply(mp.makeTranslation(G.pivot.x, G.pivot.y, G.pivot.z));
            if (D) m2.multiply(mr.makeRotationAxis(v2.set(D.axis[0], D.axis[1], D.axis[2]), (1 - (u.deploy ?? 1)) * D.angle * Math.PI / 180));
          }
          else if (gname.startsWith('barrel') && TG) {   // rides the turret, pitched about its trunnion [MM-story_mvedy16u_9]
            m2.copy(mt).multiply(mp.makeTranslation(G.pivot.x - TG.pivot.x, G.pivot.y - TG.pivot.y, G.pivot.z - TG.pivot.z)).multiply(mr.makeRotationZ(u.pitch || 0));
            const back = u.recoil && u.recoil[gname];   // a main gun's slide-back, along its pitched axis [MM-story_mvee15ja_b]
            if (back) m2.multiply(mp.makeTranslation(-back, 0, 0));
          } else {
            m2.copy(m1).multiply(mp.makeTranslation(G.pivot.x, G.pivot.y, G.pivot.z));
          }
          if (cloaked) {
            fxOf(G).cloak.setMatrixAt(i, m2);
          } else if (i >= 0) G.imLod.setMatrixAt(i, m2);
          if (hi >= 0) {
            const F = fxOf(G), c = FX_TINT[fx.kind]; F.holo.setMatrixAt(hi, m2); F.tint.setXYZW(hi, c[0], c[1], c[2], fx.k ?? 1);
          }
        }
      }
      fxUniforms.uT.value = t;
      for (const G of fxGroups) {
        const key = G.fxKey;
        const nh = fxCounts.holo[key] || 0, nc = fxCounts.cloak[key] || 0;
        G.fx.holo.count = nh; G.fx.cloak.count = nc;
        G.fx.holo.visible = nh > 0; G.fx.cloak.visible = nc > 0;
        if (nh) G.fx.holo.instanceMatrix.needsUpdate = true;
        if (nc) G.fx.cloak.instanceMatrix.needsUpdate = true;
        if (nh || nc) G.fx.tint.needsUpdate = true;
      }
      for (const key of Object.keys(fxCounts.holo)) fxCounts.holo[key] = 0;
      for (const key of Object.keys(fxCounts.cloak)) fxCounts.cloak[key] = 0;
      usingLod = camDist > LOD_DISTANCE;
      for (const key of MODEL_KEYS) {
        const n = counts[key];
        for (const G of Object.values(types[key].groups)) {
          G.imLod.count = usingLod ? n : 0;
          G.imFull.count = usingLod ? 0 : n;
          if (G.sh) G.sh.count = liveShadows ? n : 0;
          G.imLod.instanceMatrix.needsUpdate = true;
        }
      }
      return drawn;
    },
    dispose() {
      for (const T of Object.values(types)) for (const G of Object.values(T.groups)) {
        for (const m of [G.imFull, G.imLod, G.sh]) if (m) scene.remove(m);
      }
      for (const G of fxGroups) { scene.remove(G.fx.holo); scene.remove(G.fx.cloak); }
      if (holoMat) { holoMat.dispose(); cloakMat.dispose(); }
      for (const g of owned) g.dispose();
      mat.dispose(); shMat.dispose();
    },
  };
}
