/**
 * src/terrain/preview/craftPreview.js — the LANDING CRAFT previewer: the ten crafts and the full landing sequence
 * (fly-in, flare, wash, touchdown, hatches, harvesters), on the game's own render3d/craft modules. Lives in the
 * Terrain Forge as a preview mode; the standalone review page mounts the same module. [MM-story_mvbpfb1b_k]
 *
 *   const pv = mountCraftPreview(THREE, { stage, panel });   pv.start() · pv.stop() · pv.dispose()
 *   stage — an element to fill with the 3D view (position: relative / sized by the host)
 *   panel — an element to fill with the controls
 * Nothing renders until start(); stop() halts the loop (the Forge stops it when you switch back to the map).
 * THREE is injected (the Forge passes the vendored module, the standalone page the r128 global).
 */
import { createCraft3D } from '../../render3d/craft/craft3d.js';
import { LANDING_CRAFT, LANDING_CRAFT_ORDER } from '../../render3d/craft/models.js';
import { landingPose, landedPose, phaseStart, phaseAt, TOTAL, harvesterOnRamp } from '../../render3d/craft/landing.js';
import { createPrims } from '../../render3d/units/prims.js';
import { UNIT_MODELS } from '../../render3d/units/models.js';
import { WORLD_LIGHT } from '../../render3d/styles/lowpoly-palettes.js';
import { injectPreviewCss, el, segmented, checkbox, createStage } from './previewUi.js';

const HARV_COLORS = { hull: 0xe9ebee, hull2: 0xc5cbd2, panel: 0xadb3ba, dark: 0x4a4f56, black: 0x22252a, track: 0x2e3135, metal: 0x7b828a, glass: 0x1c2533, glow: 0x46f2ff, glowB: 0x4aa8ff, amber: 0xffb340 };
const HARV_SCALE = 0.27 * 0.9;   // modelKeys: SYS-Harvester → buggy at 0.9 × UNIT_SCALE
const ORTHO = [{ name: 'Front', dir: [1, 0, 0], up: [0, 1, 0] }, { name: 'Side', dir: [0, 0, 1], up: [0, 1, 0] }, { name: 'Top', dir: [0, 1, 0], up: [1, 0, 0] }, { name: 'Rear', dir: [-1, 0, 0], up: [0, 1, 0] }];
const FROM = [['180', 'West'], ['90', 'North'], ['0', 'East'], ['270', 'South'], ['135', 'North-west']];

export function mountCraftPreview(THREE, { stage, panel, craft: craftKey0 = 'lc_neutral', world: world0 = 'meadow' }) {
  injectPreviewCss();
  let worldKey = world0, craftKey = craftKey0, viewMode = 'orbit', fromDeg = 180, slow = false, loop = true, showCells = true, metal = true;
  let ground, grid, cells, craft = null, harv = [], pose = 'landed', seqT = -1, clock = 0;

  // ── controls
  const root = el('div', 'pv-root');
  const info = el('div', 'pv-info');
  const play = el('button', 'pv-b pv-primary', '▶ Fly in, land, deploy'); play.type = 'button';
  const poseSeg = segmented([['flight', 'Hover'], ['landed', 'Landed'], ['open', 'Deployed']], pose, (k) => setPose(k));
  const fromSel = el('select'); for (const [v, l] of FROM) fromSel.appendChild(new Option(l, v));
  const viewSeg = segmented([['orbit', 'Orbit'], ['battle', 'Battle cam'], ['ortho', 'Ortho 4-up']], viewMode, (k) => { viewMode = k; layoutLabels(); if (k === 'ortho') setPose('landed'); });
  const worldSel = el('select'); for (const k of Object.keys(WORLD_LIGHT)) worldSel.appendChild(new Option(k[0].toUpperCase() + k.slice(1), k));
  worldSel.value = worldKey;
  const crafts = el('div', 'pv-crafts');
  const rowA = el('div', 'pv-row'); rowA.append(play, poseSeg.el);
  const fromLab = el('label', 'pv-ck', 'From '); fromLab.appendChild(fromSel);
  const rowB = el('div', 'pv-row'); rowB.append(fromLab, checkbox('Half speed', slow, (v) => { slow = v; }).el, checkbox('Loop', loop, (v) => { loop = v; }).el);
  const rowW = el('div', 'pv-row'); rowW.append(worldSel, checkbox('3 × 3 cells', showCells, (v) => { showCells = v; if (cells) cells.visible = v; }).el, checkbox('Metal', metal, (v) => { metal = v; craft.setMetal(v ? 1 : 0); }).el);
  root.append(info, el('h2', '', 'Landing sequence'), rowA, rowB, el('h2', '', 'View'), viewSeg.el, el('h2', '', 'World'), rowW, el('h2', '', 'Craft'), crafts,
    el('div', 'pv-note', 'Drag to orbit · wheel to zoom. Runs the game\'s own render3d/craft modules — what you see is what the game draws.'));
  panel.appendChild(root);
  for (const k of LANDING_CRAFT_ORDER) {
    const d = LANDING_CRAFT[k], b = el('button', 'pv-craft'); b.type = 'button'; b.dataset.k = k;
    b.setAttribute('aria-pressed', k === craftKey);
    b.innerHTML = `<span class="pv-sw">${['hull', 'accent', 'stripe', 'glow'].map((c) => `<i style="background:${d.palette[c]}"></i>`).join('')}</span><span><b>${d.name}</b><small>${d.factionName}</small></span><span class="pv-wt">${d.weaponType}</span>`;
    b.onclick = () => { for (const c of crafts.children) c.setAttribute('aria-pressed', c === b); craftKey = k; buildCraft(); };
    crafts.appendChild(b);
  }
  fromSel.onchange = () => { fromDeg = +fromSel.value; if (seqT < 0) setPose(pose); };
  worldSel.onchange = () => { worldKey = worldSel.value; buildWorld(); };
  play.onclick = () => { craft.clearFx(); if (viewMode === 'ortho') { viewMode = 'orbit'; viewSeg.set('orbit'); layoutLabels(); } seqT = 0; craft.setCastShadow(false); poseSeg.set(null); };

  // ── stage
  const S = createStage(THREE, stage, frame);
  const renderer = S.renderer;
  const hud = el('div', 'pv-hud'), phase = el('div', 'pv-phase', 'Landed'), bar = el('div', 'pv-bar', '<i></i>'); hud.append(phase, bar); S.wrap.appendChild(hud);
  const prog = bar.firstChild;
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.5), amb = new THREE.AmbientLight(0xffffff, 0.16);
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
  sun.position.set(-5, 8, -4); scene.add(hemi, amb, sun, sun.target);
  const persp = new THREE.PerspectiveCamera(35, 1, 0.1, 400), orbit = { yaw: 0.8, pitch: 0.42, dist: 9, auto: true };
  const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
  S.onResize = (w, h) => { persp.aspect = w / h; layoutLabels(); };

  function buildWorld() {
    for (const o of [ground, grid, cells]) if (o) { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    const L = WORLD_LIGHT[worldKey];
    renderer.setClearColor(L.clear, 1);
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    amb.intensity = L.ambient; sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: L.apron }));
    ground.receiveShadow = true; ground.position.y = -0.001;
    grid = new THREE.GridHelper(60, 60, 0x000000, 0x000000); grid.material.transparent = true; grid.material.opacity = 0.12; grid.position.y = 0.005;
    const v = []; for (let i = 0; i <= 3; i++) { const a = -1.5 + i; v.push(-1.5, 0.01, a, 1.5, 0.01, a, a, 0.01, -1.5, a, 0.01, 1.5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    cells = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff8a2a })); cells.visible = showCells;
    scene.add(ground, grid, cells);
    scene.fog = new THREE.Fog(L.clear, 40, 120);
    if (craft) craft.setEnv({ sky: L.hemi[0], ground: L.apron });
  }
  function buildCraft() {
    if (craft) craft.dispose();
    for (const h of harv) scene.remove(h.g);
    const L = WORLD_LIGHT[worldKey];
    craft = createCraft3D(THREE, scene, craftKey, { env: { sky: L.hemi[0], ground: L.apron } });
    craft.place({ x: -0.5, y: -0.5 });
    craft.setMetal(metal ? 1 : 0);
    craft.setCastShadow(true);
    const prims = createPrims(THREE), cache = {};
    const mats = (k) => cache[k] || (cache[k] = /^glow|amber/.test(k) ? new THREE.MeshBasicMaterial({ color: HARV_COLORS[k] || 0x46f2ff }) : new THREE.MeshLambertMaterial({ color: HARV_COLORS[k] || 0xff00ff }));
    harv = [-1, 1].map((side) => { const b = prims.buildModel(UNIT_MODELS.buggy, mats); const g = new THREE.Group(); b.group.scale.setScalar(HARV_SCALE); b.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.add(b.group); g.visible = false; scene.add(g); return { g, side }; });
    showInfo();
    setPose(pose);
  }
  function showInfo() {
    const d = craft.def, sw = (k) => `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;background:${d.palette[k]}"></span>`;
    info.innerHTML = `<div class="pv-nm">${d.name}</div><div class="pv-fc">${d.factionName} · ${d.weaponType}</div><p>${d.blurb}</p>
      <dl><dt>Craft key</dt><dd>${d.key}</dd><dt>Faction key</dt><dd>${d.faction}</dd><dt>Footprint</dt><dd>3 × 3 cells</dd><dt>Triangles</dt><dd>${Math.round(craft.tris).toLocaleString()}</dd>
      <dt>Groups</dt><dd>${Object.keys(craft.groups).join(' · ')}</dd><dt>Livery</dt><dd>${['hull', 'hull2', 'accent', 'stripe', 'glow'].map(sw).join('')}</dd></dl>`;
  }
  // harvesters follow the same rule as render3d/index.js landingHarvesters: ramp, then onto the dock 2 cells out
  function placeHarvesters(P) {
    const yaw = craft.model.rotation.y;
    for (const h of harv) {
      if (P.harv < 0) { h.g.visible = false; continue; }
      h.g.visible = true;
      const q = harvesterOnRamp(craft.def, Math.min(1, P.harv / 0.7));
      const w = craft.toWorld({ x: 0, y: q.y, z: h.side * q.z });
      if (P.harv > 0.7) { const f = (P.harv - 0.7) / 0.3, s = f * f * (3 - 2 * f); w.z += (h.side * 2 - w.z) * s; w.x += (0 - w.x) * s; w.y += (0 - w.y) * s; }
      h.g.position.set(w.x, w.y, w.z);
      h.g.rotation.y = -Math.atan2(h.side * Math.cos(yaw), h.side * Math.sin(yaw));
    }
  }
  function poseState(k) {
    if (k === 'flight') return landingPose(phaseStart('descent'), { fromDeg });
    if (k === 'landed') return landingPose(phaseStart('hatches'), { fromDeg });
    return landedPose({ fromDeg });
  }
  function setPose(k) {
    pose = k; seqT = -1; poseSeg.set(k);
    const P = poseState(k); craft.apply(P); placeHarvesters(P);
    phase.textContent = k === 'flight' ? 'Hovering · gear up' : k === 'landed' ? 'Landed · hatches shut' : 'Landed · deployed'; prog.style.width = '0';
  }

  function placeOrbit(follow) {
    const t = new THREE.Vector3(follow ? follow.x * 0.5 : 0, 0.6 + (follow ? follow.y * 0.5 : 0), follow ? follow.z * 0.5 : 0);
    persp.fov = 35; persp.position.set(t.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, t.y + Math.sin(orbit.pitch) * orbit.dist, t.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
    persp.lookAt(t); persp.updateProjectionMatrix();
  }
  function placeBattle() { const d = 22 * (orbit.dist / 9), p = 37 * Math.PI / 180; persp.fov = 30; persp.position.set(0, Math.sin(p) * d, Math.cos(p) * d); persp.lookAt(0, 0, 0); persp.updateProjectionMatrix(); }
  function fitOrtho(v, w, h) {
    ocam.position.set(...v.dir).multiplyScalar(10); ocam.up.set(...v.up); ocam.lookAt(0, 0, 0); ocam.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(craft.model), inv = ocam.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const a of [box.min.x, box.max.x]) for (const b of [box.min.y, box.max.y]) for (const c of [box.min.z, box.max.z]) { const p = new THREE.Vector3(a, b, c).applyMatrix4(inv); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    let bw = (x1 - x0) * 1.1, bh = (y1 - y0) * 1.1; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; if (bw / bh > w / h) bh = bw / (w / h); else bw = bh * (w / h);
    Object.assign(ocam, { left: cx - bw / 2, right: cx + bw / 2, top: cy + bh / 2, bottom: cy - bh / 2 }); ocam.updateProjectionMatrix();
  }
  function layoutLabels() {
    const L = S.labels; L.innerHTML = ''; if (viewMode !== 'ortho') return; const [w, h] = S.size();
    ORTHO.forEach((v, i) => { const d = el('div', 'pv-vlabel', v.name); d.style.left = ((i % 2) * w / 2 + 10) + 'px'; d.style.top = ((i < 2 ? 0 : h / 2) + 10) + 'px'; L.appendChild(d); });
  }

  // orbit by drag, zoom by wheel
  const cv = renderer.domElement;
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; orbit.auto = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; orbit.yaw -= (e.clientX - drag.x) * 0.008; orbit.pitch = Math.max(0.05, Math.min(1.45, orbit.pitch + (e.clientY - drag.y) * 0.006)); drag = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(4, Math.min(30, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });

  function frame(dt, w, h) {
    clock += dt;
    let P = null;
    const k = slow ? 0.5 : 1;
    if (seqT >= 0) {
      const was = seqT; seqT += dt * k;
      if (was < phaseStart('touchdown') && seqT >= phaseStart('touchdown')) craft.setCastShadow(true);
      if (seqT > TOTAL + 1.5) { if (loop) { seqT = 0; craft.setCastShadow(false); craft.clearFx(); } else { seqT = -1; pose = 'open'; poseSeg.set('open'); } }
      if (seqT >= 0) { P = landingPose(seqT, { fromDeg }); craft.apply(P); craft.update(dt * k, P); placeHarvesters(P); phase.textContent = phaseAt(seqT).label; prog.style.width = Math.min(100, seqT / TOTAL * 100) + '%'; }
    }
    if (!P && craft.fxCount) craft.update(dt, null);
    const frozen = viewMode === 'ortho';
    craft.aim(null, frozen ? 0 : dt); if (frozen && craft.groups.weapon) craft.groups.weapon.rotation.y = 0;
    craft.scan(frozen ? 0 : clock);
    if (orbit.auto && viewMode === 'orbit') orbit.yaw += dt * 0.18;
    if (viewMode === 'ortho') {
      const hw = Math.floor(w / 2), hh = Math.floor(h / 2); ground.visible = grid.visible = cells.visible = false; renderer.setScissorTest(true);
      ORTHO.forEach((v, i) => { const x = (i % 2) * hw, y = i < 2 ? hh : 0; fitOrtho(v, hw, hh); renderer.setViewport(x, y, hw, hh); renderer.setScissor(x, y, hw, hh); renderer.render(scene, ocam); });
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); ground.visible = grid.visible = true; cells.visible = showCells;
    } else {
      if (viewMode === 'battle') placeBattle(); else placeOrbit(P && seqT < phaseStart('touchdown') ? new THREE.Vector3().setFromMatrixPosition(craft.model.matrixWorld) : null);
      const sk = craft.shake;   // touchdown thump (cells)
      if (sk > 0) { persp.position.x += Math.sin(clock * 73) * sk; persp.position.y += Math.sin(clock * 91 + 1.3) * sk * 0.6; persp.position.z += Math.cos(clock * 59) * sk; }
      renderer.render(scene, persp);
    }
  }

  buildWorld(); buildCraft();
  return {
    start: () => S.start(), stop: () => S.stop(), resize: () => S.resize(),
    get running() { return S.running; },
    dispose() { S.dispose(); if (craft) craft.dispose(); root.remove(); },
    /** test / screenshot hooks: set(craft, pose, view, world) · seq(t) pre-simulates the sequence up to t seconds */
    debug: {
      orbit,
      set(k, p, v, w) {
        if (k) { craftKey = k; for (const c of crafts.children) c.setAttribute('aria-pressed', c.dataset.k === k); }
        if (w) { worldKey = w; worldSel.value = w; }
        if (v) { viewMode = v; viewSeg.set(v); layoutLabels(); }
        orbit.auto = false; buildWorld(); buildCraft(); if (p) setPose(p);
      },
      seq(t) {
        seqT = -1; craft.clearFx();
        for (let u = 0; u <= t; u += 1 / 30) { const Q = landingPose(u, { fromDeg }); craft.apply(Q); craft.update(1 / 30, Q); }
        const P = landingPose(t, { fromDeg }); craft.apply(P); placeHarvesters(P);
      },
    },
  };
}
