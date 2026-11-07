/**
 * src/outpost/view/outpostView.js — the outpost view: full screen, opened from the menu's OUTPOST button
 * [MM-story_mw5oeer7_n].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.1–§6.5; design docs/16 Bulwark MM/design/Outpost-Design.md §4.3–§4.5, §5.3,
 * §8, §10. The planet's outpost map is drawn by the battle renderer (render3d/index.js, through outpostBoard.js: the
 * same buildTerrainMap board and baked-level ground a battle map gets); outpostScene.js adds the pads, buildings,
 * conduits, deposits and effects; hud.js is the HUD; session.js is the link to the save (every action goes through
 * src/outpost/model.js, then missionFlow.settleOutpost).
 *
 *   const v = await openOutpostView({ planet, mount, tier });   // resolves once the view is up
 *   await v.closed;                                             // the player closed it
 *
 * The wall clock (Date.now()) is read here only — on open (the away catch-up), on the live tick, and for each action —
 * and passed into the pure model. opts.now overrides it (the review page's clock).
 */
import { createRenderer3D, renderFrame, destroyRenderer, screenToCell } from '../../render3d/index.js';
import { createOutpostKit, modelSlug } from '../../render3d/outposts/outpostModels.js';
import { outpostMapFor } from '../outpostMap.js';
import { outpostBattleMap, bakedSlugFor, lowlandResources } from './outpostBoard.js';
import { createOutpostScene } from './outpostScene.js';
import { defenseStructures, planBuildings } from './conduits.js';
import { createSession, onlineIssues } from './session.js';
import { hudModel, panelModel, defenseOptions, emptyPads, KIND_NAME, fmtGold } from './hudModel.js';
import { sellTimeline } from './sellTimeline.js';
import { layoutFor, framedCamera, focusCamera, panelInset, VIEW_YAW } from './layout.js';
import { mountHud } from './hud.js';
import { loadSave, updateSave } from '../../save/save.js';
import { loadMissionCatalog } from '../../save/missionCatalog.js';
import { defenseRing, padAt } from '../../terrain/outpostPads.js';
import { structureDef } from '../../data/outpost.js';
import { oresOf } from '../../data/ores.js';
import { PLANETS } from '../../data/planets.js';
import { loadChoice } from '../../render3d/quality.js';

const ROOT = new URL('../../../', import.meta.url).href;   // the game root (prototype/test-game/)
const LIVE_TICK = 1;   // seconds between live advances of the outpost

/**
 * opts: { planet, mount (element; default document.body), tier ('high' | 'standard' | 'low' | null = auto),
 *         store ({ load, update }; default the save), now (() => ms; default Date.now), catalog (missions; default
 *         loaded), raidHook (override the seam; tests / review), map (override outpostMapFor), reduced, onChange }
 * → { closed: Promise, close(), handle } — handle exposes state and hooks for the review page and measurements.
 */
export async function openOutpostView(opts = {}) {
  const planet = opts.planet || 'ground';
  const doc = (opts.mount && opts.mount.ownerDocument) || document;
  const mount = opts.mount || doc.body;
  const win = doc.defaultView;
  const clockNow = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const store = opts.store || { load: loadSave, update: updateSave };
  const reduced = opts.reduced ?? !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};

  // the full-screen host: the 3D view under the HUD
  const host = doc.createElement('div');
  host.className = 'outpost-view';
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2000', background: '#0f1412', overflow: 'hidden', touchAction: 'none' });
  const view3d = doc.createElement('div');
  Object.assign(view3d.style, { position: 'absolute', inset: '0' });
  host.appendChild(view3d);
  const loading = doc.createElement('div');
  Object.assign(loading.style, { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', color: '#cfd6dd', font: '700 14px/1.4 Rajdhani, system-ui, sans-serif', letterSpacing: '.3em', zIndex: 50 });
  loading.textContent = 'LANDING AT THE OUTPOST…';
  host.appendChild(loading);
  mount.appendChild(host);

  const map = opts.map || await outpostMapFor(planet);
  const catalog = opts.catalog !== undefined ? opts.catalog : await loadMissionCatalog().catch((e) => { console.warn('[outpost] missions unavailable', e); return null; });
  const session = createSession({ store, planet, map, catalog, raidHook: opts.raidHook });
  if (!store.load().outposts || !store.load().outposts[planet]) { host.remove(); throw new Error(`no outpost on ${planet}`); }

  // ── the battle renderer on the outpost board ─────────────────────────────────────────────────────────────────
  let bakeTune = {};
  try { const t = JSON.parse(win.localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') bakeTune = t; } catch (_) { /* default */ }
  const board = outpostBattleMap(map, { bakeTune });
  const slug = await bakedSlugFor(map, { base: ROOT });
  const r = await createRenderer3D(view3d, board, { slug, baseUrl: ROOT, planet, craft: false, landing: false, qualityQuery: opts.tier || null, qualityChoice: loadChoice(win.localStorage) });
  if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);
  r.fog.update = () => ({ win: null });   // no battle here: the whole board is open (clouds only past the map edge)
  const THREE = r.THREE;
  const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
  const kit = await createOutpostKit(THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader });
  const scene = createOutpostScene(THREE, r, { map, kit, tier: r.tier.key, reduced });

  // ── open: the away catch-up (the only time a long advance runs) ──────────────────────────────────────────────────
  // the away catch-up, one raid window per frame behind the loading line (raids on the battle sim cost time, O7)
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  const opened = await session.openChunked(clockNow(), nextFrame);
  onChange();
  let o = opened.outpost;
  const slugs = new Set(['hub', 'shuttle', 'power', 'storage', ...oresOf(planet).map((x) => `rig_${x.rig}`)]);
  for (const b of planBuildings(o, map, clockNow())) slugs.add(modelSlug(b.kind, b.tier, b.rigHead));
  await kit.preload([...slugs].filter(Boolean));
  // the unlocks and the bank come from the save: read once and again only after something changed it (an action, a
  // live tick), never per frame (loadSave parses localStorage)
  let ctxCache = null;
  const ctxNow = () => ctxCache || (ctxCache = session.ctx(clockNow()));
  const bank = () => ctxNow().gold;
  const dirty = () => { ctxCache = null; };
  scene.sync(o, clockNow(), ctxNow());
  for (let i = 0; i < 40 && !scene.ready(); i++) await new Promise((ok) => setTimeout(ok, 25));
  scene.sync(o, clockNow(), ctxNow());

  // ── state for the battle renderer: the defenses, the lowland resource fields, no units, no waves ───────────────
  const state = { structures: new Map(), units: new Map(), waves: { active: false, current: 0 }, map: board, resourceNodes: lowlandResources(map), projectiles: [] };
  const syncDefenses = () => { state.structures = new Map(defenseStructures(o).map((s) => [s.id, s])); };
  syncDefenses();

  // ── HUD ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let sel = null, placing = null, saleRun = null, shownGold = session.gold(), closed = false, resolveClosed;
  const closedP = new Promise((ok) => { resolveClosed = ok; });
  const hud = mountHud(host, {
    onClose: () => close(),
    onSell: () => doSell(),
    onBuild: () => openBuild(),
    onRepairAll: () => act({ type: 'repairAll' }, (res) => `Defenses repaired · −${fmtGold(res.cost)} gold`),
    onOnline: () => act({ type: 'online' }, () => 'OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.'),
    onPanelClose: () => { select(null); },
    onCancelPlace: () => stopPlacing(),
    onBuildKind: (kind, pad) => act({ type: 'place', pad, kind }, () => `${KIND_NAME[kind]} under construction`, () => select({ pad })),
    onDefense: (kind) => startPlacing(kind),
    onFocusPad: (pad) => select({ pad }, true),
    onDeep: (pad, on) => act({ type: 'deep', pad, on }, () => (on ? 'Deep seam: ¼ the speed, 5× the price' : 'Shallow seam'), () => select({ pad })),
    onUpgrade: (pad) => act({ type: 'upgrade', pad }, (res) => `Upgrade started · −${fmtGold(res.cost)} gold`, () => select({ pad })),
    onRepair: (id) => act({ type: 'repair', id }, (res) => `Repaired · −${fmtGold(res.cost)} gold`, () => select({ defense: id })),
    onReportClose: () => { hud.report(null); },
  }, { title: 'OUTPOST', planetName: (PLANETS[planet] && PLANETS[planet].name) || planet });

  function act(action, okText, after) {
    if (saleRun) return null;
    const res = session.act(action, clockNow());
    if (!res.ok) { hud.toast(res.error.replace(/^./, (c) => c.toUpperCase()), true); return res; }
    o = res.outpost; shownGold = res.gold; dirty();
    syncDefenses();
    scene.sync(o, clockNow(), ctxNow());
    if (okText) hud.toast(typeof okText === 'function' ? okText(res) : okText);
    if (after) after(res);
    else if (sel) select(sel);
    refreshHud(true);
    onChange();
    return res;
  }

  function doSell() {
    if (saleRun) return;
    const before = o, goldFrom = bank();
    const res = session.act({ type: 'sell' }, clockNow());
    if (!res.ok) { hud.toast(res.error, true); return; }
    o = res.outpost; dirty();
    const tl = sellTimeline(res.loads, { reduced, goldFrom });
    saleRun = { tl, t: 0, goldTo: res.gold };
    shownGold = goldFrom;
    scene.playSale(tl, before);
    hud.setBusy(true);
    onChange();
  }

  function openBuild() {
    stopPlacing();
    const ctx = ctxNow();
    const tiers = ctx.unlockedTiers || ['common'];
    const pads = emptyPads(o, map).map((p) => {
      const dep = (map.deposits || []).find((d) => d.pad === p.id), ore = dep && oresOf(planet).find((x) => x.tier === dep.tier);
      const label = ore ? `${ore.name} deposit` : p.role === 'power' ? 'Power pad' : p.role === 'bay' ? 'Bay pad' : p.role === 'spare' ? 'Spare pad' : `${p.role} pad`;
      const note = (ore && !tiers.includes(dep.tier) ? 'locked · ' : '') + `pad ${p.id}${p.remote ? ' · remote site' : ''}`;
      return { id: p.id, label, note };
    });
    sel = { build: true };
    scene.select(null);
    hud.buildSheet(pads, defenseOptions({ gold: bank() }));
    refocus();
  }

  function startPlacing(kind) {
    const taken = new Set(o.defenses.map((d) => d.cell.join(',')));
    const cells = defenseRing(map).filter(([x, y]) => !taken.has(`${x},${y}`));
    placing = { kind, cells: new Set(cells.map((c) => c.join(','))) };
    scene.showCells(cells);
    hud.panel(null);
    sel = null;
    hud.banner(`Tap a lit cell to place a ${KIND_NAME[kind]} (${fmtGold(structureDef(kind, 1).cost)} gold)`);
    glideTo(framedCamera(map, r._w || win.innerWidth, r._h || win.innerHeight, { yaw: r.cam.yaw }));
  }
  function stopPlacing() { placing = null; scene.showCells(null); hud.banner(null); }

  let panelKey = '';
  function select(next, focus = false) {
    sel = next;
    scene.select(next && (next.pad ? { pad: next.pad } : next.defense ? { cell: (o.defenses.find((d) => d.id === next.defense) || {}).cell } : null));
    if (!next || next.build) { hud.panel(null); panelKey = ''; scene.showReach(null); if (!next) refocus(); return; }
    const m = panelModel(o, map, next, { ...ctxNow(), now: clockNow(), gold: bank() });
    panelKey = JSON.stringify(m);
    hud.panel(m, next);
    // building on an empty pad: show each station's reach
    if (m && m.empty) {
      scene.showReach(Object.entries(o.pads).filter(([, b]) => b.kind === 'power').map(([id, b]) => {
        const [x, z] = scene.padCentre(id); return { x, z, r: structureDef('power', b.tier).reach };
      }));
    } else scene.showReach(null);
    if (focus || next.pad || next.defense) {
      const L = layoutFor(r._w || win.innerWidth, r._h || win.innerHeight);
      const target = next.pad ? map.pads.find((p) => p.id === next.pad) : (() => { const d = o.defenses.find((x) => x.id === next.defense); return d ? { x: d.cell[0] - 1, y: d.cell[1] - 1, w: 3, h: 3 } : null; })();
      if (target) glideTo(focusCamera(target, r.cam.yaw, L));
    }
  }
  function refreshPanel() {
    if (!sel || sel.build) return;
    const m = panelModel(o, map, sel, { ...ctxNow(), now: clockNow(), gold: bank() });
    const k = JSON.stringify(m);
    if (k !== panelKey) { panelKey = k; hud.panel(m, sel); }
  }

  // ── camera: the three-quarter view framing the mesa; glides to a building on tap ────────────────────────────────
  r.userMoved = true;   // the battle's auto-framing is off: the outpost frames its mesa
  let glide = null, userTouched = false, fitKey = '';
  r.cam.yaw = VIEW_YAW;
  function glideTo(c) { glide = { ...c }; }
  function refocus() {
    const w = r._w || win.innerWidth, h = r._h || win.innerHeight;
    const L = layoutFor(w, h);
    glideTo(framedCamera(map, w, h, { yaw: r.cam.yaw, panel: sel && !sel.build ? null : sel && sel.build ? panelInset(L) : null }));
    userTouched = false;
  }
  function autoFit() {
    const w = view3d.clientWidth || win.innerWidth, h = view3d.clientHeight || win.innerHeight;
    const L = layoutFor(w, h);
    hud.setLayout(L.mode);
    const key = `${w}x${h}`;
    if (key === fitKey) return;
    const first = !fitKey;
    fitKey = key;
    if (userTouched && !first) return;
    const c = framedCamera(map, w, h, { yaw: r.cam.yaw });
    if (first) Object.assign(r.cam, c); else glideTo(c);
  }

  // taps: a building (raycast on the models), else the pad or defense under the finger; drags pan (the renderer's input)
  const canvas = r.canvas;
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; glide = null; };
  const onMove = (e) => { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) userTouched = true; };
  const onUp = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
    tap(e.clientX, e.clientY);
  };
  const onWheel = () => { userTouched = true; glide = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  const onKey = (e) => { if (e.key === 'Escape') { if (hud.reportOpen) hud.report(null); else if (placing) stopPlacing(); else if (sel) select(null); else close(); } };
  doc.addEventListener('keydown', onKey);

  function tap(cx, cy) {
    if (saleRun) return;
    const rect = canvas.getBoundingClientRect(), px = cx - rect.left, py = cy - rect.top;
    const cell = screenToCell(r, px, py);
    if (placing) {
      if (cell && placing.cells.has(`${cell.x},${cell.y}`)) {
        const kind = placing.kind;
        const res = act({ type: 'place', cell: [cell.x, cell.y], kind }, () => `${KIND_NAME[kind]} placed`);
        if (res && res.ok) { stopPlacing(); const d = o.defenses[o.defenses.length - 1]; if (d) select({ defense: d.id }); }
      } else hud.toast('Defenses go on the lit ring', true);
      return;
    }
    const ndc = new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1);
    const hit = scene.pickBuilding(ndc, r.camera);
    if (hit) return select(hit, true);
    if (cell) {
      const d = o.defenses.find((x) => x.cell[0] === cell.x && x.cell[1] === cell.y);
      if (d) return select({ defense: d.id }, true);
      const p = padAt(map, cell.x, cell.y);
      if (p) return select({ pad: p.id }, true);
    }
    if (sel) select(null);
  }

  // ── the online card ─────────────────────────────────────────────────────────────────────────────────────────
  function onlineChecks() {
    if (o.online) return null;
    const issues = onlineIssues(o, map), probs = hudModel(o, map).problems;
    const kinds = ['hub', 'power', 'rig', 'storage'];
    const checks = kinds.map((k) => {
      const pads = Object.keys(o.pads).filter((id) => o.pads[id].kind === k);
      const ok = pads.length > 0 && !probs.some((p) => pads.some((id) => p.startsWith(id + ' ')));
      return { label: KIND_NAME[k], ok };
    });
    checks.push({ label: `${o.defenses.length} defenses`, ok: o.defenses.length > 0 });
    checks.push({ label: 'Power grid', ok: !issues.some((x) => /power/.test(x)) });
    return checks;
  }

  // ── the frame loop ────────────────────────────────────────────────────────────────────────────────────────────
  let raf = 0, last = performance.now(), liveAcc = 0, frames = [], measuring = null;
  function refreshHud(force = false) {
    const h = hudModel(o, map, { gold: bank() });
    hud.update(h, saleRun ? shownGold : bank());
    hud.online(onlineChecks());
    if (force) refreshPanel();
  }
  function frame(t) {
    if (closed) return;
    raf = win.requestAnimationFrame(frame);
    const t0 = performance.now();
    const raw = Math.max(0, t - last), dt = Math.min(0.1, raw / 1000);
    last = t;
    autoFit();
    liveAcc += dt;
    if (liveAcc >= LIVE_TICK && !saleRun) {
      liveAcc = 0;
      const lv = session.live(clockNow());
      dirty();
      if (lv.outpost) {
        o = lv.outpost;
        syncDefenses();
        if (lv.saved) { onChange(); if (lv.report.raids.length) hud.toast(lv.report.raids.some((x) => x.result === 'breach') ? 'Raid broke through: ore lost' : 'Raid repelled'); }
      }
      refreshHud(true);
    }
    scene.sync(o, clockNow(), ctxNow());
    const out = scene.update(dt, o);
    if (saleRun) {
      saleRun.t += dt;
      if (out.sale) shownGold = out.sale.gold;
      hud.update(hudModel(o, map, { gold: bank() }), shownGold);
      if (out.sale && out.sale.done) { saleRun = null; shownGold = bank(); hud.setBusy(false); refreshHud(true); }
    }
    if (out.shake) shake = out.shake;
    // the camera: glide toward a focus, shake during the lift
    if (glide) {
      const k = 1 - Math.exp(-dt * 5);
      r.cam.tx += (glide.tx - r.cam.tx) * k; r.cam.tz += (glide.tz - r.cam.tz) * k; r.cam.dist += (glide.dist - r.cam.dist) * k;
      if (Math.abs(glide.tx - r.cam.tx) + Math.abs(glide.tz - r.cam.tz) + Math.abs(glide.dist - r.cam.dist) < 0.02) glide = null;
    }
    let jx = 0, jz = 0;
    if (shake && saleRun) {
      const left = shake.until - saleRun.t;
      if (left > 0) { const a = shake.amp * (left / (shake.until - shake.t0)); jx = Math.sin(saleRun.t * 71) * a; jz = Math.cos(saleRun.t * 53) * a; } else shake = null;
    }
    r.cam.tx += jx; r.cam.tz += jz;
    renderFrame(r, state, {}, [], dt);
    r.cam.tx -= jx; r.cam.tz -= jz;
    if (r.resources && !r._ringsHidden) { r.resources.group.children.forEach((m) => { if (m.name === 'resources-rings') m.visible = false; }); r._ringsHidden = true; }
    // while measuring, wait for the GPU (gl.finish) so the number is the whole frame: script + draw + raster
    if (measuring) { try { r.renderer.getContext().finish(); } catch (e) { /* no context */ } }
    const work = performance.now() - t0;
    if (measuring) {
      measuring.samples.push({ work, dt: raw });
      if (measuring.samples.length >= measuring.n) { const m = measuring; measuring = null; m.done(m.samples); }
    }
    frames.push(work); if (frames.length > 120) frames.shift();
  }
  let shake = null;

  function close() {
    if (closed) return;
    closed = true;
    win.cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('wheel', onWheel);
    doc.removeEventListener('keydown', onKey);
    // a sale in flight is already banked; settle what the screen shows
    try { session.live(clockNow()); } catch (e) { console.warn('[outpost] close', e); }
    scene.dispose();
    destroyRenderer(r);
    hud.dispose();
    host.remove();
    onChange();
    resolveClosed();
  }

  autoFit();
  refreshHud(true);
  loading.remove();
  if (opened.away.show) hud.report(opened.away, { reduced });
  raf = win.requestAnimationFrame(frame);

  const handle = {
    get outpost() { return o; }, map, session, scene, r, hud, opened,
    select, sell: doSell, openBuild, startPlacing, stopPlacing, close,
    /** Frame timing over the next n frames: { frames, avgWork (ms, script + draw + gl.finish), p95Work, avgInterval (ms between frames), fps, tier }. */
    measure(n = 120) {
      return new Promise((ok) => {
        measuring = { n, samples: [], done: (s) => {
          const w = s.map((x) => x.work).sort((a, b) => a - b), iv = s.map((x) => x.dt).filter((x) => x > 0);
          const avg = (a) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
          ok({ frames: s.length, avgWork: avg(w), p95Work: w[Math.floor(w.length * 0.95)] || 0, avgInterval: avg(iv), fps: 1000 / Math.max(1e-6, avg(iv)), tier: r.tier.key,
            calls: r.stats.calls, triangles: r.stats.triangles, buildings: scene.buildingCount() });
        } };
      });
    },
  };
  return { closed: closedP, close, handle };
}
