/**
 * src/terrain/preview/resourcePreview.js — the RESOURCE previewer: every collectible model, 9 homeworlds × 4 tiers,
 * with the field-drain states and the role rings the game draws. Lives in the Terrain Forge as a preview mode (its
 * tiers line up with the Forge's resource paint: 🔵 common, 🟡 uncommon, 🔴 rare, 🟢 epic); the standalone review
 * page mounts the same module. [MM-story_mvbpfb1b_k]
 *
 *   const pv = mountResourcePreview(THREE, { stage, panel });   pv.start() · pv.stop() · pv.dispose()
 */
import { TIERS, resourceModel } from '../../render3d/resources/models.js';
import { mergeResourceModel } from '../../render3d/resources/resources3d.js';
import { PLANETS } from '../../data/planets.js';
import { WORLD_LIGHT, CRYSTAL } from '../../render3d/styles/lowpoly-palettes.js';
import { injectPreviewCss, el, segmented, checkbox, createStage } from './previewUi.js';

const TIER_RING = { common: 'blue', uncommon: 'yellow', rare: 'red', epic: 'green' };
const TIER_LABEL = { common: 'Common · harvest', uncommon: 'Uncommon · 2× value', rare: 'Rare · associate', epic: 'Epic · associate' };
const PAINT = { common: '🔵 Blue', uncommon: '🟡 Yellow', rare: '🔴 Rare 1', epic: '🟢 Rare 2' };

export function mountResourcePreview(THREE, { stage, panel, planet: planet0 = 'all' }) {
  injectPreviewCss();
  const planets = Object.keys(PLANETS);
  let mode = PLANETS[planet0] ? planet0 : 'all', items = [], spin = true, rings = true, drain = 4, t = 0;

  // ── controls
  const root = el('div', 'pv-root');
  const planetSeg = segmented([['all', 'All 36'], ...planets.map((p) => [p, PLANETS[p].name])], mode, (k) => { mode = k; build(); });
  const drainIn = el('input'); drainIn.type = 'range'; drainIn.min = 0; drainIn.max = 4; drainIn.step = 1; drainIn.value = drain; drainIn.style.flex = '1';
  const drainV = el('span', '', 'full'); drainV.style.minWidth = '110px';
  drainIn.oninput = () => { drain = +drainIn.value; applyDrain(); };
  const rowD = el('div', 'pv-row'); rowD.append(drainIn, drainV);
  const rowC = el('div', 'pv-row'); rowC.append(checkbox('Turntable', spin, (v) => { spin = v; }).el, checkbox('Role rings', rings, (v) => { rings = v; applyDrain(); }).el);
  const legend = el('div', 'pv-note', TIERS.map((k) => `<span style="color:${CRYSTAL[TIER_RING[k]]}">●</span> ${PAINT[k]} → ${k}`).join('<br>'));
  const detail = el('div', 'pv-info');
  root.append(el('h2', '', 'Homeworld'), planetSeg.el, el('h2', '', 'Field'), rowD, rowC, el('h2', '', 'Tiers ← Forge resource paint'), legend, el('h2', '', 'This set'), detail,
    el('div', 'pv-note', 'The battle planet is the enemy faction\'s homeworld; its four crops replace the crystals on that map. Runs the game\'s own render3d/resources modules.'));
  panel.appendChild(root);

  // ── stage
  const S = createStage(THREE, stage, frame);
  const renderer = S.renderer;
  const foot = el('div', 'pv-foot'); S.wrap.appendChild(foot);
  const scene = new THREE.Scene();
  const L = WORLD_LIGHT.meadow;
  renderer.setClearColor(0x6f90d4, 1);
  scene.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]), new THREE.AmbientLight(0xffffff, 0.2));
  const sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]); sun.position.set(-4, 7, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5cbf6c })); ground.receiveShadow = true; scene.add(ground);
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true }), glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ringGeo = new THREE.RingGeometry(0.36, 0.45, 24).rotateX(-Math.PI / 2);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  S.onResize = (w, h) => { cam.aspect = w / h; cam.updateProjectionMatrix(); };

  function clear() {
    for (const it of items) { scene.remove(it.g); it.ring.material.dispose(); it.g.traverse((o) => { if (o.geometry && o.geometry !== ringGeo) o.geometry.dispose(); }); }
    items = []; S.labels.innerHTML = '';
  }
  function addModel(planet, tier, x, z, small) {
    const def = resourceModel(planet, tier), m = mergeResourceModel(THREE, def);
    const g = new THREE.Group(), turn = new THREE.Group(); g.position.set(x, 0, z); g.add(turn);
    for (const [geo, mat] of [[m.lit, litMat], [m.glow, glowMat]]) if (geo) { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = mat === litMat; turn.add(mesh); }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: CRYSTAL[TIER_RING[tier]], transparent: true, opacity: 0.85, depthWrite: false })); ring.position.y = 0.02; g.add(ring);
    scene.add(g);
    const lab = el('div', 'pv-lab' + (small ? ' pv-small' : ''), `<b>${def.name}</b><span style="color:${CRYSTAL[TIER_RING[tier]]}">${small ? tier : TIER_LABEL[tier]}</span>`); S.labels.appendChild(lab);
    items.push({ g, turn, ring, lab, def, tris: m.tris });
  }
  function build() {
    clear();
    if (mode === 'all') {
      planets.forEach((p, c) => TIERS.forEach((tier, r) => addModel(p, tier, (c - 4) * 1.3, (r - 1.5) * 1.35, true)));
      foot.textContent = '36 models · columns = homeworlds (' + planets.map((p) => PLANETS[p].name).join(', ') + ') · rows = common, uncommon, rare, epic';
      detail.innerHTML = `<div class="pv-nm">All homeworlds</div><p>${items.reduce((a, i) => a + i.tris, 0).toLocaleString()} triangles for all 36. Pick a homeworld for its four crops up close.</p>`;
    } else {
      TIERS.forEach((tier, c) => addModel(mode, tier, (c - 1.5) * 1.6, 0, false));
      const P = PLANETS[mode];
      foot.textContent = `${P.name} — ${P.type}`;
      detail.innerHTML = `<div class="pv-nm">${P.name}</div><div class="pv-fc">${P.type}</div><dl>${items.map((i) => `<dt style="color:${CRYSTAL[TIER_RING[i.def.tier]]}">${i.def.tier}</dt><dd>${i.def.name} · ${i.tris.toLocaleString()} tris</dd>`).join('')}</dl><p style="margin-top:6px">Each drawn instanced: 2 calls per model in the game.</p>`;
    }
    applyDrain();
  }
  const dimCache = new Map();
  function dimMat(m) { const base = m.userData.base || m; if (!dimCache.has(base)) { const d = base.clone(); d.color = new THREE.Color(0.45, 0.45, 0.45); d.userData.base = base; dimCache.set(base, d); } return dimCache.get(base); }
  function applyDrain() {
    const q = drain / 4; drainV.textContent = q === 1 ? 'full' : q === 0 ? 'regrowing stub' : Math.round(q * 100) + '% left';
    const s = q === 0 ? 0.4 : 0.6 + 0.4 * q, dim = q === 0 ? 0.45 : 1;
    for (const it of items) {
      it.turn.scale.setScalar(s);
      it.turn.traverse((o) => { if (o.isMesh) o.material = dim < 1 ? dimMat(o.material) : (o.material.userData.base || o.material); });
      it.ring.visible = rings; it.ring.material.color.set(CRYSTAL[TIER_RING[it.def.tier]]).multiplyScalar(dim < 1 ? 0.5 : 1);
    }
  }

  const v = new THREE.Vector3();
  function frame(dt, w, h) {
    if (spin) t += dt;
    // fit the layout's width to the view: half-width / (tan(fov/2) · aspect), and keep the height in view on tall views
    const half = mode === 'all' ? 6.7 : 3.1, tanH = Math.tan(cam.fov * Math.PI / 360), d = Math.max(half / (tanH * cam.aspect), mode === 'all' ? 3.6 / tanH : 1.2 / tanH);
    if (mode === 'all') { cam.position.set(0, d * 0.78, d * 0.62); cam.lookAt(0, 0, 0.1); } else { cam.position.set(0, d * 0.5, d * 0.87); cam.lookAt(0, 0.25, 0); }
    items.forEach((it, i) => {
      it.turn.rotation.y = t * 0.5 + i * 0.7;
      v.set(it.g.position.x, mode === 'all' ? -0.1 : -0.12, it.g.position.z + (mode === 'all' ? 0.42 : 0.55)).project(cam);
      it.lab.style.left = ((v.x + 1) / 2 * w) + 'px'; it.lab.style.top = ((1 - v.y) / 2 * h) + 'px';
    });
    renderer.render(scene, cam);
  }

  build();
  return {
    start: () => S.start(), stop: () => S.stop(), resize: () => S.resize(),
    get running() { return S.running; },
    dispose() { clear(); S.dispose(); litMat.dispose(); glowMat.dispose(); ringGeo.dispose(); root.remove(); },
    /** test / screenshot hook: set(planet | 'all', drain 0..4) */
    debug: { set(k, d) { mode = PLANETS[k] ? k : 'all'; planetSeg.set(mode); if (d != null) { drain = d; drainIn.value = d; } build(); } },
  };
}
