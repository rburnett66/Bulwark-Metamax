/**
 * src/outpost/view/sessionView.js — the outpost on the shared BATTLE SESSION [MM-subtask_mwciiylh_31]
 * (S2.4a of One Battle UX, TECH_PLAN::One-Battle-UX.md §4). Since S2.4d [MM-story_mwc9pkcd_2g] this IS the outpost,
 * and since S6 the farm too: the menu's one OUTPOST button opens it (opts.tab 'farm' opens on the rail's FARM tab); the
 * old pad-based outpost view and the farm view after it are deleted.
 *
 * Owner 2026-11-11: "users are trained to work with camera, characters, and structure in one pattern … we should never
 * have to change UX in two places." So this view writes no input, camera, placement, build rail, selection panel or
 * frame loop of its own. It:
 *   1. catches the outpost up (the save session's away catch-up, as the old view does);
 *   2. turns it into a live battle SimState (outpost/liveSim.js toLiveSim);
 *   3. runs it on createBattleSession (battle/session.js) — the battle's 3D view, camera, tap/select, build rail with
 *      the OUTPOST catalogue, selection panel (upgrade / sell / repair are battle commands), HUD and clock;
 *   4. draws the outpost's own art on that 3D view: the building models, conduits and deposits (outpostScene.js), fed
 *      from the live state;
 *   5. on leaving, writes the live state back (fromLiveSim) and banks the gold.
 *   6. shows the outpost's OWN controls as a battle-HUD panel (session.addPanel, S2.4b [MM-subtask_mwciizyc_32]):
 *      online status + GO ONLINE, storage and loads + SELL, REPAIR ALL, the away report, LEAVE. Those are outpost
 *      economy (no battle equivalent), so they run the save session's own rules (session.js act) — the live state is
 *      written back first and rebuilt after, never a second copy of those rules.
 *   7. fog of war (S5 [MM-story_mwc9q0yy_2m]): the battle's own — render3d's fog tracker runs on the live state as in a
 *      battle (fogWindow(state, map)); this view adds no fog code. The outpost has no wave windows, so the whole board
 *      is the play area and the battle's open-board cloud bank rings the map's edge (no enemy is hidden as a contact).
 *   8. the rail's pictures: an outpost defense shows its battle tower's baked picture (render/buildIcons.js resolves
 *      OUT-<kind> through towerStructId); a building shows its GLB rendered by menuIcons.js (the old menu's pictures),
 *      handed to the battle rail with hud.setBuildPicture — one rail, one picture slot.
 *   9. THE FARM (S6 [MM-story_mwc9q1y6_2n], one view [MM-story_mwcgbd9q_2y]; owner 2026-11-11: "outpost and farm are
 *      the same view, but the difference is the Purchase window on the left"): once the planet has a farm, the battle
 *      rail has BUILD | FARM tabs (battle/catalogue.js). FARM lists plots, the Silo and Pump, and crops
 *      (farm/farmRail.js); they are armed, ghosted and checked by the battle placement (farm/farmRail.js
 *      farmGroundRule in state.placementRules), then handed to the save session's farm actions (session.js act farmPlace,
 *      plant, prep, harvest, harvestAll, deliver, farmSell) through actOnSave — the farm's rules run once, in
 *      farm/model.js. A tap on a plot or a farm building (the battle input's onGroundTap) shows its panel in this view's
 *      panel; the farm's 3D picture (farm/view/farmLayer.js), the avatar and farmhands (avatar.js) and the harvest embers
 *      (embers.js) are mounted on the session's own 3D scene, as outpostScene.js is. Raiders that cross the farm during
 *      a visit raid trample it as a raid does (visitRaids.js takeCells → act trample).
 *  10. a selected building or defense shows the battle's selection panel itself [MM-task_mwcuvn8l_3i]: the outpost panel
 *       (6) steps aside while something is selected, and the outpost's extras (status line, SELL RESOURCES, DEEP SEAM)
 *       are drawn inside the battle panel through its selectionExtras hook (outpostSelectionExtras below).
 *       A plot or farm building is not a sim structure: its tap (9) selects none, so the panel — with its farm section —
 *       stays in the corner; selecting a structure clears the farm selection (refreshPanel).
 */
import { createBattleSession } from '../../battle/session.js';
import { createCatalogue, lockRule } from '../../battle/catalogue.js';
import { createUiState } from '../../input/input.js';
import { flashMessage } from '../../render/hud.js';
import { applyCommand } from '../../sim/core.js';
import { outpostStructId, OUTPOST_BUILDING_KINDS } from '../../data/outpostStructures.js';
import { DEFENSE_KINDS } from '../../data/outpost.js';
import { getStructureDef } from '../../data/tables.js';
import { toLiveSim, fromLiveSim, syncHarvestPower } from '../liveSim.js';
import { ghostPowerOf, powerWarning } from '../placementRules.js';
import { createVisitRaids } from '../visitRaids.js';
import { validatePlacement } from '../../sim/structures.js';
import { isFarmStructId } from '../../data/farmStructures.js';
import { cropOf } from '../../data/farm.js';
import { hasFarm } from '../../farm/contract.js';
import { farmRailIds, farmRailLocks, farmGroundRule, farmThingAt, grownFarm } from '../../farm/farmRail.js';
import { farmPanelModel, farmRailGlyph } from '../../farm/view/farmUi.js';
import { storeCapacity } from '../../farm/model.js';
import { createFarmLayer } from '../../farm/view/farmLayer.js';
import { createFarmEmbers } from '../../farm/view/embers.js';
import { createFarmCrew } from '../../farm/view/avatar.js';
import { K as FXK } from '../../render3d/fx/impacts.js';
import { outpostMapFor } from '../outpostMap.js';
import { outpostBattleMap, bakedSlugFor } from './outpostBoard.js';
import { createOutpostScene } from './outpostScene.js';
import { planBuildings, planPowerIcons, withCuts } from './conduits.js';
import { createOutpostKit, modelSlug } from '../../render3d/outposts/outpostModels.js';
import { renderMenuIcons, OUTPOST_GLYPHS } from './menuIcons.js';
import { oresOf } from '../../data/ores.js';
import { createSession, onlineIssues, repairAllCost } from './session.js';
import { upgradeGridShort } from '../model.js';
import { hudModel, panelModel, sellButton, fmtGold, harvesterTile } from './hudModel.js';
import { awayReportModel } from './awayReport.js';
import { loadSave, updateSave } from '../../save/save.js';
import { loadMissionCatalog } from '../../save/missionCatalog.js';
import { crumb } from '../../diag/errorLog.js';

const ROOT = new URL('../../../', import.meta.url).href;   // the game root (prototype/test-game/)

/** Has any repair drone finished its work by `now`? (the outpost's d.repair = { at, arrive, done }) */
export const repairDue = (o, now) => !!(o && o.defenses && o.defenses.some((d) => d.repair && d.repair.done <= now));

/** The buildings that hold ore: their selection carries SELL RESOURCES (the old outpost panel's rule, owner 2026-11-09). */
const HOLDS_ORE = new Set(['rig', 'storage', 'resourceBay']);

/**
 * The outpost's extras for a structure selected in the battle selection panel (render/hud.js selectionExtras): only what
 * the battle has no equivalent for. s: the live sim structure; ids: the live link's sim id → { pad } | { defense };
 * outpost: the save shape now; ctx: the save session's ctx; act(action): runs an outpost-economy action on the save.
 * → { lines, actions: [{ label, enabled, title, run }] } | null (a structure placed this visit has no save identity yet:
 * the battle panel alone).
 *   - a building: its status line (power / online — hudModel.panelModel's, as the old outpost panel read it), always;
 *     a defense: the status line only when it has no power (its state is the battle's own line);
 *   - SELL RESOURCES on a building that holds ore (the bottom SELL's sale, in the same state);
 *   - DEEP SEAM / SHALLOW SEAM on a Mining Station (needs Deep Drilling I).
 */
export function outpostSelectionExtras(s, { ids, outpost, map, ctx = {}, now, gold = 0, act = () => {} }) {
  const e = s && ids ? ids.get(s.id) : null;
  if (!e || (!e.pad && !e.defense)) return null;
  const m = panelModel(outpost, map, e.pad ? { pad: e.pad } : { defense: e.defense }, { ...ctx, now, gold });
  if (!m) return null;
  const lines = [], actions = [];
  if (e.pad || m.tone === 'off') lines.push(m.status);
  if (e.pad && HOLDS_ORE.has(m.kind)) {
    const sb = sellButton(hudModel(outpost, map, { gold, now }));
    actions.push({ label: 'SELL RESOURCES' + (sb.enabled ? ' · ' + sb.sub : ''), enabled: sb.enabled, title: sb.enabled ? '' : 'Sell: ' + sb.sub,
      run: () => act({ type: 'sell' }) });
  }
  if (e.pad && m.deep) {
    const on = !m.deep.on;
    actions.push({ label: on ? 'DEEP SEAM' : 'SHALLOW SEAM', enabled: m.deep.enabled, title: m.deep.note,
      run: () => act({ type: 'deep', pad: e.pad, on }) });
  }
  return { lines, actions };
}

/** The outpost's build list on the battle rail: its buildings (the hub is the base, never built), then its defenses. */
export function outpostCatalogueIds() {
  return [...OUTPOST_BUILDING_KINDS.filter((k) => k !== 'hub'), ...DEFENSE_KINDS].map(outpostStructId);
}

/** Bank the visit: the outpost back into the save and the gold into the player's bank (save/session.js goldAdd's field). */
function bankVisit(store, planet, outpost, gold) {
  store.update((s) => {
    s.outposts = s.outposts || {};
    s.outposts[planet] = outpost;
    s.carry = s.carry || { gold: 0, structures: [] };
    s.carry.gold = Math.max(0, Math.round(gold));
    s.goldBank = s.carry.gold;
  });
}

/** Open the outpost. A failure while opening takes its full-screen host away again (never a dead end over the menu). */
export async function openOutpostSessionView(opts = {}) {
  const opening = { host: null };
  try { return await openSession(opts, opening); } catch (e) {
    console.error('[outpost] the outpost failed to open', e);
    crumb('outpost: failed to open · ' + ((e && e.message) || e));
    if (opening.host) opening.host.remove();
    throw e;
  }
}

async function openSession(opts, opening) {
  const planet = opts.planet || 'ground';
  const doc = (opts.mount && opts.mount.ownerDocument) || document;
  const mount = opts.mount || doc.body;
  const win = doc.defaultView;
  const clockNow = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const store = opts.store || { load: loadSave, update: updateSave };
  const reduced = opts.reduced ?? !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  crumb('outpost: session view');

  // the full-screen host the battle session mounts in
  const host = doc.createElement('div');
  host.className = 'outpost-view outpost-session';
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2000', background: '#0f1412', overflow: 'hidden', touchAction: 'none' });
  mount.appendChild(host);
  opening.host = host;

  const map = opts.map || await outpostMapFor(planet);
  const catalog = opts.catalog !== undefined ? opts.catalog : await loadMissionCatalog().catch(() => null);
  const saveSession = createSession({ store, planet, map, catalog, raidHook: opts.raidHook });
  if (!store.load().outposts || !store.load().outposts[planet]) { host.remove(); throw new Error(`no outpost on ${planet}`); }
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  const opened = await saveSession.openChunked(clockNow(), nextFrame);   // the away catch-up
  // the OUTPOST catalogue on the battle rail; a lock is refused by the sim too. With a farm on this planet the rail has
  // two tabs, BUILD (the outpost's equipment) and FARM (plots, farm machinery, crops) — one rail, one placement (S6)
  const save0 = store.load();
  const farmed = hasFarm(save0, planet) || !!opened.outpost.farm;
  const farmIds = farmed ? farmRailIds(save0, planet) : [];
  const catalogue = createCatalogue(farmed
    ? [{ id: 'build', label: 'BUILD', ids: outpostCatalogueIds() }, { id: 'farm', label: 'FARM', ids: farmIds }]
    : outpostCatalogueIds());
  if (farmed && opts.tab === 'farm') catalogue.setTab('farm');   // a deep link to the farm opens on its tab
  // the live state, (re)built from the save — on arrival and after an outpost-economy action (actOnSave below)
  let t0 = 0, live = null, sim = null, raids = null;
  // the farm as last grown (farmNow), the selected plot / farm building, and the save context the FARM locks were read from
  let farmMemo = null, farmSel = null, farmLocksOf = null;
  // the ghost's power answer (S2b §5.2), from the outpost as last read (`view`, refreshed a few times a second below):
  // the battle's shared ghost goes amber on its warning, and the preview conduit draws its route
  let view = null;
  const ghostOf = ghostPowerOf(() => view, map);
  function rebuild(outpost, gold) {
    // visit raids (S2.4c): the probe count and the countdown carry over a mid-visit rebuild (a sale, going online)
    const carry = raids ? { probes: raids.probes, nextIn: Math.max(0, raids.nextAt - sim.time) } : {};
    t0 = clockNow();
    // the save's owned tech rides along: the live upgrade command asks the outpost's own rule (model.upgradeRefusal)
    const { unlocks, techOwned } = saveSession.ctx(t0);
    live = toLiveSim(outpost, { map, now: t0, gold, unlocks, techOwned });
    sim = live.state;
    sim.placementRules = [...(sim.placementRules || []), lockRule(catalogue)];
    // legal but unpowered → the shared ghost's amber (sim/structures.js placementWarnings → ui.hoverWarn)
    sim.placementWarnings = [...(sim.placementWarnings || []), powerWarning(() => view, map, ghostOf)];
    // the farm's ground (S6): a farm item goes only where the farm model allows it, a crop only on a prepped plot, and an
    // outpost structure never on a plot (the sim does not hold the farm as structures) — farm/farmRail.js
    sim.placementRules.push(farmGroundRule(() => farmNow(), map, () => ({ now: nowOf(), cellOk: ctxNow().cellOk })));
    // small raids come while the player is here, once the outpost is online (owner rules §5b) — waves of the live sim
    raids = outpost.online ? createVisitRaids(sim, { planet, seed: outpost.seed, ...carry }) : null;
  }
  rebuild(opened.outpost, saveSession.gold());
  // the clock the save sees: the arrival time plus the sim's own time (the sim never reads the wall clock)
  const nowOf = () => t0 + Math.round(sim.time * 1000);
  let ui = createUiState();
  let closed = false;
  let hud = null;
  const submit = (cmd) => {
    if (cmd && cmd.type === 'place' && isFarmStructId(cmd.structId)) return placeFarmItem(cmd);
    const warn = cmd && cmd.type === 'place' ? ui.hoverWarn : null;
    const res = applyCommand(sim, cmd);
    if (!res.ok && res.reason && hud) flashMessage(hud, res.reason);
    else if (res.ok && warn && hud) flashMessage(hud, 'Built unpowered · ' + warn);
    return res;
  };

  let bakeTune = {};
  try { const t = JSON.parse(win.localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') bakeTune = t; } catch (_) { /* default */ }
  const board = outpostBattleMap(map, { bakeTune });
  const slug = await bakedSlugFor(map, { base: ROOT });
  const session = createBattleSession(host, {
    getSim: () => sim, getUi: () => ui, submit, mapId: 0, catalogue, onGroundTap: (cell) => tapFarm(cell),
    mountOptions: () => ({ planet, landing: false, landingHeld: true,
      render3d: { baseUrl: ROOT, craft: false, landing: false, qualityQuery: opts.tier || null } }),
  });
  // the battle rail's HARVESTER tile sells the OUTPOST's harvesters (S4 follow-up, owner 2026-11-11): its price and
  // refusals from the model, the purchase through the save session (act 'buyHarvester'), the live state rebuilt with the truck
  hud = session.createHud({
    onMainMenu: () => close(),
    harvesterTile: () => harvesterTile(view || fromLiveSim(sim, live.link, nowOf()).outpost, ctxNow(), sim.economy.money),
    onBuyHarvesterUnit: () => { if (actOnSave({ type: 'buyHarvester' }).ok) flashMessage(hud, 'Harvester bought · it docks at the Resource Bay'); },
    // the battle's selection panel, with the outpost's extras inside it (render/hud.js selectionExtras) — no panel of its own
    selectionExtras: (s) => selectionExtras(s),
  });
  // the outpost buildings' glyphs on the battle rail until their GLB pictures are rendered (below)
  const RAIL_KINDS = OUTPOST_BUILDING_KINDS.filter((k) => k !== 'hub');
  for (const k of RAIL_KINDS) if (OUTPOST_GLYPHS[k] && hud.setBuildPicture) hud.setBuildPicture(outpostStructId(k), { glyph: OUTPOST_GLYPHS[k] });
  // the FARM tab's pictures: the farm glyphs the old farm menu drew (menuIcons.js), a crop's seed in its colour
  for (const id of farmIds) { const g = farmRailGlyph(id); if (g && hud.setBuildPicture) hud.setBuildPicture(id, { glyph: g }); }
  session.setBoard(board, 0);
  await session.mount3D(board, slug);
  const r = session.view3d;
  let scene = null, farmLayer = null, farmFx = null, crew = null;
  if (r) {
    if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);   // the hub model stands on the base
    const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
    const kit = await createOutpostKit(r.THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader });
    scene = createOutpostScene(r.THREE, r, { map, kit, tier: r.tier.key, reduced });
    const o = fromLiveSim(sim, live.link, nowOf()).outpost;
    const slugs = new Set(planBuildings(o, map, nowOf()).map((b) => modelSlug(b.kind, b.tier, b.rigHead)).filter(Boolean));
    if (farmed) for (const k of ['farmhouse', 'silo', 'pump']) if (kit.manifest[k]) slugs.add(k);
    // the farm on this same scene (S6): its plots and plants, its buildings, the avatar and farmhands, the harvest embers
    if (farmed) {
      farmLayer = createFarmLayer(r.THREE, r, { map, kit, reduced });
      farmFx = createFarmEmbers({ safe: false });
      crew = createFarmCrew(r.THREE, r, { map, board, safe: false, reduced, land: (a) => landFarm(a), busy: () => false });
      const fo = farmNow();
      farmLayer.sync(fo, nowOf()); crew.sync(fo);
    }
    await kit.preload([...slugs]);
    // the buildings' pictures for the rail, rendered from their GLBs (menuIcons.js, as the old build menu does)
    const rigHead = (oresOf(planet)[0] || {}).rig;
    const iconSlug = new Map(RAIL_KINDS.map((k) => [k, modelSlug(k, 1, rigHead)]).filter(([, sl]) => sl && kit.manifest[sl]));
    renderMenuIcons(r.THREE, r.renderer, kit, [...new Set(iconSlug.values())]).then((pics) => {
      if (closed) return;
      for (const [k, sl] of iconSlug) if (pics[sl]) hud.setBuildPicture(outpostStructId(k), { src: pics[sl] });
    }).catch((e) => console.warn('[outpost] rail pictures', e));
  }

  // the outpost's art follows the live state: re-read the save shape a few times a second (cheap), animate each frame
  let since = 1, ctx = null, dt = 1 / 60;
  /** The armed build tool's power answer at the hover cell (placementRules.js ghostPowerOf, memoised), or null. */
  function ghostNow() {
    if (!ui.buildSelection || !ui.hoverCell || !ui.hoverValid) return null;
    let def = null;
    try { def = getStructureDef(ui.buildSelection); } catch (e) { return null; }
    return ghostOf(def, ui.hoverCell, ui.buildSelection);
  }
  /** The preview conduit for the armed build tool: the ghost's route to the node it would join, or nothing. */
  function previewPlan(gp = ghostNow()) {
    return gp && gp.route ? { points: gp.route.points, warn: !!gp.reason } : null;
  }
  // the power icons over the buildings (#282 answer 1): planned once per re-read of the outpost; an armed placement's
  // cuts (the buildings it would switch off) turn theirs to the warning state, every frame, without a grid run
  let icons = { of: null, list: [] };
  function powerIconsNow(gp) {
    if (icons.of !== view) icons = { of: view, list: view ? planPowerIcons(view, map) : [] };
    return withCuts(icons.list, gp && gp.cuts);
  }
  const ctxNow = () => ctx || (ctx = saveSession.ctx(nowOf()));

  // ── the outpost's own controls, in the battle HUD (S2.4b) ──────────────────────────────────────────────────
  // An outpost-economy action (sell ore, go online, repair all) is the save session's rule: write the live state back,
  // run it, rebuild the live state from the result. → the session's result ({ ok, error, gold, … }).
  function actOnSave(action, { keepTool = false } = {}) {
    const at = nowOf();
    const back = fromLiveSim(sim, live.link, at);
    bankVisit(store, planet, back.outpost, back.gold);
    const res = saveSession.act(action, at);
    if (!res.ok) {
      if (hud) flashMessage(hud, String(res.error || 'not now').replace(/^./, (c) => c.toUpperCase()));
      return res;
    }
    const s = store.load();
    const tool = keepTool ? ui.buildSelection : null;
    rebuild(s.outposts[planet], saveSession.gold());
    ui.selectedStructureId = null; ui.buildSelection = tool;   // a farm placement keeps its tool armed, as a battle build does
    ctx = null; view = null; since = 1; farmMemo = null; farmLocksOf = null;
    return res;
  }
  // ── the selected structure's outpost extras, drawn inside the BATTLE selection panel (render/hud.js) ──────────
  // A selected outpost building or defense shows the battle's panel (name, tier, state, HP, Upgrade / Sell / Repair as
  // battle commands on the live state); the outpost adds only what the battle has no equivalent for: the building's
  // status line (its power: hudModel.panelModel's, as the old outpost panel read it) and the outpost-economy actions
  // SELL RESOURCES (a building that holds ore) and DEEP / SHALLOW SEAM (a Mining Station), run through actOnSave.
  // Re-read at most twice a second (the battle HUD asks every frame).
  // (a rebuild makes a new sim whose ids restart: the cache is the sim's too)
  let extrasOf = { sim: null, id: null, at: -1, out: null };
  function selectionExtras(s) {
    if (extrasOf.sim === sim && extrasOf.id === s.id && sim.time - extrasOf.at < 0.5) return extrasOf.out;
    extrasOf = { sim, id: s.id, at: sim.time, out: outpostExtras(s) };
    return extrasOf.out;
  }
  function outpostExtras(s) {
    const v = view || fromLiveSim(sim, live.link, nowOf()).outpost;
    return outpostSelectionExtras(s, { ids: live.link.ids, outpost: v, map, ctx: ctxNow(), now: nowOf(), gold: sim.economy.money,
      act: (action) => {
        const r = actOnSave(action);
        if (!r.ok) return;
        if (action.type === 'sell') flashMessage(hud, 'Sold · +' + fmtGold(r.earned != null ? r.earned : 0) + ' gold');
        else if (action.type === 'deep') flashMessage(hud, action.on ? 'Deep seam: ¼ the speed, 5× the price' : 'Shallow seam');
      } });
  }

  // ── the FARM (S6): its state now, its placements, its taps and its actions — all through the save session ──────────
  // The farm's plants grow on the outpost's clock (advance → farm/grow.js); during a visit the picture and the rules read
  // the outpost as last saved, grown on to now (farm/farmRail.js grownFarm) once a second.
  function farmNow() {
    const base = view || fromLiveSim(sim, live.link, nowOf()).outpost;
    if (!base.farm) return base;
    const sec = Math.floor(nowOf() / 1000);
    if (!farmMemo || farmMemo.of !== base || farmMemo.sec !== sec) farmMemo = { of: base, sec, o: grownFarm(base, map, nowOf()) };
    return farmMemo.o;
  }
  /** A FARM item placed on the shared rail: the sim's own check (the ghost's answer), then the save session's action. */
  function placeFarmItem(cmd) {
    const chk = validatePlacement(sim, cmd.structId, cmd.cell);
    if (!chk.ok) { if (hud) flashMessage(hud, String(chk.reason || 'not here').replace(/^./, (c) => c.toUpperCase())); return { ok: false, reason: chk.reason }; }
    const def = getStructureDef(cmd.structId);
    if (def.farmItem === 'crop') {   // planting is the avatar's work: it walks to the plot, and the action lands then
      const at = farmThingAt(farmNow(), cmd.cell.x, cmd.cell.y);
      farmAct('plant', def.crop, at && at.plot);
      return { ok: true };
    }
    const res = actOnSave({ type: 'farmPlace', what: def.farmItem, id: def.farmId, cell: [cmd.cell.x, cmd.cell.y] }, { keepTool: true });
    if (res.ok && hud) flashMessage(hud, def.farmItem === 'plot' ? `${def.name} placed · prepping` : `${def.name} under construction`);
    return { ok: !!res.ok, reason: res.error };
  }
  /** The battle input's tap on open ground: a plot or a farm building there opens its panel. → whether it took the tap. */
  function tapFarm(cell) {
    const hit = farmThingAt(farmNow(), cell.x, cell.y);
    farmSel = hit;
    if (farmLayer) farmLayer.select(farmRect(hit));
    panelSince = 1;
    return !!hit;
  }
  function farmRect(sel) {
    const o = farmNow();
    const q = sel && o.farm ? (sel.plot ? o.farm.plots[sel.plot] : sel.farm ? o.farm.buildings[sel.farm] : null) : null;
    return q ? { x: q.x, y: q.y, w: q.w, h: q.h } : null;
  }
  const FARM_TEXT = {
    prep: () => 'Prepping the plot',
    plant: (res) => (`Planted ${res.farm && res.farm.planted ? (cropOf(res.farm.planted) || { name: res.farm.planted }).name : ''}`.trim() +
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
  /** A farm action lands (the avatar's work done, or a Farmhouse tap): one save-session act; embers off a harvest. */
  function landFarm(action) {
    const keep = farmSel;
    const res = actOnSave(action, { keepTool: true });
    farmSel = keep;
    if (!res.ok) return res;
    const text = FARM_TEXT[action.type] ? FARM_TEXT[action.type](res) : null;
    if (text && hud) flashMessage(hud, text);
    const r3 = session.view3d;
    if (farmFx && r3 && r3.impacts && res.farm && res.farm.plots) farmFx.harvest(res.farm.plots, store.load().outposts[planet], r3.impacts, FXK);
    panelSince = 1;
    return res;
  }
  // PREP / PLANT / HARVEST are the avatar's work (avatarQueue.js): queued, walked to, landed once. HARVEST ALL queues every
  // Fruited and Dead plot. DELIVER and SELL CROPS are the Farmhouse's: at once.
  const AVATAR_WORK = new Set(['prep', 'plant', 'harvest']);
  function farmAct(a, arg, plot = farmSel && farmSel.plot) {
    const action = a === 'plant' ? { type: 'plant', plot, pick: arg } : a === 'prep' || a === 'harvest' ? { type: a, plot: arg }
      : a === 'deliver' ? { type: 'deliver', crop: arg } : { type: a };
    if (AVATAR_WORK.has(action.type) && action.plot && crew) {
      crew.enqueue(action);
      if (hud) flashMessage(hud, a === 'plant' ? `Planting ${(cropOf(arg) || { name: arg }).name}` : a === 'prep' ? 'Prepping the plot' : 'Harvesting');
      return;
    }
    if (action.type === 'harvestAll' && crew) {
      const ids = crew.harvestable(nowOf());
      if (ids.length) { for (const id of ids) crew.enqueue({ type: 'harvest', plot: id }); if (hud) flashMessage(hud, `Harvesting ${ids.length} plot${ids.length > 1 ? 's' : ''}`); return; }
    }
    landFarm(action);
  }
  /** The FARM tab's locks (methods not unlocked, crops without pods), refreshed when the save changed. */
  function refreshFarmLocks() {
    if (!farmed) return;
    const c = ctxNow();
    if (farmLocksOf === c) return;
    farmLocksOf = c;
    const locks = farmRailLocks(store.load(), c, farmIds);
    const all = { ...catalogue.locks };
    for (const id of farmIds) delete all[id];
    catalogue.setLocks({ ...all, ...locks });
  }
  const panel = doc.createElement('div');
  panel.className = 'bw-panel op-session-panel';
  Object.assign(panel.style, { position: 'absolute', right: '8px', top: '56px', width: '210px', padding: '8px',
    display: 'flex', flexDirection: 'column', gap: '6px', font: '600 12px/1.3 Rajdhani, system-ui, sans-serif', color: '#cfd6dd', zIndex: '20' });
  const line = (cls) => { const d = doc.createElement('div'); d.className = cls; panel.appendChild(d); return d; };
  const title = line('op-s-title');
  title.style.font = '900 13px/1.2 Orbitron, sans-serif';
  title.style.letterSpacing = '.14em';
  const status = line('op-s-status');
  const threatLine = line('op-s-threat');   // raid threat: size · raids/day (hudModel.raidThreat) [MM-story_mwco8she_38]
  const storeLine = line('op-s-store');
  const btn = (label, fn) => {
    const b = doc.createElement('button');
    b.className = 'bw-btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    panel.appendChild(b);
    return b;
  };
  const onlineBtn = btn('GO ONLINE', () => {
    if (actOnSave({ type: 'online' }).ok) flashMessage(hud, 'OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.');
  });
  const sellBtn = btn('SELL', () => {
    const r = actOnSave({ type: 'sell' });
    if (r.ok) flashMessage(hud, 'Sold · +' + fmtGold(r.earned != null ? r.earned : 0) + ' gold');
  });
  const repairBtn = btn('REPAIR ALL', () => {
    const r = actOnSave({ type: 'repairAll' });
    if (r.ok) flashMessage(hud, 'Repair drones launched · −' + fmtGold(r.cost || 0) + ' gold');
  });
  btn('LEAVE', () => close());
  // the selected plot's / farm building's panel (S6): this panel's farm section, from the farm's own panel model
  // (farm/view/farmUi.js farmPanelModel); its buttons run farmAct. The outpost lines hide while it is open.
  const farmBox = doc.createElement('div');
  farmBox.className = 'op-s-farm';
  Object.assign(farmBox.style, { display: 'none', flexDirection: 'column', gap: '5px' });
  panel.appendChild(farmBox);
  let farmKey = '';
  function renderFarmPanel(m) {
    const key = JSON.stringify(m);
    if (key === farmKey) return;
    farmKey = key;
    farmBox.innerHTML = '';
    if (!m) return;
    const row = (text, style = {}) => { const d = doc.createElement('div'); d.textContent = text; Object.assign(d.style, style); farmBox.appendChild(d); return d; };
    row(m.title, { font: '900 13px/1.2 Orbitron, sans-serif', letterSpacing: '.1em' });
    if (m.status) row(m.status, { color: m.tone === 'ok' ? '#8cf22e' : m.tone === 'warn' || m.tone === 'off' ? '#ffb43c' : '#9ab' });
    for (const [k, v] of m.stats || []) row(k + ' · ' + v);
    for (const w of m.warnings || []) row(w.text, { color: '#ffb43c' });
    for (const a of m.actions || []) {
      const b = doc.createElement('button');
      b.className = 'bw-btn';
      b.textContent = a.label;
      b.disabled = !a.enabled;
      if (a.why) b.title = a.why;
      b.addEventListener('click', () => farmAct(a.act, a.arg));
      farmBox.appendChild(b);
    }
    if (m.note) row(m.note, { color: '#8a96a3', fontWeight: '500' });
    const x = doc.createElement('button');
    x.className = 'bw-btn';
    x.textContent = 'CLOSE';
    x.addEventListener('click', () => { farmSel = null; if (farmLayer) farmLayer.select(null); panelSince = 1; });
    farmBox.appendChild(x);
  }
  // the away report (what happened while the player was gone), once, on arrival
  const away = awayReportModel(opened.report, planet, map, catalog);
  if (away.show) {
    const rep = line('op-s-away');
    rep.style.borderTop = '1px solid #2b3540';
    rep.style.paddingTop = '6px';
    const rows = ['While you were away (' + away.away + ')', ...away.built,
      ...away.raids.map((x) => x.label + ' · ' + x.when + (x.lostText ? ' · ' + x.lostText : '')),
      ...(away.bounty ? ['+' + away.bounty + ' gold from raid kills'] : []),
      ...away.extracted.slice(0, 4).map((x) => '+' + x.units + ' ' + x.name)];
    rows.forEach((t, i) => { const d = doc.createElement(i ? 'div' : 'b'); d.textContent = t; rep.appendChild(d); });
  }
  session.addPanel(panel);
  let panelSince = 1;
  function refreshPanel() {
    refreshFarmLocks();
    // a battle selection (a structure or a unit) or an armed tool replaces a farm selection
    if (farmSel && (ui.selectedStructureId != null || ui.selectedUnitId != null || ui.buildSelection)) { farmSel = null; if (farmLayer) farmLayer.select(null); }
    let fm = null;
    if (farmSel) {
      const fo = farmNow(), c = ctxNow();
      fm = farmPanelModel(fo, map, farmSel, { ...c, now: nowOf(), gold: sim.economy.money, room: Math.max(0, storeCapacity(fo, map) - (c.heldTotal || 0)) });
      if (!fm) farmSel = null;
    }
    renderFarmPanel(fm);
    farmBox.style.display = fm ? 'flex' : 'none';
    for (const n of panel.children) if (n !== farmBox) n.hidden = !!fm;
    const v = view || fromLiveSim(sim, live.link, nowOf()).outpost;
    const h = hudModel(v, map, { gold: sim.economy.money, now: nowOf() });
    const issues = onlineIssues(v, map);
    title.textContent = 'OUTPOST';
    status.textContent = h.online ? (h.raidInbound ? 'Online · raid inbound' : 'Online') : ('Offline — ' + (issues.join('; ') || 'ready to go online'));
    threatLine.textContent = h.threat.text;
    storeLine.textContent = 'Storage ' + Math.floor(h.storage.units) + ' / ' + Math.floor(h.storage.cap) + ' · ' + (h.loads || 0) + (h.loads === 1 ? ' load' : ' loads') + ' ready';
    onlineBtn.style.display = h.online ? 'none' : '';
    onlineBtn.disabled = issues.length > 0;
    const sb = sellButton(h);
    sellBtn.textContent = sb.enabled ? ('SELL · ' + sb.sub) : ('SELL (' + sb.sub + ')');
    sellBtn.disabled = !sb.enabled;
    const rc = repairAllCost(v);
    repairBtn.style.display = rc > 0 ? '' : 'none';
    repairBtn.textContent = 'REPAIR ALL · ' + fmtGold(rc);
  }
  session.bindInput();
  session.start({
    paused: () => false,
    stopped: () => false,
    // power changes during the visit start or park the trucks (S4 follow-up): checked on the sim's tick count, every 15 ticks (half a sim second)
    // an upgrade (the battle's U command) that outgrows the grid goes ahead, flagged as the old view flags it: the save
    // model's own check on the live state written back (model.upgradeGridShort) [MM-story_mwcp7u7b_3a]
    afterStep: (s, evs) => {
      if (!evs || !evs.some((e) => e.type === 'upgradeStart')) return;
      try {
        const w = upgradeGridShort(fromLiveSim(sim, live.link, nowOf()).outpost, map);
        if (w) flashMessage(hud, 'Upgrade started · ' + w.replace(/^./, (c) => c.toUpperCase()));
      } catch (e) { console.warn('[outpost] upgrade grid check', e); }
    },
    afterTick: () => {
      if (raids) {
        raids.step();
        // a visit raid that crossed the farm tramples it as a raid does (Farming-Design §10): the cells its raiders
        // stood on, once it clears, through the save session (act trample → farm/model.js trample)
        const cells = farmed ? raids.takeCells() : null;
        if (cells && cells.length) { const keep = ui.selectedStructureId; actOnSave({ type: 'trample', cells }, { keepTool: true }); ui.selectedStructureId = keep; }
      }
      if (sim.tick % 15 === 0) syncHarvestPower(sim, live.link);
    },
    beforeFrame: (dtMs) => { dt = Math.min(dtMs / 1000, 0.25); },
    beforeHud: () => {
      panelSince += dt;
      if (panelSince >= 0.5) { panelSince = 0; try { refreshPanel(); } catch (e) { console.warn('[outpost] panel', e); } }
      if (!scene) return;
      since += dt;
      if (since >= 0.25 || !view) {
        since = 0;
        try { view = fromLiveSim(sim, live.link, nowOf()).outpost; scene.sync(view, nowOf(), ctxNow()); }
        catch (e) { console.warn('[outpost] scene sync', e); }
        if (farmLayer) {
          try { const fo = farmNow(); farmLayer.sync(fo, nowOf()); crew.sync(fo); if (farmSel) farmLayer.select(farmRect(farmSel)); }
          catch (e) { console.warn('[outpost] farm sync', e); }
        }
        // a repair drone finished its work during the visit: settle the save (its clock completes the repair, as it does
        // while away) and rebuild the live state, so the wreck stands again before the player leaves
        if (view && repairDue(view, nowOf())) { const keep = ui.selectedStructureId; actOnSave({ type: 'settle' }); ui.selectedStructureId = keep; }
      }
      try { const gp = ghostNow(); scene.setPreview(previewPlan(gp)); scene.setPowerIcons(powerIconsNow(gp)); } catch (e) { console.warn('[outpost] preview conduit', e); }
      try { scene.update(dt, view); } catch (e) { console.warn('[outpost] scene update', e); }
      if (farmLayer) {
        try {
          farmLayer.update(dt);
          crew.shelter(!!sim.waves.active);   // a raid: the avatar and the farmhands wait it out at the Farmhouse (§10)
          crew.update(dt);
          const r3 = session.view3d;
          if (r3 && r3.impacts) farmFx.step(dt, farmNow(), r3.impacts, FXK);   // embers drifting off each Fruited plot
        } catch (e) { console.warn('[outpost] farm update', e); }
      }
    },
  });

  let resolveClosed;
  const closedP = new Promise((ok) => { resolveClosed = ok; });
  function close() {
    if (closed) return;
    closed = true;
    try {
      const { outpost, gold } = fromLiveSim(sim, live.link, nowOf());
      bankVisit(store, planet, outpost, gold);
    } catch (e) { console.error('[outpost] could not save the visit', e); crumb('outpost: save failed'); }
    try { if (scene && scene.dispose) scene.dispose(); } catch (e) { /* already gone */ }
    try { if (farmLayer) farmLayer.dispose(); if (crew) crew.dispose(); } catch (e) { /* already gone */ }
    session.destroy();
    host.remove();
    try { if (win.Bulwark && win.Bulwark.outpost) delete win.Bulwark.outpost; } catch (e) { /* no window */ }
    resolveClosed();
  }
  refreshPanel();
  const handle = { session, get sim() { return sim; }, get live() { return live; }, get ui() { return ui; }, get raids() { return raids; }, get scene() { return scene; }, panel, actOnSave,
    // the farm (S6; review pages and the headless check): its tab, the picture's counts, the crew, a farm action, a tap
    catalogue, get farm() { return farmLayer; }, get crew() { return crew ? crew.info() : null; }, farmAct, tapFarm, farmNow,
    get farmSel() { return farmSel; } };
  // the open outpost for the review pages and the headless check (window.Bulwark is the game's diagnostics namespace)
  try { win.Bulwark = win.Bulwark || {}; win.Bulwark.outpost = handle; } catch (e) { /* no window */ }
  return { closed: closedP, close, handle };
}
