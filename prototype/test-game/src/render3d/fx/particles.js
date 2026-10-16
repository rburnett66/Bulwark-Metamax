/**
 * src/render3d/fx/particles.js — the instanced batches the world-impact effects draw through (code design §4.11b
 * PBatch / DBatch; plan v2.2 §6.10) [MM-story_mv87jvnb_5].
 *
 *   createPBatch — camera-facing particle quads, ONE draw call per batch. Each quad is stretched along its
 *                  view-space velocity, so a fast spark reads as a streak; a still one is round. The round
 *                  profile is the shared glow texture (glowTexture.js), tinted per instance. Additive (sparks,
 *                  fire, embers) or alpha-blended (smoke, dust).
 *   createDBatch — flat quads lying on the ground: scorch marks (blotchy dark disc), shock rings, light pools.
 *
 * Both: fixed capacity, begin() / push(...) / end(), never write depth, frustumCulled off (instances are
 * everywhere), hidden when empty so an idle batch costs no draw call. THREE is passed in (no import).
 */
import { glowPixels, GLOW_SIZE } from './glowTexture.js';

const PVERT = /* glsl */`
attribute vec3 iPos; attribute vec3 iVel; attribute vec2 iSize; attribute vec4 iCol;
varying vec2 vQ; varying vec4 vCol;
void main() {
  vec4 c = modelViewMatrix * vec4(iPos, 1.0);
  vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
  float sp = length(vv.xy);
  vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
  vec2 nrm = vec2(dir.y, -dir.x);          // keeps the quad counter-clockwise (front-facing)
  vec2 q = position.xy;                    // -1..1
  float along = iSize.x + iSize.y;         // width + stretch (streak length)
  c.xy += nrm * q.x * iSize.x + dir * q.y * along;
  vQ = q; vCol = iCol;
  gl_Position = projectionMatrix * c;
}`;

const PFRAG = /* glsl */`
uniform float uAdd; uniform sampler2D glow;
varying vec2 vQ; varying vec4 vCol;
void main() {
  float a = min(1.0, texture2D(glow, vQ * 0.5 + 0.5).a * 1.25) * vCol.a;
  if (a < 0.004) discard;
  if (uAdd > 0.5) gl_FragColor = vec4(vCol.rgb * a, 1.0);
  else gl_FragColor = vec4(vCol.rgb, a * 0.85);
}`;

const DVERT = /* glsl */`
attribute vec3 iPos; attribute vec4 iSize; attribute vec4 iCol;   // iSize: radius, rotation, kind, seed
varying vec2 vQ; varying vec4 vCol; varying vec2 vK;
void main() {
  float c = cos(iSize.y), s = sin(iSize.y);
  vec2 q = position.xy;
  vec2 r = vec2(q.x * c - q.y * s, q.x * s + q.y * c) * iSize.x;
  vec4 w = vec4(iPos.x + r.x, iPos.y, iPos.z + r.y, 1.0);
  vQ = q; vCol = iCol; vK = iSize.zw;
  gl_Position = projectionMatrix * modelViewMatrix * w;
}`;

const DFRAG = /* glsl */`
uniform float uAdd; varying vec2 vQ; varying vec4 vCol; varying vec2 vK;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  float a;
  if (vK.x < 0.5) {                        // scorch: blotchy, wavy-edged dark disc
    float ang = atan(vQ.y, vQ.x);
    float edge = 0.72 + 0.22 * sin(ang * 5.0 + vK.y * 6.0) + 0.08 * sin(ang * 13.0 + vK.y * 3.0);
    float n = h(floor(vQ * 9.0) + vK.y);
    a = (1.0 - smoothstep(edge - 0.25, edge, r)) * (0.75 + 0.25 * n);
  } else if (vK.x < 1.5) {                 // shock ring
    a = smoothstep(0.72, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
  } else {                                 // light pool
    a = (1.0 - r) * (1.0 - r);
  }
  a *= vCol.a;
  if (uAdd > 0.5) gl_FragColor = vec4(vCol.rgb * a, 1.0);
  else gl_FragColor = vec4(vCol.rgb, a);
}`;

const QUAD = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];

function makeBatch(THREE, scene, cap, attrs, index, material, renderOrder) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUAD), 3));
  g.setIndex(index);
  const a = {};
  for (const [name, size] of attrs) {
    const at = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
    at.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, at);
    a[name] = at;
  }
  g.instanceCount = 0;
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.visible = false;
  scene.add(mesh);
  let n = 0;
  return {
    mesh, geo: g, cap, a,
    get n() { return n; },
    begin() { n = 0; },
    /** Reserve the next instance slot; -1 when full. */
    slot() { return n < cap ? n++ : -1; },
    end() {
      g.instanceCount = n;
      for (const at of Object.values(a)) { at.updateRange.offset = 0; at.updateRange.count = n * at.itemSize; at.needsUpdate = true; }
      mesh.visible = n > 0;
      return n;
    },
    dispose() { scene.remove(mesh); g.dispose(); material.dispose(); },
  };
}

let glowTex = null;
function glowTexture(THREE) {
  if (!glowTex) {
    glowTex = new THREE.DataTexture(glowPixels(GLOW_SIZE), GLOW_SIZE, GLOW_SIZE, THREE.RGBAFormat);
    glowTex.magFilter = THREE.LinearFilter; glowTex.minFilter = THREE.LinearFilter;
    glowTex.needsUpdate = true;
  }
  return glowTex;
}

/** Particle batch. push(x, y, z, vx, vy, vz, width, stretch, r, g, b, a). */
export function createPBatch(THREE, scene, cap, additive, renderOrder) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uAdd: { value: additive ? 1 : 0 }, glow: { value: glowTexture(THREE) } },
    vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, depthTest: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const b = makeBatch(THREE, scene, cap, [['iPos', 3], ['iVel', 3], ['iSize', 2], ['iCol', 4]], [0, 1, 2, 0, 2, 3], mat, renderOrder);
  const P = b.a.iPos.array, V = b.a.iVel.array, S = b.a.iSize.array, C = b.a.iCol.array;
  b.push = (x, y, z, vx, vy, vz, w, len, r, g, bl, al) => {
    const i = b.slot();
    if (i < 0) return false;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    S[i * 2] = w; S[i * 2 + 1] = len;
    C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = bl; C[i * 4 + 3] = al;
    return true;
  };
  return b;
}

/** Ground decal batch. push(x, y, z, radius, rotation, kind, seed, r, g, b, a). */
export function createDBatch(THREE, scene, cap, additive, renderOrder) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uAdd: { value: additive ? 1 : 0 } },
    vertexShader: DVERT, fragmentShader: DFRAG, transparent: true, depthWrite: false, depthTest: true,
    side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const b = makeBatch(THREE, scene, cap, [['iPos', 3], ['iSize', 4], ['iCol', 4]], [0, 2, 1, 0, 3, 2], mat, renderOrder);
  const P = b.a.iPos.array, S = b.a.iSize.array, C = b.a.iCol.array;
  b.push = (x, y, z, rad, rot, kind, seed, r, g, bl, al) => {
    const i = b.slot();
    if (i < 0) return false;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    S[i * 4] = rad; S[i * 4 + 1] = rot; S[i * 4 + 2] = kind; S[i * 4 + 3] = seed;
    C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = bl; C[i * 4 + 3] = al;
    return true;
  };
  return b;
}
