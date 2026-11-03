// tugs.js — small tug ships drifting around a capital ship, to sell its scale.
//
//   const tugs = createTugs(THREE, tugGltf.scene, shipRoot, { count: 7, color: [r,g,b] });
//   tugs.update(dt);            // every frame
//   tugs.group.visible = on;    // show or hide
//
// Cost: THREE draw calls for any number of tugs — one InstancedMesh for every tug body, one for every tug's
// lit glass and beacon, and one Points cloud for every tug engine glow. Tugs fly slow ellipses at different
// radii, heights, speeds and directions around the ship's hull (never through it), bank into the turn, and
// burn the capital ship's faction colour. Deterministic: a seed fixes the traffic pattern.

const GLOW_VS = `
attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uScale;
varying float vSeed;
void main() {
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float flick = 1.0 + 0.12 * sin(uTime * 19.0 + aSeed * 11.0);
  gl_PointSize = aSize * flick * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = `
uniform vec3 uColor;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 2.0);
  vec3 col = mix(uColor, vec3(1.0), pow(1.0 - d, 6.0));
  gl_FragColor = vec4(col, a);
}`;

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createTugs(THREE, tugScene, shipRoot, { count = 7, color = [0.6, 0.8, 1.0], seed = 7 } = {}) {
  tugScene.updateMatrixWorld(true);
  // the tug's two meshes, baked into tug space, and its engine nozzles
  let bodyGeo = null, glowGeo = null, bodyMat = null, glowMat = null;
  const nozzles = [];
  tugScene.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (o.material.name === 'ship_glow') { glowGeo = g; glowMat = o.material; } else { bodyGeo = g; bodyMat = o.material; }
    } else if (/^engine_\d+$/.test(o.name)) {
      nozzles.push({ p: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), r: (o.userData && o.userData.radius) || 0.06 });
    }
  });

  const group = new THREE.Group();
  group.name = 'tugs';
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const lights = glowGeo ? new THREE.InstancedMesh(glowGeo, glowMat, count) : null;
  for (const m of [bodies, lights]) if (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; group.add(m); }

  const nN = nozzles.length;
  const pos = new Float32Array(count * nN * 3), size = new Float32Array(count * nN), seeds = new Float32Array(count * nN);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 800 }, uColor: { value: new THREE.Color(...color) } };
  const glows = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  glows.frustumCulled = false;
  group.add(glows);

  // flight paths around the hull, in the ship's own space (glTF: +X bow, +Y up, Z across)
  shipRoot.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(shipRoot.matrixWorld).invert();
  const box = new THREE.Box3();
  shipRoot.traverse((o) => { if (o.isMesh && o.parent !== group && !o.isInstancedMesh && !o.isPoints && o.geometry) {
    const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv); box.union(b); } });
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const rnd = mulberry(seed);
  const tugs = [];
  for (let i = 0; i < count; i++) {
    const near = i % 3 === 0;                             // every third tug works close to the hull
    const a = s.x / 2 + (near ? 1.2 : 2.5) + rnd() * (near ? 1 : 5);
    const b = s.z / 2 + (near ? 1.0 : 2.0) + rnd() * (near ? 1 : 4);
    const y = c.y + (rnd() * 2 - 1) * s.y * (near ? 0.45 : 0.9);
    const speed = (near ? 0.35 : 0.6) + rnd() * 0.5;      // world units per second along the path: slow
    tugs.push({ a, b, y, speed, dir: rnd() < 0.5 ? -1 : 1, t: rnd() * Math.PI * 2,
      bob: rnd() * 6.28, tilt: (rnd() * 2 - 1) * 0.12 });
    for (let k = 0; k < nN; k++) { size[i * nN + k] = nozzles[k].r * 9; seeds[i * nN + k] = i * 3.1 + k; }
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(),
    tan = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), np = new THREE.Vector3();
  function place(dt) {
    tugs.forEach((g, i) => {
      const per = Math.PI * (3 * (g.a + g.b) - Math.sqrt((3 * g.a + g.b) * (g.a + 3 * g.b)));  // ellipse length
      g.t += g.dir * (g.speed / per) * Math.PI * 2 * dt;
      g.bob += dt * 0.6;
      p.set(c.x + Math.cos(g.t) * g.a, g.y + Math.sin(g.bob) * 0.15, c.z + Math.sin(g.t) * g.b);
      tan.set(-Math.sin(g.t) * g.a * g.dir, 0, Math.cos(g.t) * g.b * g.dir).normalize();
      const yaw = Math.atan2(-tan.z, tan.x);              // tug's +X (its bow) along the direction of travel
      e.set(g.tilt + 0.18 * g.dir, yaw, 0, 'YXZ');        // bank into the turn
      q.setFromEuler(e);
      m.compose(p, q, one);
      bodies.setMatrixAt(i, m);
      if (lights) lights.setMatrixAt(i, m);
      for (let k = 0; k < nN; k++) {
        np.copy(nozzles[k].p).add(new THREE.Vector3(-0.04, 0, 0)).applyMatrix4(m);
        pos.set([np.x, np.y, np.z], (i * nN + k) * 3);
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    if (lights) lights.instanceMatrix.needsUpdate = true;
    pg.attributes.position.needsUpdate = true;
  }
  place(0);
  shipRoot.add(group);

  return {
    group,
    update(dt, viewportHeight) {
      uniforms.uTime.value += dt;
      if (viewportHeight) uniforms.uScale.value = viewportHeight * 0.9;
      place(dt);
    },
    dispose() { bodyGeo.dispose(); glowGeo && glowGeo.dispose(); pg.dispose(); glows.material.dispose(); shipRoot.remove(group); },
  };
}
