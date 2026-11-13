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
 *   6. shows the outpost's OWN controls in the battle HUD's shared pieces (AAA UX pass [MM-story_mwcuyrqr_3j], spec
 *      docs/16 Bulwark MM/design/Outpost-AAA-UX.md): the top bar's readouts (status / raid clock, power, storage, threat)
 *      and LEAVE as its primary action; the outpost CARD (render/hudCard.js — the selection panel's card) with what is
 *      gathered, the gauges and GO ONLINE · S SELL · R REPAIR ALL (data from outpostCard.js); the away report as the
 *      wave report's takeover on arrival. Those are outpost economy (no battle equivalent), so they run the save
 *      session's own rules (session.js act) — the live state is written back first and rebuilt after, never a second
 *      copy of those rules. The camera opens framed on the base (outpostBoard.js baseFrameRect → render3d frameRect).
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
 *  11. SELL plays the sale [MM-story_mwefm2or_j]: the sell action (the card's S SELL, a building's SELL RESOURCES) is
 *       banked at once, then saleDriver.js plays sellTimeline.js on the scene — the cargo shuttle lifts off the landing
 *       pad, the "$N" per load pops on the battle's own gold popups in the ore colour, and the top bar's gold counts up
 *       across the shuttle's arc (the battle HUD's opt-in goldShown hook) instead of jumping.
 */
import { createBattleSession, createModeHost } from '../../battle/session.js';
import { createCatalogue, lockRule } from '../../battle/catalogue.js';
import { createUiState } from '../../input/input.js';
import { flashMessage, showAwayReport } from '../../render/hud.js';
import { applyCommand } from '../../sim/core.js';
import { outpostStructId, OUTPOST_BUILDING_KINDS } from '../../data/outpostStructures.js';
import { DEFENSE_KINDS } from '../../data/outpost.js';
import { getStructureDef } from '../../data/tables.js';
import { PLANETS } from '../../data/planets.js';
import { toLiveSim, fromLiveSim, stepLiveOutpost, repairPriceOf } from '../liveSim.js';
import { ghostPowerOf, powerWarning } from '../placementRules.js';
import { createVisitRaids } from '../visitRaids.js';
import { validatePlacement } from '../../sim/structures.js';
import { isFarmStructId } from '../../data/farmStructures.js';
import { cropOf } from '../../data/farm.js';
import { hasFarm } from '../../farm/contract.js';
import { farmRailTab, farmGateReason, farmRailLocks, farmGroundRule, farmThingAt, grownFarm, farmRailLabel } from '../../farm/farmRail.js';
import { farmPanelModel, farmRailGlyph } from '../../farm/view/farmUi.js';
import { storeCapacity } from '../../farm/model.js';
import { createFarmLayer } from '../../farm/view/farmLayer.js';
import { createFarmEmbers } from '../../farm/view/embers.js';
import { createFarmCrew } from '../../farm/view/avatar.js';
import { K as FXK } from '../../render3d/fx/impacts.js';
import { outpostMapFor } from '../outpostMap.js';
import { outpostBattleMap, bakedSlugFor, baseFrameRect } from './outpostBoard.js';
import { outpostCardModel, outpostReadouts, farmCardModel, threatInfo } from './outpostCard.js';
import { createOutpostScene } from './outpostScene.js';
import { createSaleDriver } from './saleDriver.js';
import { planBuildings, planPowerIcons, withCuts } from './conduits.js';
import { createOutpostKit, modelSlug } from '../../render3d/outposts/outpostModels.js';
import { renderMenuIcons, OUTPOST_GLYPHS } from './menuIcons.js';
import { oresOf } from '../../data/ores.js';
import { createSession, onlineIssues, repairAllCost } from './session.js';
import { outpostResourceCard, harvesterHoldText, depositCardId } from './resourceCard.js';
import { harvesterHold } from '../../sim/harvest.js';
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
  // GO ONLINE on the hub (owner 2026-11-12: the OUTPOST panel and its GO ONLINE step aside while something is selected)
  if (e.pad && m.kind === 'hub' && !outpost.online) {
    const issues = onlineIssues(outpost, map);
    actions.push({ label: 'GO ONLINE', enabled: !issues.length, title: issues.length ? 'Go online: ' + issues.join('; ') : '', run: () => act({ type: 'online' }) });
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
  // the SELL sequence's player (saleDriver.js): fed by actOnSave's sell, stepped in beforeHud, read by the HUD's gold
  const saleRun = createSaleDriver({ reduced, crumb });

  // the full-screen host the battle session mounts in
  const host = createModeHost(mount, 'outpost-view outpost-session');   // styled by the battle HUD's sheet
  opening.host = host;

  const map = opts.map || await outpostMapFor(planet);
  const catalog = opts.catalog !== undefined ? opts.catalog : await loadMissionCatalog().catch(() => null);
  const saveSession = createSession({ store, planet, map, catalog, raidHook: opts.raidHook });
  if (!store.load().outposts || !store.load().outposts[planet]) { host.remove(); throw new Error(`no outpost on ${planet}`); }
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  const opened = await saveSession.openChunked(clockNow(), nextFrame);   // the away catch-up
  // the OUTPOST catalogue on the battle rail; a lock is refused by the sim too. The rail has two tabs, BUILD (the
  // outpost's equipment) and FARM (plots, farm machinery, crops) — one rail, one placement (S6). FARM is there before
  // farming opens too [MM-task_mwd2upbd_5] (owner 2026-11-12: "Even if farming is disabled the Farm menu should be active
  // to confirm my seed pod inventory"): every item padlocked with how farming opens, the pods held still counted. Its
  // layout is the shared rail's columns: machinery far left, the seeds beside it, scrolling (farm/farmRail.js farmRailTab)
  const save0 = store.load();
  const farmed = hasFarm(save0, planet) || !!opened.outpost.farm;
  const farmTab = farmRailTab(save0, planet);
  const farmIds = farmTab.layout.groups.flatMap((g) => g.ids);
  const catalogue = createCatalogue([{ id: 'build', label: 'BUILD', ids: outpostCatalogueIds() }, farmTab]);
  if (opts.tab === 'farm') catalogue.setTab('farm');   // a deep link to the farm opens on its tab
  // before farming opens: every FARM item's lock is the gate's reason (the ship's name from the mission catalogue) — the one
  // wording (farm/contract.js farmGate), which the OUTPOST panel's line shows too; refreshPanel re-reads it on the live
  // outpost, so both move on together
  const shipName = (((catalog && catalog.capitalShips) || {})[(PLANETS[planet] || {}).name] || {}).ship || null;
  let gateText = farmed ? null : farmGateReason(save0, planet, shipName);
  const lockFarmGate = (why) => {
    const all = { ...catalogue.locks };
    for (const id of farmIds) delete all[id];
    catalogue.setLocks(why ? { ...all, ...Object.fromEntries(farmIds.map((id) => [id, why])) } : all);
  };
  if (gateText) lockFarmGate(gateText);
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
  // the planet's names for its resources (data/planets.js), as the resource card names them: the selected truck's Target
  ui.resourceNames = Object.fromEntries(Object.entries((PLANETS[planet] || {}).resources || {}).map(([t, r]) => [t, r.name]));
  let closed = false;
  let hud = null;
  const submit = (cmd) => {
    if (cmd && cmd.type === 'place' && isFarmStructId(cmd.structId)) return placeFarmItem(cmd);
    const warn = cmd && cmd.type === 'place' ? ui.hoverWarn : null;
    const res = applyCommand(sim, cmd);
    if (!res.ok && res.reason && hud) flashMessage(hud, res.reason);
    else if (res.ok && warn && hud) flashMessage(hud, 'Built unpowered · ' + warn, 'info');
    return res;
  };

  let bakeTune = {};
  try { const t = JSON.parse(win.localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') bakeTune = t; } catch (_) { /* default */ }
  const board = outpostBattleMap(map, { bakeTune });
  const slug = await bakedSlugFor(map, { base: ROOT });
  // the camera opens framed on the base (spec §9, D7): its footprint + 6 cells, fixed at arrival (render3d frameRect)
  const frame = baseFrameRect(sim, board);
  const session = createBattleSession(host, {
    getSim: () => sim, getUi: () => ui, submit, mapId: 0, catalogue, onGroundTap: (cell, tapUi) => tapFarm(cell, tapUi),
    mountOptions: () => ({ planet, landing: false, landingHeld: true,
      render3d: { baseUrl: ROOT, craft: false, landing: false, qualityQuery: opts.tier || null, frameRect: () => frame } }),
  });
  // the battle rail's HARVESTER tile sells the OUTPOST's harvesters (S4 follow-up, owner 2026-11-11): its price and
  // refusals from the model, the purchase through the save session (act 'buyHarvester'), the live state rebuilt with the truck
  hud = session.createHud({
    onMainMenu: () => close(),
    // the top bar's gold counts up across a sale's shuttle arc (the bank is already credited) — opt-in, battles pass none
    goldShown: (bank) => saleRun.shown(bank),
    // the FARM tab's crops show the seed pods held in their price slot (the rail's railLabel hook); the save context is
    // re-read after every action (actOnSave), so a planting or a harvest updates the count at once
    railLabel: (id) => farmRailLabel(id, ctxNow().pods),
    harvesterTile: () => harvesterTile(view || fromLiveSim(sim, live.link, nowOf()).outpost, ctxNow(), sim.economy.money),
    onBuyHarvesterUnit: () => { if (actOnSave({ type: 'buyHarvester' }).ok) flashMessage(hud, 'Harvester bought · it docks at the Resource Bay', 'ok'); },
    // the battle's selection panel, with the outpost's extras inside it (render/hud.js selectionExtras) — no panel of its own
    selectionExtras: (s) => selectionExtras(s),
    // the battle's resource card with the outpost's numbers (resourceCard.js): a field's stock, regrowth and trucks; a deposit
    resourceInfo: (id, state, card) => outpostResourceCard(id, state, card, { outpost: view || fromLiveSim(sim, live.link, nowOf()).outpost,
      map, planet, unlockedTiers: ctxNow().unlockedTiers }),
  });
  if (hud.setPlanet) hud.setPlanet(planet);   // the card names the planet's resources (render/resourceInfo.js planetFor)
  // THE OUTPOST HEADER (spec §1, D2 D4) [MM-story_mwcuyrqr_3j]: the battle's own top bar — the hub's HP, the gold — with
  // the outpost's readouts (refreshPanel) in place of the wave count and clock, and LEAVE in Start Wave's slot
  hud.setTopbar({ hpLabel: 'Hub', clock: false, wave: false });
  hud.setPrimaryAction({ label: 'LEAVE ▸', title: 'Leave the outpost (the visit is saved)', onClick: () => close() });
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
  let since = 1, ctx = null, dt = 1 / 60, shook = null;
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
    const goldFrom = saleRun.shown(sim.economy.money);   // a sale over a sale counts on from what the HUD shows
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
    // SELL: play the sale — the shuttle, the "$N" per load, the gold counting up (the outpost before the sale is the
    // scene's storage, route and hub)
    if (action.type === 'sell') saleRun.start(res, { goldFrom, before: back.outpost, scene });
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
  // A selected TRUCK asks the same hook (render/hud.js): why it is not driving (sim/harvest.js harvesterHold) as its status.
  function selectionExtras(s) {
    const unit = !!s.isHarvester;
    if (extrasOf.sim === sim && extrasOf.id === s.id && extrasOf.unit === unit && sim.time - extrasOf.at < 0.5) return extrasOf.out;
    extrasOf = { sim, id: s.id, unit, at: sim.time, out: unit ? harvesterExtras(s) : outpostExtras(s) };
    return extrasOf.out;
  }
  function harvesterExtras(u) {
    const t = harvesterHoldText(harvesterHold(sim, u));
    return t ? { lines: [t] } : null;
  }
  function outpostExtras(s) {
    // where each live structure is in the save, built now: a building placed this visit has its save id too (the link's
    // ids know only what was there on arrival — without this a new building's panel had no status line at all)
    const where = new Map(), v = fromLiveSim(sim, live.link, nowOf(), where).outpost;
    return outpostSelectionExtras(s, { ids: where, outpost: v, map, ctx: ctxNow(), now: nowOf(), gold: sim.economy.money,
      act: (action) => {
        const r = actOnSave(action);
        if (!r.ok) return;
        okToast(action, r);
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
    if (res.ok && hud) flashMessage(hud, def.farmItem === 'plot' ? `${def.name} placed · prepping` : `${def.name} under construction`, 'ok');
    return { ok: !!res.ok, reason: res.error };
  }
  /** The battle input's tap on open ground: a plot or a farm building there opens its panel. → whether it took the tap. */
  function tapFarm(cell, tapUi = ui) {
    const hit = farmThingAt(farmNow(), cell.x, cell.y);
    farmSel = hit;
    if (farmLayer) farmLayer.select(farmRect(hit));
    panelSince = 1;
    // an unbuilt ore deposit opens the battle's resource card with its ore (resourceCard.js); the tap is not taken, so
    // the battle's own selection clears as for any open ground (input.js keeps the card it is handed)
    const dep = hit ? null : (map.deposits || []).find((d) => cell.x >= d.x && cell.x < d.x + 2 && cell.y >= d.y && cell.y < d.y + 2);
    if (dep && tapUi) { tapUi.selectedResourceId = depositCardId(dep.tier); tapUi.selectedResourceRect = { x: dep.x, y: dep.y, w: 2, h: 2 }; }
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
    if (text && hud) flashMessage(hud, text, 'ok');
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
      if (hud) flashMessage(hud, a === 'plant' ? `Planting ${(cropOf(arg) || { name: arg }).name}` : a === 'prep' ? 'Prepping the plot' : 'Harvesting', 'info');
      return;
    }
    if (action.type === 'harvestAll' && crew) {
      const ids = crew.harvestable(nowOf());
      if (ids.length) { for (const id of ids) crew.enqueue({ type: 'harvest', plot: id }); if (hud) flashMessage(hud, `Harvesting ${ids.length} plot${ids.length > 1 ? 's' : ''}`, 'info'); return; }
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
  // ── THE OUTPOST CARD (spec §2, D3 D10) [MM-story_mwcuyrqr_3j]: a HudCard in the battle HUD's right column (render/hudCard.js,
  // the Victory pop-up's look, the same card the selection panel is). The outpost hands it data only (outpostCard.js):
  // GATHERING per ore and surface resource, the harvesters, the storage and hopper gauges, GO ONLINE · S SELL · R REPAIR
  // ALL. It yields to the selection panel while a structure is selected (the HUD's rule); a selected plot or farm
  // building shows ITS panel in this same card (farmCardModel). LEAVE is the top bar's primary action.
  const card = hud.addCard({ className: 'op-card' });
  /** The good news after an outpost-economy action, as a green toast (D6). */
  function okToast(action, r) {
    if (action.type === 'sell') flashMessage(hud, 'Sold · +' + fmtGold(r.earned != null ? r.earned : 0) + ' gold', 'ok');
    else if (action.type === 'online') flashMessage(hud, 'OUTPOST ONLINE · mining has begun. Raiders will come: hold the first one.', 'ok');
    else if (action.type === 'deep') flashMessage(hud, action.on ? 'Deep seam: ¼ the speed, 5× the price' : 'Shallow seam', 'info');
  }
  const cardAct = (action) => { if (action.type === 'repairAll') return repairAllLive(); const r = actOnSave(action); if (r.ok) okToast(action, r); };
  /**
   * REPAIR ALL (owner 2026-11-13 [MM-story_mwf7z51a_3]: "Repairs on the outpost should work like they do in tower defense,
   * small bot roams form base to toweer to do repairs"): the battle's repair command on every worn defense and wreck — a bot
   * walks from the base to each (sim/structures.js requestRepair), the outpost's price paid as it leaves (liveSim.js).
   */
  function repairAllLive() {
    const before = sim.economy.money;
    let sent = 0, short = false;
    for (const s of [...sim.structures.values()].sort((a, b) => a.id - b.id)) {
      if (!(s.hp < s.maxHp) || s.repairPending || repairPriceOf(s) == null) continue;
      const r = applyCommand(sim, { type: 'repair', id: s.id });
      if (r.ok) sent++; else if (r.reason === 'cost') short = true;
    }
    if (sent) flashMessage(hud, `Repair bot${sent === 1 ? '' : 's'} on the way · −${fmtGold(before - sim.economy.money)} gold`, 'ok');
    else flashMessage(hud, short ? 'Not enough gold to repair' : 'Nothing needs repair');
    panelSince = 1;
  }
  const closeFarm = () => { farmSel = null; if (farmLayer) farmLayer.select(null); panelSince = 1; };
  // the away report (what happened while the player was gone): a report card on arrival, once, only when something happened (D5)
  const away = awayReportModel(opened.report, planet, map, catalog);
  let panelSince = 1, gateSave = { of: null, s: null };
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
    const v = view || fromLiveSim(sim, live.link, nowOf()).outpost;
    const gold = sim.economy.money, raid = !!(sim.waves && sim.waves.active);
    // the save as last written (re-read when the save context is), with the outpost as it stands live
    if (!farmed && gateSave.of !== ctxNow()) gateSave = { of: ctxNow(), s: store.load() };
    const gate = farmed ? null : farmGateReason({ ...gateSave.s, outposts: { ...(gateSave.s.outposts || {}), [planet]: v } }, planet, shipName);
    if (gate !== gateText) { gateText = gate; lockFarmGate(gate); }   // the rail's padlocks and the card's line: one text
    // the top bar: status (or the raid's "⚔ n left"), power, storage, threat (spec §1, §8)
    const raidIn = raids && v.online && Number.isFinite(raids.nextAt) ? Math.max(0, raids.nextAt - sim.time) : null;
    hud.setReadouts(outpostReadouts(v, map, { gold, now: nowOf(), raidIn, raid,
      onThreat: () => flashMessage(hud, threatInfo(v, map, nowOf()), 'info') }));
    card.render(fm ? farmCardModel(fm, { run: (act, arg) => farmAct(act, arg), close: closeFarm })
      : outpostCardModel(v, map, { planet, gold, now: nowOf(), live: sim, issues: onlineIssues(v, map), gate, repairCost: repairAllCost(v), raid, act: cardAct }));
  }
  session.bindInput();
  session.start({
    paused: () => false,
    stopped: () => false,
    // the outpost's own clock (liveSim.js stepLiveOutpost): the rigs mine, and power changes start or park the trucks — every 15 ticks
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
      if (sim.tick % 15 === 0) stepLiveOutpost(sim, live.link);   // the rigs mine on the sim clock; power parks or starts the trucks
    },
    beforeFrame: (dtMs) => {
      dt = Math.min(dtMs / 1000, 0.25);
      // the sale's lift shakes the camera for this frame's draw only (taken back in beforeHud)
      const r3 = session.view3d, j = saleRun.offset();
      if (r3 && r3.cam && (j.x || j.z) && !r3.camGlide) { r3.cam.tx += j.x; r3.cam.tz += j.z; shook = { r3, ...j }; }
    },
    beforeHud: () => {
      if (shook) { shook.r3.cam.tx -= shook.x; shook.r3.cam.tz -= shook.z; shook = null; }
      panelSince += dt;
      if (panelSince >= 0.5) { panelSince = 0; try { refreshPanel(); } catch (e) { console.warn('[outpost] panel', e); } }
      if (!scene) { saleRun.step(dt, null); return; }
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
      let sceneOut = null;
      try { sceneOut = scene.update(dt, view); } catch (e) { console.warn('[outpost] scene update', e); }
      // the sale's clock: the gold count-up, the shake, the watchdog (a sale never outlives its timeline)
      try { saleRun.step(dt, sceneOut); } catch (e) { saleRun.cancel(); console.warn('[outpost] sale', e); }
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
  if (away.show) void showAwayReport(hud, away);   // once, on arrival, over the outpost; CONTINUE hands back
  const handle = { session, get sim() { return sim; }, get live() { return live; }, get ui() { return ui; }, get raids() { return raids; }, get scene() { return scene; }, panel: card.root, card, away, actOnSave,
    // the farm (S6; review pages and the headless check): its tab, the picture's counts, the crew, a farm action, a tap
    catalogue, get farm() { return farmLayer; }, get crew() { return crew ? crew.info() : null; }, farmAct, tapFarm, farmNow,
    get farmSel() { return farmSel; },
    // the SELL sequence playing now (review pages and the headless check)
    get sale() { return { active: saleRun.active, t: saleRun.t, shown: saleRun.shown(sim.economy.money), pops: saleRun.timeline ? saleRun.timeline.pops.length : 0, saling: !!(scene && scene.saling) }; } };
  // the open outpost for the review pages and the headless check (window.Bulwark is the game's diagnostics namespace)
  try { win.Bulwark = win.Bulwark || {}; win.Bulwark.outpost = handle; } catch (e) { /* no window */ }
  return { closed: closedP, close, handle };
}
