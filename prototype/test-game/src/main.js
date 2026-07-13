import { MAP, WAVES, makeWaves } from './data/tables.js';
import { buildCampaignMap, resolveResourceTypes } from './sim/mapgen.js';
import { buildCampaignWaves } from './sim/campaign.js';
import { createSim, applyCommand, stepSim, FIXED_DT } from './sim/core.js';
import { createLog, recordCommand, serializeLog, deserializeLog, hashState, runReplay } from './sim/replay.js';
import { runPricingReport } from './sim/balanceSim.js';
import { createRenderer, renderFrame } from './render/renderer.js';
import { createHud, updateHud, showResult, flashMessage, showWaveBanner } from './render/hud.js';
import { createInput, createUiState, destroyInput } from './input/input.js';
import { createComm } from './comm/commCard.js';
import { setChannelVolume } from './comm/voice.js';
import { loadVoicePacks, challengeCall, winCall, defeatCall, fallbackCall, classifyOutcome } from './comm/dialog.js';

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

  // Load the AUTHORED unit art (faction .units.json + sheets) asynchronously; once ready, units that have art
  // render as their real sprites. Non-blocking — the game runs with primitives until (and if) it resolves.
  import('./render/unitArt.js').then(({ loadUnitArt }) => loadUnitArt()).then((art) => {
    renderer.unitArt = art;
    if (art && art.ready) console.log('[unitArt] loaded', Object.keys(art.defs).length, 'authored units');
  }).catch((e) => console.warn('[unitArt] skipped:', e && e.message));

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
    sim = createSim(currentSeed, { waves: currentWaves, map: currentMap });
    log = createLog(currentSeed);
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
    if (voicePacks !== null) playPreBattleDialog(null);   // wave-1 challenge before the first tap
  }

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
  async function selectMap(mapId) {
    currentMapId = mapId | 0;
    if (!currentMapId) {
      currentMap = MAP;
      currentWaves = currentTestFaction ? makeWaves(currentTestFaction) : WAVES;
    } else {
      let overrides = null;
      try {
        const r = await fetch(`content/maps/overrides/map-${currentMapId}.json`);
        if (r.ok) overrides = await r.json();
      } catch (e) { /* no override file — generator output as-is */ }
      const m = buildCampaignMap(currentMapId, { seed: 0, overrides });
      resolveResourceTypes(m, 1);   // harvest lands later; faction 1 typing for the node markers
      currentMap = m;
      currentWaves = buildCampaignWaves(m, currentTestFaction);
    }
    app.renderer.resolution = fitResolution(currentMap.cols * currentMap.tile, currentMap.rows * currentMap.tile);
    app.renderer.resize(currentMap.cols * currentMap.tile, currentMap.rows * currentMap.tile);
    const art = renderer && renderer.unitArt;
    app.stage.removeChildren();
    renderer = createRenderer(app, currentMap);
    if (art) renderer.unitArt = art;
    restart(currentSeed);
    flashMessage(hud, currentMapId ? `${currentMap.name} — ${currentMap.cols}x${currentMap.rows}, ${currentMap.primary}${currentMap.hasWater ? ', water' : ''}` : 'Classic board');
  }

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
    sim = createSim(currentSeed, { waves: currentWaves, map: currentMap });
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
    onNextMap: () => { if (currentMapId > 0 && currentMapId < 9) selectMap(currentMapId + 1); },
    onVolume: (channel, v) => { setChannelVolume(channel, v); },
    defaultFaction: DEFAULT_FACTION,
    onFactionSelect: (faction) => {
      // Rebuild the enemy schedule for the chosen faction (or the mixed roster) and restart the run.
      currentTestFaction = faction || null;
      currentWaves = currentMapId
        ? buildCampaignWaves(currentMap, currentTestFaction)          // campaign map: refill the ring budgets
        : (faction ? makeWaves(faction) : WAVES);
      restart(currentSeed);
      flashMessage(hud, faction ? (faction + ' — ' + currentWaves.length + ' waves') : 'Mixed roster restored');
    },
    onMapSelect: (mapId) => { void selectMap(mapId); },
    defaultMapId: DEFAULT_MAP_ID,
    onUpgrade: (id) => {
      submit({ type: 'upgrade', id });
    },
    onSell: (id) => {
      const res = submit({ type: 'sell', id });
      if (res.ok) ui.selectedStructureId = null;
    },
    onRepair: (id) => {
      submit({ type: 'repair', id });
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
  void selectMap(DEFAULT_MAP_ID);

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
      await commChallenge(faction, idx + 1, true);          // M1 held — speaker waits for the tap
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
            // M2 — the repelled faction comments on how the wave went (final wave: M3 handles it).
            // In PLAY mode this opens the between-wave INTERLUDE: the speaker HOLDS on screen, the
            // sim freezes (timer + regrowth included), and a centered TAP TO START prompt resumes.
            if (evs[i].type === 'wave' && evs[i].phase === 'clear' && evs[i].wave < evs[i].total) {
              const call = lastWaveFaction ? winCall(voicePacks, lastWaveFaction, evs[i].wave, currentSeed, commOutcome(), false) : null;
              if (mode === 'play') {
                interlude = true;
                hud.setNextWavePrompt(true, 'TAP TO START NEXT WAVE');
                playPreBattleDialog(call);   // M2 commentary, then the next wave's held challenge
              } else if (call) {
                comm.showCall(call);
              }
            }
          }
        }
        accumulator -= FIXED_DT;
        if (sim.result) {
          ended = true;
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
          showResult(hud, sim.result, sim.finalScore, nextMap);   // s12: show the computed final score
          // M3/M4 — the final word: concession from the last faction on a win, the
          // Champion's authored defeat taunt on a loss.
          if (lastWaveFaction) {
            comm.showCall(sim.result === 'win'
              ? winCall(voicePacks, lastWaveFaction, sim.waves ? sim.waves.current : 0, currentSeed, commOutcome(), true)
              : defeatCall(voicePacks, lastWaveFaction, currentSeed));
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
