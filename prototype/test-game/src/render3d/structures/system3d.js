/**
 * src/render3d/structures/system3d.js — the player's towers and walls as the SYSTEM models (systemModels.js), in the
 * battle view. [MM-story_mvbr0qfb_o]
 *
 * Owner 2026-10-16: "We should also put the new 3d towers and walls in." The cannon (antiGround), anti-air (antiAir)
 * and wall structures draw as the owner-sheet models instead of the LPS low-poly meshes (structures/lowpoly.js still
 * draws the bays, the fallback blocks and the crystals). Each model group (base / weapon / head) is ONE InstancedMesh
 * in the units' metal material — one draw call per group whatever the count. Turrets turn toward their target
 * (s.targetId, refreshed every combat tick — the same rule as the Pixi turrets) and idle outward from the base; the
 * optic heads sweep. Lifecycle reads as the LPS one: building rises in four steps with a cool tint, upgrading warm,
 * damaged darker, selling grey.
 *
 * Bases cast into the static shadow map (set* returns true when it must re-render); turrets and heads move every
 * frame, so they receive shadows but do not cast (a moving caster would need a per-frame shadow pass).
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from '../units/prims.js';
import { createUnitMaterial } from '../units/material.js';
import { metalFor, isGlowKey } from '../units/metal.js';
import { SYSTEM_MODELS, SYSTEM_COLORS, SYSTEM_SCALE } from './systemModels.js';
import { lifecycleLook, yawToward } from './models.js';

/** Sim structure kind → System model. Kinds not listed stay with structures/lowpoly.js. */
export const SYSTEM_KINDS = Object.freeze({ antiGround: 'sys_cannon', antiAir: 'sys_flak', wall: 'sys_wall' });
export const SYSTEM_CAP = Object.freeze({ sys_cannon: 200, sys_flak: 200, sys_wall: 1200 });
const TURN = 5;   // rad/s a turret slews at

/** Merge a System def into one vertex-coloured geometry per group: { body, weapon?, head? } → { geo, pivot, tris }. */
export function mergeSystemModel(THREE, def, prims = createPrims(THREE)) {
  const dummy = new THREE.MeshBasicMaterial();
  const built = prims.buildModel(def, () => dummy);
  const out = {}, c = new THREE.Color();
  for (const [g, G] of Object.entries(built.groups)) {
    const pos = [], nor = [], col = [], emi = [], mr = [];
    for (const mesh of G.children) {
      const k = mesh.userData.mat;
      c.setHex(SYSTEM_COLORS[k] ?? 0xff00ff);   // magenta = a key with no colour — visible on purpose
      const e = isGlowKey(k) ? 1 : 0, [m, r] = metalFor(k);
      const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
      for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); col.push(c.r, c.g, c.b); emi.push(e); mr.push(m, r); }
      mesh.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aEmit', new THREE.Float32BufferAttribute(emi, 1));
    geo.setAttribute('aMR', new THREE.Float32BufferAttribute(mr, 2));
    geo.computeBoundingSphere();
    out[g] = { geo, pivot: (def.pivots && def.pivots[g]) || [0, 0, 0], tris: pos.length / 9 };
  }
  dummy.dispose();
  return out;
}

/**
 * Plan the System instances for a list of sim structures (pure). Returns { items: [{ id, model, x, z, ry, sy, tint,
 * aim }], sig }. Towers face outward from `base` until they aim; a wall draws a segment along each axis it has a
 * wall neighbour on (a lone wall runs north–south), so lines and corners read as one curtain.
 */
export function planSystem(list, base = null) {
  const items = [], sig = [];
  const live = (list || []).filter((s) => s && s.lifecycle !== 'Destroyed' && SYSTEM_KINDS[s.kind]);
  const cellOf = (s) => { const c = s.cell || s.pos; return { x: Math.floor(c.x), y: Math.floor(c.y) }; };
  const walls = new Set(live.filter((s) => s.kind === 'wall').map((s) => { const c = cellOf(s); return `${c.x},${c.y}`; }));
  const bx = base ? base.x + 0.5 : null, bz = base ? base.y + 0.5 : null;
  for (const s of live) {
    const c = cellOf(s), w = (s.footprint && s.footprint.w) || 1, h = (s.footprint && s.footprint.h) || 1;
    const x = c.x + w / 2, z = c.y + h / 2, look = lifecycleLook(s), model = SYSTEM_KINDS[s.kind];
    sig.push(`${s.id}:${s.kind}@${c.x},${c.y}:${look.key}`);
    if (model === 'sys_wall') {
      const ns = walls.has(`${c.x},${c.y - 1}`) || walls.has(`${c.x},${c.y + 1}`), ew = walls.has(`${c.x - 1},${c.y}`) || walls.has(`${c.x + 1},${c.y}`);
      if (ns || !ew) items.push({ id: s.id, model, x, z, ry: 0, sy: look.sy, tint: look.tint, aim: false });
      if (ew) items.push({ id: s.id, model, x, z, ry: Math.PI / 2, sy: look.sy, tint: look.tint, aim: false });
      continue;
    }
    const ry = bx !== null && (x !== bx || z !== bz) ? yawToward(x - bx, z - bz) : 0;
    items.push({ id: s.id, model, x, z, ry, sy: look.sy, tint: look.tint, aim: true });
  }
  return { items, sig: sig.join('|') };
}

export function createSystemStructures(THREE, scene, { env } = {}) {
  const mat = createUnitMaterial(THREE, env ? { env } : {});
  const group = new THREE.Group(); group.name = 'structures-system';
  scene.add(group);
  const prims = createPrims(THREE);
  const kinds = {};
  for (const [model, cap] of Object.entries(SYSTEM_CAP)) {
    const parts = mergeSystemModel(THREE, SYSTEM_MODELS[model], prims), meshes = {};
    for (const [g, P] of Object.entries(parts)) {
      const m = new THREE.InstancedMesh(P.geo, mat.material, cap);
      m.name = `system-${model}-${g}`;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      m.count = 0; m.visible = false; m.frustumCulled = false;
      m.castShadow = g === 'body'; m.receiveShadow = true;
      group.add(m); meshes[g] = m;
    }
    kinds[model] = { parts, meshes, cap };
  }
  const M = new THREE.Matrix4(), Mp = new THREE.Matrix4(), Mr = new THREE.Matrix4(), Ms = new THREE.Matrix4(), col = new THREE.Color();
  let base = null, sig = null, lastList = [], items = [], clock = 0;
  const yaw = new Map();   // structure id → current turret yaw (radians, world)

  // root transform of an instance: cell centre, yaw, cell scale (+ the lifecycle rise)
  function rootMatrix(it, ry, out) {
    const k = SYSTEM_SCALE[it.model] || 0.25;
    return out.makeRotationY(ry).premultiply(Mp.makeTranslation(it.x, 0, it.z)).multiply(Ms.makeScale(k, k * it.sy, k));
  }
  function writeBodies() {
    const n = {};
    for (const it of items) {
      const K = kinds[it.model], i = n[it.model] = (n[it.model] || 0);
      if (i >= K.cap) continue;
      n[it.model] = i + 1;
      K.meshes.body.setMatrixAt(i, rootMatrix(it, it.ry, M));
      for (const m of Object.values(K.meshes)) m.setColorAt(i, col.setRGB(it.tint[0], it.tint[1], it.tint[2]));
      it.slot = i;
    }
    for (const [model, K] of Object.entries(kinds)) {
      const c = Math.min(n[model] || 0, K.cap);
      for (const m of Object.values(K.meshes)) { m.count = c; m.visible = c > 0; m.instanceColor.needsUpdate = true; }
      K.meshes.body.instanceMatrix.needsUpdate = true;
    }
  }
  // turrets + heads: base transform · pivot · own rotation · −pivot (head rides on the weapon's pivot)
  function writeMoving() {
    for (const it of items) {
      const K = kinds[it.model];
      if (it.slot == null || !K.meshes.weapon) continue;
      const wy = yaw.has(it.id) ? yaw.get(it.id) : it.ry;
      const R = rootMatrix(it, it.ry, M);
      const pw = K.parts.weapon.pivot, local = wy - it.ry;
      const W = R.clone().multiply(Mp.makeTranslation(pw[0], pw[1], pw[2])).multiply(Mr.makeRotationY(local)).multiply(Ms.makeTranslation(-pw[0], -pw[1], -pw[2]));
      K.meshes.weapon.setMatrixAt(it.slot, W);
      if (K.meshes.head) {
        const ph = K.parts.head.pivot, sweep = Math.sin(clock * 1.25 + it.slot * 0.9) * 0.9;
        const H = W.clone().multiply(Mp.makeTranslation(ph[0], ph[1], ph[2])).multiply(Mr.makeRotationY(sweep)).multiply(Ms.makeTranslation(-ph[0], -ph[1], -ph[2]));
        K.meshes.head.setMatrixAt(it.slot, H);
      }
    }
    for (const K of Object.values(kinds)) { if (K.meshes.weapon) K.meshes.weapon.instanceMatrix.needsUpdate = true; if (K.meshes.head) K.meshes.head.instanceMatrix.needsUpdate = true; }
  }

  const api = {
    group, kinds,
    setBase(b) { base = b ? { x: b.x, y: b.y } : null; sig = null; },
    /** Returns true when the static set changed (the caller re-renders the shadow map once). */
    setStructures(list) {
      lastList = list || [];
      const plan = planSystem(lastList, base);
      if (plan.sig === sig) return false;
      sig = plan.sig; items = plan.items;
      const ids = new Set(items.map((i) => i.id));
      for (const id of [...yaw.keys()]) if (!ids.has(id)) yaw.delete(id);
      writeBodies(); writeMoving();
      return true;
    },
    /** Turn turrets toward their targets and sweep the optics. Every frame; never touches the shadow map. */
    update(dt, state) {
      clock += dt || 0;
      if (!items.length) return;
      const byId = new Map(lastList.map((s) => [s.id, s]));
      const step = TURN * Math.min(0.1, Math.max(0, dt || 0));
      for (const it of items) {
        if (!it.aim) continue;
        const s = byId.get(it.id), u = s && s.targetId != null && state && state.units ? state.units.get(s.targetId) : null;
        const want = u && u.pos ? yawToward(u.pos.x - it.x, u.pos.y - it.z) : it.ry;
        const cur = yaw.has(it.id) ? yaw.get(it.id) : it.ry;
        let d = ((want - cur) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        yaw.set(it.id, cur + Math.max(-step, Math.min(step, d)));
      }
      writeMoving();
    },
    /** Point the metal reflection at the world's sky / ground. */
    setEnv(e) { if (e) mat.setEnv(e); },
    dispose() {
      for (const K of Object.values(kinds)) for (const P of Object.values(K.parts)) P.geo.dispose();
      mat.material.dispose();
      scene.remove(group);
    },
  };
  return api;
}
