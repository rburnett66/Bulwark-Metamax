/**
 * src/render3d/fx/combatFx.js — draws combatFxModel's shots and flashes (plan v2.2 §6.4) [MM-task_mv9s9mza_2].
 *
 * ONE draw call: an instanced camera-facing quad, additive, sampling ONE glow texture (glowTexture.js). A flash
 * is a round glow; a shot is the same glow stretched into a streak along its on-screen flight direction, bright
 * at the head and fading to the tail — the vertex shader does the facing, so a streak reads correctly from any
 * camera angle. No post-processing: the glow is in the texture, so it reads with bloom off.
 *
 * Depth-tested against the scene (a round behind a plateau is hidden) but never writes depth, so effects don't
 * cut each other; each quad is pulled half its size toward the camera so a blast at ground level stays round. THREE is passed in (no import) — see index.js.
 */
import { glowPixels, GLOW_SIZE } from './glowTexture.js';

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec3 iDir;     // world-space streak vector (head → tail = -iDir); zero for a round flash
attribute vec2 iSize;    // x = glow width (cells), y = streak length (cells)
attribute vec4 iColor;   // rgb + alpha
varying vec2 vUv;
varying vec4 vColor;
varying float vHead;     // the round head's share of the quad's length (1 for a flash)
void main() {
  vec4 head = modelViewMatrix * vec4(iPos, 1.0);
  vec3 d = (modelViewMatrix * vec4(iDir * iSize.y, 0.0)).xyz;
  float L = length(d.xy);
  vec2 ax = L > 1e-4 ? d.xy / L : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  // quad spans the tail..head segment plus half a glow width at each end
  vec4 c = head;
  c.xyz -= d * 0.5;
  c.xy += ax * position.x * (L + iSize.x) + ay * position.y * iSize.x;
  c.z += iSize.x * 0.5;   // pull toward the camera by half its size: a big blast near the ground isn't sliced by it
  gl_Position = projectionMatrix * c;
  vUv = uv;
  vColor = iColor;
  vHead = iSize.x / (L + iSize.x);
}`;

const FRAG = /* glsl */`
uniform sampler2D glow;
varying vec2 vUv;
varying vec4 vColor;
varying float vHead;
void main() {
  // the round head: the glow over the last vHead of the quad (the whole quad for a flash)
  float g = texture2D(glow, vec2(clamp(1.0 + (vUv.x - 1.0) / vHead, 0.0, 1.0), vUv.y)).a;
  // the streak: the glow's cross-section, fading from the head back to the tail
  if (vHead < 0.999) {
    g = max(g, 0.85 * texture2D(glow, vec2(0.5, vUv.y)).a * smoothstep(0.0, 1.0 - vHead * 0.5, vUv.x));
    g = min(1.0, g * 1.7);   // a round is small: a hot core so it reads over bright ground (additive washes out)
  }
  gl_FragColor = vec4(vColor.rgb * g * vColor.a, 1.0);
}`;

export function createCombatFxView(THREE, scene, capacity = 600) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const dir = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  for (const a of [pos, dir, size, col]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', pos);
  geo.setAttribute('iDir', dir);
  geo.setAttribute('iSize', size);
  geo.setAttribute('iColor', col);
  geo.instanceCount = 0;

  const tex = new THREE.DataTexture(glowPixels(GLOW_SIZE), GLOW_SIZE, GLOW_SIZE, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: { glow: { value: tex } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;   // instances are everywhere; the bounding box of one quad means nothing
  mesh.renderOrder = 5;
  scene.add(mesh);

  const c = new THREE.Color();
  return {
    mesh,
    /** true when rocket rounds are drawn as models (fx/rocketShots.js) instead of glow streaks. */
    skipRockets: false,
    /** true when flak rounds are drawn as black balls (fx/flakShots.js) and missiles as half-size rockets [MM-task_mvfqb2gm_4] [MM-task_mvfqb454_5]. */
    skipFlak: false,
    skipMissiles: false,
    /** Copy the model's live shots + flashes into the instance buffers. Returns the instance count. */
    sync(model) {
      let n = 0;
      const P = pos.array, D = dir.array, S = size.array, C = col.array;
      for (const s of model.shots) {
        if (n >= capacity) break;
        if (this.skipRockets && s.kind === 'rocket') continue;   // drawn as 3D rockets (fx/rocketShots.js) [MM-task_mvf0kzw4_l]
        if (this.skipFlak && s.kind === 'flak') continue;        // drawn as black balls (fx/flakShots.js)
        if (this.skipMissiles && s.kind === 'missile') continue; // drawn as half-size rockets (fx/rocketShots.js)
        P[n * 3] = s.x; P[n * 3 + 1] = s.y; P[n * 3 + 2] = s.z;
        D[n * 3] = s.dx; D[n * 3 + 1] = s.dy; D[n * 3 + 2] = s.dz;
        S[n * 2] = s.size; S[n * 2 + 1] = s.len;
        c.setHex(s.color);
        C[n * 4] = c.r; C[n * 4 + 1] = c.g; C[n * 4 + 2] = c.b; C[n * 4 + 3] = 1;
        n++;
      }
      for (const f of model.flashes) {
        if (n >= capacity) break;
        P[n * 3] = f.x; P[n * 3 + 1] = f.y; P[n * 3 + 2] = f.z;
        D[n * 3] = 0; D[n * 3 + 1] = 0; D[n * 3 + 2] = 0;
        S[n * 2] = f.size; S[n * 2 + 1] = 0;
        c.setHex(f.color);
        C[n * 4] = c.r; C[n * 4 + 1] = c.g; C[n * 4 + 2] = c.b; C[n * 4 + 3] = f.alpha;
        n++;
      }
      geo.instanceCount = n;
      if (n) for (const a of [pos, dir, size, col]) { a.updateRange.offset = 0; a.updateRange.count = n * a.itemSize; a.needsUpdate = true; }
      mesh.visible = n > 0;
      return n;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose(); quad.dispose(); mat.dispose(); tex.dispose();
    },
  };
}
