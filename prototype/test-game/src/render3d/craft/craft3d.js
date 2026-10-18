/**
 * src/render3d/craft/craft3d.js — a landing craft in the scene, and the binder that poses it. [MM-story_mvbk1hf3_1]
 * [MM-story_mvbks05m_4]
 *
 * The craft is the player's 3 × 3 base (models.js). It is ONE instance per level, so each animated group is a
 * plain Mesh — no instancing — merged per group into one vertex-coloured geometry, drawn with the units' metal
 * material (units/material.js: per-vertex colour, metalness/roughness, unlit glow). Engine-glow parts (`glowE`)
 * are split into their own mesh per group so thrust can brighten them without touching the rest.
 *
 *   root (world: base centre, scaled 1 cell = 4 units)
 *   ├─ model (pose: altitude, yaw, pitch, roll)
 *   │   ├─ body · gear · doorR · doorL        (gear translates, doors rotate about their sill hinges)
 *   │   ├─ weapon (yaws) └─ head (scans)       (head rides on the weapon)
 *   │   ├─ plumes (per jet: white-hot core + gas sheath shaders, nozzle flare) — flicker, squash on the ground
 *   │   └─ nav lights (port red, starboard green, white strobes)
 *   └─ ground set (soft radial decals): blob shadow, dust haze, jet glow pools, scorch marks, touchdown
 *      shockwave ring, shield dome; thruster wash: smoke + debris (landingFx.js; one instanced draw each) with the
 *      set pieces — shockwave burst, contrails, hatch vents, cooling wisps, ramp slaps — and camera shake
 *
 * Shadows: airborne, the craft does NOT cast into the static shadow map (that would re-render it every frame);
 * a soft blob shadow follows it instead. setCastShadow(true) on touchdown, then the caller re-renders the map once.
 *
 * THREE is injected (no import) — see render3d/index.js.
 */
import { createPrims } from '../units/prims.js';
import { createUnitMaterial } from '../units/material.js';
import { metalFor, isGlowKey } from '../units/metal.js';
import { craftFor, CRAFT_SCALE } from './models.js';
import { createLandingFx, washStrength, noise3 } from './landingFx.js';
import { EVENTS, rampOf } from './landing.js';

const D2R = Math.PI / 180;
const ENGINE = 'glowE';

/** Merge a craft's groups into { [group]: { lit, engine, pivot, tris } } — exported for tests and tools. */
export function mergeCraftGroups(THREE, def, prims = createPrims(THREE)) {
  const dummy = new THREE.MeshBasicMaterial();
  const built = prims.buildModel(def, () => dummy);
  const out = {}, c = new THREE.Color();
  for (const [gname, G] of Object.entries(built.groups)) {
    const L = { pos: [], nor: [], col: [], emi: [], mr: [] }, E = { pos: [], nor: [], col: [] };
    for (const mesh of G.children) {
      const k = mesh.userData.mat, hex = def.palette[k] || (isGlowKey(k) ? def.palette.glow : null);
      c.set(hex || '#ff00ff');   // magenta = a key with no colour — visible on purpose
      const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
      if (k === ENGINE) {
        for (let i = 0; i < P.length; i += 3) { E.pos.push(P[i], P[i + 1], P[i + 2]); E.nor.push(N[i], N[i + 1], N[i + 2]); E.col.push(c.r, c.g, c.b); }
      } else {
        const e = isGlowKey(k) ? 1 : 0, [mtl, rgh] = metalFor(k);
        for (let i = 0; i < P.length; i += 3) {
          L.pos.push(P[i], P[i + 1], P[i + 2]); L.nor.push(N[i], N[i + 1], N[i + 2]);
          L.col.push(c.r, c.g, c.b); L.emi.push(e); L.mr.push(mtl, rgh);
        }
      }
      mesh.geometry.dispose();
    }
    const geo = (A, extra) => {
      if (!A.pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
      if (extra) { g.setAttribute('aEmit', new THREE.Float32BufferAttribute(A.emi, 1)); g.setAttribute('aMR', new THREE.Float32BufferAttribute(A.mr, 2)); }
      g.computeBoundingSphere();
      return g;
    };
    const piv = (def.pivots && def.pivots[gname]) || [0, 0, 0];   // prims already made the geometry pivot-relative
    out[gname] = { lit: geo(L, true), engine: geo(E, false), pivot: piv, tris: (L.pos.length + E.pos.length) / 9 };
  }
  dummy.dispose();
  return out;
}

/** Lift-jet (vertical) and rear-nozzle (ax 'x') positions, from the craft's glowE parts. */
export function jetsOf(def) {
  const out = [];
  for (const p of def.parts) {
    if (p.m !== ENGINE || p.t !== 'cyl') continue;
    const r = Array.isArray(p.r) ? p.r[0] : p.r, at = [p.p];
    if (p.mir) at.push([p.p[0], p.p[1], -p.p[2]]);
    for (const q of at) out.push({ p: q, r, dir: p.ax === 'x' ? 'back' : 'down', g: p.g || 'body' });
  }
  return out;
}

/**
 * Build a craft (by craft key or faction key) into `scene`. Returns the API the renderer and the tools use:
 *   place(baseCell) · setEnv({ sky, ground }) · apply(pose) · aim(yawRad | null, dt) · scan(t)
 *   setCastShadow(on) · setVisible(on) · harvesterWorld(side, k) · dispose()
 * opts: { tier: { liveShadows } } — the Low tier skips plumes.
 */
export function createCraft3D(THREE, scene, key, opts = {}) {
  const def = craftFor(key);
  const prims = createPrims(THREE);
  const mat = createUnitMaterial(THREE, opts.env ? { env: opts.env } : {});
  const engineMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const parts = mergeCraftGroups(THREE, def, prims);

  const root = new THREE.Group(); root.name = 'landing-craft';
  root.scale.setScalar(CRAFT_SCALE);
  const model = new THREE.Group(); root.add(model);
  const groups = {};
  const meshes = [];
  for (const [g, P] of Object.entries(parts)) {
    const G = new THREE.Group(); G.name = g;
    for (const [geo, m] of [[P.lit, mat.material], [P.engine, engineMat]]) {
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = false; mesh.receiveShadow = true;
      G.add(mesh); meshes.push(mesh);
    }
    groups[g] = G;
  }
  // hierarchy: head rides on the weapon; everything else on the model
  for (const [g, G] of Object.entries(groups)) {
    const piv = parts[g].pivot;
    if ((g === 'head' || g === 'barrel') && groups.weapon) {   // head and gun ride the weapon
      const w = parts.weapon.pivot;
      G.position.set(piv[0] - w[0], piv[1] - w[1], piv[2] - w[2]);
      groups.weapon.add(G);
    } else {
      G.position.set(piv[0], piv[1], piv[2]);
      model.add(G);
    }
  }
  const low = !!(opts.tier && opts.tier.key === 'low');
  const disposables = [];
  const keep = (m) => { disposables.push(m); return m; };
  const glowCol = new THREE.Color(def.palette.glowE || def.palette.glow);
  const hotCol = glowCol.clone().lerp(new THREE.Color(0xffa040), 0.55);   // where the jet meets the ground / lights the dust
  const flareTex = keep(glowTexture(THREE));

  // ── THRUSTERS: per jet a white-hot tapering core + a wider, fainter sheath of expanding gas (shader: hot at the
  // nozzle, cooling to the glow colour, fading to the tip, soft at the silhouette, shock bands scrolling down), a
  // nozzle flare sprite, and — for lift jets — a glow pool on the ground under it.
  const plumes = [];
  const jets = jetsOf(def);
  if (!low) {
    for (const j of jets) {
      const len = j.dir === 'down' ? 3.0 : 3.6;
      const h = new THREE.Group(); h.position.set(j.p[0], j.p[1], j.p[2]);
      if (j.dir === 'back') h.rotation.z = -Math.PI / 2;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(j.r * 0.72, j.r * 0.12, len, 14, 1, true).translate(0, -len / 2, 0), keep(plumeMaterial(THREE, glowCol, 1.0)));
      const sheath = new THREE.Mesh(new THREE.CylinderGeometry(j.r * 1.0, j.r * 1.45, len * 0.8, 14, 1, true).translate(0, -len * 0.4, 0), keep(plumeMaterial(THREE, glowCol, 0.0)));
      const flare = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: flareTex, color: glowCol.clone().lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
      flare.scale.setScalar(j.r * 4.2); flare.position.y = -0.15;
      core.renderOrder = sheath.renderOrder = flare.renderOrder = 4;
      h.add(sheath, core, flare); model.add(h);
      plumes.push({ j, h, core, sheath, flare, len, dir: j.dir, v: 0, ph: plumes.length * 1.7 + 0.3, ground: 99 });
    }
  }
  // ── GROUND SET (all soft radial shaders — no hard-edged discs): blob shadow, dust haze, per-lift-jet glow pools
  // and scorch marks, the touchdown shockwave ring, the shield dome.
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), keep(softDisc(THREE, 0x000000, { mid: 0.15 })));
  blob.position.y = 0.06; blob.renderOrder = 1; root.add(blob);
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2), keep(softDisc(THREE, 0xd8c8a0, { inner: 0.2, mid: 0.5, rag: 0.3 })));
  dust.position.y = 0.08; dust.renderOrder = 1; root.add(dust);
  const lifts = jets.filter((j) => j.dir === 'down');
  const pools = lifts.map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), keep(softDisc(THREE, hotCol, { mid: 0.0, additive: true })));
    m.position.y = 0.1; m.renderOrder = 2; m.visible = false; root.add(m); return m;
  });
  const scorch = lifts.map((_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), keep(softDisc(THREE, 0x1a1410, { mid: 0.25, rag: 0.5, seed: i * 1.37 })));
    m.position.y = 0.07 + i * 0.001; m.renderOrder = 1; m.visible = false; m.userData.a = 0; root.add(m); return m;
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), keep(softDisc(THREE, 0xe6d8b8, { inner: 0.7, mid: 0.88, rag: 0.35 })));
  ring.position.y = 0.12; ring.renderOrder = 2; ring.visible = false; root.add(ring);
  let ringT = -1;
  let dome = null;
  if (/shield/.test(def.weaponType)) {
    dome = new THREE.Mesh(new THREE.SphereGeometry(10.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(def.palette.glow), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    root.add(dome);
  }
  // ── NAVIGATION LIGHTS: red to port (−Z), green to starboard (+Z), white strobes nose and tail double-flashing.
  const bb = new THREE.Box3();
  for (const P of Object.values(parts)) if (P.lit) { P.lit.computeBoundingBox(); const b = P.lit.boundingBox.clone(); b.translate(new THREE.Vector3(...P.pivot)); bb.union(b); }
  const navY = bb.min.y + (bb.max.y - bb.min.y) * 0.45, cx = (bb.min.x + bb.max.x) / 2;
  const nav = [
    { c: 0xff3030, p: [cx, navY, bb.min.z - 0.12], kind: 'steady' },
    { c: 0x30ff60, p: [cx, navY, bb.max.z + 0.12], kind: 'steady' },
    { c: 0xffffff, p: [bb.max.x + 0.12, navY, 0], kind: 'strobe' },
    { c: 0xffffff, p: [bb.min.x - 0.12, navY + 0.4, 0], kind: 'strobe', off: 0.09 },
  ].map((n) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: flareTex, color: n.c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.position.set(...n.p); s.scale.setScalar(1.6); s.visible = false; s.renderOrder = 5; model.add(s); return Object.assign(n, { s });
  });

  // ── THRUSTER WASH (landingFx.js): smoke = camera-facing soft puffs (jet-lit when young, vapour puffs white),
  // debris = small tumbling chunks; one draw each. Plus the set pieces: touchdown shockwave, contrails, hatch vents,
  // cooling wisps, ramp slaps.
  const fx = createLandingFx({ seed: 11, scale: low ? 0.4 : 1 });
  const smokeMat = keep(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xc9b896) }, uHot: { value: hotCol.clone() } },
    vertexShader: `attribute float aAlpha; attribute float aShade; attribute float aSeed; attribute float aRot; attribute float aGlow; attribute float aWhite;
      varying float vA; varying float vS; varying float vSeed; varying float vGlow; varying float vWhite; varying vec2 vUv;
      void main() {
        vA = aAlpha; vS = aShade; vSeed = aSeed; vGlow = aGlow; vWhite = aWhite;
        float c0 = cos(aRot), s0 = sin(aRot);
        vUv = mat2(c0, -s0, s0, c0) * (uv * 2.0 - 1.0);   // the puff's outline turns as it rolls
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sc = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        c.xy += position.xy * sc;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uHot; varying float vA; varying float vS; varying float vSeed; varying float vGlow; varying float vWhite; varying vec2 vUv;
      void main() {
        vec2 p = vUv; float ang = atan(p.y, p.x);
        // lumpy cauliflower edge + uneven density, different per puff
        float edge = 0.74 + 0.11 * sin(ang * 3.0 + vSeed * 6.28) + 0.08 * sin(ang * 5.0 + vSeed * 17.0) + 0.05 * sin(ang * 8.0 + vSeed * 31.0);
        float r = length(p) / edge;
        if (r > 1.0) discard;
        float dens = 0.78 + 0.22 * sin(p.x * 6.0 + vSeed * 23.0) * sin(p.y * 5.0 + vSeed * 13.0);
        float soft = (1.0 - r * r) * (1.0 - r * 0.3) * dens;
        vec3 base = mix(uColor, vec3(0.93, 0.94, 0.96), vWhite);
        // sun from above: lit crown, shaded belly; the jet glow lights the core from inside
        vec3 col = base * (0.8 + 0.3 * vS) * (0.74 + 0.4 * (p.y * 0.5 + 0.5)) + uHot * vGlow * (1.0 - r) * 1.3;
        gl_FragColor = vec4(col, vA * soft);
      }`,
    transparent: true, depthWrite: false,
  }));
  const capS = fx.caps.smoke, capD = fx.caps.debris;
  const smokeGeo = new THREE.PlaneGeometry(1, 1);
  for (const a of ['aAlpha', 'aShade', 'aSeed', 'aRot', 'aGlow', 'aWhite']) smokeGeo.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(capS), 1));
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, capS);
  smokeMesh.count = 0; smokeMesh.frustumCulled = false; smokeMesh.renderOrder = 3; smokeMesh.name = 'craft-smoke';
  root.add(smokeMesh);
  const debrisMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const debrisMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), debrisMat, capD);
  debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capD * 3).fill(1), 3);
  debrisMesh.count = 0; debrisMesh.frustumCulled = false; debrisMesh.name = 'craft-debris';
  root.add(debrisMesh);
  const debrisCols = [new THREE.Color(0x6b5a44), new THREE.Color(0x8a7a62), new THREE.Color(0x4a443c)];
  const fxTmp = new THREE.Object3D(), fxV = new THREE.Vector3(), fxD = new THREE.Vector3(), fxC = new THREE.Color();
  const ramp = rampOf(def), hingeY = (def.pivots && def.pivots.doorR && def.pivots.doorR[1]) || 1;

  scene.add(root);

  const A = def.anim, engineBase = 1;
  let fxClock = 0, thrust0 = 0, heat0 = 0, prevT = -1, shake = 0, ventT = 0;
  const carry = { trail: 0, wisp: 0 };
  let aimYaw = 0, castShadow = false, idle = 0;
  /** a model-space point → root space (the craft's current pose) */
  const toRoot = (x, y, z) => fxV.set(x, y, z).applyMatrix4(model.matrix);

  function onEvent(type) {
    if (type === 'touchdown') {
      fx.burst(model.position.x, model.position.z, 1);
      ringT = 0; shake = Math.max(shake, 0.55);
    } else if (type === 'hatchesOpen') {
      ventT = 0.4;
    } else if (type === 'rampsDown') {
      for (const side of [-1, 1]) for (const x of [-1.8, 0, 1.8]) { const q = toRoot(x, 0, side * ramp.foot); fx.slap(q.x, q.z, 0, side); }
      shake = Math.max(shake, 0.15);
    }
  }

  const api = {
    def, root, model, groups,
    tris: Object.values(parts).reduce((a, p) => a + p.tris, 0),
    /** Put the craft on the base cell (the centre of the 3 × 3). */
    place(b) { root.visible = !!b; if (b) root.position.set(b.x + 0.5, 0, b.y + 0.5); },
    setVisible(on) { root.visible = !!on; },
    setEnv(env) {
      if (!env) return;
      mat.setEnv(env);
      if (env.ground != null) {
        smokeMat.uniforms.uColor.value.set(0xcbb894).lerp(new THREE.Color(env.ground), 0.25);   // dust leans to the world's ground
        dust.material.uniforms.uColor.value.copy(smokeMat.uniforms.uColor.value);
        ring.material.uniforms.uColor.value.copy(smokeMat.uniforms.uColor.value).lerp(new THREE.Color(0xffffff), 0.25);
      }
    },
    setMetal(k) { mat.setMetal(k); },
    setCastShadow(on) { castShadow = !!on; for (const m of meshes) m.castShadow = castShadow; },
    get castShadow() { return castShadow; },
    /** Apply a landing.js pose (model units around the landing spot). */
    apply(P) {
      model.position.set(P.x || 0, P.y || 0, P.z || 0);
      model.rotation.set((P.roll || 0) * D2R, (P.yaw || 0) * D2R, (P.pitch || 0) * D2R, 'YXZ');
      // the gear slides down; while the hull dips into its suspension the gear rides up by the same travel (feet planted)
      if (groups.gear) groups.gear.position.y = parts.gear.pivot[1] + A.gear.retract * (1 - P.gear) + (P.squash || 0);
      if (groups.doorR) groups.doorR.rotation.x = A.doorR.open * D2R * (P.doors || 0);
      if (groups.doorL) groups.doorL.rotation.x = A.doorL.open * D2R * (P.doors || 0);
      const thrust = Math.max(P.lift || 0, P.rear || 0);
      thrust0 = thrust; heat0 = P.heat || 0;
      engineMat.color.setScalar(engineBase * (0.35 + 0.65 * thrust));
      for (const p of plumes) {
        const v = p.dir === 'down' ? P.lift || 0 : P.rear || 0; p.v = v;
        const on = v > 0.02; p.core.visible = p.sheath.visible = p.flare.visible = on;
        p.core.scale.set(1, 0.3 + v, 1); p.sheath.scale.set(1, 0.3 + v, 1);
        p.core.material.uniforms.uOpacity.value = 0.95 * v; p.sheath.material.uniforms.uOpacity.value = 0.42 * v; p.flare.material.opacity = 0.9 * v;
      }
      blob.position.x = P.x || 0; blob.position.z = P.z || 0;
      blob.material.uniforms.uOpacity.value = 0.42 * (P.shadow || 0); blob.visible = (P.shadow || 0) > 0.01;
      const bs = 0.8 + 0.4 * Math.min(1, (P.y || 0) / 20); blob.scale.set(bs, 1, bs);
      dust.material.uniforms.uOpacity.value = 0.3 * (P.dust || 0); dust.visible = (P.dust || 0) > 0.01;
      const ds = 0.7 + (P.dust || 0) * 0.5; dust.scale.set(ds, 1, ds);
      for (const n of nav) n.s.visible = (P.nav || 0) > 0.01;
      api._nav = P.nav || 0;
      if (dome) { dome.material.opacity = 0.12 * (P.shield || 0); dome.visible = (P.shield || 0) > 0.01; dome.scale.setScalar(0.2 + 0.8 * (P.shield || 0)); }
    },
    _nav: 0,
    /**
     * Step the living parts of the landing from the pose already applied: thruster flicker and ground clamp, glow
     * pools, scorch, nav lights, the wash particles and the set pieces (fired as the pose's time crosses
     * landing.js EVENTS). Call every frame while landing and for a few seconds after (pose null = no new wash; the
     * billow, ring and shake die out).
     */
    update(dt, P) {
      dt = Math.max(0, dt || 0);
      fxClock += dt;
      model.updateMatrix();
      // events (the timeline jumps back on a re-arm or a loop — start over without firing)
      if (P && P.t != null) {
        if (P.t < prevT) prevT = P.t - 1e-6;
        for (const e of EVENTS) if (prevT < e.at && e.at <= P.t) onEvent(e.type);
        prevT = P.t;
      }
      // thrusters: every plume breathes on its own phase — length, width, a little wobble; lift jets can't push
      // their flame through the ground, so it squashes and the pool beneath brightens
      const emitters = [];
      for (const p of plumes) {
        if (!(p.v > 0.02)) continue;
        const n1 = noise3(fxClock * 9, p.ph, 0.1) - 0.5, n2 = noise3(fxClock * 13, p.ph, 4.2) - 0.5, n3 = noise3(fxClock * 5, p.ph, 8.8) - 0.5;
        let sy = (0.3 + p.v) * (1 + n1 * 0.45);
        if (p.dir === 'down') { const g = toRoot(p.j.p[0], p.j.p[1], p.j.p[2]).y; sy = Math.min(sy, Math.max(0.12, (g + 0.2) / p.len)); }
        const sw = 1 + n2 * 0.3;
        p.core.scale.set(sw, sy, sw); p.sheath.scale.set(sw * (1.05 + 0.1 * p.v), sy, sw * (1.05 + 0.1 * p.v));
        p.h.children.forEach((c) => { if (c !== p.flare) c.rotation.set(n3 * 0.12, 0, n1 * 0.1); });
        p.core.material.uniforms.uTime.value = fxClock + p.ph; p.sheath.material.uniforms.uTime.value = fxClock * 0.7 + p.ph;
        p.flare.material.opacity = Math.min(1, 0.9 * p.v * (0.8 + 0.4 * noise3(fxClock * 17, p.ph, 2.2)));
      }
      if (thrust0 > 0.02) {
        const f = 0.88 + 0.24 * noise3(fxClock * 11, 2.5, 7.1);
        engineMat.color.setScalar(engineBase * (0.35 + 0.65 * thrust0) * f);
      } else if (heat0 > 0.02) {
        engineMat.color.setRGB(0.35 + 0.7 * heat0, 0.35 + 0.22 * heat0, 0.35 + 0.05 * heat0);   // the nozzles cool through orange
      }
      // lift jets → ground emitters, glow pools, scorch
      lifts.forEach((j, i) => {
        const pool = pools[i], sc = scorch[i];
        let st = 0, q = null;
        if (P && (P.lift || 0) > 0) {
          q = toRoot(j.p[0], j.p[1], j.p[2]);
          st = washStrength(P.lift, q.y);
          if (st > 0.01) emitters.push({ x: q.x, z: q.z, strength: st, cx: model.position.x, cz: model.position.z });
        }
        pool.visible = st > 0.02 && !low;
        if (pool.visible) {
          pool.position.x = q.x; pool.position.z = q.z;
          const s = 0.55 + 0.6 * st; pool.scale.set(s, 1, s);
          pool.material.uniforms.uOpacity.value = 0.85 * st * (0.8 + 0.4 * noise3(fxClock * 14, i * 3.3, 5.5));
        }
        if (st > 0.3) {
          sc.userData.a = Math.min(0.5, sc.userData.a + st * dt * 0.22);
          sc.position.x += (q.x - sc.position.x) * Math.min(1, dt * 8); sc.position.z += (q.z - sc.position.z) * Math.min(1, dt * 8);
          if (!sc.visible) { sc.position.x = q.x; sc.position.z = q.z; }
        }
        sc.visible = sc.userData.a > 0.005;
        sc.material.uniforms.uOpacity.value = sc.userData.a;
      });
      // set pieces that run over time
      if (P && (P.rear || 0) > 0.25 && !low) {
        carry.trail += dt * 34 * (P.rear || 0);
        fxD.set(-1, 0, 0).transformDirection(model.matrix);
        while (carry.trail >= 1) {
          carry.trail -= 1;
          for (const j of jets) if (j.dir === 'back') { const q = toRoot(j.p[0] - 0.4, j.p[1], j.p[2]); fx.trail(q.x, q.y, q.z, fxD.x, fxD.y, fxD.z, P.rear); }
        }
      }
      if (P && heat0 > 0.05 && (P.lift || 0) < 0.25) {
        carry.wisp += dt * 7 * heat0;
        while (carry.wisp >= 1) { carry.wisp -= 1; for (const j of lifts) { const q = toRoot(j.p[0], j.p[1] - 0.2, j.p[2]); fx.wisp(q.x, Math.max(0.2, q.y), q.z, heat0); } }
      }
      if (ventT > 0) {
        ventT -= dt;
        for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
          const x = (noise3(fxClock * 40, side * 3 + k, 1.1) - 0.5) * 5.6;
          const q = toRoot(x, hingeY + 1.0 + noise3(fxClock * 30, k, side) * 1.6, side * (ramp.hinge - 0.1));
          fx.vent(q.x, q.y, q.z, 0, side);
        }
      }
      // touchdown shockwave ring: races out and thins
      if (ringT >= 0) {
        ringT += dt;
        const k = ringT / 0.8;
        if (k >= 1) { ringT = -1; ring.visible = false; }
        else {
          const r = 5 + 15 * (1 - (1 - k) * (1 - k));
          ring.visible = true; ring.position.x = model.position.x; ring.position.z = model.position.z;
          ring.scale.set(r, 1, r); ring.material.uniforms.uOpacity.value = 0.55 * (1 - k) * (1 - k);
        }
      }
      // navigation lights
      if (api._nav > 0.01) {
        for (const n of nav) {
          let a;
          if (n.kind === 'steady') a = 0.7 + 0.3 * Math.sin(fxClock * 3.2);
          else { const ph = (fxClock + (n.off || 0)) % 1.4; a = ph < 0.06 || (ph > 0.18 && ph < 0.24) ? 1 : 0; }
          n.s.material.opacity = a * api._nav;
          n.s.scale.setScalar(n.kind === 'strobe' ? 1.2 + 1.4 * a : 1.5);
        }
      }
      shake *= Math.exp(-7 * dt); if (shake < 0.003) shake = 0;

      fx.step(dt, emitters);
      const S = fx.smoke, at = smokeGeo.attributes;
      for (let i = 0; i < S.length; i++) {
        const q = S[i];
        fxTmp.position.set(q.x, q.y, q.z); fxTmp.rotation.set(0, 0, 0); fxTmp.scale.setScalar(q.size); fxTmp.updateMatrix();
        smokeMesh.setMatrixAt(i, fxTmp.matrix);
        at.aAlpha.array[i] = q.alpha; at.aShade.array[i] = q.shade; at.aSeed.array[i] = q.seed; at.aRot.array[i] = q.rot;
        at.aGlow.array[i] = q.glow || 0; at.aWhite.array[i] = q.white || 0;
      }
      smokeMesh.count = S.length; smokeMesh.visible = S.length > 0;
      smokeMesh.instanceMatrix.needsUpdate = true;
      for (const a of ['aAlpha', 'aShade', 'aSeed', 'aRot', 'aGlow', 'aWhite']) at[a].needsUpdate = true;
      const Dd = fx.debris;
      for (let i = 0; i < Dd.length; i++) {
        const q = Dd[i];
        const k = q.size * Math.max(0.05, q.alpha);   // irregular chunks: per-piece proportions, tumbling on all three axes
        fxTmp.position.set(q.x, q.y + q.size * q.dims[1] * 0.5, q.z); fxTmp.rotation.set(q.rx, q.ry, q.rz); fxTmp.scale.set(k * q.dims[0], k * q.dims[1], k * q.dims[2]); fxTmp.updateMatrix();
        debrisMesh.setMatrixAt(i, fxTmp.matrix);
        debrisMesh.setColorAt(i, fxC.copy(debrisCols[Math.floor(q.shade * 3) % 3]).multiplyScalar(q.tint));
      }
      debrisMesh.count = Dd.length; debrisMesh.visible = Dd.length > 0;
      debrisMesh.instanceMatrix.needsUpdate = true; debrisMesh.instanceColor.needsUpdate = true;
      return S.length + Dd.length;
    },
    /** Anything still animating after the pose stops (particles, the shockwave ring, camera shake) — 0 = idle. */
    get fxCount() { return fx.smoke.length + fx.debris.length + (ringT >= 0 ? 1 : 0) + (shake > 0 ? 1 : 0); },
    /** Camera shake (world cells of jitter) from the touchdown and the ramps — the caller adds it to its camera. */
    get shake() { return shake * CRAFT_SCALE; },
    /** Tint the wash toward the world's ground (dust takes the apron's hue). */
    setDust(hex) { smokeMat.uniforms.uColor.value.set(hex); },
    clearFx() {
      fx.clear(); smokeMesh.count = 0; debrisMesh.count = 0; ringT = -1; ring.visible = false; shake = 0; ventT = 0; prevT = -1;
      for (const s of scorch) { s.userData.a = 0; s.visible = false; }
      for (const p of pools) p.visible = false;
    },
    /** Turn the roof weapon toward a world yaw (radians, three's convention), or idle-sweep when null. */
    aim(worldYaw, dt) {
      if (!groups.weapon) return;
      const modelYaw = model.rotation.y;
      let goal;
      if (worldYaw == null) { idle += dt || 0; goal = Math.sin(idle * 0.45) * 0.9; } else goal = worldYaw - modelYaw;
      let d = ((goal - aimYaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      aimYaw += Math.max(-1, Math.min(1, d)) * Math.min(1, (dt || 0) * 3);
      groups.weapon.rotation.y = aimYaw;
    },
    /** Pitch the roof gun toward `pitch` (radians, + = up; null = level) at the model's rate. [MM-story_mvedy2wj_a] */
    elevate(pitch, dt) {
      const B = groups.barrel, lim = def.barrel;
      if (!B || !lim) return;
      const D = Math.PI / 180, want = pitch == null ? 0 : Math.max(lim.min * D, Math.min(lim.max * D, pitch));
      const step = lim.rate * Math.max(0, Math.min(0.1, dt || 0));
      B.rotation.z += Math.max(-step, Math.min(step, want - B.rotation.z));
    },
    /** Current gun pitch (radians), 0 without a pitching gun. */
    get pitch() { return groups.barrel ? groups.barrel.rotation.z : 0; },
    /** World position (cells) of the roof gun's muzzle — where the base cannon's shell leaves. [MM-task_mvbvpyer_x] */
    muzzleWorld() {
      root.updateMatrixWorld(true);
      if (groups.barrel && def.muzzle) {   // the tip of the (pitched) gun
        const p = def.muzzle, b = parts.barrel.pivot;
        const v = new THREE.Vector3(p[0] - b[0], p[1] - b[1], p[2] - b[2]).applyMatrix4(groups.barrel.matrixWorld);
        return { x: v.x, y: v.y, z: v.z };
      }
      const g = groups.weapon || model;
      const v = new THREE.Vector3(2.4, 0.35, 0).applyMatrix4(g.matrixWorld);
      return { x: v.x, y: v.y, z: v.z };
    },
    /** Sweep or spin the head (seconds of clock). */
    scan(t) {
      if (!groups.head) return;
      const H = def.head || {};
      groups.head.rotation[H.axis || 'y'] = H.mode === 'spin' ? t * (H.speed || 2) : Math.sin(t * 1.25) * 0.9;
    },
    /** A ramp point in WORLD units (cells): side +1 = the +Z hatch, −1 = the −Z hatch; local {z, y} from landing.js. */
    toWorld(local) {
      const v = new THREE.Vector3(local.x || 0, local.y || 0, local.z || 0);
      model.updateMatrix(); v.applyMatrix4(model.matrix); v.multiplyScalar(CRAFT_SCALE);
      return { x: root.position.x + v.x, y: v.y, z: root.position.z + v.z };
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      mat.material.dispose(); engineMat.dispose();
      for (const m of disposables) m.dispose();
    },
  };
  return api;
}

/** A 64² radial glow (white, alpha falloff) for flares and nav lights — a DataTexture, so it builds without a DOM. */
function glowTexture(THREE) {
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.min(1, Math.hypot(u, v));
    const a = Math.pow(1 - r, 2.2) * 0.85 + Math.pow(Math.max(0, 1 - r * 3.2), 2) * 0.15;
    const i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(255 * Math.min(1, a));
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/**
 * A soft radial decal for a ground plane (uv 0..1 across it): full at the centre (or a band from `inner` peaking at
 * `mid`), easing to nothing at the rim, with a ragged edge (`rag`). uOpacity drives it.
 */
function softDisc(THREE, color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uInner: { value: o.inner != null ? o.inner : -1 }, uMid: { value: o.mid || 0 }, uRag: { value: o.rag || 0 }, uSeed: { value: o.seed || 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uInner, uMid, uRag, uSeed; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float ang = atan(p.y, p.x);
        float r = length(p) * (1.0 + uRag * (0.08 * sin(ang * 5.0 + uSeed * 7.0) + 0.05 * sin(ang * 11.0 + uSeed * 13.0) + 0.03 * sin(ang * 23.0 + uSeed)));
        float a = (1.0 - smoothstep(uMid, 1.0, r)) * smoothstep(uInner, max(uMid, uInner + 0.001), r);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/**
 * Exhaust flame: an open cylinder whose uv.y runs 1 at the nozzle → 0 at the tip. White-hot at the nozzle cooling to
 * the glow colour, fading to the tip, soft at the silhouette (view-facing normal), with shock bands scrolling away
 * from the nozzle. core = 1 for the inner flame (hotter, tighter), 0 for the outer sheath of expanding gas.
 */
function plumeMaterial(THREE, color, core) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uCore: { value: core } },
    vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        vAlong = 1.0 - uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime, uCore; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = pow(abs(dot(normalize(vN), normalize(vV))), mix(1.6, 0.9, uCore));
        float fade = pow(1.0 - vAlong, mix(1.8, 1.2, uCore));
        float bands = 0.78 + 0.22 * sin(vAlong * 30.0 - uTime * 38.0) * (1.0 - vAlong);
        float hot = (1.0 - smoothstep(0.0, mix(0.25, 0.55, uCore), vAlong)) * mix(0.35, 1.0, uCore);
        vec3 col = mix(uColor, vec3(1.0, 0.97, 0.9), hot) * (1.0 + 0.6 * uCore);
        gl_FragColor = vec4(col, uOpacity * rim * fade * bands);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
