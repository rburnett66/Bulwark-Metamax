/**
 * src/render3d/fx/wakesView.js — draws the water-unit wakes (wakes.js) as ONE InstancedMesh [MM-task_mvj9o97b_7].
 *
 * Each ripple is a flat quad just above the water (polygon offset, transparent pass, no depth write) shaded as a soft
 * foam ring: an arm ripple is mostly rim (a spreading ring), the stern patch a filled soft disc.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
const VERT = `
attribute float aAlpha;
attribute float aPatch;
varying vec2 vUv;
varying float vAlpha;
varying float vPatch;
void main() {
  vUv = uv * 2.0 - 1.0; vAlpha = aAlpha; vPatch = aPatch;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform vec3 uColor;
varying vec2 vUv;
varying float vAlpha;
varying float vPatch;
void main() {
  float r = length(vUv);
  float disc = 1.0 - smoothstep(0.72, 1.0, r);
  float rim = mix(0.35 + 0.65 * smoothstep(0.2, 0.85, r), 1.0, vPatch);   // arms: a soft foam ring; the patch: a filled disc
  float a = vAlpha * disc * rim;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export function createWakesView(THREE, scene, { cap = 900, color = 0xeef6ff } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  const patch = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  alpha.setUsage(THREE.DynamicDrawUsage); patch.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAlpha', alpha); geo.setAttribute('aPatch', patch);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { uColor: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'water-wakes'; mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 2;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const M = new THREE.Matrix4();
  return {
    mesh,
    /** list: wakes.instances(). Returns how many ripples are drawn. */
    sync(list) {
      const n = Math.min(cap, list ? list.length : 0);
      for (let i = 0; i < n; i++) {
        const r = list[i];
        M.makeScale(r.size, 1, r.size).setPosition(r.x, 0.018, r.z);
        mesh.setMatrixAt(i, M);
        alpha.array[i] = r.alpha; patch.array[i] = r.kind === 'patch' ? 1 : 0;
      }
      mesh.count = n; mesh.visible = n > 0;
      if (n) { mesh.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true; patch.needsUpdate = true; }
      return n;
    },
    /** Tint the foam (e.g. a planet's foam colour). */
    setColor(hex) { mat.uniforms.uColor.value.set(hex); },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
