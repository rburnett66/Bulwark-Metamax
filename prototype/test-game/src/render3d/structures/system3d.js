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
import { pitchFor, apexFor } from '../fx/elevation.js';
import { AIM } from '../fx/combatFxModel.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';
import { createRecoil } from '../fx/recoil.js';

/** Sim structure kind → System model. Kinds not listed stay with structures/lowpoly.js. */
export const SYSTEM_KINDS = Object.freeze({ antiGround: 'sys_cannon', antiAir: 'sys_flak', wall: 'sys_wall' });
/** Tower types with their own model (the new towers share a kind with cannon / flak). */
export const SYSTEM_STRUCTS = Object.freeze({ 'STR-Rockets': 'sys_rockets', 'STR-Missile': 'sys_missile' });
export const SYSTEM_CAP = Object.freeze({ sys_cannon: 200, sys_flak: 200, sys_wall: 1200, sys_rockets: 120, sys_missile: 120 });
const modelOf = (s) => SYSTEM_STRUCTS[s.structId] || SYSTEM_KINDS[s.kind];
const TURN = 5;   // rad/s a turret slews at
const DEG = Math.PI / 180;

/**
 * Where a tower's target is in the world (pure): a drawn flyer pose, a unit, a structure or the base — or null.
 * Towers aim at structure and base targets as well as units [MM-story_mvedxzco_8]. Heights match the shots'
 * (combatFxModel AIM / HOVER_HEIGHT) so the barrel pitch and the flight agree.
 */
export function towerTarget(state, s, drawn) {
  if (!s || s.targetId == null) return null;
  const tid = s.targetId, dp = drawn && drawn.get(tid);
  if (dp) return { x: dp.x, y: dp.y == null ? HOVER_HEIGHT : dp.y, z: dp.z };
  if (!state) return null;
  if (tid === BASE_TARGET_ID) {
    const b = state.base && state.base.pos;
    return b ? { x: b.x + 0.5, y: AIM.base, z: b.y + 0.5 } : null;
  }
  const u = state.units && state.units.get(tid);
  if (u && u.pos && !(u.hp <= 0)) return { x: u.pos.x + 0.5, y: u.domain === 'Flyer' || u.altitude > 0 ? HOVER_HEIGHT : AIM.ground, z: u.pos.y + 0.5 };
  const t = state.structures && state.structures.get(tid);
  if (t && t.pos && t.lifecycle !== 'Destroyed') {
    const fp = t.footprint || {};
    return { x: t.pos.x + (fp.w || 1) / 2, y: AIM.structure, z: t.pos.y + (fp.h || 1) / 2 };
  }
  return null;
}

/**
 * The pitch (radians, + = up) a barrel wants for a target, from its firing point m, per the model's `barrel.aim`:
 * the same launch slope the round flies (elevation.js), clamped to the barrel's limits. [MM-story_mvedxxo7_7]
 */
export function barrelPitchFor(bar, m, to) {
  const h = Math.hypot(to.x - m.x, to.z - m.z), d3 = Math.hypot(h, to.y - m.y);
  let p;
  if (bar.aim === 'shell') p = pitchFor(m, to, apexFor('shell', h));
  else if (bar.aim === 'rocket') p = pitchFor(m, to, apexFor('rocket', d3));
  else p = pitchFor(m, to, 0);
  return Math.max(bar.min * DEG, Math.min(bar.max * DEG, p));
}

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
  const live = (list || []).filter((s) => s && s.lifecycle !== 'Destroyed' && modelOf(s));
  const cellOf = (s) => { const c = s.cell || s.pos; return { x: Math.floor(c.x), y: Math.floor(c.y) }; };
  const walls = new Set(live.filter((s) => s.kind === 'wall').map((s) => { const c = cellOf(s); return `${c.x},${c.y}`; }));
  const bx = base ? base.x + 0.5 : null, bz = base ? base.y + 0.5 : null;
  for (const s of live) {
    const c = cellOf(s), w = (s.footprint && s.footprint.w) || 1, h = (s.footprint && s.footprint.h) || 1;
    const x = c.x + w / 2, z = c.y + h / 2, look = lifecycleLook(s), model = modelOf(s);
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

/**
 * Where a System tower's i-th firing point is in the world (pure) — the barrel / rail tip the round leaves from,
 * following the turret's yaw. it: a planSystem item { model, x, z, ry, sy }; wy: the turret's world yaw.
 * → { x, y, z, dx, dy, dz, bx, by, bz, brake, n } (unit direction out of the barrel; b* = the breech / nozzle end),
 * or null for a model without firing points. [MM-task_mvbz1121_11]
 */
export function muzzlePoint(it, wy, i = 0, pitch) {
  const def = it && SYSTEM_MODELS[it.model], list = def && def.muzzles;
  if (!list || !list.length) return null;
  const m = list[((i % list.length) + list.length) % list.length];
  const pv = (def.pivots && def.pivots.weapon) || [0, 0, 0], k = SYSTEM_SCALE[it.model] || 0.25, sy = it.sy == null ? 1 : it.sy;
  const local = wy - it.ry, cl = Math.cos(local), sl = Math.sin(local), cr = Math.cos(it.ry), sr = Math.sin(it.ry);
  // a pitching barrel: tilt the tip and axis about the trunnion (model Rz) by the pitch past the authored angle
  const bar = def.barrel, pb = bar && def.pivots && def.pivots.barrel;
  const del = bar && pb ? (pitch == null ? bar.rest * DEG : pitch) - bar.authored * DEG : 0;
  const ce = Math.cos(del), se = Math.sin(del);
  const tilt = (p) => { if (!del) return p; const x = p[0] - pb[0], y = p[1] - pb[1]; return [pb[0] + x * ce - y * se, pb[1] + x * se + y * ce, p[2]]; };
  // model space: turn about the weapon pivot (three.js Ry: x' = x·c + z·s, z' = −x·s + z·c) …
  const tx = (p) => { const x = p[0] - pv[0], z = p[2] - pv[2]; return [pv[0] + x * cl + z * sl, p[1], pv[2] - x * sl + z * cl]; };
  // … then scale and place the root (cell centre, base yaw)
  const place = (q) => { const x = q[0] * k, z = q[2] * k; return [it.x + x * cr + z * sr, q[1] * k * sy, it.z - x * sr + z * cr]; };
  const tip = place(tx(tilt(m.p)));
  const d0 = m.d || [1, 0, 0], d = del ? [d0[0] * ce - d0[1] * se, d0[0] * se + d0[1] * ce, d0[2]] : d0;
  const dl = Math.hypot(d[0], d[1], d[2]) || 1, a = wy;
  const dx = (d[0] * Math.cos(a) + d[2] * Math.sin(a)) / dl, dy = d[1] / dl, dz = (-d[0] * Math.sin(a) + d[2] * Math.cos(a)) / dl;
  const back = (m.back || 0) * k;
  const out = { x: tip[0], y: tip[1], z: tip[2], dx, dy, dz, bx: tip[0] - dx * back, by: tip[1] - dy * back * sy, bz: tip[2] - dz * back, brake: (m.brake || 0) * k, n: list.length,
    gx: it.x, gz: it.z, gr: 0.42 };   // the tower's foot on the ground (the firing shockwave starts here)
  // a pitching barrel reports its limits and aim rule, so the fire gate can wait for the pitch too (combatFxModel)
  if (bar && pb) { out.pmin = bar.min * DEG; out.pmax = bar.max * DEG; out.aim = bar.aim; }
  return out;
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
  const pitch = new Map();   // structure id → current barrel pitch (radians) [MM-story_mvedxxo7_7]
  const recoil = createRecoil();   // cannon barrels slide back on each shell [MM-story_mvee15ja_b]
  const pitchOf = (it) => { const b = SYSTEM_MODELS[it.model].barrel; return pitch.has(it.id) ? pitch.get(it.id) : b ? b.rest * DEG : 0; };
  const byItem = new Map();   // structure id → its aiming instance (firing points)

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
  // turrets + heads. prims.buildModel leaves each group's geometry RELATIVE TO ITS PIVOT (the group node carries the
  // pivot), so the instance matrix is base · T(pivot) · own rotation — no −pivot. (It used to append −pivot too,
  // which drew every turret, barrel and optic a pivot-height LOW, a third of a cell under the authored model and
  // under the firing points — owner: "they appear to be floating". [MM-task_mvd1yej4_g])
  // The head rides on the weapon: base · T(pw) · Rw · T(ph − pw) · Rh.
  function writeMoving() {
    for (const it of items) {
      const K = kinds[it.model];
      if (it.slot == null || !K.meshes.weapon) continue;
      const wy = yaw.has(it.id) ? yaw.get(it.id) : it.ry;
      const R = rootMatrix(it, it.ry, M);
      const pw = K.parts.weapon.pivot, local = wy - it.ry;
      const W = R.clone().multiply(Mp.makeTranslation(pw[0], pw[1], pw[2])).multiply(Mr.makeRotationY(local));
      K.meshes.weapon.setMatrixAt(it.slot, W);
      if (K.meshes.head) {
        const ph = K.parts.head.pivot, sweep = Math.sin(clock * 1.25 + it.slot * 0.9) * 0.9;
        const H = W.clone().multiply(Mp.makeTranslation(ph[0] - pw[0], ph[1] - pw[1], ph[2] - pw[2])).multiply(Mr.makeRotationY(sweep));
        K.meshes.head.setMatrixAt(it.slot, H);
      }
      if (K.meshes.barrel) {   // the barrel rides the turret and pitches about its trunnion: W · T(pb − pw) · Rz(pitch − authored)
        const pb = K.parts.barrel.pivot, bar = SYSTEM_MODELS[it.model].barrel, el = bar ? pitchOf(it) - bar.authored * DEG : 0;
        const back = recoil.offset(it.id, 0, SYSTEM_MODELS[it.model].recoil || 0);   // along the pitched axis, after the pitch
        const B = W.clone().multiply(Mp.makeTranslation(pb[0] - pw[0], pb[1] - pw[1], pb[2] - pw[2])).multiply(Mr.makeRotationZ(el));
        if (back) B.multiply(Mp.makeTranslation(-back, 0, 0));
        K.meshes.barrel.setMatrixAt(it.slot, B);
      }
    }
    for (const K of Object.values(kinds)) for (const g of ['weapon', 'head', 'barrel']) if (K.meshes[g]) K.meshes[g].instanceMatrix.needsUpdate = true;
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
      byItem.clear(); for (const it of items) if (it.aim) byItem.set(it.id, it);
      const ids = new Set(items.map((i) => i.id));
      for (const id of [...yaw.keys()]) if (!ids.has(id)) yaw.delete(id);
      for (const id of [...pitch.keys()]) if (!ids.has(id)) pitch.delete(id);
      writeBodies(); writeMoving();
      return true;
    },
    /** Turn turrets toward their targets and sweep the optics. Every frame; never touches the shadow map. */
    update(dt, state, drawn) {   // drawn: Map unit id → drawn pose (planes on attack runs) [MM-story_mvee9r08_e]
      clock += dt || 0;
      recoil.step(dt);
      if (!items.length) return;
      const byId = new Map(lastList.map((s) => [s.id, s]));
      const step = TURN * Math.min(0.1, Math.max(0, dt || 0));
      const dts = Math.min(0.1, Math.max(0, dt || 0));
      for (const it of items) {
        if (!it.aim) continue;
        const s = byId.get(it.id), to = towerTarget(state, s, drawn);
        const want = to ? yawToward(to.x - it.x, to.z - it.z) : it.ry;
        const cur = yaw.has(it.id) ? yaw.get(it.id) : it.ry;
        let d = ((want - cur) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const wy = cur + Math.max(-step, Math.min(step, d));
        yaw.set(it.id, wy);
        // pitch: toward the launch slope from the current firing point; idle → ease back to rest
        const bar = SYSTEM_MODELS[it.model].barrel;
        if (!bar) continue;
        const pc = pitchOf(it), m = to && muzzlePoint(it, wy, 0, pc);
        const pw = m ? barrelPitchFor(bar, m, to) : bar.rest * DEG;
        const ps = bar.rate * dts * (m ? 1 : 0.5);
        pitch.set(it.id, pc + Math.max(-ps, Math.min(ps, pw - pc)));
      }
      writeMoving();
    },
    /** A round left firing point n of tower `id`: a cannon barrel kicks back (models with `recoil` only). */
    kick(id, n = 0) { const it = byItem.get(id); if (it && SYSTEM_MODELS[it.model].recoil) recoil.kick(id, 0); },
    /** How far (model units) tower `id`'s barrel is back right now. */
    recoilOf(id) { const it = byItem.get(id); return it ? recoil.offset(id, 0, SYSTEM_MODELS[it.model].recoil || 0) : 0; },
    /** Current barrel pitch (radians) of a tower, or null without a barrel. */
    pitch(id) { const it = byItem.get(id); return it && SYSTEM_MODELS[it.model].barrel ? pitchOf(it) : null; },
    /** The world firing point i of a tower (by structure id) at its turret's current yaw and barrel pitch, or null. See muzzlePoint. */
    muzzle(id, i = 0) {
      const it = byItem.get(id);
      if (!it) return null;
      return muzzlePoint(it, yaw.has(id) ? yaw.get(id) : it.ry, i, pitchOf(it));
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
