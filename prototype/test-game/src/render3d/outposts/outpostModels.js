/**
 * src/render3d/outposts/outpostModels.js — the outpost building models in the game [MM-story_mw5oeer7_n].
 *
 * Factored from the model review page (outposts.html, story O5 [MM-story_mw5oect7_m]) so the outpost view and the
 * review page load, light and animate the GLBs the same way (tech plan docs/tech-plan/Outpost.md §6.2):
 *   - content/outposts/outposts.json + <slug>_lod{0,1,2}.glb (hub, power, power_ii, storage, shuttle, rig_*,
 *     resourceBay, upgradeBay, habitat, habitat_ii; the farm's farmhouse, silo, pump);
 *   - materials: `ship_body_v2` the hull (one clone per building so its state can tint it), `outpost_trim` the trim
 *     slot (faction colour, design §8.2; Mk II amber), `ship_glow` the cyan emissive (unlit vertex colour);
 *   - looping glTF clips, one per moving node, on an AnimationMixer: played while the building works, stopped when
 *     idle or unpowered; Mk II sets timeScale 2 (design §8.4);
 *   - Mk II look: trim and the cyan lights turn hot amber, 2× tempo, 3× debris with bigger chunks;
 *   - three LODs switched by camera distance (THREE.LOD); the low tier skips LOD0;
 *   - states (structures/models.js lifecycleLook's language): building rises in steps with a cool tint, upgrading a
 *     warm tint, unpowered turns the emissive off.
 * Nodes are found by their `node` extra, never by name (lower LODs carry a `.001` suffix).
 *
 * Browser-only (three.js + GLTFLoader); the pure parts the view needs are in src/outpost/view/*.
 */
export const CYAN = Object.freeze([0.05, 0.42, 1.0]);
export const AMBER = Object.freeze([1.0, 0.45, 0.08]);
export const TRIM = Object.freeze({ verdance: 0xeb5c0d, mk2: 0xffb328 });
const LOD_DIST = [0, 26, 52];

/**
 * The capacity gauge on a building's outside (owner 2026-11-12: "the storage facility should have a capacity level
 * indicator on the outside") [MM-task_mwd3zlwd_6]: a vertical glowing bar in a dark housing on the front face, rising
 * with stored / capacity — green, amber from 80 %, red when full. Colours are linear RGB like CYAN (unlit, toneMapped
 * off, the ship_glow language); the housing is a lit hull material so the sun shades it like the rest of the model.
 */
export const GAUGE = Object.freeze({
  near: 0.8,
  colors: Object.freeze({ ok: Object.freeze([0.1, 0.95, 0.28]), near: Object.freeze([1.0, 0.6, 0.04]), full: Object.freeze([1.0, 0.08, 0.05]) }),
  /** dimmest the bar goes on an unpowered building: ore already stored is never lost, so the level stays readable */
  minGlow: 0.4,
});

/**
 * The gauge's level and colour band from (stored, cap). Pure. → { frac 0..1, band: 'ok' | 'near' | 'full', color }
 * Full uses the rigs' own tolerance (a bay at cap - 1e-6 is full, conduits.js planBuildings).
 */
export function gaugeLevel(stored, cap) {
  const s = Number(stored), c = Number(cap);
  const frac = c > 0 && s > 0 ? Math.min(1, s / c) : 0;
  const band = c > 0 && s >= c - 1e-6 ? 'full' : frac >= GAUGE.near ? 'near' : 'ok';
  return { frac: band === 'full' ? 1 : frac, band, color: GAUGE.colors[band] };
}

/**
 * Where each gauged model carries its gauge, in model units (the GLB's own space, +Z the front the default camera
 * sees): x the bar's centre, y0..y1 its height, z the face it stands proud of, w its width, back (optional) where its
 * housing reaches back to (a column that climbs past a set-back upper block stays attached). A slug with no mount has
 * no gauge. Storage: a tall sight-glass column right of the door, from the plinth up past the lower block to the upper
 * block, big enough to read on the phone's whole-map view; Resource Bay: between its two bay doors.
 */
export const GAUGE_MOUNTS = Object.freeze({
  storage: Object.freeze({ x: 1.42, y0: 0.42, y1: 2.3, z: 1.57, w: 0.56, back: 0.6 }),
  resourceBay: Object.freeze({ x: 0, y0: 0.3, y1: 1.02, z: 1.07, w: 0.24 }),
});

/**
 * The gauge meshes for one mount. → { group, set(frac, glow), dispose() }. set() only scales the bar and recolours its
 * material, so the scene's ~4×/s sync never rebuilds anything.
 */
export function buildGauge(THREE, mount) {
  const { x, y0, y1, z, w } = mount, h = y1 - y0, pad = 0.06, depth = 0.08, back = Math.min(z, mount.back ?? z);
  const group = new THREE.Group();
  group.name = 'outpost-gauge';
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2c3137, roughness: 0.7, metalness: 0.15 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(w + pad * 2, h + pad * 2, z + depth - back).translate(x, y0 + h / 2, (back + z + depth) / 2), housingMat);
  housing.castShadow = true; housing.receiveShadow = true;
  const wellMat = new THREE.MeshBasicMaterial({ color: 0x0a1216 });
  const well = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(x, y0 + h / 2, z + depth + 0.002), wellMat);
  const inset = 0.03, bh = h - inset * 2;
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  // the bar's geometry stands on its own base, so scale.y is the fill
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(w - inset * 2, bh).translate(0, bh / 2, 0), barMat);
  bar.position.set(x, y0 + inset, z + depth + 0.004);
  bar.name = 'outpost-gauge-bar';
  // quarter ticks over the bar, so the level reads at a glance
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x0a1216 });
  const ticks = [0.25, 0.5, 0.75].map((t) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - inset * 2, Math.max(0.018, h * 0.022)).translate(x, y0 + inset + bh * t, z + depth + 0.006), tickMat);
    return m;
  });
  group.add(housing, well, bar, ...ticks);
  let last = null;
  return {
    group, bar,
    get level() { return last; },
    /** frac: stored / capacity (0..1); glow: the building's glow (unpowered dims it, never below GAUGE.minGlow). */
    set(frac, glow = 1) {
      const lv = gaugeLevel(frac, 1), g = Math.max(GAUGE.minGlow, Math.min(1, glow));
      bar.scale.y = Math.max(0.001, lv.frac);
      bar.visible = lv.frac > 0.005;
      barMat.color.setRGB(lv.color[0] * g, lv.color[1] * g, lv.color[2] * g);
      last = { ...lv, glow: g };
      return last;
    },
    dispose() {
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of [housingMat, wellMat, barMat, tickMat]) m.dispose();
    },
  };
}

/** The model slug for an outpost building: rig → its ore's head; power tier 2 → power_ii. */
export function modelSlug(kind, tier, rigHead) {
  if (kind === 'rig') return `rig_${rigHead || 'auger'}`;
  if (kind === 'power') return tier >= 2 ? 'power_ii' : 'power';
  if (kind === 'hub' || kind === 'storage' || kind === 'shuttle') return kind;
  // story O10 / O15: the bays and the Habitat are looked up by kind in content/outposts/outposts.json; until the
  // manifest lists a kind the view draws its placeholder block (outpostScene.js), with no code change when it lands
  if (kind === 'resourceBay' || kind === 'harvesterBay') return 'resourceBay';
  if (kind === 'habitat') return tier >= 2 ? 'habitat_ii' : 'habitat';   // Habitat II: the dome and two pods
  if (kind === 'upgradeBay') return kind;
  // the farm's buildings (Farming-Design §6) are outpost buildings: the same manifest, loader, trim and states
  if (kind === 'farmhouse' || kind === 'silo' || kind === 'pump') return kind;
  return null;   // harvester: the battle's own miner model (harvestDrive.js)
}

/**
 * The model kit: loads the manifest once and each GLB once; make(slug) builds a placed instance (a THREE.LOD with
 * one clone per level). opts: { base (URL of content/outposts/), tier ('high' | 'standard' | 'low'), GLTFLoader }.
 */
export async function createOutpostKit(THREE, { base, tier = 'high', GLTFLoader, trim = TRIM.verdance, bodyLift = 1.5, lodLevels = null } = {}) {
  const manifest = await (await fetch(base + 'outposts.json')).json();
  const loader = new GLTFLoader();
  const files = new Map();
  // Every GLB (every building, every LOD) carries the same three 1024² panel maps (normal, cavity, roughness). Kept
  // apart they cost about 236 MB of GPU memory for a full outpost and iOS kills the tab (owner 2026-11-09 error
  // report: the outpost opens, then the page reloads with no error); shared, one set is about 17 MB.
  const shared = new Map();
  // GLTFLoader hands each material its own texture copy with no name, so the key is the material and slot: every
  // GLB's ship_body_v2 maps the same panel images (outpostModels.test.mjs checks the files stay that way).
  const shareTextures = (gltf) => {
    gltf.scene.traverse((o) => {
      for (const mat of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
        if (!mat.name) continue;
        for (const k of Object.keys(mat)) {
          const t = mat[k];
          if (!t || !t.isTexture) continue;
          const im = t.image || {};
          const key = `${mat.name}|${k}|${im.width || 0}x${im.height || 0}|${t.channel || 0}|${t.flipY}|${t.colorSpace || ''}`;
          const keep = shared.get(key);
          if (!keep) { shared.set(key, t); continue; }
          if (keep !== t) { mat[k] = keep; t.dispose(); }
        }
      }
    });
    return gltf;
  };
  const load = (file) => {
    if (!files.has(file)) files.set(file, new Promise((ok, fail) => loader.load(base + file, (g) => ok(shareTextures(g)), undefined, fail)));
    return files.get(file);
  };
  // lodLevels: the outpost's safe mode on a phone that lost the tab draws the lightest level only
  const levels = Array.isArray(lodLevels) && lodLevels.length ? lodLevels : tier === 'low' ? [1, 2] : [0, 1, 2];
  const glowBase = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  /** Preload every level of these slugs (the view awaits this before its first frame). */
  async function preload(slugs) {
    await Promise.all(slugs.flatMap((s) => (manifest[s] ? levels.map((l) => load(manifest[s].lods[l].file)) : [])));
  }

  /** One level's clone with per-instance materials. → { root, mixer, actions, mats } */
  function cloneLevel(gltf) {
    const root = gltf.scene.clone(true);
    const mats = { body: [], trim: [], glow: [] };
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const name = o.material && o.material.name;
      if (name === 'ship_glow') {
        o.material = glowBase.clone();
        o.castShadow = false;
        o.geometry = o.geometry.clone();   // the Mk II remap writes this building's vertex colours only
        const col = o.geometry.getAttribute('color');
        o.userData.baseColors = col ? col.array.slice() : null;
        mats.glow.push(o);
      } else if (name === 'outpost_trim') {
        o.material = o.material.clone();
        o.material.vertexColors = false;
        mats.trim.push(o.material);
      } else if (o.material) {
        o.material = o.material.clone();
        // the battle view has no environment map and writes linear colour (its own models are vertex-coloured for
        // it): a metal hull with nothing to reflect reads black there. The hull goes nearly dielectric and is lifted
        // to the concept's light grey panels (design §8.1).
        if (bodyLift) { o.material.metalness = 0.12; o.material.color.setScalar(bodyLift); o.material.envMapIntensity = 0; }
        o.userData.baseColor = o.material.color.clone();
        mats.body.push(o);
      }
    });
    const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
    const actions = mixer ? gltf.animations.map((c) => mixer.clipAction(c)) : [];
    return { root, mixer, actions, mats };
  }

  /**
   * A placed building. → { object (add to the scene), slug, anchors: { name: Object3D }, nodes: { node: Object3D },
   *   setWorking(on), setLook({ mk2, trim, tint: [r,g,b], glow: 0..1, rise: 0..1 }), update(dt, camera), dispose() }
   */
  async function make(slug) {
    const m = manifest[slug];
    if (!m) return null;
    const gltfs = await Promise.all(levels.map((l) => load(m.lods[l].file)));
    const lod = new THREE.LOD();
    lod.name = `outpost-${slug}`;
    const L = gltfs.map((g, i) => { const c = cloneLevel(g); lod.addLevel(c.root, LOD_DIST[levels[i]] * (tier === 'low' ? 0.75 : 1)); return c; });
    const holder = new THREE.Group();
    holder.add(lod);
    // the capacity gauge (storage, the Resource Bay's hopper): outside the LOD so every level and tier carries it
    const gauge = GAUGE_MOUNTS[slug] ? buildGauge(THREE, GAUGE_MOUNTS[slug]) : null;
    let gaugeFrac = 0;
    if (gauge) holder.add(gauge.group);
    // anchors and nodes from the most detailed level (positions are the same on every level)
    const anchors = {}, nodes = {};
    L[0].root.traverse((o) => {
      if (o.name.startsWith('anchor_')) anchors[o.name.slice(7).replace(/\.\d+$/, '')] = o;
      const n = o.userData && o.userData.node;
      if (n && (o.userData.pivot || !nodes[n])) nodes[n] = o;
    });
    const nodesOf = (name) => L.map((c) => { let f = null; c.root.traverse((o) => { if (o.userData && o.userData.node === name && (o.userData.pivot || !f)) f = o; }); return f; }).filter(Boolean);
    let working = false, mk2 = false, look = { tint: [1, 1, 1], glow: 1, rise: 1, trim };
    const api = {
      object: holder, lod, slug, anchors, nodes, nodesOf, def: m, gauge,
      get working() { return working; }, get mk2() { return mk2; },
      setWorking(on) {
        if (on === working) return;
        working = on;
        for (const c of L) {
          if (!c.mixer) continue;
          if (on) for (const a of c.actions) a.play();
          else { c.mixer.stopAllAction(); c.mixer.update(0); }
        }
      },
      setLook(next = {}) {
        if (next.mk2 !== undefined && next.mk2 !== mk2) { mk2 = !!next.mk2; remapGlow(); }
        look = { ...look, ...next };
        for (const c of L) {
          if (c.mixer) c.mixer.timeScale = mk2 ? 2 : 1;
          for (const t of c.mats.trim) {
            t.color.set(mk2 ? TRIM.mk2 : look.trim);
            t.emissive.set(mk2 ? 0xff7a10 : 0x000000);
            t.emissiveIntensity = mk2 ? 0.35 : 0;
            t.color.multiply(tintColor(look.tint));
          }
          for (const o of c.mats.body) o.material.color.copy(o.userData.baseColor).multiply(tintColor(look.tint));
          for (const o of c.mats.glow) o.material.color.setScalar(Math.max(0.05, look.glow));
        }
        lod.scale.set(1, Math.max(0.05, look.rise), 1);
        if (gauge) { gauge.group.scale.y = lod.scale.y; gauge.set(gaugeFrac, look.glow); }
      },
      /** The capacity gauge's fill (stored / capacity, 0..1); a model with no gauge mount ignores it. → its level */
      setGauge(frac) {
        if (!gauge) return null;
        gaugeFrac = Number.isFinite(frac) ? frac : 0;
        return gauge.set(gaugeFrac, look.glow);
      },
      update(dt, camera) {
        if (camera) lod.update(camera);
        for (let i = 0; i < L.length; i++) if (L[i].mixer && working && L[i].root.visible) L[i].mixer.update(dt);
      },
      dispose() {
        if (gauge) gauge.dispose();
        for (const c of L) c.root.traverse((o) => { if (o.isMesh) { if (o.userData.baseColors) o.geometry.dispose(); o.material.dispose(); } });
      },
    };
    const tc = new THREE.Color();
    function tintColor(t) { return tc.setRGB(t[0], t[1], t[2]); }
    function remapGlow() {
      for (const c of L) {
        for (const o of c.mats.glow) {
          const col = o.geometry.getAttribute('color'), src = o.userData.baseColors;
          if (!col || !src) continue;
          const n = col.itemSize;
          for (let i = 0; i < col.count; i++) {
            const r = src[i * n], g = src[i * n + 1], b = src[i * n + 2];
            // the cyan lights (and their dim blue shade) turn amber, keeping their brightness; ore, brine and beam
            // colours (not blue) keep theirs
            const blue = b > 0.4 && b > r * 2.5 && b > g * 1.3, k = b / CYAN[2];
            const v = mk2 && blue ? [AMBER[0] * k, AMBER[1] * k, AMBER[2] * k] : [r, g, b];
            col.array[i * n] = v[0]; col.array[i * n + 1] = v[1]; col.array[i * n + 2] = v[2];
          }
          col.needsUpdate = true;
        }
      }
    }
    api.setLook({});
    return api;
  }
  return { manifest, preload, make, levels };
}

/**
 * Ore debris (design §8.4): rock chips and ore chunks in the ore's colour flying from a working rig's debris anchors,
 * about 3× the rate and bigger under Mk II. One instanced mesh for every rig; also the SELL sequence's ore splatter.
 * Seeded (no Math.random), so a recorded review run repeats.
 */
export function createOreDebris(THREE, scene, { cap = 500, seed = 7 } = {}) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, flatShading: true }), cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0; mesh.castShadow = false; mesh.frustumCulled = false;
  mesh.name = 'outpost-ore-debris';
  scene.add(mesh);
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const parts = [], dummy = new THREE.Object3D(), col = new THREE.Color();
  return {
    mesh, rnd,
    /** One chunk at (x, y, z): colour (hex or css), speed out, size, upward speed. */
    emit(x, y, z, colour, { out = 1, size = 0.06, up = 1.8, life = 0.9, floor = 0 } = {}) {
      if (parts.length >= cap) return;
      const ang = rnd() * Math.PI * 2, o = out * (0.4 + rnd() * 0.8);
      parts.push({ x, y, z, vx: Math.cos(ang) * o, vy: up * (0.6 + rnd() * 0.7), vz: Math.sin(ang) * o, s: size * (0.6 + rnd() * 0.8),
        life: life * (0.8 + rnd() * 0.5), t: 0, spin: rnd() * 8, c: colour, floor });
    },
    update(dt) {
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.t += dt;
        if (q.t >= q.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        q.vy -= 9 * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.y < q.floor + q.s / 2) { q.y = q.floor + q.s / 2; q.vy *= -0.32; q.vx *= 0.6; q.vz *= 0.6; }
      }
      for (const q of parts) {
        dummy.position.set(q.x, q.y, q.z);
        dummy.rotation.set(q.spin * q.t, q.spin * q.t * 0.7, 0);
        dummy.scale.setScalar(q.s * Math.min(1, (q.life - q.t) * 4));
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        mesh.setColorAt(n, col.set(q.c));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return n;
    },
    get live() { return parts.length; },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); },
  };
}
