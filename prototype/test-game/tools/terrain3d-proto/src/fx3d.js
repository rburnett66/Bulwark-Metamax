
// ── World-impact effects (CPU particles, GPU-instanced) ────────────────────────────────────────────────
// Everything here is presentation only: it reads hits and deaths, never changes the sim.
//  • additive particles  — sparks (velocity-stretched streaks that bounce on the ground), fire, flash, embers
//  • smoke particles     — alpha-blended, growing, rising, drifting with the wind
//  • ground decals       — scorch marks (dark), shock rings and fire-light pools (additive), lying on Y=0
//  • chunks              — small instanced metal bits with spin, gravity and bounce
//  • wrecks and debris   — the dead unit's own mesh, charred: hull stays and burns; the turret is blown off,
//                          tumbles, lands, burns; a dying jet falls and explodes where it hits the ground
// Draw calls: 4 particle/decal batches + 1 chunk mesh + up to 2 per unit type for wrecks/debris (+ shadows).
const FX = { wind: new THREE.Vector3(0.35, 0, -0.18), G: 11, shake: 0 };
const PVERT = `
  attribute vec3 iPos; attribute vec3 iVel; attribute vec2 iSize; attribute vec4 iCol;
  varying vec2 vQ; varying vec4 vCol;
  void main() {
    vec4 c = viewMatrix * vec4(iPos, 1.0);
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
    vec2 nrm = vec2(dir.y, -dir.x);   // keeps the quad counter-clockwise (front-facing)
    vec2 q = position.xy;                         // -1..1
    float along = iSize.x + iSize.y;              // width + stretch (streak length)
    c.xy += nrm * q.x * iSize.x + dir * q.y * along;
    vQ = q; vCol = iCol;
    gl_Position = projectionMatrix * c;
  }`;
const PFRAG = `
  uniform float uAdd; varying vec2 vQ; varying vec4 vCol;
  void main() {
    float r = length(vQ);
    if (r > 1.0) discard;
    float a = (1.0 - smoothstep(0.15, 1.0, r)) * vCol.a;
    if (uAdd > 0.5) gl_FragColor = vec4(vCol.rgb * a, 1.0);
    else gl_FragColor = vec4(vCol.rgb, a * 0.85);
  }`;
const DVERT = `
  attribute vec3 iPos; attribute vec4 iSize; attribute vec4 iCol;      // iSize: radius, rotation, kind, seed
  varying vec2 vQ; varying vec4 vCol; varying vec2 vK;
  void main() {
    float c = cos(iSize.y), s = sin(iSize.y);
    vec2 q = position.xy;
    vec2 r = vec2(q.x * c - q.y * s, q.x * s + q.y * c) * iSize.x;
    vec4 w = vec4(iPos.x + r.x, iPos.y, iPos.z + r.y, 1.0);
    vQ = q; vCol = iCol; vK = iSize.zw;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const DFRAG = `
  uniform float uAdd; varying vec2 vQ; varying vec4 vCol; varying vec2 vK;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float r = length(vQ);
    if (r > 1.0) discard;
    float a;
    if (vK.x < 0.5) {                               // scorch: blotchy dark disc
      float ang = atan(vQ.y, vQ.x);
      float edge = 0.72 + 0.22 * sin(ang * 5.0 + vK.y * 6.0) + 0.08 * sin(ang * 13.0 + vK.y * 3.0);
      float n = h(floor(vQ * 9.0) + vK.y);
      a = (1.0 - smoothstep(edge - 0.25, edge, r)) * (0.75 + 0.25 * n);
    } else if (vK.x < 1.5) {                        // shock ring
      a = smoothstep(0.72, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
    } else {                                        // light pool
      a = pow(1.0 - r, 2.0);
    }
    a *= vCol.a;
    if (uAdd > 0.5) gl_FragColor = vec4(vCol.rgb * a, 1.0);
    else gl_FragColor = vec4(vCol.rgb, a);
  }`;
class PBatch {
  constructor(cap, add, renderOrder) {
    this.cap = cap; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = mk('iPos', 3); this.aVel = mk('iVel', 3); this.aSize = mk('iSize', 2); this.aCol = mk('iCol', 4); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ uniforms: { uAdd: { value: add ? 1 : 0 } }, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; this.geo = g; scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(x, y, z, vx, vy, vz, w, len, r, g, b, a) {
    if (this.n >= this.cap) return; const i = this.n++;
    this.aPos.array.set([x, y, z], i * 3); this.aVel.array.set([vx, vy, vz], i * 3); this.aSize.array.set([w, len], i * 2); this.aCol.array.set([r, g, b, a], i * 4);
  }
  end() { this.geo.instanceCount = this.n; for (const a of [this.aPos, this.aVel, this.aSize, this.aCol]) { a.needsUpdate = true; a.updateRange.count = this.n * a.itemSize; } }
}
class DBatch {
  constructor(cap, add, renderOrder) {
    this.cap = cap; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
    const mk = (name, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = mk('iPos', 3); this.aSize = mk('iSize', 4); this.aCol = mk('iCol', 4); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ uniforms: { uAdd: { value: add ? 1 : 0 } }, vertexShader: DVERT, fragmentShader: DFRAG, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; this.geo = g; scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(x, y, z, rad, rot, kind, seed, r, g, b, a) {
    if (this.n >= this.cap) return; const i = this.n++;
    this.aPos.array.set([x, y, z], i * 3); this.aSize.array.set([rad, rot, kind, seed], i * 4); this.aCol.array.set([r, g, b, a], i * 4);
  }
  end() { this.geo.instanceCount = this.n; for (const a of [this.aPos, this.aSize, this.aCol]) { a.needsUpdate = true; a.updateRange.count = this.n * a.itemSize; } }
}

// particle kinds
const K_SPARK = 0, K_FIRE = 1, K_FLASH = 2, K_EMBER = 3, K_SMOKE = 4, K_DUST = 5;
function buildFx3D() {
  FX.add = new PBatch(4000, true, 4.2);
  FX.smoke = new PBatch(1500, false, 4.1);
  FX.decDark = new DBatch(300, false, 1.2);
  FX.decAdd = new DBatch(300, true, 1.3);
  FX.p = [];             // particles
  FX.decals = [];        // {x,z,r,r1,rot,kind,seed,t,life,col,a}
  FX.chunks = [];        // {x,y,z,vx,vy,vz,rx,ry,rz,wx,wy,wz,s,t,life,rest}
  FX.wrecks = [];        // {type, x,y,z, yaw, pitch, roll, vx,vy,vz, wx,wy,wz, t, burn, group:'body'|'turret', falling, rest}
  const cg = new THREE.BoxGeometry(1, 1, 1);
  FX.chunkMesh = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0x2c2a2a }), 400);
  FX.chunkMesh.count = 0; FX.chunkMesh.frustumCulled = false; FX.chunkMesh.castShadow = false; scene.add(FX.chunkMesh);
  // wreck / debris meshes: the units' own LOD geometry, charred via instance colour
  FX.wreckMesh = {};
  for (const key of UNIT_TYPES) {
    const T = U3.types[key]; FX.wreckMesh[key] = {};
    for (const [g, L] of Object.entries(T.lod)) {
      const mat = unitMaterial(); mat.customProgramCacheKey = () => 'unit3d-wreck';
      const im = new THREE.InstancedMesh(L.im.geometry, mat, 120); im.count = 0; im.frustumCulled = false;
      for (let i = 0; i < 120; i++) im.setColorAt(i, new THREE.Color(0.3, 0.27, 0.25));
      const sh = new THREE.InstancedMesh(L.im.geometry, unitShadowMaterial(), 120); sh.count = 0; sh.frustumCulled = false; sh.renderOrder = 2;
      sh.instanceMatrix = im.instanceMatrix;
      scene.add(im, sh); FX.wreckMesh[key][g] = { im, sh, piv: L.piv };
    }
  }
}
const rnd = (a, b) => a + Math.random() * (b - a);
function emit(kind, x, y, z, vx, vy, vz, life, size, extra) {
  if (FX.p.length > 5200) return;
  FX.p.push(Object.assign({ kind, x, y, z, vx, vy, vz, t: 0, life, size, bounces: 0 }, extra || {}));
}
function decal(kind, x, z, r, life, col, a, grow) {
  if (FX.decals.length > 280) FX.decals.shift();
  FX.decals.push({ kind, x, z, r, r1: grow || r, rot: Math.random() * 6.28, seed: Math.random() * 10, t: 0, life, col, a });
}
// Sparks: a hit on armour. dir = direction the round was travelling (x, z). Most sparks ricochet back and up
// off the plate; some skate sideways. They bounce on the ground, losing energy, and die out.
function fxHit(x, z, dirx, dirz, y = 0.24, n = 14) {
  const l = Math.hypot(dirx, dirz) || 1; dirx /= l; dirz /= l;
  const ix = x - dirx * 0.14, iz = z - dirz * 0.14;
  for (let i = 0; i < n; i++) {
    const side = Math.random() < 0.3;
    const a = (side ? (Math.random() < 0.5 ? 1 : -1) * rnd(0.9, 1.6) : rnd(-0.8, 0.8));
    const bx = -dirx * Math.cos(a) - (-dirz) * Math.sin(a), bz = -dirz * Math.cos(a) + (-dirx) * Math.sin(a);
    const sp = rnd(2.2, 5.2);
    emit(K_SPARK, ix, y, iz, bx * sp, rnd(0.8, 3.2), bz * sp, rnd(0.5, 1.1), rnd(0.018, 0.03));
  }
  emit(K_FLASH, ix, y, iz, 0, 0, 0, 0.09, 0.32);
  for (let i = 0; i < 2; i++) emit(K_SMOKE, ix, y, iz, rnd(-0.2, 0.2), rnd(0.3, 0.6), rnd(-0.2, 0.2), rnd(0.6, 1.0), 0.12, { grow: 0.35, shade: 0.55 });
}
// A miss on the ground: dirt kicked up, a few sparks, a small scorch.
function fxGround(x, z) {
  for (let i = 0; i < 6; i++) emit(K_DUST, x, 0.05, z, rnd(-0.8, 0.8), rnd(1.2, 2.6), rnd(-0.8, 0.8), rnd(0.5, 0.8), rnd(0.03, 0.05));
  for (let i = 0; i < 4; i++) emit(K_SPARK, x, 0.05, z, rnd(-2, 2), rnd(1, 2.5), rnd(-2, 2), rnd(0.3, 0.6), 0.018);
  emit(K_SMOKE, x, 0.08, z, 0, 0.35, 0, 0.9, 0.15, { grow: 0.45, shade: 0.7, dusty: 1 });
  decal(0, x, z, rnd(0.18, 0.28), 6, [0.08, 0.06, 0.05], 0.55);
}
// Unit destroyed: flash, fireball, sparks, chunks, ground scorch and shock ring; the hull stays as a burning
// wreck; a turret is blown off and tumbles; a jet keeps its momentum and falls, exploding where it lands.
function fxExplode(u) {
  const x = u.x, z = u.y, def = U3.types[u.type] && U3.types[u.type].def;
  if (def && def.hover && U3.mode === '3d') {          // jet: falls first
    FX.wrecks.push({ type: u.type, group: 'body', x, y: 1.1, z, yaw: -u.heading, pitch: 0, roll: 0,
      vx: Math.cos(u.heading) * u.speed * 1.2, vy: 0.4, vz: Math.sin(u.heading) * u.speed * 1.2,
      wx: rnd(-2.5, 2.5), wy: rnd(-0.6, 0.6), wz: rnd(-1.5, -0.6), t: 0, burn: 0, falling: true, rest: false, smokeT: 0 });
    for (let i = 0; i < 10; i++) emit(K_FIRE, x, 1.1, z, rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1), rnd(0.3, 0.5), rnd(0.15, 0.3));
    emit(K_FLASH, x, 1.1, z, 0, 0, 0, 0.18, 0.9);
    return;
  }
  boom(x, z, 1);
  if (U3.mode !== '3d') return;
  // hull wreck (stays, burns)
  FX.wrecks.push({ type: u.type, group: 'body', x, y: 0, z, yaw: -u.heading, pitch: rnd(-0.06, 0.06), roll: rnd(-0.08, 0.08),
    vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, t: 0, burn: rnd(7, 10), falling: false, rest: true, smokeT: 0 });
  // turret blown off
  const T = U3.types[u.type];
  if (T && T.lod.turret) {
    const aim = u.aimedBy ? Math.atan2((u.aimedBy.y + 0.5) - u.y, (u.aimedBy.x + 0.5) - u.x) : u.heading;
    const p = T.lod.turret.piv, c = Math.cos(-u.heading), s = Math.sin(-u.heading);
    const tx = x + (p.x * c + p.z * s) * UNIT_SCALE, tz = z + (-p.x * s + p.z * c) * UNIT_SCALE;
    const ha = Math.random() * 6.28, hs = rnd(0.6, 1.6);
    FX.wrecks.push({ type: u.type, group: 'turret', x: tx, y: p.y * UNIT_SCALE, z: tz, yaw: -aim, pitch: 0, roll: 0,
      vx: Math.cos(ha) * hs, vy: rnd(4.2, 6.0), vz: Math.sin(ha) * hs, wx: rnd(-7, 7), wy: rnd(-5, 5), wz: rnd(-7, 7),
      t: 0, burn: rnd(5, 8), falling: true, rest: false, smokeT: 0, bounces: 0 });
  }
}
function boom(x, z, k) {
  emit(K_FLASH, x, 0.35, z, 0, 0, 0, 0.22, 1.5 * k);
  for (let i = 0; i < 14 * k; i++) emit(K_FIRE, x + rnd(-0.15, 0.15), rnd(0.1, 0.4), z + rnd(-0.15, 0.15), rnd(-1.4, 1.4), rnd(0.6, 2.6), rnd(-1.4, 1.4), rnd(0.35, 0.75), rnd(0.18, 0.38) * k, { grow: 0.6 });
  for (let i = 0; i < 28 * k; i++) { const a = Math.random() * 6.28, sp = rnd(2, 6); emit(K_SPARK, x, 0.3, z, Math.cos(a) * sp, rnd(1.5, 5), Math.sin(a) * sp, rnd(0.6, 1.4), rnd(0.02, 0.035)); }
  for (let i = 0; i < 8 * k; i++) emit(K_SMOKE, x + rnd(-0.2, 0.2), rnd(0.2, 0.5), z + rnd(-0.2, 0.2), rnd(-0.4, 0.4), rnd(0.5, 1.1), rnd(-0.4, 0.4), rnd(1.8, 3.0), rnd(0.2, 0.35), { grow: 1.1, shade: 0.28 });
  for (let i = 0; i < 9 * k; i++) {
    const a = Math.random() * 6.28, sp = rnd(1.2, 3.6);
    FX.chunks.push({ x, y: 0.25, z, vx: Math.cos(a) * sp, vy: rnd(2.5, 5.5), vz: Math.sin(a) * sp, rx: 0, ry: 0, rz: 0,
      wx: rnd(-12, 12), wy: rnd(-12, 12), wz: rnd(-12, 12), s: rnd(0.04, 0.09), t: 0, life: rnd(3, 5), rest: false });
  }
  decal(0, x, z, rnd(0.8, 1.05), 22, [0.05, 0.04, 0.035], 0.82);
  decal(1, x, z, 0.1, 0.45, [1.0, 0.75, 0.45], 0.9, 2.2 * k);
  decal(2, x, z, 1.6 * k, 0.6, [1.0, 0.55, 0.2], 0.9);
  FX.shake = Math.min(0.25, FX.shake + 0.12 * k);
}
function fxBurn(x, y, z, k, dt, w) {
  // continuous emitters for a burning wreck: flames, smoke column, the odd ember; light pool on the ground
  w.smokeT += dt;
  const fireRate = 26 * k, smokeRate = 7 * k;
  for (let n = Math.floor(fireRate * dt + Math.random()); n > 0; n--) emit(K_FIRE, x + rnd(-0.12, 0.12) * k, y + rnd(0.02, 0.15), z + rnd(-0.12, 0.12) * k, rnd(-0.15, 0.15), rnd(0.6, 1.3), rnd(-0.15, 0.15), rnd(0.35, 0.6), rnd(0.1, 0.2) * Math.max(0.6, k), { grow: -0.15 });
  for (let n = Math.floor(smokeRate * dt + Math.random()); n > 0; n--) emit(K_SMOKE, x + rnd(-0.1, 0.1), y + 0.25, z + rnd(-0.1, 0.1), rnd(-0.1, 0.1), rnd(0.5, 0.9), rnd(-0.1, 0.1), rnd(2.4, 3.6), rnd(0.15, 0.22), { grow: 0.9, shade: 0.22 });
  if (Math.random() < dt * 3 * k) emit(K_EMBER, x, y + 0.2, z, rnd(-0.4, 0.4), rnd(1.2, 2.2), rnd(-0.4, 0.4), rnd(1.0, 1.8), 0.012);
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fe = new THREE.Euler(), _fv = new THREE.Vector3(), _fs = new THREE.Vector3(), _fp = new THREE.Matrix4();
function stepFx(dt) {
  const G = FX.G, W = FX.wind;
  // particles
  for (const p of FX.p) {
    p.t += dt;
    if (p.kind === K_SPARK || p.kind === K_DUST) {
      p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01) {                                     // bounce: lose most of the energy, skid
        p.y = 0.01; p.vy = -p.vy * (p.kind === K_DUST ? 0.1 : 0.38); p.vx *= 0.55; p.vz *= 0.55; p.bounces++;
        if (p.bounces > 2 || p.vy < 0.3) { p.vy = 0; if (p.kind === K_DUST) p.t = p.life; }
      }
    } else if (p.kind === K_EMBER) {
      p.vy -= 0.4 * dt; p.x += (p.vx + W.x) * dt; p.y += p.vy * dt; p.z += (p.vz + W.z) * dt;
    } else if (p.kind === K_FIRE) {
      p.vx *= 1 - 2.5 * dt; p.vz *= 1 - 2.5 * dt; p.vy += 0.6 * dt;
      p.x += (p.vx + W.x * 0.3) * dt; p.y += p.vy * dt; p.z += (p.vz + W.z * 0.3) * dt;
    } else if (p.kind === K_SMOKE) {
      p.vx += (W.x - p.vx) * dt * 0.6; p.vz += (W.z - p.vz) * dt * 0.6; p.vy *= 1 - 0.3 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }
  FX.p = FX.p.filter((p) => p.t < p.life);
  // chunks
  for (const c of FX.chunks) {
    c.t += dt; if (c.rest) continue;
    c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
    if (c.y < c.s * 0.5) { c.y = c.s * 0.5; c.vy = -c.vy * 0.3; c.vx *= 0.5; c.vz *= 0.5; c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5;
      if (Math.abs(c.vy) < 0.4) { c.rest = true; c.rx = Math.round(c.rx / 1.5708) * 1.5708; c.rz = Math.round(c.rz / 1.5708) * 1.5708; } }
  }
  FX.chunks = FX.chunks.filter((c) => c.t < c.life);
  // wrecks and debris
  for (const w of FX.wrecks) {
    w.t += dt;
    if (w.falling) {
      w.vy -= G * dt * (w.group === 'body' ? 0.55 : 1); w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
      w.yaw += w.wy * dt; w.pitch += w.wz * dt; w.roll += w.wx * dt;
      if (w.group === 'body') {                                       // falling jet: trailing fire + smoke
        if (Math.random() < dt * 40) emit(K_FIRE, w.x, w.y, w.z, rnd(-0.2, 0.2), 0.3, rnd(-0.2, 0.2), 0.4, rnd(0.12, 0.22));
        if (Math.random() < dt * 18) emit(K_SMOKE, w.x, w.y, w.z, 0, 0.2, 0, 2.2, 0.15, { grow: 0.8, shade: 0.2 });
      } else if (Math.random() < dt * 20) emit(K_SMOKE, w.x, w.y, w.z, 0, 0.1, 0, 1.4, 0.08, { grow: 0.5, shade: 0.25 });
      if (w.y <= 0.02) {
        if (w.group === 'body') {                                     // the jet hits the ground: explode, then burn as a wreck
          w.y = 0; w.falling = false; w.rest = true; w.pitch = rnd(-0.25, -0.1); w.roll = rnd(-0.4, 0.4); w.burn = rnd(7, 10); w.t = 0;
          boom(w.x, w.z, 1.2);
        } else {
          w.y = 0.02; w.vy = -w.vy * 0.28; w.vx *= 0.5; w.vz *= 0.5; w.wx *= 0.4; w.wy *= 0.4; w.wz *= 0.4; w.bounces = (w.bounces || 0) + 1;
          for (let i = 0; i < 6; i++) emit(K_DUST, w.x, 0.05, w.z, rnd(-1, 1), rnd(0.8, 1.8), rnd(-1, 1), 0.6, 0.04);
          for (let i = 0; i < 6; i++) emit(K_SPARK, w.x, 0.05, w.z, rnd(-2.5, 2.5), rnd(0.8, 2.5), rnd(-2.5, 2.5), 0.5, 0.02);
          if (w.bounces >= 2 || Math.abs(w.vy) < 0.6) {                // settles upright-ish or on its side
            w.falling = false; w.rest = true; w.y = 0; w.pitch = Math.round(w.pitch / 1.5708) * 1.5708 * 0 + rnd(-0.3, 0.3); w.roll = Math.random() < 0.35 ? 1.5708 * Math.sign(rnd(-1, 1)) : rnd(-0.3, 0.3);
            decal(0, w.x, w.z, rnd(0.3, 0.45), 14, [0.05, 0.04, 0.035], 0.7); w.t = 0;
          }
        }
      }
    } else if (w.rest && w.t < w.burn) {
      const k = (w.group === 'turret' ? 0.55 : 1) * Math.min(1, (w.burn - w.t) / 2.5);
      fxBurn(w.x, w.group === 'turret' ? 0.12 : 0.22, w.z, k, dt, w);
    }
  }
  FX.wrecks = FX.wrecks.filter((w) => w.falling || w.t < w.burn + 6);     // burnt out wrecks sink away after 6 s
  for (const d of FX.decals) d.t += dt;
  FX.decals = FX.decals.filter((d) => d.t < d.life);
  FX.shake = Math.max(0, FX.shake - dt * 0.6);
}
function drawFx() {
  const A = FX.add, Sm = FX.smoke; A.begin(); Sm.begin();
  for (const p of FX.p) {
    const u = p.t / p.life, f = 1 - u;
    switch (p.kind) {
      case K_SPARK: {   // white-hot → orange → red, streak length from speed
        const sp = Math.hypot(p.vx, p.vy, p.vz), hot = Math.max(0, 1 - u * 1.6);
        A.push(p.x, p.y, p.z, p.vx, p.vy, p.vz, p.size, Math.min(0.22, sp * 0.035), 1, 0.55 + 0.45 * hot, 0.15 + 0.6 * hot * hot, f); break; }
      case K_EMBER: A.push(p.x, p.y, p.z, 0, 0, 0, p.size * (0.7 + 0.6 * Math.random()), 0, 1, 0.5, 0.15, f); break;
      case K_FLASH: A.push(p.x, p.y, p.z, 0, 0, 0, p.size * (0.6 + u), 0, 1, 0.92, 0.7, f * f); break;
      case K_FIRE: {   // yellow core → orange → deep red, shrinking or growing per emitter
        const s = p.size * Math.max(0.15, 1 + (p.grow || 0) * u), fl = 0.85 + 0.3 * Math.random();
        A.push(p.x, p.y, p.z, 0, 0, 0, s, 0, 1, 0.75 - 0.45 * u, 0.3 - 0.28 * u, f * 0.9 * fl); break; }
      case K_SMOKE: {
        const s = p.size * (1 + (p.grow || 0.8) * u * 3), c = p.shade || 0.25, a = Math.min(1, u * 6) * f * (p.dusty ? 0.45 : 0.55);
        Sm.push(p.x, p.y, p.z, 0, 0, 0, s, 0, c * (p.dusty ? 1.5 : 1), c * (p.dusty ? 1.3 : 1), c * (p.dusty ? 1.1 : 1.05), a); break; }
      case K_DUST: Sm.push(p.x, p.y, p.z, 0, 0, 0, p.size * 1.6, 0, 0.45, 0.38, 0.3, f * 0.8); break;
    }
  }
  A.end(); Sm.end();
  const Dd = FX.decDark, Da = FX.decAdd; Dd.begin(); Da.begin();
  for (const d of FX.decals) {
    const u = d.t / d.life;
    if (d.kind === 0) Dd.push(d.x, 0.022, d.z, d.r, d.rot, 0, d.seed, d.col[0], d.col[1], d.col[2], d.a * Math.min(1, (1 - u) * 4));
    else if (d.kind === 1) Da.push(d.x, 0.03, d.z, d.r + (d.r1 - d.r) * Math.sqrt(u), d.rot, 1, d.seed, d.col[0], d.col[1], d.col[2], d.a * (1 - u));
    else Da.push(d.x, 0.035, d.z, d.r, d.rot, 2, d.seed, d.col[0], d.col[1], d.col[2], d.a * (1 - u) * (1 - u));
  }
  // burning wrecks light the ground around them (flickering additive pool)
  for (const w of FX.wrecks) if (w.rest && w.t < w.burn) {
    const k = Math.min(1, (w.burn - w.t) / 2.5) * (w.group === 'turret' ? 0.5 : 1);
    Da.push(w.x, 0.035, w.z, 0.9 * (0.9 + 0.15 * Math.random()) * Math.max(0.5, k), 0, 2, 0, 1.0, 0.45, 0.15, 0.5 * k);
  }
  Dd.end(); Da.end();
  // chunks
  let ci = 0;
  for (const c of FX.chunks) {
    const sink = Math.max(0, c.t - (c.life - 0.8)) / 0.8;
    _fe.set(c.rx, c.ry, c.rz); _fq.setFromEuler(_fe); _fv.set(c.x, c.y - sink * c.s, c.z); _fs.setScalar(c.s * (1 - sink * 0.6));
    _fm.compose(_fv, _fq, _fs); FX.chunkMesh.setMatrixAt(ci++, _fm); if (ci >= 400) break;
  }
  FX.chunkMesh.count = ci; FX.chunkMesh.instanceMatrix.needsUpdate = true;
  // wrecks and debris
  const counts = {};
  for (const w of FX.wrecks) {
    const M = FX.wreckMesh[w.type] && FX.wreckMesh[w.type][w.group]; if (!M) continue;
    const key = w.type + w.group, i = counts[key] = (counts[key] || 0); counts[key]++; if (i >= 120) continue;
    const sink = w.rest ? Math.max(0, w.t - w.burn - 3) / 3 : 0;       // after burning out: sink into the ground
    _fe.set(w.roll, w.yaw, w.pitch, 'YXZ'); _fq.setFromEuler(_fe);
    _fv.set(w.x, w.y - sink * 0.35, w.z); _fs.setScalar(UNIT_SCALE);
    _fm.compose(_fv, _fq, _fs);
    if (w.group === 'turret') { _fp.makeTranslation(0, 0, 0); }
    else _fp.makeTranslation(M.piv.x, M.piv.y, M.piv.z);
    _fm.multiply(_fp); M.im.setMatrixAt(i, _fm);
  }
  for (const key of UNIT_TYPES) for (const [g, M] of Object.entries(FX.wreckMesh[key])) {
    const n = Math.min(120, counts[key + g] || 0); M.im.count = n; M.sh.count = tierState.liveShadows ? n : 0; M.im.instanceMatrix.needsUpdate = true;
  }
}
