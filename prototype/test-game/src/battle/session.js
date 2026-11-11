/**
 * src/battle/session.js — the battle session: the view, the input and the clock every mode shares
 * [MM-story_mwc9p7al_2e] [MM-task_mwcbd4sk_2o] [MM-task_mwcbd61h_2p].
 *
 * Tech plan docs/tech-plan/One-Battle-UX.md §4. Owner 2026-11-11: "users are trained to work with camera, characters,
 * and structure in one pattern … we should never have to change UX in two places to update one common UX function."
 *
 * This code was MOVED here from main.js boot() unchanged — it is not a second copy. A session owns:
 *   - the Pixi application and its canvas (the 2D fallback board) and the 2D renderer with its art packs;
 *   - the three.js battle view's lifecycle: mount3D, fallbackTo2D, retry3D, suspend3D, resume3D;
 *   - the HUD (createHud, with the mode's callbacks) and the HUD insets the 3D camera frames around;
 *   - the pointer/key input bound to whichever view is live (input/input.js);
 *   - the clock: the fixed-step accumulator that steps the sim (sim/core.js stepSim), then each frame the hover
 *     refresh, input hints, the 2D or 3D frame and updateHud.
 * What a battle DOES with its events — waves, dialogs, results, replays, the Kill Camera — belongs to the mode
 * (main.js for the campaign) and plugs in through `hooks`, called in the same order the inline loop ran them, so the
 * sim steps exactly as before (replay hashes unchanged).
 *
 * The sim, the UI state and submit stay the mode's (they are re-created on restart and replay); the session reads
 * them through getSim / getUi / submit at the moment it needs them.
 */
import { MAP, fxScaleForMap, projScaleForMap } from '../data/tables.js';
import { stepSim, FIXED_DT } from '../sim/core.js';
import { createRenderer, renderFrame, destroyRenderer } from '../render/renderer.js';
import { createHud, updateHud, flashMessage } from '../render/hud.js';
import { createInput, destroyInput } from '../input/input.js';

/**
 * CSS px the HUD covers on each side of the game view — the top bar across the top, the build tray down the left.
 * The 3D view frames the pre-match play area in what is left (render3d/camera.js clearBox) [MM-task_mvewfno7_g].
 */
export function hudInsets(mountEl) {
  if (!mountEl || !mountEl.getBoundingClientRect) return null;
  const m = mountEl.getBoundingClientRect(), out = { top: 0, left: 0, right: 0, bottom: 0 };
  const vis = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).display !== 'none';
  const bar = mountEl.querySelector('.bw-topbar'), tray = mountEl.querySelector('.bw-palette');
  if (vis(bar)) out.top = Math.max(0, bar.getBoundingClientRect().bottom - m.top);
  if (vis(tray)) out.left = Math.max(0, tray.getBoundingClientRect().right - m.left);
  return out;
}

/**
 * Create a battle session in `mountEl`.
 *   getSim()          → the live SimState (the mode replaces it on restart / replay)
 *   getUi()           → the live UI state (selection, build tool)
 *   submit(cmd)       → the mode's command path (validation, logging)
 *   mapId             → the starting board's map id (FX scale tiers)
 *   mountOptions()    → per-mount 3D options the mode decides: { planet, landing, landingHeld }
 * Returns the session handle (see the object at the end).
 */
export function createBattleSession(mountEl, { getSim, getUi, submit, mapId = 0, mountOptions = () => ({}) }) {
  let hud = null;

  // ---------------------------------------------------------------------
  // Pixi application (primitives-only test build)
  // ---------------------------------------------------------------------
  const boardW = MAP.cols * MAP.tile;
  const boardH = MAP.rows * MAP.tile;
  // Render at the DEVICE's pixel density (phones are 2-3x): without this the canvas rasterizes at
  // 1x and gets CSS-upscaled — blurry board next to crisp DOM HUD ("every component a different
  // resolution"). Capped so the physical framebuffer never exceeds ~4096px on a side (mobile GPU
  // texture limits) — at 64px/tile the classic 64x32 board is already 4096 logical, so it runs 1x
  // while small campaign maps get the full density.
  const fitResolution = (w, h) => Math.max(1, Math.min(window.devicePixelRatio || 1, 3, 4096 / w, 4096 / h));
  const app = new PIXI.Application({
    width: boardW,
    height: boardH,
    backgroundColor: 0x0e1216,
    antialias: true,
    resolution: fitResolution(boardW, boardH),
    autoDensity: true,
  });
  const canvas = app.view || app.canvas;
  canvas.style.display = 'block';
  // s9: at 64x32 the board is 2048x1024 — scale the canvas to fit its container (preserve aspect) so the bigger
  // map stays fully visible without overflowing the panel. Internal render resolution is unchanged, and input
  // already maps screen->cell via the canvas rect (input.js), so pointer placement stays correct when scaled.
  canvas.style.maxWidth = '100%';
  canvas.style.maxHeight = '100%';
  canvas.style.height = 'auto';
  mountEl.appendChild(canvas);

  // The three.js battle view (plan v2.2 §6.12, T3.1 [MM-task_mv883c5d_b]). render3d/ and three.js are imported
  // dynamically; the 3D view covers the board and the Pixi canvas stays mounted but hidden (and draws nothing);
  // the HUD and sim are untouched. Input binds to the 3D canvas once it is up (makeInput — T3.2 [MM-task_mv9s9lvj_1]).
  // 3D BY DEFAULT [MM-story_mvbqugeo_l] (owner 2026-10-16: "the full game should be using the 3d"): the three.js view
  // is the game's view. ?renderer=pixi (or =2d) keeps the old 2D view, and the game falls back to it on its own when
  // this device can't run WebGL or the 3D view fails to start / keeps throwing (fallbackTo2D) — never a dead screen.
  // T7 deletes Pixi once nothing needs the fallback.
  const RENDERER_Q = (() => { try { return (new URLSearchParams(window.location.search).get('renderer') || '').toLowerCase(); } catch (e) { return ''; } })();
  const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } };
  const WEBGL_OK = RENDERER_Q !== 'pixi' && RENDERER_Q !== '2d' && hasWebGL();   // asked once: each probe costs a GL context
  let USE_3D = WEBGL_OK;
  let fell2D = false;   // the 3D view failed on this map; the next map tries 3D again (retry3D)
  let renderer3d = null;
  let render3dMod = null;
  let mount3dSeq = 0;
  let suspended3D = false;   // the outpost view holds the 3D GPU budget (onOutpostOpen / onOutpostClose)
  let last3D = null;   // the map + slug the 3D view was last mounted for (a quality change remounts it)
  if (USE_3D) { canvas.style.visibility = 'hidden'; app.stage.renderable = false; }   // the hidden 2D board draws nothing
  let frameErrors3d = 0;
  // The 3D view could not start or keeps failing: drop back to the 2D board so the game stays playable.
  function fallbackTo2D(reason) {
    if (!USE_3D) return;
    console.error('[render3d] falling back to the 2D view:', reason);
    USE_3D = false; fell2D = true;
    mount3dSeq++;                                         // cancel any mount in flight
    if (renderer3d && render3dMod) { try { render3dMod.destroyRenderer(renderer3d); } catch (e) { /* already gone */ } }
    renderer3d = null;
    canvas.style.visibility = ''; app.stage.renderable = true;
    rebindInput();
    flashMessage(hud, '3D view unavailable — playing in 2D');
  }
  // Owner 2026-11-10: Verdance map 6 played in the old 2D view. A fallback used to last the whole session; now it lasts
  // one map, and the next map tries 3D again (a lost GPU context, e.g. phones capping live WebGL contexts, is usually
  // over by then).
  function retry3D() {
    if (USE_3D || !fell2D || !WEBGL_OK) return;
    USE_3D = true; fell2D = false; frameErrors3d = 0;
    canvas.style.visibility = 'hidden'; app.stage.renderable = false;
  }
  // One heavy WebGL view at a time on a phone (owner 2026-11-07: two at once crashed an iPhone): the outpost view and the
  // Pod Reward Chest borrow the GPU from the battle view, which is rebuilt when they close.
  function suspend3D() {
    if (!renderer3d || !render3dMod) return false;
    mount3dSeq++;                                       // cancel a mount in flight
    try { render3dMod.destroyRenderer(renderer3d); } catch (e) { /* already gone */ }
    renderer3d = null; suspended3D = true;
    rebindInput();
    return true;
  }
  function resume3D() {
    if (!suspended3D) return;
    suspended3D = false;
    if (USE_3D && last3D) void mount3D(last3D.map, last3D.slug);
  }
  async function mount3D(map, slug) {
    const mySeq = ++mount3dSeq;
    try {
      // drop the old view at once — it must not draw the NEW board while this one builds
      if (renderer3d && render3dMod) { render3dMod.destroyRenderer(renderer3d); renderer3d = null; rebindInput(); }
      render3dMod = render3dMod || await import('../render3d/index.js');
      if (mySeq !== mount3dSeq) return;
      // ?world=<palette> previews a low-poly world; ?ground=baked keeps the baked-texture ground (LP).
      const q = new URLSearchParams(window.location.search);
      last3D = { map, slug };
      const quality = await import('../render3d/quality.js');
      let storage = null;
      try { storage = window.localStorage; } catch (e) { storage = null; }
      // LC [MM-epic_mvbkrvnz_2]: the base is the player's landing craft (?craft=<faction|craft key>, default the
      // neutral craft until the player's own faction is chosen in the shell); ?landing=0 parks it without the
      // fly-in. The battle's planet is the ENEMY faction's homeworld (maps are faction-owned) → its resources.
      const mo = mountOptions() || {};
      const r = await render3dMod.createRenderer3D(mountEl, map, { slug, world: q.get('world') || undefined, ground: q.get('ground') || undefined,
        craft: q.get('craft') || 'system', landing: q.get('landing') !== '0' && !!mo.landing, landingHeld: !!mo.landingHeld,   // a remount mid-battle (quality change) parks the craft instead of replaying the landing
        planet: q.get('planet') || mo.planet || null,
        projFx: () => renderer.projFx, projScale: () => renderer.projScale,
        qualityQuery: q.get('quality'), qualityChoice: quality.loadChoice(storage),
        viewInsets: () => hudInsets(mountEl) });   // the pre-match camera frames the play area clear of the HUD [MM-task_mvewfno7_g]
      if (mySeq !== mount3dSeq) { render3dMod.destroyRenderer(r); return; }
      renderer3d = r;
      rebindInput();   // the input was bound to the old (or no) 3D canvas — move it onto this one
      console.log('[render3d]', r.status, slug || '(no baked level)', r.problems.join('; '), '· quality', r.quality.key, `(${r.quality.source})`);
      // SETTINGS → 3D quality (T3.5 [MM-task_mv9s9p7h_4]): Auto or a fixed tier, saved on this device; a change
      // rebuilds the 3D view at the new tier (the sim keeps running — the view is read-only on it)
      hud.addSetting('quality3d', '3D view quality — saved on this device', quality.settingsOptions(r.quality.auto), r.quality.choice, (v) => {
        quality.saveChoice(storage, v);
        if (last3D) void mount3D(last3D.map, last3D.slug);
      });
    } catch (e) {
      console.error('[render3d] failed to start', e);
      fallbackTo2D((e && e.message) || e);
    }
  }

  let renderer = createRenderer(app, MAP);
  renderer.fxScale = fxScaleForMap(mapId);     // battle-FX size tier for this map
  renderer.projScale = projScaleForMap(mapId); // projectile damping (early maps shrink shots)

  // Load the AUTHORED unit art (faction .units.json + sheets) asynchronously; once ready, units that have art
  // render as their real sprites. Non-blocking — the game runs with primitives until (and if) it resolves.
  import('../render/unitArt.js').then(({ loadUnitArt }) => loadUnitArt()).then((art) => {
    renderer.unitArt = art;
    if (art && art.ready) console.log('[unitArt] loaded', Object.keys(art.defs).length, 'authored units');
  }).catch((e) => console.warn('[unitArt] skipped:', e && e.message));

  // VOXEL unit packs (Stack Forge): committed voxel-units.json + the Forge's localStorage manifest.
  // Non-blocking; once ready, any unit whose id has a pack renders as its voxel body + aiming turret.
  import('../render/voxel/loader.js').then(({ loadVoxelUnits }) => loadVoxelUnits()).then((vox) => {
    renderer.voxelArt = vox;
    if (vox && vox.ready) console.log('[voxel] loaded', Object.keys(vox.units).length, 'unit pack(s):', Object.keys(vox.units).join(', '));
  }).catch((e) => console.warn('[voxel] skipped:', e && e.message));

  // VOXEL DECOR packs (Stack Forge Terrain set) → renderer.decorArt; the renderer places map.decor[] groves.
  import('../render/voxel/loader.js').then(({ loadVoxelDecor }) => loadVoxelDecor()).then((dec) => {
    renderer.decorArt = dec;
    if (renderer._decorMap) renderer._decorMap = null;   // force a rebuild now that packs are available
    if (dec && dec.ready) console.log('[decor] loaded', Object.keys(dec.decor).length, 'decor pack(s):', Object.keys(dec.decor).join(', '));
  }).catch((e) => console.warn('[decor] skipped:', e && e.message));

  // PROJECTILE FX table (Shooting Gallery authoring → emitCombatFx): shipped content/fx/projectiles.json
  // + dev-live localStorage overlay (gallery saves win). Ids not in the table keep the classic look.
  import('../render/projFx.js').then(async ({ mergeProjFx, PROJ_FX_LS_KEY }) => {
    let shipped = null;
    try { const r = await fetch('content/fx/projectiles.json'); if (r.ok) shipped = await r.json(); } catch (e) { /* optional */ }
    let local = null;
    try { local = JSON.parse(localStorage.getItem(PROJ_FX_LS_KEY) || 'null'); } catch (e) { /* dev-live */ }
    renderer.projFx = mergeProjFx(shipped && shipped.units, local && (local.units || local));
    const n = Object.keys(renderer.projFx).length;
    if (n) console.log('[projfx] authored projectile FX for', n, 'id(s):', Object.keys(renderer.projFx).join(', '));
  }).catch((e) => console.warn('[projfx] skipped:', e && e.message));

  /**
   * A new board: resize the 2D surface and rebuild the 2D renderer for it, carrying the art packs (they load once).
   * The 3D view is (re)mounted separately (mount3D), when the board is actually played.
   */
  function setBoard(map, mapId) {
    app.renderer.resolution = fitResolution(map.cols * map.tile, map.rows * map.tile);
    app.renderer.resize(map.cols * map.tile, map.rows * map.tile);
    const art = renderer && renderer.unitArt;
    const vox = renderer && renderer.voxelArt;   // voxel packs load once at boot — carry them too
    const dec = renderer && renderer.decorArt;   // decor packs too
    destroyRenderer(renderer);                   // free the old renderer's GPU tree before replacing it
    app.stage.removeChildren();
    renderer = createRenderer(app, map);
    renderer.fxScale = fxScaleForMap(mapId);     // battle-FX size tier for this map
    renderer.projScale = projScaleForMap(mapId); // projectile damping (early maps shrink shots)
    if (art) renderer.unitArt = art;
    if (vox) renderer.voxelArt = vox;
    if (dec) renderer.decorArt = dec;
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  let accumulator = 0;        // fixed-timestep accumulator (seconds)
  let pendingEvents = [];     // events produced by fixed steps, flushed to renderer each frame
  let inputHandle = null;
  // Input binds to the LIVE view: the Pixi canvas by default; under ?renderer=three the 3D canvas, picking
  // through its camera and acting only on a tap (a drag there pans the camera).
  function makeInput() {
    if (renderer3d) {
      return createInput(renderer3d.canvas, renderer, getSim, submit, getUi(),
        { pick: (ev, u) => render3dMod.eventToCell(renderer3d, ev, u), tapToAct: true });
    }
    return createInput(canvas, renderer, getSim, submit, getUi());
  }
  function rebindInput() {
    if (!inputHandle) return;   // no session yet — the boot path creates it
    destroyInput(inputHandle);
    inputHandle = makeInput();
  }
  /** Drop the input (a new battle is being set up); bindInput() attaches it to the new sim + UI state. */
  function unbindInput() { if (inputHandle) { destroyInput(inputHandle); inputHandle = null; } }
  function bindInput() { inputHandle = makeInput(); }

  // ---------------------------------------------------------------------
  // The clock: fixed steps, then the frame
  // ---------------------------------------------------------------------
  /**
   * Start the frame loop. hooks (all the mode's):
   *   paused()            → true while the sim must not step (battle ended, between-wave freeze)
   *   stopped()           → true once the battle has ended (no further steps this frame)
   *   beforeStep(sim)     — before each fixed step (replay playback feeds its commands here)
   *   afterStep(sim, evs) — after each fixed step, with that step's events (waves, results, dialogs)
   *   beforeFrame(dt)     — once a frame, before the view draws (replay indicator, dialog guard)
   *   viewFrame(dt, f)    — may replace f.sim / f.events with what the view should draw (the Kill Camera)
   *   beforeHud()         — after the frame, before updateHud
   */
  function start(hooks) {
    const h = hooks || {};
    app.ticker.add(() => {
      const dtMs = (app.ticker && typeof app.ticker.deltaMS === 'number') ? app.ticker.deltaMS : 1000 / 60;
      if (!h.paused()) {
        accumulator += Math.min(dtMs / 1000, 0.25);
        while (accumulator >= FIXED_DT && !h.stopped()) {
          const sim = getSim();
          if (h.beforeStep) h.beforeStep(sim);
          const evs = stepSim(sim, FIXED_DT);
          if (evs && evs.length) for (let i = 0; i < evs.length; i++) pendingEvents.push(evs[i]);
          if (h.afterStep) h.afterStep(sim, evs);
          accumulator -= FIXED_DT;
          if (h.afterTick) h.afterTick(sim);
        }
      }
      if (h.beforeFrame) h.beforeFrame(dtMs);
      const ui = getUi();
      // placement ghost re-validates every frame — money changes while the pointer is still
      if (inputHandle && inputHandle.refreshHover) inputHandle.refreshHover();
      // harvester/base interaction hints (owner): input sets ui.pendingHint, we flash it once
      if (ui && ui.pendingHint) { flashMessage(hud, ui.pendingHint.text); ui.pendingHint = null; }
      const frame = { sim: getSim(), events: pendingEvents };
      if (h.viewFrame) h.viewFrame(dtMs, frame);
      pendingEvents = frame.events;
      if (!USE_3D) renderFrame(renderer, getSim(), ui, pendingEvents, dtMs / 1000);   // pass REAL frame time so FX track sim time
      if (renderer3d) {
        // a throw here would stop the Pixi ticker that drives the whole game loop — contain it, and give up on 3D
        // if it keeps happening
        try { render3dMod.renderFrame(renderer3d, frame.sim, ui, pendingEvents, dtMs / 1000); frameErrors3d = 0; }
        catch (e) { console.error('[render3d] frame failed', e); if (++frameErrors3d >= 30) fallbackTo2D((e && e.message) || e); }
      }
      if (h.beforeHud) h.beforeHud();
      updateHud(hud, getSim(), ui);
      pendingEvents = [];
    });
  }

  return {
    /** Create the battle HUD with the mode's callbacks (render/hud.js createHud). */
    createHud(callbacks) { hud = createHud(mountEl, callbacks); return hud; },
    get hud() { return hud; },
    // the 3D view
    mount3D, fallbackTo2D, retry3D, suspend3D, resume3D,
    get view3d() { return renderer3d; },
    get mod3d() { return render3dMod; },
    get use3D() { return USE_3D; },
    // the board and input
    setBoard, bindInput, unbindInput, rebindInput,
    // the clock
    start,
    /** Forget the time owed to the sim (a fresh battle, or resuming from a freeze: no time-jump). */
    resetClock({ events = true } = {}) { accumulator = 0; if (events) pendingEvents = []; },
    /** Replace what the view draws this frame (the Kill Camera's own shots and kills). */
    setPendingEvents(evs) { pendingEvents = evs; },
  };
}
