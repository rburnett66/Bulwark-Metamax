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
 *     the SELL sequence (sellTimeline.js: the storage drains, crates ride the conduit, the cargo shuttle lifts off the
 *     landing pad with engine FX and a camera shake, ore splatter, "$N" pops on the battle's own gold popups)
 *     [MM-story_mwefm2or_j];
 *   - the capacity gauge on the Storage Tower and the Resource Bay (the model kit's setGauge, from gaugeFill);
 *   - markers: warnings over buildings, no-power bolts over defenses, the power icons, the preview conduit.
 * Placement, its ghost and range rings, selection and picking are the battle session's own (S6 deleted the old farm
 * view's copies; its SELL sequence lives on here, driven from the session view's sell action by saleDriver.js).
 * Browser-only. The plans it draws are pure (conduits.js).
 */
import { planConduits, planBuildings, planDeposits } from './conduits.js';
import { modelSlug, createOreDebris } from '../../render3d/outposts/outpostModels.js';
import { K as FXK } from '../../render3d/fx/impacts.js';
import { createEngineFx } from '../../render3d/ships/engineFx.js';
import { popColour } from './sellTimeline.js';
import { padModelScale } from '../../terrain/outpostPads.js';

const PAD_Y = 0.05;
const C = { plate: 0x3b4047, plateTop: 0x4a5058, edge: 0x24282d, trim: 0xeb5c0d, cyan: 0x3fd0ff, rock: 0x8a8076, rockDark: 0x6a625b };

/** The locked-deposit padlock's brass. */
export const DEPOSIT_LOCK_BRASS = 0xc9a14a;

/**
 * The capacity gauge's fill for a planned building (planBuildings item) [MM-task_mwd3zlwd_6]: a finished Storage
 * Tower's pooled storage, a Resource Bay's hopper; null for everything else (no gauge drives).
 */
export const gaugeFill = (item) => (item && (item.kind === 'storage' || item.kind === 'resourceBay' || item.kind === 'harvesterBay') && Number.isFinite(item.fill) ? item.fill : null);

/** The power icons worth drawing: only a building that has no power or would be cut — never one that is powered. */
export const visiblePowerIcons = (list) => (list || []).filter((i) => i.state !== 'on');

export function createOutpostScene(THREE, r, { map, kit, tier = 'high', reduced = false }) {
  const scene = r.scene, root = new THREE.Group();
  root.name = 'outpost';
  scene.add(root);
  const debris = createOreDebris(THREE, root, { cap: tier === 'low' ? 160 : 500 });
  // the landing pad is the only fixed spot on an outpost map (S2c.2 [MM-story_mwc9pmbn_2i]: no build pads)
  const pads = new Map(map.hub ? [[map.hub.id, { ...map.hub, role: 'hub' }]] : []);
  // where a building stands: a freely placed one's own rectangle (from planBuildings), else its map pad
  const rects = new Map();
  const rectOf = (id) => rects.get(id) || pads.get(id);
  const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  let clock = 0, seq = 0;

  // ── pad plates (static): one merged mesh for the slabs, one for the trim, one for the empty-pad frames ────────────
  const plates = buildPlates();
  root.add(plates.group);
  function buildPlates() {
    const g = new THREE.Group();
    const slab = [], trim = [];
    for (const p of pads.values()) {
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
    const empty = [...pads.values()].filter((p) => !o.pads[p.id] && !o.building.some((b) => b.pad === p.id));
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
    // the route is in the signature too: a conduit follows the open lanes, so a new wall can move it (conduits.js laneRoute)
    const sig = plan.map((c) => `${c.from}>${c.to}:${c.powered ? 1 : 0}:${c.points.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}`).join('|');
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

  // ── the PREVIEW conduit [MM-story_mwc9plas_2h]: while a power-drawing building is armed, a dashed line from the grid
  // node it would join to the ghost (cyan: it will be powered; amber: the grid is short). One line, rebuilt on change.
  const previewMat = new THREE.LineDashedMaterial({ color: C.cyan, dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
  let preview = { line: null, sig: '' };
  /** plan: { points: [[x, z], …], warn } (conduits.js ghostPower's route) or null to hide. */
  function setPreview(plan) {
    const sig = plan && plan.points ? plan.points.map((p) => p.join(',')).join(';') + (plan.warn ? '!' : '') : '';
    if (sig === preview.sig) return;
    if (preview.line) { root.remove(preview.line); preview.line.geometry.dispose(); preview.line = null; }
    preview.sig = sig;
    if (!sig) return;
    const g = new THREE.BufferGeometry().setFromPoints(plan.points.map(([x, z]) => new THREE.Vector3(x, 0.18, z)));
    previewMat.color.setHex(plan.warn ? 0xffb43c : C.cyan);
    preview.line = new THREE.Line(g, previewMat);
    preview.line.computeLineDistances();
    preview.line.renderOrder = 12;
    preview.line.name = 'outpost-conduit-preview';
    root.add(preview.line);
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
      let h = hash('dep-' + d.tier);
      const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return h / 4294967296; };
      const dim = d.locked ? 0.62 : 1, oc = new THREE.Color(d.colour);
      // a rig stands on it: a low cut face at the pad's front edge, where the rig works; else the whole outcrop
      const ps = padModelScale(d.rect);   // the outcrop at the deposit's (2 × 2) scale (half scale, owner 2026-11-08)
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
    // the padlock is BRASS (owner 2026-11-11: "I see a lock on resources I can't build on so make the lock brass colored")
    if (locks.length) g.add(new THREE.Mesh(mergeGeos(THREE, locks), new THREE.MeshStandardMaterial({ color: DEPOSIT_LOCK_BRASS, roughness: 0.35, metalness: 0.85, emissive: 0x3a2a0c })));
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
      const p = rectOf(item.pad), [cx, cz] = centre(p), holder = new THREE.Group();
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
    for (const item of plan) if (item.rect) rects.set(item.pad, item.rect);
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
      const gf = gaugeFill(item);
      if (gf != null && e.inst.setGauge) e.inst.setGauge(gf);
      if (item.kind === 'storage') {
        setHologram(e.inst, sale && sale.fillFrom != null ? item.fill + (sale.fillFrom - item.fill) * sale.drain : item.fill);
        e.hasDoor = setDoor(e.inst, !!item.unpowered || !!item.building);
      }
    }
    for (const [pad, e] of built) if (!keep.has(pad)) { if (e.inst) { root.remove(e.holder || e.inst.object); e.inst.dispose(); } built.delete(pad); lastLook.delete(pad); r.lights.invalidateShadows(); }
    return plan;
  }
  const hubEntry = () => { for (const e of built.values()) if (e.inst && e.slug === 'hub') return e; return null; };
  function setHologram(inst, fill) {
    for (const n of inst.nodesOf('hologram')) { n.scale.y = Math.max(0.04, fill); n.visible = fill > 0.01; }
  }

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

  // (damaged defenses' sparks and smoke are the shared renderer's: render3d/fx/structureFx.js [MM-story_mwcrfnyf_3c])

  // ── warnings [MM-story_mw6k9xec_5] (owner 2026-11-07 07:33): a marker over each building with a problem — a bolt for
  // no power, a full crate for storage full — readable on a phone (screen-sized sprites, drawn over everything, a
  // gentle bob); an unpowered Storage Tower shows its door shut (a shutter over the door anchor: the GLB has no door node).
  const markerTex = {};
  function markerTexture(kind) {
    if (markerTex[kind]) return markerTex[kind];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    // the bolt kinds: no_power (red ring), power_on (green ring: the power icon of a powered building), power_cut
    // (amber ring: the building an armed placement would switch off) — one bolt glyph, the ring says the state
    const ring = { no_power: '#ff4a3a', power_on: '#3ad27a', power_cut: '#ffb43c' }[kind] || '#ffb020';
    const bolt = kind === 'no_power' || kind === 'power_on' || kind === 'power_cut';
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fillStyle = 'rgba(16,20,26,0.92)'; g.fill();
    g.lineWidth = 9; g.strokeStyle = ring; g.stroke();
    g.save(); g.translate(64, 64); g.scale(3.4, 3.4); g.translate(-10, -10);
    if (bolt) {
      g.fillStyle = kind === 'power_cut' ? '#ffb43c' : '#ffd23a'; g.strokeStyle = '#7a4a00'; g.lineWidth = 0.9; g.lineJoin = 'round';
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
  /** A marker sprite (screen-sized, drawn over everything): the one sprite every outpost marker and icon is made of. */
  function markerSprite(kind, size, name) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(kind), depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, toneMapped: false }));
    sp.scale.set(size, size, 1); sp.renderOrder = 20; sp.name = name;
    return sp;
  }
  /** The top of the model standing at a pad (its GLB's height at the pad's scale), for markers floated over it. */
  function modelHeight(pad) {
    const e = built.get(pad), rect = rectOf(pad);
    return (e && e.slug && kit.manifest[e.slug] ? kit.manifest[e.slug].height : 1.6) * (rect ? padModelScale(rect) : 1);
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
    for (const [pad, list] of Object.entries(w || {})) { const k = markerOf(list); if (k && rectOf(pad)) want.set(pad, k); }
    for (const [pad, m] of markers) if (want.get(pad) !== m.kind) { root.remove(m.sprite); m.sprite.material.dispose(); markers.delete(pad); }
    for (const [pad, kind] of want) {
      if (markers.has(pad)) continue;
      const sp = markerSprite(kind, 0.058, `outpost-warning-${pad}`);
      const [cx, cz] = centre(rectOf(pad));
      const h = modelHeight(pad);
      sp.userData = { x: cx, y: h + 1.3, z: cz, ph: hash(pad) % 100 / 16 };
      sp.position.set(cx, h + 1.3, cz);
      root.add(sp);
      markers.set(pad, { sprite: sp, kind });
    }
    // the shut door on an unpowered storage tower
    const shut = new Set(Object.entries(w || {}).filter(([, l]) => l.includes('door_closed')).map(([p]) => p));
    for (const [pad, m] of doors) if (!shut.has(pad)) { root.remove(m); m.geometry.dispose(); doors.delete(pad); }
    for (const pad of shut) {
      if (doors.has(pad) || !rectOf(pad)) continue;
      const own = built.get(pad);
      if (own && own.inst && setDoor(own.inst, true)) continue;   // the GLB's own door closes; no shutter
      const [cx, cz] = centre(rectOf(pad));
      const a = (kit.manifest.storage && kit.manifest.storage.anchors && kit.manifest.storage.anchors.door) || [0, 0, 2.3];
      const geos = [new THREE.BoxGeometry(1.5, 1.15, 0.1).translate(0, 0.58, 0)];
      for (let i = 0; i < 3; i++) geos.push(new THREE.BoxGeometry(1.52, 0.08, 0.12).translate(0, 0.25 + i * 0.33, 0.01));
      const m = new THREE.Mesh(mergeGeos(THREE, geos), shutterMat), ps = padModelScale(rectOf(pad));
      m.scale.setScalar(ps);
      m.position.set(cx + a[0] * ps, PAD_Y + 0.07 + a[1] * ps, cz + (a[2] - 0.12) * ps);
      m.name = `outpost-door-shut-${pad}`;
      root.add(m);
      doors.set(pad, m);
    }
    r.lights.invalidateShadows();
  }
  // ── POWER ICONS (owner 2026-11-11, #282 answer 1: "buildings have power icons") [MM-subtask_mwco9m19_39]: a small
  //    bolt over every building that draws power (defenses need none, [MM-task_mwcutmnk_3h]) — green ring powered, red ring unpowered, amber ring (and a
  //    pulse) on the one an armed placement would cut. The plan is conduits.js planPowerIcons / withCuts; the sprites
  //    are the warning markers' own (markerSprite). Fixed above the model (no bob), smaller than a warning marker.
  const powerIcons = new Map();   // id → { sprite, state }
  const ICON_KIND = { on: 'power_on', off: 'no_power', cut: 'power_cut' };
  const ICON_SIZE = 0.022;   // a warning marker is 0.058: the icon is a status, not an alarm
  let iconSig = '';
  /** list: planPowerIcons' answer ([{ id, at: [x, z], defense, state }]), or null to clear. */
  function setPowerIcons(all) {
    // a marker only when something is wrong (owner 2026-11-12: "I have energy warnings on every building even with 2
    // generators" — a bolt over every POWERED building read as a warning): unpowered (red) or cut by the armed placement
    // (amber); a powered building shows nothing
    const list = visiblePowerIcons(all);
    const sig = (list || []).map((i) => `${i.id}:${i.state}:${i.at[0]},${i.at[1]}`).join('|');
    if (sig === iconSig) return;
    iconSig = sig;
    const want = new Map((list || []).map((i) => [i.id, i]));
    for (const [id, e] of powerIcons) {
      if (want.has(id) && want.get(id).state === e.state) continue;
      root.remove(e.sprite); e.sprite.material.dispose(); powerIcons.delete(id);
    }
    for (const i of want.values()) {
      let e = powerIcons.get(i.id);
      if (!e) {
        e = { sprite: markerSprite(ICON_KIND[i.state] || 'no_power', ICON_SIZE, `outpost-power-icon-${i.id}`), state: i.state };
        root.add(e.sprite); powerIcons.set(i.id, e);
      }
      const y = i.defense ? 1.55 : modelHeight(i.id) + 0.45;
      e.sprite.userData = { ph: hash(i.id) % 100 / 16 };
      e.sprite.position.set(i.at[0], y, i.at[1]);
    }
  }
  function stepMarkers() {
    for (const e of powerIcons.values()) {
      if (e.state !== 'cut') continue;
      const k = ICON_SIZE * (reduced ? 1.25 : 1.1 + 0.25 * (0.5 + 0.5 * Math.sin(clock * 7 + e.sprite.userData.ph)));
      e.sprite.scale.set(k, k, 1);
    }
    for (const { sprite } of markers.values()) {
      const u = sprite.userData;
      sprite.position.y = u.y + (reduced ? 0 : Math.sin(clock * 2.4 + u.ph) * 0.18);
    }
  }

  // ── the SELL sequence (sellTimeline.js drives it; saleDriver.js runs it from the session view) ──────────────────
  // Restored after S6 [MM-story_mwefm2or_j] (owner 2026-11-12: "when I sell resources I dont see the dollar values or the
  // deliver ship take off"). The "$N" pops are the battle's own gold popups (render3d/overlays/goldPopups.js, one engine).
  let sale = null, shuttle = null, shuttleFx = null, shuttleLoad = null;
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2, emissive: 0x111111 }), 16);
  crateMesh.count = 0; crateMesh.frustumCulled = false; crateMesh.name = 'outpost-sale-crates'; root.add(crateMesh);
  /** The flying shuttle (the model kit's 'shuttle' GLB), loaded once on the first sale; null when the kit has none. */
  function ensureShuttle() {
    if (shuttle || !kit.manifest || !kit.manifest.shuttle) return Promise.resolve(shuttle);
    if (!shuttleLoad) shuttleLoad = Promise.resolve(kit.make('shuttle')).then((sh) => {
      if (!sh) { shuttleLoad = null; return null; }
      sh.object.visible = false;
      sh.object.name = 'outpost-sale-shuttle';
      // the shadow map is static (re-rendered on change only): a flying shuttle must not bake a shadow onto the pad
      sh.object.traverse((x) => { if (x.isMesh) x.castShadow = false; });
      // engine markers on a holder turned so the plume (its −X) points down
      const holder = new THREE.Group(); holder.rotation.z = Math.PI / 2;
      for (const [i, k] of [[0, 'engine_l'], [1, 'engine_r']]) {
        const a = (sh.def && sh.def.anchors && sh.def.anchors[k]) || [i ? 0.5 : -0.5, 0.3, -0.85];
        const mk = new THREE.Object3D(); mk.name = `engine_${i}`;
        mk.position.set(a[1] + 0.05, -a[0], a[2]);
        mk.userData = { color: [0.35, 0.8, 1.0], radius: 0.22 };
        holder.add(mk);
      }
      sh.object.add(holder);
      shuttleFx = createEngineFx(THREE, holder, { pointLight: false });
      holder.add(shuttleFx.group);
      shuttleFx.setIntensity(0);
      root.add(sh.object);
      shuttle = sh;
      return sh;
    }, (e) => { shuttleLoad = null; throw e; });
    return shuttleLoad;
  }
  const idOf = (o, kind) => Object.keys(o.pads || {}).find((id) => o.pads[id].kind === kind);
  function crateRoute(o) {
    const st = idOf(o, 'storage'), hub = idOf(o, 'hub');
    if (!st || !hub) return null;
    const plan = planConduits(o, map);
    const a = plan.find((c) => c.to === st), b = plan.find((c) => c.to === hub && a && c.from === a.from);
    if (a && b) return [...a.points.slice().reverse(), ...b.points].map(([x, z]) => [x, z]);
    const ra = rectOf(st), rb = rectOf(hub);
    return ra && rb ? [centre(ra), centre(rb)] : null;
  }
  const along = (pts, k) => {
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let d = Math.max(0, Math.min(1, k)) * total;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? d / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= seg[i]; }
    return pts[pts.length - 1];
  };

  /**
   * Start the SELL sequence. tl: sellTimeline(); o: the outpost before the sale (its storage, the route, the hub).
   * → a promise of the sale's id once the shuttle is ready; the sale itself starts at once (the pops and count-up never
   * wait on the model, and a shuttle that fails to load leaves them playing — the caller logs the rejection).
   */
  function playSale(tl, o) {
    endSale();
    const hubId = idOf(o, 'hub') || (map.hub && map.hub.id);
    const hubPad = (hubId && rectOf(hubId)) || map.hub || null;
    const st = planBuildings(o, map, o.t).find((b) => b.kind === 'storage');
    const s = sale = { tl, t: 0, fired: new Set(), drain: 1, route: crateRoute(o), hubPad, hub: hubEntry(), id: ++seq, fillFrom: st ? st.fill : null, pops: 0 };
    if (tl.reduced) return Promise.resolve(s.id);
    return ensureShuttle().then(() => s.id);
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
        if (shuttle && shuttle.object.visible && shuttle.anchors && shuttle.anchors.cargo) shuttle.anchors.cargo.getWorldPosition(cargo);
        for (let i = 0; i < b.count; i++) debris.emit(cargo.x, cargo.y, cargo.z, b.colours[i % b.colours.length], { out: 2.6, size: 0.11, up: 3.2, life: 1.4, floor: 0.78 });
        if (r.impacts) for (let i = 0; i < 8; i++) r.impacts.emit(FXK.DUST, hx, 0.8, hz, (debris.rnd() - 0.5) * 3, 0.6, (debris.rnd() - 0.5) * 3, 0.9, 0.08);
      }
      if (b.type === 'pop' && r.gold) {
        // the pops fan along the landing pad's front edge, two to a spot at most, so a big sale stacks short (design
        // §4.3) — in front of the pad, not over it, so the shuttle lifting off behind them stays in sight on the
        // session's wider framing; the battle's own "$N" (a deposit event at that cell), big, in the ore's colour made bright
        // spots 0, −2.2, +2.2, −4.4, +4.4 cells; consecutive pops share a spot and stack (goldPopups' near rule)
        const k = s.pops = s.pops + 1, spot = Math.floor((k - 1) / 2) % 5, side = spot === 0 ? 0 : (spot % 2 ? -1 : 1) * 2.2 * Math.ceil(spot / 2);
        const front = s.hubPad ? s.hubPad.h / 2 + 0.6 : 2.4;
        r.gold.feed([{ type: 'deposit', gold: b.gold, pos: { x: hx - 0.5 + side, y: hz - 0.5 + front } }], r.map);
        const p = r.gold.live[r.gold.live.length - 1];
        if (p) { p.color = popColour(b.colour); p.y0 += 0.5; p.big = true; p.sale = s.id; }
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
    // the shuttle: the hub's parked one hides, the flying one lifts off the landing pad, then arcs up and out of frame
    const f = tl.shuttleAt(t);
    if (shuttle) {
      if (!s.hub) s.hub = hubEntry();
      const parked = s.hub && s.hub.inst && s.hub.inst.nodesOf ? s.hub.inst.nodesOf('shuttle') : [];
      if (f.on) {
        if (!s.base) {   // the flying shuttle takes the parked one's place and size (else the pad's centre)
          const box = new THREE.Box3();
          parked.forEach((nd) => { nd.visible = true; nd.updateWorldMatrix(true, true); box.expandByObject(nd); });
          const lvl = shuttle.lod && shuttle.lod.levels && shuttle.lod.levels[0] ? shuttle.lod.levels[0].object : shuttle.object;
          const sz = box.getSize(new THREE.Vector3()), mine = new THREE.Box3().setFromObject(lvl).getSize(new THREE.Vector3());
          const k = !box.isEmpty() && sz.x > 0 && mine.x > 0 ? Math.max(sz.x, sz.z) / Math.max(mine.x, mine.z) : (s.hubPad ? padModelScale(s.hubPad) : 1);
          const c = box.isEmpty() ? new THREE.Vector3(hx, 0.8, hz) : box.getCenter(new THREE.Vector3());
          s.base = { x: c.x, y: box.isEmpty() ? 0.8 : box.min.y, z: c.z, k: Math.min(1.6, Math.max(0.4, k)) };
          if (shuttleFx) shuttleFx.setIntensity(1.2);
        }
        for (const nd of parked) nd.visible = false;
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
      endSale();
      return { done: true, id: s.id, gold: tl.countAt(t), t };
    }
    return { done: false, id: s.id, gold: tl.countAt(t), t, shuttle: !!(shuttle && shuttle.object.visible) };
  }
  /** Put the scene back after a sale: the parked shuttle shows, the flying one and the crates go. Safe to call twice. */
  function endSale() {
    const s = sale;
    sale = null;
    if (!s) return;
    try {
      if (shuttle) shuttle.object.visible = false;
      if (shuttleFx) shuttleFx.setIntensity(0);
      const hub = s.hub || hubEntry();
      if (hub && hub.inst && hub.inst.nodesOf) for (const nd of hub.inst.nodesOf('shuttle')) nd.visible = true;
      crateMesh.count = 0;
      r.lights.invalidateShadows();
    } catch (e) { /* the scene tidy-up must never keep the sale open */ }
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
    /** Per frame: animation, debris, conduit pulse, the sale. → { debris, sale?, shake? } */
    update(dt, o) {
      clock += dt;
      conduitOn.uniforms.uTime.value = clock;
      const out = {};
      for (const e of built.values()) if (e.inst) e.inst.update(dt, r.camera);
      if (shuttle) shuttle.update(dt, r.camera);
      if (shuttleFx && shuttle && shuttle.object.visible) shuttleFx.update(dt, r.camera);
      // a frame of the sale animation that throws ends the sale (gold is already banked) instead of locking the HUD
      try { out.sale = stepSale(dt, out); } catch (e) { const id = sale && sale.id; endSale(); out.sale = { done: true, id, failed: String(e && e.message || e) }; }
      out.debris = stepDebris(reduced ? dt * 0.5 : dt);
      stepMarkers();
      return out;
    },
    setWarnings, setPreview, setPowerIcons,
    playSale, get saling() { return !!sale; },
    /** End the sale now (the driver's watchdog: a sale must never leave the outpost locked). */
    cancelSale: endSale,
    /** The preview conduit drawn now (tests / review): its point count, or 0. */
    get previewPoints() { return preview.line ? preview.line.geometry.getAttribute('position').count : 0; },
    get warningMarkers() { return [...markers].map(([pad, m]) => ({ pad, kind: m.kind })); },
    get powerIcons() { return [...powerIcons].map(([id, e]) => ({ id, state: e.state })); },
    /** The world position of a pad's centre (cells), for the camera. */
    padCentre(id) { const p = rectOf(id); return p ? centre(p) : null; },
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
