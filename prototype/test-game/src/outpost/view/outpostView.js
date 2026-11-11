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
// the FARM tab (story A7 [MM-story_mwabgs3l_f]): the farm on this same view, map, session and build loop (owner rule 7)
import { createFarmLayer } from '../../farm/view/farmLayer.js';
import { createFarmEmbers } from '../../farm/view/embers.js';
// the surface avatar and farmhands (story A8 [MM-story_mwabh0cd_i]): the ship's crew rig on this map's nav grid
import { createFarmCrew } from '../../farm/view/avatar.js';
import { farmMenu, FARM_MENU, farmAt, farmPanelModel } from '../../farm/view/farmUi.js';
import { storeCapacity } from '../../farm/model.js';
import { statusModel } from './statusReport.js';
import { constructionSites, damageSites, createConstructionFx } from './constructionFx.js';
import { K as FXK } from '../../render3d/fx/impacts.js';
import { hudModel, panelModel, KIND_NAME, fmtGold, fmtClock, rigHeadOf } from './hudModel.js';
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
import { harvestRunning, harvestPlan, surfaceFieldGroups, fieldStock, droneHome, droneFlightMs } from '../model.js';
import { harvestRates } from '../../data/outpost.js';
import { harvesterUnits } from './harvestDrive.js';
import { startProbe, probeDelay, probeWear, probeCells, probeBreached, PROBE_MAX_S } from './visitProbe.js';
import { powerGrids } from '../model.js';
import { buildNavGrid, findWalkerPath } from '../../sim/pathfinding.js';
import { crumb, lastSessionCrashed } from '../../diag/errorLog.js';
import { reportButton } from '../../diag/reportPanel.js';
import { openOutpostSessionView, sessionViewWanted } from './sessionView.js';

const ROOT = new URL('../../../', import.meta.url).href;   // the game root (prototype/test-game/)
const LIVE_TICK = 1;   // seconds between live advances of the outpost

/**
 * opts: { planet, mount (element; default document.body), tier ('high' | 'standard' | 'low' | null = auto),
 *         store ({ load, update }; default the save), now (() => ms; default Date.now), catalog (missions; default
 *         loaded), raidHook (override the seam; tests / review), map (override outpostMapFor), reduced, onChange }
 * → { closed: Promise, close(), handle } — handle exposes state and hooks for the review page and measurements.
 */
export async function openOutpostView(opts = {}) {
  // One Battle UX S2.4a [MM-subtask_mwciiylh_31]: ?outpost=session opens the outpost on the shared battle session
  // (sessionView.js); this view stays the default until the owner's playtest, then S2.4d deletes it
  const doc0 = (opts.mount && opts.mount.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (doc0 && doc0.defaultView && sessionViewWanted(doc0.defaultView)) return openOutpostSessionView(opts);
  // never a dead end (owner 2026-11-08, iPhone: stuck on LANDING AT THE OUTPOST…, nothing answered): the loading screen
  // names the step it is on and offers BACK after a while; a failure shows what failed, with BACK
  const stage = { step: 'starting', host: null, loading: null };
  // BACK during a stalled load hands the menu a closed view at once (the load, if it ever finishes, closes itself)
  const abandoned = new Promise((ok) => { stage.onAbandon = () => ok({ closed: Promise.resolve(), close() {}, handle: null }); });
  try { return await Promise.race([openOutpostViewInner(opts, stage), abandoned]); } catch (e) {
    console.error('[outpost] the outpost view failed at', stage.step, e);
    crumb(`outpost: failed at ${stage.step}`);
    if (!stage.host || !stage.host.isConnected) throw e;
    return loadingFailed(stage, `Could not land (${stage.step}): ${(e && e.message) || e}`);
  }
}

/** Seconds past the sale timeline before the watchdog ends a stalled sale (the rail and HUD come back). */
export const SALE_GRACE = 2;

const SAFE_KEY = 'bulwark.outpostSafe';
/** Is the outpost in safe mode on this device? A visit cut short (errorLog.lastSessionCrashed) turns it on for good. */
export function outpostSafeMode(win) {
  let on = false;
  try { on = win.localStorage.getItem(SAFE_KEY) === '1'; } catch (e) { /* no storage */ }
  if (!on && lastSessionCrashed()) {
    on = true;
    try { win.localStorage.setItem(SAFE_KEY, '1'); } catch (e) { /* no storage: safe for this load only */ }
  }
  return on;
}

/** The renderer's load for a crumb: tier, pixel ratio, drawing buffer, live textures / geometries / shader programs. */
function gpuLine(r) {
  try {
    const R = r.renderer, m = R.info.memory, size = R.getDrawingBufferSize(new r.THREE.Vector2());
    return `tier ${r.tier.key} · dpr ${R.getPixelRatio()} · ${size.x}×${size.y} · tex ${m.textures} · geo ${m.geometries} · prog ${(R.info.programs || []).length}`;
  } catch (e) { return 'gpu ?'; }
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
  box.append(msg, back, reportButton(doc)); stage.loading.appendChild(box);
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
  const step = (name) => { stage.step = name; stepLine.textContent = name.toUpperCase(); crumb(`outpost: ${name}`); };
  stage.watchdog = setTimeout(() => {
    if (!loading.isConnected) return;
    const b = doc.createElement('button'); b.textContent = 'BACK';
    Object.assign(b.style, { position: 'absolute', left: '50%', top: 'calc(50% + 52px)', transform: 'translateX(-50%)', font: '700 13px/1 Rajdhani, system-ui, sans-serif', letterSpacing: '.2em', padding: '10px 24px', background: '#1f2732', color: '#dfe7ef', border: '1px solid #3a4655', cursor: 'pointer' });
    b.addEventListener('click', () => { stage.abandoned = true; crumb('outpost: closed'); host.remove(); if (stage.onAbandon) stage.onAbandon(); });
    loading.appendChild(b);
    // the error report under BACK (the stall may be an error the phone has no console for)
    const rb = reportButton(doc);
    Object.assign(rb.style, { position: 'absolute', left: '50%', top: 'calc(50% + 100px)', transform: 'translateX(-50%)' });
    loading.appendChild(rb);
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
  // SAFE MODE (owner's iPhone, 2026-11-09 error reports: the outpost opens, then iOS kills the tab within a second):
  // once a visit to the outpost has been cut short on this device, the outpost opens at the Low tier with the lightest
  // building models from then on (a ?quality= in the URL still wins). The error report's crumbs say which mode ran.
  const safe = !opts.tier && outpostSafeMode(win);
  const r = await createRenderer3D(view3d, board, { slug, baseUrl: ROOT, planet, craft: false, landing: false, qualityQuery: opts.tier || (safe ? 'low' : null), qualityChoice: loadChoice(win.localStorage) });
  if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);
  r.fog.update = () => ({ win: null });   // no battle here: the whole board is open (clouds only past the map edge)
  const THREE = r.THREE;
  step('loading the building models');
  const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
  const kit = await createOutpostKit(THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader, lodLevels: safe ? [2] : null });
  const scene = createOutpostScene(THREE, r, { map, kit, tier: r.tier.key, reduced });
  const farm = createFarmLayer(THREE, r, { map, kit, reduced });
  // the harvest effect: embers in the pod level's colour on the battle's particle pool; no idle embers in safe mode (F7)
  const farmFx = createFarmEmbers({ safe });
  // the avatar lands each farm action through act() when its work is done (one session.act per action); the
  // farmhands are life only. Safe mode: no farmhands (tech plan §2.3 F7). Created before the board's state is read.
  const crew = createFarmCrew(THREE, r, { map, board, safe, reduced, land: (a) => landFarm(a), busy: () => !!saleRun });

  // ── open: the away catch-up (the only time a long advance runs) ──────────────────────────────────────────────────
  // the away catch-up, one raid window per frame behind the loading line (raids on the battle sim cost time, O7)
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  step('catching up while you were away');
  const opened = await session.openChunked(clockNow(), nextFrame);
  onChange();
  let o = opened.outpost;
  // the tab: OUTPOST or FARM (the menu's FARM button opens this view on FARM); the FARM tab exists once there is a farm
  let tab = opts.tab === 'farm' && o.farm ? 'farm' : 'outpost';
  farm.sync(o, clockNow());
  crew.sync(o);
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
  const syncDefenses = () => { state.structures = new Map(defenseStructures(o, map, clockNow()).map((s) => [s.id, s])); };
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
  // ── repair drones (owner 2026-11-10: "the repair drone need to travel from the base and repair defenses")
  //    [MM-story_mwb3y511_20]: each defense with a repair under way (model.js repair: d.repair { at, arrive, done }) has the
  //    battle's repair unit (isRepairTroop) in the scene: it flies out from the hub, works at the defense (the battle's
  //    welding sparks, render3d/fx/repairFx.js, keyed on state 'repairing' + repairTargetId) and, once the repair is
  //    done, flies home. The clock decides where it is, so a reopened outpost shows a drone mid-flight.
  const dronesBack = new Map();   // defense id → { from: [x, y], at, ms } a drone flying home after its repair
  const lastRepair = new Map();   // defense id → its d.repair while under way (to know where a finished drone starts home)
  function syncRepairDrones() {
    for (const id of [...state.units.keys()]) if (String(id).startsWith('or')) state.units.delete(id);
    const home = droneHome(o, map);
    if (!home) return;
    const now = clockNow();
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const unit = (key, pos, st, target) => state.units.set('or' + key, { id: 'or' + key, unitId: 'GND-Troops', isRepairTroop: true, domain: 'Walker',
      pos: { x: pos[0], y: pos[1] }, hp: 60, maxHp: 60, state: st, repairTargetId: target, targetId: null });
    const live = new Set();
    for (const d of o.defenses) {
      const at = [d.cell[0] + 0.5, d.cell[1] + 0.5];
      // it works from the defense's side toward the hub, half a cell out
      const dx = home[0] - at[0], dy = home[1] - at[1], L = Math.hypot(dx, dy) || 1;
      const spot = [at[0] + dx / L * 0.7, at[1] + dy / L * 0.7];
      if (d.repair) {
        live.add(d.id); lastRepair.set(d.id, { spot });
        const r = d.repair;
        if (now < r.arrive) unit(d.id, lerp(home, spot, Math.max(0, (now - r.at) / Math.max(1, r.arrive - r.at))), 'repairMarch', null);
        else unit(d.id, spot, 'repairing', 'od-' + d.id);
      } else if (lastRepair.has(d.id)) {   // just finished: fly home
        const s = lastRepair.get(d.id).spot;
        lastRepair.delete(d.id);
        dronesBack.set(d.id, { from: s, at: now, ms: Math.max(500, droneFlightMs(o, map, d)) });
      }
    }
    for (const [id, b] of dronesBack) {
      if (live.has(id)) { dronesBack.delete(id); continue; }
      const k = (now - b.at) / b.ms;
      if (k >= 1) { dronesBack.delete(id); continue; }
      unit(id + 'b', lerp(b.from, home, k), 'repairMarch', null);
    }
  }
  syncRepairDrones();
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
    onRepairAll: () => act({ type: 'repairAll' }, (res) => `Repair drones launched · −${fmtGold(res.cost)} gold`),
    onOnline: () => act({ type: 'online' }, () => 'OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.'),
    onPanelClose: () => { select(null); },
    onCancelPlace: () => cancelPlacing(),
    onConfirmPlace: () => placeEvent({ type: 'confirm' }),
    onPick: (id) => pickItem(id),
    onPickFor: (kind, pad) => pickItem(isResourceBay(kind) ? 'resourceBay' : kind, { pad }),
    onDeep: (pad, on) => act({ type: 'deep', pad, on }, () => (on ? 'Deep seam: ¼ the speed, 5× the price' : 'Shallow seam'), () => select({ pad })),
    onUpgrade: (pad) => act({ type: 'upgrade', pad }, (res) => `Upgrade started · −${fmtGold(res.cost)} gold`, () => select({ pad })),
    onRepair: (id) => act({ type: 'repair', id }, (res) => `Repair drone launched · −${fmtGold(res.cost)} gold`, () => select({ defense: id })),
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
    onTab: (t) => setTab(t),
    onFarmAct: (a, arg) => farmAct(a, arg),
  }, { title: 'OUTPOST', planetName: (PLANETS[planet] && PLANETS[planet].name) || planet });

  function act(action, okText, after) {
    if (saleRun) return null;
    const res = session.act(action, clockNow());
    if (!res.ok) { hud.toast(res.error.replace(/^./, (c) => c.toUpperCase()), true); return res; }
    o = res.outpost; shownGold = res.gold; dirty();
    syncDefenses();
    scene.sync(o, clockNow(), ctxNow());
    farm.sync(o, clockNow());
    crew.sync(o);
    // an upgrade that outgrows the grid still goes ahead, flagged (model.upgradeGridShort) [MM-story_mwcp7u7b_3a]
    const text = okText ? (typeof okText === 'function' ? okText(res) : okText) : null;
    if (text || res.warning) hud.toast([text, res.warning && res.warning.replace(/^./, (c) => c.toUpperCase())].filter(Boolean).join(' · '));
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
    // the shuttle model may fail to load (a phone short of memory): the sale plays on without it
    Promise.resolve(scene.playSale(tl, before)).catch((e) => crumb('outpost: sale shuttle failed · ' + (e && e.message || e)));
    hud.setBusy(true);
    onChange();
  }

  // ── the FARM tab (story A7): the switch and the farm's actions (all through session.act, as every outpost action)
  function setTab(t) {
    if (t === tab || (t === 'farm' && !o.farm)) return;
    tab = t;
    if (pl.phase !== 'idle') cancelPlacing();
    select(null);
    hud.tabs(!!o.farm, tab);
    refreshMenu(true);
    hud.online(tab === 'farm' ? null : onlineChecks());
  }
  const FARM_TEXT = {
    prep: () => 'Prepping the plot',
    plant: (res) => (`Planted ${res.farm && res.farm.planted ? res.farm.planted.replace(/-/g, ' ') : ''}`.trim() +
      (res.farm && res.farm.level ? ` · level ${res.farm.level}` : '') + (res.farm && res.farm.capped ? ` (${res.farm.capped})` : '')),
    harvest: (res) => harvestText(res), harvestAll: (res) => harvestText(res),
    deliver: (res) => `Delivered ${res.farm.delivered} to the ship`,
    farmSell: (res) => `Crops sold · +${fmtGold(res.earned)} gold`,
  };
  function harvestText(res) {
    const f = res.farm || {}, units = Object.values(f.harvested || {}).reduce((a, b) => a + b, 0);
    const pods = (f.pods || []).reduce((a, p) => a + p.n, 0);
    return (units ? `Harvested ${units} into the store` : 'Pods recovered') + (pods ? ` · +${pods} pod${pods > 1 ? 's' : ''}` : '') + (f.blocked && f.blocked.length ? ` · ${f.blocked.length} waiting: the Silo is full` : '');
  }
  // story A8: PREP / PLANT / HARVEST / HARVEST ALL are the avatar's work. The tap queues it (avatar.js, avatarQueue.js);
  // the avatar walks to the plot, works it, and the action lands here, through act(), once. HARVEST ALL queues every
  // Fruited and Dead plot as its own harvest (Farming-Design §2.6). Deliver and sell are Farmhouse taps: at once.
  const AVATAR_WORK = new Set(['prep', 'plant', 'harvest']);
  function landFarm(action) {
    return act(action, FARM_TEXT[action.type] || null, (res) => {
      // a harvest landing (the avatar's work done): embers off each Fruited plot, dust off each dead one (story A9)
      if (r.impacts && res && res.farm && res.farm.plots) farmFx.harvest(res.farm.plots, o, r.impacts, FXK);
      if (sel) select(sel);
    });
  }
  function farmAct(a, arg) {
    const action = a === 'plant' ? { type: 'plant', plot: sel && sel.plot, pick: arg } : a === 'prep' || a === 'harvest' ? { type: a, plot: arg }
      : a === 'deliver' ? { type: 'deliver', crop: arg } : { type: a };
    if (AVATAR_WORK.has(action.type) && action.plot) { crew.enqueue(action); return; }
    if (action.type === 'harvestAll') {
      const ids = crew.harvestable(clockNow());
      if (ids.length) { for (const id of ids) crew.enqueue({ type: 'harvest', plot: id }); hud.toast(`Harvesting ${ids.length} plot${ids.length > 1 ? 's' : ''}`); return; }
    }
    landFarm(action);
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
    const key = JSON.stringify([tab, o.pads, o.building.map((b) => [b.pad, b.kind]), o.defenses.map((d) => [d.cell, d.kind]), o.harvesters ?? null, o.online, ctx.gold, ctx.unlockedTiers, [...(ctx.unlocks || [])], [...(ctx.techOwned || [])].filter((x) => /^dock/.test(x)),
      tab === 'farm' && o.farm ? [Object.values(o.farm.plots).map((q) => [q.x, q.y]), Object.values(o.farm.buildings).map((q) => [q.x, q.y]), ctx.methods] : null]);
    if (force || key !== menuKey) {
      menuKey = key; menuItems = tab === 'farm' ? farmMenu(o, map, ctx) : buildMenu(o, map, ctx);
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
  // Owner 2026-11-10: "the defenses in the outpost need the same range ux as resource gathering maps" [MM-story_mwb3y3zr_1z].
  // Not placing: a selected defense is the battle renderer's selected structure (outpost defense d → structure 'od-' +
  // d.id, conduits.js defenseStructures), so render3d/overlays/coverage.js draws exactly what a battle map does: a bright
  // dashed ring at its range and a faint ring over every other defense of its kind, overlaps stacking brighter.
  const idleUi = () => (sel && sel.defense ? { selectedStructureId: 'od-' + sel.defense } : {});
  /** Bring the scene and the banner to the placement state. */
  function applyPlacement() {
    const it = pl.phase === 'idle' ? null : armedItem();
    if (!it) { scene.showPads(null); scene.showCells(null); scene.showGhost(null); farm.showTargets(null); farm.showGhost(null); hud.banner(null); ui3d = idleUi(); hud.online(tab === 'farm' ? null : onlineChecks()); return; }
    hud.online(null);
    const T = it.targets || [], valid = aimValid(pl, T), price = it.cost != null ? ` · ${fmtGold(it.cost)} gold` : '';
    if (it.what) {   // a FARM item: a w × h piece of farm ground (story A7)
      scene.showPads(null); scene.showGhost(null); scene.showCells(null); ui3d = {};
      farm.showTargets(T.map((t) => ({ x: t.cell[0], y: t.cell[1], w: it.size.w, h: it.size.h })));
      const c = pl.target && pl.target.cell;
      farm.showGhost(c ? { x: c[0], y: c[1], w: it.size.w, h: it.size.h, valid } : null);
      const touchAim = pl.phase === 'aimed' && valid && lastPointer === 'touch';
      hud.banner(touchAim ? `${titleCase(it.label)}${price}` : `Place a ${titleCase(it.label)} on lit farm ground${price}`, { confirm: touchAim });
      return;
    }
    farm.showTargets(null); farm.showGhost(null);
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
    if (effect && effect.type === 'invalid') hud.toast(armedItem() && armedItem().what ? 'Pick lit farm ground' : armedItem() && armedItem().place === 'pad' ? 'Pick a lit pad' : 'Defenses go on the lit ring', true);
    if (effect && effect.type === 'place' && effect.item.what) {   // a FARM item (story A7)
      const it = effect.item, t = effect.target;
      const res = act({ type: 'farmPlace', what: it.what, id: it.id, cell: t.cell }, () => (it.what === 'plot' ? `${titleCase(it.label)} placed · prepping` : `${titleCase(it.label)} under construction`), () => {});
      if (res && res.ok) { pl = placementStep(pl, { type: 'placed' }, T).state; hover = null; refreshMenu(true); }
    } else if (effect && effect.type === 'place') {
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
    if (it.what) {   // a farm piece: the valid top-left whose rect holds the pointed cell, nearest first, else the cell
      const T = it.targets || [];
      for (let dy = 0; dy < it.size.h; dy++) for (let dx = 0; dx < it.size.w; dx++) {
        const c = [cell.x - dx, cell.y - dy];
        if (T.some((t) => t.cell[0] === c[0] && t.cell[1] === c[1])) return { cell: c };
      }
    }
    return { cell: [cell.x, cell.y] };
  }
  // the outpost buildings' pictures, rendered from their GLBs once the kit is loaded (menuIcons.js)
  const iconSlugs = ['power', 'storage', ...new Set(oresOf(planet).map((x) => `rig_${x.rig}`)), 'resourceBay', 'upgradeBay', 'habitat'].filter((x) => kit.manifest[x]);
  renderMenuIcons(THREE, r.renderer, kit, iconSlugs).then((m) => { icons = m; if (!closed) refreshMenu(true); }).catch((e) => console.warn('[outpost] menu icons', e));

  let panelKey = '';
  /** The farm panel's context: the store's room for the Silo rule (owner rule 4) and the contract's deliveries. */
  const farmCtx = () => { const c = ctxNow(); return { ...c, now: clockNow(), gold: bank(), room: Math.max(0, storeCapacity(o, map) - (c.heldTotal || 0)) }; };
  function farmRect(next) {
    if (!o.farm) return null;
    const q = next.plot ? o.farm.plots[next.plot] : next.farm ? o.farm.buildings[next.farm] : null;
    return q ? { x: q.x, y: q.y, w: q.w, h: q.h } : null;
  }
  function select(next, focus = false) {
    if (next && (next.plot || next.farm)) {   // a farm plot or farm building (story A7)
      sel = next;
      if (pl.phase !== 'idle') cancelPlacing();
      else ui3d = {};
      scene.select(null); scene.showReach(null);
      farm.select(farmRect(next));
      const m = farmPanelModel(o, map, next, farmCtx());
      panelKey = JSON.stringify(m);
      hud.panel(m, next);
      return;
    }
    farm.select(null);
    sel = next;
    scene.select(next && (next.pad ? { pad: next.pad } : next.defense ? { cell: (o.defenses.find((d) => d.id === next.defense) || {}).cell } : null));
    if (!next) { hud.panel(null); panelKey = ''; scene.showReach(null); if (pl.phase === 'idle') ui3d = {}; refocus(); return; }
    if (pl.phase !== 'idle') cancelPlacing();
    else ui3d = idleUi();
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
    const m = sel.plot || sel.farm ? farmPanelModel(o, map, sel, farmCtx()) : panelModel(o, map, sel, { ...ctxNow(), now: clockNow(), gold: bank() });
    if ((sel.plot || sel.farm) && !m) { select(null); return; }
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
    const LIST = tab === 'farm' ? FARM_MENU : MENU;
    if (/^[0-9]$/.test(e.key) && LIST[(+e.key + 9) % 10]) { pickItem(LIST[(+e.key + 9) % 10].id); e.preventDefault(); return; }   // 1–9, then 0 for the tenth
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
    if (cell && o.farm) {
      const f = farmAt(o, cell.x, cell.y);
      if (f) return select(f, true);
    }
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
    hud.online(pl.phase !== 'idle' || tab === 'farm' ? null : onlineChecks());   // the GO ONLINE card steps aside while placing (and on the FARM tab)
    scene.setWarnings(buildingWarnings(o, map), markerOf);
    { const off = powerGrids(o, map).off; scene.setDefenseWarnings(o.defenses.filter((d) => off[d.id]).map((d) => ({ id: d.id, cell: d.cell }))); }
    refreshMenu();
    if (force) refreshPanel();
  }
  const siteFx = createConstructionFx({ seed: 41 });
  let frameNo = 0;

  // ── probes (visitProbe.js; owner 2026-11-09): now and then a light tank and a trooper come at the online outpost, on the
  // battle sim, drawn live with the battle renderer. Their wear on the defenses is saved; they take no ore. Off in safe
  // mode (a phone that lost the tab gets the lightest view).
  let probe = null, probeN = 0, probeT = 0, probeWait = safe ? Infinity : probeDelay(o.seed, 0), probeEvents = [];
  const probeUnitIds = new Set();
  function clearProbeUnits() { for (const id of probeUnitIds) state.units.delete(id); probeUnitIds.clear(); }
  function endProbe() {
    const breached = probeBreached(probe), wear = probeWear(o, probe), cells = o.farm ? probeCells(probe) : [];
    probe = null; probeN++; probeWait = probeDelay(o.seed, probeN);
    clearProbeUnits(); state.projectiles = [];
    if (wear.length || cells.length) { const res = session.act({ type: 'probeWear', wear, cells }, clockNow()); if (res.ok) { o = res.outpost; onChange(); } }
    syncDefenses(); refreshHud(true);
    hud.toast(breached ? 'Raiders hit the base and pulled back' : 'Raiders driven off');
    crumb(`outpost: probe ${probeN} ${breached ? 'reached the base' : 'driven off'} · wear ${wear.length}`);
  }
  function stepProbe(dt) {
    probeEvents = [];
    if (!probe) {
      if (!o.online || saleRun || closed || hud.reportOpen || pl.phase !== 'idle') return;   // not over the away report or a placement
      probeWait -= dt;
      if (probeWait > 0) return;
      try { probe = startProbe(o, probeN, { map, powered: [...powerGrids(o, map).powered] }); } catch (e) { console.warn('[outpost] probe', e); probe = null; }
      if (!probe) { probeWait = Infinity; return; }
      probeT = 0; hud.toast('Raiders inbound!', true); crumb(`outpost: probe ${probeN + 1} inbound`);
      return;
    }
    probeT += dt;
    probeEvents = probe.step(dt);
    if (probe.done || probeT > PROBE_MAX_S) { endProbe(); return; }
    // draw it: the raiders, the defenses as the probe's sim has them (HP, aim, fire) and its shots
    clearProbeUnits();
    for (const [id, u] of probe.state.units) if (u.side === 'attacker') { state.units.set(id, u); probeUnitIds.add(id); }
    syncDefenses();
    const inProbe = new Set(probe.defenseIds.values()), m = new Map();
    for (const s of state.structures.values()) if (!inProbe.has(s.outpostId) || s.onBay) m.set(s.id, s);
    for (const [sid, s] of probe.state.structures) { const did = probe.defenseIds.get(sid); if (did != null) { s.outpostId = did; m.set(sid, s); } }
    state.structures = m;
    state.projectiles = probe.state.projectiles || [];
  }
  function frame(t) {
    if (closed) return;
    raf = win.requestAnimationFrame(frame);
    frameNo++;
    // how far the first frames get, for a phone that loses the tab (the error report's crumbs)
    if (frameNo === 1 || frameNo === 30 || frameNo === 180) crumb(`outpost: frame ${frameNo} · ${gpuLine(r)}`);
    const t0 = performance.now();
    const raw = Math.max(0, t - last), dt = Math.min(0.1, raw / 1000);
    last = t;
    // the sale clock runs first, before anything that could throw: past its timeline (plus grace) the sale ends no
    // matter what, so the BUILD rail and the HUD always come back (owner 2026-11-10: iPhone, locked after SELL)
    if (saleRun) { saleRun.t += dt; if (saleRun.t > saleRun.tl.duration + SALE_GRACE) finishSale('watchdog'); }
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
    farm.sync(o, clockNow()); farm.update(dt);
    crew.shelter(!!probe);   // a raid: the avatar and the farmhands wait it out at the Farmhouse (§10); never targets
    crew.update(dt);
    driveClock += dt;
    syncHarvesters();
    syncRepairDrones();
    stepProbe(dt);
    if (liveAcc === 0) syncFieldStock();
    const out = scene.update(dt, o);
    // dust and welding sparks on every building under construction (constructionFx.js, the battle's build + repair FX)
    if (r.impacts) {
      siteFx.step(dt, constructionSites(o, map, clockNow()), r.impacts.emit, FXK, r.impacts.ring, r.tier.key);
      siteFx.stepDamage(dt, damageSites(o), r.impacts.emit, FXK);   // red sparks off damaged defenses (owner 2026-11-09)
      farmFx.step(dt, o, r.impacts, FXK);   // a few embers drifting off each Fruited plot (none in safe mode)
    }
    if (saleRun) {
      if (out.sale && out.sale.gold != null) shownGold = out.sale.gold;
      if (out.sale && out.sale.done) finishSale(out.sale.failed ? 'failed: ' + out.sale.failed : null);
      else if (scene.saling === false && saleRun.t > 0.5) finishSale('scene idle');   // the scene ended it without telling us
      else hud.update(hudModel(o, map, { gold: bank(), now: clockNow(), unlocks: ctxNow().unlocks }), shownGold);
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
    renderFrame(r, state, ui3d, probeEvents, dt);
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
  /** End the sale: unlock the rail and the HUD. why (null on a normal finish) goes to the error report's crumbs. */
  function finishSale(why) {
    if (!saleRun) return;
    saleRun = null; shake = null;
    if (why) { crumb('outpost: sale ended early · ' + why); try { scene.cancelSale(); } catch (e) { /* tidy-up only */ } }
    shownGold = bank();
    hud.setBusy(false);
    refreshHud(true);
  }

  function close() {
    if (closed) return;
    closed = true;
    crumb('outpost: closed');
    win.cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx);
    doc.removeEventListener('keydown', onKey);
    // a sale in flight is already banked; settle what the screen shows
    try { session.live(clockNow()); } catch (e) { console.warn('[outpost] close', e); }
    scene.dispose();
    farm.dispose();
    crew.dispose();
    destroyRenderer(r);
    hud.dispose();
    host.remove();
    onChange();
    resolveClosed();
  }

  autoFit();
  hud.tabs(!!o.farm, tab);
  refreshHud(true);
  if (tab === 'farm') hud.online(null);
  clearTimeout(stage.watchdog);
  if (stage.abandoned) { close(); return { closed: closedP, close, handle }; }
  loading.remove();
  crumb(`outpost: open · ${gpuLine(r)}${safe ? ' · SAFE MODE' : ''}`);
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
    /** The FARM tab (review / screenshots): switch tabs, run a farm action, read the farm picture's counts. */
    setTab, farmAct, get tab() { return tab; }, farm,
    /** The harvest effect (review): embers({ plot, kind, level, cycle }[]) plays it on those plots now; its counts. */
    embers: (plots) => (r.impacts ? farmFx.harvest(plots, o, r.impacts, FXK) : null), get emberStats() { return { ...farmFx.stats }; },
    /** The surface avatar and farmhands (story A8): { avatar: { x, z, pose, height }, queue, idle, landed, sheltering, farmhands, rigs, home }. */
    get crew() { return crew.info(); }, get safe() { return safe; },
    /** Visit probes (review): bring the next one now; read the one running ({ n, t, raiders, done } or null). */
    probeNow() { if (!probe) probeWait = 0; },
    get probe() { return probe ? { n: probeN + 1, t: probeT, raiders: [...probe.state.units.values()].filter((u) => u.side === 'attacker').length, done: probe.done } : null; },
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
