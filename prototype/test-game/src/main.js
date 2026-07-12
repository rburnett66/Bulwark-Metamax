import { MAP, WAVES, makeWaves } from './data/tables.js';
import { createSim, applyCommand, stepSim, FIXED_DT } from './sim/core.js';
import { createLog, recordCommand, serializeLog, deserializeLog, hashState, runReplay } from './sim/replay.js';
import { runPricingReport } from './sim/balanceSim.js';
import { createRenderer, renderFrame } from './render/renderer.js';
import { createHud, updateHud, showResult, flashMessage, showWaveBanner } from './render/hud.js';
import { createInput, createUiState, destroyInput } from './input/input.js';
import { createComm } from './comm/commCard.js';
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
  const app = new PIXI.Application({
    width: boardW,
    height: boardH,
    backgroundColor: 0x0e1216,
    antialias: true,
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
  let currentWaves = WAVES;   // active enemy schedule — the mixed campaign, or one faction's waves (test picker)
  let sim = createSim(currentSeed, { waves: currentWaves, map: MAP });
  let log = createLog(currentSeed);
  let ui = createUiState();

  const renderer = createRenderer(app, MAP);

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
    sim = createSim(currentSeed, { waves: currentWaves, map: MAP });
    log = createLog(currentSeed);
    ui = createUiState();
    mode = 'play';
    replayQueue = [];
    replayIdx = 0;
    activeReplayLog = null;
    ended = false;
    accumulator = 0;
    pendingEvents = [];
    inputHandle = createInput(canvas, renderer, () => sim, submit, ui);
    if (hud && hud.hideResult) hud.hideResult();
    resetCommTracking();
  }

  function playReplay(replayLog) {
    if (!replayLog || typeof replayLog.seed !== 'number') {
      flashMessage(hud, 'invalid replay log');
      return;
    }
    if (inputHandle) { destroyInput(inputHandle); inputHandle = null; }
    mode = 'replay';
    currentSeed = Math.floor(replayLog.seed);
    activeReplayLog = replayLog;
    sim = createSim(currentSeed, { waves: currentWaves, map: MAP });
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
      submit({ type: 'startWave' });
    },
    onFactionSelect: (faction) => {
      // Rebuild the enemy schedule for the chosen faction (or the campaign) and restart the run to test it.
      currentWaves = faction ? makeWaves(faction) : WAVES;
      restart(currentSeed);
      flashMessage(hud, faction ? (faction + ' — ' + currentWaves.length + ' test waves') : 'Campaign restored');
    },
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
    onRestart: (newSeed) => {
      restart(newSeed);
    },
  });

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  inputHandle = createInput(canvas, renderer, () => sim, submit, ui);

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
  });
  const factionVisits = {};      // faction -> waves seen (test-mode rotation, dialog.js)
  let lastWaveFaction = null;    // wave 'clear' / match-end events carry no faction — remember it
  let structuresLostThisWave = 0;

  function resetCommTracking() {
    for (const k in factionVisits) delete factionVisits[k];
    lastWaveFaction = null;
    structuresLostThisWave = 0;
  }

  function commChallenge(faction, wave) {
    factionVisits[faction] = (factionVisits[faction] || 0) + 1;
    lastWaveFaction = faction;
    structuresLostThisWave = 0;
    comm.showCall(challengeCall(voicePacks, faction, wave, currentSeed, factionVisits[faction])
      || fallbackCall(faction, wave, currentSeed));
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
    if (!ended) {
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
              commChallenge(evs[i].faction, evs[i].wave);
            }
            if (evs[i].type === 'destroyed') structuresLostThisWave++;
            // M2 — the repelled faction comments on how the wave went (final wave: M3 handles it).
            if (evs[i].type === 'wave' && evs[i].phase === 'clear' && lastWaveFaction && evs[i].wave < evs[i].total) {
              comm.showCall(winCall(voicePacks, lastWaveFaction, evs[i].wave, currentSeed, commOutcome(), false));
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
          showResult(hud, sim.result, sim.finalScore);   // s12: show the computed final score
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
