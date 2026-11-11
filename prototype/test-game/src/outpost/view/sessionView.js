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
 * Still to come on this path: the outpost's own panels (SELL, GO ONLINE, away report, status — S2.4b) and visit raids
 * as waves (S2.4c). The farm joins in S6.
 */
import { createBattleSession } from '../../battle/session.js';
import { createCatalogue, lockRule } from '../../battle/catalogue.js';
import { createUiState } from '../../input/input.js';
import { flashMessage } from '../../render/hud.js';
import { applyCommand } from '../../sim/core.js';
import { outpostStructId, OUTPOST_BUILDING_KINDS } from '../../data/outpostStructures.js';
import { DEFENSE_KINDS } from '../../data/outpost.js';
import { toLiveSim, fromLiveSim } from '../liveSim.js';
import { outpostMapFor } from '../outpostMap.js';
import { outpostBattleMap, bakedSlugFor } from './outpostBoard.js';
import { createOutpostScene } from './outpostScene.js';
import { planBuildings } from './conduits.js';
import { createOutpostKit, modelSlug } from '../../render3d/outposts/outpostModels.js';
import { createSession } from './session.js';
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
  const t0 = clockNow();
  const live = toLiveSim(opened.outpost, { map, now: t0, gold: saveSession.gold() });
  const sim = live.state;
  // the clock the save sees: the arrival time plus the sim's own time (the sim never reads the wall clock)
  const nowOf = () => t0 + Math.round(sim.time * 1000);

  // the OUTPOST catalogue on the battle rail; a lock is refused by the sim too
  const catalogue = createCatalogue(outpostCatalogueIds());
  sim.placementRules = [...(sim.placementRules || []), lockRule(catalogue)];
  let ui = createUiState();
  let hud = null;
  const submit = (cmd) => {
    const res = applyCommand(sim, cmd);
    if (!res.ok && res.reason && hud) flashMessage(hud, res.reason);
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
  hud = session.createHud({ onMainMenu: () => close() });
  session.setBoard(board, 0);
  await session.mount3D(board, slug);
  const r = session.view3d;
  let scene = null;
  if (r) {
    if (r.markers && r.markers.setBaseVisible) r.markers.setBaseVisible(false);   // the hub model stands on the base
    r.fog.update = () => ({ win: null });   // no battle fog yet at the outpost (S5)
    const { GLTFLoader } = await import(ROOT + 'vendor/three-addons/loaders/GLTFLoader.js');
    const kit = await createOutpostKit(r.THREE, { base: ROOT + 'content/outposts/', tier: r.tier.key, GLTFLoader });
    scene = createOutpostScene(r.THREE, r, { map, kit, tier: r.tier.key, reduced });
    const o = fromLiveSim(sim, live.link, nowOf()).outpost;
    const slugs = new Set(planBuildings(o, map, nowOf()).map((b) => modelSlug(b.kind, b.tier, b.rigHead)).filter(Boolean));
    await kit.preload([...slugs]);
  }

  // the outpost's art follows the live state: re-read the save shape a few times a second (cheap), animate each frame
  let since = 1, view = null, ctx = null, dt = 1 / 60;
  const ctxNow = () => ctx || (ctx = saveSession.ctx(nowOf()));
  session.bindInput();
  session.start({
    paused: () => false,
    stopped: () => false,
    beforeFrame: (dtMs) => { dt = Math.min(dtMs / 1000, 0.25); },
    beforeHud: () => {
      if (!scene) return;
      since += dt;
      if (since >= 0.25 || !view) {
        since = 0;
        try { view = fromLiveSim(sim, live.link, nowOf()).outpost; scene.sync(view, nowOf(), ctxNow()); }
        catch (e) { console.warn('[outpost] scene sync', e); }
      }
      try { scene.update(dt, view); } catch (e) { console.warn('[outpost] scene update', e); }
    },
  });

  let closed = false, resolveClosed;
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
  return { closed: closedP, close, handle: { session, sim, live, get ui() { return ui; } } };
}
