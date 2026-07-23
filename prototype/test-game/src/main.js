import { MAP, WAVES, makeWaves, fxScaleForMap, projScaleForMap, getUnitDef } from './data/tables.js';
import { buildCampaignMap, buildTerrainMap, resolveResourceTypes } from './sim/mapgen.js';
import { buildCampaignWaves } from './sim/campaign.js';
import { createSim, applyCommand, stepSim, FIXED_DT } from './sim/core.js';
import { loadSave, updateSave, recordResult, buyStructTier, resetSave } from './save/save.js';
import { buildOffer, applyAccept, applyDecline, judgeContract } from './save/contracts.js';
import { showContractModal } from './render/contractModal.js';
import { showWavePreview, showBonusPicker } from './render/gameDialog.js';
import { getBonusDef } from './data/tables.js';
import { createMenu, FACTION_NAMES } from './menu/menu.js';
import { createLog, recordCommand, serializeLog, deserializeLog, hashState, runReplay } from './sim/replay.js';
import { runPricingReport } from './sim/balanceSim.js';
import { createRenderer, renderFrame, destroyRenderer } from './render/renderer.js';
import { VOXEL_UNIT_SCALE } from './render/voxel/loader.js';
import { createHud, updateHud, showResult, flashMessage, showWaveBanner, showStarBanner } from './render/hud.js';
import { createInput, createUiState, destroyInput } from './input/input.js';
import { createComm } from './comm/commCard.js';
import { setChannelVolume } from './comm/voice.js';
import { loadVoicePacks, challengeCall, winCall, defeatCall, fallbackCall, tipsCall, classifyOutcome } from './comm/dialog.js';

function parseSeedFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seed');
    if (raw !== null && raw !== '') {
      const n = Number(raw);
      if (!Number.isNaN(n) && Number.isFinite(n)) return Math.floor(n);
    }
  } catch (e) { /* no-op: non-browser or malformed URL */ }
  return null;
}

export function boot(mountEl, seed) {
  const urlSeed = parseSeedFromUrl();
  let currentSeed =
    (typeof seed === 'number' && Number.isFinite(seed)) ? Math.floor(seed) :
    (urlSeed !== null ? urlSeed : 1);

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

  // ---------------------------------------------------------------------
  // Session state (sim + log + ui). Re-created on restart / replay.
  // ---------------------------------------------------------------------
  // DEFAULTS (owner, 2026-07-13): Map 1 (campaign) as the boot board, Ground/Powder as the boot
  // faction, and the game opens on the wave-1 TAP TO START overlay — load, tap anywhere, fight.
  const DEFAULT_FACTION = 'Ground / Powder';
  const DEFAULT_MAP_ID = 1;
  let currentWaves = makeWaves(DEFAULT_FACTION);   // active enemy schedule (test picker can change it)
  let currentMap = MAP;       // classic board, or a generated ring-campaign map (Map picker)
  let currentMapId = 0;       // 0 = classic
  let currentTestFaction = DEFAULT_FACTION;
  let sim = createSim(currentSeed, { waves: currentWaves, map: currentMap });
  let log = createLog(currentSeed);
  let ui = createUiState();

  let renderer = createRenderer(app, currentMap);
  renderer.fxScale = fxScaleForMap(currentMapId);     // battle-FX size tier for this map
  renderer.projScale = projScaleForMap(currentMapId); // projectile damping (early maps shrink shots)

  // Load the AUTHORED unit art (faction .units.json + sheets) asynchronously; once ready, units that have art
  // render as their real sprites. Non-blocking — the game runs with primitives until (and if) it resolves.
  import('./render/unitArt.js').then(({ loadUnitArt }) => loadUnitArt()).then((art) => {
    renderer.unitArt = art;
    if (art && art.ready) console.log('[unitArt] loaded', Object.keys(art.defs).length, 'authored units');
  }).catch((e) => console.warn('[unitArt] skipped:', e && e.message));

  // VOXEL unit packs (Stack Forge): committed voxel-units.json + the Forge's localStorage manifest.
  // Non-blocking; once ready, any unit whose id has a pack renders as its voxel body + aiming turret.
  import('./render/voxel/loader.js').then(({ loadVoxelUnits }) => loadVoxelUnits()).then((vox) => {
    renderer.voxelArt = vox;
    if (vox && vox.ready) console.log('[voxel] loaded', Object.keys(vox.units).length, 'unit pack(s):', Object.keys(vox.units).join(', '));
  }).catch((e) => console.warn('[voxel] skipped:', e && e.message));

  // VOXEL DECOR packs (Stack Forge Terrain set) → renderer.decorArt; the renderer places map.decor[] groves.
  import('./render/voxel/loader.js').then(({ loadVoxelDecor }) => loadVoxelDecor()).then((dec) => {
    renderer.decorArt = dec;
    if (renderer._decorMap) renderer._decorMap = null;   // force a rebuild now that packs are available
    if (dec && dec.ready) console.log('[decor] loaded', Object.keys(dec.decor).length, 'decor pack(s):', Object.keys(dec.decor).join(', '));
  }).catch((e) => console.warn('[decor] skipped:', e && e.message));

  // PROJECTILE FX table (Shooting Gallery authoring → emitCombatFx): shipped content/fx/projectiles.json
  // + dev-live localStorage overlay (gallery saves win). Ids not in the table keep the classic look.
  import('./render/projFx.js').then(async ({ mergeProjFx, PROJ_FX_LS_KEY }) => {
    let shipped = null;
    try { const r = await fetch('content/fx/projectiles.json'); if (r.ok) shipped = await r.json(); } catch (e) { /* optional */ }
    let local = null;
    try { local = JSON.parse(localStorage.getItem(PROJ_FX_LS_KEY) || 'null'); } catch (e) { /* dev-live */ }
    renderer.projFx = mergeProjFx(shipped && shipped.units, local && (local.units || local));
    const n = Object.keys(renderer.projFx).length;
    if (n) console.log('[projfx] authored projectile FX for', n, 'id(s):', Object.keys(renderer.projFx).join(', '));
  }).catch((e) => console.warn('[projfx] skipped:', e && e.message));

  // The last COMPLETED game, captured so "Run Replay" replays it even after Restart resets the live log, and
  // after a page reload (persisted to localStorage). mmdev.
  let lastReplayLog = null;
  try { lastReplayLog = (typeof localStorage !== 'undefined' && localStorage.getItem('bulwark:lastReplay')) || null; }
  catch (e) { /* storage blocked */ }

  let mode = 'play';          // 'play' | 'replay'
  let replayQueue = [];       // sorted commands during replay playback
  let replayIdx = 0;
  let activeReplayLog = null; // log being played back (for final hash check)
  let ended = false;          // sim.result reached; stop stepping
  let interlude = false;      // between-wave FREEZE: dialog speaker held on screen, sim/time/regrowth
                              // all paused until the player taps START NEXT WAVE (play mode only)
  let accumulator = 0;        // fixed-timestep accumulator (seconds)
  let pendingEvents = [];     // events produced by fixed steps, flushed to renderer each frame
  let inputHandle = null;
  let pendingCarry = null;   // campaign carry (gold + defenses) applied by restart() until the map changes by hand
  let runContract = null;    // the ACCEPTED quest contract for the current map run (judged at match end)

  // ---------------------------------------------------------------------
  // Command submission: validates via sim core, records accepted commands.
  // ---------------------------------------------------------------------
  function submit(cmd) {
    if (mode === 'replay') {
      flashMessage(hud, 'replay mode — input disabled (Restart to play)');
      return { ok: false, reason: 'replay' };
    }
    if (ended) {
      return { ok: false, reason: 'ended' };
    }
    // Starting a wave while the tap-to-start overlay is up must go through endInterlude (unfreeze + dismiss
    // the held dialog), or the sim stays paused and the challenge card sticks. Covers SPACE (input.js) and
    // any raw startWave. endInterlude clears `interlude` before it re-submits, so this doesn't recurse.
    if (cmd && cmd.type === 'startWave' && interlude) { endInterlude(); return { ok: true, reason: '' }; }
    const res = applyCommand(sim, cmd);
    if (res.ok) {
      recordCommand(log, sim.tick, cmd);
    } else if (res.reason) {
      flashMessage(hud, res.reason);
    }
    return res;
  }

  // ---------------------------------------------------------------------
  // Session lifecycle helpers (hoisted so HUD callbacks can reference them)
  // ---------------------------------------------------------------------
  function restart(newSeed) {
    const s = (typeof newSeed === 'number' && Number.isFinite(newSeed)) ? Math.floor(newSeed) : currentSeed;
    currentSeed = s;
    if (inputHandle) { destroyInput(inputHandle); inputHandle = null; }
    {
      const sv = loadSave();
      // collision radii from the loaded voxel packs so a unit's footprint matches the tank on screen
      // (option 2: ~1.2× the rendered half-width). Derived from scale.tiles → works on existing packs.
      const voxelRadii = {};
      const va = renderer && renderer.voxelArt;
      if (va && va.units) for (const id of Object.keys(va.units)) {
        const p = va.units[id].pack || {};
        const tiles = (p.scale && p.scale.tiles) || (((p.footprint && p.footprint[0]) || 32) / 32);
        // Prefer the pack's baked collision (measured from the real body extent in Stack Forge). Otherwise
        // ESTIMATE from the footprint — the drawn body is ~⅔ of the padded footprint, so scale down so
        // collision isn't oversized. Re-bake a unit to replace this estimate with the exact value.
        voxelRadii[id] = (p.collision != null) ? p.collision : tiles * VOXEL_UNIT_SCALE * 0.4;
      }
      const simInit = { waves: currentWaves, map: currentMap, carry: pendingCarry,
        harvesterLevel: sv.harvesterLevel || 1, voxelRadii,
        // classic board AND forge maps stay all-open — the campaign tier-unlock shop (Amendment B2)
        // has no UI yet, so gating forge playtests made upgrades silently impossible (owner 2026-07-16)
        structTiers: currentMapId && !(currentMap && currentMap.fromForge) ? sv.structTiers : null,
        mapId: currentMapId, faction: currentTestFaction || null };
      sim = createSim(currentSeed, simInit);
      log = createLog(currentSeed, simInit);   // capture the init so an in-memory replay reproduces THIS board, not default MAP/WAVES
    }
    ui = createUiState();
    mode = 'play';
    replayQueue = [];
    replayIdx = 0;
    activeReplayLog = null;
    ended = false;
    interlude = true;                                // every fresh board opens on the tap-to-start overlay
    if (hud && hud.setNextWavePrompt) hud.setNextWavePrompt(true, 'TAP TO START');
    accumulator = 0;
    pendingEvents = [];
    inputHandle = createInput(canvas, renderer, () => sim, submit, ui);
    if (hud && hud.hideResult) hud.hideResult();
    resetCommTracking();
    preDialogFaction = null;
    // a contract modal (shown by selectMap after restart) suppresses the primary until answered,
    // so the start tip can depend on the accept/decline outcome
    if (voicePacks !== null && !suppressPreDialog) playPreBattleDialog(null);   // wave-1 challenge before the first tap
  }
  let suppressPreDialog = false;

  function endInterlude() {
    if (!interlude) return;
    interlude = false;
    accumulator = 0;                      // no time-jump on resume
    hud.setNextWavePrompt(false);
    comm.dismiss();                       // the held speaker signs off
    submit({ type: 'startWave' });
  }

  // ── ring-campaign map switch (Map picker): rebuild board, waves, renderer — different maps have
  //    different sizes, so the PIXI surface resizes and the static board redraws. Overrides authored
  //    in the Map Lab load from content/maps/overrides/map-<id>.json when present.
  // ── TERRAIN FORGE lookup — the NEW mapping system (owner 2026-07-17): maps are FACTION-OWNED.
  // Every faction battle loads the forge map authored for THAT faction + map number. The tool saves
  // slots under short faction names ('Powder'); the game speaks full names ('Ground / Powder').
  const FORGE_SLOT_NAME = { 'Ground / Powder': 'Powder', 'Greenies (Chem)': 'Greenies' };
  const forgeSlotFaction = (f) => FORGE_SLOT_NAME[f] || f;
  const forgeFileSlug = (f) => forgeSlotFaction(f).toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-+|-+$)/g, '');
  // Lookup order: localStorage slot (the authoring hot loop — terrain.html Save, same origin) →
  // committed content/maps/forge/<faction>-map-<n>.json (the SHIP path, survives browser wipes and
  // deploys to Pages) → null, which falls back to the OLD workbook generator (testing only — all
  // future map development happens in the forge).
  async function loadForgeMap(mapId) {
    const fac = forgeSlotFaction(currentTestFaction || DEFAULT_FACTION);
    try {
      const all = JSON.parse(localStorage.getItem('bulwark:maps') || '{}');
      const hit = all[`${fac} · map ${mapId}`];
      if (hit) return hit;
    } catch (e) { /* unreadable store */ }
    try {
      const r = await fetch(`content/maps/forge/${forgeFileSlug(fac)}-map-${mapId}.json`);
      if (r.ok) return await r.json();
    } catch (e) { /* no committed map for this faction+slot */ }
    return null;
  }

  let mapSelectSeq = 0;   // guards against overlapping selectMap() calls: only the newest may install a board
  async function selectMap(mapId) {
    const mySeq = ++mapSelectSeq;
    const id = mapId | 0;
    let nextMap, nextWaves;
    try {
      if (!id) {
        nextMap = MAP;
        nextWaves = currentTestFaction ? makeWaves(currentTestFaction) : WAVES;
      } else {
        // STAGE 2: a Terrain Forge map saved for this slot (terrain.html → Save) wins — it's read from
        // the SAME-ORIGIN localStorage the tool writes, so authoring in the tool → playing here needs no
        // file copy. Falls back to the workbook generator (+ any Map Lab override file) when none exists.
        const forge = await loadForgeMap(id);
        if (mySeq !== mapSelectSeq) return;                 // a newer selectMap superseded us during the load
        let m;
        if (forge) {
          // Pass the render's bake tune (tf.bake.v1) so the sim's blocking is warped to MATCH the drawn
          // cliffs — otherwise units path around the grid-aligned blocking and appear to walk into the
          // organically-warped cliffs. {} → buildTerrainMap uses bakeTerrain's own defaults (still matches).
          let bakeTune = {};
          try { const t = JSON.parse(localStorage.getItem('tf.bake.v1')); if (t && typeof t === 'object') bakeTune = t; } catch (_) { /* default tune */ }
          m = buildTerrainMap(forge, id, { seed: 0, bakeTune });
        } else {
          let overrides = null;
          try {
            const r = await fetch(`content/maps/overrides/map-${id}.json`);
            if (r.ok) overrides = await r.json();
          } catch (e) { /* no override file — generator output as-is */ }
          if (mySeq !== mapSelectSeq) return;
          m = buildCampaignMap(id, { seed: 0, overrides });
        }
        resolveResourceTypes(m, 1);   // harvest lands later; faction 1 typing for the node markers
        nextMap = m;
        nextWaves = buildCampaignWaves(m, currentTestFaction);
      }
    } catch (e) {
      // A corrupt-but-JSON-parseable forge slot (the known WIP-corruption case) makes the builder throw.
      // Bail cleanly — never leave currentMapId advanced against a stale board (was an unhandled rejection).
      console.error('[selectMap] build failed for map', id, e);
      flashMessage(hud, `Map ${id} failed to load — ${(e && e.message) || e}`);
      return;
    }
    if (mySeq !== mapSelectSeq) return;                     // superseded after the build, before we commit
    currentMapId = id;
    currentMap = nextMap;
    currentWaves = nextWaves;
    app.renderer.resolution = fitResolution(currentMap.cols * currentMap.tile, currentMap.rows * currentMap.tile);
    app.renderer.resize(currentMap.cols * currentMap.tile, currentMap.rows * currentMap.tile);
    const art = renderer && renderer.unitArt;
    const vox = renderer && renderer.voxelArt;   // voxel packs load once at boot — carry them too
    const dec = renderer && renderer.decorArt;   // decor packs too
    destroyRenderer(renderer);                   // free the old renderer's GPU tree before replacing it
    app.stage.removeChildren();
    renderer = createRenderer(app, currentMap);
    renderer.fxScale = fxScaleForMap(currentMapId);     // battle-FX size tier for this map
  renderer.projScale = projScaleForMap(currentMapId); // projectile damping (early maps shrink shots)
    if (art) renderer.unitArt = art;
    if (vox) renderer.voxelArt = vox;
    if (dec) renderer.decorArt = dec;
    restart(currentSeed);
    flashMessage(hud, currentMapId ? `${currentMap.name} — ${currentMap.cols}x${currentMap.rows}, ${currentMap.primary}${currentMap.hasWater ? ', water' : ''}` : 'Classic board');

    // ── QUEST CONTRACT offer (owner design): a character from the map's quest-giver faction
    // makes the pitch before the first tap. Skipped when the map seeds no quest fields (maps
    // 1-2) or the map's contract is already FULFILLED.
    runContract = null;
    suppressPreDialog = false;
    // WB2 — WAVE PREVIEW: after the contract dialog resolves (or immediately when there's none),
    // show the incoming-wave lineup once per map entry. The reusable gameDialog shell.
    const showPreview = () => showWavePreview(mountEl, currentWaves, _shapeOf, null);
    if (currentMapId) {
      const sv = loadSave();
      const already = sv.maps[currentMapId] && sv.maps[currentMapId].contract === 'FULFILLED';
      const offer = already ? null : buildOffer(currentMapId, currentMap, voicePacks, sv);
      if (offer) {
        // OWNER ordering: the CONTRACT MODAL resolves first, THEN the primary speaks — the
        // start tip only exists when the answer is yes, so the dialog must wait for the answer.
        suppressPreDialog = true;
        comm.dismiss();
        showContractModal(mountEl, offer, {
          onAccept: () => { applyAccept(offer); runContract = offer; flashMessage(hud, 'Contract accepted — haul the quest crystals'); suppressPreDialog = false; if (voicePacks) playPreBattleDialog(null); showPreview(); },
          onDecline: () => { applyDecline(offer); flashMessage(hud, 'Contract declined — ' + offer.giver + ' will remember (−' + offer.declineCost + ' loyalty)'); suppressPreDialog = false; if (voicePacks) playPreBattleDialog(null); showPreview(); },
        });
      } else {
        showPreview();
      }
    } else {
      showPreview();
    }
  }
  // _shapeOf: unitId → readable shape for the wave preview (WB2). Defined here so it closes over nothing.
  function _shapeOf(unitId) { try { return getUnitDef(unitId).shape; } catch (e) { return unitId; } }

  function playReplay(replayLog) {
    if (!replayLog || typeof replayLog.seed !== 'number') {
      flashMessage(hud, 'invalid replay log');
      return;
    }
    if (inputHandle) { destroyInput(inputHandle); inputHandle = null; }
    mode = 'replay';
    interlude = false;                               // replays run start-to-end, no tap gates
    if (hud && hud.setNextWavePrompt) hud.setNextWavePrompt(false);
    currentSeed = Math.floor(replayLog.seed);
    activeReplayLog = replayLog;
    sim = createSim(currentSeed, { waves: currentWaves, map: currentMap, carry: pendingCarry });
    ui = createUiState();
    replayQueue = (replayLog.commands || []).slice().sort((a, b) => a.tick - b.tick);
    replayIdx = 0;
    ended = false;
    accumulator = 0;
    pendingEvents = [];
    inputHandle = createInput(canvas, renderer, () => sim, submit, ui);
    if (hud && hud.hideResult) hud.hideResult();
    resetCommTracking();
    flashMessage(hud, 'replay playback started');
  }

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  const hud = createHud(mountEl, {
    onBuildSelect: (structId) => {
      ui.buildSelection = structId;
      if (structId !== null) ui.selectedStructureId = null;
    },
    onStartWave: () => {
      if (interlude) { endInterlude(); return; }
      submit({ type: 'startWave' });
    },
    onNextWave: () => { endInterlude(); },
    onDeselect: () => { ui.selectedUnitId = null; ui.selectedStructureId = null; },
    onMainMenu: () => { if (hud && hud.hideResult) hud.hideResult(); menu.open('maps'); },
    onNextMap: () => {
      if (!(currentMapId > 0 && currentMapId < 9)) return;
      // MAP TRANSITION (owner 2026-07-16): a NEW map is a clean tactical slate — structures are
      // CLEARED (only WAVE-to-wave within a map keeps them), the base is healed, resources are
      // fresh, the camera zooms back in. The banked GOLD carries so you rebuild your fortress.
      const carry = { gold: (sim.finalScore && sim.finalScore.goldRemaining) || 0, structures: [] };
      pendingCarry = carry;
      updateSave((sv) => { sv.carry = carry; sv.goldBank = carry.gold; });
      void selectMap(currentMapId + 1);
    },
    onVolume: (channel, v) => { setChannelVolume(channel, v); },
    onBuyHarvesterUnit: () => {
      const res = submit({ type: 'buyHarvester' });
      flashMessage(hud, (res && res.ok) ? ('Harvester purchased' + (res.cost ? ' (−' + res.cost + 'g)' : ''))
        : ((res && res.reason === 'max harvesters') ? 'Max harvesters (4)' : ('Harvester: ' + ((res && res.reason) || 'unavailable'))));
    },
    defaultFaction: DEFAULT_FACTION,
    onFactionSelect: (faction) => {
      // Rebuild the enemy schedule for the chosen faction (or the mixed roster) and restart the run.
      currentTestFaction = faction || null;
      if (currentMapId) {
        // FACTION-OWNED MAPS (forge): the battlefield belongs to the enemy faction, so switching
        // enemies re-selects the map — the new faction's forge slot loads (or the generator fallback).
        void selectMap(currentMapId);
        return;
      }
      currentWaves = faction ? makeWaves(faction) : WAVES;
      restart(currentSeed);
      flashMessage(hud, faction ? (faction + ' — ' + currentWaves.length + ' waves') : 'Mixed roster restored');
    },
    onMapSelect: (mapId) => { pendingCarry = null; void selectMap(mapId); },   // hand-picking a map = fresh start
    defaultMapId: DEFAULT_MAP_ID,
    // SUBJECT→ACTION grammar (owner): a completed action CONSUMES the selection; a failed one keeps
    // the subject and says why — same rules as the harvester flow (input.js).
    onUpgrade: (id) => {
      const res = submit({ type: 'upgrade', id });
      if (res && res.ok) ui.selectedStructureId = null;
      else flashMessage(hud, 'Upgrade: ' + ((res && res.reason) || 'unavailable'));
    },
    onSell: (id) => {
      const res = submit({ type: 'sell', id });
      if (res && res.ok) ui.selectedStructureId = null;
      else flashMessage(hud, 'Sell: ' + ((res && res.reason) || 'unavailable'));
    },
    onRepair: (id) => {
      const res = submit({ type: 'repair', id });
      if (res && res.ok) ui.selectedStructureId = null;
      else flashMessage(hud, 'Repair: ' + ((res && res.reason) || 'unavailable'));
    },
    onExportLog: () => {
      try {
        if (ended && mode === 'play' && !log.finalHash) log.finalHash = hashState(sim);
        const json = serializeLog(log);
        console.log('[Bulwark] exported battle log:', json);
        flashMessage(hud, 'battle log exported to console');
      } catch (e) {
        console.error('[Bulwark] export failed', e);
        flashMessage(hud, 'export failed');
      }
    },
    onRunReplay: () => {
      try {
        // Replay the LAST COMPLETED game — captured on game end so it survives Restart (which resets the live
        // log) and page reload. Mid-game with nothing finished yet → fall back to the current session if ended.
        const src = lastReplayLog || (ended ? serializeLog(log) : null);
        if (!src) { flashMessage(hud, 'no finished game to replay yet'); return; }
        const cloned = deserializeLog(src);
        try {
          const check = runReplay(cloned);
          console.log('[Bulwark] headless replay hash:', check.hash, 'matches:', check.matches);
        } catch (e) {
          console.warn('[Bulwark] headless replay check failed', e);
        }
        playReplay(cloned);
      } catch (e) {
        console.error('[Bulwark] replay failed', e);
        flashMessage(hud, 'replay failed');
      }
    },
    onBalanceReport: () => {
      try {
        const report = runPricingReport();
        if (console.table) console.table(report); else console.log(report);
        flashMessage(hud, 'balance report logged to console');
      } catch (e) {
        console.error('[Bulwark] balance report failed', e);
        flashMessage(hud, 'balance report failed');
      }
    },
    onToggleCollision: () => {
      ui.debugCollision = !ui.debugCollision;
      return ui.debugCollision;
    },
    onToggleFieldRings: () => {
      ui.showFieldRings = !ui.showFieldRings;
      return ui.showFieldRings;
    },
    onRestart: (newSeed) => {
      restart(newSeed);
    },
  });

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  inputHandle = createInput(canvas, renderer, () => sim, submit, ui);

  // boot = a fresh board on the DEFAULT MAP: selectMap rebuilds sim+renderer for map 1 and its
  // restart() opens the wave-1 tap-to-start overlay
  // ── MAIN MENU (the menu epic, slice 1) ──────────────────────────────
  // Boot lands on the menu; picking a map starts the battle underneath it. Dev loop is protected:
  // ?map=N boots STRAIGHT into that map with no menu (0 = classic).
  // ── PLAYTEST OVERRIDES (owner 2026-07-16) — URL query jumps straight into a specific fight:
  //   ?map=<0-9>   0 = classic board, 1-9 = campaign map
  //   ?wave=<1-8>  start at this wave (earlier waves skipped; a gold stipend scales with it)
  //   ?faction=<name>  enemy faction — fuzzy match (e.g. air, greenies, dark, powder)
  //   ?seed=<n>    deterministic seed (already honored at boot)
  // e.g. index.html?map=6&wave=5&faction=air  — map 6, opening on wave 5 vs the Air faction.
  let devMap = null, devWave = null, devFaction = null;
  try {
    const q = window.location.search || '';
    const mm = /[?&]map=(\d+)/.exec(q); if (mm) devMap = parseInt(mm[1], 10) | 0;
    const wm = /[?&]wave=(\d+)/.exec(q); if (wm) devWave = Math.max(1, Math.min(8, parseInt(wm[1], 10) | 0));
    const fm = /[?&]faction=([^&]+)/.exec(q);
    if (fm) {
      const q2 = decodeURIComponent(fm[1]).toLowerCase();
      devFaction = FACTION_NAMES.find((n) => n.toLowerCase().includes(q2)) || null;   // fuzzy
      if (devFaction) currentTestFaction = devFaction;
    }
  } catch (e) { /* file:// quirks */ }
  {
    const sv = loadSave();
    if (sv.carry) pendingCarry = sv.carry;   // the campaign survives a page reload now
    // enemy faction chosen in SETTINGS persists across reloads (URL ?faction= still wins)
    if (!devFaction && sv.enemyFaction) currentTestFaction = sv.enemyFaction;
  }
  const menu = createMenu(mountEl, {
    onPlayMap: (id) => { menu.close(); void selectMap(id); },
    onSelectFaction: (f) => {
      // Choosing/resetting the enemy is a FRESH battle (owner: reset includes wave + economy +
      // structures): set the faction, drop the carried gold/defenses, rebuild the schedule and
      // restart from wave 1 with a full base and starting economy.
      currentTestFaction = f || DEFAULT_FACTION;
      pendingCarry = null; runContract = null;
      currentWaves = currentMapId ? buildCampaignWaves(currentMap, currentTestFaction)
        : (currentTestFaction ? makeWaves(currentTestFaction) : WAVES);
      restart(currentSeed);
    },
    onResetCampaign: () => { resetSave(); pendingCarry = null; runContract = null; currentTestFaction = DEFAULT_FACTION; flashMessage(hud, 'Campaign reset — start from Map 1'); },   // the chosen enemy drives the wave builder
    onBuyTier: (type, tier) => { buyStructTier(type, tier); },
    onBuyHarvester: (level, cost) => {
      updateSave((sv) => {
        if ((sv.harvesterLevel || 1) !== level - 1) return;                    // strict ladder
        if (!sv.carry || (sv.carry.gold || 0) < cost) return;
        sv.carry.gold -= cost;
        sv.goldBank = sv.carry.gold;
        sv.harvesterLevel = level;
      });
      pendingCarry = loadSave().carry;                                         // the battle sees the spent bank
    },
    onReplay: () => {
      menu.close();
      void selectMap(devMap != null ? devMap : DEFAULT_MAP_ID);
      // replay runs off the persisted last log once the board exists
      setTimeout(() => { if (lastReplayLog) playReplay(deserializeLog(lastReplayLog)); }, 50);   // lastReplayLog is a JSON string — playReplay wants the parsed log
    },
  });
  // Defer the initial board dispatch to a microtask so the rest of this init function (comm, voicePacks,
  // factionVisits, resetCommTracking …) finishes declaring first. The classic-board path (?map=0) runs
  // selectMap synchronously through restart(), which touches those bindings — running it inline threw a TDZ.
  queueMicrotask(() => {
    if (devMap != null) {
      menu.close();
      void selectMap(devMap).then(() => {
        if (devWave && devWave > 1 && sim.waves) {
          // jump to the wave: skip earlier waves, grant a stipend that scales so the board isn't empty
          sim.waves.current = devWave - 1;
          sim.economy.money = Math.max(sim.economy.money || 0, 900 + (devWave - 1) * 450);
          preDialogFaction = null;
          if (voicePacks !== null && !suppressPreDialog) playPreBattleDialog(null);   // dialog for the jumped wave
        }
        flashMessage(hud, 'Playtest: map ' + devMap + (devWave ? ' · wave ' + devWave : '') + (devFaction ? ' · vs ' + devFaction : ''));
      });
    }
    else void selectMap(loadSave().unlockedThrough <= 1 ? DEFAULT_MAP_ID : Math.min(9, loadSave().unlockedThrough));
  });

  // ---------------------------------------------------------------------
  // Comm dialog (render-side only), per the Dialog & Storytelling System doc:
  // challenge on wave start (M0/M1), win commentary on wave clear (M2),
  // concession/taunt on match end (M3/M4). Speakers + lines come from the 81
  // authored voice packs (content/dialog/voicepacks.json), picked
  // deterministically from (faction, wave, seed) so replays hear the same calls.
  // ---------------------------------------------------------------------
  const comm = createComm(document);
  let voicePacks = null;
  loadVoicePacks().then((p) => {
    voicePacks = p;
    if (p) console.log('[dialog] voice packs loaded:', Object.keys(p.factions).length, 'factions');
    // boot lands on the tap-to-start interlude before the packs resolve — deliver wave 1's challenge now
    if (interlude && mode === 'play' && !preDialogFaction) playPreBattleDialog(null);
  });
  const factionVisits = {};      // faction -> waves seen (test-mode rotation, dialog.js)
  let lastWaveFaction = null;    // wave 'clear' / match-end events carry no faction — remember it
  let structuresLostThisWave = 0;

  function resetCommTracking() {
    for (const k in factionVisits) delete factionVisits[k];
    lastWaveFaction = null;
    structuresLostThisWave = 0;
  }

  function commChallenge(faction, wave, hold) {
    factionVisits[faction] = (factionVisits[faction] || 0) + 1;
    lastWaveFaction = faction;
    structuresLostThisWave = 0;
    const call = challengeCall(voicePacks, faction, wave, currentSeed, factionVisits[faction])
      || fallbackCall(faction, wave, currentSeed);
    return comm.showCall(hold ? { ...call, hold: true } : call);
  }

  // ── PRE-BATTLE dialog sequence (owner: ALL dialog before the battle) ──
  // Runs inside the frozen interlude: the cleared wave's commentary plays through, THEN the
  // UPCOMING wave's challenge — whose speaker HOLDS on screen until the tap starts the fight.
  let preDialogFaction = null;   // challenge already delivered pre-battle → skip it at wave start
  function playPreBattleDialog(clearCall) {
    const idx = sim.waves ? sim.waves.current : 0;          // next wave = table index `current`
    const next = (currentWaves && currentWaves[idx]) || null;
    const faction = (next && next.faction) || null;
    void (async () => {
      if (clearCall) await comm.showCall(clearCall);        // M2 runs fully (auto sign-off)
      if (!interlude || mode !== 'play' || !faction) return;
      preDialogFaction = faction;
      // ── OWNER DIALOG TIMING (2026-07-16) ──────────────────────────────────────────────
      // 1. PRIMARY character speaks (held; TAP TO CLOSE appears when the line ends)
      // 2. tapping closes it — the START prompt NEVER shows while a dialog is up
      // 3. SECONDARY (match START only): a TIP, iff the loyalty deal is live (contract accepted)
      // 4. one-second beat, THEN "TAP TO START"
      if (hud && hud.setNextWavePrompt) hud.setNextWavePrompt(false);
      const closed = comm.waitForClose();
      await commChallenge(faction, idx + 1, true);          // primary, held
      await closed;
      if (!interlude || mode !== 'play') return;
      if (idx === 0) {
        // MATCH START: optional secondary tip (contract accepted), 1s beat, explicit TAP TO START
        // (the build phase before wave 1 stays player-paced).
        if (runContract && voicePacks) {
          const tip = tipsCall(voicePacks, runContract.giver, (currentSeed | 0) + idx, 'tip');
          if (tip) {
            const closed2 = comm.waitForClose();
            await comm.showCall(Object.assign({}, tip, { hold: true }));
            await closed2;
            if (!interlude || mode !== 'play') return;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
        if (interlude && mode === 'play' && hud && hud.setNextWavePrompt) hud.setNextWavePrompt(true, 'TAP TO START');
      } else {
        // BETWEEN WAVES: the close WAS the continue — a 1s beat, then start the next wave (its
        // incoming-wave banner shows on wave start). No tap-to-start prompt.
        await new Promise((r) => setTimeout(r, 1000));
        if (interlude && mode === 'play') endInterlude();
      }
    })();
  }
  function commOutcome() {
    const hpPct = (sim.base && sim.base.maxHp) ? Math.max(0, sim.base.hp) / sim.base.maxHp : 1;
    return classifyOutcome(hpPct, structuresLostThisWave);
  }

  // ---------------------------------------------------------------------
  // Fixed-timestep game loop
  // ---------------------------------------------------------------------
  app.ticker.add(() => {
    const dtMs = (app.ticker && typeof app.ticker.deltaMS === 'number') ? app.ticker.deltaMS : 1000 / 60;
    if (!ended && !interlude) {
      accumulator += Math.min(dtMs / 1000, 0.25);
      while (accumulator >= FIXED_DT && !ended) {
        if (mode === 'replay') {
          while (replayIdx < replayQueue.length && replayQueue[replayIdx].tick <= sim.tick) {
            applyCommand(sim, replayQueue[replayIdx].cmd);
            replayIdx++;
          }
        }
        const evs = stepSim(sim, FIXED_DT);
        if (evs && evs.length) {
          for (let i = 0; i < evs.length; i++) {
            pendingEvents.push(evs[i]);
            // Boldly announce who's attacking, before the wave's enemies appear.
            if (evs[i].type === 'waveStars') {
              showStarBanner(hud, evs[i].wave, evs[i].stars);   // Story 4: stars FIRST, then the dialog beat
            }
            if (evs[i].type === 'wave' && evs[i].phase === 'start' && evs[i].faction) {
              showWaveBanner(hud, evs[i].faction);
              // the challenge already played during the interlude (pre-battle sequencing); it only
              // fires here when no interlude preceded the wave (replays)
              if (preDialogFaction === evs[i].faction) preDialogFaction = null;
              else commChallenge(evs[i].faction, evs[i].wave);
            }
            if (evs[i].type === 'destroyed') structuresLostThisWave++;
            // harvest feedback: what the haul was worth (quest hauls pay loyalty, not gold)
            if (evs[i].type === 'deposit') {
              const d = evs[i];
              flashMessage(hud, d.role === 'quest' ? `+${d.units} quest units (loyalty)` : `+${d.gold}g ${d.role}`);
            }
            // Between waves (owner 2026-07-16): ONE dialog from the opposing (next) faction, held.
            // NO tap-to-start prompt — the dialog's TAP TO CLOSE is the continue: closing it (after
            // a 1s beat) starts the next wave, which shows the usual incoming-wave banner. The held
            // card IS the build breather; no M2 win-commentary between waves.
            if (evs[i].type === 'wave' && evs[i].phase === 'clear' && evs[i].wave < evs[i].total) {
              if (mode === 'play') {
                interlude = true;
                playPreBattleDialog(null);      // the next faction's challenge; close = continue
                // WB5 — BONUS PICKER: the sim rolled a 3-of-16 offer at this clear (sim.bonuses.offer).
                // The pick submits chooseBonus (replay-logged); no pick before the next wave = forfeit.
                if (sim.bonuses && sim.bonuses.offer && sim.bonuses.offer.length) {
                  showBonusPicker(mountEl, sim.bonuses.offer, getBonusDef, (bonusId) => {
                    const res = submit({ type: 'chooseBonus', bonusId });
                    const d = getBonusDef(bonusId);
                    flashMessage(hud, (res && res.ok) ? ('Bonus: ' + (d ? d.label : bonusId)) : ('Bonus failed: ' + ((res && res.reason) || '')));
                  }, sim.bonuses.owned);
                }
              } else if (lastWaveFaction) {
                comm.showCall(winCall(voicePacks, lastWaveFaction, evs[i].wave, currentSeed, commOutcome(), false));
              }
            }
          }
        }
        accumulator -= FIXED_DT;
        if (sim.result) {
          ended = true;
          // battle over (owner): clear any selection so the unit/structure panel doesn't linger
          // over the result overlay
          ui.selectedUnitId = null; ui.selectedStructureId = null; ui.buildSelection = null; ui.hoverValid = false;
          if (mode === 'play') {
            log.finalHash = hashState(sim);
            // Capture this finished game so "Run Replay" can replay it (survives Restart + reload).
            try {
              lastReplayLog = serializeLog(log);
              if (typeof localStorage !== 'undefined') localStorage.setItem('bulwark:lastReplay', lastReplayLog);
            } catch (e) { /* storage blocked/full */ }
          } else if (activeReplayLog && activeReplayLog.finalHash) {
            const h = hashState(sim);
            console.log('[Bulwark] replay final hash:', h,
              'expected:', activeReplayLog.finalHash,
              'match:', h === activeReplayLog.finalHash);
          }
          // campaign advance (owner): victory offers the next, bigger map (1→9; none after 9 or on classic)
          let nextMap = null;
          if (sim.result === 'win' && currentMapId > 0 && currentMapId < 9) {
            try {
              const nm = buildCampaignMap(currentMapId + 1, { seed: 0 });
              nextMap = { id: currentMapId + 1, name: nm.name || ('Map ' + (currentMapId + 1)), size: (nm.cols - 4) + 'x' + (nm.rows - 4) };
            } catch (e) { nextMap = { id: currentMapId + 1, name: 'Map ' + (currentMapId + 1), size: '' }; }
          }
          recordResult(currentMapId, sim.result, sim.finalScore, sim.waveStars, sim.waves ? sim.waves.total : 8, currentTestFaction);
          // the SECONDARY's end-of-match reward faction (captured before runContract is cleared)
          const rewardFaction = (runContract && runContract.giver) || lastWaveFaction;
          const fiveStar = Array.isArray(sim.waveStars) && sim.waveStars.some((w) => w.stars === 5);
          // judge the ACCEPTED contract from the hauled quest crystals (red + green units)
          if (runContract) {
            const hauled = sim.mapScore ? (sim.mapScore.questRed || 0) + (sim.mapScore.questGreen || 0) : 0;
            const verdict = judgeContract(runContract, hauled, sim.result === 'win');
            flashMessage(hud, verdict.outcome === 'FULFILLED'
              ? 'CONTRACT FULFILLED — +' + verdict.gain + ' ' + runContract.giver + ' loyalty' +
                (verdict.alignShift ? (verdict.alignShift > 0 ? ' · your reputation brightens' : ' · your reputation darkens') : '')
              : 'CONTRACT BROKEN — ' + (verdict.gain >= 0 ? '+' : '') + verdict.gain + ' ' + runContract.giver + ' loyalty');
            runContract = null;
          }
          showResult(hud, sim.result, sim.finalScore, nextMap, sim.waveStars);
          // M3/M4 — the final word — DELAYED so the owner's wave-8 order holds:
          // wave star score (banner) -> final map score (overlay) -> PRIMARY dialog -> then, as
          // part of the REWARD FLOW, the SECONDARY grants the star bonus (5-star wave this battle).
          if (lastWaveFaction) {
            const call = sim.result === 'win'
              ? winCall(voicePacks, lastWaveFaction, sim.waves ? sim.waves.current : 0, currentSeed, commOutcome(), true)
              : defeatCall(voicePacks, lastWaveFaction, currentSeed);
            setTimeout(async () => {
              await comm.showCall(call);
              if (sim.result === 'win' && fiveStar && voicePacks) {
                const grant = tipsCall(voicePacks, rewardFaction, (currentSeed ^ 0x51ab), 'reward');
                if (grant) comm.showCall(grant);
              }
            }, 1500);
          }
        }
      }
    }
    // Replay-mode indicator — make it obvious a replay is playing (and when it finishes).
    if (hud.setReplay) {
      if (mode === 'replay') {
        const s = Math.max(0, Math.floor(sim.time || 0));
        const lbl = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + (ended ? '  (ended)' : '');
        hud.setReplay(true, lbl);
      } else {
        hud.setReplay(false);
      }
    }
    // SELF-HEALING dialog guard: a held card is only legitimate during an interlude. If the player
    // tapped START while the challenge was still typing (fast mobile taps), the dismiss fired
    // BEFORE the hold existed and the card would sit over the battle forever — release it the
    // frame it appears. dismiss() is a no-op when nothing is held.
    if (mode === 'play' && !interlude) comm.dismiss();
    // placement ghost re-validates every frame — money changes while the pointer is still
    if (inputHandle && inputHandle.refreshHover) inputHandle.refreshHover();
    // harvester/base interaction hints (owner): input sets ui.pendingHint, we flash it once
    if (ui && ui.pendingHint) { flashMessage(hud, ui.pendingHint.text); ui.pendingHint = null; }
    renderFrame(renderer, sim, ui, pendingEvents, dtMs / 1000);   // pass REAL frame time so FX track sim time
    updateHud(hud, sim, ui);
    pendingEvents = [];
  });

  // ---------------------------------------------------------------------
  // Public handle (sim/log rebind on restart, so expose live getters)
  // ---------------------------------------------------------------------
  return {
    get sim() { return sim; },
    get log() { return log; },
    restart,
    playReplay,
  };
}
