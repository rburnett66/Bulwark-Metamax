/**
 * src/outpost/view/outpostScene.js — the outpost's 3D layers on top of the battle renderer [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1–§6.5. The battle renderer (render3d/index.js) draws the map's ground,
 * palette, decor, rocks, resource fields and the defenses (its System structures: STR-MG, Cannon, Wall, darkened by
 * wear). This module adds:
 *   - pad plates: dark chamfered slabs with orange corner trim; an empty pad shows a faint cyan frame;
 *   - the buildings from the O5 GLBs at their pads (render3d/outposts/outpostModels.js), in their states;
 *   - conduits: two thin emissive tubes per link with a pulse running to the building, dark when unpowered — one
 *     merged mesh per state (2 draw calls);
 *   - ore deposits: a rocky outcrop with a crystalline core in the ore's colour; a cut face under a rig; a locked tier
 *     dim with a lock;
 *   - effects: mining debris at working rigs (3× and bigger on Mk II), the storage hologram's fill, the reactor pulse,
 *     the SELL sequence (crates on the conduit, shuttle with engine FX, ore splatter, "$N" pops);
 *   - overlays: the defense ring while placing a defense, a station's reach ring while building.
 * Browser-only. The plans it draws are pure (conduits.js).
 */
import { planConduits, planBuildings, planDeposits } from './conduits.js';
import { modelSlug, createOreDebris } from '../../render3d/outposts/outpostModels.js';
import { createEngineFx } from '../../render3d/ships/engineFx.js';
import { K as FXK } from '../../render3d/fx/impacts.js';
import { popColour } from './sellTimeline.js';
import { structureDef } from '../../data/outpost.js';
import { padModelScale } from '../../terrain/outpostPads.js';

const PAD_Y = 0.05;
const C = { plate: 0x3b4047, plateTop: 0x4a5058, edge: 0x24282d, trim: 0xeb5c0d, cyan: 0x3fd0ff, rock: 0x8a8076, rockDark: 0x6a625b };

export function createOutpostScene(THREE, r, { map, kit, tier = 'high', reduced = false }) {
  const scene = r.scene, root = new THREE.Group();
  root.name = 'outpost';
  scene.add(root);
  const debris = createOreDebris(THREE, root, { cap: tier === 'low' ? 160 : 500 });
  const pads = new Map(map.pads.map((p) => [p.id, p]));
  const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  let clock = 0, seq = 0;

  // ── pad plates (static): one merged mesh for the slabs, one for the trim, one for the empty-pad frames ────────────
  const plates = buildPlates();
  root.add(plates.group);
  function buildPlates() {
    const g = new THREE.Group();
    const slab = [], trim = [];
    for (const p of map.pads) {
      const [cx, cz] = centre(p);
      const w = p.w - 0.24, d = p.h - 0.24;
      // a chamfered slab: a 4-sided frustum turned 45° is a square with sloped sides
      const geo = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.96, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
      geo.scale(w, 0.12, d).translate(cx, 0.06 - 0.02, cz);
      slab.push(geo);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // orange corner ticks (L shapes)
        const x = cx + sx * (w / 2 - 0.32), z = cz + sz * (d / 2 - 0.32);
        trim.push(new THREE.BoxGeometry(0.62, 0.05, 0.12).translate(x, 0.12, z + sz * 0.25));
        trim.push(new THREE.BoxGeometry(0.12, 0.05, 0.62).translate(x + sx * 0.25, 0.12, z));
      }
    }
    const slabMesh = new THREE.Mesh(mergeGeos(THREE, slab), new THREE.MeshStandardMaterial({ color: C.plate, roughness: 0.82, metalness: 0.15 }));
    slabMesh.receiveShadow = true; slabMesh.name = 'outpost-pads';
    const trimMesh = new THREE.Mesh(mergeGeos(THREE, trim), new THREE.MeshStandardMaterial({ color: C.trim, roughness: 0.5, emissive: C.trim, emissiveIntensity: 0.15 }));
    trimMesh.name = 'outpost-pad-trim';
    g.add(slabMesh, trimMesh);
    return { group: g, slabMesh, trimMesh };
  }
  // empty-pad frames: a thin cyan square per empty pad (rebuilt when pads fill)
  const frameMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
  let frames = null, framesSig = '';
  function syncFrames(o) {
    const empty = map.pads.filter((p) => !o.pads[p.id] && !o.building.some((b) => b.pad === p.id));
    const sig = empty.map((p) => p.id).join(',');
    if (sig === framesSig) return;
    framesSig = sig;
    if (frames) { root.remove(frames); frames.geometry.dispose(); frames = null; }
    if (!empty.length) return;
    const geos = [];
    for (const p of empty) {
      const [cx, cz] = centre(p), w = p.w - 0.9, d = p.h - 0.9, t = 0.07;
      geos.push(new THREE.BoxGeometry(w, 0.02, t).translate(cx, 0.13, cz - d / 2), new THREE.BoxGeometry(w, 0.02, t).translate(cx, 0.13, cz + d / 2),
        new THREE.BoxGeometry(t, 0.02, d).translate(cx - w / 2, 0.13, cz), new THREE.BoxGeometry(t, 0.02, d).translate(cx + w / 2, 0.13, cz),
        new THREE.BoxGeometry(0.7, 0.02, 0.12).translate(cx, 0.13, cz), new THREE.BoxGeometry(0.12, 0.02, 0.7).translate(cx, 0.13, cz));   // "+"
    }
    frames = new THREE.Mesh(mergeGeos(THREE, geos), frameMat);
    frames.name = 'outpost-empty-pads';
    root.add(frames);
  }

  // ── conduits: two merged meshes (powered with a pulse, unpowered dark) ─────────────────────────────────────────────
  const conduitOn = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(C.cyan) } },
    vertexShader: 'attribute float aS; varying float vS; void main(){ vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uCol; varying float vS; void main(){ float p = fract(vS * 0.33 - uTime * 0.9); float pulse = smoothstep(0.0,0.12,p) * (1.0 - smoothstep(0.12,0.42,p)); gl_FragColor = vec4(uCol * (0.75 + 1.4 * pulse) + vec3(pulse * 0.35), 1.0); }',
    toneMapped: false,
  });
  const conduitOff = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.6, metalness: 0.3 });
  let conduits = { on: null, off: null, sig: '' };
  function syncConduits(o) {
    const plan = planConduits(o, map);
    const sig = plan.map((c) => `${c.from}>${c.to}:${c.powered ? 1 : 0}`).join('|');
    if (sig === conduits.sig) return plan;
    for (const k of ['on', 'off']) if (conduits[k]) { root.remove(conduits[k]); conduits[k].geometry.dispose(); }
    conduits = { on: null, off: null, sig };
    const build = (list) => {
      const geos = [];
      for (const c of list) {
        let s0 = 0;
        for (let i = 1; i < c.points.length; i++) {
          const [ax, az] = c.points[i - 1], [bx, bz] = c.points[i], len = Math.hypot(bx - ax, bz - az);
          if (len < 0.01) continue;
          const ang = Math.atan2(-(bz - az), bx - ax), nx = -(bz - az) / len, nz = (bx - ax) / len;
          for (const side of [-1, 1]) {
            const g = new THREE.BoxGeometry(len + 0.1, 0.07, 0.07).toNonIndexed();
            const pos = g.getAttribute('position'), aS = new Float32Array(pos.count);
            for (let v = 0; v < pos.count; v++) aS[v] = s0 + (pos.getX(v) + len / 2);   // distance from the station
            g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
            g.rotateY(ang).translate((ax + bx) / 2 + nx * side * 0.13, 0.1, (az + bz) / 2 + nz * side * 0.13);
            geos.push(g);
          }
          s0 += len;
        }
      }
      return geos.length ? mergeGeos(THREE, geos, ['aS']) : null;
    };
    const on = build(plan.filter((c) => c.powered)), off = build(plan.filter((c) => !c.powered));
    if (on) { conduits.on = new THREE.Mesh(on, conduitOn); conduits.on.name = 'outpost-conduits-on'; root.add(conduits.on); }
    if (off) { conduits.off = new THREE.Mesh(off, conduitOff); conduits.off.name = 'outpost-conduits-off'; root.add(conduits.off); }
    return plan;
  }

  // ── deposits: outcrops, merged per state ───────────────────────────────────────────────────────────────────────
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  const crystalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.1, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.12 });
  let deposits = { group: null, sig: '' };
  function syncDeposits(o, unlockedTiers) {
    const plan = planDeposits(o, map, unlockedTiers);
    const sig = plan.map((d) => `${d.pad}:${d.locked ? 1 : 0}${d.mined ? 1 : 0}`).join('|');
    if (sig === deposits.sig) return plan;
    if (deposits.group) { root.remove(deposits.group); deposits.group.traverse((x) => x.geometry && x.geometry.dispose()); }
    const g = new THREE.Group(); g.name = 'outpost-deposits';
    const rocks = [], crystals = [], locks = [];
    for (const d of plan) {
      let h = hash(d.pad);
      const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return h / 4294967296; };
      const dim = d.locked ? 0.62 : 1, oc = new THREE.Color(d.colour);
      // a rig stands on it: a low cut face at the pad's front edge, where the rig works; else the whole outcrop
      const ps = padModelScale(pads.get(d.pad));   // the outcrop at its pad's scale (half scale, owner 2026-11-08)
      const cx = d.x, cz = d.mined ? d.z + 1.62 * ps : d.z, spread = (d.mined ? 1.3 : 1.35) * ps, k = (d.mined ? 0.55 : 1) * ps;
      const nRock = d.mined ? 5 : 8, nCrys = d.mined ? 4 : 6;
      for (let i = 0; i < nRock; i++) {
        const s = (0.32 + rnd() * 0.42) * k;
        const geo = new THREE.IcosahedronGeometry(1, 0).scale(s * (1 + rnd() * 0.4), s * (0.6 + rnd() * 0.5), s);
        const a = rnd() * Math.PI * 2, rr = spread * (0.35 + rnd() * 0.65);
        geo.rotateY(rnd() * 3).translate(cx + Math.cos(a) * rr * (d.mined ? 1.2 : 1), s * 0.35, cz + Math.sin(a) * rr * (d.mined ? 0.25 : 1));
        rocks.push(colorize(THREE, geo, new THREE.Color(i % 3 ? C.rock : C.rockDark).multiplyScalar(dim)));
      }
      for (let i = 0; i < nCrys; i++) {
        const s = (0.16 + rnd() * 0.16) * k, hgt = (0.7 + rnd() * 0.9) * k * (d.tier === 'rare' ? 1.3 : 1);
        const geo = new THREE.OctahedronGeometry(1, 0).scale(s, hgt, s);
        const a = rnd() * Math.PI * 2, rr = spread * 0.45 * rnd();
        geo.rotateZ((rnd() - 0.5) * 0.7).rotateX((rnd() - 0.5) * 0.5).translate(cx + Math.cos(a) * rr * (d.mined ? 1.6 : 1), hgt * 0.55, cz + Math.sin(a) * rr * (d.mined ? 0.2 : 1));
        const c = (d.locked ? oc.clone().lerp(new THREE.Color(0x9aa2ab), 0.6) : oc.clone().lerp(new THREE.Color(0xffffff), i % 2 ? 0.3 : 0.05)).multiplyScalar(dim * 1.15);
        crystals.push(colorize(THREE, geo, c));
      }
      if (d.locked) {   // a padlock over the dim outcrop
        const lx = cx, ly = 2.0 * ps, lz = cz;
        locks.push(new THREE.BoxGeometry(0.62, 0.5, 0.2).scale(ps, ps, ps).translate(lx, ly, lz), new THREE.TorusGeometry(0.2, 0.06, 6, 12, Math.PI).scale(ps, ps, ps).translate(lx, ly + 0.25 * ps, lz));
      }
    }
    if (rocks.length) { const m = new THREE.Mesh(mergeGeos(THREE, rocks, [], true), rockMat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    if (crystals.length) { const m = new THREE.Mesh(mergeGeos(THREE, crystals, [], true), crystalMat); m.castShadow = true; g.add(m); }
    if (locks.length) g.add(new THREE.Mesh(mergeGeos(THREE, locks), new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.6, emissive: 0x30363d })));
    root.add(g);
    deposits = { group: g, sig };
    r.lights.invalidateShadows();
    return plan;
  }

  // ── buildings ──────────────────────────────────────────────────────────────────────────────────────────────────
  const built = new Map();   // pad → { slug, inst, loading }
  const bayMat = new THREE.MeshStandardMaterial({ color: 0xd9dee4, roughness: 0.6, metalness: 0.2 });
  /** Has the model kit a GLB for this slug (content/outposts/outposts.json)? Else the placeholder block draws. */
  const hasModel = (slug) => !!(slug && kit.manifest && kit.manifest[slug]);
  function placeholderBay(kind) {   // Resource / Upgrade Bay and the Habitat until outposts.json lists their GLBs
    if (kind === 'habitat') return placeholderHabitat();
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * 0.95, 1.7, 0.35, 4).rotateY(Math.PI / 4).scale(1.35, 1, 1.35).translate(0, 0.17, 0), new THREE.MeshStandardMaterial({ color: 0x34393f, roughness: 0.8 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, kind === 'upgradeBay' ? 0.9 : 1.3, 2.2).translate(0, kind === 'upgradeBay' ? 0.8 : 1.0, -0.2), bayMat);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.14, 2.24).translate(0, kind === 'upgradeBay' ? 1.05 : 1.45, -0.2), new THREE.MeshStandardMaterial({ color: C.trim }));
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8).translate(0, 0.75, 0.91), new THREE.MeshBasicMaterial({ color: C.cyan, toneMapped: false }));
    for (const m of [base, body, stripe]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(base, body, stripe, door);
    return { object: g, slug: kind, anchors: {}, nodes: {}, nodesOf: () => [], setWorking() {}, setLook(l = {}) { g.scale.y = Math.max(0.05, l.rise ?? 1); door.material.color.setScalar(Math.max(0.05, l.glow ?? 1)).multiply(new THREE.Color(C.cyan)); }, update() {}, dispose() {} };
  }
  function placeholderHabitat() {   // the Habitat (story O15): a low dome of living quarters with lit windows
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * 0.95, 1.7, 0.35, 4).rotateY(Math.PI / 4).scale(1.35, 1, 1.35).translate(0, 0.17, 0), new THREE.MeshStandardMaterial({ color: 0x34393f, roughness: 0.8 }));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.8, 1).translate(0, 0.35, 0), bayMat);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.14, 24).translate(0, 0.42, 0), new THREE.MeshStandardMaterial({ color: C.trim }));
    const win = new THREE.MeshBasicMaterial({ color: C.cyan, toneMapped: false });
    const lights = [];
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.05), win); w.position.set(Math.sin(a) * 1.3, 0.78, Math.cos(a) * 1.0); w.rotation.y = a; lights.push(w); }
    for (const m of [base, dome, ring]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(base, dome, ring, ...lights);
    return { object: g, slug: 'habitat', anchors: {}, nodes: {}, nodesOf: () => [], setWorking() {}, setLook(l = {}) { g.scale.y = Math.max(0.05, l.rise ?? 1); win.color.setScalar(Math.max(0.05, l.glow ?? 1)).multiply(new THREE.Color(C.cyan)); }, update() {}, dispose() {} };
  }
  /**
   * The Storage Tower's door (owner 2026-11-07 07:33: "a storage tower with no electricity has a closed door"): the
   * model's `door` node when the GLB has one — open slides it up into the lintel, closed brings it down — else the
   * shutter drawn over the door anchor (setWarnings). → true when the model drove it.
   */
  function setDoor(inst, closed) {
    const nodes = inst && inst.nodesOf ? inst.nodesOf('door') : [];
    if (!nodes.length) return false;
    for (const n of nodes) {
      if (!n.userData.doorRest) n.userData.doorRest = { y: n.position.y, sy: n.scale.y };
      const r0 = n.userData.doorRest;
      n.scale.y = closed ? r0.sy : r0.sy * 0.08;
      n.position.y = closed ? r0.y : r0.y + 0.6;
    }
    return true;
  }
  async function ensureBuilding(item) {
    const slug = modelSlug(item.kind, item.tier, item.rigHead) || item.kind;
    const cur = built.get(item.pad);
    if (cur && cur.slug === slug) return cur;
    if (cur && cur.loading === slug) return null;
    const entry = { slug, loading: slug, inst: null };
    built.set(item.pad, entry);
    const inst = hasModel(modelSlug(item.kind, item.tier, item.rigHead)) ? await kit.make(slug) : placeholderBay(item.kind);
    if (built.get(item.pad) !== entry) { if (inst) inst.dispose(); return null; }
    if (cur && cur.inst) { root.remove(cur.holder || cur.inst.object); cur.inst.dispose(); }
    entry.inst = inst; entry.loading = null;
    if (inst) {
      // the model sits in a holder scaled to its pad (half scale, owner 2026-11-08: padModelScale), so the model's own
      // scale stays free for its look (rise) and its anchors still read in world space
      const p = pads.get(item.pad), [cx, cz] = centre(p), holder = new THREE.Group();
      holder.position.set(cx, PAD_Y + 0.07, cz);
      holder.scale.setScalar(padModelScale(p));
      holder.userData.pad = item.pad; holder.name = `outpost-building-${item.pad}`;
      inst.object.userData.pad = item.pad;
      holder.add(inst.object);
      entry.holder = holder;
      root.add(holder);
      r.lights.invalidateShadows();
    }
    return entry;
  }
  let lastLook = new Map();
  function syncBuildings(o, now) {
    const plan = planBuildings(o, map, now), keep = new Set();
    for (const item of plan) {
      keep.add(item.pad);
      const e = built.get(item.pad);
      const slug = modelSlug(item.kind, item.tier, item.rigHead) || item.kind;
      if (!e || (e.slug !== slug && e.loading !== slug)) { ensureBuilding(item); continue; }
      if (!e.inst) continue;
      const lk = `${item.rise.toFixed(2)}:${item.tint.join()}:${item.mk2}`;
      if (lastLook.get(item.pad) !== lk) { lastLook.set(item.pad, lk); r.lights.invalidateShadows(); }
      e.inst.setLook({ tint: item.tint, rise: item.rise, mk2: item.mk2, glow: item.glow * (item.kind === 'power' && item.working ? 0.88 + 0.22 * Math.sin(clock * 2.6) : 1) });
      e.inst.setWorking(item.working);
      e.item = item;
      if (item.kind === 'storage') {
        setHologram(e.inst, sale && sale.fillFrom != null ? item.fill + (sale.fillFrom - item.fill) * sale.drain : item.fill);
        e.hasDoor = setDoor(e.inst, !!item.unpowered || !!item.building);
      }
    }
    for (const [pad, e] of built) if (!keep.has(pad)) { if (e.inst) { root.remove(e.holder || e.inst.object); e.inst.dispose(); } built.delete(pad); lastLook.delete(pad); r.lights.invalidateShadows(); }
    return plan;
  }
  function setHologram(inst, fill) {
    for (const n of inst.nodesOf('hologram')) { n.scale.y = Math.max(0.04, fill); n.visible = fill > 0.01; }
  }
  const hubEntry = () => { for (const e of built.values()) if (e.inst && e.slug === 'hub') return e; return null; };

  // ── effects: mining debris ───────────────────────────────────────────────────────────────────────────────────
  const wp = new THREE.Vector3();
  let debrisCarry = 0;
  const ORE_RGB = new Map();
  function stepDebris(dt) {
    for (const e of built.values()) {
      if (!e.inst || !e.item || e.item.kind !== 'rig' || !e.item.working) continue;
      const anchors = Object.entries(e.inst.anchors).filter(([k]) => k.startsWith('debris')).map(([, v]) => v);
      if (!anchors.length) continue;
      const mk2 = e.item.mk2, rate = (mk2 ? 42 : 14) * (tier === 'low' ? 0.5 : 1);
      e.carry = (e.carry || 0) + dt * rate;
      const ore = (planDepositsCache.find((d) => d.pad === e.item.pad) || {}).colour || '#8a8f96';
      while (e.carry >= 1) {
        e.carry -= 1;
        const a = anchors[Math.floor(debris.rnd() * anchors.length)];
        a.getWorldPosition(wp);
        const c = debris.rnd() < 0.5 ? ore : debris.rnd() < 0.5 ? '#4a4440' : '#5c534c';
        debris.emit(wp.x, wp.y, wp.z, c, { out: mk2 ? 1.2 : 0.8, size: mk2 ? 0.1 : 0.065, up: mk2 ? 2.4 : 1.8, floor: PAD_Y + 0.1 });
        if (debris.rnd() < 0.15 && r.impacts) r.impacts.emit(FXK.DUST, wp.x, wp.y, wp.z, (debris.rnd() - 0.5) * 0.6, 0.4, (debris.rnd() - 0.5) * 0.6, 0.7, 0.05);
      }
    }
    debrisCarry = 0;
    return debris.update(dt);
  }
  let planDepositsCache = [];

  // ── defense sparks: badly worn defenses spit sparks (design §6.2 states) ─────────────────────────────────────────
  function stepSparks(o, dt) {
    if (!r.impacts) return;
    for (const d of o.defenses) {
      const max = (structureDef(d.kind, d.tier).battle || {}).hp || d.hp;
      if (d.hp / max >= 0.4 || debris.rnd() > dt * 2.5) continue;
      const x = d.cell[0] + 0.5, z = d.cell[1] + 0.5;
      for (let i = 0; i < 4; i++) r.impacts.emit(FXK.SPARK, x, 0.55, z, (debris.rnd() - 0.5) * 2.4, 1 + debris.rnd() * 1.5, (debris.rnd() - 0.5) * 2.4, 0.4, 0.02);
    }
  }

  // ── overlays: the defense ring while placing, a station's reach ─────────────────────────────────────────────────
  const ringMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
  let ringMesh = null;
  function showCells(cells) {
    if (ringMesh) { root.remove(ringMesh); ringMesh.geometry.dispose(); ringMesh = null; }
    if (!cells || !cells.length) return;
    ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.84, 0.84).rotateX(-Math.PI / 2), ringMat, cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([x, y], i) => ringMesh.setMatrixAt(i, m.makeTranslation(x + 0.5, 0.09, y + 0.5)));
    ringMesh.name = 'outpost-defense-ring';
    root.add(ringMesh);
  }
  const reachMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  let reach = null;
  function showReach(stations) {   // [{ x, z, r }]
    if (reach) { root.remove(reach); reach.traverse((x) => x.geometry && x.geometry.dispose()); reach = null; }
    if (!stations || !stations.length) return;
    reach = new THREE.Group();
    for (const s of stations) { const m = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.08, s.r, 64).rotateX(-Math.PI / 2), reachMat); m.position.set(s.x, 0.1, s.z); reach.add(m); }
    root.add(reach);
  }
  // a selection marker: a cyan bracket ring under the selected pad / defense
  const selMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  let selMesh = null;
  function select(target) {   // { pad } | { cell } | null
    if (selMesh) { root.remove(selMesh); selMesh.geometry.dispose(); selMesh = null; }
    if (!target) return;
    let x, z, w, d;
    if (target.pad) { const p = pads.get(target.pad); if (!p) return; [x, z] = centre(p); w = p.w; d = p.h; } else { x = target.cell[0] + 0.5; z = target.cell[1] + 0.5; w = d = 1.2; }
    const t = 0.1, L = Math.min(w, d) * 0.28, geos = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = x + sx * w / 2, cz = z + sz * d / 2;
      geos.push(new THREE.BoxGeometry(L, 0.03, t).translate(cx - sx * L / 2, 0.16, cz), new THREE.BoxGeometry(t, 0.03, L).translate(cx, 0.16, cz - sz * L / 2));
    }
    selMesh = new THREE.Mesh(mergeGeos(THREE, geos), selMat);
    root.add(selMesh);
  }

  // ── the build menu's placement [MM-story_mw6k9xec_5]: valid pads glow, the ghost building on the aimed pad ─────────
  // (defenses use the battle renderer's own outline ghost and range ring through renderFrame's ui, and the ring cells)
  const glowMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
  let glowMesh = null;
  function showPads(ids) {
    if (glowMesh) { root.remove(glowMesh); glowMesh.geometry.dispose(); glowMesh = null; }
    if (!ids || !ids.length) return;
    const geos = [];
    for (const id of ids) {
      const p = pads.get(id); if (!p) continue;
      const [cx, cz] = centre(p), w = p.w - 0.5, d = p.h - 0.5, t = 0.16;
      geos.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0.15, cz));
      geos.push(new THREE.BoxGeometry(w, 0.03, t).translate(cx, 0.16, cz - d / 2), new THREE.BoxGeometry(w, 0.03, t).translate(cx, 0.16, cz + d / 2),
        new THREE.BoxGeometry(t, 0.03, d).translate(cx - w / 2, 0.16, cz), new THREE.BoxGeometry(t, 0.03, d).translate(cx + w / 2, 0.16, cz));
    }
    if (!geos.length) return;
    glowMesh = new THREE.Mesh(mergeGeos(THREE, geos), glowMat);
    glowMesh.name = 'outpost-build-pads'; glowMesh.renderOrder = 9;
    root.add(glowMesh);
  }
  const GHOST = { ok: 0x52e8ff, bad: 0xff3a3a };   // the battle ghost's outline colours (overlays/placement.js OUTLINE)
  const ghostBody = new THREE.MeshBasicMaterial({ color: GHOST.ok, transparent: true, opacity: 0.22, depthWrite: true, toneMapped: false });
  const ghostHull = new THREE.MeshBasicMaterial({ color: GHOST.ok, transparent: true, opacity: 0.9, side: THREE.BackSide, depthWrite: false, toneMapped: false });
  const ghosts = new Map();   // slug | kind → { group } (built on first use, kept)
  let ghostShown = null, ghostWant = null;
  async function ghostFor(key, slug, kind) {
    if (ghosts.has(key)) return ghosts.get(key);
    const entry = { group: null };
    ghosts.set(key, entry);
    const inst = hasModel(slug) ? await kit.make(slug) : placeholderBay(kind);
    if (!inst) return entry;
    const body = inst.object, hull = body.clone(true);
    body.traverse((o) => { if (o.isMesh) { o.material = ghostBody; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 10; } });
    hull.traverse((o) => { if (o.isMesh) { o.material = ghostHull; o.castShadow = false; o.renderOrder = 11; } });
    hull.scale.multiplyScalar(1.045);
    const g = new THREE.Group(); g.add(body, hull); g.visible = false; g.name = `outpost-ghost-${key}`;
    root.add(g);
    entry.group = g; entry.inst = inst;
    if (ghostWant && ghostWant.key === key) applyGhost();
    return entry;
  }
  function applyGhost() {
    const want = ghostWant, e = want && ghosts.get(want.key);
    if (ghostShown && ghostShown !== e && ghostShown.group) ghostShown.group.visible = false;
    ghostShown = null;
    if (!want || !e || !e.group) return;
    const p = pads.get(want.pad); if (!p) return;
    const [cx, cz] = centre(p);
    e.group.position.set(cx, PAD_Y + 0.07, cz);
    e.group.scale.setScalar(padModelScale(p));
    e.group.visible = true;
    const c = want.valid ? GHOST.ok : GHOST.bad;
    ghostBody.color.setHex(c); ghostHull.color.setHex(c);
    ghostShown = e;
  }
  /** The ghost building on a pad: { pad, slug (GLB; null → the placeholder block), kind, valid }, or null. */
  function showGhost(g) {
    ghostWant = g ? { ...g, key: g.slug || g.kind } : null;
    if (ghostWant && !ghosts.has(ghostWant.key)) ghostFor(ghostWant.key, g.slug, g.kind);
    applyGhost();
  }

  // ── warnings [MM-story_mw6k9xec_5] (owner 2026-11-07 07:33): a marker over each building with a problem — a bolt for
  // no power, a full crate for storage full — readable on a phone (screen-sized sprites, drawn over everything, a
  // gentle bob); an unpowered Storage Tower shows its door shut (a shutter over the door anchor: the GLB has no door node).
  const markerTex = {};
  function markerTexture(kind) {
    if (markerTex[kind]) return markerTex[kind];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const ring = kind === 'no_power' ? '#ff4a3a' : '#ffb020';
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fillStyle = 'rgba(16,20,26,0.92)'; g.fill();
    g.lineWidth = 9; g.strokeStyle = ring; g.stroke();
    g.save(); g.translate(64, 64); g.scale(3.4, 3.4); g.translate(-10, -10);
    if (kind === 'no_power') {
      g.fillStyle = '#ffd23a'; g.strokeStyle = '#7a4a00'; g.lineWidth = 0.9; g.lineJoin = 'round';
      const p = new Path2D('M11.5 1 3.5 11.5h5L7.5 19l9-11.5h-5.2z'); g.fill(p); g.stroke(p);
    } else {
      g.fillStyle = '#d99a22'; g.strokeStyle = '#3a2400'; g.lineWidth = 0.9;
      g.fillRect(2.5, 6, 15, 11); g.strokeRect(2.5, 6, 15, 11);
      g.beginPath(); g.moveTo(2.5, 10); g.lineTo(17.5, 10); g.moveTo(7.5, 6); g.lineTo(7.5, 17); g.moveTo(12.5, 6); g.lineTo(12.5, 17); g.stroke();
      g.fillStyle = '#f0c050'; g.beginPath(); g.moveTo(4, 6); g.lineTo(6, 2); g.lineTo(14, 2); g.lineTo(16, 6); g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
    const t = new THREE.CanvasTexture(cv);
    markerTex[kind] = t;
    return t;
  }
  const markers = new Map();   // pad → { sprite, kind }
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.7, metalness: 0.4, emissive: 0x3a0806, emissiveIntensity: 0.6 });
  const doors = new Map();     // pad → mesh
  let warnSig = '';
  function setWarnings(w, markerOf) {
    const sig = JSON.stringify(w || {});
    if (sig === warnSig) return;
    warnSig = sig;
    const want = new Map();
    for (const [pad, list] of Object.entries(w || {})) { const k = markerOf(list); if (k && pads.has(pad)) want.set(pad, k); }
    for (const [pad, m] of markers) if (want.get(pad) !== m.kind) { root.remove(m.sprite); m.sprite.material.dispose(); markers.delete(pad); }
    for (const [pad, kind] of want) {
      if (markers.has(pad)) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(kind), depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, toneMapped: false }));
      sp.scale.set(0.058, 0.058, 1); sp.renderOrder = 20; sp.name = `outpost-warning-${pad}`;
      const [cx, cz] = centre(pads.get(pad));
      const e = built.get(pad), h = (e && e.slug && kit.manifest[e.slug] ? kit.manifest[e.slug].height : 1.6) * padModelScale(pads.get(pad));
      sp.userData = { x: cx, y: h + 1.3, z: cz, ph: hash(pad) % 100 / 16 };
      sp.position.set(cx, h + 1.3, cz);
      root.add(sp);
      markers.set(pad, { sprite: sp, kind });
    }
    // the shut door on an unpowered storage tower
    const shut = new Set(Object.entries(w || {}).filter(([, l]) => l.includes('door_closed')).map(([p]) => p));
    for (const [pad, m] of doors) if (!shut.has(pad)) { root.remove(m); m.geometry.dispose(); doors.delete(pad); }
    for (const pad of shut) {
      if (doors.has(pad) || !pads.has(pad)) continue;
      const own = built.get(pad);
      if (own && own.inst && setDoor(own.inst, true)) continue;   // the GLB's own door closes; no shutter
      const [cx, cz] = centre(pads.get(pad));
      const a = (kit.manifest.storage && kit.manifest.storage.anchors && kit.manifest.storage.anchors.door) || [0, 0, 2.3];
      const geos = [new THREE.BoxGeometry(1.5, 1.15, 0.1).translate(0, 0.58, 0)];
      for (let i = 0; i < 3; i++) geos.push(new THREE.BoxGeometry(1.52, 0.08, 0.12).translate(0, 0.25 + i * 0.33, 0.01));
      const m = new THREE.Mesh(mergeGeos(THREE, geos), shutterMat), ps = padModelScale(pads.get(pad));
      m.scale.setScalar(ps);
      m.position.set(cx + a[0] * ps, PAD_Y + 0.07 + a[1] * ps, cz + (a[2] - 0.12) * ps);
      m.name = `outpost-door-shut-${pad}`;
      root.add(m);
      doors.set(pad, m);
    }
    r.lights.invalidateShadows();
  }
  function stepMarkers() {
    for (const { sprite } of markers.values()) {
      const u = sprite.userData;
      sprite.position.y = u.y + (reduced ? 0 : Math.sin(clock * 2.4 + u.ph) * 0.18);
    }
    if (glowMesh) glowMat.opacity = reduced ? 0.3 : 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(clock * 3.2));
  }

  // ── the SELL sequence (sellTimeline.js drives it) ─────────────────────────────────────────────────────────────
  let sale = null, shuttle = null, shuttleFx = null;
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2, emissive: 0x111111 }), 16);
  crateMesh.count = 0; crateMesh.frustumCulled = false; root.add(crateMesh);
  async function ensureShuttle() {
    if (shuttle || !kit.manifest.shuttle) return shuttle;
    shuttle = await kit.make('shuttle');
    if (!shuttle) return null;
    shuttle.object.visible = false;
    // the shadow map is static (re-rendered on change only): a flying shuttle must not bake a shadow onto the pad
    shuttle.object.traverse((x) => { if (x.isMesh) x.castShadow = false; });
    // engine markers on a holder turned so the plume (its −X) points down
    const holder = new THREE.Group(); holder.rotation.z = Math.PI / 2;
    for (const [i, k] of [[0, 'engine_l'], [1, 'engine_r']]) {
      const a = shuttle.def.anchors[k] || [i ? 0.5 : -0.5, 0.3, -0.85];
      const mk = new THREE.Object3D(); mk.name = `engine_${i}`;
      mk.position.set(a[1] + 0.05, -a[0], a[2]);
      mk.userData = { color: [0.35, 0.8, 1.0], radius: 0.22 };
      holder.add(mk);
    }
    shuttle.object.add(holder);
    shuttleFx = createEngineFx(THREE, holder, { pointLight: false });
    holder.add(shuttleFx.group);
    shuttleFx.setIntensity(0);
    root.add(shuttle.object);
    return shuttle;
  }
  function crateRoute(o) {
    const st = Object.keys(o.pads).find((id) => o.pads[id].kind === 'storage'), hub = Object.keys(o.pads).find((id) => o.pads[id].kind === 'hub');
    if (!st || !hub) return null;
    const plan = planConduits(o, map);
    const a = plan.find((c) => c.to === st), b = plan.find((c) => c.to === hub && a && c.from === a.from);
    if (a && b) return [...a.points.slice().reverse(), ...b.points].map(([x, z]) => [x, z]);
    return [centre(pads.get(st)), centre(pads.get(hub))];
  }
  const along = (pts, k) => {
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let d = Math.max(0, Math.min(1, k)) * total;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? d / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= seg[i]; }
    return pts[pts.length - 1];
  };

  /** Start the SELL sequence. tl: sellTimeline(); o: the outpost before the sale (its storage pads, the route). */
  async function playSale(tl, o) {
    const hub = hubEntry();
    const pad = [...pads.values()].find((p) => p.role === 'hub' && o.pads[p.id]);
    const st = planBuildings(o, map, o.t).find((b) => b.kind === 'storage');
    sale = { tl, t: 0, fired: new Set(), drain: 1, route: crateRoute(o), hubPad: pad, hub, id: ++seq, fillFrom: st ? st.fill : null };
    if (!tl.reduced) await ensureShuttle();
    return sale.id;
  }
  const crateCol = new THREE.Color(), dummy = new THREE.Object3D();
  function stepSale(dt, out) {
    if (!sale) return null;
    const s = sale, tl = s.tl;
    s.t += dt;
    const t = s.t;
    s.drain = tl.drainAt(t);
    const [hx, hz] = s.hubPad ? centre(s.hubPad) : [map.width / 2, map.height / 2];
    for (const b of tl.beats) {
      if (b.t > t || s.fired.has(b)) continue;
      s.fired.add(b);
      if (b.type === 'shake') out.shake = { amp: b.amp, until: t + b.dur, t0: t };
      if (b.type === 'lift') r.lights.invalidateShadows();
      if (b.type === 'splatter') {
        const cargo = new THREE.Vector3(hx, 1.0, hz);
        if (shuttle && shuttle.anchors.cargo) shuttle.anchors.cargo.getWorldPosition(cargo);
        for (let i = 0; i < b.count; i++) debris.emit(cargo.x, cargo.y, cargo.z, b.colours[i % b.colours.length], { out: 2.6, size: 0.11, up: 3.2, life: 1.4, floor: 0.78 });
        if (r.impacts) for (let i = 0; i < 8; i++) r.impacts.emit(FXK.DUST, hx, 0.8, hz, (debris.rnd() - 0.5) * 3, 0.6, (debris.rnd() - 0.5) * 3, 0.9, 0.08);
      }
      if (b.type === 'pop') {
        // the pops fan round the landing pad, two to a spot at most, so a big sale stacks short (design §4.3)
        const k = s.pops = (s.pops || 0) + 1, ang = (k - 1) * 2.4, rad = k === 1 ? 0 : 1.6 + 0.35 * ((k - 2) % 3);
        r.gold.feed([{ type: 'deposit', gold: b.gold, pos: { x: hx - 0.5 + Math.cos(ang) * rad, y: hz - 0.5 + Math.sin(ang) * rad * 0.75 } }], r.map);
        const p = r.gold.live[r.gold.live.length - 1];
        if (p) { p.color = popColour(b.colour); p.y0 += 1.7; p.big = true; }
      }
    }
    // crates ride the conduit from the storage tower to the hub
    const cb = tl.beats.find((b) => b.type === 'crates');
    let n = 0;
    if (cb && s.route && t < cb.t + cb.dur + 0.15) {
      for (let i = 0; i < cb.count; i++) {
        const k = (t - cb.t) / cb.dur - i * 0.07;
        if (k < 0 || k > 1) continue;
        const [x, z] = along(s.route, k);
        dummy.position.set(x, 0.3 + Math.sin(k * Math.PI) * 0.25, z);
        dummy.rotation.set(0, k * 4 + i, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
        crateMesh.setMatrixAt(n, dummy.matrix); crateMesh.setColorAt(n, crateCol.set(cb.colours[i % cb.colours.length]));
        n++;
      }
    }
    crateMesh.count = n; crateMesh.instanceMatrix.needsUpdate = true; if (crateMesh.instanceColor) crateMesh.instanceColor.needsUpdate = true;
    // the shuttle: the hub's parked one hides, the flying one lifts, then arcs up and out of frame
    const f = tl.shuttleAt(t);
    if (shuttle && s.hub && s.hub.inst) {
      const parked = s.hub.inst.nodesOf('shuttle');
      if (f.on) {
        for (const nd of parked) nd.visible = false;
        if (!s.base) {   // the flying shuttle takes the parked one's place and size
          const box = new THREE.Box3();
          parked.forEach((nd) => { nd.visible = true; box.expandByObject(nd); nd.visible = false; });
          const sz = box.getSize(new THREE.Vector3()), mine = new THREE.Box3().setFromObject(shuttle.lod.levels[0].object).getSize(new THREE.Vector3());
          const k = sz.x > 0 && mine.x > 0 ? Math.max(sz.x, sz.z) / Math.max(mine.x, mine.z) : 1;
          const c = box.isEmpty() ? new THREE.Vector3(hx, 0.8, hz) : box.getCenter(new THREE.Vector3());
          s.base = { x: c.x, y: box.isEmpty() ? 0.8 : box.min.y, z: c.z, k: Math.min(1.6, Math.max(0.5, k)) };
          if (shuttleFx) shuttleFx.setIntensity(1.2);
        }
        const B = s.base, up = f.lift * 2.4 + f.arc * 26, fwd = f.arc * f.arc * 22;
        shuttle.object.visible = true;
        shuttle.object.scale.setScalar(B.k);
        shuttle.object.position.set(B.x + fwd * 0.35, B.y + up, B.z - fwd);
        shuttle.object.rotation.set(-f.arc * 0.5, Math.PI, Math.sin(t * 7) * 0.02 * (1 - f.arc));
        if (shuttleFx) shuttleFx.setIntensity(1 + f.arc * 0.8);
      } else if (s.base) {
        shuttle.object.visible = false;
        for (const nd of parked) nd.visible = true;
        if (shuttleFx) shuttleFx.setIntensity(0);
      }
    }
    if (t >= tl.duration) {
      if (shuttle) shuttle.object.visible = false;
      if (s.hub && s.hub.inst) for (const nd of s.hub.inst.nodesOf('shuttle')) nd.visible = true;
      crateMesh.count = 0;
      sale = null;
      r.lights.invalidateShadows();
      return { done: true, id: s.id, gold: tl.countAt(t) };
    }
    return { done: false, gold: tl.countAt(t), t };
  }

  // ── picking ──────────────────────────────────────────────────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  /** A tap at NDC (x, y) → { pad } of the building hit (raycast on the models), else null (the caller tries the ground). */
  function pickBuilding(ndc, camera) {
    ray.setFromCamera(ndc, camera);
    const objs = [...built.values()].filter((e) => e.inst).map((e) => e.inst.object);
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) if (o.userData && o.userData.pad) return { pad: o.userData.pad };
    return null;
  }

  return {
    root, debris,
    /** Bring the scene to the outpost's state (call each frame; cheap when nothing changed). */
    sync(o, now, { unlockedTiers } = {}) {
      syncFrames(o);
      syncConduits(o);
      planDepositsCache = syncDeposits(o, unlockedTiers) || planDepositsCache;
      syncBuildings(o, now);
    },
    /** Per frame: animation, debris, conduit pulse, the sale. → { shake?, sale?, debris } */
    update(dt, o) {
      clock += dt;
      conduitOn.uniforms.uTime.value = clock;
      const out = {};
      for (const e of built.values()) if (e.inst) e.inst.update(dt, r.camera);
      if (shuttle) shuttle.update(dt, r.camera);
      if (shuttleFx && shuttle && shuttle.object.visible) shuttleFx.update(dt, r.camera);
      out.sale = stepSale(dt, out);
      out.debris = stepDebris(reduced ? dt * 0.5 : dt);
      if (o) stepSparks(o, dt);
      stepMarkers();
      if (ghostShown && ghostShown.inst) ghostShown.inst.update(dt, r.camera);
      return out;
    },
    playSale, get saling() { return !!sale; },
    pickBuilding, select, showCells, showReach, showPads, showGhost, setWarnings,
    /** Is the ghost drawn now (tests / review)? */
    get ghost() { return ghostShown && ghostShown.group && ghostShown.group.visible ? { pad: ghostWant.pad, valid: ghostWant.valid, key: ghostWant.key } : null; },
    get warningMarkers() { return [...markers].map(([pad, m]) => ({ pad, kind: m.kind })); },
    /** The world position of a pad's centre (cells), for the camera. */
    padCentre(id) { const p = pads.get(id); return p ? centre(p) : null; },
    buildingCount: () => [...built.values()].filter((e) => e.inst).length,
    ready: () => [...built.values()].every((e) => !e.loading),
    dispose() {
      for (const e of built.values()) if (e.inst) e.inst.dispose();
      if (shuttle) shuttle.dispose();
      debris.dispose();
      scene.remove(root);
      root.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    },
  };
}

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h || 1; }

function colorize(THREE, geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** Merge geometries (non-indexed): position, normal, plus colour and extra attributes when asked. */
export function mergeGeos(THREE, geos, extra = [], withColor = false) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const names = ['position', 'normal', ...(withColor ? ['color'] : []), ...extra];
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = list[0].getAttribute(name).itemSize;
    const total = list.reduce((a, g) => a + g.getAttribute(name).count * size, 0);
    const arr = new Float32Array(total);
    let off = 0;
    for (const g of list) { const at = g.getAttribute(name); arr.set(at.array.subarray(0, at.count * size), off); off += at.count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  for (const g of geos) g.dispose();
  return out;
}
