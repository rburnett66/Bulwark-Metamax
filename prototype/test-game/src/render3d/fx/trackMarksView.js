/**
 * src/render3d/fx/trackMarksView.js — draws the track marks (trackMarks.js) as ONE InstancedMesh [MM-task_mvj0wz2d_1].
 *
 * Each mark is a flat quad on the ground, a few hundredths above it with polygon offset so it never fights the ground,
 * drawn in the transparent pass (after the ground and the opaque units; depth-tested, no depth write). The shader
 * fades it by the planner's alpha, softens its long edges, and gives treads cross-bands in WORLD space so the bands
 * run continuously from one stamp to the next while wheel lines stay plain.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
const VERT = `
attribute float aAlpha;
attribute float aTread;
varying float vAlpha;
varying float vTread;
varying float vBand;
varying float vSide;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 dir = normalize((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vBand = dot(w.xz, dir.xz);          // distance along the trail, in world units
  vSide = position.z * 2.0;           // -1 .. 1 across the mark
  vAlpha = aAlpha; vTread = aTread;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform vec3 uColor;
varying float vAlpha;
varying float vTread;
varying float vBand;
varying float vSide;
void main() {
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float band = mix(1.0, 0.45 + 0.55 * step(0.42, fract(vBand * 9.0)), vTread);
  float a = vAlpha * edge * band;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export function createTrackMarksView(THREE, scene, { cap = 2400, color = 0x3a2e22 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);                                   // flat: local x = along the trail, local z = across
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  const tread = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  alpha.setUsage(THREE.DynamicDrawUsage); tread.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAlpha', alpha); geo.setAttribute('aTread', tread);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { uColor: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'track-marks'; mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    /** list: trackMarks.instances(). Returns how many marks are drawn. */
    sync(list) {
      const n = Math.min(cap, list ? list.length : 0);
      for (let i = 0; i < n; i++) {
        const m = list[i];
        Q.setFromAxisAngle(UP, -m.a);                          // heading a: forward (cos a, sin a) in x / z
        M.compose(P.set(m.x, 0.012, m.z), Q, S.set(m.len, 1, m.w));
        mesh.setMatrixAt(i, M);
        alpha.array[i] = m.alpha; tread.array[i] = m.kind === 'tread' ? 1 : 0;
      }
      mesh.count = n; mesh.visible = n > 0;
      if (n) { mesh.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true; tread.needsUpdate = true; }
      return n;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
