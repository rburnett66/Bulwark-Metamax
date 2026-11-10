/**
 * src/menu/podChest3d.js — the Pod Reward Chest in 3D: the chest model and its effects [MM-story_mwayo9y5_1v].
 *
 * Owner (2026-11-10): "a high tech 3D chest with blender 5.2 ... the important part is the effects when presenting and
 * opening the chest." The model is content/farm/pod_chest.glb (tools/blender/farming/pod_chest.py: base, lid_l, lid_r,
 * lock, pods). This module stages it in three.js (the game's vendored r128, src/reveal/three.js) with HDR bloom, and
 * plays three beats. src/menu/podChest.js drives them and keeps the DOM (title, cards, COLLECT) above the canvas.
 *
 *   present()   ARRIVAL. A beam of light drops onto a holographic hex floor that spreads out from under it; the chest is
 *               printed into being from the floor up behind a bright scan line, sparks shedding off the line; it settles
 *               on its hover pads with a flash and a shockwave across the floor. Then IDLE: it hovers and sways, its
 *               seams breathe, the lock ring turns, motes drift round it.
 *   open()      OPENING. Charge: the lock spins up and blows off toward the camera, the seams flare, the chest shakes
 *               harder and harder while energy streams in from all round. Burst: the clamshell lid snaps open to both
 *               sides, a pillar of light erupts from the cradle, a white flash, a ring of light races across the floor,
 *               a fan of light rays wheels behind the chest, gold and cyan sparks spray out and fall. Resolves at the
 *               burst, when the pods can rise.
 *   releasePod(colour, clientX, clientY)
 *               POD FLIGHT. One glowing pod in the crop's tier colour rises out of the cradle, hangs a moment, then
 *               streaks to a point on screen (the card it becomes) trailing sparks, and pops. Resolves on arrival.
 *
 * Reduced motion: no beam, scan, shake, flash or flight; the chest fades in, the lid opens gently, pods are skipped
 * (the caller shows the cards at once). Quality tier: 'low' drops antialiasing, halves particles and skips the lens pass.
 * Throws (from createChestStage) when WebGL or the model is unavailable; the caller falls back to the drawn chest.
 * Purely visual: the save is changed by the caller (farm/chest.js openChest), never here.
 */
import { loadThree, CONTENT } from '../reveal/three.js';
import { hdrBloom, tonemapPass, chromaticAberrationPass } from '../render3d/space/lensFx.js';

const MODEL = CONTENT + 'farm/pod_chest.glb';
// owner: "the emissive materials are too bright, try a dark blue emissive color": the glow is a deep blue, gold the accent
const CYAN = [0.12, 0.3, 1.0], GOLD = [1.0, 0.72, 0.3];
const SEAM = [0.05, 0.16, 0.85], CORE = [0.1, 0.26, 1.0];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x) => Math.pow(clamp01(x), 2.2);
const easeOutBack = (x, k = 2.2) => { const t = clamp01(x) - 1; return 1 + (k + 1) * t * t * t + k * t * t; };

export async function createChestStage({ host, tier = 'high', reduced = false, timeScale = 1 } = {}) {
  const { THREE, addons } = await loadThree();
  const { GLTFLoader, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass } = addons;
  const doc = host.ownerDocument, win = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.className = 'pch3d';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, tier === 'low' ? 1 : tier === 'standard' ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060a);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const look = new THREE.Vector3(0, 0.62, 0), camBase = new THREE.Vector3(0, 1.85, 6.6);

  // ── light: an environment for the metal (a cool room with three light panels), a warm key, a cyan rim, the core
  {
    const env = new THREE.Scene();
    const skyG = new THREE.SphereGeometry(20, 24, 12), cols = [];
    for (let i = 0; i < skyG.attributes.position.count; i++) {
      const y = skyG.attributes.position.getY(i) / 20, c = new THREE.Color().setRGB(0.05 + 0.25 * Math.max(0, y), 0.07 + 0.3 * Math.max(0, y), 0.1 + 0.4 * Math.max(0, y));
      cols.push(c.r, c.g, c.b);
    }
    skyG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (w, h, pos, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
    panel(14, 4, [0, 12, 4], [1.4, 1.4, 1.5]); panel(6, 8, [-12, 4, 6], [1.1, 0.85, 0.6]); panel(6, 8, [12, 3, -6], [0.35, 0.9, 1.2]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  }
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6); key.position.set(-3, 5, 5);
  const rim = new THREE.DirectionalLight(0x4a78ff, 1.3); rim.position.set(3, 3, -4);
  const fill = new THREE.HemisphereLight(0x9fc8ff, 0x0a0c10, 0.45);
  const coreLight = new THREE.PointLight(0x3a6dff, 0, 6, 2); coreLight.position.set(0, 1.1, 0.2);
  scene.add(key, rim, fill, coreLight);

  // ── the chest
  const gltf = await new GLTFLoader().loadAsync(MODEL);
  const chest = gltf.scene;
  const rig = new THREE.Group(); rig.add(chest); scene.add(rig);
  const node = (n) => chest.getObjectByName(n);
  const lidL = node('lid_l'), lidR = node('lid_r'), lock = node('lock'), podsNode = node('pods');
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 99);
  const glow = { seam: [], core: [], pod: [] };
  chest.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material = o.material.clone();
    m.clippingPlanes = [clip];
    m.envMapIntensity = 0.9;
    if (/glow_seam/.test(m.name)) { m.color = new THREE.Color(0.02, 0.05, 0.2); m.emissive = new THREE.Color(...SEAM); glow.seam.push(m); }
    else if (/glow_core/.test(m.name)) { m.color = new THREE.Color(0.02, 0.05, 0.2); m.emissive = new THREE.Color(...CORE); glow.core.push(m); }
    else if (/glow_pod/.test(m.name)) { m.emissive = new THREE.Color(1, 0.95, 0.8); glow.pod.push(m); }
  });
  const setGlow = (list, v) => { for (const m of list) m.emissiveIntensity = v; };
  const lockHome = lock.position.clone();

  // ── shaders: holo floor, beam, scan frame, shock ring, light pillar, ray fan, back glow, particles
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({ ...add, uniforms: U({ uR: 0, uT: 0, uI: 1, uC: new THREE.Color(...CYAN) }),
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vP; uniform float uR, uT, uI; uniform vec3 uC;
      float hexd(vec2 p){ p = abs(p); return max(dot(p, vec2(.8660254,.5)), p.y); }
      void main(){
        vec2 p = vP * 2.4; vec2 r = vec2(1., 1.7320508), h = r * .5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; vec2 g = dot(a,a) < dot(b,b) ? a : b;
        float edge = smoothstep(.035, .0, abs(hexd(g) - .5));
        float d = length(vP);
        float reach = smoothstep(uR, uR - .6, d);
        float front = exp(-pow((d - uR) * 6., 2.)) * step(.01, uR);
        float fade = smoothstep(3.6, .9, d);
        float pulse = .55 + .45 * sin(d * 5. - uT * 3.);
        float base = exp(-d * d * .9) * .5;
        vec3 col = uC * (edge * reach * fade * pulse * .16 + front * .6 + base * reach * .18);
        gl_FragColor = vec4(col * uI, 1.);
      }` }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; scene.add(floor);

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 9, 48, 1, true), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: U({ uA: 0, uT: 0, uC: new THREE.Color(...CYAN) }),
    vertexShader: 'varying vec2 vU; varying vec3 vN, vV; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec2 vU; varying vec3 vN, vV; uniform float uA, uT; uniform vec3 uC;
      void main(){ float rimv = pow(1. - abs(dot(vN, vV)), 1.6); float lines = .6 + .4 * sin(vU.y * 60. + uT * 14.);
        float fall = smoothstep(0., .25, vU.y) * (1. - smoothstep(.85, 1., vU.y));
        gl_FragColor = vec4(uC * (rimv * 1.1 + .04) * lines * fall * uA * .8, 1.); }` }));
  beam.position.y = 4.4; scene.add(beam);

  const scan = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.9), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: U({ uA: 0, uC: new THREE.Color(...CYAN) }),
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vU; uniform float uA; uniform vec3 uC;
      void main(){ vec2 q = abs(vU - .5) * 2.; float e = max(q.x, q.y); float ring = smoothstep(.86, .96, e) * smoothstep(1., .97, e);
        float fill = smoothstep(1., .2, e) * .25; gl_FragColor = vec4(uC * (ring * 3. + fill * .4) * uA, 1.); }` }));
  scan.rotation.x = -Math.PI / 2; scene.add(scan);

  const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: U({ uA: 0, uC: new THREE.Color(...CYAN) }),
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; void main(){ gl_FragColor = vec4(uC * 1.6 * uA, 1.); }' }));
  shock.rotation.x = -Math.PI / 2; shock.position.y = -0.1; shock.visible = false; scene.add(shock);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 7, 40, 1, true), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: U({ uA: 0, uT: 0 }),
    vertexShader: 'varying vec2 vU; varying vec3 vN, vV; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec2 vU; varying vec3 vN, vV; uniform float uA, uT;
      void main(){ float core = pow(abs(dot(vN, vV)), 2.); float up = pow(1. - vU.y, 1.5);
        float wav = .75 + .25 * sin(vU.y * 22. - uT * 18. + vU.x * 6.283);
        vec3 c = mix(vec3(1., .8, .45), vec3(.2, .4, 1.), vU.y);
        gl_FragColor = vec4(c * core * up * wav * uA * .9, 1.); }` }));
  pillar.position.y = 0.8 + 3.5; pillar.visible = false; scene.add(pillar);

  const rays = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({ ...add, uniforms: U({ uA: 0, uT: 0 }),
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vP; uniform float uA, uT;
      void main(){ float a = atan(vP.y, vP.x), d = length(vP);
        float r = pow(abs(sin(a * 9. + uT * .6)), 14.) + .6 * pow(abs(sin(a * 5. - uT * .4 + 1.)), 20.);
        float fall = smoothstep(4.4, .6, d) * smoothstep(.0, .5, d);
        gl_FragColor = vec4(vec3(1., .82, .5) * r * fall * uA * .45, 1.); }` }));
  rays.position.set(0, 1.0, -1.6); scene.add(rays);

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShaderMaterial({ ...add, uniforms: U({ uA: 0.12, uC: new THREE.Color(0.08, 0.18, 0.6) }),
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec2 vP; uniform float uA; uniform vec3 uC; void main(){ float d = length(vP); gl_FragColor = vec4(uC * exp(-d * d * .18) * uA, 1.); }' }));
  halo.position.set(0, 0.9, -3); scene.add(halo);

  // ── particles: one pool of additive points (sparks, motes, inflow, trails), updated on the CPU
  const MAXP = tier === 'low' ? 320 : 700;
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pA = new Float32Array(MAXP);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pg.setAttribute('size', new THREE.BufferAttribute(pSize, 1)); pg.setAttribute('alpha', new THREE.BufferAttribute(pA, 1));
  const pMat = new THREE.ShaderMaterial({ ...add, uniforms: U({ uScale: 300 }),
    vertexShader: `attribute float size, alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d,d) * 4.; float a = exp(-r * 4.) + .35 * exp(-r * 40.); if (vA <= 0.) discard; gl_FragColor = vec4(vC * a * vA * 2., 1.); }' });
  const points = new THREE.Points(pg, pMat); points.frustumCulled = false; scene.add(points);
  const parts = [];
  function emit(p) {
    if (parts.length >= MAXP) parts.shift();
    parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 1, max: 1, size: 0.08, c: CYAN, kind: 'spark', ...p });
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function stepParticles(dt, tt) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.kind === 'mote') {
        p.a += dt * p.w; p.x = Math.cos(p.a) * p.r; p.z = Math.sin(p.a) * p.r * 0.6; p.y = p.h + Math.sin(tt * 1.3 + p.a * 2) * 0.12 + rig.position.y;
      } else if (p.kind === 'in') {
        const k = 1 - p.life / p.max, e = k * k;
        p.x = p.sx * (1 - e); p.y = p.sy * (1 - e) + 0.75 * e + rig.position.y; p.z = p.sz * (1 - e);
      } else {
        p.vy -= p.g * dt; const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < -0.1 && p.g) { p.y = -0.1; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      }
    }
    for (const p of parts) {
      const k = p.life / p.max, fade = p.kind === 'mote' ? Math.min(1, (1 - k) * 4, k * 4) * 0.55 : p.kind === 'in' ? Math.min(1, (1 - k) * 3) : Math.min(1, k * 1.6);
      pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z;
      pCol[n * 3] = p.c[0]; pCol[n * 3 + 1] = p.c[1]; pCol[n * 3 + 2] = p.c[2];
      pSize[n] = p.size; pA[n] = fade; n++;
    }
    pg.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size', 'alpha']) pg.attributes[a].needsUpdate = true;
  }

  // ── the pods in flight: glowing orbs with a halo sprite
  const haloTex = (() => {
    const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const orbGeo = new THREE.IcosahedronGeometry(0.14, 2);
  const orbs = [];

  // ── post: HDR bloom, the game's tone map, a touch of lens on high
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = hdrBloom(THREE, new UnrealBloomPass(new THREE.Vector2(1, 1), tier === 'low' ? 0.35 : 0.45, 0.35, 1.0));
  composer.addPass(bloom);
  composer.addPass(tonemapPass(THREE, ShaderPass, { exposure: 1.05 }));
  let lens = null;
  if (tier === 'high') { lens = chromaticAberrationPass(THREE, ShaderPass, { amount: 0.0012, vignette: 0.32, grain: 0.02 }); composer.addPass(lens); }

  host.appendChild(canvas);
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h;
    // fit: the chest (≈2.6 wide with its glow) stays inside the frame on a narrow or short screen
    camera.fov = camera.aspect < 1.2 ? 30 * 1.2 / camera.aspect : h < 480 ? 34 : 30;
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.45;
  }
  resize();
  const ro = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  if (ro) ro.observe(host);

  // ── the timeline
  const S = { phase: 'hidden', t: 0, tt: 0, beamA: 0, built: 0, shake: 0, charge: 0, open: 0, lift: 0, flash: 0, raysA: 0, seam: 2.2, core: 2.5 };
  let presented = null, opened = null, raf = 0, last = 0, disposed = false;
  rig.visible = false;
  setGlow(glow.seam, 0); setGlow(glow.core, 0); setGlow(glow.pod, 3);
  const flashEl = doc.createElement('div'); flashEl.className = 'pch3d-flash'; host.appendChild(flashEl);

  function frame(now) {
    if (disposed) return;
    raf = win.requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const sdt = dt * timeScale; S.t += sdt; S.tt += sdt;
    const T = S.t, tt = S.tt;
    floor.material.uniforms.uT.value = tt; beam.material.uniforms.uT.value = tt; pillar.material.uniforms.uT.value = tt; rays.material.uniforms.uT.value = tt;

    if (S.phase === 'present') {
      if (reduced) {
        rig.visible = true; const k = clamp01(T / 0.5);
        clip.constant = 99; setGlow(glow.seam, 2.2 * k); setGlow(glow.core, 2.5 * k); floor.material.uniforms.uR.value = 3.2 * k;
        if (k >= 1) { S.phase = 'idle'; S.t = 0; presented.resolve(); }
      } else {
        // 0–0.55 the beam drops; 0.25–1.0 the floor spreads; 0.5–1.65 the scan prints the chest; 1.65 it lands
        const drop = easeOut(T / 0.55);
        beam.material.uniforms.uA.value = S.beamA = drop * (1 - clamp01((T - 1.4) / 0.6));
        beam.scale.set(1, 0.3 + 0.7 * drop, 1); beam.position.y = 4.4 + (1 - drop) * 3;
        floor.material.uniforms.uR.value = 3.4 * easeOut((T - 0.25) / 0.9);
        const b = clamp01((T - 0.5) / 1.15); S.built = b;
        if (b > 0) {
          rig.visible = true;
          const h = -0.15 + b * 1.45;
          clip.constant = rig.position.y + h;
          scan.position.y = rig.position.y + h; scan.material.uniforms.uA.value = b < 1 ? 0.7 : 0;
          if (b < 1 && Math.random() < 0.9) for (let k = 0; k < 3; k++) {
            const side = Math.random() < 0.5, sx = side ? rnd(-1.15, 1.15) : (Math.random() < 0.5 ? -1.15 : 1.15), sz = side ? (Math.random() < 0.5 ? -0.75 : 0.75) : rnd(-0.75, 0.75);
            emit({ x: sx, y: scan.position.y, z: sz, vx: sx * 0.4, vy: rnd(0.2, 0.9), vz: sz * 0.4, g: 1.5, drag: 1.2, life: 0.6, max: 0.6, size: 0.05, c: CYAN });
          }
          setGlow(glow.seam, 2.2 * b); setGlow(glow.core, 2.5 * b);
        }
        if (T >= 1.65 && S.phase === 'present') {
          clip.constant = 99; scan.material.uniforms.uA.value = 0;
          shock.visible = true; S.shockT = 0; S.flash = 0.35; S.shake = 0.12;
          for (let k = 0; k < 60; k++) { const a = rnd(0, Math.PI * 2); emit({ x: Math.cos(a) * 0.9, y: -0.08, z: Math.sin(a) * 0.6, vx: Math.cos(a) * rnd(1.5, 3), vy: rnd(0.2, 1), vz: Math.sin(a) * rnd(1.5, 3), g: 3, drag: 2, life: 0.8, max: 0.8, size: 0.06, c: CYAN }); }
          S.phase = 'idle'; S.t = 0; presented.resolve();
        }
      }
    }
    if (S.phase === 'idle' || S.phase === 'charge') {
      if (!reduced) {
        rig.position.y = 0.06 + Math.sin(tt * 1.6) * 0.05;
        rig.rotation.y = Math.sin(tt * 0.5) * 0.14;
        if (Math.random() < 0.25 && parts.filter((p) => p.kind === 'mote').length < 34) emit({ kind: 'mote', a: rnd(0, 6.28), w: rnd(0.3, 0.7), r: rnd(1.5, 2.3), h: rnd(0.2, 1.6), life: rnd(3, 6), max: 5, size: 0.045, c: Math.random() < 0.7 ? CYAN : GOLD });
      }
      const breathe = 0.5 + 0.5 * Math.sin(tt * 2.4);
      if (S.phase === 'idle') { setGlow(glow.seam, 1.3 + 0.9 * breathe); setGlow(glow.core, 1.5 + 0.6 * breathe); lock.rotation.z += dt * 0.6; }
    }
    if (S.phase === 'charge') {
      // 0–0.85: the lock spins up and blows off; seams flare; shake grows; energy streams in
      const k = clamp01(T / 0.85);
      lock.rotation.z += dt * (2 + 30 * k * k);
      setGlow(glow.seam, 3 + 14 * k * k); setGlow(glow.core, 3 + 8 * k);
      coreLight.intensity = 4 * k;
      S.shake = reduced ? 0 : 0.012 + 0.06 * k * k;
      if (!reduced) for (let i = 0; i < 4; i++) {
        const a = rnd(0, 6.28), e = rnd(-0.6, 1.1), r = rnd(2.4, 3.6);
        emit({ kind: 'in', sx: Math.cos(a) * r * Math.cos(e), sy: 0.75 + Math.sin(e) * r, sz: Math.sin(a) * r * Math.cos(e) * 0.7, life: 0.5, max: 0.5, size: 0.06, c: Math.random() < 0.6 ? CYAN : GOLD });
      }
      if (k > 0.72) {
        const off = (k - 0.72) / 0.28;
        lock.position.set(lockHome.x, lockHome.y + off * 0.3, lockHome.z + off * 2.2);
        lock.scale.setScalar(Math.max(0.001, 1 - off));
      }
      if (T >= 0.85) burst();
    }
    if (S.phase === 'open') {
      const k = reduced ? easeOut(T / 0.6) : easeOutBack(T / 0.55, 1.8);
      lidL.rotation.z = 2.05 * k; lidR.rotation.z = -2.05 * k;
      pillar.material.uniforms.uA.value = reduced ? 0 : Math.max(0, 1 - T / 2.0) * (T < 0.12 ? T / 0.12 : 1) + 0.04;
      pillar.scale.set(1 + 0.4 * Math.exp(-T * 3), 1, 1 + 0.4 * Math.exp(-T * 3));
      S.raysA = reduced ? 0 : Math.min(1, T * 4) * (0.35 + 0.65 * Math.exp(-T * 1.2));
      setGlow(glow.seam, 2 + 8 * Math.exp(-T * 2)); setGlow(glow.core, 2.2 + 6 * Math.exp(-T * 1.5));
      coreLight.intensity = 3 + 10 * Math.exp(-T * 2);
      look.y = 0.62 - 0.32 * easeOut(T / 0.8);   // the chest lifts in frame to leave room for the cards
      if (!reduced) { rig.position.y = 0.06 + Math.sin(tt * 1.6) * 0.04; rig.rotation.y *= 0.95; }
      if (!reduced && T < 1.2 && Math.random() < 0.6) emit({ x: rnd(-0.5, 0.5), y: 0.9 + rig.position.y, z: rnd(-0.3, 0.3), vx: rnd(-0.3, 0.3), vy: rnd(1.5, 3.5), vz: rnd(-0.3, 0.3), g: 0.6, drag: 0.8, life: 1.2, max: 1.2, size: 0.05, c: GOLD });
    }
    // shared: shock ring, flash, shake, rays, orbs, camera
    if (shock.visible) {
      S.shockT += dt; const k = S.shockT / (S.bigShock ? 1.1 : 0.8);
      shock.scale.setScalar(0.4 + (S.bigShock ? 6 : 3.2) * easeOut(k)); shock.material.uniforms.uA.value = Math.max(0, 1 - k);
      if (k >= 1) shock.visible = false;
    }
    S.flash = Math.max(0, S.flash - dt * 3.2); flashEl.style.opacity = String(reduced ? 0 : S.flash);
    rays.material.uniforms.uA.value = S.raysA;
    halo.material.uniforms.uA.value = 0.12 + 0.25 * S.raysA;
    S.beamA = Math.max(0, S.beamA - dt * 1.6); if (S.phase !== 'present') beam.material.uniforms.uA.value = S.beamA;
    bloom.strength = (tier === 'low' ? 0.35 : 0.45) + 0.6 * S.flash;
    for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].step(sdt)) orbs.splice(i, 1);
    stepParticles(sdt, tt);
    S.shake *= S.phase === 'charge' ? 1 : Math.pow(0.02, dt);
    camera.position.set(camBase.x + rnd(-1, 1) * S.shake, camBase.y + rnd(-1, 1) * S.shake, camBase.z);
    camera.lookAt(look);
    lens && lens.tick && lens.tick(dt);
    composer.render();
  }

  function burst() {
    S.phase = 'open'; S.t = 0; S.shake = reduced ? 0 : 0.18; S.flash = reduced ? 0 : 0.85;
    lock.visible = false; podsNode.visible = false; pillar.visible = !reduced;
    shock.visible = !reduced; S.shockT = 0; S.bigShock = true;
    if (!reduced) {
      const n = tier === 'low' ? 90 : 180;
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), up = rnd(0.3, 1), sp = rnd(2.5, 6.5);
        emit({ x: rnd(-0.4, 0.4), y: 0.9 + rig.position.y, z: rnd(-0.3, 0.3), vx: Math.cos(a) * sp * (1 - up * 0.5), vy: up * sp, vz: Math.sin(a) * sp * (1 - up * 0.5) * 0.7,
          g: 6, drag: 0.9, life: rnd(0.8, 1.6), max: 1.4, size: rnd(0.04, 0.09), c: Math.random() < 0.55 ? GOLD : CYAN });
      }
    }
    opened.resolve();
  }

  /** A pod rises from the cradle in `colour`, streaks to the screen point (clientX, clientY) and pops. → Promise. */
  function releasePod(colour, clientX, clientY, { rise = 0.5, fly = 0.42 } = {}) {
    return new Promise((resolve) => {
      if (reduced) { resolve(); return; }
      const c = new THREE.Color(colour), hdr = c.clone().multiplyScalar(4);
      const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: hdr, toneMapped: false }));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c.clone().multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.scale.setScalar(0.9); m.add(s); scene.add(m);
      const start = new THREE.Vector3(rnd(-0.3, 0.3), 0.85 + rig.position.y, rnd(-0.1, 0.2));
      const hover = new THREE.Vector3(start.x * 2.5, 2.35, 0.6);
      // the target: the card's centre, on a plane in front of the chest
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
      const target = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.2), target);
      let t = 0; m.position.copy(start);
      orbs.push({ step(dt) {
        t += dt;
        if (t < rise) { const k = easeOut(t / rise); m.position.lerpVectors(start, hover, k); m.scale.setScalar(0.4 + 0.6 * k); }
        else {
          const k = easeIn((t - rise) / fly);
          m.position.lerpVectors(hover, target, k); m.scale.setScalar(1 - 0.5 * k);
          emit({ x: m.position.x, y: m.position.y, z: m.position.z, vx: rnd(-0.2, 0.2), vy: rnd(-0.2, 0.2), vz: 0, g: 0, drag: 2, life: 0.35, max: 0.35, size: 0.07, c: [c.r, c.g, c.b] });
          if (k >= 1) {
            for (let i = 0; i < 26; i++) { const a = rnd(0, 6.28), sp = rnd(1, 2.6); emit({ x: target.x, y: target.y, z: target.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0, g: 0, drag: 3, life: 0.45, max: 0.45, size: 0.06, c: [c.r, c.g, c.b] }); }
            scene.remove(m); m.material.dispose(); s.material.dispose();
            resolve(); return true;
          }
        }
        m.rotation.y += dt * 4;
        return false;
      } });
    });
  }

  const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); p.resolve = resolve; return p; };
  raf = win.requestAnimationFrame(frame);

  return {
    canvas,
    /** ARRIVAL, then IDLE. → Promise resolving when the chest has landed. */
    present() { if (!presented) { presented = deferred(); S.phase = 'present'; S.t = 0; } return presented; },
    /** OPENING. → Promise resolving at the burst (the lid flying open). */
    open() {
      if (!opened) {
        opened = deferred();
        const go = () => { S.phase = 'charge'; S.t = 0; };
        if (S.phase === 'idle') go(); else (presented || this.present()).then(go);
      }
      return opened;
    },
    releasePod,
    /** Skip to the end state: landed and open, nothing in flight. */
    finish() {
      if (S.phase === 'present' || S.phase === 'hidden') { rig.visible = true; clip.constant = 99; scan.material.uniforms.uA.value = 0; beam.material.uniforms.uA.value = 0; if (!presented) presented = deferred(); presented.resolve(); }
      if (!opened) opened = deferred();
      if (S.phase !== 'open') { lock.visible = false; burst(); S.t = 5; S.flash = 0; S.shake = 0; }
      for (const o of orbs) o.step(99);
    },
    dispose() {
      disposed = true; win.cancelAnimationFrame(raf); if (ro) ro.disconnect();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) m.dispose(); });
      haloTex.dispose(); composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); renderer.dispose();
      canvas.remove(); flashEl.remove();
    },
  };
}
