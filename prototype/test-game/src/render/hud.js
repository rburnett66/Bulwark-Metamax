import { STRUCTURES, ASSUMPTIONS, getStructureDef } from '../data/tables.js';
import { getSellValue } from '../sim/economy.js';

const STYLE_ID = 'bw-hud-style';

const CSS = `
.bw-hud { position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;
  font-family: 'Courier New', monospace; color:#e8e8e8; user-select:none; z-index:10; }
.bw-hud * { box-sizing:border-box; }
.bw-panel { background:rgba(10,14,20,0.85); border:1px solid #3a4a5a; border-radius:4px; padding:6px 8px; pointer-events:auto; }
.bw-topbar { position:absolute; top:6px; left:6px; right:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.bw-hpwrap { display:flex; align-items:center; gap:6px; }
.bw-hpbar { width:160px; height:14px; background:#2a1616; border:1px solid #713; position:relative; }
.bw-hpfill { height:100%; background:#d33; width:100%; transition:width 0.15s linear; }
.bw-hptext { font-size:11px; min-width:86px; }
.bw-money { position:relative; font-size:15px; color:#ffd76a; font-weight:bold; min-width:110px; }
.bw-delta { position:absolute; left:100%; top:0; margin-left:6px; font-size:12px; font-weight:bold;
  animation: bw-delta-rise 0.9s ease-out forwards; pointer-events:none; white-space:nowrap; }
@keyframes bw-delta-rise { from { opacity:1; transform:translateY(0);} to { opacity:0; transform:translateY(-16px);} }
.bw-wave { font-size:13px; }
.bw-timer { font-size:18px; font-weight:bold; color:#8fe0ff; min-width:96px; letter-spacing:1px;
  font-variant-numeric:tabular-nums; }
.bw-btn { pointer-events:auto; background:#22303e; color:#e8e8e8; border:1px solid #4a6076; border-radius:3px;
  padding:4px 8px; font-family:inherit; font-size:12px; cursor:pointer; }
.bw-btn:hover:not(:disabled) { background:#2f4356; }
.bw-btn:disabled { opacity:0.4; cursor:default; }
.bw-btn.bw-selected { background:#3d6a3d; border-color:#7ac07a; }
.bw-seed { font-size:11px; color:#8fa4b8; }
.bw-palette { position:absolute; left:6px; top:56px; width:168px; display:flex; flex-direction:column; gap:4px; }
.bw-palette .bw-title { font-size:11px; color:#9ab; margin-bottom:2px; }
.bw-buildbtn { display:flex; justify-content:space-between; width:100%; text-align:left; }
.bw-buildbtn .bw-cost { color:#ffd76a; }
.bw-buildbtn.bw-poor { opacity:0.45; }
.bw-selpanel { position:absolute; right:6px; top:56px; width:200px; font-size:12px; display:none; flex-direction:column; gap:4px; }
.bw-selpanel .bw-sname { font-size:13px; font-weight:bold; color:#bfe0ff; }
.bw-selpanel .bw-shpbar { width:100%; height:10px; background:#222; border:1px solid #555; }
.bw-selpanel .bw-shpfill { height:100%; background:#4c4; }
.bw-selrow { display:flex; gap:4px; }
.bw-selrow .bw-btn { flex:1; font-size:11px; padding:3px 4px; }
.bw-bottombar { position:absolute; left:6px; bottom:6px; right:6px; display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
.bw-help { font-size:10px; color:#8fa4b8; line-height:1.4; }
.bw-debug { display:flex; gap:4px; align-items:center; flex-wrap:wrap; }
.bw-seedinput { width:84px; background:#141a22; color:#e8e8e8; border:1px solid #4a6076; border-radius:3px;
  font-family:inherit; font-size:12px; padding:3px 4px; pointer-events:auto; }
.bw-toast { position:absolute; left:50%; top:70px; transform:translateX(-50%); background:rgba(60,20,20,0.92);
  border:1px solid #c66; border-radius:4px; padding:6px 14px; font-size:13px; color:#ffd7d7;
  display:none; pointer-events:none; }
.bw-result { position:absolute; left:0; top:0; right:0; bottom:0; display:none; align-items:center; justify-content:center;
  background:rgba(0,0,0,0.55); pointer-events:auto; flex-direction:column; gap:14px; }
.bw-result.bw-show { display:flex; }
.bw-rbanner { font-size:36px; font-weight:bold; letter-spacing:2px; text-shadow:0 2px 8px #000; }
.bw-rbanner.bw-win { color:#9f9; }
.bw-rbanner.bw-lose { color:#f99; }
.bw-rscore { margin:6px 0 10px; text-align:center; }
.bw-rscore-total { font-size:22px; font-weight:bold; letter-spacing:1px; color:#ffe08a; text-shadow:0 1px 4px #000; }
.bw-rscore-line { font-size:12px; color:#bbb; margin-top:3px; }
.bw-replaybar { position:absolute; left:50%; top:12px; transform:translateX(-50%); display:none;
  background:rgba(20,42,72,0.94); color:#cfe6ff; border:1px solid rgba(120,180,220,0.75);
  padding:5px 16px; border-radius:6px; font:bold 13px sans-serif; letter-spacing:1.5px; z-index:6;
  box-shadow:0 2px 10px rgba(0,0,0,0.5); }
.bw-rscore { font-size:22px; font-weight:bold; color:#ffd76a; text-shadow:0 2px 8px #000; }
.bw-rscore-breakdown { font-size:13px; color:#cfe0f0; line-height:1.6; text-align:left; background:rgba(10,14,20,0.6); border:1px solid #3a4a5a; border-radius:4px; padding:8px 14px; }
.bw-rscore-breakdown .bw-pos { color:#9f9; }
.bw-rscore-breakdown .bw-neg { color:#f99; }
.bw-rscores { font-size:13px; color:#cfe0f0; line-height:1.6; text-align:left; background:rgba(10,14,20,0.6); border:1px solid #3a4a5a; border-radius:4px; padding:8px 14px; }
.bw-rscores .bw-title { font-size:12px; color:#9ab; margin-bottom:4px; text-align:center; }
.bw-rscores .bw-srow { display:flex; justify-content:space-between; gap:16px; }
.bw-rscores .bw-srow.bw-best { color:#ffd76a; font-weight:bold; }
`;

function injectStyle(doc) {
  try {
    if (doc.getElementById && doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    const host = doc.head || doc.body || doc.documentElement;
    if (host) host.appendChild(style);
  } catch (e) { /* styling is non-critical */ }
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function createHud(mountEl, callbacks) {
  const cbs = callbacks || {};
  const doc = mountEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('createHud: no document available');

  // NOTE: do NOT use getComputedStyle here (may not exist in headless boot).
  // Just ensure the mount element is a positioning context for the overlay.
  try {
    if (!mountEl.style.position || mountEl.style.position === 'static') {
      mountEl.style.position = 'relative';
    }
  } catch (e) { /* non-critical */ }

  injectStyle(doc);

  const root = el(doc, 'div', 'bw-hud');

  // ---- top bar --------------------------------------------------------
  const topbar = el(doc, 'div', 'bw-topbar bw-panel');
  const hpwrap = el(doc, 'div', 'bw-hpwrap');
  const hpbar = el(doc, 'div', 'bw-hpbar');
  const hpfill = el(doc, 'div', 'bw-hpfill');
  hpbar.appendChild(hpfill);
  const hptext = el(doc, 'span', 'bw-hptext', 'Base: --/--');
  hpwrap.appendChild(hpbar);
  hpwrap.appendChild(hptext);
  cbs.__updHp = (hp, maxHp) => {
    const m = maxHp || 1;
    const cur = hp != null ? hp : 0;
    hpfill.style.width = Math.max(0, Math.min(100, (cur / m) * 100)) + '%';
    hptext.textContent = 'Base: ' + Math.max(0, Math.round(cur)) + '/' + Math.round(m);
  };

  const timerEl = el(doc, 'span', 'bw-timer', '00:00:0');
  const moneyEl = el(doc, 'span', 'bw-money', '0g');
  const waveEl = el(doc, 'span', 'bw-wave', 'Wave 0/0');
  const startWaveBtn = el(doc, 'button', 'bw-btn', 'Start Wave');
  startWaveBtn.addEventListener('click', () => { if (cbs.onStartWave) cbs.onStartWave(); });
  const seedEl = el(doc, 'span', 'bw-seed', 'seed: -');
  cbs.__updMoney = (money) => { moneyEl.textContent = Math.round(money || 0) + 'g'; };
  const PHASE_READOUT = {
    build: 'BUILD', spawning: 'SPAWN', combat: 'FIGHT', cleared: 'CLEAR',
    victory: 'WIN', defeat: 'LOSE', idle: 'IDLE'
  };
  cbs.__updWave = (cur, total, phase) => {
    const label = (phase && PHASE_READOUT[phase]) || '';
    waveEl.textContent = 'Wave ' + (cur || 0) + '/' + (total || 0) + (label ? ' [' + label + ']' : '');
  };
  cbs.__updSeed = (seed) => { seedEl.textContent = 'seed: ' + (seed != null ? seed : '-'); };
  cbs.__updTimer = (t) => {
    const secs = Math.max(0, t || 0);
    const mm = Math.floor(secs / 60);
    const ss = Math.floor(secs % 60);
    const tenths = Math.floor((secs * 10) % 10);
    timerEl.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ':' + tenths;
  };
  cbs.__updBtn = (canStart) => { startWaveBtn.disabled = !canStart; };

  topbar.appendChild(hpwrap);
  topbar.appendChild(timerEl);
  topbar.appendChild(moneyEl);
  topbar.appendChild(waveEl);
  topbar.appendChild(startWaveBtn);
  topbar.appendChild(seedEl);
  root.appendChild(topbar);

  // ---- build palette --------------------------------------------------
  const palette = el(doc, 'div', 'bw-palette bw-panel');
  palette.appendChild(el(doc, 'div', 'bw-title', 'BUILD'));
  const paletteBtns = {};
  for (const structId of Object.keys(STRUCTURES)) {
    const def = STRUCTURES[structId];
    const btn = el(doc, 'button', 'bw-btn bw-buildbtn');
    const nameSpan = el(doc, 'span', null, def.name || structId);
    const costSpan = el(doc, 'span', 'bw-cost', String(def.cost && def.cost[0] != null ? def.cost[0] : '?') + 'g');
    btn.appendChild(nameSpan);
    btn.appendChild(costSpan);
    btn.addEventListener('click', () => {
      const next = (hud.currentBuildSelection === structId) ? null : structId;
      if (cbs.onBuildSelect) cbs.onBuildSelect(next);
    });
    palette.appendChild(btn);
    paletteBtns[structId] = btn;
  }
  root.appendChild(palette);

  // ---- selected-structure panel ---------------------------------------
  const selPanel = el(doc, 'div', 'bw-selpanel bw-panel');
  const sname = el(doc, 'div', 'bw-sname', '-');
  const sinfo = el(doc, 'div', null, '-');
  const shpbar = el(doc, 'div', 'bw-shpbar');
  const shpfill = el(doc, 'div', 'bw-shpfill');
  shpbar.appendChild(shpfill);
  const shptext = el(doc, 'div', null, '');
  const selrow = el(doc, 'div', 'bw-selrow');
  const upgradeBtn = el(doc, 'button', 'bw-btn', 'Upgrade');
  const sellBtn = el(doc, 'button', 'bw-btn', 'Sell');
  const repairBtn = el(doc, 'button', 'bw-btn', 'Repair');
  upgradeBtn.addEventListener('click', () => { if (cbs.onUpgrade && hud.currentSelectedId != null) cbs.onUpgrade(hud.currentSelectedId); });
  sellBtn.addEventListener('click', () => { if (cbs.onSell && hud.currentSelectedId != null) cbs.onSell(hud.currentSelectedId); });
  repairBtn.addEventListener('click', () => { if (cbs.onRepair && hud.currentSelectedId != null) cbs.onRepair(hud.currentSelectedId); });
  selrow.appendChild(upgradeBtn);
  selrow.appendChild(sellBtn);
  selrow.appendChild(repairBtn);
  selPanel.appendChild(sname);
  selPanel.appendChild(sinfo);
  selPanel.appendChild(shpbar);
  selPanel.appendChild(shptext);
  selPanel.appendChild(selrow);
  root.appendChild(selPanel);

  // ---- bottom bar (help + debug) --------------------------------------
  const bottombar = el(doc, 'div', 'bw-bottombar');
  const help = el(doc, 'div', 'bw-help bw-panel',
    'Click a build button, then a slot/cell to place. Click a structure to select it. Esc cancels build mode.');
  const debug = el(doc, 'div', 'bw-debug bw-panel');
  const exportBtn = el(doc, 'button', 'bw-btn', 'Export Log');
  exportBtn.addEventListener('click', () => { if (cbs.onExportLog) cbs.onExportLog(); });
  const replayBtn = el(doc, 'button', 'bw-btn', 'Run Replay');
  replayBtn.addEventListener('click', () => { if (cbs.onRunReplay) cbs.onRunReplay(); });
  const balanceBtn = el(doc, 'button', 'bw-btn', 'Balance Report');
  balanceBtn.addEventListener('click', () => { if (cbs.onBalanceReport) cbs.onBalanceReport(); });
  const seedInput = el(doc, 'input', 'bw-seedinput');
  seedInput.setAttribute('type', 'text');
  seedInput.setAttribute('placeholder', 'seed');
  const restartBtn = el(doc, 'button', 'bw-btn', 'Restart');
  restartBtn.addEventListener('click', () => {
    if (!cbs.onRestart) return;
    const n = Number(seedInput.value);
    cbs.onRestart(Number.isFinite(n) && seedInput.value !== '' ? Math.floor(n) : hud.lastSeed);
  });
  debug.appendChild(exportBtn);
  debug.appendChild(replayBtn);
  debug.appendChild(balanceBtn);
  debug.appendChild(seedInput);
  debug.appendChild(restartBtn);
  bottombar.appendChild(help);
  bottombar.appendChild(debug);
  root.appendChild(bottombar);

  // ---- toast -----------------------------------------------------------
  const toast = el(doc, 'div', 'bw-toast');
  root.appendChild(toast);

  // ---- replay-mode indicator --------------------------------------------
  const replayBar = el(doc, 'div', 'bw-replaybar', '');
  root.appendChild(replayBar);

  // ---- result overlay ---------------------------------------------------
  const resultEl = el(doc, 'div', 'bw-result');
  const banner = el(doc, 'div', 'bw-rbanner', '');
  const scoreEl = el(doc, 'div', 'bw-rscore', '');   // s12: final-score breakdown
  const resultRestart = el(doc, 'button', 'bw-btn', 'Restart');
  resultRestart.addEventListener('click', () => {
    if (cbs.onRestart) cbs.onRestart(hud.lastSeed);
  });
  resultEl.appendChild(banner);
  resultEl.appendChild(scoreEl);
  resultEl.appendChild(resultRestart);
  root.appendChild(resultEl);

  mountEl.appendChild(root);

  const hud = {
    doc,
    root,
    callbacks: cbs,
    hpfill,
    hptext,
    moneyEl,
    waveEl,
    timerEl,
    startWaveBtn,
    seedEl,
    paletteBtns,
    selPanel,
    sname,
    sinfo,
    shpfill,
    shptext,
    upgradeBtn,
    sellBtn,
    repairBtn,
    toast,
    toastTimer: null,
    resultEl,
    banner,
    scoreEl,
    replayBar,
    lastMoney: null,
    lastSeed: 1,
    currentSelectedId: null,
    currentBuildSelection: null,
    hideResult() {
      resultEl.classList.remove('bw-show');
      resultEl.style.display = 'none';
    },
    setReplay(active, label) {
      if (!replayBar) return;
      if (active) {
        replayBar.textContent = '▶ REPLAY' + (label ? '  ·  ' + label : '');
        replayBar.style.display = 'block';
      } else {
        replayBar.style.display = 'none';
      }
    },
  };
  return hud;
}

/** Format a simulation-time value (seconds) as MM:SS for the HUD clock. */
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
}

export function updateHud(hud, state, ui) {
  if (!hud || !state) return;
  hud.lastSeed = state.seed;
  hud.seedEl.textContent = 'seed: ' + state.seed;
  // Game clock: the sim advances state.time each tick (sim/core.js:378), but the timer span was created and
  // never updated (and wasn't even on the hud object). Tick it here so the clock actually counts up.
  if (hud.timerEl) hud.timerEl.textContent = fmtTime(state.time);

  // Base HP
  const base = state.base || { hp: 0, maxHp: 1 };
  const frac = base.maxHp > 0 ? Math.max(0, Math.min(1, base.hp / base.maxHp)) : 0;
  hud.hpfill.style.width = (frac * 100).toFixed(1) + '%';
  hud.hptext.textContent = 'Base: ' + Math.max(0, Math.ceil(base.hp)) + '/' + Math.ceil(base.maxHp);

  // Money — the gold-gain "+N" now floats at the dying unit on the map (render/renderer.js coin FX), not the HUD.
  const money = Math.floor((state.economy && state.economy.money) || 0);
  hud.lastMoney = money;
  // update the text node without wiping delta spans
  if (hud.moneyEl.firstChild && hud.moneyEl.firstChild.nodeType === 3) {
    hud.moneyEl.firstChild.nodeValue = money + 'g';
  } else {
    hud.moneyEl.insertBefore(hud.doc.createTextNode(money + 'g'), hud.moneyEl.firstChild || null);
  }

  // Waves
  const waves = state.waves || { current: 0, total: 0, active: false };
  hud.waveEl.textContent = 'Wave ' + waves.current + '/' + waves.total + (waves.active ? ' (active)' : ' (build)');
  hud.startWaveBtn.disabled = !!(waves.active || state.result || waves.current >= waves.total);

  // Build palette
  hud.currentBuildSelection = ui ? ui.buildSelection : null;
  for (const structId of Object.keys(hud.paletteBtns)) {
    const btn = hud.paletteBtns[structId];
    const def = STRUCTURES[structId];
    const cost = def && def.cost ? def.cost[0] : 0;
    if (money < cost) btn.classList.add('bw-poor'); else btn.classList.remove('bw-poor');
    if (ui && ui.buildSelection === structId) btn.classList.add('bw-selected'); else btn.classList.remove('bw-selected');
  }

  // Selected structure panel
  const selId = ui ? ui.selectedStructureId : null;
  let s = null;
  if (selId != null && state.structures && typeof state.structures.get === 'function') {
    s = state.structures.get(selId) || null;
  }
  if (!s) {
    hud.currentSelectedId = null;
    hud.selPanel.style.display = 'none';
  } else {
    hud.currentSelectedId = selId;
    hud.selPanel.style.display = 'flex';
    let def = null;
    try { def = getStructureDef(s.structId); } catch (e) { def = null; }
    hud.sname.textContent = (def && def.name ? def.name : s.structId) + ' T' + s.tier;
    hud.sinfo.textContent = 'State: ' + s.lifecycle;
    const sfrac = s.maxHp > 0 ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 0;
    hud.shpfill.style.width = (sfrac * 100).toFixed(1) + '%';
    hud.shptext.textContent = 'HP ' + Math.max(0, Math.ceil(s.hp)) + '/' + Math.ceil(s.maxHp);

    const busy = s.lifecycle === 'Building' || s.lifecycle === 'Upgrading' || s.lifecycle === 'Selling' || s.lifecycle === 'Placing';
    const maxTier = def && def.hp ? def.hp.length : 3;
    const upCost = (def && def.cost && s.tier < maxTier) ? def.cost[s.tier] : Infinity;
    hud.upgradeBtn.disabled = busy || s.tier >= maxTier || money < upCost;
    hud.upgradeBtn.textContent = s.tier >= maxTier ? 'Max Tier' : 'Upgrade (' + upCost + 'g)';
    let sellVal = 0;
    try { sellVal = getSellValue(s, STRUCTURES, ASSUMPTIONS); } catch (e) { sellVal = 0; }
    hud.sellBtn.disabled = busy;
    hud.sellBtn.textContent = 'Sell (+' + Math.floor(sellVal) + 'g)';
    hud.repairBtn.disabled = busy || s.hp >= s.maxHp;
  }
}

export function showResult(hud, result, finalScore) {
  if (!hud) return;
  const win = result === 'win';
  hud.banner.textContent = win ? 'VICTORY' : 'DEFEAT';
  hud.banner.className = 'bw-rbanner ' + (win ? 'bw-win' : 'bw-lose');
  // s12: present the Final Score (kills − time − gold spent + gold left) the sim computes on game end.
  if (hud.scoreEl) {
    const fs = finalScore;
    if (fs && typeof fs.score === 'number') {
      const mm = String(fs.minutes != null ? fs.minutes : 0).padStart(2, '0');
      const ss = String(fs.seconds != null ? fs.seconds : 0).padStart(2, '0');
      hud.scoreEl.innerHTML =
        '<div class="bw-rscore-total">SCORE ' + fs.score + '</div>' +
        '<div class="bw-rscore-line">' + (fs.kills || 0) + ' kills · ' + mm + ':' + ss +
        ' · ' + (fs.goldRemaining || 0) + ' gold left</div>';
      hud.scoreEl.style.display = 'block';
    } else {
      hud.scoreEl.style.display = 'none';
    }
  }
  hud.resultEl.style.display = 'flex';
  hud.resultEl.classList.add('bw-show');
}

export function flashMessage(hud, text) {
  if (!hud) return;
  hud.toast.textContent = String(text);
  hud.toast.style.display = 'block';
  if (typeof clearTimeout === 'function' && hud.toastTimer) clearTimeout(hud.toastTimer);
  if (typeof setTimeout === 'function') {
    hud.toastTimer = setTimeout(() => { hud.toast.style.display = 'none'; }, 1600);
  }
}
