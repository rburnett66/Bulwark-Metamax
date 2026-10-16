/**
 * src/render3d/craft/craft3d.js — a landing craft in the scene, and the binder that poses it. [MM-story_mvbk1hf3_1]
 * [MM-story_mvbks05m_4]
 *
 * The craft is the player's 3 × 3 base (models.js). It is ONE instance per level, so each animated group is a
 * plain Mesh — no instancing — merged per group into one vertex-coloured geometry, drawn with the units' metal
 * material (units/material.js: per-vertex colour, metalness/roughness, unlit glow). Engine-glow parts (`glowE`)
 * are split into their own mesh per group so thrust can brighten them without touching the rest.
 *
 *   root (world: base centre, scaled 1 cell = 4 units)
 *   ├─ model (pose: altitude, yaw, pitch, roll)
 *   │   ├─ body · gear · doorR · doorL        (gear translates, doors rotate about their sill hinges)
 *   │   ├─ weapon (yaws) └─ head (scans)       (head rides on the weapon)
 *   │   └─ plumes (additive cones at each lift jet / rear nozzle)
 *   └─ ground set: blob shadow (airborne), dust ring, shield dome (shield crafts)
 *
 * Shadows: airborne, the craft does NOT cast into the static shadow map (that would re-render it every frame);
 * a soft blob shadow follows it instead. setCastShadow(true) on touchdown, then the caller re-renders the map once.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from '../units/prims.js';
import { createUnitMaterial } from '../units/material.js';
import { metalFor, isGlowKey } from '../units/metal.js';
import { craftFor, CRAFT_SCALE } from './models.js';

const D2R = Math.PI / 180;
const ENGINE = 'glowE';

/** Merge a craft's groups into { [group]: { lit, engine, pivot, tris } } — exported for tests and tools. */
export function mergeCraftGroups(THREE, def, prims = createPrims(THREE)) {
  const dummy = new THREE.MeshBasicMaterial();
  const built = prims.buildModel(def, () => dummy);
  const out = {}, c = new THREE.Color();
  for (const [gname, G] of Object.entries(built.groups)) {
    const L = { pos: [], nor: [], col: [], emi: [], mr: [] }, E = { pos: [], nor: [], col: [] };
    for (const mesh of G.children) {
      const k = mesh.userData.mat, hex = def.palette[k] || (isGlowKey(k) ? def.palette.glow : null);
      c.set(hex || '#ff00ff');   // magenta = a key with no colour — visible on purpose
      const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
      if (k === ENGINE) {
        for (let i = 0; i < P.length; i += 3) { E.pos.push(P[i], P[i + 1], P[i + 2]); E.nor.push(N[i], N[i + 1], N[i + 2]); E.col.push(c.r, c.g, c.b); }
      } else {
        const e = isGlowKey(k) ? 1 : 0, [mtl, rgh] = metalFor(k);
        for (let i = 0; i < P.length; i += 3) {
          L.pos.push(P[i], P[i + 1], P[i + 2]); L.nor.push(N[i], N[i + 1], N[i + 2]);
          L.col.push(c.r, c.g, c.b); L.emi.push(e); L.mr.push(mtl, rgh);
        }
      }
      mesh.geometry.dispose();
    }
    const geo = (A, extra) => {
      if (!A.pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
      if (extra) { g.setAttribute('aEmit', new THREE.Float32BufferAttribute(A.emi, 1)); g.setAttribute('aMR', new THREE.Float32BufferAttribute(A.mr, 2)); }
      g.computeBoundingSphere();
      return g;
    };
    const piv = (def.pivots && def.pivots[gname]) || [0, 0, 0];   // prims already made the geometry pivot-relative
    out[gname] = { lit: geo(L, true), engine: geo(E, false), pivot: piv, tris: (L.pos.length + E.pos.length) / 9 };
  }
  dummy.dispose();
  return out;
}

/** Lift-jet (vertical) and rear-nozzle (ax 'x') positions, from the craft's glowE parts. */
export function jetsOf(def) {
  const out = [];
  for (const p of def.parts) {
    if (p.m !== ENGINE || p.t !== 'cyl') continue;
    const r = Array.isArray(p.r) ? p.r[0] : p.r, at = [p.p];
    if (p.mir) at.push([p.p[0], p.p[1], -p.p[2]]);
    for (const q of at) out.push({ p: q, r, dir: p.ax === 'x' ? 'back' : 'down', g: p.g || 'body' });
  }
  return out;
}

/**
 * Build a craft (by craft key or faction key) into `scene`. Returns the API the renderer and the tools use:
 *   place(baseCell) · setEnv({ sky, ground }) · apply(pose) · aim(yawRad | null, dt) · scan(t)
 *   setCastShadow(on) · setVisible(on) · harvesterWorld(side, k) · dispose()
 * opts: { tier: { liveShadows } } — the Low tier skips plumes.
 */
export function createCraft3D(THREE, scene, key, opts = {}) {
  const def = craftFor(key);
  const prims = createPrims(THREE);
  const mat = createUnitMaterial(THREE, opts.env ? { env: opts.env } : {});
  const engineMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const parts = mergeCraftGroups(THREE, def, prims);

  const root = new THREE.Group(); root.name = 'landing-craft';
  root.scale.setScalar(CRAFT_SCALE);
  const model = new THREE.Group(); root.add(model);
  const groups = {};
  const meshes = [];
  for (const [g, P] of Object.entries(parts)) {
    const G = new THREE.Group(); G.name = g;
    for (const [geo, m] of [[P.lit, mat.material], [P.engine, engineMat]]) {
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = false; mesh.receiveShadow = true;
      G.add(mesh); meshes.push(mesh);
    }
    groups[g] = G;
  }
  // hierarchy: head rides on the weapon; everything else on the model
  for (const [g, G] of Object.entries(groups)) {
    const piv = parts[g].pivot;
    if (g === 'head' && groups.weapon) {
      const w = parts.weapon.pivot;
      G.position.set(piv[0] - w[0], piv[1] - w[1], piv[2] - w[2]);
      groups.weapon.add(G);
    } else {
      G.position.set(piv[0], piv[1], piv[2]);
      model.add(G);
    }
  }
  // exhaust plumes (additive cones, unlit)
  const plumes = [];
  const plumeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.palette.glowE || def.palette.glow), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  if (!(opts.tier && opts.tier.key === 'low')) {
    for (const j of jetsOf(def)) {
      const len = j.dir === 'down' ? 2.6 : 3.2;
      const geo = new THREE.ConeGeometry(j.r * 0.95, len, 10, 1, true); geo.translate(0, -len / 2, 0);
      const cone = new THREE.Mesh(geo, plumeMat);
      const h = new THREE.Group(); h.position.set(j.p[0], j.p[1], j.p[2]);
      if (j.dir === 'back') h.rotation.z = -Math.PI / 2;
      h.add(cone); model.add(h); plumes.push({ cone, dir: j.dir });
    }
  }
  // ground set: blob shadow, dust ring, shield dome
  const blob = new THREE.Mesh(new THREE.CircleGeometry(7.2, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  blob.position.y = 0.06; blob.renderOrder = 1; root.add(blob);
  const dust = new THREE.Mesh(new THREE.RingGeometry(5, 9.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, transparent: true, opacity: 0, depthWrite: false }));
  dust.position.y = 0.08; root.add(dust);
  let dome = null;
  if (/shield/.test(def.weaponType)) {
    dome = new THREE.Mesh(new THREE.SphereGeometry(10.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(def.palette.glow), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    root.add(dome);
  }
  scene.add(root);

  const A = def.anim, engineBase = 1;
  let aimYaw = 0, castShadow = false, idle = 0;
  const api = {
    def, root, model, groups,
    tris: Object.values(parts).reduce((a, p) => a + p.tris, 0),
    /** Put the craft on the base cell (the centre of the 3 × 3). */
    place(b) { root.visible = !!b; if (b) root.position.set(b.x + 0.5, 0, b.y + 0.5); },
    setVisible(on) { root.visible = !!on; },
    setEnv(env) { if (env) mat.setEnv(env); },
    setMetal(k) { mat.setMetal(k); },
    setCastShadow(on) { castShadow = !!on; for (const m of meshes) m.castShadow = castShadow; },
    get castShadow() { return castShadow; },
    /** Apply a landing.js pose (model units around the landing spot). */
    apply(P) {
      model.position.set(P.x || 0, P.y || 0, P.z || 0);
      model.rotation.set((P.roll || 0) * D2R, (P.yaw || 0) * D2R, (P.pitch || 0) * D2R, 'YXZ');
      if (groups.gear) groups.gear.position.y = parts.gear.pivot[1] + A.gear.retract * (1 - P.gear);
      if (groups.doorR) groups.doorR.rotation.x = A.doorR.open * D2R * (P.doors || 0);
      if (groups.doorL) groups.doorL.rotation.x = A.doorL.open * D2R * (P.doors || 0);
      const thrust = Math.max(P.lift || 0, P.rear || 0);
      engineMat.color.setScalar(engineBase * (0.35 + 0.65 * thrust));
      for (const p of plumes) { const v = p.dir === 'down' ? P.lift || 0 : P.rear || 0; p.cone.visible = v > 0.02; p.cone.scale.set(1, 0.3 + v, 1); }
      plumeMat.opacity = 0.5 * Math.max(P.lift || 0, P.rear || 0);
      blob.position.x = P.x || 0; blob.position.z = P.z || 0;
      blob.material.opacity = 0.32 * (P.shadow || 0); blob.visible = (P.shadow || 0) > 0.01;
      const bs = 0.8 + 0.4 * Math.min(1, (P.y || 0) / 20); blob.scale.set(bs, 1, bs);
      dust.material.opacity = 0.35 * (P.dust || 0); dust.visible = (P.dust || 0) > 0.01;
      const ds = 0.7 + (P.dust || 0) * 0.6; dust.scale.set(ds, 1, ds);
      if (dome) { dome.material.opacity = 0.12 * (P.shield || 0); dome.visible = (P.shield || 0) > 0.01; dome.scale.setScalar(0.2 + 0.8 * (P.shield || 0)); }
    },
    /** Turn the roof weapon toward a world yaw (radians, three's convention), or idle-sweep when null. */
    aim(worldYaw, dt) {
      if (!groups.weapon) return;
      const modelYaw = model.rotation.y;
      let goal;
      if (worldYaw == null) { idle += dt || 0; goal = Math.sin(idle * 0.45) * 0.9; } else goal = worldYaw - modelYaw;
      let d = ((goal - aimYaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      aimYaw += Math.max(-1, Math.min(1, d)) * Math.min(1, (dt || 0) * 3);
      groups.weapon.rotation.y = aimYaw;
    },
    /** Sweep or spin the head (seconds of clock). */
    scan(t) {
      if (!groups.head) return;
      const H = def.head || {};
      groups.head.rotation[H.axis || 'y'] = H.mode === 'spin' ? t * (H.speed || 2) : Math.sin(t * 1.25) * 0.9;
    },
    /** A ramp point in WORLD units (cells): side +1 = the +Z hatch, −1 = the −Z hatch; local {z, y} from landing.js. */
    toWorld(local) {
      const v = new THREE.Vector3(local.x || 0, local.y || 0, local.z || 0);
      model.updateMatrix(); v.applyMatrix4(model.matrix); v.multiplyScalar(CRAFT_SCALE);
      return { x: root.position.x + v.x, y: v.y, z: root.position.z + v.z };
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      mat.material.dispose(); engineMat.dispose(); plumeMat.dispose();
      blob.material.dispose(); dust.material.dispose(); if (dome) dome.material.dispose();
    },
  };
  return api;
}
