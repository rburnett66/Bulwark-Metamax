/**
 * src/render3d/overlays/pathLines.js — draws the expected-path lines (code design §4.12; plan v2.2.2 §6.7).
 * T3b [MM-story_mv79mi1o_d]. The WHAT and WHEN live in pathLinesModel.js (pure, tested); this is the HOW.
 *
 * ONE mesh for every live line: a ribbon per route (half-width 0.16 cells, offset sideways by wave so lines
 * that share a corridor separate), lying just above the ground (Y 0.05), depth-tested against plateaus and
 * rocks but not writing depth. The shader draws moving chevrons whose tips point toward the base, a soft edge,
 * and the draw-in (`aProg`) / fade (`aAlpha`). The geometry is rebuilt only when lines appear, disappear or
 * re-route; every other frame only two attributes move.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { waveHsl } from './pathLinesModel.js';

const HALF_WIDTH = 0.16;
const LANE_OFFSET = 0.13;   // cells sideways per wave slot (3 slots: -1, 0, +1)
const Y = 0.05;

const VERT = `attribute float aDist; attribute float aAcross; attribute vec3 aColor; attribute float aAlpha; attribute float aProg;
  varying float vDist; varying float vAcross; varying vec3 vColor; varying float vAlpha; varying float vProg;
  void main() { vDist = aDist; vAcross = aAcross; vColor = aColor; vAlpha = aAlpha; vProg = aProg;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform float time; varying float vDist; varying float vAcross; varying vec3 vColor; varying float vAlpha; varying float vProg;
  void main() {
    if (vDist > vProg) discard;
    float f = fract((vDist - time * 1.6) / 0.9);
    float v = fract(f + abs(vAcross) * 0.32);                 // chevron tips lead toward the base
    float chev = smoothstep(0.0, 0.05, v) * (1.0 - smoothstep(0.22, 0.28, v));
    float edge = 1.0 - smoothstep(0.75, 1.0, abs(vAcross));
    gl_FragColor = vec4(mix(vColor, vec3(1.0), chev * 0.35), (0.22 + 0.68 * chev) * edge * vAlpha);
  }`;

export function createPathLinesView(THREE, scene) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { time: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = 'path-lines';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1.5;
  scene.add(mesh);
  const color = new THREE.Color();
  const slots = new Map();   // key -> { start, count }

  function rebuild(lines) {
    const pos = [], dist = [], across = [], col = [], alpha = [], prog = [], idx = [];
    slots.clear();
    let base = 0;
    for (const L of lines.values()) {
      if (!L.pts || L.pts.length < 2) continue;
      const { h, s, l } = waveHsl(L.wave);
      color.setHSL(h / 360, s, l);
      const off = (((L.wave - 1) % 3) - 1) * LANE_OFFSET;
      const P = L.pts.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
      let d = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
        if (i > 0) d += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
        for (const side of [-1, 1]) {
          pos.push(P[i].x + nx * (off + side * HALF_WIDTH), Y, P[i].y + ny * (off + side * HALF_WIDTH));
          dist.push(d); across.push(side); col.push(color.r, color.g, color.b);
          alpha.push(L.alpha); prog.push(L.prog * L.len);
        }
        if (i > 0) { const k = base + (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      slots.set(L.key, { start: base, count: P.length * 2 });
      base += P.length * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    const aA = new THREE.Float32BufferAttribute(alpha, 1); aA.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aAlpha', aA);
    const aP = new THREE.Float32BufferAttribute(prog, 1); aP.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aProg', aP);
    g.setIndex(idx);
    mesh.geometry.dispose();
    mesh.geometry = g;
  }

  function refresh(lines) {
    const g = mesh.geometry, aA = g.getAttribute('aAlpha'), aP = g.getAttribute('aProg');
    if (!aA) return;
    for (const L of lines.values()) {
      const sl = slots.get(L.key);
      if (!sl) continue;
      for (let k = 0; k < sl.count; k++) { aA.array[sl.start + k] = L.alpha; aP.array[sl.start + k] = L.prog * L.len; }
    }
    aA.needsUpdate = aP.needsUpdate = true;
  }

  return {
    mesh,
    /** Push this frame's line state. `time` drives the chevron scroll (seconds). */
    sync(lines, geometryDirty, time) {
      if (geometryDirty) rebuild(lines); else refresh(lines);
      material.uniforms.time.value = time;
      mesh.visible = slots.size > 0;
      return slots.size;
    },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); material.dispose(); },
  };
}
