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
import { statusModel } from './statusReport.js';
import { hudModel, panelModel, KIND_NAME, fmtGold, rigHeadOf } from './hudModel.js';
import { buildMenu, placementStep, aimValid, IDLE, MENU, DEFENSE_STRUCT, isResourceBay, kindOf } from './buildMenu.js';
import { buildingWarnings, markerOf } from './warnings.js';
import { renderMenuIcons } from './menuIcons.js';
import { sellTimeline } from './sellTimeline.js';
import { layoutFor, framedCamera, focusCamera, VIEW_YAW } from './layout.js';
import { mountHud } from './hud.js';
import { loadSave, updateSave } from '../../save/save.js';
import { loadMissionCatalog } from '../../save/missionCatalog.js';
import { padAt } from '../../terrain/outpostPads.js';
import { structureDef } from '../../data/outpost.js';
import { oresOf } from '../../data/ores.js';
import { PLANETS } from '../../data/planets.js';
import { loadChoice } from '../../render3d/quality.js';
import { harvestRunning, harvestPlan, surfaceFieldGroups, fieldStock } from '../model.js';
import { harvestRates } from '../../data/outpost.js';
import { harvesterUnits } from './harvestDrive.js';
import { buildNavGrid, findWalkerPath } from '../../sim/pathfinding.js';

const ROOT = new URL('../../../', import.meta.url).href;   // the game root (prototype/test-game/)
const LIVE_TICK = 1;   // seconds between live advances of the outpost

/**
 * opts: { planet, mount (element; default document.body), tier ('high' | 'standard' | 'low' | null = auto),
 *         store ({ load, update }; default the save), now (() => ms; default Date.now), catalog (missions; default
 *         loaded), raidHook (override the seam; tests / review), map (override outpostMapFor), reduced, onChange }
 * → { closed: Promise, close(), handle } — handle exposes state and hooks for the review page and measurements.
 */
export async function openOutpostView(opts = {}) {
  // never a dead end (owner 2026-11-08, iPhone: stuck on LANDING AT THE OUTPOST…, nothing answered): the loading screen
  // names the step it is on and offers BACK after a while; a failure shows what failed, with BACK
  const stage = { step: 'starting', host: null, loading: null };
  // BACK during a stalled load hands the menu a closed view at once (the load, if it ever finishes, closes itself)
  const abandoned = new Promise((ok) => { stage.onAbandon = () => ok({ closed: Promise.resolve(), close() {}, handle: null }); });
  try { return await Promise.race([openOutpostViewInner(opts, stage), abandoned]); } catch (e) {
    console.error('[outpost] the outpost view failed at', stage.step, e);
    if (!stage.host || !stage.host.isConnected) throw e;
    return loadingFailed(stage, `Could not land (${stage.step}): ${(e && e.message) || e}`);
  }
}

/** Turn the loading screen into a failure card with BACK. → { closed, close, handle: null } */
function loadingFailed(stage, text) {
  if (stage.watchdog) clearTimeout(stage.watchdog);
  const doc = stage.host.ownerDocument;
  let resolveClosed;
  const closed = new Promise((ok) => { resolveClosed = ok; });
  const close = () => { stage.host.remove(); resolveClosed(); };
  stage.loading.innerHTML = '';
  const box = doc.createElement('div');
  Object.assign(box.style, { display: 'grid', gap: '14px', justifyItems: 'center', maxWidth: '80vw', textAlign: 'center' });
  const msg = doc.createElement('div'); msg.textContent = text; Object.assign(msg.style, { letterSpacing: '.06em', fontWeight: '600', color: '#ffb3aa' });
  const back = doc.createElement('button'); back.textContent = 'BACK';
  Object.assign(back.style, { font: '700 14px/1 Rajdhani, system-ui, sans-serif', letterSpacing: '.2em', padding: '12px 28px', background: '#D9A441', color: '#1a1206', border: '0', cursor: 'pointer' });
  back.addEventListener('click', close);
  box.append(msg, back); stage.loading.appendChild(box);
  return { closed, close, handle: null };
}

async function openOutpostViewInner(opts, stage) {
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
  stage.host = host; stage.loading = loading;
  // the step it is on, under the title; BACK after 12 s so a stall is never a dead end
  const stepLine = doc.createElement('div');
  Object.assign(stepLine.style, { position: 'absolute', left: '0', right: '0', top: 'calc(50% + 22px)', textAlign: 'center', font: '600 11px/1.4 Rajdhani, system-ui, sans-serif', letterSpacing: '.18em', color: '#6d7a8a' });
  loading.appendChild(stepLine);
  const step = (name) => { stage.step = name; stepLine.textContent = name.toUpperCase(); };
  stage.watchdog = setTimeout(() => {
    if (!loading.isConnected) return;
    const b = doc.createElement('button'); b.textContent = 'BACK';
    Object.assign(b.style, { position: 'absolute', left: '50%', top: 'calc(50% + 52px)', transform: 'translateX(-50%)', font: '700 13px/1 Rajdhani, system-ui, sans-serif', letterSpacing: '.2em', padding: '10px 24px', background: '#1f2732', color: '#dfe7ef', border: '1px solid #3a4655', cursor: 'pointer' });
    b.addEventListener('click', () => { stage.abandoned = true; host.remove(); if (stage.onAbandon) stage.onAbandon(); });
    loading.appendChild(b);
  }, 12000);
  step('reading the map');

  const map = opts.map || await outpostMapFor(planet);
  step('reading the contracts');
  const catalog = opts.catalog !== undefined ? opts.catalog : await loadMissionCatalog().catch((e) => { console.warn('[outpost] missions unavailable', e); return null; });
  const session = createSession({ store, planet, map, catalog, raidHook: opts.raidHook });
  if (!store.load().outposts || !store.load().outposts[planet]) { host.remove(); throw new Error(`no outpost on ${planet}`); }

  // ── the battle renderer on the outpost board ─────────────────────────────────────────────────────────────────
  let bakeTune = {};
  try { const t = JSON.parse(win.localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') bakeTune = t; } catch (_) { /* default */ }
  const board = outpostBattleMap(map, { bakeTune });
  step('starting the 3D view');
  const slug = await bakedSlugFor(map, { base: ROOT });
  const r = await createRenderer3D(view3d, board, { slug, baseUrl: ROOT, planet, craft: false, landing: false, qualityQuery: opts.tier || null, qualityChoice: loadChoice(win.localStorage) });
  if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);
  r.fog.update = () => ({ win: null });   // no battle here: the whole board is open (clouds only past the map edge)
  const THREE = r.THREE;
  step('loading the building models');
  const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
  const kit = await createOutpostKit(THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader });
  const scene = createOutpostScene(THREE, r, { map, kit, tier: r.tier.key, reduced });

  // ── open: the away catch-up (the only time a long advance runs) ──────────────────────────────────────────────────
  // the away catch-up, one raid window per frame behind the loading line (raids on the battle sim cost time, O7)
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  step('catching up while you were away');
  const opened = await session.openChunked(clockNow(), nextFrame);
  onChange();
  let o = opened.outpost;
  const slugs = new Set(['hub', 'shuttle', 'power', 'storage', ...oresOf(planet).map((x) => `rig_${x.rig}`), 'resourceBay', 'upgradeBay', 'habitat']);
  for (const b of planBuildings(o, map, clockNow())) slugs.add(modelSlug(b.kind, b.tier, b.rigHead));
  step('placing the buildings');
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
  const syncDefenses = () => { state.structures = new Map(defenseStructures(o, map).map((s) => [s.id, s])); };
  syncDefenses();

  // ── the Resource Bay's harvesters (story O10): the battle's own miner, driven along a route from the bay to its field
  // (harvestDrive.js); the hopper's numbers are the model's closed form, this is the picture of it. The routes walk the
  // battle board (ramps and all) once per bay / field, on the view's animation clock (never the wall clock).
  const HRATES = harvestRates();
  const routeCache = new Map();
  let nav = null, driveClock = 0;
  function routeFor(h) {
    const key = `${h.from.join(',')}>${h.field.join(',')}`;
    if (routeCache.has(key)) return routeCache.get(key);
    nav = nav || buildNavGrid(board, [], []);
    const from = { x: Math.floor(h.from[0]), y: Math.floor(h.from[1]) }, to = { x: h.field[0], y: h.field[1] };
    let path = null;
    try { path = findWalkerPath(nav, from, to); } catch (e) { path = null; }
    const route = path && path.length ? [from, ...path.map((c) => ({ x: c.x, y: c.y }))] : [from, to];
    routeCache.set(key, route);
    return route;
  }
  function syncHarvesters() {
    for (const id of [...state.units.keys()]) if (String(id).startsWith('oh')) state.units.delete(id);
    const plan = harvestPlan(o, map);
    if (!plan.length) return;
    const running = harvestRunning(o, map).length > 0, routes = {};
    for (const h of plan) routes[h.i] = routeFor(h);
    for (const u of harvesterUnits(plan, routes, HRATES, driveClock, { running })) state.units.set(u.id, u);
  }
  syncHarvesters();
  // the surface fields' stock (owner 2026-11-07: they regrow at 5 % of the battle's rate): a field's markers shrink and
  // dim as it empties, through the battle renderer's own drained-node look (remaining / units, a regrowing stub at 0)
  const fieldOfCell = new Map();
  for (const f of surfaceFieldGroups(map)) for (const c of f.cells) fieldOfCell.set(`${c[0]},${c[1]}`, f);
  function syncFieldStock() {
    const st = fieldStock(o, map);
    for (const n of state.resourceNodes) {
      const f = fieldOfCell.get(`${n.x},${n.y}`);
      if (!f) continue;
      n.units = 1; n.respawns = true; n.remaining = f.cap > 0 ? st[f.id] / f.cap : 1;
    }
  }
  syncFieldStock();

  // ── HUD ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let sel = null, saleRun = null, shownGold = session.gold(), closed = false, resolveClosed;
  const closedP = new Promise((ok) => { resolveClosed = ok; });
  const hud = mountHud(host, {
    onClose: () => close(),
    onSell: () => doSell(),
    onRepairAll: () => act({ type: 'repairAll' }, (res) => `Defenses repaired · −${fmtGold(res.cost)} gold`),
    onOnline: () => act({ type: 'online' }, () => 'OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.'),
    onPanelClose: () => { select(null); },
    onCancelPlace: () => cancelPlacing(),
    onConfirmPlace: () => placeEvent({ type: 'confirm' }),
    onPick: (id) => pickItem(id),
    onPickFor: (kind, pad) => pickItem(isResourceBay(kind) ? 'resourceBay' : kind, { pad }),
    onDeep: (pad, on) => act({ type: 'deep', pad, on }, () => (on ? 'Deep seam: ¼ the speed, 5× the price' : 'Shallow seam'), () => select({ pad })),
    onUpgrade: (pad) => act({ type: 'upgrade', pad }, (res) => `Upgrade started · −${fmtGold(res.cost)} gold`, () => select({ pad })),
    onRepair: (id) => act({ type: 'repair', id }, (res) => `Repaired · −${fmtGold(res.cost)} gold`, () => select({ defense: id })),
    onSellStructure: (target) => {
      // where it stood, for the green "$N" the battle's sale pops (goldPopups.js)
      const pad = target.pad && map.pads.find((p) => p.id === target.pad), d = target.defense != null && o.defenses.find((x) => x.id === target.defense);
      const pos = pad ? { x: pad.x + (pad.w - 1) / 2, y: pad.y + (pad.h - 1) / 2 } : d ? { x: d.cell[0], y: d.cell[1] } : null;
      act({ type: 'sellStructure', target }, (res) => {
        if (pos && r.gold) r.gold.feed([{ type: 'build', phase: 'sold', refund: res.earned, pos }], board);
        return `Sold · +${fmtGold(res.earned)} gold`;
      }, () => select(null));
    },
    onUpgradeDefense: (id) => act({ type: 'upgradeDefense', id }, (res) => `On the Upgrade Bay · back in ${fmtClock((res.done - clockNow()) / 1000)} · −${fmtGold(res.cost)} gold`, () => select({ defense: id })),
    onReportClose: () => { hud.report(null); },
    onStatus: () => { hud.status(statusModel(o, map, { planet, catalog, now: clockNow() }), { reduced }); },
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

  // ── the BUILD menu (story O17 [MM-story_mw6k9xec_5]): the battle's pick → ghost → build loop ──────────────────────
  // buildMenu.js is the model (items, prices, locks, valid targets) and the placement reducer; this wires it to the
  // HUD's left rail, the scene (glowing pads / ring cells, the ghost) and the session (every build is session.act:
  // advance, model.place, the gold, settleOutpost — so updateSave and settleOutpost run per action, as before).
  let pl = IDLE, menuItems = [], menuKey = '', icons = {}, hover = null, ui3d = {}, lastPointer = 'mouse';
  const armedItem = () => (pl.item ? menuItems.find((m) => m.id === pl.item.id) || pl.item : null);
  const targetsOf = () => { const it = armedItem(); return it ? it.targets || [] : []; };
  const titleCase = (t) => t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  function rigIconSlug() {
    const rig = menuItems.find((m) => m.id === 'rig'), first = rig && rig.targets && rig.targets[0];
    return modelSlug('rig', 1, first ? rigHeadOf(o, map, first.pad) : (oresOf(planet)[0] || {}).rig);
  }
  function refreshMenu(force = false) {
    const ctx = { ...ctxNow(), gold: bank(), now: clockNow() };
    const key = JSON.stringify([o.pads, o.building.map((b) => [b.pad, b.kind]), o.defenses.map((d) => [d.cell, d.kind]), o.harvesters ?? null, o.online, ctx.gold, ctx.unlockedTiers, [...(ctx.unlocks || [])], [...(ctx.techOwned || [])].filter((x) => /^dock/.test(x))]);
    if (force || key !== menuKey) {
      menuKey = key; menuItems = buildMenu(o, map, ctx);
      if (pl.phase !== 'idle') {
        const it = armedItem();
        if (!it || it.locked) { const why = it && it.why; cancelPlacing(); if (why) hud.toast(why, true); } else applyPlacement();
      }
    }
    hud.menu(menuItems, { selected: pl.phase !== 'idle' && pl.item ? pl.item.id : null, icons, rigSlug: rigIconSlug() });
  }
  function pickItem(id, target = null) {
    if (saleRun) return;
    refreshMenu();
    const item = menuItems.find((m) => m.id === id);
    if (!item) return;
    const r0 = placementStep(pl, { type: 'pick', item, target }, item.targets || []);
    if (r0.effect && r0.effect.type === 'locked') { hud.toast(item.why || 'Not available', true); return; }
    if (r0.effect && r0.effect.type === 'buy') {
      act({ type: 'buyHarvester' }, (res) => `Harvester purchased${res.cost ? ` · −${fmtGold(res.cost)} gold` : ''}`);
      refreshMenu(true);
      return;
    }
    pl = r0.state;
    hover = null;
    if (pl.phase !== 'idle') {
      if (sel) { sel = null; hud.panel(null); scene.select(null); scene.showReach(null); panelKey = ''; }
      if (pl.target) { pl = { ...pl, phase: 'aimed' }; lastPointer = 'touch'; }
      glideTo(framedCamera(map, r._w || win.innerWidth, r._h || win.innerHeight, { yaw: r.cam.yaw }));
    }
    applyPlacement();
    refreshMenu();
  }
  function cancelPlacing() { pl = IDLE; hover = null; applyPlacement(); hud.menu(menuItems, { selected: null, icons, rigSlug: rigIconSlug() }); }
  /** Bring the scene and the banner to the placement state. */
  function applyPlacement() {
    const it = pl.phase === 'idle' ? null : armedItem();
    if (!it) { scene.showPads(null); scene.showCells(null); scene.showGhost(null); hud.banner(null); ui3d = {}; hud.online(onlineChecks()); return; }
    hud.online(null);
    const T = it.targets || [], valid = aimValid(pl, T), price = it.cost != null ? ` · ${fmtGold(it.cost)} gold` : '';
    if (it.place === 'pad') {
      scene.showPads(T.map((t) => t.pad)); scene.showCells(null); ui3d = {};
      const pad = pl.target && pl.target.pad, kind = kindOf(it.id);
      scene.showGhost(pad ? { pad, kind, slug: modelSlug(kind, 1, kind === 'rig' ? rigHeadOf(o, map, pad) : null), valid } : null);
    } else {
      scene.showPads(null); scene.showGhost(null);
      scene.showCells(T.map((t) => t.cell));
      const c = pl.target && pl.target.cell;
      // the battle renderer's own placement ghost (outline model, cyan / red) and range ring
      ui3d = c ? { buildSelection: DEFENSE_STRUCT[it.id], hoverCell: { x: c[0], y: c[1] }, hoverValid: valid } : { buildSelection: DEFENSE_STRUCT[it.id] };
    }
    const where = it.place === 'pad' ? 'a lit pad' : 'a lit cell on the ring';
    const touchAim = pl.phase === 'aimed' && valid && lastPointer === 'touch';
    hud.banner(touchAim ? `${titleCase(it.label)}${price}` : `Place a ${titleCase(it.label)} on ${where}${price}`, { confirm: touchAim });
  }
  /** A placement event (hover / tap / confirm) → the reducer, then its effect. */
  function placeEvent(ev) {
    if (saleRun || pl.phase === 'idle') return;
    const T = targetsOf();
    const { state: next, effect } = placementStep(pl, ev, T);
    pl = next;
    if (effect && effect.type === 'invalid') hud.toast(armedItem() && armedItem().place === 'pad' ? 'Pick a lit pad' : 'Defenses go on the lit ring', true);
    if (effect && effect.type === 'place') {
      const it = effect.item, kind = kindOf(it.id), t = effect.target;
      const res = act({ type: 'place', kind, ...(t.pad ? { pad: t.pad } : { cell: t.cell }) },
        () => (t.pad ? `${titleCase(it.label)} under construction` : `${KIND_NAME[kind] || titleCase(it.label)} placed`), () => {});
      if (res && res.ok) {
        pl = placementStep(pl, { type: 'placed' }, T).state;
        hover = null;
        refreshMenu(true);
        if (t.pad) { applyPlacement(); select({ pad: t.pad }, true); return; }
      }
    }
    applyPlacement();
    hud.menu(menuItems, { selected: pl.phase !== 'idle' && pl.item ? pl.item.id : null, icons, rigSlug: rigIconSlug() });
  }
  /** The build target under a canvas point for the armed item: { pad } or { cell }. */
  function targetAt(px, py) {
    const it = armedItem();
    if (!it) return null;
    const cell = screenToCell(r, px, py);
    if (!cell) return null;
    if (it.place === 'pad') { const p = padAt(map, cell.x, cell.y); return p ? { pad: p.id } : null; }
    return { cell: [cell.x, cell.y] };
  }
  // the outpost buildings' pictures, rendered from their GLBs once the kit is loaded (menuIcons.js)
  const iconSlugs = ['power', 'storage', ...new Set(oresOf(planet).map((x) => `rig_${x.rig}`)), 'resourceBay', 'upgradeBay', 'habitat'].filter((x) => kit.manifest[x]);
  renderMenuIcons(THREE, r.renderer, kit, iconSlugs).then((m) => { icons = m; if (!closed) refreshMenu(true); }).catch((e) => console.warn('[outpost] menu icons', e));

  let panelKey = '';
  function select(next, focus = false) {
    sel = next;
    scene.select(next && (next.pad ? { pad: next.pad } : next.defense ? { cell: (o.defenses.find((d) => d.id === next.defense) || {}).cell } : null));
    if (!next) { hud.panel(null); panelKey = ''; scene.showReach(null); refocus(); return; }
    if (pl.phase !== 'idle') cancelPlacing();
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
    if (!sel) return;
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
    glideTo(framedCamera(map, w, h, { yaw: r.cam.yaw }));
    userTouched = false;
  }
  function autoFit() {
    const w = view3d.clientWidth || win.innerWidth, h = view3d.clientHeight || win.innerHeight;
    const L = layoutFor(w, h);
    hud.setLayout(L.mode);
    const key = `${w}x${h}`;
    if (key !== fitKey) hud.fitRail();
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
  const onDown = (e) => { lastPointer = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse'; if (e.button === 2) return; down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; glide = null; };
  const onMove = (e) => {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) userTouched = true;
    // the mouse: the ghost follows the pointer (a finger aims by tapping), as the battle's hover cell
    if (pl.phase !== 'idle' && e.pointerType === 'mouse' && !down) {
      const rect = canvas.getBoundingClientRect(), t = targetAt(e.clientX - rect.left, e.clientY - rect.top);
      const k = JSON.stringify(t);
      if (k !== hover) { hover = k; lastPointer = 'mouse'; placeEvent({ type: 'hover', target: t }); }
    }
  };
  const onCtx = (e) => { if (pl.phase !== 'idle') { e.preventDefault(); cancelPlacing(); } };
  const onUp = (e) => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
    tap(e.clientX, e.clientY, e.pointerType);
  };
  const onWheel = () => { userTouched = true; glide = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('contextmenu', onCtx);
  // keys, as the battle's: 1–9 pick from the list (again to disarm), Enter confirms, Esc cancels
  const onKey = (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.key === 'Escape') { if (hud.reportOpen) hud.report(null); else if (pl.phase !== 'idle') cancelPlacing(); else if (sel) select(null); else close(); return; }
    if (hud.reportOpen) return;
    if (/^[0-9]$/.test(e.key) && MENU[(+e.key + 9) % 10]) { pickItem(MENU[(+e.key + 9) % 10].id); e.preventDefault(); return; }   // 1–9, then 0 for the tenth
    if (e.key === 'Enter' && pl.phase === 'aimed') { placeEvent({ type: 'confirm' }); e.preventDefault(); }
    // the battle's action keys on the selection panel: U upgrade, X sell, R repair
    if (sel && pl.phase === 'idle' && /^[uxr]$/i.test(e.key) && hud.pressAction(e.key.toUpperCase())) e.preventDefault();
  };
  doc.addEventListener('keydown', onKey);

  function tap(cx, cy, pointerType = 'mouse') {
    if (saleRun) return;
    const rect = canvas.getBoundingClientRect(), px = cx - rect.left, py = cy - rect.top;
    const cell = screenToCell(r, px, py);
    if (pl.phase !== 'idle') {
      lastPointer = pointerType === 'touch' || pointerType === 'pen' ? 'touch' : 'mouse';
      placeEvent({ type: 'tap', target: targetAt(px, py), touch: lastPointer === 'touch' });
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
    checks.push({ label: 'Power grid', ok: !issues.some((x) => /power/.test(x)) });
    return checks;
  }

  // ── the frame loop ────────────────────────────────────────────────────────────────────────────────────────────
  let raf = 0, last = performance.now(), liveAcc = 0, frames = [], measuring = null;
  function refreshHud(force = false) {
    const h = hudModel(o, map, { gold: bank(), now: clockNow(), unlocks: ctxNow().unlocks });
    hud.update(h, saleRun ? shownGold : bank());
    hud.online(pl.phase !== 'idle' ? null : onlineChecks());   // the GO ONLINE card steps aside while placing
    scene.setWarnings(buildingWarnings(o, map), markerOf);
    refreshMenu();
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
    driveClock += dt;
    syncHarvesters();
    if (liveAcc === 0) syncFieldStock();
    const out = scene.update(dt, o);
    if (saleRun) {
      saleRun.t += dt;
      if (out.sale) shownGold = out.sale.gold;
      hud.update(hudModel(o, map, { gold: bank(), now: clockNow(), unlocks: ctxNow().unlocks }), shownGold);
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
    renderFrame(r, state, ui3d, [], dt);
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
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx);
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
  clearTimeout(stage.watchdog);
  if (stage.abandoned) { close(); return { closed: closedP, close, handle }; }
  loading.remove();
  if (opened.away.show) hud.report(opened.away, { reduced });
  else if (opened.banked && Object.keys(opened.banked).length) hud.toast(`Hopper emptied into your inventory · +${fmtGold(Object.values(opened.banked).reduce((a, b) => a + b, 0))}`);
  raf = win.requestAnimationFrame(frame);

  const handle = {
    get outpost() { return o; }, map, session, scene, r, hud, opened,
    /** The harvesters drawn now (review): [{ id, pos, state, tier }]. */
    get harvesters() { return [...state.units.values()].filter((u) => u.isHarvester).map((u) => ({ id: u.id, pos: { ...u.pos }, state: u.state, tier: u.tier })); },
    /** Run the harvesters' trip clock forward (review screenshots). */
    driveTo(sec) { driveClock = sec; syncHarvesters(); },
    select, sell: doSell, close,
    /** The build menu (review / screenshots): pick(id, target?), aim(target, touch), hoverAt(target), confirm(), cancel(). */
    pick: (id, target) => pickItem(id, target), confirm: () => placeEvent({ type: 'confirm' }), cancel: () => cancelPlacing(),
    aim: (target, touch = true) => { lastPointer = touch ? 'touch' : 'mouse'; placeEvent({ type: 'tap', target, touch }); },
    hoverAt: (target) => { lastPointer = 'mouse'; placeEvent({ type: 'hover', target }); },
    get placement() { return pl; }, get menu() { return menuItems; },
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
