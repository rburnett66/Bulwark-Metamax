/**
 * src/render3d/overlays/contacts.js — enemies outside the play area are HIDDEN CONTACTS: a red reticle, no model.
 * [MM-story_mveehs1r_f] — docs/tech-plan/3D-Combat-Polish.md §9.
 *
 * Owner 2026-10-18: "all units outside of the play area should be indicated with red reticle to hide what unit type
 * they are." Every attacking unit outside the fog window (fogModel.js) is drawn as the same pulsing red ground
 * reticle — same size for every type, flyers too (on the ground, so altitude is hidden) — and its model, health bar,
 * dust and own muzzle effects are dropped. When it crosses into the play area the reticle fades out while the model
 * grows in from a smaller scale (a short "materialise", instanced meshes have no per-instance opacity).
 *
 * Pure planning (createContacts) + a one-draw-call view (createContactsView). Render-only, deterministic: no clocks,
 * no Math.random. Player units (side !== 'attacker') are never hidden.
 */
import { cellToWorld } from '../camera.js';
import { insideWindow } from './fogModel.js';

export const CONTACT = Object.freeze({
  size: 0.9,        // reticle diameter, cells — one size for every unit type
  fadeOut: 0.25,    // s for the reticle to fade once the unit is in the play area
  growIn: 0.25,     // s for the model to grow back to full scale
  minScale: 0.4,    // the model's scale when it first appears
  y: 0.05,          // reticle height (just above the ground)
});

/**
 * createContacts() → { update(state, views, rect, dt) → { views, hidden, reticles }, clear() }
 *   views    — the unit views to draw (hidden ones removed; units just revealed scaled in)
 *   hidden   — Set of unit ids drawn as reticles this frame
 *   reticles — [{ id, x, z, alpha, phase }]
 */
export function createContacts() {
  const mem = new Map();   // id → { ret: reticle alpha 0..1, grow: model scale-in progress 0..1 }
  return {
    update(state, views, rect, dt) {
      const step = Math.max(0, Math.min(0.1, dt || 0));
      const hidden = new Set(), reticles = [];
      const units = state && state.units;
      if (units) for (const u of units.values()) {
        if (!u || u.side !== 'attacker' || !u.pos) continue;
        let m = mem.get(u.id);
        if (u.hp <= 0) { mem.delete(u.id); continue; }
        if (rect && !insideWindow(rect, u.pos)) {
          if (!m) { m = { ret: 1, grow: 0 }; mem.set(u.id, m); }
          m.ret = 1; m.grow = 0;
          hidden.add(u.id);
        } else if (m) {
          m.ret = Math.max(0, m.ret - step / CONTACT.fadeOut);
          m.grow = Math.min(1, m.grow + step / CONTACT.growIn);
          if (m.ret <= 0 && m.grow >= 1) { mem.delete(u.id); continue; }
        } else continue;
        if (m.ret > 0) reticles.push({ id: u.id, x: cellToWorld(u.pos.x), z: cellToWorld(u.pos.y), alpha: m.ret, phase: (u.id * 0.6180339) % 1 * Math.PI * 2 });
      }
      for (const id of [...mem.keys()]) if (!units || !units.has(id)) mem.delete(id);
      let out = views;
      if (views && (hidden.size || mem.size)) {
        out = [];
        for (const v of views) {
          if (hidden.has(v.id)) continue;
          const m = mem.get(v.id);
          if (m && m.grow < 1) {
            const e = 1 - (1 - m.grow) * (1 - m.grow);   // ease-out
            out.push({ ...v, scale: (v.scale || 1) * (CONTACT.minScale + (1 - CONTACT.minScale) * e) });
          } else out.push(v);
        }
      }
      return { views: out, hidden, reticles };
    },
    clear() { mem.clear(); },
  };
}

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec2 iAP;      // alpha, phase
uniform float uSize;
varying vec2 vUv;
varying vec2 vAP;
void main() {
  vUv = uv; vAP = iAP;
  vec3 p = iPos + vec3(position.x * uSize, 0.0, position.y * uSize);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

// the base cannon's reticle (fx/cannonFx.js) — fill + ring + inner ring + cross, pulsing — in hostile red
const FRAG = /* glsl */`
uniform float uT;
varying vec2 vUv;
varying vec2 vAP;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float d = length(p);
  if (d > 1.0) discard;
  float pulse = 0.5 + 0.5 * sin(uT * 5.0 + vAP.y);
  float ring = smoothstep(0.80, 0.86, d) * (1.0 - smoothstep(0.95, 1.0, d));
  float inner = smoothstep(0.38, 0.42, d) * (1.0 - smoothstep(0.46, 0.5, d)) * 0.8;
  float cross = (1.0 - smoothstep(0.02, 0.05, abs(p.x))) + (1.0 - smoothstep(0.02, 0.05, abs(p.y)));
  cross *= step(0.14, d) * (1.0 - step(0.8, d)) * 0.85;
  float fill = 0.12 + 0.10 * pulse;
  float a = max(max(ring, inner), cross) * (0.7 + 0.3 * pulse) + fill;
  gl_FragColor = vec4(1.0, 0.22, 0.16, a * vAP.x);
}`;

/** One instanced quad for every reticle. Drawn over the fog (8) so contacts read in the dark margin, under the ghost (10). */
export function createContactsView(THREE, scene, { cap = 400 } = {}) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const iAP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  for (const a of [iPos, iAP]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iAP', iAP);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSize: { value: CONTACT.size } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false,
    side: THREE.DoubleSide,   // the XY quad is laid flat as XZ, which flips its winding — draw both faces
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'hidden-contacts';
  mesh.renderOrder = 9;
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    /** reticles from createContacts().update; clock = render seconds (for the pulse). Returns the count drawn. */
    sync(reticles, clock) {
      const n = Math.min(cap, reticles ? reticles.length : 0);
      for (let i = 0; i < n; i++) {
        const r = reticles[i];
        iPos.setXYZ(i, r.x, CONTACT.y, r.z); iAP.setXY(i, r.alpha, r.phase);
      }
      geo.instanceCount = n;
      iPos.needsUpdate = true; iAP.needsUpdate = true;
      mat.uniforms.uT.value = clock || 0;
      mesh.visible = n > 0;
      return n;
    },
    dispose() { scene.remove(mesh); geo.dispose(); quad.dispose(); mat.dispose(); },
  };
}
