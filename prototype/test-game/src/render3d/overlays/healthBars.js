/**
 * src/render3d/overlays/healthBars.js — health bars in the battle view. [MM-task_mvbry87f_q]
 *
 * Owner 2026-10-16: "health bars on units", "the base also needs a health bar if it gets attacked", "damaged
 * towers also need health bars" — "we are now adding AAA polish so the effects should be carefully choreographed".
 *
 * Who gets one: a UNIT as soon as it has taken damage (attackers and defenders alike), a TOWER / wall while it is
 * below full health, the BASE once it has been hit (a wider bar over the landing craft that stays for the match).
 * How it moves:
 *   - it fades + grows in over 0.15 s when the first hit lands (never pops), and fades out when the owner is healed
 *     back to full or dies;
 *   - the fill eases to the new value fast (0.08 s), while a pale DAMAGE CHUNK — the health just lost — holds for
 *     0.35 s and then drains, so every hit reads as a bite out of the bar;
 *   - each hit flashes the bar white for a moment and gives it a small vertical kick;
 *   - lime green on a charcoal-grey track (owner 2026-10-18; was a green → amber → red ramp); quarter ticks show
 *     scale; a dark rim keeps it legible on any ground.
 * planBars is pure (state + unit views + memory → bar list); createHealthBarView draws all of them in ONE
 * camera-facing instanced draw.
 */
import { cellToWorld } from '../camera.js';

/** Owner 2026-10-18: "health bars should lime green against charcoal grey" [MM-task_mvempq5t_p]. RGB 0..1. */
export const BAR_COLORS = Object.freeze({
  fill: [0.55, 0.95, 0.18],     // lime green — the health left, at every fraction
  track: [0.2, 0.21, 0.23],     // charcoal grey — the health gone
  rim: [0.08, 0.085, 0.095],    // dark charcoal frame
  chunk: [1.0, 0.96, 0.82],     // the bite just taken (drains away)
});
const glv = (c) => 'vec3(' + c.map((v) => v.toFixed(3)).join(', ') + ')';

export const BARS = Object.freeze({
  unitW: 0.62, unitH: 0.075, structW: 0.8, structH: 0.085, baseW: 2.4, baseH: 0.14,
  fadeIn: 0.15, fadeOut: 0.35, ease: 0.08, chunkHold: 0.35, chunkDrain: 0.55, flash: 0.12,
});

/**
 * Advance the bar memory and return this frame's bars.
 * views: buildUnitViews() list (x, y, z, scale, id); mem: Map persisted by the caller; dt seconds.
 * → [{ id, x, y, z, w, h, frac, chunk, alpha, flash, kind }]
 */
export function planBars(state, views, mem, dt, opts = {}) {
  const out = [];
  if (!state) return out;
  const seen = new Set();
  const step = (key, hp, max, live, place) => {
    let m = mem.get(key);
    const frac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1;
    if (!m) { m = { frac, shown: frac, chunk: frac, hold: 0, alpha: 0, flash: 0, kick: 0, hit: false, base: frac }; mem.set(key, m); }
    seen.add(key);
    if (frac < m.frac - 1e-6) { m.hold = BARS.chunkHold; m.flash = BARS.flash; m.kick = 1; m.hit = true; m.chunk = Math.max(m.chunk, m.shown); }
    m.frac = frac;
    m.shown += (frac - m.shown) * Math.min(1, dt / BARS.ease);
    if (m.hold > 0) m.hold -= dt; else m.chunk = Math.max(m.shown, m.chunk - dt / BARS.chunkDrain);
    if (m.chunk < m.shown) m.chunk = m.shown;
    m.flash = Math.max(0, m.flash - dt); m.kick = Math.max(0, m.kick - dt * 6);
    const want = live && m.hit && (frac < 0.999 || m.chunk > m.shown + 0.002 || key === 'base') ? 1 : 0;   // the base keeps its bar once hit
    m.alpha += Math.sign(want - m.alpha) * Math.min(Math.abs(want - m.alpha), dt / (want ? BARS.fadeIn : BARS.fadeOut));
    if (m.alpha <= 0.001) return;
    const p = place();
    out.push({ id: key, x: p.x, y: p.y + m.kick * 0.04, z: p.z, w: p.w * (0.85 + 0.15 * m.alpha), h: p.h, frac: m.shown, chunk: m.chunk, alpha: m.alpha, flash: m.flash / BARS.flash, kind: p.kind });
  };
  // units — at their drawn position, above the hull (scaled with the model)
  if (views) for (const v of views) {
    const u = state.units && state.units.get(v.id);
    if (!u) continue;
    const k = v.scale || 1;
    step('u' + v.id, u.hp, u.maxHp, u.hp > 0, () => ({ x: v.x, y: (v.y || 0) + 0.42 + 0.28 * k, z: v.z, w: BARS.unitW * Math.min(1.4, Math.max(0.8, k)), h: BARS.unitH, kind: 0 }));
  }
  // towers / walls — while damaged
  if (state.structures) for (const s of state.structures.values()) {
    if (!s.pos || !(s.maxHp > 1)) continue;
    const fp = s.footprint || { w: 1, h: 1 };
    step('s' + s.id, s.hp, s.maxHp, s.hp > 0 && s.lifecycle !== 'Destroyed', () => ({ x: s.pos.x + fp.w / 2, y: s.kind === 'wall' ? 0.95 : 1.15, z: s.pos.y + fp.h / 2, w: BARS.structW * fp.w, h: BARS.structH, kind: 1 }));
  }
  // the base — once it has been hit it keeps its bar for the match
  const b = state.base, mb = opts.baseCell;
  if (b && mb && b.maxHp > 0) {
    step('base', b.hp, b.maxHp, b.hp > 0, () => ({ x: cellToWorld(mb.x), y: 1.95, z: cellToWorld(mb.y), w: BARS.baseW, h: BARS.baseH, kind: 2 }));
  }
  for (const k of [...mem.keys()]) if (!seen.has(k)) mem.delete(k);
  return out;
}

export function createHealthBarView(THREE, scene, { cap = 700 } = {}) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  const iVal = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);    // frac, chunk, alpha, flash
  const iKind = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  for (const [n, a] of [['iPos', iPos], ['iSize', iSize], ['iVal', iVal], ['iKind', iKind]]) { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); }
  const mat = new THREE.ShaderMaterial({
    vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iVal; attribute float iKind;
      varying vec2 vUv; varying vec4 vVal; varying vec2 vSize; varying float vKind;
      void main() {
        vUv = uv; vVal = iVal; vSize = iSize; vKind = iKind;
        vec4 c = modelViewMatrix * vec4(iPos, 1.0);
        c.xy += position.xy * iSize;            // camera-facing, world-sized
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `varying vec2 vUv; varying vec4 vVal; varying vec2 vSize; varying float vKind;
      void main() {
        vec2 px = vUv * vSize;                                  // position in world units
        float rim = 0.016 + 0.008 * step(1.5, vKind);
        vec2 inner = vec2(rim, rim);
        bool inside = px.x > inner.x && px.x < vSize.x - inner.x && px.y > inner.y && px.y < vSize.y - inner.y;
        vec3 col = ${glv(BAR_COLORS.rim)};                      // rim
        float a = 0.9;
        if (inside) {
          float u = (px.x - inner.x) / (vSize.x - 2.0 * inner.x);
          float f = vVal.x, ch = vVal.y;
          vec3 hp = ${glv(BAR_COLORS.fill)};                  // lime green at every fraction
          float v = (px.y - inner.y) / (vSize.y - 2.0 * inner.y);
          if (u <= f) col = hp * (0.82 + 0.3 * v);              // fill, lit from above
          else if (u <= ch) col = ${glv(BAR_COLORS.chunk)};         // the bite just taken
          else col = ${glv(BAR_COLORS.track)};                     // empty: charcoal grey
          float tick = abs(fract(u * 4.0 + 0.5) - 0.5);           // quarter ticks
          if (tick < 0.012 && u > 0.02 && u < 0.98) col *= 0.55;
          col = mix(col, vec3(1.0), vVal.w * 0.75);               // hit flash
        }
        gl_FragColor = vec4(col, a * vVal.z);
      }`,
    transparent: true, depthWrite: false, depthTest: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.visible = false; mesh.name = 'health-bars';
  scene.add(mesh);
  const mem = new Map();
  return {
    mesh, mem,
    /** Plan + draw this frame. Returns the bar count. */
    update(state, views, dt, opts) {
      const bars = planBars(state, views, mem, Math.max(0, Math.min(0.1, dt || 0)), opts);
      const n = Math.min(cap, bars.length);
      for (let i = 0; i < n; i++) {
        const b = bars[i];
        iPos.setXYZ(i, b.x, b.y, b.z); iSize.setXY(i, b.w, b.h); iVal.setXYZW(i, b.frac, b.chunk, b.alpha, b.flash); iKind.setX(i, b.kind);
      }
      geo.instanceCount = n;
      for (const a of [iPos, iSize, iVal, iKind]) a.needsUpdate = true;
      mesh.visible = n > 0;
      return n;
    },
    clear() { mem.clear(); geo.instanceCount = 0; mesh.visible = false; },
    dispose() { scene.remove(mesh); geo.dispose(); quad.dispose(); mat.dispose(); },
  };
}
