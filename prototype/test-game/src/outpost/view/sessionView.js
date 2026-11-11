/**
 * src/outpost/view/sessionView.js — the outpost on the shared BATTLE SESSION [MM-subtask_mwciiylh_31]
 * (S2.4a of One Battle UX, TECH_PLAN::One-Battle-UX.md §4). Opened instead of outpostView.js while `?outpost=session`
 * is in the URL; the old view stays the default until the owner's playtest (S2.4d deletes it).
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
 * The farm joins in S6.
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
import { outpostMapFor } from '../outpostMap.js';
import { outpostBattleMap, bakedSlugFor } from './outpostBoard.js';
import { createOutpostScene } from './outpostScene.js';
import { planBuildings } from './conduits.js';
import { createOutpostKit, modelSlug } from '../../render3d/outposts/outpostModels.js';
import { renderMenuIcons, OUTPOST_GLYPHS } from './menuIcons.js';
import { oresOf } from '../../data/ores.js';
import { createSession, onlineIssues, repairAllCost } from './session.js';
import { hudModel, sellButton, fmtGold, harvesterTile } from './hudModel.js';
import { awayReportModel } from './awayReport.js';
import { loadSave, updateSave } from '../../save/save.js';
import { loadMissionCatalog } from '../../save/missionCatalog.js';
import { crumb } from '../../diag/errorLog.js';

const ROOT = new URL('../../../', import.meta.url).href;   // the game root (prototype/test-game/)
/** Is the session path asked for? (?outpost=session) */
export const sessionViewWanted = (win) => { try { return new URLSearchParams(win.location.search).get('outpost') === 'session'; } catch (e) { return false; } };

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

export async function openOutpostSessionView(opts = {}) {
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

  const map = opts.map || await outpostMapFor(planet);
  const catalog = opts.catalog !== undefined ? opts.catalog : await loadMissionCatalog().catch(() => null);
  const saveSession = createSession({ store, planet, map, catalog, raidHook: opts.raidHook });
  if (!store.load().outposts || !store.load().outposts[planet]) { host.remove(); throw new Error(`no outpost on ${planet}`); }
  const nextFrame = () => new Promise((ok) => win.requestAnimationFrame(() => ok()));
  const opened = await saveSession.openChunked(clockNow(), nextFrame);   // the away catch-up
  // the OUTPOST catalogue on the battle rail; a lock is refused by the sim too
  const catalogue = createCatalogue(outpostCatalogueIds());
  // the live state, (re)built from the save — on arrival and after an outpost-economy action (actOnSave below)
  let t0 = 0, live = null, sim = null, raids = null;
  // the ghost's power answer (S2b §5.2), from the outpost as last read (`view`, refreshed a few times a second below):
  // the battle's shared ghost goes amber on its warning, and the preview conduit draws its route
  let view = null;
  const ghostOf = ghostPowerOf(() => view, map);
  function rebuild(outpost, gold) {
    // visit raids (S2.4c): the probe count and the countdown carry over a mid-visit rebuild (a sale, going online)
    const carry = raids ? { probes: raids.probes, nextIn: Math.max(0, raids.nextAt - sim.time) } : {};
    t0 = clockNow();
    live = toLiveSim(outpost, { map, now: t0, gold });
    sim = live.state;
    sim.placementRules = [...(sim.placementRules || []), lockRule(catalogue)];
    // legal but unpowered → the shared ghost's amber (sim/structures.js placementWarnings → ui.hoverWarn)
    sim.placementWarnings = [...(sim.placementWarnings || []), powerWarning(() => view, map, ghostOf)];
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
    getSim: () => sim, getUi: () => ui, submit, mapId: 0, catalogue,
    mountOptions: () => ({ planet, landing: false, landingHeld: true,
      render3d: { baseUrl: ROOT, craft: false, landing: false, qualityQuery: opts.tier || null } }),
  });
  // the battle rail's HARVESTER tile sells the OUTPOST's harvesters (S4 follow-up, owner 2026-11-11): its price and
  // refusals from the model, the purchase through the save session (act 'buyHarvester'), the live state rebuilt with the truck
  hud = session.createHud({
    onMainMenu: () => close(),
    harvesterTile: () => harvesterTile(view || fromLiveSim(sim, live.link, nowOf()).outpost, ctxNow(), sim.economy.money),
    onBuyHarvesterUnit: () => { if (actOnSave({ type: 'buyHarvester' }).ok) flashMessage(hud, 'Harvester bought · it docks at the Resource Bay'); },
  });
  // the outpost buildings' glyphs on the battle rail until their GLB pictures are rendered (below)
  const RAIL_KINDS = OUTPOST_BUILDING_KINDS.filter((k) => k !== 'hub');
  for (const k of RAIL_KINDS) if (OUTPOST_GLYPHS[k] && hud.setBuildPicture) hud.setBuildPicture(outpostStructId(k), { glyph: OUTPOST_GLYPHS[k] });
  session.setBoard(board, 0);
  await session.mount3D(board, slug);
  const r = session.view3d;
  let scene = null;
  if (r) {
    if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);   // the hub model stands on the base
    const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
    const kit = await createOutpostKit(r.THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader });
    scene = createOutpostScene(r.THREE, r, { map, kit, tier: r.tier.key, reduced });
    const o = fromLiveSim(sim, live.link, nowOf()).outpost;
    const slugs = new Set(planBuildings(o, map, nowOf()).map((b) => modelSlug(b.kind, b.tier, b.rigHead)).filter(Boolean));
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
  /** The preview conduit for the armed build tool: the ghost's route to the node it would join, or nothing. */
  function previewPlan() {
    if (!ui.buildSelection || !ui.hoverCell || !ui.hoverValid) return null;
    let def = null;
    try { def = getStructureDef(ui.buildSelection); } catch (e) { return null; }
    const gp = ghostOf(def, ui.hoverCell, ui.buildSelection);
    return gp && gp.route ? { points: gp.route.points, warn: !!gp.reason } : null;
  }
  const ctxNow = () => ctx || (ctx = saveSession.ctx(nowOf()));

  // ── the outpost's own controls, in the battle HUD (S2.4b) ──────────────────────────────────────────────────
  // An outpost-economy action (sell ore, go online, repair all) is the save session's rule: write the live state back,
  // run it, rebuild the live state from the result. → the session's result ({ ok, error, gold, … }).
  function actOnSave(action) {
    const at = nowOf();
    const back = fromLiveSim(sim, live.link, at);
    bankVisit(store, planet, back.outpost, back.gold);
    const res = saveSession.act(action, at);
    if (!res.ok) {
      if (hud) flashMessage(hud, String(res.error || 'not now').replace(/^./, (c) => c.toUpperCase()));
      return res;
    }
    const s = store.load();
    rebuild(s.outposts[planet], saveSession.gold());
    ui.selectedStructureId = null; ui.buildSelection = null;
    ctx = null; view = null; since = 1;
    return res;
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
    const v = view || fromLiveSim(sim, live.link, nowOf()).outpost;
    const h = hudModel(v, map, { gold: sim.economy.money, now: nowOf() });
    const issues = onlineIssues(v, map);
    title.textContent = 'OUTPOST';
    status.textContent = h.online ? (h.raidInbound ? 'Online · raid inbound' : 'Online') : ('Offline — ' + (issues.join('; ') || 'ready to go online'));
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
    afterTick: () => { if (raids) raids.step(); if (sim.tick % 15 === 0) syncHarvestPower(sim, live.link); },
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
      }
      try { scene.setPreview(previewPlan()); } catch (e) { console.warn('[outpost] preview conduit', e); }
      try { scene.update(dt, view); } catch (e) { console.warn('[outpost] scene update', e); }
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
    session.destroy();
    host.remove();
    resolveClosed();
  }
  refreshPanel();
  return { closed: closedP, close, handle: { session, get sim() { return sim; }, get live() { return live; }, get ui() { return ui; }, get raids() { return raids; }, panel, actOnSave } };
}
