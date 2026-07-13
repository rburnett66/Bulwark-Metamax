import { STRUCTURES, ASSUMPTIONS, getStructureDef, factionsInRoster } from '../data/tables.js';
import { getSellValue } from '../sim/economy.js';
import { VERSION, VERSION_NOTE } from '../version.js';

const STYLE_ID = 'bw-hud-style';

const CSS = `
.bw-hud { position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;
  font-family: 'Courier New', monospace; color:#e8e8e8; user-select:none; z-index:10; }
.bw-hud * { box-sizing:border-box; }
.bw-panel { background:rgba(10,14,20,0.85); border:1px solid #3a4a5a; border-radius:4px; padding:6px 8px; pointer-events:auto; }
.bw-topbar { position:absolute; top:6px; left:6px; right:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.bw-faction { pointer-events:auto; background:#141b22; color:#e8e8e8; border:1px solid #26313c; border-radius:4px;
  padding:3px 6px; font:inherit; font-size:12px; cursor:pointer; }
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
.bw-nextwave { position:absolute; inset:0; pointer-events:auto; cursor:pointer; border:none; background:transparent;
  z-index:70; /* the WHOLE SCREEN is the tap target; sits above the comm card (60) */
  display:flex; align-items:center; justify-content:center; font:inherit; }
.bw-nextwave > span { background:rgba(10,16,22,0.88); border:2px solid #5fe0ff; border-radius:8px; color:#e7f6ff;
  font-size:clamp(15px, 4.5vw, 22px); font-weight:bold; letter-spacing:3px; padding:16px 30px;
  box-shadow:0 0 24px -6px #5fe0ff; animation: bw-nw-pulse 1.6s ease-in-out infinite; }
@keyframes bw-nw-pulse { 0%,100% { box-shadow:0 0 24px -6px #5fe0ff; } 50% { box-shadow:0 0 34px -2px #5fe0ff; } }
.bw-palette { position:absolute; left:6px; top:56px; width:168px; display:flex; flex-direction:column; gap:4px; }
.bw-palette .bw-title { font-size:11px; color:#9ab; margin-bottom:2px; }
.bw-buildbtn { display:flex; justify-content:space-between; width:100%; text-align:left; }
.bw-buildbtn .bw-cost { color:#ffd76a; }
.bw-buildbtn.bw-poor { opacity:0.45; }
.bw-key { font-weight:800; color:#ffe58a; }   /* bold keyboard-shortcut glyph on build + action buttons */
.bw-selpanel { position:absolute; right:6px; top:56px; width:200px; font-size:12px; display:none; flex-direction:column; gap:4px; }
.bw-selpanel .bw-sname { font-size:13px; font-weight:bold; color:#bfe0ff; }
.bw-selpanel .bw-shpbar { width:100%; height:10px; background:#222; border:1px solid #555; }
.bw-selpanel .bw-shpfill { height:100%; background:#4c4; }
.bw-selrow { display:flex; gap:4px; }
.bw-unitpanel { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); min-width:290px; max-width:460px;
  background:rgba(9,14,20,0.94); border:1px solid #2c3e50; border-radius:7px; padding:8px 14px; display:none;
  font-size:12px; color:#dfeef5; box-shadow:0 3px 16px rgba(0,0,0,0.55); z-index:20; }
.bw-unitpanel .bw-uname { font-size:15px; font-weight:800; color:#ffe58a; }
.bw-unitpanel .bw-usub { color:#8fb0c4; font-size:11px; margin-bottom:5px; text-transform:capitalize; }
.bw-unitpanel .bw-uhp { height:6px; background:#1c2630; border-radius:3px; overflow:hidden; margin-bottom:6px; }
.bw-unitpanel .bw-uhpfill { height:100%; background:#5c5; transition:width .1s; }
.bw-unitpanel .bw-ustats { display:grid; grid-template-columns:1fr 1fr; gap:2px 18px; }
.bw-unitpanel .bw-ustat { display:flex; justify-content:space-between; border-bottom:1px solid #182430; padding:1px 0; }
.bw-unitpanel .bw-ustat .k { color:#7f9fb2; }
.bw-unitpanel .bw-ustat .v { color:#eaf6ff; font-weight:600; }
.bw-selrow .bw-btn { flex:1; font-size:11px; padding:3px 4px; }
.bw-bottombar { position:absolute; left:6px; bottom:52px; display:none; flex-direction:column; gap:8px; align-items:flex-start;
  z-index:65; max-width:min(430px, calc(100vw - 16px)); }
.bw-bottombar.open { display:flex; }
.bw-help { font-size:10px; color:#8fa4b8; line-height:1.4; }
.bw-gear { position:absolute; left:6px; bottom:6px; pointer-events:auto; z-index:66;
  background:rgba(10,16,22,0.9); border:1px solid #4a6076; border-radius:6px; color:#cfe3f0;
  font-size:18px; width:38px; height:38px; cursor:pointer; }
.bw-gear:hover { background:#22303e; }
.bw-vol { display:flex; align-items:center; gap:6px; font-size:11px; color:#8fa4b8; }
.bw-vol input { width:110px; accent-color:#5fe0ff; }
.bw-vol span.v { min-width:52px; }
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
.bw-wavebanner { position:absolute; left:50%; top:34%; transform:translate(-50%,-50%); text-align:center;
  pointer-events:none; opacity:0; transition:opacity .25s ease; z-index:30; white-space:nowrap; }
.bw-wavebanner.bw-show { opacity:1; }
.bw-wavebanner .bw-line { font-size:40px; font-weight:900; letter-spacing:1px; color:#ff5a3c;
  text-shadow:0 3px 12px #000, 0 0 26px rgba(255,80,40,0.65); text-transform:uppercase; }
.bw-wavebanner .bw-sub { font-size:18px; font-weight:700; letter-spacing:3px; color:#ffd6c8;
  text-shadow:0 2px 6px #000; margin-top:6px; }
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
    const key = phase != null ? String(phase).toLowerCase() : '';
    const label = PHASE_READOUT[key] || (phase ? String(phase).toUpperCase() : '');
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

  // Faction TEST picker — choose one faction so every wave spawns only its units (or "Campaign" for the mix).
  // Changing it restarts the run with that faction's waves.
  const factionSel = el(doc, 'select', 'bw-faction');
  factionSel.title = 'Test a specific faction (restarts the run) — or Campaign for the full escalating mix';
  const optAll = el(doc, 'option', null, 'Campaign (all)'); optAll.value = ''; factionSel.appendChild(optAll);
  for (const f of factionsInRoster()) { const o = el(doc, 'option', null, f); o.value = f; factionSel.appendChild(o); }
  if (cbs.defaultFaction) factionSel.value = cbs.defaultFaction;   // boot pick (main.js seeds the waves to match)
  factionSel.addEventListener('change', () => { if (cbs.onFactionSelect) cbs.onFactionSelect(factionSel.value || null); });

  // MAP picker — the classic fixed board, or a generated ring-campaign map (maps GDD). Changing it
  // rebuilds the board (sizes differ per map) and restarts the run. Author/edit maps in the Map Lab.
  const mapSel = el(doc, 'select', 'bw-faction');
  mapSel.title = 'Board: Classic (fixed slice) or a ring-campaign map 1-9 (restarts the run)';
  const optClassic = el(doc, 'option', null, 'Classic board'); optClassic.value = '0'; mapSel.appendChild(optClassic);
  for (let m = 1; m <= 9; m++) { const o = el(doc, 'option', null, 'Map ' + m + ' (rings)'); o.value = String(m); mapSel.appendChild(o); }
  mapSel.addEventListener('change', () => { if (cbs.onMapSelect) cbs.onMapSelect(Number(mapSel.value) || 0); });

  topbar.appendChild(hpwrap);
  topbar.appendChild(timerEl);
  topbar.appendChild(moneyEl);
  topbar.appendChild(waveEl);
  // QUEST objectives readout — red + green crystal units hauled (owner color economy). Hidden on
  // boards with no resources.
  const questEl = el(doc, 'span', 'bw-seed');
  questEl.style.display = 'none';
  questEl.title = 'Quest crystals hauled (red / green) — they also pay gold';
  topbar.appendChild(questEl);
  topbar.appendChild(startWaveBtn);
  topbar.appendChild(factionSel);
  topbar.appendChild(mapSel);
  topbar.appendChild(seedEl);
  // Between-wave INTERLUDE prompt — centered TAP TO START; shown while the sim is frozen after the
  // wave-clear dialog (the speaker stays on screen). Clicking it is the only way time resumes.
  const nextWaveBtn = el(doc, 'button', 'bw-nextwave');
  const nextWaveLabel = el(doc, 'span', null, 'TAP TO START NEXT WAVE');
  nextWaveBtn.appendChild(nextWaveLabel);
  nextWaveBtn.style.display = 'none';
  nextWaveBtn.addEventListener('click', () => { if (cbs.onNextWave) cbs.onNextWave(); });
  root.appendChild(nextWaveBtn);

  // VERSION STAMP — which build this tab is actually running. The game's own VERSION (src/version.js —
  // bumped with every gameplay change) shows UNCONDITIONALLY, so it never depends on the server; the git
  // commit from serve_prototype.py's /__version is appended when available. Include it in bug reports.
  const buildEl = el(doc, 'span', 'bw-seed', VERSION + ' ' + VERSION_NOTE);
  buildEl.title = 'game version (src/version.js)';
  topbar.appendChild(buildEl);
  if (typeof console !== 'undefined') console.log('BULWARK ' + VERSION + ' (' + VERSION_NOTE + ')');
  if (typeof fetch === 'function') {
    fetch('/__version').then((r) => (r.ok ? r.json() : null)).then((v) => {
      if (v && v.commit && v.commit !== 'unknown') {
        buildEl.textContent = VERSION + ' ' + VERSION_NOTE + ' @' + v.commit + (v.dirty ? '+' : '');
        if (v.branch) buildEl.title = 'game version @ git commit — branch ' + v.branch + (v.dirty ? ' (uncommitted changes)' : '');
      }
    }).catch(() => {});
  }
  root.appendChild(topbar);

  // ---- build palette --------------------------------------------------
  const palette = el(doc, 'div', 'bw-palette bw-panel');
  palette.appendChild(el(doc, 'div', 'bw-title', 'BUILD  (1-' + Object.keys(STRUCTURES).length + ', Esc cancels)'));
  const paletteBtns = {};
  const structOrder = Object.keys(STRUCTURES);              // hotkey N (1-based) selects structOrder[N-1]
  const toggleBuild = (structId) => {
    const next = (hud.currentBuildSelection === structId) ? null : structId;
    if (cbs.onBuildSelect) cbs.onBuildSelect(next);
  };
  structOrder.forEach((structId, i) => {
    const def = STRUCTURES[structId];
    const btn = el(doc, 'button', 'bw-btn bw-buildbtn');
    const key = i + 1;                                      // 1,2,3,4...
    const nameSpan = el(doc, 'span');
    if (key <= 9) {                                         // BOLD hotkey digit + the structure name
      nameSpan.appendChild(el(doc, 'b', 'bw-key', String(key)));
      nameSpan.appendChild(doc.createTextNode('  ' + (def.name || structId)));
    } else {
      nameSpan.textContent = def.name || structId;
    }
    const costSpan = el(doc, 'span', 'bw-cost', String(def.cost && def.cost[0] != null ? def.cost[0] : '?') + 'g');
    btn.appendChild(nameSpan);
    btn.appendChild(costSpan);
    btn.addEventListener('click', () => toggleBuild(structId));
    palette.appendChild(btn);
    paletteBtns[structId] = btn;
  });
  root.appendChild(palette);
  // NB: the 1-4 / Esc build HOTKEYS are handled in input/input.js (which also refreshes the placement ghost);
  // the palette buttons just mirror that via toggleBuild(). Don't add a second key handler here — two handlers
  // double-toggle and cancel each other out (press = select then immediately deselect).

  // ---- selected-structure panel ---------------------------------------
  const selPanel = el(doc, 'div', 'bw-selpanel bw-panel');
  const sname = el(doc, 'div', 'bw-sname', '-');
  const sinfo = el(doc, 'div', null, '-');
  const shpbar = el(doc, 'div', 'bw-shpbar');
  const shpfill = el(doc, 'div', 'bw-shpfill');
  shpbar.appendChild(shpfill);
  const shptext = el(doc, 'div', null, '');
  const selrow = el(doc, 'div', 'bw-selrow');
  // action buttons carry their BOLD keyboard shortcut (handled in input/input.js): U upgrade, X sell, R repair
  const actionBtn = (label, keyChar) => {
    const b = el(doc, 'button', 'bw-btn');
    b.appendChild(el(doc, 'b', 'bw-key', keyChar));       // BOLD hotkey glyph (persists across label updates)
    const lbl = el(doc, 'span', null, ' ' + label);
    b.appendChild(lbl);
    b._label = lbl;                                       // updateHud rewrites THIS, not the whole button
    return b;
  };
  const upgradeBtn = actionBtn('Upgrade', 'U');
  const sellBtn = actionBtn('Sell', 'X');
  const repairBtn = actionBtn('Repair', 'R');
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

  // ---- selected UNIT info window (lower-middle) — name + live stats ----
  const unitPanel = el(doc, 'div', 'bw-unitpanel');
  const uname = el(doc, 'div', 'bw-uname', '-');
  const usub = el(doc, 'div', 'bw-usub', '');
  const uhp = el(doc, 'div', 'bw-uhp');
  const uhpfill = el(doc, 'div', 'bw-uhpfill');
  uhp.appendChild(uhpfill);
  const ustats = el(doc, 'div', 'bw-ustats');
  unitPanel.appendChild(uname);
  unitPanel.appendChild(usub);
  unitPanel.appendChild(uhp);
  unitPanel.appendChild(ustats);
  root.appendChild(unitPanel);

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
  const collisionBtn = el(doc, 'button', 'bw-btn', 'Collision: off');
  collisionBtn.title = 'Draw every unit\'s collision circle + centre point (render-side only)';
  collisionBtn.addEventListener('click', () => {
    if (!cbs.onToggleCollision) return;
    const on = cbs.onToggleCollision();
    collisionBtn.textContent = 'Collision: ' + (on ? 'ON' : 'off');
  });
  const fieldRingsBtn = el(doc, 'button', 'bw-btn', 'Field rings: off');
  fieldRingsBtn.title = 'Mark the resource field(s) the harvesters are assigned to (debug aid)';
  fieldRingsBtn.addEventListener('click', () => {
    if (!cbs.onToggleFieldRings) return;
    const on = cbs.onToggleFieldRings();
    fieldRingsBtn.textContent = 'Field rings: ' + (on ? 'ON' : 'off');
  });
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
  debug.appendChild(collisionBtn);
  debug.appendChild(fieldRingsBtn);
  debug.appendChild(seedInput);
  debug.appendChild(restartBtn);

  // ---- SETTINGS: volume sliders (master / dialog / game) ---------------
  // Values persist in localStorage and are applied via cbs.onVolume(channel, 0..1).
  const volPanel = el(doc, 'div', 'bw-debug bw-panel');
  const volumes = { master: 0.8, dialog: 1, game: 1 };
  try { Object.assign(volumes, JSON.parse(localStorage.getItem('bw.volumes') || '{}')); } catch (e) { /* fresh */ }
  const mkSlider = (channel, label) => {
    const row = el(doc, 'div', 'bw-vol');
    const name = el(doc, 'span', 'v', label);
    const input = el(doc, 'input');
    input.setAttribute('type', 'range');
    input.setAttribute('min', '0'); input.setAttribute('max', '100');
    input.value = String(Math.round((volumes[channel] ?? 1) * 100));
    const pct = el(doc, 'span', null, input.value + '%');
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      volumes[channel] = v;
      pct.textContent = input.value + '%';
      try { localStorage.setItem('bw.volumes', JSON.stringify(volumes)); } catch (e) { /* full */ }
      if (cbs.onVolume) cbs.onVolume(channel, v);
    });
    row.appendChild(name); row.appendChild(input); row.appendChild(pct);
    return row;
  };
  volPanel.appendChild(mkSlider('master', 'Master'));
  volPanel.appendChild(mkSlider('dialog', 'Dialog'));
  volPanel.appendChild(mkSlider('game', 'Game'));
  // hand the persisted values to the game once at boot
  if (cbs.onVolume) for (const ch of ['master', 'dialog', 'game']) cbs.onVolume(ch, volumes[ch] ?? 1);

  bottombar.appendChild(volPanel);
  bottombar.appendChild(help);
  bottombar.appendChild(debug);
  root.appendChild(bottombar);

  // gear button (lower-left) shows/hides the whole options stack — the board stays clean by default
  const gearBtn = el(doc, 'button', 'bw-gear', '⚙');
  gearBtn.title = 'Settings — volumes, debug tools, restart';
  gearBtn.addEventListener('click', () => { bottombar.classList.toggle('open'); });
  root.appendChild(gearBtn);

  // ---- toast -----------------------------------------------------------
  const toast = el(doc, 'div', 'bw-toast');
  root.appendChild(toast);

  // ---- pre-wave faction announcement -----------------------------------
  const waveBanner = el(doc, 'div', 'bw-wavebanner');
  const waveBannerMain = el(doc, 'div', 'bw-line', '');
  const waveBannerSub = el(doc, 'div', 'bw-sub', 'prepare for attack!');
  waveBanner.appendChild(waveBannerMain);
  waveBanner.appendChild(waveBannerSub);
  root.appendChild(waveBanner);

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
    questEl,
    nextWaveBtn,
    setNextWavePrompt(on, label) {
      nextWaveBtn.style.display = on ? 'flex' : 'none';
      if (label) nextWaveLabel.textContent = label;
    },
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
    unitPanel,
    uname,
    usub,
    uhpfill,
    ustats,
    toast,
    toastTimer: null,
    waveBanner,
    waveBannerMain,
    waveBannerTimer: null,
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

  // Quest crystal objectives (campaign maps only)
  if (hud.questEl) {
    if (state.mapScore) {
      hud.questEl.style.display = '';
      hud.questEl.innerHTML = '<span style="color:#ff7a6a">● ' + (state.mapScore.questRed || 0) +
        '</span> <span style="color:#7ae08a">● ' + (state.mapScore.questGreen || 0) + '</span>';
    } else {
      hud.questEl.style.display = 'none';
    }
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
    hud.upgradeBtn._label.textContent = ' ' + (s.tier >= maxTier ? 'Max Tier' : 'Upgrade (' + upCost + 'g)');   // keep bold U
    let sellVal = 0;
    try { sellVal = getSellValue(s, STRUCTURES, ASSUMPTIONS); } catch (e) { sellVal = 0; }
    hud.sellBtn.disabled = busy;
    hud.sellBtn._label.textContent = ' Sell (+' + Math.floor(sellVal) + 'g)';   // keep bold X
    hud.repairBtn.disabled = busy || s.hp >= s.maxHp;
  }

  // ---- Selected UNIT info window (lower-middle): name + live stats ----
  const uId = ui ? ui.selectedUnitId : null;
  let u = null;
  if (uId != null && state.units && typeof state.units.get === 'function') u = state.units.get(uId) || null;
  if (!u || u.hp <= 0) {
    hud.unitPanel.style.display = 'none';
  } else {
    hud.unitPanel.style.display = 'block';
    const fmt = (n) => (typeof n === 'number' ? String(Math.round(n * 10) / 10) : (n == null ? '—' : String(n)));
    const frac = u.maxHp > 0 ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
    hud.uhpfill.style.width = (frac * 100).toFixed(0) + '%';
    hud.uhpfill.style.background = frac > 0.5 ? '#5c5' : (frac > 0.25 ? '#dd5' : '#e55');
    let rows;
    if (u.isHarvester) {
      // the HARVESTER is its own thing — a resource hauler, not a Ground/Powder truck. Its panel
      // reads the economy loop (cargo, yield, job state), never combat stats it doesn't have.
      const HARVEST_STATE = {
        harvestIdle: 'docked — awaiting orders', harvestGo: 'driving to the field',
        harvestPull: 'harvesting', harvestReturn: 'hauling home',
      };
      hud.uname.textContent = 'Harvester';
      hud.usub.textContent = 'resource hauler · click a crystal field to send it';
      rows = [
        ['HP', Math.max(0, Math.ceil(u.hp)) + ' / ' + Math.ceil(u.maxHp)],
        ['Cargo', Math.floor(u.cargo || 0) + ' / ' + (u.capacity || 0)],
        ['Speed', fmt(u.speed)],
        ['Yield', 'x' + fmt(u.yieldMult || 1)],
        ['Status', HARVEST_STATE[u.state] || u.state || '—'],
        ['Dock', u.homePos ? (u.homePos.x + ',' + u.homePos.y) : '—'],
      ];
    } else {
      hud.uname.textContent = (u.faction ? u.faction + ' ' : '') + (u.kind || u.unitId || 'Unit') + (u.tier > 1 ? '  T' + u.tier : '');
      hud.usub.textContent = [u.role, u.domain, u.side].filter(Boolean).join(' · ');
      rows = [
        ['HP', Math.max(0, Math.ceil(u.hp)) + ' / ' + Math.ceil(u.maxHp)],
        ['DPS', fmt(u.dps)],
        ['Range', fmt(u.range)],
        ['Speed', fmt(u.speed)],
        ['Armor', u.armorClass || '—'],
        ['Damage', u.damageType || '—'],
        ['Targets', u.canTarget || (u.targetsBase ? 'Base' : '—')],
        ['Vision', fmt(u.vision)],
      ];
    }
    while (hud.ustats.firstChild) hud.ustats.removeChild(hud.ustats.firstChild);
    for (let i = 0; i < rows.length; i++) {
      const row = el(hud.doc, 'div', 'bw-ustat');
      row.appendChild(el(hud.doc, 'span', 'k', rows[i][0]));
      row.appendChild(el(hud.doc, 'span', 'v', rows[i][1]));
      hud.ustats.appendChild(row);
    }
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

/** Boldly announce the attacking faction before the wave's enemies appear: "<Faction> Incoming, prepare for
 *  attack!". Fires on the wave-start event; auto-fades after ~3s. */
export function showWaveBanner(hud, faction) {
  if (!hud || !hud.waveBanner) return;
  hud.waveBannerMain.textContent = (faction || 'Enemy') + ' Incoming,';
  hud.waveBanner.classList.add('bw-show');
  if (typeof clearTimeout === 'function' && hud.waveBannerTimer) clearTimeout(hud.waveBannerTimer);
  if (typeof setTimeout === 'function') {
    hud.waveBannerTimer = setTimeout(() => { hud.waveBanner.classList.remove('bw-show'); }, 3000);
  }
}
